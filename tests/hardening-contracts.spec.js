const { test, expect } = require('@playwright/test');
const fs = require('fs');

const sql = fs.readFileSync('supabase/team-hardening.sql', 'utf8');
const hardening = fs.readFileSync('team-hardening.js', 'utf8');
const loader = fs.readFileSync('select-innerhtml-stability.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('los módulos operativos tienen permisos separados', async () => {
  const permissions = [
    'view_suppliers', 'create_suppliers', 'edit_suppliers', 'delete_suppliers',
    'view_materials', 'create_materials', 'edit_materials', 'delete_materials', 'adjust_inventory',
    'view_purchases', 'create_purchases', 'edit_purchases', 'cancel_purchases',
    'view_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses',
    'view_cash', 'create_cash_transactions', 'edit_cash_transactions', 'delete_cash_transactions',
    'register_payments', 'create_cash_closings', 'edit_cash_closings',
    'view_activity', 'export_activity', 'restore_backups'
  ];
  for (const permission of permissions) {
    expect(sql).toContain(`'${permission}'`);
    expect(hardening).toContain(`'${permission}'`);
  }
});

test('las operaciones críticas se confirman en una sola transacción idempotente', async () => {
  expect(sql).toContain('create table if not exists public.team_operation_log');
  expect(sql).toContain('create or replace function public.commit_team_batch');
  expect(sql).toContain('p_operation_id uuid');
  expect(sql).toContain("operation_kind = 'record_upsert'");
  expect(sql).toContain("operation_kind = 'order_upsert'");
  expect(sql).toContain("operation_kind = 'cash_closing_upsert'");
  expect(sql).toContain("raise exception 'CONFLICT:");
  expect(hardening).toContain("client.rpc('commit_team_batch'");
});

test('la cola sin conexión es persistente y muestra cambios pendientes', async () => {
  expect(hardening).toContain('localStorage.setItem(queueKey()');
  expect(hardening).toContain("window.addEventListener('online'");
  expect(hardening).toContain('cambio${queue.length === 1');
  expect(hardening).toContain("status === 'conflict'");
  expect(hardening).toContain('retryHardeningQueue');
});

test('los respaldos automáticos se pueden restaurar de manera completa', async () => {
  expect(sql).toContain('create or replace function public.restore_team_backup');
  expect(sql).toContain('delete from public.team_records');
  expect(sql).toContain('delete from public.branch_orders');
  expect(sql).toContain('delete from public.team_quotes');
  expect(sql).toContain('delete from public.team_customers');
  expect(hardening).toContain('Escribe RESTAURAR');
  expect(hardening).toContain("client.rpc('restore_team_backup'");
});

test('materiales, compras, gastos y cortes usan bloqueo de edición', async () => {
  expect(sql).toContain("'material', 'purchase', 'expense', 'cash_closing'");
  expect(sql).toContain("when 'material' then public.has_app_permission('edit_materials')");
  expect(sql).toContain("when 'purchase' then public.has_app_permission('edit_purchases')");
  expect(sql).toContain("when 'expense' then public.has_app_permission('edit_expenses')");
  expect(hardening).toContain("installOpenLock('openMaterialModal'");
  expect(hardening).toContain("installOpenLock('openPurchaseModal'");
  expect(hardening).toContain("installOpenLock('openExpenseModal'");
  expect(hardening).toContain('prepareCashClosingLock');
});

test('la caché carga la protección avanzada', async () => {
  expect(loader).toContain("'team-hardening.js'");
  expect(sw).toContain("'./team-hardening.js'");
  expect(sw).toContain("CACHE_NAME = 'mooreprint-v28'");
});