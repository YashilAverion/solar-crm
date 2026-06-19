const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'solar_crm.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM stc_master WHERE type = 'Battery' AND state = 'WA' LIMIT 5", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("=== stc_master (Battery, WA) ===");
        console.log(rows);
    }
    db.close();
});
