(function () {
  const MODULE_VERSION = '1.0.0';
  const INSTALL_MARKER = '__mpRecurringScheduleFix';
  let installed = false;
  let installAttempts = 0;

  function numberValue(value) {
    if (typeof num === 'function') return num(value);
    return Number.parseFloat(value) || 0;
  }

  function cloneValue(value) {
    if (typeof clone === 'function') return clone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function localTodayISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function monthOf(value) {
    return String(value || '').slice(0, 7);
  }

  function dueDateFor(item, key) {
    const [year, month] = String(key || '').split('-').map(Number);
    if (!year || !month) return '';
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(lastDay, Math.max(1, numberValue(item?.day) || 1));
    return `${key}-${String(day).padStart(2, '0')}`;
  }

  function occurrenceMonth(expense) {
    return expense?.recurringMonth || monthOf(expense?.dueDate || expense?.date);
  }

  function paidTotal(expense) {
    if (typeof paymentTotal === 'function') return numberValue(paymentTotal(expense));
    return (expense?.payments || []).reduce((total, payment) => total + numberValue(payment.amount), 0);
  }

  function remainingBalance(expense) {
    if (typeof expenseTotals === 'function') return Math.max(0, numberValue(expenseTotals(expense).balance));
    return Math.max(0, numberValue(expense?.amount) - paidTotal(expense));
  }

  function fullyPaid(expense) {
    return numberValue(expense?.amount) > 0 && remainingBalance(expense) <= 0.005;
  }

  function latestPaymentDate(expense) {
    return (expense?.payments || [])
      .map(payment => String(payment.date || ''))
      .filter(Boolean)
      .sort()
      .at(-1) || '';
  }

  function recurringItemFor(expense) {
    return (window.state?.recurringExpenses || []).find(item => item.id === expense?.recurringId) || null;
  }

  function existingOccurrence(item, key) {
    return (window.state?.expenses || []).find(expense =>
      expense.recurringId === item?.id && occurrenceMonth(expense) === key
    ) || null;
  }

  function markRecurringPaid(expense, paymentDate = '') {
    if (!expense?.recurringId || !fullyPaid(expense)) return null;
    const item = recurringItemFor(expense);
    if (!item) return null;
    const key = occurrenceMonth(expense);
    if (!key) return null;
    const paidOn = paymentDate || latestPaymentDate(expense) || localTodayISO();
    const changed = item.lastPaidMonth !== key || item.lastPaymentDate !== paidOn || item.lastGeneratedMonth !== key;
    item.lastPaidMonth = key;
    item.lastPaymentDate = paidOn;
    item.lastGeneratedMonth = key;
    if (changed) item.updatedAt = new Date().toISOString();
    return changed ? item : null;
  }

  function shouldGenerate(item, key, referenceDate = localTodayISO()) {
    if (!item || item.active === false) return false;
    if (item.lastPaidMonth === key) return false;
    if (existingOccurrence(item, key)) return false;
    const dueDate = dueDateFor(item, key);
    return Boolean(dueDate && dueDate <= referenceDate);
  }

  function recurringBranchIdSafe() {
    if (typeof recurringBranchId === 'function') return recurringBranchId();
    const context = window.MoorePrintBranches?.getContext?.() || {};
    const selected = context.selectedBranchId || window.MoorePrintBranches?.getSelectedBranchId?.();
    return selected && selected !== 'all' ? selected : context.branchId || '';
  }

  function createOccurrence(item, key, referenceDate = localTodayISO()) {
    if (!shouldGenerate(item, key, referenceDate)) {
      const existing = existingOccurrence(item, key);
      if (existing) {
        item.lastGeneratedMonth = key;
        markRecurringPaid(existing);
      } else if (item.lastPaidMonth === key) {
        item.lastGeneratedMonth = key;
      }
      return null;
    }

    const now = new Date().toISOString();
    const dueDate = dueDateFor(item, key);
    const expense = {
      id: typeof uid === 'function' ? uid('expense') : `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      branchId: item.branchId || recurringBranchIdSafe(),
      date: `${key}-01`,
      dueDate,
      recurringMonth: key,
      category: item.category,
      description: item.name,
      amount: numberValue(item.amount),
      notes: item.notes || '',
      recurringId: item.id,
      includedInPricing: Boolean(item.includedInPricing),
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    window.state.expenses.push(expense);
    item.lastGeneratedMonth = key;
    item.updatedAt = now;
    return expense;
  }

  function persistAndRender(render = true) {
    if (typeof persistState === 'function') persistState();
    if (render && typeof renderAll === 'function') renderAll();
  }

  function operationForRecurring(item) {
    if (!item?.id) return null;
    return {
      kind: 'record_upsert',
      action: 'save',
      entity_type: 'recurring_expense',
      entity_id: item.id,
      branch_id: item.branchId || recurringBranchIdSafe(),
      payload: cloneValue(item),
      expected_version: item.cloudVersion || null,
      created_at: item.createdAt || new Date().toISOString()
    };
  }

  function deleteOperationForExpense(expense) {
    if (!expense?.id) return null;
    return {
      kind: 'record_delete',
      entity_type: 'expense',
      entity_id: expense.id,
      branch_id: expense.branchId || recurringBranchIdSafe()
    };
  }

  function queueOperations(label, operations, targetBranch = '') {
    const clean = (operations || []).filter(Boolean);
    if (!clean.length) return;
    let attempts = 0;
    const enqueue = () => {
      attempts += 1;
      const hardening = window.MoorePrintHardening;
      const initialized = Boolean(document.querySelector('#teamPendingQueue'));
      if (hardening?.enqueue && initialized) {
        hardening.enqueue(label, clean, targetBranch || clean[0]?.branch_id || recurringBranchIdSafe());
        return;
      }
      if (attempts < 20) {
        setTimeout(enqueue, 250);
        return;
      }
      window.MoorePrintOperations?.sync?.(['recurring_expense', 'expense']);
    };
    setTimeout(enqueue, 0);
  }

  function cleanupPrematureExpenses(referenceDate = localTodayISO(), options = {}) {
    if (!window.state || !Array.isArray(window.state.expenses)) return { removed: [], updated: [] };
    const currentKey = monthOf(referenceDate);
    const removed = [];
    const updated = [];
    const kept = [];

    window.state.expenses.forEach(expense => {
      if (!expense.recurringId) {
        kept.push(expense);
        return;
      }

      const item = recurringItemFor(expense);
      const key = occurrenceMonth(expense);
      if (item && fullyPaid(expense)) {
        const changed = markRecurringPaid(expense);
        if (changed) updated.push(changed);
      }

      const dueDate = expense.dueDate || (item ? dueDateFor(item, key) : '');
      const hasPayment = paidTotal(expense) > 0.005;
      const generatedTooEarly = Boolean(
        item && key && key >= currentKey && dueDate && dueDate > referenceDate && !hasPayment
      );
      if (generatedTooEarly) {
        removed.push(expense);
        if (item?.lastGeneratedMonth === key) item.lastGeneratedMonth = '';
        return;
      }
      kept.push(expense);
    });

    if (removed.length) window.state.expenses = kept;
    if (removed.length || updated.length) {
      persistAndRender(options.render !== false);
      const operations = [
        ...updated.map(operationForRecurring),
        ...removed.map(deleteOperationForExpense)
      ];
      queueOperations('Corregir calendario de gastos recurrentes', operations, operations[0]?.branch_id || '');
    }
    return { removed, updated };
  }

  function generateDueExpenses(showMessage = true, referenceDate = localTodayISO()) {
    const key = monthOf(referenceDate);
    const generatedExpenses = (window.state?.recurringExpenses || [])
      .filter(item => item.active !== false)
      .map(item => createOccurrence(item, key, referenceDate))
      .filter(Boolean);

    persistAndRender(true);
    if (typeof queueGeneratedRecurringExpenses === 'function') queueGeneratedRecurringExpenses(generatedExpenses);
    if (showMessage && typeof showToast === 'function') {
      const generated = generatedExpenses.length;
      showToast(generated
        ? `${generated} gasto${generated === 1 ? '' : 's'} generado${generated === 1 ? '' : 's'}`
        : 'No hay gastos recurrentes pendientes cuya fecha haya llegado');
    }
    return generatedExpenses;
  }

  function wrapSavePayment() {
    const base = window.savePayment;
    if (typeof base !== 'function' || base[INSTALL_MARKER]) return;
    const wrapped = function (form) {
      const type = form?.elements?.recordType?.value || '';
      const id = form?.elements?.recordId?.value || '';
      const paymentDate = form?.elements?.date?.value || localTodayISO();
      const result = base.apply(this, arguments);
      if (result === false || type !== 'expense') return result;
      const expense = (window.state?.expenses || []).find(item => item.id === id);
      const recurring = markRecurringPaid(expense, paymentDate);
      if (recurring) {
        persistAndRender(true);
        queueOperations('Marcar gasto recurrente pagado', [operationForRecurring(recurring)], recurring.branchId || expense?.branchId || '');
      }
      return result;
    };
    wrapped[INSTALL_MARKER] = true;
    window.savePayment = wrapped;
  }

  function wrapSaveRecurring() {
    const base = window.saveRecurring;
    if (typeof base !== 'function' || base[INSTALL_MARKER]) return;
    const wrapped = function (form) {
      const id = form?.elements?.id?.value || '';
      const previous = (window.state?.recurringExpenses || []).find(item => item.id === id) || null;
      const preserved = previous ? {
        lastPaidMonth: previous.lastPaidMonth || '',
        lastPaymentDate: previous.lastPaymentDate || ''
      } : null;
      const result = base.apply(this, arguments);
      if (result === false || !preserved) return result;
      const saved = (window.state?.recurringExpenses || []).find(item => item.id === id);
      if (!saved) return result;
      saved.lastPaidMonth = saved.lastPaidMonth || preserved.lastPaidMonth;
      saved.lastPaymentDate = saved.lastPaymentDate || preserved.lastPaymentDate;
      persistAndRender(false);
      return result;
    };
    wrapped[INSTALL_MARKER] = true;
    window.saveRecurring = wrapped;
  }

  function install() {
    if (installed || window.MoorePrintRecurringScheduleFix?.version === MODULE_VERSION) return true;
    if (
      typeof window.recurringExpenseForMonth !== 'function' ||
      typeof window.generateRecurringExpenses !== 'function' ||
      typeof window.savePayment !== 'function' ||
      typeof window.saveRecurring !== 'function' ||
      !window.state
    ) return false;

    installed = true;
    window.recurringExpenseForMonth = function (item, key = monthOf(localTodayISO()), referenceDate = localTodayISO()) {
      return createOccurrence(item, key, referenceDate);
    };
    window.generateRecurringExpenses = function (showMessage = true) {
      return generateDueExpenses(showMessage, localTodayISO());
    };
    wrapSavePayment();
    wrapSaveRecurring();

    const firstCleanup = cleanupPrematureExpenses(localTodayISO(), { render: false });
    window.MoorePrintRecurringScheduleFix = {
      version: MODULE_VERSION,
      localTodayISO,
      dueDateFor,
      occurrenceMonth,
      shouldGenerate,
      createOccurrence,
      generateDueExpenses,
      cleanupPrematureExpenses,
      markRecurringPaid,
      fullyPaid,
      firstCleanup
    };

    setTimeout(() => {
      cleanupPrematureExpenses(localTodayISO());
      generateDueExpenses(false, localTodayISO());
    }, 1600);
    setTimeout(() => cleanupPrematureExpenses(localTodayISO()), 4200);
    window.addEventListener('focus', () => cleanupPrematureExpenses(localTodayISO()), { passive: true });
    return true;
  }

  function installWhenReady() {
    if (install()) return;
    installAttempts += 1;
    if (installAttempts < 80) setTimeout(installWhenReady, 50);
    else console.warn('No se pudo instalar la corrección del calendario de gastos recurrentes.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWhenReady, { once: true });
  else installWhenReady();
})();
