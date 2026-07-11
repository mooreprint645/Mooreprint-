const { test, expect } = require('@playwright/test');
const path = require('path');

async function installFixture(page) {
  await page.route('https://mooreprint.test/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><html><body>
      <section id="dashboard" class="active"></section>
      <section id="settings"><div class="settings-grid"></div></section>
      <button class="nav-item" data-section="inventory"></button>
      <button id="newMaterialButton"></button>
      <div id="toast"></div>
      <div id="modalBackdrop" hidden><div id="modalBody"></div><div id="modalFooter"></div></div>
    </body></html>`
  }));
  await page.goto('https://mooreprint.test/');

  await page.evaluate(() => {
    const profile = {
      user_id: '22222222-2222-2222-2222-222222222222',
      business_id: '33333333-3333-3333-3333-333333333333',
      branch_id: '11111111-1111-1111-1111-111111111111',
      display_name: 'Propietario',
      email: 'owner@example.com',
      role: 'owner',
      permissions: {}
    };
    localStorage.setItem('mooreprint-hardening-v1-baseline-33333333-3333-3333-3333-333333333333', new Date().toISOString());
    window.__commitCalls = [];
    window.__restoreCalls = [];
    window.STORAGE_KEY = 'hardening-test-state';
    window.state = {
      business: { name: 'MoorePrint' },
      customers: [], suppliers: [], materials: [], products: [], quotes: [], orders: [],
      purchases: [], expenses: [], recurringExpenses: [], cashTransactions: [], inventoryMovements: []
    };
    window.clone = value => JSON.parse(JSON.stringify(value));
    window.esc = value => String(value ?? '');
    window.num = value => Number(value) || 0;
    window.money = value => `$${Number(value || 0).toFixed(2)}`;
    window.todayISO = () => '2026-07-11';
    window.normalizeState = value => value;
    window.renderAll = () => {};
    window.navigate = () => {};
    window.showToast = message => { document.querySelector('#toast').textContent = message; };
    window.openModal = (title, body, footer) => {
      document.querySelector('#modalBody').innerHTML = body;
      document.querySelector('#modalFooter').innerHTML = footer;
      document.querySelector('#modalBackdrop').hidden = false;
    };
    window.closeModal = () => { document.querySelector('#modalBackdrop').hidden = true; };
    window.openSupplierModal = () => {};
    window.openMaterialModal = id => {
      window.openModal('Material', `<form id="materialForm"><input name="id" value="${id || 'm-1'}"><input name="name" value="Taza"></form>`, '<button form="materialForm">Guardar</button>');
    };
    window.openPurchaseModal = () => {};
    window.openExpenseModal = () => {};
    window.openInventoryAdjustment = () => {};
    window.openPaymentModal = () => {};
    window.saveSupplier = () => true;
    window.saveMaterial = form => {
      const id = form.elements.id.value;
      const current = window.state.materials.find(row => row.id === id);
      if (current) current.name = form.elements.name.value;
      else window.state.materials.push({ id, name: form.elements.name.value, stock: 5, branchId: profile.branch_id, createdAt: new Date().toISOString() });
      return true;
    };
    window.saveExpense = () => true;
    window.saveRecurring = () => true;
    window.saveCashTransaction = () => true;
    window.saveAdjustment = () => true;
    window.savePurchase = () => true;
    window.saveOrder = () => true;
    window.savePayment = () => true;
    window.performDelete = () => true;

    function builder(table) {
      const api = {
        select() { return api; },
        order() { return api; },
        limit() {
          return Promise.resolve({
            data: table === 'team_backups' ? [{ backup_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', created_at: '2026-07-11T10:00:00Z', created_by_name: 'Propietario' }] : [],
            error: null
          });
        },
        upsert() { return Promise.resolve({ data: null, error: null }); }
      };
      return api;
    }

    const client = {
      rpc: async (name, params = {}) => {
        if (name === 'team_hardening_self_check') return { data: { ok: true, role: 'owner' }, error: null };
        if (name === 'commit_team_batch') {
          window.__commitCalls.push(params);
          return { data: { ok: true, versions: [{ entity_type: 'material', entity_id: 'm-1', version: 2 }] }, error: null };
        }
        if (name === 'restore_team_backup') {
          window.__restoreCalls.push(params);
          return { data: { ok: true, restored: 1, snapshot: { business: { name: 'Restaurado' }, customers: [], suppliers: [], materials: [], products: [], quotes: [], orders: [], purchases: [], expenses: [], recurringExpenses: [], cashTransactions: [], inventoryMovements: [] } }, error: null };
        }
        if (name === 'acquire_team_edit_lock') return { data: { acquired: true, user_name: 'Propietario', expires_at: new Date(Date.now() + 180000).toISOString() }, error: null };
        if (['heartbeat_team_edit_lock', 'release_team_edit_lock'].includes(name)) return { data: true, error: null };
        return { data: null, error: null };
      },
      from: builder
    };

    window.MoorePrintCloud = { hasAccess: () => true, getClient: () => client };
    window.MoorePrintBranches = {
      getProfile: () => profile,
      getContext: () => ({ businessId: profile.business_id, branchId: profile.branch_id, selectedBranchId: 'all' }),
      getSelectedBranchId: () => 'all',
      getMembers: () => [],
      isAdmin: () => true,
      can: () => true
    };
    window.MoorePrintTeamImprovements = { setStatus: () => {} };
  });

  await page.addScriptTag({ path: path.join(process.cwd(), 'select-innerhtml-stability.js') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'team-hardening.js') });
  await expect.poll(() => page.evaluate(() => window.MoorePrintHardening?.isReady())).toBe(true);
}

test('conserva un cambio sin conexión y lo reintenta al volver', async ({ page, context }) => {
  await installFixture(page);
  await context.setOffline(true);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="id" value="m-1"><input name="name" value="Taza 11 oz">';
    window.saveMaterial(form);
  });
  await expect.poll(() => page.evaluate(() => window.MoorePrintHardening.getQueue().length)).toBe(1);
  await expect(page.locator('#teamPendingQueue')).toContainText('1 cambio pendiente');

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => window.MoorePrintHardening.getQueue().length)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__commitCalls.length)).toBe(1);
});

test('agrega permisos detallados al formulario de empleado', async ({ page }) => {
  await installFixture(page);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'branchMemberForm';
    form.innerHTML = '<input name="userId"><select name="role"><option value="staff" selected>Empleado</option></select><div id="memberPermissionGrid"><label><input name="permission_create_customers"></label></div>';
    document.body.appendChild(form);
  });
  await expect(page.locator('[name="permission_adjust_inventory"]')).toBeVisible();
  await expect(page.locator('[name="permission_restore_backups"]')).toBeVisible();
  await expect(page.locator('[name="permission_register_payments"]')).toBeVisible();
});

test('restaura un respaldo automático con confirmación escrita', async ({ page }) => {
  await installFixture(page);
  await expect(page.locator('[data-restore-backup="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]')).toBeVisible();
  await page.locator('[data-restore-backup="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]').click();
  await page.locator('#restoreBackupForm [name="confirmation"]').fill('RESTAURAR');
  await page.locator('#restoreBackupForm').evaluate(form => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => window.__restoreCalls.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.state.business.name)).toBe('Restaurado');
});
