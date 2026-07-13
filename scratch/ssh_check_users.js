const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check users in the SQLite database on the live server using node inside the app dir
    const command = `cd /root/solar-crm && node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('/root/solar-crm/database/solar_v2.db'); db.all('SELECT id, username, email, full_name, role, status FROM users', [], (err, rows) => console.log(rows))"`;

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
