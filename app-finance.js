function purchaseRow(item = {}) {
  return `<div class="line-row purchase">
    <select class="purchase-material">${materialOptions(item.materialId)}</select>
    <input class="purchase-qty" type="number" min="0.001" step="0.001" value="${num(item.qty)}" placeholder="Cantidad">
    <input class="purchase-cost" type="number" min="0" step="0.01" value="${num(item.unitCost)}" placeholder="Costo unitario">
    <button type="button" class="action-button remove-row">×</button>
  </div>`;
}

function updatePurchasePreview() {
  const form = $('#purchaseForm');
  if (!form) return;
  const total = sum($$('.line-row.purchase', form), row => num($('.purchase-qty', row).value) * num($('.purchase-cost', row).value));
  $('#purchasePreview').textContent = money(total);
}

function openPurchaseModal(id = '') {
  const purchase = state.purchases.find(item => item.id === id) || {
    id: uid('purchase'), supplierId: '', date: todayISO(), invoice: '',
    items: [{}], notes: '', payments: [], inventoryApplied: false, valuationSnapshot: []
  };
  openModal(
    id ? 'Editar compra' : 'Nueva compra',
    `<form id="purchaseForm" class="modal-form">
      <input type="hidden" name="id" value="${purchase.id}">
      <label>Proveedor<select name="supplierId" required>${supplierOptions(purchase.supplierId)}</select></label>
      <label>Fecha<input name="date" type="date" required value="${purchase.date}"></label>
      <label>Factura / referencia<input name="invoice" value="${esc(purchase.invoice || '')}"></label>
      <label class="full">Notas<textarea name="notes" rows="3">${esc(purchase.notes || '')}</textarea></label>
      <div class="form-section">
        <div class="section-title"><div><h3>Materiales comprados</h3></div><button type="button" class="button secondary small" id="addPurchaseRow">+ Material</button></div>
        <div class="dynamic-list" id="purchaseRows">${(purchase.items?.length ? purchase.items : [{}]).map(purchaseRow).join('')}</div>
      </div>
      <div class="summary-box">
        <div class="summary-row total"><span>Total de compra</span><strong id="purchasePreview">$0.00</strong></div>
        <div class="summary-row"><span>Pagado registrado</span><strong>${money(paymentTotal(purchase))}</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="purchaseForm">Guardar compra</button>`,
    true
  );
  updatePurchasePreview();
}

function savePurchase(form) {
  const data = Object.fromEntries(new FormData(form));
  const oldPurchase = state.purchases.find(item => item.id === data.id);
  const items = $$('.line-row.purchase', form)
    .map(row => ({
      materialId: $('.purchase-material', row).value,
      qty: num($('.purchase-qty', row).value),
      unitCost: num($('.purchase-cost', row).value)
    }))
    .filter(item => item.materialId && item.qty > 0);
  if (!data.supplierId || !items.length) return showToast('Selecciona proveedor y materiales', 'error');

  const purchase = {
    id: data.id,
    supplierId: data.supplierId,
    date: data.date,
    invoice: data.invoice.trim(),
    notes: data.notes.trim(),
    items,
    payments: clone(oldPurchase?.payments || []),
    inventoryApplied: oldPurchase?.inventoryApplied || false,
    valuationSnapshot: clone(oldPurchase?.valuationSnapshot || []),
    updatedAt: new Date().toISOString()
  };
  if (!canSyncPurchaseInventory(oldPurchase, purchase)) return;
  syncPurchaseInventory(oldPurchase, purchase);
  const index = state.purchases.findIndex(item => item.id === purchase.id);
  if (index >= 0) state.purchases[index] = { ...state.purchases[index], ...purchase };
  else state.purchases.push({ ...purchase, createdAt: new Date().toISOString() });
  closeModal(true);
  saveState(index >= 0 ? 'Compra actualizada e inventario ajustado' : 'Compra registrada e inventario aumentado');
}

function pricingInclusionMarkup(checked, text) {
  return `<div class="team-risk-confirm full">
    <label><input type="checkbox" name="includedInPricing" ${checked ? 'checked' : ''}>
      <span><strong>Ya incluido en el costo de los productos</strong><small>${esc(text)}</small></span>
    </label>
  </div>`;
}

