(function () {
  let client = null;
  let user = null;
  let hydrated = false;
  let syncing = false;
  let saveHooked = false;
  let syncTimer = null;
  let accessTimer = null;

  function config() { return window.MOOREPRINT_SUPABASE || {}; }
  function hasAccess() { return Boolean(window.MoorePrintCloud?.hasAccess?.()); }
  function canConnect() { return Boolean(window.supabase?.createClient && config().url && config().publishableKey); }

  function statusNode() {
    return document.querySelector('#monthlyCostCloudStatus');
  }

  function setStatus(message, type = '') {
    const node = statusNode();
    if (!node) return;
    node.className = `monthly-cost-cloud${type ? ` ${type}` : ''}`;
    const text = node.querySelector('span:last-child');
    if (text) text.textContent = message;
  }

  function timestamp(row) {
    const value = row?.updatedAt || row?.createdAt || '';
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function mergeBy(rowsA, rowsB, key) {
    const result = new Map();
    (rowsA || []).forEach(row => result.set(row[key], row));
    (rowsB || []).forEach(row => {
      const current = result.get(row[key]);
      if (!current || timestamp(row) >= timestamp(current)) result.set(row[key], row);
    });
    return [...result.values()].filter(row => row[key]);
  }

  function overheadToCloud(row) {
    return {
      user_id: user.id,
      overhead_id: row.id,
      month: row.month,
      category: row.category || 'otro',
      name: row.name || 'Costo fijo',
      quantity: num(row.quantity),
      unit_amount: num(row.unitAmount),
      active: row.active !== false,
      notes: row.notes || '',
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: row.updatedAt || new Date().toISOString()
    };
  }

  function overheadFromCloud(row) {
    return {
      id: row.overhead_id,
      month: row.month,
      category: row.category || 'otro',
      name: row.name || 'Costo fijo',
      quantity: num(row.quantity),
      unitAmount: num(row.unit_amount),
      active: row.active !== false,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function settingToCloud(row) {
    return {
      user_id: user.id,
      month: row.month,
      productive_hours: num(row.productiveHours) || 160,
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: row.updatedAt || new Date().toISOString()
    };
  }

  function settingFromCloud(row) {
    return {
      month: row.month,
      productiveHours: num(row.productive_hours) || 160,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async function readTables() {
    const [costs, settings] = await Promise.all([
      client.from('monthly_overheads').select('*'),
      client.from('monthly_overhead_settings').select('*')
    ]);
    if (costs.error) throw costs.error;
    if (settings.error) throw settings.error;
    return { costs: costs.data || [], settings: settings.data || [] };
  }

  async function hydrate() {
    if (!client || !user || hydrated) return;
    setStatus('Descargando costos mensuales…');
    try {
      const remote = await readTables();
      state.monthlyOverheads = mergeBy(state.monthlyOverheads, remote.costs.map(overheadFromCloud), 'id');
      state.monthlyOverheadSettings = mergeBy(state.monthlyOverheadSettings, remote.settings.map(settingFromCloud), 'month');
      window.MoorePrintMonthlyCosts?.normalize?.();
      window.MoorePrintSupplierCatalog?.refreshAutomaticProductPrices?.();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      hydrated = true;
      await syncAll();
    } catch (error) {
      hydrated = false;
      const missing = /relation .* does not exist|schema cache|Could not find the table|production_minutes/i.test(error.message || '');
      setStatus(missing ? 'Falta ejecutar supabase/monthly-costs.sql.' : `Error: ${error.message}`, 'error');
    }
  }

  async function syncRows(table, idColumn, rows, converter) {
    const cloudRows = (rows || []).map(converter);
    const { data: existing, error: readError } = await client.from(table).select(idColumn);
    if (readError) throw readError;
    const localIds = new Set(cloudRows.map(row => row[idColumn]));
    const stale = (existing || []).map(row => row[idColumn]).filter(id => !localIds.has(id));
    if (stale.length) {
      const { error } = await client.from(table).delete().in(idColumn, stale);
      if (error) throw error;
    }
    if (cloudRows.length) {
      const { error } = await client.from(table).upsert(cloudRows, { onConflict: `user_id,${idColumn}` });
      if (error) throw error;
    }
  }

  async function syncAll() {
    if (!client || !user || !hydrated || syncing || !hasAccess()) return false;
    syncing = true;
    setStatus('Sincronizando costos mensuales…');
    try {
      await Promise.all([
        syncRows('monthly_overheads', 'overhead_id', state.monthlyOverheads, overheadToCloud),
        syncRows('monthly_overhead_settings', 'month', state.monthlyOverheadSettings, settingToCloud)
      ]);
      setStatus('Costos mensuales sincronizados.', 'synced');
      return true;
    } catch (error) {
      const missing = /relation .* does not exist|schema cache|Could not find the table/i.test(error.message || '');
      setStatus(missing ? 'Falta ejecutar supabase/monthly-costs.sql.' : `No se pudo sincronizar: ${error.message}`, 'error');
      return false;
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(delay = 1200) {
    if (!hydrated || !hasAccess()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncAll, delay);
  }

  function hookSaves() {
    if (saveHooked || typeof saveState !== 'function') return;
    const base = saveState;
    saveState = function (...args) {
      const result = base(...args);
      scheduleSync();
      return result;
    };
    saveHooked = true;
  }

  async function connect() {
    if (!canConnect() || !hasAccess()) return;
    if (!client) client = window.supabase.createClient(config().url, config().publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user) return;
    if (user?.id !== data.session.user.id) {
      user = data.session.user;
      hydrated = false;
    }
    await hydrate();
  }

  function monitor() {
    clearInterval(accessTimer);
    accessTimer = setInterval(() => {
      if (hasAccess()) connect();
      else {
        user = null;
        hydrated = false;
        setStatus('Inicia sesión para sincronizar costos mensuales.');
      }
    }, 1600);
    connect();
  }

  function init() {
    hookSaves();
    monitor();
  }

  window.MoorePrintOverheadCloud = { init, syncAll, hydrate, isReady: () => hydrated };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
