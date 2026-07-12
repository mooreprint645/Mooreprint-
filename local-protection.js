(function () {
  let initialized = false;

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function toast(message, type = '') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else console.log(message);
  }

  async function refreshStatus() {
    const node = document.querySelector('#fileBackupStatus');
    if (!node || !window.FileDB?.getStorageSummary) return;
    try {
      const summary = await window.FileDB.getStorageSummary();
      node.textContent = summary.count
        ? `${summary.count} archivo${summary.count === 1 ? '' : 's'} · ${formatBytes(summary.totalBytes)} guardados en este dispositivo.`
        : 'No hay archivos adjuntos guardados en este dispositivo.';
    } catch (error) {
      node.textContent = 'No fue posible revisar los archivos locales.';
    }
  }

  async function exportFiles(button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparando archivos…';
    try {
      const result = await window.FileDB.exportBackup();
      toast(`${result.count} archivo${result.count === 1 ? '' : 's'} respaldado${result.count === 1 ? '' : 's'}.`);
      await refreshStatus();
    } catch (error) {
      toast(error.message || 'No se pudo crear el respaldo de archivos.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function importFiles(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = await window.FileDB.importBackup(file);
      toast(`${result.count} archivo${result.count === 1 ? '' : 's'} restaurado${result.count === 1 ? '' : 's'}.`);
      await refreshStatus();
    } catch (error) {
      toast(error.message || 'No se pudo restaurar el respaldo de archivos.', 'error');
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const exportButton = document.querySelector('#exportFilesBackupButton');
    const importInput = document.querySelector('#importFilesBackupInput');

    exportButton?.addEventListener('click', () => exportFiles(exportButton));
    importInput?.addEventListener('change', () => importFiles(importInput));
    refreshStatus();

    document.addEventListener('click', event => {
      if (event.target?.id === 'confirmClearData') setTimeout(refreshStatus, 250);
    });
  }

  window.MoorePrintLocalProtection = { init, refreshStatus };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();