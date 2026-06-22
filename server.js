// ============================================================
//  server.js  —  COMPLETE FIXED VERSION
//  LOCATION: Project ROOT folder (same as package.json)
//
//  STRUCTURE:
//  Project Root/
//    ├── server.js (this file)
//    ├── package.json
//    ├── package-lock.json
//    ├── solar_v2.db
//    ├── backup-manager.js
//    ├── create-admin.js
//    ├── helpers.js
//    ├── public/
//    │   ├── login.html
//    │   ├── index.html (Lead Master)
//    │   ├── products.html (Product Master)
//    │   ├── installations.html
//    │   ├── company_details.html
//    │   ├── installation_charges.html
//    │   ├── admin.html
//    │   └── uploads/ (file uploads directory)
//    ├── modules/
//    │   ├── leads.js
//    │   ├── products.js
//    │   ├── companies.js
//    │   ├── installations.js
//    │   ├── installation_charges.js
//    │   └── admin.js
//    └── database/
//        └── db.js
// ============================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const compression = require('compression');
const app = express();
const { Parser } = require('json2csv');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');
const { requireManager, isoToDisplay } = require('./helpers');


app.use(compression({ level: 6, threshold: 1024 })); // Compresses responses larger than 1KB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── GLOBAL SANITIZATION MIDDLEWARE ─────────────────────────
const sanitizeData = (data, ignoreKeys = [], context = { maliciousFound: false }) => {
    if (typeof data === 'string') {
        // Check for malicious tags before sanitizing
        if (/</.test(data) || />/.test(data)) {
            context.maliciousFound = true;
        }
        // Trim whitespace and escape < and > to prevent XSS script injection
        return data.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item, ignoreKeys, context));
    }
    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach(key => {
            if (!ignoreKeys.includes(key)) {
                data[key] = sanitizeData(data[key], ignoreKeys, context);
            }
        });
    }
    return data;
};

app.use((req, res, next) => {
    // Ignore fields that require special characters or represent stringified JSON arrays
    const ignoreList = ['password', 'equipment_details', 'certificate_details', 'child_products', 'dynamic_documents', 'margins'];
    const context = { maliciousFound: false };

    if (req.body) req.body = sanitizeData(req.body, ignoreList, context);
    if (req.query) req.query = sanitizeData(req.query, ignoreList, context);
    if (req.params) req.params = sanitizeData(req.params, ignoreList, context);

    // Log security warning if malicious data was intercepted and cleaned
    if (context.maliciousFound) {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const user = req.session && req.session.user ? req.session.user.username : 'Guest';
        console.warn(`[SECURITY ALERT] Malicious input sanitized! IP: ${ip} | User: ${user} | URL: ${req.originalUrl}`);
    }

    next();
});

// ── SECURITY HEADERS ───────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Disabled to prevent blocking your inline scripts and external CDNs
    crossOriginEmbedderPolicy: false
}));

// ── SESSION SETUP ──────────────────────────────────────────
app.set('trust proxy', 1); // Essential if hosting behind Nginx/Cloudflare for secure cookies

// Ensure database directory exists before initializing session store to prevent fatal boot crashes
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error("FATAL ERROR: SESSION_SECRET is not configured in production. Server exiting...");
    process.exit(1);
}

const sessionMiddleware = session({
    name: 'solarcrm_sid', // Obfuscates the tech stack from automated scanners
    store: new SQLiteStore({ db: 'solar_sessions.db', dir: './database' }),
    secret: process.env.SESSION_SECRET || 'solar-crm-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        secure: process.env.NODE_ENV === 'production', // true if HTTPS
        httpOnly: true,
        sameSite: 'strict' // Enhanced CSRF protection
    }
});
app.use(sessionMiddleware);

// ── LOGIN PAGE (PUBLIC) ────────────────────────────────────
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/home.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── LOGO (PUBLIC) ──────────────────────────────────────────
app.get('/ares_energy_logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ares_energy_logo.png'));
});

// ── RATE LIMITER FOR LOGIN ─────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // limit each IP to 5 login requests per windowMs
    message: { error: 'Too many login attempts from this IP. Please try again after 15 minutes.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ── LOGIN ACTION ───────────────────────────────────────────
app.post('/login', loginLimiter, [
    // Sanitize and Validate Inputs
    body('username').trim().escape().notEmpty().withMessage('Username is required.'),
    body('password').trim().notEmpty().withMessage('Password is required.')
], (req, res) => {
    // Honeypot Check: If the hidden 'website' field is filled, it's an automated bot.
    if (req.body.website) {
        console.warn(`[SECURITY ALERT] Honeypot triggered on login! IP: ${req.ip || req.socket.remoteAddress}`);
        return res.status(403).json({ error: 'Automated bot behavior detected.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

        if (user.status === 'Inactive' || user.status === 'Deleted') {
            return res.status(403).json({ error: 'Account disabled. Please contact the administrator.' });
        }

        // Secure password check using bcrypt
        bcrypt.compare(password, user.password, (err, match) => {
            if (!match) {
                // Auto-migrate: if stored password is plaintext (not a bcrypt hash), re-hash on first login
                const looksLikeHash = user.password && user.password.startsWith('$2');
                if (looksLikeHash || user.password !== password) {
                    return res.status(401).json({ error: 'Incorrect password.' });
                }
                // Plaintext matched — re-hash and save silently
                bcrypt.hash(password, 10, (hashErr, newHash) => {
                    if (!hashErr) {
                        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
                    }
                });
            }

            // Session Fixation Protection: Regenerate session ID on successful login
            req.session.regenerate((err) => {
                if (err) return res.status(500).json({ error: 'Session error during login.' });

                // Save to session
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    can_edit: user.can_edit,
                    can_delete: user.can_delete
                };

                res.json({
                    success: true,
                    full_name: user.full_name,
                    role: user.role,
                    username: user.username
                });
            });
        });
    });
});

// ── LOGOUT ─────────────────────────────────────────────────
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('solarcrm_sid'); // Explicitly instruct the browser to delete the cookie
        res.redirect('/login');
    });
});

// ── GET CURRENT USER (API) ────────────────────────────────
app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json(req.session.user);
});

