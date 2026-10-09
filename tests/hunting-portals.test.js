import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUNTING_GROUNDS, huntingFor, huntingSign } from '../src/data/hunting.js';
import { combatSpawns } from '../src/data/spawns.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { MAPS, mapOf } from '../src/world/maps.js';
import { portalPillars } from '../src/world/portal-layout.js';
import { navigation } from '../server/navigation.js';
import { findPath } from '../src/core/GridPath.js';

test('all 136 hunting pockets share ordinary monster rosters and valid level signs',()=>{
  assert.equal(HUNTING_GROUNDS.length,136);assert.equal(huntingFor('city').length,0);
  const ids=new Set();let slots=0;
  for(const c of HUNTING_GROUNDS){
    assert.ok(!ids.has(c.id));ids.add(c.id);assert.equal(mapOf(c.x,c.z),c.map);
    const zones=combatSpawns().filter(z=>z.area===c.id);assert.equal(zones.length,c.roster.length);
    for(const z of zones){const m=MONSTERS[z.type];assert.ok(!m.boss&&!m.elite);assert.ok(m.level>=c.levels[0]&&m.level<=c.levels[1]);assert.equal(z.respawn,24);slots+=z.count;}
    assert.ok(zones.some(z=>z.active.includes('night')),c.id+' night option');
  }
  assert.equal(slots,HUNTING_GROUNDS.reduce((n,c)=>n+c.roster.reduce((n,r)=>n+r.count*2,0),0));
});
test('camp signs are reachable from map spawn and their posts block movement',()=>{
  for(const c of HUNTING_GROUNDS){
    const nav=navigation(c.map),sign=huntingSign(c);
    assert.ok(nav.canStand(c.approach.x,c.approach.z),c.id+' approach');
    assert.ok(!nav.canStand(sign.x,sign.z),c.id+' sign collision');
    assert.ok(findPath(nav.canStand,MAPS[c.map].spawn,c.approach,{step:1,margin:35}),c.id+' route');
  }
});
test('all 25 portal centres stay clear while their pillars block movement',()=>{
  let count=0;
  for(const map of Object.values(MAPS))for(const p of map.portals){
    const nav=navigation(map.id);count++;
    assert.ok(nav.canStand(p.at.x,p.at.z),p.id+' open centre');
    for(const pillar of portalPillars(map,p))assert.ok(!nav.canStand(pillar.x,pillar.z),p.id+' solid pillar');
    assert.ok(findPath(nav.canStand,map.spawn,p.at,{step:1,margin:35}),map.id+':'+p.id+' route');
  }
  assert.equal(count,25);   // 24 + the way out of the world boss room (ruen_ho: in through the news banner)
});
import { MonsterWorld } from '../server/monsters.js';
import { createRng } from '../src/world/rng.js';

test('server spawns every hunting pocket on walkable ground during day and night',()=>{
  for(const phase of ['day','night'])for(const map of Object.values(MAPS).filter(m=>!m.safe)){
    const zones=combatSpawns().filter(z=>HUNTING_GROUNDS.some(c=>c.id===z.area&&c.map===map.id));
    const nav=navigation(map.id),world=new MonsterWorld(map.id,{zones,navigation:nav,random:createRng(710)});
    world.update(3,[],phase);
    for(const c of huntingFor(map.id)){
      const live=world.monsters.filter(m=>m.spawn.area===c.id&&m.alive);
      const expected=zones.filter(z=>z.area===c.id&&z.active.includes(phase)).reduce((n,z)=>n+z.count,0);
      assert.equal(live.length,expected,c.id+' '+phase);
      for(const m of live)assert.ok(nav.canStand(m.x,m.z),c.id+' valid server spawn');
    }
  }
});
