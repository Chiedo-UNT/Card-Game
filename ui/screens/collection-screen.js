// Collection screen — browse all cards owned by the current character, build deck.

(function () {
class CollectionScreen {
  constructor(params = {}) {
    this.el = document.getElementById('screen-collection');
    this._params = params;
    this._filter = 'all';
  }

  init() {
    this._build();
  }

  destroy() {
    this.el.innerHTML = '';
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _build() {
    const t = k => I18n.t(k) || k;
    const char = Save.getCurrentChar();
    if (!char) { Engine.showScreen('menu'); return; }

    const filters = ['all', 'Attaque', 'Défense', 'Magie'];

    this.el.innerHTML = `
      <div class="screen-header">
        <button class="btn btn--ghost" id="coll-back">← Menu</button>
        <h1 class="screen-title">${t('ui.menu.collection')}</h1>
        <button class="btn btn--secondary" id="coll-save-deck">Sauvegarder le deck</button>
      </div>

      <div class="collection-filters" id="coll-filters">
        ${filters.map(f => `
          <button class="filter-chip ${f === this._filter ? 'active' : ''}" data-filter="${f}">
            ${f === 'all' ? 'Tout' : f}
          </button>`).join('')}
      </div>

      <div style="display:grid; grid-template-columns:1fr 260px; flex:1; overflow:hidden; min-height:0;">
        <div class="collection-grid" id="collection-grid" style="overflow-y:auto;"></div>

        <div style="border-left:1px solid var(--color-border); padding:12px; overflow-y:auto;">
          <div style="font-size:var(--text-sm); font-weight:700; color:var(--color-text-dim); margin-bottom:10px;">
            Deck actuel (<span id="deck-count">0</span>)
          </div>
          <div id="deck-list" style="display:flex; flex-direction:column; gap:4px;"></div>
        </div>
      </div>
    `;

    document.getElementById('coll-back').addEventListener('click', () => Engine.showScreen('menu'));
    document.getElementById('coll-save-deck').addEventListener('click', () => this._saveDeck());

    document.getElementById('coll-filters').querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filter = btn.dataset.filter;
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderGrid();
      });
    });

    this._renderGrid();
    this._renderDeck();
  }

  _renderGrid() {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const char = Save.getCurrentChar();
    const library = char ? (char.library || []) : [];

    // Merge library with all available cards if library is empty (starter set)
    const available = library.length > 0
      ? library.map(id => Engine.getCard(id)).filter(Boolean)
      : Engine.getAllCards();

    const filtered = this._filter === 'all'
      ? available
      : available.filter(c => c.tags && c.tags.includes(this._filter));

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🃏</div><div class="empty-state__desc">Aucune carte.</div></div>`;
      return;
    }

    for (const card of filtered) {
      const run = Save.getCurrentRun();
      const deck = (run && run.deck) || (char && char.savedDeck) || [];
      const count = deck.filter(id => id === card.id).length;

      const el = CardRenderer.createSmall(card);
      el.style.cursor = 'pointer';
      if (count > 0) {
        const badge = document.createElement('div');
        badge.className = 'card__count-badge';
        badge.textContent = count;
        badge.style.cssText = `
          position:absolute; bottom:2px; right:2px;
          background:var(--color-accent); color:#000;
          font-size:0.6rem; font-weight:900;
          border-radius:8px; padding:1px 5px;
        `;
        el.style.position = 'relative';
        el.appendChild(badge);
      }

      el.addEventListener('click', () => this._addToDeck(card.id));
      el.addEventListener('contextmenu', e => { e.preventDefault(); this._removeFromDeck(card.id); });

      grid.appendChild(el);
    }
  }

  _renderDeck() {
    const list   = document.getElementById('deck-list');
    const countEl = document.getElementById('deck-count');
    if (!list) return;

    const run = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    const deck = (run && run.deck) || (char && char.savedDeck) || [];

    if (countEl) countEl.textContent = deck.length;

    // Count unique cards
    const counts = {};
    for (const id of deck) counts[id] = (counts[id] || 0) + 1;

    list.innerHTML = '';
    for (const [id, cnt] of Object.entries(counts)) {
      const name = I18n.t(`card.${id}.name`) || id;
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        padding:4px 8px; border-radius:4px;
        background:var(--color-panel); border:1px solid var(--color-border);
        font-size:var(--text-xs); color:var(--color-text);
      `;
      row.innerHTML = `
        <span>${this._esc(name)}</span>
        <span style="color:var(--color-accent); font-weight:700;">x${cnt}</span>
      `;
      list.appendChild(row);
    }

    if (deck.length === 0) {
      list.innerHTML = `<div style="font-size:var(--text-xs); color:var(--color-text-muted);">Deck vide. Cliquez sur une carte pour l'ajouter.</div>`;
    }
  }

  _addToDeck(cardId) {
    const run  = Save.getCurrentRun();
    const char = Save.getCurrentChar();

    if (run) {
      run.deck = run.deck || [];
      if (run.deck.length >= 30) return;
      run.deck.push(cardId);
      Save.saveRunState(run);
    } else if (char) {
      char.savedDeck = char.savedDeck || [];
      if (char.savedDeck.length >= 30) return;
      char.savedDeck.push(cardId);
      Save.save();
    }

    this._renderGrid();
    this._renderDeck();
  }

  _removeFromDeck(cardId) {
    const run  = Save.getCurrentRun();
    const char = Save.getCurrentChar();

    if (run) {
      const idx = (run.deck || []).lastIndexOf(cardId);
      if (idx !== -1) { run.deck.splice(idx, 1); Save.saveRunState(run); }
    } else if (char) {
      const idx = (char.savedDeck || []).lastIndexOf(cardId);
      if (idx !== -1) { char.savedDeck.splice(idx, 1); Save.save(); }
    }

    this._renderGrid();
    this._renderDeck();
  }

  _saveDeck() {
    const run  = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    if (!char) return;

    const deck = (run && run.deck) || char.savedDeck || [];
    char.savedDeck = [...deck];
    Save.save();

    // Brief toast
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = 'Deck sauvegardé !';
    toast.style.cssText = 'position:fixed; bottom:24px; right:20px; z-index:900;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.CollectionScreen = CollectionScreen;
})();
