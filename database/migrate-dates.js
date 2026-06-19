const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('Starting Database Migration & Indexing Optimization...');

// 1. Take a safety backup of the database file
try {
    fs.copyFileSync(dbPath, dbPath + '.pre-migration-bak');
    console.log('✔️ Database safety backup created at:', dbPath + '.pre-migration-bak');
} catch (e) {
    console.error('❌ Failed to create database safety backup. Stopping migration.', e);
    process.exit(1);
}

function parseAnyToISO(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'Pending' || dateStr === 'Pending Details') return dateStr;
    
    // Check if it is already in ISO format YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
    
    try {
        // Format 1: 05-05-2026 (03:15 AM)
        if (dateStr.includes('(')) {
            const p = dateStr.split(' ');
            const dmy = p[0].split('-');
            const t = p[1].replace('(', '');
            const ap = p[2].replace(')', '');
            const tp = t.split(':');
            let hh = parseInt(tp[0], 10);
            const mm = parseInt(tp[1], 10);
            if (ap === 'PM' && hh < 12) hh += 12;
            if (ap === 'AM' && hh === 12) hh = 0;
            
            const yr = parseInt(dmy[2], 10);
            const mon = String(dmy[1]).padStart(2, '0');
            const day = String(dmy[0]).padStart(2, '0');
            const hour = String(hh).padStart(2, '0');
            const min = String(mm).padStart(2, '0');
            return `${yr}-${mon}-${day} ${hour}:${min}:00`;
        }
        
        // Format 2: 18-05-26 15:50 (DD-MM-YY HH:mm) or 07-05-26 04:44
        if (dateStr.includes(' ')) {
            const p = dateStr.split(' ');
            const dmy = p[0].split('-');
            const tp = p[1].split(':');
            
            let yr = parseInt(dmy[2], 10);
            if (yr < 100) yr += 2000;
            const mon = String(dmy[1]).padStart(2, '0');
            const day = String(dmy[0]).padStart(2, '0');
            const hour = String(tp[0]).padStart(2, '0');
            const min = String(tp[1]).padStart(2, '0');
            return `${yr}-${mon}-${day} ${hour}:${min}:00`;
        }
        
        // Format 3: 04/05/2026 (DD/MM/YYYY)
        if (dateStr.includes('/')) {
            const dmy = dateStr.split('/');
            const yr = parseInt(dmy[2], 10);
            const mon = String(dmy[1]).padStart(2, '0');
            const day = String(dmy[0]).padStart(2, '0');
            return `${yr}-${mon}-${day} 00:00:00`;
        }
        
        // Format 4: 18-05-2026 (DD-MM-YYYY)
        if (dateStr.includes('-')) {
            const dmy = dateStr.split('-');
            if (dmy[0].length <= 2) {
                let yr = parseInt(dmy[2], 10);
                if (yr < 100) yr += 2000;
                const mon = String(dmy[1]).padStart(2, '0');
                const day = String(dmy[0]).padStart(2, '0');
                return `${yr}-${mon}-${day} 00:00:00`;
            }
        }
        
    } catch (e) {
        console.error('Failed to parse date:', dateStr, e.message);
    }
    
    return dateStr; // Fallback
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Connection error:', err);
        process.exit(1);
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 2. Migrate Leads
        db.all("SELECT id, lead_entered_date, created_date FROM leads", [], (err, leads) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('❌ Failed to fetch leads:', err);
                process.exit(1);
            }
            
            console.log(`Migrating ${leads.length} leads...`);
            const stmt = db.prepare("UPDATE leads SET lead_entered_date = ?, created_date = ? WHERE id = ?");
            
            leads.forEach(lead => {
                const isoEntered = parseAnyToISO(lead.lead_entered_date);
                const isoCreated = parseAnyToISO(lead.created_date);
                stmt.run([isoEntered, isoCreated, lead.id]);
            });
            stmt.finalize();
            
            // 3. Migrate Installations
            db.all("SELECT id, created_date FROM installations", [], (err, insts) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('❌ Failed to fetch installations:', err);
                    process.exit(1);
                }
                
                console.log(`Migrating ${insts.length} installations...`);
                const instStmt = db.prepare("UPDATE installations SET created_date = ? WHERE id = ?");
                
                insts.forEach(inst => {
                    const isoCreated = parseAnyToISO(inst.created_date);
                    instStmt.run([isoCreated, inst.id]);
                });
                instStmt.finalize();
                
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('❌ Commit failed:', err);
                        process.exit(1);
                    }
                    console.log('✔️ Date values successfully migrated to ISO format.');
                    
                    // 4. Create Indexes
                    console.log('Creating database indexes for date queries...');
                    db.serialize(() => {
                        db.run("CREATE INDEX IF NOT EXISTS idx_leads_lead_entered_date ON leads (lead_entered_date)", (err) => {
                            if (err) console.error('Failed to create index idx_leads_lead_entered_date', err);
                        });
                        db.run("CREATE INDEX IF NOT EXISTS idx_leads_created_date ON leads (created_date)", (err) => {
                            if (err) console.error('Failed to create index idx_leads_created_date', err);
                        });
                        db.run("CREATE INDEX IF NOT EXISTS idx_installations_created_date ON installations (created_date)", (err) => {
                            if (err) console.error('Failed to create index idx_installations_created_date', err);
                            else console.log('✔️ Date indexes successfully configured.');
                            
                            console.log('🎉 Migration Completed Successfully.');
                            db.close();
                        });
                    });
                });
            });
        });
    });
});