// ── GET WORKSPACE ANALYTICS SUMMARY (API) ──────────────────
app.get('/api/analytics/summary', requireLogin, async (req, res) => {
    try {
        const safeDate = (col) => `date(${col})`;

        const getPipelineStats = () => {
            return new Promise((resolve, reject) => {
                db.all("SELECT status, COUNT(*) as count FROM leads WHERE is_deleted = 0 GROUP BY status", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const getOperationsStats = () => {
            return new Promise((resolve, reject) => {
                db.all("SELECT status, COUNT(*) as count, SUM(invoice_amount) as total_amount FROM installations GROUP BY status", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const getSalesRepPerformance = () => {
            return new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        assign_to as rep, 
                        COUNT(*) as total_leads,
                        SUM(CASE WHEN status = 'Closed Won' THEN 1 ELSE 0 END) as won_leads
                    FROM leads 
                    WHERE is_deleted = 0 AND assign_to IS NOT NULL AND assign_to != '-' AND assign_to != ''
                    GROUP BY assign_to
                    ORDER BY won_leads DESC, total_leads DESC
                    LIMIT 5
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const getMonthlyRevenueTrend = () => {
            return new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        strftime('%Y-%m', ${safeDate('created_date')}) as month, 
                        SUM(invoice_amount) as revenue
                    FROM installations
                    WHERE status != 'Cancelled' AND created_date IS NOT NULL AND created_date != '' AND created_date != '-'
                    GROUP BY month
                    ORDER BY month DESC
                    LIMIT 6
                `, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        };

        const [pipeline, operations, salesReps, monthlyRevenue] = await Promise.all([
            getPipelineStats(),
            getOperationsStats(),
            getSalesRepPerformance(),
            getMonthlyRevenueTrend()
        ]);

        res.json({
            success: true,
            pipeline,
            operations,
            salesReps,
            monthlyRevenue: monthlyRevenue.reverse()
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET SOLAR CALCULATOR RATES BY POSTCODE & STATE (API) ───
app.get('/api/calculator/rates', requireLogin, (req, res) => {
    const postcode = parseInt(req.query.postcode);
    const state = req.query.state;
    const propertyType = req.query.propertyType || 'Residential';

    if (!postcode && !state) {
        return res.status(400).json({ error: 'Postcode or State is required' });
    }

    db.get(
        "SELECT * FROM stc_master WHERE postcode = ? OR (state = ? AND (postcode IS NULL OR postcode = '')) LIMIT 1",
        [postcode, state],
        (err, stcRow) => {
            if (err) return res.status(500).json({ error: err.message });

            const zone = stcRow ? stcRow.zone : 3;
            const ratings = stcRow ? stcRow.ratings : 1.1;
            const deemingPeriod = stcRow ? stcRow.deeming_period : 9;

            db.get(
                "SELECT * FROM rebate_live_master_v2 WHERE (zone = ? OR state = ?) AND property_type = ? AND status = 'Active' LIMIT 1",
                [zone, state, propertyType],
                (err, rebateRow) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const liveRate = rebateRow ? rebateRow.live_rate : 38.0;
                    const adminCharges = rebateRow ? rebateRow.admin_charges : 1.5;
                    const actualRate = rebateRow ? rebateRow.actual_rate : (liveRate - adminCharges);

                    res.json({
                        success: true,
                        zone,
                        ratings,
                        deemingPeriod,
                        liveRate,
                        adminCharges,
                        actualRate
                    });
                }
            );
        }
    );
});

// ── PUBLIC CUSTOMER PROJECT TRACKING API ────────────────────
app.get('/api/customer/track/:project_number', (req, res) => {
    const projectNumber = req.params.project_number.trim();
    const phone = req.query.phone ? req.query.phone.trim() : '';

    if (!projectNumber || !phone) {
        return res.status(400).json({ error: 'Project Number and Phone Number are required.' });
    }

    // Clean phone input to do a loose match (removing spaces or country codes)
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    db.get(
        "SELECT * FROM leads WHERE project_number = ? AND is_deleted = 0",
        [projectNumber],
        (err, lead) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            if (!lead) return res.status(404).json({ error: 'Project not found.' });

            // Validate phone number loosely (checking if database phone contains clean input)
            const dbPhone = (lead.phone_number || '').replace(/[^0-9]/g, '');
            if (!dbPhone || (!dbPhone.endsWith(cleanPhone) && !cleanPhone.endsWith(dbPhone))) {
                return res.status(403).json({ error: 'Authentication failed. Phone number does not match.' });
            }

            // If phone matches, fetch installation status if available
            db.get(
                "SELECT * FROM installations WHERE project_number = ? LIMIT 1",
                [projectNumber],
                (err, inst) => {
                    // Let's determine progress steps
                    const steps = [
                        { name: 'Project Created', description: 'Lead converted to project. Preliminary design ready.', status: 'completed' },
                        { name: 'Engineering Approval', description: 'Grid connection approval requested & engineering checks completed.', status: 'pending' },
                        { name: 'STC Submission', description: 'STC rebate calculation and documentation processed.', status: 'pending' },
                        { name: 'Installation Scheduled', description: 'Installer assigned and equipment prepared.', status: 'pending' },
                        { name: 'Commissioning & Metering', description: 'System installed and meter commissioned.', status: 'pending' }
                    ];

                    const status = lead.status;

                    if (status === 'Planned') {
                        steps[0].status = 'completed';
                        steps[1].status = 'current';
                    } else if (status === 'In Progress') {
                        steps[0].status = 'completed';
                        steps[1].status = 'completed';
                        steps[2].status = 'completed';
                        steps[3].status = 'current';
                    } else if (status === 'Closed Won') {
                        steps[0].status = 'completed';
                        steps[1].status = 'completed';
                        steps[2].status = 'completed';
                        steps[3].status = 'completed';
                        steps[4].status = 'completed';
                    }

                    // Refine using installation record if it exists
                    if (inst) {
                        steps[1].status = 'completed';
                        steps[2].status = 'completed';

                        if (inst.status === 'Pending') {
                            steps[3].status = 'current';
                        } else if (inst.status === 'InProgress') {
                            steps[3].status = 'completed';
                            steps[4].status = 'current';
                        } else if (inst.status === 'Completed') {
                            steps[3].status = 'completed';
                            steps[4].status = 'completed';
                        }
                    }

                    res.json({
                        success: true,
                        project_number: lead.project_number,
                        customer_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                        status: lead.status,
                        property_type: lead.property_type,
                        system_size: lead.system_size || 0,
                        steps: steps,
                        updated_at: lead.updated_at
                    });
                }
            );
        }
    );
});

// Serve the Customer Tracker page publicly
app.get('/track.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});
app.get('/track', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// ── AUTH MIDDLEWARE ────────────────────────────────────────
function requireLogin(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    // Distinguish between browser HTML navigation and API fetch calls
    const isHtmlRequest = req.path.endsWith('.html') || req.path === '/' || (req.accepts('html') && !req.xhr && !req.path.startsWith('/api'));

    if (isHtmlRequest) {
        return res.redirect('/login');
    }

    // API request — return JSON
    return res.status(401).json({ error: 'Login required' });
}

// ── APPLY AUTH MIDDLEWARE ──────────────────────────────────
app.use(requireLogin);

// ── MICROSOFT OAUTH 2.0 ROUTES ──────────────────────────────
app.get('/auth/microsoft', (req, res) => {
    // Check if the user role is Admin (case-insensitive)
    if (!req.session.user || !req.session.user.role || req.session.user.role.toLowerCase() !== 'admin') {
        return res.status(403).send('Unauthorized: Only Admins can initiate Outlook linking.');
    }

    const targetUserId = req.query.target_user_id;
    if (!targetUserId) {
        return res.status(400).send('Bad Request: target_user_id parameter is required.');
    }

    // Save target user ID temporarily in session
    req.session.linking_user_id = targetUserId;

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).send('Configuration Error: Microsoft Client ID or Redirect URI is missing.');
    }

    const scope = encodeURIComponent('openid profile offline_access Mail.Send Mail.ReadWrite');
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=${targetUserId}`;

    res.redirect(authUrl);
});

app.get('/auth/microsoft/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Bad Request: Authorization code is missing.');
    }

    const linkingUserId = req.session.linking_user_id;
    if (!linkingUserId) {
        return res.status(400).send('Session Expired: target_user_id not found in session.');
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return res.status(500).send('Configuration Error: Microsoft OAuth credentials missing.');
    }

    try {
        // Exchange code for token
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', clientId);
        tokenParams.append('scope', 'openid profile offline_access Mail.Send Mail.ReadWrite');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('client_secret', clientSecret);

        const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', tokenParams, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        // Fetch Microsoft Graph profile to get primary email address
        const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const outlookEmail = profileResponse.data.mail || profileResponse.data.userPrincipalName;

        // Update target user's outlook credentials in SQLite database
        db.run(
            `UPDATE users SET outlook_email = ?, outlook_access_token = ?, outlook_refresh_token = ?, is_outlook_active = 1 WHERE id = ?`,
            [outlookEmail, access_token, refresh_token, linkingUserId],
            (dbErr) => {
                if (dbErr) {
                    console.error('Database update error in Microsoft OAuth callback:', dbErr);
                    return res.status(500).send('Database Error: Failed to update Outlook credentials.');
                }

                // Clear session linking variables
                delete req.session.linking_user_id;

                // Redirect Admin back to User Management page
                res.redirect('/admin.html');
            }
        );
    } catch (error) {
        console.error('Microsoft OAuth exchange error:', error.response ? error.response.data : error.message);
        res.status(500).send('Authentication Error: Failed to retrieve tokens from Microsoft.');
    }
});

// ── HELPER: REFRESH MICROSOFT OUTLOOK TOKEN ─────────────────
async function refreshOutlookToken(userId, refreshToken) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Microsoft OAuth configuration is missing.');
    }

    try {
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
        console.error('Failed to refresh Microsoft Outlook token:', error.response ? error.response.data : error.message);
        throw new Error('Token refresh failed.');
    }
}

// ── HELPER: GET VALID OUTLOOK ACCESS TOKEN ──────────────────
async function getOrRefreshOutlookToken(userId) {
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
                    // Check if current token is valid by hitting cheap endpoint
                    await axios.get('https://graph.microsoft.com/v1.0/me', {
                        headers: { Authorization: `Bearer ${row.outlook_access_token}` }
                    });
                    return resolve(row.outlook_access_token);
                } catch (apiErr) {
                    if (apiErr.response && apiErr.response.status === 401 && row.outlook_refresh_token) {
                        console.log(`Access token expired for user ${userId}. Refreshing...`);
                        try {
                            const newAccessToken = await refreshOutlookToken(userId, row.outlook_refresh_token);
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

// ── OUTLOOK EMAIL SENDING ROUTE ─────────────────────────────
app.post('/crm/send-email', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Login required' });
    }

    const userId = req.session.user.id;
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, and body are required.' });
    }

    try {
        const accessToken = await getOrRefreshOutlookToken(userId);

        const toRecipients = to.split(/[,;]/).map(email => ({
            emailAddress: { address: email.trim() }
        })).filter(r => r.emailAddress.address);

        if (toRecipients.length === 0) {
            return res.status(400).json({ error: 'No valid recipient email address provided.' });
        }

        const mailPayload = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: body
                },
                toRecipients: toRecipients
            },
            saveToSentItems: "true"
        };

        await axios.post('https://graph.microsoft.com/v1.0/me/sendMail', mailPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ success: true, message: 'Email sent successfully via Outlook.' });

    } catch (error) {
        console.error('Error sending email via Microsoft Graph API:', error.message);
        const errMsg = error.response && error.response.data && error.response.data.error 
            ? error.response.data.error.message 
            : error.message;
        res.status(500).json({ error: 'Failed to send email: ' + errMsg });
    }
});

// ── BLOCK DEPRECATED MODULES ───────────────────────────────
app.get('/my_leads.html', (req, res) => {
    res.redirect('/');
});

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// ── SERVE STATIC FILES (Protected) ─────────────────────────
app.use(express.static('public', {
    maxAge: '1d',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    }
})); // Browser will cache static files for 1 Day, except HTML files

// ── SERVE NEW UPLOADS FOLDER ───────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '7d' })); // Cache uploaded docs

// ── IMPORT ROUTE MODULES ───────────────────────────────────
const leadRoutes = require('./modules/leads');
const productRoutes = require('./modules/products');
const adminRoutes = require('./modules/admin');
const deployRoutes = require('./modules/deploy');
const companyRoutes = require('./modules/companies');
const installationRoutes = require('./modules/installations');
const chargesRoutes = require('./modules/installation_charges');
const stcMasterRoutes = require('./modules/stc_master');
const rebateLiveMasterRouter = require('./modules/rebate_live_master');
const marginMasterRoutes = require('./modules/margin_master');
const invoiceRoutes = require('./modules/invoice');
const comboRoutes = require('./modules/combos');
const attendanceRouter = require('./modules/attendance');
const payrollRoutes = require('./modules/payroll');
const quotationRoutes = require('./modules/quotations');

// ── PROJECT ID GENERATION MIDDLEWARE ───────────────────────
const handleProjectGeneration = (req, res, next) => {
    const leadId = req.params.id;
    const { first_name, phone_number, address, suburb, type_of_lead } = req.body;

    // If mandatory fields are provided, check project_number
    if (first_name && phone_number && address && suburb) {
        db.get("SELECT project_number, type_of_lead FROM leads WHERE id = ?", [leadId], (err, row) => {
            if (err) return next();

            if (!row || !row.project_number || row.project_number === 'Pending Details' || row.project_number === 'Pending Approval' || row.project_number.trim() === '') {
                const actualType = type_of_lead || (row ? row.type_of_lead : '');
                const prefix = (actualType === 'Service') ? 'ARMT' : 'AR';
                const userName = (req.session && req.session.user && req.session.user.full_name) ? req.session.user.full_name : 'System';

                const assignWithRetry = (attempt) => {
                    const prefixLen = prefix.length + 1;
                    const fetchSql = prefix === 'ARMT'
                        ? `SELECT project_number FROM leads WHERE project_number LIKE 'ARMT%' AND CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) DESC LIMIT 1`
                        : `SELECT project_number FROM leads WHERE project_number LIKE 'AR%' AND project_number NOT LIKE 'ARMT%' AND CAST(SUBSTR(project_number, 3) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, 3) AS INTEGER) DESC LIMIT 1`;

                    db.get(fetchSql, [], (err, row) => {
                        if (err) return next();

                        let nextNum = 1001;
                        if (row && row.project_number) {
                            const numStr = row.project_number.replace(prefix, "");
                            const num = parseInt(numStr, 10);
                            if (!isNaN(num) && num >= 1000) {
                                nextNum = num + 1;
                            }
                        }

                        const newProjectNo = prefix + nextNum;

                        const updateSql = `
                            UPDATE leads 
                            SET project_number = ?, status = 'Planned' 
                            WHERE id = ? 
                            AND (project_number IS NULL OR project_number = 'Pending Details' OR project_number = 'Pending Approval' OR trim(project_number) = '')
                        `;

                        db.run(updateSql, [newProjectNo, leadId], function (updateErr) {
                            // Concurrency Guard: If two requests grab the same ID, retry (up to 3 times)
                            if (updateErr && updateErr.message.includes('UNIQUE') && attempt <= 3) return assignWithRetry(attempt + 1);
                            if (!updateErr && this.changes > 0) {
                                req.body.status = 'Planned'; // Guarantee downstream routes respect the new state
                                db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?, ?, ?, ?)", [leadId, 'Project Generated', `Project number ${newProjectNo} auto-generated upon filling mandatory details. Status automatically changed to Planned.`, userName]);
                            }
                            next();
                        });
                    });
                };
                assignWithRetry(1);
            } else {
                next();
            }
        });
    } else {
        next();
    }
};
app.put('/leads/:id', handleProjectGeneration);
app.put('/api/leads/:id', handleProjectGeneration);

