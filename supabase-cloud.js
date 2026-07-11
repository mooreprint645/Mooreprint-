(function () {
  const CONFIG_KEY = 'mooreprint-supabase-config';
  let client = null;
  let currentUser = null;
  let accessGranted = false;
  let checkingAccess = false;
  let syncTimer = null;
  let saveHooked = false;

  function storedConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
    catch (error) { return {}; }
  }

  const config = () => ({ ...(window.MOOREPRINT_SUPABASE || {}), ...storedConfig() });
  const isConfigured = () => Boolean(config().url && config().publishableKey && window.supabase?.createClient);

  function authForm(id) {
    return `<form id="${id}" class="form-grid" data-supabase-login>
      <label class="full">Correo registrado<input type="email" name="email" autocomplete="email" required></label>
      <label class="full">Contraseña<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
      <button class="button primary" type="submit">Entrar a MoorePrint</button>
      <button class="text-button" type="button" data-supabase-reset>Olvidé mi contraseña</button>
    </form>`;
  }

  function injectCloudPanels() {
    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#supabasePanel')) {
      const active = config();
      settingsGrid.insertAdjacentHTML('beforeend', `
        <article class="panel" id="supabasePanel">
          <div class="panel-header"><div><h2>Supabase y acceso</h2><p>Solo los correos autorizados pueden abrir MoorePrint.</p></div></div>
          <form id="supabaseConfigForm" class="config-fields">
            <label>URL del proyecto<input name="url" type="url" value="${String(active.url || '').replace(/["<>]/g,'')}" placeholder="https://proyecto.supabase.co" required></label>
            <label>Clave pública / publishable key<input name="publishableKey" type="password" value="${String(active.publishableKey || '').replace(/["<>]/g,'')}" required></label>
            <div class="inline-actions"><button class="button primary" type="submit">Guardar conexión</button><button class="button secondary" id="clearSupabaseConfig" type="button">Desconectar proyecto</button></div>
            <small>La URL y la clave pública pueden estar en el navegador. Nunca uses la clave service_role.</small>
          </form>
          <div id="supabaseSession" hidden>
            <div class="info-box"><strong id="supabaseUserEmail"></strong><p>Correo autorizado. Las ventas se sincronizan automáticamente.</p></div>
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
      document.body.insertAdjacentHTML('beforeend', `
        <div class="auth-gate" id="supabaseAuthGate">
          <div class="auth-card">
            <div class="auth-brand"><strong>MOORE<b>PRINT</b></strong><p>Acceso privado</p></div>
            <div class="auth-state auth-loading" id="supabaseGateChecking">
              <div class="auth-spinner"></div><strong>Verificando sesión segura…</strong>
            </div>
            <div class="auth-state" id="supabaseGateMissing" hidden>
              <h2>Falta conectar Supabase</h2>
              <div class="auth-config-warning">La aplicación está bloqueada. Coloca la URL y la clave pública en <strong>supabase-config.js</strong> para activar el inicio de sesión.</div>
              <p>Después ejecuta <strong>supabase/schema.sql</strong> y autoriza tu correo.</p>
            </div>
            <div class="auth-state" id="supabaseGateLogin" hidden>
              <h2>Iniciar sesión</h2>
              <p>Entra con un correo previamente creado y autorizado en Supabase.</p>
              ${authForm('supabaseGateLoginForm')}
              <div class="auth-security-note"><span>🔒</span><span>No existe registro público. Las cuentas se crean únicamente desde el panel de Supabase.</span></div>
            </div>
            <p id="supabaseGateStatus"></p>
          </div>
        </div>`);
    }

    const topActions = document.querySelector('.topbar-actions');
    if (topActions && !document.querySelector('#cloudAccountButton')) topActions.insertAdjacentHTML('afterbegin','<button class="button secondary" id="cloudAccountButton" type="button">Cuenta</button>');
    document.documentElement.classList.add('mooreprint-auth-ui-ready');
  }

  function setStatus(message, type = '') {
    ['#supabaseStatus','#supabaseGateStatus'].forEach(selector => {
      const target = document.querySelector(selector);
      if (!target) return;
      target.textContent = message || '';
      target.className = type === 'error' ? 'money-negative' : type === 'ok' ? 'money-positive' : '';
    });
  }

  function setAccess(granted) {
    accessGranted = Boolean(granted);
    document.documentElement.classList.toggle('mooreprint-access-granted', accessGranted);
    const shell = document.querySelector('.app-shell');
    if (shell) {
      shell.inert = !accessGranted;
      shell.setAttribute('aria-hidden', String(!accessGranted));
    }
  }

  function updateSessionUI() {
    const configured = isConfigured();
    const gate = document.querySelector('#supabaseAuthGate');
    const checking = document.querySelector('#supabaseGateChecking');
    const missing = document.querySelector('#supabaseGateMissing');
    const login = document.querySelector('#supabaseGateLogin');
    const sessionBox = document.querySelector('#supabaseSession');

    if (gate) gate.hidden = accessGranted;
    if (checking) checking.hidden = !checkingAccess;
    if (missing) missing.hidden = checkingAccess || configured;
    if (login) login.hidden = checkingAccess || !configured || accessGranted;
    if (sessionBox) sessionBox.hidden = !accessGranted;

    const email = document.querySelector('#supabaseUserEmail');
    if (email) email.textContent = currentUser?.email || '';
    const account = document.querySelector('#cloudAccountButton');
    if (account) account.textContent = accessGranted ? currentUser?.email || 'Cuenta' : 'Iniciar sesión';

    if (!checkingAccess && !configured) setStatus('MoorePrint permanecerá bloqueado hasta conectar Supabase.', 'error');
    else if (!checkingAccess && configured && !accessGranted && !currentUser) setStatus('Escribe tu correo autorizado y contraseña.');
    else if (accessGranted) setStatus('Acceso autorizado y sincronización activa.', 'ok');
  }

  function hookLocalSaves() {
    if (saveHooked || typeof saveState !== 'function') return;
    const localSaveState = saveState;
    saveState = function (...args) {
      const result = localSaveState(...args);
      if (accessGranted) scheduleSync(state);
      return result;
    };
    saveHooked = true;
  }

  function createClient() {
    if (!isConfigured()) return false;
    client = window.supabase.createClient(config().url, config().publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return true;
  }

  async function denyAccess(message) {
    currentUser = null;
    setAccess(false);
    checkingAccess = false;
    if (client) await client.auth.signOut().catch(() => {});
    updateSessionUI();
    setStatus(message || 'Este correo no está autorizado para entrar a MoorePrint.', 'error');
    return false;
  }

  async function verifyAccess(user, options = {}) {
    if (!user) {
      currentUser = null;
      checkingAccess = false;
      setAccess(false);
      updateSessionUI();
      return false;
    }

    checkingAccess = true;
    currentUser = user;
    setAccess(false);
    updateSessionUI();
    setStatus('Comprobando que el correo esté autorizado…');

    const { data, error } = await client.rpc('is_mooreprint_user');
    if (error) {
      const schemaMissing = /is_mooreprint_user|function|schema cache/i.test(error.message || '');
      return denyAccess(schemaMissing ? 'Falta ejecutar supabase/schema.sql en el SQL Editor.' : `No se pudo validar el acceso: ${error.message}`);
    }
    if (data !== true) return denyAccess('Este correo existe, pero no está autorizado para entrar a MoorePrint.');

    checkingAccess = false;
    currentUser = user;
    setAccess(true);
    updateSessionUI();
    if (options.sync !== false) scheduleSync(state, 300);
    return true;
  }

  async function init() {
    setAccess(false);
    injectCloudPanels();
    hookLocalSaves();
    bindEvents();

    if (!createClient()) {
      checkingAccess = false;
      updateSessionUI();
      return false;
    }

    checkingAccess = true;
    updateSessionUI();
    const { data, error } = await client.auth.getSession();
    if (error) {
      checkingAccess = false;
      setStatus(error.message, 'error');
      updateSessionUI();
      return false;
    }

    await verifyAccess(data?.session?.user || null);

    client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (session?.user) verifyAccess(session.user);
        else {
          currentUser = null;
          checkingAccess = false;
          setAccess(false);
          updateSessionUI();
        }
      }, 0);
    });
    return accessGranted;
  }

  async function signIn(form) {
    if (!client) return setStatus('Supabase todavía no está configurado.', 'error');
    const values = new FormData(form);
    checkingAccess = true;
    updateSessionUI();
    setStatus('Iniciando sesión…');
    const { data, error } = await client.auth.signInWithPassword({ email: String(values.get('email') || '').trim(), password: values.get('password') });
    if (error) {
      checkingAccess = false;
      updateSessionUI();
      return setStatus('Correo o contraseña incorrectos.', 'error');
    }
    const allowed = await verifyAccess(data.user);
    if (allowed) form.reset();
  }

  async function resetPassword(form) {
    if (!client) return setStatus('Supabase todavía no está configurado.', 'error');
    const email = String(new FormData(form).get('email') || '').trim();
    if (!email) return setStatus('Escribe el correo registrado.', 'error');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    if (error) return setStatus(error.message, 'error');
    setStatus('Si el correo está registrado, recibirá un enlace de recuperación.', 'ok');
  }

  function bindEvents() {
    document.addEventListener('submit', event => {
      if (event.target.id === 'supabaseConfigForm') {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.target));
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: values.url.trim().replace(/\/$/,''), publishableKey: values.publishableKey.trim() }));
        location.reload();
      }
      if (event.target.matches('[data-supabase-login]')) {
        event.preventDefault();
        signIn(event.target);
      }
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.supabaseReset !== undefined) resetPassword(target.closest('form'));
      if (target.id === 'clearSupabaseConfig' && confirm('¿Desconectar este proyecto? La página quedará bloqueada.')) {
        client?.auth.signOut().finally(() => {
          localStorage.removeItem(CONFIG_KEY);
          location.reload();
        });
      }
      if (target.id === 'supabaseSignOut') client?.auth.signOut();
      if (target.id === 'syncSupabaseNow') syncSales(state);
      if (target.id === 'refreshCloudSales') refreshSummary();
      if (target.id === 'cloudAccountButton' && accessGranted) navigate('settings');
    });
  }

  function saleRows(appState) {
    if (!accessGranted || !currentUser) return [];
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
    if (!client || !accessGranted || !currentUser) {
      setStatus('Acceso no autorizado.', 'error');
      return false;
    }
    const rows = saleRows(appState);
    setStatus('Sincronizando ventas…');
    const { data: remoteRows, error: readError } = await client.from('sales').select('order_id');
    if (readError) { setStatus(`Error: ${readError.message}`, 'error'); return false; }

    const localIds = new Set(rows.map(row => row.order_id));
    const staleIds = (remoteRows || []).map(row => row.order_id).filter(id => !localIds.has(id));
    if (staleIds.length) {
      const { error: deleteError } = await client.from('sales').delete().in('order_id', staleIds);
      if (deleteError) { setStatus(`Error: ${deleteError.message}`, 'error'); return false; }
    }

    if (!rows.length) {
      setStatus('No hay ventas locales para sincronizar.', 'ok');
      await refreshSummary();
      return true;
    }
    const { error } = await client.from('sales').upsert(rows, { onConflict: 'user_id,order_id' });
    if (error) { setStatus(`Error: ${error.message}`, 'error'); return false; }
    setStatus(`${rows.length} venta${rows.length === 1 ? '' : 's'} sincronizada${rows.length === 1 ? '' : 's'}.`, 'ok');
    await refreshSummary();
    return true;
  }

  function scheduleSync(appState, delay = 1200) {
    if (!accessGranted) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncSales(appState), delay);
  }

  async function refreshSummary() {
    const table = document.querySelector('#cloudSalesTable');
    if (!table) return;
    if (!client || !accessGranted || !currentUser) {
      table.innerHTML = '<tr><td colspan="7">Acceso no autorizado.</td></tr>';
      return;
    }
    table.innerHTML = '<tr><td colspan="7">Consultando…</td></tr>';
    const period = document.querySelector('#cloudSalesPeriod')?.value || 'month';
    const from = document.querySelector('#reportFrom')?.value || null;
    const to = document.querySelector('#reportTo')?.value || null;
    const { data, error } = await client.rpc('sales_summary', { p_period: period, p_from: from || null, p_to: to || null });
    if (error) {
      table.innerHTML = `<tr><td colspan="7" class="money-negative">${String(error.message).replace(/[<>]/g, '')}</td></tr>`;
      return;
    }
    table.innerHTML = data?.length ? data.map(row => `<tr><td>${formatDate(row.period_start)}</td><td>${row.orders_count}</td><td>${money(row.sales_total)}</td><td>${money(row.production_cost)}</td><td class="${num(row.profit_total) < 0 ? 'money-negative' : 'money-positive'}">${money(row.profit_total)}</td><td>${money(row.paid_total)}</td><td>${money(row.balance_total)}</td></tr>`).join('') : '<tr><td colspan="7">No hay ventas en el periodo.</td></tr>';
  }

  window.MoorePrintCloud = {
    init,
    syncSales,
    scheduleSync,
    refreshSummary,
    isConfigured,
    hasAccess: () => accessGranted
  };
})();
