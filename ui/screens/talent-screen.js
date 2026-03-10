// Talent screen — lets the player invest talent points into their character trees.

(function () {
class TalentScreen {
  constructor(params = {}) {
    this.el = document.getElementById('screen-talent');
    this._params = params;
    this._activeTree = null;
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

    const trees = ['force', 'dexterite', 'intelligence', 'endurance', 'volonte', 'rapidite', 'map'];
    const totalPoints = trees.reduce((sum, tr) => sum + ((char.talentPoints && char.talentPoints[tr]) || 0), 0);

    this.el.innerHTML = `
      <div class="screen-header">
        <button class="btn btn--ghost" id="talent-back">← ${t('ui.map.title')}</button>
        <h1 class="screen-title">${t('ui.talent.title')}</h1>
        <div class="badge badge--accent">${totalPoints} ${t('ui.talent.points_available')}</div>
      </div>

      <div class="talent-layout" style="flex:1; display:grid; grid-template-columns:180px 1fr; overflow:hidden;">
        <div class="talent-tree-list" id="talent-tree-list"></div>
        <div class="talent-tree-panel" id="talent-tree-panel">
          <div class="empty-state">
            <div class="empty-state__icon">⭐</div>
            <div class="empty-state__title">${t('ui.talent.tree')}</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('talent-back').addEventListener('click', () => Engine.showScreen('map'));

    // Build tree nav
    const treeList = document.getElementById('talent-tree-list');
    for (const tree of trees) {
      const btn = document.createElement('button');
      btn.className = 'talent-tree-btn';
      btn.dataset.tree = tree;
      const pts = (char.talentPoints && char.talentPoints[tree]) || 0;
      btn.innerHTML = `${this._treeIcon(tree)} ${I18n.t(`talent.${tree}.${Object.keys(Engine._registry.talents || {}).find(k => k.startsWith(tree + '.')) || tree}`) || tree} ${pts > 0 ? `<span style="color:var(--color-accent)">(${pts})</span>` : ''}`;
      btn.textContent = `${this._treeIcon(tree)} ${this._treeName(tree)}`;

      btn.addEventListener('click', () => {
        treeList.querySelectorAll('.talent-tree-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeTree = tree;
        this._buildTreePanel(tree);
      });
      treeList.appendChild(btn);
    }

    // Auto-select first tree
    const firstBtn = treeList.querySelector('.talent-tree-btn');
    if (firstBtn) firstBtn.click();
  }

  _buildTreePanel(treeName) {
    const panel = document.getElementById('talent-tree-panel');
    if (!panel) return;
    const t = k => I18n.t(k) || k;
    const char = Save.getCurrentChar();
    if (!char) return;

    // Find the talent tree data from registry
    const talentDefs = Object.values(Engine._registry.talents || {}).find(td => td.tree === treeName);
    const pts = (char.talentPoints && char.talentPoints[treeName]) || 0;

    if (!talentDefs || !talentDefs.talents) {
      panel.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔒</div><div class="empty-state__desc">Données manquantes pour ${treeName}.</div></div>`;
      return;
    }

    panel.innerHTML = `
      <div style="padding:0 0 12px; font-size:var(--text-sm); color:var(--color-text-dim);">
        ${t('ui.talent.points_available')}: <strong style="color:var(--color-accent);">${pts}</strong>
      </div>
    `;

    for (const talent of talentDefs.talents) {
      const invested = (char.talentInvested && char.talentInvested[talent.id]) || 0;
      const isMax    = invested >= talent.maxLevel;
      const cost     = (talent.costPerLevel && talent.costPerLevel[invested]) || 1;
      const canAfford = pts >= cost;
      const prereqsMet = this._prereqsMet(talent, char);

      const nameKey = `talent.${treeName}.${talent.id}.name`;
      const descKey = `talent.${treeName}.${talent.id}.desc`;
      const name = I18n.t(nameKey) || talent.id;
      const desc = I18n.t(descKey) || '';

      const node = document.createElement('div');
      node.className = 'talent-node'
        + (isMax ? ' max-level' : invested > 0 ? ' unlocked' : '')
        + (!prereqsMet ? ' locked' : '');

      node.innerHTML = `
        <div class="talent-node__name">${this._esc(name)}</div>
        <div class="talent-node__desc">${this._esc(desc)}</div>
        <div class="talent-node__footer">
          <span class="talent-node__level">${t('ui.talent.level')} <span>${invested}</span>/${talent.maxLevel}</span>
          ${!isMax && prereqsMet
            ? `<button class="btn-talent-unlock" data-tree="${treeName}" data-id="${talent.id}" data-cost="${cost}" ${canAfford ? '' : 'disabled'}>
                ${t('ui.talent.unlock')} (${cost} pt${cost > 1 ? 's' : ''})
               </button>`
            : isMax
              ? `<span class="badge badge--success">Max</span>`
              : `<span class="badge badge--danger">${t('ui.talent.locked')}</span>`
          }
        </div>
      `;

      panel.appendChild(node);
    }

    panel.querySelectorAll('.btn-talent-unlock').forEach(btn => {
      btn.addEventListener('click', () => {
        this._investTalent(btn.dataset.tree, btn.dataset.id, parseInt(btn.dataset.cost, 10));
      });
    });
  }

  _investTalent(treeName, talentId, cost) {
    const char = Save.getCurrentChar();
    if (!char) return;
    const pts = (char.talentPoints && char.talentPoints[treeName]) || 0;
    if (pts < cost) return;

    char.talentPoints[treeName] = pts - cost;
    char.talentInvested = char.talentInvested || {};
    char.talentInvested[talentId] = (char.talentInvested[talentId] || 0) + 1;

    Save.save();
    this._buildTreePanel(treeName);
    // Refresh points badge
    const trees = ['force', 'dexterite', 'intelligence', 'endurance', 'volonte', 'rapidite', 'map'];
    const totalPoints = trees.reduce((sum, tr) => sum + ((char.talentPoints && char.talentPoints[tr]) || 0), 0);
    const badge = this.el.querySelector('.badge--accent');
    if (badge) badge.textContent = `${totalPoints} ${I18n.t('ui.talent.points_available') || 'pts'}`;
  }

  _prereqsMet(talent, char) {
    if (!talent.prerequisites || talent.prerequisites.length === 0) return true;
    return talent.prerequisites.every(prereqId => {
      const invested = (char.talentInvested && char.talentInvested[prereqId]) || 0;
      return invested >= 1;
    });
  }

  _treeName(tree) {
    const map = {
      force: 'Force', dexterite: 'Dextérité', intelligence: 'Intelligence',
      endurance: 'Endurance', volonte: 'Volonté', rapidite: 'Rapidité', map: 'Carte',
    };
    return map[tree] || tree;
  }

  _treeIcon(tree) {
    const icons = {
      force: '💪', dexterite: '🗡', intelligence: '🔮',
      endurance: '🛡', volonte: '✨', rapidite: '⚡', map: '🗺',
    };
    return icons[tree] || '';
  }

  _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.TalentScreen = TalentScreen;
})();
