const { test, expect } = require('@playwright/test');
const accounting = require('../accounting-math.js');

function closeTo(actual, expected, precision = 6) {
  expect(Math.abs(actual - expected)).toBeLessThan(10 ** -precision);
}

test('el IVA no se cuenta como utilidad y el saldo a favor se separa', async () => {
  const record = {
    items: [
      {
        name: 'Trabajo',
        qty: 2,
        price: 100,
        cost: 40,
        recipe: [{ kind: 'cost_breakdown', overheadCost: 10, variableCost: 30 }]
      }
    ],
    discount: 20,
    taxPercent: 16,
    deliveryCharge: 30,
    deliveryCost: 10,
    payments: [{ amount: 250 }]
  };

  const totals = accounting.documentTotals(record);
  closeTo(totals.subtotal, 200);
  closeTo(totals.discount, 20);
  closeTo(totals.taxable, 180);
  closeTo(totals.tax, 28.8);
  closeTo(totals.netRevenue, 210);
  closeTo(totals.total, 238.8);
  closeTo(totals.costs, 90);
  closeTo(totals.allocatedOverhead, 20);
  closeTo(totals.variableCosts, 70);
  closeTo(totals.profit, 120);
  closeTo(totals.balance, 0);
  closeTo(totals.credit, 11.2);
});

test('compras y gastos conservan pagos excedentes como saldo a favor', async () => {
  const purchase = accounting.purchaseTotals({
    items: [{ qty: 4, unitCost: 25 }],
    payments: [{ amount: 115 }]
  });
  expect(purchase).toEqual({ total: 100, paid: 115, balance: 0, credit: 15 });

  const expense = accounting.expenseTotals({
    amount: 80,
    dueDate: '2026-07-01',
    payments: [{ amount: 100 }]
  }, '2026-07-12');
  expect(expense.total).toBe(80);
  expect(expense.balance).toBe(0);
  expect(expense.credit).toBe(20);
  expect(expense.status).toBe('saldo_a_favor');
});

test('el costo promedio ponderado se aplica y se revierte correctamente', async () => {
  const applied = accounting.applyPurchaseValuation(
    { stock: 10, unitCost: 10 },
    { qty: 10, unitCost: 20 }
  );
  expect(applied.stock).toBe(20);
  expect(applied.unitCost).toBe(15);
  expect(applied.addedValue).toBe(200);

  const reversedLatest = accounting.reversePurchaseValuation(
    { stock: 15, unitCost: 15 },
    { qty: 10, unitCost: 20 },
    { exactBeforeCost: 10 }
  );
  expect(reversedLatest.stock).toBe(5);
  expect(reversedLatest.unitCost).toBe(10);
  expect(reversedLatest.valuationWarning).toBe(false);

  const reversedHistorical = accounting.reversePurchaseValuation(
    { stock: 20, unitCost: 15 },
    { qty: 5, unitCost: 20 }
  );
  expect(reversedHistorical.stock).toBe(15);
  closeTo(reversedHistorical.unitCost, 200 / 15);
  expect(reversedHistorical.valuationWarning).toBe(false);
});

test('la utilidad por producto reparte el descuento y excluye IVA', async () => {
  const order = {
    items: [
      { name: 'Producto A', qty: 1, price: 100, cost: 50, recipe: [] },
      { name: 'Producto B', qty: 1, price: 300, cost: 100, recipe: [] }
    ],
    discount: 40,
    taxPercent: 16,
    payments: []
  };

  const rows = accounting.productProfitRows(order);
  expect(rows).toHaveLength(2);
  closeTo(rows[0].discountShare, 10);
  closeTo(rows[0].netRevenue, 90);
  closeTo(rows[0].profit, 40);
  closeTo(rows[1].discountShare, 30);
  closeTo(rows[1].netRevenue, 270);
  closeTo(rows[1].profit, 170);
  closeTo(rows.reduce((total, row) => total + row.profit, 0), 210);
  closeTo(accounting.documentTotals(order).profit, 210);
});

test('el efectivo se mantiene separado de transferencias, tarjetas y crédito', async () => {
  const balances = accounting.balancesByMethod([
    { id: 'opening', type: 'entrada', method: 'efectivo', amount: 100 },
    { id: 'one', type: 'entrada', method: 'efectivo', amount: 50 },
    { id: 'two', type: 'salida', method: 'efectivo', amount: 20 },
    { id: 'three', type: 'entrada', method: 'transferencia', amount: 200 },
    { id: 'four', type: 'entrada', method: 'tarjeta', amount: 90 },
    { id: 'five', type: 'entrada', method: 'credito', amount: 30 }
  ], 100);

  expect(balances.efectivo).toBe(130);
  expect(balances.transferencia).toBe(200);
  expect(balances.tarjeta).toBe(90);
  expect(balances.credito).toBe(30);
});

test('las líneas repetidas de una compra se agrupan por material', async () => {
  const rows = accounting.aggregatePurchaseItems([
    { materialId: 'm1', qty: 2, unitCost: 10 },
    { materialId: 'm1', qty: 3, unitCost: 20 },
    { materialId: 'm2', qty: 1, unitCost: 7 }
  ]);
  const m1 = rows.find(row => row.materialId === 'm1');
  expect(m1.qty).toBe(5);
  expect(m1.value).toBe(80);
  expect(m1.unitCost).toBe(16);
});