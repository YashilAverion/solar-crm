const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check the start and end of curl output vs the disk file
    const command = `
        echo "=== DISK FILE START ==="
        head -n 20 /root/solar-crm/public/australian-timezones.js
        echo "=== CURL OUTPUT START ==="
        curl -s http://127.0.0.1:3000/australian-timezones.js | head -n 20
        echo "=== DISK FILE END ==="
        tail -n 20 /root/solar-crm/public/australian-timezones.js
        echo "=== CURL OUTPUT END ==="
        curl -s http://127.0.0.1:3000/australian-timezones.js | tail -n 20
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
