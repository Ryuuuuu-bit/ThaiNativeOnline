// Regenerate the level-ordered production backlog from the active game roster.
import { MONSTERS } from '../../../src/combat/data/monsters.js';
import fs from 'node:fs/promises';
const candidates = new Set(['boar', 'fowl', 'crab', 'cobra', 'monkey', 'dhole', 'phibpa', 'buffalo', 'kongkoi', 'monitor', 'pray', 'khamot', 'winyan', 'takian', 'headless', 'pret', 'krahang', 'krasue', 'phitaihong', 'soldier', 'pusom']);
const reviewedWatRang = new Set(['headless', 'pret', 'krahang', 'krasue', 'phitaihong', 'soldier', 'pusom']);
const stages = [[1, 3], [4, 10], [11, 25], [26, 40], [41, 60], [61, 80], [81, 100]];
const roster = stages.map(([min, max]) => ({
  levels: [min, max],
  creatures: Object.entries(MONSTERS).filter(([, m]) => m.level >= min && m.level <= max)
    .sort(([a, x], [b, y]) => x.level - y.level || a.localeCompare(b))
    .map(([id, m]) => ({
      id, name: m.name, level: m.level,
      role: m.boss ? 'boss' : m.elite ? 'elite' : m.ranged ? 'ranged' : m.passive ? 'passive' : 'melee',
      status: candidates.has(id) ? reviewedWatRang.has(id) ? 'animated model integrated; review passed' : 'animated model integrated; ready for review' : 'planned',
      ...(candidates.has(id) ? { candidate: `${id}.glb`, runtime: `/models/monsters/${id}.glb` } : {}),
    })),
}));
await fs.writeFile(new URL('queue.json', import.meta.url), JSON.stringify(roster, null, 2) + '\n');
console.log(JSON.stringify({creatures: roster.reduce((n, s) => n + s.creatures.length, 0), generated: [...candidates], next: roster[0].creatures.filter(m => m.status === 'planned').map(m => m.id)}));
