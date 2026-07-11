(function () {
  let client = null;
  let user = null;
  let hydrated = false;
  let syncing = false;
  let syncTimer = null;
  let saveHooked = false;
  let accessTimer = null;

  const tables = {
    suppliers: { id: 'supplier_id', local: 'suppliers' },
    materials: { id: 'material_id', local: 'materials' },
    products: { id: 'product_id', local: 'products' },
    supplier_items: { id: 'item_id', local: 'supplierCatalog' },
    supplier_price_history: { id: 'history_id', local: 'supplierPriceHistory' }
  };

  function cfg() { return window.MOOREPRINT_SUPABASE || {}; }
  function canStart() { return Boolean(window.supabase?.createClient && cfg().url && cfg().publishableKey); }
  function hasAccess() { return Boolean(window.MoorePrintCloud?.hasAccess?.()); }

  function statusElement() {
    let node = document.querySelector('#cloudCatalogStatus');
    const session = document.querySelector('#supabaseSession');
    if (!node && session) {
      session.insertAdjacentHTML('beforeend','<div class="cloud-catalog-status" id="cloudCatalogStatus"><span class="dot"></span><span>Catálogo pendiente</span></div>');
      node = document.querySelector('#cloudCatalogStatus');
    }
    return node;
  }

  function setStatus(message, type = '') {
    const node = statusElement();
    if (!node) return;
    node.className = `cloud-catalog-status${type ? ` ${type}` : ''}`;
    const text = node.querySelector('span:last-child');
    if (text) text.textContent = message;
  }

  function dateValue(item) {
    const value = item?.updatedAt || item?.createdAt || item?.changedAt || '';
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function mergeById(localRows, remoteRows, key) {
    const result = new Map();
    (localRows || []).forEach(row => result.set(row[key], row));
    (remoteRows || []).forEach(row => {
      const existing = result.get(row[key]);
      if (!existing || dateValue(row) >= dateValue(existing)) result.set(row[key], row);
    });
    return [...result.values()].filter(row => row[key]);
  }

  function supplierToCloud(row) {
    return { user_id:user.id,supplier_id:row.id,name:row.name||'',contact:row.contact||'',phone:row.phone||'',email:row.email||'',address:row.address||'',products:row.products||'',notes:row.notes||'',created_at:row.createdAt||new Date().toISOString(),updated_at:row.updatedAt||new Date().toISOString() };
  }
  function supplierFromCloud(row) {
    return { id:row.supplier_id,name:row.name||'',contact:row.contact||'',phone:row.phone||'',email:row.email||'',address:row.address||'',products:row.products||'',notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at };
  }
  function materialToCloud(row) {
    return { user_id:user.id,material_id:row.id,name:row.name||'',sku:row.sku||'',category:row.category||'',unit:row.unit||'pieza',stock:num(row.stock),min_stock:num(row.minStock),unit_cost:num(row.unitCost),supplier_id:row.supplierId||'',notes:row.notes||'',created_at:row.createdAt||new Date().toISOString(),updated_at:row.updatedAt||new Date().toISOString() };
  }
  function materialFromCloud(row) {
    return { id:row.material_id,name:row.name||'',sku:row.sku||'',category:row.category||'',unit:row.unit||'pieza',stock:num(row.stock),minStock:num(row.min_stock),unitCost:num(row.unit_cost),supplierId:row.supplier_id||'',notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at };
  }
  function productToCloud(row) {
    return { user_id:user.id,product_id:row.id,name:row.name||'',category:row.category||'',sale_price:num(row.salePrice),tax_percent:num(row.taxPercent),recipe:Array.isArray(row.recipe)?row.recipe:[],labor_cost:num(row.laborCost),design_cost:num(row.designCost),electricity_cost:num(row.electricityCost),packaging_cost:num(row.packagingCost),transport_cost:num(row.transportCost),external_cost:num(row.externalCost),extra_cost:num(row.extraCost),waste_percent:num(row.wastePercent),commission_percent:num(row.commissionPercent),auto_price:Boolean(row.autoPrice),target_margin_percent:num(row.targetMarginPercent)||40,price_rounding:num(row.priceRounding)||1,notes:row.notes||'',created_at:row.createdAt||new Date().toISOString(),updated_at:row.updatedAt||new Date().toISOString() };
  }
  function productFromCloud(row) {
    return { id:row.product_id,name:row.name||'',category:row.category||'',salePrice:num(row.sale_price),taxPercent:num(row.tax_percent),recipe:Array.isArray(row.recipe)?row.recipe:[],laborCost:num(row.labor_cost),designCost:num(row.design_cost),electricityCost:num(row.electricity_cost),packagingCost:num(row.packaging_cost),transportCost:num(row.transport_cost),externalCost:num(row.external_cost),extraCost:num(row.extra_cost),wastePercent:num(row.waste_percent),commissionPercent:num(row.commission_percent),autoPrice:Boolean(row.auto_price),targetMarginPercent:num(row.target_margin_percent)||40,priceRounding:num(row.price_rounding)||1,notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at };
  }
  function itemToCloud(row) {
    return { user_id:user.id,item_id:row.id,supplier_id:row.supplierId||'',material_id:row.materialId||'',name:row.name||'',sku:row.sku||'',category:row.category||'',unit:row.unit||'pieza',presentation_qty:num(row.presentationQty)||1,package_price:num(row.packagePrice),shipping_cost:num(row.shippingCost),other_cost:num(row.otherCost),unit_cost:window.MoorePrintSupplierCatalog?.unitCostOf?.(row)??num(row.unitCost),preferred:Boolean(row.preferred),active:row.active!==false,notes:row.notes||'',created_at:row.createdAt||new Date().toISOString(),updated_at:row.updatedAt||new Date().toISOString() };
  }
  function itemFromCloud(row) {
    return { id:row.item_id,supplierId:row.supplier_id||'',materialId:row.material_id||'',name:row.name||'',sku:row.sku||'',category:row.category||'',unit:row.unit||'pieza',presentationQty:num(row.presentation_qty)||1,packagePrice:num(row.package_price),shippingCost:num(row.shipping_cost),otherCost:num(row.other_cost),unitCost:num(row.unit_cost),preferred:Boolean(row.preferred),active:row.active!==false,notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at };
  }
  function historyToCloud(row) {
    return { user_id:user.id,history_id:row.id,supplier_item_id:row.supplierItemId||'',supplier_id:row.supplierId||'',material_id:row.materialId||'',old_unit_cost:row.oldUnitCost===null?null:num(row.oldUnitCost),new_unit_cost:num(row.newUnitCost),package_price:num(row.packagePrice),shipping_cost:num(row.shippingCost),other_cost:num(row.otherCost),changed_at:row.changedAt||new Date().toISOString() };
  }
  function historyFromCloud(row) {
    return { id:row.history_id,supplierItemId:row.supplier_item_id||'',supplierId:row.supplier_id||'',materialId:row.material_id||'',oldUnitCost:row.old_unit_cost===null?null:num(row.old_unit_cost),newUnitCost:num(row.new_unit_cost),packagePrice:num(row.package_price),shippingCost:num(row.shipping_cost),otherCost:num(row.other_cost),changedAt:row.changed_at };
  }

  const converters = {
    suppliers: [supplierToCloud,supplierFromCloud,'id'],
    materials: [materialToCloud,materialFromCloud,'id'],
    products: [productToCloud,productFromCloud,'id'],
    supplier_items: [itemToCloud,itemFromCloud,'id'],
    supplier_price_history: [historyToCloud,historyFromCloud,'id']
  };

  async function readTable(table) {
    const { data, error } = await client.from(table).select('*');
    if (error) throw error;
    return data || [];
  }

  async function hydrate() {
    if (!client || !user || hydrated) return;
    setStatus('Descargando catálogo de Supabase…');
    try {
      const [supplierRows,materialRows,productRows,itemRows,historyRows] = await Promise.all([
        readTable('suppliers'),readTable('materials'),readTable('products'),readTable('supplier_items'),readTable('supplier_price_history')
      ]);
      const remote = {
        suppliers:supplierRows.map(supplierFromCloud),materials:materialRows.map(materialFromCloud),products:productRows.map(productFromCloud),
        supplierCatalog:itemRows.map(itemFromCloud),supplierPriceHistory:historyRows.map(historyFromCloud)
      };
      state.suppliers = mergeById(state.suppliers,remote.suppliers,'id');
      state.materials = mergeById(state.materials,remote.materials,'id');
      state.products = mergeById(state.products,remote.products,'id');
      state.supplierCatalog = mergeById(state.supplierCatalog,remote.supplierCatalog,'id');
      state.supplierPriceHistory = mergeById(state.supplierPriceHistory,remote.supplierPriceHistory,'id').sort((a,b)=>String(b.changedAt).localeCompare(String(a.changedAt))).slice(0,2500);
      window.MoorePrintSupplierCatalog?.normalize?.();
      window.MoorePrintSupplierCatalog?.refreshAutomaticProductPrices?.();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      renderAll();
      hydrated = true;
      setStatus('Catálogo descargado; guardando cambios…');
      await syncAll();
    } catch (error) {
      hydrated = false;
      const missing = /relation .* does not exist|schema cache|Could not find the table/i.test(error.message||'');
      setStatus(missing?'Ejecuta supabase/catalog.sql para activar el catálogo en la nube.':`Error de catálogo: ${error.message}`,'error');
    }
  }

  async function syncTable(table, localRows) {
    const definition = tables[table];
    const [toCloud] = converters[table];
    const rows = (localRows || []).map(toCloud);
    const { data:remoteIds,error:readError } = await client.from(table).select(definition.id);
    if (readError) throw readError;
    const localIds = new Set(rows.map(row=>row[definition.id]));
    const stale = (remoteIds||[]).map(row=>row[definition.id]).filter(id=>!localIds.has(id));
    if (stale.length) {
      const { error } = await client.from(table).delete().in(definition.id,stale);
      if (error) throw error;
    }
    if (rows.length) {
      const { error } = await client.from(table).upsert(rows,{onConflict:`user_id,${definition.id}`});
      if (error) throw error;
    }
  }

  async function syncAll() {
    if (!client || !user || !hydrated || syncing || !hasAccess()) return false;
    syncing = true;
    setStatus('Sincronizando catálogo…');
    try {
      await Promise.all([
        syncTable('suppliers',state.suppliers),syncTable('materials',state.materials),syncTable('products',state.products),
        syncTable('supplier_items',state.supplierCatalog),syncTable('supplier_price_history',state.supplierPriceHistory)
      ]);
      setStatus('Proveedores, costos, inventario y productos sincronizados.','synced');
      return true;
    } catch (error) {
      const missing = /relation .* does not exist|schema cache|Could not find the table/i.test(error.message||'');
      setStatus(missing?'Falta ejecutar supabase/catalog.sql.':`No se pudo sincronizar: ${error.message}`,'error');
      return false;
    } finally { syncing = false; }
  }

  function scheduleSync(delay=1200) {
    if (!hydrated || !hasAccess()) return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(syncAll,delay);
  }

  function hookSaves() {
    if (saveHooked || typeof saveState!=='function') return;
    const base=saveState;
    saveState=function(...args){const result=base(...args);scheduleSync();return result;};
    saveHooked=true;
  }

  async function connectIfAllowed() {
    if (!canStart() || !hasAccess()) return;
    if (!client) client=window.supabase.createClient(cfg().url,cfg().publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getSession();
    if (error || !data?.session?.user) return;
    if (user?.id!==data.session.user.id) {user=data.session.user;hydrated=false;}
    await hydrate();
  }

  function monitorAccess() {
    clearInterval(accessTimer);
    accessTimer=setInterval(()=>{
      if (hasAccess()) connectIfAllowed();
      else {user=null;hydrated=false;setStatus('Inicia sesión para sincronizar el catálogo.');}
    },1500);
    connectIfAllowed();
  }

  function init() {
    hookSaves();
    monitorAccess();
  }

  window.MoorePrintCatalogCloud={init,syncAll,hydrate,isReady:()=>hydrated};
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
