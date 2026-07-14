/* ==========================================================================
   responsive.js  —  Universal Responsive Logic & Layout Preferences Engine
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Ensure appropriate responsive viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

    // 2. Set up Hamburger Toggle for Mobile/Tablet Drawer
    setupHamburgerMenu();

    // 3. Load & Apply Layout Configurations, and Setup UI Settings Panel
    setupLayoutPreferences();

    // 4. Enforce Global Sidebar Permissions to prevent leaks
    enforceSidebarPermissions();

    // 5. Initialize the Premium Header UI with dynamic widgets
    setupPremiumHeader();

    // 6. Setup sliding indicators for tab capsules dynamically
    setupSlidingTabs();

    // 7. Setup dynamic query tag pills under search and filter modules
    setupSearchFilterPills();
});

function setupHamburgerMenu() {
    const topbar = document.querySelector('.topbar');
    const sidebar = document.querySelector('.sidebar');
    
    if (topbar && sidebar) {
        // Create hamburger toggle button
        const hamburger = document.createElement('button');
        hamburger.className = 'hamburger-toggle';
        hamburger.setAttribute('aria-label', 'Toggle navigation');
        hamburger.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        `;
        topbar.insertBefore(hamburger, topbar.firstChild);

        // Create overlay backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);

        // Hamburger click handler
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.toggle('sidebar-open');
        });

        // Backdrop click handler
        backdrop.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });

        // Close sidebar on link click (useful on mobile viewports)
        sidebar.querySelectorAll('.menu-item').forEach(link => {
            link.addEventListener('click', () => {
                // If it's not a toggle menu item (i.e. has an href)
                if (link.getAttribute('href')) {
                    document.body.classList.remove('sidebar-open');
                }
            });
        });

        // Auto-close sidebar on window resize if larger than tablet breakpoint
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                document.body.classList.remove('sidebar-open');
            }
        });
    }
}

async function setupLayoutPreferences() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Default configuration values
    let preferences = {
        table_density: 'standard',
        show_stats: 'true'
    };

    // Try fetching saved preferences from configurations API
    try {
        const res = await fetch('/api/configurations');
        if (res.ok) {
            const data = await res.json();
            if (data.table_density) preferences.table_density = data.table_density;
            if (data.show_stats) preferences.show_stats = data.show_stats;
        }
    } catch (e) {
        console.warn('[Responsive Preferences] Failed to load preferences:', e);
    }

    // Apply retrieved preferences
    applyPreferences(preferences);

    // Create gear settings button in topbar
    const gearBtn = document.createElement('button');
    gearBtn.className = 'pref-gear-btn';
    gearBtn.setAttribute('title', 'UI Preferences');
    gearBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    `;

    // Create gear settings dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'pref-dropdown';
    dropdown.innerHTML = `
        <h4>UI Preferences</h4>
        <div class="pref-field">
            <label for="pref-density">Table Density</label>
            <select id="pref-density">
                <option value="standard" ${preferences.table_density === 'standard' ? 'selected' : ''}>Standard</option>
                <option value="compact" ${preferences.table_density === 'compact' ? 'selected' : ''}>Compact (High Density)</option>
            </select>
        </div>
        <label class="pref-checkbox-label">
            <input type="checkbox" id="pref-show-stats" ${preferences.show_stats === 'true' ? 'checked' : ''}>
            <span>Show Statistics Row</span>
        </label>
        <button class="pref-save-btn" id="pref-save-btn">Save Layout</button>
    `;

    // Place gear button right before profile select or as last child in topbar
    const profileSelect = topbar.querySelector('.profile-select-wrap') || topbar.querySelector('.tb-spacer');
    if (profileSelect) {
        topbar.insertBefore(gearBtn, profileSelect);
    } else {
        topbar.appendChild(gearBtn);
    }
    
    // Add dropdown to the body or topbar
    topbar.style.position = 'relative'; // Ensure topbar is positioned context
    topbar.appendChild(dropdown);

    // Toggle dropdown
    gearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== gearBtn) {
            dropdown.classList.remove('active');
        }
    });

    // Save preferences logic
    const saveBtn = dropdown.querySelector('#pref-save-btn');
    saveBtn.addEventListener('click', async () => {
        const densitySelect = dropdown.querySelector('#pref-density');
        const showStatsCheck = dropdown.querySelector('#pref-show-stats');
        
        const newPrefs = {
            table_density: densitySelect.value,
            show_stats: showStatsCheck.checked ? 'true' : 'false'
        };

        saveBtn.innerText = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Save table_density
            await fetch('/api/configurations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config_key: 'table_density', config_value: newPrefs.table_density })
            });

            // Save show_stats
            await fetch('/api/configurations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config_key: 'show_stats', config_value: newPrefs.show_stats })
            });

            // Apply immediately
            applyPreferences(newPrefs);
            dropdown.classList.remove('active');

            // Show Toast (if Swal is available, otherwise alert)
            if (window.Swal) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Preferences saved successfully',
                    showConfirmButton: false,
                    timer: 2000
                });
            } else {
                alert('Preferences saved successfully!');
            }

        } catch (err) {
            console.error('[Responsive Preferences] Save failed:', err);
            alert('Failed to save layout preferences.');
        } finally {
            saveBtn.innerText = 'Save Layout';
            saveBtn.disabled = false;
        }
    });
}

function applyPreferences(prefs) {
    // Apply Density classes
    if (prefs.table_density === 'compact') {
        document.body.classList.add('density-compact');
    } else {
        document.body.classList.remove('density-compact');
    }

    // Apply Show Stats classes
    if (prefs.show_stats === 'false') {
        document.body.classList.add('hide-stats');
    } else {
        document.body.classList.remove('hide-stats');
    }
}

async function enforceSidebarPermissions() {
    try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const user = await meRes.json();
        
        // Admins skip checks
        if (user.role === 'Admin') return;
        
        const permRes = await fetch('/api/my-permissions');
        if (!permRes.ok) return;
        const matrix = await permRes.json();
        
        // Map URLs to respective module/feature names
        const mappings = [
            { selector: 'a[href="/dashboard_sales.html"]', module: 'Dashboard', feature: 'Sales' },
            { selector: 'a[href="/dashboard_installation.html"]', module: 'Dashboard', feature: 'Installation' },
            { selector: 'a[href="/dashboard_service.html"]', module: 'Dashboard', feature: 'Service' },
            { selector: 'a[href="/dashboard_ares_installation.html"]', module: 'Dashboard', feature: 'Ares Installation' },
            { selector: 'a[href="/"]', module: 'Lead Master', feature: 'View Leads' },
            { selector: 'a[href="/delete_leads.html"]', module: 'Lead Master', feature: 'Delete Lead' },
            { selector: 'a[href="/duplicate_leads.html"]', module: 'Lead Master', feature: 'Duplicate Lead' },
            { selector: 'a[href="/lead_approvals.html"]', module: 'Lead Master', feature: 'Lead Approvals' },
            { selector: 'a[href="/project_leads.html"]', module: 'Projects', feature: 'Leads' },
            { selector: 'a[href="/products.html"]', module: 'Masters', feature: 'Manage Products' },
            { selector: 'a[href="/combo_master.html"]', module: 'Masters', feature: 'Manage Products' },
            { selector: 'a[href="/stc_master.html"]', module: 'Masters', feature: 'Manage STC' },
            { selector: 'a[href="/rebate_live_master.html"]', module: 'Masters', feature: 'Manage Rebates' },
            { selector: 'a[href="/margin_master.html"]', module: 'Masters', feature: 'Manage Margins' },
            { selector: 'a[href="/installation_charges.html"]', module: 'Masters', feature: 'Manage Charges' },
            { selector: 'a[href="/installations.html"]', module: 'Ares Installation Outside', feature: 'Installations' },
            { selector: 'a[href="/outstanding_payments.html"]', module: 'Ares Installation Outside', feature: 'Outstanding Payments' },
            { selector: 'a[href="/paid_payments.html"]', module: 'Ares Installation Outside', feature: 'Paid Payments' },
            { selector: 'a[href="/company_details.html"]', module: 'Ares Installation Outside', feature: 'Company Details' },
            { selector: 'a[href="/admin.html"]', module: 'Settings', feature: 'Manage Users' },
            { selector: 'a[href="/attendance.html"]', module: 'Attendance & Payroll', feature: 'Employees' },
            { selector: 'a[href="/attendance.html#leave"]', module: 'Attendance & Payroll', feature: 'Leave' },
            { selector: 'a[href="/attendance.html#timesheets"]', module: 'Attendance & Payroll', feature: 'Timesheets' },
            { selector: 'a[href="/attendance.html#pay"]', module: 'Attendance & Payroll', feature: 'Pay Employee' },
            { selector: 'a[href="/attendance.html#super"]', module: 'Attendance & Payroll', feature: 'Superannuation' },
            { selector: 'a[href="/attendance.html#averion-employees"]', module: 'Attendance & Payroll', feature: 'Employees' },
            { selector: 'a[href="/attendance.html#averion-leave"]', module: 'Attendance & Payroll', feature: 'Leave' },
            { selector: 'a[href="/attendance.html#averion-timesheets"]', module: 'Attendance & Payroll', feature: 'Timesheets' },
            { selector: 'a[href="/attendance.html#averion-pay"]', module: 'Attendance & Payroll', feature: 'Pay Employee' },
            { selector: 'a[href="/attendance.html#averion-pt"]', module: 'Attendance & Payroll', feature: 'Professional Tax' },
            { selector: 'a[href="/attendance.html#averion-tax-slab"]', module: 'Attendance & Payroll', feature: 'Income Tax Slab' }
        ];

        // Process each link visibility
        mappings.forEach(m => {
            const els = document.querySelectorAll(`.sidebar ${m.selector}`);
            els.forEach(el => {
                if (!matrix[m.module] || !matrix[m.module][m.feature]) {
                    el.style.display = 'none';
                }
            });
        });

        // Hide parent menus that have no visible children
        document.querySelectorAll('.sidebar .sub-menu').forEach(sub => {
            const links = Array.from(sub.querySelectorAll('a.menu-item'));
            if (links.length > 0 && links.every(a => a.style.display === 'none')) {
                if (sub.previousElementSibling && sub.previousElementSibling.classList.contains('menu-item')) {
                    sub.previousElementSibling.style.display = 'none';
                }
            }
        });
        
        // Handle User Management standalone menu item
        const userMgmtEl = document.querySelector('.sidebar a[href="/admin.html"]');
        if (userMgmtEl && (!matrix['Settings'] || !matrix['Settings']['Manage Users'])) {
            userMgmtEl.style.display = 'none';
        }
        
    } catch (e) {
        console.error('Error enforcing sidebar permissions:', e);
    }
}

/* ==========================================================================
   PREMIUM FLOATING HEADER WIDGETS & THEMING LOGIC
   ========================================================================== */
