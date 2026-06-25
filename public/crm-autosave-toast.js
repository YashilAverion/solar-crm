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

    const hideInitialLoader = () => {
        if (window.hideAresLoader) window.hideAresLoader();
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(hideInitialLoader, 100);
    } else {
        window.addEventListener('load', () => {
            setTimeout(hideInitialLoader, 600);
        });
        setTimeout(hideInitialLoader, 1500);
    }

    window.addEventListener('pageshow', function(event) {
        hideInitialLoader();
    });

    window.addEventListener('popstate', hideInitialLoader);
    window.addEventListener('hashchange', hideInitialLoader);

    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:') && !link.getAttribute('target') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                let isSamePage = false;
                try {
                    const targetUrl = new URL(href, window.location.href);
                    if (targetUrl.origin === window.location.origin && targetUrl.pathname === window.location.pathname) {
                        isSamePage = true;
                    }
                } catch (err) {}

                if (!isSamePage) {
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
    const _recentToasts = new Map();

    window.showToast = function(message, type = 'success') {
        if (!message || !message.trim()) return;

        const now = Date.now();
        const lastShown = _recentToasts.get(message);
        if (lastShown && (now - lastShown) < 2000) return;
        _recentToasts.set(message, now);
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
        setTimeout(() => { toast.classList.add('toast-show'); }, 10);

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
                if (window.isAutosaving) {
                    setTimeout(() => { window.isAutosaving = false; }, 500);
                } else {
                    window.isAutosaving = false;
                }

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

    window.alert = function(msg) { window.showToast(msg, 'info'); };

    // ── 4. MODAL CLOSURE INTERCEPTION ENGINE ───────────────
    const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
    
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

    applyModalInterception();
    document.addEventListener('focusin', applyModalInterception);
    document.addEventListener('click', applyModalInterception);

    // ── 5. AUTOSAVE FORM LISTENER ENGINE ───────────────────
    window.isAutosaving = false;
    window.isClosing = false;

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
            if (window.activeMandatory && Array.isArray(window.activeMandatory) && window.activeMandatory.includes(id)) {
                return true;
            }
            if (window.apActiveMandatory && Array.isArray(window.apActiveMandatory) && window.apActiveMandatory.includes(id)) {
                return true;
            }
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

        if (form && (form.id === 'loginForm' || window.location.pathname.includes('login.html') || window.location.pathname === '/login')) {
            return;
        }

        const editIdEl = form.querySelector('#edit_id, input[name="edit_id"]');
        const isEdit = editIdEl && editIdEl.value.trim() !== '';

        if (isEdit) {
            console.log('[Autosave] Triggering autosave for form:', form.id || 'unnamed');
            window.isAutosaving = true;
            
            const event = new Event('submit', { cancelable: true, bubbles: true });
            form.dispatchEvent(event);

            setTimeout(() => { window.isAutosaving = false; }, 5000);
        }
    }

    document.addEventListener('focusin', function(e) {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
            if (el.dataset.initialValue === undefined && el.dataset.initialChecked === undefined) {
                updateInitialValue(el);
            }
        }
    });

    document.addEventListener('focusout', function(e) {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file' && el.type !== 'button' && el.type !== 'submit' || el.tagName === 'TEXTAREA')) {
            const form = el.closest('form');
            if (form && hasChanged(el)) {
                setTimeout(() => {
                    if (hasChanged(el)) {
                        updateInitialValue(el);
                        triggerAutosave(form);
                    }
                }, 50);
            }
        }
    });

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

    document.addEventListener('input', highlightMandatoryFields);
    document.addEventListener('keyup', highlightMandatoryFields);
    document.addEventListener('focusin', highlightMandatoryFields);
    document.addEventListener('change', highlightMandatoryFields);
    
    setInterval(highlightMandatoryFields, 300);

})();

