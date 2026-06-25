const db = require('../database/db');

function testDbMigration() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(users)", [], (err, rows) => {
            if (err) return reject(err);
            
            const columns = rows.map(r => r.name);
            const required = ['voipline_sip_username', 'voipline_sip_password', 'voipline_sip_domain', 'voipline_wss_url'];
            
            console.log('[TEST] Users table columns:', columns);
            
            const missing = required.filter(c => !columns.includes(c));
            if (missing.length > 0) {
                console.error('[TEST] FAIL: Missing columns:', missing);
                process.exit(1);
            } else {
                console.log('[TEST] SUCCESS: All WebRTC SIP columns migrated successfully!');
                resolve();
            }
        });
    });
}

async function run() {
    try {
        await testDbMigration();
        process.exit(0);
    } catch (e) {
        console.error('[TEST] ERROR:', e.message);
        process.exit(1);
    }
}

run();
