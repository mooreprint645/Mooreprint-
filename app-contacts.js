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
  if (!keepDraftFiles && context?.type === 'order' && context.isNew && window.FileDB) {
    FileDB.removeOrderFiles(context.id).catch(() => {});
  }
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
  return ['efectivo', 'transferencia', 'tarjeta', 'deposito', 'credito', 'otro']
    .map(method => `<option value="${method}" ${selected === method ? 'selected' : ''}>${methodName(method)}</option>`)
    .join('');
}
function expenseCategoryOptions(selected = 'otros') {
  return ['pasajes', 'gasolina', 'gas', 'renta_local', 'servicios', 'sueldos', 'mantenimiento', 'marketing', 'impuestos', 'otros']
    .map(category => `<option value="${category}" ${selected === category ? 'selected' : ''}>${categoryName(category)}</option>`)
    .join('');
}

function openCustomerModal(id = '') {
  const customer = state.customers.find(item => item.id === id) || {};
  openModal(
    id ? 'Editar cliente' : 'Nuevo cliente',
    `<form id="customerForm" class="modal-form">
      <input type="hidden" name="id" value="${esc(customer.id || '')}">
      <label>Nombre comercial<input name="name" required value="${esc(customer.name || '')}"></label>
      <label>Teléfono / WhatsApp<input name="phone" value="${esc(customer.phone || '')}"></label>
      <label>Correo<input name="email" type="email" value="${esc(customer.email || '')}"></label>
      <label>RFC<input name="rfc" maxlength="13" value="${esc(customer.rfc || '')}"></label>
      <label class="full">Dirección<input name="address" value="${esc(customer.address || '')}"></label>
      <div class="info-box full"><strong>Datos fiscales CFDI 4.0</strong><p>Son opcionales hasta que el cliente solicite factura. Deben coincidir con su constancia de situación fiscal.</p></div>
      <label class="full">Nombre o razón social fiscal<input name="fiscalName" value="${esc(customer.fiscalName || '')}"></label>
      <label>Código postal fiscal<input name="fiscalPostalCode" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" value="${esc(customer.fiscalPostalCode || '')}"></label>
      <label>Régimen fiscal (clave)<input name="fiscalRegime" list="fiscalRegimeOptions" maxlength="3" value="${esc(customer.fiscalRegime || '')}"></label>
      <label>Uso CFDI habitual<input name="cfdiUse" list="cfdiUseOptions" maxlength="4" value="${esc(customer.cfdiUse || '')}"></label>
      <label>Correo para factura<input name="invoiceEmail" type="email" value="${esc(customer.invoiceEmail || customer.email || '')}"></label>
      <label class="full">Notas<textarea name="notes" rows="3">${esc(customer.notes || '')}</textarea></label>
      <datalist id="fiscalRegimeOptions"><option value="601">General de Ley Personas Morales</option><option value="603">Personas Morales con Fines no Lucrativos</option><option value="605">Sueldos y Salarios</option><option value="606">Arrendamiento</option><option value="612">Personas Físicas con Actividades Empresariales y Profesionales</option><option value="616">Sin obligaciones fiscales</option><option value="621">Incorporación Fiscal</option><option value="625">Plataformas Tecnológicas</option><option value="626">Régimen Simplificado de Confianza</option></datalist>
      <datalist id="cfdiUseOptions"><option value="G01">Adquisición de mercancías</option><option value="G02">Devoluciones, descuentos o bonificaciones</option><option value="G03">Gastos en general</option><option value="I01">Construcciones</option><option value="I04">Equipo de cómputo y accesorios</option><option value="S01">Sin efectos fiscales</option><option value="CP01">Pagos</option></datalist>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="customerForm">Guardar cliente</button>`,
    true
  );
}

function saveCustomer(form) {
  const data = Object.fromEntries(new FormData(form));
  const customer = {
    id: data.id || uid('customer'),
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    rfc: data.rfc.trim().toUpperCase(),
    address: data.address.trim(),
    fiscalName: data.fiscalName.trim(),
    fiscalPostalCode: data.fiscalPostalCode.trim(),
    fiscalRegime: data.fiscalRegime.trim(),
    cfdiUse: data.cfdiUse.trim().toUpperCase(),
    invoiceEmail: data.invoiceEmail.trim(),
    notes: data.notes.trim(),
    updatedAt: new Date().toISOString()
  };
  const index = state.customers.findIndex(item => item.id === customer.id);
  if (index >= 0) state.customers[index] = { ...state.customers[index], ...customer };
  else state.customers.push({ ...customer, createdAt: new Date().toISOString() });
  closeModal(true);
  saveState(index >= 0 ? 'Cliente actualizado' : 'Cliente agregado');
}

function openCustomerHistory(id) {
  const customer = state.customers.find(item => item.id === id);
  if (!customer) return;
  const orders = state.orders.filter(order => order.customerId === id);
  const quotes = state.quotes.filter(quote => quote.customerId === id);
  openModal(
    customer.name,
    `<div class="tabs"><button class="tab-button active" data-tab="customerOrders">Pedidos (${orders.length})</button><button class="tab-button" data-tab="customerQuotes">Cotizaciones (${quotes.length})</button><button class="tab-button" data-tab="customerNotes">Datos</button></div>
    <div class="tab-pane active" id="customerOrders">${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Saldo</th></tr></thead><tbody>${orders.map(order => `<tr><td>${esc(order.folio)}</td><td>${formatDate(order.orderDate)}</td><td>${statusName(order.status)}</td><td>${money(documentTotals(order).total)}</td><td>${money(documentTotals(order).balance)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin pedidos.</p>'}</div>
    <div class="tab-pane" id="customerQuotes">${quotes.length ? `<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>${quotes.map(quote => `<tr><td>${esc(quote.folio)}</td><td>${formatDate(quote.date)}</td><td>${statusName(quote.status)}</td><td>${money(documentTotals(quote).total)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin cotizaciones.</p>'}</div>
    <div class="tab-pane" id="customerNotes"><p><strong>Teléfono:</strong> ${esc(customer.phone || '—')}</p><p><strong>Correo:</strong> ${esc(customer.email || '—')}</p><p><strong>RFC:</strong> ${esc(customer.rfc || '—')}</p><p><strong>Razón social:</strong> ${esc(customer.fiscalName || '—')}</p><p><strong>Código postal fiscal:</strong> ${esc(customer.fiscalPostalCode || '—')}</p><p><strong>Régimen fiscal:</strong> ${esc(customer.fiscalRegime || '—')}</p><p><strong>Uso CFDI:</strong> ${esc(customer.cfdiUse || '—')}</p><p><strong>Correo para factura:</strong> ${esc(customer.invoiceEmail || '—')}</p><p><strong>Dirección:</strong> ${esc(customer.address || '—')}</p><p><strong>Notas:</strong> ${esc(customer.notes || '—')}</p></div>`,
    '<button class="button secondary" data-close-modal>Cerrar</button>',
    true
  );
}

function openSupplierModal(id = '') {
  const service = window.MoorePrintSupplierCatalog;
  if (service?.openSupplierModal) return service.openSupplierModal(id);
  showToast('El módulo de proveedores no está disponible.', 'error');
}

function saveSupplier(form) {
  const service = window.MoorePrintSupplierCatalog;
  if (service?.saveSupplier) return service.saveSupplier(form);
  showToast('El módulo de proveedores no está disponible.', 'error');
}

function openSupplierHistory(id) {
  const service = window.MoorePrintSupplierCatalog;
  if (service?.openSupplierHistory) return service.openSupplierHistory(id);
  showToast('El módulo de proveedores no está disponible.', 'error');
}
