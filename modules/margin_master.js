const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

router.get('/', requireAuth, (req, res) => {
    db.all("SELECT * FROM margin_master_v2 ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({
            ...r,
            margins: (() => {
                try { return r.margins ? JSON.parse(r.margins) : []; } 
                catch (e) { return []; }
            })()
        }));
        res.json(formatted);
    });
});

router.post('/', requireManager, (req, res) => {
    const { margin_type, state, area, margins, created_by, created_date } = req.body;
    const currentUser = getCurrentUser(req);
    if (!margin_type) return res.status(400).json({ error: 'Margin type is required.' });
    if (!state) return res.status(400).json({ error: 'State is required.' });
    if (!area) return res.status(400).json({ error: 'Area is required.' });
    const sql = `INSERT INTO margin_master_v2 (margin_type, state, area, margins, created_by, created_date, last_update_by, last_updated_date) VALUES (?, ?, ?, ?, ?, ?, '-', '-')`;
    db.run(sql, [margin_type, state, area, JSON.stringify(margins || []), created_by, created_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const newId = this.lastID;
        db.run("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, 'Added', ?, ?)",
            [newId, currentUser || created_by || 'System', new Date().toLocaleString('en-GB')]);
        res.json({ id: newId, success: true });
    });
});

router.put('/:id', requireManager, (req, res) => {
    const { margin_type, state, area, margins, last_update_by, last_updated_date } = req.body;
    const currentUser = getCurrentUser(req);
    const sql = `UPDATE margin_master_v2 SET margin_type=?, state=?, area=?, margins=?, last_update_by=?, last_updated_date=? WHERE id=?`;
    db.run(sql, [margin_type, state, area, JSON.stringify(margins || []), last_update_by, last_updated_date, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, 'Edited', ?, ?)",
            [req.params.id, currentUser || last_update_by || 'System', new Date().toLocaleString('en-GB')]);
        res.json({ success: true });
    });
});

router.delete('/all', requireManager, (req, res) => {
    try {
        const currentUser = req.body.currentUser || req.query.currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
        db.serialize(() => {
            db.run("DELETE FROM margin_master_v2", [], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.run("DELETE FROM sqlite_sequence WHERE name='margin_master_v2'", [], () => {
                    db.run("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, ?, ?, ?)",
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
        console.error("Error clearing margin records:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.delete('/:id', requireManager, (req, res) => {
    try {
        const currentUser = getCurrentUser(req);
        db.run("DELETE FROM margin_master_v2 WHERE id=?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, 'Deleted', ?, ?)",
                [req.params.id, currentUser, new Date().toLocaleString('en-GB')]);
            res.json({ success: true });
        });
    } catch (err) {
        console.error("Error deleting margin record:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.post('/bulk-delete', requireManager, (req, res) => {
    const { ids } = req.body;
    const currentUser = getCurrentUser(req);
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No records selected" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("DELETE FROM margin_master_v2 WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, 'Bulk Deleted', ?, ?)");
        const dateStr = new Date().toLocaleString('en-GB');
        const userStr = currentUser || 'System';

        ids.forEach(id => {
            stmt.run([id]);
            histStmt.run([id, userStr, dateStr]);
        });

        stmt.finalize();
        histStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Database transaction failed.' });
            }
            res.json({ success: true });
        });
    });
});

router.post('/bulk-upload', (req, res) => {
    const records = req.body.records;
    const currentUser = req.body.currentUser || 'System';
    if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Invalid data format.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`INSERT INTO margin_master_v2 (margin_type, state, area, margins, created_by, created_date, last_update_by, last_updated_date) VALUES (?, ?, ?, ?, ?, ?, '-', '-')`);
        records.forEach(rec => {
            stmt.run(rec.margin_type, rec.state, rec.area, JSON.stringify(rec.margins || []), rec.created_by, rec.created_date);
        });
        stmt.finalize((err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.run("INSERT INTO margin_master_history (margin_id, action, user, date) VALUES (?, ?, ?, ?)",
                    [-1, `Bulk uploaded ${records.length} records`, currentUser, new Date().toLocaleString('en-GB')]);
                res.json({ success: true, count: records.length });
            });
        });
    });
});

router.get('/:id/history', requireAuth, (req, res) => {
    db.all("SELECT * FROM margin_master_history WHERE margin_id=? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
