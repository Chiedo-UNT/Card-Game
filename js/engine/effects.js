/**
 * Système d'effets et de statuts
 *
 * Gère l'application des effets de cartes et le traitement des statuts.
 */

const StatusTypes = {
    // Debuffs
    poison: { name: "Poison", icon: "☠️", color: "#6c5ce7", isDebuff: true, tickDown: true },
    weakness: { name: "Faiblesse", icon: "🔻", color: "#a29bfe", isDebuff: true, tickDown: true },
    vulnerable: { name: "Vulnérable", icon: "🎯", color: "#e17055", isDebuff: true, tickDown: true },

    // Buffs
    strength: { name: "Force", icon: "💪", color: "#fd9644", isDebuff: false, tickDown: false },
    temp_strength: { name: "Force Temp.", icon: "💪", color: "#fdcb6e", isDebuff: false, tickDown: false },
    block_per_turn: { name: "Blocage/Tour", icon: "🛡️", color: "#74b9ff", isDebuff: false, tickDown: false },
    energy_per_turn: { name: "Énergie/Tour", icon: "⚡", color: "#4ecdc4", isDebuff: false, tickDown: false },
    ritual: { name: "Rituel", icon: "🕯️", color: "#fdcb6e", isDebuff: false, tickDown: false }
};

class EffectProcessor {
    /**
     * Applique les effets d'une carte jouée
     * @param {Array} effects - liste d'effets de la carte
     * @param {Object} source - joueur ou ennemi qui joue la carte
     * @param {Object} target - cible (ennemi ou joueur)
     * @param {Object} battleState - état du combat
     * @returns {Array} log des actions effectuées
     */
    static applyCardEffects(effects, source, target, battleState) {
        const log = [];

        for (const effect of effects) {
            const result = this.applyEffect(effect, source, target, battleState);
            if (result) log.push(result);
        }

        return log;
    }

    static applyEffect(effect, source, target, battleState) {
        switch (effect.type) {
            case "damage":
                return this.applyDamage(effect, source, target);

            case "damage_from_block":
                return this.applyDamageFromBlock(source, target);

            case "damage_all":
                return this.applyDamageAll(effect, source, battleState);

            case "block":
                return this.applyBlock(effect, source);

            case "double_block":
                return this.applyDoubleBlock(source);

            case "apply_status":
                return this.applyStatus(effect, source, target);

            case "draw":
                return this.applyDraw(effect, battleState);

            case "gain_energy":
                return this.applyGainEnergy(effect, battleState);

            case "lose_hp":
                return this.applyLoseHp(effect, source);

            case "heal":
                return this.applyHeal(effect, source);

            case "discard_random":
                return this.applyDiscardRandom(effect, battleState);

            default:
                console.warn(`Effet inconnu: ${effect.type}`);
                return null;
        }
    }

    static calculateDamage(baseDamage, source, target) {
        let damage = baseDamage;

        // Force (strength) du source
        const strength = this.getStatusValue(source, "strength");
        const tempStrength = this.getStatusValue(source, "temp_strength");
        damage += strength + tempStrength;

        // Faiblesse (weakness) réduit de 25%
        if (this.getStatusValue(source, "weakness") > 0) {
            damage = Math.floor(damage * 0.75);
        }

        // Vulnérable (vulnerable) augmente les dégâts de 50%
        if (this.getStatusValue(target, "vulnerable") > 0) {
            damage = Math.floor(damage * 1.5);
        }

        return Math.max(0, damage);
    }

    static applyDamage(effect, source, target) {
        const times = effect.times || 1;
        let totalDamage = 0;

        for (let i = 0; i < times; i++) {
            const damage = this.calculateDamage(effect.value, source, target);
            const actualDamage = this.dealDamage(target, damage);
            totalDamage += actualDamage;
        }

        return {
            type: "damage",
            value: totalDamage,
            times: times,
            target: "enemy"
        };
    }

    static applyDamageFromBlock(source, target) {
        const damage = source.block || 0;
        const actualDamage = this.dealDamage(target, damage);
        return { type: "damage", value: actualDamage, target: "enemy" };
    }

