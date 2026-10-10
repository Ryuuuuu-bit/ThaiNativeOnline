import { EXPEDITIONS } from '../world/expeditions.js';
// Monster spawn areas. นครที่ถูกลืมเลือน is a safe city: every area lies on one of the
// three wild zone maps north of the wall (src/world/maps.js), which map an area
// belongs to follows from its position (mapOf). Placement is world-designer's
// (docs/world/WORLD_MAP.md); monster stats are content-designer's
// (src/combat/data/monsters.js).
//
//   SPAWNS: { id, monster, x, z, radius, active: [phases], max, boss? }
//           (`monster` is the label of the debug ring; `max` the area's cap before DENSITY)
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
// No area reaches a portal arrival point (tests/two-maps-qa.test.js).
// Elites and bosses hold a spot of their own with a long respawn: ควายป่า in the
// paddies, นางตะเคียน in her tree, ผีปู่โสม in the ordination hall, กระสือ over the
// stupas some nights. ปอบ is not placed yet.
import { MONSTERS } from '../combat/data/monsters.js';
import { HUNTING_GROUNDS } from './hunting.js';

// How full the maps are: every ordinary monster's count is multiplied by this (elites and
// bosses stay one at a time). With RULES.monsterRespawn this sets how fast a map refills.
export const DENSITY = 2;

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
  { id: 'rice_fowl', monster: 'ไก่ป่า', x: -60, z: -176, radius: 16, active: DAYLIGHT, max: 5 },
  { id: 'paddy_channels', monster: 'งูเห่านา · ปูนา', x: -92, z: -226, radius: 14, active: ALWAYS, max: 5 },
  { id: 'buffalo_meadow', monster: 'ควายป่า', x: 72, z: -252, radius: 10, active: ALWAYS, max: 1, boss: true },

  // ---- deep_forest ป่าลึก ----
  { id: 'forest_edge', monster: 'ลิงกัง · ผีป่า', x: 26, z: -336, radius: 15, active: ALWAYS, max: 4 },
  // Dense forest around the ruined chedi.
  { id: 'dense_forest', monster: 'ผีป่า · ผีพราย', x: -28, z: -372, radius: 18, active: ALWAYS, max: 5 },
  // Deep forest beyond the log bridge.
  { id: 'deep_forest', monster: 'ผีพราย · วิญญาณเร่ร่อน', x: 48, z: -423, radius: 12, active: ALWAYS, max: 5 },
  { id: 'deep_west', monster: 'ผีพราย', x: -52, z: -428, radius: 13, active: ALWAYS, max: 4 },
  { id: 'dhole_trail', monster: 'หมาไน', x: 62, z: -368, radius: 14, active: ALWAYS, max: 4 },
  { id: 'monitor_stream', monster: 'เหี้ย', x: -86, z: -396, radius: 12, active: DAYLIGHT, max: 3 },
  { id: 'wisp_hollow', monster: 'ผีโขมด · ผีกองกอย', x: 76, z: -402, radius: 12, active: NIGHT, max: 4 },
  { id: 'takhian_tree', monster: 'นางตะเคียน', x: -70, z: -338, radius: 1, active: ALWAYS, max: 1, boss: true },

  // ---- ruen_ho เรือนหอร้าง (world boss, night only) ----
  { id: 'ruen_ho_bride', monster: 'ผีชุดแดง', x: 27, z: -2903, radius: 2, active: NIGHT, max: 1, boss: true },
  { id: 'ruen_ho_sister', monster: 'ผีชุดดำ', x: 29, z: -2897, radius: 2, active: NIGHT, max: 1, boss: true },

  // ---- wat_rang วัดร้าง ----
  // The overgrown woods around the ruins.
  { id: 'wat_grove', monster: 'ผีพราย · วิญญาณเร่ร่อน', x: 46, z: -480, radius: 16, active: ALWAYS, max: 4 },
  { id: 'abandoned_shrine', monster: 'วิญญาณเร่ร่อน', x: -36, z: -470, radius: 9, active: DUSK, max: 2 },
  // The road to the cemetery gate and the graves themselves (night only).
  { id: 'cemetery_path', monster: 'วิญญาณเร่ร่อน', x: 4, z: -492, radius: 11, active: DUSK, max: 3 },
  { id: 'cemetery_graves', monster: 'ผีตายโหง', x: 14, z: -548, radius: 10, active: NIGHT, max: 3 },
  { id: 'wat_courtyard', monster: 'ผีวัดร้าง', x: 68, z: -540, radius: 14, active: ALWAYS, max: 6 },   // the วัดร้าง yard (src/data/sites.js)
  { id: 'wat_ruins', monster: 'ผีหัวขาด · เปรตน้อย', x: -62, z: -522, radius: 14, active: ALWAYS, max: 4 },
  { id: 'wat_sky', monster: 'ผีกระหัง', x: 32, z: -500, radius: 10, active: NIGHT, max: 3 },
  { id: 'wat_ubosot', monster: 'ผีปู่โสม', x: 90, z: -540, radius: 2, active: ALWAYS, max: 1, boss: true },
  { id: 'wat_stupas', monster: 'กระสือ', x: 70, z: -562, radius: 3, active: NIGHT, max: 1, boss: true },

  // ---- klong คลองหนองบึง (Lv 10-25): leeches and water ghosts in the reed beds, crocodiles on
  // the klong banks, pythons in the reeds east of the hamlet; past the bridge ผีโพง by night,
  // ผีตายทั้งกลม near the banana grove, กุมภีล์ up the klong, ผีนางรำ in the far south. ----
  { id: 'leech_reeds', monster: 'ปลิงควาย', x: -78, z: -656, radius: 8, active: ALWAYS, max: 3 },
  { id: 'wraith_pool', monster: 'ผีพรายน้ำ', x: 74, z: -640, radius: 8, active: ALWAYS, max: 3 },
  { id: 'croc_bank', monster: 'จระเข้บึง', x: -62, z: -676, radius: 10, active: ALWAYS, max: 3 },
  { id: 'python_grass', monster: 'งูเหลือมดงอ้อ', x: 52, z: -666, radius: 10, active: ALWAYS, max: 3 },
  { id: 'phong_marsh', monster: 'ผีโพง', x: 62, z: -722, radius: 12, active: DUSK, max: 3 },
  { id: 'klom_reeds', monster: 'ผีตายทั้งกลม', x: -82, z: -716, radius: 10, active: ALWAYS, max: 3 },
  { id: 'kumphi_bank', monster: 'กุมภีล์', x: 96, z: -710, radius: 10, active: ALWAYS, max: 2 },
  { id: 'nangram_field', monster: 'ผีนางรำ', x: -20, z: -778, radius: 12, active: ALWAYS, max: 3 },
  { id: 'tani_grove', monster: 'นางตานี', x: -44, z: -742, radius: 1, active: NIGHT, max: 1, boss: true },
  { id: 'chalawan_lagoon', monster: 'ชาละวัน', x: 62, z: -774, radius: 2, active: ALWAYS, max: 1, boss: true },
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
    { type: 'phibpa', count: 2, active: NIGHT }, { type: 'pray', count: 3, active: NIGHT }, { type: 'kongkoi', count: 2, active: NIGHT },
  ],
  deep_forest: [
    { type: 'pray', count: 3, active: DAYLIGHT },
    { type: 'pray', count: 2, active: NIGHT }, { type: 'winyan', count: 3, active: NIGHT },
  ],
  deep_west: [
    { type: 'phibpa', count: 1, active: DAYLIGHT }, { type: 'pray', count: 2, active: DAYLIGHT },
    { type: 'pray', count: 2, active: NIGHT }, { type: 'winyan', count: 1, active: NIGHT },
    { type: 'tiger', count: 1, active: NIGHT, chance: .5, respawn: 300 },
  ],
  wat_grove: [
    { type: 'pray', count: 3, active: DAYLIGHT },
    { type: 'winyan', count: 3, active: NIGHT },
  ],
  abandoned_shrine: [{ type: 'winyan', count: 2 }],
  cemetery_path: [{ type: 'winyan', count: 3 }],
  cemetery_graves: [{ type: 'phitaihong', count: 2 }, { type: 'winyan', count: 1 }],
  wat_courtyard: [{ type: 'phitaihong', count: 2, active: DUSK }, { type: 'winyan', count: 2, active: DUSK }, { type: 'soldier', count: 2, active: ALWAYS }],
  // ---- the new ones ----
  rice_fowl: [{ type: 'fowl', count: 5 }],
  paddy_channels: [{ type: 'cobra', count: 3 }, { type: 'crab', count: 2 }],
  buffalo_meadow: [{ type: 'buffalo', count: 1, respawn: 240 }],
  dhole_trail: [{ type: 'dhole', count: 4 }],
  monitor_stream: [{ type: 'monitor', count: 3 }],
  wisp_hollow: [{ type: 'khamot', count: 2 }, { type: 'kongkoi', count: 2 }],
  takhian_tree: [{ type: 'takian', count: 1, respawn: 300 }],
  wat_ruins: [{ type: 'headless', count: 2, active: ALWAYS }, { type: 'pret', count: 2, active: NIGHT }],
  wat_sky: [{ type: 'krahang', count: 3 }],
  wat_ubosot: [{ type: 'pusom', count: 1, respawn: 600 }],
  wat_stupas: [{ type: 'krasue', count: 1, chance: .5, respawn: 600 }],
  // ---- คลองหนองบึง ----
  leech_reeds: [{ type: 'leech', count: 3 }],
  wraith_pool: [{ type: 'wraith', count: 3 }],
  croc_bank: [{ type: 'croc', count: 3 }],
  python_grass: [{ type: 'python', count: 3 }],
  phong_marsh: [{ type: 'phong', count: 3 }],
  klom_reeds: [{ type: 'klom', count: 2, active: DAYLIGHT }, { type: 'klom', count: 3, active: NIGHT }],
  kumphi_bank: [{ type: 'kumphi', count: 2 }],
  nangram_field: [{ type: 'nangram', count: 3 }],
  tani_grove: [{ type: 'tani', count: 1, respawn: 420 }],
  chalawan_lagoon: [{ type: 'chalawan', count: 1, respawn: 1200 }],
  // World boss: rises at nightfall, once a night (server/monsters.js); respawn is never reached.
  ruen_ho_bride: [{ type: 'ghost_red', count: 1, respawn: 1e9 }],
  ruen_ho_sister: [{ type: 'ghost_black', count: 1, respawn: 1e9 }],
};

