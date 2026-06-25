const { Client } = require('ssh2');

console.log('Connecting to srv1773488.hstgr.cloud (212.38.94.6) to fetch logs...');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Connection established.');
    
    const cmd = 'tail -n 50 /root/.pm2/logs/solar-crm-error.log';
    console.log(`Executing remote command: ${cmd}`);
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Remote execution failed:', err);
            conn.end();
            process.exit(1);
        }
        
        let output = '';
        stream.on('close', (code, signal) => {
            console.log(`Remote process completed with exit code: ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).on('error', (err) => {
    console.error('SSH Connection failed:', err.message);
    process.exit(1);
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#',
    readyTimeout: 20000
});
