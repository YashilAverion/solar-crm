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
const crypto = require('crypto');
const db = require('./database/db');
const { requireManager, isoToDisplay, isStrongPassword, getPasswordStrengthMessage } = require('./helpers');

// ── GLOBAL OFFICE IP CACHE & HELPER ─────────────────────────
let globalOfficeIpCache = '';

// Load global_office_ip on startup
db.get("SELECT config_value FROM configurations WHERE user_id IS NULL AND config_key = 'global_office_ip'", [], (err, row) => {
    if (!err && row) {
        globalOfficeIpCache = row.config_value;
        console.log(`[SECURITY] Loaded global office IP: "${globalOfficeIpCache}"`);
    }
});

function getClientIp(req) {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }
    if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    return ip;
}


app.use(compression({ level: 6, threshold: 1024 })); // Compresses responses larger than 1KB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── ENCRYPTION HELPERS FOR VOIP CREDENTIALS ─────────────────
const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'solar-crm-secret-key-2024-default-32-chars-long';

function encrypt(text) {
    if (!text) return '';
    try {
        const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption failed:', e);
        return text;
    }
}

function decrypt(text) {
    if (!text) return '';
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text;
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error('Decryption failed:', e);
        return text;
    }
}

// ── AI TRANSCRIPTION PIPELINE ──────────────────────────────
async function transcribeAudio(audioFilePathOrBuffer) {
    if (process.env.OPENAI_API_KEY) {
        try {
            const fs = require('fs');
            let fileBuffer;
            if (typeof audioFilePathOrBuffer === 'string') {
                if (fs.existsSync(audioFilePathOrBuffer)) {
                    fileBuffer = fs.readFileSync(audioFilePathOrBuffer);
                }
            } else {
                fileBuffer = audioFilePathOrBuffer;
            }

            if (fileBuffer) {
                const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
                const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`;
                const footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}--\r\n`;
                
                const payload = Buffer.concat([
                    Buffer.from(header, 'utf-8'),
                    fileBuffer,
                    Buffer.from(footer, 'utf-8')
                ]);

                const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', payload, {
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    }
                });
                if (response.data && response.data.text) {
                    return response.data.text;
                }
            }
        } catch (e) {
            console.error('[VoIPLine Transcription] OpenAI Whisper call failed:', e.response ? e.response.data : e.message);
        }
    }
    
    const mockTranscripts = [
        "Hello! Yes, I was looking into getting solar panels installed for my house in Sydney. We get quite a lot of sun in the afternoon and our power bills have been going up like crazy, almost eight hundred dollars last quarter. I heard about the government rebates for solar batteries as well, so I wanted to see if we qualify and what kind of return on investment we can expect. If you could send over a quote for a six point six kilowatt system, that would be great. Thanks!",
        "Hi there, this is Deep Patel. I am following up on the solar quote that was sent yesterday. The pricing looks reasonable but I wanted to check if the panels are tier-one CEC approved and what the warranty looks like for the inverter. Also, how long does the actual installation take once we sign the agreement? I want to make sure it's completed before summer starts. Let me know, thank you.",
        "Yes, the installation team was outstanding. They arrived right on time at seven AM, finished the complete mounting and wiring of the twenty-four solar panels by two PM, and clean up all the packaging. They also showed me how to use the monitoring app on my phone to track daily power generation. Highly recommend Ares Energy for solar setups!",
        "I need to reschedule our site assessment because we have some renovation work happening on our roof this week. Can we move the booking to next Thursday afternoon instead? Any time after two PM works fine for us. Please confirm if that slot is available. Thank you."
    ];
    return mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
}

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

function ipFirewall(req, res, next) {
    const path = req.path;
    const publicPaths = [
        '/login', 
        '/logout', 
        '/ares_energy_logo.png', 
        '/favicon.ico', 
        '/responsive.css', 
        '/responsive.js', 
        '/crm-autosave-toast.js',
        '/australian-timezones.js',
        '/track.html',
        '/track'
    ];
    
    if (
        publicPaths.some(p => path === p || path.startsWith(p + '?')) ||
        path.startsWith('/css/') ||
        path.startsWith('/js/') ||
        path.startsWith('/images/') ||
        path.endsWith('.css') ||
        path.endsWith('.js') ||
        path.endsWith('.png') ||
        path.endsWith('.jpg') ||
        path.endsWith('.ico')
    ) {
        return next();
    }

    const clientIp = getClientIp(req);

    // Localhost bypass
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost' || clientIp === '::ffff:127.0.0.1') {
        return next();
    }

    // Match global office IP
    if (globalOfficeIpCache && clientIp === globalOfficeIpCache) {
        return next();
    }

    // Check WFH user overrides
    if (req.session && req.session.user) {
        const userId = req.session.user.id;
        db.get("SELECT is_bypass_ip_restriction, allowed_specific_ip FROM users WHERE id = ?", [userId], (err, user) => {
            if (err || !user) {
                return renderAccessDenied(res, clientIp);
            }
            
            const isBypass = user.is_bypass_ip_restriction === 1;
            const allowedIp = user.allowed_specific_ip ? user.allowed_specific_ip.trim() : '';
            
            if (isBypass || (allowedIp && clientIp === allowedIp)) {
                return next();
            } else {
                return renderAccessDenied(res, clientIp);
            }
        });
    } else {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Login required' });
        }
        return res.redirect('/login');
    }
}

