// Forge system
// Uses Poudre d'Éther resource
// Formula: Z = X + A where A = 10 * number of previous upgrades on the card
// X from forgeCostTable based on current value
// Talent cards not forgeable

(function () {
class ForgeSystem {
  constructor() {
    // Cost table: indexed by the *current* value of the attribute being changed.
    // Key: current numeric value → base cost X to change it by 1 step.
    // For values not in this table the formula falls back to the range bucket.
    //
    // These costs apply to numeric attributes (damage, cost, stacks, duration, etc.)
    // Changing by more than 1 step = sum of individual step costs.
    this._numericCostTable = {
      0:  4,
      1:  5,
      2:  6,
      3:  8,
      4:  10,
      5:  13,
      6:  16,
      7:  20,
      8:  25,
      9:  30,
      10: 36,
    };

    // Cost multiplier for boolean-like attributes (present/absent flags)
    this._booleanCost = 20;

    // Rarity destroy values
    this._cardDestroyValues = {
      'Commune':    5,
      'Rare':       15,
      'Légendaire': 40,
      'Unique':     100,
    };
    this._weaponDestroyValues = {
      'Commune':    10,
      'Rare':       25,
      'Légendaire': 60,
      'Unique':     150,
    };

    // Attributes that may be upgraded (dot-notation paths supported)
    // The forge UI uses these to build the option list
    this.upgradeableAttributes = [
      'effects[0].amount',   // primary effect value
      'effects[1].amount',   // secondary effect value
      'effects[0].stacks',
      'effects[0].duration',
      'effects[1].stacks',
      'effects[1].duration',
      'manaCost',
      'enduranceCost',
      'initiativeCost',
    ];
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  // Calculate cost to change an attribute from currentValue to targetValue
  // attributePath uses dot-notation (e.g. "effects[0].amount", "manaCost")
  calculateCost(cardInstance, attributePath, targetValue) {
    if (!cardInstance || this._isTalentCard(cardInstance)) return Infinity;

    const upgrades = cardInstance.upgradeCount || 0;
    const A = 10 * upgrades;

    const currentVal = this._getAttr(cardInstance, attributePath);
    const X = this._lookupCost(cardInstance, attributePath, currentVal, targetValue);

    return X + A;
  }

  // Apply an upgrade to a card instance
  // Returns { success: bool, cost: number, reason?: string, newValue? }
  applyUpgrade(cardInstance, attributePath, targetValue, availablePowder) {
    if (!cardInstance) return { success: false, reason: 'no_card' };
    if (this._isTalentCard(cardInstance)) return { success: false, reason: 'talent_not_forgeable' };

    const cost = this.calculateCost(cardInstance, attributePath, targetValue);
    if (!isFinite(cost)) return { success: false, reason: 'not_upgradeable' };
    if (availablePowder < cost) return { success: false, reason: 'insufficient_powder' };

    const oldValue = this._getAttr(cardInstance, attributePath);
    this._setAttr(cardInstance, attributePath, targetValue);
    cardInstance.upgradeCount = (cardInstance.upgradeCount || 0) + 1;

    // Track upgrade history for display / audit
    if (!cardInstance.upgradeHistory) cardInstance.upgradeHistory = [];
    cardInstance.upgradeHistory.push({
      path: attributePath,
      from: oldValue,
      to: targetValue,
      cost,
    });

    return { success: true, cost, newValue: targetValue };
  }

  // Calculate poudre d'éther gained from destroying a card
  getDestroyValue(cardRarity) {
    return this._cardDestroyValues[cardRarity] || 5;
  }

  // Calculate poudre d'éther gained from destroying a weapon
  getWeaponDestroyValue(weaponRarity) {
    return this._weaponDestroyValues[weaponRarity] || 10;
  }

  // Get all available upgrades for a card with their costs
  // Returns array of { path, currentValue, options: [{ value, cost }] }
  getUpgradeOptions(cardInstance, availablePowder) {
    if (!cardInstance || this._isTalentCard(cardInstance)) return [];
    const results = [];

    for (const path of this.upgradeableAttributes) {
      const currentVal = this._getAttr(cardInstance, path);
      if (currentVal === undefined || currentVal === null) continue;

      const options = [];

      if (typeof currentVal === 'number') {
        // Offer ±1 and ±2 steps where meaningful
        for (const delta of [-2, -1, 1, 2]) {
          const target = currentVal + delta;
          if (target < 0) continue; // don't allow negative stats
          const cost = this.calculateCost(cardInstance, path, target);
          options.push({ value: target, cost, affordable: availablePowder >= cost });
        }
      } else if (typeof currentVal === 'boolean') {
        const target = !currentVal;
        const cost = this.calculateCost(cardInstance, path, target);
        options.push({ value: target, cost, affordable: availablePowder >= cost });
      }

      if (options.length > 0) {
        results.push({ path, currentValue: currentVal, options });
      }
    }

    return results;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  _isTalentCard(card) {
    return !!(card.isTalent || (Array.isArray(card.tags) && card.tags.includes('Talent')));
  }

  // dot-notation + bracket-notation getter
  // Supports paths like "effects[0].amount" or "manaCost"
  _getAttr(obj, path) {
    const parts = this._parsePath(path);
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof part === 'number') {
        current = Array.isArray(current) ? current[part] : undefined;
      } else {
        current = current[part];
      }
    }
    return current;
  }

  // dot-notation + bracket-notation setter
  _setAttr(obj, path, val) {
    const parts = this._parsePath(path);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      if (current[part] === undefined || current[part] === null) {
        // Auto-create intermediate objects/arrays
        current[part] = typeof nextPart === 'number' ? [] : {};
      }
      current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    current[lastPart] = val;
  }

  // Parse a path string like "effects[0].amount" into ["effects", 0, "amount"]
  _parsePath(path) {
    const parts = [];
    // Split on dots and brackets
    const raw = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    for (const r of raw) {
      const num = parseInt(r, 10);
      parts.push(isNaN(num) ? r : num);
    }
    return parts;
  }

  // Calculate base cost X to change attribute at `path` from `from` to `to`
  _lookupCost(card, path, from, to) {
    if (from === to) return 0;

    if (typeof from === 'boolean' || typeof to === 'boolean') {
      return this._booleanCost;
    }

    if (typeof from !== 'number' || typeof to !== 'number') {
      // String or unknown type — flat cost
      return 25;
    }

    // Sum the step costs between from and to
    const direction = to > from ? 1 : -1;
    let total = 0;
    let cursor = from;

    while (cursor !== to) {
      // Cost of changing from `cursor` by one step in direction
      const stepCost = this._stepCost(cursor, direction, path);
      total += stepCost;
      cursor += direction;
    }

    return total;
  }

  // Cost of a single step at a given numeric value
  // The cost depends on whether we're increasing or decreasing:
  //   increasing: cost is based on current value (going up is more expensive)
  //   decreasing: cost is based on target value (going down from high values is cheap)
  _stepCost(value, direction, path) {
    // Certain attributes cost less to modify (costs, durations)
    const isCostAttr = path.endsWith('Cost') || path.endsWith('cost');
    const isDurationAttr = path.endsWith('duration') || path.endsWith('Duration');

    let lookupValue;
    if (direction > 0) {
      // Increasing: current value determines cost
      lookupValue = value;
    } else {
      // Decreasing: target value (value-1) determines cost
      lookupValue = value - 1;
    }

    const baseCost = this._numericCostTable[lookupValue] !== undefined
      ? this._numericCostTable[lookupValue]
      : this._extrapolatedCost(lookupValue);

    // Reducing costs/durations is cheaper (it weakens the card)
    // Increasing amounts is standard
    if ((isCostAttr || isDurationAttr) && direction < 0) {
      return Math.ceil(baseCost * 0.6);
    }
    if ((isCostAttr || isDurationAttr) && direction > 0) {
      return Math.ceil(baseCost * 0.8);
    }

    return baseCost;
  }

  // Extrapolate cost for values beyond the table (>10)
  _extrapolatedCost(value) {
    if (value <= 0) return 4;
    if (value >= 10) {
      // Quadratic growth beyond 10
      return Math.ceil(36 + (value - 10) * (value - 10) * 4);
    }
    // Should not reach here, but guard anyway
    return Math.ceil(4 + value * value * 0.3);
  }
}

window.ForgeSystem = new ForgeSystem();
})();
