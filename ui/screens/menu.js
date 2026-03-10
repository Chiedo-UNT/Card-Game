// Menu screen – main entry point of the game
(function () {
class MenuScreen {
  constructor() {
    this.el = document.getElementById('screen-menu');
    this._langChangeHandler = null;
    this._subtitleInterval = null;
  }

  init() {
    if (!this.el) {
      this.el = document.getElementById('screen-menu');
    }
    if (!this.el) {
      console.error('[MenuScreen] #screen-menu element not found in DOM');
      return;
    }
    try {
      this._build();
      this._startSubtitleAnimation();
    } catch (err) {
      console.error('[MenuScreen] _build() threw:', err);
      this.el.innerHTML = `<div style="color:#f66;padding:40px;font-family:sans-serif">
        <h2>Erreur menu</h2><pre>${err}</pre></div>`;
    }
    // Re-render when language changes
    this._langChangeHandler = () => {
      try { this._build(); this._startSubtitleAnimation(); } catch (_) {}
    };
    Engine.bus.on('language:change', this._langChangeHandler);
  }

  show() {
    this.el.classList.add('active');
    this._updateButtons();
  }

  hide() {
    this.el.classList.remove('active');
    if (this._subtitleInterval) {
      clearInterval(this._subtitleInterval);
      this._subtitleInterval = null;
    }
  }

  destroy() {
    this.hide();
    if (this._langChangeHandler) {
      Engine.bus.off('language:change', this._langChangeHandler);
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _build() {
    console.log('[MenuScreen] _build() called, this.el=', this.el);
    const t = (k, v) => I18n.t(k, v);
    const lang = I18n.currentLang || 'fr';

    this.el.innerHTML = `
      <div class="menu-bg-overlay"></div>
      <div class="menu-container">

        <header class="menu-header">
          <h1 class="menu-title">Card Game</h1>
          <p class="menu-subtitle" id="menu-subtitle"></p>
        </header>

        <nav class="menu-nav" id="menu-nav" aria-label="Menu principal">
        </nav>

        <footer class="menu-footer">
          <div class="menu-lang" role="group" aria-label="Langue">
            <button class="lang-btn ${lang === 'fr' ? 'lang-btn--active' : ''}"
                    data-lang="fr" aria-pressed="${lang === 'fr'}">FR</button>
            <button class="lang-btn ${lang === 'en' ? 'lang-btn--active' : ''}"
                    data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
          </div>
          <span class="menu-version">v1.0.0</span>
        </footer>

        <!-- Settings panel (hidden by default) -->
        <div class="settings-panel" id="settings-panel" aria-hidden="true" style="display:none">
          <div class="settings-panel-inner">
            <h2 class="settings-title">${t('ui.menu.settings')}</h2>
            <div class="settings-row">
              <label for="sfx-toggle">${t('ui.settings.sfx') || 'Effets sonores'}</label>
              <input type="checkbox" id="sfx-toggle" checked />
            </div>
            <div class="settings-row">
              <label for="music-toggle">${t('ui.settings.music') || 'Musique'}</label>
              <input type="checkbox" id="music-toggle" checked />
            </div>
            <button class="btn btn--secondary settings-close" id="settings-close">
              ${t('ui.settings.close') || 'Fermer'}
            </button>
          </div>
        </div>

      </div>
    `;

    this._updateButtons();
    this._bindEvents();
  }

  _updateButtons() {
    const nav = document.getElementById('menu-nav');
    if (!nav) return;

    const hasSave = this._hasSave();
    const t = (k) => I18n.t(k);

    nav.innerHTML = '';

    // New Game
    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary menu-btn';
    btnNew.id = 'btn-new-game';
    btnNew.textContent = t('ui.menu.newgame');
    btnNew.addEventListener('click', () => this._onNewGame());
    nav.appendChild(btnNew);

    // Continue (only if save exists)
    if (hasSave) {
      const btnCont = document.createElement('button');
      btnCont.className = 'btn btn--primary menu-btn';
      btnCont.id = 'btn-continue';
      btnCont.textContent = t('ui.menu.continue');
      btnCont.addEventListener('click', () => this._onContinue());
      nav.appendChild(btnCont);
    }

    // Collection
    const btnColl = document.createElement('button');
    btnColl.className = 'btn btn--secondary menu-btn';
    btnColl.id = 'btn-collection';
    btnColl.textContent = t('ui.menu.collection');
    if (!hasSave) btnColl.disabled = true;
    btnColl.addEventListener('click', () => this._onCollection());
    nav.appendChild(btnColl);

    // Settings
    const btnSettings = document.createElement('button');
    btnSettings.className = 'btn btn--ghost menu-btn';
    btnSettings.id = 'btn-settings';
    btnSettings.textContent = t('ui.menu.settings');
    btnSettings.addEventListener('click', () => this._onSettings());
    nav.appendChild(btnSettings);
  }

  _bindEvents() {
    // Language buttons
    this.el.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        this._onLanguageChange(lang);
      });
    });

    // Settings close
    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const panel = document.getElementById('settings-panel');
        if (panel) { panel.style.display = 'none'; panel.setAttribute('aria-hidden', 'true'); }
      });
    }

    // SFX / Music toggles persist in settings
    const sfxToggle = document.getElementById('sfx-toggle');
    if (sfxToggle) {
      sfxToggle.checked = Save.getSetting('sfx') !== false;
      sfxToggle.addEventListener('change', () => Save.setSetting('sfx', sfxToggle.checked));
    }
    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
      musicToggle.checked = Save.getSetting('music') !== false;
      musicToggle.addEventListener('change', () => Save.setSetting('music', musicToggle.checked));
    }
  }

  _hasSave() {
    if (!window.Save || !Save.state) return false;
    return Object.keys(Save.state.characters || {}).length > 0;
  }

  _startSubtitleAnimation() {
    const subtitles = [
      'Dark Fantasy Card Roguelite',
      'Forgez votre destin',
      'Survivre ou périr',
      'Maîtrisez l\'hex',
    ];
    let index = 0;
    const el = document.getElementById('menu-subtitle');
    if (!el) return;
    if (this._subtitleInterval) clearInterval(this._subtitleInterval);

    const update = () => {
      if (!el.isConnected) { clearInterval(this._subtitleInterval); return; }
      el.classList.add('menu-subtitle--fade');
      setTimeout(() => {
        if (!el.isConnected) return;
        el.textContent = subtitles[index % subtitles.length];
        el.classList.remove('menu-subtitle--fade');
        index++;
      }, 400);
    };
    update();
    this._subtitleInterval = setInterval(update, 3500);
  }

  _onNewGame() {
    Engine.showScreen('character-creation');
  }

  _onContinue() {
    Engine.showScreen('character-select');
  }

  _onCollection() {
    // Collection needs a current character selected
    const char = Save.getCurrentChar();
    if (!char) {
      Engine.showScreen('character-select');
      return;
    }
    Engine.showScreen('collection');
  }

  _onSettings() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'flex';
    panel.setAttribute('aria-hidden', String(isVisible));
  }

  _onLanguageChange(lang) {
    I18n.setLanguage(lang);
  }
}

window.MenuScreen = MenuScreen;
})();
