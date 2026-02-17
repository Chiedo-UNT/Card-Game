/**
 * UI de la collection et du Deck Builder
 *
 * - Sélecteur de deck (défaut + custom)
 * - Bouton "+" pour créer un nouveau deck (modale nom + héros)
 * - Bouton "×" pour supprimer un deck custom (grisé sur les decks par défaut)
 * - Gauche : cartes de la collection avec bouton ↓ pour ajouter au deck
 * - Droite : cartes du deck avec bouton ↑ pour retirer
 */

class CollectionUI {
    constructor() {
        this.gridEl = document.getElementById("collection-grid");
        this.filtersEl = document.querySelector(".collection-filters");
        this.deckListEl = document.getElementById("deck-builder-list");
        this.deckCountEl = document.getElementById("deck-count");
        this.deckSelectEl = document.getElementById("deck-select");
        this.btnNewDeck = document.getElementById("btn-new-deck");
        this.btnDeleteDeck = document.getElementById("btn-delete-deck");
        this.btnReset = document.getElementById("btn-reset-deck");

        // Modale
        this.modalEl = document.getElementById("modal-new-deck");
        this.inputName = document.getElementById("new-deck-name");
        this.inputHero = document.getElementById("new-deck-hero");
        this.btnConfirm = document.getElementById("btn-confirm-deck");
        this.btnCancel = document.getElementById("btn-cancel-deck");

        this.currentFilter = "all";
        this.selectedDeckId = null;
        this._eventsbound = false;
    }

    init() {
        this.renderFilters();
        this.renderDeckSelect();

        // Sélectionner le premier deck par défaut
        if (!this.selectedDeckId && game.decks.length > 0) {
            this.selectedDeckId = game.decks[0].id;
            this.deckSelectEl.value = this.selectedDeckId;
        }

        this.renderCards();
        this.renderDeck();
        this.updateDeleteButton();

        if (!this._eventsbound) {
            this._eventsbound = true;
            this.bindEvents();
        }
    }

    bindEvents() {
        // Changement de deck
        this.deckSelectEl.addEventListener("change", (e) => {
            this.selectedDeckId = e.target.value;
            this.renderCards();
            this.renderDeck();
            this.updateDeleteButton();
        });

        // Reset deck
        this.btnReset.addEventListener("click", () => this.resetDeck());

        // Nouveau deck
        this.btnNewDeck.addEventListener("click", () => this.openNewDeckModal());

        // Supprimer deck
        this.btnDeleteDeck.addEventListener("click", () => this.deleteCurrentDeck());

        // Modale - annuler
        this.btnCancel.addEventListener("click", () => this.closeNewDeckModal());

        // Modale - confirmer
        this.btnConfirm.addEventListener("click", () => this.confirmNewDeck());

        // Modale - fermer en cliquant à l'extérieur
        this.modalEl.addEventListener("click", (e) => {
            if (e.target === this.modalEl) this.closeNewDeckModal();
        });
    }

    // === Sélecteur de deck ===

    renderDeckSelect() {
        this.deckSelectEl.innerHTML = "";

        // Grouper par héros
        for (const hero of HEROES_DATA) {
            const heroDecks = game.getDecksForHero(hero.id);
            if (heroDecks.length === 0) continue;

            const group = document.createElement("optgroup");
            group.label = `${hero.art} ${hero.name}`;

            for (const deck of heroDecks) {
                const opt = document.createElement("option");
                opt.value = deck.id;
                opt.textContent = deck.name;
                group.appendChild(opt);
            }
            this.deckSelectEl.appendChild(group);
        }

        if (this.selectedDeckId) {
            this.deckSelectEl.value = this.selectedDeckId;
        }
    }

    updateDeleteButton() {
        const deck = this.getSelectedDeck();
        this.btnDeleteDeck.disabled = !deck || deck.isDefault;
    }

    // === Filtres collection ===

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

    // === Cartes collection ===

    renderCards() {
        this.gridEl.innerHTML = "";

        let cards;
        if (this.currentFilter === "all") {
            cards = getAllCards();
        } else {
            cards = getCardsForHero(this.currentFilter);
        }

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
            addBtn.innerHTML = "&#x2B07;";
            addBtn.title = "Ajouter au deck";
            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.addCardToDeck(card.id);
            });
            wrapper.appendChild(addBtn);

            this.gridEl.appendChild(wrapper);
        }
    }

    // === Liste du deck ===

    renderDeck() {
        this.deckListEl.innerHTML = "";
        const deck = this.getSelectedDeck();
        if (!deck) {
            this.deckCountEl.textContent = "(0)";
            return;
        }

        // Compter les occurrences
        const cardCounts = {};
        const cardOrder = [];
        for (const cardId of deck.cards) {
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
            removeBtn.innerHTML = "&#x2B06;";
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

        this.deckCountEl.textContent = `(${deck.cards.length})`;
    }

    // === Gestion du deck ===

    getSelectedDeck() {
        if (!this.selectedDeckId) return null;
        return game.getDeckById(this.selectedDeckId);
    }

    addCardToDeck(cardId) {
        const deck = this.getSelectedDeck();
        if (!deck) return;
        deck.cards.push(cardId);
        this.renderDeck();
    }

    removeCardFromDeck(cardId) {
        const deck = this.getSelectedDeck();
        if (!deck) return;
        const idx = deck.cards.lastIndexOf(cardId);
        if (idx !== -1) {
            deck.cards.splice(idx, 1);
            this.renderDeck();
        }
    }

    resetDeck() {
        const deck = this.getSelectedDeck();
        if (!deck) return;
        const hero = getHeroById(deck.heroId);
        if (hero) {
            deck.cards = [...hero.startingDeck];
            this.renderDeck();
        }
    }

    // === Création de deck ===

    openNewDeckModal() {
        this.inputName.value = "";
        this.inputHero.innerHTML = "";
        for (const hero of HEROES_DATA) {
            const opt = document.createElement("option");
            opt.value = hero.id;
            opt.textContent = `${hero.art} ${hero.name}`;
            this.inputHero.appendChild(opt);
        }
        this.modalEl.style.display = "flex";
        this.inputName.focus();
    }

    closeNewDeckModal() {
        this.modalEl.style.display = "none";
    }

    confirmNewDeck() {
        const name = this.inputName.value.trim();
        const heroId = this.inputHero.value;

        if (!name) {
            this.inputName.style.borderColor = "var(--accent)";
            return;
        }

        const deck = game.createDeck(name, heroId);
        if (deck) {
            this.selectedDeckId = deck.id;
            this.renderDeckSelect();
            this.deckSelectEl.value = deck.id;
            this.renderCards();
            this.renderDeck();
            this.updateDeleteButton();
        }

        this.closeNewDeckModal();
    }

    // === Suppression de deck ===

    deleteCurrentDeck() {
        const deck = this.getSelectedDeck();
        if (!deck || deck.isDefault) return;

        if (!confirm(`Supprimer le deck "${deck.name}" ?`)) return;

        game.deleteDeck(deck.id);

        // Sélectionner le premier deck restant
        this.selectedDeckId = game.decks.length > 0 ? game.decks[0].id : null;
        this.renderDeckSelect();
        if (this.selectedDeckId) this.deckSelectEl.value = this.selectedDeckId;
        this.renderCards();
        this.renderDeck();
        this.updateDeleteButton();
    }
}
