(function () {
  let installPrompt = null;
  let initialized = false;

  function isInstalled() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function installButton() {
    return document.querySelector('#installAppButton');
  }

  function refreshInstallButton() {
    const button = installButton();
    if (!button) return;
    const installed = isInstalled();
    button.hidden = installed || !installPrompt;
    button.disabled = installed;
    button.textContent = installed ? 'MoorePrint instalada' : 'Instalar MoorePrint';
  }

  async function installApp() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    refreshInstallButton();
    if (choice?.outcome === 'accepted') window.showToast?.('MoorePrint se está instalando.');
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('No se pudo activar el modo aplicación.', error);
    }
  }

  function loadPurchasePackageSupport() {
    if (document.querySelector('script[data-purchase-packages]')) return;
    const script = document.createElement('script');
    script.src = './purchase-packages.js';
    script.async = false;
    script.dataset.purchasePackages = 'true';
    script.addEventListener('load', () => {
      if (document.querySelector('script[data-unit-normalization]')) return;
      const normalization = document.createElement('script');
      normalization.src = './unit-normalization.js';
      normalization.async = false;
      normalization.dataset.unitNormalization = 'true';
      normalization.addEventListener('error', () => console.warn('No se pudo corregir la unidad del inventario.'));
      document.head.appendChild(normalization);
    });
    script.addEventListener('error', () => console.warn('No se pudo cargar el soporte de compras por caja.'));
    document.head.appendChild(script);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installButton()?.addEventListener('click', installApp);
    refreshInstallButton();
    registerServiceWorker();
    loadPurchasePackageSupport();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    refreshInstallButton();
    window.showToast?.('MoorePrint quedó instalada en este dispositivo.');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
