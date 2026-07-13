const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Client Ready');
    
    // Restoration script to run on live server
    const command = `node -e "
const sqlite3 = require('/root/solar-crm/node_modules/sqlite3').verbose();
const db = new sqlite3.Database('/root/solar-crm/database/solar_v2.db');

const groupRecord = {
    id: 4,
    group_name: 'Growatt Combo - SPH & ALP - 1P',
    panel_stock_code: '',
    inverter_stock_code: '',
    battery_stock_code: ''
};

const newVariants = [
    {
        variant_name: 'SPH + 25 kWh ALP',
        stock_code: 'CBO-1013',
        panel_qty: 0,
        inverter_qty: 1,
        battery_qty: 1,
        purchase_price: 6788.1,
        purchase_price_ex_gst: 6171,
        panel_stock_code: null,
        inverter_stock_code: '2002',
        battery_stock_code: '2011'
    },
    {
        variant_name: 'SPH + 30 kWh ALP',
        stock_code: 'CBO-1014',
        panel_qty: 0,
        inverter_qty: 1,
        battery_qty: 1,
        purchase_price: 7833.1,
        purchase_price_ex_gst: 7121,
        panel_stock_code: null,
        inverter_stock_code: '2002',
        battery_stock_code: '2012'
    },
    {
        variant_name: 'SPH + 35 kWh ALP',
        stock_code: 'CBO-1015',
        panel_qty: 0,
        inverter_qty: 1,
        battery_qty: 1,
        purchase_price: 8878.1,
        purchase_price_ex_gst: 8071,
        panel_stock_code: null,
        inverter_stock_code: '2002',
        battery_stock_code: '2013'
    },
    {
        variant_name: 'SPH + 40 kWh ALP',
        stock_code: 'CBO-1016',
        panel_qty: 0,
        inverter_qty: 1,
        battery_qty: 1,
        purchase_price: 9923.1,
        purchase_price_ex_gst: 9021,
        panel_stock_code: null,
        inverter_stock_code: '2002',
        battery_stock_code: '2014'
    }
];

function syncProduct(variant, callback) {
    const childProducts = [];
    if (variant.inverter_stock_code) {
        childProducts.push({ code: variant.inverter_stock_code, qty: variant.inverter_qty });
    }
    if (variant.battery_stock_code) {
        childProducts.push({ code: variant.battery_stock_code, qty: variant.battery_qty });
    }
    const childProductsJson = JSON.stringify(childProducts);
    const prodName = groupRecord.group_name + ' [' + variant.variant_name + ']';

    db.get('SELECT id FROM products WHERE stock_code = ?', [variant.stock_code], (err, product) => {
        if (err) return callback(err);

        if (product) {
            const sql = 'UPDATE products SET product_category = \\'Combo\\', prod_name = ?, manufacturer_name = \\'Ares\\', brand_name = \\'Ares\\', model_number = ?, purchase_price = ?, purchase_price_ex_gst = ?, product_status = \\'Active\\', show_in_quotation = \\'Yes\\', show_in_detailed_reports = \\'Yes\\', child_products = ?, last_update_on = datetime(\\'now\\', \\'localtime\\') WHERE id = ?';
            db.run(sql, [prodName, variant.variant_name, variant.purchase_price, variant.purchase_price_ex_gst, childProductsJson, product.id], callback);
        } else {
            const sql = 'INSERT INTO products (product_category, prod_name, manufacturer_name, brand_name, model_number, stock_code, purchase_price, purchase_price_ex_gst, product_status, show_in_quotation, show_in_detailed_reports, child_products, created_at) VALUES (\\'Combo\\', ?, \\'Ares\\', \\'Ares\\', ?, ?, ?, ?, \\'Active\\', \\'Yes\\', \\'Yes\\', ?, datetime(\\'now\\', \\'localtime\\'))';
            db.run(sql, [prodName, variant.variant_name, variant.stock_code, variant.purchase_price, variant.purchase_price_ex_gst, childProductsJson], callback);
        }
    });
}

db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let index = 0;
    function insertNext() {
        if (index >= newVariants.length) {
            db.run('COMMIT', (err) => {
                if (err) {
                    console.error('Commit failed:', err);
                    db.run('ROLLBACK');
                } else {
                    console.log('RESTORATION SUCCESSFUL');
                }
                db.close();
            });
            return;
        }

        const v = newVariants[index];
        const sql = 'INSERT INTO combo_variants (combo_group_id, variant_name, stock_code, panel_qty, inverter_qty, battery_qty, purchase_price, purchase_price_ex_gst, panel_stock_code, inverter_stock_code, battery_stock_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \\'Active\\')';
        db.run(sql, [groupRecord.id, v.variant_name, v.stock_code, v.panel_qty, v.inverter_qty, v.battery_qty, v.purchase_price, v.purchase_price_ex_gst, v.panel_stock_code, v.inverter_stock_code, v.battery_stock_code], (err) => {
            if (err) {
                console.error('Variant insert failed:', err);
                db.run('ROLLBACK');
                db.close();
                return;
            }
            
            syncProduct(v, (syncErr) => {
                if (syncErr) {
                    console.error('Product sync failed:', syncErr);
                    db.run('ROLLBACK');
                    db.close();
                    return;
                }
                index++;
                insertNext();
            });
        });
    }

    insertNext();
});
"`;

    conn.exec(command, (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code);
            console.log(data);
            conn.end();
        }).on('data', (chunk) => {
            data += chunk;
        }).stderr.on('data', (data) => {
            console.error('STDERR: ' + data);
        });
    });
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#'
});
