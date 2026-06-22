const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getSydneyISO, isoToDisplay } = require('../helpers');

function getSydneyTime() {
    return getSydneyISO();
}

function addHistory(lead_id, action, details, user_name) {
    db.run(
        `INSERT INTO lead_history (lead_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)`,
        [lead_id, action, details, user_name, getSydneyTime()]
    );
}

function generateProjectNumber(isServiceYes, callback) {
    const prefix = isServiceYes ? 'ARMT' : 'AR';
    const prefixLen = prefix.length + 1;
    const fetchSql = isServiceYes
        ? `SELECT project_number FROM leads WHERE project_number LIKE 'ARMT%' AND CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) DESC LIMIT 1`
        : `SELECT project_number FROM leads WHERE project_number LIKE 'AR%' AND project_number NOT LIKE 'ARMT%' AND CAST(SUBSTR(project_number, 3) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, 3) AS INTEGER) DESC LIMIT 1`;

    db.get(fetchSql, [], (err, row) => {
        let nextNum = 1001;
        if (!err && row && row.project_number) {
            const numStr = row.project_number.replace(prefix, "");
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num >= 1000) {
                nextNum = num + 1;
            }
        }
        callback(`${prefix}${nextNum}`);
    });
}

// Round Robin Auto-Assign
function getNextRoundRobinRep(callback) {
    db.all("SELECT full_name, username FROM users WHERE status = 'Active' AND role LIKE '%Sales%'", [], (err, users) => {
        if (err || !users || users.length === 0) {
            db.get("SELECT full_name, username FROM users WHERE status = 'Active' LIMIT 1", [], (err2, user) => {
                if (user) { callback(user.full_name || user.username); }
                else { callback('System'); }
            });
            return;
        }
        
        const salesReps = users.map(u => u.full_name || u.username);
        
        // Smart Round-Robin: Check who has been waiting the longest for a lead
        // If a user manually created a project, their MAX(id) will be high, so they will automatically be skipped.
        const unionQuery = salesReps.map(() => `SELECT ? as rep`).join(' UNION ALL ');
        const query = `
            SELECT u.rep, IFNULL(MAX(l.id), 0) as last_assigned_id
            FROM (${unionQuery}) u
            LEFT JOIN leads l ON u.rep = l.assign_to AND l.status != 'Deleted'
            GROUP BY u.rep
            ORDER BY last_assigned_id ASC
            LIMIT 1
        `;
        
        db.get(query, salesReps, (err, row) => {
            if (err || !row) { callback(salesReps[0]); return; }
            callback(row.rep);
        });
    });
}

// ── GET ALL LEADS ──────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
    db.all("SELECT * FROM leads ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = (rows || []).map(r => {
            r.lead_entered_date = isoToDisplay(r.lead_entered_date);
            r.created_date = isoToDisplay(r.created_date);
            return r;
        });
        res.json(formatted || []);
    });
});

