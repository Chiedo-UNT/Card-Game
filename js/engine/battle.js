/**
 * Moteur de combat principal
 *
 * Gère l'état du combat, les tours, la pioche, la défausse,
 * et orchestre les actions joueur/ennemi.
 */

class BattleState {
    constructor(heroData, enemyData) {
        // Joueur
        this.player = {
            name: heroData.name,
            heroId: heroData.id,
            hp: heroData.maxHp,
            maxHp: heroData.maxHp,
            block: 0,
            statuses: {}
        };

        // Ennemi
        this.enemy = {
            name: enemyData.name,
            enemyId: enemyData.id,
            hp: enemyData.maxHp,
            maxHp: enemyData.maxHp,
            block: 0,
            statuses: {},
            art: enemyData.art,
            patterns: enemyData.patterns,
            patternSequence: enemyData.patternSequence,
            patternIndex: 0
        };

        // Deck
        this.drawPile = [];
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];

        // Tour
        this.turn = 0;
        this.energy = 0;
        this.maxEnergy = heroData.startingEnergy;
        this.drawPerTurn = heroData.startingDraw;

        // État
        this.isPlayerTurn = true;
        this.isGameOver = false;
        this.result = null; // "victory" | "defeat"

        // Instance ID counter for hand diffing
        this._nextInstanceId = 0;

        // Callbacks UI
        this.onStateChange = null;
        this.onLog = null;
        this.onCardPlayed = null;
        this.onEnemyAction = null;
        this.onGameOver = null;
        this.onDamagePopup = null;

