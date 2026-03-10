// Combat screen — wires CombatState, HexGridRenderer, TimelineComponent, QTEOverlay.

(function () {
class CombatScreen {
  constructor(params = {}) {
    this.el      = document.getElementById('screen-combat');
    this._params = params;
    this._state  = null;   // CombatState instance
    this._hexGrid = null;  // HexGridRenderer
    this._timeline = null; // TimelineComponent
    this._qte    = null;   // QTEOverlay
    this._handEls = {};    // instanceId → card element
    this._listeners = [];  // { event, fn } for cleanup
    this._ended  = false;
  }

  init() {
    this._buildLayout();
    this._startCombat();
  }

  destroy() {
    this._listeners.forEach(({ event, fn }) => Engine.bus.off(event, fn));
    this._listeners = [];
    if (this._hexGrid) { this._hexGrid.destroy(); this._hexGrid = null; }
    if (this._timeline) { this._timeline.destroy(); this._timeline = null; }
    this.el.innerHTML = '';
    this._state = null;
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  _buildLayout() {
    const t = k => I18n.t(k) || k;
    this.el.innerHTML = `
      <div class="combat-hud" id="combat-hud">
        <div class="combatant-panel" id="panel-player"></div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          <div class="turn-indicator" id="turn-indicator">${t('ui.combat.your_turn')}</div>
          <div class="timeline" id="combat-timeline" style="
            display:flex; align-items:center; gap:4px;
            font-size:0.6rem; color:var(--color-text-muted);
          "></div>
        </div>
        <div class="combatant-panel" id="panel-enemies"></div>
      </div>

      <div class="combat-battlefield" id="combat-battlefield">
        <div id="hex-grid-container"></div>
      </div>

      <div class="combat-action-bar" id="combat-action-bar">
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 0 4px;">
          <div class="pile-counters">
            <div class="pile-counter" id="pile-deck" title="${t('ui.combat.deck')}">
              <div class="pile-counter__icon" id="deck-count">0</div>
              <div class="pile-counter__label">${t('ui.combat.deck')}</div>
            </div>
            <div class="pile-counter" id="pile-discard" title="${t('ui.combat.discard')}">
              <div class="pile-counter__icon" id="discard-count">0</div>
              <div class="pile-counter__label">${t('ui.combat.discard')}</div>
            </div>
          </div>
          <button class="btn-end-turn" id="btn-end-turn">${t('ui.combat.end_turn')}</button>
          <div style="width:80px;"></div>
        </div>
        <div class="hand-area" id="hand-area"></div>
      </div>
    `;

    this._timeline = new TimelineComponent(document.getElementById('combat-timeline'));
    this._timeline.mount();
    this._qte = new QTEOverlay();
  }

  // ─── Combat Init ──────────────────────────────────────────────────────────

  _startCombat() {
    const run = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    if (!run || !char) { Engine.showScreen('menu'); return; }

    // Build player combat data
    const arch = Engine.getArchetype(char.archetypeId) || {};
    const stats = char.baseStats || {};

    const playerData = {
      name: char.name,
      archetypeId: char.archetypeId,
      maxHp: run.hp || 60,
      maxMana: run.mana || 4,
      maxEndurance: run.endurance || 5,
      baseInitiative: stats.rapidite || 5,
      rapidite: stats.rapidite || 5,
      force: stats.force || 3,
      dexterite: stats.dexterite || 3,
      intelligence: stats.intelligence || 3,
      endurance: stats.endurance || 3,
      volonte: stats.volonte || 3,
      handSize: 5,
      enduranceRegen: 2,
      deckList: (run.deck && run.deck.length ? run.deck : (arch.startingCards || [])).concat(
        // Ensure new test cards are always available for testing
        ['charge_heroique', 'boule_de_feu', 'mur_de_glace', 'elevation_terrain', 'magic_shield']
          .filter(id => !(run.deck || arch.startingCards || []).includes(id))
      ),
      weapons: run.equippedWeapons || [null, null],
    };

    // Determine enemies based on node type
    const nodeType = (this._params && this._params.nodeType) || 'combat';
    const enemies = this._buildEnemies(nodeType);

    this._state = new CombatState(playerData, enemies, {});
    this._state.buildTimeline(8);

    this._initHexGrid();
    this._placeTokens();
    this._bindEvents();
    this._renderPlayerPanel();
    this._renderEnemyPanel();
    this._renderHand();
    this._updatePiles();

    // Start first turn
    const firstTurn = this._state.nextTurn();
    this._onTurnChange(firstTurn);
  }

  _buildEnemies(nodeType) {
    const pool = nodeType === 'boss'
      ? [Engine.getEnemy('garde_gobelin') || { id: 'boss', maxHp: 80, attackDamage: 8, armor: 4, rapidite: 3, stats: {} }]
      : nodeType === 'elite'
        ? [Engine.getEnemy('garde_gobelin') || { id: 'elite', maxHp: 45, attackDamage: 6, armor: 2, rapidite: 4, stats: {} }]
        : [Engine.getEnemy('gobelin') || { id: 'gobelin', maxHp: 18, attackDamage: 3, armor: 0, rapidite: 5, stats: {} }];

    return pool.map(def => ({
      ...def,
      maxHp: def.stats ? (def.stats.vie || def.maxHp || 20) : (def.maxHp || 20),
      attackDamage: def.stats ? (def.stats.force || def.attackDamage || 3) : (def.attackDamage || 3),
      armor: def.stats ? (def.stats.armor || 0) : (def.armor || 0),
      rapidite: def.stats ? (def.stats.rapidite || def.rapidite || 5) : (def.rapidite || 5),
    }));
  }

  // ─── Hex Grid ─────────────────────────────────────────────────────────────

  _initHexGrid() {
    const container = document.getElementById('hex-grid-container');
    if (!container) return;
    this._hexGrid = new HexGridRenderer(container, { cols: 10, rows: 6, size: 32 });
    this._hexGrid.build();
  }

  _placeTokens() {
    if (!this._hexGrid || !this._state) return;
    const p = this._state.player;
    this._hexGrid.addToken('player', p.pos.q, p.pos.r, { isPlayer: true, icon: '⚔' });
    this._hexGrid.updateTokenHP('player', p.hp, p.maxHp);

    for (const e of this._state.enemies) {
      const name = I18n.t(`enemy.${e.id.replace('enemy_', '')}.name`) || e.id;
      this._hexGrid.addToken(e.id, e.pos.q, e.pos.r, { isPlayer: false, icon: '☠' });
      this._hexGrid.updateTokenHP(e.id, e.hp, e.maxHp);
    }
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  _bindEvents() {
    const endBtn = document.getElementById('btn-end-turn');
    if (endBtn) endBtn.addEventListener('click', () => this._onEndTurn());

    const on = (event, fn) => {
      Engine.bus.on(event, fn);
      this._listeners.push({ event, fn });
    };

    on('combat:hand_updated',    ({ hand })     => this._renderHand(hand));
    on('combat:damage_dealt',    (data)         => this._onDamage(data));
    on('combat:unit_moved',      ({ unitId, to }) => {
      this._hexGrid && this._hexGrid.moveToken(unitId, to.q, to.r);
    });
    on('combat:unit_defeated',   ({ unitId })   => this._onDefeated(unitId));
    on('combat:player_turn_start', ()           => this._onPlayerTurn());
    on('combat:enemy_turn_start',  ({ unitId }) => this._onEnemyTurn(unitId));
    on('combat:ended',           ({ result })   => this._onCombatEnd(result));
    on('hexgrid:cell_click',     ({ q, r })     => this._onCellClick(q, r));
    on('hexgrid:drag_start',    ({ unitId })   => this._onDragStart(unitId));
    on('hexgrid:drag_hover',    ({ unitId, q, r }) => this._onDragHover(unitId, q, r));
    on('hexgrid:drag_end',      ({ unitId, q, r }) => this._onDragEnd(unitId, q, r));
  }

  // ─── Turn Logic ───────────────────────────────────────────────────────────

  _onTurnChange(turn) {
    if (!turn) return;
    const indicator = document.getElementById('turn-indicator');
    if (!indicator) return;
    const isPlayer = turn.unitId === 'player';
    const t = k => I18n.t(k) || k;
    indicator.textContent  = isPlayer ? t('ui.combat.your_turn') : t('ui.combat.enemy_turn');
    indicator.className    = 'turn-indicator' + (isPlayer ? '' : ' enemy-turn');

    const endBtn = document.getElementById('btn-end-turn');
    if (endBtn) endBtn.disabled = !isPlayer;
  }

  _onPlayerTurn() {
    this._onTurnChange({ unitId: 'player' });
    this._renderHand();
    this._updatePiles();
  }

  _onEnemyTurn(unitId) {
    this._onTurnChange({ unitId });
  }

  _onEndTurn() {
    if (!this._state || this._ended) return;
    const result = this._state.endTurn();
    if (result) this._onTurnChange(result);
    this._updatePiles();
    this._updateHPBars();
  }

  _onCellClick(q, r) {
    if (!this._state || this._ended) return;

    // Handle placement modes first (wall / terrain)
    if (this._placementMode) {
      this._handlePlacementClick(q, r);
      return;
    }

    const occupied = this._state.grid.occupied[`${q},${r}`];

    // Click on enemy → target selection
    if (occupied && occupied !== 'player') {
      Engine.bus.emit('combat:target_selected', { q, r, targetId: occupied });
      return;
    }

    // Click on empty cell → try to move player there (via BFS reachable check)
    if (!occupied && this._state.currentUnit === 'player') {
      const result = this._state.movePlayer({ q, r });
      if (result.success) {
        this._updateHPBars();
      }
    }
  }

  // ─── Player Drag Movement ──────────────────────────────────────────────

  _onDragStart(unitId) {
    if (unitId !== 'player' || !this._state || this._ended) return;
    if (this._state.currentUnit !== 'player') return;

    this._reachableMap = this._state.getReachableHexes();
    if (this._reachableMap.size === 0) return;

    this._hexGrid.highlightReachable(this._reachableMap, this._state.player.initiative);
  }

  _onDragHover(unitId, q, r) {
    if (unitId !== 'player' || !this._reachableMap) return;
    if (!this._hexGrid) return;

    const key = HexGrid.key(q, r);
    if (!this._reachableMap.has(key)) {
      this._hexGrid.clearPath();
      return;
    }

    // Build blocked set (all occupied except player)
    const blocked = new Set();
    for (const [k, v] of Object.entries(this._state.grid.occupied)) {
      if (v !== 'player') blocked.add(k);
    }
    // Also block impassable terrain
    for (const [k, t] of Object.entries(this._state.grid.terrain)) {
      if (t === 'wall' || t === 'void') blocked.add(k);
    }

    const path = HexGrid.findPath(
      this._state.player.pos, { q, r },
      blocked, this._state.grid.width, this._state.grid.height
    );
    if (path && path.length > 1) {
      this._hexGrid.highlightPath(path.slice(1)); // skip start position
    }
  }

  _onDragEnd(unitId, q, r) {
    if (unitId !== 'player' || !this._state || this._ended) return;

    const key = HexGrid.key(q, r);
    const canMove = this._reachableMap && this._reachableMap.has(key);

    // Clean up highlights
    if (this._hexGrid) {
      this._hexGrid.clearPath();
      this._hexGrid.clearAllHighlights();
    }
    this._reachableMap = null;

    if (canMove && this._state.currentUnit === 'player') {
      const result = this._state.movePlayer({ q, r });
      if (result.success) {
        this._updateHPBars(); // refresh initiative bar
      } else {
        // Snap token back
        const p = this._state.player;
        this._hexGrid.moveToken('player', p.pos.q, p.pos.r);
      }
    } else {
      // Snap token back to original position
      const p = this._state.player;
      if (this._hexGrid) this._hexGrid.moveToken('player', p.pos.q, p.pos.r);
    }
  }

  // ─── Damage / Defeat ─────────────────────────────────────────────────────

  _onDamage({ targetId, amount, remaining }) {
    if (!this._hexGrid) return;
    this._hexGrid.updateTokenHP(targetId, remaining, this._getMaxHp(targetId));
    this._showDamageFloat(targetId, amount);
    this._updateHPBars();
  }

  _onDefeated(unitId) {
    if (!this._hexGrid) return;
    setTimeout(() => this._hexGrid.removeToken(unitId), 400);
  }

  _getMaxHp(unitId) {
    if (!this._state) return 1;
    if (unitId === 'player') return this._state.player.maxHp;
    const e = this._state.enemies.find(x => x.id === unitId);
    return e ? e.maxHp : 1;
  }

  _showDamageFloat(unitId, amount) {
    const token = this._hexGrid && this._hexGrid._tokens[unitId];
    if (!token) return;
    const rect = token.getBoundingClientRect();
    const el = document.createElement('div');
    el.textContent = `-${amount}`;
    el.style.cssText = `
      position: fixed;
      left: ${rect.left + rect.width / 2}px;
      top:  ${rect.top}px;
      color: var(--color-danger-light);
      font-weight: 900; font-size: 1.1rem;
      pointer-events: none; z-index: 9999;
      animation: dmg-float 0.9s ease forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ─── Combat End ───────────────────────────────────────────────────────────

  _onCombatEnd(result) {
    if (this._ended) return;
    this._ended = true;

    const won = result === 'player_win';

    if (won) {
      // Compute loot
      let gold = 0, exp = 0;
      for (const e of this._state.enemies) {
        const def = Engine.getEnemy(e.id.replace('enemy_', ''));
        if (def && def.loot) {
          const [min, max] = def.loot.gold || [2, 6];
          gold += Math.floor(Math.random() * (max - min + 1)) + min;
          exp  += def.loot.exp || 10;
        }
      }
      // Update run gold
      const run = Save.getCurrentRun();
      if (run) { run.gold = (run.gold || 0) + gold; Save.saveRunState(run); }

      Engine.showScreen('result', { type: 'victory', gold, exp });
    } else {
      Save.endRun(false);
      Engine.showScreen('result', { type: 'defeat' });
    }
  }

  // ─── Hand / HUD ───────────────────────────────────────────────────────────

  _renderHand(hand) {
    const area = document.getElementById('hand-area');
    if (!area || !this._state) return;
    const cards = hand || this._state.player.hand;
    area.innerHTML = '';
    this._handEls = {};

    for (const c of cards) {
      const def = Engine.getCard(c.id) || { id: c.id, tags: [], cost: {} };
      const el = CardRenderer.createSmall(def);
      el.style.cursor = 'grab';
      el.title = I18n.t(`card.${c.id}.name`) || c.id;
      el.dataset.instanceId = c.instanceId;
      el.dataset.cardId = c.id;

      this._initCardDrag(el, c, def);
      area.appendChild(el);
      this._handEls[c.instanceId] = el;
    }
  }

  // ─── Card Drag & Drop ──────────────────────────────────────────────────

  _initCardDrag(el, cardInstance, cardDef) {
    let dragging = false;
    let ghost = null;
    let startX, startY;

    const onStart = (clientX, clientY) => {
      if (!this._state || this._ended) return;
      if (this._state.currentUnit !== 'player') return;
      dragging = true;
      startX = clientX;
      startY = clientY;

      // Create a small round cursor icon (like entity tokens)
      ghost = document.createElement('div');
      const icon = this._cardDragIcon(cardDef);
      const color = this._cardDragColor(cardDef);
      ghost.textContent = icon;
      ghost.style.cssText = `
        position: fixed;
        left: ${clientX - 18}px;
        top: ${clientY - 18}px;
        width: 36px; height: 36px;
        border-radius: 50%;
        border: 3px solid ${color};
        background: var(--color-panel, #1a1a2e);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 0 8px ${color};
        transition: none;
      `;
      document.body.appendChild(ghost);

      el.style.opacity = '0.3';
      this._dragCardDef = cardDef;
      this._dragCardInstance = cardInstance;
    };

    const onMove = (clientX, clientY) => {
      if (!dragging || !ghost) return;
      ghost.style.left = `${clientX - 18}px`;
      ghost.style.top  = `${clientY - 18}px`;

      // Update targeting highlight based on card forme
      this._updateCardTargeting(clientX, clientY, cardDef);
    };

    const onEnd = (clientX, clientY) => {
      if (!dragging) return;
      dragging = false;
      el.style.opacity = '';
      if (ghost) { ghost.remove(); ghost = null; }

      // Check if dropped over the hex grid
      if (this._hexGrid) {
        const rect = this._hexGrid.getContainerRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
          this._resolveCardDrop(clientX, clientY, cardInstance, cardDef, el);
        }
      }

      // Clean up targeting highlights
      if (this._hexGrid) this._hexGrid.clearCardTargeting();
      this._dragCardDef = null;
      this._dragCardInstance = null;
    };

    // Mouse
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      const moveHandler = (e2) => onMove(e2.clientX, e2.clientY);
      const upHandler = (e2) => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        onEnd(e2.clientX, e2.clientY);
      };
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    });

    // Touch
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      onEnd(t.clientX, t.clientY);
    });
  }

  /**
   * During drag: update visual targeting feedback based on card forme.
   */
  _updateCardTargeting(clientX, clientY, cardDef) {
    if (!this._hexGrid || !this._state) return;

    const hex = this._hexGrid.clientToHex(clientX, clientY);
    const forme = cardDef.forme || 'single';

    switch (forme) {
      case 'self':
        // Highlight the player's hex
        this._hexGrid.highlightTarget(this._state.player.pos.q, this._state.player.pos.r);
        break;

      case 'single': {
        // Find nearest entity to cursor position
        const nearest = this._findNearestUnit(hex);
        if (nearest) {
          this._hexGrid.highlightTarget(nearest.pos.q, nearest.pos.r);
        }
        break;
      }

      case 'zone': {
        // Highlight zone around cursor hex
        const radius = cardDef.zoneRadius || 1;
        const zone = HexGrid.spiral({ q: hex.q, r: hex.r }, radius);
        const valid = zone.filter(h =>
          HexGrid.inBounds(h.q, h.r, this._state.grid.width, this._state.grid.height)
        );
        // Find entities in the zone to highlight them
        const zoneKeys = new Set(valid.map(h => `${h.q},${h.r}`));
        const affected = [];
        if (zoneKeys.has(`${this._state.player.pos.q},${this._state.player.pos.r}`)) {
          affected.push('player');
        }
        for (const e of this._state.enemies) {
          if (e.hp <= 0) continue;
          if (zoneKeys.has(`${e.pos.q},${e.pos.r}`)) {
            affected.push(e.id);
          }
        }
        this._hexGrid.highlightZone(valid, affected);
        break;
      }

      case 'wall':
      case 'terrain_place':
        // During drag, just highlight the hex under cursor
        if (HexGrid.inBounds(hex.q, hex.r, this._state.grid.width, this._state.grid.height)) {
          this._hexGrid.highlightPlacement([hex]);
        }
        break;

      default:
        // Treat like single target
        const near = this._findNearestUnit(hex);
        if (near) {
          this._hexGrid.highlightTarget(near.pos.q, near.pos.r);
        }
        break;
    }
  }

  /**
   * Find the nearest unit (player, enemy, or ally) to a hex position.
   */
  _findNearestUnit(hex) {
    if (!this._state) return null;
    let best = null;
    let bestDist = Infinity;

    // Check player
    const pDist = HexGrid.distance(hex, this._state.player.pos);
    if (pDist < bestDist) {
      bestDist = pDist;
      best = this._state.player;
    }

    // Check enemies
    for (const e of this._state.enemies) {
      if (e.hp <= 0) continue;
      const d = HexGrid.distance(hex, e.pos);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }

    return best;
  }

  /**
   * Resolve what happens when a card is dropped on the grid.
   */
  _resolveCardDrop(clientX, clientY, cardInstance, cardDef, cardEl) {
    const hex = this._hexGrid.clientToHex(clientX, clientY);
    const forme = cardDef.forme || 'single';

    switch (forme) {
      case 'self':
        this._executeCard(cardInstance, cardDef, this._state.player.pos, cardEl);
        break;

      case 'single': {
        const nearest = this._findNearestUnit(hex);
        if (nearest) {
          this._executeCard(cardInstance, cardDef, nearest.pos, cardEl);
        }
        break;
      }

      case 'zone': {
        // AoE: apply to all units in the zone
        const radius = cardDef.zoneRadius || 1;
        const zone = HexGrid.spiral({ q: hex.q, r: hex.r }, radius);
        this._executeCardZone(cardInstance, cardDef, zone, cardEl);
        break;
      }

      case 'wall':
        // Enter wall placement mode (two-step)
        if (HexGrid.inBounds(hex.q, hex.r, this._state.grid.width, this._state.grid.height)) {
          this._startWallPlacement(cardInstance, cardDef, hex, cardEl);
        }
        break;

      case 'terrain_place':
        // Enter terrain placement mode (multi-step)
        if (HexGrid.inBounds(hex.q, hex.r, this._state.grid.width, this._state.grid.height)) {
          this._startTerrainPlacement(cardInstance, cardDef, hex, cardEl);
        }
        break;

      default: {
        const near = this._findNearestUnit(hex);
        if (near) {
          this._executeCard(cardInstance, cardDef, near.pos, cardEl);
        }
        break;
      }
    }
  }

  /**
   * Execute a card on a single target position.
   */
  _executeCard(cardInstance, cardDef, targetPos, cardEl) {
    const result = this._state.applyCard(cardInstance.id, 'player', targetPos, cardInstance.instanceId);
    if (result.success) {
      const px = this._hexGrid._toPixel(targetPos.q, targetPos.r);
      const rect = this._hexGrid.getContainerRect();
      CardRenderer.animatePlay(cardEl,
        { x: rect.left + px.x, y: rect.top + px.y }, () => {});
      this._updateHPBars();
      this._renderPlayerPanel();
      this._updatePiles();
    }
  }

  /**
   * Execute a zone AoE card — apply effects to all units in the zone.
   */
  _executeCardZone(cardInstance, cardDef, zoneHexes, cardEl) {
    // First apply the card cost once (use player pos as anchor)
    const zoneKeys = new Set(zoneHexes.map(h => `${h.q},${h.r}`));
    const targets = [];

    // Find all units in the zone
    if (zoneKeys.has(`${this._state.player.pos.q},${this._state.player.pos.r}`)) {
      targets.push(this._state.player.pos);
    }
    for (const e of this._state.enemies) {
      if (e.hp <= 0) continue;
      if (zoneKeys.has(`${e.pos.q},${e.pos.r}`)) {
        targets.push(e.pos);
      }
    }

    // Apply card to the first target to deduct cost, then apply effects to the rest
    if (targets.length > 0) {
      const result = this._state.applyCard(cardInstance.id, 'player', targets[0], cardInstance.instanceId);
      if (result.success) {
        // Apply effects to remaining targets
        for (let i = 1; i < targets.length; i++) {
          this._state._executeCardEffects(cardDef, 'player', targets[i]);
        }
        const center = zoneHexes[0] || targets[0];
        const px = this._hexGrid._toPixel(center.q, center.r);
        const rect = this._hexGrid.getContainerRect();
        CardRenderer.animatePlay(cardEl,
          { x: rect.left + px.x, y: rect.top + px.y }, () => {});
        this._updateHPBars();
        this._renderPlayerPanel();
        this._updatePiles();
      }
    }
  }

  // ─── Wall Placement Mode ───────────────────────────────────────────────

  _startWallPlacement(cardInstance, cardDef, startHex, cardEl) {
    this._placementMode = {
      type: 'wall',
      cardInstance,
      cardDef,
      cardEl,
      startHex,
      wallLength: cardDef.wallLength || 3,
    };

    // Highlight the start hex as confirmed
    this._hexGrid.highlightPlaced([startHex]);

    // Highlight all valid endpoints (within wallLength distance)
    const maxLen = cardDef.wallLength || 3;
    const validEnds = [];
    for (const [key, el] of Object.entries(this._hexGrid._cells)) {
      const [q, r] = key.split(',').map(Number);
      const dist = HexGrid.distance(startHex, { q, r });
      if (dist > 0 && dist <= maxLen) {
        validEnds.push({ q, r });
      }
    }
    this._placementMode.validEnds = new Set(validEnds.map(h => `${h.q},${h.r}`));
    this._hexGrid.highlightPlacement(validEnds, 'rgba(100,180,255,0.20)');
    this._hexGrid.highlightPlaced([startHex]);
  }

  // ─── Terrain Placement Mode ────────────────────────────────────────────

  _startTerrainPlacement(cardInstance, cardDef, startHex, cardEl) {
    this._placementMode = {
      type: 'terrain',
      cardInstance,
      cardDef,
      cardEl,
      placed: [startHex],
      maxHexes: cardDef.maxHexes || 3,
    };

    this._hexGrid.highlightPlaced([startHex]);
    this._showAdjacentPlaceable();
  }

  _showAdjacentPlaceable() {
    if (!this._placementMode || this._placementMode.type !== 'terrain') return;
    const placed = this._placementMode.placed;
    const placedKeys = new Set(placed.map(h => `${h.q},${h.r}`));
    const adjacent = [];

    for (const hex of placed) {
      for (const nb of HexGrid.neighbors(hex.q, hex.r)) {
        const key = `${nb.q},${nb.r}`;
        if (placedKeys.has(key)) continue;
        if (!HexGrid.inBounds(nb.q, nb.r, this._state.grid.width, this._state.grid.height)) continue;
        if (this._state.grid.occupied[key]) continue;
        const terrain = this._state.grid.terrain[key];
        if (terrain === 'wall' || terrain === 'void') continue;
        if (!adjacent.some(h => h.q === nb.q && h.r === nb.r)) {
          adjacent.push(nb);
        }
      }
    }

    this._placementMode.validNext = new Set(adjacent.map(h => `${h.q},${h.r}`));
    this._hexGrid.clearCardTargeting();
    this._hexGrid.highlightPlacement(adjacent, 'rgba(100,180,255,0.20)');
    this._hexGrid.highlightPlaced(placed);
  }

  /**
   * Handle cell clicks during placement modes (wall/terrain).
   */
  _handlePlacementClick(q, r) {
    if (!this._placementMode) return false;
    const key = `${q},${r}`;

    if (this._placementMode.type === 'wall') {
      if (!this._placementMode.validEnds.has(key)) return true; // consumed but invalid

      // Build wall line from start to this hex
      const start = this._placementMode.startHex;
      const end = { q, r };
      const wallHexes = this._getLineHexes(start, end);

      // Apply terrain effect
      for (const h of wallHexes) {
        const hk = `${h.q},${h.r}`;
        this._state.grid.terrain[hk] = 'wall';
      }

      // Deduct card cost
      const result = this._state.applyCard(
        this._placementMode.cardInstance.id, 'player', start, this._placementMode.cardInstance.instanceId);

      const px = this._hexGrid._toPixel(start.q, start.r);
      const rect = this._hexGrid.getContainerRect();
      CardRenderer.animatePlay(this._placementMode.cardEl,
        { x: rect.left + px.x, y: rect.top + px.y }, () => {});

      this._hexGrid.clearCardTargeting();
      this._placementMode = null;
      this._updateHPBars();
      this._renderPlayerPanel();
      this._updatePiles();
      return true;
    }

    if (this._placementMode.type === 'terrain') {
      if (!this._placementMode.validNext || !this._placementMode.validNext.has(key)) return true;

      this._placementMode.placed.push({ q, r });

      // Apply terrain to this hex
      this._state.grid.terrain[key] = 'wall';

      if (this._placementMode.placed.length >= this._placementMode.maxHexes) {
        // All hexes placed — finalize
        const result = this._state.applyCard(
          this._placementMode.cardInstance.id, 'player',
          this._placementMode.placed[0], this._placementMode.cardInstance.instanceId);

        const first = this._placementMode.placed[0];
        const px = this._hexGrid._toPixel(first.q, first.r);
        const rect = this._hexGrid.getContainerRect();
        CardRenderer.animatePlay(this._placementMode.cardEl,
          { x: rect.left + px.x, y: rect.top + px.y }, () => {});

        this._hexGrid.clearCardTargeting();
        this._placementMode = null;
        this._updateHPBars();
        this._renderPlayerPanel();
        this._updatePiles();
      } else {
        // Show next adjacent options
        this._showAdjacentPlaceable();
      }
      return true;
    }

    return false;
  }

  _cardDragIcon(cardDef) {
    const tags = cardDef.tags || [];
    if (tags.includes('Attaque'))  return '\u2694'; // ⚔
    if (tags.includes('Défense') || tags.includes('Defense')) return '\uD83D\uDEE1'; // 🛡
    if (tags.includes('Soin'))     return '\u2764'; // ❤
    if (tags.includes('Magie'))    return '\u2728'; // ✨
    if (tags.includes('Skill'))    return '\u26A1'; // ⚡
    return '\u25C6'; // ◆
  }

  _cardDragColor(cardDef) {
    const tags = cardDef.tags || [];
    if (tags.includes('Attaque'))  return '#e74c3c';
    if (tags.includes('Défense') || tags.includes('Defense')) return '#3498db';
    if (tags.includes('Soin'))     return '#2ecc71';
    if (tags.includes('Magie'))    return '#9b59b6';
    if (tags.includes('Skill'))    return '#f39c12';
    return '#95a5a6';
  }

  _getLineHexes(from, to) {
    const dist = HexGrid.distance(from, to);
    if (dist === 0) return [from];
    const hexes = [];
    for (let i = 0; i <= dist; i++) {
      const t = i / dist;
      const q = from.q + (to.q - from.q) * t;
      const r = from.r + (to.r - from.r) * t;
      hexes.push(HexGrid.round(q, r));
    }
    return hexes;
  }

  _updatePiles() {
    if (!this._state) return;
    const deckEl    = document.getElementById('deck-count');
    const discardEl = document.getElementById('discard-count');
    if (deckEl)    deckEl.textContent    = this._state.player.deck.length;
    if (discardEl) discardEl.textContent = this._state.player.discard.length;
  }

  _renderPlayerPanel() {
    const panel = document.getElementById('panel-player');
    if (!panel || !this._state) return;
    const p = this._state.player;
    panel.innerHTML = this._buildCombatantPanel(p.name || 'Joueur', p.hp, p.maxHp, p.mana, p.maxMana, p.endurance, p.maxEndurance, p.initiative, p.baseInitiative);
  }

  _renderEnemyPanel() {
    const panel = document.getElementById('panel-enemies');
    if (!panel || !this._state) return;
    panel.innerHTML = '';
    for (const e of this._state.enemies) {
      const name = I18n.t(`enemy.${e.id.replace('enemy_', '')}.name`) || e.id;
      const sub = document.createElement('div');
      sub.dataset.unitId = e.id;
      sub.innerHTML = this._buildCombatantPanel(name, e.hp, e.maxHp, null, null, null, null);
      panel.appendChild(sub);
    }
  }

  _buildCombatantPanel(name, hp, maxHp, mana, maxMana, end, maxEnd, init, maxInit) {
    const hpPct  = maxHp  ? Math.max(0, hp  / maxHp  * 100) : 0;
    const manaPct = maxMana ? Math.max(0, mana / maxMana * 100) : 0;
    const endPct  = maxEnd  ? Math.max(0, end  / maxEnd  * 100) : 0;
    const initPct = maxInit ? Math.max(0, init / maxInit * 100) : 0;
    const t = k => I18n.t(k) || k;

    return `
      <div class="combatant-info">
        <div class="combatant-name">${name}</div>
        <div class="stat-bars">
          <div class="stat-bar-row">
            <span class="stat-bar-label" title="${t('ui.combat.life')}">♥</span>
            <div class="stat-bar-track"><div class="stat-bar-fill stat-bar-fill--life" style="width:${hpPct}%"></div></div>
            <span class="stat-bar-value">${hp}/${maxHp}</span>
          </div>
          ${mana != null ? `
          <div class="stat-bar-row">
            <span class="stat-bar-label" title="${t('ui.combat.mana')}">✦</span>
            <div class="stat-bar-track"><div class="stat-bar-fill stat-bar-fill--mana" style="width:${manaPct}%"></div></div>
            <span class="stat-bar-value">${mana}/${maxMana}</span>
          </div>` : ''}
          ${end != null ? `
          <div class="stat-bar-row">
            <span class="stat-bar-label" title="${t('ui.combat.endurance')}">⚡</span>
            <div class="stat-bar-track"><div class="stat-bar-fill stat-bar-fill--endurance" style="width:${endPct}%"></div></div>
            <span class="stat-bar-value">${end}/${maxEnd}</span>
          </div>` : ''}
          ${init != null ? `
          <div class="stat-bar-row">
            <span class="stat-bar-label" title="${t('ui.combat.initiative')}">⏱</span>
            <div class="stat-bar-track"><div class="stat-bar-fill stat-bar-fill--initiative" style="width:${initPct}%"></div></div>
            <span class="stat-bar-value">${init}/${maxInit}</span>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  _updateHPBars() {
    if (!this._state) return;
    const p = this._state.player;
    const panelP = document.getElementById('panel-player');
    if (panelP) panelP.innerHTML = this._buildCombatantPanel(p.name || 'Joueur', p.hp, p.maxHp, p.mana, p.maxMana, p.endurance, p.maxEndurance, p.initiative, p.baseInitiative);

    for (const e of this._state.enemies) {
      const sub = document.querySelector(`[data-unit-id="${e.id}"]`);
      const name = I18n.t(`enemy.${e.id.replace('enemy_', '')}.name`) || e.id;
      if (sub) sub.innerHTML = this._buildCombatantPanel(name, e.hp, e.maxHp, null, null, null, null);
    }
  }
}

window.CombatScreen = CombatScreen;
})();
