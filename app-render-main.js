function navigate(section) {
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === section));
  $$('.page-section').forEach(page => page.classList.toggle('active', page.id === section));
  const active = $(`.nav-item[data-section="${section}"]`);
  $('#pageTitle').textContent = active ? active.textContent.trim().replace(/^[^\s]+\s/, '') : 'MoorePrint';
  $('#sidebar').classList.remove('open');
  if (section === 'reports') renderReports();
}

function renderAll() {
  renderDashboard(); renderOrders(); renderQuotes(); renderCustomers(); renderProducts(); renderInventory();
  renderSuppliers(); renderPurchases(); renderExpenses(); renderRecurring(); renderCash(); renderReports(); fillBusinessForm();
}

function periodSummary(period = 'month') {
  const range = period === 'month' ? currentMonthRange() : { from: '', to: '' };
  const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, range.from, range.to));
  const expenses = state.expenses.filter(expense => inRange(expense.date, range.from, range.to));
  const sales = sum(orders, order => documentTotals(order).total);
  const costs = sum(orders, order => documentTotals(order).costs);
  const operating = sum(expenses, expense => num(expense.amount));
  return { orders, expenses, sales, costs, operating, profit: sales - costs - operating };
}

function renderDashboard() {
  const data = periodSummary($('#dashboardPeriod')?.value || 'month');
  const margin = data.sales ? data.profit / data.sales * 100 : 0;
  $('#metricSales').textContent = money(data.sales);
  $('#metricOrders').textContent = `${data.orders.length} pedido${data.orders.length === 1 ? '' : 's'}`;
  $('#metricProfit').textContent = money(data.profit);
  $('#metricProfit').className = data.profit < 0 ? 'money-negative' : 'money-positive';
  $('#metricMargin').textContent = `Margen ${margin.toFixed(1)}%`;
  $('#metricCash').textContent = money(cashBalance());
  $('#metricReceivable').textContent = money(accountsReceivable());
  $('#metricPayable').textContent = money(accountsPayable());
  $('#metricInventory').textContent = money(inventoryValue());
  const lowStock = state.materials.filter(isLowStock);
  $('#metricLowStock').textContent = `${lowStock.length} material${lowStock.length === 1 ? '' : 'es'} bajo${lowStock.length === 1 ? '' : 's'}`;

  const chartData = [
    { label: 'Ventas', value: data.sales, className: '' },
    { label: 'Producción', value: data.costs, className: 'cost' },
    { label: 'Gastos', value: data.operating, className: 'expense' },
    { label: 'Utilidad', value: Math.max(0, data.profit), className: 'profit' }
  ];
  const maximum = Math.max(...chartData.map(item => item.value), 1);
  $('#summaryChart').innerHTML = chartData.map(item => `<div class="bar-item"><strong>${money(item.value)}</strong><div class="bar ${item.className}" style="height:${Math.max(4, item.value / maximum * 142)}px"></div><span>${item.label}</span></div>`).join('');

  const alerts = [];
  lowStock.slice(0, 4).forEach(material => alerts.push({ icon: '📦', title: `${material.name} con existencia baja`, detail: `${num(material.stock).toFixed(2)} ${material.unit || 'unidades'} disponibles`, section: 'inventory' }));
  state.orders.filter(isOverdue).slice(0, 4).forEach(order => alerts.push({ icon: '⏰', title: `${order.folio} está atrasado`, detail: `${order.customer || entityName(state.customers, order.customerId)} · entrega ${formatDate(order.dueDate)}`, section: 'orders' }));
  state.expenses.filter(expense => expenseTotals(expense).status === 'vencido').slice(0, 3).forEach(expense => alerts.push({ icon: '💸', title: `Gasto vencido: ${expense.description}`, detail: `Saldo ${money(expenseTotals(expense).balance)}`, section: 'expenses' }));
  $('#dashboardAlerts').innerHTML = alerts.length ? alerts.map(alert => `<button class="alert-row text-button" data-go="${alert.section}"><span class="alert-icon">${alert.icon}</span><span class="alert-content"><strong>${esc(alert.title)}</strong><small>${esc(alert.detail)}</small></span><span>›</span></button>`).join('') : '<p class="empty-message">Todo está al corriente.</p>';

  const upcoming = state.orders.filter(order => !['entregado', 'cancelado'].includes(order.status)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 6);
  $('#upcomingOrders').innerHTML = upcoming.length ? upcoming.map(order => `<div class="mini-row"><div><strong>${esc(order.folio)} · ${esc(order.customer || entityName(state.customers, order.customerId))}</strong><small>${formatDate(order.dueDate)} · ${statusName(order.status)}</small></div><span class="${isOverdue(order) ? 'money-negative' : ''}">${money(documentTotals(order).total)}</span></div>`).join('') : '<p class="empty-message">No hay entregas pendientes.</p>';

  const pending = state.orders.filter(order => order.status !== 'cancelado' && documentTotals(order).balance > 0).sort((a, b) => documentTotals(b).balance - documentTotals(a).balance).slice(0, 6);
  $('#pendingPayments').innerHTML = pending.length ? pending.map(order => `<div class="mini-row"><div><strong>${esc(order.customer || entityName(state.customers, order.customerId))}</strong><small>${esc(order.folio)}</small></div><span class="money-warning">${money(documentTotals(order).balance)}</span></div>`).join('') : '<p class="empty-message">No hay cobros pendientes.</p>';
}

