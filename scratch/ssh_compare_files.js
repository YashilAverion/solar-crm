const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check file md5 on disk vs over http locally on the server
    const command = `
        echo "=== MD5 ON DISK ==="
        md5sum /root/solar-crm/public/australian-timezones.js
        echo "=== MD5 OVER HTTP (PORT 3000) ==="
        curl -s http://127.0.0.1:3000/australian-timezones.js | md5sum
        echo "=== CHECK IF PORT 3000 HAS CONNECTOR CODE ==="
        curl -s http://127.0.0.1:3000/australian-timezones.js | grep -n "Sub-menu Tree Connectors"
    `;

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
