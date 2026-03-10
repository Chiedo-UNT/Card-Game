// HexGridRenderer — renders a flat-top hex combat grid into a container element.
// Positions cells using HexGrid.toPixel(); cells are absolutely-positioned divs.
// Emits events on Engine.bus: 'hexgrid:cell_click', 'hexgrid:cell_hover'

(function () {
class HexGridRenderer {
  /**
   * @param {HTMLElement} container  — element that receives the hex cells
   * @param {object}      options
   *   cols     {number}  grid columns (default 10)
   *   rows     {number}  grid rows    (default 6)
   *   size     {number}  hex radius in px (default 36)
   *   padding  {number}  extra px around the grid (default 8)
   */
  constructor(container, options = {}) {
    this._container = container;
    this._cols    = options.cols    || 10;
    this._rows    = options.rows    || 6;
    this._size    = options.size    || 36;
    this._padding = options.padding || 8;

    this._cells   = {};   // key "q,r" → DOM element
    this._tokens  = {};   // unitId → DOM element
    this._highlights = new Set();

    this._hoveredKey = null;
    this._selectedKey = null;

    // Drag state
    this._dragging = false;
    this._dragUnitId = null;
    this._dragGhost = null;
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  build() {
    this._container.innerHTML = '';
    this._container.style.position = 'relative';

    // Compute grid pixel dimensions and center it
    const { w, h } = this._gridPixelSize();
    this._container.style.width  = `${w + this._padding * 2}px`;
    this._container.style.height = `${h + this._padding * 2}px`;

    const hexes = HexGrid.gridHexes(this._cols, this._rows);
    for (const { q, r } of hexes) {
      this._createCell(q, r);
    }
  }

  // ─── Cell State ─────────────────────────────────────────────────────────

  /** Set a cell's state class: null | 'reachable' | 'attackable' | 'selected' | 'highlighted' */
  setCellState(q, r, state) {
    const el = this._cells[`${q},${r}`];
    if (!el) return;
    el.dataset.state = state || '';
    el.className = 'hex-cell' + (state ? ` hex-cell--${state}` : '');
  }

  clearAllHighlights() {
    for (const key of this._highlights) {
      const el = this._cells[key];
      if (el) {
        el.dataset.state = '';
        el.className = 'hex-cell';
        el.style.background = this._stateBg('');
        el.style.outline = '';
        el.style.filter = '';
        delete el.dataset.pathHighlight;
        delete el.dataset.dragHover;
      }
    }
    this._highlights.clear();
  }

  highlight(hexes, state) {
    for (const { q, r } of hexes) {
      const key = `${q},${r}`;
      this._highlights.add(key);
      this.setCellState(q, r, state);
    }
  }

  selectCell(q, r) {
    if (this._selectedKey) {
      const prev = this._cells[this._selectedKey];
      if (prev) prev.classList.remove('hex-cell--selected');
    }
    this._selectedKey = `${q},${r}`;
    const el = this._cells[this._selectedKey];
    if (el) el.classList.add('hex-cell--selected');
  }

  // ─── Tokens (combatant markers) ─────────────────────────────────────────

  addToken(unitId, q, r, opts = {}) {
    const px = this._toPixel(q, r);

    const token = document.createElement('div');
    token.className = 'hex-token ' + (opts.isPlayer ? 'hex-token--player' : 'hex-token--enemy');
    token.dataset.unitId = unitId;
    token.style.cssText = `
      position: absolute;
      left: ${px.x - 20}px;
      top:  ${px.y - 20}px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid ${opts.isPlayer ? 'var(--color-accent)' : 'var(--color-danger-light)'};
      background: var(--color-panel);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem;
      z-index: 5;
      pointer-events: none;
      transition: left 0.25s ease, top 0.25s ease;
    `;
    token.textContent = opts.icon || (opts.isPlayer ? '⚔' : '☠');

    if (opts.isPlayer) {
      token.style.pointerEvents = 'auto';
      token.style.cursor = 'grab';
      this._initDrag(token, unitId);
    }

    this._container.appendChild(token);
    this._tokens[unitId] = token;
    return token;
  }

  moveToken(unitId, q, r) {
    const token = this._tokens[unitId];
    if (!token) return;
    const px = this._toPixel(q, r);
    token.style.left = `${px.x - 20}px`;
    token.style.top  = `${px.y - 20}px`;
  }

  removeToken(unitId) {
    const token = this._tokens[unitId];
    if (token) { token.remove(); delete this._tokens[unitId]; }
  }

  updateTokenHP(unitId, hp, maxHp) {
    const token = this._tokens[unitId];
    if (!token) return;
    let badge = token.querySelector('.hex-token-hp');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'hex-token-hp';
      badge.style.cssText = `
        position: absolute; bottom: -10px; left: 50%;
        transform: translateX(-50%);
        background: var(--color-danger); color: #fff;
        font-size: 0.55rem; font-weight: 700;
        padding: 1px 4px; border-radius: 4px; white-space: nowrap;
      `;
      token.appendChild(badge);
    }
    badge.textContent = `${hp}/${maxHp}`;
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────

  _initDrag(token, unitId) {
    let startX, startY;

    const onMouseDown = (e) => {
      e.preventDefault();
      this._dragging = true;
      this._dragUnitId = unitId;
      startX = e.clientX;
      startY = e.clientY;
      token.style.cursor = 'grabbing';
      token.style.zIndex = '20';
      token.style.pointerEvents = 'none'; // let mouse events pass to cells
      token.style.transition = 'none'; // disable position transition during drag

      Engine.bus.emit('hexgrid:drag_start', { unitId });

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!this._dragging) return;
      const rect = this._container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Move token visually to follow cursor
      token.style.left = `${x - 20}px`;
      token.style.top  = `${y - 20}px`;

      // Determine hovered hex and emit
      const hexPos = HexGrid.fromPixel(
        x - this._padding - this._size,
        y - this._padding - this._size * Math.sqrt(3) / 2,
        this._size
      );
      Engine.bus.emit('hexgrid:drag_hover', { unitId, q: hexPos.q, r: hexPos.r });
    };

    const onMouseUp = (e) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!this._dragging) return;
      this._dragging = false;
      token.style.cursor = 'grab';
      token.style.zIndex = '5';
      token.style.pointerEvents = 'auto';
      token.style.transition = 'left 0.25s ease, top 0.25s ease';

      const rect = this._container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hexPos = HexGrid.fromPixel(
        x - this._padding - this._size,
        y - this._padding - this._size * Math.sqrt(3) / 2,
        this._size
      );

      Engine.bus.emit('hexgrid:drag_end', { unitId, q: hexPos.q, r: hexPos.r });
    };

    token.addEventListener('mousedown', onMouseDown);

    // Touch support
    token.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      onMouseDown({ preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    token.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: true });

    token.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      onMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
    });
  }

  /**
   * Highlight reachable hexes with a color gradient based on movement cost.
   * @param {Map<string, number>} costMap  — "q,r" → cost (from CombatState.getReachableHexes)
   * @param {number} maxCost — maximum initiative available
   */
  highlightReachable(costMap, maxCost) {
    this.clearAllHighlights();
    for (const [key, cost] of costMap) {
      const el = this._cells[key];
      if (!el) continue;
      this._highlights.add(key);

      // Gradient: low cost = bright green, high cost = dim/orange
      const ratio = 1 - (cost - 1) / Math.max(maxCost - 1, 1); // 1.0 (close) → 0.0 (far)
      const r = Math.round(46 + (230 - 46) * (1 - ratio));   // 46 → 230
      const g = Math.round(204 - (204 - 126) * (1 - ratio));  // 204 → 126
      const b = Math.round(113 - (113 - 34) * (1 - ratio));   // 113 → 34
      const alpha = 0.15 + 0.25 * ratio; // 0.40 (close) → 0.15 (far)

      el.dataset.state = 'move-reachable';
      el.style.background = `rgba(${r},${g},${b},${alpha})`;
    }
  }

  /**
   * Highlight the path from player to a target hex, and mark the drop target.
   * @param {Array<{q,r}>} path — hex coords along the path
   */
  highlightPath(path) {
    // Clear previous path + hover markers
    this._clearDragMarkers();

    for (const { q, r } of path) {
      const key = `${q},${r}`;
      const el = this._cells[key];
      if (!el) continue;
      el.style.outline = '2px solid rgba(255,255,255,0.45)';
      el.dataset.pathHighlight = '1';
    }

    // Last cell in path = drop target → bright inner border
    if (path.length > 0) {
      const last = path[path.length - 1];
      const el = this._cells[`${last.q},${last.r}`];
      if (el) {
        el.style.outline = '3px solid rgba(255,255,255,0.85)';
        el.style.filter = 'brightness(1.5)';
        el.dataset.dragHover = '1';
      }
    }
  }

  clearPath() {
    this._clearDragMarkers();
  }

  _clearDragMarkers() {
    for (const key of this._highlights) {
      const el = this._cells[key];
      if (!el) continue;
      if (el.dataset.pathHighlight) {
        el.style.outline = '';
        delete el.dataset.pathHighlight;
      }
      if (el.dataset.dragHover) {
        el.style.filter = '';
        el.style.outline = '';
        delete el.dataset.dragHover;
      }
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────

  _createCell(q, r) {
    const px = this._toPixel(q, r);
    const size = this._size;

    const el = document.createElement('div');
    el.className = 'hex-cell';
    el.dataset.q = q;
    el.dataset.r = r;

    // Flat-top hex clip-path: points at left & right, flat edges top & bottom
    el.style.cssText = `
      position: absolute;
      left: ${px.x - size}px;
      top:  ${px.y - size * Math.sqrt(3) / 2}px;
      width:  ${size * 2}px;
      height: ${size * Math.sqrt(3)}px;
      clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
      background: rgba(255,255,255,0.04);
      cursor: pointer;
      transition: background 0.12s;
      box-sizing: border-box;
    `;

    el.addEventListener('mouseenter', () => {
      this._hoveredKey = `${q},${r}`;
      if (this._dragging) return; // don't override highlight during drag
      el.style.background = 'rgba(255,255,255,0.10)';
      Engine.bus.emit('hexgrid:cell_hover', { q, r });
    });

    el.addEventListener('mouseleave', () => {
      this._hoveredKey = null;
      if (this._dragging) return; // don't override highlight during drag
      const state = el.dataset.state;
      el.style.background = this._stateBg(state);
    });

    el.addEventListener('click', () => {
      Engine.bus.emit('hexgrid:cell_click', { q, r });
    });

    this._container.appendChild(el);
    this._cells[`${q},${r}`] = el;
  }

  _stateBg(state) {
    switch (state) {
      case 'reachable':   return 'rgba(45,90,139,0.30)';
      case 'attackable':  return 'rgba(192,57,43,0.30)';
      case 'selected':    return 'rgba(201,162,39,0.35)';
      case 'highlighted': return 'rgba(46,204,113,0.25)';
      default:            return 'rgba(255,255,255,0.04)';
    }
  }

  _toPixel(q, r) {
    const raw = HexGrid.toPixel(q, r, this._size);
    return {
      x: raw.x + this._padding + this._size,
      y: raw.y + this._padding + this._size * Math.sqrt(3) / 2,
    };
  }

  _gridPixelSize() {
    const size = this._size;
    const w = size * (3 / 2 * this._cols + 0.5);
    const h = size * Math.sqrt(3) * (this._rows + 0.5);
    return { w, h };
  }

  destroy() {
    this._cells  = {};
    this._tokens = {};
    this._highlights.clear();
    this._container.innerHTML = '';
  }
}

window.HexGridRenderer = HexGridRenderer;
})();
