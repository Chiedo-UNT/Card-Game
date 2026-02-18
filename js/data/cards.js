/**
 * Système de cartes - Chargé depuis des données JSON-like.
 * Pour créer de nouvelles cartes, il suffit d'ajouter une entrée dans le tableau correspondant.
 *
 * Structure d'une carte:
 *   id: string unique
 *   name: nom affiché
 *   type: "attack" | "skill" | "power"
 *   cost: coût en énergie
 *   hero: "warrior" | "mage" | "rogue" | "neutral"
 *   art: emoji pour le placeholder
 *   description: texte descriptif (supporte {damage}, {block}, {value} pour valeurs dynamiques)
 *   keywords: [] liste de mots-clés (exhaust, ethereal, retain, innate)
 *   effects: [] liste d'effets appliqués quand la carte est jouée
 *
 * Structure d'un effet:
 *   type: "damage" | "block" | "apply_status" | "draw" | "gain_energy" | "damage_all" | "heal"
 *   value: nombre
 *   target: "enemy" | "self" | "all_enemies" (optionnel, défaut selon type)
 *   status: nom du statut (pour apply_status)
 *   times: nombre de fois (pour multi-hit)
 */

const CARDS_DATA = {
    // ==========================================
    // GUERRIER (Warrior) - Force brute, block
    // ==========================================
    warrior: [
        {
            id: "w_strike",
            name: "Frappe",
            type: "attack",
            cost: 1,
            hero: "warrior",
            art: "⚔️",
            description: "Inflige {damage} dégâts.",
            keywords: [],
            effects: [{ type: "damage", value: 6 }]
        },
        {
            id: "w_defend",
            name: "Défense",
            type: "skill",
            cost: 1,
            hero: "warrior",
            art: "🛡️",
            description: "Gagne {block} de blocage.",
            keywords: [],
            effects: [{ type: "block", value: 5 }]
        },
        {
            id: "w_heavy_strike",
            name: "Frappe Lourde",
            type: "attack",
            cost: 2,
            hero: "warrior",
            art: "🔨",
            description: "Inflige {damage} dégâts.",
            keywords: [],
            effects: [{ type: "damage", value: 14 }]
        },
        {
            id: "w_iron_wall",
            name: "Mur de Fer",
            type: "skill",
            cost: 2,
            hero: "warrior",
            art: "🏰",
            description: "Gagne {block} de blocage.",
            keywords: [],
            effects: [{ type: "block", value: 12 }]
        },
        {
            id: "w_battle_cry",
            name: "Cri de Guerre",
            type: "skill",
            cost: 1,
            hero: "warrior",
            art: "📢",
            description: "Gagne {value} de Force.",
            keywords: [],
            effects: [{ type: "apply_status", status: "strength", value: 2, target: "self" }]
        },
        {
            id: "w_whirlwind",
            name: "Tourbillon",
            type: "attack",
            cost: 2,
            hero: "warrior",
            art: "🌀",
            description: "Inflige {damage} dégâts 3 fois.",
            keywords: [],
            effects: [{ type: "damage", value: 4, times: 3 }]
        },
        {
            id: "w_rage",
            name: "Rage",
            type: "power",
            cost: 1,
            hero: "warrior",
            art: "😤",
            description: "Gagne 3 de Force. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "apply_status", status: "strength", value: 3, target: "self" }]
        },
        {
            id: "w_body_slam",
            name: "Charge Corporelle",
            type: "attack",
            cost: 1,
            hero: "warrior",
            art: "💪",
            description: "Inflige des dégâts égaux à votre blocage actuel.",
            keywords: [],
            effects: [{ type: "damage_from_block", value: 0 }]
        },
        {
            id: "w_shield_bash",
            name: "Coup de Bouclier",
            type: "attack",
            cost: 2,
            hero: "warrior",
            art: "🛡️",
            description: "Gagne {block} blocage. Inflige {damage} dégâts.",
            keywords: [],
            effects: [
                { type: "block", value: 8 },
                { type: "damage", value: 8 }
            ]
        },
        {
            id: "w_flex",
            name: "Flexion",
            type: "skill",
            cost: 0,
            hero: "warrior",
            art: "💪",
            description: "Gagne 2 de Force ce tour. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "apply_status", status: "temp_strength", value: 2, target: "self" }]
        },
        {
            id: "w_entrench",
            name: "Retranchement",
            type: "skill",
            cost: 2,
            hero: "warrior",
            art: "🏗️",
            description: "Double votre blocage actuel.",
            keywords: [],
            effects: [{ type: "double_block" }]
        },
        {
            id: "w_bloodletting",
            name: "Saignée",
            type: "skill",
            cost: 0,
            hero: "warrior",
            art: "🩸",
            description: "Perdez 3 PV. Gagne 2 d'énergie.",
            keywords: [],
            effects: [
                { type: "lose_hp", value: 3 },
                { type: "gain_energy", value: 2 }
            ]
        }
    ],

    // ==========================================
    // MAGE - Sorts, poison, effets de zone
    // ==========================================
    mage: [
        {
            id: "m_spark",
            name: "Étincelle",
            type: "attack",
            cost: 1,
            hero: "mage",
            art: "⚡",
            description: "Inflige {damage} dégâts.",
            keywords: [],
            effects: [{ type: "damage", value: 6 }]
        },
        {
            id: "m_barrier",
            name: "Barrière",
            type: "skill",
            cost: 1,
            hero: "mage",
            art: "✨",
            description: "Gagne {block} de blocage.",
            keywords: [],
            effects: [{ type: "block", value: 5 }]
        },
        {
            id: "m_fireball",
            name: "Boule de Feu",
            type: "attack",
            cost: 2,
            hero: "mage",
            art: "🔥",
            description: "Inflige {damage} dégâts. Applique 2 Vulnérable.",
            keywords: [],
            effects: [
                { type: "damage", value: 10 },
                { type: "apply_status", status: "vulnerable", value: 2 }
            ]
        },
        {
            id: "m_frost_nova",
            name: "Nova de Givre",
            type: "skill",
            cost: 1,
            hero: "mage",
            art: "❄️",
            description: "Gagne {block} blocage. Applique 1 Faiblesse.",
            keywords: [],
            effects: [
                { type: "block", value: 6 },
                { type: "apply_status", status: "weakness", value: 1 }
            ]
        },
        {
            id: "m_poison_cloud",
            name: "Nuage Toxique",
            type: "skill",
            cost: 1,
            hero: "mage",
            art: "☁️",
            description: "Applique {value} Poison.",
            keywords: [],
            effects: [{ type: "apply_status", status: "poison", value: 4 }]
        },
        {
            id: "m_arcane_surge",
            name: "Vague Arcanique",
            type: "skill",
            cost: 0,
            hero: "mage",
            art: "🌊",
            description: "Pioche 2 cartes.",
            keywords: [],
            effects: [{ type: "draw", value: 2 }]
        },
        {
            id: "m_chain_lightning",
            name: "Chaîne d'Éclairs",
            type: "attack",
            cost: 2,
            hero: "mage",
            art: "⛈️",
            description: "Inflige {damage} dégâts. Pioche 1 carte.",
            keywords: [],
            effects: [
                { type: "damage", value: 10 },
                { type: "draw", value: 1 }
            ]
        },
        {
            id: "m_mana_crystal",
            name: "Cristal de Mana",
            type: "power",
            cost: 1,
            hero: "mage",
            art: "💎",
            description: "Gagne 1 énergie au début de chaque tour. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "apply_status", status: "energy_per_turn", value: 1, target: "self" }]
        },
        {
            id: "m_ice_armor",
            name: "Armure de Glace",
            type: "power",
            cost: 1,
            hero: "mage",
            art: "🧊",
            description: "Gagne 4 blocage au début de chaque tour. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "apply_status", status: "block_per_turn", value: 4, target: "self" }]
        },
        {
            id: "m_meteor",
            name: "Météore",
            type: "attack",
            cost: 3,
            hero: "mage",
            art: "☄️",
            description: "Inflige {damage} dégâts. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "damage", value: 24 }]
        },
        {
            id: "m_concentrate",
            name: "Concentration",
            type: "skill",
            cost: 0,
            hero: "mage",
            art: "🧠",
            description: "Pioche 3 cartes. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "draw", value: 3 }]
        },
        {
            id: "m_toxic_stab",
            name: "Dague Empoisonnée",
            type: "attack",
            cost: 1,
            hero: "mage",
            art: "🗡️",
            description: "Inflige {damage} dégâts. Applique 3 Poison.",
            keywords: [],
            effects: [
                { type: "damage", value: 4 },
                { type: "apply_status", status: "poison", value: 3 }
            ]
        }
    ],

    // ==========================================
    // ROGUE - Vitesse, combos, pioche
    // ==========================================
    rogue: [
        {
            id: "r_slash",
            name: "Entaille",
            type: "attack",
            cost: 1,
            hero: "rogue",
            art: "🗡️",
            description: "Inflige {damage} dégâts.",
            keywords: [],
            effects: [{ type: "damage", value: 6 }]
        },
        {
            id: "r_dodge",
            name: "Esquive",
            type: "skill",
            cost: 1,
            hero: "rogue",
            art: "💨",
            description: "Gagne {block} de blocage.",
            keywords: [],
            effects: [{ type: "block", value: 5 }]
        },
        {
            id: "r_flurry",
            name: "Rafale",
            type: "attack",
            cost: 1,
            hero: "rogue",
            art: "⚡",
            description: "Inflige {damage} dégâts 3 fois.",
            keywords: [],
            effects: [{ type: "damage", value: 2, times: 3 }]
        },
        {
            id: "r_backstab",
            name: "Coup en Traître",
            type: "attack",
            cost: 0,
            hero: "rogue",
            art: "🔪",
            description: "Inflige {damage} dégâts. Innate. Exhaust.",
            keywords: ["innate", "exhaust"],
            effects: [{ type: "damage", value: 8 }]
        },
        {
            id: "r_quick_draw",
            name: "Tir Rapide",
            type: "skill",
            cost: 1,
            hero: "rogue",
            art: "🏹",
            description: "Pioche 3 cartes. Défausse 1 carte.",
            keywords: [],
            effects: [
                { type: "draw", value: 3 },
                { type: "discard_random", value: 1 }
            ]
        },
        {
            id: "r_smoke_bomb",
            name: "Bombe Fumigène",
            type: "skill",
            cost: 1,
            hero: "rogue",
            art: "💣",
            description: "Gagne {block} blocage. Applique 1 Faiblesse.",
            keywords: [],
            effects: [
                { type: "block", value: 7 },
                { type: "apply_status", status: "weakness", value: 1 }
            ]
        },
        {
            id: "r_adrenaline",
            name: "Adrénaline",
            type: "skill",
            cost: 0,
            hero: "rogue",
            art: "💉",
            description: "Gagne 1 énergie. Pioche 2 cartes. Exhaust.",
            keywords: ["exhaust"],
            effects: [
                { type: "gain_energy", value: 1 },
                { type: "draw", value: 2 }
            ]
        },
        {
            id: "r_poison_blade",
            name: "Lame Empoisonnée",
            type: "attack",
            cost: 1,
            hero: "rogue",
            art: "🧪",
            description: "Inflige {damage} dégâts. Applique 4 Poison.",
            keywords: [],
            effects: [
                { type: "damage", value: 3 },
                { type: "apply_status", status: "poison", value: 4 }
            ]
        },
        {
            id: "r_evasion",
            name: "Évasion",
            type: "power",
            cost: 1,
            hero: "rogue",
            art: "🦎",
            description: "Gagne 3 blocage au début de chaque tour. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "apply_status", status: "block_per_turn", value: 3, target: "self" }]
        },
        {
            id: "r_assassinate",
            name: "Assassinat",
            type: "attack",
            cost: 3,
            hero: "rogue",
            art: "💀",
            description: "Inflige {damage} dégâts. Exhaust.",
            keywords: ["exhaust"],
            effects: [{ type: "damage", value: 22 }]
        },
        {
            id: "r_blade_dance",
            name: "Danse des Lames",
            type: "attack",
            cost: 1,
            hero: "rogue",
            art: "🩰",
            description: "Inflige {damage} dégâts 4 fois.",
            keywords: [],
            effects: [{ type: "damage", value: 2, times: 4 }]
        },
        {
            id: "r_shadow_step",
            name: "Pas de l'Ombre",
            type: "skill",
            cost: 1,
            hero: "rogue",
            art: "👤",
            description: "Gagne {block} blocage. Pioche 1 carte.",
            keywords: [],
            effects: [
                { type: "block", value: 5 },
                { type: "draw", value: 1 }
            ]
        }
    ],

    // Cartes neutres (disponibles pour tous les héros)
    neutral: []
};

// Fonction utilitaire pour obtenir toutes les cartes à plat
// Ignore le pool "custom" pour ne pas avoir de doublons (les cartes custom
// sont déjà ajoutées dans le pool de leur héros respectif).
function getAllCards() {
    const all = [];
    for (const hero in CARDS_DATA) {
        if (hero === "custom") continue;
        for (const card of CARDS_DATA[hero]) {
            all.push({ ...card });
        }
    }
    return all;
}

// Obtenir les cartes d'un héros spécifique
// Inclut aussi les cartes "neutral"
function getCardsForHero(heroId) {
    const cards = (CARDS_DATA[heroId] || []).map(c => ({ ...c }));
    // Ajouter les cartes neutres
    if (heroId !== "neutral" && CARDS_DATA.neutral) {
        for (const card of CARDS_DATA.neutral) {
            cards.push({ ...card });
        }
    }
    return cards;
}

// Obtenir une carte par son ID
function getCardById(cardId) {
    for (const hero in CARDS_DATA) {
        const card = CARDS_DATA[hero].find(c => c.id === cardId);
        if (card) return { ...card };
    }
    return null;
}
