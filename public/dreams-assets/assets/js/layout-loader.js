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


    // Overriding HTMLInputElement.prototype.value setter to intercept JS assignments
    const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const originalValueGetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get;
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
        get: function() {
            return originalValueGetter.call(this);
        },
        set: function(val) {
            const valStr = (val === null || val === undefined) ? '' : String(val);
            
            // Case 1: JS updates native date input -> Sync to text input in DD-MM-YYYY
            if (this.type === 'date' && this.id) {
                let textInp = document.getElementById(this.id + '_text') || document.querySelector(`input[id="${this.id}_text"]`);
                if (textInp) {
                    if (valStr && valStr.includes('-')) {
                        let parts = valStr.split('-');
                        if (parts.length === 3 && parts[0].length === 4) {
                            let formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                            if (originalValueGetter.call(textInp) !== formatted) {
                                originalValueSetter.call(textInp, formatted);
                                textInp.dataset.lastVal = formatted;
                            }
                        }
                    } else if (!valStr) {
                        originalValueSetter.call(textInp, '');
                        textInp.dataset.lastVal = '';
                    }
                }
            }
            
            // Case 2: JS updates text input -> Sync to native date input in YYYY-MM-DD
            if (this.type === 'text' && this.id && this.id.endsWith('_text')) {
                // If the value assigned is in YYYY-MM-DD format (database raw format), convert it to DD-MM-YYYY!
                let matchYMD = valStr && valStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (matchYMD) {
                    let formatted = `${matchYMD[3]}-${matchYMD[2]}-${matchYMD[1]}`;
                    originalValueSetter.call(this, formatted);
                    this.dataset.lastVal = formatted;
                    
                    let dateId = this.id.replace(/_text$/, '');
                    let dateInp = document.getElementById(dateId);
                    if (dateInp && dateInp.type === 'date') {
                        originalValueSetter.call(dateInp, valStr);
                    }
                    return;
                }
                
                // If it is in DD-MM-YYYY, sync to native date input
                let matchDMY = valStr && valStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                if (matchDMY) {
                    let dateId = this.id.replace(/_text$/, '');
                    let dateInp = document.getElementById(dateId);
                    if (dateInp && dateInp.type === 'date') {
                        originalValueSetter.call(dateInp, `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`);
                    }
                }
            }
            
            originalValueSetter.call(this, val);
        }
    });


    // Dynamically insert theme-script.js in head synchronously during parsing
    if (!document.querySelector('script[src*="theme-script.js"]')) {
        const themeScript = document.createElement("script");
        themeScript.src = "/dreams-assets/assets/js/theme-script.js?v=5";
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
                        </ul>
                    </li>

                    <li class="menu-title"><span>Masters</span></li>
                    <li>
                        <ul>
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
                            <li class="submenu" id="nav-user-mgmt-parent">
                                <a href="javascript:void(0);"><i class="ti ti-users-group"></i><span>User Management</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/admin.html" class="menu-item-link" id="nav-manage-users">Manage Users</a></li>
                                    <li><a href="/admin.html#roles" class="menu-item-link" id="nav-roles-permissions">Roles & Permissions</a></li>
                                    <li><a href="/admin.html#departments" class="menu-item-link" id="nav-departments">Departments</a></li>
                                    <li><a href="/admin.html#storage" class="menu-item-link" id="nav-storage-backups">System Storage & Backups</a></li>
                                    <li><a href="/activity_logs.html" class="menu-item-link" id="nav-activity-logs">User Activity Logs</a></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                    
                    <li class="menu-title"><span>Payroll & Compliance</span></li>
                    <li>
                        <ul>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-folder-check"></i><span>Ares & Gill's</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/attendance.html" class="menu-item-link" id="nav-emp-employees">Employee</a></li>
                                    <li><a href="/attendance.html#leave" class="menu-item-link" id="nav-emp-leave">Leaves</a></li>
                                    <li><a href="/attendance.html#timesheets" class="menu-item-link" id="nav-emp-timesheets">Timesheet</a></li>
                                    <li><a href="/attendance.html#pay" class="menu-item-link" id="nav-emp-pay">Pay Employee</a></li>
                                    <li><a href="/attendance.html#super" class="menu-item-link" id="nav-emp-super">Superannuation</a></li>
                                </ul>
                            </li>
                            <li class="submenu">
                                <a href="javascript:void(0);"><i class="ti ti-file-text"></i><span>Averion Global</span><span class="menu-arrow"></span></a>
                                <ul>
                                    <li><a href="/attendance.html#averion-employees" class="menu-item-link" id="nav-averion-employees">Employee</a></li>
                                    <li><a href="/attendance.html#averion-pt" class="menu-item-link" id="nav-averion-documentation">Documentation</a></li>
                                    <li><a href="/attendance.html#averion-leave" class="menu-item-link" id="nav-averion-leave">Leaves</a></li>
                                    <li><a href="/attendance.html#averion-timesheets" class="menu-item-link" id="nav-averion-timesheets">Attendance Summary</a></li>
                                    <li><a href="/attendance.html#averion-pay" class="menu-item-link" id="nav-averion-pay">Pay Employee</a></li>
                                    <li><a href="/attendance.html#averion-tax-slab" class="menu-item-link" id="nav-averion-tax-slab">Tax Deductions</a></li>
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
                <div class="col-sm-3">
                    <h4 class="page-title text-dark fw-bold mb-0" style="font-size: 18px;">${pageTitleText}</h4>
                </div>
                <div class="col-sm-9 text-sm-end mt-2 mt-sm-0">
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
                       !child.classList.contains("search-wrap") &&
                       !child.classList.contains("user-profile") &&
                       child.id !== "currentUserDisplay";
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
        function updateSidebarHighlightState() {
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
                if (currentHash === "#roles") {
                    targetLinkId = "nav-roles-permissions";
                } else if (currentHash === "#departments") {
                    targetLinkId = "nav-departments";
                } else if (currentHash === "#storage" || currentHash === "#backups") {
                    targetLinkId = "nav-storage-backups";
                } else {
                    targetLinkId = "nav-manage-users";
                }
            } else if (currentPath === "/activity_logs.html") {
                targetLinkId = "nav-activity-logs";
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
                    targetLinkId = "nav-averion-documentation";
                } else if (currentHash === "#averion-tax-slab") {
                    targetLinkId = "nav-averion-tax-slab";
                } else {
                    targetLinkId = "nav-emp-employees";
                }
            }

            // Remove active classes from all links & list items in the sidebar
            document.querySelectorAll("#sidebar-menu a").forEach(el => el.classList.remove("active"));
            document.querySelectorAll("#sidebar-menu li").forEach(el => el.classList.remove("active"));

            if (targetLinkId) {
                const activeEl = document.getElementById(targetLinkId);
                if (activeEl) {
                    activeEl.classList.add("active");
                    const parentLi = activeEl.parentElement;
                    if (parentLi) {
                        parentLi.classList.add("active");
                    }
                    
                    // Traverse up to open all parent submenus
                    let parentSubmenu = activeEl.closest(".submenu");
                    while (parentSubmenu) {
                        const submenuLink = parentSubmenu.querySelector("a");
                        if (submenuLink) {
                            submenuLink.classList.add("subdrop");
                        }
                        const submenuUl = parentSubmenu.querySelector("ul");
                        if (submenuUl) {
                            submenuUl.style.display = "block";
                        }
                        parentSubmenu = parentSubmenu.parentElement ? parentSubmenu.parentElement.closest(".submenu") : null;
                    }
                    console.log("ANTIGRAVITY_LOG: Successfully added 'active' class to element and parent list item:", targetLinkId);
                } else {
                    console.log("ANTIGRAVITY_LOG: Failed to find element with ID:", targetLinkId);
                }
            } else {
                console.log("ANTIGRAVITY_LOG: No targetLinkId determined for path:", currentPath);
            }
        }

        // Run immediately on page load
        updateSidebarHighlightState();

        // Listen for dynamic hash routing changes
        window.addEventListener("hashchange", updateSidebarHighlightState);

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
                             checkPermission('nav-product-master', 'Masters', 'Manage Products');
                             checkPermission('nav-combo', 'Masters', 'Manage Products');
                             checkPermission('nav-combo-master', 'Masters', 'Manage Products');
                             checkPermission('nav-stc', 'Masters', 'Manage STC');
                             checkPermission('nav-stc-master', 'Masters', 'Manage STC');
                             checkPermission('nav-rebate', 'Masters', 'Manage Rebates');
                             checkPermission('nav-rebate-master', 'Masters', 'Manage Rebates');
                             checkPermission('nav-margin', 'Masters', 'Manage Margins');
                             checkPermission('nav-margin-master', 'Masters', 'Manage Margins');
                             checkPermission('nav-charges', 'Masters', 'Manage Charges');
                             checkPermission('nav-install-charges', 'Masters', 'Manage Charges');
                             checkPermission('nav-installations', 'Ares Installation Outside', 'Installations');
                             checkPermission('nav-out-pay', 'Ares Installation Outside', 'Outstanding Payments');
                             checkPermission('nav-paid-pay', 'Ares Installation Outside', 'Paid Payments');
                             checkPermission('nav-company', 'Ares Installation Outside', 'Company Details');
                             checkPermission('nav-company-details', 'Ares Installation Outside', 'Company Details');
                             checkPermission('nav-user-mgmt-parent', 'Settings', 'Manage Users');
                             checkPermission('nav-manage-users', 'Settings', 'Manage Users');
                             checkPermission('nav-roles-permissions', 'Settings', 'Manage Users');
                             checkPermission('nav-departments', 'Settings', 'Manage Users');
                             checkPermission('nav-storage-backups', 'Settings', 'Manage Users');
                             checkPermission('nav-activity-logs', 'Settings', 'Manage Users');
                             checkPermission('nav-project-leads', 'Sales', 'Leads');
                             checkPermission('nav-lead-approvals', 'Lead Master', 'Lead Approvals');
                             
                             checkPermission('nav-emp-employees', 'Attendance & Payroll', 'Employees');
                             checkPermission('nav-emp-leave', 'Attendance & Payroll', 'Leave');
                             checkPermission('nav-emp-timesheets', 'Attendance & Payroll', 'Timesheets');
                             checkPermission('nav-emp-pay', 'Attendance & Payroll', 'Pay Employee');
                             checkPermission('nav-pay-employee', 'Attendance & Payroll', 'Pay Employee');
                             checkPermission('nav-emp-super', 'Attendance & Payroll', 'Superannuation');
                             checkPermission('nav-superannuation', 'Attendance & Payroll', 'Superannuation');

                             checkPermission('nav-averion-employees', 'Attendance & Payroll', 'Employees');
                             checkPermission('nav-averion-leave', 'Attendance & Payroll', 'Leave');
                             checkPermission('nav-averion-timesheets', 'Attendance & Payroll', 'Timesheets');
                             checkPermission('nav-averion-pay', 'Attendance & Payroll', 'Pay Employee');
                             checkPermission('nav-averion-documentation', 'Attendance & Payroll', 'Employees');
                             checkPermission('nav-averion-tax-slab', 'Attendance & Payroll', 'Income Tax Slab');

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
                white-space: nowrap;
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
            .actions-cell:not(.actions-grid):not(.actions-grid-3x2):not([style*="grid"]) {
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
            #pageActionButtonsContainer .tb-btn, #pageActionButtonsContainer button {
                height: 32px !important;
                padding: 0 10px !important;
                font-size: 12.5px !important;
                border-radius: 6px !important;
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

            /* Active Sidebar Submenu Item Theme Color Override */
            .sidebar-menu ul li a.active,
            .sidebar-menu ul li a.active span {
                color: #e41f07 !important;
            }
            .sidebar-menu ul li .submenu > ul li a.active::after {
                background-color: #e41f07 !important;
            }
            
            /* Custom scrollbar styling for column customizer dropdown menu */
            #colCustomizerMenu::-webkit-scrollbar {
                width: 6px !important;
            }
            #colCustomizerMenu::-webkit-scrollbar-track {
                background: #f1f5f9 !important;
                border-radius: 4px !important;
            }
            #colCustomizerMenu::-webkit-scrollbar-thumb {
                background: #cbd5e1 !important;
                border-radius: 4px !important;
            }
            #colCustomizerMenu::-webkit-scrollbar-thumb:hover {
                background: #94a3b8 !important;
            }

            /* ==========================================
               Dreams CRM Style Enhancements for Tables, Panels, Cards, and Forms
               ========================================== */
            .panel-card, .tab-panel .panel-card {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 8px !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02) !important;
                margin-bottom: 20px !important;
                overflow: hidden !important;
            }
            .panel-header, .tab-panel .panel-header {
                background: #ffffff !important;
                border-bottom: 1px solid #f1f5f9 !important;
                padding: 14px 18px !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
            }
            .panel-header span, .panel-header h4, .tab-panel .panel-header span {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
            }
            .panel-body, .tab-panel .panel-body {
                padding: 18px !important;
            }
            
            /* Table Modernization */
            .table-wrap table, .tab-panel table {
                width: 100% !important;
                border-collapse: collapse !important;
                font-family: 'Golos Text', sans-serif !important;
                margin-top: 10px !important;
                background: #ffffff !important;
            }
            .table-wrap table thead th, .tab-panel table thead th {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: #334155 !important;
                background-color: #f8fafc !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                padding: 12px 14px !important;
                border-bottom: 1px solid #e2e8f0 !important;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
            }
            .table-wrap table tbody td, .tab-panel table tbody td {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 12px !important;
                color: #475569 !important;
                padding: 12px 14px !important;
                border-bottom: 1px solid #f1f5f9 !important;
                border-top: none !important;
                border-left: none !important;
                border-right: none !important;
                vertical-align: middle !important;
            }
            .table-wrap table tbody tr:hover, .tab-panel table tbody tr:hover {
                background-color: #f8fafc !important;
            }
            
            /* Input & Dropdown Controls Override */
            .filter-select, select.filter-select, input.filter-select, select.form-select {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 12px !important;
                color: #334155 !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                padding: 6px 12px !important;
                background-color: #ffffff !important;
                outline: none !important;
                height: 34px !important;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out !important;
            }
            .filter-select:focus, select.filter-select:focus, input.filter-select:focus, select.form-select:focus {
                border-color: #e41f07 !important;
                box-shadow: 0 0 0 2px rgba(228, 31, 7, 0.1) !important;
            }
            .filter-select::placeholder {
                color: #94a3b8 !important;
            }

            /* Buttons Override */
            .btn-calc, button.btn-calc, button.btn-primary, .btn-calc:hover, button.btn-calc:hover {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                color: #ffffff !important;
                background: #e41f07 !important;
                border: 1px solid #e41f07 !important;
                border-radius: 6px !important;
                padding: 8px 16px !important;
                height: 34px !important;
                cursor: pointer !important;
                transition: all 0.15s ease-in-out !important;
                box-shadow: 0 4px 12px rgba(228, 31, 7, 0.15) !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .btn-calc:hover, button.btn-calc:hover, button.btn-primary:hover {
                background: #c11a06 !important;
                border-color: #c11a06 !important;
                box-shadow: 0 4px 12px rgba(193, 26, 6, 0.25) !important;
            }
            .btn-calc-all, button.btn-calc-all {
                background: #2563eb !important;
                border-color: #2563eb !important;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15) !important;
            }
            .btn-calc-all:hover, button.btn-calc-all:hover {
                background: #1d4ed8 !important;
                border-color: #1d4ed8 !important;
                box-shadow: 0 4px 12px rgba(29, 78, 216, 0.25) !important;
            }
            
            /* Submenu labels (EMPLOYEE, MONTH, etc.) */
            .payslip-generator label, .supervisor-filters label, .supervisor-header label, .tab-panel label {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 10px !important;
                font-weight: 700 !important;
                color: #64748b !important;
                text-transform: uppercase !important;
                margin-bottom: 4px !important;
                letter-spacing: 0.5px !important;
            }

            /* Action Buttons inside tables */
            .btn-table-action-icon, button.btn-table-action-icon {
                background: #f8fafc !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 6px !important;
                padding: 6px !important;
                color: #475569 !important;
                cursor: pointer !important;
                transition: all 0.15s ease-in-out !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .btn-table-action-icon:hover {
                background: #f1f5f9 !important;
                color: #e41f07 !important;
                border-color: #cbd5e1 !important;
            }
            .btn-table-action-icon.btn-reject:hover {
                color: #ef4444 !important;
            }
            
            /* Text elements formatting */
            .tab-panel h4 {
                font-family: 'Golos Text', sans-serif !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                margin-top: 24px !important;
                margin-bottom: 12px !important;
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

        // Hide table-toolbar on Products page specifically (user requested as filters already exist in modal)
        if (window.location.pathname === "/products.html") {
            const prodStyle = document.createElement("style");
            prodStyle.innerHTML = `
                .content-area > .table-toolbar {
                    display: none !important;
                }
            `;
            document.head.appendChild(prodStyle);
        }

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

        function applyTableColumnVisibilityCSS(tableClass, hiddenIndices) {
            const styleId = "col-visibility-" + tableClass.replace(/[^a-zA-Z0-9-]/g, "");
            let styleEl = document.getElementById(styleId);
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            let css = "";
            hiddenIndices.forEach(idx => {
                css += `${tableClass} th:nth-child(${idx + 1}), ${tableClass} td:nth-child(${idx + 1}) { display: none !important; }\n`;
            });
            styleEl.innerHTML = css;
        }

        function initGlobalColumnCustomizer() {
            console.log("[ColumnCustomizer] Starting column customizer initialization");
            
            // Find all tables on the page, filtering out structural tables
            const tables = Array.from(document.querySelectorAll(".content-area table, table")).filter(t => {
                return t.classList.contains("xero-ts-table") || 
                       t.classList.contains("ts-grid") || 
                       t.classList.contains("table") || 
                       t.classList.contains("table-hover") || 
                       t.classList.contains("table-nowrap");
            });
            if (tables.length === 0) {
                console.log("[ColumnCustomizer] No customizable data table found on this page.");
                return;
            }

            // Prioritize the first visible table, fallback to first table
            const table = tables.find(t => {
                // Check if element or any parent has display: none
                return t.offsetWidth > 0 && t.offsetHeight > 0 && window.getComputedStyle(t).display !== 'none';
            }) || tables[0];

            if (table && (table.classList.contains("table-departments") || table.classList.contains("table-roles"))) {
                console.log("[ColumnCustomizer] Skipping customizer for departments/roles table.");
                const existingDropdown = document.getElementById("colCustomizerDropdown");
                if (existingDropdown) {
                    existingDropdown.remove();
                }
                return;
            }

            // Get unique class of the table to use as a CSS selector
            let tableClass = "";
            if (table.classList.contains("xero-ts-table")) {
                tableClass = ".xero-ts-table";
            } else if (table.classList.contains("ts-grid")) {
                tableClass = ".ts-grid";
            } else if (table.classList.contains("table")) {
                tableClass = "." + Array.from(table.classList).join(".");
            } else {
                tableClass = "table";
            }

            // Check if dropdown already exists for this table
            const existingDropdown = document.getElementById("colCustomizerDropdown");
            if (existingDropdown && existingDropdown.dataset.targetTable === tableClass) {
                console.log("[ColumnCustomizer] Dropdown already exists for target:", tableClass);
                return;
            }

            // Table header validation
            const headerRow = table.querySelector("thead tr");
            if (!headerRow) {
                console.log("[ColumnCustomizer] Table header row not found.");
                return;
            }

            const headers = Array.from(headerRow.querySelectorAll("th"));
            if (headers.length <= 1) {
                console.log("[ColumnCustomizer] Headers length <= 1");
                return;
            }

            const customizableCols = [];
            headers.forEach((th, idx) => {
                const text = th.innerText.trim();
                const hasCheckbox = th.querySelector("input[type=checkbox]");
                const isAction = text.toLowerCase() === "action" || text.toLowerCase() === "actions" || text === "✏️" || text === "🗑️";
                
                if (!hasCheckbox && !isAction && text !== "") {
                    customizableCols.push({ index: idx, name: text });
                }
            });

            if (customizableCols.length === 0) {
                console.log("[ColumnCustomizer] No customizable columns found.");
                return;
            }

            let toolbar = document.getElementById("pageActionButtonsContainer") || document.querySelector(".topbar") || document.querySelector(".table-toolbar");
            if (!toolbar) {
                const cardBody = table.closest(".card-body");
                if (cardBody) {
                    toolbar = document.createElement("div");
                    toolbar.className = "table-toolbar";
                    toolbar.style.cssText = "display: flex; justify-content: flex-end; margin-bottom: 12px;";
                    cardBody.insertBefore(toolbar, cardBody.firstChild);
                } else {
                    console.log("[ColumnCustomizer] No toolbar or card-body found.");
                    return;
                }
            }

            // Remove existing dropdown if we are switching tables
            if (existingDropdown) {
                existingDropdown.remove();
            }

            console.log("[ColumnCustomizer] Re-initializing dropdown for target table:", tableClass);

            const storageKey = "hidden-cols-" + window.location.pathname + "-" + tableClass.replace(/\./g, "");
            let hiddenIndices = JSON.parse(localStorage.getItem(storageKey) || "[]");
            hiddenIndices = hiddenIndices.filter(idx => idx < headers.length);
            
            // Apply visibility CSS specifically for this table (fast fallback placeholder)
            applyTableColumnVisibilityCSS(tableClass, hiddenIndices);

            const dropdownDiv = document.createElement("div");
            dropdownDiv.id = "colCustomizerDropdown";
            dropdownDiv.dataset.targetTable = tableClass; // Store target table selector
            dropdownDiv.className = "dropdown position-relative d-inline-block";
            dropdownDiv.style.marginRight = "8px";

            const btn = document.createElement("button");
            btn.className = "tb-btn";
            btn.type = "button";
            btn.style.cssText = "border-radius: 20px; display: flex; align-items: center; gap: 6px; padding: 5px 12px; font-weight: 600; font-size: 12px; cursor: pointer;";
            btn.innerHTML = `<i class="ti ti-layout-columns" style="font-size: 14px;"></i> Manage Columns`;
            
            const menu = document.createElement("div");
            menu.id = "colCustomizerMenu";
            menu.className = "shadow-lg border p-2";
            menu.style.cssText = "display: none; position: absolute; right: 0; top: 110%; z-index: 3000; min-width: 280px; background: #fff; border-radius: 8px; max-height: 480px; overflow-y: auto; text-align: left;";

            customizableCols.forEach(col => {
                const isChecked = !hiddenIndices.includes(col.index);
                const item = document.createElement("div");
                item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #f1f5f9; gap: 12px; text-align: left;";
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; text-align: left;">
                        <i class="ti ti-grid-dots" style="color: #94a3b8; font-size: 15px; cursor: grab; flex-shrink: 0;"></i>
                        <span style="font-size: 12px; font-weight: 500; color: #1e293b; text-align: left; line-height: 1.2;">${col.name}</span>
                    </div>
                    <label class="col-customizer-switch" style="margin-bottom: 0; flex-shrink: 0;">
                        <input type="checkbox" data-index="${col.index}" ${isChecked ? 'checked' : ''}>
                        <span class="col-customizer-slider"></span>
                    </label>
                `;
                menu.appendChild(item);
            });

            dropdownDiv.appendChild(btn);
            dropdownDiv.appendChild(menu);

            const btnAdd = toolbar.querySelector(".btn-add") || toolbar.querySelector("button:last-child");
            if (btnAdd) {
                toolbar.insertBefore(dropdownDiv, btnAdd);
            } else {
                toolbar.appendChild(dropdownDiv);
            }

            // Asynchronously load user-specific column preferences from server
            const pagePath = window.location.pathname;
            const apiURL = `/api/user-column-preferences?page_path=${encodeURIComponent(pagePath)}&table_class=${encodeURIComponent(tableClass)}`;
            fetch(apiURL)
                .then(res => {
                    if (res.status === 401) {
                        return { hidden_columns: null }; // skip if not authenticated (e.g. login page)
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && Array.isArray(data.hidden_columns)) {
                        hiddenIndices = data.hidden_columns.filter(idx => idx < headers.length);
                        localStorage.setItem(storageKey, JSON.stringify(hiddenIndices));
                        applyTableColumnVisibilityCSS(tableClass, hiddenIndices);
                        
                        // Update UI checkbox checked states
                        menu.querySelectorAll("input[type=checkbox]").forEach(chk => {
                            const idx = parseInt(chk.getAttribute("data-index"));
                            chk.checked = !hiddenIndices.includes(idx);
                        });
                    }
                })
                .catch(err => console.error("[ColumnCustomizer] Error fetching DB column preferences:", err));

            btn.addEventListener("click", function(e) {
                e.stopPropagation();
                const isVisible = menu.style.display === "block";
                document.querySelectorAll("#colCustomizerMenu").forEach(m => m.style.display = "none");
                menu.style.display = isVisible ? "none" : "block";
            });

            document.addEventListener("click", function(e) {
                if (!dropdownDiv.contains(e.target)) {
                    menu.style.display = "none";
                }
            });

            menu.querySelectorAll("input[type=checkbox]").forEach(chk => {
                chk.addEventListener("change", function() {
                    const idx = parseInt(this.getAttribute("data-index"));
                    if (this.checked) {
                        hiddenIndices = hiddenIndices.filter(i => i !== idx);
                    } else {
                        if (!hiddenIndices.includes(idx)) hiddenIndices.push(idx);
                    }
                    localStorage.setItem(storageKey, JSON.stringify(hiddenIndices));
                    applyTableColumnVisibilityCSS(tableClass, hiddenIndices);

                    // Autosave changes to the database per logged-in user
                    fetch('/api/user-column-preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            page_path: pagePath,
                            table_class: tableClass,
                            hidden_columns: hiddenIndices
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            console.log("[ColumnCustomizer] Preferences autosaved to DB successfully");
                        }
                    })
                    .catch(err => console.error("[ColumnCustomizer] Error autosaving preferences to DB:", err));
                });
            });
        }

        // Global Date Masking and Timezone formatting implementation via Event Delegation
        document.addEventListener("focusin", function(e) {
            const input = e.target;
            if (input.tagName === 'INPUT' && input.type === 'text' && 
                (input.placeholder === 'DD-MM-YYYY' || (input.id && input.id.endsWith('_text')))) {
                if (input.hasAttribute('oninput')) input.removeAttribute('oninput');
                if (input.hasAttribute('onblur')) input.removeAttribute('onblur');
            }
        });

        document.addEventListener("input", function(e) {
            const input = e.target;
            if (input.tagName === 'INPUT' && input.type === 'text' && 
                (input.placeholder === 'DD-MM-YYYY' || (input.id && input.id.endsWith('_text')))) {
                
                // Double check to remove inline attributes if they were added dynamically
                if (input.hasAttribute('oninput')) input.removeAttribute('oninput');
                if (input.hasAttribute('onblur')) input.removeAttribute('onblur');
                
                let val = input.value;
                let clean = val.replace(/[^0-9-]/g, "");
                
                let oldVal = input.dataset.lastVal || "";
                if (clean.length < oldVal.length) {
                    input.dataset.lastVal = clean;
                    input.value = clean;
                    return;
                }
                
                let digits = clean.replace(/-/g, "");
                let formatted = "";
                
                if (digits.length > 0) {
                    // Day
                    let dd = digits.substring(0, 2);
                    if (dd.length === 1 && dd !== '0' && dd !== '1' && dd !== '2' && dd !== '3') {
                        dd = '0' + dd;
                    }
                    if (dd.length === 2) {
                        let dNum = parseInt(dd, 10);
                        if (dNum > 31) dd = "31";
                        if (dNum === 0) dd = "01";
                    }
                    formatted += dd;
                    
                    if (digits.length >= 2) {
                        formatted += "-";
                        
                        // Month
                        let mm = digits.substring(2, 4);
                        if (mm.length === 1 && mm !== '0' && mm !== '1') {
                            mm = '0' + mm;
                        }
                        if (mm.length === 2) {
                            let mNum = parseInt(mm, 10);
                            if (mNum > 12) mm = "12";
                            if (mNum === 0) mm = "01";
                        }
                        formatted += mm;
                        
                        if (digits.length >= 4) {
                            formatted += "-";
                            
                            // Year
                            let yyyy = digits.substring(4, 8);
                            formatted += yyyy;
                        }
                    }
                }
                
                input.value = formatted;
                input.dataset.lastVal = formatted;
                
                // Sync to native hidden input if present
                let nativeId = input.id ? input.id.replace(/_text$/, "") : "";
                if (nativeId) {
                    let nativeInput = document.getElementById(nativeId);
                    if (nativeInput && nativeInput.type === 'date') {
                        let parts = formatted.split('-');
                        if (parts.length === 3) {
                            let dd = parts[0];
                            let mm = parts[1];
                            let yyyy = parts[2];
                            if (yyyy.length === 4) {
                                let dateVal = `${yyyy}-${mm}-${dd}`;
                                if (nativeInput.value !== dateVal) {
                                    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                                    if (desc && desc.set) {
                                        desc.set.call(nativeInput, dateVal);
                                        nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
                                        nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
                                    }
                                }
                            }
                        } else if (!formatted) {
                            const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
                            if (desc && desc.set) {
                                desc.set.call(nativeInput, '');
                                nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
                                nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                        }
                    }
                }
            }
        });

        function convertNativeDateInputs() {
            document.querySelectorAll('input[type="date"]').forEach(dateInput => {
                if (dateInput.closest('.date-input-container') || dateInput.style.opacity === '0' || dateInput.style.display === 'none') {
                    return;
                }
                
                const container = document.createElement('div');
                container.className = 'date-input-container';
                container.style.cssText = 'display: flex; align-items: center; position: relative; width: 100%;';
                
                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.placeholder = 'DD-MM-YYYY';
                textInput.maxLength = 10;
                textInput.className = dateInput.className;
                textInput.id = dateInput.id ? dateInput.id + '_text' : '';
                textInput.name = dateInput.name ? dateInput.name + '_text' : '';
                textInput.style.cssText = 'flex: 1; padding-right: 32px;';
                
                const triggerBtn = document.createElement('button');
                triggerBtn.type = 'button';
                triggerBtn.className = 'date-picker-trigger';
                triggerBtn.style.cssText = 'position: absolute; right: 8px; background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; justify-content: center; height: 100%; width: 24px; padding: 0; z-index: 1; pointer-events: none;';
                triggerBtn.innerHTML = '📅';
                
                // Position native hidden dateInput over the trigger button
                dateInput.style.cssText = 'position: absolute; opacity: 0; width: 24px; height: 24px; right: 8px; z-index: 2; cursor: pointer; border: none; padding: 0; margin: 0;';
                
                dateInput.parentNode.insertBefore(container, dateInput);
                container.appendChild(textInput);
                container.appendChild(triggerBtn);
                container.appendChild(dateInput);
                
                textInput.addEventListener('change', function() {
                    let val = textInput.value.trim();
                    if (!val) {
                        dateInput.value = '';
                        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                    let parts = val.split('-');
                    if (parts.length === 3) {
                        let dd = parts[0].padStart(2, '0');
                        let mm = parts[1].padStart(2, '0');
                        let yyyy = parts[2];
                        if (yyyy.length === 4) {
                            let formatted = `${yyyy}-${mm}-${dd}`;
                            if (dateInput.value !== formatted) {
                                dateInput.value = formatted;
                                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                });
                
                dateInput.addEventListener('change', function() {
                    let val = dateInput.value;
                    if (val && val.includes('-')) {
                        let parts = val.split('-');
                        if (parts.length === 3) {
                            textInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }
                    } else {
                        textInput.value = '';
                    }
                });
                
                if (dateInput.value) {
                    let val = dateInput.value;
                    let parts = val.split('-');
                    if (parts.length === 3) {
                        textInput.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                }
            });
        }

        function formatToSydneyTZ(str) {
            if (!str || typeof str !== 'string') return str;
            let val = str.trim();
            if (!val || val === '-' || val === 'Pending' || val === 'Pending Details') return str;
            
            // Check YYYY-MM-DD HH:mm:ss
            let match1 = val.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
            if (match1) {
                let y = parseInt(match1[1]), m = parseInt(match1[2]), d = parseInt(match1[3]);
                let hh = parseInt(match1[4]), min = parseInt(match1[5]);
                let period = "AM";
                let dispHh = hh;
                if (hh >= 12) {
                    period = "PM";
                    if (hh > 12) dispHh = hh - 12;
                } else if (hh === 0) {
                    dispHh = 12;
                }
                return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y} ${String(dispHh).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
            }
            
            // Check DD-MM-YYYY (hh:mm AM/PM)
            let match2 = val.match(/^(\d{2})-(\d{2})-(\d{4})\s*\(?(\d{2}):(\d{2})\s*([AP]M)\)?$/i);
            if (match2) {
                let d = match2[1], m = match2[2], y = match2[3];
                let hh = match2[4], min = match2[5], period = match2[6].toUpperCase();
                return `${d}-${m}-${y} ${hh}:${min} ${period}`;
            }
            
            // Check YYYY-MM-DD (date only)
            let match3 = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match3) {
                return `${match3[3]}-${match3[2]}-${match3[1]}`;
            }

            // Check YYYY-MM-DD to YYYY-MM-DD date range
            let matchRange = val.match(/^(\d{4})-(\d{2})-(\d{2})\s+to\s+(\d{4})-(\d{2})-(\d{2})$/);
            if (matchRange) {
                return `${matchRange[3]}-${matchRange[2]}-${matchRange[1]} to ${matchRange[6]}-${matchRange[5]}-${matchRange[4]}`;
            }
            
            return str;
        }

        function formatDatesInTables() {
            console.log("formatDatesInTables RUNNING");
            const cells = document.querySelectorAll("table td, table th");
            console.log("Found cells count:", cells.length);
            cells.forEach(cell => {
                if (cell.querySelector("input, select, textarea, button")) return;
                
                const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    let text = node.nodeValue.trim();
                    let formatted = formatToSydneyTZ(text);
                    if (formatted !== text) {
                        console.log("Formatting text:", JSON.stringify(text), "->", JSON.stringify(formatted));
                        node.nodeValue = formatted;
                    }
                }
            });
        }

        // Setup observer and debounced queue
        let runTimeout = null;
        function queueGlobalUpdates() {
            if (runTimeout) return;
            runTimeout = requestAnimationFrame(() => {
                runTimeout = null;
                // Temporarily disconnect observer to prevent self-mutation loop
                observer.disconnect();
                
                try {
                    replaceEmojisWithIcons();
                    initGlobalColumnCustomizer();
                    convertNativeDateInputs();
                    formatDatesInTables();
                } catch (e) {
                    console.error("Error in global layout-loader updates:", e);
                }
                
                // Reconnect observer
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }

        const observer = new MutationObserver(queueGlobalUpdates);
        
        // Run immediately
        queueGlobalUpdates();
    });
})();

// =========================================================================
// GLOBAL SHIFT-BASED KEYBOARD & MOUSE MULTI-SELECT ENGINE FOR TABLE ROWS
// =========================================================================
(function() {
    let lastClickedCheckbox = null;
    
    // Listen for click event on input[type="checkbox"] inside table body
    document.addEventListener('click', function(e) {
        const checkbox = e.target.closest('table tbody input[type="checkbox"]');
        if (!checkbox) return;
        
        // Skip custom payroll row checkbox to avoid double handling
        if (checkbox.closest('.payroll-row')) return;
        
        const table = checkbox.closest('table');
        if (!table) return;
        
        // If Shift key is pressed and we have a previously clicked checkbox in the same table
        if (e.shiftKey && lastClickedCheckbox && lastClickedCheckbox.closest('table') === table) {
            const checkboxes = Array.from(table.querySelectorAll('tbody input[type="checkbox"]'));
            const startIdx = checkboxes.indexOf(lastClickedCheckbox);
            const endIdx = checkboxes.indexOf(checkbox);
            
            if (startIdx !== -1 && endIdx !== -1) {
                const start = Math.min(startIdx, endIdx);
                const end = Math.max(startIdx, endIdx);
                
                // Select all checkboxes in range
                for (let i = start; i <= end; i++) {
                    const cb = checkboxes[i];
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                }
                checkbox.focus();
            }
        }
        
        lastClickedCheckbox = checkbox;
    });
    
    // Listen for keydown event on document
    document.addEventListener('keydown', function(e) {
        const active = document.activeElement;
        const checkbox = active ? active.closest('table tbody input[type="checkbox"]') : null;
        if (!checkbox) return;
        
        // Skip custom payroll row checkbox to avoid double handling
        if (checkbox.closest('.payroll-row')) return;
        
        const table = checkbox.closest('table');
        if (!table) return;
        
        const checkboxes = Array.from(table.querySelectorAll('tbody input[type="checkbox"]'));
        const idx = checkboxes.indexOf(checkbox);
        if (idx === -1) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIdx = idx + 1;
            if (nextIdx < checkboxes.length) {
                const nextCb = checkboxes[nextIdx];
                
                if (e.shiftKey) {
                    if (!checkbox.checked) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    nextCb.checked = true;
                    nextCb.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                nextCb.focus();
            }
        } 
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIdx = idx - 1;
            if (prevIdx >= 0) {
                const prevCb = checkboxes[prevIdx];
                
                if (e.shiftKey) {
                    if (!checkbox.checked) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    prevCb.checked = true;
                    prevCb.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                prevCb.focus();
            }
        }
    });

    // ── GLOBAL PERSISTENT SYSTEM BACKUP TRACKER ────────────────
    window.GlobalBackupTracker = {
        pollInterval: null,

        dismiss() {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
            const card = document.getElementById('backup-topright-card');
            if (card) {
                card.style.transform = 'translateX(130%)';
                card.style.opacity = '0';
                setTimeout(() => { card.remove(); }, 400);
            }
        },

        ensureWidget() {
            let card = document.getElementById('backup-topright-card');
            if (card) return card;

            card = document.createElement('div');
            card.id = 'backup-topright-card';
            card.style.cssText = `
                position: fixed;
                top: 75px;
                right: 24px;
                z-index: 999999;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-left: 4px solid #e41f07;
                border-radius: 14px;
                box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
                padding: 14px 18px;
                display: flex;
                align-items: center;
                gap: 14px;
                min-width: 320px;
                max-width: 380px;
                font-family: 'Golos Text', system-ui, sans-serif;
                transform: translateX(130%);
                opacity: 0;
                transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
                pointer-events: auto;
            `;

            card.innerHTML = `
                <div style="position: relative; width: 46px; height: 46px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    <svg width="46" height="46" viewBox="0 0 48 48" style="transform: rotate(-90deg);">
                        <defs>
                            <linearGradient id="backupRingGradGlobal" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#e41f07"/>
                                <stop offset="100%" stop-color="#ff6b35"/>
                            </linearGradient>
                        </defs>
                        <circle cx="24" cy="24" r="20" stroke="#f1f5f9" stroke-width="4" fill="none"></circle>
                        <circle id="backupRingBar" cx="24" cy="24" r="20" stroke="url(#backupRingGradGlobal)" stroke-width="4" stroke-linecap="round" fill="none" stroke-dasharray="125.66" stroke-dashoffset="125.66" style="transition: stroke-dashoffset 0.35s ease, stroke 0.3s ease;"></circle>
                    </svg>
                    <div id="backupRingInner" style="position: absolute; font-size: 11px; font-weight: 800; color: #e41f07; display: flex; align-items: center; justify-content: center;">
                        0%
                    </div>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <h6 id="backupCardTitle" style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Creating System Backup</h6>
                        <button type="button" onclick="window.GlobalBackupTracker.dismiss()" style="background: none; border: none; padding: 0; color: #94a3b8; cursor: pointer; font-size: 16px; line-height: 1;" title="Close"><i class="ti ti-x"></i></button>
                    </div>
                    <div id="backupCardSub" style="font-size: 11.5px; color: #64748b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Compressing database & project files...</div>
                </div>
            `;

            document.body.appendChild(card);

            setTimeout(() => {
                card.style.transform = 'translateX(0)';
                card.style.opacity = '1';
            }, 10);

            return card;
        },

        startPolling() {
            if (this.pollInterval) clearInterval(this.pollInterval);

            this.pollInterval = setInterval(async () => {
                try {
                    const res = await fetch('/api/backup/status');
                    if (!res.ok) return;
                    const s = await res.json();

                    const ringBar = document.getElementById('backupRingBar');
                    const ringInner = document.getElementById('backupRingInner');
                    const cardTitle = document.getElementById('backupCardTitle');
                    const cardSub = document.getElementById('backupCardSub');
                    const card = document.getElementById('backup-topright-card');

                    const pct = Math.min(100, Math.max(0, parseInt(s.progress || 0)));
                    const offset = 125.66 * (1 - (pct / 100));

                    if (ringBar) ringBar.style.strokeDashoffset = offset;
                    if (ringInner) ringInner.innerText = pct + '%';

                    if (s.error) {
                        clearInterval(this.pollInterval);
                        this.pollInterval = null;
                        if (card) card.style.borderLeftColor = '#ef4444';
                        if (ringBar) ringBar.style.stroke = '#ef4444';
                        if (ringInner) ringInner.innerHTML = '<i class="ti ti-alert-circle" style="font-size: 18px; color: #ef4444;"></i>';
                        if (cardTitle) cardTitle.innerText = 'Backup Failed';
                        if (cardSub) cardSub.innerText = s.error || 'Could not complete backup';
                        setTimeout(() => this.dismiss(), 4500);
                    } else if (!s.isRunning && pct === 100) {
                        clearInterval(this.pollInterval);
                        this.pollInterval = null;
                        if (card) card.style.borderLeftColor = '#10b981';
                        if (ringBar) {
                            ringBar.style.stroke = '#10b981';
                            ringBar.style.strokeDashoffset = '0';
                        }
                        if (ringInner) ringInner.innerHTML = '<i class="ti ti-check" style="font-size: 18px; color: #10b981;"></i>';
                        if (cardTitle) cardTitle.innerText = 'Backup Created Successfully!';
                        if (cardSub) cardSub.innerText = 'Auto-refreshed backup table files';

                        // Auto-refresh if on storage admin screen
                        if (typeof window.loadStorageStatsAndBackups === 'function') window.loadStorageStatsAndBackups();
                        if (typeof window.fetchLastBackup === 'function') window.fetchLastBackup();
                        if (typeof window.loadSpaceAudit === 'function') window.loadSpaceAudit();

                        setTimeout(() => this.dismiss(), 3500);
                    } else if (!s.isRunning && pct !== 100) {
                        clearInterval(this.pollInterval);
                        this.pollInterval = null;
                        if (card) card.style.borderLeftColor = '#f59e0b';
                        if (ringBar) ringBar.style.stroke = '#f59e0b';
                        if (ringInner) ringInner.innerHTML = '<i class="ti ti-alert-triangle" style="font-size: 18px; color: #f59e0b;"></i>';
                        if (cardTitle) cardTitle.innerText = 'Backup Stopped';
                        if (cardSub) cardSub.innerText = 'Process terminated unexpectedly';
                        setTimeout(() => this.dismiss(), 4000);
                    }
                } catch (e) {
                    console.error('Backup status check error:', e);
                }
            }, 400);
        },

        async start() {
            this.dismiss();
            try {
                const res = await fetch('/api/backup/start', { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to start backup');
                this.ensureWidget();
                this.startPolling();
            } catch (e) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ title: 'Error', text: e.message, icon: 'error', confirmButtonColor: '#e41f07' });
                } else if (typeof window.showToast === 'function') {
                    window.showToast(e.message, 'error');
                } else {
                    alert(e.message);
                }
            }
        },

        async checkInitial() {
            try {
                const res = await fetch('/api/backup/status');
                if (!res.ok) return;
                const s = await res.json();
                if (s.isRunning === true) {
                    this.ensureWidget();
                    this.startPolling();
                }
            } catch (e) {}
        }
    };

    // Auto-check on every page load to resume widget if backup is running in background
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.GlobalBackupTracker.checkInitial();
    } else {
        window.addEventListener('DOMContentLoaded', () => window.GlobalBackupTracker.checkInitial());
    }

})();