// ── ENSURE ACTIVITY LOGS TABLE EXISTS ──────────────────────
db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        user_name TEXT,
        action_type TEXT,
        from_module TEXT,
        to_module TEXT,
        timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
        details TEXT
    )
`);
db.run("ALTER TABLE leads ADD COLUMN approval_status TEXT DEFAULT 'None'", () => { });
db.run("ALTER TABLE leads ADD COLUMN delete_status TEXT DEFAULT 'None'", () => { });
db.run("ALTER TABLE leads ADD COLUMN property_type TEXT DEFAULT 'Residential'", () => { });
db.run("ALTER TABLE leads ADD COLUMN abn_number TEXT DEFAULT ''", () => { });
db.run("ALTER TABLE leads ADD COLUMN is_restored INTEGER DEFAULT 0", () => { });
db.run("ALTER TABLE leads ADD COLUMN engineering_details TEXT DEFAULT '{}'", () => { });
db.run("ALTER TABLE leads ADD COLUMN system_size REAL DEFAULT 0", () => { });
db.run("ALTER TABLE leads ADD COLUMN stc_rebate REAL DEFAULT 0", () => { });
db.run("ALTER TABLE leads ADD COLUMN annual_savings REAL DEFAULT 0", () => { });
db.run("ALTER TABLE leads ADD COLUMN payback_period REAL DEFAULT 0", () => { });
db.run("ALTER TABLE leads ADD COLUMN co2_reduction REAL DEFAULT 0", () => { });

// ── ENSURE MICROSOFT OUTLOOK COLUMNS IN USERS TABLE ─────────────
db.run("ALTER TABLE users ADD COLUMN outlook_email TEXT DEFAULT NULL", () => { });
db.run("ALTER TABLE users ADD COLUMN outlook_access_token TEXT DEFAULT NULL", () => { });
db.run("ALTER TABLE users ADD COLUMN outlook_refresh_token TEXT DEFAULT NULL", () => { });
db.run("ALTER TABLE users ADD COLUMN is_outlook_active INTEGER DEFAULT 0", () => { });

// ── LEADS API ROUTES ───────────────────────────────────────

// Master Leads: all non-deleted (Manager sees all statuses except Deleted)
app.get('/api/master-leads', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const sortParam = req.query.sort || 'id';
    const order = req.query.order && req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    // Whitelist allowed sort columns to prevent SQL Injection
    const allowedSortColumns = ['id', 'lead_entered_date', 'first_name', 'last_name', 'status', 'project_number', 'assign_to', 'created_date'];
    const safeSort = allowedSortColumns.includes(sortParam) ? sortParam : 'id';

    let query = "SELECT * FROM leads WHERE status != 'Deleted'";
    const params = [];
    query = applyAdvancedFilters(req, query, params);

    // Efficiently calculate the total number of filtered records
    let countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    query += ` ORDER BY ${safeSort} ${order} LIMIT ? OFFSET ?`;

    // Calculate global dashboard statistics for active leads
    const getSydneyDateStr = (offsetDays = 0) => {
        const d = new Date();
        if (offsetDays) d.setDate(d.getDate() + offsetDays);
        const sydneyLocaleStr = d.toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
        const sd = new Date(sydneyLocaleStr);
        const yyyy = sd.getFullYear();
        const mm = String(sd.getMonth() + 1).padStart(2, '0');
        const dd = String(sd.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = getSydneyDateStr(0);
    const sevenDaysAgoStr = getSydneyDateStr(-7);
    const safeDate = (col) => `date(${col})`;

    const statsSql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN ${safeDate('lead_entered_date')} = date(?) THEN 1 ELSE 0 END) as today,
            SUM(CASE WHEN assign_to IS NULL OR assign_to = '-' OR assign_to = '' THEN 1 ELSE 0 END) as unassigned,
            SUM(CASE WHEN ${safeDate('lead_entered_date')} < date(?) THEN 1 ELSE 0 END) as overdue
        FROM leads 
        WHERE status != 'Deleted'
    `;

    db.get(statsSql, [todayStr, sevenDaysAgoStr], (err, statsRow) => {
        const stats = statsRow || { total: 0, today: 0, unassigned: 0, overdue: 0 };

        db.get(countQuery, params, (err, countRow) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            const total = countRow ? countRow.total : 0;

            db.all(query, [...params, limit, offset], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Database error.' });
                const formatted = (rows || []).map(r => {
                    r.lead_entered_date = isoToDisplay(r.lead_entered_date);
                    r.created_date = isoToDisplay(r.created_date);
                    return r;
                });
                res.json({ data: formatted, total: total, page: page, limit: limit, stats: stats });
            });
        });
    });
});

