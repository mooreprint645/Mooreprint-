function openModal(title, body, footer = '', wide = false, context = null) {
  modalContext = context;
  $('#modalContainer').className = `modal${wide ? ' wide' : ''}`;
  $('#modalContainer').innerHTML = `<div class="modal-header"><h2 id="modalTitle">${esc(title)}</h2><button class="modal-close" data-close-modal>×</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
  $('#modalBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(keepDraftFiles = false) {
  const context = modalContext;
  modalContext = null;
  $('#modalBackdrop').hidden = true;
  $('#modalContainer').innerHTML = '';
  document.body.style.overflow = '';
  if (!keepDraftFiles && context?.type === 'order' && context.isNew && window.FileDB) FileDB.removeOrderFiles(context.id).catch(() => {});
}

function customerOptions(selected = '') {
  return `<option value="">Capturar cliente manualmente</option>${state.customers.map(customer => `<option value="${customer.id}" ${selected === customer.id ? 'selected' : ''}>${esc(customer.name)}</option>`).join('')}`;
}
function supplierOptions(selected = '') {
  return `<option value="">Sin proveedor</option>${state.suppliers.map(supplier => `<option value="${supplier.id}" ${selected === supplier.id ? 'selected' : ''}>${esc(supplier.name)}</option>`).join('')}`;
}
function materialOptions(selected = '') {
  return `<option value="">Selecciona material</option>${state.materials.map(material => `<option value="${material.id}" ${selected === material.id ? 'selected' : ''}>${esc(material.name)} · ${num(material.stock).toFixed(2)} ${esc(material.unit || '')}</option>`).join('')}`;
}
function productOptions(selected = '') {
  return `<option value="">Concepto personalizado</option>${state.products.map(product => `<option value="${product.id}" ${selected === product.id ? 'selected' : ''}>${esc(product.name)}</option>`).join('')}`;
}
function paymentMethodOptions(selected = 'efectivo') {
  return ['efectivo', 'transferencia', 'tarjeta', 'deposito', 'credito', 'otro'].map(method => `<option value="${method}" ${selected === method ? 'selected' : ''}>${methodName(method)}</option>`).join('');
}
function expenseCategoryOptions(selected = 'otros') {
  return ['pasajes','gasolina','gas','renta_local','servicios','sueldos','mantenimiento','marketing','impuestos','otros'].map(category => `<option value="${category}" ${selected === category ? 'selected' : ''}>${categoryName(category)}</option>`).join('');
}

function openCustomerModal(id = '') {
  const customer = state.customers.find(item => item.id === id) || {};
  openModal(id ? 'Editar cliente' : 'Nuevo cliente', `<form id="customerForm" class="modal-form"><input type="hidden" name="id" value="${esc(customer.id || '')}"><label>Nombre<input name="name" required value="${esc(customer.name || '')}"></label><label>Teléfono / WhatsApp<input name="phone" value="${esc(customer.phone || '')}"></label><label>Correo<input name="email" type="email" value="${esc(customer.email || '')}"></label><label>RFC<input name="rfc" value="${esc(customer.rfc || '')}"></label><label class="full">Dirección<input name="address" value="${esc(customer.address || '')}"></label><label class="full">Notas<textarea name="notes" rows="3">${esc(customer.notes || '')}</textarea></label></form>`, `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="customerForm">Guardar cliente</button>`);
}
function saveCustomer(form) {
  const data = Object.fromEntries(new FormData(form));
  const customer = { id: data.id || uid('customer'), name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim(), rfc: data.rfc.trim(), address: data.address.trim(), notes: data.notes.trim(), updatedAt: new Date().toISOString() };
  const index = state.customers.findIndex(item => item.id === customer.id);
  if (index >= 0) state.customers[index] = { ...state.customers[index], ...customer }; else state.customers.push({ ...customer, createdAt: new Date().toISOString() });
  closeModal(true); saveState(index >= 0 ? 'Cliente actualizado' : 'Cliente agregado');
}
function openCustomerHistory(id) {
  const customer = state.customers.find(item => item.id === id); if (!customer) return;
  const orders = state.orders.filter(order => order.customerId === id);
  const quotes = state.quotes.filter(quote => quote.customerId === id);
  openModal(customer.name, `<div class="tabs"><button class="tab-button active" data-tab="customerOrders">Pedidos (${orders.length})</button><button class="tab-button" data-tab="customerQuotes">Cotizaciones (${quotes.length})</button><button class="tab-button" data-tab="customerNotes">Datos</button></div><div class="tab-pane active" id="customerOrders">${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Saldo</th></tr></thead><tbody>${orders.map(order => `<tr><td>${esc(order.folio)}</td><td>${formatDate(order.orderDate)}</td><td>${statusName(order.status)}</td><td>${money(documentTotals(order).total)}</td><td>${money(documentTotals(order).balance)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin pedidos.</p>'}</div><div class="tab-pane" id="customerQuotes">${quotes.length ? `<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>${quotes.map(quote => `<tr><td>${esc(quote.folio)}</td><td>${formatDate(quote.date)}</td><td>${statusName(quote.status)}</td><td>${money(documentTotals(quote).total)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin cotizaciones.</p>'}</div><div class="tab-pane" id="customerNotes"><p><strong>Teléfono:</strong> ${esc(customer.phone || '—')}</p><p><strong>Correo:</strong> ${esc(customer.email || '—')}</p><p><strong>RFC:</strong> ${esc(customer.rfc || '—')}</p><p><strong>Dirección:</strong> ${esc(customer.address || '—')}</p><p><strong>Notas:</strong> ${esc(customer.notes || '—')}</p></div>`, '<button class="button secondary" data-close-modal>Cerrar</button>', true);
}

function openSupplierModal(id = '') {
  const supplier = state.suppliers.find(item => item.id === id) || {};
  openModal(id ? 'Editar proveedor' : 'Nuevo proveedor', `<form id="supplierForm" class="modal-form"><input type="hidden" name="id" value="${esc(supplier.id || '')}"><label>Proveedor<input name="name" required value="${esc(supplier.name || '')}"></label><label>Persona de contacto<input name="contact" value="${esc(supplier.contact || '')}"></label><label>Teléfono<input name="phone" value="${esc(supplier.phone || '')}"></label><label>Correo<input name="email" type="email" value="${esc(supplier.email || '')}"></label><label class="full">Dirección<input name="address" value="${esc(supplier.address || '')}"></label><label class="full">Productos que vende<input name="products" value="${esc(supplier.products || '')}"></label><label class="full">Notas<textarea name="notes" rows="3">${esc(supplier.notes || '')}</textarea></label></form>`, `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="supplierForm">Guardar proveedor</button>`);
}
function saveSupplier(form) {
  const data = Object.fromEntries(new FormData(form));
  const supplier = { id: data.id || uid('supplier'), name: data.name.trim(), contact: data.contact.trim(), phone: data.phone.trim(), email: data.email.trim(), address: data.address.trim(), products: data.products.trim(), notes: data.notes.trim(), updatedAt: new Date().toISOString() };
  const index = state.suppliers.findIndex(item => item.id === supplier.id);
  if (index >= 0) state.suppliers[index] = { ...state.suppliers[index], ...supplier }; else state.suppliers.push({ ...supplier, createdAt: new Date().toISOString() });
  closeModal(true); saveState(index >= 0 ? 'Proveedor actualizado' : 'Proveedor agregado');
}
function openSupplierHistory(id) {
  const supplier = state.suppliers.find(item => item.id === id); if (!supplier) return;
  const purchases = state.purchases.filter(purchase => purchase.supplierId === id);
  const materials = state.materials.filter(material => material.supplierId === id);
  openModal(supplier.name, `<div class="tabs"><button class="tab-button active" data-tab="supplierPurchases">Compras (${purchases.length})</button><button class="tab-button" data-tab="supplierMaterials">Materiales (${materials.length})</button><button class="tab-button" data-tab="supplierData">Datos</button></div><div class="tab-pane active" id="supplierPurchases">${purchases.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Factura</th><th>Total</th><th>Saldo</th></tr></thead><tbody>${purchases.map(purchase => `<tr><td>${formatDate(purchase.date)}</td><td>${esc(purchase.invoice || '—')}</td><td>${money(purchaseTotals(purchase).total)}</td><td>${money(purchaseTotals(purchase).balance)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin compras.</p>'}</div><div class="tab-pane" id="supplierMaterials">${materials.length ? materials.map(material => `<div class="mini-row"><div><strong>${esc(material.name)}</strong><small>${num(material.stock).toFixed(2)} ${esc(material.unit || '')}</small></div><span>${money(material.unitCost)}</span></div>`).join('') : '<p>Sin materiales vinculados.</p>'}</div><div class="tab-pane" id="supplierData"><p><strong>Contacto:</strong> ${esc(supplier.contact || '—')}</p><p><strong>Teléfono:</strong> ${esc(supplier.phone || '—')}</p><p><strong>Correo:</strong> ${esc(supplier.email || '—')}</p><p><strong>Dirección:</strong> ${esc(supplier.address || '—')}</p><p><strong>Productos:</strong> ${esc(supplier.products || '—')}</p><p><strong>Notas:</strong> ${esc(supplier.notes || '—')}</p></div>`, '<button class="button secondary" data-close-modal>Cerrar</button>', true);
}
