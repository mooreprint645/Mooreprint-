(function () {
  const ALERT_HISTORY_KEY = 'mooreprint-alert-history-v1';
  const DEFAULT_NOTIFICATION_SETTINGS = {
    browserEnabled: false,
    daysAhead: 2,
    orders: true,
    collections: true,
    inventory: true,
    expenses: true
  };
  const DEFAULT_CFDI_SETTINGS = {
    fiscalName: '',
    fiscalPostalCode: '',
    fiscalRegime: '',
    series: 'A',
    defaultCfdiUse: 'G03',
    defaultPaymentMethod: 'PUE',
    defaultPaymentForm: '03',
    defaultProductServiceKey: '',
    defaultUnitKey: '',
    defaultTaxObject: '02',
    pacName: ''
  };
  const HELP_TOPICS = [
    ['🧾', 'Registrar un pedido', 'pedido cliente anticipo trabajo entrega', 'orders', [
      'Abre Pedidos y pulsa Nuevo pedido.',
      'Selecciona al cliente, agrega conceptos, cantidades y precios.',
      'Define la entrega, el estado, el responsable y los datos del diseño.',
      'Guarda el pedido. El inventario se descuenta cuando entra en producción.'
    ]],
    ['💵', 'Registrar un cobro o pago', 'cobro pago anticipo saldo caja', 'cash', [
      'Abre el pedido, compra o gasto correspondiente.',
      'Pulsa el botón de pago y captura monto, fecha, método y referencia.',
      'Revisa la confirmación antes de guardar.',
      'El movimiento aparecerá automáticamente en Caja y pagos.'
    ]],
    ['💰', 'Realizar un corte de caja', 'corte caja contado esperado diferencia', 'cash', [
      'En Caja y pagos pulsa Corte de caja.',
      'Revisa únicamente las entradas y salidas en efectivo.',
      'Compara el efectivo esperado con el contado.',
      'Las transferencias, tarjetas y depósitos se revisan por separado.'
    ]],
    ['📦', 'Controlar inventario', 'inventario material compra ajuste existencia bajo', 'inventory', [
      'Registra cada material con existencia, unidad, mínimo y costo.',
      'Usa Compras para aumentar existencias y actualizar el costo promedio.',
      'Usa Ajustar existencia para mermas, conteos o correcciones.',
      'Los avisos mostrarán materiales agotados o con existencia baja.'
    ]],
    ['🔔', 'Activar avisos automáticos', 'aviso notificación entrega atraso cobro material gasto', 'notifications', [
      'Abre Avisos y pulsa Permitir notificaciones.',
      'Autoriza las notificaciones cuando el navegador lo solicite.',
      'Elige cuántos días antes deseas recibir recordatorios.',
      'Los avisos se revisan al abrir y mientras MoorePrint permanece activa.'
    ]],
    ['☁️', 'Trabajar sin conexión', 'sin conexión offline pendiente sincronizar internet', 'settings', [
      'Continúa trabajando aunque se interrumpa internet.',
      'Los cambios quedan pendientes en el dispositivo.',
      'Al recuperar conexión, MoorePrint intenta sincronizarlos.',
      'No cierres sesión ni borres los datos mientras existan cambios pendientes.'
    ]],
    ['🗄️', 'Crear respaldos', 'respaldo json archivos diseños comprobantes restaurar', 'settings', [
      'Descarga el respaldo JSON de datos administrativos.',
      'Descarga por separado el respaldo de archivos adjuntos.',
      'Guarda ambos archivos en una ubicación segura.',
      'Hazlo antes de cambiar de celular o borrar los datos del sitio.'
    ]],
    ['🧮', 'Preparar una factura CFDI', 'cfdi factura fiscal sat pac rfc timbrado', 'invoicing', [
      'Completa los datos fiscales del negocio en Configuración.',
      'Guarda los datos fiscales del cliente.',
      'Prepara el expediente del pedido y revisa las claves de cada concepto.',
      'Exporta el expediente para tu contador o PAC y registra el UUID después del timbrado.'
    ]],
    ['🛠️', 'Resolver un problema de sincronización', 'error sincronización reintentar conflicto integridad', 'settings', [
      'Revisa el indicador de conexión.',
      'Pulsa Reintentar cuando aparezca un error.',
      'En Configuración usa Probar integridad.',
      'Ante un conflicto, revisa qué usuario modificó primero el registro.'
    ]]
  ];

  let initialized = false;
  let latestAlerts = [];

  const html = value => typeof esc === 'function' ? esc(value) : String(value ?? '');
  const value = input => typeof num === 'function' ? num(input) : Number.parseFloat(input) || 0;
  const currency = input => typeof money === 'function'
    ? money(input)
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value(input));

  function normalize() {
    state.notificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(state.notificationSettings || {}) };
    state.cfdiRecords = Array.isArray(state.cfdiRecords) ? state.cfdiRecords : [];
    state.business = state.business || {};
    state.business.cfdi = { ...DEFAULT_CFDI_SETTINGS, ...(state.business.cfdi || {}) };
  }

  function isAdmin() {
    const branches = window.MoorePrintBranches;
    const profile = branches?.getProfile?.();
    return !profile || Boolean(branches?.isAdmin?.());
  }

  function navButton(section, icon, label) {
    return `<button class="nav-item" data-section="${section}"><span>${icon}</span> ${label}</button>`;
  }

  function injectInterface() {
    const settingsNav = document.querySelector('.nav-list [data-section="settings"]');
    if (settingsNav && !document.querySelector('[data-section="notifications"]')) {
      settingsNav.insertAdjacentHTML('beforebegin', navButton('notifications', '🔔', 'Avisos') + navButton('invoicing', '🧮', 'Facturación') + navButton('help', '❓', 'Ayuda'));
    }

    const topbar = document.querySelector('.topbar-actions');
    if (topbar && !document.querySelector('#notificationCenterButton')) {
      topbar.insertAdjacentHTML('afterbegin', '<button id="notificationCenterButton" class="button secondary notification-button" type="button" data-go="notifications" aria-label="Abrir avisos"><span aria-hidden="true">🔔</span><span class="notification-label"> Avisos</span><span class="notification-badge" id="notificationBadge" hidden>0</span></button>');
    }

    const settingsSection = document.querySelector('#settings');
    if (settingsSection && !document.querySelector('#notifications')) {
      settingsSection.insertAdjacentHTML('beforebegin', `
        <section class="page-section" id="notifications">
          <div class="assistant-summary">
            <article class="metric-card accent-red"><span>Urgentes</span><strong id="alertUrgentCount">0</strong><small>Atención inmediata</small></article>
            <article class="metric-card accent-orange"><span>Entregas</span><strong id="alertOrderCount">0</strong><small>Próximas o atrasadas</small></article>
            <article class="metric-card accent-teal"><span>Inventario</span><strong id="alertInventoryCount">0</strong><small>Materiales bajos</small></article>
            <article class="metric-card accent-blue"><span>Cobros y gastos</span><strong id="alertMoneyCount">0</strong><small>Saldos y vencimientos</small></article>
          </div>
          <div class="dashboard-grid equal">
            <article class="panel">
              <div class="panel-header"><div><h2>Avisos automáticos</h2><p>Se revisan al abrir MoorePrint y mientras permanece activa.</p></div><button class="button secondary" type="button" id="refreshAutomaticAlerts">Actualizar</button></div>
              <div class="assistant-list" id="automaticAlertList"></div>
            </article>
            <article class="panel">
              <div class="panel-header"><div><h2>Configuración</h2><p>El navegador solicitará permiso para mostrar avisos.</p></div></div>
              <div class="notification-settings">
                <label class="notification-toggle"><input type="checkbox" id="notificationOrders"><span>Entregas y atrasos</span></label>
                <label class="notification-toggle"><input type="checkbox" id="notificationCollections"><span>Cobros pendientes</span></label>
                <label class="notification-toggle"><input type="checkbox" id="notificationInventory"><span>Inventario bajo</span></label>
                <label class="notification-toggle"><input type="checkbox" id="notificationExpenses"><span>Gastos por vencer</span></label>
                <label>Días de anticipación<input id="notificationDaysAhead" type="number" min="0" max="14" step="1"></label>
                <div><button class="button primary" type="button" id="enableBrowserNotifications">Permitir notificaciones</button><small id="notificationPermissionStatus"></small></div>
              </div>
            </article>
          </div>
        </section>

        <section class="page-section" id="invoicing">
          <div class="cfdi-notice"><strong>Preparación CFDI 4.0:</strong> organiza los datos y genera un expediente para tu contador o proveedor. No firma, sella ni timbra XML y no es una factura fiscal válida. No guardes aquí contraseñas, archivos .key ni certificados.</div>
          <div class="assistant-summary" style="margin-top:16px">
            <article class="metric-card accent-blue"><span>Sin preparar</span><strong id="cfdiPendingCount">0</strong></article>
            <article class="metric-card accent-purple"><span>Preparados</span><strong id="cfdiPreparedCount">0</strong></article>
            <article class="metric-card accent-orange"><span>Enviados</span><strong id="cfdiSentCount">0</strong></article>
            <article class="metric-card accent-green"><span>Timbrados</span><strong id="cfdiStampedCount">0</strong></article>
          </div>
          <article class="panel">
            <div class="panel-header"><div><h2>Pedidos para facturación</h2><p>Prepara los datos y registra el UUID después del timbrado externo.</p></div><button class="button secondary" type="button" data-go="settings">Configurar emisor</button></div>
            <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Datos fiscales</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="cfdiOrdersTable"></tbody></table></div>
            <div class="assistant-empty" id="cfdiOrdersEmpty">No hay pedidos disponibles para facturación.</div>
          </article>
        </section>

        <section class="page-section" id="help">
          <div class="section-toolbar"><div class="search-box"><span>⌕</span><input id="helpSearch" type="search" placeholder="Buscar ayuda: pedido, caja, respaldo, CFDI…"></div></div>
          <article class="panel"><div class="panel-header"><div><h2>Guía rápida de MoorePrint</h2><p>Procedimientos cortos para las tareas principales.</p></div></div><div class="help-grid" id="helpTopicsGrid"></div></article>
        </section>`);
    }

    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#cfdiSettingsPanel')) {
      settingsGrid.insertAdjacentHTML('beforeend', `
        <article class="panel" id="cfdiSettingsPanel">
          <div class="panel-header"><div><h2>Preparación CFDI 4.0</h2><p>Datos del emisor y valores predeterminados.</p></div></div>
          <form id="cfdiSettingsForm" class="cfdi-settings-grid">
            <label class="full">Nombre o razón social fiscal<input name="fiscalName" required></label>
            <label>RFC del emisor<input name="rfc" maxlength="13" required></label>
            <label>Código postal fiscal<input name="fiscalPostalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required></label>
            <label>Régimen fiscal (clave)<input name="fiscalRegime" maxlength="3" required></label>
            <label>Serie interna<input name="series" maxlength="10"></label>
            <label>Uso CFDI predeterminado<input name="defaultCfdiUse" maxlength="4"></label>
            <label>Método de pago predeterminado<select name="defaultPaymentMethod"><option value="PUE">PUE · Pago en una sola exhibición</option><option value="PPD">PPD · Parcialidades o diferido</option></select></label>
            <label>Forma de pago predeterminada<input name="defaultPaymentForm" maxlength="2"></label>
            <label>Clave producto/servicio predeterminada<input name="defaultProductServiceKey" inputmode="numeric" maxlength="8"></label>
            <label>Clave de unidad predeterminada<input name="defaultUnitKey" maxlength="3"></label>
            <label>Objeto de impuesto predeterminado<input name="defaultTaxObject" maxlength="2"></label>
            <label>Proveedor o contador previsto<input name="pacName" placeholder="Solo nombre; no guardes contraseñas"></label>
            <div class="cfdi-notice full"><strong>Seguridad:</strong> MoorePrint no solicita ni almacena e.firma, CSD, archivos .cer, archivos .key ni contraseñas.</div>
            <button class="button primary" type="submit">Guardar configuración fiscal</button>
          </form>
        </article>`);
    }
  }

  function daysFromToday(dateValue) {
    if (!dateValue) return null;
    return Math.round((new Date(`${dateValue}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000);
  }

  function buildAlerts() {
    normalize();
    const alerts = [];
    const settings = state.notificationSettings;
    const daysAhead = Math.max(0, Math.min(14, Number(settings.daysAhead) || 0));
    const add = alert => { if (!alerts.some(item => item.id === alert.id)) alerts.push(alert); };

    if (settings.orders) {
      state.orders.filter(order => !['entregado', 'cancelado'].includes(order.status) && order.dueDate).forEach(order => {
        const days = daysFromToday(order.dueDate);
        const customer = order.customer || entityName(state.customers, order.customerId, 'Cliente');
        if (days < 0) add({ id: `order-overdue-${order.id}-${order.dueDate}`, severity: 'danger', icon: '⏰', group: 'orders', section: 'orders', notify: true, title: `${order.folio} está atrasado`, detail: `${customer} · entrega ${formatDate(order.dueDate)}` });
        else if (days === 0) add({ id: `order-today-${order.id}-${order.dueDate}`, severity: 'danger', icon: '🚨', group: 'orders', section: 'orders', notify: true, title: `${order.folio} se entrega hoy`, detail: `${customer} · ${statusName(order.status)}` });
        else if (days <= daysAhead) add({ id: `order-soon-${order.id}-${order.dueDate}`, severity: 'warning', icon: '📅', group: 'orders', section: 'orders', notify: days === 1, title: `${order.folio} se entrega en ${days} día${days === 1 ? '' : 's'}`, detail: `${customer} · ${formatDate(order.dueDate)}` });
      });
    }

    if (settings.collections) {
      state.orders.filter(order => order.status !== 'cancelado').forEach(order => {
        const totals = documentTotals(order);
        if (totals.balance <= 0 || !['listo', 'entregado'].includes(order.status)) return;
        add({ id: `collection-${order.id}-${totals.balance.toFixed(2)}`, severity: order.status === 'entregado' ? 'danger' : 'warning', icon: '💵', group: 'money', section: 'cash', notify: true, title: `Cobro pendiente de ${order.folio}`, detail: `${order.customer || entityName(state.customers, order.customerId, 'Cliente')} · ${currency(totals.balance)}` });
      });
    }

    if (settings.inventory) {
      state.materials.filter(isLowStock).forEach(material => {
        const out = value(material.stock) <= 0;
        add({ id: `inventory-${material.id}-${value(material.stock)}`, severity: out ? 'danger' : 'warning', icon: out ? '🛑' : '📦', group: 'inventory', section: 'inventory', notify: out, title: out ? `${material.name} está agotado` : `${material.name} tiene existencia baja`, detail: `${value(material.stock).toFixed(2)} ${material.unit || 'unidades'} · mínimo ${value(material.minStock).toFixed(2)}` });
      });
    }

    if (settings.expenses) {
      state.expenses.forEach(expense => {
        const totals = expenseTotals(expense);
        if (totals.balance <= 0 || !expense.dueDate) return;
        const days = daysFromToday(expense.dueDate);
        if (days < 0) add({ id: `expense-overdue-${expense.id}-${expense.dueDate}`, severity: 'danger', icon: '💸', group: 'money', section: 'expenses', notify: true, title: `Gasto vencido: ${expense.description}`, detail: `${currency(totals.balance)} · venció ${formatDate(expense.dueDate)}` });
        else if (days <= daysAhead) add({ id: `expense-soon-${expense.id}-${expense.dueDate}`, severity: days === 0 ? 'danger' : 'warning', icon: '🧾', group: 'money', section: 'expenses', notify: days <= 1, title: days === 0 ? `Gasto por pagar hoy: ${expense.description}` : `Gasto próximo: ${expense.description}`, detail: `${currency(totals.balance)} · ${formatDate(expense.dueDate)}` });
      });
    }

    const rank = { danger: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
  }

  function permissionText() {
    if (!('Notification' in window)) return 'Este navegador no permite notificaciones.';
    if (Notification.permission === 'granted') return 'Permiso concedido.';
    if (Notification.permission === 'denied') return 'Permiso bloqueado en el navegador.';
    return 'Permiso pendiente.';
  }

  function renderAlerts() {
    if (!document.querySelector('#automaticAlertList')) return;
    latestAlerts = buildAlerts();
    document.querySelector('#alertUrgentCount').textContent = latestAlerts.filter(item => item.severity === 'danger').length;
    document.querySelector('#alertOrderCount').textContent = latestAlerts.filter(item => item.group === 'orders').length;
    document.querySelector('#alertInventoryCount').textContent = latestAlerts.filter(item => item.group === 'inventory').length;
    document.querySelector('#alertMoneyCount').textContent = latestAlerts.filter(item => item.group === 'money').length;

    const badge = document.querySelector('#notificationBadge');
    badge.textContent = latestAlerts.length > 99 ? '99+' : String(latestAlerts.length);
    badge.hidden = latestAlerts.length === 0;
    document.querySelector('#automaticAlertList').innerHTML = latestAlerts.length
      ? latestAlerts.map(alert => `<button class="assistant-alert ${alert.severity}" type="button" data-go="${alert.section}"><span class="assistant-icon">${alert.icon}</span><span><strong>${html(alert.title)}</strong><small>${html(alert.detail)}</small></span><span class="assistant-arrow">›</span></button>`).join('')
      : '<div class="assistant-empty">Todo está al corriente.</div>';

    const settings = state.notificationSettings;
    document.querySelector('#notificationOrders').checked = Boolean(settings.orders);
    document.querySelector('#notificationCollections').checked = Boolean(settings.collections);
    document.querySelector('#notificationInventory').checked = Boolean(settings.inventory);
    document.querySelector('#notificationExpenses').checked = Boolean(settings.expenses);
    document.querySelector('#notificationDaysAhead').value = String(settings.daysAhead);
    document.querySelector('#notificationPermissionStatus').textContent = permissionText();
    const button = document.querySelector('#enableBrowserNotifications');
    button.textContent = 'Notification' in window && Notification.permission === 'granted' ? 'Notificaciones activadas' : 'Permitir notificaciones';
    button.disabled = 'Notification' in window && Notification.permission === 'granted';
  }

  function alertHistory() {
    try { return JSON.parse(localStorage.getItem(ALERT_HISTORY_KEY) || '{}'); }
    catch (error) { return {}; }
  }

  async function showBrowserNotification(alert) {
    const options = { body: alert.detail, icon: './icon-192.png', badge: './icon-192.png', tag: alert.id, renotify: false, data: { url: `./#${alert.section}` } };
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    if (registration?.showNotification) return registration.showNotification(`MoorePrint · ${alert.title}`, options);
    new Notification(`MoorePrint · ${alert.title}`, options);
  }

  async function dispatchBrowserNotifications() {
    normalize();
    if (!state.notificationSettings.browserEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const date = todayISO();
    const history = alertHistory();
    const sent = new Set(Array.isArray(history[date]) ? history[date] : []);
    for (const alert of buildAlerts().filter(item => item.notify && !sent.has(item.id)).slice(0, 5)) {
      try { await showBrowserNotification(alert); sent.add(alert.id); }
      catch (error) { console.warn('No fue posible mostrar una notificación.', error); }
    }
    localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify({ [date]: [...sent] }));
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return showToast('Este navegador no admite notificaciones.', 'warning');
    const permission = await Notification.requestPermission();
    state.notificationSettings.browserEnabled = permission === 'granted';
    saveState(permission === 'granted' ? 'Notificaciones activadas' : 'No se concedió permiso para notificaciones', permission === 'granted' ? 'normal' : 'warning');
    if (permission === 'granted') dispatchBrowserNotifications();
  }

  function renderHelp(query = '') {
    const grid = document.querySelector('#helpTopicsGrid');
    if (!grid) return;
    const search = String(query).trim().toLowerCase();
    const topics = HELP_TOPICS.filter(([, title, keywords, , steps]) => `${title} ${keywords} ${steps.join(' ')}`.toLowerCase().includes(search));
    grid.innerHTML = topics.length
      ? topics.map(([icon, title, , section, steps]) => `<details class="help-card"><summary><span>${icon}</span><span>${html(title)}</span></summary><div class="help-card-content"><ol>${steps.map(step => `<li>${html(step)}</li>`).join('')}</ol><button class="button secondary small" type="button" data-go="${section}">Ir a esta sección</button></div></details>`).join('')
      : '<div class="assistant-empty">No se encontró una guía con esas palabras.</div>';
  }

  function recordForOrder(orderId) {
    return state.cfdiRecords.find(record => record.orderId === orderId) || null;
  }

  function recipientFor(order, record = null) {
    const customer = state.customers.find(item => item.id === order.customerId) || {};
    return {
      customerId: order.customerId || '',
      name: record?.recipient?.name || customer.fiscalName || customer.name || order.customer || '',
      rfc: record?.recipient?.rfc || customer.rfc || '',
      fiscalPostalCode: record?.recipient?.fiscalPostalCode || customer.fiscalPostalCode || '',
      fiscalRegime: record?.recipient?.fiscalRegime || customer.fiscalRegime || '',
      cfdiUse: record?.recipient?.cfdiUse || customer.cfdiUse || state.business.cfdi.defaultCfdiUse || '',
      email: record?.recipient?.email || customer.invoiceEmail || customer.email || ''
    };
  }

  function conceptsFor(order, record = null) {
    const previous = Array.isArray(record?.concepts) ? record.concepts : [];
    return (order.items || []).map((item, index) => ({
      description: item.name || '', quantity: value(item.qty), unitPrice: value(item.price),
      productServiceKey: previous[index]?.productServiceKey || state.business.cfdi.defaultProductServiceKey || '',
      unitKey: previous[index]?.unitKey || state.business.cfdi.defaultUnitKey || '',
      taxObject: previous[index]?.taxObject || state.business.cfdi.defaultTaxObject || '02'
    }));
  }

  function missingFiscalData(order, record = null) {
    const recipient = recipientFor(order, record);
    const issuer = state.business.cfdi;
    const concepts = conceptsFor(order, record);
    const missing = [];
    if (!issuer.fiscalName) missing.push('razón social del emisor');
    if (!state.business.rfc) missing.push('RFC del emisor');
    if (!issuer.fiscalPostalCode) missing.push('CP del emisor');
    if (!issuer.fiscalRegime) missing.push('régimen del emisor');
    if (!recipient.name) missing.push('razón social del cliente');
    if (!recipient.rfc) missing.push('RFC del cliente');
    if (!recipient.fiscalPostalCode) missing.push('CP del cliente');
    if (!recipient.fiscalRegime) missing.push('régimen del cliente');
    if (!recipient.cfdiUse) missing.push('uso CFDI');
    if (concepts.some(concept => !concept.productServiceKey)) missing.push('clave de producto/servicio');
    if (concepts.some(concept => !concept.unitKey)) missing.push('clave de unidad');
    return missing;
  }

  function renderCfdiSettings() {
    const form = document.querySelector('#cfdiSettingsForm');
    if (!form) return;
    const config = state.business.cfdi;
    const fields = { ...config, rfc: state.business.rfc || '' };
    Object.entries(fields).forEach(([name, fieldValue]) => {
      if (form.elements[name]) form.elements[name].value = fieldValue || '';
    });
  }

  function renderCfdi() {
    const table = document.querySelector('#cfdiOrdersTable');
    if (!table) return;
    const orders = state.orders.filter(order => order.status !== 'cancelado').sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
    const records = state.cfdiRecords;
    document.querySelector('#cfdiPendingCount').textContent = Math.max(0, orders.length - records.filter(record => record.status !== 'cancelado').length);
    document.querySelector('#cfdiPreparedCount').textContent = records.filter(record => record.status === 'preparado').length;
    document.querySelector('#cfdiSentCount').textContent = records.filter(record => record.status === 'enviado').length;
    document.querySelector('#cfdiStampedCount').textContent = records.filter(record => record.status === 'timbrado').length;
    document.querySelector('#cfdiOrdersEmpty').style.display = orders.length ? 'none' : 'block';
    table.innerHTML = orders.map(order => {
      const record = recordForOrder(order.id);
      const recipient = recipientFor(order, record);
      const missing = missingFiscalData(order, record);
      const totals = documentTotals(order);
      const status = record?.status || 'sin_preparar';
      const label = { sin_preparar: 'Sin preparar', preparado: 'Preparado', enviado: 'Enviado', timbrado: 'Timbrado', cancelado: 'Cancelado' }[status] || status;
      return `<tr><td><strong>${html(order.folio || order.id)}</strong><br><small>${formatDate(order.orderDate)}</small></td><td><strong>${html(recipient.name || order.customer || 'Sin cliente')}</strong><br><small>${html(recipient.rfc || 'Sin RFC')}</small></td><td>${currency(totals.total)}</td><td>${missing.length ? `<span class="money-negative">Incompletos</span><small class="cfdi-missing">${html(missing.slice(0, 4).join(', '))}${missing.length > 4 ? '…' : ''}</small>` : '<span class="money-positive">Completos</span>'}</td><td><span class="cfdi-status ${status}">${html(label)}</span>${record?.uuid ? `<br><small>${html(record.uuid)}</small>` : ''}</td><td><div class="action-group"><button class="action-button" type="button" data-cfdi-prepare="${html(order.id)}" title="Preparar expediente">${record ? '✎' : '＋'}</button>${record ? `<button class="action-button" type="button" data-cfdi-export="${html(order.id)}" title="Exportar expediente">⇩</button>` : ''}${record?.status === 'preparado' ? `<button class="action-button" type="button" data-cfdi-send="${html(order.id)}" title="Marcar enviado">→</button>` : ''}${record && record.status !== 'timbrado' ? `<button class="action-button" type="button" data-cfdi-stamp="${html(order.id)}" title="Registrar UUID timbrado">✓</button>` : ''}</div></td></tr>`;
    }).join('');
  }

  function openCfdiPreparation(orderId) {
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return;
    const record = recordForOrder(orderId);
    const recipient = recipientFor(order, record);
    const concepts = conceptsFor(order, record);
    const totals = documentTotals(order);
    openModal(`Preparar CFDI · ${order.folio || order.id}`, `<form id="cfdiPreparationForm" class="modal-form"><input type="hidden" name="orderId" value="${html(order.id)}"><div class="cfdi-notice full"><strong>No es una factura:</strong> revisa los datos con tu contador o PAC antes de timbrar.</div><label class="full">Nombre o razón social del receptor<input name="recipientName" required value="${html(recipient.name)}"></label><label>RFC receptor<input name="recipientRfc" maxlength="13" required value="${html(recipient.rfc)}"></label><label>Código postal fiscal<input name="recipientPostalCode" maxlength="5" required value="${html(recipient.fiscalPostalCode)}"></label><label>Régimen fiscal receptor<input name="recipientRegime" maxlength="3" required value="${html(recipient.fiscalRegime)}"></label><label>Uso CFDI<input name="cfdiUse" maxlength="4" required value="${html(recipient.cfdiUse)}"></label><label>Correo de envío<input name="recipientEmail" type="email" value="${html(recipient.email)}"></label><label>Método de pago<select name="paymentMethod"><option value="PUE" ${(record?.paymentMethod || state.business.cfdi.defaultPaymentMethod) === 'PUE' ? 'selected' : ''}>PUE</option><option value="PPD" ${(record?.paymentMethod || state.business.cfdi.defaultPaymentMethod) === 'PPD' ? 'selected' : ''}>PPD</option></select></label><label>Forma de pago<input name="paymentForm" maxlength="2" required value="${html(record?.paymentForm || state.business.cfdi.defaultPaymentForm)}"></label><div class="full"><strong>Conceptos</strong><div class="cfdi-concepts">${concepts.map((concept, index) => `<div class="cfdi-concept"><div class="concept-copy"><strong>${html(concept.description)}</strong><small>${concept.quantity} × ${currency(concept.unitPrice)}</small></div><label>Clave producto/servicio<input name="conceptKey_${index}" maxlength="8" required value="${html(concept.productServiceKey)}"></label><label>Clave unidad<input name="unitKey_${index}" maxlength="3" required value="${html(concept.unitKey)}"></label><label>Objeto impuesto<input name="taxObject_${index}" maxlength="2" required value="${html(concept.taxObject)}"></label></div>`).join('')}</div></div><input type="hidden" name="conceptCount" value="${concepts.length}"><div class="info-box full"><strong>Totales</strong><p>Subtotal ${currency(totals.subtotal)} · IVA ${currency(totals.tax)} · total ${currency(totals.total)}</p></div><label class="full">Notas<textarea name="notes" rows="3">${html(record?.notes || '')}</textarea></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="cfdiPreparationForm">Guardar expediente</button>', true);
  }

  function saveCfdiPreparation(form) {
    const data = Object.fromEntries(new FormData(form));
    const order = state.orders.find(item => item.id === data.orderId);
    if (!order) return;
    const previous = recordForOrder(order.id);
    const concepts = conceptsFor(order, previous).map((concept, index) => ({ ...concept, productServiceKey: String(data[`conceptKey_${index}`] || '').trim(), unitKey: String(data[`unitKey_${index}`] || '').trim().toUpperCase(), taxObject: String(data[`taxObject_${index}`] || '').trim() }));
    const record = { id: previous?.id || uid('cfdi'), orderId: order.id, orderFolio: order.folio || '', status: previous?.status || 'preparado', recipient: { customerId: order.customerId || '', name: String(data.recipientName || '').trim(), rfc: String(data.recipientRfc || '').trim().toUpperCase(), fiscalPostalCode: String(data.recipientPostalCode || '').trim(), fiscalRegime: String(data.recipientRegime || '').trim(), cfdiUse: String(data.cfdiUse || '').trim().toUpperCase(), email: String(data.recipientEmail || '').trim() }, paymentMethod: data.paymentMethod, paymentForm: data.paymentForm, concepts, notes: String(data.notes || '').trim(), uuid: previous?.uuid || '', stampedAt: previous?.stampedAt || '', createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const index = state.cfdiRecords.findIndex(item => item.orderId === order.id);
    if (index >= 0) state.cfdiRecords[index] = record;
    else state.cfdiRecords.push(record);
    closeModal(true);
    saveState('Expediente fiscal guardado');
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportCfdiRecord(orderId) {
    const order = state.orders.find(item => item.id === orderId);
    const record = recordForOrder(orderId);
    if (!order || !record) return;
    const totals = documentTotals(order);
    downloadJson({ format: 'mooreprint-cfdi-preparation', version: 1, warning: 'Este archivo no es un CFDI, no es XML timbrado y no tiene validez fiscal.', generatedAt: new Date().toISOString(), issuer: { name: state.business.cfdi.fiscalName, rfc: state.business.rfc || '', fiscalPostalCode: state.business.cfdi.fiscalPostalCode, fiscalRegime: state.business.cfdi.fiscalRegime, series: state.business.cfdi.series, pacName: state.business.cfdi.pacName }, recipient: record.recipient, document: { orderId: order.id, folio: order.folio, date: order.orderDate, paymentMethod: record.paymentMethod, paymentForm: record.paymentForm, concepts: record.concepts, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, notes: record.notes }, control: { status: record.status, uuid: record.uuid || '', stampedAt: record.stampedAt || '' } }, `cfdi-preparacion-${String(order.folio || order.id).replace(/[^a-z0-9_-]+/gi, '-')}.json`);
    showToast('Expediente fiscal descargado');
  }

  function markCfdiSent(orderId) {
    const record = recordForOrder(orderId);
    if (!record) return;
    record.status = 'enviado';
    record.sentAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    saveState('Expediente marcado como enviado');
  }

  function openCfdiStamp(orderId) {
    const order = state.orders.find(item => item.id === orderId);
    const record = recordForOrder(orderId);
    if (!order || !record) return;
    openModal(`Registrar timbrado · ${order.folio || order.id}`, `<form id="cfdiStampForm" class="modal-form"><input type="hidden" name="orderId" value="${html(orderId)}"><div class="cfdi-notice full"><strong>Registro manual:</strong> captura los datos solo después de recibir el XML timbrado.</div><label class="full">UUID fiscal<input name="uuid" required maxlength="36" value="${html(record.uuid || '')}"></label><label>Fecha de timbrado<input name="stampedAt" type="datetime-local" required value="${html(record.stampedAt ? record.stampedAt.slice(0, 16) : '')}"></label><label class="full">Referencia o nota<input name="stampNote" value="${html(record.stampNote || '')}"></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="cfdiStampForm">Guardar timbrado</button>');
  }

  function saveCfdiStamp(form) {
    const data = Object.fromEntries(new FormData(form));
    const record = recordForOrder(data.orderId);
    if (!record) return;
    record.uuid = String(data.uuid || '').trim().toUpperCase();
    record.stampedAt = data.stampedAt;
    record.stampNote = String(data.stampNote || '').trim();
    record.status = 'timbrado';
    record.updatedAt = new Date().toISOString();
    closeModal(true);
    saveState('UUID fiscal registrado');
  }

  function saveCfdiSettings(form) {
    const data = Object.fromEntries(new FormData(form));
    state.business.rfc = String(data.rfc || '').trim().toUpperCase();
    state.business.cfdi = { ...state.business.cfdi, fiscalName: String(data.fiscalName || '').trim(), fiscalPostalCode: String(data.fiscalPostalCode || '').trim(), fiscalRegime: String(data.fiscalRegime || '').trim(), series: String(data.series || '').trim().toUpperCase(), defaultCfdiUse: String(data.defaultCfdiUse || '').trim().toUpperCase(), defaultPaymentMethod: data.defaultPaymentMethod, defaultPaymentForm: String(data.defaultPaymentForm || '').trim(), defaultProductServiceKey: String(data.defaultProductServiceKey || '').trim(), defaultUnitKey: String(data.defaultUnitKey || '').trim().toUpperCase(), defaultTaxObject: String(data.defaultTaxObject || '').trim(), pacName: String(data.pacName || '').trim() };
    saveState('Configuración fiscal guardada');
  }

  function applyRoleVisibility() {
    const allowed = isAdmin();
    const nav = document.querySelector('[data-section="invoicing"]');
    const page = document.querySelector('#invoicing');
    const settings = document.querySelector('#cfdiSettingsPanel');
    if (nav) nav.hidden = !allowed;
    if (settings) settings.hidden = !allowed;
    if (!allowed && page?.classList.contains('active')) navigate('dashboard');
  }

  function render() {
    normalize();
    renderAlerts();
    renderCfdi();
    renderCfdiSettings();
    applyRoleVisibility();
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'enableBrowserNotifications') requestNotificationPermission();
      if (target.id === 'refreshAutomaticAlerts') { renderAlerts(); dispatchBrowserNotifications(); showToast('Avisos actualizados'); }
      if (target.dataset.cfdiPrepare) openCfdiPreparation(target.dataset.cfdiPrepare);
      if (target.dataset.cfdiExport) exportCfdiRecord(target.dataset.cfdiExport);
      if (target.dataset.cfdiSend) markCfdiSent(target.dataset.cfdiSend);
      if (target.dataset.cfdiStamp) openCfdiStamp(target.dataset.cfdiStamp);
    });
    document.addEventListener('change', event => {
      const map = { notificationOrders: 'orders', notificationCollections: 'collections', notificationInventory: 'inventory', notificationExpenses: 'expenses' };
      if (map[event.target?.id]) { state.notificationSettings[map[event.target.id]] = Boolean(event.target.checked); saveState('Preferencias de avisos guardadas'); }
      if (event.target?.id === 'notificationDaysAhead') { state.notificationSettings.daysAhead = Math.max(0, Math.min(14, Number(event.target.value) || 0)); saveState('Anticipación de avisos actualizada'); }
    });
    document.addEventListener('input', event => { if (event.target?.id === 'helpSearch') renderHelp(event.target.value); });
    document.addEventListener('submit', event => {
      const handlers = { cfdiSettingsForm: saveCfdiSettings, cfdiPreparationForm: saveCfdiPreparation, cfdiStampForm: saveCfdiStamp };
      const handler = handlers[event.target?.id];
      if (!handler) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handler(event.target);
    }, true);
    window.addEventListener('focus', () => { render(); dispatchBrowserNotifications(); }, { passive: true });
    window.addEventListener('online', () => { renderAlerts(); dispatchBrowserNotifications(); }, { passive: true });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    normalize();
    injectInterface();
    bindEvents();
    renderHelp();
    render();
    setTimeout(() => dispatchBrowserNotifications(), 2200);
    setInterval(() => { render(); dispatchBrowserNotifications(); }, 15 * 60 * 1000);
  }

  window.MoorePrintBusinessAssistant = { init, render, renderAlerts, renderCfdi, dispatchBrowserNotifications };
})();
