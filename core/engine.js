// Core game engine - screen manager, module loader, event bus
// Screens: 'menu', 'character-creation', 'character-select', 'map', 'combat', 'forge', 'talent', 'merchant', 'collection', 'result'

(function () {
class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
  }

  emit(event, data) {
    const listeners = this._listeners[event];
    if (listeners && listeners.length > 0) {
      // Iterate over a copy so that listeners removed during iteration don't cause issues
      listeners.slice().forEach(fn => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      });
    }
  }

  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  // Remove all listeners for an event, or all events if no argument given
  clear(event) {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
  }
}

class Engine {
  constructor() {
    this.bus = new EventBus();
    this.modules = {};        // { moduleId: { id, path, manifest, cards, weapons, enemies, archetypes, events, talents } }
    this.currentScreen = null;
    this.currentScreenInstance = null;
    this.state = null;        // full game state, managed by save.js
    this._initialized = false;

    // Flat registries merged from all loaded modules
    this._registry = {
      cards:      {},
      weapons:    {},
      enemies:    {},
      archetypes: {},
      events:     {},
      talents:    {}
    };
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  async init() {
    console.log('[Engine] Initializing...');

    // 1. Load base module
    try {
      await this.loadModule('modules/base');
    } catch (err) {
      console.warn('[Engine] Could not load base module:', err);
    }

    // 2. Discover and load any additional modules declared in modules/module-index.json
    try {
      const indexResp = await fetch('modules/module-index.json');
      if (indexResp.ok) {
        const index = await indexResp.json();
        const extras = (index.modules || []).filter(p => p !== 'modules/base');
        const extraResults = await Promise.allSettled(extras.map(p => this.loadModule(p)));
        extraResults.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.warn(`[Engine] Failed to load extra module "${extras[i]}":`, result.reason);
          }
        });
      }
    } catch (_) {
      // module-index.json is optional; silently ignore
    }

    // 3. Restore saved state
    if (window.Save) {
      window.Save.load();
      this.state = window.Save.state;
    }

    // 4. Initialize i18n with the saved language preference
    const lang = (this.state && this.state.settings && this.state.settings.language) || 'fr';
    if (window.I18n) {
      await window.I18n.init(lang);
      // Load i18n strings for all modules that were registered before I18n was ready
      const moduleStringLoads = Object.values(this.modules).map(mod =>
        window.I18n.loadModuleStrings(mod.path, lang).catch(() => {})
      );
      await Promise.allSettled(moduleStringLoads);
    }

    this._initialized = true;
    this.bus.emit('engine:ready', {});

    console.log('[Engine] Ready. Registry sizes:', {
      cards:      Object.keys(this._registry.cards).length,
      weapons:    Object.keys(this._registry.weapons).length,
      enemies:    Object.keys(this._registry.enemies).length,
      archetypes: Object.keys(this._registry.archetypes).length,
      events:     Object.keys(this._registry.events).length,
      talents:    Object.keys(this._registry.talents).length,
    });

    // 5. Show the initial screen
    this.showScreen('menu');
  }

  // ─── Module Loading ────────────────────────────────────────────────────────

  async loadModule(modulePath) {
    const normalizedPath = modulePath.replace(/\/$/, '');

    // Fetch and parse module.json manifest
    let manifest;
    try {
      const resp = await fetch(`${normalizedPath}/module.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      manifest = await resp.json();
    } catch (err) {
      console.error(`[Engine] Failed to load manifest at ${normalizedPath}/module.json:`, err);
      throw err;
    }

    const moduleId = manifest.id;

    // Guard against double-loading
    if (this.modules[moduleId]) {
      console.warn(`[Engine] Module "${moduleId}" already loaded – skipping.`);
      return this.modules[moduleId];
    }

    console.log(`[Engine] Loading module "${moduleId}" from ${normalizedPath}`);

    const moduleData = {
      id:         moduleId,
      path:       normalizedPath,
      manifest,
      cards:      {},
      weapons:    {},
      enemies:    {},
      archetypes: {},
      events:     {},
      talents:    {}
    };

    // Load all resource types declared in the manifest in parallel
    const resourceTypes = ['cards', 'weapons', 'enemies', 'archetypes', 'events', 'talents'];
    const loaders = resourceTypes
      .filter(type => Array.isArray(manifest[type]) && manifest[type].length > 0)
      .map(type => this._loadResources(normalizedPath, type, manifest[type], moduleData[type]));

    await Promise.allSettled(loaders);

    // Register module and merge into flat registries
    this.modules[moduleId] = moduleData;
    this._mergeIntoRegistry(moduleData);

    // Load i18n strings if I18n is already available and initialized
    if (window.I18n && window.I18n.currentLang) {
      await window.I18n.loadModuleStrings(normalizedPath, window.I18n.currentLang).catch(() => {});
    }

    this.bus.emit('module:loaded', { moduleId, manifest });
    console.log(`[Engine] Module "${moduleId}" loaded.`);
    return moduleData;
  }

  async _loadResources(modulePath, type, ids, target) {
    // Derive singular filename from plural type name
    const singularMap = {
      cards:      'card',
      weapons:    'weapon',
      enemies:    'enemy',
      archetypes: 'archetype',
      events:     'event',
      talents:    'talent'
    };
    const singular = singularMap[type] || type.replace(/s$/, '');

    const fetches = ids.map(async (id) => {
      // Convention: modulePath/type/id/singular.json
      // e.g. modules/base/cards/magic_blast/card.json
      const url = `${modulePath}/${type}/${id}/${singular}.json`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // Always ensure id field is present on the object
        if (!data.id) data.id = id;
        target[id] = data;
      } catch (err) {
        console.warn(`[Engine] Failed to load ${type}/${id} from ${url}:`, err.message);
      }
    });

    await Promise.allSettled(fetches);
  }

  _mergeIntoRegistry(moduleData) {
    const types = ['cards', 'weapons', 'enemies', 'archetypes', 'events', 'talents'];
    for (const type of types) {
      const source = moduleData[type];
      if (!source) continue;
      for (const [id, data] of Object.entries(source)) {
        if (this._registry[type][id]) {
          console.warn(`[Engine] Registry conflict: ${type}["${id}"] already exists. Module "${moduleData.id}" overwrites it.`);
        }
        // Annotate with originating module id for debugging
        this._registry[type][id] = { ...data, _moduleId: moduleData.id };
      }
    }
  }

  // ─── Screen Management ─────────────────────────────────────────────────────

  showScreen(name, params = {}) {
    const prevScreen = this.currentScreen;

    // Tear down previous screen instance
    if (this.currentScreenInstance) {
      if (typeof this.currentScreenInstance.destroy === 'function') {
        try {
          this.currentScreenInstance.destroy();
        } catch (err) {
          console.warn(`[Engine] Error destroying screen "${prevScreen}":`, err);
        }
      }
      this.currentScreenInstance = null;
    }

    // Hide all screen DOM elements
    document.querySelectorAll('.screen').forEach(el => {
      el.classList.remove('active');
      el.style.display = 'none';
    });

    // Show the target screen's DOM element if it exists
    const screenEl = document.getElementById(`screen-${name}`);
    if (screenEl) {
      screenEl.style.display = '';
      screenEl.classList.add('active');
    } else {
      console.warn(`[Engine] No DOM element found for screen "${name}" (expected id="screen-${name}")`);
    }

    // Map screen names to their controller class names
    const screenClassMap = {
      'menu':               'MenuScreen',
      'character-creation': 'CharacterCreationScreen',
      'character-select':   'CharacterSelectScreen',
      'map':                'MapScreen',
      'combat':             'CombatScreen',
      'forge':              'ForgeScreen',
      'talent':             'TalentScreen',
      'merchant':           'MerchantScreen',
      'collection':         'CollectionScreen',
      'result':             'ResultScreen'
    };

    const className = screenClassMap[name];
    if (className && window[className]) {
      try {
        this.currentScreenInstance = new window[className](params);
        if (typeof this.currentScreenInstance.init === 'function') {
          this.currentScreenInstance.init();
        }
      } catch (err) {
        console.error(`[Engine] Error instantiating screen "${name}" (${className}):`, err);
        // Show error in the screen element so it's visible without devtools
        if (screenEl) {
          screenEl.innerHTML = `<div style="color:#f66;padding:40px;font-family:sans-serif;max-width:600px;margin:auto">
            <h2 style="color:#f99">Erreur écran "${name}"</h2>
            <pre style="white-space:pre-wrap;font-size:13px">${err}\n${err.stack || ''}</pre>
          </div>`;
        }
      }
    } else if (className) {
      console.warn(`[Engine] Screen class "${className}" not found on window.`);
      if (screenEl) {
        screenEl.innerHTML = `<div style="color:#fa0;padding:40px;font-family:sans-serif">
          Classe "${className}" introuvable (window.${className} = undefined)
        </div>`;
      }
    }

    this.currentScreen = name;
    this.bus.emit('screen:change', { name, params, prev: prevScreen });
    console.log(`[Engine] Screen: ${prevScreen || '(none)'} → ${name}`);
  }

  // ─── Registry Getters ──────────────────────────────────────────────────────

  getModule(id) {
    return this.modules[id] || null;
  }

  getCard(id) {
    return this._registry.cards[id] || null;
  }

  getWeapon(id) {
    return this._registry.weapons[id] || null;
  }

  getEnemy(id) {
    return this._registry.enemies[id] || null;
  }

  getArchetype(id) {
    return this._registry.archetypes[id] || null;
  }

  getEvent(id) {
    return this._registry.events[id] || null;
  }

  getTalent(id) {
    return this._registry.talents[id] || null;
  }

  getAllCards() {
    return Object.values(this._registry.cards);
  }

  getAllWeapons() {
    return Object.values(this._registry.weapons);
  }

  getAllEnemies() {
    return Object.values(this._registry.enemies);
  }

  getAllArchetypes() {
    return Object.values(this._registry.archetypes);
  }

  getAllEvents() {
    return Object.values(this._registry.events);
  }

  getAllTalents() {
    return Object.values(this._registry.talents);
  }

  // ─── Filtered Queries ──────────────────────────────────────────────────────

  getCardsByTag(tag) {
    return this.getAllCards().filter(card => Array.isArray(card.tags) && card.tags.includes(tag));
  }

  getCardsByArchetype(archetypeId) {
    return this.getAllCards().filter(card => card.archetypeId === archetypeId);
  }

  getWeaponsByType(weaponType) {
    return this.getAllWeapons().filter(w => w.type === weaponType);
  }

  // ─── State Helpers ─────────────────────────────────────────────────────────

  getState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
  }

  isInitialized() {
    return this._initialized;
  }
}

window.Engine = new Engine();
})();