// ── EXPORT LEADS TO CSV (Excel) ────────────────────────────
app.get('/api/leads/export', (req, res) => {
    let query = "SELECT * FROM leads WHERE status != 'Deleted'";
    const params = [];
    // Reuse the exact same filtering logic as the main table
    query = applyAdvancedFilters(req, query, params);
    query += " ORDER BY id DESC";

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).send("Error fetching data for export.");
        }
        if (!rows || rows.length === 0) {
            return res.status(404).send("<html><body><h2>No leads found matching the current filters.</h2><p>Please go back and adjust your filters.</p></body></html>");
        }

        // Define the columns for the CSV file. You can customize this list.
        const fields = [
            'project_number', 'status', 'first_name', 'last_name', 'phone_number', 'email_id_1',
            'address', 'suburb', 'state', 'postcode', 'lead_source', 'assign_to', 'lead_entered_date',
            'created_date', 'message', 'property_type', 'abn_number'
        ];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);

        const dateStr = new Date().toISOString().split('T')[0];
        res.header('Content-Type', 'text/csv');
        res.attachment(`Ares_Leads_Export_${dateStr}.csv`);
        res.send(csv);
    });
});

// Delete Leads: In/Out tracking (Manager only)
app.get('/api/leads/deleted', (req, res) => {
    const tab = req.query.tab || 'in';
    let query = "";
    const params = [];
    if (tab === 'out') {
        query = "SELECT * FROM leads WHERE delete_status = 'Restored'";
    } else {
        query = "SELECT * FROM leads WHERE status = 'Deleted'";
    }
    query = applyAdvancedFilters(req, query, params);
    query += " ORDER BY id DESC";
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        const formatted = (rows || []).map(r => {
            r.lead_entered_date = isoToDisplay(r.lead_entered_date);
            r.created_date = isoToDisplay(r.created_date);
            return r;
        });
        res.json(formatted);
    });
});

// Duplicate Leads: In/Out tracking
app.get('/api/leads/duplicates', (req, res) => {
    const tab = req.query.tab || 'in';
    let query = "";
    const params = [];
    if (tab === 'out') {
        query = "SELECT * FROM leads WHERE approval_status = 'Approved'";
    } else {
        query = "SELECT * FROM leads WHERE (status = 'Duplicate' OR status = 'Pending Approval' OR project_number = 'Pending Approval') AND (approval_status = 'Pending' OR approval_status IS NULL OR approval_status = 'None')";
    }
    query = applyAdvancedFilters(req, query, params);
    query += " ORDER BY id DESC";
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        const formatted = (rows || []).map(r => {
            r.lead_entered_date = isoToDisplay(r.lead_entered_date);
            r.created_date = isoToDisplay(r.created_date);
            return r;
        });
        res.json(formatted);
    });
});

