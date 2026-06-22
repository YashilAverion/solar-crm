const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Resolve database path relative to project root directory
const dbPath = path.isAbsolute(config.database.path)
    ? config.database.path
    : path.resolve(__dirname, '..', config.database.path);

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected securely to the Solar CRM SQLite database.');
        
        db.serialize(() => {
            // Enforce strict relational integrity
            db.run('PRAGMA foreign_keys = ON;');
            // Performance: Write-Ahead Logging (allows concurrent readers & writers)
            db.run('PRAGMA journal_mode = WAL;');
            // Performance: Relax sync mode for faster writes (safe when using WAL)
            db.run('PRAGMA synchronous = NORMAL;');
            // Performance: Increase cache size to ~64MB in RAM (default is ~2MB)
            db.run('PRAGMA cache_size = -64000;');
            // Performance: Store temporary tables/indices in memory instead of disk
            db.run('PRAGMA temp_store = MEMORY;');
            // Wait up to 5000ms when database is locked before failing a query
            db.run('PRAGMA busy_timeout = 5000;');
        });
    }
});

// Database Migration Helper for Manual Workers
function migrateTableToWorkers(tableName, createTableSql) {
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
        if (err) {
            console.error(`Error checking schema for ${tableName}:`, err.message);
            return;
        }
        if (!row) {
            // Table does not exist, create it directly
            db.run(createTableSql);
        } else if (row.sql && !row.sql.includes('REFERENCES attendance_workers(id)')) {
            console.log(`Migrating table ${tableName} to reference attendance_workers...`);
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = OFF;');
                db.run(`ALTER TABLE ${tableName} RENAME TO temp_${tableName};`, (renameErr) => {
                    if (renameErr) {
                        console.error(`Error renaming ${tableName}:`, renameErr.message);
                        db.run('PRAGMA foreign_keys = ON;');
                        return;
                    }
                    db.run(createTableSql, (createErr) => {
                        if (createErr) {
                            console.error(`Error recreating table ${tableName}:`, createErr.message);
                            db.run(`ALTER TABLE temp_${tableName} RENAME TO ${tableName};`);
                            db.run('PRAGMA foreign_keys = ON;');
                            return;
                        }
                        // Drop temp table. We do NOT copy existing CRM user attendance data to ensure a clean slate as requested.
                        db.run(`DROP TABLE temp_${tableName};`, (dropErr) => {
                            db.run('PRAGMA foreign_keys = ON;');
                            if (dropErr) {
                                console.error(`Error dropping temp_${tableName}:`, dropErr.message);
                            } else {
                                console.log(`Successfully migrated ${tableName} to reference attendance_workers.`);
                            }
                        });
                    });
                });
            });
        }
    });
}

