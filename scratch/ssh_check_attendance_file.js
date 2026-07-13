const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check attendance.html size, permissions, and check if it contains any merge conflict indicators
    const command = `
        echo "=== FILE DETAILS ==="
        ls -la /root/solar-crm/public/attendance.html
        echo "=== MERGE CONFLICTS ==="
        grep -n "<<<<<<<" /root/solar-crm/public/attendance.html || echo "No merge conflicts"
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
