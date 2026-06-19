// ============================================================
//  create-admin.js  —  To create the first Admin User
//  LOCATION: Keep in the project ROOT (with server.js)
//
//  RUN ONLY ONCE:
//  Type in terminal:  node create-admin.js
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Correctly resolve the database path to match the main application (db.js)
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'solar_crm.db');
const db = new sqlite3.Database(dbPath);

// First create the users table (if it doesn't exist)
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            can_edit TEXT DEFAULT 'No',
            can_delete TEXT DEFAULT 'No',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) { 
            console.error('Table create error:', err.message); 
            return db.close(() => process.exit(1)); 
        }

        // Check if admin already exists
        db.get("SELECT id FROM users WHERE username = 'admin'", [], (err, row) => {
            if (err) {
                console.error('Database query error:', err.message);
                return db.close(() => process.exit(1));
            }

            if (row) {
                console.log('✅ Admin user already exists!');
                console.log('👤 Username: admin');
                console.log('🔑 Password: admin123');
                return db.close(() => process.exit(0));
            }

            bcrypt.hash('admin123', 10, (hashErr, hashedPassword) => {
                if (hashErr) { 
                    console.error('❌ Hash error:', hashErr.message); 
                    return db.close(() => process.exit(1)); 
                }

                db.run(`
                    INSERT INTO users (username, password, full_name, role, can_edit, can_delete, status)
                    VALUES ('admin', ?, 'Admin User', 'Manager', 'Yes', 'Yes', 'Active')
                `, [hashedPassword], function(err) {
                    if (err) {
                        console.error('❌ Error:', err.message);
                        db.close(() => process.exit(1));
                    } else {
                        console.log('🎉 Admin user successfully created!');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('👤 Username : admin');
                        console.log('🔑 Password : admin123');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('Now run node server.js and log in!');
                        db.close(() => process.exit(0));
                    }
                });
            });
        });
    });
});