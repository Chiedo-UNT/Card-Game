// Forge screen — lets the player upgrade card attributes with Poudre d'Éther.

(function () {
class ForgeScreen {
  constructor(params = {}) {
    this.el      = document.getElementById('screen-forge');
    this._params = params;
    this._selectedCard = null;
    this._cardInstances = [];
  }

  init() {
    this._loadCards();
    this._build();
  }

  destroy() {
    this.el.innerHTML = '';
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _loadCards() {
    const run = Save.getCurrentRun();
    // Cards come from the run deck
    const deckIds = (run && run.deck) ? run.deck : [];
    this._cardInstances = deckIds.map((id, i) => {
      const def = Engine.getCard(id);
      if (!def) return null;
      return { ...def, _instanceIdx: i, upgradeCount: 0 };
    }).filter(Boolean).filter(c => c.forgeable);
  }

  _build() {
    const t = k => I18n.t(k) || k;
    const run = Save.getCurrentRun();
    const powder = (run && run.etherPowder) || 0;

    this.el.innerHTML = `
      <div id="screen-forge" style="display:flex; flex-direction:column; height:100vh;">
        <div class="screen-header">
          <button class="btn btn--ghost" id="forge-back">← ${t('ui.map.title')}</button>
          <h1 class="screen-title">${t('ui.forge.title')}</h1>
          <div class="resource-chip resource-chip--ether">
            <div class="resource-chip__dot"></div>
            <span id="forge-powder">${powder} ${t('ui.forge.ether_powder')}</span>
          </div>
        </div>

        <div class="forge-layout" style="flex:1; display:grid; grid-template-columns:240px 1fr; overflow:hidden;">
          <div class="forge-card-list" id="forge-card-list"></div>
          <div class="forge-detail" id="forge-detail">
            <div class="empty-state">
              <div class="empty-state__icon">⚒</div>
              <div class="empty-state__title">${t('ui.forge.select_card')}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('forge-back').addEventListener('click', () => Engine.showScreen('map'));

    this._buildCardList();
  }

  _buildCardList() {
    const list = document.getElementById('forge-card-list');
    if (!list) return;
    list.innerHTML = '';

    if (this._cardInstances.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:24px;">
        <div class="empty-state__icon">🃏</div>
        <div class="empty-state__desc">Aucune carte forgeable dans votre deck.</div>
      </div>`;
      return;
    }

    for (const card of this._cardInstances) {
      const name = I18n.t(`card.${card.id}.name`) || card.id;
      const item = document.createElement('div');
      item.className = 'forge-card-item';
      item.dataset.id = card.id;
      item.innerHTML = `
        <span class="forge-card-item__name">${this._esc(name)}</span>
        ${card.upgradeCount > 0 ? `<span class="forge-card-item__badge">+${card.upgradeCount}</span>` : ''}
      `;
      item.addEventListener('click', () => {
        this._selectedCard = card;
        list.querySelectorAll('.forge-card-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this._buildDetail(card);
      });
      list.appendChild(item);
    }
  }

  _buildDetail(card) {
    const detail = document.getElementById('forge-detail');
    if (!detail) return;
    const t = k => I18n.t(k) || k;
    const run = Save.getCurrentRun();
    const powder = (run && run.etherPowder) || 0;
    const name = I18n.t(`card.${card.id}.name`) || card.id;
    const options = ForgeSystem.getUpgradeOptions(card, powder);

    detail.innerHTML = `
      <h2 style="font-size:var(--text-xl); color:var(--color-accent); margin-bottom:8px;">${this._esc(name)}</h2>
      <p style="font-size:var(--text-xs); color:var(--color-text-dim); margin-bottom:16px;">
        ${I18n.t(`card.${card.id}.desc`) || ''}
      </p>

      <div class="forge-attributes" id="forge-attrs">
        ${options.length === 0
          ? `<div style="color:var(--color-text-muted);">${t('ui.forge.max_reached')}</div>`
          : options.map(opt => this._buildAttrRow(opt, powder)).join('')
        }
      </div>
    `;

    detail.querySelectorAll('.btn-forge-upgrade').forEach(btn => {
      btn.addEventListener('click', () => {
        const path  = btn.dataset.path;
        const value = parseFloat(btn.dataset.value);
        const cost  = parseInt(btn.dataset.cost, 10);
        this._applyUpgrade(card, path, value, cost);
      });
    });
  }

  _buildAttrRow(opt, powder) {
    const t = k => I18n.t(k) || k;
    const label = this._attrLabel(opt.path);
    const incOptions = opt.options.filter(o => (typeof o.value === 'number' ? o.value > opt.currentValue : o.value !== opt.currentValue));
    const bestInc = incOptions[0];

    if (!bestInc) return '';

    return `
      <div class="forge-attribute">
        <span class="forge-attr-label">${label}</span>
        <div class="forge-attr-track">
          <div class="forge-attr-fill" style="width:${Math.min(100, opt.currentValue * 10)}%"></div>
        </div>
        <div class="forge-attr-values">
          <span class="forge-attr-current">${opt.currentValue}</span>
          <span class="forge-attr-arrow">→</span>
          <span class="forge-attr-next">${bestInc.value}</span>
        </div>
        <div class="forge-attr-cost">
          ${bestInc.cost} ${t('ui.forge.ether_powder')}
        </div>
        <button class="btn btn--primary btn-forge-upgrade"
          data-path="${opt.path}"
          data-value="${bestInc.value}"
          data-cost="${bestInc.cost}"
          ${bestInc.affordable ? '' : 'disabled'}
          style="padding:4px 12px; font-size:var(--text-xs);">
          ${t('ui.forge.upgrade')}
        </button>
      </div>
    `;
  }

  _applyUpgrade(card, path, value, cost) {
    const run = Save.getCurrentRun();
    const powder = (run && run.etherPowder) || 0;
    const result = ForgeSystem.applyUpgrade(card, path, value, powder);

    if (!result.success) return;

    // Deduct powder
    if (run) {
      run.etherPowder = Math.max(0, powder - result.cost);
      Save.saveRunState(run);
    }

    // Refresh powder display
    const powderEl = document.getElementById('forge-powder');
    const t = k => I18n.t(k) || k;
    if (powderEl) powderEl.textContent = `${(run && run.etherPowder) || 0} ${t('ui.forge.ether_powder')}`;

    // Refresh list badge and detail
    this._buildCardList();
    this._buildDetail(card);
  }

  _attrLabel(path) {
    const map = {
      'effects[0].amount':   I18n.t('effect.damage') || 'Dégâts',
      'effects[1].amount':   I18n.t('effect.heal')   || 'Soin',
      'effects[0].stacks':   'Stacks 1',
      'effects[0].duration': 'Durée 1',
      'manaCost':            I18n.t('misc.mana')      || 'Mana',
      'enduranceCost':       I18n.t('misc.endurance') || 'Endurance',
      'initiativeCost':      I18n.t('misc.initiative')|| 'Initiative',
    };
    return map[path] || path;
  }

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.ForgeScreen = ForgeScreen;
})();
