// Reserved building sites: ground the world designer has set aside for a future
// structure, with the spots its NPCs, monsters and boss will use. Placement data
// owned by world-designer (docs/world/WORLD_MAP.md); environment-artist builds
// from it. src/world/districts/WatRang.js builds WAT_RANG; CityMap.js adds its trail and plaza.
//
// Every record is world space (src/world/CityMap.js) and uses the same
// conventions as the training halls (src/data/halls.js):
//   map         the map (src/world/maps.js) the site lies on
//   x, z        centre of the reserved rectangle
//   w, d        width along the frontage and depth front to back
//   facing      yaw the front (main gate) faces (0 = +z south, π = north,
//               π/2 = east, -π/2 = west); pass it to ctx.place()
//   gate        threshold outside the main gate, where the approach path ends
//   approach    junction (CityMap J) or point the approach path starts from
//   parts       suggested layout of the main structures (the builder may adjust
//               them inside the rectangle)
//   spots       future NPC / monster / boss anchors { x, z, face }
//   zone        suggested monster area once the site is built (placed as wat_courtyard in spawns.js)

const WEST = -Math.PI / 2, EAST = Math.PI / 2;

// วัดร้าง: the abandoned temple whose ป่าช้า is the old cemetery. East of the
// cemetery on the wat_rang map, in the deep woods (random forest today), facing
// west toward the cemetery. Its ruined ordination hall is the boss arena (ปอบ).
export const WAT_RANG = {
  id: 'wat_rang', map: 'wat_rang', name: 'วัดร้าง', sub: 'อารามที่ถูกทิ้งไว้กลางไพร',
  x: 76, z: -540, w: 64, d: 56, facing: WEST,          // x 48 … 104, z -572 … -508
  gate: { x: 46.5, z: -540 },                          // west gate, 12 m east of the cemetery wall (x 34)
  approach: 'cem_e',                                   // trail from the cemetery's east path (18, -546) to the gate
  parts: {
    wall: { inset: 1.5 },                                                     // crumbling kamphaeng kaeo along the rectangle
    courtyard: { x: 66, z: -540, rx: 15, rz: 24 },                            // open laterite yard inside the gate
    chedi: { x: 64, z: -540, r: 6 },                                          // the broken main chedi, centre of the yard
    ubosot: { x: 88, z: -540, w: 12, d: 22, facing: WEST },                   // ruined ordination hall at the back (boss arena)
    sala: { x: 62, z: -518, w: 8, d: 5, facing: 0 },                          // collapsed sala on the south side of the yard (built facing π, toward the courtyard)
    stupas: [{ x: 58, z: -560 }, { x: 70, z: -562 }, { x: 80, z: -520 }],     // small bone stupas (krasue haunt)
  },
  spots: {
    boss: { x: 90, z: -540, face: WEST },              // ปอบ, inside the ordination hall facing the door
    rare: { x: 70, z: -562, face: 0 },                 // กระสือ among the stupas at night (rare)
    gate_npc: { x: 44.5, z: -536, face: WEST },        // a ghost monk / quest giver outside the gate
    yard_npc: { x: 60, z: -522, face: Math.PI },       // under the sala
    camp: { x: 40, z: -548, face: EAST },              // hunters' camp between the cemetery and the gate
  },
  zone: { x: 68, z: -540, radius: 14, monsters: ['phitaihong', 'winyan'], active: ['evening', 'night'] },
};

export const SITES = [WAT_RANG];
export const siteOf = id => SITES.find(s => s.id === id) ?? null;
