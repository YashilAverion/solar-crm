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
    const userId = req.session.user.id;
    const db = require('./database/db');
    db.get(
        "SELECT access_status FROM user_permissions WHERE user_id = ? AND module_name = 'Settings' AND (feature_name = 'Manage Users' OR feature_name = 'Access Module')",
        [userId],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error in authorization middleware.' });
            if (row && row.access_status === 1) {
                return next();
            }
            return res.status(403).json({ error: 'Access Denied: Settings permissions not enabled.' });
        }
    );
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

// ── ERROR RESPONSE HELPER ─────────────────────────────────────
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
    if (isoStr.includes('(')) return isoStr;
    
    const d = new Date(isoStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoStr;
    
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