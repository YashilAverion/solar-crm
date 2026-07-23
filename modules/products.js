const express = require('express');
const router = express.Router();
const db = require('../database/db');
const multer = require('multer');
const fs = require('fs');
const XLSX = require('xlsx');
const { getSydneyTime, requireAuth, requireManager, getCurrentUser } = require('../helpers');

const uploadDir = './public/uploads/products';
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

function safeName(originalname) {
    return originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir) },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + safeName(file.originalname)) }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// 🔥 NEW: MULTER FOR DYNAMIC DOCUMENTS 🔥
const docUploadDir = './public/uploads/products';
if (!fs.existsSync(docUploadDir)) { fs.mkdirSync(docUploadDir, { recursive: true }); }

const docStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, docUploadDir) },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + safeName(file.originalname)) }
});

const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 5 * 1024 * 1024 } });

function addHistory(product_id, action, details, user_name, timeStr = getSydneyTime()) {
    db.run(`INSERT INTO products_history (record_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)`, 
    [product_id, action, details, user_name, timeStr]);
}

router.get('/next-stock-code', (req, res) => {
    db.get("SELECT stock_code FROM products ORDER BY CAST(stock_code AS INTEGER) DESC LIMIT 1", [], (err, row) => {
        let nextCode = 1001;
        if (row && row.stock_code) {
            let lastCode = parseInt(row.stock_code, 10);
            if (!isNaN(lastCode)) nextCode = lastCode + 1;
        }
        res.json({ nextCode });
    }); // 🎯 FIXED: Missing closing bracket here was crashing the node loader thread
});

router.get('/search', requireAuth, (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const s = `%${q}%`;
    const sql = `
        SELECT * FROM products 
        WHERE (product_status IS NULL OR product_status = 'Active')
        AND (
            prod_name LIKE ? OR 
            manufacturer_name LIKE ? OR 
            model_number LIKE ? OR 
            stock_code LIKE ? OR
            panels_capacity_w LIKE ? OR
            inv_rt_ac_out_w LIKE ? OR
            nominal_battery_capacity_kwh LIKE ? OR
            usable_battery_kwh LIKE ?
        )
        ORDER BY prod_name ASC LIMIT 20
    `;
    db.all(sql, [s, s, s, s, s, s, s, s], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows = rows.map(r => {
            try { r.child_products = r.child_products ? JSON.parse(r.child_products) : []; }
            catch(e) { r.child_products = []; }
            try { r.dynamic_documents = r.dynamic_documents ? JSON.parse(r.dynamic_documents) : []; }
            catch(e) { r.dynamic_documents = []; }
            return r;
        });
        res.json(rows);
    });
});

// 🔥 NEW: UPLOAD DOCUMENT ENDPOINT 🔥
router.post('/upload-doc', uploadDoc.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
        url: `/uploads/products/${req.file.filename}`,
        name: req.file.originalname
    });
});

router.get('/', requireAuth, (req, res) => {
    db.all("SELECT * FROM products WHERE product_status IS NULL OR product_status != 'Deleted' ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows = rows.map(r => {
            try { r.dynamic_documents = r.dynamic_documents ? JSON.parse(r.dynamic_documents) : []; }
            catch(e) { r.dynamic_documents = []; }
            return r;
        });
        res.json(rows);
    });
});

