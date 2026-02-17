/**
 * Données des Reliques (passifs)
 *
 * Les reliques sont des bonus passifs actifs pendant tout le combat.
 * trigger: quand la relique s'active
 *   "battle_start" | "turn_start" | "on_attack" | "on_block" | "on_kill" | "passive"
 */

const RELICS_DATA = [
    {
        id: "burning_blood",
        name: "Sang Brûlant",
        description: "Récupère 6 PV à la fin de chaque combat.",
        art: "🩸",
        trigger: "battle_end",
        effect: { type: "heal", value: 6 }
    },
    {
        id: "ring_of_snake",
        name: "Anneau du Serpent",
        description: "Pioche 2 cartes supplémentaires au premier tour.",
        art: "🐍",
        trigger: "battle_start",
        effect: { type: "draw", value: 2 }
    },
    {
        id: "vajra",
        name: "Vajra",
        description: "Commence chaque combat avec 1 Force.",
        art: "💎",
        trigger: "battle_start",
        effect: { type: "apply_status", status: "strength", value: 1, target: "self" }
    },
    {
        id: "anchor",
        name: "Ancre",
        description: "Commence chaque combat avec 10 Blocage.",
        art: "⚓",
        trigger: "battle_start",
        effect: { type: "block", value: 10 }
    },
    {
        id: "bag_of_marbles",
        name: "Sac de Billes",
        description: "Applique 1 Vulnérable à tous les ennemis au début du combat.",
        art: "🔮",
        trigger: "battle_start",
        effect: { type: "apply_status", status: "vulnerable", value: 1, target: "all_enemies" }
    }
];

function getRelicById(relicId) {
    return RELICS_DATA.find(r => r.id === relicId);
}
