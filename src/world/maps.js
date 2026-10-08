// Map registry, Ragnarok-style: one map is loaded at a time and maps are linked
// by portals. นครอโยธยา lies inside the city walls; north of the wall the land
// is split into three zone maps along the bands where the scenery changes:
//   paddy       ทุ่งนาข้าว   rice fields, farmers' village, orchards, banyan (Lv 1-3)
//   deep_forest ป่าลึก       forest gate, dense forest, log bridge, deep forest (Lv 2-5)
//   wat_rang    วัดร้าง      abandoned shrine, old cemetery, ruined temple (Lv 4-8)
//   klong       คลองหนองบึง  marsh, klong, reed beds and ชาละวัน's lagoon (Lv 10-25)
// The North City Gate stays closed; a warp (ประตูวาป) in the gate passage and
// one outside the gate link the city with the paddies. The wild maps are joined
// by path exits on the trail (signposts), not by magic warps.
// Maps are built one at a time (and later map 1:1 to server rooms).
// Pure data and math (no three.js) so tests, the map manager and a future server
// read the same source of truth. Coordinates stay in world space (CityMap.js).
//
//   owns   — the band a map is responsible for. Every landmark, spawn area and
//            NPC home lies in exactly one map's `owns` band.
//   walk   — rectangles the player may stand in (union). Leaving them is only
//            possible through a portal. Each walk area stops a few metres short
//            of its band so neighbouring maps never touch.
//   view   — the built extent: terrain, ground paint and scenery. Wider than
//            `walk` so the camera never sees the edge of the map (near a seam
//            it shows the neighbouring map as non-interactive backdrop).
//   portals — walking into `at` (circle) moves the player to `to` at `arrive`.
//            `node` is the road junction visiting NPCs walk to when they leave;
//            `marker` is where the portal is drawn; `style` is 'warp' (glowing
//            ประตูวาป, default) or 'path' (a trail exit: trodden ground at `at`
//            and a signpost at `marker`).
//   theme, levels — display hints for the HUD/minimap: theme key
//            ('city' | 'paddy' | 'forest' | 'wat') and the level band [min, max]
//            of the map's monsters (null on safe maps).
//   intro  — the journal panel's heading and two short lines for the map
//            ({ title, text }, `\n` breaks the line; gameplay-engineer hook,
//            read by Game.updateJournal → HUD.setJournal).
import { expeditionMaps } from './expeditions.js';
import { J, BOUNDS, WALL } from './CityMap.js';

// The city wall runs along z = -110 (WALL.z); the seam sits just outside it.
export const SEAM_Z = -112;
// Seams between the wild maps: between the banyan (z -284) and the forest gate
// (z -305), and in the deep forest past the log bridge, before the shrine.
export const FOREST_SEAM_Z = -296;
export const WAT_SEAM_Z = -445;
// North of the cemetery the woods give way to the marsh.
export const KLONG_SEAM_Z = -600;

const FULL_X = { minX: -122, maxX: 122 };