function renderOrders() {
  const query = ($('#orderSearch')?.value || '').trim().toLowerCase();
  const filter = $('#orderStatusFilter')?.value || 'all';
  const orders = [...state.orders].filter(order => filter === 'all' || order.status === filter).filter(order => `${order.folio} ${order.customer} ${entityName(state.customers, order.customerId, '')} ${(order.items || []).map(item => item.name).join(' ')}`.toLowerCase().includes(query)).sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
  $('#ordersEmpty').style.display = state.orders.length ? 'none' : 'block';
  $('#ordersTable').innerHTML = orders.map(order => {
    const totals = documentTotals(order);
    const description = (order.items || []).map(item => `${item.qty} ${item.name}`).join(', ');
    return `<tr class="${isOverdue(order) ? 'stock-low' : ''}"><td><strong>${esc(order.folio)}</strong><br><small>${esc(order.priority || 'normal')}</small></td><td><strong>${esc(order.customer || entityName(state.customers, order.customerId))}</strong><br><small>${esc(order.phone || '')}</small></td><td title="${esc(description)}">${esc(description.slice(0, 58))}${description.length > 58 ? '…' : ''}<br><small>${esc(order.designStatus || 'pendiente')} · ${esc(order.responsible || 'Sin responsable')}</small></td><td>${formatDate(order.dueDate)}${isOverdue(order) ? '<br><small class="money-negative">Atrasado</small>' : ''}</td><td><span class="badge ${order.status}">${statusName(order.status)}</span></td><td>${money(totals.total)}</td><td class="${totals.balance ? 'money-warning' : 'money-positive'}">${money(totals.balance)}</td><td><div class="action-group"><button class="action-button" data-view-order="${order.id}" title="Nota">🧾</button><button class="action-button" data-pay-order="${order.id}" title="Registrar pago">$</button><button class="action-button" data-edit-order="${order.id}" title="Editar">✎</button><button class="action-button" data-delete-order="${order.id}" title="Eliminar">×</button></div></td></tr>`;
  }).join('');
}

