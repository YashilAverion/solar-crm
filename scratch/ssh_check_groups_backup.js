const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    const command = `node -e "
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('/root/solar-crm/node_modules/sqlite3').verbose();

const tempDir = '/tmp/db_restore_check_groups';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const zipPath = '/root/solar-crm/SYSTEM_BACKUPS/solar_crm_backup_2026-07-03-13-30-00.zip';
const tempDbPath = path.join(tempDir, 'database/solar_v2.db');

execSync('rm -rf ' + tempDir + '/*');
execSync('unzip -q ' + zipPath + ' database/solar_v2.db -d ' + tempDir);

if (fs.existsSync(tempDbPath)) {
    const db = new sqlite3.Database(tempDbPath);
    db.all('SELECT * FROM combo_groups', (err, groups) => {
        if (err) {
            console.error(err);
        } else {
            console.log('=== combo_groups in 13:30 backup ===');
            console.log(JSON.stringify(groups, null, 2));
        }
        db.close();
    });
} else {
    console.log('DB not found in 13:30 backup');
}
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
