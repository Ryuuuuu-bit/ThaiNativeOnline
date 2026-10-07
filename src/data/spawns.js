// Monster spawn areas. นครอโยธยา is a safe city: every area lies on one of the
// three wild zone maps north of the wall (src/world/maps.js), which map an area
// belongs to follows from its position (mapOf). Placement is world-designer's
// (docs/world/WORLD_MAP.md); monster stats are content-designer's
// (src/combat/data/monsters.js).
//
//   SPAWNS: { id, monster, x, z, radius, active: [phases], max, boss? }
//           (`monster` is the label of the debug ring; `max` the area's cap)
//   ROSTER[area id]: [{ type (src/combat/data/monsters.js), count?, respawn?, chance?, active? }]
// combatSpawns() turns both into zones for createGame({ spawns }).
//
// Level bands rise map by map, away from the city:
//   paddy ทุ่งนาข้าว (Lv 1-3): beasts raid the orchards by the gate by day; the
//     grassland under the banyan has beasts by day and a few ผีป่า at night.
//   deep_forest ป่าลึก (Lv 2-5): monkeys and forest spirits at the forest edge,
//     the dense forest is haunted even by day, and beyond the log bridge ผีพราย
//     roam by day and วิญญาณเร่ร่อน join them at night.
//   wat_rang วัดร้าง (Lv 4-7): ผีพราย in the woods around the ruins by day; at
//     dusk the wandering dead fill the shrine and the cemetery path, and at night
//     ผีตายโหง rise from the graves.
// No area reaches a portal arrival point (tests/two-maps-qa.test.js). The elite
// and boss monsters (tiger, krasue, pop) are not placed yet.
const DAYLIGHT = ['morning', 'day', 'evening'];
const DUSK = ['evening', 'night'];
const NIGHT = ['night'];
const ALWAYS = ['morning', 'day', 'evening', 'night'];

export const SPAWNS = [
  // ---- paddy ทุ่งนาข้าว ----
  // Orchards beside the gate road: the first hunt for a new character.
  { id: 'orchard_boars', monster: 'หมูป่า', x: 56, z: -172, radius: 13, active: DAYLIGHT, max: 4 },
  { id: 'orchard_monkeys', monster: 'ลิงกัง', x: 86, z: -214, radius: 14, active: DAYLIGHT, max: 4 },
  // Grassland west of the banyan, before the forest.
  { id: 'grassland', monster: 'หมูป่า · ผีป่า', x: -40, z: -268, radius: 16, active: ALWAYS, max: 5 },

  // ---- deep_forest ป่าลึก ----
  { id: 'forest_edge', monster: 'ลิงกัง · ผีป่า', x: 26, z: -336, radius: 15, active: ALWAYS, max: 4 },
  // Dense forest around the ruined chedi.
  { id: 'dense_forest', monster: 'ผีป่า · ผีพราย', x: -28, z: -372, radius: 18, active: ALWAYS, max: 5 },
  // Deep forest beyond the log bridge.
  { id: 'deep_forest', monster: 'ผีพราย · วิญญาณเร่ร่อน', x: 48, z: -423, radius: 12, active: ALWAYS, max: 5 },
  { id: 'deep_west', monster: 'ผีพราย', x: -52, z: -428, radius: 13, active: ALWAYS, max: 4 },

  // ---- wat_rang วัดร้าง ----
  // The overgrown woods around the ruins.
  { id: 'wat_grove', monster: 'ผีพราย · วิญญาณเร่ร่อน', x: 46, z: -480, radius: 16, active: ALWAYS, max: 4 },
  { id: 'abandoned_shrine', monster: 'วิญญาณเร่ร่อน', x: -36, z: -470, radius: 9, active: DUSK, max: 2 },
  // The road to the cemetery gate and the graves themselves (night only).
  { id: 'cemetery_path', monster: 'วิญญาณเร่ร่อน', x: 4, z: -492, radius: 11, active: DUSK, max: 3 },
  { id: 'cemetery_graves', monster: 'ผีตายโหง', x: 14, z: -548, radius: 10, active: NIGHT, max: 3 },
  { id: 'wat_courtyard', monster: 'ผีวัดร้าง', x: 68, z: -540, radius: 14, active: DUSK, max: 4 },   // the วัดร้าง yard (src/data/sites.js)
];
export const activeSpawns = phase => SPAWNS.filter(s => s.active.includes(phase));

const ROSTER = {
  orchard_boars: [{ type: 'boar', count: 4 }],
  orchard_monkeys: [{ type: 'monkey', count: 4 }],
  grassland: [
    { type: 'boar', count: 3, active: DAYLIGHT }, { type: 'monkey', count: 1, active: DAYLIGHT },
    { type: 'phibpa', count: 2, active: NIGHT },
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
  deep_west: [
    { type: 'phibpa', count: 1, active: DAYLIGHT }, { type: 'pray', count: 2, active: DAYLIGHT },
    { type: 'pray', count: 2, active: NIGHT }, { type: 'winyan', count: 1, active: NIGHT },
  ],
  wat_grove: [
    { type: 'pray', count: 3, active: DAYLIGHT },
    { type: 'winyan', count: 3, active: NIGHT },
  ],
  abandoned_shrine: [{ type: 'winyan', count: 2 }],
  cemetery_path: [{ type: 'winyan', count: 3 }],
  cemetery_graves: [{ type: 'phitaihong', count: 2 }, { type: 'winyan', count: 1 }],
  wat_courtyard: [{ type: 'phitaihong', count: 2 }, { type: 'winyan', count: 2 }],
};

// Combat zones: each area keeps its position, radius and phases; ROSTER entries may narrow the phases.
export function combatSpawns() {
  const zones = [];
  for (const area of SPAWNS) for (const entry of ROSTER[area.id] ?? []) {
    zones.push({ x: area.x, z: area.z, radius: area.radius, area: area.id, active: entry.active ?? area.active, count: entry.count ?? area.max, ...entry });
  }
  return zones;
}
