/**
 * UI du combat
 *
 * Nouveau layout "scène" :
 *   - Fond de terrain (placeholder rectangle, remplaçable par image)
 *   - Héros à gauche (sprite placeholder + infos)
 *   - Ennemi(s) à droite (sprite placeholder + intention + infos)
 *   - Les sprites changent visuellement selon HP / statuts
 *   - Main de cartes en bas
 */

class BattleUI {
    constructor() {
        // Battlefield
        this.heroSpriteEl = document.getElementById("hero-sprite");
        this.heroEmojiEl = document.getElementById("hero-emoji");
        this.heroNameEl = document.getElementById("hero-name-label");
        this.heroHpFillEl = document.getElementById("hero-hp-fill");
        this.heroHpTextEl = document.getElementById("hero-hp-text");
        this.heroBlockEl = document.getElementById("hero-block");
        this.heroStatusesEl = document.getElementById("hero-statuses");

        this.enemySpriteEl = document.getElementById("enemy-sprite");
        this.enemyEmojiEl = document.getElementById("enemy-emoji");
        this.enemyNameEl = document.getElementById("enemy-name-label");
        this.enemyHpFillEl = document.getElementById("enemy-hp-fill");
        this.enemyHpTextEl = document.getElementById("enemy-hp-text");
        this.enemyBlockEl = document.getElementById("enemy-block");
        this.enemyStatusesEl = document.getElementById("enemy-statuses");
        this.enemyIntentEl = document.getElementById("enemy-intent");

        // Player zone
        this.handEl = document.getElementById("hand");
        this.energyDisplayEl = document.getElementById("energy-display");
        this.pileInfoEl = document.getElementById("pile-info");
        this.logEl = document.getElementById("battle-log");
        this.btnEndTurn = document.getElementById("btn-end-turn");

        this.battleState = null;
    }

    bind(battleState) {
        this.battleState = battleState;

        battleState.onStateChange = () => this.render();
        battleState.onLog = (msg) => this.showLog(msg);
        battleState.onCardPlayed = (card, idx) => this.onCardPlayed(card, idx);
        battleState.onEnemyAction = (type) => this.onEnemyAction(type);
        battleState.onGameOver = (result) => this.onGameOver(result);
        battleState.onDamagePopup = (target, value, type) => this.showDamagePopup(target, value, type);
    }

    render() {
        if (!this.battleState) return;

        this.renderHero();
        this.renderEnemy();
        this.renderHand();
        this.renderEnergy();
        this.renderPileInfo();

        this.btnEndTurn.disabled = !this.battleState.isPlayerTurn || this.battleState.isGameOver;
    }

    // === Héros (gauche) ===

    renderHero() {
        const player = this.battleState.player;
        const hpPercent = (player.hp / player.maxHp) * 100;
        const hpClass = hpPercent > 60 ? "hp-high" : hpPercent > 30 ? "hp-mid" : "hp-low";

        // Emoji héros
        const hero = getHeroById(player.heroId);
        this.heroEmojiEl.textContent = hero ? hero.art : "⚔️";

        // Nom
        this.heroNameEl.textContent = player.name;

        // HP bar
        this.heroHpFillEl.style.width = `${hpPercent}%`;
        this.heroHpFillEl.className = `bf-hp-fill ${hpClass}`;
        this.heroHpTextEl.textContent = `${player.hp} / ${player.maxHp}`;

        // Block
        this.heroBlockEl.textContent = player.block > 0 ? `🛡️ ${player.block}` : "";

        // Classes visuelles sur le sprite
        this.heroSpriteEl.className = "bf-char-sprite";
        this.heroSpriteEl.classList.add(hpClass);
        if (player.block > 0) this.heroSpriteEl.classList.add("has-block");
        if (EffectProcessor.getStatusValue(player, "poison") > 0) this.heroSpriteEl.classList.add("is-poisoned");
        if (EffectProcessor.getStatusValue(player, "weakness") > 0) this.heroSpriteEl.classList.add("is-weak");

        // Statuts
        this.heroStatusesEl.innerHTML = this.renderStatuses(player);
    }

    // === Ennemi (droite) ===