        // Initialiser le deck
        this.initDeck(heroData.startingDeck);
    }

    initDeck(deckCardIds) {
        this.drawPile = deckCardIds.map(id => getCardById(id)).filter(c => c !== null);
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    // === Tour ===

    startBattle() {
        this.turn = 0;
        this.startPlayerTurn();
    }

    startPlayerTurn() {
        this.turn++;
        this.isPlayerTurn = true;

        // Reset block joueur
        this.player.block = 0;

        // Énergie
        this.energy = this.maxEnergy;

        // Effets de début de tour
        const turnLogs = EffectProcessor.processStartOfTurn(this.player, this);

        // Pioche
        this.drawCards(this.drawPerTurn);

        // Intention ennemi
        this.updateEnemyIntent();

        this.emitLog(`--- Tour ${this.turn} ---`);
        this.emitStateChange();
    }

    endPlayerTurn() {
        if (!this.isPlayerTurn || this.isGameOver) return;

        this.isPlayerTurn = false;

        // Défausser les cartes ethereal, puis la main
        this.discardHand();

        // Effets de fin de tour joueur
        const playerEndLogs = EffectProcessor.processEndOfTurn(this.player);
        for (const log of playerEndLogs) {
            if (log.type === "poison_damage") {
                this.emitLog(`Poison inflige ${log.value} dégâts au joueur.`);
                this.emitDamagePopup("player", log.value, "poison");
            }
        }

        if (this.checkGameOver()) return;

        // Tour ennemi
        this.executeEnemyTurn();
    }

    executeEnemyTurn() {
        // Reset block ennemi
        this.enemy.block = 0;

        // Effets de début de tour ennemi
        EffectProcessor.processStartOfTurn(this.enemy, null);

        // Exécuter le pattern
        const pattern = this.getCurrentEnemyPattern();
        this.executeEnemyPattern(pattern);

        // Avancer l'index du pattern
        this.enemy.patternIndex = (this.enemy.patternIndex + 1) % this.enemy.patternSequence.length;

        // Effets de fin de tour ennemi
        const enemyEndLogs = EffectProcessor.processEndOfTurn(this.enemy);
        for (const log of enemyEndLogs) {
            if (log.type === "poison_damage") {
                this.emitLog(`Poison inflige ${log.value} dégâts à ${this.enemy.name}.`);
                this.emitDamagePopup("enemy", log.value, "poison");
            }
        }

        if (this.checkGameOver()) return;

        this.emitStateChange();

        // Retour au tour joueur
        setTimeout(() => {
            if (!this.isGameOver) {
                this.startPlayerTurn();
            }
        }, 800);
    }

    // === Cartes ===

    drawCards(count) {
        let drawn = 0;
        for (let i = 0; i < count; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                // Recycler la défausse
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffleDeck();
                this.emitLog("Pioche re-mélangée.");
            }
            const card = this.drawPile.pop();
            if (card) {
                card._instanceId = this._nextInstanceId++;
                this.hand.push(card);
                drawn++;
            }
        }
        this.emitStateChange();
        return drawn;
    }

    playCard(handIndex) {
        if (!this.isPlayerTurn || this.isGameOver) return false;

        const card = this.hand[handIndex];
        if (!card) return false;

        // Vérifier le coût
        if (card.cost > this.energy) return false;

        // Payer l'énergie
        this.energy -= card.cost;

        // Retirer de la main
        this.hand.splice(handIndex, 1);

        // Appliquer les effets
        const logs = EffectProcessor.applyCardEffects(
            card.effects,
            this.player,
            this.enemy,
            this
        );

        // Log
        this.emitLog(`${card.name} joué.`);

        // Emit popups
        for (const log of logs) {
            if (log.type === "damage") {
                this.emitDamagePopup("enemy", log.value, "damage");
            } else if (log.type === "block") {
                this.emitDamagePopup("player", log.value, "block");
            } else if (log.type === "heal") {
                this.emitDamagePopup("player", log.value, "heal");
            }
        }

        // Gestion mot-clé: exhaust
        if (card.keywords.includes("exhaust")) {
            this.exhaustPile.push(card);
        } else {
            this.discardPile.push(card);
        }

        this.emitCardPlayed(card, handIndex);
        this.checkGameOver();
        this.emitStateChange();

        return true;
    }

    canPlayCard(card) {
        return this.isPlayerTurn && !this.isGameOver && card.cost <= this.energy;
    }

    discardHand() {
        // Garder les cartes avec "retain"
        const retained = [];
        for (const card of this.hand) {
            if (card.keywords.includes("retain")) {
                retained.push(card);
            } else if (card.keywords.includes("ethereal")) {
                this.exhaustPile.push(card);
            } else {
                this.discardPile.push(card);
            }
        }
        this.hand = retained;
    }

    // === Ennemi ===

    getCurrentEnemyPattern() {
        const seqIdx = this.enemy.patternSequence[this.enemy.patternIndex % this.enemy.patternSequence.length];
        return this.enemy.patterns[seqIdx];
    }

    getNextEnemyIntent() {
        const seqIdx = this.enemy.patternSequence[this.enemy.patternIndex % this.enemy.patternSequence.length];
        return this.enemy.patterns[seqIdx];
    }

    updateEnemyIntent() {
        this.enemy.currentIntent = this.getNextEnemyIntent();
    }

    executeEnemyPattern(pattern) {
        switch (pattern.type) {
            case "attack": {
                let damage = pattern.value;
                const strength = EffectProcessor.getStatusValue(this.enemy, "strength");
                damage += strength;
                if (EffectProcessor.getStatusValue(this.enemy, "weakness") > 0) {
                    damage = Math.floor(damage * 0.75);
                }
                if (EffectProcessor.getStatusValue(this.player, "vulnerable") > 0) {
                    damage = Math.floor(damage * 1.5);
                }
                damage = Math.max(0, damage);
                EffectProcessor.dealDamage(this.player, damage);
                this.emitLog(`${this.enemy.name} attaque pour ${damage} dégâts.`);
                this.emitDamagePopup("player", damage, "damage");
                this.emitEnemyAction("attack");
                break;
            }

            case "multi_attack": {
                const times = pattern.times || 2;
                let totalDmg = 0;
                for (let i = 0; i < times; i++) {
                    let damage = pattern.value;
                    const strength = EffectProcessor.getStatusValue(this.enemy, "strength");
                    damage += strength;
                    if (EffectProcessor.getStatusValue(this.enemy, "weakness") > 0) {
                        damage = Math.floor(damage * 0.75);
                    }
                    if (EffectProcessor.getStatusValue(this.player, "vulnerable") > 0) {
                        damage = Math.floor(damage * 1.5);
                    }
                    damage = Math.max(0, damage);
                    EffectProcessor.dealDamage(this.player, damage);
                    totalDmg += damage;
                }
                this.emitLog(`${this.enemy.name} attaque ${times} fois pour ${totalDmg} dégâts total.`);
                this.emitDamagePopup("player", totalDmg, "damage");
                this.emitEnemyAction("attack");
                break;
            }

            case "defend":
                this.enemy.block += pattern.value;
                this.emitLog(`${this.enemy.name} gagne ${pattern.value} blocage.`);
                this.emitEnemyAction("defend");
                break;

            case "buff":
                if (!this.enemy.statuses) this.enemy.statuses = {};
                this.enemy.statuses[pattern.status] = (this.enemy.statuses[pattern.status] || 0) + pattern.statusValue;
                this.emitLog(`${this.enemy.name} gagne ${pattern.statusValue} ${StatusTypes[pattern.status]?.name || pattern.status}.`);
                this.emitEnemyAction("buff");
                break;

            case "debuff":
                if (!this.player.statuses) this.player.statuses = {};
                this.player.statuses[pattern.status] = (this.player.statuses[pattern.status] || 0) + pattern.statusValue;
                this.emitLog(`${this.enemy.name} applique ${pattern.statusValue} ${StatusTypes[pattern.status]?.name || pattern.status}.`);
                this.emitEnemyAction("debuff");
                break;
        }
    }

    // === Game state ===

    checkGameOver() {
        if (this.isGameOver) return true;

        if (this.enemy.hp <= 0) {
            this.isGameOver = true;
            this.result = "victory";
            this.emitLog("Victoire !");
            this.emitGameOver("victory");
            return true;
        }

        if (this.player.hp <= 0) {
            this.isGameOver = true;
            this.result = "defeat";
            this.emitLog("Défaite...");
            this.emitGameOver("defeat");
            return true;
        }

        return false;
    }

    // === Helpers de description ===

    getCardDescription(card) {
        let desc = card.description;
        for (const effect of card.effects) {
            if (effect.type === "damage" || effect.type === "damage_from_block") {
                const dmg = effect.type === "damage_from_block"
                    ? this.player.block
                    : EffectProcessor.calculateDamage(effect.value, this.player, this.enemy);
                desc = desc.replace("{damage}", dmg);
            }
            if (effect.type === "block" || effect.type === "double_block") {
                desc = desc.replace("{block}", effect.value || this.player.block);
            }
            if (effect.type === "apply_status") {
                desc = desc.replace("{value}", effect.value || effect.statusValue);
            }
        }
        return desc;
    }

    // === Event emitters ===

    emitStateChange() {
        if (this.onStateChange) this.onStateChange(this);
    }

    emitLog(message) {
        if (this.onLog) this.onLog(message);
    }

    emitCardPlayed(card, index) {
        if (this.onCardPlayed) this.onCardPlayed(card, index);
    }

    emitEnemyAction(type) {
        if (this.onEnemyAction) this.onEnemyAction(type);
    }

    emitGameOver(result) {
        if (this.onGameOver) this.onGameOver(result);
    }

    emitDamagePopup(target, value, type) {
        if (this.onDamagePopup) this.onDamagePopup(target, value, type);
    }
}
