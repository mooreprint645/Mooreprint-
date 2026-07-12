(function () {
  if (window.MoorePrintPurchasePackagesV2) return;

  const STYLE_ID = 'purchase-package-styles-v2';
  const VERSION = '2.1';

  function n(value) {
    if (typeof num === 'function') return num(value);
    return Number.parseFloat(value) || 0;
  }

  function cash(value) {
    if (typeof money === 'function') return money(value);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n(value));
  }

  function safe(value) {
    if (typeof esc === 'function') return esc(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function quantity(value) {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(n(value));
  }

  function readableUnit(...values) {
    for (const value of values) {
      const text = String(value ?? '').trim();
      if (!text) continue;
      if (/^[-+]?\d+(?:[.,]\d+)?$/.test(text)) continue;
      return text;
    }
    return 'pieza';
  }

  function normalizeUnits({ persist = true } = {}) {
    if (typeof state === 'undefined' || !state) return 0;
    let changes = 0;
    const materials = Array.isArray(state.materials) ? state.materials : [];
    const catalog = Array.isArray(state.supplierCatalog) ? state.supplierCatalog : [];

    materials.forEach(material => {
      const unit = readableUnit(material.unit, 'pieza');
      if (material.unit === unit) return;
      material.unit = unit;
      changes += 1;
    });

    catalog.forEach(item => {
      const material = materials.find(row => row.id === item.materialId);
      const unit = readableUnit(item.unit, material?.unit, 'pieza');
      if (item.unit === unit) return;
      item.unit = unit;
      changes += 1;
    });

    if (changes && persist && typeof persistState === 'function') persistState();
    return changes;
  }

  function materials() {
    return typeof state !== 'undefined' && Array.isArray(state.materials) ? state.materials : [];
  }

  function catalog() {
    return typeof state !== 'undefined' && Array.isArray(state.supplierCatalog) ? state.supplierCatalog : [];
  }

  function materialById(id) {
    return materials().find(item => item.id === id) || null;
  }

  function catalogById(id) {
    return catalog().find(item => item.id === id) || null;
  }

  function packageTotal(item) {
    return n(item?.packagePrice) + n(item?.shippingCost) + n(item?.otherCost);
  }

  function presentationQty(item) {
    return Math.max(0.001, n(item?.presentationQty) || 1);
  }

  function packageKind(item) {
    const source = `${item?.packageLabel || ''} ${item?.name || ''} ${item?.notes || ''}`.toLocaleLowerCase('es-MX');
    const choices = [
      ['caja', 'caja', 'cajas'],
      ['paquete', 'paquete', 'paquetes'],
      ['rollo', 'rollo', 'rollos'],
      ['bulto', 'bulto', 'bultos'],
      ['bolsa', 'bolsa', 'bolsas'],
      ['set', 'set', 'sets']
    ];
    const found = choices.find(([needle]) => source.includes(needle));
    return found ? { singular: found[1], plural: found[2] } : { singular: 'paquete', plural: 'paquetes' };
  }

  function packageWord(item, count) {
    const kind = packageKind(item);
    return Math.abs(n(count) - 1) < 0.000001 ? kind.singular : kind.plural;
  }

  function itemUnit(item) {
    return readableUnit(item?.unit, materialById(item?.materialId)?.unit, 'pieza');
  }

  function catalogItems(supplierId = '', materialId = '') {
    if (!supplierId) return [];
    normalizeUnits({ persist: false });
    return catalog()
      .filter(item => item.active !== false && item.materialId)
      .filter(item => item.supplierId === supplierId)
      .filter(item => !materialId || item.materialId === materialId)
      .sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)) || String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  }

  function optionLabel(item) {
    const unit = itemUnit(item);
    return `${item.name || 'Presentación'} · ${packageKind(item).singular} de ${quantity(presentationQty(item))} ${unit} · ${cash(packageTotal(item))}`;
  }

  function presentationOptions({ supplierId = '', materialId = '', selectedId = '', snapshot = null } = {}) {
    if (!supplierId) return '<option value="">Selecciona proveedor primero</option>';
    const rows = catalogItems(supplierId, materialId);
    const options = ['<option value="">Compra por unidad</option>'];
    rows.forEach(item => {
      options.push(`<option value="${safe(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${safe(optionLabel(item))}</option>`);
    });
    if (selectedId && !rows.some(item => item.id === selectedId)) {
      const current = catalogById(selectedId);
      const unit = readableUnit(snapshot?.unit, current?.unit, materialById(materialId)?.unit, 'pieza');
      const label = current
        ? optionLabel(current)
        : `${snapshot?.packageName || 'Presentación guardada'} · ${quantity(snapshot?.presentationQty || 1)} ${unit}`;
      options.push(`<option value="${safe(selectedId)}" selected>${safe(label)}</option>`);
    }
    return options.join('');
  }

  function supplierIdForRow(row) {
    return row?.closest?.('#purchaseForm')?.elements?.supplierId?.value || '';
  }

  function purchaseRow(item = {}, supplierId = '') {
    normalizeUnits();
    const materialId = item.materialId || '';
    const catalogItemId = item.catalogItemId || item.supplierItemId || '';
    const catalogItem = catalogById(catalogItemId);
    const packageMode = Boolean(catalogItemId);
    const unitsPerPackage = packageMode
      ? Math.max(0.001, n(item.presentationQty) || presentationQty(catalogItem))
      : 1;
    const packageCount = packageMode
      ? Math.max(0, n(item.packageCount) || (n(item.qty) / unitsPerPackage) || 1)
      : Math.max(0, n(item.qty));
    const totalPerPackage = packageMode
      ? Math.max(0, n(item.packageTotal) || n(item.unitCost) * unitsPerPackage || packageTotal(catalogItem))
      : Math.max(0, n(item.unitCost));
    const packageName = item.packageName || catalogItem?.name || 'Presentación guardada';
    const packageLabel = item.packageLabel || packageKind(catalogItem || item).singular;
    const unit = readableUnit(item.unit, catalogItem?.unit, materialById(materialId)?.unit, 'pieza');
    const conversion = packageMode
      ? `${quantity(packageCount)} ${packageWord({ packageLabel }, packageCount)} × ${quantity(unitsPerPackage)} ${unit} = ${quantity(packageCount * unitsPerPackage)} ${unit} al inventario · ${cash(totalPerPackage / unitsPerPackage)} por ${unit}`
      : '';
    const selectedSupplierId = supplierId || document.querySelector('#purchaseForm')?.elements?.supplierId?.value || '';

    return `<div class="line-row purchase purchase-package-row" data-purchase-mode="${packageMode ? 'package' : 'unit'}" data-catalog-id="${safe(catalogItemId)}" data-presentation-qty="${unitsPerPackage}" data-package-label="${safe(packageLabel)}" data-package-name="${safe(packageName)}" data-unit-label="${safe(unit)}">
      <select class="purchase-material" aria-label="Material">${materialOptions(materialId)}</select>
      <select class="purchase-presentation" aria-label="Presentación" ${selectedSupplierId ? '' : 'disabled'}>${presentationOptions({ supplierId: selectedSupplierId, materialId, selectedId: catalogItemId, snapshot: { packageName, presentationQty: unitsPerPackage, unit } })}</select>
      <input class="purchase-qty" type="number" min="0.001" step="0.001" value="${packageCount}" placeholder="${packageMode ? safe(packageKind({ packageLabel }).plural) : 'Cantidad'}" aria-label="Cantidad">
      <input class="purchase-cost" type="number" min="0" step="0.01" value="${totalPerPackage}" placeholder="${packageMode ? `Costo de la ${safe(packageLabel)}` : 'Costo unitario'}" aria-label="Costo">
      <button type="button" class="action-button remove-row">×</button>
      <small class="purchase-conversion">${safe(conversion)}</small>
    </div>`;
  }

  function setPackageMetadata(row, item) {
    const unit = itemUnit(item);
    row.dataset.purchaseMode = 'package';
    row.dataset.catalogId = item.id || '';
    row.dataset.presentationQty = String(presentationQty(item));
    row.dataset.packageLabel = packageKind(item).singular;
    row.dataset.packageName = item.name || 'Presentación';
    row.dataset.unitLabel = unit;
  }

  function setUnitMetadata(row) {
    const material = materialById(row.querySelector('.purchase-material')?.value);
    row.dataset.purchaseMode = 'unit';
    row.dataset.catalogId = '';
    row.dataset.presentationQty = '1';
    row.dataset.packageLabel = '';
    row.dataset.packageName = '';
    row.dataset.unitLabel = readableUnit(material?.unit, 'pieza');
  }

  function updateRow(row) {
    if (!row) return;
    const qtyInput = row.querySelector('.purchase-qty');
    const costInput = row.querySelector('.purchase-cost');
    const conversion = row.querySelector('.purchase-conversion');
    if (!qtyInput || !costInput || !conversion) return;

    if (row.dataset.purchaseMode !== 'package') {
      qtyInput.placeholder = 'Cantidad';
      costInput.placeholder = 'Costo unitario';
      conversion.textContent = '';
      return;
    }

    const packages = Math.max(0, n(qtyInput.value));
    const total = Math.max(0, n(costInput.value));
    const perPackage = Math.max(0.001, n(row.dataset.presentationQty) || 1);
    const unit = readableUnit(row.dataset.unitLabel, materialById(row.querySelector('.purchase-material')?.value)?.unit, 'pieza');
    row.dataset.unitLabel = unit;
    const descriptor = { packageLabel: row.dataset.packageLabel, name: row.dataset.packageName };
    qtyInput.placeholder = packageKind(descriptor).plural;
    costInput.placeholder = `Costo de la ${packageKind(descriptor).singular}`;
    conversion.textContent = `${quantity(packages)} ${packageWord(descriptor, packages)} × ${quantity(perPackage)} ${unit} = ${quantity(packages * perPackage)} ${unit} al inventario · ${cash(total / perPackage)} por ${unit}`;
  }

  function applyCatalogItem(row, item, options = {}) {
    if (!row || !item?.materialId) return false;
    normalizeUnits();
    const materialSelect = row.querySelector('.purchase-material');
    const presentationSelect = row.querySelector('.purchase-presentation');
    const qtyInput = row.querySelector('.purchase-qty');
    const costInput = row.querySelector('.purchase-cost');
    if (!materialSelect || !presentationSelect || !qtyInput || !costInput) return false;

    materialSelect.value = item.materialId;
    const supplierId = supplierIdForRow(row) || item.supplierId;
    presentationSelect.disabled = false;
    presentationSelect.innerHTML = presentationOptions({ supplierId, materialId: item.materialId, selectedId: item.id });
    presentationSelect.value = item.id;
    setPackageMetadata(row, item);
    if (!options.keepQuantity || n(qtyInput.value) <= 0) qtyInput.value = '1';
    if (!options.keepCost) costInput.value = String(packageTotal(item));
    updateRow(row);
    return true;
  }

  function applyUnitMode(row, options = {}) {
    if (!row) return;
    normalizeUnits();
    const materialSelect = row.querySelector('.purchase-material');
    const presentationSelect = row.querySelector('.purchase-presentation');
    const costInput = row.querySelector('.purchase-cost');
    setUnitMetadata(row);
    if (presentationSelect) presentationSelect.value = '';
    const material = materialById(materialSelect?.value);
    if (costInput && !options.keepCost) costInput.value = String(n(material?.unitCost));
    updateRow(row);
  }

  function refreshPresentation(row, options = {}) {
    if (!row) return;
    normalizeUnits();
    const supplierId = supplierIdForRow(row);
    const materialId = row.querySelector('.purchase-material')?.value || '';
    const select = row.querySelector('.purchase-presentation');
    if (!select) return;
    const currentId = select.value || row.dataset.catalogId || '';
    const candidates = catalogItems(supplierId, materialId);
    let selected = candidates.find(item => item.id === currentId) || null;
    if (!selected && options.autoSelect && materialId) {
      selected = candidates.find(item => item.preferred) || (candidates.length === 1 ? candidates[0] : null);
    }
    select.disabled = !supplierId;
    select.innerHTML = presentationOptions({ supplierId, materialId, selectedId: selected?.id || '' });
    if (selected) applyCatalogItem(row, selected, { keepQuantity: options.keepQuantity, keepCost: options.keepCost });
    else applyUnitMode(row, { keepCost: options.keepCost });
  }

  function lineFromRow(row) {
    normalizeUnits();
    const materialId = row.querySelector('.purchase-material')?.value || '';
    const shownQty = Math.max(0, n(row.querySelector('.purchase-qty')?.value));
    const shownCost = Math.max(0, n(row.querySelector('.purchase-cost')?.value));
    const select = row.querySelector('.purchase-presentation');
    const catalogItemId = select?.value || row.dataset.catalogId || '';
    const isPackage = row.dataset.purchaseMode === 'package' && Boolean(catalogItemId);
    if (!isPackage) return { materialId, qty: shownQty, unitCost: shownCost };

    const catalogItem = catalogById(catalogItemId);
    const perPackage = Math.max(0.001, n(row.dataset.presentationQty) || presentationQty(catalogItem));
    const unit = readableUnit(row.dataset.unitLabel, catalogItem?.unit, materialById(materialId)?.unit, 'pieza');
    return {
      materialId,
      qty: shownQty * perPackage,
      unitCost: shownCost / perPackage,
      catalogItemId,
      packageCount: shownQty,
      presentationQty: perPackage,
      packageTotal: shownCost,
      packageLabel: row.dataset.packageLabel || packageKind(catalogItem).singular,
      packageName: row.dataset.packageName || catalogItem?.name || 'Presentación',
      unit
    };
  }

  function updatePurchasePreview() {
    const form = document.querySelector('#purchaseForm');
    if (!form) return;
    normalizeUnits();
    const rows = [...form.querySelectorAll('.line-row.purchase')];
    rows.forEach(updateRow);
    const total = rows.reduce((sumValue, row) => sumValue + n(row.querySelector('.purchase-qty')?.value) * n(row.querySelector('.purchase-cost')?.value), 0);
    const totalNode = form.querySelector('#purchasePreview');
    if (totalNode) totalNode.textContent = cash(total);

    const inventoryNode = form.querySelector('#purchaseInventoryPreview');
    if (inventoryNode) {
      const conversions = rows
        .filter(row => row.dataset.purchaseMode === 'package')
        .map(row => {
          const line = lineFromRow(row);
          return `${quantity(line.packageCount)} ${packageWord({ packageLabel: line.packageLabel }, line.packageCount)} → ${quantity(line.qty)} ${line.unit}`;
        });
      inventoryNode.textContent = conversions.length
        ? `Entrada al inventario: ${conversions.join(' · ')}`
        : 'En compras por unidad, la cantidad capturada entra directamente al inventario.';
    }
  }

  function openPurchaseModal(id = '') {
    normalizeUnits();
    const purchase = state.purchases.find(item => item.id === id) || {
      id: uid('purchase'), supplierId: '', date: todayISO(), invoice: '',
      items: [{}], notes: '', payments: [], inventoryApplied: false, valuationSnapshot: []
    };
    openModal(
      id ? 'Editar compra' : 'Nueva compra',
      `<form id="purchaseForm" class="modal-form">
        <input type="hidden" name="id" value="${safe(purchase.id)}">
        <label>Proveedor<select name="supplierId" required>${supplierOptions(purchase.supplierId)}</select></label>
        <label>Fecha<input name="date" type="date" required value="${safe(purchase.date)}"></label>
        <label>Factura / referencia<input name="invoice" value="${safe(purchase.invoice || '')}"></label>
        <label class="full">Notas<textarea name="notes" rows="3">${safe(purchase.notes || '')}</textarea></label>
        <div class="form-section">
          <div class="section-title"><div><h3>Materiales comprados</h3><p>Selecciona una presentación del proveedor para capturar cajas o paquetes completos.</p></div><button type="button" class="button secondary small" id="addPurchaseRow">+ Material</button></div>
          <div class="dynamic-list" id="purchaseRows">${(purchase.items?.length ? purchase.items : [{}]).map(item => purchaseRow(item, purchase.supplierId)).join('')}</div>
        </div>
        <div class="summary-box">
          <div class="summary-row total"><span>Total de compra</span><strong id="purchasePreview">$0.00</strong></div>
          <div class="summary-row"><span>Pagado registrado</span><strong>${cash(paymentTotal(purchase))}</strong></div>
          <small id="purchaseInventoryPreview"></small>
        </div>
      </form>`,
      `<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="purchaseForm">Guardar compra</button>`,
      true
    );
    updatePurchasePreview();
  }

  function savePurchase(form) {
    normalizeUnits();
    const data = Object.fromEntries(new FormData(form));
    const oldPurchase = state.purchases.find(item => item.id === data.id);
    const items = [...form.querySelectorAll('.line-row.purchase')]
      .map(lineFromRow)
      .filter(item => item.materialId && item.qty > 0);
    if (!data.supplierId || !items.length) return showToast('Selecciona proveedor y materiales', 'error');

    const purchase = {
      id: data.id,
      supplierId: data.supplierId,
      date: data.date,
      invoice: String(data.invoice || '').trim(),
      notes: String(data.notes || '').trim(),
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

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .line-row.purchase.purchase-package-row { grid-template-columns: minmax(180px,2fr) minmax(210px,1.45fr) .72fr .95fr auto; }
      .line-row.purchase .purchase-conversion { grid-column: 2 / -2; min-height: 18px; line-height: 1.35; color: var(--muted); }
      #purchaseInventoryPreview { display: block; line-height: 1.4; }
      @media (max-width:760px) {
        .line-row.purchase.purchase-package-row { grid-template-columns:1fr 1fr; }
        .line-row.purchase.purchase-package-row > :first-child { grid-column:1 / -1; }
        .line-row.purchase .purchase-conversion { grid-column:1 / -1; }
      }
    `;
    document.head.appendChild(style);
  }

  function repairOpenForm() {
    const form = document.querySelector('#purchaseForm');
    if (!form) return;
    normalizeUnits();
    form.querySelectorAll('.line-row.purchase').forEach(row => {
      const selectedId = row.querySelector('.purchase-presentation')?.value || row.dataset.catalogId || '';
      const selected = catalogById(selectedId);
      if (selected) applyCatalogItem(row, selected, { keepQuantity: true, keepCost: true });
      else {
        const unit = readableUnit(materialById(row.querySelector('.purchase-material')?.value)?.unit, 'pieza');
        row.dataset.unitLabel = unit;
        updateRow(row);
      }
    });
    updatePurchasePreview();
  }

  function bindEvents() {
    document.addEventListener('change', event => {
      const form = event.target.closest?.('#purchaseForm');
      if (!form) return;
      if (event.target.name === 'supplierId') {
        form.querySelectorAll('.line-row.purchase').forEach(row => refreshPresentation(row, { autoSelect: true }));
        updatePurchasePreview();
        event.stopPropagation();
        return;
      }
      const row = event.target.closest?.('.line-row.purchase');
      if (!row) return;
      if (event.target.classList.contains('purchase-material')) {
        refreshPresentation(row, { autoSelect: true });
        updatePurchasePreview();
        event.stopPropagation();
        return;
      }
      if (event.target.classList.contains('purchase-presentation')) {
        const item = catalogById(event.target.value);
        if (item) applyCatalogItem(row, item);
        else applyUnitMode(row);
        updatePurchasePreview();
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('input', event => {
      if (event.target.closest?.('#purchaseForm') && event.target.matches('.purchase-qty,.purchase-cost')) updatePurchasePreview();
    });

    window.addEventListener('focus', () => {
      normalizeUnits();
      repairOpenForm();
    });
  }

  normalizeUnits();
  installStyles();
  bindEvents();

  window.purchaseRow = purchaseRow;
  window.updatePurchasePreview = updatePurchasePreview;
  window.openPurchaseModal = openPurchaseModal;
  window.savePurchase = savePurchase;
  window.MoorePrintPurchasePackages = {
    version: VERSION,
    packageTotalOf: packageTotal,
    catalogItemsForPurchase: catalogItems,
    purchasePresentationOptions: presentationOptions,
    purchaseLineFromRow: lineFromRow,
    applyCatalogItemToPurchaseRow: applyCatalogItem,
    refreshPurchasePresentation: refreshPresentation,
    updatePurchasePreview,
    normalizeUnits,
    readableUnit
  };
  window.MoorePrintPurchasePackagesV2 = true;

  repairOpenForm();
})();
