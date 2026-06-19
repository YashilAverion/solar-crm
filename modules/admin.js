const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcrypt');
const { requireManager, isStrongPassword, getPasswordStrengthMessage } = require('../helpers');

// ── GET ALL USERS ─────────────────────────────────────────────
router.get('/users', requireManager, (req, res) => {
    db.all("SELECT id, username, full_name, email, role, can_edit, can_delete, status FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ── GET USER PERMISSION OVERRIDES ─────────────────────────────
router.get('/users/:id/custom-permissions', requireManager, (req, res) => {
    db.get("SELECT custom_permissions_json FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.custom_permissions_json) return res.json(null); // Return null if no custom perms
        try {
            res.json(JSON.parse(row.custom_permissions_json));
        } catch (e) { res.json(null); } // Return null on parse error
    });
});

// ── CREATE USER ───────────────────────────────────────────────
router.post('/users', requireManager, async (req, res) => {
    try {
        const { username, password, full_name, email, role, can_edit, can_delete, status, custom_permissions } = req.body;

        if (!username || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -.' });
        }
        if (!full_name || full_name.trim().length < 2) {
            return res.status(400).json({ error: 'Full name must be at least 2 characters long.' });
        }
        if (!email || email.trim().length === 0) {
            return res.status(400).json({ error: 'Email ID is required.' });
        }
        const VALID_ROLES = ['Admin', 'Sales Manager', 'Procurement Manager', 'Accounts Manager', 'Installation Manager', 'Admin Manager', 'Service Manager', 'Sales Team Leader', 'Procurement Team Leader', 'Accounts Team Leader', 'Installation Team Leader', 'Admin Team Leader', 'Service Team Leader', 'Sales Executive', 'Procurement Executive', 'Account Executive', 'Installation Executive', 'Admin Executive', 'Service Executive'];
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid Role selected. Please select a valid role from the hierarchy.' });
        }
        if (!password || !isStrongPassword(password)) {
            return res.status(400).json({ error: getPasswordStrengthMessage() });
        }

        // Check duplicate username
        const existing = await new Promise((resolve, reject) =>
            db.get("SELECT id FROM users WHERE username = ?", [username.trim()], (err, row) => err ? reject(err) : resolve(row))
        );
        if (existing) return res.status(400).json({ error: 'This username already exists.' });

        const permsJson = (custom_permissions && Object.keys(custom_permissions).length > 0) ? JSON.stringify(custom_permissions) : null;
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, full_name, email, role, can_edit, can_delete, status, custom_permissions_json) VALUES (?,?,?,?,?,?,?,?,?)`;
        db.run(sql, [username.trim(), hashedPassword, full_name.trim(), email || '', role, can_edit || 'No', can_delete || 'No', status || 'Active', permsJson], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Internal server error during user creation.' });
    }
});

// ── UPDATE USER ───────────────────────────────────────────────
router.put('/users/:id', requireManager, async (req, res) => {
    try {
        const { full_name, username, email, role, can_edit, can_delete, status, password, custom_permissions } = req.body;
        const id = req.params.id;

        if (!username || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (!email || email.trim().length === 0) {
            return res.status(400).json({ error: 'Email ID is required.' });
        }
        const VALID_ROLES = ['Admin', 'Sales Manager', 'Procurement Manager', 'Accounts Manager', 'Installation Manager', 'Admin Manager', 'Service Manager', 'Sales Team Leader', 'Procurement Team Leader', 'Accounts Team Leader', 'Installation Team Leader', 'Admin Team Leader', 'Service Team Leader', 'Sales Executive', 'Procurement Executive', 'Account Executive', 'Installation Executive', 'Admin Executive', 'Service Executive'];
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid Role selected. Please select a valid role from the hierarchy.' });
        }

        const permsJson = (custom_permissions && Object.keys(custom_permissions).length > 0) ? JSON.stringify(custom_permissions) : null;

        // If new password provided, validate strength
        if (password && password.trim() !== '') {
            if (!isStrongPassword(password)) {
                return res.status(400).json({ error: getPasswordStrengthMessage() });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, password=?, custom_permissions_json=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, hashedPassword, permsJson, id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        } else {
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, custom_permissions_json=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, permsJson, id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        }
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error during user update.' });
    }
});

// ── DELETE USER (soft delete — set status Inactive) ───────────
router.delete('/users/:id', requireManager, (req, res) => {
    db.run("UPDATE users SET status = 'Inactive' WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;