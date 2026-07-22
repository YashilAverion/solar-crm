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
            voipline_last_sync TEXT,
            is_voip_enabled INTEGER DEFAULT 0
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
            last_update_on TEXT, last_updated_by TEXT,
            show_in_ext_install TEXT DEFAULT 'No'
        )
    `);

    // Migration: Add show_in_ext_install column to products table if it doesn't exist
    db.run("ALTER TABLE products ADD COLUMN show_in_ext_install TEXT DEFAULT 'No'", (err) => {
        if (err) {
            if (!err.message.includes('duplicate column name') && !err.message.includes('already exists')) {
                console.error("Error adding column show_in_ext_install:", err.message);
            }
        } else {
            console.log("Successfully added column show_in_ext_install to products table.");
        }
    });

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

    // 6b. Lead Quotations Table (For logging generated quotation PDFs)
    db.run(`
        CREATE TABLE IF NOT EXISTS lead_quotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER,
            file_name TEXT,
            file_size TEXT,
            file_url TEXT,
            generated_by TEXT,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
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
        "ALTER TABLE payroll_historical_records ADD COLUMN calculation_metadata TEXT",
        "ALTER TABLE payroll_historical_records ADD COLUMN actual_hours REAL DEFAULT 0",
        "ALTER TABLE payroll_historical_records ADD COLUMN remaining_hours REAL DEFAULT 0"
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

    db.run("ALTER TABLE combo_variants ADD COLUMN panel_stock_code TEXT", () => {});
    db.run("ALTER TABLE combo_variants ADD COLUMN inverter_stock_code TEXT", () => {});
    db.run("ALTER TABLE combo_variants ADD COLUMN battery_stock_code TEXT", () => {});

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
            panel_stock_code TEXT,
            inverter_stock_code TEXT,
            battery_stock_code TEXT,
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
            pan_number TEXT,
            aadhaar_number TEXT,
            tax_regime TEXT DEFAULT 'New',
            uan_number TEXT,
            esic_number TEXT,
            pt_state TEXT DEFAULT 'Maharashtra',
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
        "ALTER TABLE attendance_workers ADD COLUMN break_hours_limit TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN pan_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN aadhaar_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN tax_regime TEXT DEFAULT 'New'",
        "ALTER TABLE attendance_workers ADD COLUMN uan_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN esic_number TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN pt_state TEXT DEFAULT 'Maharashtra'",
        "ALTER TABLE attendance_workers ADD COLUMN compliance_documents TEXT",
        "ALTER TABLE attendance_workers ADD COLUMN cl_balance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN sl_balance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN ml_balance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN bank_account_type TEXT DEFAULT 'Savings'",
        "ALTER TABLE attendance_workers ADD COLUMN basic_salary REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN hra REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN special_allowance REAL DEFAULT 0.0",
        "ALTER TABLE attendance_workers ADD COLUMN epf_opt_in INTEGER DEFAULT 1",
        "ALTER TABLE attendance_workers ADD COLUMN esic_opt_in INTEGER DEFAULT 1",
        "ALTER TABLE attendance_workers ADD COLUMN pt_opt_in INTEGER DEFAULT 1"
    ];
    workerAlterStatements.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Migration error for query [${sql}]:`, err.message);
            }
        });
    });

    // Run check constraint migration for employee_compliance_profiles
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_compliance_profiles'", (err, row) => {
        if (row && row.sql && !row.sql.includes('Permanent')) {
            console.log('[DB Migration] Migrating employee_compliance_profiles schema to support Indian compliance types...');
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = OFF;');
                db.run('ALTER TABLE employee_compliance_profiles RENAME TO temp_employee_compliance_profiles;', (renameErr) => {
                    if (renameErr) {
                        console.error('Error renaming employee_compliance_profiles:', renameErr.message);
                        db.run('PRAGMA foreign_keys = ON;');
                        return;
                    }
                    db.run(`
                        CREATE TABLE employee_compliance_profiles (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER UNIQUE,
                            employment_type TEXT NOT NULL CHECK(employment_type IN ('Full-Time', 'Part-Time', 'Casual', 'Permanent', 'Contractual', 'Probationer', 'Trainee')),
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
                    `, (createErr) => {
                        if (createErr) {
                            console.error('Error recreating table employee_compliance_profiles:', createErr.message);
                            db.run('ALTER TABLE temp_employee_compliance_profiles RENAME TO employee_compliance_profiles;');
                            db.run('PRAGMA foreign_keys = ON;');
                            return;
                        }
                        
                        db.run(`
                            INSERT INTO employee_compliance_profiles (
                                id, user_id, employment_type, modern_award_name, base_hourly_rate,
                                casual_loading_active, tax_file_number, tax_scale_code, super_fund_name,
                                super_usi, super_member_number, visa_type, visa_expiry_date, created_at, updated_at
                            ) SELECT 
                                id, user_id, employment_type, modern_award_name, base_hourly_rate,
                                casual_loading_active, tax_file_number, tax_scale_code, super_fund_name,
                                super_usi, super_member_number, visa_type, visa_expiry_date, created_at, updated_at
                            FROM temp_employee_compliance_profiles
                        `, (insertErr) => {
                            if (insertErr) {
                                console.error('Error copying data to employee_compliance_profiles:', insertErr.message);
                            } else {
                                console.log('[DB Migration] Data successfully copied to new employee_compliance_profiles table.');
                                db.run('DROP TABLE temp_employee_compliance_profiles;');
                            }
                            db.run('PRAGMA foreign_keys = ON;');
                        });
                    });
                });
            });
        }
    });

    // Migrate/Create dependent tables referencing attendance_workers(id) instead of users(id)
    migrateTableToWorkers('employee_compliance_profiles', `
        CREATE TABLE IF NOT EXISTS employee_compliance_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            employment_type TEXT NOT NULL CHECK(employment_type IN ('Full-Time', 'Part-Time', 'Casual', 'Permanent', 'Contractual', 'Probationer', 'Trainee')),
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
            actual_hours REAL DEFAULT 0,
            ordinary_hours REAL DEFAULT 0,
            overtime_hours REAL DEFAULT 0,
            remaining_hours REAL DEFAULT 0,
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

    // Create voipline_processing_jobs table and composite indexes for ultra-low latency query targets
    db.run(`
        CREATE TABLE IF NOT EXISTS voipline_processing_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unique_call_id TEXT UNIQUE,
            caller_id TEXT,
            dialed_number TEXT,
            status TEXT DEFAULT 'pending',
            payload TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, () => {});

    db.run("CREATE INDEX IF NOT EXISTS idx_leads_phones_composite ON leads (phone_number, phone_number_2, landline_number)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_voipline_jobs_unique_call_id ON voipline_processing_jobs (unique_call_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_voipline_jobs_composite ON voipline_processing_jobs (caller_id, unique_call_id)", () => {});

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

    // ── LAYOUT MODIFICATIONS TABLE (For persistent premium layout state) ───
    db.run(`
        CREATE TABLE IF NOT EXISTS layout_modifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            layout_state TEXT NOT NULL,
            telemetry_flags TEXT DEFAULT '{}',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id)
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating layout_modifications table:', err.message);
        else console.log('[DB] layout_modifications table ready.');
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_layout_modifications_user_id ON layout_modifications(user_id)", () => {});

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

    // ── SYSTEM FILE OPERATIONS TABLE ───
    db.run(`
        CREATE TABLE IF NOT EXISTS system_file_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action_type TEXT CHECK(action_type IN ('Download', 'Delete')),
            file_name TEXT NOT NULL,
            file_size TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating system_file_operations table:', err.message);
        else console.log('[DB] system_file_operations table ready.');
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_sys_file_ops_user_id ON system_file_operations(user_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_sys_file_ops_time ON system_file_operations(timestamp)", () => {});

    // ── POSTCODE YIELD FACTORS TABLE ───
    db.run(`
        CREATE TABLE IF NOT EXISTS postcode_yield_factors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postcode_prefix TEXT UNIQUE,
            provider TEXT,
            jan REAL, feb REAL, mar REAL, apr REAL, may REAL, jun REAL,
            jul REAL, aug REAL, sep REAL, oct REAL, nov REAL, dec REAL
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating postcode_yield_factors table:', err.message);
        else {
            console.log('[DB] postcode_yield_factors table ready.');
            // Seed postcode yield factors for WA postcodes starting with 60, 61, 62, 67, and default
            db.serialize(() => {
                const seedStmt = db.prepare(`
                    INSERT OR IGNORE INTO postcode_yield_factors (postcode_prefix, provider, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                // WA standard (Perth - Synergy)
                seedStmt.run('60', 'Synergy', 7.5, 7.2, 6.3, 4.8, 3.5, 2.9, 3.1, 3.9, 5.0, 6.2, 7.0, 7.4);
                seedStmt.run('61', 'Synergy', 7.5, 7.2, 6.3, 4.8, 3.5, 2.9, 3.1, 3.9, 5.0, 6.2, 7.0, 7.4);
                seedStmt.run('62', 'Synergy', 7.2, 6.8, 5.8, 4.4, 3.2, 2.7, 2.9, 3.6, 4.7, 5.8, 6.6, 7.1);
                // Regional WA (Horizon Power)
                seedStmt.run('67', 'Horizon Power', 8.2, 7.8, 7.2, 6.2, 5.2, 4.8, 5.0, 5.8, 6.8, 7.6, 8.0, 8.3);
                // Default fallback
                seedStmt.run('default', 'Default', 5.5, 5.2, 4.5, 3.8, 3.0, 2.5, 2.7, 3.2, 4.0, 4.8, 5.2, 5.5);
                seedStmt.finalize();
            });
        }
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_postcode_yield_prefix ON postcode_yield_factors(postcode_prefix)", () => {});

    // ── UTILITY RATE ASSUMPTIONS TABLE ───
    db.run(`
        CREATE TABLE IF NOT EXISTS utility_rate_assumptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT UNIQUE,
            supply_charge_per_day REAL,
            electricity_unit_rate REAL,
            feed_in_tariff REAL
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating utility_rate_assumptions table:', err.message);
        else {
            console.log('[DB] utility_rate_assumptions table ready.');
            db.serialize(() => {
                const seedStmt = db.prepare(`
                    INSERT OR IGNORE INTO utility_rate_assumptions (provider, supply_charge_per_day, electricity_unit_rate, feed_in_tariff)
                    VALUES (?, ?, ?, ?)
                `);
                seedStmt.run('Synergy', 1.05, 0.30, 0.08);
                seedStmt.run('Western Power', 1.05, 0.30, 0.08);
                seedStmt.run('Horizon Power', 1.15, 0.35, 0.10);
                seedStmt.run('Default', 1.00, 0.28, 0.05);
                seedStmt.finalize();
            });
        }
    });
    db.run("CREATE INDEX IF NOT EXISTS idx_utility_rate_provider ON utility_rate_assumptions(provider)", () => {});

    // ── SAFE MIGRATION: Add is_voip_enabled to existing users tables ───
    db.all("PRAGMA table_info(users)", [], (pragmaErr, cols) => {
        if (pragmaErr) { console.error('[DB Migration] Could not inspect users table:', pragmaErr.message); return; }
        const hasVoipEnabled = (cols || []).some(c => c.name === 'is_voip_enabled');
        if (!hasVoipEnabled) {
            db.run("ALTER TABLE users ADD COLUMN is_voip_enabled INTEGER DEFAULT 0", (alterErr) => {
                if (alterErr) console.error('[DB Migration] Failed to add is_voip_enabled column:', alterErr.message);
                else console.log('[DB Migration] Added is_voip_enabled column to users table successfully.');
            });
        } else {
            console.log('[DB] users.is_voip_enabled column already present — no migration needed.');
        }
    });

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
                let pendingUsers = usersList.length;

                const checkCleanup = () => {
                    pendingUsers--;
                    if (pendingUsers === 0 && fieldPermissionsTableExists) {
                        console.log('[DB Migration] All users checked. Safely dropping deprecated field_permissions table...');
                        db.run("DROP TABLE IF EXISTS field_permissions", (dropErr) => {
                            if (dropErr) console.error('[DB] Error dropping field_permissions table:', dropErr.message);
                            else console.log('[DB] Deprecated field_permissions table successfully dropped.');
                        });
                    }
                };

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
                                            insertStmt.finalize((finErr) => {
                                                checkCleanup();
                                            });
                                        });
                                    } else {
                                        insertDefaultsForUser(user.id, user.role, checkCleanup);
                                    }
                                });
                            } else {
                                insertDefaultsForUser(user.id, user.role, checkCleanup);
                            }
                        } else {
                            checkCleanup();
                        }
                    });
                });
            });
        });

        function insertDefaultsForUser(userId, role, callback) {
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
                insertStmt.finalize((err) => {
                    if (callback) callback();
                });
            });
        }
    }

    // ── EMPLOYEE COMPLIANCE & LEGAL DOCUMENTS TABLES ───
    db.run(`
        CREATE TABLE IF NOT EXISTS employee_compliance_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            department TEXT NOT NULL,
            designation TEXT NOT NULL,
            base_salary REAL NOT NULL,
            shift_start_time TEXT DEFAULT '03:30 AM',
            probation_period_months INTEGER DEFAULT 3,
            notice_period_days INTEGER DEFAULT 45,
            annual_leave_quota INTEGER DEFAULT 24,
            gratuity_eligible INTEGER DEFAULT 0,
            incentive_hold_flag INTEGER DEFAULT 0,
            onboarding_date TEXT NOT NULL,
            proposed_joining_date TEXT,
            assets_laptops TEXT DEFAULT '',
            assets_desktops TEXT DEFAULT '',
            assets_mobiles TEXT DEFAULT '',
            assets_sims TEXT DEFAULT '',
            assets_ids TEXT DEFAULT '',
            assets_access_cards TEXT DEFAULT '',
            assets_licenses TEXT DEFAULT '',
            surveillance_consent INTEGER DEFAULT 0,
            biometric_consent INTEGER DEFAULT 0,
            hrms_consent INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating employee_compliance_profiles table:', err.message);
        else console.log('[DB] employee_compliance_profiles table ready.');
    });

    const complianceAlterColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_laptops TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_desktops TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_mobiles TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_sims TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_ids TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_access_cards TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN assets_licenses TEXT DEFAULT ''",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN surveillance_consent INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN biometric_consent INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN hrms_consent INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN employee_id TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN full_name TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN department TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN designation TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN base_salary REAL",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN shift_start_time TEXT DEFAULT '03:30 AM'",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN probation_period_months INTEGER DEFAULT 3",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN notice_period_days INTEGER DEFAULT 45",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN annual_leave_quota INTEGER DEFAULT 24",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN gratuity_eligible INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN incentive_hold_flag INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN onboarding_date TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN proposed_joining_date TEXT"
    ];

    complianceAlterColumns.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                // Ignore duplicate column errors
            }
        });
    });

    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_employee_id ON employee_compliance_profiles (employee_id) WHERE employee_id IS NOT NULL", () => {});

    db.run(`
        CREATE TABLE IF NOT EXISTS legal_signed_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            document_type TEXT NOT NULL,
            signed_status INTEGER DEFAULT 0,
            generated_blob_text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating legal_signed_documents table:', err.message);
        else console.log('[DB] legal_signed_documents table ready.');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS averion_hr_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT DEFAULT 'Averion Global LLP',
            registered_address TEXT DEFAULT 'Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060',
            gst_number TEXT DEFAULT '24ACMFA7488G1Z0',
            pan_number TEXT DEFAULT 'ACMFA7488G',
            policy_employment_agreement TEXT,
            policy_mobile_phone TEXT,
            policy_rest_breaks TEXT,
            policy_data_protection TEXT,
            policy_employee_leave TEXT
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating averion_hr_policies:', err.message);
        else {
            console.log('[DB] Table averion_hr_policies ready.');
            db.get(`SELECT COUNT(*) as count FROM averion_hr_policies`, [], (seedErr, row) => {
                if (!seedErr && row && row.count === 0) {
                    db.run(`INSERT INTO averion_hr_policies (
                        company_name, registered_address, gst_number, pan_number,
                        policy_employment_agreement, policy_mobile_phone, policy_rest_breaks, policy_data_protection, policy_employee_leave
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                        'Averion Global LLP',
                        'Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060',
                        '24ACMFA7488G1Z0',
                        'ACMFA7488G',
                        'Employment Agreement Policy text template content goes here.',
                        'Mobile & Phone Policy text template content goes here.',
                        'Rest Breaks Policy text template content goes here.',
                        'Data Protection Policy text template content goes here.',
                        'Employee Leave Policy text template content goes here.'
                    ]);
                }
            });
        }
    });

    // Initialize/seed averion_corporate_registry
    db.run(`
        CREATE TABLE IF NOT EXISTS averion_corporate_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            registered_office TEXT NOT NULL,
            gstin TEXT NOT NULL,
            pan_card TEXT NOT NULL,
            letterhead_logo TEXT
        )
    `, (err) => {
        if (!err) {
            db.get(`SELECT COUNT(*) as count FROM averion_corporate_registry`, [], (checkErr, row) => {
                if (!checkErr && row && row.count === 0) {
                    db.run(`
                        INSERT INTO averion_corporate_registry (company_name, registered_office, gstin, pan_card, letterhead_logo)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        'Averion Global LLP',
                        'Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060',
                        '24ACMFA7488G1Z0',
                        'ACMFA7488G',
                        'averion_logo.jpg'
                    ]);
                }
            });
        }
    });

    const docAlterColumns = [
        "ALTER TABLE legal_signed_documents ADD COLUMN generated_text_payload TEXT",
        "ALTER TABLE legal_signed_documents ADD COLUMN email_sent_status INTEGER DEFAULT 0",
        "ALTER TABLE legal_signed_documents ADD COLUMN document_category_type TEXT",
        "ALTER TABLE legal_signed_documents ADD COLUMN compiled_html_payload TEXT"
    ];

    docAlterColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors
        });
    });

    const additionalProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN base_salary_scale REAL",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN allocated_leaves INTEGER",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN probation_months INTEGER",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN notice_days INTEGER",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN shift_schedule_string TEXT"
    ];

    additionalProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors
        });
    });

    // Phase 2: Employment Documents & Agreements Kit
    const phase2ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN is_intern INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN stipend_amount REAL",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN probation_end_date TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN contract_version INTEGER DEFAULT 1"
    ];

    phase2ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 3: Workspace Safety, Confidentiality & Security Kit
    const phase3ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN device_surveillance_consent INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN nda_version_signed INTEGER DEFAULT 1",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN security_clearance_timestamp TEXT"
    ];

    phase3ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 4: Leave, Transition & Combined Onboarding Package Kit
    const phase4ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN accrued_leaves_balance INTEGER DEFAULT 24",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN director_approval_status INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN exit_interview_status TEXT"
    ];

    phase4ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 5: Sales Performance & Operations Kit
    const phase5ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN sales_target_amount REAL DEFAULT 0.0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN commission_slab_percentage REAL DEFAULT 0.0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN kra_signoff_status INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN incentive_hold_count INTEGER DEFAULT 0"
    ];

    phase5ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 6: Disciplinary Actions, Show Cause, & Workplace Disputes Kit
    const phase6ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN disciplinary_warnings_count INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN show_cause_status TEXT DEFAULT 'NONE'",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN active_suspension_flag INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN dispute_filing_timestamp TEXT"
    ];

    phase6ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 7: Compliance Logs, Registers & Final Termination Kit
    const phase7ProfileColumns = [
        "ALTER TABLE employee_compliance_profiles ADD COLUMN posh_training_status INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN statutory_declaration_signed INTEGER DEFAULT 0",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN final_dismissal_timestamp TEXT",
        "ALTER TABLE employee_compliance_profiles ADD COLUMN compliance_audit_log_id TEXT"
    ];

    phase7ProfileColumns.forEach(sql => {
        db.run(sql, (err) => {
            // Ignore duplicate column errors silently
        });
    });

    // Phase 8: Post-Deployment Maintenance & Compliance Audit Kit
    db.run(`
        CREATE TABLE IF NOT EXISTS averion_compliance_audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_timestamp TEXT,
            total_active_workers INTEGER,
            pending_signatures_count INTEGER,
            archived_logs_summary TEXT
        )
    `, (err) => {
        if (err) console.error('[DB] Error creating averion_compliance_audits table:', err.message);
    });

    // Migration: add overtime eligibility column
    db.run("ALTER TABLE employee_compliance_profiles ADD COLUMN is_overtime_eligible INTEGER DEFAULT 1", (err) => {
        // Ignore duplicate column errors silently
    });

    db.run("CREATE INDEX IF NOT EXISTS idx_signed_docs_employee_id ON legal_signed_documents (employee_id)", () => {});
    db.run("CREATE INDEX IF NOT EXISTS idx_signed_docs_document_type ON legal_signed_documents (document_type)", () => {});

    // ── SALES COMPLIANCE & OBJECTION MATRIX EXTENSION ──────────────────
    // 1. sales_compliance_scripts table
    db.run(`
        CREATE TABLE IF NOT EXISTS sales_compliance_scripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state_code TEXT,
            system_type TEXT,
            current_stage TEXT,
            mandatory_questions_json TEXT
        )
    `);

    // 2. compliance_objection_matrix table
    db.run(`
        CREATE TABLE IF NOT EXISTS compliance_objection_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            objection TEXT,
            response TEXT,
            formula_parameters_json TEXT,
            documentation_checklist_json TEXT
        )
    `);

    // 3. sales_telemetry_live_state table
    db.run(`
        CREATE TABLE IF NOT EXISTS sales_telemetry_live_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER UNIQUE,
            active_state_code TEXT,
            current_script_node TEXT,
            interruption_counter INTEGER DEFAULT 0,
            is_recording_active INTEGER DEFAULT 1,
            is_console_expanded INTEGER DEFAULT 0,
            last_telemetry_event TEXT,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    `);

    db.run("ALTER TABLE sales_telemetry_live_state ADD COLUMN is_console_expanded INTEGER DEFAULT 0", (err) => {});
    db.run("ALTER TABLE sales_telemetry_live_state ADD COLUMN last_telemetry_event TEXT", (err) => {});

    // 3.5 telephony_live_voice_sync table
    db.run(`
        CREATE TABLE IF NOT EXISTS telephony_live_voice_sync (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER UNIQUE,
            live_captions_transcript TEXT,
            extracted_intent_analytics_json TEXT,
            automation_sync_status TEXT,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    `);

    // 3.7 compliance_console_sessions table
    db.run(`
        CREATE TABLE IF NOT EXISTS compliance_console_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER UNIQUE,
            current_stage TEXT,
            auto_parsed_keywords_json TEXT,
            purchase_probability INTEGER DEFAULT 50,
            step_validation_flags TEXT,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
        )
    `);

    // 3.9 telephony_compliance_rules_matrix table
    db.run(`
        CREATE TABLE IF NOT EXISTS telephony_compliance_rules_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state_code TEXT,
            target_field TEXT,
            matching_keywords TEXT,
            action_value TEXT
        )
    `);

    // 3.11 telephony_admin_audit_logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS telephony_admin_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            lead_id INTEGER,
            rep_user_id INTEGER,
            full_transcript_snapshot TEXT,
            calculated_metrics_json TEXT,
            execution_latency_ms INTEGER,
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3.12 voip_production_readiness table
    db.run(`
        CREATE TABLE IF NOT EXISTS voip_production_readiness (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            is_system_active INTEGER DEFAULT 1,
            last_heartbeat_status TEXT DEFAULT 'READY',
            successful_sync_count INTEGER DEFAULT 0,
            last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 3.13 voipline_stream_mappings table
    db.run("DROP TABLE IF EXISTS voipline_stream_mappings", () => {
        db.run(`
            CREATE TABLE IF NOT EXISTS voipline_stream_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER UNIQUE,
                unique_call_id TEXT UNIQUE,
                caller_id TEXT,
                dest_number TEXT,
                sip_status TEXT DEFAULT 'ANSWERED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    // 3.14 telephony_raw_ingress_logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS telephony_raw_ingress_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload TEXT,
            headers TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3.15 telephony_ingress_production_logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS telephony_ingress_production_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin_ip TEXT,
            raw_body_json TEXT,
            processed_status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4. Migrate leads table columns (safe check and alter)
    db.run("ALTER TABLE telephony_admin_audit_logs ADD COLUMN network_exception_flags TEXT", (err) => {
        // Safe to ignore if column already exists
    });
    db.run("ALTER TABLE leads ADD COLUMN compliance_stage TEXT DEFAULT 'Greeting'", (err) => {
        // Safe to ignore if column already exists
    });
    db.run("ALTER TABLE leads ADD COLUMN compliance_completed_questions TEXT DEFAULT '[]'", (err) => {
        // Safe to ignore if column already exists
    });
    db.run("ALTER TABLE leads ADD COLUMN compliance_checklist_status TEXT DEFAULT '[]'", (err) => {
        // Safe to ignore if column already exists
    });

    // 4. Create indices for compliance modules
    db.run("CREATE INDEX IF NOT EXISTS idx_sales_comp_scripts ON sales_compliance_scripts (state_code, system_type, current_stage)");
    db.run("CREATE INDEX IF NOT EXISTS idx_comp_obj_matrix_cat ON compliance_objection_matrix (category)");

    // 5. Seed default compliance scripts & objection matrix if empty or missing new premium values
    db.get("SELECT (SELECT COUNT(*) FROM sales_compliance_scripts WHERE mandatory_questions_json LIKE '%Averion Global%' OR mandatory_questions_json LIKE '%Averlon%') as count1, (SELECT COUNT(*) FROM sales_compliance_scripts WHERE mandatory_questions_json LIKE '%Jinko%' OR mandatory_questions_json LIKE '%Ares Energy%') as count2", [], (err, checkRow) => {
        const hasAverion = !err && checkRow && checkRow.count1 > 0;
        const isEmpty = !err && (!checkRow || checkRow.count2 === 0);
        if (hasAverion || isEmpty) {
            console.log('[COMPLIANCE] Reseeding default sales compliance scripts with premium closing matrix...');
            db.run("DELETE FROM sales_compliance_scripts", () => {
                const defaultScripts = [];
                const states = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS'];
                const systems = ['PV', 'Battery', 'Combined'];
                const stages = ['Greeting', 'Pre-Qualification', 'Engineering Proposal', 'Financials & Rebates', 'Agreement'];

                states.forEach(st => {
                    systems.forEach(sys => {
                        stages.forEach(stage => {
                            let questions = [];
                            if (stage === 'Greeting') {
                                questions = [
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_greet_1`, text: `State your name and company: Ares Energy. Establish professional identity and confidence with a warm Australian greeting: 'Good day! Thanks for speaking with us today. This is Yashil from Ares Energy.'`, badge: "READ NOW" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_greet_2`, text: `Ask if they are the registered property owner at 7 Girona Street, Piara Waters WA 6112, establishing a rapid diagnostic hook.`, badge: "WAIT FOR CUSTOMER" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_greet_3`, text: `COURTESY ALERT: Apologise & Await Turn if interrupted. Remind that Ares Energy complies with Australian Consumer Law.`, badge: "COURTESY ALERT" }
                                ];
                            } else if (stage === 'Pre-Qualification') {
                                questions = [
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_pre_1`, text: `Confirm average quarterly power bill is above $300 to qualify for high yield returns.`, badge: "WAIT FOR CUSTOMER" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_pre_2`, text: `Confirm roof structure suitability (tin/tile), storing site photo trackers for rafters, meter, board, and roof.`, badge: "WAIT FOR CUSTOMER" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_pre_3`, text: `Verify electrical phase layout (single phase vs three phase) and house storey counts.`, badge: "WAIT FOR CUSTOMER" }
                                ];
                            } else if (stage === 'Engineering Proposal') {
                                questions = [
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_eng_1`, text: `Detail expected daily yield math calculation: Daily Yield (kWh) = System Size (kW) * Peak Sun Hours * 0.82 efficiency.`, badge: "READ NOW" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_eng_2`, text: `Explain strict wind loading boundary offsets (minimum 200mm margin) as per AS/NZS 5033 guidelines.`, badge: "CRUCIAL COMPLIANCE BOUNDARY" }
                                ];
                                if (sys === 'Battery' || sys === 'Combined') {
                                    questions.push({ id: `${st.toLowerCase()}_${sys.toLowerCase()}_eng_3`, text: `Explain AS/NZS 5139 fire safety clearances, non-combustible backing plate installation, and ventilation requirements for Fox ESS battery.`, badge: "CRUCIAL COMPLIANCE BOUNDARY" });
                                } else {
                                    questions.push({ id: `${st.toLowerCase()}_${sys.toLowerCase()}_eng_3`, text: `Verify meter board space clearances for Growatt inverter mounting.`, badge: "READ NOW" });
                                }
                            } else if (stage === 'Financials & Rebates') {
                                if (st === 'VIC') {
                                    questions = [
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_1`, text: `Outline Solar Victoria rebate eligibility ($1400 subsidy and matching interest-free loan option).`, badge: "READ NOW" },
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_2`, text: `Outline upfront Federal STC rebate discount applied directly to the invoice.`, badge: "READ NOW" }
                                    ];
                                } else if (st === 'NSW') {
                                    questions = [
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_1`, text: `Detail NSW Peak Demand Reduction Scheme (PDRS) battery certificate returns to discount upfront cost.`, badge: "READ NOW" },
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_2`, text: `Outline upfront Federal STC rebate discount applied directly to the invoice.`, badge: "READ NOW" }
                                    ];
                                } else if (st === 'SA') {
                                    questions = [
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_1`, text: `Detail SA Virtual Power Plant (VPP) eligibility and distributor dynamic flexible export limits (1.5kW to 10kW).`, badge: "READ NOW" },
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_2`, text: `Outline upfront Federal STC rebate discount applied directly to the invoice.`, badge: "READ NOW" }
                                    ];
                                } else {
                                    questions = [
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_1`, text: `Explain Small-scale Technology Certificate (STC) rebate multipliers and local distributor connection approvals.`, badge: "READ NOW" },
                                        { id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_2`, text: `Outline upfront Federal STC rebate discount applied directly to the invoice.`, badge: "READ NOW" }
                                    ];
                                }
                                questions.push({ id: `${st.toLowerCase()}_${sys.toLowerCase()}_fin_3`, text: `State: Ares Energy complies with Australian Consumer Law providing a 10-business-day cooling-off period.`, badge: "CRUCIAL COMPLIANCE BOUNDARY" });
                            } else if (stage === 'Agreement') {
                                questions = [
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_agr_1`, text: `Detail premium component selection: Jinko PV modules (N-type, 25-yr performance warranty) and Growatt/Fox ESS configurations.`, badge: "READ NOW" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_agr_2`, text: `Secure formal verbal agreement under Australian Consumer Law, confirming NMI and installation address.`, badge: "READ NOW" },
                                    { id: `${st.toLowerCase()}_${sys.toLowerCase()}_agr_3`, text: `Verify connection pre-approval submission timeline (within 24 hours of verbal deposit).`, badge: "READ NOW" }
                                ];
                            }

                            defaultScripts.push({
                                state_code: st,
                                system_type: sys,
                                current_stage: stage,
                                mandatory_questions_json: JSON.stringify(questions)
                            });
                        });
                    });
                });

                const stmt = db.prepare("INSERT INTO sales_compliance_scripts (state_code, system_type, current_stage, mandatory_questions_json) VALUES (?, ?, ?, ?)");
                defaultScripts.forEach(s => {
                    stmt.run(s.state_code, s.system_type, s.current_stage, s.mandatory_questions_json);
                });
                stmt.finalize();
            });
        }
    });

    db.get("SELECT COUNT(*) as count FROM compliance_objection_matrix WHERE response LIKE '%Fox ESS%'", [], (err, checkRow) => {
        if (!err && (!checkRow || checkRow.count === 0)) {
            console.log('[COMPLIANCE] Reseeding default compliance objection matrix...');
            db.run("DELETE FROM compliance_objection_matrix", () => {
                const defaultObjections = [
                    {
                        category: 'House/Roof',
                        objection: "My roof is shaded by trees in the afternoon. Can I still install solar?",
                        response: "No worries! Under AS/NZS 5033 regulations, we design around shade. We can utilize micro-inverters or DC optimizers so that shade on one module doesn't drag down the whole array. We maintain a strict 200mm boundary offset from all roof edges for structural stability in high winds.",
                        formula_parameters_json: JSON.stringify({ shading_impact_reduction_pct: 15, roof_edge_boundary_mm: 200 }),
                        documentation_checklist_json: JSON.stringify(["Structural Compliance Waiver", "Site Photo Log: Afternoon Shading Area"])
                    },
                    {
                        category: 'House/Roof',
                        objection: "Is my roof angle okay for solar?",
                        response: "Most Australian roofs are pitched between 15 and 30 degrees, which is perfect for solar. If your roof is flat or steep, we adjust the output metrics or design special tilt frames to maximize the yield. Under AS/NZS 5033, the rails must be securely clamped to rafters.",
                        formula_parameters_json: JSON.stringify({ optimal_pitch_deg: "15-30", mounting_standard: "AS/NZS 5033" }),
                        documentation_checklist_json: JSON.stringify(["Site Photo Log: Rafter Pitch Check", "Roof Structural Certification"])
                    },
                    {
                        category: 'PV Tech',
                        objection: "What panels and inverters do you supply?",
                        response: "We install premium tier-1 Jinko PV modules (N-type technology with a 25-year linear performance warranty) and CEC-approved Growatt inverters. These components have a standard 10-year manufacturer replacement warranty and guarantee structural longevity against extreme Australian weather.",
                        formula_parameters_json: JSON.stringify({ optimal_panel_type: "Jinko PV Modules", optimal_inverter_type: "Growatt Inverters" }),
                        documentation_checklist_json: JSON.stringify(["Panel Datasheet", "Manufacturer Linear Warranty Certificate"])
                    },
                    {
                        category: 'PV Tech',
                        objection: "What is the degradation rate of the solar PV system?",
                        response: "Jinko N-type panels guarantee extremely low degradation—no more than 1% in the first year and 0.4% per year thereafter. This ensures you still receive at least 87.4% of original power output after 25 years.",
                        formula_parameters_json: JSON.stringify({ annual_degradation_rate: 0.004, performance_warranty_years: 25 }),
                        documentation_checklist_json: JSON.stringify(["Panel Datasheet", "Manufacturer Linear Warranty Certificate"])
                    },
                    {
                        category: 'Battery/VPP',
                        objection: "Where will you install the battery, and is it safe?",
                        response: "Safety is our absolute priority. We comply 100% with AS/NZS 5139. The Fox ESS battery must be installed on a non-combustible backing plate (FC sheet) and cannot be located near doors, windows, steps, or directly under habitable rooms. We provide full fire safety location compliance.",
                        formula_parameters_json: JSON.stringify({ as_nzs_5139_compliant: true, battery_heat_ventilation_clearance_mm: 300 }),
                        documentation_checklist_json: JSON.stringify(["Site Photo Log: Battery Backing & Clearances", "Fire Safety Compliance Declaration"])
                    },
                    {
                        category: 'Battery/VPP',
                        objection: "What is a VPP and what is the dynamic export limit?",
                        response: "A Virtual Power Plant (VPP) allows a network provider or retailer to draw energy from your battery to support the grid during high-demand peaks, in exchange for regular credits or discounted electricity. In SA, SAPN enforces dynamic export limits which can adjust exports from 1.5kW to 10kW depending on grid congestion.",
                        formula_parameters_json: JSON.stringify({ sa_vpp_flexible_export_limit_kw: 1.5, battery_discharge_power_kw: 5.0 }),
                        documentation_checklist_json: JSON.stringify(["VPP Terms & Consent Form", "Distributor Grid Export Pre-Approval"])
                    },
                    {
                        category: 'Rebates',
                        objection: "How does the Solar Victoria rebate work?",
                        response: "For Victorian residents, the Solar Victoria program provides a rebate of up to $1,400, plus the option of an interest-free loan of the same amount. We submit the pre-approval request on your behalf, and you must verify your income status via the Solar Victoria portal to release the voucher before installation.",
                        formula_parameters_json: JSON.stringify({ vic_rebate_max_amount: 1400, interest_free_loan_eligible: true }),
                        documentation_checklist_json: JSON.stringify(["Solar Victoria Voucher Pre-Approval", "Electricity Retailer NMI Match File"])
                    },
                    {
                        category: 'Rebates',
                        objection: "What are NSW PDRS certificates?",
                        response: "In New South Wales, the Peak Demand Reduction Scheme (PDRS) rewards you with Energy Savings Certificates for installing battery systems that can support the grid. The certificates reduce the upfront cost of your battery by hundreds of dollars depending on battery capacity.",
                        formula_parameters_json: JSON.stringify({ pdrs_certificate_coefficient: 0.12, average_pdrs_rebate_aud: 800 }),
                        documentation_checklist_json: JSON.stringify(["NSW Grid Connect Application", "PDRS Certificate Consent Form"])
                    },
                    {
                        category: 'Legal',
                        objection: "Can I cancel the agreement if I change my mind?",
                        response: "Absolutely. Under the Australian Consumer Law, we provide a mandatory 10-business-day cooling-off period. During these 10 days, you can cancel the verbal or written contract for any reason without penalty and receive a full refund of your deposit.",
                        formula_parameters_json: JSON.stringify({ cooling_off_days: 10, refund_policy: "100% Refundable" }),
                        documentation_checklist_json: JSON.stringify(["Signed Quotation Agreement", "ACL Consumer Rights Statement"])
                    }
                ];

                const stmt = db.prepare("INSERT INTO compliance_objection_matrix (category, objection, response, formula_parameters_json, documentation_checklist_json) VALUES (?, ?, ?, ?, ?)");
                defaultObjections.forEach(obj => {
                    stmt.run(obj.category, obj.objection, obj.response, obj.formula_parameters_json, obj.documentation_checklist_json);
                });
                stmt.finalize();
            });
        }
    });

    db.get("SELECT COUNT(*) as count FROM telephony_compliance_rules_matrix", [], (err, checkRow) => {
        if (!err && (!checkRow || checkRow.count === 0)) {
            console.log('[COMPLIANCE] Seeding telephony compliance rules matrix...');
            const defaultRules = [
                { state_code: 'ALL', target_field: 'roof_type', matching_keywords: 'tin roof,corrugated iron,colorbond sheet,tin,colorbond,metal roof,sheet metal', action_value: 'Tin' },
                { state_code: 'ALL', target_field: 'roof_type', matching_keywords: 'tile roof,concrete tile,terracotta tile,tiles,tile,clay tile', action_value: 'Tile' },
                { state_code: 'ALL', target_field: 'phase', matching_keywords: 'three phase grid,3-phase setup,polyphase system,three phase,3 phase,three-phase,3-phase', action_value: '3' },
                { state_code: 'ALL', target_field: 'phase', matching_keywords: 'single phase,1 phase,single-phase,1-phase', action_value: '1' },
                { state_code: 'ALL', target_field: 'house_storey', matching_keywords: 'double storey,two levels,upstairs array,double-storey,two storey,two-storey', action_value: 'Double' },
                { state_code: 'ALL', target_field: 'house_storey', matching_keywords: 'single storey,one level,single-storey,one storey,one-storey', action_value: 'Single' },
                { state_code: 'ALL', target_field: 'house_storey', matching_keywords: 'multi storey,three levels,multi-storey,three storey,three-storey', action_value: 'Multi' },
                { state_code: 'ALL', target_field: 'battery_location', matching_keywords: 'inside the garage,interior mounting,inside,garage,indoors,indoor', action_value: 'Inside' },
                { state_code: 'ALL', target_field: 'battery_location', matching_keywords: 'outside,outdoors,exterior mounting,exterior,outdoor', action_value: 'Outside' }
            ];

            const stmt = db.prepare("INSERT INTO telephony_compliance_rules_matrix (state_code, target_field, matching_keywords, action_value) VALUES (?, ?, ?, ?)");
            defaultRules.forEach(r => {
                stmt.run(r.state_code, r.target_field, r.matching_keywords, r.action_value);
            });
            stmt.finalize();
        }
    });

    // 13. Specialized device registration and sync tables
    db.run(`
        CREATE TABLE IF NOT EXISTS omni_device_auth_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT UNIQUE,
            user_id INTEGER,
            device_token TEXT,
            platform TEXT,
            auth_status TEXT DEFAULT 'authenticated',
            last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS mobile_app_device_sync (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            user_id INTEGER,
            attendance_status TEXT,
            timezone TEXT DEFAULT 'Australia/Sydney',
            latitude REAL,
            longitude REAL,
            sync_payload TEXT,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Email Templates Table
    db.run(`
        CREATE TABLE IF NOT EXISTS email_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Quotation',
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            variables_list TEXT,
            is_default INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, () => {
        db.get("SELECT COUNT(*) as count FROM email_templates", [], (err, row) => {
            if (!err && row && row.count === 0) {
                console.log("[DB] Seeding default Email Templates...");
                const stmt = db.prepare(`
                    INSERT INTO email_templates (template_name, category, subject, body, variables_list, is_default, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `);

                stmt.run(
                    'Quotation Proposal Template',
                    'Quotation',
                    'Your Solar Quotation — {project_number}',
                    `Dear {customer_name},\n\nPlease find attached your personalised solar quotation ({project_number}) from Ares Energy for your property at {address}.\n\nSystem Details:\n• System Size: {system_size}\n• Total Investment: {total_price}\n\nIf you have any questions or would like to discuss the proposal further, please don't hesitate to contact me.\n\nWarm regards,\n{sales_rep_name}\nAres Energy Team\nPhone: {company_phone}\nEmail: {company_email}\nWeb: www.aresenergy.com.au`,
                    JSON.stringify(['{customer_name}', '{project_number}', '{address}', '{system_size}', '{total_price}', '{sales_rep_name}', '{company_phone}', '{company_email}']),
                    1
                );

                stmt.run(
                    'Sales Follow-Up & Special Offer',
                    'Follow Up',
                    'Following Up on Your Solar Proposal — {project_number}',
                    `Dear {customer_name},\n\nI hope you are having a great week.\n\nI wanted to quickly follow up regarding the solar quotation ({project_number}) we recently sent for your property at {address}.\n\nDo you have any questions about the proposed system size ({system_size}), government rebates, or financial payback timeline?\n\nWe would love to help you lock in current rebate incentives before upcoming scheme updates.\n\nPlease let me know a convenient time for a brief call.\n\nWarm regards,\n{sales_rep_name}\nAres Energy Team\nPhone: {company_phone}`,
                    JSON.stringify(['{customer_name}', '{project_number}', '{address}', '{system_size}', '{sales_rep_name}', '{company_phone}']),
                    0
                );

                stmt.run(
                    'Installation Booking Confirmation',
                    'Installation',
                    'Installation Schedule & Next Steps — {project_number}',
                    `Dear {customer_name},\n\nThank you for choosing Ares Energy for your solar installation ({project_number}).\n\nWe are preparing your project documentation for grid connection approval. Our technical team will be in touch shortly to confirm the scheduled installation date and roof access details.\n\nProject Summary:\n• Address: {address}\n• System Size: {system_size}\n\nShould you need to update any contact details, please let us know.\n\nWarm regards,\nAres Energy Operations Team\nPhone: {company_phone}\nEmail: {company_email}`,
                    JSON.stringify(['{customer_name}', '{project_number}', '{address}', '{system_size}', '{company_phone}', '{company_email}']),
                    0
                );

                stmt.run(
                    'Site Assessment Audit Request',
                    'Site Audit',
                    'Site Assessment & Inspection Confirmation — {project_number}',
                    `Dear {customer_name},\n\nOur technical team is scheduling a site assessment for your solar installation ({project_number}) at {address}.\n\nOur clean energy technician will inspect the meter box, roof condition, and rafter layout to ensure a seamless installation process.\n\nPlease confirm if your preferred time slot works for you.\n\nWarm regards,\n{sales_rep_name}\nAres Energy Technical Team\nPhone: {company_phone}`,
                    JSON.stringify(['{customer_name}', '{project_number}', '{address}', '{sales_rep_name}', '{company_phone}']),
                    0
                );

                stmt.run(
                    'Deposit & Payment Notice',
                    'Payment',
                    'Payment Receipt & Deposit Confirmation — {project_number}',
                    `Dear {customer_name},\n\nWe have received your payment update for solar project {project_number}.\n\nThank you for your prompt response. Your order is now officially locked in for equipment dispatch.\n\nIf you have any questions, please contact our accounts team at {company_email}.\n\nWarm regards,\nAres Energy Accounts Team\nPhone: {company_phone}`,
                    JSON.stringify(['{customer_name}', '{project_number}', '{company_email}', '{company_phone}']),
                    0
                );

                stmt.finalize();
            }
        });
    });

});

