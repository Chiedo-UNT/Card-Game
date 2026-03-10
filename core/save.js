// Save/load system using localStorage
// Manages the complete persistent game state including characters, run state, and settings

(function () {
const SAVE_KEY = 'cardgame_save';
const SAVE_VERSION = 1;

class Save {
  constructor() {
    this.state = null;
  }

  // ─── Default State Factories ───────────────────────────────────────────────

  _defaultState() {
    return {
      version: SAVE_VERSION,
      characters: {},
      currentCharId: null,
      settings: { language: 'fr' },
      run: null
    };
  }

  _defaultCharacter(id, name, archetypeId, stats) {
    // stats: { force, dexterite, intelligence, endurance, volonte, rapidite }
    const baseStats = {
      force:        stats.force        ?? 0,
      dexterite:    stats.dexterite    ?? 0,
      intelligence: stats.intelligence ?? 0,
      endurance:    stats.endurance    ?? 0,
      volonte:      stats.volonte      ?? 0,
      rapidite:     stats.rapidite     ?? 0,
    };

    return {
      id,
      name,
      archetypeId,
      baseStats,
      // Talent system: unspent points per stat, and invested levels per talent
      talentPoints: {
        force:        0,
        dexterite:    0,
        intelligence: 0,
        endurance:    0,
        volonte:      0,
        rapidite:     0,
        map:          0,
      },
      talentInvested: {},     // { [talentId]: level }
      library:  [],           // permanent card collection [cardId, ...]
      weapons:  [],           // owned weapon instances [{ id, instanceId, rarity, specificCards: [] }]
      equipment: {
        armor:   null,
        ring1:   null,
        ring2:   null,
        amulet:  null,
        boots:   null,
      },
      vault: {
        weapons:   [],
        equipment: [],
      },
      gold:        { bank: 0 },
      etherPowder: { bank: 0 },
      savedDeck:          [],
      lastRunDeck:        null,
      merchantRefreshCount: 0,
      merchantStock:      null,
    };
  }

  _defaultRun(charId, deck) {
    return {
      charId,
      mapSeed:         Math.floor(Math.random() * 2 ** 32),
      currentNode:     null,
      visitedNodes:    [],
      deck:            deck.slice(),
      hand:            [],
      gold:            0,       // at-risk gold carried during run
      etherPowder:     0,       // at-risk powder carried during run
      consumables:     [null, null, null, null],               // 4 quick slots
      inventory:       [null, null, null, null, null, null, null, null], // 8 slots
      equippedWeapons: [null, null],
      activeWeapon:    0,
      equipment: {
        armor:  null,
        ring1:  null,
        ring2:  null,
        amulet: null,
        boots:  null,
      },
      hp:        0,
      endurance: 0,
      mana:      0,
      eventFlags:     {},   // { [eventId]: outcome }
      bossesDefeated: 0,
      zone:           1,
    };
  }

  // ─── Save / Load ───────────────────────────────────────────────────────────

  save() {
    if (!this.state) {
      console.warn('[Save] Attempted to save but state is null.');
      return;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error('[Save] Failed to save state to localStorage:', err);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        console.log('[Save] No existing save found. Initializing fresh state.');
        this.state = this._defaultState();
        this.save();
        return;
      }

      const parsed = JSON.parse(raw);

      // Version migration hook – extend as the schema evolves
      const migrated = this._migrate(parsed);
      this.state = migrated;

      // Keep Engine in sync
      if (window.Engine) {
        window.Engine.setState(this.state);
      }

      console.log('[Save] State loaded successfully.');
    } catch (err) {
      console.error('[Save] Failed to load state. Resetting to default:', err);
      this.state = this._defaultState();
      this.save();
    }
  }

  // Schema migration: bring an older save up to the current version
  _migrate(state) {
    let s = state;

    // v0 → v1: ensure all required fields exist
    if (!s.version || s.version < 1) {
      s.version = 1;
      if (!s.characters)    s.characters    = {};
      if (!s.currentCharId) s.currentCharId = null;
      if (!s.settings)      s.settings      = { language: 'fr' };
      if (s.run === undefined) s.run         = null;
    }

    // Ensure settings has a language field
    if (!s.settings.language) s.settings.language = 'fr';

    // Ensure each character has all required fields (forward-compatibility)
    for (const char of Object.values(s.characters)) {
      if (!char.talentPoints)   char.talentPoints   = { force: 0, dexterite: 0, intelligence: 0, endurance: 0, volonte: 0, rapidite: 0, map: 0 };
      if (!char.talentInvested) char.talentInvested = {};
      if (!char.library)        char.library        = [];
      if (!char.weapons)        char.weapons        = [];
      if (!char.equipment)      char.equipment      = { armor: null, ring1: null, ring2: null, amulet: null, boots: null };
      if (!char.vault)          char.vault          = { weapons: [], equipment: [] };
      if (!char.gold)           char.gold           = { bank: 0 };
      if (!char.etherPowder)    char.etherPowder    = { bank: 0 };
      if (!char.savedDeck)      char.savedDeck      = [];
      if (char.lastRunDeck === undefined) char.lastRunDeck = null;
      if (char.merchantRefreshCount === undefined) char.merchantRefreshCount = 0;
      if (char.merchantStock === undefined) char.merchantStock = null;
    }

    return s;
  }

  // ─── Character Management ──────────────────────────────────────────────────

  createCharacter(name, archetypeId, stats) {
    const id = `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const char = this._defaultCharacter(id, name, archetypeId, stats);
    this.state.characters[id] = char;
    this.state.currentCharId  = id;
    this.save();
    console.log(`[Save] Created character "${name}" (${id}) with archetype "${archetypeId}"`);
    return char;
  }

  deleteCharacter(charId) {
    if (!this.state.characters[charId]) {
      console.warn(`[Save] deleteCharacter: no character with id "${charId}"`);
      return false;
    }
    delete this.state.characters[charId];
    if (this.state.currentCharId === charId) {
      const remaining = Object.keys(this.state.characters);
      this.state.currentCharId = remaining.length > 0 ? remaining[0] : null;
    }
    this.save();
    return true;
  }

  getCurrentChar() {
    if (!this.state || !this.state.currentCharId) return null;
    return this.state.characters[this.state.currentCharId] || null;
  }

  setCurrentChar(charId) {
    if (!this.state.characters[charId]) {
      console.warn(`[Save] setCurrentChar: no character with id "${charId}"`);
      return false;
    }
    this.state.currentCharId = charId;
    this.save();
    return true;
  }

  // ─── Run Management ────────────────────────────────────────────────────────

  // deckChoice: array of card ids the player has chosen to bring into the run
  startRun(charId, deckChoice) {
    const char = this.state.characters[charId];
    if (!char) {
      console.error(`[Save] startRun: no character with id "${charId}"`);
      return null;
    }

    // Reset per-run merchant state
    char.merchantRefreshCount = 0;
    char.merchantStock        = null;

    const run = this._defaultRun(charId, deckChoice);

    // Copy the character's in-world equipment into the run snapshot
    run.equipment = { ...char.equipment };

    // Copy equipped weapon instance IDs from the character's weapon list
    // Convention: the character stores which weapon slots are active
    if (char.equippedWeapons) {
      run.equippedWeapons = char.equippedWeapons.slice(0, 2);
    }

    // Derive initial HP / endurance / mana from character stats + archetype
    // The exact formula is applied by the combat system; here we store zeroes
    // and let the run initializer fill real values after archetype lookup.
    run.hp        = 0;
    run.endurance = char.baseStats.endurance;
    run.mana      = 0;

    this.state.run = run;
    this.state.currentCharId = charId;
    this.save();

    console.log(`[Save] Run started for character "${char.name}" (${charId})`);
    return run;
  }

  // Called at the end of a run (death or completion)
  // survived: boolean – true if the player escaped / completed, false if they died
  endRun(survived) {
    const run = this.state.run;
    if (!run) {
      console.warn('[Save] endRun called but no active run.');
      return;
    }

    const char = this.state.characters[run.charId];
    if (char) {
      // Always record the deck that was used for this run
      char.lastRunDeck = run.deck.slice();

      if (survived) {
        // Merge at-risk gold and powder into the bank
        char.gold.bank        += run.gold;
        char.etherPowder.bank += run.etherPowder;

        // Persist any items collected during the run back to the character
        // (Inventory items are handled by the loot system before endRun is called)
      } else {
        // On death: at-risk resources are lost (do not merge into bank)
        // The loot system has already stripped the run inventory before calling endRun
      }
    }

    this.state.run = null;
    this.save();

    console.log(`[Save] Run ended. Survived: ${survived}`);
  }

  // Persist an updated snapshot of the active run (called frequently during gameplay)
  saveRunState(runData) {
    if (!this.state.run) {
      console.warn('[Save] saveRunState called but no active run in state.');
      return;
    }
    this.state.run = { ...this.state.run, ...runData };
    this.save();
  }

  getCurrentRun() {
    return this.state ? this.state.run : null;
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  getSetting(key) {
    return this.state && this.state.settings ? this.state.settings[key] : undefined;
  }

  setSetting(key, value) {
    if (!this.state) return;
    this.state.settings[key] = value;
    this.save();
  }

  // ─── Debug Helpers ─────────────────────────────────────────────────────────

  // Wipe save and reset to defaults (dev / debug use only)
  reset() {
    localStorage.removeItem(SAVE_KEY);
    this.state = this._defaultState();
    this.save();
    console.log('[Save] Save data has been reset.');
  }

  // Export the current save as a JSON string (for backup / share)
  export() {
    return JSON.stringify(this.state, null, 2);
  }

  // Import save data from a JSON string
  import(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      this.state = this._migrate(parsed);
      this.save();
      if (window.Engine) window.Engine.setState(this.state);
      console.log('[Save] Save data imported successfully.');
      return true;
    } catch (err) {
      console.error('[Save] Failed to import save data:', err);
      return false;
    }
  }
}

window.Save = new Save();
})();
