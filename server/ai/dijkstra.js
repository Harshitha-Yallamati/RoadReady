// ============================================================
// Dijkstra's Algorithm — Baseline Shortest Path
// ============================================================
// Builds a weighted graph from route segments and finds the
// optimal path using classic Dijkstra with a priority queue.
// Used as the baseline comparison for the A* algorithm.
// ============================================================

/**
 * MinHeap priority queue for efficient node extraction
 */
class MinHeap {
  constructor() { this.heap = []; }

  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].cost <= this.heap[i].cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < n && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
      if (right < n && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * Build adjacency list graph from route coordinates
 * Each segment between consecutive points becomes an edge
 * @param {Array} coordinates - Array of [lon, lat] points
 * @param {Object} weights - Edge weight configuration
 * @returns {Object} Adjacency list graph
 */
export function buildGraph(coordinates, weights = {}) {
  const graph = {};
  const { distanceWeight = 1, timeWeight = 0, trafficWeight = 0 } = weights;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const from = `${i}`;
    const to = `${i + 1}`;
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    // Calculate segment distance using Haversine
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Composite edge weight
    const edgeCost = dist * distanceWeight + (dist / 15) * timeWeight + Math.random() * 0.1 * trafficWeight;

    if (!graph[from]) graph[from] = [];
    if (!graph[to]) graph[to] = [];
    graph[from].push({ node: to, cost: edgeCost, distance: dist });
    graph[to].push({ node: from, cost: edgeCost, distance: dist });
  }

  return graph;
}

/**
 * Dijkstra's shortest path algorithm
 * @param {Object} graph - Adjacency list
 * @param {string} start - Start node ID
 * @param {string} end - End node ID
 * @returns {Object} { path, totalCost, visited }
 */
export function dijkstra(graph, start, end) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const pq = new MinHeap();

  // Initialize distances to infinity
  for (const node of Object.keys(graph)) {
    dist[node] = Infinity;
  }
  dist[start] = 0;
  pq.push({ node: start, cost: 0 });

  while (pq.size > 0) {
    const { node: current, cost } = pq.pop();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === end) break;

    for (const neighbor of (graph[current] || [])) {
      if (visited.has(neighbor.node)) continue;
      const newCost = cost + neighbor.cost;
      if (newCost < dist[neighbor.node]) {
        dist[neighbor.node] = newCost;
        prev[neighbor.node] = current;
        pq.push({ node: neighbor.node, cost: newCost });
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
    totalCost: dist[end] || Infinity,
    nodesVisited: visited.size
  };
}

export default { buildGraph, dijkstra };
