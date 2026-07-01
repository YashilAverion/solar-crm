require('dotenv').config();
const express = require('express');
const router = express.Router();
const config = require('../config');
const db = require('../database/db');
const multer = require('multer');
const fs = require('fs');
const https = require('https');
const path = require('path');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const { getSydneyTime, requireAuth, requireManager, getCurrentUser, getSydneyISO, isoToDisplay } = require('../helpers');

const certUploadDir = './uploads/installations';
if (!fs.existsSync(certUploadDir)) { fs.mkdirSync(certUploadDir, { recursive: true }); }

const certStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, certUploadDir); },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});
const uploadCert = multer({ 
    storage: certStorage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: Only images (jpeg/jpg/png), PDFs, and documents (doc/docx) are allowed!'));
    }
});

function addHistory(installation_id, action, details, user_name) {
    db.run(
        `INSERT INTO installations_history (installation_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)`,
        [installation_id, action, details, user_name, getSydneyTime()]
    );
}

// ── HELPER: GENERATE DYNAMIC PROJECT REFERENCE NUMBER ──────
function generateProjectNumber(type, callback) {
    let prefix = 'AROTH';
    if (['PV', 'Battery', 'PV + Battery'].includes(type)) prefix = 'ARINT';
    else if (type === 'Domestic') prefix = 'ARDOM';
    else if (type === 'Service') prefix = 'ARSER';

    const prefixLen = prefix.length + 1;
    const fetchSql = `SELECT project_number FROM installations WHERE project_number LIKE ? AND CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) DESC LIMIT 1`;

    db.get(fetchSql, [`${prefix}%`], (err, row) => {
        let nextNum = 1001;
        if (!err && row && row.project_number) {
            const numStr = row.project_number.replace(prefix, '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num >= 1000) {
                nextNum = num + 1;
            }
        }
        callback(`${prefix}${nextNum}`);
    });
}

