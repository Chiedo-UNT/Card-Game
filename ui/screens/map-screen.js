// World map screen — generates and displays the roguelite node map.
// Player can see forward nodes and click reachable ones to progress.

(function () {
class MapScreen {
  constructor(params = {}) {
    this.el     = document.getElementById('screen-map');
    this._map   = null;   // { nodes, edges, entry, exit }
    this._currentNodeId = null;
    this._params = params;
  }

  init() {
    this._initMap();
    this._build();
  }

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this.el.innerHTML = '';
    this._map = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _initMap() {
    const run = Save.getCurrentRun();
    if (!run) { Engine.showScreen('menu'); return; }

    // If run already has a map, reload it; otherwise generate
    if (run.mapData) {
      this._map = run.mapData;
      this._currentNodeId = run.currentNode || this._map.entry;
    } else {
      const gen = new MapGenerator(run.mapSeed || Date.now());
      this._map = gen.generate(run.zone || 1);
      this._currentNodeId = this._map.entry;

      run.mapData = this._map;
      run.currentNode = this._currentNodeId;
      Save.saveRunState(run);
    }

    // Mark current node as visited
    const currentNode = this._map.nodes.find(n => n.id === this._currentNodeId);
    if (currentNode) {
      currentNode.visited = true;
      currentNode.visible = true;
    }

    // Reveal forward neighbors
    this._revealForwardNodes(this._currentNodeId);
  }

  _build() {
    const run = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    if (!run || !char) return;

    const t = k => I18n.t(k) || k;
    const gold = run.gold || 0;
    const ether = run.etherPowder || 0;
    const hp = run.hp || 0;

    this.el.innerHTML = `
      <div class="map-header">
        <span class="map-title">${t('ui.map.title')}</span>
        <div class="map-resources">
          <div class="resource-chip resource-chip--life">
            <div class="resource-chip__dot"></div>
            <span>${hp}</span>
          </div>
          <div class="resource-chip resource-chip--gold">
            <div class="resource-chip__dot"></div>
            <span>${gold} ${t('misc.gold')}</span>
          </div>
          <div class="resource-chip resource-chip--ether">
            <div class="resource-chip__dot"></div>
            <span>${ether} ${t('misc.ether_powder')}</span>
          </div>
        </div>
      </div>

      <div class="map-viewport" id="map-viewport">
        <div class="map-canvas" id="map-canvas"></div>
      </div>

      <div class="map-footer">
        <span id="map-node-info" style="color:var(--color-text-dim); font-size:var(--text-sm);">
          ${t('ui.map.current_node')}: ${this._nodeLabel(this._currentNodeId)}
        </span>
      </div>
    `;

    this._renderGrid();

    // Centre et adapte la map à la taille du viewport
    const viewport = document.getElementById('map-viewport');
    if (viewport) {
      this._fitCanvas();
      this._resizeObserver = new ResizeObserver(() => this._fitCanvas());
      this._resizeObserver.observe(viewport);
    }
  }

  // ─── Hex grid constants ────────────────────────────────────────────────────
  // Pointy-top hexagons: vertex at top & bottom.
  // clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)
  // Row-offset layout (odd rows shifted right by W/2).
  //   cx = col * W  + (row % 2 === 1 ? W/2 : 0)
  //   cy = row * (H * 3/4)
  _hex() {
    const r = 30;                          // circumradius (px)
    const W = Math.round(r * Math.sqrt(3)); // ≈ 52 px  (flat-to-flat)
    const H = r * 2;                       // 60 px  (vertex-to-vertex)
    return { r, W, H,
      COL: W,                              // horizontal center-to-center
      ROW: Math.round(H * 0.75),           // vertical center-to-center ≈ 45 px
      CLIP: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
    };
  }

  _hexCenter(col, row) {
    const { W, H, ROW } = this._hex();
    return {
      x: col * W + (row % 2 === 1 ? W / 2 : 0) + W / 2,  // +W/2 : marge gauche = demi-hex
      y: row * ROW + H / 2,                                // +H/2 : marge haute = demi-hex
    };
  }

  // ─── Full hex-grid renderer ────────────────────────────────────────────────
  _renderGrid() {
    const canvas = document.getElementById('map-canvas');
    if (!canvas || !this._map) return;

    const { W, H, ROW, CLIP } = this._hex();
    const GRID_COLS = 12;    // match MapGenerator cols
    const GRID_ROWS = 7;

    const reachable = new Set(this._getReachableIds());

    // Build (col,row) → node lookup
    const byPos = {};
    for (const n of this._map.nodes) byPos[`${n.col},${n.row}`] = n;

    // SVG for edges (drawn first, underneath hexes)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
    canvas.appendChild(svg);

    // Draw ALL grid cells as touching hexagons
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const { x, y } = this._hexCenter(col, row);
        const node = byPos[`${col},${row}`];

        // Determine state
        const isCurrent   = node && node.id === this._currentNodeId;
        const isReachable = node && reachable.has(node.id);
        const isVisited   = node && node.visited;
        const isVisible   = node && (node.visible || node.visited);
        const isEmpty     = !node || node.hidden;
        const isHidden    = node && !node.hidden && !isVisible;

        // Colors
        let outerBg, innerBg, glow;
        if (isCurrent) {
          outerBg = '#c9a227'; innerBg = 'rgba(201,162,39,0.25)'; glow = '0 0 12px rgba(201,162,39,0.7)';
        } else if (isReachable) {
          outerBg = '#2d5a8b'; innerBg = 'rgba(45,90,139,0.25)'; glow = '0 0 8px rgba(45,90,139,0.5)';
        } else if (isVisited) {
          outerBg = '#3a3a58'; innerBg = '#1a1a2e'; glow = 'none';
        } else if (isVisible) {
          outerBg = '#2a2a42'; innerBg = '#12121e'; glow = 'none';
        } else if (isEmpty) {
          outerBg = '#1a1a28'; innerBg = '#0e0e1a'; glow = 'none';
        } else {
          // hidden node (fogged)
          outerBg = '#1e1e30'; innerBg = '#111120'; glow = 'none';
        }

        const cursor = isReachable ? 'pointer' : 'default';
        const opacity = (isEmpty || isHidden) ? 0.4 : 1;

        // Outer hex (border layer) — full W×H so clip-path edges touch perfectly
        const outer = document.createElement('div');
        outer.style.cssText = `
          position:absolute;
          left:${x}px; top:${y}px;
          width:${W}px; height:${H}px;
          clip-path:${CLIP};
          background:${outerBg};
          transform:translate(-50%,-50%);
          opacity:${opacity};
          box-shadow:${glow};
          cursor:${cursor};
          transition:filter .15s, transform .12s;
        `;

        // Inner hex (fill layer, BORDER px inset on each side)
        const BORDER = 3;
        const inner = document.createElement('div');
        inner.style.cssText = `
          position:absolute;
          left:${BORDER}px; top:${BORDER}px;
          width:${W - BORDER * 2}px; height:${H - BORDER * 2}px;
          clip-path:${CLIP};
          background:${innerBg};
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:1px; pointer-events:none;
          font-size:${isReachable || isCurrent ? '1.2rem' : '1rem'};
        `;

        if (node && isVisible) {
          const icon  = this._nodeIcon(node.type);
          const label = I18n.t(`ui.map.node_${node.type}`) || node.type;
          inner.innerHTML = `
            <span>${icon}</span>
            <span style="font-size:0.42rem;color:var(--color-text-dim);text-transform:uppercase;letter-spacing:.04em">${label}</span>
          `;
        } else if (!isEmpty) {
          inner.innerHTML = `<span style="font-size:.9rem;color:var(--color-text-muted)">?</span>`;
        }

        outer.appendChild(inner);

        // Events for reachable nodes
        if (isReachable) {
          outer.addEventListener('click',      () => this._moveToNode(node.id));
          outer.addEventListener('mouseenter', () => {
            outer.style.filter    = 'brightness(1.3)';
            outer.style.transform = 'translate(-50%,-50%) scale(1.10)';
          });
          outer.addEventListener('mouseleave', () => {
            outer.style.filter    = '';
            outer.style.transform = 'translate(-50%,-50%)';
          });
        }

        outer.dataset.nodeId = node ? node.id : '';
        canvas.appendChild(outer);
      }
    }

    // Draw edges over the hex cells
    for (const edge of this._map.edges) {
      const from = this._map.nodes.find(n => n.id === edge.from);
      const to   = this._map.nodes.find(n => n.id === edge.to);
      if (!from || !to) continue;
      if (!from.visible && !from.visited) continue;

      const a = this._hexCenter(from.col, from.row);
      const b = this._hexCenter(to.col, to.row);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const isGold = from.visited && to.visited;
      line.setAttribute('stroke', isGold ? 'rgba(201,162,39,0.5)' : 'rgba(255,255,255,0.12)');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }

    // Size canvas
    const maxCx = (GRID_COLS - 1) * this._hex().W + this._hex().W / 2 + this._hex().W;
    const maxCy = (GRID_ROWS - 1) * ROW + H;
    canvas.style.width    = `${maxCx}px`;
    canvas.style.height   = `${maxCy}px`;
    canvas.style.position = 'relative';
  }

  // Scale le canvas pour tenir dans le viewport avec une marge
  _fitCanvas() {
    const viewport = document.getElementById('map-viewport');
    const canvas   = document.getElementById('map-canvas');
    if (!viewport || !canvas) return;

    const MARGIN = 16; // px de marge de chaque côté
    const vw = viewport.clientWidth  - MARGIN * 2;
    const vh = viewport.clientHeight - MARGIN * 2;
    const cw = parseFloat(canvas.style.width);
    const ch = parseFloat(canvas.style.height);
    if (!cw || !ch) return;

    const scale = Math.min(vw / cw, vh / ch); // upscale autorisé
    canvas.style.transform = `scale(${scale})`;
  }

  _moveToNode(nodeId) {
    const node = this._map.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const run = Save.getCurrentRun();
    if (!run.visitedNodes) run.visitedNodes = [];

    // Mark previous node as visited
    const current = this._map.nodes.find(n => n.id === this._currentNodeId);
    if (current) current.visited = true;

    // Mark destination
    node.visited = true;
    node.visible = true;
    if (!run.visitedNodes.includes(nodeId)) run.visitedNodes.push(nodeId);

    this._currentNodeId = nodeId;
    run.currentNode = nodeId;
    run.mapData = this._map;
    Save.saveRunState(run);

    // Reveal only the direct neighbors of the new position
    this._revealForwardNodes(nodeId);

    this._enterNode(node);
  }

  _enterNode(node) {
    switch (node.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        Engine.showScreen('combat', { nodeType: node.type, node });
        break;
      case 'merchant':
        Engine.showScreen('merchant', { node });
        break;
      case 'forge':
        Engine.showScreen('forge', { node });
        break;
      case 'rest':
        Engine.showScreen('result', { type: 'rest', node });
        break;
      case 'event':
      case 'divine':
      case 'unknown':
        Engine.showScreen('result', { type: node.type, node });
        break;
      default:
        this.destroy();
        this.init();
    }
  }

  // Reveal only the direct forward neighbors of a node (next column only)
  _revealForwardNodes(fromId) {
    for (const id of this._getReachableIds(fromId)) {
      const n = this._map.nodes.find(x => x.id === id);
      if (n) n.visible = true;
    }
  }

  // Returns the IDs of nodes directly reachable in one step from fromId
  _getReachableIds(fromId = this._currentNodeId) {
    if (!this._map) return [];
    return this._map.edges
      .filter(e => e.from === fromId)
      .map(e => e.to)
      .filter(id => {
        const n = this._map.nodes.find(x => x.id === id);
        return n && !n.hidden;
      });
  }

  _nodeLabel(id) {
    if (!this._map) return '';
    const n = this._map.nodes.find(x => x.id === id);
    return n ? (I18n.t(`ui.map.node_${n.type}`) || n.type) : '';
  }

  _nodeIcon(type) {
    const icons = {
      start: '🚩', combat: '⚔', elite: '💀', boss: '👁',
      merchant: '💰', event: '✨', rest: '🔥',
      forge: '⚒', divine: '🌟', unknown: '?',
    };
    return icons[type] || '?';
  }
}

window.MapScreen = MapScreen;
})();
