const { test, expect } = require('@playwright/test');
const path = require('path');

async function installOperationsFixture(page) {
  await page.setContent(`<!doctype html><html><body>
    <section id="orders"><input id="orderSearch"><select id="orderStatusFilter"><option value="all">Todos</option></select><select id="assignmentFilter"><option value="all">Todos</option></select><select id="teamUrgencyFilter"><option value="all">Todos</option></select><article class="panel"><table><tbody id="ordersTable"></tbody></table><p id="ordersEmpty"></p></article></section>
    <section id="settings"><div class="settings-grid"></div></section>
    <div id="modalBackdrop" hidden><div id="modalBody"></div><div id="modalFooter"></div></div>
  </body></html>`);

  await page.evaluate(() => {
    window.__rpcCalls = [];
    window.__paymentSaved = 0;
    window.__lastToast = '';
    window.__lockResponse = { acquired: true, user_name: 'Propietario', expires_at: new Date(Date.now() + 180000).toISOString() };
    window.STORAGE_KEY = 'operations-test';
    window.state = {
      business: { name: 'MoorePrint', openingCash: 0 },
      orders: [], quotes: [], customers: [], suppliers: [], materials: [], purchases: [], expenses: [], recurringExpenses: [], cashTransactions: [], inventoryMovements: []
    };
    window.clone = value => JSON.parse(JSON.stringify(value));
    window.esc = value => String(value ?? '');
    window.num = value => Number(value) || 0;
    window.money = value => `$${Number(value || 0).toFixed(2)}`;
    window.formatDate = value => value || '—';
    window.statusName = value => value;
    window.methodName = value => value;
    window.todayISO = () => '2026-07-11';
    window.documentTotals = order => ({ total: Number(order.total || 100), balance: Number(order.balance ?? 100) });
    window.isOverdue = () => false;
    window.renderAll = () => {};
    window.showToast = message => { window.__lastToast = message; };
    window.downloadBlob = () => {};
    window.renderOrders = () => {};
    window.closeModal = () => { document.querySelector('#modalBackdrop').hidden = true; };
    window.openModal = (title, body, footer) => {
      document.querySelector('#modalBody').innerHTML = body;
      document.querySelector('#modalFooter').innerHTML = footer;
      document.querySelector('#modalBackdrop').hidden = false;
    };
    window.openOrderModal = id => {
      const order = window.state.orders.find(row => row.id === id) || { id: id || 'new-order', customerId: '', customer: '', phone: '', status: 'pendiente' };
      window.openModal('Pedido', `<form id="orderForm"><input name="id" value="${order.id}"><select id="orderCustomerSelect" name="customerId"><option value="">Sin cliente</option></select><input name="customer" value="${order.customer || ''}"><input name="phone" value="${order.phone || ''}"><select name="status"><option value="pendiente" selected>Pendiente</option><option value="en_proceso">En proceso</option></select><div class="summary-box"></div></form>`, '<button form="orderForm">Guardar</button>');
    };
    window.openQuoteModal = () => {
      window.openModal('Cotización', '<form id="quoteForm"><select id="quoteCustomerSelect" name="customerId"><option value="">Sin cliente</option></select><input name="customer"><input name="phone"><div class="summary-box"></div></form>', '<button form="quoteForm">Guardar</button>');
    };
    window.saveOrder = () => true;
    window.savePayment = () => { window.__paymentSaved += 1; return true; };
    window.saveAdjustment = () => true;
    window.savePurchase = () => true;
    window.saveCashTransaction = () => true;
    window.saveSupplier = () => true;
    window.saveMaterial = () => true;
    window.saveExpense = () => true;
    window.saveRecurring = () => true;
    window.generateRecurringExpenses = () => true;
    window.performDelete = () => true;

    const makeOrders = offset => Array.from({ length: 50 }, (_, index) => {
      const number = offset + index + 1;
      return {
        order_id: `o-${number}`,
        branch_id: '11111111-1111-1111-1111-111111111111',
        folio: `MP-${number}`,
        customer_name: `Cliente ${number}`,
        status: 'pendiente',
        due_date: '2026-07-20',
        assigned_to: null,
        public_payload: { items: [{ name: 'Trabajo', qty: 1, price: 100 }], orderDate: '2026-07-11', priority: 'normal' },
        financial_payload: null,
        created_at: '2026-07-11T00:00:00Z',
        updated_at: '2026-07-11T00:00:00Z'
      };
    });

    const client = {
      rpc: async (name, params = {}) => {
        window.__rpcCalls.push({ name, params });
        if (name === 'list_team_records') return { data: [], error: null };
        if (name === 'sync_team_records') return { data: 1, error: null };
        if (name === 'page_team_orders') return { data: { rows: makeOrders(params.p_offset || 0), total: 120 }, error: null };
        if (name === 'page_team_activity') return { data: { rows: [], total: 0 }, error: null };
        if (name === 'page_team_errors') return { data: { rows: [], total: 0 }, error: null };
        if (name === 'page_team_customers') return { data: { rows: [{ customer_id: 'c-99', name: 'Cliente Remoto', phone: '7221234567', payload: {} }], total: 1 }, error: null };
        if (name === 'acquire_team_edit_lock') return { data: window.__lockResponse, error: null };
        if (['heartbeat_team_edit_lock', 'release_team_edit_lock', 'record_team_activity', 'record_team_error', 'resolve_team_error', 'delete_team_record'].includes(name)) return { data: true, error: null };
        return { data: null, error: null };
      },
      channel: () => ({
        on() { return this; },
        subscribe(callback) { setTimeout(() => callback('SUBSCRIBED'), 0); return this; }
      })
    };

    const profile = {
      user_id: '22222222-2222-2222-2222-222222222222',
      business_id: '33333333-3333-3333-3333-333333333333',
      branch_id: '11111111-1111-1111-1111-111111111111',
      display_name: 'Propietario',
      role: 'owner',
      permissions: {}
    };
    window.MoorePrintCloud = { hasAccess: () => true, getClient: () => client };
    window.MoorePrintBranches = {
      getProfile: () => profile,
      getContext: () => ({ businessId: profile.business_id, branchId: profile.branch_id, selectedBranchId: 'all' }),
      getSelectedBranchId: () => 'all',
      getMembers: () => [profile],
      isAdmin: () => true,
      can: () => true,
      applyPermissions: () => {}
    };
    window.MoorePrintTeamImprovements = { setStatus: () => {} };
  });

  await page.addScriptTag({ path: path.join(process.cwd(), 'team-operations.js') });
  await expect.poll(() => page.evaluate(() => window.MoorePrintOperations?.isReady())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.MoorePrintOperations?.getOrderPage().ready)).toBe(true);
}

