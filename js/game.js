/**
 * Contrôleur principal du jeu
 *
 * Gère la navigation entre les écrans et orchestre les composants.
 */

class Game {
    constructor() {
        this.currentScreen = "menu";
        this.arenaSelectUI = new ArenaSelectUI();
        this.battleUI = new BattleUI();
        this.collectionUI = new CollectionUI();
        this.battleState = null;
        this.customDecks = {}; // deck custom par héros (rempli par le deck builder)
    }

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

        // Utiliser le deck custom s'il existe
        const battleHeroData = { ...heroData };
        if (this.customDecks[heroData.id] && this.customDecks[heroData.id].length > 0) {
            battleHeroData.startingDeck = [...this.customDecks[heroData.id]];
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