// ── LEAD HISTORY ───────────────────────────────────────────
router.get('/:id/history', requireAuth, (req, res) => {
    db.all("SELECT * FROM lead_history WHERE lead_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ── CHECK DUPLICATE ────────────────────────────────────────
router.post('/check-duplicate', requireAuth, (req, res) => {
    const { address, unit_number, suburb, phone_number, email_id_1, exclude_id } = req.body;

    const queries = [];
    const params = [];

    if (phone_number && phone_number.trim().length >= 6) {
        queries.push(`phone_number = ?`);
        params.push(phone_number.trim());
    }
    if (email_id_1 && email_id_1.includes('@')) {
        queries.push(`LOWER(TRIM(email_id_1)) = LOWER(TRIM(?))`);
        params.push(email_id_1.trim());
    }
    if (address && suburb) {
        queries.push(`LOWER(TRIM(IFNULL(suburb, ''))) = LOWER(TRIM(?))`);
        params.push(suburb.trim());
    }

    if (queries.length === 0) {
        return res.json({ duplicate: false });
    }

    // Search the entire CRM database (including Delete Leads, Duplicate Leads, etc.)
    // Optimized: Specific columns instead of SELECT *
    let sql = `SELECT id, first_name, last_name, phone_number, email_id_1, unit_number, lot_number, street_type, address, suburb, status, project_number FROM leads WHERE (${queries.join(' OR ')})`;
    if (exclude_id) {
        sql += ` AND id != ?`;
        params.push(exclude_id);
    }
    sql += ` ORDER BY id DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (phone_number) {
            const match = rows.find(r => r.phone_number === phone_number.trim());
            if (match) return res.json({ duplicate: true, lead: match, checkType: 'phone' });
        }
        if (email_id_1) {
            const match = rows.find(r => r.email_id_1 && r.email_id_1.toLowerCase().trim() === email_id_1.toLowerCase().trim());
            if (match) return res.json({ duplicate: true, lead: match, checkType: 'email' });
        }
        if (address && suburb) {
            const combinedInput = `${unit_number || ''} ${address}`.trim().toLowerCase().replace(/\s+/g, ' ');
            const match = rows.find(r => {
                if ((r.suburb || '').toLowerCase().trim() !== suburb.toLowerCase().trim()) return false;
                const rowAddr = `${r.unit_number || ''} ${r.address || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
                return rowAddr === combinedInput;
            });
            if (match) return res.json({ duplicate: true, lead: match, checkType: 'address' });
        }
        
        return res.json({ duplicate: false });
    });
});

// ── WEBSITE LEAD (Auto-assign via Round Robin) — public endpoint ───
router.post('/website', (req, res) => {
    const d = req.body;

    // Honeypot Check: If the hidden 'website' field is filled, it's an automated bot.
    if (d.website) {
        console.warn(`[SECURITY ALERT] Honeypot triggered on public lead form! IP: ${req.ip || req.socket?.remoteAddress}`);
        return res.status(403).json({ error: 'Automated bot behavior detected.' });
    }

    getNextRoundRobinRep((assignedRep) => {
        const assignDate = getSydneyTime();
        
        // Dynamically accept lead source (Facebook, Insta, WhatsApp, etc.)
        const incomingSource = d.lead_source || 'Website';
        const incomingType = d.type_of_lead || 'Website Entry';

        const sql = `INSERT INTO leads (
            lead_entered_date, created_date, project_number, type_of_lead, first_name, last_name,
            phone_number, email_id_1, lead_source, status, assign_to, assign_date, lead_assign_by,
            salutation, quality_lead, phone_number_2, landline_number, email_id_2, lead_sub_category,
            google_address, street_type, lot_number, unit_number, address, suburb, state, postcode,
            area, message, dnd, email_unsubscribe, service, referral_project_number
        ) VALUES (?, '-', 'Pending Details', ?, ?, ?, ?, ?, ?, 'New Lead', ?, ?, 'Auto-Assign',
          '','No','','','','','','','','','','','','','','','No','No','No','')`;

        db.run(sql, [getSydneyTime(), incomingType, d.first_name, d.last_name, d.phone_number, d.email_id_1, incomingSource, assignedRep, assignDate], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            addHistory(newId, 'Created', `Lead entered from ${incomingSource}.`, 'System');
            addHistory(newId, 'Auto-Assigned', `Round Robin: Auto-Assigned to ${assignedRep}`, 'System');
            res.json({ id: newId, message: "Lead saved successfully.", assigned_to: assignedRep });
        });
    });
});

