/**
 * UI de la collection et du Deck Builder
 *
 * - Gauche : cartes de la collection avec un bouton ↓ pour ajouter au deck
 * - Droite : cartes du deck avec un bouton ↑ pour retirer du deck
 * - Sélecteur de héros pour filtrer et choisir le deck à éditer
 * - Le deck custom est sauvegardé par héros dans game.customDecks
 */

class CollectionUI {
    constructor() {
        this.gridEl = document.getElementById("collection-grid");
        this.filtersEl = document.querySelector(".collection-filters");
        this.deckListEl = document.getElementById("deck-builder-list");
        this.deckCountEl = document.getElementById("deck-count");
        this.heroSelectEl = document.getElementById("deck-hero-select");
        this.btnReset = document.getElementById("btn-reset-deck");

        this.currentFilter = "all";
        this.selectedHero = null;
    }

    init() {
        this.renderHeroSelect();
        this.renderFilters();

        // Sélectionner le premier héros par défaut
        if (!this.selectedHero && HEROES_DATA.length > 0) {
            this.selectedHero = HEROES_DATA[0].id;
            this.heroSelectEl.value = this.selectedHero;
            this.ensureDeckExists(this.selectedHero);
        }

        this.renderCards();
        this.renderDeck();

        // Events
        this.heroSelectEl.addEventListener("change", (e) => {
            this.selectedHero = e.target.value;
            this.ensureDeckExists(this.selectedHero);
            this.renderCards();
            this.renderDeck();
        });

        this.btnReset.addEventListener("click", () => {
            this.resetDeck();
        });
    }

    renderHeroSelect() {
        this.heroSelectEl.innerHTML = "";
        for (const hero of HEROES_DATA) {
            const opt = document.createElement("option");
            opt.value = hero.id;
            opt.textContent = `${hero.art} ${hero.name}`;
            this.heroSelectEl.appendChild(opt);
        }
        if (this.selectedHero) {
            this.heroSelectEl.value = this.selectedHero;
        }
    }

    renderFilters() {
        this.filtersEl.innerHTML = "";

        const filters = [
            { id: "all", label: "Toutes" },
            ...HEROES_DATA.map(h => ({ id: h.id, label: `${h.art} ${h.name}` }))
        ];

        for (const filter of filters) {
            const btn = document.createElement("button");
            btn.className = `btn btn-filter ${filter.id === this.currentFilter ? "active" : ""}`;
            btn.dataset.hero = filter.id;
            btn.textContent = filter.label;
            btn.addEventListener("click", () => {
                this.currentFilter = filter.id;
                this.renderFilters();
                this.renderCards();
            });
            this.filtersEl.appendChild(btn);
        }
    }

    renderCards() {
        this.gridEl.innerHTML = "";

        let cards;
        if (this.currentFilter === "all") {
            cards = getAllCards();
        } else {
            cards = getCardsForHero(this.currentFilter);
        }

        const currentDeck = this.getCurrentDeck();

        for (const card of cards) {
            const wrapper = document.createElement("div");
            wrapper.style.position = "relative";
            wrapper.style.display = "inline-block";

            const el = CardRenderer.createCardElement(card, { playable: true });
            el.style.cursor = "default";
            wrapper.appendChild(el);

            // Bouton flèche ↓ pour ajouter au deck
            const addBtn = document.createElement("button");
            addBtn.className = "card-add-btn";
            addBtn.innerHTML = "&#x2B07;"; // ↓
            addBtn.title = "Ajouter au deck";
            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.addCardToDeck(card.id);
            });
            wrapper.appendChild(addBtn);

            this.gridEl.appendChild(wrapper);
        }
    }

    renderDeck() {
        this.deckListEl.innerHTML = "";
        const deck = this.getCurrentDeck();

        // Compter les occurrences
        const cardCounts = {};
        const cardOrder = [];
        for (const cardId of deck) {
            if (!cardCounts[cardId]) {
                cardCounts[cardId] = 0;
                cardOrder.push(cardId);
            }
            cardCounts[cardId]++;
        }

        for (const cardId of cardOrder) {
            const card = getCardById(cardId);
            if (!card) continue;

            const count = cardCounts[cardId];

            const entry = document.createElement("div");
            entry.className = `deck-card-entry type-${card.type}`;

            const removeBtn = document.createElement("button");
            removeBtn.className = "deck-card-remove";
            removeBtn.innerHTML = "&#x2B06;"; // ↑
            removeBtn.title = "Retirer du deck";
            removeBtn.addEventListener("click", () => {
                this.removeCardFromDeck(cardId);
            });

            const costEl = document.createElement("span");
            costEl.className = "card-entry-cost";
            costEl.textContent = card.cost;

            const infoEl = document.createElement("span");
            infoEl.className = "card-entry-info";
            infoEl.textContent = `${card.art} ${card.name}${count > 1 ? ` x${count}` : ""}`;

            entry.appendChild(removeBtn);
            entry.appendChild(costEl);
            entry.appendChild(infoEl);

            this.deckListEl.appendChild(entry);
        }

        // Mettre à jour le compteur
        this.deckCountEl.textContent = `(${deck.length})`;
    }

    // === Gestion du deck ===

    ensureDeckExists(heroId) {
        if (!game.customDecks) game.customDecks = {};
        if (!game.customDecks[heroId]) {
            const hero = getHeroById(heroId);
            if (hero) {
                game.customDecks[heroId] = [...hero.startingDeck];
            }
        }
    }

    getCurrentDeck() {
        if (!this.selectedHero) return [];
        this.ensureDeckExists(this.selectedHero);
        return game.customDecks[this.selectedHero] || [];
    }

    addCardToDeck(cardId) {
        if (!this.selectedHero) return;
        this.ensureDeckExists(this.selectedHero);
        game.customDecks[this.selectedHero].push(cardId);
        this.renderDeck();
    }

    removeCardFromDeck(cardId) {
        if (!this.selectedHero) return;
        this.ensureDeckExists(this.selectedHero);
        const deck = game.customDecks[this.selectedHero];
        const idx = deck.lastIndexOf(cardId);
        if (idx !== -1) {
            deck.splice(idx, 1);
            this.renderDeck();
        }
    }

    resetDeck() {
        if (!this.selectedHero) return;
        const hero = getHeroById(this.selectedHero);
        if (hero) {
            game.customDecks[this.selectedHero] = [...hero.startingDeck];
            this.renderDeck();
        }
    }
}
