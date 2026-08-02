(function () {
    "use strict";

    // Dynamically insert theme-script.js in head synchronously during parsing
    if (!document.querySelector('script[src*="theme-script.js"]')) {
        const themeScript = document.createElement("script");
        themeScript.src = "/dreams-assets/assets/js/theme-script.js";
        document.head.appendChild(themeScript);
    }

    // Sidebar structure definition matching our Solar CRM modules
    const sidebarHtml = `
    <div class="sidebar" id="sidebar">
        <div class="sidebar-logo">
            <div class="d-flex align-items-center">
                <a href="/home.html" class="logo logo-normal">
                    <img src="averion_logo.jpg" alt="Logo" style="max-height: 40px; border-radius: 4px;">
                </a>
                <a href="/home.html" class="logo-small">
                    <img src="averion_logo.jpg" alt="Logo" style="max-height: 30px; border-radius: 4px;">
                </a>
                <span class="ms-2 fw-bold text-dark d-none-mini" style="font-size: 14px; white-space: nowrap;">Solar CRM</span>
            </div>
            <button class="sidenav-toggle-btn btn border-0 p-0 active" id="toggle_btn">
                <i class="ti ti-arrow-bar-to-left"></i>
            </button>
            <button class="sidebar-close">
                <i class="ti ti-x align-middle"></i>
            </button>
        </div>
        <div class="sidebar-inner" data-simplebar>
            <div id="sidebar-menu" class="sidebar-menu">
                <ul>
                    <li class="menu-title"><span>Main Menu</span></li>
                    <li>
                        <ul>
                            <li><a href="/home.html" class="menu-item-link" id="nav-home"><i class="ti ti-home"></i><span>Home</span></a></li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-dashboard"></i><span>Dashboard</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/dashboard_sales.html" class="menu-item-link" id="nav-dash-sales">Sales</a></li>
                                    <li><a href="/dashboard_installation.html" class="menu-item-link" id="nav-dash-inst">Installation</a></li>
                                    <li><a href="/dashboard_service.html" class="menu-item-link" id="nav-dash-serv">Service</a></li>
                                    <li><a href="/dashboard_ares_installation.html" class="menu-item-link" id="nav-dash-ares">Ares Installation</a></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    
                    <li class="menu-title"><span>CRM</span></li>
                    <li>
                        <ul>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-chart-arcs"></i><span>Lead Master</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/" class="menu-item-link" id="nav-master-leads">Master Leads</a></li>
                                    <li><a href="/delete_leads.html" class="menu-item-link" id="nav-delete-leads">Delete Leads</a></li>
                                    <li><a href="/duplicate_leads.html" class="menu-item-link" id="nav-duplicate-leads">Duplicate Leads</a></li>
                                    <li><a href="/lead_approvals.html" class="menu-item-link" id="nav-lead-approvals">Lead Approvals</a></li>
                                </ul>
                            </li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-user-up"></i><span>Sales</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/project_leads.html" class="menu-item-link" id="nav-project-leads">Leads</a></li>
                                </ul>
                            </li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-box"></i><span>Masters</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/products.html" class="menu-item-link" id="nav-product-master">Product Master</a></li>
                                    <li><a href="/combo_master.html" class="menu-item-link" id="nav-combo-master">Combo Master</a></li>
                                    <li><a href="/email_templates.html" class="menu-item-link" id="nav-email-templates">Email Templates Master</a></li>
                                    <li><a href="/stc_master.html" class="menu-item-link" id="nav-stc-master">STC Master</a></li>
                                    <li><a href="/rebate_live_master.html" class="menu-item-link" id="nav-rebate-master">Rebate Live Master</a></li>
                                    <li><a href="/margin_master.html" class="menu-item-link" id="nav-margin-master">Margin Master</a></li>
                                    <li><a href="/installation_charges.html" class="menu-item-link" id="nav-install-charges">Installation Charges Master</a></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    
                    <li class="menu-title"><span>Operations</span></li>
                    <li>
                        <ul>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-building-community"></i><span>Ares Installation</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/installations.html" class="menu-item-link" id="nav-installations">Installations</a></li>
                                    <li class="submenu submenu-two">
                                        <a href="javascript:void(0);">Payment Status<span class="menu-arrow inside-submenu"></span></a>
                                        <ul>
                                            <li><a href="/outstanding_payments.html" class="menu-item-link" id="nav-out-pay">Outstanding Payments</a></li>
                                            <li><a href="/paid_payments.html" class="menu-item-link" id="nav-paid-pay">Paid Payments</a></li>
                                        </ul>
                                    </li>
                                    <li><a href="/company_details.html" class="menu-item-link" id="nav-company-details">Company Details</a></li>
                                </ul>
                            </li>
                            <li><a href="/admin.html" class="menu-item-link" id="nav-user-mgmt"><i class="ti ti-users-group"></i><span>User Management</span></a></li>
                        </ul>
                    </li>
                    
                    <li class="menu-title"><span>Payroll & Compliance</span></li>
                    <li>
                        <ul>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-list-check"></i><span>Ares & Gill's</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li class="submenu submenu-two">
                                        <a href="javascript:void(0);">Employees Mgmt<span class="menu-arrow inside-submenu"></span></a>
                                        <ul>
                                            <li><a href="/attendance.html" class="menu-item-link" id="nav-emp-employees">Employees</a></li>
                                            <li><a href="/attendance.html#leave" class="menu-item-link" id="nav-emp-leave">Leave</a></li>
                                            <li><a href="/attendance.html#timesheets" class="menu-item-link" id="nav-emp-timesheets">Timesheets</a></li>
                                        </ul>
                                    </li>
                                    <li class="submenu submenu-two">
                                        <a href="javascript:void(0);">Payroll Processing<span class="menu-arrow inside-submenu"></span></a>
                                        <ul>
                                            <li><a href="/attendance.html#pay" class="menu-item-link" id="nav-pay-employee">Pay Employees</a></li>
                                            <li><a href="/attendance.html#super" class="menu-item-link" id="nav-superannuation">Superannuation</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-list-check"></i><span>Averion Global</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li class="submenu submenu-two">
                                        <a href="javascript:void(0);">Employees Mgmt<span class="menu-arrow inside-submenu"></span></a>
                                        <ul>
                                            <li><a href="/attendance.html#averion-employees" class="menu-item-link" id="nav-averion-employees">Employees</a></li>
                                            <li><a href="/attendance.html#averion-leave" class="menu-item-link" id="nav-averion-leave">Leave</a></li>
                                            <li><a href="/attendance.html#averion-timesheets" class="menu-item-link" id="nav-averion-timesheets">Timesheets</a></li>
                                        </ul>
                                    </li>
                                    <li class="submenu submenu-two">
                                        <a href="javascript:void(0);">Payroll Processing<span class="menu-arrow inside-submenu"></span></a>
                                        <ul>
                                            <li><a href="/attendance.html#averion-pay" class="menu-item-link" id="nav-averion-pay">Pay Employees</a></li>
                                            <li><a href="/attendance.html#averion-pt" class="menu-item-link" id="nav-averion-pt">Professional Tax</a></li>
                                            <li><a href="/attendance.html#averion-tax-slab" class="menu-item-link" id="nav-averion-tax-slab">Income Tax Slab</a></li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </div>
    `;

    // Topbar header HTML template
    const headerHtml = `
    <header class="navbar-header">
        <div class="page-container topbar-menu">
            <div class="header-left d-flex align-items-center gap-2">
                <!-- Logo -->
                <a href="/home.html" class="logo">
                    <span class="logo-light">
                        <span class="logo-lg"><img src="averion_logo.jpg" alt="logo" style="max-height: 40px; border-radius: 4px;"></span>
                        <span class="logo-sm"><img src="averion_logo.jpg" alt="small logo" style="max-height: 30px; border-radius: 4px;"></span>
                    </span>
                </a>

                <!-- Sidebar Mobile Toggle -->
                <a id="mobile_btn" class="mobile-btn" href="#sidebar">
                    <i class="ti ti-menu-deep fs-24"></i>
                </a>

                <button class="sidenav-toggle-btn btn border-0 p-0" id="toggle_btn2">
                    <i class="ti ti-arrow-bar-to-right"></i>
                </button>

                <!-- Global Search -->
                <div class="me-auto d-flex align-items-center header-search d-lg-flex d-none search-wrap" style="position: relative; max-width: 320px; margin-left: 15px;">
                    <div class="input-icon position-relative me-2" style="width: 100%;">
                        <input type="text" class="form-control" id="globalOmniSearchInput" placeholder="Search Keyword" autocomplete="off">
                        <span class="input-icon-addon d-inline-flex p-0 header-search-icon"><i class="ti ti-command"></i></span>
                    </div>
                    <div id="globalOmniDropdown" style="position: absolute; top: calc(100% + 5px); left: 0; width: 100%; background: #ffffff; border: 1px solid #e8e8e8; border-radius: 8px; max-height: 250px; overflow-y: auto; display: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 1000; padding: 4px 0;"></div>
                </div>
                
                <h4 class="mb-0 ms-3 d-none d-md-inline-block text-dark fw-bold" id="pageHeaderTitle">Dashboard</h4>
            </div>

            <div class="d-flex align-items-center">
                <!-- Minimize -->
                <div class="header-item">
                    <div class="dropdown me-2">
                        <a href="javascript:void(0);" class="btn topbar-link btnFullscreen"><i class="ti ti-maximize"></i></a>
                    </div>
                </div>

                <!-- Light/Dark Mode Button -->
                <div class="header-item me-2">
                    <button class="topbar-link btn" id="light-dark-mode" type="button">
                        <i class="ti ti-moon fs-16"></i>
                    </button>
                </div>

                <!-- User Dropdown -->
                <div class="dropdown profile-dropdown d-flex align-items-center justify-content-center">
                    <a href="javascript:void(0);" class="topbar-link dropdown-toggle drop-arrow-none position-relative" data-bs-toggle="dropdown" aria-haspopup="false" aria-expanded="false">
                        <div class="avatar avatar-sm rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" id="headerUserAvatar" style="width: 38px; height: 38px; font-weight:700;">U</div>
                        <span class="online text-success"><i class="ti ti-circle-filled d-flex bg-white rounded-circle border border-1 border-white"></i></span>
                    </a>
                    <div class="dropdown-menu dropdown-menu-end dropdown-menu-md p-2">
                        <div class="d-flex align-items-center bg-light rounded-3 p-2 mb-2">
                            <div class="avatar avatar-md rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" id="dropdownUserAvatar" style="width:42px; height:42px; font-weight:700;">U</div>
                            <div class="ms-2">
                                <p class="fw-medium text-dark mb-0" id="dropdownUserName">Loading...</p>
                                <span class="d-block fs-13 text-muted" id="dropdownUserRole">...</span>
                            </div>
                        </div>
                        <div class="pt-2 mt-2 border-top">
                            <a href="/logout" class="dropdown-item text-danger">
                                <i class="ti ti-logout me-1 fs-17 align-middle"></i>
                                <span class="align-middle">Sign Out</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>
    `;

    // Wait until document is ready to rewrite layout
    document.addEventListener("DOMContentLoaded", function () {
        // Move any body style tags to the head so they are preserved
        document.body.querySelectorAll("style").forEach(styleEl => {
            if (styleEl.parentElement !== document.head) {
                document.head.appendChild(styleEl);
            }
        });

        // Strip legacy layout overrides from inline style tags to prevent theme conflicts
        document.querySelectorAll("style").forEach(styleEl => {
            if (!styleEl.id) {
                let css = styleEl.innerHTML;
                css = css.replace(/\*\s*\{\s*box-sizing:\s*border-box;\s*margin:\s*0;\s*padding:\s*0;\s*\}/g, '');
                css = css.replace(/body\s*\{\s*font-family:\s*['"]Golos\s*Text['"][^}]+?\}/g, '');
                css = css.replace(/\/\*\s*=+\s*SIDEBAR\s*=+\s*\*\/[\s\S]+?(?=\/\*\s*=+\s*(?:STATS ROW|CONTENT AREA & TOOLBAR|HORIZONTAL METADATA STRIP|WORKSPACE CONTENT|ENGINEERING GRID)\s*=+\s*\*\/)/g, '');
                styleEl.innerHTML = css;
            }
        });

        // 1. Get original page title
        const originalTitle = document.getElementById("pageTitle") || document.querySelector("title");
        const pageTitleText = originalTitle ? originalTitle.innerText.split(" - ")[0] : "Solar CRM";

        // 2. Locate core content on the page
        // If there's an existing .main-wrap, we pull its inner elements
        const oldMainWrap = document.querySelector(".main-wrap");
        const oldTopbar = document.querySelector(".topbar");
        const oldSidebar = document.querySelector(".sidebar");
        const oldScriptController = document.querySelector("script[src*='responsive.js']");

        // Preserve userProfile hidden input if it exists
        const userProfileInput = document.getElementById("userProfile");
        if (userProfileInput) {
            document.body.appendChild(userProfileInput);
        }

        // Remove old sidebar and topbar elements from DOM
        if (oldSidebar) oldSidebar.remove();
        if (oldTopbar) oldTopbar.remove();

        // Target content container
        let contentContainer;
        if (oldMainWrap) {
            contentContainer = oldMainWrap;
        } else {
            contentContainer = document.body;
        }

        // Keep content children
        const contentChildren = Array.from(contentContainer.children).filter(child => {
            // Keep everything that's not a topbar, sidebar, scripts, or simple metadata
            return !child.classList.contains("sidebar") && 
                   !child.classList.contains("topbar") && 
                   child.tagName !== "SCRIPT" && 
                   child.tagName !== "STYLE";
        });

        // 3. Create the new wrapper structure
        const mainWrapperDiv = document.createElement("div");
        mainWrapperDiv.className = "main-wrapper";

        // Inject header and sidebar inside mainWrapper
        mainWrapperDiv.innerHTML = headerHtml + sidebarHtml;

        // Create page-wrapper & content wrapper
        const pageWrapperDiv = document.createElement("div");
        pageWrapperDiv.className = "page-wrapper";
        const contentDiv = document.createElement("div");
        contentDiv.className = "content";

        pageWrapperDiv.appendChild(contentDiv);
        mainWrapperDiv.appendChild(pageWrapperDiv);

        // Move all content children into the new contentDiv
        contentChildren.forEach(child => {
            contentDiv.appendChild(child);
        });

        // Clean body and insert new mainWrapper
        if (oldMainWrap) oldMainWrap.remove();
        
        // Find existing scripts in body to insert mainWrapper before them
        const firstScript = document.body.querySelector("script");
        if (firstScript) {
            document.body.insertBefore(mainWrapperDiv, firstScript);
        } else {
            document.body.appendChild(mainWrapperDiv);
        }

        // Set topbar page header title
        const headerTitleEl = document.getElementById("pageHeaderTitle");
        if (headerTitleEl) headerTitleEl.innerText = pageTitleText;

        // 4. Handle active menu state selection based on path + hash
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        let targetLinkId = "";

        // Determine link id
        if (currentPath === "/home.html") {
            targetLinkId = "nav-home";
        } else if (currentPath === "/dashboard_sales.html") {
            targetLinkId = "nav-dash-sales";
        } else if (currentPath === "/dashboard_installation.html") {
            targetLinkId = "nav-dash-inst";
        } else if (currentPath === "/dashboard_service.html") {
            targetLinkId = "nav-dash-serv";
        } else if (currentPath === "/dashboard_ares_installation.html") {
            targetLinkId = "nav-dash-ares";
        } else if (currentPath === "/" || currentPath === "/index.html") {
            targetLinkId = "nav-master-leads";
        } else if (currentPath === "/delete_leads.html") {
            targetLinkId = "nav-delete-leads";
        } else if (currentPath === "/duplicate_leads.html") {
            targetLinkId = "nav-duplicate-leads";
        } else if (currentPath === "/lead_approvals.html") {
            targetLinkId = "nav-lead-approvals";
        } else if (currentPath === "/project_leads.html") {
            targetLinkId = "nav-project-leads";
        } else if (currentPath === "/products.html") {
            targetLinkId = "nav-product-master";
        } else if (currentPath === "/combo_master.html") {
            targetLinkId = "nav-combo-master";
        } else if (currentPath === "/email_templates.html") {
            targetLinkId = "nav-email-templates";
        } else if (currentPath === "/stc_master.html") {
            targetLinkId = "nav-stc-master";
        } else if (currentPath === "/rebate_live_master.html") {
            targetLinkId = "nav-rebate-master";
        } else if (currentPath === "/margin_master.html") {
            targetLinkId = "nav-margin-master";
        } else if (currentPath === "/installation_charges.html") {
            targetLinkId = "nav-install-charges";
        } else if (currentPath === "/installations.html") {
            targetLinkId = "nav-installations";
        } else if (currentPath === "/outstanding_payments.html") {
            targetLinkId = "nav-out-pay";
        } else if (currentPath === "/paid_payments.html") {
            targetLinkId = "nav-paid-pay";
        } else if (currentPath === "/company_details.html") {
            targetLinkId = "nav-company-details";
        } else if (currentPath === "/admin.html") {
            targetLinkId = "nav-user-mgmt";
        } else if (currentPath === "/attendance.html") {
            // Check hash values for attendance
            if (currentHash === "#leave") {
                targetLinkId = "nav-emp-leave";
            } else if (currentHash === "#timesheets") {
                targetLinkId = "nav-emp-timesheets";
            } else if (currentHash === "#pay") {
                targetLinkId = "nav-emp-pay";
            } else if (currentHash === "#super") {
                targetLinkId = "nav-emp-super";
            } else if (currentHash === "#averion-employees") {
                targetLinkId = "nav-averion-employees";
            } else if (currentHash === "#averion-leave") {
                targetLinkId = "nav-averion-leave";
            } else if (currentHash === "#averion-timesheets") {
                targetLinkId = "nav-averion-timesheets";
            } else if (currentHash === "#averion-pay") {
                targetLinkId = "nav-averion-pay";
            } else if (currentHash === "#averion-pt") {
                targetLinkId = "nav-averion-pt";
            } else if (currentHash === "#averion-tax-slab") {
                targetLinkId = "nav-averion-tax-slab";
            } else {
                targetLinkId = "nav-emp-employees";
            }
        }

        if (targetLinkId) {
            const activeEl = document.getElementById(targetLinkId);
            if (activeEl) {
                activeEl.classList.add("active");
            }
        }

        // 5. Fetch Logged-in User Session Details
        (async function fetchSessionUser() {
            try {
                const res = await fetch("/api/me");
                if (res.status === 401) {
                    window.location.href = "/login.html";
                    return;
                }
                const user = await res.json();
                const userName = user.full_name || user.username || 'System';
                const userRole = user.role || 'Standard';

                // Update Profile UI elements
                const headerAvatar = document.getElementById("headerUserAvatar");
                const dropAvatar = document.getElementById("dropdownUserAvatar");
                const dropName = document.getElementById("dropdownUserName");
                const dropRole = document.getElementById("dropdownUserRole");

                const initials = userName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

                if (headerAvatar) headerAvatar.innerText = initials;
                if (dropAvatar) dropAvatar.innerText = initials;
                if (dropName) dropName.innerText = userName;
                if (dropRole) dropRole.innerText = userRole === 'Admin' || userRole === 'Manager' ? "Admin Access" : userRole;

                // Sync hidden role field if any page uses it
                const userProfileHidden = document.getElementById("userProfile");
                if (userProfileHidden) userProfileHidden.value = userRole;

                // 6. Sidebar Permissions management
                if (userRole !== 'Admin') {
                    try {
                        const pRes = await fetch(`/api/role-permissions/${userRole}`);
                        if (pRes.ok) {
                            const matrix = await pRes.json();
                            const checkPermission = (targetId, mod, feat) => {
                                if (!matrix[mod] || !matrix[mod][feat]) {
                                    const el = document.getElementById(targetId);
                                    if (el) {
                                        // Hide item li
                                        const li = el.closest("li");
                                        if (li) li.style.display = 'none';
                                    }
                                }
                            };

                            // Run permission checks
                            checkPermission('nav-products', 'Masters', 'Manage Products');
                            checkPermission('nav-combo', 'Masters', 'Manage Products');
                            checkPermission('nav-stc', 'Masters', 'Manage STC');
                            checkPermission('nav-rebate', 'Masters', 'Manage Rebates');
                            checkPermission('nav-margin', 'Masters', 'Manage Margins');
                            checkPermission('nav-charges', 'Masters', 'Manage Charges');
                            checkPermission('nav-installations', 'Ares Installation Outside', 'Installations');
                            checkPermission('nav-out-pay', 'Ares Installation Outside', 'Outstanding Payments');
                            checkPermission('nav-paid-pay', 'Ares Installation Outside', 'Paid Payments');
                            checkPermission('nav-company', 'Ares Installation Outside', 'Company Details');
                            checkPermission('nav-user-mgmt', 'Settings', 'Manage Users');
                            checkPermission('nav-project-leads', 'Sales', 'Leads');
                            checkPermission('nav-lead-approvals', 'Lead Master', 'Lead Approvals');
                            
                            checkPermission('nav-emp-employees', 'Attendance & Payroll', 'Employees');
                            checkPermission('nav-emp-leave', 'Attendance & Payroll', 'Leave');
                            checkPermission('nav-emp-timesheets', 'Attendance & Payroll', 'Timesheets');
                            checkPermission('nav-pay-employee', 'Attendance & Payroll', 'Pay Employee');
                            checkPermission('nav-superannuation', 'Attendance & Payroll', 'Superannuation');

                            // Hide empty parent submenus
                            document.querySelectorAll('.sidebar .submenu').forEach(sub => {
                                const subLinks = Array.from(sub.querySelectorAll('ul li a'));
                                if (subLinks.length > 0 && subLinks.every(a => a.closest('li').style.display === 'none')) {
                                    sub.style.display = 'none';
                                }
                            });
                        }
                    } catch (err) {
                        console.error("Error fetching permissions:", err);
                    }
                }
            } catch (e) {
                console.error("Session fetch failed:", e);
                window.location.href = "/login.html";
            }
        })();

        // 6. Bind Fullscreen Mode Trigger
        const fullscreenBtn = document.querySelector(".btnFullscreen");
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", function () {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log(`Error enabling full-screen: ${err.message}`);
                    });
                } else {
                    document.exitFullscreen();
                }
            });
        }

        // 7. Global Omnibox Search Logic (Debounced Fetch)
        const searchInput = document.getElementById('globalOmniSearchInput');
        const searchDropdown = document.getElementById('globalOmniDropdown');
        let searchTimeout;

        if (searchInput && searchDropdown) {
            searchInput.addEventListener('input', function(e) {
                const query = e.target.value.trim();
                clearTimeout(searchTimeout);

                if (query.length < 2) {
                    searchDropdown.style.display = 'none';
                    return;
                }

                searchTimeout = setTimeout(() => {
                    fetch('/api/projects/global-search?q=' + encodeURIComponent(query))
                        .then(res => res.json())
                        .then(data => {
                            searchDropdown.innerHTML = '';
                            if (data && data.length > 0) {
                                data.forEach(item => {
                                    const div = document.createElement('div');
                                    div.className = 'omni-result-item';
                                    div.style.padding = '8px 12px';
                                    div.style.borderBottom = '1px solid #f1f5f9';
                                    div.style.cursor = 'pointer';
                                    div.style.fontSize = '12px';
                                    div.style.color = '#1f2020';
                                    div.textContent = `${item.project_number || 'No Ref'} - ${item.first_name} ${item.last_name || ''} - ${item.address || ''}`;
                                    div.onclick = () => {
                                        window.location.href = `/index.html?search=${item.project_number}`;
                                    };
                                    searchDropdown.appendChild(div);
                                });
                                searchDropdown.style.display = 'block';
                            } else {
                                searchDropdown.innerHTML = '<div class="omni-result-item" style="padding: 8px 12px; font-size:12px; color:#707070;">No results found</div>';
                                searchDropdown.style.display = 'block';
                            }
                        })
                        .catch(err => console.error('Search error:', err));
                }, 300);
            });

            // Close Omnibox on outside click
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-wrap')) {
                    searchDropdown.style.display = 'none';
                }
            });
        }

        // ── Global Actions Formatting System ──
        // Inject global action button overrides CSS
        const globalStyle = document.createElement("style");
        globalStyle.id = "global-action-overrides";
        globalStyle.innerHTML = `
            th:last-child, td:last-child {
                min-width: 110px !important;
                white-space: nowrap !important;
                text-align: center !important;
            }
            .actions-cell, td div[style*="display: grid; grid-template-columns: repeat(2, 1fr)"] {
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                width: auto !important;
                margin: auto !important;
            }
            .act-btn {
                width: 28px !important;
                height: 28px !important;
                border-radius: 50% !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid #cbd5e1 !important;
                background: #ffffff !important;
                color: #475569 !important;
                cursor: pointer !important;
                transition: all 0.2s ease-in-out !important;
                padding: 0 !important;
                font-size: 14px !important;
                margin: 0 !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
            }
            .act-btn i {
                font-size: 14px !important;
                line-height: 1 !important;
                display: inline-block !important;
            }
            .act-btn:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
            }
            .act-btn[title="Edit"]:hover {
                background: #0284c7 !important;
                color: #ffffff !important;
                border-color: #0284c7 !important;
            }
            .act-btn[title="History"]:hover,
            .act-btn[title="View Log"]:hover {
                background: #64748b !important;
                color: #ffffff !important;
                border-color: #64748b !important;
            }
            .act-btn-del:hover,
            .act-btn[title="Delete"]:hover {
                background: #ef4444 !important;
                color: #ffffff !important;
                border-color: #ef4444 !important;
            }
            .act-btn[title="Assign"]:hover {
                background: #10b981 !important;
                color: #ffffff !important;
                border-color: #10b981 !important;
            }
            .act-btn[title="Transfer"]:hover {
                background: #f59e0b !important;
                color: #ffffff !important;
                border-color: #f59e0b !important;
            }
            .act-btn[title="Approve Delete"]:hover {
                background: #10b981 !important;
                color: #ffffff !important;
                border-color: #10b981 !important;
            }
            .act-btn:disabled {
                opacity: 0.4 !important;
                cursor: not-allowed !important;
                transform: none !important;
                box-shadow: none !important;
            }
        `;
        document.head.appendChild(globalStyle);

        // Run replacing logic
        function replaceEmojisWithIcons() {
            document.querySelectorAll(".act-btn").forEach(btn => {
                if (btn.querySelector("i")) return;

                const title = (btn.getAttribute("title") || "").toLowerCase();
                const text = btn.textContent.trim();

                let iconClass = "";
                if (title === "edit" || text === "✏️") {
                    iconClass = "ti ti-edit";
                } else if (title === "history" || title === "view log" || text === "🕒") {
                    iconClass = "ti ti-history";
                } else if (title === "delete" || text === "🗑️") {
                    iconClass = "ti ti-trash";
                } else if (title === "assign" || text === "👤") {
                    iconClass = "ti ti-user-plus";
                } else if (title === "transfer" || text === "🔄") {
                    iconClass = "ti ti-refresh";
                } else if (title === "approve delete" || text === "✅") {
                    iconClass = "ti ti-check";
                } else if (title.includes("view") || text === "📄") {
                    iconClass = "ti ti-file-text";
                }

                if (iconClass) {
                    btn.innerHTML = `<i class="${iconClass}"></i>`;
                }
            });
        }

        // Run immediately
        replaceEmojisWithIcons();

        // Setup observer
        const observer = new MutationObserver(() => {
            replaceEmojisWithIcons();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
