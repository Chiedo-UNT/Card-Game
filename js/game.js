/**
 * Contrôleur principal du jeu
 *
 * Gère la navigation entre les écrans et orchestre les composants.
 * Gère aussi la liste des decks (par défaut + custom).
 */

class Game {
    constructor() {
        this.currentScreen = "menu";
        this.arenaSelectUI = new ArenaSelectUI();
        this.battleUI = new BattleUI();
        this.collectionUI = new CollectionUI();
        this.cardCreatorUI = new CardCreatorUI();
        this.battleState = null;

        // Système de decks multiples
        this.decks = [];
        this._nextDeckId = 1;
        this.initDefaultDecks();

        // Cartes custom
        this._nextCustomCardId = 1;
        this.loadCustomCards();
    }

    // === Decks ===

    initDefaultDecks() {
        for (const hero of HEROES_DATA) {
            this.decks.push({
                id: `default_${hero.id}`,
                name: `${hero.name} - Défaut`,
                heroId: hero.id,
                cards: [...hero.startingDeck],
                isDefault: true
            });
        }
    }

    createDeck(name, heroId) {
        const hero = getHeroById(heroId);
        if (!hero) return null;
        const deck = {
            id: `custom_${this._nextDeckId++}`,
            name: name,
            heroId: heroId,
            cards: [...hero.startingDeck],
            isDefault: false
        };
        this.decks.push(deck);
        return deck;
    }

    deleteDeck(deckId) {
        const deck = this.getDeckById(deckId);
        if (!deck || deck.isDefault) return false;
        this.decks = this.decks.filter(d => d.id !== deckId);
        return true;
    }

    getDeckById(deckId) {
        return this.decks.find(d => d.id === deckId) || null;
    }

    getDecksForHero(heroId) {
        return this.decks.filter(d => d.heroId === heroId);
    }

    getAllDecks() {
        return this.decks;
    }

    // === Cartes custom ===

    loadCustomCards() {
        if (!CARDS_DATA.custom) CARDS_DATA.custom = [];
        try {
            const saved = localStorage.getItem("cardArena_customCards");
            if (saved) {
                const cards = JSON.parse(saved);
                for (const card of cards) {
                    CARDS_DATA.custom.push(card);
                    // Injecter dans le pool du héros pour la collection
                    if (CARDS_DATA[card.hero]) {
                        CARDS_DATA[card.hero].push(card);
                    }
                    const idNum = parseInt(card.id.replace("custom_", ""));
                    if (idNum >= this._nextCustomCardId) {
                        this._nextCustomCardId = idNum + 1;
                    }
                }
            }
        } catch (e) {
            console.warn("Erreur chargement cartes custom:", e);
        }
    }

    saveCustomCardsToStorage() {
        try {
            localStorage.setItem("cardArena_customCards", JSON.stringify(CARDS_DATA.custom));
        } catch (e) {
            console.warn("Erreur sauvegarde cartes custom:", e);
        }
    }

    addCustomCard(data) {
        const card = {
            id: `custom_${this._nextCustomCardId++}`,
            name: data.name,
            type: data.type,
            cost: data.cost,
            hero: data.hero,
            art: data.art,
            description: data.description,
            keywords: [...data.keywords],
            effects: [...data.effects]
        };
        CARDS_DATA.custom.push(card);
        // Ajouter aussi dans le pool du héros pour qu'elle apparaisse dans la collection
        if (CARDS_DATA[data.hero]) {
            CARDS_DATA[data.hero].push(card);
        }
        this.saveCustomCardsToStorage();
        return card;
    }

    updateCustomCard(cardId, data) {
        const idx = CARDS_DATA.custom.findIndex(c => c.id === cardId);
        if (idx === -1) return null;

        const oldCard = CARDS_DATA.custom[idx];
        const oldHero = oldCard.hero;

        // Mettre à jour dans custom
        const updated = {
            ...oldCard,
            name: data.name,
            type: data.type,
            cost: data.cost,
            hero: data.hero,
            art: data.art,
            description: data.description,
            keywords: [...data.keywords],
            effects: [...data.effects]
        };
        CARDS_DATA.custom[idx] = updated;

        // Retirer de l'ancien héros
        if (CARDS_DATA[oldHero]) {
            const heroIdx = CARDS_DATA[oldHero].findIndex(c => c.id === cardId);
            if (heroIdx !== -1) CARDS_DATA[oldHero].splice(heroIdx, 1);
        }

        // Ajouter dans le nouveau héros
        if (CARDS_DATA[data.hero]) {
            CARDS_DATA[data.hero].push(updated);
        }

        this.saveCustomCardsToStorage();
        return updated;
    }

    deleteCustomCard(cardId) {
        const idx = CARDS_DATA.custom.findIndex(c => c.id === cardId);
        if (idx === -1) return false;

        const card = CARDS_DATA.custom[idx];

        // Retirer du pool héros
        if (CARDS_DATA[card.hero]) {
            const heroIdx = CARDS_DATA[card.hero].findIndex(c => c.id === cardId);
            if (heroIdx !== -1) CARDS_DATA[card.hero].splice(heroIdx, 1);
        }

        // Retirer de custom
        CARDS_DATA.custom.splice(idx, 1);

        // Retirer des decks qui l'utilisent
        for (const deck of this.decks) {
            deck.cards = deck.cards.filter(id => id !== cardId);
        }

        this.saveCustomCardsToStorage();
        return true;
    }

    getCustomCards() {
        return CARDS_DATA.custom || [];
    }

    // === Navigation ===

    init() {
        this.showScreen("menu");
    }

    showScreen(screenId) {
        // Cacher tous les écrans
        document.querySelectorAll(".screen").forEach(el => {
            el.classList.remove("active");
        });

        // Afficher l'écran ciblé
        const screen = document.getElementById(`screen-${screenId}`);
        if (screen) {
            screen.classList.add("active");
            this.currentScreen = screenId;
        }

        // Init spécifique à l'écran
        switch (screenId) {
            case "arena-select":
                this.arenaSelectUI.init();
                break;
            case "collection":
                this.collectionUI.init();
                break;
            case "card-creator":
                this.cardCreatorUI.init();
                break;
        }
    }

    startBattle() {
        const selection = this.arenaSelectUI.getSelection();
        if (!selection.heroId || !selection.enemyId) return;

        const heroData = getHeroById(selection.heroId);
        const enemyData = getEnemyById(selection.enemyId);

        if (!heroData || !enemyData) return;

        // Utiliser le deck sélectionné dans l'arène
        const battleHeroData = { ...heroData };
        if (selection.deckId) {
            const deck = this.getDeckById(selection.deckId);
            if (deck && deck.cards.length > 0) {
                battleHeroData.startingDeck = [...deck.cards];
            }
        }

        // Créer le combat
        this.battleState = new BattleState(battleHeroData, enemyData);
        this.battleUI.bind(this.battleState);

        // Passer à l'écran de combat
        this.showScreen("battle");

        // Démarrer
        setTimeout(() => {
            this.battleUI.showTurnBanner("Combat !");
            setTimeout(() => {
                this.battleState.startBattle();
            }, 600);
        }, 300);
    }

    endTurn() {
        if (this.battleState && this.battleState.isPlayerTurn) {
            this.battleState.endPlayerTurn();
        }
    }
}

// === Initialisation ===
const game = new Game();
document.addEventListener("DOMContentLoaded", () => {
    game.init();
});