// ── MANUAL CREATE LEAD ─────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
    const d = req.body;
    const currentUser = d.currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
    const forceNew = d.forceNew === true || d.forceNew === 'true';

    db.get(
        "SELECT id FROM leads WHERE address = ? AND unit_number = ? AND suburb = ? AND status != 'Deleted'",
        [d.address, d.unit_number || '', d.suburb],
        (err, dup) => {
            if (dup && !forceNew) {
                insertLeadRecord('Pending Approval', 'Pending Approval', '-', '-', '-');
            } else {
                // If user is adding it manually, assign it to them directly.
                // This prevents the Round-Robin algorithm from distributing it again later.
                generateProjectNumber(d.service === 'Yes', (num) => {
                    insertLeadRecord(num, 'Planned', currentUser, getSydneyTime(), currentUser);
                });
            }
        }
    );

    function insertLeadRecord(projNum, statusStr, assignTo, assignDate, assignBy) {
        const enterDate = getSydneyTime();
        const createDate = projNum === 'Pending Approval' ? '-' : enterDate;

        const sql = `INSERT INTO leads (
          lead_entered_date, created_date, project_number, referral_project_number, type_of_lead, salutation, first_name, last_name, quality_lead,
          phone_number, phone_number_2, landline_number, email_id_1, email_id_2,
          lead_source, lead_sub_category, google_address, street_type,
          lot_number, unit_number, address, suburb, state, postcode,
          area, status, message, dnd, email_unsubscribe, service, assign_to, assign_date, lead_assign_by,
          system_size, stc_rebate, annual_savings, payback_period, co2_reduction
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

        const params = [
            enterDate, createDate, projNum, d.referral_project_number || '', d.type_of_lead || '', d.salutation || '', d.first_name || '', d.last_name || '', d.quality_lead || 'No',
            d.phone_number || '', d.phone_number_2 || '', d.landline_number || '', d.email_id_1 || '', d.email_id_2 || '',
            d.lead_source || '', d.lead_sub_category || '', d.google_address || '', d.street_type || '',
            d.lot_number || '', d.unit_number || '', d.address || '', d.suburb || '', d.state || '', d.postcode || '',
            d.area || '', statusStr, d.message || '', d.dnd || 'No', d.email_unsubscribe || 'No', d.service || 'No', assignTo, assignDate, assignBy,
            parseFloat(d.system_size) || 0,
            parseFloat(d.stc_rebate ? String(d.stc_rebate).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(d.annual_savings ? String(d.annual_savings).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(d.payback_period ? String(d.payback_period).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(d.co2_reduction ? String(d.co2_reduction).replace(/[^0-9.]/g, '') : 0) || 0
        ];

        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            const histMsg = projNum === 'Pending Approval'
                ? 'Lead marked as Pending Approval (duplicate address detected).'
                : `Lead manually created with Project #${projNum} and assigned to ${assignTo}.`;
            addHistory(newId, 'Created', histMsg, currentUser);
            res.json({ id: newId, project_number: projNum, assigned_to: assignTo, message: "Lead saved." });
        });
    }
});

// ── QUICK EDIT LEAD (INLINE CONTACT EDIT) ──────────────────
const handleQuickEdit = (req, res) => {
    const d = req.body;
    const id = req.params.id;
    const currentUser = (req.session && req.session.user) ? req.session.user.full_name || req.session.user.username : 'System';

    db.get("SELECT * FROM leads WHERE id = ?", [id], (err, oldRecord) => {
        if (err || !oldRecord) return res.status(500).json({ error: 'Lead not found' });

        const safeGet = (key, fallback = '') => d[key] !== undefined ? d[key] : (oldRecord[key] !== null ? oldRecord[key] : fallback);

        const sql = `UPDATE leads SET
          first_name=?, last_name=?, phone_number=?, phone_number_2=?, email_id_1=?,
          property_type=?, unit_number=?, lot_number=?, street_type=?, address=?, suburb=?, state=?, postcode=?
          WHERE id=?`;

        const params = [
            safeGet('first_name'), safeGet('last_name'), safeGet('phone_number'), safeGet('phone_number_2'), safeGet('email_id_1'),
            safeGet('property_type'), safeGet('unit_number'), safeGet('lot_number'), safeGet('street_type'), safeGet('address'), safeGet('suburb'), safeGet('state'), safeGet('postcode'),
            id
        ];

        db.run(sql, params, (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            
            let finalHistoryMsg = [];
            const fieldsToCheck = ['first_name', 'last_name', 'phone_number', 'phone_number_2', 'email_id_1', 'property_type', 'unit_number', 'lot_number', 'street_type', 'address', 'suburb', 'state', 'postcode'];
            fieldsToCheck.forEach(key => { const oldVal = oldRecord[key] || ''; const newVal = safeGet(key); if (oldVal !== newVal) { finalHistoryMsg.push(`${key}: "${oldVal}" -> "${newVal}"`); } });
            if (finalHistoryMsg.length > 0) addHistory(id, 'Quick Contact Edit', finalHistoryMsg.join(' | '), currentUser);
            
            res.json({ success: true, message: 'Contact updated successfully.' });
        });
    });
};

