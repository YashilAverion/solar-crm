const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database', 'solar_v2.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to local database:', err.message);
        return;
    }
    console.log('Connected to local database:', dbPath);
    
    db.all("SELECT id, username, email, full_name, role, status FROM users", [], (err, rows) => {
        if (err) {
            console.error('Query error:', err.message);
        } else {
            console.log('=== LOCAL USERS ===');
            console.log(rows);
        }
        db.close();
    });
});
