// main.js — entry point
// Waits for the DOM, drives the loading overlay, then calls Engine.init().

(function () {
  'use strict';

  // ─── Loading overlay helpers ─────────────────────────────────────────────

  function setProgress(pct, status) {
    const bar      = document.getElementById('loading-bar');
    const statusEl = document.getElementById('loading-status');
    if (bar)      { bar.style.width = Math.min(100, Math.max(0, pct)) + '%'; bar.setAttribute('aria-valuenow', pct); }
    if (statusEl && status !== undefined) statusEl.textContent = status;
  }

  function showError(msg) {
    const statusEl = document.getElementById('loading-status');
    if (statusEl) {
      statusEl.innerHTML =
        '<span style="color:#f66">Erreur\u00a0: ' + msg + '</span><br>' +
        '<small style="color:#aaa">Ouvrez la console (F12) pour les d\u00e9tails.</small>';
    }
    console.error('[main] Boot error:', msg);
  }

  function hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity    = '0';
    setTimeout(function () { overlay.style.display = 'none'; }, 420);
  }

  // ─── Boot sequence ───────────────────────────────────────────────────────

  async function boot() {
    setProgress(5, 'Démarrage…');

    // Sanity-check that engine.js loaded correctly
    if (!window.Engine) {
      showError('window.Engine introuvable (engine.js non chargé ?)');
      return;
    }

    // Optional progress hook
    if (window.Engine.bus && typeof window.Engine.bus.on === 'function') {
      window.Engine.bus.on('module:loaded', function () {
        setProgress(40, 'Module chargé…');
      });
    }

    setProgress(10, 'Chargement des modules…');

    try {
      await window.Engine.init();
      setProgress(100, 'Prêt !');
      setTimeout(hideOverlay, 200);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      showError(msg);
      // Last-chance fallback: try to show the menu even if init partially failed
      try { window.Engine.showScreen('menu'); hideOverlay(); } catch (_) {}
    }
  }

  // ─── DOM ready guard ─────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ─── Global error boundary ───────────────────────────────────────────────

  window.addEventListener('error', function (e) {
    console.error('[main] Uncaught error:', e.error || e.message);
  });

  window.addEventListener('unhandledrejection', function (e) {
    console.error('[main] Unhandled promise rejection:', e.reason);
  });

})();