router.post('/update/:id', requireAuth, handleQuickEdit);
router.put('/update/:id', requireAuth, handleQuickEdit);

// ── EDIT LEAD ──────────────────────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
    const d = req.body;
    const currentUser = d.currentUser || 'System';
    const id = req.params.id;

    db.get("SELECT * FROM leads WHERE id = ?", [id], (err, oldRecord) => {
        if (err || !oldRecord) return res.status(500).json({ error: 'Lead not found' });

        const safeGet = (key, fallback = '') => d[key] !== undefined ? d[key] : (oldRecord[key] !== null ? oldRecord[key] : fallback);

        const projNum = d.project_number !== undefined ? d.project_number : oldRecord.project_number;
        let createdDateVal = oldRecord.created_date;
        if (projNum === 'Pending Approval' || projNum === 'Pending Details') {
            createdDateVal = '-';
        } else if (oldRecord.created_date === '-') {
            createdDateVal = getSydneyTime();
        }

        const sql = `UPDATE leads SET
          lead_entered_date=?, created_date=?, project_number=?, referral_project_number=?, type_of_lead=?, salutation=?, first_name=?, last_name=?, quality_lead=?,
          phone_number=?, phone_number_2=?, landline_number=?, email_id_1=?, email_id_2=?,
          lead_source=?, lead_sub_category=?, google_address=?, street_type=?,
          lot_number=?, unit_number=?, address=?, suburb=?, state=?, postcode=?,
          area=?, status=?, message=?, dnd=?, email_unsubscribe=?, service=?, assign_to=?, assign_date=?, lead_assign_by=?,
          system_size=?, stc_rebate=?, annual_savings=?, payback_period=?, co2_reduction=?
          WHERE id=?`;

        const params = [
            safeGet('lead_entered_date'), createdDateVal, projNum, safeGet('referral_project_number'), safeGet('type_of_lead'), safeGet('salutation'), safeGet('first_name'), safeGet('last_name'), safeGet('quality_lead', 'No'),
            safeGet('phone_number'), safeGet('phone_number_2'), safeGet('landline_number'), safeGet('email_id_1'), safeGet('email_id_2'),
            safeGet('lead_source'), safeGet('lead_sub_category'), safeGet('google_address'), safeGet('street_type'),
            safeGet('lot_number'), safeGet('unit_number'), safeGet('address'), safeGet('suburb'), safeGet('state'), safeGet('postcode'),
            safeGet('area'), safeGet('status', 'Planned'), safeGet('message'), safeGet('dnd', 'No'), safeGet('email_unsubscribe', 'No'), safeGet('service', 'No'), safeGet('assign_to', '-'), safeGet('assign_date'), safeGet('lead_assign_by'),
            parseFloat(safeGet('system_size')) || 0,
            parseFloat(safeGet('stc_rebate') ? String(safeGet('stc_rebate')).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(safeGet('annual_savings') ? String(safeGet('annual_savings')).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(safeGet('payback_period') ? String(safeGet('payback_period')).replace(/[^0-9.]/g, '') : 0) || 0,
            parseFloat(safeGet('co2_reduction') ? String(safeGet('co2_reduction')).replace(/[^0-9.]/g, '') : 0) || 0,
            id
        ];

        db.run(sql, params, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            let finalHistoryMsg = [];
            const fieldsToCheck = [
                'lead_entered_date', 'project_number', 'referral_project_number', 'type_of_lead', 'salutation', 
                'first_name', 'last_name', 'quality_lead', 'phone_number', 'phone_number_2', 'landline_number', 
                'email_id_1', 'email_id_2', 'lead_source', 'lead_sub_category', 'google_address', 'street_type', 
                'lot_number', 'unit_number', 'address', 'suburb', 'state', 'postcode', 'area', 'status', 
                'message', 'dnd', 'email_unsubscribe', 'service', 'assign_to',
                'system_size', 'stc_rebate', 'annual_savings', 'payback_period', 'co2_reduction'
            ];
            fieldsToCheck.forEach(key => {
                const oldVal = oldRecord[key] || '';
                const newVal = key === 'project_number' ? projNum : safeGet(key);
                if (String(oldVal) !== String(newVal)) {
                    finalHistoryMsg.push(`${key}: "${oldVal}" -> "${newVal}"`);
                }
            });
            if (finalHistoryMsg.length > 0) addHistory(id, 'Edited', finalHistoryMsg.join('  |  '), currentUser);
            res.json({ success: true });
        });
    });
});

