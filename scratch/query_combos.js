const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database', 'solar_v2.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
        process.exit(1);
    }
    console.log('Connected securely to database: ' + dbPath);
});

db.all("SELECT * FROM combo_groups WHERE status = 'Active'", [], (err, groups) => {
    if (err) {
        console.error('Error querying combo_groups:', err.message);
        return;
    }
    console.log('=== ACTIVE COMBO GROUPS ===');
    console.log(groups);

    db.all("SELECT * FROM combo_variants WHERE status = 'Active'", [], (err, variants) => {
        if (err) {
            console.error('Error querying combo_variants:', err.message);
            return;
        }
        console.log('\n=== ACTIVE COMBO VARIANTS ===');
        console.log(variants);
        db.close();
    });
});
