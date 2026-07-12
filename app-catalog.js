function openMaterialModal(id = '') {
  const material = state.materials.find(item => item.id === id) || {};
  openModal(
    id ? 'Editar material' : 'Nuevo material',
    `<form id="materialForm" class="modal-form">
      <input type="hidden" name="id" value="${esc(material.id || '')}">
      <label>Nombre<input name="name" required value="${esc(material.name || '')}" placeholder="Ej. Taza blanca 11 oz"></label>
      <label>SKU o clave<input name="sku" value="${esc(material.sku || '')}"></label>
      <label>Categoría<input name="category" value="${esc(material.category || '')}" placeholder="Sublimación, papel, tinta..."></label>
      <label>Unidad<input name="unit" value="${esc(material.unit || 'pieza')}" placeholder="pieza, metro, hoja, litro"></label>
      <label>Existencia inicial<input name="stock" type="number" step="0.001" value="${num(material.stock)}" ${id ? 'readonly title="Usa Ajustar existencia para modificarla"' : ''}></label>
      <label>Existencia mínima<input name="minStock" type="number" step="0.001" value="${num(material.minStock)}"></label>
      <label>Costo unitario<input name="unitCost" type="number" min="0" step="0.01" value="${num(material.unitCost)}"></label>
      <label>Proveedor<select name="supplierId">${supplierOptions(material.supplierId)}</select></label>
      <label class="full">Ubicación / notas<textarea name="notes" rows="3">${esc(material.notes || '')}</textarea></label>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="materialForm">Guardar material</button>`
  );
}

function saveMaterial(form) {
  const data = Object.fromEntries(new FormData(form));
  const existing = state.materials.find(item => item.id === data.id);
  const oldCost = num(existing?.unitCost);
  const material = {
    id: data.id || uid('material'),
    name: data.name.trim(),
    sku: data.sku.trim(),
    category: data.category.trim(),
    unit: data.unit.trim(),
    stock: existing ? num(existing.stock) : num(data.stock),
    minStock: num(data.minStock),
    unitCost: num(data.unitCost),
    supplierId: data.supplierId,
    notes: data.notes.trim(),
    lastValuationPurchaseId: existing?.lastValuationPurchaseId || '',
    updatedAt: new Date().toISOString()
  };
  if (existing && Math.abs(material.unitCost - oldCost) > 0.0001) material.lastValuationPurchaseId = '';
  const index = state.materials.findIndex(item => item.id === material.id);
  if (index >= 0) state.materials[index] = { ...state.materials[index], ...material };
  else {
    state.materials.push({ ...material, createdAt: new Date().toISOString() });
    if (material.stock) addInventoryMovement(material.id, material.stock, 'entrada', 'Existencia inicial');
  }
  closeModal(true);
  saveState(index >= 0 ? 'Material actualizado' : 'Material agregado');
}

function openInventoryAdjustment(materialId = '') {
  openModal(
    'Ajustar existencia',
    `<form id="adjustmentForm" class="modal-form">
      <label class="full">Material<select name="materialId" required>${materialOptions(materialId)}</select></label>
      <label>Fecha<input name="date" type="date" value="${todayISO()}" required></label>
      <label>Movimiento<select name="direction"><option value="add">Entrada / sumar</option><option value="subtract">Salida / restar</option><option value="set">Establecer existencia</option></select></label>
      <label>Cantidad<input name="quantity" type="number" min="0" step="0.001" required></label>
      <label>Motivo<input name="reason" required placeholder="Inventario físico, merma, devolución..."></label>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="adjustmentForm">Aplicar ajuste</button>`
  );
}

function saveAdjustment(form) {
  const data = Object.fromEntries(new FormData(form));
  const material = state.materials.find(item => item.id === data.materialId);
  if (!material) return showToast('Selecciona un material', 'error');
  const before = num(material.stock);
  let delta = num(data.quantity);
  if (data.direction === 'subtract') delta *= -1;
  if (data.direction === 'set') delta = num(data.quantity) - before;
  material.stock = before + delta;
  addInventoryMovement(material.id, delta, 'ajuste', data.reason.trim(), '', data.date);
  closeModal(true);
  saveState('Existencia actualizada');
}

function recipeRow(row = {}) {
  return `<div class="line-row recipe">
    <select class="recipe-material">${materialOptions(row.materialId)}</select>
    <input class="recipe-qty" type="number" min="0" step="0.001" value="${num(row.qty)}" placeholder="Cantidad">
    <span class="recipe-cost">${money(num(row.qty) * num(state.materials.find(item => item.id === row.materialId)?.unitCost))}</span>
    <button type="button" class="action-button remove-row">×</button>
  </div>`;
}

