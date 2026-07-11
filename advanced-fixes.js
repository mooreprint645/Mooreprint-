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

  normalizeAdvancedRuntime();
  const previousRenderAll = renderAll;
  renderAll = function () {
    normalizeAdvancedRuntime();
    return previousRenderAll();
  };

  window.MoorePrintNormalizeAdvanced = normalizeAdvancedRuntime;
})();
