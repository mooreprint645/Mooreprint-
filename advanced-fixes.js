(function () {
  function protectSupabaseConfig() {
    const fallback = {
      url: 'https://uqikxpgvqnyylvsotecy.supabase.co',
      publishableKey: 'sb_publishable_t6go8xYeYuc-3SI-iEBeZg_CLIR65WD'
    };
    let current = { ...fallback, ...(window.MOOREPRINT_SUPABASE || {}) };
    try {
      Object.defineProperty(window, 'MOOREPRINT_SUPABASE', {
        configurable: true,
        enumerable: true,
        get() { return current; },
        set(value) {
          const incoming = value && typeof value === 'object' ? value : {};
          current = {
            url: incoming.url || current.url || fallback.url,
            publishableKey: incoming.publishableKey || current.publishableKey || fallback.publishableKey
          };
        }
      });
      window.MOOREPRINT_SUPABASE = fallback;
    } catch (error) {
      window.MOOREPRINT_SUPABASE = fallback;
    }
  }

  function installSupabaseAuthStabilityPatch() {
    if (window.__mooreprintSupabaseAuthPatchInstalled) return;

    function patchLibrary(library) {
      if (!library || typeof library.createClient !== 'function' || library.__mooreprintAuthPatched) return library;
      const originalCreateClient = library.createClient.bind(library);
      library.createClient = function (...args) {
        const supabaseClient = originalCreateClient(...args);
        const auth = supabaseClient?.auth;
        if (auth && typeof auth.onAuthStateChange === 'function' && !auth.__mooreprintAuthPatched) {
          const originalOnAuthStateChange = auth.onAuthStateChange.bind(auth);
          auth.onAuthStateChange = function (callback) {
            let lastKey = '';
            let lastAt = 0;
            return originalOnAuthStateChange((event, session) => {
              if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') return;
              const key = `${event}:${session?.user?.id || ''}`;
              const now = Date.now();
              if (key === lastKey && now - lastAt < 1500) return;
              lastKey = key;
              lastAt = now;
              callback(event, session);
            });
          };
          Object.defineProperty(auth, '__mooreprintAuthPatched', { value: true });
        }
        return supabaseClient;
      };
      Object.defineProperty(library, '__mooreprintAuthPatched', { value: true });
      return library;
    }

    let currentLibrary = window.supabase;
    try {
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: true,
        get() { return currentLibrary; },
        set(value) { currentLibrary = patchLibrary(value); }
      });
      if (currentLibrary) currentLibrary = patchLibrary(currentLibrary);
      window.__mooreprintSupabaseAuthPatchInstalled = true;
    } catch (error) {
      const timer = setInterval(() => {
        if (!window.supabase?.createClient) return;
        patchLibrary(window.supabase);
        clearInterval(timer);
      }, 25);
      setTimeout(() => clearInterval(timer), 10000);
      window.__mooreprintSupabaseAuthPatchInstalled = true;
    }
  }

  function throttleBackgroundChecks() {
    if (window.__mooreprintIntervalThrottleInstalled) return;
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = function (handler, delay, ...args) {
      const source = typeof handler === 'function' ? Function.prototype.toString.call(handler) : '';
      const isCloudMonitor = /connectWhenReady|connectIfAllowed|hasAccess\(\).*connect|hasCloudAccess\(\).*connect/.test(source);
      const nextDelay = isCloudMonitor && Number(delay) < 20000 ? 20000 : delay;
      return nativeSetInterval(handler, nextDelay, ...args);
    };
    window.__mooreprintIntervalThrottleInstalled = true;
  }

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function normalizeAdvancedRuntime() {
    state.activityLog = Array.isArray(state.activityLog) ? state.activityLog : [];
    state.wasteRecords = Array.isArray(state.wasteRecords) ? state.wasteRecords : [];
    state.supplierCatalog = Array.isArray(state.supplierCatalog) ? state.supplierCatalog : [];
    state.supplierPriceHistory = Array.isArray(state.supplierPriceHistory) ? state.supplierPriceHistory : [];
    state.monthlyOverheads = Array.isArray(state.monthlyOverheads) ? state.monthlyOverheads : [];
    state.monthlyOverheadSettings = Array.isArray(state.monthlyOverheadSettings) ? state.monthlyOverheadSettings : [];
    state.goals = { sales: 30000, profit: 12000, orders: 80, ...(state.goals || {}) };
    state.business = {
      whatsapp: '', bank: '', clabe: '', depositPercent: 50, quoteValidity: 15,
      pricingMonth: currentMonthKey(), selectedBranchId: 'all',
      policies: 'El trabajo comienza al recibir el anticipo y la aprobación del diseño.',
      ...(state.business || {})
    };
    state.products = Array.isArray(state.products) ? state.products.map(product => ({
      autoPrice: false,
      targetMarginPercent: 40,
      priceRounding: 1,
      productionMinutes: 0,
      ...product
    })) : [];
    state.orders = Array.isArray(state.orders) ? state.orders.map(order => ({
      branchId: '', assignedTo: '', createdBy: '', updatedBy: '',
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
    script.async = false;
    document.head.appendChild(script);
  }

  function loadUsabilityLayer() {
    preventDuplicateOnboardingRenders();
    loadStyle('access-control.css');
    loadStyle('supplier-catalog.css');
    loadStyle('monthly-overhead.css');
    loadStyle('branch-access.css');
    loadStyle('usability.css');
    loadStyle('mobile-fixes.css');
    loadScript('supplier-catalog.js');
    loadScript('monthly-overhead.js');
    loadScript('branch-access.js');
    loadScript('usability.js');
    loadScript('mobile-fixes.js');
    loadScript('catalog-cloud.js');
    loadScript('overhead-cloud.js');
  }

  protectSupabaseConfig();
  installSupabaseAuthStabilityPatch();
  throttleBackgroundChecks();
  normalizeAdvancedRuntime();

  const previousRenderAll = renderAll;
  renderAll = function () {
    normalizeAdvancedRuntime();
    return previousRenderAll();
  };

  loadUsabilityLayer();
  window.MoorePrintNormalizeAdvanced = normalizeAdvancedRuntime;
})();
