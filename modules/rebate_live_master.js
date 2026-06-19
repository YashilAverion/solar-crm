const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

router.get('/', requireAuth, (req, res) => {
    try {
        db.all("SELECT * FROM rebate_live_master_v2 WHERE status IS NULL OR status != 'Deleted' ORDER BY id DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    } catch (err) {
        console.error("Error fetching rebates:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.post('/', requireManager, (req, res) => {
    try {
        const { type_of_rebate, property_type, state, zone, live_rate, admin_charges, actual_rate, created_by, created_date } = req.body;
        const currentUser = getCurrentUser(req);
        if (!type_of_rebate) return res.status(400).json({ error: 'Type of rebate is required.' });
        if (!property_type) return res.status(400).json({ error: 'Property type is required.' });
        if (!state) return res.status(400).json({ error: 'State is required.' });
        if (zone !== undefined && isNaN(parseFloat(zone))) return res.status(400).json({ error: 'Zone must be a valid number.' });
        if (live_rate !== undefined && isNaN(parseFloat(live_rate))) return res.status(400).json({ error: 'Live rate must be a valid number.' });
        const sql = `INSERT INTO rebate_live_master_v2 
            (type_of_rebate, property_type, state, zone, live_rate, admin_charges, actual_rate, status, created_by, created_date, last_update_by, last_updated_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, '-', '-')`;
            
        db.run(sql, [type_of_rebate, property_type, state, zone, live_rate, admin_charges, actual_rate, created_by, created_date], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            db.run("INSERT INTO rebate_live_master_history (rebate_id, action, user, date) VALUES (?, 'Added', ?, ?)",
                [newId, currentUser || created_by || 'System', new Date().toLocaleString('en-GB')]);
            res.json({ id: newId, success: true });
        });
    } catch (err) {
        console.error("Error adding rebate:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.put('/:id', requireManager, (req, res) => {
    try {
        const { type_of_rebate, property_type, state, zone, live_rate, admin_charges, actual_rate, status, last_update_by, last_updated_date } = req.body;
        const currentUser = getCurrentUser(req);
        const sql = `UPDATE rebate_live_master_v2 
            SET type_of_rebate=?, property_type=?, state=?, zone=?, live_rate=?, admin_charges=?, actual_rate=?, status=?, last_update_by=?, last_updated_date=? 
            WHERE id=?`;
            
        db.run(sql, [type_of_rebate, property_type, state, zone, live_rate, admin_charges, actual_rate, status || 'Active', last_update_by, last_updated_date, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO rebate_live_master_history (rebate_id, action, user, date) VALUES (?, 'Edited', ?, ?)",
                [req.params.id, currentUser || last_update_by || 'System', new Date().toLocaleString('en-GB')]);
            res.json({ success: true });
        });
    } catch (err) {
        console.error("Error updating rebate:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.delete('/:id', requireManager, (req, res) => {
    try {
        const currentUser = getCurrentUser(req);
        db.run("DELETE FROM rebate_live_master_v2 WHERE id=?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO rebate_live_master_history (rebate_id, action, user, date) VALUES (?, 'Deleted', ?, ?)",
                [req.params.id, currentUser, new Date().toLocaleString('en-GB')]);
            res.json({ success: true });
        });
    } catch (err) {
        console.error("Error deleting rebate:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.post('/bulk-delete', requireManager, (req, res) => {
    try {
        const { ids } = req.body;
        const currentUser = getCurrentUser(req);
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No records selected" });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("DELETE FROM rebate_live_master_v2 WHERE id = ?");
            const histStmt = db.prepare("INSERT INTO rebate_live_master_history (rebate_id, action, user, date) VALUES (?, 'Bulk Deleted', ?, ?)");
            const dateStr = new Date().toLocaleString('en-GB');
            const userStr = currentUser || 'System';

            ids.forEach(id => {
                stmt.run([id]);
                histStmt.run([id, userStr, dateStr]);
            });

            stmt.finalize();
            histStmt.finalize();

            db.run("COMMIT", (err) => {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: 'Database transaction failed.' }); }
                res.json({ success: true, count: ids.length });
            });
        });
    } catch (err) {
        console.error("Error in bulk delete:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.get('/:id/history', requireAuth, (req, res) => {
    try {
        db.all("SELECT * FROM rebate_live_master_history WHERE rebate_id=? ORDER BY id DESC", [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    } catch (err) {
        console.error("Error fetching rebate history:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;
