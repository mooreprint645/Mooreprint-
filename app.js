const STORAGE_KEY = 'mooreprint-control-v1';

const defaultState = {
  products: [],
  orders: [],
  expenses: [],
  business: {
    name: 'MoorePrint',
    phone: '',
    city: 'Toluca, Estado de México',
    note: 'Gracias por su compra.'
  }
};

let state = loadState();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => Number.parseFloat(value) || 0;
const money = value => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
}).format(number(value));
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[character]);

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return cloneDefaultState();
    return {
      products: Array.isArray(saved.products) ? saved.products : [],
      orders: Array.isArray(saved.orders) ? saved.orders : [],
      expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
      business: { ...defaultState.business, ...(saved.business || {}) }
    };
  } catch (error) {
    return cloneDefaultState();
  }
}

function saveState(message = '') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if (message) showToast(message);
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${isError ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = 'toast'; }, 2600);
}

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(`${date}T12:00:00`));
}

function categoryName(category) {
  const names = {
    materiales: 'Materiales',
    pasajes: 'Pasajes',
    gasolina: 'Gasolina',
    gas: 'Gas',
    renta_local: 'Renta o local',
    servicios: 'Servicios',
    mantenimiento: 'Mantenimiento',
    otros: 'Otros'
  };
  return names[category] || category || 'Otros';
}

function orderStatusName(status) {
  const names = {
    pendiente: 'Pendiente',
    en_proceso: 'En proceso',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };
  return names[status] || status;
}

function productCost(product) {
  return number(product.materialCost) + number(product.laborCost) + number(product.extraCost);
}

function orderTotals(order) {
  const sales = (order.items || []).reduce((sum, item) => sum + number(item.qty) * number(item.price), 0);
  const costs = (order.items || []).reduce((sum, item) => sum + number(item.qty) * number(item.cost), 0);
  return {
    sales,
    costs,
    profit: sales - costs,
    balance: Math.max(0, sales - number(order.paid))
  };
}

function inRange(date, from, to) {
  if (!date) return false;
  return (!from || date >= from) && (!to || date <= to);
}

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: toISO(first), to: toISO(last) };
}

function nextFolio() {
  const highest = state.orders.reduce((max, order) => {
    const match = String(order.folio || '').match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `MP-${String(highest + 1).padStart(4, '0')}`;
}

function navigate(section) {
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === section));
  $$('.page-section').forEach(page => page.classList.toggle('active', page.id === section));
  const activeButton = $(`.nav-item[data-section="${section}"]`);
  $('#pageTitle').textContent = activeButton ? activeButton.textContent.trim().replace(/^[^\s]+\s/, '') : 'MoorePrint';
  $('#sidebar').classList.remove('open');
  if (section === 'reports') renderReports();
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderOrders();
  renderExpenses();
  renderReports();
  fillBusinessForm();
}

function periodData(period = 'month') {
  const range = period === 'month' ? currentMonthRange() : { from: '', to: '' };
  const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, range.from, range.to));
  const expenses = state.expenses.filter(expense => inRange(expense.date, range.from, range.to));
  const sales = orders.reduce((sum, order) => sum + orderTotals(order).sales, 0);
  const production = orders.reduce((sum, order) => sum + orderTotals(order).costs, 0);
  const operating = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const profit = sales - production - operating;
  const receivable = orders.reduce((sum, order) => sum + orderTotals(order).balance, 0);
  return { orders, expenses, sales, production, operating, profit, receivable };
}

