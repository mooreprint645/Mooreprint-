(function () {
  let initialized = false;
  let profileTimer = null;

  function installLightweightStyles() {
    if (document.querySelector('#mooreprintPerformanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'mooreprintPerformanceStyles';
    style.textContent = `
      .page-section:not(.active) {
        display: none !important;
      }

      .table-wrap,
      .production-board,
      .calendar-shell,
      .branch-admin-grid {
        contain: layout style;
      }

      html.mooreprint-access-granted.mp-role-pending .app-shell {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      html.mooreprint-access-granted.mp-role-pending body::after {
        content: "Cargando sucursal y permisos…";
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #050505;
        color: #f5c010;
        font: 800 15px/1.4 Inter, system-ui, sans-serif;
        text-align: center;
      }

      html.mp-employee-mode #settings .settings-grid > .panel {
        display: none !important;
      }

      html.mp-employee-mode #settings #supabasePanel {
        display: block !important;
        max-width: 560px;
        margin-inline: auto;
        text-align: center;
      }

      html.mp-employee-mode #supabasePanel > :not(#supabaseSession) {
        display: none !important;
      }

      html.mp-employee-mode.mooreprint-access-granted #supabaseSession {
        display: block !important;
      }

      html.mp-employee-mode #supabaseSession .info-box,
      html.mp-employee-mode #syncSupabaseNow,
      html.mp-employee-mode #cloudCatalogStatus,
      html.mp-employee-mode #monthlyCostCloudStatus,
      html.mp-employee-mode #branchSyncStatus {
        display: none !important;
      }

      html.mp-employee-mode #supabaseSession .stack-actions {
        display: flex;
        justify-content: center;
      }

      html.mp-employee-mode #supabaseSignOut {
        display: inline-flex !important;
        width: min(100%, 320px);
        min-height: 52px;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 800;
      }

      html.mp-employee-mode #supabasePanel::before {
        content: "Cerrar sesión";
        display: block;
        margin-bottom: 18px;
        font-size: 24px;
        font-weight: 900;
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          scroll-behavior: auto !important;
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setRolePending(pending) {
    document.documentElement.classList.toggle('mp-role-pending', Boolean(pending));
    document.documentElement.classList.toggle('mp-role-ready', !pending);
  }

  function applyEmployeeMode() {
    const access = window.MoorePrintBranches;
    const profile = access?.getProfile?.();
    if (!profile) return false;

    const employee = !access.isAdmin?.();
    document.documentElement.classList.toggle('mp-employee-mode', employee);

    const settingsButton = document.querySelector('.nav-item[data-section="settings"]');
    const accountButton = document.querySelector('#cloudAccountButton');

    if (employee) {
      if (settingsButton) settingsButton.innerHTML = '<span>🚪</span> Cerrar sesión';
      if (accountButton) accountButton.textContent = 'Cerrar sesión';
      if (document.querySelector('#settings')?.classList.contains('active')) {
        const title = document.querySelector('#pageTitle');
        if (title) title.textContent = 'Cerrar sesión';
      }
    }

    setRolePending(false);
    return true;
  }

  function waitForProfile() {
    clearTimeout(profileTimer);
    const check = () => {
      if (applyEmployeeMode()) return;
      if (document.documentElement.classList.contains('mooreprint-access-granted')) {
        setRolePending(true);
      }
      profileTimer = setTimeout(check, 120);
    };
    check();
  }

  function bindEmployeeUiRefresh() {
    document.addEventListener('click', event => {
      const settings = event.target.closest('.nav-item[data-section="settings"], #cloudAccountButton');
      if (!settings) return;
      requestAnimationFrame(applyEmployeeMode);
    });

    window.addEventListener('focus', () => {
      if (!applyEmployeeMode()) waitForProfile();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (!applyEmployeeMode()) waitForProfile();
    });
  }

  function observeAccessState() {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      if (root.classList.contains('mooreprint-access-granted')) {
        if (!applyEmployeeMode()) {
          setRolePending(true);
          waitForProfile();
        }
      } else {
        setRolePending(true);
        root.classList.remove('mp-employee-mode');
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installLightweightStyles();
    setRolePending(true);
    bindEmployeeUiRefresh();
    observeAccessState();
    waitForProfile();
  }

  window.MoorePrintPerformance = { init, applyEmployeeMode };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
