(function () {
  const PAGE_SIZE = 50;
  const MODULE_KEY = 'mooreprint-team-workflow';
  let initialized = false;
  let connected = false;
  let schemaReady = false;
  let client = null;
  let user = null;
  let profile = null;
  let realtimeChannel = null;
  let syncTimer = null;
  let refreshTimer = null;
  let connectTimer = null;
  let activityContext = null;
  let suppressActivity = false;
  let sharedActivity = [];
  let trashRows = [];
  let backupRows = [];
  let cashClosingRows = [];
  let currentShareDocument = null;
  const pages = { orders: 0, quotes: 0, customers: 0 };

  const safeClone = value => {
    try { return typeof clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
  };

  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

  const number = value => typeof num === 'function' ? num(value) : Number.parseFloat(value) || 0;
  const nowISO = () => new Date().toISOString();
  const today = () => typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10);
  const branchesApi = () => window.MoorePrintBranches;
  const cloudApi = () => window.MoorePrintCloud;
  const can = permission => Boolean(branchesApi()?.can?.(permission));
  const isAdmin = () => Boolean(branchesApi()?.isAdmin?.());
  const context = () => branchesApi()?.getContext?.() || null;
  const currentBranchId = () => context()?.branchId || profile?.branch_id || '';
  const businessId = () => context()?.businessId || profile?.business_id || '';
  const currentBranchName = () => {
    const id = currentBranchId();
    return branchesApi()?.getBranches?.().find(branch => branch.branch_id === id)?.name || profile?.branch_name || 'Sucursal';
  };

  function persistState() {
    if (typeof state === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (profile?.user_id) localStorage.setItem(`mooreprint-control-v1-user-${profile.user_id}`, JSON.stringify(state));
    } catch (error) {
      console.warn('No fue posible guardar el estado local.', error);
    }
  }

  function updatedTime(row) {
    const value = row?.updatedAt || row?.createdAt || '';
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function mergeById(localRows, remoteRows) {
    const result = new Map();
    [...(localRows || []), ...(remoteRows || [])].forEach(row => {
      if (!row?.id) return;
      const existing = result.get(row.id);
      if (!existing || updatedTime(row) >= updatedTime(existing)) result.set(row.id, row);
    });
    return [...result.values()];
  }

  function installStyles() {
    if (document.querySelector('#teamWorkflowStyles')) return;
    const style = document.createElement('style');
    style.id = 'teamWorkflowStyles';
    style.textContent = `
      .attachment-box, #orderAttachmentInput { display:none!important; }
      #ordersTable tr, #quotesTable tr, #customersGrid .entity-card {
        content-visibility:auto;
        contain-intrinsic-size:72px;
      }
      .team-pager { display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 0 4px;flex-wrap:wrap; }
      .team-pager small { color:#969690;min-width:150px;text-align:center; }
      .team-management-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px; }
      .team-management-list { display:grid;gap:9px;max-height:330px;overflow:auto; }
      .team-management-row { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #30302d;border-radius:12px;background:#0b0b0b; }
      .team-management-row small { display:block;color:#999;margin-top:3px; }
      .team-status { padding:10px 12px;border:1px solid #31312d;border-radius:11px;background:#0b0b0b;color:#aaa;font-size:12px; }
      .team-status.ok { border-color:#155e43;color:#8ce0bb; }
      .team-status.warning { border-color:#725d12;color:#f4d45f; }
      .team-note-actions { display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:14px 0; }
      .team-internal-note { border-left:3px solid #f5c010;padding-left:12px; }
      .team-cash-summary { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0; }
      .team-cash-summary > div { padding:12px;border:1px solid #30302d;border-radius:12px;background:#0b0b0b; }
      .team-cash-summary span { display:block;color:#999;font-size:11px; }
      .team-cash-summary strong { display:block;margin-top:4px;font-size:18px; }
      @media(max-width:760px){.team-management-grid,.team-cash-summary{grid-template-columns:1fr}.team-management-row{align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function removeAttachmentFeatures() {
    document.querySelectorAll('.attachment-box').forEach(element => element.remove());
    try { renderAttachmentList = async function () {}; } catch (error) {}
  }

  function setTeamStatus(message, type = '') {
    const node = document.querySelector('#teamWorkflowStatus');
    if (!node) return;
    node.className = `team-status${type ? ` ${type}` : ''}`;
    node.textContent = message;
  }

  async function checkSchema() {
    const { error } = await client.from('team_customers').select('customer_id').limit(1);
    if (!error) {
      schemaReady = true;
      return true;
    }
    schemaReady = false;
    const missing = /team_customers|schema cache|does not exist|relation/i.test(error.message || '');
    setTeamStatus(missing ? 'Falta ejecutar supabase/team-workflow.sql.' : `No se pudo iniciar el trabajo compartido: ${error.message}`, 'warning');
    return false;
  }

  function accessibleLocalRows(rows) {
    if (isAdmin() && context()?.selectedBranchId === 'all') return rows || [];
    const branchId = currentBranchId();
    return (rows || []).filter(row => !row.branchId || row.branchId === branchId);
  }

  function customerFromCloud(row) {
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

  function quoteFromCloud(row, financialRow) {
    const payload = row.public_payload && typeof row.public_payload === 'object' ? row.public_payload : {};
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
    const financial = financialRow?.financial_payload || {};
    quote.items = (quote.items || []).map((item, index) => ({
      ...item,
      cost: number(financial.itemCosts?.[index]?.cost),
      recipe: safeClone(financial.itemCosts?.[index]?.recipe || [])
    }));
    quote.deliveryCost = number(financial.deliveryCost);
    return quote;
  }

  function publicQuotePayload(quote) {
    const payload = safeClone(quote) || {};
    payload.items = (payload.items || []).map(item => {
      const copy = { ...item };
      delete copy.cost;
      delete copy.recipe;
      return copy;
    });
    delete payload.deliveryCost;
    delete payload.internalNotes;
    return payload;
  }

  function quoteFinancialPayload(quote) {
    return {
      itemCosts: (quote.items || []).map(item => ({ cost: number(item.cost), recipe: safeClone(item.recipe || []) })),
      deliveryCost: number(quote.deliveryCost)
    };
  }

  async function loadSharedActivity() {
    if (!(isAdmin() || can('view_finances') || can('manage_users'))) return [];
    let query = client.from('team_activity').select('*').order('created_at', { ascending: false }).limit(300);
    const selected = context()?.selectedBranchId;
    if (isAdmin() && selected && selected !== 'all') query = query.eq('branch_id', selected);
    const { data, error } = await query;
    if (error) throw error;
    sharedActivity = (data || []).map(row => ({
      id: row.activity_id,
      type: row.event_type || 'system',
      title: `${row.actor_name ? `${row.actor_name} · ` : ''}${row.title}`,
      detail: row.detail || '',
      referenceId: row.entity_id || '',
      createdAt: row.created_at
    }));
    return sharedActivity;
  }

  async function loadManagementData() {
    if (!isAdmin()) return;
    const [trashResult, backupResult] = await Promise.all([
      client.from('team_trash').select('*').is('restored_at', null).gt('purge_after', nowISO()).order('deleted_at', { ascending: false }).limit(100),
      client.from('team_backups').select('backup_id,created_by_name,created_at').order('created_at', { ascending: false }).limit(10)
    ]);
    if (trashResult.error) throw trashResult.error;
    if (backupResult.error) throw backupResult.error;
    trashRows = trashResult.data || [];
    backupRows = backupResult.data || [];
  }

  async function loadCashClosings() {
    if (!(isAdmin() || can('view_finances') || can('manage_payments'))) return;
    let query = client.from('team_cash_closings').select('*').order('closing_date', { ascending: false }).limit(30);
    const selected = context()?.selectedBranchId;
    if (isAdmin() && selected && selected !== 'all') query = query.eq('branch_id', selected);
    const { data, error } = await query;
    if (error) throw error;
    cashClosingRows = data || [];
    renderCashClosingPanel();
  }

  async function hydrateSharedData(options = {}) {
    if (!schemaReady || !client || !profile) return;
    try {
      let customersQuery = client.from('team_customers').select('*').order('updated_at', { ascending: false });
      let quotesQuery = client.from('team_quotes').select('*').order('updated_at', { ascending: false });
      const selected = context()?.selectedBranchId;
      if (isAdmin() && selected && selected !== 'all') {
        customersQuery = customersQuery.eq('branch_id', selected);
        quotesQuery = quotesQuery.eq('branch_id', selected);
      }

      const [customersResult, quotesResult] = await Promise.all([customersQuery, quotesQuery]);
      if (customersResult.error) throw customersResult.error;
      if (quotesResult.error) throw quotesResult.error;

      let financialMap = new Map();
      if (can('view_costs')) {
        let financialQuery = client.from('team_quote_financials').select('*');
        if (isAdmin() && selected && selected !== 'all') financialQuery = financialQuery.eq('branch_id', selected);
        const financialResult = await financialQuery;
        if (financialResult.error) throw financialResult.error;
        financialMap = new Map((financialResult.data || []).map(row => [row.quote_id, row]));
      }

      const defaultBranch = currentBranchId();
      const localCustomers = accessibleLocalRows(state.customers || []).map(row => ({ ...row, branchId: row.branchId || defaultBranch }));
      const localQuotes = accessibleLocalRows(state.quotes || []).map(row => ({ ...row, branchId: row.branchId || defaultBranch }));
      state.customers = mergeById(localCustomers, (customersResult.data || []).map(customerFromCloud));
      state.quotes = mergeById(localQuotes, (quotesResult.data || []).map(row => quoteFromCloud(row, financialMap.get(row.quote_id))));

      const activity = await loadSharedActivity();
      if (activity.length) state.activityLog = mergeById(state.activityLog || [], activity).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 1000);

      await Promise.all([loadManagementData(), loadCashClosings()]);
      persistState();
      if (!options.silent && typeof renderAll === 'function') renderAll();
      renderManagementPanel();
      setTeamStatus('Clientes, cotizaciones, historial y avisos sincronizados.', 'ok');
    } catch (error) {
      console.error('Flujo compartido no disponible:', error);
      setTeamStatus(`No se pudo actualizar el trabajo compartido: ${error.message}`, 'warning');
    }
  }

  function ensureBranchFields() {
    const branchId = currentBranchId();
    const userId = profile?.user_id || user?.id || '';
    (state.customers || []).forEach(row => {
      row.branchId = row.branchId || branchId;
      row.createdBy = row.createdBy || userId;
      row.updatedBy = row.updatedBy || userId;
    });
    (state.quotes || []).forEach(row => {
      row.branchId = row.branchId || branchId;
      row.createdBy = row.createdBy || userId;
      row.updatedBy = row.updatedBy || userId;
    });
  }

  async function syncSharedData() {
    if (!schemaReady || !client || !profile || !cloudApi()?.hasAccess?.()) return false;
    ensureBranchFields();
    const userId = profile.user_id;
    const currentBusiness = businessId();
    try {
      if (isAdmin() || can('view_customers')) {
        const customerRows = accessibleLocalRows(state.customers || []).filter(row => row.id && row.branchId).map(row => ({
          business_id: currentBusiness,
          branch_id: row.branchId,
          customer_id: row.id,
          name: row.name || '',
          phone: row.phone || '',
          email: row.email || '',
          rfc: row.rfc || '',
          address: row.address || '',
          notes: row.notes || '',
          payload: row,
          created_by: row.createdBy || userId,
          updated_by: userId,
          created_at: row.createdAt || nowISO(),
          updated_at: row.updatedAt || nowISO()
        }));
        if (customerRows.length) {
          const { error } = await client.from('team_customers').upsert(customerRows, { onConflict: 'business_id,customer_id' });
          if (error) throw error;
        }
      }

      if (isAdmin() || can('view_quotes')) {
        const quotes = accessibleLocalRows(state.quotes || []).filter(row => row.id && row.branchId);
        const quoteRows = quotes.map(row => ({
          business_id: currentBusiness,
          branch_id: row.branchId,
          quote_id: row.id,
          folio: row.folio || '',
          customer_name: row.customer || '',
          status: row.status || 'borrador',
          valid_until: row.validUntil || null,
          public_payload: publicQuotePayload(row),
          created_by: row.createdBy || userId,
          updated_by: userId,
          created_at: row.createdAt || nowISO(),
          updated_at: row.updatedAt || nowISO()
        }));
        if (quoteRows.length) {
          const { error } = await client.from('team_quotes').upsert(quoteRows, { onConflict: 'business_id,quote_id' });
          if (error) throw error;
        }
        if (can('view_costs') && quotes.length) {
          const financialRows = quotes.map(row => ({
            business_id: currentBusiness,
            branch_id: row.branchId,
            quote_id: row.id,
            financial_payload: quoteFinancialPayload(row),
            updated_at: row.updatedAt || nowISO()
          }));
          const { error } = await client.from('team_quote_financials').upsert(financialRows, { onConflict: 'business_id,quote_id' });
          if (error) throw error;
        }
      }
      setTeamStatus('Trabajo compartido actualizado.', 'ok');
      return true;
    } catch (error) {
      setTeamStatus(`No se pudo sincronizar: ${error.message}`, 'warning');
      return false;
    }
  }

  function scheduleSync(delay = 700) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncSharedData, delay);
  }

  function scheduleRefresh(delay = 400) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      branchesApi()?.reload?.({ silent: true, skipSync: true }).catch(() => {});
      hydrateSharedData({ silent: false });
    }, delay);
  }

  async function reserveFolio(documentType, branchId) {
    if (!schemaReady || !branchId) return '';
    const { data, error } = await client.rpc('reserve_team_folio', {
      p_branch_id: branchId,
      p_document_type: documentType
    });
    if (error) {
      console.warn('No se pudo reservar el folio:', error);
      return '';
    }
    return String(data || '');
  }

  async function recordActivity(activity) {
    if (!schemaReady || suppressActivity || !activity?.title) return;
    const branchId = activity.branchId || currentBranchId();
    if (!branchId) return;
    const { error } = await client.rpc('record_team_activity', {
      p_branch_id: branchId,
      p_event_type: activity.eventType || 'system',
      p_entity_type: activity.entityType || '',
      p_entity_id: activity.entityId || '',
      p_title: activity.title,
      p_detail: activity.detail || '',
      p_before_payload: activity.beforePayload || null,
      p_after_payload: activity.afterPayload || null
    });
    if (error) console.warn('No se pudo registrar la actividad:', error.message);
  }

  function inferActivity(message) {
    const value = String(message || 'Movimiento registrado');
    const lower = value.toLowerCase();
    let type = 'system';
    if (/pedido|producción|etapa/.test(lower)) type = 'order';
    else if (/cobro|pago/.test(lower)) type = 'payment';
    else if (/cotización/.test(lower)) type = 'quote';
    else if (/cliente/.test(lower)) type = 'customer';
    else if (/inventario|material|merma/.test(lower)) type = 'inventory';
    else if (/gasto|compra|caja/.test(lower)) type = 'expense';
    return { eventType: type, title: value };
  }

  function withActivity(activity, callback) {
    activityContext = activity;
    try { return callback(); }
    finally {
      if (activityContext === activity) activityContext = null;
    }
  }

  function injectInternalNotes(form, record = {}) {
    if (!form || form.querySelector('[name="internalNotes"]')) return;
    const section = document.createElement('div');
    section.className = 'form-section team-internal-note';
    section.innerHTML = `<div class="section-title"><div><h3>Nota interna del equipo</h3><p>No aparece en la nota que se entrega al cliente.</p></div></div><label class="full">Seguimiento interno<textarea name="internalNotes" rows="3">${html(record.internalNotes || '')}</textarea></label>`;
    const summary = form.querySelector('.summary-box');
    if (summary) summary.insertAdjacentElement('beforebegin', section);
    else form.appendChild(section);
  }

  function wrapStateSaves() {
    if (typeof saveState !== 'function' || saveState.__teamWorkflowWrapped) return;
    const base = saveState;
    const wrapped = function (message = '', type = 'normal') {
      const result = base(message, type);
      scheduleSync();
      const activity = activityContext ? { ...activityContext } : inferActivity(message);
      activityContext = null;
      if (message && !suppressActivity) {
        activity.afterPayload = activity.entityType && activity.entityId
          ? safeClone((activity.entityType === 'order' ? state.orders : activity.entityType === 'quote' ? state.quotes : activity.entityType === 'customer' ? state.customers : []).find(row => row.id === activity.entityId) || null)
          : activity.afterPayload;
        recordActivity(activity);
      }
      return result;
    };
    wrapped.__teamWorkflowWrapped = true;
    saveState = wrapped;
    window.saveState = wrapped;
  }

  function wrapDocumentFunctions() {
    if (typeof openOrderModal === 'function' && !openOrderModal.__teamWorkflowWrapped) {
      const baseOpenOrder = openOrderModal;
      const wrappedOpenOrder = async function (id = '', quoteId = '') {
        const existing = state.orders.find(row => row.id === id);
        let reserved = '';
        if (!existing) reserved = await reserveFolio('order', currentBranchId());
        const result = baseOpenOrder(id, quoteId);
        const form = document.querySelector('#orderForm');
        if (form) {
          if (reserved && form.elements.folio) {
            form.elements.folio.value = reserved;
            form.dataset.teamReservedFolio = reserved;
          }
          injectInternalNotes(form, existing || {});
        }
        removeAttachmentFeatures();
        return result;
      };
      wrappedOpenOrder.__teamWorkflowWrapped = true;
      openOrderModal = wrappedOpenOrder;
      window.openOrderModal = wrappedOpenOrder;
    }

    if (typeof saveOrder === 'function' && !saveOrder.__teamWorkflowWrapped) {
      const baseSaveOrder = saveOrder;
      const wrappedSaveOrder = function (form) {
        const id = form.elements.id?.value || '';
        const before = safeClone(state.orders.find(row => row.id === id) || null);
        const reserved = form.dataset.teamReservedFolio || '';
        const internalNotes = form.elements.internalNotes?.value.trim() || '';
        const result = withActivity({ eventType: 'order', entityType: 'order', entityId: id, branchId: form.elements.branchId?.value || currentBranchId(), title: before ? 'Pedido actualizado' : 'Pedido creado', beforePayload: before }, () => baseSaveOrder(form));
        const order = state.orders.find(row => row.id === id);
        if (order) {
          if (reserved) order.folio = reserved;
          order.internalNotes = internalNotes;
          order.branchId = order.branchId || currentBranchId();
          order.updatedBy = profile?.user_id || '';
          persistState();
          scheduleSync(100);
        }
        return result;
      };
      wrappedSaveOrder.__teamWorkflowWrapped = true;
      saveOrder = wrappedSaveOrder;
      window.saveOrder = wrappedSaveOrder;
    }

    if (typeof openQuoteModal === 'function' && !openQuoteModal.__teamWorkflowWrapped) {
      const baseOpenQuote = openQuoteModal;
      const wrappedOpenQuote = async function (id = '') {
        const existing = state.quotes.find(row => row.id === id);
        let reserved = '';
        if (!existing) reserved = await reserveFolio('quote', currentBranchId());
        const result = baseOpenQuote(id);
        const form = document.querySelector('#quoteForm');
        if (form) {
          if (reserved && form.elements.folio) {
            form.elements.folio.value = reserved;
            form.dataset.teamReservedFolio = reserved;
          }
          injectInternalNotes(form, existing || {});
        }
        return result;
      };
      wrappedOpenQuote.__teamWorkflowWrapped = true;
      openQuoteModal = wrappedOpenQuote;
      window.openQuoteModal = wrappedOpenQuote;
    }

    if (typeof saveQuote === 'function' && !saveQuote.__teamWorkflowWrapped) {
      const baseSaveQuote = saveQuote;
      const wrappedSaveQuote = function (form) {
        const id = form.elements.id?.value || '';
        const before = safeClone(state.quotes.find(row => row.id === id) || null);
        const reserved = form.dataset.teamReservedFolio || '';
        const internalNotes = form.elements.internalNotes?.value.trim() || '';
        const result = withActivity({ eventType: 'quote', entityType: 'quote', entityId: id, branchId: currentBranchId(), title: before ? 'Cotización actualizada' : 'Cotización creada', beforePayload: before }, () => baseSaveQuote(form));
        const quote = state.quotes.find(row => row.id === id);
        if (quote) {
          if (reserved) quote.folio = reserved;
          quote.internalNotes = internalNotes;
          quote.branchId = quote.branchId || currentBranchId();
          quote.createdBy = quote.createdBy || profile?.user_id || '';
          quote.updatedBy = profile?.user_id || '';
          persistState();
          scheduleSync(100);
        }
        return result;
      };
      wrappedSaveQuote.__teamWorkflowWrapped = true;
      saveQuote = wrappedSaveQuote;
      window.saveQuote = wrappedSaveQuote;
    }

    if (typeof saveCustomer === 'function' && !saveCustomer.__teamWorkflowWrapped) {
      const baseSaveCustomer = saveCustomer;
      const wrappedSaveCustomer = function (form) {
        const id = form.elements.id?.value || '';
        const before = safeClone(state.customers.find(row => row.id === id) || null);
        const result = withActivity({ eventType: 'customer', entityType: 'customer', entityId: id || '', branchId: currentBranchId(), title: before ? 'Cliente actualizado' : 'Cliente creado', beforePayload: before }, () => baseSaveCustomer(form));
        const customer = state.customers.find(row => row.id === id) || state.customers[state.customers.length - 1];
        if (customer) {
          customer.branchId = customer.branchId || currentBranchId();
          customer.createdBy = customer.createdBy || profile?.user_id || '';
          customer.updatedBy = profile?.user_id || '';
          persistState();
          scheduleSync(100);
        }
        return result;
      };
      wrappedSaveCustomer.__teamWorkflowWrapped = true;
      saveCustomer = wrappedSaveCustomer;
      window.saveCustomer = wrappedSaveCustomer;
    }

    if (typeof savePayment === 'function' && !savePayment.__teamWorkflowWrapped) {
      const baseSavePayment = savePayment;
      const wrappedSavePayment = function (form) {
        const recordType = form.elements.recordType?.value || '';
        const recordId = form.elements.recordId?.value || '';
        const result = withActivity({ eventType: 'payment', entityType: recordType, entityId: recordId, branchId: currentBranchId(), title: recordType === 'order' ? 'Cobro registrado' : 'Pago registrado' }, () => baseSavePayment(form));
        const collection = recordType === 'order' ? state.orders : recordType === 'purchase' ? state.purchases : state.expenses;
        const record = collection.find(row => row.id === recordId);
        const payment = record?.payments?.[record.payments.length - 1];
        if (payment) {
          payment.createdBy = payment.createdBy || profile?.user_id || '';
          payment.branchId = payment.branchId || record.branchId || currentBranchId();
          persistState();
        }
        return result;
      };
      wrappedSavePayment.__teamWorkflowWrapped = true;
      savePayment = wrappedSavePayment;
      window.savePayment = wrappedSavePayment;
    }
  }

  async function archiveInTrash(type, record) {
    if (!schemaReady || !record?.id) return true;
    const branchId = record.branchId || currentBranchId();
    const { error } = await client.from('team_trash').insert({
      business_id: businessId(),
      branch_id: branchId,
      entity_type: type,
      entity_id: record.id,
      payload: record,
      deleted_by: profile.user_id,
      deleted_by_name: profile.display_name || profile.email || 'Usuario'
    });
    if (error) {
      showToast?.(`No se pudo enviar a la papelera: ${error.message}`, 'error');
      return false;
    }
    return true;
  }

  async function deleteSharedRecord(type, id) {
    if (type === 'customer') await client.from('team_customers').delete().eq('business_id', businessId()).eq('customer_id', id);
    if (type === 'quote') await client.from('team_quotes').delete().eq('business_id', businessId()).eq('quote_id', id);
  }

  function wrapDeleteFunction() {
    if (typeof performDelete !== 'function' || performDelete.__teamWorkflowWrapped) return;
    const basePerformDelete = performDelete;
    const wrappedPerformDelete = async function (type, id) {
      const collection = type === 'order' ? state.orders : type === 'quote' ? state.quotes : type === 'customer' ? state.customers : null;
      const record = safeClone(collection?.find(row => row.id === id) || null);
      if (!record || !['order', 'quote', 'customer'].includes(type)) return basePerformDelete(type, id);
      if (type === 'customer' && (state.orders.some(row => row.customerId === id) || state.quotes.some(row => row.customerId === id))) return basePerformDelete(type, id);
      const archived = await archiveInTrash(type, record);
      if (!archived) return;
      const result = withActivity({ eventType: 'delete', entityType: type, entityId: id, branchId: record.branchId || currentBranchId(), title: `${type === 'order' ? 'Pedido' : type === 'quote' ? 'Cotización' : 'Cliente'} enviado a la papelera`, beforePayload: record }, () => basePerformDelete(type, id));
      await deleteSharedRecord(type, id);
      loadManagementData().then(renderManagementPanel).catch(() => {});
      return result;
    };
    wrappedPerformDelete.__teamWorkflowWrapped = true;
    performDelete = wrappedPerformDelete;
    window.performDelete = wrappedPerformDelete;
  }

  function pagerMarkup(key, total) {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pages[key] = Math.min(pages[key], maxPage - 1);
    return `<div class="team-pager" data-team-pager="${key}"><button class="button secondary small" type="button" data-team-page-prev="${key}" ${pages[key] <= 0 ? 'disabled' : ''}>← Anterior</button><small>Página ${pages[key] + 1} de ${maxPage} · ${total} registros</small><button class="button secondary small" type="button" data-team-page-next="${key}" ${pages[key] >= maxPage - 1 ? 'disabled' : ''}>Siguiente →</button></div>`;
  }

  function renderPager(key, total, anchor) {
    if (!anchor) return;
    const id = `teamPager-${key}`;
    let pager = document.querySelector(`#${id}`);
    if (!pager) {
      pager = document.createElement('div');
      pager.id = id;
      anchor.insertAdjacentElement('afterend', pager);
    }
    pager.innerHTML = pagerMarkup(key, total);
  }

  function wrapPagination() {
    if (typeof renderOrders === 'function' && !renderOrders.__teamPaginationWrapped) {
      const base = renderOrders;
      const wrapped = function () {
        const original = state.orders;
        const query = (document.querySelector('#orderSearch')?.value || '').trim().toLowerCase();
        const status = document.querySelector('#orderStatusFilter')?.value || 'all';
        const assignment = document.querySelector('#assignmentFilter')?.value || 'all';
        const urgency = document.querySelector('#teamUrgencyFilter')?.value || 'all';
        let rows = [...original].filter(order => status === 'all' || order.status === status).filter(order => `${order.folio} ${order.customer} ${(order.items || []).map(item => item.name).join(' ')}`.toLowerCase().includes(query));
        if (assignment === 'mine') rows = rows.filter(order => order.assignedTo === profile?.user_id);
        if (assignment === 'unassigned') rows = rows.filter(order => !order.assignedTo);
        if (urgency === 'urgent') rows = rows.filter(order => order.priority === 'urgente');
        if (urgency === 'overdue') rows = rows.filter(order => typeof isOverdue === 'function' && isOverdue(order));
        if (urgency === 'today') rows = rows.filter(order => order.dueDate === today());
        rows.sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')));
        const total = rows.length;
        const start = pages.orders * PAGE_SIZE;
        state.orders = rows.slice(start, start + PAGE_SIZE);
        try { base(); }
        finally {
          state.orders = original;
          renderPager('orders', total, document.querySelector('#orders .panel'));
        }
      };
      wrapped.__teamPaginationWrapped = true;
      renderOrders = wrapped;
      window.renderOrders = wrapped;
    }

    if (typeof renderQuotes === 'function' && !renderQuotes.__teamPaginationWrapped) {
      const base = renderQuotes;
      const wrapped = function () {
        const original = state.quotes;
        const query = (document.querySelector('#quoteSearch')?.value || '').trim().toLowerCase();
        const status = document.querySelector('#quoteStatusFilter')?.value || 'all';
        const rows = [...original].filter(quote => status === 'all' || quote.status === status).filter(quote => `${quote.folio} ${quote.customer}`.toLowerCase().includes(query)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        const total = rows.length;
        const start = pages.quotes * PAGE_SIZE;
        state.quotes = rows.slice(start, start + PAGE_SIZE);
        try { base(); }
        finally {
          state.quotes = original;
          renderPager('quotes', total, document.querySelector('#quotes .panel'));
        }
      };
      wrapped.__teamPaginationWrapped = true;
      renderQuotes = wrapped;
      window.renderQuotes = wrapped;
    }

    if (typeof renderCustomers === 'function' && !renderCustomers.__teamPaginationWrapped) {
      const base = renderCustomers;
      const wrapped = function () {
        const original = state.customers;
        const query = (document.querySelector('#customerSearch')?.value || '').trim().toLowerCase();
        const rows = original.filter(customer => `${customer.name} ${customer.phone} ${customer.email} ${customer.rfc}`.toLowerCase().includes(query));
        const total = rows.length;
        const start = pages.customers * PAGE_SIZE;
        state.customers = rows.slice(start, start + PAGE_SIZE);
        try { base(); }
        finally {
          state.customers = original;
          renderPager('customers', total, document.querySelector('#customersGrid'));
        }
      };
      wrapped.__teamPaginationWrapped = true;
      renderCustomers = wrapped;
      window.renderCustomers = wrapped;
    }
  }

  function injectUrgencyFilter() {
    if (document.querySelector('#teamUrgencyFilter')) return;
    const assignment = document.querySelector('#assignmentFilter');
    const status = document.querySelector('#orderStatusFilter');
    const anchor = assignment || status;
    anchor?.insertAdjacentHTML('afterend', '<select id="teamUrgencyFilter"><option value="all">Todas las prioridades</option><option value="urgent">Solo urgentes</option><option value="overdue">Atrasados</option><option value="today">Entrega hoy</option></select>');
  }

  function noteMessage(type, record) {
    const totals = documentTotals(record);
    const isOrder = type === 'order';
    const lines = [
      `Hola ${record.customer || 'cliente'}, compartimos el resumen de su ${isOrder ? 'pedido' : 'cotización'} en MoorePrint.`,
      '',
      `Folio: ${record.folio}`,
      `${isOrder ? 'Entrega' : 'Vigencia'}: ${isOrder ? formatDate(record.dueDate) : formatDate(record.validUntil)}`,
      `Trabajo: ${(record.items || []).map(item => `${number(item.qty)} ${item.name}`).join(', ')}`,
      `Total: ${money(totals.total)}`
    ];
    if (isOrder) lines.push(`Pagado: ${money(totals.paid)}`, `Saldo: ${money(totals.balance)}`);
    if (record.notes) lines.push(`Indicaciones: ${record.notes}`);
    if (state.business?.policies) lines.push('', `Políticas: ${state.business.policies}`);
    lines.push('', 'Gracias por su preferencia.');
    return lines.join('\n');
  }

  function teamPreviewDocument(type, id) {
    const isOrder = type === 'order';
    const record = (isOrder ? state.orders : state.quotes).find(row => row.id === id);
    if (!record) return;
    const totals = documentTotals(record);
    const business = state.business || {};
    const branch = branchesApi()?.getBranches?.().find(row => row.branch_id === record.branchId);
    currentShareDocument = { type, record, message: noteMessage(type, record) };
    const payments = isOrder ? record.payments || [] : [];
    openModal(`${isOrder ? 'Nota de pedido' : 'Cotización'} ${record.folio}`, `
      <div class="note-preview">
        <div class="note-business">
          <h2>${html(business.name || 'MoorePrint')}</h2>
          <p>${html(branch?.name || currentBranchName())}</p>
          <p>${html(branch?.address || business.address || '')}</p>
          <p>${html([business.city, business.phone, business.email].filter(Boolean).join(' · '))}</p>
          ${business.rfc ? `<p>RFC: ${html(business.rfc)}</p>` : ''}
        </div>
        <div class="note-meta">
          <div><strong>Folio:</strong> ${html(record.folio)}</div>
          <div><strong>Fecha:</strong> ${formatDate(isOrder ? record.orderDate : record.date)}</div>
          <div><strong>Cliente:</strong> ${html(record.customer || '')}</div>
          <div><strong>${isOrder ? 'Entrega' : 'Vigencia'}:</strong> ${formatDate(isOrder ? record.dueDate : record.validUntil)}</div>
          ${record.phone ? `<div><strong>WhatsApp:</strong> ${html(record.phone)}</div>` : ''}
          ${isOrder && record.responsible ? `<div><strong>Responsable:</strong> ${html(record.responsible)}</div>` : ''}
        </div>
        <table><thead><tr><th>Cant.</th><th>Descripción</th><th>Precio</th><th>Importe</th></tr></thead><tbody>
          ${(record.items || []).map(item => `<tr><td>${number(item.qty)}</td><td>${html(item.name)}</td><td>${money(item.price)}</td><td>${money(number(item.qty) * number(item.price))}</td></tr>`).join('')}
        </tbody></table>
        <div class="summary-box" style="margin-top:16px">
          <div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div>
          ${totals.discount ? `<div class="summary-row"><span>Descuento</span><strong>-${money(totals.discount)}</strong></div>` : ''}
          ${totals.tax ? `<div class="summary-row"><span>IVA</span><strong>${money(totals.tax)}</strong></div>` : ''}
          ${number(record.deliveryCharge) ? `<div class="summary-row"><span>Envío / instalación</span><strong>${money(record.deliveryCharge)}</strong></div>` : ''}
          <div class="summary-row total"><span>Total</span><strong>${money(totals.total)}</strong></div>
          ${isOrder ? `<div class="summary-row"><span>Pagado</span><strong>${money(totals.paid)}</strong></div><div class="summary-row"><span>Restante</span><strong>${money(totals.balance)}</strong></div>` : ''}
        </div>
        ${record.notes ? `<p style="margin-top:18px"><strong>Indicaciones para el cliente:</strong> ${html(record.notes)}</p>` : ''}
        ${business.bank || business.clabe ? `<p><strong>Datos de pago:</strong> ${html([business.bank, business.clabe].filter(Boolean).join(' · '))}</p>` : ''}
        ${business.policies ? `<div class="document-policy"><strong>Políticas:</strong> ${html(business.policies)}</div>` : ''}
        <p style="text-align:center;margin-top:24px">${html(business.note || 'Gracias por su preferencia.')}</p>
      </div>
      ${payments.length ? `<div class="panel" style="box-shadow:none;margin-top:15px"><h3>Pagos registrados</h3>${payments.map(payment => `<div class="mini-row"><div><strong>${formatDate(payment.date)} · ${methodName(payment.method)}</strong><small>${html(payment.reference || '')}</small></div><span>${money(payment.amount)}</span></div>`).join('')}</div>` : ''}
    `, `<button class="button secondary" data-close-modal>Cerrar</button><button class="button secondary" id="teamCopyNote" type="button">Copiar nota</button><button class="button secondary" id="teamWhatsAppNote" type="button">WhatsApp</button><button class="button primary" id="printDocumentButton" type="button">Imprimir / Guardar PDF</button>`, true);
  }

  function installNotePreview() {
    previewDocument = teamPreviewDocument;
    window.previewDocument = teamPreviewDocument;
  }

  async function shareNoteByWhatsApp() {
    if (!currentShareDocument) return;
    const phone = String(currentShareDocument.record.phone || '').replace(/\D/g, '');
    const normalized = phone.length === 10 ? `52${phone}` : phone;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(currentShareDocument.message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function copyCurrentNote() {
    if (!currentShareDocument) return;
    try {
      await navigator.clipboard.writeText(currentShareDocument.message);
      showToast?.('Nota copiada');
    } catch (error) {
      showToast?.('No se pudo copiar la nota.', 'error');
    }
  }

  function cashEntriesForUser(date) {
    if (typeof cashEntries !== 'function') return [];
    return cashEntries().filter(entry => entry.date === date).filter(entry => {
      if (entry.createdBy) return entry.createdBy === profile?.user_id;
      return isAdmin();
    });
  }

  function openTeamCashClosing() {
    const date = today();
    const entries = cashEntriesForUser(date);
    const income = entries.filter(row => row.type === 'entrada' && row.method === 'efectivo').reduce((total, row) => total + number(row.amount), 0);
    const out = entries.filter(row => row.type === 'salida' && row.method === 'efectivo').reduce((total, row) => total + number(row.amount), 0);
    const opening = number(state.business?.openingCash);
    const expected = opening + income - out;
    openModal(`Corte personal · ${formatDate(date)}`, `<form id="teamCashClosingForm" class="modal-form"><input type="hidden" name="date" value="${date}"><input type="hidden" name="opening" value="${opening}"><input type="hidden" name="income" value="${income}"><input type="hidden" name="out" value="${out}"><input type="hidden" name="expected" value="${expected}"><div class="team-cash-summary full"><div><span>Efectivo recibido</span><strong>${money(income)}</strong></div><div><span>Salidas en efectivo</span><strong>${money(out)}</strong></div><div><span>Efectivo esperado</span><strong>${money(expected)}</strong></div></div><label>Efectivo contado<input name="counted" type="number" min="0" step="0.01" value="${expected}" required></label><label class="full">Observaciones<textarea name="notes" rows="3"></textarea></label></form>`, '<button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" form="teamCashClosingForm">Guardar corte</button>');
  }

  async function saveTeamCashClosing(form) {
    const data = Object.fromEntries(new FormData(form));
    const counted = number(data.counted);
    const expected = number(data.expected);
    const row = {
      business_id: businessId(),
      branch_id: currentBranchId(),
      user_id: profile.user_id,
      user_name: profile.display_name || profile.email || 'Usuario',
      closing_date: data.date,
      opening_amount: number(data.opening),
      cash_income: number(data.income),
      cash_out: number(data.out),
      expected_cash: expected,
      counted_cash: counted,
      difference: counted - expected,
      notes: data.notes.trim(),
      payload: { entries: cashEntriesForUser(data.date) }
    };
    const { error } = await client.from('team_cash_closings').upsert(row, { onConflict: 'business_id,branch_id,user_id,closing_date' });
    if (error) return showToast?.(error.message, 'error');
    closeModal(true);
    showToast?.('Corte de caja guardado');
    recordActivity({ eventType: 'cash', entityType: 'cash_closing', entityId: data.date, title: 'Corte de caja guardado', detail: `Diferencia ${money(row.difference)}` });
    await loadCashClosings();
  }

  function renderCashClosingPanel() {
    const section = document.querySelector('#cash');
    if (!section || !(isAdmin() || can('view_finances') || can('manage_payments'))) return;
    let panel = document.querySelector('#teamCashClosingPanel');
    if (!panel) {
      panel = document.createElement('article');
      panel.className = 'panel';
      panel.id = 'teamCashClosingPanel';
      section.appendChild(panel);
    }
    panel.innerHTML = `<div class="panel-header"><div><h2>Cortes por empleado y sucursal</h2><p>Control interno del efectivo contado por cada integrante.</p></div><button class="button primary" id="teamNewCashClosing" type="button">Realizar mi corte</button></div><div class="team-management-list">${cashClosingRows.length ? cashClosingRows.map(row => `<div class="team-management-row"><div><strong>${html(row.user_name)} · ${html(formatDate(row.closing_date))}</strong><small>${html(branchesApi()?.getBranches?.().find(branch => branch.branch_id === row.branch_id)?.name || 'Sucursal')} · Esperado ${money(row.expected_cash)} · Contado ${money(row.counted_cash)}</small></div><strong class="${number(row.difference) === 0 ? 'money-positive' : 'money-warning'}">${money(row.difference)}</strong></div>`).join('') : '<p class="empty-message">Aún no hay cortes compartidos.</p>'}</div>`;
  }

  async function createAutomaticBackup() {
    if (!schemaReady || !isAdmin()) return;
    const key = `${MODULE_KEY}-backup-${businessId()}`;
    const last = localStorage.getItem(key);
    if (last && Date.now() - new Date(last).getTime() < 20 * 60 * 60 * 1000) return;
    const snapshot = safeClone(state);
    const { error } = await client.rpc('save_team_backup', { p_snapshot: snapshot });
    if (error) return console.warn('Respaldo automático pendiente:', error.message);
    localStorage.setItem(key, nowISO());
    await client.rpc('purge_expired_team_trash').catch(() => {});
    await loadManagementData();
    renderManagementPanel();
  }

  async function restoreTrash(trashId) {
    const { data, error } = await client.rpc('restore_team_trash', { p_trash_id: trashId });
    if (error) return showToast?.(error.message, 'error');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.payload) return showToast?.('No se encontró el elemento.', 'error');
    const record = { ...row.payload, branchId: row.branch_id, updatedAt: nowISO(), updatedBy: profile.user_id };
    if (row.entity_type === 'order') state.orders = mergeById(state.orders, [record]);
    if (row.entity_type === 'customer') state.customers = mergeById(state.customers, [record]);
    if (row.entity_type === 'quote') state.quotes = mergeById(state.quotes, [record]);
    persistState();
    suppressActivity = true;
    try {
      if (row.entity_type === 'order') await branchesApi()?.sync?.();
      else await syncSharedData();
    } finally { suppressActivity = false; }
    renderAll();
    showToast?.('Elemento restaurado');
    recordActivity({ eventType: 'restore', entityType: row.entity_type, entityId: row.entity_id, branchId: row.branch_id, title: 'Elemento restaurado desde la papelera' });
    await loadManagementData();
    renderManagementPanel();
  }

  function renderManagementPanel() {
    if (!isAdmin()) return;
    const grid = document.querySelector('#settings .settings-grid');
    if (!grid) return;
    let panel = document.querySelector('#teamWorkflowPanel');
    if (!panel) {
      panel = document.createElement('article');
      panel.className = 'panel';
      panel.id = 'teamWorkflowPanel';
      grid.appendChild(panel);
    }
    panel.innerHTML = `<div class="panel-header"><div><h2>Seguridad y continuidad del equipo</h2><p>Respaldos automáticos y recuperación durante 30 días.</p></div></div><div id="teamWorkflowStatus" class="team-status ${schemaReady ? 'ok' : 'warning'}">${schemaReady ? 'Flujo compartido activo.' : 'Falta ejecutar supabase/team-workflow.sql.'}</div><div class="team-management-grid" style="margin-top:14px"><section><div class="section-title"><div><h3>Papelera · 30 días</h3></div></div><div class="team-management-list">${trashRows.length ? trashRows.map(row => `<div class="team-management-row"><div><strong>${html(row.entity_type === 'order' ? 'Pedido' : row.entity_type === 'quote' ? 'Cotización' : 'Cliente')} · ${html(row.payload?.folio || row.payload?.name || row.entity_id)}</strong><small>Eliminado por ${html(row.deleted_by_name || 'Usuario')} · ${new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'short'}).format(new Date(row.deleted_at))}</small></div><button class="button secondary small" type="button" data-team-restore="${row.trash_id}">Restaurar</button></div>`).join('') : '<p class="empty-message">La papelera está vacía.</p>'}</div></section><section><div class="section-title"><div><h3>Respaldos automáticos</h3></div></div><div class="team-management-list">${backupRows.length ? backupRows.map(row => `<div class="team-management-row"><div><strong>${new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at))}</strong><small>Creado por ${html(row.created_by_name || 'Administrador')} · Sin imágenes ni archivos</small></div><span>✓</span></div>`).join('') : '<p class="empty-message">El primer respaldo se creará al terminar la configuración.</p>'}</div></section></div>`;
  }

  function subscribeRealtime() {
    if (!schemaReady || !client || realtimeChannel) return;
    realtimeChannel = client.channel(`mooreprint-team-${businessId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_orders', filter: `business_id=eq.${businessId()}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_customers', filter: `business_id=eq.${businessId()}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_quotes', filter: `business_id=eq.${businessId()}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_activity', filter: `business_id=eq.${businessId()}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_cash_closings', filter: `business_id=eq.${businessId()}` }, () => loadCashClosings().catch(() => {}))
      .subscribe();
  }

  function bindEvents() {
    document.addEventListener('input', event => {
      if (event.target.id === 'orderSearch') pages.orders = 0;
      if (event.target.id === 'quoteSearch') pages.quotes = 0;
      if (event.target.id === 'customerSearch') pages.customers = 0;
    });

    document.addEventListener('change', event => {
      if (['orderStatusFilter', 'assignmentFilter', 'teamUrgencyFilter'].includes(event.target.id)) { pages.orders = 0; renderOrders(); }
      if (event.target.id === 'quoteStatusFilter') { pages.quotes = 0; renderQuotes(); }
      if (event.target.id === 'branchSelector') {
        pages.orders = pages.quotes = pages.customers = 0;
        setTimeout(() => hydrateSharedData(), 250);
      }
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.dataset.teamPagePrev) {
        pages[target.dataset.teamPagePrev] = Math.max(0, pages[target.dataset.teamPagePrev] - 1);
        ({ orders: renderOrders, quotes: renderQuotes, customers: renderCustomers })[target.dataset.teamPagePrev]?.();
      }
      if (target.dataset.teamPageNext) {
        pages[target.dataset.teamPageNext] += 1;
        ({ orders: renderOrders, quotes: renderQuotes, customers: renderCustomers })[target.dataset.teamPageNext]?.();
      }
      if (target.id === 'teamWhatsAppNote') shareNoteByWhatsApp();
      if (target.id === 'teamCopyNote') copyCurrentNote();
      if (target.id === 'teamNewCashClosing') openTeamCashClosing();
      if (target.dataset.teamRestore) restoreTrash(target.dataset.teamRestore);
    });

    document.addEventListener('submit', event => {
      if (event.target.id === 'teamCashClosingForm') {
        event.preventDefault();
        saveTeamCashClosing(event.target);
      }
    });

    document.addEventListener('change', event => {
      if (event.target.id === 'orderAttachmentInput') {
        event.preventDefault();
        event.target.value = '';
        showToast?.('Los diseños y comprobantes se manejan directamente por WhatsApp.', 'warning');
      }
    }, true);

    window.addEventListener('focus', () => {
      if (connected) scheduleRefresh(150);
    }, { passive: true });
  }

  function installWrappers() {
    wrapStateSaves();
    wrapDocumentFunctions();
    wrapDeleteFunction();
    wrapPagination();
    installNotePreview();
    removeAttachmentFeatures();
    injectUrgencyFilter();
  }

  async function connect() {
    if (connected) return;
    if (!cloudApi()?.hasAccess?.() || !branchesApi()?.getProfile?.()) {
      clearTimeout(connectTimer);
      connectTimer = setTimeout(connect, 120);
      return;
    }
    client = cloudApi().getClient?.();
    user = cloudApi().getUser?.();
    profile = branchesApi().getProfile?.();
    if (!client || !user || !profile) {
      connectTimer = setTimeout(connect, 120);
      return;
    }
    connected = true;
    installWrappers();
    injectManagementShell();
    schemaReady = await checkSchema();
    renderManagementPanel();
    if (!schemaReady) return;
    await hydrateSharedData();
    subscribeRealtime();
    createAutomaticBackup();
  }

  function injectManagementShell() {
    injectUrgencyFilter();
    renderCashClosingPanel();
    renderManagementPanel();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installStyles();
    bindEvents();
    installWrappers();
    const observer = new MutationObserver(() => {
      removeAttachmentFeatures();
      injectUrgencyFilter();
      if (profile) {
        renderManagementPanel();
        renderCashClosingPanel();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    connect();
  }

  window.MoorePrintTeamWorkflow = {
    init,
    sync: syncSharedData,
    refresh: hydrateSharedData,
    isReady: () => schemaReady
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
