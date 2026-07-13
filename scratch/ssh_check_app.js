const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check directory structure, git branch, and search for style comments in australian-timezones.js on the server
    const command = `
        echo "=== PM2 STATUS ==="
        pm2 status
        echo "=== PM2 SHOW solar-crm ==="
        pm2 show solar-crm
        echo "=== GIT DIRECTORY ==="
        pwd
        echo "=== CHECK FILE CONTENTS ==="
        grep -n "Sub-menu Tree Connectors" /root/solar-crm/public/australian-timezones.js
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
