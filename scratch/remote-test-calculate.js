const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    const nodeCode = `
const path = require('path');
const db = require('/root/solar-crm/database/db');
const router = require('/root/solar-crm/modules/quotations');

const layer = router.stack.find(l => l.route && l.route.path === '/calculate');
const handler = layer.route.stack[layer.route.stack.length - 1].handle;

async function runTestCase(name, input) {
    console.log("\\n=== " + name + " ===");
    return new Promise((resolve, reject) => {
        const req = { body: input };
        const res = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) {
                if (this.statusCode && this.statusCode !== 200) {
                    console.error("Error:", data);
                } else {
                    console.log("Total Product Cost: $" + (data.details ? data.details.totalProductCost : 0));
                    console.log("Total Installation Fee: $" + (data.details ? data.details.totalInstallationFee : 0));
                    console.log("Grand Total: $" + data.grandTotal);
                    if (data.details && data.details.installationsBreakdown) {
                        data.details.installationsBreakdown.forEach(item => {
                            console.log("  - " + item.name + ": " + item.formula + " -> $" + item.total);
                        });
                    }
                }
                resolve(data);
            }
        };
        handler(req, res).catch(reject);
    });
}

async function main() {
    await new Promise(r => setTimeout(r, 500));
    try {
        // Test Battery 20 kWh
        await runTestCase('Battery 20 kWh (Inside)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [{ type: 'Battery', name: 'Battery 10kWh', kw: 10, qty: 2 }],
            battery_location: 'Inside'
        });

        // Test Battery 45 kWh
        await runTestCase('Battery 45 kWh (Outside)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [{ type: 'Battery', name: 'Battery 15kWh', kw: 15, qty: 3 }],
            battery_location: 'Outside'
        });

        // Test PV-only
        await runTestCase('PV-only (6.6 kW)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [{ type: 'Panel', name: 'Panel 440W', size: 440, qty: 15 }],
            panel_install_type: 'New'
        });
    } catch(e) {
        console.error(e);
    } finally {
        db.close();
    }
}
main();
`;

    const cmd = `cat << 'EOF' > /tmp/test_calc_remote.js
${nodeCode}
EOF
NODE_PATH=/root/solar-crm/node_modules node /tmp/test_calc_remote.js
rm -f /tmp/test_calc_remote.js
`;

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Remote execution failed:', err);
            conn.end();
            process.exit(1);
        }
        
        stream.on('close', (code, signal) => {
            conn.end();
            process.exit(code === 0 ? 0 : 1);
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).on('error', (err) => {
    console.error('SSH Connection failed:', err.message);
    process.exit(1);
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#',
    readyTimeout: 20000
});