function openExpenseModal(id = '') {
  const expense = state.expenses.find(item => item.id === id) || {
    id: uid('expense'), date: todayISO(), dueDate: todayISO(), category: 'otros',
    description: '', amount: 0, notes: '', payments: [], includedInPricing: false
  };
  const totals = expenseTotals(expense);
  openModal(
    id ? 'Editar gasto' : 'Nuevo gasto',
    `<form id="expenseForm" class="modal-form">
      <input type="hidden" name="id" value="${expense.id}">
      <label>Fecha de registro<input name="date" type="date" value="${expense.date}" required></label>
      <label>Fecha de vencimiento<input name="dueDate" type="date" value="${expense.dueDate || expense.date}" required></label>
      <label>Categoría<select name="category">${expenseCategoryOptions(expense.category)}</select></label>
      <label>Monto<input name="amount" type="number" min="0" step="0.01" value="${num(expense.amount)}" required></label>
      <label class="full">Descripción<input name="description" value="${esc(expense.description || '')}" required></label>
      <label class="full">Notas<textarea name="notes" rows="3">${esc(expense.notes || '')}</textarea></label>
      ${pricingInclusionMarkup(Boolean(expense.includedInPricing), 'Actívalo cuando este mismo importe ya se repartió desde Costos fijos mensuales. Los reportes evitarán restarlo dos veces.')}
      <div class="summary-box">
        <div class="summary-row"><span>Pagado</span><strong>${money(totals.paid)}</strong></div>
        <div class="summary-row total"><span>${totals.credit > 0 ? 'Saldo a favor' : 'Saldo'}</span><strong>${money(totals.credit || totals.balance)}</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="expenseForm">Guardar gasto</button>`
  );
}

function saveExpense(form) {
  const data = Object.fromEntries(new FormData(form));
  const old = state.expenses.find(item => item.id === data.id);
  const expense = {
    id: data.id,
    date: data.date,
    dueDate: data.dueDate,
    category: data.category,
    description: data.description.trim(),
    amount: num(data.amount),
    notes: data.notes.trim(),
    payments: clone(old?.payments || []),
    recurringId: old?.recurringId || '',
    includedInPricing: Boolean(form.elements.includedInPricing?.checked),
    updatedAt: new Date().toISOString()
  };
  const index = state.expenses.findIndex(item => item.id === expense.id);
  if (index >= 0) state.expenses[index] = { ...state.expenses[index], ...expense };
  else state.expenses.push({ ...expense, createdAt: new Date().toISOString() });
  closeModal(true);
  saveState(index >= 0 ? 'Gasto actualizado' : 'Gasto registrado');
}

function recurringBranchId() {
  const context = window.MoorePrintBranches?.getContext?.() || {};
  const selected = context.selectedBranchId || window.MoorePrintBranches?.getSelectedBranchId?.();
  return selected && selected !== 'all' ? selected : context.branchId || '';
}

function recurringExpenseForMonth(item, key = monthKey(todayISO())) {
  if (!item || item.active === false) return null;
  const existing = state.expenses.find(expense => expense.recurringId === item.id && monthKey(expense.date) === key);
  if (existing) {
    item.lastGeneratedMonth = key;
    return null;
  }
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(lastDay, Math.max(1, num(item.day)));
  const now = new Date().toISOString();
  const expense = {
    id: uid('expense'),
    branchId: item.branchId || recurringBranchId(),
    date: `${key}-01`,
    dueDate: `${key}-${String(day).padStart(2, '0')}`,
    category: item.category,
    description: item.name,
    amount: num(item.amount),
    notes: item.notes || '',
    recurringId: item.id,
    includedInPricing: Boolean(item.includedInPricing),
    payments: [],
    createdAt: now,
    updatedAt: now
  };
  state.expenses.push(expense);
  item.lastGeneratedMonth = key;
  return expense;
}

function queueGeneratedRecurringExpenses(expenses) {
  const rows = (expenses || []).filter(Boolean);
  if (!rows.length) return;
  const branchId = rows[0].branchId || recurringBranchId();
  const operations = rows.map(expense => ({
    kind: 'record_upsert',
    action: 'save',
    entity_type: 'expense',
    entity_id: expense.id,
    branch_id: expense.branchId || branchId,
    payload: clone(expense),
    occurred_on: expense.date,
    expected_version: expense.cloudVersion || null,
    created_at: expense.createdAt
  }));
  const sync = () => {
    if (window.MoorePrintHardening?.isReady?.()) {
      window.MoorePrintHardening.enqueue('Generar gastos recurrentes', operations, branchId);
      return true;
    }
    if (window.MoorePrintOperations?.sync) {
      window.MoorePrintOperations.sync(['recurring_expense', 'expense']);
      return true;
    }
    return false;
  };
  if (!sync()) setTimeout(sync, 900);
}

