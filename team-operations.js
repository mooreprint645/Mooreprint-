(function () {
  const PAGE_SIZE = 50;
  const ALL_RECORD_TYPES = [
    'supplier',
    'material',
    'purchase',
    'expense',
    'recurring_expense',
    'cash_transaction',
    'inventory_movement'
  ];
  const COLLECTIONS = {
    supplier: 'suppliers',
    material: 'materials',
    purchase: 'purchases',
    expense: 'expenses',
    recurring_expense: 'recurringExpenses',
    cash_transaction: 'cashTransactions',
    inventory_movement: 'inventoryMovements'
  };
  const DELETE_TYPES = {
    supplier: 'supplier',
    material: 'material',
    purchase: 'purchase',
    expense: 'expense',
    recurring: 'recurring_expense'
  };
  const INVENTORY_STATUSES_LIST = ['en_proceso', 'listo', 'entregado'];

  let initialized = false;
  let connected = false;
  let schemaReady = false;
  let client = null;
  let profile = null;
  let connectTimer = null;
  let syncTimer = null;
  let refreshTimer = null;
  let realtimeChannel = null;
  let orderSearchTimer = null;
  let customerSearchTimer = null;
  let lockHeartbeat = null;
  let currentLock = null;
  let pendingSpecialAction = null;
  let baseRenderOrders = null;
  let operationsStatus = 'Conectando operaciones compartidas…';
  let recentErrorSignatures = new Map();

  const orderPage = { page: 0, total: 0, rows: [], loading: false, ready: false };
  const activityPage = { page: 0, total: 0, rows: [], loading: false };
  const errorPage = { page: 0, total: 0, rows: [], loading: false };

  const cloudApi = () => window.MoorePrintCloud;
  const branchesApi = () => window.MoorePrintBranches;
  const context = () => branchesApi()?.getContext?.() || {};
  const isAdmin = () => Boolean(branchesApi()?.isAdmin?.());
  const isOwner = () => (branchesApi()?.getProfile?.()?.role || profile?.role) === 'owner';
  const can = permission => Boolean(branchesApi()?.can?.(permission));
  const currentBranchId = () => context().branchId || profile?.branch_id || '';
  const selectedBranchId = () => context().selectedBranchId || branchesApi()?.getSelectedBranchId?.() || 'all';
  const businessId = () => context().businessId || profile?.business_id || '';
  const nowISO = () => new Date().toISOString();
  const today = () => typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
  const safeClone = value => {
    try { return typeof clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  };
  const number = value => typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;
  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const moneyValue = value => typeof money === 'function'
    ? money(value)
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(number(value));
  const formatDateValue = value => typeof formatDate === 'function'
    ? formatDate(value)
    : value || '—';

  function persistState() {
    if (!window.state) return;
    try {
      if (typeof STORAGE_KEY !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(window.state));
      const userId = profile?.user_id;
      if (userId) localStorage.setItem(`mooreprint-control-v1-user-${userId}`, JSON.stringify(window.state));
    } catch (error) {
      console.warn('No fue posible guardar el estado operativo.', error);
    }
  }

  function setOperationsStatus(message, type = '') {
    operationsStatus = message;
    const node = document.querySelector('#teamOperationsStatus');
    if (!node) return;
    node.className = `team-operations-status${type ? ` ${type}` : ''}`;
    node.textContent = message;
  }

  function installStyles() {
    if (document.querySelector('#teamOperationsStyles')) return;
    const style = document.createElement('style');
    style.id = 'teamOperationsStyles';
    style.textContent = `
      .team-operations-status { padding:10px 12px;border:1px solid #343430;border-radius:11px;background:#0b0b0b;color:#aaa;font-size:12px; }
      .team-operations-status.ok { border-color:#155e43;color:#9ce2c2; }
      .team-operations-status.warning { border-color:#725d12;color:#f3d361; }
      .team-operations-status.error { border-color:#7f1d1d;color:#fca5a5; }
      .team-admin-tools { display:grid;gap:16px; }
      .team-tool-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px; }
      .team-tool-list { display:grid;gap:8px;max-height:360px;overflow:auto; }
      .team-tool-row { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:11px;border:1px solid #30302d;border-radius:12px;background:#0b0b0b; }
      .team-tool-row small { display:block;color:#999;margin-top:3px;overflow-wrap:anywhere; }
      .team-tool-filters { display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px; }
      .team-tool-filters label { min-width:145px;flex:1; }
      .team-tool-pager { display:flex;justify-content:center;align-items:center;gap:9px;flex-wrap:wrap;margin-top:10px; }
      .team-tool-pager small { min-width:170px;text-align:center;color:#999; }
      .team-order-lock { margin:0 0 14px;padding:12px;border:1px solid #725d12;border-radius:12px;background:#231d08;color:#f4d45f; }
      .team-order-lock.danger { border-color:#7f1d1d;background:#260b0b;color:#fecaca; }
      .team-order-lock.ok { border-color:#155e43;background:#092117;color:#a7e8ca; }
      .team-order-lock strong,.team-order-lock small { display:block; }
      .team-order-lock small { margin-top:4px; }
      .team-customer-lookup { position:relative; }
      .team-customer-results { display:grid;gap:5px;margin-top:6px;max-height:190px;overflow:auto; }
      .team-customer-result { width:100%;text-align:left;padding:9px 10px;border:1px solid #353532;border-radius:10px;background:#111;color:#eee;cursor:pointer; }
      .team-customer-result small { display:block;color:#999;margin-top:2px; }
      .team-risk-confirm { padding:11px;border:1px solid #725d12;border-radius:11px;background:#211b08; }
      .team-risk-confirm label { display:flex;gap:9px;align-items:flex-start; }
      .team-risk-confirm input { margin-top:3px; }
      .team-error-message { max-width:650px;white-space:pre-wrap;overflow-wrap:anywhere; }
      @media(max-width:760px){.team-tool-grid{grid-template-columns:1fr}.team-tool-row{align-items:flex-start}.team-tool-filters label{min-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function collectionFor(type) {
    const key = COLLECTIONS[type];
    if (!key || !window.state) return [];
    if (!Array.isArray(window.state[key])) window.state[key] = [];
    return window.state[key];
  }

  function setCollection(type, rows) {
    const key = COLLECTIONS[type];
    if (!key || !window.state) return;
    window.state[key] = rows;
  }

  function canReadType(type) {
    if (isAdmin()) return true;
    if (['supplier', 'material', 'inventory_movement'].includes(type)) return can('view_inventory') || can('manage_inventory');
    if (type === 'purchase') return can('view_finances') || can('manage_inventory');
    if (['expense', 'recurring_expense'].includes(type)) return can('view_finances');
    if (type === 'cash_transaction') return can('view_finances') || can('manage_payments');
    return false;
  }

  function canWriteType(type) {
    if (isAdmin()) return true;
    if (['supplier', 'material', 'inventory_movement'].includes(type)) return can('manage_inventory');
    if (type === 'purchase') return can('manage_inventory') || can('view_finances');
    if (['expense', 'recurring_expense'].includes(type)) return can('view_finances');
    if (type === 'cash_transaction') return can('view_finances') || can('manage_payments');
    return false;
  }

  function dateForRecord(type, record) {
    if (type === 'purchase' || type === 'expense' || type === 'cash_transaction' || type === 'inventory_movement') return record.date || today();
    return null;
  }

  function ensureRecordMetadata(type, record) {
    if (!record?.id) return record;
    record.branchId = record.branchId || currentBranchId();
    record.createdBy = record.createdBy || profile?.user_id || '';
    record.updatedBy = profile?.user_id || record.updatedBy || '';
    record.createdAt = record.createdAt || nowISO();
    record.updatedAt = record.updatedAt || nowISO();
    return record;
  }

  function accessibleRows(rows) {
    if (isAdmin() && selectedBranchId() === 'all') return rows || [];
    const branchId = currentBranchId();
    return (rows || []).filter(row => !row.branchId || row.branchId === branchId);
  }

  function chunks(rows, size = 150) {
    const result = [];
    for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
    return result;
  }

  async function syncTypes(types = ALL_RECORD_TYPES) {
    if (!schemaReady || !client || !profile || !cloudApi()?.hasAccess?.()) return false;
    const uniqueTypes = [...new Set(types)].filter(type => ALL_RECORD_TYPES.includes(type) && canWriteType(type));
    if (!uniqueTypes.length) return true;

    setOperationsStatus('Sincronizando inventario y operaciones…', 'warning');
    try {
      for (const type of uniqueTypes) {
        const records = accessibleRows(collectionFor(type))
          .filter(record => record?.id)
          .map(record => ensureRecordMetadata(type, record));
        const rows = records.map(record => ({
          entity_id: record.id,
          branch_id: record.branchId,
          payload: record,
          occurred_on: dateForRecord(type, record),
          created_at: record.createdAt || nowISO()
        }));
        for (const batch of chunks(rows)) {
          if (!batch.length) continue;
          const { error } = await client.rpc('sync_team_records', {
            p_entity_type: type,
            p_rows: batch
          });
          if (error) throw error;
        }
      }
      persistState();
      setOperationsStatus('Inventario, compras, gastos y caja actualizados.', 'ok');
      return true;
    } catch (error) {
      setOperationsStatus(`No se pudieron sincronizar las operaciones: ${error.message}`, 'error');
      reportError('sync-operations', error, { types: uniqueTypes });
      return false;
    }
  }

  function mergeRecords(localRows, remoteRows) {
    const result = new Map();
    [...(localRows || []), ...(remoteRows || [])].forEach(record => {
      if (!record?.id) return;
      const existing = result.get(record.id);
      const recordTime = new Date(record.updatedAt || record.createdAt || 0).getTime() || 0;
      const existingTime = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime() || 0;
      if (!existing || recordTime >= existingTime) result.set(record.id, record);
    });
    return [...result.values()];
  }

  async function hydrateOperations(options = {}) {
    if (!schemaReady || !client || !profile) return false;
    const readableTypes = ALL_RECORD_TYPES.filter(canReadType);
    if (!readableTypes.length) return true;
    try {
      const branch = isAdmin() && selectedBranchId() !== 'all' ? selectedBranchId() : null;
      const { data, error } = await client.rpc('list_team_records', {
        p_entity_types: readableTypes,
        p_branch_id: branch,
        p_limit: 5000
      });
      if (error) throw error;
      const grouped = new Map(readableTypes.map(type => [type, []]));
      (data || []).forEach(row => {
        const type = row.entity_type;
        if (!grouped.has(type)) return;
        const payload = row.payload && typeof row.payload === 'object' ? safeClone(row.payload) : {};
        grouped.get(type).push({
          ...payload,
          id: row.entity_id,
          branchId: row.branch_id,
          createdBy: row.created_by || payload.createdBy || '',
          updatedBy: row.updated_by || payload.updatedBy || '',
          createdAt: row.created_at || payload.createdAt,
          updatedAt: row.updated_at || payload.updatedAt,
          cloudVersion: row.version
        });
      });

      readableTypes.forEach(type => {
        const local = accessibleRows(collectionFor(type));
        setCollection(type, mergeRecords(local, grouped.get(type) || []));
      });
      persistState();
      if (!options.silent && typeof renderAll === 'function') renderAll();
      setOperationsStatus('Operaciones compartidas activas.', 'ok');
      return true;
    } catch (error) {
      setOperationsStatus(`No se pudieron cargar las operaciones: ${error.message}`, 'error');
      reportError('hydrate-operations', error);
      return false;
    }
  }

  function scheduleSync(types, delay = 350) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncTypes(types), delay);
  }

  function scheduleRefresh(delay = 250) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => hydrateOperations(), delay);
  }

  function wrapFunction(name, factory, marker = '__teamOperationsWrapped') {
    const current = window[name];
    if (typeof current !== 'function' || current[marker]) return false;
    const wrapped = factory(current);
    wrapped[marker] = true;
    window[name] = wrapped;
    try { eval(`${name} = window[name]`); } catch (error) {}
    return true;
  }

  function wrapOperationSaves() {
    const wrapAfter = (name, typesFactory) => wrapFunction(name, base => function (...args) {
      const result = base.apply(this, args);
      const finish = () => {
        const types = typeof typesFactory === 'function' ? typesFactory(...args) : typesFactory;
        scheduleSync(types, 180);
      };
      if (result && typeof result.then === 'function') result.finally(finish);
      else finish();
      return result;
    });

    wrapAfter('saveSupplier', ['supplier']);
    wrapAfter('saveMaterial', ['material', 'inventory_movement']);
    wrapAfter('saveAdjustment', ['material', 'inventory_movement']);
    wrapAfter('savePurchase', ['purchase', 'material', 'inventory_movement']);
    wrapAfter('saveExpense', ['expense']);
    wrapAfter('saveRecurring', ['recurring_expense']);
    wrapAfter('generateRecurringExpenses', ['recurring_expense', 'expense']);
    wrapAfter('saveCashTransaction', ['cash_transaction']);
    wrapAfter('saveOrder', ['material', 'inventory_movement']);
    wrapAfter('savePayment', form => {
      const type = form?.elements?.recordType?.value;
      return type === 'purchase' ? ['purchase'] : type === 'expense' ? ['expense'] : [];
    });

    wrapFunction('performDelete', base => function (type, id) {
      const entityType = DELETE_TYPES[type];
      const collection = entityType ? collectionFor(entityType) : [];
      const before = safeClone(collection.find(row => row.id === id) || null);
      const result = base(type, id);
      const finish = async () => {
        if (!entityType || !before || collectionFor(entityType).some(row => row.id === id) || !schemaReady) return;
        const { error } = await client.rpc('delete_team_record', {
          p_entity_type: entityType,
          p_entity_id: id,
          p_branch_id: before.branchId || currentBranchId()
        });
        if (error) reportError('delete-team-record', error, { entityType, id });
      };
      if (result && typeof result.then === 'function') result.finally(finish);
      else finish();
      return result;
    });
  }

  function branchArgument() {
    const selected = selectedBranchId();
    if (isAdmin() && selected && selected !== 'all') return selected;
    if (!isAdmin()) return currentBranchId();
    return null;
  }

  function orderFromCloud(row) {
    const payload = row.public_payload && typeof row.public_payload === 'object' ? safeClone(row.public_payload) : {};
    const financial = row.financial_payload && typeof row.financial_payload === 'object' ? row.financial_payload : {};
    const order = {
      ...payload,
      id: row.order_id,
      folio: row.folio || payload.folio || '',
      customer: row.customer_name || payload.customer || '',
      status: row.status || payload.status || 'pendiente',
      dueDate: row.due_date || payload.dueDate || today(),
      branchId: row.branch_id,
      assignedTo: row.assigned_to || payload.assignedTo || '',
      createdBy: row.created_by || payload.createdBy || '',
      updatedBy: row.updated_by || payload.updatedBy || '',
      createdAt: row.created_at || payload.createdAt,
      updatedAt: row.updated_at || payload.updatedAt
    };
    order.items = (order.items || []).map((item, index) => ({
      ...item,
      cost: number(financial.itemCosts?.[index]?.cost),
      recipe: safeClone(financial.itemCosts?.[index]?.recipe || [])
    }));
    order.deliveryCost = number(financial.deliveryCost);
    order.inventoryApplied = Boolean(financial.inventoryApplied);
    order.inventorySnapshot = safeClone(financial.inventorySnapshot || []);
    return order;
  }

  function mergeOrdersIntoState(rows) {
    if (!window.state) return;
    const map = new Map((window.state.orders || []).map(row => [row.id, row]));
    rows.forEach(row => map.set(row.id, row));
    window.state.orders = [...map.values()];
    persistState();
  }

  function renderOrderPager() {
    const anchor = document.querySelector('#orders .panel');
    if (!anchor) return;
    let node = document.querySelector('#serverOrderPager');
    if (!node) {
      node = document.createElement('div');
      node.id = 'serverOrderPager';
      anchor.insertAdjacentElement('afterend', node);
    }
    const maxPage = Math.max(1, Math.ceil(orderPage.total / PAGE_SIZE));
    orderPage.page = Math.min(orderPage.page, maxPage - 1);
    node.innerHTML = `<div class="team-tool-pager"><button class="button secondary small" type="button" id="serverOrderPrev" ${orderPage.page <= 0 ? 'disabled' : ''}>← Anterior</button><small>Página ${orderPage.page + 1} de ${maxPage} · ${orderPage.total} pedidos</small><button class="button secondary small" type="button" id="serverOrderNext" ${orderPage.page >= maxPage - 1 ? 'disabled' : ''}>Siguiente →</button></div>`;
  }

  function renderRemoteOrders() {
    if (!orderPage.ready) return baseRenderOrders?.();
    const table = document.querySelector('#ordersTable');
    const empty = document.querySelector('#ordersEmpty');
    if (!table || !empty) return;
    const rows = orderPage.rows;
    empty.style.display = orderPage.total ? 'none' : 'block';
    table.innerHTML = rows.map(order => {
      const totals = typeof documentTotals === 'function' ? documentTotals(order) : { total: 0, balance: 0 };
      const description = (order.items || []).map(item => `${item.qty} ${item.name}`).join(', ');
      const overdue = typeof isOverdue === 'function' && isOverdue(order);
      return `<tr class="${overdue ? 'stock-low' : ''}"><td><strong>${html(order.folio)}</strong><br><small>${html(order.priority || 'normal')}</small></td><td><strong>${html(order.customer || '')}</strong><br><small>${html(order.phone || '')}</small></td><td title="${html(description)}">${html(description.slice(0, 58))}${description.length > 58 ? '…' : ''}<br><small>${html(order.designStatus || 'pendiente')} · ${html(order.responsible || 'Sin responsable')}</small></td><td>${formatDateValue(order.dueDate)}${overdue ? '<br><small class="money-negative">Atrasado</small>' : ''}</td><td><span class="badge ${html(order.status)}">${typeof statusName === 'function' ? html(statusName(order.status)) : html(order.status)}</span></td><td>${moneyValue(totals.total)}</td><td class="${totals.balance ? 'money-warning' : 'money-positive'}">${moneyValue(totals.balance)}</td><td><div class="action-group"><button class="action-button" data-view-order="${html(order.id)}" title="Nota">🧾</button><button class="action-button" data-pay-order="${html(order.id)}" title="Registrar pago">$</button><button class="action-button" data-edit-order="${html(order.id)}" title="Editar">✎</button><button class="action-button" data-delete-order="${html(order.id)}" title="Eliminar">×</button></div></td></tr>`;
    }).join('');
    renderOrderPager();
    branchesApi()?.applyPermissions?.();
  }

  async function fetchOrderPage(pageNumber = orderPage.page) {
    if (!schemaReady || !client || !can('view_orders') || orderPage.loading) return false;
    orderPage.loading = true;
    orderPage.page = Math.max(0, pageNumber);
    window.MoorePrintTeamImprovements?.setStatus?.('syncing', 'Actualizando pedidos…');
    const { data, error } = await client.rpc('page_team_orders', {
      p_search: document.querySelector('#orderSearch')?.value?.trim() || '',
      p_status: document.querySelector('#orderStatusFilter')?.value || 'all',
      p_assignment: document.querySelector('#assignmentFilter')?.value || 'all',
      p_urgency: document.querySelector('#teamUrgencyFilter')?.value || 'all',
      p_branch_id: branchArgument(),
      p_offset: orderPage.page * PAGE_SIZE,
      p_limit: PAGE_SIZE
    });
    orderPage.loading = false;
    if (error) {
      orderPage.ready = false;
      const missing = /page_team_orders|schema cache|does not exist/i.test(error.message || '');
      setOperationsStatus(missing ? 'Falta ejecutar supabase/team-operations.sql.' : `No se cargaron los pedidos: ${error.message}`, 'error');
      reportError('page-orders', error);
      return false;
    }
    const result = data || {};
    orderPage.total = Number(result.total || 0);
    orderPage.rows = (result.rows || []).map(orderFromCloud);
    orderPage.ready = true;
    mergeOrdersIntoState(orderPage.rows);
    renderRemoteOrders();
    window.MoorePrintTeamImprovements?.setStatus?.('connected', 'Conectado y actualizado.');
    return true;
  }

  function scheduleOrderPage(delay = 250) {
    clearTimeout(orderSearchTimer);
    orderSearchTimer = setTimeout(() => fetchOrderPage(orderPage.page), delay);
  }

  function installOrderPagination() {
    if (!baseRenderOrders && typeof window.renderOrders === 'function') baseRenderOrders = window.renderOrders;
    if (!baseRenderOrders || window.renderOrders?.__serverOrdersWrapped) return;
    const wrapped = function () { return renderRemoteOrders(); };
    wrapped.__serverOrdersWrapped = true;
    window.renderOrders = wrapped;
    try { renderOrders = wrapped; } catch (error) {}
  }

  function ensureCustomerOption(select, customer) {
    if (!select || !customer?.id) return;
    let option = [...select.options].find(row => row.value === customer.id);
    if (!option) {
      option = document.createElement('option');
      option.value = customer.id;
      select.appendChild(option);
    }
    option.textContent = customer.name || customer.phone || 'Cliente';
    select.value = customer.id;
  }

  function injectCustomerLookup(form, record = {}) {
    if (!form || form.querySelector('.team-customer-lookup')) return;
    const select = form.querySelector('#orderCustomerSelect,#quoteCustomerSelect');
    const label = select?.closest('label');
    if (!select || !label) return;
    if (record.customerId && ![...select.options].some(option => option.value === record.customerId)) {
      ensureCustomerOption(select, { id: record.customerId, name: record.customer || 'Cliente actual' });
    }
    const lookup = document.createElement('label');
    lookup.className = 'team-customer-lookup full';
    lookup.innerHTML = `Buscar cliente en todas las páginas<input class="team-remote-customer-input" autocomplete="off" value="${html(record.customer || '')}" placeholder="Escribe nombre o teléfono"><div class="team-customer-results"><small>Escribe al menos 2 caracteres.</small></div>`;
    label.insertAdjacentElement('beforebegin', lookup);
  }

  async function searchRemoteCustomers(input) {
    const form = input.closest('form');
    const results = input.parentElement.querySelector('.team-customer-results');
    const term = input.value.trim();
    if (!results || !form) return;
    if (term.length < 2) {
      results.innerHTML = '<small>Escribe al menos 2 caracteres.</small>';
      return;
    }
    results.innerHTML = '<small>Buscando…</small>';
    const { data, error } = await client.rpc('page_team_customers', {
      p_search: term,
      p_branch_id: branchArgument(),
      p_offset: 0,
      p_limit: 20
    });
    if (error) {
      results.innerHTML = `<small>No se pudo buscar: ${html(error.message)}</small>`;
      reportError('search-customers', error);
      return;
    }
    const rows = data?.rows || [];
    results.innerHTML = rows.length ? rows.map(row => {
      const name = row.name || row.payload?.name || '';
      const phone = row.phone || row.payload?.phone || '';
      return `<button class="team-customer-result" type="button" data-team-customer-id="${html(row.customer_id)}" data-team-customer-name="${encodeURIComponent(name)}" data-team-customer-phone="${encodeURIComponent(phone)}"><strong>${html(name || 'Sin nombre')}</strong><small>${html(phone || 'Sin teléfono')}</small></button>`;
    }).join('') : '<small>No se encontraron clientes.</small>';
  }

  function injectInventoryRiskCheckbox(form, message) {
    if (!form || form.querySelector('[name="confirmInventoryImpact"]')) return;
    const box = document.createElement('div');
    box.className = 'team-risk-confirm full';
    box.innerHTML = `<label><input type="checkbox" name="confirmInventoryImpact"><span><strong>Confirmación de inventario</strong><small>${html(message)}</small></span></label>`;
    const summary = form.querySelector('.summary-box');
    if (summary) summary.insertAdjacentElement('beforebegin', box);
    else form.appendChild(box);
  }

  async function acquireOrderLock(order, force = false) {
    if (!schemaReady || !client || !order?.id) return { unavailable: true, acquired: true };
    const { data, error } = await client.rpc('acquire_team_edit_lock', {
      p_entity_type: 'order',
      p_entity_id: order.id,
      p_branch_id: order.branchId || currentBranchId(),
      p_force: force
    });
    if (error) {
      reportError('acquire-order-lock', error, { orderId: order.id });
      return { unavailable: true, acquired: true, error };
    }
    return data || { acquired: false };
  }

  function stopLockHeartbeat() {
    clearInterval(lockHeartbeat);
    lockHeartbeat = null;
  }

  function startLockHeartbeat() {
    stopLockHeartbeat();
    if (!currentLock?.acquired) return;
    lockHeartbeat = setInterval(async () => {
      if (!client || !currentLock?.entityId) return;
      const { error } = await client.rpc('heartbeat_team_edit_lock', {
        p_entity_type: 'order',
        p_entity_id: currentLock.entityId
      });
      if (error) reportError('heartbeat-order-lock', error, { orderId: currentLock.entityId });
    }, 45000);
  }

  async function releaseCurrentLock() {
    const lock = currentLock;
    currentLock = null;
    stopLockHeartbeat();
    if (!client || !lock?.acquired || !lock.entityId) return;
    await client.rpc('release_team_edit_lock', {
      p_entity_type: 'order',
      p_entity_id: lock.entityId
    }).catch(() => {});
  }

  function injectLockBanner(form, lock, order) {
    if (!form || form.querySelector('.team-order-lock')) return;
    const banner = document.createElement('div');
    const submit = document.querySelector(`[form="${form.id}"]`);
    if (lock?.unavailable) {
      banner.className = 'team-order-lock';
      banner.innerHTML = '<strong>No se pudo verificar quién está editando.</strong><small>Puedes continuar, pero revisa el indicador de conexión antes de guardar.</small>';
    } else if (lock?.acquired) {
      banner.className = 'team-order-lock ok';
      banner.innerHTML = '<strong>Edición reservada para ti.</strong><small>Los demás integrantes recibirán un aviso si intentan editar este pedido.</small>';
    } else {
      banner.className = 'team-order-lock danger';
      banner.innerHTML = `<strong>${html(lock?.user_name || 'Otro integrante')} está editando este pedido.</strong><small>La edición está bloqueada hasta ${html(new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(new Date(lock?.expires_at || Date.now())))}.</small><button class="button danger small" type="button" data-force-order-lock="${html(order.id)}" style="margin-top:8px">Editar de todos modos</button>`;
      if (submit) submit.disabled = true;
    }
    form.insertAdjacentElement('afterbegin', banner);
  }

  function installOrderLockAndLookup() {
    wrapFunction('openOrderModal', base => async function (id = '', quoteId = '') {
      const existing = window.state?.orders?.find(row => row.id === id) || null;
      let lock = null;
      if (existing) lock = await acquireOrderLock(existing, false);
      const result = await base(id, quoteId);
      const form = document.querySelector('#orderForm');
      const record = existing || { customerId: form?.elements?.customerId?.value || '', customer: form?.elements?.customer?.value || '' };
      injectCustomerLookup(form, record);
      injectInventoryRiskCheckbox(form, 'Al guardar un pedido en proceso, listo o entregado se descontarán materiales. Verifica cantidades y recetas.');
      if (existing && form) {
        currentLock = {
          entityId: existing.id,
          acquired: Boolean(lock?.acquired),
          unavailable: Boolean(lock?.unavailable),
          branchId: existing.branchId || currentBranchId()
        };
        injectLockBanner(form, lock, existing);
        startLockHeartbeat();
      }
      return result;
    }, '__teamOrderLockOpenWrapped');

    wrapFunction('openQuoteModal', base => async function (id = '') {
      const existing = window.state?.quotes?.find(row => row.id === id) || {};
      const result = await base(id);
      injectCustomerLookup(document.querySelector('#quoteForm'), existing);
      return result;
    }, '__teamRemoteCustomerQuoteWrapped');

    wrapFunction('saveOrder', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const oldOrder = window.state?.orders?.find(row => row.id === id);
      const targetStatus = form?.elements?.status?.value || '';
      const inventoryImpact = INVENTORY_STATUSES_LIST.includes(targetStatus) || Boolean(oldOrder?.inventoryApplied);
      if (inventoryImpact && !form.elements.confirmInventoryImpact?.checked) {
        window.showToast?.('Confirma el movimiento de inventario antes de guardar.', 'warning');
        return false;
      }
      if (currentLock?.entityId === id && !currentLock.acquired && !currentLock.unavailable) {
        window.showToast?.('Otro integrante mantiene bloqueada la edición de este pedido.', 'error');
        return false;
      }
      const result = base(form);
      Promise.resolve(result).finally(() => {
        releaseCurrentLock();
        orderPage.page = 0;
        setTimeout(() => fetchOrderPage(0), 500);
      });
      return result;
    }, '__teamOrderLockSaveWrapped');

    wrapFunction('closeModal', base => function (...args) {
      const closingOrder = Boolean(document.querySelector('#orderForm'));
      if (closingOrder) releaseCurrentLock();
      return base.apply(this, args);
    }, '__teamOrderLockCloseWrapped');
  }

  function serializeForm(form) {
    return Object.fromEntries(new FormData(form));
  }

  function formFromData(data) {
    const form = document.createElement('form');
    Object.entries(data || {}).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.name = name;
      input.value = value ?? '';
      form.appendChild(input);
    });
    return form;
  }

  function showSpecialConfirmation(title, body, action) {
    pendingSpecialAction = action;
    openModal(title, `<div class="team-risk-confirm">${body}</div>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" type="button" id="confirmSpecialOperation">Confirmar operación</button>');
  }

  function installSpecialConfirmations() {
    wrapFunction('savePayment', base => function (form) {
      if (form?.dataset?.specialConfirmed === 'true') return base(form);
      const data = serializeForm(form);
      const collection = data.recordType === 'order' ? window.state.orders : data.recordType === 'purchase' ? window.state.purchases : window.state.expenses;
      const record = collection.find(row => row.id === data.recordId);
      const label = data.recordType === 'order' ? record?.folio : data.recordType === 'purchase' ? record?.invoice || 'Compra' : record?.description || 'Gasto';
      showSpecialConfirmation('Confirmar pago', `<strong>${html(label || 'Registro')}</strong><p>Monto: <strong>${moneyValue(data.amount)}</strong></p><p>Método: <strong>${html(typeof methodName === 'function' ? methodName(data.method) : data.method)}</strong></p><p>Esta acción afectará caja y saldos.</p>`, () => {
        const confirmed = formFromData(data);
        confirmed.dataset.specialConfirmed = 'true';
        return base(confirmed);
      });
      return false;
    }, '__teamPaymentConfirmationWrapped');

    wrapFunction('saveAdjustment', base => function (form) {
      if (form?.dataset?.specialConfirmed === 'true') return base(form);
      const data = serializeForm(form);
      const material = window.state.materials.find(row => row.id === data.materialId);
      const before = number(material?.stock);
      let delta = number(data.quantity);
      if (data.direction === 'subtract') delta *= -1;
      if (data.direction === 'set') delta = number(data.quantity) - before;
      const after = before + delta;
      showSpecialConfirmation('Confirmar ajuste de inventario', `<strong>${html(material?.name || 'Material')}</strong><p>Existencia anterior: <strong>${before.toFixed(3)}</strong></p><p>Nueva existencia: <strong>${after.toFixed(3)}</strong></p><p>Motivo: ${html(data.reason || '')}</p>`, () => {
        const confirmed = formFromData(data);
        confirmed.dataset.specialConfirmed = 'true';
        return base(confirmed);
      });
      return false;
    }, '__teamInventoryConfirmationWrapped');

    wrapFunction('saveCashTransaction', base => function (form) {
      if (form?.dataset?.specialConfirmed === 'true') return base(form);
      const data = serializeForm(form);
      showSpecialConfirmation('Confirmar movimiento de caja', `<p>Tipo: <strong>${html(data.type)}</strong></p><p>Monto: <strong>${moneyValue(data.amount)}</strong></p><p>Descripción: ${html(data.description || '')}</p>`, () => {
        const confirmed = formFromData(data);
        confirmed.dataset.specialConfirmed = 'true';
        return base(confirmed);
      });
      return false;
    }, '__teamCashConfirmationWrapped');

    wrapFunction('openPurchaseModal', base => function (...args) {
      const result = base.apply(this, args);
      injectInventoryRiskCheckbox(document.querySelector('#purchaseForm'), 'Registrar o editar una compra modifica existencias y costo promedio de los materiales.');
      return result;
    }, '__teamPurchaseRiskOpenWrapped');

    wrapFunction('savePurchase', base => function (form) {
      if (!form.elements.confirmInventoryImpact?.checked) {
        window.showToast?.('Confirma el movimiento de inventario de la compra.', 'warning');
        return false;
      }
      return base(form);
    }, '__teamPurchaseRiskSaveWrapped');
  }

  function injectCashClosingConfirmation(form) {
    if (!form || form.querySelector('[name="confirmCashClosing"]')) return;
    const expected = number(form.elements.expected?.value);
    const counted = number(form.elements.counted?.value);
    const box = document.createElement('div');
    box.className = 'team-risk-confirm full';
    box.innerHTML = `<label><input type="checkbox" name="confirmCashClosing"><span><strong>Confirmo el corte</strong><small>Esperado ${moneyValue(expected)} · Contado ${moneyValue(counted)}. Después quedará registrado en el historial.</small></span></label>`;
    form.appendChild(box);
  }

  function installCashClosingGuard() {
    document.addEventListener('submit', event => {
      const form = event.target;
      if (form?.id !== 'teamCashClosingForm' || form.dataset.specialConfirmed === 'true') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      injectCashClosingConfirmation(form);
      if (!form.elements.confirmCashClosing?.checked) {
        window.showToast?.('Marca la confirmación antes de guardar el corte.', 'warning');
        return;
      }
      const data = serializeForm(form);
      const difference = number(data.counted) - number(data.expected);
      openModal('Confirmar corte de caja', `<form id="teamCashClosingForm" data-special-confirmed="true" class="modal-form">${Object.entries(data).map(([name, value]) => `<input type="hidden" name="${html(name)}" value="${html(value)}">`).join('')}<div class="team-risk-confirm full"><strong>Revisión final</strong><p>Esperado: ${moneyValue(data.expected)}</p><p>Contado: ${moneyValue(data.counted)}</p><p>Diferencia: <strong class="${difference === 0 ? 'money-positive' : 'money-warning'}">${moneyValue(difference)}</strong></p></div></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" form="teamCashClosingForm">Confirmar y guardar corte</button>');
    }, true);
  }

  function activityFilters() {
    return {
      userId: document.querySelector('#teamActivityUser')?.value || null,
      from: document.querySelector('#teamActivityFrom')?.value || null,
      to: document.querySelector('#teamActivityTo')?.value || null
    };
  }

  function ensureAdminPanel() {
    if (!isAdmin()) return;
    const grid = document.querySelector('#settings .settings-grid');
    if (!grid) return;
    let panel = document.querySelector('#teamOperationsPanel');
    if (panel) return;
    panel = document.createElement('article');
    panel.className = 'panel team-admin-tools';
    panel.id = 'teamOperationsPanel';
    panel.innerHTML = `<div class="panel-header"><div><h2>Operaciones, historial y diagnóstico</h2><p>Información interna del equipo; no crea enlaces para clientes.</p></div></div><div id="teamOperationsStatus" class="team-operations-status">${html(operationsStatus)}</div><div class="team-tool-grid"><section><div class="section-title"><div><h3>Historial por empleado</h3><p>Paginado y exportable en CSV.</p></div></div><div class="team-tool-filters"><label>Empleado<select id="teamActivityUser"><option value="">Todos</option></select></label><label>Desde<input id="teamActivityFrom" type="date"></label><label>Hasta<input id="teamActivityTo" type="date"></label><button class="button secondary" id="teamActivityApply" type="button">Aplicar</button><button class="button primary" id="teamActivityExport" type="button">Exportar CSV</button></div><div class="team-tool-list" id="teamActivityList"><p class="empty-message">Cargando historial…</p></div><div id="teamActivityPager"></div></section>${isOwner() ? '<section><div class="section-title"><div><h3>Errores internos</h3><p>Solo visibles para el propietario.</p></div></div><div class="team-tool-list" id="teamErrorList"><p class="empty-message">Cargando errores…</p></div><div id="teamErrorPager"></div></section>' : '<section><div class="section-title"><div><h3>Diagnóstico</h3></div></div><p class="empty-message">El panel de errores es exclusivo del propietario.</p></section>'}</div>`;
    grid.appendChild(panel);
    updateMemberOptions();
  }

  function updateMemberOptions() {
    const select = document.querySelector('#teamActivityUser');
    if (!select) return;
    const current = select.value;
    const members = branchesApi()?.getMembers?.() || [];
    select.innerHTML = `<option value="">Todos</option>${members.map(member => `<option value="${html(member.user_id)}">${html(member.display_name || member.email)}</option>`).join('')}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function renderActivityPager() {
    const node = document.querySelector('#teamActivityPager');
    if (!node) return;
    const maxPage = Math.max(1, Math.ceil(activityPage.total / PAGE_SIZE));
    activityPage.page = Math.min(activityPage.page, maxPage - 1);
    node.innerHTML = `<div class="team-tool-pager"><button class="button secondary small" id="teamActivityPrev" type="button" ${activityPage.page <= 0 ? 'disabled' : ''}>← Anterior</button><small>Página ${activityPage.page + 1} de ${maxPage} · ${activityPage.total} movimientos</small><button class="button secondary small" id="teamActivityNext" type="button" ${activityPage.page >= maxPage - 1 ? 'disabled' : ''}>Siguiente →</button></div>`;
  }

  function renderActivityRows() {
    const list = document.querySelector('#teamActivityList');
    if (!list) return;
    list.innerHTML = activityPage.rows.length ? activityPage.rows.map(row => `<div class="team-tool-row"><div><strong>${html(row.actor_name || 'Usuario')} · ${html(row.title || 'Movimiento')}</strong><small>${html(row.detail || '')}</small><small>${html(row.entity_type || 'sistema')} · ${html(row.entity_id || 'sin referencia')}</small></div><small>${html(new Intl.DateTimeFormat('es-MX', { dateStyle:'short', timeStyle:'short' }).format(new Date(row.created_at)))}</small></div>`).join('') : '<p class="empty-message">No hay movimientos con esos filtros.</p>';
    renderActivityPager();
  }

  async function loadActivityPage(pageNumber = activityPage.page, limit = PAGE_SIZE) {
    if (!client || !isAdmin() || activityPage.loading) return null;
    activityPage.loading = true;
    activityPage.page = Math.max(0, pageNumber);
    const filters = activityFilters();
    const { data, error } = await client.rpc('page_team_activity', {
      p_user_id: filters.userId || null,
      p_branch_id: branchArgument(),
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_offset: activityPage.page * PAGE_SIZE,
      p_limit: limit
    });
    activityPage.loading = false;
    if (error) {
      reportError('page-activity', error);
      const list = document.querySelector('#teamActivityList');
      if (list) list.innerHTML = `<p class="empty-message">${html(error.message)}</p>`;
      return null;
    }
    if (limit === PAGE_SIZE) {
      activityPage.total = Number(data?.total || 0);
      activityPage.rows = data?.rows || [];
      renderActivityRows();
    }
    return data;
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  async function exportActivityCsv() {
    const filters = activityFilters();
    const { data, error } = await client.rpc('page_team_activity', {
      p_user_id: filters.userId || null,
      p_branch_id: branchArgument(),
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_offset: 0,
      p_limit: 5000
    });
    if (error) {
      reportError('export-activity', error);
      return window.showToast?.(error.message, 'error');
    }
    const rows = [['Fecha', 'Empleado', 'Tipo', 'Título', 'Detalle', 'Entidad', 'Referencia']];
    (data?.rows || []).forEach(row => rows.push([
      row.created_at,
      row.actor_name,
      row.event_type,
      row.title,
      row.detail,
      row.entity_type,
      row.entity_id
    ]));
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (typeof downloadBlob === 'function') downloadBlob(blob, `mooreprint-historial-${today()}.csv`);
    else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mooreprint-historial-${today()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    window.showToast?.('Historial exportado');
  }

  function renderErrorPager() {
    const node = document.querySelector('#teamErrorPager');
    if (!node) return;
    const maxPage = Math.max(1, Math.ceil(errorPage.total / PAGE_SIZE));
    errorPage.page = Math.min(errorPage.page, maxPage - 1);
    node.innerHTML = `<div class="team-tool-pager"><button class="button secondary small" id="teamErrorPrev" type="button" ${errorPage.page <= 0 ? 'disabled' : ''}>← Anterior</button><small>Página ${errorPage.page + 1} de ${maxPage} · ${errorPage.total} errores</small><button class="button secondary small" id="teamErrorNext" type="button" ${errorPage.page >= maxPage - 1 ? 'disabled' : ''}>Siguiente →</button></div>`;
  }

  function renderErrorRows() {
    const list = document.querySelector('#teamErrorList');
    if (!list) return;
    list.innerHTML = errorPage.rows.length ? errorPage.rows.map(row => `<div class="team-tool-row"><div class="team-error-message"><strong>${html(row.source || 'app')} · ${html(row.user_name || 'Usuario')}</strong><small>${html(row.message || '')}</small><small>${html(new Intl.DateTimeFormat('es-MX', { dateStyle:'short', timeStyle:'short' }).format(new Date(row.created_at)))}</small></div><button class="button secondary small" type="button" data-resolve-team-error="${html(row.error_id)}">Resolver</button></div>`).join('') : '<p class="empty-message">No hay errores pendientes.</p>';
    renderErrorPager();
  }

  async function loadErrors(pageNumber = errorPage.page) {
    if (!client || !isOwner() || errorPage.loading) return;
    errorPage.loading = true;
    errorPage.page = Math.max(0, pageNumber);
    const { data, error } = await client.rpc('page_team_errors', {
      p_include_resolved: false,
      p_offset: errorPage.page * PAGE_SIZE,
      p_limit: PAGE_SIZE
    });
    errorPage.loading = false;
    if (error) return;
    errorPage.total = Number(data?.total || 0);
    errorPage.rows = data?.rows || [];
    renderErrorRows();
  }

  function safeErrorDetail(detail) {
    try {
      return JSON.parse(JSON.stringify(detail || {}));
    } catch (error) {
      return { detail: String(detail || '') };
    }
  }

  async function reportError(source, error, detail = {}) {
    if (!client || !profile || !schemaReady) return;
    const message = String(error?.message || error || 'Error sin descripción').slice(0, 1000);
    const signature = `${source}:${message}`;
    const previous = recentErrorSignatures.get(signature) || 0;
    if (Date.now() - previous < 60000) return;
    recentErrorSignatures.set(signature, Date.now());
    const stack = String(error?.stack || '').slice(0, 5000);
    await client.rpc('record_team_error', {
      p_branch_id: currentBranchId() || null,
      p_source: String(source || 'app').slice(0, 120),
      p_message: message,
      p_detail: safeErrorDetail({ ...detail, stack, path: location.pathname, online: navigator.onLine })
    }).catch(() => {});
    if (isOwner()) loadErrors(0);
  }

  function installErrorCapture() {
    window.addEventListener('error', event => {
      reportError('window-error', event.error || event.message, {
        filename: event.filename || '',
        line: event.lineno || 0,
        column: event.colno || 0
      });
    });
    window.addEventListener('unhandledrejection', event => {
      reportError('unhandled-promise', event.reason || 'Promesa rechazada');
    });
  }

  function subscribeRealtime() {
    if (!client || !schemaReady || realtimeChannel) return;
    realtimeChannel = client.channel(`mooreprint-operations-${businessId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_records', filter: `business_id=eq.${businessId()}` }, () => scheduleRefresh(180))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_orders', filter: `business_id=eq.${businessId()}` }, () => scheduleOrderPage(180))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_activity', filter: `business_id=eq.${businessId()}` }, () => loadActivityPage(0))
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR') reportError('operations-realtime', 'Canal de operaciones interrumpido');
      });
  }

  function bindEvents() {
    document.addEventListener('input', event => {
      if (event.target.id === 'orderSearch') {
        orderPage.page = 0;
        scheduleOrderPage();
      }
      if (event.target.classList.contains('team-remote-customer-input')) {
        clearTimeout(customerSearchTimer);
        customerSearchTimer = setTimeout(() => searchRemoteCustomers(event.target), 300);
      }
      if (event.target.name === 'counted' && event.target.closest('#teamCashClosingForm')) {
        const form = event.target.closest('form');
        const box = form.querySelector('[name="confirmCashClosing"]')?.closest('.team-risk-confirm');
        if (box) box.remove();
        injectCashClosingConfirmation(form);
      }
    });

    document.addEventListener('change', event => {
      if (['orderStatusFilter', 'assignmentFilter', 'teamUrgencyFilter', 'branchSelector'].includes(event.target.id)) {
        orderPage.page = 0;
        setTimeout(() => fetchOrderPage(0), event.target.id === 'branchSelector' ? 280 : 40);
      }
    });

    document.addEventListener('click', async event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'serverOrderPrev') fetchOrderPage(Math.max(0, orderPage.page - 1));
      if (target.id === 'serverOrderNext') fetchOrderPage(orderPage.page + 1);
      if (target.dataset.teamCustomerId) {
        const form = target.closest('form');
        const select = form?.querySelector('#orderCustomerSelect,#quoteCustomerSelect');
        const customer = {
          id: target.dataset.teamCustomerId,
          name: decodeURIComponent(target.dataset.teamCustomerName || ''),
          phone: decodeURIComponent(target.dataset.teamCustomerPhone || '')
        };
        ensureCustomerOption(select, customer);
        if (form?.elements?.customer) form.elements.customer.value = customer.name;
        if (form?.elements?.phone) form.elements.phone.value = customer.phone;
        const input = form?.querySelector('.team-remote-customer-input');
        if (input) input.value = customer.name;
        const results = form?.querySelector('.team-customer-results');
        if (results) results.innerHTML = `<small>Seleccionado: ${html(customer.name)}</small>`;
        select?.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (target.dataset.forceOrderLock) {
        const order = window.state.orders.find(row => row.id === target.dataset.forceOrderLock);
        const lock = await acquireOrderLock(order, true);
        if (lock?.acquired) {
          currentLock = { entityId: order.id, acquired: true, branchId: order.branchId || currentBranchId() };
          const banner = target.closest('.team-order-lock');
          if (banner) {
            banner.className = 'team-order-lock ok';
            banner.innerHTML = '<strong>Tomaste el control de la edición.</strong><small>Revisa los cambios antes de guardar.</small>';
          }
          const submit = document.querySelector('[form="orderForm"]');
          if (submit) submit.disabled = false;
          startLockHeartbeat();
          client.rpc('record_team_activity', {
            p_branch_id: order.branchId || currentBranchId(),
            p_event_type: 'order_lock',
            p_entity_type: 'order',
            p_entity_id: order.id,
            p_title: 'Edición de pedido tomada manualmente',
            p_detail: 'El integrante confirmó que editará aunque otro usuario tenía el pedido abierto.',
            p_before_payload: null,
            p_after_payload: null
          }).catch(() => {});
        }
      }
      if (target.id === 'confirmSpecialOperation' && pendingSpecialAction) {
        const action = pendingSpecialAction;
        pendingSpecialAction = null;
        action();
      }
      if (target.id === 'teamActivityApply') {
        activityPage.page = 0;
        loadActivityPage(0);
      }
      if (target.id === 'teamActivityExport') exportActivityCsv();
      if (target.id === 'teamActivityPrev') loadActivityPage(Math.max(0, activityPage.page - 1));
      if (target.id === 'teamActivityNext') loadActivityPage(activityPage.page + 1);
      if (target.id === 'teamErrorPrev') loadErrors(Math.max(0, errorPage.page - 1));
      if (target.id === 'teamErrorNext') loadErrors(errorPage.page + 1);
      if (target.dataset.resolveTeamError) {
        const { error } = await client.rpc('resolve_team_error', { p_error_id: target.dataset.resolveTeamError });
        if (error) return window.showToast?.(error.message, 'error');
        window.showToast?.('Error marcado como resuelto');
        loadErrors(errorPage.page);
      }
    });

    window.addEventListener('focus', () => {
      if (!connected) return;
      scheduleRefresh(120);
      scheduleOrderPage(120);
    }, { passive: true });
  }

  function observeDynamicForms() {
    const observer = new MutationObserver(() => {
      const closing = document.querySelector('#teamCashClosingForm:not([data-special-confirmed="true"])');
      if (closing) injectCashClosingConfirmation(closing);
      ensureAdminPanel();
      updateMemberOptions();
      installOrderPagination();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function checkSchema() {
    const { error } = await client.rpc('list_team_records', {
      p_entity_types: ['material'],
      p_branch_id: null,
      p_limit: 1
    });
    if (!error) {
      schemaReady = true;
      return true;
    }
    schemaReady = false;
    const missing = /list_team_records|team_records|schema cache|does not exist|function/i.test(error.message || '');
    setOperationsStatus(missing ? 'Falta ejecutar supabase/team-operations.sql.' : `No se pudieron iniciar las operaciones: ${error.message}`, 'error');
    return false;
  }

  async function connect() {
    if (connected) return;
    if (!cloudApi()?.hasAccess?.() || !branchesApi()?.getProfile?.()) {
      clearTimeout(connectTimer);
      connectTimer = setTimeout(connect, 120);
      return;
    }
    client = cloudApi().getClient?.();
    profile = branchesApi().getProfile?.();
    if (!client || !profile) {
      connectTimer = setTimeout(connect, 120);
      return;
    }
    connected = true;
    ensureAdminPanel();
    schemaReady = await checkSchema();
    if (!schemaReady) return;
    await hydrateOperations({ silent: true });
    await syncTypes();
    await Promise.allSettled([
      fetchOrderPage(0),
      isAdmin() ? loadActivityPage(0) : Promise.resolve(),
      isOwner() ? loadErrors(0) : Promise.resolve()
    ]);
    subscribeRealtime();
    setOperationsStatus('Operaciones compartidas activas.', 'ok');
  }

  function installWrappers() {
    installOrderPagination();
    wrapOperationSaves();
    installOrderLockAndLookup();
    installSpecialConfirmations();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installStyles();
    installWrappers();
    installCashClosingGuard();
    installErrorCapture();
    bindEvents();
    observeDynamicForms();
    ensureAdminPanel();
    connect();
  }

  window.MoorePrintOperations = {
    init,
    sync: syncTypes,
    refresh: hydrateOperations,
    fetchOrderPage,
    loadActivityPage,
    exportActivityCsv,
    reportError,
    acquireOrderLock,
    releaseOrderLock: releaseCurrentLock,
    getOrderPage: () => safeClone(orderPage),
    isReady: () => schemaReady
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
