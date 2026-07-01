function getComplianceDocHTML(docType, emp) {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // CTC calculations
    const basic = parseFloat(emp.basic_salary) || 0;
    const hra = parseFloat(emp.hra) || 0;
    const sa = parseFloat(emp.special_allowance) || 0;
    const gross = basic + hra + sa;
    const annualGross = gross * 12;
    
    const formattedBasic = basic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedHra = hra.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedSa = sa.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedGross = gross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedAnnualGross = annualGross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    
    let docTitle = "";
    let contentHTML = "";
    
    switch(docType) {
        case 'offer_letter':
            docTitle = "EMPLOYMENT AGREEMENT & OFFER LETTER";
            contentHTML = `
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>Regd. Office: Gujarat, India | Email: hr@averionglobal.co.in</p>
                    <hr/>
                </div>
                <div class="doc-meta">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>To,</strong><br/>
                       <strong>${emp.first_name} ${emp.middle_name ? emp.middle_name + ' ' : ''}${emp.last_name}</strong><br/>
                       Address: ${emp.google_address || 'As per record'}<br/>
                       Mobile: ${emp.mobile_number || 'N/A'}</p>
                </div>
                
                <h3 class="doc-subject">Subject: Offer of Employment as ${emp.job_title || 'Employee'}</h3>
                
                <p>Dear ${emp.first_name},</p>
                <p>We are pleased to offer you employment with <strong>Averion Global LLP</strong> (the "Company") on the terms and conditions outlined below. Your employment will start on <strong>${emp.start_date || today}</strong>.</p>
                
                <h4>1. Role and Responsibilities</h4>
                <p>You will be employed in the position of <strong>${emp.job_title || 'Employee'}</strong>. Your duties and responsibilities will be those standard for this role, as well as any other duties assigned by the management from time to time.</p>
                
                <h4>2. Compensation and CTC Breakdown</h4>
                <p>Your Gross Monthly Salary (Cost to Company) will be <strong>${formattedGross}</strong> (Rupees equivalent), representing an annual CTC of <strong>${formattedAnnualGross}</strong>. Your salary will be bifurcated as follows under Indian Income Tax guidelines:</p>
                
                <table class="ctc-table">
                    <thead>
                        <tr>
                            <th>Salary Component</th>
                            <th>Monthly Amount (INR)</th>
                            <th>Annual Amount (INR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Salary (50%)</td>
                            <td>${formattedBasic}</td>
                            <td>${(basic * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr>
                            <td>House Rent Allowance (HRA - 20%)</td>
                            <td>${formattedHra}</td>
                            <td>${(hra * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr>
                            <td>Special Allowance (30%)</td>
                            <td>${formattedSa}</td>
                            <td>${(sa * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr class="total-row">
                            <td>Gross Salary / Total CTC</td>
                            <td>${formattedGross}</td>
                            <td>${formattedAnnualGross}</td>
                        </tr>
                    </tbody>
                </table>
                <p><em>* Deductions for Provident Fund (EPF), ESIC, and Professional Tax (PT) will be applied monthly as per statutory opt-in declarations.</em></p>
                
                <h4>3. Probationary Period</h4>
                <p>You will be on probation for a period of six (6) months from your start date. The Company may extend the probationary period at its sole discretion. Upon successful completion of probation, your services will be confirmed in writing.</p>
                
                <h4>4. Termination and Notice Period</h4>
                <p>During the probationary period, either party may terminate this agreement by giving fifteen (15) days written notice. Upon confirmation, the notice period will be thirty (30) days or basic salary in lieu thereof, subject to management approval.</p>
            `;
            break;
            
        case 'phone_policy':
            docTitle = "MOBILE DEVICE & OFFICE PHONE USE POLICY";
            contentHTML = `
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>Compliance Department | HR Policies & Guidelines</p>
                    <hr/>
                </div>
                
                <h3>1. Purpose</h3>
                <p>This policy outlines the guidelines for using personal mobile devices and company-provided telecommunication lines during business hours at Averion Global LLP. It is designed to ensure work productivity, prevent data leakage, and maintain professional workspace decorum.</p>
                
                <h3>2. Policy Guidelines</h3>
                <ul>
                    <li><strong>Business Hours Restriction:</strong> Employees are expected to limit personal mobile usage to scheduled breaks (lunch/tea breaks) only. Excessive personal calls, messaging, or social media browsing during work hours is strictly prohibited.</li>
                    <li><strong>Ringer Volume:</strong> Personal mobile phones must be kept on "Silent" or "Vibrate" mode at all times inside the office premises.</li>
                    <li><strong>Company Phone Lines:</strong> Company VoIP and desk lines must be used strictly for business-related client communication. Personal long-distance calls on company assets are forbidden.</li>
                    <li><strong>Security & Privacy:</strong> Employees must not use mobile cameras or recording tools within active CRM operations bays to protect lead confidentiality.</li>
                </ul>
                
                <h3>3. Disciplinary Actions</h3>
                <p>Violations of this policy will result in formal warning letters. Continuous non-compliance will lead to suspension, withholding of incentives, and/or termination of service.</p>
            `;
            break;
            
        case 'break_policy':
            docTitle = "REST BREAKS & WORK SCHEDULING POLICY";
            contentHTML = `
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>Indian Labor Standards Compliance (Shops & Establishments Regulations)</p>
                    <hr/>
                </div>
                
                <h3>1. Work Shift Structure</h3>
                <p>Standard working hours at Averion Global LLP are nine (9) hours per day, including a scheduled break period. Working shifts are structured in compliance with state Shop & Establishment laws.</p>
                
                <h3>2. Mandatory Rest Interval</h3>
                <ul>
                    <li><strong>Rest Break:</strong> In accordance with statutory rules, no employee shall be required to work for more than five (5) consecutive hours without a rest interval of at least thirty (30) minutes.</li>
                    <li><strong>Break Durations:</strong> Employees are allocated one (1) main lunch break of 30 minutes, and two (2) short tea breaks of 10 minutes each.</li>
                    <li><strong>Logging Break Times:</strong> All rest breaks must be correctly logged in the Solar CRM Timesheet module. Failure to log breaks or working through mandatory rest intervals is a compliance violation.</li>
                </ul>
                
                <h3>3. Scheduling and Coordination</h3>
                <p>Breaks must be coordinated within team divisions to ensure client support lines remain adequately staffed. Team leads will approve break schedules daily.</p>
            `;
            break;
            
        case 'data_theft':
            docTitle = "DATA PROTECTION, NON-DISCLOSURE & PENAL CONSEQUENCES";
            contentHTML = `
                <div class="letterhead">
                    <h2 style="color: #ef4444;">AVERION GLOBAL LLP</h2>
                    <p style="font-weight: 700; color: #ef4444;">STRICT CONFIDENTIALITY & CRM DATA PROTECTION POLICY</p>
                    <hr/>
                </div>
                
                <div class="warning-box">
                    <strong>CRITICAL COMPLIANCE NOTICE:</strong> Averion Global LLP enforces a ZERO-TOLERANCE policy for data theft, lead poaching, client database exporting, or sharing confidential company trade secrets.
                </div>
                
                <h3>1. Definition of Confidential Material</h3>
                <p>Confidential material includes, but is not limited to, client names, phone numbers, email addresses, lead lists, solar proposal coordinates, pricing tables, sales scripts, internal dashboards, and CRM login credentials.</p>
                
                <h3>2. Strict Prohibitions</h3>
                <ul>
                    <li><strong>No External Copying:</strong> Employees are strictly forbidden from downloading, exporting, copying, photographing, screenshotting, or writing down lead databases for personal use or external sharing.</li>
                    <li><strong>No Forwarding:</strong> Forwarding official emails, database exports, or report attachments to personal email accounts is strictly banned.</li>
                    <li><strong>No CRM Sharing:</strong> CRM user profiles are unique. Sharing credentials or allowing unauthorized persons access to CRM records is a direct violation.</li>
                </ul>
                
                <h3>3. Legal and Penal Consequences (Indian Laws)</h3>
                <p>In the event of a breach of this policy or data theft, the Company will initiate immediate termination and take strict legal action under the following statutes:</p>
                
                <table class="legal-table">
                    <thead>
                        <tr>
                            <th>Statute / Section</th>
                            <th>Nature of Offence</th>
                            <th>Maximum Penalty / Consequence</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Section 43 & 66, IT Act 2000</strong></td>
                            <td>Unauthorized computer access, downloading/extracting data, and database hacking.</td>
                            <td>Criminal liability, imprisonment up to 3 years, and compensation/fine up to ₹5 Lakhs.</td>
                        </tr>
                        <tr>
                            <td><strong>Section 408, Indian Penal Code</strong></td>
                            <td>Criminal breach of trust by clerk, worker, or employee.</td>
                            <td>Non-bailable warrant, imprisonment up to 7 years, and mandatory fine.</td>
                        </tr>
                        <tr>
                            <td><strong>Civil Recovery Suit</strong></td>
                            <td>Loss of business, lead poaching, and breach of Non-Disclosure Agreement.</td>
                            <td>Civil suit for full financial recovery of direct and consequential damages.</td>
                        </tr>
                    </tbody>
                </table>
            `;
            break;
            
        case 'leave_policy':
            docTitle = "EMPLOYEE LEAVE RULES & ENTILEMENT GUIDE";
            contentHTML = `
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>Indian HR Operations & Leave Regulations</p>
                    <hr/>
                </div>
                
                <h3>1. Leave Entitlement Slabs</h3>
                <p>Employees of Averion Global LLP are eligible for the following leave categories on a calendar-year basis (pro-rated from start date):</p>
                
                <ul>
                    <li><strong>Earned Leave / Privilege Leave (EL/PL):</strong> Eligible for pro-rated days based on active service. Accrued PL can be carried forward up to a maximum of 30 days. Accrued PL is eligible for encashment upon separation.</li>
                    <li><strong>Casual Leave (CL):</strong> Designed for urgent personal matters. CL cannot be combined with PL, and unused CL lapses automatically at the end of the year (no carry-forward, no encashment).</li>
                    <li><strong>Sick Leave (SL):</strong> Eligible for health/medical issues. Medical certificates are mandatory for SL extending beyond two (2) consecutive days. Unused SL lapses at year-end.</li>
                    <li><strong>Maternity Leave (ML):</strong> In accordance with the Maternity Benefit Act, eligible female employees are entitled to 26 weeks of paid maternity leave.</li>
                </ul>
                
                <h3>2. Approval Process</h3>
                <p>All leaves must be requested through the Solar CRM Portal at least seven (7) days in advance, except in emergencies (CL/SL). Taking leaves without approval will be treated as Unauthorised Absence (LWP) and will result in salary deductions.</p>
            `;
            break;
            
        case 'package':
            return getCombinedPackageHTML(emp);
    }
    
    return wrapInDocumentBoilerplate(docTitle, contentHTML, emp);
}

