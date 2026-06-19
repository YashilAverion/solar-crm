// ── helpers.js — Shared utilities for all Solar CRM modules ──────────────────
'use strict';

// ── TIME ──────────────────────────────────────────────────────
function getSydneyTime() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hh     = d.getHours();
    const min  = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${dd}-${mm}-${yyyy} (${String(hh).padStart(2, '0')}:${min} ${ampm})`;
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Login required' });
}

function requireManager(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Login required' });
    }
    const role = req.session.user.role || '';
    // Allow Admins, old 'Manager', or any new '* Manager'
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        return next();
    } else {
        return res.status(403).json({ error: 'Only managers can perform this action.' });
    }
}

// ── CURRENT USER ─────────────────────────────────────────────
function getCurrentUser(req) {
    if (req.session && req.session.user) return req.session.user.full_name || req.session.user.username;
    return req.body.currentUser || 'System';
}

// ── RESPONSE HELPERS (backward-compatible with existing frontend) ─────────────
function sendSuccess(res, data = {}, statusCode = 200) {
    return res.status(statusCode).json({ success: true, ...data });
}

function sendError(res, message, statusCode = 500) {
    console.error(`[CRM ERROR ${statusCode}] ${message}`);
    return res.status(statusCode).json({ error: message });
}

// ── PASSWORD VALIDATION ───────────────────────────────────────
function isStrongPassword(password) {
    if (!password || password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[!@#$%^&*]/.test(password)) return false;
    return true;
}

function getPasswordStrengthMessage() {
    return 'Password must contain: minimum 8 characters, one uppercase letter (A-Z), one lowercase letter (a-z), one number (0-9), and one special character (!@#$%^&*).';
}

// ── FIELD VALIDATION ──────────────────────────────────────────
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isValidPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
}

// ── SAFE JSON PARSE ───────────────────────────────────────────
function safeJsonParse(str, fallback = []) {
    try { return str ? JSON.parse(str) : fallback; }
    catch (e) { return fallback; }
}

// ── HISTORY LOGGER FACTORY ────────────────────────────────────
// Returns addHistory(id, action, details, userName) for tables with standard schema:
// (entityIdField INTEGER, action TEXT, details TEXT, user_name TEXT, created_at TEXT)
function makeHistoryLogger(db, tableName, entityIdField) {
    return function addHistory(entityId, action, details, userName) {
        db.run(
            `INSERT INTO ${tableName} (${entityIdField}, action, details, user_name, created_at) VALUES (?,?,?,?,?)`,
            [entityId, action, details, userName || 'System', getSydneyTime()]
        );
    };
}

// ── SYDNEY ISO DATE GENERATOR ──────────────────────────────────
function getSydneyISO() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    const ss   = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// ── ISO TO DISPLAY DATE FORMAT ─────────────────────────────────
function isoToDisplay(isoStr) {
    if (!isoStr || isoStr === '-' || isoStr === 'Pending' || isoStr === 'Pending Details') return isoStr;
    if (isoStr.includes('(')) return isoStr; // Already in display format
    
    const d = new Date(isoStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoStr; // Fallback
    
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hh     = d.getHours();
    const min  = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${dd}-${mm}-${yyyy} (${String(hh).padStart(2, '0')}:${min} ${ampm})`;
}

module.exports = {
    getSydneyTime,
    requireAuth,
    requireManager,
    getCurrentUser,
    sendSuccess,
    sendError,
    isStrongPassword,
    getPasswordStrengthMessage,
    isValidEmail,
    isValidPhone,
    safeJsonParse,
    makeHistoryLogger,
    getSydneyISO,
    isoToDisplay
};