const express = require('express');
const nodemailer = require('nodemailer');
const config = require('../config');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../helpers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCGqZk1aifXriaKoS-pvfJtlUEkC9MfZU4';

const workerUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'workers');
if (!fs.existsSync(workerUploadDir)) {
    fs.mkdirSync(workerUploadDir, { recursive: true });
}

const workerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, workerUploadDir);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});

const uploadWorkerDoc = multer({
    storage: workerStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: Only images (jpeg/jpg/png), PDFs, and documents (doc/docx) are allowed!'));
    }
});

// Geocoding helper using Google Maps API
async function getFullAddress(gpsString) {
    if (!gpsString || gpsString === 'GPS Unavailable' || !gpsString.includes(',')) {
        return 'GPS Address Sync';
    }
    
    try {
        const [lat, lng] = gpsString.split(',');
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat.trim()},${lng.trim()}&key=${GOOGLE_API_KEY}`;
        const response = await axios.get(url, { timeout: 4000 });
        
        if (response.data && response.data.results && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        }
        return 'GPS Address Sync';
    } catch (error) {
        console.error('Google Geocoding error:', error.message);
        return 'GPS Address Sync'; // Fallback so clock-in/out operations never fail
    }
}

// Parse H:MM, HH:MM, or raw hour value to decimal hour representation
function parseTimeToHours(s) {
    if (!s || !s.trim()) return 0;
    const str = s.trim();
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }
    if (/^\d+:\d+$/.test(str)) {
        const parts = str.split(':');
        return (parseInt(parts[0], 10) || 0) + (parseInt(parts[1], 10) || 0) / 60;
    }
    const f = parseFloat(str);
    return isNaN(f) ? 0 : f;
}

// Resolve coordinates to human-readable address on the fly
router.get('/geocode', requireAuth, async (req, res) => {
    const { gps } = req.query;
    if (!gps) {
        return res.status(400).json({ error: 'Missing gps query parameter.' });
    }
    const address = await getFullAddress(gps);
    res.json({ address });
});

// 1. POST /clock-in (Start Shift)
router.post('/clock-in', requireAuth, async (req, res) => {
    const { user_id, work_date, clock_in_time, clock_in_gps, clock_in_address } = req.body;

    if (!user_id || !work_date || !clock_in_time || !clock_in_gps) {
        return res.status(400).json({ error: 'Missing required parameters: user_id, work_date, clock_in_time, and clock_in_gps are mandatory.' });
    }

    // Check if employee already has an active clock-in log where clock_out_time IS NULL
    db.get(
        `SELECT * FROM attendance_timesheets WHERE user_id = ? AND clock_out_time IS NULL`,
        [user_id],
        async (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (row) {
                return res.status(400).json({ error: 'Duplicate clock-in: An active shift is already open.' });
            }

            // Resolve location address via Google Geocoding API if not provided
            const address = clock_in_address || await getFullAddress(clock_in_gps);

            // Insert new record into attendance_timesheets
            db.run(
                `INSERT INTO attendance_timesheets (
                    user_id, work_date, clock_in_time, clock_in_gps, clock_in_address, manager_approval_status, last_edited_by
                ) VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
                [user_id, work_date, clock_in_time, clock_in_gps, address, req.session.user.full_name],
                function(insertErr) {
                    if (insertErr) {
                        return res.status(500).json({ error: insertErr.message });
                    }

                    res.status(201).json({
                        success: true,
                        timesheet_id: this.lastID,
                        address: address,
                        message: 'Clock-in recorded successfully.'
                    });
                }
            );
        }
    );
});

