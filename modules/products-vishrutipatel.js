const express = require('express');
const router = express.Router();
const db = require('../database/db');
const multer = require('multer');
const fs = require('fs');
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
                created_at, last_update_on, last_updated_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`; 
            
            let id = await runQuery(sql, [
                d.product_category || 'Other', d.prod_name || '', d.manufacturer_name || '', d.brand_name || '', d.model_number || '',
                code, d.pro_approved_date || '', d.pro_expiry_date || '', d.product_series || '', d.no_of_phase || '',
                d.type_of_inverter || '', d.panels_capacity_w || '', d.inv_rt_ac_out_w || '', d.inv_rt_dc_power_kw || '', d.inv_mppt || '',
                d.nominal_battery_capacity_kwh || '', d.usable_battery_kwh || '', d.no_of_battery_modules || '', d.pro_warranty_years || '',
                d.panels_linear_warranty_years || '', d.purchase_price || '', exGst, 'Active', 'Yes', 'Yes', 
                '[]', '[]', '', '', '', '', currentTime, currentTime, currentUser
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
            '' as datasheet, '' as installation_manual, '' as wifi_manual, '' as warranty_document,
            created_at, last_update_on, last_updated_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`; 

        const params = [
            d.product_category, d.prod_name, d.manufacturer_name, d.brand_name, d.model_number,
            d.stock_code, d.pro_approved_date, d.pro_expiry_date, d.product_series, d.no_of_phase,
            d.type_of_inverter || '', d.panels_capacity_w, d.inv_rt_ac_out_w, d.inv_rt_dc_power_kw, d.inv_mppt,
            d.nominal_battery_capacity_kwh, d.usable_battery_kwh, d.no_of_battery_modules, d.pro_warranty_years,
            d.panels_linear_warranty_years, d.purchase_price, d.purchase_price_ex_gst, d.product_status,
            d.show_in_quotation, d.show_in_detailed_reports, d.child_products, d.dynamic_documents,
            currentTime, currentTime, d.last_updated_by
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
                last_update_on=?, last_updated_by=? WHERE id=?`;
            
            const params = [
                d.product_category, d.prod_name, d.manufacturer_name, d.brand_name, d.model_number,
                d.pro_approved_date, d.pro_expiry_date, d.product_series, d.no_of_phase,
                d.type_of_inverter || '', d.panels_capacity_w, d.inv_rt_ac_out_w, d.inv_rt_dc_power_kw, d.inv_mppt,
                d.nominal_battery_capacity_kwh, d.usable_battery_kwh, d.no_of_battery_modules, d.pro_warranty_years,
                d.panels_linear_warranty_years, d.purchase_price, d.purchase_price_ex_gst, d.product_status,
                d.show_in_quotation, d.show_in_detailed_reports, d.child_products, d.dynamic_documents,
                ds, im, wm, wd, currentTime, d.last_updated_by, id
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

        ids.forEach(id => {
            stmt.run([id]);
            histStmt.run([id, action, detail, currentUser || 'System', timeStr]);
        });

        stmt.finalize();
        histStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: 'Database transaction failed.' }); }
            res.json({ success: true });
        });
    });
});

module.exports = router;