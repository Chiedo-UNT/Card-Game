// Timeline component — shows the upcoming turn order as a horizontal strip.
// Listens to 'combat:timeline_updated' on Engine.bus and re-renders.

(function () {
class TimelineComponent {
  /**
   * @param {HTMLElement} container — element to render into
   * @param {object}      unitNames — { unitId: displayName }
   */
  constructor(container, unitNames = {}) {
    this._container = container;
    this._unitNames = unitNames;
    this._handler   = null;
  }

  mount() {
    this._container.innerHTML = '';
    this._container.className = 'timeline';

    this._handler = ({ timeline }) => this._render(timeline);
    Engine.bus.on('combat:timeline_updated', this._handler);
  }

  update(timeline) {
    this._render(timeline);
  }

  destroy() {
    if (this._handler) {
      Engine.bus.off('combat:timeline_updated', this._handler);
      this._handler = null;
    }
    this._container.innerHTML = '';
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _render(timeline) {
    this._container.innerHTML = '';

    // Show up to 8 entries
    const visible = timeline.slice(0, 8);

    visible.forEach((entry, idx) => {
      const isPlayer = entry.unitId === 'player';
      const name = this._unitNames[entry.unitId]
        || (isPlayer ? '⚔' : entry.unitId.replace('enemy_', 'E'));

      const item = document.createElement('div');
      item.className = 'timeline-item' + (idx === 0 ? ' timeline-item--active' : '')
        + (isPlayer ? ' timeline-item--player' : ' timeline-item--enemy');

      item.innerHTML = `
        <span class="timeline-icon">${isPlayer ? '⚔' : '☠'}</span>
        <span class="timeline-name">${this._esc(name)}</span>
        <span class="timeline-tick">${entry.tick}</span>
      `;

      this._container.appendChild(item);

      // Separator arrow between items
      if (idx < visible.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'timeline-sep';
        sep.textContent = '›';
        this._container.appendChild(sep);
      }
    });
  }

  _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.TimelineComponent = TimelineComponent;
})();
