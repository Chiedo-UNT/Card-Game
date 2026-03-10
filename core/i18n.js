// Localization system
// Loads lang/[language].json from each loaded module
// window.t is a convenience alias for I18n.t

(function () {
class I18n {
  constructor() {
    this._strings = {};  // flat key -> string map
    this._lang = 'fr';
    this._loadedPaths = new Set(); // track which module+lang combos have been loaded
  }

  // ─── Initialization ──────────────────────────────────────────────────────

  async init(lang = 'fr') {
    this._lang = lang;
    this._strings = {};
    this._loadedPaths = new Set();
    console.log(`[I18n] Initializing with language "${lang}"`);
    // Strings for individual modules are loaded via loadModuleStrings,
    // called from Engine.init() after modules are registered.
  }

  // ─── Module String Loading ───────────────────────────────────────────────

  // Fetch and merge strings from modulePath/lang/[lang].json
  async loadModuleStrings(modulePath, lang) {
    const normalizedPath = modulePath.replace(/\/$/, '');
    const cacheKey = `${normalizedPath}::${lang}`;

    if (this._loadedPaths.has(cacheKey)) {
      return; // already loaded
    }

    const url = `${normalizedPath}/lang/${lang}.json`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        // If the requested language doesn't exist, try falling back to 'fr'
        if (lang !== 'fr') {
          const fallbackUrl = `${normalizedPath}/lang/fr.json`;
          const fallbackResp = await fetch(fallbackUrl);
          if (fallbackResp.ok) {
            const fallbackData = await fallbackResp.json();
            this._mergeStrings(fallbackData);
            console.warn(`[I18n] Fell back to "fr" for module "${normalizedPath}" (${lang} not found).`);
          }
        }
        // Mark as loaded even on failure to prevent repeated requests
        this._loadedPaths.add(cacheKey);
        return;
      }

      const data = await resp.json();
      this._mergeStrings(data);
      this._loadedPaths.add(cacheKey);
      console.log(`[I18n] Loaded strings from ${url} (${Object.keys(data).length} keys)`);
    } catch (err) {
      console.warn(`[I18n] Could not load strings from ${url}:`, err.message);
      this._loadedPaths.add(cacheKey); // mark attempted so we don't retry infinitely
    }
  }

  // Recursively flatten a nested object into dot-separated keys
  // e.g. { ui: { title: "Jeu" } } → { "ui.title": "Jeu" }
  _mergeStrings(data, prefix = '') {
    for (const [key, value] of Object.entries(data)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this._mergeStrings(value, fullKey);
      } else {
        // Later modules override earlier ones for the same key
        this._strings[fullKey] = value;
      }
    }
  }

  // ─── Translation ─────────────────────────────────────────────────────────

  // Return the translated string for key, substituting {{variable}} placeholders
  // vars: object of variable substitutions, e.g. { name: 'Alice', count: 3 }
  // Falls back to the key itself if not found
  t(key, vars = {}) {
    let str = this._strings[key];

    if (str === undefined || str === null) {
      // Return the raw key so missing translations are obvious in development
      return key;
    }

    // Substitute {{variable}} placeholders
    if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
      str = str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return Object.prototype.hasOwnProperty.call(vars, varName)
          ? String(vars[varName])
          : match; // leave unresolved placeholders as-is
      });
    }

    return str;
  }

  // ─── Language Switching ──────────────────────────────────────────────────

  async setLanguage(lang) {
    if (lang === this._lang) return;

    const prevLang = this._lang;
    this._lang = lang;

    // Clear existing strings and loaded-paths cache so they are re-fetched for the new language
    this._strings = {};
    this._loadedPaths = new Set();

    // Reload strings for all already-registered modules
    if (window.Engine) {
      const moduleLoads = Object.values(window.Engine.modules).map(mod =>
        this.loadModuleStrings(mod.path, lang)
      );
      await Promise.allSettled(moduleLoads);
    }

    // Persist language choice in save state
    if (window.Save && window.Save.state) {
      window.Save.state.settings.language = lang;
      window.Save.save();
    }

    // Notify the rest of the application
    if (window.Engine) {
      window.Engine.bus.emit('language:change', { lang, prev: prevLang });
    }

    console.log(`[I18n] Language changed: "${prevLang}" → "${lang}"`);
  }

  // ─── Accessors ───────────────────────────────────────────────────────────

  get currentLang() {
    return this._lang;
  }

  // Returns a copy of all loaded strings (useful for debugging)
  getAllStrings() {
    return { ...this._strings };
  }

  // Returns true if the given key has a translation in the current language
  has(key) {
    return Object.prototype.hasOwnProperty.call(this._strings, key);
  }
}

window.I18n = new I18n();
})();

// Global convenience alias so any script can call t('some.key', { var: value })
window.t = (key, vars = {}) => window.I18n.t(key, vars);
