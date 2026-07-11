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

  function loadScriptOnce(file, datasetKey, errorMessage) {
    if (document.querySelector(`script[${datasetKey}]`)) return;
    const script = document.createElement('script');
    script.src = new URL(file, currentSource).href;
    script.defer = true;
    script.setAttribute(datasetKey, 'true');
    script.onerror = () => console.warn(errorMessage);
    document.head.appendChild(script);
  }

  function loadOperationsExtensions(attempt = 0) {
    if (!window.MoorePrintOperations && attempt < 200) {
      setTimeout(() => loadOperationsExtensions(attempt + 1), 100);
      return;
    }
    if (!window.MoorePrintOperations) return;

    if (!window.MoorePrintOperationsUiGuard) {
      loadScriptOnce(
        'team-operations-ui-guard.js',
        'data-team-operations-ui-guard',
        'No se pudo cargar la guardia visual de operaciones.'
      );
    }

    if (!window.MoorePrintHardening) {
      loadScriptOnce(
        'team-hardening.js',
        'data-team-hardening',
        'No se pudo cargar la protección avanzada.'
      );
    }
  }

  setTimeout(() => loadOperationsExtensions(), 0);
})();
