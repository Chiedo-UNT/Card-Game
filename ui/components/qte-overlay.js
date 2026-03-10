// QTEOverlay — thin UI wrapper around QTESystem.
// Provides a HUD badge that shows the pending QTE type and
// resolves via QTESystem.trigger(), then emits the result.
//
// Usage:
//   const qte = new QTEOverlay();
//   const result = await qte.run('attack');  // 'critical' | 'success' | 'fail'

(function () {
class QTEOverlay {
  constructor() {
    this._badge = null;
  }

  /**
   * Run a QTE of the given type and return a Promise resolving with the result.
   * @param {'attack'|'dodge'} type
   * @returns {Promise<'critical'|'success'|'fail'>}
   */
  async run(type) {
    this._showBadge(type);
    const result = await QTESystem.trigger(type);
    this._hideBadge();
    Engine.bus.emit('qte:result', { type, result });
    return result;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _showBadge(type) {
    this._hideBadge();
    const badge = document.createElement('div');
    badge.id = 'qte-hud-badge';
    badge.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -200px);
      z-index: 9998;
      pointer-events: none;
      text-align: center;
    `;
    const label = type === 'attack'
      ? (I18n.t('ui.combat.qte_prompt') || 'Attaque !')
      : (I18n.t('ui.combat.qte_prompt') || 'Esquive !');
    badge.innerHTML = `
      <div style="
        background: rgba(0,0,0,0.75);
        border: 2px solid var(--color-accent);
        border-radius: 8px;
        padding: 6px 16px;
        color: var(--color-accent);
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        animation: qte-badge-pulse 0.4s ease infinite alternate;
      ">${label}</div>
    `;
    document.body.appendChild(badge);
    this._badge = badge;
  }

  _hideBadge() {
    if (this._badge) {
      this._badge.remove();
      this._badge = null;
    }
  }
}

window.QTEOverlay = QTEOverlay;
})();
