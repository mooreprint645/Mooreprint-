const { test, expect } = require('@playwright/test');
const fs = require('fs');

const sql = fs.readFileSync('supabase/team-improvements.sql', 'utf8');
const syncSql = fs.readFileSync('supabase/team-improvements-sync.sql', 'utf8');
const operationsSql = fs.readFileSync('supabase/team-operations.sql', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const improvements = fs.readFileSync('team-improvements.js', 'utf8');
const operations = fs.readFileSync('team-operations.js', 'utf8');
const operationsGuard = fs.readFileSync('team-operations-ui-guard.js', 'utf8');
const startupLimit = fs.readFileSync('startup-query-limit.js', 'utf8');
const selectStability = fs.readFileSync('select-innerhtml-stability.js', 'utf8');
const stateBridge = fs.readFileSync('state-bridge.js', 'utf8');
const syncGuard = fs.readFileSync('granular-sync-guard.js', 'utf8');

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
  expect(operationsSql).toContain("current_app_role() <> 'owner'");
  expect(operations).toContain('Editar de todos modos');
  expect(operations).toContain('Exportar CSV');
  expect(operations).toContain('Errores internos');
  expect(operationsGuard).toContain('.team-order-lock.danger');
  expect(operationsGuard).toContain('aria-disabled');
});

test('pagos, cortes e inventario requieren confirmación especial', async () => {
  expect(operations).toContain('Confirmar pago');
  expect(operations).toContain('Confirmar ajuste de inventario');
  expect(operations).toContain('Confirmar movimiento de caja');
  expect(operations).toContain('Confirmar corte de caja');
  expect(operations).toContain('confirmInventoryImpact');
});

test('la aplicación y la caché cargan todos los módulos nuevos', async () => {
  for (const file of ['state-bridge.js', 'granular-sync-guard.js', 'team-improvements.js', 'startup-query-limit.js', 'select-innerhtml-stability.js', 'team-operations.js']) {
    expect(app).toContain(`loadScriptOnce('${file}')`);
    expect(serviceWorker).toContain(`'./${file}'`);
  }
  expect(selectStability).toContain('team-operations-ui-guard.js');
  expect(selectStability).toContain('team-hardening.js');
  expect(serviceWorker).toContain("'./team-operations-ui-guard.js'");
  expect(serviceWorker).toContain("'./team-hardening.js'");
  expect(serviceWorker).toContain("CACHE_NAME = 'mooreprint-v27'");
  expect(selectStability).toContain('HTMLSelectElement');
  expect(stateBridge).toContain("Object.defineProperty(window, 'state'");
});

test('el indicador contempla los cuatro estados operativos', async () => {
  for (const state of ['connected', 'syncing', 'offline', 'error']) {
    expect(improvements).toContain(`${state}:`);
  }
  expect(improvements).toContain('Sin conexión · los cambios quedan pendientes.');
});
