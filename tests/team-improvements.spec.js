const { test, expect } = require('@playwright/test');
const path = require('path');

async function installFixture(page, overrides = {}) {
  const role = overrides.role || 'staff';
  const permissions = overrides.permissions || {
    view_customers: true,
    view_quotes: true,
    create_customers: false,
    edit_customers: false,
    delete_customers: false,
    create_quotes: false,
    edit_quotes: false,
    delete_quotes: false
  };

  await page.setContent(`<!doctype html><html><body>
    <button id="newCustomerButton">Nuevo cliente</button>
    <button id="newQuoteButton">Nueva cotización</button>
    <input id="customerSearch">
    <input id="quoteSearch">
    <select id="quoteStatusFilter"><option value="all">Todas</option><option value="borrador">Borrador</option></select>
    <section id="customers"><div id="customersGrid"></div></section>
    <section id="quotes"><article class="panel"><table><tbody id="quotesTable"></tbody></table></article></section>
    <div id="branchSyncStatus"><span></span><span>Sincronización activa.</span></div>
    <div id="teamWorkflowStatus">Flujo compartido activo.</div>
  </body></html>`);

  await page.addInitScript(({ role, permissions }) => {
    window.__testProfile = {
      user_id: 'user-1',
      business_id: 'business-1',
      branch_id: 'branch-1',
      role,
      permissions
    };
  }, { role, permissions });

  await page.evaluate(({ role, permissions }) => {
    window.__testProfile = {
      user_id: 'user-1',
      business_id: 'business-1',
      branch_id: 'branch-1',
      role,
      permissions
    };
    window.__rpcCalls = [];
    window.__openCustomerCalls = 0;
    window.__openQuoteCalls = 0;
    window.__lastToast = '';
    window.STORAGE_KEY = 'test-state';
    window.state = { customers: [], quotes: [], orders: [] };
    window.clone = value => JSON.parse(JSON.stringify(value));
    window.esc = value => String(value ?? '');
    window.num = value => Number(value) || 0;
    window.showToast = message => { window.__lastToast = message; };
    window.closeModal = () => {};
    window.openCustomerModal = () => { window.__openCustomerCalls += 1; };
    window.saveCustomer = () => true;
    window.openQuoteModal = () => { window.__openQuoteCalls += 1; };
    window.saveQuote = () => true;
    window.performDelete = () => true;
    window.renderCustomers = () => {
      document.querySelector('#customersGrid').innerHTML = window.state.customers.map(customer => `<article><span>${customer.name}</span><button data-edit-customer="${customer.id}">Editar</button><button data-delete-customer="${customer.id}">Eliminar</button></article>`).join('');
    };
    window.renderQuotes = () => {
      document.querySelector('#quotesTable').innerHTML = window.state.quotes.map(quote => `<tr><td>${quote.folio}</td><td><button data-edit-quote="${quote.id}">Editar</button><button data-delete-quote="${quote.id}">Eliminar</button></td></tr>`).join('');
    };

    const makeCustomers = offset => Array.from({ length: 50 }, (_, index) => {
      const number = offset + index + 1;
      return {
        customer_id: `c-${number}`,
        branch_id: 'branch-1',
        name: `Cliente ${number}`,
        phone: '',
        email: '',
        rfc: '',
        address: '',
        notes: '',
        payload: {},
        created_at: '2026-07-11T00:00:00Z',
        updated_at: '2026-07-11T00:00:00Z'
      };
    });
    const makeQuotes = offset => Array.from({ length: 50 }, (_, index) => {
      const number = offset + index + 1;
      return {
        quote_id: `q-${number}`,
        branch_id: 'branch-1',
        folio: `COT-${number}`,
        customer_name: `Cliente ${number}`,
        status: 'borrador',
        public_payload: { items: [] },
        financial_payload: null,
        created_at: '2026-07-11T00:00:00Z',
        updated_at: '2026-07-11T00:00:00Z'
      };
    });

    const client = {
      rpc: async (name, params = {}) => {
        window.__rpcCalls.push({ name, params });
        if (name === 'page_team_customers') return { data: { rows: makeCustomers(params.p_offset || 0), total: 120 }, error: null };
        if (name === 'page_team_quotes') return { data: { rows: makeQuotes(params.p_offset || 0), total: 75 }, error: null };
        if (name === 'save_branch_member') return { data: 'user-2', error: null };
        return { data: null, error: null };
      },
      from: () => ({
        select() { return this; },
        range() { return this; },
        then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
      }),
      channel: () => ({
        on() { return this; },
        subscribe(callback) { setTimeout(() => callback('SUBSCRIBED'), 0); return this; }
      })
    };

    window.MoorePrintCloud = {
      hasAccess: () => true,
      getClient: () => client,
      getUser: () => ({ id: 'user-1' })
    };
    window.MoorePrintBranches = {
      can: permission => Boolean(permissions[permission]),
      isAdmin: () => ['owner', 'admin'].includes(role),
      getProfile: () => window.__testProfile,
      getMembers: () => [],
      getSelectedBranchId: () => role === 'admin' || role === 'owner' ? 'all' : 'branch-1',
      getContext: () => ({ businessId: 'business-1', branchId: 'branch-1', selectedBranchId: role === 'admin' || role === 'owner' ? 'all' : 'branch-1', role }),
      sync: async () => true
    };
    window.MoorePrintTeamWorkflow = { sync: async () => true };
  }, { role, permissions });

  await page.addScriptTag({ path: path.join(process.cwd(), 'team-improvements.js') });
  await expect(page.locator('#teamConnectionStatus')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.MoorePrintTeamImprovements?.getStatus().state)).toBe('connected');
}

