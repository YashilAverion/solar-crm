const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const puppeteer = require('puppeteer');
    const axios = require('axios');
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('/root/solar-crm/database/solar_v2.db');

    (async () => {
      try {
        console.log('1. Fetching lead #44 (AR1013)...');
        const leadRow = await new Promise((res, rej) => db.get('SELECT id, project_number FROM leads WHERE project_number = "AR1013" OR id = 44 LIMIT 1', (err, r) => err ? rej(err) : res(r)));
        console.log('Lead found:', leadRow);

        console.log('2. Launching Puppeteer to generate PDF...');
        const pdfBrowser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
        });
        const pdfPage = await pdfBrowser.newPage();
        await pdfPage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
        await pdfPage.goto('http://localhost:3000/quotation_template.html?id=' + leadRow.id + '&userId=5', { waitUntil: 'networkidle0', timeout: 35000 });
        const pdfBuffer = await pdfPage.pdf({ format: 'A4', printBackground: true });
        await pdfBrowser.close();
        console.log('✅ PDF generated successfully! Buffer length:', pdfBuffer.length);

        console.log('3. Fetching user 5 access token...');
        const userRow = await new Promise((res, rej) => db.get('SELECT outlook_access_token FROM users WHERE id = 5', (err, r) => err ? rej(err) : res(r)));
        
        console.log('4. Calling Microsoft Graph sendMail with Buffer.from(pdfBuffer).toString("base64")...');
        const mailPayload = {
            message: {
                subject: 'Test Solar Quotation — ' + (leadRow.project_number || 'AR1013'),
                body: {
                    contentType: 'HTML',
                    content: 'Dear Customer,<br><br>Please find attached your test solar quotation.<br><br>Warm regards,<br>Ares Energy Team'
                },
                toRecipients: [{ emailAddress: { address: 'yashil@averionglobal.co.in' } }],
                attachments: [{
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: 'Quotation_' + (leadRow.project_number || leadRow.id) + '.pdf',
                    contentType: 'application/pdf',
                    contentBytes: Buffer.from(pdfBuffer).toString('base64')
                }]
            },
            saveToSentItems: "true"
        };

        const sendRes = await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', mailPayload, {
            headers: {
                Authorization: 'Bearer ' + userRow.outlook_access_token,
                'Content-Type': 'application/json'
            }
        });

        console.log('🎉 EMAIL SENT SUCCESSFULLY! Status:', sendRes.status);

      } catch (e) {
        console.error('❌ EMAIL SEND FAILED:', e.response ? e.response.data : e.message);
      }
    })();
  `;
  
  conn.exec(`cd /root/solar-crm && node -r dotenv/config -e "${remoteScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', data => process.stdout.write(data));
    stream.stderr.on('data', data => process.stderr.write(data));
  });
}).connect({
  host: '212.38.94.6',
  port: 22,
  username: 'root',
  password: 'Santyguru11#'
});
