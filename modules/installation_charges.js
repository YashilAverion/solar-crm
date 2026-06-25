// ── installation_charges.js — Installation charge master & saved charges ──────

const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

// Tables are created by database/db.js — seed only missing default charges here
db.serialize(() => {
    db.get("SELECT COUNT(*) AS cnt FROM installation_charge_items", [], (err, row) => {
        if (err || (row && row.cnt > 0)) return;

        // On every server start: check by name, insert whichever is missing
        const DEFAULT_CHARGES = [
            // [charge_name,                                          charge_type,      rate,    sort_order]
            ['AC Cable 10mm More than 5 Meters',                      'per_meter',      12.00,   1],
            ['Alteration Wiring for Inverter',                        'fixed',          250.00,  2],
            ['Battery Backup / Blackout Protection',                   'fixed',          1200.00, 3],
            ['Battery Backup Changeover Switch',                       'fixed',          150.00,  4],
            ['Add on 2nd Stack of Battery (Suitable according to Height)', 'fixed',     250.00,  5],
            ['Battery Installation Upto 20 kWh',                      'battery_base',   1500.00, 6],
            ['Battery Installation More than 20 kWh - Per kWh',       'battery_per_kwh',100.00, 7],
            ['Battery Installation Upto 30 kWh',                      'battery_base',   2350.00, 31],
            ['Battery Installation 30 kWh to 42 kWh',                 'battery_base',   3100.00, 32],
            ['Battery Installation Above 42 kWh - Per kWh',           'battery_per_kwh', 100.00, 33],
            ['Bollard Installation Per Unit',                          'fixed',          150.00,  8],
            ['Circuit Breaker Burned - Replacement',                   'fixed',          150.00,  9],
            ['DC Isolator Replacement',                                'fixed',          150.00,  10],
            ['Inverter Replacement',                                   'fixed',          150.00,  11],
            ['Job Cancellation',                                       'fixed',          500.00,  12],
            ['Main Switch 1P / 3P',                                    'fixed',          109.09,  13],
            ['Neutral Link Upgrade',                                   'fixed',          80.00,   14],
            ['Microinverter / Optimizer Installation Per Panel',        'fixed',          11.00,   15],
            ['Periodical Service',                                     'fixed',          200.00,  16],
            ['Installed Solar PV System with 1 X Inverter',           'per_watt',       0.26,    17],
            ['Extra Roof Installation',                                'fixed',          100.00,  18],
            ['More than 2 Rows',                                       'fixed',          100.00,  19],
            ['Site Inspection',                                        'fixed',          150.00,  20],
            ['Export Control Device 1 Phase / Smart Meter',            'fixed',          150.00,  21],
            ['Export Control Device 3 Phase / Smart Meter',            'fixed',          250.00,  22],
            ['Steel Roof Over 28 Degree',                              'fixed',          200.00,  23],
            ['Steel Structure Inside the Sealing Space',               'fixed',          150.00,  24],
            ['Existing System Removal and Disposal',                   'fixed',          300.00,  25],
            ['Terra Cotta or Clay Tiles',                              'fixed',          100.00,  26],
            ['Travel Charges',                                         'per_km_travel',  1.30,    27],
            ['Weather Enclosure 12 Pole',                              'fixed',          250.00,  28],
            ['Weather Enclosure 4 Pole',                               'fixed',          150.00,  29],
            ['Weather Encloser 8 Pole',                                'fixed',          200.00,  30],
        ];

        db.all("SELECT LOWER(TRIM(charge_name)) as name FROM installation_charge_items", [], (err, existing) => {
            if (err) return;
            const existingNames = new Set(existing.map(r => r.name));
            const toAdd = DEFAULT_CHARGES.filter(c => !existingNames.has(c[0].toLowerCase().trim()));
            if (toAdd.length === 0) return;

            const stmt = db.prepare(
                `INSERT INTO installation_charge_items (charge_name, charge_type, rate, state, is_active, sort_order)
                 VALUES (?, ?, ?, 'WA', 'Yes', ?)`
            );
            toAdd.forEach(c => stmt.run(c[0], c[1], c[2], c[3]));
            stmt.finalize();
            console.log(`[Charges] ${toAdd.length} default charge(s) seeded into database.`);
        });
    });
    
    // Dynamically add state column if it doesn't exist
    db.run("ALTER TABLE installation_charge_items ADD COLUMN state TEXT DEFAULT 'WA'", (err) => {});

    // ── CORRECT ANY PREVIOUSLY WRONG-SEEDED DATA ──────────────
    // AC Cable: charge_type was wrongly 'fixed', must be 'per_meter'
    db.run(`UPDATE installation_charge_items SET charge_type='per_meter'
            WHERE LOWER(TRIM(charge_name))='ac cable 10mm more than 5 meters'
              AND charge_type='fixed'`);
    // Alteration Wiring: rate was wrongly $12.00, must be $250.00
    db.run(`UPDATE installation_charge_items SET rate=250.00
            WHERE LOWER(TRIM(charge_name))='alteration wiring for inverter'
              AND rate < 13`);
    // Ensure all default charges have state='WA' if they were seeded with state='All' or NULL
    db.run(`UPDATE installation_charge_items SET state='WA'
            WHERE state IS NULL OR state='' OR state='All'`);

    // Tables are already created by database/db.js
});

