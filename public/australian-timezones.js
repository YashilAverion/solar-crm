// Australian Timezones Live Clocks
// Injects a timezone widget dynamically into the CRM sidebar (preferred) or topbar (fallback)
(function() {
    'use strict';

    function initTimezoneClocks() {
        // Avoid duplicate injection
        if (document.querySelector('.aus-timezone-container')) return;

        const sidebar = document.querySelector('.sidebar');
        const topbar = document.querySelector('.topbar');
        
        if (!sidebar && !topbar) return; // Exit if neither sidebar nor topbar exists

        // Create container
        const container = document.createElement('div');
        
        const timezones = [
            { label: 'WA', zone: 'Australia/Perth' },
            { label: 'NT', zone: 'Australia/Darwin' },
            { label: 'SA', zone: 'Australia/Adelaide' },
            { label: 'NSW', zone: 'Australia/Sydney' },
            { label: 'VIC', zone: 'Australia/Melbourne' },
            { label: 'TAS', zone: 'Australia/Hobart' },
            { label: 'IND', zone: 'Asia/Kolkata' }
        ];

        // 1. Inject styling matching the premium CRM theme
        const style = document.createElement('style');
        
        if (sidebar) {
            // Sidebar display (Compact Grid Style)
            container.className = 'aus-timezone-container aus-timezone-sidebar';
            
            style.innerHTML = `
                .aus-timezone-sidebar {
                    padding: 12px 14px;
                    background: #0b1120; /* Dark premium background matching sb-footer */
                    border-top: 1px solid #1e293b;
                    font-family: 'Inter', system-ui, sans-serif;
                    user-select: none;
                    flex-shrink: 0;
                }
                .timezone-sidebar-title {
                    font-size: 9px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                }
                .timezone-sidebar-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }
                .timezone-sidebar-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 6px;
                    padding: 5px 2px;
                    transition: border-color 0.2s, transform 0.2s;
                }
                .timezone-sidebar-item:hover {
                    border-color: #e8681e;
                    transform: translateY(-1px);
                }
                .timezone-sidebar-item:last-child {
                    grid-column: span 2;
                }
                .timezone-sidebar-label {
                    font-weight: 800;
                    color: #94a3b8;
                    font-size: 8px;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }
                .timezone-sidebar-time {
                    font-weight: 700;
                    color: #e8681e; /* Premium Orange Accent */
                    font-size: 10px;
                    font-variant-numeric: tabular-nums;
                }
            `;
            
            container.innerHTML = `
                <div class="timezone-sidebar-title">
                    <span>🕒 Live State Times</span>
                </div>
                <div class="timezone-sidebar-grid">
                    ${timezones.map(tz => `
                        <div class="timezone-sidebar-item" title="${tz.zone} Time">
                            <span class="timezone-sidebar-label">${tz.label}</span>
                            <span class="timezone-sidebar-time" id="tz-clock-${tz.label.toLowerCase()}">--:-- --</span>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Insert before sb-footer if exists, otherwise append to sidebar
            const sbFooter = sidebar.querySelector('.sb-footer');
            if (sbFooter) {
                sidebar.insertBefore(container, sbFooter);
            } else {
                sidebar.appendChild(container);
            }
            
        } else {
            // Fallback: Topbar display (Horizontal pill bar)
            container.className = 'aus-timezone-container aus-timezone-topbar';
            
            style.innerHTML = `
                .aus-timezone-topbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 0 auto;
                    padding: 4px 14px;
                    background: #f8fafc;
                    border: 1px solid #dde3ed;
                    border-radius: 20px;
                    font-size: 10px;
                    font-family: 'Inter', system-ui, sans-serif;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
                    user-select: none;
                    flex-wrap: nowrap;
                    white-space: nowrap;
                }
                .timezone-topbar-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .timezone-topbar-label {
                    font-weight: 700;
                    color: #1c3557;
                    text-transform: uppercase;
                    font-size: 9px;
                    letter-spacing: 0.3px;
                }
                .timezone-topbar-time {
                    font-weight: 600;
                    color: #e8681e;
                    font-variant-numeric: tabular-nums;
                }
                .timezone-topbar-separator {
                    color: #cbd5e1;
                    font-weight: 300;
                }
            `;
            
            container.innerHTML = timezones.map((tz, index) => `
                <div class="timezone-topbar-item">
                    <span class="timezone-topbar-label">${tz.label}:</span>
                    <span class="timezone-topbar-time" id="tz-clock-${tz.label.toLowerCase()}">--:-- --</span>
                </div>
                ${index < timezones.length - 1 ? '<span class="timezone-topbar-separator">|</span>' : ''}
            `).join('');
            
            // Insert in Topbar
            const userDisplay = topbar.querySelector('.user-profile') || topbar.querySelector('.sb-user') || topbar.lastElementChild;
            if (userDisplay && userDisplay !== topbar.firstElementChild) {
                topbar.insertBefore(container, userDisplay);
            } else {
                topbar.appendChild(container);
            }
        }

        document.head.appendChild(style);

        // Clocks update function (HH:MM AM/PM for clean and compact layout)
        function updateClocks() {
            const now = new Date();
            timezones.forEach(tz => {
                const el = document.getElementById(`tz-clock-${tz.label.toLowerCase()}`);
                if (el) {
                    const options = {
                        timeZone: tz.zone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    };
                    let timeStr = now.toLocaleTimeString('en-AU', options);
                    
                    // Standardize space between digits and AM/PM
                    timeStr = timeStr.replace(/\s+/g, ' ');
                    el.textContent = timeStr.toUpperCase();
                }
            });
        }

        updateClocks();
        setInterval(updateClocks, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTimezoneClocks);
    } else {
        initTimezoneClocks();
    }
})();
