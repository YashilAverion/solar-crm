const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, requireManager, getCurrentUser } = require('../helpers');

// Helper to sync combo variants with products table
function syncComboVariantToProduct(group, variant, callback) {
    const childProducts = [];
    if (group.panel_stock_code && variant.panel_qty > 0) {
        childProducts.push({ code: group.panel_stock_code, qty: variant.panel_qty });
    }
    if (group.inverter_stock_code && variant.inverter_qty > 0) {
        childProducts.push({ code: group.inverter_stock_code, qty: variant.inverter_qty });
    }
    if (group.battery_stock_code && variant.battery_qty > 0) {
        childProducts.push({ code: group.battery_stock_code, qty: variant.battery_qty });
    }

    const childProductsJson = JSON.stringify(childProducts);
    const prodName = `${group.group_name} [${variant.variant_name}]`;

    // Check if product with this stock_code already exists
    db.get("SELECT id FROM products WHERE stock_code = ?", [variant.stock_code], (err, product) => {
        if (err) return callback(err);

        if (product) {
            // Update existing
            const sql = `
                UPDATE products 
                SET product_category = 'Combo', prod_name = ?, manufacturer_name = 'Ares', 
                    brand_name = 'Ares', model_number = ?, purchase_price = ?, 
                    purchase_price_ex_gst = ?, product_status = 'Active', 
                    show_in_quotation = 'Yes', show_in_detailed_reports = 'Yes', 
                    child_products = ?, last_update_on = datetime('now', 'localtime')
                WHERE id = ?
            `;
            db.run(sql, [prodName, variant.variant_name, variant.purchase_price, variant.purchase_price_ex_gst, childProductsJson, product.id], callback);
        } else {
            // Insert new product
            const sql = `
                INSERT INTO products (
                    product_category, prod_name, manufacturer_name, brand_name, model_number, 
                    stock_code, purchase_price, purchase_price_ex_gst, product_status, 
                    show_in_quotation, show_in_detailed_reports, child_products, created_at
                ) VALUES ('Combo', ?, 'Ares', 'Ares', ?, ?, ?, ?, 'Active', 'Yes', 'Yes', ?, datetime('now', 'localtime'))
            `;
            db.run(sql, [prodName, variant.variant_name, variant.stock_code, variant.purchase_price, variant.purchase_price_ex_gst, childProductsJson], callback);
        }
    });
}

// GET next available variant stock code in series (e.g. CBO-1001)
router.get('/next-stock-code', requireAuth, (req, res) => {
    db.all("SELECT stock_code FROM combo_variants", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        let maxNum = 1000;
        rows.forEach(r => {
            const code = r.stock_code;
            if (code && code.startsWith('CBO-')) {
                const numPart = code.substring(4);
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        res.json({ nextCode: `CBO-${maxNum + 1}`, nextNum: maxNum + 1 });
    });
});

// GET all combos with variants
router.get('/', requireAuth, (req, res) => {
    db.all("SELECT * FROM combo_groups WHERE status = 'Active' ORDER BY id DESC", [], (err, groups) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all("SELECT * FROM combo_variants WHERE status = 'Active'", [], (err, variants) => {
            if (err) return res.status(500).json({ error: err.message });

            const result = groups.map(g => {
                g.variants = variants.filter(v => v.combo_group_id === g.id);
                return g;
            });
            res.json(result);
        });
    });
});

// POST create combo group and variants
router.post('/', requireAuth, (req, res) => {
    const { group_name, description, panel_stock_code, inverter_stock_code, battery_stock_code, variants, is_panel_inverter, is_inverter_battery, is_panel_inverter_battery } = req.body;

    if (!group_name || !group_name.trim()) {
        return res.status(400).json({ error: "Group name is required." });
    }
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ error: "At least one variant is required." });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const groupSql = `
            INSERT INTO combo_groups (group_name, description, panel_stock_code, inverter_stock_code, battery_stock_code, is_panel_inverter, is_inverter_battery, is_panel_inverter_battery)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(groupSql, [group_name, description, panel_stock_code, inverter_stock_code, battery_stock_code, is_panel_inverter || 0, is_inverter_battery || 0, is_panel_inverter_battery || 0], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            const groupId = this.lastID;
            const groupRecord = { id: groupId, group_name, panel_stock_code, inverter_stock_code, battery_stock_code };
            let variantIndex = 0;

            function insertNextVariant() {
                if (variantIndex >= variants.length) {
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: commitErr.message });
                        }
                        res.json({ success: true, id: groupId });
                    });
                    return;
                }

                const v = variants[variantIndex];
                const variantSql = `
                    INSERT OR REPLACE INTO combo_variants (combo_group_id, variant_name, stock_code, panel_qty, inverter_qty, battery_qty, purchase_price, purchase_price_ex_gst)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                db.run(variantSql, [groupId, v.variant_name, v.stock_code, v.panel_qty || 0, v.inverter_qty || 0, v.battery_qty || 0, v.purchase_price || 0, v.purchase_price_ex_gst || 0], function(vErr) {
                    if (vErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: `Variant insertion failed: ${vErr.message}` });
                    }

                    const variantRecord = {
                        variant_name: v.variant_name,
                        stock_code: v.stock_code,
                        panel_qty: v.panel_qty || 0,
                        inverter_qty: v.inverter_qty || 0,
                        battery_qty: v.battery_qty || 0,
                        purchase_price: v.purchase_price || 0,
                        purchase_price_ex_gst: v.purchase_price_ex_gst || 0
                    };

                    syncComboVariantToProduct(groupRecord, variantRecord, (syncErr) => {
                        if (syncErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: `Product sync failed: ${syncErr.message}` });
                        }
                        variantIndex++;
                        insertNextVariant();
                    });
                });
            }

            insertNextVariant();
        });
    });
});

