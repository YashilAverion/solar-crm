const { exec } = require('child_process');
const { Client } = require('ssh2');
const fs = require('fs');

const runLocalCmd = (cmd) => new Promise((resolve, reject) => {
    console.log(`[local] Executing: ${cmd}`);
    exec(cmd, (err, stdout, stderr) => {
        if (stdout) console.log(stdout.trim());
        if (stderr) console.log(`[stderr] ${stderr.trim()}`);
        if (err) return reject(err);
        resolve();
    });
});

async function main() {
    try {
        console.log('Checking local git status...');
        const hasChanges = await new Promise((resolve) => {
            exec('git status --porcelain', (err, stdout) => {
                resolve(!!(stdout && stdout.trim()));
            });
        });

        if (hasChanges) {
            console.log('Local changes detected. Committing and pushing...');
            await runLocalCmd('git add .');
            await runLocalCmd('git commit -m "Auto-deploy from CRM Panel"');
        } else {
            console.log('No local changes to commit.');
        }

        console.log('Pushing latest code to GitHub...');
        await runLocalCmd('git push origin main');
        console.log('✅ Code successfully pushed to GitHub!');

        const sshHost = '212.38.94.6';
        const sshPort = 22;
        const sshUser = 'root';
        const sshPassword = 'Santyguru11#';
        const deployPath = '/root/solar-crm';
        const restartCmd = 'pm2 restart solar-crm';

        console.log(`Connecting to remote server: ${sshHost}:${sshPort} as ${sshUser}...`);
        const conn = new Client();
        
        conn.on('ready', () => {
            console.log('🔒 SSH connection established successfully.');
            const commands = [];
            if (deployPath) {
                commands.push(`cd "${deployPath}"`);
            }
            commands.push('git pull origin main');
            commands.push('npm install --production');
            commands.push(restartCmd);

            const fullCmd = commands.join(' && ');
            console.log(`Running remote update pipeline: ${fullCmd}`);

            conn.exec(fullCmd, (err, stream) => {
                if (err) {
                    console.error(`❌ SSH Execution Error: ${err.message}`);
                    conn.end();
                    return;
                }

                stream.on('close', (code, signal) => {
                    console.log(`Remote pipeline exited with code: ${code}`);
                    conn.end();
                    if (code === 0) {
                        console.log('🎉 Live server updated and restarted successfully!');
                        console.log('🚀 DEPLOYMENT SUCCESSFUL!');
                    } else {
                        console.log('❌ Live server update failed (Remote command exited with non-zero code).');
                    }
                }).on('data', (data) => {
                    console.log(`[remote] ${data.toString().trim()}`);
                }).stderr.on('data', (data) => {
                    console.log(`[remote stderr] ${data.toString().trim()}`);
                });
            });
        }).on('error', (err) => {
            console.error(`❌ SSH Connection Error: ${err.message}`);
        });

        conn.connect({
            host: sshHost,
            port: sshPort,
            username: sshUser,
            password: sshPassword
        });

    } catch (e) {
        console.error(`❌ Deployment failed: ${e.message}`);
    }
}

main();
