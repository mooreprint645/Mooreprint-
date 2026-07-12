const { test, expect } = require('@playwright/test');
const fs = require('fs');

const sql = fs.readFileSync('supabase/team-improvements.sql', 'utf8');
const syncSql = fs.readFileSync('supabase/team-improvements-sync.sql', 'utf8');
const operationsSql = fs.readFileSync('supabase/team-operations.sql', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const improvements = fs.readFileSync('team-improvements.js', 'utf8');
const operations = fs.readFileSync('team-operations.js', 'utf8');
const operationsGuard = fs.readFileSync('team-operations-ui-guard.js', 'utf8');
const startupLimit = fs.readFileSync('startup-query-limit.js', 'utf8');
const selectStability = fs.readFileSync('select-innerhtml-stability.js', 'utf8');
const stateBridge = fs.readFileSync('state-bridge.js', 'utf8');
const syncGuard = fs.readFileSync('granular-sync-guard.js', 'utf8');
const filesDb = fs.readFileSync('files-db.js', 'utf8');
const localProtection = fs.readFileSync('local-protection.js', 'utf8');
const pwa = fs.readFileSync('pwa.js', 'utf8');
const assistant = fs.readFileSync('business-assistant.js', 'utf8');
const contacts = fs.readFileSync('app-contacts.js', 'utf8');
const accountingMath = fs.readFileSync('accounting-math.js', 'utf8');
const core = fs.readFileSync('app-core.js', 'utf8');
const finance = fs.readFileSync('app-finance.js', 'utf8');
const renderMain = fs.readFileSync('app-render-main.js', 'utf8');
const renderFinance = fs.readFileSync('app-render-finance.js', 'utf8');
const catalog = fs.readFileSync('app-catalog.js', 'utf8');
const supplierCatalog = fs.readFileSync('supplier-catalog.js', 'utf8');
const monthlyOverhead = fs.readFileSync('monthly-overhead.js', 'utf8');
const mobileFixes = fs.readFileSync('mobile-fixes.css', 'utf8');

test('las políticas usan permisos diferentes para ver, crear, editar y eliminar', async () => {
  for (const permission of [
    'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
    'view_quotes', 'create_quotes', 'edit_quotes', 'delete_quotes'
  ]) {
    expect(sql).toContain(`has_app_permission('${permission}')`);
    expect(improvements).toContain(permission);
  }
});

test('clientes, cotizaciones y pedidos se consultan por páginas', async () => {
  expect(sql).toContain('create or replace function public.page_team_customers');
  expect(sql).toContain('create or replace function public.page_team_quotes');
  expect(operationsSql).toContain('create or replace function public.page_team_orders');
  expect(improvements).toContain('const PAGE_SIZE = 50');
  expect(operations).toContain('const PAGE_SIZE = 50');
  expect(operations).toContain('p_offset: orderPage.page * PAGE_SIZE');
  expect(startupLimit).toContain("'branch_orders'");
  expect(startupLimit).toContain("'branch_order_financials'");
});

test('la sincronización distingue filas nuevas y existentes antes de autorizar', async () => {
  expect(syncSql).toContain('create or replace function public.sync_team_customers');
  expect(syncSql).toContain('create or replace function public.sync_team_quotes');
  expect(syncSql).toContain("has_app_permission('create_customers')");
  expect(syncSql).toContain("has_app_permission('edit_customers')");
  expect(syncSql).toContain("has_app_permission('create_quotes')");
  expect(syncSql).toContain("has_app_permission('edit_quotes')");
  expect(syncGuard).toContain("client.rpc('sync_team_customers'");
  expect(syncGuard).toContain("client.rpc('sync_team_quotes'");
});

test('inventario, compras, proveedores, gastos y caja usan registros compartidos', async () => {
  expect(operationsSql).toContain('create table if not exists public.team_records');
  for (const type of ['supplier', 'material', 'purchase', 'expense', 'recurring_expense', 'cash_transaction', 'inventory_movement']) {
    expect(operationsSql).toContain(`'${type}'`);
    expect(operations).toContain(`'${type}'`);
  }
  expect(operationsSql).toContain('create or replace function public.sync_team_records');
  expect(operationsSql).toContain('create or replace function public.list_team_records');
});

test('la edición simultánea, historial y errores tienen controles de servidor', async () => {
  expect(operationsSql).toContain('create table if not exists public.team_edit_locks');
  expect(operationsSql).toContain('create or replace function public.acquire_team_edit_lock');
  expect(operationsSql).toContain('create or replace function public.heartbeat_team_edit_lock');
  expect(operationsSql).toContain('create or replace function public.release_team_edit_lock');
  expect(operationsSql).toContain('create or replace function public.page_team_activity');
  expect(operationsSql).toContain('create table if not exists public.team_errors');
  expect(operationsSql).toContain('create or replace function public.record_team_error');
  expect(operations).toContain('Editar de todos modos');
  expect(operations).toContain('Exportar CSV');
  expect(operationsGuard).toContain('.team-order-lock.danger');
});

test('pagos, cortes e inventario requieren confirmación especial', async () => {
  expect(operations).toContain('Confirmar pago');
  expect(operations).toContain('Confirmar ajuste de inventario');
  expect(operations).toContain('Confirmar movimiento de caja');
  expect(operations).toContain('Confirmar corte de caja');
  expect(operations).toContain('confirmInventoryImpact');
});

test('los scripts y estilos se cargan de forma estática y visible', async () => {
  const scripts = [
    'accounting-math.js', 'app-core.js', 'app-render-main.js', 'app-render-finance.js',
    'app-contacts.js', 'app-catalog.js', 'app-documents.js', 'app-finance.js', 'app-tools.js',
    'state-bridge.js', 'granular-sync-guard.js', 'team-improvements.js', 'startup-query-limit.js',
    'select-innerhtml-stability.js', 'team-operations.js', 'team-operations-ui-guard.js',
    'team-hardening.js', 'supplier-catalog.js', 'monthly-overhead.js', 'business-assistant.js', 'app.js'
  ];
  scripts.forEach(file => {
    expect(html).toContain(`<script src="${file}"></script>`);
    expect(serviceWorker).toContain(`'./${file}'`);
  });
  for (const stylesheet of ['brand-theme.css', 'advanced-features.css', 'supplier-catalog.css', 'monthly-overhead.css', 'business-assistant.css']) {
    expect(html).toContain(`<link rel="stylesheet" href="${stylesheet}">`);
    expect(serviceWorker).toContain(`'./${stylesheet}'`);
  }
  expect(app).not.toContain('loadScriptOnce');
  expect(app).not.toContain('loadStyleOnce');
  expect(serviceWorker).toContain("CACHE_NAME = 'mooreprint-v34'");
});

test('los indicadores correctos no tapan formularios móviles', async () => {
  expect(mobileFixes).toContain('.team-pending-queue[data-count="0"]{display:none!important}');
  expect(mobileFixes).toContain('#modalBackdrop:not([hidden])~.team-connection-pill');
  expect(mobileFixes).toContain('#modalBackdrop:not([hidden])~.team-pending-queue');
  expect(mobileFixes).toContain('right:auto!important');
});

test('un gasto recurrente activo aparece y genera el gasto del mes', async () => {
  expect(finance).toContain('function recurringExpenseForMonth');
  expect(finance).toContain('recurringId: item.id');
  expect(finance).toContain('queueGeneratedRecurringExpenses([generated])');
  expect(finance).toContain("navigate('recurring')");
  expect(finance).toContain('El monto mensual debe ser mayor a cero.');
  expect(renderFinance).toContain('No hay coincidencias');
  expect(renderFinance).toContain('data-label="Concepto"');
  expect(renderFinance).toContain('rows.length ? \'none\' : \'block\'');
});

test('el núcleo usa un solo motor contable', async () => {
  expect(core).toContain('const Accounting = window.MoorePrintAccountingMath');
  expect(core).toContain('function documentTotals(document) { return Accounting.documentTotals(document); }');
  expect(core).toContain('function purchaseTotals(purchase) { return Accounting.purchaseTotals(purchase); }');
  expect(core).toContain('function expenseTotals(expense) { return Accounting.expenseTotals(expense, todayISO()); }');
  expect(accountingMath).toContain('profit: netRevenue - costs');
  expect(accountingMath).toContain('credit: Math.max(0, paid - total)');
  expect(accountingMath).toContain('reversePurchaseValuation');
  expect(accountingMath).toContain('applyPurchaseValuation');
});

test('productos, proveedores y costos mensuales usan APIs explícitas', async () => {
  expect(catalog).toContain('function recommendedProductPrice(product)');
  expect(catalog).toContain('function productOverheadMarkup(product)');
  expect(contacts).toContain('window.MoorePrintSupplierCatalog');
  expect(renderMain).toContain('if (service?.render) return service.render()');
  expect(supplierCatalog).toContain('window.MoorePrintSupplierCatalog =');
  expect(monthlyOverhead).toContain('window.MoorePrintMonthlyCosts =');
  expect(monthlyOverhead).not.toContain('baseProductBreakdown');
  expect(monthlyOverhead).not.toContain('renderAll = function');
  expect(supplierCatalog).not.toContain('openSupplierModal = openSupplierModalEnhanced');
});

test('gastos y reportes concilian costos sin envolturas', async () => {
  expect(finance).toContain('includedInPricing: Boolean(form.elements.includedInPricing?.checked)');
  expect(finance).toContain('includedInPricing: Boolean(item.includedInPricing)');
  expect(renderMain).toContain('function accountingExpenseSummary');
  expect(renderFinance).toContain('expenseSummary.reconciled');
  expect(renderFinance).toContain('Accounting.productProfitRows(order)');
  expect(renderFinance).toContain('payment.date');
});

test('los archivos locales tienen respaldo completo e importación', async () => {
  expect(filesDb).toContain('async function exportBackup()');
  expect(filesDb).toContain('async function importBackup(file');
  expect(localProtection).toContain('exportFilesBackupButton');
  expect(localProtection).toContain('importFilesBackupInput');
  expect(html).toContain('Respaldar archivos adjuntos');
  expect(html).toContain('Restaurar archivos adjuntos');
});

test('MoorePrint se puede instalar como aplicación', async () => {
  expect(html).toContain('rel="manifest" href="manifest.webmanifest"');
  expect(html).toContain('rel="apple-touch-icon" href="icon-192.png"');
  expect(html).toContain('id="installAppButton"');
  expect(pwa).toContain("navigator.serviceWorker.register('./sw.js'");
  expect(pwa).toContain('beforeinstallprompt');
});

test('los avisos automáticos revisan entregas, cobros, inventario y gastos', async () => {
  expect(assistant).toContain('function buildAlerts()');
  expect(assistant).toContain('order-overdue-');
  expect(assistant).toContain('collection-');
  expect(assistant).toContain('inventory-');
  expect(assistant).toContain('expense-overdue-');
  expect(assistant).toContain('Notification.requestPermission');
  expect(assistant).toContain('showNotification');
  expect(serviceWorker).toContain("self.addEventListener('notificationclick'");
});

test('la ayuda explica los flujos principales', async () => {
  expect(assistant).toContain("'Registrar un pedido'");
  expect(assistant).toContain("'Realizar un corte de caja'");
  expect(assistant).toContain("'Crear respaldos'");
  expect(assistant).toContain("'Preparar una factura CFDI'");
  expect(assistant).toContain('helpSearch');
});

test('la preparación CFDI conserva datos fiscales sin simular timbrado', async () => {
  for (const field of ['fiscalName', 'fiscalPostalCode', 'fiscalRegime', 'cfdiUse', 'invoiceEmail']) {
    expect(contacts).toContain(field);
  }
  expect(assistant).toContain('mooreprint-cfdi-preparation');
  expect(assistant).toContain('Este archivo no es un CFDI');
  expect(assistant).toContain('No guardes aquí contraseñas');
  expect(assistant).toContain('Registrar UUID timbrado');
  expect(assistant).not.toContain('privateKey');
  expect(assistant).not.toContain('certificatePassword');
});

test('la compatibilidad heredada queda aislada y no carga scripts', async () => {
  expect(selectStability).toContain('HTMLSelectElement');
  expect(selectStability).not.toContain('createElement(\'script\')');
  expect(selectStability).not.toContain('accounting-cloud-sync.js');
  expect(stateBridge).toContain("Object.defineProperty(window, 'state'");
});

test('el indicador contempla los cuatro estados operativos', async () => {
  for (const status of ['connected', 'syncing', 'offline', 'error']) expect(improvements).toContain(`${status}:`);
  expect(improvements).toContain('Sin conexión · los cambios quedan pendientes.');
});