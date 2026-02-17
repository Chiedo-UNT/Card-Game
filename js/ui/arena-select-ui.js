/**
 * UI de sélection d'arène
 *
 * Permet de choisir un héros, voir son deck, et choisir un ennemi.
 */

class ArenaSelectUI {
    constructor() {
        this.heroSelectEl = document.getElementById("hero-select");
        this.deckPreviewEl = document.getElementById("deck-preview");
        this.enemySelectEl = document.getElementById("enemy-select");
        this.btnFight = document.getElementById("btn-fight");

        this.selectedHero = null;
        this.selectedEnemy = null;
    }

    init() {
        this.renderHeroes();
        this.renderEnemies();
        this.updateFightButton();
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

        // Montrer le deck
        this.renderDeckPreview(heroId);
        this.updateFightButton();
    }

    selectEnemy(enemyId) {
        this.selectedEnemy = enemyId;

        // Visual
        this.enemySelectEl.querySelectorAll(".enemy-option").forEach(el => {
            el.classList.toggle("selected", el.dataset.enemyId === enemyId);
        });

        this.updateFightButton();
    }

    renderDeckPreview(heroId) {
        this.deckPreviewEl.innerHTML = "";

        const hero = getHeroById(heroId);
        if (!hero) return;

        // Compter les cartes
        const cardCounts = {};
        for (const cardId of hero.startingDeck) {
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
        this.btnFight.disabled = !this.selectedHero || !this.selectedEnemy;
        this.btnFight.style.opacity = this.btnFight.disabled ? "0.5" : "1";
    }

    getSelection() {
        return {
            heroId: this.selectedHero,
            enemyId: this.selectedEnemy
        };
    }
}
