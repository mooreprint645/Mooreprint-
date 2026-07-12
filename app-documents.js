function documentLineRow(item = {}) {
  return `<div class="line-row document-line" data-recipe="${esc(JSON.stringify(item.recipe || []))}">
    <select class="line-product">${productOptions(item.productId)}</select>
    <input class="line-qty" type="number" min="1" step="1" value="${num(item.qty) || 1}" aria-label="Cantidad">
    <input class="line-price" type="number" min="0" step="0.01" value="${num(item.price)}" placeholder="Precio">
    <input class="line-cost" type="number" min="0" step="0.01" value="${num(item.cost)}" placeholder="Costo interno">
    <button type="button" class="action-button remove-row">×</button>
    <input class="line-name" style="grid-column:1/-1" value="${esc(item.name || '')}" placeholder="Nombre o descripción del trabajo">
  </div>`;
}

function selectedProductSnapshot(productId, price = null) {
  const product = state.products.find(item => item.id === productId);
  if (!product) return null;

  const automaticPrice = product.autoPrice
    ? recommendedProductPrice(product)
    : num(product.salePrice);
  if (product.autoPrice) product.salePrice = automaticPrice;

  const selectedPrice = price === null ? automaticPrice : num(price);
  const breakdown = productBreakdown(product, selectedPrice);
  const recipe = clone(product.recipe || []).filter(row => row?.materialId);
  recipe.push({
    kind: 'cost_breakdown',
    version: 1,
    overheadCost: Math.max(0, num(breakdown.overhead)),
    variableCost: Math.max(0, num(breakdown.total) - num(breakdown.overhead)),
    totalCost: Math.max(0, num(breakdown.total)),
    pricingMonth: state.business?.pricingMonth || monthKey(todayISO()),
    capturedAt: new Date().toISOString()
  });

  return {
    productId: product.id,
    name: product.name,
    price: selectedPrice,
    cost: breakdown.total,
    recipe
  };
}

function documentItemsFromForm(form) {
  return $$('.document-line', form).map(row => {
    let recipe = [];
    try { recipe = JSON.parse(row.dataset.recipe || '[]'); }
    catch (error) { recipe = []; }
    const productId = $('.line-product', row).value;
    const product = state.products.find(item => item.id === productId);
    return {
      productId,
      name: $('.line-name', row).value.trim() || product?.name || 'Trabajo sin nombre',
      qty: Math.max(1, num($('.line-qty', row).value)),
      price: num($('.line-price', row).value),
      cost: num($('.line-cost', row).value),
      recipe
    };
  });
}

function documentDraftFromForm(form) {
  return {
    items: documentItemsFromForm(form),
    discount: num(form.elements.discount?.value),
    taxPercent: num(form.elements.taxPercent?.value),
    deliveryCharge: num(form.elements.deliveryCharge?.value),
    deliveryCost: num(form.elements.deliveryCost?.value),
    payments: modalContext?.type === 'order'
      ? state.orders.find(order => order.id === modalContext.id)?.payments || []
      : []
  };
}

function updateDocumentPreview() {
  const form = $('#orderForm') || $('#quoteForm');
  if (!form) return;
  const totals = documentTotals(documentDraftFromForm(form));
  if ($('#docSubtotal')) $('#docSubtotal').textContent = money(totals.subtotal);
  if ($('#docTotal')) $('#docTotal').textContent = money(totals.total);
  if ($('#docCost')) $('#docCost').textContent = money(totals.costs);
  if ($('#docProfit')) {
    $('#docProfit').textContent = money(totals.profit);
    $('#docProfit').className = totals.profit < 0 ? 'money-negative' : 'money-positive';
  }
  const balanceNode = $('#docBalance');
  if (balanceNode) {
    const label = balanceNode.closest('.summary-row')?.querySelector('span');
    if (totals.credit > 0) {
      if (label) label.textContent = 'Saldo a favor';
      balanceNode.textContent = money(totals.credit);
      balanceNode.className = 'money-positive';
    } else {
      if (label) label.textContent = 'Saldo';
      balanceNode.textContent = money(totals.balance);
      balanceNode.className = totals.balance > 0 ? 'money-warning' : 'money-positive';
    }
  }
}

