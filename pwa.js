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

  function init() {
    if (initialized) return;
    initialized = true;
    installButton()?.addEventListener('click', installApp);
    refreshInstallButton();
    registerServiceWorker();
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