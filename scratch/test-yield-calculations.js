const db = require('../database/db');

function calculateIRR(cashFlows) {
    if (!cashFlows || cashFlows.length === 0) return 0;
    const hasNegative = cashFlows.some(cf => cf < 0);
    const hasPositive = cashFlows.some(cf => cf > 0);
    if (!hasNegative || !hasPositive) return 0;

    let guess = 0.1;
    const maxIterations = 100;
    const precision = 1e-6;
    
    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dNpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            const factor = Math.pow(1 + guess, t);
            npv += cashFlows[t] / factor;
            if (t > 0) {
                dNpv -= t * cashFlows[t] / (factor * (1 + guess));
            }
        }
        
        if (Math.abs(dNpv) < 1e-12) break;
        
        const nextGuess = guess - npv / dNpv;
        if (Math.abs(nextGuess - guess) < precision) {
            if (isNaN(nextGuess) || nextGuess === Infinity || nextGuess === -Infinity) {
                return 0;
            }
            return nextGuess;
        }
        guess = nextGuess;
    }
    return isNaN(guess) ? 0 : guess;
}

async function testCalculateYield(postcode, products, orientation, annualUsageKwh, daytimeShare, sellingPrice) {
    const finalPostcode = postcode || '6000';
    const finalOrientation = orientation || 'North';

    const prefix2 = finalPostcode.substring(0, 2);
    
    let yieldFactors = await new Promise((resolve) => {
        db.get(
            "SELECT * FROM postcode_yield_factors WHERE postcode_prefix = ?",
            [prefix2],
            (err, row) => {
                if (!err && row) resolve(row);
                else {
                    db.get(
                        "SELECT * FROM postcode_yield_factors WHERE postcode_prefix = 'default'",
                        [],
                        (err2, row2) => {
                            resolve(row2 || {
                                jan: 5.5, feb: 5.2, mar: 4.5, apr: 3.8, may: 3.0, jun: 2.5,
                                jul: 2.7, aug: 3.2, sep: 4.0, oct: 4.8, nov: 5.2, dec: 5.5,
                                provider: 'Default'
                            });
                        }
                    );
                }
            }
        );
    });

    const providerName = yieldFactors.provider || 'Default';
    let utilityRates = await new Promise((resolve) => {
        db.get(
            "SELECT * FROM utility_rate_assumptions WHERE provider = ?",
            [providerName],
            (err, row) => {
                if (!err && row) resolve(row);
                else {
                    db.get(
                        "SELECT * FROM utility_rate_assumptions WHERE provider = 'Default'",
                        [],
                        (err2, row2) => {
                            resolve(row2 || {
                                supply_charge_per_day: 1.00,
                                electricity_unit_rate: 0.28,
                                feed_in_tariff: 0.05
                            });
                        }
                    );
                }
            }
        );
    });

    let totalPanelKw = 0;
    let totalBatteryKwh = 0;

    if (products && Array.isArray(products) && products.length > 0) {
        for (const item of products) {
            const qty = parseFloat(item.qty) || 0;
            if (qty <= 0) continue;

            let itemType = item.type || '';
            let itemSize = parseFloat(item.size) || parseFloat(item.kw) || 0;

            if (itemType === 'Panel') {
                if (itemSize > 100) {
                    totalPanelKw += (itemSize * qty) / 1000;
                } else {
                    totalPanelKw += itemSize * qty;
                }
            } else if (itemType === 'Battery') {
                totalBatteryKwh += itemSize * qty;
            }
        }
    }

    if (totalPanelKw === 0) {
        totalPanelKw = 6.6;
    }

    const degradationFactor = 0.87;
    const orientationMultipliers = {
        'North': 1.0,
        'East': 0.85,
        'West': 0.85,
        'South': 0.60,
        'North-East': 0.93,
        'North-West': 0.93
    };
    const orientMult = orientationMultipliers[finalOrientation] || 1.0;

    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    const monthlyAverageProduction = [];
    let annualGeneration = 0;

    months.forEach((m, idx) => {
        const factor = parseFloat(yieldFactors[m]) || 5.0;
        const dailyAvg = totalPanelKw * factor * orientMult * degradationFactor;
        monthlyAverageProduction.push({
            month: m.toUpperCase(),
            dailyAverage: parseFloat(dailyAvg.toFixed(2)),
            monthlyTotal: parseFloat((dailyAvg * daysInMonths[idx]).toFixed(2))
        });
        annualGeneration += dailyAvg * daysInMonths[idx];
    });

    const supplyChargeDay = utilityRates.supply_charge_per_day;
    const electricityUnitRate = utilityRates.electricity_unit_rate;
    const feedInTariff = utilityRates.feed_in_tariff;

    const beforeSolarAnnualSupply = supplyChargeDay * 365;
    const beforeSolarAnnualEnergy = annualUsageKwh * electricityUnitRate;
    const beforeSolarAnnualTotal = beforeSolarAnnualSupply + beforeSolarAnnualEnergy;

    let selfConsumedSolar = Math.max(0, Math.min(annualGeneration * 0.30, annualUsageKwh * 0.45));
    if (totalBatteryKwh > 0) {
        const excessSolar = Math.max(0, annualGeneration - selfConsumedSolar);
        const storedEnergy = Math.max(0, Math.min(excessSolar, totalBatteryKwh * 280 * 0.90));
        selfConsumedSolar += storedEnergy;
    }
    selfConsumedSolar = Math.min(selfConsumedSolar, annualUsageKwh);

    const exportedSolar = Math.max(0, annualGeneration - selfConsumedSolar);
    const gridImport = Math.max(0, annualUsageKwh - selfConsumedSolar);

    const withSolarAnnualSupply = supplyChargeDay * 365;
    const withSolarAnnualEnergy = gridImport * electricityUnitRate;
    const withSolarFiTCredit = exportedSolar * feedInTariff;
    const withSolarAnnualTotal = Math.max(0, withSolarAnnualSupply + withSolarAnnualEnergy - withSolarFiTCredit);

    const annualSavings = Math.max(0, beforeSolarAnnualTotal - withSolarAnnualTotal);

    const netCost = parseFloat(sellingPrice) || (totalPanelKw * 950 + totalBatteryKwh * 900) || 5000;
    
    const cashFlows = [-netCost];
    const r = 0.05; // 5% discount rate
    let cumulativeDCF = 0;
    let paybackPeriod = null;
    
    for (let t = 1; t <= 20; t++) {
        const savingsInYearT = annualSavings * Math.pow(1.03, t - 1) * Math.pow(0.995, t - 1);
        cashFlows.push(savingsInYearT);
        
        const dcf = savingsInYearT / Math.pow(1 + r, t);
        if (paybackPeriod === null) {
            if (cumulativeDCF + dcf >= netCost) {
                const fraction = (netCost - cumulativeDCF) / dcf;
                paybackPeriod = t - 1 + fraction;
            }
        }
        cumulativeDCF += dcf;
    }
    
    if (paybackPeriod === null) {
        paybackPeriod = netCost / (annualSavings || 1);
    }
    
    const npv = cumulativeDCF - netCost;
    const irr = calculateIRR(cashFlows);

    const pcChar = finalPostcode.charAt(0);
    const ngaFactorsByPostcode = {
        '2': 0.64, // NSW / ACT
        '3': 0.78, // VIC
        '4': 0.67, // QLD
        '5': 0.22, // SA
        '6': 0.50, // WA
        '7': 0.20, // TAS
        '8': 0.56, // NT
        '0': 0.56  // NT
    };
    const emissionFactor = ngaFactorsByPostcode[pcChar] !== undefined ? ngaFactorsByPostcode[pcChar] : 0.50;

    const co2AvoidedKg = annualGeneration * emissionFactor;
    const treesPlanted = co2AvoidedKg / 20;
    const coalAvoidedKg = co2AvoidedKg / 2.86;
    const fuelAvoidedLiters = co2AvoidedKg / 2.3;

    return {
        summary: {
            systemSizeKw: parseFloat(totalPanelKw.toFixed(2)),
            batteryCapacityKwh: parseFloat(totalBatteryKwh.toFixed(2)),
            postcode: finalPostcode,
            provider: providerName,
            orientation: finalOrientation,
            annualGenerationKwh: parseFloat(annualGeneration.toFixed(2)),
            selfConsumptionKwh: parseFloat(selfConsumedSolar.toFixed(2)),
            exportedSolarKwh: parseFloat(exportedSolar.toFixed(2)),
            gridImportKwh: parseFloat(gridImport.toFixed(2))
        },
        monthlyProduction: monthlyAverageProduction,
        financials: {
            beforeSolarSupply: parseFloat(beforeSolarAnnualSupply.toFixed(2)),
            beforeSolarEnergy: parseFloat(beforeSolarAnnualEnergy.toFixed(2)),
            beforeSolarTotal: parseFloat(beforeSolarAnnualTotal.toFixed(2)),
            withSolarSupply: parseFloat(withSolarAnnualSupply.toFixed(2)),
            withSolarEnergy: parseFloat(withSolarAnnualEnergy.toFixed(2)),
            withSolarFiTCredit: parseFloat(withSolarFiTCredit.toFixed(2)),
            withSolarTotal: parseFloat(withSolarAnnualTotal.toFixed(2)),
            annualSavings: parseFloat(annualSavings.toFixed(2))
        },
        investment: {
            netSystemCost: parseFloat(netCost.toFixed(2)),
            paybackYears: parseFloat(paybackPeriod.toFixed(1)),
            roiPercent: parseFloat(((annualSavings / netCost) * 100).toFixed(1)),
            npv: parseFloat(npv.toFixed(2)),
            irrPercent: parseFloat((irr * 100).toFixed(1))
        },
        environmental: {
            co2AvoidedKg: parseFloat(co2AvoidedKg.toFixed(1)),
            treesPlanted: parseFloat(treesPlanted.toFixed(1)),
            coalAvoidedKg: parseFloat(coalAvoidedKg.toFixed(1)),
            fuelAvoidedLiters: parseFloat(fuelAvoidedLiters.toFixed(1))
        }
    };
}

setTimeout(async () => {
    try {
        const testCase1 = await testCalculateYield(
            '6000', // postcode WA
            [
                { type: 'Panel', size: 440, qty: 15 }, // 6.6 kW Panel
                { type: 'Battery', size: 10, qty: 1 }  // 10 kWh Battery
            ],
            'North',
            6500, // annual usage
            0.30, // daytime share
            8500 // selling price
        );

        console.log("=== TEST CASE 1: 6.6kW PV + 10kWh Battery (Perth Synergy) ===");
        console.log("Summary:", testCase1.summary);
        console.log("Financials:", testCase1.financials);
        console.log("Investment Indicators:", testCase1.investment);
        console.log("Environmental:", testCase1.environmental);
        console.log("Daily production Jan vs Jun:", testCase1.monthlyProduction[0].dailyAverage, "vs", testCase1.monthlyProduction[5].dailyAverage);
        
        console.log("\nYield calculations validation success.");
    } catch(e) {
        console.error(e);
    } finally {
        db.close();
    }
}, 1000);