function renderDashboard() {
  const period = $('#dashboardPeriod')?.value || 'month';
  const data = periodData(period);
  $('#metricSales').textContent = money(data.sales);
  $('#metricOrders').textContent = `${data.orders.length} pedido${data.orders.length === 1 ? '' : 's'}`;
  $('#metricProduction').textContent = money(data.production);
  $('#metricExpenses').textContent = money(data.operating);
  $('#metricProfit').textContent = money(data.profit);
  $('#metricProfit').className = data.profit < 0 ? 'money-negative' : '';
  const margin = data.sales ? data.profit / data.sales * 100 : 0;
  $('#metricMargin').textContent = `Margen ${margin.toFixed(1)}%`;
  $('#receivableTotal').textContent = money(data.receivable);

  const chartData = [
    { label: 'Ventas', value: data.sales, className: '' },
    { label: 'Producción', value: data.production, className: 'cost' },
    { label: 'Gastos', value: data.operating, className: 'expense' },
    { label: 'Ganancia', value: Math.max(0, data.profit), className: 'profit' }
  ];
  const maximum = Math.max(...chartData.map(item => item.value), 1);
  $('#summaryChart').innerHTML = chartData.map(item => `
    <div class="bar-item">
      <strong>${money(item.value)}</strong>
      <div class="bar ${item.className}" style="height:${Math.max(4, item.value / maximum * 145)}px"></div>
      <span>${item.label}</span>
    </div>
  `).join('');

  const pending = data.orders
    .map(order => ({ order, ...orderTotals(order) }))
    .filter(item => item.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  $('#pendingPayments').innerHTML = pending.length
    ? pending.map(item => `<div class="mini-row"><div><strong>${escapeHtml(item.order.customer)}</strong><small>${escapeHtml(item.order.folio)}</small></div><span>${money(item.balance)}</span></div>`).join('')
    : '<p class="empty-message">No hay cobros pendientes.</p>';

  const recentOrders = [...state.orders]
    .sort((a, b) => String(b.createdAt || b.orderDate).localeCompare(String(a.createdAt || a.orderDate)))
    .slice(0, 6);

  $('#recentOrdersTable').innerHTML = recentOrders.length
    ? recentOrders.map(order => {
      const totals = orderTotals(order);
      return `<tr>
        <td><strong>${escapeHtml(order.folio)}</strong></td>
        <td>${escapeHtml(order.customer)}</td>
        <td>${formatDate(order.orderDate)}</td>
        <td><span class="badge ${order.status}">${orderStatusName(order.status)}</span></td>
        <td>${money(totals.sales)}</td>
        <td class="${totals.profit < 0 ? 'money-negative' : 'money-positive'}">${money(totals.profit)}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6">No hay pedidos registrados.</td></tr>';
}

function renderProducts() {
  const query = ($('#productSearch')?.value || '').trim().toLowerCase();
  const products = state.products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query));
  $('#productsEmpty').style.display = state.products.length ? 'none' : 'block';
  $('#productGrid').innerHTML = products.map(product => {
    const cost = productCost(product);
    const profit = number(product.salePrice) - cost;
    const margin = number(product.salePrice) ? profit / number(product.salePrice) * 100 : 0;
    return `<article class="product-card">
      <div class="product-card-header">
        <div><h3>${escapeHtml(product.name)}</h3><span class="category">${escapeHtml(product.category || 'Sin categoría')}</span></div>
        <div class="action-group">
          <button class="action-button" data-edit-product="${product.id}" title="Editar">✎</button>
          <button class="action-button" data-delete-product="${product.id}" title="Eliminar">×</button>
        </div>
      </div>
      <div class="product-price">${money(product.salePrice)}</div>
      <div class="cost-list">
        <div class="cost-line"><span>Materiales</span><strong>${money(product.materialCost)}</strong></div>
        <div class="cost-line"><span>Mano de obra</span><strong>${money(product.laborCost)}</strong></div>
        <div class="cost-line"><span>Otros costos</span><strong>${money(product.extraCost)}</strong></div>
        <div class="cost-line total"><span>Costo unitario</span><strong>${money(cost)}</strong></div>
      </div>
      <div class="product-footer">
        <strong class="${profit < 0 ? 'money-negative' : 'money-positive'}">Ganas ${money(profit)}</strong>
        <span class="margin-pill ${margin < 20 ? 'low' : ''}">${margin.toFixed(1)}%</span>
      </div>
    </article>`;
  }).join('');
}

function renderOrders() {
  const query = ($('#orderSearch')?.value || '').trim().toLowerCase();
  const status = $('#orderStatusFilter')?.value || 'all';
  const orders = [...state.orders]
    .filter(order => status === 'all' || order.status === status)
    .filter(order => `${order.folio} ${order.customer} ${(order.items || []).map(item => item.name).join(' ')}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));

  $('#ordersEmpty').style.display = state.orders.length ? 'none' : 'block';
  $('#ordersTable').innerHTML = orders.map(order => {
    const totals = orderTotals(order);
    const description = (order.items || []).map(item => `${item.qty} ${item.name}`).join(', ');
    return `<tr>
      <td><strong>${escapeHtml(order.folio)}</strong></td>
      <td><strong>${escapeHtml(order.customer)}</strong><br><small>${escapeHtml(order.phone || '')}</small></td>
      <td title="${escapeHtml(description)}">${escapeHtml(description.slice(0, 52))}${description.length > 52 ? '…' : ''}</td>
      <td>${formatDate(order.dueDate)}</td>
      <td><span class="badge ${order.status}">${orderStatusName(order.status)}</span></td>
      <td>${money(totals.sales)}</td>
      <td>${money(order.paid)}<br><small>Falta ${money(totals.balance)}</small></td>
      <td><div class="action-group">
        <button class="action-button" data-view-order="${order.id}" title="Ver e imprimir">🧾</button>
        <button class="action-button" data-edit-order="${order.id}" title="Editar">✎</button>
        <button class="action-button" data-delete-order="${order.id}" title="Eliminar">×</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderExpenses() {
  const query = ($('#expenseSearch')?.value || '').trim().toLowerCase();
  const category = $('#expenseCategoryFilter')?.value || 'all';
  const expenses = [...state.expenses]
    .filter(expense => category === 'all' || expense.category === category)
    .filter(expense => `${expense.description} ${categoryName(expense.category)}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  $('#expensesEmpty').style.display = state.expenses.length ? 'none' : 'block';
  $('#expensesTable').innerHTML = expenses.map(expense => `<tr>
    <td>${formatDate(expense.date)}</td>
    <td>${categoryName(expense.category)}</td>
    <td>${escapeHtml(expense.description)}</td>
    <td class="money-negative">${money(expense.amount)}</td>
    <td><div class="action-group">
      <button class="action-button" data-edit-expense="${expense.id}">✎</button>
      <button class="action-button" data-delete-expense="${expense.id}">×</button>
    </div></td>
  </tr>`).join('');
}

function renderReports() {
  if (!$('#reportFrom')) return;
  let from = $('#reportFrom').value;
  let to = $('#reportTo').value;
  if (!from && !to) {
    const month = currentMonthRange();
    from = month.from;
    to = month.to;
    $('#reportFrom').value = from;
    $('#reportTo').value = to;
  }

  const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to));
  const expenses = state.expenses.filter(expense => inRange(expense.date, from, to));
  const sales = orders.reduce((sum, order) => sum + orderTotals(order).sales, 0);
  const costs = orders.reduce((sum, order) => sum + orderTotals(order).costs, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const net = sales - costs - expenseTotal;

  $('#reportSales').textContent = money(sales);
  $('#reportCosts').textContent = money(costs);
  $('#reportExpenses').textContent = money(expenseTotal);
  $('#reportNet').textContent = money(net);
  $('#reportNet').className = net < 0 ? 'money-negative' : 'money-positive';

  const grouped = expenses.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + number(expense.amount);
    return result;
  }, {});
  const expenseRows = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const maximumExpense = Math.max(...expenseRows.map(([, value]) => value), 1);

  $('#expenseCategoryReport').innerHTML = expenseRows.length
    ? expenseRows.map(([key, value]) => `<div class="category-row">
      <span>${categoryName(key)}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${value / maximumExpense * 100}%"></div></div>
      <strong>${money(value)}</strong>
    </div>`).join('')
    : '<p class="empty-message">Sin gastos en este periodo.</p>';

  const productSales = {};
  orders.forEach(order => (order.items || []).forEach(item => {
    const name = item.name || 'Sin nombre';
    productSales[name] = (productSales[name] || 0) + number(item.qty) * number(item.price);
  }));
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $('#topProductsReport').innerHTML = topProducts.length
    ? topProducts.map(([name, value], index) => `<div class="mini-row"><div><strong>${index + 1}. ${escapeHtml(name)}</strong></div><span>${money(value)}</span></div>`).join('')
    : '<p class="empty-message">Sin ventas en este periodo.</p>';
}

