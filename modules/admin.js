const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcrypt');
const { requireManager, isStrongPassword, getPasswordStrengthMessage } = require('../helpers');

// ── GET ALL USERS ─────────────────────────────────────────────
router.get('/users', requireManager, (req, res) => {
    db.all("SELECT id, username, full_name, email, role, can_edit, can_delete, status, outlook_email, is_outlook_active, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, last_call_sync_timestamp FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ── DISCONNECT OUTLOOK FOR A USER ─────────────────────────────
router.delete('/users/:id/outlook', requireManager, (req, res) => {
    db.run(
        "UPDATE users SET outlook_email = NULL, outlook_access_token = NULL, outlook_refresh_token = NULL, is_outlook_active = 0 WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ── GET USER PERMISSION OVERRIDES ─────────────────────────────
router.get('/users/:id/custom-permissions', requireManager, (req, res) => {
    const userId = req.params.id;
    db.all("SELECT module_name, feature_name, access_status FROM user_permissions WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const matrix = {};
        (rows || []).forEach(r => {
            if (!matrix[r.module_name]) matrix[r.module_name] = {};
            matrix[r.module_name][r.feature_name] = r.access_status;
        });
        res.json(matrix);
    });
});

router.get('/users/:id/permissions', requireManager, (req, res) => {
    const userId = req.params.id;
    db.all("SELECT module_name, feature_name, access_status FROM user_permissions WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const matrix = {};
        (rows || []).forEach(r => {
            if (!matrix[r.module_name]) matrix[r.module_name] = {};
            matrix[r.module_name][r.feature_name] = r.access_status;
        });
        res.json(matrix);
    });
});

// ── CREATE USER ───────────────────────────────────────────────
router.post('/users', requireManager, async (req, res) => {
    try {
        const { username, password, full_name, email, role, can_edit, can_delete, status, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key } = req.body;

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

        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, full_name, email, role, can_edit, can_delete, status, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        db.run(sql, [username.trim(), hashedPassword, full_name.trim(), email || '', role, can_edit || 'No', can_delete || 'No', status || 'Active', voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const userId = this.lastID;
            
            // Insert overrides
            if (custom_permissions && typeof custom_permissions === 'object') {
                db.serialize(() => {
                    const stmt = db.prepare("INSERT INTO user_permissions (user_id, module_name, feature_name, access_status) VALUES (?, ?, ?, ?)");
                    for (const mod in custom_permissions) {
                        for (const feat in custom_permissions[mod]) {
                            const val = custom_permissions[mod][feat] ? 1 : 0;
                            stmt.run(userId, mod, feat, val);
                        }
                    }
                    stmt.finalize();
                });
            }
            
            res.json({ id: userId, success: true });
        });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Internal server error during user creation.' });
    }
});

// ── UPDATE USER ───────────────────────────────────────────────
router.put('/users/:id', requireManager, async (req, res) => {
    try {
        const { full_name, username, email, role, can_edit, can_delete, status, password, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key } = req.body;
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

        const handlePermissionsSync = (callback) => {
            if (custom_permissions === undefined) {
                return callback();
            }
            db.serialize(() => {
                db.run("DELETE FROM user_permissions WHERE user_id = ?", [id], (deleteErr) => {
                    if (deleteErr) console.error('Error deleting user_permissions:', deleteErr.message);
                    if (custom_permissions && typeof custom_permissions === 'object') {
                        const stmt = db.prepare("INSERT INTO user_permissions (user_id, module_name, feature_name, access_status) VALUES (?, ?, ?, ?)");
                        for (const mod in custom_permissions) {
                            for (const feat in custom_permissions[mod]) {
                                const val = custom_permissions[mod][feat] ? 1 : 0;
                                stmt.run(id, mod, feat, val);
                            }
                        }
                        stmt.finalize(callback);
                    } else {
                        callback();
                    }
                });
            });
        };

        // If new password provided, validate strength
        if (password && password.trim() !== '') {
            if (!isStrongPassword(password)) {
                return res.status(400).json({ error: getPasswordStrengthMessage() });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, password=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, hashedPassword, voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || '', id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                handlePermissionsSync(() => {
                    res.json({ success: true });
                });
            });
        } else {
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || '', id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                handlePermissionsSync(() => {
                    res.json({ success: true });
                });
            });
        }
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Internal server error during user update.' });
    }
});

// ── DELETE USER ──────────────────────────────────────────────
router.delete('/users/:id', requireManager, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ── GET RATE LIMITS & BLOCKED ATTEMPTS ────────────────────────
router.get('/rate-limits', requireManager, (req, res) => {
    // Get whitelisted IPs
    db.all("SELECT id, ip, added_by, added_at FROM ip_whitelist ORDER BY id DESC", [], (err, whitelisted) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Get recent blocked attempts (last 50)
        db.all("SELECT id, ip, username, attempted_at, was_blocked FROM login_attempts ORDER BY id DESC LIMIT 50", [], (err2, attempts) => {
            if (err2) return res.status(500).json({ error: err2.message });
            
            res.json({
                whitelisted: whitelisted || [],
                attempts: attempts || []
            });
        });
    });
});

// ── ADD IP TO WHITELIST ───────────────────────────────────────
router.post('/rate-limits/whitelist', requireManager, (req, res) => {
    const { ip } = req.body;
    if (!ip || ip.trim().length === 0) {
        return res.status(400).json({ error: 'IP Address is required.' });
    }
    
    // Validate IP format (IPv4 or IPv6 basic check)
    const cleanIp = ip.trim();
    const addedBy = req.session.user.full_name || req.session.user.username || 'Admin';
    
    db.run(
        "INSERT INTO ip_whitelist (ip, added_by) VALUES (?, ?)",
        [cleanIp, addedBy],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'This IP is already whitelisted.' });
                }
                return res.status(500).json({ error: err.message });
            }
            
            // Also reset in memory if they are blocked
            const limiter = req.app.get('loginLimiter');
            if (limiter && typeof limiter.resetKey === 'function') {
                try { limiter.resetKey(cleanIp); } catch(e) { console.error(e); }
            }
            
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ── REMOVE IP FROM WHITELIST ──────────────────────────────────
router.delete('/rate-limits/whitelist/:ip', requireManager, (req, res) => {
    const ip = req.params.ip;
    db.run("DELETE FROM ip_whitelist WHERE ip = ?", [ip], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ── RESET RATE LIMIT FOR IP ───────────────────────────────────
router.post('/rate-limits/reset', requireManager, (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP Address is required.' });
    
    const cleanIp = ip.trim();
    
    // Reset key in rate limiter memory
    const limiter = req.app.get('loginLimiter');
    if (limiter && typeof limiter.resetKey === 'function') {
        try {
            limiter.resetKey(cleanIp);
        } catch(e) {
            console.error('Failed to reset key in express-rate-limit:', e);
        }
    }
    
    // Delete their blocked attempts from log so they disappear from list
    db.run("DELETE FROM login_attempts WHERE ip = ?", [cleanIp], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;