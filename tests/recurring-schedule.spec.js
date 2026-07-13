const { test, expect } = require('@playwright/test');
const fs = require('fs');

const script = fs.readFileSync('recurring-schedule-fix.js', 'utf8');

async function prepare(page, state) {
  await page.setContent('<!doctype html><html><head></head><body><button id="teamPendingQueue"></button></body></html>');
  await page.evaluate(initialState => {
    window.state = initialState;
    window.num = value => Number.parseFloat(value) || 0;
    window.clone = value => JSON.parse(JSON.stringify(value));
    window.uid = prefix => `${prefix}-${Math.random().toString(16).slice(2)}`;
    window.paymentTotal = record => (record.payments || []).reduce((total, payment) => total + (Number.parseFloat(payment.amount) || 0), 0);
    window.expenseTotals = record => {
      const paid = window.paymentTotal(record);
      const total = Number.parseFloat(record.amount) || 0;
      return { total, paid, balance: Math.max(0, total - paid), credit: Math.max(0, paid - total) };
    };
    window.persistState = () => { window.persistCalls = (window.persistCalls || 0) + 1; };
    window.renderAll = () => { window.renderCalls = (window.renderCalls || 0) + 1; };
    window.showToast = message => { window.lastToast = message; };
    window.queueGeneratedRecurringExpenses = rows => { window.generatedQueue = rows; };
    window.recurringBranchId = () => 'branch-1';
    window.recurringExpenseForMonth = () => null;
    window.generateRecurringExpenses = () => [];
    window.saveRecurring = () => undefined;
    window.savePayment = form => {
      const id = form.elements.recordId.value;
      const expense = window.state.expenses.find(item => item.id === id);
      expense.payments.push({
        id: 'pay-test',
        date: form.elements.date.value,
        amount: Number.parseFloat(form.elements.amount.value) || 0,
        method: 'efectivo'
      });
    };
    window.MoorePrintHardening = {
      enqueue: (label, operations) => { window.enqueued = { label, operations }; }
    };
  }, state);
  await page.addScriptTag({ content: script });
  await page.waitForFunction(() => Boolean(window.MoorePrintRecurringScheduleFix));
}

test('no genera el gasto antes del día configurado y sí lo genera al llegar la fecha', async ({ page }) => {
  await prepare(page, {
    recurringExpenses: [{
      id: 'rec-1', name: 'Internet', category: 'servicios', amount: 500,
      day: 20, active: true, payments: []
    }],
    expenses: []
  });

  const result = await page.evaluate(() => {
    const api = window.MoorePrintRecurringScheduleFix;
    const item = window.state.recurringExpenses[0];
    const before = api.createOccurrence(item, '2026-07', '2026-07-12');
    const onDate = api.createOccurrence(item, '2026-07', '2026-07-20');
    return {
      before,
      onDate,
      count: window.state.expenses.length,
      dueDate: window.state.expenses[0]?.dueDate,
      recurringMonth: window.state.expenses[0]?.recurringMonth
    };
  });

  expect(result.before).toBeNull();
  expect(result.onDate).toBeTruthy();
  expect(result.count).toBe(1);
  expect(result.dueDate).toBe('2026-07-20');
  expect(result.recurringMonth).toBe('2026-07');
});

test('elimina una aparición anticipada sin pagos pero conserva una ya pagada', async ({ page }) => {
  await prepare(page, {
    recurringExpenses: [
      { id: 'rec-unpaid', name: 'Renta', category: 'renta_local', amount: 3000, day: 25, active: true },
      { id: 'rec-paid', name: 'Teléfono', category: 'servicios', amount: 400, day: 25, active: true }
    ],
    expenses: [
      {
        id: 'expense-unpaid', recurringId: 'rec-unpaid', recurringMonth: '2099-07',
        date: '2099-07-01', dueDate: '2099-07-25', amount: 3000, payments: []
      },
      {
        id: 'expense-paid', recurringId: 'rec-paid', recurringMonth: '2099-07',
        date: '2099-07-01', dueDate: '2099-07-25', amount: 400,
        payments: [{ id: 'pay-1', date: '2099-07-10', amount: 400 }]
      }
    ]
  });

  const result = await page.evaluate(() => {
    const cleanup = window.MoorePrintRecurringScheduleFix.firstCleanup;
    return {
      removed: cleanup.removed.map(item => item.id),
      remaining: window.state.expenses.map(item => item.id),
      paidMonth: window.state.recurringExpenses.find(item => item.id === 'rec-paid').lastPaidMonth,
      paymentDate: window.state.recurringExpenses.find(item => item.id === 'rec-paid').lastPaymentDate
    };
  });

  expect(result.removed).toEqual(['expense-unpaid']);
  expect(result.remaining).toEqual(['expense-paid']);
  expect(result.paidMonth).toBe('2099-07');
  expect(result.paymentDate).toBe('2099-07-10');
});

test('al liquidar un gasto recurrente marca el mes como pagado y evita regenerarlo', async ({ page }) => {
  await prepare(page, {
    recurringExpenses: [{
      id: 'rec-1', name: 'Suscripción', category: 'servicios', amount: 250,
      day: 5, active: true, lastPaidMonth: ''
    }],
    expenses: [{
      id: 'expense-1', recurringId: 'rec-1', recurringMonth: '2026-07',
      date: '2026-07-01', dueDate: '2026-07-05', amount: 250, payments: []
    }]
  });

  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', `<form id="paymentForm">
      <input name="recordType" value="expense">
      <input name="recordId" value="expense-1">
      <input name="date" value="2026-07-04">
      <input name="amount" value="250">
    </form>`);
    window.savePayment(document.querySelector('#paymentForm'));
  });
  await page.waitForFunction(() => Boolean(window.enqueued));

  const result = await page.evaluate(() => {
    const recurring = window.state.recurringExpenses[0];
    const generated = window.MoorePrintRecurringScheduleFix.createOccurrence(recurring, '2026-07', '2026-07-20');
    return {
      paidMonth: recurring.lastPaidMonth,
      paymentDate: recurring.lastPaymentDate,
      generated,
      expenseCount: window.state.expenses.length,
      queuedType: window.enqueued?.operations?.[0]?.entity_type
    };
  });

  expect(result.paidMonth).toBe('2026-07');
  expect(result.paymentDate).toBe('2026-07-04');
  expect(result.generated).toBeNull();
  expect(result.expenseCount).toBe(1);
  expect(result.queuedType).toBe('recurring_expense');
});
