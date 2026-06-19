const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/solar_crm.db');

db.get(
    "SELECT id, project_number, phone_number, status, is_deleted FROM leads WHERE project_number = 'AR1000'",
    [],
    (err, row) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('Project Details for AR1000:');
            console.log(row);
        }
        db.close();
    }
);
