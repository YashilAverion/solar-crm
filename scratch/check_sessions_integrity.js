const sqlite3 = require('sqlite3').verbose();
const dbPath = '/root/solar-crm/database/solar_sessions.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening sessions DB:', err.message);
        process.exit(1);
    }
    
    console.log('Running PRAGMA integrity_check on sessions DB...');
    db.all("PRAGMA integrity_check", [], (queryErr, rows) => {
        if (queryErr) {
            console.error('Integrity check failed:', queryErr.message);
            process.exit(2);
        }
        console.log('Result:', rows);
        db.close();
    });
});