db.serialize(() => {
    // 1. Users Table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT,
            username TEXT UNIQUE,
            email TEXT,
            password TEXT,
            role TEXT,
            can_edit TEXT DEFAULT 'No',
            can_delete TEXT DEFAULT 'No',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            custom_permissions_json TEXT,
            outlook_email TEXT,
            outlook_access_token TEXT,
            outlook_refresh_token TEXT,
            is_outlook_active INTEGER DEFAULT 0
        )
    `);

    // 2. Leads Table
    db.run(`
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type_of_lead TEXT, salutation TEXT, first_name TEXT, last_name TEXT,
            phone_number TEXT, phone_number_2 TEXT, landline_number TEXT,
            email_id_1 TEXT, email_id_2 TEXT, lead_source TEXT,
            lead_sub_category TEXT, referral_project_number TEXT,
            google_address TEXT, street_type TEXT, lot_number TEXT,
            unit_number TEXT, address TEXT, suburb TEXT, state TEXT,
            postcode TEXT, message TEXT, dnd TEXT DEFAULT 'No',
            property_type TEXT DEFAULT 'Residential',
            abn_number TEXT DEFAULT '',
            email_unsubscribe TEXT DEFAULT 'No', service TEXT DEFAULT 'No',
            quality_lead TEXT DEFAULT 'No', area TEXT, status TEXT DEFAULT 'New Lead',
            assign_to TEXT, assign_date TEXT, lead_assign_by TEXT,
            project_number TEXT, lead_entered_date TEXT, created_date TEXT,
            created_by TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            deleted_at DATETIME
        )
    `);

    // 2b. Leads History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS lead_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER,
            action TEXT,
            details TEXT,
            user_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    `);

    // 3. Products Table
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_category TEXT, prod_name TEXT, manufacturer_name TEXT,
            brand_name TEXT, model_number TEXT, stock_code TEXT,
            pro_approved_date TEXT, pro_expiry_date TEXT, product_series TEXT,
            no_of_phase TEXT, type_of_inverter TEXT DEFAULT '', panels_capacity_w REAL, inv_rt_ac_out_w REAL,
            inv_rt_dc_power_kw REAL, inv_mppt TEXT, nominal_battery_capacity_kwh REAL,
            usable_battery_kwh REAL, no_of_battery_modules INTEGER,
            pro_warranty_years TEXT, panels_linear_warranty_years TEXT,
            purchase_price REAL, purchase_price_ex_gst REAL,
            product_status TEXT DEFAULT 'Active', show_in_quotation TEXT DEFAULT 'Yes',
            show_in_detailed_reports TEXT DEFAULT 'Yes', child_products TEXT DEFAULT '[]',
            dynamic_documents TEXT DEFAULT '[]', datasheet TEXT, installation_manual TEXT,
            wifi_manual TEXT, warranty_document TEXT, created_at TEXT,
            last_update_on TEXT, last_updated_by TEXT
        )
    `);

    // 3b. Products History Table (both names for compatibility)
    db.run(`
        CREATE TABLE IF NOT EXISTS products_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER,
            user_name TEXT,
            action TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // product_history — used by products.js module (without 's')
    db.run(`
        CREATE TABLE IF NOT EXISTS product_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            action TEXT,
            details TEXT,
            user_name TEXT,
            created_at TEXT
        )
    `);

    // 4. Companies Table
    db.run(`
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comp_type TEXT, comp_name TEXT, comp_trading TEXT, comp_abn TEXT,
            comp_acn TEXT, comp_website TEXT, comp_first_name TEXT,
            comp_last_name TEXT, comp_email_1 TEXT, comp_email_2 TEXT,
            comp_phone TEXT, comp_google_address TEXT, comp_unit_number TEXT,
            comp_lot_number TEXT, comp_street_type TEXT, comp_address TEXT,
            comp_suburb TEXT, comp_state TEXT, comp_postcode TEXT,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4b. Companies History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS companies_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER,
            user_name TEXT,
            action TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 5. Installations Table (Fully Consolidated)
    db.run(`
        CREATE TABLE IF NOT EXISTS installations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT, company TEXT, first_name TEXT, last_name TEXT,
            phone TEXT, email TEXT, google_address TEXT, unit_number TEXT,
            lot_number TEXT, street_type TEXT, address TEXT, suburb TEXT,
            state TEXT, postcode TEXT, created_date TEXT, 
            status TEXT DEFAULT 'Pending', cert_status TEXT DEFAULT 'Pending',
            project_number TEXT, invoice_amount REAL DEFAULT 0,
            payment_status_amount REAL DEFAULT 0, payment_mode TEXT,
            meter_number TEXT, electricity_phase TEXT, travel_distance_km REAL DEFAULT 0,
            travel_charge_amount REAL DEFAULT 0, invoice_number TEXT,
            invoice_date TEXT, due_date TEXT, charges_configured TEXT DEFAULT 'No',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            equipment_details TEXT DEFAULT '[]',
            certificate_details TEXT DEFAULT '[]'
        )
    `);

    // 6. Installation Documents Table (NEW & CRITICAL FOR FILE UPLOADS)
    db.run(`
        CREATE TABLE IF NOT EXISTS installation_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            installation_id INTEGER,
            doc_type TEXT,
            file_name TEXT,
            file_size TEXT,
            file_url TEXT,
            user_name TEXT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE
        )
    `);

    // 7. Installation Saved Charges Table
    db.run(`
        CREATE TABLE IF NOT EXISTS installation_saved_charges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            installation_id INTEGER,
            charge_item_id INTEGER,
            charge_name TEXT,
            qty REAL DEFAULT 0,
            rate REAL DEFAULT 0,
            amount_ex_gst REAL DEFAULT 0,
            gst_amount REAL DEFAULT 0,
            amount_inc_gst REAL DEFAULT 0,
            notes TEXT,
            FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE
        )
    `);

    // 8. Installation Charge Master Items
    db.run(`
        CREATE TABLE IF NOT EXISTS installation_charge_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            charge_name TEXT NOT NULL,
            charge_type TEXT DEFAULT 'fixed',
            unit_label  TEXT DEFAULT 'per item',
            rate        REAL DEFAULT 0,
            state       TEXT DEFAULT 'WA',
            is_active   TEXT DEFAULT 'Yes',
            sort_order  INTEGER DEFAULT 0
        )
    `);

    // 8b. Installation Charge Items History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS installation_charge_items_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            user_name TEXT,
            previous_value TEXT,
            updated_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 9. STC Master Table
    db.run(`
        CREATE TABLE IF NOT EXISTS stc_master (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            postcode INTEGER,
            state TEXT,
            zone INTEGER,
            ratings REAL,
            deeming_period INTEGER,
            created_by TEXT
        )
    `);

    // 9b. STC Master History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS stc_master_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stc_id INTEGER,
            action TEXT,
            user TEXT,
            date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 10. Rebate Live Master Table
    db.run(`
        CREATE TABLE IF NOT EXISTS rebate_live_master_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type_of_rebate TEXT,
            property_type TEXT,
            state TEXT,
            zone INTEGER,
            live_rate REAL,
            admin_charges REAL,
            actual_rate REAL,
            status TEXT DEFAULT 'Active',
            created_date TEXT,
            created_by TEXT,
            last_updated_date TEXT,
            last_update_by TEXT
        )
    `);

    // 10b. Rebate Live Master History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS rebate_live_master_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rebate_id INTEGER,
            action TEXT,
            user TEXT,
            date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 11. Margin Master Table
    db.run(`
        CREATE TABLE IF NOT EXISTS margin_master_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            margin_type TEXT,
            state TEXT,
            area TEXT,
            margins TEXT DEFAULT '[]',
            created_by TEXT,
            created_date TEXT,
            last_update_by TEXT,
            last_updated_date TEXT
        )
    `);

    // 11b. Margin Master History Table
    db.run(`
        CREATE TABLE IF NOT EXISTS margin_master_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            margin_id INTEGER,
            action TEXT,
            user TEXT,
            date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 12. Dynamic History Tables Creation
    const historyTables = [
        'installations_history',
        'rebate_history'
    ];
    
    historyTables.forEach(tableName => {
        // We handle varying foreign key relations generally by using record_id, except for installations_history
        // which specifically relies on installation_id for tight UI coupling.
        const refColumn = tableName === 'installations_history' ? 'installation_id' : 'record_id';
        const fkConstraint = tableName === 'installations_history' ? `FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE` : '';
        
        db.run(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ${refColumn} INTEGER,
                user_name TEXT,
                action TEXT,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ${fkConstraint ? ',' + fkConstraint : ''}
            )
        `);
    });

    // 13. Graceful Alter Table Fallbacks
    // This acts defensively for existing legacy installations to guarantee the backend never crashes
    // on startup if the user is running an older SQLite file. It will silently ignore errors.
    const alterStatements = [
        "ALTER TABLE installations ADD COLUMN travel_charge_amount REAL DEFAULT 0",
        "ALTER TABLE installations ADD COLUMN invoice_number TEXT",
        "ALTER TABLE installations ADD COLUMN invoice_date TEXT",
        "ALTER TABLE installations ADD COLUMN due_date TEXT",
        "ALTER TABLE installations ADD COLUMN charges_configured TEXT DEFAULT 'No'",
        "ALTER TABLE installations ADD COLUMN equipment_details TEXT DEFAULT '[]'",
        "ALTER TABLE installations ADD COLUMN certificate_details TEXT DEFAULT '[]'",
        "ALTER TABLE installations ADD COLUMN payment_status TEXT DEFAULT 'Pending'",
        "ALTER TABLE companies ADD COLUMN status TEXT DEFAULT 'Active'",
        "ALTER TABLE leads ADD COLUMN referral_project_number TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN google_address TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN street_type TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN lot_number TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN lead_sub_category TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN quality_lead TEXT DEFAULT 'No'",
        "ALTER TABLE leads ADD COLUMN phone_number_2 TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN landline_number TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN email_id_2 TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN dnd TEXT DEFAULT 'No'",
        "ALTER TABLE leads ADD COLUMN email_unsubscribe TEXT DEFAULT 'No'",
        "ALTER TABLE leads ADD COLUMN area TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN assign_to TEXT DEFAULT '-'",
        "ALTER TABLE leads ADD COLUMN assign_date TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN lead_assign_by TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN lead_entered_date TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN created_date TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN lead_source TEXT DEFAULT ''",
        "ALTER TABLE leads ADD COLUMN message TEXT DEFAULT ''",
        "ALTER TABLE installation_charge_items ADD COLUMN unit_label TEXT DEFAULT 'per item'",
        "ALTER TABLE installation_charge_items ADD COLUMN is_active TEXT DEFAULT 'Yes'",
        "ALTER TABLE installation_charge_items ADD COLUMN sort_order INTEGER DEFAULT 0",
        "ALTER TABLE installation_charge_items ADD COLUMN state TEXT DEFAULT 'WA'",
        "ALTER TABLE leads ADD COLUMN is_deleted INTEGER DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN deleted_at DATETIME",
        "ALTER TABLE leads ADD COLUMN is_notified INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN custom_permissions_json TEXT",
        "ALTER TABLE users ADD COLUMN outlook_email TEXT",
        "ALTER TABLE users ADD COLUMN outlook_access_token TEXT",
        "ALTER TABLE users ADD COLUMN outlook_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN is_outlook_active INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN datasheet TEXT",
        "ALTER TABLE products ADD COLUMN installation_manual TEXT",
        "ALTER TABLE products ADD COLUMN wifi_manual TEXT",
        "ALTER TABLE products ADD COLUMN warranty_document TEXT",
        "ALTER TABLE products ADD COLUMN created_at TEXT",
        "ALTER TABLE payroll_historical_records ADD COLUMN generated_by TEXT",
        "ALTER TABLE payroll_historical_records ADD COLUMN calculation_metadata TEXT"
    ];
    
    alterStatements.push("ALTER TABLE leads ADD COLUMN property_type TEXT DEFAULT 'Residential'", "ALTER TABLE leads ADD COLUMN abn_number TEXT DEFAULT ''", "ALTER TABLE leads ADD COLUMN sales_input_notes TEXT DEFAULT ''", "ALTER TABLE leads ADD COLUMN system_size REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN stc_rebate REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN annual_savings REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN payback_period REAL DEFAULT 0", "ALTER TABLE leads ADD COLUMN co2_reduction REAL DEFAULT 0");

    alterStatements.forEach(sql => {
        db.run(sql, () => { /* Silently fail if column already exists */ });
    });

    // 14. Granular Field Permissions Matrix Table
    db.run(`
        CREATE TABLE IF NOT EXISTS field_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_name TEXT,
            module_name TEXT,
            feature_name TEXT,
            is_enabled INTEGER DEFAULT 0,
            UNIQUE(role_name, module_name, feature_name)
        )
    `, () => {
        // --- START MIGRATION FOR OLD NAMES ---
        db.serialize(() => {
            // A. Migrate 'User Management' -> 'Settings'
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, 'Settings', feature_name, is_enabled FROM field_permissions WHERE module_name = 'User Management'");
            db.run("DELETE FROM field_permissions WHERE module_name = 'User Management'");

            // B. Migrate Masters features
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Manage Products', is_enabled FROM field_permissions WHERE module_name = 'Masters' AND feature_name = 'Product Master'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Manage STC', is_enabled FROM field_permissions WHERE module_name = 'Masters' AND feature_name = 'STC Master'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Manage Rebates', is_enabled FROM field_permissions WHERE module_name = 'Masters' AND feature_name = 'Rebate Live Master'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Manage Margins', is_enabled FROM field_permissions WHERE module_name = 'Masters' AND feature_name = 'Margin Master'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Manage Charges', is_enabled FROM field_permissions WHERE module_name = 'Masters' AND feature_name = 'Installation Charges Master'");
            db.run("DELETE FROM field_permissions WHERE module_name = 'Masters' AND feature_name IN ('Product Master', 'STC Master', 'Rebate Live Master', 'Margin Master', 'Installation Charges Master')");

            // C. Migrate Lead Master features
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'View Leads', is_enabled FROM field_permissions WHERE module_name = 'Lead Master' AND feature_name = 'Master Leads'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Delete Lead', is_enabled FROM field_permissions WHERE module_name = 'Lead Master' AND feature_name = 'Delete Leads'");
            db.run("INSERT OR REPLACE INTO field_permissions (role_name, module_name, feature_name, is_enabled) SELECT role_name, module_name, 'Duplicate Lead', is_enabled FROM field_permissions WHERE module_name = 'Lead Master' AND feature_name = 'Duplicate Leads'");
            db.run("DELETE FROM field_permissions WHERE module_name = 'Lead Master' AND feature_name IN ('Master Leads', 'Delete Leads', 'Duplicate Leads')");

            // D. Migrate User Custom Override JSON strings
            db.all("SELECT id, custom_permissions_json FROM users WHERE custom_permissions_json IS NOT NULL", [], (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        try {
                            let perms = JSON.parse(row.custom_permissions_json);
                            let changed = false;
                            
                            // Migrate User Management -> Settings
                            if (perms['User Management']) {
                                perms['Settings'] = perms['User Management'];
                                delete perms['User Management'];
                                changed = true;
                            }
                            
                            // Migrate Masters features
                            if (perms['Masters']) {
                                const mappings = {
                                    'Product Master': 'Manage Products',
                                    'STC Master': 'Manage STC',
                                    'Rebate Live Master': 'Manage Rebates',
                                    'Margin Master': 'Manage Margins',
                                    'Installation Charges Master': 'Manage Charges'
                                };
                                for (const [oldName, newName] of Object.entries(mappings)) {
                                    if (perms['Masters'][oldName] !== undefined) {
                                        perms['Masters'][newName] = perms['Masters'][oldName];
                                        delete perms['Masters'][oldName];
                                        changed = true;
                                    }
                                }
                            }
                            
                            // Migrate Lead Master features
                            if (perms['Lead Master']) {
                                const mappings = {
                                    'Master Leads': 'View Leads',
                                    'Delete Leads': 'Delete Lead',
                                    'Duplicate Leads': 'Duplicate Lead'
                                };
                                for (const [oldName, newName] of Object.entries(mappings)) {
                                    if (perms['Lead Master'][oldName] !== undefined) {
                                        perms['Lead Master'][newName] = perms['Lead Master'][oldName];
                                        delete perms['Lead Master'][oldName];
                                        changed = true;
                                    }
                                }
                            }
                            
                            if (changed) {
                                db.run("UPDATE users SET custom_permissions_json = ? WHERE id = ?", [JSON.stringify(perms), row.id]);
                            }
                        } catch (e) {}
                    });
                }
            });
        });
        // --- END MIGRATION FOR OLD NAMES ---

        const roles = [
            'Admin',
            'Sales Manager', 'Procurement Manager', 'Accounts Manager', 'Installation Manager', 'Admin Manager', 'Service Manager',
            'Sales Team Leader', 'Procurement Team Leader', 'Accounts Team Leader', 'Installation Team Leader', 'Admin Team Leader', 'Service Team Leader',
            'Sales Executive', 'Procurement Executive', 'Account Executive', 'Installation Executive', 'Admin Executive', 'Service Executive'
        ];
        const modulesAndFeatures = {
            'Dashboard': ['Access Module', 'Sales', 'Installation', 'Service', 'Ares Installation'],
            'Lead Master': ['Access Module', 'View Leads', 'Add Lead', 'Edit Lead', 'Delete Lead', 'Duplicate Lead', 'Lead Approvals', 'View Revenue', 'Edit Address'],
            'Projects': ['Access Module', 'Leads'],
            'Masters': ['Access Module', 'View Masters', 'Manage Products', 'Manage STC', 'Manage Rebates', 'Manage Margins', 'Manage Charges'],
            'Ares Installation Outside': ['Access Module', 'Installations', 'Outstanding Payments', 'Paid Payments', 'Company Details'],
            'Settings': ['Access Module', 'View Settings', 'Manage Users', 'Manage Roles'],
            'Attendance & Payroll': ['Access Module', 'Employees', 'Leave', 'Timesheets', 'Pay Employee', 'Superannuation']
        };
        const stmt = db.prepare("INSERT OR IGNORE INTO field_permissions (role_name, module_name, feature_name, is_enabled) VALUES (?, ?, ?, ?)");
        roles.forEach(role => {
            for (const [mod, features] of Object.entries(modulesAndFeatures)) {
                features.forEach(feat => {
                    let isEnabled = 0;
                    if (role === 'Admin') {
                        isEnabled = 1;
                    } else if (mod === 'Attendance & Payroll') {
                        const isMgr = role === 'Manager' || role.includes('Manager');
                        if (isMgr) {
                            isEnabled = 1;
                        } else if (feat === 'Access Module' || feat === 'Employees' || feat === 'Leave') {
                            isEnabled = 1;
                        }
                    }
                    stmt.run(role, mod, feat, isEnabled);
                });
            }
        });
        stmt.finalize();
    });

    // Deprecated: User-Specific Field Permission Overrides are now stored in users.custom_permissions_json
    db.run(`CREATE TABLE IF NOT EXISTS user_field_permissions (id INTEGER)`);
    // 14c. Combo Groups and Variants Tables
    db.run(`
        CREATE TABLE IF NOT EXISTS combo_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_name TEXT NOT NULL,
            description TEXT,
            panel_stock_code TEXT,
            inverter_stock_code TEXT,
            battery_stock_code TEXT,
            is_panel_inverter INTEGER DEFAULT 0,
            is_inverter_battery INTEGER DEFAULT 0,
            is_panel_inverter_battery INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run("ALTER TABLE combo_groups ADD COLUMN is_panel_inverter INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE combo_groups ADD COLUMN is_inverter_battery INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE combo_groups ADD COLUMN is_panel_inverter_battery INTEGER DEFAULT 0", () => {});

    db.run(`
        CREATE TABLE IF NOT EXISTS combo_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            combo_group_id INTEGER,
            variant_name TEXT NOT NULL,
            stock_code TEXT UNIQUE,
            panel_qty INTEGER DEFAULT 0,
            inverter_qty INTEGER DEFAULT 0,
            battery_qty INTEGER DEFAULT 0,
            purchase_price REAL DEFAULT 0,
            purchase_price_ex_gst REAL DEFAULT 0,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(combo_group_id) REFERENCES combo_groups(id) ON DELETE CASCADE
        )
    `);

    // 14c_new. Manual Workers Table
    db.run(`
        CREATE TABLE IF NOT EXISTS attendance_workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT,
            email TEXT,
            phone TEXT,
            role TEXT,
            pay_frequency TEXT DEFAULT 'Fortnightly',
            status TEXT DEFAULT 'Active',
            title TEXT,
            middle_name TEXT,
            dob TEXT,
            job_title TEXT,
            gender TEXT,
            google_address TEXT,
            mobile_number TEXT,
            phone_number TEXT,
            invite_xero INTEGER DEFAULT 0,
            emergency_name TEXT,
            emergency_relationship TEXT,
            emergency_phone TEXT,
            emergency_email TEXT,
            bank_account_name TEXT,
            bank_bsb TEXT,
            bank_account_number TEXT,
            pay_template_earnings_rate TEXT,
            pay_template_hours REAL DEFAULT 0.0,
            employee_notes TEXT,
            annual_leave_balance REAL DEFAULT 0.0,
            personal_leave_balance REAL DEFAULT 0.0,
            is_contractor INTEGER DEFAULT 0,
            income_type TEXT DEFAULT 'Salary and wages',
            start_date TEXT,
            award_classification TEXT,
            employee_group TEXT,
            holiday_group TEXT,
            include_holidays_in_payslips INTEGER DEFAULT 0,
            ordinary_earnings_rate TEXT DEFAULT 'Ordinary Hours',
            authorised_to_approve_leave INTEGER DEFAULT 0,
            authorised_to_approve_timesheets INTEGER DEFAULT 0,
            company_name TEXT DEFAULT 'Ares Energy',
            tfn_exemption TEXT,
            residency_status TEXT DEFAULT 'Australian resident',
            visa_document_path TEXT,
            weekly_hours_limit REAL,
            per_hour_wages_inc_tax REAL,
            custom_holidays TEXT,
            break_hours_limit TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Schema migration: Add new columns if they do not exist
    const workerAlterStatements = [
        "ALTER TABLE attendance_workers ADD COLUMN title TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN middle_name TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN dob TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN job_title TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN gender TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN google_address TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN mobile_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN phone_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN invite_xero INTEGER DEFAULT 0",
        "ALTER TABLE attendance_workers ADD COLUMN emergency_name TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN emergency_relationship TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN emergency_phone TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN emergency_email TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN bank_account_name TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN bank_bsb TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN bank_account_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN pay_template_earnings_rate TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN pay_template_hours REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN employee_notes TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN annual_leave_balance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN personal_leave_balance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN is_contractor INTEGER DEFAULT 0",
        "ALTER TABLE attendance_workers ADD COLUMN income_type TEXT DEFAULT 'Salary and wages'",
        "ALTER TABLE attendance_workers ADD COLUMN start_date TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN award_classification TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN employee_group TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN holiday_group TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN include_holidays_in_payslips INTEGER DEFAULT 0",
        "ALTER TABLE attendance_workers ADD COLUMN ordinary_earnings_rate TEXT DEFAULT 'Ordinary Hours'",
        "ALTER TABLE attendance_workers ADD COLUMN authorised_to_approve_leave INTEGER DEFAULT 0",
        "ALTER TABLE attendance_workers ADD COLUMN authorised_to_approve_timesheets INTEGER DEFAULT 0",
        "ALTER TABLE attendance_workers ADD COLUMN company_name TEXT DEFAULT 'Ares Energy'",
        "ALTER TABLE attendance_workers ADD COLUMN tfn_exemption TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN residency_status TEXT DEFAULT 'Australian resident'",
        "ALTER TABLE attendance_workers ADD COLUMN visa_document_path TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN weekly_hours_limit REAL",
        "ALTER TABLE attendance_workers ADD COLUMN per_hour_wages_inc_tax REAL",
        "ALTER TABLE attendance_workers ADD COLUMN custom_holidays TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN break_hours_limit TEXT"
    ];
    workerAlterStatements.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Migration error for query [${sql}]:`, err.message);
            }
        });
    });

    // Migrate/Create dependent tables referencing attendance_workers(id) instead of users(id)
    migrateTableToWorkers('employee_compliance_profiles', `
        CREATE TABLE IF NOT EXISTS employee_compliance_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            employment_type TEXT NOT NULL CHECK(employment_type IN ('Full-Time', 'Part-Time', 'Casual')),
            modern_award_name TEXT,
            base_hourly_rate REAL NOT NULL,
            casual_loading_active INTEGER DEFAULT 0 CHECK(casual_loading_active IN (0, 1)),
            tax_file_number TEXT,
            tax_scale_code TEXT,
            super_fund_name TEXT,
            super_usi TEXT,
            super_member_number TEXT,
            visa_type TEXT,
            visa_expiry_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES attendance_workers(id) ON DELETE CASCADE
        )
    `);

    migrateTableToWorkers('attendance_timesheets', `
        CREATE TABLE IF NOT EXISTS attendance_timesheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            work_date TEXT NOT NULL,
            clock_in_time TEXT NOT NULL,
            clock_out_time TEXT,
            clock_in_gps TEXT NOT NULL,
            clock_out_gps TEXT,
            clock_in_address TEXT,
            clock_out_address TEXT,
            unpaid_break_minutes INTEGER DEFAULT 0,
            total_hours_worked REAL DEFAULT 0,
            manager_approval_status TEXT DEFAULT 'Pending' CHECK(manager_approval_status IN ('Pending', 'Approved', 'Rejected')),
            approved_by INTEGER,
            extra_hours TEXT,
            sick_leave TEXT,
            annual_leave TEXT,
            comments TEXT,
            status TEXT,
            last_edited_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES attendance_workers(id) ON DELETE CASCADE,
            FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(user_id, work_date)
        )
    `);

    // Apply migrations for attendance_timesheets optional columns
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN clock_in_address TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN clock_out_address TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN extra_hours TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN sick_leave TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN annual_leave TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN comments TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN status TEXT", () => {});
    db.run("ALTER TABLE attendance_timesheets ADD COLUMN last_edited_by TEXT", () => {});

    migrateTableToWorkers('leave_balances_and_requests', `
        CREATE TABLE IF NOT EXISTS leave_balances_and_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL CHECK(leave_type IN ('Annual', 'Personal/Sick', 'Unpaid')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            total_days REAL NOT NULL,
            approval_status TEXT DEFAULT 'Pending' CHECK(approval_status IN ('Pending', 'Approved', 'Rejected')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES attendance_workers(id) ON DELETE CASCADE
        )
    `);

    migrateTableToWorkers('payroll_historical_records', `
        CREATE TABLE IF NOT EXISTS payroll_historical_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            pay_period_start TEXT NOT NULL,
            pay_period_end TEXT NOT NULL,
            ordinary_hours REAL DEFAULT 0,
            overtime_hours REAL DEFAULT 0,
            gross_pay REAL DEFAULT 0,
            tax_withheld REAL DEFAULT 0,
            super_contribution REAL DEFAULT 0,
            net_pay REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            generated_by TEXT,
            calculation_metadata TEXT,
            FOREIGN KEY(user_id) REFERENCES attendance_workers(id) ON DELETE CASCADE
        )
    `);

    // 15. Unique constraint on actual project numbers to prevent concurrent duplicate sequences
    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_project_number_unique
        ON leads(project_number)
        WHERE project_number LIKE 'AR%'
    `, (err) => {
        if (err) console.error('Error creating unique index for project_number:', err.message);
    });

    // 16. Performance indexes for common searches
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email_id_1)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_first_name ON leads (first_name)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_last_name ON leads (last_name)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_project_number ON leads (project_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_assign_to ON leads (assign_to)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_type_of_lead ON leads (type_of_lead)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_lead_source ON leads (lead_source)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_address_suburb ON leads (address, suburb)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_lead_entered_date ON leads (lead_entered_date)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_created_date ON leads (created_date)", () => {});

    db.run("CREATE INDEX IF NOT EXISTS idx_installations_company ON installations (company)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_installations_status ON installations (status)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_installations_payment_status ON installations (payment_status)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_installations_project_number ON installations (project_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_installations_created_date ON installations (created_date)", () => {});

    db.run("CREATE INDEX IF NOT EXISTS idx_products_model ON products (model_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_products_category ON products (product_category)", () => {});

    db.run("CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (comp_name)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_companies_abn ON companies (comp_abn)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON activity_logs (lead_id)", () => {});

    // Indexes for Attendance and Payroll compliance module
    db.run("CREATE INDEX IF NOT EXISTS idx_employee_compliance_profiles_user_id ON employee_compliance_profiles (user_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_attendance_timesheets_user_id_date ON attendance_timesheets (user_id, work_date)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON leave_balances_and_requests (user_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_payroll_records_user_id ON payroll_historical_records (user_id)", () => {});
});

module.exports = db;