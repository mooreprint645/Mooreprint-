(function () {
  let initialized = false;
  let renderMonitor = null;

  function restoreEfficientInnerHTML() {
    if (window.__mooreprintEfficientInnerHTML) return;
    try {
      const frame = document.createElement('iframe');
      frame.hidden = true;
      frame.setAttribute('aria-hidden', 'true');
      document.documentElement.appendChild(frame);
      const cleanDescriptor = Object.getOwnPropertyDescriptor(frame.contentWindow.Element.prototype, 'innerHTML');
      frame.remove();
      if (!cleanDescriptor?.get || !cleanDescriptor?.set) return;

      const guardedIds = new Set([
        'uxOnboarding',
        'branchTopbar',
        'branchOrdersContext',
        'branchAdminPanel',
        'branchCards',
        'memberCards'
      ]);

      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: cleanDescriptor.enumerable,
        get: cleanDescriptor.get,
        set(value) {
          const next = String(value ?? '');
          if (guardedIds.has(this.id) && cleanDescriptor.get.call(this) === next) return;
          cleanDescriptor.set.call(this, value);
        }
      });
      window.__mooreprintEfficientInnerHTML = true;
    } catch (error) {
      console.warn('No fue posible restaurar el renderizado eficiente.', error);
    }
  }

  function installFutureObserverScheduler() {
    if (window.__mooreprintObserverScheduler || !window.MutationObserver) return;
    const NativeMutationObserver = window.MutationObserver;

    class ScheduledMutationObserver extends NativeMutationObserver {
      constructor(callback) {
        let pending = false;
        let records = [];
        let observerReference = null;
        super((nextRecords, observer) => {
          records.push(...nextRecords);
          observerReference = observer;
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => {
            pending = false;
            const batch = records;
            records = [];
            callback(batch, observerReference);
          });
        });
      }
    }

    window.MutationObserver = ScheduledMutationObserver;
    window.__mooreprintObserverScheduler = true;
  }

  function wrapRenderAll() {
    const current = window.renderAll;
    if (typeof current !== 'function' || current.__mooreprintPerformanceWrapped) return;

    let rendering = false;
    let queued = false;
    let lastRenderAt = 0;

    function optimizedRenderAll(...args) {
      if (document.visibilityState === 'hidden') {
        queued = true;
        return;
      }

      if (rendering) {
        queued = true;
        return;
      }

      const elapsed = performance.now() - lastRenderAt;
      if (elapsed < 34) {
        if (!queued) {
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            optimizedRenderAll(...args);
          });
        }
        return;
      }

      rendering = true;
      document.documentElement.classList.add('mp-rendering');
      try {
        return current.apply(this, args);
      } finally {
        rendering = false;
        lastRenderAt = performance.now();
        requestAnimationFrame(() => document.documentElement.classList.remove('mp-rendering'));
        if (queued) {
          queued = false;
          requestAnimationFrame(() => optimizedRenderAll());
        }
      }
    }

    optimizedRenderAll.__mooreprintPerformanceWrapped = true;
    optimizedRenderAll.__mooreprintBaseRender = current;
    window.renderAll = optimizedRenderAll;
    try { renderAll = optimizedRenderAll; } catch (error) {}
  }

  function installVisibilityRecovery() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      requestAnimationFrame(() => {
        wrapRenderAll();
        if (typeof window.renderAll === 'function') window.renderAll();
      });
    });
  }

  function installContainmentStyles() {
    if (document.querySelector('#mooreprintPerformanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'mooreprintPerformanceStyles';
    style.textContent = `
      .page-section:not(.active) { display: none !important; }
      .table-wrap, .production-board, .calendar-shell, .branch-admin-grid {
        contain: layout style paint;
      }
      html.mp-rendering .page-section.active,
      html.mp-rendering #branchTopbar,
      html.mp-rendering #branchAdminPanel {
        transition: none !important;
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          scroll-behavior: auto !important;
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function monitorLateWrappers() {
    clearInterval(renderMonitor);
    let checks = 0;
    renderMonitor = setInterval(() => {
      checks += 1;
      wrapRenderAll();
      if (checks >= 20) clearInterval(renderMonitor);
    }, 500);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    restoreEfficientInnerHTML();
    installFutureObserverScheduler();
    installContainmentStyles();
    installVisibilityRecovery();
    wrapRenderAll();
    monitorLateWrappers();
  }

  window.MoorePrintPerformance = { init, wrapRenderAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
