(function () {
  let initialized = false;

  const CATEGORY_LABELS = {
    luz: 'Luz / electricidad',
    renta: 'Renta del local',
    personal: 'Pago a personal',
    internet: 'Internet / teléfono',
    agua: 'Agua',
    gas: 'Gas',
    mantenimiento: 'Mantenimiento',
    software: 'Programas / suscripciones',
    transporte: 'Transporte fijo',
    otro: 'Otro costo fijo'
  };

  function localMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(month) {
    if (!/^\d{4}-\d{2}$/.test(month || '')) return month || '';
    const [year, value] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(year, value - 1, 1));
  }

  function previousMonth(month) {
    const [year, value] = String(month || localMonthKey()).split('-').map(Number);
    return localMonthKey(new Date(year, value - 2, 1));
  }

  function normalize() {
    state.monthlyOverheads = Array.isArray(state.monthlyOverheads) ? state.monthlyOverheads : [];
    state.monthlyOverheadSettings = Array.isArray(state.monthlyOverheadSettings) ? state.monthlyOverheadSettings : [];
    state.business = { ...(state.business || {}), pricingMonth: state.business?.pricingMonth || localMonthKey() };
  }

  function pricingMonth() {
    normalize();
    return state.business.pricingMonth || localMonthKey();
  }

  function monthRows(month = pricingMonth()) {
    normalize();
    return state.monthlyOverheads.filter(row => row.month === month && row.active !== false);
  }

  function rowTotal(row) {
    return Math.max(0, num(row.quantity)) * Math.max(0, num(row.unitAmount));
  }

  function monthlyTotal(month = pricingMonth()) {
    return sum(monthRows(month), rowTotal);
  }

  function monthSetting(month = pricingMonth()) {
    normalize();
    return state.monthlyOverheadSettings.find(item => item.month === month) || null;
  }

  function productiveHours(month = pricingMonth()) {
    return Math.max(1, num(monthSetting(month)?.productiveHours) || num(state.business.monthlyHours) || 160);
  }

  function costPerProductiveHour(month = pricingMonth()) {
    return monthlyTotal(month) / productiveHours(month);
  }

  function productMonthlyOverhead(product, month = pricingMonth()) {
    return costPerProductiveHour(month) * Math.max(0, num(product?.productionMinutes)) / 60;
  }

  function categoryOptions(selected = 'luz') {
    return Object.entries(CATEGORY_LABELS)
      .map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`)
      .join('');
  }

  function defaultConcept(category) {
    return CATEGORY_LABELS[category] || 'Costo fijo';
  }

  function monthlyCostRow(row = {}, month = pricingMonth()) {
    const item = {
      id: row.id || uid('monthly-cost'), month, category: row.category || 'luz',
      name: row.name || defaultConcept(row.category || 'luz'), quantity: Math.max(1, num(row.quantity) || 1),
      unitAmount: Math.max(0, num(row.unitAmount)), notes: row.notes || '', active: row.active !== false, ...row
    };
    return `<div class="monthly-cost-row monthly-cost-category-${esc(item.category)}" data-monthly-cost-id="${item.id}">
      <label>Tipo<select class="monthly-cost-category">${categoryOptions(item.category)}</select></label>
      <label>Concepto<input class="monthly-cost-name" value="${esc(item.name)}" placeholder="Ej. Recibo CFE o diseñador"></label>
      <label>Cantidad<input class="monthly-cost-quantity" type="number" min="0.01" step="0.01" value="${num(item.quantity) || 1}"></label>
      <label>Precio por cada uno<input class="monthly-cost-unit" type="number" min="0" step="0.01" value="${num(item.unitAmount)}"></label>
      <div class="monthly-cost-total"><span>Total mensual</span><strong>${money(rowTotal(item))}</strong></div>
      <button class="button danger small remove-monthly-cost" type="button" data-remove-monthly-cost>Quitar</button>
      <label style="grid-column:1/-1">Notas<input class="monthly-cost-notes" value="${esc(item.notes)}" placeholder="Periodo, empleado, servicio, observaciones..."></label>
    </div>`;
  }

  function ensurePanel() {
    const section = document.querySelector('#expenses');
    if (!section || document.querySelector('#monthlyCostPanel')) return;
    const firstPanel = section.querySelector('.panel');
    const html = `<article class="panel monthly-cost-panel" id="monthlyCostPanel">
      <div class="panel-header"><div><h2>Costos fijos mensuales para calcular precios</h2><p>Distribuye luz, renta, personal y otros pagos según el tiempo de producción.</p></div></div>
      <div class="monthly-cost-toolbar">
        <label>Mes a editar y usar en precios<input id="monthlyCostMonth" type="month"></label>
        <label>Horas productivas del mes<input id="monthlyProductiveHours" type="number" min="1" step="1"></label>
        <div class="actions">
          <button class="button secondary" id="copyPreviousMonthlyCosts" type="button">Copiar mes anterior</button>
          <button class="button secondary" id="addMonthlyCost" type="button">+ Agregar costo</button>
          <button class="button primary" id="saveMonthlyCosts" type="button">Guardar mes</button>
        </div>
      </div>
      <div class="monthly-cost-summary">
        <article><span>Total fijo del mes</span><strong id="monthlyCostTotal">$0.00</strong></article>
        <article><span>Horas productivas</span><strong id="monthlyCostHours">0 h</strong></article>
        <article><span>Costo fijo por hora</span><strong id="monthlyCostHourly">$0.00</strong></article>
        <article><span>Conceptos registrados</span><strong id="monthlyCostCount">0</strong></article>
      </div>
      <div class="monthly-cost-list" id="monthlyCostRows"></div>
      <div class="monthly-cost-note"><strong>Importante:</strong> marca como “incluido en el costo de los productos” cualquier gasto que también registres en Gastos para evitar duplicarlo.</div>
      <div class="monthly-cost-cloud" id="monthlyCostCloudStatus"><span class="dot"></span><span>Guardado local; esperando sincronización.</span></div>
    </article>`;
    if (firstPanel) firstPanel.insertAdjacentHTML('beforebegin', html);
    else section.insertAdjacentHTML('beforeend', html);
  }

  function rowFromElement(element, month) {
    return {
      id: element.dataset.monthlyCostId || uid('monthly-cost'),
      month,
      category: element.querySelector('.monthly-cost-category')?.value || 'otro',
      name: element.querySelector('.monthly-cost-name')?.value.trim() || 'Costo fijo',
      quantity: Math.max(0, num(element.querySelector('.monthly-cost-quantity')?.value)),
      unitAmount: Math.max(0, num(element.querySelector('.monthly-cost-unit')?.value)),
      notes: element.querySelector('.monthly-cost-notes')?.value.trim() || '',
      active: true,
      updatedAt: new Date().toISOString()
    };
  }

  function panelRows(month) {
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return [];
    return [...panel.querySelectorAll('.monthly-cost-row')]
      .map(element => rowFromElement(element, month))
      .filter(row => row.name && row.quantity > 0);
  }

  function updatePanelPreview() {
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return;
    const month = panel.querySelector('#monthlyCostMonth')?.value || panel.dataset.month || pricingMonth();
    const rows = panelRows(month);
    rows.forEach(row => {
      const element = panel.querySelector(`[data-monthly-cost-id="${CSS.escape(row.id)}"]`);
      if (!element) return;
      element.className = `monthly-cost-row monthly-cost-category-${row.category}`;
      const total = element.querySelector('.monthly-cost-total strong');
      if (total) total.textContent = money(rowTotal(row));
    });
    const hours = Math.max(1, num(panel.querySelector('#monthlyProductiveHours')?.value) || 160);
    const total = sum(rows, rowTotal);
    panel.querySelector('#monthlyCostTotal').textContent = money(total);
    panel.querySelector('#monthlyCostHours').textContent = `${hours.toFixed(0)} h`;
    panel.querySelector('#monthlyCostHourly').textContent = money(total / hours);
    panel.querySelector('#monthlyCostCount').textContent = String(rows.length);
  }

  function render() {
    ensurePanel();
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return;
    const month = pricingMonth();
    panel.dataset.month = month;
    panel.querySelector('#monthlyCostMonth').value = month;
    panel.querySelector('#monthlyProductiveHours').value = productiveHours(month);
    const rows = monthRows(month);
    panel.querySelector('#monthlyCostRows').innerHTML = rows.length
      ? rows.map(row => monthlyCostRow(row, month)).join('')
      : '<div class="monthly-cost-empty"><strong>No hay costos en este mes.</strong><p>Agrega luz, renta, personal u otro pago fijo.</p></div>';
    updatePanelPreview();
  }

  function persistPanelMonth(month, showMessage = true) {
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel || !month) return;
    const rows = panelRows(month);
    const existingById = new Map(state.monthlyOverheads.filter(row => row.month === month).map(row => [row.id, row]));
    const prepared = rows.map(row => ({
      ...row,
      createdAt: existingById.get(row.id)?.createdAt || new Date().toISOString()
    }));
    state.monthlyOverheads = state.monthlyOverheads.filter(row => row.month !== month).concat(prepared);

    const setting = {
      month,
      productiveHours: Math.max(1, num(panel.querySelector('#monthlyProductiveHours')?.value) || num(state.business.monthlyHours) || 160),
      updatedAt: new Date().toISOString()
    };
    const index = state.monthlyOverheadSettings.findIndex(item => item.month === month);
    if (index >= 0) state.monthlyOverheadSettings[index] = { ...state.monthlyOverheadSettings[index], ...setting };
    else state.monthlyOverheadSettings.push({ ...setting, createdAt: new Date().toISOString() });
    state.business.pricingMonth = month;
    const changed = window.MoorePrintSupplierCatalog?.refreshAutomaticProductPrices?.() || 0;
    if (showMessage) saveState(`Costos de ${monthLabel(month)} guardados${changed ? ` · ${changed} precio${changed === 1 ? '' : 's'} actualizado${changed === 1 ? '' : 's'}` : ''}`);
    else persistState();
  }

  function copyPreviousMonthCosts() {
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return;
    const targetMonth = panel.querySelector('#monthlyCostMonth')?.value || pricingMonth();
    const sourceMonth = previousMonth(targetMonth);
    const sourceRows = monthRows(sourceMonth);
    if (!sourceRows.length) return showToast(`No hay costos guardados en ${monthLabel(sourceMonth)}`, 'warning');
    const copied = sourceRows.map(row => ({
      ...row, id: uid('monthly-cost'), month: targetMonth,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }));
    state.monthlyOverheads = state.monthlyOverheads.filter(row => row.month !== targetMonth).concat(copied);
    const setting = {
      month: targetMonth,
      productiveHours: num(monthSetting(sourceMonth)?.productiveHours) || productiveHours(sourceMonth),
      updatedAt: new Date().toISOString()
    };
    const index = state.monthlyOverheadSettings.findIndex(item => item.month === targetMonth);
    if (index >= 0) state.monthlyOverheadSettings[index] = { ...state.monthlyOverheadSettings[index], ...setting };
    else state.monthlyOverheadSettings.push({ ...setting, createdAt: new Date().toISOString() });
    state.business.pricingMonth = targetMonth;
    saveState(`Se copiaron ${copied.length} costo${copied.length === 1 ? '' : 's'} de ${monthLabel(sourceMonth)}`);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'addMonthlyCost') {
        const panel = document.querySelector('#monthlyCostPanel');
        const list = panel?.querySelector('#monthlyCostRows');
        const month = panel?.querySelector('#monthlyCostMonth')?.value || pricingMonth();
        if (list?.querySelector('.monthly-cost-empty')) list.innerHTML = '';
        list?.insertAdjacentHTML('beforeend', monthlyCostRow({}, month));
        updatePanelPreview();
      }
      if (target.dataset.removeMonthlyCost !== undefined) {
        const row = target.closest('.monthly-cost-row');
        const list = row?.parentElement;
        row?.remove();
        if (list && !list.querySelector('.monthly-cost-row')) {
          list.innerHTML = '<div class="monthly-cost-empty"><strong>No hay costos en este mes.</strong><p>Agrega luz, renta, personal u otro pago fijo.</p></div>';
        }
        updatePanelPreview();
      }
      if (target.id === 'saveMonthlyCosts') {
        const panel = document.querySelector('#monthlyCostPanel');
        persistPanelMonth(panel?.querySelector('#monthlyCostMonth')?.value || pricingMonth(), true);
      }
      if (target.id === 'copyPreviousMonthlyCosts') copyPreviousMonthCosts();
    });

    document.addEventListener('input', event => {
      if (event.target.closest('#monthlyCostPanel')) updatePanelPreview();
    });

    document.addEventListener('change', event => {
      if (event.target.id === 'monthlyCostMonth') {
        const panel = document.querySelector('#monthlyCostPanel');
        const oldMonth = panel?.dataset.month;
        if (oldMonth) persistPanelMonth(oldMonth, false);
        state.business.pricingMonth = event.target.value || localMonthKey();
        persistState();
        renderAll();
      }
      if (event.target.classList.contains('monthly-cost-category')) {
        const row = event.target.closest('.monthly-cost-row');
        const name = row?.querySelector('.monthly-cost-name');
        if (name && (!name.value.trim() || Object.values(CATEGORY_LABELS).includes(name.value.trim()))) {
          name.value = defaultConcept(event.target.value);
        }
        updatePanelPreview();
      }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    normalize();
    bindEvents();
    render();
  }

  window.MoorePrintMonthlyCosts = {
    init,
    normalize,
    render,
    pricingMonth,
    monthlyTotal,
    productiveHours,
    costPerProductiveHour,
    productMonthlyOverhead
  };
})();