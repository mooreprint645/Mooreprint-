function renderPurchases() {
  const range = currentMonthRange();
  const monthPurchases = state.purchases.filter(purchase => inRange(purchase.date, range.from, range.to));
  $('#purchaseMonthTotal').textContent = money(sum(monthPurchases, purchase => purchaseTotals(purchase).total));
  $('#purchasePaidTotal').textContent = money(sum(monthPurchases, purchase => purchaseTotals(purchase).paid));
  $('#purchasePayableTotal').textContent = money(sum(state.purchases, purchase => purchaseTotals(purchase).balance));
  const query = ($('#purchaseSearch')?.value || '').trim().toLowerCase();
  const purchases = [...state.purchases].filter(purchase => `${purchase.invoice} ${entityName(state.suppliers, purchase.supplierId, '')} ${(purchase.items || []).map(item => entityName(state.materials, item.materialId, '')).join(' ')}`.toLowerCase().includes(query)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#purchasesEmpty').style.display = state.purchases.length ? 'none' : 'block';
  $('#purchasesTable').innerHTML = purchases.map(purchase => { const totals = purchaseTotals(purchase); const materials = (purchase.items || []).map(item => `${item.qty} ${entityName(state.materials, item.materialId)}`).join(', '); return `<tr><td>${formatDate(purchase.date)}</td><td>${esc(entityName(state.suppliers, purchase.supplierId))}</td><td>${esc(purchase.invoice || '—')}</td><td title="${esc(materials)}">${esc(materials.slice(0, 54))}${materials.length > 54 ? '…' : ''}</td><td>${money(totals.total)}</td><td>${money(totals.paid)}</td><td class="${totals.balance ? 'money-warning' : 'money-positive'}">${money(totals.balance)}</td><td><div class="action-group"><button class="action-button" data-pay-purchase="${purchase.id}">$</button><button class="action-button" data-edit-purchase="${purchase.id}">✎</button><button class="action-button" data-delete-purchase="${purchase.id}">×</button></div></td></tr>`; }).join('');
}

function renderExpenses() {
  const query = ($('#expenseSearch')?.value || '').trim().toLowerCase();
  const filter = $('#expenseCategoryFilter')?.value || 'all';
  const expenses = [...state.expenses].filter(expense => filter === 'all' || expense.category === filter).filter(expense => `${expense.description} ${categoryName(expense.category)}`.toLowerCase().includes(query)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#expensesEmpty').style.display = state.expenses.length ? 'none' : 'block';
  $('#expensesTable').innerHTML = expenses.map(expense => { const totals = expenseTotals(expense); return `<tr class="${totals.status === 'vencido' ? 'stock-low' : ''}"><td>${formatDate(expense.date)}</td><td>${formatDate(expense.dueDate)}</td><td>${categoryName(expense.category)}</td><td>${esc(expense.description)}${expense.recurringId ? '<br><small>Recurrente</small>' : ''}</td><td>${money(totals.total)}</td><td>${money(totals.paid)}</td><td><span class="badge ${totals.status}">${statusName(totals.status)}</span></td><td><div class="action-group"><button class="action-button" data-pay-expense="${expense.id}">$</button><button class="action-button" data-edit-expense="${expense.id}">✎</button><button class="action-button" data-delete-expense="${expense.id}">×</button></div></td></tr>`; }).join('');
}

function renderRecurring() {
  const query = ($('#recurringSearch')?.value || '').trim().toLowerCase();
  const rows = state.recurringExpenses.filter(item => `${item.name} ${categoryName(item.category)}`.toLowerCase().includes(query));
  $('#recurringEmpty').style.display = state.recurringExpenses.length ? 'none' : 'block';
  $('#recurringTable').innerHTML = rows.map(item => `<tr><td><strong>${esc(item.name)}</strong><br><small>${esc(item.notes || '')}</small></td><td>${categoryName(item.category)}</td><td>${money(item.amount)}</td><td>Día ${num(item.day)}</td><td>${methodName(item.method)}</td><td><span class="badge ${item.active === false ? 'inactivo' : 'activo'}">${item.active === false ? 'Inactivo' : 'Activo'}</span></td><td>${esc(item.lastGeneratedMonth || 'Nunca')}</td><td><div class="action-group"><button class="action-button" data-toggle-recurring="${item.id}">${item.active === false ? '▶' : 'Ⅱ'}</button><button class="action-button" data-edit-recurring="${item.id}">✎</button><button class="action-button" data-delete-recurring="${item.id}">×</button></div></td></tr>`).join('');
}

function renderCash() {
  const entries = cashEntries();
  const range = currentMonthRange();
  const monthEntries = entries.filter(entry => inRange(entry.date, range.from, range.to));
  $('#cashBalance').textContent = money(cashBalance());
  $('#cashIncomeMonth').textContent = money(sum(monthEntries.filter(entry => entry.type === 'entrada'), entry => num(entry.amount)));
  $('#cashOutMonth').textContent = money(sum(monthEntries.filter(entry => entry.type === 'salida'), entry => num(entry.amount)));
  $('#cashReceivable').textContent = money(accountsReceivable());
  const query = ($('#cashSearch')?.value || '').trim().toLowerCase();
  const filter = $('#cashTypeFilter')?.value || 'all';
  const filtered = entries.filter(entry => entry.id !== 'opening').filter(entry => filter === 'all' || entry.type === filter).filter(entry => `${entry.description} ${entry.reference} ${entry.origin} ${methodName(entry.method)}`.toLowerCase().includes(query));
  $('#cashEmpty').style.display = filtered.length ? 'none' : 'block';
  $('#cashTable').innerHTML = filtered.map(entry => `<tr><td>${formatDate(entry.date)}</td><td><span class="badge ${entry.type === 'entrada' ? 'pagado' : 'vencido'}">${entry.type}</span></td><td>${esc(entry.origin)}</td><td>${esc(entry.description)}</td><td>${methodName(entry.method)}</td><td>${esc(entry.reference || '—')}</td><td class="${entry.type === 'entrada' ? 'money-positive' : 'money-negative'}">${entry.type === 'entrada' ? '+' : '-'}${money(entry.amount)}</td></tr>`).join('');
}

function monthlySeries() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const orders = state.orders.filter(order => order.status !== 'cancelado' && monthKey(order.orderDate) === key);
    const expenses = state.expenses.filter(expense => monthKey(expense.date) === key);
    const sales = sum(orders, order => documentTotals(order).total);
    const costs = sum(orders, order => documentTotals(order).costs);
    const operating = sum(expenses, expense => num(expense.amount));
    return { key, label: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(date), sales, profit: sales - costs - operating };
  });
}

