/**
 * UI de sélection d'arène
 *
 * Permet de choisir un héros, un deck (parmi ceux disponibles pour ce héros),
 * et un ennemi.
 */

class ArenaSelectUI {
    constructor() {
        this.heroSelectEl = document.getElementById("hero-select");
        this.deckPreviewEl = document.getElementById("deck-preview");
        this.arenaDeckSelectEl = document.getElementById("arena-deck-select");
        this.enemySelectEl = document.getElementById("enemy-select");
        this.btnFight = document.getElementById("btn-fight");

        this.selectedHero = null;
        this.selectedDeckId = null;
        this.selectedEnemy = null;
        this._eventsbound = false;
    }

    init() {
        this.renderHeroes();
        this.renderEnemies();
        this.updateFightButton();

        if (!this._eventsbound) {
            this._eventsbound = true;
            this.arenaDeckSelectEl.addEventListener("change", (e) => {
                this.selectedDeckId = e.target.value;
                this.renderDeckPreview();
                this.updateFightButton();
            });
        }
    }

    renderHeroes() {
        this.heroSelectEl.innerHTML = "";

        for (const hero of HEROES_DATA) {
            const el = document.createElement("div");
            el.className = "hero-option";
            el.dataset.heroId = hero.id;
            el.innerHTML = `
                <div class="hero-name">${hero.art} ${hero.name}</div>
                <div class="hero-desc">${hero.description}</div>
                <div class="hero-hp">❤️ ${hero.maxHp} PV | ⚡ ${hero.startingEnergy} Énergie | 🃏 ${hero.startingDraw} Pioche</div>
            `;
            el.addEventListener("click", () => this.selectHero(hero.id));
            this.heroSelectEl.appendChild(el);
        }
    }

    renderEnemies() {
        this.enemySelectEl.innerHTML = "";

        const difficulties = [
            { key: "easy", label: "Facile", color: "#2ecc71" },
            { key: "medium", label: "Moyen", color: "#f39c12" },
            { key: "hard", label: "Difficile", color: "#e74c3c" }
        ];

        for (const diff of difficulties) {
            const enemies = getEnemiesByDifficulty(diff.key);
            for (const enemy of enemies) {
                const el = document.createElement("div");
                el.className = "enemy-option";
                el.dataset.enemyId = enemy.id;
                el.innerHTML = `
                    <div class="enemy-name">${enemy.art} ${enemy.name} <span style="color:${diff.color};font-size:0.8rem">[${diff.label}]</span></div>
                    <div class="enemy-desc">${enemy.description}</div>
                    <div class="enemy-hp">❤️ ${enemy.maxHp} PV</div>
                `;
                el.addEventListener("click", () => this.selectEnemy(enemy.id));
                this.enemySelectEl.appendChild(el);
            }
        }
    }

    selectHero(heroId) {
        this.selectedHero = heroId;

        // Visual
        this.heroSelectEl.querySelectorAll(".hero-option").forEach(el => {
            el.classList.toggle("selected", el.dataset.heroId === heroId);
        });

        // Remplir le sélecteur de deck pour ce héros
        this.renderArenaDeckSelect(heroId);
        this.updateFightButton();
    }

    renderArenaDeckSelect(heroId) {
        this.arenaDeckSelectEl.innerHTML = "";

        const heroDecks = game.getDecksForHero(heroId);
        for (const deck of heroDecks) {
            const opt = document.createElement("option");
            opt.value = deck.id;
            opt.textContent = deck.name;
            this.arenaDeckSelectEl.appendChild(opt);
        }

        // Auto-select le premier
        if (heroDecks.length > 0) {
            this.selectedDeckId = heroDecks[0].id;
            this.arenaDeckSelectEl.value = this.selectedDeckId;
        } else {
            this.selectedDeckId = null;
        }

        this.renderDeckPreview();
    }

    selectEnemy(enemyId) {
        this.selectedEnemy = enemyId;

        // Visual
        this.enemySelectEl.querySelectorAll(".enemy-option").forEach(el => {
            el.classList.toggle("selected", el.dataset.enemyId === enemyId);
        });

        this.updateFightButton();
    }

    renderDeckPreview() {
        this.deckPreviewEl.innerHTML = "";

        if (!this.selectedDeckId) return;

        const deck = game.getDeckById(this.selectedDeckId);
        if (!deck) return;

        // Compter les cartes
        const cardCounts = {};
        for (const cardId of deck.cards) {
            cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
        }

        for (const [cardId, count] of Object.entries(cardCounts)) {
            const card = getCardById(cardId);
            if (!card) continue;

            const el = CardRenderer.createMiniCard(card);
            if (count > 1) {
                el.textContent += ` x${count}`;
            }
            this.deckPreviewEl.appendChild(el);
        }
    }

    updateFightButton() {
        this.btnFight.disabled = !this.selectedHero || !this.selectedEnemy || !this.selectedDeckId;
        this.btnFight.style.opacity = this.btnFight.disabled ? "0.5" : "1";
    }

    getSelection() {
        return {
            heroId: this.selectedHero,
            enemyId: this.selectedEnemy,
            deckId: this.selectedDeckId
        };
    }
}