function openModal(content) {
  $('#modalContainer').innerHTML = content;
  $('#modalBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modalBackdrop').hidden = true;
  $('#modalContainer').innerHTML = '';
  document.body.style.overflow = '';
}

function modalShell(title, body, footer = '') {
  return `<div class="modal-header">
    <h2 id="modalTitle">${escapeHtml(title)}</h2>
    <button class="modal-close" data-close-modal>×</button>
  </div>
  <div class="modal-body">${body}</div>
  ${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
}

function openProductModal(productId = '') {
  const product = state.products.find(item => item.id === productId) || {};
  openModal(modalShell(productId ? 'Editar producto' : 'Nuevo producto', `
    <form id="productForm" class="modal-form">
      <input type="hidden" name="id" value="${escapeHtml(product.id || '')}">
      <label class="full">Nombre del producto<input name="name" required value="${escapeHtml(product.name || '')}" placeholder="Ej. Taza sublimada"></label>
      <label>Categoría<input name="category" value="${escapeHtml(product.category || '')}" placeholder="Sublimación, lona, papelería..."></label>
      <label>Precio de venta por unidad<input name="salePrice" type="number" min="0" step="0.01" required value="${number(product.salePrice)}"></label>
      <label>Costo de materiales<input name="materialCost" type="number" min="0" step="0.01" value="${number(product.materialCost)}"></label>
      <label>Costo de mano de obra<input name="laborCost" type="number" min="0" step="0.01" value="${number(product.laborCost)}"></label>
      <label>Otros costos por unidad<input name="extraCost" type="number" min="0" step="0.01" value="${number(product.extraCost)}"></label>
      <label class="full">Notas<textarea name="notes" rows="3" placeholder="Tamaño, material o proceso">${escapeHtml(product.notes || '')}</textarea></label>
    </form>
  `, `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" type="submit" form="productForm">Guardar producto</button>`));
}

