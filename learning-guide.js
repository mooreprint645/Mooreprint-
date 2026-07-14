(function () {
  const STORAGE_PREFIX = 'mooreprint-learning-v1';

  function makeGuide(title, purpose, when, impact, before, steps, caution, next, nextSection, action) {
    return {
      title: title,
      purpose: purpose,
      when: when,
      impact: impact,
      before: before,
      steps: steps,
      caution: caution,
      next: next,
      nextSection: nextSection,
      action: action
    };
  }

  const SECTION_GUIDES = {
    dashboard: makeGuide(
      'Resumen',
      'Concentrar la situación actual del negocio y mostrar qué necesita atención primero.',
      'Al iniciar y cerrar el día para revisar ventas, entregas, cobros y alertas.',
      'No modifica registros; resume lo capturado en las demás secciones.',
      'Pedidos, pagos, compras y gastos deben estar actualizados.',
      ['Revisa alertas y entregas cercanas.', 'Consulta ventas, utilidad y saldos.', 'Abre la tarea pendiente desde un acceso rápido.'],
      'No tomes decisiones con datos incompletos.',
      'Pedidos', 'orders', 'order'
    ),
    orders: makeGuide(
      'Pedidos',
      'Registrar cada trabajo vendido, su entrega, costo, pago y avance.',
      'Cuando un cliente confirme un trabajo o deje un anticipo.',
      'Puede crear saldo por cobrar y descontar inventario al entrar en producción.',
      'Confirma cliente, fecha, conceptos, costos y materiales.',
      ['Captura cliente y fecha prometida.', 'Agrega trabajos, cantidades, precios y costos.', 'Actualiza el estado hasta entregarlo.'],
      'No marques producción antes de validar diseño y materiales.',
      'Producción', 'production', 'order'
    ),
    production: makeGuide(
      'Producción',
      'Mostrar en qué etapa está cada pedido y quién debe atenderlo.',
      'Durante la jornada para organizar diseño, aprobación, impresión y entrega.',
      'Cambiar una etapa puede aplicar o revertir consumos de inventario.',
      'El pedido debe tener conceptos, receta y fecha correctos.',
      ['Localiza el pedido.', 'Confirma la aprobación del diseño.', 'Muévelo a la siguiente etapa y revisa el resultado.'],
      'Mover un pedido con receta incorrecta descuenta materiales equivocados.',
      'Calendario', 'calendar', 'production'
    ),
    calendar: makeGuide(
      'Calendario',
      'Ordenar entregas, cobros y vencimientos por fecha.',
      'Para planear el día o la semana y detectar atrasos.',
      'No modifica datos; abre el registro relacionado.',
      'Los registros necesitan fechas correctas.',
      ['Revisa eventos atrasados y de hoy.', 'Abre el registro.', 'Completa la tarea o corrige la fecha.'],
      'Una fecha vacía puede ocultar una entrega.',
      'Caja y pagos', 'cash', 'calendar'
    ),
    quotes: makeGuide(
      'Cotizaciones',
      'Preparar precios antes de confirmar una venta.',
      'Cuando el cliente requiere un presupuesto o compara opciones.',
      'No afecta caja ni inventario hasta convertirse en pedido.',
      'Revisa costos, vigencia, descuento e impuestos.',
      ['Selecciona cliente y conceptos.', 'Revisa total y vigencia.', 'Conviértela en pedido cuando sea aceptada.'],
      'Una cotización aceptada todavía no significa que esté pagada.',
      'Pedidos', 'orders', 'quote'
    ),
    customers: makeGuide(
      'Clientes',
      'Guardar contacto, datos fiscales, historial y saldos.',
      'Antes de registrar trabajos frecuentes o consultar adeudos.',
      'Sus datos se reutilizan en pedidos, cotizaciones y facturación.',
      'Confirma nombre y al menos un medio de contacto.',
      ['Registra nombre y contacto.', 'Agrega datos fiscales solo cuando se necesiten.', 'Consulta historial y saldo.'],
      'Evita crear duplicados del mismo cliente.',
      'Pedidos', 'orders', 'customer'
    ),
    products: makeGuide(
      'Productos y costos',
      'Definir qué se vende, cuánto cuesta producirlo y qué margen deja.',
      'Antes de cotizar productos repetitivos o cuando cambien costos.',
      'Actualiza costos, precios sugeridos y recetas de inventario.',
      'Registra materiales y costos reales del proceso.',
      ['Crea el producto.', 'Agrega materiales y otros costos.', 'Revisa margen, precio y receta.'],
      'Un costo interno incompleto muestra utilidad falsa.',
      'Inventario', 'inventory', 'product'
    ),
    calculator: makeGuide(
      'Calculadora',
      'Estimar un precio rentable antes de cotizar.',
      'Para trabajos especiales, cantidades nuevas o cambios rápidos.',
      'Solo calcula hasta guardar el resultado como producto.',
      'Reúne costos, desperdicio, comisión y margen.',
      ['Captura costos unitarios.', 'Elige margen.', 'Compara precio mínimo y recomendado.'],
      'No omitas entrega, empaque, diseño o desperdicio.',
      'Productos y costos', 'products', 'product'
    ),
    inventory: makeGuide(
      'Inventario',
      'Controlar existencias, costos y movimientos de materiales.',
      'Al recibir material, contar existencias o investigar faltantes.',
      'Compras aumentan; producción, ajustes y mermas reducen.',
      'Define unidad, costo y existencia mínima.',
      ['Registra el material.', 'Usa Compras para entradas normales.', 'Revisa movimientos antes de ajustar.'],
      'No mezcles piezas, metros, cajas y paquetes sin convertir unidades.',
      'Proveedores', 'suppliers', 'material'
    ),
    suppliers: makeGuide(
      'Proveedores',
      'Guardar contactos, presentaciones, precios e historial.',
      'Para comparar costos o preparar una compra.',
      'Sus precios pueden actualizar materiales y productos automáticos.',
      'Confirma cantidad por paquete, envío y costo unitario final.',
      ['Registra al proveedor.', 'Agrega sus materiales y presentaciones.', 'Compara costo unitario.'],
      'No compares únicamente el precio total del paquete.',
      'Compras', 'purchases', 'supplier'
    ),
    purchases: makeGuide(
      'Compras',
      'Registrar materiales recibidos y pagos a proveedores.',
      'Cada vez que entre material por una compra real.',
      'Aumenta inventario, cambia costo promedio y puede crear deuda.',
      'Verifica proveedor, cantidad, presentación y forma de pago.',
      ['Selecciona proveedor y materiales.', 'Confirma cantidades y costos.', 'Registra pagos parciales o totales.'],
      'No reemplaces una compra con un ajuste de inventario.',
      'Inventario', 'inventory', 'purchase'
    ),
    waste: makeGuide(
      'Mermas',
      'Registrar material perdido por pruebas, errores o defectos.',
      'Cuando el material ya no puede venderse ni reutilizarse.',
      'Reduce inventario y registra la pérdida económica.',
      'Identifica material, cantidad y causa.',
      ['Selecciona material.', 'Captura cantidad y motivo.', 'Revisa el valor descontado.'],
      'No registres como merma algo que será devuelto o reutilizado.',
      'Inventario', 'inventory', 'waste'
    ),
    expenses: makeGuide(
      'Gastos',
      'Registrar costos operativos que no son compras de inventario.',
      'Para renta, gasolina, servicios, sueldos, publicidad e impuestos.',
      'Reduce utilidad y genera salida de caja cuando se paga.',
      'Distingue gasto, compra de material y retiro del propietario.',
      ['Elige categoría.', 'Captura total y vencimiento.', 'Registra pagos.'],
      'Una compra de material clasificada como gasto no aumenta inventario.',
      'Caja y pagos', 'cash', 'expense'
    ),
    recurring: makeGuide(
      'Gastos recurrentes',
      'Programar obligaciones mensuales para no capturarlas de nuevo.',
      'Para renta, internet, sueldos, licencias y servicios repetitivos.',
      'Genera el gasto del mes; el pago se registra después.',
      'Define monto, categoría, día y fecha de inicio.',
      ['Crea el concepto.', 'Confirma que esté activo.', 'Revisa el gasto generado antes de pagarlo.'],
      'No captures manualmente un gasto ya generado.',
      'Gastos', 'expenses', 'expense'
    ),
    cash: makeGuide(
      'Caja y pagos',
      'Concentrar entradas, salidas, cobros, pagos y efectivo.',
      'Para cobrar pedidos, pagar documentos y hacer el corte diario.',
      'Modifica saldos y balance por método de pago.',
      'Abre el pedido, compra o gasto correcto.',
      ['Localiza el documento.', 'Registra monto, método y referencia.', 'Compara efectivo esperado y contado.'],
      'No registres el mismo cobro en el pedido y como movimiento manual.',
      'Reportes', 'reports', 'cash'
    ),
    reports: makeGuide(
      'Reportes',
      'Analizar ventas, costos, gastos, utilidad y flujo.',
      'Semanal o mensualmente para tomar decisiones.',
      'No modifica registros; calcula con los datos existentes.',
      'Completa pedidos, pagos, compras y gastos del periodo.',
      ['Selecciona el rango.', 'Compara ventas, utilidad y flujo.', 'Investiga diferencias antes de exportar.'],
      'Utilidad alta con caja baja puede significar ventas pendientes.',
      'Resumen', 'dashboard', 'reports'
    ),
    activity: makeGuide(
      'Actividad',
      'Consultar qué cambió, cuándo y sobre qué registro.',
      'Para aclarar modificaciones o diferencias entre usuarios.',
      'No modifica datos; presenta el historial disponible.',
      'Busca por folio, persona, movimiento o fecha.',
      ['Filtra eventos.', 'Localiza el registro.', 'Compara el cambio con el estado actual.'],
      'El historial no sustituye los respaldos.',
      'Configuración', 'settings', 'activity'
    ),
    notifications: makeGuide(
      'Avisos',
      'Reunir entregas, cobros, inventario bajo y gastos pendientes.',
      'Al comenzar el día o recibir una notificación.',
      'Abrir un aviso no cambia datos; conduce al registro.',
      'Configura tipos de aviso y anticipación.',
      ['Revisa urgentes.', 'Abre el registro.', 'Completa o corrige la tarea.'],
      'No ignores un aviso repetido sin revisar su causa.',
      'Calendario', 'calendar', 'notifications'
    ),
    invoicing: makeGuide(
      'Facturación',
      'Preparar datos para que un contador o PAC emita un CFDI.',
      'Cuando un cliente solicite factura.',
      'Guarda un expediente; no firma, sella ni timbra.',
      'Completa datos fiscales del negocio, cliente y conceptos.',
      ['Revisa pedidos.', 'Completa receptor y claves.', 'Exporta y registra UUID después del timbrado externo.'],
      'No guardes contraseñas, e.firma, certificados o archivos .key.',
      'Clientes', 'customers', 'invoicing'
    ),
    help: makeGuide(
      'Centro de aprendizaje',
      'Explicar tareas, términos y rutas para aprender MoorePrint.',
      'Cuando no sepas dónde registrar algo o quieras retomar la guía.',
      'Solo guarda preferencias de aprendizaje en este navegador.',
      'Elige la ruta que corresponde a tus responsabilidades.',
      ['Selecciona una ruta.', 'Consulta procedimientos.', 'Usa el glosario o reinicia la guía.'],
      'La guía no reemplaza los permisos asignados.',
      'Resumen', 'dashboard', 'help'
    ),
    settings: makeGuide(
      'Configuración',
      'Definir datos del negocio, instalación y respaldos.',
      'Al preparar MoorePrint o cambiar datos oficiales.',
      'Puede cambiar documentos, saldo inicial y copias de seguridad.',
      'Confirma los datos antes de guardar o importar.',
      ['Completa datos del negocio.', 'Configura solo opciones conocidas.', 'Descarga respaldos con frecuencia.'],
      'No borres datos ni importes sin conservar una copia reciente.',
      'Resumen', 'dashboard', 'settings'
    )
  };

  const LEARNING_PATHS = {
    administrator: {
      title: 'Ruta de administrador',
      icon: '⚙️',
      description: 'Prepara negocio, costos, inventario, finanzas y respaldos.',
      steps: [
        { id: 'business', title: 'Configura el negocio', detail: 'Datos para documentos y operación.', section: 'settings', action: 'settings', check: 'business' },
        { id: 'materials', title: 'Registra materiales', detail: 'Existencia, unidad, costo y mínimo.', section: 'inventory', action: 'material', permission: 'manage_inventory', check: 'materials' },
        { id: 'catalog', title: 'Define productos y precios', detail: 'Costos, margen y receta.', section: 'products', action: 'product', permission: 'manage_catalog', check: 'products' },
        { id: 'suppliers', title: 'Organiza proveedores', detail: 'Presentaciones, costos y compras.', section: 'suppliers', action: 'supplier', permission: 'manage_catalog', check: 'suppliers' },
        { id: 'finances', title: 'Revisa caja y reportes', detail: 'Saldos, utilidad y flujo.', section: 'reports', action: 'reports', permission: 'view_finances', check: 'finances' },
        { id: 'backup', title: 'Crea un respaldo', detail: 'Protege datos y archivos.', section: 'settings', action: 'backup', check: 'backup' }
      ]
    },
    operator: {
      title: 'Ruta de usuario operativo',
      icon: '🧾',
      description: 'Aprende clientes, pedidos, producción, cobros y entregas.',
      steps: [
        { id: 'customer', title: 'Registra un cliente', detail: 'Nombre y contacto reutilizable.', section: 'customers', action: 'customer', permission: 'view_customers', check: 'customers' },
        { id: 'order', title: 'Crea un pedido', detail: 'Trabajo, fecha, precio y anticipo.', section: 'orders', action: 'order', permission: 'create_orders', check: 'orders' },
        { id: 'production', title: 'Actualiza producción', detail: 'Mueve el pedido conforme avance.', section: 'production', action: 'production', permission: 'view_production', check: 'production' },
        { id: 'payment', title: 'Registra un cobro', detail: 'Aplica anticipo o liquidación.', section: 'cash', action: 'cash', permission: 'manage_payments', check: 'payments' },
        { id: 'calendar', title: 'Consulta entregas', detail: 'Revisa compromisos próximos.', section: 'calendar', action: 'calendar', permission: 'view_calendar', check: 'calendar' }
      ]
    }
  };

  const GLOSSARY = [
    ['Pedido', 'Trabajo confirmado que puede generar saldo, producción e inventario.'],
    ['Cotización', 'Propuesta de precio que todavía no es una venta confirmada.'],
    ['Costo interno', 'Lo que realmente cuesta producir; no es el precio al cliente.'],
    ['Saldo', 'Parte que todavía falta cobrar o pagar.'],
    ['Caja', 'Entradas y salidas clasificadas por método de pago.'],
    ['Compra', 'Entrada de material que actualiza inventario y proveedor.'],
    ['Merma', 'Material perdido que ya no puede venderse ni reutilizarse.'],
    ['Respaldo', 'Copia para recuperar datos o archivos del dispositivo.']
  ];

  let initialized = false;
  let rendering = false;
  let renderTimer = null;
  let observer = null;
  let currentIdentity = '';
  let currentSection = '';
  let welcomeAttempts = 0;

  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function applicationState() {
    try {
      if (typeof state !== 'undefined') return state;
    } catch (error) {}
    return window.state || {};
  }

  function profile() {
    return window.MoorePrintBranches?.getProfile?.() || null;
  }

  function identity() {
    const currentProfile = profile();
    return String(currentProfile?.user_id || currentProfile?.id || 'local');
  }

  function storageKey() {
    return `${STORAGE_PREFIX}-${identity()}`;
  }

  function defaultSettings() {
    return { path: '', enabled: true, welcomeSeen: false, visited: [], dismissed: [] };
  }

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      return {
        ...defaultSettings(),
        ...(saved || {}),
        visited: Array.isArray(saved?.visited) ? saved.visited : [],
        dismissed: Array.isArray(saved?.dismissed) ? saved.dismissed : []
      };
    } catch (error) {
      return defaultSettings();
    }
  }

  function writeSettings(settings) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({ ...defaultSettings(), ...settings }));
    } catch (error) {}
  }

  function rows(name) {
    const appState = applicationState();
    return Array.isArray(appState[name]) ? appState[name] : [];
  }

  function hasPermission(permission) {
    if (!permission) return true;
    const branches = window.MoorePrintBranches;
    if (!branches?.getProfile?.() || !branches.getProfile()) return true;
    if (branches.isAdmin?.()) return true;
    return Boolean(branches.can?.(permission));
  }

  function availablePathKeys() {
    const keys = ['operator'];
    if (!profile() || window.MoorePrintBranches?.isAdmin?.()) keys.unshift('administrator');
    return keys;
  }

  function visibleSteps(pathKey) {
    const path = LEARNING_PATHS[pathKey];
    return path ? path.steps.filter(step => hasPermission(step.permission)) : [];
  }

  function completedByCheck(check, settings) {
    const business = applicationState().business || {};
    if (check === 'business') return Boolean(business.phone || business.address || business.email);
    if (check === 'materials') return rows('materials').length > 0;
    if (check === 'products') return rows('products').length > 0;
    if (check === 'suppliers') return rows('suppliers').length > 0 || rows('purchases').length > 0;
    if (check === 'finances') return settings.visited.includes('cash') || settings.visited.includes('reports') || rows('cashTransactions').length > 0;
    if (check === 'backup') return Boolean(localStorage.getItem('mooreprint-last-backup'));
    if (check === 'customers') return rows('customers').length > 0;
    if (check === 'orders') return rows('orders').length > 0;
    if (check === 'production') return settings.visited.includes('production') || rows('orders').some(order => !['pendiente', 'cancelado'].includes(order.status));
    if (check === 'payments') return rows('orders').some(order => Array.isArray(order.payments) && order.payments.length > 0) || rows('cashTransactions').some(item => item.origin === 'pedido' || item.type === 'entrada');
    if (check === 'calendar') return settings.visited.includes('calendar');
    return false;
  }

  function pathProgress(pathKey, settings = readSettings()) {
    const steps = visibleSteps(pathKey);
    const completed = steps.filter(step => completedByCheck(step.check, settings));
    const current = steps.find(step => !completedByCheck(step.check, settings)) || null;
    return {
      steps,
      completed,
      current,
      percent: steps.length ? Math.round(completed.length / steps.length * 100) : 100
    };
  }

  function routeSelector(selected = '') {
    return `<div class="learning-route-selector" role="group" aria-label="Ruta de aprendizaje">${availablePathKeys().map(key => {
      const route = LEARNING_PATHS[key];
      return `<button class="learning-route-card ${selected === key ? 'selected' : ''}" type="button" data-learning-select="${key}" aria-pressed="${selected === key}"><span class="learning-route-icon" aria-hidden="true">${route.icon}</span><span><strong>${html(route.title)}</strong><small>${html(route.description)}</small></span></button>`;
    }).join('')}</div>`;
  }

  function ensureLearningPanel() {
    const dashboard = document.querySelector('#dashboard');
    if (!dashboard) return null;
    let panel = document.querySelector('#learningGuidePanel');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'learningGuidePanel';
      panel.className = 'learning-guide-panel';
      panel.setAttribute('aria-live', 'polite');
      const anchor = document.querySelector('#uxDashboardGuide');
      if (anchor) anchor.insertAdjacentElement('afterend', panel);
      else dashboard.prepend(panel);
    }
    return panel;
  }

  function renderLearningPanel() {
    const panel = ensureLearningPanel();
    if (!panel) return;
    const settings = readSettings();
    const route = LEARNING_PATHS[settings.path];

    if (!route) {
      panel.innerHTML = `<div class="learning-panel-heading"><div><span class="learning-eyebrow">Primeros pasos</span><h2>Aprende MoorePrint según tu función</h2><p>Elige una ruta. Puedes cambiarla o reiniciarla desde Ayuda.</p></div></div>${routeSelector()}<div class="learning-panel-note">La guía no cambia permisos ni datos del negocio.</div>`;
      return;
    }

    const progress = pathProgress(settings.path, settings);
    if (!settings.enabled) {
      panel.innerHTML = `<div class="learning-panel-heading"><div><span class="learning-eyebrow">Modo aprendizaje pausado</span><h2>${html(route.title)}</h2><p>Tu progreso permanece guardado para esta cuenta.</p></div><button class="button primary" type="button" data-learning-resume>Continuar guía</button></div><div class="learning-panel-actions"><button class="text-button" type="button" data-learning-change>Cambiar ruta</button><button class="text-button" type="button" data-learning-reset>Reiniciar</button></div>`;
      return;
    }

    const current = progress.current;
    panel.innerHTML = `<div class="learning-panel-heading"><div><span class="learning-eyebrow">${html(route.title)}</span><h2>${current ? 'Siguiente paso recomendado' : 'Ruta completada'}</h2><p>${current ? html(current.detail) : 'Ya conoces el flujo principal. La guía seguirá disponible en cada sección.'}</p></div><div class="learning-progress-copy"><strong>${progress.percent}%</strong><span>${progress.completed.length} de ${progress.steps.length}</span></div></div><div class="learning-progress-bar" role="progressbar" aria-label="Avance de la ruta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div>${current ? `<div class="learning-current-step"><div><span class="learning-step-number">${progress.completed.length + 1}</span><div><strong>${html(current.title)}</strong><small>${html(current.detail)}</small></div></div><button class="button primary" type="button" data-learning-action="${current.action}" data-learning-section="${current.section}">Comenzar</button></div>` : `<div class="learning-complete"><span aria-hidden="true">✓</span><div><strong>Recorrido principal completado</strong><small>La Guía sigue disponible en cada pantalla.</small></div></div>`}<div class="learning-step-list">${progress.steps.map((step, index) => {
      const done = completedByCheck(step.check, settings);
      return `<button class="learning-step-item ${done ? 'done' : ''}" type="button" data-learning-action="${step.action}" data-learning-section="${step.section}"><span>${done ? '✓' : index + 1}</span><span><strong>${html(step.title)}</strong><small>${html(step.detail)}</small></span></button>`;
    }).join('')}</div><div class="learning-panel-actions"><button class="text-button" type="button" data-learning-pause>Pausar guía</button><button class="text-button" type="button" data-learning-change>Cambiar ruta</button><button class="text-button" type="button" data-learning-reset>Reiniciar</button></div>`;
  }

  function renderHelpCenter() {
    const help = document.querySelector('#help');
    if (!help) return;
    let center = document.querySelector('#learningHelpCenter');
    if (!center) {
      center = document.createElement('section');
      center.id = 'learningHelpCenter';
      center.className = 'learning-help-center';
      center.setAttribute('aria-live', 'polite');
      const toolbar = help.querySelector('.section-toolbar');
      if (toolbar) toolbar.insertAdjacentElement('afterend', center);
      else help.prepend(center);
    }

    const settings = readSettings();
    const route = LEARNING_PATHS[settings.path];
    const progress = route ? pathProgress(settings.path, settings) : null;
    center.innerHTML = `<div class="learning-help-heading"><div><span class="learning-eyebrow">Centro de aprendizaje</span><h2>${route ? html(route.title) : 'Elige cómo usarás MoorePrint'}</h2><p>${route ? `${progress.completed.length} de ${progress.steps.length} pasos completados.` : 'Selecciona una ruta para recibir recomendaciones en cada pantalla.'}</p></div>${route ? '<button class="button secondary" type="button" data-learning-change>Cambiar ruta</button>' : ''}</div>${route ? `<div class="learning-help-progress"><div class="learning-progress-bar" role="progressbar" aria-label="Avance de la ruta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div><strong>${progress.percent}%</strong></div>` : routeSelector()}<div class="learning-help-tools"><button class="button secondary" type="button" data-learning-open-current>Explicar esta pantalla</button><button class="button secondary" type="button" data-learning-reset-dismissed>Volver a mostrar consejos</button>${settings.enabled && route ? '<button class="button secondary" type="button" data-learning-pause>Pausar recorrido</button>' : route ? '<button class="button primary" type="button" data-learning-resume>Continuar recorrido</button>' : ''}<button class="button danger subtle" type="button" data-learning-reset>Reiniciar aprendizaje</button></div><details class="learning-glossary"><summary>Glosario básico de administración</summary><div class="learning-glossary-grid">${GLOSSARY.map(([term, definition]) => `<article><strong>${html(term)}</strong><p>${html(definition)}</p></article>`).join('')}</div></details>`;

    const existingTitle = help.querySelector('.panel .panel-header h2');
    const existingDescription = help.querySelector('.panel .panel-header p');
    if (existingTitle) existingTitle.textContent = 'Procedimientos por tarea';
    if (existingDescription) existingDescription.textContent = 'Busca instrucciones concretas para realizar una operación.';
  }

  function activeSection() {
    return document.querySelector('.page-section.active')?.id || document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
  }

  function markVisited(section) {
    if (!section) return;
    const settings = readSettings();
    if (settings.visited.includes(section)) return;
    settings.visited.push(section);
    writeSettings(settings);
  }

  function removeSectionCoach() {
    document.querySelectorAll('.learning-section-coach').forEach(node => node.remove());
  }

  function renderSectionCoach(section = activeSection()) {
    removeSectionCoach();
    const settings = readSettings();
    if (!settings.enabled || !settings.path || settings.dismissed.includes(section) || ['dashboard', 'help'].includes(section)) return;
    const guide = SECTION_GUIDES[section];
    const sectionNode = document.getElementById(section);
    if (!guide || !sectionNode?.classList.contains('active')) return;

    const coach = document.createElement('article');
    coach.className = 'learning-section-coach';
    coach.innerHTML = `<div class="learning-coach-copy"><span class="learning-eyebrow">Modo aprendizaje</span><h2>${html(guide.title)}</h2><p>${html(guide.purpose)}</p><div class="learning-coach-facts"><span><strong>Úsala cuando:</strong> ${html(guide.when)}</span><span><strong>Qué cambia:</strong> ${html(guide.impact)}</span></div></div><div class="learning-coach-actions"><button class="button primary" type="button" data-learning-section-help="${section}">Ver guía completa</button><button class="button secondary" type="button" data-learning-dismiss-section="${section}">Ocultar aquí</button></div>`;
    sectionNode.prepend(coach);
  }

  function sectionHelpBody(section) {
    const guide = SECTION_GUIDES[section] || SECTION_GUIDES.dashboard;
    return `<div class="learning-section-help"><div class="learning-help-summary"><span class="learning-eyebrow">${html(guide.title)}</span><p>${html(guide.purpose)}</p></div><div class="learning-help-facts"><article><span>Cuándo usarla</span><p>${html(guide.when)}</p></article><article><span>Qué cambia</span><p>${html(guide.impact)}</p></article><article><span>Antes de comenzar</span><p>${html(guide.before)}</p></article></div><div class="learning-help-process"><h3>Cómo trabajar aquí</h3><ol>${guide.steps.map(step => `<li>${html(step)}</li>`).join('')}</ol></div><div class="learning-help-warning"><strong>Evita este error</strong><p>${html(guide.caution)}</p></div><div class="learning-next-section"><span>Siguiente sección relacionada</span><strong>${html(guide.next)}</strong></div></div>`;
  }

  function openSectionHelp(section = activeSection()) {
    const guide = SECTION_GUIDES[section] || SECTION_GUIDES.dashboard;
    if (typeof openModal !== 'function') return;
    const footer = `<button class="button secondary" type="button" data-close-modal>Cerrar</button>${guide.action ? `<button class="button primary" type="button" data-learning-action="${guide.action}" data-learning-section="${section}">Comenzar aquí</button>` : ''}${guide.nextSection ? `<button class="button secondary" type="button" data-learning-go="${guide.nextSection}">Ir a ${html(guide.next)}</button>` : ''}`;
    openModal(`Guía · ${guide.title}`, sectionHelpBody(section), footer);
  }

  function welcomeBody() {
    return `<div class="learning-welcome"><div class="learning-welcome-intro"><span class="learning-welcome-mark" aria-hidden="true">MP</span><div><h3>Aprende sin memorizar todo</h3><p>MoorePrint te mostrará qué hace cada sección y cuál es la siguiente tarea recomendada.</p></div></div>${routeSelector()}<div class="learning-welcome-notes"><span>✓ Funciona sin conexión.</span><span>✓ No cambia permisos.</span><span>✓ Se puede pausar.</span></div></div>`;
  }

  function openWelcome() {
    if (typeof openModal !== 'function') return;
    openModal('Bienvenido a MoorePrint', welcomeBody(), '<button class="button secondary" type="button" data-learning-skip>Explorar por mi cuenta</button>');
  }

  function shouldWaitForProfile() {
    const configured = Boolean(window.MoorePrintCloud?.isConfigured?.());
    return Boolean(configured && window.MoorePrintBranches?.getProfile && !profile());
  }

  function showWelcomeWhenReady() {
    const settings = readSettings();
    if (settings.welcomeSeen || settings.path) return;
    if (shouldWaitForProfile() && welcomeAttempts < 20) {
      welcomeAttempts += 1;
      setTimeout(showWelcomeWhenReady, 250);
      return;
    }
    openWelcome();
  }

  function selectPath(pathKey) {
    if (!LEARNING_PATHS[pathKey]) return;
    const selected = availablePathKeys().includes(pathKey) ? pathKey : 'operator';
    const settings = readSettings();
    settings.path = selected;
    settings.enabled = true;
    settings.welcomeSeen = true;
    settings.dismissed = [];
    writeSettings(settings);
    if (typeof closeModal === 'function') closeModal(true);
    renderAll();
    showSectionGuide(activeSection());
    if (typeof showToast === 'function') showToast(`${LEARNING_PATHS[selected].title} activada`);
  }

  function skipWelcome() {
    const settings = readSettings();
    settings.welcomeSeen = true;
    settings.enabled = false;
    writeSettings(settings);
    if (typeof closeModal === 'function') closeModal(true);
    renderAll();
  }

  function pauseLearning() {
    const settings = readSettings();
    settings.enabled = false;
    writeSettings(settings);
    removeSectionCoach();
    renderAll();
  }

  function resumeLearning() {
    const settings = readSettings();
    settings.enabled = true;
    settings.welcomeSeen = true;
    writeSettings(settings);
    renderAll();
    showSectionGuide(activeSection());
  }

  function changePath() {
    const settings = readSettings();
    settings.path = '';
    settings.enabled = true;
    settings.welcomeSeen = true;
    settings.dismissed = [];
    writeSettings(settings);
    removeSectionCoach();
    renderAll();
  }

  function resetLearning() {
    try { localStorage.removeItem(storageKey()); } catch (error) {}
    removeSectionCoach();
    renderAll();
    setTimeout(openWelcome, 40);
  }

  function resetDismissed() {
    const settings = readSettings();
    settings.dismissed = [];
    writeSettings(settings);
    renderAll();
    showSectionGuide(activeSection());
  }

  function dismissSection(section) {
    const settings = readSettings();
    if (!settings.dismissed.includes(section)) settings.dismissed.push(section);
    writeSettings(settings);
    renderSectionCoach(section);
  }

  function navigateTo(section) {
    if (!section || typeof navigate !== 'function') return;
    if (typeof closeModal === 'function') closeModal(true);
    navigate(section);
    setTimeout(() => showSectionGuide(section), 60);
  }

  function performAction(action, section) {
    if (section) navigateTo(section);
    const later = callback => setTimeout(() => { try { callback(); } catch (error) {} }, 90);
    if (action === 'order') later(() => window.openOrderModal?.());
    else if (action === 'quote') later(() => window.openQuoteModal?.());
    else if (action === 'customer') later(() => window.openCustomerModal?.());
    else if (action === 'product') later(() => window.openProductModal?.());
    else if (action === 'material') later(() => window.openMaterialModal?.());
    else if (action === 'supplier') later(() => window.openSupplierModal?.());
    else if (action === 'purchase') later(() => window.openPurchaseModal?.());
    else if (action === 'expense') later(() => window.openExpenseModal?.());
    else if (action === 'waste') later(() => document.querySelector('#newWasteButton')?.click());
    else if (action === 'backup') later(() => (document.querySelector('#backupButton') || document.querySelector('#exportBackupButton'))?.click());
  }

  function enhanceHelpButton() {
    const button = document.querySelector('#uxHelpButton');
    if (!button || button.dataset.learningEnhanced) return;
    button.dataset.learningEnhanced = 'true';
    button.classList.add('learning-help-button');
    button.setAttribute('aria-label', 'Abrir guía de esta sección');
    button.innerHTML = '<span aria-hidden="true">?</span><span class="ux-help-label">Guía</span>';
  }

  function beginRendering() {
    rendering = true;
    setTimeout(() => { rendering = false; }, 0);
  }

  function renderAll() {
    beginRendering();
    renderLearningPanel();
    renderHelpCenter();
    enhanceHelpButton();
  }

  function showSectionGuide(section = activeSection()) {
    if (!SECTION_GUIDES[section]) return;
    markVisited(section);
    currentSection = section;
    beginRendering();
    renderLearningPanel();
    renderHelpCenter();
    enhanceHelpButton();
    renderSectionCoach(section);
  }

  function syncInterface() {
    if (rendering) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (rendering) return;
      const nextIdentity = identity();
      const nextSection = activeSection();
      if (nextIdentity !== currentIdentity) {
        currentIdentity = nextIdentity;
        welcomeAttempts = 0;
        renderAll();
        setTimeout(showWelcomeWhenReady, 200);
      } else renderAll();
      if (nextSection !== currentSection) showSectionGuide(nextSection);
      else {
        beginRendering();
        renderSectionCoach(nextSection);
      }
    }, 60);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.id !== 'uxHelpButton') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSectionHelp(activeSection());
    }, true);

    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.learningSelect) selectPath(button.dataset.learningSelect);
      else if (button.dataset.learningSkip !== undefined) skipWelcome();
      else if (button.dataset.learningPause !== undefined) pauseLearning();
      else if (button.dataset.learningResume !== undefined) resumeLearning();
      else if (button.dataset.learningChange !== undefined) changePath();
      else if (button.dataset.learningReset !== undefined) resetLearning();
      else if (button.dataset.learningResetDismissed !== undefined) resetDismissed();
      else if (button.dataset.learningDismissSection) dismissSection(button.dataset.learningDismissSection);
      else if (button.dataset.learningSectionHelp) openSectionHelp(button.dataset.learningSectionHelp);
      else if (button.dataset.learningOpenCurrent !== undefined) openSectionHelp(activeSection());
      else if (button.dataset.learningGo) navigateTo(button.dataset.learningGo);
      else if (button.dataset.learningAction) performAction(button.dataset.learningAction, button.dataset.learningSection);
    });
  }

  function observeInterface() {
    const target = document.querySelector('.main-content') || document.body;
    observer = new MutationObserver(syncInterface);
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    currentIdentity = identity();
    bindEvents();
    observeInterface();
    renderAll();
    showSectionGuide(activeSection());
    setTimeout(showWelcomeWhenReady, 1200);
  }

  function waitForApplication() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      let hasState = false;
      try { hasState = typeof state !== 'undefined' || typeof window.state !== 'undefined'; }
      catch (error) { hasState = typeof window.state !== 'undefined'; }
      const ready = typeof window.navigate === 'function' && hasState && document.querySelector('#dashboard');
      if (ready || attempts > 180) {
        clearInterval(timer);
        if (ready) initialize();
      }
    }, 80);
  }

  window.MoorePrintLearningGuide = {
    init: initialize,
    selectPath,
    pauseLearning,
    resumeLearning,
    resetLearning,
    openWelcome,
    openSectionHelp,
    showSectionGuide,
    getSettings: readSettings,
    getProgress: pathKey => pathProgress(pathKey || readSettings().path),
    storageKey
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForApplication);
  else waitForApplication();
})();
