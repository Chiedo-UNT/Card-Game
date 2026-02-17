/**
 * IA Ennemie
 *
 * L'ennemi suit un pattern prédéfini et montre son intention
 * avant d'agir (comme Slay the Spire).
 *
 * Ce fichier est réservé pour de futures extensions de l'IA
 * (comportements conditionnels, etc.)
 */

class EnemyAI {
    /**
     * Calcule les dégâts réels que l'ennemi va infliger (prend en compte les buffs/debuffs)
     */
    static getIntentDamage(enemy, player, pattern) {
        if (pattern.type !== "attack" && pattern.type !== "multi_attack") return null;

        let damage = pattern.value;
        const strength = EffectProcessor.getStatusValue(enemy, "strength");
        damage += strength;

        if (EffectProcessor.getStatusValue(enemy, "weakness") > 0) {
            damage = Math.floor(damage * 0.75);
        }
        if (EffectProcessor.getStatusValue(player, "vulnerable") > 0) {
            damage = Math.floor(damage * 1.5);
        }

        damage = Math.max(0, damage);

        if (pattern.type === "multi_attack") {
            return { perHit: damage, times: pattern.times, total: damage * pattern.times };
        }

        return { perHit: damage, times: 1, total: damage };
    }

    /**
     * Retourne le texte d'intention avec les dégâts calculés
     */
    static getIntentDisplay(enemy, player, pattern) {
        const dmgInfo = this.getIntentDamage(enemy, player, pattern);

        if (dmgInfo) {
            if (dmgInfo.times > 1) {
                return `${pattern.intentIcon} ${dmgInfo.times}x${dmgInfo.perHit}`;
            }
            return `${pattern.intentIcon} ${dmgInfo.total}`;
        }

        return `${pattern.intentIcon} ${pattern.intentText}`;
    }

    /**
     * Retourne le type CSS pour l'intention
     */
    static getIntentType(pattern) {
        switch (pattern.type) {
            case "attack":
            case "multi_attack":
                return "attack";
            case "defend":
                return "defend";
            case "buff":
                return "buff";
            case "debuff":
                return "debuff";
            default:
                return "attack";
        }
    }
}
