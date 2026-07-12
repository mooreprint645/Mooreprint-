(function () {
  const STYLE_ID = 'purchase-package-styles';

  function valueNumber(value) {
    if (typeof num === 'function') return num(value);
    return Number.parseFloat(value) || 0;
  }

  function moneyValue(value) {
    if (typeof money === 'function') return money(value);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valueNumber(value));
  }

  function escapeValue(value) {
    if (typeof esc === 'function') return esc(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatQuantity(value) {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(valueNumber(value));
  }

  function supplierCatalog() {
    return typeof state === 'object' && Array.isArray(state.supplierCatalog) ? state.supplierCatalog : [];
  }

  function catalogItemById(id) {
    return supplierCatalog().find(item => item.id === id) || null;
  }

  function materialById(id) {
    return typeof state === 'object' && Array.isArray(state.materials)
      ? state.materials.find(item => item.id === id) || null
      : null;
  }

  function packageTotalOf(item) {
    return valueNumber(item?.packagePrice) + valueNumber(item?.shippingCost) + valueNumber(item?.otherCost);
  }

  function packagePresentationQty(item) {
    return Math.max(0.001, valueNumber(item?.presentationQty) || 1);
  }

  function packageKind(item) {
    const source = `${item?.packageLabel || ''} ${item?.name || ''} ${item?.notes || ''}`.toLocaleLowerCase('es-MX');
    const kinds = [
      ['caja', 'caja', 'cajas'],
      ['paquete', 'paquete', 'paquetes'],
      ['rollo', 'rollo', 'rollos'],
      ['bulto', 'bulto', 'bultos'],
      ['bolsa', 'bolsa', 'bolsas'],
      ['set', 'set', 'sets']
    ];
    const match = kinds.find(([needle]) => source.includes(needle));
    return match ? { singular: match[1], plural: match[2] } : { singular: 'paquete', plural: 'paquetes' };
  }

  function packageLabelForCount(item, count) {
    const kind = packageKind(item);
    return Math.abs(valueNumber(count) - 1) < 0.000001 ? kind.singular : kind.plural;
  }

  function catalogItemsForPurchase(supplierId = '', materialId = '') {
    if (!supplierId) return [];
    return supplierCatalog()
      .filter(item => item.active !== false)
      .filter(item => item.materialId)
      .filter(item => item.supplierId === supplierId)
      .filter(item => !materialId || item.materialId === materialId)
      .sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)) || String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  }

  function catalogOptionLabel(item) {
    const kind = packageKind(item).singular;
    const quantity = packagePresentationQty(item);
    const unit = item.unit || materialById(item.materialId)?.unit || 'unidades';
    return `${item.name || 'Presentación'} · ${kind} de ${formatQuantity(quantity)} ${unit} · ${moneyValue(packageTotalOf(item))}`;
  }

  function purchasePresentationOptions({ supplierId = '', materialId = '', selectedId = '', snapshot = null } = {}) {
    if (!supplierId) return '<option value="">Selecciona proveedor primero</option>';
    const items = catalogItemsForPurchase(supplierId, materialId);
    const options = ['<option value="">Compra por unidad</option>'];
    items.forEach(item => {
      options.push(`<option value="${escapeValue(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${escapeValue(catalogOptionLabel(item))}</option>`);
    });
    if (selectedId && !items.some(item => item.id === selectedId)) {
      const current = catalogItemById(selectedId);
      const label = current
        ? catalogOptionLabel(current)
        : `${snapshot?.packageName || 'Presentación guardada'} · ${formatQuantity(snapshot?.presentationQty || 1)} ${snapshot?.unit || 'unidades'}`;
      options.push(`<option value="${escapeValue(selectedId)}" selected>${escapeValue(label)}</option>`);
    }
    return options.join('');
  }

  function purchaseSupplierId(row) {
    return row?.closest?.('#purchaseForm')?.elements?.supplierId?.value || '';
  }

  function purchaseRow(item = {}, supplierId = '') {
    const materialId = item.materialId || '';
    const catalogItemId = item.catalogItemId || item.supplierItemId || '';
    const catalogItem = catalogItemById(catalogItemId);
    const packageMode = Boolean(catalogItemId);
    const presentationQty = packageMode
      ? Math.max(0.001, valueNumber(item.presentationQty) || packagePresentationQty(catalogItem))
      : 1;
    const packageCount = packageMode
      ? Math.max(0, valueNumber(item.packageCount) || (valueNumber(item.qty) / presentationQty) || 1)
      : Math.max(0, valueNumber(item.qty));
    const packageTotal = packageMode
      ? Math.max(0, valueNumber(item.packageTotal) || valueNumber(item.unitCost) * presentationQty || packageTotalOf(catalogItem))
      : Math.max(0, valueNumber(item.unitCost));
    const packageName = item.packageName || catalogItem?.name || 'Presentación guardada';
    const packageLabel = item.packageLabel || packageKind(catalogItem || item).singular;
    const unit = item.unit || catalogItem?.unit || materialById(materialId)?.unit || 'unidad';
    const quantityPlaceholder = packageMode ? packageKind({ packageLabel }).plural : 'Cantidad';
    const costPlaceholder = packageMode ? `Costo de la ${packageLabel}` : 'Costo unitario';
    const conversion = packageMode
      ? `${formatQuantity(packageCount)} ${packageLabelForCount({ packageLabel }, packageCount)} × ${formatQuantity(presentationQty)} ${unit} = ${formatQuantity(packageCount * presentationQty)} ${unit} al inventario · ${moneyValue(packageTotal / presentationQty)} por ${unit}`
      : '';
    const resolvedSupplierId = supplierId || document.querySelector('#purchaseForm')?.elements?.supplierId?.value || '';

    return `<div class="line-row purchase purchase-package-row" data-purchase-mode="${packageMode ? 'package' : 'unit'}" data-catalog-id="${escapeValue(catalogItemId)}" data-presentation-qty="${presentationQty}" data-package-label="${escapeValue(packageLabel)}" data-package-name="${escapeValue(packageName)}" data-unit-label="${escapeValue(unit)}">
      <select class="purchase-material" aria-label="Material">${materialOptions(materialId)}</select>
      <select class="purchase-presentation" aria-label="Presentación" ${resolvedSupplierId ? '' : 'disabled'}>${purchasePresentationOptions({ supplierId: resolvedSupplierId, materialId, selectedId: catalogItemId, snapshot: { packageName, presentationQty, unit } })}</select>
      <input class="purchase-qty" type="number" min="0.001" step="0.001" value="${packageCount}" placeholder="${escapeValue(quantityPlaceholder)}" aria-label="Cantidad">
      <input class="purchase-cost" type="number" min="0" step="0.01" value="${packageTotal}" placeholder="${escapeValue(costPlaceholder)}" aria-label="Costo">
      <button type="button" class="action-button remove-row">×</button>
      <small class="purchase-conversion">${escapeValue(conversion)}</small>
    </div>`;
  }

  function setRowPackageMetadata(row, item, presentationQty = packagePresentationQty(item)) {
    const unit = item?.unit || materialById(item?.materialId)?.unit || 'unidad';
    const kind = packageKind(item);
    row.dataset.purchaseMode = 'package';
    row.dataset.catalogId = item?.id || '';
    row.dataset.presentationQty = String(Math.max(0.001, valueNumber(presentationQty) || 1));
    row.dataset.packageLabel = kind.singular;
    row.dataset.packageName = item?.name || 'Presentación';
    row.dataset.unitLabel = unit;
  }

  function setRowUnitMetadata(row) {
    const material = materialById(row.querySelector('.purchase-material')?.value);
    row.dataset.purchaseMode = 'unit';
    row.dataset.catalogId = '';
    row.dataset.presentationQty = '1';
    row.dataset.packageLabel = '';
    row.dataset.packageName = '';
    row.dataset.unitLabel = material?.unit || 'unidad';
  }

  function updatePurchaseRowConversion(row) {
    if (!row) return;
    const quantityInput = row.querySelector('.purchase-qty');
    const costInput = row.querySelector('.purchase-cost');
    const conversion = row.querySelector('.purchase-conversion');
    if (!quantityInput || !costInput || !conversion) return;

    if (row.dataset.purchaseMode !== 'package') {
      quantityInput.placeholder = 'Cantidad';
      costInput.placeholder = 'Costo unitario';
      conversion.textContent = '';
      return;
    }

    const packageCount = Math.max(0, valueNumber(quantityInput.value));
    const packageTotal = Math.max(0, valueNumber(costInput.value));
    const presentationQty = Math.max(0.001, valueNumber(row.dataset.presentationQty) || 1);
    const inventoryQty = packageCount * presentationQty;
    const unit = row.dataset.unitLabel || 'unidad';
    const packageItem = { packageLabel: row.dataset.packageLabel, name: row.dataset.packageName };
    quantityInput.placeholder = packageKind(packageItem).plural;
    costInput.placeholder = `Costo de la ${packageKind(packageItem).singular}`;
    conversion.textContent = `${formatQuantity(packageCount)} ${packageLabelForCount(packageItem, packageCount)} × ${formatQuantity(presentationQty)} ${unit} = ${formatQuantity(inventoryQty)} ${unit} al inventario · ${moneyValue(packageTotal / presentationQty)} por ${unit}`;
  }

  function applyCatalogItemToPurchaseRow(row, item, options = {}) {
    if (!row || !item?.materialId) return false;
    const materialSelect = row.querySelector('.purchase-material');
    const presentationSelect = row.querySelector('.purchase-presentation');
    const quantityInput = row.querySelector('.purchase-qty');
    const costInput = row.querySelector('.purchase-cost');
    if (!materialSelect || !presentationSelect || !quantityInput || !costInput) return false;

    materialSelect.value = item.materialId;
    const supplierId = purchaseSupplierId(row) || item.supplierId;
    presentationSelect.disabled = false;
    presentationSelect.innerHTML = purchasePresentationOptions({ supplierId, materialId: item.materialId, selectedId: item.id });
    presentationSelect.value = item.id;
    setRowPackageMetadata(row, item);
    if (!options.keepQuantity || valueNumber(quantityInput.value) <= 0) quantityInput.value = '1';
    costInput.value = String(packageTotalOf(item));
    updatePurchaseRowConversion(row);
    return true;
  }

  function applyUnitModeToPurchaseRow(row, options = {}) {
    if (!row) return;
    const materialSelect = row.querySelector('.purchase-material');
    const presentationSelect = row.querySelector('.purchase-presentation');
    const costInput = row.querySelector('.purchase-cost');
    setRowUnitMetadata(row);
    if (presentationSelect) presentationSelect.value = '';
    const material = materialById(materialSelect?.value);
    if (costInput && !options.keepCost) costInput.value = String(valueNumber(material?.unitCost));
    updatePurchaseRowConversion(row);
  }

  function refreshPurchasePresentation(row, options = {}) {
    if (!row) return;
    const supplierId = purchaseSupplierId(row);
    const materialId = row.querySelector('.purchase-material')?.value || '';
    const presentationSelect = row.querySelector('.purchase-presentation');
    if (!presentationSelect) return;
    const currentId = presentationSelect.value || row.dataset.catalogId || '';
    const candidates = catalogItemsForPurchase(supplierId, materialId);
    const validCurrent = candidates.find(item => item.id === currentId);
    let selected = validCurrent || null;
    if (!selected && options.autoSelect && materialId) {
      selected = candidates.find(item => item.preferred) || (candidates.length === 1 ? candidates[0] : null);
    }
    presentationSelect.disabled = !supplierId;
    presentationSelect.innerHTML = purchasePresentationOptions({ supplierId, materialId, selectedId: selected?.id || '' });
    if (selected) applyCatalogItemToPurchaseRow(row, selected, { keepQuantity: options.keepQuantity });
    else applyUnitModeToPurchaseRow(row, { keepCost: options.keepCost });
  }

  function purchaseLineFromRow(row) {
    const materialId = row.querySelector('.purchase-material')?.value || '';
    const displayedQty = Math.max(0, valueNumber(row.querySelector('.purchase-qty')?.value));
    const displayedCost = Math.max(0, valueNumber(row.querySelector('.purchase-cost')?.value));
    const presentationSelect = row.querySelector('.purchase-presentation');
    const catalogItemId = presentationSelect?.value || row.dataset.catalogId || '';
    const packageMode = row.dataset.purchaseMode === 'package' && Boolean(catalogItemId);

    if (!packageMode) return { materialId, qty: displayedQty, unitCost: displayedCost };

    const catalogItem = catalogItemById(catalogItemId);
    const presentationQty = Math.max(0.001, valueNumber(row.dataset.presentationQty) || packagePresentationQty(catalogItem));
    const unit = row.dataset.unitLabel || catalogItem?.unit || materialById(materialId)?.unit || 'unidad';
    const packageLabel = row.dataset.packageLabel || packageKind(catalogItem).singular;
    const packageName = row.dataset.packageName || catalogItem?.name || 'Presentación';
    return {
      materialId,
      qty: displayedQty * presentationQty,
      unitCost: displayedCost / presentationQty,
      catalogItemId,
      packageCount: displayedQty,
      presentationQty,
      packageTotal: displayedCost,
      packageLabel,
      packageName,
      unit
    };
  }

  function updatePurchasePreview() {
    const form = document.querySelector('#purchaseForm');
    if (!form) return;
    const rows = [...form.querySelectorAll('.line-row.purchase')];
    rows.forEach(updatePurchaseRowConversion);
    const total = rows.reduce((sumValue, row) => {
      const quantity = valueNumber(row.querySelector('.purchase-qty')?.value);
      const cost = valueNumber(row.querySelector('.purchase-cost')?.value);
      return sumValue + quantity * cost;
    }, 0);
    const preview = document.querySelector('#purchasePreview');
    if (preview) preview.textContent = moneyValue(total);

    const inventoryPreview = document.querySelector('#purchaseInventoryPreview');
    if (inventoryPreview) {
      const packageRows = rows
        .filter(row => row.dataset.purchaseMode === 'package')
        .map(row => {
          const line = purchaseLineFromRow(row);
          return `${formatQuantity(line.packageCount)} ${packageLabelForCount({ packageLabel: line.packageLabel }, line.packageCount)} → ${formatQuantity(line.qty)} ${line.unit}`;
        });
      inventoryPreview.textContent = packageRows.length
        ? `Entrada al inventario: ${packageRows.join(' · ')}`
        : 'En compras por unidad, la cantidad capturada entra directamente al inventario.';
    }
  }

  function openPurchaseModal(id = '') {
    const purchase = state.purchases.find(item => item.id === id) || {
      id: uid('purchase'), supplierId: '', date: todayISO(), invoice: '',
      items: [{}], notes: '', payments: [], inventoryApplied: false, valuationSnapshot: []
    };
    openModal(
      id ? 'Editar compra' : 'Nueva compra',
      `<form id="purchaseForm" class="modal-form">
        <input type="hidden" name="id" value="${escapeValue(purchase.id)}">
        <label>Proveedor<select name="supplierId" required>${supplierOptions(purchase.supplierId)}</select></label>
        <label>Fecha<input name="date" type="date" required value="${escapeValue(purchase.date)}"></label>
        <label>Factura / referencia<input name="invoice" value="${escapeValue(purchase.invoice || '')}"></label>
        <label class="full">Notas<textarea name="notes" rows="3">${escapeValue(purchase.notes || '')}</textarea></label>
        <div class="form-section">
          <div class="section-title"><div><h3>Materiales comprados</h3><p>Selecciona una presentación del proveedor para capturar cajas o paquetes completos.</p></div><button type="button" class="button secondary small" id="addPurchaseRow">+ Material</button></div>
          <div class="dynamic-list" id="purchaseRows">${(purchase.items?.length ? purchase.items : [{}]).map(item => purchaseRow(item, purchase.supplierId)).join('')}</div>
        </div>
        <div class="summary-box">
          <div class="summary-row total"><span>Total de compra</span><strong id="purchasePreview">$0.00</strong></div>
          <div class="summary-row"><span>Pagado registrado</span><strong>${moneyValue(paymentTotal(purchase))}</strong></div>
          <small id="purchaseInventoryPreview"></small>
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
    const items = [...form.querySelectorAll('.line-row.purchase')]
      .map(purchaseLineFromRow)
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
      @media (max-width: 760px) {
        .line-row.purchase.purchase-package-row { grid-template-columns: 1fr 1fr; }
        .line-row.purchase.purchase-package-row > :first-child { grid-column: 1 / -1; }
        .line-row.purchase .purchase-conversion { grid-column: 1 / -1; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindPurchaseEvents() {
    document.addEventListener('change', event => {
      const form = event.target.closest?.('#purchaseForm');
      if (!form) return;
      if (event.target.name === 'supplierId') {
        form.querySelectorAll('.line-row.purchase').forEach(row => refreshPurchasePresentation(row, { autoSelect: true }));
        updatePurchasePreview();
        event.stopPropagation();
        return;
      }
      const row = event.target.closest?.('.line-row.purchase');
      if (!row) return;
      if (event.target.classList.contains('purchase-material')) {
        refreshPurchasePresentation(row, { autoSelect: true });
        updatePurchasePreview();
        event.stopPropagation();
        return;
      }
      if (event.target.classList.contains('purchase-presentation')) {
        const item = catalogItemById(event.target.value);
        if (item) applyCatalogItemToPurchaseRow(row, item);
        else applyUnitModeToPurchaseRow(row);
        updatePurchasePreview();
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('input', event => {
      if (event.target.closest?.('#purchaseForm') && event.target.matches('.purchase-qty,.purchase-cost')) updatePurchasePreview();
    });
  }

  installStyles();
  bindPurchaseEvents();

  window.purchaseRow = purchaseRow;
  window.updatePurchasePreview = updatePurchasePreview;
  window.openPurchaseModal = openPurchaseModal;
  window.savePurchase = savePurchase;
  window.MoorePrintPurchasePackages = {
    packageTotalOf,
    catalogItemsForPurchase,
    purchasePresentationOptions,
    purchaseLineFromRow,
    applyCatalogItemToPurchaseRow,
    refreshPurchasePresentation,
    updatePurchasePreview
  };
})();
