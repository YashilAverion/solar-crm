const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

const FIELDS = ['comp_type', 'comp_name', 'comp_trading', 'comp_abn', 'comp_acn', 'comp_website',
    'comp_first_name', 'comp_last_name', 'comp_email_1', 'comp_email_2', 'comp_phone',
    'comp_google_address', 'comp_unit_number', 'comp_lot_number', 'comp_street_type',
    'comp_address', 'comp_suburb', 'comp_state', 'comp_postcode'];

router.get('/', requireAuth, (req, res) => {
    try {
        db.all("SELECT * FROM companies WHERE status IS NULL OR status != 'Deleted'", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    } catch (err) {
        console.error("Error fetching companies:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.post('/', requireAuth, (req, res) => {
    if (!req.body.comp_name || !req.body.comp_name.trim()) {
        return res.status(400).json({ error: 'Company name is required.' });
    }
    if (!req.body.comp_type || !req.body.comp_type.trim()) {
        return res.status(400).json({ error: 'Company type is required.' });
    }

    const values = FIELDS.map(f => req.body[f] || '');
    const sql = `INSERT INTO companies (${FIELDS.join(',')}) VALUES (${FIELDS.map(() => '?').join(',')})`;
    db.run(sql, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const newId = this.lastID;
        const user = getCurrentUser(req);
        db.run("INSERT INTO companies_history (company_id, user_name, action, details) VALUES (?, ?, 'Created', 'Company added to database.')", [newId, user]);
        res.json({ id: newId, success: true });
    });
});

router.put('/:id', requireAuth, (req, res) => {
    db.get("SELECT * FROM companies WHERE id=?", [req.params.id], (err, oldRecord) => {
        if (err || !oldRecord) return res.status(404).json({ error: 'Company not found' });

        const values = FIELDS.map(f => req.body[f] || '');
        const setClause = FIELDS.map(f => `${f}=?`).join(',');
        const sql = `UPDATE companies SET ${setClause} WHERE id=?`;

        db.run(sql, [...values, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const changes = [];
            FIELDS.forEach(f => {
                const oldVal = oldRecord[f] || '';
                const newVal = req.body[f] || '';
                if (oldVal !== newVal) {
                    const label = f.replace('comp_', '').replace(/_/g, ' ').toUpperCase();
                    changes.push(`${label}: "${oldVal}" -> "${newVal}"`);
                }
            });
            if (changes.length > 0) {
                const user = getCurrentUser(req);
                db.run("INSERT INTO companies_history (company_id, user_name, action, details) VALUES (?, ?, 'Updated', ?)",
                    [req.params.id, user, changes.join('  |  ')]);
            }
            res.json({ success: true });
        });
    });
});

router.delete('/:id', requireManager, (req, res) => {
    const user = getCurrentUser(req);
    db.run("UPDATE companies SET status = 'Deleted' WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("INSERT INTO companies_history (company_id, user_name, action, details) VALUES (?, ?, 'Deleted', 'Company soft-deleted.')", [req.params.id, user]);
        res.json({ success: true });
    });
});

router.post('/bulk-delete', requireManager, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No companies selected' });
    const user = getCurrentUser(req);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare("UPDATE companies SET status = 'Deleted' WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO companies_history (company_id, user_name, action, details) VALUES (?, ?, 'Bulk Deleted', 'Company soft-deleted via bulk action.')");
        let hasError = false;

        ids.forEach(id => {
            stmt.run([id], (err) => { if (err) hasError = true; });
            histStmt.run([id, user], (err) => { if (err) hasError = true; });
        });

        stmt.finalize(() => {
            histStmt.finalize(() => {
                if (hasError) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Database transaction failed.' });
                }
                db.run('COMMIT', (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Database transaction failed.' }); }
                    res.json({ success: true, count: ids.length });
                });
            });
        });
    });
});

router.get('/:id/history', requireAuth, (req, res) => {
    db.all("SELECT * FROM companies_history WHERE company_id=? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

module.exports = router;