// 2. POST /clock-out (End Shift with Australian Hours Math & Geocoding)
router.post('/clock-out', requireAuth, async (req, res) => {
    const { user_id, clock_out_time, clock_out_gps, unpaid_break_minutes, clock_out_address } = req.body;

    if (!user_id || !clock_out_time || !clock_out_gps) {
        return res.status(400).json({ error: 'Missing required parameters: user_id, clock_out_time, and clock_out_gps are mandatory.' });
    }

    // Find the active open shift record for the user
    db.get(
        `SELECT * FROM attendance_timesheets WHERE user_id = ? AND clock_out_time IS NULL`,
        [user_id],
        async (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.status(404).json({ error: 'No active clock-in session found.' });
            }

            // Raw duration in milliseconds
            const clockInMs = new Date(row.clock_in_time).getTime();
            const clockOutMs = new Date(clock_out_time).getTime();
            
            if (isNaN(clockInMs) || isNaN(clockOutMs)) {
                return res.status(400).json({ error: 'Invalid timestamp formats provided.' });
            }

            const rawDurationMs = clockOutMs - clockInMs;
            if (rawDurationMs < 0) {
                return res.status(400).json({ error: 'Clock-out time cannot be earlier than clock-in time.' });
            }

            let finalizedBreakMinutes = parseInt(unpaid_break_minutes, 10);
            if (isNaN(finalizedBreakMinutes)) {
                finalizedBreakMinutes = 0;
            }

            // Australian Break Audit: 30-minute unpaid break after 5 hours
            const fiveHoursInMs = 5 * 60 * 60 * 1000;
            if (rawDurationMs > fiveHoursInMs && finalizedBreakMinutes === 0) {
                finalizedBreakMinutes = 30;
            }

            // Hours Calculation: (Raw Duration - Break) / 3600000
            const breakMs = finalizedBreakMinutes * 60 * 1000;
            const totalHoursWorked = Math.max(0, (rawDurationMs - breakMs) / 3600000);
            const roundedHours = parseFloat(totalHoursWorked.toFixed(3));

            // Resolve clock-out location address via Google Geocoding API if not provided
            const address = clock_out_address || await getFullAddress(clock_out_gps);

            db.run(
                `UPDATE attendance_timesheets SET 
                    clock_out_time = ?, 
                    clock_out_gps = ?, 
                    clock_out_address = ?,
                    unpaid_break_minutes = ?, 
                    total_hours_worked = ?,
                    last_edited_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [clock_out_time, clock_out_gps, address, finalizedBreakMinutes, roundedHours, req.session.user.full_name, row.id],
                function(updateErr) {
                    if (updateErr) {
                        return res.status(500).json({ error: updateErr.message });
                    }

                    res.json({
                        success: true,
                        timesheet_id: row.id,
                        total_hours_worked: roundedHours,
                        unpaid_break_minutes: finalizedBreakMinutes,
                        address: address,
                        message: 'Clock-out recorded and hours calculated successfully.'
                    });
                }
            );
        }
    );
});

// 3. GET /timesheet/:user_id (Retrieve logs sorted by work_date DESC)
router.get('/timesheet/:user_id', requireAuth, (req, res) => {
    const userId = req.params.user_id;

    db.all(
        `SELECT * FROM attendance_timesheets WHERE user_id = ? ORDER BY work_date DESC`,
        [userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(rows || []);
        }
    );
});

// 4. PATCH /approve/:id (Approve Timesheet Entry)
router.patch('/approve/:id', requireAuth, (req, res) => {
    const timesheetId = req.params.id;

    db.run(
        `UPDATE attendance_timesheets SET manager_approval_status = 'Approved', last_edited_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [req.session.user.full_name, timesheetId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Timesheet entry not found.' });
            }

            res.json({
                success: true,
                message: 'Timesheet entry approved successfully.'
            });
        }
    );
});

// 4a. GET /timesheets (Retrieve all timesheet logs, joined with user info)
router.get('/timesheets', requireAuth, (req, res) => {
    const role = req.session.user.role || '';
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        db.all(
            `SELECT t.*, (u.first_name || ' ' || COALESCE(u.last_name, '')) as full_name, u.role as user_role, u.company_name 
             FROM attendance_timesheets t
             JOIN attendance_workers u ON t.user_id = u.id
             ORDER BY t.work_date DESC`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            }
        );
    } else {
        return res.status(403).json({ error: 'Access denied.' });
    }
});