router.get('/:id/history', requireAuth, (req, res) => {
    db.all("SELECT * FROM products_history WHERE record_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 🔥 NEW: BULK IMPORT FROM EXCEL 🔥
router.post('/bulk', async (req, res) => {
    const products = req.body.products;
    const currentUser = req.body.currentUser;
    const currentTime = getSydneyTime();

    const runQuery = (query, params) => new Promise((resolve, reject) => {
        db.run(query, params, function(err) { if(err) reject(err); else resolve(this.lastID); });
    });
    const getQuery = (query, params) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => { if(err) reject(err); else resolve(row); });
    });

    try {
        await runQuery("BEGIN TRANSACTION", []);
        
        let row = await getQuery("SELECT stock_code FROM products ORDER BY CAST(stock_code AS INTEGER) DESC LIMIT 1", []);
        let nextCode = 1001;
        if (row && row.stock_code) {
            let lastCode = parseInt(row.stock_code, 10);
            if (!isNaN(lastCode)) nextCode = lastCode + 1;
        }

        for (let d of products) {
            let code = nextCode.toString();
            nextCode++; 
            
            let exGst = '';
            if(d.purchase_price) {
                let p = parseFloat(d.purchase_price);
                if(!isNaN(p)) exGst = (p / 1.1).toFixed(2); 
            }

            const sql = `INSERT INTO products (
                product_category, prod_name, manufacturer_name, brand_name, model_number,
                stock_code, pro_approved_date, pro_expiry_date, product_series, no_of_phase,
                type_of_inverter, panels_capacity_w, inv_rt_ac_out_w, inv_rt_dc_power_kw, inv_mppt,
                nominal_battery_capacity_kwh, usable_battery_kwh, no_of_battery_modules, pro_warranty_years,
                panels_linear_warranty_years, purchase_price, purchase_price_ex_gst, product_status,
                show_in_quotation, show_in_detailed_reports, child_products, dynamic_documents,
                datasheet, installation_manual, wifi_manual, warranty_document,
                created_at, last_update_on, last_updated_by, show_in_ext_install
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`; 
            
            let id = await runQuery(sql, [
                d.product_category || 'Other', d.prod_name || '', d.manufacturer_name || '', d.brand_name || '', d.model_number || '',
                code, d.pro_approved_date || '', d.pro_expiry_date || '', d.product_series || '', d.no_of_phase || '',
                d.type_of_inverter || '', d.panels_capacity_w || '', d.inv_rt_ac_out_w || '', d.inv_rt_dc_power_kw || '', d.inv_mppt || '',
                d.nominal_battery_capacity_kwh || '', d.usable_battery_kwh || '', d.no_of_battery_modules || '', d.pro_warranty_years || '',
                d.panels_linear_warranty_years || '', d.purchase_price || '', exGst, 'Active', 'Yes', 'Yes', 
                '[]', '[]', '', '', '', '', currentTime, currentTime, currentUser, 'No'
            ]);

            await runQuery(`INSERT INTO products_history (record_id, action, details, user_name, created_at) VALUES (?,?,?,?,?)`, 
            [id, 'Created', 'Created via Bulk Excel Import', currentUser, currentTime]);
        }
        await runQuery("COMMIT", []);
        res.json({ success: true });
    } catch (e) {
        await runQuery("ROLLBACK", []).catch(() => {});
        res.status(500).json({ error: e.message });
    }
});

router.post('/', requireAuth, upload.none(), (req, res) => {
    const d = req.body;
    if (!d.prod_name || d.prod_name.trim().length < 3) {
        return res.status(400).json({ error: 'Product name must be at least 3 characters long.' });
    }
    if (!d.manufacturer_name || !d.manufacturer_name.trim()) {
        return res.status(400).json({ error: 'Manufacturer name is required.' });
    }
    if (d.purchase_price && isNaN(parseFloat(d.purchase_price))) {
        return res.status(400).json({ error: 'Purchase price must be a valid number.' });
    }
    if (d.model_number && d.model_number.trim() !== '') {
        db.get("SELECT id FROM products WHERE model_number = ?", [d.model_number], (err, row) => {
            if (row) return res.status(400).json({ error: "Model Already Exist" });
            insertProduct();
        });
    } else { insertProduct(); }

    function insertProduct() {
        const currentTime = getSydneyTime();

        const sql = `INSERT INTO products (
            product_category, prod_name, manufacturer_name, brand_name, model_number,
            stock_code, pro_approved_date, pro_expiry_date, product_series, no_of_phase,
            type_of_inverter, panels_capacity_w, inv_rt_ac_out_w, inv_rt_dc_power_kw, inv_mppt,
            nominal_battery_capacity_kwh, usable_battery_kwh, no_of_battery_modules, pro_warranty_years,
            panels_linear_warranty_years, purchase_price, purchase_price_ex_gst, product_status,
            show_in_quotation, show_in_detailed_reports, child_products, dynamic_documents,
            datasheet, installation_manual, wifi_manual, warranty_document,
            created_at, last_update_on, last_updated_by, show_in_ext_install
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`; 

        const params = [
            d.product_category, d.prod_name, d.manufacturer_name, d.brand_name, d.model_number,
            d.stock_code, d.pro_approved_date, d.pro_expiry_date, d.product_series, d.no_of_phase,
            d.type_of_inverter || '', d.panels_capacity_w, d.inv_rt_ac_out_w, d.inv_rt_dc_power_kw, d.inv_mppt,
            d.nominal_battery_capacity_kwh, d.usable_battery_kwh, d.no_of_battery_modules, d.pro_warranty_years,
            d.panels_linear_warranty_years, d.purchase_price, d.purchase_price_ex_gst, d.product_status,
            d.show_in_quotation, d.show_in_detailed_reports, d.child_products, d.dynamic_documents,
            '', '', '', '',
            currentTime, currentTime, d.last_updated_by, d.show_in_ext_install || 'No'
        ];

        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            addHistory(this.lastID, 'Created', `Product Added: ${d.prod_name}`, d.last_updated_by, currentTime);
            res.json({ id: this.lastID, message: "Product added successfully." });
        });
    }
});

