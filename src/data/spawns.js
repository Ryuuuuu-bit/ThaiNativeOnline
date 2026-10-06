// Monster spawn areas. นครอโยธยา is a safe city: every area lies on the map
// ทุ่งนอกเมือง (`fields`, north of the wall; src/world/maps.js). Placement is
// world-designer's (docs/world/WORLD_MAP.md); monster stats are content-designer's
// (src/combat/data/monsters.js).
//
//   SPAWNS: { id, monster, x, z, radius, active: [phases], max, boss? }
//           (`monster` is the label of the debug ring; `max` the area's cap)
//   ROSTER[area id]: [{ type (src/combat/data/monsters.js), count?, respawn?, chance?, active? }]
// combatSpawns() turns both into zones for createGame({ spawns }).
//
// Level bands run from the warp outside the North City Gate (0, -122.5) into the
// wild: beasts raid the orchards next to the gate (Lv 1-2), the grassland and
// forest edge mix beasts by day with forest spirits at night (Lv 1-4), the dense
// forest is haunted even by day (Lv 2-4), and the deep forest, the abandoned
// shrine and the old cemetery belong to the wandering dead (Lv 4-7). The elite
// and boss monsters (tiger, krasue, pop) are not placed yet.
const DAYLIGHT = ['morning', 'day', 'evening'];
const DUSK = ['evening', 'night'];
const NIGHT = ['night'];
const ALWAYS = ['morning', 'day', 'evening', 'night'];

export const SPAWNS = [
  // Orchards beside the gate road: the first hunt for a new character.
  { id: 'orchard_boars', monster: 'หมูป่า', x: 56, z: -172, radius: 13, active: DAYLIGHT, max: 4 },
  { id: 'orchard_monkeys', monster: 'ลิงกัง', x: 86, z: -214, radius: 14, active: DAYLIGHT, max: 4 },
  // Grassland under the old banyan, before the forest.
  { id: 'grassland', monster: 'หมูป่า · ผีป่า', x: -34, z: -276, radius: 16, active: ALWAYS, max: 5 },
  { id: 'forest_edge', monster: 'ลิงกัง · ผีป่า', x: 26, z: -334, radius: 15, active: ALWAYS, max: 4 },
  // Dense forest around the ruined chedi.
  { id: 'dense_forest', monster: 'ผีป่า · ผีพราย', x: -28, z: -372, radius: 18, active: ALWAYS, max: 5 },
  // Deep forest beyond the log bridge.
  { id: 'deep_forest', monster: 'ผีพราย · วิญญาณเร่ร่อน', x: 42, z: -456, radius: 20, active: ALWAYS, max: 5 },
  { id: 'abandoned_shrine', monster: 'วิญญาณเร่ร่อน', x: -36, z: -470, radius: 9, active: DUSK, max: 2 },
  // The road to the cemetery gate and the graves themselves (night only).
  { id: 'cemetery_path', monster: 'วิญญาณเร่ร่อน', x: 4, z: -492, radius: 11, active: DUSK, max: 3 },
  { id: 'cemetery_graves', monster: 'ผีตายโหง', x: 14, z: -548, radius: 10, active: NIGHT, max: 3 },
];
export const activeSpawns = phase => SPAWNS.filter(s => s.active.includes(phase));

const ROSTER = {
  orchard_boars: [{ type: 'boar', count: 4 }],
  orchard_monkeys: [{ type: 'monkey', count: 4 }],
  grassland: [
    { type: 'boar', count: 3, active: DAYLIGHT }, { type: 'monkey', count: 1, active: DAYLIGHT },
    { type: 'phibpa', count: 3, active: NIGHT },
  ],
  forest_edge: [
    { type: 'monkey', count: 3, active: DAYLIGHT },
    { type: 'phibpa', count: 3, active: NIGHT }, { type: 'pray', count: 1, active: NIGHT },
  ],
  dense_forest: [
    { type: 'monkey', count: 2, active: DAYLIGHT }, { type: 'phibpa', count: 2, active: DAYLIGHT },
    { type: 'phibpa', count: 2, active: NIGHT }, { type: 'pray', count: 3, active: NIGHT },
  ],
  deep_forest: [
    { type: 'pray', count: 3, active: DAYLIGHT },
    { type: 'pray', count: 2, active: NIGHT }, { type: 'winyan', count: 3, active: NIGHT },
  ],
  abandoned_shrine: [{ type: 'winyan', count: 2 }],
  cemetery_path: [{ type: 'winyan', count: 3 }],
  cemetery_graves: [{ type: 'phitaihong', count: 2 }, { type: 'winyan', count: 1 }],
};

// Combat zones: each area keeps its position, radius and phases; ROSTER entries may narrow the phases.
export function combatSpawns() {
  const zones = [];
  for (const area of SPAWNS) for (const entry of ROSTER[area.id] ?? []) {
    zones.push({ x: area.x, z: area.z, radius: area.radius, area: area.id, active: entry.active ?? area.active, count: entry.count ?? area.max, ...entry });
  }
  return zones;
}
