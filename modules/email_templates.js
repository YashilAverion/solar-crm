// ── modules/email_templates.js ────────────────────────────────────────────────
// Solar CRM — Email Templates Master API Module
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Helper to promisify DB queries
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

// Extract variable tags from text e.g. ["{customer_name}", "{project_number}"]
function extractVariables(text = '') {
    const matches = text.match(/\{[a-zA-Z0-9_]+\}/g) || [];
    return Array.from(new Set(matches));
}

// ── 1. GET ALL EMAIL TEMPLATES ─────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { category, active } = req.query;
        let sql = "SELECT * FROM email_templates WHERE 1=1";
        const params = [];

        if (category && category !== 'All') {
            sql += " AND category = ?";
            params.push(category);
        }
        if (active === '1') {
            sql += " AND is_active = 1";
        }

        sql += " ORDER BY is_default DESC, category ASC, template_name ASC";
        const templates = await dbAll(sql, params);

        // Parse variables_list JSON
        const formatted = templates.map(t => {
            let vars = [];
            try {
                vars = JSON.parse(t.variables_list || '[]');
            } catch (e) {
                vars = extractVariables(t.subject + ' ' + t.body);
            }
            return { ...t, variables_list: vars };
        });

        res.json({ success: true, count: formatted.length, data: formatted });
    } catch (err) {
        console.error('Error fetching email templates:', err.message);
        res.status(500).json({ error: 'Failed to fetch email templates.' });
    }
});

// ── 2. GET SINGLE EMAIL TEMPLATE ──────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const template = await dbGet("SELECT * FROM email_templates WHERE id = ?", [req.params.id]);
        if (!template) {
            return res.status(404).json({ error: 'Template not found.' });
        }
        let vars = [];
        try {
            vars = JSON.parse(template.variables_list || '[]');
        } catch (e) {
            vars = extractVariables(template.subject + ' ' + template.body);
        }
        res.json({ success: true, data: { ...template, variables_list: vars } });
    } catch (err) {
        console.error('Error fetching email template:', err.message);
        res.status(500).json({ error: 'Failed to fetch email template.' });
    }
});

// ── 3. CREATE NEW EMAIL TEMPLATE ──────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { template_name, category, subject, body, is_default, is_active } = req.body;

        if (!template_name || !subject || !body) {
            return res.status(400).json({ error: 'Missing required fields: template_name, subject, and body are required.' });
        }

        const cat = category || 'Custom';
        const def = is_default ? 1 : 0;
        const act = is_active !== undefined ? (is_active ? 1 : 0) : 1;

        // Extract variable placeholders
        const varsList = extractVariables(subject + ' ' + body);

        // If setting as default, clear other defaults in the same category
        if (def === 1) {
            await dbRun("UPDATE email_templates SET is_default = 0 WHERE category = ?", [cat]);
        }

        const result = await dbRun(
            `INSERT INTO email_templates (template_name, category, subject, body, variables_list, is_default, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [template_name.trim(), cat.trim(), subject.trim(), body.trim(), JSON.stringify(varsList), def, act]
        );

        res.json({ success: true, id: result.lastID, message: 'Email template created successfully.' });
    } catch (err) {
        console.error('Error creating email template:', err.message);
        res.status(500).json({ error: 'Failed to create email template.' });
    }
});

// ── 4. UPDATE EMAIL TEMPLATE ──────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { template_name, category, subject, body, is_default, is_active } = req.body;

        const existing = await dbGet("SELECT * FROM email_templates WHERE id = ?", [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Template not found.' });
        }

        const name = template_name !== undefined ? template_name.trim() : existing.template_name;
        const cat = category !== undefined ? category.trim() : existing.category;
        const subj = subject !== undefined ? subject.trim() : existing.subject;
        const bdy = body !== undefined ? body.trim() : existing.body;
        const def = is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default;
        const act = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

        const varsList = extractVariables(subj + ' ' + bdy);

        if (def === 1) {
            await dbRun("UPDATE email_templates SET is_default = 0 WHERE category = ? AND id != ?", [cat, id]);
        }

        await dbRun(
            `UPDATE email_templates
             SET template_name = ?, category = ?, subject = ?, body = ?, variables_list = ?, is_default = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, cat, subj, bdy, JSON.stringify(varsList), def, act, id]
        );

        res.json({ success: true, message: 'Email template updated successfully.' });
    } catch (err) {
        console.error('Error updating email template:', err.message);
        res.status(500).json({ error: 'Failed to update email template.' });
    }
});

