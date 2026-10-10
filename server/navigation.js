import {readFileSync} from 'node:fs';
import {Collision} from '../src/world/Collision.js';
import {waterSurfaceFor,waterAllowsStanding} from '../src/world/water-navigation.js';
import {TerrainData} from '../src/world/Terrain.js';
import {MAPS,walkable} from '../src/world/maps.js';
const baked=JSON.parse(readFileSync(new URL('./data/collision.json',import.meta.url),'utf8'));
const worlds=new Map();
export function navigation(mapId){
  if(worlds.has(mapId))return worlds.get(mapId);
  const map=MAPS[mapId],data=baked.maps[mapId];if(!map||!data)throw Error('Unknown collision map');
  const collision=new Collision(8,map.view),terrain=new TerrainData(map.view),surface=waterSurfaceFor(map.view,!map.expedition);
  for(const s of data.shapes){if(s.t===0)collision.addCircle(s.x,s.z,s.r);else if(s.t===1)collision.addBox(s.x,s.z,s.hw*2,s.hd*2,Math.atan2(s.s,s.c));else collision.addSegment(s.x1,s.z1,s.x2,s.z2,s.r);}
  for(const d of data.decks)collision.addDeck(d.x,d.z,d.hw*2,d.hd*2,Math.atan2(d.s,d.c),d.h,d.ramps);
  const canStand=(x,z,pad=.28)=>Number.isFinite(x)&&Number.isFinite(z)&&walkable(map,x,z)&&!collision.blocked(x,z,pad)&&(collision.deckHeight(x,z)!==null||waterAllowsStanding(terrain,surface,x,z));
  const clear=(a,b,pad=.28)=>{if(![a?.x,a?.z,b?.x,b?.z,pad].every(Number.isFinite)||pad<0)return false;const distance=Math.hypot(b.x-a.x,b.z-a.z);if(distance>500)return false;const n=Math.max(1,Math.ceil(distance/.15));for(let i=1;i<=n;i++)if(!canStand(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,pad))return false;return true;};
  const result={canStand,clear};worlds.set(mapId,result);return result;
}
export const collisionSourceHash=baked.sourceHash;