async function setupPremiumHeader() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // If timezone helper wrapped the topbar in tier2, undo it to restore single row layout
    const tier2 = topbar.querySelector('.topbar-tier2');
    if (tier2) {
        // Restore original appendChild and insertBefore
        topbar.appendChild = HTMLElement.prototype.appendChild;
        topbar.insertBefore = HTMLElement.prototype.insertBefore;
        
        // Move all children of tier2 back to topbar
        const children = Array.from(tier2.childNodes);
        children.forEach(child => {
            topbar.appendChild(child);
        });
        
        // Remove tier2
        tier2.remove();
    }

    // Purge any redundant old profile, notification, or gear elements injected by timezone clocks or legacy code
    const elementsToPurge = [
        '.tb-notif-bell-wrapper',
        '#notificationBellBtn',
        '.tb-user-profile-wrapper',
        '#topbarProfileWrapper',
        '.profile-select-wrap',
        '.pref-gear-btn',
        '#currentUserDisplay',
        '#sidebarAvatar'
    ];
    elementsToPurge.forEach(selector => {
        const found = document.querySelectorAll(selector);
        found.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.remove();
        });
    });

    // Apply the premium header class
    topbar.classList.add('premium-header');

    // Retrieve the current theme from configurations database, fallback to localStorage
    let savedTheme = 'light';
    try {
        const configRes = await fetch('/api/configurations');
        if (configRes.ok) {
            const configs = await configRes.json();
            if (configs['crm-theme']) {
                savedTheme = configs['crm-theme'];
            } else {
                savedTheme = localStorage.getItem('crm-theme') || 'light';
            }
        }
    } catch(err) {
        savedTheme = localStorage.getItem('crm-theme') || 'light';
    }

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.body.classList.add('theme-dark');
        document.body.classList.remove('theme-ares-sunburst', 'theme-sunset-aurora', 'theme-nordic-mint', 'theme-oceanic-glass', 'theme-royal-amber', 'theme-neumorphic');
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-ares-sunburst');
    }

    // Try to get user details for profile avatar
    let userDetails = { name: 'User', role: 'Staff', initials: 'U' };
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            const data = await response.json();
            const displayName = data.full_name || data.username;
            if (data && displayName) {
                userDetails.name = displayName;
                userDetails.role = data.role || 'Staff';
                // Calculate initials
                const parts = displayName.trim().split(/\s+/);
                if (parts.length > 1) {
                    userDetails.initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                } else if (parts.length === 1 && parts[0].length > 0) {
                    userDetails.initials = parts[0].substring(0, 2).toUpperCase();
                }
            }
        }
    } catch (e) {
        console.warn('[Premium Header] Could not fetch user details:', e);
    }

    // Create the controls container
    const controls = document.createElement('div');
    controls.className = 'premium-controls';

    // Check if notifications were previously cleared in this browser session
    const isCleared = localStorage.getItem('crm-notifications-cleared') === 'true';

    // 2. Notifications wrapper and dropdown
    const notifyWrapper = document.createElement('div');
    notifyWrapper.className = 'premium-dropdown-wrapper';

    const notifyBtn = document.createElement('button');
    notifyBtn.className = 'premium-btn premium-notify-btn';
    notifyBtn.setAttribute('title', 'Notifications');
    notifyBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        ${isCleared ? '' : '<span class="premium-badge">3</span>'}
    `;

    const notifyDropdown = document.createElement('div');
    notifyDropdown.className = 'premium-dropdown notifications-dropdown';
    notifyDropdown.innerHTML = `
        <div class="dropdown-header">
            <span>Recent Notifications</span>
            <button class="mark-all-read" ${isCleared ? 'style="display: none;"' : ''}>Clear All</button>
        </div>
        <div class="dropdown-body">
            ${isCleared ? `
                <div class="dropdown-empty">No new notifications</div>
            ` : `
                <div class="notify-item unread">
                    <div class="notify-icon success">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div class="notify-details">
                        <p class="notify-text">New lead <strong>John Doe</strong> was assigned to you</p>
                        <span class="notify-time">2 mins ago</span>
                    </div>
                </div>
                <div class="notify-item unread">
                    <div class="notify-icon warning">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div class="notify-details">
                        <p class="notify-text">Project <strong>#1082</strong> approval is pending review</p>
                        <span class="notify-time">15 mins ago</span>
                    </div>
                </div>
                <div class="notify-item">
                    <div class="notify-icon info">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </div>
                    <div class="notify-details">
                        <p class="notify-text">Payment of <strong>$4,500</strong> received for Ares Energy</p>
                        <span class="notify-time">2 hours ago</span>
                    </div>
                </div>
            `}
        </div>
    `;

    notifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns(notifyDropdown);
        notifyDropdown.classList.toggle('active');
    });

    const markAllRead = notifyDropdown.querySelector('.mark-all-read');
    if (markAllRead) {
        markAllRead.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.setItem('crm-notifications-cleared', 'true');
            const badge = notifyBtn.querySelector('.premium-badge');
            if (badge) badge.style.display = 'none';
            notifyDropdown.querySelectorAll('.notify-item').forEach(item => item.classList.remove('unread'));
            notifyDropdown.querySelector('.dropdown-body').innerHTML = `
                <div class="dropdown-empty">No new notifications</div>
            `;
            markAllRead.style.display = 'none';
        });
    }

    notifyWrapper.appendChild(notifyBtn);
    notifyWrapper.appendChild(notifyDropdown);
    controls.appendChild(notifyWrapper);

    // 3. Theme Toggle Button (Light/Dark Mode)
    const themeBtn = document.createElement('button');
    themeBtn.className = 'premium-btn premium-theme-btn';
    themeBtn.setAttribute('title', 'Toggle Theme');

    const updateThemeIcons = (theme) => {
        if (theme === 'dark') {
            themeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            `;
        } else {
            themeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            `;
        }
    };

    updateThemeIcons(savedTheme);

    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        if (isDark) {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-ares-sunburst', 'theme-sunset-aurora', 'theme-nordic-mint', 'theme-oceanic-glass', 'theme-royal-amber', 'theme-neumorphic');
        } else {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-ares-sunburst');
        }
        const nextTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('crm-theme', nextTheme);
        localStorage.setItem('crm_selected_theme', isDark ? 'theme-dark' : 'theme-ares-sunburst');
        updateThemeIcons(nextTheme);

        // Push theme state update to backend database Configurations store
        fetch('/api/configurations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config_key: 'crm-theme', config_value: nextTheme })
        }).catch(err => console.warn('[Premium Header] Failed to sync theme state with DB:', err));
        
        if (window.Swal) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)} Mode Enabled`,
                showConfirmButton: false,
                timer: 1500
            });
        }
    });
    controls.appendChild(themeBtn);

    // 4. User Profile Badge and dropdown
    const profileWrapper = document.createElement('div');
    profileWrapper.className = 'premium-dropdown-wrapper';

    const profileAvatar = document.createElement('div');
    profileAvatar.className = 'premium-profile-avatar';
    profileAvatar.setAttribute('title', 'User Profile');
    profileAvatar.innerHTML = `
        <span class="avatar-initials">${userDetails.initials}</span>
        <span class="avatar-status-dot"></span>
    `;

    const profileDropdown = document.createElement('div');
    profileDropdown.className = 'premium-dropdown profile-dropdown';
    profileDropdown.innerHTML = `
        <div class="profile-dropdown-user">
            <div class="dropdown-avatar">${userDetails.initials}</div>
            <div class="dropdown-user-info">
                <h5 class="user-name">${userDetails.name}</h5>
                <span class="user-role">${userDetails.role}</span>
            </div>
        </div>
        <div class="dropdown-divider"></div>
        <a href="/logout" class="dropdown-item logout-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
        </a>
    `;

    profileAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns(profileDropdown);
        profileDropdown.classList.toggle('active');
    });

    profileWrapper.appendChild(profileAvatar);
    profileWrapper.appendChild(profileDropdown);
    controls.appendChild(profileWrapper);

    // Remove any existing user avatar selects or redundant elements
    const oldGearBtn = topbar.querySelector('.pref-gear-btn');
    if (oldGearBtn) oldGearBtn.remove();
    
    const profileSelectWrap = topbar.querySelector('.profile-select-wrap');
    if (profileSelectWrap) profileSelectWrap.remove();

    // Append the premium controls to the topbar
    topbar.appendChild(controls);

    // Helper: Close all other active dropdowns
    function closeAllDropdowns(exceptDropdown) {
        document.querySelectorAll('.premium-dropdown').forEach(dropdown => {
            if (dropdown !== exceptDropdown) {
                dropdown.classList.remove('active');
            }
        });
    }

    // Document listener to close all dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.premium-dropdown-wrapper')) {
            closeAllDropdowns(null);
        }
    });
}

