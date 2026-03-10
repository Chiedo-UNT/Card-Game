// Map generator - hex flat-top 12×8
// Left to right progression only (3 forward neighbors visible)
// Always 1 entry (leftmost col), 1 exit via Boss node (rightmost)
// Col 11 always has a Rest node as the pre-boss node

(function () {
class MapGenerator {
  constructor(seed) {
    this.seed = seed;
    this._rng = this._seededRng(seed);
  }

  // Seeded random number generator (simple LCG)
  // Returns a function that yields [0, 1) floats
  _seededRng(seed) {
    let s = (seed || 12345) >>> 0;
    return () => {
      // Park-Miller LCG
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      return s / 0x100000000;
    };
  }

  // Weighted random choice given { type: weight } object
  _weightedChoice(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = this._rng() * total;
    for (const [key, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return key;
    }
    // Fallback to first key
    return Object.keys(weights)[0];
  }

  // Shuffle an array in-place using the seeded RNG
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Generate a complete map
  // Returns { nodes: [...], edges: [...], entry: nodeId, exit: nodeId }
  generate(zone = 1) {
    const cols = 12; // 0..11 (col 11 = boss, col 10 = rest, col 0 = entry)
    const rows = 7;

    // 1. Grille complète : chaque cellule a un nœud
    const nodes = this._placeNodes(cols, rows);

    // 2. Connexions directes uniquement : chaque nœud → ses 3 voisins immédiats col+1
    const edges = this._createEdges(nodes, cols, rows);

    // 3. Assign types (aléatoires)
    this._assignTypes(nodes, zone);

    // 4. Node 73 (col 10 row 3) = Repos obligatoire, col 11 centre = Boss
    for (const node of nodes) {
      if (node.col === 10 && node.row === Math.floor(rows / 2)) node.type = 'rest';
      if (node.col === 11) node.type = 'boss';
    }

    // 5. Point d'entrée : nœud central de col 0
    const entryNode = nodes.find(n => n.col === 0 && n.row === Math.floor(rows / 2));
    const exitNode  = nodes.find(n => n.col === 11 && n.row === Math.floor(rows / 2));

    // 6. Nœuds masqués : invisibles et inaccessibles
    this._markHiddenNodes(nodes, edges);

    // 7. Visibilité initiale : nœud d'entrée + ses voisins directs
    for (const node of nodes) {
      if (!node.hidden) {
        node.visited = false;
        node.visible = false;
      }
    }
    if (entryNode) {
      entryNode.visible = true;
      for (const e of edges.filter(e => e.from === entryNode.id)) {
        const n = nodes.find(x => x.id === e.to);
        if (n) n.visible = true;
      }
    }

    return {
      nodes,
      edges,
      entry: entryNode ? entryNode.id : null,
      exit:  exitNode  ? exitNode.id  : null,
    };
  }

  // Grille complète : un nœud par cellule (cols × rows)
  _placeNodes(cols, rows) {
    const nodes = [];
    let idCounter = 0;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        nodes.push({
          id:      `node_${idCounter++}`,
          col, row,
          q: col, r: row,
          type:    'combat',
          visited: false,
          visible: false,
          content: null,
        });
      }
    }
    return nodes;
  }

  // Connexions hexagonales correctes selon la parité de la rangée.
  // Layout : rangées impaires décalées de +W/2 vers la droite.
  // Voisins "vers la droite" depuis (col, row) :
  //   - rangée paire  : (col, row-1), (col+1, row), (col, row+1)   ← diagonales = même col
  //   - rangée impaire: (col+1, row-1), (col+1, row), (col+1, row+1) ← tout col+1
  _createEdges(nodes, cols, rows) {
    const edges = [];
    const byPos = {};
    for (const n of nodes) byPos[`${n.col},${n.row}`] = n;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const from = byPos[`${col},${row}`];
        if (!from) continue;

        const even = row % 2 === 0;
        // [nr, nc] — rangée et colonne du voisin
        const neighbors = even
          ? [[row - 1, col], [row, col + 1], [row + 1, col]]         // pair
          : [[row - 1, col + 1], [row, col + 1], [row + 1, col + 1]]; // impair

        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= rows || nc >= cols) continue;
          const to = byPos[`${nc},${nr}`];
          if (to) edges.push({ from: from.id, to: to.id, id: `edge_${from.id}_${to.id}` });
        }
      }
    }
    return edges;
  }

  // Assign node types weighted by zone difficulty
  _assignTypes(nodes, zone) {
    // Base weights
    const baseWeights = {
      combat:   40,
      elite:    15,
      event:    15,
      rest:      8,
      merchant: 10,
      forge:     5,
      divine:    4,
      unknown:   3,
    };

    // Higher zone → more elites, fewer rests
    const eliteBonus    = (zone - 1) * 5;
    const restPenalty   = (zone - 1) * 2;

    const weights = {
      ...baseWeights,
      elite:  baseWeights.elite  + eliteBonus,
      rest:   Math.max(2, baseWeights.rest - restPenalty),
    };

    // Positions interdites pour le type 'rest' :
    // - col 1 (juste après le départ, sans intérêt)
    // - nodes précédant directement le repos obligatoire (66=col9r3, 72=col10r2, 74=col10r4)
    const NO_REST = new Set(['1,2','1,3','1,4', '9,3', '10,2','10,4']);

    const weightsNoRest = { ...weights, rest: 0 };

    for (const node of nodes) {
      // Skip special columns — boss and rest col are handled after
      if (node.col === 0)  { node.type = 'start';  continue; }
      if (node.col === 11) { node.type = 'boss';   continue; }

      const key = `${node.col},${node.row}`;
      node.type = this._weightedChoice(NO_REST.has(key) ? weightsNoRest : weights);
    }
  }

  // Marque certains nœuds comme cachés (invisible + inaccessible) et supprime leurs arêtes
  _markHiddenNodes(nodes, edges) {
    const HIDDEN = new Set([
      '0,0','0,1','0,2','0,4','0,5','0,6',
      '1,0','1,6',
      '10,0','10,1','10,5','10,6',
      '11,0','11,1','11,2','11,4','11,5','11,6',
    ]);
    const hiddenIds = new Set();
    for (const node of nodes) {
      if (HIDDEN.has(`${node.col},${node.row}`)) {
        node.hidden  = true;
        node.visible = false;
        hiddenIds.add(node.id);
      }
    }
    // Supprimer toutes les arêtes qui impliquent un nœud caché
    for (let i = edges.length - 1; i >= 0; i--) {
      if (hiddenIds.has(edges[i].from) || hiddenIds.has(edges[i].to)) {
        edges.splice(i, 1);
      }
    }
  }

  // Get nodes visible to player (within visionRange hops from currentNodeId)
  getVisibleNodes(currentNodeId, nodes, edges, visionRange = 1) {
    const visited = new Set();
    const queue = [{ id: currentNodeId, depth: 0 }];
    const visible = [];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodes.find(n => n.id === id);
      if (node) visible.push(node);

      if (depth < visionRange) {
        // Forward AND backward edges within vision range
        const neighbors = edges
          .filter(e => e.from === id || e.to === id)
          .map(e => e.from === id ? e.to : e.from);
        for (const nid of neighbors) {
          if (!visited.has(nid)) {
            queue.push({ id: nid, depth: depth + 1 });
          }
        }
      }
    }

    return visible;
  }

  // Get reachable next nodes from current position (only forward edges)
  getReachableNodes(currentNodeId, nodes, edges) {
    const nextIds = edges
      .filter(e => e.from === currentNodeId)
      .map(e => e.to);
    return nodes.filter(n => nextIds.includes(n.id));
  }
}

window.MapGenerator = MapGenerator;
})();
