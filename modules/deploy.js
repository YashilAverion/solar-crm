// ── modules/deploy.js — Automated one-click deployment ──────────
const express = require('express');
const router = express.Router();
const { requireManager } = require('../helpers');
const config = require('../config');
const { Client } = require('ssh2');
const { exec } = require('child_process');
const fs = require('fs');

router.post('/deploy', requireManager, async (req, res) => {
    // Enable log streaming to the client in real-time via chunked transfer
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const log = (msg) => {
        console.log(`[DEPLOY] ${msg}`);
        res.write(`${msg}\n`);
    };

    log('🚀 Starting deployment process...');

    // Helper to run local commands
    const runLocalCmd = (cmd) => new Promise((resolve, reject) => {
        log(`Executing: ${cmd}`);
        exec(cmd, (err, stdout, stderr) => {
            if (stdout) log(stdout.trim());
            if (stderr) log(`[stderr] ${stderr.trim()}`);
            if (err) return reject(err);
            resolve();
        });
    });

    try {
        // Step 1: Check local git status
        log('Checking local git status...');
        const hasChanges = await new Promise((resolve) => {
            exec('git status --porcelain', (err, stdout) => {
                resolve(!!(stdout && stdout.trim()));
            });
        });

        if (hasChanges) {
            log('Local changes detected. Committing and pushing...');
            await runLocalCmd('git add .');
            await runLocalCmd('git commit -m "Auto-deploy from CRM Panel"');
        } else {
            log('No local changes to commit.');
        }

        log('Pushing latest code to GitHub...');
        await runLocalCmd('git push origin main');
        log('✅ Code successfully pushed to GitHub!');

        // Step 2: Connect to remote host via SSH and pull/restart
        const { sshHost, sshPort, sshUser, sshPassword, sshKeyPath, deployPath, restartCmd } = config.deployment;

        if (!sshHost || !sshUser || (!sshPassword && !sshKeyPath)) {
            log('\n⚠️ Remote SSH credentials are not configured in your .env file.');
            log('Local code has been pushed to GitHub, but you will need to pull it manually on the server.');
            log('To automate this step, configure the following variables in your .env file:');
            log('  DEPLOY_SSH_USER=your_username');
            log('  DEPLOY_SSH_PASSWORD=your_password (or DEPLOY_SSH_KEY_PATH=path_to_key)');
            log('  DEPLOY_PATH=path_to_crm_directory_on_server');
            log('\n🎉 Deployment complete (Code pushed to GitHub).');
            res.end();
            return;
        }

        log(`Connecting to remote server: ${sshHost}:${sshPort} as ${sshUser}...`);
        const conn = new Client();
        
        conn.on('ready', () => {
            log('🔒 SSH connection established successfully.');
            const commands = [];
            if (deployPath) {
                commands.push(`cd "${deployPath}"`);
            }
            commands.push('git pull origin main');
            commands.push('npm install --production');
            commands.push(restartCmd || 'pm2 restart server.js');

            const fullCmd = commands.join(' && ');
            log(`Running remote update pipeline: ${fullCmd}`);

            conn.exec(fullCmd, (err, stream) => {
                if (err) {
                    log(`❌ SSH Execution Error: ${err.message}`);
                    conn.end();
                    res.end();
                    return;
                }

                stream.on('close', (code, signal) => {
                    log(`Remote pipeline exited with code: ${code}`);
                    conn.end();
                    if (code === 0) {
                        log('🎉 Live server updated and restarted successfully!');
                        log('🚀 DEPLOYMENT SUCCESSFUL!');
                    } else {
                        log('❌ Live server update failed (Remote command exited with non-zero code).');
                    }
                    res.end();
                }).on('data', (data) => {
                    log(`[remote] ${data.toString().trim()}`);
                }).stderr.on('data', (data) => {
                    log(`[remote stderr] ${data.toString().trim()}`);
                });
            });
        }).on('error', (err) => {
            log(`❌ SSH Connection Error: ${err.message}`);
            res.end();
        });

        const connOpts = {
            host: sshHost,
            port: sshPort,
            username: sshUser
        };

        if (sshKeyPath) {
            try {
                connOpts.privateKey = fs.readFileSync(sshKeyPath);
            } catch (e) {
                log(`❌ Failed to read SSH Private Key at ${sshKeyPath}: ${e.message}`);
                res.end();
                return;
            }
        } else {
            connOpts.password = sshPassword;
        }

        conn.connect(connOpts);

    } catch (e) {
        log(`❌ Deployment failed: ${e.message}`);
        res.end();
    }
});

module.exports = router;