// ── SIDEBAR COLLAPSE / ALWAYS-OPEN SYSTEM ─────────────────────
(function initSidebarCollapseSystem() {
    function runSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainWrap = document.querySelector('.main-wrap');
        if (!sidebar) return;

        // ── 1. Inject CSS for collapsed state ──
        if (!document.getElementById('sb-collapse-style')) {
            const st = document.createElement('style');
            st.id = 'sb-collapse-style';
            st.innerHTML = `
                .sidebar {
                    transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                                opacity 0.28s ease;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .sidebar.sb-collapsed {
                    width: 0 !important;
                    opacity: 0;
                    pointer-events: none;
                }
                .main-wrap {
                    transition: margin-left 0.28s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .main-wrap.sb-collapsed {
                    margin-left: 0 !important;
                }
                #sb-toggle-arrow {
                    position: fixed;
                    top: 50%;
                    left: 180px;
                    transform: translateY(-50%);
                    z-index: 1001;
                    width: 18px;
                    height: 44px;
                    background: #1c3557;
                    color: #e8681e;
                    border: none;
                    border-radius: 0 6px 6px 0;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 900;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
                    box-shadow: 2px 0 8px rgba(0,0,0,0.18);
                    user-select: none;
                }
                #sb-toggle-arrow:hover {
                    background: #e8681e;
                    color: #fff;
                }
                #sb-toggle-arrow.sb-collapsed {
                    left: 0;
                }
            `;
            document.head.appendChild(st);
        }

        // ── 2. Inject toggle arrow button ──
        if (!document.getElementById('sb-toggle-arrow')) {
            const arrow = document.createElement('button');
            arrow.id = 'sb-toggle-arrow';
            arrow.title = 'Toggle Sidebar';
            arrow.innerHTML = '&#9668;'; // ◄
            document.body.appendChild(arrow);

            arrow.addEventListener('click', () => {
                const collapsed = sidebar.classList.toggle('sb-collapsed');
                if (mainWrap) mainWrap.classList.toggle('sb-collapsed', collapsed);
                arrow.innerHTML = collapsed ? '&#9658;' : '&#9668;'; // ► or ◄
                arrow.classList.toggle('sb-collapsed', collapsed);
                try { localStorage.setItem('sb_collapsed', collapsed ? '1' : '0'); } catch(e) {}
            });
        }

        // ── 3. Restore saved state (default: open) ──
        let isCollapsed = false;
        try { isCollapsed = localStorage.getItem('sb_collapsed') === '1'; } catch(e) {}
        const arrow = document.getElementById('sb-toggle-arrow');
        if (isCollapsed) {
            sidebar.classList.add('sb-collapsed');
            if (mainWrap) mainWrap.classList.add('sb-collapsed');
            if (arrow) { arrow.innerHTML = '&#9658;'; arrow.classList.add('sb-collapsed'); }
        } else {
            sidebar.classList.remove('sb-collapsed');
            if (mainWrap) mainWrap.classList.remove('sb-collapsed');
            if (arrow) { arrow.innerHTML = '&#9668;'; arrow.classList.remove('sb-collapsed'); }
        }

        // ── 4. Auto-expand the sub-menu whose child href matches current page ──
        const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
        const allSubMenus = sidebar.querySelectorAll('.sub-menu');
        allSubMenus.forEach(subMenu => {
            const links = subMenu.querySelectorAll('a.menu-item[href]');
            const isActive = Array.from(links).some(link => {
                const href = link.getAttribute('href').replace(/\/+$/, '') || '/';
                return href === currentPath;
            });
            if (isActive) {
                subMenu.style.display = 'block';
                const parentItem = subMenu.previousElementSibling;
                if (parentItem) {
                    const icon = parentItem.querySelector('.toggle-icon');
                    if (icon) icon.innerText = '▲';
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runSidebar);
    } else {
        runSidebar();
    }
})();

// ── VOIPLINE TELECOM CALL INTEGRATION ─────────────────────────
(function() {
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
            initializeVoIP();
        };
        script.onerror = () => {
            console.error('[VoIPLine] Failed to load Socket.IO client script.');
        };
        document.head.appendChild(script);
    } else {
        initializeVoIP();
    }

    async function initializeVoIP() {
        const socket = window.voipSocket || io();
        window.voipSocket = socket;

        socket.on('voipline-incoming-call', (data) => {
            showIncomingCallPopup(data);
        });
        
        // Listen to SMS and Voicemail real-time socket events
        // Note: window.appendSmsBubble and window.loadVoicemailsList are exposed by injectCommunicationSuite
        socket.on('sms-update', (data) => {
            const activeSmsNum = document.getElementById('comm-sms-number');
            if (activeSmsNum && activeSmsNum.value.trim() === data.party_number) {
                if (typeof window.appendSmsBubble === 'function') window.appendSmsBubble(data);
            }
            window.showToast(`💬 SMS from ${data.party_number}: "${(data.message_body || '').substring(0,25)}..."`, 'info');
        });

        socket.on('voicemail-update', (data) => {
            if (typeof window.loadVoicemailsList === 'function') window.loadVoicemailsList();
            window.showToast(`💾 New voicemail received from ${data.caller_number}`, 'success');
        });
        
        console.log('[VoIPLine] Socket.IO listener successfully initialized.');

        try {
            const res = await fetch("/api/me");
            if (res.ok) {
                const currentUser = await res.json();
                if (currentUser && currentUser.username) {
                    window.currentUser = currentUser;

                    // ── VoIP MASTER TOGGLE GATE ─────────────────────────────────
                    if (!currentUser.is_voip_enabled) {
                        // DYNAMIC UI STRIPPING LAYER: VoIP is disabled for this user.
                        // Inject a persistent CSS override that hides ALL dial icon buttons.
                        if (!document.getElementById('voip-disabled-style')) {
                            const killStyle = document.createElement('style');
                            killStyle.id = 'voip-disabled-style';
                            killStyle.innerHTML = `
                                /* VoIP Disabled — hide all dial trigger buttons globally */
                                *[onclick*="triggerVoIPCall"],
                                button[onclick*="triggerVoIPCall"],
                                a[onclick*="triggerVoIPCall"] {
                                    display: none !important;
                                    pointer-events: none !important;
                                }
                                #comm-fixed-fab,
                                #comm-widget-trigger-btn,
                                #comm-suite-drawer {
                                    display: none !important;
                                }
                            `;
                            document.head.appendChild(killStyle);
                        }
                        // Also proactively remove any already-mounted elements
                        ['comm-fixed-fab', 'comm-widget-trigger-btn', 'comm-suite-drawer'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.remove();
                        });
                        // Override the global dial trigger so any runtime calls are silently blocked
                        window.triggerVoIPCall = function() {
                            console.warn('[VoIP] Call blocked — VoIP module is disabled for this user.');
                        };
                        console.log('[VoIPLine] VoIP module is DISABLED for this user. Communication suite and dial icons suppressed.');
                        return; // Abort all further VoIP initialization
                    }
                    // ── END GATE ─────────────────────────────────────────────────

                    const liveStreamSocket = io('/api/voipline/live-stream');
                    window.liveStreamSocket = liveStreamSocket;

                    liveStreamSocket.emit('join', { username: currentUser.username });
                    console.log(`[VoIPLine Live Stream] Joined namespace room: ${currentUser.username}`);

                    liveStreamSocket.on('caption-update', (data) => {
                        showFloatingCaption(data);
                    });

                    // Inject the Communication Suite navigation trigger and drawer panel dynamically
                    injectCommunicationSuite(currentUser);
                }
            }
        } catch (err) {
            console.error('[VoIPLine Live Stream] Error initializing live captions socket:', err);
        }
    }

    function createFloatingCaptionWidget() {
        const container = document.createElement('div');
        container.id = 'voip-live-captions-widget';
        
        container.style.position = 'fixed';
        container.style.width = '340px';
        container.style.height = '160px';
        container.style.minWidth = '260px';
        container.style.minHeight = '120px';
        container.style.zIndex = '1000000';
        container.style.background = 'rgba(255, 255, 255, 0.88)';
        container.style.backdropFilter = 'blur(12px)';
        container.style.webkitBackdropFilter = 'blur(12px)';
        container.style.border = '1.5px solid #e8681e';
        container.style.borderRadius = '12px';
        container.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.18)';
        container.style.fontFamily = "'Inter', system-ui, sans-serif";
        container.style.display = 'none';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.style.resize = 'both';
        container.style.boxSizing = 'border-box';
        
        let prefs = { top: 120, left: window.innerWidth - 360, width: 340, height: 160, locked: false };
        try {
            const stored = localStorage.getItem('voip_live_captions_pref');
            if (stored) {
                prefs = { ...prefs, ...JSON.parse(stored) };
            }
        } catch (e) {}
        
        container.style.top = `${prefs.top}px`;
        container.style.left = `${prefs.left}px`;
        container.style.width = `${prefs.width}px`;
        container.style.height = `${prefs.height}px`;
        
        container.innerHTML = `
            <div id="voip-caption-header" style="background: linear-gradient(135deg, #1c3557 0%, #0f172a 100%); color: #ffffff; padding: 8px 12px; font-weight: 700; font-size: 12px; display: flex; justify-content: space-between; align-items: center; cursor: move; border-bottom: 2px solid #e8681e; user-select: none; box-sizing: border-box; height: 36px;">
                <span style="display: flex; align-items: center; gap: 6px;">🎙️ Live Call Captions</span>
                <div style="display: flex; align-items: center; gap: 8px; pointer-events: auto;">
                    <button id="voip-caption-lock-btn" title="Toggle Click-Through Lock" style="border: none; background: transparent; color: #ffffff; font-size: 13px; cursor: pointer; padding: 2px; line-height: 1; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="if(!window._voipCaptionsLocked) this.style.background='transparent'">🔓</button>
                    <button id="voip-caption-close-btn" title="Close" style="border: none; background: transparent; color: #ffffff; font-size: 12px; cursor: pointer; padding: 2px; line-height: 1; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">✕</button>
                </div>
            </div>
            <div id="voip-caption-body" style="padding: 10px 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; font-size: 13px; line-height: 1.4; box-sizing: border-box;">
                <div id="voip-caption-context" style="font-weight: 800; color: #e8681e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Waiting...</div>
                <div id="voip-caption-text" style="color: #1e293b; font-weight: 500; font-family: 'Inter', system-ui, sans-serif;">Waiting for active call stream...</div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        const header = container.querySelector('#voip-caption-header');
        const lockBtn = container.querySelector('#voip-caption-lock-btn');
        const closeBtn = container.querySelector('#voip-caption-close-btn');
        
        window._voipCaptionsLocked = prefs.locked;
        
        window.setVoipLockState = function(locked) {
            window._voipCaptionsLocked = locked;
            const bodyEl = container.querySelector('#voip-caption-body');
            if (locked) {
                bodyEl.style.pointerEvents = 'none';
                bodyEl.style.opacity = '0.85';
                lockBtn.innerText = '🔒';
                lockBtn.title = 'Unlock Click-Through (Body is currently click-through)';
                lockBtn.style.background = 'rgba(232, 104, 30, 0.2)';
                lockBtn.style.border = '1px solid #e8681e';
                container.style.borderColor = '#94a3b8';
                header.style.borderBottomColor = '#94a3b8';
            } else {
                bodyEl.style.pointerEvents = 'auto';
                bodyEl.style.opacity = '1';
                lockBtn.innerText = '🔓';
                lockBtn.title = 'Lock Click-Through (Allow clicking behind captions)';
                lockBtn.style.background = 'transparent';
                lockBtn.style.border = 'none';
                container.style.borderColor = '#e8681e';
                header.style.borderBottomColor = '#e8681e';
            }
            saveWidgetPrefs();
        };
        
        lockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.setVoipLockState(!window._voipCaptionsLocked);
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            container.style.display = 'none';
        });
        
        let isDragging = false;
        let startX, startY;
        let initialX, initialY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = container.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            container.style.transition = 'none';
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            const margin = 10;
            newX = Math.max(margin, Math.min(window.innerWidth - container.offsetWidth - margin, newX));
            newY = Math.max(margin, Math.min(window.innerHeight - container.offsetHeight - margin, newY));
            
            container.style.left = `${newX}px`;
            container.style.top = `${newY}px`;
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                saveWidgetPrefs();
            }
        });
        
        function saveWidgetPrefs() {
            const rect = container.getBoundingClientRect();
            const preferences = {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                locked: window._voipCaptionsLocked
            };
            try {
                localStorage.setItem('voip_live_captions_pref', JSON.stringify(preferences));
            } catch (e) {}
        }
        
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                saveWidgetPrefs();
            });
            ro.observe(container);
        }
        
        window.setVoipLockState(window._voipCaptionsLocked);
        
        return container;
    }

    window.showFloatingCaption = function(data) {
        let widget = document.getElementById('voip-live-captions-widget');
        if (!widget) {
            widget = createFloatingCaptionWidget();
        }
        
        widget.style.display = 'flex';
        
        const contextEl = document.getElementById('voip-caption-context');
        const textEl = document.getElementById('voip-caption-text');
        
        const project = data.projectNumber || 'AR1001';
        const customer = data.customerName || 'Deep Patel';
        
        contextEl.innerText = `${project} - ${customer}:`;
        textEl.innerText = data.text || 'Listening...';
        
        const bodyEl = document.getElementById('voip-caption-body');
        bodyEl.scrollTop = bodyEl.scrollHeight;
    };

    function showIncomingCallPopup(data) {
        const existing = document.getElementById('voip-incoming-call-popup');
        if (existing) {
            existing.remove();
        }

        const popup = document.createElement('div');
        popup.id = 'voip-incoming-call-popup';
        
        popup.style.position = 'fixed';
        popup.style.bottom = '20px';
        popup.style.left = '20px';
        popup.style.zIndex = '999999';
        popup.style.background = '#ffffff';
        popup.style.color = '#1c2b3a';
        popup.style.border = '1px solid #dde3ed';
        popup.style.borderLeft = '6px solid #e8681e';
        popup.style.borderRadius = '10px';
        popup.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.05)';
        popup.style.padding = '10px 14px';
        popup.style.width = '300px';
        popup.style.fontFamily = "'Inter', system-ui, sans-serif";
        popup.style.animation = 'voipSlideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        popup.style.display = 'flex';
        popup.style.flexDirection = 'column';
        popup.style.gap = '6px';

        if (!document.getElementById('voip-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'voip-animation-styles';
            style.innerHTML = `
                @keyframes voipSlideUp {
                    from { transform: translateY(120%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        const callerNumber = data.callerNumber || 'Unknown';
        const projectNumber = data.projectNumber;
        const customerName = data.customerName;
        const leadId = data.leadId;
        const timeOfCall = data.timeOfCall;

        let timeHTML = '';
        if (timeOfCall) {
            try {
                const date = new Date(timeOfCall);
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeHTML = `<span style="font-size: 10px; color: #94a3b8; font-weight: 500;">${timeString}</span>`;
            } catch(e) {}
        }

        let identificationHTML = '';
        if (leadId && customerName && customerName !== 'Unknown') {
            const identifier = projectNumber ? `${projectNumber} - ${customerName}` : customerName;
            identificationHTML = `
                <div onclick="window.location.href='/project_profile.html?id=${leadId}'; document.getElementById('voip-incoming-call-popup').remove();" style="font-weight: 700; font-size: 13px; color: #1c2b3a; cursor: pointer; transition: color 0.2s; line-height: 1.3;" onmouseover="this.style.color='#e8681e'" onmouseout="this.style.color='#1c2b3a'">
                    ${identifier}
                </div>
                <div style="font-size: 10px; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981;"></span> Matched CRM Profile
                </div>
            `;
        } else {
            identificationHTML = `
                <div style="font-weight: 700; font-size: 13px; color: #475569; line-height: 1.3;">${callerNumber}</div>
                <div style="font-size: 10px; color: #6b7a8d; font-weight: 500; margin-top: 2px;">Unmapped Incoming Call</div>
            `;
        }

        popup.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: #fff3eb; display: flex; align-items: center; justify-content: center; color: #e8681e; font-size: 12px;">
                        📞
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; font-size: 10px; color: #8a9cae; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1;">Incoming VoIP Call</span>
                        ${timeHTML}
                    </div>
                </div>
                <button onclick="document.getElementById('voip-incoming-call-popup').remove()" style="border: none; background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px; line-height: 1; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'; this.style.color='#1c2b3a'" onmouseout="this.style.background='transparent'; this.style.color='#94a3b8'">✕</button>
            </div>
            
            <div style="padding: 4px 0 2px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; margin: 4px 0;">
                ${identificationHTML}
                <div style="font-size: 11px; font-weight: 500; margin-top: 4px; color: #475569;">Caller: <strong style="font-weight: 600; color: #0f172a;">${callerNumber}</strong></div>
            </div>

            <div style="display: flex; gap: 6px;">
                <button id="voip-sim-caption-btn" style="flex: 1.2; height: 26px; background: #0284c7; border: none; border-radius: 5px; color: #ffffff; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#0369a1'" onmouseout="this.style.background='#0284c7'">🎙️ Captions</button>
                ${leadId ? `
                    <button onclick="window.location.href='/project_profile.html?id=${leadId}'; document.getElementById('voip-incoming-call-popup').remove();" style="flex: 1.2; height: 26px; background: #e8681e; border: none; border-radius: 5px; color: #ffffff; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#d05a14'" onmouseout="this.style.background='#e8681e'">Open Profile</button>
                ` : ''}
                <button onclick="document.getElementById('voip-incoming-call-popup').remove()" style="flex: 1; height: 26px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; color: #475569; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">Dismiss</button>
            </div>
        `;

        document.body.appendChild(popup);
        
        const simBtn = popup.querySelector('#voip-sim-caption-btn');
        if (simBtn) {
            simBtn.addEventListener('click', () => {
                if (window.liveStreamSocket && window.currentUser) {
                    showFloatingCaption({
                        projectNumber: projectNumber || 'AR1001',
                        customerName: customerName || 'Deep Patel',
                        text: 'Connecting to live stream...',
                        isFinal: false
                    });
                    
                    window.liveStreamSocket.emit('audio-chunk', {
                        username: window.currentUser.username,
                        projectNumber: projectNumber || 'AR1001',
                        customerName: customerName || 'Deep Patel'
                    });
                    
                    window.showToast('Live Caption stream simulation started!', 'info');
                } else {
                    window.showToast('Live stream socket not connected or user session offline.', 'error');
                }
            });
        }
    }

    // ── INJECT INTEGRATED COMMUNICATION DRAWER & ACTIONS ───────────
    function injectCommunicationSuite(user) {
        let _ua = null;
        let _session = null;
        let _sipCreds = null;

        // A. Inject Stylesheet
        if (!document.getElementById('comm-suite-styles')) {
            const styles = document.createElement('style');
            styles.id = 'comm-suite-styles';
            styles.innerHTML = `
                #comm-suite-drawer {
                    position: fixed;
                    top: 0;
                    right: -400px;
                    width: 385px;
                    height: 100%;
                    z-index: 1000002;
                    background: #ffffff;
                    border-left: 2px solid #e8681e;
                    box-shadow: -10px 0 30px rgba(15,23,42,0.15);
                    display: flex;
                    flex-direction: column;
                    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-sizing: border-box;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .comm-header {
                    background: linear-gradient(135deg, #1c3557 0%, #0f172a 100%);
                    color: #ffffff;
                    padding: 12px 16px;
                    font-weight: 700;
                    font-size: 13px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-sizing: border-box;
                    height: 48px;
                    border-bottom: 2.5px solid #e8681e;
                }

                .comm-close-btn {
                    border: none;
                    background: transparent;
                    color: #ffffff;
                    font-size: 16px;
                    cursor: pointer;
                    line-height: 1;
                    padding: 4px;
                    transition: transform 0.2s;
                }
                .comm-close-btn:hover {
                    transform: scale(1.2);
                }

                .comm-tabs-nav {
                    display: flex;
                    background: #f8fafc;
                    border-bottom: 1px solid #dde3ed;
                    height: 40px;
                    box-sizing: border-box;
                }

                .comm-tab-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748b;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                    user-select: none;
                }

                .comm-tab-btn.active {
                    color: #e8681e;
                    border-bottom-color: #e8681e;
                    background: #ffffff;
                }

                .comm-tab-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    display: none;
                    box-sizing: border-box;
                }

                .comm-tab-content.active {
                    display: flex;
                    flex-direction: column;
                }

                .dialer-input-wrap {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                /* DTMF flash indicator */
                .dtmf-flash-indicator {
                    text-align: center;
                    font-size: 22px;
                    font-weight: 800;
                    color: #e8681e;
                    letter-spacing: 4px;
                    height: 28px;
                    line-height: 28px;
                    margin-bottom: 4px;
                    border-radius: 6px;
                    background: #fff3eb;
                    border: 1px solid #ffd8be;
                    transition: opacity 0.3s;
                }

                /* Active Call Panel — full softphone controller */
                #comm-active-call-panel {
                    margin-top: 10px;
                    border: 1.5px solid #10b981;
                    border-radius: 8px;
                    overflow: hidden;
                    transition: border-color 0.3s;
                }
                #comm-active-call-panel.on-hold {
                    border-color: #f59e0b;
                }
                .active-call-bar {
                    background: linear-gradient(135deg, #064e3b, #065f46);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 7px 12px;
                    transition: background 0.3s;
                }
                #comm-active-call-panel.on-hold .active-call-bar {
                    background: linear-gradient(135deg, #78350f, #92400e);
                }
                .active-call-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    color: #ffffff;
                }
                .active-call-dot {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #6ee7b7;
                    animation: callDotPulse 1.2s ease-in-out infinite;
                }
                #comm-active-call-panel.on-hold .active-call-dot {
                    background: #fcd34d;
                    animation: holdDotPulse 2s ease-in-out infinite;
                }
                @keyframes callDotPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.7); }
                }
                @keyframes holdDotPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
                .active-call-state-badge {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    padding: 2px 7px;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.15);
                    color: #ffffff;
                }
                .call-caller-info {
                    font-size: 11px;
                    color: rgba(255,255,255,0.75);
                    font-weight: 500;
                    margin-top: 0px;
                    padding: 2px 12px 6px;
                    background: linear-gradient(135deg, #064e3b, #065f46);
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                #comm-active-call-panel.on-hold .call-caller-info {
                    background: linear-gradient(135deg, #78350f, #92400e);
                }
                .call-timer-display {
                    font-size: 13px;
                    font-weight: 800;
                    font-variant-numeric: tabular-nums;
                    color: #ffffff;
                    letter-spacing: 1px;
                }
                /* 2×2 softphone control grid */
                .incall-control-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1px;
                    background: #dde3ed;
                }
                .incall-ctrl-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 9px 8px;
                    background: #ffffff;
                    border: none;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 700;
                    color: #475569;
                    transition: background 0.15s, color 0.15s;
                    min-height: 54px;
                    user-select: none;
                }
                .incall-ctrl-btn:hover {
                    background: #f1f5f9;
                    color: #1c3557;
                }
                .incall-ctrl-btn .ctrl-icon {
                    font-size: 18px;
                    line-height: 1;
                }
                .incall-ctrl-btn.active-hold {
                    background: #fef3c7;
                    color: #92400e;
                }
                .incall-ctrl-btn.active-mute {
                    background: #fee2e2;
                    color: #991b1b;
                }
                .incall-ctrl-btn.end-call-ctrl {
                    background: #ef4444;
                    color: #ffffff;
                }
                .incall-ctrl-btn.end-call-ctrl:hover {
                    background: #dc2626;
                    color: #ffffff;
                }
                .incall-ctrl-btn.transfer-ctrl.open {
                    background: #eff6ff;
                    color: #1d4ed8;
                }
                /* Transfer sub-panel */
                .transfer-subpanel {
                    padding: 8px 10px;
                    border-top: 1px solid #dde3ed;
                    background: #f8fafc;
                    display: none;
                }
                .transfer-subpanel.open {
                    display: block;
                }
                .transfer-panel-label {
                    font-size: 9px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    margin-bottom: 5px;
                }
                .transfer-controls-row {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 5px;
                }
                .transfer-ext-select {
                    flex: 1;
                    height: 28px;
                    border-radius: 5px;
                    border: 1px solid #c5d3e8;
                    font-size: 11px;
                    padding: 0 6px;
                    background: #ffffff;
                    color: #1c3557;
                    outline: none;
                }
                .transfer-type-select {
                    width: 66px;
                    height: 28px;
                    border-radius: 5px;
                    border: 1px solid #c5d3e8;
                    font-size: 11px;
                    padding: 0 4px;
                    background: #ffffff;
                    color: #1c3557;
                    outline: none;
                }
                .transfer-execute-btn {
                    width: 100%;
                    height: 26px;
                    border-radius: 5px;
                    background: #1d4ed8;
                    color: #ffffff;
                    border: none;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .transfer-execute-btn:hover { background: #1e40af; }
                /* DTMF display bar (shown during active call) */
                .dtmf-flash-indicator {
                    text-align: center;
                    font-size: 20px;
                    font-weight: 800;
                    color: #e8681e;
                    letter-spacing: 6px;
                    height: 30px;
                    line-height: 30px;
                    margin-bottom: 4px;
                    border-radius: 6px;
                    background: #fff3eb;
                    border: 1px solid #ffd8be;
                    transition: opacity 0.3s;
                }
                .dialer-input {
                    flex: 1;
                    height: 38px;
                    border-radius: 8px;
                    border: 1px solid #dde3ed;
                    padding: 0 12px;
                    font-size: 18px;
                    font-weight: 700;
                    color: #1c3557;
                    outline: none;
                    background: #f8fafc;
                    text-align: center;
                }
                .dialer-backspace {
                    width: 38px;
                    height: 38px;
                    border-radius: 8px;
                    border: 1px solid #dde3ed;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.2s;
                }
                .dialer-backspace:hover {
                    background: #f1f5f9;
                }

                .dialer-numpad {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    padding: 10px 20px;
                    margin: 0 auto;
                }
                .dial-key {
                    width: 58px;
                    height: 58px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 1px solid #dde3ed;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: 800;
                    color: #1c3557;
                    cursor: pointer;
                    transition: all 0.15s;
                    box-shadow: 0 2px 4px rgba(15,23,42,0.04);
                }
                .dial-key:hover {
                    background: #f1f5f9;
                    border-color: #c5d3e8;
                    transform: scale(1.06);
                }
                .dial-key:active {
                    background: #e2e8f0;
                }
                .dial-key-sub {
                    font-size: 9px;
                    color: #94a3b8;
                    font-weight: 500;
                    margin-top: -2px;
                }

                .dialer-call-btn {
                    width: 100%;
                    height: 42px;
                    border-radius: 8px;
                    background: #10b981;
                    color: #ffffff;
                    font-weight: 700;
                    font-size: 14px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 15px;
                    transition: background 0.2s;
                }
                .dialer-call-btn:hover {
                    background: #059669;
                }
                .dialer-status {
                    text-align: center;
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 8px;
                    font-weight: 600;
                }

                .sms-target-wrap {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .sms-target-input {
                    flex: 1;
                    height: 32px;
                    border-radius: 6px;
                    border: 1px solid #dde3ed;
                    padding: 0 10px;
                    font-size: 12px;
                    font-weight: 600;
                    outline: none;
                }
                .sms-history-container {
                    flex: 1;
                    border: 1px solid #dde3ed;
                    border-radius: 8px;
                    background: #f8fafc;
                    padding: 10px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    min-height: 200px;
                    max-height: 380px;
                }
                .sms-bubble {
                    max-width: 80%;
                    padding: 8px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    line-height: 1.4;
                    margin-bottom: 2px;
                }
                .sms-bubble.inbound {
                    background: #e2e8f0;
                    color: #1e293b;
                    align-self: flex-start;
                    border-bottom-left-radius: 2px;
                }
                .sms-bubble.outbound {
                    background: #fff3eb;
                    color: #1c2b3a;
                    align-self: flex-end;
                    border-bottom-right-radius: 2px;
                    border-right: 3px solid #e8681e;
                }
                .sms-bubble-meta {
                    font-size: 9px;
                    color: #94a3b8;
                    margin-top: 2px;
                    align-self: flex-start;
                }
                .sms-bubble.outbound + .sms-bubble-meta {
                    align-self: flex-end;
                }
                .sms-input-wrap {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .sms-textarea {
                    flex: 1;
                    height: 48px;
                    border-radius: 6px;
                    border: 1px solid #dde3ed;
                    padding: 6px 10px;
                    font-size: 12px;
                    outline: none;
                    resize: none;
                    box-sizing: border-box;
                }
                .sms-send-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 6px;
                    background: #e8681e;
                    color: #ffffff;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: background 0.2s;
                }
                .sms-send-btn:hover {
                    background: #d05a14;
                }

                .comm-list-item {
                    padding: 10px;
                    border-radius: 8px;
                    border: 1px solid #dde3ed;
                    background: #ffffff;
                    margin-bottom: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .comm-list-item:hover {
                    border-color: #c5d3e8;
                }
                .comm-item-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .comm-direction-badge {
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 700;
                }
                .direction-inbound {
                    background: #dcfce7;
                    color: #15803d;
                }
                .direction-outbound {
                    background: #eff6ff;
                    color: #1d4ed8;
                }
                .voicemail-unread-badge {
                    background: #fef3c7;
                    color: #d97706;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 800;
                }

                .sim-btn-wrapper {
                    display: flex;
                    gap: 6px;
                    margin-top: 6px;
                }
                .sim-trigger-btn {
                    flex: 1;
                    height: 26px;
                    font-size: 10px;
                    font-weight: 700;
                    border-radius: 4px;
                    border: 1px dashed #94a3b8;
                    background: #f8fafc;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sim-trigger-btn:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
            `;
            document.head.appendChild(styles);
        }

        // B. Inject Trigger Icon Button next to Top Bar or Sidebar Profile
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'comm-widget-trigger-btn';
        triggerBtn.className = 'tb-btn';
        triggerBtn.style.background = '#fff3eb';
        triggerBtn.style.color = '#e8681e';
        triggerBtn.style.borderColor = '#ffd8be';
        triggerBtn.style.width = '36px';
        triggerBtn.style.height = '36px';
        triggerBtn.style.borderRadius = '50%';
        triggerBtn.style.display = 'inline-flex';
        triggerBtn.style.alignItems = 'center';
        triggerBtn.style.justifyContent = 'center';
        triggerBtn.style.padding = '0';
        triggerBtn.style.fontSize = '14px';
        triggerBtn.style.cursor = 'pointer';
        triggerBtn.style.transition = 'all 0.2s';
        triggerBtn.style.marginLeft = '10px';
        triggerBtn.style.marginRight = '5px';
        triggerBtn.title = 'Open Call & SMS Suite';
        triggerBtn.innerHTML = '📞';

        triggerBtn.onmouseover = () => {
            triggerBtn.style.background = '#e8681e';
            triggerBtn.style.color = '#ffffff';
            triggerBtn.style.transform = 'scale(1.08)';
        };
        triggerBtn.onmouseout = () => {
            triggerBtn.style.background = '#fff3eb';
            triggerBtn.style.color = '#e8681e';
            triggerBtn.style.transform = 'scale(1)';
        };

        const topbar = document.querySelector('.topbar');
        if (topbar) {
            const spacer = topbar.querySelector('.tb-spacer');
            if (spacer) {
                spacer.parentNode.insertBefore(triggerBtn, spacer.nextSibling);
            } else {
                topbar.appendChild(triggerBtn);
            }
        } else {
            // Fallback: inject as a permanent fixed-position FAB so it's always reachable
            // regardless of page structure
            triggerBtn.style.position = 'fixed';
            triggerBtn.style.bottom = '24px';
            triggerBtn.style.right = '24px';
            triggerBtn.style.width = '50px';
            triggerBtn.style.height = '50px';
            triggerBtn.style.borderRadius = '50%';
            triggerBtn.style.boxShadow = '0 4px 20px rgba(232,104,30,0.4)';
            triggerBtn.style.zIndex = '999990';
            triggerBtn.style.fontSize = '20px';
            triggerBtn.style.marginLeft = '0';
            triggerBtn.style.marginRight = '0';
            document.body.appendChild(triggerBtn);
        }

        // ── Always inject a secondary fixed FAB so phone button is accessible
        //    on pages where the topbar insertion worked fine (belt-and-suspenders) ──
        if (!document.getElementById('comm-fixed-fab')) {
            const fab = document.createElement('button');
            fab.id = 'comm-fixed-fab';
            fab.title = 'Open Call & SMS Suite';
            fab.innerHTML = '📞';
            fab.style.cssText = [
                'position:fixed', 'bottom:24px', 'right:24px', 'z-index:999990',
                'width:50px', 'height:50px', 'border-radius:50%',
                'background:#e8681e', 'color:#fff', 'border:none',
                'font-size:20px', 'cursor:pointer', 'display:flex',
                'align-items:center', 'justify-content:center',
                'box-shadow:0 4px 20px rgba(232,104,30,0.45)',
                'transition:all 0.2s', 'font-family:Inter,system-ui,sans-serif'
            ].join(';');
            fab.onmouseover = () => { fab.style.transform = 'scale(1.1)'; fab.style.boxShadow = '0 6px 24px rgba(232,104,30,0.6)'; };
            fab.onmouseout  = () => { fab.style.transform = 'scale(1)';   fab.style.boxShadow = '0 4px 20px rgba(232,104,30,0.45)'; };
            fab.addEventListener('click', () => {
                const d = document.getElementById('comm-suite-drawer');
                if (d) { d.style.right = d.style.right === '0px' ? '-400px' : '0px'; }
            });
            document.body.appendChild(fab);

            // Hide the FAB if the topbar trigger is visible (avoid duplicate)
            const checkFabVisibility = () => {
                const tbTrigger = document.getElementById('comm-widget-trigger-btn');
                if (tbTrigger && tbTrigger.parentElement && tbTrigger.parentElement.classList.contains('topbar')) {
                    fab.style.display = 'none';
                }
            };
            setTimeout(checkFabVisibility, 500);
        }

        // C. Inject Sliding Drawer Panel DOM
        const drawer = document.createElement('div');
        drawer.id = 'comm-suite-drawer';
        drawer.innerHTML = `
            <div class="comm-header">
                <span>📞 Communication Center</span>
                <button class="comm-close-btn" id="comm-drawer-close">✕</button>
            </div>
            <div class="comm-tabs-nav">
                <div class="comm-tab-btn active" data-tab="dialer">Dialer</div>
                <div class="comm-tab-btn" data-tab="sms">SMS</div>
                <div class="comm-tab-btn" data-tab="history">History</div>
                <div class="comm-tab-btn" data-tab="voicemails">Voicemails</div>
                <div class="comm-tab-btn" data-tab="phonebook">Phonebook</div>
            </div>
            
            <!-- 1. Dialer Tab View -->
            <div class="comm-tab-content active" id="tab-dialer-view">
                <div class="dialer-input-wrap">
                    <input type="text" class="dialer-input" id="comm-dial-input" placeholder="Enter number...">
                    <button class="dialer-backspace" id="comm-dial-backspace">⌫</button>
                </div>
                <div id="comm-dtmf-flash" class="dtmf-flash-indicator" style="display:none;"></div>
                <div class="dialer-numpad">
                    <div class="dial-key" data-char="1">1<span class="dial-key-sub">.</span></div>
                    <div class="dial-key" data-char="2">2<span class="dial-key-sub">ABC</span></div>
                    <div class="dial-key" data-char="3">3<span class="dial-key-sub">DEF</span></div>
                    <div class="dial-key" data-char="4">4<span class="dial-key-sub">GHI</span></div>
                    <div class="dial-key" data-char="5">5<span class="dial-key-sub">JKL</span></div>
                    <div class="dial-key" data-char="6">6<span class="dial-key-sub">MNO</span></div>
                    <div class="dial-key" data-char="7">7<span class="dial-key-sub">PQRS</span></div>
                    <div class="dial-key" data-char="8">8<span class="dial-key-sub">TUV</span></div>
                    <div class="dial-key" data-char="9">9<span class="dial-key-sub">WXYZ</span></div>
                    <div class="dial-key" data-char="*">*<span class="dial-key-sub"></span></div>
                    <div class="dial-key" data-char="0">0<span class="dial-key-sub">+</span></div>
                    <div class="dial-key" data-char="#">#<span class="dial-key-sub"></span></div>
                </div>
                <button class="dialer-call-btn" id="comm-dial-call-btn">📞 Place Call</button>
                <div class="dialer-status" id="comm-dial-status">Status: Idle</div>

                <!-- ══ STATE B: Active Call Controller Panel ══ -->
                <div id="comm-active-call-panel" style="display:none;">
                    <!-- Status bar -->
                    <div class="active-call-bar">
                        <div class="active-call-indicator">
                            <span class="active-call-dot"></span>
                            <span id="comm-call-state-label">Live Call</span>
                        </div>
                        <span class="active-call-state-badge" id="comm-call-state-badge">ACTIVE</span>
                        <div id="comm-call-timer" class="call-timer-display">00:00</div>
                    </div>
                    <!-- Caller info row -->
                    <div class="call-caller-info" id="comm-call-number-display">
                        <span style="opacity:0.6;">&#9654;</span>
                        <span id="comm-call-number-label">—</span>
                    </div>
                    <!-- 2×2 softphone control grid -->
                    <div class="incall-control-grid">
                        <button class="incall-ctrl-btn" id="comm-hold-btn">
                            <span class="ctrl-icon">&#9646;&#9646;</span>
                            <span id="comm-hold-btn-label">Hold</span>
                        </button>
                        <button class="incall-ctrl-btn" id="comm-mute-btn">
                            <span class="ctrl-icon">&#128263;</span>
                            <span id="comm-mute-btn-label">Mute Mic</span>
                        </button>
                        <button class="incall-ctrl-btn transfer-ctrl" id="comm-transfer-toggle-btn">
                            <span class="ctrl-icon">&#8594;</span>
                            <span>Transfer</span>
                        </button>
                        <button class="incall-ctrl-btn end-call-ctrl" id="comm-end-call-btn">
                            <span class="ctrl-icon">&#128222;</span>
                            <span>End Call</span>
                        </button>
                    </div>
                    <!-- Transfer Sub-Panel (toggled by Transfer button) -->
                    <div class="transfer-subpanel" id="comm-transfer-subpanel">
                        <div class="transfer-panel-label">Transfer To Extension</div>
                        <div class="transfer-controls-row">
                            <select id="comm-transfer-ext" class="transfer-ext-select">
                                <option value="">— Select Agent —</option>
                            </select>
                            <select id="comm-transfer-type" class="transfer-type-select">
                                <option value="blind">Blind</option>
                                <option value="warm">Warm</option>
                            </select>
                        </div>
                        <button id="comm-transfer-btn" class="transfer-execute-btn">↗ Execute Transfer</button>
                    </div>
                </div>
            </div>

            <!-- 2. SMS Tab View -->
            <div class="comm-tab-content" id="tab-sms-view">
                <div class="sms-target-wrap">
                    <input type="text" class="sms-target-input" id="comm-sms-number" placeholder="Enter party number...">
                    <button class="tb-btn" id="comm-sms-load-history" style="height:32px; font-size:11px; padding:0 8px;">Load</button>
                </div>
                <div class="sms-history-container" id="comm-sms-history">
                    <div style="color:#94a3b8; font-size:11px; text-align:center; padding-top:20px;">Enter a phone number above and load SMS history.</div>
                </div>
                <div class="sms-input-wrap">
                    <textarea class="sms-textarea" id="comm-sms-message" placeholder="Type SMS message..."></textarea>
                    <button class="sms-send-btn" id="comm-sms-send">✉️</button>
                </div>
                <div class="sim-btn-wrapper">
                    <button class="sim-trigger-btn" id="comm-sim-sms-btn">⚡ Simulate Inbound SMS</button>
                </div>
            </div>

            <!-- 3. Call History Tab View -->
            <div class="comm-tab-content" id="tab-history-view">
                <div style="font-weight:700; color:#475569; font-size:11px; margin-bottom:6px;">Your Call History Logs:</div>
                <div style="flex:1; overflow-y:auto;" id="comm-history-list">
                    <div style="color:#94a3b8; text-align:center; padding:15px;">Loading calls...</div>
                </div>
            </div>

            <!-- 4. Voicemail Tab View -->
            <div class="comm-tab-content" id="tab-voicemails-view">
                <div style="font-weight:700; color:#475569; font-size:11px; margin-bottom:6px;">Your Received Voicemails:</div>
                <div style="flex:1; overflow-y:auto;" id="comm-voicemail-list">
                    <div style="color:#94a3b8; text-align:center; padding:15px;">Loading voicemails...</div>
                </div>
                <div class="sim-btn-wrapper" style="margin-top:6px;">
                    <button class="sim-trigger-btn" id="comm-sim-vm-btn">⚡ Simulate Inbound Voicemail</button>
                </div>
            </div>

            <!-- 5. Phonebook Tab View -->
            <div class="comm-tab-content" id="tab-phonebook-view" style="padding:10px; display:none; flex-direction:column; gap:8px;">
                <div style="font-weight:700; color:#1c3557; font-size:12px; padding-bottom:6px; border-bottom:1px solid #dde3ed;">
                    📒 Saved Contacts
                </div>

                <!-- Search bar -->
                <input type="text" id="phonebook-search" placeholder="Search contacts..."
                    style="width:100%; height:30px; border:1px solid #dde3ed; border-radius:6px; padding:0 10px;
                           font-size:12px; color:#1c2b3a; background:#f8fafc; outline:none; box-sizing:border-box;
                           font-family:Inter,system-ui,sans-serif;"
                    oninput="if(window.filterPhonebook) window.filterPhonebook(this.value)">

                <!-- Contact list -->
                <div id="phonebook-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:5px; min-height:80px; max-height:220px;">
                    <div style="color:#94a3b8; text-align:center; padding:20px 0; font-size:12px;">Loading contacts...</div>
                </div>

                <!-- Add contact form -->
                <div style="border-top:1px solid #e2e8f0; padding-top:8px;">
                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
                        Add New Contact
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <input type="text" id="phonebook-new-name" placeholder="Full Name"
                            style="width:100%; height:30px; border:1px solid #dde3ed; border-radius:6px; padding:0 10px;
                                   font-size:12px; color:#1c2b3a; background:#fff; outline:none; box-sizing:border-box;
                                   font-family:Inter,system-ui,sans-serif;">
                        <input type="tel" id="phonebook-new-number" placeholder="Phone Number"
                            style="width:100%; height:30px; border:1px solid #dde3ed; border-radius:6px; padding:0 10px;
                                   font-size:12px; color:#1c2b3a; background:#fff; outline:none; box-sizing:border-box;
                                   font-family:Inter,system-ui,sans-serif;">
                        <button id="phonebook-save-btn"
                            style="height:32px; background:#1c3557; color:#fff; border:none; border-radius:6px;
                                   font-size:12px; font-weight:700; cursor:pointer; transition:background 0.2s;
                                   font-family:Inter,system-ui,sans-serif;"
                            onmouseover="this.style.background='#e8681e'" onmouseout="this.style.background='#1c3557'">
                            + Save Contact
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(drawer);


        // D. Toggle Open/Close Drawer Action
        function toggleCommDrawer() {
            const isOpen = drawer.style.right === '0px';
            if (isOpen) {
                drawer.style.right = '-400px';
            } else {
                drawer.style.right = '0px';
                loadCallHistoryLogs();
                loadVoicemailsList();
            }
        }

        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCommDrawer();
        });
        drawer.querySelector('#comm-drawer-close').addEventListener('click', () => {
            drawer.style.right = '-400px';
        });

        // E. Tab Switch Handler
        const tabBtns = drawer.querySelectorAll('.comm-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                drawer.querySelectorAll('.comm-tab-content').forEach(c => {
                    c.classList.remove('active');
                    c.style.display = 'none';
                });

                btn.classList.add('active');
                const targetId = `tab-${btn.getAttribute('data-tab')}-view`;
                const targetPanel = drawer.querySelector(`#${targetId}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                    targetPanel.style.display = 'flex';
                }

                // Fetch lists depending on tab
                const tabName = btn.getAttribute('data-tab');
                if (tabName === 'history') {
                    loadCallHistoryLogs();
                } else if (tabName === 'voicemails') {
                    loadVoicemailsList();
                } else if (tabName === 'phonebook') {
                    loadPhonebook();
                }
            });
        });
        // Also ensure default dialer tab is flex-displayed on load
        const defaultTabPanel = drawer.querySelector('#tab-dialer-view');
        if (defaultTabPanel) defaultTabPanel.style.display = 'flex';

        // ── PHONEBOOK CONTROLLER ─────────────────────────────────
        let _phonebookContacts = [];

        async function loadPhonebook() {
            const listEl = document.getElementById('phonebook-list');
            if (!listEl) return;
            listEl.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px 0; font-size:12px;">Loading...</div>';
            try {
                const res = await fetch('/api/voip/phonebook');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                _phonebookContacts = await res.json();
                renderPhonebookList(_phonebookContacts);
            } catch (err) {
                console.error('[Phonebook] Load error:', err.message);
                listEl.innerHTML = `<div style="color:#ef4444; text-align:center; padding:12px; font-size:12px;">Error loading contacts: ${err.message}</div>`;
            }
        }

        function renderPhonebookList(contacts) {
            const listEl = document.getElementById('phonebook-list');
            if (!listEl) return;
            if (!contacts || contacts.length === 0) {
                listEl.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px 0; font-size:12px;">No contacts saved yet. Add one below.</div>';
                return;
            }
            listEl.innerHTML = contacts.map(c => `
                <div style="display:flex; align-items:center; gap:6px; padding:7px 8px; background:#f8fafc;
                            border:1px solid #e2e8f0; border-radius:7px; font-family:Inter,system-ui,sans-serif;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; font-size:12px; color:#1c2b3a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escPb(c.name)}</div>
                        <div style="font-size:11px; color:#64748b; font-family:monospace;">${escPb(c.number)}</div>
                    </div>
                    <button title="Call ${escPb(c.name)}"
                        onclick="window._pbDial('${escPb(c.number)}')"
                        style="width:28px; height:28px; border-radius:50%; background:#16a34a; color:#fff;
                               border:none; cursor:pointer; font-size:14px; display:flex; align-items:center;
                               justify-content:center; flex-shrink:0; transition:background 0.2s;"
                        onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'"
                    >&#128222;</button>
                    <button title="Delete ${escPb(c.name)}"
                        onclick="window._pbDelete(${c.id})"
                        style="width:28px; height:28px; border-radius:50%; background:#fef2f2; color:#ef4444;
                               border:1px solid #fecaca; cursor:pointer; font-size:11px; display:flex; align-items:center;
                               justify-content:center; flex-shrink:0; transition:background 0.2s; font-weight:900;"
                        onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='#fef2f2'; this.style.color='#ef4444';"
                    >✕</button>
                </div>
            `).join('');
        }

        function escPb(str) {
            return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        }

        window.filterPhonebook = function(query) {
            const q = (query || '').toLowerCase();
            const filtered = _phonebookContacts.filter(c =>
                c.name.toLowerCase().includes(q) || c.number.includes(q)
            );
            renderPhonebookList(filtered);
        };

        window._pbDial = function(number) {
            // Switch to Dialer tab and pre-fill the number
            const dialerTab = drawer.querySelector('.comm-tab-btn[data-tab="dialer"]');
            if (dialerTab) dialerTab.click();
            const dialInput2 = document.getElementById('comm-dial-input');
            if (dialInput2) { dialInput2.value = number; dialInput2.focus(); }
            window.showToast(`Phonebook: ${number} loaded into Dialer`, 'info');
        };

        window._pbDelete = async function(id) {
            if (!confirm('Delete this contact?')) return;
            try {
                const res = await fetch(`/api/voip/phonebook/${id}`, { method: 'DELETE' });
                if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.statusText); }
                _phonebookContacts = _phonebookContacts.filter(c => c.id !== id);
                renderPhonebookList(_phonebookContacts);
                window.showToast('Contact deleted.', 'success');
            } catch (err) {
                console.error('[Phonebook] Delete error:', err.message);
                window.showToast(`Delete failed: ${err.message}`, 'error');
            }
        };

        const pbSaveBtn = document.getElementById('phonebook-save-btn');
        if (pbSaveBtn) {
            pbSaveBtn.addEventListener('click', async () => {
                const nameEl   = document.getElementById('phonebook-new-name');
                const numberEl = document.getElementById('phonebook-new-number');
                const name     = (nameEl   ? nameEl.value.trim()   : '');
                const number   = (numberEl ? numberEl.value.trim() : '');
                if (!name)   { window.showToast('Enter a contact name.', 'error');   return; }
                if (!number) { window.showToast('Enter a phone number.', 'error'); return; }
                pbSaveBtn.disabled = true;
                pbSaveBtn.textContent = 'Saving...';
                try {
                    const res = await fetch('/api/voip/phonebook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, number })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || res.statusText);
                    _phonebookContacts.push({ id: data.id, name: data.name, number: data.number });
                    _phonebookContacts.sort((a, b) => a.name.localeCompare(b.name));
                    renderPhonebookList(_phonebookContacts);
                    if (nameEl)   nameEl.value   = '';
                    if (numberEl) numberEl.value = '';
                    window.showToast(`Contact "${data.name}" saved!`, 'success');
                } catch (err) {
                    console.error('[Phonebook] Save error:', err.message);
                    window.showToast(`Save failed: ${err.message}`, 'error');
                } finally {
                    pbSaveBtn.disabled = false;
                    pbSaveBtn.textContent = '+ Save Contact';
                }
            });
        }
        // ── END PHONEBOOK CONTROLLER ─────────────────────────────────

        // F. Keypad dialer bindings — DTMF-aware state machine
        const dialInput = drawer.querySelector('#comm-dial-input');
        const numKeys = drawer.querySelectorAll('.dial-key');
        const dtmfFlash = drawer.querySelector('#comm-dtmf-flash');
        const activeCallPanel = drawer.querySelector('#comm-active-call-panel');
        const callTimerEl = drawer.querySelector('#comm-call-timer');

        // ── Call session state variables ──────────────────────────────────
        window._commCallActive = false;
        window._commCallLogId = null;
        let _callIsOnHold = false;
        let _callIsMuted = false;
        let _callTimerInterval = null;
        let _callSeconds = 0;
        let _dialedNumber = '';

        // ── Timer helpers ─────────────────────────────────────────────────
        function startCallTimer() {
            _callSeconds = 0;
            if (_callTimerInterval) clearInterval(_callTimerInterval);
            _callTimerInterval = setInterval(() => {
                _callSeconds++;
                const m = String(Math.floor(_callSeconds / 60)).padStart(2, '0');
                const s = String(_callSeconds % 60).padStart(2, '0');
                if (callTimerEl) callTimerEl.innerText = `${m}:${s}`;
            }, 1000);
        }
        function stopCallTimer() {
            if (_callTimerInterval) { clearInterval(_callTimerInterval); _callTimerInterval = null; }
        }

        // ── DTMF flash helper ─────────────────────────────────────────────
        function flashDtmf(digit) {
            if (!dtmfFlash) return;
            dtmfFlash.style.display = 'block';
            dtmfFlash.innerText = (dtmfFlash.innerText + digit).slice(-8); // show last 8 digits
            dtmfFlash.style.opacity = '1';
            clearTimeout(dtmfFlash._hideTimer);
            dtmfFlash._hideTimer = setTimeout(() => {
                dtmfFlash.style.opacity = '0';
                setTimeout(() => {
                    if (window._commCallActive) dtmfFlash.innerText = '';
                }, 400);
            }, 1800);
        }

        // ── Update panel badge / label for call state ─────────────────────
        function updateCallStateBadge(state) {
            const badge = drawer.querySelector('#comm-call-state-badge');
            const label = drawer.querySelector('#comm-call-state-label');
            if (!badge || !label) return;
            if (state === 'On-Hold') {
                badge.textContent = 'ON HOLD';
                badge.style.background = 'rgba(251,191,36,0.25)';
                label.textContent = 'On Hold';
                activeCallPanel.classList.add('on-hold');
            } else {
                badge.textContent = 'ACTIVE';
                badge.style.background = 'rgba(255,255,255,0.15)';
                label.textContent = 'Live Call';
                activeCallPanel.classList.remove('on-hold');
            }
        }

        // ── Numpad clicks ─────────────────────────────────────────────────
        numKeys.forEach(k => {
            k.addEventListener('click', async () => {
                const char = k.getAttribute('data-char');
                if (window._commCallActive) {
                    // STATE B: DTMF mode — stream digit, never mutate dial input
                    flashDtmf(char);
                    if (_session) {
                        console.log('[SIP] Sending native DTMF:', char);
                        _session.sendDTMF(char);
                        return;
                    }
                    try {
                        await fetch('/api/voipline/send-dtmf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ digit: char, callLogId: window._commCallLogId || null })
                        });
                    } catch (e) { console.warn('[DTMF] Send failed:', e.message); }
                } else {
                    // STATE A: normal dial mode
                    dialInput.value += char;
                }
            });
        });

        drawer.querySelector('#comm-dial-backspace').addEventListener('click', () => {
            if (!window._commCallActive) dialInput.value = dialInput.value.slice(0, -1);
        });

        // ── Populate transfer extension dropdown ──────────────────────────
        async function loadTransferExtensions() {
            const extSelect = drawer.querySelector('#comm-transfer-ext');
            if (!extSelect) return;
            try {
                const res = await fetch('/api/voipline/active-users');
                if (res.ok) {
                    const users = await res.json();
                    extSelect.innerHTML = '<option value="">— Select Agent —</option>';
                    users.forEach(u => {
                        const opt = document.createElement('option');
                        opt.value = u.voipline_extension;
                        opt.textContent = `${u.full_name || u.username} — Ext. ${u.voipline_extension}`;
                        extSelect.appendChild(opt);
                    });
                }
            } catch (e) { /* silently ignore if no other agents configured */ }
        }

        // ── Activate STATE B ──────────────────────────────────────────────
        function activateCallState(callLogId, dialedNumber) {
            window._commCallActive = true;
            window._commCallLogId = callLogId || null;
            _callIsOnHold = false;
            _callIsMuted = false;
            _dialedNumber = dialedNumber || dialInput.value.trim() || 'Unknown';

            // Morph Place Call button
            const callBtn = drawer.querySelector('#comm-dial-call-btn');
            const dialStatus = drawer.querySelector('#comm-dial-status');
            if (callBtn) { callBtn.disabled = true; callBtn.style.opacity = '0'; callBtn.style.pointerEvents = 'none'; }
            if (dialStatus) dialStatus.innerText = 'Numpad → DTMF mode while call is live';

            // Show DTMF indicator
            if (dtmfFlash) { dtmfFlash.innerText = ''; dtmfFlash.style.display = 'block'; dtmfFlash.style.opacity = '1'; }

            // Show active call panel
            if (activeCallPanel) activeCallPanel.style.display = 'block';

            // Update caller label
            const numLabel = drawer.querySelector('#comm-call-number-label');
            if (numLabel) numLabel.textContent = _dialedNumber;

            updateCallStateBadge('Active');
            startCallTimer();
            loadTransferExtensions();

            // Reset all control button states
            const holdBtn = drawer.querySelector('#comm-hold-btn');
            const muteBtn = drawer.querySelector('#comm-mute-btn');
            const holdLabel = drawer.querySelector('#comm-hold-btn-label');
            const muteLabel = drawer.querySelector('#comm-mute-btn-label');
            if (holdBtn) { holdBtn.classList.remove('active-hold'); }
            if (muteBtn) { muteBtn.classList.remove('active-mute'); }
            if (holdLabel) holdLabel.textContent = 'Hold';
            if (muteLabel) muteLabel.textContent = 'Mute Mic';
        }

        // ── Reset to STATE A (Idle) ───────────────────────────────────────
        function resetCallState() {
            window._commCallActive = false;
            window._commCallLogId = null;
            _callIsOnHold = false;
            _callIsMuted = false;
            stopCallTimer();

            const callBtn = drawer.querySelector('#comm-dial-call-btn');
            const dialStatus = drawer.querySelector('#comm-dial-status');
            if (callBtn) { callBtn.disabled = false; callBtn.style.opacity = '1'; callBtn.style.pointerEvents = 'auto'; }
            if (dialStatus) dialStatus.innerText = _ua && _ua.isRegistered() ? 'Status: Connected (SIP Ready)' : 'Status: Idle';
            if (dtmfFlash) { dtmfFlash.innerText = ''; dtmfFlash.style.display = 'none'; }
            if (activeCallPanel) { activeCallPanel.style.display = 'none'; activeCallPanel.classList.remove('on-hold'); }
            if (callTimerEl) callTimerEl.innerText = '00:00';

            // Close transfer panel if open
            const transferSubpanel = drawer.querySelector('#comm-transfer-subpanel');
            const transferToggleBtn = drawer.querySelector('#comm-transfer-toggle-btn');
            if (transferSubpanel) transferSubpanel.classList.remove('open');
            if (transferToggleBtn) transferToggleBtn.classList.remove('open');
        }

        // ── Place Call handler ────────────────────────────────────────────
        const dialCallBtn = drawer.querySelector('#comm-dial-call-btn');
        const dialStatus = drawer.querySelector('#comm-dial-status');
        dialCallBtn.addEventListener('click', async () => {
            const num = dialInput.value.trim();
            if (!num) return window.showToast('Please enter a phone number first.', 'error');

            dialStatus.innerText = 'Status: Accessing Microphone...';
            dialCallBtn.disabled = true;

            try {
                // Request mic permission explicitly and hold stream to ensure it works
                const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('[WebRTC] Microphone permission granted.');

                if (!_ua || !_ua.isRegistered()) {
                    console.warn('[SIP] UA not registered. Falling back to server-side calling.');
                    
                    // Stop local stream since server-side calls handle media at the phone/extension
                    localStream.getTracks().forEach(t => t.stop());

                    const res = await fetch('/api/voipline/manual-dial', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber: num })
                    });
                    const data = await res.json();
                    if (res.ok && (data.success || data.simulated)) {
                        window.showToast('Outbound call initiated (Server-side)!', 'success');
                        activateCallState(data.callLogId || null, num);
                    } else {
                        dialStatus.innerText = 'Status: Call Failed';
                        window.showToast(data.error || 'Failed to place call', 'error');
                        dialCallBtn.disabled = false;
                    }
                    return;
                }

                dialStatus.innerText = 'Status: Dialing...';

                // Format number: VoIPLine WebRTC expects E.164 (like '614...' or '612...')
                let cleanNum = num.replace(/\D/g, '');
                if (cleanNum.startsWith('0')) {
                    cleanNum = '61' + cleanNum.substring(1);
                } else if (!cleanNum.startsWith('61') && cleanNum.length === 9) {
                    cleanNum = '61' + cleanNum;
                }

                // Place native JsSIP call
                const options = {
                    mediaStream: localStream,
                    mediaConstraints: { audio: true, video: false },
                    rtcOfferConstraints: { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }
                };

                console.log('[SIP] Initiating native WebRTC call to:', cleanNum);
                const session = _ua.call(`sip:${cleanNum}@${_sipCreds.sip_domain}`, options);
                _session = session;

            } catch (err) {
                console.error('[WebRTC/SIP] Place call failed:', err);
                dialStatus.innerText = 'Status: Error';
                dialCallBtn.disabled = false;
                window.showToast(`Microphone or dialing error: ${err.message}`, 'error');
            }
        });

        // ── Hold / Unhold button ──────────────────────────────────────────
        drawer.querySelector('#comm-hold-btn').addEventListener('click', async () => {
            if (!window._commCallActive) return;
            const holdBtn = drawer.querySelector('#comm-hold-btn');
            const holdLabel = drawer.querySelector('#comm-hold-btn-label');
            
            if (_session) {
                // Native SIP hold/unhold
                if (_callIsOnHold) {
                    console.log('[SIP] Unholding native call');
                    _session.unhold();
                    _callIsOnHold = false;
                    holdBtn.classList.remove('active-hold');
                    holdLabel.textContent = 'Hold';
                    updateCallStateBadge('Active');
                } else {
                    console.log('[SIP] Holding native call');
                    _session.hold();
                    _callIsOnHold = true;
                    holdBtn.classList.add('active-hold');
                    holdLabel.textContent = 'Unhold';
                    updateCallStateBadge('On-Hold');
                }
                return;
            }

            // Fallback to server-side hold/unhold
            const endpoint = _callIsOnHold ? '/api/voipline/unhold' : '/api/voipline/hold';
            holdBtn.disabled = true;
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callLogId: window._commCallLogId })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    _callIsOnHold = !_callIsOnHold;
                    holdBtn.classList.toggle('active-hold', _callIsOnHold);
                    holdLabel.textContent = _callIsOnHold ? 'Unhold' : 'Hold';
                    updateCallStateBadge(_callIsOnHold ? 'On-Hold' : 'Active');
                    window.showToast(_callIsOnHold ? 'Call placed on hold.' : 'Call resumed.', 'info');
                }
            } catch (e) {
                window.showToast('Hold request failed.', 'error');
            } finally {
                holdBtn.disabled = false;
            }
        });

        // ── Mute / Unmute button ──────────────────────────────────────────
        drawer.querySelector('#comm-mute-btn').addEventListener('click', async () => {
            if (!window._commCallActive) return;
            const muteBtn = drawer.querySelector('#comm-mute-btn');
            const muteLabel = drawer.querySelector('#comm-mute-btn-label');
            
            if (_session) {
                // Native SIP mute/unmute
                const nextMuted = !_callIsMuted;
                if (nextMuted) {
                    console.log('[SIP] Muting native mic');
                    _session.mute({ audio: true });
                    _callIsMuted = true;
                    muteBtn.classList.add('active-mute');
                    muteLabel.textContent = 'Unmute';
                    window.showToast('Microphone muted.', 'info');
                } else {
                    console.log('[SIP] Unmuting native mic');
                    _session.unmute({ audio: true });
                    _callIsMuted = false;
                    muteBtn.classList.remove('active-mute');
                    muteLabel.textContent = 'Mute Mic';
                    window.showToast('Microphone unmuted.', 'info');
                }
                return;
            }

            // Fallback to server-side mute/unmute
            muteBtn.disabled = true;
            const nextMuted = !_callIsMuted;
            try {
                const res = await fetch('/api/voipline/mute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ muted: nextMuted, callLogId: window._commCallLogId })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    _callIsMuted = nextMuted;
                    muteBtn.classList.toggle('active-mute', _callIsMuted);
                    muteLabel.textContent = _callIsMuted ? 'Unmute' : 'Mute Mic';
                    window.showToast(_callIsMuted ? 'Microphone muted.' : 'Microphone unmuted.', 'info');
                }
            } catch (e) {
                window.showToast('Mute request failed.', 'error');
            } finally {
                muteBtn.disabled = false;
            }
        });

        // ── Transfer panel toggle button ──────────────────────────────────
        drawer.querySelector('#comm-transfer-toggle-btn').addEventListener('click', () => {
            const subpanel = drawer.querySelector('#comm-transfer-subpanel');
            const btn = drawer.querySelector('#comm-transfer-toggle-btn');
            const isOpen = subpanel.classList.contains('open');
            subpanel.classList.toggle('open', !isOpen);
            btn.classList.toggle('open', !isOpen);
        });

        // ── End Call button ───────────────────────────────────────────────
        drawer.querySelector('#comm-end-call-btn').addEventListener('click', () => {
            if (_session) {
                console.log('[SIP] Terminating active JsSIP session.');
                _session.terminate();
                _session = null;
            }
            resetCallState();
            window.showToast('Call ended.', 'info');
        });

        // ── Transfer Execute button ───────────────────────────────────────
        drawer.querySelector('#comm-transfer-btn').addEventListener('click', async () => {
            const targetExt = drawer.querySelector('#comm-transfer-ext').value;
            const transferType = drawer.querySelector('#comm-transfer-type').value;
            if (!targetExt) return window.showToast('Please select a target agent extension.', 'error');

            const transferBtn = drawer.querySelector('#comm-transfer-btn');
            transferBtn.disabled = true;
            transferBtn.textContent = 'Transferring...';

            try {
                const res = await fetch('/api/voipline/transfer-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetExtension: targetExt,
                        transferType: transferType,
                        callLogId: window._commCallLogId || null
                    })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    window.showToast(`${transferType === 'warm' ? 'Warm' : 'Blind'} transfer → Ext. ${targetExt} complete.`, 'success');
                    resetCallState();
                } else {
                    window.showToast(data.error || 'Transfer failed', 'error');
                }
            } catch (err) {
                window.showToast('Transfer request failed.', 'error');
            } finally {
                transferBtn.disabled = false;
                transferBtn.textContent = '↗ Execute Transfer';
            }
        });


        // G. SMS chat center logic
        const smsNumberInput = drawer.querySelector('#comm-sms-number');
        const smsHistoryBox = drawer.querySelector('#comm-sms-history');
        const smsMessageArea = drawer.querySelector('#comm-sms-message');
        const smsSendBtn = drawer.querySelector('#comm-sms-send');
        const smsLoadBtn = drawer.querySelector('#comm-sms-load-history');

        async function fetchSmsHistory(phone) {
            if (!phone) return;
            smsHistoryBox.innerHTML = '<div style="color:#94a3b8; font-size:11px; text-align:center; padding-top:20px;">Loading messages...</div>';
            try {
                const res = await fetch(`/api/voipline/sms/history?phoneNumber=${encodeURIComponent(phone)}`);
                if (res.ok) {
                    const data = await res.json();
                    smsHistoryBox.innerHTML = '';
                    if (!data || data.length === 0) {
                        smsHistoryBox.innerHTML = '<div style="color:#94a3b8; font-size:11px; text-align:center; padding-top:20px;">No messages exchanged yet. Send a message below to start chat!</div>';
                    } else {
                        data.forEach(appendSmsBubble);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        smsLoadBtn.addEventListener('click', () => {
            fetchSmsHistory(smsNumberInput.value.trim());
        });

        // Expose appendSmsBubble globally so socket event handlers can call it reactively
        window.appendSmsBubble = function appendSmsBubble(msg) {
            const smsBox = document.getElementById('comm-sms-history');
            if (!smsBox) return;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const bubble = document.createElement('div');
            bubble.className = `sms-bubble ${msg.direction}`;
            bubble.innerText = msg.message_body;

            const meta = document.createElement('div');
            meta.className = 'sms-bubble-meta';
            meta.innerText = time;

            smsBox.appendChild(bubble);
            smsBox.appendChild(meta);
            smsBox.scrollTop = smsBox.scrollHeight;
        };

        smsSendBtn.addEventListener('click', async () => {
            const num = smsNumberInput.value.trim();
            const msgText = smsMessageArea.value.trim();

            if (!num || !msgText) return window.showToast('Please fill out recipient number and text message', 'error');

            try {
                const res = await fetch('/api/voipline/sms/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: num, message: msgText })
                });
                if (res.ok) {
                    smsMessageArea.value = '';
                    // The websocket will automatically update the chat window via 'sms-update' event!
                } else {
                    window.showToast('Failed to send SMS message', 'error');
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Inbound SMS Simulator Trigger
        drawer.querySelector('#comm-sim-sms-btn').addEventListener('click', async () => {
            const num = smsNumberInput.value.trim() || '+61491570156';
            try {
                await fetch('/api/voipline/sms/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: num,
                        to: user.voipline_extension || '101',
                        message: 'Hello! I am confirming our Solar PV installation quote. Looks solid.'
                    })
                });
                window.showToast('Inbound SMS simulated successfully!', 'success');
            } catch (e) {
                console.error(e);
            }
        });

        // H. Call History list rendering
        const historyList = drawer.querySelector('#comm-history-list');
        async function loadCallHistoryLogs() {
            historyList.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:15px;">Loading calls...</div>';
            try {
                const res = await fetch('/api/voipline/my-calls');
                if (res.ok) {
                    const data = await res.json();
                    if (!data || data.length === 0) {
                        historyList.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:15px;">No historical call logs found.</div>';
                    } else {
                        historyList.innerHTML = data.map(log => {
                            const date = new Date(log.timestamp).toLocaleString('en-AU', { hour12: true, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                            const dur = log.duration >= 60 ? `${Math.floor(log.duration/60)}m ${log.duration%60}s` : `${log.duration}s`;
                            const directionBadge = log.direction === 'incoming'
                                ? '<span class="comm-direction-badge direction-inbound">IN</span>'
                                : '<span class="comm-direction-badge direction-outbound">OUT</span>';
                            
                            const audioBtn = log.recording_url 
                                ? `<button class="tb-btn" onclick="window.playCommCallAudio('${log.recording_url}')" style="height:22px; font-size:10px; width:auto; padding:0 6px; margin:0 4px 0 0;">▶️ Play</button>`
                                : '';
                            const transBtn = log.transcript_text
                                ? `<button class="tb-btn" onclick="showVoipTranscript('${encodeURIComponent(log.transcript_text)}', '${log.project_number||''}', '${log.caller_number}')" style="height:22px; font-size:10px; width:auto; padding:0 6px; margin:0;">📖 Text</button>`
                                : '';

                            return `
                                <div class="comm-list-item">
                                    <div class="comm-item-meta">
                                        <strong style="color:#1c3557;">${log.caller_number}</strong>
                                        <span>${directionBadge}</span>
                                    </div>
                                    <div style="font-size:10px; color:#64748b;">${date} | Dur: ${dur}</div>
                                    <div style="display:flex; margin-top:4px;">
                                        ${audioBtn}
                                        ${transBtn}
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }
            } catch (e) {
                historyList.innerHTML = '<div style="color:#ef4444; text-align:center; padding:15px;">Failed to load call history.</div>';
            }
        }

        // Global Call Audio Player
        window.playCommCallAudio = function(url) {
            Swal.fire({
                title: '🎧 Playing Call Recording',
                html: `<audio src="${url}" controls autoplay style="width:100%; margin-top:8px; outline:none;"></audio>`,
                showConfirmButton: false,
                showCloseButton: true
            });
        };

        // I. Voicemail list rendering — exposed globally for socket handler access
        const voicemailList = drawer.querySelector('#comm-voicemail-list');
        window.loadVoicemailsList = async function loadVoicemailsList() {
            const vmEl = document.getElementById('comm-voicemail-list');
            if (!vmEl) return;
            vmEl.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:15px;">Loading voicemails...</div>';
            try {
                const res = await fetch('/api/voipline/voicemails');
                if (res.ok) {
                    const data = await res.json();
                    if (!data || data.length === 0) {
                        vmEl.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:15px;">No voicemails found.</div>';
                    } else {
                        vmEl.innerHTML = data.map(vm => {
                            const date = new Date(vm.timestamp).toLocaleString('en-AU', { hour12: true, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                            const unreadBadge = vm.status === 'unread' 
                                ? '<span class="voicemail-unread-badge" id="vm-badge-' + vm.id + '">NEW</span>'
                                : '';
                            
                            return `
                                <div class="comm-list-item">
                                    <div class="comm-item-meta">
                                        <strong style="color:#1c3557;">${vm.caller_number}</strong>
                                        ${unreadBadge}
                                    </div>
                                    <div style="font-size:10px; color:#64748b; margin-bottom:4px;">Received: ${date}</div>
                                    <audio src="${vm.audio_url}" controls onplay="window.markVoicemailAsRead(${vm.id})" style="width:100%; height:26px; outline:none;"></audio>
                                </div>
                            `;
                        }).join('');
                    }
                }
            } catch (e) {
                const vmEl2 = document.getElementById('comm-voicemail-list');
                if (vmEl2) vmEl2.innerHTML = '<div style="color:#ef4444; text-align:center; padding:15px;">Failed to load voicemails.</div>';
            }
        };

        window.markVoicemailAsRead = async function(id) {
            try {
                const res = await fetch(`/api/voipline/voicemails/${id}/read`, { method: 'POST' });
                if (res.ok) {
                    const badge = document.getElementById(`vm-badge-${id}`);
                    if (badge) {
                        badge.remove();
                    }
                }
            } catch (e) {}
        };

        // Inbound Voicemail Simulator Trigger
        drawer.querySelector('#comm-sim-vm-btn').addEventListener('click', async () => {
            try {
                await fetch('/api/voipline/voicemail/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        caller_number: '+61491570156',
                        receiver: user.voipline_extension || '101',
                        audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
                    })
                });
                window.showToast('Inbound voicemail simulated successfully!', 'success');
            } catch (e) {
                console.error(e);
            }
        });

        // J. Global click interceptor for tel: links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href') || '';
                if (href.startsWith('tel:')) {
                    e.preventDefault();
                    const phoneNumber = href.replace('tel:', '').trim();
                    
                    // Toggle drawer open
                    drawer.style.right = '0px';
                    
                    // Switch to Dialer Tab
                    tabBtns.forEach(b => b.classList.remove('active'));
                    drawer.querySelectorAll('.comm-tab-content').forEach(c => c.classList.remove('active'));
                    
                    const dialTab = drawer.querySelector('[data-tab="dialer"]');
                    if (dialTab) dialTab.classList.add('active');
                    drawer.querySelector('#tab-dialer-view').classList.add('active');
                    
                    // Populate input field
                    dialInput.value = phoneNumber;
                    
                    // Switch SMS tab number as well for convenience
                    smsNumberInput.value = phoneNumber;
                    fetchSmsHistory(phoneNumber);
                    
                    window.showToast(`Dialer pre-populated with: ${phoneNumber}`, 'info');
                }
            }
        });

        // Initialize WebRTC SIP client
        initializeWebRTCEngine();

        async function initializeWebRTCEngine() {
            try {
                const res = await fetch('/api/voipline/sip-credentials');
                if (!res.ok) {
                    console.log('[SIP] WebRTC registration credentials not available.');
                    return;
                }
                const creds = await res.json();
                if (!creds.sip_username || !creds.sip_password || !creds.wss_url) {
                    console.log('[SIP] WebRTC softphone credentials not configured for current user.');
                    return;
                }

                _sipCreds = creds;

                // Load JsSIP
                if (!window.JsSIP) {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jssip/3.9.0/jssip.min.js';
                    s.async = true;
                    s.onload = () => {
                        console.log('[SIP] JsSIP library loaded.');
                        startSipClient();
                    };
                    document.head.appendChild(s);
                } else {
                    startSipClient();
                }
            } catch (err) {
                console.error('[SIP] Initialization error:', err);
            }
        }

        function startSipClient() {
            if (!_sipCreds) return;
            console.log('[SIP] Registering WebRTC client endpoint for extension:', _sipCreds.sip_username);
            
            try {
                const socket = new JsSIP.WebSocketInterface(_sipCreds.wss_url);
                const configuration = {
                    sockets: [socket],
                    uri: `sip:${_sipCreds.sip_username}@${_sipCreds.sip_domain}`,
                    password: _sipCreds.sip_password,
                    display_name: _sipCreds.sip_username
                };

                _ua = new JsSIP.UA(configuration);

                _ua.on('connected', () => {
                    console.log('[SIP] WSS Connection established.');
                    const dialStatus = drawer.querySelector('#comm-dial-status');
                    if (dialStatus) dialStatus.innerText = 'Status: Connected (SIP Ready)';
                });

                _ua.on('disconnected', () => {
                    console.log('[SIP] WSS Connection disconnected.');
                    const dialStatus = drawer.querySelector('#comm-dial-status');
                    if (dialStatus) dialStatus.innerText = 'Status: Disconnected (SIP)';
                });

                _ua.on('registered', () => {
                    console.log('[SIP] Registered endpoint successfully.');
                });

                _ua.on('registrationFailed', (e) => {
                    console.error('[SIP] Registration failed:', e.cause);
                });

                _ua.on('newRTCSession', (data) => {
                    const session = data.session;
                    _session = session;

                    session.on('peerconnection', (e) => {
                        e.peerconnection.addEventListener('track', (event) => {
                            let remoteAudio = document.getElementById('webrtc-remote-audio');
                            if (!remoteAudio) {
                                remoteAudio = document.createElement('audio');
                                remoteAudio.id = 'webrtc-remote-audio';
                                remoteAudio.autoplay = true;
                                document.body.appendChild(remoteAudio);
                            }
                            remoteAudio.srcObject = event.streams[0];
                        });
                    });

                    session.on('connecting', () => {
                        const dialStatus = drawer.querySelector('#comm-dial-status');
                        if (dialStatus) dialStatus.innerText = 'Status: Connecting...';
                    });

                    session.on('progress', () => {
                        const dialStatus = drawer.querySelector('#comm-dial-status');
                        if (dialStatus) dialStatus.innerText = 'Status: Ringing...';
                    });

                    session.on('accepted', () => {
                        const dialStatus = drawer.querySelector('#comm-dial-status');
                        if (dialStatus) dialStatus.innerText = 'Status: Connected';
                        activateCallState(null, session.remote_identity.uri.user);
                    });

                    session.on('ended', (e) => {
                        resetCallState();
                        _session = null;
                    });

                    session.on('failed', (e) => {
                        resetCallState();
                        _session = null;
                        window.showToast(`Call failed: ${e.cause}`, 'error');
                    });
                });

                _ua.start();
            } catch (err) {
                console.error('[SIP] Error configuring JsSIP UA:', err);
            }
        }
    }


    // Space-efficient, non-intrusive "Incoming Call Notification" popup modal
    function showIncomingCallPopup(data) {
        const existing = document.getElementById('voip-incoming-call-popup');
        if (existing) {
            existing.remove();
        }

        const popup = document.createElement('div');
        popup.id = 'voip-incoming-call-popup';
        
        // Apply inline styling to avoid stylesheet overrides
        popup.style.position = 'fixed';
        popup.style.bottom = '20px';
        popup.style.left = '20px';
        popup.style.zIndex = '999999';
        popup.style.background = '#ffffff';
        popup.style.color = '#1c2b3a';
        popup.style.border = '1px solid #dde3ed';
        popup.style.borderLeft = '6px solid #e8681e';
        popup.style.borderRadius = '10px';
        popup.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.05)';
        popup.style.padding = '10px 14px';
        popup.style.width = '300px';
        popup.style.fontFamily = "'Inter', system-ui, sans-serif";
        popup.style.animation = 'voipSlideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        popup.style.display = 'flex';
        popup.style.flexDirection = 'column';
        popup.style.gap = '6px';

        if (!document.getElementById('voip-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'voip-animation-styles';
            style.innerHTML = `
                @keyframes voipSlideUp {
                    from { transform: translateY(120%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        const callerNumber = data.callerNumber || 'Unknown';
        const projectNumber = data.projectNumber;
        const customerName = data.customerName;
        const leadId = data.leadId;
        const timeOfCall = data.timeOfCall;

        let timeHTML = '';
        if (timeOfCall) {
            try {
                const date = new Date(timeOfCall);
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeHTML = `<span style="font-size: 10px; color: #94a3b8; font-weight: 500;">${timeString}</span>`;
            } catch(e) {}
        }

        let identificationHTML = '';
        if (leadId && customerName && customerName !== 'Unknown') {
            const identifier = projectNumber ? `${projectNumber} - ${customerName}` : customerName;
            identificationHTML = `
                <div onclick="window.location.href='/project_profile.html?id=${leadId}'; document.getElementById('voip-incoming-call-popup').remove();" style="font-weight: 700; font-size: 13px; color: #1c2b3a; cursor: pointer; transition: color 0.2s; line-height: 1.3;" onmouseover="this.style.color='#e8681e'" onmouseout="this.style.color='#1c2b3a'">
                    ${identifier}
                </div>
                <div style="font-size: 10px; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981;"></span> Matched CRM Profile
                </div>
            `;
        } else {
            identificationHTML = `
                <div style="font-weight: 700; font-size: 13px; color: #475569; line-height: 1.3;">${callerNumber}</div>
                <div style="font-size: 10px; color: #6b7a8d; font-weight: 500; margin-top: 2px;">Unmapped Incoming Call</div>
            `;
        }

        popup.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: #fff3eb; display: flex; align-items: center; justify-content: center; color: #e8681e; font-size: 12px;">
                        📞
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; font-size: 10px; color: #8a9cae; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1;">Incoming VoIP Call</span>
                        ${timeHTML}
                    </div>
                </div>
                <button onclick="document.getElementById('voip-incoming-call-popup').remove()" style="border: none; background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px; line-height: 1; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'; this.style.color='#1c2b3a'" onmouseout="this.style.background='transparent'; this.style.color='#94a3b8'">✕</button>
            </div>
            
            <div style="padding: 4px 0 2px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; margin: 4px 0;">
                ${identificationHTML}
                <div style="font-size: 11px; font-weight: 500; margin-top: 4px; color: #475569;">Caller: <strong style="font-weight: 600; color: #0f172a;">${callerNumber}</strong></div>
            </div>

            <div style="display: flex; gap: 6px;">
                <button id="voip-sim-caption-btn" style="flex: 1.2; height: 26px; background: #0284c7; border: none; border-radius: 5px; color: #ffffff; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#0369a1'" onmouseout="this.style.background='#0284c7'">🎙️ Captions</button>
                ${leadId ? `
                    <button onclick="window.location.href='/project_profile.html?id=${leadId}'; document.getElementById('voip-incoming-call-popup').remove();" style="flex: 1.2; height: 26px; background: #e8681e; border: none; border-radius: 5px; color: #ffffff; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#d05a14'" onmouseout="this.style.background='#e8681e'">Open Profile</button>
                ` : ''}
                <button onclick="document.getElementById('voip-incoming-call-popup').remove()" style="flex: 1; height: 26px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; color: #475569; font-weight: 600; font-size: 11px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">Dismiss</button>
            </div>
        `;

        document.body.appendChild(popup);
        
        const simBtn = popup.querySelector('#voip-sim-caption-btn');
        if (simBtn) {
            simBtn.addEventListener('click', () => {
                if (window.liveStreamSocket && window.currentUser) {
                    showFloatingCaption({
                        projectNumber: projectNumber || 'AR1001',
                        customerName: customerName || 'Deep Patel',
                        text: 'Connecting to live stream...',
                        isFinal: false
                    });
                    
                    window.liveStreamSocket.emit('audio-chunk', {
                        username: window.currentUser.username,
                        projectNumber: projectNumber || 'AR1001',
                        customerName: customerName || 'Deep Patel'
                    });
                    
                    window.showToast('Live Caption stream simulation started!', 'info');
                } else {
                    window.showToast('Live stream socket not connected or user session offline.', 'error');
                }
            });
        }
    }

    // Global VoIP Transcript Viewer — used by inline onclick in call history rows
    window.showVoipTranscript = function(encodedText, projectNumber, callerNumber) {
        const text = decodeURIComponent(encodedText);
        const title = projectNumber ? `📖 Transcript — ${projectNumber}` : `📖 Transcript — ${callerNumber}`;
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                html: `<div style="text-align:left; font-size:13px; line-height:1.6; color:#1e293b; max-height:340px; overflow-y:auto; white-space:pre-wrap; word-wrap:break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`,
                showConfirmButton: false,
                showCloseButton: true,
                width: 540
            });
        } else {
            alert(title + '\n\n' + text);
        }
    };

    // Global Click-to-Call Trigger function
    window.triggerVoIPCall = async function(phoneNumber) {
        if (!phoneNumber) return;
        const cleanNumber = String(phoneNumber).replace(/[^\d+]/g, '');
        if (!cleanNumber) return;

        // Toggle drawer open
        const d = document.getElementById('comm-suite-drawer');
        if (d && d.style.right !== '0px') {
            d.style.right = '0px';
        }
        
        // Switch to Dialer Tab
        const dialerTab = document.querySelector('.comm-tab-btn[data-tab="dialer"]');
        if (dialerTab) {
            dialerTab.click();
        }
        
        const dialInput = document.getElementById('comm-dial-input');
        if (dialInput) {
            dialInput.value = cleanNumber;
        }

        const dialCallBtn = document.getElementById('comm-dial-call-btn');
        if (dialCallBtn) {
            dialCallBtn.click();
        }
    };
})();
