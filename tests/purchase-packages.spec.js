const { test, expect } = require('@playwright/test');
const fs = require('fs');

const script = fs.readFileSync('purchase-packages.js', 'utf8');

async function prepare(page) {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.evaluate(() => {
    window.state = {
      supplierCatalog: [{
        id: 'catalog-11oz',
        supplierId: 'supplier-1',
        materialId: 'material-11oz',
        name: 'Caja de tazas 11 oz',
        unit: 'pieza',
        presentationQty: 36,
        packagePrice: 1080,
        shippingCost: 180,
        otherCost: 0,
        active: true,
        preferred: true
      }],
      materials: [{
        id: 'material-11oz',
        name: 'Taza blanca 11 oz',
        unit: 'pieza',
        unitCost: 35
      }],
      purchases: []
    };
    window.num = value => Number.parseFloat(value) || 0;
    window.money = value => `$${window.num(value).toFixed(2)}`;
    window.esc = value => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
    window.materialOptions = selected => `<option value="material-11oz" ${selected === 'material-11oz' ? 'selected' : ''}>Taza blanca 11 oz</option>`;
    window.supplierOptions = selected => `<option value="supplier-1" ${selected === 'supplier-1' ? 'selected' : ''}>Proveedor</option>`;
    window.paymentTotal = () => 0;
    window.uid = prefix => `${prefix}-test`;
    window.todayISO = () => '2026-07-12';
  });
  await page.addScriptTag({ content: script });
}

test('una caja usa el total del paquete y convierte a piezas para inventario', async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    document.body.innerHTML = `<form id="purchaseForm">
      <select name="supplierId"><option value="supplier-1" selected>Proveedor</option></select>
      <div id="purchaseRows">
        ${window.purchaseRow({
          materialId: 'material-11oz',
          qty: 36,
          unitCost: 35,
          catalogItemId: 'catalog-11oz',
          packageCount: 1,
          presentationQty: 36,
          packageTotal: 1260,
          packageLabel: 'caja',
          packageName: 'Caja de tazas 11 oz',
          unit: 'pieza'
        }, 'supplier-1')}
      </div>
      <strong id="purchasePreview"></strong>
      <small id="purchaseInventoryPreview"></small>
    </form>`;
    window.updatePurchasePreview();
    const row = document.querySelector('.line-row.purchase');
    return {
      line: window.MoorePrintPurchasePackages.purchaseLineFromRow(row),
      displayedQuantity: row.querySelector('.purchase-qty').value,
      displayedCost: row.querySelector('.purchase-cost').value,
      total: document.querySelector('#purchasePreview').textContent,
      conversion: row.querySelector('.purchase-conversion').textContent,
      inventory: document.querySelector('#purchaseInventoryPreview').textContent
    };
  });

  expect(result.displayedQuantity).toBe('1');
  expect(result.displayedCost).toBe('1260');
  expect(result.total).toBe('$1260.00');
  expect(result.line).toMatchObject({
    materialId: 'material-11oz',
    qty: 36,
    unitCost: 35,
    packageCount: 1,
    presentationQty: 36,
    packageTotal: 1260
  });
  expect(result.conversion).toContain('1 caja × 36 pieza = 36 pieza');
  expect(result.inventory).toContain('1 caja → 36 pieza');
});

test('al elegir el material se aplica automáticamente la presentación única del proveedor', async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    document.body.innerHTML = `<form id="purchaseForm">
      <select name="supplierId"><option value="supplier-1" selected>Proveedor</option></select>
      <div id="purchaseRows">${window.purchaseRow({ qty: 1 }, 'supplier-1')}</div>
      <strong id="purchasePreview"></strong>
      <small id="purchaseInventoryPreview"></small>
    </form>`;
    const row = document.querySelector('.line-row.purchase');
    const material = row.querySelector('.purchase-material');
    material.value = 'material-11oz';
    material.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      presentation: row.querySelector('.purchase-presentation').value,
      quantity: row.querySelector('.purchase-qty').value,
      cost: row.querySelector('.purchase-cost').value,
      line: window.MoorePrintPurchasePackages.purchaseLineFromRow(row)
    };
  });

  expect(result.presentation).toBe('catalog-11oz');
  expect(result.quantity).toBe('1');
  expect(result.cost).toBe('1260');
  expect(result.line.qty).toBe(36);
  expect(result.line.unitCost).toBe(35);
});
