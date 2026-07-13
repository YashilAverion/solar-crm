const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    const command = `node -e "
const sqlite3 = require('/root/solar-crm/node_modules/sqlite3').verbose();
const db = new sqlite3.Database('/root/solar-crm/database/solar_v2.db');
db.get('SELECT engineering_details FROM leads WHERE id = 44', (err, row) => {
    if (err) { console.error(err); return; }
    console.log('=== engineering_details ===');
    console.log(row.engineering_details);
    db.close();
});
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
