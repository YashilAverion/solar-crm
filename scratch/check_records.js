const db = require('../database/db');
db.all('SELECT id, type, company, first_name, last_name, project_number, company_job_reference FROM installations', (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
});