// ── PROJECT LEADS ──────────────────────────────────────────
// Leads that have been converted into active projects (have a valid project_number)
app.get('/api/project-leads', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const sortParam = req.query.sort || 'id';
    const order = req.query.order && req.query.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    // Whitelist allowed sort columns to prevent SQL Injection
    const allowedSortColumns = ['id', 'lead_entered_date', 'first_name', 'last_name', 'status', 'project_number', 'assign_to', 'created_date'];
    const safeSort = allowedSortColumns.includes(sortParam) ? sortParam : 'id';

    let query = "SELECT * FROM leads WHERE status != 'Deleted' AND project_number IS NOT NULL AND project_number NOT IN ('Pending Details', 'Pending Approval', '')";
    const params = [];
    query = applyAdvancedFilters(req, query, params);

    // Count query
    let countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    query += ` ORDER BY ${safeSort} ${order} LIMIT ? OFFSET ?`;

    // Calculate global stats for project pipeline
    const statsSql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Planned' THEN 1 ELSE 0 END) as planned,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inprogress,
            SUM(CASE WHEN status = 'Closed Won' THEN 1 ELSE 0 END) as won
        FROM leads 
        WHERE status != 'Deleted' AND project_number IS NOT NULL AND project_number NOT IN ('Pending Details', 'Pending Approval', '')
    `;

    db.get(statsSql, [], (err, statsRow) => {
        const stats = statsRow || { total: 0, planned: 0, inprogress: 0, won: 0 };

        db.get(countQuery, params, (err, countRow) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            const total = countRow ? countRow.total : 0;

            db.all(query, [...params, limit, offset], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Database error.' });
                const formatted = (rows || []).map(r => {
                    r.lead_entered_date = isoToDisplay(r.lead_entered_date);
                    r.created_date = isoToDisplay(r.created_date);
                    return r;
                });
                res.json({ data: formatted, total: total, page: page, limit: limit, stats: stats });
            });
        });
    });
});

// ── PROJECT DETAILS BY ID ──────────────────────────────────
app.get('/api/projects/details/:id', (req, res) => {
    const projectId = req.params.id;

    if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
    }

    db.get("SELECT * FROM leads WHERE id = ?", [projectId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching project details." });
        }
        if (!row) {
            return res.status(404).json({ error: "Project not found" });
        }

        row.lead_entered_date = isoToDisplay(row.lead_entered_date);
        row.created_date = isoToDisplay(row.created_date);

        if (row.engineering_details) {
            try {
                const engData = JSON.parse(row.engineering_details);
                Object.assign(row, engData);
            } catch (e) { }
        }
        res.json(row);
    });
});

// ── GLOBAL OMNIBOX CROSS-MODULE SEARCH ─────────────────────
app.get('/api/projects/global-search', (req, res) => {
    const q = req.query.q || '';
    if (!q) return res.json([]);
    const s = `%${q}%`;
    const query = `
        SELECT id, project_number, first_name, last_name, phone_number, address 
        FROM leads 
        WHERE status != 'Deleted' AND (
            project_number LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR 
            phone_number LIKE ? OR email_id_1 LIKE ? OR address LIKE ?
        )
        ORDER BY id DESC LIMIT 15
    `;
    db.all(query, [s, s, s, s, s, s], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows || []);
    });
});

// ── UPDATE PROJECT SALES NOTES ─────────────────────────────
app.put('/api/projects/details/:id/notes', (req, res) => {
    const { sales_input_notes } = req.body;
    db.run("UPDATE leads SET sales_input_notes = ? WHERE id = ?", [sales_input_notes, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ── QUICK EDIT ROUTE FORWARDING ────────────────────────────
app.post('/api/leads/update/:id', (req, res, next) => {
    req.url = `/update/${req.params.id}`;
    leadRoutes(req, res, next);
});
app.put('/api/leads/update/:id', (req, res, next) => {
    req.url = `/update/${req.params.id}`;
    leadRoutes(req, res, next);
});

// Take Approval: Save a duplicate lead as Pending Approval
app.post('/api/leads/take-approval', (req, res) => {
    const d = req.body;

    if (!d.first_name || !d.phone_number || !d.address || !d.suburb) {
        return res.status(400).json({ error: 'Mandatory fields are required.' });
    }

    const userName = (req.session && req.session.user && req.session.user.full_name) ? req.session.user.full_name : 'System';

    if (d.edit_id) {
        // UPDATE Existing Lead to Duplicate Status
        const updateSql = `
            UPDATE leads SET
                referral_project_number=?, type_of_lead=?, salutation=?, first_name=?, last_name=?, quality_lead=?,
                phone_number=?, phone_number_2=?, landline_number=?, email_id_1=?, email_id_2=?,
                lead_source=?, lead_sub_category=?, google_address=?, street_type=?,
                lot_number=?, unit_number=?, address=?, suburb=?, state=?, postcode=?,
                area=?, status='Duplicate', approval_status='Pending', message=?, dnd=?, email_unsubscribe=?, service=?, property_type=?, abn_number=?,
                project_number='Pending Approval'
            WHERE id=?
        `;
        const params = [
            d.referral_project_number || '', d.type_of_lead || '', d.salutation || '', d.first_name || '', d.last_name || '', d.quality_lead || 'No',
            d.phone_number || '', d.phone_number_2 || '', d.landline_number || '', d.email_id_1 || '', d.email_id_2 || '',
            d.lead_source || '', d.lead_sub_category || '', d.google_address || '', d.street_type || '',
            d.lot_number || '', d.unit_number || '', d.address || '', d.suburb || '', d.state || '', d.postcode || '',
            d.area || '', d.message || '', d.dnd || 'No', d.email_unsubscribe || 'No', d.service || 'No', d.property_type || 'Residential', d.abn_number || '',
            d.edit_id
        ];
        db.run(updateSql, params, function (err) {
            if (err) return res.status(500).json({ error: 'Failed to submit for approval: ' + err.message });
            db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?, ?, ?, ?)",
                [d.edit_id, 'Approval Requested', 'Existing lead updated and submitted for duplicate approval.', userName]);
            db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
                [d.edit_id, userName, 'Request Approval', 'Edit Lead', 'Duplicate Leads', 'Existing lead submitted for duplicate approval.']);
            res.json({ success: true, lead_id: d.edit_id, message: 'Lead submitted for approval.' });
        });
    } else {
        // INSERT New Lead as Duplicate Status
        const insertSql = `
        INSERT INTO leads (
            lead_entered_date, created_date, project_number, referral_project_number, type_of_lead, salutation, first_name, last_name, quality_lead,
            phone_number, phone_number_2, landline_number, email_id_1, email_id_2,
            lead_source, lead_sub_category, google_address, street_type,
            lot_number, unit_number, address, suburb, state, postcode,
            area, status, approval_status, message, dnd, email_unsubscribe, service, assign_to, lead_assign_by, property_type, abn_number
        ) VALUES (datetime('now', 'localtime'), '-', 'Pending Approval', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Duplicate', 'Pending', ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const params = [
            d.referral_project_number || '', d.type_of_lead || '', d.salutation || '', d.first_name || '', d.last_name || '', d.quality_lead || 'No',
            d.phone_number || '', d.phone_number_2 || '', d.landline_number || '', d.email_id_1 || '', d.email_id_2 || '',
            d.lead_source || '', d.lead_sub_category || '', d.google_address || '', d.street_type || '',
            d.lot_number || '', d.unit_number || '', d.address || '', d.suburb || '', d.state || '', d.postcode || '',
            d.area || '', d.message || '', d.dnd || 'No', d.email_unsubscribe || 'No', d.service || 'No', userName, userName, d.property_type || 'Residential', d.abn_number || ''
        ];

        db.run(insertSql, params, function (err) {
            if (err) return res.status(500).json({ error: 'Failed to submit for approval: ' + err.message });
            const leadId = this.lastID;
            db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?, ?, ?, ?)",
                [leadId, 'Approval Requested', 'Lead submitted for duplicate approval.', userName]);
            db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
                [leadId, userName, 'Request Approval', 'Add Lead', 'Duplicate Leads', 'Lead submitted for duplicate approval.']);
            res.json({ success: true, lead_id: leadId, message: 'Lead submitted for approval.' });
        });
    }
});

