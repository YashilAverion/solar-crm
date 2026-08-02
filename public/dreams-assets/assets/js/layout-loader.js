(function () {
    "use strict";

    // Centralized Search Input Bridge to prevent null crashes and enable global search filtering
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
        let el = originalGetElementById.apply(this, arguments);
        if (!el && (id === 'globalSearch' || id === 'searchInput' || id === 'txtSearch')) {
            el = originalGetElementById.call(this, 'globalOmniSearchInput') || 
                 document.querySelector('.search-wrap input') || 
                 document.querySelector('.header-search input');
        }
        return el;
    };


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
                    <img src="/dreams-assets/assets/img/logo.svg" alt="Logo">
                </a>
                <a href="/home.html" class="logo-small">
                    <img src="/dreams-assets/assets/img/logo-small.svg" alt="Logo">
                </a>
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
                                <a href="javascript:void(0);"><i class="ti ti-folder-check"></i><span>Ares & Gill's</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/attendance.html" class="menu-item-link" id="nav-emp-employees">Employees</a></li>
                                    <li><a href="/attendance.html#leave" class="menu-item-link" id="nav-emp-leave">Leaves</a></li>
                                    <li><a href="/attendance.html#timesheets" class="menu-item-link" id="nav-emp-timesheets">Timesheets</a></li>
                                    <li><a href="/attendance.html#pay" class="menu-item-link" id="nav-emp-pay">Pay Employee</a></li>
                                    <li><a href="/attendance.html#super" class="menu-item-link" id="nav-emp-super">Superannuation</a></li>
                                </ul>
                            </li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-file-text"></i><span>Averion Global</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/attendance.html#averion-employees" class="menu-item-link" id="nav-averion-employees">Employees</a></li>
                                    <li><a href="/attendance.html#averion-leave" class="menu-item-link" id="nav-averion-leave">Leaves</a></li>
                                    <li><a href="/attendance.html#averion-timesheets" class="menu-item-link" id="nav-averion-timesheets">Timesheets</a></li>
                                    <li><a href="/attendance.html#averion-pay" class="menu-item-link" id="nav-averion-pay">Pay Employee</a></li>
                                    <li><a href="/attendance.html#averion-pt" class="menu-item-link" id="nav-averion-pt">PT Slab</a></li>
                                    <li><a href="/attendance.html#averion-tax-slab" class="menu-item-link" id="nav-averion-tax-slab">Income Tax Slab</a></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </div>
    `;

    const headerHtml = `
    <header class="navbar-header">
        <div class="page-container topbar-menu">
            <div class="header-left d-flex align-items-center gap-2">
                <!-- Logo -->
                <a href="/home.html" class="logo">
                    <span class="logo-light">
                        <span class="logo-lg"><img src="/dreams-assets/assets/img/logo.svg" alt="logo" style="max-height: 38px;"></span>
                        <span class="logo-sm"><img src="/dreams-assets/assets/img/logo-small.svg" alt="small logo" style="max-height: 30px;"></span>
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

                <!-- Dashboard/Grid Shortcut Icon -->
                <div class="header-item me-2">
                    <a href="/home.html" class="btn topbar-link d-inline-flex align-items-center justify-content-center p-0" style="background: #e0f2fe; color: #0284c7; border-radius: 8px; width: 34px; height: 34px;">
                        <i class="ti ti-layout-grid fs-16"></i>
                    </a>
                </div>

                <!-- Security/Shield Shortcut Icon -->
                <div class="header-item me-2">
                    <a href="/admin.html" class="btn topbar-link d-inline-flex align-items-center justify-content-center p-0" style="background: #f3e8ff; color: #7e22ce; border-radius: 8px; width: 34px; height: 34px;">
                        <i class="ti ti-shield fs-16"></i>
                    </a>
                </div>

                <!-- Logs/Document Shortcut Icon -->
                <div class="header-item me-2">
                    <a href="/activity_logs.html" class="btn topbar-link d-inline-flex align-items-center justify-content-center p-0" style="background: #fef3c7; color: #d97706; border-radius: 8px; width: 34px; height: 34px;">
                        <i class="ti ti-file-text fs-16"></i>
                    </a>
                </div>

                <!-- Vertical Divider -->
                <div style="width: 1px; height: 24px; background: #e2e8f0; margin: 0 10px 0 6px;"></div>

                <!-- Notification Bell -->
                <div class="header-item me-2 position-relative">
                    <a href="javascript:void(0);" class="btn topbar-link d-inline-flex align-items-center justify-content-center p-0">
                        <i class="ti ti-bell fs-20" style="color: #64748b;"></i>
                    </a>
                    <span class="position-absolute translate-middle p-1 bg-danger border border-light rounded-circle" style="top: 8px; right: -2px;"></span>
                </div>

                <!-- Activity Flag -->
                <div class="header-item me-3 position-relative">
                    <a href="javascript:void(0);" class="btn topbar-link d-inline-flex align-items-center justify-content-center p-0">
                        <i class="ti ti-flag fs-20" style="color: #64748b;"></i>
                    </a>
                    <span class="position-absolute translate-middle p-1 bg-danger border border-light rounded-circle" style="top: 8px; right: -2px;"></span>
                </div>

                <!-- User Dropdown -->
                <div class="dropdown profile-dropdown d-flex align-items-center justify-content-center">
                    <a href="javascript:void(0);" class="topbar-link dropdown-toggle drop-arrow-none position-relative" data-bs-toggle="dropdown" aria-haspopup="false" aria-expanded="false">
                        <div class="user-info d-flex align-items-center position-relative">
                            <img src="/dreams-assets/assets/img/profiles/avatar-02.jpg" alt="User Profile" class="rounded-circle border" style="width: 36px; height: 36px; object-fit: cover;" id="headerUserAvatarImg" onError="this.style.display='none'; document.getElementById('headerUserAvatarText').style.display='flex';">
                            <span class="avatar avatar-md rounded-circle bg-danger text-white d-none align-items-center justify-content-center fw-bold" id="headerUserAvatarText" style="width: 36px; height: 36px; font-size: 13px;">SU</span>
                            <span class="position-absolute bottom-0 end-0 p-1 bg-success border border-light rounded-circle" style="transform: translate(2px, 2px);"></span>
                        </div>
                    </a>
                    <div class="dropdown-menu dropdown-menu-end p-0">
                        <div class="d-flex align-items-center p-3 border-bottom rounded-top">
                            <img src="/dreams-assets/assets/img/profiles/avatar-02.jpg" alt="User Profile" class="rounded-circle border" style="width: 48px; height: 48px; object-fit: cover;" id="dropdownUserAvatarImg" onError="this.style.display='none'; document.getElementById('dropdownUserAvatarText').style.display='flex';">
                            <span class="avatar avatar-lg rounded-circle bg-danger text-white d-none align-items-center justify-content-center fw-bold" id="dropdownUserAvatarText" style="width: 48px; height: 48px; font-size: 16px;">SU</span>
                            <div class="ms-2">
                                <h6 class="mb-0 text-dark fw-bold" id="dropdownUserName">System User</h6>
                                <span class="fs-12 text-muted" id="dropdownUserRole">Standard Role</span>
                            </div>
                        </div>
                        <div class="p-1">
                            <a class="dropdown-item d-flex align-items-center p-2 rounded" href="/logout" style="color: #ef4444;">
                                <i class="ti ti-logout me-2"></i>Logout
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>
    `;

    document.addEventListener("DOMContentLoaded", function () {
        // Strip legacy structural layout selectors to avoid overriding Dreams
        document.querySelectorAll("style").forEach(styleEl => {
            if (!styleEl.id) {
                let css = styleEl.innerHTML;
                css = css.replace(/\*\s*\{\s*box-sizing:\s*border-box;\s*margin:\s*0;\s*padding:\s*0;\s*\}/g, '');
                css = css.replace(/body\s*\{\s*font-family:\s*['"]Golos\s*Text['"][^}]+?\}/g, '');
                css = css.replace(/\.sidebar\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.sb-[a-zA-Z0-9_-]+\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.menu-item\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.menu-item:[a-zA-Z0-9_-]+\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.main-wrap\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.topbar\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.topbar-title\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.search-wrap\s*\{[^}]+?\}/g, '');
                css = css.replace(/\.search-wrap\s+input\s*\{[^}]+?\}/g, '');
                styleEl.innerHTML = css;
            }
        });

        // 1. Get original page title
        const originalTitle = document.getElementById("pageTitle") || document.querySelector("title");
        const pageTitleText = originalTitle ? originalTitle.innerText.split(" - ")[0] : "Solar CRM";

        // 2. Locate core content on the page
        const oldMainWrap = document.querySelector(".main-wrap");
        const oldTopbar = document.querySelector(".topbar");
        const oldSidebar = document.querySelector(".sidebar");
        const oldScriptController = document.querySelector("script[src*='responsive.js']");

        // Preserve userProfile hidden input if it exists
        const userProfileInput = document.getElementById("userProfile");
        if (userProfileInput) {
            document.body.appendChild(userProfileInput);
        }



        // Remove old sidebar and topbar elements from DOM (keep topbar for a second to extract actions)
        if (oldSidebar) oldSidebar.remove();

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

        // Create page-header container inside content
        const pageHeaderDiv = document.createElement("div");
        pageHeaderDiv.className = "page-header mb-2 pb-2 border-bottom";
        pageHeaderDiv.innerHTML = `
            <div class="row align-items-center">
                <div class="col-sm-6">
                    <h4 class="page-title text-dark fw-bold mb-0" style="font-size: 20px;">${pageTitleText}</h4>
                </div>
                <div class="col-sm-6 text-sm-end mt-2 mt-sm-0">
                    <div id="pageActionButtonsContainer" class="d-inline-flex align-items-center gap-2 justify-content-sm-end flex-wrap"></div>
                </div>
            </div>
        `;
        contentDiv.appendChild(pageHeaderDiv);

        pageWrapperDiv.appendChild(contentDiv);
        mainWrapperDiv.appendChild(pageWrapperDiv);

        // Move page action buttons from old topbar into the new page-header actions container
        const pageActionContainer = pageHeaderDiv.querySelector("#pageActionButtonsContainer");
        if (oldTopbar && pageActionContainer) {
            const actions = Array.from(oldTopbar.children).filter(child => {
                return !child.classList.contains("topbar-title") && 
                       !child.classList.contains("tb-spacer") && 
                       !child.classList.contains("search-wrap");
            });
            actions.forEach(act => {
                pageActionContainer.appendChild(act);
            });
        }

        // Now safe to remove old topbar
        if (oldTopbar) oldTopbar.remove();

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
            /* --- Space and Typography Optimization --- */
            body {
                font-family: 'Golos Text', 'Inter', system-ui, sans-serif !important;
                background: #f8fafc !important;
                color: #1e293b !important;
            }
            
            /* Main Wrapper and Content Spacing */
            .main-wrap {
                background: #f8fafc !important;
                padding: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }
            .content-area {
                padding: 16px 24px 24px !important;
                background: #f8fafc !important;
                flex: 1 !important;
                overflow-y: auto !important;
            }
            
            /* Card Layouts */
            .card {
                border: none !important;
                border-radius: 12px !important;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03) !important;
                background: #ffffff !important;
                margin-bottom: 20px !important;
            }
            .card-body {
                padding: 20px !important;
            }
            .card-header {
                background: #ffffff !important;
                border-bottom: 1px solid #f1f5f9 !important;
                padding: 16px 20px !important;
            }
            
            /* Table Styling - Compact and Space Optimized */
            .table-wrap, .table-responsive {
                border-radius: 10px !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: none !important;
                background: #ffffff !important;
            }
            .table {
                margin-bottom: 0 !important;
            }
            .table thead th {
                background: #f1f5f9 !important;
                color: #475569 !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.6px !important;
                padding: 10px 12px !important; /* Compact and snug padding */
                border-bottom: 2px solid #e2e8f0 !important;
                border-right: 1px solid #e2e8f0 !important;
                vertical-align: middle !important;
                height: 38px !important;
            }
            .table thead th:last-child {
                border-right: none !important;
            }
            .table tbody tr {
                transition: all 0.15s ease-in-out !important;
            }
            .table tbody tr:hover td {
                background: #f8fafc !important;
            }
            .table tbody tr td {
                padding: 6px 10px !important; /* ULTRA SNUG PADDING FOR SPACE OPTIMIZATION */
                font-size: 12.5px !important;
                color: #334155 !important;
                border-bottom: 1px solid #f1f5f9 !important;
                vertical-align: middle !important;
                font-weight: 500 !important;
            }
            /* Prevent wrapping on key metadata columns to maintain snug row heights */
            .table td:nth-child(2),
            .table td:nth-child(3),
            .table td:nth-child(4),
            .table td:nth-child(6),
            .table td:nth-child(9),
            .table td:nth-child(10),
            .table td:nth-child(11),
            .table td:nth-child(12),
            .table th {
                white-space: nowrap !important;
            }
            .table tbody tr:last-child td {
                border-bottom: none !important;
            }
            
            /* Last Column / Actions Width Wrap */
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

            /* Stats Cards Styling Override */
            .stats-row {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important;
                gap: 8px !important;
                padding: 8px 12px 4px !important;
                background: #f8fafc !important;
                margin-bottom: 8px !important;
            }
            .stat-card {
                background: #ffffff !important;
                border-radius: 8px !important;
                padding: 8px 12px !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01) !important;
                position: relative !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                min-height: 54px !important;
                transition: all 0.2s ease !important;
            }
            .stat-card::before {
                display: none !important; /* Remove the old vertical left border line */
            }
            .stat-card:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05) !important;
                border-color: #cbd5e1 !important;
            }
            .stat-label {
                font-size: 10px !important;
                font-weight: 700 !important;
                color: #64748b !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                margin-bottom: 2px !important;
            }
            .stat-val {
                font-size: 18px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                margin: 0 !important;
                letter-spacing: -0.5px !important;
                line-height: 1.1 !important;
            }
            .stat-sub {
                font-size: 11px !important;
                color: #94a3b8 !important;
                margin-top: 1px !important;
            }
            
            /* Content and Toolbar Space Optimization Overrides */
            .content {
                padding: 12px 16px 0 !important;
            }
            .table-toolbar {
                padding: 4px 8px !important;
                margin-bottom: 6px !important;
                gap: 4px !important;
            }
            .filter-chip {
                padding: 2px 8px !important;
                font-size: 11.5px !important;
            }
            
            /* Status Badges */
            .status-badge {
                display: inline-flex !important;
                align-items: center !important;
                padding: 4px 10px !important;
                border-radius: 20px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                border: 1px solid transparent !important;
            }
            .status-badge.active, .status-badge.sb-won {
                background: #dcfce7 !important;
                color: #15803d !important;
                border-color: #bbf7d0 !important;
            }
            .status-badge.inactive, .status-badge.sb-deleted {
                background: #fee2e2 !important;
                color: #b91c1c !important;
                border-color: #fecaca !important;
            }
            .status-badge.pending, .status-badge.sb-inprog {
                background: #fef3c7 !important;
                color: #d97706 !important;
                border-color: #fde68a !important;
            }
            
            /* Standard form fields and buttons */
            .topbar {
                background: #ffffff !important;
                height: 60px !important;
                border-bottom: 1px solid #eef2f6 !important;
                padding: 0 24px !important;
            }
            .topbar-title {
                font-size: 18px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
            }
            .search-wrap input {
                height: 38px !important;
                border-radius: 8px !important;
                border: 1px solid #cbd5e1 !important;
                background: #ffffff !important;
                padding: 0 14px 0 36px !important; /* extra padding for icon */
                font-size: 13px !important;
                transition: all 0.2s ease !important;
                width: 100% !important;
            }
            .search-wrap::before {
                content: "\\eb1c" !important; /* search icon */
                font-family: "tabler-icons" !important;
                position: absolute !important;
                left: 12px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                color: #64748b !important;
                font-size: 14px !important;
                pointer-events: none !important;
                z-index: 5 !important;
            }
            .search-wrap input:focus {
                border-color: #e41f07 !important;
                box-shadow: 0 0 0 3px rgba(228, 31, 7, 0.15) !important;
            }
            .tb-btn {
                height: 38px !important;
                padding: 0 16px !important;
                border-radius: 8px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                border: 1px solid #cbd5e1 !important;
                background: #ffffff !important;
                color: #475569 !important;
                transition: all 0.2s ease !important;
            }
            .tb-btn:hover {
                background: #f1f5f9 !important;
                border-color: #94a3b8 !important;
            }
            .btn-add, .tb-btn.btn-add {
                background: #e41f07 !important;
                color: #ffffff !important;
                border-color: #e41f07 !important;
                box-shadow: 0 4px 12px rgba(228, 31, 7, 0.18) !important;
            }
            .btn-add:hover, .tb-btn.btn-add:hover {
                background: #c11a06 !important;
                border-color: #c11a06 !important;
                color: #ffffff !important;
            }

            /* Override Bootstrap Row/Col Stats Cards to be snug (Product Master, etc.) */
            .content > .row.g-3.mb-3, .content > .row.mb-3 {
                margin-bottom: 8px !important;
                gap: 8px !important;
                display: flex !important;
                flex-wrap: nowrap !important;
            }
            .content > .row.g-3.mb-3 > div[class*="col-"], .content > .row.mb-3 > div[class*="col-"] {
                flex: 1 !important;
                max-width: none !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .content > .row.g-3.mb-3 .card, .content > .row.mb-3 .card {
                border-radius: 8px !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01) !important;
                margin-bottom: 0 !important;
            }
            .content > .row.g-3.mb-3 .card-body, .content > .row.mb-3 .card-body {
                padding: 8px 12px !important;
            }
            .content > .row.g-3.mb-3 .card-body h3, .content > .row.mb-3 .card-body h3 {
                font-size: 18px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                margin: 0 !important;
                line-height: 1.1 !important;
            }
            .content > .row.g-3.mb-3 .card-body span.fs-12, .content > .row.mb-3 .card-body span.fs-12 {
                font-size: 10px !important;
                font-weight: 700 !important;
                color: #64748b !important;
                text-transform: uppercase !important;
                margin-bottom: 2px !important;
                display: inline-block !important;
            }
            .content > .row.g-3.mb-3 .card-body span.fs-11, .content > .row.mb-3 .card-body span.fs-11 {
                font-size: 11px !important;
                color: #94a3b8 !important;
                margin-top: 1px !important;
                display: inline-block !important;
            }
            .content > .row.g-3.mb-3 .card-body .d-flex.align-items-center.justify-content-between,
            .content > .row.mb-3 .card-body .d-flex.align-items-center.justify-content-between {
                margin-bottom: 2px !important;
            }

            /* Product Name & Manufacturer Columns Ellipsis truncation to prevent overlap & allow no-scroll fitting */
            .cell-wrap-prod, .cell-wrap-mfg, td[data-col="col_name"], td[data-col="col_mfg"] {
                max-width: 160px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
        `;
        document.head.appendChild(globalStyle);

        // Global lightweight MutationObserver to automatically attach hover tooltips to text cells
        const tooltipObserver = new MutationObserver(() => {
            document.querySelectorAll("table td").forEach(td => {
                if (td.children.length === 0 || (td.children.length === 1 && td.children[0].tagName === "SPAN")) {
                    if (!td.getAttribute("title") && td.innerText.trim().length > 0) {
                        td.setAttribute("title", td.innerText.trim());
                    }
                }
            });
        });
        tooltipObserver.observe(document.body, { childList: true, subtree: true });

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
