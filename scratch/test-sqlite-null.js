const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
    db.run(`
        CREATE TABLE test (
            user_id INTEGER,
            config_key TEXT,
            config_value TEXT,
            UNIQUE(user_id, config_key)
        )
    `);
    db.run("CREATE UNIQUE INDEX idx_test_global ON test(config_key) WHERE user_id IS NULL;");

    // Insert first global setting
    db.run("REPLACE INTO test (user_id, config_key, config_value) VALUES (NULL, 'global_office_ip', '1.1.1.1')");
    
    // Replace it
    db.run("REPLACE INTO test (user_id, config_key, config_value) VALUES (NULL, 'global_office_ip', '2.2.2.2')");

    db.all("SELECT * FROM test", [], (err, rows) => {
        console.log('Rows in test after replace:', rows);
    });
});
