(function () {
  const PAGE_SIZE = 50;
  const TARGET_TABLES = new Set(['branch_orders', 'branch_order_financials']);
  let installed = false;

  function patchBuilder(builder, table) {
    if (!builder || builder.__mpStartupLimitPatched || !TARGET_TABLES.has(table) || typeof builder.select !== 'function') return builder;
    const originalSelect = builder.select.bind(builder);
    builder.select = function (...args) {
      const selected = originalSelect(...args);
      if (!selected || typeof selected.range !== 'function') return selected;
      try { Object.defineProperty(selected, '__mpStartupLimitPatched', { value: true, configurable: true }); }
      catch (error) { selected.__mpStartupLimitPatched = true; }
      return selected.range(0, PAGE_SIZE - 1);
    };
    try { Object.defineProperty(builder, '__mpStartupLimitPatched', { value: true, configurable: true }); }
    catch (error) { builder.__mpStartupLimitPatched = true; }
    return builder;
  }

  function patchClient(client) {
    if (!client || client.__mpStartupLimitClientPatched || typeof client.from !== 'function') return client;
    const originalFrom = client.from.bind(client);
    client.from = function (table) {
      return patchBuilder(originalFrom(table), table);
    };
    try { Object.defineProperty(client, '__mpStartupLimitClientPatched', { value: true, configurable: true }); }
    catch (error) { client.__mpStartupLimitClientPatched = true; }
    return client;
  }

  function patchLibrary(library) {
    if (!library || library.__mpStartupLimitLibraryPatched || typeof library.createClient !== 'function') return library;
    const originalCreateClient = library.createClient.bind(library);
    library.createClient = function (...args) {
      return patchClient(originalCreateClient(...args));
    };
    try { Object.defineProperty(library, '__mpStartupLimitLibraryPatched', { value: true, configurable: true }); }
    catch (error) { library.__mpStartupLimitLibraryPatched = true; }
    return library;
  }

  function install() {
    if (installed) return;
    installed = true;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (descriptor?.configurable === false) {
      if (window.supabase) patchLibrary(window.supabase);
      return;
    }
    try {
      let fallbackValue = descriptor?.get ? descriptor.get.call(window) : window.supabase;
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() {
          const value = descriptor?.get ? descriptor.get.call(window) : fallbackValue;
          return patchLibrary(value);
        },
        set(value) {
          if (descriptor?.set) descriptor.set.call(window, value);
          else fallbackValue = value;
          patchLibrary(descriptor?.get ? descriptor.get.call(window) : fallbackValue);
        }
      });
      if (fallbackValue) patchLibrary(fallbackValue);
    } catch (error) {
      console.warn('No fue posible limitar la carga inicial de pedidos.', error);
    }
    const timer = setInterval(() => {
      if (window.supabase?.createClient) patchLibrary(window.supabase);
      const cloudClient = window.MoorePrintCloud?.getClient?.();
      if (cloudClient) patchClient(cloudClient);
    }, 100);
    setTimeout(() => clearInterval(timer), 20000);
  }

  install();
  window.MoorePrintStartupLimit = { install, patchClient, patchLibrary };
})();
