(function () {
  const STAGES = [
    { id: 'pending', label: 'Pendiente', icon: '📥' },
    { id: 'design', label: 'Diseño', icon: '🎨' },
    { id: 'approval', label: 'Aprobación', icon: '✅' },
    { id: 'production', label: 'Producción', icon: '🖨️' },
    { id: 'ready', label: 'Listo', icon: '📦' },
    { id: 'delivered', label: 'Entregado', icon: '🚚' }
  ];
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let installPrompt = null;
  let wrapped = false;

  function ensureAdvancedState() {
    state.activityLog = Array.isArray(state.activityLog) ? state.activityLog : [];
    state.wasteRecords = Array.isArray(state.wasteRecords) ? state.wasteRecords : [];
    state.goals = { sales: 30000, profit: 12000, orders: 80, ...(state.goals || {}) };
    state.business = {
      whatsapp: '', bank: '', clabe: '', depositPercent: 50, quoteValidity: 15,
      policies: 'El trabajo comienza al recibir el anticipo y la aprobación del diseño.',
      ...(state.business || {})
    };
    state.orders = (state.orders || []).map(order => ({
      designRevisions: 0, approvedBy: '', approvedAt: '', approvalNote: '', designChanges: '', clientApproved: false,
      ...order
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function addActivity(type, title, detail = '', referenceId = '') {
    state.activityLog.unshift({ id: uid('activity'), type, title, detail, referenceId, date: todayISO(), createdAt: new Date().toISOString() });
    state.activityLog = state.activityLog.slice(0, 1000);
  }

  function insertNav(section, icon, label, before = 'reports') {
    if (document.querySelector(`.nav-item[data-section="${section}"]`)) return;
    const anchor = document.querySelector(`.nav-item[data-section="${before}"]`) || document.querySelector('.nav-item[data-section="settings"]');
    anchor?.insertAdjacentHTML('beforebegin', `<button class="nav-item" data-section="${section}"><span>${icon}</span> ${label}</button>`);
  }

  function injectNavigationAndSections() {
    insertNav('production', '🗂️', 'Producción');
    insertNav('calendar', '📅', 'Calendario');
    insertNav('calculator', '🧮', 'Calculadora');
    insertNav('waste', '♻️', 'Mermas');
    insertNav('activity', '🕘', 'Actividad');

    const reports = document.querySelector('#reports');
    if (!document.querySelector('#production')) reports.insertAdjacentHTML('beforebegin', `
      <section class="page-section" id="production">
        <div class="advanced-toolbar"><div class="search-box"><span>⌕</span><input id="productionSearch" type="search" placeholder="Buscar pedido, cliente o trabajo"></div><select id="productionResponsible"><option value="all">Todos los responsables</option></select><button class="button primary" id="productionNewOrder">+ Nuevo pedido</button></div>
        <div class="production-board" id="productionBoard"></div>
      </section>`);

    if (!document.querySelector('#calendar')) reports.insertAdjacentHTML('beforebegin', `
      <section class="page-section" id="calendar">
        <div class="calendar-shell"><div class="calendar-header"><div><h2 id="calendarTitle"></h2><small>Pedidos, gastos y cobros próximos</small></div><div class="inline-actions"><button class="button secondary" data-calendar-prev>‹</button><button class="button secondary" data-calendar-today>Hoy</button><button class="button secondary" data-calendar-next>›</button></div></div><div class="calendar-weekdays"><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div></div><div class="calendar-grid" id="calendarGrid"></div></div>
      </section>`);

    if (!document.querySelector('#calculator')) reports.insertAdjacentHTML('beforebegin', `
      <section class="page-section" id="calculator">
        <div class="calculator-layout"><article class="panel"><div class="panel-header"><div><h2>Calculadora rápida de precios</h2><p>Obtén costo, precio mínimo y precio recomendado.</p></div></div><form id="quickCalculatorForm" class="calculator-form">
          <label>Nombre del trabajo<input name="name" placeholder="Ej. 20 tazas personalizadas"></label><label>Cantidad<input name="qty" type="number" min="1" step="1" value="1"></label>
          <label>Materiales por unidad<input name="materials" type="number" min="0" step="0.01" value="0"></label><label>Mano de obra por unidad<input name="labor" type="number" min="0" step="0.01" value="0"></label>
          <label>Diseño por unidad<input name="design" type="number" min="0" step="0.01" value="0"></label><label>Energía / gas por unidad<input name="energy" type="number" min="0" step="0.01" value="0"></label>
          <label>Empaque por unidad<input name="packaging" type="number" min="0" step="0.01" value="0"></label><label>Transporte por unidad<input name="transport" type="number" min="0" step="0.01" value="0"></label>
          <label>Trabajo externo por unidad<input name="external" type="number" min="0" step="0.01" value="0"></label><label>Otros costos por unidad<input name="extra" type="number" min="0" step="0.01" value="0"></label>
          <label>Desperdicio %<input name="waste" type="number" min="0" step="0.1" value="5"></label><label>Comisión de cobro %<input name="commission" type="number" min="0" max="40" step="0.1" value="0"></label>
          <label>Margen deseado %<input name="margin" type="number" min="1" max="90" step="0.1" value="40"></label><label>Descuento al cliente %<input name="discount" type="number" min="0" max="90" step="0.1" value="0"></label>
          <label>IVA %<input name="tax" type="number" min="0" step="0.1" value="0"></label><label>Costo fijo adicional<input name="fixed" type="number" min="0" step="0.01" value="0"></label>
        </form></article><article class="calculator-results"><h2>Resultado</h2><div class="calculator-result"><span>Costo por unidad</span><strong id="calcUnitCost">$0.00</strong></div><div class="calculator-result"><span>Precio mínimo</span><strong id="calcMinimum">$0.00</strong></div><div class="calculator-result highlight"><span>Precio recomendado</span><strong id="calcRecommended">$0.00</strong></div><div class="calculator-result"><span>Total al cliente</span><strong id="calcTotal">$0.00</strong></div><div class="calculator-result"><span>Ganancia total</span><strong id="calcProfit">$0.00</strong></div><div class="calculator-result"><span>Margen real</span><strong id="calcRealMargin">0%</strong></div><button class="button primary" type="button" id="calculatorCreateProduct">Crear producto con este cálculo</button></article></div>
      </section>`);

    if (!document.querySelector('#waste')) reports.insertAdjacentHTML('beforebegin', `
      <section class="page-section" id="waste"><div class="waste-summary"><article class="waste-card"><span>Pérdida del mes</span><strong id="wasteMonthTotal">$0.00</strong></article><article class="waste-card"><span>Registros del mes</span><strong id="wasteMonthCount">0</strong></article><article class="waste-card"><span>Mayor causa</span><strong id="wasteTopReason">—</strong></article></div><div class="advanced-toolbar"><div class="search-box"><span>⌕</span><input id="wasteSearch" type="search" placeholder="Buscar material, causa o pedido"></div><button class="button primary" id="newWasteButton">+ Registrar merma</button></div><article class="panel"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Material</th><th>Cantidad</th><th>Causa</th><th>Pedido</th><th>Pérdida</th><th>Notas</th><th>Acciones</th></tr></thead><tbody id="wasteTable"></tbody></table></div><div class="empty-state" id="wasteEmpty"><div>♻️</div><h3>No hay mermas registradas</h3><p>Registra errores, roturas, pruebas y material defectuoso.</p></div></article></section>`);

    if (!document.querySelector('#activity')) reports.insertAdjacentHTML('beforebegin', `
      <section class="page-section" id="activity"><div class="advanced-toolbar"><div class="search-box"><span>⌕</span><input id="activitySearch" type="search" placeholder="Buscar cambios, pagos o pedidos"></div><button class="button secondary" id="clearActivityButton">Limpiar historial</button></div><article class="panel"><div class="activity-list" id="activityList"></div></article></section>`);
  }

  function injectDashboardAndReports() {
    const dashboard = document.querySelector('#dashboard');
    if (dashboard && !document.querySelector('#goalsPanel')) dashboard.insertAdjacentHTML('beforeend', `<article class="panel" id="goalsPanel"><div class="panel-header"><div><h2>Metas del mes</h2><p id="goalsMonthLabel"></p></div><button class="button secondary" id="configureGoalsButton">Configurar metas</button></div><div class="goal-grid" id="goalGrid"></div></article><article class="panel"><div class="panel-header"><div><h2>Centro de alertas</h2><p>Entregas, saldos, inventario y respaldos.</p></div><div class="inline-actions"><button class="button secondary small" id="enableNotificationsButton">Activar notificaciones</button></div></div><div class="alert-center-grid" id="smartAlerts"></div></article>`);

    const reports = document.querySelector('#reports');
    if (reports && !document.querySelector('#comparisonPanel')) reports.insertAdjacentHTML('beforeend', `<article class="panel" id="comparisonPanel"><div class="panel-header"><div><h2>Comparación de ventas</h2><p>Periodo actual contra el anterior.</p></div></div><div class="comparison-grid" id="comparisonGrid"></div></article>`);

    const settingsGrid = document.querySelector('#settings .settings-grid');
    if (settingsGrid && !document.querySelector('#advancedBusinessPanel')) settingsGrid.insertAdjacentHTML('afterbegin', `<article class="panel" id="advancedBusinessPanel"><div class="panel-header"><div><h2>Datos para notas y cotizaciones</h2><p>WhatsApp, cuenta bancaria y políticas.</p></div></div><div class="form-grid"><label>WhatsApp<input id="advancedWhatsapp"></label><label>Banco<input id="advancedBank"></label><label class="full">CLABE o cuenta<input id="advancedClabe"></label><label>Anticipo recomendado %<input id="advancedDeposit" type="number" min="0" max="100"></label><label>Vigencia de cotización (días)<input id="advancedValidity" type="number" min="1"></label><label class="full">Políticas<textarea id="advancedPolicies" rows="4"></textarea></label><button class="button primary" id="saveAdvancedBusiness">Guardar datos</button></div></article><article class="panel" id="pwaPanel"><div class="panel-header"><div><h2>Aplicación instalable</h2><p>Usa MoorePrint como app y trabaja sin conexión.</p></div></div><div class="pwa-panel"><div class="pwa-status"><span class="online-dot" id="onlineDot"></span><strong id="onlineStatus">Comprobando conexión…</strong></div><button class="button primary install-button" id="installAppButton">Instalar MoorePrint</button><button class="button secondary" id="checkUpdatesButton">Buscar actualización</button><small>Los cambios se guardan localmente y se sincronizan con Supabase cuando esté conectado.</small></div></article>`);
  }

  function stageForOrder(order) {
    if (order.status === 'entregado') return 'delivered';
    if (order.status === 'listo') return 'ready';
    if (order.status === 'en_proceso') return 'production';
    if (order.designStatus === 'aprobado') return 'production';
    if (order.designStatus === 'enviado') return 'approval';
    if (order.designStatus === 'en_diseño') return 'design';
    return 'pending';
  }

  function setOrderStage(orderId, stageId) {
    const order = state.orders.find(item => item.id === orderId); if (!order) return;
    const oldOrder = clone(order); const next = clone(order);
    if (stageId === 'pending') { next.status = 'pendiente'; next.designStatus = 'pendiente'; }
    if (stageId === 'design') { next.status = 'pendiente'; next.designStatus = 'en_diseño'; }
    if (stageId === 'approval') { next.status = 'pendiente'; next.designStatus = 'enviado'; }
    if (stageId === 'production') { next.status = 'en_proceso'; next.designStatus = 'aprobado'; if (!next.approvedAt) next.approvedAt = todayISO(); }
    if (stageId === 'ready') { next.status = 'listo'; if (next.designStatus !== 'no_aplica') next.designStatus = 'aprobado'; }
    if (stageId === 'delivered') { next.status = 'entregado'; next.actualDelivery = next.actualDelivery || todayISO(); }
    if (!canSyncOrderInventory(oldOrder, next)) return;
    syncOrderInventory(oldOrder, next);
    Object.assign(order, next, { updatedAt: new Date().toISOString() });
    addActivity('production', `${order.folio} cambió a ${STAGES.find(item => item.id === stageId)?.label}`, order.customer || '', order.id);
    saveState('Etapa de producción actualizada');
  }

  function renderProductionBoard() {
    const board = document.querySelector('#productionBoard'); if (!board) return;
    const query = (document.querySelector('#productionSearch')?.value || '').toLowerCase();
    const responsible = document.querySelector('#productionResponsible')?.value || 'all';
    const responsibles = [...new Set(state.orders.map(order => order.responsible).filter(Boolean))].sort();
    const select = document.querySelector('#productionResponsible');
    if (select) {
      const current = select.value;
      select.innerHTML = `<option value="all">Todos los responsables</option>${responsibles.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}`;
      select.value = responsibles.includes(current) ? current : 'all';
    }
    const orders = state.orders.filter(order => order.status !== 'cancelado').filter(order => `${order.folio} ${order.customer} ${(order.items || []).map(item => item.name).join(' ')}`.toLowerCase().includes(query)).filter(order => responsible === 'all' || order.responsible === responsible);
    board.innerHTML = STAGES.map(stage => {
      const rows = orders.filter(order => stageForOrder(order) === stage.id);
      return `<section class="production-column" data-stage="${stage.id}"><div class="production-column-header"><h3>${stage.icon} ${stage.label}</h3><span>${rows.length}</span></div><div class="production-cards">${rows.map(order => { const totals = documentTotals(order); return `<article class="production-card ${order.priority === 'urgente' ? 'urgent' : ''} ${isOverdue(order) ? 'overdue' : ''}" draggable="true" data-production-order="${order.id}"><h4>${esc(order.folio)} · ${esc(order.customer || entityName(state.customers, order.customerId))}</h4><p>${esc((order.items || []).map(item => `${item.qty} ${item.name}`).join(', ').slice(0,80))}</p><p>Entrega: ${formatDate(order.dueDate)} · ${esc(order.responsible || 'Sin responsable')}</p><p>Diseño: ${esc(order.designStatus || 'pendiente')} · Cambios: ${num(order.designRevisions)}</p><div class="production-card-footer"><span class="priority-chip">${esc(order.priority || 'normal')}</span><strong class="${totals.balance ? 'money-warning' : 'money-positive'}">${totals.balance ? `Debe ${money(totals.balance)}` : 'Pagado'}</strong></div><select class="stage-select" data-stage-order="${order.id}">${STAGES.map(option => `<option value="${option.id}" ${option.id === stage.id ? 'selected' : ''}>${option.label}</option>`).join('')}</select></article>`; }).join('')}</div></section>`;
    }).join('');
  }

  function localISO(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
  function renderCalendar() {
    const grid = document.querySelector('#calendarGrid'); if (!grid) return;
    document.querySelector('#calendarTitle').textContent = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(calendarCursor);
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(first.getDate() - mondayOffset);
    const events = {};
    const push = (date, event) => { if (!date) return; (events[date] ||= []).push(event); };
    state.orders.filter(order => order.status !== 'cancelado').forEach(order => push(order.dueDate, { type: 'order', id: order.id, label: `${order.folio} ${order.customer}`, overdue: isOverdue(order) }));
    state.expenses.forEach(expense => { if (expenseTotals(expense).balance > 0) push(expense.dueDate, { type: 'expense', id: expense.id, label: `Pagar ${expense.description}`, overdue: expense.dueDate < todayISO() }); });
    state.orders.forEach(order => { if (documentTotals(order).balance > 0) push(order.dueDate, { type: 'payment', id: order.id, label: `Cobrar ${order.folio}`, overdue: order.dueDate < todayISO() }); });
    grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index); const iso = localISO(date);
      const other = date.getMonth() !== calendarCursor.getMonth();
      return `<div class="calendar-day ${other ? 'other-month' : ''} ${iso === todayISO() ? 'today' : ''}"><div class="calendar-day-number">${date.getDate()}</div><div class="calendar-events">${(events[iso] || []).slice(0,5).map(event => `<button class="calendar-event ${event.type} ${event.overdue ? 'overdue' : ''}" data-calendar-event="${event.type}" data-event-id="${event.id}" title="${esc(event.label)}">${esc(event.label)}</button>`).join('')}${(events[iso] || []).length > 5 ? `<small>+${events[iso].length - 5} más</small>` : ''}</div></div>`;
    }).join('');
  }

  function calculatorValues() {
    const form = document.querySelector('#quickCalculatorForm'); if (!form) return null;
    const data = Object.fromEntries(new FormData(form));
    const qty = Math.max(1, num(data.qty));
    const base = num(data.materials)+num(data.labor)+num(data.design)+num(data.energy)+num(data.packaging)+num(data.transport)+num(data.external)+num(data.extra)+(num(data.fixed)/qty);
    const cost = base * (1 + num(data.waste)/100);
    const commission = Math.min(.9, num(data.commission)/100);
    const margin = Math.min(.9, num(data.margin)/100);
    const minimum = commission < 1 ? cost/(1-commission) : cost;
    const recommended = commission + margin < .95 ? cost/(1-commission-margin) : cost*2;
    const discounted = recommended*(1-num(data.discount)/100);
    const totalBeforeTax = discounted*qty;
    const total = totalBeforeTax*(1+num(data.tax)/100);
    const commissionCost = totalBeforeTax*commission;
    const profit = totalBeforeTax - cost*qty - commissionCost;
    const realMargin = totalBeforeTax ? profit/totalBeforeTax*100 : 0;
    return { data, qty, base, cost, minimum, recommended, total, totalBeforeTax, profit, realMargin };
  }

  function renderCalculator() {
    const values = calculatorValues(); if (!values) return;
    document.querySelector('#calcUnitCost').textContent = money(values.cost);
    document.querySelector('#calcMinimum').textContent = money(values.minimum);
    document.querySelector('#calcRecommended').textContent = money(values.recommended);
    document.querySelector('#calcTotal').textContent = money(values.total);
    document.querySelector('#calcProfit').textContent = money(values.profit);
    document.querySelector('#calcProfit').className = values.profit < 0 ? 'money-negative' : 'money-positive';
    document.querySelector('#calcRealMargin').textContent = `${values.realMargin.toFixed(1)}%`;
  }

  function renderGoals() {
    const container = document.querySelector('#goalGrid'); if (!container) return;
    const range = currentMonthRange(); const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, range.from, range.to));
    const sales = sum(orders, order => documentTotals(order).total); const costs = sum(orders, order => documentTotals(order).costs); const expenses = sum(state.expenses.filter(expense => inRange(expense.date, range.from, range.to)), expense => num(expense.amount)); const profit = sales-costs-expenses;
    const rows = [['Ventas', sales, num(state.goals.sales)], ['Ganancia', profit, num(state.goals.profit)], ['Pedidos', orders.length, num(state.goals.orders)]];
    document.querySelector('#goalsMonthLabel').textContent = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date());
    container.innerHTML = rows.map(([label,value,target]) => { const percent = target ? Math.max(0,Math.min(100,value/target*100)) : 0; return `<div class="goal-card"><div class="goal-card-header"><span>${label}</span><strong>${label === 'Pedidos' ? value : money(value)}</strong></div><div class="goal-progress"><div class="goal-progress-fill" style="width:${percent}%"></div></div><small>${percent.toFixed(1)}% de ${label === 'Pedidos' ? target : money(target)}</small></div>`; }).join('');
  }

  function periodRange(kind, offset = 0) {
    const now = new Date(); let start,end;
    if (kind === 'day') { start = new Date(now); start.setDate(now.getDate()+offset); end = new Date(start); }
    if (kind === 'week') { const day=(now.getDay()+6)%7; start=new Date(now); start.setDate(now.getDate()-day+offset*7); end=new Date(start); end.setDate(start.getDate()+6); }
    if (kind === 'month') { start=new Date(now.getFullYear(),now.getMonth()+offset,1); end=new Date(now.getFullYear(),now.getMonth()+offset+1,0); }
    if (kind === 'year') { start=new Date(now.getFullYear()+offset,0,1); end=new Date(now.getFullYear()+offset,11,31); }
    return { from: localISO(start), to: localISO(end) };
  }
  function periodStats(range) { const orders=state.orders.filter(order=>order.status!=='cancelado'&&inRange(order.orderDate,range.from,range.to)); const sales=sum(orders,order=>documentTotals(order).total); const costs=sum(orders,order=>documentTotals(order).costs); const expenses=sum(state.expenses.filter(expense=>inRange(expense.date,range.from,range.to)),expense=>num(expense.amount)); return { orders:orders.length,sales,profit:sales-costs-expenses }; }
  function renderComparisons() {
    const container=document.querySelector('#comparisonGrid'); if(!container)return;
    container.innerHTML=['day','week','month','year'].map(kind=>{const current=periodStats(periodRange(kind,0));const previous=periodStats(periodRange(kind,-1));const delta=previous.sales?((current.sales-previous.sales)/previous.sales*100):(current.sales?100:0);const labels={day:'Hoy',week:'Esta semana',month:'Este mes',year:'Este año'};return `<div class="comparison-card"><h3>${labels[kind]}</h3><div class="comparison-main">${money(current.sales)}</div><div class="comparison-delta ${delta<0?'money-negative':'money-positive'}">${delta>=0?'+':''}${delta.toFixed(1)}% vs. periodo anterior</div><small>${current.orders} pedidos · Utilidad ${money(current.profit)}</small></div>`;}).join('');
  }

  function collectAlerts() {
    const alerts=[]; const today=todayISO();
    state.orders.filter(order=>order.status!=='cancelado'&&order.dueDate===today).forEach(order=>alerts.push({severity:'warning',icon:'📅',title:`Entrega hoy: ${order.folio}`,detail:order.customer||'',section:'orders'}));
    state.orders.filter(isOverdue).forEach(order=>alerts.push({severity:'danger',icon:'⏰',title:`Pedido atrasado: ${order.folio}`,detail:`Entrega ${formatDate(order.dueDate)}`,section:'production'}));
    state.orders.filter(order=>order.status!=='cancelado'&&documentTotals(order).balance>0).slice(0,5).forEach(order=>alerts.push({severity:'warning',icon:'💰',title:`Saldo pendiente ${order.folio}`,detail:money(documentTotals(order).balance),section:'cash'}));
    state.materials.filter(isLowStock).slice(0,5).forEach(material=>alerts.push({severity:num(material.stock)<=0?'danger':'warning',icon:'📦',title:`${material.name} con existencia baja`,detail:`${num(material.stock).toFixed(2)} ${material.unit||''}`,section:'inventory'}));
    state.expenses.filter(expense=>expenseTotals(expense).status==='vencido').slice(0,4).forEach(expense=>alerts.push({severity:'danger',icon:'💸',title:`Gasto vencido: ${expense.description}`,detail:money(expenseTotals(expense).balance),section:'expenses'}));
    state.products.filter(product=>{const p=productBreakdown(product);return num(product.salePrice)>0&&p.profit/num(product.salePrice)<.15;}).slice(0,4).forEach(product=>alerts.push({severity:'warning',icon:'⚠️',title:`Margen bajo: ${product.name}`,detail:`Ganancia ${money(productBreakdown(product).profit)}`,section:'products'}));
    const lastBackup=localStorage.getItem('mooreprint-last-backup'); if(!lastBackup||Date.now()-new Date(lastBackup).getTime()>7*86400000)alerts.push({severity:'warning',icon:'💾',title:'Respaldo pendiente',detail:'Descarga un respaldo de tus datos.',section:'settings'});
    return alerts;
  }
  function renderSmartAlerts() {
    const container=document.querySelector('#smartAlerts'); if(!container)return; const alerts=collectAlerts();
    container.innerHTML=alerts.length?alerts.slice(0,12).map(alert=>`<button class="smart-alert ${alert.severity}" data-go="${alert.section}"><span>${alert.icon}</span><span><strong>${esc(alert.title)}</strong><small>${esc(alert.detail)}</small></span></button>`).join(''):'<p class="empty-message">No hay alertas importantes.</p>';
    const ordersNav=document.querySelector('.nav-item[data-section="orders"]'); let badge=ordersNav?.querySelector('.nav-badge'); if(alerts.length&&!badge){ordersNav.insertAdjacentHTML('beforeend','<span class="nav-badge"></span>');badge=ordersNav.querySelector('.nav-badge');} if(badge){badge.textContent=alerts.length;badge.hidden=!alerts.length;}
  }

  function renderWaste() {
    const table=document.querySelector('#wasteTable'); if(!table)return; const query=(document.querySelector('#wasteSearch')?.value||'').toLowerCase(); const range=currentMonthRange(); const monthRows=state.wasteRecords.filter(row=>inRange(row.date,range.from,range.to));
    document.querySelector('#wasteMonthTotal').textContent=money(sum(monthRows,row=>num(row.totalCost))); document.querySelector('#wasteMonthCount').textContent=monthRows.length;
    const grouped=monthRows.reduce((map,row)=>{map[row.reason]=(map[row.reason]||0)+num(row.totalCost);return map;},{}); document.querySelector('#wasteTopReason').textContent=Object.entries(grouped).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
    const rows=[...state.wasteRecords].filter(row=>`${entityName(state.materials,row.materialId,'')} ${row.reason} ${row.notes} ${row.orderFolio}`.toLowerCase().includes(query)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    table.innerHTML=rows.map(row=>`<tr><td>${formatDate(row.date)}</td><td>${esc(entityName(state.materials,row.materialId))}</td><td>${num(row.qty).toFixed(2)}</td><td>${esc(row.reason)}</td><td>${esc(row.orderFolio||'—')}</td><td class="money-negative">${money(row.totalCost)}</td><td>${esc(row.notes||'')}</td><td><button class="action-button" data-delete-waste="${row.id}">×</button></td></tr>`).join(''); document.querySelector('#wasteEmpty').style.display=rows.length?'none':'block';
  }

  function renderActivity() {
    const container=document.querySelector('#activityList'); if(!container)return; const query=(document.querySelector('#activitySearch')?.value||'').toLowerCase(); const rows=state.activityLog.filter(item=>`${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query)); const icons={order:'🧾',payment:'💰',production:'🖨️',inventory:'📦',waste:'♻️',quote:'📝',expense:'💸',system:'⚙️'};
    container.innerHTML=rows.length?rows.slice(0,300).map(item=>`<div class="activity-item"><span class="activity-icon">${icons[item.type]||'•'}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.detail||'')}</small></div><small>${new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(item.createdAt))}</small></div>`).join(''):'<p class="empty-message">No hay movimientos registrados.</p>';
  }

  function renderAdvancedBusiness() {
    const values={advancedWhatsapp:state.business.whatsapp,advancedBank:state.business.bank,advancedClabe:state.business.clabe,advancedDeposit:state.business.depositPercent,advancedValidity:state.business.quoteValidity,advancedPolicies:state.business.policies}; Object.entries(values).forEach(([id,value])=>{const element=document.querySelector(`#${id}`);if(element&&document.activeElement!==element)element.value=value??'';});
  }

  function renderOnlineStatus() { const dot=document.querySelector('#onlineDot'); const label=document.querySelector('#onlineStatus'); if(!dot||!label)return; dot.classList.toggle('online',navigator.onLine); label.textContent=navigator.onLine?'En línea':'Sin conexión · modo local'; }

  function renderAdvancedAll() { renderProductionBoard();renderCalendar();renderCalculator();renderGoals();renderComparisons();renderSmartAlerts();renderWaste();renderActivity();renderAdvancedBusiness();renderOnlineStatus();decorateOrderRows(); }

  function decorateOrderRows() { document.querySelectorAll('#ordersTable [data-view-order]').forEach(button=>{const group=button.closest('.action-group');if(group&&!group.querySelector('[data-qr-order]'))group.insertAdjacentHTML('beforeend',`<button class="action-button" data-qr-order="${button.dataset.viewOrder}" title="Código QR">▦</button>`);}); }

  function injectDesignFields(orderId='') {
    const form=document.querySelector('#orderForm'); if(!form||document.querySelector('#advancedDesignSection'))return; const order=state.orders.find(item=>item.id===orderId)||{}; const attachment=document.querySelector('.attachment-box',form);
    const html=`<div class="form-section" id="advancedDesignSection"><div class="section-title"><div><h3>Control de diseño y aprobación</h3><p>Registra cambios y evidencia de aprobación.</p></div></div><div class="modal-form"><label>Número de cambios<input name="designRevisions" type="number" min="0" value="${num(order.designRevisions)}"></label><label>Aprobado por<input name="approvedBy" value="${esc(order.approvedBy||'')}"></label><label>Fecha de aprobación<input name="approvedAt" type="date" value="${esc(order.approvedAt||'')}"></label><label>Aprobación del cliente<select name="clientApproved"><option value="false" ${!order.clientApproved?'selected':''}>Pendiente</option><option value="true" ${order.clientApproved?'selected':''}>Aprobado</option></select></label><label class="full">Cambios solicitados<textarea name="designChanges" rows="3">${esc(order.designChanges||'')}</textarea></label><label class="full">Nota de aprobación<textarea name="approvalNote" rows="2">${esc(order.approvalNote||'')}</textarea></label></div></div>`;
    if(attachment)attachment.insertAdjacentHTML('beforebegin',html);else form.insertAdjacentHTML('beforeend',html);
  }

  function orderQrText(order) { const totals=documentTotals(order); return [`MOOREPRINT`, `Folio: ${order.folio}`, `Cliente: ${order.customer||entityName(state.customers,order.customerId)}`, `Estado: ${statusName(order.status)}`, `Entrega: ${order.dueDate}`, `Saldo: ${money(totals.balance)}`, `Trabajo: ${(order.items||[]).map(item=>`${item.qty} ${item.name}`).join(', ')}`, order.notes?`Notas: ${order.notes}`:''].filter(Boolean).join('\n'); }
  function drawQr(element,text,size=200){element.innerHTML='';if(window.QRCode){new QRCode(element,{text,width:size,height:size,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}else element.innerHTML='<small>No se pudo cargar el generador QR.</small>';}
  function openOrderQr(orderId){const order=state.orders.find(item=>item.id===orderId);if(!order)return;const totals=documentTotals(order);openModal(`QR del pedido ${order.folio}`,`<div class="qr-layout"><div class="qr-box" id="standaloneQr"></div><div class="qr-details"><h3>${esc(order.folio)} · ${esc(order.customer||'')}</h3><p><strong>Estado:</strong> ${statusName(order.status)}</p><p><strong>Entrega:</strong> ${formatDate(order.dueDate)}</p><p><strong>Saldo:</strong> ${money(totals.balance)}</p><p>${esc((order.items||[]).map(item=>`${item.qty} ${item.name}`).join(', '))}</p><small>El QR contiene el resumen del pedido y puede colocarse en la caja o producto.</small></div></div>`,`<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" id="printDocumentButton">Imprimir</button>`);drawQr(document.querySelector('#standaloneQr'),orderQrText(order));}

  function advancedPreviewDocument(type,id){const record=type==='order'?state.orders.find(item=>item.id===id):state.quotes.find(item=>item.id===id);if(!record)return;const totals=documentTotals(record);const business=state.business;const isOrder=type==='order';const qrText=isOrder?orderQrText(record):`MOOREPRINT\nCotización: ${record.folio}\nCliente: ${record.customer}\nTotal: ${money(totals.total)}\nVigencia: ${record.validUntil}`;openModal(`${isOrder?'Nota':'Cotización'} ${record.folio}`,`<div class="note-preview"><div class="brand-document-header"><div><div class="brand-document-logo">MOORE<b>PRINT</b></div><small>IMPRESIÓN Y DISEÑO</small><p>${esc([business.address,business.city].filter(Boolean).join(', '))}</p><p>${esc([business.phone,business.email].filter(Boolean).join(' · '))}</p></div><div class="qr-box" id="documentQr" style="min-height:130px;width:130px;padding:6px"></div></div><div class="note-meta"><div><strong>Folio:</strong> ${esc(record.folio)}</div><div><strong>Fecha:</strong> ${formatDate(isOrder?record.orderDate:record.date)}</div><div><strong>Cliente:</strong> ${esc(record.customer||entityName(state.customers,record.customerId))}</div><div><strong>${isOrder?'Entrega':'Vigencia'}:</strong> ${formatDate(isOrder?record.dueDate:record.validUntil)}</div></div><table><thead><tr><th>Cant.</th><th>Descripción</th><th>Precio</th><th>Importe</th></tr></thead><tbody>${(record.items||[]).map(item=>`<tr><td>${num(item.qty)}</td><td>${esc(item.name)}</td><td>${money(item.price)}</td><td>${money(num(item.qty)*num(item.price))}</td></tr>`).join('')}</tbody></table><div class="summary-box" style="margin-top:15px"><div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>${totals.discount?`<div class="summary-row"><span>Descuento</span><strong>-${money(totals.discount)}</strong></div>`:''}${totals.tax?`<div class="summary-row"><span>IVA</span><strong>${money(totals.tax)}</strong></div>`:''}<div class="summary-row total"><span>Total</span><strong>${money(totals.total)}</strong></div>${isOrder?`<div class="summary-row"><span>Pagado</span><strong>${money(totals.paid)}</strong></div><div class="summary-row"><span>Restante</span><strong>${money(totals.balance)}</strong></div>`:''}</div>${record.notes?`<p><strong>Notas:</strong> ${esc(record.notes)}</p>`:''}${business.bank||business.clabe?`<p><strong>Datos de pago:</strong> ${esc(business.bank||'')} ${esc(business.clabe||'')}</p>`:''}${business.whatsapp?`<p><strong>WhatsApp:</strong> ${esc(business.whatsapp)}</p>`:''}<div class="document-policy"><strong>Políticas:</strong> ${esc(business.policies||'')} ${!isOrder?`Vigencia: ${num(business.quoteValidity)||15} días.`:''}</div><div class="approval-box"><div class="signature-line">Firma de MoorePrint</div><div class="signature-line">Firma y aprobación del cliente</div></div></div>`,`<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" id="printDocumentButton">Imprimir</button>`,true);drawQr(document.querySelector('#documentQr'),qrText,118);}

  function openGoalsModal(){openModal('Metas mensuales',`<form id="goalsForm" class="modal-form"><label>Meta de ventas<input name="sales" type="number" min="0" step="0.01" value="${num(state.goals.sales)}"></label><label>Meta de ganancia<input name="profit" type="number" min="0" step="0.01" value="${num(state.goals.profit)}"></label><label>Meta de pedidos<input name="orders" type="number" min="0" step="1" value="${num(state.goals.orders)}"></label></form>`,`<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="goalsForm">Guardar metas</button>`);}
  function openWasteModal(){openModal('Registrar merma',`<form id="wasteForm" class="modal-form"><label>Fecha<input name="date" type="date" value="${todayISO()}" required></label><label>Material<select name="materialId" required>${materialOptions('')}</select></label><label>Cantidad desperdiciada<input name="qty" type="number" min="0.001" step="0.001" required></label><label>Causa<select name="reason"><option>Impresión incorrecta</option><option>Taza rota</option><option>Playera dañada</option><option>Error de corte</option><option>Diseño equivocado</option><option>Material defectuoso</option><option>Prueba de impresión</option><option>Otro</option></select></label><label>Pedido relacionado<select name="orderId"><option value="">Sin pedido</option>${state.orders.map(order=>`<option value="${order.id}">${esc(order.folio)} · ${esc(order.customer||'')}</option>`).join('')}</select></label><label class="full">Notas<textarea name="notes" rows="3"></textarea></label></form>`,`<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="wasteForm">Guardar merma</button>`);}
  function saveWaste(form){const data=Object.fromEntries(new FormData(form));const material=state.materials.find(item=>item.id===data.materialId);if(!material)return showToast('Selecciona un material','error');const qty=num(data.qty);const order=state.orders.find(item=>item.id===data.orderId);material.stock=num(material.stock)-qty;const row={id:uid('waste'),date:data.date,materialId:data.materialId,qty,unitCost:num(material.unitCost),totalCost:qty*num(material.unitCost),reason:data.reason,orderId:data.orderId,orderFolio:order?.folio||'',notes:data.notes.trim(),createdAt:new Date().toISOString()};state.wasteRecords.push(row);addInventoryMovement(material.id,-qty,'merma',`${data.reason}${order?` · ${order.folio}`:''}`,row.id,data.date);addActivity('waste',`Merma de ${material.name}`,`${qty} ${material.unit||''} · ${money(row.totalCost)}`,row.id);closeModal(true);saveState('Merma registrada e inventario actualizado');}
  function deleteWaste(id){const row=state.wasteRecords.find(item=>item.id===id);if(!row)return;const material=state.materials.find(item=>item.id===row.materialId);if(material)material.stock=num(material.stock)+num(row.qty);state.wasteRecords=state.wasteRecords.filter(item=>item.id!==id);addActivity('waste','Merma eliminada',entityName(state.materials,row.materialId,''),id);saveState('Merma eliminada y existencia devuelta');}

  function saveAdvancedBusiness(){state.business.whatsapp=document.querySelector('#advancedWhatsapp').value.trim();state.business.bank=document.querySelector('#advancedBank').value.trim();state.business.clabe=document.querySelector('#advancedClabe').value.trim();state.business.depositPercent=num(document.querySelector('#advancedDeposit').value);state.business.quoteValidity=num(document.querySelector('#advancedValidity').value);state.business.policies=document.querySelector('#advancedPolicies').value.trim();addActivity('system','Datos de notas actualizados','WhatsApp, banco y políticas');saveState('Datos de notas guardados');}

  function wrapExistingFunctions(){if(wrapped)return;wrapped=true;
    const baseRenderAll=renderAll;renderAll=function(){baseRenderAll();renderAdvancedAll();};
    const baseOpenOrderModal=openOrderModal;openOrderModal=function(id='',quoteId=''){baseOpenOrderModal(id,quoteId);injectDesignFields(id);};
    const baseSaveOrder=saveOrder;saveOrder=function(form){const id=form.elements.id.value;const before=clone(state.orders.find(item=>item.id===id)||{});const advanced={designRevisions:num(form.elements.designRevisions?.value),approvedBy:form.elements.approvedBy?.value.trim()||'',approvedAt:form.elements.approvedAt?.value||'',approvalNote:form.elements.approvalNote?.value.trim()||'',designChanges:form.elements.designChanges?.value.trim()||'',clientApproved:form.elements.clientApproved?.value==='true'};baseSaveOrder(form);const order=state.orders.find(item=>item.id===id);if(order){Object.assign(order,advanced);const changes=[];if(before.status!==order.status)changes.push(`${statusName(before.status)} → ${statusName(order.status)}`);if(before.designStatus!==order.designStatus)changes.push(`diseño ${before.designStatus||'pendiente'} → ${order.designStatus}`);addActivity('order',before.id?`Pedido ${order.folio} actualizado`:`Pedido ${order.folio} creado`,changes.join(' · ')||order.customer,order.id);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAdvancedAll();}};
    const baseSavePayment=savePayment;savePayment=function(form){const data=Object.fromEntries(new FormData(form));baseSavePayment(form);addActivity('payment',data.recordType==='order'?'Cobro registrado':'Pago registrado',`${money(data.amount)} · ${methodName(data.method)}`,data.recordId);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAdvancedAll();};
    const baseSaveQuote=saveQuote;saveQuote=function(form){const id=form.elements.id.value;const existed=state.quotes.some(item=>item.id===id);baseSaveQuote(form);const quote=state.quotes.find(item=>item.id===id);if(quote){addActivity('quote',`${existed?'Cotización actualizada':'Cotización creada'} ${quote.folio}`,quote.customer,quote.id);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAdvancedAll();}};
    const baseExportBackup=exportBackup;exportBackup=function(){baseExportBackup();localStorage.setItem('mooreprint-last-backup',new Date().toISOString());renderSmartAlerts();};
    previewDocument=advancedPreviewDocument;
  }

  function setupPwa(){if(!document.querySelector('link[rel="manifest"]')){const link=document.createElement('link');link.rel='manifest';link.href='manifest.webmanifest';document.head.appendChild(link);}if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.querySelector('#installAppButton')?.classList.add('ready');});window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelector('#installAppButton')?.classList.remove('ready');showToast('MoorePrint fue instalada');});window.addEventListener('online',renderOnlineStatus);window.addEventListener('offline',renderOnlineStatus);}
  function requestNotifications(){if(!('Notification'in window))return showToast('Este navegador no permite notificaciones','warning');Notification.requestPermission().then(permission=>{showToast(permission==='granted'?'Notificaciones activadas':'No se concedió permiso',permission==='granted'?'normal':'warning');maybeNotify();});}
  function maybeNotify(){if(!('Notification'in window)||Notification.permission!=='granted')return;const key=`mooreprint-notified-${todayISO()}`;if(localStorage.getItem(key))return;const alerts=collectAlerts().filter(alert=>alert.severity==='danger'||alert.title.includes('Entrega hoy'));if(alerts.length){new Notification('MoorePrint',{body:`Tienes ${alerts.length} pendiente${alerts.length===1?'':'s'} importante${alerts.length===1?'':'s'}.`,icon:'icon.svg'});localStorage.setItem(key,'1');}}

  function bindAdvancedEvents(){
    document.addEventListener('dragstart',event=>{const card=event.target.closest('[data-production-order]');if(card)event.dataTransfer.setData('text/plain',card.dataset.productionOrder);});
    document.addEventListener('dragover',event=>{const column=event.target.closest('.production-column');if(column){event.preventDefault();column.classList.add('drag-over');}});
    document.addEventListener('dragleave',event=>event.target.closest('.production-column')?.classList.remove('drag-over'));
    document.addEventListener('drop',event=>{const column=event.target.closest('.production-column');if(!column)return;event.preventDefault();column.classList.remove('drag-over');setOrderStage(event.dataTransfer.getData('text/plain'),column.dataset.stage);});
    document.addEventListener('input',event=>{if(event.target.closest('#quickCalculatorForm'))renderCalculator();if(event.target.id==='productionSearch')renderProductionBoard();if(event.target.id==='wasteSearch')renderWaste();if(event.target.id==='activitySearch')renderActivity();});
    document.addEventListener('change',event=>{if(event.target.id==='productionResponsible')renderProductionBoard();if(event.target.matches('[data-stage-order]'))setOrderStage(event.target.dataset.stageOrder,event.target.value);});
    document.addEventListener('submit',event=>{if(event.target.id==='goalsForm'){event.preventDefault();const data=Object.fromEntries(new FormData(event.target));state.goals={sales:num(data.sales),profit:num(data.profit),orders:num(data.orders)};closeModal(true);addActivity('system','Metas mensuales actualizadas');saveState('Metas guardadas');}if(event.target.id==='wasteForm'){event.preventDefault();saveWaste(event.target);}});
    document.addEventListener('click',async event=>{const target=event.target.closest('button');if(!target)return;if(target.id==='productionNewOrder'){navigate('orders');openOrderModal();}if(target.dataset.calendarPrev!==undefined){calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();}if(target.dataset.calendarNext!==undefined){calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();}if(target.dataset.calendarToday!==undefined){calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar();}if(target.dataset.calendarEvent){if(target.dataset.calendarEvent==='order'||target.dataset.calendarEvent==='payment')openOrderModal(target.dataset.eventId);if(target.dataset.calendarEvent==='expense')openExpenseModal(target.dataset.eventId);}if(target.id==='configureGoalsButton')openGoalsModal();if(target.id==='newWasteButton')openWasteModal();if(target.dataset.deleteWaste){if(confirm('¿Eliminar esta merma y devolver el material al inventario?'))deleteWaste(target.dataset.deleteWaste);}if(target.id==='clearActivityButton'){if(confirm('¿Limpiar todo el historial de actividad?')){state.activityLog=[];saveState('Historial limpiado');}}if(target.dataset.qrOrder)openOrderQr(target.dataset.qrOrder);if(target.id==='saveAdvancedBusiness')saveAdvancedBusiness();if(target.id==='enableNotificationsButton')requestNotifications();if(target.id==='installAppButton'&&installPrompt){installPrompt.prompt();await installPrompt.userChoice;}if(target.id==='checkUpdatesButton'){const registration=await navigator.serviceWorker?.getRegistration();await registration?.update();showToast('Se buscó una actualización');}if(target.id==='calculatorCreateProduct'){const values=calculatorValues();openProductModal();const form=document.querySelector('#productForm');if(form&&values){form.elements.name.value=values.data.name||'Producto calculado';form.elements.salePrice.value=values.recommended.toFixed(2);form.elements.materialCost&&(form.elements.materialCost.value=num(values.data.materials));form.elements.laborCost.value=num(values.data.labor);form.elements.designCost.value=num(values.data.design);form.elements.electricityCost.value=num(values.data.energy);form.elements.packagingCost.value=num(values.data.packaging);form.elements.transportCost.value=num(values.data.transport);form.elements.externalCost.value=num(values.data.external);form.elements.extraCost.value=num(values.data.extra);form.elements.wastePercent.value=num(values.data.waste);form.elements.commissionPercent.value=num(values.data.commission);updateProductCostPreview();}}});
  }

  async function init(){ensureAdvancedState();injectNavigationAndSections();injectDashboardAndReports();wrapExistingFunctions();bindAdvancedEvents();setupPwa();try{if(typeof loadScriptOnce==='function')await loadScriptOnce('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');}catch(error){}renderAll();maybeNotify();}
  window.MoorePrintAdvanced={init,renderAll:renderAdvancedAll,addActivity};
})();
