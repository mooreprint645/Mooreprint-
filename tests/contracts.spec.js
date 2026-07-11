const { test, expect } = require('@playwright/test');
const fs = require('fs');

const sql = fs.readFileSync('supabase/team-improvements.sql', 'utf8');
const syncSql = fs.readFileSync('supabase/team-improvements-sync.sql', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const improvements = fs.readFileSync('team-improvements.js', 'utf8');
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

test('la paginación limita cada consulta a 50 registros', async () => {
  expect(sql).toContain('create or replace function public.page_team_customers');
  expect(sql).toContain('create or replace function public.page_team_quotes');
  expect(sql).toContain('safe_limit integer := least');
  expect(improvements).toContain('const PAGE_SIZE = 50');
  expect(improvements).toContain('p_offset: pages.customers.page * PAGE_SIZE');
  expect(improvements).toContain('p_offset: pages.quotes.page * PAGE_SIZE');
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

test('la aplicación y la caché cargan los módulos nuevos', async () => {
  expect(app).toContain("loadScriptOnce('state-bridge.js')");
  expect(app).toContain("loadScriptOnce('granular-sync-guard.js')");
  expect(app).toContain("loadScriptOnce('team-improvements.js')");
  expect(serviceWorker).toContain("'./state-bridge.js'");
  expect(serviceWorker).toContain("'./granular-sync-guard.js'");
  expect(serviceWorker).toContain("'./team-improvements.js'");
  expect(serviceWorker).toContain("CACHE_NAME = 'mooreprint-v23'");
  expect(stateBridge).toContain("Object.defineProperty(window, 'state'");
});

test('el indicador contempla los cuatro estados operativos', async () => {
  for (const state of ['connected', 'syncing', 'offline', 'error']) {
    expect(improvements).toContain(`${state}:`);
  }
  expect(improvements).toContain('Sin conexión · los cambios quedan pendientes.');
});
