// Monster spawn areas for นครอโยธยา. `type` is a monster from src/combat/data/monsters.js;
// `time` is the combat phase ('day' | 'night' | 'any'), `active` the world-clock
// phases shown in the developer overlay. Safe districts have no spawns: monsters
// live only in the forest and the cemetery, and grow stronger after dark.
export const SPAWNS = [
  // Day: wildlife at the forest edge and in the dense forest.
  { id: 'edge_boars', type: 'boar', label: 'หมูป่า', x: -30, z: -332, radius: 9, count: 4, time: 'day' },
  { id: 'edge_monkeys', type: 'monkey', label: 'ลิงกัง', x: 34, z: -342, radius: 9, count: 4, time: 'day' },
  { id: 'dense_boars', type: 'boar', label: 'หมูป่า', x: 42, z: -382, radius: 10, count: 3, time: 'day' },
  { id: 'dense_monkeys', type: 'monkey', label: 'ลิงกัง', x: -44, z: -425, radius: 10, count: 3, time: 'day' },
  // Night: the forest belongs to spirits.
  { id: 'edge_ghosts', type: 'phibpa', label: 'ผีป่า', x: -30, z: -332, radius: 9, count: 3, time: 'night' },
  { id: 'dense_ghosts', type: 'phibpa', label: 'ผีป่า', x: 34, z: -360, radius: 10, count: 3, time: 'night' },
  { id: 'stream_spirits', type: 'pray', label: 'ผีพราย', x: 30, z: -400, radius: 8, count: 3, time: 'night' },
  { id: 'deep_spirits', type: 'pray', label: 'ผีพราย', x: -40, z: -450, radius: 10, count: 2, time: 'any' },
  { id: 'shrine_spirits', type: 'phibpa', label: 'วิญญาณเร่ร่อน', x: -30, z: -486, radius: 7, count: 2, time: 'night' },
  { id: 'deep_tiger', type: 'tiger', label: 'เสือสมิง', x: 42, z: -470, radius: 4, count: 1, respawn: 60, time: 'night', boss: true },
  // The cemetery wakes at night; the krasue does not appear every night.
  { id: 'cemetery_path', type: 'phibpa', label: 'วิญญาณเร่ร่อน', x: 4, z: -494, radius: 8, count: 2, time: 'night' },
  { id: 'cemetery_markers', type: 'pray', label: 'ผีตายโหง', x: 16, z: -548, radius: 8, count: 3, time: 'night' },
  { id: 'cemetery_krasue', type: 'krasue', label: 'กระสือ', x: -15, z: -540, radius: 6, count: 1, respawn: 120, chance: .4, time: 'night', boss: true },
  // Reserved for a future boss (ปอบ) in the ruined ordination hall; not spawned yet.
  { id: 'cemetery_ruin', type: null, label: 'ปอบ (อนาคต)', x: 0, z: -568, radius: 8, count: 1, time: 'night', boss: true },
];
export const activeSpawns = phase => SPAWNS.filter(s => s.time === 'any' || (s.time === 'night') === (phase === 'night'));
export const combatSpawns = () => SPAWNS.filter(s => s.type);