function saveProduct(form) {
  const data = Object.fromEntries(new FormData(form));
  const product = {
    id: data.id || uid('product'),
    name: data.name.trim(),
    category: data.category.trim(),
    salePrice: number(data.salePrice),
    materialCost: number(data.materialCost),
    laborCost: number(data.laborCost),
    extraCost: number(data.extraCost),
    notes: data.notes.trim(),
    updatedAt: new Date().toISOString()
  };
  const index = state.products.findIndex(item => item.id === product.id);
  if (index >= 0) state.products[index] = { ...state.products[index], ...product };
  else state.products.push({ ...product, createdAt: new Date().toISOString() });
  closeModal();
  saveState(index >= 0 ? 'Producto actualizado' : 'Producto agregado');
}

function lineTemplate(item = {}) {
  const options = state.products.map(product => `<option value="${product.id}" ${item.productId === product.id ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('');
  return `<div class="order-line">
    <select class="line-product" aria-label="Producto"><option value="">Concepto personalizado</option>${options}</select>
    <input class="line-qty" type="number" min="1" step="1" value="${number(item.qty) || 1}" aria-label="Cantidad">
    <input class="line-price" type="number" min="0" step="0.01" value="${number(item.price)}" placeholder="Venta" aria-label="Precio de venta">
    <input class="line-cost" type="number" min="0" step="0.01" value="${number(item.cost)}" placeholder="Costo" aria-label="Costo">
    <button type="button" class="action-button remove-line" title="Quitar">×</button>
    <input class="line-name" type="text" value="${escapeHtml(item.name || '')}" placeholder="Nombre o descripción del trabajo" style="grid-column:1 / -1">
  </div>`;
}

function openOrderModal(orderId = '') {
  const order = state.orders.find(item => item.id === orderId) || {
    folio: nextFolio(), customer: '', phone: '', orderDate: todayISO(), dueDate: todayISO(),
    status: 'pendiente', paid: 0, notes: '', items: [{}]
  };
  openModal(modalShell(orderId ? `Editar pedido ${order.folio}` : 'Nuevo pedido', `
    <form id="orderForm" class="modal-form">
      <input type="hidden" name="id" value="${escapeHtml(order.id || '')}">
      <input type="hidden" name="folio" value="${escapeHtml(order.folio)}">
      <label>Cliente<input name="customer" required value="${escapeHtml(order.customer)}" placeholder="Nombre del cliente"></label>
      <label>Teléfono<input name="phone" value="${escapeHtml(order.phone || '')}" placeholder="722 000 0000"></label>
      <label>Fecha del pedido<input name="orderDate" type="date" required value="${order.orderDate}"></label>
      <label>Fecha de entrega<input name="dueDate" type="date" required value="${order.dueDate}"></label>
      <label>Estado<select name="status">
        ${['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'].map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${orderStatusName(status)}</option>`).join('')}
      </select></label>
      <label>Anticipo o cantidad pagada<input name="paid" type="number" min="0" step="0.01" value="${number(order.paid)}"></label>
      <div class="line-items">
        <div class="line-items-header">
          <div><strong>Productos o trabajos</strong><br><small>Venta y costo son valores por unidad.</small></div>
          <button type="button" class="button secondary" id="addOrderLine">+ Agregar</button>
        </div>
        <div id="orderLines">${(order.items?.length ? order.items : [{}]).map(lineTemplate).join('')}</div>
      </div>
      <label class="full">Notas del pedido<textarea name="notes" rows="3" placeholder="Colores, medidas, indicaciones o domicilio">${escapeHtml(order.notes || '')}</textarea></label>
      <div class="order-totals">
        <div class="total-row"><span>Venta total</span><strong id="orderSaleTotal">$0.00</strong></div>
        <div class="total-row"><span>Costo de producción</span><strong id="orderCostTotal">$0.00</strong></div>
        <div class="total-row net"><span>Ganancia estimada</span><strong id="orderProfitTotal">$0.00</strong></div>
      </div>
    </form>
  `, `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" type="submit" form="orderForm">Guardar pedido</button>`));
  updateOrderModalTotals();
}

