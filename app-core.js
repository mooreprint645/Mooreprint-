const STORAGE_KEY = 'mooreprint-control-v1';
const INVENTORY_STATUSES = new Set(['en_proceso', 'listo', 'entregado']);

const defaultState = {
  version: 2,
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
const sum = (items, getter) => items.reduce((total, item) => total + getter(item), 0);

let state = loadState();

function normalizeState(saved) {
  const result = { ...clone(defaultState), ...(saved || {}) };
  Object.keys(defaultState).forEach(key => {
    if (Array.isArray(defaultState[key]) && !Array.isArray(result[key])) result[key] = [];
  });
  result.business = { ...defaultState.business, ...(saved?.business || {}) };
  result.products = result.products.map(product => ({ recipe: [], designCost: 0, electricityCost: 0, packagingCost: 0, transportCost: 0, externalCost: 0, commissionPercent: 0, wastePercent: 0, ...product }));
  result.orders = result.orders.map(order => {
    const payments = Array.isArray(order.payments) ? order.payments : (num(order.paid) > 0 ? [{ id: uid('pay'), date: order.orderDate || todayISO(), amount: num(order.paid), method: 'otro', reference: 'Pago migrado' }] : []);
    return { customerId: '', priority: 'normal', designStatus: 'pendiente', responsible: '', discount: 0, taxPercent: 0, deliveryCharge: 0, deliveryCost: 0, payments, inventoryApplied: false, inventorySnapshot: [], ...order, payments };
  });
  result.expenses = result.expenses.map(expense => {
    const payments = Array.isArray(expense.payments) ? expense.payments : [{ id: uid('pay'), date: expense.date || todayISO(), amount: num(expense.paidAmount ?? expense.amount), method: expense.paymentMethod || 'otro', reference: 'Pago migrado' }].filter(payment => payment.amount > 0);
    return { dueDate: expense.date, payments, recurringId: '', ...expense, payments };
  });
  result.purchases = result.purchases.map(purchase => ({ payments: [], inventoryApplied: true, ...purchase }));
  result.version = 2;
  return result;
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch (error) { return clone(defaultState); }
}

function saveState(message = '', type = 'normal') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return ({ pendiente: 'Pendiente', en_proceso: 'En proceso', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado', borrador: 'Borrador', enviada: 'Enviada', aceptada: 'Aceptada', rechazada: 'Rechazada', vencida: 'Vencida', convertida: 'Convertida' })[status] || status;
}
function methodName(method) {
  return ({ efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', deposito: 'Depósito', credito: 'Crédito', otro: 'Otro' })[method] || method || 'Otro';
}
function inRange(date, from, to) { return Boolean(date) && (!from || date >= from) && (!to || date <= to); }
function currentMonthRange() {
  const now = new Date();
  const localISO = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: localISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function nextFolio(collection, prefix) {
  const highest = collection.reduce((max, item) => {
    const match = String(item.folio || '').match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`;
}
function entityName(list, id, fallback = 'Sin registrar') { return list.find(item => item.id === id)?.name || fallback; }
function paymentTotal(record) { return sum(record.payments || [], payment => num(payment.amount)); }

function productBreakdown(product, salePrice = product.salePrice) {
  const recipeCost = sum(product.recipe || [], row => {
    const material = state.materials.find(item => item.id === row.materialId);
    return num(row.qty) * num(material?.unitCost);
  });
  const legacyMaterial = product.recipe?.length ? 0 : num(product.materialCost);
  const material = recipeCost + legacyMaterial;
  const process = num(product.laborCost) + num(product.designCost) + num(product.electricityCost) + num(product.packagingCost) + num(product.transportCost) + num(product.externalCost) + num(product.extraCost);
  const waste = (material + process) * num(product.wastePercent) / 100;
  const commission = num(salePrice) * num(product.commissionPercent) / 100;
  const total = material + process + waste + commission;
  return { material, process, waste, commission, total, profit: num(salePrice) - total };
}

function documentTotals(document) {
  const subtotal = sum(document.items || [], item => num(item.qty) * num(item.price));
  const discount = Math.min(subtotal, num(document.discount));
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * num(document.taxPercent) / 100;
  const total = taxable + tax + num(document.deliveryCharge);
  const costs = sum(document.items || [], item => num(item.qty) * num(item.cost)) + num(document.deliveryCost);
  const paid = paymentTotal(document);
  return { subtotal, discount, tax, total, costs, profit: total - costs, paid, balance: Math.max(0, total - paid) };
}

function purchaseTotals(purchase) {
  const total = sum(purchase.items || [], item => num(item.qty) * num(item.unitCost));
  const paid = paymentTotal(purchase);
  return { total, paid, balance: Math.max(0, total - paid) };
}
function expenseTotals(expense) {
  const total = num(expense.amount);
  const paid = paymentTotal(expense);
  return { total, paid, balance: Math.max(0, total - paid), status: paid >= total && total > 0 ? 'pagado' : paid > 0 ? 'parcial' : (expense.dueDate && expense.dueDate < todayISO() ? 'vencido' : 'pendiente') };
}
function inventoryValue() { return sum(state.materials, material => num(material.stock) * num(material.unitCost)); }
function isLowStock(material) { return num(material.stock) <= num(material.minStock); }
function isOverdue(order) { return !['entregado', 'cancelado'].includes(order.status) && order.dueDate && order.dueDate < todayISO(); }

function aggregateRecipeUsage(order) {
  const usage = {};
  (order.items || []).forEach(item => {
    const recipe = Array.isArray(item.recipe) ? item.recipe : [];
    recipe.forEach(row => {
      if (!row.materialId) return;
      usage[row.materialId] = (usage[row.materialId] || 0) + num(row.qty) * num(item.qty);
    });
  });
  return Object.entries(usage).map(([materialId, qty]) => ({ materialId, qty }));
}

function addInventoryMovement(materialId, quantity, type, reason, referenceId = '', date = todayISO()) {
  state.inventoryMovements.push({ id: uid('move'), materialId, quantity: num(quantity), type, reason, referenceId, date, createdAt: new Date().toISOString() });
}

function canSyncOrderInventory(oldOrder, newOrder) {
  if (!INVENTORY_STATUSES.has(newOrder.status)) return true;
  const oldMap = Object.fromEntries((oldOrder?.inventoryApplied ? oldOrder.inventorySnapshot || [] : []).map(row => [row.materialId, num(row.qty)]));
  const newUsage = aggregateRecipeUsage(newOrder);
  const shortages = newUsage.filter(row => {
    const material = state.materials.find(item => item.id === row.materialId);
    return num(material?.stock) + num(oldMap[row.materialId]) < num(row.qty);
  });
  if (!shortages.length) return true;
  const names = shortages.map(row => `${entityName(state.materials, row.materialId)} (faltan ${Math.max(0, row.qty - num(state.materials.find(item => item.id === row.materialId)?.stock) - num(oldMap[row.materialId])).toFixed(2)})`).join(', ');
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
  if (INVENTORY_STATUSES.has(newOrder.status)) {
    const usage = aggregateRecipeUsage(newOrder);
    usage.forEach(row => {
      const material = state.materials.find(item => item.id === row.materialId);
      if (material) material.stock = num(material.stock) - num(row.qty);
      addInventoryMovement(row.materialId, -num(row.qty), 'salida', `Consumo del pedido ${newOrder.folio}`, newOrder.id);
    });
    newOrder.inventoryApplied = true;
    newOrder.inventorySnapshot = usage;
  }
}

function canSyncPurchaseInventory(oldPurchase, newPurchase) {
  if (!oldPurchase?.inventoryApplied) return true;
  const oldQty = {};
  (oldPurchase.items || []).forEach(item => { oldQty[item.materialId] = (oldQty[item.materialId] || 0) + num(item.qty); });
  const newQty = {};
  (newPurchase.items || []).forEach(item => { newQty[item.materialId] = (newQty[item.materialId] || 0) + num(item.qty); });
  return Object.keys(oldQty).every(materialId => num(state.materials.find(item => item.id === materialId)?.stock) - num(oldQty[materialId]) + num(newQty[materialId]) >= 0) || window.confirm('Al modificar esta compra alguna existencia puede quedar negativa. ¿Deseas continuar?');
}

function syncPurchaseInventory(oldPurchase, newPurchase) {
  if (oldPurchase?.inventoryApplied) {
    (oldPurchase.items || []).forEach(item => {
      const material = state.materials.find(row => row.id === item.materialId);
      if (material) material.stock = num(material.stock) - num(item.qty);
      addInventoryMovement(item.materialId, -num(item.qty), 'ajuste', `Reversión de compra ${oldPurchase.invoice || oldPurchase.id}`, oldPurchase.id);
    });
  }
  (newPurchase.items || []).forEach(item => {
    const material = state.materials.find(row => row.id === item.materialId);
    if (!material) return;
    const previousStock = num(material.stock);
    const newStock = previousStock + num(item.qty);
    if (newStock > 0) material.unitCost = ((previousStock * num(material.unitCost)) + (num(item.qty) * num(item.unitCost))) / newStock;
    material.stock = newStock;
    addInventoryMovement(item.materialId, num(item.qty), 'entrada', `Compra ${newPurchase.invoice || newPurchase.id}`, newPurchase.id, newPurchase.date);
  });
  newPurchase.inventoryApplied = true;
}

function cashEntries() {
  const entries = [{ id: 'opening', date: '0000-00-00', type: 'entrada', origin: 'saldo_inicial', description: 'Saldo inicial de caja', method: 'otro', reference: '', amount: num(state.business.openingCash) }];
  state.orders.forEach(order => (order.payments || []).forEach(payment => entries.push({ ...payment, id: `order-${payment.id}`, type: 'entrada', origin: 'pedido', description: `${order.folio} · ${order.customer || entityName(state.customers, order.customerId)}`, amount: num(payment.amount), sourceId: order.id })));
  state.purchases.forEach(purchase => (purchase.payments || []).forEach(payment => entries.push({ ...payment, id: `purchase-${payment.id}`, type: 'salida', origin: 'compra', description: `${purchase.invoice || 'Compra'} · ${entityName(state.suppliers, purchase.supplierId)}`, amount: num(payment.amount), sourceId: purchase.id })));
  state.expenses.forEach(expense => (expense.payments || []).forEach(payment => entries.push({ ...payment, id: `expense-${payment.id}`, type: 'salida', origin: 'gasto', description: expense.description, amount: num(payment.amount), sourceId: expense.id })));
  state.cashTransactions.forEach(transaction => entries.push({ ...transaction, origin: 'manual', amount: num(transaction.amount) }));
  return entries.sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`));
}
function cashBalance() { return sum(cashEntries(), entry => entry.type === 'entrada' ? num(entry.amount) : -num(entry.amount)); }
function accountsReceivable() { return sum(state.orders.filter(order => order.status !== 'cancelado'), order => documentTotals(order).balance); }
function accountsPayable() { return sum(state.purchases, purchase => purchaseTotals(purchase).balance) + sum(state.expenses, expense => expenseTotals(expense).balance); }