// ── UPDATE ENGINEERING DETAILS ─────────────────────────────
router.put('/:id/engineering', requireAuth, (req, res) => {
    const d = req.body;
    const id = req.params.id;
    const currentUser = (req.session && req.session.user) ? req.session.user.full_name || req.session.user.username : 'System';

    // We store the engineering payload as a JSON string in engineering_details
    const payloadString = JSON.stringify(d);

    db.run("UPDATE leads SET engineering_details = ? WHERE id = ?", [payloadString, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        addHistory(id, 'Engineering Specs Updated', 'Engineering specifications and financial details were saved.', currentUser);
        
        if (d.is_create_installation) {
            // Logic to create installation if needed. Currently just logging.
            addHistory(id, 'Installation Created', 'Installation record initiated from engineering specs.', currentUser);
        }

        res.json({ success: true });
    });
});

// ── APPROVE PROJECT NUMBER ─────────────────────────────────
router.post('/:id/approve-project', requireManager, (req, res) => {
    generateProjectNumber(req.body.isService === 'Yes', (num) => {
        db.run("UPDATE leads SET project_number = ?, status = 'Planned', created_date = ? WHERE id = ?",
            [num, getSydneyTime(), req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                addHistory(req.params.id, 'Project Approved', `Project Number Assigned: ${num}`, req.body.currentUser);
                res.json({ success: true });
            });
    });
});

// ── RESTORE DELETED LEAD ───────────────────────────────────
router.post('/:id/restore', requireManager, (req, res) => {
    const { currentUser } = req.body;
    db.run("UPDATE leads SET status = 'Planned' WHERE id = ? AND status = 'Deleted'", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Lead not found or not deleted.' });
        addHistory(req.params.id, 'Restored', 'Manager restored the lead from Deleted state.', currentUser);
        res.json({ success: true });
    });
});

// ── REJECT DUPLICATE (Mark as Deleted) ────────────────────
router.post('/:id/reject-duplicate', requireManager, (req, res) => {
    const { currentUser } = req.body;
    db.run("UPDATE leads SET status = 'Deleted' WHERE id = ? AND (status = 'Duplicate' OR status = 'Pending Approval')", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Lead not found or already processed.' });
        
        addHistory(req.params.id, 'Duplicate Rejected', 'Manager rejected the duplicate lead request.', currentUser);
        db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
            [req.params.id, currentUser || 'System', 'Reject Duplicate', 'Duplicate Leads', 'Delete Leads[In]', 'Manager rejected the duplicate lead request.']);
        res.json({ success: true });
    });
});

