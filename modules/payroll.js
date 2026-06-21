const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, getSydneyISO } = require('../helpers');

// POST /calculate-period
router.post('/calculate-period', requireAuth, (req, res) => {
    const { user_id, pay_period_start, pay_period_end } = req.body;

    if (!user_id || !pay_period_start || !pay_period_end) {
        return res.status(400).json({ error: 'Missing required parameters: user_id, pay_period_start, and pay_period_end are mandatory.' });
    }

    // 1. Fetch the user's compliance profile & worker template settings
    db.get(
        `SELECT p.*, w.weekly_hours_limit, w.per_hour_wages_inc_tax, w.role as worker_role, w.first_name, w.last_name
         FROM employee_compliance_profiles p
         JOIN attendance_workers w ON p.user_id = w.id
         WHERE p.user_id = ?`,
        [user_id],
        (err, profile) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!profile) {
                return res.status(404).json({ error: 'Compliance profile not found for the specified employee.' });
            }

            // 2. Fetch all approved timesheets in the date boundaries
            db.all(
                `SELECT * FROM attendance_timesheets 
                 WHERE user_id = ? 
                   AND manager_approval_status = 'Approved' 
                   AND work_date BETWEEN ? AND ?`,
                [user_id, pay_period_start, pay_period_end],
                (timesheetsErr, timesheets) => {
                    if (timesheetsErr) {
                        return res.status(500).json({ error: timesheetsErr.message });
                    }

                    if (!timesheets || timesheets.length === 0) {
                        return res.status(400).json({ error: 'No approved timesheet entries found for this employee in the specified pay period.' });
                    }

                    // 3. Calculation loop
                    const hasTemplateRate = (profile.per_hour_wages_inc_tax && profile.per_hour_wages_inc_tax > 0);
                    const baseRate = hasTemplateRate ? profile.per_hour_wages_inc_tax : (profile.base_hourly_rate * (profile.employment_type === 'Casual' ? 1.25 : 1));

                    let totalOrdinaryHours = 0;
                    let totalOvertimeHours = 0;
                    let ordinaryEarnings = 0;
                    let overtimeEarnings = 0;

                    // Group timesheets by week relative to pay_period_start
                    const startMs = new Date(pay_period_start + 'T00:00:00').getTime();
                    const weekHours = {}; // week number (1, 2, 3...) -> { ordHours, otHours, ordEarnings, otEarnings }

                    if (hasTemplateRate) {
                        const limit = (profile.weekly_hours_limit && profile.weekly_hours_limit > 0) ? profile.weekly_hours_limit : Infinity;
                        
                        // Group timesheets by week number
                        const weekTimesheets = {};
                        timesheets.forEach(sheet => {
                            const hours = sheet.total_hours_worked || 0;
                            const sheetDateMs = new Date(sheet.work_date + 'T00:00:00').getTime();
                            const diffDays = Math.round((sheetDateMs - startMs) / (24 * 60 * 60 * 1000));
                            const weekNum = Math.floor(diffDays / 7) + 1;
                            
                            if (!weekTimesheets[weekNum]) {
                                weekTimesheets[weekNum] = [];
                            }
                            weekTimesheets[weekNum].push(sheet);
                        });

                        Object.keys(weekTimesheets).forEach(weekNum => {
                            const sheets = weekTimesheets[weekNum];
                            let rawHoursSum = 0;
                            sheets.forEach(s => {
                                rawHoursSum += s.total_hours_worked || 0;
                            });

                            const ord = Math.min(rawHoursSum, limit);
                            const ordEarn = ord * baseRate;

                            weekHours[weekNum] = {
                                ordHours: ord,
                                otHours: 0,
                                ordEarnings: ordEarn,
                                otEarnings: 0,
                                rawHours: rawHoursSum,
                                limitApplied: limit !== Infinity ? limit : null
                            };

                            totalOrdinaryHours += ord;
                            ordinaryEarnings += ordEarn;
                        });
                    } else {
                        timesheets.forEach(sheet => {
                            const hours = sheet.total_hours_worked || 0;
                            const sheetDateMs = new Date(sheet.work_date + 'T00:00:00').getTime();
                            const diffDays = Math.round((sheetDateMs - startMs) / (24 * 60 * 60 * 1000));
                            const weekNum = Math.floor(diffDays / 7) + 1;
                            
                            if (!weekHours[weekNum]) {
                                weekHours[weekNum] = { ordHours: 0, otHours: 0, ordEarnings: 0, otEarnings: 0 };
                            }
                            
                            let ord = 0;
                            let ot = 0;
                            let ordEarn = 0;
                            let otEarn = 0;
                            
                            if (hours <= 8) {
                                ord = hours;
                                ordEarn = hours * baseRate;
                            } else if (hours <= 10) {
                                ord = 8;
                                ordEarn = 8 * baseRate;
                                ot = hours - 8;
                                otEarn = ot * baseRate * 1.5;
                            } else {
                                ord = 8;
                                ordEarn = 8 * baseRate;
                                ot = hours - 8;
                                otEarn = 2 * baseRate * 1.5 + (hours - 10) * baseRate * 2.0;
                            }
                            
                            weekHours[weekNum].ordHours += ord;
                            weekHours[weekNum].otHours += ot;
                            weekHours[weekNum].ordEarnings += ordEarn;
                            weekHours[weekNum].otEarnings += otEarn;
                            
                            totalOrdinaryHours += ord;
                            totalOvertimeHours += ot;
                            ordinaryEarnings += ordEarn;
                            overtimeEarnings += otEarn;
                        });
                    }

                    // Superannuation Guarantee (SG) Rule: 12% on Gross Ordinary Earnings
                    const superContribution = ordinaryEarnings * 0.12;

                    // Gross Pay
                    const grossPay = ordinaryEarnings + overtimeEarnings;

                    // Calculate the pay period duration in days to get the weekly equivalent
                    const startDt = new Date(pay_period_start + 'T00:00:00');
                    const endDt = new Date(pay_period_end + 'T00:00:00');
                    const diffDays = Math.round((endDt - startDt) / (24 * 60 * 60 * 1000)) + 1;

                    let multiplier = 1;
                    if (diffDays >= 10 && diffDays <= 18) {
                        multiplier = 2; // Fortnightly
                    } else if (diffDays >= 25 && diffDays <= 35) {
                        multiplier = 52 / 12; // Monthly
                    } else if (diffDays >= 5 && diffDays <= 9) {
                        multiplier = 1; // Weekly
                    } else {
                        multiplier = diffDays / 7;
                    }

                    const weeklyGross = grossPay / multiplier;

                    // 1. Weekly Tax (Scale 2 - Tax-free threshold claimed, Stage 3 Tax Cuts, 2024-25 and 2025-26 rules incorporating Medicare Levy)
                    let a = 0;
                    let b = 0;
                    if (weeklyGross < 350) {
                        a = 0.0000;
                        b = 0;
                    } else if (weeklyGross < 500) {
                        a = 0.1600;
                        b = 57.8462;
                    } else if (weeklyGross < 625) {
                        a = 0.2600;
                        b = 107.8462; // Medicare shade-in
                    } else if (weeklyGross < 721) {
                        a = 0.1800;
                        b = 57.8462;
                    } else if (weeklyGross < 865) {
                        a = 0.1800;
                        b = 57.1462;
                    } else if (weeklyGross < 1282) {
                        a = 0.3227;
                        b = 180.0385; // LITO phase-out
                    } else if (weeklyGross < 2596) {
                        a = 0.3200;
                        b = 176.5769;
                    } else if (weeklyGross < 3653) {
                        a = 0.3900;
                        b = 358.3077;
                    } else {
                        a = 0.4700;
                        b = 650.6154;
                    }

                    const x = Math.floor(weeklyGross) + 0.99;
                    const weeklyTaxWithheld = Math.max(0, Math.round(a * x - b));

                    // Convert back to period tax
                    const taxWithheld = weeklyTaxWithheld * multiplier;

                    // Net Pay
                    const netPay = grossPay - taxWithheld;

                    // Round financial totals to 2 decimal places for database storage
                    const roundedOrdinaryHours = parseFloat(totalOrdinaryHours.toFixed(3));
                    const roundedOvertimeHours = parseFloat(totalOvertimeHours.toFixed(3));
                    const roundedGrossPay = parseFloat(grossPay.toFixed(2));
                    const roundedTaxWithheld = parseFloat(taxWithheld.toFixed(2));
                    const roundedSuperContribution = parseFloat(superContribution.toFixed(2));
                    const roundedNetPay = parseFloat(netPay.toFixed(2));

                    const sydneyTime = getSydneyISO();

                    const calculationMetadata = {
                        base_rate: baseRate,
                        raw_base_rate: hasTemplateRate ? profile.per_hour_wages_inc_tax : profile.base_hourly_rate,
                        employment_type: profile.employment_type,
                        weeks: weekHours,
                        has_template_rate: hasTemplateRate,
                        weekly_hours_limit: profile.weekly_hours_limit,
                        tax_calculation: {
                            gross: grossPay,
                            tax: taxWithheld,
                            formula: `ATO Stage 3 Tax Cuts Scale 2: Weekly Gross = $${weeklyGross.toFixed(2)}. Weekly Tax Withheld = $${weeklyTaxWithheld} (a=${a}, b=${b}). Period Multiplier = ${multiplier.toFixed(4)}`
                        },
                        super_calculation: {
                            ordinary_earnings: ordinaryEarnings,
                            rate: 0.12,
                            super: superContribution
                        }
                    };

                    const generatedBy = req.session.user.full_name || req.session.user.username || 'System';

                    // 4. Save to payroll_historical_records
                    db.run(
                        `INSERT INTO payroll_historical_records (
                            user_id, pay_period_start, pay_period_end, 
                            ordinary_hours, overtime_hours, gross_pay, 
                            tax_withheld, super_contribution, net_pay, created_at,
                            generated_by, calculation_metadata
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            user_id, pay_period_start, pay_period_end, 
                            roundedOrdinaryHours, roundedOvertimeHours, roundedGrossPay, 
                            roundedTaxWithheld, roundedSuperContribution, roundedNetPay, sydneyTime,
                            generatedBy, JSON.stringify(calculationMetadata)
                        ],
                        function(saveErr) {
                            if (saveErr) {
                                return res.status(500).json({ error: saveErr.message });
                            }

                            // 5. Return JSON metadata response
                            res.status(201).json({
                                success: true,
                                payslip_id: this.lastID,
                                user_id,
                                pay_period_start,
                                pay_period_end,
                                ordinary_hours: roundedOrdinaryHours,
                                overtime_hours: roundedOvertimeHours,
                                base_rate: baseRate,
                                gross_pay: roundedGrossPay,
                                tax_withheld: roundedTaxWithheld,
                                super_contribution: roundedSuperContribution,
                                net_pay: roundedNetPay,
                                created_at: sydneyTime,
                                generated_by: generatedBy,
                                calculation_metadata: calculationMetadata,
                                message: 'Payroll period computed and ledger saved successfully.'
                            });
                        }
                    );
                }
            );
        }
    );
});

// GET /history/:user_id (Retrieve employee payslip history)
router.get('/history/:user_id', requireAuth, (req, res) => {
    const userId = req.params.user_id;
    db.all(
        `SELECT * FROM payroll_historical_records WHERE user_id = ? ORDER BY pay_period_end DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows || []);
        }
    );
});

// PUT /history/:id (Update employee payslip history)
router.put('/history/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { ordinary_hours, overtime_hours, gross_pay, tax_withheld, super_contribution, net_pay } = req.body;
    
    db.run(
        `UPDATE payroll_historical_records SET 
            ordinary_hours = ?, 
            overtime_hours = ?, 
            gross_pay = ?, 
            tax_withheld = ?, 
            super_contribution = ?, 
            net_pay = ?
         WHERE id = ?`,
        [ordinary_hours, overtime_hours, gross_pay, tax_withheld, super_contribution, net_pay, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Payslip record updated successfully.' });
        }
    );
});

// DELETE /history/:id (Delete employee payslip history)
router.delete('/history/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM payroll_historical_records WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'Payslip record deleted successfully.' });
    });
});

module.exports = router;
