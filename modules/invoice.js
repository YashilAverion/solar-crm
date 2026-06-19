const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/:id', (req, res) => {
    const installId = req.params.id;

    // 1. Fetch the core installation record
    db.get("SELECT * FROM installations WHERE id = ?", [installId], (err, installation) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!installation) return res.status(404).json({ success: false, error: 'Installation not found' });

        // --- Auto-generate and lock Invoice Number, Date, and Due Date if missing ---
        let invNum = installation.invoice_number;
        let invDate = installation.invoice_date;
        let dueDate = installation.due_date;
        let needsUpdate = false;

        if (!invNum || invNum.trim() === '') {
            invNum = `INV-${installation.project_number || installId}`;
            installation.invoice_number = invNum;
            needsUpdate = true;
        }
        if (!invDate || invDate.trim() === '') {
            const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
            invDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            installation.invoice_date = invDate;
            needsUpdate = true;
        }
        if (!dueDate || dueDate.trim() === '') {
            const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
            now.setDate(now.getDate() + 7); // Default due date is 7 days after issue
            dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            installation.due_date = dueDate;
            needsUpdate = true;
        }

        if (needsUpdate) {
            db.run(`UPDATE installations SET invoice_number = ?, invoice_date = ?, due_date = ? WHERE id = ?`, [invNum, invDate, dueDate, installId], (updateErr) => {
                if (updateErr) console.error("Auto-Invoice Update Error:", updateErr.message);
            });
        }

        // 2. Safely attempt to attach formal company billing details if a company name is mapped
        db.get("SELECT * FROM companies WHERE LOWER(TRIM(comp_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(comp_trading)) = LOWER(TRIM(?)) LIMIT 1", 
        [installation.company, installation.company], (err, company) => {
            
            if (company) {
                installation.comp_name = company.comp_name;
                installation.comp_trading = company.comp_trading;
                installation.comp_abn = company.comp_abn;
                installation.comp_address = company.comp_address;
                installation.comp_suburb = company.comp_suburb;
                installation.comp_state = company.comp_state;
                installation.comp_postcode = company.comp_postcode;
            }

            // 3. Fetch all saved charges/line items associated with this installation
            db.all("SELECT * FROM installation_saved_charges WHERE installation_id = ?", [installId], (err, charges) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                // Send everything mapped strictly to the frontend's expectations
                res.json({ success: true, installation: installation, charges: charges || [] });
            });
        });
    });
});

module.exports = router;