function wrapInDocumentBoilerplate(docTitle, contentHTML, emp) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${docTitle} - ${emp.first_name} ${emp.last_name}</title>
            <style>
                body {
                    font-family: 'Outfit', 'Inter', sans-serif;
                    color: #1e293b;
                    line-height: 1.6;
                    padding: 40px;
                    background: #fff;
                    margin: 0;
                    font-size: 14px;
                }
                .letterhead {
                    text-align: center;
                    margin-bottom: 24px;
                }
                .letterhead h2 {
                    margin: 0;
                    font-size: 24px;
                    color: #0f172a;
                    letter-spacing: 1px;
                }
                .letterhead p {
                    margin: 4px 0 0 0;
                    font-size: 11px;
                    color: #64748b;
                    text-transform: uppercase;
                }
                .doc-meta {
                    margin-bottom: 24px;
                    font-size: 13px;
                }
                .doc-subject {
                    text-align: center;
                    text-decoration: underline;
                    margin-bottom: 24px;
                    font-size: 16px;
                    color: #0f172a;
                }
                h3, h4 {
                    color: #0f172a;
                    margin-top: 24px;
                    margin-bottom: 10px;
                }
                p, ul, ol {
                    margin-bottom: 14px;
                    text-align: justify;
                }
                li {
                    margin-bottom: 8px;
                }
                .ctc-table, .legal-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                .ctc-table th, .ctc-table td, .legal-table th, .legal-table td {
                    border: 1px solid #cbd5e1;
                    padding: 10px 12px;
                    text-align: left;
                }
                .ctc-table th, .legal-table th {
                    background: #f8fafc;
                    font-weight: 700;
                }
                .total-row {
                    font-weight: 700;
                    background: #f1f5f9;
                }
                .warning-box {
                    border-left: 4px solid #ef4444;
                    background: #fef2f2;
                    padding: 12px;
                    margin: 20px 0;
                    color: #991b1b;
                    font-size: 13px;
                }
                .sign-section {
                    margin-top: 60px;
                    display: flex;
                    justify-content: space-between;
                }
                .sign-block {
                    width: 250px;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 8px;
                    text-align: center;
                    font-size: 13px;
                    font-weight: 600;
                }
                @media print {
                    @page {
                        margin: 0;
                    }
                    body {
                        padding: 0;
                    }
                    .page {
                        padding: 1.2cm;
                        box-sizing: border-box;
                        min-height: auto;
                    }
                    .no-print {
                        display: none;
                    }
                    .letterhead-header {
                        margin-bottom: 20px !important;
                        padding-bottom: 10px !important;
                    }
                    .doc-title {
                        margin: 15px 0 10px 0 !important;
                    }
                    h3 {
                        margin-top: 15px !important;
                        margin-bottom: 8px !important;
                        padding-bottom: 2px !important;
                    }
                    p, li {
                        margin-bottom: 6px !important;
                    }
                    ol, ul {
                        margin-top: 2px !important;
                    }
                    .annexure-table {
                        margin-top: 8px !important;
                        margin-bottom: 12px !important;
                    }
                    .annexure-table th, .annexure-table td {
                        padding: 6px 10px !important;
                    }
                    .sign-container {
                        margin-top: 25px !important;
                    }
                    .sign-line {
                        height: 40px !important;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    tr, li, .sign-container, .sign-box, .sign-block {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #0078C1; color: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" onclick="window.print()">
                🖨️ Print / Save as PDF
            </div>
            
            ${contentHTML}
            
            <div class="sign-section">
                <div class="sign-block">
                    For Averion Global LLP<br/>
                    <span style="font-size:11px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">Authorized Signatory</span>
                </div>
                <div class="sign-block">
                    Accepted By Employee<br/>
                    <span style="font-size:11px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">(${emp.first_name} ${emp.last_name})</span>
                </div>
            </div>
            
            <script>
                setTimeout(() => {
                    window.print();
                }, 500);
            </script>
        </body>
        </html>
    `;
}

function getCombinedPackageHTML(emp) {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // CTC calculations
    const basic = parseFloat(emp.basic_salary) || 0;
    const hra = parseFloat(emp.hra) || 0;
    const sa = parseFloat(emp.special_allowance) || 0;
    const gross = basic + hra + sa;
    const annualGross = gross * 12;
    
    const formattedBasic = basic.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedHra = hra.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedSa = sa.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedGross = gross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formattedAnnualGross = annualGross.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>HR Compliance Package - ${emp.first_name} ${emp.last_name}</title>
            <style>
                body {
                    font-family: 'Outfit', 'Inter', sans-serif;
                    color: #1e293b;
                    line-height: 1.6;
                    padding: 40px;
                    background: #fff;
                    margin: 0;
                    font-size: 13px;
                }
                .page {
                    page-break-after: always;
                    position: relative;
                    min-height: 900px;
                }
                .page:last-child {
                    page-break-after: avoid;
                }
                .letterhead {
                    text-align: center;
                    margin-bottom: 24px;
                }
                .letterhead h2 {
                    margin: 0;
                    font-size: 24px;
                    color: #0f172a;
                    letter-spacing: 1px;
                }
                .letterhead p {
                    margin: 4px 0 0 0;
                    font-size: 11px;
                    color: #64748b;
                    text-transform: uppercase;
                }
                .doc-meta {
                    margin-bottom: 24px;
                }
                .doc-subject {
                    text-align: center;
                    text-decoration: underline;
                    margin-bottom: 24px;
                    font-size: 15px;
                    color: #0f172a;
                }
                h3, h4 {
                    color: #0f172a;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                p, ul, ol {
                    margin-bottom: 12px;
                    text-align: justify;
                }
                li {
                    margin-bottom: 6px;
                }
                .ctc-table, .legal-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                .ctc-table th, .ctc-table td, .legal-table th, .legal-table td {
                    border: 1px solid #cbd5e1;
                    padding: 8px 10px;
                    text-align: left;
                }
                .ctc-table th, .legal-table th {
                    background: #f8fafc;
                    font-weight: 700;
                }
                .total-row {
                    font-weight: 700;
                    background: #f1f5f9;
                }
                .warning-box {
                    border-left: 4px solid #ef4444;
                    background: #fef2f2;
                    padding: 10px;
                    margin: 15px 0;
                    color: #991b1b;
                }
                .sign-section {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                }
                .sign-block {
                    width: 250px;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 8px;
                    text-align: center;
                    font-size: 12px;
                    font-weight: 600;
                }
                @media print {
                    @page {
                        margin: 0;
                    }
                    body {
                        padding: 0;
                    }
                    .page {
                        padding: 1.2cm;
                        box-sizing: border-box;
                        min-height: auto;
                    }
                    .no-print {
                        display: none;
                    }
                    .letterhead-header {
                        margin-bottom: 20px !important;
                        padding-bottom: 10px !important;
                    }
                    .doc-title {
                        margin: 15px 0 10px 0 !important;
                    }
                    h3 {
                        margin-top: 15px !important;
                        margin-bottom: 8px !important;
                        padding-bottom: 2px !important;
                    }
                    p, li {
                        margin-bottom: 6px !important;
                    }
                    ol, ul {
                        margin-top: 2px !important;
                    }
                    .annexure-table {
                        margin-top: 8px !important;
                        margin-bottom: 12px !important;
                    }
                    .annexure-table th, .annexure-table td {
                        padding: 6px 10px !important;
                    }
                    .sign-container {
                        margin-top: 25px !important;
                    }
                    .sign-line {
                        height: 40px !important;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    tr, li, .sign-container, .sign-box, .sign-block {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #0078C1; color: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" onclick="window.print()">
                🖨️ Print Package / Save as PDF
            </div>
            
            <!-- PAGE 1: Employment Agreement -->
            <div class="page">
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>Regd. Office: Gujarat, India | Email: hr@averionglobal.co.in</p>
                    <hr/>
                </div>
                <div class="doc-meta">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>To,</strong><br/>
                       <strong>${emp.first_name} ${emp.middle_name ? emp.middle_name + ' ' : ''}${emp.last_name}</strong><br/>
                       Address: ${emp.google_address || 'As per record'}<br/>
                       Mobile: ${emp.mobile_number || 'N/A'}</p>
                </div>
                
                <h3 class="doc-subject">Subject: Offer of Employment as ${emp.job_title || 'Employee'}</h3>
                
                <p>Dear ${emp.first_name},</p>
                <p>We are pleased to offer you employment with <strong>Averion Global LLP</strong> (the "Company") on the terms and conditions outlined below. Your employment will start on <strong>${emp.start_date || today}</strong>.</p>
                
                <h4>1. Role and Responsibilities</h4>
                <p>You will be employed in the position of <strong>${emp.job_title || 'Employee'}</strong>. Your duties and responsibilities will be those standard for this role, as well as any other duties assigned by the management from time to time.</p>
                
                <h4>2. Compensation and CTC Breakdown</h4>
                <p>Your Gross Monthly Salary (Cost to Company) will be <strong>${formattedGross}</strong> (Rupees equivalent), representing an annual CTC of <strong>${formattedAnnualGross}</strong>. Your salary will be bifurcated as follows under Indian Income Tax guidelines:</p>
                
                <table class="ctc-table">
                    <thead>
                        <tr>
                            <th>Salary Component</th>
                            <th>Monthly Amount (INR)</th>
                            <th>Annual Amount (INR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Salary (50%)</td>
                            <td>${formattedBasic}</td>
                            <td>${(basic * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr>
                            <td>House Rent Allowance (HRA - 20%)</td>
                            <td>${formattedHra}</td>
                            <td>${(hra * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr>
                            <td>Special Allowance (30%)</td>
                            <td>${formattedSa}</td>
                            <td>${(sa * 12).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        </tr>
                        <tr class="total-row">
                            <td>Gross Salary / Total CTC</td>
                            <td>${formattedGross}</td>
                            <td>${formattedAnnualGross}</td>
                        </tr>
                    </tbody>
                </table>
                <p><em>* Deductions for Provident Fund (EPF), ESIC, and Professional Tax (PT) will be applied monthly as per statutory opt-in declarations.</em></p>
                
                <h4>3. Probationary Period</h4>
                <p>You will be on probation for six (6) months. The Company may extend this at its sole discretion.</p>
                
                <h4>4. Termination</h4>
                <p>During probation, notice period is fifteen (15) days. Upon confirmation, notice period is thirty (30) days or basic salary in lieu thereof.</p>
                
                <div class="sign-section">
                    <div class="sign-block">
                        For Averion Global LLP<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">Authorized Signatory</span>
                    </div>
                    <div class="sign-block">
                        Accepted By Employee<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">(${emp.first_name} ${emp.last_name})</span>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 2: Code of Conduct & Mobile Policy -->
            <div class="page">
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>HR Policy Handbook - Section 1 & 2</p>
                    <hr/>
                </div>
                
                <h3>CODE OF CONDUCT & OFFICE DECORUM</h3>
                <p>All employees are expected to conduct themselves in a highly professional, ethical, and respectful manner. Punctuality, office discipline, and compliance with team shift structures are mandatory.</p>
                
                <h3>MOBILE DEVICE & OFFICE PHONE USE POLICY</h3>
                <h4>1. Personal Device Guidelines</h4>
                <ul>
                    <li>Personal mobile phones must remain on "Silent" or "Vibrate" mode during shifts.</li>
                    <li>Excessive social browsing, personal calls, or social media application usage during work hours is strictly prohibited. Personal calls should be restricted to scheduled break times.</li>
                    <li>Taking photographs or video recording within official operations bays is prohibited to preserve data confidentiality.</li>
                </ul>
                
                <h4>2. Company Phone Assets</h4>
                <ul>
                    <li>Company VoIP channels and telecommunication interfaces are to be utilized solely for official client interactions. Personal communication on business channels will result in disciplinary action.</li>
                </ul>
                
                <div class="sign-section">
                    <div class="sign-block">
                        For Averion Global LLP<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">Authorized Signatory</span>
                    </div>
                    <div class="sign-block">
                        Accepted By Employee<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">(${emp.first_name} ${emp.last_name})</span>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 3: Break & Leaves Policy -->
            <div class="page">
                <div class="letterhead">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p>HR Policy Handbook - Section 3 & 4</p>
                    <hr/>
                </div>
                
                <h3>REST BREAKS & WORK SCHEDULING</h3>
                <p>In accordance with Shop & Establishment regulations, shift schedules incorporate a mandatory rest interval structure:</p>
                <ul>
                    <li>No employee shall work for more than five (5) consecutive hours without a 30-minute rest interval.</li>
                    <li>Daily schedule includes one 30-minute lunch break and two pro-rated 10-minute tea breaks.</li>
                    <li>All break times must be accurately punched and recorded in the Solar CRM Timesheet module.</li>
                </ul>
                
                <h3>EMPLOYEE LEAVE RULES</h3>
                <p>Eligible leave categories on a calendar-year basis include:</p>
                <ul>
                    <li><strong>Earned Leave / Privilege Leave (EL/PL):</strong> Accrued based on service. Maximum carry-forward of 30 days, eligible for encashment upon separation.</li>
                    <li><strong>Casual Leave (CL) & Sick Leave (SL):</strong> Up to standard pro-rated days. CL/SL do not carry forward and lapse automatically on December 31st.</li>
                    <li><strong>Maternity Leave (ML):</strong> 26 weeks paid leave for eligible female employees under the Maternity Benefit Act.</li>
                </ul>
                
                <div class="sign-section">
                    <div class="sign-block">
                        For Averion Global LLP<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">Authorized Signatory</span>
                    </div>
                    <div class="sign-block">
                        Accepted By Employee<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">(${emp.first_name} ${emp.last_name})</span>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 4: Data Protection & Legal Consequences -->
            <div class="page">
                <div class="letterhead" style="color: #ef4444;">
                    <h2>AVERION GLOBAL LLP</h2>
                    <p style="font-weight: 700; color: #ef4444;">STRICT CONFIDENTIALITY & CRM DATA PROTECTION</p>
                    <hr/>
                </div>
                
                <div class="warning-box">
                    <strong>CRITICAL NOTICE:</strong> Data theft, copying lead lists, taking screenshots of CRM records, or exporting solar client details will result in immediate termination, civil damages suits, and criminal prosecution.
                </div>
                
                <h3>1. Non-Disclosure & Security</h3>
                <p>Employees are strictly prohibited from downloading, transferring, exporting, or transmitting CRM databases, pricing sheets, or client lists to personal emails, clouds, or mobile devices.</p>
                
                <h3>2. Legal and Penal Consequences (Indian Laws)</h3>
                <p>The Company will initiate immediate prosecution for any breach under Indian law:</p>
                
                <table class="legal-table">
                    <thead>
                        <tr>
                            <th>Statute / Section</th>
                            <th>Offence Description</th>
                            <th>Maximum Penalty</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Section 43 & 66, IT Act 2000</strong></td>
                            <td>Unauthorized computer access, downloading/copying database records.</td>
                            <td>Imprisonment up to 3 years and criminal fine up to ₹5 Lakhs.</td>
                        </tr>
                        <tr>
                            <td><strong>Section 408, Indian Penal Code</strong></td>
                            <td>Criminal breach of trust by clerk, worker, or employee.</td>
                            <td>Non-bailable warrant and imprisonment up to 7 years.</td>
                        </tr>
                        <tr>
                            <td><strong>NDAs Civil Suit</strong></td>
                            <td>Violation of confidentiality & corporate poaching.</td>
                            <td>Court suit for recovery of business damages.</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="sign-section" style="margin-top:80px;">
                    <div class="sign-block">
                        For Averion Global LLP<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">Authorized Signatory</span>
                    </div>
                    <div class="sign-block">
                        Accepted By Employee<br/>
                        <span style="font-size:10px; font-weight:normal; color:#64748b; margin-top:20px; display:block;">(${emp.first_name} ${emp.last_name})</span>
                    </div>
                </div>
            </div>
            
            <script>
                setTimeout(() => {
                    window.print();
                }, 500);
            </script>
        </body>
        </html>
    `;
}