export const MAPS = {
  city: {
    id: 'city', name: 'นครอโยธยา', sub: 'ราชธานีริมแม่น้ำ', safe: true, theme: 'city', levels: null,
    intro: { title: 'เมืองแห่งสายน้ำ', text: 'ตลาด วัด และลานฝึกริมแม่น้ำ\nประตูวาปทิศเหนือพาออกสู่ทุ่งนา' },
    owns: { minZ: SEAM_Z, maxZ: BOUNDS.maxZ },
    walk: [
      { minX: WALL.west - 2, maxX: 122, minZ: -108.5, maxZ: 266 }, // inside the walls (trimmed on the west; the wall itself blocks), port and river bank
    ],
    view: { minX: WALL.west - 24, maxX: BOUNDS.maxX, minZ: -192, maxZ: BOUNDS.maxZ },
    // New players and respawns start in the heart of the city: the south side of the market
    // plaza, a short walk from the shops, ลานฝึกครู (the training dummies) and the north gate.
    spawn: { x: 0, z: 52, facing: Math.PI },
    respawn: [[0, 52], [0, -99]],   // the market first (the north gate only if it is blocked)
    entities: ['boats', 'animals'],
    regions: ['river', 'port', 'fishmkt', 'fishing', 'riverside', 'market', 'merchants', 'smiths', 'training', 'halls', 'center', 'residential', 'temple', 'city', 'gate'],
    portals: [
      // The warp glows in the passage of the closed North City Gate.
      { id: 'warp_to_paddy', style: 'warp', at: { x: 0, z: -107, radius: 2.2 }, to: 'paddy', arrive: { x: 0, z: -130, facing: Math.PI }, node: 'gate_in', name: 'ประตูวาป', marker: { x: 0, z: -107 } },
    ],
    visitors: [],
  },
  paddy: {
    id: 'paddy', name: 'ทุ่งนาข้าว', sub: 'ทุ่งนา · หมู่บ้านชาวนา · สวนผลไม้', safe: false, theme: 'paddy', levels: [1, 3],
    intro: { title: 'ทุ่งนอกกำแพง', text: 'ทุ่งข้าว หมู่บ้านชาวนา และสวนผลไม้\nหมูป่ากับลิงกังชุกชุม ผีป่าออกยามค่ำ' },
    owns: { minZ: FOREST_SEAM_Z, maxZ: SEAM_Z },
    walk: [
      { ...FULL_X, minZ: -293, maxZ: -113.5 }, // from the outer face of the wall to the grassland under the banyan
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: -370, maxZ: -50 },
    spawn: { x: 0, z: -130, facing: Math.PI },
    respawn: [[0, -130], [-61.5, -132]],   // the warp yard outside the gate first, then the farmers' village
    entities: ['animals'],
    regions: ['gate', 'rice', 'orchards', 'north_road', 'grassland'],
    portals: [
      // Kept first: visiting city folk leave through it (npcsForMap).
      // Outside, the warp stands in front of the gate between the lantern posts (clear of the gate roof for the camera).
      { id: 'warp_to_city', style: 'warp', at: { x: 0, z: -122.5, radius: 2.2 }, to: 'city', arrive: { x: 0, z: -99, facing: 0 }, node: 'gate_out', name: 'ประตูวาป', marker: { x: 0, z: -122.5 } },
      // The north road leaves the grassland past the banyan toward the forest gate.
      { id: 'path_to_forest', style: 'path', at: { x: -0.9, z: -290, radius: 2.4 }, to: 'deep_forest', arrive: { x: 0, z: -311, facing: Math.PI }, node: 'n6', name: 'ทางเข้าป่า', marker: { x: -5.4, z: -289 } },
    ],
    // City folk whose schedule takes them outside the wall: the gate guards stand
    // beside the outer warp and the herbalist gathers herbs in the morning.
    visitors: ['guard_gate_w', 'guard_gate_e', 'herbalist'],
  },
  deep_forest: {
    id: 'deep_forest', name: 'ป่าลึก', sub: 'ศาลปากป่า · ป่าทึบ · ไพรลึกเหนือลำธาร', safe: false, theme: 'forest', levels: [2, 5],
    intro: { title: 'ไพรลึกเหนือลำธาร', text: 'ศาลปากป่า ป่าทึบ และสะพานซุง\nผีป่าและผีพรายซ่อนตัวในเงาไม้' },
    owns: { minZ: WAT_SEAM_Z, maxZ: FOREST_SEAM_Z },
    walk: [
      { ...FULL_X, minZ: -442, maxZ: -298.5 }, // from the forest gate across the log bridge into the deep forest
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: -520, maxZ: -225 },
    spawn: { x: 0, z: -311, facing: Math.PI },
    respawn: [[0, -311], [-4, -318]],   // just inside the forest gate
    entities: [],
    regions: ['forest_edge', 'forest', 'deep'],
    portals: [
      { id: 'path_to_paddy', style: 'path', at: { x: 0, z: -301, radius: 2.4 }, to: 'paddy', arrive: { x: -1.6, z: -282, facing: 0 }, node: 'fe', name: 'ทางออกสู่ทุ่ง', marker: { x: -4.6, z: -301.5 } },
      // The forest trail beyond the log bridge runs on toward the abandoned shrine.
      { id: 'path_to_wat', style: 'path', at: { x: 8.5, z: -439, radius: 2.4 }, to: 'wat_rang', arrive: { x: -1.5, z: -459, facing: Math.PI }, node: 'f5', name: 'ทางสู่วัดร้าง', marker: { x: 13, z: -437 } },
    ],
    visitors: [],
  },
  wat_rang: {
    id: 'wat_rang', name: 'วัดร้าง', sub: 'ศาลร้างกลางไพร · สุสานเก่า · โบสถ์ร้าง', safe: false, theme: 'wat', levels: [4, 8],
    intro: { title: 'วัดร้างกลางไพร', text: 'ศาลร้าง สุสานเก่า และโบสถ์ร้าง\nวิญญาณเร่ร่อนชุมนุมยามราตรี' },
    owns: { minZ: KLONG_SEAM_Z, maxZ: WAT_SEAM_Z },
    walk: [
      { ...FULL_X, minZ: -592, maxZ: -447 }, // the woods around the shrine, the cemetery and the ruined temple
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: -660, maxZ: -375 },
    spawn: { x: -1.5, z: -459, facing: Math.PI },
    respawn: [[-1.5, -459], [-6, -462]],   // the trail head where the path from the forest arrives
    entities: [],
    regions: ['wat_wood', 'shrine', 'cemetery'],
    portals: [
      { id: 'path_to_deep_forest', style: 'path', at: { x: 3, z: -450, radius: 2.4 }, to: 'deep_forest', arrive: { x: 10.5, z: -429, facing: 0 }, node: 'f6', name: 'ทางกลับป่าลึก', marker: { x: -1.6, z: -451 } },
      // West of the cemetery a trail runs north out of the woods into the marsh.
      { id: 'path_to_klong', style: 'path', at: { x: -40, z: -589, radius: 2.4 }, to: 'klong', arrive: { x: -40, z: -612, facing: Math.PI }, node: 'kw2', name: 'ทางสู่คลองหนองบึง', marker: { x: -35.5, z: -588 } },
    ],
    visitors: [],
  },
  klong: {
    id: 'klong', name: 'คลองหนองบึง', sub: 'ดงอ้อ · คลองใหญ่ · หนองน้ำ · ถิ่นชาละวัน', safe: false, theme: 'klong', levels: [10, 25],
    intro: { title: 'คลองหนองบึง', text: 'ป่าอ้อ หนองน้ำ และคลองใหญ่ที่ไม่มีใครกล้าข้าม\nจระเข้และผีพรายน้ำซุ่มอยู่ใต้ผิวน้ำ' },
    owns: { minZ: BOUNDS.minZ, maxZ: KLONG_SEAM_Z },
    walk: [
      { ...FULL_X, minZ: -800, maxZ: -603.5 }, // from the trail out of the woods across the klong to the lagoon
    ],
    view: { minX: BOUNDS.minX, maxX: BOUNDS.maxX, minZ: BOUNDS.minZ, maxZ: -540 },
    spawn: { x: -40, z: -612, facing: Math.PI },
    respawn: [[-40, -612], [-34, -616]],   // where the trail from the woods comes out
    entities: [],
    regions: ['marsh', 'reeds', 'klong_bank', 'lagoon'],
    portals: [
      { id: 'path_to_wat', style: 'path', at: { x: -40, z: -605.5, radius: 2.4 }, to: 'wat_rang', arrive: { x: -41, z: -580, facing: 0 }, node: 'k0', name: 'ทางกลับวัดร้าง', marker: { x: -44.5, z: -606 } },
      { id:'klong_to_bamboo',style:'warp',name:'ประตูป่าช้า',node:'k0',at:{x:0,z:-795,radius:2.4},to:'bamboo_grave',arrive:{x:0,z:-844,facing:Math.PI}},
    ],
    visitors: [],
  },
  ...expeditionMaps(),
};
// Map ids from older saves: `fields` (all the land outside the wall) was split
// into paddy, deep_forest and wat_rang. resolveLocation() moves such saves.
export const LEGACY_MAPS = { fields: ['paddy', 'deep_forest', 'wat_rang'] };
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
// The one map responsible for a world position (null outside the world's bands).
export function mapOf(x, z) {
  for (const id of MAP_IDS) { const o = MAPS[id].owns; if (z >= o.minZ && z < o.maxZ) return id; }
  return null;
}
export const portalAt = (map, x, z) => map.portals.find(p => Math.hypot(x - p.at.x, z - p.at.z) < p.at.radius) ?? null;

