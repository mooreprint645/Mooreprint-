(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MoorePrintAccountingMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const number = value => Number.parseFloat(value) || 0;
  const sum = (items, getter) => (items || []).reduce((total, item) => total + getter(item), 0);

  function paymentTotal(record) {
    return sum(record?.payments, payment => number(payment?.amount));
  }

  function itemCostMetadata(item) {
    const metadata = (item?.recipe || []).find(row => row && row.kind === 'cost_breakdown');
    const totalCost = number(item?.cost);
    const overhead = Math.max(0, Math.min(totalCost, number(metadata?.overheadCost)));
    const variableCost = metadata && Number.isFinite(Number(metadata.variableCost))
      ? Math.max(0, number(metadata.variableCost))
      : Math.max(0, totalCost - overhead);
    return {
      overhead,
      variableCost,
      totalCost,
      capturedAt: metadata?.capturedAt || '',
      pricingMonth: metadata?.pricingMonth || ''
    };
  }

  function documentTotals(document) {
    const subtotal = sum(document?.items, item => number(item?.qty) * number(item?.price));
    const discount = Math.min(subtotal, Math.max(0, number(document?.discount)));
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * Math.max(0, number(document?.taxPercent)) / 100;
    const deliveryRevenue = Math.max(0, number(document?.deliveryCharge));
    const netRevenue = taxable + deliveryRevenue;
    const total = netRevenue + tax;
    const itemCosts = sum(document?.items, item => number(item?.qty) * number(item?.cost));
    const deliveryCost = Math.max(0, number(document?.deliveryCost));
    const costs = itemCosts + deliveryCost;
    const allocatedOverhead = sum(document?.items, item => number(item?.qty) * itemCostMetadata(item).overhead);
    const variableCosts = Math.max(0, costs - allocatedOverhead);
    const paid = paymentTotal(document);
    const balance = Math.max(0, total - paid);
    const credit = Math.max(0, paid - total);
    return {
      subtotal,
      discount,
      taxable,
      tax,
      deliveryRevenue,
      netRevenue,
      total,
      costs,
      variableCosts,
      allocatedOverhead,
      profit: netRevenue - costs,
      paid,
      balance,
      credit
    };
  }

  function purchaseTotals(purchase) {
    const total = sum(purchase?.items, item => number(item?.qty) * number(item?.unitCost));
    const paid = paymentTotal(purchase);
    return {
      total,
      paid,
      balance: Math.max(0, total - paid),
      credit: Math.max(0, paid - total)
    };
  }

  function expenseTotals(expense, today) {
    const total = Math.max(0, number(expense?.amount));
    const paid = paymentTotal(expense);
    const balance = Math.max(0, total - paid);
    const credit = Math.max(0, paid - total);
    let status = 'pendiente';
    if (credit > 0) status = 'saldo_a_favor';
    else if (paid >= total && total > 0) status = 'pagado';
    else if (paid > 0) status = 'parcial';
    else if (expense?.dueDate && today && expense.dueDate < today) status = 'vencido';
    return { total, paid, balance, credit, status };
  }

  function aggregatePurchaseItems(items) {
    const grouped = new Map();
    (items || []).forEach(item => {
      if (!item?.materialId) return;
      const current = grouped.get(item.materialId) || { materialId: item.materialId, qty: 0, value: 0 };
      const qty = Math.max(0, number(item.qty));
      current.qty += qty;
      current.value += qty * Math.max(0, number(item.unitCost));
      grouped.set(item.materialId, current);
    });
    return [...grouped.values()].map(row => ({
      ...row,
      unitCost: row.qty > 0 ? row.value / row.qty : 0
    }));
  }

  function reversePurchaseValuation(material, purchaseLine, options = {}) {
    const stock = number(material?.stock);
    const currentUnitCost = Math.max(0, number(material?.unitCost));
    const qty = Math.max(0, number(purchaseLine?.qty));
    const purchaseUnitCost = Math.max(0, number(purchaseLine?.unitCost));
    const nextStock = stock - qty;
    const exactBeforeCost = options.exactBeforeCost;
    let nextUnitCost = currentUnitCost;
    let valuationWarning = false;

    if (Number.isFinite(Number(exactBeforeCost))) {
      nextUnitCost = Math.max(0, number(exactBeforeCost));
    } else if (nextStock > 0) {
      const remainingValue = stock * currentUnitCost - qty * purchaseUnitCost;
      if (remainingValue >= -0.005) nextUnitCost = Math.max(0, remainingValue / nextStock);
      else valuationWarning = true;
    } else if (nextStock === 0) {
      nextUnitCost = currentUnitCost;
    } else {
      valuationWarning = true;
    }

    return {
      stock: nextStock,
      unitCost: nextUnitCost,
      removedValue: qty * purchaseUnitCost,
      valuationWarning
    };
  }

  function applyPurchaseValuation(material, purchaseLine) {
    const stock = number(material?.stock);
    const currentUnitCost = Math.max(0, number(material?.unitCost));
    const qty = Math.max(0, number(purchaseLine?.qty));
    const purchaseUnitCost = Math.max(0, number(purchaseLine?.unitCost));
    const nextStock = stock + qty;
    const nextUnitCost = nextStock > 0
      ? Math.max(0, (stock * currentUnitCost + qty * purchaseUnitCost) / nextStock)
      : currentUnitCost;
    return {
      stock: nextStock,
      unitCost: nextUnitCost,
      addedValue: qty * purchaseUnitCost
    };
  }

  function productProfitRows(order) {
    const totals = documentTotals(order);
    const subtotal = totals.subtotal;
    return (order?.items || []).map(item => {
      const grossRevenue = number(item?.qty) * number(item?.price);
      const discountShare = subtotal > 0 ? totals.discount * grossRevenue / subtotal : 0;
      const netRevenue = Math.max(0, grossRevenue - discountShare);
      const cost = number(item?.qty) * number(item?.cost);
      return {
        name: item?.name || 'Sin nombre',
        quantity: number(item?.qty),
        grossRevenue,
        discountShare,
        netRevenue,
        cost,
        profit: netRevenue - cost
      };
    });
  }

  function balancesByMethod(entries, openingCash = 0) {
    const balances = { efectivo: number(openingCash) };
    (entries || []).forEach(entry => {
      if (entry?.id === 'opening') return;
      const method = entry?.method || 'otro';
      balances[method] = number(balances[method]) + (entry?.type === 'entrada' ? number(entry.amount) : -number(entry.amount));
    });
    return balances;
  }

  return {
    number,
    paymentTotal,
    itemCostMetadata,
    documentTotals,
    purchaseTotals,
    expenseTotals,
    aggregatePurchaseItems,
    reversePurchaseValuation,
    applyPurchaseValuation,
    productProfitRows,
    balancesByMethod
  };
});