// Australian Timezones Live Clocks & Global Action Shell Controller
// Injects a Double-Decker top header layout dynamically across all pages and purges the sidebar clock widget completely.
(function() {
    'use strict';

    function initTimezoneClocks() {
        // Avoid duplicate injection
        if (document.querySelector('.topbar-tier1')) return;

        const topbar = document.querySelector('.topbar');
        if (!topbar) return;

        // 1. ABSOLUTE SIDEBAR PURGE: Forcefully expunge any old timezone widget blocks from the sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const oldSidebarWidgets = sidebar.querySelectorAll('.aus-timezone-container, .aus-timezone-sidebar');
            oldSidebarWidgets.forEach(el => el.remove());
        }

        // 2. Define timezone clock components
        const timezones = [
            { label: 'WA', zone: 'Australia/Perth', id: 'tz-clock-wa' },
            { label: 'NT', zone: 'Australia/Darwin', id: 'tz-clock-nt' },
            { label: 'SA/NSW/VIC/TAS', zone: 'Australia/Sydney', id: 'tz-clock-sa_nsw_vic_tas' },
            { label: 'IND', zone: 'Asia/Kolkata', id: 'tz-clock-ind' }
        ];

        // 3. Inject CSS Styles for Sticky Double-Decker layout
        const style = document.createElement('style');
        style.innerHTML = `
            /* Double-Decker Top Header Sticky Layout */
            .topbar {
                display: flex !important;
                flex-direction: column !important;
                height: auto !important;
                padding: 0 !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 1000 !important;
                background: var(--surface) !important;
                border-bottom: 2px solid var(--accent, #e8681e) !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
            }
            
            /* Tier 1: Clock Ceiling Strip */
            .topbar-tier1 {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important; /* Center the clocks horizontally across the entire width */
                background: #0b1120 !important; /* Premium dark ceiling strip */
                border-bottom: 1px solid #1e293b !important;
                padding: 6px 16px !important;
                font-family: 'Inter', system-ui, sans-serif !important;
                width: 100% !important;
                box-sizing: border-box !important;
                user-select: none !important;
                flex-wrap: wrap !important; /* Avoid squishing on small screens */
                gap: 0 !important;
            }
            
            /* Recalibrated Contrast - Premium Light-Badge Theme with Spacing & Margins */
            .timezone-clock-item {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 4px 10px !important;
                background-color: #ffffff !important;
                border-radius: 6px !important;
                font-weight: 600 !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
                margin-right: 16px !important; /* Adjusted spacing to 16px */
                border: 1px solid #e2e8f0 !important;
                transition: all 0.2s ease !important;
                margin-left: 0 !important;
            }
            .timezone-clock-item:last-child {
                margin-right: 0 !important;
            }
            .timezone-clock-item:hover {
                border-color: var(--accent, #e8681e) !important;
                transform: translateY(-1px) !important;
            }
            .timezone-clock-label {
                font-weight: 800 !important;
                color: #64748b !important;
                text-transform: uppercase !important;
                font-size: 10px !important;
                letter-spacing: 0.5px !important;
            }
            .timezone-clock-time {
                font-weight: 700 !important;
                color: #0f172a !important;
                font-size: 13px !important;
                font-variant-numeric: tabular-nums !important;
            }
            
            /* Tier 2: Navigation Controls Row */
            .topbar-tier2 {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: var(--surface) !important;
                padding: 6px 16px !important;
                width: 100% !important;
                box-sizing: border-box !important;
                height: 46px !important;
                gap: 12px !important;
            }
            
            .topbar-logo-link {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                font-weight: 800 !important;
                color: var(--text-dark, #1c2b3a) !important;
                font-size: 13px !important;
                text-transform: uppercase !important;
                letter-spacing: 1px !important;
                text-decoration: none !important;
            }
            .topbar-logo-link span {
                color: var(--accent, #e8681e) !important;
            }
            
            /* Action Buttons styling */
            .topbar-actions {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .topbar-btn {
                display: inline-flex !important;
                align-items: center !important;
                gap: 5px !important;
                background: var(--surface) !important;
                color: var(--text-dark, #1c2b3a) !important;
                border: 1px solid var(--border) !important;
                padding: 4px 10px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                height: 28px !important;
                box-sizing: border-box !important;
            }
            .topbar-btn:hover {
                border-color: var(--accent, #e8681e) !important;
                color: var(--accent, #e8681e) !important;
            }
            .topbar-btn.btn-deploy {
                background: #10b981 !important;
                border-color: #10b981 !important;
                color: #ffffff !important;
            }
            .topbar-btn.btn-deploy:hover {
                background: #059669 !important;
                border-color: #059669 !important;
            }
            
            /* Structural adjustments */
            .topbar .topbar-title {
                color: var(--text-dark, #1c2b3a) !important;
                margin: 0 !important;
                font-size: 14px !important;
                font-weight: 700 !important;
            }
            .topbar .search-wrap {
                margin: 0 !important;
                flex: 1 !important;
                max-width: 280px !important;
            }
            .topbar .user-profile {
                color: var(--text-muted, #6b7a8d) !important;
                font-size: 12px !important;
            }
            .main-wrap {
                margin-left: 180px !important;
            }
        `;
        document.head.appendChild(style);

        // 4. Build Tier 1 (Clock ceiling strip) HTML markup
        const tier1 = document.createElement('div');
        tier1.className = 'topbar-tier1';
        tier1.innerHTML = timezones.map(tz => `
            <div class="timezone-clock-item" title="${tz.zone} Time">
                <span class="timezone-clock-label">${tz.label}</span>
                <span class="timezone-clock-time" id="${tz.id}">--:-- --</span>
            </div>
        `).join('');

        // 5. Build Tier 2 and migrate existing topbar contents into it
        const tier2 = document.createElement('div');
        tier2.className = 'topbar-tier2';

        // Add Logo link
        const logoLink = document.createElement('a');
        logoLink.href = '/home.html';
        logoLink.className = 'topbar-logo-link';
        logoLink.innerHTML = '<span>ARES ENERGY</span> Solar CRM';
        tier2.appendChild(logoLink);

        // Move children of topbar to Tier 2
        const children = Array.from(topbar.childNodes);
        children.forEach(child => {
            if (child !== tier1 && child !== tier2) {
                // Remove duplicate manual backup and deployment buttons from pages like admin.html to avoid duplicate layouts
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const inlineBackupBtn = child.querySelector('button[onclick="startManualBackup()"]') || (child.matches && child.matches('button[onclick="startManualBackup()"]'));
                    const inlineDeployBtn = child.querySelector('button[onclick="triggerDeployment()"]') || (child.matches && child.matches('button[onclick="triggerDeployment()"]'));
                    if (inlineBackupBtn || inlineDeployBtn) {
                        return; // skip transferring
                    }
                }
                tier2.appendChild(child);
            }
        });

        // If page has standalone buttons direct in the topbar, purge them from Tier 2
        const oldBackup = tier2.querySelector('button[onclick="startManualBackup()"]');
        if (oldBackup) oldBackup.remove();
        const oldDeploy = tier2.querySelector('button[onclick="triggerDeployment()"]');
        if (oldDeploy) oldDeploy.remove();

        // Inject standard search container if it's missing (and not the login page)
        if (!tier2.querySelector('#globalOmniSearchInput') && !window.location.pathname.includes('login.html')) {
            const searchWrap = document.createElement('div');
            searchWrap.className = 'search-wrap';
            searchWrap.innerHTML = `
                <input type="text" id="globalOmniSearchInput" placeholder="Omnibox Search (Projects, Leads, Clients...)">
                <div id="globalOmniDropdown"></div>
            `;
            const spacer = tier2.querySelector('.tb-spacer') || tier2.lastChild;
            if (spacer) {
                tier2.insertBefore(searchWrap, spacer);
            } else {
                tier2.appendChild(searchWrap);
            }
        }

        // Inject global action buttons
        let actionsContainer = tier2.querySelector('.topbar-actions');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'topbar-actions';

            const backupBtn = document.createElement('button');
            backupBtn.className = 'topbar-btn';
            backupBtn.innerHTML = '🔒 Backup Now';
            backupBtn.onclick = startGlobalManualBackup;

            const deployBtn = document.createElement('button');
            deployBtn.className = 'topbar-btn btn-deploy';
            deployBtn.innerHTML = '🚀 Deploy to Live';
            deployBtn.onclick = triggerGlobalDeployment;

            actionsContainer.appendChild(backupBtn);
            actionsContainer.appendChild(deployBtn);

            const userDisplay = tier2.querySelector('.user-profile') || tier2.querySelector('.profile-select-wrap') || tier2.querySelector('#currentUserDisplay') || tier2.querySelector('#sidebarAvatar');
            if (userDisplay) {
                tier2.insertBefore(actionsContainer, userDisplay);
            } else {
                tier2.appendChild(actionsContainer);
            }
        }

        // Overwrite topbar body
        topbar.innerHTML = '';
        topbar.appendChild(tier1);
        topbar.appendChild(tier2);

        // Clocks ticking function
        function updateClocks() {
            const now = new Date();
            timezones.forEach(tz => {
                const el = document.getElementById(tz.id);
                if (el) {
                    const options = {
                        timeZone: tz.zone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    };
                    let timeStr = now.toLocaleTimeString('en-AU', options);
                    timeStr = timeStr.replace(/\s+/g, ' ');
                    el.textContent = timeStr.toUpperCase();
                }
            });
        }

        updateClocks();
        setInterval(updateClocks, 1000);
    }

    // Global Actions handlers
    async function startGlobalManualBackup() {
        if (typeof Swal === 'undefined') {
            alert('Creating backup... Connection established.');
            try {
                const res = await fetch('/api/backup/start', { method: 'POST' });
                if (res.ok) alert('Backup initialized successfully.');
            } catch(e) { alert('Backup initiation failed.'); }
            return;
        }
        try {
            const res = await fetch('/api/backup/start', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start backup');
            Swal.fire({
                title: 'Creating Backup...',
                html: `<div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">Compressing system files... Please wait.</div>
                    <div style="font-weight:700; font-size:16px; color:var(--text-dark); margin-bottom:8px;" id="backup-text">0%</div>
                    <div style="width:100%; background:#e2e8f0; border-radius:10px; height:12px; overflow:hidden;"><div id="backup-pb" style="width:0%; background:#10b981; height:100%; transition:width 0.3s ease;"></div></div>`,
                allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false,
                didOpen: () => {
                    const pb = document.getElementById('backup-pb'), pbt = document.getElementById('backup-text');
                    const iv = setInterval(async () => {
                        try {
                            const s = await (await fetch('/api/backup/status')).json();
                            pb.style.width = s.progress + '%'; pbt.innerText = s.progress + '%';
                            if (s.error) { clearInterval(iv); Swal.fire('Error', s.error, 'error'); }
                            else if (!s.isRunning && s.progress === 100) { clearInterval(iv); Swal.fire('Success!', 'Backup completed!', 'success').then(() => { window.location.reload(); }); }
                            else if (!s.isRunning && s.progress !== 100) { clearInterval(iv); Swal.fire('Warning', 'Backup stopped unexpectedly.', 'warning'); }
                        } catch(e) { clearInterval(iv); Swal.fire('Error', 'Failed to get backup status.', 'error'); }
                    }, 500);
                }
            });
        } catch(e) { Swal.fire('Error', e.message, 'error'); }
    }

    async function triggerGlobalDeployment() {
        if (typeof Swal === 'undefined') {
            const ok = confirm('Deploy local environment to production Hostinger VPS?');
            if (!ok) return;
            try {
                const response = await fetch('/admin/deploy', { method: 'POST' });
                if (response.ok) alert('Deployment process triggered successfully.');
            } catch(e) { alert('Deployment triggered failed.'); }
            return;
        }
        const { isConfirmed } = await Swal.fire({
            title: 'Deploy to Production',
            text: 'This will push your local changes to GitHub and trigger a remote pull/restart on Hostinger. Do you want to proceed?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7a8d',
            confirmButtonText: 'Yes, Deploy!'
        });

        if (!isConfirmed) return;

        Swal.fire({
            title: 'Deploying Code...',
            html: `
                <div style="text-align: left; background: #0f172a; color: #38bdf8; font-family: monospace; font-size: 12px; padding: 12px; border-radius: 6px; max-height: 250px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;" id="deploy-logs">
Initializing deployment stream...
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            showCancelButton: false,
            didOpen: async () => {
                const logsDiv = document.getElementById('deploy-logs');
                try {
                    const response = await fetch('/admin/deploy', { method: 'POST' });
                    if (!response.ok) {
                        const err = await response.json().catch(() => ({}));
                        throw new Error(err.error || 'Deployment failed.');
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        logsDiv.innerText += chunk;
                        logsDiv.scrollTop = logsDiv.scrollHeight;
                    }

                    if (logsDiv.innerText.includes('DEPLOYMENT SUCCESSFUL')) {
                        Swal.update({
                            icon: 'success',
                            title: 'Deployment Successful!',
                            showConfirmButton: true,
                            confirmButtonText: 'Done',
                            confirmButtonColor: '#10b981'
                        });
                    } else if (logsDiv.innerText.includes('Deployment failed') || logsDiv.innerText.includes('Error')) {
                        Swal.update({
                            icon: 'error',
                            title: 'Deployment Failed',
                            showConfirmButton: true,
                            confirmButtonText: 'Close',
                            confirmButtonColor: '#ef4444'
                        });
                    } else {
                        Swal.update({
                            icon: 'success',
                            title: 'Code Pushed to GitHub!',
                            showConfirmButton: true,
                            confirmButtonText: 'Done',
                            confirmButtonColor: '#10b981'
                        });
                    }
                } catch (e) {
                    logsDiv.innerText += `\n❌ Error: ${e.message}`;
                    Swal.update({
                        icon: 'error',
                        title: 'Deployment Failed',
                        showConfirmButton: true,
                        confirmButtonText: 'Close',
                        confirmButtonColor: '#ef4444'
                    });
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTimezoneClocks);
    } else {
        initTimezoneClocks();
    }
})();
