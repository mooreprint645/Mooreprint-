const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let baseURL;

const stubs = {
  'local-protection.js': '',
  'pwa.js': '',
  'advanced-fixes.js': 'window.MoorePrintAdvanced={init(){}};',
  'advanced-features.js': '',
  'performance-fixes.js': 'window.MoorePrintPerformance={init(){}};',
  'supabase-cloud.js': 'document.documentElement.classList.add("mooreprint-auth-ui-ready","mooreprint-access-granted");window.MoorePrintCloud={init:async()=>{window.__appReady=true;},hasAccess:()=>true,getClient:()=>null};',
  'team-workflow.js': 'window.MoorePrintTeamWorkflow={init(){}};',
  'state-bridge.js': '',
  'granular-sync-guard.js': 'window.MoorePrintGranularSync={install(){}};',
  'team-improvements.js': 'window.MoorePrintTeamImprovements={init(){},setStatus(){}};',
  'startup-query-limit.js': 'window.MoorePrintStartupLimit={install(){}};',
  'select-innerhtml-stability.js': '',
  'team-operations.js': 'window.MoorePrintOperations={init(){},sync(){return Promise.resolve();}};',
  'team-operations-ui-guard.js': '',
  'team-hardening.js': 'window.MoorePrintHardening={isReady:()=>false};',
  'branch-access.js': 'window.MoorePrintBranches={getContext:()=>({businessId:"",branchId:"",selectedBranchId:""}),getSelectedBranchId:()=>"",getProfile:()=>null,isAdmin:()=>true,can:()=>true};',
  'catalog-cloud.js': '',
  'overhead-cloud.js': '',
  'usability.js': '',
  'mobile-fixes.js': '',
  'learning-guide.js': ''
};

function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  })[path.extname(file)] || 'application/octet-stream';
}

async function openApp(page) {
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase={createClient(){return {};}};'
  }));
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__appReady === true);
}

async function navigate(page, section) {
  await page.evaluate(sectionName => window.navigate(sectionName), section);
  await expect(page.locator(`#${section}`)).toHaveClass(/active/);
}

async function saveForm(page, formId) {
  const url = page.url();
  const button = page.locator(`button[form="${formId}"]`);
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#modalBackdrop')).toBeHidden();
  expect(page.url()).toBe(url);
}

async function closeModal(page) {
  const button = page.locator('#modalContainer [data-close-modal]').last();
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#modalBackdrop')).toBeHidden();
}