// 4b. POST /approve-bulk (Bulk approve timesheets)
router.post('/approve-bulk', requireAuth, (req, res) => {
    const role = req.session.user.role || '';
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No IDs provided.' });
        }
        const placeholders = ids.map(() => '?').join(',');
        db.run(
            `UPDATE attendance_timesheets SET manager_approval_status = 'Approved', last_edited_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
            [req.session.user.full_name, ...ids],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: `Approved ${this.changes} timesheet entries.` });
            }
        );
    } else {
        return res.status(403).json({ error: 'Access denied.' });
    }
});

// 4c. POST /manual-entry (Insert manual completed timesheet record, for managers)
router.post('/manual-entry', requireAuth, (req, res) => {
    const role = req.session.user.role || '';
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        const { 
            user_id, 
            work_date, 
            clock_in_time, 
            clock_out_time, 
            unpaid_break_minutes,
            extra_hours,
            sick_leave,
            annual_leave,
            comments,
            status
        } = req.body;
        
        if (!user_id || !work_date) {
            return res.status(400).json({ error: 'Missing required timesheet fields.' });
        }

        let totalHours = 0;
        if (clock_in_time && clock_out_time) {
            const start = new Date(clock_in_time);
            const end = new Date(clock_out_time);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                const diffMs = end - start;
                const breakMs = (parseInt(unpaid_break_minutes, 10) || 0) * 60 * 1000;
                totalHours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60));
            }
        }

        // Add extra hours, sick leave, and annual leave to totalHours
        totalHours += parseTimeToHours(extra_hours);
        totalHours += parseTimeToHours(sick_leave);
        totalHours += parseTimeToHours(annual_leave);

        db.run(
            `INSERT INTO attendance_timesheets (
                user_id, work_date, clock_in_time, clock_out_time, unpaid_break_minutes, 
                total_hours_worked, manager_approval_status, clock_in_gps, clock_out_gps,
                clock_in_address, clock_out_address, extra_hours, sick_leave, annual_leave, comments, status,
                last_edited_by
            ) VALUES (?, ?, ?, ?, ?, ?, 'Approved', 'Manual Entry', 'Manual Entry', 'Office (Manual)', 'Office (Manual)', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, work_date) DO UPDATE SET
                clock_in_time = excluded.clock_in_time,
                clock_out_time = excluded.clock_out_time,
                unpaid_break_minutes = excluded.unpaid_break_minutes,
                total_hours_worked = excluded.total_hours_worked,
                extra_hours = excluded.extra_hours,
                sick_leave = excluded.sick_leave,
                annual_leave = excluded.annual_leave,
                comments = excluded.comments,
                status = excluded.status,
                last_edited_by = excluded.last_edited_by,
                updated_at = CURRENT_TIMESTAMP`,
            [
                user_id, work_date, clock_in_time || '', clock_out_time || '', parseInt(unpaid_break_minutes, 10) || 0,
                totalHours, extra_hours || null, sick_leave || null, annual_leave || null, comments || null, status || null,
                req.session.user.full_name
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({
                    success: true,
                    timesheet_id: this.lastID || null,
                    message: 'Timesheet entry saved successfully.'
                });
            }
        );
    } else {
        return res.status(403).json({ error: 'Access denied.' });
    }
});

// 5. GET /leave/pending (Get all pending leave requests for manager)
router.get('/leave/pending', requireAuth, (req, res) => {
    const role = req.session.user.role || '';
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        db.all(
            `SELECT l.*, (u.first_name || ' ' || COALESCE(u.last_name, '')) as full_name, u.role as user_role, u.company_name 
             FROM leave_balances_and_requests l
             JOIN attendance_workers u ON l.user_id = u.id
             ORDER BY l.created_at DESC`,
            [],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            }
        );
    } else {
        return res.status(403).json({ error: 'Only managers can fetch pending leave requests.' });
    }
});

// 6. GET /leave/:user_id (Fetch all leave requests for a user)
router.get('/leave/:user_id', requireAuth, (req, res) => {
    const userId = req.params.user_id;
    db.all(
        `SELECT * FROM leave_balances_and_requests WHERE user_id = ? ORDER BY start_date DESC`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// 7. POST /leave (Submit a new leave request)
router.post('/leave', requireAuth, (req, res) => {
    const { user_id, leave_type, start_date, end_date, total_days } = req.body;

    if (!user_id || !leave_type || !start_date || !end_date || !total_days) {
        return res.status(400).json({ error: 'Missing required leave request parameters.' });
    }

    db.run(
        `INSERT INTO leave_balances_and_requests (
            user_id, leave_type, start_date, end_date, total_days, approval_status
        ) VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [user_id, leave_type, start_date, end_date, total_days],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({
                success: true,
                leave_id: this.lastID,
                message: 'Leave request submitted successfully.'
            });
        }
    );
});

