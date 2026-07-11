(function () {
  let client = null;
  let currentUser = null;
  let syncTimer = null;
  let saveHooked = false;

  const config = () => window.MOOREPRINT_SUPABASE || {};
  const isConfigured = () => Boolean(config().url && config().publishableKey && window.supabase?.createClient);

  function injectCloudPanels() {
    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#supabasePanel')) {
      settingsGrid.insertAdjacentHTML('beforeend', `
        <article class="panel" id="supabasePanel">
          <div class="panel-header"><div><h2>Supabase y acceso</h2><p>Sincroniza las ventas entre dispositivos.</p></div></div>
          <div id="supabaseNotConfigured" class="info-box">
            <strong>Conexión pendiente</strong>
            <p>Completa <code>supabase-config.js</code> con la URL del proyecto y la clave pública.</p>
          </div>
          <form id="supabaseLoginForm" class="form-grid" hidden>
            <label class="full">Correo<input type="email" name="email" autocomplete="email" required></label>
            <label class="full">Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
            <button class="button primary" type="submit">Iniciar sesión</button>
          </form>
          <div id="supabaseSession" hidden>
            <div class="info-box"><strong id="supabaseUserEmail"></strong><p>Las ventas se sincronizan automáticamente.</p></div>
            <div class="stack-actions">
              <button class="button primary" id="syncSupabaseNow" type="button">Sincronizar ahora</button>
              <button class="button secondary" id="supabaseSignOut" type="button">Cerrar sesión</button>
            </div>
          </div>
          <p id="supabaseStatus" style="margin-top:12px"></p>
        </article>`);
    }

    const reports = document.querySelector('#reports');
    if (reports && !document.querySelector('#cloudSalesReport')) {
      reports.insertAdjacentHTML('beforeend', `
        <article class="panel" id="cloudSalesReport">
          <div class="panel-header"><div><h2>Ventas guardadas en Supabase</h2><p>Agrupadas por día, semana, mes o año.</p></div></div>
          <div class="report-controls" style="margin-bottom:16px">
            <div><label>Periodo</label><select id="cloudSalesPeriod"><option value="day">Día</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="year">Año</option></select></div>
            <button class="button primary" id="refreshCloudSales" type="button">Consultar nube</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Pedidos</th><th>Ventas</th><th>Costos</th><th>Ganancia</th><th>Pagado</th><th>Saldo</th></tr></thead><tbody id="cloudSalesTable"><tr><td colspan="7">Inicia sesión para consultar Supabase.</td></tr></tbody></table></div>
        </article>`);
    }
  }

  function setStatus(message, type = '') {
    const target = document.querySelector('#supabaseStatus');
    if (!target) return;
    target.textContent = message;
    target.className = type === 'error' ? 'money-negative' : type === 'ok' ? 'money-positive' : '';
  }

  function updateSessionUI() {
    const configured = isConfigured();
    const notConfigured = document.querySelector('#supabaseNotConfigured');
    const loginForm = document.querySelector('#supabaseLoginForm');
    const sessionBox = document.querySelector('#supabaseSession');
    if (notConfigured) notConfigured.hidden = configured;
    if (loginForm) loginForm.hidden = !configured || Boolean(currentUser);
    if (sessionBox) sessionBox.hidden = !configured || !currentUser;
    const email = document.querySelector('#supabaseUserEmail');
    if (email) email.textContent = currentUser?.email || '';
    if (!configured) setStatus('Falta configurar la conexión.');
    else if (!currentUser) setStatus('Conexión lista. Inicia sesión.');
    else setStatus('Conectado y listo para sincronizar.', 'ok');
  }

  function hookLocalSaves() {
    if (saveHooked || typeof saveState !== 'function') return;
    const localSaveState = saveState;
    saveState = function (...args) {
      const result = localSaveState(...args);
      if (currentUser) scheduleSync(state);
      return result;
    };
    saveHooked = true;
  }

  async function init() {
    injectCloudPanels();
    hookLocalSaves();
    if (!isConfigured()) { updateSessionUI(); bindEvents(); return false; }
    client = window.supabase.createClient(config().url, config().publishableKey);
    const { data } = await client.auth.getSession();
    currentUser = data.session?.user || null;
    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateSessionUI();
      if (currentUser) scheduleSync(state, 250);
    });
    bindEvents();
    updateSessionUI();
    if (currentUser) scheduleSync(state, 250);
    return true;
  }

  function bindEvents() {
    const loginForm = document.querySelector('#supabaseLoginForm');
    if (loginForm && !loginForm.dataset.bound) {
      loginForm.dataset.bound = 'true';
      loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!client) return;
        setStatus('Iniciando sesión...');
        const form = new FormData(loginForm);
        const { data, error } = await client.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
        if (error) { setStatus(error.message, 'error'); return; }
        currentUser = data.user;
        loginForm.reset();
        updateSessionUI();
        await syncSales(state);
      });
    }

    const signOut = document.querySelector('#supabaseSignOut');
    if (signOut && !signOut.dataset.bound) {
      signOut.dataset.bound = 'true';
      signOut.addEventListener('click', async () => { if (client) await client.auth.signOut(); currentUser = null; updateSessionUI(); });
    }

    const syncButton = document.querySelector('#syncSupabaseNow');
    if (syncButton && !syncButton.dataset.bound) {
      syncButton.dataset.bound = 'true';
      syncButton.addEventListener('click', () => syncSales(state));
    }

    const refreshButton = document.querySelector('#refreshCloudSales');
    if (refreshButton && !refreshButton.dataset.bound) {
      refreshButton.dataset.bound = 'true';
      refreshButton.addEventListener('click', refreshSummary);
    }
  }

  function saleRows(appState) {
    if (!currentUser) return [];
    return (appState.orders || []).map(order => {
      const totals = documentTotals(order);
      return {
        user_id: currentUser.id,
        order_id: order.id,
        folio: order.folio || '',
        customer_name: order.customer || entityName(appState.customers || [], order.customerId, ''),
        sold_at: order.orderDate || todayISO(),
        status: order.status || 'pendiente',
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        delivery_charge: num(order.deliveryCharge),
        total: totals.total,
        production_cost: totals.costs,
        profit: totals.profit,
        paid: totals.paid,
        balance: totals.balance,
        updated_at: new Date().toISOString()
      };
    });
  }

  async function syncSales(appState) {
    if (!client || !currentUser) { setStatus('Inicia sesión para sincronizar.', 'error'); return false; }
    const rows = saleRows(appState);
    setStatus('Sincronizando ventas...');

    const { data: remoteRows, error: readError } = await client.from('sales').select('order_id');
    if (readError) { setStatus(`Error: ${readError.message}`, 'error'); return false; }
    const localIds = new Set(rows.map(row => row.order_id));
    const staleIds = (remoteRows || []).map(row => row.order_id).filter(id => !localIds.has(id));
    if (staleIds.length) {
      const { error: deleteError } = await client.from('sales').delete().in('order_id', staleIds);
      if (deleteError) { setStatus(`Error: ${deleteError.message}`, 'error'); return false; }
    }

    if (!rows.length) { setStatus('La nube quedó sin ventas registradas.', 'ok'); await refreshSummary(); return true; }
    const { error } = await client.from('sales').upsert(rows, { onConflict: 'user_id,order_id' });
    if (error) { setStatus(`Error: ${error.message}`, 'error'); return false; }
    setStatus(`${rows.length} venta${rows.length === 1 ? '' : 's'} sincronizada${rows.length === 1 ? '' : 's'}.`, 'ok');
    await refreshSummary();
    return true;
  }

  function scheduleSync(appState, delay = 1200) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncSales(appState), delay);
  }

  async function refreshSummary() {
    const table = document.querySelector('#cloudSalesTable');
    if (!table) return;
    if (!client || !currentUser) { table.innerHTML = '<tr><td colspan="7">Inicia sesión para consultar Supabase.</td></tr>'; return; }
    table.innerHTML = '<tr><td colspan="7">Consultando...</td></tr>';
    const period = document.querySelector('#cloudSalesPeriod')?.value || 'month';
    const from = document.querySelector('#reportFrom')?.value || null;
    const to = document.querySelector('#reportTo')?.value || null;
    const { data, error } = await client.rpc('sales_summary', { p_period: period, p_from: from || null, p_to: to || null });
    if (error) { table.innerHTML = `<tr><td colspan="7" class="money-negative">${String(error.message).replace(/[<>]/g, '')}</td></tr>`; return; }
    table.innerHTML = data?.length ? data.map(row => `<tr><td>${formatDate(row.period_start)}</td><td>${row.orders_count}</td><td>${money(row.sales_total)}</td><td>${money(row.production_cost)}</td><td class="${num(row.profit_total) < 0 ? 'money-negative' : 'money-positive'}">${money(row.profit_total)}</td><td>${money(row.paid_total)}</td><td>${money(row.balance_total)}</td></tr>`).join('') : '<tr><td colspan="7">No hay ventas en el periodo.</td></tr>';
  }

  window.MoorePrintCloud = { init, syncSales, scheduleSync, refreshSummary, isConfigured };
})();
