(function () {
  if (window.__moorePrintSelectInnerHtmlStable) return;
  window.__moorePrintSelectInnerHtmlStable = true;

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor?.get || !descriptor?.set || typeof HTMLSelectElement === 'undefined') return;

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
})();
