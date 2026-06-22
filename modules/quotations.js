const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../helpers');

// Helper to query single row as Promise
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Helper to query all rows as Promise
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Calculate route
router.post('/calculate', requireAuth, async (req, res) => {
    try {
        const { leadId, postcode, state, products, blackout, phase, house_storey, roof_type, roof_angle, panel_install_type, battery_install_type, battery_location, type_of_lead, site_visit_req, vpp_rebate } = req.body;

        const customerState = (state || 'WA').toUpperCase().trim();
        const customerPostcode = parseInt(postcode) || 0;

        // Retrieve phase from request body, fallback to DB if possible
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

        // Retrieve type_of_lead with fallback to DB if possible
        let customerLeadType = type_of_lead || '';
        if (leadId && !customerLeadType) {
            const lead = await dbGet("SELECT type_of_lead FROM leads WHERE id = ?", [leadId]);
            if (lead && lead.type_of_lead) {
                customerLeadType = lead.type_of_lead;
            }
        }

        // Retrieve house_storey, roof_type, roof_angle, panel_install_type, battery_install_type, battery_location, site_visit_req, vpp_rebate with fallback to DB if possible
        let customerHouseStorey = house_storey || '';
        let customerRoofType = roof_type || '';
        let customerRoofAngle = roof_angle || '';
        let customerPanelInstallType = panel_install_type || '';
        let customerBatteryInstallType = battery_install_type || '';
        let customerBatteryLocation = battery_location || '';
        let customerSiteVisitReq = site_visit_req || 'No';
        let customerVppRebate = vpp_rebate || 'No';

        if (leadId && (!customerHouseStorey || !customerRoofType || !customerRoofAngle || !customerPanelInstallType || !customerBatteryInstallType || !customerBatteryLocation || !customerSiteVisitReq || !customerVppRebate)) {
            const lead = await dbGet("SELECT engineering_details FROM leads WHERE id = ?", [leadId]);
            if (lead && lead.engineering_details) {
                try {
                    const eng = JSON.parse(lead.engineering_details);
                    if (!customerHouseStorey) customerHouseStorey = eng.house_storey || '';
                    if (!customerRoofType) customerRoofType = eng.roof_type || '';
                    if (!customerRoofAngle) customerRoofAngle = eng.roof_angle || '';
                    if (!customerPanelInstallType) customerPanelInstallType = eng.panel_install_type || '';
                    if (!customerBatteryInstallType) customerBatteryInstallType = eng.battery_install_type || '';
                    if (!customerBatteryLocation) customerBatteryLocation = eng.battery_location || '';
                    if (!customerSiteVisitReq) customerSiteVisitReq = eng.site_visit_req || 'No';
                    if (!customerVppRebate) customerVppRebate = eng.vpp_rebate || 'No';
                } catch (e) {
                    console.error("Error parsing engineering_details in calculations:", e);
                }
            }
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

        // 1. PRODUCT COST (GRAND TOTAL BASE) & DETAILS FOR BREAKDOWN
        let totalProductCost = 0;
        let totalPanelKw = 0;
        let totalBatteryKwh = 0;
        let hasExtraRoofInstallation = false;
        const productsBreakdown = [];

        if (products && Array.isArray(products) && products.length > 0) {
            for (const item of products) {
                const qty = parseFloat(item.qty) || 0;
                if (qty <= 0) continue;

                let dbProduct = null;
                if (item.code) {
                    dbProduct = await dbGet(
                        "SELECT prod_name, purchase_price, purchase_price_ex_gst, panels_capacity_w, usable_battery_kwh, nominal_battery_capacity_kwh, product_category, inv_mppt FROM products WHERE stock_code = ? AND product_status = 'Active'",
                        [item.code.trim()]
                    );
                }

                if (dbProduct) {
                    const priceIncGst = parseFloat(dbProduct.purchase_price) || (parseFloat(dbProduct.purchase_price_ex_gst) * 1.1) || 0;
                    const productTotal = priceIncGst * qty;
                    totalProductCost += productTotal;

                    productsBreakdown.push({
                        type: dbProduct.product_category || item.type,
                        name: dbProduct.prod_name || item.name,
                        code: item.code ? item.code.trim() : '',
                        qty: qty,
                        rate: priceIncGst,
                        total: productTotal
                    });

                    if (dbProduct.product_category === 'Panel') {
                        const capacityW = parseFloat(dbProduct.panels_capacity_w) || 0;
                        totalPanelKw += (capacityW * qty) / 1000;
                    } else if (dbProduct.product_category === 'Battery') {
                        const capacityKwh = parseFloat(dbProduct.usable_battery_kwh || dbProduct.nominal_battery_capacity_kwh) || 0;
                        totalBatteryKwh += capacityKwh * qty;
                    } else if (dbProduct.product_category === 'Inverter') {
                        const mpptCount = parseInt(dbProduct.inv_mppt) || 0;
                        if (mpptCount > 2) {
                            hasExtraRoofInstallation = true;
                        }
                    }
                } else {
                    // Fallback: product not in DB or no stock code — use UI size field for capacity estimation
                    const itemType = (item.type || '').trim();
                    const itemSize = parseFloat(item.size) || parseFloat(item.kw) || 0;
                    const itemKw = parseFloat(item.kw) || 0;

                    // Only add to capacity if the item has a name (not blank row)
                    if (item.name && item.name.trim()) {
                        productsBreakdown.push({
                            type: itemType || 'Unknown',
                            name: item.name,
                            code: item.code || '—',
                            qty: qty,
                            rate: 0,
                            total: 0
                        });

                        if (itemType === 'Panel' && itemSize > 0) {
                            // itemSize is in Watts for panels
                            totalPanelKw += (itemSize * qty) / 1000;
                        } else if (itemType === 'Panel' && itemKw > 0) {
                            // itemKw is in kW for panels
                            totalPanelKw += itemKw * qty;
                        } else if (itemType === 'Battery' && itemSize > 0) {
                            // itemSize is in kWh for batteries
                            totalBatteryKwh += itemSize * qty;
                        } else if (itemType === 'Battery' && itemKw > 0) {
                            // itemKw is in kWh for batteries
                            totalBatteryKwh += itemKw * qty;
                        }
                    }
                }
            }
        }

        // 2. INSTALLATION CHARGES
        let totalInstallationFee = 0;
        const installationsBreakdown = [];

        // A. Panels Installation Charge ($0.26 per Watt by default, plus 10% GST)
        let panelInstallationCharge = 0;
        let solarPVRate = 0.26;
        if (totalPanelKw > 0) {
            solarPVRate = chargeRates['Installed Solar PV System with 1 X Inverter'] !== undefined ? chargeRates['Installed Solar PV System with 1 X Inverter'] : 0.26;
            const solarPVRateIncGst = solarPVRate * 1.10;
            panelInstallationCharge = totalPanelKw * 1000 * solarPVRateIncGst;
            totalInstallationFee += panelInstallationCharge;
            installationsBreakdown.push({
                name: "Panels PV Installation",
                formula: `${(totalPanelKw * 1000).toFixed(0)} W X $${solarPVRateIncGst.toFixed(3)}`,
                total: parseFloat(panelInstallationCharge.toFixed(2))
            });
        }
        
        // B. Battery Installation Charge (Upto 20 kWh base + excess, plus 10% GST)
        let batteryInstallationCharge = 0;
        let batteryExcessCharge = 0;
        if (totalBatteryKwh > 0) {
            const batteryBaseRate = chargeRates['Battery Installation Upto 20 kWh'] !== undefined ? chargeRates['Battery Installation Upto 20 kWh'] : 1500.00;
            const batteryBaseRateIncGst = batteryBaseRate * 1.10;
            if (totalBatteryKwh <= 20) {
                batteryInstallationCharge = batteryBaseRateIncGst;
                totalInstallationFee += batteryInstallationCharge;
                installationsBreakdown.push({
                    name: "Battery Installation Upto 20 kWh",
                    formula: `Flat Rate`,
                    total: parseFloat(batteryInstallationCharge.toFixed(2))
                });
            } else {
                const batteryExcessRate = chargeRates['Battery Installation More than 20 kWh - Per kWh'] !== undefined ? chargeRates['Battery Installation More than 20 kWh - Per kWh'] : 100.00;
                const batteryExcessRateIncGst = batteryExcessRate * 1.10;
                batteryInstallationCharge = batteryBaseRateIncGst;
                batteryExcessCharge = (totalBatteryKwh - 20) * batteryExcessRateIncGst;
                totalInstallationFee += batteryInstallationCharge + batteryExcessCharge;
                installationsBreakdown.push({
                    name: "Battery Installation Upto 20 kWh",
                    formula: `Flat Rate`,
                    total: parseFloat(batteryInstallationCharge.toFixed(2))
                });
                installationsBreakdown.push({
                    name: "Battery Installation Above 20 kWh",
                    formula: `${(totalBatteryKwh - 20).toFixed(2)} kWh X $${batteryExcessRateIncGst.toFixed(2)}`,
                    total: parseFloat(batteryExcessCharge.toFixed(2))
                });
            }
        }

        // C. Battery Backup / Blackout Protection (plus 10% GST)
        let batteryBackupCharge = 0;
        if (blackout === 'Yes') {
            const backupRate = chargeRates['Battery Backup / Blackout Protection'] !== undefined ? chargeRates['Battery Backup / Blackout Protection'] : 1200.00;
            const backupRateIncGst = backupRate * 1.10;
            batteryBackupCharge = backupRateIncGst;
            totalInstallationFee += batteryBackupCharge;
            installationsBreakdown.push({
                name: "Battery Backup / Blackout Protection",
                formula: `Flat Rate`,
                total: parseFloat(batteryBackupCharge.toFixed(2))
            });
        }

        // D. Smart Meter (Export Control Device, plus 10% GST)
        let smartMeterCharge = 0;
        if (totalPanelKw > 0 || totalBatteryKwh > 0) {
            const isMultiPhase = customerPhase === '2' || customerPhase === '3';
            const smartMeterName = isMultiPhase ? 'Export Control Device 3 Phase / Smart Meter' : 'Export Control Device 1 Phase / Smart Meter';
            const smartMeterRate = chargeRates[smartMeterName] !== undefined ? chargeRates[smartMeterName] : (isMultiPhase ? 250.00 : 150.00);
            const smartMeterRateIncGst = smartMeterRate * 1.10;
            smartMeterCharge = smartMeterRateIncGst;
            totalInstallationFee += smartMeterCharge;
            installationsBreakdown.push({
                name: `Smart Meter (${customerPhase} Phase)`,
                formula: `Flat Rate`,
                total: parseFloat(smartMeterCharge.toFixed(2))
            });
        }

        // E. Main Switch (plus 10% GST)
        let mainSwitchCharge = 0;
        if (totalPanelKw > 0 || totalBatteryKwh > 0) {
            const mainSwitchRate = chargeRates['Main Switch 1P / 3P'] !== undefined ? chargeRates['Main Switch 1P / 3P'] : 109.09;
            const mainSwitchRateIncGst = mainSwitchRate * 1.10;
            mainSwitchCharge = mainSwitchRateIncGst;
            totalInstallationFee += mainSwitchCharge;
            installationsBreakdown.push({
                name: "Main Switch 1P / 3P",
                formula: `Flat Rate`,
                total: parseFloat(mainSwitchCharge.toFixed(2))
            });
        }

        // G. Double/Multi House Storey (plus 10% GST)
        if (customerHouseStorey === 'Double' || customerHouseStorey === 'Multi') {
            const doubleStoreyRate = chargeRates['Double House Storey'] !== undefined ? chargeRates['Double House Storey'] : 1000.00;
            const doubleStoreyRateIncGst = doubleStoreyRate * 1.10;
            totalInstallationFee += doubleStoreyRateIncGst;
            installationsBreakdown.push({
                name: "Double/Multi Storey Installation",
                formula: `Flat Rate`,
                total: parseFloat(doubleStoreyRateIncGst.toFixed(2))
            });
        }

        // H. Terra Cotta or Clay Tiles Roof (plus 10% GST)
        if (customerRoofType === 'Clay' || customerRoofType === 'Terracotta') {
            const terracottaRate = chargeRates['Terra Cotta or Clay Tiles'] !== undefined ? chargeRates['Terra Cotta or Clay Tiles'] : 100.00;
            const terracottaRateIncGst = terracottaRate * 1.10;
            totalInstallationFee += terracottaRateIncGst;
            installationsBreakdown.push({
                name: "Terra Cotta/Clay Tiles Installation",
                formula: `Flat Rate`,
                total: parseFloat(terracottaRateIncGst.toFixed(2))
            });
        }

        // I. Steel Roof Over 28 Degree Roof Angle (plus 10% GST)
        if (customerRoofAngle === '24° to 30°') {
            const steelRoofRate = chargeRates['Steel Roof Over 28 Degree'] !== undefined ? chargeRates['Steel Roof Over 28 Degree'] : 200.00;
            const steelRoofRateIncGst = steelRoofRate * 1.10;
            totalInstallationFee += steelRoofRateIncGst;
            installationsBreakdown.push({
                name: "Steel Roof Over 28 Degree Installation",
                formula: `Flat Rate`,
                total: parseFloat(steelRoofRateIncGst.toFixed(2))
            });
        }

        // J. Panel Install Type Extra Capacity Charges (plus 10% GST)
        if (totalPanelKw > 0 && (customerPanelInstallType === 'New' || customerPanelInstallType === 'Add-On' || customerPanelInstallType === 'Replacement')) {
            let extraChargeName = '';
            let fallbackRate = 0;
            if (totalPanelKw <= 6.6) {
                extraChargeName = 'Extra upto 6.6 kW';
                fallbackRate = 500.00;
            } else if (totalPanelKw <= 10.0) {
                extraChargeName = 'Extra upto 10 kW';
                fallbackRate = 1000.00;
            } else if (totalPanelKw <= 15.0) {
                extraChargeName = 'Extra upto 15 kW';
                fallbackRate = 1200.00;
            } else if (totalPanelKw <= 20.0) {
                extraChargeName = 'Extra upto 20 kW';
                fallbackRate = 1500.00;
            } else if (totalPanelKw <= 25.0) {
                extraChargeName = 'Extra upto 25 kW';
                fallbackRate = 1800.00;
            } else if (totalPanelKw <= 30.0) {
                extraChargeName = 'Extra upto 30 kW';
                fallbackRate = 1800.00;
            }

            if (extraChargeName) {
                const extraRate = chargeRates[extraChargeName] !== undefined ? chargeRates[extraChargeName] : fallbackRate;
                const extraRateIncGst = extraRate * 1.10;
                totalInstallationFee += extraRateIncGst;
                installationsBreakdown.push({
                    name: `${extraChargeName} (${customerPanelInstallType} Panel)`,
                    formula: `Flat Rate`,
                    total: parseFloat(extraRateIncGst.toFixed(2))
                });
            }

            // If Replacement Panel Type, add Existing System Removal and Disposal
            if (customerPanelInstallType === 'Replacement') {
                const removalRate = chargeRates['Existing System Removal and Disposal'] !== undefined ? chargeRates['Existing System Removal and Disposal'] : 300.00;
                const removalRateIncGst = removalRate * 1.10;
                totalInstallationFee += removalRateIncGst;
                installationsBreakdown.push({
                    name: "Existing System Removal and Disposal",
                    formula: `Flat Rate`,
                    total: parseFloat(removalRateIncGst.toFixed(2))
                });
            }
        }

        // K. Battery Install Type - AC Couple Rewiring (plus 10% GST)
        if (customerBatteryInstallType === 'AC Couple') {
            const rewiringRate = chargeRates['Rewiring'] !== undefined ? chargeRates['Rewiring'] : 600.00;
            const rewiringRateIncGst = rewiringRate * 1.10;
            totalInstallationFee += rewiringRateIncGst;
            installationsBreakdown.push({
                name: "Rewiring",
                formula: `Flat Rate`,
                total: parseFloat(rewiringRateIncGst.toFixed(2))
            });
        }

        // L. Battery Location based charges (plus 10% GST)
        if (customerBatteryLocation === 'Inside') {
            const bollardRate = chargeRates['Bollard Installation Per Unit'] !== undefined ? chargeRates['Bollard Installation Per Unit'] : 150.00;
            const bollardRateIncGst = bollardRate * 1.10;
            const bollardTotal = bollardRateIncGst * 2;
            totalInstallationFee += bollardTotal;
            installationsBreakdown.push({
                name: "Bollard Installation Per Unit (Qty 2)",
                formula: `2 X $${bollardRateIncGst.toFixed(2)}`,
                total: parseFloat(bollardTotal.toFixed(2))
            });
        } else if (customerBatteryLocation === 'Outside') {
            const enclosureRate = chargeRates['Weather Enclosure 12 Pole'] !== undefined ? chargeRates['Weather Enclosure 12 Pole'] : 250.00;
            const enclosureRateIncGst = enclosureRate * 1.10;
            totalInstallationFee += enclosureRateIncGst;
            installationsBreakdown.push({
                name: "Weather Enclosure 12 Pole",
                formula: `Flat Rate`,
                total: parseFloat(enclosureRateIncGst.toFixed(2))
            });
        }

        // M. Type of Lead - Inverter Replacement (plus 10% GST)
        if (customerLeadType === 'Battery') {
            const invReplacementRate = chargeRates['Inverter Replacement'] !== undefined ? chargeRates['Inverter Replacement'] : 150.00;
            const invReplacementRateIncGst = invReplacementRate * 1.10;
            totalInstallationFee += invReplacementRateIncGst;
            installationsBreakdown.push({
                name: "Inverter Replacement",
                formula: `Flat Rate`,
                total: parseFloat(invReplacementRateIncGst.toFixed(2))
            });
        }

        // N. Site Visit - Site Inspection (plus 10% GST)
        if (customerSiteVisitReq === 'Yes') {
            const siteInspectionRate = chargeRates['Site Inspection'] !== undefined ? chargeRates['Site Inspection'] : 150.00;
            const siteInspectionRateIncGst = siteInspectionRate * 1.10;
            totalInstallationFee += siteInspectionRateIncGst;
            installationsBreakdown.push({
                name: "Site Inspection",
                formula: `Flat Rate`,
                total: parseFloat(siteInspectionRateIncGst.toFixed(2))
            });
        }

        // O. Battery Size Capacity Charges (plus 10% GST)
        if (totalBatteryKwh > 0) {
            let batteryExtraName = '';
            let batteryExtraFallback = 0;

            if (totalBatteryKwh <= 20) {
                batteryExtraName = 'Extra Battery upto 20 kWh';
                batteryExtraFallback = 300.00;
            } else if (totalBatteryKwh <= 30) {
                batteryExtraName = 'Extra Battery upto 30 kWh';
                batteryExtraFallback = 500.00;
            } else if (totalBatteryKwh <= 40) {
                batteryExtraName = 'Extra Battery upto 40 kWh';
                batteryExtraFallback = 800.00;
            } else if (totalBatteryKwh <= 50) {
                batteryExtraName = 'Extra Battery upto 50 kWh';
                batteryExtraFallback = 1000.00;
            } else {
                batteryExtraName = 'Extra Battery upto 60 kWh';
                batteryExtraFallback = 1200.00;
            }

            if (batteryExtraName) {
                const rate = chargeRates[batteryExtraName] !== undefined ? chargeRates[batteryExtraName] : batteryExtraFallback;
                const rateIncGst = rate * 1.10;
                totalInstallationFee += rateIncGst;
                installationsBreakdown.push({
                    name: batteryExtraName,
                    formula: `Flat Rate`,
                    total: parseFloat(rateIncGst.toFixed(2))
                });
            }

            if (totalBatteryKwh > 20) {
                const secondStackRate = chargeRates['Add on 2nd Stack of Battery (Suitable according to Height)'] !== undefined
                    ? chargeRates['Add on 2nd Stack of Battery (Suitable according to Height)']
                    : 250.00;
                const secondStackRateIncGst = secondStackRate * 1.10;
                totalInstallationFee += secondStackRateIncGst;
                installationsBreakdown.push({
                    name: 'Add on 2nd Stack of Battery (Suitable according to Height)',
                    formula: `Flat Rate`,
                    total: parseFloat(secondStackRateIncGst.toFixed(2))
                });
            }
        }

        // P. Inverter MPPT - Extra Roof Installation (plus 10% GST)
        if (hasExtraRoofInstallation) {
            const extraRoofRate = chargeRates['Extra Roof Installation'] !== undefined ? chargeRates['Extra Roof Installation'] : 100.00;
            const extraRoofRateIncGst = extraRoofRate * 1.10;
            totalInstallationFee += extraRoofRateIncGst;
            installationsBreakdown.push({
                name: "Extra Roof Installation",
                formula: `Flat Rate`,
                total: parseFloat(extraRoofRateIncGst.toFixed(2))
            });
        }

        // F. Travel Charges (above 50 km, plus 10% GST)
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
        const travelRateIncGst = travelRate * 1.10;
        const billableDistance = Math.max(0, travelDistance - 50);
        travelCharges = billableDistance * travelRateIncGst;
        if (travelCharges > 0) {
            installationsBreakdown.push({
                name: "Travel Charges",
                formula: `${billableDistance.toFixed(0)} km (exceeding 50 km) X $${travelRateIncGst.toFixed(2)}`,
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

        // A. Solar PV STC Rebate
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

        // B. Battery STC / Certificate Rebate
        if (totalBatteryKwh > 0) {
            const batStcRow = await dbGet(
                "SELECT zone, ratings, deeming_period FROM stc_master WHERE type = 'Battery' AND (postcode = ? OR (state = ? AND (postcode IS NULL OR postcode = ''))) LIMIT 1",
                [customerPostcode, customerState]
            );

            if (batStcRow) {
                batteryRatings = batStcRow.ratings || 0;
                // Battery certificates are capacity-based and do not use SRES solar PV deeming period multiplication
                const batteryStcQty = totalBatteryKwh * batteryRatings;
                batteryRebate = batteryStcQty * actualRate;

                rebatesBreakdown.push({
                    name: "STC Battery",
                    formula: `${batteryStcQty.toFixed(2)} Qty X $${actualRate.toFixed(2)}`,
                    total: parseFloat(batteryRebate.toFixed(2))
                });
            }
        }

        // C. VPP Rebate
        if (customerVppRebate === 'Yes') {
            rebatesBreakdown.push({
                name: "VPP Rebate",
                formula: `Flat Rate`,
                total: 1300.00
            });
        }

        const totalRebates = panelRebate + batteryRebate + (customerVppRebate === 'Yes' ? 1300.00 : 0);

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

                        if (row.margin_type === 'PV' && totalPanelKw > 0) {
                            const checkVal = Math.round(totalPanelKw * 10) / 10;
                            if (checkVal >= valFrom && checkVal <= valTo) {
                                pvMargin = marginVal;
                            }
                        } else if (row.margin_type === 'Battery' && totalBatteryKwh > 0) {
                            const checkVal = Math.round(totalBatteryKwh * 10) / 10;
                            if (checkVal >= valFrom && checkVal <= valTo) {
                                batteryMargin = marginVal;
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsing margins JSON bracket:", e);
            }
        });

        if (pvMargin > 0) {
            marginsBreakdown.push({
                name: "PV System Margin",
                total: parseFloat(pvMargin.toFixed(2))
            });
        }
        if (batteryMargin > 0) {
            marginsBreakdown.push({
                name: "Battery System Margin",
                total: parseFloat(batteryMargin.toFixed(2))
            });
        }

        const totalMargin = pvMargin + batteryMargin;

        // 5. FINAL SUMMARY CALCULATIONS
        const grandTotal = totalProductCost + totalInstallationFee + travelCharges;
        const sellingPrice = (grandTotal + totalMargin) - totalRebates;
        const deposit = sellingPrice * 0.10;


        res.json({
            success: true,
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            rebates: parseFloat(totalRebates.toFixed(2)),
            sellingPrice: parseFloat(sellingPrice.toFixed(2)),
            deposit: parseFloat(deposit.toFixed(2)),
            marginVal: parseFloat(totalMargin.toFixed(2)),
            details: {
                totalProductCost: parseFloat(totalProductCost.toFixed(2)),
                totalInstallationFee: parseFloat(totalInstallationFee.toFixed(2)),
                travelCharges: parseFloat(travelCharges.toFixed(2)),
                travelDistance: parseFloat(travelDistance.toFixed(2)),
                totalPanelKw: parseFloat(totalPanelKw.toFixed(4)),
                totalBatteryKwh: parseFloat(totalBatteryKwh.toFixed(4)),
                stcZone: zone,
                stcRatings: ratings,
                stcDeemingPeriod: deemingPeriod,
                rebateRate: actualRate,
                pvMargin: parseFloat(pvMargin.toFixed(2)),
                batteryMargin: parseFloat(batteryMargin.toFixed(2)),
                productsBreakdown,
                installationsBreakdown,
                rebatesBreakdown,
                marginsBreakdown
            }
        });

    } catch (err) {
        console.error("Calculator logic error:", err);
        res.status(500).json({ error: "Calculations error: " + err.message });
    }
});

module.exports = router;