/* ==========================================================================
   TABS AUTOMATED SLIDING INDICATOR LOGIC
   ========================================================================== */
function setupSlidingTabs() {
    const updateAllIndicators = () => {
        document.querySelectorAll('.tabs-capsules, .sub-tabs-header, #objection_category_tabs, #overlay_objection_tabs').forEach(container => {
            let indicator = container.querySelector('.tab-sliding-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'tab-sliding-indicator';
                container.insertBefore(indicator, container.firstChild);
                container.style.position = 'relative';
            }
            
            const activeTab = container.querySelector('.tab-capsule.active, .sub-tab-capsule.active');
            if (activeTab) {
                indicator.style.display = 'block';
                indicator.style.left = `${activeTab.offsetLeft}px`;
                indicator.style.top = `${activeTab.offsetTop}px`;
                indicator.style.width = `${activeTab.offsetWidth}px`;
                indicator.style.height = `${activeTab.offsetHeight}px`;
            } else {
                indicator.style.display = 'none';
            }
        });
    };

    // Initial update
    setTimeout(updateAllIndicators, 300);

    // Global listener for click events to update indicators on tab switch
    document.addEventListener('click', (e) => {
        if (e.target.closest('.tab-capsule, .sub-tab-capsule')) {
            setTimeout(updateAllIndicators, 80);
        }
    });

    // Resize listener
    window.addEventListener('resize', updateAllIndicators);
}

