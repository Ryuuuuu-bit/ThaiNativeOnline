// Monster spawn areas by world-clock phase (the cemetery wakes at night).
// ROSTER picks which monsters (types from src/combat/data/monsters.js) live in
// each area; combatSpawns() turns both into zones for createGame({ spawns }).
export const SPAWNS = [
  { id: 'cemetery_ruin', monster: 'ปอบ', x: 0, z: -568, radius: 8, active: ['night'], max: 1, boss: true },
  { id: 'cemetery_stupas', monster: 'กระสือ', x: -15, z: -540, radius: 10, active: ['night'], max: 3 },
  { id: 'cemetery_markers', monster: 'ผีตายโหง', x: 16, z: -548, radius: 9, active: ['night'], max: 2 },
  { id: 'cemetery_path', monster: 'วิญญาณเร่ร่อน', x: 4, z: -492, radius: 14, active: ['evening', 'night'], max: 4 },
  { id: 'abandoned_shrine', monster: 'วิญญาณเร่ร่อน', x: -36, z: -478, radius: 10, active: ['night'], max: 2 },
  { id: 'deep_forest', monster: 'สัตว์ป่าดุร้าย', x: 40, z: -470, radius: 30, active: ['morning', 'day', 'evening', 'night'], max: 5 },
  { id: 'dense_forest', monster: 'สัตว์ป่า', x: -30, z: -380, radius: 30, active: ['morning', 'day', 'evening', 'night'], max: 4 },
];
export const activeSpawns = phase => SPAWNS.filter(s => s.active.includes(phase));

const DAYLIGHT = ['morning', 'day', 'evening'];
const ROSTER = {
  cemetery_ruin: [{ type: 'pop', count: 1, respawn: 180 }],
  cemetery_stupas: [{ type: 'krasue', count: 1, respawn: 120, chance: .5 }],
  cemetery_markers: [{ type: 'phitaihong' }],
  cemetery_path: [{ type: 'winyan' }],
  abandoned_shrine: [{ type: 'winyan' }],
  deep_forest: [
    { type: 'boar', count: 3, active: DAYLIGHT }, { type: 'monkey', count: 2, active: DAYLIGHT },
    { type: 'tiger', count: 1, respawn: 90, active: ['night'] }, { type: 'phibpa', count: 3, active: ['night'] },
  ],
  dense_forest: [
    { type: 'boar', count: 2, active: DAYLIGHT }, { type: 'monkey', count: 2, active: DAYLIGHT },
    { type: 'phibpa', count: 3, active: ['night'] }, { type: 'pray', count: 1, active: ['evening', 'night'] },
  ],
};
// Gentle zones at the forest mouth so a new character has something to fight before the deep woods.
const EXTRA = [
  { type: 'boar', x: -6, z: -335, radius: 14, count: 3, active: DAYLIGHT },
  { type: 'monkey', x: 22, z: -340, radius: 12, count: 2, active: DAYLIGHT },
  { type: 'phibpa', x: 0, z: -340, radius: 16, count: 3, active: ['night'] },
];

// Combat zones: each area keeps its position, radius and phases; ROSTER entries may narrow the phases.
export function combatSpawns() {
  const zones = [];
  for (const area of SPAWNS) for (const entry of ROSTER[area.id] ?? []) {
    zones.push({ x: area.x, z: area.z, radius: area.radius, area: area.id, active: entry.active ?? area.active, count: entry.count ?? area.max, ...entry });
  }
  return zones.concat(EXTRA);
}
