const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;
let baseURL;

const stubScripts = {
  'local-protection.js': '',
  'pwa.js': '',
  'advanced-fixes.js': 'window.MoorePrintAdvanced={init(){}};',
  'advanced-features.js': '',
  'performance-fixes.js': 'window.MoorePrintPerformance={init(){}};',
  'supabase-cloud.js': 'document.documentElement.classList.add("mooreprint-auth-ui-ready","mooreprint-access-granted");window.MoorePrintCloud={init:async()=>{},hasAccess:()=>true,getClient:()=>null};',
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
  'mobile-fixes.js': ''
};

function contentType(file) {
  const extension = path.extname(file);
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  })[extension] || 'application/octet-stream';
}

async function submit(page, formId) {
  await page.locator(`#${formId}`).evaluate(form => form.requestSubmit());
  await expect(page.locator('#modalBackdrop')).toBeHidden();
}

async function navigate(page, section) {
  await page.evaluate(sectionName => window.navigate(sectionName), section);
  await expect(page.locator(`#${section}`)).toHaveClass(/active/);
}

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    if (Object.prototype.hasOwnProperty.call(stubScripts, requested)) {
      response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(stubScripts[requested]);
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

test('las acciones principales actualizan su área y sus relaciones', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase={createClient(){return {};}};'
  }));
  await page.goto(baseURL);
  await page.waitForFunction(() => document.documentElement.classList.contains('mooreprint-access-granted'));
  await page.waitForFunction(() => document.querySelectorAll('#summaryChart .bar-item').length === 4);
  await expect(page.locator('#dashboard')).toHaveClass(/active/);

  // Cliente.
  await navigate(page, 'customers');
  await page.locator('#newCustomerButton').click({ force: true });
  await page.locator('#customerForm [name="name"]').fill('Cliente de prueba');
  await page.locator('#customerForm [name="phone"]').fill('7220000000');
  await submit(page, 'customerForm');
  await expect(page.locator('#customersGrid')).toContainText('Cliente de prueba');

  // Proveedor.
  await navigate(page, 'suppliers');
  await page.locator('#newSupplierButton').click({ force: true });
  await page.locator('#supplierForm [name="name"]').fill('Proveedor de prueba');
  await submit(page, 'supplierForm');
  await expect(page.locator('#suppliersGrid')).toContainText('Proveedor de prueba');

  // Material vinculado al proveedor.
  await navigate(page, 'inventory');
  await page.locator('#newMaterialButton').click({ force: true });
  await page.locator('#materialForm [name="name"]').fill('Material de prueba');
  await page.locator('#materialForm [name="category"]').fill('Pruebas');
  await page.locator('#materialForm [name="unit"]').fill('pieza');
  await page.locator('#materialForm [name="stock"]').fill('10');
  await page.locator('#materialForm [name="minStock"]').fill('2');
  await page.locator('#materialForm [name="unitCost"]').fill('20');
  await page.locator('#materialForm [name="supplierId"]').selectOption({ index: 1 });
  await submit(page, 'materialForm');
  await expect(page.locator('#materialsTable')).toContainText('Material de prueba');
  await expect(page.locator('#materialsTable')).toContainText('10.00');

  // Producto con receta.
  await navigate(page, 'products');
  await page.locator('#newProductButton').click({ force: true });
  await page.locator('#productForm [name="name"]').fill('Producto de prueba');
  await page.locator('#productForm [name="salePrice"]').fill('100');
  await page.locator('#productForm [name="laborCost"]').fill('10');
  await page.locator('#addRecipeRow').click({ force: true });
  await page.locator('#recipeRows .recipe-material').selectOption({ index: 1 });
  await page.locator('#recipeRows .recipe-qty').fill('1');
  await submit(page, 'productForm');
  await expect(page.locator('#productGrid')).toContainText('Producto de prueba');

  // Pedido y consumo de inventario al entrar en proceso.
  await navigate(page, 'orders');
  await page.locator('#newOrderButton').click({ force: true });
  await page.locator('#orderForm [name="customerId"]').selectOption({ index: 1 });
  await page.locator('#documentLines .line-product').selectOption({ index: 1 });
  await submit(page, 'orderForm');
  await expect(page.locator('#ordersTable')).toContainText('MP-0001');
  await page.locator('#ordersTable [data-edit-order]').first().click({ force: true });
  await page.locator('#orderForm [name="status"]').selectOption('en_proceso');
  await submit(page, 'orderForm');
  await navigate(page, 'inventory');
  await expect(page.locator('#materialsTable')).toContainText('9.00');
  await expect(page.locator('#inventoryMovementsTable')).toContainText('Consumo del pedido MP-0001');

  // Cobro del pedido y reflejo en caja.
  await navigate(page, 'orders');
  await page.locator('#ordersTable [data-pay-order]').first().click({ force: true });
  await page.locator('#paymentForm [name="amount"]').fill('50');
  await page.locator('#paymentForm [name="method"]').selectOption('efectivo');
  await submit(page, 'paymentForm');
  await navigate(page, 'cash');
  await expect(page.locator('#cashTable')).toContainText('MP-0001');
  await expect(page.locator('#cashTable')).toContainText('$50.00');

  // Cotización y conversión a pedido.
  await navigate(page, 'quotes');
  await page.locator('#newQuoteButton').click({ force: true });
  await page.locator('#quoteForm [name="customerId"]').selectOption({ index: 1 });
  await page.locator('#documentLines .line-product').selectOption({ index: 1 });
  await submit(page, 'quoteForm');
  await expect(page.locator('#quotesTable')).toContainText('COT-0001');
  await page.locator('#quotesTable [data-convert-quote]').first().click({ force: true });
  await submit(page, 'orderForm');
  await navigate(page, 'orders');
  await expect(page.locator('#ordersTable')).toContainText('MP-0002');

  // Compra: aumenta inventario y actualiza costo promedio.
  await navigate(page, 'purchases');
  await page.locator('#newPurchaseButton').click({ force: true });
  await page.locator('#purchaseForm [name="supplierId"]').selectOption({ index: 1 });
  await page.locator('#purchaseRows .purchase-material').selectOption({ index: 1 });
  await page.locator('#purchaseRows .purchase-qty').fill('5');
  await page.locator('#purchaseRows .purchase-cost').fill('30');
  await submit(page, 'purchaseForm');
  await expect(page.locator('#purchasesTable')).toContainText('$150.00');
  await navigate(page, 'inventory');
  await expect(page.locator('#materialsTable')).toContainText('14.00');

  // Ajuste manual de inventario.
  await page.locator('#inventoryAdjustmentButton').click({ force: true });
  await page.locator('#adjustmentForm [name="materialId"]').selectOption({ index: 1 });
  await page.locator('#adjustmentForm [name="direction"]').selectOption('add');
  await page.locator('#adjustmentForm [name="quantity"]').fill('1');
  await page.locator('#adjustmentForm [name="reason"]').fill('Conteo físico');
  await submit(page, 'adjustmentForm');
  await expect(page.locator('#materialsTable')).toContainText('15.00');

  // Gasto normal.
  await navigate(page, 'expenses');
  await page.locator('#newExpenseButton').click({ force: true });
  await page.locator('#expenseForm [name="description"]').fill('Gasto de prueba');
  await page.locator('#expenseForm [name="amount"]').fill('200');
  await submit(page, 'expenseForm');
  await expect(page.locator('#expensesTable')).toContainText('Gasto de prueba');
  await expect(page.locator('#expensesTable')).toContainText('$200.00');

  // Gasto recurrente: aparece en su lista y genera el gasto del mes.
  await navigate(page, 'recurring');
  await page.locator('#newRecurringButton').click({ force: true });
  await page.locator('#recurringForm [name="name"]').fill('Renta recurrente');
  await page.locator('#recurringForm [name="amount"]').fill('300');
  await page.locator('#recurringForm [name="day"]').fill('10');
  await submit(page, 'recurringForm');
  await expect(page.locator('#recurringTable')).toContainText('Renta recurrente');
  await expect(page.locator('#recurringTable')).toContainText('$300.00');
  await navigate(page, 'expenses');
  await expect(page.locator('#expensesTable')).toContainText('Renta recurrente');

  // Pausar gasto recurrente.
  await navigate(page, 'recurring');
  await page.locator('#recurringTable [data-toggle-recurring]').first().click({ force: true });
  await expect(page.locator('#recurringTable')).toContainText('Inactivo');

  // Movimiento manual de caja.
  await navigate(page, 'cash');
  await page.locator('#newCashTransactionButton').click({ force: true });
  await page.locator('#cashTransactionForm [name="amount"]').fill('100');
  await page.locator('#cashTransactionForm [name="description"]').fill('Aportación de prueba');
  await submit(page, 'cashTransactionForm');
  await expect(page.locator('#cashTable')).toContainText('Aportación de prueba');
  await expect(page.locator('#cashTable')).toContainText('$100.00');

  // Reportes recalculados.
  await navigate(page, 'reports');
  await expect(page.locator('#reportSales')).not.toHaveText('$0.00');
  await expect(page.locator('#operationalReport')).toContainText('Cuentas por cobrar');
  await expect(page.locator('#accountingAuditSummary')).toContainText('Conciliación del periodo');

  // Exportaciones.
  await navigate(page, 'settings');
  const backupDownload = page.waitForEvent('download');
  await page.locator('#exportBackupButton').click({ force: true });
  await expect((await backupDownload).suggestedFilename()).toMatch(/^mooreprint-respaldo-/);
  const csvDownload = page.waitForEvent('download');
  await page.locator('#exportAllCsvButton').click({ force: true });
  await expect((await csvDownload).suggestedFilename()).toMatch(/^mooreprint-todos-los-datos-/);

  // Eliminación de un gasto.
  await navigate(page, 'expenses');
  const row = page.locator('#expensesTable tr').filter({ hasText: 'Gasto de prueba' });
  await row.locator('[data-delete-expense]').click({ force: true });
  await page.locator('[data-confirm-delete="expense"]').click({ force: true });
  await expect(page.locator('#expensesTable')).not.toContainText('Gasto de prueba');
});
