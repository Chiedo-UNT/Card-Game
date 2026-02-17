/**
 * UI du combat
 *
 * Gère l'affichage de l'état du combat : main, ennemi, stats, log, popups.
 */

class BattleUI {
    constructor() {
        this.handEl = document.getElementById("hand");
        this.enemyDisplayEl = document.getElementById("enemy-display");
        this.playerStatsEl = document.getElementById("player-stats");
        this.energyDisplayEl = document.getElementById("energy-display");
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

        this.renderHand();
        this.renderEnemy();
        this.renderPlayerStats();
        this.renderEnergy();
        this.renderPileInfo();

        // Disable end turn if not player's turn
        this.btnEndTurn.disabled = !this.battleState.isPlayerTurn || this.battleState.isGameOver;
    }

    renderHand() {
        this.handEl.innerHTML = "";

        this.battleState.hand.forEach((card, index) => {
            const playable = this.battleState.canPlayCard(card);
            const cardEl = CardRenderer.createCardElement(card, {
                playable,
                index,
                battleState: this.battleState,
                onClick: (idx) => this.onCardClick(idx)
            });
            CardRenderer.animateDraw(cardEl, index * 80);
            this.handEl.appendChild(cardEl);
        });
    }

    renderEnemy() {
        this.enemyDisplayEl.innerHTML = "";

        const enemy = this.battleState.enemy;
        const hpPercent = (enemy.hp / enemy.maxHp) * 100;

        // Intent
        let intentHtml = "";
        if (enemy.currentIntent && this.battleState.isPlayerTurn) {
            const intentType = EnemyAI.getIntentType(enemy.currentIntent);
            const intentText = EnemyAI.getIntentDisplay(enemy, this.battleState.player, enemy.currentIntent);
            intentHtml = `<div class="enemy-intent intent-${intentType}">${intentText}</div>`;
        }

        // Block
        const blockHtml = enemy.block > 0
            ? `<div class="enemy-block-display">${enemy.block}</div>`
            : "";

        // Statuses
        let statusHtml = "";
        if (enemy.statuses) {
            for (const [status, value] of Object.entries(enemy.statuses)) {
                if (value > 0 && StatusTypes[status]) {
                    statusHtml += `<span class="status-badge ${status}">${StatusTypes[status].icon} ${value}</span>`;
                }
            }
        }

        const enemyEl = document.createElement("div");
        enemyEl.className = "enemy-card";
        enemyEl.innerHTML = `
            ${intentHtml}
            <div class="enemy-sprite" id="enemy-sprite">
                ${blockHtml}
                ${enemy.art}
            </div>
            <div class="enemy-hp-bar">
                <div class="enemy-hp-fill" style="width: ${hpPercent}%"></div>
            </div>
            <div class="enemy-hp-text">${enemy.hp} / ${enemy.maxHp}</div>
            <div class="enemy-name-label">${enemy.name}</div>
            <div class="enemy-statuses">${statusHtml}</div>
        `;

        this.enemyDisplayEl.appendChild(enemyEl);
    }

    renderPlayerStats() {
        const player = this.battleState.player;

        let statusHtml = "";
        if (player.statuses) {
            for (const [status, value] of Object.entries(player.statuses)) {
                if (value > 0 && StatusTypes[status]) {
                    statusHtml += `<span class="status-badge ${status}">${StatusTypes[status].icon} ${value}</span>`;
                }
            }
        }

        this.playerStatsEl.innerHTML = `
            <div class="stat health">
                <span class="stat-icon">❤️</span>
                <span class="stat-value">${player.hp} / ${player.maxHp}</span>
            </div>
            <div class="stat block">
                <span class="stat-icon">🛡️</span>
                <span class="stat-value">${player.block}</span>
            </div>
            <div class="status-effects">${statusHtml}</div>
        `;
    }

    renderEnergy() {
        this.energyDisplayEl.innerHTML = `
            <div class="energy-orb">${this.battleState.energy}</div>
            <span>/ ${this.battleState.maxEnergy}</span>
        `;
    }

    renderPileInfo() {
        // Supprimer l'ancien
        const existing = document.querySelector(".pile-info");
        if (existing) existing.remove();

        const pileEl = document.createElement("div");
        pileEl.className = "pile-info";
        pileEl.innerHTML = `
            <span class="pile-count" title="Pioche">🃏 Pioche: ${this.battleState.drawPile.length}</span>
            <span class="pile-count" title="Défausse">♻️ Défausse: ${this.battleState.discardPile.length}</span>
            <span class="pile-count" title="Exile">🔥 Exile: ${this.battleState.exhaustPile.length}</span>
        `;

        const playerZone = document.querySelector(".player-zone");
        playerZone.insertBefore(pileEl, playerZone.querySelector(".hand"));
    }

    // === Interactions ===

    onCardClick(handIndex) {
        if (!this.battleState || !this.battleState.isPlayerTurn) return;

        const card = this.battleState.hand[handIndex];
        if (!card || !this.battleState.canPlayCard(card)) return;

        // Animation de jeu
        const cardEls = this.handEl.querySelectorAll(".card");
        const cardEl = cardEls[handIndex];
        if (cardEl) {
            CardRenderer.animatePlay(cardEl).then(() => {
                this.battleState.playCard(handIndex);
            });
        } else {
            this.battleState.playCard(handIndex);
        }
    }

    onCardPlayed(card, index) {
        // Re-rendu sera fait par onStateChange
    }

    onEnemyAction(type) {
        const sprite = document.getElementById("enemy-sprite");
        if (sprite && type === "attack") {
            sprite.classList.add("damaged");
            setTimeout(() => sprite.classList.remove("damaged"), 300);
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
        this.logEl.offsetHeight; // force reflow
        this.logEl.style.animation = "fadeIn 0.3s ease";
    }

    // === Damage popup ===

    showDamagePopup(target, value, type) {
        if (value <= 0) return;

        const popup = document.createElement("div");
        popup.className = `damage-popup ${type}`;
        popup.textContent = type === "heal" ? `+${value}` : `-${value}`;

        // Position
        if (target === "enemy") {
            const enemySprite = document.getElementById("enemy-sprite");
            if (enemySprite) {
                const rect = enemySprite.getBoundingClientRect();
                popup.style.left = `${rect.left + rect.width / 2 - 20}px`;
                popup.style.top = `${rect.top}px`;

                // Shake l'ennemi quand il prend des dégâts
                if (type === "damage" || type === "poison") {
                    enemySprite.classList.add("damaged");
                    setTimeout(() => enemySprite.classList.remove("damaged"), 300);
                }
            }
        } else {
            const statsEl = this.playerStatsEl;
            if (statsEl) {
                const rect = statsEl.getBoundingClientRect();
                popup.style.left = `${rect.left + 50}px`;
                popup.style.top = `${rect.top}px`;
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
