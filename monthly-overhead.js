(function () {
  let initialized = false;
  let baseProductBreakdown = null;

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
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

  function normalizeMonthlyCosts() {
    state.monthlyOverheads = Array.isArray(state.monthlyOverheads) ? state.monthlyOverheads : [];
    state.monthlyOverheadSettings = Array.isArray(state.monthlyOverheadSettings) ? state.monthlyOverheadSettings : [];
    state.business = {
      ...(state.business || {}),
      pricingMonth: state.business?.pricingMonth || localMonthKey()
    };
    state.products = Array.isArray(state.products) ? state.products.map(product => ({
      productionMinutes: 0,
      ...product
    })) : [];
  }

  function pricingMonth() {
    normalizeMonthlyCosts();
    return state.business.pricingMonth || localMonthKey();
  }

  function monthRows(month = pricingMonth()) {
    normalizeMonthlyCosts();
    return state.monthlyOverheads.filter(row => row.month === month && row.active !== false);
  }

  function rowTotal(row) {
    return Math.max(0, num(row.quantity) || 0) * Math.max(0, num(row.unitAmount) || 0);
  }

  function monthlyTotal(month = pricingMonth()) {
    return sum(monthRows(month), rowTotal);
  }

  function monthSetting(month = pricingMonth()) {
    normalizeMonthlyCosts();
    return state.monthlyOverheadSettings.find(item => item.month === month) || null;
  }

  function productiveHours(month = pricingMonth()) {
    const setting = monthSetting(month);
    return Math.max(1, num(setting?.productiveHours) || num(state.business.monthlyHours) || 160);
  }

  function costPerProductiveHour(month = pricingMonth()) {
    return monthlyTotal(month) / productiveHours(month);
  }

  function productMonthlyOverhead(product, month = pricingMonth()) {
    const minutes = Math.max(0, num(product?.productionMinutes));
    return costPerProductiveHour(month) * minutes / 60;
  }

  function categoryOptions(selected = 'luz') {
    return Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }

  function defaultConcept(category) {
    return CATEGORY_LABELS[category] || 'Costo fijo';
  }

  function monthlyCostRow(row = {}, month = pricingMonth()) {
    const item = {
      id: row.id || uid('monthly-cost'),
      month,
      category: row.category || 'luz',
      name: row.name || defaultConcept(row.category || 'luz'),
      quantity: Math.max(1, num(row.quantity) || 1),
      unitAmount: Math.max(0, num(row.unitAmount)),
      notes: row.notes || '',
      active: row.active !== false,
      ...row
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
      <div class="panel-header"><div><h2>Costos fijos mensuales para calcular precios</h2><p>Distribuye luz, renta, personal y otros pagos según el tiempo que tarda cada producto.</p></div></div>
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
      <div class="monthly-cost-note"><strong>Importante:</strong> esta sección sirve para repartir costos dentro del precio de tus productos. Para evitar contar el mismo gasto dos veces en los reportes, no registres aquí y en Gastos el mismo importe como costo de producción sin revisar tus resultados.</div>
      <div class="monthly-cost-cloud" id="monthlyCostCloudStatus"><span class="dot"></span><span>Guardado local; esperando sincronización.</span></div>
    </article>`;
    if (firstPanel) firstPanel.insertAdjacentHTML('beforebegin', html);
    else section.insertAdjacentHTML('beforeend', html);
  }

  function renderMonthlyCostPanel() {
    ensurePanel();
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return;
    const month = pricingMonth();
    panel.dataset.month = month;
    const monthInput = panel.querySelector('#monthlyCostMonth');
    const hoursInput = panel.querySelector('#monthlyProductiveHours');
    const rows = monthRows(month);
    if (monthInput) monthInput.value = month;
    if (hoursInput) hoursInput.value = productiveHours(month);
    const list = panel.querySelector('#monthlyCostRows');
    if (list) list.innerHTML = rows.length ? rows.map(row => monthlyCostRow(row, month)).join('') : '<div class="monthly-cost-empty"><strong>No hay costos en este mes.</strong><p>Agrega luz, renta, personal u otro pago fijo.</p></div>';
    updatePanelPreview();
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
    return [...panel.querySelectorAll('.monthly-cost-row')].map(element => rowFromElement(element, month)).filter(row => row.name && row.quantity > 0);
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
    const totalNode = panel.querySelector('#monthlyCostTotal');
    const hoursNode = panel.querySelector('#monthlyCostHours');
    const hourlyNode = panel.querySelector('#monthlyCostHourly');
    const countNode = panel.querySelector('#monthlyCostCount');
    if (totalNode) totalNode.textContent = money(total);
    if (hoursNode) hoursNode.textContent = `${hours.toFixed(0)} h`;
    if (hourlyNode) hourlyNode.textContent = money(total / hours);
    if (countNode) countNode.textContent = String(rows.length);
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

    const hours = Math.max(1, num(panel.querySelector('#monthlyProductiveHours')?.value) || num(state.business.monthlyHours) || 160);
    const setting = { month, productiveHours: hours, updatedAt: new Date().toISOString() };
    const settingIndex = state.monthlyOverheadSettings.findIndex(item => item.month === month);
    if (settingIndex >= 0) state.monthlyOverheadSettings[settingIndex] = { ...state.monthlyOverheadSettings[settingIndex], ...setting };
    else state.monthlyOverheadSettings.push({ ...setting, createdAt: new Date().toISOString() });

    state.business.pricingMonth = month;
    const changed = window.MoorePrintSupplierCatalog?.refreshAutomaticProductPrices?.() || 0;
    if (showMessage) saveState(`Costos de ${monthLabel(month)} guardados${changed ? ` · ${changed} precio${changed === 1 ? '' : 's'} actualizado${changed === 1 ? '' : 's'}` : ''}`);
    else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
    }
  }

  function copyPreviousMonthCosts() {
    const panel = document.querySelector('#monthlyCostPanel');
    if (!panel) return;
    const targetMonth = panel.querySelector('#monthlyCostMonth')?.value || pricingMonth();
    const sourceMonth = previousMonth(targetMonth);
    const sourceRows = monthRows(sourceMonth);
    if (!sourceRows.length) return showToast(`No hay costos guardados en ${monthLabel(sourceMonth)}`, 'warning');
    const copied = sourceRows.map(row => ({ ...row, id: uid('monthly-cost'), month: targetMonth, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    state.monthlyOverheads = state.monthlyOverheads.filter(row => row.month !== targetMonth).concat(copied);
    const sourceSetting = monthSetting(sourceMonth);
    const setting = { month: targetMonth, productiveHours: num(sourceSetting?.productiveHours) || productiveHours(sourceMonth), updatedAt: new Date().toISOString() };
    const index = state.monthlyOverheadSettings.findIndex(item => item.month === targetMonth);
    if (index >= 0) state.monthlyOverheadSettings[index] = { ...state.monthlyOverheadSettings[index], ...setting };
    else state.monthlyOverheadSettings.push({ ...setting, createdAt: new Date().toISOString() });
    state.business.pricingMonth = targetMonth;
    saveState(`Se copiaron ${copied.length} costo${copied.length === 1 ? '' : 's'} de ${monthLabel(sourceMonth)}`);
  }

  function productFromForm(form) {
    const data = Object.fromEntries(new FormData(form));
    const recipe = $$('.line-row.recipe', form).map(row => ({ materialId: $('.recipe-material', row).value, qty: num($('.recipe-qty', row).value) })).filter(row => row.materialId && row.qty > 0);
    return {
      id: data.id || uid('product'),
      name: String(data.name || '').trim(),
      category: String(data.category || '').trim(),
      salePrice: num(data.salePrice),
      taxPercent: num(data.taxPercent),
      recipe,
      laborCost: num(data.laborCost),
      designCost: num(data.designCost),
      electricityCost: num(data.electricityCost),
      packagingCost: num(data.packagingCost),
      transportCost: num(data.transportCost),
      externalCost: num(data.externalCost),
      extraCost: num(data.extraCost),
      wastePercent: num(data.wastePercent),
      commissionPercent: num(data.commissionPercent),
      autoPrice: Boolean(form.elements.autoPrice?.checked),
      targetMarginPercent: num(data.targetMarginPercent) || 40,
      priceRounding: num(data.priceRounding) || 1,
      productionMinutes: Math.max(0, num(data.productionMinutes)),
      notes: String(data.notes || '').trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function recommendedPrice(product) {
    if (window.MoorePrintSupplierCatalog?.recommendedProductPrice) return window.MoorePrintSupplierCatalog.recommendedProductPrice(product);
    const breakdown = productBreakdown({ ...product, commissionPercent: 0 }, 0);
    const margin = Math.max(0, Math.min(90, num(product.targetMarginPercent))) / 100;
    const commission = Math.max(0, Math.min(60, num(product.commissionPercent))) / 100;
    const raw = breakdown.total / Math.max(0.05, 1 - margin - commission);
    const rounding = Math.max(0.01, num(product.priceRounding) || 1);
    return Math.ceil(raw / rounding) * rounding;
  }

  function injectProductOverhead(form) {
    if (!form || form.querySelector('#productOverheadSection')) return;
    const id = form.elements.id?.value || '';
    const product = state.products.find(item => item.id === id) || { productionMinutes: 0 };
    const month = pricingMonth();
    const total = monthlyTotal(month);
    const hourly = costPerProductiveHour(month);
    const assigned = productMonthlyOverhead(product, month);
    const summary = form.querySelector('.summary-box');
    summary?.insertAdjacentHTML('beforebegin', `<div class="form-section overhead-product-box" id="productOverheadSection">
      <div class="section-title"><div><h3>Parte proporcional de luz, renta y personal</h3><p>Se usa ${esc(monthLabel(month))}. El cálculo depende del tiempo de producción por unidad.</p></div></div>
      <div class="overhead-product-grid">
        <label>Tiempo de producción por unidad (minutos)<input name="productionMinutes" class="product-cost-input" type="number" min="0" step="0.1" value="${num(product.productionMinutes)}" placeholder="Ej. 12"></label>
        <div class="overhead-product-stat"><span>Costos fijos del mes</span><strong id="productMonthlyFixedTotal">${money(total)}</strong></div>
        <div class="overhead-product-stat"><span>Costo fijo por hora</span><strong id="productHourlyFixedCost">${money(hourly)}</strong></div>
        <div class="overhead-product-stat"><span>Costo asignado a esta unidad</span><strong class="overhead-highlight" id="productAssignedOverhead">${money(assigned)}</strong></div>
      </div>
      <small class="field-help">Ejemplo: si los costos fijos suman $8,000, hay 160 horas productivas y el producto tarda 15 minutos, se agregan $12.50 a su costo.</small>
    </div>`);
  }

  function refreshProductPreview() {
    const form = document.querySelector('#productForm');
    if (!form) return;
    const product = productFromForm(form);
    const recommended = recommendedPrice(product);
    if (product.autoPrice && form.elements.salePrice) {
      form.elements.salePrice.value = recommended.toFixed(2);
      product.salePrice = recommended;
    }
    const breakdown = productBreakdown(product, product.salePrice);
    const materialNode = document.querySelector('#productMaterialPreview');
    const costNode = document.querySelector('#productCostPreview');
    const profitNode = document.querySelector('#productProfitPreview');
    const recommendedNode = document.querySelector('#recommendedProductPrice');
    const assignedNode = document.querySelector('#productAssignedOverhead');
    const totalNode = document.querySelector('#productMonthlyFixedTotal');
    const hourlyNode = document.querySelector('#productHourlyFixedCost');
    if (materialNode) materialNode.textContent = money(breakdown.material);
    if (costNode) costNode.textContent = money(breakdown.total);
    if (profitNode) {
      profitNode.textContent = money(breakdown.profit);
      profitNode.className = breakdown.profit < 0 ? 'money-negative' : 'money-positive';
    }
    if (recommendedNode) recommendedNode.textContent = money(recommended);
    if (assignedNode) assignedNode.textContent = money(breakdown.overhead || 0);
    if (totalNode) totalNode.textContent = money(monthlyTotal());
    if (hourlyNode) hourlyNode.textContent = money(costPerProductiveHour());
  }

  function saveProductWithOverhead(form) {
    const product = productFromForm(form);
    if (!product.name) return showToast('Escribe el nombre del producto', 'error');
    if (product.autoPrice) product.salePrice = recommendedPrice(product);
    const index = state.products.findIndex(item => item.id === product.id);
    if (index >= 0) state.products[index] = { ...state.products[index], ...product };
    else state.products.push({ ...product, createdAt: new Date().toISOString() });
    closeModal(true);
    saveState(index >= 0 ? 'Producto, costos y precio actualizados' : 'Producto, costos y precio agregados');
  }

  function wrapCalculationsAndProducts() {
    baseProductBreakdown = productBreakdown;
    productBreakdown = function (product, salePrice = product?.salePrice) {
      const base = baseProductBreakdown(product, salePrice);
      const overhead = productMonthlyOverhead(product, pricingMonth());
      const process = num(base.process) + overhead;
      const total = num(base.total) + overhead;
      return {
        ...base,
        overhead,
        process,
        total,
        profit: num(salePrice) - total
      };
    };

    const baseOpenProductModal = openProductModal;
    openProductModal = function (...args) {
      baseOpenProductModal(...args);
      const form = document.querySelector('#productForm');
      injectProductOverhead(form);
      refreshProductPreview();
    };

    const baseUpdateProductPreview = updateProductCostPreview;
    updateProductCostPreview = function () {
      baseUpdateProductPreview();
      refreshProductPreview();
    };

    saveProduct = saveProductWithOverhead;

    const baseRenderAll = renderAll;
    renderAll = function () {
      normalizeMonthlyCosts();
      const result = baseRenderAll();
      renderMonthlyCostPanel();
      return result;
    };
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
        if (list && !list.querySelector('.monthly-cost-row')) list.innerHTML = '<div class="monthly-cost-empty"><strong>No hay costos en este mes.</strong><p>Agrega luz, renta, personal u otro pago fijo.</p></div>';
        updatePanelPreview();
      }
      if (target.id === 'saveMonthlyCosts') {
        const panel = document.querySelector('#monthlyCostPanel');
        const month = panel?.querySelector('#monthlyCostMonth')?.value || pricingMonth();
        persistPanelMonth(month, true);
      }
      if (target.id === 'copyPreviousMonthlyCosts') copyPreviousMonthCosts();
    });

    document.addEventListener('input', event => {
      if (event.target.closest('#monthlyCostPanel')) updatePanelPreview();
      if (event.target.name === 'productionMinutes') refreshProductPreview();
    });

    document.addEventListener('change', event => {
      if (event.target.id === 'monthlyCostMonth') {
        const panel = document.querySelector('#monthlyCostPanel');
        const oldMonth = panel?.dataset.month;
        if (oldMonth) persistPanelMonth(oldMonth, false);
        state.business.pricingMonth = event.target.value || localMonthKey();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
      }
      if (event.target.classList.contains('monthly-cost-category')) {
        const row = event.target.closest('.monthly-cost-row');
        const name = row?.querySelector('.monthly-cost-name');
        if (name && (!name.value.trim() || Object.values(CATEGORY_LABELS).includes(name.value.trim()))) name.value = defaultConcept(event.target.value);
        updatePanelPreview();
      }
    });
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    normalizeMonthlyCosts();
    wrapCalculationsAndProducts();
    bindEvents();
    renderMonthlyCostPanel();
    window.MoorePrintMonthlyCosts = {
      normalize: normalizeMonthlyCosts,
      pricingMonth,
      monthlyTotal,
      productiveHours,
      costPerProductiveHour,
      productMonthlyOverhead,
      refreshPanel: renderMonthlyCostPanel
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
