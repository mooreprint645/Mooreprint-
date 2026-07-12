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
    {
      icon: '🧾',
      title: 'Registrar un pedido',
      keywords: 'pedido cliente anticipo trabajo entrega',
      section: 'orders',
      steps: [
        'Abre Pedidos y pulsa Nuevo pedido.',
        'Selecciona al cliente, agrega los conceptos, cantidades y precios.',
        'Define fecha de entrega, estado, responsable y datos del diseño.',
        'Guarda el pedido. El inventario se descuenta al pasar a producción.'
      ]
    },
    {
      icon: '💵',
      title: 'Registrar un cobro o pago',
      keywords: 'cobro pago anticipo saldo caja',
      section: 'cash',
      steps: [
        'Abre el pedido, compra o gasto correspondiente.',
        'Pulsa el botón de pago e indica monto, fecha, método y referencia.',
        'Revisa la confirmación antes de guardar.',
        'El movimiento aparecerá automáticamente en Caja y pagos.'
      ]
    },
    {
      icon: '💰',
      title: 'Realizar un corte de caja',
      keywords: 'corte caja contado esperado diferencia',
      section: 'cash',
      steps: [
        'En Caja y pagos pulsa Corte de caja.',
        'Revisa saldo inicial, entradas, salidas y efectivo esperado.',
        'Captura el efectivo contado y explica cualquier diferencia.',
        'Confirma el corte para dejarlo registrado en el historial.'
      ]
    },
    {
      icon: '📦',
      title: 'Controlar inventario',
      keywords: 'inventario material compra ajuste existencia bajo',
      section: 'inventory',
      steps: [
        'Registra cada material con existencia, unidad, mínimo y costo.',
        'Usa Compras para aumentar existencias y actualizar el costo promedio.',
        'Usa Ajustar existencia para mermas, conteos o correcciones.',
        'Los avisos mostrarán materiales agotados o con existencia baja.'
      ]
    },
    {
      icon: '🔔',
      title: 'Activar avisos automáticos',
      keywords: 'aviso notificación entrega atraso cobro material gasto',
      section: 'notifications',
      steps: [
        'Abre Avisos y pulsa Permitir notificaciones.',
        'Autoriza las notificaciones cuando el navegador lo solicite.',
        'Elige cuántos días antes deseas recibir recordatorios.',
        'Los avisos se revisan al abrir la página, volver a ella y mientras permanece activa.'
      ]
    },
    {
      icon: '☁️',
      title: 'Trabajar sin conexión',
      keywords: 'sin conexión offline pendiente sincronizar internet',
      section: 'settings',
      steps: [
        'Continúa trabajando aunque se interrumpa internet.',
        'Los cambios se conservarán como pendientes en el dispositivo.',
        'Al recuperar conexión, MoorePrint intentará sincronizarlos.',
        'No cierres sesión ni borres los datos del sitio mientras existan cambios pendientes.'
      ]
    },
    {
      icon: '🗄️',
      title: 'Crear respaldos',
      keywords: 'respaldo json archivos diseños comprobantes restaurar',
      section: 'settings',
      steps: [
        'Descarga el respaldo JSON de los datos administrativos.',
        'Descarga por separado el respaldo de archivos adjuntos.',
        'Guarda ambos archivos en una ubicación segura.',
        'Antes de cambiar de celular, comprueba que los dos respaldos abran correctamente.'
      ]
    },
    {
      icon: '🧮',
      title: 'Preparar una factura CFDI',
      keywords: 'cfdi factura fiscal sat pac rfc timbrado',
      section: 'invoicing',
      steps: [
        'Completa los datos fiscales del negocio en Configuración.',
        'Guarda RFC, razón social, código postal, régimen y uso CFDI del cliente.',
        'En Facturación prepara el expediente del pedido y revisa las claves de cada concepto.',
        'Exporta el expediente para tu contador o PAC. Registra el UUID después del timbrado externo.'
      ]
    },
    {
      icon: '🛠️',
      title: 'Resolver un problema de sincronización',
      keywords: 'error sincronización reintentar conflicto integridad',
      section: 'settings',
      steps: [
        'Revisa el indicador de conexión en la parte inferior.',
        'Pulsa Reintentar cuando aparezca error o modo sin conexión.',
        'En Configuración usa Probar integridad.',
        'Cuando exista un conflicto, revisa qué usuario modificó primero el registro antes de volver a guardar.'
      ]
    }
  ];

  let initialized = false;
  let latestAlerts = [];

  function escapeHtml(value) {
    return typeof esc === 'function'
      ? esc(value)
      : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function numberValue(value) {
    return typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;
  }

  function moneyValue(value) {
    return typeof money === 'function'
      ? money(value)
      : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(numberValue(value));
  }

  function currentDate() {
    return typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
  }

  function normalizeModuleState() {
    state.notificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(state.notificationSettings || {})
    };
    state.cfdiRecords = Array.isArray(state.cfdiRecords) ? state.cfdiRecords : [];
    state.business = state.business || {};
    state.business.cfdi = {
      ...DEFAULT_CFDI_SETTINGS,
      ...(state.business.cfdi || {})
    };
  }

  function isAdmin() {
    const api = window.MoorePrintBranches;
    const profile = api?.getProfile?.();
    if (!profile) return true;
    return Boolean(api?.isAdmin?.());
  }

  function createNavButton(section, icon, label) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.section = section;
    button.innerHTML = `<span>${icon}</span> ${label}`;
    return button;
  }

  function injectInterface() {
    const nav = document.querySelector('.nav-list');
    const settingsButton = nav?.querySelector('[data-section="settings"]');
    if (nav && settingsButton && !nav.querySelector('[data-section="notifications"]')) {
      settingsButton.before(createNavButton('notifications', '🔔', 'Avisos'));
      settingsButton.before(createNavButton('invoicing', '🧮', 'Facturación'));
      settingsButton.before(createNavButton('help', '❓', 'Ayuda'));
    }

    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions && !document.querySelector('#notificationCenterButton')) {
      const button = document.createElement('button');
      button.id = 'notificationCenterButton';
      button.className = 'button secondary notification-button';
      button.type = 'button';
      button.dataset.go = 'notifications';
      button.setAttribute('aria-label', 'Abrir avisos');
      button.innerHTML = '<span aria-hidden="true">🔔</span><span class="notification-label"> Avisos</span><span class="notification-badge" id="notificationBadge" hidden>0</span>';
      topbarActions.prepend(button);
    }

    const settingsSection = document.querySelector('#settings');
    if (settingsSection && !document.querySelector('#notifications')) {
      settingsSection.insertAdjacentHTML('beforebegin', `
        <section class="page-section" id="notifications">
          <div class="assistant-summary">
            <article class="metric-card accent-red"><span>Urgentes</span><strong id="alertUrgentCount">0</strong><small>Necesitan atención inmediata</small></article>
            <article class="metric-card accent-orange"><span>Entregas</span><strong id="alertOrderCount">0</strong><small>Próximas o atrasadas</small></article>
            <article class="metric-card accent-teal"><span>Inventario</span><strong id="alertInventoryCount">0</strong><small>Materiales bajos</small></article>
            <article class="metric-card accent-blue"><span>Cobros y gastos</span><strong id="alertMoneyCount">0</strong><small>Saldos y vencimientos</small></article>
          </div>
          <div class="dashboard-grid equal">
            <article class="panel">
              <div class="panel-header"><div><h2>Avisos automáticos</h2><p>Se revisan al abrir MoorePrint, volver a la página y mientras está activa.</p></div><button class="button secondary" type="button" id="refreshAutomaticAlerts">Actualizar</button></div>
              <div class="assistant-list" id="automaticAlertList"></div>
            </article>
            <article class="panel">
              <div class="panel-header"><div><h2>Configuración</h2><p>El navegador solicitará permiso antes de mostrar avisos fuera de la página.</p></div></div>
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
          <div class="cfdi-notice"><strong>Preparación CFDI 4.0:</strong> este módulo organiza los datos y genera un expediente para tu contador o proveedor de facturación. No firma, sella ni timbra XML y no debe considerarse una factura fiscal válida. No guardes aquí contraseñas, archivos .key ni certificados.</div>
          <div class="assistant-summary" style="margin-top:16px">
            <article class="metric-card accent-blue"><span>Sin preparar</span><strong id="cfdiPendingCount">0</strong></article>
            <article class="metric-card accent-purple"><span>Preparados</span><strong id="cfdiPreparedCount">0</strong></article>
            <article class="metric-card accent-orange"><span>Enviados</span><strong id="cfdiSentCount">0</strong></article>
            <article class="metric-card accent-green"><span>Timbrados</span><strong id="cfdiStampedCount">0</strong></article>
          </div>
          <article class="panel">
            <div class="panel-header"><div><h2>Pedidos para facturación</h2><p>Prepara los datos, expórtalos y registra manualmente el UUID después del timbrado externo.</p></div><button class="button secondary" type="button" data-go="settings">Configurar emisor</button></div>
            <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Datos fiscales</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="cfdiOrdersTable"></tbody></table></div>
            <div class="assistant-empty" id="cfdiOrdersEmpty">No hay pedidos disponibles para facturación.</div>
          </article>
        </section>

        <section class="page-section" id="help">
          <div class="section-toolbar"><div class="search-box"><span>⌕</span><input id="helpSearch" type="search" placeholder="Buscar ayuda: pedido, caja, respaldo, CFDI…"></div></div>
          <article class="panel">
            <div class="panel-header"><div><h2>Guía rápida de MoorePrint</h2><p>Procedimientos cortos para las tareas principales.</p></div></div>
            <div class="help-grid" id="helpTopicsGrid"></div>
          </article>
        </section>
      `);
    }

    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#cfdiSettingsPanel')) {
      settingsGrid.insertAdjacentHTML('beforeend', `
        <article class="panel" id="cfdiSettingsPanel">
          <div class="panel-header"><div><h2>Preparación CFDI 4.0</h2><p>Datos del emisor y valores predeterminados para futuros expedientes.</p></div></div>
          <form id="cfdiSettingsForm" class="cfdi-settings-grid">
            <label class="full">Nombre o razón social fiscal<input name="fiscalName" required></label>
            <label>RFC del emisor<input name="rfc" maxlength="13" required></label>
            <label>Código postal fiscal<input name="fiscalPostalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required></label>
            <label>Régimen fiscal (clave)<input name="fiscalRegime" list="businessFiscalRegimeOptions" maxlength="3" required></label>
            <label>Serie interna<input name="series" maxlength="10"></label>
            <label>Uso CFDI predeterminado<input name="defaultCfdiUse" maxlength="4"></label>
            <label>Método de pago predeterminado<select name="defaultPaymentMethod"><option value="PUE">PUE · Pago en una sola exhibición</option><option value="PPD">PPD · Pago en parcialidades o diferido</option></select></label>
            <label>Forma de pago predeterminada<input name="defaultPaymentForm" list="paymentFormOptions" maxlength="2"></label>
            <label>Clave de producto/servicio predeterminada<input name="defaultProductServiceKey" inputmode="numeric" maxlength="8"></label>
            <label>Clave de unidad predeterminada<input name="defaultUnitKey" maxlength="3"></label>
            <label>Objeto de impuesto predeterminado<input name="defaultTaxObject" maxlength="2"></label>
            <label>Proveedor o contador previsto<input name="pacName" placeholder="Solo nombre; no guardes contraseñas"></label>
            <div class="cfdi-notice full"><strong>Seguridad:</strong> MoorePrint no solicita ni almacena e.firma, CSD, archivos .cer, archivos .key ni contraseñas. La conexión real con un PAC se configurará únicamente cuando elijas proveedor.</div>
            <button class="button primary" type="submit">Guardar configuración fiscal</button>
            <datalist id="businessFiscalRegimeOptions"><option value="601">General de Ley Personas Morales</option><option value="603">Personas Morales con Fines no Lucrativos</option><option value="605">Sueldos y Salarios</option><option value="606">Arrendamiento</option><option value="612">Personas Físicas con Actividades Empresariales y Profesionales</option><option value="616">Sin obligaciones fiscales</option><option value="621">Incorporación Fiscal</option><option value="625">Plataformas Tecnológicas</option><option value="626">Régimen Simplificado de Confianza</option></datalist>
            <datalist id="paymentFormOptions"><option value="01">Efectivo</option><option value="02">Cheque nominativo</option><option value="03">Transferencia electrónica de fondos</option><option value="04">Tarjeta de crédito</option><option value="28">Tarjeta de débito</option><option value="99">Por definir</option></datalist>
          </form>
        </article>
      `);
    }
  }

  function daysFromToday(dateValue) {
    if (!dateValue) return null;
    const target = new Date(`${dateValue}T12:00:00`);
    const today = new Date(`${currentDate()}T12:00:00`);
    return Math.round((target - today) / 86400000);
  }

  function addAlert(list, alert) {
    if (!list.some(item => item.id === alert.id)) list.push(alert);
  }

  function buildAlerts() {
    normalizeModuleState();
    const settings = state.notificationSettings;
    const alerts = [];
    const daysAhead = Math.max(0, Math.min(14, Number(settings.daysAhead) || 0));

    if (settings.orders) {
      state.orders
        .filter(order => !['entregado', 'cancelado'].includes(order.status) && order.dueDate)
        .forEach(order => {
          const days = daysFromToday(order.dueDate);
          const customer = order.customer || state.customers.find(item => item.id === order.customerId)?.name || 'Cliente';
          if (days < 0) {
            addAlert(alerts, {
              id: `order-overdue-${order.id}-${order.dueDate}`,
              severity: 'danger', icon: '⏰', group: 'orders', section: 'orders', notify: true,
              title: `${order.folio} está atrasado`,
              detail: `${customer} · entrega ${typeof formatDate === 'function' ? formatDate(order.dueDate) : order.dueDate}`
            });
          } else if (days === 0) {
            addAlert(alerts, {
              id: `order-today-${order.id}-${order.dueDate}`,
              severity: 'danger', icon: '🚨', group: 'orders', section: 'orders', notify: true,
              title: `${order.folio} se entrega hoy`,
              detail: `${customer} · estado ${typeof statusName === 'function' ? statusName(order.status) : order.status}`
            });
          } else if (days <= daysAhead) {
            addAlert(alerts, {
              id: `order-soon-${order.id}-${order.dueDate}`,
              severity: 'warning', icon: '📅', group: 'orders', section: 'orders', notify: days === 1,
              title: `${order.folio} se entrega en ${days} día${days === 1 ? '' : 's'}`,
              detail: `${customer} · ${typeof formatDate === 'function' ? formatDate(order.dueDate) : order.dueDate}`
            });
          }
        });
    }

    if (settings.collections) {
      state.orders
        .filter(order => order.status !== 'cancelado')
        .forEach(order => {
          const totals = typeof documentTotals === 'function' ? documentTotals(order) : { balance: 0 };
          if (totals.balance <= 0 || !['listo', 'entregado'].includes(order.status)) return;
          const customer = order.customer || state.customers.find(item => item.id === order.customerId)?.name || 'Cliente';
          addAlert(alerts, {
            id: `collection-${order.id}-${totals.balance.toFixed(2)}`,
            severity: order.status === 'entregado' ? 'danger' : 'warning',
            icon: '💵', group: 'money', section: 'cash', notify: true,
            title: `Cobro pendiente de ${order.folio}`,
            detail: `${customer} · saldo ${moneyValue(totals.balance)}`
          });
        });
    }

    if (settings.inventory) {
      state.materials.filter(material => typeof isLowStock === 'function' ? isLowStock(material) : numberValue(material.stock) <= numberValue(material.minStock)).forEach(material => {
        const out = numberValue(material.stock) <= 0;
        addAlert(alerts, {
          id: `inventory-${material.id}-${numberValue(material.stock)}`,
          severity: out ? 'danger' : 'warning', icon: out ? '🛑' : '📦',
          group: 'inventory', section: 'inventory', notify: out,
          title: out ? `${material.name} está agotado` : `${material.name} tiene existencia baja`,
          detail: `${numberValue(material.stock).toFixed(2)} ${material.unit || 'unidades'} · mínimo ${numberValue(material.minStock).toFixed(2)}`
        });
      });
    }

    if (settings.expenses) {
      state.expenses.forEach(expense => {
        const totals = typeof expenseTotals === 'function' ? expenseTotals(expense) : { balance: 0, status: 'pendiente' };
        if (totals.balance <= 0 || !expense.dueDate) return;
        const days = daysFromToday(expense.dueDate);
        if (days < 0) {
          addAlert(alerts, {
            id: `expense-overdue-${expense.id}-${expense.dueDate}`,
            severity: 'danger', icon: '💸', group: 'money', section: 'expenses', notify: true,
            title: `Gasto vencido: ${expense.description}`,
            detail: `Saldo ${moneyValue(totals.balance)} · venció ${typeof formatDate === 'function' ? formatDate(expense.dueDate) : expense.dueDate}`
          });
        } else if (days <= daysAhead) {
          addAlert(alerts, {
            id: `expense-soon-${expense.id}-${expense.dueDate}`,
            severity: days === 0 ? 'danger' : 'warning', icon: '🧾', group: 'money', section: 'expenses', notify: days <= 1,
            title: days === 0 ? `Gasto por pagar hoy: ${expense.description}` : `Gasto próximo: ${expense.description}`,
            detail: `${moneyValue(totals.balance)} · ${typeof formatDate === 'function' ? formatDate(expense.dueDate) : expense.dueDate}`
          });
        }
      });
    }

    const rank = { danger: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.title.localeCompare(b.title));
  }

  function permissionText() {
    if (!('Notification' in window)) return 'Este navegador no permite notificaciones.';
    if (Notification.permission === 'granted') return 'Permiso concedido.';
    if (Notification.permission === 'denied') return 'Permiso bloqueado en la configuración del navegador.';
    return 'Permiso pendiente.';
  }

  function renderAlerts() {
    if (!document.querySelector('#automaticAlertList')) return;
    latestAlerts = buildAlerts();
    const urgent = latestAlerts.filter(item => item.severity === 'danger').length;
    const orders = latestAlerts.filter(item => item.group === 'orders').length;
    const inventory = latestAlerts.filter(item => item.group === 'inventory').length;
    const moneyAlerts = latestAlerts.filter(item => item.group === 'money').length;

    document.querySelector('#alertUrgentCount').textContent = String(urgent);
    document.querySelector('#alertOrderCount').textContent = String(orders);
    document.querySelector('#alertInventoryCount').textContent = String(inventory);
    document.querySelector('#alertMoneyCount').textContent = String(moneyAlerts);

    const badge = document.querySelector('#notificationBadge');
    if (badge) {
      badge.textContent = latestAlerts.length > 99 ? '99+' : String(latestAlerts.length);
      badge.hidden = latestAlerts.length === 0;
    }

    const list = document.querySelector('#automaticAlertList');
    list.innerHTML = latestAlerts.length
      ? latestAlerts.map(alert => `<button class="assistant-alert ${alert.severity}" type="button" data-go="${alert.section}"><span class="assistant-icon">${alert.icon}</span><span><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></span><span class="assistant-arrow">›</span></button>`).join('')
      : '<div class="assistant-empty">Todo está al corriente.</div>';

    const settings = state.notificationSettings;
    document.querySelector('#notificationOrders').checked = Boolean(settings.orders);
    document.querySelector('#notificationCollections').checked = Boolean(settings.collections);
    document.querySelector('#notificationInventory').checked = Boolean(settings.inventory);
    document.querySelector('#notificationExpenses').checked = Boolean(settings.expenses);
    document.querySelector('#notificationDaysAhead').value = String(settings.daysAhead);
    document.querySelector('#notificationPermissionStatus').textContent = permissionText();
    const button = document.querySelector('#enableBrowserNotifications');
    if (button) {
      button.textContent = Notification?.permission === 'granted' ? 'Notificaciones activadas' : 'Permitir notificaciones';
      button.disabled = Notification?.permission === 'granted';
    }
  }

  function alertHistory() {
    try { return JSON.parse(localStorage.getItem(ALERT_HISTORY_KEY) || '{}'); }
    catch (error) { return {}; }
  }

  async function showBrowserNotification(alert) {
    const options = {
      body: alert.detail,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: alert.id,
      renotify: false,
      data: { url: `./#${alert.section}` }
    };
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration?.showNotification) return registration.showNotification(`MoorePrint · ${alert.title}`, options);
    }
    new Notification(`MoorePrint · ${alert.title}`, options);
  }

  async function dispatchBrowserNotifications() {
    normalizeModuleState();
    if (!state.notificationSettings.browserEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = currentDate();
    const history = alertHistory();
    const sent = new Set(Array.isArray(history[today]) ? history[today] : []);
    const candidates = buildAlerts().filter(alert => alert.notify && !sent.has(alert.id)).slice(0, 5);
    for (const alert of candidates) {
      try {
        await showBrowserNotification(alert);
        sent.add(alert.id);
      } catch (error) {
        console.warn('No fue posible mostrar una notificación.', error);
      }
    }
    const compact = { [today]: [...sent] };
    localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(compact));
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return window.showToast?.('Este navegador no admite notificaciones.', 'warning');
    const permission = await Notification.requestPermission();
    state.notificationSettings.browserEnabled = permission === 'granted';
    saveState(permission === 'granted' ? 'Notificaciones activadas' : 'No se concedió permiso para notificaciones', permission === 'granted' ? 'normal' : 'warning');
    renderAlerts();
    if (permission === 'granted') dispatchBrowserNotifications();
  }

  function renderHelp(query = '') {
    const grid = document.querySelector('#helpTopicsGrid');
    if (!grid) return;
    const normalized = String(query || '').trim().toLowerCase();
    const topics = HELP_TOPICS.filter(topic => `${topic.title} ${topic.keywords} ${topic.steps.join(' ')}`.toLowerCase().includes(normalized));
    grid.innerHTML = topics.length
      ? topics.map(topic => `<details class="help-card"><summary><span>${topic.icon}</span><span>${escapeHtml(topic.title)}</span></summary><div class="help-card-content"><ol>${topic.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><button class="button secondary small" type="button" data-go="${topic.section}">Ir a esta sección</button></div></details>`).join('')
      : '<div class="assistant-empty">No se encontró una guía con esas palabras.</div>';
  }

  function cfdiRecordFor(orderId) {
    return state.cfdiRecords.find(record => record.orderId === orderId) || null;
  }

  function recipientFor(order, record = null) {
    const customer = state.customers.find(item => item.id === order.customerId) || {};
    return {
      customerId: order.customerId || record?.recipient?.customerId || '',
      name: record?.recipient?.name || customer.fiscalName || customer.name || order.customer || '',
      rfc: record?.recipient?.rfc || customer.rfc || '',
      fiscalPostalCode: record?.recipient?.fiscalPostalCode || customer.fiscalPostalCode || '',
      fiscalRegime: record?.recipient?.fiscalRegime || customer.fiscalRegime || '',
      cfdiUse: record?.recipient?.cfdiUse || customer.cfdiUse || state.business.cfdi.defaultCfdiUse || '',
      email: record?.recipient?.email || customer.invoiceEmail || customer.email || ''
    };
  }

  function conceptRows(order, record = null) {
    const previous = Array.isArray(record?.concepts) ? record.concepts : [];
    return (order.items || []).map((item, index) => ({
      description: item.name || '',
      quantity: numberValue(item.qty),
      unitPrice: numberValue(item.price),
      productServiceKey: previous[index]?.productServiceKey || state.business.cfdi.defaultProductServiceKey || '',
      unitKey: previous[index]?.unitKey || state.business.cfdi.defaultUnitKey || '',
      taxObject: previous[index]?.taxObject || state.business.cfdi.defaultTaxObject || '02'
    }));
  }

  function missingFiscalData(order, record = null) {
    const recipient = recipientFor(order, record);
    const issuer = state.business.cfdi;
    const concepts = conceptRows(order, record);
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
    const values = {
      fiscalName: config.fiscalName,
      rfc: state.business.rfc || '',
      fiscalPostalCode: config.fiscalPostalCode,
      fiscalRegime: config.fiscalRegime,
      series: config.series,
      defaultCfdiUse: config.defaultCfdiUse,
      defaultPaymentMethod: config.defaultPaymentMethod,
      defaultPaymentForm: config.defaultPaymentForm,
      defaultProductServiceKey: config.defaultProductServiceKey,
      defaultUnitKey: config.defaultUnitKey,
      defaultTaxObject: config.defaultTaxObject,
      pacName: config.pacName
    };
    Object.entries(values).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value || '';
    });
  }

  function renderCfdi() {
    const table = document.querySelector('#cfdiOrdersTable');
    if (!table) return;
    const orders = state.orders.filter(order => order.status !== 'cancelado').sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
    const records = state.cfdiRecords;
    const prepared = records.filter(record => record.status === 'preparado').length;
    const sent = records.filter(record => record.status === 'enviado').length;
    const stamped = records.filter(record => record.status === 'timbrado').length;
    document.querySelector('#cfdiPendingCount').textContent = String(Math.max(0, orders.length - records.filter(record => record.status !== 'cancelado').length));
    document.querySelector('#cfdiPreparedCount').textContent = String(prepared);
    document.querySelector('#cfdiSentCount').textContent = String(sent);
    document.querySelector('#cfdiStampedCount').textContent = String(stamped);
    document.querySelector('#cfdiOrdersEmpty').style.display = orders.length ? 'none' : 'block';

    table.innerHTML = orders.map(order => {
      const record = cfdiRecordFor(order.id);
      const recipient = recipientFor(order, record);
      const missing = missingFiscalData(order, record);
      const totals = typeof documentTotals === 'function' ? documentTotals(order) : { total: 0 };
      const status = record?.status || 'sin_preparar';
      const statusLabel = ({ sin_preparar: 'Sin preparar', preparado: 'Preparado', enviado: 'Enviado', timbrado: 'Timbrado', cancelado: 'Cancelado' })[status] || status;
      const actions = [
        `<button class="action-button" type="button" data-cfdi-prepare="${escapeHtml(order.id)}" title="${record ? 'Editar expediente' : 'Preparar expediente'}">${record ? '✎' : '＋'}</button>`
      ];
      if (record) actions.push(`<button class="action-button" type="button" data-cfdi-export="${escapeHtml(order.id)}" title="Exportar expediente">⇩</button>`);
      if (record?.status === 'preparado') actions.push(`<button class="action-button" type="button" data-cfdi-send="${escapeHtml(order.id)}" title="Marcar enviado al contador o PAC">→</button>`);
      if (record && record.status !== 'timbrado') actions.push(`<button class="action-button" type="button" data-cfdi-stamp="${escapeHtml(order.id)}" title="Registrar UUID timbrado">✓</button>`);
      return `<tr><td><strong>${escapeHtml(order.folio || order.id)}</strong><br><small>${typeof formatDate === 'function' ? formatDate(order.orderDate) : escapeHtml(order.orderDate || '')}</small></td><td><strong>${escapeHtml(recipient.name || order.customer || 'Sin cliente')}</strong><br><small>${escapeHtml(recipient.rfc || 'Sin RFC')}</small></td><td>${moneyValue(totals.total)}</td><td>${missing.length ? `<span class="money-negative">Incompletos</span><small class="cfdi-missing">${escapeHtml(missing.slice(0, 4).join(', '))}${missing.length > 4 ? '…' : ''}</small>` : '<span class="money-positive">Completos</span>'}</td><td><span class="cfdi-status ${status}">${escapeHtml(statusLabel)}</span>${record?.uuid ? `<br><small>${escapeHtml(record.uuid)}</small>` : ''}</td><td><div class="action-group">${actions.join('')}</div></td></tr>`;
    }).join('');
  }

  function openCfdiPreparation(orderId) {
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return;
    const record = cfdiRecordFor(orderId);
    const recipient = recipientFor(order, record);
    const concepts = conceptRows(order, record);
    const totals = typeof documentTotals === 'function' ? documentTotals(order) : { subtotal: 0, discount: 0, tax: 0, total: 0 };
    const conceptHtml = concepts.map((concept, index) => `<div class="cfdi-concept"><div class="concept-copy"><strong>${escapeHtml(concept.description || `Concepto ${index + 1}`)}</strong><small>${numberValue(concept.quantity)} × ${moneyValue(concept.unitPrice)}</small></div><label>Clave producto/servicio<input name="conceptKey_${index}" inputmode="numeric" maxlength="8" required value="${escapeHtml(concept.productServiceKey)}"></label><label>Clave unidad<input name="unitKey_${index}" maxlength="3" required value="${escapeHtml(concept.unitKey)}"></label><label>Objeto impuesto<input name="taxObject_${index}" maxlength="2" required value="${escapeHtml(concept.taxObject)}"></label></div>`).join('');
    openModal(`Preparar CFDI · ${order.folio || order.id}`, `<form id="cfdiPreparationForm" class="modal-form"><input type="hidden" name="orderId" value="${escapeHtml(order.id)}"><input type="hidden" name="conceptCount" value="${concepts.length}"><div class="cfdi-notice full"><strong>No es una factura:</strong> revisa los datos con tu contador o PAC antes de timbrar. Las claves SAT dependen del producto o servicio realmente vendido.</div><label class="full">Nombre o razón social del receptor<input name="recipientName" required value="${escapeHtml(recipient.name)}"></label><label>RFC receptor<input name="recipientRfc" maxlength="13" required value="${escapeHtml(recipient.rfc)}"></label><label>Código postal fiscal<input name="recipientPostalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required value="${escapeHtml(recipient.fiscalPostalCode)}"></label><label>Régimen fiscal receptor<input name="recipientRegime" maxlength="3" required value="${escapeHtml(recipient.fiscalRegime)}"></label><label>Uso CFDI<input name="cfdiUse" maxlength="4" required value="${escapeHtml(recipient.cfdiUse)}"></label><label>Correo de envío<input name="recipientEmail" type="email" value="${escapeHtml(recipient.email)}"></label><label>Método de pago<select name="paymentMethod"><option value="PUE" ${(record?.paymentMethod || state.business.cfdi.defaultPaymentMethod) === 'PUE' ? 'selected' : ''}>PUE · Una sola exhibición</option><option value="PPD" ${(record?.paymentMethod || state.business.cfdi.defaultPaymentMethod) === 'PPD' ? 'selected' : ''}>PPD · Parcialidades o diferido</option></select></label><label>Forma de pago<input name="paymentForm" maxlength="2" required value="${escapeHtml(record?.paymentForm || state.business.cfdi.defaultPaymentForm)}"></label><div class="full"><strong>Conceptos</strong><div class="cfdi-concepts" style="margin-top:10px">${conceptHtml || '<div class="assistant-empty">El pedido no tiene conceptos.</div>'}</div></div><div class="info-box full"><strong>Totales del pedido</strong><p>Subtotal ${moneyValue(totals.subtotal)} · descuento ${moneyValue(totals.discount)} · impuestos ${moneyValue(totals.tax)} · total ${moneyValue(totals.total)}</p></div><label class="full">Notas para contador o PAC<textarea name="notes" rows="3">${escapeHtml(record?.notes || '')}</textarea></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="cfdiPreparationForm">Guardar expediente</button>', true);
  }

  function saveCfdiPreparation(form) {
    const values = Object.fromEntries(new FormData(form));
    const order = state.orders.find(item => item.id === values.orderId);
    if (!order) return;
    const previous = cfdiRecordFor(order.id);
    const count = Number(values.conceptCount || 0);
    const concepts = conceptRows(order, previous).map((concept, index) => ({
      ...concept,
      productServiceKey: String(values[`conceptKey_${index}`] || '').trim(),
      unitKey: String(values[`unitKey_${index}`] || '').trim().toUpperCase(),
      taxObject: String(values[`taxObject_${index}`] || '').trim()
    }));
    const record = {
      id: previous?.id || `cfdi-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      orderId: order.id,
      orderFolio: order.folio || '',
      status: previous?.status || 'preparado',
      recipient: {
        customerId: order.customerId || '',
        name: String(values.recipientName || '').trim(),
        rfc: String(values.recipientRfc || '').trim().toUpperCase(),
        fiscalPostalCode: String(values.recipientPostalCode || '').trim(),
        fiscalRegime: String(values.recipientRegime || '').trim(),
        cfdiUse: String(values.cfdiUse || '').trim().toUpperCase(),
        email: String(values.recipientEmail || '').trim()
      },
      paymentMethod: String(values.paymentMethod || '').trim(),
      paymentForm: String(values.paymentForm || '').trim(),
      concepts: concepts.slice(0, count),
      notes: String(values.notes || '').trim(),
      uuid: previous?.uuid || '',
      stampedAt: previous?.stampedAt || '',
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const index = state.cfdiRecords.findIndex(item => item.orderId === order.id);
    if (index >= 0) state.cfdiRecords[index] = record; else state.cfdiRecords.push(record);
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
    const record = cfdiRecordFor(orderId);
    if (!order || !record) return;
    const totals = typeof documentTotals === 'function' ? documentTotals(order) : {};
    const payload = {
      format: 'mooreprint-cfdi-preparation',
      version: 1,
      warning: 'Este archivo no es un CFDI, no es XML timbrado y no tiene validez fiscal. Debe revisarse y procesarse mediante el SAT o un PAC autorizado.',
      generatedAt: new Date().toISOString(),
      issuer: {
        name: state.business.cfdi.fiscalName,
        rfc: state.business.rfc || '',
        fiscalPostalCode: state.business.cfdi.fiscalPostalCode,
        fiscalRegime: state.business.cfdi.fiscalRegime,
        series: state.business.cfdi.series,
        pacName: state.business.cfdi.pacName
      },
      recipient: record.recipient,
      document: {
        orderId: order.id,
        folio: order.folio,
        date: order.orderDate,
        paymentMethod: record.paymentMethod,
        paymentForm: record.paymentForm,
        concepts: record.concepts,
        subtotal: numberValue(totals.subtotal),
        discount: numberValue(totals.discount),
        tax: numberValue(totals.tax),
        total: numberValue(totals.total),
        notes: record.notes
      },
      control: {
        status: record.status,
        uuid: record.uuid || '',
        stampedAt: record.stampedAt || ''
      }
    };
    downloadJson(payload, `cfdi-preparacion-${String(order.folio || order.id).replace(/[^a-z0-9_-]+/gi, '-')}.json`);
    window.showToast?.('Expediente fiscal descargado');
  }

  function markCfdiSent(orderId) {
    const record = cfdiRecordFor(orderId);
    if (!record) return;
    record.status = 'enviado';
    record.sentAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    saveState('Expediente marcado como enviado');
  }

  function openCfdiStamp(orderId) {
    const order = state.orders.find(item => item.id === orderId);
    const record = cfdiRecordFor(orderId);
    if (!order || !record) return;
    openModal(`Registrar timbrado · ${order.folio || order.id}`, `<form id="cfdiStampForm" class="modal-form"><input type="hidden" name="orderId" value="${escapeHtml(orderId)}"><div class="cfdi-notice full"><strong>Registro manual:</strong> captura estos datos únicamente después de recibir el XML timbrado por el SAT o tu PAC.</div><label class="full">UUID fiscal<input name="uuid" required maxlength="36" value="${escapeHtml(record.uuid || '')}"></label><label>Fecha de timbrado<input name="stampedAt" type="datetime-local" required value="${escapeHtml(record.stampedAt ? record.stampedAt.slice(0, 16) : '')}"></label><label class="full">Referencia o nota<input name="stampNote" value="${escapeHtml(record.stampNote || '')}"></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="cfdiStampForm">Guardar timbrado</button>');
  }

  function saveCfdiStamp(form) {
    const values = Object.fromEntries(new FormData(form));
    const record = cfdiRecordFor(values.orderId);
    if (!record) return;
    record.uuid = String(values.uuid || '').trim().toUpperCase();
    record.stampedAt = String(values.stampedAt || '').trim();
    record.stampNote = String(values.stampNote || '').trim();
    record.status = 'timbrado';
    record.updatedAt = new Date().toISOString();
    closeModal(true);
    saveState('UUID fiscal registrado');
  }

  function saveCfdiSettings(form) {
    const values = Object.fromEntries(new FormData(form));
    state.business.rfc = String(values.rfc || '').trim().toUpperCase();
    state.business.cfdi = {
      ...state.business.cfdi,
      fiscalName: String(values.fiscalName || '').trim(),
      fiscalPostalCode: String(values.fiscalPostalCode || '').trim(),
      fiscalRegime: String(values.fiscalRegime || '').trim(),
      series: String(values.series || '').trim().toUpperCase(),
      defaultCfdiUse: String(values.defaultCfdiUse || '').trim().toUpperCase(),
      defaultPaymentMethod: String(values.defaultPaymentMethod || '').trim(),
      defaultPaymentForm: String(values.defaultPaymentForm || '').trim(),
      defaultProductServiceKey: String(values.defaultProductServiceKey || '').trim(),
      defaultUnitKey: String(values.defaultUnitKey || '').trim().toUpperCase(),
      defaultTaxObject: String(values.defaultTaxObject || '').trim(),
      pacName: String(values.pacName || '').trim()
    };
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

  function installEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'enableBrowserNotifications') requestNotificationPermission();
      if (target.id === 'refreshAutomaticAlerts') {
        renderAlerts();
        dispatchBrowserNotifications();
        window.showToast?.('Avisos actualizados');
      }
      if (target.dataset.cfdiPrepare) openCfdiPreparation(target.dataset.cfdiPrepare);
      if (target.dataset.cfdiExport) exportCfdiRecord(target.dataset.cfdiExport);
      if (target.dataset.cfdiSend) markCfdiSent(target.dataset.cfdiSend);
      if (target.dataset.cfdiStamp) openCfdiStamp(target.dataset.cfdiStamp);
    });

    document.addEventListener('change', event => {
      const settingsMap = {
        notificationOrders: 'orders',
        notificationCollections: 'collections',
        notificationInventory: 'inventory',
        notificationExpenses: 'expenses'
      };
      const key = settingsMap[event.target?.id];
      if (key) {
        state.notificationSettings[key] = Boolean(event.target.checked);
        saveState('Preferencias de avisos guardadas');
      }
      if (event.target?.id === 'notificationDaysAhead') {
        state.notificationSettings.daysAhead = Math.max(0, Math.min(14, Number(event.target.value) || 0));
        saveState('Anticipación de avisos actualizada');
      }
    });

    document.addEventListener('input', event => {
      if (event.target?.id === 'helpSearch') renderHelp(event.target.value);
    });

    document.addEventListener('submit', event => {
      if (event.target?.id === 'cfdiSettingsForm') {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveCfdiSettings(event.target);
      }
      if (event.target?.id === 'cfdiPreparationForm') {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveCfdiPreparation(event.target);
      }
      if (event.target?.id === 'cfdiStampForm') {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveCfdiStamp(event.target);
      }
    }, true);

    window.addEventListener('focus', () => {
      renderAlerts();
      dispatchBrowserNotifications();
      applyRoleVisibility();
    }, { passive: true });

    window.addEventListener('online', () => {
      renderAlerts();
      dispatchBrowserNotifications();
    }, { passive: true });
  }

  function wrapRendering() {
    if (window.__mooreprintBusinessAssistantRenderWrapped) return;
    const baseRenderAll = renderAll;
    renderAll = function (...args) {
      normalizeModuleState();
      const result = baseRenderAll(...args);
      renderAlerts();
      renderCfdi();
      renderCfdiSettings();
      return result;
    };
    window.renderAll = renderAll;
    window.__mooreprintBusinessAssistantRenderWrapped = true;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    normalizeModuleState();
    injectInterface();
    wrapRendering();
    installEvents();
    renderHelp();
    renderAlerts();
    renderCfdi();
    renderCfdiSettings();
    applyRoleVisibility();
    setTimeout(() => {
      renderAlerts();
      dispatchBrowserNotifications();
      applyRoleVisibility();
    }, 2200);
    setInterval(() => {
      renderAlerts();
      dispatchBrowserNotifications();
      applyRoleVisibility();
    }, 15 * 60 * 1000);
    const roleTimer = setInterval(applyRoleVisibility, 400);
    setTimeout(() => clearInterval(roleTimer), 20000);
  }

  window.MoorePrintBusinessAssistant = {
    init,
    renderAlerts,
    renderCfdi,
    dispatchBrowserNotifications
  };

  init();
})();