// ── SHARED FETCH LOGIC ────────────────────────────────────
function fetchInstallationsData(req, res, overridePayStatus = null) {
    const { 
        page = 1, limit = 50, search = '', sort = 'id', order = 'desc',
        type, company, area, state, payMode, payStatus, certStatus,
        createdFrom, createdTo, completedFrom, completedTo, panel, battery, inverter, manualSuburb, suburbs
    } = req.query;
    
    const effectivePayStatus = overridePayStatus || payStatus;

    let offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClauses = ["(status IS NULL OR status != 'Deleted')"];
    let params = [];

    if (search) {
        whereClauses.push(`(
            company LIKE ? OR project_number LIKE ? OR first_name LIKE ? OR 
            last_name LIKE ? OR phone LIKE ? OR email LIKE ? OR 
            address LIKE ? OR suburb LIKE ? OR state LIKE ? OR status LIKE ?
        )`);
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s, s, s, s, s);
    }

    if (type) { whereClauses.push("type = ?"); params.push(type); }
    if (company) { whereClauses.push("LOWER(company) LIKE ?"); params.push(`%${company.toLowerCase()}%`); }
    if (state) { whereClauses.push("LOWER(state) = ?"); params.push(state.toLowerCase()); }
    if (payMode) { whereClauses.push("payment_mode = ?"); params.push(payMode); }
    if (certStatus) { whereClauses.push("cert_status = ?"); params.push(certStatus); }

    if (effectivePayStatus) { 
        if (effectivePayStatus === 'Pending' || effectivePayStatus === 'Outstanding') {
            whereClauses.push("(payment_status = 'Pending' OR payment_status IS NULL OR payment_status = '')");
        } else {
            whereClauses.push("payment_status = ?"); 
            params.push(effectivePayStatus); 
        }
    }

    const safeDate = (col) => `date(${col})`;
    if (createdFrom) { whereClauses.push(`${safeDate('created_date')} >= date(?)`); params.push(createdFrom); }
    if (createdTo) { whereClauses.push(`${safeDate('created_date')} <= date(?)`); params.push(createdTo); }
    if (completedFrom) { whereClauses.push(`date(created_at) >= date(?)`); params.push(completedFrom); }
    if (completedTo) { whereClauses.push(`date(created_at) <= date(?)`); params.push(completedTo); }

    if (panel) { whereClauses.push("LOWER(equipment_details) LIKE ?"); params.push(`%${panel}%`); }
    if (battery) { whereClauses.push("LOWER(equipment_details) LIKE ?"); params.push(`%${battery}%`); }
    if (inverter) { whereClauses.push("LOWER(equipment_details) LIKE ?"); params.push(`%${inverter}%`); }

    if (suburbs && suburbs !== '[]') {
        try {
            const parsedSuburbs = JSON.parse(suburbs);
            if (Array.isArray(parsedSuburbs) && parsedSuburbs.length > 0) {
                const placeholders = parsedSuburbs.map(() => 'LOWER(?)').join(',');
                whereClauses.push(`LOWER(suburb) IN (${placeholders})`);
                params.push(...parsedSuburbs.map(s => String(s).toLowerCase()));
            }
        } catch(e) {}
    } else if (manualSuburb) {
        whereClauses.push("LOWER(suburb) LIKE ?"); params.push(`%${manualSuburb}%`);
    }

    let whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    const safeSort = ['id', 'type', 'company', 'created_date', 'project_number', 'first_name', 'phone', 'email', 'address', 'suburb', 'invoice_amount', 'payment_mode', 'payment_status', 'status'].includes(sort) ? sort : 'id';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = safeSort === 'invoice_amount' ? `CAST(invoice_amount AS REAL) ${safeOrder}` : `${safeSort} ${safeOrder}`;
    
    const countQuery = `SELECT COUNT(*) AS total FROM installations ${whereStr}`;
    const dataQuery = `SELECT * FROM installations ${whereStr} ORDER BY ${orderClause} LIMIT ? OFFSET ?`;

    db.get(countQuery, params, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = countRow ? countRow.total : 0;

        db.all(dataQuery, [...params, limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const optimizedRows = (rows || []).map(r => {
                try { r.equipment_details = r.equipment_details ? JSON.parse(r.equipment_details) : []; } catch(e) { r.equipment_details = []; }
                try { r.certificate_details = r.certificate_details ? JSON.parse(r.certificate_details) : []; } catch(e) { r.certificate_details = []; }
                
                if (Array.isArray(r.equipment_details)) {
                    const panel = r.equipment_details.find(e => e.type === 'Panel' || e.type === 'PV');
                    const inverter = r.equipment_details.find(e => e.type === 'Inverter');
                    const battery = r.equipment_details.find(e => e.type === 'Battery');
                    if (panel) { r.panel_model = panel.model || panel.name; r.panel_qty = panel.qty; }
                    if (inverter) { r.inverter_model = inverter.model || inverter.name; }
                    if (battery) { r.battery_model = battery.model || battery.name; r.battery_qty = battery.qty; }
                }
                r.created_date = isoToDisplay(r.created_date);
                return r;
            });

            db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN status != 'Completed' AND status != 'Deleted' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed FROM installations WHERE status != 'Deleted'`, [], (err, statsRow) => {
                res.json({ data: optimizedRows, total: total, stats: statsRow || { total: 0, pending: 0, completed: 0 } });
            });
        });
    });
}

// ── GET ALL INSTALLATIONS ─────────────────────────────────
router.get('/', (req, res) => {
    fetchInstallationsData(req, res);
});

// ── GET OUTSTANDING PAYMENTS ──────────────────────────────
router.get('/outstanding-payments', (req, res) => {
    fetchInstallationsData(req, res, 'Pending');
});

// ── GET PAID PAYMENTS ─────────────────────────────────────
router.get('/paid-payments', (req, res) => {
    fetchInstallationsData(req, res, 'Paid');
});

// ── GET INSTALLATION HISTORY ──────────────────────────────
router.get('/:id/history', (req, res) => {
    db.all("SELECT * FROM installations_history WHERE installation_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ── GET SAVED CHARGES FOR AN INSTALLATION ─────────────────
router.get('/:id/charges', (req, res) => {
    db.all("SELECT * FROM installation_saved_charges WHERE installation_id = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ── DISTANCE MATRIX AUTOCALCULATOR (GOOGLE MAPS) ──────────
router.get('/calculate-distance', (req, res) => {
    const dest = req.query.destination;
    if (!dest) return res.json({ distance_km: 0, round_trip_km: 0, billable_km: 0, rate: 0, travel_charge: 0 });

    db.get("SELECT rate FROM installation_charge_items WHERE charge_type = 'per_km_travel' OR charge_name LIKE '%Travel%' LIMIT 1", [], (err, row) => {
        const rate = row ? parseFloat(row.rate) || 0 : 0;
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in the .env file.' });
        }
        const origin = encodeURIComponent('Piara Waters WA 6112');
        const destination = encodeURIComponent(dest);
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;
        
        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    let distance_km = 0;
                    if (result.status === 'OK' && result.rows && result.rows[0] && result.rows[0].elements && result.rows[0].elements[0].status === 'OK') {
                        distance_km = result.rows[0].elements[0].distance.value / 1000;
                    } else {
                        console.error('Google Maps API Error:', result);
                    }
                    const round_trip_km = distance_km * 2;
                    const billable_km = Math.max(0, round_trip_km - 50);
                    const travel_charge = billable_km * rate;
                    res.json({ distance_km: distance_km.toFixed(2), round_trip_km: round_trip_km.toFixed(2), billable_km: billable_km.toFixed(2), rate: rate, travel_charge: travel_charge.toFixed(2) });
                } catch(e) { 
                    console.error('Distance calculation parse error:', e);
                    res.json({ distance_km: 0, round_trip_km: 0, billable_km: 0, rate, travel_charge: 0 }); 
                }
            });
        }).on('error', (err) => {
            console.error('Distance calculation network error:', err);
            res.json({ distance_km: 0, round_trip_km: 0, billable_km: 0, rate, travel_charge: 0 });
        });
    });
});

// ── SEARCH SUGGESTIONS (TYPE-AHEAD API) ───────────────────
router.get('/search-suggestions', (req, res) => {
    const q = req.query.q || '';
    if (!q) return res.json([]);
    const s = `%${q}%`;
    const query = `
                SELECT id, company, project_number, first_name, last_name, email, phone, address, suburb, state 
        FROM installations 
        WHERE status != 'Deleted' AND (
            company LIKE ? OR project_number LIKE ? OR first_name LIKE ? OR 
                    last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR address LIKE ?
        )
        ORDER BY id DESC LIMIT 10
    `;
            db.all(query, [s,s,s,s,s,s,s], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// ── CREATE INSTALLATION ───────────────────────────────────
router.post('/', (req, res) => {
    const d = req.body;
    const currentUser = d.currentUser || 'System';
    const projNum = (d.project_number && d.project_number.trim() !== '') ? d.project_number.trim() : '';

    const sql = `INSERT INTO installations (
        type, company, first_name, last_name, phone, email,
        google_address, unit_number, lot_number, street_type, address, suburb, state, postcode,
        created_date, status, cert_status, project_number
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    db.run(sql, [
        d.type || '', d.company || '', d.first_name || '', d.last_name || '',
        d.phone || '', d.email || '', d.google_address || '',
        d.unit_number || '', d.lot_number || '', d.street_type || '',
        d.address || '', d.suburb || '', d.state || '', d.postcode || '',
        getSydneyISO(), 'Pending', 'Pending', projNum
    ], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        addHistory(this.lastID, 'Created', `Installation added${projNum ? ` with Reference #${projNum}` : ''} for ${d.first_name} ${d.last_name}.`, currentUser);
        res.json({ id: this.lastID, project_number: projNum, success: true });
    });
});

// ── EDIT INSTALLATION ─────────────────────────────────────
router.put('/:id', (req, res) => {
    const d = req.body;
    const currentUser = d.currentUser || 'System';
    const sql = `UPDATE installations SET
        type=?, company=?, first_name=?, last_name=?, phone=?, email=?,
        google_address=?, unit_number=?, lot_number=?, street_type=?,
        address=?, suburb=?, state=?, postcode=?, project_number=?
        WHERE id=?`;
    db.run(sql, [
        d.type || '', d.company || '', d.first_name || '', d.last_name || '',
        d.phone || '', d.email || '', d.google_address || '',
        d.unit_number || '', d.lot_number || '', d.street_type || '',
        d.address || '', d.suburb || '', d.state || '', d.postcode || '',
        d.project_number || '',
        req.params.id
    ], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        addHistory(req.params.id, 'Edited', 'Installation details updated.', currentUser);
        res.json({ success: true });
    });
});

// ── UPDATE PAYMENT STATUS ─────────────────────────────────
router.put('/:id/payment-status', (req, res) => {
    const { payment_status, payment_mode, currentUser } = req.body;
    db.run("UPDATE installations SET payment_status = ?, payment_mode = ? WHERE id = ?", [payment_status, payment_mode, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        addHistory(req.params.id, 'Payment Status Updated', `Status: ${payment_status}, Mode: ${payment_mode || '-'}`, currentUser || 'System');
        res.json({ success: true });
    });
});

// ── UPDATE EQUIPMENT + CERTIFICATE DETAILS ────────────────
router.put('/:id/details', (req, res) => {
    const d = req.body;
    const currentUser = d.currentUser || 'System';
    const installationId = parseInt(req.params.id, 10);

    if (isNaN(installationId) || installationId <= 0) {
        return res.status(400).json({ error: 'Invalid Installation ID provided.' });
    }

    db.get("SELECT * FROM installations WHERE id=?", [installationId], (err, oldRecord) => {
        if (err || !oldRecord) return res.status(500).json({ error: 'Record not found' });

        db.serialize(() => {
            db.run(`UPDATE installations SET
                equipment_details = ?, 
                certificate_details = ?, 
                meter_number = ?, 
                electricity_phase = ?, 
                travel_distance_km = ?, 
                travel_charge_amount = ?
                WHERE id = ?`,
                [
                    typeof d.equipment_details === 'string' ? d.equipment_details : JSON.stringify(d.equipment_details || []),
                    typeof d.certificate_details === 'string' ? d.certificate_details : JSON.stringify(d.certificate_details || []),
                    d.meter_number || '',
                    d.electricity_phase || '',
                    parseFloat(d.travel_distance_km) || 0,
                    parseFloat(d.travel_charge_amount) || 0,
                    installationId
                ], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    // STRICT WIPE AND REPLACE LOGIC FOR GHOST RECORDS - Serialized execution
                    db.run("DELETE FROM installation_saved_charges WHERE installation_id=?", [installationId], function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        
                        const charges = d.installation_charges || [];
                        if (charges.length === 0) {
                            db.run("UPDATE installations SET invoice_amount = 0, payment_status_amount = 0, charges_configured = 'Yes' WHERE id = ?", [installationId], function(updateErr) {
                                if (updateErr) console.error("Error resetting installations invoice amount:", updateErr.message);
                                addHistory(installationId, 'Details Updated', 'Equipment, certificates, and charges saved.', currentUser);
                                return res.json({ success: true });
                            });
                            return;
                        }

                        // Use prepared statement to guarantee synchronous, locked sequential execution of inserts
                        const stmt = db.prepare(`INSERT INTO installation_saved_charges (installation_id, charge_item_id, charge_name, qty, rate, amount_ex_gst, gst_amount, amount_inc_gst, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                        
                        charges.forEach(charge => {
                            stmt.run([ installationId, charge.charge_item_id || null, charge.charge_name, charge.qty || 0, charge.rate || 0, charge.amount_ex_gst || 0, charge.gst_amount || 0, charge.amount_inc_gst || 0, charge.notes || '' ]);
                        });
                        
                        stmt.finalize(function(err) {
                            if (err) return res.status(500).json({ error: 'Error saving one or more charges' });
                            
                            const totalAmount = charges.reduce((sum, c) => sum + (parseFloat(c.amount_inc_gst) || 0), 0);
                            db.run("UPDATE installations SET invoice_amount = ?, payment_status_amount = ?, charges_configured = 'Yes' WHERE id = ?",
                                [totalAmount, totalAmount, installationId],
                                function(updateErr) {
                                    if (updateErr) console.error("Error updating installations invoice amount:", updateErr.message);
                                    addHistory(installationId, 'Details Updated', 'Equipment, certificates, and charges saved.', currentUser);
                                    res.json({ success: true });
                                }
                            );
                        });
                    });
                }
            );
        });
    });
});

// ── DELETE ACTION (SOFT) ──────────────────────────────────
router.post('/:id/delete-action', requireAuth, (req, res) => {
    const userRole = req.session && req.session.user ? req.session.user.role : '';
    const currentUser = (req.session && req.session.user ? req.session.user.full_name : null) || req.body.currentUser || 'System';
    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    if (isMgr) {
        db.run("UPDATE installations SET status = 'Deleted' WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(req.params.id, 'Deleted', 'Manager Soft Deleted the Installation.', currentUser);
            res.json({ success: true, deleted: true });
        });
    } else {
        db.run("UPDATE installations SET status = 'Pending Deletion' WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(req.params.id, 'Delete Request', 'User requested deletion.', currentUser);
            res.json({ success: true, requested: true });
        });
    }
});

// ── BULK DELETE ───────────────────────────────────────────
router.post('/bulk-delete', requireAuth, (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'No installations selected' });

    const userRole = req.session && req.session.user ? req.session.user.role : '';
    const currentUser = (req.session && req.session.user ? req.session.user.full_name : null) || req.body.currentUser || 'System';
    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    const newStatus = isMgr ? 'Deleted' : 'Pending Deletion';
    const action = isMgr ? 'Bulk Deleted' : 'Bulk Delete Request';

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE installations SET status = ? WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO installations_history (installation_id, action, details, user_name, created_at) VALUES (?, ?, ?, ?, ?)");
        const timeStr = getSydneyTime();
        let hasError = false;

        ids.forEach(id => {
            stmt.run([newStatus, id], (err) => { if (err) hasError = true; });
            histStmt.run([id, action, `Bulk ${isMgr ? 'soft-deleted' : 'deletion requested'}.`, currentUser, timeStr], (err) => { if (err) hasError = true; });
        });

        stmt.finalize(() => {
            histStmt.finalize(() => {
                if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Some records could not be processed.' });
                }
                db.run("COMMIT", (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Database transaction failed.' });
                    }
                    res.json({ success: true });
                });
            });
        });
    });
});

// ── GET DOCUMENTS ─────────────────────────────────────────
router.get('/:id/documents', (req, res) => {
    db.all("SELECT * FROM installation_documents WHERE installation_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ── UPLOAD CERTIFICATE DOCUMENT (FILE ONLY) ───────────────
router.post('/:id/upload-document', uploadCert.single('certificate'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/uploads/installations/${req.file.filename}`;
    res.json({ success: true, fileUrl: fileUrl, name: req.file.originalname });
});

// ── SAVE DOCUMENT METADATA (JSON) ─────────────────────────
router.post('/:id/documents', (req, res) => {
    const d = req.body;
    const sql = `INSERT INTO installation_documents (installation_id, doc_type, file_name, file_size, file_url, user_name) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [req.params.id, d.doc_type, d.file_name, d.file_size, d.file_url, d.user_name || 'System'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
    });
});

// ── DELETE DOCUMENT ───────────────────────────────────────
router.delete('/:id/documents/:docId', (req, res) => {
    db.run("DELETE FROM installation_documents WHERE id = ?", [req.params.docId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ── HELPERS FOR OUTLOOK OAUTH INTEGRATION ───────────────────
async function refreshOutlookTokenLocal(userId, refreshToken) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth configuration is missing.');
    }

    try {
        const axios = require('axios');
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', clientId);
        tokenParams.append('scope', 'openid profile offline_access Mail.Send Mail.ReadWrite');
        tokenParams.append('refresh_token', refreshToken);
        tokenParams.append('grant_type', 'refresh_token');
        tokenParams.append('client_secret', clientSecret);

        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', tokenParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token || refreshToken;

        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE users SET outlook_access_token = ?, outlook_refresh_token = ? WHERE id = ?",
                [newAccessToken, newRefreshToken, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        return newAccessToken;
    } catch (error) {
        console.error('Failed to refresh Microsoft Outlook token locally:', error.response ? error.response.data : error.message);
        throw new Error('Token refresh failed.');
    }
}

async function getOrRefreshOutlookTokenLocal(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT outlook_access_token, outlook_refresh_token, is_outlook_active FROM users WHERE id = ?",
            [userId],
            async (err, row) => {
                if (err) {
                    return reject(new Error('Database error: ' + err.message));
                }
                if (!row) {
                    return reject(new Error('User not found.'));
                }
                if (!row.is_outlook_active) {
                    return reject(new Error('Outlook email integration is not active.'));
                }
                if (!row.outlook_access_token) {
                    return reject(new Error('Outlook access token is missing.'));
                }

                try {
                    const axios = require('axios');
                    // Check if current token is valid by hitting cheap endpoint
                    await axios.get('https://graph.microsoft.com/v1.0/me', {
                        headers: { Authorization: `Bearer ${row.outlook_access_token}` }
                    });
                    return resolve(row.outlook_access_token);
                } catch (apiErr) {
                    if (apiErr.response && apiErr.response.status === 401 && row.outlook_refresh_token) {
                        console.log(`Access token expired for user ${userId}. Refreshing locally...`);
                        try {
                            const newAccessToken = await refreshOutlookTokenLocal(userId, row.outlook_refresh_token);
                            return resolve(newAccessToken);
                        } catch (refreshErr) {
                            return reject(refreshErr);
                        }
                    } else {
                        return reject(new Error('Graph API validation failed: ' + apiErr.message));
                    }
                }
            }
        );
    });
}

// 🔥 NEW: Route to Generate & Email PDF Invoice Server-Side using Puppeteer 🔥
router.post('/:id/email-invoice', async (req, res) => {
    const { email, subject, text, projectNumber } = req.body;
    if (!email) return res.status(400).json({ error: 'Customer email is missing.' });

    let browser;
    try {
        // 1. Launch Puppeteer (Server-side rendering)
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

        // 1.5. Enable request interception to inject secret auth bypass header
        await page.setRequestInterception(true);
        page.on('request', interceptedRequest => {
            const headers = Object.assign({}, interceptedRequest.headers(), {
                'x-pdf-render-secret': process.env.SESSION_SECRET || 'solar-crm-secret-key-2024'
            });
            interceptedRequest.continue({ headers });
        });

        // 2. Construct the local URL to access the invoice template
        // Force HTTP localhost to bypass loopback networking issues on HTTPS/SSL
        const invoiceUrl = `http://localhost:3000/invoice.html?id=${req.params.id}`;

        // 4. Wait for all network calls (APIs/DOM renders) to finish loading completely
        await page.goto(invoiceUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluateHandle(() => document.fonts.ready);

        // 4.5. Inject Terms & Conditions page dynamically before rendering PDF
        await page.evaluate(() => {
            const termsDiv = document.createElement('div');
            termsDiv.style.pageBreakBefore = 'always';
            termsDiv.style.padding = '40px 20px';
            termsDiv.style.fontFamily = 'Inter, system-ui, sans-serif';
            termsDiv.innerHTML = `
                <h2 style="color: #1c3557; border-bottom: 2px solid #eef2f8; padding-bottom: 10px; margin-bottom: 20px;">Terms and Conditions</h2>
                <div style="font-size: 12px; color: #475569; line-height: 1.8;">
                    <p><strong>1. General</strong><br>These terms and conditions apply to the sale and installation of solar systems by Ares Energy.</p><br>
                    <p><strong>2. Payment Terms</strong><br>A deposit is required upon acceptance of the quote. The remaining balance must be paid in full on the day of installation unless otherwise agreed or financed.</p><br>
                    <p><strong>3. Installation</strong><br>We will endeavor to install the system on the agreed date, but this is subject to weather conditions, grid approvals, and material availability.</p><br>
                    <p><strong>4. Warranties</strong><br>Standard manufacturer warranties apply to the panels, inverter, and battery. Workmanship is covered for the period specified in your quotation.</p><br>
                    <p><strong>5. STCs (Small-scale Technology Certificates)</strong><br>The quoted price assumes that the STCs generated by the system are assigned to Ares Energy. If you choose to retain the STCs, the out-of-pocket expense will increase accordingly.</p><br>
                    <p><strong>6. Site Conditions</strong><br>If unforeseen structural, electrical, or safety issues are discovered during installation (e.g., roof reinforcement or switchboard upgrades needed), additional charges may apply after consultation.</p><br>
                    <br><br><br>
                    <p style="text-align: center; color: #94a3b8; font-size: 11px; font-weight: 600;">Thank you for choosing Ares Energy.</p>
                </div>
            `;
            document.body.appendChild(termsDiv);
        });

        // 5. Generate PDF buffer directly into memory (triggers @media print CSS to hide buttons automatically)
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        browser = null; // Mark as closed

        // 6. Send via Microsoft Outlook OAuth (M365) if active for logged-in user, otherwise fallback to SMTP
        const userId = req.session && req.session.user ? req.session.user.id : null;
        let emailSent = false;
        let outlookErrorMsg = '';

        if (userId) {
            try {
                const accessToken = await getOrRefreshOutlookTokenLocal(userId);
                if (accessToken) {
                    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
                    const toRecipients = email.split(/[,;]/).map(e => ({
                        emailAddress: { address: e.trim() }
                    })).filter(r => r.emailAddress.address);

                    const mailPayload = {
                        message: {
                            subject: subject || `Tax Invoice - Ares Energy (Ref: ${projectNumber})`,
                            body: {
                                contentType: 'HTML',
                                content: (text || 'Please find your invoice attached.').replace(/\n/g, '<br>')
                            },
                            toRecipients: toRecipients,
                            attachments: [
                                {
                                    '@odata.type': '#microsoft.graph.fileAttachment',
                                    name: `Ares_Invoice_${projectNumber}.pdf`,
                                    contentType: 'application/pdf',
                                    contentBytes: pdfBase64
                                }
                            ]
                        },
                        saveToSentItems: "true"
                    };

                    const axios = require('axios');
                    await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', mailPayload, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    emailSent = true;
                    console.log(`Invoice email sent successfully via Outlook for user ${userId}`);
                }
            } catch (outlookErr) {
                outlookErrorMsg = outlookErr.message;
                console.warn(`Outlook email sending failed/not active for user ${userId}. Falling back to SMTP. Error: ${outlookErr.message}`);
            }
        }

        if (!emailSent) {
            // Check SMTP configuration
            const isEmailConfigured = config.email.user && config.email.user.trim() !== '' && !config.email.user.includes('your-email@');
            
            if (!isEmailConfigured) {
                const hint = outlookErrorMsg ? ` (Outlook Info: ${outlookErrorMsg})` : '';
                return res.status(400).json({ 
                    error: `Email could not be sent. Outlook integration is not active or has expired${hint}, and SMTP credentials are not configured in your .env file. Please connect to Outlook or configure SMTP.` 
                });
            }

            const transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.secure,
                auth: {
                    user: config.email.user,
                    pass: config.email.pass
                }
            });

            const mailOptions = { 
                from: config.email.from || `"Ares Energy" <${config.email.user}>`, 
                to: email, 
                subject: subject || `Tax Invoice - Ares Energy (Ref: ${projectNumber})`, 
                text: text || 'Please find your invoice attached.', 
                html: (text || 'Please find your invoice attached.').replace(/\n/g, '<br>'),
                attachments: [{ filename: `Ares_Invoice_${projectNumber}.pdf`, content: pdfBuffer }] 
            };
            
            await transporter.sendMail(mailOptions);
            emailSent = true;
        }

        res.json({ success: true });
        
    } catch (err) {
        if (browser) await browser.close();
        console.error("Server-side PDF/Email Error:", err);
        res.status(500).json({ error: `Failed to generate PDF or send email: ${err.message}` });
    }
});

module.exports = router;

