(function () {
  let initialized = false;

  function normalize() {
    state.supplierCatalog = Array.isArray(state.supplierCatalog) ? state.supplierCatalog : [];
    state.supplierPriceHistory = Array.isArray(state.supplierPriceHistory) ? state.supplierPriceHistory : [];
    state.products = (state.products || []).map(product => ({
      autoPrice: false,
      targetMarginPercent: 40,
      priceRounding: 1,
      ...product
    }));
  }

  function unitCostOf(item) {
    const quantity = Math.max(0.000001, num(item.presentationQty) || 1);
    return (num(item.packagePrice) + num(item.shippingCost) + num(item.otherCost)) / quantity;
  }

  function packageTotalOf(item) {
    return num(item.packagePrice) + num(item.shippingCost) + num(item.otherCost);
  }

  function recommendedProductPrice(product) {
    const baseCost = productBreakdown({ ...product, commissionPercent: 0 }, 0).total;
    const margin = Math.max(0, Math.min(90, num(product.targetMarginPercent))) / 100;
    const commission = Math.max(0, Math.min(60, num(product.commissionPercent))) / 100;
    const denominator = Math.max(0.05, 1 - margin - commission);
    const rounding = Math.max(0.01, num(product.priceRounding) || 1);
    return Math.ceil((baseCost / denominator) / rounding) * rounding;
  }

  function refreshAutomaticProductPrices() {
    let changes = 0;
    state.products.forEach(product => {
      if (!product.autoPrice) return;
      const next = recommendedProductPrice(product);
      if (Math.abs(num(product.salePrice) - next) <= 0.001) return;
      product.salePrice = next;
      product.updatedAt = new Date().toISOString();
      changes += 1;
    });
    return changes;
  }

  function materialCatalogOptions(selected = '') {
    return `<option value="">Sin vincular</option><option value="__new__" ${selected === '__new__' ? 'selected' : ''}>+ Crear material automáticamente</option>${state.materials.map(material => `<option value="${material.id}" ${selected === material.id ? 'selected' : ''}>${esc(material.name)} · ${money(material.unitCost)}</option>`).join('')}`;
  }

  function catalogRow(item = {}) {
    const row = {
      id: item.id || uid('supplier-item'), name: '', sku: '', category: '', unit: 'pieza',
      presentationQty: 1, packagePrice: 0, shippingCost: 0, otherCost: 0,
      materialId: '', preferred: false, notes: '', ...item
    };
    return `<article class="supplier-catalog-row ${row.preferred ? 'preferred' : ''}" data-catalog-id="${row.id}">
      <div class="supplier-catalog-grid">
        <label class="wide">Producto o material<input class="catalog-name" value="${esc(row.name)}" placeholder="Ej. Taza blanca 11 oz"></label>
        <label>SKU / clave<input class="catalog-sku" value="${esc(row.sku)}"></label>
        <label>Categoría<input class="catalog-category" value="${esc(row.category)}" placeholder="Sublimación, papel..."></label>
        <label>Unidad<input class="catalog-unit" value="${esc(row.unit || 'pieza')}" placeholder="pieza, metro, hoja"></label>
        <label>Cantidad por paquete<input class="catalog-presentation" type="number" min="0.001" step="0.001" value="${num(row.presentationQty) || 1}"></label>
        <label>Precio del paquete<input class="catalog-package-price" type="number" min="0" step="0.01" value="${num(row.packagePrice)}"></label>
        <label>Envío prorrateado<input class="catalog-shipping" type="number" min="0" step="0.01" value="${num(row.shippingCost)}"></label>
        <label>Otros cargos<input class="catalog-other" type="number" min="0" step="0.01" value="${num(row.otherCost)}"></label>
        <label class="wide">Vincular con inventario<select class="catalog-material">${materialCatalogOptions(row.materialId)}</select></label>
        <label class="catalog-preferred-check"><input class="catalog-preferred" type="checkbox" ${row.preferred ? 'checked' : ''}> Usar como costo principal</label>
        <label class="full">Notas<input class="catalog-notes" value="${esc(row.notes)}" placeholder="Marca, color, tiempo de entrega, mayoreo..."></label>
      </div>
      <div class="catalog-result">
        <div><span>Total de compra</span><strong class="catalog-package-total">${money(packageTotalOf(row))}</strong></div>
        <div><span>Costo final por ${esc(row.unit || 'unidad')}</span><strong class="catalog-unit-cost">${money(unitCostOf(row))}</strong></div>
        <div><span>Última actualización</span><strong>${row.updatedAt ? formatDate(String(row.updatedAt).slice(0, 10)) : 'Nueva'}</strong></div>
      </div>
      <div class="catalog-row-actions"><button class="button danger small" type="button" data-remove-catalog-row>Eliminar artículo</button></div>
    </article>`;
  }

  function catalogItemFromRow(row, supplierId) {
    return {
      id: row.dataset.catalogId || uid('supplier-item'),
      supplierId,
      name: row.querySelector('.catalog-name')?.value.trim() || '',
      sku: row.querySelector('.catalog-sku')?.value.trim() || '',
      category: row.querySelector('.catalog-category')?.value.trim() || '',
      unit: row.querySelector('.catalog-unit')?.value.trim() || 'pieza',
      presentationQty: Math.max(0.001, num(row.querySelector('.catalog-presentation')?.value) || 1),
      packagePrice: num(row.querySelector('.catalog-package-price')?.value),
      shippingCost: num(row.querySelector('.catalog-shipping')?.value),
      otherCost: num(row.querySelector('.catalog-other')?.value),
      materialId: row.querySelector('.catalog-material')?.value || '',
      preferred: Boolean(row.querySelector('.catalog-preferred')?.checked),
      notes: row.querySelector('.catalog-notes')?.value.trim() || '',
      active: true,
      updatedAt: new Date().toISOString()
    };
  }

  function updateCatalogRowPreview(row) {
    if (!row) return;
    const item = catalogItemFromRow(row, '');
    row.querySelector('.catalog-package-total').textContent = money(packageTotalOf(item));
    row.querySelector('.catalog-unit-cost').textContent = money(unitCostOf(item));
    row.classList.toggle('preferred', item.preferred);
  }

  function fillRowFromMaterial(row, materialId) {
    const material = state.materials.find(item => item.id === materialId);
    if (!material || !row) return;
    const mappings = [
      ['.catalog-name', material.name], ['.catalog-sku', material.sku],
      ['.catalog-category', material.category], ['.catalog-unit', material.unit || 'pieza']
    ];
    mappings.forEach(([selector, value]) => {
      const input = row.querySelector(selector);
      if (input && !input.value.trim()) input.value = value || '';
    });
  }

  function createMaterialFromCatalog(item, supplierId) {
    const material = {
      id: uid('material'), name: item.name, sku: item.sku, category: item.category,
      unit: item.unit || 'pieza', stock: 0, minStock: 0, unitCost: unitCostOf(item),
      supplierId, lastValuationPurchaseId: '',
      notes: `Creado desde el catálogo de ${entityName(state.suppliers, supplierId)}. ${item.notes || ''}`.trim(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    state.materials.push(material);
    return material.id;
  }

  function recordPriceChange(oldItem, newItem) {
    const oldCost = oldItem ? unitCostOf(oldItem) : null;
    const newCost = unitCostOf(newItem);
    if (oldCost !== null && Math.abs(oldCost - newCost) < 0.001) return;
    state.supplierPriceHistory.unshift({
      id: uid('price'), supplierItemId: newItem.id, supplierId: newItem.supplierId,
      materialId: newItem.materialId || '', oldUnitCost: oldCost, newUnitCost: newCost,
      packagePrice: num(newItem.packagePrice), shippingCost: num(newItem.shippingCost),
      otherCost: num(newItem.otherCost), changedAt: new Date().toISOString()
    });
    state.supplierPriceHistory = state.supplierPriceHistory.slice(0, 2500);
  }

  function applyPreferredCatalogItem(item) {
    if (!item?.materialId) return false;
    const material = state.materials.find(row => row.id === item.materialId);
    if (!material) return false;
    state.supplierCatalog.forEach(row => {
      if (row.materialId === item.materialId) row.preferred = row.id === item.id;
    });
    item.preferred = true;
    material.unitCost = unitCostOf(item);
    material.supplierId = item.supplierId;
    material.lastValuationPurchaseId = '';
    material.updatedAt = new Date().toISOString();
    refreshAutomaticProductPrices();
    return true;
  }

  function openSupplierModal(id = '') {
    normalize();
    const existing = state.suppliers.find(item => item.id === id);
    const supplier = existing || { id: uid('supplier'), name: '', contact: '', phone: '', email: '', address: '', notes: '' };
    const items = state.supplierCatalog.filter(item => item.supplierId === supplier.id && item.active !== false);
    openModal(
      id ? 'Editar proveedor y catálogo' : 'Nuevo proveedor y catálogo',
      `<form id="supplierForm" class="modal-form">
        <input type="hidden" name="id" value="${supplier.id}">
        <div class="form-section"><div class="section-title"><div><h3>Datos del proveedor</h3><p>Contacto y condiciones generales.</p></div></div><div class="modal-form">
          <label>Proveedor<input name="name" required value="${esc(supplier.name || '')}"></label>
          <label>Persona de contacto<input name="contact" value="${esc(supplier.contact || '')}"></label>
          <label>Teléfono<input name="phone" value="${esc(supplier.phone || '')}"></label>
          <label>Correo<input name="email" type="email" value="${esc(supplier.email || '')}"></label>
          <label class="full">Dirección<input name="address" value="${esc(supplier.address || '')}"></label>
          <label class="full">Notas y condiciones<textarea name="notes" rows="3">${esc(supplier.notes || '')}</textarea></label>
        </div></div>
        <div class="form-section"><div class="catalog-toolbar"><div><h3>Productos y precios del proveedor</h3><p>El costo unitario incluye precio, envío y otros cargos dividido entre las unidades del paquete.</p></div><button class="button secondary small" id="addSupplierCatalogRow" type="button">+ Agregar artículo</button></div>
          <div class="supplier-catalog-list" id="supplierCatalogRows">${items.length ? items.map(catalogRow).join('') : catalogRow()}</div>
        </div>
      </form>`,
      `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="supplierForm">Guardar proveedor y precios</button>`,
      true
    );
  }

  function saveSupplier(form) {
    normalize();
    const data = Object.fromEntries(new FormData(form));
    const supplierId = data.id || uid('supplier');
    const rows = [...form.querySelectorAll('.supplier-catalog-row')]
      .map(row => catalogItemFromRow(row, supplierId))
      .filter(item => item.name);
    const supplier = {
      id: supplierId, name: String(data.name || '').trim(), contact: String(data.contact || '').trim(),
      phone: String(data.phone || '').trim(), email: String(data.email || '').trim(),
      address: String(data.address || '').trim(), products: rows.map(item => item.name).join(', '),
      notes: String(data.notes || '').trim(), updatedAt: new Date().toISOString()
    };
    if (!supplier.name) return showToast('Escribe el nombre del proveedor', 'error');

    const supplierIndex = state.suppliers.findIndex(item => item.id === supplierId);
    if (supplierIndex >= 0) state.suppliers[supplierIndex] = { ...state.suppliers[supplierIndex], ...supplier };
    else state.suppliers.push({ ...supplier, createdAt: new Date().toISOString() });

    const previousItems = state.supplierCatalog.filter(item => item.supplierId === supplierId);
    rows.forEach(item => {
      if (item.materialId === '__new__') item.materialId = createMaterialFromCatalog(item, supplierId);
      recordPriceChange(previousItems.find(old => old.id === item.id), item);
    });
    const rowIds = new Set(rows.map(item => item.id));
    state.supplierCatalog = state.supplierCatalog.filter(item => item.supplierId !== supplierId || rowIds.has(item.id));
    rows.forEach(item => {
      const index = state.supplierCatalog.findIndex(old => old.id === item.id);
      const prepared = { ...item, unitCost: unitCostOf(item), createdAt: index >= 0 ? state.supplierCatalog[index].createdAt : new Date().toISOString() };
      if (index >= 0) state.supplierCatalog[index] = { ...state.supplierCatalog[index], ...prepared };
      else state.supplierCatalog.push(prepared);
    });
    rows.filter(item => item.preferred && item.materialId).forEach(applyPreferredCatalogItem);
    const automaticUpdates = refreshAutomaticProductPrices();
    closeModal(true);
    saveState(`${supplierIndex >= 0 ? 'Proveedor actualizado' : 'Proveedor agregado'}${automaticUpdates ? ` · ${automaticUpdates} precio${automaticUpdates === 1 ? '' : 's'} recalculado${automaticUpdates === 1 ? '' : 's'}` : ''}`);
  }

  function supplierCatalogMarkup(supplierId) {
    const items = state.supplierCatalog.filter(item => item.supplierId === supplierId && item.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) return '<p>Sin productos con precio.</p>';
    return `<div class="comparison-list">${items.map(item => `<div class="comparison-row ${item.preferred ? 'cheapest' : ''}"><div><strong>${esc(item.name)}</strong><small>${num(item.presentationQty)} ${esc(item.unit)} por paquete · ${esc(item.sku || 'Sin clave')}</small></div><div><strong>${money(item.packagePrice)}</strong><small>paquete</small></div><div><strong>${money(unitCostOf(item))}</strong><small>por ${esc(item.unit)}</small></div><div>${item.preferred ? '<span class="comparison-badge">Costo principal</span>' : item.materialId ? `<button class="button secondary small" data-use-catalog-price="${item.id}">Usar costo</button>` : ''}</div></div>`).join('')}</div>`;
  }

  function supplierHistoryMarkup(supplierId) {
    const itemIds = new Set(state.supplierCatalog.filter(item => item.supplierId === supplierId).map(item => item.id));
    const history = state.supplierPriceHistory.filter(row => itemIds.has(row.supplierItemId)).slice(0, 100);
    if (!history.length) return '<p>Sin cambios de precio registrados.</p>';
    return `<div class="price-history">${history.map(row => {
      const item = state.supplierCatalog.find(entry => entry.id === row.supplierItemId);
      const delta = row.oldUnitCost === null ? 0 : num(row.newUnitCost) - num(row.oldUnitCost);
      return `<div class="price-history-row"><div><strong>${esc(item?.name || 'Artículo')}</strong><small>${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.changedAt))}</small></div><span>${row.oldUnitCost === null ? 'Nuevo' : money(row.oldUnitCost)}</span><strong class="${delta > 0 ? 'money-negative' : delta < 0 ? 'money-positive' : ''}">${money(row.newUnitCost)}</strong></div>`;
    }).join('')}</div>`;
  }

  function openSupplierHistory(id) {
    normalize();
    const supplier = state.suppliers.find(item => item.id === id);
    if (!supplier) return;
    const purchases = state.purchases.filter(purchase => purchase.supplierId === id);
    const materials = state.materials.filter(material => material.supplierId === id);
    const catalogCount = state.supplierCatalog.filter(item => item.supplierId === id).length;
    openModal(
      supplier.name,
      `<div class="tabs"><button class="tab-button active" data-tab="supplierCatalogTab">Catálogo (${catalogCount})</button><button class="tab-button" data-tab="supplierPurchases">Compras (${purchases.length})</button><button class="tab-button" data-tab="supplierMaterials">Inventario (${materials.length})</button><button class="tab-button" data-tab="supplierPrices">Historial de precios</button><button class="tab-button" data-tab="supplierData">Datos</button></div>
      <div class="tab-pane active" id="supplierCatalogTab">${supplierCatalogMarkup(id)}</div>
      <div class="tab-pane" id="supplierPurchases">${purchases.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Factura</th><th>Total</th><th>Saldo</th></tr></thead><tbody>${purchases.map(purchase => `<tr><td>${formatDate(purchase.date)}</td><td>${esc(purchase.invoice || '—')}</td><td>${money(purchaseTotals(purchase).total)}</td><td>${money(purchaseTotals(purchase).balance)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin compras.</p>'}</div>
      <div class="tab-pane" id="supplierMaterials">${materials.length ? materials.map(material => `<div class="mini-row"><div><strong>${esc(material.name)}</strong><small>${num(material.stock).toFixed(2)} ${esc(material.unit || '')}</small></div><span>${money(material.unitCost)}</span></div>`).join('') : '<p>Sin materiales vinculados.</p>'}</div>
      <div class="tab-pane" id="supplierPrices">${supplierHistoryMarkup(id)}</div>
      <div class="tab-pane" id="supplierData"><p><strong>Contacto:</strong> ${esc(supplier.contact || '—')}</p><p><strong>Teléfono:</strong> ${esc(supplier.phone || '—')}</p><p><strong>Correo:</strong> ${esc(supplier.email || '—')}</p><p><strong>Dirección:</strong> ${esc(supplier.address || '—')}</p><p><strong>Notas:</strong> ${esc(supplier.notes || '—')}</p></div>`,
      `<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" data-edit-supplier="${id}">Editar proveedor</button>`,
      true
    );
  }

  function openComparison() {
    normalize();
    const groups = {};
    state.supplierCatalog.filter(item => item.active !== false && item.name).forEach(item => {
      const key = item.materialId ? `material:${item.materialId}` : `name:${item.name.trim().toLowerCase()}`;
      (groups[key] ||= []).push(item);
    });
    const sortedGroups = Object.values(groups).sort((a, b) => a[0].name.localeCompare(b[0].name));
    const body = sortedGroups.length
      ? `<div class="comparison-list">${sortedGroups.map(items => {
          const sorted = [...items].sort((a, b) => unitCostOf(a) - unitCostOf(b));
          const first = sorted[0];
          const material = first.materialId ? state.materials.find(row => row.id === first.materialId) : null;
          return `<section class="comparison-group"><div class="comparison-heading"><div><h3>${esc(material?.name || first.name)}</h3><small>${sorted.length} proveedor${sorted.length === 1 ? '' : 'es'} · mejor costo ${money(unitCostOf(first))}</small></div>${material ? `<span class="supplier-chip">Costo actual ${money(material.unitCost)}</span>` : ''}</div><div class="comparison-table">${sorted.map((item, index) => `<div class="comparison-row ${index === 0 ? 'cheapest' : ''}"><div><strong>${esc(entityName(state.suppliers, item.supplierId))}</strong><small>${num(item.presentationQty)} ${esc(item.unit)} · paquete ${money(item.packagePrice)} · envío ${money(item.shippingCost)}</small></div><div><strong>${money(unitCostOf(item))}</strong><small>por ${esc(item.unit)}</small></div><div>${index === 0 ? '<span class="comparison-badge">Más económico</span>' : item.preferred ? '<span class="comparison-badge">Actual</span>' : ''}</div><div>${item.materialId ? `<button class="button ${item.preferred ? 'secondary' : 'primary'} small" data-use-catalog-price="${item.id}" ${item.preferred ? 'disabled' : ''}>${item.preferred ? 'En uso' : 'Usar este costo'}</button>` : ''}</div></div>`).join('')}</div></section>`;
        }).join('')}</div>`
      : '<div class="catalog-empty"><h3>No hay precios para comparar</h3><p>Agrega artículos dentro de cada proveedor.</p></div>';
    openModal('Comparador de proveedores', body, '<button class="button secondary" data-close-modal>Cerrar</button>', true);
  }

  function renderSuppliers() {
    normalize();
    const query = ($('#supplierSearch')?.value || '').trim().toLowerCase();
    const suppliers = state.suppliers.filter(supplier => {
      const catalog = state.supplierCatalog.filter(item => item.supplierId === supplier.id).map(item => `${item.name} ${item.sku} ${item.category}`).join(' ');
      return `${supplier.name} ${supplier.phone} ${supplier.email} ${supplier.products} ${catalog}`.toLowerCase().includes(query);
    });
    $('#suppliersEmpty').style.display = state.suppliers.length ? 'none' : 'block';
    $('#suppliersGrid').innerHTML = suppliers.map(supplier => {
      const stats = supplierStats(supplier.id);
      const items = state.supplierCatalog.filter(item => item.supplierId === supplier.id && item.active !== false);
      const cheapest = items.length ? Math.min(...items.map(unitCostOf)) : 0;
      return `<article class="entity-card"><div class="entity-card-header"><div><h3>${esc(supplier.name)}</h3><p>${esc(supplier.contact || '')}</p><p>${esc(supplier.phone || '')}</p></div><div class="action-group"><button class="action-button" data-view-supplier="${supplier.id}" title="Ver catálogo">◉</button><button class="action-button" data-edit-supplier="${supplier.id}" title="Editar">✎</button><button class="action-button" data-delete-supplier="${supplier.id}" title="Eliminar">×</button></div></div><div class="supplier-summary-chips"><span class="supplier-chip">${items.length} artículo${items.length === 1 ? '' : 's'}</span>${cheapest ? `<span class="supplier-chip preferred">Desde ${money(cheapest)}</span>` : ''}</div><p>${esc(items.slice(0, 4).map(item => item.name).join(', ') || supplier.products || 'Sin productos indicados')}</p><p>${esc(supplier.address || '')}</p><div class="entity-stats"><div class="entity-stat"><span>Compras</span><strong>${stats.purchases}</strong></div><div class="entity-stat"><span>Total</span><strong>${money(stats.total)}</strong></div><div class="entity-stat"><span>Se debe</span><strong class="${stats.balance ? 'money-warning' : ''}">${money(stats.balance)}</strong></div></div></article>`;
    }).join('');
  }

  function ensureToolbar() {
    const toolbar = document.querySelector('#suppliers .section-toolbar');
    if (!toolbar || document.querySelector('#compareSuppliersButton')) return;
    document.querySelector('#newSupplierButton')?.insertAdjacentHTML('beforebegin', '<button class="button secondary" id="compareSuppliersButton" type="button">⚖ Comparar precios</button>');
  }

  function cleanupSupplier(supplierId) {
    const itemIds = new Set(state.supplierCatalog.filter(item => item.supplierId === supplierId).map(item => item.id));
    state.supplierCatalog = state.supplierCatalog.filter(item => item.supplierId !== supplierId);
    state.supplierPriceHistory = state.supplierPriceHistory.filter(row => !itemIds.has(row.supplierItemId));
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'addSupplierCatalogRow') document.querySelector('#supplierCatalogRows')?.insertAdjacentHTML('beforeend', catalogRow());
      if (target.dataset.removeCatalogRow !== undefined) {
        const list = target.closest('.supplier-catalog-list');
        target.closest('.supplier-catalog-row')?.remove();
        if (list && !list.children.length) list.insertAdjacentHTML('beforeend', catalogRow());
      }
      if (target.id === 'compareSuppliersButton') openComparison();
      if (target.dataset.useCatalogPrice) {
        const item = state.supplierCatalog.find(row => row.id === target.dataset.useCatalogPrice);
        if (item && applyPreferredCatalogItem(item)) {
          closeModal(true);
          saveState(`Costo de ${entityName(state.materials, item.materialId)} actualizado a ${money(unitCostOf(item))}`);
        }
      }
    });
    document.addEventListener('input', event => {
      const row = event.target.closest('.supplier-catalog-row');
      if (row) updateCatalogRowPreview(row);
    });
    document.addEventListener('change', event => {
      const row = event.target.closest('.supplier-catalog-row');
      if (!row) return;
      if (event.target.classList.contains('catalog-material')) fillRowFromMaterial(row, event.target.value);
      updateCatalogRowPreview(row);
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    normalize();
    bindEvents();
    ensureToolbar();
    refreshAutomaticProductPrices();
  }

  window.MoorePrintSupplierCatalog = {
    init,
    normalize,
    render: renderSuppliers,
    openSupplierModal,
    saveSupplier,
    openSupplierHistory,
    cleanupSupplier,
    unitCostOf,
    recommendedProductPrice,
    refreshAutomaticProductPrices,
    openComparison
  };
})();