router.put('/:id', requireAuth, upload.none(), (req, res) => {
    const d = req.body;
    const id = req.params.id;

    if (d.model_number && d.model_number.trim() !== '') {
        db.get("SELECT id FROM products WHERE model_number = ? AND id != ?", [d.model_number, id], (err, row) => {
            if (row) return res.status(400).json({ error: "Model Already Exist" });
            executeEdit();
        });
    } else { executeEdit(); }

    function executeEdit() {
        db.get("SELECT * FROM products WHERE id = ?", [id], (err, old) => {
            if (!old) return res.status(404).json({error: "Product not found"});

            const ds = old.datasheet || '';
            const im = old.installation_manual || '';
            const wm = old.wifi_manual || '';
            const wd = old.warranty_document || '';
            const currentTime = getSydneyTime();

            const sql = `UPDATE products SET 
                product_category=?, prod_name=?, manufacturer_name=?, brand_name=?, model_number=?,
                pro_approved_date=?, pro_expiry_date=?, product_series=?, no_of_phase=?,
                type_of_inverter=?, panels_capacity_w=?, inv_rt_ac_out_w=?, inv_rt_dc_power_kw=?, inv_mppt=?,
                nominal_battery_capacity_kwh=?, usable_battery_kwh=?, no_of_battery_modules=?, pro_warranty_years=?,
                panels_linear_warranty_years=?, purchase_price=?, purchase_price_ex_gst=?, product_status=?,
                show_in_quotation=?, show_in_detailed_reports=?, child_products=?, dynamic_documents=?,
                datasheet=?, installation_manual=?, wifi_manual=?, warranty_document=?,
                last_update_on=?, last_updated_by=?, show_in_ext_install=? WHERE id=?`;
            
            const params = [
                d.product_category, d.prod_name, d.manufacturer_name, d.brand_name, d.model_number,
                d.pro_approved_date, d.pro_expiry_date, d.product_series, d.no_of_phase,
                d.type_of_inverter || '', d.panels_capacity_w, d.inv_rt_ac_out_w, d.inv_rt_dc_power_kw, d.inv_mppt,
                d.nominal_battery_capacity_kwh, d.usable_battery_kwh, d.no_of_battery_modules, d.pro_warranty_years,
                d.panels_linear_warranty_years, d.purchase_price, d.purchase_price_ex_gst, d.product_status,
                d.show_in_quotation, d.show_in_detailed_reports, d.child_products, d.dynamic_documents,
                ds, im, wm, wd, currentTime, d.last_updated_by, d.show_in_ext_install || 'No', id
            ];

            db.run(sql, params, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                addHistory(id, 'Edited', `Product details updated.`, d.last_updated_by, currentTime);
                res.json({ success: true });
            });
        });
    }
});