// Arrival points on a map: where its incoming portals put the player.
export const arrivalsOn = mapId => MAP_IDS.flatMap(id => MAPS[id].portals.filter(p => p.to === mapId).map(p => p.arrive));

// A saved `{ map, x, z, facing }` made valid for the current registry. Saves from
// a retired map (LEGACY_MAPS, e.g. `fields`) or with an unknown id go to the map
// that owns their position; a position that falls between two maps' walk areas
// moves to the nearest arrival point of that map. Returns null if nothing fits.
export function resolveLocation(saved) {
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return null;
  const { x, z } = saved, facing = Number.isFinite(saved.facing) ? saved.facing : Math.PI;
  if (MAPS[saved.map]) return { map: saved.map, x, z, facing };
  const id = mapOf(x, z);
  if (!id || (LEGACY_MAPS[saved.map] && !LEGACY_MAPS[saved.map].includes(id))) return null;
  if (walkable(MAPS[id], x, z)) return { map: id, x, z, facing };
  const near = [...arrivalsOn(id), MAPS[id].spawn].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  return { map: id, x: near.x, z: near.z, facing: near.facing ?? Math.PI };
}

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
// The map an NPC lives on; null if its home is outside every map.
export function npcMap(def) {
  if (MAPS[def.map]) return def.map;
  const h = npcHome(def);
  return h ? mapOf(h[0], h[1]) : DEFAULT_MAP;
}

// The NPC roster for one map: residents plus listed visitors. Activities at spots
// that do not exist on this map become "home" (the NPC is elsewhere); visitors go
// "home" by walking to the map's portal (if it has one). `has(id)` tells whether a nav node exists.
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