// ── DELETE ACTION ──────────────────────────────────────────
router.post('/:id/delete-action', requireAuth, (req, res) => {
    const userRole = req.session && req.session.user ? req.session.user.role : '';
    const currentUser = (req.session && req.session.user ? req.session.user.full_name : null) || req.body.currentUser || 'System';
    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    if (isMgr) {
        db.run("UPDATE leads SET status = 'Deleted' WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(req.params.id, 'Deleted', 'Manager Soft Deleted the Lead.', currentUser);
            res.json({ success: true, deleted: true });
        });
    } else {
        db.run("UPDATE leads SET status = 'Pending Deletion' WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(req.params.id, 'Delete Request', 'User requested deletion.', currentUser);
            res.json({ success: true, requested: true });
        });
    }
});

// ── ASSIGN ─────────────────────────────────────────────────
router.post('/:id/assign', requireAuth, (req, res) => {
    const { assign_to, currentUser } = req.body;
    const userName = currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
    db.run("UPDATE leads SET assign_to = ?, assign_date = ?, lead_assign_by = ?, is_notified = 0 WHERE id = ?",
        [assign_to, getSydneyTime(), userName, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(req.params.id, 'Assigned', `Assigned to ${assign_to}`, userName);
            res.json({ success: true });
        });
});

// ── TRANSFER ───────────────────────────────────────────────
router.post('/:id/transfer', requireAuth, (req, res) => {
    const { transfer_to, transfer_notes, currentUser } = req.body;
    const userName = currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
    db.get("SELECT assign_to FROM leads WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const oldAssignee = (row && row.assign_to !== '-') ? row.assign_to : 'Unassigned';
        db.run("UPDATE leads SET assign_to = ?, assign_date = ?, lead_assign_by = ?, is_notified = 0 WHERE id = ?",
            [transfer_to, getSydneyTime(), userName, req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                addHistory(req.params.id, 'Transferred', `Transferred from ${oldAssignee} to ${transfer_to}. Reason: ${transfer_notes}`, userName);
                res.json({ success: true });
            });
    });
});

// ── BULK ASSIGN ────────────────────────────────────────────
router.post('/bulk-assign', requireAuth, (req, res) => {
    const { ids, assign_to, currentUser } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No leads selected" });
    const userName = currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE leads SET assign_to = ?, assign_date = ?, lead_assign_by = ?, is_notified = 0 WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)");
        const timeStr = getSydneyTime();

        ids.forEach(id => {
            stmt.run([assign_to, timeStr, userName, id]);
            histStmt.run([id, 'Bulk Assigned', `Bulk Assigned to ${assign_to}`, userName, timeStr]);
        });

        stmt.finalize();
        histStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Database transaction failed. Please try again.' });
            }
            res.json({ success: true });
        });
    });
});

// ── BULK STATUS ────────────────────────────────────────────
router.post('/bulk-status', requireAuth, (req, res) => {
    const { ids, status, currentUser } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No leads selected" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE leads SET status = ? WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)");
        const timeStr = getSydneyTime();

        ids.forEach(id => {
            stmt.run([status, id]);
            histStmt.run([id, 'Bulk Status Change', `Status changed to ${status}`, currentUser || 'System', timeStr]);
        });

        stmt.finalize();
        histStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Database transaction failed. Please try again.' });
            }
            res.json({ success: true });
        });
    });
});

