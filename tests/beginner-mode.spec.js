const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const sections = fs.readFileSync('beginner-sections.js', 'utf8');
const forms = fs.readFileSync('beginner-forms.js', 'utf8');
const mode = fs.readFileSync('beginner-mode.js', 'utf8');
const styles = fs.readFileSync('beginner-mode.css', 'utf8');

function cacheVersion(source) {
  return Number(source.match(/CACHE_NAME\s*=\s*['"]mooreprint-v(\d+)['"]/)?.[1] || 0);
}

test('el modo principiante se carga y funciona sin conexión', async () => {
  expect(html).toContain('<link rel="stylesheet" href="beginner-mode.css">');
  for (const file of ['beginner-sections.js', 'beginner-forms.js', 'beginner-mode.js']) {
    expect(html).toContain(`<script src="${file}"></script>`);
    expect(sw).toContain(`'./${file}'`);
  }
  expect(sw).toContain("'./beginner-mode.css'");
  expect(cacheVersion(sw)).toBeGreaterThan(41);
});

test('todas las áreas principales explican entradas, cambios y consecuencias', async () => {
  for (const section of [
    'dashboard','orders','production','calendar','quotes','customers','products','calculator',
    'inventory','suppliers','purchases','waste','expenses','recurring','cash','reports',
    'activity','notifications','invoicing','help','settings'
  ]) {
    expect(sections).toContain(`${section}:impact(`);
  }
  for (const concept of ['changes', 'receives', 'affects', 'check', 'example']) {
    expect(sections).toContain(concept);
  }
  expect(sections).toContain('Cómo nace y termina una venta');
  expect(sections).toContain('Cómo se controlan los materiales');
  expect(sections).toContain('Cómo se refleja el dinero');
});

test('los formularios principales muestran el efecto antes de guardar', async () => {
  for (const formId of [
    'businessForm','customerForm','supplierForm','materialForm','adjustmentForm','productForm',
    'orderForm','quoteForm','purchaseForm','expenseForm','recurringForm','paymentForm',
    'cashTransactionForm','cfdiSettingsForm','cfdiPreparationForm'
  ]) {
    expect(forms).toContain(`${formId}:form(`);
  }
  expect(mode).toContain('Antes de guardar');
  expect(mode).toContain('No sucede automáticamente');
  expect(mode).toContain('beginner-field-explainer');
});

test('la presentación es responsive y accesible', async () => {
  expect(styles).toContain('.beginner-impact-card');
  expect(styles).toContain('.beginner-business-map');
  expect(styles).toContain('.beginner-form-impact');
  expect(styles).toContain('@media(max-width:760px)');
  expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
  expect(mode).toContain('aria-label');
  expect(mode).toContain('aria-live');
});

test('una sección explica qué cambia y muestra el mapa del negocio', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`
    <header class="topbar"><div class="topbar-actions"></div></header>
    <main class="main-content">
      <section class="page-section" id="dashboard"></section>
      <section class="page-section active" id="orders"></section>
      <section class="page-section" id="help"><div id="learningHelpCenter"></div></section>
    </main>
    <button class="nav-item active" data-section="orders">Pedidos</button>
  `);
  await page.addScriptTag({ content: `
    window.navigate = section => {
      document.querySelectorAll('.page-section').forEach(node => node.classList.toggle('active', node.id === section));
      document.querySelectorAll('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.section === section));
    };
    window.openModal = (title, body, footer) => { window.__beginnerModal = { title, body, footer }; };
    window.closeModal = () => {};
    window.showToast = () => {};
    window.MoorePrintBranches = { getProfile: () => ({ user_id: 'beginner-1' }) };
  ` });
  await page.addScriptTag({ path: path.resolve('beginner-sections.js') });
  await page.addScriptTag({ path: path.resolve('beginner-forms.js') });
  await page.addScriptTag({ path: path.resolve('beginner-mode.js') });

  await expect(page.locator('#orders > .beginner-impact-card')).toContainText('cuenta por cobrar');
  await expect(page.locator('#orders > .beginner-impact-card')).toContainText('También se refleja en');
  await expect(page.locator('#beginnerBusinessMap')).toContainText('Cómo nace y termina una venta');
  await page.locator('#beginnerImpactButton').click();
  await expect.poll(() => page.evaluate(() => window.__beginnerModal?.title || '')).toContain('Pedidos');
  expect(errors).toEqual([]);
});

test('un formulario explica el guardado y el campo enfocado', async ({ page }) => {
  await page.setContent(`
    <header class="topbar"><div class="topbar-actions"></div></header>
    <main class="main-content"><section class="page-section active" id="dashboard"></section><section class="page-section" id="help"></section></main>
    <div id="modalContainer"></div>
  `);
  await page.addScriptTag({ content: `window.navigate=()=>{};window.openModal=()=>{};window.closeModal=()=>{};window.showToast=()=>{};` });
  await page.addScriptTag({ path: path.resolve('beginner-sections.js') });
  await page.addScriptTag({ path: path.resolve('beginner-forms.js') });
  await page.addScriptTag({ path: path.resolve('beginner-mode.js') });

  await page.evaluate(() => {
    document.querySelector('#modalContainer').innerHTML = '<form id="orderForm"><label>Cliente<select name="customerId"><option>Cliente A</option></select></label><label>Fecha<input name="dueDate"></label><button>Guardar</button></form>';
  });
  await expect(page.locator('#orderForm .beginner-form-impact')).toContainText('Confirma una venta');
  await page.locator('#orderForm [name="dueDate"]').focus();
  await expect(page.locator('#orderForm .beginner-field-explainer')).toContainText('Aparece en Calendario y Avisos');
  await expect(page.locator('#orderForm [name="dueDate"]')).toHaveAttribute('aria-describedby', /beginnerFieldExplainer-orderForm/);
});