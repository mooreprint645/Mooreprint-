(function () {
  let initialized = false;

  const math = () => window.MoorePrintAccountingMath;
  const n = value => typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;
  const currency = value => typeof money === 'function'
    ? money(value)
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n(value));
  const safe = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function setGlobalFunction(name, wrapped) {
    window[name] = wrapped;
    try { (0, eval)(`${name} = window[${JSON.stringify(name)}]`); } catch (error) {}
  }

  function wrapFunction(name, factory, marker) {
    const current = window[name];
    if (typeof current !== 'function' || current[marker]) return false;
    const wrapped = factory(current);
    wrapped[marker] = true;
    setGlobalFunction(name, wrapped);
    return true;
  }

  function afterResult(result, callback) {
    if (result && typeof result.then === 'function') {
      return result.then(value => {
        callback();
        return value;
      });
    }
    callback();
    return result;
  }

  function persistSilently(render = true) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
    if (render && typeof renderAll === 'function') renderAll();
  }

  function metadataRecipe(product, salePrice) {
    const breakdown = productBreakdown(product, salePrice);
    const recipe = clone(product.recipe || []).filter(row => row?.kind !== 'cost_breakdown');
    const overheadCost = Math.max(0, n(breakdown.overhead));
    recipe.push({
      kind: 'cost_breakdown',
      version: 1,
      overheadCost,
      variableCost: Math.max(0, n(breakdown.total) - overheadCost),
      totalCost: Math.max(0, n(breakdown.total)),
      pricingMonth: state.business?.pricingMonth || monthKey(todayISO()),
      capturedAt: new Date().toISOString()
    });
    return { recipe, breakdown };
  }

  function installDocumentSnapshots() {
    wrapFunction('selectedProductSnapshot', base => function (productId, price = null) {
      const snapshot = base(productId, price);
      const product = state.products.find(item => item.id === productId);
      if (!snapshot || !product) return snapshot;
      const salePrice = price === null ? n(product.salePrice) : n(price);
      const captured = metadataRecipe(product, salePrice);
      return {
        ...snapshot,
        cost: captured.breakdown.total,
        recipe: captured.recipe
      };
    }, '__accountingSnapshotWrapped');

    wrapFunction('updateDocumentPreview', base => function (...args) {
      const result = base.apply(this, args);
      const form = document.querySelector('#orderForm') || document.querySelector('#quoteForm');
      const balanceNode = document.querySelector('#docBalance');
      if (!form || !balanceNode) return result;
      const record = {
        items: documentItemsFromForm(form),
        discount: n(form.elements.discount?.value),
        taxPercent: n(form.elements.taxPercent?.value),
        deliveryCharge: n(form.elements.deliveryCharge?.value),
        deliveryCost: n(form.elements.deliveryCost?.value),
        payments: modalContext?.type === 'order'
          ? state.orders.find(order => order.id === modalContext.id)?.payments || []
          : []
      };
      const totals = documentTotals(record);
      const row = balanceNode.closest('.summary-row');
      const label = row?.querySelector('span');
      if (totals.credit > 0) {
        if (label) label.textContent = 'Saldo a favor';
        balanceNode.textContent = currency(totals.credit);
        balanceNode.className = 'money-positive';
      } else {
        if (label) label.textContent = 'Saldo';
        balanceNode.textContent = currency(totals.balance);
        balanceNode.className = totals.balance > 0 ? 'money-warning' : 'money-positive';
      }
      return result;
    }, '__accountingPreviewWrapped');
  }

  function injectPricingCheckbox(form, checked, text) {
    if (!form || form.querySelector('[name="includedInPricing"]')) return;
    const box = document.createElement('div');
    box.className = 'team-risk-confirm full';
    box.innerHTML = `<label><input type="checkbox" name="includedInPricing" ${checked ? 'checked' : ''}><span><strong>Ya incluido en el costo de los productos</strong><small>${safe(text)}</small></span></label>`;
    const summary = form.querySelector('.summary-box');
    if (summary) summary.insertAdjacentElement('beforebegin', box);
    else form.appendChild(box);
  }

  function installFixedCostReconciliation() {
    wrapFunction('openExpenseModal', base => function (id = '') {
      const existing = state.expenses.find(item => item.id === id) || {};
      const result = base(id);
      return afterResult(result, () => injectPricingCheckbox(
        document.querySelector('#expenseForm'),
        Boolean(existing.includedInPricing),
        'Actívalo solo cuando este mismo gasto ya se repartió mediante Costos fijos mensuales. El reporte lo conciliará hasta el monto realmente incluido en los pedidos vendidos.'
      ));
    }, '__accountingExpenseOpenWrapped');

    wrapFunction('saveExpense', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const included = Boolean(form?.elements?.includedInPricing?.checked);
      const result = base(form);
      return afterResult(result, () => {
        const record = state.expenses.find(item => item.id === id);
        if (!record) return;
        record.includedInPricing = included;
        persistSilently(false);
      });
    }, '__accountingExpenseSaveWrapped');

    wrapFunction('openRecurringModal', base => function (id = '') {
      const existing = state.recurringExpenses.find(item => item.id === id) || {};
      const result = base(id);
      return afterResult(result, () => injectPricingCheckbox(
        document.querySelector('#recurringForm'),
        Boolean(existing.includedInPricing),
        'Los gastos mensuales generados heredarán esta marca para evitar restarlos dos veces en la utilidad.'
      ));
    }, '__accountingRecurringOpenWrapped');

    wrapFunction('saveRecurring', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const included = Boolean(form?.elements?.includedInPricing?.checked);
      const result = base(form);
      return afterResult(result, () => {
        const record = state.recurringExpenses.find(item => item.id === id);
        if (!record) return;
        record.includedInPricing = included;
        persistSilently(false);
      });
    }, '__accountingRecurringSaveWrapped');

    wrapFunction('generateRecurringExpenses', base => function (...args) {
      const before = new Set(state.expenses.map(item => item.id));
      const result = base.apply(this, args);
      return afterResult(result, () => {
        let changed = false;
        state.expenses.forEach(expense => {
          if (before.has(expense.id) || !expense.recurringId) return;
          const source = state.recurringExpenses.find(item => item.id === expense.recurringId);
          expense.includedInPricing = Boolean(source?.includedInPricing);
          changed = true;
        });
        if (changed) persistSilently(false);
      });
    }, '__accountingRecurringGenerationWrapped');
  }

  function clearValuationMarkerForManualCosts() {
    wrapFunction('saveMaterial', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const before = state.materials.find(item => item.id === id);
      const oldCost = n(before?.unitCost);
      const result = base(form);
      return afterResult(result, () => {
        const material = state.materials.find(item => item.id === id);
        if (!material || Math.abs(n(material.unitCost) - oldCost) < 0.0001) return;
        material.lastValuationPurchaseId = '';
        persistSilently(false);
      });
    }, '__accountingMaterialCostWrapped');

    wrapFunction('saveSupplier', base => function (...args) {
      const before = new Map(state.materials.map(item => [item.id, n(item.unitCost)]));
      const result = base.apply(this, args);
      return afterResult(result, () => {
        let changed = false;
        state.materials.forEach(material => {
          if (!before.has(material.id) || Math.abs(n(material.unitCost) - n(before.get(material.id))) < 0.0001) return;
          material.lastValuationPurchaseId = '';
          changed = true;
        });
        if (changed) persistSilently(false);
      });
    }, '__accountingSupplierCostWrapped');
  }

  function installPurchaseDeletionCorrection() {
    wrapFunction('performDelete', base => function (type, id) {
      if (type !== 'purchase') return base(type, id);
      const purchase = state.purchases.find(item => item.id === id);
      if (purchase?.inventoryApplied) {
        const grouped = typeof aggregatePurchaseItems === 'function' ? aggregatePurchaseItems(purchase.items) : [];
        const possible = grouped.every(row => n(state.materials.find(item => item.id === row.materialId)?.stock) - n(row.qty) >= 0);
        if (!possible && !window.confirm('Al borrar esta compra alguna existencia quedará negativa. ¿Continuar?')) return false;
        const result = reversePurchaseInventory(purchase, `Eliminación de compra ${purchase.invoice || purchase.id}`);
        if (result?.warnings) setTimeout(() => showToast('Revisa el costo promedio de los materiales de la compra eliminada.', 'warning'), 0);
      }
      if (purchase) purchase.inventoryApplied = false;
      return base(type, id);
    }, '__accountingPurchaseDeleteWrapped');
  }

  function accountingExpenseSummary(expenses, orders) {
    const total = sum(expenses, expense => Math.max(0, n(expense.amount)));
    const marked = sum(expenses.filter(expense => expense.includedInPricing), expense => Math.max(0, n(expense.amount)));
    const embedded = sum(orders, order => documentTotals(order).allocatedOverhead);
    const reconciled = Math.min(marked, embedded);
    return {
      total,
      marked,
      embedded,
      reconciled,
      operating: Math.max(0, total - reconciled)
    };
  }

  function correctedPeriodSummary(period = 'month') {
    const range = period === 'month' ? currentMonthRange() : { from: '', to: '' };
    const orders = state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, range.from, range.to));
    const expenses = state.expenses.filter(expense => inRange(expense.date, range.from, range.to));
    const sales = sum(orders, order => documentTotals(order).netRevenue);
    const taxes = sum(orders, order => documentTotals(order).tax);
    const costs = sum(orders, order => documentTotals(order).costs);
    const expenseSummary = accountingExpenseSummary(expenses, orders);
    return {
      orders,
      expenses,
      sales,
      taxes,
      costs,
      operating: expenseSummary.operating,
      fixedCostsReconciled: expenseSummary.reconciled,
      profit: sales - costs - expenseSummary.operating
    };
  }

  function monthlySeriesCorrected() {
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
    const metrics = document.querySelector('#reports .report-metrics');
    if (!metrics) return;
    let node = document.querySelector('#accountingAuditSummary');
    if (!node) {
      node = document.createElement('div');
      node.id = 'accountingAuditSummary';
      node.className = 'info-box';
      metrics.insertAdjacentElement('afterend', node);
    }
    node.innerHTML = `<strong>Conciliación del periodo</strong><p>IVA cobrado: ${currency(values.taxes)} · costos fijos ya incluidos y conciliados: ${currency(values.reconciled)} · saldos a favor de clientes: ${currency(values.customerCredit)} · saldos a favor con proveedores o gastos: ${currency(values.supplierCredit)}.</p>`;
  }

  function correctedRenderReports() {
    if (!document.querySelector('#reportFrom')) return;
    if (!document.querySelector('#reportFrom').value && !document.querySelector('#reportTo').value) {
      const range = currentMonthRange();
      document.querySelector('#reportFrom').value = range.from;
      document.querySelector('#reportTo').value = range.to;
    }
    const from = document.querySelector('#reportFrom').value;
    const to = document.querySelector('#reportTo').value;
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
    const cashFlow = sum(entries, entry => entry.type === 'entrada' ? n(entry.amount) : -n(entry.amount));
    const contributionRatio = sales ? Math.max(0, (sales - variableCosts) / sales) : 0;
    const configuredFixed = n(window.MoorePrintMonthlyCosts?.monthlyTotal?.());
    const recurringFixed = sum(state.recurringExpenses.filter(item => item.active !== false), item => n(item.amount));
    const monthlyFixed = configuredFixed > 0 ? configuredFixed : recurringFixed;
    const breakEven = contributionRatio ? monthlyFixed / contributionRatio : monthlyFixed;

    document.querySelector('#reportSales').textContent = currency(sales);
    document.querySelector('#reportCosts').textContent = currency(costs);
    document.querySelector('#reportExpenses').textContent = currency(operating);
    document.querySelector('#reportNet').textContent = currency(net);
    document.querySelector('#reportCashFlow').textContent = currency(cashFlow);
    document.querySelector('#reportBreakEven').textContent = currency(breakEven);
    document.querySelector('#reportNet').className = net < 0 ? 'money-negative' : 'money-positive';
    document.querySelector('#reportCashFlow').className = cashFlow < 0 ? 'money-negative' : 'money-positive';

    const series = monthlySeriesCorrected();
    const maxValue = Math.max(...series.flatMap(row => [row.sales, Math.max(0, row.profit)]), 1);
    document.querySelector('#monthlyTrend').innerHTML = series.map(row => `<div class="trend-month"><div class="trend-bars"><div class="trend-bar" title="Ventas netas ${currency(row.sales)}" style="height:${Math.max(3, row.sales / maxValue * 140)}px"></div><div class="trend-bar profit" title="Utilidad ${currency(row.profit)}" style="height:${Math.max(3, Math.max(0, row.profit) / maxValue * 140)}px"></div></div><small>${safe(row.label)}</small></div>`).join('');

    const groupedExpenses = expenses.reduce((result, expense) => {
      const value = n(expense.amount);
      const reconciledShare = expense.includedInPricing && expenseSummary.marked > 0
        ? expenseSummary.reconciled * value / expenseSummary.marked
        : 0;
      result[expense.category] = (result[expense.category] || 0) + Math.max(0, value - reconciledShare);
      return result;
    }, {});
    renderCategoryBars('#expenseCategoryReport', Object.entries(groupedExpenses).map(([label, value]) => [categoryName(label), value]));

    const productProfit = {};
    orders.forEach(order => math().productProfitRows(order).forEach(row => {
      productProfit[row.name] = (productProfit[row.name] || 0) + row.profit;
    }));
    document.querySelector('#topProductsReport').innerHTML = rankedList(Object.entries(productProfit).sort((a, b) => b[1] - a[1]).slice(0, 8));

    const customerSales = {};
    orders.forEach(order => {
      const key = order.customer || entityName(state.customers, order.customerId);
      customerSales[key] = (customerSales[key] || 0) + documentTotals(order).netRevenue;
    });
    document.querySelector('#topCustomersReport').innerHTML = rankedList(Object.entries(customerSales).sort((a, b) => b[1] - a[1]).slice(0, 8));

    const methodSales = {};
    state.orders.filter(order => order.status !== 'cancelado').forEach(order => (order.payments || [])
      .filter(payment => payment.method !== 'credito' && inRange(payment.date, from, to))
      .forEach(payment => {
        const key = methodName(payment.method);
        methodSales[key] = (methodSales[key] || 0) + n(payment.amount);
      }));
    renderCategoryBars('#paymentMethodReport', Object.entries(methodSales));

    const delivered = orders.filter(order => order.status === 'entregado').length;
    const pending = state.orders.filter(order => !['entregado', 'cancelado'].includes(order.status)).length;
    const overdue = state.orders.filter(isOverdue).length;
    const averageTicket = orders.length ? sales / orders.length : 0;
    document.querySelector('#operationalReport').innerHTML = [
      ['Pedidos entregados', delivered],
      ['Pedidos pendientes', pending],
      ['Pedidos atrasados', overdue],
      ['Ticket promedio neto', currency(averageTicket)],
      ['Materiales bajos', state.materials.filter(isLowStock).length],
      ['Inventario valorizado', currency(inventoryValue())],
      ['Cuentas por cobrar', currency(accountsReceivable())],
      ['Cuentas por pagar', currency(accountsPayable())],
      ['Saldo a favor de clientes', currency(customerCredits())],
      ['Saldo a favor con proveedores', currency(supplierCredits())]
    ].map(([label, value]) => `<div class="stat-row"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`).join('');

    renderAccountingAudit({
      taxes,
      reconciled: expenseSummary.reconciled,
      customerCredit: sum(orders, order => documentTotals(order).credit),
      supplierCredit: sum(state.purchases.filter(item => inRange(item.date, from, to)), item => purchaseTotals(item).credit) + sum(expenses, item => expenseTotals(item).credit)
    });
  }

  function installReports() {
    setGlobalFunction('periodSummary', correctedPeriodSummary);
    setGlobalFunction('monthlySeries', monthlySeriesCorrected);
    setGlobalFunction('renderReports', correctedRenderReports);
  }

  function balanceText(totals) {
    return totals.credit > 0
      ? { text: `A favor ${currency(totals.credit)}`, className: 'money-positive', title: 'Pago excedente o total reducido después de pagar' }
      : { text: currency(totals.balance), className: totals.balance > 0 ? 'money-warning' : 'money-positive', title: '' };
  }

  function decorateOrderBalances() {
    document.querySelectorAll('#ordersTable tr').forEach(row => {
      const id = row.querySelector('[data-edit-order],[data-view-order]')?.dataset.editOrder || row.querySelector('[data-edit-order],[data-view-order]')?.dataset.viewOrder;
      const order = state.orders.find(item => item.id === id);
      const cell = row.children[6];
      if (!order || !cell) return;
      const display = balanceText(documentTotals(order));
      cell.textContent = display.text;
      cell.className = display.className;
      if (display.title) cell.title = display.title;
    });
  }

  function decoratePurchaseBalances() {
    document.querySelectorAll('#purchasesTable tr').forEach(row => {
      const id = row.querySelector('[data-edit-purchase]')?.dataset.editPurchase;
      const purchase = state.purchases.find(item => item.id === id);
      const cell = row.children[6];
      if (!purchase || !cell) return;
      const display = balanceText(purchaseTotals(purchase));
      cell.textContent = display.text;
      cell.className = display.className;
      if (display.title) cell.title = display.title;
    });
  }

  function installBalanceDisplays() {
    wrapFunction('renderOrders', base => function (...args) {
      const result = base.apply(this, args);
      return afterResult(result, decorateOrderBalances);
    }, '__accountingOrderBalancesWrapped');

    wrapFunction('renderPurchases', base => function (...args) {
      const result = base.apply(this, args);
      return afterResult(result, decoratePurchaseBalances);
    }, '__accountingPurchaseBalancesWrapped');

    wrapFunction('previewDocument', base => function (type, id) {
      const result = base(type, id);
      return afterResult(result, () => {
        if (type !== 'order') return;
        const order = state.orders.find(item => item.id === id);
        const totals = order ? documentTotals(order) : null;
        const summary = document.querySelector('.note-preview .summary-box');
        if (!summary || !totals?.credit) return;
        summary.insertAdjacentHTML('beforeend', `<div class="summary-row"><span>Saldo a favor</span><strong class="money-positive">${currency(totals.credit)}</strong></div>`);
      });
    }, '__accountingDocumentPreviewWrapped');

    wrapFunction('openPaymentModal', base => function (type, id) {
      const record = type === 'order'
        ? state.orders.find(item => item.id === id)
        : type === 'purchase'
          ? state.purchases.find(item => item.id === id)
          : state.expenses.find(item => item.id === id);
      const totals = record
        ? type === 'order' ? documentTotals(record) : type === 'purchase' ? purchaseTotals(record) : expenseTotals(record)
        : null;
      if (totals?.credit > 0) return showToast(`Este registro tiene ${currency(totals.credit)} a favor. Corrige o devuelve el excedente antes de registrar otro pago.`, 'warning');
      if (totals && totals.balance <= 0) return showToast('Este registro no tiene saldo pendiente.', 'warning');
      return base(type, id);
    }, '__accountingPaymentGuardWrapped');
  }

  function renderCashMethodBreakdown() {
    const section = document.querySelector('#cash');
    const metrics = section?.querySelector('.metrics-grid');
    if (!section || !metrics) return;
    const cashMetric = document.querySelector('#cashBalance')?.closest('.metric-card');
    const cashLabel = cashMetric?.querySelector('span');
    if (cashLabel) cashLabel.textContent = 'Efectivo en caja';
    const dashboardCashLabel = document.querySelector('#metricCash')?.closest('.metric-card')?.querySelector('span');
    if (dashboardCashLabel) dashboardCashLabel.textContent = 'Efectivo en caja';
    const salesLabel = document.querySelector('#metricSales')?.closest('.metric-card')?.querySelector('span');
    if (salesLabel) salesLabel.textContent = 'Ventas netas del mes';
    const reportSalesLabel = document.querySelector('#reportSales')?.closest('.metric-card')?.querySelector('span');
    if (reportSalesLabel) reportSalesLabel.textContent = 'Ventas netas';

    let panel = document.querySelector('#cashMethodBreakdown');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'cashMethodBreakdown';
      panel.className = 'panel';
      metrics.insertAdjacentElement('afterend', panel);
    }
    const balances = cashBalancesByMethod();
    const order = ['efectivo', 'transferencia', 'tarjeta', 'deposito', 'otro', 'credito'];
    const rows = order.filter(method => Math.abs(n(balances[method])) > 0.0001 || method === 'efectivo').map(method => `<div class="stat-row"><span>${safe(methodName(method))}${method === 'credito' ? ' · no es efectivo disponible' : ''}</span><strong class="${n(balances[method]) < 0 ? 'money-negative' : 'money-positive'}">${currency(balances[method])}</strong></div>`).join('');
    const available = order.filter(method => method !== 'credito').reduce((total, method) => total + n(balances[method]), 0);
    panel.innerHTML = `<div class="panel-header"><div><h2>Saldos por método</h2><p>El corte usa únicamente efectivo. Transferencias, tarjetas y depósitos se muestran por separado.</p></div><strong>${currency(available)}</strong></div>${rows || '<p class="empty-message">Sin movimientos.</p>'}`;
  }

  function installCashRendering() {
    wrapFunction('renderCash', base => function (...args) {
      const result = base.apply(this, args);
      return afterResult(result, renderCashMethodBreakdown);
    }, '__accountingCashWrapped');
    wrapFunction('renderDashboard', base => function (...args) {
      const result = base.apply(this, args);
      return afterResult(result, renderCashMethodBreakdown);
    }, '__accountingDashboardWrapped');
  }

  function exportCorrectedReportCsv() {
    const from = document.querySelector('#reportFrom').value;
    const to = document.querySelector('#reportTo').value;
    const rows = [['Tipo','Fecha','Folio/Categoría','Cliente/Descripción','Venta neta sin IVA','IVA','Costo','Gasto','Pagado','Saldo','Saldo a favor','Resultado']];
    state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to)).forEach(order => {
      const totals = documentTotals(order);
      rows.push(['Pedido',order.orderDate,order.folio,order.customer || entityName(state.customers,order.customerId),totals.netRevenue,totals.tax,totals.costs,0,totals.paid,totals.balance,totals.credit,totals.profit]);
    });
    state.expenses.filter(expense => inRange(expense.date, from, to)).forEach(expense => {
      const totals = expenseTotals(expense);
      rows.push(['Gasto',expense.date,categoryName(expense.category),expense.description,0,0,0,totals.total,totals.paid,totals.balance,totals.credit,-totals.total]);
    });
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `reporte-mooreprint-${from}-${to}.csv`);
    showToast('Reporte contable CSV descargado');
  }

  function installExports() {
    setGlobalFunction('exportReportCsv', exportCorrectedReportCsv);
    const button = document.querySelector('#exportCsvButton');
    if (button && !button.dataset.accountingExport) {
      const replacement = button.cloneNode(true);
      replacement.dataset.accountingExport = 'true';
      button.replaceWith(replacement);
      replacement.addEventListener('click', exportCorrectedReportCsv);
    }
  }

  function applyAllDecorations() {
    decorateOrderBalances();
    decoratePurchaseBalances();
    renderCashMethodBreakdown();
  }

  function wrapRenderAllLast() {
    wrapFunction('renderAll', base => function (...args) {
      const result = base.apply(this, args);
      return afterResult(result, applyAllDecorations);
    }, '__accountingRenderAllWrapped');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installDocumentSnapshots();
    installFixedCostReconciliation();
    clearValuationMarkerForManualCosts();
    installPurchaseDeletionCorrection();
    installReports();
    installBalanceDisplays();
    installCashRendering();
    installExports();
    wrapRenderAllLast();
    applyAllDecorations();
  }

  window.MoorePrintAccountingIntegrity = { init, renderReports: correctedRenderReports };
  init();
})();