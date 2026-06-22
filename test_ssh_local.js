const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Connection Successful!');
    
    // Select margin_master_v2 rows from remote database
    conn.exec("cd /root/solar-crm && node -e \"const sqlite3 = require('sqlite3').verbose(); const db = new sqlite3.Database('./database/solar_v2.db'); db.all('SELECT * FROM margin_master_v2', [], (err, rows) => { if (err) console.error(err); else console.log(JSON.stringify(rows, null, 2)); });\"", (err, stream) => {
        if (err) {
            console.error('Execution error:', err);
            conn.end();
            return;
        }
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT:\n', data.toString());
        }).stderr.on('data', (data) => {
            console.log('STDERR:', data.toString());
        });
    });
}).on('error', (err) => {
    console.error('Connection error:', err);
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#'
});
