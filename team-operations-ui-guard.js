(function () {
  if (window.__moorePrintOperationsUiGuard) return;
  window.__moorePrintOperationsUiGuard = true;

  function enforceOrderLock() {
    const form = document.querySelector('#orderForm');
    if (!form) return;

    const locked = Boolean(form.querySelector('.team-order-lock.danger'));
    const submitButtons = [
      ...document.querySelectorAll('[form="orderForm"]'),
      ...form.querySelectorAll('button[type="submit"],input[type="submit"]')
    ];

    submitButtons.forEach(button => {
      if (button.disabled !== locked) button.disabled = locked;
      button.setAttribute('aria-disabled', locked ? 'true' : 'false');
      if (locked) button.title = 'Otro integrante está editando este pedido.';
      else if (button.title === 'Otro integrante está editando este pedido.') button.removeAttribute('title');
    });

    if (locked) form.dataset.teamEditLocked = 'true';
    else delete form.dataset.teamEditLocked;
  }

  const observer = new MutationObserver(() => enforceOrderLock());

  function init() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    enforceOrderLock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.MoorePrintOperationsUiGuard = {
    enforce: enforceOrderLock
  };
})();