// 8. PATCH /leave/:id (Approve/Reject leave request)
router.patch('/leave/:id', requireAuth, (req, res) => {
    const leaveId = req.params.id;
    const { status } = req.body; // 'Approved' or 'Rejected'

    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status update payload.' });
    }

    db.run(
        `UPDATE leave_balances_and_requests 
         SET approval_status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, leaveId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Leave request not found.' });

            res.json({
                success: true,
                message: `Leave request status updated to ${status}.`
            });
        }
    );
});

// 9. POST /delete-month (Bulk delete timesheet entries for an employee in a given month)
router.post('/delete-month', requireAuth, (req, res) => {
    const role = req.session.user.role || '';
    if (role === 'Manager' || role === 'Admin' || role.includes('Manager')) {
        const { user_id, year_month } = req.body;
        
        if (!user_id || !year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
            return res.status(400).json({ error: 'Missing or invalid parameters: user_id and year_month (YYYY-MM) are required.' });
        }

        db.run(
            `DELETE FROM attendance_timesheets WHERE user_id = ? AND work_date LIKE ?`,
            [user_id, `${year_month}-%`],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    success: true,
                    deleted_count: this.changes,
                    message: `Successfully deleted ${this.changes} timesheet entries for the month.`
                });
            }
        );
    } else {
        return res.status(403).json({ error: 'Access denied.' });
    }
});

// ── WORKER CRUD ENDPOINTS ──────────────────────────────────────

// GET /workers - Fetch all workers with joined compliance profiles
router.get('/workers', requireAuth, (req, res) => {
    db.all(
        `SELECT w.*, (w.first_name || ' ' || COALESCE(w.last_name, '')) AS full_name,
                c.employment_type, c.modern_award_name, c.base_hourly_rate, c.casual_loading_active,
                c.tax_file_number, c.tax_scale_code, c.super_fund_name, c.super_usi, c.super_member_number,
                c.visa_type, c.visa_expiry_date, c.base_salary, c.probation_period_months, c.notice_period_days,
                c.annual_leave_quota, c.onboarding_date
         FROM attendance_workers w
         LEFT JOIN employee_compliance_profiles c ON w.id = c.user_id`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// POST /workers - Add a worker with tab fields and default compliance profile
router.post('/workers', requireAuth, (req, res) => {
    const { 
        first_name, last_name, email, phone, role, pay_frequency,
        title, middle_name, dob, job_title, gender, google_address,
        mobile_number, phone_number, invite_xero, emergency_name,
        emergency_relationship, emergency_phone, emergency_email,
        bank_account_name, bank_bsb, bank_account_number, pay_template_earnings_rate,
        pay_template_hours, employee_notes, annual_leave_balance, personal_leave_balance,
        employment_type, modern_award_name, base_hourly_rate, casual_loading_active,
        tax_file_number, tax_scale_code, super_fund_name, super_usi, super_member_number,
        visa_type, visa_expiry_date,
        is_contractor, income_type, start_date, award_classification,
        employee_group, holiday_group, include_holidays_in_payslips,
        ordinary_earnings_rate, authorised_to_approve_leave, authorised_to_approve_timesheets,
        company_name, tfn_exemption, residency_status, visa_document_path, weekly_hours_limit, per_hour_wages_inc_tax, custom_holidays, break_hours_limit,
        pan_number, aadhaar_number, tax_regime, uan_number, esic_number, pt_state,
        compliance_documents, cl_balance, sl_balance, ml_balance, bank_account_type,
        basic_salary, hra, special_allowance, epf_opt_in, esic_opt_in, pt_opt_in
    } = req.body;
    
    if (!first_name) {
        return res.status(400).json({ error: 'First name is required.' });
    }

    db.run(
        `INSERT INTO attendance_workers (
            first_name, last_name, email, phone, role, pay_frequency, status,
            title, middle_name, dob, job_title, gender, google_address,
            mobile_number, phone_number, invite_xero, emergency_name,
            emergency_relationship, emergency_phone, emergency_email,
            bank_account_name, bank_bsb, bank_account_number, pay_template_earnings_rate,
            pay_template_hours, employee_notes, annual_leave_balance, personal_leave_balance,
            is_contractor, income_type, start_date, award_classification,
            employee_group, holiday_group, include_holidays_in_payslips,
            ordinary_earnings_rate, authorised_to_approve_leave, authorised_to_approve_timesheets,
            company_name, tfn_exemption, residency_status, visa_document_path, weekly_hours_limit, per_hour_wages_inc_tax, custom_holidays, break_hours_limit,
            pan_number, aadhaar_number, tax_regime, uan_number, esic_number, pt_state,
            compliance_documents, cl_balance, sl_balance, ml_balance, bank_account_type,
            basic_salary, hra, special_allowance, epf_opt_in, esic_opt_in, pt_opt_in
         ) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            first_name.trim(), last_name ? last_name.trim() : '', email ? email.trim() : '', phone || '', role || 'Worker', pay_frequency || 'Fortnightly',
            title || '', middle_name || '', dob || '', job_title || '', gender || '', google_address || '',
            mobile_number || '', phone_number || '', invite_xero ? 1 : 0, emergency_name || '',
            emergency_relationship || '', emergency_phone || '', emergency_email || '',
            bank_account_name || '', bank_bsb || '', bank_account_number || '', pay_template_earnings_rate || '',
            parseFloat(pay_template_hours) || 0.0, employee_notes || '', parseFloat(annual_leave_balance) || 0.0, parseFloat(personal_leave_balance) || 0.0,
            parseInt(is_contractor, 10) || 0, income_type || 'Salary and wages', start_date || '', award_classification || '',
            employee_group || '', holiday_group || '', parseInt(include_holidays_in_payslips, 10) || 0,
            ordinary_earnings_rate || 'Ordinary Hours', parseInt(authorised_to_approve_leave, 10) || 0, parseInt(authorised_to_approve_timesheets, 10) || 0,
            company_name || 'Ares Energy', tfn_exemption || '', residency_status || 'Australian resident', visa_document_path || '',
            weekly_hours_limit !== undefined && weekly_hours_limit !== null && weekly_hours_limit !== '' ? parseFloat(weekly_hours_limit) : null,
            per_hour_wages_inc_tax !== undefined && per_hour_wages_inc_tax !== null && per_hour_wages_inc_tax !== '' ? parseFloat(per_hour_wages_inc_tax) : null,
            custom_holidays || '[]',
            break_hours_limit || '',
            pan_number || '',
            aadhaar_number || '',
            tax_regime || 'New',
            uan_number || '',
            esic_number || '',
            pt_state || 'Maharashtra',
            compliance_documents || '[]',
            parseFloat(cl_balance) || 0.0,
            parseFloat(sl_balance) || 0.0,
            parseFloat(ml_balance) || 0.0,
            bank_account_type || 'Savings',
            parseFloat(basic_salary) || 0.0,
            parseFloat(hra) || 0.0,
            parseFloat(special_allowance) || 0.0,
            parseInt(epf_opt_in, 10) === 0 ? 0 : 1,
            parseInt(esic_opt_in, 10) === 0 ? 0 : 1,
            parseInt(pt_opt_in, 10) === 0 ? 0 : 1
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const workerId = this.lastID;

            // Sync all workers' holiday group and custom holidays globally
            db.run(
                `UPDATE attendance_workers SET holiday_group = ?, custom_holidays = ?`,
                [holiday_group || '', custom_holidays || '[]'],
                (syncErr) => {
                    if (syncErr) console.error('Error syncing global holiday group:', syncErr.message);
                }
            );

            // Save employee compliance profile values
            db.run(
                `INSERT INTO employee_compliance_profiles (
                    user_id, employment_type, modern_award_name, base_hourly_rate, casual_loading_active,
                    tax_file_number, tax_scale_code, super_fund_name, super_usi, super_member_number,
                    visa_type, visa_expiry_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    employment_type = excluded.employment_type,
                    modern_award_name = excluded.modern_award_name,
                    base_hourly_rate = excluded.base_hourly_rate,
                    casual_loading_active = excluded.casual_loading_active,
                    tax_file_number = excluded.tax_file_number,
                    tax_scale_code = excluded.tax_scale_code,
                    super_fund_name = excluded.super_fund_name,
                    super_usi = excluded.super_usi,
                    super_member_number = excluded.super_member_number,
                    visa_type = excluded.visa_type,
                    visa_expiry_date = excluded.visa_expiry_date`,
                [
                    workerId, employment_type || 'Casual', modern_award_name || '', parseFloat(base_hourly_rate) || 25.00,
                    (casual_loading_active !== undefined ? (casual_loading_active ? 1 : 0) : 1),
                    tax_file_number || '', tax_scale_code || '', super_fund_name || '', super_usi || '', super_member_number || '',
                    visa_type || '', visa_expiry_date || ''
                ],
                (profileErr) => {
                    if (profileErr) {
                        console.error('Error creating default compliance profile:', profileErr.message);
                    }
                    res.status(201).json({ id: workerId, success: true });
                }
            );
        }
    );
});

