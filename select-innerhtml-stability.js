(function () {
  if (window.__moorePrintSelectInnerHtmlStable) return;
  window.__moorePrintSelectInnerHtmlStable = true;

  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descriptor?.get || !descriptor?.set || typeof HTMLElement === 'undefined') return;

  try {
    Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        const next = String(value ?? '');
        const stableComponent =
          this instanceof HTMLSelectElement
          || this.id === 'teamHardeningPanel'
          || this.id === 'teamOperationsPanel'
          || this.id === 'teamWorkflowPanel';
        if (stableComponent && descriptor.get.call(this) === next) return;
        descriptor.set.call(this, next);
      }
    });
  } catch (error) {
    console.warn('No fue posible estabilizar los componentes heredados.', error);
  }
})();
