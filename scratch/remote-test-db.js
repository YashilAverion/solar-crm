const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

try {
    const dbDir = '/root/solar-crm/database';
    const mainDb = path.join(dbDir, 'solar_v2.db');
    const testDb = path.join(dbDir, 'solar_v2_test.db');
    
    console.log('Copying solar_v2.db to solar_v2_test.db...');
    if (fs.existsSync(testDb)) {
        fs.unlinkSync(testDb);
    }
    fs.copyFileSync(mainDb, testDb);
    console.log('Copy complete. Attempting to open solar_v2_test.db...');
    
    const db = new sqlite3.Database(testDb, (err) => {
        if (err) {
            console.error('Error opening test DB:', err.message);
            process.exit(1);
        }
        
        console.log('Opened test DB successfully. Running test query...');
        db.get("SELECT COUNT(*) as count FROM users", [], (queryErr, row) => {
            if (queryErr) {
                console.error('Query failed. Database is CORRUPTED:', queryErr.message);
                if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
                process.exit(2);
            }
            console.log('Query succeeded! Total users:', row.count);
            console.log('STATUS: HEALTHY. The main DB file is NOT corrupted. The WAL file was corrupt.');
            if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
            process.exit(0);
        });
    });
} catch (e) {
    console.error('Error during execution:', e.message);
    process.exit(3);
}
