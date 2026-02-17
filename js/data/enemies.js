/**
 * Données des Ennemis
 *
 * Chaque ennemi a un système de patterns/intentions.
 * L'ennemi montre ce qu'il va faire, puis exécute l'action.
 *
 * Pattern structure:
 *   type: "attack" | "defend" | "buff" | "debuff" | "multi_attack"
 *   value: nombre (dégâts, blocage, etc.)
 *   times: pour multi_attack
 *   status: nom du statut (pour buff/debuff)
 *   statusValue: valeur du statut
 *
 * patternSequence: tableau d'indices dans patterns[]
 * Le comportement suit la séquence, puis boucle.
 */

const ENEMIES_DATA = [
    // === FACILE ===
    {
        id: "slime",
        name: "Slime",
        description: "Un blob gélatineux. Pas très malin.",
        art: "🟢",
        maxHp: 30,
        patterns: [
            { type: "attack", value: 6, intentText: "Attaque 6", intentIcon: "⚔️" },
            { type: "defend", value: 5, intentText: "Défense 5", intentIcon: "🛡️" },
            { type: "attack", value: 8, intentText: "Attaque 8", intentIcon: "⚔️" }
        ],
        patternSequence: [0, 1, 2, 0, 1, 0],
        difficulty: "easy"
    },
    {
        id: "goblin",
        name: "Gobelin",
        description: "Petit mais vicieux. Attaque souvent.",
        art: "👺",
        maxHp: 35,
        patterns: [
            { type: "attack", value: 5, intentText: "Attaque 5", intentIcon: "⚔️" },
            { type: "attack", value: 7, intentText: "Attaque 7", intentIcon: "⚔️" },
            { type: "debuff", status: "weakness", statusValue: 1, intentText: "Faiblesse", intentIcon: "🔻" },
            { type: "attack", value: 10, intentText: "Attaque 10", intentIcon: "⚔️" }
        ],
        patternSequence: [0, 1, 2, 3, 0, 1],
        difficulty: "easy"
    },

    // === MOYEN ===
    {
        id: "skeleton_warrior",
        name: "Squelette Guerrier",
        description: "Un guerrier mort-vivant avec bouclier.",
        art: "💀",
        maxHp: 50,
        patterns: [
            { type: "attack", value: 8, intentText: "Attaque 8", intentIcon: "⚔️" },
            { type: "defend", value: 10, intentText: "Défense 10", intentIcon: "🛡️" },
            { type: "buff", status: "strength", statusValue: 2, intentText: "+2 Force", intentIcon: "💪" },
            { type: "attack", value: 12, intentText: "Attaque 12", intentIcon: "⚔️" },
            { type: "multi_attack", value: 4, times: 3, intentText: "3x4", intentIcon: "⚔️" }
        ],
        patternSequence: [0, 1, 2, 3, 4, 0, 3],
        difficulty: "medium"
    },
    {
        id: "dark_mage",
        name: "Mage Noir",
        description: "Lance des sorts et empoisonne.",
        art: "🧙",
        maxHp: 45,
        patterns: [
            { type: "attack", value: 7, intentText: "Attaque 7", intentIcon: "⚔️" },
            { type: "debuff", status: "poison", statusValue: 5, intentText: "Poison 5", intentIcon: "☠️" },
            { type: "defend", value: 8, intentText: "Défense 8", intentIcon: "🛡️" },
            { type: "debuff", status: "weakness", statusValue: 2, intentText: "Faiblesse 2", intentIcon: "🔻" },
            { type: "attack", value: 14, intentText: "Attaque 14", intentIcon: "⚔️" }
        ],
        patternSequence: [0, 1, 2, 3, 4, 1, 0],
        difficulty: "medium"
    },

    // === DIFFICILE (Boss) ===
    {
        id: "dragon",
        name: "Dragon Ancien",
        description: "Un dragon redoutable. Attention au souffle !",
        art: "🐉",
        maxHp: 100,
        patterns: [
            { type: "attack", value: 10, intentText: "Attaque 10", intentIcon: "⚔️" },
            { type: "buff", status: "strength", statusValue: 3, intentText: "+3 Force", intentIcon: "💪" },
            { type: "multi_attack", value: 5, times: 3, intentText: "3x5", intentIcon: "⚔️" },
            { type: "defend", value: 15, intentText: "Défense 15", intentIcon: "🛡️" },
            { type: "attack", value: 20, intentText: "Souffle 20", intentIcon: "🔥" },
            { type: "debuff", status: "vulnerable", statusValue: 2, intentText: "Vulnérable 2", intentIcon: "🎯" }
        ],
        patternSequence: [0, 1, 2, 3, 4, 5, 0, 2, 4],
        difficulty: "hard"
    },
    {
        id: "lich",
        name: "Liche",
        description: "Un nécromancien puissant qui draine la vie.",
        art: "☠️",
        maxHp: 85,
        patterns: [
            { type: "attack", value: 8, intentText: "Attaque 8", intentIcon: "⚔️" },
            { type: "debuff", status: "poison", statusValue: 6, intentText: "Poison 6", intentIcon: "☠️" },
            { type: "defend", value: 12, intentText: "Défense 12", intentIcon: "🛡️" },
            { type: "buff", status: "strength", statusValue: 2, intentText: "+2 Force", intentIcon: "💪" },
            { type: "attack", value: 15, intentText: "Drain 15", intentIcon: "💀" },
            { type: "debuff", status: "weakness", statusValue: 2, intentText: "Faiblesse 2", intentIcon: "🔻" },
            { type: "multi_attack", value: 3, times: 5, intentText: "5x3", intentIcon: "⚔️" }
        ],
        patternSequence: [0, 1, 2, 3, 4, 5, 6, 1, 4],
        difficulty: "hard"
    }
];

function getEnemyById(enemyId) {
    const data = ENEMIES_DATA.find(e => e.id === enemyId);
    return data ? { ...data } : null;
}

function getEnemiesByDifficulty(difficulty) {
    return ENEMIES_DATA.filter(e => e.difficulty === difficulty);
}