// ── 5. DELETE EMAIL TEMPLATE ──────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await dbRun("DELETE FROM email_templates WHERE id = ?", [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Template not found.' });
        }
        res.json({ success: true, message: 'Email template deleted successfully.' });
    } catch (err) {
        console.error('Error deleting email template:', err.message);
        res.status(500).json({ error: 'Failed to delete email template.' });
    }
});

// ── 6. RENDER TEMPLATE WITH LEAD DATA ─────────────────────────
router.post('/render', async (req, res) => {
    try {
        const { templateId, leadId, customSubject, customBody } = req.body;

        let subject = customSubject || '';
        let body = customBody || '';

        if (templateId) {
            const tpl = await dbGet("SELECT subject, body FROM email_templates WHERE id = ?", [templateId]);
            if (tpl) {
                subject = tpl.subject;
                body = tpl.body;
            }
        }

        if (!leadId) {
            return res.json({ success: true, renderedSubject: subject, renderedBody: body });
        }

        // Fetch lead details
        const lead = await dbGet("SELECT * FROM leads WHERE id = ?", [leadId]);
        if (!lead) {
            return res.json({ success: true, renderedSubject: subject, renderedBody: body });
        }

        // Fetch rep details
        let repName = 'Ares Energy Sales Team';
        if (lead.assign_to) {
            const user = await dbGet("SELECT full_name, username FROM users WHERE username = ?", [lead.assign_to]);
            if (user) repName = user.full_name || user.username;
        }

        const customerName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim() || 'Valued Customer';
        const projectNo = lead.project_number || `AR${lead.id}`;
        const fullAddress = [lead.address || lead.street_address, lead.suburb, lead.state, lead.postcode].filter(Boolean).join(', ') || 'Your Property';
        
        let systemSize = 'Standard Solar System';
        if (lead.system_size_kw || lead.kw_size) {
            systemSize = `${lead.system_size_kw || lead.kw_size}kW Solar System`;
        }

        let totalPrice = '$0.00';
        if (lead.quotation_total_price || lead.total_price) {
            totalPrice = `$${Number(lead.quotation_total_price || lead.total_price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
        }

        const replacementMap = {
            '{customer_name}': customerName,
            '{first_name}': lead.first_name || 'Customer',
            '{last_name}': lead.last_name || '',
            '{project_number}': projectNo,
            '{address}': fullAddress,
            '{system_size}': systemSize,
            '{total_price}': totalPrice,
            '{sales_rep_name}': repName,
            '{company_phone}': '1300 717 583',
            '{company_email}': 'info@aresenergy.com.au'
        };

        let renderedSubject = subject;
        let renderedBody = body;

        Object.keys(replacementMap).forEach(key => {
            const val = replacementMap[key];
            const regex = new RegExp(key.replace(/[\{\}]/g, '\\$&'), 'g');
            renderedSubject = renderedSubject.replace(regex, val);
            renderedBody = renderedBody.replace(regex, val);
        });

        res.json({
            success: true,
            renderedSubject,
            renderedBody,
            variablesReplaced: Object.keys(replacementMap)
        });

    } catch (err) {
        console.error('Error rendering email template:', err.message);
        res.status(500).json({ error: 'Failed to render template.' });
    }
});

module.exports = router;
