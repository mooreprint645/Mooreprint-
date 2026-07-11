(function () {
  function normalizeAdvancedRuntime() {
    state.activityLog = Array.isArray(state.activityLog) ? state.activityLog : [];
    state.wasteRecords = Array.isArray(state.wasteRecords) ? state.wasteRecords : [];
    state.goals = { sales: 30000, profit: 12000, orders: 80, ...(state.goals || {}) };
    state.business = {
      whatsapp: '', bank: '', clabe: '', depositPercent: 50, quoteValidity: 15,
      policies: 'El trabajo comienza al recibir el anticipo y la aprobación del diseño.',
      ...(state.business || {})
    };
    state.orders = Array.isArray(state.orders) ? state.orders.map(order => ({
      designRevisions: 0, approvedBy: '', approvedAt: '', approvalNote: '', designChanges: '', clientApproved: false,
      ...order
    })) : [];
  }

  function preventDuplicateOnboardingRenders() {
    if (window.__mooreprintInnerHtmlGuard) return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) return;
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          const next = String(value ?? '');
          if (this.id === 'uxOnboarding' && descriptor.get.call(this) === next) return;
          descriptor.set.call(this, value);
        }
      });
      window.__mooreprintInnerHtmlGuard = true;
    } catch (error) {
      console.warn('No fue posible activar la optimización visual.', error);
    }
  }

  function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = href;
    document.head.appendChild(style);
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function loadUsabilityLayer() {
    preventDuplicateOnboardingRenders();
    loadStyle('usability.css');
    loadStyle('mobile-fixes.css');
    loadScript('usability.js');
    loadScript('mobile-fixes.js');
  }

  normalizeAdvancedRuntime();
  const previousRenderAll = renderAll;
  renderAll = function () {
    normalizeAdvancedRuntime();
    return previousRenderAll();
  };

  loadUsabilityLayer();
  window.MoorePrintNormalizeAdvanced = normalizeAdvancedRuntime;
})();