function updateOrderModalTotals() {
  const container = $('#orderLines');
  if (!container) return;
  const lines = $$('.order-line', container);
  const sales = lines.reduce((sum, line) => sum + number($('.line-qty', line).value) * number($('.line-price', line).value), 0);
  const costs = lines.reduce((sum, line) => sum + number($('.line-qty', line).value) * number($('.line-cost', line).value), 0);
  $('#orderSaleTotal').textContent = money(sales);
  $('#orderCostTotal').textContent = money(costs);
  $('#orderProfitTotal').textContent = money(sales - costs);
  $('#orderProfitTotal').className = sales - costs < 0 ? 'money-negative' : 'money-positive';
}

function saveOrder(form) {
  const data = Object.fromEntries(new FormData(form));
  const items = $$('.order-line', form).map(line => {
    const productId = $('.line-product', line).value;
    const selectedProduct = state.products.find(product => product.id === productId);
    const customName = $('.line-name', line).value.trim();
    return {
      productId,
      name: customName || selectedProduct?.name || 'Trabajo sin nombre',
      qty: Math.max(1, number($('.line-qty', line).value)),
      price: number($('.line-price', line).value),
      cost: number($('.line-cost', line).value)
    };
  });
  if (!items.length) {
    showToast('Agrega al menos un producto al pedido', true);
    return;
  }
  const order = {
    id: data.id || uid('order'),
    folio: data.folio || nextFolio(),
    customer: data.customer.trim(),
    phone: data.phone.trim(),
    orderDate: data.orderDate,
    dueDate: data.dueDate,
    status: data.status,
    paid: number(data.paid),
    notes: data.notes.trim(),
    items,
    updatedAt: new Date().toISOString()
  };
  const index = state.orders.findIndex(item => item.id === order.id);
  if (index >= 0) state.orders[index] = { ...state.orders[index], ...order };
  else state.orders.push({ ...order, createdAt: new Date().toISOString() });
  closeModal();
  saveState(index >= 0 ? 'Pedido actualizado' : 'Pedido registrado');
}

