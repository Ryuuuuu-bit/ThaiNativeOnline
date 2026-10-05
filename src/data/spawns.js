// Monster spawn areas by world-clock phase (the cemetery wakes at night).
// src/game/citySpawns.js decides which monsters live in each area.
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