    renderEnemy() {
        const enemy = this.battleState.enemy;
        const hpPercent = (enemy.hp / enemy.maxHp) * 100;
        const hpClass = hpPercent > 60 ? "hp-high" : hpPercent > 30 ? "hp-mid" : "hp-low";

        // Emoji
        this.enemyEmojiEl.textContent = enemy.art;

        // Nom
        this.enemyNameEl.textContent = enemy.name;

        // HP bar
        this.enemyHpFillEl.style.width = `${hpPercent}%`;
        this.enemyHpFillEl.className = `bf-hp-fill ${hpClass}`;
        this.enemyHpTextEl.textContent = `${enemy.hp} / ${enemy.maxHp}`;

        // Block
        this.enemyBlockEl.textContent = enemy.block > 0 ? `🛡️ ${enemy.block}` : "";

        // Classes visuelles sur le sprite
        this.enemySpriteEl.className = "bf-char-sprite";
        this.enemySpriteEl.id = "enemy-sprite";
        this.enemySpriteEl.classList.add(hpClass);
        if (enemy.block > 0) this.enemySpriteEl.classList.add("has-block");
        if (EffectProcessor.getStatusValue(enemy, "poison") > 0) this.enemySpriteEl.classList.add("is-poisoned");
        if (EffectProcessor.getStatusValue(enemy, "weakness") > 0) this.enemySpriteEl.classList.add("is-weak");

        // Statuts
        this.enemyStatusesEl.innerHTML = this.renderStatuses(enemy);

        // Intention
        this.renderIntent();
    }

    renderIntent() {
        const enemy = this.battleState.enemy;

        if (!enemy.currentIntent || !this.battleState.isPlayerTurn) {
            this.enemyIntentEl.className = "bf-enemy-intent intent-hidden";
            this.enemyIntentEl.textContent = "";
            return;
        }

        const intentType = EnemyAI.getIntentType(enemy.currentIntent);
        const intentText = EnemyAI.getIntentDisplay(enemy, this.battleState.player, enemy.currentIntent);
        this.enemyIntentEl.className = `bf-enemy-intent intent-${intentType}`;
        this.enemyIntentEl.textContent = intentText;
    }

    renderStatuses(entity) {
        let html = "";
        if (!entity.statuses) return html;
        for (const [status, value] of Object.entries(entity.statuses)) {
            if (value > 0 && StatusTypes[status]) {
                html += `<span class="status-badge ${status}">${StatusTypes[status].icon} ${value}</span>`;
            }
        }
        return html;
    }

    // === Main ===

    renderHand() {
        const handCards = this.battleState.hand;

        // Build map of existing DOM elements by instanceId
        const existingEls = {};
        for (const el of Array.from(this.handEl.children)) {
            const iid = el.dataset.instanceId;
            if (iid !== undefined) {
                existingEls[iid] = el;
            }
        }

        // Build set of instanceIds currently in hand
        const currentIds = new Set(handCards.map(c => String(c._instanceId)));

        // Remove cards no longer in hand
        for (const [iid, el] of Object.entries(existingEls)) {
            if (!currentIds.has(iid)) {
                // If already playing an animation (card was played), just let it finish then remove
                if (el.classList.contains("playing")) {
                    setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
                } else {
                    // Discarded/other removal - subtle exit
                    el.classList.add("leaving");
                    el.addEventListener("animationend", () => el.remove(), { once: true });
                    setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
                }
            }
        }

        // Update or create cards in correct order
        handCards.forEach((card, index) => {
            const iid = String(card._instanceId);
            let cardEl = existingEls[iid];

            if (cardEl) {
                // Card already exists - update playability and index without re-creating
                const playable = this.battleState.canPlayCard(card);
                cardEl.classList.toggle("unplayable", !playable);
                cardEl.dataset.index = index;
                cardEl.classList.remove("drawing");
                cardEl.style.animationDelay = "";

                // Update description if values changed (damage calculations)
                const descEl = cardEl.querySelector(".card-description");
                if (descEl) {
                    descEl.textContent = this.battleState.getCardDescription(card);
                }

                // Ensure it's in the right position in DOM
                this.handEl.appendChild(cardEl);
            } else {
                // New card - create with draw animation
                const playable = this.battleState.canPlayCard(card);
                cardEl = CardRenderer.createCardElement(card, {
                    playable,
                    index,
                    battleState: this.battleState,
                    onClick: () => this.onCardClickByInstanceId(iid)
                });
                cardEl.dataset.instanceId = iid;
                CardRenderer.animateDraw(cardEl, index * 80);
                this.handEl.appendChild(cardEl);
            }
        });
    }