function openExpenseModal(expenseId = '') {
  const expense = state.expenses.find(item => item.id === expenseId) || {
    date: todayISO(), category: 'materiales', description: '', amount: 0
  };
  openModal(modalShell(expenseId ? 'Editar gasto' : 'Nuevo gasto', `
    <form id="expenseForm" class="modal-form">
      <input type="hidden" name="id" value="${escapeHtml(expense.id || '')}">
      <label>Fecha<input name="date" type="date" required value="${expense.date}"></label>
      <label>Categoría<select name="category">
        ${['materiales', 'pasajes', 'gasolina', 'gas', 'renta_local', 'servicios', 'mantenimiento', 'otros'].map(category => `<option value="${category}" ${expense.category === category ? 'selected' : ''}>${categoryName(category)}</option>`).join('')}
      </select></label>
      <label class="full">Descripción<input name="description" required value="${escapeHtml(expense.description)}" placeholder="Ej. Pasaje para recoger tazas"></label>
      <label class="full">Monto<input name="amount" type="number" min="0" step="0.01" required value="${number(expense.amount)}"></label>
    </form>
  `, `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" type="submit" form="expenseForm">Guardar gasto</button>`));
}

function saveExpense(form) {
  const data = Object.fromEntries(new FormData(form));
  const expense = {
    id: data.id || uid('expense'),
    date: data.date,
    category: data.category,
    description: data.description.trim(),
    amount: number(data.amount),
    updatedAt: new Date().toISOString()
  };
  const index = state.expenses.findIndex(item => item.id === expense.id);
  if (index >= 0) state.expenses[index] = { ...state.expenses[index], ...expense };
  else state.expenses.push({ ...expense, createdAt: new Date().toISOString() });
  closeModal();
  saveState(index >= 0 ? 'Gasto actualizado' : 'Gasto registrado');
}

function openOrderPreview(orderId) {
  const order = state.orders.find(item => item.id === orderId);
  if (!order) return;
  const totals = orderTotals(order);
  const business = state.business;
  openModal(modalShell(`Nota ${order.folio}`, `
    <div class="note-preview">
      <div class="note-business">
        <h2>${escapeHtml(business.name)}</h2>
        <p>${escapeHtml(business.city || '')}</p>
        <p>${escapeHtml(business.phone || '')}</p>
      </div>
      <div class="note-meta">
        <div><strong>Folio:</strong> ${escapeHtml(order.folio)}</div>
        <div><strong>Pedido:</strong> ${formatDate(order.orderDate)}</div>
        <div><strong>Cliente:</strong> ${escapeHtml(order.customer)}</div>
        <div><strong>Entrega:</strong> ${formatDate(order.dueDate)}</div>
      </div>
      <table>
        <thead><tr><th>Cant.</th><th>Descripción</th><th>Precio</th><th>Importe</th></tr></thead>
        <tbody>${(order.items || []).map(item => `<tr><td>${item.qty}</td><td>${escapeHtml(item.name)}</td><td>${money(item.price)}</td><td>${money(number(item.qty) * number(item.price))}</td></tr>`).join('')}</tbody>
      </table>
      <div class="order-totals" style="margin-top:16px">
        <div class="total-row"><span>Total</span><strong>${money(totals.sales)}</strong></div>
        <div class="total-row"><span>Pagado</span><strong>${money(order.paid)}</strong></div>
        <div class="total-row net"><span>Restante</span><strong>${money(totals.balance)}</strong></div>
      </div>
      ${order.notes ? `<p style="margin-top:18px"><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>` : ''}
      <p style="text-align:center;margin-top:24px">${escapeHtml(business.note || '')}</p>
    </div>
  `, `<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" id="printOrderButton">Imprimir nota</button>`));
}

