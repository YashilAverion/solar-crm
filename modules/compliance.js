const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../helpers');
const nodemailer = require('nodemailer');
const config = require('../config');

// Helper to generate legal text templates (Original)
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

4. SHIFT SECURITY OVERVIEW:
Since operations run early morning shifts starting strictly at 03:30 AM IST (aligned to Australian Client Time Zones), biometric and CRM activity checks are monitored continuously.

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

// Helper to generate the 5 compliance policy cards (New Template System)
function compileHRComplianceDoc(docType, emp, policyMeta) {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // Parse salary values
    const gross = parseFloat(emp.base_salary || 0);
    const basic = gross * 0.50;
    const hra = gross * 0.20;
    const specialAllowance = gross * 0.30;

    const formattedGross = gross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedBasic = basic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedHRA = hra.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedSpecial = specialAllowance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    
    const companyName = policyMeta ? policyMeta.company_name : 'Averion Global LLP';
    const address = policyMeta ? policyMeta.registered_address : 'Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060';
    const gst = policyMeta ? policyMeta.gst_number : '24ACMFA7488G1Z0';
    const pan = policyMeta ? policyMeta.pan_number : 'ACMFA7488G';
    
    const border = "=================================================================================";
    const header = `
${border}
                             AVERION GLOBAL LLP
             Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, 
             SP Ring Road, Ognaj, Ahmedabad, Gujarat - 380060
                  GST: ${gst} | PAN: ${pan} | LLP
${border}
    `;

    const signBlock = `
---------------------------------------------------------------------------------
For ${companyName}                            Accepted by Employee/Intern
(Authorized Signatory)                            (${emp.full_name})
---------------------------------------------------------------------------------
    `;

    const footer = `
---------------------------------------------------------------------------------
Document ID: AVG-${docType}-2026-${emp.employee_id || '999'} | Confidentiality: Strict Confidential | Owner: HR Compliance
Version Number: VER-2026-V1.0 | Page 1 of 1
---------------------------------------------------------------------------------
    `;

    switch(docType) {
        case 'Employment_Agreement':
            const isIntern = (emp.designation || '').toLowerCase().includes('intern');
            const probationMonths = isIntern ? 6 : (emp.probation_period_months || 3);
            const noticeDays = emp.notice_period_days || 45;
            
            return `
${header}
                              EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is executed on this ${today} at Ahmedabad, Gujarat, India.

BY AND BETWEEN:

AVERION GLOBAL LLP, a Limited Liability Partnership incorporated under the laws of India, having its registered office at ${address} (hereinafter referred to as the "Employer" or the "Company", which expression shall unless repugnant to the context include its successors and permitted assigns);

AND:

Mr./Ms. ${emp.full_name}, residing at ${emp.google_address || 'As per Company Records'} (hereinafter referred to as the "Employee", which expression shall unless repugnant to the context include their legal heirs and administrators).

1. DEFINITIONS AND INTERPRETATION
- "Effective Date" shall mean the onboarding date of ${emp.onboarding_date || today}.
- "Employment Type" shall mean ${isIntern ? 'Internship' : 'Permanent Employment'}.
- "Designation" shall mean "${emp.designation || 'Associate'}" under the ${emp.department || 'Sales'} Department.

2. APPOINTMENT AND PROBATION
- The Company hereby appoints the Employee to perform services aligned with the designated role starting from the Effective Date.
- The Employee shall undergo a probation period of ${probationMonths} months. Either party may terminate employment during probation with fifteen (15) days written notice. Upon confirmation, notice period is strictly set to ${noticeDays} days.

3. COMPENSATION AND PAY STRUCTURE
- The Monthly Gross Compensation is set to ${formattedGross}. The pay structure is bifurcated under Annexure A.
- Target-Based Incentive Hold Policy: A Target-Based Incentive Hold is applicable in accordance with sales quotas. Failure to meet performance targets leads strictly to an incentive hold, with absolutely zero base salary deduction.
- Gratuity eligibility: ${emp.gratuity_eligible === 1 ? 'Eligible under the Payment of Gratuity Act 1972' : 'Not Eligible (Pending 5 years continuous service)'}.

4. WORKING HOURS AND SHIFT TIMINGS
- The Employee shall work a daily shift of 9 hours.
- Early Morning Shift: Operations start strictly at 03:30 AM IST daily to align with Australian Client Time Zones.
- Weekly Off: Sunday.

5. EXCLUSIVITY & ANTI-MOONLIGHTING
- The Employee shall devote their entire working time and attention exclusively to the business of the Company. 
- Dual Employment: The Employee is strictly prohibited from engaging in any other business, dual employment, freelancing, tutoring, consulting, or providing services to any external firm (directly or indirectly, paid or unpaid) during the tenure of their employment.
- Customer Protection: The Employee shall not solicit, divert, or design solar proposals for any clients of the Company for personal profit or for any competitor.

6. DATA PROTECTION & DIGITAL SECURITY
- The Employee agrees to comply with the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology (IT) Act 2000.
- All CRM databases, customer leads, pricing matrices, and layout algorithms are proprietary assets of the Company. The Employee is strictly prohibited from exporting, screenshotting, or communicating client lists.

7. INTELLECTUAL PROPERTY RIGHTS
- All solar layouts, outreach calculators, and CRM software designs generated by the Employee during service belong exclusively to the Employer. The Employee hereby assigns all global rights, titles, and interests in such IP to the Company.

8. POSH & WHISTLEBLOWER STANDARDS
- The Company strictly enforces a zero-tolerance policy towards sexual harassment in accordance with the POSH Act 2013.
- Whistleblower Policy: Complaints regarding compliance breaches, data theft, or ethical violations can be submitted anonymously to compliance@averionglobal.com.

9. JURISDICTION & ARBITRATION
- This Agreement is governed by the laws of India.
- Dispute Resolution: Any dispute arising out of this contract shall be settled via binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996.
- Jurisdiction: The competent courts of Ahmedabad, Gujarat shall have exclusive jurisdiction.

${signBlock}

ANNEXURE A: PAY STRUCTURE BREAKDOWN
- Monthly Gross CTC: ${formattedGross}
- Basic Salary (50%): ${formattedBasic}
- House Rent Allowance (HRA) (20%): ${formattedHRA}
- Special Allowance (30%): ${formattedSpecial}
- Bank Name: As per Company Records | Account Type: ${emp.bank_account_type}
- IFSC Code / BSB: ${emp.bank_bsb} | Account Number: ${emp.bank_account_number}
- Permanent Account Number (PAN): ${emp.pan_number} | Aadhaar: ${emp.aadhaar_number}

ANNEXURE B: ASSIGNED CORPORATE ASSET TRACKERS
- Laptop Tag: ${emp.assets_laptops || 'Not Assigned'}
- Desktop Tag: ${emp.assets_desktops || 'Not Assigned'}
- Mobile Tag: ${emp.assets_mobiles || 'Not Assigned'}
- SIM Card Tag: ${emp.assets_sims || 'Not Assigned'}
- ID Card Badge: ${emp.assets_ids || 'Not Assigned'}
- Access Card: ${emp.assets_access_cards || 'Not Assigned'}
- Software Licenses: ${emp.assets_licenses || 'Not Assigned'}

${footer}
            `.trim();

        case 'Mobile_Phone_Policy':
            return `
${header}
                        MOBILE DEVICE & WORKSTATION SURVEILLANCE POLICY

1. PURPOSE & SCOPE
This policy regulates workstation monitoring, communication rules, and the use of personal mobile devices during early morning operations at ${companyName}.

2. SHIFT TIMING & ADHERENCE
Due to active operations running on the Australian Time Zone, shifts start strictly at 03:30 AM IST. Total daily shift length is 9 hours. Communication channels must remain active and uninterrupted.

3. VoIP COMMUNICATION STANDARDS
All outreach campaigns, customer calls, and support communications must be routed strictly through the Company's corporate VoIP channels. Use of personal lines or personal call accounts for business outreach is strictly prohibited.

4. PERSONAL MOBILE PHONES RESTRICTION
The use of personal smartphones, mobile devices, and personal recording equipment is strictly restricted on the active production floor/bay area during shift hours. All personal devices must be stored or silenced.

5. REMOTE WORKSTATION SURVEILLANCE & CONSENTS
- The Employee hereby consents to remote monitoring on all corporate-provided systems. This includes keystroke logging, VPN connectivity tracking, active screen captures, and remote access tracking.
- CCTV Surveillance: Active CCTV surveillance is operational inside the office bays.
- Biometric Punching: Mandatory biometric login registration is required to track shift start and end times.
- Consent Status: CCTV Consent: ${emp.surveillance_consent === 1 ? 'GRANTED' : 'DENIED'}, Biometric Consent: ${emp.biometric_consent === 1 ? 'GRANTED' : 'DENIED'}, HRMS Data Logging: ${emp.hrms_consent === 1 ? 'GRANTED' : 'DENIED'}.

6. DISCIPLINARY PENAL CONSTRAINTS
Violations of the smartphone policy or unapproved exports of CRM data will result in immediate warning logs on your HRMS profile, and termination for cause under the Industrial Relations Code.

${signBlock}

${footer}
            `.trim();

        case 'Rest_Breaks_Policy':
            return `
${header}
                        REST BREAKS & TIMESHEET PUNCHING COMPLIANCE

1. REGULATORY COMPLIANCE
This policy sets forth rigid interval standards in strict compliance with the Gujarat Shops and Establishments (Regulation of Employment and Conditions of Service) Act 2019.

2. WORK SHIFT LIMITS
Your daily shift is set to 9 hours (including rest intervals). Work hours cannot exceed statutory limits under the Shops Act.

3. REST INTERVAL SCHEDULE
- Morning Tea Break: 15 minutes (scheduled at 06:00 AM IST).
- Lunch/Rest Break: 30 minutes (scheduled at 09:30 AM IST).
- Afternoon Tea Break: 15 minutes (scheduled at 11:45 AM IST).

4. MANDATORY PUNCHING
Employees must punch out on the Biometric/HRMS system before commencing any break, and punch in immediately upon returning. Failure to punch breaks is a direct violation of labor reporting compliance.

5. OFFICE PREMISES PROTOCOLS
Due to the early morning nature of the shift (03:30 AM startup), employees are prohibited from leaving the office premises during shift hours without written permission from their reporting supervisor.

6. ESCALATION & GRIEVANCES
Grievances regarding break scheduling or timekeeping discrepancies must be logged directly inside the CRM HRMS dashboard or emailed to hr@averionglobal.com.

${signBlock}

${footer}
            `.trim();

        case 'Data_Protection_Policy':
            return `
${header}
                           DATA PROTECTION & NDA POLICY

1. DATA CONFIDENTIALITY OBLIGATIONS
The Employee agrees to comply with the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology (IT) Act 2000. All databases, client leads, solar design specifications, and calculator spreadsheets are highly confidential.

2. PROHIBITION OF EXPORTS
The Employee is strictly prohibited from copying, emailing, screenshotting, exporting, or transmitting CRM database records, Solar calculator parameters, or client lists to personal devices or external channels.

3. CONTEXT & SURVEILLANCE
Workstations are monitored via remote key-logging, screenshot capturing, and active VPN tracking. Surveillance Consent: ${emp.surveillance_consent === 1 ? 'Active' : 'Inactive'}.

4. INDIAN PENAL & CYBER LAW CONSEQUENCES
Any unauthorized export or leakage of database files will result in immediate termination for cause and criminal prosecution under:
- Section 43 & 66 of the Information Technology Act, 2000 (up to 3 years imprisonment or fine up to Rs 5 Lakhs).
- Section 408 of the Indian Penal Code (Criminal breach of trust by clerk or servant; up to 7 years imprisonment and fine).

${signBlock}

${footer}
            `.trim();

        case 'Employee_Leave_Guide':
            return `
${header}
                       EMPLOYEE LEAVE ENTITLEMENTS GUIDE & COMPLIANCE

1. LEAVE ALLOTMENT
- Annual Leave Quota: The Employee is entitled to a mandatory annual leave quota of 24 days per calendar year.
- Balances: Casual Leave (CL): ${emp.cl_balance} Days | Sick Leave (SL): ${emp.sl_balance} Days | Maternity Leave (ML): ${emp.ml_balance} Days | Privilege Leave: ${emp.annual_leave_balance} Days.

2. SUBMISSION AND APPROVAL PATH
- All leave requests must be submitted through the Solar CRM HRMS portal at least 7 business days in advance.
- Approval requires authorization from the department manager. Unapproved absences will be marked as Loss of Pay (LOP).

3. EARLY SHIFT CALL-OUT ROUTINE
Emergency sick leaves must be reported to the HR coordinator before 03:00 AM IST on the day of absence.

4. MATERNITY BENEFIT
Maternity benefits are administered in strict compliance with the Maternity Benefit Act 1961 (26 weeks paid leave).

${signBlock}

${footer}
            `.trim();

        default:
            return "Standard Corporate Compliance Document";
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
        if (parseInt(probation_period_months, 10) !== 6) {
            return res.status(400).json({ error: 'Internships must strictly have a 6-month probation period.' });
        }
        if (salary < 15000 || salary > 25000) {
            return res.status(400).json({ error: 'Intern stipend must be strictly between 15,000 and 25,000 Rs.' });
        }
    } else {
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
                    
                    db.get(
                        `SELECT id, signed_status FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
                        [employee_id, docType],
                        (docErr, docRow) => {
                            if (docErr) console.error('Error fetching document status:', docErr.message);
                            else if (!docRow) {
                                db.run(
                                    `INSERT INTO legal_signed_documents (employee_id, document_type, signed_status, generated_blob_text) VALUES (?, ?, 0, ?)`,
                                    [employee_id, docType, generatedText]
                                );
                            } else if (docRow.signed_status === 0) {
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
        
        db.all('SELECT id, document_type, signed_status, generated_blob_text, generated_text_payload, email_sent_status, timestamp FROM legal_signed_documents WHERE employee_id = ?', [empId], (docErr, documents) => {
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
                    content: doc.generated_blob_text || doc.generated_text_payload
                }]
            };

            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) return res.status(500).json({ error: 'SMTP delivery failed: ' + mailErr.message });
                res.json({ success: true, message: 'Document sent to employee.' });
            });
        }
    );
});

// ── NEW COMPLIANCE DOCS GENERATOR PORTAL (POST /api/hr/generate-compliance-docs) ───────────────────
router.post('/generate-compliance-docs', requireAuth, (req, res) => {
    const { employee_id } = req.body;
    if (!employee_id) {
        return res.status(400).json({ error: 'employee_id is required' });
    }

    db.get('SELECT * FROM attendance_workers WHERE id = ?', [employee_id], (workerErr, worker) => {
        if (workerErr) return res.status(500).json({ error: workerErr.message });
        if (!worker) return res.status(404).json({ error: 'Worker profile not found.' });

        db.get('SELECT * FROM employee_compliance_profiles WHERE employee_id = ?', [employee_id.toString()], (profileErr, profile) => {
            if (profileErr) return res.status(500).json({ error: profileErr.message });

            const empDetails = {
                employee_id: employee_id.toString(),
                first_name: worker.first_name || 'As per Company Records',
                last_name: worker.last_name || '',
                full_name: `${worker.first_name || ''} ${worker.last_name || ''}`.trim() || 'As per Company Records',
                email: worker.email || 'As per Company Records',
                phone: worker.phone || worker.phone_number || worker.mobile_number || 'As per Company Records',
                company_name: worker.company_name || 'Averion Global LLP',
                job_title: worker.job_title || 'As per Company Records',
                pan_number: worker.pan_number || 'As per Company Records',
                aadhaar_number: worker.aadhaar_number || 'As per Company Records',
                uan_number: worker.uan_number || 'As per Company Records',
                esic_number: worker.esic_number || 'As per Company Records',
                bank_account_name: worker.bank_account_name || 'As per Company Records',
                bank_bsb: worker.bank_bsb || 'As per Company Records',
                bank_account_number: worker.bank_account_number || 'As per Company Records',
                bank_account_type: worker.bank_account_type || 'Savings',
                
                cl_balance: worker.cl_balance !== undefined && worker.cl_balance !== null ? worker.cl_balance : 'As per Company Records',
                sl_balance: worker.sl_balance !== undefined && worker.sl_balance !== null ? worker.sl_balance : 'As per Company Records',
                ml_balance: worker.ml_balance !== undefined && worker.ml_balance !== null ? worker.ml_balance : 'As per Company Records',
                annual_leave_balance: worker.annual_leave_balance !== undefined && worker.annual_leave_balance !== null ? worker.annual_leave_balance : 'As per Company Records',
                
                emergency_name: worker.emergency_name || 'As per Company Records',
                emergency_phone: worker.emergency_phone || 'As per Company Records',
                emergency_relationship: worker.emergency_relationship || 'As per Company Records',

                // Profile parameters
                department: profile ? profile.department : 'Sales',
                designation: profile ? profile.designation : (worker.job_title || 'Associate'),
                base_salary: profile ? profile.base_salary : 25000,
                shift_start_time: profile ? profile.shift_start_time : '03:30 AM',
                probation_period_months: profile ? profile.probation_period_months : 3,
                notice_period_days: profile ? profile.notice_period_days : 45,
                annual_leave_quota: profile ? profile.annual_leave_quota : 24,
                gratuity_eligible: profile ? profile.gratuity_eligible : 0,
                incentive_hold_flag: profile ? profile.incentive_hold_flag : 0,
                onboarding_date: profile ? profile.onboarding_date : (worker.start_date || new Date().toISOString().split('T')[0]),
                
                assets_laptops: profile ? profile.assets_laptops : '',
                assets_desktops: profile ? profile.assets_desktops : '',
                assets_mobiles: profile ? profile.assets_mobiles : '',
                assets_sims: profile ? profile.assets_sims : '',
                assets_ids: profile ? profile.assets_ids : '',
                assets_access_cards: profile ? profile.assets_access_cards : '',
                assets_licenses: profile ? profile.assets_licenses : '',
                
                surveillance_consent: profile ? profile.surveillance_consent : 0,
                biometric_consent: profile ? profile.biometric_consent : 0,
                hrms_consent: profile ? profile.hrms_consent : 0
            };

            db.get("SELECT * FROM averion_hr_policies WHERE company_name = 'Averion Global LLP' LIMIT 1", [], (policyErr, policyMeta) => {
                const docTypes = [
                    'Employment_Agreement',
                    'Mobile_Phone_Policy',
                    'Rest_Breaks_Policy',
                    'Data_Protection_Policy',
                    'Employee_Leave_Guide'
                ];

                const documents = [];
                let completed = 0;

                docTypes.forEach(docType => {
                    const textPayload = compileHRComplianceDoc(docType, empDetails, policyMeta);
                    
                    db.get(
                        `SELECT id FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
                        [employee_id.toString(), docType],
                        (checkErr, existingDoc) => {
                            if (!checkErr && existingDoc) {
                                db.run(
                                    `UPDATE legal_signed_documents 
                                     SET generated_text_payload = ?, generated_blob_text = ? 
                                     WHERE id = ?`,
                                    [textPayload, textPayload, existingDoc.id],
                                    (updateErr) => {
                                        documents.push({
                                            document_type: docType,
                                            generated_text_payload: textPayload
                                        });
                                        completed++;
                                        if (completed === docTypes.length) {
                                            res.json({ success: true, documents });
                                        }
                                    }
                                );
                            } else {
                                db.run(
                                    `INSERT INTO legal_signed_documents 
                                     (employee_id, document_type, signed_status, generated_text_payload, generated_blob_text) 
                                     VALUES (?, ?, 0, ?, ?)`,
                                    [employee_id.toString(), docType, textPayload, textPayload],
                                    (insertErr) => {
                                        documents.push({
                                            document_type: docType,
                                            generated_text_payload: textPayload
                                        });
                                        completed++;
                                        if (completed === docTypes.length) {
                                            res.json({ success: true, documents });
                                        }
                                    }
                                );
                            }
                        }
                    );
                });
            });
        });
    });
});

