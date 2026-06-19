// ============================================================
//  crm-autosave-toast.js  —  Global CRM Autosave & Toast Notification Engine
//  LOCATION: public/crm-autosave-toast.js
// ============================================================

(function() {
    'use strict';

    // ── 0. INJECT ARES LOADING SCREEN CSS & HTML ────────────
    const loaderStyle = document.createElement('style');
    loaderStyle.innerHTML = `
        .ares-loader-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 999999 !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'Inter', system-ui, sans-serif !important;
        }
        .ares-loader-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .ares-loader-card {
            background: #ffffff;
            padding: 32px 48px;
            border-radius: 20px;
            box-shadow: 0 20px 40px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04);
            border: 1px solid rgba(221, 227, 237, 0.6);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            text-align: center;
            transform: scale(0.95);
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ares-loader-overlay.active .ares-loader-card {
            transform: scale(1);
        }
        .ares-loader-logo {
            width: 120px;
            height: auto;
            filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.05));
            animation: gentlePulse 2s infinite ease-in-out;
        }
        .ares-loader-status {
            font-size: 13px;
            font-weight: 700;
            color: #1c3557;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .ares-loader-progress-badge {
            background: #eef2f8;
            color: #e8681e;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 800;
            border: 1px solid #c5d3e8;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .ares-energy-flow-svg {
            margin-top: 5px;
            overflow: visible;
        }
        
        @keyframes gentlePulse {
            0%, 100% { transform: scale(1); opacity: 0.95; }
            50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes waveScroll {
            from { transform: translateX(0); }
            to { transform: translateX(-50px); }
        }
        @keyframes waveRiseLoop {
            0% { transform: translateY(29px); }
            45%, 55% { transform: translateY(0px); }
            100% { transform: translateY(29px); }
        }
        @keyframes energyFlow {
            from { stroke-dashoffset: 18; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes sheenMove {
            0% { transform: translate(-30px, -30px); }
            100% { transform: translate(30px, 30px); }
        }
        @keyframes rayFlow {
            from { stroke-dashoffset: 6; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes boltPulse {
            0%, 100% { opacity: 0.65; fill: #ffffff; }
            50% { opacity: 1; fill: #fbbf24; }
        }
        @keyframes sunPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(234, 88, 12, 0.4)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.7)); }
        }
        
        .animated-sun {
            animation: sunPulse 2s infinite ease-in-out;
            transform-origin: 35px 25px;
        }
        .ray-line-1 {
            animation: rayFlow 0.8s infinite linear;
        }
        .ray-line-2 {
            animation: rayFlow 0.6s infinite linear;
        }
        .solar-sheen {
            animation: sheenMove 2.5s infinite linear;
        }
        .conduit-flow {
            animation: energyFlow 1.2s infinite linear;
        }
        .battery-wave {
            animation: waveScroll 1s infinite linear;
            transform-origin: left bottom;
        }
        .lightning-bolt {
            animation: boltPulse 1.5s infinite ease-in-out;
            transform-origin: 30px 22px;
        }
    `;
    document.head.appendChild(loaderStyle);

    // Create DOM structure for the loading screen
    const loaderOverlay = document.createElement('div');
    loaderOverlay.className = 'ares-loader-overlay active'; // Show by default initially
    loaderOverlay.id = 'ares-loader-overlay';
    
    loaderOverlay.innerHTML = `
        <div class="ares-loader-card">
            <img src="/ares_energy_logo.png" alt="Ares Energy" class="ares-loader-logo">
            <svg width="280" height="100" viewBox="0 0 280 100" class="ares-energy-flow-svg">
                <defs>
                    <linearGradient id="sun-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fbbf24"/>
                        <stop offset="100%" stop-color="#ea580c"/>
                    </linearGradient>
                    <linearGradient id="panel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#1e3a8a"/>
                        <stop offset="100%" stop-color="#0f172a"/>
                    </linearGradient>
                    <linearGradient id="sheen-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
                        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                    </linearGradient>
                    <linearGradient id="energy-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#fb923c"/>
                        <stop offset="100%" stop-color="#f97316"/>
                    </linearGradient>
                    <linearGradient id="liquid-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#059669"/>
                        <stop offset="100%" stop-color="#34d399"/>
                    </linearGradient>
                    <clipPath id="battery-clip">
                        <path id="wave-path" d="M -50 20 Q -25 16, 0 20 T 50 20 T 100 20 T 150 20 L 150 40 L -50 40 Z" class="battery-wave"/>
                    </clipPath>
                </defs>
                <!-- Sun -->
                <circle cx="35" cy="25" r="10" fill="url(#sun-grad)" class="animated-sun"/>
                
                <!-- Sun rays -->
                <line x1="35" y1="25" x2="40" y2="48" stroke="#f97316" stroke-width="1.8" stroke-dasharray="3,3" class="ray-line-1"/>
                <line x1="42" y1="25" x2="55" y2="48" stroke="#f97316" stroke-width="1.8" stroke-dasharray="3,3" class="ray-line-2"/>
                
                <!-- Solar Panel -->
                <g transform="translate(15, 45)">
                    <polygon points="5,35 55,35 65,10 15,10" fill="rgba(15, 23, 42, 0.05)" />
                    <polygon points="5,35 55,35 65,10 15,10" fill="url(#panel-grad)" stroke="#1c3557" stroke-width="2" stroke-linejoin="round"/>
                    <line x1="28" y1="10" x2="20" y2="35" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
                    <line x1="42" y1="10" x2="38" y2="35" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
                    <line x1="56" y1="10" x2="52" y2="35" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
                    <line x1="11" y1="22" x2="59" y2="22" stroke="#ffffff" stroke-width="1" stroke-opacity="0.3"/>
                    <polygon points="5,35 55,35 65,10 15,10" fill="url(#sheen-grad)" class="solar-sheen" style="pointer-events: none; mix-blend-mode: overlay;"/>
                </g>
                
                <!-- Flow Line -->
                <path d="M 85 62 Q 135 62, 135 45 T 185 45" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>
                <path d="M 85 62 Q 135 62, 135 45 T 185 45" fill="none" stroke="url(#energy-grad)" stroke-width="3" stroke-dasharray="8,10" stroke-linecap="round" class="conduit-flow"/>
                
                <!-- Battery -->
                <g transform="translate(195, 25)">
                    <!-- Case -->
                    <rect x="5" y="5" width="55" height="35" rx="6" fill="none" stroke="#1c3557" stroke-width="2.5"/>
                    <rect x="60" y="14" width="4" height="17" rx="2" fill="#1c3557"/>
                    
                    <!-- Inner glass backing -->
                    <rect x="8" y="8" width="49" height="29" rx="4" fill="#e2e8f0"/>
                    <!-- Liquid Energy Fill -->
                    <rect x="8" y="8" width="49" height="29" rx="4" fill="url(#liquid-grad)" clip-path="url(#battery-clip)"/>
                    <!-- Lightning bolt overlay -->
                    <path d="M 33 13 L 23 23 L 31 23 L 27 33 L 37 23 L 29 23 Z" fill="#ffffff" opacity="0.85" class="lightning-bolt"/>
                </g>
            </svg>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <div class="ares-loader-status" id="ares-loader-status">Loading CRM...</div>
                <div class="ares-loader-progress-badge" id="ares-loader-progress-badge" style="display: none;">0%</div>
            </div>
        </div>
    `;
    document.body.appendChild(loaderOverlay);

    window.showAresLoader = function(duration = null, statusText = 'Loading...', progressPercent = null) {
        const overlay = document.getElementById('ares-loader-overlay');
        const status = document.getElementById('ares-loader-status');
        const badge = document.getElementById('ares-loader-progress-badge');
        const wavePath = document.getElementById('wave-path');
        
        if (status && statusText) status.innerText = statusText;
        
        if (overlay) {
            overlay.classList.add('active');
            
            if (progressPercent !== null) {
                overlay.classList.add('has-progress');
                if (badge) {
                    badge.innerText = progressPercent + '%';
                    badge.style.display = 'inline-flex';
                }
                if (wavePath) {
                    wavePath.style.animation = 'waveScroll 1s infinite linear';
                    const pct = Math.min(100, Math.max(0, parseInt(progressPercent)));
                    // Wave offset: 29 is empty, 0 is full
                    const yOffset = 29 - (29 * (pct / 100));
                    wavePath.style.transform = `translateY(${yOffset}px)`;
                }
            } else {
                overlay.classList.remove('has-progress');
                if (badge) badge.style.display = 'none';
                if (wavePath) {
                    wavePath.style.animation = 'waveScroll 1s infinite linear, waveRiseLoop 3s infinite ease-in-out';
                    wavePath.style.transform = '';
                }
            }
            
            if (duration) {
                setTimeout(() => {
                    overlay.classList.remove('active');
                }, duration);
            }
        }
    };

    window.hideAresLoader = function() {
        const overlay = document.getElementById('ares-loader-overlay');
        if (overlay) overlay.classList.remove('active');
    };

    // Safe initialization & auto-hide handling
    const hideInitialLoader = () => {
        if (window.hideAresLoader) window.hideAresLoader();
    };

    // If the page is already loaded (common with BFcache or rapid back navigation), hide immediately
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(hideInitialLoader, 100);
    } else {
        window.addEventListener('load', () => {
            setTimeout(hideInitialLoader, 600);
        });
        // Fallback: hide after 1.5s max in case load event does not trigger
        setTimeout(hideInitialLoader, 1500);
    }

    // Always hide loader when the page is shown (handles Back-Forward Cache & initial loads)
    window.addEventListener('pageshow', function(event) {
        hideInitialLoader();
    });

    // Hide loader on popstate/hashchange (handles browser back/forward and hash changes)
    window.addEventListener('popstate', hideInitialLoader);
    window.addEventListener('hashchange', hideInitialLoader);

    // Intercept menu clicks to show loader on navigation
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:') && !link.getAttribute('target') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                // Determine if this is a same-page navigation (e.g., hash change or query param within the same page)
                let isSamePage = false;
                try {
                    const targetUrl = new URL(href, window.location.href);
                    if (targetUrl.origin === window.location.origin && targetUrl.pathname === window.location.pathname) {
                        isSamePage = true;
                    }
                } catch (err) {
                    // Ignore parsing errors and treat as potentially different
                }

                if (!isSamePage) {
                    // If navigating to another page in CRM
                    if (href.endsWith('.html') || href.startsWith('/') || !href.includes(':')) {
                        if (window.showAresLoader) {
                            window.showAresLoader(null, 'Navigating...');
                        }
                    }
                }
            }
        }
    }, true);

    // ── 1. INJECT TOAST NOTIFICATION CSS ───────────────────
    const toastStyle = document.createElement('style');
    toastStyle.innerHTML = `
        .custom-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100000 !important;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }
        .custom-toast {
            background: #ffffff !important;
            color: #1c2b3a !important;
            padding: 12px 18px !important;
            border-radius: 8px !important;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important;
            font-family: 'Inter', system-ui, sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            min-width: 280px !important;
            max-width: 400px !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            border-left: 4px solid #1c3557 !important;
            transform: translateX(120%) !important;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
            pointer-events: auto !important;
            line-height: 1.4 !important;
        }
        .custom-toast.toast-show {
            transform: translateX(0) !important;
        }
        .custom-toast.toast-success {
            border-left-color: #10b981 !important;
        }
        .custom-toast.toast-error {
            border-left-color: #ef4444 !important;
        }
        .custom-toast.toast-warning {
            border-left-color: #f59e0b !important;
        }
        .custom-toast.toast-info {
            border-left-color: #3b82f6 !important;
        }
        .custom-toast-icon {
            font-size: 16px !important;
            flex-shrink: 0 !important;
        }
        .custom-toast-message {
            flex: 1 !important;
        }
    `;

    // Only inject mandatory highlighting styles if not on login page
    if (!window.location.pathname.includes('login.html') && window.location.pathname !== '/login') {
        toastStyle.innerHTML += `
            input.mandatory-empty, 
            select.mandatory-empty, 
            textarea.mandatory-empty,
            input:required:invalid,
            select:required:invalid,
            textarea:required:invalid {
                background-color: #fff1f2 !important;
                border-color: #fda4af !important;
                transition: background-color 0.2s ease, border-color 0.2s ease !important;
            }
            
            .date-input-container:has(input[type="date"]:required:invalid) input[type="text"] {
                background-color: #fff1f2 !important;
                border-color: #fda4af !important;
                transition: background-color 0.2s ease, border-color 0.2s ease !important;
            }
            
            input.mandatory-empty:focus, 
            select.mandatory-empty:focus, 
            textarea.mandatory-empty:focus,
            input:required:invalid:focus,
            select:required:invalid:focus,
            textarea:required:invalid:focus {
                border-color: #f43f5e !important;
                box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15) !important;
                outline: none !important;
            }
            
            .date-input-container:has(input[type="date"]:required:invalid) input[type="text"]:focus {
                border-color: #f43f5e !important;
                box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.15) !important;
                outline: none !important;
            }
        `;
    }
    document.head.appendChild(toastStyle);

    // ── 2. TOAST NOTIFICATION SCRIPT ENGINE ────────────────
    const _recentToasts = new Map(); // dedup tracker: message -> timestamp

    window.showToast = function(message, type = 'success') {
        if (!message || !message.trim()) return;

        // Deduplicate: ignore if same message shown within last 2 seconds
        const now = Date.now();
        const lastShown = _recentToasts.get(message);
        if (lastShown && (now - lastShown) < 2000) return;
        _recentToasts.set(message, now);
        // Clean up old entries after 3 seconds
        setTimeout(() => { _recentToasts.delete(message); }, 3000);

        let container = document.getElementById('custom-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'custom-toast-container';
            container.className = 'custom-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `custom-toast toast-${type}`;

        toast.innerHTML = `
            <span class="custom-toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Slide In
        setTimeout(() => { toast.classList.add('toast-show'); }, 10);

        // Slide Out & Remove
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => { toast.remove(); }, 300);
        }, 3500);
    };

    // ── 3. OVERRIDE SWEETALERT2 POPUPS ─────────────────────
    function overrideSwal() {
        if (window.Swal) {
            const originalSwal = window.Swal.fire;
            window.originalSwalFire = originalSwal;
            window.Swal.fire = function(options, html, icon) {
                // Defer resetting autosaving state so modal display setter blocker can intercept display='none'
                if (window.isAutosaving) {
                    setTimeout(() => { window.isAutosaving = false; }, 500);
                } else {
                    window.isAutosaving = false;
                }

                // Fall through to original Swal for confirmation alerts (e.g. Delete Confirmation)
                if (options && typeof options === 'object' && (options.showCancelButton || (options.showConfirmButton === true && options.confirmButtonText && options.confirmButtonText !== 'Close' && options.confirmButtonText !== 'OK'))) {
                    return originalSwal.call(window.Swal, options, html, icon);
                }

                let title = '';
                let text = '';
                let type = 'success';

                if (options && typeof options === 'object') {
                    title = options.title || '';
                    text = options.text || options.html || '';
                    type = options.icon || 'success';
                } else {
                    title = options || '';
                    text = html || '';
                    type = icon || 'success';
                }

                // If error or validation alert, clean HTML text tags
                let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                let fullMsg = title;
                if (cleanText) fullMsg += ': ' + cleanText;

                window.showToast(fullMsg, type);
                return Promise.resolve({ isConfirmed: true });
            };
            console.log('[Autosave] Swal successfully overridden.');
        } else {
            setTimeout(overrideSwal, 100);
        }
    }
    overrideSwal();

    // Redirect standard alerts to toasts
    window.alert = function(msg) { window.showToast(msg, 'info'); };

    // ── 4. MODAL CLOSURE INTERCEPTION ENGINE ───────────────
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    
    // Prototype-level setProperty override
    CSSStyleDeclaration.prototype.setProperty = function(property, value, priority) {
        if (property === 'display' && value === 'none' && window.isAutosaving) {
            const isModalStyle = Array.from(document.querySelectorAll('.modal, [id*="modal"], [id*="Modal"]')).some(m => m.style === this);
            if (isModalStyle) {
                console.log('[Autosave] Blocked modal closure via setProperty');
                return;
            }
        }
        originalSetProperty.call(this, property, value, priority);
    };

    function applyModalInterception() {
        const modals = document.querySelectorAll('.modal, [id*="modal"], [id*="Modal"]');
        modals.forEach(modal => {
            if (modal.style && !modal.style._autosaveInterceptorsApplied) {
                modal.style._autosaveInterceptorsApplied = true;
                
                // Backup original display value/behavior
                let currentDisplay = modal.style.display;
                
                Object.defineProperty(modal.style, 'display', {
                    get: function() {
                        return currentDisplay;
                    },
                    set: function(val) {
                        if (val === 'none' && window.isAutosaving) {
                            console.log('[Autosave] Intercepted and blocked modal closure for:', modal.id);
                            return;
                        }
                        currentDisplay = val;
                        originalSetProperty.call(this, 'display', val);
                    },
                    configurable: true
                });
            }
        });
    }

    // Call initially and on interaction/DOM events to ensure dynamic modals are captured
    applyModalInterception();
    document.addEventListener('focusin', applyModalInterception);
    document.addEventListener('click', applyModalInterception);

    // ── 5. AUTOSAVE FORM LISTENER ENGINE ───────────────────
    window.isAutosaving = false;
    window.isClosing = false;

    // Listen for cancel/close clicks in capture phase to prevent blur triggers
    document.addEventListener('mousedown', function(e) {
        const target = e.target;
        if (!target) return;
        const onclickAttr = target.getAttribute('onclick') || '';
        const isCloseBtn = target.classList.contains('modal-close') || 
                           target.innerText === '✕' || 
                           target.innerText === 'Delete' || 
                           target.innerText === 'X' || 
                           target.closest('.cp-del') || 
                           onclickAttr.includes('none') || 
                           target.id.toLowerCase().includes('cancel') || 
                           target.className.toLowerCase().includes('cancel') || 
                           target.classList.contains('btn-reset') || 
                           target.closest('.modal-close');
        if (isCloseBtn) {
            window.isClosing = true;
            setTimeout(() => { window.isClosing = false; }, 100);
        }
    }, true);

    function isFieldRequired(input, form) {
        if (input.required || input.hasAttribute('required') || input.classList.contains('required')) {
            return true;
        }
        const id = input.id;
        if (id) {
            // Priority category-specific validation locks
            if (window.activeMandatory && Array.isArray(window.activeMandatory) && window.activeMandatory.includes(id)) {
                return true;
            }
            if (window.apActiveMandatory && Array.isArray(window.apActiveMandatory) && window.apActiveMandatory.includes(id)) {
                return true;
            }
            // Check associated labels
            const labels = [
                document.getElementById('lbl_' + id),
                document.getElementById('ap_lbl_' + id),
                document.getElementById('lbl_ap_' + id),
                form.querySelector(`label[for="${id}"]`),
                form.querySelector(`label[id="lbl_${id}"]`)
            ];
            for (const label of labels) {
                if (label && (label.innerText.includes('*') || label.classList.contains('required') || label.classList.contains('required-star'))) {
                    return true;
                }
            }
        }
        return false;
    }

    function isFormValidForAutosave(form) {
        if (!form.checkValidity()) return false;
        
        let hasEmptyRequired = false;
        const inputs = form.querySelectorAll('input, select, textarea');
        for (const input of inputs) {
            if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'file') continue;
            
            if (isFieldRequired(input, form)) {
                if (input.type === 'radio') {
                    const name = input.name;
                    const checked = form.querySelector(`input[name="${name}"]:checked`);
                    if (!checked) {
                        hasEmptyRequired = true;
                        break;
                    }
                } else if (!input.value.trim()) {
                    hasEmptyRequired = true;
                    break;
                }
            }
        }
        return !hasEmptyRequired;
    }

    function hasChanged(el) {
        if (el.type === 'checkbox' || el.type === 'radio') {
            const initialChecked = el.dataset.initialChecked === 'true';
            return el.checked !== initialChecked;
        } else {
            const initialValue = el.dataset.initialValue || '';
            return el.value !== initialValue;
        }
    }

    function updateInitialValue(el) {
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.dataset.initialChecked = el.checked;
        } else {
            el.dataset.initialValue = el.value;
        }
    }

    function triggerAutosave(form) {
        if (window.isClosing) return;
        if (window.isProgrammaticUpdate) return;

        // Skip login forms or login page completely
        if (form && (form.id === 'loginForm' || window.location.pathname.includes('login.html') || window.location.pathname === '/login')) {
            return;
        }

        // Determine if it is Edit mode (has non-empty edit_id input)
        const editIdEl = form.querySelector('#edit_id, input[name="edit_id"]');
        const isEdit = editIdEl && editIdEl.value.trim() !== '';

        // Autosave only if it is an Edit form
        if (isEdit) {
            console.log('[Autosave] Triggering autosave for form:', form.id || 'unnamed');
            window.isAutosaving = true;
            
            // Dispatch standard submit event
            const event = new Event('submit', { cancelable: true, bubbles: true });
            form.dispatchEvent(event);

            // Fallback timeout to reset autosaving state in case operations are slow/stuck
            setTimeout(() => { window.isAutosaving = false; }, 5000);
        }
    }

    // Monitor value changes on focus
    document.addEventListener('focusin', function(e) {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
            if (el.dataset.initialValue === undefined && el.dataset.initialChecked === undefined) {
                updateInitialValue(el);
            }
        }
    });

    // Blur triggers save for text inputs and textareas
    document.addEventListener('focusout', function(e) {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file' && el.type !== 'button' && el.type !== 'submit' || el.tagName === 'TEXTAREA')) {
            const form = el.closest('form');
            if (form && hasChanged(el)) {
                // Wait briefly for relatedTarget or mousedown to register clicks
                setTimeout(() => {
                    if (hasChanged(el)) {
                        updateInitialValue(el);
                        triggerAutosave(form);
                    }
                }, 50);
            }
        }
    });

    // Change triggers save for selects, checkboxes, radio buttons, and dates
    document.addEventListener('change', function(e) {
        const el = e.target;
        if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio' || el.type === 'date' || el.type === 'datetime-local'))) {
            const form = el.closest('form');
            if (form && hasChanged(el)) {
                updateInitialValue(el);
                triggerAutosave(form);
            }
        }
    });

    // ── 6. MANDATORY FIELDS HIGHLIGHTING ENGINE ────────────
    function highlightMandatoryFields() {
        // Skip if on login page
        if (window.location.pathname.includes('login.html') || window.location.pathname === '/login') {
            return;
        }
        document.querySelectorAll('form').forEach(form => {
            if (form.id === 'loginForm') return;
            
            form.querySelectorAll('input, select, textarea').forEach(input => {
                if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'file') return;
                
                const isReq = isFieldRequired(input, form);
                let isEmpty = false;
                
                if (input.type === 'radio') {
                    const name = input.name;
                    const checked = form.querySelector(`input[name="${name}"]:checked`);
                    isEmpty = !checked;
                } else {
                    isEmpty = !input.value.trim();
                }
                
                // Check if it has a text-based sibling date field
                const textSibling = document.getElementById(input.id + '_text');
                
                if (isReq && isEmpty) {
                    input.classList.add('mandatory-empty');
                    if (textSibling) {
                        textSibling.classList.add('mandatory-empty');
                    }
                } else {
                    input.classList.remove('mandatory-empty');
                    if (textSibling) {
                        textSibling.classList.remove('mandatory-empty');
                    }
                }
            });
        });
    }

    // Run on keyup/input, focusin, change
    document.addEventListener('input', highlightMandatoryFields);
    document.addEventListener('keyup', highlightMandatoryFields);
    document.addEventListener('focusin', highlightMandatoryFields);
    document.addEventListener('change', highlightMandatoryFields);
    
    // Also run periodically to handle programmatic changes and initial modal opening
    setInterval(highlightMandatoryFields, 300);

})();
