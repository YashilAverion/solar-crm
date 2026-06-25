const db = require('../database/db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
        console.error('Error querying SQLite tables:', err.message);
        process.exit(1);
    }
    
    console.log('Tables found in database:');
    const tableNames = rows.map(r => r.name);
    console.log(tableNames.join(', '));

    if (tableNames.includes('configurations')) {
        console.log('SUCCESS: configurations table exists!');
        
        // Test query the schema
        db.all("PRAGMA table_info(configurations)", [], (err, info) => {
            if (err) {
                console.error('Error pragming configurations:', err.message);
                process.exit(1);
            }
            console.log('configurations columns:', info.map(c => `${c.name} (${c.type})`).join(', '));
            db.close();
            process.exit(0);
        });
    } else {
        console.error('ERROR: configurations table does not exist!');
        db.close();
        process.exit(1);
    }
});
