const { test, expect } = require('@playwright/test');
const fs = require('fs');

const catalogScript = fs.readFileSync('app-catalog.js', 'utf8');

function productFormMarkup() {
  return `<form id="productForm">
    <input name="id" value="product-new">
    <input name="name" value="Taza premium">
    <input name="category" value="Sublimación">
    <input name="salePrice" value="100">
    <input name="taxPercent" value="0">
    <input name="laborCost" value="0">
    <input name="designCost" value="0">
    <input name="electricityCost" value="0">
    <input name="packagingCost" value="0">
    <input name="transportCost" value="0">
    <input name="externalCost" value="0">
    <input name="extraCost" value="0">
    <input name="wastePercent" value="0">
    <input name="commissionPercent" value="0">
    <select name="otherCostsMode"><option value="manual">Manual</option><option value="category" selected>Automático</option></select>
    <input name="saveAsCategoryTemplate" type="checkbox">
    <input name="productionMinutes" value="0">
    <input name="autoPrice" type="checkbox">
    <input name="targetMarginPercent" value="40">
    <input name="priceRounding" value="1">
    <textarea name="notes"></textarea>
    <button id="applyCategoryCostTemplate" type="button"></button>
    <strong id="categoryCostTemplateStatus"></strong>
    <strong id="recommendedProductPrice"></strong>
    <strong id="productMaterialPreview"></strong>
    <strong id="productCostPreview"></strong>
    <strong id="productProfitPreview"></strong>
  </form>`;
}

async function preparePage(page) {
  await page.setContent(productFormMarkup());
  await page.evaluate(() => {
    window.state = {
      materials: [],
      products: [{
        id: 'template-1',
        name: 'Taza base',
        category: 'Sublimación',
        isCategoryCostTemplate: true,
        laborCost: 12,
        designCost: 8,
        electricityCost: 3,
        packagingCost: 5,
        transportCost: 2,
        externalCost: 0,
        extraCost: 1,
        wastePercent: 4,
        commissionPercent: 3,
        updatedAt: '2026-07-12T12:00:00.000Z'
      }]
    };
    window.num = value => Number.parseFloat(value) || 0;
    window.money = value => `$${(Number.parseFloat(value) || 0).toFixed(2)}`;
    window.$ = (selector, root = document) => root.querySelector(selector);
    window.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    window.uid = prefix => `${prefix}-test`;
    window.todayISO = () => '2026-07-12';
    window.monthKey = () => '2026-07';
    window.esc = value => String(value ?? '');
    window.clone = value => JSON.parse(JSON.stringify(value));
    window.showToast = message => { window.lastToast = message; };
    window.closeModal = () => {};
    window.saveState = message => { window.lastSaveMessage = message; };
    window.productBreakdown = product => ({ material: 0, overhead: 0, total: 0, profit: Number(product.salePrice) || 0 });
  });
  await page.addScriptTag({ content: catalogScript });
  await page.evaluate(() => { window.updateProductCostPreview = () => { window.previewUpdated = true; }; });
}

test('aplica una plantilla de categoría y permite modificar cada segmento manualmente', async ({ page }) => {
  await preparePage(page);

  const result = await page.evaluate(() => {
    const form = document.querySelector('#productForm');
    const applied = applyCategoryCostTemplate(form);
    const automaticValues = {
      laborCost: form.elements.laborCost.value,
      designCost: form.elements.designCost.value,
      electricityCost: form.elements.electricityCost.value,
      packagingCost: form.elements.packagingCost.value,
      transportCost: form.elements.transportCost.value,
      extraCost: form.elements.extraCost.value,
      wastePercent: form.elements.wastePercent.value,
      commissionPercent: form.elements.commissionPercent.value
    };
    form.elements.laborCost.value = '25';
    return {
      applied,
      automaticValues,
      manualOverride: form.elements.laborCost.value,
      status: document.querySelector('#categoryCostTemplateStatus').textContent,
      toast: window.lastToast
    };
  });

  expect(result.applied).toBe(true);
  expect(result.automaticValues).toEqual({
    laborCost: '12',
    designCost: '8',
    electricityCost: '3',
    packagingCost: '5',
    transportCost: '2',
    extraCost: '1',
    wastePercent: '4',
    commissionPercent: '3'
  });
  expect(result.manualOverride).toBe('25');
  expect(result.status).toContain('Taza base');
  expect(result.toast).toContain('Puedes modificar cualquier campo manualmente');
});

test('al guardar una nueva plantilla deja una sola plantilla por categoría', async ({ page }) => {
  await preparePage(page);

  const result = await page.evaluate(() => {
    const form = document.querySelector('#productForm');
    form.elements.laborCost.value = '20';
    form.elements.saveAsCategoryTemplate.checked = true;
    saveProduct(form);
    return {
      products: window.state.products.map(product => ({
        id: product.id,
        category: product.category,
        template: Boolean(product.isCategoryCostTemplate),
        laborCost: product.laborCost
      })),
      message: window.lastSaveMessage
    };
  });

  expect(result.products).toEqual([
    { id: 'template-1', category: 'Sublimación', template: false, laborCost: 12 },
    { id: 'product-new', category: 'Sublimación', template: true, laborCost: 20 }
  ]);
  expect(result.message).toContain('plantilla de Sublimación guardada');
});

test('el modo manual no obliga a usar una plantilla', async ({ page }) => {
  await preparePage(page);

  const result = await page.evaluate(() => {
    const form = document.querySelector('#productForm');
    form.elements.otherCostsMode.value = 'manual';
    form.elements.laborCost.value = '17.5';
    const product = productFromForm(form);
    return {
      mode: product.otherCostsMode,
      laborCost: product.laborCost,
      isTemplate: product.isCategoryCostTemplate
    };
  });

  expect(result).toEqual({ mode: 'manual', laborCost: 17.5, isTemplate: false });
});
