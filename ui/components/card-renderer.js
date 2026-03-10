// ui/components/card-renderer.js
// Renders card data as DOM elements with 3D CSS parallax effects.

(function () {
class CardRenderer {
  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a full-size card DOM element.
   * @param {object} cardData  - { id, rarity, tags, cost, effects, portee, forme, forgeable, requires, ... }
   * @param {object} options   - { size: 'normal'|'small'|'large', interactive: bool, showTags: bool }
   * @returns {HTMLElement}
   */
  static create(cardData, options = {}) {
    const size        = options.size        || 'normal';
    const interactive = options.interactive !== false;
    const showTags    = options.showTags    !== false;

    const el = document.createElement('div');
    el.className = [
      'card',
      `card-${(cardData.rarity || 'common').toLowerCase()}`,
      `card-size-${size}`,
    ].join(' ');
    el.dataset.cardId = cardData.id;

    // Resolve translated strings with a fallback to the raw id so missing
    // translations don't crash the renderer.
    const name = CardRenderer._safeT(`card.${cardData.id}.name`, cardData.id);
    const desc = CardRenderer._safeT(`card.${cardData.id}.desc`, '');

    const costs  = cardData.cost  || {};
    const tags   = cardData.tags  || [];
    const portee = cardData.portee || null;

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-face-front">

          <div class="card-header">
            <span class="card-name" title="${CardRenderer._esc(name)}">${CardRenderer._esc(name)}</span>
            <div class="card-costs">
              ${costs.initiative != null ? `<span class="cost cost-init" title="Initiative">${costs.initiative}</span>` : ''}
              ${costs.mana       != null ? `<span class="cost cost-mana" title="Mana">${costs.mana}</span>` : ''}
              ${costs.endurance  != null ? `<span class="cost cost-end"  title="Endurance">${costs.endurance}</span>` : ''}
            </div>
          </div>

          <div class="card-art">
            <div class="card-art-placeholder card-type-${CardRenderer._esc(CardRenderer._primaryType(tags))}"></div>
          </div>

          <div class="card-body">
            <p class="card-desc">${CardRenderer._esc(desc)}</p>

            ${showTags && tags.length > 0 ? `
              <div class="card-tags">
                ${tags.map(t => `<span class="tag tag-${CardRenderer._esc(t.toLowerCase().replace(/\s+/g, '-'))}">${CardRenderer._esc(t)}</span>`).join('')}
              </div>
            ` : ''}

            ${portee ? `
              <div class="card-portee">
                <span class="portee-icon">&#9889;</span>
                <span class="portee-range">${portee.min}&ndash;${portee.max}</span>
                ${cardData.forme ? `<span class="portee-forme">${CardRenderer._esc(cardData.forme)}</span>` : ''}
              </div>
            ` : ''}

            ${cardData.forgeable ? `<div class="card-forgeable" title="Forgeable">&#9775;</div>` : ''}
          </div>

          <div class="card-footer">
            <span class="card-rarity card-rarity-${(cardData.rarity || 'common').toLowerCase()}">
              ${CardRenderer._rarityStars(cardData.rarity)}
            </span>
          </div>

        </div><!-- /.card-face-front -->
      </div><!-- /.card-inner -->
    `;

    if (interactive) {
      CardRenderer._addParallax(el);
      CardRenderer._addTooltip(el, cardData);
    }

    return el;
  }

  /**
   * Create a compact card thumbnail (for collection grid, merchant shop, deck list).
   * @param {object} cardData
   * @returns {HTMLElement}
   */
  static createSmall(cardData) {
    const el = document.createElement('div');
    el.className = [
      'card',
      'card-small',
      `card-${(cardData.rarity || 'common').toLowerCase()}`,
    ].join(' ');
    el.dataset.cardId = cardData.id;

    const name  = CardRenderer._safeT(`card.${cardData.id}.name`, cardData.id);
    const costs = cardData.cost || {};
    const tags  = cardData.tags || [];

    el.innerHTML = `
      <div class="card-small-inner">
        <div class="card-small-header">
          <span class="card-name">${CardRenderer._esc(name)}</span>
          <div class="card-costs">
            ${costs.initiative != null ? `<span class="cost cost-init">${costs.initiative}</span>` : ''}
            ${costs.mana       != null ? `<span class="cost cost-mana">${costs.mana}</span>` : ''}
            ${costs.endurance  != null ? `<span class="cost cost-end">${costs.endurance}</span>` : ''}
          </div>
        </div>
        <div class="card-small-art card-type-${CardRenderer._esc(CardRenderer._primaryType(tags))}"></div>
      </div>
    `;

    CardRenderer._addTooltip(el, cardData);
    return el;
  }

  /**
   * Toggle the playable/unplayable visual state of a card element.
   * @param {HTMLElement} el
   * @param {boolean}     canPlay
   */
  static setPlayable(el, canPlay) {
    el.classList.toggle('card-playable',   canPlay);
    el.classList.toggle('card-unplayable', !canPlay);
  }

  /**
   * Animate a card being played: it flies from its current position to `targetPos`
   * and then shrinks away.
   * @param {HTMLElement}          cardEl
   * @param {{ x: number, y: number }} targetPos  - pixel coordinates in the viewport
   * @param {function}             onComplete
   */
  static animatePlay(cardEl, targetPos, onComplete) {
    const rect = cardEl.getBoundingClientRect();
    const startX = rect.left + rect.width  / 2;
    const startY = rect.top  + rect.height / 2;

    // Create a flying clone so the original can be removed immediately from the hand.
    const clone = cardEl.cloneNode(true);
    clone.style.cssText = `
      position: fixed;
      left: ${startX - rect.width / 2}px;
      top:  ${startY - rect.height / 2}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      pointer-events: none;
      z-index: 9999;
      transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  top  0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.35s ease;
    `;
    document.body.appendChild(clone);

    // Trigger the fly after a frame so the initial position is applied.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dx = targetPos.x - startX;
        const dy = targetPos.y - startY;
        clone.style.left    = `${startX - rect.width / 2 + dx}px`;
        clone.style.top     = `${startY - rect.height / 2 + dy}px`;
        clone.style.transform = 'scale(0.3) rotate(15deg)';
        clone.style.opacity   = '0';
      });
    });

    clone.addEventListener('transitionend', () => {
      clone.remove();
      if (typeof onComplete === 'function') onComplete();
    }, { once: true });
  }

  /**
   * Animate a card being drawn (slides in from the right).
   * @param {HTMLElement} cardEl
   * @param {function}    onComplete
   */
  static animateDraw(cardEl, onComplete) {
    cardEl.classList.add('card-drawing');
    cardEl.style.transform = 'translateX(120px) scale(0.8)';
    cardEl.style.opacity   = '0';
    cardEl.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease';
        cardEl.style.transform  = '';
        cardEl.style.opacity    = '';
      });
    });

    const cleanup = () => {
      cardEl.classList.remove('card-drawing');
      cardEl.style.transition = '';
      if (typeof onComplete === 'function') onComplete();
    };

    cardEl.addEventListener('transitionend', cleanup, { once: true });

    // Safety timeout in case transitionend never fires.
    setTimeout(cleanup, 600);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Mouse-move parallax 3D tilt effect.
   * @param {HTMLElement} el
   */
  static _addParallax(el) {
    const inner = () => el.querySelector('.card-inner');

    el.addEventListener('mouseenter', () => {
      const i = inner();
      if (i) i.style.transition = 'transform 0.1s ease';
    });

    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left)  / rect.width  - 0.5;
      const y = (e.clientY - rect.top)   / rect.height - 0.5;
      const i = inner();
      if (i) {
        i.style.transition = '';
        i.style.transform  = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg) scale(1.04)`;
      }
    });

    el.addEventListener('mouseleave', () => {
      const i = inner();
      if (i) {
        i.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        i.style.transform  = '';
      }
    });
  }

  /**
   * Attach a lightweight tooltip showing the full card description on hover.
   * @param {HTMLElement} el
   * @param {object}      cardData
   */
  static _addTooltip(el, cardData) {
    const desc = CardRenderer._safeT(`card.${cardData.id}.desc`, '');
    if (!desc) return;

    el.addEventListener('mouseenter', e => {
      const existing = document.getElementById('card-renderer-tooltip');
      if (existing) existing.remove();

      const tip = document.createElement('div');
      tip.id        = 'card-renderer-tooltip';
      tip.className = 'card-tooltip';
      tip.innerHTML = `
        <strong>${CardRenderer._esc(CardRenderer._safeT(`card.${cardData.id}.name`, cardData.id))}</strong>
        <p>${CardRenderer._esc(desc)}</p>
        ${cardData.portee ? `<small>Port&#233;e: ${cardData.portee.min}&ndash;${cardData.portee.max}</small>` : ''}
      `;

      document.body.appendChild(tip);
      CardRenderer._positionTooltip(tip, e);
    });

    el.addEventListener('mousemove', e => {
      const tip = document.getElementById('card-renderer-tooltip');
      if (tip) CardRenderer._positionTooltip(tip, e);
    });

    el.addEventListener('mouseleave', () => {
      const tip = document.getElementById('card-renderer-tooltip');
      if (tip) tip.remove();
    });
  }

  static _positionTooltip(tip, e) {
    const margin  = 12;
    const tipW    = tip.offsetWidth  || 200;
    const tipH    = tip.offsetHeight || 80;
    const vw      = window.innerWidth;
    const vh      = window.innerHeight;

    let left = e.clientX + margin;
    let top  = e.clientY + margin;

    if (left + tipW > vw - margin) left = e.clientX - tipW - margin;
    if (top  + tipH > vh - margin) top  = e.clientY - tipH - margin;

    tip.style.left = `${Math.max(margin, left)}px`;
    tip.style.top  = `${Math.max(margin, top)}px`;
  }

  /**
   * Derive the primary visual type from the card's tag list.
   * @param {string[]} tags
   * @returns {string}
   */
  static _primaryType(tags) {
    if (!Array.isArray(tags)) return 'neutral';
    if (tags.includes('Attaque'))  return 'attack';
    if (tags.includes('Défense'))  return 'defense';
    if (tags.includes('Defense'))  return 'defense';
    if (tags.includes('Skill'))    return 'skill';
    if (tags.includes('Objet'))    return 'item';
    if (tags.includes('Magie'))    return 'magic';
    if (tags.includes('Soin'))     return 'heal';
    return 'neutral';
  }

  /**
   * Return star characters representing rarity.
   * @param {string} rarity
   * @returns {string}
   */
  static _rarityStars(rarity) {
    const map = {
      common:    '&#9733;',
      uncommon:  '&#9733;&#9733;',
      rare:      '&#9733;&#9733;&#9733;',
      epic:      '&#9733;&#9733;&#9733;&#9733;',
      legendary: '&#9733;&#9733;&#9733;&#9733;&#9733;',
    };
    return map[(rarity || 'common').toLowerCase()] || '&#9733;';
  }

  /**
   * Safely call I18n.t(), returning fallback if the key has no translation.
   * @param {string} key
   * @param {string} fallback
   * @returns {string}
   */
  static _safeT(key, fallback = '') {
    if (!window.I18n) return fallback;
    const result = window.I18n.t(key);
    // I18n.t returns the key itself when not found.
    return (result && result !== key) ? result : fallback;
  }

  /**
   * Escape a string for safe insertion as text content inside innerHTML.
   * @param {string} str
   * @returns {string}
   */
  static _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

window.CardRenderer = CardRenderer;
})();
