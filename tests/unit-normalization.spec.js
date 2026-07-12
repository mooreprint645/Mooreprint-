const { test, expect } = require('@playwright/test');
const fs = require('fs');

const script = fs.readFileSync('unit-normalization.js', 'utf8');

test('convierte unidades numéricas a pieza en materiales y catálogo', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.evaluate(() => {
    window.state = {
      materials: [{ id: 'material-1', name: 'Caja de tazas 11 oz', unit: '1' }],
      supplierCatalog: [{ id: 'catalog-1', materialId: 'material-1', unit: '1' }]
    };
    window.persistState = () => { window.persisted = true; };
    window.renderAll = () => {};
  });
  await page.addScriptTag({ content: script });

  const result = await page.evaluate(() => ({
    materialUnit: window.state.materials[0].unit,
    catalogUnit: window.state.supplierCatalog[0].unit,
    persisted: window.persisted,
    numeric: window.MoorePrintUnitNormalization.readableUnit('1'),
    valid: window.MoorePrintUnitNormalization.readableUnit('metro')
  }));

  expect(result).toEqual({
    materialUnit: 'pieza',
    catalogUnit: 'pieza',
    persisted: true,
    numeric: 'pieza',
    valid: 'metro'
  });
});