function orderSeedFromQuote(quote) {
  return {
    id: uid('order'),
    folio: nextFolio(state.orders, 'MP'),
    customerId: quote.customerId || '',
    customer: quote.customer || '',
    phone: quote.phone || '',
    orderDate: todayISO(),
    dueDate: todayISO(),
    actualDelivery: '',
    status: 'pendiente',
    priority: 'normal',
    designStatus: 'pendiente',
    responsible: '',
    discount: quote.discount || 0,
    taxPercent: quote.taxPercent || 0,
    deliveryCharge: quote.deliveryCharge || 0,
    deliveryCost: 0,
    notes: quote.notes || '',
    items: (quote.items || []).map(item => ({ ...item })),
    payments: [],
    inventoryApplied: false,
    inventorySnapshot: [],
    quoteId: quote.id
  };
}

function openOrderModal(id = '', quoteId = '') {
  const existing = state.orders.find(item => item.id === id);
  const quote = state.quotes.find(item => item.id === quoteId);
  const order = existing
    ? clone(existing)
    : quote
      ? orderSeedFromQuote(quote)
      : {
          id: uid('order'), folio: nextFolio(state.orders, 'MP'), customerId: '', customer: '', phone: '',
          orderDate: todayISO(), dueDate: todayISO(), actualDelivery: '', status: 'pendiente', priority: 'normal',
          designStatus: 'pendiente', responsible: '', discount: 0, taxPercent: 0,
          deliveryCharge: 0, deliveryCost: 0, notes: '', items: [{}], payments: [],
          inventoryApplied: false, inventorySnapshot: []
        };
  const paid = paymentTotal(order);

  openModal(
    existing ? `Editar pedido ${order.folio}` : 'Nuevo pedido',
    `<form id="orderForm" class="modal-form">
      <input type="hidden" name="id" value="${order.id}">
      <input type="hidden" name="folio" value="${esc(order.folio)}">
      <input type="hidden" name="quoteId" value="${esc(order.quoteId || '')}">
      <div class="form-section">
        <div class="section-title"><div><h3>Cliente y seguimiento</h3></div></div>
        <div class="modal-form">
          <label>Cliente registrado<select name="customerId" id="orderCustomerSelect">${customerOptions(order.customerId)}</select></label>
          <label>Nombre en la nota<input name="customer" required value="${esc(order.customer || entityName(state.customers, order.customerId, ''))}"></label>
          <label>Teléfono<input name="phone" value="${esc(order.phone || '')}"></label>
          <label>Responsable<input name="responsible" value="${esc(order.responsible || '')}" placeholder="Empleado o área"></label>
          <label>Fecha del pedido<input name="orderDate" type="date" required value="${order.orderDate}"></label>
          <label>Fecha prometida<input name="dueDate" type="date" required value="${order.dueDate}"></label>
          <label>Entrega real<input name="actualDelivery" type="date" value="${order.actualDelivery || ''}"></label>
          <label>Prioridad<select name="priority">${['baja', 'normal', 'alta', 'urgente'].map(value => `<option value="${value}" ${order.priority === value ? 'selected' : ''}>${value[0].toUpperCase()}${value.slice(1)}</option>`).join('')}</select></label>
          <label>Estado<select name="status">${['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'].map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${statusName(status)}</option>`).join('')}</select></label>
          <label>Diseño<select name="designStatus"><option value="pendiente" ${order.designStatus === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="en_diseño" ${order.designStatus === 'en_diseño' ? 'selected' : ''}>En diseño</option><option value="enviado" ${order.designStatus === 'enviado' ? 'selected' : ''}>Enviado al cliente</option><option value="aprobado" ${order.designStatus === 'aprobado' ? 'selected' : ''}>Aprobado</option><option value="no_aplica" ${order.designStatus === 'no_aplica' ? 'selected' : ''}>No aplica</option></select></label>
        </div>
      </div>
      <div class="form-section">
        <div class="section-title"><div><h3>Productos o trabajos</h3><p>El costo interno no aparece en la nota del cliente.</p></div><button type="button" class="button secondary small" id="addDocumentLine">+ Concepto</button></div>
        <div class="dynamic-list" id="documentLines">${(order.items?.length ? order.items : [{}]).map(documentLineRow).join('')}</div>
      </div>
      <div class="form-section">
        <div class="section-title"><div><h3>Totales y entrega</h3></div></div>
        <div class="modal-form">
          <label>Descuento $<input name="discount" class="doc-total-input" type="number" min="0" step="0.01" value="${num(order.discount)}"></label>
          <label>IVA %<input name="taxPercent" class="doc-total-input" type="number" min="0" step="0.01" value="${num(order.taxPercent)}"></label>
          <label>Cobro de envío / instalación<input name="deliveryCharge" class="doc-total-input" type="number" min="0" step="0.01" value="${num(order.deliveryCharge)}"></label>
          <label>Costo real de envío / instalación<input name="deliveryCost" class="doc-total-input" type="number" min="0" step="0.01" value="${num(order.deliveryCost)}"></label>
          <label class="full">Notas e indicaciones<textarea name="notes" rows="3">${esc(order.notes || '')}</textarea></label>
        </div>
      </div>
      <div class="attachment-box">
        <div class="section-title"><div><h3>Diseños y comprobantes</h3><p>Se guardan localmente en este navegador.</p></div><label class="button secondary small file-button">Subir archivos<input type="file" id="orderAttachmentInput" multiple accept="image/*,.pdf,.svg,.ai,.cdr,.psd,.zip"></label></div>
        <div class="attachment-list" id="attachmentList"><small>Cargando archivos...</small></div>
      </div>
      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><strong id="docSubtotal">$0.00</strong></div>
        <div class="summary-row"><span>Total</span><strong id="docTotal">$0.00</strong></div>
        <div class="summary-row"><span>Pagado</span><strong>${money(paid)}</strong></div>
        <div class="summary-row"><span>Saldo</span><strong id="docBalance">$0.00</strong></div>
        <div class="summary-row"><span>Costo interno</span><strong id="docCost">$0.00</strong></div>
        <div class="summary-row total"><span>Ganancia estimada sin IVA</span><strong id="docProfit">$0.00</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="orderForm">Guardar pedido</button>`,
    true,
    { type: 'order', id: order.id, isNew: !existing }
  );
  updateDocumentPreview();
  renderAttachmentList(order.id);
}

async function renderAttachmentList(orderId) {
  const container = $('#attachmentList');
  if (!container || !window.FileDB) return;
  try {
    const files = await FileDB.listFiles(orderId);
    container.innerHTML = files.length
      ? files.map(file => `<div class="attachment-row"><div><strong>${esc(file.name)}</strong><small>${(num(file.size) / 1024).toFixed(1)} KB · ${formatDate(String(file.createdAt).slice(0, 10))}</small></div><div class="action-group"><button type="button" class="action-button" data-download-file="${file.id}">↓</button><button type="button" class="action-button" data-delete-file="${file.id}" data-order-id="${orderId}">×</button></div></div>`).join('')
      : '<small>No hay archivos adjuntos.</small>';
  } catch (error) {
    container.innerHTML = '<small>No fue posible leer los archivos.</small>';
  }
}

function saveOrder(form) {
  const data = Object.fromEntries(new FormData(form));
  const oldOrder = state.orders.find(item => item.id === data.id);
  const customer = state.customers.find(item => item.id === data.customerId);
  const order = {
    id: data.id,
    folio: data.folio,
    quoteId: data.quoteId,
    customerId: data.customerId,
    customer: data.customer.trim() || customer?.name || '',
    phone: data.phone.trim() || customer?.phone || '',
    responsible: data.responsible.trim(),
    orderDate: data.orderDate,
    dueDate: data.dueDate,
    actualDelivery: data.actualDelivery,
    priority: data.priority,
    status: data.status,
    designStatus: data.designStatus,
    discount: num(data.discount),
    taxPercent: num(data.taxPercent),
    deliveryCharge: num(data.deliveryCharge),
    deliveryCost: num(data.deliveryCost),
    notes: data.notes.trim(),
    items: documentItemsFromForm(form),
    payments: clone(oldOrder?.payments || []),
    inventoryApplied: oldOrder?.inventoryApplied || false,
    inventorySnapshot: clone(oldOrder?.inventorySnapshot || []),
    updatedAt: new Date().toISOString()
  };
  if (!order.items.length || !order.customer) return showToast('Completa el cliente y al menos un concepto', 'error');
  if (!canSyncOrderInventory(oldOrder, order)) return;
  syncOrderInventory(oldOrder, order);
  const index = state.orders.findIndex(item => item.id === order.id);
  if (index >= 0) state.orders[index] = { ...state.orders[index], ...order };
  else state.orders.push({ ...order, createdAt: new Date().toISOString() });
  if (order.quoteId) {
    const sourceQuote = state.quotes.find(item => item.id === order.quoteId);
    if (sourceQuote) {
      sourceQuote.status = 'convertida';
      sourceQuote.orderId = order.id;
    }
  }
  if (order.status === 'entregado' && !order.actualDelivery) order.actualDelivery = todayISO();
  modalContext.isNew = false;
  closeModal(true);
  saveState(index >= 0 ? 'Pedido actualizado' : 'Pedido registrado');
}

function openQuoteModal(id = '') {
  const quote = state.quotes.find(item => item.id === id) || {
    id: uid('quote'), folio: nextFolio(state.quotes, 'COT'), customerId: '', customer: '', phone: '',
    date: todayISO(), validUntil: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    status: 'borrador', discount: 0, taxPercent: 0, deliveryCharge: 0, deliveryCost: 0,
    notes: '', items: [{}], payments: []
  };
  openModal(
    id ? `Editar cotización ${quote.folio}` : 'Nueva cotización',
    `<form id="quoteForm" class="modal-form">
      <input type="hidden" name="id" value="${quote.id}">
      <input type="hidden" name="folio" value="${esc(quote.folio)}">
      <div class="form-section"><div class="modal-form">
        <label>Cliente registrado<select name="customerId" id="quoteCustomerSelect">${customerOptions(quote.customerId)}</select></label>
        <label>Nombre del cliente<input name="customer" required value="${esc(quote.customer || entityName(state.customers, quote.customerId, ''))}"></label>
        <label>Teléfono<input name="phone" value="${esc(quote.phone || '')}"></label>
        <label>Fecha<input name="date" type="date" value="${quote.date}" required></label>
        <label>Vigencia<input name="validUntil" type="date" value="${quote.validUntil}" required></label>
        <label>Estado<select name="status">${['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'convertida'].map(status => `<option value="${status}" ${quote.status === status ? 'selected' : ''}>${statusName(status)}</option>`).join('')}</select></label>
      </div></div>
      <div class="form-section"><div class="section-title"><div><h3>Conceptos</h3></div><button type="button" class="button secondary small" id="addDocumentLine">+ Concepto</button></div><div class="dynamic-list" id="documentLines">${(quote.items?.length ? quote.items : [{}]).map(documentLineRow).join('')}</div></div>
      <div class="form-section"><div class="modal-form">
        <label>Descuento $<input name="discount" class="doc-total-input" type="number" value="${num(quote.discount)}"></label>
        <label>IVA %<input name="taxPercent" class="doc-total-input" type="number" value="${num(quote.taxPercent)}"></label>
        <label>Cobro de envío / instalación<input name="deliveryCharge" class="doc-total-input" type="number" value="${num(quote.deliveryCharge)}"></label>
        <input name="deliveryCost" type="hidden" value="0">
        <label class="full">Condiciones y notas<textarea name="notes" rows="4">${esc(quote.notes || '')}</textarea></label>
      </div></div>
      <div class="summary-box">
        <div class="summary-row"><span>Subtotal</span><strong id="docSubtotal">$0.00</strong></div>
        <div class="summary-row total"><span>Total</span><strong id="docTotal">$0.00</strong></div>
        <div class="summary-row"><span>Costo estimado</span><strong id="docCost">$0.00</strong></div>
        <div class="summary-row"><span>Utilidad estimada sin IVA</span><strong id="docProfit">$0.00</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="quoteForm">Guardar cotización</button>`,
    true,
    { type: 'quote', id: quote.id, isNew: !id }
  );
  updateDocumentPreview();
}

function saveQuote(form) {
  const data = Object.fromEntries(new FormData(form));
  const customer = state.customers.find(item => item.id === data.customerId);
  const quote = {
    id: data.id,
    folio: data.folio,
    customerId: data.customerId,
    customer: data.customer.trim() || customer?.name || '',
    phone: data.phone.trim() || customer?.phone || '',
    date: data.date,
    validUntil: data.validUntil,
    status: data.status,
    discount: num(data.discount),
    taxPercent: num(data.taxPercent),
    deliveryCharge: num(data.deliveryCharge),
    deliveryCost: 0,
    notes: data.notes.trim(),
    items: documentItemsFromForm(form),
    payments: [],
    updatedAt: new Date().toISOString()
  };
  const index = state.quotes.findIndex(item => item.id === quote.id);
  if (index >= 0) state.quotes[index] = { ...state.quotes[index], ...quote };
  else state.quotes.push({ ...quote, createdAt: new Date().toISOString() });
  closeModal(true);
  saveState(index >= 0 ? 'Cotización actualizada' : 'Cotización creada');
}