// ── NEW COMPLIANCE EMAIL DISPATCH PORTAL (POST /api/hr/email-compliance-doc) ─────────────────────
router.post('/email-compliance-doc', requireAuth, (req, res) => {
    const { employee_id, document_type } = req.body;
    if (!employee_id || !document_type) {
        return res.status(400).json({ error: 'employee_id and document_type are required' });
    }

    db.get(
        `SELECT * FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
        [employee_id.toString(), document_type],
        (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!doc) return res.status(404).json({ error: 'Document template not found. Please compile/generate documents first.' });

            db.get(`SELECT email, first_name FROM attendance_workers WHERE id = ?`, [employee_id], (workerErr, worker) => {
                if (workerErr) return res.status(500).json({ error: workerErr.message });
                if (!worker || !worker.email) {
                    return res.status(400).json({ error: 'Employee does not have a registered email address.' });
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

                const docTitle = document_type.replace(/_/g, ' ');

                const mailOptions = {
                    from: config.email.from || `"Averion Global LLP" <${config.email.user}>`,
                    to: worker.email,
                    subject: `${docTitle} - Averion Compliance Management`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; color: #334155; line-height: 1.6; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #0078C1; padding-bottom: 8px;">Averion Global LLP</h2>
                            <p>Dear ${worker.first_name || 'Employee'},</p>
                            <p>Please find attached the official compliance policy document: <strong>${docTitle}</strong>.</p>
                            <p>You are required to review the attached policy and acknowledge it within your HRMS compliance dashboard.</p>
                            <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0;">
                            <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">This is an automated operational notification from Averion HR. Please do not reply directly to this email.</p>
                        </div>
                    `,
                    attachments: [{
                        filename: `${document_type}_Compliance.txt`,
                        content: doc.generated_text_payload || doc.generated_blob_text
                    }]
                };

                transporter.sendMail(mailOptions, (mailErr) => {
                    if (mailErr) return res.status(500).json({ error: 'SMTP delivery failed: ' + mailErr.message });

                    db.run(
                        `UPDATE legal_signed_documents SET email_sent_status = 1 WHERE id = ?`,
                        [doc.id],
                        (updateErr) => {
                            res.json({ success: true, message: `"${docTitle}" sent successfully.` });
                        }
                    );
                });
            });
        }
    );
});

module.exports = router;
