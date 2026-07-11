(function () {
  const MODULE_KEY = 'mooreprint-hardening-v1';
  const QUEUE_PREFIX = `${MODULE_KEY}-queue`;
  const BASELINE_PREFIX = `${MODULE_KEY}-baseline`;
  const LOCK_TYPES = new Set(['material', 'purchase', 'expense', 'cash_closing']);

  const EXTRA_PERMISSIONS = [
    ['view_suppliers', 'Ver proveedores', 'Consulta el directorio de proveedores.'],
    ['create_suppliers', 'Crear proveedores', 'Registra proveedores nuevos.'],
    ['edit_suppliers', 'Editar proveedores', 'Modifica proveedores existentes.'],
    ['delete_suppliers', 'Eliminar proveedores', 'Elimina proveedores sin relaciones activas.'],
    ['view_materials', 'Ver materiales', 'Consulta existencias y movimientos.'],
    ['create_materials', 'Crear materiales', 'Registra materiales nuevos.'],
    ['edit_materials', 'Editar materiales', 'Modifica información de materiales.'],
    ['delete_materials', 'Eliminar materiales', 'Elimina materiales sin relaciones.'],
    ['adjust_inventory', 'Ajustar inventario', 'Realiza entradas, salidas y ajustes.'],
    ['view_purchases', 'Ver compras', 'Consulta compras y saldos pendientes.'],
    ['create_purchases', 'Crear compras', 'Registra compras nuevas.'],
    ['edit_purchases', 'Editar compras', 'Modifica compras existentes.'],
    ['cancel_purchases', 'Cancelar compras', 'Elimina o revierte compras.'],
    ['view_expenses', 'Ver gastos', 'Consulta gastos y vencimientos.'],
    ['create_expenses', 'Crear gastos', 'Registra gastos nuevos.'],
    ['edit_expenses', 'Editar gastos', 'Modifica gastos existentes.'],
    ['delete_expenses', 'Eliminar gastos', 'Elimina gastos y recurrentes.'],
    ['view_cash', 'Ver caja', 'Consulta movimientos y cortes.'],
    ['create_cash_transactions', 'Crear movimientos de caja', 'Registra entradas y salidas manuales.'],
    ['edit_cash_transactions', 'Editar movimientos de caja', 'Corrige movimientos manuales.'],
    ['delete_cash_transactions', 'Eliminar movimientos de caja', 'Elimina movimientos manuales.'],
    ['register_payments', 'Registrar pagos', 'Registra cobros y pagos.'],
    ['create_cash_closings', 'Realizar cortes', 'Guarda cortes personales de caja.'],
    ['edit_cash_closings', 'Corregir cortes', 'Permite corregir un corte ya guardado.'],
    ['view_activity', 'Ver historial', 'Consulta el historial de acciones.'],
    ['export_activity', 'Exportar historial', 'Descarga el historial en CSV.'],
    ['restore_backups', 'Restaurar respaldos', 'Restaura respaldos automáticos completos.']
  ].map(([key, label, help]) => ({ key, label, help }));

  const ROLE_DEFAULTS = {
    owner: Object.fromEntries(EXTRA_PERMISSIONS.map(item => [item.key, true])),
    admin: Object.fromEntries(EXTRA_PERMISSIONS.map(item => [item.key, true])),
    manager: {
      view_suppliers: false, create_suppliers: false, edit_suppliers: false, delete_suppliers: false,
      view_materials: true, create_materials: false, edit_materials: false, delete_materials: false, adjust_inventory: false,
      view_purchases: false, create_purchases: false, edit_purchases: false, cancel_purchases: false,
      view_expenses: false, create_expenses: false, edit_expenses: false, delete_expenses: false,
      view_cash: true, create_cash_transactions: false, edit_cash_transactions: false, delete_cash_transactions: false,
      register_payments: true, create_cash_closings: true, edit_cash_closings: false,
      view_activity: false, export_activity: false, restore_backups: false
    },
    staff: Object.fromEntries(EXTRA_PERMISSIONS.map(item => [item.key, false]))
  };

  const TYPE_COLLECTION = {
    supplier: 'suppliers',
    material: 'materials',
    purchase: 'purchases',
    expense: 'expenses',
    recurring_expense: 'recurringExpenses',
    cash_transaction: 'cashTransactions',
    inventory_movement: 'inventoryMovements'
  };

  let initialized = false;
  let connected = false;
  let hardeningReady = false;
  let client = null;
  let profile = null;
  let queue = [];
  let flushing = false;
  let connectTimer = null;
  let retryTimer = null;
  let currentLock = null;
  let lockHeartbeat = null;
  let backupRows = [];
  let patchedClient = null;

  const branchesApi = () => window.MoorePrintBranches;
  const cloudApi = () => window.MoorePrintCloud;
  const context = () => branchesApi()?.getContext?.() || {};
  const businessId = () => context().businessId || profile?.business_id || '';
  const branchId = () => context().branchId || profile?.branch_id || '';
  const selectedBranchId = () => context().selectedBranchId || branchesApi()?.getSelectedBranchId?.() || 'all';
  const isAdmin = () => Boolean(branchesApi()?.isAdmin?.());
  const isOwner = () => (branchesApi()?.getProfile?.()?.role || profile?.role) === 'owner';
  const nowISO = () => new Date().toISOString();
  const safeClone = value => {
    try { return typeof clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  };
  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const number = value => typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;
  const moneyValue = value => typeof money === 'function'
    ? money(value)
    : new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(number(value));
  const today = () => typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);

  function defaultPermission(role, key) {
    return Boolean((ROLE_DEFAULTS[role] || ROLE_DEFAULTS.staff)[key]);
  }

  function can(permission) {
    const current = branchesApi()?.getProfile?.() || profile;
    if (!current) return false;
    if (isAdmin()) return true;
    if (Object.prototype.hasOwnProperty.call(current.permissions || {}, permission)) return Boolean(current.permissions[permission]);
    return defaultPermission(current.role || 'staff', permission) || Boolean(branchesApi()?.can?.(permission));
  }

  function queueKey() {
    return `${QUEUE_PREFIX}-${businessId() || 'pending'}`;
  }

  function persistQueue() {
    try { localStorage.setItem(queueKey(), JSON.stringify(queue)); }
    catch (error) { console.warn('No se pudo guardar la cola de sincronización.', error); }
    renderQueueStatus();
  }

  function loadQueue() {
    try {
      const stored = JSON.parse(localStorage.getItem(queueKey()) || '[]');
      queue = Array.isArray(stored) ? stored : [];
    } catch (error) {
      queue = [];
    }
    renderQueueStatus();
  }

  function persistState() {
    if (!window.state) return;
    try {
      if (typeof STORAGE_KEY !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(window.state));
      if (profile?.user_id) localStorage.setItem(`mooreprint-control-v1-user-${profile.user_id}`, JSON.stringify(window.state));
    } catch (error) {}
  }

  function installStyles() {
    if (document.querySelector('#teamHardeningStyles')) return;
    const style = document.createElement('style');
    style.id = 'teamHardeningStyles';
    style.textContent = `
      .team-pending-queue{position:fixed;right:14px;bottom:14px;z-index:1152;padding:10px 12px;border:1px solid #343430;border-radius:999px;background:rgba(7,7,7,.96);color:#d8d8d3;font:700 12px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}
      .team-pending-queue[data-count="0"]{border-color:#155e43;color:#a7e8ca}.team-pending-queue[data-error="true"]{border-color:#7f1d1d;color:#fecaca}
      .team-hardening-lock{margin:0 0 14px;padding:12px;border:1px solid #155e43;border-radius:12px;background:#092117;color:#a7e8ca}.team-hardening-lock.danger{border-color:#7f1d1d;background:#260b0b;color:#fecaca}.team-hardening-lock small{display:block;margin-top:4px}
      .team-hardening-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.team-hardening-list{display:grid;gap:8px;max-height:360px;overflow:auto}.team-hardening-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:11px;border:1px solid #30302d;border-radius:12px;background:#0b0b0b}.team-hardening-row small{display:block;color:#999;margin-top:3px}
      .team-hardening-status{padding:10px 12px;border:1px solid #343430;border-radius:11px;background:#0b0b0b;color:#aaa}.team-hardening-status.ok{border-color:#155e43;color:#a7e8ca}.team-hardening-status.warning{border-color:#725d12;color:#f4d45f}.team-hardening-status.error{border-color:#7f1d1d;color:#fecaca}
      .hardening-hidden{display:none!important}@media(max-width:760px){.team-pending-queue{left:10px;right:10px;bottom:122px;text-align:center;border-radius:14px}.team-hardening-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderQueueStatus() {
    let badge = document.querySelector('#teamPendingQueue');
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.id = 'teamPendingQueue';
      badge.className = 'team-pending-queue';
      document.body.appendChild(badge);
    }
    const failed = queue.some(item => item.status === 'conflict' || item.status === 'error');
    badge.dataset.count = String(queue.length);
    badge.dataset.error = failed ? 'true' : 'false';
    badge.textContent = queue.length
      ? `${queue.length} cambio${queue.length === 1 ? '' : 's'} pendiente${queue.length === 1 ? '' : 's'}${failed ? ' · revisar' : ''}`
      : 'Todos los cambios sincronizados';
  }

  function setCloudStatus(stateName, detail) {
    window.MoorePrintTeamImprovements?.setStatus?.(stateName, detail);
  }

  function showQueuePanel() {
    const rows = queue.length ? queue.map(item => `<div class="team-hardening-row"><div><strong>${html(item.label || 'Cambio pendiente')}</strong><small>${html(new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.createdAt)))}</small><small>${html(item.lastError || (item.status === 'conflict' ? 'Conflicto pendiente de revisión.' : 'Esperando conexión.'))}</small></div>${item.status === 'conflict' || item.status === 'error' ? `<button class="button danger small" type="button" data-discard-queue="${html(item.id)}">Descartar</button>` : ''}</div>`).join('') : '<p class="empty-message">No hay cambios pendientes.</p>';
    window.openModal?.('Sincronización pendiente', `<div class="team-hardening-list">${rows}</div>`, '<button class="button secondary" data-close-modal>Cerrar</button><button class="button primary" type="button" id="retryHardeningQueue">Reintentar ahora</button>');
  }

  function enqueueBatch(label, operations, targetBranch = branchId()) {
    const clean = (operations || []).filter(Boolean);
    if (!clean.length) return null;
    const item = {
      id: crypto.randomUUID(),
      label,
      branchId: targetBranch,
      operations: clean,
      createdAt: nowISO(),
      attempts: 0,
      status: 'pending',
      lastError: ''
    };
    queue.push(item);
    persistQueue();
    setCloudStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? `${queue.length} cambio${queue.length === 1 ? '' : 's'} por sincronizar…` : `${queue.length} cambio${queue.length === 1 ? '' : 's'} guardado${queue.length === 1 ? '' : 's'} sin conexión.`);
    scheduleFlush(100);
    return item.id;
  }

  function applyReturnedVersions(result) {
    (result?.versions || []).forEach(versionRow => {
      const key = TYPE_COLLECTION[versionRow.entity_type];
      const record = key ? window.state?.[key]?.find(item => item.id === versionRow.entity_id) : null;
      if (record) record.cloudVersion = Number(versionRow.version || 0);
    });
    persistState();
  }

  async function flushQueue() {
    if (flushing || !hardeningReady || !client || !navigator.onLine || !queue.length) return false;
    flushing = true;
    setCloudStatus('syncing', `Sincronizando ${queue.length} cambio${queue.length === 1 ? '' : 's'} pendiente${queue.length === 1 ? '' : 's'}…`);
    try {
      for (const item of [...queue]) {
        if (item.status === 'conflict') continue;
        item.attempts += 1;
        item.status = 'sending';
        persistQueue();
        const { data, error } = await client.rpc('commit_team_batch', {
          p_operation_id: item.id,
          p_branch_id: item.branchId || branchId(),
          p_operations: item.operations
        });
        if (error) {
          item.lastError = error.message || 'No se pudo sincronizar.';
          item.status = /CONFLICT:/i.test(item.lastError) ? 'conflict' : 'error';
          persistQueue();
          window.MoorePrintOperations?.reportError?.('offline-queue', error, { operationId: item.id, label: item.label });
          if (item.status === 'conflict') window.showToast?.('Otro integrante modificó uno de los registros. Revisa la cola pendiente.', 'error');
          break;
        }
        applyReturnedVersions(data || {});
        queue = queue.filter(row => row.id !== item.id);
        persistQueue();
      }
      if (!queue.length) setCloudStatus('connected', 'Conectado y actualizado.');
      else if (queue.some(item => item.status === 'conflict')) setCloudStatus('error', 'Hay cambios con conflicto pendientes de revisión.');
      else setCloudStatus('offline', `${queue.length} cambio${queue.length === 1 ? '' : 's'} pendiente${queue.length === 1 ? '' : 's'} de sincronización.`);
      return !queue.length;
    } finally {
      flushing = false;
    }
  }

  function scheduleFlush(delay = 350) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flushQueue, delay);
  }

  function patchClient(nextClient) {
    if (!nextClient || nextClient.__mpHardeningPatched) return nextClient;
    const originalRpc = nextClient.rpc.bind(nextClient);
    nextClient.rpc = function (name, params, options) {
      if (hardeningReady && name === 'sync_team_records') return Promise.resolve({ data: 0, error: null });
      return originalRpc(name, params, options);
    };

    const originalFrom = nextClient.from.bind(nextClient);
    nextClient.from = function (table) {
      const builder = originalFrom(table);
      if (!builder || builder.__mpHardeningBuilder) return builder;
      if (['branch_orders', 'branch_order_financials', 'team_cash_closings'].includes(table) && typeof builder.upsert === 'function') {
        const originalUpsert = builder.upsert.bind(builder);
        builder.upsert = function (...args) {
          if (hardeningReady) return Promise.resolve({ data: null, error: null });
          return originalUpsert(...args);
        };
      }
      try { Object.defineProperty(builder, '__mpHardeningBuilder', { value: true, configurable: true }); }
      catch (error) { builder.__mpHardeningBuilder = true; }
      return builder;
    };
    try { Object.defineProperty(nextClient, '__mpHardeningPatched', { value: true }); }
    catch (error) { nextClient.__mpHardeningPatched = true; }
    return nextClient;
  }

  function patchSupabaseLibrary(library) {
    if (!library || library.__mpHardeningLibrary || typeof library.createClient !== 'function') return library;
    const originalCreateClient = library.createClient.bind(library);
    library.createClient = function (...args) { return patchClient(originalCreateClient(...args)); };
    try { Object.defineProperty(library, '__mpHardeningLibrary', { value: true }); }
    catch (error) { library.__mpHardeningLibrary = true; }
    return library;
  }

  function installSupabaseHook() {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (descriptor?.configurable === false) {
      if (window.supabase) patchSupabaseLibrary(window.supabase);
      return;
    }
    try {
      let fallback = descriptor?.get ? descriptor.get.call(window) : window.supabase;
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() { return patchSupabaseLibrary(descriptor?.get ? descriptor.get.call(window) : fallback); },
        set(value) {
          if (descriptor?.set) descriptor.set.call(window, value);
          else fallback = value;
          patchSupabaseLibrary(descriptor?.get ? descriptor.get.call(window) : fallback);
        }
      });
      if (fallback) patchSupabaseLibrary(fallback);
    } catch (error) {
      console.warn('No fue posible instalar la protección transaccional.', error);
    }
  }

  function patchBranchPermissions() {
    const api = branchesApi();
    if (!api || api.__mpHardeningPermissions) return Boolean(api);
    const baseCan = typeof api.can === 'function' ? api.can.bind(api) : () => false;
    api.can = function (permission) {
      const current = api.getProfile?.();
      if (!current) return false;
      if (api.isAdmin?.()) return true;
      if (EXTRA_PERMISSIONS.some(item => item.key === permission)) {
        if (Object.prototype.hasOwnProperty.call(current.permissions || {}, permission)) return Boolean(current.permissions[permission]);
        return defaultPermission(current.role || 'staff', permission);
      }
      return baseCan(permission);
    };
    api.__mpHardeningPermissions = true;
    return true;
  }

  function appendPermissionControls() {
    const form = document.querySelector('#branchMemberForm');
    const grid = form?.querySelector('#memberPermissionGrid');
    if (!form || !grid || grid.querySelector('[name="permission_view_suppliers"]')) return;
    const role = form.elements.role?.value || 'staff';
    const userId = form.elements.userId?.value || '';
    const member = branchesApi()?.getMembers?.().find(item => item.user_id === userId) || null;
    EXTRA_PERMISSIONS.forEach(item => {
      const checked = Object.prototype.hasOwnProperty.call(member?.permissions || {}, item.key)
        ? Boolean(member.permissions[item.key])
        : defaultPermission(role, item.key);
      grid.insertAdjacentHTML('beforeend', `<label class="permission-check"><input type="checkbox" name="permission_${item.key}" ${checked ? 'checked' : ''}><span><strong>${html(item.label)}</strong><small>${html(item.help)}</small></span></label>`);
    });
  }

  function setElementVisible(selector, visible) {
    document.querySelectorAll(selector).forEach(node => node.classList.toggle('hardening-hidden', !visible));
  }

  function applyActionPermissions() {
    setElementVisible('#newSupplierButton', can('create_suppliers'));
    setElementVisible('#newMaterialButton', can('create_materials'));
    setElementVisible('#inventoryAdjustmentButton', can('adjust_inventory'));
    setElementVisible('#newPurchaseButton', can('create_purchases'));
    setElementVisible('#newExpenseButton,#newRecurringButton', can('create_expenses'));
    setElementVisible('#newCashTransactionButton', can('create_cash_transactions'));
    setElementVisible('#cashClosingButton,#teamNewCashClosing', can('create_cash_closings'));
    setElementVisible('[data-edit-supplier]', can('edit_suppliers'));
    setElementVisible('[data-delete-supplier]', can('delete_suppliers'));
    setElementVisible('[data-edit-material]', can('edit_materials'));
    setElementVisible('[data-adjust-material]', can('adjust_inventory'));
    setElementVisible('[data-delete-material]', can('delete_materials'));
    setElementVisible('[data-edit-purchase]', can('edit_purchases'));
    setElementVisible('[data-delete-purchase]', can('cancel_purchases'));
    setElementVisible('[data-edit-expense],[data-edit-recurring]', can('edit_expenses'));
    setElementVisible('[data-delete-expense],[data-delete-recurring]', can('delete_expenses'));
    setElementVisible('[data-pay-order],[data-pay-purchase],[data-pay-expense]', can('register_payments'));
    setElementVisible('#teamActivityExport', can('export_activity'));

    const sectionRules = {
      suppliers: can('view_suppliers'), inventory: can('view_materials'), purchases: can('view_purchases'),
      expenses: can('view_expenses'), recurring: can('view_expenses'), cash: can('view_cash'), activity: can('view_activity')
    };
    Object.entries(sectionRules).forEach(([section, visible]) => {
      setElementVisible(`.nav-item[data-section="${section}"]`, visible);
      const node = document.getElementById(section);
      if (node && !visible && node.classList.contains('active')) window.navigate?.('dashboard');
    });
  }

  function wrapFunction(name, factory, marker = '__mpHardeningWrapped') {
    const current = window[name];
    if (typeof current !== 'function' || current[marker]) return false;
    const wrapped = factory(current);
    wrapped[marker] = true;
    window[name] = wrapped;
    try { eval(`${name} = window[name]`); } catch (error) {}
    return true;
  }

  function collection(type) {
    const key = TYPE_COLLECTION[type];
    return key ? window.state?.[key] || [] : [];
  }

  function recordOperation(type, record, action = 'save') {
    if (!record?.id) return null;
    return {
      kind: 'record_upsert',
      action,
      entity_type: type,
      entity_id: record.id,
      branch_id: record.branchId || branchId(),
      payload: safeClone(record),
      occurred_on: ['purchase', 'expense', 'cash_transaction', 'inventory_movement'].includes(type) ? record.date || today() : null,
      expected_version: record.cloudVersion || null,
      created_at: record.createdAt || nowISO()
    };
  }

  function orderOperation(order, action = 'save') {
    if (!order?.id) return null;
    return {
      kind: 'order_upsert', action,
      entity_id: order.id,
      branch_id: order.branchId || branchId(),
      payload: safeClone(order)
    };
  }

  function materialIdsFromDocument(record) {
    const ids = new Set();
    (record?.inventorySnapshot || []).forEach(row => row.materialId && ids.add(row.materialId));
    (record?.items || []).forEach(item => (item.recipe || []).forEach(row => row.materialId && ids.add(row.materialId)));
    return ids;
  }

  function materialIdsFromPurchase(record) {
    return new Set((record?.items || []).map(item => item.materialId).filter(Boolean));
  }

  function relatedInventoryOperations(referenceId, materialIds) {
    const operations = [];
    (window.state?.materials || []).filter(item => materialIds.has(item.id)).forEach(item => operations.push(recordOperation('material', item, 'derived_inventory')));
    (window.state?.inventoryMovements || []).filter(item => item.referenceId === referenceId).forEach(item => operations.push(recordOperation('inventory_movement', item, 'derived_inventory')));
    return operations;
  }

  async function acquireLock(type, id, targetBranch, force = false) {
    if (!hardeningReady || !client || !id || !LOCK_TYPES.has(type)) return { acquired: true, unavailable: true };
    const { data, error } = await client.rpc('acquire_team_edit_lock', {
      p_entity_type: type,
      p_entity_id: id,
      p_branch_id: targetBranch || branchId(),
      p_force: force
    });
    if (error) {
      window.MoorePrintOperations?.reportError?.('acquire-hardening-lock', error, { type, id });
      return { acquired: true, unavailable: true, error };
    }
    return data || { acquired: false };
  }

  function startLockHeartbeat() {
    clearInterval(lockHeartbeat);
    if (!currentLock?.acquired || currentLock.unavailable) return;
    lockHeartbeat = setInterval(async () => {
      if (!currentLock || !client) return;
      await client.rpc('heartbeat_team_edit_lock', {
        p_entity_type: currentLock.type,
        p_entity_id: currentLock.id
      }).catch(() => {});
    }, 45000);
  }

  async function releaseLock() {
    const lock = currentLock;
    currentLock = null;
    clearInterval(lockHeartbeat);
    if (!lock?.acquired || lock.unavailable || !client) return;
    await client.rpc('release_team_edit_lock', {
      p_entity_type: lock.type,
      p_entity_id: lock.id
    }).catch(() => {});
  }

  function injectLockBanner(form, lock, type, id) {
    if (!form || form.querySelector('.team-hardening-lock')) return;
    const banner = document.createElement('div');
    if (lock.unavailable) {
      banner.className = 'team-hardening-lock';
      banner.innerHTML = '<strong>No se pudo verificar la edición simultánea.</strong><small>El cambio quedará en la cola si la conexión falla.</small>';
    } else if (lock.acquired) {
      banner.className = 'team-hardening-lock';
      banner.innerHTML = '<strong>Edición reservada para ti.</strong><small>Otro integrante recibirá un aviso si abre este registro.</small>';
    } else {
      banner.className = 'team-hardening-lock danger';
      banner.innerHTML = `<strong>${html(lock.user_name || 'Otro integrante')} está editando este registro.</strong><small>Espera a que termine o pide al propietario que tome la edición.</small>${isAdmin() ? `<button class="button danger small" type="button" data-force-hardening-lock="${html(type)}" data-lock-id="${html(id)}" style="margin-top:8px">Tomar edición</button>` : ''}`;
      form.dataset.teamEditLocked = 'true';
      document.querySelectorAll(`[form="${form.id}"]`).forEach(button => button.disabled = true);
    }
    form.insertAdjacentElement('afterbegin', banner);
  }

  function installOpenLock(name, type, key, formId, createPermission, editPermission) {
    wrapFunction(name, base => async function (id = '', ...args) {
      const existing = id ? window.state?.[key]?.find(item => item.id === id) : null;
      const permission = existing ? editPermission : createPermission;
      if (!can(permission)) return window.showToast?.('No tienes permiso para realizar esta acción.', 'error');
      let lock = null;
      if (existing) lock = await acquireLock(type, existing.id, existing.branchId || branchId());
      const result = await base(id, ...args);
      if (existing) {
        currentLock = { type, id: existing.id, branchId: existing.branchId || branchId(), acquired: Boolean(lock?.acquired), unavailable: Boolean(lock?.unavailable) };
        injectLockBanner(document.getElementById(formId), lock || { acquired:true, unavailable:true }, type, existing.id);
        startLockHeartbeat();
      }
      return result;
    }, `__mpHardeningOpen_${type}`);
  }

  function installSaveWrappers() {
    installOpenLock('openSupplierModal', 'supplier', 'suppliers', 'supplierForm', 'create_suppliers', 'edit_suppliers');
    installOpenLock('openMaterialModal', 'material', 'materials', 'materialForm', 'create_materials', 'edit_materials');
    installOpenLock('openPurchaseModal', 'purchase', 'purchases', 'purchaseForm', 'create_purchases', 'edit_purchases');
    installOpenLock('openExpenseModal', 'expense', 'expenses', 'expenseForm', 'create_expenses', 'edit_expenses');

    wrapFunction('openInventoryAdjustment', base => function (...args) {
      if (!can('adjust_inventory')) return window.showToast?.('No tienes permiso para ajustar inventario.', 'error');
      return base.apply(this, args);
    }, '__mpHardeningAdjustmentOpen');

    wrapFunction('openPaymentModal', base => function (...args) {
      if (!can('register_payments')) return window.showToast?.('No tienes permiso para registrar pagos.', 'error');
      return base.apply(this, args);
    }, '__mpHardeningPaymentOpen');

    const simpleSaves = [
      ['saveSupplier', 'supplier', 'suppliers', 'create_suppliers', 'edit_suppliers'],
      ['saveMaterial', 'material', 'materials', 'create_materials', 'edit_materials'],
      ['saveExpense', 'expense', 'expenses', 'create_expenses', 'edit_expenses'],
      ['saveRecurring', 'recurring_expense', 'recurringExpenses', 'create_expenses', 'edit_expenses'],
      ['saveCashTransaction', 'cash_transaction', 'cashTransactions', 'create_cash_transactions', 'edit_cash_transactions']
    ];

    simpleSaves.forEach(([name, type, key, createPermission, editPermission]) => {
      wrapFunction(name, base => function (form) {
        const id = form?.elements?.id?.value || '';
        const existing = id ? window.state?.[key]?.find(item => item.id === id) : null;
        if (!can(existing ? editPermission : createPermission)) return window.showToast?.('No tienes permiso para guardar este registro.', 'error');
        if (currentLock?.type === type && currentLock.id === id && !currentLock.acquired && !currentLock.unavailable) return window.showToast?.('Otro integrante mantiene bloqueada esta edición.', 'error');
        const result = base(form);
        if (result === false) return result;
        setTimeout(() => {
          const savedId = id || form?.elements?.id?.value;
          const saved = window.state?.[key]?.find(item => item.id === savedId) || window.state?.[key]?.at(-1);
          enqueueBatch(`Guardar ${type}`, [recordOperation(type, saved)], saved?.branchId || branchId());
          releaseLock();
        }, 0);
        return result;
      }, `__mpHardeningSave_${type}`);
    });

    wrapFunction('saveAdjustment', base => function (form) {
      if (!can('adjust_inventory')) return window.showToast?.('No tienes permiso para ajustar inventario.', 'error');
      const materialId = form?.elements?.materialId?.value;
      const beforeMoves = window.state?.inventoryMovements?.length || 0;
      const result = base(form);
      if (result === false) return result;
      setTimeout(() => {
        const material = window.state?.materials?.find(item => item.id === materialId);
        const moves = (window.state?.inventoryMovements || []).slice(beforeMoves);
        enqueueBatch('Ajuste de inventario', [recordOperation('material', material, 'derived_inventory'), ...moves.map(move => recordOperation('inventory_movement', move, 'derived_inventory'))], material?.branchId || branchId());
      }, 0);
      return result;
    }, '__mpHardeningSave_adjustment');

    wrapFunction('savePurchase', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const before = safeClone(window.state?.purchases?.find(item => item.id === id) || null);
      if (!can(before ? 'edit_purchases' : 'create_purchases')) return window.showToast?.('No tienes permiso para guardar compras.', 'error');
      if (currentLock?.type === 'purchase' && currentLock.id === id && !currentLock.acquired && !currentLock.unavailable) return window.showToast?.('Otro integrante mantiene bloqueada esta compra.', 'error');
      const result = base(form);
      if (result === false) return result;
      setTimeout(() => {
        const purchase = window.state?.purchases?.find(item => item.id === id) || window.state?.purchases?.at(-1);
        const materialIds = new Set([...materialIdsFromPurchase(before), ...materialIdsFromPurchase(purchase)]);
        enqueueBatch('Compra e inventario', [recordOperation('purchase', purchase), ...relatedInventoryOperations(purchase?.id, materialIds)], purchase?.branchId || branchId());
        releaseLock();
      }, 0);
      return result;
    }, '__mpHardeningSave_purchase');

    wrapFunction('saveOrder', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const before = safeClone(window.state?.orders?.find(item => item.id === id) || null);
      const result = base(form);
      if (result === false) return result;
      setTimeout(() => {
        const order = window.state?.orders?.find(item => item.id === id) || window.state?.orders?.at(-1);
        const materialIds = new Set([...materialIdsFromDocument(before), ...materialIdsFromDocument(order)]);
        enqueueBatch('Pedido e inventario', [orderOperation(order), ...relatedInventoryOperations(order?.id, materialIds)], order?.branchId || branchId());
      }, 0);
      return result;
    }, '__mpHardeningSave_order');

    wrapFunction('savePayment', base => function (form) {
      if (!can('register_payments')) return window.showToast?.('No tienes permiso para registrar pagos.', 'error');
      const type = form?.elements?.recordType?.value;
      const id = form?.elements?.recordId?.value;
      const result = base(form);
      if (result === false) return result;
      setTimeout(() => {
        if (type === 'order') {
          const order = window.state?.orders?.find(item => item.id === id);
          enqueueBatch('Pago de pedido', [orderOperation(order, 'payment')], order?.branchId || branchId());
        } else {
          const entityType = type === 'purchase' ? 'purchase' : 'expense';
          const record = collection(entityType).find(item => item.id === id);
          enqueueBatch(type === 'purchase' ? 'Pago de compra' : 'Pago de gasto', [recordOperation(entityType, record, 'payment')], record?.branchId || branchId());
        }
      }, 0);
      return result;
    }, '__mpHardeningSave_payment');

    wrapFunction('performDelete', base => function (type, id) {
      const permissionMap = {
        supplier: 'delete_suppliers', material: 'delete_materials', purchase: 'cancel_purchases',
        expense: 'delete_expenses', recurring: 'delete_expenses'
      };
      if (permissionMap[type] && !can(permissionMap[type])) return window.showToast?.('No tienes permiso para eliminar este registro.', 'error');
      const entityType = type === 'recurring' ? 'recurring_expense' : type;
      const key = TYPE_COLLECTION[entityType];
      const before = key ? safeClone(window.state?.[key]?.find(item => item.id === id) || null) : type === 'order' ? safeClone(window.state?.orders?.find(item => item.id === id) || null) : null;
      const result = base(type, id);
      if (result === false) return result;
      setTimeout(() => {
        if (type === 'order' && before) {
          const materialIds = materialIdsFromDocument(before);
          enqueueBatch('Eliminar pedido e inventario', [{ kind:'order_delete', entity_id:id, branch_id:before.branchId || branchId() }, ...relatedInventoryOperations(id, materialIds)], before.branchId || branchId());
        } else if (before && key) {
          enqueueBatch(`Eliminar ${entityType}`, [{ kind:'record_delete', entity_type:entityType, entity_id:id, branch_id:before.branchId || branchId() }], before.branchId || branchId());
        }
      }, 0);
      return result;
    }, '__mpHardeningDelete');

    wrapFunction('closeModal', base => function (...args) {
      releaseLock();
      return base.apply(this, args);
    }, '__mpHardeningClose');
  }

  function closingPayloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form));
    const counted = number(data.counted);
    const expected = number(data.expected);
    return {
      user_id: profile?.user_id,
      user_name: profile?.display_name || profile?.email || 'Usuario',
      closing_date: data.date || today(),
      opening_amount: number(data.opening),
      cash_income: number(data.income),
      cash_out: number(data.out),
      expected_cash: expected,
      counted_cash: counted,
      difference: counted - expected,
      notes: String(data.notes || '').trim(),
      payload: {}
    };
  }

  async function prepareCashClosingLock(form) {
    if (!form || form.dataset.hardeningLockPrepared === 'true') return;
    form.dataset.hardeningLockPrepared = 'true';
    const data = Object.fromEntries(new FormData(form));
    const id = `${profile?.user_id || 'user'}:${data.date || today()}`;
    const lock = await acquireLock('cash_closing', id, branchId());
    currentLock = { type:'cash_closing', id, branchId:branchId(), acquired:Boolean(lock?.acquired), unavailable:Boolean(lock?.unavailable) };
    injectLockBanner(form, lock || { acquired:true, unavailable:true }, 'cash_closing', id);
    startLockHeartbeat();
  }

  function installCashClosingQueue() {
    document.addEventListener('submit', event => {
      const form = event.target;
      if (form?.id !== 'teamCashClosingForm') return;
      if (!can('create_cash_closings')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return window.showToast?.('No tienes permiso para realizar cortes de caja.', 'error');
      }
      const payload = closingPayloadFromForm(form);
      enqueueBatch('Corte de caja', [{ kind:'cash_closing_upsert', entity_id:`${payload.user_id}:${payload.closing_date}`, branch_id:branchId(), payload }], branchId());
      releaseLock();
    }, true);
  }

  async function loadBackups() {
    if (!client || !isAdmin()) return;
    const { data, error } = await client.from('team_backups').select('backup_id,created_at,created_by_name').order('created_at', { ascending:false }).limit(10);
    if (error) return;
    backupRows = data || [];
    renderHardeningPanel();
  }

  function renderHardeningPanel() {
    if (!isAdmin()) return;
    const grid = document.querySelector('#settings .settings-grid');
    if (!grid) return;
    let panel = document.querySelector('#teamHardeningPanel');
    if (!panel) {
      panel = document.createElement('article');
      panel.className = 'panel';
      panel.id = 'teamHardeningPanel';
      grid.appendChild(panel);
    }
    const backups = backupRows.length ? backupRows.map(row => `<div class="team-hardening-row"><div><strong>${html(new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at)))}</strong><small>${html(row.created_by_name || 'Administrador')}</small></div>${isOwner() || can('restore_backups') ? `<button class="button danger small" type="button" data-restore-backup="${html(row.backup_id)}">Restaurar</button>` : ''}</div>`).join('') : '<p class="empty-message">Todavía no hay respaldos automáticos.</p>';
    panel.innerHTML = `<div class="panel-header"><div><h2>Protección avanzada</h2><p>Cola sin conexión, transacciones seguras, conflictos y restauración.</p></div><button class="button secondary" id="hardeningSelfCheck" type="button">Probar integridad</button></div><div class="team-hardening-status ${hardeningReady ? 'ok' : 'warning'}" id="hardeningStatus">${hardeningReady ? 'Protección transaccional activa.' : 'Falta ejecutar supabase/team-hardening.sql.'}</div><div class="team-hardening-grid" style="margin-top:14px"><section><div class="section-title"><div><h3>Respaldos restaurables</h3><p>La restauración reemplaza los datos compartidos del negocio.</p></div></div><div class="team-hardening-list">${backups}</div></section><section><div class="section-title"><div><h3>Cambios pendientes</h3><p>Se conservan aunque cierres el navegador.</p></div></div><div class="team-hardening-list">${queue.length ? queue.slice(0,20).map(item => `<div class="team-hardening-row"><div><strong>${html(item.label)}</strong><small>${html(item.status)}</small></div><span>${item.attempts}</span></div>`).join('') : '<p class="empty-message">Todo está sincronizado.</p>'}</div></section></div>`;
  }

  function confirmBackupRestore(backupId) {
    const row = backupRows.find(item => item.backup_id === backupId);
    window.openModal?.('Restaurar respaldo automático', `<form id="restoreBackupForm" class="modal-form"><input type="hidden" name="backupId" value="${html(backupId)}"><div class="team-hardening-status error full"><strong>Esta acción reemplazará clientes, pedidos, cotizaciones, inventario, compras, gastos, caja y catálogo compartidos.</strong><br>Respaldo: ${row ? html(new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at))) : html(backupId)}</div><label class="full">Escribe RESTAURAR para continuar<input name="confirmation" autocomplete="off" required></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button danger" form="restoreBackupForm">Restaurar respaldo</button>');
  }

  async function restoreBackup(form) {
    const values = Object.fromEntries(new FormData(form));
    if (String(values.confirmation || '').trim().toUpperCase() !== 'RESTAURAR') return window.showToast?.('Escribe RESTAURAR para confirmar.', 'warning');
    setCloudStatus('syncing', 'Restaurando respaldo completo…');
    const { data, error } = await client.rpc('restore_team_backup', { p_backup_id: values.backupId });
    if (error) {
      setCloudStatus('error', `No se restauró el respaldo: ${error.message}`);
      return window.showToast?.(error.message, 'error');
    }
    const snapshot = data?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') return window.showToast?.('El respaldo no devolvió información válida.', 'error');
    window.state = typeof normalizeState === 'function' ? normalizeState(snapshot) : snapshot;
    queue = [];
    persistQueue();
    persistState();
    window.closeModal?.(true);
    window.showToast?.(`${Number(data.restored || 0)} registros restaurados`);
    setCloudStatus('connected', 'Respaldo restaurado correctamente.');
    setTimeout(() => location.reload(), 800);
  }

  async function runSelfCheck() {
    const { data, error } = await client.rpc('team_hardening_self_check');
    const node = document.querySelector('#hardeningStatus');
    if (error || !data?.ok) {
      if (node) { node.className = 'team-hardening-status error'; node.textContent = error?.message || 'La prueba de integridad no fue satisfactoria.'; }
      return window.showToast?.(error?.message || 'Revisión incompleta', 'error');
    }
    if (node) { node.className = 'team-hardening-status ok'; node.textContent = `Integridad correcta · ${new Intl.DateTimeFormat('es-MX',{timeStyle:'short'}).format(new Date())}`; }
    window.showToast?.('Supabase respondió correctamente');
  }

  function installEvents() {
    window.addEventListener('online', () => scheduleFlush(50));
    window.addEventListener('focus', () => scheduleFlush(100), { passive:true });
    window.addEventListener('offline', () => setCloudStatus('offline', `${queue.length} cambio${queue.length === 1 ? '' : 's'} conservado${queue.length === 1 ? '' : 's'} sin conexión.`));

    document.addEventListener('submit', event => {
      if (event.target?.id === 'restoreBackupForm') {
        event.preventDefault();
        event.stopImmediatePropagation();
        restoreBackup(event.target);
      }
    }, true);

    document.addEventListener('click', async event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'teamPendingQueue') showQueuePanel();
      if (target.id === 'retryHardeningQueue') { window.closeModal?.(); scheduleFlush(10); }
      if (target.dataset.discardQueue) {
        queue = queue.filter(item => item.id !== target.dataset.discardQueue);
        persistQueue();
        showQueuePanel();
      }
      if (target.dataset.restoreBackup) confirmBackupRestore(target.dataset.restoreBackup);
      if (target.id === 'hardeningSelfCheck') runSelfCheck();
      if (target.dataset.forceHardeningLock && target.dataset.lockId) {
        const lock = await acquireLock(target.dataset.forceHardeningLock, target.dataset.lockId, currentLock?.branchId || branchId(), true);
        if (lock?.acquired) {
          currentLock = { type:target.dataset.forceHardeningLock, id:target.dataset.lockId, branchId:currentLock?.branchId || branchId(), acquired:true, unavailable:false };
          const banner = target.closest('.team-hardening-lock');
          if (banner) { banner.className = 'team-hardening-lock'; banner.innerHTML = '<strong>Tomaste el control de la edición.</strong><small>Revisa cuidadosamente antes de guardar.</small>'; }
          document.querySelectorAll('[form]').forEach(button => button.disabled = false);
          startLockHeartbeat();
        }
      }
    });
  }

  function observeUi() {
    const observer = new MutationObserver(() => {
      appendPermissionControls();
      applyActionPermissions();
      renderHardeningPanel();
      const closing = document.querySelector('#teamCashClosingForm');
      if (closing) prepareCashClosingLock(closing);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function baselineOperations() {
    const operations = [];
    if (can('edit_orders') || can('create_orders')) (window.state?.orders || []).forEach(order => operations.push(orderOperation(order)));
    Object.entries(TYPE_COLLECTION).forEach(([type, key]) => {
      const createKey = {
        supplier:'create_suppliers', material:'create_materials', purchase:'create_purchases', expense:'create_expenses', recurring_expense:'create_expenses', cash_transaction:'create_cash_transactions', inventory_movement:'adjust_inventory'
      }[type];
      const editKey = {
        supplier:'edit_suppliers', material:'edit_materials', purchase:'edit_purchases', expense:'edit_expenses', recurring_expense:'edit_expenses', cash_transaction:'edit_cash_transactions', inventory_movement:'adjust_inventory'
      }[type];
      if (!can(createKey) && !can(editKey)) return;
      (window.state?.[key] || []).forEach(record => operations.push(recordOperation(type, record)));
    });
    return operations.filter(Boolean);
  }

  function enqueueBaselineOnce() {
    const key = `${BASELINE_PREFIX}-${businessId()}`;
    if (localStorage.getItem(key)) return;
    const operations = baselineOperations();
    for (let index = 0; index < operations.length; index += 75) enqueueBatch('Sincronización inicial segura', operations.slice(index, index + 75), branchId());
    localStorage.setItem(key, nowISO());
  }

  async function checkSchema() {
    const { data, error } = await client.rpc('team_hardening_self_check');
    hardeningReady = !error && Boolean(data?.ok);
    renderHardeningPanel();
    return hardeningReady;
  }

  async function connect() {
    if (connected) return;
    if (!cloudApi()?.hasAccess?.() || !branchesApi()?.getProfile?.()) {
      clearTimeout(connectTimer);
      connectTimer = setTimeout(connect, 120);
      return;
    }
    profile = branchesApi().getProfile();
    client = patchClient(cloudApi().getClient?.());
    if (!client || !profile) {
      connectTimer = setTimeout(connect, 120);
      return;
    }
    patchedClient = client;
    connected = true;
    patchBranchPermissions();
    loadQueue();
    hardeningReady = await checkSchema();
    if (!hardeningReady) {
      setCloudStatus('error', 'Falta ejecutar supabase/team-hardening.sql.');
      return;
    }
    await loadBackups();
    enqueueBaselineOnce();
    scheduleFlush(50);
    applyActionPermissions();
    renderHardeningPanel();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installStyles();
    installSupabaseHook();
    patchBranchPermissions();
    installSaveWrappers();
    installCashClosingQueue();
    installEvents();
    observeUi();
    renderQueueStatus();
    connect();
  }

  window.MoorePrintHardening = {
    init,
    flush: flushQueue,
    enqueue: enqueueBatch,
    restoreBackup,
    selfCheck: runSelfCheck,
    getQueue: () => safeClone(queue),
    isReady: () => hardeningReady,
    can,
    patchClient
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
