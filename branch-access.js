(function () {
  let initialized = false;
  let client = null;
  let authUser = null;
  let profile = null;
  let branches = [];
  let members = [];
  let selectedBranchId = 'all';
  let hydrated = false;
  let syncing = false;
  let syncTimer = null;
  let refreshTimer = null;
  let accessTimer = null;
  let scopedUserId = '';
  let saveHooked = false;

  const ROLE_LABELS = {
    owner: 'Propietario',
    admin: 'Administrador',
    manager: 'Encargado',
    staff: 'Empleado'
  };

  const PERMISSIONS = [
    { key: 'view_orders', label: 'Ver pedidos', help: 'Consulta los pedidos de su sucursal.' },
    { key: 'create_orders', label: 'Crear pedidos', help: 'Registra pedidos nuevos.' },
    { key: 'edit_orders', label: 'Actualizar pedidos', help: 'Cambia datos, responsables y estados.' },
    { key: 'delete_orders', label: 'Eliminar pedidos', help: 'Borra pedidos definitivamente.' },
    { key: 'manage_payments', label: 'Registrar pagos', help: 'Agrega anticipos y liquidaciones.' },
    { key: 'view_branch_totals', label: 'Ver importes de venta', help: 'Muestra totales y saldos del cliente.' },
    { key: 'view_costs', label: 'Ver costos y ganancias', help: 'Muestra costos internos y utilidad.' },
    { key: 'view_quotes', label: 'Ver cotizaciones', help: 'Acceso al módulo de cotizaciones.' },
    { key: 'view_customers', label: 'Ver clientes', help: 'Acceso al directorio de clientes.' },
    { key: 'view_production', label: 'Ver producción', help: 'Consulta y mueve trabajos por etapa.' },
    { key: 'view_calendar', label: 'Ver calendario', help: 'Consulta fechas de entrega.' },
    { key: 'view_inventory', label: 'Ver inventario', help: 'Consulta materiales y existencias.' },
    { key: 'manage_inventory', label: 'Modificar inventario', help: 'Crea materiales y ajusta existencias.' },
    { key: 'view_finances', label: 'Ver finanzas', help: 'Caja, gastos, compras y reportes.' },
    { key: 'manage_catalog', label: 'Administrar catálogo', help: 'Productos, precios y proveedores.' },
    { key: 'manage_users', label: 'Administrar usuarios', help: 'Sucursales, empleados y permisos.' }
  ];

  const ROLE_DEFAULTS = {
    owner: Object.fromEntries(PERMISSIONS.map(item => [item.key, true])),
    admin: Object.fromEntries(PERMISSIONS.map(item => [item.key, true])),
    manager: {
      view_orders: true, create_orders: true, edit_orders: true, delete_orders: false,
      manage_payments: true, view_branch_totals: true, view_costs: false,
      view_quotes: true, view_customers: true, view_production: true, view_calendar: true,
      view_inventory: true, manage_inventory: false, view_finances: false,
      manage_catalog: false, manage_users: false
    },
    staff: {
      view_orders: true, create_orders: true, edit_orders: true, delete_orders: false,
      manage_payments: false, view_branch_totals: true, view_costs: false,
      view_quotes: false, view_customers: false, view_production: true, view_calendar: true,
      view_inventory: false, manage_inventory: false, view_finances: false,
      manage_catalog: false, manage_users: false
    }
  };

  const SECTION_PERMISSIONS = {
    dashboard: 'view_orders', orders: 'view_orders', quotes: 'view_quotes', customers: 'view_customers',
    products: 'manage_catalog', inventory: 'view_inventory', suppliers: 'manage_catalog', purchases: 'view_finances',
    expenses: 'view_finances', recurring: 'view_finances', cash: 'view_finances', reports: 'view_finances',
    production: 'view_production', calendar: 'view_calendar', calculator: 'manage_catalog', waste: 'manage_inventory',
    activity: 'view_finances', settings: null
  };

  function config() { return window.MOOREPRINT_SUPABASE || {}; }
  function hasCloudAccess() { return Boolean(window.MoorePrintCloud?.hasAccess?.()); }
  function isAdmin() { return ['owner', 'admin'].includes(profile?.role); }
  function roleLabel(role) { return ROLE_LABELS[role] || role || 'Empleado'; }

  function effectivePermissions(source = profile) {
    const role = source?.role || 'staff';
    return { ...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff), ...(source?.permissions || {}) };
  }

  function can(permission) {
    if (!profile) return false;
    if (isAdmin()) return true;
    return Boolean(effectivePermissions()[permission]);
  }

  function escapeValue(value) {
    return typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>"']/g, '');
  }

  function scopedKey(userId) { return `mooreprint-control-v1-user-${userId}`; }

  function persistScopedState() {
    if (!scopedUserId) return;
    localStorage.setItem(scopedKey(scopedUserId), JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function switchToScopedState(nextProfile) {
    const userId = nextProfile?.user_id;
    if (!userId || scopedUserId === userId) return;
    const saved = localStorage.getItem(scopedKey(userId));
    let nextState;
    if (saved) {
      try { nextState = normalizeState(JSON.parse(saved)); }
      catch (error) { nextState = normalizeState({}); }
    } else if (['owner', 'admin'].includes(nextProfile.role)) {
      nextState = normalizeState(clone(state));
    } else {
      nextState = normalizeState({ business: { name: nextProfile.business_name || 'MoorePrint' } });
    }
    state = nextState;
    scopedUserId = userId;
    persistScopedState();
  }

  function dateValue(item) {
    const value = item?.updatedAt || item?.createdAt || '';
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function mergeRows(localRows, remoteRows) {
    const map = new Map();
    [...(localRows || []), ...(remoteRows || [])].forEach(row => {
      if (!row?.id) return;
      const current = map.get(row.id);
      if (!current || dateValue(row) >= dateValue(current)) map.set(row.id, row);
    });
    return [...map.values()];
  }

  function branchById(id) { return branches.find(branch => branch.branch_id === id); }
  function memberById(id) { return members.find(member => member.user_id === id); }
  function currentBranchId() {
    if (!profile) return '';
    if (!isAdmin()) return profile.branch_id || '';
    if (selectedBranchId && selectedBranchId !== 'all') return selectedBranchId;
    return profile.branch_id || branches[0]?.branch_id || '';
  }

  function currentBranchName() {
    if (isAdmin() && selectedBranchId === 'all') return 'Todas las sucursales';
    return branchById(currentBranchId())?.name || profile?.branch_name || 'Sucursal';
  }

  function selectedBranchForNewOrder() {
    return currentBranchId();
  }

  function selectedBranchCode(branchId) {
    return branchById(branchId)?.code || 'SUC';
  }

  function nextBranchFolio(branchId) {
    const code = selectedBranchCode(branchId);
    const highest = state.orders.filter(order => order.branchId === branchId).reduce((max, order) => {
      const match = String(order.folio || '').match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    return `${code}-${String(highest + 1).padStart(4, '0')}`;
  }

  function setBranchStatus(message, type = '') {
    const node = document.querySelector('#branchSyncStatus');
    if (!node) return;
    node.className = `branch-sync-status${type ? ` ${type}` : ''}`;
    const text = node.querySelector('span:last-child');
    if (text) text.textContent = message;
  }

  function publicOrderPayload(order) {
    const payload = clone(order);
    payload.branchId = order.branchId || currentBranchId();
    payload.assignedTo = order.assignedTo || '';
    payload.items = (payload.items || []).map(item => {
      const copy = { ...item };
      delete copy.cost;
      delete copy.recipe;
      return copy;
    });
    delete payload.deliveryCost;
    delete payload.inventoryApplied;
    delete payload.inventorySnapshot;
    return payload;
  }

  function financialOrderPayload(order) {
    return {
      itemCosts: (order.items || []).map(item => ({ cost: num(item.cost), recipe: clone(item.recipe || []) })),
      deliveryCost: num(order.deliveryCost),
      inventoryApplied: Boolean(order.inventoryApplied),
      inventorySnapshot: clone(order.inventorySnapshot || [])
    };
  }

  function hydrateOrder(row, financial) {
    const order = { ...(row.public_payload || {}) };
    order.id = row.order_id;
    order.folio = row.folio || order.folio || '';
    order.customer = row.customer_name || order.customer || '';
    order.status = row.status || order.status || 'pendiente';
    order.dueDate = row.due_date || order.dueDate || todayISO();
    order.branchId = row.branch_id;
    order.assignedTo = row.assigned_to || order.assignedTo || '';
    order.createdBy = row.created_by || order.createdBy || '';
    order.updatedBy = row.updated_by || order.updatedBy || '';
    order.createdAt = row.created_at || order.createdAt;
    order.updatedAt = row.updated_at || order.updatedAt;
    if (financial?.financial_payload) {
      const detail = financial.financial_payload;
      order.items = (order.items || []).map((item, index) => ({
        ...item,
        cost: num(detail.itemCosts?.[index]?.cost),
        recipe: clone(detail.itemCosts?.[index]?.recipe || [])
      }));
      order.deliveryCost = num(detail.deliveryCost);
      order.inventoryApplied = Boolean(detail.inventoryApplied);
      order.inventorySnapshot = clone(detail.inventorySnapshot || []);
    } else {
      order.items = (order.items || []).map(item => ({ ...item, cost: 0, recipe: [] }));
      order.deliveryCost = 0;
      order.inventoryApplied = false;
      order.inventorySnapshot = [];
    }
    return order;
  }

  async function loadProfile() {
    const { data, error } = await client.rpc('get_my_branch_profile');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.user_id) throw new Error('Tu usuario no tiene una sucursal asignada.');
    profile = {
      user_id: row.user_id,
      email: row.email || authUser?.email || '',
      display_name: row.display_name || row.email || '',
      role: row.role || 'staff',
      business_id: row.business_id,
      branch_id: row.branch_id,
      permissions: row.permissions || {},
      business_name: row.business_name || 'MoorePrint',
      branch_name: row.branch_name || ''
    };
    switchToScopedState(profile);
    selectedBranchId = isAdmin() ? (state.business?.selectedBranchId || 'all') : profile.branch_id;
  }

  async function loadBranches() {
    const { data, error } = await client.from('branches').select('*').eq('active', true).order('name');
    if (error) throw error;
    branches = data || [];
    if (!isAdmin()) selectedBranchId = profile.branch_id;
    if (isAdmin() && selectedBranchId !== 'all' && !branches.some(branch => branch.branch_id === selectedBranchId)) selectedBranchId = 'all';
  }

  async function loadMembers() {
    const { data, error } = await client.rpc('list_branch_members');
    if (error) throw error;
    members = data || [];
  }

  async function syncPublicProducts() {
    if (!profile) return;
    if (isAdmin() || can('manage_catalog')) {
      const rows = (state.products || []).map(product => ({
        business_id: profile.business_id,
        product_id: product.id,
        name: product.name || '',
        category: product.category || '',
        sale_price: num(product.salePrice),
        active: true,
        updated_at: product.updatedAt || new Date().toISOString()
      }));
      if (rows.length) {
        const { error } = await client.from('branch_products').upsert(rows, { onConflict: 'business_id,product_id' });
        if (error) throw error;
      }
      return;
    }
    const { data, error } = await client.from('branch_products').select('*').eq('active', true).order('name');
    if (error) throw error;
    state.products = (data || []).map(row => ({
      id: row.product_id,
      name: row.name,
      category: row.category || '',
      salePrice: num(row.sale_price),
      recipe: [], laborCost: 0, designCost: 0, electricityCost: 0, packagingCost: 0,
      transportCost: 0, externalCost: 0, extraCost: 0, wastePercent: 0, commissionPercent: 0,
      autoPrice: false, targetMarginPercent: 0, priceRounding: 1, productionMinutes: 0,
      publicOnly: true, updatedAt: row.updated_at
    }));
  }

  async function loadBranchOrders(options = {}) {
    if (!client || !profile) return;
    if (!options.silent) setBranchStatus('Actualizando pedidos de la sucursal…');
    let query = client.from('branch_orders').select('*').order('updated_at', { ascending: false });
    if (isAdmin() && selectedBranchId !== 'all') query = query.eq('branch_id', selectedBranchId);
    const { data: orderRows, error } = await query;
    if (error) throw error;

    let financialMap = new Map();
    if (can('view_costs')) {
      let financeQuery = client.from('branch_order_financials').select('*');
      if (isAdmin() && selectedBranchId !== 'all') financeQuery = financeQuery.eq('branch_id', selectedBranchId);
      const { data: financialRows, error: financialError } = await financeQuery;
      if (financialError) throw financialError;
      financialMap = new Map((financialRows || []).map(row => [row.order_id, row]));
    }

    const remoteOrders = (orderRows || []).map(row => hydrateOrder(row, financialMap.get(row.order_id)));
    const defaultBranch = currentBranchId();
    let localOrders = (state.orders || []).map(order => ({
      ...order,
      branchId: order.branchId || defaultBranch,
      assignedTo: order.assignedTo || '',
      createdBy: order.createdBy || profile.user_id,
      updatedBy: order.updatedBy || profile.user_id
    }));
    if (isAdmin() && selectedBranchId !== 'all') localOrders = localOrders.filter(order => order.branchId === selectedBranchId);
    if (!isAdmin()) localOrders = localOrders.filter(order => order.branchId === profile.branch_id);

    state.orders = mergeRows(localOrders, remoteOrders).sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
    persistScopedState();
    renderAll();
    hydrated = true;
    if (!options.skipSync) scheduleSync(250);
    setBranchStatus(`${state.orders.length} pedido${state.orders.length === 1 ? '' : 's'} cargado${state.orders.length === 1 ? '' : 's'} · ${currentBranchName()}`, 'synced');
  }

  async function syncOrders() {
    if (!client || !profile || !hydrated || syncing || !hasCloudAccess()) return false;
    syncing = true;
    setBranchStatus('Sincronizando pedidos y asignaciones…');
    try {
      const accessibleOrders = (state.orders || []).filter(order => {
        if (!order.branchId) return false;
        if (isAdmin() && selectedBranchId === 'all') return true;
        return order.branchId === currentBranchId();
      });
      const orderRows = accessibleOrders.map(order => ({
        business_id: profile.business_id,
        branch_id: order.branchId,
        order_id: order.id,
        folio: order.folio || '',
        customer_name: order.customer || entityName(state.customers || [], order.customerId, ''),
        status: order.status || 'pendiente',
        due_date: order.dueDate || todayISO(),
        assigned_to: order.assignedTo || null,
        public_payload: publicOrderPayload(order),
        created_by: order.createdBy || profile.user_id,
        updated_by: profile.user_id,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: order.updatedAt || new Date().toISOString()
      }));
      if (orderRows.length) {
        const { error } = await client.from('branch_orders').upsert(orderRows, { onConflict: 'business_id,order_id' });
        if (error) throw error;
      }

      if (can('view_costs') && accessibleOrders.length) {
        const financeRows = accessibleOrders.map(order => ({
          business_id: profile.business_id,
          branch_id: order.branchId,
          order_id: order.id,
          financial_payload: financialOrderPayload(order),
          updated_at: order.updatedAt || new Date().toISOString()
        }));
        const { error } = await client.from('branch_order_financials').upsert(financeRows, { onConflict: 'business_id,order_id' });
        if (error) throw error;
      }

      await syncPublicProducts();
      setBranchStatus('Pedidos, sucursales y catálogo sincronizados.', 'synced');
      return true;
    } catch (error) {
      const missing = /branch_orders|branch_products|branch_order_financials|get_my_branch_profile|schema cache|does not exist/i.test(error.message || '');
      setBranchStatus(missing ? 'Falta ejecutar supabase/branches.sql.' : `No se pudo sincronizar: ${error.message}`, 'error');
      return false;
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(delay = 1000) {
    if (!profile || !hydrated) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncOrders, delay);
  }

  async function deleteRemoteOrder(order) {
    if (!client || !profile || !order?.id) return;
    await client.from('branch_orders').delete().eq('business_id', profile.business_id).eq('order_id', order.id);
    await client.from('sales').delete().eq('business_id', profile.business_id).eq('order_id', order.id).catch(() => {});
  }

  function hookSaves() {
    if (saveHooked || typeof saveState !== 'function') return;
    const base = saveState;
    saveState = function (...args) {
      const result = base(...args);
      persistScopedState();
      scheduleSync();
      return result;
    };
    saveHooked = true;
  }

  function permissionOptions(role, permissions = {}) {
    const effective = { ...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff), ...(permissions || {}) };
    return PERMISSIONS.map(item => `<label class="permission-check"><input type="checkbox" name="permission_${item.key}" ${effective[item.key] ? 'checked' : ''}><span><strong>${escapeValue(item.label)}</strong><small>${escapeValue(item.help)}</small></span></label>`).join('');
  }

  function branchOptions(selected = '', includeAll = false) {
    return `${includeAll ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>Todas las sucursales</option>` : ''}${branches.map(branch => `<option value="${branch.branch_id}" ${selected === branch.branch_id ? 'selected' : ''}>${escapeValue(branch.name)} · ${escapeValue(branch.code)}</option>`).join('')}`;
  }

  function assignedOptions(branchId, selected = '') {
    const visible = members.filter(member => member.active !== false && (!branchId || member.branch_id === branchId));
    return `<option value="">Sin asignar</option>${visible.map(member => `<option value="${member.user_id}" ${selected === member.user_id ? 'selected' : ''}>${escapeValue(member.display_name || member.email)} · ${escapeValue(roleLabel(member.role))}</option>`).join('')}`;
  }

  function injectTopbar() {
    const topbar = document.querySelector('.topbar');
    const actions = document.querySelector('.topbar-actions');
    if (!topbar || !actions) return;
    let container = document.querySelector('#branchTopbar');
    if (!container) {
      actions.insertAdjacentHTML('beforebegin', '<div class="branch-topbar" id="branchTopbar"></div>');
      container = document.querySelector('#branchTopbar');
    }
    const initial = (profile?.display_name || profile?.email || 'U').trim().slice(0, 1).toUpperCase();
    container.innerHTML = `${isAdmin() ? `<select class="branch-selector" id="branchSelector" aria-label="Sucursal activa">${branchOptions(selectedBranchId, true)}</select>` : `<div class="branch-context-pill">🏪 ${escapeValue(currentBranchName())}</div>`}<div class="branch-user-chip"><span class="branch-user-avatar">${escapeValue(initial)}</span><span class="branch-user-copy"><strong>${escapeValue(profile?.display_name || profile?.email || '')}</strong><small>${escapeValue(roleLabel(profile?.role))} · ${escapeValue(currentBranchName())}</small></span></div>`;
  }

  function injectOrdersContext() {
    const section = document.querySelector('#orders');
    const toolbar = section?.querySelector('.section-toolbar');
    if (!section || !toolbar) return;
    if (!document.querySelector('#branchOrdersContext')) toolbar.insertAdjacentHTML('beforebegin', '<div class="branch-context-strip" id="branchOrdersContext"></div>');
    const context = document.querySelector('#branchOrdersContext');
    if (context) context.innerHTML = `<span class="branch-context-pill">🏪 ${escapeValue(currentBranchName())}</span><span class="branch-context-pill">👤 ${escapeValue(roleLabel(profile?.role))}</span>`;
    if (!document.querySelector('#assignmentFilter')) {
      const status = document.querySelector('#orderStatusFilter');
      status?.insertAdjacentHTML('afterend', '<select id="assignmentFilter"><option value="all">Todos los responsables</option><option value="mine">Mis pedidos</option><option value="unassigned">Sin asignar</option></select>');
    }
  }

  function branchCardsMarkup() {
    if (!branches.length) return '<div class="branch-empty">No hay sucursales registradas.</div>';
    return `<div class="branch-card-list">${branches.map(branch => `<article class="branch-card ${branch.active === false ? 'member-inactive' : ''}"><div class="branch-card-header"><div><h3>${escapeValue(branch.name)}</h3><p>${escapeValue(branch.address || 'Sin dirección')}</p></div><span class="branch-code">${escapeValue(branch.code)}</span></div><div class="action-group" style="margin-top:10px"><button class="button secondary small" type="button" data-edit-branch="${branch.branch_id}">Editar</button>${branch.branch_id !== profile?.branch_id ? `<button class="button ${branch.active === false ? 'primary' : 'danger'} small" type="button" data-toggle-branch="${branch.branch_id}" data-active="${branch.active !== false}">${branch.active === false ? 'Activar' : 'Desactivar'}</button>` : ''}</div></article>`).join('')}</div>`;
  }

  function memberCardsMarkup() {
    if (!members.length) return '<div class="branch-empty">No hay empleados registrados.</div>';
    return `<div class="member-card-list">${members.map(member => `<article class="member-card ${member.active === false ? 'member-inactive' : ''}"><div class="member-card-header"><div><h3>${escapeValue(member.display_name || member.email)}</h3><p>${escapeValue(member.email)}<br>${escapeValue(member.branch_name || 'Sin sucursal')}</p></div><span class="member-role ${escapeValue(member.role)}">${escapeValue(roleLabel(member.role))}</span></div>${isAdmin() && member.user_id !== profile.user_id ? `<div class="action-group" style="margin-top:10px"><button class="button secondary small" type="button" data-edit-member="${member.user_id}">Permisos</button><button class="button ${member.active === false ? 'primary' : 'danger'} small" type="button" data-toggle-member="${member.user_id}" data-active="${member.active !== false}">${member.active === false ? 'Reactivar' : 'Desactivar'}</button></div>` : ''}</article>`).join('')}</div>`;
  }

  function injectAdminPanel() {
    const grid = document.querySelector('#settings .settings-grid');
    if (!grid || !profile) return;
    let panel = document.querySelector('#branchAdminPanel');
    if (!panel) {
      grid.insertAdjacentHTML('afterbegin', '<article class="panel" id="branchAdminPanel"></article>');
      panel = document.querySelector('#branchAdminPanel');
    }
    if (!isAdmin() && !can('manage_users')) {
      panel.innerHTML = `<div class="panel-header"><div><h2>Mi acceso</h2><p>Sucursal y permisos asignados.</p></div></div><div class="branch-context-strip"><span class="branch-context-pill">🏪 ${escapeValue(currentBranchName())}</span><span class="branch-context-pill">👤 ${escapeValue(roleLabel(profile.role))}</span></div><div class="branch-sync-status" id="branchSyncStatus"><span class="dot"></span><span>Pedidos de sucursal activos.</span></div>`;
      return;
    }
    panel.innerHTML = `<div class="panel-header"><div><h2>Sucursales, empleados y permisos</h2><p>Cada empleado ve únicamente la sucursal y los módulos que le asignes.</p></div><div class="inline-actions"><button class="button secondary" id="newBranchButton" type="button">+ Sucursal</button><button class="button primary" id="newMemberButton" type="button">+ Empleado</button></div></div><div class="branch-member-help"><strong>Antes de registrar un empleado:</strong> crea su correo en Supabase → Authentication → Users → Add user. Después agrégalo aquí y selecciona su sucursal y permisos.</div><div class="branch-admin-grid" style="margin-top:14px"><section><div class="section-title"><div><h3>Sucursales</h3></div></div><div id="branchCards">${branchCardsMarkup()}</div></section><section><div class="section-title"><div><h3>Usuarios</h3></div></div><div id="memberCards">${memberCardsMarkup()}</div></section></div><div class="branch-sync-status" id="branchSyncStatus"><span class="dot"></span><span>Sincronización de sucursales activa.</span></div>`;
  }

  function refreshManagementUI() {
    injectTopbar();
    injectOrdersContext();
    injectAdminPanel();
    applyPermissions();
  }

  function openBranchModal(branchId = '') {
    const branch = branches.find(item => item.branch_id === branchId) || { branch_id: '', name: '', code: '', address: '' };
    openModal(branchId ? 'Editar sucursal' : 'Nueva sucursal', `<form id="branchForm" class="modal-form"><input type="hidden" name="branchId" value="${escapeValue(branch.branch_id)}"><label>Nombre de la sucursal<input name="name" required value="${escapeValue(branch.name)}" placeholder="Ej. Sucursal Centro"></label><label>Clave para folios<input name="code" required maxlength="8" value="${escapeValue(branch.code)}" placeholder="Ej. CEN"></label><label class="full">Dirección<input name="address" value="${escapeValue(branch.address || '')}"></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="branchForm">Guardar sucursal</button>');
  }

  function openMemberModal(userId = '') {
    const member = members.find(item => item.user_id === userId) || { email: '', display_name: '', role: 'staff', branch_id: branches[0]?.branch_id || '', permissions: {} };
    const edit = Boolean(userId);
    openModal(edit ? 'Editar empleado y permisos' : 'Registrar empleado', `<form id="branchMemberForm" class="modal-form"><input type="hidden" name="userId" value="${escapeValue(userId)}"><label class="full">Correo creado en Supabase<input name="email" type="email" required value="${escapeValue(member.email)}" ${edit ? 'readonly' : ''}></label><label>Nombre para mostrar<input name="displayName" required value="${escapeValue(member.display_name || '')}"></label><label>Sucursal<select name="branchId" required>${branchOptions(member.branch_id, false)}</select></label><label>Rol<select name="role" id="memberRoleSelect"><option value="staff" ${member.role === 'staff' ? 'selected' : ''}>Empleado</option><option value="manager" ${member.role === 'manager' ? 'selected' : ''}>Encargado</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Administrador</option></select></label><div class="full"><div class="section-title"><div><h3>Permisos</h3><p>Puedes activar o quitar cada permiso.</p></div></div><div class="branch-permission-grid" id="memberPermissionGrid">${permissionOptions(member.role, member.permissions)}</div></div><div class="branch-member-help full">La contraseña se administra desde Supabase. MoorePrint nunca muestra ni guarda la contraseña del empleado.</div></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="branchMemberForm">Guardar empleado</button>', true);
  }

  async function saveBranchForm(form) {
    const values = Object.fromEntries(new FormData(form));
    const { error } = await client.rpc('save_branch', {
      p_branch_id: values.branchId || null,
      p_name: String(values.name || '').trim(),
      p_code: String(values.code || '').trim().toUpperCase(),
      p_address: String(values.address || '').trim()
    });
    if (error) return showToast(error.message, 'error');
    closeModal(true);
    await loadBranches();
    refreshManagementUI();
    showToast(values.branchId ? 'Sucursal actualizada' : 'Sucursal creada');
  }

  function permissionsFromForm(form) {
    return Object.fromEntries(PERMISSIONS.map(item => [item.key, Boolean(form.elements[`permission_${item.key}`]?.checked)]));
  }

  async function saveMemberForm(form) {
    const values = Object.fromEntries(new FormData(form));
    const { error } = await client.rpc('save_branch_member', {
      p_email: String(values.email || '').trim().toLowerCase(),
      p_display_name: String(values.displayName || '').trim(),
      p_branch_id: values.branchId,
      p_role: values.role,
      p_permissions: permissionsFromForm(form)
    });
    if (error) return showToast(error.message, 'error');
    closeModal(true);
    await loadMembers();
    refreshManagementUI();
    showToast('Empleado, sucursal y permisos guardados');
  }

  async function toggleMember(userId, active) {
    const { error } = await client.rpc('set_branch_member_active', { p_user_id: userId, p_active: !active });
    if (error) return showToast(error.message, 'error');
    await loadMembers();
    refreshManagementUI();
    showToast(active ? 'Empleado desactivado' : 'Empleado reactivado');
  }

  async function toggleBranch(branchId, active) {
    const { error } = await client.rpc('set_branch_active', { p_branch_id: branchId, p_active: !active });
    if (error) return showToast(error.message, 'error');
    await loadBranches();
    refreshManagementUI();
    showToast(active ? 'Sucursal desactivada' : 'Sucursal activada');
  }

  function injectOrderBranchFields(form, existing, isNew) {
    if (!form || form.querySelector('[name="branchId"]')) return;
    const branchId = existing?.branchId || selectedBranchForNewOrder();
    const assignedTo = existing?.assignedTo || '';
    const firstGrid = form.querySelector('.form-section .modal-form');
    if (!firstGrid) return;
    const branchField = isAdmin()
      ? `<label>Sucursal<select name="branchId" id="orderBranchSelect" required>${branchOptions(branchId, false)}</select></label>`
      : `<label>Sucursal<input value="${escapeValue(currentBranchName())}" readonly><input type="hidden" name="branchId" value="${escapeValue(branchId)}"></label>`;
    firstGrid.insertAdjacentHTML('afterbegin', `${branchField}<label>Asignado a<select name="assignedTo" id="orderAssignedSelect">${assignedOptions(branchId, assignedTo)}</select></label>`);

    const banner = `<div class="branch-order-banner"><div><strong>Pedido de ${escapeValue(branchById(branchId)?.name || currentBranchName())}</strong><small>${isNew ? 'El folio y la visibilidad se asignan por sucursal.' : 'Solo usuarios autorizados de esta sucursal pueden verlo.'}</small></div><span class="branch-code">${escapeValue(selectedBranchCode(branchId))}</span></div>`;
    form.insertAdjacentHTML('afterbegin', banner);

    if (isNew && form.elements.folio) form.elements.folio.value = nextBranchFolio(branchId);
    applyOrderFormPermissions(form);
  }

  function applyOrderFormPermissions(form) {
    if (!form || can('view_costs')) return;
    form.querySelectorAll('.line-cost').forEach(input => {
      input.value = '0';
      input.classList.add('branch-finance-hidden');
    });
    const deliveryCost = form.elements.deliveryCost;
    deliveryCost?.closest('label')?.classList.add('branch-finance-hidden');
    ['docCost', 'docProfit'].forEach(id => document.querySelector(`#${id}`)?.closest('.summary-row')?.classList.add('branch-finance-hidden'));
    const costHelp = [...form.querySelectorAll('p')].find(node => /costo interno/i.test(node.textContent || ''));
    if (costHelp) costHelp.textContent = 'Los costos internos están protegidos para este usuario.';
  }

  function wrapOrderFunctions() {
    const baseOpenOrderModal = openOrderModal;
    openOrderModal = function (id = '', quoteId = '') {
      const existing = state.orders.find(order => order.id === id);
      if (existing && !can('edit_orders')) return showToast('No tienes permiso para editar pedidos.', 'error');
      if (!existing && !can('create_orders')) return showToast('No tienes permiso para crear pedidos.', 'error');
      baseOpenOrderModal(id, quoteId);
      const form = document.querySelector('#orderForm');
      injectOrderBranchFields(form, existing, !existing);
      updateDocumentPreview();
    };

    const baseSaveOrder = saveOrder;
    saveOrder = function (form) {
      if (!can(form.elements.id?.value && state.orders.some(order => order.id === form.elements.id.value) ? 'edit_orders' : 'create_orders')) return showToast('No tienes permiso para guardar este pedido.', 'error');
      const orderId = form.elements.id?.value;
      const branchId = form.elements.branchId?.value || selectedBranchForNewOrder();
      const assignedTo = form.elements.assignedTo?.value || '';
      const isNew = !state.orders.some(order => order.id === orderId);
      if (isNew && form.elements.folio) form.elements.folio.value = nextBranchFolio(branchId);
      baseSaveOrder(form);
      const order = state.orders.find(item => item.id === orderId);
      if (!order) return;
      order.branchId = branchId;
      order.assignedTo = assignedTo;
      order.createdBy = order.createdBy || profile.user_id;
      order.updatedBy = profile.user_id;
      order.updatedAt = new Date().toISOString();
      const assigned = memberById(assignedTo);
      if (assigned && !order.responsible) order.responsible = assigned.display_name || assigned.email;
      persistScopedState();
      renderAll();
      scheduleSync(100);
    };

    const basePerformDelete = typeof performDelete === 'function' ? performDelete : null;
    if (basePerformDelete) performDelete = function (type, id) {
      if (type === 'order' && !can('delete_orders')) return showToast('No tienes permiso para eliminar pedidos.', 'error');
      const order = type === 'order' ? clone(state.orders.find(item => item.id === id) || null) : null;
      const result = basePerformDelete(type, id);
      if (order && !state.orders.some(item => item.id === id)) deleteRemoteOrder(order).catch(error => showToast(error.message, 'error'));
      return result;
    };
  }

  function wrapNavigationAndRendering() {
    const baseNavigate = navigate;
    navigate = function (section) {
      const permission = SECTION_PERMISSIONS[section];
      if (permission && !can(permission)) {
        showToast('Ese módulo no está habilitado para tu usuario.', 'error');
        return baseNavigate('orders');
      }
      return baseNavigate(section);
    };

    const baseRenderOrders = renderOrders;
    renderOrders = function () {
      const filter = document.querySelector('#assignmentFilter')?.value || 'all';
      const original = state.orders;
      if (filter === 'mine') state.orders = original.filter(order => order.assignedTo === profile?.user_id);
      if (filter === 'unassigned') state.orders = original.filter(order => !order.assignedTo);
      try { return baseRenderOrders(); }
      finally {
        state.orders = original;
        applyOrderActionPermissions();
      }
    };

    const baseRenderAll = renderAll;
    renderAll = function () {
      const result = baseRenderAll();
      refreshManagementUI();
      return result;
    };
  }

  function applyOrderActionPermissions() {
    if (!can('manage_payments')) document.querySelectorAll('[data-pay-order]').forEach(button => button.remove());
    if (!can('edit_orders')) document.querySelectorAll('[data-edit-order]').forEach(button => button.remove());
    if (!can('delete_orders')) document.querySelectorAll('[data-delete-order]').forEach(button => button.remove());
  }

  function toggleElement(element, visible) {
    if (!element) return;
    element.classList.toggle('branch-restricted', !visible);
  }

  function applyPermissions() {
    if (!profile) return;
    document.querySelectorAll('.nav-item[data-section]').forEach(button => {
      const permission = SECTION_PERMISSIONS[button.dataset.section];
      toggleElement(button, !permission || can(permission));
    });
    document.querySelectorAll('.page-section[id]').forEach(section => {
      const permission = SECTION_PERMISSIONS[section.id];
      if (permission) toggleElement(section, can(permission));
    });

    toggleElement(document.querySelector('#quickOrderButton'), can('create_orders'));
    toggleElement(document.querySelector('#newOrderButton'), can('create_orders'));
    toggleElement(document.querySelector('#productionNewOrder'), can('create_orders'));
    toggleElement(document.querySelector('#backupButton'), isAdmin());

    if (!can('view_finances')) {
      ['metricSales', 'metricProfit', 'metricCash', 'metricPayable', 'metricInventory'].forEach(id => toggleElement(document.querySelector(`#${id}`)?.closest('.metric-card'), false));
      toggleElement(document.querySelector('#summaryChart')?.closest('.panel'), false);
      toggleElement(document.querySelector('#pendingPayments')?.closest('.panel'), false);
      toggleElement(document.querySelector('#goalsPanel'), false);
    }
    if (!can('view_costs')) {
      document.documentElement.classList.add('mp-hide-costs');
      toggleElement(document.querySelector('#comparisonPanel'), false);
    } else document.documentElement.classList.remove('mp-hide-costs');

    const settings = document.querySelector('#settings');
    if (settings && !isAdmin()) {
      settings.querySelectorAll('.panel').forEach(panel => {
        const allowed = ['supabasePanel', 'branchAdminPanel', 'pwaPanel'].includes(panel.id);
        toggleElement(panel, allowed);
      });
      toggleElement(document.querySelector('#businessForm')?.closest('.panel'), false);
    }
    applyOrderActionPermissions();
  }

  function bindEvents() {
    document.addEventListener('change', event => {
      if (event.target.id === 'branchSelector') {
        selectedBranchId = event.target.value || 'all';
        state.business = { ...(state.business || {}), selectedBranchId };
        persistScopedState();
        loadBranchOrders().catch(error => setBranchStatus(error.message, 'error'));
      }
      if (event.target.id === 'assignmentFilter') renderOrders();
      if (event.target.id === 'orderBranchSelect') {
        const form = event.target.form;
        const branchId = event.target.value;
        const assigned = form?.querySelector('#orderAssignedSelect');
        if (assigned) assigned.innerHTML = assignedOptions(branchId, '');
        if (modalContext?.isNew && form?.elements.folio) form.elements.folio.value = nextBranchFolio(branchId);
        const banner = form?.querySelector('.branch-order-banner strong');
        if (banner) banner.textContent = `Pedido de ${branchById(branchId)?.name || 'Sucursal'}`;
      }
      if (event.target.id === 'orderAssignedSelect') {
        const assigned = memberById(event.target.value);
        const responsible = event.target.form?.elements.responsible;
        if (assigned && responsible && !responsible.value.trim()) responsible.value = assigned.display_name || assigned.email;
      }
      if (event.target.id === 'memberRoleSelect') {
        const grid = document.querySelector('#memberPermissionGrid');
        if (grid) grid.innerHTML = permissionOptions(event.target.value, {});
      }
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'newBranchButton') openBranchModal();
      if (target.id === 'newMemberButton') openMemberModal();
      if (target.dataset.editBranch) openBranchModal(target.dataset.editBranch);
      if (target.dataset.editMember) openMemberModal(target.dataset.editMember);
      if (target.dataset.toggleMember) toggleMember(target.dataset.toggleMember, target.dataset.active === 'true');
      if (target.dataset.toggleBranch) toggleBranch(target.dataset.toggleBranch, target.dataset.active === 'true');
    });

    document.addEventListener('submit', event => {
      if (event.target.id === 'branchForm') {
        event.preventDefault();
        saveBranchForm(event.target);
      }
      if (event.target.id === 'branchMemberForm') {
        event.preventDefault();
        saveMemberForm(event.target);
      }
    });

    window.addEventListener('focus', () => {
      if (profile && hasCloudAccess()) loadBranchOrders({ silent: true, skipSync: true }).catch(() => {});
    });
  }

  async function connectWhenReady() {
    if (!hasCloudAccess() || !window.supabase?.createClient || !config().url || !config().publishableKey) return;
    if (!client) client = window.supabase.createClient(config().url, config().publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.user) return;
    if (authUser?.id === data.session.user.id && profile && hydrated) return;
    authUser = data.session.user;
    try {
      await loadProfile();
      await Promise.all([loadBranches(), loadMembers()]);
      injectTopbar();
      injectOrdersContext();
      injectAdminPanel();
      applyPermissions();
      await syncPublicProducts();
      await loadBranchOrders();
      clearInterval(refreshTimer);
      refreshTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && hasCloudAccess()) loadBranchOrders({ silent: true, skipSync: true }).catch(() => {});
      }, 45000);
    } catch (error) {
      const missing = /get_my_branch_profile|branches|branch_orders|schema cache|does not exist/i.test(error.message || '');
      setBranchStatus(missing ? 'Falta ejecutar supabase/branches.sql.' : error.message, 'error');
      console.error('Sucursal no disponible:', error);
    }
  }

  function monitorAccess() {
    clearInterval(accessTimer);
    accessTimer = setInterval(() => {
      if (hasCloudAccess()) connectWhenReady();
      else {
        authUser = null;
        profile = null;
        hydrated = false;
      }
    }, 1300);
    connectWhenReady();
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    hookSaves();
    wrapOrderFunctions();
    wrapNavigationAndRendering();
    bindEvents();
    const observer = new MutationObserver(() => profile && applyPermissions());
    observer.observe(document.body, { childList: true, subtree: true });
    monitorAccess();
  }

  window.MoorePrintBranches = {
    init: initialize,
    sync: syncOrders,
    reload: loadBranchOrders,
    can,
    isAdmin,
    getProfile: () => profile,
    getBranches: () => clone(branches),
    getMembers: () => clone(members),
    getSelectedBranchId: () => selectedBranchId,
    getContext: () => profile ? { businessId: profile.business_id, branchId: currentBranchId(), selectedBranchId, role: profile.role } : null
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
