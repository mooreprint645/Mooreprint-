(function () {
  const SECTION_META = {
    dashboard: { title: 'Resumen', hint: 'Lo más importante del negocio, en un solo lugar.', help: ['Revisa ventas, ganancia y dinero pendiente.', 'Atiende primero las alertas y entregas cercanas.', 'Usa los accesos rápidos para registrar movimientos.'] },
    orders: { title: 'Pedidos', hint: 'Registra trabajos, fechas de entrega, pagos y estado de producción.', help: ['Pulsa “Nuevo pedido” y completa los pasos.', 'Agrega el trabajo, cantidad, precio y costo interno.', 'Actualiza el estado hasta marcarlo como entregado.'] },
    production: { title: 'Producción', hint: 'Mueve cada pedido según la etapa en la que se encuentra.', help: ['Busca el pedido o filtra por responsable.', 'Arrastra la tarjeta a la siguiente columna.', 'Antes de producir, confirma que el diseño esté aprobado.'] },
    calendar: { title: 'Calendario', hint: 'Consulta entregas, cobros y gastos próximos.', help: ['Los pedidos aparecen en su fecha prometida.', 'Los gastos pendientes se muestran en rojo.', 'Pulsa un evento para abrir el registro relacionado.'] },
    quotes: { title: 'Cotizaciones', hint: 'Prepara presupuestos y conviértelos en pedidos.', help: ['Agrega cliente y conceptos.', 'Revisa el total y la vigencia.', 'Cuando el cliente acepte, conviértela en pedido.'] },
    customers: { title: 'Clientes', hint: 'Consulta datos, historial de pedidos y saldos.', help: ['Registra nombre y medio de contacto.', 'Abre el historial para revisar compras y adeudos.', 'Usa el cliente registrado al crear pedidos.'] },
    products: { title: 'Productos y costos', hint: 'Define cuánto cuesta producir y cuánto ganas por pieza.', help: ['Registra el precio de venta.', 'Agrega materiales y costos del proceso.', 'Revisa que el margen no sea demasiado bajo.'] },
    calculator: { title: 'Calculadora', hint: 'Calcula un precio rentable antes de cotizar.', help: ['Escribe todos los costos por unidad.', 'Elige el margen de ganancia deseado.', 'Guarda el resultado como producto para reutilizarlo.'] },
    inventory: { title: 'Inventario', hint: 'Controla materiales, existencias mínimas y movimientos.', help: ['Registra cada material y su costo.', 'Define una existencia mínima para recibir alertas.', 'Las compras aumentan y los pedidos descuentan inventario.'] },
    suppliers: { title: 'Proveedores', hint: 'Guarda contactos, productos y compras de cada proveedor.', help: ['Registra los datos del proveedor.', 'Vincúlalo con los materiales que vende.', 'Consulta sus compras y saldos pendientes.'] },
    purchases: { title: 'Compras', hint: 'Registra entradas de material y pagos a proveedores.', help: ['Selecciona proveedor y materiales.', 'Indica cantidad y costo unitario.', 'Registra pagos parciales hasta liquidar la compra.'] },
    waste: { title: 'Mermas', hint: 'Mide pérdidas por errores, roturas o material defectuoso.', help: ['Selecciona el material desperdiciado.', 'Indica cantidad y motivo.', 'El sistema descontará inventario y calculará la pérdida.'] },
    expenses: { title: 'Gastos', hint: 'Registra renta, pasajes, gasolina, servicios y otros pagos.', help: ['Elige una categoría fácil de reconocer.', 'Indica vencimiento si todavía no se paga.', 'Registra pagos parciales o totales.'] },
    recurring: { title: 'Gastos recurrentes', hint: 'Automatiza renta, internet, sueldos y pagos mensuales.', help: ['Crea el gasto una sola vez.', 'Actívalo para que se genere cada mes.', 'Revisa y paga el gasto desde la sección Gastos.'] },
    cash: { title: 'Caja y pagos', hint: 'Consulta entradas, salidas y saldo disponible.', help: ['Los cobros de pedidos entran automáticamente.', 'Las compras y gastos pagados aparecen como salidas.', 'Usa el corte para revisar el movimiento del día.'] },
    reports: { title: 'Reportes', hint: 'Analiza ventas, costos, utilidad y tendencias.', help: ['Selecciona el rango de fechas.', 'Compara ventas y utilidad.', 'Exporta los datos cuando necesites revisarlos en Excel.'] },
    activity: { title: 'Actividad', hint: 'Revisa los cambios realizados en la aplicación.', help: ['Busca por pedido, pago o movimiento.', 'Comprueba cuándo se cambió una etapa.', 'Con Supabase, este historial ayudará a controlar usuarios.'] },
    settings: { title: 'Configuración', hint: 'Personaliza el negocio, respaldos, instalación y conexión.', help: ['Completa los datos que aparecerán en notas.', 'Descarga un respaldo con frecuencia.', 'Conecta Supabase cuando tengas la URL y clave pública.'] }
  };

  const NAV_GROUPS = [
    { id: 'daily', label: 'Trabajo diario', sections: ['dashboard','orders','production','calendar'] },
    { id: 'sales', label: 'Ventas', sections: ['quotes','customers','products','calculator'] },
    { id: 'operation', label: 'Materiales y compras', sections: ['inventory','suppliers','purchases','waste'] },
    { id: 'finance', label: 'Dinero', sections: ['expenses','recurring','cash','reports'] },
    { id: 'system', label: 'Sistema', sections: ['activity','settings'] }
  ];

  const QUICK_ACTIONS = [
    { id: 'order', icon: '🧾', title: 'Nuevo pedido', detail: 'Trabajo y fecha de entrega' },
    { id: 'quote', icon: '📝', title: 'Nueva cotización', detail: 'Presupuesto para cliente' },
    { id: 'payment', icon: '💰', title: 'Registrar cobro', detail: 'Pago de un pedido' },
    { id: 'expense', icon: '💸', title: 'Nuevo gasto', detail: 'Renta, pasaje o servicio' },
    { id: 'purchase', icon: '🛒', title: 'Nueva compra', detail: 'Entrada de materiales' },
    { id: 'production', icon: '🖨️', title: 'Ver producción', detail: 'Trabajos en proceso' }
  ];

  let initialized = false;
  let currentSearchResults = [];
  let enhanceTimer = null;

  const html = value => typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function waitForApplication() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = typeof navigate === 'function' && typeof state !== 'undefined' && document.querySelector('.nav-item[data-section="orders"]') && document.querySelector('#production');
      if (ready || attempts > 150) {
        clearInterval(timer);
        if (ready) initialize();
      }
    }, 80);
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    groupNavigation();
    injectTopbarTools();
    injectDashboardGuide();
    injectCommandPalette();
    injectQuickMenu();
    injectMobileNavigation();
    improveEmptyStates();
    wrapNavigation();
    wrapDocumentModals();
    bindEvents();
    observeInterface();
    enhanceInterface();
    updateContext(document.querySelector('.nav-item.active')?.dataset.section || 'dashboard');
  }

  function groupNavigation() {
    const nav = document.querySelector('.nav-list');
    if (!nav || nav.querySelector('.nav-group')) return;
    NAV_GROUPS.forEach((group, index) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'nav-group';
      wrapper.dataset.group = group.id;
      const collapsed = localStorage.getItem(`mooreprint-nav-${group.id}`) === 'collapsed';
      if (collapsed && index > 0) wrapper.classList.add('collapsed');
      wrapper.innerHTML = `<button class="nav-group-title" type="button" aria-expanded="${!wrapper.classList.contains('collapsed')}">${group.label}</button><div class="nav-group-items"></div>`;
      const items = wrapper.querySelector('.nav-group-items');
      group.sections.forEach(section => {
        const button = nav.querySelector(`.nav-item[data-section="${section}"]`);
        if (button) items.appendChild(button);
      });
      if (items.children.length) nav.appendChild(wrapper);
    });
    const remaining = [...nav.querySelectorAll(':scope > .nav-item')];
    if (remaining.length) {
      const extra = document.createElement('section');
      extra.className = 'nav-group';
      extra.dataset.group = 'extra';
      extra.innerHTML = '<button class="nav-group-title" type="button" aria-expanded="true">Más herramientas</button><div class="nav-group-items"></div>';
      remaining.forEach(button => extra.querySelector('.nav-group-items').appendChild(button));
      nav.appendChild(extra);
    }
    const footer = document.querySelector('.sidebar-footer');
    if (footer && !footer.querySelector('.sidebar-tip')) footer.insertAdjacentHTML('afterbegin','<div class="sidebar-tip"><strong>Consejo</strong>Empieza con un pedido y registra los pagos conforme los recibas.</div>');
  }

  function injectTopbarTools() {
    const actions = document.querySelector('.topbar-actions');
    const copy = document.querySelector('.topbar-copy');
    if (copy && !document.querySelector('#pageContext')) copy.insertAdjacentHTML('beforeend','<span class="page-context" id="pageContext"></span>');
    if (!actions) return;
    if (!document.querySelector('#uxConnectionStatus')) actions.insertAdjacentHTML('afterbegin','<span class="ux-status-pill" id="uxConnectionStatus"><span class="ux-status-dot"></span><span>Modo local</span></span>');
    if (!document.querySelector('#uxSearchButton')) actions.insertAdjacentHTML('afterbegin','<button class="button secondary ux-search-button" id="uxSearchButton" type="button"><span>⌕</span><span class="ux-search-text">Buscar en MoorePrint</span><span class="ux-search-shortcut">Ctrl K</span></button>');
    if (!document.querySelector('#uxHelpButton')) actions.insertAdjacentHTML('beforeend','<button class="button secondary" id="uxHelpButton" type="button" aria-label="Ayuda de esta sección">?</button>');
    updateConnectionStatus();
  }

  function injectDashboardGuide() {
    const dashboard = document.querySelector('#dashboard');
    const metrics = dashboard?.querySelector('.metrics-grid');
    if (!dashboard || !metrics || document.querySelector('#uxDashboardGuide')) return;
    metrics.insertAdjacentHTML('afterend', `<div class="ux-dashboard-grid" id="uxDashboardGuide"><article class="ux-quick-panel"><div class="ux-panel-heading"><div><h2>¿Qué necesitas hacer?</h2><p>Accesos directos a las tareas más comunes.</p></div><button class="text-button" type="button" data-ux-open-search>Buscar</button></div><div class="ux-quick-grid">${QUICK_ACTIONS.map(action => `<button class="ux-quick-action" type="button" data-ux-action="${action.id}"><span class="ux-quick-icon">${action.icon}</span><span><strong>${action.title}</strong><small>${action.detail}</small></span></button>`).join('')}</div></article><article class="ux-onboarding" id="uxOnboarding"></article></div>`);
    renderOnboarding();
  }

  function onboardingTasks() {
    const businessReady = Boolean(state.business?.phone || state.business?.address || state.business?.email);
    const backupDate = localStorage.getItem('mooreprint-last-backup');
    return [
      { label: 'Completa los datos del negocio', done: businessReady, action: 'settings' },
      { label: 'Registra al menos un cliente', done: state.customers.length > 0, action: 'customer' },
      { label: 'Agrega materiales o productos', done: state.materials.length > 0 || state.products.length > 0, action: 'product' },
      { label: 'Crea tu primer pedido', done: state.orders.length > 0, action: 'order' },
      { label: 'Descarga un respaldo', done: Boolean(backupDate), action: 'backup' }
    ];
  }

  function renderOnboarding() {
    const container = document.querySelector('#uxOnboarding');
    if (!container) return;
    const hidden = localStorage.getItem('mooreprint-onboarding-hidden') === '1';
    if (hidden) {
      container.innerHTML = '<div class="ux-panel-heading"><div><h2>Guía inicial oculta</h2><p>Puedes volver a mostrarla cuando la necesites.</p></div></div><button class="button secondary" type="button" data-ux-show-onboarding>Mostrar guía</button>';
      return;
    }
    const tasks = onboardingTasks();
    const completed = tasks.filter(task => task.done).length;
    const percent = Math.round(completed / tasks.length * 100);
    container.innerHTML = `<div class="ux-panel-heading"><div><h2>Configura MoorePrint</h2><p>${completed === tasks.length ? 'Todo listo para trabajar.' : 'Completa estos pasos una sola vez.'}</p></div><button class="text-button" type="button" data-ux-hide-onboarding>Ocultar</button></div><div class="ux-onboarding-progress"><div class="ux-progress-ring" style="--progress:${percent}%"><strong>${percent}%</strong></div><div><strong>${completed} de ${tasks.length}</strong><small style="display:block;color:#8f8f8a;margin-top:3px">pasos completados</small></div></div><div class="ux-checklist">${tasks.map(task => `<div class="ux-check-item ${task.done ? 'done' : ''}"><span class="ux-check-mark">${task.done ? '✓' : '•'}</span><span>${html(task.label)}</span>${task.done ? '' : `<button type="button" data-ux-action="${task.action}">Hacer</button>`}</div>`).join('')}</div>`;
  }

  function injectCommandPalette() {
    if (document.querySelector('#uxSearchOverlay')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="ux-overlay" id="uxSearchOverlay" hidden><div class="ux-command" role="dialog" aria-modal="true" aria-label="Buscar en MoorePrint"><div class="ux-command-input"><span>⌕</span><input id="uxGlobalSearch" type="search" autocomplete="off" placeholder="Busca pedidos, clientes, productos, cotizaciones o materiales"><button class="ux-command-close" type="button" data-ux-close-search>×</button></div><div class="ux-search-results" id="uxSearchResults"></div></div></div>`);
  }

  function injectQuickMenu() {
    if (document.querySelector('#uxQuickButton')) return;
    document.body.insertAdjacentHTML('beforeend', `<button class="ux-fab" id="uxQuickButton" type="button" aria-label="Abrir acciones rápidas">+</button><div class="ux-quick-sheet" id="uxQuickSheet" hidden><div class="ux-sheet-title"><strong>Registrar rápidamente</strong><button class="ux-command-close" type="button" data-ux-close-sheet>×</button></div>${QUICK_ACTIONS.slice(0,5).map(action => `<button class="ux-sheet-action" type="button" data-ux-action="${action.id}"><span>${action.icon}</span><div><strong>${action.title}</strong><small>${action.detail}</small></div></button>`).join('')}</div>`);
  }

  function injectMobileNavigation() {
    if (document.querySelector('#uxMobileNav')) return;
    document.body.insertAdjacentHTML('beforeend', `<nav class="ux-mobile-nav" id="uxMobileNav" aria-label="Accesos principales"><button type="button" data-ux-nav="dashboard"><span>⌂</span>Inicio</button><button type="button" data-ux-nav="orders"><span>🧾</span>Pedidos</button><button class="ux-mobile-add" type="button" data-ux-mobile-add><span>+</span>Nuevo</button><button type="button" data-ux-nav="production"><span>🖨️</span>Producción</button><button type="button" data-ux-more><span>☰</span>Más</button></nav>`);
  }

  function improveEmptyStates() {
    const actions = {
      ordersEmpty: ['Crear primer pedido','order'], quotesEmpty: ['Crear cotización','quote'], customersEmpty: ['Registrar cliente','customer'],
      productsEmpty: ['Agregar producto','product'], materialsEmpty: ['Agregar material','material'], suppliersEmpty: ['Registrar proveedor','supplier'],
      purchasesEmpty: ['Registrar compra','purchase'], expensesEmpty: ['Registrar gasto','expense'], wasteEmpty: ['Registrar merma','waste']
    };
    Object.entries(actions).forEach(([id,[label,action]]) => {
      const empty = document.getElementById(id);
      if (empty && !empty.querySelector('.ux-empty-action')) empty.insertAdjacentHTML('beforeend', `<button class="button primary ux-empty-action" type="button" data-ux-action="${action}">${label}</button>`);
    });
  }

  function wrapNavigation() {
    if (window.__mooreprintUxNavigateWrapped) return;
    window.__mooreprintUxNavigateWrapped = true;
    const original = navigate;
    const wrapped = function (section) {
      original(section);
      updateContext(section);
      setTimeout(enhanceInterface, 0);
      try { history.replaceState(null, '', `${location.pathname}${location.search}#${section}`); } catch (error) {}
    };
    window.navigate = wrapped;
    try { navigate = wrapped; } catch (error) {}
  }

  function updateContext(section) {
    const meta = SECTION_META[section] || { title: 'MoorePrint', hint: 'Control administrativo de la imprenta.' };
    const context = document.querySelector('#pageContext');
    if (context) context.textContent = meta.hint;
    document.title = `${meta.title} | MoorePrint`;
    document.querySelectorAll('#uxMobileNav [data-ux-nav]').forEach(button => button.classList.toggle('active', button.dataset.uxNav === section));
    const group = document.querySelector(`.nav-item[data-section="${section}"]`)?.closest('.nav-group');
    if (group?.classList.contains('collapsed')) toggleNavGroup(group, false);
  }

  function toggleNavGroup(group, forceCollapsed = null) {
    const collapsed = forceCollapsed === null ? !group.classList.contains('collapsed') : forceCollapsed;
    group.classList.toggle('collapsed', collapsed);
    group.querySelector('.nav-group-title')?.setAttribute('aria-expanded', String(!collapsed));
    localStorage.setItem(`mooreprint-nav-${group.dataset.group}`, collapsed ? 'collapsed' : 'open');
  }

  function performAction(action) {
    closeQuickMenus();
    if (action === 'order') { navigate('orders'); openOrderModal(); }
    else if (action === 'quote') { navigate('quotes'); openQuoteModal(); }
    else if (action === 'customer') { navigate('customers'); openCustomerModal(); }
    else if (action === 'product') { navigate('products'); openProductModal(); }
    else if (action === 'material') { navigate('inventory'); openMaterialModal(); }
    else if (action === 'supplier') { navigate('suppliers'); openSupplierModal(); }
    else if (action === 'purchase') { navigate('purchases'); openPurchaseModal(); }
    else if (action === 'expense') { navigate('expenses'); openExpenseModal(); }
    else if (action === 'waste') { navigate('waste'); document.querySelector('#newWasteButton')?.click(); }
    else if (action === 'production') navigate('production');
    else if (action === 'settings') navigate('settings');
    else if (action === 'payment') {
      const pending = state.orders.filter(order => order.status !== 'cancelado' && documentTotals(order).balance > 0).sort((a,b) => documentTotals(b).balance - documentTotals(a).balance);
      if (pending.length === 1) openPaymentModal('order', pending[0].id);
      else { navigate('cash'); showToast(pending.length ? 'Selecciona el pedido que deseas cobrar' : 'No hay cobros pendientes', pending.length ? 'normal' : 'warning'); }
    }
    else if (action === 'backup') document.querySelector('#backupButton')?.click();
  }

  function closeQuickMenus() {
    const sheet = document.querySelector('#uxQuickSheet');
    if (sheet) sheet.hidden = true;
  }

  function buildSearchResults(query) {
    const normalized = query.trim().toLowerCase();
    const rows = [];
    const match = value => !normalized || String(value || '').toLowerCase().includes(normalized);
    state.orders.forEach(order => {
      const text = `${order.folio} ${order.customer} ${(order.items || []).map(item => item.name).join(' ')}`;
      if (match(text)) rows.push({ icon:'🧾', type:'Pedido', title:`${order.folio} · ${order.customer || entityName(state.customers,order.customerId)}`, detail:`${statusName(order.status)} · Entrega ${formatDate(order.dueDate)}`, section:'orders', open:() => openOrderModal(order.id) });
    });
    state.quotes.forEach(quote => { if (match(`${quote.folio} ${quote.customer}`)) rows.push({ icon:'📝', type:'Cotización', title:`${quote.folio} · ${quote.customer}`, detail:`${statusName(quote.status)} · ${money(documentTotals(quote).total)}`, section:'quotes', open:() => openQuoteModal(quote.id) }); });
    state.customers.forEach(customer => { if (match(`${customer.name} ${customer.phone} ${customer.email}`)) rows.push({ icon:'👥', type:'Cliente', title:customer.name, detail:customer.phone || customer.email || 'Sin contacto', section:'customers', open:() => openCustomerHistory(customer.id) }); });
    state.products.forEach(product => { if (match(`${product.name} ${product.category}`)) rows.push({ icon:'🏷️', type:'Producto', title:product.name, detail:`Venta ${money(product.salePrice)} · Ganas ${money(productBreakdown(product).profit)}`, section:'products', open:() => openProductModal(product.id) }); });
    state.materials.forEach(material => { if (match(`${material.name} ${material.category} ${material.sku}`)) rows.push({ icon:'📦', type:'Material', title:material.name, detail:`Existencia ${num(material.stock).toFixed(2)} ${material.unit || ''}`, section:'inventory', open:() => openMaterialModal(material.id) }); });
    return rows.slice(0, 35);
  }

  function renderSearchResults(query = '') {
    const container = document.querySelector('#uxSearchResults');
    if (!container) return;
    currentSearchResults = buildSearchResults(query);
    if (!currentSearchResults.length) {
      container.innerHTML = '<div class="ux-search-empty"><div style="font-size:32px">⌕</div><strong>No encontramos resultados</strong><p>Prueba con el nombre del cliente, folio o producto.</p></div>';
      return;
    }
    container.innerHTML = currentSearchResults.map((result,index) => `<button class="ux-result ${index === 0 ? 'active' : ''}" type="button" data-ux-result="${index}"><span class="ux-result-icon">${result.icon}</span><span><strong>${html(result.title)}</strong><small>${html(result.detail)}</small></span><span class="ux-result-type">${result.type}</span></button>`).join('');
  }

  function openSearch() {
    const overlay = document.querySelector('#uxSearchOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    const input = document.querySelector('#uxGlobalSearch');
    input.value = '';
    renderSearchResults('');
    setTimeout(() => input.focus(), 20);
  }

  function closeSearch() {
    const overlay = document.querySelector('#uxSearchOverlay');
    if (overlay) overlay.hidden = true;
  }

  function openSearchResult(index) {
    const result = currentSearchResults[index];
    if (!result) return;
    closeSearch();
    navigate(result.section);
    setTimeout(result.open, 40);
  }

  function showHelp() {
    const section = document.querySelector('.page-section.active')?.id || 'dashboard';
    const meta = SECTION_META[section] || SECTION_META.dashboard;
    const body = `<div class="ux-help-card"><h3>${html(meta.title)}</h3><p>${html(meta.hint)}</p><div class="ux-help-steps">${meta.help.map(step => `<div class="ux-help-step"><span>${html(step)}</span></div>`).join('')}</div></div>`;
    openModal(`Cómo usar ${meta.title}`, body, '<button class="button primary" data-close-modal>Entendido</button>');
  }

  function wrapDocumentModals() {
    if (window.__mooreprintUxModalsWrapped) return;
    window.__mooreprintUxModalsWrapped = true;
    const baseOrder = openOrderModal;
    const orderWrapped = function (...args) { baseOrder(...args); enhanceOrderForm(); };
    window.openOrderModal = orderWrapped;
    try { openOrderModal = orderWrapped; } catch (error) {}

    const baseQuote = openQuoteModal;
    const quoteWrapped = function (...args) { baseQuote(...args); enhanceQuoteForm(); };
    window.openQuoteModal = quoteWrapped;
    try { openQuoteModal = quoteWrapped; } catch (error) {}
  }

  function addFieldHelp(form, fieldName, text) {
    const field = form.elements[fieldName];
    const label = field?.closest('label');
    if (label && !label.querySelector('.field-help')) label.insertAdjacentHTML('beforeend', `<small class="field-help">${html(text)}</small>`);
  }

  function addUnsavedIndicator(form) {
    const modal = form.closest('.modal');
    const header = modal?.querySelector('.modal-header');
    if (header && !header.querySelector('.ux-unsaved')) header.insertAdjacentHTML('beforeend','<span class="ux-unsaved">Cambios sin guardar</span>');
    form.addEventListener('input', () => modal?.classList.add('has-unsaved'));
    form.addEventListener('change', () => modal?.classList.add('has-unsaved'));
  }

  function makeAdvancedTrackingSimple(form) {
    const firstSection = form.querySelector('.form-section');
    const grid = firstSection?.querySelector('.modal-form');
    if (!grid || grid.querySelector('.ux-advanced-fields')) return;
    const names = ['responsible','actualDelivery','priority','status','designStatus'];
    const labels = names.map(name => form.elements[name]?.closest('label')).filter(Boolean);
    if (!labels.length) return;
    const shouldOpen = Boolean(form.elements.responsible?.value || form.elements.actualDelivery?.value || form.elements.priority?.value !== 'normal' || form.elements.status?.value !== 'pendiente' || !['pendiente',''].includes(form.elements.designStatus?.value));
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ux-advanced-toggle';
    toggle.dataset.uxAdvancedToggle = 'tracking';
    toggle.textContent = `${shouldOpen ? 'Ocultar' : 'Mostrar'} opciones de seguimiento`;
    const fields = document.createElement('div');
    fields.className = `modal-form ux-advanced-fields${shouldOpen ? '' : ' collapsed'}`;
    fields.dataset.uxAdvancedFields = 'tracking';
    labels.forEach(label => fields.appendChild(label));
    grid.insertAdjacentElement('afterend', toggle);
    toggle.insertAdjacentElement('afterend', fields);
  }

  function enhanceOrderForm() {
    const form = document.querySelector('#orderForm');
    if (!form || form.dataset.uxEnhanced) return;
    form.dataset.uxEnhanced = 'true';
    makeAdvancedTrackingSimple(form);
    addFieldHelp(form,'customer','Nombre que aparecerá en la nota del cliente.');
    addFieldHelp(form,'dueDate','Fecha que prometiste al cliente.');
    addFieldHelp(form,'deliveryCharge','Lo que pagarás o cobrarás al cliente por entrega.');
    addFieldHelp(form,'deliveryCost','Lo que realmente te cuesta realizar la entrega.');
    addUnsavedIndicator(form);

    const sections = [...form.children].filter(element => element.classList.contains('form-section'));
    const attachment = form.querySelector('.attachment-box');
    if (sections.length < 3) return;
    const guide = document.createElement('div');
    guide.className = 'ux-form-guide';
    guide.innerHTML = ['Cliente','Trabajo','Precio','Diseño'].map((label,index) => `<button class="ux-form-step ${index === 0 ? 'active' : ''}" type="button" data-ux-form-step="${index}"><span class="number">${index+1}</span><span>${label}</span></button>`).join('');
    sections[0].insertAdjacentElement('beforebegin', guide);
    sections[0].classList.add('ux-step-section'); sections[0].dataset.uxStep = '0';
    sections[1].classList.add('ux-step-section'); sections[1].dataset.uxStep = '1';
    sections[2].classList.add('ux-step-section'); sections[2].dataset.uxStep = '2';
    sections.slice(3).forEach(section => { section.classList.add('ux-step-section'); section.dataset.uxStep = '3'; });
    if (attachment) { attachment.classList.add('ux-step-section'); attachment.dataset.uxStep = '3'; }
    const summary = form.querySelector('.summary-box');
    const navigation = document.createElement('div');
    navigation.className = 'ux-form-navigation';
    navigation.innerHTML = '<button class="button secondary" type="button" data-ux-step-back>← Anterior</button><small>Completa la información paso a paso.</small><button class="button primary" type="button" data-ux-step-next>Siguiente →</button>';
    summary?.insertAdjacentElement('beforebegin', navigation);
    form.dataset.currentStep = '0';
    setFormStep(form, 0);
  }

  function enhanceQuoteForm() {
    const form = document.querySelector('#quoteForm');
    if (!form || form.dataset.uxEnhanced) return;
    form.dataset.uxEnhanced = 'true';
    addFieldHelp(form,'validUntil','Último día en que respetarás estos precios.');
    addUnsavedIndicator(form);
    const sections = [...form.children].filter(element => element.classList.contains('form-section'));
    if (sections.length < 3) return;
    const guide = document.createElement('div');
    guide.className = 'ux-form-guide';
    guide.style.gridTemplateColumns = 'repeat(3,1fr)';
    guide.innerHTML = ['Cliente','Conceptos','Total'].map((label,index) => `<button class="ux-form-step ${index === 0 ? 'active' : ''}" type="button" data-ux-form-step="${index}"><span class="number">${index+1}</span><span>${label}</span></button>`).join('');
    sections[0].insertAdjacentElement('beforebegin', guide);
    sections.forEach((section,index) => { section.classList.add('ux-step-section'); section.dataset.uxStep = String(Math.min(index,2)); });
    const summary = form.querySelector('.summary-box');
    const navigation = document.createElement('div');
    navigation.className = 'ux-form-navigation';
    navigation.innerHTML = '<button class="button secondary" type="button" data-ux-step-back>← Anterior</button><small>Revisa cada paso antes de guardar.</small><button class="button primary" type="button" data-ux-step-next>Siguiente →</button>';
    summary?.insertAdjacentElement('beforebegin', navigation);
    form.dataset.currentStep = '0';
    setFormStep(form, 0);
  }

  function validateFormStep(form, step) {
    if (form.id === 'orderForm' && step === 0) {
      if (!form.elements.customer?.value.trim()) { form.elements.customer.focus(); showToast('Escribe el nombre del cliente', 'warning'); return false; }
      if (!form.elements.dueDate?.value) { form.elements.dueDate.focus(); showToast('Indica la fecha prometida', 'warning'); return false; }
    }
    if ((form.id === 'orderForm' || form.id === 'quoteForm') && step === 1) {
      const validLine = [...form.querySelectorAll('.document-line')].some(row => row.querySelector('.line-name')?.value.trim() || row.querySelector('.line-product')?.value);
      if (!validLine) { form.querySelector('.line-name')?.focus(); showToast('Agrega al menos un trabajo o producto', 'warning'); return false; }
    }
    return true;
  }

  function setFormStep(form, step) {
    const max = form.id === 'quoteForm' ? 2 : 3;
    const next = Math.max(0, Math.min(max, Number(step)));
    form.dataset.currentStep = String(next);
    form.querySelectorAll('.ux-step-section').forEach(section => { section.hidden = Number(section.dataset.uxStep) !== next; });
    form.querySelectorAll('.ux-form-step').forEach((button,index) => {
      button.classList.toggle('active', index === next);
      button.classList.toggle('done', index < next);
    });
    const back = form.querySelector('[data-ux-step-back]');
    const forward = form.querySelector('[data-ux-step-next]');
    if (back) back.disabled = next === 0;
    if (forward) { forward.disabled = next === max; forward.textContent = next === max ? 'Último paso' : 'Siguiente →'; }
    form.querySelector('.ux-form-guide')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function enhanceTables() {
    document.querySelectorAll('.table-wrap table').forEach(table => {
      const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row => [...row.children].forEach((cell,index) => { if (cell.tagName === 'TD') cell.dataset.label = labels[index] || ''; }));
    });
  }

  function enhanceActionButtons() {
    document.querySelectorAll('.action-button').forEach(button => {
      let label = button.getAttribute('title');
      if (!label) {
        const key = Object.keys(button.dataset)[0] || '';
        label = key.includes('edit') ? 'Editar' : key.includes('delete') ? 'Eliminar' : key.includes('pay') ? 'Registrar pago' : key.includes('view') ? 'Ver detalle' : key.includes('download') ? 'Descargar' : key.includes('adjust') ? 'Ajustar' : 'Acción';
      }
      button.dataset.uxLabel = label;
      button.setAttribute('aria-label', label);
    });
  }

  function enhanceInterface() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(() => {
      enhanceTables();
      enhanceActionButtons();
      improveEmptyStates();
      renderOnboarding();
      updateConnectionStatus();
    }, 30);
  }

  function updateConnectionStatus() {
    const pill = document.querySelector('#uxConnectionStatus');
    if (!pill) return;
    const online = navigator.onLine;
    pill.classList.toggle('online', online);
    const cloudConfigured = Boolean(window.MoorePrintCloud?.isConfigured?.());
    pill.querySelector('span:last-child').textContent = !online ? 'Sin conexión' : cloudConfigured ? 'Nube disponible' : 'Modo local';
  }

  function observeInterface() {
    const target = document.querySelector('.main-content');
    if (!target) return;
    const observer = new MutationObserver(() => enhanceInterface());
    observer.observe(target, { childList:true, subtree:true });
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.classList.contains('nav-group-title')) toggleNavGroup(target.closest('.nav-group'));
      if (target.id === 'uxSearchButton' || target.dataset.uxOpenSearch !== undefined) openSearch();
      if (target.dataset.uxCloseSearch !== undefined) closeSearch();
      if (target.dataset.uxResult !== undefined) openSearchResult(Number(target.dataset.uxResult));
      if (target.id === 'uxHelpButton') showHelp();
      if (target.id === 'uxQuickButton') document.querySelector('#uxQuickSheet').hidden = !document.querySelector('#uxQuickSheet').hidden;
      if (target.dataset.uxCloseSheet !== undefined) closeQuickMenus();
      if (target.dataset.uxAction) performAction(target.dataset.uxAction);
      if (target.dataset.uxNav) navigate(target.dataset.uxNav);
      if (target.dataset.uxMore !== undefined) document.querySelector('#sidebar')?.classList.add('open');
      if (target.dataset.uxMobileAdd !== undefined) document.querySelector('#uxQuickSheet').hidden = false;
      if (target.dataset.uxHideOnboarding !== undefined) { localStorage.setItem('mooreprint-onboarding-hidden','1'); renderOnboarding(); }
      if (target.dataset.uxShowOnboarding !== undefined) { localStorage.removeItem('mooreprint-onboarding-hidden'); renderOnboarding(); }
      if (target.dataset.uxAdvancedToggle) {
        const fields = document.querySelector(`[data-ux-advanced-fields="${target.dataset.uxAdvancedToggle}"]`);
        fields?.classList.toggle('collapsed');
        target.textContent = `${fields?.classList.contains('collapsed') ? 'Mostrar' : 'Ocultar'} opciones de seguimiento`;
      }
      if (target.dataset.uxFormStep !== undefined) setFormStep(target.closest('form'), Number(target.dataset.uxFormStep));
      if (target.dataset.uxStepBack !== undefined) { const form = target.closest('form'); setFormStep(form, Number(form.dataset.currentStep) - 1); }
      if (target.dataset.uxStepNext !== undefined) { const form = target.closest('form'); const current = Number(form.dataset.currentStep); if (validateFormStep(form,current)) setFormStep(form,current+1); }
    });

    document.querySelector('#uxGlobalSearch')?.addEventListener('input', event => renderSearchResults(event.target.value));
    document.querySelector('#uxSearchOverlay')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeSearch(); });
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
      if (event.key === 'Escape') { closeSearch(); closeQuickMenus(); }
      if (event.key === 'Enter' && !document.querySelector('#uxSearchOverlay')?.hidden && document.activeElement?.id === 'uxGlobalSearch') { event.preventDefault(); openSearchResult(0); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForApplication);
  else waitForApplication();
})();