function confirmDelete(type, id) {
  const names = { product: 'producto', order: 'pedido', expense: 'gasto' };
  openModal(modalShell(`Eliminar ${names[type]}`, '<p>Esta acción no se puede deshacer. ¿Deseas continuar?</p>', `<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" data-confirm-delete="${type}" data-id="${id}">Eliminar</button>`));
}

function deleteItem(type, id) {
  if (type === 'product') state.products = state.products.filter(item => item.id !== id);
  if (type === 'order') state.orders = state.orders.filter(item => item.id !== id);
  if (type === 'expense') state.expenses = state.expenses.filter(item => item.id !== id);
  closeModal();
  saveState(`${type === 'order' ? 'Pedido' : type === 'product' ? 'Producto' : 'Gasto'} eliminado`);
}

function loadExamples() {
  const examples = [
    { name: 'Taza sublimada', category: 'Sublimación', salePrice: 120, materialCost: 38, laborCost: 18, extraCost: 5, notes: 'Taza blanca de 11 oz' },
    { name: 'Playera estampada', category: 'Textil', salePrice: 250, materialCost: 95, laborCost: 35, extraCost: 12, notes: 'Precio base; ajustar por talla y técnica' },
    { name: 'Lona impresa por m²', category: 'Gran formato', salePrice: 180, materialCost: 70, laborCost: 20, extraCost: 8, notes: 'Incluye impresión; no incluye instalación' },
    { name: 'Invitación personalizada', category: 'Papelería', salePrice: 18, materialCost: 5, laborCost: 4, extraCost: 1, notes: 'Costo por pieza' },
    { name: 'Etiqueta adhesiva', category: 'Etiquetas', salePrice: 6, materialCost: 1.5, laborCost: 1, extraCost: 0.5, notes: 'Costo estimado por pieza' }
  ];
  examples.forEach(example => {
    const exists = state.products.some(product => product.name.toLowerCase() === example.name.toLowerCase());
    if (!exists) state.products.push({ ...example, id: uid('product'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  });
  saveState('Productos de ejemplo agregados');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `mooreprint-respaldo-${todayISO()}.json`);
  showToast('Respaldo descargado');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.products) || !Array.isArray(imported.orders) || !Array.isArray(imported.expenses)) throw new Error('Formato inválido');
      state = {
        products: imported.products,
        orders: imported.orders,
        expenses: imported.expenses,
        business: { ...defaultState.business, ...(imported.business || {}) }
      };
      saveState('Respaldo importado correctamente');
    } catch (error) {
      showToast('El archivo no es un respaldo válido', true);
    }
  };
  reader.readAsText(file);
}

function exportCsv() {
  const from = $('#reportFrom').value;
  const to = $('#reportTo').value;
  const rows = [['Tipo', 'Fecha', 'Folio/Categoría', 'Cliente/Descripción', 'Venta', 'Costo', 'Gasto', 'Ganancia']];

  state.orders
    .filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to))
    .forEach(order => {
      const totals = orderTotals(order);
      rows.push(['Pedido', order.orderDate, order.folio, order.customer, totals.sales, totals.costs, 0, totals.profit]);
    });

  state.expenses
    .filter(expense => inRange(expense.date, from, to))
    .forEach(expense => rows.push(['Gasto', expense.date, categoryName(expense.category), expense.description, 0, 0, expense.amount, -number(expense.amount)]));

  const newline = String.fromCharCode(10);
  const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join(newline);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `reporte-mooreprint-${from || 'inicio'}-${to || 'hoy'}.csv`);
  showToast('Reporte CSV descargado');
}

function fillBusinessForm() {
  const form = $('#businessForm');
  if (!form) return;
  ['name', 'phone', 'city', 'note'].forEach(key => { form.elements[key].value = state.business[key] || ''; });
}