// ── GET ALL MASTER CHARGE ITEMS ────────────────────────────
router.get('/items', requireAuth, (req, res) => {
    db.all("SELECT * FROM installation_charge_items WHERE is_active='Yes' ORDER BY sort_order", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ── CREATE NEW MASTER CHARGE ────────────────────────────────
router.post('/items', requireManager, (req, res) => {
    const { charge_name, charge_type, rate, state } = req.body;
    if (!charge_name || charge_name.trim().length < 3) {
        return res.status(400).json({ error: 'Charge name must be at least 3 characters long.' });
    }
    const validTypes = ['fixed', 'per_meter', 'battery_base', 'battery_per_kwh', 'per_watt', 'per_km_travel'];
    if (!validTypes.includes(charge_type)) {
        return res.status(400).json({ error: `Charge type is invalid. Valid types: ${validTypes.join(', ')}` });
    }
    const currentUser = getCurrentUser(req);
    db.run(
        `INSERT INTO installation_charge_items (charge_name, charge_type, rate, state) VALUES (?,?,?,?)`,
        [charge_name, charge_type, rate, state || 'All'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            db.run("INSERT INTO installation_charge_items_history (item_id, user_name, previous_value, updated_value) VALUES (?, ?, ?, ?)", [newId, currentUser || 'System', '-', 'Charge Created']);
            res.json({ id: newId, success: true });
        }
    );
});

// ── UPDATE MASTER CHARGE ────────────────────────────────────
router.put('/items/:id', requireManager, (req, res) => {
    const { charge_name, charge_type, rate, state } = req.body;
    const user = getCurrentUser(req);
    db.run(
        `UPDATE installation_charge_items SET charge_name=?, charge_type=?, rate=?, state=? WHERE id=?`,
        [charge_name, charge_type, rate, state || 'All', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO installation_charge_items_history (item_id, user_name, previous_value, updated_value) VALUES (?, ?, ?, ?)",
                [req.params.id, user, 'Charge details updated', `Name: ${charge_name}, Type: ${charge_type}, Rate: ${rate}, State: ${state}`]);
            res.json({ success: true });
        }
    );
});

// ── DELETE MASTER CHARGE (Manager only) ─────────────────────
router.delete('/items/:id', requireManager, (req, res) => {
    db.run("DELETE FROM installation_charge_items WHERE id=?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ── GET MASTER CHARGE HISTORY ───────────────────────────────
router.get('/items/:id/history', requireAuth, (req, res) => {
    db.all("SELECT * FROM installation_charge_items_history WHERE item_id=? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ── SEED DEFAULT CHARGES (idempotent) ─────────────────────
router.post('/items/seed-defaults', (req, res) => {
    const { currentUser } = req.body;
    const defaults = [
        ['AC Cable 10mm More than 5 Meters',              'per_meter',      12.00,    'WA'],
        ['Alteration Wiring for Inverter',                'fixed',          250.00,   'WA'],
        ['Battery Backup / Blackout Protection',          'fixed',          1200.00,  'WA'],
        ['Battery Backup Changeover Switch',              'fixed',          150.00,   'WA'],
        ['Add on 2nd Stack of Battery (Suitable according to Height)', 'fixed', 250.00, 'WA'],
        ['Battery Installation Upto 20 kWh',             'battery_base',   1500.00,  'WA'],
        ['Battery Installation More than 20 kWh - Per kWh', 'battery_per_kwh', 100.00, 'WA'],
        ['Battery Installation Upto 30 kWh',             'battery_base',   2350.00,  'WA'],
        ['Battery Installation 30 kWh to 42 kWh',        'battery_base',   3100.00,  'WA'],
        ['Battery Installation Above 42 kWh - Per kWh',  'battery_per_kwh', 100.00,  'WA'],
        ['Bollard Installation Per Unit',                 'fixed',          150.00,   'WA'],
        ['Circuit Breaker Burned - Replacement',          'fixed',          150.00,   'WA'],
        ['DC Isolator Replacement',                       'fixed',          150.00,   'WA'],
        ['Inverter Replacement',                          'fixed',          150.00,   'WA'],
        ['Job Cancellation',                              'fixed',          500.00,   'WA'],
        ['Main Switch 1P / 3P',                           'fixed',          109.09,   'WA'],
        ['Neutral Link Upgrade',                          'fixed',          80.00,    'WA'],
        ['Microinverter / Optimizer Installation Per Panel', 'fixed',       11.00,    'WA'],
        ['Periodical Service',                            'fixed',          200.00,   'WA'],
        ['Installed Solar PV System with 1 X Inverter',  'per_watt',       0.26,     'WA'],
        ['Extra Roof Installation',                       'fixed',          100.00,   'WA'],
        ['More than 2 Rows',                              'fixed',          100.00,   'WA'],
        ['Site Inspection',                               'fixed',          150.00,   'WA'],
        ['Export Control Device 1 Phase / Smart Meter',  'fixed',          150.00,   'WA'],
        ['Export Control Device 3 Phase / Smart Meter',  'fixed',          250.00,   'WA'],
        ['Steel Roof Over 28 Degree',                     'fixed',          200.00,   'WA'],
        ['Steel Structure Inside the Sealing Space',      'fixed',          150.00,   'WA'],
        ['Existing System Removal and Disposal',          'fixed',          300.00,   'WA'],
        ['Terra Cotta or Clay Tiles',                     'fixed',          100.00,   'WA'],
        ['Travel Charges',                                'per_km_travel',  1.30,     'WA'],
        ['Weather Enclosure 12 Pole',                     'fixed',          250.00,   'WA'],
        ['Weather Enclosure 4 Pole',                      'fixed',          150.00,   'WA'],
        ['Weather Encloser 8 Pole',                       'fixed',          200.00,   'WA'],
    ];

    db.all("SELECT charge_name FROM installation_charge_items", [], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        const existingNames = new Set(existing.map(r => r.charge_name.toLowerCase().trim()));
        const toInsert = defaults.filter(d => !existingNames.has(d[0].toLowerCase().trim()));

        if (toInsert.length === 0) {
            return res.json({ added: 0, skipped: defaults.length });
        }

        let insertedCount = 0;
        const insertNext = (i) => {
            if (i >= toInsert.length) {
                return res.json({ added: toInsert.length, skipped: defaults.length - toInsert.length });
            }
            const d = toInsert[i];
            db.run(
                `INSERT INTO installation_charge_items (charge_name, charge_type, rate, state, is_active) VALUES (?,?,?,?,'Yes')`,
                [d[0], d[1], d[2], d[3]],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const newId = this.lastID;
                    if (currentUser) {
                        db.run(
                            `INSERT INTO installation_charge_items_history (item_id, user_name, previous_value, updated_value) VALUES (?,?,?,?)`,
                            [newId, currentUser, '-', `Default charge seeded: ${d[0]} @ $${d[2]}`]
                        );
                    }
                    insertNext(i + 1);
                }
            );
        };
        insertNext(0);
    });
});

// ── GET SAVED CHARGES FOR AN INSTALLATION ─────────────────
router.get('/:installation_id', (req, res) => {
    db.all(
        "SELECT * FROM installation_saved_charges WHERE installation_id = ? ORDER BY id",
        [req.params.installation_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ── SAVE CHARGES FOR AN INSTALLATION ──────────────────────
router.post('/:installation_id', (req, res) => {
    const installation_id = req.params.installation_id;
    const { charges, currentUser } = req.body; // charges = array of line items

    if (!charges || charges.length === 0) {
        return res.status(400).json({ error: 'No charges provided.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // First delete old charges
        db.run("DELETE FROM installation_saved_charges WHERE installation_id = ?", [installation_id], (err) => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            // Calculate total
            let totalExGst = 0, totalGst = 0, totalIncGst = 0;
            charges.forEach(c => {
                totalExGst  += parseFloat(c.amount_ex_gst)  || 0;
                totalGst    += parseFloat(c.gst_amount)      || 0;
                totalIncGst += parseFloat(c.amount_inc_gst) || 0;
            });

            // Insert new charges
            const stmt = db.prepare(`
                INSERT INTO installation_saved_charges
                (installation_id, charge_item_id, charge_name, qty, rate, amount_ex_gst, gst_amount, amount_inc_gst, notes)
                VALUES (?,?,?,?,?,?,?,?,?)
            `);
            let hasError = false;
            charges.forEach(c => {
                stmt.run(
                    [
                        installation_id,
                        c.charge_item_id || null,
                        c.charge_name,
                        c.qty || 1,
                        c.rate || 0,
                        c.amount_ex_gst  || 0,
                        c.gst_amount      || 0,
                        c.amount_inc_gst || 0,
                        c.notes || ''
                    ],
                    (err) => { if (err) hasError = true; }
                );
            });

            stmt.finalize(() => {
                if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: "Failed to insert some charges." });
                }

                // Update total in installation record
                db.run(
                    "UPDATE installations SET invoice_amount=?, payment_status_amount=? WHERE id=?",
                    [totalIncGst.toFixed(2), totalIncGst.toFixed(2), installation_id],
                    (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: "Failed to update installation totals." });
                        }

                        // Save to history
                        db.run(
                            `INSERT INTO installations_history (installation_id, user_name, action, details)
                             VALUES (?, ?, 'Charges Updated', ?)`,
                            [installation_id, currentUser || 'System',
                             `Total: $${totalIncGst.toFixed(2)} (Inc GST) | Ex GST: $${totalExGst.toFixed(2)} | ${charges.length} line items saved.`],
                            (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: "Failed to write history record." });
                                }

                                db.run("COMMIT", (err) => {
                                    if (err) {
                                        db.run("ROLLBACK");
                                        return res.status(500).json({ error: "Transaction commit failed." });
                                    }
                                    res.json({
                                        success: true,
                                        total_ex_gst:  totalExGst.toFixed(2),
                                        total_gst:     totalGst.toFixed(2),
                                        total_inc_gst: totalIncGst.toFixed(2)
                                    });
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});

module.exports = router;