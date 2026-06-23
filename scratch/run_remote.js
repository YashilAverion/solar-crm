const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    // Command to execute on remote server
    const cmd = process.argv[2] || 'pm2 status';
    console.log(`Running remote command: "${cmd}"`);
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Execution Error:', err);
            conn.end();
            process.exit(1);
        }
        stream.on('close', (code, signal) => {
            conn.end();
            process.exit(code);
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('Connection Error:', err);
    process.exit(1);
});

conn.connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#'
});
