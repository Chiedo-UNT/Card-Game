/**
 * Données des Héros
 *
 * Pour ajouter un héros: ajouter une entrée dans HEROES_DATA
 * et créer ses cartes dans cards.js avec le même hero id.
 *
 * startingDeck: liste d'IDs de cartes composant le deck de départ
 */

const HEROES_DATA = [
    {
        id: "warrior",
        name: "Guerrier",
        description: "Un combattant robuste qui mise sur la force brute et la défense.",
        art: "⚔️",
        maxHp: 80,
        startingEnergy: 3,
        startingDraw: 5,
        startingDeck: [
            "w_strike", "w_strike", "w_strike", "w_strike",
            "w_defend", "w_defend", "w_defend", "w_defend",
            "w_heavy_strike",
            "w_battle_cry"
        ],
        color: "#e94560"
    },
    {
        id: "mage",
        name: "Mage",
        description: "Un lanceur de sorts qui contrôle le terrain avec du poison et des éléments.",
        art: "🔮",
        maxHp: 65,
        startingEnergy: 3,
        startingDraw: 5,
        startingDeck: [
            "m_spark", "m_spark", "m_spark", "m_spark",
            "m_barrier", "m_barrier", "m_barrier", "m_barrier",
            "m_fireball",
            "m_poison_cloud"
        ],
        color: "#4ecdc4"
    },
    {
        id: "rogue",
        name: "Assassin",
        description: "Un combattant agile qui enchaîne les coups rapides et le poison.",
        art: "🗡️",
        maxHp: 70,
        startingEnergy: 3,
        startingDraw: 5,
        startingDeck: [
            "r_slash", "r_slash", "r_slash", "r_slash",
            "r_dodge", "r_dodge", "r_dodge", "r_dodge",
            "r_backstab",
            "r_flurry"
        ],
        color: "#a29bfe"
    }
];

function getHeroById(heroId) {
    return HEROES_DATA.find(h => h.id === heroId);
}