function renderQuotes() {
  const query = ($('#quoteSearch')?.value || '').trim().toLowerCase();
  const filter = $('#quoteStatusFilter')?.value || 'all';
  state.quotes.forEach(quote => { if (!['aceptada', 'rechazada', 'convertida'].includes(quote.status) && quote.validUntil && quote.validUntil < todayISO()) quote.status = 'vencida'; });
  const quotes = [...state.quotes].filter(quote => filter === 'all' || quote.status === filter).filter(quote => `${quote.folio} ${quote.customer} ${entityName(state.customers, quote.customerId, '')}`.toLowerCase().includes(query)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#quotesEmpty').style.display = state.quotes.length ? 'none' : 'block';
  $('#quotesTable').innerHTML = quotes.map(quote => `<tr><td><strong>${esc(quote.folio)}</strong></td><td>${esc(quote.customer || entityName(state.customers, quote.customerId))}</td><td>${formatDate(quote.date)}</td><td>${formatDate(quote.validUntil)}</td><td><span class="badge ${quote.status}">${statusName(quote.status)}</span></td><td>${money(documentTotals(quote).total)}</td><td><div class="action-group"><button class="action-button" data-view-quote="${quote.id}" title="Ver">📝</button>${quote.status !== 'convertida' ? `<button class="action-button" data-convert-quote="${quote.id}" title="Convertir en pedido">→</button>` : ''}<button class="action-button" data-edit-quote="${quote.id}">✎</button><button class="action-button" data-delete-quote="${quote.id}">×</button></div></td></tr>`).join('');
}

function customerStats(customerId) {
  const orders = state.orders.filter(order => order.customerId === customerId && order.status !== 'cancelado');
  return { orders: orders.length, sales: sum(orders, order => documentTotals(order).total), balance: sum(orders, order => documentTotals(order).balance) };
}
function renderCustomers() {
  const query = ($('#customerSearch')?.value || '').trim().toLowerCase();
  const customers = state.customers.filter(customer => `${customer.name} ${customer.phone} ${customer.email} ${customer.rfc}`.toLowerCase().includes(query));
  $('#customersEmpty').style.display = state.customers.length ? 'none' : 'block';
  $('#customersGrid').innerHTML = customers.map(customer => { const stats = customerStats(customer.id); return `<article class="entity-card"><div class="entity-card-header"><div><h3>${esc(customer.name)}</h3><p>${esc(customer.phone || 'Sin teléfono')}</p><p>${esc(customer.email || '')}</p></div><div class="action-group"><button class="action-button" data-view-customer="${customer.id}">◉</button><button class="action-button" data-edit-customer="${customer.id}">✎</button><button class="action-button" data-delete-customer="${customer.id}">×</button></div></div><p>${esc(customer.address || '')}</p><p>RFC: ${esc(customer.rfc || '—')}</p><div class="entity-stats"><div class="entity-stat"><span>Pedidos</span><strong>${stats.orders}</strong></div><div class="entity-stat"><span>Compras</span><strong>${money(stats.sales)}</strong></div><div class="entity-stat"><span>Debe</span><strong class="${stats.balance ? 'money-warning' : ''}">${money(stats.balance)}</strong></div></div></article>`; }).join('');
}

function renderProducts() {
  const query = ($('#productSearch')?.value || '').trim().toLowerCase();
  const products = state.products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query));
  $('#productsEmpty').style.display = state.products.length ? 'none' : 'block';
  $('#productGrid').innerHTML = products.map(product => { const breakdown = productBreakdown(product); const margin = num(product.salePrice) ? breakdown.profit / num(product.salePrice) * 100 : 0; return `<article class="product-card"><div class="product-card-header"><div><h3>${esc(product.name)}</h3><span class="category">${esc(product.category || 'Sin categoría')}</span></div><div class="action-group"><button class="action-button" data-edit-product="${product.id}">✎</button><button class="action-button" data-delete-product="${product.id}">×</button></div></div><div class="product-price">${money(product.salePrice)}</div><div class="cost-list"><div class="cost-line"><span>Materiales</span><strong>${money(breakdown.material)}</strong></div><div class="cost-line"><span>Proceso y servicios</span><strong>${money(breakdown.process)}</strong></div><div class="cost-line"><span>Desperdicio y comisión</span><strong>${money(breakdown.waste + breakdown.commission)}</strong></div><div class="cost-line total"><span>Costo unitario</span><strong>${money(breakdown.total)}</strong></div></div><div class="product-footer"><strong class="${breakdown.profit < 0 ? 'money-negative' : 'money-positive'}">Ganas ${money(breakdown.profit)}</strong><span class="margin-pill ${margin < 20 ? 'low' : ''}">${margin.toFixed(1)}%</span></div><small>${(product.recipe || []).length} material${(product.recipe || []).length === 1 ? '' : 'es'} en receta</small></article>`; }).join('');
}