function openRecurringModal(id = '') {
  const item = state.recurringExpenses.find(row => row.id === id) || {
    id: uid('recurring'), name: '', category: 'servicios', amount: 0,
    day: 1, method: 'transferencia', active: true, notes: '', includedInPricing: false
  };
  openModal(
    id ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente',
    `<form id="recurringForm" class="modal-form">
      <input type="hidden" name="id" value="${item.id}">
      <label>Concepto<input name="name" value="${esc(item.name)}" required></label>
      <label>Categoría<select name="category">${expenseCategoryOptions(item.category)}</select></label>
      <label>Monto mensual<input name="amount" type="number" min="0.01" step="0.01" value="${num(item.amount)}" required></label>
      <label>Día de pago<input name="day" type="number" min="1" max="31" value="${num(item.day) || 1}" required></label>
      <label>Método habitual<select name="method">${paymentMethodOptions(item.method)}</select></label>
      <label>Estado<select name="active"><option value="true" ${item.active !== false ? 'selected' : ''}>Activo</option><option value="false" ${item.active === false ? 'selected' : ''}>Inactivo</option></select></label>
      <label class="full">Notas<textarea name="notes" rows="3">${esc(item.notes || '')}</textarea></label>
      ${pricingInclusionMarkup(Boolean(item.includedInPricing), 'Los gastos generados cada mes conservarán esta marca para mantener la conciliación contable.')}
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="recurringForm">Guardar recurrente</button>`
  );
}

function saveRecurring(form) {
  const data = Object.fromEntries(new FormData(form));
  const name = String(data.name || '').trim();
  const amount = num(data.amount);
  if (!name) return showToast('Escribe el concepto del gasto recurrente.', 'error');
  if (amount <= 0) return showToast('El monto mensual debe ser mayor a cero.', 'error');

  const old = state.recurringExpenses.find(item => item.id === data.id);
  const now = new Date().toISOString();
  const item = {
    id: data.id,
    branchId: old?.branchId || recurringBranchId(),
    name,
    category: data.category,
    amount,
    day: Math.min(31, Math.max(1, num(data.day))),
    method: data.method,
    active: data.active === 'true',
    notes: String(data.notes || '').trim(),
    includedInPricing: Boolean(form.elements.includedInPricing?.checked),
    lastGeneratedMonth: old?.lastGeneratedMonth || '',
    updatedAt: now
  };
  const index = state.recurringExpenses.findIndex(row => row.id === item.id);
  if (index >= 0) state.recurringExpenses[index] = { ...state.recurringExpenses[index], ...item };
  else state.recurringExpenses.push({ ...item, createdAt: now });

  const saved = state.recurringExpenses.find(row => row.id === item.id);
  const generated = recurringExpenseForMonth(saved);
  const search = $('#recurringSearch');
  if (search) search.value = '';
  closeModal(true);
  saveState(generated
    ? `${index >= 0 ? 'Gasto recurrente actualizado' : 'Gasto recurrente agregado'} y gasto del mes generado`
    : index >= 0 ? 'Gasto recurrente actualizado' : 'Gasto recurrente agregado');
  navigate('recurring');
  queueGeneratedRecurringExpenses([generated]);
}

function generateRecurringExpenses(showMessage = true) {
  const key = monthKey(todayISO());
  const generatedExpenses = state.recurringExpenses
    .filter(item => item.active !== false)
    .map(item => recurringExpenseForMonth(item, key))
    .filter(Boolean);
  persistState();
  renderAll();
  queueGeneratedRecurringExpenses(generatedExpenses);
  if (showMessage) {
    const generated = generatedExpenses.length;
    showToast(generated
      ? `${generated} gasto${generated === 1 ? '' : 's'} generado${generated === 1 ? '' : 's'}`
      : 'Los gastos del mes ya estaban generados');
  }
}

function recordForPayment(type, id) {
  if (type === 'order') return state.orders.find(item => item.id === id);
  if (type === 'purchase') return state.purchases.find(item => item.id === id);
  return state.expenses.find(item => item.id === id);
}

function totalsForPayment(type, record) {
  if (type === 'order') return documentTotals(record);
  if (type === 'purchase') return purchaseTotals(record);
  return expenseTotals(record);
}

