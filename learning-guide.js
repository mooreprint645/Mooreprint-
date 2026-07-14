(function () {
  const STORAGE_PREFIX = 'mooreprint-learning-v1';

  const SECTION_GUIDES = {
    dashboard: {
      title: 'Resumen',
      purpose: 'Concentrar la situación actual del negocio y mostrar qué necesita atención primero.',
      when: 'Úsalo al iniciar el día y antes de cerrar para revisar ventas, entregas, cobros y alertas.',
      impact: 'No modifica registros; resume la información capturada en las demás secciones.',
      before: 'Los indicadores son útiles cuando pedidos, pagos, compras y gastos están actualizados.',
      steps: ['Revisa las alertas y entregas cercanas.', 'Consulta ventas, utilidad y saldos.', 'Abre la tarea pendiente desde el acceso rápido correspondiente.'],
      caution: 'No tomes decisiones con el Resumen si faltan pagos, compras o gastos por registrar.',
      next: 'Pedidos', nextSection: 'orders', action: 'order'
    },
    orders: {
      title: 'Pedidos',
      purpose: 'Registrar cada trabajo vendido, su fecha de entrega, costo, pago y avance.',
      when: 'Úsalo cuando un cliente confirme un trabajo o deje un anticipo.',
      impact: 'Puede generar cuentas por cobrar y, al entrar en producción, descontar materiales del inventario.',
      before: 'Conviene tener al cliente y los productos registrados, aunque también puedes escribir un concepto manual.',
      steps: ['Selecciona o escribe el cliente y la fecha prometida.', 'Agrega trabajos, cantidades, precios y costos.', 'Guarda y actualiza el estado conforme avance hasta entregarlo.'],
      caution: 'No marques Producción, Listo o Entregado antes de confirmar materiales y aprobación del diseño.',
      next: 'Producción', nextSection: 'production', action: 'order'
    },
    production: {
      title: 'Producción',
      purpose: 'Mostrar en qué etapa se encuentra cada pedido y quién debe atenderlo.',
      when: 'Úsalo durante la jornada para organizar diseño, aprobación, impresión y entrega.',
      impact: 'Cambiar una etapa puede aplicar o revertir consumos de inventario según el estado del pedido.',
      before: 'El pedido debe tener fecha, conceptos y materiales correctos.',
      steps: ['Localiza el pedido por cliente o responsable.', 'Confirma la aprobación del diseño antes de producir.', 'Mueve el pedido a la etapa siguiente y revisa el resultado.'],
      caution: 'Mover pedidos sin revisar su receta puede descontar materiales incorrectos.',
      next: 'Calendario', nextSection: 'calendar', action: 'production'
    },
    calendar: {
      title: 'Calendario',
      purpose: 'Ordenar entregas, cobros y vencimientos por fecha.',
      when: 'Úsalo para planear la semana y detectar compromisos atrasados.',
      impact: 'No cambia registros; abre el pedido, cobro o gasto relacionado.',
      before: 'Los registros necesitan fechas correctas para aparecer en el día esperado.',
      steps: ['Revisa primero eventos atrasados y de hoy.', 'Abre el registro relacionado.', 'Corrige la fecha o completa la tarea pendiente.'],
      caution: 'Una fecha vacía o incorrecta puede ocultar una entrega importante.',
      next: 'Caja y pagos', nextSection: 'cash', action: 'calendar'
    },
    quotes: {
      title: 'Cotizaciones',
      purpose: 'Preparar precios para un cliente antes de confirmar la venta.',
      when: 'Úsalo cuando el cliente todavía está comparando opciones o requiere un presupuesto formal.',
      impact: 'No afecta inventario ni caja hasta que la cotización se convierta en pedido y se registren pagos.',
      before: 'Revisa costos, vigencia, descuento e impuestos.',
      steps: ['Selecciona al cliente y agrega conceptos.', 'Revisa total, vigencia y condiciones.', 'Cuando sea aceptada, conviértela en pedido.'],
      caution: 'No confundas una cotización aceptada con un pedido pagado o producido.',
      next: 'Pedidos', nextSection: 'orders', action: 'quote'
    },
    customers: {
      title: 'Clientes',
      purpose: 'Guardar contacto, datos fiscales, historial de trabajos y saldos de cada cliente.',
      when: 'Úsalo antes de registrar pedidos frecuentes o cuando necesites consultar adeudos.',
      impact: 'Los datos pueden reutilizarse en pedidos, cotizaciones y preparación de facturación.',
      before: 'Solicita únicamente los datos necesarios y confirma teléfono o correo.',
      steps: ['Registra nombre y un medio de contacto.', 'Agrega datos fiscales solo cuando sean necesarios.', 'Consulta su historial antes de ofrecer crédito o repetir un trabajo.'],
      caution: 'Evita crear duplicados con variaciones del mismo nombre.',
      next: 'Pedidos', nextSection: 'orders', action: 'customer'
    },
    products: {
      title: 'Productos y costos',
      purpose: 'Definir qué vende MoorePrint, cuánto cuesta producirlo y qué margen deja.',
      when: 'Úsalo antes de cotizar productos repetitivos o cuando cambie el costo de un material.',
      impact: 'Actualiza precios sugeridos, costos internos y recetas que pueden descontar inventario.',
      before: 'Registra materiales, mano de obra, diseño, energía, desperdicio y otros costos reales.',
      steps: ['Crea el producto y su categoría.', 'Agrega materiales y costos del proceso.', 'Revisa margen, precio recomendado y receta antes de guardar.'],
      caution: 'Un precio de venta sin costo interno correcto puede mostrar una utilidad falsa.',
      next: 'Inventario', nextSection: 'inventory', action: 'product'
    },
    calculator: {
      title: 'Calculadora',
      purpose: 'Estimar un precio rentable antes de crear una cotización o producto.',
      when: 'Úsala para trabajos especiales, cantidades nuevas o cambios rápidos de costos.',
      impact: 'Solo calcula hasta que decidas guardar el resultado como producto.',
      before: 'Reúne costos unitarios, desperdicio, comisión y margen deseado.',
      steps: ['Captura todos los costos por unidad.', 'Elige el margen deseado.', 'Compara precio mínimo y recomendado antes de ofrecerlo.'],
      caution: 'No omitas entrega, empaque, diseño o desperdicio por considerarlos pequeños.',
      next: 'Productos y costos', nextSection: 'products', action: 'product'
    },
    inventory: {
      title: 'Inventario',
      purpose: 'Controlar existencias, costos y movimientos de materiales.',
      when: 'Úsalo al recibir material, hacer conteos o investigar faltantes.',
      impact: 'Las compras aumentan existencias; la producción, ajustes y mermas pueden reducirlas.',
      before: 'Define una unidad consistente y una existencia mínima para cada material.',
      steps: ['Registra material, unidad, costo y mínimo.', 'Usa Compras para entradas normales.', 'Consulta movimientos antes de hacer un ajuste manual.'],
      caution: 'No mezcles piezas, metros, cajas y paquetes sin convertirlos a la unidad configurada.',
      next: 'Proveedores', nextSection: 'suppliers', action: 'material'
    },
    suppliers: {
      title: 'Proveedores',
      purpose: 'Guardar contactos, presentaciones, precios e historial de quienes venden materiales.',
      when: 'Úsalo para comparar costos o preparar una compra.',
      impact: 'Sus precios pueden actualizar costos preferidos y productos con precio automático.',
      before: 'Confirma presentación, cantidad por paquete, envío y costo final por unidad.',
      steps: ['Registra al proveedor.', 'Agrega los materiales y presentaciones que ofrece.', 'Compara el costo unitario antes de comprar.'],
      caution: 'Comparar solo el precio del paquete puede ocultar envío o diferencias de cantidad.',
      next: 'Compras', nextSection: 'purchases', action: 'supplier'
    },
    purchases: {
      title: 'Compras',
      purpose: 'Registrar materiales recibidos y deudas o pagos a proveedores.',
      when: 'Úsalo cada vez que entre material por una compra real.',
      impact: 'Aumenta inventario, actualiza el costo promedio y puede crear una cuenta por pagar.',
      before: 'Verifica proveedor, presentación, cantidad total, factura y forma de pago.',
      steps: ['Selecciona proveedor y materiales.', 'Confirma cantidades y costos por unidad.', 'Registra pagos parciales hasta liquidar.'],
      caution: 'No uses Ajustar existencia para reemplazar una compra; perderías el costo y la deuda del proveedor.',
      next: 'Inventario', nextSection: 'inventory', action: 'purchase'
    },
    waste: {
      title: 'Mermas',
      purpose: 'Registrar material perdido por pruebas, errores, roturas o defectos.',
      when: 'Úsalo cuando el material ya no puede venderse ni reutilizarse.',
      impact: 'Reduce inventario y registra el costo económico de la pérdida.',
      before: 'Identifica material, cantidad y causa real.',
      steps: ['Selecciona el material.', 'Captura cantidad y motivo.', 'Revisa el valor descontado antes de guardar.'],
      caution: 'No registres como merma un material que será devuelto al proveedor o reutilizado.',
      next: 'Inventario', nextSection: 'inventory', action: 'waste'
    },
    expenses: {
      title: 'Gastos',
      purpose: 'Registrar costos operativos que no pertenecen directamente a una compra de inventario.',
      when: 'Úsalo para renta, gasolina, servicios, sueldos, publicidad, impuestos y otros pagos.',
      impact: 'Reduce utilidad y, cuando se paga, genera una salida en caja.',
      before: 'Distingue si el movimiento es gasto operativo, compra de material o retiro del propietario.',
      steps: ['Elige una categoría clara.', 'Captura total, vencimiento y método.', 'Registra pagos parciales o totales.'],
      caution: 'Clasificar una compra de material como gasto evita que aumente el inventario.',
      next: 'Caja y pagos', nextSection: 'cash', action: 'expense'
    },
    recurring: {
      title: 'Gastos recurrentes',
      purpose: 'Programar obligaciones mensuales para no capturarlas desde cero cada periodo.',
      when: 'Úsalo para renta, internet, sueldos, licencias y servicios repetitivos.',
      impact: 'Genera gastos del mes; el pago se registra posteriormente desde Gastos.',
      before: 'Define monto, categoría, día de pago y fecha de inicio.',
      steps: ['Crea el concepto una sola vez.', 'Confirma que esté activo y con día correcto.', 'Revisa el gasto generado antes de pagarlo.'],
      caution: 'No generes manualmente el mismo gasto si ya fue creado por la programación.',
      next: 'Gastos', nextSection: 'expenses', action: 'expense'
    },
    cash: {
      title: 'Caja y pagos',
      purpose: 'Concentrar entradas, salidas, cobros, pagos y efectivo disponible.',
      when: 'Úsalo para revisar movimientos, cobrar pedidos y hacer el corte del día.',
      impact: 'Los pagos modifican saldos de clientes o proveedores y el balance por método de pago.',
      before: 'Abre el pedido, compra o gasto correcto antes de registrar su pago.',
      steps: ['Localiza el documento con saldo.', 'Registra monto, método, fecha y referencia.', 'Al final del día compara efectivo esperado y contado.'],
      caution: 'No registres dos veces un cobro: una vez en el pedido y otra como movimiento manual.',
      next: 'Reportes', nextSection: 'reports', action: 'cash'
    },
    reports: {
      title: 'Reportes',
      purpose: 'Analizar ventas, costos, gastos, utilidad, flujo y rendimiento del negocio.',
      when: 'Úsalo semanal o mensualmente para tomar decisiones y revisar tendencias.',
      impact: 'No modifica datos; calcula resultados con los registros existentes.',
      before: 'Asegúrate de que pedidos, pagos, compras y gastos del periodo estén completos.',
      steps: ['Selecciona el rango correcto.', 'Compara ventas, costos, utilidad y flujo.', 'Investiga diferencias antes de exportar.'],
      caution: 'Una utilidad alta con caja baja puede indicar ventas pendientes de cobro.',
      next: 'Resumen', nextSection: 'dashboard', action: 'reports'
    },
    activity: {
      title: 'Actividad',
      purpose: 'Consultar qué cambios se realizaron, cuándo y sobre qué registro.',
      when: 'Úsalo para aclarar modificaciones, errores o diferencias entre usuarios.',
      impact: 'No modifica datos; presenta el historial disponible.',
      before: 'Busca por folio, persona, movimiento o fecha aproximada.',
      steps: ['Filtra el periodo o tipo de evento.', 'Localiza el registro relacionado.', 'Compara el cambio con el estado actual.'],
      caution: 'El historial ayuda a investigar, pero no sustituye respaldos periódicos.',
      next: 'Configuración', nextSection: 'settings', action: 'activity'
    },
    notifications: {
      title: 'Avisos',
      purpose: 'Reunir entregas, cobros, inventario bajo y gastos que requieren atención.',
      when: 'Úsalo al comenzar el día o cuando aparezca una notificación.',
      impact: 'Abrir un aviso no cambia datos; la acción se completa en la sección relacionada.',
      before: 'Configura los tipos de aviso y días de anticipación.',
      steps: ['Revisa primero los urgentes.', 'Abre el registro relacionado.', 'Corrige o completa la tarea para retirar el aviso.'],
      caution: 'No ignores un aviso repetido sin revisar la fecha o el saldo que lo genera.',
      next: 'Calendario', nextSection: 'calendar', action: 'notifications'
    },
    invoicing: {
      title: 'Facturación',
      purpose: 'Preparar la información que necesita el contador o PAC para emitir un CFDI.',
      when: 'Úsalo cuando un cliente solicite factura y el pedido ya tenga datos correctos.',
      impact: 'Guarda un expediente de preparación; no firma, sella ni timbra una factura fiscal.',
      before: 'Completa datos fiscales del negocio, cliente y conceptos.',
      steps: ['Revisa los pedidos disponibles.', 'Completa receptor, claves y forma de pago.', 'Exporta el expediente y registra el UUID después del timbrado externo.'],
      caution: 'No guardes contraseñas, e.firma, certificados ni archivos .key en MoorePrint.',
      next: 'Clientes', nextSection: 'customers', action: 'invoicing'
    },
    help: {
      title: 'Centro de aprendizaje',
      purpose: 'Explicar tareas, términos y rutas recomendadas para aprender MoorePrint.',
      when: 'Úsalo cuando no sepas dónde registrar algo o quieras retomar el recorrido.',
      impact: 'Solo guarda preferencias de aprendizaje en este navegador.',
      before: 'Elige la ruta que corresponda a tus responsabilidades.',
      steps: ['Selecciona Administrador o Usuario operativo.', 'Consulta procedimientos por tema.', 'Usa el glosario o reinicia la guía cuando sea necesario.'],
      caution: 'La guía explica el proceso, pero debes respetar los permisos asignados a tu cuenta.',
      next: 'Resumen', nextSection: 'dashboard', action: 'help'
    },
    settings: {
      title: 'Configuración',
      purpose: 'Definir datos del negocio, instalación, respaldos y opciones administrativas.',
      when: 'Úsalo al preparar MoorePrint, cambiar datos oficiales o proteger la información.',
      impact: 'Puede cambiar datos impresos en documentos, saldo inicial y respaldos locales.',
      before: 'Confirma nombre, teléfono, correo, dirección y datos fiscales antes de guardar.',
      steps: ['Completa los datos del negocio.', 'Configura únicamente opciones que comprendas.', 'Descarga respaldos de datos y archivos con frecuencia.'],
      caution: 'No borres datos ni importes un respaldo sin conservar una copia reciente.',
      next: 'Resumen', nextSection: 'dashboard', action: 'settings'
    }
  };

  const LEARNING_PATHS = {
    administrator: {
      title: 'Ruta de administrador',
      icon: '⚙️',
      description: 'Prepara el negocio, costos, inventario, finanzas y respaldos.',
      steps: [
        { id: 'business', title: 'Configura los datos del negocio', detail: 'Datos que aparecen en notas y documentos.', section: 'settings', action: 'settings', check: 'business' },
        { id: 'materials', title: 'Registra materiales', detail: 'Existencia, unidad, costo y mínimo.', section: 'inventory', action: 'material', permission: 'manage_inventory', check: 'materials' },
        { id: 'catalog', title: 'Define productos y precios', detail: 'Costos reales, margen y receta.', section: 'products', action: 'product', permission: 'manage_catalog', check: 'products' },
        { id: 'suppliers', title: 'Organiza proveedores y compras', detail: 'Presentaciones, costos y entradas.', section: 'suppliers', action: 'supplier', permission: 'manage_catalog', check: 'suppliers' },
        { id: 'finances', title: 'Revisa caja y reportes', detail: 'Comprueba saldos, utilidad y flujo.', section: 'reports', action: 'reports', permission: 'view_finances', check: 'finances' },
        { id: 'backup', title: 'Crea tu primer respaldo', detail: 'Protege datos y archivos del dispositivo.', section: 'settings', action: 'backup', check: 'backup' }
      ]
    },
    operator: {
      title: 'Ruta de usuario operativo',
      icon: '🧾',
      description: 'Aprende a registrar clientes, pedidos, producción, cobros y entregas.',
      steps: [
        { id: 'customer', title: 'Registra un cliente', detail: 'Guarda nombre y contacto para reutilizarlo.', section: 'customers', action: 'customer', permission: 'view_customers', check: 'customers' },
        { id: 'order', title: 'Crea un pedido', detail: 'Trabajo, fecha, precio y anticipo.', section: 'orders', action: 'order', permission: 'create_orders', check: 'orders' },
        { id: 'production', title: 'Actualiza la producción', detail: 'Mueve el pedido conforme avance.', section: 'production', action: 'production', permission: 'view_production', check: 'production' },
        { id: 'payment', title: 'Registra un cobro', detail: 'Aplica anticipos o liquidaciones al pedido.', section: 'cash', action: 'cash', permission: 'manage_payments', check: 'payments' },
        { id: 'calendar', title: 'Consulta las entregas', detail: 'Revisa compromisos de hoy y próximos.', section: 'calendar', action: 'calendar', permission: 'view_calendar', check: 'calendar' }
      ]
    }
  };

  const GLOSSARY = [
    ['Pedido', 'Trabajo confirmado que puede generar saldo, producción e inventario.'],
    ['Cotización', 'Propuesta de precio que todavía no es una venta confirmada.'],
    ['Costo interno', 'Lo que realmente cuesta producir; no se muestra como precio al cliente.'],
    ['Saldo', 'Parte de un documento que todavía falta cobrar o pagar.'],
    ['Caja', 'Entradas y salidas de dinero clasificadas por método de pago.'],
    ['Compra', 'Entrada de material que actualiza inventario y puede generar deuda al proveedor.'],
    ['Merma', 'Material perdido que ya no puede venderse ni reutilizarse.'],
    ['Respaldo', 'Copia descargable para recuperar datos o archivos del dispositivo.']
  ];

  let initialized = false;
  let renderTimer = null;
  let observer = null;
  let currentIdentity = '';
  let currentSection = '';
  let welcomeAttempts = 0;

  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function profile() {
    return window.MoorePrintBranches?.getProfile?.() || null;
  }

  function identity() {
    const current = profile();
    return String(current?.user_id || current?.id || 'local');
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
      return { ...defaultSettings(), ...(saved || {}), visited: Array.isArray(saved?.visited) ? saved.visited : [], dismissed: Array.isArray(saved?.dismissed) ? saved.dismissed : [] };
    } catch (error) {
      return defaultSettings();
    }
  }

  function writeSettings(settings) {
    localStorage.setItem(storageKey(), JSON.stringify({ ...defaultSettings(), ...settings }));
  }

  function rows(name) {
    return Array.isArray(window.state?.[name]) ? window.state[name] : [];
  }

  function hasPermission(permission) {
    if (!permission) return true;
    const branches = window.MoorePrintBranches;
    if (!branches?.getProfile?.()) return true;
    if (!branches.getProfile()) return true;
    if (branches.isAdmin?.()) return true;
    return Boolean(branches.can?.(permission));
  }

  function availablePathKeys() {
    const current = profile();
    const keys = ['operator'];
    if (!current || window.MoorePrintBranches?.isAdmin?.()) keys.unshift('administrator');
    return keys;
  }

  function visibleSteps(pathKey) {
    const path = LEARNING_PATHS[pathKey];
    return path ? path.steps.filter(step => hasPermission(step.permission)) : [];
  }

  function completedByCheck(check, settings) {
    const business = window.state?.business || {};
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
    return { steps, completed, current, percent: steps.length ? Math.round(completed.length / steps.length * 100) : 100 };
  }

  function routeSelector(selected = '') {
    return `<div class="learning-route-selector" role="group" aria-label="Ruta de aprendizaje">${availablePathKeys().map(key => {
      const route = LEARNING_PATHS[key];
      return `<button class="learning-route-card ${selected === key ? 'selected' : ''}" type="button" data-learning-select="${key}" aria-pressed="${selected === key}"><span class="learning-route-icon" aria-hidden="true">${route.icon}</span><span><strong>${html(route.title)}</strong><small>${html(route.description)}</small></span></button>`;
    }).join('')}</div>`;
  }

  function ensureLearningPanel() {
    const anchor = document.querySelector('#uxDashboardGuide');
    const dashboard = document.querySelector('#dashboard');
    if (!dashboard) return null;
    let panel = document.querySelector('#learningGuidePanel');
    if (!panel) {
      panel = document.createElement('article');
      panel.id = 'learningGuidePanel';
      panel.className = 'learning-guide-panel';
      panel.setAttribute('aria-live', 'polite');
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
    panel.innerHTML = `<div class="learning-panel-heading"><div><span class="learning-eyebrow">${html(route.title)}</span><h2>${current ? 'Siguiente paso recomendado' : 'Ruta completada'}</h2><p>${current ? html(current.detail) : 'Ya conoces el flujo principal. La guía seguirá disponible en cada sección.'}</p></div><div class="learning-progress-copy"><strong>${progress.percent}%</strong><span>${progress.completed.length} de ${progress.steps.length}</span></div></div><div class="learning-progress-bar" role="progressbar" aria-label="Avance de la ruta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div>${current ? `<div class="learning-current-step"><div><span class="learning-step-number">${progress.completed.length + 1}</span><div><strong>${html(current.title)}</strong><small>${html(current.detail)}</small></div></div><button class="button primary" type="button" data-learning-action="${current.action}" data-learning-section="${current.section}">Comenzar</button></div>` : `<div class="learning-complete"><span aria-hidden="true">✓</span><div><strong>Recorrido principal completado</strong><small>Consulta la Guía de cualquier pantalla cuando necesites recordar un proceso.</small></div></div>`}<div class="learning-step-list">${progress.steps.map((step, index) => {
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
    center.innerHTML = `<div class="learning-help-heading"><div><span class="learning-eyebrow">Centro de aprendizaje</span><h2>${route ? html(route.title) : 'Elige cómo usarás MoorePrint'}</h2><p>${route ? `${progress.completed.length} de ${progress.steps.length} pasos completados. La ayuda se adapta a tus responsabilidades.` : 'Selecciona una ruta para recibir recomendaciones claras en cada pantalla.'}</p></div>${route ? `<button class="button secondary" type="button" data-learning-open-welcome>Cambiar ruta</button>` : ''}</div>${route ? `<div class="learning-help-progress"><div class="learning-progress-bar" role="progressbar" aria-label="Avance de la ruta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div><strong>${progress.percent}%</strong></div>` : routeSelector()}<div class="learning-help-tools"><button class="button secondary" type="button" data-learning-open-current>Explicar esta pantalla</button><button class="button secondary" type="button" data-learning-reset-dismissed>Volver a mostrar consejos</button>${settings.enabled && route ? '<button class="button secondary" type="button" data-learning-pause>Pausar recorrido</button>' : route ? '<button class="button primary" type="button" data-learning-resume>Continuar recorrido</button>' : ''}<button class="button danger subtle" type="button" data-learning-reset>Reiniciar aprendizaje</button></div><details class="learning-glossary"><summary>Glosario básico de administración</summary><div class="learning-glossary-grid">${GLOSSARY.map(([term, definition]) => `<article><strong>${html(term)}</strong><p>${html(definition)}</p></article>`).join('')}</div></details>`;

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
    return `<div class="learning-welcome"><div class="learning-welcome-intro"><span class="learning-welcome-mark" aria-hidden="true">MP</span><div><h3>Aprende sin memorizar todo</h3><p>MoorePrint te mostrará qué hace cada sección y cuál es la siguiente tarea recomendada. Elige la ruta que corresponde a tu trabajo.</p></div></div>${routeSelector()}<div class="learning-welcome-notes"><span>✓ La guía funciona sin conexión.</span><span>✓ No cambia tus permisos.</span><span>✓ Puedes pausarla o reiniciarla.</span></div></div>`;
  }

  function openWelcome() {
    if (typeof openModal !== 'function') return;
    openModal('Bienvenido a MoorePrint', welcomeBody(), '<button class="button secondary" type="button" data-learning-skip>Explorar por mi cuenta</button>');
  }

  function shouldWaitForProfile() {
    return Boolean(window.MoorePrintCloud?.hasAccess?.() && window.MoorePrintBranches?.getProfile && !profile());
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
    const allowed = availablePathKeys();
    const selected = allowed.includes(pathKey) ? pathKey : 'operator';
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
    localStorage.removeItem(storageKey());
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

  function renderAll() {
    renderLearningPanel();
    renderHelpCenter();
    enhanceHelpButton();
  }

  function showSectionGuide(section = activeSection()) {
    if (!SECTION_GUIDES[section]) return;
    markVisited(section);
    currentSection = section;
    renderLearningPanel();
    renderHelpCenter();
    renderSectionCoach(section);
  }

  function syncInterface() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const nextIdentity = identity();
      const nextSection = activeSection();
      if (nextIdentity !== currentIdentity) {
        currentIdentity = nextIdentity;
        welcomeAttempts = 0;
        renderAll();
        setTimeout(showWelcomeWhenReady, 200);
      } else {
        renderAll();
      }
      if (nextSection !== currentSection) showSectionGuide(nextSection);
      else renderSectionCoach(nextSection);
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
      else if (button.dataset.learningChange !== undefined || button.dataset.learningOpenWelcome !== undefined) changePath();
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
    setTimeout(showWelcomeWhenReady, 450);
  }

  function waitForApplication() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = typeof window.navigate === 'function' && typeof window.state !== 'undefined' && document.querySelector('#dashboard');
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