/* ==========================================================================
   ADVANCED SEARCH & FILTER MODULES TAG PILLS LOGIC
   ========================================================================== */
function setupSearchFilterPills() {
    const tableToolbar = document.querySelector('.table-toolbar');
    if (!tableToolbar) return;

    // Create a container for pills if it doesn't exist
    let pillsContainer = tableToolbar.querySelector('.filter-pills-container');
    if (!pillsContainer) {
        pillsContainer = document.createElement('div');
        pillsContainer.className = 'filter-pills-container';
        tableToolbar.appendChild(pillsContainer);
    }

    const renderPills = () => {
        pillsContainer.innerHTML = '';

        // 1. Text search inputs
        const searchInputs = document.querySelectorAll('#globalLeadSearch, #globalOmniSearchInput, .search-wrap input');
        searchInputs.forEach(input => {
            if (input.value.trim() !== '') {
                createPill(`Search: "${input.value.trim()}"`, () => {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('keyup', { bubbles: true }));
                    renderPills();
                });
            }
        });

        // 2. Active filter chips
        const activeChips = document.querySelectorAll('.filter-chip.fc-active, .filter-chip.active');
        activeChips.forEach(chip => {
            createPill(`Filter: ${chip.textContent.trim()}`, () => {
                chip.click();
                setTimeout(renderPills, 100);
            });
        });

        // 3. Select inputs
        const selects = tableToolbar.querySelectorAll('select');
        selects.forEach(select => {
            if (select.value && select.value !== 'all' && select.value !== '') {
                const label = select.options[select.selectedIndex].text;
                createPill(`${select.name || 'Filter'}: ${label}`, () => {
                    select.value = select.options[0].value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    renderPills();
                });
            }
        });
    };

    const createPill = (text, onRemove) => {
        const pill = document.createElement('div');
        pill.className = 'filter-pill';
        pill.innerHTML = `
            <span>${text}</span>
            <span class="remove-pill-btn">&times;</span>
        `;
        pill.querySelector('.remove-pill-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onRemove();
        });
        pillsContainer.appendChild(pill);
    };

    // Bind listeners
    document.querySelectorAll('#globalLeadSearch, #globalOmniSearchInput, .search-wrap input').forEach(input => {
        input.addEventListener('input', debounce(renderPills, 400));
    });

    tableToolbar.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', renderPills);
    });

    tableToolbar.addEventListener('click', (e) => {
        if (e.target.closest('.filter-chip')) {
            setTimeout(renderPills, 100);
        }
    });

    setTimeout(renderPills, 500);

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