function productFromForm(form) {
  const data = Object.fromEntries(new FormData(form));
  const recipe = $$('.line-row.recipe', form)
    .map(row => ({ materialId: $('.recipe-material', row).value, qty: num($('.recipe-qty', row).value) }))
    .filter(row => row.materialId && row.qty > 0);
  return {
    id: data.id || uid('product'),
    name: String(data.name || '').trim(),
    category: String(data.category || '').trim(),
    salePrice: num(data.salePrice),
    taxPercent: num(data.taxPercent),
    recipe,
    laborCost: num(data.laborCost),
    designCost: num(data.designCost),
    electricityCost: num(data.electricityCost),
    packagingCost: num(data.packagingCost),
    transportCost: num(data.transportCost),
    externalCost: num(data.externalCost),
    extraCost: num(data.extraCost),
    wastePercent: num(data.wastePercent),
    commissionPercent: num(data.commissionPercent),
    productionMinutes: Math.max(0, num(data.productionMinutes)),
    autoPrice: Boolean(form.elements.autoPrice?.checked),
    targetMarginPercent: num(data.targetMarginPercent) || 40,
    priceRounding: num(data.priceRounding) || 1,
    notes: String(data.notes || '').trim(),
    updatedAt: new Date().toISOString()
  };
}

function recommendedProductPrice(product) {
  if (window.MoorePrintSupplierCatalog?.recommendedProductPrice) {
    return window.MoorePrintSupplierCatalog.recommendedProductPrice(product);
  }
  const baseCost = productBreakdown({ ...product, commissionPercent: 0 }, 0).total;
  const margin = Math.max(0, Math.min(90, num(product.targetMarginPercent))) / 100;
  const commission = Math.max(0, Math.min(60, num(product.commissionPercent))) / 100;
  const denominator = Math.max(0.05, 1 - margin - commission);
  const rounding = Math.max(0.01, num(product.priceRounding) || 1);
  return Math.ceil((baseCost / denominator) / rounding) * rounding;
}

function productOverheadMarkup(product) {
  const monthly = window.MoorePrintMonthlyCosts;
  const month = monthly?.pricingMonth?.() || monthKey(todayISO());
  const total = num(monthly?.monthlyTotal?.(month));
  const hourly = num(monthly?.costPerProductiveHour?.(month));
  const assigned = num(monthly?.productMonthlyOverhead?.(product, month));
  return `<div class="form-section overhead-product-box" id="productOverheadSection">
    <div class="section-title"><div><h3>Parte proporcional de costos fijos</h3><p>Se calcula con el mes ${esc(month)} y el tiempo de producción por unidad.</p></div></div>
    <div class="overhead-product-grid">
      <label>Tiempo de producción por unidad (minutos)<input name="productionMinutes" class="product-cost-input" type="number" min="0" step="0.1" value="${num(product.productionMinutes)}" placeholder="Ej. 12"></label>
      <div class="overhead-product-stat"><span>Costos fijos del mes</span><strong id="productMonthlyFixedTotal">${money(total)}</strong></div>
      <div class="overhead-product-stat"><span>Costo fijo por hora</span><strong id="productHourlyFixedCost">${money(hourly)}</strong></div>
      <div class="overhead-product-stat"><span>Costo asignado a esta unidad</span><strong class="overhead-highlight" id="productAssignedOverhead">${money(assigned)}</strong></div>
    </div>
  </div>`;
}

