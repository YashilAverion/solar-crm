const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

// GET all STC records
router.get('/', requireAuth, (req, res) => {
    try {
        db.all("SELECT * FROM stc_master ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    } catch (err) {
        console.error("Error fetching STC records:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// POST a new STC record
router.post('/', requireManager, (req, res) => {
    try {
        const { type, postcode, state, zone, ratings, deeming_period } = req.body;
        const currentUser = getCurrentUser(req);
        if (!type) return res.status(400).json({ error: 'Type is required.' });
        if (!postcode || isNaN(parseInt(postcode))) return res.status(400).json({ error: 'Valid postcode is required.' });
        if (!state) return res.status(400).json({ error: 'State is required.' });
        if (zone !== undefined && isNaN(parseFloat(zone))) return res.status(400).json({ error: 'Zone must be a valid number.' });
        if (ratings !== undefined && isNaN(parseFloat(ratings))) return res.status(400).json({ error: 'Ratings must be a valid number.' });
        const sql = `INSERT INTO stc_master (type, postcode, state, zone, ratings, deeming_period, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [type, postcode, state, zone, ratings, deeming_period, currentUser || 'System'], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            db.run("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, 'Added', ?, ?)", [newId, currentUser || 'System', new Date().toLocaleString('en-GB')]);
            res.json({ id: newId, success: true });
        });
    } catch (err) {
        console.error("Error adding STC record:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// PUT (update) an STC record
router.put('/:id', requireManager, (req, res) => {
    try {
        const { type, postcode, state, zone, ratings, deeming_period } = req.body;
        const currentUser = getCurrentUser(req);
        const sql = `UPDATE stc_master SET type=?, postcode=?, state=?, zone=?, ratings=?, deeming_period=? WHERE id=?`;
        db.run(sql, [type, postcode, state, zone, ratings, deeming_period, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, 'Edited', ?, ?)", [req.params.id, currentUser || 'System', new Date().toLocaleString('en-GB')]);
            res.json({ success: true });
        });
    } catch (err) {
        console.error("Error updating STC record:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// DELETE all STC records
router.delete('/all', requireManager, (req, res) => {
    try {
        const currentUser = getCurrentUser(req);
        db.serialize(() => {
            db.run("DELETE FROM stc_master", [], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.run("DELETE FROM sqlite_sequence WHERE name='stc_master'", [], () => {
                    db.run("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, ?, ?, ?)",
                        [-1, 'Cleared All Data', currentUser, new Date().toLocaleString('en-GB')],
                        (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ success: true });
                        }
                    );
                });
            });
        });
    } catch (err) {
        console.error("Error clearing STC records:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// DELETE an STC record
router.delete('/:id', requireManager, (req, res) => {
    try {
        const currentUser = getCurrentUser(req);
        db.run("DELETE FROM stc_master WHERE id=?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, 'Deleted', ?, ?)",
                [req.params.id, currentUser, new Date().toLocaleString('en-GB')]);
            res.json({ success: true });
        });
    } catch (err) {
        console.error("Error deleting STC record:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// 🔥 NEW: BULK DELETE STC RECORDS 🔥
router.post('/bulk-delete', requireManager, (req, res) => {
    try {
        const { ids } = req.body;
        const currentUser = getCurrentUser(req);
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No records selected" });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("DELETE FROM stc_master WHERE id = ?");
            const histStmt = db.prepare("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, 'Bulk Deleted', ?, ?)");
            const dateStr = new Date().toLocaleString('en-GB');
            const userStr = currentUser || 'System';
            let hasError = false;

            ids.forEach(id => {
                stmt.run([id], (err) => { if (err) hasError = true; });
                histStmt.run([id, userStr, dateStr], (err) => { if (err) hasError = true; });
            });

            stmt.finalize(() => {
                histStmt.finalize(() => {
                    if (hasError) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Database transaction failed.' });
                    }
                    db.run("COMMIT", (err) => {
                        if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: 'Database transaction failed.' }); }
                        res.json({ success: true, count: ids.length });
                    });
                });
            });
        });
    } catch (err) {
        console.error("Error in bulk delete:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// POST bulk upload from Excel
router.post('/bulk-upload', (req, res) => {
    try {
        const records = req.body.records;
        const currentUser = req.body.currentUser || 'System';
        if (!records || !Array.isArray(records)) return res.status(400).json({ error: 'Invalid data format.' });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare(`INSERT INTO stc_master (type, postcode, state, zone, ratings, deeming_period, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            let hasError = false;

            records.forEach(rec => {
                stmt.run([rec.type, rec.postcode, rec.state, rec.zone, rec.ratings, rec.deeming_period, currentUser], function(err) {
                    if (err) hasError = true;
                });
            });
            
            stmt.finalize((err) => {
                if (err) hasError = true;
                if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Error inserting one or more records. Transaction rolled back.' });
                }
                db.run("COMMIT", (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                    db.run("INSERT INTO stc_master_history (stc_id, action, user, date) VALUES (?, ?, ?, ?)", [-1, `Bulk uploaded ${records.length} records`, currentUser, new Date().toLocaleString('en-GB')]);
                    res.json({ success: true, count: records.length });
                });
            });
        });
    } catch (err) {
        console.error("Error in bulk upload:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// GET history for an STC record
router.get('/:id/history', requireAuth, (req, res) => {
    try {
        db.all("SELECT * FROM stc_master_history WHERE stc_id=? ORDER BY id DESC", [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    } catch (err) {
        console.error("Error fetching STC history:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;