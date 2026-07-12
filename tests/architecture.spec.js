const { test, expect } = require('@playwright/test');
const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');

const index = read('index.html');
const app = read('app.js');
const core = read('app-core.js');
const catalog = read('app-catalog.js');
const contacts = read('app-contacts.js');
const renderMain = read('app-render-main.js');
const monthly = read('monthly-overhead.js');
const suppliers = read('supplier-catalog.js');
const assistant = read('business-assistant.js');
const compatibility = read('select-innerhtml-stability.js');
const architecture = read('docs/architecture.md');

test('el núcleo no usa cargadores ni sustituciones de funciones', async () => {
  for (const source of [app, core, catalog, contacts, renderMain, monthly, suppliers, assistant]) {
    expect(source).not.toContain('loadScriptOnce');
    expect(source).not.toContain('loadStyleOnce');
    expect(source).not.toContain('baseRenderAll');
    expect(source).not.toContain('wrapFunction(');
  }
  expect(app).not.toContain("createElement('script')");
  expect(app).not.toContain('createElement("script")');
});

test('los módulos especializados exponen APIs y el núcleo las consume', async () => {
  expect(monthly).toContain('window.MoorePrintMonthlyCosts =');
  expect(suppliers).toContain('window.MoorePrintSupplierCatalog =');
  expect(assistant).toContain('window.MoorePrintBusinessAssistant =');
  expect(core).toContain('window.MoorePrintMonthlyCosts?.productMonthlyOverhead');
  expect(contacts).toContain('service?.openSupplierModal');
  expect(renderMain).toContain('service?.render');
  expect(renderMain).toContain('window.MoorePrintBusinessAssistant?.render?.()');
});

test('las dependencias principales aparecen antes de app.js', async () => {
  const order = [
    'accounting-math.js',
    'app-core.js',
    'app-render-main.js',
    'app-render-finance.js',
    'app-contacts.js',
    'app-catalog.js',
    'app-documents.js',
    'app-finance.js',
    'app-tools.js',
    'supplier-catalog.js',
    'monthly-overhead.js',
    'business-assistant.js',
    'app.js'
  ];
  let previous = -1;
  for (const file of order) {
    const position = index.indexOf(`<script src="${file}"></script>`);
    expect(position, `${file} no está declarado`).toBeGreaterThan(-1);
    expect(position, `${file} está fuera de orden`).toBeGreaterThan(previous);
    previous = position;
  }
});

test('la capa temporal de compatibilidad no carga otros módulos', async () => {
  expect(compatibility).toContain('HTMLSelectElement');
  expect(compatibility).not.toContain('team-hardening.js');
  expect(compatibility).not.toContain('team-operations-ui-guard.js');
  expect(compatibility).not.toContain('accounting-cloud-sync.js');
  expect(compatibility).not.toContain("createElement('script')");
});

test('los antiguos parches contables fueron eliminados', async () => {
  expect(fs.existsSync('accounting-integrity.js')).toBe(false);
  expect(fs.existsSync('accounting-cloud-sync.js')).toBe(false);
  expect(index).not.toContain('accounting-integrity.js');
  expect(index).not.toContain('accounting-cloud-sync.js');
});

test('la arquitectura explica cómo agregar funciones sin parches', async () => {
  expect(architecture).toContain('Motor contable');
  expect(architecture).toContain('API explícita');
  expect(architecture).toContain('evitar `baseFunction`, `wrapFunction`');
  expect(architecture).toContain('Compatibilidad heredada');
});
