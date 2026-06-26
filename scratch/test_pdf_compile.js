const db = require('../database/db');
const http = require('http');
const fs = require('fs');
const path = require('path');

setTimeout(() => {
    db.get("SELECT id FROM leads ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err || !row) {
            console.error("Failed to fetch latest lead:", err || "No leads found");
            db.close();
            process.exit(1);
        }

        const leadId = row.id;
        console.log(`Generating PDF for Lead ID: ${leadId}...`);
        
        const PORT = process.env.PORT || 3000;
        const url = `http://localhost:${PORT}/api/quotations/${leadId}/download-pdf`;
        
        console.log(`Fetching from: ${url}`);
        
        const options = {
            headers: {
                'x-pdf-render-secret': process.env.SESSION_SECRET || 'solar-crm-change-this-secret-key-in-production-2024'
            }
        };

        http.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Failed to generate PDF. Status: ${res.statusCode}`);
                res.resume();
                db.close();
                process.exit(1);
            }
            
            const destPath = path.join(__dirname, 'test_quotation.pdf');
            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`SUCCESS! Saved compiled PDF to: ${destPath}`);
                db.close();
                process.exit(0);
            });
        }).on('error', (err) => {
            console.error("HTTP error:", err.message);
            db.close();
            process.exit(1);
        });
    });
}, 1000);
