// Australian Timezones Live Clocks & Global Action Shell Controller
// (Clocks removed at user request. Dynamic notification bell and layout controller remains active)
(function() {
    'use strict';

    function initTimezoneClocks() {
        // Avoid duplicate injection
        if (document.querySelector('.notification-container')) return;

        const topbar = document.querySelector('.topbar');
        if (!topbar) return;

        // 1. ABSOLUTE SIDEBAR PURGE: Forcefully expunge any old timezone widget blocks from the sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const oldSidebarWidgets = sidebar.querySelectorAll('.aus-timezone-container, .aus-timezone-sidebar');
            oldSidebarWidgets.forEach(el => el.remove());
        }

        // 2. Inject CSS Styles for Sticky single tier topbar layout
        const style = document.createElement('style');
        style.innerHTML = `
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
                position: relative !important;
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
            
            /* Reset sidebar and main-wrap to standard height */
            .sidebar {
                top: 0 !important;
                height: 100vh !important;
            }
            .main-wrap {
                margin-top: 0 !important;
                height: 100vh !important;
            }
        `;
        document.head.appendChild(style);

        // 3. Build Tier 2 and migrate existing topbar contents into it
        const tier2 = document.createElement('div');
        tier2.className = 'topbar-tier2';

        // Move children of topbar to Tier 2
        const children = Array.from(topbar.childNodes);
        children.forEach(child => {
            if (child !== tier2) {
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
        const hasExistingSearch = tier2.querySelector('input[type="text"]') || tier2.querySelector('input[type="search"]') || tier2.querySelector('.search-wrap');
        if (!hasExistingSearch && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('attendance.html')) {
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

        // Inject global action buttons (Admin only)
        if (window.location.pathname.includes('admin.html')) {
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
        }

        // Overwrite topbar body
        topbar.innerHTML = '';
        HTMLElement.prototype.appendChild.call(topbar, tier2);

        // Override DOM insertion methods to redirect dynamic scripts (e.g. responsive.js) to Tier 2
        topbar.appendChild = function(newChild) {
            if (newChild === tier2 || newChild.tagName === 'STYLE' || newChild.tagName === 'SCRIPT') {
                return HTMLElement.prototype.appendChild.call(this, newChild);
            }
            return tier2.appendChild(newChild);
        };

        topbar.insertBefore = function(newChild, refChild) {
            if (newChild === tier2 || refChild === tier2) {
                return HTMLElement.prototype.insertBefore.call(this, newChild, refChild);
            }
            if (refChild && tier2.contains(refChild)) {
                return tier2.insertBefore(newChild, refChild);
            }
            if (tier2.firstChild) {
                return tier2.insertBefore(newChild, tier2.firstChild);
            }
            return tier2.appendChild(newChild);
        };

        // 4. Inject Notification Bell dynamically if it is not already there
        if (!tier2.querySelector('.notification-container')) {
            const notifContainer = document.createElement('div');
            notifContainer.className = 'notification-container';
            notifContainer.style.cssText = 'position: relative; display: flex; align-items: center; gap: 10px; margin-right: 12px; z-index: 999999; margin-left: auto;';
            notifContainer.innerHTML = `
                <button type="button" id="notificationBellBtn" style="background: none; border: none; cursor: pointer; position: relative; padding: 4px; display: flex; align-items: center; justify-content: center; outline: none;">
                    <span style="font-size: 18px; color: #64748b;">🔔</span>
                    <span id="notificationBadge" style="display: none; position: absolute; top: -2px; right: -2px; background: #ef4444; color: #fff; font-size: 9px; font-weight: bold; border-radius: 50%; min-width: 14px; height: 14px; align-items: center; justify-content: center; padding: 0 3px; border: 1.5px solid #fff;">0</span>
                </button>
                <div id="notificationDropdownPanel" style="display: none; position: absolute; top: 32px; right: 0; width: 320px; background: #fff; border: 1px solid #dde3ed; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100000; max-height: 380px; overflow-y: auto; text-align: left; padding: 4px 0; font-family: 'Inter', system-ui, sans-serif;">
                    <div style="padding: 10px 14px; border-bottom: 1px solid #dde3ed; font-weight: bold; font-size: 12px; color: #1c2b3a; display: flex; justify-content: space-between; align-items: center;">
                        <span>Alerts & Notifications</span>
                        <span id="dismissAllNotifsBtn" style="font-size: 10px; color: #e8681e; cursor: pointer; font-weight: 600;">Dismiss All</span>
                    </div>
                    <ul id="notificationList" style="list-style: none; padding: 0; margin: 0; max-height: 300px; overflow-y: auto;">
                        <li style="padding: 14px; text-align: center; color: #6b7a8d; font-size: 12px; font-style: italic;">No new alerts.</li>
                    </ul>
                </div>
            `;
            
            const userDisplay = tier2.querySelector('.user-profile') || tier2.querySelector('.profile-select-wrap') || tier2.querySelector('#currentUserDisplay') || tier2.querySelector('#sidebarAvatar');
            if (userDisplay) {
                tier2.insertBefore(notifContainer, userDisplay);
            } else {
                tier2.appendChild(notifContainer);
            }
        }

        // 5. Setup Notification Event Listeners & Functions
        let globalNotifications = [];
        
        async function fetchNotifications() {
            try {
                const res = await fetch('/api/notifications?t=' + new Date().getTime());
                if (res.ok) {
                    globalNotifications = await res.json();
                    renderNotifications();
                }
            } catch(e) {
                console.error("Error fetching notifications:", e);
            }
        }
        
        function renderNotifications() {
            const badge = document.getElementById('notificationBadge');
            const listEl = document.getElementById('notificationList');
            if (!badge || !listEl) return;
            
            const clearedIds = JSON.parse(localStorage.getItem('cleared_notification_ids') || '[]');
            const activeNotifications = globalNotifications.filter(n => !clearedIds.includes(n.id));
            
            if (activeNotifications.length > 0) {
                badge.innerText = activeNotifications.length;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
            
            if (activeNotifications.length === 0) {
                listEl.innerHTML = `<li style="padding: 14px; text-align: center; color: #6b7a8d; font-size: 12px; font-style: italic;">No new alerts.</li>`;
                return;
            }
            
            listEl.innerHTML = activeNotifications.map(n => {
                let icon = '⏳';
                let borderStyle = 'border-left: 4px solid #f59e0b;';
                let bgColor = '#fffcf5';
                
                if (n.action === 'Discount Approved') {
                    icon = '✅';
                    borderStyle = 'border-left: 4px solid #10b981;';
                    bgColor = '#f4fbf7';
                } else if (n.action === 'Discount Rejected') {
                    icon = '❌';
                    borderStyle = 'border-left: 4px solid #ef4444;';
                    bgColor = '#fef5f5';
                }
                
                const timeStr = new Date(n.created_at).toLocaleString();
                const leadName = `${n.first_name || ''} ${n.last_name || ''}`.trim() || 'Lead';
                
                return `
                    <li style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; ${borderStyle} background: ${bgColor}; transition: background 0.15s; font-size: 12px;">
                        <a href="/project_profile.html?id=${n.lead_id}" style="text-decoration: none; color: inherit; display: block;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px; color: #1c2b3a;">
                                <span>${icon} ${n.action}</span>
                                <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">${timeStr}</span>
                            </div>
                            <div style="color: #6b7a8d; font-size: 11px; margin-bottom: 4px;">
                                Lead: <strong>${n.project_number || '#' + n.lead_id}</strong> (${leadName})
                            </div>
                            <div style="font-size: 11px; color: #1c2b3a; line-height: 1.3;">
                                ${n.details}
                            </div>
                        </a>
                    </li>
                `;
            }).join('');
        }
        
        function clearNotifications() {
            const activeIds = globalNotifications.map(n => n.id);
            const clearedIds = JSON.parse(localStorage.getItem('cleared_notification_ids') || '[]');
            const newClearedIds = Array.from(new Set([...clearedIds, ...activeIds]));
            localStorage.setItem('cleared_notification_ids', JSON.stringify(newClearedIds));
            renderNotifications();
        }

        const bellBtn = document.getElementById('notificationBellBtn');
        const dropdownPanel = document.getElementById('notificationDropdownPanel');
        const dismissBtn = document.getElementById('dismissAllNotifsBtn');
        
        if (bellBtn && dropdownPanel) {
            bellBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = dropdownPanel.style.display === 'block';
                dropdownPanel.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    fetchNotifications();
                }
            });
            
            if (dismissBtn) {
                dismissBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    clearNotifications();
                });
            }
            
            window.addEventListener('click', function(e) {
                if (dropdownPanel.style.display === 'block' && !bellBtn.contains(e.target) && !dropdownPanel.contains(e.target)) {
                    dropdownPanel.style.display = 'none';
                }
            });
            
            setInterval(fetchNotifications, 10000); // autofresh every 10 seconds
            setTimeout(fetchNotifications, 500); // initial load
        }
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
