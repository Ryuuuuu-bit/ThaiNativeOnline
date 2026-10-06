import { NPCS } from '../data/npcs.js';
import { makeLook } from './NPCData.js';
const mod = await import(process.argv[2]);
const looks = NPCS.map(makeLook);
let total = 0, meshes = 0;
for (const def of mod.PARTS) {
  const n = looks.filter(l => !def.when || def.when(l)).length * def.frames.length; if (!n) continue;
  const g = def.geo(); const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  total += tris * n; meshes++;
}
console.log('npcs', looks.length, 'meshes', meshes, 'triangles', total, 'per npc', Math.round(total / looks.length));
