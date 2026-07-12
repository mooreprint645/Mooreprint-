function renderPurchases() {
  const range = currentMonthRange();
  const monthPurchases = state.purchases.filter(purchase => inRange(purchase.date, range.from, range.to));
  $('#purchaseMonthTotal').textContent = money(sum(monthPurchases, purchase => purchaseTotals(purchase).total));
  $('#purchasePaidTotal').textContent = money(sum(monthPurchases, purchase => purchaseTotals(purchase).paid));
  $('#purchasePayableTotal').textContent = money(sum(state.purchases, purchase => purchaseTotals(purchase).balance));

  const query = ($('#purchaseSearch')?.value || '').trim().toLowerCase();
  const purchases = [...state.purchases]
    .filter(purchase => `${purchase.invoice} ${entityName(state.suppliers, purchase.supplierId, '')} ${(purchase.items || []).map(item => entityName(state.materials, item.materialId, '')).join(' ')}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#purchasesEmpty').style.display = state.purchases.length ? 'none' : 'block';
  $('#purchasesTable').innerHTML = purchases.map(purchase => {
    const totals = purchaseTotals(purchase);
    const balance = balanceDisplay(totals);
    const materials = (purchase.items || []).map(item => `${item.qty} ${entityName(state.materials, item.materialId)}`).join(', ');
    return `<tr><td>${formatDate(purchase.date)}</td><td>${esc(entityName(state.suppliers, purchase.supplierId))}</td><td>${esc(purchase.invoice || '—')}</td><td title="${esc(materials)}">${esc(materials.slice(0, 54))}${materials.length > 54 ? '…' : ''}</td><td>${money(totals.total)}</td><td>${money(totals.paid)}</td><td class="${balance.className}">${balance.text}</td><td><div class="action-group"><button class="action-button" data-pay-purchase="${purchase.id}">$</button><button class="action-button" data-edit-purchase="${purchase.id}">✎</button><button class="action-button" data-delete-purchase="${purchase.id}">×</button></div></td></tr>`;
  }).join('');
}

function renderExpenses() {
  const query = ($('#expenseSearch')?.value || '').trim().toLowerCase();
  const filter = $('#expenseCategoryFilter')?.value || 'all';
  const expenses = [...state.expenses]
    .filter(expense => filter === 'all' || expense.category === filter)
    .filter(expense => `${expense.description} ${categoryName(expense.category)}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#expensesEmpty').style.display = state.expenses.length ? 'none' : 'block';
  $('#expensesTable').innerHTML = expenses.map(expense => {
    const totals = expenseTotals(expense);
    const credit = totals.credit > 0 ? `<br><small class="money-positive">A favor ${money(totals.credit)}</small>` : '';
    return `<tr class="${totals.status === 'vencido' ? 'stock-low' : ''}"><td>${formatDate(expense.date)}</td><td>${formatDate(expense.dueDate)}</td><td>${categoryName(expense.category)}</td><td>${esc(expense.description)}${expense.recurringId ? '<br><small>Recurrente</small>' : ''}${expense.includedInPricing ? '<br><small>Conciliado con costos de producto</small>' : ''}</td><td>${money(totals.total)}</td><td>${money(totals.paid)}${credit}</td><td><span class="badge ${totals.status}">${statusName(totals.status)}</span></td><td><div class="action-group"><button class="action-button" data-pay-expense="${expense.id}">$</button><button class="action-button" data-edit-expense="${expense.id}">✎</button><button class="action-button" data-delete-expense="${expense.id}">×</button></div></td></tr>`;
  }).join('');
}

function renderRecurring() {
  const query = ($('#recurringSearch')?.value || '').trim().toLowerCase();
  const rows = [...state.recurringExpenses]
    .filter(item => `${item.name} ${categoryName(item.category)} ${methodName(item.method)}`.toLowerCase().includes(query))
    .sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || num(a.day) - num(b.day) || String(a.name).localeCompare(String(b.name), 'es'));
  const empty = $('#recurringEmpty');
  empty.style.display = rows.length ? 'none' : 'block';
  if (!rows.length) {
    empty.querySelector('h3').textContent = query ? 'No hay coincidencias' : 'No hay gastos recurrentes';
    empty.querySelector('p').textContent = query
      ? 'Borra o cambia la búsqueda para ver los gastos guardados.'
      : 'Programa renta, luz, internet, sueldos y suscripciones mensuales.';
  }
  $('#recurringTable').innerHTML = rows.map(item => `<tr>
    <td data-label="Concepto"><strong>${esc(item.name)}</strong><br><small>${esc(item.notes || '')}</small>${item.includedInPricing ? '<br><small>Incluido en costos de producto</small>' : ''}</td>
    <td data-label="Categoría">${categoryName(item.category)}</td>
    <td data-label="Monto">${money(item.amount)}</td>
    <td data-label="Día de pago">Día ${num(item.day)}</td>
    <td data-label="Método">${methodName(item.method)}</td>
    <td data-label="Estado"><span class="badge ${item.active === false ? 'inactivo' : 'activo'}">${item.active === false ? 'Inactivo' : 'Activo'}</span></td>
    <td data-label="Última generación">${esc(item.lastGeneratedMonth || 'Nunca')}</td>
    <td data-label="Acciones"><div class="action-group"><button class="action-button" data-toggle-recurring="${item.id}">${item.active === false ? '▶' : 'Ⅱ'}</button><button class="action-button" data-edit-recurring="${item.id}">✎</button><button class="action-button" data-delete-recurring="${item.id}">×</button></div></td>
  </tr>`).join('');
}

