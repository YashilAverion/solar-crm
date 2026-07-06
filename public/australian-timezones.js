// Australian Timezones Live Clocks & Global Action Shell Controller
// (Clocks removed at user request. Dynamic notification bell and layout controller remains active)
(function() {
    'use strict';

    function initTimezoneClocks() {
        // Load saved theme and apply classes immediately
        const savedTheme = localStorage.getItem('crm_selected_theme') || 'theme-ares-sunburst';
        document.body.classList.remove(
            'theme-ares-sunburst',
            'theme-sunset-aurora',
            'theme-nordic-mint',
            'theme-oceanic-glass',
            'theme-royal-amber',
            'theme-neumorphic',
            'theme-dark'
        );
        document.body.classList.add(savedTheme);

        window.setCRMTheme = function(themeName) {
            document.body.classList.remove(
                'theme-ares-sunburst',
                'theme-sunset-aurora',
                'theme-nordic-mint',
                'theme-oceanic-glass',
                'theme-royal-amber',
                'theme-neumorphic',
                'theme-dark'
            );
            document.body.classList.add(themeName);
            localStorage.setItem('crm_selected_theme', themeName);

            // Re-color SVG icons dynamically when theme changes
            const baseColor = getComputedStyle(document.body).getPropertyValue('--menu-icon-base').trim();
            const accentColor = getComputedStyle(document.body).getPropertyValue('--menu-icon-accent').trim();
            const activeColor = getComputedStyle(document.body).getPropertyValue('--sidebar-active-text').trim();

            document.querySelectorAll('.sb-menu .menu-item').forEach(item => {
                const isActive = item.classList.contains('active-menu');
                const svg = item.querySelector('.menu-icon-svg');
                if (!svg) return;

                const baseFill = isActive ? activeColor : baseColor;
                const paths = svg.querySelectorAll('path, rect, circle, ellipse');
                paths.forEach((p, idx) => {
                    // Pre-defined color index: first path is base, second is accent
                    if (p.tagName === 'rect' && p.getAttribute('x') === '10' && p.getAttribute('y') === '14') {
                        p.setAttribute('fill', accentColor); // Home door
                    } else if (p.tagName === 'rect' && p.getAttribute('x') === '13' && p.getAttribute('y') === '13') {
                        p.setAttribute('fill', accentColor); // Dashboard bottom-right
                    } else if (p.tagName === 'circle' && p.getAttribute('cx') === '18') {
                        p.setAttribute('fill', accentColor); // Leads circle badge
                    } else if (p.tagName === 'rect' && p.getAttribute('x') === '11') {
                        p.setAttribute('fill', accentColor); // Projects lock
                    } else if (idx === paths.length - 1 && p.tagName === 'path' && p.getAttribute('d').startsWith('M3 11')) {
                        p.setAttribute('fill', accentColor); // Masters cylinder bottom
                    } else if (p.tagName === 'circle' && p.getAttribute('cx') === '6') {
                        p.setAttribute('fill', accentColor); // Ares Installation handle
                    } else if (p.tagName === 'circle' && p.getAttribute('cx') === '12') {
                        p.setAttribute('fill', accentColor); // User shield circle
                    } else if (p.tagName === 'rect' && p.getAttribute('x') === '14') {
                        p.setAttribute('fill', accentColor); // Payroll date badge
                    } else {
                        if (p.getAttribute('stroke') !== 'none' && p.getAttribute('stroke')) {
                            // keep line stroke
                        } else {
                            p.setAttribute('fill', baseFill);
                        }
                    }
                });
            });
        };

        // Avoid duplicate injection
        if (document.querySelector('.notification-container') || document.getElementById('crm-dynamic-brand-styles')) return;

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
        style.id = 'crm-dynamic-brand-styles';
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

            /* Default Variables & Themes Configuration */
            :root {
                --primary: #0f172a;
                --primary-hover: #1e293b;
                --accent: #64748b;
                --accent-hover: #475569;
                --bg: #ffffff;
                --surface: #ffffff;
                --border: #e2e8f0;
                --text-dark: #0f172a;
                --text-muted: #64748b;
                --sidebar-bg: #ffffff;
                --sidebar-text: #64748b;
                --sidebar-active-bg: #f1f5f9;
                --sidebar-active-text: #0f172a;
                --menu-icon-base: #64748b;
                --menu-icon-accent: #64748b;
                --card-shadow: 0 1px 3px rgba(0,0,0,0.02);
                --card-border: 1px solid #e2e8f0;
                --card-radius: 12px;
            }

            /* Theme 1: Ares Premium Sunburst (Default Brand Theme) */
            body.theme-ares-sunburst {
                --primary: #0f172a !important;
                --primary-hover: #1e293b !important;
                --accent: #64748b !important;
                --accent-hover: #475569 !important;
                --bg: #ffffff !important;
                --surface: #ffffff !important;
                --border: #e2e8f0 !important;
                --text-dark: #0f172a !important;
                --text-muted: #64748b !important;
                --sidebar-bg: #ffffff !important;
                --sidebar-text: #64748b !important;
                --sidebar-active-bg: #f1f5f9 !important;
                --sidebar-active-text: #0f172a !important;
                --menu-icon-base: #64748b !important;
                --menu-icon-accent: #64748b !important;
                --card-shadow: 0 1px 2px rgba(0,0,0,0.01) !important;
                --card-border: 1px solid #e2e8f0 !important;
                --card-radius: 12px !important;
            }
            body.theme-ares-sunburst .sb-logo-main {
                color: #0f172a !important;
            }
            body.theme-ares-sunburst .sb-logo-main span {
                color: #0f172a !important;
                font-family: 'Outfit', sans-serif !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
            }
            body.theme-ares-sunburst .sb-logo-main span:first-child {
                color: #0f172a !important;
            }
            body.theme-ares-sunburst .sb-logo-main span:last-child {
                color: #64748b !important;
            }
            body.theme-ares-sunburst .sidebar {
                border-right: 1px solid #e2e8f0 !important;
            }
            body.theme-ares-sunburst .sb-logo {
                border-bottom: 1px solid #e2e8f0 !important;
            }
            body.theme-ares-sunburst .sb-footer {
                border-top: 1px solid #e2e8f0 !important;
                background: #ffffff !important;
            }
            body.theme-ares-sunburst .sb-uname {
                color: #0f172a !important;
            }
            body.theme-ares-sunburst .sidebar .menu-item.active-menu {
                box-shadow: none !important;
            }
            body.theme-ares-sunburst .sidebar .menu-item:hover {
                background: #3A6E71 !important;
                color: #ffffff !important;
                border-radius: 8px !important;
            }
            body.theme-ares-sunburst .sidebar .menu-item:hover .menu-icon-svg path,
            body.theme-ares-sunburst .sidebar .menu-item:hover .menu-icon-svg rect,
            body.theme-ares-sunburst .sidebar .menu-item:hover .menu-icon-svg circle,
            body.theme-ares-sunburst .sidebar .menu-item:hover .menu-icon-svg ellipse {
                fill: #ffffff !important;
            }
            body.theme-ares-sunburst tr:hover td {
                background-color: #f18a31 !important;
                color: #ffffff !important;
            }
            body.theme-ares-sunburst tr:hover td span[style*="background"],
            body.theme-ares-sunburst tr:hover td span[style*="background-color"],
            body.theme-ares-sunburst tr:hover td .user-role-badge {
                color: #0f172a !important;
            }
            body.theme-ares-sunburst tr:hover td a:not(.proj-num),
            body.theme-ares-sunburst tr:hover td .assign-date,
            body.theme-ares-sunburst tr:hover td .assignee-cell {
                color: #ffffff !important;
            }
            body.theme-ares-sunburst tr:hover td .proj-num {
                color: var(--primary) !important;
                background-color: #eef2f8 !important;
                border-color: #c5d3e8 !important;
            }
            body.theme-ares-sunburst tr:hover td .proj-pending {
                color: #c0520f !important;
                background-color: #fff4ee !important;
                border-color: #f9c89a !important;
            }
            body.theme-ares-sunburst tr:hover td .status-badge {
                background-color: var(--bg) !important;
                color: var(--text-dark) !important;
                border-color: var(--border) !important;
            }
            body.theme-ares-sunburst tr:hover td .sb-planned {
                background-color: #eef2f8 !important;
                color: #1c3557 !important;
                border-color: #c5d3e8 !important;
            }
            body.theme-ares-sunburst tr:hover td .sb-inprog {
                background-color: #fffbeb !important;
                color: #b45309 !important;
                border-color: #fde68a !important;
            }
            body.theme-ares-sunburst tr:hover td .sb-won {
                background-color: #edfaf2 !important;
                color: #1a6b3c !important;
                border-color: #b3e6cc !important;
            }
            body.theme-ares-sunburst .topbar-btn:hover {
                background-color: rgba(58, 110, 113, 0.08) !important; /* Soft William Teal wash on hover */
                border-color: #3A6E71 !important;
                color: #3A6E71 !important;
            }
            body.theme-ares-sunburst button.btn-primary:hover,
            body.theme-ares-sunburst .btn-submit:hover {
                background-color: #2c5557 !important; /* Darker Teal on hover */
            }

            /* Professional SweetAlert2 Toast overrides */
            .swal2-popup.swal2-toast {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 12px !important;
                box-shadow: 0 10px 30px rgba(58, 110, 113, 0.08) !important;
                padding: 12px 16px !important;
                position: relative !important;
                overflow: hidden !important;
            }
            .swal2-popup.swal2-toast::before {
                content: '' !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                height: 100% !important;
                width: 4px !important;
                background: linear-gradient(to bottom, #3A6E71, #F18A31) !important; /* Brand gradient stripe */
            }
            .swal2-popup.swal2-toast .swal2-title {
                color: #0f172a !important;
                font-family: 'Outfit', sans-serif !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                margin-left: 8px !important;
            }
            .swal2-popup.swal2-toast .swal2-icon.swal2-success {
                border-color: #3A6E71 !important;
            }
            .swal2-popup.swal2-toast .swal2-icon.swal2-success [class^='swal2-success-line'] {
                background-color: #3A6E71 !important;
            }
            .swal2-popup.swal2-toast .swal2-icon.swal2-success .swal2-success-ring {
                border: 4px solid rgba(58, 110, 113, 0.2) !important;
            }

            /* Theme 2: Sunset Aurora (Frosted Glass & Metallic Gradients) */
            body.theme-sunset-aurora {
                --primary: #f43f5e !important;
                --primary-hover: #e11d48 !important;
                --accent: #f59e0b !important;
                --accent-hover: #d97706 !important;
                --bg: #fdfaf7 !important;
                --surface: rgba(255, 255, 255, 0.8) !important;
                --border: rgba(244, 63, 94, 0.12) !important;
                --text-dark: #2c2523 !important;
                --text-muted: #8c827a !important;
                --sidebar-bg: #2c2523 !important;
                --sidebar-text: #e7e5e4 !important;
                --sidebar-active-bg: linear-gradient(135deg, #f43f5e, #f59e0b) !important;
                --sidebar-active-text: #ffffff !important;
                --menu-icon-base: #e7e5e4 !important;
                --menu-icon-accent: #f59e0b !important;
                --card-shadow: 0 10px 30px rgba(244, 63, 94, 0.03) !important;
                --card-border: 1px solid rgba(255, 255, 255, 0.5) !important;
                background-image: radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.04) 0%, transparent 50%),
                                  radial-gradient(circle at 95% 85%, rgba(245, 158, 11, 0.04) 0%, transparent 50%) !important;
            }

            /* Theme 3: Nordic Mint (Refreshing Green Solar Energy Vibe) */
            body.theme-nordic-mint {
                --primary: #0f766e !important;
                --primary-hover: #115e59 !important;
                --accent: #10b981 !important;
                --accent-hover: #059669 !important;
                --bg: #f0fdf4 !important;
                --surface: #ffffff !important;
                --border: #d1fae5 !important;
                --text-dark: #062f27 !important;
                --text-muted: #4b5563 !important;
                --sidebar-bg: #064e3b !important;
                --sidebar-text: #d1fae5 !important;
                --sidebar-active-bg: #10b981 !important;
                --sidebar-active-text: #ffffff !important;
                --menu-icon-base: #d1fae5 !important;
                --menu-icon-accent: #10b981 !important;
            }

            /* Theme 4: Oceanic Glass (Teal & Sky Blue) */
            body.theme-oceanic-glass {
                --primary: #0369a1 !important;
                --primary-hover: #075985 !important;
                --accent: #06b6d4 !important;
                --accent-hover: #0891b2 !important;
                --bg: #f0f9ff !important;
                --surface: #ffffff !important;
                --border: #e0f2fe !important;
                --text-dark: #0f172a !important;
                --text-muted: #64748b !important;
                --sidebar-bg: #0f172a !important;
                --sidebar-text: #e2e8f0 !important;
                --sidebar-active-bg: linear-gradient(135deg, #0369a1, #06b6d4) !important;
                --sidebar-active-text: #ffffff !important;
                --menu-icon-base: #cbd5e1 !important;
                --menu-icon-accent: #06b6d4 !important;
            }

            /* Theme 5: Royal Amber (Luxury Gold & Charcoal) */
            body.theme-royal-amber {
                --primary: #b45309 !important;
                --primary-hover: #92400e !important;
                --accent: #f59e0b !important;
                --accent-hover: #d97706 !important;
                --bg: #fdfbf7 !important;
                --surface: #ffffff !important;
                --border: #fef3c7 !important;
                --text-dark: #1e293b !important;
                --text-muted: #64748b !important;
                --sidebar-bg: #1e293b !important;
                --sidebar-text: #f1f5f9 !important;
                --sidebar-active-bg: #b45309 !important;
                --sidebar-active-text: #ffffff !important;
                --menu-icon-base: #cbd5e1 !important;
                --menu-icon-accent: #f59e0b !important;
            }

            /* Theme 6: Neumorphic Soft-Tactile */
            body.theme-neumorphic {
                --primary: #475569 !important;
                --primary-hover: #334155 !important;
                --accent: #e8681e !important;
                --accent-hover: #c2410c !important;
                --bg: #e0e8f0 !important;
                --surface: #e0e8f0 !important;
                --border: #d1dbe5 !important;
                --text-dark: #1e293b !important;
                --text-muted: #64748b !important;
                --sidebar-bg: #e0e8f0 !important;
                --sidebar-text: #475569 !important;
                --sidebar-active-bg: #ffffff !important;
                --sidebar-active-text: #475569 !important;
                --menu-icon-base: #64748b !important;
                --menu-icon-accent: #e8681e !important;
            }

            /* Theme 7: Premium Dark Theme */
            body.theme-dark {
                --primary: #3a6e71 !important;
                --primary-hover: #2c5557 !important;
                --accent: #f18a31 !important;
                --accent-hover: #d07525 !important;
                --bg: #0f172a !important;
                --surface: #1e293b !important;
                --border: #334155 !important;
                --text-dark: #f8fafc !important;
                --text-muted: #94a3b8 !important;
                --sidebar-bg: #1e293b !important;
                --sidebar-text: #94a3b8 !important;
                --sidebar-active-bg: #3a6e71 !important;
                --sidebar-active-text: #ffffff !important;
                --menu-icon-base: #94a3b8 !important;
                --menu-icon-accent: #3a6e71 !important;
                --card-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
                --card-border: 1px solid #334155 !important;
                --card-radius: 12px !important;
            }
            body.theme-dark .stat-card,
            body.theme-dark .card,
            body.theme-dark .metric-card,
            body.theme-dark .panel-box,
            body.theme-dark .widget,
            body.theme-dark .panel-wrap,
            body.theme-dark .main-card,
            body.theme-dark .calc-panel,
            body.theme-dark .form-container,
            body.theme-dark .table-container,
            body.theme-dark .table-responsive,
            body.theme-dark .lead-table-wrapper {
                background-color: #1e293b !important;
                border: 1px solid #334155 !important;
                color: #f8fafc !important;
            }
            body.theme-dark th {
                background-color: #0f172a !important;
                color: #f8fafc !important;
                border-bottom: 2px solid #334155 !important;
            }
            body.theme-dark td {
                background-color: #1e293b !important;
                color: #e2e8f0 !important;
                border-bottom: 1px solid #334155 !important;
            }
            body.theme-dark tr:hover td {
                background-color: #f18a31 !important;
                color: #ffffff !important;
            }
            body.theme-dark tr:hover td span[style*="background"],
            body.theme-dark tr:hover td span[style*="background-color"],
            body.theme-dark tr:hover td .user-role-badge {
                color: #0f172a !important;
            }

            /* Dark Mode Contrast Overrides for Text & Controls */
            body.theme-dark table td,
            body.theme-dark table td span:not(.status-badge):not(.proj-num):not(.stock-code):not(.proj-pending):not(.sb-planned):not(.sb-inprog):not(.sb-won):not(.act-btn),
            body.theme-dark table td div:not(.actions-cell):not(.status-badge):not(.product-field-group) {
                color: #e2e8f0 !important;
            }
            body.theme-dark tr:hover td,
            body.theme-dark tr:hover td span:not(.status-badge):not(.proj-num):not(.stock-code):not(.proj-pending):not(.sb-planned):not(.sb-inprog):not(.sb-won):not(.act-btn),
            body.theme-dark tr:hover td div:not(.actions-cell):not(.status-badge):not(.product-field-group) {
                color: #ffffff !important;
            }
            body.theme-dark select,
            body.theme-dark select option,
            body.theme-dark input,
            body.theme-dark textarea,
            body.theme-dark .form-control,
            body.theme-dark .form-control-sm,
            body.theme-dark .sm-select,
            body.theme-dark .xero-select,
            body.theme-dark .doc-type,
            body.theme-dark .compact-table input,
            body.theme-dark .compact-table select,
            body.theme-dark .ac-drop li {
                background-color: #0f172a !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }
            body.theme-dark .ac-drop li:hover {
                background-color: #1e293b !important;
                color: #3a6e71 !important;
            }
            body.theme-dark input[readonly],
            body.theme-dark textarea[readonly],
            body.theme-dark .form-control-sm[readonly],
            body.theme-dark .compact-table input[readonly] {
                background-color: #1e293b !important;
                color: #94a3b8 !important;
                border-style: dashed !important;
            }
            body.theme-dark table td .act-btn {
                background-color: #0f172a !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }
            body.theme-dark table td .act-btn:hover {
                background-color: #1e293b !important;
                border-color: #334155 !important;
                color: #ffffff !important;
            }

            body.theme-dark input,
            body.theme-dark select,
            body.theme-dark textarea {
                background-color: #0f172a !important;
                border: 1px solid #334155 !important;
                color: #f8fafc !important;
            }
            body.theme-dark .topbar {
                background-color: #1e293b !important;
                border-bottom: 1px solid #334155 !important;
            }
            body.theme-dark .topbar-tier2 {
                background-color: #1e293b !important;
            }
            body.theme-dark .topbar-title {
                color: #f8fafc !important;
            }
            body.theme-dark .filter-chip {
                background-color: #0f172a !important;
                border-color: #334155 !important;
                color: #e2e8f0 !important;
            }
            body.theme-dark .tb-btn {
                background-color: #3a6e71 !important;
                border-color: #3a6e71 !important;
                color: #ffffff !important;
            }
            body.theme-dark .tb-btn:hover {
                background-color: #2c5557 !important;
            }
            body.theme-dark .btn-add {
                background-color: #3a6e71 !important;
            }
            body.theme-dark .btn-add:hover {
                background-color: #2c5557 !important;
            }
            body.theme-dark #notificationBellBtn {
                background-color: #1e293b !important;
                border-color: #334155 !important;
            }
            body.theme-dark #notificationBellBtn svg {
                stroke: #94a3b8 !important;
            }
            body.theme-dark #notificationDropdownPanel,
            body.theme-dark #topbarUserDropdown {
                background-color: #1e293b !important;
                border-color: #334155 !important;
                color: #f8fafc !important;
            }
            body.theme-dark #notificationList li {
                border-bottom-color: #334155 !important;
            }
            body.theme-dark #dismissAllNotifsBtn {
                color: #f18a31 !important;
            }
            body.theme-dark .tb-notif-bell-wrapper button:hover,
            body.theme-dark .tb-user-profile-wrapper:hover {
                background-color: #0f172a !important;
                border-color: #334155 !important;
            }

            /* Dark Mode Badge Contrast Overrides */
            body.theme-dark .stock-code,
            body.theme-dark .proj-num {
                background-color: #0f172a !important;
                color: #3a6e71 !important;
                border-color: #334155 !important;
            }
            body.theme-dark .proj-pending {
                background-color: rgba(241, 138, 49, 0.15) !important;
                color: #f18a31 !important;
                border-color: rgba(241, 138, 49, 0.3) !important;
            }
            body.theme-dark .sb-planned {
                background-color: rgba(58, 110, 113, 0.15) !important;
                color: #3a6e71 !important;
                border-color: rgba(58, 110, 113, 0.3) !important;
            }
            body.theme-dark .sb-inprog {
                background-color: rgba(245, 158, 11, 0.15) !important;
                color: #f59e0b !important;
                border-color: rgba(245, 158, 11, 0.3) !important;
            }
            body.theme-dark .sb-won {
                background-color: rgba(16, 185, 129, 0.15) !important;
                color: #10b981 !important;
                border-color: rgba(16, 185, 129, 0.3) !important;
            }

            /* Dark Mode Hover Overrides for Badges */
            body.theme-dark tr:hover td .stock-code,
            body.theme-dark tr:hover td .proj-num {
                background-color: #0f172a !important;
                color: #3a6e71 !important;
                border-color: #334155 !important;
            }
            body.theme-dark tr:hover td .proj-pending {
                background-color: rgba(241, 138, 49, 0.2) !important;
                color: #f18a31 !important;
                border-color: rgba(241, 138, 49, 0.4) !important;
            }
            body.theme-dark tr:hover td .sb-planned {
                background-color: rgba(58, 110, 113, 0.2) !important;
                color: #3a6e71 !important;
                border-color: rgba(58, 110, 113, 0.4) !important;
            }
            body.theme-dark tr:hover td .sb-inprog {
                background-color: rgba(245, 158, 11, 0.2) !important;
                color: #f59e0b !important;
                border-color: rgba(245, 158, 11, 0.4) !important;
            }
            body.theme-dark tr:hover td .sb-won {
                background-color: rgba(16, 185, 129, 0.2) !important;
                color: #10b981 !important;
                border-color: rgba(16, 185, 129, 0.4) !important;
            }

            /* Theme Switcher Styles */
            .theme-switch-container {
                background: #f1f5f9;
                border-radius: 8px;
                padding: 3px;
                display: flex;
                align-items: center;
                gap: 2px;
                margin: 8px 12px;
                border: 1px solid #e2e8f0;
                box-sizing: border-box;
            }
            body.theme-dark .theme-switch-container {
                background: #0f172a;
                border-color: #334155;
            }
            .theme-switch-btn {
                flex: 1;
                border: none;
                background: transparent;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 600;
                color: #64748b;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.2s;
                font-family: 'Outfit', sans-serif !important;
                box-sizing: border-box;
                outline: none;
            }
            body.theme-dark .theme-switch-btn {
                color: #94a3b8;
            }
            .theme-switch-btn.active {
                background-color: #3a6e71 !important;
                color: #ffffff !important;
            }
            body.theme-neumorphic .dashboard-card,
            body.theme-neumorphic .metric-card,
            body.theme-neumorphic .card,
            body.theme-neumorphic .panel-box,
            body.theme-neumorphic .widget,
            body.theme-neumorphic .panel-wrap,
            body.theme-neumorphic .main-card,
            body.theme-neumorphic .calc-panel,
            body.theme-neumorphic .form-container,
            body.theme-neumorphic .sidebar {
                box-shadow: 6px 6px 12px #beccd8, -6px -6px 12px #ffffff !important;
                border: none !important;
                background: #e0e8f0 !important;
                border-radius: 16px !important;
            }

            /* Custom Fonts & Styling Overrides */
            body, input, select, textarea, button, p, span:not(.toggle-icon), div, h1, h2, h3, h4, h5, h6, th, td, a {
                font-family: 'Outfit', system-ui, -apple-system, sans-serif !important;
            }

            body {
                background-color: var(--bg) !important;
                color: var(--text-dark) !important;
                transition: background-color 0.3s ease, color 0.3s ease !important;
            }

            /* Global Filter Chip Overrides */
            .filter-chip.fc-active {
                background-color: #3a6e71 !important;
                border-color: #3a6e71 !important;
                color: #ffffff !important;
                box-shadow: 0 2px 6px rgba(58, 110, 113, 0.25) !important;
            }
            .filter-chip:hover {
                background: rgba(58, 110, 113, 0.08) !important;
                color: #3a6e71 !important;
                border-color: #3a6e71 !important;
            }
            .filter-chip.fc-active:hover {
                background-color: #3a6e71 !important;
                color: #ffffff !important;
                border-color: #3a6e71 !important;
            }

            /* Font Clipping & Form Control Adjustments */
            select {
                line-height: 1.3 !important;
                box-sizing: border-box !important;
                vertical-align: middle !important;
            }
            .toolbar-select {
                height: 28px !important;
                line-height: 26px !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            .rows-select {
                height: 28px !important;
                line-height: 26px !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            .compact-table select, 
            .compact-table input {
                height: 28px !important;
                line-height: 24px !important;
                padding-top: 2px !important;
                padding-bottom: 2px !important;
            }

            /* Elegant Sidebar Overrides */
            .sidebar {
                background: var(--sidebar-bg) !important;
                border-right: 1px solid var(--border) !important;
                top: 0 !important;
                height: 100vh !important;
                transition: background 0.3s ease !important;
            }
            .sb-logo {
                border-bottom: 1px solid var(--border) !important;
                background: var(--sidebar-bg) !important;
                transition: background 0.3s ease !important;
            }
            .sb-logo-main {
                color: var(--sidebar-active-text) !important;
            }
            .sidebar .menu-item {
                color: var(--sidebar-text) !important;
                background: transparent !important;
                transition: all 0.2s ease !important;
            }
            .sidebar .menu-item:hover {
                background: rgba(58, 110, 113, 0.15) !important;
                color: var(--sidebar-active-text) !important;
            }
            .sidebar .menu-item.active-menu {
                background: var(--sidebar-active-bg) !important;
                color: var(--sidebar-active-text) !important;
                box-shadow: 0 4px 12px rgba(58, 110, 113, 0.2) !important;
            }
            
            /* Sub-menu Tree Connectors */
            .sub-menu {
                position: relative;
            }
            .sub-menu::before {
                content: '';
                position: absolute;
                left: 14px;
                top: 0;
                bottom: 16px;
                width: 1.5px;
                background-color: #3a6e71 !important; /* Brand Teal */
                opacity: 0.7;
                z-index: 1;
            }
            .sub-menu .menu-item {
                position: relative;
            }
            .sub-menu .menu-item::before {
                content: '';
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                width: 8px;
                height: 1.5px;
                background-color: #3a6e71 !important; /* Brand Teal */
                opacity: 0.7;
                z-index: 1;
            }
            
            /* Level 2 Nesting (padding-left: 36px) */
            .sub-menu .sub-menu::before {
                left: 26px;
            }
            .sub-menu .sub-menu .menu-item::before {
                left: 26px;
            }

            /* Level 3 Nesting (padding-left: 48px) */
            .sub-menu .sub-menu .sub-menu::before {
                left: 38px;
            }
            .sub-menu .sub-menu .sub-menu .menu-item::before {
                left: 38px;
            }
            
            .sb-footer {
                display: none !important;
            }
            .sb-uname {
                color: var(--sidebar-active-text) !important;
            }

            /* Topbar Header Overrides */
            .topbar {
                display: flex !important;
                flex-direction: column !important;
                height: auto !important;
                padding: 0 !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 1000 !important;
                background: var(--surface) !important;
                border-bottom: 1px solid var(--border) !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.01) !important;
                transition: background 0.3s ease !important;
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
                transition: background 0.3s ease !important;
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
                color: var(--text-dark) !important;
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
                border-color: var(--accent) !important;
                color: var(--accent) !important;
            }
            .topbar-btn.btn-deploy {
                background: var(--primary) !important;
                border-color: var(--primary) !important;
                color: var(--surface) !important;
            }
            .topbar-btn.btn-deploy:hover {
                background: var(--primary-hover) !important;
                border-color: var(--primary-hover) !important;
            }
            
            /* Structural adjustments */
            .topbar .topbar-title {
                color: var(--text-dark) !important;
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
                color: var(--text-muted) !important;
                font-size: 12px !important;
            }
            
            /* Reset sidebar and main-wrap to standard height */
            .main-wrap {
                margin-top: 0 !important;
                height: 100vh !important;
                background-color: var(--bg) !important;
                transition: background-color 0.3s ease !important;
            }

            /* Card Styling Overrides (Finexy inspired) */
            .dashboard-card, .metric-card, .card, .grid-box, .panel-box, .stat-box, .widget, .panel-wrap, .main-card, .calc-panel, .form-container {
                background: var(--surface) !important;
                border-radius: var(--card-radius) !important;
                border: var(--card-border) !important;
                box-shadow: var(--card-shadow) !important;
                transition: all 0.3s ease !important;
            }
            .dashboard-card:hover, .metric-card:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.04) !important;
            }

            /* Tables styling (Fluent style) */
            th {
                background: var(--bg) !important;
                color: var(--text-muted) !important;
                font-weight: 600 !important;
                border-bottom: 1px solid var(--border) !important;
                padding: 10px 14px !important;
                transition: background 0.3s ease !important;
            }
            td {
                border-bottom: 1px solid var(--border) !important;
                padding: 12px 14px !important;
                color: var(--text-dark) !important;
                transition: border-bottom 0.3s ease !important;
            }
            tr:hover td {
                background: var(--bg) !important;
            }

            /* Buttons & Actions */
            button.btn-primary, .btn-submit, .tb-btn-close {
                background: var(--primary) !important;
                border-radius: 8px !important;
                color: var(--surface) !important;
                transition: all 0.2s ease !important;
            }
            button.btn-primary:hover, .btn-submit:hover {
                background: var(--primary-hover) !important;
            }
            .highlight-text, .text-accent {
                color: var(--accent) !important;
            }

            /* Form Elements */
            input, select, textarea {
                border-radius: 8px !important;
                border: 1px solid var(--border) !important;
                padding: 6px 10px !important;
                outline: none !important;
                background: var(--surface) !important;
                color: var(--text-dark) !important;
                transition: all 0.3s ease !important;
            }
            input:focus, select:focus {
                border-color: var(--primary) !important;
                box-shadow: 0 0 0 3px rgba(58,110,113,0.1) !important;
            }

            /* Google Address Autocomplete list styling resolution */
            .pac-container {
                z-index: 99999 !important;
                border-radius: 8px !important;
                border: 1px solid var(--border) !important;
                box-shadow: 0 10px 25px rgba(0,0,0,0.06) !important;
                background-color: var(--surface) !important;
            }
            .pac-item {
                padding: 8px 12px !important;
                font-family: 'Outfit', sans-serif !important;
                color: var(--text-muted) !important;
                border-top: 1px solid var(--border) !important;
                cursor: pointer !important;
                transition: background 0.15s ease !important;
            }
            .pac-item-query {
                color: var(--text-dark) !important;
                font-family: 'Outfit', sans-serif !important;
            }
            .pac-item:hover {
                background-color: rgba(241, 138, 49, 0.08) !important; /* Soft Jaffa Orange wash on hover */
            }
            .pac-item:hover .pac-item-query,
            .pac-item:hover span {
                color: var(--text-dark) !important; /* Keep text highly legible and visible */
            }

            /* Action Buttons styling override */
            .act-btn, .btn-del-row {
                background: #ffffff !important;
                border: 1px solid var(--border) !important;
                transition: all 0.2s ease !important;
            }
            .act-btn:hover, .btn-del-row:hover {
                background: rgba(58, 110, 113, 0.08) !important; /* Soft Teal wash on hover */
                border-color: #3A6E71 !important;
            }
            .act-btn:hover svg path, .btn-del-row:hover svg path {
                fill: #3A6E71 !important; /* Recolor base path to Teal */
            }
            .act-btn:hover svg circle, .btn-del-row:hover svg circle,
            .act-btn:hover svg rect, .btn-del-row:hover svg rect,
            .act-btn:hover svg ellipse, .btn-del-row:hover svg ellipse {
                fill: #F18A31 !important; /* Recolor accents to Orange */
            }
            .tb-notif-bell-wrapper button:hover {
                background-color: #f8fafc !important;
                border-color: #cbd5e1 !important;
            }
            .tb-user-profile-wrapper:hover {
                background-color: #f8fafc !important;
                border-color: #e2e8f0 !important;
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

                actionsContainer.appendChild(backupBtn);

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

        // 4. Inject Topbar Right Container dynamically if it is not already there
        if (!tier2.querySelector('.topbar-right-container')) {
            const oldUserDisplay = tier2.querySelector('.user-profile') || tier2.querySelector('.profile-select-wrap') || tier2.querySelector('#currentUserDisplay');
            if (oldUserDisplay) {
                oldUserDisplay.style.setProperty('display', 'none', 'important');
            }

            const rightContainer = document.createElement('div');
            rightContainer.className = 'topbar-right-container';
            rightContainer.style.cssText = 'position: relative; display: flex; align-items: center; gap: 12px; margin-left: auto; z-index: 999999; height: 38px;';
            rightContainer.innerHTML = `
                <!-- Notification Bell -->
                <div class="tb-notif-bell-wrapper" style="position: relative; display: flex; align-items: center; height: 38px;">
                    <button type="button" id="notificationBellBtn" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; background: #ffffff; cursor: pointer; transition: all 0.2s; outline: none; padding: 0;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                        </svg>
                        <span id="notificationBadge" style="display: none; position: absolute; top: -1px; right: -1px; background: #ef4444; color: #fff; font-size: 8px; font-weight: bold; border-radius: 50%; min-width: 14px; height: 14px; align-items: center; justify-content: center; padding: 0 3px; border: 1.5px solid #fff;">0</span>
                    </button>
                    <div id="notificationDropdownPanel" style="display: none; position: absolute; top: 42px; right: 0; width: 320px; background: #fff; border: 1px solid #dde3ed; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100000; max-height: 380px; overflow-y: auto; text-align: left; padding: 4px 0; font-family: 'Outfit', sans-serif;">
                        <div style="padding: 10px 14px; border-bottom: 1px solid #dde3ed; font-weight: bold; font-size: 12px; color: #1c2b3a; display: flex; justify-content: space-between; align-items: center;">
                            <span>Alerts & Notifications</span>
                            <span id="dismissAllNotifsBtn" style="font-size: 10px; color: #e8681e; cursor: pointer; font-weight: 600;">Dismiss All</span>
                        </div>
                        <ul id="notificationList" style="list-style: none; padding: 0; margin: 0; max-height: 300px; overflow-y: auto;">
                            <li style="padding: 14px; text-align: center; color: #6b7a8d; font-size: 12px; font-style: italic;">No new alerts.</li>
                        </ul>
                    </div>
                </div>

                <!-- User Profile Wrapper -->
                <div class="tb-user-profile-wrapper" id="topbarProfileWrapper" style="position: relative; display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 2px 8px; border-radius: 8px; transition: all 0.2s; border: 1px solid transparent; height: 38px; box-sizing: border-box; background: transparent;">
                    <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right; font-family: 'Outfit', sans-serif;">
                        <div id="topbarUserName" style="font-size: 13px; font-weight: 700; color: var(--text-dark); line-height: 1.2; white-space: nowrap;">Loading...</div>
                        <div id="topbarUserRole" style="font-size: 10px; color: var(--text-muted); font-weight: 500; text-transform: capitalize; line-height: 1;">...</div>
                    </div>
                    <div id="topbarUserAvatar" style="width: 30px; height: 30px; border-radius: 50%; background: #3a6e71; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 1px solid var(--border); overflow: hidden; font-family: 'Outfit', sans-serif; flex-shrink: 0;">U</div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0;" id="topbarChevron"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    
                    <!-- User Dropdown Menu -->
                    <div id="topbarUserDropdown" style="display: none; position: absolute; top: 42px; right: 0; width: 180px; background: #ffffff; border: 1px solid #dde3ed; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 100000; padding: 6px 0; font-family: 'Outfit', sans-serif; text-align: left; box-sizing: border-box;">
                        <div style="padding: 8px 14px; border-bottom: 1px solid #f1f5f9; box-sizing: border-box;">
                            <div id="dropdownUserName" style="font-weight: 700; font-size: 13px; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">User</div>
                            <div id="dropdownUserRole" style="font-size: 10px; color: var(--text-muted); text-transform: capitalize;">Staff</div>
                        </div>
                        <div class="theme-switch-container" style="box-sizing: border-box;">
                            <button type="button" class="theme-switch-btn" id="themeSwitchLight">
                                <span>☀️</span> Light
                            </button>
                            <button type="button" class="theme-switch-btn" id="themeSwitchDark">
                                <span>🌙</span> Dark
                            </button>
                        </div>
                        <a href="/logout" style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; font-size: 13px; color: #ef4444; text-decoration: none; font-weight: 600; transition: background 0.15s; box-sizing: border-box;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            <span>Log Out</span>
                        </a>
                    </div>
                </div>
            `;
            
            const userDisplay = tier2.querySelector('.user-profile') || tier2.querySelector('.profile-select-wrap') || tier2.querySelector('#currentUserDisplay') || tier2.querySelector('#sidebarAvatar');
            if (userDisplay) {
                let insertNode = userDisplay;
                while (insertNode && insertNode.parentNode !== tier2) {
                    insertNode = insertNode.parentNode;
                }
                if (insertNode) {
                    tier2.insertBefore(rightContainer, insertNode);
                } else {
                    tier2.appendChild(rightContainer);
                }
            } else {
                tier2.appendChild(rightContainer);
            }
        }

        // Load stored theme or default to theme-ares-sunburst
        try {
            setTimeout(() => {
                const activeTh = localStorage.getItem('crm_selected_theme') || 'theme-ares-sunburst';
                window.setCRMTheme(activeTh);
            }, 100);
        } catch (e) {
            console.error("Initial theme color sync error:", e);
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

        // Profile details logic
        const profileWrapper = document.getElementById('topbarProfileWrapper');
        const userDropdown = document.getElementById('topbarUserDropdown');
        const chevron = document.getElementById('topbarChevron');

        async function fetchUserProfile() {
            try {
                const res = await fetch('/api/me');
                if (res.ok) {
                    const user = await res.json();
                    
                    const nameVal = user.full_name || user.username || "User";
                    const roleVal = user.role || "Staff";
                    const firstLetter = nameVal.charAt(0).toUpperCase();

                    const tbName = document.getElementById('topbarUserName');
                    const tbRole = document.getElementById('topbarUserRole');
                    const tbAvatar = document.getElementById('topbarUserAvatar');
                    const ddName = document.getElementById('dropdownUserName');
                    const ddRole = document.getElementById('dropdownUserRole');

                    if (tbName) tbName.innerText = nameVal;
                    if (tbRole) tbRole.innerText = roleVal;
                    if (tbAvatar) tbAvatar.innerText = firstLetter;
                    if (ddName) ddName.innerText = nameVal;
                    if (ddRole) ddRole.innerText = roleVal;
                }
            } catch (e) {
                console.error("Error fetching topbar user profile:", e);
            }
        }

        function updateSwitcherState() {
            const currentTheme = localStorage.getItem('crm_selected_theme') || 'theme-ares-sunburst';
            const lightBtn = document.getElementById('themeSwitchLight');
            const darkBtn = document.getElementById('themeSwitchDark');
            if (!lightBtn || !darkBtn) return;

            if (currentTheme === 'theme-dark') {
                lightBtn.classList.remove('active');
                darkBtn.classList.add('active');
            } else {
                darkBtn.classList.remove('active');
                lightBtn.classList.add('active');
            }
        }

        if (profileWrapper && userDropdown) {
            profileWrapper.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = userDropdown.style.display === 'block';
                userDropdown.style.display = isVisible ? 'none' : 'block';
                if (chevron) {
                    chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                }
                if (!isVisible) {
                    updateSwitcherState();
                }
            });

            window.addEventListener('click', function(e) {
                if (userDropdown.style.display === 'block' && !profileWrapper.contains(e.target)) {
                    userDropdown.style.display = 'none';
                    if (chevron) {
                        chevron.style.transform = 'rotate(0deg)';
                    }
                }
            });

            const lightBtn = document.getElementById('themeSwitchLight');
            const darkBtn = document.getElementById('themeSwitchDark');
            if (lightBtn && darkBtn) {
                lightBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    window.setCRMTheme('theme-ares-sunburst');
                    updateSwitcherState();
                });
                darkBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    window.setCRMTheme('theme-dark');
                    updateSwitcherState();
                });
            }

            setTimeout(fetchUserProfile, 100);
            setTimeout(updateSwitcherState, 150);
        }

        // ── INJECT FLAT TWO-TONE SOLID SVG ICONS INTO SIDEBAR ────────────────
        try {
            const menuItems = document.querySelectorAll('.sb-menu .menu-item');
            menuItems.forEach(item => {
                const span = item.querySelector('span');
                let text = '';
                if (span) {
                    text = span.textContent.trim();
                } else {
                    text = item.textContent.trim();
                }

                // Skip sub-menu items to avoid duplication
                if (item.style.paddingLeft && parseInt(item.style.paddingLeft, 10) > 10) {
                    return;
                }

                // Remove any old icon elements/emojis/svgs inside the item
                const oldIcons = item.querySelectorAll('.menu-icon, svg, span:not(:last-child)');
                oldIcons.forEach(icon => icon.remove());

                // Prepare new icon SVG markup
                let svgMarkup = '';
                const lowerText = text.toLowerCase();

                if (lowerText === 'home') {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H4a1 1 0 0 1-1-1V9.5z" fill="var(--menu-icon-base)"/>
                            <rect x="10" y="14" width="4" height="7" fill="var(--menu-icon-accent)"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('dashboard')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M12 3a9 9 0 0 0-9 9c0 1.8.53 3.5 1.5 5l1.5-1.5A7 7 0 1 1 19 12a1 1 0 0 0 2 0 9 9 0 0 0-9-9z" fill="var(--menu-icon-base)"/>
                            <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="var(--menu-icon-base)"/>
                            <path d="M12 12l5-5" stroke="var(--menu-icon-accent)" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('lead master') || lowerText.startsWith('leads') || lowerText.startsWith('master leads')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="var(--menu-icon-base)"/>
                            <path d="M9 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="var(--menu-icon-base)"/>
                            <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="var(--menu-icon-accent)"/>
                            <path d="M16 13c-.83 0-2.5.42-3.17 1.05.7.9 1.17 2.05 1.17 3.45v2.5h8v-2.5c0-2.33-4.67-3.5-6-3.5z" fill="var(--menu-icon-accent)"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('projects') || lowerText.startsWith('project') || lowerText.startsWith('active projects')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="var(--menu-icon-base)"/>
                            <circle cx="17" cy="16" r="4.5" fill="var(--menu-icon-accent)"/>
                            <path d="M15 16l1.2 1.2 2.3-2.3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('masters') || lowerText.startsWith('master')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--menu-icon-base)"/>
                            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="var(--menu-icon-base)"/>
                            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--menu-icon-base)"/>
                            <rect x="14" y="3" width="7" height="7" rx="1.5" transform="rotate(45 17.5 6.5)" fill="var(--menu-icon-accent)"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('ares installation') || lowerText.startsWith('installation') || lowerText.startsWith('ares install')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-4 4z" fill="var(--menu-icon-base)"/>
                            <path d="M2 22l8-8" stroke="var(--menu-icon-base)" stroke-width="3" stroke-linecap="round"/>
                            <circle cx="6" cy="18" r="3" fill="var(--menu-icon-accent)"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('user management') || lowerText.startsWith('users')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--menu-icon-base)"/>
                            <circle cx="12" cy="11" r="3" fill="var(--menu-icon-accent)"/>
                            <path d="M12 14v4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    `;
                } else if (lowerText.startsWith('attendance') || lowerText.startsWith('payroll') || lowerText.startsWith('superannuation')) {
                    svgMarkup = `
                        <svg class="menu-icon-svg" width="16" height="16" viewBox="0 0 24 24" style="margin-right: 8px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" fill="var(--menu-icon-base)"/>
                            <rect x="7" y="12" width="6" height="1.5" fill="#ffffff"/>
                            <rect x="7" y="15" width="6" height="1.5" fill="#ffffff"/>
                            <path d="M7 8.5c0-.8.6-1.5 1.5-1.5s1.5.7 1.5 1.5c0 .5-.2.9-.6 1.1l-.8.5c-.3.2-.6.5-.6.9h2" stroke="#ffffff" stroke-width="1" stroke-linecap="round" fill="none"/>
                            <circle cx="18" cy="18" r="5.5" fill="var(--menu-icon-accent)"/>
                            <path d="M18 15.5v2.5h2" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" fill="none"/>
                        </svg>
                    `;
                }

                if (svgMarkup) {
                    item.innerHTML = svgMarkup + `<span>${text}</span>`;
                }
            });
        } catch (e) {
            console.error("Error setting up dynamic sidebar icons:", e);
        }

        // ── DYNAMIC MUTATION OBSERVER FOR TABLE ACTION BUTTONS ────────────────────
        try {
            const actionIcons = {
                'edit': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#3A6E71"/>
                        <path d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83a1 1 0 0 0 0-1.41z" fill="#F18A31"/>
                    </svg>
                `,
                'view log': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="#3A6E71" stroke-width="2.5"/>
                        <path d="M12 6v6h4" stroke="#F18A31" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    </svg>
                `,
                'assign': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="#3A6E71"/>
                        <path d="M12 14c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#3A6E71"/>
                        <circle cx="18" cy="8" r="3.5" fill="#F18A31"/>
                    </svg>
                `,
                'transfer': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6a5.87 5.87 0 0 1-2.8-.7l-1.46 1.46A7.93 7.93 0 0 0 12 20c4.42 0 8-3.58 8-8h3l-4-4z" fill="#3A6E71"/>
                        <path d="M6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46A7.93 7.93 0 0 0 12 4C7.58 4 4 7.58 4 12H1l4 4 4-4H6z" fill="#F18A31"/>
                    </svg>
                `,
                'assign first': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6a5.87 5.87 0 0 1-2.8-.7l-1.46 1.46A7.93 7.93 0 0 0 12 20c4.42 0 8-3.58 8-8h3l-4-4z" fill="#3A6E71"/>
                        <path d="M6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46A7.93 7.93 0 0 0 12 4C7.58 4 4 7.58 4 12H1l4 4 4-4H6z" fill="#F18A31"/>
                    </svg>
                `,
                'delete': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z" fill="#3A6E71"/>
                        <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#F18A31"/>
                    </svg>
                `,
                'approve delete': `
                    <svg width="12" height="12" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle;">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#3A6E71"/>
                    </svg>
                `
            };

            function replaceActionButtons() {
                const buttons = document.querySelectorAll('.act-btn, .btn-del-row');
                buttons.forEach(btn => {
                    if (btn.querySelector('.act-icon-svg-wrapper')) return;

                    const title = (btn.getAttribute('title') || '').toLowerCase().trim();
                    let text = btn.innerText.trim();

                    let key = '';
                    if (title && actionIcons[title]) {
                        key = title;
                    } else if (text === '✏️') {
                        key = 'edit';
                    } else if (text === '🕒') {
                        key = 'view log';
                    } else if (text === '👤') {
                        key = 'assign';
                    } else if (text === '🔄') {
                        key = 'transfer';
                    } else if (text === '🗑️' || btn.classList.contains('act-btn-del') || btn.classList.contains('btn-del-row')) {
                        key = 'delete';
                    } else if (text === '✅') {
                        key = 'approve delete';
                    }

                    if (key && actionIcons[key]) {
                        btn.innerHTML = `<span class="act-icon-svg-wrapper" style="display:inline-flex; align-items:center; justify-content:center; width:100%; height:100%;">${actionIcons[key]}</span>`;
                        btn.style.padding = '0';
                        btn.style.width = '26px';
                        btn.style.height = '26px';
                        btn.style.display = 'inline-flex';
                        btn.style.alignItems = 'center';
                        btn.style.justifyContent = 'center';
                        btn.style.borderRadius = '6px';
                        btn.style.cursor = 'pointer';
                    }
                });
            }

            replaceActionButtons();

            // Set up MutationObserver to automatically swap icons on pagination/filtering
            const observer = new MutationObserver(() => {
                replaceActionButtons();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (err) {
            console.error("Error setting up dynamic table action buttons:", err);
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
