const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../helpers');
const nodemailer = require('nodemailer');
const config = require('../config');

// Helper to generate legal text templates
function generateDocumentText(docType, emp) {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedSalary = parseFloat(emp.base_salary).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    
    const corporateHeader = `
========================================================================
                      AVERION GLOBAL LLP
  Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road,
             Ognaj, Ahmedabad, Gujarat - 380060, India
         GST: 24ACMFA7488G1Z0 | PAN: ACMFA7488G | HR Department
========================================================================
    `;

    const signBlocks = `
------------------------------------------------------------------------
For Averion Global LLP                       Accepted by Employee
(Authorized Signatory)                       (${emp.full_name})
------------------------------------------------------------------------
    `;

    switch(docType) {
        case 'Appointment_Letter':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

To,
${emp.full_name}
Ahmedabad, Gujarat

SUBJECT: LETTER OF APPOINTMENT

Dear ${emp.full_name},

We are pleased to appoint you in our organization as "${emp.designation}" in the ${emp.department} Department. Your employment commences on ${emp.onboarding_date || today} subject to the following terms:

1. WORK HOURS & SHIFT METRICS:
Due to our business alignment with Australian Time Zone clients, your operational shift will commence strictly at 03:30 AM IST daily. Shift adherence is mandatory.

2. COMPENSATIVE PACKAGE (CTC):
Your Monthly Base Salary will be ${formattedSalary} (Rupees equivalent). 

3. PROBATION & NOTICE PERIOD:
You will be placed on a probationary period of ${emp.probation_period_months} months. Your services can be terminated during probation by giving 15 days notice. Upon confirmation, the notice period shall strictly be ${emp.notice_period_days} days.

4. LEAVE ENTITLEMENT:
You will be entitled to an annual leave quota of ${emp.annual_leave_quota} days per calendar year.

5. LEGAL JURISDICTION:
This agreement is governed by the laws of India. Any dispute arising out of this appointment shall be subject exclusively to the competent courts of Ahmedabad, Gujarat.

${signBlocks}
            `.trim();

        case 'NDA_IP_Assignment':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

PROPRIETARY INFORMATION AND INTELLECTUAL PROPERTY ASSIGNMENT COVENANT

This Non-Disclosure and IP Assignment Agreement is entered into by ${emp.full_name} ("Employee") in favor of Averion Global LLP ("Company").

1. INTELLECTUAL PROPERTY OWNERSHIP:
All solar layout designs, technical drawings, pricing calculators, CRM software codes, databases, and operational spreadsheets designed, written, or conceptualized by the Employee during their hours of service belong exclusively to Averion Global LLP. The Employee hereby assigns all right, title, and interest in such IP to the Company globally.

2. CONFIDENTIALITY CONSTRAINTS:
The Employee shall not disclose, photocopy, screenshot, or poach any leads, client contact sheets, or pricing matrices stored inside the Solar CRM to any third party.

3. GOVERNING LAW & COURT JURISDICTION:
This Covenant is subject strictly to the jurisdiction of the competent courts of Ahmedabad, Gujarat.

${signBlocks}
            `.trim();

        case 'HR_Policy_Manual':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

HR POLICY & SYSTEM PROCEDURES MANUAL DECLARATION

I, ${emp.full_name}, hereby acknowledge receipt and agree to comply with the Averion Global LLP Employee Guidelines:

1. SHIFT SCHEDULE ADHERENCE:
Standard morning operational shifts run on the Australian Time Zone, starting strictly at 03:30 AM IST. Punctuality is mandatory.

2. SECURITY & CRITICAL ASSETS:
The use of personal recording devices, screenshot tools, or exporting leads from the Solar CRM portal is strictly prohibited. All computer systems, network connections, and cloud portals are monitored.

3. DISCIPLINARY POLICY:
Any breach of operational security or data leakage will result in immediate dismissal, forfeiture of outstanding allowances, and legal action.

${signBlocks}
            `.trim();

        case 'Moonlighting_Covenant':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

EXCLUSIVITY OF SERVICE & ANTI-MOONLIGHTING COVENANT

This Covenant is entered into by ${emp.full_name} ("Employee") in favor of Averion Global LLP ("Company").

1. ABSOLUTE BAN ON DUAL EMPLOYMENT:
The Employee shall devote their entire working time and attention exclusively to the business of the Company. The Employee is strictly prohibited from engaging in any other business, dual employment, freelancing, tutoring, consulting, or providing services to any external firm (directly or indirectly, paid or unpaid) during the tenure of their employment.

2. ZERO CLIENT POACHING:
The Employee shall not solicit, divert, or design solar proposals for any clients of the Company for personal profit or for any competitor.

3. PENAL CONSEQUENCES:
Any violation of this Covenant will result in immediate termination for cause and a liability suit filed in the competent courts of Ahmedabad, Gujarat.

${signBlocks}
            `.trim();

        case 'Gratuity_Reimbursement':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

GRATUITY & STATUTORY DISBURSEMENTS AGREEMENT

1. STATUTORY ELIGIBILITY:
In accordance with the Payment of Gratuity Act 1972, gratuity is payable only upon successful completion of five (5) consecutive years of active service with Averion Global LLP.

2. REIMBURSEMENT PROVISIONS:
Should the Employee leave the Company before completing the statutory timeline, no pro-rated gratuity is payable. Any voluntary gratuity buffers advance-reimbursed by the Company shall be subject to recoupment or deduction from the final settlement.

3. ELIGIBILITY CONFIRMATION:
Employee's Gratuity Eligibility Status: ${emp.gratuity_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE (Pending 5 years service)'}.

${signBlocks}
            `.trim();

        case 'Anti_Poaching_Agreement':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

NON-SOLICITATION & ANTI-POACHING COVENANT

1. RESTRICTION OF POACHING:
The Employee covenants that for a period of twenty-four (24) months post-separation from Averion Global LLP, they will not directly or indirectly recruit, induce, or poach any employee, vendor, or developer away from the Company.

2. CUSTOMER PROTECTION:
The Employee shall not approach or solicit any clients of Averion Global LLP to divert solar design, sales leads, or installation business.

3. GEOGRAPHIC & LEGAL BOUNDARY:
This agreement is governed by the laws of India and subject exclusively to the courts of Ahmedabad, Gujarat.

${signBlocks}
            `.trim();

        case 'IT_Asset_Surveillance':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

IT ASSETS & NETWORK SURVEILLANCE CONSENT

1. MONITORING CONSENT:
The Employee consents to active network surveillance, keystroke logging, screen captures, and remote access tracking on all Company-provided systems (Laptops, Desktops, VOIP communication systems, and Solar CRM logs).

2. BIOMETRIC & HRMS REGISTRATION:
The Employee consents to logging daily punches via Biometric systems, CCTV camera capture on the bay, and processing personal records within the HRMS dashboard.

3. CONFIDENTIAL ASSETS RECOVERY:
Upon separation, the Employee must immediately surrender all assigned assets including Laptop, SIM card, ID card, Access Badge, and software licenses.

${signBlocks}
            `.trim();

        case 'Shift_Safety_Declaration':
            return `
${corporateHeader}
Date: ${today}
Employee ID: ${emp.employee_id}

EARLY MORNING SHIFT WORKPLACE SAFETY DECLARATION

Since my shift commences at 03:30 AM IST (aligned to Australian Client Time Zones), I hereby declare and agree to the following workplace safety protocols:

1. COMMUTE PROTOCOL:
I shall ensure safe travel arrangements during early morning hours and will report any travel deviations or safety incidents directly to the HR Support Bay.

2. WORKPLACE BEHAVIOR:
I shall comply with all office security, emergency fire escape routes, and surveillance standards enforced in the office bays of Averion Global LLP.

3. EMERGENCIES:
I confirm that my emergency contact details are fully updated, and I am aware of the fire safety systems installed at Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad.

${signBlocks}
            `.trim();

        default:
            return "Standard Compliance Agreement";
    }
}

// ── ONBOARD NEW EMPLOYEE (POST) ──────────────────────────────────────
router.post('/onboard-employee', requireAuth, (req, res) => {
    const {
        employee_id, full_name, department, designation, base_salary,
        shift_start_time, probation_period_months, notice_period_days,
        annual_leave_quota, gratuity_eligible, incentive_hold_flag, onboarding_date,
        assets_laptops, assets_desktops, assets_mobiles, assets_sims,
        assets_ids, assets_access_cards, assets_licenses,
        surveillance_consent, biometric_consent, hrms_consent
    } = req.body;

    if (!employee_id || !full_name || !department || !designation || !onboarding_date) {
        return res.status(400).json({ error: 'Employee ID, Full Name, Department, Designation, and Onboarding Date are required.' });
    }

    const salary = parseFloat(base_salary) || 0;

    // Enforce Corporate Internship Rules
    const isIntern = designation.toLowerCase().includes('intern');
    if (isIntern) {
        // Probation strictly capped to 6 months
        if (parseInt(probation_period_months, 10) !== 6) {
            return res.status(400).json({ error: 'Internships must strictly have a 6-month probation period.' });
        }
        // Salary strictly between 15000 and 25000 Rs
        if (salary < 15000 || salary > 25000) {
            return res.status(400).json({ error: 'Intern stipend must be strictly between 15,000 and 25,000 Rs.' });
        }
    } else {
        // Base salary between 15000 and 60000 Rs for regular hires
        if (salary < 15000 || salary > 60000) {
            return res.status(400).json({ error: 'Employee base salary must be strictly between 15,000 and 60,000 Rs.' });
        }
    }

    const gratEligible = gratuity_eligible ? 1 : 0;
    const incHold = incentive_hold_flag ? 1 : 0;
    const survConsent = surveillance_consent ? 1 : 0;
    const bioConsent = biometric_consent ? 1 : 0;
    const hrConsent = hrms_consent ? 1 : 0;

    db.serialize(() => {
        db.run(
            `INSERT INTO employee_compliance_profiles (
                employee_id, full_name, department, designation, base_salary,
                shift_start_time, probation_period_months, notice_period_days,
                annual_leave_quota, gratuity_eligible, incentive_hold_flag, onboarding_date,
                assets_laptops, assets_desktops, assets_mobiles, assets_sims,
                assets_ids, assets_access_cards, assets_licenses,
                surveillance_consent, biometric_consent, hrms_consent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id) DO UPDATE SET
                full_name = excluded.full_name,
                department = excluded.department,
                designation = excluded.designation,
                base_salary = excluded.base_salary,
                shift_start_time = excluded.shift_start_time,
                probation_period_months = excluded.probation_period_months,
                notice_period_days = excluded.notice_period_days,
                annual_leave_quota = excluded.annual_leave_quota,
                gratuity_eligible = excluded.gratuity_eligible,
                incentive_hold_flag = excluded.incentive_hold_flag,
                onboarding_date = excluded.onboarding_date,
                assets_laptops = excluded.assets_laptops,
                assets_desktops = excluded.assets_desktops,
                assets_mobiles = excluded.assets_mobiles,
                assets_sims = excluded.assets_sims,
                assets_ids = excluded.assets_ids,
                assets_access_cards = excluded.assets_access_cards,
                assets_licenses = excluded.assets_licenses,
                surveillance_consent = excluded.surveillance_consent,
                biometric_consent = excluded.biometric_consent,
                hrms_consent = excluded.hrms_consent`,
            [
                employee_id, full_name, department, designation, salary,
                shift_start_time || '03:30 AM', parseInt(probation_period_months, 10) || 3, parseInt(notice_period_days, 10) || 45,
                parseInt(annual_leave_quota, 10) || 24, gratEligible, incHold, onboarding_date,
                assets_laptops || '', assets_desktops || '', assets_mobiles || '', assets_sims || '',
                assets_ids || '', assets_access_cards || '', assets_licenses || '',
                survConsent, bioConsent, hrConsent
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });

                // Generate the 8 compliance documents dynamically
                const docTypes = [
                    'Appointment_Letter', 'NDA_IP_Assignment', 'HR_Policy_Manual', 'Moonlighting_Covenant',
                    'Gratuity_Reimbursement', 'Anti_Poaching_Agreement', 'IT_Asset_Surveillance', 'Shift_Safety_Declaration'
                ];

                const emp = {
                    employee_id, full_name, department, designation, base_salary: salary,
                    probation_period_months: parseInt(probation_period_months, 10) || 3,
                    notice_period_days: parseInt(notice_period_days, 10) || 45,
                    annual_leave_quota: parseInt(annual_leave_quota, 10) || 24,
                    gratuity_eligible: gratEligible, onboarding_date
                };

                docTypes.forEach(docType => {
                    const generatedText = generateDocumentText(docType, emp);
                    
                    // Check if already exists in database
                    db.get(
                        `SELECT id, signed_status FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
                        [employee_id, docType],
                        (docErr, docRow) => {
                            if (docErr) console.error('Error fetching document status:', docErr.message);
                            else if (!docRow) {
                                // Insert fresh document
                                db.run(
                                    `INSERT INTO legal_signed_documents (employee_id, document_type, signed_status, generated_blob_text) VALUES (?, ?, 0, ?)`,
                                    [employee_id, docType, generatedText]
                                );
                            } else if (docRow.signed_status === 0) {
                                // Regenerate if still unsigned to catch any updated variables
                                db.run(
                                    `UPDATE legal_signed_documents SET generated_blob_text = ? WHERE id = ?`,
                                    [generatedText, docRow.id]
                                );
                            }
                        }
                    );
                });

                res.json({ success: true, message: 'Onboarding compliance profile saved and documents generated.' });
            }
        );
    });
});

