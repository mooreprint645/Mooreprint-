const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const guide = fs.existsSync('learning-guide.js') ? fs.readFileSync('learning-guide.js', 'utf8') : '';
const styles = fs.existsSync('learning-guide.css') ? fs.readFileSync('learning-guide.css', 'utf8') : '';

function cacheVersion(source) {
  return Number(source.match(/CACHE_NAME\s*=\s*['"]mooreprint-v(\d+)['"]/)?.[1] || 0);
}

test('la guía se carga de forma estática y queda disponible sin conexión', async () => {
  expect(html).toContain('<link rel="stylesheet" href="learning-guide.css">');
  expect(html).toContain('<script src="learning-guide.js"></script>');
  expect(serviceWorker).toContain("'./learning-guide.css'");
  expect(serviceWorker).toContain("'./learning-guide.js'");
  expect(cacheVersion(serviceWorker)).toBeGreaterThan(40);
});

test('existen rutas separadas para administrar y operar', async () => {
  expect(guide).toContain("administrator:");
  expect(guide).toContain("operator:");
  expect(guide).toContain('Ruta de administrador');
  expect(guide).toContain('Ruta de usuario operativo');
  expect(guide).toContain('selectPath');
  expect(guide).toContain('pauseLearning');
  expect(guide).toContain('resetLearning');
});

test('el progreso se separa por usuario del mismo navegador', async () => {
  expect(guide).toContain('window.MoorePrintBranches?.getProfile?.()');
  expect(guide).toContain('profile?.user_id');
  expect(guide).toContain('mooreprint-learning-v1');
  expect(guide).toContain('storageKey');
});

test('la ayuda cubre las áreas principales y explica impacto', async () => {
  for (const section of [
    'dashboard', 'orders', 'production', 'calendar', 'quotes', 'customers',
    'products', 'inventory', 'suppliers', 'purchases', 'expenses', 'recurring',
    'cash', 'reports', 'activity', 'notifications', 'invoicing', 'help', 'settings'
  ]) {
    expect(guide).toContain(`${section}:`);
  }
  for (const concept of ['purpose:', 'when:', 'impact:', 'before:', 'steps:', 'caution:']) {
    expect(guide).toContain(concept);
  }
});

test('la interfaz de aprendizaje es responsive y accesible', async () => {
  expect(styles).toContain('.learning-route-selector');
  expect(styles).toContain('.learning-section-coach');
  expect(styles).toContain('.learning-progress-bar');
  expect(styles).toContain('@media(max-width:760px)');
  expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  expect(guide).toContain('aria-label="Ruta de aprendizaje"');
  expect(guide).toContain('aria-live="polite"');
});

test('un perfil nuevo recibe bienvenida y puede elegir su ruta', async ({ page }) => {
  await page.setContent(`
    <main class="main-content">
      <header class="topbar"><div class="topbar-actions"><button id="uxHelpButton">?</button></div></header>
      <section class="page-section active" id="dashboard"><div id="uxDashboardGuide"></div></section>
      <section class="page-section" id="orders"></section>
      <section class="page-section" id="production"></section>
      <section class="page-section" id="calendar"></section>
      <section class="page-section" id="help"><article class="panel"><div class="panel-header"><div><h2>Ayuda</h2><p>Temas</p></div></div></article></section>
    </main>
    <nav><button class="nav-item active" data-section="dashboard">Resumen</button><button class="nav-item" data-section="orders">Pedidos</button></nav>
  `);

  await page.addScriptTag({ content: `
    window.state = {
      business: {}, customers: [], orders: [], products: [], materials: [], suppliers: [],
      purchases: [], expenses: [], recurringExpenses: [], cashTransactions: []
    };
    window.navigate = section => {
      document.querySelectorAll('.page-section').forEach(node => node.classList.toggle('active', node.id === section));
      document.querySelectorAll('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.section === section));
    };
    window.openModal = (title, body, footer) => { window.__learningModal = { title, body, footer }; };
    window.closeModal = () => {};
    window.showToast = () => {};
    window.MoorePrintBranches = {
      getProfile: () => ({ user_id: 'user-1', role: 'admin' }),
      isAdmin: () => true,
      can: () => true
    };
  ` });

  await page.addScriptTag({ path: path.resolve('learning-guide.js') });

  await expect.poll(() => page.evaluate(() => window.__learningModal?.title || '')).toContain('Bienvenido');
  await page.evaluate(() => window.MoorePrintLearningGuide.selectPath('administrator'));
  await expect(page.locator('#learningGuidePanel')).toContainText('Ruta de administrador');

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(key => key.includes('mooreprint-learning-v1-user-1'))).toBe(true);
});

test('la ayuda de sección explica propósito, cambios y siguiente acción', async ({ page }) => {
  await page.setContent('<main class="main-content"><section class="page-section active" id="orders"></section><section id="dashboard"></section><section id="help"></section></main><button class="nav-item active" data-section="orders">Pedidos</button>');
  await page.addScriptTag({ content: `
    window.state = { business: {}, customers: [], orders: [], products: [], materials: [], suppliers: [], purchases: [], expenses: [], recurringExpenses: [], cashTransactions: [] };
    window.navigate = () => {};
    window.openModal = (title, body, footer) => { window.__learningModal = { title, body, footer }; };
    window.closeModal = () => {};
    window.showToast = () => {};
  ` });
  await page.addScriptTag({ path: path.resolve('learning-guide.js') });
  await page.evaluate(() => window.MoorePrintLearningGuide.openSectionHelp('orders'));
  const modal = await page.evaluate(() => window.__learningModal);
  expect(modal.title).toContain('Pedidos');
  expect(modal.body).toContain('Para qué sirve');
  expect(modal.body).toContain('Qué cambia');
  expect(modal.body).toContain('Evita este error');
});