// ── BULK DELETE ────────────────────────────────────────────
router.post('/bulk-delete', requireAuth, (req, res) => {
    const { ids, permanent } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No leads selected" });
    
    const userRole = req.session && req.session.user ? req.session.user.role : '';
    const currentUser = (req.session && req.session.user ? req.session.user.full_name : null) || req.body.currentUser || 'System';
    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    
    // Handle Permanent Deletion
    if (permanent && isMgr) {
        const placeholders = ids.map(() => '?').join(',');
        db.run(`DELETE FROM leads WHERE id IN (${placeholders})`, ids, function(err) {
            if (err) return res.status(500).json({ error: 'Failed to permanently delete leads' });
            // Delete related history to avoid orphan records
            db.run(`DELETE FROM lead_history WHERE lead_id IN (${placeholders})`, ids, () => {});
            db.run(`DELETE FROM activity_logs WHERE lead_id IN (${placeholders})`, ids, () => {});
            return res.json({ success: true, deleted: true });
        });
        return;
    }

    const newStatus = isMgr ? 'Deleted' : 'Pending Deletion';
    const action = isMgr ? 'Bulk Deleted' : 'Bulk Delete Request';
    const detail = isMgr ? 'Manager Bulk Soft Deleted.' : 'Bulk deletion requested.';

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE leads SET status = ? WHERE id = ?");
        const histStmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)");
        const timeStr = getSydneyTime();

        ids.forEach(id => {
            stmt.run([newStatus, id]);
            histStmt.run([id, action, detail, currentUser, timeStr]);
        });

        stmt.finalize();
        histStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Database transaction failed. Please try again.' });
            }
            res.json({ success: true });
        });
    });
});

// ── BULK UPLOAD ────────────────────────────────────────────
router.post('/bulk-upload', requireAuth, async (req, res) => {
    const { leads, currentUser } = req.body;
    if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: "Invalid payload" });

    const runQuery = (query, params) => new Promise((resolve, reject) => {
        db.run(query, params, function(err) { if(err) reject(err); else resolve(this.lastID); });
    });
    const getQuery = (query, params) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => { if(err) reject(err); else resolve(row); });
    });

    let imported = 0;
    try {
        await runQuery("BEGIN TRANSACTION", []);
        for (let l of leads) {
            const address = l['Address'] || l['address'] || '';
            const suburb = l['Suburb'] || l['suburb'] || '';
            const unit = l['Unit Number'] || l['Unit'] || l['unit_number'] || '';
            const lot = l['Lot Number'] || l['Lot'] || l['lot_number'] || '';
            const streetType = l['Street Type'] || l['street_type'] || '';
            const area = l['Area'] || l['area'] || '';
            const subCategory = l['Sub Category'] || l['lead_sub_category'] || '';

            if (!address && !l['First Name'] && !l['Phone Number']) continue; // Skip entirely empty rows

            const dup = await getQuery("SELECT id FROM leads WHERE address = ? AND unit_number = ? AND suburb = ? AND status != 'Deleted'", [address, unit, suburb]);
            const projNum = (dup && address && suburb) ? 'Pending Approval' : 'Pending Details';
            const enterDate = getSydneyTime();

            const newId = await runQuery(`INSERT INTO leads (
                lead_entered_date, created_date, project_number, type_of_lead, salutation, first_name, last_name,
                phone_number, email_id_1, unit_number, lot_number, street_type, address, suburb, state, postcode, area, status, assign_to, assign_date, lead_assign_by, message, lead_source, lead_sub_category
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
                enterDate, '-', projNum, l['Type of Lead'] || l['type_of_lead'] || 'Domestic', l['Salutation'] || '', l['First Name'] || l['first_name'] || '', l['Last Name'] || l['last_name'] || '',
                l['Phone Number'] || l['phone'] || '', l['Email ID'] || l['email'] || '', unit, lot, streetType, address, suburb, l['State'] || '', l['Postcode'] || '', area, 'New Lead', '-', '', '', l['Message'] || '', l['Lead Source'] || '', subCategory
            ]);

            imported++;
            await runQuery(`INSERT INTO lead_history (lead_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)`, [newId, 'Created', 'Lead imported via Excel Bulk Upload.', currentUser || 'System', enterDate]);
        }
        await runQuery("COMMIT", []);
        res.json({ success: true, imported });
    } catch (e) {
        await runQuery("ROLLBACK", []).catch(()=>{});
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;