    renderEnergy() {
        this.energyDisplayEl.innerHTML = `
            <div class="energy-orb">${this.battleState.energy}</div>
            <span>/ ${this.battleState.maxEnergy}</span>
        `;
    }

    renderPileInfo() {
        this.pileInfoEl.innerHTML = `
            <span class="pile-count" title="Pioche">🃏 ${this.battleState.drawPile.length}</span>
            <span class="pile-count" title="Défausse">♻️ ${this.battleState.discardPile.length}</span>
            <span class="pile-count" title="Exile">🔥 ${this.battleState.exhaustPile.length}</span>
        `;
    }

    // === Interactions ===

    onCardClickByInstanceId(instanceId) {
        if (!this.battleState || !this.battleState.isPlayerTurn) return;

        // Find the actual hand index by instanceId
        const handIndex = this.battleState.hand.findIndex(c => String(c._instanceId) === instanceId);
        if (handIndex === -1) return;

        const card = this.battleState.hand[handIndex];
        if (!card || !this.battleState.canPlayCard(card)) return;

        // Animation lunge du héros
        this.heroSpriteEl.classList.add("attacking");
        setTimeout(() => this.heroSpriteEl.classList.remove("attacking"), 400);

        // Find the card element by instanceId
        const cardEl = this.handEl.querySelector(`[data-instance-id="${instanceId}"]`);
        if (cardEl) {
            CardRenderer.animatePlay(cardEl).then(() => {
                this.battleState.playCard(handIndex);
            });
        } else {
            this.battleState.playCard(handIndex);
        }
    }

    onCardPlayed(card, index) {
        // Re-rendu via onStateChange
    }

    onEnemyAction(type) {
        if (type === "attack") {
            // Animation lunge ennemi
            this.enemySpriteEl.classList.add("attacking");
            setTimeout(() => this.enemySpriteEl.classList.remove("attacking"), 400);

            // Shake héros
            setTimeout(() => {
                this.heroSpriteEl.classList.add("damaged");
                setTimeout(() => this.heroSpriteEl.classList.remove("damaged"), 300);
            }, 200);
        }
    }

    onGameOver(result) {
        setTimeout(() => {
            const resultTitle = document.getElementById("result-title");
            const resultStats = document.getElementById("result-stats");

            resultTitle.textContent = result === "victory" ? "Victoire !" : "Défaite...";
            resultTitle.className = result;

            resultStats.innerHTML = `
                <p>Tours joués: ${this.battleState.turn}</p>
                <p>PV restants: ${this.battleState.player.hp} / ${this.battleState.player.maxHp}</p>
                <p>Cartes jouées: ${this.battleState.discardPile.length + this.battleState.exhaustPile.length}</p>
            `;

            game.showScreen("result");
        }, 1000);
    }

    // === Log ===

    showLog(message) {
        this.logEl.textContent = message;
        this.logEl.style.animation = "none";
        this.logEl.offsetHeight;
        this.logEl.style.animation = "fadeIn 0.3s ease";
    }

    // === Damage popup ===

    showDamagePopup(target, value, type) {
        if (value <= 0) return;

        const popup = document.createElement("div");
        popup.className = `damage-popup ${type}`;
        popup.textContent = type === "heal" ? `+${value}` : `-${value}`;

        const spriteEl = target === "enemy" ? this.enemySpriteEl : this.heroSpriteEl;
        if (spriteEl) {
            const rect = spriteEl.getBoundingClientRect();
            popup.style.left = `${rect.left + rect.width / 2 - 20}px`;
            popup.style.top = `${rect.top + 20}px`;

            if ((type === "damage" || type === "poison") && target === "enemy") {
                this.enemySpriteEl.classList.add("damaged");
                setTimeout(() => this.enemySpriteEl.classList.remove("damaged"), 300);
            }
        }

        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    // === Turn banner ===

    showTurnBanner(text) {
        const banner = document.createElement("div");
        banner.className = "turn-banner";
        banner.textContent = text;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 1000);
    }
}
