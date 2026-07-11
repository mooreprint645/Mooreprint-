(function () {
  let initialized = false;

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

  function applyEmployeeMode() {
    const access = window.MoorePrintBranches;
    const profile = access?.getProfile?.();
    if (!profile) return false;

    const employee = !access.isAdmin?.();
    document.documentElement.classList.toggle('mp-employee-mode', employee);

    if (employee) {
      const settingsButton = document.querySelector('.nav-item[data-section="settings"]');
      if (settingsButton) settingsButton.innerHTML = '<span>🚪</span> Cerrar sesión';

      const accountButton = document.querySelector('#cloudAccountButton');
      if (accountButton) accountButton.textContent = 'Cerrar sesión';

      if (document.querySelector('#settings')?.classList.contains('active')) {
        const title = document.querySelector('#pageTitle');
        if (title) title.textContent = 'Cerrar sesión';
      }
    }

    return true;
  }

  function waitForProfile() {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      if (applyEmployeeMode() || attempts >= 100) return;
      setTimeout(check, 200);
    };
    check();
  }

  function bindEmployeeUiRefresh() {
    document.addEventListener('click', event => {
      const settings = event.target.closest('.nav-item[data-section="settings"], #cloudAccountButton');
      if (!settings) return;
      requestAnimationFrame(applyEmployeeMode);
    });

    window.addEventListener('focus', applyEmployeeMode, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') applyEmployeeMode();
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installLightweightStyles();
    bindEmployeeUiRefresh();
    waitForProfile();
  }

  window.MoorePrintPerformance = { init, applyEmployeeMode };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