// Combat zones: each area keeps its position, radius and phases; ROSTER entries may narrow the phases.
export function combatSpawns() {
  const zones = [];
  for (const area of SPAWNS) for (const entry of ROSTER[area.id] ?? []) {
    const def = MONSTERS[entry.type], count = entry.count ?? area.max;
    zones.push({ x: area.x, z: area.z, radius: area.radius, area: area.id, active: entry.active ?? area.active, ...entry,
      count: def?.elite || def?.boss ? count : Math.round(count * DENSITY) });
  }
  return zones;
}
for (const camp of HUNTING_GROUNDS) {
  if(!SPAWNS.some(s=>s.id===camp.id))SPAWNS.push({id:camp.id,monster:camp.roster.map(r=>MONSTERS[r.type].name).join(' · '),x:camp.x,z:camp.z,radius:camp.radius,active:ALWAYS,max:camp.roster.reduce((sum,r)=>sum+r.count,0)});
  ROSTER[camp.id]=camp.roster.map(r=>({respawn:24,...r}));
}

for(const e of EXPEDITIONS){
 const id=`boss_${e.id}`,type=`${e.id}_3`;
 SPAWNS.push({id,monster:MONSTERS[type].name,x:92,z:e.top-211,radius:6,active:ALWAYS,max:1,boss:true});
 ROSTER[id]=[{type,count:1,respawn:900}];
}