function openPaymentModal(type, id) {
  const record = recordForPayment(type, id);
  if (!record) return;
  const totals = totalsForPayment(type, record);
  if (totals.credit > 0) {
    return showToast(`Este registro tiene ${money(totals.credit)} a favor. Corrige o devuelve el excedente antes de registrar otro pago.`, 'warning');
  }
  if (totals.balance <= 0) return showToast('Este registro no tiene saldo pendiente.', 'warning');

  const title = type === 'order'
    ? `Cobro de ${record.folio}`
    : type === 'purchase'
      ? `Pago de compra ${record.invoice || ''}`
      : `Pago de ${record.description}`;
  openModal(
    title,
    `<form id="paymentForm" class="modal-form">
      <input type="hidden" name="recordType" value="${type}">
      <input type="hidden" name="recordId" value="${id}">
      <label>Fecha<input name="date" type="date" value="${todayISO()}" required></label>
      <label>Monto<input name="amount" type="number" min="0.01" max="${totals.balance}" step="0.01" value="${totals.balance}" required></label>
      <label>Método<select name="method">${paymentMethodOptions('efectivo')}</select></label>
      <label>Referencia<input name="reference" placeholder="Folio de transferencia, recibo..."></label>
      <div class="summary-box">
        <div class="summary-row"><span>Total</span><strong>${money(totals.total)}</strong></div>
        <div class="summary-row"><span>Pagado</span><strong>${money(totals.paid)}</strong></div>
        <div class="summary-row total"><span>Pendiente</span><strong>${money(totals.balance)}</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="paymentForm">Registrar pago</button>`
  );
}

function savePayment(form) {
  const data = Object.fromEntries(new FormData(form));
  const record = recordForPayment(data.recordType, data.recordId);
  if (!record) return;
  const totals = totalsForPayment(data.recordType, record);
  const amount = Math.min(num(data.amount), totals.balance);
  if (amount <= 0) return showToast('El monto debe ser mayor a cero', 'error');
  record.payments = record.payments || [];
  record.payments.push({
    id: uid('pay'), date: data.date, amount, method: data.method,
    reference: data.reference.trim(), createdAt: new Date().toISOString()
  });
  closeModal(true);
  saveState(data.recordType === 'order' ? 'Cobro registrado' : 'Pago registrado');
}

function openCashTransactionModal() {
  openModal(
    'Movimiento manual de caja',
    `<form id="cashTransactionForm" class="modal-form">
      <label>Fecha<input name="date" type="date" value="${todayISO()}" required></label>
      <label>Tipo<select name="type"><option value="entrada">Entrada</option><option value="salida">Salida / retiro</option></select></label>
      <label>Monto<input name="amount" type="number" min="0.01" step="0.01" required></label>
      <label>Método<select name="method">${paymentMethodOptions('efectivo')}</select></label>
      <label class="full">Descripción<input name="description" required placeholder="Aportación, retiro personal, ajuste..."></label>
      <label class="full">Referencia<input name="reference"></label>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="cashTransactionForm">Guardar movimiento</button>`
  );
}

function saveCashTransaction(form) {
  const data = Object.fromEntries(new FormData(form));
  state.cashTransactions.push({
    id: uid('cash'), date: data.date, type: data.type, amount: num(data.amount),
    method: data.method, description: data.description.trim(), reference: data.reference.trim(),
    createdAt: new Date().toISOString()
  });
  closeModal(true);
  saveState('Movimiento de caja registrado');
}

function openCashClosing() {
  const date = todayISO();
  const entries = cashEntries().filter(entry => entry.date === date && entry.method === 'efectivo');
  const income = sum(entries.filter(entry => entry.type === 'entrada'), entry => num(entry.amount));
  const out = sum(entries.filter(entry => entry.type === 'salida'), entry => num(entry.amount));
  openModal(
    `Corte de efectivo · ${formatDate(date)}`,
    `<div class="metrics-grid three compact">
      <article class="metric-card"><span>Entradas en efectivo</span><strong>${money(income)}</strong></article>
      <article class="metric-card"><span>Salidas en efectivo</span><strong>${money(out)}</strong></article>
      <article class="metric-card"><span>Movimiento neto</span><strong>${money(income - out)}</strong></article>
    </div>
    <div class="summary-box"><div class="summary-row total"><span>Efectivo acumulado esperado</span><strong>${money(cashBalance())}</strong></div></div>
    <div class="info-box"><strong>Importante</strong><p>Transferencias, tarjetas y depósitos no forman parte del efectivo físico y se muestran en Saldos por método.</p></div>`,
    '<button class="button primary" onclick="window.print()">Imprimir</button><button class="button secondary" data-close-modal>Cerrar</button>'
  );
}