function renderInventory() {
  const query = ($('#materialSearch')?.value || '').trim().toLowerCase();
  const filter = $('#stockFilter')?.value || 'all';
  const materials = state.materials.filter(material => `${material.name} ${material.category} ${entityName(state.suppliers, material.supplierId, '')}`.toLowerCase().includes(query)).filter(material => filter === 'all' || (filter === 'low' && isLowStock(material)) || (filter === 'out' && num(material.stock) <= 0));
  $('#inventoryValue').textContent = money(inventoryValue());
  $('#inventoryLowCount').textContent = state.materials.filter(isLowStock).length;
  $('#inventoryMovementCount').textContent = state.inventoryMovements.length;
  $('#materialsEmpty').style.display = state.materials.length ? 'none' : 'block';
  $('#materialsTable').innerHTML = materials.map(material => `<tr class="${num(material.stock) <= 0 ? 'stock-out' : isLowStock(material) ? 'stock-low' : ''}"><td><strong>${esc(material.name)}</strong><br><small>${esc(material.sku || '')}</small></td><td>${esc(material.category || 'Sin categoría')}</td><td class="${isLowStock(material) ? 'money-warning' : ''}">${num(material.stock).toFixed(2)} ${esc(material.unit || '')}</td><td>${num(material.minStock).toFixed(2)}</td><td>${money(material.unitCost)}</td><td>${money(num(material.stock) * num(material.unitCost))}</td><td>${esc(entityName(state.suppliers, material.supplierId))}</td><td><div class="action-group"><button class="action-button" data-adjust-material="${material.id}">±</button><button class="action-button" data-edit-material="${material.id}">✎</button><button class="action-button" data-delete-material="${material.id}">×</button></div></td></tr>`).join('');
  const movements = [...state.inventoryMovements].sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)).slice(0, 40);
  $('#inventoryMovementsTable').innerHTML = movements.length ? movements.map(move => `<tr><td>${formatDate(move.date)}</td><td>${esc(entityName(state.materials, move.materialId))}</td><td><span class="badge ${move.quantity >= 0 ? 'pagado' : 'vencido'}">${esc(move.type)}</span></td><td class="${move.quantity >= 0 ? 'money-positive' : 'money-negative'}">${move.quantity >= 0 ? '+' : ''}${num(move.quantity).toFixed(2)}</td><td>${esc(move.reason)}</td></tr>`).join('') : '<tr><td colspan="5">No hay movimientos.</td></tr>';
}

function supplierStats(supplierId) {
  const purchases = state.purchases.filter(purchase => purchase.supplierId === supplierId);
  return { purchases: purchases.length, total: sum(purchases, purchase => purchaseTotals(purchase).total), balance: sum(purchases, purchase => purchaseTotals(purchase).balance) };
}
function renderSuppliers() {
  const query = ($('#supplierSearch')?.value || '').trim().toLowerCase();
  const suppliers = state.suppliers.filter(supplier => `${supplier.name} ${supplier.phone} ${supplier.email} ${supplier.products}`.toLowerCase().includes(query));
  $('#suppliersEmpty').style.display = state.suppliers.length ? 'none' : 'block';
  $('#suppliersGrid').innerHTML = suppliers.map(supplier => { const stats = supplierStats(supplier.id); return `<article class="entity-card"><div class="entity-card-header"><div><h3>${esc(supplier.name)}</h3><p>${esc(supplier.contact || '')}</p><p>${esc(supplier.phone || '')}</p></div><div class="action-group"><button class="action-button" data-view-supplier="${supplier.id}">◉</button><button class="action-button" data-edit-supplier="${supplier.id}">✎</button><button class="action-button" data-delete-supplier="${supplier.id}">×</button></div></div><p>${esc(supplier.products || 'Sin productos indicados')}</p><p>${esc(supplier.address || '')}</p><div class="entity-stats"><div class="entity-stat"><span>Compras</span><strong>${stats.purchases}</strong></div><div class="entity-stat"><span>Total</span><strong>${money(stats.total)}</strong></div><div class="entity-stat"><span>Se debe</span><strong class="${stats.balance ? 'money-warning' : ''}">${money(stats.balance)}</strong></div></div></article>`; }).join('');
}
