// ============================================================
// A* Algorithm — Heuristic-Enhanced Shortest Path
// ============================================================
// Improves upon Dijkstra by using a Haversine-based heuristic
// to guide the search toward the goal, reducing nodes visited.
// f(n) = g(n) + h(n)
//   g(n) = actual cost from start
//   h(n) = estimated cost to goal (Haversine distance)
// ============================================================

class MinHeap {
  constructor() { this.heap = []; }
  push(node) {
    this.heap.push(node);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p].f <= this.heap[i].f) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }
  pop() {
    if (!this.heap.length) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length) {
      this.heap[0] = last;
      let i = 0;
      while (true) {
        let s = i, l = 2 * i + 1, r = 2 * i + 2;
        if (l < this.heap.length && this.heap[l].f < this.heap[s].f) s = l;
        if (r < this.heap.length && this.heap[r].f < this.heap[s].f) s = r;
        if (s === i) break;
        [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
        i = s;
      }
    }
    return min;
  }
  get size() { return this.heap.length; }
}

/**
 * Haversine heuristic — admissible (never overestimates)
 * Returns distance in meters between two geo points
 */
function heuristic(coords, nodeId, goalId) {
  const [lon1, lat1] = coords[parseInt(nodeId)];
  const [lon2, lat2] = coords[parseInt(goalId)];
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * A* search algorithm
 * @param {Object} graph - Adjacency list (from dijkstra.buildGraph)
 * @param {string} start - Start node ID
 * @param {string} end - End node ID
 * @param {Array} coordinates - Original [lon, lat] coordinates for heuristic
 * @returns {Object} { path, totalCost, nodesVisited }
 */
export function astar(graph, start, end, coordinates) {
  const gScore = {};
  const fScore = {};
  const prev = {};
  const visited = new Set();
  const pq = new MinHeap();

  for (const node of Object.keys(graph)) {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  }

  gScore[start] = 0;
  fScore[start] = heuristic(coordinates, start, end);
  pq.push({ node: start, f: fScore[start] });

  while (pq.size > 0) {
    const { node: current } = pq.pop();

    if (current === end) break;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const neighbor of (graph[current] || [])) {
      if (visited.has(neighbor.node)) continue;

      const tentativeG = gScore[current] + neighbor.cost;
      if (tentativeG < gScore[neighbor.node]) {
        prev[neighbor.node] = current;
        gScore[neighbor.node] = tentativeG;
        fScore[neighbor.node] = tentativeG + heuristic(coordinates, neighbor.node, end);
        pq.push({ node: neighbor.node, f: fScore[neighbor.node] });
      }
    }
  }

  // Reconstruct path
  const path = [];
  let current = end;
  while (current !== undefined) {
    path.unshift(current);
    current = prev[current];
  }

  return {
    path: path[0] === start ? path : [],
    totalCost: gScore[end] || Infinity,
    nodesVisited: visited.size
  };
}

export default { astar };