function renderReports() {
  if (!$('#reportFrom')) return;
  if (!$('#reportFrom').value && !$('#reportTo').value) {
    const range = currentMonthRange(); $('#reportFrom').value = range.from; $('#reportTo').value = range.to;
  }
  const from = $('#reportFrom').value; const to = $('#reportTo').value;
  const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to));
  const expenses = state.expenses.filter(expense => inRange(expense.date, from, to));
  const entries = cashEntries().filter(entry => entry.id !== 'opening' && inRange(entry.date, from, to));
  const sales = sum(orders, order => documentTotals(order).total);
  const costs = sum(orders, order => documentTotals(order).costs);
  const operating = sum(expenses, expense => num(expense.amount));
  const net = sales - costs - operating;
  const cashFlow = sum(entries, entry => entry.type === 'entrada' ? num(entry.amount) : -num(entry.amount));
  const contributionRatio = sales ? Math.max(0, (sales - costs) / sales) : 0;
  const monthlyFixed = sum(state.recurringExpenses.filter(item => item.active !== false), item => num(item.amount));
  const breakEven = contributionRatio ? monthlyFixed / contributionRatio : monthlyFixed;
  $('#reportSales').textContent = money(sales); $('#reportCosts').textContent = money(costs); $('#reportExpenses').textContent = money(operating); $('#reportNet').textContent = money(net); $('#reportCashFlow').textContent = money(cashFlow); $('#reportBreakEven').textContent = money(breakEven);
  $('#reportNet').className = net < 0 ? 'money-negative' : 'money-positive'; $('#reportCashFlow').className = cashFlow < 0 ? 'money-negative' : 'money-positive';

  const series = monthlySeries(); const maxValue = Math.max(...series.flatMap(row => [row.sales, Math.max(0, row.profit)]), 1);
  $('#monthlyTrend').innerHTML = series.map(row => `<div class="trend-month"><div class="trend-bars"><div class="trend-bar" title="Ventas ${money(row.sales)}" style="height:${Math.max(3, row.sales / maxValue * 140)}px"></div><div class="trend-bar profit" title="Utilidad ${money(row.profit)}" style="height:${Math.max(3, Math.max(0, row.profit) / maxValue * 140)}px"></div></div><small>${esc(row.label)}</small></div>`).join('');

  const groupedExpenses = expenses.reduce((result, expense) => { result[expense.category] = (result[expense.category] || 0) + num(expense.amount); return result; }, {});
  renderCategoryBars('#expenseCategoryReport', Object.entries(groupedExpenses).map(([label, value]) => [categoryName(label), value]));

  const productProfit = {};
  orders.forEach(order => (order.items || []).forEach(item => { const key = item.name || 'Sin nombre'; productProfit[key] = (productProfit[key] || 0) + num(item.qty) * (num(item.price) - num(item.cost)); }));
  $('#topProductsReport').innerHTML = rankedList(Object.entries(productProfit).sort((a, b) => b[1] - a[1]).slice(0, 8));

  const customerSales = {};
  orders.forEach(order => { const key = order.customer || entityName(state.customers, order.customerId); customerSales[key] = (customerSales[key] || 0) + documentTotals(order).total; });
  $('#topCustomersReport').innerHTML = rankedList(Object.entries(customerSales).sort((a, b) => b[1] - a[1]).slice(0, 8));

  const methodSales = {};
  orders.forEach(order => (order.payments || []).filter(payment => inRange(payment.date, from, to)).forEach(payment => { methodSales[methodName(payment.method)] = (methodSales[methodName(payment.method)] || 0) + num(payment.amount); }));
  renderCategoryBars('#paymentMethodReport', Object.entries(methodSales));

  const delivered = orders.filter(order => order.status === 'entregado').length;
  const pending = state.orders.filter(order => !['entregado', 'cancelado'].includes(order.status)).length;
  const overdue = state.orders.filter(isOverdue).length;
  const averageTicket = orders.length ? sales / orders.length : 0;
  $('#operationalReport').innerHTML = [
    ['Pedidos entregados', delivered], ['Pedidos pendientes', pending], ['Pedidos atrasados', overdue], ['Ticket promedio', money(averageTicket)], ['Materiales bajos', state.materials.filter(isLowStock).length], ['Inventario valorizado', money(inventoryValue())], ['Cuentas por cobrar', money(accountsReceivable())], ['Cuentas por pagar', money(accountsPayable())]
  ].map(([label, value]) => `<div class="stat-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
}

function renderCategoryBars(selector, entries) {
  const rows = [...entries].sort((a, b) => b[1] - a[1]);
  const maximum = Math.max(...rows.map(([, value]) => num(value)), 1);
  $(selector).innerHTML = rows.length ? rows.map(([label, value]) => `<div class="category-row"><span>${esc(label)}</span><div class="progress-track"><div class="progress-fill" style="width:${num(value) / maximum * 100}%"></div></div><strong>${money(value)}</strong></div>`).join('') : '<p class="empty-message">Sin información en este periodo.</p>';
}
function rankedList(rows) { return rows.length ? rows.map(([label, value], index) => `<div class="mini-row"><div><strong>${index + 1}. ${esc(label)}</strong></div><span>${money(value)}</span></div>`).join('') : '<p class="empty-message">Sin información en este periodo.</p>'; }
