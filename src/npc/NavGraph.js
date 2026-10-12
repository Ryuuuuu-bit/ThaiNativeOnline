import { J, ROADS, resample } from '../world/CityMap.js';
import { findPath as gridPath, clearLine } from '../core/GridPath.js';

// Waypoint navigation over the road network. Roads are resampled into nodes so
// NPCs follow curves; named junctions and spots become addressable nodes.
// findPath() is the only query NPCs use, so a navmesh can replace this class.
export class NavGraph {
  constructor() { this.nodes = new Map(); this.anon = 0; }
  add(id, x, z) { let n = this.nodes.get(id); if (!n) this.nodes.set(id, n = { id, x, z, edges: [] }); return n; }
  connect(a, b) {
    const A = this.nodes.get(a), B = this.nodes.get(b);
    if (!A || !B || a === b || A.edges.some(e => e.to === b)) return;
    const cost = Math.hypot(A.x - B.x, A.z - B.z);
    A.edges.push({ to: b, cost }); B.edges.push({ to: a, cost });
  }
  connectWalkable(a,b,canStand) {
    const A=this.nodes.get(a),B=this.nodes.get(b);
    if(!A||!B||a===b)return;
    const path=gridPath(canStand,A,B,{step:1,margin:24});
    if(!path)return;
    let previous=a;
    for(let i=0;i<path.length-1;i++) {
      const id=`~${this.anon++}`;this.add(id,path[i].x,path[i].z);this.connect(previous,id);previous=id;
    }
    this.connect(previous,b);
  }
  static fromCompactCity(world) {
    const g=new NavGraph();
    g.add('center',0,0);
    for(const [id,s] of Object.entries(world.spots))g.add(id,s.x,s.z);
    for(const id of [...g.nodes.keys()])g.connectWalkable(id,'center',(x,z)=>world.canStand(x,z,.35));
    // Nearby anchors need local links: dock workers must not cross the whole
    // plaza to carry one load, and temple circuits follow the exterior corners.
    // Keep the existing collision-aware plaza paths as inter-district links.
    const anchors = Object.keys(world.spots).map(id => g.nodes.get(id));
    for (const a of anchors) {
      const neighbors = anchors.filter(b => b !== a && Math.hypot(b.x-a.x,b.z-a.z) <= 24)
        .sort((b,c) => Math.hypot(b.x-a.x,b.z-a.z) - Math.hypot(c.x-a.x,c.z-a.z)).slice(0,8);
      for (const b of neighbors) if (clearLine((x,z)=>world.canStand(x,z,.35),a.x,a.z,b.x,b.z)) g.connect(a.id,b.id);
    }
    return g;
  }
  // keep(x, z) (optional): only junctions on the current map; road segments
  // need both ends kept.
  static fromRoads(keep = null) {
    const g = new NavGraph();
    for (const [id, [x, z]] of Object.entries(J)) if (!keep || keep(x, z)) g.add(id, x, z);
    for (const road of ROADS) {
      for (let i = 1; i < road.pts.length; i++) {
        const a = road.pts[i - 1], b = road.pts[i], pa = J[a], pb = J[b];
        if (!g.nodes.has(a) || !g.nodes.has(b)) continue;
        const line = resample([pa, pb], 6);
        let prev = a;
        for (let k = 1; k < line.length - 1; k++) { const id = `~${g.anon++}`; g.add(id, ...line[k]); g.connect(prev, id); prev = id; }
        g.connect(prev, b);
      }
    }
    return g;
  }
  nearest(x, z, filter = n => !n.id.startsWith('spot:')) {
    let best = null, bd = Infinity;
    for (const n of this.nodes.values()) { if (!filter(n)) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  }
  // A* with a straight-line heuristic. Returns node objects from a to b.
  findPath(a, b) {
    if (a === b) return [this.nodes.get(a)];
    const goal = this.nodes.get(b), start = this.nodes.get(a);
    if (!goal || !start) return null;
    const open = new Map([[a, Math.hypot(start.x - goal.x, start.z - goal.z)]]), g = new Map([[a, 0]]), from = new Map(), closed = new Set();
    while (open.size) {
      let current = null, best = Infinity;
      for (const [id, f] of open) if (f < best) { best = f; current = id; }
      if (current === b) {
        const path = [this.nodes.get(b)];
        while (from.has(path[0].id)) path.unshift(this.nodes.get(from.get(path[0].id)));
        return path;
      }
      open.delete(current); closed.add(current);
      for (const e of this.nodes.get(current).edges) {
        if (closed.has(e.to)) continue;
        const cost = g.get(current) + e.cost;
        if (cost >= (g.get(e.to) ?? Infinity)) continue;
        const n = this.nodes.get(e.to);
        from.set(e.to, current); g.set(e.to, cost); open.set(e.to, cost + Math.hypot(n.x - goal.x, n.z - goal.z));
      }
    }
    return null;
  }
}
