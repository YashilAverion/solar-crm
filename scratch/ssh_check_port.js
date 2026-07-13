const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Command to check what process is listening on port 3000 and where its files are
    const command = `
        echo "=== PORT 3000 PROCESS ==="
        netstat -plten | grep 3000 || ss -lptn 'sport = :3000'
        echo "=== PROCESS DETAILS ==="
        ps aux | grep node
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