function setupEvents() {
  $$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  $('#dashboardPeriod').addEventListener('change', renderDashboard);
  $('#productSearch').addEventListener('input', renderProducts);
  $('#orderSearch').addEventListener('input', renderOrders);
  $('#orderStatusFilter').addEventListener('change', renderOrders);
  $('#expenseSearch').addEventListener('input', renderExpenses);
  $('#expenseCategoryFilter').addEventListener('change', renderExpenses);
  $('#reportFrom').addEventListener('change', renderReports);
  $('#reportTo').addEventListener('change', renderReports);
  $('#applyReportButton').addEventListener('click', renderReports);

  $('#newProductButton').addEventListener('click', () => openProductModal());
  $('#newOrderButton').addEventListener('click', () => openOrderModal());
  $('#quickOrderButton').addEventListener('click', () => { navigate('orders'); openOrderModal(); });
  $('#newExpenseButton').addEventListener('click', () => openExpenseModal());
  $('#loadExamplesButton').addEventListener('click', loadExamples);
  $('#backupButton').addEventListener('click', exportBackup);
  $('#exportBackupButton').addEventListener('click', exportBackup);
  $('#exportCsvButton').addEventListener('click', exportCsv);
  $('#importBackupInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) importBackup(file);
    event.target.value = '';
  });

  $('#businessForm').addEventListener('submit', event => {
    event.preventDefault();
    state.business = { ...state.business, ...Object.fromEntries(new FormData(event.target)) };
    saveState('Datos del negocio guardados');
  });

  $('#clearDataButton').addEventListener('click', () => {
    openModal(modalShell('Borrar todos los datos', '<p>Se eliminarán productos, pedidos, gastos y configuración guardados en este dispositivo. Descarga un respaldo antes si deseas conservarlos.</p>', '<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" id="confirmClearData">Borrar todo</button>'));
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('button, [data-close-modal]');
    if (!target) return;
    if (target.matches('[data-close-modal]')) closeModal();
    if (target.dataset.editProduct) openProductModal(target.dataset.editProduct);
    if (target.dataset.deleteProduct) confirmDelete('product', target.dataset.deleteProduct);
    if (target.dataset.editOrder) openOrderModal(target.dataset.editOrder);
    if (target.dataset.viewOrder) openOrderPreview(target.dataset.viewOrder);
    if (target.dataset.deleteOrder) confirmDelete('order', target.dataset.deleteOrder);
    if (target.dataset.editExpense) openExpenseModal(target.dataset.editExpense);
    if (target.dataset.deleteExpense) confirmDelete('expense', target.dataset.deleteExpense);
    if (target.dataset.confirmDelete) deleteItem(target.dataset.confirmDelete, target.dataset.id);

    if (target.id === 'addOrderLine') {
      $('#orderLines').insertAdjacentHTML('beforeend', lineTemplate({ qty: 1 }));
      updateOrderModalTotals();
    }

    if (target.classList.contains('remove-line')) {
      const lines = $$('.order-line', $('#orderLines'));
      if (lines.length > 1) target.closest('.order-line').remove();
      else showToast('El pedido debe tener al menos un concepto', true);
      updateOrderModalTotals();
    }

    if (target.id === 'printOrderButton') window.print();
    if (target.id === 'confirmClearData') {
      state = cloneDefaultState();
      closeModal();
      saveState('Todos los datos fueron eliminados');
    }
  });

  document.addEventListener('change', event => {
    if (!event.target.classList.contains('line-product')) return;
    const product = state.products.find(item => item.id === event.target.value);
    const line = event.target.closest('.order-line');
    if (product) {
      $('.line-name', line).value = product.name;
      $('.line-price', line).value = number(product.salePrice);
      $('.line-cost', line).value = productCost(product);
    }
    updateOrderModalTotals();
  });

  document.addEventListener('input', event => {
    if (event.target.matches('.line-qty, .line-price, .line-cost')) updateOrderModalTotals();
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'productForm') { event.preventDefault(); saveProduct(event.target); }
    if (event.target.id === 'orderForm') { event.preventDefault(); saveOrder(event.target); }
    if (event.target.id === 'expenseForm') { event.preventDefault(); saveExpense(event.target); }
  });

  $('#modalBackdrop').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal();
  });
}

function init() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
  setupEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);