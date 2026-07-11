(function () {
  if (Object.prototype.hasOwnProperty.call(window, 'state')) return;
  try {
    Object.defineProperty(window, 'state', {
      configurable: true,
      enumerable: false,
      get() { return state; },
      set(value) { state = value; }
    });
  } catch (error) {
    console.warn('No fue posible compartir el estado de MoorePrint.', error);
  }
})();