// PUT /workers/:id - Update a worker in both tables
router.put('/workers/:id', requireAuth, (req, res) => {
    const { 
        first_name, last_name, email, phone, role, pay_frequency, status,
        title, middle_name, dob, job_title, gender, google_address,
        mobile_number, phone_number, invite_xero, emergency_name,
        emergency_relationship, emergency_phone, emergency_email,
        bank_account_name, bank_bsb, bank_account_number, pay_template_earnings_rate,
        pay_template_hours, employee_notes, annual_leave_balance, personal_leave_balance,
        employment_type, modern_award_name, base_hourly_rate, casual_loading_active,
        tax_file_number, tax_scale_code, super_fund_name, super_usi, super_member_number,
        visa_type, visa_expiry_date,
        is_contractor, income_type, start_date, award_classification,
        employee_group, holiday_group, include_holidays_in_payslips,
        ordinary_earnings_rate, authorised_to_approve_leave, authorised_to_approve_timesheets,
        company_name, tfn_exemption, residency_status, visa_document_path, weekly_hours_limit, per_hour_wages_inc_tax, custom_holidays, break_hours_limit,
        pan_number, aadhaar_number, tax_regime, uan_number, esic_number, pt_state,
        compliance_documents, cl_balance, sl_balance, ml_balance, bank_account_type,
        basic_salary, hra, special_allowance, epf_opt_in, esic_opt_in, pt_opt_in
    } = req.body;
    const workerId = req.params.id;

    if (!first_name) {
        return res.status(400).json({ error: 'First name is required.' });
    }

    db.serialize(() => {
        db.run(
            `UPDATE attendance_workers 
             SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, pay_frequency = ?, status = ?,
                 title = ?, middle_name = ?, dob = ?, job_title = ?, gender = ?, google_address = ?,
                 mobile_number = ?, phone_number = ?, invite_xero = ?, emergency_name = ?,
                 emergency_relationship = ?, emergency_phone = ?, emergency_email = ?,
                 bank_account_name = ?, bank_bsb = ?, bank_account_number = ?, pay_template_earnings_rate = ?,
                 pay_template_hours = ?, employee_notes = ?, annual_leave_balance = ?, personal_leave_balance = ?,
                 is_contractor = ?, income_type = ?, start_date = ?, award_classification = ?,
                 employee_group = ?, holiday_group = ?, include_holidays_in_payslips = ?,
                 ordinary_earnings_rate = ?, authorised_to_approve_leave = ?, authorised_to_approve_timesheets = ?,
                 company_name = ?, tfn_exemption = ?, residency_status = ?, visa_document_path = ?, weekly_hours_limit = ?, per_hour_wages_inc_tax = ?, custom_holidays = ?,
                 break_hours_limit = ?,
                 pan_number = ?, aadhaar_number = ?, tax_regime = ?, uan_number = ?, esic_number = ?, pt_state = ?,
                 compliance_documents = ?, cl_balance = ?, sl_balance = ?, ml_balance = ?, bank_account_type = ?,
                 basic_salary = ?, hra = ?, special_allowance = ?, epf_opt_in = ?, esic_opt_in = ?, pt_opt_in = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                first_name.trim(), last_name ? last_name.trim() : '', email ? email.trim() : '', phone || '', role || 'Worker', pay_frequency || 'Fortnightly', status || 'Active',
                title || '', middle_name || '', dob || '', job_title || '', gender || '', google_address || '',
                mobile_number || '', phone_number || '', invite_xero ? 1 : 0, emergency_name || '',
                emergency_relationship || '', emergency_phone || '', emergency_email || '',
                bank_account_name || '', bank_bsb || '', bank_account_number || '', pay_template_earnings_rate || '',
                parseFloat(pay_template_hours) || 0.0, employee_notes || '', parseFloat(annual_leave_balance) || 0.0, parseFloat(personal_leave_balance) || 0.0,
                parseInt(is_contractor, 10) || 0, income_type || 'Salary and wages', start_date || '', award_classification || '',
                employee_group || '', holiday_group || '', parseInt(include_holidays_in_payslips, 10) || 0,
                ordinary_earnings_rate || 'Ordinary Hours', parseInt(authorised_to_approve_leave, 10) || 0, parseInt(authorised_to_approve_timesheets, 10) || 0,
                company_name || 'Ares Energy', tfn_exemption || '', residency_status || 'Australian resident', visa_document_path || '',
                weekly_hours_limit !== undefined && weekly_hours_limit !== null && weekly_hours_limit !== '' ? parseFloat(weekly_hours_limit) : null,
                per_hour_wages_inc_tax !== undefined && per_hour_wages_inc_tax !== null && per_hour_wages_inc_tax !== '' ? parseFloat(per_hour_wages_inc_tax) : null,
                custom_holidays || '[]',
                break_hours_limit || '',
                pan_number || '',
                aadhaar_number || '',
                tax_regime || 'New',
                uan_number || '',
                esic_number || '',
                pt_state || 'Maharashtra',
                compliance_documents || '[]',
                parseFloat(cl_balance) || 0.0,
                parseFloat(sl_balance) || 0.0,
                parseFloat(ml_balance) || 0.0,
                bank_account_type || 'Savings',
                parseFloat(basic_salary) || 0.0,
                parseFloat(hra) || 0.0,
                parseFloat(special_allowance) || 0.0,
                parseInt(epf_opt_in, 10) === 0 ? 0 : 1,
                parseInt(esic_opt_in, 10) === 0 ? 0 : 1,
                parseInt(pt_opt_in, 10) === 0 ? 0 : 1,
                workerId
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });

                // Sync all workers' holiday group and custom holidays globally
                db.run(
                    `UPDATE attendance_workers SET holiday_group = ?, custom_holidays = ?`,
                    [holiday_group || '', custom_holidays || '[]'],
                    (syncErr) => {
                        if (syncErr) console.error('Error syncing global holiday group:', syncErr.message);
                    }
                );

                // Update employee compliance profile values
                db.run(
                    `INSERT INTO employee_compliance_profiles (
                        user_id, employment_type, modern_award_name, base_hourly_rate, casual_loading_active,
                        tax_file_number, tax_scale_code, super_fund_name, super_usi, super_member_number,
                        visa_type, visa_expiry_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        employment_type = excluded.employment_type,
                        modern_award_name = excluded.modern_award_name,
                        base_hourly_rate = excluded.base_hourly_rate,
                        casual_loading_active = excluded.casual_loading_active,
                        tax_file_number = excluded.tax_file_number,
                        tax_scale_code = excluded.tax_scale_code,
                        super_fund_name = excluded.super_fund_name,
                        super_usi = excluded.super_usi,
                        super_member_number = excluded.super_member_number,
                        visa_type = excluded.visa_type,
                        visa_expiry_date = excluded.visa_expiry_date`,
                    [
                        workerId, employment_type || 'Casual', modern_award_name || '', parseFloat(base_hourly_rate) || 25.00,
                        (casual_loading_active !== undefined ? (casual_loading_active ? 1 : 0) : 1),
                        tax_file_number || '', tax_scale_code || '', super_fund_name || '', super_usi || '', super_member_number || '',
                        visa_type || '', visa_expiry_date || ''
                    ],
                    (profileErr) => {
                        if (profileErr) return res.status(500).json({ error: profileErr.message });
                        res.json({ success: true });
                    }
                );
            }
        );
    });
});

// DELETE /workers/:id - Hard delete worker and cascading records
router.delete('/workers/:id', requireAuth, (req, res) => {
    const workerId = req.params.id;
    console.log(`[DELETE SINGLE] Received request to delete ID: ${workerId}`);
    db.run(
        `DELETE FROM attendance_workers WHERE id = ?`,
        [workerId],
        function(err) {
            if (err) {
                console.error(`[DELETE SINGLE ERROR]:`, err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[DELETE SINGLE] Successfully deleted ID ${workerId}. Changes: ${this.changes}`);
            res.json({ success: true });
        }
    );
});

// POST /workers/delete-bulk - Bulk delete workers
router.post('/workers/delete-bulk', requireAuth, (req, res) => {
    const { ids } = req.body;
    console.log('[DELETE BULK] Received request to delete IDs:', ids);
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No employee IDs provided.' });
    }
    const placeholders = ids.map(() => '?').join(',');
    db.run(
        `DELETE FROM attendance_workers WHERE id IN (${placeholders})`,
        ids,
        function(err) {
            if (err) {
                console.error('[DELETE BULK ERROR]:', err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[DELETE BULK] Successfully deleted ${this.changes} worker(s).`);
            res.json({ success: true, message: `Successfully deleted ${this.changes} worker(s).` });
        }
    );
});

// ── UPLOAD WORKER DOCUMENT (FILE ONLY) ───────────────
router.post('/workers/upload-document', requireAuth, (req, res) => {
    uploadWorkerDoc.single('document')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 5MB limit.' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fileUrl = `/uploads/workers/${req.file.filename}`;
        res.json({ success: true, fileUrl: fileUrl, name: req.file.originalname });
    });
});

router.post('/workers/:id/email-document', requireAuth, async (req, res) => {
    try {
        const workerId = req.params.id;
        const { docType, htmlContent } = req.body;
        
        db.get('SELECT * FROM attendance_workers WHERE id = ?', [workerId], async (err, worker) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!worker) return res.status(404).json({ error: 'Worker not found.' });
            
            const email = worker.email;
            if (!email) {
                return res.status(400).json({ error: 'Worker does not have an email address.' });
            }
            
            const isEmailConfigured = config.email && config.email.host && config.email.port && config.email.user && config.email.pass;
            if (!isEmailConfigured) {
                return res.status(400).json({ error: 'SMTP email credentials are not configured in your .env file.' });
            }
            
            const transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.secure,
                auth: {
                    user: config.email.user,
                    pass: config.email.pass
                }
            });
            
            let docTitle = 'Compliance Document';
            if (docType === 'offer_letter') docTitle = 'Employment Agreement & Offer Letter';
            else if (docType === 'phone_policy') docTitle = 'Mobile Device Use Policy';
            else if (docType === 'break_policy') docTitle = 'Rest Breaks & Scheduling Policy';
            else if (docType === 'data_theft') docTitle = 'Data Protection & Confidentiality Policy';
            else if (docType === 'leave_policy') docTitle = 'Leave Entitlements & Rules Guide';
            else if (docType === 'package') docTitle = 'HR Onboarding Compliance Package';
            
            const mailOptions = {
                from: config.email.from || `"Averion Global LLP" <${config.email.user}>`,
                to: email,
                subject: `${docTitle} - Averion Global LLP`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; color: #334155; line-height: 1.6; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0f172a; margin-top: 0;">Averion Global LLP</h2>
                        <p>Dear <strong>${worker.first_name} ${worker.last_name}</strong>,</p>
                        <p>Please find attached your official copy of the <strong>${docTitle}</strong>.</p>
                        <p>Please review and retain this document for your records.</p>
                        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;">
                        <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">This is an automated HR notification. Please do not reply directly to this email.</p>
                    </div>
                `,
                attachments: [{
                    filename: `${docType}_${worker.first_name}_${worker.last_name}.html`,
                    content: htmlContent
                }]
            };
            
            await transporter.sendMail(mailOptions);
            res.json({ success: true });
        });
    } catch(err) {
        console.error('Email error:', err);
        res.status(500).json({ error: 'Failed to send email: ' + err.message });
    }
});

module.exports = router;