test('la segunda página de pedidos consulta offset 50', async ({ page }) => {
  await installOperationsFixture(page);
  await page.evaluate(() => window.MoorePrintOperations.fetchOrderPage(1));
  await expect.poll(() => page.evaluate(() => window.MoorePrintOperations.getOrderPage().rows[0]?.id)).toBe('o-51');
  await expect(page.locator('#serverOrderPager')).toContainText('Página 2 de 3');
  const call = await page.evaluate(() => window.__rpcCalls.filter(row => row.name === 'page_team_orders').at(-1));
  expect(call.params.p_offset).toBe(50);
  expect(call.params.p_limit).toBe(50);
});

test('avisa y bloquea cuando otro integrante edita el pedido', async ({ page }) => {
  await installOperationsFixture(page);
  await page.evaluate(() => {
    window.state.orders = [{ id: 'o-lock', branchId: '11111111-1111-1111-1111-111111111111', customer: 'Cliente', status: 'pendiente' }];
    window.__lockResponse = { acquired: false, user_name: 'Ana', expires_at: new Date(Date.now() + 120000).toISOString() };
  });
  await page.evaluate(() => window.openOrderModal('o-lock'));
  await expect(page.locator('.team-order-lock')).toContainText('Ana está editando');
  await expect(page.locator('[form="orderForm"]')).toBeDisabled();
  await expect(page.locator('[data-force-order-lock="o-lock"]')).toBeVisible();
});

test('busca clientes remotos por nombre o teléfono dentro del pedido', async ({ page }) => {
  await installOperationsFixture(page);
  await page.evaluate(() => window.openOrderModal());
  const input = page.locator('.team-remote-customer-input');
  await input.fill('Remoto');
  await expect(page.locator('[data-team-customer-id="c-99"]')).toBeVisible();
  await page.locator('[data-team-customer-id="c-99"]').click();
  await expect(page.locator('#orderCustomerSelect')).toHaveValue('c-99');
  await expect(page.locator('#orderForm [name="customer"]')).toHaveValue('Cliente Remoto');
  await expect(page.locator('#orderForm [name="phone"]')).toHaveValue('7221234567');
});

test('un pago requiere una segunda confirmación antes de guardarse', async ({ page }) => {
  await installOperationsFixture(page);
  await page.evaluate(() => {
    window.state.orders = [{ id: 'o-pay', folio: 'MP-100', payments: [] }];
    const form = document.createElement('form');
    form.innerHTML = '<input name="recordType" value="order"><input name="recordId" value="o-pay"><input name="date" value="2026-07-11"><input name="amount" value="250"><input name="method" value="efectivo"><input name="reference" value="REC-1">';
    window.savePayment(form);
  });
  expect(await page.evaluate(() => window.__paymentSaved)).toBe(0);
  await expect(page.locator('#confirmSpecialOperation')).toBeVisible();
  await page.locator('#confirmSpecialOperation').click();
  await expect.poll(() => page.evaluate(() => window.__paymentSaved)).toBe(1);
});

test('los materiales se envían al RPC de operaciones compartidas', async ({ page }) => {
  await installOperationsFixture(page);
  await page.evaluate(() => {
    window.__rpcCalls = [];
    window.state.materials = [{ id: 'm-1', name: 'Taza', stock: 20 }];
  });
  await page.evaluate(() => window.MoorePrintOperations.sync(['material']));
  const call = await page.evaluate(() => window.__rpcCalls.find(row => row.name === 'sync_team_records'));
  expect(call.params.p_entity_type).toBe('material');
  expect(call.params.p_rows[0].entity_id).toBe('m-1');
  expect(call.params.p_rows[0].payload.name).toBe('Taza');
});
