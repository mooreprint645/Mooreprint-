(function () {
  const WRAPPED = Symbol('mooreprint-unit-normalization');

  function readableUnit(value, fallback = 'pieza') {
    const text = String(value ?? '').trim();
    if (!text || /^[-+]?\d+(?:[.,]\d+)?$/.test(text)) return fallback;
    return text;
  }

  function normalizeUnits() {
    if (typeof state === 'undefined' || !state) return 0;
    let changes = 0;

    (state.materials || []).forEach(material => {
      const next = readableUnit(material.unit, 'pieza');
      if (material.unit === next) return;
      material.unit = next;
      changes += 1;
    });

    (state.supplierCatalog || []).forEach(item => {
      const material = (state.materials || []).find(row => row.id === item.materialId);
      const fallback = readableUnit(material?.unit, 'pieza');
      const next = readableUnit(item.unit, fallback);
      if (item.unit === next) return;
      item.unit = next;
      changes += 1;
    });

    if (changes && typeof persistState === 'function') persistState();
    return changes;
  }

  function wrapBefore(name) {
    const original = window[name];
    if (typeof original !== 'function' || original[WRAPPED]) return;
    const wrapped = function (...args) {
      normalizeUnits();
      return original.apply(this, args);
    };
    wrapped[WRAPPED] = true;
    window[name] = wrapped;
  }

  function wrapAfter(name) {
    const original = window[name];
    if (typeof original !== 'function' || original[WRAPPED]) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      const changes = normalizeUnits();
      if (changes && typeof renderAll === 'function') renderAll();
      return result;
    };
    wrapped[WRAPPED] = true;
    window[name] = wrapped;
  }

  function installWrappers() {
    wrapBefore('openPurchaseModal');
    wrapBefore('openSupplierModal');
    wrapBefore('openMaterialModal');
    wrapAfter('saveSupplier');
    wrapAfter('saveMaterial');
  }

  function refresh() {
    const changes = normalizeUnits();
    installWrappers();
    if (changes && typeof renderAll === 'function') renderAll();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#newPurchaseButton,[data-edit-purchase],#newSupplierButton,[data-edit-supplier],#newMaterialButton,[data-edit-material]');
    if (target) refresh();
  }, true);
  window.addEventListener('focus', refresh);

  refresh();
  let attempts = 0;
  const timer = setInterval(() => {
    refresh();
    attempts += 1;
    if (attempts >= 20) clearInterval(timer);
  }, 500);

  window.MoorePrintUnitNormalization = { readableUnit, normalizeUnits, refresh };
})();
