(function () {
  const CONFIG_KEY = 'mooreprint-supabase-config';
  let client = null;
  let currentUser = null;
  let syncTimer = null;
  let saveHooked = false;

  function storedConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
    catch (error) { return {}; }
  }
  const config = () => ({ ...(window.MOOREPRINT_SUPABASE || {}), ...storedConfig() });
  const isConfigured = () => Boolean(config().url && config().publishableKey && window.supabase?.createClient);

  function authForm(id, compact = false) {
    return `<form id="${id}" class="form-grid" data-supabase-login><label class="full">Correo<input type="email" name="email" autocomplete="email" required></label><label class="full">Contraseña<input type="password" name="password" autocomplete="current-password" minlength="6" required></label><button class="button primary" type="submit">Iniciar sesión</button>${compact ? '' : '<button class="button secondary" type="button" data-supabase-signup>Crear cuenta</button><button class="text-button" type="button" data-supabase-reset>Recuperar contraseña</button>'}</form>`;
  }

  function injectCloudPanels() {
    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#supabasePanel')) {
      const active = config();
      settingsGrid.insertAdjacentHTML('beforeend', `
        <article class="panel" id="supabasePanel">
          <div class="panel-header"><div><h2>Supabase y acceso</h2><p>Protege el acceso y sincroniza ventas entre dispositivos.</p></div></div>
          <form id="supabaseConfigForm" class="config-fields">
            <label>URL del proyecto<input name="url" type="url" value="${String(active.url || '').replace(/["<>]/g,'')}" placeholder="https://proyecto.supabase.co" required></label>
            <label>Clave pública / publishable key<input name="publishableKey" type="password" value="${String(active.publishableKey || '').replace(/["<>]/g,'')}" required></label>
            <div class="inline-actions"><button class="button primary" type="submit">Guardar conexión</button><button class="button secondary" id="clearSupabaseConfig" type="button">Desconectar proyecto</button></div>
            <small>Usa solamente la clave pública. Nunca coloques la clave service_role.</small>
          </form>
          <div id="supabaseNotConfigured" class="info-box"><strong>Conexión pendiente</strong><p>Guarda la URL y la clave pública para activar el inicio de sesión.</p></div>
          <div id="supabaseLoginArea">${authForm('supabaseLoginForm')}</div>
          <div id="supabaseSession" hidden>
            <div class="info-box"><strong id="supabaseUserEmail"></strong><p>Las ventas se sincronizan automáticamente.</p></div>
            <div class="stack-actions"><button class="button primary" id="syncSupabaseNow" type="button">Sincronizar ahora</button><button class="button secondary" id="supabaseSignOut" type="button">Cerrar sesión</button></div>
          </div>
          <p id="supabaseStatus" style="margin-top:12px"></p>
        </article>`);
    }

    const reports = document.querySelector('#reports');
    if (reports && !document.querySelector('#cloudSalesReport')) {
      reports.insertAdjacentHTML('beforeend', `
        <article class="panel" id="cloudSalesReport">
          <div class="panel-header"><div><h2>Ventas guardadas en Supabase</h2><p>Agrupadas por día, semana, mes o año.</p></div></div>
          <div class="report-controls" style="margin-bottom:16px"><div><label>Periodo</label><select id="cloudSalesPeriod"><option value="day">Día</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="year">Año</option></select></div><button class="button primary" id="refreshCloudSales" type="button">Consultar nube</button></div>
          <div class="table-wrap"><table><thead><tr><th>Periodo</th><th>Pedidos</th><th>Ventas</th><th>Costos</th><th>Ganancia</th><th>Pagado</th><th>Saldo</th></tr></thead><tbody id="cloudSalesTable"><tr><td colspan="7">Inicia sesión para consultar Supabase.</td></tr></tbody></table></div>
        </article>`);
    }

    if (!document.querySelector('#supabaseAuthGate')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="auth-gate" id="supabaseAuthGate" hidden><div class="auth-card"><div class="auth-brand"><strong>MOORE<b>PRINT</b></strong><p>Acceso administrativo</p></div>${authForm('supabaseGateLogin')}<p id="supabaseGateStatus"></p><small>La página se desbloquea después de iniciar sesión.</small></div></div>`);
    }

    const topActions = document.querySelector('.topbar-actions');
    if (topActions && !document.querySelector('#cloudAccountButton')) topActions.insertAdjacentHTML('afterbegin','<button class="button secondary" id="cloudAccountButton" type="button">Cuenta</button>');
  }

  function setStatus(message, type = '') {
    ['#supabaseStatus','#supabaseGateStatus'].forEach(selector => {
      const target = document.querySelector(selector); if (!target) return;
      target.textContent = message;
      target.className = type === 'error' ? 'money-negative' : type === 'ok' ? 'money-positive' : '';
    });
  }

  function updateSessionUI() {
    const configured = isConfigured();
    const loginArea = document.querySelector('#supabaseLoginArea');
    const sessionBox = document.querySelector('#supabaseSession');
    const pending = document.querySelector('#supabaseNotConfigured');
    const gate = document.querySelector('#supabaseAuthGate');
    if (pending) pending.hidden = configured;
    if (loginArea) loginArea.hidden = !configured || Boolean(currentUser);
    if (sessionBox) sessionBox.hidden = !configured || !currentUser;
    if (gate) gate.hidden = !configured || Boolean(currentUser);
    const email = document.querySelector('#supabaseUserEmail'); if (email) email.textContent = currentUser?.email || '';
    const account = document.querySelector('#cloudAccountButton'); if (account) account.textContent = currentUser ? currentUser.email : configured ? 'Iniciar sesión' : 'Conectar Supabase';
    if (!configured) setStatus('Guarda los datos del proyecto para activar el acceso.');
    else if (!currentUser) setStatus('Conexión lista. Inicia sesión.');
    else setStatus('Conectado y sincronización automática activa.', 'ok');
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

  function createClient() {
    if (!isConfigured()) return false;
    client = window.supabase.createClient(config().url, config().publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return true;
  }

  async function init() {
    injectCloudPanels();
    hookLocalSaves();
    bindEvents();
    if (!createClient()) { updateSessionUI(); return false; }
    const { data, error } = await client.auth.getSession();
    if (error) setStatus(error.message, 'error');
    currentUser = data?.session?.user || null;
    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateSessionUI();
      if (currentUser) scheduleSync(state, 250);
    });
    updateSessionUI();
    if (currentUser) scheduleSync(state, 250);
    return true;
  }

  async function signIn(form) {
    if (!client) return setStatus('Primero guarda la conexión de Supabase.', 'error');
    const values = new FormData(form);
    setStatus('Iniciando sesión...');
    const { data, error } = await client.auth.signInWithPassword({ email: values.get('email'), password: values.get('password') });
    if (error) return setStatus(error.message, 'error');
    currentUser = data.user;
    form.reset();
    updateSessionUI();
    await syncSales(state);
  }

  async function signUp(form) {
    if (!client) return setStatus('Primero guarda la conexión de Supabase.', 'error');
    const values = new FormData(form);
    const email = values.get('email'); const password = values.get('password');
    if (!email || !password) return setStatus('Escribe correo y contraseña.', 'error');
    setStatus('Creando cuenta...');
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (error) return setStatus(error.message, 'error');
    currentUser = data.session?.user || null;
    updateSessionUI();
    setStatus(data.session ? 'Cuenta creada e inicio de sesión activo.' : 'Cuenta creada. Revisa el correo de confirmación.', 'ok');
  }

  async function resetPassword(form) {
    if (!client) return setStatus('Primero guarda la conexión de Supabase.', 'error');
    const email = new FormData(form).get('email');
    if (!email) return setStatus('Escribe tu correo.', 'error');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    if (error) return setStatus(error.message, 'error');
    setStatus('Se envió el enlace de recuperación.', 'ok');
  }

  function bindEvents() {
    document.addEventListener('submit', event => {
      if (event.target.id === 'supabaseConfigForm') {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.target));
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: values.url.trim().replace(/\/$/,''), publishableKey: values.publishableKey.trim() }));
        location.reload();
      }
      if (event.target.matches('[data-supabase-login]')) { event.preventDefault(); signIn(event.target); }
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('button'); if (!target) return;
      if (target.dataset.supabaseSignup !== undefined) signUp(target.closest('form'));
      if (target.dataset.supabaseReset !== undefined) resetPassword(target.closest('form'));
      if (target.id === 'clearSupabaseConfig') { if (confirm('¿Desconectar este proyecto de Supabase?')) { localStorage.removeItem(CONFIG_KEY); location.reload(); } }
      if (target.id === 'supabaseSignOut') client?.auth.signOut();
      if (target.id === 'syncSupabaseNow') syncSales(state);
      if (target.id === 'refreshCloudSales') refreshSummary();
      if (target.id === 'cloudAccountButton') { if (currentUser) navigate('settings'); else if (isConfigured()) document.querySelector('#supabaseAuthGate').hidden = false; else navigate('settings'); }
    });
  }

  function saleRows(appState) {
    if (!currentUser) return [];
    return (appState.orders || []).map(order => {
      const totals = documentTotals(order);
      return { user_id: currentUser.id, order_id: order.id, folio: order.folio || '', customer_name: order.customer || entityName(appState.customers || [], order.customerId, ''), sold_at: order.orderDate || todayISO(), status: order.status || 'pendiente', subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, delivery_charge: num(order.deliveryCharge), total: totals.total, production_cost: totals.costs, profit: totals.profit, paid: totals.paid, balance: totals.balance, updated_at: new Date().toISOString() };
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
