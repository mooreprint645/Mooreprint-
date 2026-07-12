(function () {
  if (window.MoorePrintPurchasePackagesV2) return;
  const existing = document.querySelector('script[data-purchase-packages-v2]');
  if (existing) return;
  const script = document.createElement('script');
  script.src = './purchase-packages-v2.js?v=20260712-2';
  script.async = false;
  script.dataset.purchasePackagesV2 = 'true';
  script.addEventListener('error', () => console.warn('No se pudo cargar la corrección de compras por caja.'));
  document.head.appendChild(script);
})();
