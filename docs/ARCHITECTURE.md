# Architecture — Dark Fantasy Card Roguelite

> Version documentée : commit `53e0186` · Branche `claude/modular-game-localization-28k7X`

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Features](#2-features)
3. [Arborescence du code](#3-arborescence-du-code)
4. [API & contrats entre modules](#4-api--contrats-entre-modules)
5. [Bus d'événements — référence complète](#5-bus-dévénements--référence-complète)
6. [Structure de la sauvegarde](#6-structure-de-la-sauvegarde)
7. [Système de contenu modulaire](#7-système-de-contenu-modulaire)
8. [Décisions d'architecture](#8-décisions-darchitecture)
9. [Questions de domaine et décisions prises](#9-questions-de-domaine-et-décisions-prises)

---

## 1. Vue d'ensemble du projet

**Genre :** Card roguelite dark-fantasy, tour par tour, grille hexagonale.

**Stack :** Vanilla JavaScript (ES6 classes, IIFE), HTML5, CSS custom properties. Aucun framework, aucune dépendance externe. Persistence via `localStorage`. Chargement de contenu via `fetch()` (JSON).

**Principe directeur :** chaque système est un singleton ou une classe stateless exposé sur `window`. Les systèmes communiquent exclusivement via le bus d'événements `Engine.bus`. Les écrans sont instanciés à la demande et détruits lors des transitions.

**Séquence de démarrage :**
```
DOMContentLoaded
  └─ Boot() [main.js]
       └─ Engine.init()
            ├─ loadModule('base')          → registre de contenu
            ├─ Save.load()                 → état restauré
            ├─ I18n.init(lang)             → chaînes chargées
            └─ showScreen('menu')          → interface visible
```

---

## 2. Features

| Feature | Fichiers principaux |
|---|---|
| Génération de carte roguelite | `core/map.js` |
| Navigation sur la carte du monde | `ui/screens/map-screen.js` |
| Combat hex tour-par-tour | `core/combat.js`, `ui/screens/combat-screen.js`, `ui/components/hex-grid.js` |
| Gestion de deck & main | `core/combat.js` — méthodes deck |
| Effets de statut (poison, berserk, etc.) | `core/combat.js` — `applyStatus`, `tickStatuses` |
| IA ennemie par patterns cycliques | `core/combat.js` — `calculateEnemyAction` |
| Forge de cartes (upgrade) | `core/forge.js`, `ui/screens/forge-screen.js` |
| Arbre de talents | `ui/screens/talent-screen.js` |
| Marchand / économie | `ui/screens/merchant-screen.js` |
| Collection & construction de deck | `ui/screens/collection-screen.js` |
| Création de personnage | `ui/screens/character-creation.js` |
| Sélection de personnage | `ui/screens/character-select.js` |
| QTE (action rapide) | `core/qte.js`, `ui/components/qte-overlay.js` |
| Localisation FR/EN | `core/i18n.js` |
| Persistence | `core/save.js` |
| Système de tags & filtrage | `core/tags.js` |
| Rendu de cartes | `ui/components/card-renderer.js` |
| Timeline de combat | `ui/components/timeline.js` |
| Contenu modulaire JSON | `modules/base/` |
| Résultat de combat / repos / événement | `ui/screens/result-screen.js` |

---

## 3. Arborescence du code

```
Card-Game/
├── index.html
├── main.js
├── styles/
│   ├── main.css          tokens CSS, design system
│   ├── cards.css
│   ├── combat.css
│   ├── map.css
│   ├── screens.css
│   └── ui/ui.css
├── core/
│   ├── engine.js
│   ├── save.js
│   ├── i18n.js
│   ├── tags.js
│   ├── hex.js
│   ├── combat.js
│   ├── map.js
│   ├── qte.js
│   └── forge.js
├── ui/
│   ├── components/
│   │   ├── card-renderer.js
│   │   ├── hex-grid.js
│   │   ├── timeline.js
│   │   └── qte-overlay.js
│   └── screens/
│       ├── menu.js
│       ├── character-creation.js
│       ├── character-select.js
│       ├── map-screen.js
│       ├── combat-screen.js
│       ├── forge-screen.js
│       ├── talent-screen.js
│       ├── merchant-screen.js
│       ├── collection-screen.js
│       └── result-screen.js
├── modules/
│   └── base/
│       ├── module.json
│       ├── lang/fr.json
│       ├── cards/{cardId}/card.json
│       ├── weapons/{weaponId}/weapon.json
│       ├── enemies/{enemyId}/enemy.json
│       ├── archetypes/{archetypeId}/archetype.json
│       ├── talents/{talentId}/talent.json
│       └── events/{eventId}/event.json
└── docs/
    └── ARCHITECTURE.md   (ce fichier)
```

---

### `main.js`

Point d'entrée. Attend `DOMContentLoaded` puis appelle `Engine.init()`. Gère l'overlay de chargement (barre de progression, fade-out).

---

### `core/engine.js`

#### Classe `EventBus`

| Méthode | Description |
|---|---|
| `on(event, fn)` | Abonner un listener |
| `off(event, fn)` | Désabonner |
| `emit(event, data)` | Diffuser un événement (itération sur copie, safe) |
| `once(event, fn)` | Listener auto-détruit après premier déclenchement |
| `clear(event?)` | Supprimer tous les listeners d'un événement, ou tous |

#### Classe `Engine` (singleton → `window.Engine`)

**Initialisation & chargement de modules**

| Méthode | Description |
|---|---|
| `async init()` | Séquence de démarrage complète |
| `async loadModule(modulePath)` | Charge `module.json` + toutes les ressources JSON en parallèle |
| `async _loadResources(modulePath, type, ids, target)` | Fetch parallèle de ressources par type |
| `_mergeIntoRegistry(moduleData)` | Fusionne le module dans le registre global, avertit sur conflits |

**Gestion des écrans**

| Méthode | Description |
|---|---|
| `showScreen(name, params)` | Détruit l'écran courant, instancie le suivant, gère la visibilité DOM |

**Registre de contenu**

| Méthode | Description |
|---|---|
| `getCard(id)` | Définition d'une carte |
| `getWeapon(id)` | Définition d'une arme |
| `getEnemy(id)` | Définition d'un ennemi |
| `getArchetype(id)` | Définition d'un archétype |
| `getEvent(id)` | Définition d'un événement |
| `getTalent(id)` | Définition d'un talent |
| `getAllCards()` / `getAllWeapons()` / … | Accesseurs bulk |
| `getCardsByTag(tag)` | Filtrer les cartes par tag |
| `getCardsByArchetype(archetypeId)` | Filtrer les cartes par archétype |
| `getWeaponsByType(weaponType)` | Filtrer les armes par type |

**État**

| Propriété / Méthode | Description |
|---|---|
| `state` | Objet état global (characters, runs, settings) |
| `getState()` / `setState(s)` | Accesseurs |
| `isInitialized()` | Guard boostrap |
| `bus` | Instance d'EventBus (référence publique) |

---

### `core/save.js`

Persistence `localStorage`. Clé : `cardgame_save`. Version : `1`.

#### Classe `Save` (singleton → `window.Save`)

**Persistence**

| Méthode | Description |
|---|---|
| `save()` | JSON.stringify vers localStorage |
| `load()` | Parse depuis localStorage, migre, synchronise avec Engine.state |
| `_migrate(state)` | Migration v0→v1, garantit la présence de tous les champs |

**Personnages**

| Méthode | Description |
|---|---|
| `createCharacter(name, archetypeId, stats)` | Génère un ID, crée la structure, persiste |
| `deleteCharacter(charId)` | Supprime, réoriente `currentCharId` si nécessaire |
| `getCurrentChar()` | Retourne le personnage actif |
| `setCurrentChar(charId)` | Définit le personnage actif |

**Run**

| Méthode | Description |
|---|---|
| `startRun(charId, deckChoice)` | Crée un snapshot de run, copie l'équipement, initialise les ressources |
| `endRun(survived)` | Si survie : fusionne l'or/poudre at-risk vers banque. Efface le run |
| `saveRunState(runData)` | Merge partiel de mises à jour du run |
| `getCurrentRun()` | Retourne le run actif |

**Paramètres & divers**

| Méthode | Description |
|---|---|
| `getSetting(key)` / `setSetting(key, val)` | Préférences utilisateur |
| `reset()` | Effacer toute la sauvegarde |
| `export()` / `import(json)` | Backup / restauration |

**Factories internes**

| Méthode | Description |
|---|---|
| `_defaultState()` | Structure initiale vide |
| `_defaultCharacter(id, name, archetypeId, stats)` | Structure personnage complète |
| `_defaultRun(charId, deck)` | Structure run complète |

---

### `core/i18n.js`

Localisation FR/EN (extensible). Clés imbriquées aplaties en dot-notation (`ui.map.title`).

#### Classe `I18n` (singleton → `window.I18n`, alias global `window.t`)

| Méthode | Description |
|---|---|
| `async init(lang)` | Définir la langue, vider les chaînes |
| `async loadModuleStrings(modulePath, lang)` | Charger et fusionner `modulePath/lang/[lang].json` ; fallback sur `fr` |
| `t(key, vars)` | Retourne la chaîne traduite, remplace `{{var}}` ; retourne la clé si absente |
| `has(key)` | Vérifie l'existence d'une clé |
| `async setLanguage(lang)` | Rechargement complet, persiste dans settings, émet `language:change` |
| `getAllStrings()` | Debug : copie de toutes les chaînes |
| `get currentLang` | Langue active |

---

### `core/tags.js`

Gestion des tags actifs (arme équipée + effets de statut) et vérification de jouabilité des cartes.

#### Classe `TagSystem` (singleton → `window.TagSystem`)

**Tags actifs**

| Méthode | Description |
|---|---|
| `setActiveTags(tags)` | Remplacer le set de tags actifs |
| `addTag(tag)` / `removeTag(tag)` / `clearTags()` | Modification unitaire |
| `hasTag(tag)` | Vérifier (wildcard `ANY`) |
| `getActiveTags()` | Copie du tableau actif |

**Jouabilité**

| Méthode | Description |
|---|---|
| `canPlay(cardRequires)` | AND entre groupes, OR à l'intérieur (séparateur `\|`) |
| `filterPlayable(cards)` | Filtrer un tableau de cartes |
| `partitionPlayable(cards)` | Retourne `{ playable, unplayable }` |

**Armes**

| Méthode | Description |
|---|---|
| `getWeaponTags(weaponData)` | Tags standard du type + tags personnalisés |
| `applyWeaponContext(equippedWeapons, extraTags)` | Définit les tags actifs depuis armes + statuts |
| `static getLabelForTag(tag)` | Nom d'affichage français |
| `static tagsForType(weaponType)` | Tags associés à un type d'arme |

---

### `core/hex.js`

Utilitaires mathématiques pour grille hexagonale. **Orientation flat-top** (sommet à gauche/droite). Coordonnées axiales `(q, r)`.

#### Classe `HexGrid` (static → `window.HexGrid`)

**Distance & voisins**

| Méthode | Description |
|---|---|
| `distance(a, b)` | Distance de Chebyshev en coordonnées axiales |
| `neighbors(q, r)` | 6 hexagones adjacents |

**Anneau & spirale**

| Méthode | Description |
|---|---|
| `ring(center, radius)` | Tous les hexs à exactement `radius` pas |
| `spiral(center, maxRadius)` | Tous les hexs de 0 à maxRadius (spirale) |

**Lignes & cônes**

| Méthode | Description |
|---|---|
| `line(start, direction, length)` | Ligne droite dans une direction (0-5) |
| `cone(origin, direction, length)` | Cône 3 cases de large |

**Conversion pixel (flat-top)**

| Méthode | Description |
|---|---|
| `toPixel(q, r, size)` | Axial → centre pixel |
| `fromPixel(x, y, size)` | Pixel → axial le plus proche |
| `round(fracQ, fracR)` | Arrondi de coordonnées axiales fractionnaires |

**Bornes & énumération**

| Méthode | Description |
|---|---|
| `inBounds(q, r, width, height)` | Vérifie l'appartenance à une grille rectangulaire (even-q offset) |
| `gridHexes(cols, rows)` | Tous les hexs d'une grille rectangulaire |

**Conversion offset (even-q, flat-top)**

| Méthode | Description |
|---|---|
| `offsetToAxial(col, row)` | Offset → axial |
| `axialToOffset(q, r)` | Axial → offset |

**Pathfinding**

| Méthode | Description |
|---|---|
| `findPath(start, goal, blockedHexes, width, height)` | A* ; retourne le chemin ou `null` si inatteignable |

**Utilitaires**

| Méthode | Description |
|---|---|
| `key(q, r)` / `parseKey(key)` | Conversion chaîne↔hex |
| `buildBlockedSet(hexArray)` | Convertit un tableau en Set de clés bloquées |
| `equal(a, b)` | Comparaison de coordonnées |
| `fitSize(cols, rows, cW, cH)` | Taille de hex pour tenir dans des bornes |
| `forwardNeighbors(q, r)` | Voisins côté droit uniquement (progression gauche→droite) |

---

### `core/combat.js`

Machine à états du combat. Gère la grille, le deck, les statuts, l'IA.

#### Classe `CombatState` (→ `window.CombatState`)

**Deck & main**

| Méthode | Description |
|---|---|
| `_initDeck()` | Mélanger le deck, distribuer la main initiale (5 cartes) |
| `_shuffle(arr)` | Fisher-Yates |
| `drawCards(count)` | Piocher, reshuffle automatique si deck vide |

**Timeline (ordre des tours)**

| Méthode | Description |
|---|---|
| `buildTimeline(lookahead)` | Générer les prochains tours par vitesse d'unité (interval = max(1, 20 - rapidite)) |
| `nextTurn()` | Dépiler la timeline, tick des statuts, gérer étourdissement, émettre événements |

**Cartes**

| Méthode | Description |
|---|---|
| `applyCard(cardId, sourceId, targetPos)` | Valider coûts, appliquer effets, déplacer la carte (défausse/perdue) |
| `_executeCardEffects(cardDef, sourceId, targetPos)` | Dispatcher les effets d'une carte |
| `_applyEffect(effect, sourceId, targetPos, cardDef)` | Exécuter un effet par type |

**Types d'effets supportés**

| Type | Comportement |
|---|---|
| `damage` | Invisibilité, bonus puissance/faiblesse/berserk, réduction armure/bouclier |
| `heal` | Restaurer HP |
| `status` | Appliquer statut avec stacks/durée |
| `move` | Déplacer une unité |
| `push` | Repousser (dommages de collision si bloqué) |
| `draw` | Piocher N cartes |
| `shield` | Appliquer bouclier |
| `discard_hand` | Vider la main vers la défausse |
| `restore_mana` | Restaurer du mana |

**Mouvement**

| Méthode | Description |
|---|---|
| `moveUnit(unitId, targetPos)` | Valider (bornes, occupation, terrain), mettre à jour la grille |

**Dommages**

| Méthode | Description |
|---|---|
| `applyDamage(targetId, amount, type)` | Absorption bouclier→armure→HP, émet `combat:unit_defeated` si mort |

**Statuts**

| Méthode | Description |
|---|---|
| `applyStatus(targetId, statusId, stacks, duration)` | Ajouter ou incrémenter un statut |
| `tickStatuses(unitId)` | Décrémenter tous les statuts au début du tour |

**Statuts supportés**

| Statut | Effet par tick |
|---|---|
| `poison` | -1 HP, -1 stack |
| `saignement` | -1 HP, -1 endurance, -1 stack |
| `brulure` | -1 HP, -1 regen, -1 stack |
| `fatigue` | -1 mana, -1 flux, -1 stack |
| `etourdi` | Pénalité de dégâts (stacks consommés lors d'attaque) |
| `assomme` | Skip du tour, octroie immunité |
| `puissance` / `faiblesse` | Bonus/malus dégâts (consommé à l'attaque) |
| `bouclier` | Absorbe dégâts (consommé par dégâts, pas par tick) |
| `echo` | Doublement de la prochaine carte jouée |
| `reflexion` | Renvoie les dégâts à l'attaquant |
| `invisible` | Immunité aux attaques ciblées |
| `berserk` | Bonus dégâts +2, restrictions de tags |

**IA ennemie**

| Méthode | Description |
|---|---|
| `calculateEnemyAction(enemyId)` | Cycle sur `enemy.patterns`, annonce l'intention |
| `executeEnemyAction(enemyId)` | Exécute l'action (attack / move / status / heal / shield / summon) |

**Armes & tags**

| Méthode | Description |
|---|---|
| `switchWeapon()` | Coûte 1 initiative, bascule arme active, reconstruit les tags |
| `_rebuildActiveTags()` | Extrait les tags de l'arme équipée |

**Consommables**

| Méthode | Description |
|---|---|
| `useConsumable(slot)` | Exécuter les effets, retirer du slot |

**Tour**

| Méthode | Description |
|---|---|
| `endTurn()` | Défausser la main, piocher, restaurer partiellement l'endurance |
| `checkCombatEnd()` | `'player_lose'` / `'player_win'` / `null` |
| `getDamageBonus(tags, source)` | Calcul des bonus de dégâts par stat et par statut |

---

### `core/map.js`

Génération procédurale de la carte roguelite (13 colonnes × 8 lignes, progression gauche→droite).

#### Classe `MapGenerator` (→ `window.MapGenerator`)

| Méthode | Description |
|---|---|
| `generate(zone)` | Retourne `{ nodes, edges, entry, exit }` |
| `_seededRng(seed)` | LCG Park-Miller, retourne une fonction `() → [0,1)` |
| `_weightedChoice(weights)` | Choix aléatoire pondéré |
| `_shuffle(arr)` | Fisher-Yates in-place |
| `_placeNodes(cols, rows, zone)` | Distribuer les nœuds (1 entrée, 2-5 par colonne, 1 repos, 1 boss) |
| `_createEdges(nodes, cols, rows)` | Connexions forward uniquement (1-3 voisins par nœud) |
| `_assignTypes(nodes, zone)` | Assignation pondérée par zone |
| `_ensureConnectivity(nodes, edges, cols)` | Ajouter des arêtes-ponts si un nœud est isolé |
| `getVisibleNodes(currentNodeId, nodes, edges, visionRange)` | BFS avec profondeur de vision |
| `getReachableNodes(currentNodeId, nodes, edges)` | Nœuds forward directs depuis la position actuelle |

---

### `core/qte.js`

Système de QTE (Quick-Time Event) : cercle rétrécissant, zones de résultat.

#### Classe `QTESystem` (singleton → `window.QTESystem`)

| Méthode | Description |
|---|---|
| `trigger(type, onCallback)` | Déclenche le QTE, retourne `Promise<'critical'\|'success'\|'fail'>` |
| `_buildUI(type)` | Crée l'overlay canvas avec label et hint |
| `_draw(currentRadius)` | Rendu des zones concentriques et du cercle mobile |
| `_commit()` | Calcule le résultat selon le rayon actuel |
| `_finish(result)` | Flash textuel, nettoyage après 420ms |

**Zones (rayon décroissant sur ~2 secondes) :**
- `> 65%` → pas encore (rien)
- `35–65%` → `success`
- `15–35%` → `critical`
- `< 15%` → `fail`

---

### `core/forge.js`

Système d'amélioration de cartes par dépense de Poudre d'Éther.

#### Classe `ForgeSystem` (singleton → `window.ForgeSystem`)

| Méthode | Description |
|---|---|
| `calculateCost(cardInstance, attributePath, targetValue)` | Coût total en poudre |
| `applyUpgrade(cardInstance, attributePath, targetValue, availablePowder)` | Exécute l'upgrade, incrémente `upgradeCount`, trace l'historique |
| `getDestroyValue(cardRarity)` | Poudre récupérée en détruisant une carte |
| `getWeaponDestroyValue(rarity)` | Poudre récupérée en détruisant une arme |
| `getUpgradeOptions(cardInstance, availablePowder)` | Retourne un tableau de `{ path, currentValue, options }` |
| `_isTalentCard(card)` | Cartes non-améliorables |
| `_getAttr(obj, path)` / `_setAttr(obj, path, val)` | Accès dot/bracket notation (ex: `effects[0].amount`) |
| `_parsePath(path)` | Parse une chaîne de chemin en tableau de parties |
| `_lookupCost(card, path, from, to)` | Somme des coûts entre deux valeurs |
| `_stepCost(value, direction, path)` | Coût d'un pas unitaire |
| `_extrapolatedCost(value)` | Croissance quadratique pour valeurs > 10 |

**Formule de coût :** `Coût = X + A` où `X` = coût de base (table), `A = 10 × upgradeCount`
**Modificateurs :** attributs coût/durée -40% à réduire, -20% à augmenter ; booléens = 20 poudre fixe.

---

### `ui/components/card-renderer.js`

Rendu des cartes en DOM.

#### Classe `CardRenderer` (static → `window.CardRenderer`)

| Méthode | Description |
|---|---|
| `static create(cardData, options)` | Crée un élément DOM carte complet (hover 3D, tooltip) |
| `static createSmall(cardData)` | Miniature compacte pour grilles |
| `static setPlayable(el, canPlay)` | Ajoute/retire les classes `card-playable` / `card-unplayable` |
| `static animatePlay(cardEl, targetPos, onComplete)` | Clone la carte, la fait voler vers la cible et la réduit |
| `static animateDraw(cardEl, onComplete)` | Entrée depuis la droite avec scale/opacité |

---

### `ui/components/hex-grid.js`

Rendu visuel de la grille hexagonale de combat (flat-top).

#### Classe `HexGridRenderer` (→ `window.HexGridRenderer`)

| Méthode | Description |
|---|---|
| `build()` | Crée toutes les cellules hex, les positionne en absolu |
| `setCellState(q, r, state)` | Applique une classe CSS d'état (`reachable`, `attackable`, `selected`, `highlighted`) |
| `clearAllHighlights()` | Efface toutes les surbrillances |
| `highlight(hexes, state)` | Applique un état à un tableau de hexs |
| `selectCell(q, r)` | Marque une cellule comme sélectionnée |
| `addToken(unitId, q, r, opts)` | Crée un jeton d'unité (joueur ou ennemi) avec icône |
| `moveToken(unitId, q, r)` | Anime le déplacement d'un jeton |
| `removeToken(unitId)` | Supprime un jeton |
| `updateTokenHP(unitId, hp, maxHp)` | Ajoute/met à jour le badge HP sous le jeton |
| `destroy()` | Vide le conteneur |

---

### `ui/components/timeline.js`

Affichage de l'ordre d'initiative (jusqu'à 8 entrées).

#### Classe `TimelineComponent` (→ `window.TimelineComponent`)

| Méthode | Description |
|---|---|
| `mount()` | S'abonne à `combat:timeline_updated` |
| `update(timeline)` | Re-rendu manuel |
| `destroy()` | Nettoyage du listener |

---

### `ui/components/qte-overlay.js`

Wrapper UI du QTE (badge HUD + délégation à `QTESystem`).

#### Classe `QTEOverlay` (→ `window.QTEOverlay`)

| Méthode | Description |
|---|---|
| `async run(type)` | Affiche le badge, déclenche QTE, émet `qte:result`, retourne le résultat |
| `_showBadge(type)` / `_hideBadge()` | Badge fixe avec animation pulsée |

---

### `ui/screens/menu.js`

#### Classe `MenuScreen`

| Méthode | Description |
|---|---|
| `init()` | Construction DOM, démarrage de l'animation de sous-titre |
| `destroy()` | Nettoyage |

---

### `ui/screens/character-creation.js`

#### Classe `CharacterCreationScreen`

| Méthode | Description |
|---|---|
| `init()` | Affiche les 5 archétypes, gère le mode stats custom (30 points) |
| `_selectArchetype(id)` | Met à jour l'aperçu des stats dérivées |
| `_adjustStat(stat, delta)` | +/- sur une stat (mode custom uniquement) |
| `_submit()` | `Save.createCharacter()` → `Save.startRun()` → écran map |
| `_derivedStats(stats, arch)` | HP/Mana/Endurance/Initiative calculés |

**Archétypes :** `mage`, `roublard`, `guerrier`, `berzerk`, `custom`

---

### `ui/screens/character-select.js`

#### Classe `CharacterSelectScreen`

| Méthode | Description |
|---|---|
| `init()` | Liste les personnages sauvegardés |
| `_selectChar(charId)` | Charge le personnage, reprend ou démarre un run, navigue vers la carte |
| `_deleteChar(charId)` | Confirmation, suppression |

---

### `ui/screens/map-screen.js`

#### Classe `MapScreen`

| Méthode | Description |
|---|---|
| `init()` | `_initMap()` + `_build()` |
| `destroy()` | Vide l'élément DOM |
| `_initMap()` | Charge ou génère la carte, marque le nœud actuel visité, révèle les nœuds forward |
| `_build()` | Rendu header (HP/or/éther), viewport, footer |
| `_hex()` | Constantes de la grille pointy-top (r=30, W≈52, H=60, ROW=45) |
| `_hexCenter(col, row)` | Centre pixel d'un hexagone avec offset de rang |
| `_renderGrid()` | Grille 13×8 complète : hex DOM outer/inner + SVG des arêtes |
| `_moveToNode(nodeId)` | Trouve le chemin BFS, auto-visite les intermédiaires, entre dans la destination |
| `_enterNode(node)` | Routing vers l'écran approprié selon `node.type` |
| `_revealForwardNodes(fromId)` | Révèle tous les nœuds atteignables en avant (BFS illimité) |
| `_forwardReachable(fromId)` | Retourne un Set de tous les nœuds atteignables vers l'avant |
| `_findForwardPath(fromId, toId)` | BFS chemin le plus court entre deux nœuds (forward uniquement) |
| `_getReachableIds()` | Tous les nœuds forward-atteignables depuis la position actuelle |
| `_nodeLabel(id)` | Nom localisé du nœud |
| `_nodeIcon(type)` | Emoji associé au type de nœud |

---

### `ui/screens/combat-screen.js`

#### Classe `CombatScreen`

| Méthode | Description |
|---|---|
| `init()` | Construction du layout, démarrage du combat |
| `_startCombat()` | Construit `playerData` depuis personnage/archétype/run, détermine les ennemis |
| `_buildEnemies(nodeType)` | Sélectionne le pool d'ennemis par difficulté du nœud |
| `_initHexGrid()` | Crée un `HexGridRenderer` (10×6, size 32) |
| `_placeTokens()` | Ajoute les jetons joueur + ennemis à leurs positions initiales |
| `_renderHand()` | Crée les éléments `CardRenderer` pour la main actuelle |
| `_renderPlayerPanel()` | HP, mana, endurance, icônes de statut du joueur |
| `_renderEnemyPanel()` | HP bars, statuts de chaque ennemi |
| `_updatePiles()` | Compteurs deck/défausse |
| `destroy()` | Nettoyage |

---

### `ui/screens/forge-screen.js`

#### Classe `ForgeScreen`

| Méthode | Description |
|---|---|
| `init()` | Charge les cartes améliorables du run |
| `_selectCard(cardInstance)` | Affiche le panneau de détail avec les options d'upgrade |
| `_applyUpgrade(path, targetValue)` | Appelle `ForgeSystem.applyUpgrade()`, met à jour l'UI |

---

### `ui/screens/talent-screen.js`

#### Classe `TalentScreen`

| Méthode | Description |
|---|---|
| `init()` | Charge les 7 arbres de talents |
| `_selectTree(treeId)` | Affiche les talents de l'arbre sélectionné |
| `_invest(talentId)` | Dépense un point, vérifie les prérequis |
| `_uninvest(talentId)` | Rembourse un point si aucun talent dépendant n'est investi |

---

### `ui/screens/merchant-screen.js`

#### Classe `MerchantScreen`

| Méthode | Description |
|---|---|
| `init()` | Génère ou recharge le stock du marchand |
| `_buyItem(itemId)` | Déduit l'or, ajoute la carte au run |
| `_refresh()` | Régénère le stock (coût 30 or) |

---

### `ui/screens/collection-screen.js`

#### Classe `CollectionScreen`

| Méthode | Description |
|---|---|
| `init()` | Charge la bibliothèque et le deck actuel |
| `_applyFilter(tag)` | Filtre les cartes par tag |
| `_toggleCard(cardId)` | Ajoute/retire du deck en construction |
| `_saveDeck()` | Persiste `character.savedDeck` |

---

### `ui/screens/result-screen.js`

#### Classe `ResultScreen`

| Méthode | Description |
|---|---|
| `init()` | Affiche le résultat selon `params.type` |

**Types :** `victory` (butin, continuer), `defeat` (game over), `rest` (soin HP), `event` (choix narratifs)

---

## 4. API & contrats entre modules

```
Engine.bus         ← canal de communication universel
Engine.getCard()   ← source unique pour les définitions de contenu
Save.getCurrentRun()  ← source unique pour l'état at-risk
Save.getCurrentChar() ← source unique pour l'état persistant
I18n.t()  =  window.t()  ← toutes les chaînes affichées
TagSystem.canPlay()    ← seul juge de la jouabilité d'une carte
HexGrid.*              ← seule source de vérité pour la géométrie hex
```

**Règle :** un écran ne doit jamais lire `Engine.state` directement. Il passe toujours par les accesseurs `Save.*` et `Engine.get*()`.

---

## 5. Bus d'événements — référence complète

### Moteur

| Événement | Données |
|---|---|
| `engine:ready` | — |
| `module:loaded` | `{ moduleId, manifest }` |
| `screen:change` | `{ name, params, prev }` |
| `language:change` | `{ lang, prev }` |

### Combat

| Événement | Données |
|---|---|
| `combat:deck_reshuffled` | — |
| `combat:hand_updated` | `{ hand }` |
| `combat:timeline_updated` | `{ timeline }` |
| `combat:turn_skipped` | `{ unitId, tick }` |
| `combat:player_turn_start` | `{ tick }` |
| `combat:enemy_turn_start` | `{ unitId, tick }` |
| `combat:player_turn_end` | `{ tick }` |
| `combat:card_played` | `{ cardId, sourceId, targetPos, result }` |
| `combat:damage_dealt` | `{ targetId, amount, blocked, type, remaining }` |
| `combat:healed` | `{ targetId, amount }` |
| `combat:status_applied` | `{ targetId, statusId, stacks, duration, total }` |
| `combat:status_expired` | `{ unitId, statusId }` |
| `combat:statuses_ticked` | `{ unitId, statuses }` |
| `combat:unit_moved` | `{ unitId, from, to }` |
| `combat:unit_defeated` | `{ unitId }` |
| `combat:enemy_intent` | `{ enemyId, action }` |
| `combat:enemy_acted` | `{ enemyId, action }` |
| `combat:ended` | `{ result }` |
| `combat:resource_updated` | `{ unitId }` |
| `combat:weapon_switched` | `{ activeWeapon, activeTags }` |
| `combat:consumable_used` | `{ slot, item }` |
| `combat:log` | `{ tick, msg }` |

### Grille hex

| Événement | Données |
|---|---|
| `hexgrid:cell_click` | `{ q, r }` |
| `hexgrid:cell_hover` | `{ q, r }` |

### QTE

| Événement | Données |
|---|---|
| `qte:result` | `{ type, result }` |

---

## 6. Structure de la sauvegarde

```jsonc
{
  "version": 1,
  "currentCharId": "char_1234",
  "settings": { "language": "fr" },
  "characters": {
    "char_1234": {
      "id": "char_1234",
      "name": "Kael",
      "archetypeId": "guerrier",
      "baseStats": { "force": 8, "dexterite": 5, "intelligence": 3,
                     "endurance": 7, "volonte": 4, "rapidite": 3 },
      "talentPoints": { "force": 2, "dexterite": 0, ... },
      "talentInvested": { "force_1": 1, "endurance_2": 0 },
      "library": ["slash", "thrust"],
      "weapons": [{ "id": "epee_de_base", "instanceId": "wpn_001", "rarity": "Commune" }],
      "equipment": { "armor": null, "ring1": null, "ring2": null, "amulet": null, "boots": null },
      "vault": { "weapons": [], "equipment": [] },
      "gold": { "bank": 150 },
      "etherPowder": { "bank": 30 },
      "savedDeck": ["slash", "thrust", "block"],
      "lastRunDeck": ["slash", "thrust"],
      "merchantRefreshCount": 1,
      "merchantStock": null
    }
  },
  "run": {
    "charId": "char_1234",
    "mapSeed": 1710000000000,
    "zone": 1,
    "currentNode": "node_5",
    "visitedNodes": ["node_0", "node_2", "node_5"],
    "mapData": { "nodes": [...], "edges": [...], "entry": "node_0", "exit": "node_47" },
    "deck": ["slash", "thrust", "block"],
    "hand": [],
    "gold": 20,
    "etherPowder": 5,
    "consumables": [null, null, null, null],
    "inventory": [null, null, null, null, null, null, null, null],
    "equippedWeapons": [{ "id": "epee_de_base" }, null],
    "activeWeapon": 0,
    "equipment": { "armor": null, "ring1": null, "ring2": null, "amulet": null, "boots": null },
    "hp": 72,
    "endurance": 19,
    "mana": 9,
    "eventFlags": {},
    "bossesDefeated": 0
  }
}
```

**Distinction banque / at-risk :** l'or et la poudre d'éther existent en double — `character.gold.bank` (permanent) et `run.gold` (perdu si défaite). `Save.endRun(survived)` fusionne les deux si le joueur survit.

---

## 7. Système de contenu modulaire

Tout le contenu est piloté par JSON. L'engine charge les modules déclarés dans `modules/module-index.json` (optionnel ; le module `base` est toujours chargé).

**Convention de chemin :**
```
modules/{moduleId}/
  module.json                   manifest (ids déclarés par type)
  lang/{lang}.json              chaînes de localisation
  cards/{cardId}/card.json
  weapons/{weaponId}/weapon.json
  enemies/{enemyId}/enemy.json
  archetypes/{archetypeId}/archetype.json
  talents/{talentId}/talent.json
  events/{eventId}/event.json
```

**Merge :** les modules chargés après écrasent les définitions identiques. Toute ressource est annotée `_moduleId` pour le débogage.

**Schéma carte minimal :**
```jsonc
{
  "id": "magic_blast",
  "rarity": "Commune",
  "tags": ["Attaque", "Magie"],
  "requires": ["Magie"],
  "portee": { "min": 1, "max": 3 },
  "forme": "single",
  "cost": { "initiative": 1, "mana": 1 },
  "effects": [{ "type": "damage", "value": 2 }],
  "forgeable": true
}
```

**Schéma arme minimal :**
```jsonc
{
  "id": "epee_de_base",
  "rarity": "Commune",
  "subtype": "epee",
  "tags": ["Tranchant", "Estoc", "CaC"],
  "portee": { "min": 1, "max": 1 },
  "cardDefinitions": [{ "id": "slash", "tags": ["Attaque", "Tranchant"] }]
}
```

---

## 8. Décisions d'architecture

### 8.1 Vanilla JS sans framework

**Décision :** pas de React, Vue, ou bundler. Fichiers chargés par `<script>` dans l'ordre dans `index.html`.

**Justification :**
- Portabilité maximale (fonctionne depuis `file://` ou un simple serveur statique)
- Aucune dépendance à maintenir
- Chargement immédiat sans étape de build
- Simplicité de débogage (DevTools natifs suffisent)

**Compromis accepté :** ordre de chargement des scripts rigide, globaux via `window.*`, pas de hot-reload.

### 8.2 IIFE pour isolation de scope

**Décision :** chaque fichier de classe est enveloppé dans `(function() { ... })()`.

**Justification :** le linter du projet applique automatiquement ce wrapping. Cela évite les pollutions de scope global accidentelles tout en conservant l'exposition explicite via `window.ClassName`.

### 8.3 Singleton pattern via `window.*`

**Décision :** `Engine`, `Save`, `I18n`, `TagSystem`, `QTESystem`, `ForgeSystem` sont des singletons exposés sur `window`.

**Justification :** dans une architecture sans modules ES6, c'est le seul moyen d'avoir un état partagé cohérent entre tous les fichiers. L'alternative (imports ES6) aurait nécessité un bundler ou `type="module"` avec des contraintes CORS additionnelles.

### 8.4 Bus d'événements centralisé

**Décision :** toute communication inter-modules passe par `Engine.bus.emit/on/off`.

**Justification :** découplage fort. Un écran peut écouter `combat:damage_dealt` sans tenir de référence directe à `CombatState`. Facilite l'ajout de systèmes observateurs (analytics, tutoriel, achievements) sans modifier le code émetteur.

**Risque identifié :** memory leaks si les listeners ne sont pas nettoyés dans `destroy()`. Convention : chaque écran/composant doit stocker ses refs de listeners et les détacher au `destroy()`.

### 8.5 Grille hex : orientation flat-top en combat, pointy-top sur la carte

**Décision :** deux orientations différentes selon le contexte.

- **Combat (`HexGrid`, `HexGridRenderer`)** : flat-top (sommet à gauche/droite). Justification : standard dans les jeux de stratégie, plus lisible pour les lignes horizontales d'unités.
- **Carte du monde (`MapScreen`)** : pointy-top (sommet en haut/bas). Justification : meilleure progression visuelle gauche→droite pour un roguelite, les rangées impaires sont décalées pour éviter l'alignement monotone.

**Point d'attention :** `HexGrid.toPixel()` retourne des coordonnées flat-top. `MapScreen._hexCenter()` est un calcul indépendant en pointy-top. Ne pas mélanger les deux.

### 8.6 Écrans instanciés à la demande

**Décision :** `Engine.showScreen(name)` instancie la classe écran au moment de la navigation, appelle `init()`, et appelle `destroy()` sur l'écran précédent.

**Justification :** empreinte mémoire minimale (un seul écran en mémoire à la fois), état de l'écran toujours frais depuis la sauvegarde, pas besoin de système de recyclage complexe.

### 8.7 Contenu data-driven (JSON)

**Décision :** cartes, armes, ennemis, archétypes, talents et événements sont des fichiers JSON, pas du code JavaScript.

**Justification :** permet l'ajout de contenu sans modifier le code moteur, facilite la modération/balance (modification de nombres sans déploiement), ouvre la voie à des mods communautaires.

### 8.8 Run "at-risk" vs banque permanente

**Décision :** l'or et la poudre d'éther sont dupliqués entre `character.gold.bank` (permanent) et `run.gold` (at-risk, perdu à la mort).

**Justification :** tension roguelite authentique. Le joueur doit décider s'il dépense ses ressources en run sachant qu'il peut les perdre, ou s'il conserve pour la progression permanente via la forge hors-run.

### 8.9 Pathfinding sur la carte : BFS forward illimité

**Décision :** le joueur peut cliquer sur n'importe quel nœud atteignable via le graphe d'arêtes (BFS sans limite de profondeur). Les nœuds intermédiaires sont auto-visités (marqués visités mais sans déclencher leur événement).

**Justification :** liberté de navigation stratégique. Le joueur peut planifier sa route en voyant toute la carte forward dès le début. Les combats contournés sont marqués visités mais pas joués — compromis entre liberté et progression cohérente.

**Alternative rejetée :** progression stricte colonne par colonne (Slay the Spire). Trop rigide pour le design souhaité.

---

## 9. Questions de domaine et décisions prises

### Q1 : Quelle orientation pour les hexagones de la grille de combat ?

**Question :** flat-top ou pointy-top pour le combat ?

**Décision :** **flat-top**. `HexGrid.toPixel(q, r, size)` utilise `x = size*(3/2*q)`, `y = size*(√3/2*q + √3*r)`. Les 6 directions flat-top sont définies dans `HexGrid.DIRECTIONS`.

**Raison :** le combat se lit mieux horizontalement (joueur à gauche, ennemis à droite). Flat-top donne des rangées visuellement claires.

---

### Q2 : Comment éviter le chevauchement des hexagones sur la carte du monde ?

**Question :** les hexagones se chevauchaient aux pointes (tip-to-tip overlap de 11px).

**Cause identifiée :** l'élément outer hex avait `width: W-PAD` et `height: H-PAD` (PAD=4), mais l'espacement inter-lignes restait `ROW = H×0.75`. Le gap réel entre pointes = `ROW - (H-PAD) = H×0.25 - PAD = 15 - 4 = 11px` (négatif = chevauchement).

**Décision :** l'élément outer hex doit être exactement `W × H` (sans réduction). Seul l'inner hex est inséré de `BORDER=3px` sur chaque côté pour créer le gap visuel. Les frontières de `clip-path` des hexes adjacents se touchent parfaitement.

**Formule correcte (pointy-top) :**
```
W = r × √3     (≈ 52px pour r=30)
H = 2 × r      (60px)
ROW = H × 0.75 (45px, espacement centre-à-centre vertical)
Offset rang impair : W/2
```

---

### Q3 : Comment gérer la jouabilité des cartes selon l'arme équipée ?

**Question :** les cartes ont des `requires` (ex: `["CaC", "Tranchant"]`). Comment savoir si une carte est jouable ?

**Décision :** `TagSystem` est la source de vérité. `CombatState.switchWeapon()` appelle `_rebuildActiveTags()` qui met à jour `TagSystem` via `applyWeaponContext()`. `TagSystem.canPlay(card.requires)` est appelé avant chaque tentative de jeu. Logique : AND entre groupes de `requires`, OR à l'intérieur (séparateur `|`). Le tag `ANY` est un wildcard.

---

### Q4 : L'or et la poudre d'éther survivent-ils à une mort ?

**Décision :** **non** pour les ressources at-risk (`run.gold`, `run.etherPowder`). **Oui** pour la banque (`character.gold.bank`, `character.etherPowder.bank`). `Save.endRun(survived)` fusionne at-risk → banque seulement si `survived = true`.

**Raison :** tension roguelite. La forge permanente (hors-run) utilise la banque. La forge en-run utilise les ressources at-risk.

---

### Q5 : La carte du monde est-elle regénérée à chaque run ?

**Décision :** **oui**, avec une seed fixée au début du run (`run.mapSeed = Date.now()`). Si `run.mapData` existe déjà en sauvegarde, la carte est rechargée (pas regénérée). Cela garantit la reproductibilité en cas de fermeture/réouverture du jeu en cours de run.

---

### Q6 : Comment fonctionnent les nœuds intermédiaires lors d'un saut sur la carte ?

**Question :** si le joueur saute de la colonne 0 à la colonne 3, que se passe-t-il avec les colonnes 1 et 2 ?

**Décision :** `_findForwardPath()` calcule le chemin le plus court (BFS). Tous les nœuds intermédiaires sont marqués `visited: true` et `visible: true`, mais leur `_enterNode()` n'est **pas** appelé. Seul le nœud de destination déclenche son événement. Les nœuds sautés sont affichés comme visités sur la carte (sans effet en jeu).

**Raison :** simplicité et lisibilité. Déclencher les événements de tous les nœuds intermédiaires automatiquement créerait une séquence déroutante. Le joueur choisit consciemment de sauter du contenu.

---

### Q7 : Comment les modules de contenu gèrent-ils les conflits d'ID ?

**Décision :** le dernier module chargé gagne (`_mergeIntoRegistry` écrase). Un warning console est émis sur les conflits. Les ressources sont annotées `_moduleId` pour identifier leur origine.

**Raison :** permet aux mods de remplacer des cartes du module `base` sans modifier le code source.

---

### Q8 : Quelle stratégie de migration de sauvegarde ?

**Décision :** `Save._migrate(state)` est appelé à chaque chargement. Il compare `state.version` et applique les transformations nécessaires (v0→v1 : ajout de champs manquants). La version courante est `SAVE_VERSION = 1`.

**Risque :** si un champ est retiré dans une version future, les anciennes sauvegardes auront des données orphelines. Convention : ne jamais supprimer de champs, seulement ignorer les valeurs obsolètes.

---

### Q9 : Pourquoi deux systèmes hex distincts (HexGrid vs _hexCenter dans MapScreen) ?

**Décision :** `HexGrid` est orienté flat-top (combat). `MapScreen._hexCenter()` est un calcul pointy-top inline. Ils ne sont pas unifiés.

**Raison :** les deux orientations ont des formules incompatibles. Forcer `HexGrid` à supporter les deux augmenterait la complexité de l'API. Comme la carte monde n'a pas besoin de pathfinding, un calcul simple suffit.

**Dette technique identifiée :** si la carte monde nécessite un jour du pathfinding (déplacements d'événements, etc.), il faudra soit étendre `HexGrid`, soit créer un `HexGridPointy` séparé.

---

*Document généré le 2026-03-08.*
