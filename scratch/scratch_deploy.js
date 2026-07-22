const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established successfully to Live VPS.');
  
  const cmd = 'cd /root/solar-crm && git fetch && git reset --hard origin/main && npm install --omit=dev && pm2 restart solar-crm';
  console.log(`Executing remote command: ${cmd}`);
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
        console.error('Error executing SSH command:', err);
        conn.end();
        return;
    }
    stream.on('close', (code, signal) => {
      console.log(`Remote command closed with code ${code}`);
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data.toString());
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect({
  host: '212.38.94.6',
  port: 22,
  username: 'root',
  password: 'Santyguru11#'
});
