(function () {
  let initialized = false;

  function isPhoneLike() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const smallScreen = Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 900;
    return Boolean(coarse && smallScreen);
  }

  function updateCompactMode() {
    const compact = innerWidth <= 1100 || isPhoneLike();
    document.documentElement.classList.toggle('ux-compact', compact);
    if (!compact) closeSidebar();
  }

  function sidebar() { return document.querySelector('#sidebar'); }

  function syncSidebarState() {
    const open = Boolean(sidebar()?.classList.contains('open'));
    document.body.classList.toggle('ux-sidebar-open', open && document.documentElement.classList.contains('ux-compact'));
    const backdrop = document.querySelector('#uxSidebarBackdrop');
    if (backdrop) backdrop.setAttribute('aria-hidden', String(!open));
  }

  function closeSidebar() {
    sidebar()?.classList.remove('open');
    document.body.classList.remove('ux-sidebar-open');
  }

  function injectControls() {
    if (!document.querySelector('#uxSidebarBackdrop')) {
      document.body.insertAdjacentHTML('beforeend', '<div class="ux-sidebar-backdrop" id="uxSidebarBackdrop" aria-hidden="true"></div>');
    }
    const brand = sidebar()?.querySelector('.brand');
    if (brand && !brand.querySelector('#uxSidebarClose')) {
      brand.insertAdjacentHTML('beforeend', '<button class="ux-sidebar-close" id="uxSidebarClose" type="button" aria-label="Cerrar menú">×</button>');
    }
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button,.ux-sidebar-backdrop');
      if (!target) return;
      if (target.id === 'uxSidebarClose' || target.id === 'uxSidebarBackdrop') closeSidebar();
      if (target.matches('.nav-item') && document.documentElement.classList.contains('ux-compact')) closeSidebar();
      if (target.dataset.uxMobileAdd !== undefined) closeSidebar();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSidebar();
    });

    window.addEventListener('resize', updateCompactMode, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(updateCompactMode, 120), { passive: true });

    const menu = sidebar();
    if (menu) new MutationObserver(syncSidebarState).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }

  function preventBackgroundSwipe() {
    let startX = 0;
    document.addEventListener('touchstart', event => {
      if (!document.body.classList.contains('ux-sidebar-open')) return;
      startX = event.touches[0]?.clientX || 0;
    }, { passive: true });
    document.addEventListener('touchend', event => {
      if (!document.body.classList.contains('ux-sidebar-open')) return;
      const endX = event.changedTouches[0]?.clientX || startX;
      if (startX - endX > 70) closeSidebar();
    }, { passive: true });
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    injectControls();
    updateCompactMode();
    bindEvents();
    preventBackgroundSwipe();
    syncSidebarState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
