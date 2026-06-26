const db = require('../database/db');

// Wait 1 second for db initialization queries to complete
setTimeout(() => {
    console.log("=== Postcode Yield Factors ===");
    db.all("SELECT * FROM postcode_yield_factors", [], (err, rows) => {
        if (err) {
            console.error("Error querying postcode_yield_factors:", err);
        } else {
            console.log(`Found ${rows.length} rows:`);
            console.log(rows);
        }
    });

    console.log("\n=== Utility Rate Assumptions ===");
    db.all("SELECT * FROM utility_rate_assumptions", [], (err, rows) => {
        if (err) {
            console.error("Error querying utility_rate_assumptions:", err);
        } else {
            console.log(`Found ${rows.length} rows:`);
            console.log(rows);
        }
    });

    console.log("\n=== Indexes ===");
    db.all("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND (tbl_name='postcode_yield_factors' OR tbl_name='utility_rate_assumptions')", [], (err, rows) => {
        if (err) {
            console.error("Error querying indexes:", err);
        } else {
            console.log("Found indexes:");
            console.log(rows);
        }
        db.close();
    });
}, 1000);
