const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'solar_v2.db');
const db = new sqlite3.Database(dbPath);

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function testCalculation(reqBody) {
    try {
        const { leadId, postcode, state, products, blackout, phase } = reqBody;

        const customerState = (state || 'WA').toUpperCase().trim();
        const customerPostcode = parseInt(postcode) || 0;

        let customerPhase = phase || '';
        if (!customerPhase && leadId) {
            const lead = await dbGet("SELECT electricity_phase FROM leads WHERE id = ?", [leadId]);
            if (lead && lead.electricity_phase) {
                customerPhase = String(lead.electricity_phase);
            }
        }
        if (customerPhase) {
            customerPhase = customerPhase.trim().charAt(0);
        }
        if (!['1', '2', '3'].includes(customerPhase)) {
            customerPhase = '1';
        }

        // Fetch all active installation charge rates for the state
        const dbCharges = await dbAll(
            "SELECT charge_name, rate, state FROM installation_charge_items WHERE (state = ? OR state = 'WA') AND is_active = 'Yes'",
            [customerState]
        );
        const chargeRates = {};
        dbCharges.forEach(c => {
            if (!chargeRates[c.charge_name] || c.state === customerState) {
                chargeRates[c.charge_name] = parseFloat(c.rate) || 0;
            }
        });

        // 1. PRODUCT COST
        let totalProductCost = 0;
        let totalPanelKw = 0;
        let totalBatteryKwh = 0;
        const productsBreakdown = [];

        if (products && Array.isArray(products) && products.length > 0) {
            for (const item of products) {
                const qty = parseFloat(item.qty) || 0;
                if (qty <= 0) continue;

                if (item.code) {
                    const dbProduct = await dbGet(
                        "SELECT prod_name, purchase_price_ex_gst, panels_capacity_w, usable_battery_kwh, nominal_battery_capacity_kwh, product_category FROM products WHERE stock_code = ? AND product_status = 'Active'",
                        [item.code.trim()]
                    );
                    
                    if (dbProduct) {
                        const priceExGst = parseFloat(dbProduct.purchase_price_ex_gst) || 0;
                        const productTotal = priceExGst * qty;
                        totalProductCost += productTotal;

                        productsBreakdown.push({
                            type: dbProduct.product_category || item.type,
                            name: dbProduct.prod_name || item.name,
                            code: item.code.trim(),
                            qty: qty,
                            rate: priceExGst,
                            total: productTotal
                        });

                        if (dbProduct.product_category === 'Panel') {
                            const capacityW = parseFloat(dbProduct.panels_capacity_w) || 0;
                            totalPanelKw += (capacityW * qty) / 1000;
                        } else if (dbProduct.product_category === 'Battery') {
                            const capacityKwh = parseFloat(dbProduct.usable_battery_kwh || dbProduct.nominal_battery_capacity_kwh) || 0;
                            totalBatteryKwh += capacityKwh * qty;
                        }
                    } else {
                        productsBreakdown.push({
                            type: item.type,
                            name: item.name,
                            code: item.code,
                            qty: qty,
                            rate: 0,
                            total: 0
                        });
                    }
                }
            }
        }

        // 2. INSTALLATION CHARGES
        let totalInstallationFee = 0;
        const installationsBreakdown = [];

        // A. Panels PV Installation
        let panelInstallationCharge = 0;
        let solarPVRate = 0.26;
        if (totalPanelKw > 0) {
            solarPVRate = chargeRates['Installed Solar PV System with 1 X Inverter'] !== undefined ? chargeRates['Installed Solar PV System with 1 X Inverter'] : 0.26;
            panelInstallationCharge = totalPanelKw * 1000 * solarPVRate;
            totalInstallationFee += panelInstallationCharge;
            installationsBreakdown.push({
                name: "Panels PV Installation",
                formula: `${(totalPanelKw * 1000).toFixed(0)} W X $${solarPVRate.toFixed(2)}`,
                total: parseFloat(panelInstallationCharge.toFixed(2))
            });
        }
        
        // B. Battery Installation Charge
        let batteryInstallationCharge = 0;
        let batteryExcessCharge = 0;
        if (totalBatteryKwh > 0) {
            const batteryBaseRate = chargeRates['Battery Installation Upto 20 kWh'] !== undefined ? chargeRates['Battery Installation Upto 20 kWh'] : 1500.00;
            if (totalBatteryKwh <= 20) {
                batteryInstallationCharge = batteryBaseRate;
                totalInstallationFee += batteryInstallationCharge;
                installationsBreakdown.push({
                    name: "Battery Installation Upto 20 kWh",
                    formula: `Flat Rate`,
                    total: parseFloat(batteryInstallationCharge.toFixed(2))
                });
            } else {
                const batteryExcessRate = chargeRates['Battery Installation More than 20 kWh - Per kWh'] !== undefined ? chargeRates['Battery Installation More than 20 kWh - Per kWh'] : 100.00;
                batteryInstallationCharge = batteryBaseRate;
                batteryExcessCharge = (totalBatteryKwh - 20) * batteryExcessRate;
                totalInstallationFee += batteryInstallationCharge + batteryExcessCharge;
                installationsBreakdown.push({
                    name: "Battery Installation Upto 20 kWh",
                    formula: `Flat Rate`,
                    total: parseFloat(batteryInstallationCharge.toFixed(2))
                });
                installationsBreakdown.push({
                    name: "Battery Installation Above 20 kWh",
                    formula: `${(totalBatteryKwh - 20).toFixed(2)} kWh X $${batteryExcessRate.toFixed(2)}`,
                    total: parseFloat(batteryExcessCharge.toFixed(2))
                });
            }
        }

        // C. Battery Backup
        let batteryBackupCharge = 0;
        if (blackout === 'Yes') {
            const backupRate = chargeRates['Battery Backup / Blackout Protection'] !== undefined ? chargeRates['Battery Backup / Blackout Protection'] : 1200.00;
            batteryBackupCharge = backupRate;
            totalInstallationFee += batteryBackupCharge;
            installationsBreakdown.push({
                name: "Battery Backup / Blackout Protection",
                formula: `Flat Rate`,
                total: parseFloat(batteryBackupCharge.toFixed(2))
            });
        }

        // D. Smart Meter
        let smartMeterCharge = 0;
        if (totalPanelKw > 0 || totalBatteryKwh > 0) {
            const smartMeterName = customerPhase === '3' ? 'Export Control Device 3 Phase / Smart Meter' : 'Export Control Device 1 Phase / Smart Meter';
            const smartMeterRate = chargeRates[smartMeterName] !== undefined ? chargeRates[smartMeterName] : (customerPhase === '3' ? 250.00 : 150.00);
            smartMeterCharge = smartMeterRate;
            totalInstallationFee += smartMeterCharge;
            installationsBreakdown.push({
                name: `Smart Meter (${customerPhase} Phase)`,
                formula: `Flat Rate`,
                total: parseFloat(smartMeterCharge.toFixed(2))
            });
        }

        // E. Main Switch
        let mainSwitchCharge = 0;
        if (totalPanelKw > 0 || totalBatteryKwh > 0) {
            const mainSwitchRate = chargeRates['Main Switch 1P / 3P'] !== undefined ? chargeRates['Main Switch 1P / 3P'] : 109.09;
            mainSwitchCharge = mainSwitchRate;
            totalInstallationFee += mainSwitchCharge;
            installationsBreakdown.push({
                name: "Main Switch 1P / 3P",
                formula: `Flat Rate`,
                total: parseFloat(mainSwitchCharge.toFixed(2))
            });
        }

        // F. Travel Charges
        let travelDistance = 0;
        let travelCharges = 0;
        if (leadId) {
            const lead = await dbGet("SELECT project_number FROM leads WHERE id = ?", [leadId]);
            if (lead && lead.project_number) {
                const installation = await dbGet("SELECT travel_distance_km FROM installations WHERE project_number = ?", [lead.project_number]);
                if (installation && installation.travel_distance_km) {
                    travelDistance = parseFloat(installation.travel_distance_km) || 0;
                }
            }
        }
        const travelRate = chargeRates['Travel Charges'] !== undefined ? chargeRates['Travel Charges'] : 1.30;
        travelCharges = travelDistance * travelRate;
        if (travelCharges > 0) {
            installationsBreakdown.push({
                name: "Travel Charges",
                formula: `${travelDistance.toFixed(0)} km X $${travelRate.toFixed(2)}`,
                total: parseFloat(travelCharges.toFixed(2))
            });
        }

        // 3. STC REBATES
        let panelRebate = 0;
        let batteryRebate = 0;
        let zone = 3;
        let ratings = 1.1;
        let deemingPeriod = 5;
        let actualRate = 38.00;
        let batteryRatings = 0;
        let batteryDeemingPeriod = 0;
        const rebatesBreakdown = [];

        if (totalPanelKw > 0) {
            const stcRow = await dbGet(
                "SELECT zone, ratings, deeming_period FROM stc_master WHERE (type = 'Solar PV' OR type = 'Solar' OR type IS NULL OR type = '') AND (postcode = ? OR (state = ? AND (postcode IS NULL OR postcode = ''))) LIMIT 1",
                [customerPostcode, customerState]
            );
            if (stcRow) {
                zone = stcRow.zone || zone;
                ratings = stcRow.ratings || ratings;
                deemingPeriod = stcRow.deeming_period || deemingPeriod;
            }
            const rebateRow = await dbGet(
                "SELECT actual_rate FROM rebate_live_master_v2 WHERE (zone = ? OR state = ?) AND status = 'Active' LIMIT 1",
                [zone, customerState]
            );
            if (rebateRow) {
                actualRate = rebateRow.actual_rate || actualRate;
            }
            const panelStcQty = totalPanelKw * ratings * deemingPeriod;
            panelRebate = panelStcQty * actualRate;
            rebatesBreakdown.push({
                name: "STC Panels",
                formula: `${panelStcQty.toFixed(2)} Qty X $${actualRate.toFixed(2)}`,
                total: parseFloat(panelRebate.toFixed(2))
            });
        }

        if (totalBatteryKwh > 0) {
            const batStcRow = await dbGet(
                "SELECT zone, ratings, deeming_period FROM stc_master WHERE type = 'Battery' AND (postcode = ? OR (state = ? AND (postcode IS NULL OR postcode = ''))) LIMIT 1",
                [customerPostcode, customerState]
            );
            if (batStcRow) {
                batteryRatings = batStcRow.ratings || 0;
                // Battery certificates are capacity-based and use a tapered slab system (effective 1 May 2026):
                // - 0 to 14 kWh: 100% of STC factor
                // - >14 to 28 kWh: 60% of STC factor
                // - >28 to 50 kWh: 15% of STC factor
                // - Above 50 kWh: 0% of STC factor (max 50 kWh usable capacity eligible)
                // The final STC quantity is rounded down (floored) to the nearest integer.
                const eligibleCapacity = Math.min(totalBatteryKwh, 50);
                const slab1 = Math.min(eligibleCapacity, 14);
                const slab2 = Math.max(0, Math.min(eligibleCapacity, 28) - 14);
                const slab3 = Math.max(0, eligibleCapacity - 28);
                
                const rawStcQty = (slab1 * batteryRatings * 1.0) + 
                                  (slab2 * batteryRatings * 0.6) + 
                                  (slab3 * batteryRatings * 0.15);
                                  
                const batteryStcQty = Math.floor(rawStcQty);
                batteryRebate = batteryStcQty * actualRate;
                rebatesBreakdown.push({
                    name: "STC Battery",
                    formula: `${batteryStcQty.toFixed(2)} Qty X $${actualRate.toFixed(2)}`,
                    total: parseFloat(batteryRebate.toFixed(2))
                });
            }
        }

        const totalRebates = panelRebate + batteryRebate;

        // 4. MARGIN METRICS
        let customerArea = 'Metro';
        if (leadId) {
            const lead = await dbGet("SELECT area FROM leads WHERE id = ?", [leadId]);
            if (lead && lead.area) {
                customerArea = lead.area;
            }
        }
        let pvMargin = 0;
        let batteryMargin = 0;
        const marginsBreakdown = [];

        let marginRows = await dbAll(
            "SELECT margin_type, margins, state, area FROM margin_master_v2 WHERE (state = ? OR state = 'WA') AND (area = ? OR area = 'Metro')",
            [customerState, customerArea]
        );
        
        // 1. State Filter / Fallback
        const hasCustomerStateRows = marginRows.some(row => row.state === customerState);
        if (hasCustomerStateRows) {
            marginRows = marginRows.filter(row => row.state === customerState);
        } else {
            marginRows = marginRows.filter(row => row.state === 'WA');
        }

        // 2. Area Filter / Fallback
        const hasCustomerAreaRows = marginRows.some(row => row.area === customerArea);
        if (hasCustomerAreaRows) {
            marginRows = marginRows.filter(row => row.area === customerArea);
        } else {
            marginRows = marginRows.filter(row => row.area === 'Metro');
        }

        marginRows.forEach(row => {
            try {
                const bracketArray = JSON.parse(row.margins);
                if (Array.isArray(bracketArray)) {
                    bracketArray.forEach(bracket => {
                        const valFrom = parseFloat(bracket.from);
                        const valTo = parseFloat(bracket.to);
                        const marginVal = parseFloat(bracket.margin);
                        if (row.margin_type === 'PV') {
                            const checkVal = Math.round(totalPanelKw * 10) / 10;
                            if (checkVal >= valFrom && checkVal <= valTo) pvMargin = marginVal;
                        } else if (row.margin_type === 'Battery') {
                            const checkVal = Math.round(totalBatteryKwh * 10) / 10;
                            if (checkVal >= valFrom && checkVal <= valTo) batteryMargin = marginVal;
                        }
                    });
                }
            } catch (e) {}
        });

        if (pvMargin > 0) marginsBreakdown.push({ name: "PV System Margin", total: pvMargin });
        if (batteryMargin > 0) marginsBreakdown.push({ name: "Battery System Margin", total: batteryMargin });
        const totalMargin = pvMargin + batteryMargin;

        // 5. SUMMARY
        const grandTotal = totalProductCost + totalInstallationFee + travelCharges;
        const sellingPrice = (grandTotal + totalMargin) - totalRebates;
        const deposit = sellingPrice * 0.10;

        console.log("=== CALCULATOR TEST SUCCESS ===");
        console.log("Response:", JSON.stringify({
            success: true,
            grandTotal,
            rebates: totalRebates,
            sellingPrice,
            deposit,
            marginVal: totalMargin,
            details: {
                totalProductCost,
                totalInstallationFee,
                travelCharges,
                totalPanelKw,
                totalBatteryKwh,
                productsBreakdown,
                installationsBreakdown,
                rebatesBreakdown,
                marginsBreakdown
            }
        }, null, 2));

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        db.close();
    }
}

// Run test with simulated Jinko 475W Panel (code: 1001, qty: 14) -> 6.65 kW Panel size
// and Growatt Inverter (code: 2004, qty: 1)
// and Single Phase
testCalculation({
    leadId: 31,
    postcode: '6112',
    state: 'WA',
    blackout: 'No',
    phase: '1',
    products: [
        { type: 'Panel', code: '1001', qty: 14 },
        { type: 'Inverter', code: '2004', qty: 1 },
        { type: 'Battery', code: '2014', qty: 1 }
    ]
});
