(function () {
  if (window.__moorePrintSelectInnerHtmlStable) return;
  window.__moorePrintSelectInnerHtmlStable = true;

  const currentSource = document.currentScript?.src || location.href;
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

  if (descriptor?.get && descriptor?.set && typeof HTMLSelectElement !== 'undefined') {
    try {
      Object.defineProperty(HTMLSelectElement.prototype, 'innerHTML', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          const next = String(value ?? '');
          if (descriptor.get.call(this) === next) return;
          descriptor.set.call(this, next);
        }
      });
    } catch (error) {
      console.warn('No fue posible estabilizar los selectores dinámicos.', error);
    }
  }

  function loadOperationsGuard(attempt = 0) {
    if (window.MoorePrintOperationsUiGuard) return;
    if (!window.MoorePrintOperations && attempt < 200) {
      setTimeout(() => loadOperationsGuard(attempt + 1), 100);
      return;
    }
    if (!window.MoorePrintOperations || document.querySelector('script[data-team-operations-ui-guard]')) return;

    const script = document.createElement('script');
    script.src = new URL('team-operations-ui-guard.js', currentSource).href;
    script.defer = true;
    script.dataset.teamOperationsUiGuard = 'true';
    script.onerror = () => console.warn('No se pudo cargar la guardia visual de operaciones.');
    document.head.appendChild(script);
  }

  setTimeout(() => loadOperationsGuard(), 0);
})();
