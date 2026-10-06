import { NPCS } from '../data/npcs.js';
import { makeLook } from './NPCData.js';
import { PARTS } from './NPCRenderer.js';
const looks = NPCS.map(makeLook); const npcs = NPCS.map(d => ({ def: d, look: makeLook(d) }));
const rows = [];
for (const def of PARTS) { const n = npcs.filter(o => (!def.when || def.when(o.look)) && (!def.whenNpc || def.whenNpc(o))).length * def.frames.length; if (!n) continue; const g = def.geo(); const t = (g.index ? g.index.count : g.attributes.position.count) / 3; rows.push([def.name, t, n, t * n]); }
rows.sort((a, b) => b[3] - a[3]); for (const r of rows) console.log(r.join('\t'));

console.log('meshes', rows.length, 'total', rows.reduce((a, r) => a + r[3], 0), 'per npc', Math.round(rows.reduce((a, r) => a + r[3], 0) / npcs.length));