// Telephone number normalizer helper: extracts the last 9 digits of a numeric string
db.normalizePhoneToSuffix = function(num) {
    if (!num) return '';
    // Strip all whitespaces, dashes, templates, and symbols
    let str = String(num).replace(/[\s\+\-\(\)]/g, '').replace(/\D/g, '');
    if (str.startsWith('61') && str.length >= 11) {
        str = str.slice(2);
    }
    if (str.startsWith('0')) {
        str = str.slice(1);
    }
    return str.length >= 9 ? str.slice(-9) : str;
};

// Substring lookup helper for VoIP user extension matching
db.lookupUserByVoiplineExtension = function(callerOrDialed, callback) {
    const suffix = db.normalizePhoneToSuffix(callerOrDialed);
    if (!suffix) {
        return callback(null, null);
    }
    db.all(
        "SELECT id, username, full_name, voipline_extension, voipline_secret_token FROM users WHERE voipline_extension IS NOT NULL AND voipline_extension != ''",
        [],
        (err, users) => {
            if (err) return callback(err, null);
            
            // Match extension suffix (comparing last 9 digits strictly)
            const matchedUser = (users || []).find(u => {
                const ext = db.normalizePhoneToSuffix(u.voipline_extension);
                return ext === suffix;
            });
            
            callback(null, matchedUser);
        }
    );
};

// Substring lookup helper for Lead phone number matching
db.lookupLeadByPhoneNumber = function(phoneNumber, callback) {
    const suffix = db.normalizePhoneToSuffix(phoneNumber);
    if (!suffix) {
        return callback(null, null);
    }
    db.get(
        `SELECT id, first_name, last_name, project_number, state
         FROM leads
         WHERE is_deleted = 0 AND (
             substr(replace(replace(replace(replace(replace(phone_number, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), -9) = ? OR
             substr(replace(replace(replace(replace(replace(phone_number_2, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), -9) = ? OR
             substr(replace(replace(replace(replace(replace(landline_number, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), -9) = ?
         ) LIMIT 1`,
        [suffix, suffix, suffix],
        callback
    );
};

module.exports = db;