// Approve Duplicate Endpoint
app.post('/api/leads/:id/approve-duplicate', (req, res) => {
    const leadId = req.params.id;
    const userName = req.body.currentUser || ((req.session && req.session.user && req.session.user.full_name) ? req.session.user.full_name : 'System');

    db.get("SELECT type_of_lead FROM leads WHERE id = ?", [leadId], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Database error.' });
        const prefix = (row.type_of_lead === 'Service') ? 'ARMT' : 'AR';
        const prefixLen = prefix.length + 1;
        const fetchSql = prefix === 'ARMT'
            ? `SELECT project_number FROM leads WHERE project_number LIKE 'ARMT%' AND CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, ${prefixLen}) AS INTEGER) DESC LIMIT 1`
            : `SELECT project_number FROM leads WHERE project_number LIKE 'AR%' AND project_number NOT LIKE 'ARMT%' AND CAST(SUBSTR(project_number, 3) AS INTEGER) > 0 ORDER BY CAST(SUBSTR(project_number, 3) AS INTEGER) DESC LIMIT 1`;

        db.get(fetchSql, [], (err, maxRow) => {
            let nextNum = 1001;
            if (!err && maxRow && maxRow.project_number) {
                const numStr = maxRow.project_number.replace(prefix, "");
                const num = parseInt(numStr, 10);
                if (!isNaN(num) && num >= 1000) {
                    nextNum = num + 1;
                }
            }
            const newProjectNo = prefix + nextNum;

            db.run("UPDATE leads SET project_number = ?, status = 'Planned', approval_status = 'Approved', created_date = datetime('now', 'localtime') WHERE id = ?", [newProjectNo, leadId], function (err) {
                if (err) return res.status(500).json({ error: 'Database error.' });
                db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?, ?, ?, ?)", [leadId, 'Duplicate Approved', `Manager approved duplicate. New Project Number assigned: ${newProjectNo}.`, userName]);
                db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)", [leadId, userName, 'Approve Duplicate', 'Duplicate Leads', 'Master Leads', `Manager approved duplicate lead. Assigned: ${newProjectNo}`]);
                res.json({ success: true, project_number: newProjectNo });
            });
        });
    });
});

// GET Lead deletion approval requests
app.get('/api/leads/approvals', requireManager, (req, res) => {
    let query = "SELECT * FROM leads WHERE status = 'Pending Deletion'";
    const params = [];
    query = applyAdvancedFilters(req, query, params);
    query += " ORDER BY id DESC";
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        const formatted = (rows || []).map(r => {
            r.lead_entered_date = isoToDisplay(r.lead_entered_date);
            r.created_date = isoToDisplay(r.created_date);
            return r;
        });
        res.json(formatted);
    });
});

// POST Approve or Decline lead deletion requests
app.post('/api/leads/approve-decline', requireManager, (req, res) => {
    const { ids, actionType } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No leads selected" });
    }
    if (actionType !== 'approve' && actionType !== 'decline') {
        return res.status(400).json({ error: "Invalid action type" });
    }

    const userName = (req.session && req.session.user && req.session.user.full_name) ? req.session.user.full_name : 'System';
    const placeholders = ids.map(() => '?').join(',');

    if (actionType === 'approve') {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run(`UPDATE leads SET status = 'Deleted', delete_status = 'Deleted' WHERE id IN (${placeholders})`, ids, function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Database error.' });
                }
                const stmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?,?,?,?)");
                const logStmt = db.prepare("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?,?,?,?,?,?)");
                ids.forEach(id => {
                    stmt.run(id, 'Deletion Approved', 'Manager approved lead deletion request.', userName);
                    logStmt.run(id, userName, 'Approve Delete', 'Lead Approvals', 'Delete Leads[In]', 'Manager approved deletion request.');
                });
                stmt.finalize();
                logStmt.finalize();
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Transaction commit failed' });
                    }
                    res.json({ success: true });
                });
            });
        });
    } else {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run(`UPDATE leads SET status = 'Planned', delete_status = 'Restored' WHERE id IN (${placeholders})`, ids, function (err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Database error.' });
                }
                const stmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?,?,?,?)");
                const logStmt = db.prepare("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?,?,?,?,?,?)");
                ids.forEach(id => {
                    stmt.run(id, 'Deletion Declined', 'Manager declined lead deletion request.', userName);
                    logStmt.run(id, userName, 'Decline Delete', 'Lead Approvals', 'Master Leads', 'Manager declined deletion request.');
                });
                stmt.finalize();
                logStmt.finalize();
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Transaction commit failed' });
                    }
                    res.json({ success: true });
                });
            });
        });
    }
});

// Restore Lead
app.post('/api/leads/:id/restore', (req, res) => {
    const leadId = req.params.id;
    const userName = req.body.currentUser || ((req.session && req.session.user && req.session.user.full_name) ? req.session.user.full_name : 'System');
    db.run("UPDATE leads SET status = 'Planned', delete_status = 'Restored' WHERE id = ?", [leadId], function (err) {
        if (err) return res.status(500).json({ error: 'Database error.' });
        db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?, ?, ?, ?)",
            [leadId, 'Restored', 'Manager restored the lead from Deleted state.', userName]);
        db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
            [leadId, userName, 'Restore Lead', 'Delete Leads[In]', 'Master Leads', 'Lead restored to active status.']);
        res.json({ success: true });
    });
});

// Get Activity Logs
app.get('/api/leads/:id/activity_logs', (req, res) => {
    db.all("SELECT * FROM activity_logs WHERE lead_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows || []);
    });
});

// Delete a lead (soft delete — uses status field, role-aware)
app.delete('/api/leads/:id', (req, res) => {
    const leadId = req.params.id;
    const { role, currentUser } = req.body;
    const userName = currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
    const userRole = role || (req.session && req.session.user ? req.session.user.role : '');

    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    if (isMgr) {
        db.run("UPDATE leads SET status = 'Deleted', delete_status = 'Deleted' WHERE id = ?", [leadId], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to delete lead' });
            db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?,?,?,?)",
                [leadId, 'Lead Deleted', 'Manager soft deleted the lead.', userName]);
            db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
                [leadId, userName, 'Soft Delete', 'Master Leads', 'Delete Leads[In]', 'Manager soft deleted the lead.']);
            res.json({ success: true, deleted: true });
        });
    } else {
        db.run("UPDATE leads SET status = 'Pending Deletion', delete_status = 'Deleted' WHERE id = ?", [leadId], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to request deletion' });
            db.run("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?,?,?,?)",
                [leadId, 'Delete Request', 'User requested deletion approval.', userName]);
            db.run("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?, ?, ?, ?, ?, ?)",
                [leadId, userName, 'Delete Request', 'Master Leads', 'Lead Approvals', 'User requested deletion approval.']);
            res.json({ success: true, requested: true });
        });
    }
});

