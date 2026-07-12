(function () {
  if (window.__moorePrintAccountingCloudSync) return;
  window.__moorePrintAccountingCloudSync = true;

  const current = window.performDelete;
  if (typeof current !== 'function') return;

  const wrapped = function (type, id) {
    const existed = type === 'purchase' && Boolean(window.state?.purchases?.some(item => item.id === id));
    const result = current(type, id);
    const finish = () => {
      const deleted = existed && !window.state?.purchases?.some(item => item.id === id);
      if (!deleted) return;
      setTimeout(() => {
        window.MoorePrintOperations?.sync?.(['material', 'inventory_movement']);
      }, 80);
    };
    if (result && typeof result.then === 'function') return result.finally(finish);
    finish();
    return result;
  };

  wrapped.__accountingCloudSyncWrapped = true;
  window.performDelete = wrapped;
  try { (0, eval)('performDelete = window.performDelete'); } catch (error) {}
})();