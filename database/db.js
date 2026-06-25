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
            is_outlook_active INTEGER DEFAULT 0,
            voipline_extension TEXT,
            voipline_api_key TEXT,
            voipline_outbound_line TEXT,
            voipline_secret_token TEXT,
            voipline_master_key TEXT,
            last_call_sync_timestamp TEXT,
            voipline_sync_status TEXT DEFAULT 'Offline',
            voipline_last_sync TEXT
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
        "ALTER TABLE users ADD COLUMN voipline_extension TEXT",
        "ALTER TABLE users ADD COLUMN voipline_api_key TEXT",
        "ALTER TABLE users ADD COLUMN voipline_outbound_line TEXT",
        "ALTER TABLE users ADD COLUMN voipline_secret_token TEXT",
        "ALTER TABLE users ADD COLUMN voipline_master_key TEXT",
        "ALTER TABLE users ADD COLUMN last_call_sync_timestamp TEXT",
        "ALTER TABLE users ADD COLUMN voipline_sync_status TEXT DEFAULT 'Offline'",
        "ALTER TABLE users ADD COLUMN voipline_last_sync TEXT",
        "ALTER TABLE users ADD COLUMN voipline_sip_username TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN voipline_sip_password TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN voipline_sip_domain TEXT DEFAULT 'au.voipcloud.online'",
        "ALTER TABLE users ADD COLUMN voipline_wss_url TEXT DEFAULT ''",
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

    // 13b. Optimizing Indexes for fast searches when incoming payloads hit the server
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number)");
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_phone_number_2 ON leads(phone_number_2)");
    db.run("CREATE INDEX IF NOT EXISTS idx_leads_landline_number ON leads(landline_number)");
    db.run("CREATE INDEX IF NOT EXISTS idx_users_voipline_extension ON users(voipline_extension)");

    // 14. Deprecated central role-based permissions matrix table.
    // Permissions are now fully decentralized and managed strictly per-user in user_permissions.

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

    // 17. IP Whitelist and Login Attempts
    db.run(`
        CREATE TABLE IF NOT EXISTS ip_whitelist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT UNIQUE,
            added_by TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT,
            username TEXT,
            attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            was_blocked INTEGER DEFAULT 0
        )
    `);

    // Apply migrations for users VoIP columns
    db.run("ALTER TABLE users ADD COLUMN voipline_extension TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_api_key TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_outbound_line TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_secret_token TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_master_key TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN last_call_sync_timestamp TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_sync_status TEXT DEFAULT 'Offline'", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_last_sync TEXT", () => {});
    db.run("ALTER TABLE users ADD COLUMN allowed_specific_ip TEXT DEFAULT ''", () => {});
    db.run("ALTER TABLE users ADD COLUMN is_bypass_ip_restriction INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_sip_username TEXT DEFAULT ''", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_sip_password TEXT DEFAULT ''", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_sip_domain TEXT DEFAULT 'au.voipcloud.online'", () => {});
    db.run("ALTER TABLE users ADD COLUMN voipline_wss_url TEXT DEFAULT ''", () => {});

    // Create call_logs table for VoIP recording and transcripts
    db.run(`
        CREATE TABLE IF NOT EXISTS call_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            caller_number TEXT,
            project_number TEXT,
            direction TEXT,
            duration INTEGER,
            recording_url TEXT,
            transcript_text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    db.run("CREATE INDEX IF NOT EXISTS idx_call_logs_project_number ON call_logs (project_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs (user_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_call_logs_caller_number ON call_logs (caller_number)", () => {});

    // Create sms_logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            party_number TEXT,
            message_body TEXT,
            direction TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Create voicemails table
    db.run(`
        CREATE TABLE IF NOT EXISTS voicemails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            caller_number TEXT,
            audio_url TEXT,
            status TEXT DEFAULT 'unread',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    db.run("CREATE INDEX IF NOT EXISTS idx_sms_logs_party_number ON sms_logs (party_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id ON sms_logs (user_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_voicemails_caller_number ON voicemails (caller_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_voicemails_user_id ON voicemails (user_id)", () => {});

    // Defensive migrations for DTMF and transfer tracking on call_logs
    db.run("ALTER TABLE call_logs ADD COLUMN dtmf_sequence TEXT DEFAULT ''", () => {});
    db.run("ALTER TABLE call_logs ADD COLUMN transferred_to_extension TEXT DEFAULT ''", () => {});

    // Defensive migrations for in-call state tracking
    // call_state: 'Idle' | 'Ringing' | 'Active' | 'On-Hold'
    // muted_state: 0 = unmuted, 1 = muted
    // transferred_to_user_id: FK ref to users.id
    db.run("ALTER TABLE call_logs ADD COLUMN call_state TEXT DEFAULT 'Idle'", () => {});
    db.run("ALTER TABLE call_logs ADD COLUMN muted_state INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE call_logs ADD COLUMN transferred_to_user_id INTEGER DEFAULT NULL", () => {});

    // ── PHONEBOOK TABLE (Dialer saved contacts) ──────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS voip_phonebook (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            name        TEXT NOT NULL,
            number      TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating voip_phonebook table:', err.message);
        else console.log('[DB] voip_phonebook table ready.');
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_phonebook_user_id ON voip_phonebook (user_id)", () => {});

    // ── CONFIGURATIONS TABLE (User and device preferences) ───
    db.run(`
        CREATE TABLE IF NOT EXISTS configurations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            config_key TEXT NOT NULL,
            config_value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, config_key)
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating configurations table:', err.message);
        else {
            console.log('[DB] configurations table ready.');
            // Initialize global_office_ip key with user_id = NULL (global system config)
            db.run(`INSERT OR IGNORE INTO configurations (user_id, config_key, config_value) VALUES (NULL, 'global_office_ip', '')`);
        }
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_configurations_user_id ON configurations(user_id)", () => {});
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_configurations_global_unique ON configurations(config_key) WHERE user_id IS NULL", () => {});

    // ── USER PERMISSIONS TABLE ───
    db.run(`
        CREATE TABLE IF NOT EXISTS user_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            module_name TEXT,
            feature_name TEXT,
            access_status INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, module_name, feature_name)
        )
    `, (err) => {
        if (err) {
            console.error('[DB] Error creating user_permissions table:', err.message);
        } else {
            console.log('[DB] user_permissions table ready.');
            
            // Check if column rename is needed
            db.all("PRAGMA table_info(user_permissions)", [], (pragmaErr, columns) => {
                if (!pragmaErr && columns) {
                    const hasIsEnabled = columns.some(col => col.name === 'is_enabled');
                    if (hasIsEnabled) {
                        console.log('[DB] Migrating user_permissions table: renaming is_enabled to access_status...');
                        db.run("ALTER TABLE user_permissions RENAME COLUMN is_enabled TO access_status", (renameErr) => {
                            if (renameErr) {
                                console.error('[DB] Column rename failed:', renameErr.message);
                            } else {
                                console.log('[DB] Column successfully renamed.');
                                runUserPermissionsInitialization();
                            }
                        });
                    } else {
                        runUserPermissionsInitialization();
                    }
                } else {
                    runUserPermissionsInitialization();
                }
            });
        }
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id)", () => {});

    function runUserPermissionsInitialization() {
        const modulesAndFeatures = {
            'Dashboard': ['Access Module', 'Sales', 'Installation', 'Service', 'Ares Installation'],
            'Lead Master': ['Access Module', 'View Leads', 'Add Lead', 'Edit Lead', 'Delete Lead', 'Duplicate Lead', 'Lead Approvals', 'View Revenue', 'Edit Address'],
            'Projects': ['Access Module', 'Leads'],
            'Masters': ['Access Module', 'View Masters', 'Manage Products', 'Manage STC', 'Manage Rebates', 'Manage Margins', 'Manage Charges'],
            'Ares Installation Outside': ['Access Module', 'Installations', 'Outstanding Payments', 'Paid Payments', 'Company Details'],
            'Settings': ['Access Module', 'View Settings', 'Manage Users', 'Manage Roles'],
            'Attendance & Payroll': ['Access Module', 'Employees', 'Leave', 'Timesheets', 'Pay Employee', 'Superannuation']
        };

        db.all("SELECT id, role FROM users", [], (userErr, usersList) => {
            if (userErr || !usersList || usersList.length === 0) return;

            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='field_permissions'", [], (metaErr, tableRow) => {
                const fieldPermissionsTableExists = !metaErr && tableRow;

                usersList.forEach(user => {
                    db.get("SELECT count(*) as count FROM user_permissions WHERE user_id = ?", [user.id], (cntErr, countRow) => {
                        if (!cntErr && countRow && countRow.count === 0) {
                            console.log(`[DB Migration] Initializing permissions for user ID: ${user.id} (${user.role})...`);
                            
                            if (fieldPermissionsTableExists) {
                                db.all("SELECT module_name, feature_name, is_enabled FROM field_permissions WHERE role_name = ?", [user.role], (selErr, fpRows) => {
                                    if (!selErr && fpRows && fpRows.length > 0) {
                                        db.serialize(() => {
                                            const insertStmt = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, module_name, feature_name, access_status) VALUES (?, ?, ?, ?)");
                                            fpRows.forEach(fp => {
                                                insertStmt.run(user.id, fp.module_name, fp.feature_name, fp.is_enabled);
                                            });
                                            insertStmt.finalize();
                                        });
                                    } else {
                                        insertDefaultsForUser(user.id, user.role);
                                    }
                                });
                            } else {
                                insertDefaultsForUser(user.id, user.role);
                            }
                        }
                    });
                });
            });
        });

        function insertDefaultsForUser(userId, role) {
            db.serialize(() => {
                const insertStmt = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, module_name, feature_name, access_status) VALUES (?, ?, ?, ?)");
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
                        insertStmt.run(userId, mod, feat, isEnabled);
                    });
                }
                insertStmt.finalize();
            });
        }
    }

});

module.exports = db;