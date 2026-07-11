(function () {
  const PAGE_SIZE = 50;
  const EXTRA_PERMISSIONS = [
    { key: 'create_customers', label: 'Crear clientes', help: 'Permite registrar clientes nuevos.' },
    { key: 'edit_customers', label: 'Editar clientes', help: 'Permite modificar información de clientes.' },
    { key: 'delete_customers', label: 'Eliminar clientes', help: 'Permite enviar clientes a la papelera.' },
    { key: 'create_quotes', label: 'Crear cotizaciones', help: 'Permite registrar cotizaciones nuevas.' },
    { key: 'edit_quotes', label: 'Editar cotizaciones', help: 'Permite modificar cotizaciones existentes.' },
    { key: 'delete_quotes', label: 'Eliminar cotizaciones', help: 'Permite enviar cotizaciones a la papelera.' }
  ];
  const DEFAULTS = {
    owner: Object.fromEntries(EXTRA_PERMISSIONS.map(item => [item.key, true])),
    admin: Object.fromEntries(EXTRA_PERMISSIONS.map(item => [item.key, true])),
    manager: {
      create_customers: true,
      edit_customers: true,
      delete_customers: false,
      create_quotes: true,
      edit_quotes: true,
      delete_quotes: false
    },
    staff: {
      create_customers: false,
      edit_customers: false,
      delete_customers: false,
      create_quotes: false,
      edit_quotes: false,
      delete_quotes: false
    }
  };
  const pages = {
    customers: { page: 0, total: 0, loading: false },
    quotes: { page: 0, total: 0, loading: false }
  };

  let initialized = false;
  let client = null;
  let profile = null;
  let paginationReady = false;
  let queryTimer = null;
  let connectTimer = null;
  let healthChannel = null;
  let statusState = 'connecting';
  let statusDetail = 'Conectando con Supabase…';
  let wrappedApplicationFunctions = false;
  let formSubmitInstalled = false;
  let libraryHookInstalled = false;

  const branchesApi = () => window.MoorePrintBranches;
  const cloudApi = () => window.MoorePrintCloud;
  const isAdmin = () => Boolean(branchesApi()?.isAdmin?.());
  const currentProfile = () => branchesApi()?.getProfile?.() || profile;
  const selectedBranchId = () => branchesApi()?.getSelectedBranchId?.() || branchesApi()?.getContext?.()?.selectedBranchId || 'all';
  const businessId = () => branchesApi()?.getContext?.()?.businessId || currentProfile()?.business_id || '';
  const currentBranchId = () => branchesApi()?.getContext?.()?.branchId || currentProfile()?.branch_id || '';
  const cloneValue = value => {
    try { return typeof clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  };
  const escapeHtml = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const numberValue = value => typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;

  function defaultPermission(role, key) {
    return Boolean((DEFAULTS[role] || DEFAULTS.staff)[key]);
  }

  function can(permission) {
    const api = branchesApi();
    const current = currentProfile();
    if (!current) return false;
    if (api?.isAdmin?.()) return true;
    if (EXTRA_PERMISSIONS.some(item => item.key === permission)) {
      if (Object.prototype.hasOwnProperty.call(current.permissions || {}, permission)) {
        return Boolean(current.permissions[permission]);
      }
      return defaultPermission(current.role || 'staff', permission);
    }
    return Boolean(api?.can?.(permission));
  }

  function installStyles() {
    if (document.querySelector('#teamImprovementsStyles')) return;
    const style = document.createElement('style');
    style.id = 'teamImprovementsStyles';
    style.textContent = `
      .team-connection-pill {
        position: fixed;
        left: 14px;
        bottom: 14px;
        z-index: 1150;
        display: flex;
        align-items: center;
        gap: 9px;
        max-width: min(420px, calc(100vw - 28px));
        padding: 10px 12px;
        border: 1px solid #343430;
        border-radius: 999px;
        background: rgba(7,7,7,.96);
        color: #d8d8d3;
        box-shadow: 0 10px 30px rgba(0,0,0,.28);
        font: 700 12px/1.3 Inter, system-ui, sans-serif;
      }
      .team-connection-pill .team-connection-dot {
        width: 9px;
        height: 9px;
        flex: 0 0 9px;
        border-radius: 50%;
        background: #9a9a94;
      }
      .team-connection-pill[data-state="connected"] { border-color: #155e43; color: #a7e8ca; }
      .team-connection-pill[data-state="connected"] .team-connection-dot { background: #34d399; }
      .team-connection-pill[data-state="syncing"] { border-color: #725d12; color: #f4d45f; }
      .team-connection-pill[data-state="syncing"] .team-connection-dot { background: #f5c010; animation: teamPulse 1s infinite; }
      .team-connection-pill[data-state="offline"] { border-color: #7f1d1d; color: #fca5a5; }
      .team-connection-pill[data-state="offline"] .team-connection-dot { background: #ef4444; }
      .team-connection-pill[data-state="error"] { border-color: #7f1d1d; color: #fecaca; }
      .team-connection-pill[data-state="error"] .team-connection-dot { background: #ef4444; }
      .team-connection-pill button {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
      }
      .server-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin: 14px 0 4px;
        flex-wrap: wrap;
      }
      .server-pager small { min-width: 180px; text-align: center; color: #999; }
      .server-pager .button[disabled] { opacity: .38; pointer-events: none; }
      @keyframes teamPulse { 50% { opacity: .35; transform: scale(.75); } }
      @media (max-width: 700px) {
        .team-connection-pill { left: 10px; right: 10px; bottom: 74px; max-width: none; border-radius: 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function installStatusPill() {
    if (document.querySelector('#teamConnectionStatus')) return;
    const pill = document.createElement('div');
    pill.id = 'teamConnectionStatus';
    pill.className = 'team-connection-pill';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');
    pill.innerHTML = '<span class="team-connection-dot"></span><span class="team-connection-text">Conectando con Supabase…</span><button type="button" id="teamRetrySync">Reintentar</button>';
    document.body.appendChild(pill);
    renderStatus();
  }

  function renderStatus() {
    const pill = document.querySelector('#teamConnectionStatus');
    if (!pill) return;
    pill.dataset.state = statusState;
    const text = pill.querySelector('.team-connection-text');
    if (text) text.textContent = statusDetail;
    const retry = pill.querySelector('#teamRetrySync');
    if (retry) retry.hidden = !['offline', 'error'].includes(statusState);
  }

  function setStatus(stateName, detail) {
    statusState = stateName;
    statusDetail = detail || ({
      connected: 'Conectado y actualizado.',
      syncing: 'Actualizando información…',
      offline: 'Sin conexión · los cambios quedan pendientes.',
      error: 'Error de sincronización.',
      connecting: 'Conectando con Supabase…'
    }[stateName] || 'Conectando…');
    renderStatus();
  }

  function patchQueryBuilder(builder, table) {
    if (!builder || builder.__mpStartupBounded || !['team_customers', 'team_quotes', 'team_quote_financials'].includes(table)) return builder;
    const originalSelect = typeof builder.select === 'function' ? builder.select.bind(builder) : null;
    if (!originalSelect) return builder;
    builder.select = function (...args) {
      const selected = originalSelect(...args);
      if (!selected || typeof selected.range !== 'function') return selected;
      try {
        Object.defineProperty(selected, '__mpStartupBounded', { value: true, configurable: true });
      } catch (error) {}
      return selected.range(0, PAGE_SIZE - 1);
    };
    try { Object.defineProperty(builder, '__mpStartupBounded', { value: true, configurable: true }); }
    catch (error) {}
    return builder;
  }

  function patchClient(nextClient) {
    if (!nextClient || nextClient.__mpTeamImprovementsPatched || typeof nextClient.from !== 'function') return nextClient;
    const originalFrom = nextClient.from.bind(nextClient);
    nextClient.from = function (table) {
      return patchQueryBuilder(originalFrom(table), table);
    };
    try { Object.defineProperty(nextClient, '__mpTeamImprovementsPatched', { value: true }); }
    catch (error) { nextClient.__mpTeamImprovementsPatched = true; }
    return nextClient;
  }

  function patchSupabaseLibrary(library) {
    if (!library || library.__mpTeamImprovementsPatched || typeof library.createClient !== 'function') return library;
    const originalCreateClient = library.createClient.bind(library);
    library.createClient = function (...args) {
      return patchClient(originalCreateClient(...args));
    };
    try { Object.defineProperty(library, '__mpTeamImprovementsPatched', { value: true }); }
    catch (error) { library.__mpTeamImprovementsPatched = true; }
    return library;
  }

  function installSupabaseHook() {
    if (libraryHookInstalled) return;
    libraryHookInstalled = true;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'supabase');
    if (descriptor?.configurable !== false) {
      try {
        let fallbackValue = descriptor?.get ? descriptor.get.call(window) : window.supabase;
        Object.defineProperty(window, 'supabase', {
          configurable: true,
          enumerable: true,
          get() {
            const value = descriptor?.get ? descriptor.get.call(window) : fallbackValue;
            return patchSupabaseLibrary(value);
          },
          set(value) {
            if (descriptor?.set) descriptor.set.call(window, value);
            else fallbackValue = value;
            patchSupabaseLibrary(descriptor?.get ? descriptor.get.call(window) : fallbackValue);
          }
        });
      } catch (error) {
        console.warn('No fue posible instalar el límite inicial de consultas.', error);
      }
    }
    const timer = setInterval(() => {
      if (window.supabase?.createClient) patchSupabaseLibrary(window.supabase);
    }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }

  function patchBranchPermissions() {
    const api = branchesApi();
    if (!api || api.__mpGranularPermissions) return Boolean(api);
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
    api.__mpGranularPermissions = true;
    return true;
  }

  function effectiveMemberPermission(member, role, key) {
    if (Object.prototype.hasOwnProperty.call(member?.permissions || {}, key)) return Boolean(member.permissions[key]);
    return defaultPermission(role, key);
  }

  function appendGranularPermissionControls() {
    const form = document.querySelector('#branchMemberForm');
    const grid = form?.querySelector('#memberPermissionGrid');
    if (!form || !grid || grid.querySelector('[name="permission_create_customers"]')) return;
    const role = form.elements.role?.value || 'staff';
    const userId = form.elements.userId?.value || '';
    const member = branchesApi()?.getMembers?.().find(item => item.user_id === userId) || null;
    const fragment = document.createElement('div');
    fragment.style.display = 'contents';
    fragment.innerHTML = EXTRA_PERMISSIONS.map(item => `<label class="permission-check"><input type="checkbox" name="permission_${item.key}" ${effectiveMemberPermission(member, role, item.key) ? 'checked' : ''}><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.help)}</small></span></label>`).join('');
    while (fragment.firstChild) grid.appendChild(fragment.firstChild);
  }

  function permissionsFromMemberForm(form) {
    const result = {};
    form.querySelectorAll('input[name^="permission_"]').forEach(input => {
      result[input.name.replace('permission_', '')] = Boolean(input.checked);
    });
    return result;
  }

  function installMemberFormSubmit() {
    if (formSubmitInstalled) return;
    formSubmitInstalled = true;
    document.addEventListener('submit', async event => {
      const form = event.target;
      if (form?.id !== 'branchMemberForm' || !form.querySelector('[name="permission_create_customers"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const activeClient = patchClient(cloudApi()?.getClient?.());
      if (!activeClient) return window.showToast?.('Supabase todavía no está disponible.', 'error');
      const values = Object.fromEntries(new FormData(form));
      setStatus('syncing', 'Guardando permisos del empleado…');
      const { error } = await activeClient.rpc('save_branch_member', {
        p_email: String(values.email || '').trim().toLowerCase(),
        p_display_name: String(values.displayName || '').trim(),
        p_branch_id: values.branchId,
        p_role: values.role,
        p_permissions: permissionsFromMemberForm(form)
      });
      if (error) {
        setStatus('error', `No se guardaron los permisos: ${error.message}`);
        return window.showToast?.(error.message, 'error');
      }
      window.closeModal?.(true);
      window.showToast?.('Empleado y permisos separados guardados');
      setStatus('connected', 'Permisos actualizados correctamente.');
      setTimeout(() => window.location.reload(), 450);
    }, true);
  }

  function wrapFunction(name, factory) {
    const current = window[name];
    if (typeof current !== 'function' || current.__mpGranularWrapped) return false;
    const wrapped = factory(current);
    wrapped.__mpGranularWrapped = true;
    window[name] = wrapped;
    try { eval(`${name} = window[name]`); } catch (error) {}
    return true;
  }

  function applyActionPermissions() {
    const newCustomer = document.querySelector('#newCustomerButton');
    const newQuote = document.querySelector('#newQuoteButton');
    if (newCustomer) newCustomer.classList.toggle('branch-restricted', !can('create_customers'));
    if (newQuote) newQuote.classList.toggle('branch-restricted', !can('create_quotes'));
    if (!can('edit_customers')) document.querySelectorAll('[data-edit-customer]').forEach(button => button.remove());
    if (!can('delete_customers')) document.querySelectorAll('[data-delete-customer]').forEach(button => button.remove());
    if (!can('edit_quotes')) document.querySelectorAll('[data-edit-quote]').forEach(button => button.remove());
    if (!can('delete_quotes')) document.querySelectorAll('[data-delete-quote]').forEach(button => button.remove());
  }

  function installApplicationWrappers() {
    if (wrappedApplicationFunctions) return;
    const required = ['openCustomerModal', 'saveCustomer', 'openQuoteModal', 'saveQuote', 'performDelete', 'renderCustomers', 'renderQuotes'];
    if (!required.every(name => typeof window[name] === 'function')) return;

    wrapFunction('openCustomerModal', base => function (id = '') {
      const existing = Boolean(id && window.state?.customers?.some(item => item.id === id));
      const permission = existing ? 'edit_customers' : 'create_customers';
      if (!can(permission)) return window.showToast?.(existing ? 'No tienes permiso para editar clientes.' : 'No tienes permiso para crear clientes.', 'error');
      return base(id);
    });

    wrapFunction('saveCustomer', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const existing = Boolean(id && window.state?.customers?.some(item => item.id === id));
      const permission = existing ? 'edit_customers' : 'create_customers';
      if (!can(permission)) return window.showToast?.('No tienes permiso para guardar este cliente.', 'error');
      const result = base(form);
      pages.customers.page = 0;
      schedulePageRefresh('customers', 250);
      return result;
    });

    wrapFunction('openQuoteModal', base => function (id = '') {
      const existing = Boolean(id && window.state?.quotes?.some(item => item.id === id));
      const permission = existing ? 'edit_quotes' : 'create_quotes';
      if (!can(permission)) return window.showToast?.(existing ? 'No tienes permiso para editar cotizaciones.' : 'No tienes permiso para crear cotizaciones.', 'error');
      return base(id);
    });

    wrapFunction('saveQuote', base => function (form) {
      const id = form?.elements?.id?.value || '';
      const existing = Boolean(id && window.state?.quotes?.some(item => item.id === id));
      const permission = existing ? 'edit_quotes' : 'create_quotes';
      if (!can(permission)) return window.showToast?.('No tienes permiso para guardar esta cotización.', 'error');
      const result = base(form);
      pages.quotes.page = 0;
      schedulePageRefresh('quotes', 250);
      return result;
    });

    wrapFunction('performDelete', base => function (type, id) {
      if (type === 'customer' && !can('delete_customers')) return window.showToast?.('No tienes permiso para eliminar clientes.', 'error');
      if (type === 'quote' && !can('delete_quotes')) return window.showToast?.('No tienes permiso para eliminar cotizaciones.', 'error');
      return base(type, id);
    });

    wrapFunction('renderCustomers', base => function (...args) {
      const result = base(...args);
      applyActionPermissions();
      renderServerPager('customers');
      return result;
    });

    wrapFunction('renderQuotes', base => function (...args) {
      const result = base(...args);
      applyActionPermissions();
      renderServerPager('quotes');
      return result;
    });

    wrappedApplicationFunctions = true;
    applyActionPermissions();
  }

  function customerFromRow(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: row.customer_id,
      branchId: row.branch_id,
      name: row.name || payload.name || '',
      phone: row.phone || payload.phone || '',
      email: row.email || payload.email || '',
      rfc: row.rfc || payload.rfc || '',
      address: row.address || payload.address || '',
      notes: row.notes || payload.notes || '',
      createdBy: row.created_by || payload.createdBy || '',
      updatedBy: row.updated_by || payload.updatedBy || '',
      createdAt: row.created_at || payload.createdAt,
      updatedAt: row.updated_at || payload.updatedAt
    };
  }

  function quoteFromRow(row) {
    const payload = row.public_payload && typeof row.public_payload === 'object' ? row.public_payload : {};
    const financial = row.financial_payload && typeof row.financial_payload === 'object' ? row.financial_payload : {};
    const quote = {
      ...payload,
      id: row.quote_id,
      branchId: row.branch_id,
      folio: row.folio || payload.folio || '',
      customer: row.customer_name || payload.customer || '',
      status: row.status || payload.status || 'borrador',
      validUntil: row.valid_until || payload.validUntil || '',
      createdBy: row.created_by || payload.createdBy || '',
      updatedBy: row.updated_by || payload.updatedBy || '',
      createdAt: row.created_at || payload.createdAt,
      updatedAt: row.updated_at || payload.updatedAt
    };
    quote.items = (quote.items || []).map((item, index) => ({
      ...item,
      cost: numberValue(financial.itemCosts?.[index]?.cost),
      recipe: cloneValue(financial.itemCosts?.[index]?.recipe || [])
    }));
    quote.deliveryCost = numberValue(financial.deliveryCost);
    return quote;
  }

  function branchArgument() {
    const selected = selectedBranchId();
    if (isAdmin() && selected && selected !== 'all') return selected;
    if (!isAdmin()) return currentBranchId();
    return null;
  }

  function persistCurrentState() {
    try {
      if (typeof STORAGE_KEY !== 'undefined' && window.state) localStorage.setItem(STORAGE_KEY, JSON.stringify(window.state));
      const current = currentProfile();
      if (current?.user_id && window.state) localStorage.setItem(`mooreprint-control-v1-user-${current.user_id}`, JSON.stringify(window.state));
    } catch (error) {}
  }

  async function fetchCustomersPage(pageNumber = pages.customers.page) {
    if (!client || !can('view_customers') || pages.customers.loading) return false;
    pages.customers.loading = true;
    pages.customers.page = Math.max(0, pageNumber);
    setStatus('syncing', 'Actualizando clientes…');
    const search = document.querySelector('#customerSearch')?.value?.trim() || '';
    const { data, error } = await client.rpc('page_team_customers', {
      p_search: search,
      p_branch_id: branchArgument(),
      p_offset: pages.customers.page * PAGE_SIZE,
      p_limit: PAGE_SIZE
    });
    pages.customers.loading = false;
    if (error) {
      paginationReady = false;
      const missing = /page_team_customers|schema cache|does not exist/i.test(error.message || '');
      setStatus('error', missing ? 'Falta ejecutar supabase/team-improvements.sql.' : `No se cargaron los clientes: ${error.message}`);
      return false;
    }
    paginationReady = true;
    const result = data || {};
    pages.customers.total = Number(result.total || 0);
    window.state.customers = (result.rows || []).map(customerFromRow);
    persistCurrentState();
    window.renderCustomers?.();
    setStatus('connected', 'Conectado y actualizado.');
    return true;
  }

  async function fetchQuotesPage(pageNumber = pages.quotes.page) {
    if (!client || !can('view_quotes') || pages.quotes.loading) return false;
    pages.quotes.loading = true;
    pages.quotes.page = Math.max(0, pageNumber);
    setStatus('syncing', 'Actualizando cotizaciones…');
    const search = document.querySelector('#quoteSearch')?.value?.trim() || '';
    const status = document.querySelector('#quoteStatusFilter')?.value || 'all';
    const { data, error } = await client.rpc('page_team_quotes', {
      p_search: search,
      p_status: status,
      p_branch_id: branchArgument(),
      p_offset: pages.quotes.page * PAGE_SIZE,
      p_limit: PAGE_SIZE
    });
    pages.quotes.loading = false;
    if (error) {
      paginationReady = false;
      const missing = /page_team_quotes|schema cache|does not exist/i.test(error.message || '');
      setStatus('error', missing ? 'Falta ejecutar supabase/team-improvements.sql.' : `No se cargaron las cotizaciones: ${error.message}`);
      return false;
    }
    paginationReady = true;
    const result = data || {};
    pages.quotes.total = Number(result.total || 0);
    window.state.quotes = (result.rows || []).map(quoteFromRow);
    persistCurrentState();
    window.renderQuotes?.();
    setStatus('connected', 'Conectado y actualizado.');
    return true;
  }

  function pagerAnchor(type) {
    if (type === 'customers') return document.querySelector('#customersGrid');
    return document.querySelector('#quotes .panel');
  }

  function renderServerPager(type) {
    if (!paginationReady) return;
    const page = pages[type];
    const anchor = pagerAnchor(type);
    if (!anchor) return;
    const maxPage = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
    page.page = Math.min(page.page, maxPage - 1);
    const id = `teamPager-${type}`;
    let node = document.querySelector(`#${id}`);
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      anchor.insertAdjacentElement('afterend', node);
    }
    node.innerHTML = `<div class="server-pager"><button class="button secondary small" type="button" data-server-page-prev="${type}" ${page.page <= 0 ? 'disabled' : ''}>← Anterior</button><small>Página ${page.page + 1} de ${maxPage} · ${page.total} registros</small><button class="button secondary small" type="button" data-server-page-next="${type}" ${page.page >= maxPage - 1 ? 'disabled' : ''}>Siguiente →</button></div>`;
  }

  function schedulePageRefresh(type, delay = 300) {
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => {
      if (type === 'customers') fetchCustomersPage(pages.customers.page);
      if (type === 'quotes') fetchQuotesPage(pages.quotes.page);
    }, delay);
  }

  async function retryAll() {
    if (!navigator.onLine) return setStatus('offline', 'Sin conexión · los cambios quedan pendientes.');
    setStatus('syncing', 'Reintentando sincronización…');
    try {
      await Promise.allSettled([
        branchesApi()?.sync?.(),
        window.MoorePrintTeamWorkflow?.sync?.(),
        fetchCustomersPage(pages.customers.page),
        fetchQuotesPage(pages.quotes.page)
      ]);
      setStatus('connected', 'Conectado y actualizado.');
    } catch (error) {
      setStatus('error', `No se pudo sincronizar: ${error.message}`);
    }
  }

  function subscribeHealth() {
    if (!client || !businessId() || healthChannel || typeof client.channel !== 'function') return;
    healthChannel = client.channel(`mooreprint-health-${businessId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_customers', filter: `business_id=eq.${businessId()}` }, () => schedulePageRefresh('customers', 180))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_quotes', filter: `business_id=eq.${businessId()}` }, () => schedulePageRefresh('quotes', 180))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setStatus('connected', 'Conectado y actualizado.');
        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) setStatus('error', 'La actualización en tiempo real se interrumpió.');
        if (status === 'CLOSED' && navigator.onLine) setStatus('connecting', 'Reconectando con Supabase…');
      });
  }

  function monitorExistingStatuses() {
    const observer = new MutationObserver(() => {
      if (!navigator.onLine) return setStatus('offline', 'Sin conexión · los cambios quedan pendientes.');
      const nodes = [document.querySelector('#branchSyncStatus'), document.querySelector('#teamWorkflowStatus')].filter(Boolean);
      const combined = nodes.map(node => node.textContent || '').join(' ');
      if (/no se pudo|error|falta ejecutar/i.test(combined)) setStatus('error', combined.trim().slice(0, 180));
      else if (/sincronizando|actualizando|guardando/i.test(combined)) setStatus('syncing', combined.trim().slice(0, 180));
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function bindEvents() {
    document.addEventListener('input', event => {
      if (event.target.id === 'customerSearch') {
        pages.customers.page = 0;
        schedulePageRefresh('customers');
      }
      if (event.target.id === 'quoteSearch') {
        pages.quotes.page = 0;
        schedulePageRefresh('quotes');
      }
    });
    document.addEventListener('change', event => {
      if (event.target.id === 'quoteStatusFilter') {
        pages.quotes.page = 0;
        schedulePageRefresh('quotes', 80);
      }
      if (event.target.id === 'branchSelector') {
        pages.customers.page = 0;
        pages.quotes.page = 0;
        setTimeout(() => {
          fetchCustomersPage(0);
          fetchQuotesPage(0);
        }, 200);
      }
      if (event.target.id === 'memberRoleSelect') setTimeout(appendGranularPermissionControls, 0);
    });
    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.id === 'teamRetrySync') retryAll();
      if (target.dataset.serverPagePrev) {
        const type = target.dataset.serverPagePrev;
        const nextPage = Math.max(0, pages[type].page - 1);
        type === 'customers' ? fetchCustomersPage(nextPage) : fetchQuotesPage(nextPage);
      }
      if (target.dataset.serverPageNext) {
        const type = target.dataset.serverPageNext;
        const nextPage = pages[type].page + 1;
        type === 'customers' ? fetchCustomersPage(nextPage) : fetchQuotesPage(nextPage);
      }
    });
    window.addEventListener('offline', () => setStatus('offline', 'Sin conexión · los cambios quedan pendientes.'));
    window.addEventListener('online', retryAll);
  }

  function connectWhenReady() {
    clearTimeout(connectTimer);
    patchBranchPermissions();
    installApplicationWrappers();
    appendGranularPermissionControls();
    const nextClient = patchClient(cloudApi()?.getClient?.());
    const nextProfile = currentProfile();
    if (!nextClient || !nextProfile || !cloudApi()?.hasAccess?.()) {
      connectTimer = setTimeout(connectWhenReady, 120);
      return;
    }
    client = nextClient;
    profile = nextProfile;
    subscribeHealth();
    Promise.allSettled([
      can('view_customers') ? fetchCustomersPage(0) : Promise.resolve(false),
      can('view_quotes') ? fetchQuotesPage(0) : Promise.resolve(false)
    ]).then(() => {
      if (navigator.onLine && statusState !== 'error') setStatus('connected', 'Conectado y actualizado.');
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installStyles();
    installStatusPill();
    installSupabaseHook();
    installMemberFormSubmit();
    bindEvents();
    monitorExistingStatuses();
    const observer = new MutationObserver(() => {
      patchBranchPermissions();
      installApplicationWrappers();
      appendGranularPermissionControls();
      applyActionPermissions();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (!navigator.onLine) setStatus('offline', 'Sin conexión · los cambios quedan pendientes.');
    connectWhenReady();
  }

  window.MoorePrintTeamImprovements = {
    init,
    can,
    setStatus,
    fetchCustomersPage,
    fetchQuotesPage,
    retry: retryAll,
    getPages: () => cloneValue(pages),
    getStatus: () => ({ state: statusState, detail: statusDetail })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
