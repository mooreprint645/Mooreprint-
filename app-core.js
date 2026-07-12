const STORAGE_KEY = 'mooreprint-control-v1';
const INVENTORY_STATUSES = new Set(['en_proceso', 'listo', 'entregado']);
const Accounting = window.MoorePrintAccountingMath;

if (!Accounting) throw new Error('No se cargó el motor contable de MoorePrint.');

const defaultState = {
  version: 4,
  customers: [], suppliers: [], materials: [], products: [], quotes: [], orders: [],
  purchases: [], expenses: [], recurringExpenses: [], cashTransactions: [], inventoryMovements: [],
  business: {
    name: 'MoorePrint', phone: '', email: '', address: '', city: 'Toluca, Estado de México',
    rfc: '', note: 'Gracias por su compra.', openingCash: 0, monthlyHours: 160
  }
};

let modalContext = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const num = value => Number.parseFloat(value) || 0;
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num(value));
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const monthKey = date => String(date || todayISO()).slice(0, 7);
const sum = (items, getter) => (items || []).reduce((total, item) => total + getter(item), 0);

let state = loadState();

function normalizeState(saved) {
  const result = { ...clone(defaultState), ...(saved || {}) };
  Object.keys(defaultState).forEach(key => {
    if (Array.isArray(defaultState[key]) && !Array.isArray(result[key])) result[key] = [];
  });
  result.business = { ...defaultState.business, ...(saved?.business || {}) };
  result.products = result.products.map(product => ({
    recipe: [], designCost: 0, electricityCost: 0, packagingCost: 0,
    transportCost: 0, externalCost: 0, commissionPercent: 0, wastePercent: 0,
    productionMinutes: 0, autoPrice: false, targetMarginPercent: 40, priceRounding: 1,
    ...product
  }));
  result.materials = result.materials.map(material => ({ lastValuationPurchaseId: '', ...material }));
  result.orders = result.orders.map(order => {
    const payments = Array.isArray(order.payments)
      ? order.payments
      : (num(order.paid) > 0
        ? [{ id: uid('pay'), date: order.orderDate || todayISO(), amount: num(order.paid), method: 'otro', reference: 'Pago migrado' }]
        : []);
    return {
      customerId: '', priority: 'normal', designStatus: 'pendiente', responsible: '',
      discount: 0, taxPercent: 0, deliveryCharge: 0, deliveryCost: 0,
      payments, inventoryApplied: false, inventorySnapshot: [], ...order, payments
    };
  });
  result.expenses = result.expenses.map(expense => {
    const payments = Array.isArray(expense.payments)
      ? expense.payments
      : [{
          id: uid('pay'), date: expense.date || todayISO(),
          amount: num(expense.paidAmount ?? expense.amount),
          method: expense.paymentMethod || 'otro', reference: 'Pago migrado'
        }].filter(payment => payment.amount > 0);
    return { dueDate: expense.date, payments, recurringId: '', includedInPricing: false, ...expense, payments };
  });
  result.recurringExpenses = result.recurringExpenses.map(item => ({ includedInPricing: false, ...item }));
  result.purchases = result.purchases.map(purchase => ({ payments: [], inventoryApplied: true, valuationSnapshot: [], ...purchase }));
  result.version = 4;
  return result;
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (error) { return clone(defaultState); }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState(message = '', type = 'normal') {
  persistState();
  renderAll();
  if (message) showToast(message, type);
}

function showToast(message, type = 'normal') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${type === 'error' ? ' error' : type === 'warning' ? ' warning' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function categoryName(category) {
  return ({ materiales: 'Materiales', pasajes: 'Pasajes', gasolina: 'Gasolina', gas: 'Gas', renta_local: 'Renta o local', servicios: 'Servicios', sueldos: 'Sueldos', mantenimiento: 'Mantenimiento', marketing: 'Publicidad', impuestos: 'Impuestos', otros: 'Otros' })[category] || category || 'Otros';
}
function statusName(status) {
  return ({ pendiente: 'Pendiente', en_proceso: 'En proceso', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado', borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida', convertida: 'Convertida', saldo_a_favor: 'Saldo a favor' })[status] || status;
}
function methodName(method) {
  return ({ efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', deposito: 'Depósito', credito: 'Crédito', otro: 'Otro' })[method] || method || 'Otro';
}
function inRange(date, from, to) { return Boolean(date) && (!from || date >= from) && (!to || date <= to); }
function currentMonthRange() {
  const now = new Date();
  const localISO = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return {
    from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}
function nextFolio(collection, prefix) {
  const highest = collection.reduce((max, item) => {
    const match = String(item.folio || '').match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}
function entityName(list, id, fallback = 'Sin registrar') { return list.find(item => item.id === id)?.name || fallback; }
function paymentTotal(record) { return Accounting.paymentTotal(record); }

function productBreakdown(product, salePrice = product.salePrice) {
  const recipeCost = sum(product.recipe || [], row => {
    if (!row.materialId) return 0;
    const material = state.materials.find(item => item.id === row.materialId);
    return num(row.qty) * num(material?.unitCost);
  });
  const legacyMaterial = product.recipe?.some(row => row.materialId) ? 0 : num(product.materialCost);
  const material = recipeCost + legacyMaterial;
  const processBase = num(product.laborCost) + num(product.designCost) + num(product.electricityCost)
    + num(product.packagingCost) + num(product.transportCost) + num(product.externalCost) + num(product.extraCost);
  const overhead = num(window.MoorePrintMonthlyCosts?.productMonthlyOverhead?.(product));
  const process = processBase + overhead;
  const waste = (material + process) * num(product.wastePercent) / 100;
  const commission = num(salePrice) * num(product.commissionPercent) / 100;
  const total = material + process + waste + commission;
  return { material, processBase, overhead, process, waste, commission, total, profit: num(salePrice) - total };
}

function documentTotals(document) { return Accounting.documentTotals(document); }
function purchaseTotals(purchase) { return Accounting.purchaseTotals(purchase); }
function expenseTotals(expense) { return Accounting.expenseTotals(expense, todayISO()); }
function inventoryValue() { return sum(state.materials, material => num(material.stock) * num(material.unitCost)); }
function isLowStock(material) { return num(material.stock) <= num(material.minStock); }
function isOverdue(order) { return !['entregado', 'cancelado'].includes(order.status) && order.dueDate && order.dueDate < todayISO(); }

function aggregateRecipeUsage(order) {
  const usage = {};
  (order.items || []).forEach(item => {
    (Array.isArray(item.recipe) ? item.recipe : []).forEach(row => {
      if (!row.materialId) return;
      usage[row.materialId] = (usage[row.materialId] || 0) + num(row.qty) * num(item.qty);
    });
  });
  return Object.entries(usage).map(([materialId, qty]) => ({ materialId, qty }));
}

function addInventoryMovement(materialId, quantity, type, reason, referenceId = '', date = todayISO(), details = {}) {
  state.inventoryMovements.push({
    id: uid('move'), materialId, quantity: num(quantity), type, reason,
    referenceId, date, createdAt: new Date().toISOString(), ...details
  });
}

function canSyncOrderInventory(oldOrder, newOrder) {
  if (!INVENTORY_STATUSES.has(newOrder.status)) return true;
  const oldMap = Object.fromEntries((oldOrder?.inventoryApplied ? oldOrder.inventorySnapshot || [] : []).map(row => [row.materialId, num(row.qty)]));
  const shortages = aggregateRecipeUsage(newOrder).filter(row => {
    const material = state.materials.find(item => item.id === row.materialId);
    return num(material?.stock) + num(oldMap[row.materialId]) < num(row.qty);
  });
  if (!shortages.length) return true;
  const names = shortages.map(row => {
    const stock = num(state.materials.find(item => item.id === row.materialId)?.stock);
    const missing = Math.max(0, row.qty - stock - num(oldMap[row.materialId]));
    return `${entityName(state.materials, row.materialId)} (faltan ${missing.toFixed(2)})`;
  }).join(', ');
  return window.confirm(`No hay suficiente existencia para: ${names}. ¿Deseas guardar y permitir inventario negativo?`);
}

function syncOrderInventory(oldOrder, newOrder) {
  if (oldOrder?.inventoryApplied) {
    (oldOrder.inventorySnapshot || []).forEach(row => {
      const material = state.materials.find(item => item.id === row.materialId);
      if (material) material.stock = num(material.stock) + num(row.qty);
      addInventoryMovement(row.materialId, num(row.qty), 'entrada', `Devolución por edición de ${oldOrder.folio}`, oldOrder.id);
    });
  }
  newOrder.inventoryApplied = false;
  newOrder.inventorySnapshot = [];
  if (!INVENTORY_STATUSES.has(newOrder.status)) return;
  const usage = aggregateRecipeUsage(newOrder);
  usage.forEach(row => {
    const material = state.materials.find(item => item.id === row.materialId);
    if (material) material.stock = num(material.stock) - num(row.qty);
    addInventoryMovement(row.materialId, -num(row.qty), 'salida', `Consumo del pedido ${newOrder.folio}`, newOrder.id);
  });
  newOrder.inventoryApplied = true;
  newOrder.inventorySnapshot = usage;
}

function aggregatePurchaseItems(items) { return Accounting.aggregatePurchaseItems(items); }

function canSyncPurchaseInventory(oldPurchase, newPurchase) {
  if (!oldPurchase?.inventoryApplied) return true;
  const oldRows = Object.fromEntries(aggregatePurchaseItems(oldPurchase.items).map(row => [row.materialId, row]));
  const newRows = Object.fromEntries(aggregatePurchaseItems(newPurchase.items).map(row => [row.materialId, row]));
  const safe = Object.keys(oldRows).every(materialId => {
    const stock = num(state.materials.find(item => item.id === materialId)?.stock);
    return stock - num(oldRows[materialId]?.qty) + num(newRows[materialId]?.qty) >= 0;
  });
  return safe || window.confirm('Al modificar esta compra alguna existencia puede quedar negativa. ¿Deseas continuar?');
}

function reversePurchaseInventory(purchase, reason = '') {
  if (!purchase?.inventoryApplied) return { warnings: 0 };
  let warnings = 0;
  aggregatePurchaseItems(purchase.items).forEach(row => {
    const material = state.materials.find(item => item.id === row.materialId);
    if (!material) return;
    const snapshot = (purchase.valuationSnapshot || []).find(item => item.materialId === row.materialId);
    const exactBeforeCost = material.lastValuationPurchaseId === purchase.id && snapshot
      ? snapshot.beforeUnitCost
      : undefined;
    const result = Accounting.reversePurchaseValuation(material, row, { exactBeforeCost });
    const beforeCost = num(material.unitCost);
    material.stock = result.stock;
    material.unitCost = Math.max(0, num(result.unitCost));
    if (material.lastValuationPurchaseId === purchase.id) {
      material.lastValuationPurchaseId = snapshot?.previousPurchaseId || '';
    }
    if (result.valuationWarning) warnings += 1;
    addInventoryMovement(
      row.materialId,
      -num(row.qty),
      'ajuste',
      reason || `Reversión de compra ${purchase.invoice || purchase.id}`,
      purchase.id,
      purchase.date || todayISO(),
      {
        unitCost: num(row.unitCost), valueDelta: -num(result.removedValue),
        unitCostBefore: beforeCost, unitCostAfter: material.unitCost,
        valuationWarning: Boolean(result.valuationWarning)
      }
    );
  });
  purchase.inventoryApplied = false;
  return { warnings };
}

function applyPurchaseInventory(purchase) {
  purchase.valuationSnapshot = [];
  aggregatePurchaseItems(purchase.items).forEach(row => {
    const material = state.materials.find(item => item.id === row.materialId);
    if (!material) return;
    const beforeStock = num(material.stock);
    const beforeUnitCost = num(material.unitCost);
    const previousPurchaseId = material.lastValuationPurchaseId || '';
    const result = Accounting.applyPurchaseValuation(material, row);
    material.stock = result.stock;
    material.unitCost = Math.max(0, num(result.unitCost));
    material.lastValuationPurchaseId = purchase.id;
    purchase.valuationSnapshot.push({
      materialId: row.materialId, beforeStock, beforeUnitCost, previousPurchaseId,
      purchasedQty: num(row.qty), purchaseUnitCost: num(row.unitCost),
      afterStock: material.stock, afterUnitCost: material.unitCost
    });
    addInventoryMovement(
      row.materialId,
      num(row.qty),
      'entrada',
      `Compra ${purchase.invoice || purchase.id}`,
      purchase.id,
      purchase.date,
      {
        unitCost: num(row.unitCost), valueDelta: num(result.addedValue),
        unitCostBefore: beforeUnitCost, unitCostAfter: material.unitCost
      }
    );
  });
  purchase.inventoryApplied = true;
}

function syncPurchaseInventory(oldPurchase, newPurchase) {
  const reverseResult = reversePurchaseInventory(oldPurchase, oldPurchase ? `Reversión de compra ${oldPurchase.invoice || oldPurchase.id}` : '');
  applyPurchaseInventory(newPurchase);
  if (reverseResult.warnings) {
    setTimeout(() => showToast('La compra se ajustó; revisa el costo promedio de los materiales marcados.', 'warning'), 0);
  }
}

function cashEntries() {
  const entries = [{
    id: 'opening', date: '0000-00-00', type: 'entrada', origin: 'saldo_inicial',
    description: 'Saldo inicial de efectivo', method: 'efectivo', reference: '',
    amount: num(state.business.openingCash)
  }];
  state.orders.forEach(order => (order.payments || []).forEach(payment => entries.push({
    ...payment, id: `order-${payment.id}`, type: 'entrada', origin: 'pedido',
    description: `${order.folio} · ${order.customer || entityName(state.customers, order.customerId)}`,
    amount: num(payment.amount), sourceId: order.id
  })));
  state.purchases.forEach(purchase => (purchase.payments || []).forEach(payment => entries.push({
    ...payment, id: `purchase-${payment.id}`, type: 'salida', origin: 'compra',
    description: `${purchase.invoice || 'Compra'} · ${entityName(state.suppliers, purchase.supplierId)}`,
    amount: num(payment.amount), sourceId: purchase.id
  })));
  state.expenses.forEach(expense => (expense.payments || []).forEach(payment => entries.push({
    ...payment, id: `expense-${payment.id}`, type: 'salida', origin: 'gasto',
    description: expense.description, amount: num(payment.amount), sourceId: expense.id
  })));
  state.cashTransactions.forEach(transaction => entries.push({ ...transaction, origin: 'manual', amount: num(transaction.amount) }));
  return entries.sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`));
}

function cashBalancesByMethod() {
  return Accounting.balancesByMethod(cashEntries(), state.business.openingCash);
}
function cashBalance() { return num(cashBalancesByMethod().efectivo); }
function fundsBalance() { return sum(Object.values(cashBalancesByMethod()), value => num(value)); }
function accountsReceivable() { return sum(state.orders.filter(order => order.status !== 'cancelado'), order => documentTotals(order).balance); }
function customerCredits() { return sum(state.orders.filter(order => order.status !== 'cancelado'), order => documentTotals(order).credit); }
function accountsPayable() { return sum(state.purchases, purchase => purchaseTotals(purchase).balance) + sum(state.expenses, expense => expenseTotals(expense).balance); }
function supplierCredits() { return sum(state.purchases, purchase => purchaseTotals(purchase).credit) + sum(state.expenses, expense => expenseTotals(expense).credit); }
