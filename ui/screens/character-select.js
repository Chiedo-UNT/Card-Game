// Character selection screen — lists saved characters, lets player choose one
// or delete one before starting a run.
(function () {
class CharacterSelectScreen {
  constructor() {
    this.el = document.getElementById('screen-character-select');
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
    const chars = Object.values((Save.state && Save.state.characters) || {});

    this.el.innerHTML = `
      <div class="select-wrapper">
        <div class="screen-header">
          <button class="btn btn--ghost" id="sel-back">← ${t('ui.menu.play')}</button>
          <h1 class="screen-title">${t('ui.menu.continue')}</h1>
          <button class="btn btn--secondary" id="sel-new">${t('ui.menu.newgame')}</button>
        </div>

        <div class="select-list" id="select-list"></div>
      </div>
    `;

    document.getElementById('sel-back').addEventListener('click', () => Engine.showScreen('menu'));
    document.getElementById('sel-new').addEventListener('click', () => Engine.showScreen('character-creation'));

    const list = document.getElementById('select-list');

    if (chars.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗡</div>
          <div class="empty-state__title">Aucun personnage</div>
          <div class="empty-state__desc">Créez un personnage pour commencer l'aventure.</div>
        </div>
      `;
      return;
    }

    for (const char of chars) {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.style.cssText = `
        display: flex; align-items: center; gap: 16px;
        padding: 16px 20px;
        background: var(--color-panel);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        margin-bottom: 10px;
      `;
      card.innerHTML = `
        <div class="char-card-avatar" style="
          width: 52px; height: 52px; border-radius: 50%;
          background: var(--color-panel-light);
          border: 2px solid var(--color-border-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.8rem; flex-shrink: 0;
        ">${this._archetypeIcon(char.archetypeId)}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-text);">${this._esc(char.name)}</div>
          <div style="font-size:var(--text-sm); color:var(--color-text-dim);">
            ${I18n.t('archetype.' + char.archetypeId + '.name') || char.archetypeId}
            &nbsp;·&nbsp; ${t('misc.gold')}: ${(char.gold && char.gold.bank) || 0}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn--primary btn-select" data-id="${char.id}">Jouer</button>
          <button class="btn btn--danger btn-delete" data-id="${char.id}" title="Supprimer">✕</button>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--color-accent)';
        card.style.background  = 'var(--color-panel-hover)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'var(--color-border)';
        card.style.background  = 'var(--color-panel)';
      });

      list.appendChild(card);
    }

    // Bind play buttons
    list.querySelectorAll('.btn-select').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._selectChar(btn.dataset.id);
      });
    });

    // Bind delete buttons
    list.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._deleteChar(btn.dataset.id);
      });
    });
  }

  _selectChar(charId) {
    Save.setCurrentChar(charId);
    const char = Save.getCurrentChar();
    if (!char) return;

    // If there is already an active run for this char, resume it
    const run = Save.getCurrentRun();
    if (run && run.charId === charId) {
      Engine.showScreen('map');
      return;
    }

    // Otherwise start a new run
    const arch = Engine.getArchetype(char.archetypeId);
    const deck = char.savedDeck && char.savedDeck.length > 0
      ? char.savedDeck
      : (arch && arch.startingCards ? [...arch.startingCards] : []);

    Save.startRun(charId, deck);
    const newRun = Save.getCurrentRun();
    if (newRun && arch) {
      // Compute HP from archetype + stats
      const s = char.baseStats || {};
      newRun.hp        = (arch.stats && arch.stats.vie)       || 60;
      newRun.mana      = (arch.stats && arch.stats.mana)      || 4;
      newRun.endurance = (arch.stats && arch.stats.endurance) || 5;
      Save.saveRunState(newRun);
    }

    Engine.showScreen('map');
  }

  _deleteChar(charId) {
    if (!confirm('Supprimer ce personnage ? Cette action est irréversible.')) return;
    Save.deleteCharacter(charId);
    this._build();
  }

  _archetypeIcon(id) {
    const icons = { mage: '🔮', guerrier: '⚔', roublard: '🗡', berzerk: '🪓' };
    return icons[id] || '👤';
  }

  _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.CharacterSelectScreen = CharacterSelectScreen;
})();
