// Combat Engine - state-based, emits events via Engine.bus
// Manages hex grid 10×6, initiative timeline, status effects, card play, enemy AI

(function () {
class CombatState {
  constructor(playerData, enemies, gridConfig) {
    // Player state
    this.player = {
      id: 'player',
      ...playerData,
      pos: { q: 0, r: 2 },
      hp: playerData.maxHp,
      mana: playerData.maxMana,
      endurance: playerData.maxEndurance,
      initiative: playerData.baseInitiative,
      statuses: {},
      hand: [],
      deck: [],
      discard: [],
      lost: [],
      concentrationSlot: null,
      preparationSlot: null,
      activeWeapon: 0,
      weapons: playerData.weapons ? [...playerData.weapons] : [null, null],
      activeTags: new Set(),
    };

    // Rebuild active tags from initial weapon
    this._rebuildActiveTags();

    // Enemies array
    this.enemies = enemies.map((e, i) => ({
      id: `enemy_${i}`,
      ...e,
      pos: { q: 9, r: Math.min(i, 5) },
      hp: e.maxHp,
      statuses: {},
      currentPattern: 0,
      nextAction: null,
    }));

    // Grid: 10×6, flat-top hex
    this.grid = {
      width: 10,
      height: 6,
      terrain: {},
      occupied: {},
    };

    // Apply grid config if supplied
    if (gridConfig && gridConfig.terrain) {
      this.grid.terrain = { ...gridConfig.terrain };
    }

    // Initialise occupied map
    this.grid.occupied[`${this.player.pos.q},${this.player.pos.r}`] = 'player';
    for (const enemy of this.enemies) {
      const key = `${enemy.pos.q},${enemy.pos.r}`;
      this.grid.occupied[key] = enemy.id;
    }

    // Timeline
    this.timeline = [];
    this.currentTick = 0;
    this.currentUnit = null;

    // Combat log
    this.log = [];

    // Shuffle and deal starting hand
    this._initDeck();
  }

  // ─── Deck Management ──────────────────────────────────────────────────────

  _initDeck() {
    const cards = (this.player.deckList || []).map(id => ({ id, instanceId: `${id}_${Math.random().toString(36).slice(2)}` }));
    this.player.deck = this._shuffle(cards);
    this.drawCards(this.player.handSize || 5);
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  drawCards(count) {
    for (let i = 0; i < count; i++) {
      if (this.player.deck.length === 0) {
        if (this.player.discard.length === 0) break;
        this.player.deck = this._shuffle(this.player.discard);
        this.player.discard = [];
        Engine.bus.emit('combat:deck_reshuffled', {});
      }
      const card = this.player.deck.shift();
      this.player.hand.push(card);
    }
    Engine.bus.emit('combat:hand_updated', { hand: [...this.player.hand] });
  }

  // ─── Timeline ─────────────────────────────────────────────────────────────

  buildTimeline(lookahead = 6) {
    this.timeline = [];

    const units = [this.player, ...this.enemies];
    for (const unit of units) {
      const rapidite = unit.rapidite || unit.stats?.rapidite || 5;
      const interval = Math.max(1, 20 - rapidite);
      // Generate lookahead upcoming ticks for this unit
      let tick = interval;
      // Find first tick at or after currentTick
      if (tick <= this.currentTick) {
        const multiples = Math.ceil(this.currentTick / interval);
        tick = multiples * interval;
      }
      for (let n = 0; n < lookahead; n++) {
        this.timeline.push({ tick: tick + n * interval, unitId: unit.id, interval });
      }
    }

    // Sort ascending by tick, then player before enemies on ties
    this.timeline.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      if (a.unitId === 'player') return -1;
      if (b.unitId === 'player') return 1;
      return a.unitId.localeCompare(b.unitId);
    });

    Engine.bus.emit('combat:timeline_updated', { timeline: [...this.timeline] });
  }

  nextTurn() {
    // Ensure timeline has entries
    if (this.timeline.length === 0) this.buildTimeline(6);

    const entry = this.timeline.shift();
    if (!entry) return null;

    this.currentTick = entry.tick;
    this.currentUnit = entry.unitId;

    // Rebuild timeline when it gets short
    if (this.timeline.length < 3) this.buildTimeline(6);

    // Tick statuses for the active unit
    this.tickStatuses(this.currentUnit);

    // Check if unit is stunned (assomme) — skip turn
    const unit = this._getUnit(this.currentUnit);
    if (unit && unit.statuses.assomme && unit.statuses.assomme.stacks > 0) {
      unit.statuses.assomme.stacks -= 1;
      if (unit.statuses.assomme.stacks <= 0) {
        delete unit.statuses.assomme;
      }
      this._log(`${this.currentUnit} is stunned and loses their turn.`);
      Engine.bus.emit('combat:turn_skipped', { unitId: this.currentUnit, tick: this.currentTick });
      // Add assomme immunity
      const resilience = unit.resilience || unit.stats?.resilience || 2;
      this.applyStatus(this.currentUnit, 'assomme_immune', 1, resilience);
      // Auto-advance if not the player's turn
      if (this.currentUnit !== 'player') return this.nextTurn();
      return { unitId: this.currentUnit, tick: this.currentTick, skipped: true };
    }

    // Reset player initiative for the turn
    if (this.currentUnit === 'player') {
      this.player.initiative = this.player.baseInitiative;
      Engine.bus.emit('combat:player_turn_start', { tick: this.currentTick });
    } else {
      // Enemy turn — calculate and execute action, then auto-advance
      this.calculateEnemyAction(this.currentUnit);
      Engine.bus.emit('combat:enemy_turn_start', { unitId: this.currentUnit, tick: this.currentTick });
      this.executeEnemyAction(this.currentUnit);

      // Check if combat ended after enemy action
      const combatEnd = this.checkCombatEnd();
      if (combatEnd) {
        Engine.bus.emit('combat:ended', { result: combatEnd });
        return { unitId: this.currentUnit, tick: this.currentTick, skipped: false };
      }

      // Auto-advance to next turn after enemy finishes
      return this.nextTurn();
    }

    return { unitId: this.currentUnit, tick: this.currentTick, skipped: false };
  }

  // ─── Card System ──────────────────────────────────────────────────────────

  applyCard(cardId, sourceId, targetPos, instanceId) {
    const cardDef = Engine.getCard(cardId);
    if (!cardDef) {
      this._log(`Card ${cardId} not found.`);
      return { success: false, reason: 'card_not_found' };
    }

    const source = this._getUnit(sourceId);
    if (!source) return { success: false, reason: 'source_not_found' };

    // Check if in berserk — can only play [Attaque] tagged cards
    if (source.statuses.berserk && source.statuses.berserk.stacks > 0) {
      if (!cardDef.tags || !cardDef.tags.includes('Attaque')) {
        return { success: false, reason: 'berserk_restriction' };
      }
    }

    // Check costs (support both flat props and nested cost object)
    const cost = cardDef.cost || {};
    const manaCost = cardDef.manaCost || cost.mana || 0;
    const enduranceCost = cardDef.enduranceCost || cost.endurance || 0;
    const initiativeCost = cardDef.initiativeCost != null ? cardDef.initiativeCost : (cost.initiative != null ? cost.initiative : 1);

    if (source.mana < manaCost) return { success: false, reason: 'insufficient_mana' };
    if (source.endurance < enduranceCost) return { success: false, reason: 'insufficient_endurance' };
    if (sourceId === 'player' && source.initiative < initiativeCost) {
      return { success: false, reason: 'insufficient_initiative' };
    }

    // Deduct costs
    source.mana -= manaCost;
    source.endurance -= enduranceCost;
    if (sourceId === 'player') source.initiative -= initiativeCost;

    // Check for echo status — execute effect twice
    const echoActive = source.statuses.echo && source.statuses.echo.stacks > 0;
    if (echoActive) {
      source.statuses.echo.stacks -= 1;
      if (source.statuses.echo.stacks <= 0) delete source.statuses.echo;
    }

    const result = this._executeCardEffects(cardDef, sourceId, targetPos);

    if (echoActive) {
      this._log(`Echo: ${cardDef.name} activates twice!`);
      this._executeCardEffects(cardDef, sourceId, targetPos);
    }

    // Move card to discard (or lost if it has the lost tag)
    const handIdx = instanceId
      ? source.hand.findIndex(c => c.instanceId === instanceId)
      : source.hand.findIndex(c => c.id === cardId);
    if (handIdx !== -1) {
      const [card] = source.hand.splice(handIdx, 1);
      if (cardDef.tags && cardDef.tags.includes('Perdu')) {
        source.lost.push(card);
      } else {
        source.discard.push(card);
      }
    }

    Engine.bus.emit('combat:card_played', { cardId, sourceId, targetPos, result });
    Engine.bus.emit('combat:hand_updated', { hand: [...source.hand] });

    const combatEnd = this.checkCombatEnd();
    if (combatEnd) Engine.bus.emit('combat:ended', { result: combatEnd });

    return { success: true, result };
  }

  _executeCardEffects(cardDef, sourceId, targetPos) {
    const results = [];
    const effects = cardDef.effects || [];

    for (const effect of effects) {
      const r = this._applyEffect(effect, sourceId, targetPos, cardDef);
      results.push(r);
    }
    return results;
  }

  _applyEffect(effect, sourceId, targetPos, cardDef) {
    const source = this._getUnit(sourceId);
    const targetId = targetPos ? this.grid.occupied[`${targetPos.q},${targetPos.r}`] : null;
    const target = targetId ? this._getUnit(targetId) : null;

    // Check for reflexion on target
    if (target && target.statuses.reflexion && target.statuses.reflexion.stacks > 0) {
      target.statuses.reflexion.stacks -= 1;
      if (target.statuses.reflexion.stacks <= 0) delete target.statuses.reflexion;
      // Reflect effect back at source
      this._log(`Reflexion: effect reflected back to ${sourceId}!`);
      return this._applyEffect(effect, targetId, { q: source.pos.q, r: source.pos.r }, cardDef);
    }

    switch (effect.type) {
      case 'damage': {
        if (!target) return { type: 'damage', success: false, reason: 'no_target' };
        // Check invisible
        if (target.statuses.invisible && target.statuses.invisible.stacks > 0) {
          return { type: 'damage', success: false, reason: 'target_invisible' };
        }
        let amount = effect.amount || 0;
        const tags = cardDef.tags || [];
        amount += this.getDamageBonus(tags, source);

        // puissance bonus
        if (source.statuses.puissance && source.statuses.puissance.stacks > 0) {
          amount += source.statuses.puissance.stacks;
          source.statuses.puissance.stacks -= 1;
          if (source.statuses.puissance.stacks <= 0) delete source.statuses.puissance;
        }
        // faiblesse penalty
        if (source.statuses.faiblesse && source.statuses.faiblesse.stacks > 0) {
          amount -= source.statuses.faiblesse.stacks;
          source.statuses.faiblesse.stacks -= 1;
          if (source.statuses.faiblesse.stacks <= 0) delete source.statuses.faiblesse;
        }
        // berserk bonus
        if (source.statuses.berserk && source.statuses.berserk.stacks > 0) {
          amount += 2;
        }

        amount = Math.max(0, amount);
        const dmgResult = this.applyDamage(targetId, amount, effect.damageType || 'physical');
        return { type: 'damage', targetId, amount: dmgResult.dealt, blocked: dmgResult.blocked };
      }

      case 'heal': {
        const healTarget = targetId || sourceId;
        const healUnit = this._getUnit(healTarget);
        if (!healUnit) return { type: 'heal', success: false };
        const amount = Math.min(effect.amount || 0, healUnit.maxHp - healUnit.hp);
        healUnit.hp += amount;
        this._log(`${healTarget} healed for ${amount} HP.`);
        Engine.bus.emit('combat:healed', { targetId: healTarget, amount });
        return { type: 'heal', targetId: healTarget, amount };
      }

      case 'status': {
        const statusTarget = targetId || sourceId;
        this.applyStatus(statusTarget, effect.statusId, effect.stacks || 1, effect.duration || 3);
        return { type: 'status', targetId: statusTarget, statusId: effect.statusId };
      }

      case 'move': {
        if (!targetPos) return { type: 'move', success: false };
        const moveResult = this.moveUnit(sourceId, targetPos);
        return { type: 'move', ...moveResult };
      }

      case 'push': {
        if (!target || !targetPos) return { type: 'push', success: false };
        const pushDir = this._direction(source.pos, target.pos);
        const newPos = { q: target.pos.q + pushDir.q, r: target.pos.r + pushDir.r };
        if (this._isValidPos(newPos) && !this.grid.occupied[`${newPos.q},${newPos.r}`]) {
          this.moveUnit(targetId, newPos);
          return { type: 'push', targetId, newPos };
        }
        // Blocked push — deal terrain damage
        this.applyDamage(targetId, effect.collisionDamage || 1, 'physical');
        return { type: 'push', targetId, blocked: true };
      }

      case 'draw': {
        this.drawCards(effect.count || 1);
        return { type: 'draw', count: effect.count || 1 };
      }

      case 'shield': {
        const shieldTarget = targetId || sourceId;
        this.applyStatus(shieldTarget, 'bouclier', effect.amount || 3, 999);
        return { type: 'shield', targetId: shieldTarget, amount: effect.amount || 3 };
      }

      case 'discard_hand': {
        const discarded = [...source.hand];
        source.discard.push(...source.hand);
        source.hand = [];
        Engine.bus.emit('combat:hand_updated', { hand: [] });
        return { type: 'discard_hand', count: discarded.length };
      }

      case 'restore_mana': {
        const amt = Math.min(effect.amount || 1, source.maxMana - source.mana);
        source.mana += amt;
        Engine.bus.emit('combat:resource_updated', { unitId: sourceId });
        return { type: 'restore_mana', amount: amt };
      }

      default:
        this._log(`Unknown effect type: ${effect.type}`);
        return { type: effect.type, success: false, reason: 'unknown_effect' };
    }
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  /**
   * BFS: returns a Map of "q,r" → cost for all hexes the player can reach
   * given their current initiative. Each step costs 1 initiative.
   */
  getReachableHexes() {
    const p = this.player;
    const maxCost = p.initiative;
    if (maxCost <= 0) return new Map();

    const startKey = HexGrid.key(p.pos.q, p.pos.r);
    const costs = new Map();  // "q,r" → movement cost
    costs.set(startKey, 0);

    const queue = [{ q: p.pos.q, r: p.pos.r, cost: 0 }];

    while (queue.length > 0) {
      const cur = queue.shift();
      const nextCost = cur.cost + 1;
      if (nextCost > maxCost) continue;

      for (const nb of HexGrid.neighbors(cur.q, cur.r)) {
        const key = HexGrid.key(nb.q, nb.r);
        if (costs.has(key)) continue;
        if (!HexGrid.inBounds(nb.q, nb.r, this.grid.width, this.grid.height)) continue;

        const terrain = this.grid.terrain[key];
        if (terrain === 'wall' || terrain === 'void') continue;

        if (this.grid.occupied[key]) continue;

        costs.set(key, nextCost);
        queue.push({ q: nb.q, r: nb.r, cost: nextCost });
      }
    }

    // Remove starting position — player is already there
    costs.delete(startKey);
    return costs;
  }

  /**
   * Move the player to targetPos, deducting the BFS-computed initiative cost.
   * Returns { success, cost } or { success: false, reason }.
   */
  movePlayer(targetPos) {
    if (this.currentUnit !== 'player') return { success: false, reason: 'not_player_turn' };

    const reachable = this.getReachableHexes();
    const key = HexGrid.key(targetPos.q, targetPos.r);
    if (!reachable.has(key)) return { success: false, reason: 'out_of_reach' };

    const cost = reachable.get(key);
    this.player.initiative -= cost;

    const result = this.moveUnit('player', targetPos);
    if (!result.success) {
      this.player.initiative += cost; // rollback
      return result;
    }
    return { success: true, cost };
  }

  moveUnit(unitId, targetPos) {
    const unit = this._getUnit(unitId);
    if (!unit) return { success: false, reason: 'unit_not_found' };

    if (!this._isValidPos(targetPos)) return { success: false, reason: 'out_of_bounds' };

    const targetKey = `${targetPos.q},${targetPos.r}`;
    if (this.grid.occupied[targetKey] && this.grid.occupied[targetKey] !== unitId) {
      return { success: false, reason: 'occupied' };
    }

    // Check terrain passability
    const terrain = this.grid.terrain[targetKey];
    if (terrain === 'wall' || terrain === 'void') {
      return { success: false, reason: 'impassable_terrain' };
    }

    // Free old cell
    const oldKey = `${unit.pos.q},${unit.pos.r}`;
    delete this.grid.occupied[oldKey];

    unit.pos = { ...targetPos };
    this.grid.occupied[targetKey] = unitId;

    const [oldQ, oldR] = oldKey.split(',').map(Number);
    Engine.bus.emit('combat:unit_moved', { unitId, from: { q: oldQ, r: oldR }, to: targetPos });
    return { success: true, newPos: targetPos };
  }

  // ─── Damage ───────────────────────────────────────────────────────────────

  applyDamage(targetId, amount, type) {
    const target = this._getUnit(targetId);
    if (!target) return { dealt: 0, blocked: 0 };

    let remaining = Math.max(0, amount);
    let blocked = 0;

    // Shield absorption
    if (target.statuses.bouclier && target.statuses.bouclier.stacks > 0) {
      const shieldAbs = Math.min(target.statuses.bouclier.stacks, remaining);
      target.statuses.bouclier.stacks -= shieldAbs;
      if (target.statuses.bouclier.stacks <= 0) delete target.statuses.bouclier;
      blocked += shieldAbs;
      remaining -= shieldAbs;
    }

    // Armor reduction (physical only)
    if (type === 'physical' && target.armor && remaining > 0) {
      const armorBlock = Math.min(target.armor, remaining);
      blocked += armorBlock;
      remaining -= armorBlock;
    }

    // Apply remaining to HP
    const actualDamage = Math.max(0, remaining);
    target.hp = Math.max(0, target.hp - actualDamage);

    this._log(`${targetId} took ${actualDamage} ${type} damage (${blocked} blocked). HP: ${target.hp}/${target.maxHp}`);
    Engine.bus.emit('combat:damage_dealt', { targetId, amount: actualDamage, blocked, type, remaining: target.hp });

    if (target.hp <= 0) {
      this._log(`${targetId} has been defeated!`);
      Engine.bus.emit('combat:unit_defeated', { unitId: targetId });
      // Remove from grid
      const key = `${target.pos.q},${target.pos.r}`;
      delete this.grid.occupied[key];
    }

    return { dealt: actualDamage, blocked };
  }

  // ─── Status Effects ───────────────────────────────────────────────────────

  applyStatus(targetId, statusId, stacks, duration) {
    const target = this._getUnit(targetId);
    if (!target) return;

    if (!target.statuses[statusId]) {
      target.statuses[statusId] = { stacks: 0, duration: 0 };
    }

    target.statuses[statusId].stacks += stacks;
    target.statuses[statusId].duration = Math.max(target.statuses[statusId].duration, duration);

    this._log(`${targetId} gained ${stacks} stack(s) of ${statusId} (total: ${target.statuses[statusId].stacks}).`);
    Engine.bus.emit('combat:status_applied', { targetId, statusId, stacks, duration, total: target.statuses[statusId].stacks });
  }

  tickStatuses(unitId) {
    const unit = this._getUnit(unitId);
    if (!unit) return;

    const toRemove = [];

    for (const [statusId, status] of Object.entries(unit.statuses)) {
      switch (statusId) {
        case 'poison':
          // -1 HP per turn, -1 stack per round
          this._directDamage(unitId, 1, 'poison');
          status.stacks = Math.max(0, status.stacks - 1);
          break;

        case 'saignement':
          // -1 HP and -1 souffle per turn, -1 stack
          this._directDamage(unitId, 1, 'bleed');
          unit.endurance = Math.max(0, (unit.endurance || 0) - 1);
          status.stacks = Math.max(0, status.stacks - 1);
          Engine.bus.emit('combat:resource_updated', { unitId });
          break;

        case 'brulure':
          // -1 HP and -1 regeneration per turn, -1 stack
          this._directDamage(unitId, 1, 'fire');
          unit.regeneration = Math.max(0, (unit.regeneration || 0) - 1);
          status.stacks = Math.max(0, status.stacks - 1);
          break;

        case 'fatigue':
          // -1 mana and -1 flux per turn, -1 stack
          unit.mana = Math.max(0, (unit.mana || 0) - 1);
          unit.flux = Math.max(0, (unit.flux || 0) - 1);
          status.stacks = Math.max(0, status.stacks - 1);
          Engine.bus.emit('combat:resource_updated', { unitId });
          break;

        case 'etourdi':
          // -1 initiative cumulative per stack, -1 stack per round
          // The initiative penalty is applied during turn processing (see initiative calc)
          status.stacks = Math.max(0, status.stacks - 1);
          break;

        case 'assomme':
          // Handled in nextTurn() — skip turn there
          // Duration ticks down
          status.duration = Math.max(0, status.duration - 1);
          break;

        case 'assomme_immune':
          // Just ticks down
          status.duration = Math.max(0, status.duration - 1);
          if (status.duration <= 0) toRemove.push(statusId);
          break;

        case 'puissance':
        case 'faiblesse':
          // Stacks consumed on attack (in _applyEffect), so just tick duration
          status.duration = Math.max(0, status.duration - 1);
          break;

        case 'bouclier':
          // Doesn't tick — consumed by damage
          break;

        case 'echo':
          status.duration = Math.max(0, status.duration - 1);
          break;

        case 'reflexion':
          status.duration = Math.max(0, status.duration - 1);
          break;

        case 'invisible':
          status.duration = Math.max(0, status.duration - 1);
          if (status.duration <= 0) toRemove.push(statusId);
          break;

        case 'berserk':
          status.duration = Math.max(0, status.duration - 1);
          break;

        default:
          // Generic: tick duration
          status.duration = Math.max(0, status.duration - 1);
          break;
      }

      // Cleanup expired stacks/duration
      if (status.stacks <= 0 && statusId !== 'bouclier' && statusId !== 'assomme_immune') {
        toRemove.push(statusId);
      }
    }

    for (const sid of toRemove) {
      delete unit.statuses[sid];
      Engine.bus.emit('combat:status_expired', { unitId, statusId: sid });
    }

    Engine.bus.emit('combat:statuses_ticked', { unitId, statuses: { ...unit.statuses } });
  }

  _directDamage(unitId, amount, type) {
    const unit = this._getUnit(unitId);
    if (!unit) return;
    unit.hp = Math.max(0, unit.hp - amount);
    Engine.bus.emit('combat:damage_dealt', { targetId: unitId, amount, blocked: 0, type, remaining: unit.hp });
    if (unit.hp <= 0) {
      Engine.bus.emit('combat:unit_defeated', { unitId });
      const key = `${unit.pos.q},${unit.pos.r}`;
      delete this.grid.occupied[key];
    }
  }

  // ─── Enemy AI ─────────────────────────────────────────────────────────────

  calculateEnemyAction(enemyId) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    // If dead, skip
    if (enemy.hp <= 0) { enemy.nextAction = null; return; }

    const patterns = enemy.patterns || [];
    if (patterns.length === 0) {
      // Default: basic attack on player
      enemy.nextAction = { type: 'attack', targetId: 'player', amount: enemy.attackDamage || 3, damageType: 'physical' };
      return;
    }

    // Cycle through patterns
    const pattern = patterns[enemy.currentPattern % patterns.length];
    enemy.currentPattern = (enemy.currentPattern + 1) % Math.max(1, patterns.length);
    enemy.nextAction = { ...pattern };

    // Pre-announce next action to UI
    Engine.bus.emit('combat:enemy_intent', { enemyId, action: enemy.nextAction });
  }

  executeEnemyAction(enemyId) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy || !enemy.nextAction || enemy.hp <= 0) return;

    const action = enemy.nextAction;

    switch (action.type) {
      case 'attack': {
        const targetId = action.targetId || 'player';
        const target = this._getUnit(targetId);
        if (!target) break;

        // Check invisible
        if (target.statuses.invisible && target.statuses.invisible.stacks > 0) {
          this._log(`${enemyId} can't target ${targetId} — invisible.`);
          break;
        }

        let dmg = (action.amount || enemy.attackDamage || 3);
        // Apply enemy puissance/faiblesse
        if (enemy.statuses.puissance && enemy.statuses.puissance.stacks > 0) {
          dmg += enemy.statuses.puissance.stacks;
          enemy.statuses.puissance.stacks -= 1;
          if (enemy.statuses.puissance.stacks <= 0) delete enemy.statuses.puissance;
        }
        if (enemy.statuses.faiblesse && enemy.statuses.faiblesse.stacks > 0) {
          dmg -= enemy.statuses.faiblesse.stacks;
          enemy.statuses.faiblesse.stacks -= 1;
          if (enemy.statuses.faiblesse.stacks <= 0) delete enemy.statuses.faiblesse;
        }
        if (enemy.statuses.berserk && enemy.statuses.berserk.stacks > 0) {
          dmg += 2;
        }
        dmg = Math.max(0, dmg);

        // Reflexion check
        if (target.statuses.reflexion && target.statuses.reflexion.stacks > 0) {
          target.statuses.reflexion.stacks -= 1;
          if (target.statuses.reflexion.stacks <= 0) delete target.statuses.reflexion;
          this._log(`Reflexion: attack reflected back to ${enemyId}!`);
          this.applyDamage(enemyId, dmg, action.damageType || 'physical');
        } else {
          this.applyDamage(targetId, dmg, action.damageType || 'physical');
        }
        break;
      }

      case 'move': {
        if (action.targetPos) {
          this.moveUnit(enemyId, action.targetPos);
        } else {
          // Move towards player
          const stepPos = this._stepTowards(enemy.pos, this.player.pos);
          if (stepPos) this.moveUnit(enemyId, stepPos);
        }
        break;
      }

      case 'status': {
        const statusTarget = action.targetId || 'player';
        this.applyStatus(statusTarget, action.statusId, action.stacks || 1, action.duration || 3);
        break;
      }

      case 'heal': {
        const healAmt = Math.min(action.amount || 5, enemy.maxHp - enemy.hp);
        enemy.hp += healAmt;
        Engine.bus.emit('combat:healed', { targetId: enemyId, amount: healAmt });
        break;
      }

      case 'shield': {
        this.applyStatus(enemyId, 'bouclier', action.amount || 3, 999);
        break;
      }

      case 'summon': {
        // Summon support for future extension
        Engine.bus.emit('combat:enemy_summon', { enemyId, summonData: action.summonData });
        break;
      }

      default:
        this._log(`Unknown enemy action type: ${action.type}`);
    }

    // Pre-calculate next action for display
    this.calculateEnemyAction(enemyId);

    Engine.bus.emit('combat:enemy_acted', { enemyId, action });

    const combatEnd = this.checkCombatEnd();
    if (combatEnd) Engine.bus.emit('combat:ended', { result: combatEnd });
  }

  // ─── Win/Lose Condition ───────────────────────────────────────────────────

  checkCombatEnd() {
    if (this.player.hp <= 0) return 'player_lose';
    const allEnemiesDead = this.enemies.every(e => e.hp <= 0);
    if (allEnemiesDead) return 'player_win';
    return null;
  }

  // ─── Weapons ──────────────────────────────────────────────────────────────

  switchWeapon() {
    if (this.player.initiative < 1) return { success: false, reason: 'insufficient_initiative' };
    this.player.initiative -= 1;
    this.player.activeWeapon = this.player.activeWeapon === 0 ? 1 : 0;
    this._rebuildActiveTags();
    Engine.bus.emit('combat:weapon_switched', { activeWeapon: this.player.activeWeapon, activeTags: [...this.player.activeTags] });
    return { success: true, activeWeapon: this.player.activeWeapon };
  }

  _rebuildActiveTags() {
    this.player.activeTags = new Set();
    const weapon = this.player.weapons[this.player.activeWeapon];
    if (weapon && weapon.tags) {
      for (const tag of weapon.tags) {
        this.player.activeTags.add(tag);
      }
    }
  }

  // ─── Consumables ──────────────────────────────────────────────────────────

  useConsumable(slot) {
    const consumables = this.player.consumables || [];
    const item = consumables[slot];
    if (!item) return { success: false, reason: 'no_item' };

    const itemDef = Engine.getCard ? Engine.getCard(item.id) : null;
    if (!itemDef) return { success: false, reason: 'item_not_found' };

    // Execute item effects on self
    const effects = itemDef.effects || [];
    for (const effect of effects) {
      this._applyEffect(effect, 'player', this.player.pos, itemDef);
    }

    // Remove from consumable slot
    consumables[slot] = null;
    this.player.consumables = consumables;

    Engine.bus.emit('combat:consumable_used', { slot, itemId: item.id });
    return { success: true };
  }

  // ─── End Turn ─────────────────────────────────────────────────────────────

  endTurn() {
    if (this.currentUnit !== 'player') return { success: false, reason: 'not_player_turn' };

    // Discard hand and draw new cards
    this.player.discard.push(...this.player.hand);
    this.player.hand = [];

    // Draw new hand
    const drawCount = this.player.handSize || 5;
    this.drawCards(drawCount);

    // Restore endurance partially
    const enduranceRegen = this.player.enduranceRegen || 2;
    this.player.endurance = Math.min(this.player.maxEndurance, this.player.endurance + enduranceRegen);

    Engine.bus.emit('combat:player_turn_end', { tick: this.currentTick });

    // Advance to next turn in timeline
    return this.nextTurn();
  }

  // ─── Damage Bonus ─────────────────────────────────────────────────────────

  getDamageBonus(tags, source) {
    const unit = source || this.player;
    const stats = unit.stats || unit;
    const force = stats.force || 0;
    const dex = stats.dexterite || 0;
    const intel = stats.intelligence || 0;

    let bonus = 0;

    if (tags.includes('Contondant')) {
      bonus += Math.floor(force / 3);
    }
    if (tags.includes('Estoc')) {
      bonus += Math.floor(dex / 3);
    }
    if (tags.includes('Tranchant')) {
      bonus += Math.floor((force + dex) / 6);
    }
    if (tags.includes('Magie')) {
      bonus += Math.floor(intel / 3);
    }

    // Etourdi reduces initiative (not directly damage, but track it)
    const etourdiPenalty = unit.statuses && unit.statuses.etourdi
      ? unit.statuses.etourdi.stacks
      : 0;
    if (unit === this.player && etourdiPenalty > 0) {
      this.player.initiative = Math.max(0, this.player.initiative - etourdiPenalty);
    }

    return bonus;
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  _getUnit(id) {
    if (id === 'player') return this.player;
    return this.enemies.find(e => e.id === id) || null;
  }

  _isValidPos(pos) {
    return HexGrid.inBounds(pos.q, pos.r, this.grid.width, this.grid.height);
  }

  // Flat-top hex direction from a towards b (normalized step)
  _direction(from, to) {
    const dq = to.q - from.q;
    const dr = to.r - from.r;
    // Clamp to -1..1
    return {
      q: dq === 0 ? 0 : (dq > 0 ? 1 : -1),
      r: dr === 0 ? 0 : (dr > 0 ? 1 : -1),
    };
  }

  // Hex neighbors (flat-top)
  _hexNeighbors(pos) {
    return HexGrid.neighbors(pos.q, pos.r).filter(p => this._isValidPos(p));
  }

  _hexDistance(a, b) {
    return HexGrid.distance(a, b);
  }

  _stepTowards(from, to) {
    const neighbors = this._hexNeighbors(from);
    let best = null;
    let bestDist = Infinity;
    for (const n of neighbors) {
      const key = `${n.q},${n.r}`;
      if (this.grid.occupied[key]) continue;
      const terrain = this.grid.terrain[key];
      if (terrain === 'wall' || terrain === 'void') continue;
      const dist = this._hexDistance(n, to);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    return best;
  }

  _log(msg) {
    const entry = { tick: this.currentTick, msg };
    this.log.push(entry);
    Engine.bus.emit('combat:log', entry);
  }
}

window.CombatState = CombatState;
})();