function renderCashMethodBreakdown() {
  const panel = $('#cashMethodBreakdown');
  if (!panel) return;
  const balances = cashBalancesByMethod();
  const methods = ['efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro', 'credito'];
  const rows = methods
    .filter(method => Math.abs(num(balances[method])) > 0.0001 || method === 'efectivo')
    .map(method => `<div class="stat-row"><span>${esc(methodName(method))}${method === 'credito' ? ' · no es dinero disponible' : ''}</span><strong class="${num(balances[method]) < 0 ? 'money-negative' : 'money-positive'}">${money(balances[method])}</strong></div>`)
    .join('');
  const available = methods.filter(method => method !== 'credito').reduce((total, method) => total + num(balances[method]), 0);
  panel.innerHTML = `<div class="panel-header"><div><h2>Saldos por método</h2><p>El corte usa únicamente efectivo; los demás métodos se concilian por separado.</p></div><strong>${money(available)}</strong></div>${rows || '<p class="empty-message">Sin movimientos.</p>'}`;
}

function renderCash() {
  const entries = cashEntries();
  const range = currentMonthRange();
  const monthEntries = entries.filter(entry => entry.id !== 'opening' && entry.method !== 'credito' && inRange(entry.date, range.from, range.to));
  $('#cashBalance').textContent = money(cashBalance());
  $('#cashIncomeMonth').textContent = money(sum(monthEntries.filter(entry => entry.type === 'entrada'), entry => num(entry.amount)));
  $('#cashOutMonth').textContent = money(sum(monthEntries.filter(entry => entry.type === 'salida'), entry => num(entry.amount)));
  $('#cashReceivable').textContent = money(accountsReceivable());

  const query = ($('#cashSearch')?.value || '').trim().toLowerCase();
  const filter = $('#cashTypeFilter')?.value || 'all';
  const filtered = entries
    .filter(entry => entry.id !== 'opening')
    .filter(entry => filter === 'all' || entry.type === filter)
    .filter(entry => `${entry.description} ${entry.reference} ${entry.origin} ${methodName(entry.method)}`.toLowerCase().includes(query));
  $('#cashEmpty').style.display = filtered.length ? 'none' : 'block';
  $('#cashTable').innerHTML = filtered.map(entry => `<tr><td>${formatDate(entry.date)}</td><td><span class="badge ${entry.type === 'entrada' ? 'pagado' : 'vencido'}">${entry.type}</span></td><td>${esc(entry.origin)}</td><td>${esc(entry.description)}</td><td>${methodName(entry.method)}</td><td>${esc(entry.reference || '—')}</td><td class="${entry.type === 'entrada' ? 'money-positive' : 'money-negative'}">${entry.type === 'entrada' ? '+' : '-'}${money(entry.amount)}</td></tr>`).join('');
  renderCashMethodBreakdown();
}

