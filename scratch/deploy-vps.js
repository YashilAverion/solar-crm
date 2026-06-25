const { Client } = require('ssh2');

console.log('Initiating SSH deployment connection to srv1773488.hstgr.cloud (212.38.94.6)...');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Connection successfully established.');
    
    const cmd = 'cd /root/solar-crm && git pull origin main && npm install --production && pm2 restart solar-crm && pm2 status';
    console.log(`Executing remote command: ${cmd}`);
    
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Remote execution failed:', err);
            conn.end();
            process.exit(1);
        }
        
        stream.on('close', (code, signal) => {
            console.log(`Remote process completed with exit code: ${code}`);
            conn.end();
            process.exit(code === 0 ? 0 : 1);
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
