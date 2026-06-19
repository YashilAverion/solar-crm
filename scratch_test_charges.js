const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database', 'solar_crm.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM installation_charge_items", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("=== installation_charge_items ===");
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
