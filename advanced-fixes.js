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

  function loadUsabilityLayer() {
    if (!document.querySelector('link[href="usability.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'usability.css';
      document.head.appendChild(style);
    }
    if (!document.querySelector('script[src="usability.js"]')) {
      const script = document.createElement('script');
      script.src = 'usability.js';
      script.defer = true;
      document.head.appendChild(script);
    }
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
