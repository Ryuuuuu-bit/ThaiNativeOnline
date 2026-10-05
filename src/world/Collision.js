// Static collision in a spatial hash: circles (trees, posts), oriented boxes
// (buildings) and capsules (walls, fences). Decks are walkable surfaces that
// may span water: piers, bridges and stepping logs.
// `rect` (optional) limits the shapes kept to one map's built extent.
export class Collision {
  constructor(cell = 8, rect = null) { this.cell = cell; this.rect = rect; this.shapes = new Map(); this.decks = new Map(); this.count = 0; }
  insert(map, shape, minX, minZ, maxX, maxZ) {
    const c = this.cell, r = this.rect;
    if (r && (maxX < r.minX || minX > r.maxX || maxZ < r.minZ || minZ > r.maxZ)) return;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++) for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
      const key = ix * 100003 + iz; let list = map.get(key);
      if (!list) map.set(key, list = []);
      list.push(shape);
    }
    this.count++;
  }
  addCircle(x, z, r) { this.insert(this.shapes, { t: 0, x, z, r }, x - r - 1, z - r - 1, x + r + 1, z + r + 1); }
  addBox(x, z, w, d, rot = 0) {
    const R = Math.hypot(w, d) / 2 + 1;
    this.insert(this.shapes, { t: 1, x, z, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot) }, x - R, z - R, x + R, z + R);
  }
  addSegment(x1, z1, x2, z2, r) {
    this.insert(this.shapes, { t: 2, x1, z1, x2, z2, r }, Math.min(x1, x2) - r - 1, Math.min(z1, z2) - r - 1, Math.max(x1, x2) + r + 1, Math.max(z1, z2) + r + 1);
  }
  // Long axis is local z. ramps = [length at -z end, length at +z end].
  addDeck(x, z, w, d, rot, height, ramps = [1.5, 1.5]) {
    const R = Math.hypot(w, d) / 2 + 1;
    this.insert(this.decks, { x, z, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot), h: height, ramps }, x - R, z - R, x + R, z + R);
  }
  cellList(map, x, z) { return map.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell)); }
  blocked(x, z, pad = .28) {
    const list = this.cellList(this.shapes, x, z);
    if (!list) return false;
    for (const s of list) {
      if (s.t === 0) { if ((x - s.x) ** 2 + (z - s.z) ** 2 < (s.r + pad) ** 2) return true; }
      else if (s.t === 1) {
        const dx = x - s.x, dz = z - s.z;
        if (Math.abs(dx * s.c - dz * s.s) < s.hw + pad && Math.abs(dx * s.s + dz * s.c) < s.hd + pad) return true;
      } else {
        const ex = s.x2 - s.x1, ez = s.z2 - s.z1, len = ex * ex + ez * ez;
        const t = len ? Math.min(1, Math.max(0, ((x - s.x1) * ex + (z - s.z1) * ez) / len)) : 0;
        if ((x - s.x1 - ex * t) ** 2 + (z - s.z1 - ez * t) ** 2 < (s.r + pad) ** 2) return true;
      }
    }
    return false;
  }
  deckHeight(x, z) {
    const list = this.cellList(this.decks, x, z);
    if (!list) return null;
    let best = null;
    for (const d of list) {
      const dx = x - d.x, dz = z - d.z, lx = dx * d.c - dz * d.s, lz = dx * d.s + dz * d.c;
      if (Math.abs(lx) > d.hw || Math.abs(lz) > d.hd) continue;
      const ramp = lz < 0 ? d.ramps[0] : d.ramps[1], edge = d.hd - Math.abs(lz);
      const h = ramp > 0 ? d.h * Math.min(1, edge / ramp) : d.h;
      if (best === null || h > best) best = h;
    }
    return best;
  }
}
