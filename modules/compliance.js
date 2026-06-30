const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth } = require('../helpers');
const nodemailer = require('nodemailer');
const config = require('../config');
const fs = require('fs');
const path = require('path');

// Helper to convert the Averion logo to base64
function getAverionLogoBase64() {
    try {
        const logoPath = path.join(__dirname, '../public/averion_logo.jpg');
        if (fs.existsSync(logoPath)) {
            const fileBuffer = fs.readFileSync(logoPath);
            return `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
        }
    } catch (e) {
        console.error('Error reading averion_logo.jpg:', e.message);
    }
    return '';
}

// Helper to format dates to DD-MM-YY
function formatToDDMMYY(dateStringOrObj) {
    if (!dateStringOrObj || dateStringOrObj === 'As per Company Records') {
        return 'As per Company Records';
    }
    const d = new Date(dateStringOrObj);
    if (isNaN(d.getTime())) {
        return dateStringOrObj;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}

// Fetch all combined details for a worker
function getFullEmployeeDetails(employeeId, callback) {
    db.get('SELECT * FROM attendance_workers WHERE id = ?', [employeeId], (workerErr, worker) => {
        if (workerErr || !worker) {
            return callback(workerErr || new Error('Worker not found'));
        }
        db.get('SELECT * FROM employee_compliance_profiles WHERE employee_id = ? OR user_id = ?', [employeeId.toString(), parseInt(employeeId, 10)], (profileErr, profile) => {
            if (profileErr) return callback(profileErr);

            const empDetails = {
                employee_id: employeeId.toString(),
                first_name: worker.first_name || 'As per Company Records',
                last_name: worker.last_name || '',
                full_name: `${worker.first_name || ''} ${worker.last_name || ''}`.trim() || 'As per Company Records',
                email: worker.email || 'As per Company Records',
                phone: worker.phone || worker.phone_number || worker.mobile_number || 'As per Company Records',
                google_address: worker.google_address || 'As per Company Records',
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
            callback(null, empDetails);
        });
    });
}

// Wrap inner HTML content in a professional letterhead frame
function wrapInHTMLFrame(contentHtml, docType, emp, logoBase64) {
    const docId = `AVG-${docType}-2026-${emp.employee_id || '999'}`;
    const logoImgTag = logoBase64 
        ? `<img src="${logoBase64}" alt="Averion Global Logo">` 
        : `<div style="font-size: 24px; font-weight: 800; color: #0078C1;">AVERION GLOBAL</div>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Averion Global LLP - Compliance Document</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 0;
    line-height: 1.8;
    background-color: #f1f5f9;
  }
  .page {
    background: #ffffff;
    max-width: 800px;
    margin: 40px auto;
    padding: 60px 60px 50px 60px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    box-sizing: border-box;
    position: relative;
  }
  .letterhead-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid #0078C1;
    padding-bottom: 15px;
    margin-bottom: 35px;
  }
  .logo-container {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .logo-container img {
    height: 180px;
    width: auto;
    margin-top: -45px;
    margin-bottom: -45px;
    margin-left: -20px;
  }
  .company-info {
    text-align: right;
    font-size: 11px;
    color: #475569;
    line-height: 1.5;
  }
  .company-name {
    font-size: 18px;
    font-weight: 800;
    color: #0078C1;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }
  .doc-title {
    text-align: center;
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    margin: 25px 0 15px 0;
    letter-spacing: 1px;
  }
  h3 {
    color: #0078C1;
    font-size: 13px;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-top: 24px;
    margin-bottom: 12px;
    text-transform: uppercase;
  }
  p, li {
    font-size: 13px;
    color: #334155;
    margin-bottom: 10px;
    text-align: justify;
  }
  ol, ul {
    margin-top: 5px;
    padding-left: 20px;
  }
  li {
    margin-bottom: 8px;
  }
  .sign-container {
    display: flex;
    justify-content: space-between;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px dashed #cbd5e1;
  }
  .sign-box {
    width: 45%;
    font-size: 12px;
    color: #475569;
  }
  .sign-line {
    border-bottom: 1px solid #94a3b8;
    height: 50px;
    margin-bottom: 8px;
  }
  .annexure-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    margin-bottom: 25px;
    font-size: 12px;
  }
  .annexure-table th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
  }
  .annexure-table td {
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    color: #334155;
  }
  .annexure-table tr:nth-child(even) {
    background-color: #f8fafc;
  }
  .doc-footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
    margin-top: 40px;
    font-size: 10px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
  @media print {
    body {
      background: none;
    }
    .page {
      margin: 0;
      padding: 20px 10px;
      box-shadow: none;
      border-radius: 0;
      max-width: 100%;
      page-break-after: always;
    }
    .page:last-child {
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="letterhead-header">
      <div class="logo-container">
        ${logoImgTag}
      </div>
      <div class="company-info">
        <div class="company-name">AVERION GLOBAL LLP</div>
        <div>Shop 2, Sthapatya Residency, Near Nayara Petrol Pump,</div>
        <div>SP Ring Road, Ognaj, Ahmedabad – 380060, Gujarat, India</div>
        <div>GST: ${emp.gst || '24ACMFA7488G1Z0'} | PAN: ${emp.pan || 'ACMFA7488G'}</div>
        <div>Email: hr@averionglobal.co.in | Web: www.averionglobal.co.in</div>
      </div>
    </div>
    
    ${contentHtml}

    <div class="doc-footer">
      <div>Document ID: ${docId} | Confidentiality: Strict Confidential | Owner: HR Compliance</div>
      <div>Version Number: VER-2026-V1.0 | Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
}

// Helper to generate legal text templates (Original)
function generateDocumentText(docType, emp) {
    const today = formatToDDMMYY(new Date());
    const logoBase64 = getAverionLogoBase64();
    
    const gross = parseFloat(emp.base_salary || 0);
    const basic = gross * 0.50;
    const hra = gross * 0.20;
    const specialAllowance = gross * 0.30;

    const formattedGross = gross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedBasic = basic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedHRA = hra.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedSpecial = specialAllowance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    const signHtml = `
    <div class="sign-container">
      <div class="sign-box">
        For <strong>Averion Global LLP</strong>
        <div class="sign-line"></div>
        Authorized Signatory
      </div>
      <div class="sign-box">
        Accepted by Employee/Intern
        <div class="sign-line"></div>
        <strong>${emp.full_name}</strong>
      </div>
    </div>
    `;

    switch(docType) {
        case 'Appointment_Letter': {
            const isIntern = (emp.designation || '').toLowerCase().includes('intern');
            const probationMonths = isIntern ? 6 : (emp.probation_period_months || 3);
            const noticeDays = emp.notice_period_days || 45;
            const docDate = emp.onboarding_date ? formatToDDMMYY(emp.onboarding_date) : today;

            const appointmentContent = `
            <div class="doc-title">Letter of Appointment</div>
            <p><strong>Date:</strong> ${docDate}</p>
            
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong>${(emp.google_address && emp.google_address !== 'As per Company Records') ? `<br>${emp.google_address}` : ''}</p>
            
            <p>Dear <strong>${emp.full_name}</strong>,</p>
            
            <p>We are pleased to offer you an appointment in our organization as <strong>"${emp.designation || 'Associate'}"</strong> in the <strong>${emp.department || 'Sales'}</strong> Department. Your appointment commences on <strong>${formatToDDMMYY(emp.onboarding_date) || today}</strong> (the "Effective Date") subject to the following terms and conditions:</p>
            
            <h3>1. Appointment & Probation Period</h3>
            <p>You shall be on probation for a period of <strong>${probationMonths} months</strong> from the Effective Date. Your performance will be reviewed periodically, and the Company reserves the right to extend the probation period if deemed necessary. During the probation period, either party may terminate this relationship by giving fifteen (15) days written notice. Upon successful completion of probation, your confirmation will be communicated to you in writing.</p>
            
            <h3>2. Work Shift Timings & Adherence</h3>
            <p>Due to the nature of our business and operational alignment with clients in the Australian Time Zone, your regular daily shift starts strictly at <strong>03:30 AM IST</strong>. The standard daily working hours are nine (9) hours, including designated rest breaks. Punctual attendance and readiness at your workstation by 03:30 AM IST is a fundamental requirement of your employment.</p>
            
            <h3>3. Remuneration & Benefits</h3>
            <p>Your Monthly Gross Compensation is set to <strong>${formattedGross}</strong>, structured as detailed in Annexure A. Gratuity benefits will be applicable upon completing five (5) consecutive years of continuous active service under the Payment of Gratuity Act 1972. Salary is subject to statutory deductions such as Income Tax, Professional Tax, and other applicable withholdings as per government regulations.</p>
            
            <h3>4. Exclusivity & Moonlighting Restriction</h3>
            <p>You are required to devote your whole time, attention, and ability to the business and affairs of Averion Global LLP. You shall not, during the tenure of your employment, engage directly or indirectly in any other business, dual employment, freelance assignments, consulting work, or advisory services, whether paid or unpaid, without the prior written consent of the Company.</p>
            
            <h3>5. Confidentiality & Non-Disclosure</h3>
            <p>You shall maintain strict confidentiality regarding all proprietary information, client leads, solar design specifications, project files, pricing lists, and computer systems belonging to the Company. You are prohibited from copy, screenshot, or export of CRM database records to personal storages or devices.</p>
            
            <h3>6. Intellectual Property Rights</h3>
            <p>All software codes, outreach spreadsheets, calculators, databases, and solar proposal layouts designed or generated by you during your service hours belong exclusively to the Company. You hereby assign all rights and titles globally in such IP to Averion Global LLP.</p>
            
            <h3>7. Separation & Notice Period</h3>
            <p>Post confirmation, either party may terminate this employment agreement by giving a written notice of <strong>${noticeDays} days</strong> or by paying salary in lieu thereof, at the sole discretion of the Company. The Company reserves the right to terminate your services immediately for cause (such as data leakage, theft, breach of policy, or code of conduct violations) without notice or compensation.</p>
            
            <h3>8. POSH & Workplace Safety</h3>
            <p>The Company maintains a strictly zero-tolerance policy against sexual harassment. You shall abide by the Prevention of Sexual Harassment (POSH) Act 2013 and cooperate with the Internal Complaints Committee (ICC) if required.</p>
            
            <h3>9. Arbitration & Jurisdiction</h3>
            <p>This Appointment Letter is subject to the laws of India. Any and all disputes arising from your employment shall be settled via binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996. The competent courts of Ahmedabad, Gujarat shall have exclusive jurisdiction.</p>
            
            ${signHtml}
            
            <div style="page-break-before: always;"></div>
            
            <div class="doc-title" style="margin-top: 40px;">ANNEXURE A: COMPENSATION DETAILS</div>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Gross Monthly CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>
            `;
            return wrapInHTMLFrame(appointmentContent, 'APT', emp, logoBase64);
        }

        case 'NDA_IP_Assignment': {
            const ndaContent = `
            <div class="doc-title">Non-Disclosure and Intellectual Property Assignment Agreement</div>
            <p><strong>Date of Execution:</strong> ${today}</p>
            <p><strong>Between:</strong> Averion Global LLP ("Company") and Mr./Ms. <strong>${emp.full_name}</strong> ("Employee").</p>
            
            <h3>1. Purpose & Scope</h3>
            <p>The Company engages the Employee in a highly confidential capacity. In the course of duties, the Employee will have access to corporate databases, solar client leads, CRM records, proprietary proposal templates, and layout optimization algorithms.</p>
            
            <h3>2. Definitions of Proprietary Information</h3>
            <p>Proprietary Information includes all client identifiers, solar yield models, marketing pitches, lead sheets, pricing frameworks, and digital credentials. It also covers codes and design structures generated during employment.</p>
            
            <h3>3. Strict Non-Disclosure & Security Obligations</h3>
            <p>The Employee shall maintain absolute confidentiality and protect all corporate assets. The Employee is strictly prohibited from exporting, screenshotting, transferring, or duplicating database files. Any breach constitutes a material violation under Section 43 of the Information Technology Act 2000.</p>
            
            <h3>4. Intellectual Property Assignment</h3>
            <p>The Employee hereby assigns and transfers exclusively to the Company all rights, titles, and global interests (including copyright, trademark, and patent rights) in all software tools, scripts, layout proposal templates, and marketing processes created during work shifts.</p>
            
            <h3>5. Term & Survival</h3>
            <p>The obligations of confidentiality, non-disclosure, and intellectual property assignment shall survive indefinitely post separation of employment.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(ndaContent, 'NDA', emp, logoBase64);
        }

        case 'HR_Policy_Manual': {
            const hrManualContent = `
            <div class="doc-title">HR Policy Manual & Conduct Regulations</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Professional Code of Conduct</h3>
            <p>All employees of Averion Global LLP must operate with the highest standards of integrity, respect, and professionalism. Communication with clients and team members must remain respectful at all times.</p>
            
            <h3>2. Timings & Shift Attendance</h3>
            <p>Standard operations commence strictly at 03:30 AM IST. Nine (9) hours constitute a daily shift. Mandatory biometric punch tracking is integrated. Repeated tardiness will lead to warning logs and disciplinary review.</p>
            
            <h3>3. Anti-Harassment & POSH Compliance</h3>
            <p>The Company maintains a strictly zero-tolerance policy against sexual harassment. The Internal Complaints Committee (ICC) is fully functional under the POSH Act 2013 to address and resolve any complaints securely.</p>
            
            <h3>4. Leaves and Public Holidays</h3>
            <p>Entitled to a basic quota of 24 days annual leaves. Holiday scheduling follows the Australian Time Zone operational groups. Leave approvals require a minimum of 7 days prior notification.</p>
            
            <h3>5. Disciplinary Process & Separation</h3>
            <p>Standard procedures involve a verbal warning, written warning, suspension, and termination. The Company reserves the right to execute immediate termination for cause (such as data theft, dual employment, or breach of confidentiality).</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(hrManualContent, 'HRM', emp, logoBase64);
        }

        case 'Moonlighting_Covenant': {
            const moonlightingContent = `
            <div class="doc-title">Exclusivity and Non-Moonlighting Covenant</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee:</strong> ${emp.full_name}</p>
            
            <h3>1. Covenant of Exclusivity</h3>
            <p>The Employee shall devote their whole time, attention, and professional capabilities exclusively to the business and operations of Averion Global LLP during their employment contract.</p>
            
            <h3>2. Comprehensive Moonlighting Restriction</h3>
            <p>The Employee is strictly prohibited from engaging directly or indirectly in any dual employment, freelance tasks, external advisory services, contracting work, or independent business ventures (paid or unpaid) without the explicit, written approval of the Company's Board.</p>
            
            <h3>3. Non-Conflict of Interest</h3>
            <p>The Employee shall not engage in any activity that conflicts with the interests of the Company, including private solar proposal layout designing, sales lead brokering, or competitor consulting.</p>
            
            <h3>4. Penal Actions & Remedies</h3>
            <p>Violation of the exclusivity covenant will result in immediate termination for cause, forfeiture of pending bonuses/stipends, and civil recovery of double the gross compensation paid during the period of violation.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(moonlightingContent, 'EXC', emp, logoBase64);
        }

        case 'Gratuity_Reimbursement': {
            const gratuityContent = `
            <div class="doc-title">Gratuity and Statutory Reimbursements Declaration</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Gratuity Entitlement Covenants</h3>
            <p>Statutory gratuity benefits are administered in strict accordance with the Payment of Gratuity Act 1972. Eligibility for gratuity payments requires completion of a minimum of five (5) consecutive years of continuous active service with the Company.</p>
            
            <h3>2. Remuneration Deductions</h3>
            <p>The gross salary is subject to statutory withholdings including Professional Tax, Provident Fund (PF) contribution, and Employee State Insurance (ESIC) where applicable under Indian labor codes.</p>
            
            <h3>3. Expense Reimbursement Rules</h3>
            <p>All business-related expenses (including approved client communication costs, travel, and mobile internet allowances) are reimbursable only upon submission of valid tax invoices and approval within 30 days of expense occurrence.</p>
            
            <h3>4. Final Settlements</h3>
            <p>Final settlement payouts, statutory bonus distributions, and leave encashment calculations will be completed within 30 days of the Employee completing the exit clearance procedure.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(gratuityContent, 'GRT', emp, logoBase64);
        }

        case 'Anti_Poaching_Agreement': {
            const antiPoachingContent = `
            <div class="doc-title">Non-Solicitation and Anti-Poaching Agreement</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Non-Solicitation of Clients</h3>
            <p>The Employee covenants that during employment and for a period of twenty-four (24) months post separation, they shall not solicit, contact, or service any client or lead of Averion Global LLP for personal profit or on behalf of any other entity.</p>
            
            <h3>2. Non-Solicitation of Employees & Contractors</h3>
            <p>The Employee agrees not to solicit, induce, recruit, or attempt to hire any employee, developer, or contractor of Averion Global LLP to join any competitor, freelance network, or partner business.</p>
            
            <h3>3. Protection of Business Goodwill</h3>
            <p>The restrictions are agreed to be reasonable and necessary to protect the Company's proprietary market leads, solar proposal layouts, and business goodwill.</p>
            
            <h3>4. Injunctive Relief and Damages</h3>
            <p>Any breach of these covenants will cause irreparable harm, entitling the Company to seek immediate injunctive relief and liquidated damages from competent courts in Ahmedabad.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(antiPoachingContent, 'ANS', emp, logoBase64);
        }

        case 'IT_Asset_Surveillance': {
            const surveillanceContent = `
            <div class="doc-title">IT Asset Security and Workstation Surveillance Policy</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Ownership of Assets</h3>
            <p>All hardware systems (laptops, desktops, monitors, SIM cards, building access cards) assigned to the Employee remain the sole property of Averion Global LLP. Detailed asset tags are listed in Annexure B of the appointment contract.</p>
            
            <h3>2. Remote Monitoring Consent</h3>
            <p>The Employee consents to active remote monitoring of the assigned workstation. This includes keystroke tracking, periodic screenshots, active VPN logging, browser history tracking, and remote desktop access reviews.</p>
            
            <h3>3. Data Export Prohibitions</h3>
            <p>No corporate data, customer details, lead lists, or software tools may be copied or transferred. Screen sharing via unapproved software (e.g. AnyDesk, TeamViewer) is strictly prohibited.</p>
            
            <h3>4. Penal Obligations</h3>
            <p>Asset damage or data theft will result in recovery of financial damages, immediate suspension, and legal prosecution under the Information Technology Act 2000.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(surveillanceContent, 'ITS', emp, logoBase64);
        }

        case 'Shift_Safety_Declaration': {
            const shiftSafetyContent = `
            <div class="doc-title">Early Morning Shift Operations & Safety Declaration</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Shift Schedule & Timezone Alignment</h3>
            <p>Operations are aligned to the Australian Time Zone, requiring a startup strictly at 03:30 AM IST. Total shift duration is nine (9) hours. Attendance and system readiness by 03:30 AM IST is mandatory.</p>
            
            <h3>2. Early Morning Safety Protocols</h3>
            <p>The Company operates active secure physical entry. Employees traveling during early morning hours must prioritize safe travel paths, share live location tracking with family/supervisors, and follow corporate safety directives.</p>
            
            <h3>3. Absences & Call-Out Routine</h3>
            <p>If an employee cannot report for the shift due to an emergency, they must notify the operations manager/HR via SMS or dashboard call-out before 03:00 AM IST.</p>
            
            <h3>4. Verification of Covenants</h3>
            <p>The Employee declares they have verified their commuting paths and confirm they are fully capable of reporting for duty at 03:30 AM IST daily without exceptions.</p>
            
            ${signHtml}
            `;
            return wrapInHTMLFrame(shiftSafetyContent, 'SFT', emp, logoBase64);
        }

        case 'Employment_Agreement': {
            const isIntern = (emp.designation || '').toLowerCase().includes('intern');
            const probationMonths = isIntern ? 6 : (emp.probation_period_months || 3);
            const noticeDays = emp.notice_period_days || 45;

            const agreementContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/EA/${emp.employee_id || 'TEMP'}<br>
                <strong>Version:</strong> 2.4.0 (IT Services)<br>
                <strong>Effective Date:</strong> ${formatToDDMMYY(emp.onboarding_date) || today}
            </div>

            <div class="doc-title">Master Employment Agreement</div>
            <p>This Employment Agreement (<strong>"Agreement"</strong>) is executed on this ${today} at Ahmedabad, Gujarat, India, by and between <strong>Averion Global LLP</strong>, a Limited Liability Partnership registered under the laws of India, having its registered office at Shop 2, Sthapatya Residency, Near Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060 (hereinafter referred to as the <strong>"Employer"</strong> or the <strong>"Company"</strong>) and Mr./Ms. <strong>${emp.full_name}</strong>, residing at ${emp.google_address || 'As per Company Records'} (hereinafter referred to as the <strong>"Employee"</strong>).</p>
            
            <p><strong>NOW, THEREFORE, IT IS MUTUALLY AGREED AS FOLLOWS:</strong></p>

            <h3>1. Appointment & Designation</h3>
            <p>The Company hereby appoints the Employee as <strong>"${emp.designation || 'Associate'}"</strong> under the <strong>${emp.department || 'Sales'}</strong> Department commencing from the Effective Date.</p>

            <h3>2. Probation Period</h3>
            <p>The Employee shall undergo a probation period of strictly <strong>${probationMonths} Months</strong>. The Company reserves the right to extend the probation period based on performance evaluations.</p>

            <h3>3. Work Shift Hours & Commencing Time</h3>
            <p>The Employee's standard daily working hours are nine (9) hours, including designated rest breaks. Due to alignment with international client schedules in the Australian Time Zone, the shift commences strictly at <strong>03:30 AM IST</strong> daily.</p>

            <h3>4. Weekly Rest Day</h3>
            <p>The Employee shall be entitled to one (1) weekly off day, which shall be <strong>Sunday</strong>.</p>

            <h3>5. Remuneration & Monthly CTC</h3>
            <p>The Employee's Gross monthly compensation package is set to <strong>substituteFormattedGross</strong>, structured as detailed in Annexure A.</p>

            <h3>6. Annexure A Pay Structure</h3>
            <p>The salary components, including Basic, HRA, and Special Allowance, are detailed in the Annexure A table attached hereto and forming an integral part of this contract.</p>

            <h3>7. Statutory Deductions</h3>
            <p>All payments made to the Employee shall be subject to statutory deductions such as Income Tax, Professional Tax (PT), Provident Fund (EPF), and ESIC, in accordance with applicable laws.</p>

            <h3>8. Target-Based Incentive Policy</h3>
            <p>A Target-Based Incentive Policy applies to the Employee's role. Meeting the defined performance targets is mandatory. Failure to meet targets leads strictly to an incentive hold, with absolutely zero base salary deduction.</p>

            <h3>9. Exclusivity & Double Employment (Anti-Moonlighting)</h3>
            <p>The Employee shall devote their whole time, attention, and ability exclusively to the Company's business. Engagement in any other business, dual employment, freelance work, or advisory services, whether paid or unpaid, is strictly prohibited unless approved in writing.</p>

            <h3>10. Confidentiality & Non-Disclosure</h3>
            <p>The Employee shall protect all Confidential Information including Customer Database, Vendor Database, Pricing, Business Plans, Sales Data, CRM Records, Internal Reports, Financial Reports, Employee Data, Client Information, Technical Documentation, and Trade Secrets.</p>

            <h3>11. Intellectual Property Rights & Assignment</h3>
            <p>All solar layouts, outreach spreadsheets, code, designs, and materials generated by the Employee during their service belong exclusively to the Company. The Employee hereby assigns all global rights, titles, and interests in such IP to the Company.</p>

            <h3>12. Acceptable Use of AI Tools</h3>
            <p>AI Tools are permitted only for authorized business purposes. The Employee is strictly prohibited from uploading confidential client data, trade secrets, or personal information into public AI models without written approval.</p>

            <h3>13. Social Media Code of Conduct</h3>
            <p>The Employee shall not disclose or post confidential company information, client details, pricing structures, internal communications, source documents, or business strategies on any social media platforms.</p>

            <h3>14. Corporate Asset Management</h3>
            <p>The Employee acknowledges receipt of assigned company assets (Laptop, Desktop, Mobile, SIM, ID Card, Software Licenses) and agrees to maintain them in good working condition.</p>

            <h3>15. Data Protection & Foreign Clients Security</h3>
            <p>Due to the Company's business relations with foreign clients, the Employee agrees to maintain the highest levels of digital security and comply with the DPDP Act 2023 and the Information Technology Act 2000.</p>

            <h3>16. VoIP, CCTV & Attendance Surveillance Consent</h3>
            <p>The Employee hereby consents to securing operational areas via CCTV surveillance, VoIP logging, biometric login records, and HRMS access logs to monitor shift safety and verify attendance.</p>

            <h3>17. Leave Policy & Absences</h3>
            <p>Leave entitlements (PL/EL, CL, SL, ML) shall accrue and be managed in accordance with the Company's HR Policies and the Gujarat Shops and Establishments Act.</p>

            <h3>18. Gratuity Benefits Eligibility</h3>
            <p>Gratuity eligibility is strictly governed by the Payment of Gratuity Act 1972, requiring a minimum of five (5) consecutive years of continuous active service with the Company.</p>

            <h3>19. Code of Professional Integrity</h3>
            <p>The Employee shall operate with the highest standards of professional conduct, compliance, and respect, and strictly avoid activities that bring disrepute to the Company.</p>

            <h3>20. Notice Period & Separation</h3>
            <p>During probation, either party may terminate employment with fifteen (15) days written notice. Post confirmation, the notice period is strictly set to <strong>E5 Days</strong>. The Company reserves the right to terminate employment immediately for cause without notice or compensation.</p>

            <h3>21. Disciplinary Actions & Suspension</h3>
            <p>The Company reserves the right to suspend system access, email accounts, and office entry during any investigations into misconduct or breach of confidentiality.</p>

            <h3>22. Corporate Investigations & Due Process</h3>
            <p>In case of alleged data breach, policy violation, or ethical misconduct, the Company shall conduct an internal investigation following due process and applicable labor laws.</p>

            <h3>23. Severability & Enforceability</h3>
            <p>If any provision of this Agreement is held to be invalid or unenforceable, the remaining clauses shall continue in full force and effect.</p>

            <h3>24. Entirety of Agreement</h3>
            <p>This Agreement constitutes the entire understanding between the parties regarding the employment relationship and supersedes all prior proposals or communications.</p>

            <h3>25. Governing Law, Arbitration & Jurisdiction</h3>
            <p>This Agreement shall be governed by the laws of India. Any disputes shall be resolved through binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996. The competent courts of Ahmedabad, Gujarat shall have exclusive jurisdiction.</p>

            ${signHtml}

            <div style="page-break-before: always;"></div>
            
            <div class="doc-title" style="margin-top: 40px;">ANNEXURE A: COMPENSATION DETAILS</div>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Gross Monthly CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>
            `;
            return wrapInHTMLFrame(agreementContent, 'EAG', emp, logoBase64);
        }

        case 'NDA': {
            const ndaContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/NDA/substituteEmployeeId<br>
                <strong>Version:</strong> 1.2.0<br>
                <strong>Effective Date:</strong> ${formatToDDMMYY(emp.onboarding_date) || today}
            </div>

            <div class="doc-title">Mutual Non-Disclosure Agreement</div>
            <p>This Mutual Non-Disclosure Agreement (<strong>"Agreement"</strong>) is entered into on this ${today} at Ahmedabad, Gujarat, India, by and between <strong>Averion Global LLP</strong>, having its registered office at Shop 2, Sthapatya Residency, Near Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060 (the <strong>"Company"</strong>) and Mr./Ms. <strong>${emp.full_name}</strong>, residing at ${emp.google_address || 'As per Company Records'} (the <strong>"Employee"</strong>).</p>

            <h3>1. Definitions</h3>
            <p><strong>"Confidential Information"</strong> refers to all proprietary data disclosed by the Company to the Employee, including but not limited to: Customer Database, Vendor Database, Pricing, Business Plans, Sales Data, CRM Records, Internal Reports, Financial Reports, Employee Data, Client Information, Technical Documentation, and Trade Secrets.</p>
            <p><strong>"Trade Secrets"</strong> refers to the solar yield models, marketing outreach processes, database architectures, and solar layout optimization codes/algorithms developed or used by the Company.</p>

            <h3>2. Strict Non-Disclosure Obligations</h3>
            <p>The Employee shall maintain absolute confidentiality and protect all Confidential Information. The Employee is strictly prohibited from exporting, duplicating, screenshotting, or communicating corporate database files to personal storages, devices, or third parties.</p>

            <h3>3. Permitted Disclosure</h3>
            <p>The Employee may only disclose Confidential Information to authorized personnel within the Company who have a strict "need-to-know" basis for authorized business purposes. Any external disclosure requires prior written approval from the Managing Partner of Averion Global LLP.</p>

            <h3>4. Return of Information & Company Assets</h3>
            <p>Upon separation of employment or request, the Employee must immediately hand over all Company property and assets in their possession, including but not limited to: Laptops, Desktops, SIM Cards, ID Cards, software licenses, access cards, and keys. System access (HRMS, CRM, and Email) shall be suspended immediately.</p>

            <h3>5. Consequences of Breach</h3>
            <p>Any breach of this Agreement constitutes a material violation under Section 43 and 66 of the Information Technology Act 2000 and Section 408 of the Indian Penal Code. The Company reserves the right to terminate employment immediately for cause and initiate legal and recovery proceedings.</p>

            <h3>6. Injunction Right</h3>
            <p>The Employee acknowledges that a breach of this Agreement will cause irreparable harm to the Company for which monetary damages alone would be inadequate, and that the Company shall be entitled to seek injunctive relief in addition to any other remedies available.</p>

            <h3>7. Indemnity</h3>
            <p>The Employee agrees to indemnify and hold harmless the Company, its partners, and clients from and against any losses, damages, liabilities, and legal costs arising from unauthorized disclosure of Confidential Information.</p>

            <h3>8. Dispute Resolution & Jurisdiction</h3>
            <p>This Agreement is governed by the laws of India. Any dispute shall be resolved through binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996. The competent courts of Ahmedabad, Gujarat shall have exclusive jurisdiction.</p>

            ${signHtml}
            `;
            return wrapInHTMLFrame(ndaContent, 'NDA', emp, logoBase64);
        }

        case 'Warning_Letter': {
            const warningContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/WL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> ${today}
            </div>

            <div class="doc-title">Letter of Warning / Disciplinary Caution</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong><br>
            Designation: ${emp.designation || 'Associate'}<br>
            Department: ${emp.department || 'Sales'}</p>

            <p>Dear ${emp.full_name},</p>
            <p>This is an official warning letter issued in regard to recent compliance breaches, policy violations, or performance concerns observed during your service with Averion Global LLP.</p>
            
            <h3>1. Nature of Infraction</h3>
            <p>It has been brought to the attention of the management that your conduct or performance has failed to align with the standards set forth in our HR Policy Manual and Code of Conduct. Specifically, issues have been noted in relation to punctuality, shift adherence (03:30 AM IST shift commencement), social media disclosure restrictions, or unauthorized usage of AI tools.</p>

            <h3>2. Reference to Company Policies</h3>
            <p>Under Clause 13 (Social Media Code of Conduct) and Clause 12 (Use of AI Tools) of your Employment Agreement, employees must strictly protect corporate database secrets, pricing structures, and client files. System access monitoring shows discrepancies that require immediate correction.</p>

            <h3>3. Required Corrective Actions</h3>
            <p>You are hereby instructed to immediately align your conduct and performance with corporate expectations. Specifically, you must ensure strict adherence to shift timings, maintain absolute confidentiality, and cease any unauthorized tool usage.</p>

            <h3>4. Disciplinary Consequences</h3>
            <p>Please note that this letter will be recorded in your personnel file. Failure to demonstrate immediate and sustained improvement will lead to further disciplinary actions, which may include suspension of system access, extension of your probation period, or immediate termination of your employment in accordance with Clause 20 of the Employment Agreement.</p>

            <p>Yours sincerely,</p>
            <div style="margin-top: 30px; font-weight: bold;">
                For Averion Global LLP<br><br><br>
                _______________________<br>
                Human Resources Department
            </div>

            <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 10px;">
                <strong>Employee Acknowledgment:</strong><br>
                I hereby acknowledge receipt of this warning letter.
                <br><br>
                Signature: _______________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: _______________________
            </div>
            `;
            return wrapInHTMLFrame(warningContent, 'WRN', emp, logoBase64);
        }

        case 'Termination_Letter': {
            const terminationContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/TL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> ${today}
            </div>

            <div class="doc-title">Letter of Termination / Separation Notice</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong><br>
            Designation: ${emp.designation || 'Associate'}<br>
            Department: ${emp.department || 'Sales'}</p>

            <p>Dear ${emp.full_name},</p>
            <p>We regret to inform you that your employment with Averion Global LLP is hereby terminated. Your separation date shall be effective as of <strong>${today}</strong>.</p>

            <h3>1. Grounds of Separation</h3>
            <p>This action is taken in accordance with Clause 20 (Notice Period & Separation) and Clause 21 (Disciplinary Actions & Suspension) of your Employment Agreement. The decision has been reached following documented instances of performance discrepancies, policy non-compliance, or breaches of confidentiality that are inconsistent with the Company's operational integrity.</p>

            <h3>2. Notice Period & Pay in Lieu</h3>
            <p>The Company shall provide you with payment in lieu of the contractually mandated 45-day notice period, subject to successful completion of the clearance procedure and final settlement computations.</p>

            <h3>3. Return of Corporate Assets</h3>
            <p>You are instructed to immediately return all Company-owned assets in your possession to the HR department, including: Laptops, Desktops, Mobile Devices, SIM Cards, ID Cards, and building access cards. All login credentials and system access to CRM, HRMS, and Email accounts have been suspended immediately.</p>

            <h3>4. Full and Final Settlement</h3>
            <p>Your full and final settlement (FnF), including any unpaid salary, accrued leaves, and notice pay, will be processed and credited to your registered bank account within fifteen (15) business days following complete handover of all corporate assets and sign-off on the clearance certificate.</p>

            <p>We wish you the best in your future endeavors.</p>
            <br>
            <div style="font-weight: bold;">
                For Averion Global LLP<br><br><br>
                _______________________<br>
                Authorized Signatory
            </div>
            `;
            return wrapInHTMLFrame(terminationContent, 'TRM', emp, logoBase64);
        }

        case 'Experience_Letter': {
            const experienceContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/EL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> ${today}
            </div>

            <div class="doc-title" style="margin-top: 40px; font-size: 22px; text-transform: uppercase;">To Whomsoever It May Concern</div>
            
            <p style="margin-top: 30px; line-height: 1.8; font-size: 14px;">This is to certify that Mr./Ms. <strong>substituteFullName</strong> was employed with <strong>Averion Global LLP</strong> as a <strong>"${emp.designation || 'Associate'}"</strong> in the <strong>${emp.department || 'Sales'}</strong> Department from <strong>${formatToDDMMYY(emp.onboarding_date) || today}</strong> to <strong>${today}</strong>.</p>
            
            <p style="line-height: 1.8; font-size: 14px;">During their tenure of service in our IT Services division, we found them to be diligent, hard-working, and professional in carrying out their assigned duties. They demonstrated strong technical competencies and worked effectively within the team.</p>
            
            <p style="line-height: 1.8; font-size: 14px;">We appreciate their contributions to the organization and wish them all success in their future career endeavors.</p>

            <div style="margin-top: 60px;">
                For <strong>Averion Global LLP</strong><br><br><br><br>
                _______________________<br>
                <strong>Human Resources Manager</strong>
            </div>
            `;
            return wrapInHTMLFrame(experienceContent, 'EXP', emp, logoBase64);
        }

        case 'Relieving_Letter': {
            const relievingContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/RL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> substituteToday
            </div>

            <div class="doc-title">Letter of Relieving</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong><br>
            Residing at: ${emp.google_address || 'As per Company Records'}</p>

            <p>Dear ${emp.full_name},</p>
            <p>This has reference to your separation from the services of Averion Global LLP. We wish to confirm that your resignation has been accepted by the management and you are officially relieved from the services of the Company at the close of business hours on <strong>${today}</strong>.</p>

            <h3>1. Clearance & Return of Assets</h3>
            <p>We acknowledge that you have successfully completed the exit clearance process and returned all Company assets including your Laptop, SIM card, ID Badge, and access credentials. All system access permissions have been suspended.</p>

            <h3>2. Full and Final Settlement</h3>
            <p>The Full and Final Settlement (FnF) of your accounts has been computed and fully cleared. No outstanding dues remain payable by either party as of this date.</p>

            <p>We thank you for the services rendered during your employment and wish you the best in your future career.</p>

            <br><br>
            <div style="font-weight: bold;">
                For Averion Global LLP<br><br><br>
                _______________________<br>
                <strong>Authorized Signatory</strong>
            </div>
            `;
            return wrapInHTMLFrame(relievingContent, 'REL', emp, logoBase64);
        }

        case 'Salary_Revision_Letter': {
            const revisionContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/SRL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> substituteToday
            </div>

            <div class="doc-title">Salary Increment & Revision Notice</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong><br>
            Designation: ${emp.designation || 'Associate'}</p>

            <p>Dear ${emp.full_name},</p>
            <p>Consequent to the recent review of your performance, we are pleased to inform you that your compensation package has been revised with effect from <strong>${today}</strong>.</p>

            <h3>1. Revised Compensation Structure</h3>
            <p>Your revised Gross Monthly CTC will be <strong>${formattedGross}</strong>. The detailed bifurcation of your revised salary components is set out in the table below:</p>

            <table class="annexure-table" style="margin-top: 15px; margin-bottom: 15px;">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Revised Monthly Gross CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>

            <h3>2. Terms and Conditions</h3>
            <p>All other terms and conditions of your employment as detailed in your Master Employment Agreement remain unchanged. We look forward to your continued dedication and contributions to Averion Global LLP.</p>

            <p>Yours sincerely,</p>
            <br>
            <div style="font-weight: bold;">
                For Averion Global LLP<br><br><br>
                _______________________<br>
                <strong>Managing Partner</strong>
            </div>
            `;
            return wrapInHTMLFrame(revisionContent, 'REV', emp, logoBase64);
        }

        case 'Promotion_Letter': {
            const promotionContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/PL/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> substituteToday
            </div>

            <div class="doc-title">Letter of Promotion & Career Advancement</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong></p>

            <p>Dear ${emp.full_name},</p>
            <p>In recognition of your exceptional performance, dedication, and leadership contributions in our IT Services division, we are delighted to promote you to the position of <strong>"${emp.designation || 'Senior Associate'}"</strong> within the <strong>${emp.department || 'Sales'}</strong> Department, effective from <strong>${today}</strong>.</p>

            <h3>1. Duties and Responsibilities</h3>
            <p>In your new role, you will be responsible for managing advanced service deliverables, coordinating outreach strategies, and assisting in client onboarding. You will report directly to the operations head/managing partner.</p>

            <h3>2. Revised Salary Structure</h3>
            <p>In alignment with your promotion, your monthly Gross CTC is revised to <strong>${formattedGross}</strong>. The component-wise bifurcation is structured below:</p>

            <table class="annexure-table" style="margin-top: 15px; margin-bottom: 15px;">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Revised monthly Gross CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>

            <p>We congratulate you on this milestone and wish you continued growth and success with Averion Global LLP.</p>

            <p>Yours sincerely,</p>
            <br>
            <div style="font-weight: bold;">
                For Averion Global LLP<br><br><br>
                _______________________<br>
                <strong>Authorized Signatory</strong>
            </div>
            `;
            return wrapInHTMLFrame(promotionContent, 'PRO', emp, logoBase64);
        }

        case 'Asset_Handover': {
            const handoverContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc No:</strong> AVG/HR/AH/substituteEmployeeId<br>
                <strong>Version:</strong> 1.0.0<br>
                <strong>Effective Date:</strong> substituteToday
            </div>

            <div class="doc-title">Corporate Asset Handover & Acknowledgement</div>
            <p><strong>Date:</strong> ${today}</p>
            <p>This document serves as a formal acknowledgement of the transfer and possession of corporate assets between <strong>Averion Global LLP</strong> (the "Company") and the Employee, Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Terms of Asset Handover</h3>
            <p>The Employee acknowledges receipt of the specific corporate assets listed in Table 1 in functional working condition. The assets are the sole property of Averion Global LLP and are issued for authorized business purposes only.</p>

            <table class="annexure-table" style="margin-top: 15px; margin-bottom: 15px;">
              <thead>
                <tr>
                  <th>Asset Category</th>
                  <th>Tag / Serial Number Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Laptop Asset Tag</strong></td>
                  <td>${emp.assets_laptops || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Desktop Asset Tag</strong></td>
                  <td>${emp.assets_desktops || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Mobile Device Asset Tag</strong></td>
                  <td>${emp.assets_mobiles || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>SIM Card Identifier</strong></td>
                  <td>${emp.assets_sims || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Company ID Card Badge</strong></td>
                  <td>${emp.assets_ids || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Building Access Card</strong></td>
                  <td>${emp.assets_access_cards || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Software Licenses</strong></td>
                  <td>${emp.assets_licenses || 'Not Issued / Pending'}</td>
                </tr>
                <tr>
                  <td><strong>Corporate Email Account</strong></td>
                  <td>${emp.email || 'Pending Activation'}</td>
                </tr>
                <tr>
                  <td><strong>HRMS & Attendance Access</strong></td>
                  <td>Active (Standard Login credentials)</td>
                </tr>
              </tbody>
            </table>

            <h3>2. Security & Compliance</h3>
            <p>The Employee agrees to comply with the Company's Data Protection Policies and will not copy, export, or store CRM database files, solar proposals, or pricing structures on personal devices. System access will be suspended immediately upon separation or policy breach.</p>

            <p>I acknowledge receipt and assume responsibility for the assets listed above.</p>

            ${signHtml}
            `;
            return wrapInHTMLFrame(handoverContent, 'AST', emp, logoBase64);
        }
        default:
            const title = docType.replace(/_/g, ' ');
            const dummyContent = `
            <div class="doc-title">${title}</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            <p>This document details the compliance agreement covenants corresponding to the ${title} policy established by Averion Global LLP.</p>
            <p>Please review and sign this document to acknowledge compliance.</p>
            ${signHtml}
            `;
            return wrapInHTMLFrame(dummyContent, docType.substring(0, 3).toUpperCase(), emp, logoBase64);
    }
}

// Helper to generate the 5 compliance policy cards (New HTML Template System)
function compileHRComplianceDoc(docType, emp, policyMeta) {
    const today = formatToDDMMYY(new Date());
    
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

    emp.gst = gst;
    emp.pan = pan;
    
    const logoBase64 = getAverionLogoBase64();

    const signHtml = `
    <div class="sign-container">
      <div class="sign-box">
        For <strong>${companyName}</strong>
        <div class="sign-line"></div>
        Authorized Signatory
      </div>
      <div class="sign-box">
        Accepted by Employee/Intern
        <div class="sign-line"></div>
        <strong>${emp.full_name}</strong>
      </div>
    </div>
    `;

    let innerContent = '';

    switch(docType) {
        case 'Appointment_Letter':
            return generateDocumentText(docType, emp);

        case 'Employment_Agreement': {
            const isIntern = (emp.designation || '').toLowerCase().includes('intern');
            const probationMonths = isIntern ? 6 : (emp.probation_period_months || 3);
            const noticeDays = emp.notice_period_days || 45;

            innerContent = `
            <div class="doc-title">Employment Agreement</div>
            <p>This Employment Agreement (<strong>"Agreement"</strong>) is executed on this ${today} at Ahmedabad, Gujarat, India.</p>
            
            <p><strong>BY AND BETWEEN:</strong></p>
            <p><strong>AVERION GLOBAL LLP</strong>, a Limited Liability Partnership incorporated under the laws of India, having its registered office at ${address} (hereinafter referred to as the <strong>"Employer"</strong> or the <strong>"Company"</strong>, which expression shall unless repugnant to the context include its successors and permitted assigns);</p>
            <p><strong>AND:</strong></p>
            <p>Mr./Ms. <strong>${emp.full_name}</strong>, residing at ${emp.google_address || 'As per Company Records'} (hereinafter referred to as the <strong>"Employee"</strong>, which expression shall unless repugnant to the context include their legal heirs and administrators).</p>
            
            <h3>1. Definitions and Interpretation</h3>
            <ul>
              <li><strong>"Effective Date"</strong> shall mean the onboarding date of ${formatToDDMMYY(emp.onboarding_date) || today}.</li>
              <li><strong>"Employment Type"</strong> shall mean ${isIntern ? 'Internship' : 'Permanent Employment'}.</li>
              <li><strong>"Designation"</strong> shall mean "${emp.designation || 'Associate'}" under the ${emp.department || 'Sales'} Department.</li>
            </ul>
            
            <h3>2. Appointment and Probation</h3>
            <ul>
              <li>The Company hereby appoints the Employee to perform services aligned with the designated role starting from the Effective Date.</li>
              <li>The Employee shall undergo a probation period of ${probationMonths} months. Either party may terminate employment during probation with fifteen (15) days written notice. Upon confirmation, notice period is strictly set to ${noticeDays} days.</li>
            </ul>
            
            <h3>3. Compensation and Pay Structure</h3>
            <ul>
              <li>The Monthly Gross Compensation is set to ${formattedGross}. The pay structure is bifurcated under Annexure A.</li>
              <li><strong>Target-Based Incentive Hold Policy:</strong> A Target-Based Incentive Hold is applicable in accordance with sales quotas. Failure to meet performance targets leads strictly to an incentive hold, with absolutely zero base salary deduction.</li>
              <li>Gratuity eligibility: ${emp.gratuity_eligible === 1 ? 'Eligible under the Payment of Gratuity Act 1972' : 'Not Eligible (Pending 5 years continuous service)'}.</li>
            </ul>
            
            <h3>4. Working Hours and Shift Timings</h3>
            <ul>
              <li>The Employee shall work a daily shift of 9 hours.</li>
              <li><strong>Early Morning Shift:</strong> Operations start strictly at 03:30 AM IST daily to align with Australian Client Time Zones.</li>
              <li><strong>Weekly Off:</strong> Sunday.</li>
            </ul>
            
            <h3>5. Exclusivity & Anti-Moonlighting</h3>
            <ul>
              <li>The Employee shall devote their entire working time and attention exclusively to the business of the Company.</li>
              <li><strong>Dual Employment:</strong> The Employee is strictly prohibited from engaging in any other business, dual employment, freelancing, tutoring, consulting, or providing services to any external firm (directly or indirectly, paid or unpaid) during the tenure of their employment.</li>
              <li><strong>Customer Protection:</strong> The Employee shall not solicit, divert, or design solar proposals for any clients of the Company for personal profit or for any competitor.</li>
            </ul>
            
            <h3>6. Data Protection & Digital Security</h3>
            <ul>
              <li>The Employee agrees to comply with the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology (IT) Act 2000.</li>
              <li>All CRM databases, customer leads, pricing matrices, and layout algorithms are proprietary assets of the Company. The Employee is strictly prohibited from exporting, screenshotting, or communicating client lists.</li>
            </ul>
            
            <h3>7. Intellectual Property Rights</h3>
            <ul>
              <li>All solar layouts, outreach calculators, and CRM software designs generated by the Employee during service belong exclusively to the Employer. The Employee hereby assigns all global rights, titles, and interests in such IP to the Company.</li>
            </ul>
            
            <h3>8. POSH & Whistleblower Standards</h3>
            <ul>
              <li>The Company strictly enforces a zero-tolerance policy towards sexual harassment in accordance with the POSH Act 2013.</li>
              <li><strong>Whistleblower Policy:</strong> Complaints regarding compliance breaches, data theft, or ethical violations can be submitted anonymously to compliance@averionglobal.co.in.</li>
            </ul>
            
            <h3>9. Jurisdiction & Arbitration</h3>
            <ul>
              <li>This Agreement is governed by the laws of India.</li>
              <li><strong>Dispute Resolution:</strong> Any dispute arising out of this contract shall be settled via binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996.</li>
              <li><strong>Jurisdiction:</strong> The competent courts of Ahmedabad, Gujarat shall have exclusive jurisdiction.</li>
            </ul>
            
            ${signHtml}
            
            <div style="page-break-before: always;"></div>
            
            <div class="doc-title" style="margin-top: 40px;">ANNEXURE A: PAY STRUCTURE BREAKDOWN</div>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Gross Monthly CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>
            
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Bank Account Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bank Name / Holder</td>
                  <td>${emp.bank_account_name || 'As per Company Records'}</td>
                </tr>
                <tr>
                  <td>Account Type</td>
                  <td>${emp.bank_account_type || 'Savings'}</td>
                </tr>
                <tr>
                  <td>IFSC Code / BSB</td>
                  <td>${emp.bank_bsb || 'As per Company Records'}</td>
                </tr>
                <tr>
                  <td>Account Number</td>
                  <td>${emp.bank_account_number || 'As per Company Records'}</td>
                </tr>
                <tr>
                  <td>Permanent Account Number (PAN)</td>
                  <td>${emp.pan_number || 'As per Company Records'}</td>
                </tr>
                <tr>
                  <td>Aadhaar Card Number</td>
                  <td>${emp.aadhaar_number || 'As per Company Records'}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="doc-title" style="margin-top: 40px;">ANNEXURE B: ASSIGNED CORPORATE ASSET TRACKERS</div>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Asset Category</th>
                  <th>Asset Tag / Serial Number</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Laptop Asset Tag</td>
                  <td>${emp.assets_laptops || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>Desktop Asset Tag</td>
                  <td>${emp.assets_desktops || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>Mobile Device Asset Tag</td>
                  <td>${emp.assets_mobiles || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>SIM Card Identifier</td>
                  <td>${emp.assets_sims || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>ID Card / Badge Code</td>
                  <td>${emp.assets_ids || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>Building Access Card Tag</td>
                  <td>${emp.assets_access_cards || 'Not Assigned'}</td>
                </tr>
                <tr>
                  <td>Software Licenses Assigned</td>
                  <td>${emp.assets_licenses || 'Not Assigned'}</td>
                </tr>
              </tbody>
            </table>
            `;
            break;
        }

        case 'Mobile_Phone_Policy': {
            innerContent = `
            <div class="doc-title">Mobile Device & Workstation Surveillance Policy</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Purpose & Scope</h3>
            <p>This policy regulates workstation monitoring, communication rules, and the use of personal mobile devices during early morning operations at ${companyName}.</p>
            
            <h3>2. Shift Timing & Adherence</h3>
            <p>Due to active operations running on the Australian Time Zone, shifts start strictly at 03:30 AM IST. Total daily shift length is 9 hours. Communication channels must remain active and uninterrupted.</p>
            
            <h3>3. VoIP Communication Standards</h3>
            <p>All outreach campaigns, customer calls, and support communications must be routed strictly through the Company's corporate VoIP channels. Use of personal lines or personal call accounts for business outreach is strictly prohibited.</p>
            
            <h3>4. Personal Mobile Phones Restriction</h3>
            <p>The use of personal smartphones, mobile devices, and personal recording equipment is strictly restricted on the active production floor/bay area during shift hours. All personal devices must be stored or silenced.</p>
            
            <h3>5. Remote Workstation Surveillance & Consents</h3>
            <ul>
              <li>The Employee hereby consents to remote monitoring on all corporate-provided systems. This includes keystroke logging, VPN connectivity tracking, active screen captures, and remote access tracking.</li>
              <li><strong>CCTV Surveillance:</strong> Active CCTV surveillance is operational inside the office bays.</li>
              <li><strong>Biometric Punching:</strong> Mandatory biometric login registration is required to track shift start and end times.</li>
              <li><strong>Consent Status:</strong> CCTV Consent: <strong>${emp.surveillance_consent === 1 ? 'GRANTED' : 'DENIED'}</strong>, Biometric Consent: <strong>${emp.biometric_consent === 1 ? 'GRANTED' : 'DENIED'}</strong>, HRMS Data Logging: <strong>${emp.hrms_consent === 1 ? 'GRANTED' : 'DENIED'}</strong>.</li>
            </ul>
            
            <h3>6. Disciplinary Penal Constraints</h3>
            <p>Violations of the smartphone policy or unapproved exports of CRM data will result in immediate warning logs on your HRMS profile, and termination for cause under the Industrial Relations Code.</p>
            
            ${signHtml}
            `;
            break;
        }

        case 'Rest_Breaks_Policy': {
            innerContent = `
            <div class="doc-title">Rest Breaks & Timesheet Punching Compliance</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Regulatory Compliance</h3>
            <p>This policy sets forth rigid interval standards in strict compliance with the Gujarat Shops and Establishments (Regulation of Employment and Conditions of Service) Act 2019.</p>
            
            <h3>2. Work Shift Limits</h3>
            <p>Your daily shift is set to 9 hours (including rest intervals). Work hours cannot exceed statutory limits under the Shops Act.</p>
            
            <h3>3. Rest Interval Schedule</h3>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Break Category</th>
                  <th>Duration</th>
                  <th>Scheduled Time (IST)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Morning Tea Break</strong></td>
                  <td>15 Minutes</td>
                  <td>06:00 AM IST</td>
                </tr>
                <tr>
                  <td><strong>Lunch/Rest Break</strong></td>
                  <td>30 Minutes</td>
                  <td>09:30 AM IST</td>
                </tr>
                <tr>
                  <td><strong>Afternoon Tea Break</strong></td>
                  <td>15 Minutes</td>
                  <td>11:45 AM IST</td>
                </tr>
              </tbody>
            </table>
            
            <h3>4. Mandatory Punching</h3>
            <p>Employees must punch out on the Biometric/HRMS system before commencing any break, and punch in immediately upon returning. Failure to punch breaks is a direct violation of labor reporting compliance.</p>
            
            <h3>5. Office Premises Protocols</h3>
            <p>Due to the early morning nature of the shift (03:30 AM startup), employees are prohibited from leaving the office premises during shift hours without written permission from their reporting supervisor.</p>
            
            <h3>6. Escalation & Grievances</h3>
            <p>Grievances regarding break scheduling or timekeeping discrepancies must be logged directly inside the CRM HRMS dashboard or emailed to hr@averionglobal.co.in.</p>
            
            ${signHtml}
            `;
            break;
        }

        case 'Data_Protection_Policy': {
            innerContent = `
            <div class="doc-title">Data Protection & NDA Policy</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Data Confidentiality Obligations</h3>
            <p>The Employee agrees to comply with the Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology (IT) Act 2000. All databases, client leads, solar design specifications, and calculator spreadsheets are highly confidential.</p>
            
            <h3>2. Prohibition of Exports</h3>
            <p>The Employee is strictly prohibited from copying, emailing, screenshotting, exporting, or transmitting CRM database records, Solar calculator parameters, or client lists to personal devices or external channels.</p>
            
            <h3>3. Context & Surveillance</h3>
            <p>Workstations are monitored via remote key-logging, screenshot capturing, and active VPN tracking. Surveillance Consent: <strong>${emp.surveillance_consent === 1 ? 'Active' : 'Inactive'}</strong>.</p>
            
            <h3>4. Indian Penal & Cyber Law Consequences</h3>
            <p>Any unauthorized export or leakage of database files will result in immediate termination for cause and criminal prosecution under:</p>
            <ul>
              <li><strong>Section 43 & 66 of the Information Technology Act, 2000:</strong> up to 3 years imprisonment or fine up to Rs 5 Lakhs.</li>
              <li><strong>Section 408 of the Indian Penal Code:</strong> Criminal breach of trust by clerk or servant; up to 7 years imprisonment and fine.</li>
            </ul>
            
            ${signHtml}
            `;
            break;
        }

        case 'Employee_Leave_Guide': {
            innerContent = `
            <div class="doc-title">Employee Leave Entitlements Guide & Compliance</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Name:</strong> ${emp.full_name}</p>
            
            <h3>1. Leave Allotment</h3>
            <p>The Employee is entitled to a mandatory annual leave quota of 24 days per calendar year. Current leave status details are listed below:</p>
            
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Current Balance Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Privilege / Annual Leave (EL/PL)</strong></td>
                  <td>${emp.annual_leave_balance} Days</td>
                </tr>
                <tr>
                  <td><strong>Casual Leave (CL)</strong></td>
                  <td>${emp.cl_balance} Days</td>
                </tr>
                <tr>
                  <td><strong>Sick Leave (SL)</strong></td>
                  <td>${emp.sl_balance} Days</td>
                </tr>
                <tr>
                  <td><strong>Maternity Leave (ML)</strong></td>
                  <td>${emp.ml_balance} Days</td>
                </tr>
              </tbody>
            </table>
            
            <h3>2. Submission and Approval Path</h3>
            <p>All leave requests must be submitted through the Solar CRM HRMS portal at least 7 business days in advance. Approval requires authorization from the department manager. Unapproved absences will be marked as Loss of Pay (LOP).</p>
            
            <h3>3. Early Shift Call-Out Routine</h3>
            <p>Emergency sick leaves must be reported to the HR coordinator before 03:00 AM IST on the day of absence.</p>
            
            <h3>4. Maternity Benefit</h3>
            <p>Maternity benefits are administered in strict compliance with the Maternity Benefit Act 1961 (26 weeks paid leave).</p>
            
            ${signHtml}
            `;
            break;
        }

        default:
            innerContent = `<div class="doc-title">Compliance Document</div><p>Standard compliance guidelines.</p>${signHtml}`;
            break;
    }

    return wrapInHTMLFrame(innerContent, docType, emp, logoBase64);
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

    db.get('SELECT id FROM employee_compliance_profiles WHERE employee_id = ? OR user_id = ?', [employee_id.toString(), parseInt(employee_id, 10)], (checkErr, row) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message });

        const docTypes = [
            'Appointment_Letter', 'NDA_IP_Assignment', 'HR_Policy_Manual', 'Moonlighting_Covenant',
            'Gratuity_Reimbursement', 'Anti_Poaching_Agreement', 'IT_Asset_Surveillance', 'Shift_Safety_Declaration'
        ];

        const handleSuccess = () => {
            getFullEmployeeDetails(employee_id, (detailsErr, empDetails) => {
                if (detailsErr) {
                    console.error('Error generating document detail mappings:', detailsErr.message);
                    return res.json({ success: true, message: 'Onboarding compliance profile saved, but failed to map document parameters.' });
                }

                docTypes.forEach(docType => {
                    const generatedText = generateDocumentText(docType, empDetails);
                    
                    db.get(
                        `SELECT id, signed_status FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
                        [employee_id.toString(), docType],
                        (docErr, docRow) => {
                            if (docErr) console.error('Error fetching document status:', docErr.message);
                            else if (!docRow) {
                                db.run(
                                    `INSERT INTO legal_signed_documents (employee_id, document_type, signed_status, generated_blob_text) VALUES (?, ?, 0, ?)`,
                                    [employee_id.toString(), docType, generatedText]
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
            });
        };

        if (row) {
            // Run UPDATE
            db.run(
                `UPDATE employee_compliance_profiles SET
                    employee_id = ?,
                    full_name = ?,
                    department = ?,
                    designation = ?,
                    base_salary = ?,
                    shift_start_time = ?,
                    probation_period_months = ?,
                    notice_period_days = ?,
                    annual_leave_quota = ?,
                    gratuity_eligible = ?,
                    incentive_hold_flag = ?,
                    onboarding_date = ?,
                    assets_laptops = ?,
                    assets_desktops = ?,
                    assets_mobiles = ?,
                    assets_sims = ?,
                    assets_ids = ?,
                    assets_access_cards = ?,
                    assets_licenses = ?,
                    surveillance_consent = ?,
                    biometric_consent = ?,
                    hrms_consent = ?
                WHERE employee_id = ? OR user_id = ?`,
                [
                    employee_id.toString(),
                    full_name, department, designation, salary,
                    shift_start_time || '03:30 AM', parseInt(probation_period_months, 10) || 3, parseInt(notice_period_days, 10) || 45,
                    parseInt(annual_leave_quota, 10) || 24, gratEligible, incHold, onboarding_date,
                    assets_laptops || '', assets_desktops || '', assets_mobiles || '', assets_sims || '',
                    assets_ids || '', assets_access_cards || '', assets_licenses || '',
                    survConsent, bioConsent, hrConsent,
                    employee_id.toString(), parseInt(employee_id, 10)
                ],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    handleSuccess();
                }
            );
        } else {
            // Run INSERT
            db.run(
                `INSERT INTO employee_compliance_profiles (
                    employee_id, user_id, employment_type, modern_award_name, base_hourly_rate, casual_loading_active,
                    tax_file_number, tax_scale_code, super_fund_name, super_usi, super_member_number,
                    visa_type, visa_expiry_date, full_name, department, designation, base_salary,
                    shift_start_time, probation_period_months, notice_period_days,
                    annual_leave_quota, gratuity_eligible, incentive_hold_flag, onboarding_date,
                    assets_laptops, assets_desktops, assets_mobiles, assets_sims,
                    assets_ids, assets_access_cards, assets_licenses,
                    surveillance_consent, biometric_consent, hrms_consent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employee_id.toString(), parseInt(employee_id, 10), 'Full-Time', '', 25.00, 1,
                    '', '', '', '', '',
                    '', '', full_name, department, designation, salary,
                    shift_start_time || '03:30 AM', parseInt(probation_period_months, 10) || 3, parseInt(notice_period_days, 10) || 45,
                    parseInt(annual_leave_quota, 10) || 24, gratEligible, incHold, onboarding_date,
                    assets_laptops || '', assets_desktops || '', assets_mobiles || '', assets_sims || '',
                    assets_ids || '', assets_access_cards || '', assets_licenses || '',
                    survConsent, bioConsent, hrConsent
                ],
                function(insertErr) {
                    if (insertErr) return res.status(500).json({ error: insertErr.message });
                    handleSuccess();
                }
            );
        }
    });
});

// ── DRAFT SPECIFIC COMPLIANCE DOCUMENT (POST) ─────────────────────────
router.post('/draft-doc', requireAuth, (req, res) => {
    const { employee_id, document_type } = req.body;
    if (!employee_id || !document_type) {
        return res.status(400).json({ error: 'Missing employee_id or document_type' });
    }

    getFullEmployeeDetails(employee_id, (detailsErr, empDetails) => {
        if (detailsErr) {
            return res.status(500).json({ error: detailsErr.message });
        }

        const generatedText = generateDocumentText(document_type, empDetails);

        db.get(
            `SELECT id, signed_status FROM legal_signed_documents WHERE employee_id = ? AND document_type = ?`,
            [employee_id.toString(), document_type],
            (docErr, docRow) => {
                if (docErr) {
                    return res.status(500).json({ error: docErr.message });
                }

                if (!docRow) {
                    db.run(
                        `INSERT INTO legal_signed_documents (employee_id, document_type, signed_status, generated_blob_text) VALUES (?, ?, 0, ?)`,
                        [employee_id.toString(), document_type, generatedText],
                        function(insErr) {
                            if (insErr) return res.status(500).json({ error: insErr.message });
                            res.json({ success: true, message: 'Document drafted successfully.' });
                        }
                    );
                } else {
                    // Update the drafted document
                    db.run(
                        `UPDATE legal_signed_documents SET generated_blob_text = ? WHERE id = ?`,
                        [generatedText, docRow.id],
                        function(updErr) {
                            if (updErr) return res.status(500).json({ error: updErr.message });
                            res.json({ success: true, message: 'Document updated successfully.' });
                        }
                    );
                }
            }
        );
    });
});

// ── FETCH COMPLIANCE & LEGAL PROFILE (GET) ───────────────────────────
router.get('/employee/:id', requireAuth, (req, res) => {
    const empId = req.params.id;
    
    db.get('SELECT * FROM employee_compliance_profiles WHERE employee_id = ? OR user_id = ?', [empId, parseInt(empId, 10)], (err, profile) => {
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
                    filename: `${document_type}_Agreement.html`,
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

    getFullEmployeeDetails(employee_id, (detailsErr, empDetails) => {
        if (detailsErr) return res.status(500).json({ error: detailsErr.message });

        db.get("SELECT * FROM averion_hr_policies WHERE company_name = 'Averion Global LLP' LIMIT 1", [], (policyErr, policyMeta) => {
            const docTypes = [
                'Appointment_Letter',
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
                        filename: `${document_type}_Compliance.html`,
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


// ── COMPILE PHASE-WISE DOCUMENT TEMPLATE ─────────────────────────────────
function compilePhaseDoc(category, emp, registry) {
    const today = formatToDDMMYY(new Date());
    const docDate = emp.onboarding_date ? formatToDDMMYY(emp.onboarding_date) : today;
    const logoBase64 = getAverionLogoBase64();

    const regName = registry ? registry.company_name : 'Averion Global LLP';
    const regOffice = registry ? registry.registered_office : 'Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad - 380060';
    const regGstin = registry ? registry.gstin : '24ACMFA7488G1Z0';
    const regPan = registry ? registry.pan_card : 'ACMFA7488G';

    const gross = parseFloat(emp.base_salary || emp.base_salary_scale || 0);
    const basic = gross * 0.50;
    const hra = gross * 0.20;
    const specialAllowance = gross * 0.30;

    const formattedGross = gross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedBasic = basic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedHRA = hra.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedSpecial = specialAllowance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    const probationMonths = emp.probation_months || emp.probation_period_months || 3;
    const noticeDays = emp.notice_days || emp.notice_period_days || 45;
    const shiftStart = emp.shift_schedule_string || emp.shift_start_time || '03:30 AM';
    const leaveQuota = emp.allocated_leaves || emp.annual_leave_quota || 24;

    const signHtml = `
    <div class="sign-container">
      <div class="sign-box">
        For <strong>${regName}</strong>
        <div class="sign-line"></div>
        Authorized Signatory
      </div>
      <div class="sign-box">
        Accepted by Employee/Intern
        <div class="sign-line"></div>
        <strong>${emp.full_name}</strong>
      </div>
    </div>
    `;

    let innerContent = '';

    switch(category) {
        case 'Category_B': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/EA/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Category B (Foundation)<br>
                <strong>Execution Date:</strong> ${docDate}
            </div>

            <div class="doc-title">Master Employment Agreement & Appointment Terms</div>
            <p>This Master Employment Agreement (<strong>"Agreement"</strong>) is entered into at Ahmedabad, Gujarat, India, by and between <strong>${regName}</strong>, having its registered office at ${regOffice} (hereinafter referred to as the <strong>"Employer"</strong> or the <strong>"Company"</strong>) and Mr./Ms. <strong>${emp.full_name}</strong>, residing at ${emp.google_address || 'As per Company Records'} (hereinafter referred to as the <strong>"Employee"</strong>).</p>

            <h3>1. Scope of Engagement & Internship Metrics</h3>
            <ul>
                <li>The Company hereby appoints the Employee as <strong>"${emp.designation || 'Associate'}"</strong> under the <strong>${emp.department || 'Operations'}</strong> Department.</li>
                <li><strong>Internship Provision:</strong> In the event that the role is designated as an Internship, the engagement shall span a strict duration of six (6) months. During this internship period, the Employee shall be eligible for a fixed monthly stipend scaled between Rs 15,000 and Rs 25,000 based on performance benchmarks.</li>
                <li><strong>Permanent Transition:</strong> Transition to permanent employment is subject to successful review at the end of the 6-month internship period, and is not automatic.</li>
            </ul>

            <h3>2. Probation & Confirmation</h3>
            <ul>
                <li>Upon onboarding (or transition to permanent role), the Employee shall undergo a probation period of strictly <strong>${probationMonths} Months</strong>.</li>
                <li>During probation, either party may terminate employment with fifteen (15) days written notice. Post confirmation, the notice period is strictly set to <strong>${noticeDays} Days</strong>.</li>
            </ul>

            <h3>3. Work Shift Hours & Australian Time Zone Parameters</h3>
            <ul>
                <li>The Employee's standard daily working hours are nine (9) hours, including designated rest breaks.</li>
                <li>Due to strict operational alignment with client schedules in the Australian Time Zone, the shift commences strictly at <strong>${shiftStart} IST</strong> daily.</li>
                <li>Punctual shift commencement and alignment with Australian timezone requirements are absolute conditions of employment.</li>
            </ul>

            <h3>4. Remuneration & Compensation Structure</h3>
            <ul>
                <li>The Employee's monthly Gross salary (or stipend) is set to <strong>${formattedGross}</strong>, structured as detailed in Annexure A.</li>
                <li>Gratuity benefits will be applicable only upon completing five (5) consecutive years of continuous active service under the Payment of Gratuity Act 1972.</li>
            </ul>

            <h3>5. Dispute Resolution, Governing Law & Ahmedabad Jurisdiction</h3>
            <ul>
                <li>This Agreement is governed by the laws of India.</li>
                <li>Any dispute arising from this contract shall be settled via binding arbitration in Ahmedabad, Gujarat, under the Arbitration and Conciliation Act 1996.</li>
                <li>The competent courts of <strong>Ahmedabad, Gujarat</strong> shall have absolute and exclusive jurisdiction over all matters arising out of this employment relation.</li>
            </ul>

            ${signHtml}

            <div style="page-break-before: always;"></div>
            
            <div class="doc-title" style="margin-top: 40px;">ANNEXURE A: COMPENSATION DETAILS</div>
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Salary Component</th>
                  <th>Percentage</th>
                  <th>Monthly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Basic Salary</strong></td>
                  <td>50%</td>
                  <td>${formattedBasic}</td>
                </tr>
                <tr>
                  <td><strong>House Rent Allowance (HRA)</strong></td>
                  <td>20%</td>
                  <td>${formattedHRA}</td>
                </tr>
                <tr>
                  <td><strong>Special Allowance</strong></td>
                  <td>30%</td>
                  <td>${formattedSpecial}</td>
                </tr>
                <tr style="background-color: #e2e8f0; font-weight: 700;">
                  <td>Gross Monthly CTC</td>
                  <td>100%</td>
                  <td>${formattedGross}</td>
                </tr>
              </tbody>
            </table>
            `;
            break;
        }

        case 'Category_A': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/HRP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Category A (Foundation)<br>
                <strong>Execution Date:</strong> ${docDate}
            </div>

            <div class="doc-title">Master HR Policy Manual</div>
            <p>This Master HR Policy Manual establishes the binding rules, regulations, and operational structures of <strong>${regName}</strong>, applicable to the Employee Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Legal Foundation Rules</h3>
            <ul>
                <li>This manual constitutes a binding covenant between the Employee and ${regName}. Compliance with all policies detailed herein is mandatory.</li>
                <li>The Company reserves the right to amend, update, or revise policies to align with statutory changes and operational requirements.</li>
            </ul>

            <h3>2. Leave Policy & Annual Quota Allotment</h3>
            <ul>
                <li>The Employee is entitled to an explicit annual leave quota of <strong>${leaveQuota} Days</strong>.</li>
                <li>Leaves accrue monthly and must be applied for and approved in writing at least seven (7) days in advance, except in emergency cases.</li>
                <li>Unapproved absences shall result in loss of pay and potential disciplinary actions.</li>
            </ul>

            <h3>3. Shift Patterns & Timings</h3>
            <ul>
                <li>All operations are structured around client timezones. The standard shift starts strictly at <strong>${shiftStart} IST</strong>.</li>
                <li>The Employee must report, login, and be fully operational at their workstation by the commencement time of the shift.</li>
            </ul>

            <h3>4. Reporting Hierarchy & Communication Protocol</h3>
            <ul>
                <li>The Employee shall report directly to their designated Lead, Manager, or as directed by the Managing Partners.</li>
                <li>Professional communication protocols must be followed at all times. All work-related communications must occur through official company channels (email, Slack, HRMS).</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Category_H': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/SIP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Category H (Incentive)<br>
                <strong>Execution Date:</strong> ${docDate}
            </div>

            <div class="doc-title">Target-Based Sales Incentive & Commission Policy</div>
            <p>This policy outlines the sales incentive, targets, and commission structures established by <strong>${regName}</strong>, applicable to the Employee Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Incentive Architecture & Milestones</h3>
            <ul>
                <li>The Employee is eligible for performance-based commissions upon meeting or exceeding set sales targets and milestones.</li>
                <li>Milestones, commission rates, and payouts are evaluated monthly in accordance with the Sales Target Sheet.</li>
            </ul>

            <h3>2. Target-Driven Incentive Hold Policy</h3>
            <ul>
                <li><strong>Explicit Hold Provision:</strong> In the event of a failure to meet the minimum defined sales milestones, the Company shall put a hold on the target-driven sales incentive payout.</li>
                <li><strong>Salary Protection Guarantee:</strong> The Company explicitly declares that under no circumstances shall there be any deduction from the Employee's baseline base salary for failing to meet sales targets. Base salary is legally protected.</li>
            </ul>

            <h3>3. Review and Discretionary adjustments</h3>
            <ul>
                <li>The Company reserves the right to modify commission matrices, baseline quotas, and campaign multipliers with prior written notice.</li>
                <li>All incentive payouts are subject to client payment realization and audit.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Category_C': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/NDA/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Category C (NDA & IPR)<br>
                <strong>Execution Date:</strong> substituteDocDate
            </div>

            <div class="doc-title">Comprehensive Non-Disclosure, IP Assignment & Anti-Moonlighting Covenant</div>
            <p>This Agreement is entered into by and between <strong>${regName}</strong> and the Employee, Mr./Ms. <strong>${emp.full_name}</strong>, to protect proprietary assets and secrets.</p>

            <h3>1. Protection of Corporate Secrets</h3>
            <ul>
                <li><strong>Confidential Information</strong> includes: Customer Database, Vendor Database, solar lead sheets, pricing lists, business proposals, financial reports, CRM records, and technical layout codes.</li>
                <li>The Employee shall maintain strict confidentiality and is prohibited from exporting, screenshotting, or replicating files to personal storage devices.</li>
            </ul>

            <h3>2. Intellectual Property (IP) Assignment</h3>
            <ul>
                <li>All codes, algorithms, outreach spreadsheets, layout designs, and proposal calculators designed by the Employee during their service hours belong exclusively to the Company.</li>
                <li>The Employee hereby assigns all global rights, titles, and interests in such IP to the Company.</li>
            </ul>

            <h3>3. Exclusivity & Anti-Moonlighting Restrictions</h3>
            <ul>
                <li>The Employee shall devote their whole time, attention, and capabilities exclusively to the Company.</li>
                <li><strong>Dual Employment:</strong> The Employee is strictly prohibited from engaging in any duplicate employment, parallel freelancing, teaching, consulting, or starting a business, paid or unpaid, during the employment tenure.</li>
                <li><strong>Client Poaching:</strong> The Employee shall not solicit, contact, or provide proposal designs to Company clients for personal gains or competitors.</li>
            </ul>

            <h3>4. Statutory Violations & Legal Reference</h3>
            <ul>
                <li>Any unauthorized extraction or leakage of company data constitutes a criminal offense under Section 43 & 66 of the Information Technology Act 2000.</li>
                <li>Breach of trust, database theft, or corporate poaching shall result in immediate termination for cause and criminal prosecution under Section 408 of the Indian Penal Code (IPC).</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Category_F_L': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/ITP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Category F/L (Assets & Surveillance)<br>
                <strong>Execution Date:</strong> substituteDocDate
            </div>

            <div class="doc-title">Workplace Surveillance, IT Assets, & Rest Breaks Policy</div>
            <p>This policy details the surveillance consents, hardware management protocols, and shift break limits established by <strong>${regName}</strong>, applicable to the Employee Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Shift Rest Break Limits</h3>
            <ul>
                <li>Under the 9-hour operational shift, the Employee is entitled to designated rest breaks not exceeding a cumulative total of one (1) hour.</li>
                <li>All breaks must be logged in the timesheet system. Punctual return from rest breaks is mandatory.</li>
            </ul>

            <h3>2. Workplace Surveillance Consent</h3>
            <ul>
                <li>The Employee hereby provides absolute, irrevocable consent for operational monitoring including:
                    <ul>
                        <li>CCTV surveillance of physical premises and workspaces.</li>
                        <li>Biometric punch-in/out logs for shift tracking.</li>
                        <li>Remote system logging, corporate email tracking, and VoIP communication records on Company networks.</li>
                    </ul>
                </li>
            </ul>

            <h3>3. IT Asset Management & Serial Trackers</h3>
            <ul>
                <li>The Employee acknowledges responsibility for securing and maintaining Company-issued hardware, including:
                    <ul>
                        <li>Laptop Serial: ${emp.assets_laptops || 'Not Issued'}</li>
                        <li>Desktop Serial: ${emp.assets_desktops || 'Not Issued'}</li>
                        <li>Mobile Serial: substituteMobiles</li>
                        <li>SIM Card Identifier: ${emp.assets_sims || 'Not Issued'}</li>
                        <li>ID Badge / Access Card: ${emp.assets_ids || emp.assets_access_cards || 'Not Issued'}</li>
                    </ul>
                </li>
                <li>All software licenses and official email accounts are company assets and must be used solely for authorized business purposes.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }


        // ── PHASE 2: EMPLOYMENT DOCUMENTS & AGREEMENTS KIT ────────────────────

        case 'Phase2_Offer_Letter': {
            const offerGross = parseFloat(emp.base_salary || gross || 0);
            const offerBasic = offerGross * 0.50;
            const offerHRA   = offerGross * 0.20;
            const offerSpl   = offerGross * 0.30;
            const fmtOfferGross = offerGross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtOfferBasic = offerBasic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtOfferHRA   = offerHRA.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtOfferSpl   = offerSpl.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const offerDate     = docDate;
            const offerDeadline = (() => {
                const d = new Date(); d.setDate(d.getDate() + 7);
                return formatToDDMMYY(d.toISOString().split('T')[0]);
            })();

            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/OL/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 2 — Offer Letter<br>
                <strong>Offer Date:</strong> ${offerDate}<br>
                <strong>Offer Valid Until:</strong> ${offerDeadline}
            </div>

            <div class="doc-title">Conditional Offer of Employment</div>

            <p>Dear Mr./Ms. <strong>${emp.full_name}</strong>,</p>
            <p>On behalf of <strong>Averion Global LLP</strong>, it is with great pleasure that we extend this Conditional Offer of Employment to you for the position of <strong>${emp.designation || 'Associate'}</strong> within the <strong>${emp.department || 'Operations'}</strong> Department. This offer is contingent upon the satisfactory completion of all pre-employment verifications, document submissions, and onboarding formalities as stipulated herein.</p>

            <h3>1. Position & Reporting</h3>
            <ul>
                <li><strong>Designation:</strong> ${emp.designation || 'Associate'}</li>
                <li><strong>Department:</strong> ${emp.department || 'Operations'}</li>
                <li><strong>Reporting To:</strong> Designated Team Lead / Managing Partner</li>
                <li><strong>Work Location:</strong> Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad — 380060</li>
                <li><strong>Proposed Joining Date:</strong> ${docDate}</li>
            </ul>

            <h3>2. Compensation Package</h3>
            <ul>
                <li>Your monthly <strong>Cost to Company (CTC)</strong> has been fixed at <strong>${fmtOfferGross}</strong> as detailed below:</li>
            </ul>
            <table class="annexure-table">
                <thead><tr><th>Salary Component</th><th>%</th><th>Monthly (INR)</th></tr></thead>
                <tbody>
                    <tr><td>Basic Salary</td><td>50%</td><td>${fmtOfferBasic}</td></tr>
                    <tr><td>House Rent Allowance (HRA)</td><td>20%</td><td>${fmtOfferHRA}</td></tr>
                    <tr><td>Special Allowance</td><td>30%</td><td>${fmtOfferSpl}</td></tr>
                    <tr style="background-color:#e2e8f0;font-weight:700;"><td>Total Gross CTC</td><td>100%</td><td>${fmtOfferGross}</td></tr>
                </tbody>
            </table>
            <ul>
                <li>Salary is disbursed on the last working day of each calendar month via bank transfer.</li>
                <li>Statutory deductions (PF, PT, TDS) will apply as per applicable Indian laws.</li>
            </ul>

            <h3>3. Probation Period</h3>
            <ul>
                <li>You will be on probation for a period of <strong>${probationMonths} (three) months</strong> from the date of joining.</li>
                <li>Upon successful completion of probation and a satisfactory performance review, your employment will be confirmed in writing.</li>
                <li>During probation, either party may terminate employment with fifteen (15) calendar days written notice.</li>
            </ul>

            <h3>4. Shift & Working Hours</h3>
            <ul>
                <li>Standard daily shift duration: <strong>9 (nine) hours</strong>, commencing at <strong>${shiftStart} IST</strong> in alignment with Australian client timezone parameters.</li>
                <li>Weekly off: <strong>Sunday</strong>. Occasional weekend shifts may be required subject to operational needs.</li>
            </ul>

            <h3>5. Acceptance & Deadline</h3>
            <ul>
                <li>This offer shall remain valid until <strong>${offerDeadline}</strong>. Non-response by this date shall render this offer null and void.</li>
                <li>To formally accept, please sign and return this letter along with the required onboarding documents.</li>
                <li>If you have any queries, contact HR at <strong>hr@averionglobal.com</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Phase2_Appointment_Letter': {
            const apptGross = parseFloat(emp.base_salary || gross || 0);
            const apptBasic = apptGross * 0.50;
            const apptHRA   = apptGross * 0.20;
            const apptSpl   = apptGross * 0.30;
            const fmtApptGross = apptGross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtApptBasic = apptBasic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtApptHRA   = apptHRA.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const fmtApptSpl   = apptSpl.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const recipientAddr = (emp.google_address && emp.google_address !== 'As per Company Records')
                ? emp.google_address : '';

            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/AL/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 2 — Appointment Letter<br>
                <strong>Date of Issue:</strong> ${docDate}
            </div>

            <div class="doc-title">Letter of Appointment</div>

            <p><strong>To,</strong><br>
            Mr./Ms. <strong>${emp.full_name}</strong><br>
            ${recipientAddr ? recipientAddr + '<br>' : ''}
            </p>

            <p>Dear Mr./Ms. <strong>${emp.full_name}</strong>,</p>
            <p>With reference to the selection process conducted and your satisfactory performance therein, we are pleased to appoint you in the capacity of <strong>${emp.designation || 'Associate'}</strong> in the <strong>${emp.department || 'Operations'}</strong> Department of <strong>Averion Global LLP</strong>, with effect from <strong>${docDate}</strong>.</p>

            <h3>1. Terms of Employment</h3>
            <ul>
                <li><strong>Designation:</strong> ${emp.designation || 'Associate'}</li>
                <li><strong>Department:</strong> ${emp.department || 'Operations'}</li>
                <li><strong>Date of Joining:</strong> ${docDate}</li>
                <li><strong>Employment Type:</strong> Full-Time, Permanent</li>
                <li><strong>Place of Work:</strong> Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad — 380060 (or as directed by Management)</li>
            </ul>

            <h3>2. Remuneration</h3>
            <ul>
                <li>Your monthly Gross CTC has been fixed at <strong>${fmtApptGross}</strong> per month.</li>
            </ul>
            <table class="annexure-table">
                <thead><tr><th>Component</th><th>Percentage</th><th>Monthly (INR)</th></tr></thead>
                <tbody>
                    <tr><td>Basic Salary</td><td>50%</td><td>${fmtApptBasic}</td></tr>
                    <tr><td>House Rent Allowance</td><td>20%</td><td>${fmtApptHRA}</td></tr>
                    <tr><td>Special Allowance</td><td>30%</td><td>${fmtApptSpl}</td></tr>
                    <tr style="background-color:#e2e8f0;font-weight:700;"><td>Gross Monthly CTC</td><td>100%</td><td>${fmtApptGross}</td></tr>
                </tbody>
            </table>

            <h3>3. Probation & Notice Period</h3>
            <ul>
                <li>You shall be on probation for <strong>${probationMonths} months</strong>. Post confirmation, the notice period shall be <strong>${noticeDays} days</strong> on either side.</li>
                <li>During probation, the notice period applicable on either side is fifteen (15) calendar days.</li>
            </ul>

            <h3>4. Shift Timings & Working Hours</h3>
            <ul>
                <li>Daily shift: <strong>9 hours</strong>, commencing at <strong>${shiftStart} IST</strong>. Weekly off: Sunday.</li>
                <li>The operational shift is aligned to Australian client timezone requirements. Strict punctuality at commencement is an absolute condition of employment.</li>
            </ul>

            <h3>5. Annual Leave Entitlement</h3>
            <ul>
                <li>You shall be entitled to <strong>${leaveQuota} days</strong> of paid annual leave per annum, accrued monthly and subject to HR approval procedures.</li>
            </ul>

            <h3>6. Governing Jurisdiction</h3>
            <ul>
                <li>This Letter of Appointment is governed by the laws of India. All disputes arising here-from shall be subject to the exclusive jurisdiction of the competent courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Phase2_Employment_Agreement': {
            const empGross  = parseFloat(emp.base_salary || gross || 0);
            const empBasic  = empGross * 0.50;
            const empHRA    = empGross * 0.20;
            const empSpl    = empGross * 0.30;
            const empPF     = empBasic * 0.12;
            const empPT     = 200;
            const empTake   = empGross - empPF - empPT;
            const fmt = (n) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/CEA/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 2 — Comprehensive Employment Agreement<br>
                <strong>Execution Date:</strong> ${docDate}
            </div>

            <div class="doc-title">Comprehensive Employment Agreement</div>
            <p>This Comprehensive Employment Agreement (<strong>"Agreement"</strong>) is executed at Ahmedabad, Gujarat, India on <strong>${docDate}</strong> by and between:</p>
            <ul>
                <li><strong>Averion Global LLP</strong>, GSTIN: 24ACMFA7488G1Z0, PAN: ACMFA7488G, having its principal place of business at Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad — 380060 (hereinafter the <strong>"Company"</strong>)</li>
                <li>Mr./Ms. <strong>${emp.full_name}</strong>${emp.google_address && emp.google_address !== 'As per Company Records' ? ', residing at ' + emp.google_address : ''} (hereinafter the <strong>"Employee"</strong>)</li>
            </ul>

            <h3>1. Designation, Department & Reporting</h3>
            <ul>
                <li>The Company appoints the Employee as <strong>${emp.designation || 'Associate'}</strong> in the <strong>${emp.department || 'Operations'}</strong> Department with effect from ${docDate}.</li>
                <li>The Employee shall report directly to the designated Supervisor / Managing Partner, or such other person as the Company may designate in writing from time to time.</li>
            </ul>

            <h3>2. Compensation, Benefits & Deductions</h3>
            <table class="annexure-table">
                <thead><tr><th>Component</th><th>%</th><th>Monthly (INR)</th></tr></thead>
                <tbody>
                    <tr><td>Basic Salary</td><td>50%</td><td>${fmt(empBasic)}</td></tr>
                    <tr><td>House Rent Allowance</td><td>20%</td><td>${fmt(empHRA)}</td></tr>
                    <tr><td>Special Allowance</td><td>30%</td><td>${fmt(empSpl)}</td></tr>
                    <tr style="background:#dbeafe;font-weight:700;"><td>Gross Monthly CTC</td><td>100%</td><td>${fmt(empGross)}</td></tr>
                    <tr><td>Provident Fund (Employee 12%)</td><td>—</td><td>(${fmt(empPF)})</td></tr>
                    <tr><td>Professional Tax</td><td>—</td><td>(${fmt(empPT)})</td></tr>
                    <tr style="background:#dcfce7;font-weight:700;"><td>Estimated Net Take-Home</td><td>—</td><td>${fmt(empTake)}</td></tr>
                </tbody>
            </table>
            <ul>
                <li>Salary is credited on the last working day of each month. Payslips shall be issued digitally.</li>
                <li>All statutory contributions (EPF, ESIC, PT, TDS) are deducted at source per applicable law.</li>
                <li>Gratuity is applicable post five (5) years of continuous service per the Payment of Gratuity Act 1972.</li>
            </ul>

            <h3>3. Probation & Confirmation</h3>
            <ul>
                <li>The Employee shall serve a probation period of <strong>${probationMonths} months</strong>. During probation, notice period is <strong>15 calendar days</strong> on either side.</li>
                <li>Post confirmation, notice period escalates to <strong>${noticeDays} days</strong> from either party, submitted in writing.</li>
                <li>The Company reserves the right to terminate employment without notice or payment in lieu during probation upon cause.</li>
            </ul>

            <h3>4. Shift Schedule & Work Hours</h3>
            <ul>
                <li>Standard shift: <strong>9 (nine) hours daily</strong> commencing strictly at <strong>${shiftStart} IST</strong>, aligned to Australian client operational timezone.</li>
                <li>Weekly off: <strong>Sunday</strong>. Work on holidays or Sundays may be required subject to business demands.</li>
                <li>Annual paid leave entitlement: <strong>${leaveQuota} days</strong> accruing monthly.</li>
            </ul>

            <h3>5. Confidentiality, NDA & IP Assignment</h3>
            <ul>
                <li>All client databases, CRM records, pricing sheets, business proposals, technical outputs, and any deliverables created in scope of employment are the exclusive IP of the Company.</li>
                <li>The Employee shall maintain strict confidentiality of all proprietary information during and post employment.</li>
                <li>Any breach of confidentiality shall attract legal action under IPC Section 408 and IT Act Sections 43 & 66.</li>
            </ul>

            <h3>6. Exclusivity & Anti-Moonlighting</h3>
            <ul>
                <li>The Employee shall not engage in any parallel employment, freelancing, consulting, or business activity during the term of employment without explicit written consent from the Company.</li>
                <li>Client solicitation or poaching for personal or competitor benefit is strictly prohibited.</li>
            </ul>

            <h3>7. Termination</h3>
            <ul>
                <li>The Company may terminate this Agreement immediately for cause (gross misconduct, IP theft, regulatory breach, etc.) without notice or compensation.</li>
                <li>Voluntary resignation requires submission of written notice adhering to the applicable notice period.</li>
                <li>All company assets must be returned in full on the last working day. Salary clearance is subject to asset return and exit formalities.</li>
            </ul>

            <h3>8. Governing Law & Dispute Resolution</h3>
            <ul>
                <li>This Agreement is governed by the laws of the Republic of India.</li>
                <li>All disputes shall be resolved via binding arbitration at Ahmedabad under the Arbitration and Conciliation Act 1996.</li>
                <li>The exclusive jurisdiction of all disputes under this Agreement is vested in the competent courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Phase2_Internship_Contract': {
            const internStipend  = parseFloat(emp.stipend_amount || emp.base_salary || 15000);
            const fmtStipend     = internStipend.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const internDuration = 6; // months — strictly fixed per company policy
            const internEndDate  = (() => {
                const d = emp.onboarding_date ? new Date(emp.onboarding_date) : new Date();
                d.setMonth(d.getMonth() + internDuration);
                return formatToDDMMYY(d.toISOString().split('T')[0]);
            })();

            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/IC/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 2 — 6-Month Internship / Apprenticeship Contract<br>
                <strong>Commencement Date:</strong> ${docDate}<br>
                <strong>Internship End Date:</strong> ${internEndDate}
            </div>

            <div class="doc-title">6-Month Internship / Apprenticeship Contract</div>

            <p>This Internship/Apprenticeship Contract (<strong>"Contract"</strong>) is entered into at Ahmedabad, Gujarat on <strong>${docDate}</strong> between:</p>
            <ul>
                <li><strong>Averion Global LLP</strong>, having its principal office at Shop 2, Sthapatya Residency, Nr. Nayara Petrol Pump, SP Ring Road, Ognaj, Ahmedabad — 380060 (hereinafter <strong>"the Company"</strong>)</li>
                <li>Mr./Ms. <strong>${emp.full_name}</strong> (hereinafter <strong>"the Intern"</strong>)</li>
            </ul>

            <h3>1. Internship Role & Duration</h3>
            <ul>
                <li><strong>Role:</strong> ${emp.designation || 'Intern — Sales & Operations'}</li>
                <li><strong>Department:</strong> ${emp.department || 'Operations'}</li>
                <li><strong>Duration:</strong> Strictly <strong>${internDuration} (six) months</strong>, non-extendable unless a separate written agreement is executed.</li>
                <li><strong>Commencement:</strong> ${docDate}</li>
                <li><strong>Scheduled End:</strong> ${internEndDate}</li>
            </ul>

            <h3>2. Monthly Stipend</h3>
            <ul>
                <li>The Intern shall be entitled to a fixed monthly stipend of <strong>${fmtStipend}</strong>.</li>
                <li>The Company's standard stipend scale for interns ranges from <strong>Rs 15,000 to Rs 25,000</strong> per month, determined based on profile, skill set, and role requirements.</li>
                <li>Stipend is disbursed on the last working day of each month via bank transfer. Interns are not entitled to PF, Gratuity, or statutory benefits unless mandated by applicable law.</li>
                <li>Stipend shall be withheld for unauthorized absences or abandonment of duties without intimation.</li>
            </ul>

            <h3>3. Shift Hours & Attendance</h3>
            <ul>
                <li>Shift duration: <strong>9 hours daily</strong>, commencing at <strong>${shiftStart} IST</strong> in alignment with Australian client timezone parameters.</li>
                <li>Weekly off: <strong>Sunday</strong>. Attendance is mandatory on all working days. Biometric / HRMS punch-in is compulsory from Day 1.</li>
                <li>Interns are entitled to <strong>12 days of casual leave</strong> during the 6-month tenure, subject to supervisor approval.</li>
            </ul>

            <h3>4. Evaluation & Conversion to Employment</h3>
            <ul>
                <li>Performance of the Intern shall be evaluated at the end of Month 3 (Mid-Review) and Month 6 (Final Review).</li>
                <li>Conversion to a permanent employment role is <strong>not guaranteed</strong> and is solely at the Company's discretion based on performance, vacancies, and business needs.</li>
                <li>In the event of conversion, the Employee will undergo a fresh 3-month probation period, and all terms of the Employment Agreement shall apply anew.</li>
            </ul>

            <h3>5. Confidentiality & IP Assignment</h3>
            <ul>
                <li>All work product, code, designs, data, client interactions, and communications produced by the Intern during the internship remain the exclusive property of the Company.</li>
                <li>The Intern shall not disclose, share, or leak any proprietary or client-related information to any third party during or after the internship.</li>
                <li>Breach of this clause constitutes grounds for immediate termination and legal proceedings under IT Act Sections 43 & 66 and IPC Section 408.</li>
            </ul>

            <h3>6. Exclusivity & Conduct</h3>
            <ul>
                <li>The Intern shall not engage in parallel internships, freelancing assignments, or competitive activities during the tenure of this Contract without prior written approval.</li>
                <li>The Intern agrees to abide by all Company policies, including the Mobile Device, Rest Breaks, and Workplace Surveillance policies.</li>
            </ul>

            <h3>7. Early Termination</h3>
            <ul>
                <li>Either party may terminate this Contract with <strong>7 (seven) calendar days</strong> written notice.</li>
                <li>The Company reserves the right to terminate this Contract immediately and without notice in cases of gross misconduct, absenteeism, IP misappropriation, or breach of any clause herein.</li>
            </ul>

            <h3>8. Jurisdiction</h3>
            <ul>
                <li>This Contract is governed by the laws of India. All disputes shall be subject to the exclusive jurisdiction of the competent courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        // ── PHASE 3: WORKSPACE SAFETY, CONFIDENTIALITY & SECURITY KIT ────────────────────
        case 'Phase3_Mobile_Phone_Policy':
        case 'Mobile_Phone_Policy': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/MPP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 3 — Workspace Safety & Security Kit<br>
                <strong>Date of Issue:</strong> ${docDate}
            </div>

            <div class="doc-title">Mobile Phone & VoIP Communications Policy</div>
            <p>This Policy outlines the regulations regarding the use of personal mobile devices, official SIM cards, and VoIP telephony systems at <strong>Averion Global LLP</strong>, applicable to the Employee Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Personal Device Restrictions & Early Shift Startup</h3>
            <ul>
                <li>The Company's operational shift commences strictly at <strong>${shiftStart} IST</strong> in alignment with Australian timezone client parameters. Personal smartphones and communication devices are strictly restricted during active work hours.</li>
                <li>Employees are required to store personal mobile phones in designated lockers or silent mode in bags upon shift commencement. Accessing personal mobile devices during operational hours without prior supervisor approval is prohibited.</li>
            </ul>

            <h3>2. Official VoIP Systems & Telephony Logs</h3>
            <ul>
                <li>All business communications, client outreach, and vendor negotiations must be conducted strictly through the Company's authorized VoIP telephony networks.</li>
                <li>All calls, chats, and interactions on Company VoIP software are programmatically tracked, recorded, and audited for quality assurance and security compliance.</li>
                <li>Any misuse of VoIP accounts, unauthorized long-distance personal calls, or deletion of communication logs constitutes a major security violation.</li>
            </ul>

            <h3>3. Mobile Assets & SIM Card Responsibility</h3>
            <ul>
                <li>In the event that the Company allocates a corporate mobile device or SIM card to the Employee:
                    <ul>
                        <li><strong>Assigned Mobile Serial:</strong> ${emp.assets_mobiles || 'Not Issued'}</li>
                        <li><strong>Assigned SIM Identifier:</strong> ${emp.assets_sims || 'Not Issued'}</li>
                    </ul>
                </li>
                <li>The corporate device and SIM must be utilized exclusively for Company business. De-routing or removing the MDM (Mobile Device Management) security locks is strictly prohibited.</li>
            </ul>

            <h3>4. Enforcement & Ahmedabad Jurisdiction</h3>
            <ul>
                <li>Violations of this policy will attract immediate disciplinary action, including suspension and termination for cause.</li>
                <li>This policy is governed by the laws of India, and all dispute resolution and legal paths shall be locked exclusively to the competent courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Phase3_Rest_Breaks_Policy':
        case 'Rest_Breaks_Policy': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/RBP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 3 — Workspace Safety & Security Kit<br>
                <strong>Date of Issue:</strong> ${docDate}
            </div>

            <div class="doc-title">Rest Breaks & Shift Interval Policy</div>
            <p>This policy details the operational shift schedules, rest intervals, and timesheet logging guidelines at <strong>Averion Global LLP</strong>, structured in compliance with the Gujarat Shops and Establishments (Regulation of Employment and Conditions of Service) Act.</p>

            <h3>1. Shift Structure & Break Allotment</h3>
            <ul>
                <li>The standard daily shift length for all full-time employees and interns is <strong>9 (nine) hours</strong>, commencing at <strong>${shiftStart} IST</strong>.</li>
                <li>Within this 9-hour operational period, Employees are entitled to a cumulative rest interval limit of <strong>1 (one) hour</strong>, comprising one lunch break (40 minutes) and tea/refreshment breaks (20 minutes total).</li>
            </ul>

            <h3>2. Automated Timesheet Punching & Clock Controls</h3>
            <ul>
                <li><strong>Log-in & Log-out:</strong> Employees must punch in their arrival and departure through the HRMS platform and biometric scanner. All rest breaks must be actively logged via the "Break-In" and "Break-Out" controls on the system.</li>
                <li>Failure to punch break intervals or exceeding the cumulative 1-hour break limit will trigger automated timesheet flags, leading to payroll reconciliation or leave deductions.</li>
                <li>Punctual return from rest breaks is mandatory. Unauthorized extension of breaks will be treated as non-compliance and absence from duty.</li>
            </ul>

            <h3>3. Statutory Compliance</h3>
            <ul>
                <li>This break policy is designed in strict compliance with Section 13 of the Gujarat Shops and Establishments Act, ensuring no continuous work period exceeds five (5) hours without an interval of at least thirty (30) minutes.</li>
                <li>For interns, the same shift breaks and compliance structures apply.</li>
            </ul>

            <h3>4. Disciplinary Jurisdiction</h3>
            <ul>
                <li>Continuous non-compliance with break schedules will result in formal warning letters and forfeiture of attendance incentives.</li>
                <li>Any dispute arising out of timesheet calculations, break deductions, or compliance metrics shall be subject strictly to the courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        case 'Phase3_Data_Protection_Policy':
        case 'Data_Protection_Policy': {
            innerContent = `
            <div style="font-size: 11px; text-align: right; color: #64748b; margin-bottom: 20px;">
                <strong>Doc ID:</strong> AVG/HR/DPP/${emp.employee_id || '999'}<br>
                <strong>Category:</strong> Phase 3 — Workspace Safety & Security Kit<br>
                <strong>Date of Issue:</strong> ${docDate}
            </div>

            <div class="doc-title">Data Protection, Confidentiality & Anti-Moonlighting Covenant</div>
            <p>This Covenant establishes the binding terms governing data security, intellectual property, confidentiality, and anti-moonlighting restrictions at <strong>Averion Global LLP</strong>, applicable to the Employee Mr./Ms. <strong>${emp.full_name}</strong>.</p>

            <h3>1. Airtight Non-Disclosure Controls</h3>
            <ul>
                <li><strong>Confidential Information</strong> includes, but is not limited to, client solar lead databases, customer lists, pricing tables, CRM records, proprietary proposal calculators, sales scripts, internal reports, and company strategies.</li>
                <li>The Employee is strictly prohibited from exporting, downloading, copying, screenshotting, or sharing any confidential information to personal email accounts, storage devices, or cloud platforms.</li>
                <li>All customer database assets and vendor communications remain the exclusive property of the Company.</li>
            </ul>

            <h3>2. Intellectual Property (IP) & Non-Solicitation</h3>
            <ul>
                <li>Any deliverables, proposal templates, solar layout designs, outreach campaigns, or software code designed by the Employee during active hours belong solely to the Company.</li>
                <li>The Employee covenants that they shall not solicit, poach, contact, or service any client, customer, or lead of the Company for personal gains or on behalf of any third-party competitor.</li>
            </ul>

            <h3>3. Airtight Anti-Moonlighting Covenant</h3>
            <ul>
                <li>The Employee shall devote their entire professional capacity exclusively to the business of the Company.</li>
                <li><strong>Dual Employment Prohibited:</strong> The Employee is strictly barred from engaging in any secondary employment, parallel freelancing, consulting, teaching, or starting an independent business (whether paid, unpaid, direct, or indirect) during the tenure of their contract.</li>
            </ul>

            <h3>4. Statutory Violations & Severe Legal Penalties</h3>
            <ul>
                <li>Any database theft, customer data leakage, or extraction of CRM records constitutes a criminal breach of trust and theft.</li>
                <li>The Company shall initiate immediate termination for cause and criminal prosecution under <strong>Section 408 of the Indian Penal Code (IPC)</strong> for breach of trust by an employee.</li>
                <li>Furthermore, unauthorized access, copying, or damage to computer networks and lead databases will be prosecuted under <strong>Section 43 & Section 66 of the Information Technology Act, 2000</strong>.</li>
                <li>All legal recourses, damage claims, and injunctive actions shall be resolved exclusively within the jurisdiction of the competent courts of <strong>Ahmedabad, Gujarat</strong>.</li>
            </ul>

            ${signHtml}
            `;
            break;
        }

        default:
            innerContent = `<div class="doc-title">${category.replace(/_/g, ' ')}</div><p>Standard compliance guidelines.</p>${signHtml}`;
            break;
    }

    return wrapInHTMLFrame(innerContent, category.substring(0, 5).toUpperCase(), emp, logoBase64);
}

// ── GENERATE PHASE-WISE HR DOCUMENTS (POST) ──────────────────────────────
router.post('/generate-phase-docs', requireAuth, (req, res) => {
    const { employee_id, document_type } = req.body;
    if (!employee_id || !document_type) {
        return res.status(400).json({ error: 'Missing employee_id or document_type' });
    }

    getFullEmployeeDetails(employee_id, (detailsErr, empDetails) => {
        if (detailsErr) return res.status(500).json({ error: detailsErr.message });

        db.get("SELECT * FROM averion_corporate_registry LIMIT 1", [], (regErr, registry) => {
            if (regErr) return res.status(500).json({ error: regErr.message });

            const compiledHtml = compilePhaseDoc(document_type, empDetails, registry);

            db.get(
                `SELECT id FROM legal_signed_documents WHERE employee_id = ? AND (document_type = ? OR document_category_type = ?)`,
                [employee_id.toString(), document_type, document_type],
                (checkErr, docRow) => {
                    if (checkErr) return res.status(500).json({ error: checkErr.message });

                    if (!docRow) {
                        db.run(
                            `INSERT INTO legal_signed_documents 
                             (employee_id, document_type, document_category_type, signed_status, generated_blob_text, generated_text_payload, compiled_html_payload, email_sent_status) 
                             VALUES (?, ?, ?, 0, ?, ?, ?, 0)`,
                            [employee_id.toString(), document_type, document_type, compiledHtml, compiledHtml, compiledHtml],
                            function(insErr) {
                                if (insErr) return res.status(500).json({ error: insErr.message });
                                res.json({ success: true, document_type, generated_text_payload: compiledHtml });
                            }
                        );
                    } else {
                        db.run(
                            `UPDATE legal_signed_documents 
                             SET generated_blob_text = ?, generated_text_payload = ?, compiled_html_payload = ?, document_category_type = ?
                             WHERE id = ?`,
                            [compiledHtml, compiledHtml, compiledHtml, document_type, docRow.id],
                            function(updErr) {
                                if (updErr) return res.status(500).json({ error: updErr.message });
                                res.json({ success: true, document_type, generated_text_payload: compiledHtml });
                            }
                        );
                    }
                }
            );
        });
    });
});

// ── DISPATCH COMPLIANCE EMAIL (POST) ──────────────────────────────
router.post('/dispatch-document-email', requireAuth, (req, res) => {
    const { employee_id, document_type } = req.body;
    if (!employee_id || !document_type) {
        return res.status(400).json({ error: 'employee_id and document_type are required' });
    }

    db.get(
        `SELECT * FROM legal_signed_documents WHERE employee_id = ? AND (document_type = ? OR document_category_type = ?)`,
        [employee_id.toString(), document_type, document_type],
        (err, doc) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!doc) return res.status(404).json({ error: 'Document not found. Please compile/generate documents first.' });

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

                let docTitle = document_type.replace(/_/g, ' ');
                if (document_type === 'Category_B') docTitle = 'Employment Agreement / Appointment Letter';
                else if (document_type === 'Category_A') docTitle = 'Master HR Policy Manual';
                else if (document_type === 'Category_H') docTitle = 'Target-Based Sales Incentive Policy';
                else if (document_type === 'Category_C') docTitle = 'Comprehensive NDA & Moonlighting Covenant';
                else if (document_type === 'Category_F_L') docTitle = 'Workplace Surveillance & Assets Policy';
                else if (document_type === 'Phase3_Mobile_Phone_Policy' || document_type === 'Mobile_Phone_Policy') docTitle = 'Mobile & Phone Policy';
                else if (document_type === 'Phase3_Rest_Breaks_Policy' || document_type === 'Rest_Breaks_Policy') docTitle = 'Rest Breaks Policy';
                else if (document_type === 'Phase3_Data_Protection_Policy' || document_type === 'Data_Protection_Policy') docTitle = 'Data Protection Policy';

                const mailOptions = {
                    from: config.email.from || `"Averion Global LLP" <${config.email.user}>`,
                    to: worker.email,
                    subject: `${docTitle} - Averion Compliance Management`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; color: #334155; line-height: 1.6; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #0078C1; margin-top: 0; border-bottom: 2px solid #0078C1; padding-bottom: 8px;">Averion Global LLP</h2>
                            <p>Dear ${worker.first_name || 'Employee'},</p>
                            <p>Please find attached your official Category Compliance Document: <strong>${docTitle}</strong>.</p>
                            <p>You are required to review the attached policy and acknowledge it within your compliance dashboard.</p>
                            <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0;">
                            <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">This is an automated operational notification from Averion HR. Please do not reply directly to this email.</p>
                        </div>
                    `,
                    attachments: [{
                        filename: `${document_type}_Compliance.html`,
                        content: doc.compiled_html_payload || doc.generated_text_payload || doc.generated_blob_text
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