// PUT update combo group and variants
router.put('/:id', requireAuth, (req, res) => {
    const groupId = req.params.id;
    const { group_name, description, panel_stock_code, inverter_stock_code, battery_stock_code, variants, is_panel_inverter, is_inverter_battery, is_panel_inverter_battery } = req.body;

    if (!group_name || !group_name.trim()) {
        return res.status(400).json({ error: "Group name is required." });
    }
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ error: "At least one variant is required." });
    }

    db.get("SELECT * FROM combo_groups WHERE id = ? AND status = 'Active'", [groupId], (err, existingGroup) => {
        if (err || !existingGroup) {
            return res.status(404).json({ error: "Combo Group not found." });
        }

        // Get old variants of this group to soft-delete their products
        db.all("SELECT stock_code FROM combo_variants WHERE combo_group_id = ?", [groupId], (err, oldVariants) => {
            if (err) return res.status(500).json({ error: err.message });

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const groupSql = `
                    UPDATE combo_groups 
                    SET group_name = ?, description = ?, panel_stock_code = ?, inverter_stock_code = ?, battery_stock_code = ?,
                        is_panel_inverter = ?, is_inverter_battery = ?, is_panel_inverter_battery = ?
                    WHERE id = ?
                `;
                db.run(groupSql, [group_name, description, panel_stock_code, inverter_stock_code, battery_stock_code, is_panel_inverter || 0, is_inverter_battery || 0, is_panel_inverter_battery || 0, groupId], (uErr) => {
                    if (uErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: uErr.message });
                    }

                    // Delete old variants
                    db.run("DELETE FROM combo_variants WHERE combo_group_id = ?", [groupId], (delErr) => {
                        if (delErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: delErr.message });
                        }

                        // Soft delete corresponding products for old variants
                        const oldStockCodes = oldVariants.map(ov => ov.stock_code);
                        if (oldStockCodes.length > 0) {
                            const placeholders = oldStockCodes.map(() => '?').join(',');
                            db.run(`UPDATE products SET product_status = 'Deleted' WHERE stock_code IN (${placeholders})`, oldStockCodes);
                        }

                        const groupRecord = { id: groupId, group_name, panel_stock_code, inverter_stock_code, battery_stock_code };
                        let variantIndex = 0;

                        function insertNextVariant() {
                            if (variantIndex >= variants.length) {
                                db.run("COMMIT", (commitErr) => {
                                    if (commitErr) {
                                        db.run("ROLLBACK");
                                        return res.status(500).json({ error: commitErr.message });
                                    }
                                    res.json({ success: true });
                                });
                                return;
                            }

                            const v = variants[variantIndex];
                            const variantSql = `
                                INSERT OR REPLACE INTO combo_variants (combo_group_id, variant_name, stock_code, panel_qty, inverter_qty, battery_qty, purchase_price, purchase_price_ex_gst)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            db.run(variantSql, [groupId, v.variant_name, v.stock_code, v.panel_qty || 0, v.inverter_qty || 0, v.battery_qty || 0, v.purchase_price || 0, v.purchase_price_ex_gst || 0], function(vErr) {
                                if (vErr) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: `Variant insertion failed: ${vErr.message}` });
                                }

                                const variantRecord = {
                                    variant_name: v.variant_name,
                                    stock_code: v.stock_code,
                                    panel_qty: v.panel_qty || 0,
                                    inverter_qty: v.inverter_qty || 0,
                                    battery_qty: v.battery_qty || 0,
                                    purchase_price: v.purchase_price || 0,
                                    purchase_price_ex_gst: v.purchase_price_ex_gst || 0
                                };

                                syncComboVariantToProduct(groupRecord, variantRecord, (syncErr) => {
                                    if (syncErr) {
                                        db.run("ROLLBACK");
                                        return res.status(500).json({ error: `Product sync failed: ${syncErr.message}` });
                                    }
                                    variantIndex++;
                                    insertNextVariant();
                                });
                            });
                        }

                        insertNextVariant();
                    });
                });
            });
        });
    });
});

// DELETE combo group (soft delete)
router.delete('/:id', requireManager, (req, res) => {
    const groupId = req.params.id;

    db.get("SELECT * FROM combo_groups WHERE id = ?", [groupId], (err, group) => {
        if (err || !group) return res.status(404).json({ error: "Combo Group not found." });

        db.all("SELECT stock_code FROM combo_variants WHERE combo_group_id = ?", [groupId], (err, variants) => {
            if (err) return res.status(500).json({ error: err.message });

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                db.run("UPDATE combo_groups SET status = 'Deleted' WHERE id = ?", [groupId], (gErr) => {
                    if (gErr) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: gErr.message });
                    }

                    db.run("UPDATE combo_variants SET status = 'Deleted' WHERE combo_group_id = ?", [groupId], (vErr) => {
                        if (vErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: vErr.message });
                        }

                        // Set corresponding products status to 'Deleted'
                        const stockCodes = variants.map(v => v.stock_code);
                        if (stockCodes.length > 0) {
                            const placeholders = stockCodes.map(() => '?').join(',');
                            db.run(`UPDATE products SET product_status = 'Deleted' WHERE stock_code IN (${placeholders})`, stockCodes, (pErr) => {
                                if (pErr) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: pErr.message });
                                }
                                commitAndFinish();
                            });
                        } else {
                            commitAndFinish();
                        }

                        function commitAndFinish() {
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: commitErr.message });
                                }
                                res.json({ success: true });
                            });
                        }
                    });
                });
            });
        });
    });
});

module.exports = router;
