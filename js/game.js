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
        this.battleState = null;

        // Système de decks multiples
        this.decks = [];
        this._nextDeckId = 1;
        this.initDefaultDecks();
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
