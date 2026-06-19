// ── config/index.js — Central configuration from environment variables ────────
'use strict';

require('dotenv').config();

module.exports = {
    server: {
        port: parseInt(process.env.PORT) || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production'
    },

    session: {
        secret: process.env.SESSION_SECRET || 'solar-crm-secret-key-2024',
        dbPath: process.env.SESSION_DB_PATH || './database/solar_sessions.db',
        maxAgeMsec: 8 * 60 * 60 * 1000
    },

    database: {
        path: process.env.DB_PATH || './database/solar_crm.db'
    },

    googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    },

    uploads: {
        maxFileSizeBytes: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024,
        productsDir: process.env.UPLOADS_DIR_PRODUCTS || './public/uploads/products',
        installationsDir: process.env.UPLOADS_DIR_INSTALLATIONS || './uploads/installations'
    },

    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || 'Solar CRM <noreply@solarcrm.com>'
    },

    pagination: {
        defaultPageSize: 50,
        maxPageSize: 500
    }
};
