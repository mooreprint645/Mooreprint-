(function loadBrandTheme() {
  if (document.querySelector('link[href="brand-theme.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'brand-theme.css';
  document.head.appendChild(link);
})();

function loadStyleOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else existing.addEventListener('load', resolve, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

async function loadAdvancedFeatures() {
  loadStyleOnce('advanced-features.css');
  await loadScriptOnce('advanced-fixes.js');
  await loadScriptOnce('advanced-features.js');
  if (window.MoorePrintAdvanced) await window.MoorePrintAdvanced.init();
  await loadScriptOnce('performance-fixes.js');
  window.MoorePrintPerformance?.init?.();
  await loadScriptOnce('team-workflow.js');
  window.MoorePrintTeamWorkflow?.init?.();
  await loadScriptOnce('team-improvements.js');
  window.MoorePrintTeamImprovements?.init?.();
}

async function loadSupabaseCloud() {
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  await loadScriptOnce('supabase-config.js');
  await loadScriptOnce('supabase-cloud.js');
  if (window.MoorePrintCloud) await window.MoorePrintCloud.init();
}

function applyBrandIdentity() {
  const brand = $('.brand');
  if (!brand) return;
  brand.innerHTML = `
    <div class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img" aria-label="Panda MoorePrint">
        <circle cx="25" cy="25" r="17" fill="#050505"/>
        <circle cx="75" cy="25" r="17" fill="#050505"/>
        <ellipse cx="50" cy="53" rx="40" ry="39" fill="#efefed"/>
        <ellipse cx="34" cy="49" rx="12" ry="16" transform="rotate(28 34 49)" fill="#050505"/>
        <ellipse cx="66" cy="49" rx="12" ry="16" transform="rotate(-28 66 49)" fill="#050505"/>
        <circle cx="36" cy="48" r="4" fill="#efefed"/>
        <circle cx="64" cy="48" r="4" fill="#efefed"/>
        <circle cx="36" cy="48" r="2" fill="#050505"/>
        <circle cx="64" cy="48" r="2" fill="#050505"/>
        <ellipse cx="50" cy="65" rx="7" ry="5" fill="#050505"/>
        <path d="M50 69 C48 77 38 78 34 72 M50 69 C52 77 62 78 66 72" fill="none" stroke="#050505" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M40 82 C46 86 54 86 60 82" fill="none" stroke="#050505" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="brand-copy">
      <strong><span class="brand-moore">MOORE</span><span class="brand-print">PRINT</span></strong>
      <span>IMPRESIÓN Y DISEÑO</span>
    </div>`;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = '#050505';
}

function setupEvents() {
  $$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  const inputRenderers = {
    orderSearch: renderOrders, quoteSearch: renderQuotes, customerSearch: renderCustomers, productSearch: renderProducts,
    materialSearch: renderInventory, supplierSearch: renderSuppliers, purchaseSearch: renderPurchases,
    expenseSearch: renderExpenses, recurringSearch: renderRecurring, cashSearch: renderCash
  };
  Object.entries(inputRenderers).forEach(([id, renderer]) => $(`#${id}`).addEventListener('input', renderer));
  const selectRenderers = { orderStatusFilter: renderOrders, quoteStatusFilter: renderQuotes, stockFilter: renderInventory, expenseCategoryFilter: renderExpenses, cashTypeFilter: renderCash, dashboardPeriod: renderDashboard };
  Object.entries(selectRenderers).forEach(([id, renderer]) => $(`#${id}`).addEventListener('change', renderer));
  $('#reportFrom').addEventListener('change', renderReports); $('#reportTo').addEventListener('change', renderReports); $('#applyReportButton').addEventListener('click', renderReports);

  $('#quickOrderButton').addEventListener('click', () => { navigate('orders'); openOrderModal(); });
  $('#newOrderButton').addEventListener('click', () => openOrderModal()); $('#newQuoteButton').addEventListener('click', () => openQuoteModal()); $('#newCustomerButton').addEventListener('click', () => openCustomerModal()); $('#newProductButton').addEventListener('click', () => openProductModal()); $('#newMaterialButton').addEventListener('click', () => openMaterialModal()); $('#inventoryAdjustmentButton').addEventListener('click', () => openInventoryAdjustment()); $('#newSupplierButton').addEventListener('click', () => openSupplierModal()); $('#newPurchaseButton').addEventListener('click', () => openPurchaseModal()); $('#newExpenseButton').addEventListener('click', () => openExpenseModal()); $('#newRecurringButton').addEventListener('click', () => openRecurringModal()); $('#newCashTransactionButton').addEventListener('click', openCashTransactionModal); $('#cashClosingButton').addEventListener('click', openCashClosing);
  $('#generateRecurringButton').addEventListener('click', () => generateRecurringExpenses(true)); $('#loadExamplesButton').addEventListener('click', loadExamples);
  $('#backupButton').addEventListener('click', exportBackup); $('#exportBackupButton').addEventListener('click', exportBackup); $('#exportCsvButton').addEventListener('click', exportReportCsv); $('#exportAllCsvButton').addEventListener('click', exportAllCsv);
  $('#importBackupInput').addEventListener('change', event => { const file = event.target.files[0]; if (file) importBackup(file); event.target.value = ''; });
  $('#businessForm').addEventListener('submit', event => { event.preventDefault(); state.business = { ...state.business, ...Object.fromEntries(new FormData(event.target)), openingCash: num(event.target.elements.openingCash.value), monthlyHours: num(event.target.elements.monthlyHours.value) }; saveState('Datos del negocio guardados'); });
  $('#clearDataButton').addEventListener('click', () => openModal('Borrar todos los datos', '<p>Se eliminarán clientes, proveedores, inventario, pedidos, cotizaciones, compras, gastos y caja de este navegador. Descarga un respaldo antes de continuar.</p>', '<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" id="confirmClearData">Borrar todo</button>'));

  document.addEventListener('click', async event => {
    const target = event.target.closest('button,[data-close-modal]'); if (!target) return;
    if (target.matches('[data-close-modal]')) { closeModal(); return; }
    if (target.dataset.go) { navigate(target.dataset.go); return; }

    const openActions = [
      ['editCustomer', openCustomerModal], ['viewCustomer', openCustomerHistory], ['editSupplier', openSupplierModal], ['viewSupplier', openSupplierHistory],
      ['editMaterial', openMaterialModal], ['adjustMaterial', openInventoryAdjustment], ['editProduct', openProductModal], ['editOrder', openOrderModal],
      ['viewOrder', id => previewDocument('order', id)], ['payOrder', id => openPaymentModal('order', id)], ['editQuote', openQuoteModal],
      ['viewQuote', id => previewDocument('quote', id)], ['convertQuote', id => openOrderModal('', id)], ['editPurchase', openPurchaseModal],
      ['payPurchase', id => openPaymentModal('purchase', id)], ['editExpense', openExpenseModal], ['payExpense', id => openPaymentModal('expense', id)], ['editRecurring', openRecurringModal]
    ];
    for (const [key, handler] of openActions) if (target.dataset[key]) { handler(target.dataset[key]); return; }

    const deleteActions = [
      ['deleteCustomer','customer','cliente'],['deleteSupplier','supplier','proveedor'],['deleteMaterial','material','material'],['deleteProduct','product','producto'],
      ['deleteOrder','order','pedido'],['deleteQuote','quote','cotización'],['deletePurchase','purchase','compra'],['deleteExpense','expense','gasto'],['deleteRecurring','recurring','gasto recurrente']
    ];
    for (const [key,type,label] of deleteActions) if (target.dataset[key]) { confirmDelete(type, target.dataset[key], label); return; }
    if (target.dataset.confirmDelete) { performDelete(target.dataset.confirmDelete, target.dataset.id); return; }

    if (target.dataset.toggleRecurring) { const item = state.recurringExpenses.find(row => row.id === target.dataset.toggleRecurring); if (item) { item.active = item.active === false; saveState(item.active ? 'Gasto recurrente activado' : 'Gasto recurrente pausado'); } return; }

    if (target.id === 'addDocumentLine') { $('#documentLines').insertAdjacentHTML('beforeend', documentLineRow({ qty: 1 })); updateDocumentPreview(); return; }
    if (target.id === 'addRecipeRow') { $('#recipeRows').insertAdjacentHTML('beforeend', recipeRow({ qty: 1 })); updateProductCostPreview(); return; }
    if (target.id === 'addPurchaseRow') { $('#purchaseRows').insertAdjacentHTML('beforeend', purchaseRow({ qty: 1 })); updatePurchasePreview(); return; }
    if (target.classList.contains('remove-row')) {
      const row = target.closest('.line-row'); const container = row.parentElement;
      if (container.id === 'documentLines' && container.children.length === 1) { showToast('Debe existir al menos un concepto', 'warning'); return; }
      row.remove(); updateDocumentPreview(); updateProductCostPreview(); updatePurchasePreview(); return;
    }
    if (target.id === 'printDocumentButton') { window.print(); return; }
    if (target.id === 'confirmClearData') { state = clone(defaultState); if (window.FileDB?.clearAll) await FileDB.clearAll().catch(() => {}); closeModal(true); saveState('Todos los datos fueron eliminados'); return; }
    if (target.classList.contains('tab-button')) { const modal = target.closest('.modal-body'); $$('.tab-button', modal).forEach(button => button.classList.toggle('active', button === target)); $$('.tab-pane', modal).forEach(pane => pane.classList.toggle('active', pane.id === target.dataset.tab)); }
  });

  document.addEventListener('change', event => {
    const element = event.target;
    if (element.id === 'orderCustomerSelect' || element.id === 'quoteCustomerSelect') {
      const form = element.form; const customer = state.customers.find(item => item.id === element.value); if (customer) { form.elements.customer.value = customer.name; form.elements.phone.value = customer.phone || ''; }
    }
    if (element.classList.contains('line-product')) {
      const row = element.closest('.document-line'); const snapshot = selectedProductSnapshot(element.value); if (snapshot) { $('.line-name', row).value = snapshot.name; $('.line-price', row).value = snapshot.price; $('.line-cost', row).value = snapshot.cost.toFixed(2); row.dataset.recipe = JSON.stringify(snapshot.recipe); } else row.dataset.recipe = '[]'; updateDocumentPreview();
    }
    if (element.classList.contains('purchase-material')) { const material = state.materials.find(item => item.id === element.value); if (material) $('.purchase-cost', element.closest('.line-row')).value = num(material.unitCost); updatePurchasePreview(); }
    if (element.classList.contains('recipe-material')) updateProductCostPreview();
  });

  document.addEventListener('input', event => {
    if (event.target.matches('.line-qty,.line-price,.line-cost,.doc-total-input')) updateDocumentPreview();
    if (event.target.matches('.product-cost-input,.recipe-qty')) updateProductCostPreview();
    if (event.target.matches('.purchase-qty,.purchase-cost')) updatePurchasePreview();
  });

  document.addEventListener('submit', event => {
    const handlers = { customerForm: saveCustomer, supplierForm: saveSupplier, materialForm: saveMaterial, adjustmentForm: saveAdjustment, productForm: saveProduct, orderForm: saveOrder, quoteForm: saveQuote, purchaseForm: savePurchase, expenseForm: saveExpense, recurringForm: saveRecurring, paymentForm: savePayment, cashTransactionForm: saveCashTransaction };
    const handler = handlers[event.target.id]; if (handler) { event.preventDefault(); handler(event.target); }
  });

  $('#modalBackdrop').addEventListener('click', event => { if (event.target === event.currentTarget) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal(); });
}

async function init() {
  applyBrandIdentity();
  $('#todayLabel').textContent = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  try { await loadAdvancedFeatures(); }
  catch (error) { console.warn('No se pudieron cargar algunas funciones avanzadas.', error); }
  setupEvents(); generateRecurringExpenses(false); renderAll();
  const requestedSection = location.hash.replace('#','');
  if (requestedSection && document.getElementById(requestedSection)) navigate(requestedSection);
  try { await loadSupabaseCloud(); }
  catch (error) { console.warn('Supabase no está disponible; MoorePrint continúa en modo local.', error); }
}

document.addEventListener('DOMContentLoaded', init);
