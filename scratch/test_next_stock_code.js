const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/solar_crm.db');

const sql = `
    SELECT stock_code FROM combo_variants 
    UNION 
    SELECT stock_code FROM products WHERE stock_code LIKE 'CBO-%'
`;
db.all(sql, [], (err, rows) => {
    if (err) {
        console.error('Error running query:', err.message);
        db.close();
        return;
    }
    console.log('Returned rows:', rows);
    let maxNum = 1000;
    rows.forEach(r => {
        const code = r.stock_code;
        if (code && code.startsWith('CBO-')) {
            const numPart = code.substring(4);
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    });
    console.log(`maxNum found: ${maxNum}, nextCode generated: CBO-${maxNum + 1}`);
    db.close();
});