// Bulk delete (role-aware)
app.post('/api/leads/bulk-delete', (req, res) => {
    const { ids, role, currentUser, permanent } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No ids provided' });

    const userRole = role || (req.session && req.session.user ? req.session.user.role : '');
    const isMgr = userRole === 'Admin' || userRole === 'Manager' || (userRole && userRole.includes('Manager'));
    const userName = currentUser || (req.session && req.session.user ? req.session.user.full_name : 'System');
    const placeholders = ids.map(() => '?').join(',');

    // Handle Permanent Deletion
    if (permanent && isMgr) {
        db.run(`DELETE FROM leads WHERE id IN (${placeholders})`, ids, function (err) {
            if (err) return res.status(500).json({ error: 'Failed to permanently delete leads' });
            // Delete related history and activity logs to avoid orphan records
            db.run(`DELETE FROM lead_history WHERE lead_id IN (${placeholders})`, ids, () => { });
            db.run(`DELETE FROM activity_logs WHERE lead_id IN (${placeholders})`, ids, () => { });
            res.json({ success: true, deleted: true });
        });
        return;
    }

    const newStatus = isMgr ? 'Deleted' : 'Pending Deletion';
    const action = isMgr ? 'Bulk Deleted' : 'Bulk Delete Request';
    const detail = isMgr ? 'Manager bulk soft deleted.' : 'Bulk deletion requested.';

    db.run(`UPDATE leads SET status = ?, delete_status = 'Deleted' WHERE id IN (${placeholders})`, [newStatus, ...ids], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete leads' });
        const stmt = db.prepare("INSERT INTO lead_history (lead_id, action, details, user_name) VALUES (?,?,?,?)");
        const logStmt = db.prepare("INSERT INTO activity_logs (lead_id, user_name, action_type, from_module, to_module, details) VALUES (?,?,?,?,?,?)");
        ids.forEach(id => {
            stmt.run(id, action, detail, userName);
            logStmt.run(id, userName, action, 'Master Leads', 'Delete Leads[In]', detail);
        });
        stmt.finalize();
        logStmt.finalize();
        res.json({ success: true });
    });
});

// ── UNNOTIFIED LEADS (POPUP POLLING) ───────────────────────
app.get('/api/leads/unnotified', (req, res) => {
    if (!req.session || !req.session.user) return res.json([]);
    const userName = req.session.user.full_name || req.session.user.username;

    db.all("SELECT id, first_name, last_name, project_number FROM leads WHERE assign_to = ? AND is_notified = 0 AND status != 'Deleted'", [userName], (err, rows) => {
        if (err || !rows || rows.length === 0) return res.json([]);

        // Alert bhejte hi unko 'Notified' mark kar do taaki dobara popup na aaye
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        db.run(`UPDATE leads SET is_notified = 1 WHERE id IN (${placeholders})`, ids, () => {
            res.json(rows);
        });
    });
});

// ── MOUNT ROUTES ───────────────────────────────────────────
app.use('/leads', leadRoutes);
app.use('/products', productRoutes);
app.use('/admin', adminRoutes);
app.use('/admin', deployRoutes);
app.use('/companies', companyRoutes);
app.use('/installations', installationRoutes);
app.use('/api/masters/installation-charges', chargesRoutes);
app.use('/stc-master', stcMasterRoutes);
app.use('/api/rebate_live_master', rebateLiveMasterRouter);
app.use('/margin-master', marginMasterRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/combos', comboRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/payroll', payrollRoutes);
app.use('/api/quotations', quotationRoutes);

