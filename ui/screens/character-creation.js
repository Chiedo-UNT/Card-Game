// Character creation screen
(function () {
class CharacterCreationScreen {
  constructor() {
    this.el = document.getElementById('screen-character-creation');
    this._selectedArchetype = null;
    this._customStats = { force: 5, dexterite: 5, intelligence: 5, endurance: 5, volonte: 5, rapidite: 5 };
    this._pointsTotal = 30;
    this._isCustom = false;

    // Archetype base stat definitions
    this._archetypes = {
      mage: {
        id: 'mage',
        labelKey: 'archetype.mage.name',
        descKey: 'archetype.mage.desc',
        color: '#7b6cf7',
        baseStats: { force: 2, dexterite: 3, intelligence: 8, endurance: 3, volonte: 8, rapidite: 6 },
        baseVie: 10, baseMana: 10, baseEndurance: 3,
      },
      roublard: {
        id: 'roublard',
        labelKey: 'archetype.roublard.name',
        descKey: 'archetype.roublard.desc',
        color: '#4caf8a',
        baseStats: { force: 4, dexterite: 9, intelligence: 4, endurance: 5, volonte: 4, rapidite: 9 },
        baseVie: 20, baseMana: 3, baseEndurance: 8,
      },
      guerrier: {
        id: 'guerrier',
        labelKey: 'archetype.guerrier.name',
        descKey: 'archetype.guerrier.desc',
        color: '#d4884a',
        baseStats: { force: 8, dexterite: 5, intelligence: 3, endurance: 8, volonte: 4, rapidite: 5 },
        baseVie: 30, baseMana: 2, baseEndurance: 10,
      },
      berzerk: {
        id: 'berzerk',
        labelKey: 'archetype.berzerk.name',
        descKey: 'archetype.berzerk.desc',
        color: '#c94040',
        baseStats: { force: 9, dexterite: 4, intelligence: 2, endurance: 7, volonte: 6, rapidite: 7 },
        baseVie: 25, baseMana: 2, baseEndurance: 9,
      },
      custom: {
        id: 'custom',
        labelKey: 'ui.creation.custom',
        descKey: 'ui.creation.custom_desc',
        color: '#aaaaaa',
        baseStats: { force: 5, dexterite: 5, intelligence: 5, endurance: 5, volonte: 5, rapidite: 5 },
        baseVie: 15, baseMana: 5, baseEndurance: 5,
      },
    };

    this._statLabels = {
      force: 'Force',
      dexterite: 'Dextérité',
      intelligence: 'Intelligence',
      endurance: 'Endurance',
      volonte: 'Volonté',
      rapidite: 'Rapidité',
    };
  }

  init() {
    this._build();
  }

  show(params) {
    this.el.classList.add('active');
    this._selectArchetype('guerrier');
  }

  hide() {
    this.el.classList.remove('active');
  }

  destroy() {
    this.hide();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _build() {
    const t = (k) => I18n.t(k) || k;

    this.el.innerHTML = `
      <div class="creation-wrapper">
        <div class="creation-header">
          <button class="btn btn--ghost creation-back" id="creation-back">← ${t('ui.menu.continue') === 'Continuer' ? 'Retour' : 'Back'}</button>
          <h1 class="creation-title">${t('ui.creation.title') || 'Créer un Personnage'}</h1>
        </div>

        <div class="creation-body">
          <!-- Archetype selector -->
          <section class="creation-archetypes">
            <h2 class="section-title">${t('ui.creation.choose_archetype') || 'Choisir un Archétype'}</h2>
            <div class="archetype-cards" id="archetype-cards"></div>
            <p class="archetype-desc" id="archetype-desc"></p>
          </section>

          <!-- Stats panel -->
          <section class="creation-stats-panel">
            <h2 class="section-title">${t('ui.creation.stats') || 'Statistiques'}</h2>

            <!-- Points remaining (custom only) -->
            <div class="points-remaining" id="points-remaining" style="display:none">
              <span>${t('ui.creation.points') || 'Points restants'}:</span>
              <strong id="points-value">0</strong> / ${this._pointsTotal}
            </div>

            <div class="stats-grid" id="stats-grid"></div>

            <!-- Preview section -->
            <div class="stat-preview">
              <h3>${t('ui.creation.preview') || 'Aperçu'}</h3>
              <div class="preview-row"><span>${t('misc.life') || 'Vie'}:</span> <strong id="prev-hp">0</strong></div>
              <div class="preview-row"><span>${t('misc.mana') || 'Mana'}:</span> <strong id="prev-mana">0</strong></div>
              <div class="preview-row"><span>${t('misc.endurance') || 'Endurance'}:</span> <strong id="prev-end">0</strong></div>
              <div class="preview-row"><span>${t('misc.initiative') || 'Initiative'}/tour:</span> <strong id="prev-init">0</strong></div>
              <div class="preview-row"><span>${t('ui.creation.interval') || 'Intervalle'}:</span> <strong id="prev-interval">0</strong></div>
            </div>
          </section>

          <!-- Name + confirm -->
          <section class="creation-confirm-panel">
            <h2 class="section-title">${t('ui.creation.name') || 'Nom du Personnage'}</h2>
            <input type="text" id="char-name-input" class="char-name-input"
                   placeholder="${t('ui.creation.name_placeholder') || 'Entrez un nom...'}"
                   maxlength="24" />
            <div class="name-error" id="name-error" style="display:none; color:var(--color-danger)">
              ${t('ui.creation.name_required') || 'Veuillez entrer un nom.'}
            </div>
            <button class="btn btn--primary creation-submit" id="creation-submit">
              ${t('ui.creation.create') || 'Créer'}
            </button>
          </section>
        </div>
      </div>
    `;

    this._buildArchetypeCards();
    this._buildStatsGrid();
    this._bindEvents();
  }

  _buildArchetypeCards() {
    const container = document.getElementById('archetype-cards');
    if (!container) return;
    container.innerHTML = '';

    for (const [id, arch] of Object.entries(this._archetypes)) {
      const card = document.createElement('button');
      card.className = 'archetype-card';
      card.dataset.archetype = id;
      card.style.setProperty('--arch-color', arch.color);
      card.innerHTML = `<span class="arch-name">${I18n.t(arch.labelKey) || arch.labelKey}</span>`;
      card.addEventListener('click', () => this._selectArchetype(id));
      container.appendChild(card);
    }
  }

  _buildStatsGrid() {
    const grid = document.getElementById('stats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [statKey, label] of Object.entries(this._statLabels)) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.dataset.stat = statKey;
      row.innerHTML = `
        <span class="stat-label">${label}</span>
        <div class="stat-controls">
          <button class="stat-btn stat-dec" data-stat="${statKey}" aria-label="Diminuer ${label}">−</button>
          <span class="stat-value" id="stat-val-${statKey}">0</span>
          <button class="stat-btn stat-inc" data-stat="${statKey}" aria-label="Augmenter ${label}">+</button>
        </div>
        <div class="stat-bar-wrap">
          <div class="stat-bar" id="stat-bar-${statKey}" style="width:0%"></div>
        </div>
      `;
      grid.appendChild(row);
    }

    // Bind +/- buttons
    grid.querySelectorAll('.stat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stat = btn.dataset.stat;
        const delta = btn.classList.contains('stat-inc') ? 1 : -1;
        this._adjustStat(stat, delta);
      });
    });
  }

  _selectArchetype(id) {
    this._selectedArchetype = id;
    this._isCustom = (id === 'custom');

    // Update card states
    document.querySelectorAll('.archetype-card').forEach(card => {
      card.classList.toggle('archetype-card--active', card.dataset.archetype === id);
    });

    const arch = this._archetypes[id];
    const descEl = document.getElementById('archetype-desc');
    if (descEl) descEl.textContent = I18n.t(arch.descKey) || arch.descKey;

    // Custom mode: allow editing, initialize with equal distribution
    const pointsRow = document.getElementById('points-remaining');
    const statsGrid = document.getElementById('stats-grid');
    if (this._isCustom) {
      this._customStats = { force: 5, dexterite: 5, intelligence: 5, endurance: 5, volonte: 5, rapidite: 5 };
      if (pointsRow) pointsRow.style.display = '';
      if (statsGrid) {
        statsGrid.querySelectorAll('.stat-btn').forEach(b => b.style.display = '');
      }
    } else {
      if (pointsRow) pointsRow.style.display = 'none';
      if (statsGrid) {
        statsGrid.querySelectorAll('.stat-btn').forEach(b => b.style.display = 'none');
      }
    }

    this._refreshStatsDisplay();
    this._refreshPreview();
  }

  _adjustStat(stat, delta) {
    if (!this._isCustom) return;

    const currentVal = this._customStats[stat];
    const newVal = currentVal + delta;

    if (newVal < 1 || newVal > 10) return;

    const pointsUsed = Object.values(this._customStats).reduce((a, b) => a + b, 0);
    if (delta > 0 && pointsUsed >= this._pointsTotal) return;

    this._customStats[stat] = newVal;
    this._refreshStatsDisplay();
    this._refreshPreview();
  }

  _getCurrentStats() {
    if (this._isCustom) return { ...this._customStats };
    const arch = this._archetypes[this._selectedArchetype];
    return arch ? { ...arch.baseStats } : {};
  }

  _refreshStatsDisplay() {
    const stats = this._getCurrentStats();

    for (const [statKey, val] of Object.entries(stats)) {
      const valEl = document.getElementById(`stat-val-${statKey}`);
      if (valEl) valEl.textContent = val;

      const barEl = document.getElementById(`stat-bar-${statKey}`);
      if (barEl) barEl.style.width = `${(val / 10) * 100}%`;
    }

    // Update points remaining
    if (this._isCustom) {
      const used = Object.values(this._customStats).reduce((a, b) => a + b, 0);
      const remaining = this._pointsTotal - used;
      const pointsVal = document.getElementById('points-value');
      if (pointsVal) {
        pointsVal.textContent = remaining;
        pointsVal.style.color = remaining < 0 ? 'var(--color-danger)' : '';
      }
    }
  }

  _refreshPreview() {
    const stats = this._getCurrentStats();
    const arch = this._archetypes[this._selectedArchetype] || { baseVie: 0, baseMana: 0, baseEndurance: 0 };

    const hp = 30 + (stats.endurance * 3) + arch.baseVie;
    const mana = 5 + (stats.volonte * 2) + arch.baseMana;
    const endurance = 5 + (stats.endurance * 2) + arch.baseEndurance;
    const initiative = stats.rapidite;
    const interval = Math.max(1, 20 - stats.rapidite);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('prev-hp', hp);
    set('prev-mana', mana);
    set('prev-end', endurance);
    set('prev-init', initiative);
    set('prev-interval', interval);
  }

  _bindEvents() {
    const backBtn = document.getElementById('creation-back');
    if (backBtn) backBtn.addEventListener('click', () => Engine.showScreen('menu'));

    const submitBtn = document.getElementById('creation-submit');
    if (submitBtn) submitBtn.addEventListener('click', () => this._onSubmit());

    const nameInput = document.getElementById('char-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const errEl = document.getElementById('name-error');
        if (errEl) errEl.style.display = 'none';
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._onSubmit();
      });
    }
  }

  _onSubmit() {
    const nameInput = document.getElementById('char-name-input');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      const errEl = document.getElementById('name-error');
      if (errEl) errEl.style.display = '';
      if (nameInput) nameInput.focus();
      return;
    }

    if (!this._selectedArchetype) {
      this._selectArchetype('guerrier');
    }

    // Validate custom points
    if (this._isCustom) {
      const used = Object.values(this._customStats).reduce((a, b) => a + b, 0);
      if (used !== this._pointsTotal) {
        alert(I18n.t('ui.creation.points_warning') || `Vous devez dépenser exactement ${this._pointsTotal} points (${used}/${this._pointsTotal} utilisés).`);
        return;
      }
    }

    const stats = this._getCurrentStats();
    const char = Save.createCharacter(name, this._selectedArchetype, stats);

    // Compute derived stats and store in run snapshot
    const arch = this._archetypes[this._selectedArchetype];
    const maxHp = 30 + (stats.endurance * 3) + arch.baseVie;
    const maxMana = 5 + (stats.volonte * 2) + arch.baseMana;
    const maxEndurance = 5 + (stats.endurance * 2) + arch.baseEndurance;

    Engine.bus.emit('character:created', { char, maxHp, maxMana, maxEndurance });

    // Start a run immediately
    Save.startRun(char.id, char.savedDeck || []);
    const run = Save.getCurrentRun();
    if (run) {
      run.hp = maxHp;
      run.mana = maxMana;
      run.endurance = maxEndurance;
      Save.saveRunState(run);
    }

    Engine.showScreen('map');
  }
}

window.CharacterCreationScreen = CharacterCreationScreen;
})();
