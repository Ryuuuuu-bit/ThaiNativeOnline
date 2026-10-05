// Click-to-walk route planning: A* over a walkability grid sampled lazily from
// canStand inside a box around the start and goal, then shortened with
// line-of-sight checks. Works on any canStand(x, z), so it runs in Node tests.
const NEIGHBOURS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function clearLine(canStand, ax, az, bx, bz, spacing = .1) {
  const samples = Math.ceil(Math.hypot(bx - ax, bz - az) / spacing);
  for (let s = 1; s <= samples; s++) if (!canStand(ax + (bx - ax) * s / samples, az + (bz - az) * s / samples)) return false;
  return true;
}

// Returns waypoints [{x, z}, ...] ending at `to`, or null when no route exists within the search box.
export function findPath(canStand, from, to, { step = .5, margin = 14, maxCells = 160000 } = {}) {
  if (clearLine(canStand, from.x, from.z, to.x, to.z)) return [{ x: to.x, z: to.z }];
  const minX = Math.min(from.x, to.x) - margin, minZ = Math.min(from.z, to.z) - margin;
  const cols = Math.ceil((Math.max(from.x, to.x) + margin - minX) / step) + 1, rows = Math.ceil((Math.max(from.z, to.z) + margin - minZ) / step) + 1;
  if (cols * rows > maxCells) return null;
  const cellX = i => minX + i * step, cellZ = j => minZ + j * step;
  const walk = new Int8Array(cols * rows).fill(-1);
  const walkable = (i, j) => { const k = i * rows + j; if (walk[k] < 0) walk[k] = canStand(cellX(i), cellZ(j)) ? 1 : 0; return walk[k] === 1; };
  const si = Math.round((from.x - minX) / step), sj = Math.round((from.z - minZ) / step);
  const ti = Math.round((to.x - minX) / step), tj = Math.round((to.z - minZ) / step);
  if (!walkable(ti, tj)) return null;
  const start = si * rows + sj, goal = ti * rows + tj;
  const cost = new Float32Array(cols * rows).fill(Infinity), parent = new Int32Array(cols * rows).fill(-1), closed = new Uint8Array(cols * rows);
  const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
  const heap = [];
  const push = (node, f) => {
    heap.push([f, node]);
    for (let k = heap.length - 1; k;) { const up = (k - 1) >> 1; if (heap[up][0] <= heap[k][0]) break; [heap[up], heap[k]] = [heap[k], heap[up]]; k = up; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = k * 2 + 1, r = l + 1; let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top[1];
  };
  cost[start] = 0; push(start, h(si, sj));
  let found = false;
  while (heap.length) {
    const node = pop();
    if (closed[node]) continue;
    closed[node] = 1;
    if (node === goal) { found = true; break; }
    const i = Math.floor(node / rows), j = node % rows;
    for (const [di, dj, d] of NEIGHBOURS) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || !walkable(ni, nj)) continue;
      // Diagonals may not cut the corner of a blocked cell.
      if (di && dj && (!walkable(ni, j) || !walkable(i, nj))) continue;
      const next = ni * rows + nj, g = cost[node] + d;
      if (g >= cost[next]) continue;
      cost[next] = g; parent[next] = node; push(next, g + h(ni, nj));
    }
  }
  if (!found) return null;
  const cells = [];
  for (let node = goal; node !== -1; node = parent[node]) cells.push({ x: cellX(Math.floor(node / rows)), z: cellZ(node % rows) });
  cells.reverse(); cells[cells.length - 1] = { x: to.x, z: to.z };
  // String-pull: keep only the waypoints that are not visible from the previous kept one.
  const route = [];
  for (let anchor = from, k = 0; k < cells.length;) {
    let far = k;
    while (far + 1 < cells.length && clearLine(canStand, anchor.x, anchor.z, cells[far + 1].x, cells[far + 1].z)) far++;
    route.push(cells[far]); anchor = cells[far]; k = far + 1;
  }
  return route;
}
