// Tag registry and matching engine
// Tags are strings. Cards have "requires" (AND logic) and "tags" (what the card IS).
// Active tags come from: equipped weapons, character states, buffs.

(function () {
class TagSystem {
  constructor() {
    this._activeTags = new Set(); // currently active tags in the current context
  }

  // ─── Active Tag Management ─────────────────────────────────────────────────

  // Replace the entire active tag set (typically called when the combat context is established)
  setActiveTags(tags) {
    this._activeTags = new Set(tags);
  }

  addTag(tag) {
    this._activeTags.add(tag);
  }

  removeTag(tag) {
    this._activeTags.delete(tag);
  }

  hasTag(tag) {
    // 'ANY' is a wildcard that always passes
    return tag === 'ANY' || this._activeTags.has(tag);
  }

  clearTags() {
    this._activeTags.clear();
  }

  getActiveTags() {
    return [...this._activeTags];
  }

  // ─── Card Playability Check ────────────────────────────────────────────────

  // Check whether a card's requirements are all satisfied (AND logic between entries,
  // OR logic within a single entry using the pipe character).
  //
  // cardRequires examples:
  //   []                          → always playable
  //   ['CaC']                     → requires CaC tag
  //   ['Arc|Arbalète']            → requires Arc OR Arbalète
  //   ['CaC', 'Tranchant']        → requires CaC AND Tranchant
  //   ['ANY']                     → always playable (explicit wildcard)
  canPlay(cardRequires) {
    if (!cardRequires || cardRequires.length === 0) return true;

    return cardRequires.every(req => {
      if (!req) return true;
      if (req === 'ANY') return true;

      // Support "Arc|Arbalète" → OR logic within one requirement slot
      const alternatives = req.split('|');
      return alternatives.some(r => {
        const trimmed = r.trim();
        return trimmed === 'ANY' || this._activeTags.has(trimmed);
      });
    });
  }

  // ─── Weapon Tag Derivation ─────────────────────────────────────────────────

  // Return the tags contributed by a weapon data object.
  // Looks up the weapon's type in WEAPON_TAGS; also merges any custom tags
  // declared on the weapon data itself (weaponData.tags array).
  getWeaponTags(weaponData) {
    if (!weaponData) return [];

    const type = (weaponData.type || '').toLowerCase().replace(/\s+/g, '_');
    const baseTags = TagSystem.WEAPON_TAGS[type] ? [...TagSystem.WEAPON_TAGS[type]] : [];

    // Allow individual weapon data to declare extra tags
    const extraTags = Array.isArray(weaponData.tags) ? weaponData.tags : [];

    // Merge, deduplicate
    const merged = new Set([...baseTags, ...extraTags]);
    return [...merged];
  }

  // Build and apply the active tag set from an array of weapon data objects
  // (typically the two equipped weapons) plus any additional status-effect tags.
  applyWeaponContext(equippedWeapons = [], extraTags = []) {
    const tags = new Set(extraTags);

    for (const weapon of equippedWeapons) {
      if (!weapon) continue;
      for (const tag of this.getWeaponTags(weapon)) {
        tags.add(tag);
      }
    }

    this._activeTags = tags;
  }

  // ─── Bulk Filtering Helpers ────────────────────────────────────────────────

  // Filter an array of card objects to those that can currently be played
  filterPlayable(cards) {
    return cards.filter(card => this.canPlay(card.requires));
  }

  // Partition cards into { playable, unplayable }
  partitionPlayable(cards) {
    const playable   = [];
    const unplayable = [];
    for (const card of cards) {
      (this.canPlay(card.requires) ? playable : unplayable).push(card);
    }
    return { playable, unplayable };
  }

  // ─── Standard Weapon Type Definitions ─────────────────────────────────────

  static WEAPON_TAGS = {
    'epee':       ['Tranchant', 'Estoc', 'CaC', 'Épée'],
    'hache':      ['Tranchant', 'Contondant', 'CaC', 'Hache'],
    'marteau':    ['Contondant', 'CaC', 'Marteau'],
    'gourdin':    ['Contondant', 'CaC', 'Gourdin'],
    'dague':      ['Tranchant', 'Estoc', 'CaC', 'Dague'],
    'rapiere':    ['Estoc', 'CaC', 'Rapière'],
    'lance':      ['Estoc', 'CaC', 'Lance'],
    'fouet':      ['Tranchant', 'CaC', 'Fouet'],
    'arc':        ['Estoc', 'Distance', 'Flèche', 'Arc'],
    'arbalete':   ['Estoc', 'Distance', 'Flèche', 'Arbalète'],
    'fronde':     ['Contondant', 'Distance', 'Projectile', 'Fronde'],
    'baguette':   ['Magie', 'Distance', 'Baguette'],
    'baton':      ['Magie', 'Distance', 'Bâton'],
    'mains_nues': ['Contondant', 'CaC', 'Mains nues'],
  };

  // ─── Tag Metadata (optional display names / descriptions) ─────────────────

  // Map of tag id → human-readable label (French, matching the game's default locale)
  static TAG_LABELS = {
    'Tranchant':   'Tranchant',
    'Estoc':       'Estoc',
    'Contondant':  'Contondant',
    'CaC':         'Corps à corps',
    'Distance':    'Distance',
    'Flèche':      'Flèche',
    'Projectile':  'Projectile',
    'Magie':       'Magie',
    'Épée':        'Épée',
    'Hache':       'Hache',
    'Marteau':     'Marteau',
    'Gourdin':     'Gourdin',
    'Dague':       'Dague',
    'Rapière':     'Rapière',
    'Lance':       'Lance',
    'Fouet':       'Fouet',
    'Arc':         'Arc',
    'Arbalète':    'Arbalète',
    'Fronde':      'Fronde',
    'Baguette':    'Baguette',
    'Bâton':       'Bâton',
    'Mains nues':  'Mains nues',
  };

  static getLabelForTag(tag) {
    return TagSystem.TAG_LABELS[tag] || tag;
  }

  // Return all tags that a weapon type contributes
  static tagsForType(weaponType) {
    const key = weaponType.toLowerCase().replace(/\s+/g, '_');
    return TagSystem.WEAPON_TAGS[key] ? [...TagSystem.WEAPON_TAGS[key]] : [];
  }
}

window.TagSystem = new TagSystem();
})();
