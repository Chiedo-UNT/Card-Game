// Result screen — handles victory, defeat, rest, and event outcomes.

(function () {
class ResultScreen {
  constructor(params = {}) {
    this.el = document.getElementById('screen-result');
    this._params = params;
  }

  init() {
    const type = (this._params && this._params.type) || 'victory';
    switch (type) {
      case 'victory': this._buildVictory(); break;
      case 'defeat':  this._buildDefeat();  break;
      case 'rest':    this._buildRest();    break;
      case 'event':
      case 'divine':
      case 'unknown':  this._buildEvent();   break;
      default:         this._buildVictory();
    }
  }

  destroy() {
    this.el.innerHTML = '';
  }

  // ─── Victory ──────────────────────────────────────────────────────────────

  _buildVictory() {
    const t = k => I18n.t(k) || k;
    const gold = (this._params && this._params.gold) || 0;
    const exp  = (this._params && this._params.exp)  || 0;

    this.el.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:24px; padding:40px;">
        <h1 class="combat-result-title victory" style="
          font-family:var(--font-display); font-size:var(--text-3xl); font-weight:900;
          color:var(--color-accent); animation:result-appear 0.5s ease;
        ">${t('ui.combat.victory')}</h1>

        <div class="combat-loot">
          <div class="loot-row">
            <span>${t('ui.combat.gold_gained')}</span>
            <span>+${gold} ${t('misc.gold')}</span>
          </div>
          <div class="loot-row">
            <span>${t('ui.combat.exp_gained')}</span>
            <span>+${exp} XP</span>
          </div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <button class="btn btn--primary" id="res-map">
            ${t('ui.map.title')} →
          </button>
          <button class="btn btn--secondary" id="res-forge">
            ${t('ui.forge.title')}
          </button>
          <button class="btn btn--secondary" id="res-talents">
            ${t('ui.talent.title')}
          </button>
        </div>
      </div>
    `;

    document.getElementById('res-map').addEventListener('click', () => Engine.showScreen('map'));
    document.getElementById('res-forge').addEventListener('click', () => Engine.showScreen('forge'));
    document.getElementById('res-talents').addEventListener('click', () => Engine.showScreen('talent'));
  }

  // ─── Defeat ───────────────────────────────────────────────────────────────

  _buildDefeat() {
    const t = k => I18n.t(k) || k;

    this.el.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:24px; padding:40px;">
        <h1 style="
          font-family:var(--font-display); font-size:var(--text-3xl); font-weight:900;
          color:var(--color-danger-light); animation:result-appear 0.5s ease;
        ">${t('ui.combat.defeat')}</h1>

        <p style="color:var(--color-text-dim); font-size:var(--text-base); text-align:center; max-width:360px;">
          Votre aventure se termine ici. La poudre d'éther accumulée pendant la run est perdue.
        </p>

        <div style="display:flex; gap:12px;">
          <button class="btn btn--primary" id="res-menu">Menu principal</button>
          <button class="btn btn--secondary" id="res-new">Nouvelle partie</button>
        </div>
      </div>
    `;

    document.getElementById('res-menu').addEventListener('click', () => {
      Save.endRun(false);
      Engine.showScreen('menu');
    });
    document.getElementById('res-new').addEventListener('click', () => {
      Save.endRun(false);
      Engine.showScreen('character-creation');
    });
  }

  // ─── Rest ─────────────────────────────────────────────────────────────────

  _buildRest() {
    const t = k => I18n.t(k) || k;
    const run = Save.getCurrentRun();

    this.el.innerHTML = `
      <div class="rest-content" style="
        flex:1; display:flex; flex-direction:column; align-items:center;
        justify-content:center; gap:24px; padding:40px;
        background:radial-gradient(ellipse at bottom, #0a1a0e 0%, #0a0a14 70%);
      ">
        <h1 class="rest-title" style="
          font-family:var(--font-display); font-size:var(--text-2xl);
          color:var(--color-success-light);
        ">🔥 Feu de Camp</h1>

        <div style="display:flex; gap:16px; flex-wrap:wrap; justify-content:center;">
          <div class="rest-option" id="rest-heal" style="
            display:flex; flex-direction:column; align-items:center; gap:8px;
            padding:20px; background:var(--color-panel); border:1px solid var(--color-border);
            border-radius:8px; cursor:pointer; min-width:160px;
            transition:border-color 0.15s, background 0.15s;
          ">
            <span style="font-size:2rem;">❤️</span>
            <span style="font-size:var(--text-base); font-weight:700; color:var(--color-text);">Se soigner</span>
            <span style="font-size:var(--text-xs); color:var(--color-text-dim); text-align:center;">
              Restaure 30% des PV maximum.
            </span>
          </div>

          <div class="rest-option" id="rest-upgrade" style="
            display:flex; flex-direction:column; align-items:center; gap:8px;
            padding:20px; background:var(--color-panel); border:1px solid var(--color-border);
            border-radius:8px; cursor:pointer; min-width:160px;
            transition:border-color 0.15s, background 0.15s;
          ">
            <span style="font-size:2rem;">⭐</span>
            <span style="font-size:var(--text-base); font-weight:700; color:var(--color-text);">Méditer</span>
            <span style="font-size:var(--text-xs); color:var(--color-text-dim); text-align:center;">
              Gagne 1 point de talent.
            </span>
          </div>

          <div class="rest-option" id="rest-remove" style="
            display:flex; flex-direction:column; align-items:center; gap:8px;
            padding:20px; background:var(--color-panel); border:1px solid var(--color-border);
            border-radius:8px; cursor:pointer; min-width:160px;
            transition:border-color 0.15s, background 0.15s;
          ">
            <span style="font-size:2rem;">🃏</span>
            <span style="font-size:var(--text-base); font-weight:700; color:var(--color-text);">Épurer le deck</span>
            <span style="font-size:var(--text-xs); color:var(--color-text-dim); text-align:center;">
              Retire une carte du deck.
            </span>
          </div>
        </div>
      </div>
    `;

    [
      ['rest-heal',    () => this._doRest_heal()],
      ['rest-upgrade', () => this._doRest_upgrade()],
      ['rest-remove',  () => this._doRest_remove()],
    ].forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('mouseenter', () => {
          el.style.borderColor = 'var(--color-success)';
          el.style.background  = 'var(--color-panel-hover)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.borderColor = 'var(--color-border)';
          el.style.background  = 'var(--color-panel)';
        });
        el.addEventListener('click', fn);
      }
    });
  }

  _doRest_heal() {
    const run = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    if (!run || !char) return;
    const arch = Engine.getArchetype(char.archetypeId);
    const maxHp = arch ? (arch.stats && arch.stats.vie) || 60 : 60;
    const heal = Math.floor(maxHp * 0.3);
    run.hp = Math.min(maxHp, (run.hp || 0) + heal);
    Save.saveRunState(run);
    Engine.showScreen('map');
  }

  _doRest_upgrade() {
    const char = Save.getCurrentChar();
    if (!char) return;
    // Give 1 talent point in a random stat
    const trees = ['force', 'dexterite', 'intelligence', 'endurance', 'volonte', 'rapidite'];
    const tree = trees[Math.floor(Math.random() * trees.length)];
    char.talentPoints = char.talentPoints || {};
    char.talentPoints[tree] = (char.talentPoints[tree] || 0) + 1;
    Save.save();
    Engine.showScreen('talent');
  }

  _doRest_remove() {
    Engine.showScreen('collection');
  }

  // ─── Event ────────────────────────────────────────────────────────────────

  _buildEvent() {
    const t = k => I18n.t(k) || k;
    const node = this._params && this._params.node;

    // Pick a random event from registry
    const events = Engine.getAllEvents();
    const eventDef = events.length > 0 ? events[Math.floor(Math.random() * events.length)] : null;
    const eventId = eventDef ? eventDef.id : 'voyageur_bless';

    const title = I18n.t(`event.${eventId}.title`) || 'Événement';
    const desc  = I18n.t(`event.${eventId}.desc`)  || '';
    const choiceDefs = (eventDef && eventDef.choices) || [];
    const numChoices = Math.min(3, choiceDefs.length);

    const choices = [];
    for (let i = 0; i < numChoices; i++) {
      const label = I18n.t(`event.${eventId}.choice.${i}.label`) || `Choix ${i + 1}`;
      choices.push({ idx: i, label, def: choiceDefs[i] });
    }

    this.el.innerHTML = `
      <div class="event-content" style="
        flex:1; display:flex; flex-direction:column; align-items:center;
        padding:40px 20px; gap:24px; max-width:640px; margin:0 auto; width:100%;
        background:radial-gradient(ellipse at top, #1a0a2e 0%, #0a0a14 60%);
      ">
        <h1 class="event-title" style="
          font-family:var(--font-display); font-size:var(--text-2xl);
          color:var(--color-accent); text-align:center;
        ">${this._esc(title)}</h1>

        <p class="event-desc" style="
          font-size:var(--text-base); color:var(--color-text-dim);
          line-height:1.7; text-align:center;
        ">${this._esc(desc)}</p>

        <div class="event-choices" id="event-choices" style="width:100%; display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    `;

    const choicesEl = document.getElementById('event-choices');
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'event-choice-btn';
      btn.style.cssText = `
        width:100%; padding:14px 20px;
        background:var(--color-panel); border:1px solid var(--color-border);
        border-radius:8px; color:var(--color-text);
        font-size:var(--text-base); text-align:left; cursor:pointer;
        transition:background 0.15s, border-color 0.15s;
      `;
      btn.textContent = choice.label;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--color-panel-hover)';
        btn.style.borderColor = 'var(--color-accent)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--color-panel)';
        btn.style.borderColor = 'var(--color-border)';
      });
      btn.addEventListener('click', () => this._resolveEvent(eventId, choice));
      choicesEl.appendChild(btn);
    }
  }

  _resolveEvent(eventId, choice) {
    const def = choice.def;
    let outcomeKey = 'nothing';

    if (def && def.outcomes && def.outcomes.length > 0) {
      const total = def.outcomes.reduce((s, o) => s + (o.weight || 1), 0);
      let r = Math.random() * total;
      for (const o of def.outcomes) {
        r -= (o.weight || 1);
        if (r <= 0) { outcomeKey = o.id; break; }
      }
    }

    const resultText = I18n.t(`event.${eventId}.choice.${choice.idx}.result.${outcomeKey}`)
      || I18n.t(`event.${eventId}.choice.${choice.idx}.result.nothing`)
      || 'Vous continuez votre chemin.';

    // Apply effects
    if (def && def.outcomes) {
      const outcome = def.outcomes.find(o => o.id === outcomeKey);
      if (outcome) this._applyEventEffects(outcome.effects || []);
    }

    // Show result then go to map
    const choicesEl = document.getElementById('event-choices');
    if (choicesEl) {
      choicesEl.innerHTML = `
        <div class="event-result" style="
          padding:16px 20px; background:var(--color-panel);
          border:1px solid var(--color-border); border-radius:8px;
          color:var(--color-text-dim); line-height:1.6; font-size:var(--text-sm);
        ">${this._esc(resultText)}</div>
        <button class="btn btn--primary" id="event-continue" style="align-self:flex-end; margin-top:8px;">
          Continuer →
        </button>
      `;
      document.getElementById('event-continue').addEventListener('click', () => Engine.showScreen('map'));
    }
  }

  _applyEventEffects(effects) {
    const run  = Save.getCurrentRun();
    const char = Save.getCurrentChar();
    for (const effect of effects) {
      if (effect.type === 'add_gold' && run) {
        const [min, max] = Array.isArray(effect.value) ? effect.value : [effect.value, effect.value];
        run.gold = (run.gold || 0) + Math.floor(Math.random() * (max - min + 1)) + min;
        Save.saveRunState(run);
      }
    }
  }

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.ResultScreen = ResultScreen;
})();
