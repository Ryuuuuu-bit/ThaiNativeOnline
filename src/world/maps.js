// Map registry: the world is split at the North City Gate (ประตูเมืองทิศเหนือ)
// into two maps that are built one at a time (and later map 1:1 to server rooms).
// Pure data and math (no three.js) so tests, the map manager and a future server
// read the same source of truth. Coordinates stay in world space: each map is a
// window onto the shared geography in CityMap.js.
//
//   owns   — the half-plane a map is responsible for. Every landmark, spawn area
//            and NPC home lies in exactly one map's `owns` area.
//   walk   — rectangles the player may stand in (union). Leaving them is only
//            possible through a portal.
//   view   — the built extent: terrain, ground paint and scenery. Wider than
//            `walk` so the camera never sees the edge of the map (a backdrop of
//            the neighbouring map near the seam; nothing there is interactive).
//   portals — walking into `at` (circle) moves the player to `to` at `arrive`.
//            `node` is the road junction NPCs walk to when they leave the map;
//            `marker` is where the glowing ground ring and label are drawn.
import { J, BOUNDS } from './CityMap.js';

// The city wall runs along z = -110 (WALL.z); the seam sits just outside it.
export const SEAM_Z = -112;

export const MAPS = {
  city: {
    id: 'city', name: 'นครอโยธยา', sub: 'ราชธานีริมแม่น้ำ', safe: true,
    owns: { minZ: SEAM_Z, maxZ: BOUNDS.maxZ },
    walk: [
      { minX: -122, maxX: 122, minZ: -108.5, maxZ: 266 }, // inside the walls, port and river bank
      { minX: -4.5, maxX: 4.5, minZ: -123, maxZ: -108 }, // the gate passage and its mouth outside the wall
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: -192, maxZ: BOUNDS.maxZ },
    spawn: { x: 4, z: 151, facing: Math.PI },
    respawn: [[0, -99], [4, 151]],
    entities: ['boats', 'animals'],
    regions: ['river', 'port', 'fishmkt', 'fishing', 'riverside', 'market', 'merchants', 'smiths', 'training', 'center', 'residential', 'temple', 'city', 'gate'],
    portals: [
      { id: 'north_gate_out', at: { x: 0, z: -121, radius: 6 }, to: 'wilds', arrive: { x: 0, z: -129, facing: Math.PI }, node: 'gate_out', name: 'ประตูเมืองทิศเหนือ', marker: { x: 0, z: -110 } },
    ],
    visitors: [],
  },
  wilds: {
    id: 'wilds', name: 'นอกเมือง', sub: 'ทุ่งนา สวน และผืนป่าเหนือนคร', safe: false,
    owns: { minZ: BOUNDS.minZ, maxZ: SEAM_Z },
    walk: [
      { minX: -122, maxX: 122, minZ: -607, maxZ: -111 }, // fields, forest and cemetery up to the outer face of the wall
      { minX: -4.5, maxX: 4.5, minZ: -112, maxZ: -104 }, // through the gate passage
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: BOUNDS.minZ, maxZ: -50 },
    spawn: { x: 0, z: -129, facing: Math.PI },
    respawn: [[8, -312], [4, -300], [0, -129]],
    entities: ['animals'],
    regions: ['gate', 'rice', 'orchards', 'north_road', 'grassland', 'forest_edge', 'forest', 'deep', 'shrine', 'cemetery'],
    portals: [
      { id: 'north_gate_in', at: { x: 0, z: -104, radius: 5 }, to: 'city', arrive: { x: 0, z: -99, facing: 0 }, node: 'gate_out', name: 'ประตูเมืองทิศเหนือ', marker: { x: 0, z: -110 } },
    ],
    // City folk whose schedule takes them outside the gate: the herbalist gathers
    // herbs in the morning and the gate guards stand just outside the gate.
    visitors: ['herbalist', 'guard_gate_w', 'guard_gate_e'],
  },
};
export const MAP_IDS = Object.keys(MAPS);
export const DEFAULT_MAP = 'city';

const inRect = (r, x, z) => x >= (r.minX ?? -Infinity) && x <= (r.maxX ?? Infinity) && z >= (r.minZ ?? -Infinity) && z <= (r.maxZ ?? Infinity);
export const inView = (map, x, z) => inRect(map.view, x, z);
export const walkable = (map, x, z) => map.walk.some(r => inRect(r, x, z));
// Bounding box of the walkable area (minimap and world-map extent).
export function walkBounds(map) {
  return {
    minX: Math.min(...map.walk.map(r => r.minX)), maxX: Math.max(...map.walk.map(r => r.maxX)),
    minZ: Math.min(...map.walk.map(r => r.minZ)), maxZ: Math.max(...map.walk.map(r => r.maxZ)),
  };
}
// The one map responsible for a world position.
export function mapOf(x, z) {
  for (const id of MAP_IDS) { const o = MAPS[id].owns; if (z >= o.minZ && z < o.maxZ) return id; }
  return z >= SEAM_Z ? 'city' : 'wilds';
}
export const portalAt = (map, x, z) => map.portals.find(p => Math.hypot(x - p.at.x, z - p.at.z) < p.at.radius) ?? null;

// ---- Content membership ----
export const landmarksOf = (mapId, landmarks) => landmarks.filter(l => mapOf(l.x, l.z) === mapId);
export const spawnsOf = (mapId, spawns) => spawns.filter(s => mapOf(s.x, s.z) === mapId);

// Where an NPC lives: its home junction, or the first road junction in its
// schedule (null for NPCs homed at a district spot; those declare `map`).
export function npcHome(def) {
  if (def.home?.near && J[def.home.near]) return J[def.home.near];
  for (const act of Object.values(def.schedule ?? {})) {
    const stops = act.do === 'route' ? act.stops : act.do === 'stay' ? [act.at] : [];
    for (const s of stops) {
      const at = typeof s === 'object' && 'at' in s ? s.at : s;
      if (typeof at === 'string' && J[at]) return J[at];
      if (at && typeof at === 'object') return [at.x, at.z];
    }
  }
  return null;
}
export function npcMap(def) {
  if (MAPS[def.map]) return def.map;
  const h = npcHome(def);
  return h ? mapOf(h[0], h[1]) : DEFAULT_MAP;
}

// The NPC roster for one map: residents plus listed visitors. Activities at spots
// that do not exist on this map become "home" (the NPC is elsewhere); visitors go
// "home" by walking to the map's portal. `has(id)` tells whether a nav node exists.
export function npcsForMap(defs, mapId, has) {
  const map = MAPS[mapId], exit = map.portals[0]?.node;
  const present = at => (typeof at === 'string' ? has(at) : walkable(map, at.x, at.z));
  const out = [];
  for (const def of defs) {
    const resident = npcMap(def) === mapId;
    if (!resident && !map.visitors.includes(def.id)) continue;
    const schedule = {};
    for (const [phase, act] of Object.entries(def.schedule ?? {})) {
      if (act.do === 'stay') schedule[phase] = present(act.at) ? act : { do: 'home' };
      else if (act.do === 'route') {
        const stops = act.stops.filter(s => present(typeof s === 'string' ? s : s.at));
        schedule[phase] = stops.length ? { ...act, stops } : { do: 'home' };
      } else schedule[phase] = act;
    }
    out.push({ ...def, schedule, ...(resident ? {} : { home: exit, visitor: true }) });
  }
  return out;
}
