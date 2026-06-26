const path = require('path');
const db = require('../database/db');
const router = require('../modules/quotations');

// Extract the raw handler from the router stack
const layer = router.stack.find(l => l.route && l.route.path === '/calculate');
if (!layer) {
    console.error("Could not find /calculate route in quotations router");
    process.exit(1);
}
// The last layer in the route stack is the actual handler
const handler = layer.route.stack[layer.route.stack.length - 1].handle;

async function runTestCase(name, input) {
    console.log(`\n=== Running Test Case: ${name} ===`);
    return new Promise((resolve, reject) => {
        const req = {
            body: input
        };
        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                if (this.statusCode && this.statusCode !== 200) {
                    console.error(`Error response (${this.statusCode}):`, data);
                } else {
                    console.log('Result:');
                    console.log(`  Total Panel Capacity: ${data.details ? data.details.totalPanelKw : 0} kW`);
                    console.log(`  Total Battery Capacity: ${data.details ? data.details.totalBatteryKwh : 0} kWh`);
                    console.log(`  Total Product Cost: $${data.details ? data.details.totalProductCost : undefined}`);
                    console.log(`  Total Installation Fee: $${data.details ? data.details.totalInstallationFee : undefined}`);
                    console.log(`  Grand Total: $${data.grandTotal}`);
                    console.log('  Breakdown:');
                    if (data.details && data.details.installationsBreakdown) {
                        data.details.installationsBreakdown.forEach(item => {
                            console.log(`    - ${item.name}: ${item.formula} -> $${item.total}`);
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
    // Wait a brief moment to ensure DB initialization is done
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // SCENARIO 1: PV-only system (with Smart Meter and Main Switch)
        // Products: Panel with total capacity = 6.6 kW (6600 W)
        await runTestCase('Scenario 1: PV-only (6.6 kW), 1 Phase', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Panel',
                    name: 'Standard Panel 440W',
                    size: 440,
                    qty: 15 // 15 * 440 = 6600 W = 6.6 kW
                }
            ],
            blackout: 'No',
            panel_install_type: 'New'
        });

        // SCENARIO 2: Battery-only system <= 30 kWh (excl. Smart Meter & Main Switch, incl. default 2 bollards if Inside)
        // Products: Battery with total capacity = 20 kWh
        await runTestCase('Scenario 2: Battery-only 20 kWh (Location Inside)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Battery',
                    name: 'Battery 10kWh',
                    kw: 10,
                    qty: 2 // 20 kWh
                }
            ],
            blackout: 'No',
            battery_location: 'Inside'
        });

        // SCENARIO 3: Battery-only system 30-42 kWh
        // Products: Battery with total capacity = 35 kWh
        await runTestCase('Scenario 3: Battery-only 35 kWh (Location Outside)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Battery',
                    name: 'Battery 35kWh',
                    kw: 35,
                    qty: 1 // 35 kWh
                }
            ],
            blackout: 'No',
            battery_location: 'Outside'
        });

        // SCENARIO 4: Battery-only system > 42 kWh
        // Products: Battery with total capacity = 45 kWh
        // Expect: $3410 + 3 * $110 = $3740 Inc GST
        await runTestCase('Scenario 4: Battery-only 45 kWh (Location Outside)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Battery',
                    name: 'Battery 15kWh',
                    kw: 15,
                    qty: 3 // 45 kWh
                }
            ],
            blackout: 'No',
            battery_location: 'Outside'
        });

        // SCENARIO 5: PV + Battery System (excl. Smart Meter & Main Switch)
        await runTestCase('Scenario 5: PV + Battery (6.6 kW + 20 kWh Battery)', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Panel',
                    name: 'Standard Panel 440W',
                    size: 440,
                    qty: 15 // 6.6 kW
                },
                {
                    type: 'Battery',
                    name: 'Battery 10kWh',
                    kw: 10,
                    qty: 2 // 20 kWh
                }
            ],
            blackout: 'No',
            panel_install_type: 'New',
            battery_location: 'Outside'
        });

        // SCENARIO 6: Panel Install Type = Replacement (incl. removal and disposal flat rate)
        await runTestCase('Scenario 6: Panel Install Type Replacement', {
            state: 'WA',
            postcode: '6000',
            phase: '1',
            products: [
                {
                    type: 'Panel',
                    name: 'Standard Panel 440W',
                    size: 440,
                    qty: 15 // 6.6 kW
                }
            ],
            blackout: 'No',
            panel_install_type: 'Replacement'
        });

    } catch (err) {
        console.error('Test run failed:', err);
    } finally {
        db.close();
    }
}

main();