function monthlySeries() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const orders = state.orders.filter(order => order.status !== 'cancelado' && monthKey(order.orderDate) === key);
    const expenses = state.expenses.filter(expense => monthKey(expense.date) === key);
    const sales = sum(orders, order => documentTotals(order).netRevenue);
    const costs = sum(orders, order => documentTotals(order).costs);
    const expenseSummary = accountingExpenseSummary(expenses, orders);
    return {
      key,
      label: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(date),
      sales,
      profit: sales - costs - expenseSummary.operating
    };
  });
}

function renderAccountingAudit(values) {
  const node = $('#accountingAuditSummary');
  if (!node) return;
  node.innerHTML = `<strong>Conciliación del periodo</strong><p>IVA cobrado: ${money(values.taxes)} · costos fijos conciliados: ${money(values.reconciled)} · saldos a favor de clientes: ${money(values.customerCredit)} · saldos a favor con proveedores o gastos: ${money(values.supplierCredit)}.</p>`;
}

function renderReports() {
  if (!$('#reportFrom')) return;
  if (!$('#reportFrom').value && !$('#reportTo').value) {
    const range = currentMonthRange();
    $('#reportFrom').value = range.from;
    $('#reportTo').value = range.to;
  }
  const from = $('#reportFrom').value;
  const to = $('#reportTo').value;
  const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to));
  const expenses = state.expenses.filter(expense => inRange(expense.date, from, to));
  const entries = cashEntries().filter(entry => entry.id !== 'opening' && entry.method !== 'credito' && inRange(entry.date, from, to));

  const sales = sum(orders, order => documentTotals(order).netRevenue);
  const taxes = sum(orders, order => documentTotals(order).tax);
  const costs = sum(orders, order => documentTotals(order).costs);
  const variableCosts = sum(orders, order => documentTotals(order).variableCosts);
  const expenseSummary = accountingExpenseSummary(expenses, orders);
  const operating = expenseSummary.operating;
  const net = sales - costs - operating;
  const cashFlow = sum(entries, entry => entry.type === 'entrada' ? num(entry.amount) : -num(entry.amount));
  const contributionRatio = sales ? Math.max(0, (sales - variableCosts) / sales) : 0;
  const configuredFixed = num(window.MoorePrintMonthlyCosts?.monthlyTotal?.());
  const recurringFixed = sum(state.recurringExpenses.filter(item => item.active !== false), item => num(item.amount));
  const monthlyFixed = configuredFixed > 0 ? configuredFixed : recurringFixed;
  const breakEven = contributionRatio ? monthlyFixed / contributionRatio : monthlyFixed;

  $('#reportSales').textContent = money(sales);
  $('#reportCosts').textContent = money(costs);
  $('#reportExpenses').textContent = money(operating);
  $('#reportNet').textContent = money(net);
  $('#reportCashFlow').textContent = money(cashFlow);
  $('#reportBreakEven').textContent = money(breakEven);
  $('#reportNet').className = net < 0 ? 'money-negative' : 'money-positive';
  $('#reportCashFlow').className = cashFlow < 0 ? 'money-negative' : 'money-positive';

  const series = monthlySeries();
  const maxValue = Math.max(...series.flatMap(row => [row.sales, Math.max(0, row.profit)]), 1);
  $('#monthlyTrend').innerHTML = series.map(row => `<div class="trend-month"><div class="trend-bars"><div class="trend-bar" title="Ventas netas ${money(row.sales)}" style="height:${Math.max(3, row.sales / maxValue * 140)}px"></div><div class="trend-bar profit" title="Utilidad ${money(row.profit)}" style="height:${Math.max(3, Math.max(0, row.profit) / maxValue * 140)}px"></div></div><small>${esc(row.label)}</small></div>`).join('');

  const groupedExpenses = expenses.reduce((result, expense) => {
    const value = num(expense.amount);
    const reconciledShare = expense.includedInPricing && expenseSummary.marked > 0
      ? expenseSummary.reconciled * value / expenseSummary.marked
      : 0;
    result[expense.category] = (result[expense.category] || 0) + Math.max(0, value - reconciledShare);
    return result;
  }, {});
  renderCategoryBars('#expenseCategoryReport', Object.entries(groupedExpenses).map(([label, value]) => [categoryName(label), value]));

  const productProfit = {};
  orders.forEach(order => Accounting.productProfitRows(order).forEach(row => {
    productProfit[row.name] = (productProfit[row.name] || 0) + row.profit;
  }));
  $('#topProductsReport').innerHTML = rankedList(Object.entries(productProfit).sort((a, b) => b[1] - a[1]).slice(0, 8));

  const customerSales = {};
  orders.forEach(order => {
    const key = order.customer || entityName(state.customers, order.customerId);
    customerSales[key] = (customerSales[key] || 0) + documentTotals(order).netRevenue;
  });
  $('#topCustomersReport').innerHTML = rankedList(Object.entries(customerSales).sort((a, b) => b[1] - a[1]).slice(0, 8));

  const methodSales = {};
  state.orders.filter(order => order.status !== 'cancelado').forEach(order => (order.payments || [])
    .filter(payment => payment.method !== 'credito' && inRange(payment.date, from, to))
    .forEach(payment => {
      const key = methodName(payment.method);
      methodSales[key] = (methodSales[key] || 0) + num(payment.amount);
    }));
  renderCategoryBars('#paymentMethodReport', Object.entries(methodSales));

  const delivered = orders.filter(order => order.status === 'entregado').length;
  const pending = state.orders.filter(order => !['entregado', 'cancelado'].includes(order.status)).length;
  const overdue = state.orders.filter(isOverdue).length;
  const averageTicket = orders.length ? sales / orders.length : 0;
  $('#operationalReport').innerHTML = [
    ['Pedidos entregados', delivered],
    ['Pedidos pendientes', pending],
    ['Pedidos atrasados', overdue],
    ['Ticket promedio neto', money(averageTicket)],
    ['Materiales bajos', state.materials.filter(isLowStock).length],
    ['Inventario valorizado', money(inventoryValue())],
    ['Cuentas por cobrar', money(accountsReceivable())],
    ['Cuentas por pagar', money(accountsPayable())],
    ['Saldo a favor de clientes', money(customerCredits())],
    ['Saldo a favor con proveedores', money(supplierCredits())]
  ].map(([label, value]) => `<div class="stat-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');

  renderAccountingAudit({
    taxes,
    reconciled: expenseSummary.reconciled,
    customerCredit: sum(orders, order => documentTotals(order).credit),
    supplierCredit: sum(state.purchases.filter(item => inRange(item.date, from, to)), item => purchaseTotals(item).credit)
      + sum(expenses, item => expenseTotals(item).credit)
  });
}

function renderCategoryBars(selector, entries) {
  const rows = [...entries].sort((a, b) => b[1] - a[1]);
  const maximum = Math.max(...rows.map(([, value]) => num(value)), 1);
  $(selector).innerHTML = rows.length
    ? rows.map(([label, value]) => `<div class="category-row"><span>${esc(label)}</span><div class="progress-track"><div class="progress-fill" style="width:${num(value) / maximum * 100}%"></div></div><strong>${money(value)}</strong></div>`).join('')
    : '<p class="empty-message">Sin información en este periodo.</p>';
}

function rankedList(rows) {
  return rows.length
    ? rows.map(([label, value], index) => `<div class="mini-row"><div><strong>${index + 1}. ${esc(label)}</strong></div><span>${money(value)}</span></div>`).join('')
    : '<p class="empty-message">Sin información en este periodo.</p>';
}