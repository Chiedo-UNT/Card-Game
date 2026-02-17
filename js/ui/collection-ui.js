/**
 * UI de la collection de cartes
 *
 * Affiche toutes les cartes du jeu avec filtrage par héros.
 */

class CollectionUI {
    constructor() {
        this.gridEl = document.getElementById("collection-grid");
        this.filtersEl = document.querySelector(".collection-filters");
        this.currentFilter = "all";
    }

    init() {
        this.renderFilters();
        this.renderCards();
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

        for (const card of cards) {
            const el = CardRenderer.createCardElement(card, { playable: true });
            el.style.cursor = "default";
            this.gridEl.appendChild(el);
        }
    }
}