router.post('/:id/delete-action', requireAuth, (req, res) => {
    const currentUser = getCurrentUser(req);
    const role = req.body.role || (req.session && req.session.user && req.session.user.role) || '';
    db.run("UPDATE products SET product_status = 'Deleted' WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        const histMsg = role === 'Manager' ? 'Manager Soft Deleted the Product.' : 'User Soft Deleted the Product.';
        addHistory(req.params.id, 'Deleted', histMsg, currentUser);
        res.json({ success: true, deleted: true });
    });
});

// ── BULK DELETE ────────────────────────────────────────────
router.post('/bulk-delete', requireAuth, (req, res) => {
    const { ids, role } = req.body;
    const currentUser = getCurrentUser(req);
    if (!ids || ids.length === 0) return res.status(400).json({ error: "No products selected" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const action = role === 'Manager' ? 'Bulk Deleted' : 'Bulk Soft Deleted';
        const detail = role === 'Manager' ? 'Manager Permanently Deleted the Product.' : 'User soft deleted the product.';
        
        let stmt;
        if (role === 'Manager') {
            stmt = db.prepare("DELETE FROM products WHERE id = ?");
        } else {
            stmt = db.prepare("UPDATE products SET product_status = 'Deleted' WHERE id = ?");
        }
        
        const histStmt = db.prepare("INSERT INTO products_history (record_id, action, details, user_name, created_at) VALUES (?, ?, ?, ?, ?)");
        const timeStr = getSydneyTime();
        let hasError = false;

        ids.forEach(id => {
            stmt.run([id], (err) => { if (err) hasError = true; });
            histStmt.run([id, action, detail, currentUser || 'System', timeStr], (err) => { if (err) hasError = true; });
        });

        stmt.finalize(() => {
            histStmt.finalize(() => {
                if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Database transaction failed.' });
                }
                db.run("COMMIT", (err) => {
                    if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: 'Database transaction failed.' }); }
                    res.json({ success: true });
                });
            });
        });
    });
});
// ── CEC APPROVED LIST ROUTE HANDLERS ────────────────────────────────
router.get('/cec/filters', requireAuth, (req, res) => {
    const category = req.query.category || '';

    let mfgSql = "SELECT DISTINCT manufacturer FROM cec_approved_products";
    let brandSql = "SELECT DISTINCT brand FROM cec_approved_products";
    const mfgParams = [];
    const brandParams = [];

    if (category) {
        mfgSql += " WHERE category = ?";
        brandSql += " WHERE category = ?";
        mfgParams.push(category);
        brandParams.push(category);
    }

    mfgSql += " ORDER BY manufacturer ASC";
    brandSql += " ORDER BY brand ASC";

    db.all(mfgSql, mfgParams, (err, mfgRows) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(brandSql, brandParams, (brandErr, brandRows) => {
            if (brandErr) return res.status(500).json({ error: brandErr.message });

            res.json({
                manufacturers: mfgRows.map(r => r.manufacturer),
                brands: brandRows.map(r => r.brand)
            });
        });
    });
});

router.get('/cec/search', requireAuth, (req, res) => {
    const category = req.query.category || '';
    const search = req.query.search || '';
    const manufacturers = req.query.manufacturers ? req.query.manufacturers.split(',').filter(Boolean) : [];
    const brands = req.query.brands ? req.query.brands.split(',').filter(Boolean) : [];

    let sql = "SELECT * FROM cec_approved_products WHERE 1=1";
    const params = [];

    if (category) {
        sql += " AND category = ?";
        params.push(category);
    }

    if (manufacturers.length > 0) {
        const placeholders = manufacturers.map(() => '?').join(',');
        sql += ` AND manufacturer IN (${placeholders})`;
        params.push(...manufacturers);
    }

    if (brands.length > 0) {
        const placeholders = brands.map(() => '?').join(',');
        sql += ` AND brand IN (${placeholders})`;
        params.push(...brands);
    }

    if (search) {
        sql += " AND (model LIKE ?)";
        const likeTerm = `%${search}%`;
        params.push(likeTerm);
    }

    sql += " ORDER BY brand ASC, model ASC LIMIT 200";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

function formatExcelDate(val) {
    if (!val) return '';
    
    // If it's a JavaScript Date object
    if (val instanceof Date) {
        return formatDateToDDMMYYYY(val);
    }
    
    // If it's a numeric Excel serial number (e.g. 45877)
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        // Excel base date is Dec 30, 1899 due to 1900 leap year bug
        const date = new Date((num - 25569) * 86400 * 1000);
        return formatDateToDDMMYYYY(date);
    }
    
    // Try standard JS date parsing
    const str = String(val).trim();
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
        return formatDateToDDMMYYYY(new Date(parsed));
    }
    
    return str;
}

function formatDateToDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

router.post('/cec/upload-csv', requireAuth, uploadDoc.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    const category = req.body.category;
    const clearFirst = req.body.clear === 'true';

    if (!['Panel', 'Inverter', 'Battery'].includes(category)) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid or missing category for import.' });
    }

    try {
        const filePath = req.file.path;
        
        // Read file using XLSX (handles .csv, .xlsx, .xls, etc.)
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to 2D array of values
        const lines = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // delete temp file

        if (lines.length < 2) {
            return res.status(400).json({ error: 'Uploaded file is empty or invalid.' });
        }

        let headerRowIdx = -1;
        let headers = [];
        for (let i = 0; i < Math.min(lines.length, 15); i++) {
            const tempHeaders = lines[i].map(h => String(h).trim().toLowerCase());
            const hasMfg = tempHeaders.some(h => h.includes('manufacturer') || h.includes('mfg') || h.includes('licensee') || h.includes('company') || h.includes('holder'));
            const hasModel = tempHeaders.some(h => h.includes('model') || h.includes('product code') || h.includes('model number'));
            if (hasMfg && hasModel) {
                headerRowIdx = i;
                headers = tempHeaders;
                break;
            }
        }

        if (headerRowIdx === -1) {
            return res.status(400).json({ error: 'Uploaded file must contain at least Manufacturer and Model columns.' });
        }

        const mfgIdx = headers.findIndex(h => h.includes('manufacturer') || h.includes('mfg') || h.includes('licensee') || h.includes('company') || h.includes('holder'));
        const brandIdx = headers.findIndex(h => h.includes('brand'));
        const modelIdx = headers.findIndex(h => h.includes('model') || h.includes('product code') || h.includes('model number'));
        const expiryIdx = headers.findIndex(h => h.includes('expiry') || h.includes('expire'));
        const approvedIdx = headers.findIndex(h => h.includes('approved date') || h.includes('approval date') || h.includes('listed'));
        const capIdx = headers.findIndex(h => h.includes('power') || h.includes('capacity') || h.includes('rating') || h.includes('ac output') || h.includes('watt') || h.includes('w') || h.includes('kwh'));

        const productsToInsert = [];
        for (let i = headerRowIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.length < 2 || !line[mfgIdx] || !line[modelIdx]) continue;

            const manufacturer = String(line[mfgIdx]).trim();
            const brand = brandIdx !== -1 && line[brandIdx] ? String(line[brandIdx]).trim() : manufacturer;
            const model = String(line[modelIdx]).trim();
            const expiry_date = expiryIdx !== -1 && line[expiryIdx] ? formatExcelDate(line[expiryIdx]) : '';
            const approved_date = approvedIdx !== -1 && line[approvedIdx] ? formatExcelDate(line[approvedIdx]) : '';
            
            let capacity_value = 0;
            if (capIdx !== -1 && line[capIdx]) {
                const match = String(line[capIdx]).match(/[\d.]+/);
                if (match) capacity_value = parseFloat(match[0]);
            }

            // Create specs
            const specs = {};
            headers.forEach((h, idx) => {
                if (line[idx]) {
                    // Format dates inside specs as well if they are dates
                    if (idx === expiryIdx || idx === approvedIdx) {
                        specs[h] = formatExcelDate(line[idx]);
                    } else {
                        specs[h] = String(line[idx]).trim();
                    }
                }
            });

            productsToInsert.push([
                category,
                manufacturer,
                brand,
                model,
                capacity_value,
                approved_date,
                expiry_date,
                JSON.stringify(specs)
            ]);
        }

        if (productsToInsert.length === 0) {
            return res.status(400).json({ error: 'No valid products found in the file.' });
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            if (clearFirst) {
                db.run("DELETE FROM cec_approved_products WHERE category = ?", [category]);
            }

            const stmt = db.prepare(`
                INSERT INTO cec_approved_products (category, manufacturer, brand, model, capacity_value, approved_date, expiry_date, additional_specs_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            productsToInsert.forEach(p => {
                stmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
            });

            stmt.finalize();
            db.run("COMMIT", (commitErr) => {
                if (commitErr) return res.status(500).json({ error: commitErr.message });
                res.json({ success: true, count: productsToInsert.length });
            });
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/cec/import', requireAuth, (req, res) => {
    const products = req.body.products;
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'No products provided for import.' });
    }

    const currentUser = getCurrentUser(req);
    const timeStr = getSydneyTime();

    // Retrieve current max stock code
    db.get("SELECT stock_code FROM products ORDER BY CAST(stock_code AS INTEGER) DESC LIMIT 1", [], (stockErr, row) => {
        let nextCode = 1001;
        if (!stockErr && row && row.stock_code) {
            let lastCode = parseInt(row.stock_code, 10);
            if (!isNaN(lastCode)) nextCode = lastCode + 1;
        }

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            const insertStmt = db.prepare(`
                INSERT INTO products (
                    product_category, prod_name, manufacturer_name, brand_name, model_number, stock_code,
                    pro_approved_date, pro_expiry_date, product_series, no_of_phase, type_of_inverter,
                    panels_capacity_w, inv_rt_ac_out_w, inv_rt_dc_power_kw, inv_mppt,
                    nominal_battery_capacity_kwh, usable_battery_kwh, no_of_battery_modules,
                    pro_warranty_years, panels_linear_warranty_years, product_status, show_in_quotation,
                    show_in_detailed_reports, show_in_ext_install, child_products, dynamic_documents, created_at, last_update_on, last_updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?)
            `);

            const histStmt = db.prepare(`
                INSERT INTO products_history (record_id, action, details, user_name, created_at)
                VALUES (?, 'Import', ?, ?, ?)
            `);

            let hasError = false;
            let currentStockCode = nextCode;

            products.forEach(p => {
                const stock = String(currentStockCode++);
                
                let series = p.product_series || '';
                let phase = p.no_of_phase || '';
                let invType = p.type_of_inverter || '';
                let panelsCap = p.panels_capacity_w || null;
                let acOut = p.inv_rt_ac_out_w || null;
                let dcPower = p.inv_rt_dc_power_kw || null;
                let mppt = p.inv_mppt || '';
                let nomBatt = p.nominal_battery_capacity_kwh || null;
                let usableBatt = p.usable_battery_kwh || null;
                let battMods = p.no_of_battery_modules || null;
                let prodWarranty = p.pro_warranty_years || '';
                let linearWarranty = p.panels_linear_warranty_years || '';

                insertStmt.run([
                    p.product_category, p.prod_name, p.manufacturer_name, p.brand_name, p.model_number, stock,
                    p.pro_approved_date || '', p.pro_expiry_date || '', series, phase, invType,
                    panelsCap, acOut, dcPower, mppt,
                    nomBatt, usableBatt, battMods,
                    prodWarranty, linearWarranty,
                    p.product_status || 'Active', p.show_in_quotation || 'Yes', p.show_in_detailed_reports || 'Yes', p.show_in_ext_install || 'No',
                    timeStr, timeStr, currentUser || 'System'
                ], function(insErr) {
                    if (insErr) {
                        hasError = true;
                    } else {
                        const newProductId = this.lastID;
                        histStmt.run([
                            newProductId,
                            `Imported approved product ${p.prod_name} from CEC Approved List.`,
                            currentUser || 'System',
                            timeStr
                        ], (hErr) => { if (hErr) hasError = true; });
                    }
                });
            });

            insertStmt.finalize(() => {
                histStmt.finalize(() => {
                    if (hasError) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Database transaction failed during import.' });
                    }
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: 'Database transaction failed during import.' });
                        }
                        res.json({ success: true, count: products.length });
                    });
                });
            });
        });
    });
});

module.exports = router;