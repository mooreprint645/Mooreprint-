(function () {
  if (!Object.prototype.hasOwnProperty.call(window, 'state')) {
    try {
      Object.defineProperty(window, 'state', {
        configurable: true,
        enumerable: false,
        get() { return state; },
        set(value) { state = value; }
      });
    } catch (error) {
      console.warn('No fue posible compartir el estado de MoorePrint.', error);
    }
  }

  const SCOPED_STATE_PREFIX = 'mooreprint-control-v1-user-';
  const STORAGE_GUARD_MARKER = '__mpScopedStateIsolation';
  const RENDER_MARKER = '__mpPagedCollectionSafe';
  const DELETE_MARKER = '__mpPagedDeleteSafe';
  const collections = {
    customers: { renderer: 'renderCustomers', map: new Map(), stateRef: null, fullArray: null, pageRows: null, pendingDelete: '' },
    quotes: { renderer: 'renderQuotes', map: new Map(), stateRef: null, fullArray: null, pageRows: null, pendingDelete: '' }
  };

  function emptyScopedState() {
    return JSON.stringify({ version: 4, business: { name: 'MoorePrint' } });
  }

  function hasAnotherScopedState(excludedKey) {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(SCOPED_STATE_PREFIX) && key !== excludedKey) return true;
    }
    return false;
  }

  function installScopedStateIsolation() {
    const prototype = window.Storage?.prototype;
    const original = prototype?.getItem;
    if (!prototype || typeof original !== 'function' || original[STORAGE_GUARD_MARKER]) return;

    const guarded = function (key) {
      const result = original.call(this, key);
      if (this !== window.localStorage || result !== null || !String(key).startsWith(SCOPED_STATE_PREFIX)) return result;
      return hasAnotherScopedState(String(key)) ? emptyScopedState() : null;
    };
    guarded[STORAGE_GUARD_MARKER] = true;
    prototype.getItem = guarded;
  }

  function rowsFor(type) {
    const rows = window.state?.[type];
    return Array.isArray(rows) ? rows : [];
  }

  function resetCollection(type) {
    const cache = collections[type];
    const rows = rowsFor(type);
    cache.stateRef = window.state;
    cache.map = new Map(rows.filter(row => row?.id).map(row => [row.id, row]));
    cache.fullArray = [...cache.map.values()];
    cache.pageRows = null;
    cache.pendingDelete = '';
    if (window.state) window.state[type] = cache.fullArray;
  }

  function ensureCollection(type) {
    const cache = collections[type];
    if (!cache || cache.stateRef !== window.state || !Array.isArray(cache.fullArray)) resetCollection(type);
    return cache;
  }

  function mergeRows(cache, rows) {
    (rows || []).forEach(row => {
      if (row?.id) cache.map.set(row.id, row);
    });
    if (cache.pendingDelete) cache.map.delete(cache.pendingDelete);
    cache.fullArray = [...cache.map.values()];
  }

  function visibleRows(cache) {
    if (!cache.pageRows) return cache.fullArray;
    return cache.pageRows
      .filter(row => row?.id && row.id !== cache.pendingDelete)
      .map(row => cache.map.get(row.id) || row);
  }

  function wrapRenderer(type) {
    const cache = collections[type];
    const current = window[cache.renderer];
    if (typeof current !== 'function' || current[RENDER_MARKER]) return false;

    const wrapped = function (...args) {
      const active = ensureCollection(type);
      const incoming = rowsFor(type);
      if (incoming !== active.fullArray) active.pageRows = incoming.slice();
      mergeRows(active, incoming);
      if (active.pendingDelete) active.pageRows = active.pageRows?.filter(row => row?.id !== active.pendingDelete) || null;
      window.state[type] = visibleRows(active);
      try {
        return current.apply(this, args);
      } finally {
        mergeRows(active, rowsFor(type));
        window.state[type] = active.fullArray;
      }
    };
    wrapped[RENDER_MARKER] = true;
    window[cache.renderer] = wrapped;
    try { eval(`${cache.renderer} = window[cache.renderer]`); } catch (error) {}
    return true;
  }

  function wrapDelete() {
    const current = window.performDelete;
    if (typeof current !== 'function' || current[DELETE_MARKER]) return false;
    const wrapped = function (type, id, ...args) {
      const collectionType = type === 'customer' ? 'customers' : type === 'quote' ? 'quotes' : '';
      if (!collectionType) return current.call(this, type, id, ...args);

      const cache = ensureCollection(collectionType);
      const previous = cache.map.get(id) || rowsFor(collectionType).find(row => row?.id === id) || null;
      cache.pendingDelete = id;
      const result = current.call(this, type, id, ...args);
      const stillExists = rowsFor(collectionType).some(row => row?.id === id);
      if (stillExists && previous) cache.map.set(id, previous);
      else {
        cache.map.delete(id);
        cache.pageRows = cache.pageRows?.filter(row => row?.id !== id) || null;
      }
      cache.pendingDelete = '';
      cache.fullArray = [...cache.map.values()];
      if (window.state) window.state[collectionType] = cache.fullArray;
      return result;
    };
    wrapped[DELETE_MARKER] = true;
    window.performDelete = wrapped;
    try { performDelete = wrapped; } catch (error) {}
    return true;
  }

  function installCollectionSafety() {
    Object.keys(collections).forEach(wrapRenderer);
    wrapDelete();
  }

  installScopedStateIsolation();
  installCollectionSafety();

  let attempts = 0;
  const timer = setInterval(() => {
    installCollectionSafety();
    attempts += 1;
    if (attempts >= 40 || (Object.values(collections).every(cache => window[cache.renderer]?.[RENDER_MARKER]) && window.performDelete?.[DELETE_MARKER])) {
      clearInterval(timer);
    }
  }, 100);

  window.MoorePrintStateBridge = {
    installScopedStateIsolation,
    installCollectionSafety,
    getFullCollection(type) {
      const cache = ensureCollection(type);
      return cache ? [...cache.fullArray] : [];
    }
  };
})();
