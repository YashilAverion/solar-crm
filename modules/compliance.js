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
        db.get('SELECT * FROM employee_compliance_profiles WHERE employee_id = ?', [employeeId.toString()], (profileErr, profile) => {
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
        case 'Appointment_Letter':
            const isIntern = (emp.designation || '').toLowerCase().includes('intern');
            const probationMonths = isIntern ? 6 : (emp.probation_period_months || 3);
            const noticeDays = emp.notice_period_days || 45;

            const appointmentContent = `
            <div class="doc-title">Letter of Appointment</div>
            <p><strong>Date:</strong> ${today}</p>
            <p><strong>Employee Code:</strong> ${emp.employee_id}</p>
            
            <p>To,<br>
            <strong>Mr./Ms. ${emp.full_name}</strong><br>
            ${emp.google_address || 'As per Company Records'}</p>
            
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
            
            <table class="annexure-table">
              <thead>
                <tr>
                  <th>Bank Account Details</th>
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
            return wrapInHTMLFrame(appointmentContent, 'APT', emp, logoBase64);

        default:
            // Fallback for other documents, wrap in HTML frame for consistent styling
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
        case 'Employment_Agreement':
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

        case 'Mobile_Phone_Policy':
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

        case 'Rest_Breaks_Policy':
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

        case 'Data_Protection_Policy':
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

        case 'Employee_Leave_Guide':
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

module.exports = router;
