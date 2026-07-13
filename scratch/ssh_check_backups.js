const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Sequentially check backups using async/await
    const command = `node -e "
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('/root/solar-crm/node_modules/sqlite3').verbose();

const backupDir = '/root/solar-crm/SYSTEM_BACKUPS';
const tempDir = '/tmp/db_restore_check';

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const backups = [
    'solar_crm_backup_2026-07-03-07-30-00.zip',
    'solar_crm_backup_2026-07-03-09-30-00.zip',
    'solar_crm_backup_2026-07-03-11-30-00.zip',
    'solar_crm_backup_2026-07-03-13-30-00.zip'
];

async function checkBackups() {
    for (const zipFile of backups) {
        const zipPath = path.join(backupDir, zipFile);
        if (!fs.existsSync(zipPath)) {
            console.log('Backup file does not exist:', zipFile);
            continue;
        }
        
        console.log('Checking backup:', zipFile);
        try {
            const tempDbPath = path.join(tempDir, 'database/solar_v2.db');
            execSync('rm -rf ' + tempDir + '/*');
            execSync('unzip -q ' + zipPath + ' database/solar_v2.db -d ' + tempDir);
            
            if (fs.existsSync(tempDbPath)) {
                await new Promise((resolve, reject) => {
                    const db = new sqlite3.Database(tempDbPath);
                    db.all('SELECT * FROM combo_variants', (err, rows) => {
                        if (err) {
                            console.error('Error querying backup ' + zipFile + ':', err);
                            db.close();
                            resolve();
                        } else {
                            console.log('Total ' + rows.length + ' variants in ' + zipFile + ':');
                            rows.forEach(r => {
                                console.log('  - [' + r.combo_group_id + '] ' + r.variant_name + ' (Code: ' + r.stock_code + ', Price: ' + r.purchase_price + ', Status: ' + r.status + ')');
                            });
                            db.close(resolve);
                        }
                    });
                });
            } else {
                console.log('Could not extract database/solar_v2.db from ' + zipFile);
            }
        } catch (e) {
            console.error('Error processing ' + zipFile + ':', e.message);
        }
    }
    console.log('=== Finished check ===');
}

checkBackups();
"`;

    conn.exec(command, (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code);
            console.log(data);
            conn.end();
        }).on('data', (chunk) => {
            data += chunk;
        }).stderr.on('data', (data) => {
            console.error('STDERR: ' + data);
        });
    });
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#'
});
