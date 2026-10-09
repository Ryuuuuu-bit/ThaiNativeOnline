// Rebuild the map-by-map art manifest from runtime membership, never the level
// queue alone: shared creatures can inhabit several maps (dhole is forest-only).
import {readFileSync,writeFileSync} from 'node:fs';
import {MAPS,mapOf} from '../../../src/world/maps.js';
import {combatSpawns} from '../../../src/data/spawns.js';
import {MONSTERS} from '../../../src/combat/data/monsters.js';
import {MAP_BOSSES} from '../../../src/combat/data/boss-skills.js';
const queue=JSON.parse(readFileSync(new URL('./queue.json',import.meta.url),'utf8'));
const status=new Map(queue.flatMap(b=>b.creatures).map(c=>[c.id,c.status]));
const zones=combatSpawns();
const maps=Object.values(MAPS).filter(m=>!m.safe).map(m=>{
 const members=zones.filter(z=>mapOf(z.x,z.z)===m.id);
 const ids=[...new Set(members.map(z=>z.type))].sort((a,b)=>MONSTERS[a].level-MONSTERS[b].level||a.localeCompare(b));
 return {id:m.id,name:m.name,levels:m.levels,primaryBoss:MAP_BOSSES[m.id],
  stage:m.id==='paddy'?(ids.every(id=>status.get(id)?.startsWith('animated model integrated'))?'environment pass 1; monster set complete':'environment pass 1; boss model pending'):['deep_forest','wat_rang'].includes(m.id)&&ids.every(id=>status.get(id)?.startsWith('animated model integrated'))?'monster set complete; environment art pass queued':'queued',
  creatures:ids.map(id=>({id,name:MONSTERS[id].name,level:MONSTERS[id].level,primaryBoss:id===MAP_BOSSES[m.id],status:status.get(id)??'planned',areas:[...new Set(members.filter(z=>z.type===id).map(z=>z.area))]}))};
});
writeFileSync(new URL('./map-queue.json',import.meta.url),JSON.stringify({workflow:'Complete one map set: environment, existing monster roster, boss, portals, anatomy/animation review, gameplay camera QA, PR.',maps},null,2)+'\n');
console.log(maps.map(m=>`${m.id}: ${m.creatures.length} identities / boss ${m.primaryBoss}`).join('\n'));
