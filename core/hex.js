// Hex grid math – axial coordinate system (q, r)
// For combat grid : 10 wide × 6 tall
// For map grid    : 12 wide × 8 tall  (flat-top, left-to-right progression)
//
// Axial coordinates use flat-top hexagons.
// Offset conversion uses even-q (even columns shifted up).

(function () {
class HexGrid {

  // ─── Direction Vectors ─────────────────────────────────────────────────────

  // The 6 axial neighbours of any flat-top hex, starting from East and going clockwise
  static DIRECTIONS = [
    { q:  1, r:  0 },  // 0 – East
    { q:  1, r: -1 },  // 1 – North-East
    { q:  0, r: -1 },  // 2 – North-West
    { q: -1, r:  0 },  // 3 – West
    { q: -1, r:  1 },  // 4 – South-West
    { q:  0, r:  1 },  // 5 – South-East
  ];

  // ─── Distance ──────────────────────────────────────────────────────────────

  // Chebyshev distance in axial (= cube) coordinates
  static distance(a, b) {
    // Convert axial → cube, then max of abs differences
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }

  // ─── Neighbours ────────────────────────────────────────────────────────────

  // All 6 axial neighbours of hex (q, r)
  static neighbors(q, r) {
    return HexGrid.DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
  }

  // ─── Ring & Spiral ─────────────────────────────────────────────────────────

  // All hexes exactly `radius` steps from `center` (in axial coords)
  static ring(center, radius) {
    if (radius === 0) return [{ q: center.q, r: center.r }];

    const results = [];
    // Start at the hex that is `radius` steps in direction 4 (South-West)
    let q = center.q + HexGrid.DIRECTIONS[4].q * radius;
    let r = center.r + HexGrid.DIRECTIONS[4].r * radius;

    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < radius; step++) {
        results.push({ q, r });
        q += HexGrid.DIRECTIONS[side].q;
        r += HexGrid.DIRECTIONS[side].r;
      }
    }
    return results;
  }

  // All hexes from radius 0 to maxRadius (inclusive), spiralling outward
  static spiral(center, maxRadius) {
    const results = [];
    for (let radius = 0; radius <= maxRadius; radius++) {
      const ring = HexGrid.ring(center, radius);
      for (const hex of ring) results.push(hex);
    }
    return results;
  }

  // ─── Line & Cone ───────────────────────────────────────────────────────────

  // All hexes in a straight line from `start` in the given direction index for `length` steps
  // direction: 0–5 index into DIRECTIONS
  static line(start, direction, length) {
    const dir = HexGrid.DIRECTIONS[direction];
    const result = [];
    let q = start.q;
    let r = start.r;
    for (let i = 0; i < length; i++) {
      q += dir.q;
      r += dir.r;
      result.push({ q, r });
    }
    return result;
  }

  // Hexes in a cone: the three directions centred on `direction` for `length` steps
  // Returns the union of three lines (left, centre, right of forward direction)
  static cone(origin, direction, length) {
    const leftDir  = (direction + 5) % 6; // one step counter-clockwise
    const rightDir = (direction + 1) % 6; // one step clockwise

    const seen = new Set();
    const results = [];

    const add = (hex) => {
      const key = `${hex.q},${hex.r}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(hex);
      }
    };

    for (const dir of [leftDir, direction, rightDir]) {
      for (const hex of HexGrid.line(origin, dir, length)) {
        add(hex);
      }
    }

    return results;
  }

  // ─── Pixel ↔ Axial Conversion (flat-top) ──────────────────────────────────

  // Axial → pixel centre of the hex (flat-top orientation)
  // size: the radius of the hexagon (centre to corner)
  static toPixel(q, r, size) {
    const x = size * (3 / 2 * q);
    const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y };
  }

  // Pixel → nearest axial hex (flat-top orientation)
  static fromPixel(x, y, size) {
    const q = (2 / 3 * x) / size;
    const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
    return HexGrid.round(q, r);
  }

  // Round fractional axial coordinates to the nearest hex
  static round(fracQ, fracR) {
    const fracS = -fracQ - fracR;

    let q = Math.round(fracQ);
    let r = Math.round(fracR);
    let s = Math.round(fracS);

    const dq = Math.abs(q - fracQ);
    const dr = Math.abs(r - fracR);
    const ds = Math.abs(s - fracS);

    if (dq > dr && dq > ds) {
      q = -r - s;
    } else if (dr > ds) {
      r = -q - s;
    }
    // s is discarded (derived from q and r)

    return { q, r };
  }

  // ─── Bounds Check ──────────────────────────────────────────────────────────

  // Returns true if the axial coordinate (q, r) falls within a rectangular grid
  // of `width` columns and `height` rows (offset coords), using even-q offset.
  static inBounds(q, r, width, height) {
    const offset = HexGrid.axialToOffset(q, r);
    return offset.col >= 0 && offset.col < width &&
           offset.row >= 0 && offset.row < height;
  }

  // ─── Grid Enumeration ──────────────────────────────────────────────────────

  // Return all axial hexes in a rectangular offset grid (cols × rows)
  static gridHexes(cols, rows) {
    const hexes = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        hexes.push(HexGrid.offsetToAxial(col, row));
      }
    }
    return hexes;
  }

  // ─── Offset ↔ Axial Conversion (even-q, flat-top) ─────────────────────────

  // Even-q offset: even columns are NOT shifted, odd columns are shifted up by ½
  static offsetToAxial(col, row) {
    const q = col;
    const r = row - Math.floor((col - (col & 1)) / 2);
    return { q, r };
  }

  static axialToOffset(q, r) {
    const col = q;
    const row = r + Math.floor((q - (q & 1)) / 2);
    return { col, row };
  }

  // ─── A* Pathfinding ────────────────────────────────────────────────────────

  // Find the shortest walkable path from `start` to `goal` on a bounded grid.
  // blockedHexes: Set of "q,r" strings that cannot be entered
  // width, height: grid dimensions (for bounds checking)
  // Returns an array of axial hex coords from start to goal (inclusive),
  // or null if no path exists.
  static findPath(start, goal, blockedHexes, width, height) {
    const startKey = `${start.q},${start.r}`;
    const goalKey  = `${goal.q},${goal.r}`;

    if (startKey === goalKey) return [{ q: start.q, r: start.r }];

    // Simple MinHeap for the open set
    const heap = new _HexMinHeap();

    // Cost maps
    const gCost = new Map(); // key → best known g-cost
    const fCost = new Map(); // key → f-cost (g + h)
    const cameFrom = new Map(); // key → { q, r }

    gCost.set(startKey, 0);
    fCost.set(startKey, HexGrid.distance(start, goal));
    heap.push({ q: start.q, r: start.r, key: startKey, f: fCost.get(startKey) });

    while (!heap.isEmpty()) {
      const current = heap.pop();

      if (current.key === goalKey) {
        // Reconstruct path
        const path = [];
        let key = goalKey;
        while (key !== startKey) {
          const node = cameFrom.get(key);
          path.push({ q: node.q, r: node.r });
          key = `${node.q},${node.r}`;
        }
        path.push({ q: start.q, r: start.r });
        path.reverse();
        // The first element is start; replace with goal coords for the last step
        // (the loop above adds the predecessor, so we need to append goal)
        // Actually reconstruct properly:
        return HexGrid._reconstructPath(cameFrom, start, goal);
      }

      const currentG = gCost.get(current.key);

      for (const neighbor of HexGrid.neighbors(current.q, current.r)) {
        const nKey = `${neighbor.q},${neighbor.r}`;

        // Skip out-of-bounds and blocked hexes
        if (!HexGrid.inBounds(neighbor.q, neighbor.r, width, height)) continue;
        if (blockedHexes && blockedHexes.has(nKey)) continue;

        const tentativeG = currentG + 1; // uniform cost

        if (!gCost.has(nKey) || tentativeG < gCost.get(nKey)) {
          gCost.set(nKey, tentativeG);
          const h = HexGrid.distance(neighbor, goal);
          const f = tentativeG + h;
          fCost.set(nKey, f);
          cameFrom.set(nKey, { q: current.q, r: current.r });
          heap.push({ q: neighbor.q, r: neighbor.r, key: nKey, f });
        }
      }
    }

    return null; // no path found
  }

  static _reconstructPath(cameFrom, start, goal) {
    const path = [];
    let current = goal;
    let key = `${current.q},${current.r}`;
    const startKey = `${start.q},${start.r}`;

    path.push({ q: goal.q, r: goal.r });

    while (key !== startKey) {
      const prev = cameFrom.get(key);
      if (!prev) break; // safety guard
      path.push({ q: prev.q, r: prev.r });
      key = `${prev.q},${prev.r}`;
    }

    path.reverse();
    return path;
  }

  // ─── Map Navigation ────────────────────────────────────────────────────────

  // Forward neighbours for map progression (right-side only: East, NE, SE)
  // Direction indices: 0 = East, 1 = NE, 5 = SE
  static forwardNeighbors(q, r) {
    return [
      HexGrid.DIRECTIONS[0], // East
      HexGrid.DIRECTIONS[1], // NE
      HexGrid.DIRECTIONS[5], // SE
    ].map(d => ({ q: q + d.q, r: r + d.r }));
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  // Return a string key for a hex coordinate (useful for Set/Map storage)
  static key(q, r) {
    return `${q},${r}`;
  }

  // Parse a key back into { q, r }
  static parseKey(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  // Build a Set of blocked-hex keys from an array of { q, r } objects
  static buildBlockedSet(hexArray) {
    const s = new Set();
    for (const h of hexArray) s.add(`${h.q},${h.r}`);
    return s;
  }

  // Check if two axial coordinates are equal
  static equal(a, b) {
    return a.q === b.q && a.r === b.r;
  }

  // Return the pixel size of a hex given the canvas dimensions and grid size
  // so that the entire grid fits within (canvasWidth × canvasHeight)
  static fitSize(cols, rows, canvasWidth, canvasHeight) {
    // Flat-top grid pixel extent:
    // width  ≈ size * (3/2 * cols + 1/2)
    // height ≈ size * sqrt(3) * (rows + 0.5)
    const sizeFromWidth  = canvasWidth  / (3 / 2 * cols + 0.5);
    const sizeFromHeight = canvasHeight / (Math.sqrt(3) * (rows + 0.5));
    return Math.min(sizeFromWidth, sizeFromHeight);
  }
}

// ─── Internal MinHeap for A* ─────────────────────────────────────────────────
// Not exposed on window; used only by HexGrid.findPath

class _HexMinHeap {
  constructor() {
    this._data = [];
  }

  isEmpty() {
    return this._data.length === 0;
  }

  push(node) {
    this._data.push(node);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._data[parent].f <= this._data[i].f) break;
      [this._data[parent], this._data[i]] = [this._data[i], this._data[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._data.length;
    while (true) {
      const left  = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left  < n && this._data[left].f  < this._data[smallest].f) smallest = left;
      if (right < n && this._data[right].f < this._data[smallest].f) smallest = right;

      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]];
      i = smallest;
    }
  }
}

window.HexGrid = HexGrid;
})();
