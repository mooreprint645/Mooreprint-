function previewDocument(type, id) {
  const record = type === 'order' ? state.orders.find(item => item.id === id) : state.quotes.find(item => item.id === id); if (!record) return;
  const totals = documentTotals(record); const business = state.business; const isOrder = type === 'order';
  openModal(`${isOrder ? 'Nota' : 'Cotización'} ${record.folio}`, `<div class="note-preview"><div class="note-business"><h2>${esc(business.name)}</h2><p>${esc(business.address || '')}</p><p>${esc([business.city,business.phone,business.email].filter(Boolean).join(' · '))}</p>${business.rfc ? `<p>RFC: ${esc(business.rfc)}</p>` : ''}</div><div class="note-meta"><div><strong>Folio:</strong> ${esc(record.folio)}</div><div><strong>Fecha:</strong> ${formatDate(isOrder ? record.orderDate : record.date)}</div><div><strong>Cliente:</strong> ${esc(record.customer || entityName(state.customers, record.customerId))}</div><div><strong>${isOrder ? 'Entrega' : 'Vigencia'}:</strong> ${formatDate(isOrder ? record.dueDate : record.validUntil)}</div>${record.phone ? `<div><strong>Teléfono:</strong> ${esc(record.phone)}</div>` : ''}</div><table><thead><tr><th>Cant.</th><th>Descripción</th><th>Precio</th><th>Importe</th></tr></thead><tbody>${(record.items || []).map(item => `<tr><td>${num(item.qty)}</td><td>${esc(item.name)}</td><td>${money(item.price)}</td><td>${money(num(item.qty) * num(item.price))}</td></tr>`).join('')}</tbody></table><div class="summary-box" style="margin-top:16px"><div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>${totals.discount ? `<div class="summary-row"><span>Descuento</span><strong>-${money(totals.discount)}</strong></div>` : ''}${totals.tax ? `<div class="summary-row"><span>IVA</span><strong>${money(totals.tax)}</strong></div>` : ''}${num(record.deliveryCharge) ? `<div class="summary-row"><span>Envío / instalación</span><strong>${money(record.deliveryCharge)}</strong></div>` : ''}<div class="summary-row total"><span>Total</span><strong>${money(totals.total)}</strong></div>${isOrder ? `<div class="summary-row"><span>Pagado</span><strong>${money(totals.paid)}</strong></div><div class="summary-row"><span>Restante</span><strong>${money(totals.balance)}</strong></div>` : ''}</div>${record.notes ? `<p style="margin-top:18px"><strong>Notas:</strong> ${esc(record.notes)}</p>` : ''}<p style="text-align:center;margin-top:24px">${esc(business.note || '')}</p></div>${isOrder && (record.payments || []).length ? `<div class="panel" style="box-shadow:none;margin-top:15px"><h3>Historial de pagos</h3>${record.payments.map(payment => `<div class="mini-row"><div><strong>${formatDate(payment.date)} · ${methodName(payment.method)}</strong><small>${esc(payment.reference || '')}</small></div><span>${money(payment.amount)}</span></div>`).join('')}</div>` : ''}`, `<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" id="printDocumentButton">Imprimir</button>`, true);
}

