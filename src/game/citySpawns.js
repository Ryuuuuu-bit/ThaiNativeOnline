// Turns the city's declared spawn areas (data/spawns.js) into combat spawn
// zones. Areas keep their position, radius and phases; this file only picks
// which monsters live there. Wildlife hunts by day, spirits rise at night.
import { SPAWNS as AREAS } from '../data/spawns.js';

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

// Gentle zone at the forest mouth so a new character has something to fight
// before the deep woods.
const EXTRA = [
  { type: 'boar', x: -6, z: -335, radius: 14, count: 3, active: DAYLIGHT },
  { type: 'monkey', x: 22, z: -340, radius: 12, count: 2, active: DAYLIGHT },
  { type: 'phibpa', x: 0, z: -340, radius: 16, count: 3, active: ['night'] },
];

export function citySpawns() {
  const zones = [];
  for (const area of AREAS) {
    for (const entry of ROSTER[area.id] || []) {
      zones.push({
        x: area.x, z: area.z, radius: area.radius, area: area.id,
        active: entry.active || area.active,
        count: entry.count ?? area.max,
        ...entry,
      });
    }
  }
  return zones.concat(EXTRA);
}
