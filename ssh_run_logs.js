const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established successfully to Live VPS.');
  conn.exec('echo "=== STDERR LOGS ===" && tail -n 100 /root/.pm2/logs/solar-crm-error.log && echo "=== STDOUT LOGS ===" && tail -n 100 /root/.pm2/logs/solar-crm-out.log', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`Command closed with code ${code}`);
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '212.38.94.6',
  port: 22,
  username: 'root',
  password: 'Santyguru11#'
});