    static dealDamage(target, damage) {
        let remaining = damage;

        // Le blocage absorbe les dégâts
        if (target.block > 0) {
            if (target.block >= remaining) {
                target.block -= remaining;
                return 0;
            } else {
                remaining -= target.block;
                target.block = 0;
            }
        }

        target.hp = Math.max(0, target.hp - remaining);
        return remaining;
    }

    static applyBlock(effect, source) {
        source.block += effect.value;
        return { type: "block", value: effect.value };
    }

    static applyDoubleBlock(source) {
        const doubled = source.block;
        source.block *= 2;
        return { type: "block", value: doubled };
    }

    static applyStatus(effect, source, target) {
        const effectTarget = effect.target === "self" ? source : target;
        if (!effectTarget.statuses) effectTarget.statuses = {};

        const status = effect.status;
        effectTarget.statuses[status] = (effectTarget.statuses[status] || 0) + (effect.value || effect.statusValue || 1);

        return {
            type: "status",
            status: status,
            value: effect.value || effect.statusValue || 1,
            targetName: effectTarget === source ? "self" : "enemy"
        };
    }

    static applyDraw(effect, battleState) {
        const drawn = battleState.drawCards(effect.value);
        return { type: "draw", value: drawn };
    }

    static applyGainEnergy(effect, battleState) {
        battleState.energy += effect.value;
        return { type: "energy", value: effect.value };
    }

    static applyLoseHp(effect, source) {
        source.hp = Math.max(0, source.hp - effect.value);
        return { type: "lose_hp", value: effect.value };
    }

    static applyHeal(effect, source) {
        const healed = Math.min(effect.value, source.maxHp - source.hp);
        source.hp += healed;
        return { type: "heal", value: healed };
    }

    static applyDiscardRandom(effect, battleState) {
        const count = Math.min(effect.value, battleState.hand.length);
        for (let i = 0; i < count; i++) {
            if (battleState.hand.length > 0) {
                const idx = Math.floor(Math.random() * battleState.hand.length);
                const card = battleState.hand.splice(idx, 1)[0];
                battleState.discardPile.push(card);
            }
        }
        return { type: "discard", value: count };
    }

    // === Status utilities ===

    static getStatusValue(entity, statusName) {
        if (!entity.statuses) return 0;
        return entity.statuses[statusName] || 0;
    }

    /**
     * Traitement de fin de tour : poison, décrémentation des statuts
     */
    static processEndOfTurn(entity) {
        const log = [];
        if (!entity.statuses) return log;

        // Poison inflige des dégâts et décrémente
        if (entity.statuses.poison > 0) {
            const poisonDmg = entity.statuses.poison;
            entity.hp = Math.max(0, entity.hp - poisonDmg);
            log.push({ type: "poison_damage", value: poisonDmg });
            entity.statuses.poison -= 1;
            if (entity.statuses.poison <= 0) delete entity.statuses.poison;
        }

        // Force temporaire retirée en fin de tour
        if (entity.statuses.temp_strength > 0) {
            delete entity.statuses.temp_strength;
        }

        // Décrémentation des statuts tick-down
        for (const [status, value] of Object.entries(entity.statuses)) {
            if (StatusTypes[status] && StatusTypes[status].tickDown && status !== "poison") {
                entity.statuses[status] = value - 1;
                if (entity.statuses[status] <= 0) {
                    delete entity.statuses[status];
                }
            }
        }

        return log;
    }

    /**
     * Traitement de début de tour : block_per_turn, energy_per_turn, ritual
     */
    static processStartOfTurn(entity, battleState) {
        const log = [];
        if (!entity.statuses) return log;

        if (entity.statuses.block_per_turn > 0) {
            entity.block += entity.statuses.block_per_turn;
            log.push({ type: "block", value: entity.statuses.block_per_turn });
        }

        if (entity.statuses.energy_per_turn > 0 && battleState) {
            battleState.energy += entity.statuses.energy_per_turn;
            log.push({ type: "energy", value: entity.statuses.energy_per_turn });
        }

        if (entity.statuses.ritual > 0) {
            entity.statuses.strength = (entity.statuses.strength || 0) + entity.statuses.ritual;
            log.push({ type: "status", status: "strength", value: entity.statuses.ritual });
        }

        return log;
    }
}
