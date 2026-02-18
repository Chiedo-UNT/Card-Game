/**
 * UI du créateur de carte
 *
 * Formulaire complet avec preview en temps réel,
 * constructeur d'effets interactif, et gestion des cartes custom.
 */

class CardCreatorUI {
    constructor() {
        this.nameEl = document.getElementById("cc-name");
        this.costEl = document.getElementById("cc-cost");
        this.typeEl = document.getElementById("cc-type");
        this.heroEl = document.getElementById("cc-hero");
        this.artEl = document.getElementById("cc-art");
        this.descEl = document.getElementById("cc-desc");
        this.keywordsEl = document.getElementById("cc-keywords");
        this.effectsListEl = document.getElementById("cc-effects-list");
        this.addEffectBtn = document.getElementById("cc-add-effect");
        this.previewEl = document.getElementById("cc-preview");
        this.saveBtn = document.getElementById("cc-save");
        this.customCardsEl = document.getElementById("cc-custom-cards");
        this.customCountEl = document.getElementById("cc-custom-count");

        this._eventsbound = false;
        this.editingCardId = null; // null = création, sinon = édition
    }

    init() {
        if (!this._eventsbound) {
            this._eventsbound = true;
            this.bindEvents();
        }
        this.resetForm();
        this.updatePreview();
        this.renderCustomCards();
    }

    bindEvents() {
        // Preview en temps réel sur chaque changement
        const inputs = [this.nameEl, this.costEl, this.typeEl, this.heroEl, this.artEl, this.descEl];
        for (const el of inputs) {
            el.addEventListener("input", () => this.updatePreview());
            el.addEventListener("change", () => this.updatePreview());
        }

        // Keywords
        for (const cb of this.keywordsEl.querySelectorAll("input")) {
            cb.addEventListener("change", () => this.updatePreview());
        }

        // Ajouter un effet
        this.addEffectBtn.addEventListener("click", () => {
            this.addEffectRow();
            this.updatePreview();
        });

        // Sauvegarder
        this.saveBtn.addEventListener("click", () => this.saveCard());
    }

    // === Formulaire ===

    resetForm() {
        this.nameEl.value = "";
        this.costEl.value = "1";
        this.typeEl.value = "attack";
        this.heroEl.value = "warrior";
        this.artEl.value = "";
        this.descEl.value = "";
        this.editingCardId = null;
        this.saveBtn.textContent = "Sauvegarder";

        for (const cb of this.keywordsEl.querySelectorAll("input")) {
            cb.checked = false;
        }

        this.effectsListEl.innerHTML = "";
    }