function confirmDelete(type, id, label) {
  openModal(`Eliminar ${label}`, '<p>Esta acción no se puede deshacer. Los movimientos relacionados se ajustarán cuando corresponda.</p>', `<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" data-confirm-delete="${type}" data-id="${id}">Eliminar</button>`);
}
function performDelete(type, id) {
  if (type === 'customer') {
    if (state.orders.some(item => item.customerId === id) || state.quotes.some(item => item.customerId === id)) return showToast('No se puede borrar: el cliente tiene pedidos o cotizaciones', 'error');
    state.customers = state.customers.filter(item => item.id !== id);
  }
  if (type === 'supplier') {
    if (state.materials.some(item => item.supplierId === id) || state.purchases.some(item => item.supplierId === id)) return showToast('No se puede borrar: el proveedor está vinculado a materiales o compras', 'error');
    state.suppliers = state.suppliers.filter(item => item.id !== id);
  }
  if (type === 'material') {
    if (state.products.some(product => (product.recipe || []).some(row => row.materialId === id)) || state.purchases.some(purchase => (purchase.items || []).some(row => row.materialId === id))) return showToast('No se puede borrar: el material se utiliza en recetas o compras', 'error');
    state.materials = state.materials.filter(item => item.id !== id);
  }
  if (type === 'product') state.products = state.products.filter(item => item.id !== id);
  if (type === 'quote') state.quotes = state.quotes.filter(item => item.id !== id);
  if (type === 'order') {
    const order = state.orders.find(item => item.id === id);
    if (order?.inventoryApplied) syncOrderInventory(order, { ...order, status: 'cancelado', inventoryApplied: false, inventorySnapshot: [] });
    state.orders = state.orders.filter(item => item.id !== id); if (window.FileDB) FileDB.removeOrderFiles(id).catch(() => {});
  }
  if (type === 'purchase') {
    const purchase = state.purchases.find(item => item.id === id);
    if (purchase?.inventoryApplied) {
      const possible = (purchase.items || []).every(row => num(state.materials.find(item => item.id === row.materialId)?.stock) >= num(row.qty));
      if (!possible && !window.confirm('Al borrar esta compra alguna existencia quedará negativa. ¿Continuar?')) return;
      (purchase.items || []).forEach(row => { const material = state.materials.find(item => item.id === row.materialId); if (material) material.stock = num(material.stock) - num(row.qty); addInventoryMovement(row.materialId, -num(row.qty), 'ajuste', `Eliminación de compra ${purchase.invoice || purchase.id}`, purchase.id); });
    }
    state.purchases = state.purchases.filter(item => item.id !== id);
  }
  if (type === 'expense') state.expenses = state.expenses.filter(item => item.id !== id);
  if (type === 'recurring') state.recurringExpenses = state.recurringExpenses.filter(item => item.id !== id);
  closeModal(true); saveState('Registro eliminado');
}

function loadExamples() {
  let supplier = state.suppliers.find(item => item.name === 'Proveedor de sublimación');
  if (!supplier) { supplier = { id: uid('supplier'), name: 'Proveedor de sublimación', contact: '', phone: '', email: '', address: '', products: 'Tazas, papel, tinta y cinta térmica', notes: '', createdAt: new Date().toISOString() }; state.suppliers.push(supplier); }
  const materialExamples = [
    ['Taza blanca 11 oz','Sublimación','pieza',24,10,38], ['Papel de sublimación A4','Papel','hoja',100,20,2.5], ['Tinta de sublimación','Tinta','ml',400,80,.65], ['Cinta térmica','Consumibles','cm',5000,500,.02], ['Caja para taza','Empaque','pieza',30,10,8], ['Playera blanca','Textil','pieza',20,5,85], ['Vinil textil','Vinil','cm²',10000,1500,.018], ['Lona 13 oz','Gran formato','m²',20,5,62]
  ];
  materialExamples.forEach(([name,category,unit,stock,minStock,unitCost]) => { if (!state.materials.some(item => item.name === name)) state.materials.push({ id: uid('material'), name, sku: '', category, unit, stock, minStock, unitCost, supplierId: supplier.id, notes: '', createdAt: new Date().toISOString() }); });
  const materialId = name => state.materials.find(item => item.name === name)?.id;
  const productExamples = [
    { name: 'Taza sublimada', category: 'Sublimación', salePrice: 120, recipe: [{ materialId: materialId('Taza blanca 11 oz'), qty: 1 },{ materialId: materialId('Papel de sublimación A4'), qty: .5 },{ materialId: materialId('Tinta de sublimación'), qty: 3 },{ materialId: materialId('Cinta térmica'), qty: 25 },{ materialId: materialId('Caja para taza'), qty: 1 }], laborCost: 18, designCost: 10, electricityCost: 4, packagingCost: 0, wastePercent: 3 },
    { name: 'Playera con vinil textil', category: 'Textil', salePrice: 260, recipe: [{ materialId: materialId('Playera blanca'), qty: 1 },{ materialId: materialId('Vinil textil'), qty: 600 }], laborCost: 35, designCost: 15, electricityCost: 5, wastePercent: 5 },
    { name: 'Lona impresa por m²', category: 'Gran formato', salePrice: 180, recipe: [{ materialId: materialId('Lona 13 oz'), qty: 1 }], laborCost: 20, designCost: 12, externalCost: 0, wastePercent: 5 }
  ];
  productExamples.forEach(example => { if (!state.products.some(item => item.name === example.name)) state.products.push({ id: uid('product'), designCost: 0, electricityCost: 0, packagingCost: 0, transportCost: 0, externalCost: 0, extraCost: 0, commissionPercent: 0, wastePercent: 0, notes: '', ...example, createdAt: new Date().toISOString() }); });
  saveState('Ejemplos de materiales, proveedor y productos agregados');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBackup() { downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `mooreprint-respaldo-${todayISO()}.json`); showToast('Respaldo de datos descargado'); }
