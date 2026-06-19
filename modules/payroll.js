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

    // 1. Fetch the user's compliance profile
    db.get(
        `SELECT * FROM employee_compliance_profiles WHERE user_id = ?`,
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
                    // Casual Loading Rule
                    const baseRate = profile.base_hourly_rate * (profile.employment_type === 'Casual' ? 1.25 : 1);

                    let totalOrdinaryHours = 0;
                    let totalOvertimeHours = 0;
                    let ordinaryEarnings = 0;
                    let overtimeEarnings = 0;

                    timesheets.forEach(sheet => {
                        const hours = sheet.total_hours_worked || 0;
                        
                        if (hours <= 8) {
                            totalOrdinaryHours += hours;
                            ordinaryEarnings += hours * baseRate;
                        } else if (hours <= 10) {
                            // First 8 hours ordinary, next 2 hours at 1.5x
                            totalOrdinaryHours += 8;
                            ordinaryEarnings += 8 * baseRate;

                            const ot1 = hours - 8;
                            totalOvertimeHours += ot1;
                            overtimeEarnings += ot1 * baseRate * 1.5;
                        } else {
                            // First 8 hours ordinary, next 2 hours at 1.5x, remainder at 2x
                            totalOrdinaryHours += 8;
                            ordinaryEarnings += 8 * baseRate;

                            totalOvertimeHours += (hours - 8);
                            // 2 hours at 1.5x
                            overtimeEarnings += 2 * baseRate * 1.5;
                            // remainder at 2.0x
                            const ot2 = hours - 10;
                            overtimeEarnings += ot2 * baseRate * 2.0;
                        }
                    });

                    // Superannuation Guarantee (SG) Rule: 12% on Gross Ordinary Earnings
                    const superContribution = ordinaryEarnings * 0.12;

                    // Gross Pay
                    const grossPay = ordinaryEarnings + overtimeEarnings;

                    // ATO Tax Floor Emulation (PAYG Withholding) sliding scale
                    let taxWithheld = 0;
                    if (grossPay > 1000) {
                        taxWithheld = 97.5 + (grossPay - 1000) * 0.25;
                    } else if (grossPay > 350) {
                        taxWithheld = (grossPay - 350) * 0.15;
                    }

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

                    // 4. Save to payroll_historical_records
                    db.run(
                        `INSERT INTO payroll_historical_records (
                            user_id, pay_period_start, pay_period_end, 
                            ordinary_hours, overtime_hours, gross_pay, 
                            tax_withheld, super_contribution, net_pay, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            user_id, pay_period_start, pay_period_end, 
                            roundedOrdinaryHours, roundedOvertimeHours, roundedGrossPay, 
                            roundedTaxWithheld, roundedSuperContribution, roundedNetPay, sydneyTime
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

module.exports = router;