    addEffectRow(effectData = null) {
        const row = document.createElement("div");
        row.className = "effect-row";

        const typeSelect = document.createElement("select");
        const effectTypes = [
            { value: "damage", label: "Dégâts" },
            { value: "block", label: "Blocage" },
            { value: "apply_status", label: "Appliquer statut" },
            { value: "draw", label: "Piocher" },
            { value: "gain_energy", label: "Gagner énergie" },
            { value: "heal", label: "Soigner" },
            { value: "lose_hp", label: "Perdre PV" },
            { value: "double_block", label: "Doubler blocage" },
            { value: "damage_from_block", label: "Dégâts = Blocage" },
            { value: "discard_random", label: "Défausser aléa." }
        ];
        for (const et of effectTypes) {
            const opt = document.createElement("option");
            opt.value = et.value;
            opt.textContent = et.label;
            typeSelect.appendChild(opt);
        }

        const valueInput = document.createElement("input");
        valueInput.type = "number";
        valueInput.min = "0";
        valueInput.max = "99";
        valueInput.value = "6";
        valueInput.placeholder = "Val";

        const timesInput = document.createElement("input");
        timesInput.type = "number";
        timesInput.min = "1";
        timesInput.max = "10";
        timesInput.value = "1";
        timesInput.placeholder = "x";
        timesInput.title = "Nombre de coups";
        timesInput.style.width = "45px";

        const statusSelect = document.createElement("select");
        const statuses = [
            { value: "poison", label: "Poison" },
            { value: "weakness", label: "Faiblesse" },
            { value: "vulnerable", label: "Vulnérable" },
            { value: "strength", label: "Force" },
            { value: "temp_strength", label: "Force Temp." },
            { value: "block_per_turn", label: "Blocage/Tour" },
            { value: "energy_per_turn", label: "Énergie/Tour" },
            { value: "ritual", label: "Rituel" }
        ];
        for (const s of statuses) {
            const opt = document.createElement("option");
            opt.value = s.value;
            opt.textContent = s.label;
            statusSelect.appendChild(opt);
        }

        const targetSelect = document.createElement("select");
        const targets = [
            { value: "enemy", label: "Ennemi" },
            { value: "self", label: "Soi" }
        ];
        for (const t of targets) {
            const opt = document.createElement("option");
            opt.value = t.value;
            opt.textContent = t.label;
            targetSelect.appendChild(opt);
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-remove-effect";
        removeBtn.innerHTML = "&times;";
        removeBtn.addEventListener("click", () => {
            row.remove();
            this.updatePreview();
        });

        // Affichage dynamique selon le type d'effet
        const updateVisibility = () => {
            const type = typeSelect.value;
            const needsValue = !["double_block", "damage_from_block"].includes(type);
            const needsTimes = type === "damage";
            const needsStatus = type === "apply_status";
            const needsTarget = type === "apply_status";

            valueInput.style.display = needsValue ? "" : "none";
            timesInput.style.display = needsTimes ? "" : "none";
            statusSelect.style.display = needsStatus ? "" : "none";
            targetSelect.style.display = needsTarget ? "" : "none";

            this.updatePreview();
        };

        typeSelect.addEventListener("change", updateVisibility);
        valueInput.addEventListener("input", () => this.updatePreview());
        timesInput.addEventListener("input", () => this.updatePreview());
        statusSelect.addEventListener("change", () => this.updatePreview());
        targetSelect.addEventListener("change", () => this.updatePreview());

        row.appendChild(typeSelect);
        row.appendChild(valueInput);
        row.appendChild(timesInput);
        row.appendChild(statusSelect);
        row.appendChild(targetSelect);
        row.appendChild(removeBtn);

        this.effectsListEl.appendChild(row);

        // Remplir avec les données si on édite
        if (effectData) {
            typeSelect.value = effectData.type;
            if (effectData.value !== undefined) valueInput.value = effectData.value;
            if (effectData.times) timesInput.value = effectData.times;
            if (effectData.status) statusSelect.value = effectData.status;
            if (effectData.target) targetSelect.value = effectData.target;
        }

        updateVisibility();
    }

    // === Collecte des données ===

    getFormData() {
        const keywords = [];
        for (const cb of this.keywordsEl.querySelectorAll("input:checked")) {
            keywords.push(cb.value);
        }

        const effects = [];
        for (const row of this.effectsListEl.querySelectorAll(".effect-row")) {
            const selects = row.querySelectorAll("select");
            const inputs = row.querySelectorAll("input");
            const type = selects[0].value;
            const value = parseInt(inputs[0].value) || 0;
            const times = parseInt(inputs[1].value) || 1;
            const status = selects[1].value;
            const target = selects[2].value;

            const effect = { type };

            if (!["double_block", "damage_from_block"].includes(type)) {
                effect.value = value;
            }
            if (type === "damage" && times > 1) {
                effect.times = times;
            }
            if (type === "apply_status") {
                effect.status = status;
                effect.target = target;
            }

            effects.push(effect);
        }

        return {
            name: this.nameEl.value.trim() || "Sans Nom",
            type: this.typeEl.value,
            cost: parseInt(this.costEl.value),
            hero: this.heroEl.value,
            art: this.artEl.value || "🃏",
            description: this.descEl.value || "Pas de description.",
            keywords,
            effects
        };
    }

    // === Preview ===

    updatePreview() {
        const data = this.getFormData();
        const card = {
            id: "_preview",
            ...data
        };

        this.previewEl.innerHTML = "";
        const el = CardRenderer.createCardElement(card, { playable: true });
        el.style.cursor = "default";
        this.previewEl.appendChild(el);
    }

    // === Sauvegarde ===

    saveCard() {
        const data = this.getFormData();

        if (!data.name || data.name === "Sans Nom") {
            this.nameEl.style.borderColor = "var(--accent)";
            setTimeout(() => this.nameEl.style.borderColor = "", 1500);
            this.nameEl.focus();
            return;
        }

        if (data.effects.length === 0) {
            this.addEffectBtn.style.background = "var(--accent)";
            setTimeout(() => this.addEffectBtn.style.background = "", 1500);
            return;
        }

        if (this.editingCardId) {
            // Mode édition
            game.updateCustomCard(this.editingCardId, data);
        } else {
            // Création
            game.addCustomCard(data);
        }

        this.resetForm();
        this.updatePreview();
        this.renderCustomCards();
    }

    // === Liste des cartes custom ===

    renderCustomCards() {
        this.customCardsEl.innerHTML = "";
        const customs = game.getCustomCards();
        this.customCountEl.textContent = `(${customs.length})`;

        for (const card of customs) {
            const entry = document.createElement("div");
            entry.className = `custom-card-entry type-${card.type}`;

            const costEl = document.createElement("span");
            costEl.className = "cc-entry-cost";
            costEl.textContent = card.cost;

            const infoEl = document.createElement("span");
            infoEl.className = "cc-entry-info";
            infoEl.textContent = `${card.art} ${card.name}`;

            const editBtn = document.createElement("button");
            editBtn.className = "btn-edit-card";
            editBtn.innerHTML = "&#9998;";
            editBtn.title = "Modifier";
            editBtn.addEventListener("click", () => this.editCard(card));

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "btn-delete-card";
            deleteBtn.innerHTML = "&times;";
            deleteBtn.title = "Supprimer";
            deleteBtn.addEventListener("click", () => this.deleteCard(card.id));

            entry.appendChild(costEl);
            entry.appendChild(infoEl);
            entry.appendChild(editBtn);
            entry.appendChild(deleteBtn);

            this.customCardsEl.appendChild(entry);
        }
    }

    editCard(card) {
        this.editingCardId = card.id;
        this.nameEl.value = card.name;
        this.costEl.value = card.cost;
        this.typeEl.value = card.type;
        this.heroEl.value = card.hero;
        this.artEl.value = card.art;
        this.descEl.value = card.description;
        this.saveBtn.textContent = "Mettre à jour";

        // Keywords
        for (const cb of this.keywordsEl.querySelectorAll("input")) {
            cb.checked = card.keywords.includes(cb.value);
        }

        // Effets
        this.effectsListEl.innerHTML = "";
        for (const effect of card.effects) {
            this.addEffectRow(effect);
        }

        this.updatePreview();
        this.nameEl.focus();
    }

    deleteCard(cardId) {
        if (!confirm("Supprimer cette carte ?")) return;
        game.deleteCustomCard(cardId);
        this.renderCustomCards();
    }
}
