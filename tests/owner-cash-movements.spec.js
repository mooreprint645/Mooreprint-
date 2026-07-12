const { test, expect } = require('@playwright/test');
const fs = require('fs');

const finance = fs.readFileSync('app-finance.js', 'utf8');
const renderFinance = fs.readFileSync('app-render-finance.js', 'utf8');

test('los retiros y gastos personales reducen caja sin alterar la utilidad', async () => {
  expect(finance).toContain("owner_withdrawal: {");
  expect(finance).toContain("non_operating_expense: {");
  expect(finance).toContain("label: 'Retiro del propietario'");
  expect(finance).toContain("label: 'Gasto personal o no operativo'");
  expect(finance).toContain("type: 'salida'");
  expect(finance).toContain('affectsProfit: false');
  expect(finance).toContain('affectsOperatingExpenses: false');
  expect(finance).toContain('Estos movimientos cambian el saldo de caja o banco');
});

test('las aportaciones y ajustes quedan separados de ventas y gastos operativos', async () => {
  expect(finance).toContain("owner_contribution: {");
  expect(finance).toContain("cash_adjustment_in: {");
  expect(finance).toContain("cash_adjustment_out: {");
  expect(finance).toContain("other_income: {");
  expect(finance).toContain("other_outflow: {");
  expect(finance).toContain('movementKind: data.movementKind');
  expect(finance).toContain('movementLabel: definition.label');
  expect(finance).toContain('description: `${definition.label}: ${detail}`');
});

test('el flujo de caja incluye movimientos manuales pero la utilidad usa solo pedidos y gastos', async () => {
  expect(renderFinance).toContain("const entries = cashEntries().filter(entry => entry.id !== 'opening'");
  expect(renderFinance).toContain('const cashFlow = sum(entries');
  expect(renderFinance).toContain('const expenses = state.expenses.filter');
  expect(renderFinance).toContain('const net = sales - costs - operating');
  expect(renderFinance).not.toContain('state.cashTransactions.reduce((total, transaction) => total -');
});