async function stateSnapshot(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mooreprint-control-v1') || '{}'));
}

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    if (Object.prototype.hasOwnProperty.call(stubs, requested)) {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(stubs[requested]);
      return;
    }
    const file = path.join(process.cwd(), requested);
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType(file) });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('cada acción principal guarda, actualiza y enlaza sus datos', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openApp(page);

  await navigate(page, 'customers');
  await page.locator('#newCustomerButton').click();
  await page.locator('#customerForm [name="name"]').fill('Cliente de prueba');
  await page.locator('#customerForm [name="phone"]').fill('7220000000');
  await saveForm(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('Cliente de prueba');
  await page.locator('#customersGrid [data-edit-customer]').click();
  await page.locator('#customerForm [name="phone"]').fill('7221111111');
  await saveForm(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('7221111111');
  await page.locator('#customersGrid [data-view-customer]').click();
  await expect(page.locator('#modalContainer')).toContainText('Pedidos (0)');
  await closeModal(page);

  await navigate(page, 'suppliers');
  await page.locator('#newSupplierButton').click();
  await page.locator('#supplierForm [name="name"]').fill('Proveedor de prueba');
  await page.locator('#supplierForm [name="phone"]').fill('7222222222');
  await saveForm(page, 'supplierForm');
  await expect(page.locator('#suppliersGrid')).toContainText('Proveedor de prueba');
  await page.locator('#suppliersGrid [data-edit-supplier]').click();
  await page.locator('#supplierForm [name="contact"]').fill('Contacto de prueba');
  await saveForm(page, 'supplierForm');
  await expect(page.locator('#suppliersGrid')).toContainText('Contacto de prueba');
  await page.locator('#suppliersGrid [data-view-supplier]').click();
  await expect(page.locator('#modalContainer')).toContainText('Catálogo');
  await closeModal(page);

  await navigate(page, 'inventory');
  await page.locator('#newMaterialButton').click();
  await page.locator('#materialForm [name="name"]').fill('Material de prueba');
  await page.locator('#materialForm [name="category"]').fill('Pruebas');
  await page.locator('#materialForm [name="unit"]').fill('pieza');
  await page.locator('#materialForm [name="stock"]').fill('10');
  await page.locator('#materialForm [name="minStock"]').fill('2');
  await page.locator('#materialForm [name="unitCost"]').fill('20');
  await page.locator('#materialForm [name="supplierId"]').selectOption({ index: 1 });
  await saveForm(page, 'materialForm');
  await expect(page.locator('#materialsTable')).toContainText('Material de prueba');
  await expect(page.locator('#materialsTable')).toContainText('10.00');
  await expect(page.locator('#inventoryMovementsTable')).toContainText('Existencia inicial');

  await navigate(page, 'products');
  await page.locator('#newProductButton').click();
  await page.locator('#productForm [name="name"]').fill('Producto de prueba');
  await page.locator('#productForm [name="category"]').fill('Pruebas');
  await page.locator('#productForm [name="salePrice"]').fill('100');
  await page.locator('#productForm [name="laborCost"]').fill('10');
  await page.locator('#addRecipeRow').click();
  await page.locator('#recipeRows .recipe-material').selectOption({ index: 1 });
  await page.locator('#recipeRows .recipe-qty').fill('1');
  await saveForm(page, 'productForm');
  await expect(page.locator('#productGrid')).toContainText('Producto de prueba');
  await expect(page.locator('#productGrid')).toContainText('$30.00');
  await page.locator('#productGrid [data-edit-product]').click();
  await page.locator('#productForm [name="salePrice"]').fill('120');
  await saveForm(page, 'productForm');
  await expect(page.locator('#productGrid')).toContainText('$120.00');

  await navigate(page, 'orders');
  await page.locator('#newOrderButton').click();
  await page.locator('#orderForm [name="customerId"]').selectOption({ index: 1 });
  await page.locator('#documentLines .line-product').selectOption({ index: 1 });
  await saveForm(page, 'orderForm');
  await expect(page.locator('#ordersTable')).toContainText('MP-0001');
  await expect(page.locator('#ordersTable')).toContainText('$120.00');
  await page.locator('#ordersTable [data-view-order]').click();
  await expect(page.locator('#modalContainer')).toContainText('Nota MP-0001');
  await closeModal(page);
  await page.locator('#ordersTable [data-edit-order]').click();
  await page.locator('#orderForm [name="status"]').selectOption('en_proceso');
  await saveForm(page, 'orderForm');
  await navigate(page, 'inventory');
  await expect(page.locator('#materialsTable')).toContainText('9.00');
  await expect(page.locator('#inventoryMovementsTable')).toContainText('Consumo del pedido MP-0001');
  await navigate(page, 'orders');
  await page.locator('#ordersTable [data-pay-order]').click();
  await page.locator('#paymentForm [name="amount"]').fill('50');
  await page.locator('#paymentForm [name="method"]').selectOption('efectivo');
  await saveForm(page, 'paymentForm');
  await expect(page.locator('#ordersTable')).toContainText('$70.00');

  await navigate(page, 'quotes');
  await page.locator('#newQuoteButton').click();
  await page.locator('#quoteForm [name="customerId"]').selectOption({ index: 1 });
  await page.locator('#documentLines .line-product').selectOption({ index: 1 });
  await saveForm(page, 'quoteForm');
  await expect(page.locator('#quotesTable')).toContainText('COT-0001');
  await page.locator('#quotesTable [data-view-quote]').click();
  await expect(page.locator('#modalContainer')).toContainText('Cotización COT-0001');
  await closeModal(page);
  await page.locator('#quotesTable [data-edit-quote]').click();
  await page.locator('#quoteForm [name="status"]').selectOption('aceptada');
  await saveForm(page, 'quoteForm');
  await expect(page.locator('#quotesTable')).toContainText('Aceptada');
  await page.locator('#quotesTable [data-convert-quote]').click();
  await saveForm(page, 'orderForm');
  await navigate(page, 'orders');
  await expect(page.locator('#ordersTable')).toContainText('MP-0002');
  await navigate(page, 'quotes');
  await expect(page.locator('#quotesTable')).toContainText('Convertida');

  await navigate(page, 'purchases');
  await page.locator('#newPurchaseButton').click();
  await page.locator('#purchaseForm [name="supplierId"]').selectOption({ index: 1 });
  await page.locator('#purchaseForm [name="invoice"]').fill('FAC-001');
  await page.locator('#purchaseRows .purchase-material').selectOption({ index: 1 });
  await page.locator('#purchaseRows .purchase-qty').fill('5');
  await page.locator('#purchaseRows .purchase-cost').fill('30');
  await saveForm(page, 'purchaseForm');
  await expect(page.locator('#purchasesTable')).toContainText('$150.00');
  await navigate(page, 'inventory');
  await expect(page.locator('#materialsTable')).toContainText('14.00');
  await navigate(page, 'purchases');
  await page.locator('#purchasesTable [data-edit-purchase]').click();
  await page.locator('#purchaseRows .purchase-qty').fill('6');
  await saveForm(page, 'purchaseForm');
  await expect(page.locator('#purchasesTable')).toContainText('$180.00');
  await navigate(page, 'inventory');
  await expect(page.locator('#materialsTable')).toContainText('15.00');
  await navigate(page, 'purchases');
  await page.locator('#purchasesTable [data-pay-purchase]').click();
  await page.locator('#paymentForm [name="amount"]').fill('50');
  await page.locator('#paymentForm [name="method"]').selectOption('transferencia');
  await saveForm(page, 'paymentForm');
  await expect(page.locator('#purchasesTable')).toContainText('$130.00');

  await navigate(page, 'inventory');
  await page.locator('#inventoryAdjustmentButton').click();
  await page.locator('#adjustmentForm [name="materialId"]').selectOption({ index: 1 });
  await page.locator('#adjustmentForm [name="direction"]').selectOption('add');
  await page.locator('#adjustmentForm [name="quantity"]').fill('1');
  await page.locator('#adjustmentForm [name="reason"]').fill('Conteo físico');
  await saveForm(page, 'adjustmentForm');
  await expect(page.locator('#materialsTable')).toContainText('16.00');
  await expect(page.locator('#inventoryMovementsTable')).toContainText('Conteo físico');

  await navigate(page, 'expenses');
  await page.locator('#newExpenseButton').click();
  await page.locator('#expenseForm [name="description"]').fill('Gasto de prueba');
  await page.locator('#expenseForm [name="amount"]').fill('200');
  await saveForm(page, 'expenseForm');
  await expect(page.locator('#expensesTable')).toContainText('Gasto de prueba');
  await page.locator('#expensesTable [data-edit-expense]').click();
  await page.locator('#expenseForm [name="amount"]').fill('220');
  await saveForm(page, 'expenseForm');
  await expect(page.locator('#expensesTable')).toContainText('$220.00');
  const expenseRow = page.locator('#expensesTable tr').filter({ hasText: 'Gasto de prueba' });
  await expenseRow.locator('[data-pay-expense]').click();
  await page.locator('#paymentForm [name="amount"]').fill('80');
  await page.locator('#paymentForm [name="method"]').selectOption('efectivo');
  await saveForm(page, 'paymentForm');
  await expect(expenseRow).toContainText('$80.00');
  let saved = await stateSnapshot(page);
  const savedExpense = saved.expenses.find(item => item.description === 'Gasto de prueba');
  expect(savedExpense.amount).toBe(220);
  expect(savedExpense.payments.reduce((total, payment) => total + Number(payment.amount || 0), 0)).toBe(80);

  await navigate(page, 'recurring');
  await page.locator('#newRecurringButton').click();
  await page.locator('#recurringForm [name="name"]').fill('Renta recurrente');
  await page.locator('#recurringForm [name="amount"]').fill('300');
  await page.locator('#recurringForm [name="day"]').fill('10');
  await saveForm(page, 'recurringForm');
  await expect(page.locator('#recurringTable')).toContainText('Renta recurrente');
  await expect(page.locator('#recurringTable')).toContainText('$300.00');
  await navigate(page, 'expenses');
  await expect(page.locator('#expensesTable')).toContainText('Renta recurrente');
  await navigate(page, 'recurring');
  await page.locator('#recurringTable [data-edit-recurring]').click();
  await page.locator('#recurringForm [name="amount"]').fill('350');
  await saveForm(page, 'recurringForm');
  await expect(page.locator('#recurringTable')).toContainText('$350.00');
  await page.locator('#recurringTable [data-toggle-recurring]').click();
  await expect(page.locator('#recurringTable')).toContainText('Inactivo');
  await page.locator('#recurringTable [data-toggle-recurring]').click();
  await page.locator('#generateRecurringButton').click();
  const recurringCount = await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('mooreprint-control-v1') || '{}');
    const recurringId = current.recurringExpenses?.[0]?.id;
    return (current.expenses || []).filter(item => item.recurringId === recurringId).length;
  });
  expect(recurringCount).toBe(1);

  await navigate(page, 'cash');
  await expect(page.locator('#cashTable')).toContainText('MP-0001');
  await expect(page.locator('#cashTable')).toContainText('FAC-001');
  await expect(page.locator('#cashTable')).toContainText('Gasto de prueba');
  await page.locator('#newCashTransactionButton').click();
  await page.locator('#cashTransactionForm [name="amount"]').fill('100');
  await page.locator('#cashTransactionForm [name="description"]').fill('Aportación de prueba');
  await saveForm(page, 'cashTransactionForm');
  await expect(page.locator('#cashTable')).toContainText('Aportación de prueba');
  await expect(page.locator('#cashBalance')).toHaveText('$70.00');
  await page.locator('#cashClosingButton').click();
  await expect(page.locator('#modalContainer')).toContainText('Corte de efectivo');
  await expect(page.locator('#modalContainer')).toContainText('$70.00');
  await closeModal(page);

  await navigate(page, 'reports');
  await expect(page.locator('#reportSales')).toHaveText('$240.00');
  await expect(page.locator('#operationalReport')).toContainText('Cuentas por cobrar');
  await expect(page.locator('#accountingAuditSummary')).toContainText('Conciliación del periodo');

  await navigate(page, 'settings');
  await page.locator('#businessForm [name="phone"]').fill('7223333333');
  await page.locator('#businessForm button[type="submit"]').click();
  saved = await stateSnapshot(page);
  expect(saved.business.phone).toBe('7223333333');
  const backupDownload = page.waitForEvent('download');
  await page.locator('#exportBackupButton').click();
  await expect((await backupDownload).suggestedFilename()).toMatch(/^mooreprint-respaldo-/);
  const csvDownload = page.waitForEvent('download');
  await page.locator('#exportAllCsvButton').click();
  await expect((await csvDownload).suggestedFilename()).toMatch(/^mooreprint-todos-los-datos-/);

  await navigate(page, 'help');
  await page.locator('#helpSearch').fill('pedido');
  await expect(page.locator('#helpTopicsGrid')).toContainText('Registrar un pedido');
  await navigate(page, 'notifications');
  await expect(page.locator('#automaticAlertList')).toBeVisible();
  await navigate(page, 'invoicing');
  await expect(page.locator('#cfdiOrdersTable')).toContainText('MP-0001');
  await page.locator('#cfdiOrdersTable [data-cfdi-prepare]').first().click();
  await expect(page.locator('#cfdiPreparationForm')).toBeVisible();
  await closeModal(page);

  await navigate(page, 'expenses');
  const rowToDelete = page.locator('#expensesTable tr').filter({ hasText: 'Gasto de prueba' });
  await rowToDelete.locator('[data-delete-expense]').click();
  await page.locator('[data-confirm-delete="expense"]').click();
  await expect(page.locator('#expensesTable')).not.toContainText('Gasto de prueba');
  await navigate(page, 'cash');
  await expect(page.locator('#cashBalance')).toHaveText('$150.00');

  saved = await stateSnapshot(page);
  expect(saved.customers).toHaveLength(1);
  expect(saved.suppliers).toHaveLength(1);
  expect(saved.materials).toHaveLength(1);
  expect(saved.products).toHaveLength(1);
  expect(saved.orders).toHaveLength(2);
  expect(saved.quotes).toHaveLength(1);
  expect(saved.purchases).toHaveLength(1);
  expect(saved.recurringExpenses).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});
