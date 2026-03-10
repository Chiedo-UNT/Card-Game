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
      deckList: run.deck && run.deck.length ? run.deck : (arch.startingCards || []),
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
      el.style.cursor = 'pointer';
      el.title = I18n.t(`card.${c.id}.name`) || c.id;

      el.addEventListener('click', () => this._playCard(c, el));
      area.appendChild(el);
      this._handEls[c.instanceId] = el;
    }
  }

  _playCard(cardInstance, el) {
    if (!this._state || this._ended) return;
    if (this._state.currentUnit !== 'player') return;

    // For simplicity: play card targeting the first living enemy cell
    const enemy = this._state.enemies.find(e => e.hp > 0);
    const targetPos = enemy ? enemy.pos : null;

    const result = this._state.applyCard(cardInstance.id, 'player', targetPos);
    if (result.success) {
      CardRenderer.animatePlay(el, targetPos
        ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }, () => {});
    }
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
