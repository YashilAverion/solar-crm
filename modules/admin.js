const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireManager, isStrongPassword, getPasswordStrengthMessage } = require('../helpers');

// Multer storage for custom email signature images (handwritten signatures, logos, banners)
const sigUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'signatures');
if (!fs.existsSync(sigUploadsDir)) {
    fs.mkdirSync(sigUploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, sigUploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
    }
});
const uploadSig = multer({ storage });

router.post('/upload-signature-image', requireManager, uploadSig.single('signature_image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const publicUrl = `https://crm.aresenergy.com.au/uploads/signatures/${req.file.filename}`;
    res.json({ success: true, url: publicUrl, filename: req.file.filename });
});

// Helper to generate professional HTML Email Signature matching Image 2
function generateHTMLSignature(fullName, designation, role, email, mobile) {
    const repName = fullName || 'Solar Specialist';
    const repRole = designation || role || 'Solar Energy Advisor';
    const repEmail = email || 'info@aresenergy.com.au';
    const repMobile = mobile || '0485 838 592';
    const digitsOnly = repMobile.replace(/\D/g, '') || '61485838592';

    return `<br><br>
<p style="margin: 0 0 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13.5px; color: #333333; font-weight: 500;">Thank You</p>
<div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.4; color: #1c2b3a;">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
    <span style="font-size: 16px; font-weight: 800; color: #0284c7;">${repName}</span>
    <div style="display: inline-flex; gap: 6px; align-items: center; margin-left: 6px;">
      <a href="https://www.facebook.com/people/Ares-Energy-Electricals/61584003342989/" target="_blank" style="text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="18" height="18" alt="FB" style="vertical-align: middle;">
      </a>
      <a href="https://instagram.com/aresenergy" target="_blank" style="text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="18" height="18" alt="IG" style="vertical-align: middle;">
      </a>
      <a href="https://api.whatsapp.com/send/?phone=%2B${digitsOnly}&text&type=phone_number&app_absent=0" target="_blank" style="text-decoration: none;">
        <img src="https://cdn-icons-png.flaticon.com/512/1384/1384055.png" width="18" height="18" alt="WA" style="vertical-align: middle;">
      </a>
    </div>
  </div>
  <div style="font-size: 13px; color: #475569; font-weight: 600; margin-bottom: 2px;">${repRole}</div>
  <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Ares Energy</div>

  <div style="border-top: 1.5px solid #0284c7; border-bottom: 1.5px solid #0284c7; padding: 8px 0; margin: 8px 0 10px; max-width: 480px;">
    <table style="border-collapse: collapse; font-size: 12px; color: #1e293b; width: 100%;">
      <tr>
        <td style="font-weight: 700; width: 70px; padding: 2px 0; color: #475569;">Email:</td>
        <td style="padding: 2px 0;"><a href="mailto:${repEmail}" style="color: #1e293b; text-decoration: none; font-weight: 600;">${repEmail}</a></td>
      </tr>
      <tr>
        <td style="font-weight: 700; padding: 2px 0; color: #475569;">Mobile:</td>
        <td style="padding: 2px 0; font-weight: 600;">${repMobile}</td>
      </tr>
      <tr>
        <td style="font-weight: 700; padding: 2px 0; color: #475569;">Tollfree:</td>
        <td style="padding: 2px 0; font-weight: 600;">1300 717 583</td>
      </tr>
      <tr>
        <td style="font-weight: 700; padding: 2px 0; color: #475569;">Address:</td>
        <td style="padding: 2px 0; font-weight: 600;">276 Kargotich Rd, Oakford WA 6121</td>
      </tr>
    </table>
  </div>

  <div style="margin-bottom: 10px;">
    <a href="https://www.aresenergy.com.au" target="_blank" style="color: #0284c7; font-weight: 700; font-size: 13px; text-decoration: none;">www.aresenergy.com.au</a>
  </div>

  <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 14px; border-collapse: collapse;">
    <tr>
      <td style="padding-right: 16px; vertical-align: middle;">
        <img src="https://crm.aresenergy.com.au/sig_badge_ares.png" height="56" alt="Ares Energy & Electricals" style="height: 56px; width: auto; max-height: 56px; display: block; border: 0; background: transparent;">
      </td>
      <td style="padding-right: 16px; vertical-align: middle;">
        <img src="https://crm.aresenergy.com.au/sig_badge_netcc.png" height="56" alt="NETCC Approved Seller" style="height: 56px; width: auto; max-height: 56px; display: block; border: 0; background: transparent;">
      </td>
      <td style="vertical-align: middle;">
        <img src="https://crm.aresenergy.com.au/sig_badge_saa.png" height="56" alt="Solar Accreditation Australia" style="height: 56px; width: auto; max-height: 56px; display: block; border: 0; background: transparent;">
      </td>
    </tr>
  </table>
</div>`;
}

// Export signature helper
router.generateHTMLSignature = generateHTMLSignature;

// ── GET ALL USERS ─────────────────────────────────────────────
router.get('/users', requireManager, (req, res) => {
    db.all("SELECT id, username, full_name, email, role, can_edit, can_delete, status, outlook_email, is_outlook_active, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, designation, mobile_number, email_signature, department_id FROM users", [], (err, rows) => {
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
        const { username, password, full_name, email, role, can_edit, can_delete, status, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, designation, mobile_number, email_signature } = req.body;

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
        const rolesRows = await new Promise((resolve, reject) =>
            db.all("SELECT name FROM roles", [], (err, rows) => err ? reject(err) : resolve(rows))
        );
        const VALID_ROLES = rolesRows.map(r => r.name);
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

        const desig = (designation || '').trim();
        const mob = (mobile_number || '').trim();
        const sig = (email_signature && email_signature.trim()) ? email_signature.trim() : generateHTMLSignature(full_name, desig, role, email, mob);

        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, full_name, email, role, can_edit, can_delete, status, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, designation, mobile_number, email_signature) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        db.run(sql, [username.trim(), hashedPassword, full_name.trim(), email || '', role, can_edit || 'No', can_delete || 'No', status || 'Active', voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || '', desig, mob, sig], function(err) {
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
        const { full_name, username, email, role, can_edit, can_delete, status, password, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, designation, mobile_number, email_signature } = req.body;
        const id = req.params.id;

        if (!username || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (!email || email.trim().length === 0) {
            return res.status(400).json({ error: 'Email ID is required.' });
        }
        const rolesRows = await new Promise((resolve, reject) =>
            db.all("SELECT name FROM roles", [], (err, rows) => err ? reject(err) : resolve(rows))
        );
        const VALID_ROLES = rolesRows.map(r => r.name);
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid Role selected. Please select a valid role from the hierarchy.' });
        }

        const desig = (designation || '').trim();
        const mob = (mobile_number || '').trim();
        const sig = (email_signature && email_signature.trim()) ? email_signature.trim() : generateHTMLSignature(full_name, desig, role, email, mob);

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
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, password=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=?, designation=?, mobile_number=?, email_signature=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, hashedPassword, voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || '', desig, mob, sig, id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                handlePermissionsSync(() => {
                    res.json({ success: true });
                });
            });
        } else {
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=?, designation=?, mobile_number=?, email_signature=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, voipline_extension || '', voipline_api_key || '', voipline_outbound_line || '', voipline_secret_token || '', voipline_master_key || '', desig, mob, sig, id], (err) => {
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