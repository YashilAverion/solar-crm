const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/solar_v2.db');

db.all("SELECT id, project_number, first_name, last_name, system_size FROM leads ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    if (err) {
        console.error('Error fetching leads:', err);
    } else {
        console.log('Last 5 Leads:');
        console.log(rows);
    }
    db.close();
});
