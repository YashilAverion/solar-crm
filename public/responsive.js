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
            { selector: 'a[href="/attendance.html#super"]', module: 'Attendance & Payroll', feature: 'Superannuation' }
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