function importBackup(file) {
  const reader = new FileReader(); reader.onload = () => { try { const imported = normalizeState(JSON.parse(reader.result)); state = imported; saveState('Respaldo importado correctamente'); } catch (error) { showToast('El archivo no es un respaldo válido', 'error'); } }; reader.readAsText(file);
}
function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function exportReportCsv() {
  const from = $('#reportFrom').value; const to = $('#reportTo').value; const rows = [['Tipo','Fecha','Folio/Categoría','Cliente/Descripción','Venta','Costo','Gasto','Pagado','Saldo','Resultado']];
  state.orders.filter(order => order.status !== 'cancelado' && inRange(order.orderDate, from, to)).forEach(order => { const totals = documentTotals(order); rows.push(['Pedido',order.orderDate,order.folio,order.customer || entityName(state.customers,order.customerId),totals.total,totals.costs,0,totals.paid,totals.balance,totals.profit]); });
  state.expenses.filter(expense => inRange(expense.date, from, to)).forEach(expense => { const totals = expenseTotals(expense); rows.push(['Gasto',expense.date,categoryName(expense.category),expense.description,0,0,totals.total,totals.paid,totals.balance,-totals.total]); });
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n'); downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `reporte-mooreprint-${from}-${to}.csv`); showToast('Reporte CSV descargado');
}
function exportAllCsv() {
  const rows = [['SECCIÓN','ID/FOLIO','FECHA','NOMBRE/DESCRIPCIÓN','IMPORTE','SALDO','DETALLE']];
  state.customers.forEach(item => rows.push(['Cliente',item.id,'',item.name,customerStats(item.id).sales,customerStats(item.id).balance,item.phone]));
  state.suppliers.forEach(item => rows.push(['Proveedor',item.id,'',item.name,supplierStats(item.id).total,supplierStats(item.id).balance,item.phone]));
  state.materials.forEach(item => rows.push(['Material',item.id,'',item.name,num(item.stock)*num(item.unitCost),item.stock,`${item.unit} · ${money(item.unitCost)}`]));
  state.products.forEach(item => rows.push(['Producto',item.id,'',item.name,item.salePrice,productBreakdown(item).profit,`Costo ${money(productBreakdown(item).total)}`]));
  state.orders.forEach(item => rows.push(['Pedido',item.folio,item.orderDate,item.customer || entityName(state.customers,item.customerId),documentTotals(item).total,documentTotals(item).balance,item.status]));
  state.quotes.forEach(item => rows.push(['Cotización',item.folio,item.date,item.customer || entityName(state.customers,item.customerId),documentTotals(item).total,0,item.status]));
  state.purchases.forEach(item => rows.push(['Compra',item.invoice || item.id,item.date,entityName(state.suppliers,item.supplierId),purchaseTotals(item).total,purchaseTotals(item).balance,'']));
  state.expenses.forEach(item => rows.push(['Gasto',item.id,item.date,item.description,item.amount,expenseTotals(item).balance,categoryName(item.category)]));
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n'); downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `mooreprint-todos-los-datos-${todayISO()}.csv`); showToast('Datos generales exportados');
}

function fillBusinessForm() {
  const form = $('#businessForm'); if (!form) return;
  ['name','phone','email','address','city','rfc','openingCash','monthlyHours','note'].forEach(key => { form.elements[key].value = state.business[key] ?? ''; });
}