function openProductModal(id = '') {
  const product = state.products.find(item => item.id === id) || {
    salePrice: 0, recipe: [], autoPrice: false, targetMarginPercent: 40,
    priceRounding: 1, productionMinutes: 0
  };
  openModal(
    id ? 'Editar producto y costos' : 'Nuevo producto y costos',
    `<form id="productForm" class="modal-form">
      <input type="hidden" name="id" value="${esc(product.id || '')}">
      <div class="form-section">
        <div class="section-title"><div><h3>Información de venta</h3></div></div>
        <div class="modal-form">
          <label class="full">Producto<input name="name" required value="${esc(product.name || '')}"></label>
          <label>Categoría<input name="category" value="${esc(product.category || '')}"></label>
          <label>Precio de venta<input name="salePrice" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.salePrice)}" ${product.autoPrice ? 'readonly' : ''}></label>
          <label>IVA informativo %<input name="taxPercent" type="number" min="0" step="0.01" value="${num(product.taxPercent)}"></label>
        </div>
        <div class="auto-price-panel" id="autoPricePanel">
          <label class="catalog-preferred-check"><input name="autoPrice" id="autoPriceCheckbox" type="checkbox" ${product.autoPrice ? 'checked' : ''}> Calcular precio automáticamente cuando cambien los costos</label>
          <div class="auto-price-grid">
            <label>Margen deseado %<input name="targetMarginPercent" class="product-cost-input" type="number" min="1" max="90" step="0.1" value="${num(product.targetMarginPercent) || 40}"></label>
            <label>Redondear hacia arriba a múltiplos de<input name="priceRounding" class="product-cost-input" type="number" min="0.01" step="0.01" value="${num(product.priceRounding) || 1}"></label>
            <div class="auto-price-result"><span>Precio recomendado</span><strong id="recommendedProductPrice">${money(product.salePrice)}</strong></div>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="section-title"><div><h3>Receta de materiales</h3><p>Se descontarán automáticamente al poner un pedido en proceso.</p></div><button type="button" class="button secondary small" id="addRecipeRow">+ Material</button></div>
        <div class="dynamic-list" id="recipeRows">${(product.recipe || []).map(recipeRow).join('')}</div>
      </div>
      <div class="form-section">
        <div class="section-title"><div><h3>Otros costos por unidad</h3></div></div>
        <div class="modal-form">
          <label>Mano de obra<input name="laborCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.laborCost)}"></label>
          <label>Diseño<input name="designCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.designCost)}"></label>
          <label>Electricidad / gas<input name="electricityCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.electricityCost)}"></label>
          <label>Empaque<input name="packagingCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.packagingCost)}"></label>
          <label>Transporte<input name="transportCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.transportCost)}"></label>
          <label>Trabajo externo<input name="externalCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.externalCost)}"></label>
          <label>Otros costos<input name="extraCost" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.extraCost)}"></label>
          <label>Desperdicio %<input name="wastePercent" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.wastePercent)}"></label>
          <label>Comisión de cobro %<input name="commissionPercent" class="product-cost-input" type="number" min="0" step="0.01" value="${num(product.commissionPercent)}"></label>
          <label class="full">Notas<textarea name="notes" rows="3">${esc(product.notes || '')}</textarea></label>
        </div>
      </div>
      ${productOverheadMarkup(product)}
      <div class="summary-box">
        <div class="summary-row"><span>Materiales</span><strong id="productMaterialPreview">$0.00</strong></div>
        <div class="summary-row"><span>Costo total</span><strong id="productCostPreview">$0.00</strong></div>
        <div class="summary-row total"><span>Ganancia</span><strong id="productProfitPreview">$0.00</strong></div>
      </div>
    </form>`,
    `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="productForm">Guardar producto</button>`,
    true
  );
  updateProductCostPreview();
}

function updateProductCostPreview() {
  const form = $('#productForm');
  if (!form) return;
  $$('.line-row.recipe', form).forEach(row => {
    const material = state.materials.find(item => item.id === $('.recipe-material', row).value);
    $('.recipe-cost', row).textContent = money(num($('.recipe-qty', row).value) * num(material?.unitCost));
  });
  const product = productFromForm(form);
  const recommended = recommendedProductPrice(product);
  $('#recommendedProductPrice').textContent = money(recommended);
  form.elements.salePrice.readOnly = product.autoPrice;
  if (product.autoPrice) {
    form.elements.salePrice.value = recommended.toFixed(2);
    product.salePrice = recommended;
  }
  const preview = productBreakdown(product, product.salePrice);
  $('#productMaterialPreview').textContent = money(preview.material);
  $('#productCostPreview').textContent = money(preview.total);
  $('#productProfitPreview').textContent = money(preview.profit);
  $('#productProfitPreview').className = preview.profit < 0 ? 'money-negative' : 'money-positive';
  const monthly = window.MoorePrintMonthlyCosts;
  if ($('#productAssignedOverhead')) $('#productAssignedOverhead').textContent = money(preview.overhead);
  if ($('#productMonthlyFixedTotal')) $('#productMonthlyFixedTotal').textContent = money(monthly?.monthlyTotal?.() || 0);
  if ($('#productHourlyFixedCost')) $('#productHourlyFixedCost').textContent = money(monthly?.costPerProductiveHour?.() || 0);
}

function saveProduct(form) {
  const product = productFromForm(form);
  if (!product.name) return showToast('Escribe el nombre del producto', 'error');
  if (product.autoPrice) product.salePrice = recommendedProductPrice(product);
  const index = state.products.findIndex(item => item.id === product.id);
  if (index >= 0) state.products[index] = { ...state.products[index], ...product };
  else state.products.push({ ...product, createdAt: new Date().toISOString() });
  closeModal(true);
  saveState(index >= 0 ? 'Producto, costos y precio actualizados' : 'Producto, costos y precio agregados');
}