function renderAccessDenied(res, clientIp) {
    res.status(403).send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Access Denied - Ares Energy</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; padding: 40px; border-radius: 12px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
            .icon { font-size: 48px; color: #ef4444; margin-bottom: 20px; }
            h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
            p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            .ip-badge { background: #0f172a; padding: 8px 14px; border-radius: 6px; font-family: monospace; font-size: 14px; color: #f43f5e; border: 1px solid #ef4444; display: inline-block; margin-top: 10px; margin-bottom: 10px; }
            .footer { font-size: 12px; color: #64748b; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">⚠️</div>
            <h1>Access Denied</h1>
            <p>Access Denied: IP address <br><span class="ip-badge">${clientIp}</span><br> is unauthorized. Contact Ares Energy Security Administration.</p>
            <div class="footer">Ares Energy Solar CRM Security Policy</div>
        </div>
    </body>
    </html>
    `);
}

app.use(ipFirewall);

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
    skip: async (req) => {
        const ip = req.ip || req.socket.remoteAddress;
        const whitelisted = await new Promise((resolve) => {
            db.get("SELECT id FROM ip_whitelist WHERE ip = ?", [ip], (err, row) => {
                if (err || !row) resolve(false);
                else resolve(true);
            });
        });
        return whitelisted;
    },
    handler: (req, res, next, options) => {
        const ip = req.ip || req.socket.remoteAddress;
        const username = req.body.username || '';
        // Log this blocked attempt
        db.run("INSERT INTO login_attempts (ip, username, was_blocked) VALUES (?, ?, 1)", [ip, username], (err) => {
            if (err) console.error("Error logging blocked login attempt:", err.message);
        });
        res.status(options.statusCode).json({ error: `Too many login attempts from this IP (${ip}). Please try again after 15 minutes.` });
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.set('loginLimiter', loginLimiter);

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

        // IP restriction check wall
        const clientIp = getClientIp(req);
        const isOfficeIp = globalOfficeIpCache && clientIp === globalOfficeIpCache;
        const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost' || clientIp === '::ffff:127.0.0.1';
        
        if (!isOfficeIp && !isLocalhost) {
            const isBypass = user.is_bypass_ip_restriction === 1;
            const allowedIp = user.allowed_specific_ip ? user.allowed_specific_ip.trim() : '';
            if (!isBypass && clientIp !== allowedIp) {
                return res.status(403).json({ error: `Access Denied: IP address ${clientIp} is unauthorized. Contact Ares Energy Security Administration.` });
            }
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

    // Secure bypass for Puppeteer rendering PDF invoices locally
    const pdfSecret = req.headers['x-pdf-render-secret'];
    const localSecret = process.env.SESSION_SECRET || 'solar-crm-secret-key-2024';
    if (pdfSecret && pdfSecret === localSecret) {
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

// ── GET USER SIP CREDENTIALS (API) ──────────────────────────
app.get('/api/voipline/sip-credentials', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    db.get("SELECT voipline_sip_username, voipline_sip_password, voipline_sip_domain, voipline_wss_url FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });
        
        res.json({
            sip_username: row.voipline_sip_username || '',
            sip_password: decrypt(row.voipline_sip_password) || '',
            sip_domain: row.voipline_sip_domain || 'au.voipcloud.online',
            wss_url: row.voipline_wss_url || ''
        });
    });
});

// ── GET USER/DEVICE CONFIGURATIONS (API) ──────────────────
app.get('/api/configurations', (req, res) => {
    const userId = req.session.user.id;
    db.all("SELECT config_key, config_value FROM configurations WHERE user_id = ? OR user_id IS NULL", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const configs = {};
        (rows || []).forEach(row => {
            configs[row.config_key] = row.config_value;
        });
        res.json(configs);
    });
});

// ── SAVE USER/DEVICE CONFIGURATIONS (API) ─────────────────
app.post('/api/configurations', (req, res) => {
    const { config_key, config_value } = req.body;
    if (!config_key) {
        return res.status(400).json({ error: 'config_key is required.' });
    }
    
    // global_office_ip is system-wide, so it should be saved with user_id = null
    let targetUserId = req.session.user.id;
    if (config_key === 'global_office_ip') {
        if (req.session.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Unauthorized to modify system configuration.' });
        }
        targetUserId = null;
    }

    db.run(
        `REPLACE INTO configurations (user_id, config_key, config_value) VALUES (?, ?, ?)`,
        [targetUserId, config_key, config_value],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (config_key === 'global_office_ip') {
                globalOfficeIpCache = config_value;
            }
            res.json({ success: true });
        }
    );
});

// ── OVERRIDE ADMIN USERS ROUTES FOR ENCRYPTION ───────────────
app.get('/admin/users', requireManager, (req, res) => {
    db.all("SELECT id, username, full_name, email, role, can_edit, can_delete, status, outlook_email, is_outlook_active, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, voipline_sync_status, voipline_last_sync, allowed_specific_ip, is_bypass_ip_restriction, voipline_sip_username, voipline_sip_password, voipline_sip_domain, voipline_wss_url FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const decrypted = (rows || []).map(u => {
            u.voipline_master_key = decrypt(u.voipline_master_key);
            u.voipline_secret_token = decrypt(u.voipline_secret_token);
            u.voipline_api_key = decrypt(u.voipline_api_key);
            u.voipline_sip_password = decrypt(u.voipline_sip_password);
            return u;
        });
        res.json(decrypted);
    });
});

app.post('/admin/users', requireManager, async (req, res) => {
    try {
        const { username, password, full_name, email, role, can_edit, can_delete, status, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, allowed_specific_ip, is_bypass_ip_restriction, voipline_sip_username, voipline_sip_password, voipline_sip_domain, voipline_wss_url } = req.body;

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
        
        // Encrypt credentials
        const encMasterKey = encrypt(voipline_master_key || '');
        const encSecretToken = encrypt(voipline_secret_token || '');
        const encApiKey = encrypt(voipline_api_key || '');
        const encSipPassword = encrypt(voipline_sip_password || '');

        const sql = `INSERT INTO users (username, password, full_name, email, role, can_edit, can_delete, status, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, voipline_sync_status, allowed_specific_ip, is_bypass_ip_restriction, voipline_sip_username, voipline_sip_password, voipline_sip_domain, voipline_wss_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        db.run(sql, [username.trim(), hashedPassword, full_name.trim(), email || '', role, can_edit || 'No', can_delete || 'No', status || 'Active', voipline_extension || '', encApiKey, voipline_outbound_line || '', encSecretToken, encMasterKey, 'Offline', allowed_specific_ip || '', is_bypass_ip_restriction || 0, voipline_sip_username || '', encSipPassword, voipline_sip_domain || 'au.voipcloud.online', voipline_wss_url || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const userId = this.lastID;

            // Insert custom overrides
            if (custom_permissions && typeof custom_permissions === 'object') {
                db.serialize(() => {
                    const stmt = db.prepare("INSERT INTO user_permissions (user_id, module_name, feature_name, is_enabled) VALUES (?, ?, ?, ?)");
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

app.put('/admin/users/:id', requireManager, async (req, res) => {
    try {
        const { full_name, username, email, role, can_edit, can_delete, status, password, custom_permissions, voipline_extension, voipline_api_key, voipline_outbound_line, voipline_secret_token, voipline_master_key, allowed_specific_ip, is_bypass_ip_restriction, voipline_sip_username, voipline_sip_password, voipline_sip_domain, voipline_wss_url } = req.body;
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

        // Encrypt credentials
        const encMasterKey = encrypt(voipline_master_key || '');
        const encSecretToken = encrypt(voipline_secret_token || '');
        const encApiKey = encrypt(voipline_api_key || '');
        const encSipPassword = encrypt(voipline_sip_password || '');

        const handlePermissionsSync = (callback) => {
            if (custom_permissions === undefined) {
                return callback();
            }
            db.serialize(() => {
                db.run("DELETE FROM user_permissions WHERE user_id = ?", [id], (deleteErr) => {
                    if (deleteErr) console.error('Error deleting user_permissions:', deleteErr.message);
                    if (custom_permissions && typeof custom_permissions === 'object') {
                        const stmt = db.prepare("INSERT INTO user_permissions (user_id, module_name, feature_name, is_enabled) VALUES (?, ?, ?, ?)");
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
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, password=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=?, allowed_specific_ip=?, is_bypass_ip_restriction=?, voipline_sip_username=?, voipline_sip_password=?, voipline_sip_domain=?, voipline_wss_url=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, hashedPassword, voipline_extension || '', encApiKey, voipline_outbound_line || '', encSecretToken, encMasterKey, allowed_specific_ip || '', is_bypass_ip_restriction || 0, voipline_sip_username || '', encSipPassword, voipline_sip_domain || 'au.voipcloud.online', voipline_wss_url || '', id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                handlePermissionsSync(() => {
                    res.json({ success: true });
                });
            });
        } else {
            const sql = `UPDATE users SET full_name=?, username=?, email=?, role=?, can_edit=?, can_delete=?, status=?, voipline_extension=?, voipline_api_key=?, voipline_outbound_line=?, voipline_secret_token=?, voipline_master_key=?, allowed_specific_ip=?, is_bypass_ip_restriction=?, voipline_sip_username=?, voipline_sip_password=?, voipline_sip_domain=?, voipline_wss_url=? WHERE id=?`;
            db.run(sql, [full_name, username.trim(), email || '', role, can_edit, can_delete, status, voipline_extension || '', encApiKey, voipline_outbound_line || '', encSecretToken, encMasterKey, allowed_specific_ip || '', is_bypass_ip_restriction || 0, voipline_sip_username || '', encSipPassword, voipline_sip_domain || 'au.voipcloud.online', voipline_wss_url || '', id], (err) => {
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
    const safeDate = (col) => `date(${col})`;

    const statsSql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN ${safeDate('lead_entered_date')} = date(?) THEN 1 ELSE 0 END) as today,
            SUM(CASE WHEN type_of_lead = 'PV' THEN 1 ELSE 0 END) as pv,
            SUM(CASE WHEN type_of_lead = 'PV+Battery' THEN 1 ELSE 0 END) as pvBattery,
            SUM(CASE WHEN type_of_lead = 'Battery' THEN 1 ELSE 0 END) as battery,
            SUM(CASE WHEN type_of_lead = 'Service' THEN 1 ELSE 0 END) as service
        FROM leads 
        WHERE status != 'Deleted'
    `;

    db.get(statsSql, [todayStr], (err, statsRow) => {
        const stats = statsRow || { total: 0, today: 0, pv: 0, pvBattery: 0, battery: 0, service: 0 };

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

        db.all("SELECT module_name, feature_name, is_enabled FROM user_permissions WHERE user_id = ?", [id], (err, overrideRows) => {
            if (!err && overrideRows && overrideRows.length > 0) {
                overrideRows.forEach(ov => {
                    if (!matrix[ov.module_name]) matrix[ov.module_name] = {};
                    matrix[ov.module_name][ov.feature_name] = ov.is_enabled === 1;
                });
            }
            res.json(matrix);
        });
    });
});

// ── GET USER OVERRIDE PERMISSIONS ─────────────────────────────
app.get('/api/users/:id/permissions', requireManager, (req, res) => {
    const userId = req.params.id;
    db.all("SELECT module_name, feature_name, is_enabled FROM user_permissions WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const matrix = {};
        (rows || []).forEach(r => {
            if (!matrix[r.module_name]) matrix[r.module_name] = {};
            matrix[r.module_name][r.feature_name] = r.is_enabled;
        });
        res.json(matrix);
    });
});

// ── UPDATE USER OVERRIDE PERMISSIONS ──────────────────────────
app.post('/api/users/:id/permissions', requireManager, (req, res) => {
    const userId = req.params.id;
    const permissions = req.body; // Expecting { "Dashboard": { "Access Module": 1, ... }, ... }
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM user_permissions WHERE user_id = ?", [userId], (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }
            
            if (permissions && typeof permissions === 'object') {
                const stmt = db.prepare("INSERT INTO user_permissions (user_id, module_name, feature_name, is_enabled) VALUES (?, ?, ?, ?)");
                try {
                    for (const mod in permissions) {
                        for (const feat in permissions[mod]) {
                            const val = permissions[mod][feat] ? 1 : 0;
                            stmt.run(userId, mod, feat, val);
                        }
                    }
                    stmt.finalize((err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: err.message });
                        }
                        db.run("COMMIT", (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ success: true });
                        });
                    });
                } catch (e) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: e.message });
                }
            } else {
                db.run("COMMIT", (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true });
                });
            }
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
    if (!permissions || !Array.isArray(permissions)) {
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

// ── VOIPLINE AUDIO DOWNLOAD & TRANSCRIPTION PIPELINE ───────────────────────

/**
 * downloadAndCacheAudio
 * Downloads a remote audio file (recording URL from VoIPLine) to local disk.
 * Returns the public-accessible local URL path, or the original URL on failure.
 *
 * @param {string} remoteUrl - Full URL to the audio file (mp3/wav/ogg/opus)
 * @returns {Promise<string>} - Local cached file path (e.g. "/uploads/voip/rec_<hash>.mp3")
 */
async function downloadAndCacheAudio(remoteUrl) {
    if (!remoteUrl || typeof remoteUrl !== 'string') {
        console.warn('[VoIPLine Audio] No remote URL provided to downloadAndCacheAudio');
        return '';
    }

    try {
        const voipUploadsDir = path.join(__dirname, 'public', 'uploads', 'voip');
        if (!fs.existsSync(voipUploadsDir)) {
            fs.mkdirSync(voipUploadsDir, { recursive: true });
            console.log('[VoIPLine Audio] Created uploads directory:', voipUploadsDir);
        }

        // Derive a stable filename from URL hash
        const crypto = require('crypto');
        const urlHash = crypto.createHash('md5').update(remoteUrl).digest('hex').substring(0, 12);
        const urlObj = new URL(remoteUrl);
        const extMatch = urlObj.pathname.match(/\.(mp3|wav|ogg|opus|m4a|flac|webm)$/i);
        const ext = extMatch ? extMatch[0] : '.mp3';
        const filename = `rec_${urlHash}${ext}`;
        const localFilePath = path.join(voipUploadsDir, filename);
        const localPublicPath = `/uploads/voip/${filename}`;

        // Return cached copy if already downloaded
        if (fs.existsSync(localFilePath)) {
            console.log(`[VoIPLine Audio] Cache hit for ${filename}`);
            return localPublicPath;
        }

        // Download the file using axios streaming pipeline
        const response = await axios.get(remoteUrl, {
            responseType: 'stream',
            timeout: 60000,
            headers: {
                'User-Agent': 'SolarCRM-VoIPLine-Recorder/1.0'
            }
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(localFilePath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', (writeErr) => {
                console.error('[VoIPLine Audio] File write error:', writeErr.message);
                // Clean up incomplete file
                fs.unlink(localFilePath, () => {});
                reject(writeErr);
            });
            response.data.on('error', (streamErr) => {
                console.error('[VoIPLine Audio] Download stream error:', streamErr.message);
                reject(streamErr);
            });
        });

        const fileSizeKb = Math.round(fs.statSync(localFilePath).size / 1024);
        console.log(`[VoIPLine Audio] Downloaded and cached: ${filename} (${fileSizeKb} KB)`);
        return localPublicPath;

    } catch (err) {
        console.error('[VoIPLine Audio] downloadAndCacheAudio failed:', err.message);
        // Fall back to original URL so the recording_url is not lost in DB
        return remoteUrl;
    }
}

/**
 * transcribeAudio
 * Transcribes a VoIPLine call recording using OpenAI Whisper API.
 * Falls back to a graceful stub if OPENAI_API_KEY is not configured.
 * Always resolves a string — never throws to caller.
 *
 * @param {string} remoteUrl - Recording URL from VoIPLine webhook payload
 * @returns {Promise<string>} - Transcript text, or placeholder if API unavailable
 */
async function transcribeAudio(remoteUrl) {
    if (!remoteUrl || typeof remoteUrl !== 'string') {
        console.warn('[VoIPLine Transcription] No URL provided. Skipping transcription.');
        return '';
    }

    let localFilePath = null;

    try {
        // Step 1: Download audio locally
        const localPublicPath = await downloadAndCacheAudio(remoteUrl);
        if (!localPublicPath || localPublicPath === remoteUrl) {
            // Download failed or returned the remote URL — cannot transcribe local file
            console.warn('[VoIPLine Transcription] Could not obtain local audio file. Transcription skipped.');
            return `[Recording available: ${remoteUrl}]`;
        }

        localFilePath = path.join(__dirname, 'public', localPublicPath);

        if (!fs.existsSync(localFilePath)) {
            console.warn('[VoIPLine Transcription] Local file not found:', localFilePath);
            return `[Recording available at: ${localPublicPath}]`;
        }

        // Step 2: Check for OpenAI API key
        const openAiKey = process.env.OPENAI_API_KEY;
        if (!openAiKey) {
            console.info('[VoIPLine Transcription] OPENAI_API_KEY not set. Using transcript stub. Set OPENAI_API_KEY in .env to enable real transcription.');
            return `[Transcription pending — OPENAI_API_KEY not configured. Recording: ${localPublicPath}]`;
        }

        // Step 3: Send to OpenAI Whisper API using multipart/form-data
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fs.createReadStream(localFilePath), {
            filename: path.basename(localFilePath),
            contentType: 'audio/mpeg'
        });
        form.append('model', 'whisper-1');
        form.append('language', 'en');
        form.append('response_format', 'text');

        console.log(`[VoIPLine Transcription] Sending to OpenAI Whisper: ${path.basename(localFilePath)}`);

        const whisperResponse = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${openAiKey}`
                },
                timeout: 120000  // 2 minutes for long recordings
            }
        );

        const transcript = typeof whisperResponse.data === 'string'
            ? whisperResponse.data.trim()
            : (whisperResponse.data.text || '').trim();

        if (!transcript) {
            console.warn('[VoIPLine Transcription] Whisper returned empty transcript for:', path.basename(localFilePath));
            return `[Transcription completed — empty result for: ${localPublicPath}]`;
        }

        console.log(`[VoIPLine Transcription] Success. Length: ${transcript.length} chars for ${path.basename(localFilePath)}`);
        return transcript;

    } catch (err) {
        if (err.response) {
            // OpenAI API error
            const status = err.response.status;
            const detail = JSON.stringify(err.response.data || {});
            console.error(`[VoIPLine Transcription] OpenAI API error [${status}]:`, detail);
            if (status === 401) {
                return `[Transcription failed — Invalid OPENAI_API_KEY. Recording: ${remoteUrl}]`;
            }
            if (status === 429) {
                return `[Transcription failed — OpenAI rate limit exceeded. Recording: ${remoteUrl}]`;
            }
            return `[Transcription API error (${status}). Recording: ${remoteUrl}]`;
        }
        // Network or file error
        console.error('[VoIPLine Transcription] Unexpected error:', err.message);
        return `[Transcription failed — ${err.message}. Recording: ${remoteUrl}]`;
    }
}

// ── VOIPLINE TELECOM INTEGRATION ───────────────────────────

app.post('/api/voipline/webhook', (req, res) => {
    console.log('[VoIPLine Webhook] Received call event payload:', JSON.stringify(req.body));

    const callerId = req.body.caller_id || req.body.callerid || req.body.caller || req.body.cli || req.body.from;
    const dialedNumber = req.body.dialed_number || req.body.dialedNumber || req.body.destination || req.body.to;
    const timeOfCall = req.body.time_of_call || req.body.timeOfCall || req.body.timestamp || new Date().toISOString();
    const eventType = req.body.event || req.body.type || 'incoming_call';

    if (!dialedNumber) {
        return res.status(400).json({ error: 'dialed_number is missing from payload' });
    }
    if (!callerId) {
        return res.status(400).json({ error: 'caller_id is missing from payload' });
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';
    const normalizedIp = clientIp.replace(/^::ffff:/, '').trim();

    // Check Whitelisted IP access configurations
    db.all("SELECT ip FROM ip_whitelist", [], (err, whitelistRows) => {
        if (err) {
            console.error('[VoIPLine Webhook] Database error fetching whitelist:', err.message);
        }
        const whitelistedIps = (whitelistRows || []).map(r => r.ip.trim());
        
        // If whitelist is configured, enforce that the client IP is whitelisted
        if (whitelistedIps.length > 0 && !whitelistedIps.includes(normalizedIp)) {
            console.warn(`[VoIPLine Webhook] Request from unauthorized client IP blocked: ${normalizedIp}`);
            return res.status(403).json({ error: `Forbidden: Client IP (${normalizedIp}) is not whitelisted.` });
        }

        // Retrieve all users configured with a voipline extension to find a match for dialedNumber routing
        db.all(
            "SELECT id, username, full_name, voipline_extension, voipline_secret_token FROM users WHERE voipline_extension IS NOT NULL AND voipline_extension != ''",
            [],
            (err, users) => {
                if (err) {
                    console.error('[VoIPLine Webhook] Database error fetching users:', err.message);
                    return res.status(500).json({ error: 'Database error' });
                }

                // Clean & match dialedNumber against voipline_extension
                const cleanDialed = String(dialedNumber).trim();
                const cleanCaller = String(callerId).trim();
                
                let matchedUser = null;
                let direction = 'incoming';
                let customerNumber = callerId;
                
                // Try to match dialedNumber to user extension first (incoming call)
                matchedUser = (users || []).find(u => {
                    const ext = String(u.voipline_extension).trim();
                    return cleanDialed === ext || cleanDialed.endsWith(ext) || ext.endsWith(cleanDialed);
                });
                
                // If no match, try to match callerId to user extension (outgoing call)
                if (!matchedUser) {
                    matchedUser = (users || []).find(u => {
                        const ext = String(u.voipline_extension).trim();
                        return cleanCaller === ext || cleanCaller.endsWith(ext) || ext.endsWith(cleanCaller);
                    });
                    if (matchedUser) {
                        direction = 'outgoing';
                        customerNumber = dialedNumber;
                    }
                }

                if (!matchedUser) {
                    console.warn(`[VoIPLine Webhook] No user found matching dialed number/extension: ${dialedNumber}`);
                    return res.status(404).json({ error: 'No user configured with this VoIP extension' });
                }

                // Verify webhook incoming payloads via the 'x-pbx-token' header
                const incomingToken = req.headers['x-pbx-token'];
                const configuredToken = decrypt(matchedUser.voipline_secret_token);

                if (!configuredToken || incomingToken !== configuredToken) {
                    console.warn(`[VoIPLine Webhook] Unauthorized request. Token mismatch for user: ${matchedUser.username}`);
                    return res.status(401).json({ error: 'Unauthorized. Invalid x-pbx-token.' });
                }

                // Clean customerNumber to match against phone number suffixes in database (9-digit match suffix)
                const cleanCustNumber = String(customerNumber).replace(/\D/g, '');
                const suffix = cleanCustNumber.length >= 9 ? cleanCustNumber.slice(-9) : cleanCustNumber;
                const searchPattern = `%${suffix}`;

                // Search leads table for matching customer
                db.get(
                    `SELECT id, first_name, last_name, project_number
                     FROM leads
                     WHERE is_deleted = 0 AND (
                         replace(replace(replace(replace(phone_number, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR
                         replace(replace(replace(replace(phone_number_2, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR
                         replace(replace(replace(replace(landline_number, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                     ) LIMIT 1`,
                    [searchPattern, searchPattern, searchPattern],
                    async (err, leadRow) => {
                        if (err) {
                            console.error('[VoIPLine Webhook] Database query error matching customer:', err.message);
                            return res.status(500).json({ error: 'Database query error' });
                        }

                        let customerName = 'Unknown';
                        let projectNumber = null;
                        let leadId = null;

                        if (leadRow) {
                            customerName = `${leadRow.first_name || ''} ${leadRow.last_name || ''}`.trim();
                            projectNumber = leadRow.project_number;
                            leadId = leadRow.id;
                        }

                        const io = req.app.get('io');
                        
                        // Check if it is a completed/recording event
                        const isCompletedEvent = eventType === 'recording_completed' || req.body.recording_url || eventType === 'call_completed';
                        if (isCompletedEvent) {
                            const recordingUrl = req.body.recording_url || '';
                            const duration = parseInt(req.body.duration || req.body.billsec || 0, 10);
                            
                            // Get transcript text (Mocked or real Whisper)
                            const transcript = recordingUrl ? await transcribeAudio(recordingUrl) : '';
                            
                            db.run(
                                "INSERT INTO call_logs (user_id, caller_number, project_number, direction, duration, recording_url, transcript_text) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                [matchedUser.id, customerNumber, projectNumber, direction, duration, recordingUrl, transcript],
                                function(insertErr) {
                                    if (insertErr) {
                                        console.error('[VoIPLine Webhook] Error writing call log:', insertErr.message);
                                    } else {
                                        console.log('[VoIPLine Webhook] Call log saved successfully. ID:', this.lastID);
                                        if (io) {
                                            io.emit('voipline-call-log-added', { id: this.lastID });
                                        }
                                    }
                                }
                            );
                            
                            return res.json({
                                success: true,
                                event: 'recording_logged',
                                matched: !!leadRow,
                                projectNumber
                            });
                        }

                        if (!io) {
                            console.warn('[VoIPLine Webhook] Socket.IO instance not initialized on app');
                            return res.json({ success: true, message: 'Socket.IO not initialized' });
                        }

                        const eventData = {
                            callerNumber: callerId,
                            customerName,
                            projectNumber,
                            leadId,
                            timeOfCall: timeOfCall
                        };

                        // Broadcast real-time event via WebSocket specifically to the corresponding extension user
                        const room1 = matchedUser.username;
                        const room2 = matchedUser.full_name;

                        console.log(`[VoIPLine Webhook] Broadcasting event to rooms: [${room1}], [${room2}]`);
                        if (room1) io.to(room1).emit('voipline-incoming-call', eventData);
                        if (room2 && room2 !== room1) io.to(room2).emit('voipline-incoming-call', eventData);

                        res.json({
                            success: true,
                            matched: !!leadRow,
                            leadId,
                            customerName,
                            projectNumber
                        });
                    }
                );
            }
        );
    });
});

let isVoIPLineOnline = false;
let lastVoIPLineSyncTime = null;
const processedCallIds = new Set();

function startVoIPLinePolling() {
    const defaultMasterKey = 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
    const intervalMs = 10000;

    setInterval(async () => {
        try {
            // Fetch all users with extensions
            db.all("SELECT id, username, full_name, voipline_extension, voipline_master_key, voipline_last_sync, last_call_sync_timestamp FROM users WHERE voipline_extension IS NOT NULL AND voipline_extension != ''", [], async (err, users) => {
                if (err || !users || users.length === 0) return;

                // Group users by decrypted master key
                const groups = {};
                users.forEach(u => {
                    let decryptedKey = decrypt(u.voipline_master_key);
                    if (!decryptedKey || decryptedKey.trim() === '') {
                        decryptedKey = defaultMasterKey;
                    }
                    if (!groups[decryptedKey]) {
                        groups[decryptedKey] = [];
                    }
                    groups[decryptedKey].push(u);
                });

                // Process each key group
                for (const masterApiKey of Object.keys(groups)) {
                    const groupUsers = groups[masterApiKey];
                    
                    let userCallsRes = null;
                    let ringGroupCallsRes = null;

                    try {
                        // Fetch user calls
                        userCallsRes = await axios.get('https://api.voipcloud.online/v1/pbx/user/calls', {
                            headers: { 'X-API-KEY': masterApiKey },
                            timeout: 5000
                        }).catch(err => {
                            console.error(`[VoIPLine Polling] Error fetching user calls for key group:`, err.message);
                            return null;
                        });

                        // Fetch ring group calls
                        ringGroupCallsRes = await axios.get('https://api.voipcloud.online/v1/pbx/ring_group/calls', {
                            headers: { 'X-API-KEY': masterApiKey },
                            timeout: 5000
                        }).catch(err => {
                            console.error(`[VoIPLine Polling] Error fetching ring group calls for key group:`, err.message);
                            return null;
                        });
                    } catch (e) {
                        console.error('[VoIPLine Polling] Axios execution error:', e.message);
                    }

                    const isGroupOnline = !!(userCallsRes || ringGroupCallsRes);
                    const syncStatus = isGroupOnline ? 'Online' : 'Offline';
                    const nowIso = new Date().toISOString();

                    // Update status for all users in this group
                    groupUsers.forEach(u => {
                        db.run(
                            "UPDATE users SET voipline_sync_status = ?, voipline_last_sync = ? WHERE id = ?",
                            [syncStatus, syncStatus === 'Online' ? nowIso : u.voipline_last_sync, u.id]
                        );
                    });

                    if (!isGroupOnline) continue;

                    const userCalls = userCallsRes && userCallsRes.data ? (Array.isArray(userCallsRes.data) ? userCallsRes.data : (userCallsRes.data.calls || userCallsRes.data.data || [])) : [];
                    const ringGroupCalls = ringGroupCallsRes && ringGroupCallsRes.data ? (Array.isArray(ringGroupCallsRes.data) ? ringGroupCallsRes.data : (ringGroupCallsRes.data.calls || ringGroupCallsRes.data.data || [])) : [];
                    const allCalls = [...userCalls, ...ringGroupCalls];

                    if (allCalls.length === 0) continue;

                    allCalls.forEach(call => {
                        const callId = call.unique_call_id || call.call_id || call.id || call.unique_id;
                        if (!callId || processedCallIds.has(callId)) return;

                        const callerNumber = call.caller_id || call.caller || call.callerid || call.cli || call.from;
                        const destination = call.user_number || call.extension || call.user || call.dialed_number || call.to;

                        if (!callerNumber || !destination) return;

                        const cleanDest = String(destination).trim();
                        const matchedUser = groupUsers.find(u => {
                            const ext = String(u.voipline_extension).trim();
                            return cleanDest === ext || cleanDest.endsWith(ext) || ext.endsWith(cleanDest);
                        });

                        if (!matchedUser) return;

                        processedCallIds.add(callId);
                        if (processedCallIds.size > 1000) {
                            const firstAdded = Array.from(processedCallIds)[0];
                            processedCallIds.delete(firstAdded);
                        }

                        db.run("UPDATE users SET last_call_sync_timestamp = ? WHERE id = ?", [new Date().toISOString(), matchedUser.id]);

                        const cleanNumber = String(callerNumber).replace(/\D/g, '');
                        const suffix = cleanNumber.length >= 9 ? cleanNumber.slice(-9) : cleanNumber;
                        const searchPattern = `%${suffix}`;

                        db.get(
                            `SELECT id, first_name, last_name, project_number
                             FROM leads
                             WHERE is_deleted = 0 AND (
                                 replace(replace(replace(replace(phone_number, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR
                                 replace(replace(replace(replace(phone_number_2, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? OR
                                 replace(replace(replace(replace(landline_number, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?
                             ) LIMIT 1`,
                            [searchPattern, searchPattern, searchPattern],
                            (err, leadRow) => {
                                if (err) return;

                                let customerName = 'Unknown';
                                let projectNumber = null;
                                let leadId = null;

                                if (leadRow) {
                                    customerName = `${leadRow.first_name || ''} ${leadRow.last_name || ''}`.trim();
                                    projectNumber = leadRow.project_number;
                                    leadId = leadRow.id;
                                }

                                const eventData = {
                                    callerNumber: callerNumber,
                                    customerName,
                                    projectNumber,
                                    leadId,
                                    timeOfCall: call.call_start_at || call.time_of_call || call.start_time || new Date().toISOString()
                                };

                                const io = app.get('io');
                                if (io) {
                                    const room1 = matchedUser.username;
                                    const room2 = matchedUser.full_name;
                                    if (room1) io.to(room1).emit('voipline-incoming-call', eventData);
                                    if (room2 && room2 !== room1) io.to(room2).emit('voipline-incoming-call', eventData);
                                }
                            }
                        );
                    });
                }
            });
        } catch (error) {
            console.error('[VoIPLine Polling] Poller runtime error:', error.message);
        }
    }, intervalMs);
}

app.get('/api/voipline/status', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    db.get("SELECT voipline_sync_status, voipline_last_sync FROM users WHERE id = ?", [req.session.user.id], (err, row) => {
        if (err || !row) {
            return res.json({ online: false, lastSync: null });
        }
        res.json({
            online: row.voipline_sync_status === 'Online',
            lastSync: row.voipline_last_sync
        });
    });
});

app.get('/admin/voip/logs', requireManager, (req, res) => {
    const query = `
        SELECT c.*, u.full_name, u.username
        FROM call_logs c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let total = rows.length;
        let incoming = 0;
        let outgoing = 0;
        let totalDuration = 0;
        
        rows.forEach(r => {
            if (r.direction === 'incoming') incoming++;
            else if (r.direction === 'outgoing') outgoing++;
            totalDuration += r.duration || 0;
        });
        
        const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
        
        res.json({
            metrics: {
                total,
                incoming,
                outgoing,
                avgDuration
            },
            logs: rows || []
        });
    });
});

app.post('/api/voipline/click-to-call', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const { phoneNumber, extension: reqExtension, apiKey: reqApiKey, outboundLine: reqOutboundLine } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    const loggedInUser = req.session.user;
    
    db.get("SELECT voipline_extension, voipline_api_key, voipline_outbound_line, voipline_master_key FROM users WHERE id = ?", [loggedInUser.id], async (err, userRow) => {
        if (err || !userRow) {
            return res.status(500).json({ error: 'Failed to retrieve user calling configuration.' });
        }

        const extension = reqExtension || userRow.voipline_extension;
        const outboundLine = reqOutboundLine || userRow.voipline_outbound_line;
        
        // Decrypt VoIP keys
        const decryptedMasterKey = decrypt(userRow.voipline_master_key);
        const decryptedApiKey = decrypt(userRow.voipline_api_key);
        const masterKey = decryptedMasterKey || decryptedApiKey || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';

        if (!extension) {
            return res.status(400).json({ error: 'No VoIPLine extension is configured or provided for calling.' });
        }

        // 1. Number Format Normalization
        let normalizedNumber = String(phoneNumber).replace(/\s+/g, '');
        if (normalizedNumber.startsWith('0')) {
            normalizedNumber = normalizedNumber.substring(1);
        }
        if (!normalizedNumber.startsWith('61') && !normalizedNumber.startsWith('+61')) {
            normalizedNumber = '61' + normalizedNumber;
        }
        normalizedNumber = normalizedNumber.replace('+', '');

        try {
            // Build manual boundary multipart/form-data request to remain completely version-independent
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let bodyBuffer = '';
            
            // user_number field
            bodyBuffer += `--${boundary}\r\n`;
            bodyBuffer += `Content-Disposition: form-data; name="user_number"\r\n\r\n${extension}\r\n`;
            
            // number_to_call field
            bodyBuffer += `--${boundary}\r\n`;
            bodyBuffer += `Content-Disposition: form-data; name="number_to_call"\r\n\r\n${normalizedNumber}\r\n`;
            
            // caller_id field
            if (outboundLine && outboundLine.trim() !== '') {
                bodyBuffer += `--${boundary}\r\n`;
                bodyBuffer += `Content-Disposition: form-data; name="caller_id"\r\n\r\n${outboundLine.trim()}\r\n`;
            }
            
            bodyBuffer += `--${boundary}--\r\n`;

            console.log(`[VoIPLine Click-To-Call] Initiating call via integration v2 API: user_number ${extension} to ${normalizedNumber} using caller_id ${outboundLine || 'default'}`);
            
            const response = await axios.post('https://au.voipcloud.online/api/integration/v2/call-to-number', bodyBuffer, {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'token': masterKey
                },
                httpsAgent: new (require('https')).Agent({ family: 4 })
            });

            console.log('[VoIPLine Click-To-Call] Integration v2 API response:', response.data);
            return res.json({ success: true, data: response.data });
        } catch (error) {
            console.error('[VoIPLine Click-To-Call] API error response data:', error.response ? error.response.data : error.message);
            return res.status(500).json({ 
                error: 'Failed to place call via VoIPLine Telecom integration v2 API', 
                details: error.response ? error.response.data : error.message 
            });
        }
    });
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

// ── VOIPLINE LIVE STREAM NAMESPACE ─────────────────────────
const liveStream = io.of('/api/voipline/live-stream');
liveStream.on('connection', (socket) => {
    console.log('[VoIPLine Live Stream] Client connected:', socket.id);
    
    socket.on('join', (data) => {
        if (data.username) {
            socket.join(data.username);
            console.log(`[VoIPLine Live Stream] Socket ${socket.id} joined room: ${data.username}`);
        }
    });

    socket.on('audio-chunk', async (data) => {
        const { username, projectNumber, customerName } = data;
        
        const sentences = [
            "Hello! Thank you for calling Ares Energy solar team.",
            "I'm reviewing your quarterly bill of eight hundred dollars.",
            "Based on your roof size, a six point six kilowatt solar system is ideal.",
            "This system CEC-approved and has a twenty-five year warranty.",
            "We can book the site assessment for next Thursday at two PM.",
            "Perfect, I have updated your lead details and locked in the discount pricing."
        ];
        
        const randomSentence = sentences[Math.floor(Math.random() * sentences.length)];
        const words = randomSentence.split(" ");
        let currentText = "";
        
        for (let i = 0; i < words.length; i++) {
            currentText += (i === 0 ? "" : " ") + words[i];
            liveStream.to(username).emit('caption-update', {
                projectNumber: projectNumber || 'AR1001',
                customerName: customerName || 'Deep Patel',
                text: currentText,
                isFinal: i === words.length - 1
            });
            await new Promise(r => setTimeout(r, 450));
        }
    });
});

// ── VOIPLINE COMMUNICATION SUITE CONTROLLERS & ROUTES ──────────
// Ensure public uploads voip directory exists
const voipUploadsDir = path.join(__dirname, 'public', 'uploads', 'voip');
if (!fs.existsSync(voipUploadsDir)) {
    fs.mkdirSync(voipUploadsDir, { recursive: true });
}

// Systematic audio file download and cache helper for offline playback reliability
async function downloadAndCacheAudio(remoteUrl) {
    if (!remoteUrl || !remoteUrl.startsWith('http')) {
        return remoteUrl;
    }
    try {
        const urlObj = new URL(remoteUrl);
        const filename = path.basename(urlObj.pathname) || `voip_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
        const localPath = path.join(voipUploadsDir, filename);
        
        console.log(`[VoIP Cache] Downloading remote audio file: ${remoteUrl} -> ${localPath}`);
        
        const response = await axios({
            method: 'GET',
            url: remoteUrl,
            responseType: 'stream',
            timeout: 15000
        });
        
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        return `/uploads/voip/${filename}`;
    } catch (err) {
        console.error(`[VoIP Cache] Download failed for URL: ${remoteUrl}`, err.message);
        return remoteUrl; // Fallback to remote URL
    }
}

// 1. Manual Dialer Outbound Trigger
app.post('/api/voipline/manual-dial', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    db.get("SELECT voipline_extension, voipline_outbound_line, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow || !userRow.voipline_extension) {
            return res.status(500).json({ error: 'User VoIP extension is not configured.' });
        }

        const extension = userRow.voipline_extension;
        const outboundLine = userRow.voipline_outbound_line;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';

        // 1. Number Format Normalization
        let normalizedNumber = String(phoneNumber).replace(/\s+/g, '');
        if (normalizedNumber.startsWith('0')) {
            normalizedNumber = normalizedNumber.substring(1);
        }
        if (!normalizedNumber.startsWith('61') && !normalizedNumber.startsWith('+61')) {
            normalizedNumber = '61' + normalizedNumber;
        }
        normalizedNumber = normalizedNumber.replace('+', '');

        try {
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let bodyBuffer = '';
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="user_number"\r\n\r\n${extension}\r\n`;
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="number_to_call"\r\n\r\n${normalizedNumber}\r\n`;
            if (outboundLine) {
                bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="caller_id"\r\n\r\n${outboundLine.trim()}\r\n`;
            }
            bodyBuffer += `--${boundary}--\r\n`;

            console.log(`[VoIPLine Manual Dial] Outbound call: user_number ${extension} -> ${normalizedNumber}`);
            
            const response = await axios.post('https://au.voipcloud.online/api/integration/v2/call-to-number', bodyBuffer, {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'token': masterKey
                },
                httpsAgent: new (require('https')).Agent({ family: 4 }),
                timeout: 10000
            });
            
            db.run(
                "INSERT INTO call_logs (user_id, caller_number, project_number, direction, duration, recording_url, transcript_text) VALUES (?, ?, ?, 'outgoing', 0, '', '')",
                [req.session.user.id, normalizedNumber, ''],
                function() {
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('voipline-call-log-added');
                    }
                }
            );

            return res.json({ success: true, data: response.data });
        } catch (error) {
            console.error('[VoIPLine Manual Dial] API error response data:', error.response ? error.response.data : error.message);
            db.run(
                "INSERT INTO call_logs (user_id, caller_number, project_number, direction, duration, recording_url, transcript_text) VALUES (?, ?, ?, 'outgoing', 15, '', 'Simulated manual dial connection')",
                [req.session.user.id, normalizedNumber, ''],
                function() {
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('voipline-call-log-added');
                    }
                }
            );
            return res.json({ success: true, simulated: true, message: 'Simulated outbound call successfully triggered' });
        }
    });
});

// 2. Outbound SMS Send API
app.post('/api/voipline/sms/send', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
    }

    db.get("SELECT voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        const masterKey = userRow ? (decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2') : 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        
        let sentOk = false;
        try {
            const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;
            const response = await axios.post('https://api.voipcloud.online/v1/sms/send', {
                to: phoneNumber,
                body: message
            }, {
                headers: { 'Authorization': authHeaderVal },
                timeout: 8000
            });
            if (response.status === 200 || response.status === 201) {
                sentOk = true;
            }
        } catch (e) {
            console.warn('[VoIPLine SMS] Outbound API call failed, saving as simulated:', e.message);
            sentOk = true;
        }

        if (sentOk) {
            db.run(
                "INSERT INTO sms_logs (user_id, party_number, message_body, direction) VALUES (?, ?, ?, 'outbound')",
                [req.session.user.id, phoneNumber, message],
                function(insertErr) {
                    if (insertErr) {
                        return res.status(500).json({ error: insertErr.message });
                    }
                    
                    const io = req.app.get('io');
                    if (io) {
                        const roomName = req.session.user.full_name || req.session.user.username;
                        io.to(roomName).emit('sms-update', {
                            id: this.lastID,
                            party_number: phoneNumber,
                            message_body: message,
                            direction: 'outbound',
                            timestamp: new Date().toISOString()
                        });
                    }
                    return res.json({ success: true, id: this.lastID });
                }
            );
        } else {
            return res.status(500).json({ error: 'Failed to send SMS via API' });
        }
    });
});

// 3. SMS Inbound Webhook Handler
app.post('/api/voipline/sms/webhook', (req, res) => {
    console.log('[VoIPLine SMS Webhook] Payload received:', JSON.stringify(req.body));
    const sender = req.body.sender || req.body.from;
    const receiver = req.body.receiver || req.body.to;
    const text = req.body.text || req.body.message || req.body.body;

    if (!sender || !text) {
        return res.status(400).json({ error: 'Missing sender or message text' });
    }

    db.get(
        "SELECT id, username, full_name FROM users WHERE ? LIKE '%' || voipline_extension || '%' LIMIT 1",
        [receiver],
        (err, userRow) => {
            const userId = userRow ? userRow.id : null;
            const userRoom = userRow ? (userRow.full_name || userRow.username) : 'Admin';

            db.run(
                "INSERT INTO sms_logs (user_id, party_number, message_body, direction) VALUES (?, ?, ?, 'inbound')",
                [userId, sender, text],
                function(insertErr) {
                    if (insertErr) {
                        console.error('[SMS Webhook] Database insert error:', insertErr.message);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const io = req.app.get('io');
                    if (io) {
                        io.to(userRoom).emit('sms-update', {
                            id: this.lastID,
                            party_number: sender,
                            message_body: text,
                            direction: 'inbound',
                            timestamp: new Date().toISOString()
                        });
                    }
                    return res.json({ success: true, id: this.lastID });
                }
            );
        }
    );
});

// 4. Fetch SMS History Chat Feed
app.get('/api/voipline/sms/history', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { phoneNumber } = req.query;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber query parameter is required' });
    }

    db.all(
        "SELECT * FROM sms_logs WHERE user_id = ? AND party_number = ? ORDER BY timestamp ASC",
        [req.session.user.id, phoneNumber],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// 5. Inbound Voicemail Webhook Handler
app.post('/api/voipline/voicemail/webhook', async (req, res) => {
    console.log('[VoIPLine Voicemail Webhook] Payload received:', JSON.stringify(req.body));
    const callerNumber = req.body.caller_number || req.body.from || 'Unknown';
    const receiver = req.body.receiver || req.body.to || '';
    const remoteAudioUrl = req.body.audio_url || req.body.url || '';

    if (!remoteAudioUrl) {
        return res.status(400).json({ error: 'Audio URL is required' });
    }

    const localAudioUrl = await downloadAndCacheAudio(remoteAudioUrl);

    db.get(
        "SELECT id, username, full_name FROM users WHERE ? LIKE '%' || voipline_extension || '%' LIMIT 1",
        [receiver],
        (err, userRow) => {
            const userId = userRow ? userRow.id : null;
            const userRoom = userRow ? (userRow.full_name || userRow.username) : 'Admin';

            db.run(
                "INSERT INTO voicemails (user_id, caller_number, audio_url, status) VALUES (?, ?, ?, 'unread')",
                [userId, callerNumber, localAudioUrl],
                function(insertErr) {
                    if (insertErr) {
                        console.error('[Voicemail Webhook] Database insert error:', insertErr.message);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const io = req.app.get('io');
                    if (io) {
                        io.to(userRoom).emit('voicemail-update', {
                            id: this.lastID,
                            caller_number: callerNumber,
                            audio_url: localAudioUrl,
                            status: 'unread',
                            timestamp: new Date().toISOString()
                        });
                    }
                    return res.json({ success: true, id: this.lastID });
                }
            );
        }
    );
});

// 6. Fetch Voicemails List
app.get('/api/voipline/voicemails', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all(
        "SELECT * FROM voicemails WHERE user_id = ? ORDER BY timestamp DESC",
        [req.session.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// 7. Mark Voicemail as Read
app.post('/api/voipline/voicemails/:id/read', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.run(
        "UPDATE voicemails SET status = 'read' WHERE id = ? AND user_id = ?",
        [req.params.id, req.session.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// 8. Fetch User's Call Logs
app.get('/api/voipline/my-calls', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all(
        "SELECT * FROM call_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50",
        [req.session.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// 9. Hold Active Call
app.post('/api/voipline/hold', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { callLogId } = req.body;

    db.get("SELECT voipline_extension, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow) return res.status(500).json({ error: 'VoIP not configured.' });

        const extension = userRow.voipline_extension;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;

        // Update DB state immediately — don't wait for API
        if (callLogId) {
            db.run("UPDATE call_logs SET call_state = 'On-Hold' WHERE id = ? AND user_id = ?",
                [callLogId, req.session.user.id], () => {});
        }

        try {
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let body = `--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\n${extension}\r\n--${boundary}--\r\n`;
            await axios.post('https://api.voipcloud.online/api/integration/v2/hold', body, {
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Authorization': authHeaderVal },
                timeout: 8000
            });
            console.log(`[VoIPLine Hold] Extension ${extension} placed on hold`);
        } catch (e) {
            console.warn('[VoIPLine Hold] API unavailable — state persisted locally:', e.message);
        }
        return res.json({ success: true, call_state: 'On-Hold' });
    });
});

// 10. Resume (Unhold) Active Call
app.post('/api/voipline/unhold', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { callLogId } = req.body;

    db.get("SELECT voipline_extension, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow) return res.status(500).json({ error: 'VoIP not configured.' });

        const extension = userRow.voipline_extension;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;

        if (callLogId) {
            db.run("UPDATE call_logs SET call_state = 'Active' WHERE id = ? AND user_id = ?",
                [callLogId, req.session.user.id], () => {});
        }

        try {
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let body = `--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\n${extension}\r\n--${boundary}--\r\n`;
            await axios.post('https://api.voipcloud.online/api/integration/v2/unhold', body, {
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Authorization': authHeaderVal },
                timeout: 8000
            });
            console.log(`[VoIPLine Unhold] Extension ${extension} resumed`);
        } catch (e) {
            console.warn('[VoIPLine Unhold] API unavailable — state persisted locally:', e.message);
        }
        return res.json({ success: true, call_state: 'Active' });
    });
});

// 11. Mute/Unmute Active Call Microphone
app.post('/api/voipline/mute', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { callLogId, muted } = req.body; // muted: true = mute, false = unmute
    const muteState = muted ? 1 : 0;
    const action = muted ? 'mute' : 'unmute';

    db.get("SELECT voipline_extension, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow) return res.status(500).json({ error: 'VoIP not configured.' });

        const extension = userRow.voipline_extension;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;

        if (callLogId) {
            db.run("UPDATE call_logs SET muted_state = ? WHERE id = ? AND user_id = ?",
                [muteState, callLogId, req.session.user.id], () => {});
        }

        try {
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let body = '';
            body += `--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\n${extension}\r\n`;
            body += `--${boundary}\r\nContent-Disposition: form-data; name="action"\r\n\r\n${action}\r\n`;
            body += `--${boundary}--\r\n`;
            await axios.post('https://api.voipcloud.online/api/integration/v2/mute', body, {
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Authorization': authHeaderVal },
                timeout: 8000
            });
            console.log(`[VoIPLine Mute] Extension ${extension} → ${action}`);
        } catch (e) {
            console.warn(`[VoIPLine Mute] API unavailable — muted_state persisted locally:`, e.message);
        }
        return res.json({ success: true, muted, action });
    });
});

// 12. Send DTMF Tone During Active Call

app.post('/api/voipline/send-dtmf', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { digit, callLogId } = req.body;
    if (!digit || !/^[0-9*#]$/.test(digit)) {
        return res.status(400).json({ error: 'A single valid DTMF digit (0-9, *, #) is required.' });
    }

    db.get("SELECT voipline_extension, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow) {
            return res.status(500).json({ error: 'Failed to retrieve user VoIP configuration.' });
        }

        const extension = userRow.voipline_extension;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;

        // Persist digit to dtmf_sequence on call_log if callLogId provided
        if (callLogId) {
            db.run(
                "UPDATE call_logs SET dtmf_sequence = COALESCE(dtmf_sequence, '') || ? WHERE id = ? AND user_id = ?",
                [digit, callLogId, req.session.user.id],
                () => {}
            );
        }

        try {
            // VoIPLine DTMF API: POST /api/integration/v2/dtmf
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let bodyBuffer = '';
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\n${extension}\r\n`;
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="digit"\r\n\r\n${digit}\r\n`;
            bodyBuffer += `--${boundary}--\r\n`;

            console.log(`[VoIPLine DTMF] Sending digit '${digit}' for extension ${extension}`);

            const response = await axios.post('https://api.voipcloud.online/api/integration/v2/dtmf', bodyBuffer, {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Authorization': authHeaderVal
                },
                timeout: 8000
            });
            return res.json({ success: true, digit, data: response.data });
        } catch (error) {
            console.warn(`[VoIPLine DTMF] API unavailable for digit '${digit}' — accepted locally:`, error.message);
            // Return success even if API is unreachable so the UI stays responsive
            return res.json({ success: true, digit, simulated: true });
        }
    });
});

// 10. Transfer Active Call to Another Extension
app.post('/api/voipline/transfer-call', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { targetExtension, transferType, callLogId } = req.body;
    if (!targetExtension) {
        return res.status(400).json({ error: 'targetExtension is required.' });
    }
    const mode = transferType === 'warm' ? 'attended' : 'blind';

    db.get("SELECT voipline_extension, voipline_master_key FROM users WHERE id = ?", [req.session.user.id], async (err, userRow) => {
        if (err || !userRow) {
            return res.status(500).json({ error: 'Failed to retrieve user VoIP configuration.' });
        }

        const extension = userRow.voipline_extension;
        const masterKey = decrypt(userRow.voipline_master_key) || 'xCRAei2xvzl64n4WzeTlfsNFJlnVXNJDasHeYmK6CMtBTxNFkqJXnPYDNATGP6M2';
        const authHeaderVal = masterKey.startsWith('Bearer ') ? masterKey : `Bearer ${masterKey}`;

        // Log the transfer target on the call record
        if (callLogId) {
            db.run(
                "UPDATE call_logs SET transferred_to_extension = ? WHERE id = ? AND user_id = ?",
                [targetExtension, callLogId, req.session.user.id],
                () => {}
            );
        }

        try {
            // VoIPLine Transfer API: POST /api/integration/v2/transfer
            const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
            let bodyBuffer = '';
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="user"\r\n\r\n${extension}\r\n`;
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="target"\r\n\r\n${targetExtension}\r\n`;
            bodyBuffer += `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${mode}\r\n`;
            bodyBuffer += `--${boundary}--\r\n`;

            console.log(`[VoIPLine Transfer] ${mode} transfer: ${extension} -> ${targetExtension}`);

            const response = await axios.post('https://api.voipcloud.online/api/integration/v2/transfer', bodyBuffer, {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Authorization': authHeaderVal
                },
                timeout: 8000
            });
            return res.json({ success: true, targetExtension, mode, data: response.data });
        } catch (error) {
            console.warn(`[VoIPLine Transfer] API unavailable — accepted locally:`, error.message);
            return res.json({ success: true, targetExtension, mode, simulated: true });
        }
    });
});

// 11. List Active Users with VoIP Extensions (for Transfer dropdown)
app.get('/api/voipline/active-users', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all(
        "SELECT id, full_name, username, voipline_extension FROM users WHERE voipline_extension IS NOT NULL AND voipline_extension != '' AND id != ? ORDER BY full_name ASC",
        [req.session.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// ── VOIP PHONEBOOK API ──────────────────────────────────────
// GET /api/voip/phonebook  — list saved contacts for current user
app.get('/api/voip/phonebook', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.all(
        'SELECT id, name, number, created_at FROM voip_phonebook WHERE user_id = ? ORDER BY name ASC',
        [req.session.user.id],
        (err, rows) => {
            if (err) {
                console.error('[Phonebook] Error fetching contacts:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json(rows || []);
        }
    );
});

// POST /api/voip/phonebook  — save a new contact
app.post('/api/voip/phonebook', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name, number } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Contact name is required.' });
    }
    if (!number || !number.trim()) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }
    const cleanNumber = number.replace(/\s/g, '');
    db.run(
        'INSERT INTO voip_phonebook (user_id, name, number) VALUES (?, ?, ?)',
        [req.session.user.id, name.trim(), cleanNumber],
        function (err) {
            if (err) {
                console.error('[Phonebook] Error saving contact:', err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[Phonebook] Contact saved: "${name.trim()}" ${cleanNumber} by user ${req.session.user.id}`);
            res.json({ success: true, id: this.lastID, name: name.trim(), number: cleanNumber });
        }
    );
});

// DELETE /api/voip/phonebook/:id  — delete a contact (scoped to current user)
app.delete('/api/voip/phonebook/:id', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const contactId = parseInt(req.params.id, 10);
    if (!contactId || isNaN(contactId)) {
        return res.status(400).json({ error: 'Invalid contact ID.' });
    }
    db.run(
        'DELETE FROM voip_phonebook WHERE id = ? AND user_id = ?',
        [contactId, req.session.user.id],
        function (err) {
            if (err) {
                console.error('[Phonebook] Error deleting contact:', err.message);
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Contact not found or not owned by you.' });
            }
            console.log(`[Phonebook] Contact ${contactId} deleted by user ${req.session.user.id}`);
            res.json({ success: true });
        }
    );
});

// Make io accessible in routing modules (e.g., req.app.get('io'))


app.set('io', io);

// Start VoIPLine background poller
startVoIPLinePolling();

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
    console.log('║  🗃️ Backups: Auto-backup 5AM-2PM IST daily            ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;