const applyAdvancedFilters = (req, baseQuery, params) => {
    let query = baseQuery;

    const getSydneyDateStr = (offsetDays = 0) => {
        const d = new Date();
        if (offsetDays) d.setDate(d.getDate() + offsetDays);
        const sydneyLocaleStr = d.toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
        const sd = new Date(sydneyLocaleStr);
        const yyyy = sd.getFullYear();
        const mm = String(sd.getMonth() + 1).padStart(2, '0');
        const dd = String(sd.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const safeDate = (col) => `date(${col})`;

    if (req.query.search) {
        query += " AND (first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ? OR email_id_1 LIKE ? OR project_number LIKE ? OR status LIKE ?)";
        const searchTerm = `%${req.query.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (req.query.property_type) { query += " AND property_type = ?"; params.push(req.query.property_type); }
    if (req.query.status) { query += " AND status = ?"; params.push(req.query.status); }
    if (req.query.type) { query += " AND type_of_lead = ?"; params.push(req.query.type); }
    if (req.query.source) { query += " AND lead_source = ?"; params.push(req.query.source); }
    if (req.query.subCat) { query += " AND LOWER(lead_sub_category) LIKE ?"; params.push(`%${req.query.subCat.toLowerCase()}%`); }
    if (req.query.assignTo) { query += " AND assign_to = ?"; params.push(req.query.assignTo); }
    if (req.query.assignBy) { query += " AND LOWER(lead_assign_by) LIKE ?"; params.push(`%${req.query.assignBy.toLowerCase()}%`); }
    if (req.query.unassigned === 'Yes') { query += " AND (assign_to IS NULL OR assign_to = '-')"; }
    if (req.query.unassigned === 'No') { query += " AND assign_to IS NOT NULL AND assign_to != '-'"; }
    if (req.query.state) { query += " AND LOWER(state) = LOWER(?)"; params.push(req.query.state); }
    if (req.query.area) { query += " AND area = ?"; params.push(req.query.area); }

    // Active Filter Chip integration
    if (req.query.chip) {
        const chip = req.query.chip;
        const todayStr = getSydneyDateStr(0);
        const threeDaysAgoStr = getSydneyDateStr(-3);
        const sevenDaysAgoStr = getSydneyDateStr(-7);

        if (chip === 'today') {
            query += ` AND ${safeDate('lead_entered_date')} = date(?)`;
            params.push(todayStr);
        } else if (chip === 'fresh') {
            query += ` AND ${safeDate('lead_entered_date')} >= date(?) AND ${safeDate('lead_entered_date')} < date(?)`;
            params.push(threeDaysAgoStr, todayStr);
        } else if (chip === 'follow') {
            query += ` AND ${safeDate('lead_entered_date')} >= date(?) AND ${safeDate('lead_entered_date')} < date(?)`;
            params.push(sevenDaysAgoStr, threeDaysAgoStr);
        } else if (chip === 'overdue') {
            query += ` AND ${safeDate('lead_entered_date')} < date(?)`;
            params.push(sevenDaysAgoStr);
        } else if (chip === 'pending') {
            query += " AND (status = 'Pending Approval' OR status = 'Pending Deletion')";
        } else if (chip === 'planned') {
            query += " AND status = 'Planned'";
        } else if (chip === 'inprogress') {
            query += " AND status = 'In Progress'";
        } else if (chip === 'won') {
            query += " AND status = 'Closed Won'";
        } else if (chip === 'unassigned') {
            query += " AND (assign_to IS NULL OR assign_to = '-' OR assign_to = '')";
        }
    }

    if (req.query.enterFrom) { query += ` AND ${safeDate('lead_entered_date')} >= date(?)`; params.push(req.query.enterFrom); }
    if (req.query.enterTo) { query += ` AND ${safeDate('lead_entered_date')} <= date(?)`; params.push(req.query.enterTo); }
    if (req.query.createdFrom) { query += ` AND ${safeDate('created_date')} >= date(?)`; params.push(req.query.createdFrom); }
    if (req.query.createdTo) { query += ` AND ${safeDate('created_date')} <= date(?)`; params.push(req.query.createdTo); }
    if (req.query.assignFrom) { query += ` AND ${safeDate('assign_date')} >= date(?)`; params.push(req.query.assignFrom); }
    if (req.query.assignToDate) { query += ` AND ${safeDate('assign_date')} <= date(?)`; params.push(req.query.assignToDate); }

    return query;
};

// ── PERMISSIONS API ────────────────────────────────────────
app.get('/api/get-permissions', (req, res) => {
    db.all("SELECT * FROM field_permissions", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

app.get('/api/my-permissions', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const { role, id } = req.session.user;

    db.all("SELECT module_name, feature_name, is_enabled FROM field_permissions WHERE role_name = ?", [role], (err, roleRows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });

        const matrix = {};
        (roleRows || []).forEach(r => {
            if (!matrix[r.module_name]) matrix[r.module_name] = {};
            matrix[r.module_name][r.feature_name] = r.is_enabled === 1;
        });

        db.get("SELECT custom_permissions_json FROM users WHERE id = ?", [id], (err, userRow) => {
            if (!err && userRow && userRow.custom_permissions_json) {
                try {
                    const customPerms = JSON.parse(userRow.custom_permissions_json);
                    // Deep merge custom permissions over role defaults
                    for (const mod in customPerms) {
                        if (!matrix[mod]) matrix[mod] = {};
                        Object.assign(matrix[mod], customPerms[mod]);
                    }
                } catch (e) { /* Ignore JSON parse errors */ }
            }
            res.json(matrix);
        });
    });
});

app.get('/api/role-permissions/:role', (req, res) => {
    const role = req.params.role;
    db.all("SELECT module_name, feature_name, is_enabled FROM field_permissions WHERE role_name = ?", [role], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });

        // Transform flat rows into a nested JSON structure for easy frontend consumption
        const matrix = {};
        rows.forEach(r => {
            if (!matrix[r.module_name]) matrix[r.module_name] = {};
            matrix[r.module_name][r.feature_name] = r.is_enabled === 1;
        });
        res.json(matrix);
    });
});

app.post('/api/save-permissions', (req, res) => {
    const permissions = req.body.permissions;
    if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Invalid data format.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`
            INSERT INTO field_permissions (role_name, module_name, feature_name, is_enabled)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(role_name, module_name, feature_name) DO UPDATE SET is_enabled = excluded.is_enabled
        `);

        let hasError = false;
        permissions.forEach(p => {
            stmt.run(p.role_name, p.module_name, p.feature_name, p.is_enabled ? 1 : 0, (err) => {
                if (err) hasError = true;
            });
        });

        stmt.finalize(() => {
            if (hasError) {
                db.run("ROLLBACK");
                res.status(500).json({ error: 'Failed to save some permissions.' });
            } else {
                db.run("COMMIT");
                res.json({ success: true });
            }
        });
    });
});

// ── BACKUP MANAGER ────────────────────────────────────────
const backupManager = require('./backup-manager');

app.post('/api/backup/start', requireManager, (req, res) => {
    const started = backupManager.createBackup();
    if (started) res.json({ success: true, message: 'Backup started' });
    else res.status(400).json({ error: 'Backup is already in progress' });
});

app.get('/api/backup/status', requireManager, (req, res) => {
    res.json(backupManager.getBackupState());
});

app.get('/api/last-backup', requireManager, (req, res) => {
    const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
    if (!fs.existsSync(backupDir)) return res.json({ lastBackup: 'No backups yet' });
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip'));
    if (files.length === 0) return res.json({ lastBackup: 'No backups yet' });

    let latestTime = 0;
    files.forEach(file => {
        const t = fs.statSync(path.join(backupDir, file)).mtimeMs;
        if (t > latestTime) latestTime = t;
    });

    const date = new Date(latestTime);
    const formattedDate = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
    res.json({ lastBackup: formattedDate });
});

app.get('/api/backups', requireManager, (req, res) => {
    const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
    if (!fs.existsSync(backupDir)) return res.json([]);
    try {
        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.zip'))
            .map(file => {
                const stats = fs.statSync(path.join(backupDir, file));
                return { name: file, size: (stats.size / 1024 / 1024).toFixed(2), date: stats.mtime };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(files);
    } catch (e) {
        res.status(500).json({ error: 'Could not read backup directory.' });
    }
});

app.get('/api/backups/download/:filename', requireManager, (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).send('Invalid filename.');
    }
    const filePath = path.join(__dirname, 'SYSTEM_BACKUPS', filename);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).send('Backup file not found.');
});

// ── AUTOMATIC BI-HOURLY BACKUP SCHEDULER ────────────────────
// Runs at 1AM, 3AM, 5AM, 7AM, 9AM, 11AM, 1PM, 3PM, 5PM, 7PM, 9PM, 11PM (IST)
cron.schedule('0 1,3,5,7,9,11,13,15,17,19,21,23 * * *', () => {
    console.log('⏰ [Auto-Backup] Starting scheduled bi-hourly backup...');
    const started = backupManager.createBackup();
    if (!started) {
        console.log('⏰ [Auto-Backup] Skipped: A backup process is already running.');
    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// ── AUTOMATIC BACKUP CLEANUP SCHEDULER ─────────────────────
// Runs every day at 3:00 AM Indian Standard Time (IST)
cron.schedule('0 3 * * *', () => {
    console.log('🧹 [Auto-Cleanup] Starting scheduled backup cleanup...');
    const backupDir = path.join(__dirname, 'SYSTEM_BACKUPS');
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds

    if (!fs.existsSync(backupDir)) {
        console.log('🧹 [Auto-Cleanup] Backup directory does not exist. Skipping cleanup.');
        return;
    }

    fs.readdir(backupDir, (err, files) => {
        if (err) { console.error('🧹 [Auto-Cleanup] Error reading backup directory:', err); return; }
        files.forEach(file => {
            const filePath = path.join(backupDir, file);
            if (file.endsWith('.zip') && fs.statSync(filePath).mtimeMs < thirtyDaysAgo) {
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error(`🧹 [Auto-Cleanup] Error deleting old backup ${file}:`, unlinkErr);
                    else console.log(`🧹 [Auto-Cleanup] Deleted old backup: ${file}`);
                });
            }
        });
    });
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// ── AUTOMATIC DATABASE VACUUM SCHEDULER ────────────────────
// Runs every Sunday at 4:00 AM (IST) to reclaim disk space after bulk deletes
cron.schedule('0 4 * * 0', () => {
    console.log('🗄️ [Auto-Vacuum] Starting database vacuum to reclaim disk space...');
    db.run('VACUUM', (err) => {
        if (err) console.error('🗄️ [Auto-Vacuum] Error during vacuum:', err);
        else console.log('🗄️ [Auto-Vacuum] Database vacuum completed successfully.');
    });
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// ── SERVER START ───────────────────────────────────────────
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);

// Share Express session with Socket.IO
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
    const req = socket.request;
    if (req.session && req.session.user) {
        // User joins a room named after their username to receive targeted notifications
        const roomName = req.session.user.full_name || req.session.user.username;
        socket.join(roomName);
    }
});

// Make io accessible in routing modules (e.g., req.app.get('io'))
app.set('io', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║        ☀️  SOLAR CRM SERVER STARTED SUCCESSFULLY        ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 URL: http://localhost:${PORT}                              ║`);
    console.log('║  🔐 Login Page: http://localhost:3000/login            ║');
    console.log('║  👤 Run: node create-admin.js to set up admin user     ║');
    console.log('║  ⚙️  API: All routes require login (session-based)     ║');
    console.log('║  💾 Database: solar_v2.db (auto-initialized)          ║');
    console.log('║  � Backups: Auto-backup 5AM-2PM IST daily            ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;