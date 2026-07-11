(function () {
  let hookInstalled = false;

  function secureUpsert(client, table, rows, originalUpsert, options) {
    if (table === 'team_customers') {
      return client.rpc('sync_team_customers', { p_rows: Array.isArray(rows) ? rows : [] });
    }
    if (table === 'team_quotes') {
      return client.rpc('sync_team_quotes', { p_rows: Array.isArray(rows) ? rows : [] });
    }
    return originalUpsert(rows, options);
  }

  function patchBuilder(client, table, builder) {
    if (!builder || builder.__mpGranularSyncBuilderPatched || typeof builder.upsert !== 'function') return builder;
    if (!['team_customers', 'team_quotes'].includes(table)) return builder;

    const originalUpsert = builder.upsert.bind(builder);
    builder.upsert = function (rows, options) {
      return secureUpsert(client, table, rows, originalUpsert, options);
    };

    try {
      Object.defineProperty(builder, '__mpGranularSyncBuilderPatched', { value: true, configurable: true });
    } catch (error) {
      builder.__mpGranularSyncBuilderPatched = true;
    }
    return builder;
  }

  function patchClient(client) {
    if (!client || client.__mpGranularSyncPatched || typeof client.from !== 'function') return client;

    const originalFrom = client.from.bind(client);
    client.from = function (table) {
      return patchBuilder(client, table, originalFrom(table));
    };

    try {
      Object.defineProperty(client, '__mpGranularSyncPatched', { value: true, configurable: true });
    } catch (error) {
      client.__mpGranularSyncPatched = true;
    }
    return client;
  }

  function patchLibrary(library) {
    if (!library || library.__mpGranularSyncLibraryPatched || typeof library.createClient !== 'function') return library;

    const originalCreateClient = library.createClient.bind(library);
    library.createClient = function (...args) {
      return patchClient(originalCreateClient(...args));
    };

    try {
      Object.defineProperty(library, '__mpGranularSyncLibraryPatched', { value: true, configurable: true });
    } catch (error) {
      library.__mpGranularSyncLibraryPatched = true;
    }
    return library;
  }

  function installSupabaseHook() {
    if (hookInstalled) return;
    hookInstalled = true;

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
          const current = descriptor?.get ? descriptor.get.call(window) : fallbackValue;
          patchLibrary(current);
        }
      });
      if (fallbackValue) patchLibrary(fallbackValue);
    } catch (error) {
      console.warn('No fue posible activar la sincronización granular.', error);
    }

    const timer = setInterval(() => {
      if (window.supabase?.createClient) patchLibrary(window.supabase);
      const cloudClient = window.MoorePrintCloud?.getClient?.();
      if (cloudClient) patchClient(cloudClient);
    }, 100);
    setTimeout(() => clearInterval(timer), 20000);
  }

  installSupabaseHook();

  window.MoorePrintGranularSync = {
    patchClient,
    patchLibrary,
    install: installSupabaseHook
  };
})();
