/**
 * Rendu des cartes avec effets 3D CSS
 */

class CardRenderer {
    /**
     * Crée un élément DOM pour une carte
     * @param {Object} card - données de la carte
     * @param {Object} options - { playable, onClick, battleState, index }
     */
    static createCardElement(card, options = {}) {
        const { playable = true, onClick = null, battleState = null, index = 0 } = options;

        const el = document.createElement("div");
        el.className = `card type-${card.type}`;
        if (!playable) el.classList.add("unplayable");
        el.dataset.cardId = card.id;
        el.dataset.index = index;

        // Description avec valeurs calculées
        let description = card.description;
        if (battleState) {
            description = battleState.getCardDescription(card);
        }

        // Keywords
        const keywordsHtml = card.keywords.length > 0
            ? `<div class="card-keywords">${card.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join("")}</div>`
            : "";

        const typeLabels = { attack: "Attaque", skill: "Compétence", power: "Pouvoir" };

        el.innerHTML = `
            <div class="card-inner">
                <div class="card-cost">${card.cost}</div>
                <div class="card-art">${card.art}</div>
                <div class="card-name">${card.name}</div>
                <div class="card-type-label">${typeLabels[card.type] || card.type}</div>
                <div class="card-description">${description}</div>
                ${keywordsHtml}
            </div>
        `;

        // Effet 3D au survol (parallax souris)
        el.addEventListener("mousemove", (e) => {
            if (el.classList.contains("unplayable")) return;
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;

            el.style.transform = `translateY(-40px) rotateX(${5 + rotateX}deg) rotateY(${rotateY}deg) scale(1.15)`;
        });

        el.addEventListener("mouseleave", () => {
            el.style.transform = "";
        });

        if (onClick && playable) {
            el.addEventListener("click", () => onClick(index, card));
        }

        return el;
    }

    /**
     * Crée une mini-carte pour l'aperçu de deck
     */
    static createMiniCard(card) {
        const el = document.createElement("div");
        el.className = `deck-card-mini type-${card.type}`;
        el.textContent = `${card.art} ${card.name} (${card.cost})`;
        el.title = card.description;
        return el;
    }

    /**
     * Animation de jeu de carte
     */
    static animatePlay(cardEl) {
        return new Promise(resolve => {
            cardEl.classList.add("playing");
            setTimeout(resolve, 400);
        });
    }

    /**
     * Animation de pioche
     */
    static animateDraw(cardEl, delay = 0) {
        cardEl.style.animationDelay = `${delay}ms`;
        cardEl.classList.add("drawing");
    }
}
