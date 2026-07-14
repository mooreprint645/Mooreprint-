(function () {
  const STORAGE_PREFIX = 'mooreprint-beginner-v1';
  let initialized = false;
  let rendering = false;
  let timer = null;

  const html = value => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
  const data = () => ({ ...(window.MoorePrintBeginnerSections || {}), ...(window.MoorePrintBeginnerForms || {}) });
  const profile = () => window.MoorePrintBranches?.getProfile?.() || null;
  const identity = () => String(profile()?.user_id || profile()?.id || 'local');
  const storageKey = () => `${STORAGE_PREFIX}-${identity()}`;
  const defaults = () => ({ enabled:true, dismissed:[] });

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      return { ...defaults(), ...(saved || {}), dismissed:Array.isArray(saved?.dismissed) ? saved.dismissed : [] };
    } catch (error) { return defaults(); }
  }

  function writePreferences(preferences) {
    try { localStorage.setItem(storageKey(), JSON.stringify({ ...defaults(), ...preferences })); }
    catch (error) {}
  }

  const activeSection = () => document.querySelector('.page-section.active')?.id || document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
  const areaName = section => data().AREAS?.[section]?.[0] || section;
  const areaIcon = section => data().AREAS?.[section]?.[1] || '•';

  function levelLabel(level) {
    if (level === 'financiero') return 'Impacto financiero';
    if (level === 'operativo') return 'Impacto operativo';
    if (level === 'operativo y financiero') return 'Impacto operativo y financiero';
    return 'Solo información';
  }

  function relatedButtons(sections) {
    if (!sections?.length) return '<span class="beginner-no-related">No modifica otras áreas directamente.</span>';
    return sections.map(section => `<button type="button" data-beginner-go="${section}"><span aria-hidden="true">${areaIcon(section)}</span>${html(areaName(section))}</button>`).join('');
  }

  function renderSectionCard(section = activeSection()) {
    const preferences = readPreferences();
    document.querySelectorAll('.beginner-impact-card').forEach(card => {
      if (card.dataset.section !== section || !preferences.enabled || preferences.dismissed.includes(section)) card.remove();
    });
    if (!preferences.enabled || preferences.dismissed.includes(section)) return;
    const impact = data().SECTION_IMPACTS?.[section];
    const sectionNode = document.getElementById(section);
    if (!impact || !sectionNode?.classList.contains('active') || sectionNode.querySelector(`:scope > .beginner-impact-card[data-section="${section}"]`)) return;

    const card = document.createElement('article');
    card.className = 'beginner-impact-card';
    card.dataset.section = section;
    card.innerHTML = `<div class="beginner-impact-heading"><div><span class="beginner-eyebrow">Modo principiante · ${html(levelLabel(impact.level))}</span><h2>¿Qué pasa cuando usas ${html(areaName(section))}?</h2><p>${html(impact.summary)}</p></div><button class="button secondary" type="button" data-beginner-open="${section}">Explicación completa</button></div><div class="beginner-impact-grid"><section><span>Aquí puede cambiar</span><ul>${impact.changes.map(item => `<li>${html(item)}</li>`).join('')}</ul></section><section><span>Recibe información de</span><div class="beginner-related">${relatedButtons(impact.receives)}</div></section><section><span>También se refleja en</span><div class="beginner-related">${relatedButtons(impact.affects)}</div></section></div><div class="beginner-check-row"><div><strong>Antes de guardar</strong><p>${html(impact.check)}</p></div><div><strong>Ejemplo sencillo</strong><p>${html(impact.example)}</p></div></div><div class="beginner-card-actions"><button class="text-button" type="button" data-beginner-map>Ver mapa completo del negocio</button><button class="text-button" type="button" data-beginner-dismiss="${section}">Ocultar esta explicación</button></div>`;
    const coach = sectionNode.querySelector(':scope > .learning-section-coach');
    if (coach) coach.insertAdjacentElement('afterend', card);
    else sectionNode.prepend(card);
  }

  function sectionImpactBody(section) {
    const impact = data().SECTION_IMPACTS?.[section] || data().SECTION_IMPACTS?.dashboard;
    if (!impact) return '<p>No hay explicación disponible.</p>';
    return `<div class="beginner-modal-impact"><div class="beginner-modal-summary"><span class="beginner-eyebrow">${html(levelLabel(impact.level))}</span><h3>${html(areaName(section))}</h3><p>${html(impact.summary)}</p></div><div class="beginner-modal-columns"><article><span>Qué cambia</span><ul>${impact.changes.map(item => `<li>${html(item)}</li>`).join('')}</ul></article><article><span>De dónde vienen sus datos</span><div class="beginner-related">${relatedButtons(impact.receives)}</div></article><article><span>Dónde verás el resultado</span><div class="beginner-related">${relatedButtons(impact.affects)}</div></article></div><div class="beginner-modal-check"><strong>Revisión mínima</strong><p>${html(impact.check)}</p></div><div class="beginner-modal-example"><strong>Ejemplo de imprenta</strong><p>${html(impact.example)}</p></div></div>`;
  }

  function openSectionImpact(section = activeSection()) {
    if (typeof openModal !== 'function') return;
    openModal(`Impacto · ${areaName(section)}`, sectionImpactBody(section), '<button class="button secondary" type="button" data-close-modal>Cerrar</button><button class="button primary" type="button" data-beginner-map>Ver mapa del negocio</button>');
  }

  function flowLane(group) {
    return `<article class="beginner-flow-lane"><div><h3>${html(group.title)}</h3><p>${html(group.note)}</p></div><div class="beginner-flow-steps">${group.sections.map((section,index) => `<button type="button" data-beginner-go="${section}"><span aria-hidden="true">${areaIcon(section)}</span><strong>${html(areaName(section))}</strong></button>${index < group.sections.length - 1 ? '<span class="beginner-flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div></article>`;
  }

  function ensureHelpMap() {
    const help = document.querySelector('#help');
    const groups = data().FLOW_GROUPS || [];
    if (!help || !groups.length) return;
    let map = document.querySelector('#beginnerBusinessMap');
    if (!map) {
      map = document.createElement('section');
      map.id = 'beginnerBusinessMap';
      map.className = 'beginner-business-map';
      map.innerHTML = `<div class="beginner-map-heading"><div><span class="beginner-eyebrow">Administración sin tecnicismos</span><h2>Cómo se conecta todo en MoorePrint</h2><p>Selecciona un paso para abrirlo. Las flechas muestran qué información pasa de un módulo al siguiente.</p></div><button class="button secondary" type="button" data-beginner-toggle></button></div><div class="beginner-flow-list">${groups.map(flowLane).join('')}</div><div class="beginner-rules"><article><strong>Documento no significa dinero</strong><p>Pedido, compra o gasto crea un saldo. Caja cambia al registrar el pago.</p></article><article><strong>Inventario entra y sale</strong><p>Compra aumenta. Producción y merma reducen. Ajuste solo corrige.</p></article><article><strong>Reportes no corrige datos</strong><p>Si algo está mal, corrige el registro que alimenta el reporte.</p></article></div><div class="beginner-map-actions"><button class="button secondary" type="button" data-beginner-show-all>Volver a mostrar todas las explicaciones</button></div>`;
      const learningCenter = document.querySelector('#learningHelpCenter');
      if (learningCenter) learningCenter.insertAdjacentElement('afterend', map);
      else help.prepend(map);
    }
    const preferences = readPreferences();
    const toggle = map.querySelector('[data-beginner-toggle]');
    const nextLabel = preferences.enabled ? 'Ocultar modo principiante' : 'Activar modo principiante';
    if (toggle && toggle.textContent !== nextLabel) toggle.textContent = nextLabel;
    map.classList.toggle('is-disabled', !preferences.enabled);
  }

  function ensureImpactButton() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions || document.querySelector('#beginnerImpactButton')) return;
    const button = document.createElement('button');
    button.id = 'beginnerImpactButton';
    button.className = 'button secondary beginner-impact-button';
    button.type = 'button';
    button.setAttribute('aria-label','Explicar qué modifica esta sección');
    button.innerHTML = '<span aria-hidden="true">↔</span><span class="beginner-impact-label">Impacto</span>';
    actions.appendChild(button);
  }

  function formPanelMarkup(formId, guide) {
    return `<div class="beginner-form-heading"><div><span class="beginner-eyebrow">Antes de guardar</span><h3>${html(guide.title)}</h3><p>${html(guide.result)}</p></div><span class="beginner-form-badge">Explicación</span></div><div class="beginner-form-effects"><div><strong>Se reflejará en</strong><div class="beginner-related">${relatedButtons(guide.affects)}</div></div><div><strong>No sucede automáticamente</strong><p>${html(guide.doesNot)}</p></div><div><strong>Comprueba</strong><p>${html(guide.check)}</p></div></div><div class="beginner-field-explainer" id="beginnerFieldExplainer-${formId}" aria-live="polite"><span>Selecciona un campo</span><strong>Te explicaremos qué significa y qué puede cambiar.</strong><p>La explicación no modifica el valor capturado.</p></div>`;
  }

  function enhanceForm(form) {
    const guide = data().FORM_GUIDES?.[form.id];
    if (!guide || form.dataset.beginnerEnhanced) return;
    form.dataset.beginnerEnhanced = 'true';
    const panel = document.createElement('aside');
    panel.className = 'beginner-form-impact';
    panel.dataset.form = form.id;
    panel.innerHTML = formPanelMarkup(form.id,guide);
    form.prepend(panel);
  }

  function enhanceForms() {
    Object.keys(data().FORM_GUIDES || {}).forEach(formId => {
      const form = document.getElementById(formId);
      if (form) enhanceForm(form);
    });
  }

  function updateFieldExplanation(field) {
    const form = field?.form;
    const guide = form ? data().FORM_GUIDES?.[form.id] : null;
    const explanation = guide?.fields?.[field.name];
    const node = form?.querySelector('.beginner-field-explainer');
    if (!node || !explanation) return;
    const [title,meaning,impact,warning] = explanation;
    node.innerHTML = `<span>${html(title)}</span><strong>${html(meaning)}</strong><p><b>Qué afecta:</b> ${html(impact)}</p><p><b>Revisa:</b> ${html(warning)}</p>`;
    const ids = String(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!ids.includes(node.id)) field.setAttribute('aria-describedby',[...ids,node.id].join(' '));
  }

  function setEnabled(enabled) {
    const preferences = readPreferences();
    preferences.enabled = Boolean(enabled);
    writePreferences(preferences);
    if (!preferences.enabled) document.querySelectorAll('.beginner-impact-card').forEach(node => node.remove());
    syncInterface();
    if (typeof showToast === 'function') showToast(preferences.enabled ? 'Modo principiante activado' : 'Modo principiante oculto');
  }

  function dismissSection(section) {
    const preferences = readPreferences();
    if (!preferences.dismissed.includes(section)) preferences.dismissed.push(section);
    writePreferences(preferences);
    renderSectionCard(section);
  }

  function showAllSections() {
    const preferences = readPreferences();
    preferences.enabled = true;
    preferences.dismissed = [];
    writePreferences(preferences);
    syncInterface();
  }

  function navigateTo(section) {
    if (!section || typeof window.navigate !== 'function') return;
    if (typeof closeModal === 'function') closeModal(true);
    window.navigate(section);
    setTimeout(syncInterface,80);
  }

  function openBusinessMap() {
    if (typeof closeModal === 'function') closeModal(true);
    navigateTo('help');
    setTimeout(() => document.querySelector('#beginnerBusinessMap')?.scrollIntoView({ behavior:'smooth',block:'start' }),120);
  }

  function syncInterface() {
    if (rendering) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (rendering) return;
      rendering = true;
      ensureImpactButton();
      ensureHelpMap();
      enhanceForms();
      renderSectionCard(activeSection());
      setTimeout(() => { rendering = false; },0);
    },40);
  }

  function bindEvents() {
    document.addEventListener('click',event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.id === 'beginnerImpactButton') openSectionImpact(activeSection());
      else if (button.dataset.beginnerOpen) openSectionImpact(button.dataset.beginnerOpen);
      else if (button.dataset.beginnerGo) navigateTo(button.dataset.beginnerGo);
      else if (button.dataset.beginnerMap !== undefined) openBusinessMap();
      else if (button.dataset.beginnerDismiss) dismissSection(button.dataset.beginnerDismiss);
      else if (button.dataset.beginnerToggle !== undefined) setEnabled(!readPreferences().enabled);
      else if (button.dataset.beginnerShowAll !== undefined) showAllSections();
    });
    document.addEventListener('focusin',event => {
      if (event.target.matches('input,select,textarea')) updateFieldExplanation(event.target);
    });
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    const target = document.querySelector('.main-content') || document.body;
    new MutationObserver(syncInterface).observe(target,{ childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden'] });
    syncInterface();
  }

  function waitForApplication() {
    let attempts = 0;
    const timerId = setInterval(() => {
      attempts += 1;
      const ready = typeof window.navigate === 'function' && document.querySelector('#dashboard');
      if (ready || attempts > 180) {
        clearInterval(timerId);
        if (ready) initialize();
      }
    },80);
  }

  window.MoorePrintBeginnerMode = {
    init:initialize,setEnabled,showAllSections,openSectionImpact,openBusinessMap,renderSectionCard,enhanceForms,
    getPreferences:readPreferences,
    getSectionImpact:section => data().SECTION_IMPACTS?.[section] || null,
    getFormGuide:formId => data().FORM_GUIDES?.[formId] || null,
    storageKey
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',waitForApplication);
  else waitForApplication();
})();