// ── FETCH COMPLIANCE & LEGAL PROFILE (GET) ───────────────────────────
router.get('/employee/:id', requireAuth, (req, res) => {
    const empId = req.params.id;
    
    db.get('SELECT * FROM employee_compliance_profiles WHERE employee_id = ?', [empId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Always fetch the associated documents checklist
        db.all('SELECT id, document_type, signed_status, generated_blob_text, timestamp FROM legal_signed_documents WHERE employee_id = ?', [empId], (docErr, documents) => {
            if (docErr) return res.status(500).json({ error: docErr.message });
            
            res.json({
                profile: profile || null,
                documents: documents || []
            });
        });
    });
});

// ── SIGN A DOCUMENT (POST) ───────────────────────────────────────────
router.post('/employee/:id/sign', requireAuth, (req, res) => {
    const empId = req.params.id;
    const { document_type } = req.body;
    
    db.run(
        `UPDATE legal_signed_documents SET signed_status = 1, timestamp = CURRENT_TIMESTAMP WHERE employee_id = ? AND document_type = ?`,
        [empId, document_type],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Document signed successfully.' });
        }
    );
});

// ── EMAIL COMPLIANCE TEXT (POST) ─────────────────────────────────────
router.post('/employee/:id/email', requireAuth, (req, res) => {
    const empId = req.params.id;
    const { document_type, email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Worker email address is missing.' });
    }

    db.get(
        `SELECT * FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
        [empId, document_type],
        (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!doc) return res.status(404).json({ error: 'Generated document not found.' });

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

            const docTitle = document_type.replace(/_/g, ' ');

            const mailOptions = {
                from: config.email.from || `"Averion Global LLP" <${config.email.user}>`,
                to: email,
                subject: `${docTitle} - Compliance Request`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; color: #334155; line-height: 1.6; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0f172a; margin-top: 0;">Averion Global LLP</h2>
                        <p>Hello,</p>
                        <p>You have been requested to review and sign the attached compliance agreement: <strong>${docTitle}</strong>.</p>
                        <p>Please open the attached file, read it carefully, and sign it inside the employee dashboard.</p>
                        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;">
                        <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">This is an automated HR notification. Please do not reply directly to this email.</p>
                    </div>
                `,
                attachments: [{
                    filename: `${document_type}_Agreement.txt`,
                    content: doc.generated_blob_text
                }]
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) return res.status(500).json({ error: 'SMTP delivery failed: ' + mailErr.message });
                res.json({ success: true, message: 'Document sent to employee.' });
            });
        }
    );
});

module.exports = router;