test('un empleado puede ver sin obtener permiso automático para crear, editar o eliminar', async ({ page }) => {
  await installFixture(page, {
    role: 'staff',
    permissions: { view_customers: true, view_quotes: true }
  });

  await expect(page.locator('#newCustomerButton')).toHaveClass(/branch-restricted/);
  await expect(page.locator('#newQuoteButton')).toHaveClass(/branch-restricted/);

  await page.evaluate(() => window.openCustomerModal());
  await expect.poll(() => page.evaluate(() => window.__lastToast)).toContain('No tienes permiso para crear clientes');
  expect(await page.evaluate(() => window.__openCustomerCalls)).toBe(0);

  await page.evaluate(() => {
    window.state.customers = [{ id: 'c-1', name: 'Cliente 1' }];
    window.state.quotes = [{ id: 'q-1', folio: 'COT-1' }];
    window.renderCustomers();
    window.renderQuotes();
  });

  await expect(page.locator('[data-edit-customer]')).toHaveCount(0);
  await expect(page.locator('[data-delete-customer]')).toHaveCount(0);
  await expect(page.locator('[data-edit-quote]')).toHaveCount(0);
  await expect(page.locator('[data-delete-quote]')).toHaveCount(0);
});

test('un encargado puede crear y editar, pero eliminar sigue separado', async ({ page }) => {
  await installFixture(page, { role: 'manager', permissions: { view_customers: true, view_quotes: true } });

  await page.evaluate(() => window.openCustomerModal());
  await page.evaluate(() => window.openQuoteModal());
  expect(await page.evaluate(() => window.__openCustomerCalls)).toBe(1);
  expect(await page.evaluate(() => window.__openQuoteCalls)).toBe(1);

  await page.evaluate(() => {
    window.state.customers = [{ id: 'c-1', name: 'Cliente 1' }];
    window.state.quotes = [{ id: 'q-1', folio: 'COT-1' }];
    window.renderCustomers();
    window.renderQuotes();
  });

  await expect(page.locator('[data-edit-customer]')).toHaveCount(1);
  await expect(page.locator('[data-delete-customer]')).toHaveCount(0);
  await expect(page.locator('[data-edit-quote]')).toHaveCount(1);
  await expect(page.locator('[data-delete-quote]')).toHaveCount(0);
});

test('la segunda página se solicita en Supabase con desplazamiento 50', async ({ page }) => {
  await installFixture(page, { role: 'admin', permissions: {} });

  await page.evaluate(() => window.MoorePrintTeamImprovements.fetchCustomersPage(1));
  await expect.poll(() => page.evaluate(() => window.state.customers[0]?.id)).toBe('c-51');
  await expect(page.locator('#teamPager-customers')).toContainText('Página 2 de 3');

  const call = await page.evaluate(() => window.__rpcCalls.filter(item => item.name === 'page_team_customers').at(-1));
  expect(call.params.p_offset).toBe(50);
  expect(call.params.p_limit).toBe(50);
});

test('el indicador distingue conexión, actualización y modo sin conexión', async ({ page }) => {
  await installFixture(page, { role: 'admin', permissions: {} });

  await page.evaluate(() => window.MoorePrintTeamImprovements.setStatus('syncing', 'Actualizando información…'));
  await expect(page.locator('#teamConnectionStatus')).toHaveAttribute('data-state', 'syncing');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('#teamConnectionStatus')).toHaveAttribute('data-state', 'offline');
  await expect(page.locator('#teamConnectionStatus')).toContainText('cambios quedan pendientes');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
  await expect.poll(() => page.evaluate(() => window.MoorePrintTeamImprovements.getStatus().state)).toBe('connected');
});
