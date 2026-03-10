// Merchant screen — sell cards, buy cards/consumables, refresh stock.

(function () {
class MerchantScreen {
  constructor(params = {}) {
    this.el = document.getElementById('screen-merchant');
    this._params = params;
    this._stock = null;
  }

  init() {
    this._generateStock();
    this._build();
  }

  destroy() {
    this.el.innerHTML = '';
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _generateStock() {
    const char = Save.getCurrentChar();
    if (char && char.merchantStock) {
      this._stock = char.merchantStock;
      return;
    }

    // Build a random stock of cards
    const allCards = Engine.getAllCards().filter(c => c.id !== 'slash' && c.id !== 'thrust');
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    const items = shuffled.slice(0, 6).map(c => ({
      id: c.id,
      type: 'card',
      price: this._cardPrice(c),
      sold: false,
    }));

    this._stock = { items, refreshCost: 30 };

    if (char) { char.merchantStock = this._stock; Save.save(); }
  }

  _build() {
    const t = k => I18n.t(k) || k;
    const run = Save.getCurrentRun();
    const gold = (run && run.gold) || 0;

    this.el.innerHTML = `
      <div class="screen-header">
        <button class="btn btn--ghost" id="merch-back">← ${t('ui.map.title')}</button>
        <h1 class="screen-title">Marchand</h1>
        <div class="resource-chip resource-chip--gold">
          <div class="resource-chip__dot"></div>
          <span id="merch-gold">${gold} ${t('misc.gold')}</span>
        </div>
      </div>

      <div class="merchant-layout" id="merchant-layout">
        <div>
          <div class="merchant-section-title">${t('ui.menu.collection')}</div>
          <div class="merchant-items" id="merch-items"></div>
        </div>

        <div style="margin-top:24px;">
          <button class="btn btn--secondary" id="merch-refresh">
            Rafraîchir le stock (${this._stock.refreshCost} ${t('misc.gold')})
          </button>
        </div>
      </div>
    `;

    document.getElementById('merch-back').addEventListener('click', () => Engine.showScreen('map'));
    document.getElementById('merch-refresh').addEventListener('click', () => this._refreshStock());

    this._renderItems();
  }

  _renderItems() {
    const container = document.getElementById('merch-items');
    if (!container) return;
    container.innerHTML = '';

    for (const item of this._stock.items) {
      const def = Engine.getCard(item.id);
      const name = def ? (I18n.t(`card.${item.id}.name`) || item.id) : item.id;

      const el = document.createElement('div');
      el.className = 'shop-item' + (item.sold ? ' sold' : '');
      el.innerHTML = `
        <div style="font-size:1.6rem;">${this._cardIcon(def)}</div>
        <div style="font-size:var(--text-xs); font-weight:700; color:var(--color-text); text-align:center;">${this._esc(name)}</div>
        <div class="shop-item__price">
          <span>${item.price}</span>
          <span style="font-size:0.65rem; color:var(--color-accent);">or</span>
        </div>
        ${item.sold ? '<div style="font-size:0.6rem; color:var(--color-text-muted);">Vendu</div>' : ''}
      `;

      if (!item.sold) {
        el.addEventListener('click', () => this._buyItem(item));
      }
      container.appendChild(el);
    }
  }

  _buyItem(item) {
    const run = Save.getCurrentRun();
    const gold = (run && run.gold) || 0;
    if (gold < item.price) return;

    // Deduct gold
    run.gold = gold - item.price;

    // Add card to deck
    if (item.type === 'card') {
      run.deck = run.deck || [];
      run.deck.push(item.id);
    }

    item.sold = true;
    Save.saveRunState(run);

    // Update gold display
    const goldEl = document.getElementById('merch-gold');
    const t = k => I18n.t(k) || k;
    if (goldEl) goldEl.textContent = `${run.gold} ${t('misc.gold')}`;

    this._renderItems();
  }

  _refreshStock() {
    const run = Save.getCurrentRun();
    const gold = (run && run.gold) || 0;
    const cost = this._stock.refreshCost;
    if (gold < cost) return;

    run.gold = gold - cost;
    Save.saveRunState(run);

    // Regenerate stock
    const char = Save.getCurrentChar();
    if (char) { char.merchantStock = null; Save.save(); }
    this._generateStock();
    this._build();
  }

  _cardPrice(card) {
    const prices = { Commune: 40, Rare: 80, Légendaire: 150 };
    return prices[card.rarity] || 40;
  }

  _cardIcon(def) {
    if (!def) return '🃏';
    const tags = def.tags || [];
    if (tags.includes('Magie'))   return '🔮';
    if (tags.includes('Attaque')) return '⚔';
    if (tags.includes('Défense')) return '🛡';
    return '🃏';
  }

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.MerchantScreen = MerchantScreen;
})();
