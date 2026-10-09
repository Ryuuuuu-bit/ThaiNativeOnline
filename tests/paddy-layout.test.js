import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigation} from '../server/navigation.js';
import {PADDY_BOSS_CLEARING,PADDY_TRAILS,paddyPlantAllowed,paddyGrass} from '../src/world/paddy-layout.js';

test('paddy boss has a clear, standable dodge area on the authoritative server',()=>{
  const nav=navigation('paddy'),c=PADDY_BOSS_CLEARING;
  // Spawn radius 10 plus 4 metres for the largest existing special attack.
  for(let dx=-14;dx<=14;dx++)for(let dz=-14;dz<=14;dz++)if(Math.hypot(dx,dz)<=14)
    assert.ok(nav.canStand(c.x+dx,c.z+dz,.4),`blocked dodge floor ${dx},${dz}`);
});

test('paddy art trails remain traversable rather than suggesting blocked routes',()=>{
  const nav=navigation('paddy');
  for(const p of PADDY_TRAILS)for(let i=1;i<p.points.length;i++){
    const [ax,az]=p.points[i-1],[bx,bz]=p.points[i];
    assert.ok(nav.clear({x:ax,z:az},{x:bx,z:bz},.4),`${p.id} segment ${i}`);
  }
});

test('paddy planting and grass rules do not affect the other map bands',()=>{
  for(const [x,z]of [[0,0],[62,-368],[48,-423],[72,-540],[50,-740]]){
    assert.equal(paddyPlantAllowed(x,z,'broadleaf'),true);
    assert.deepEqual(paddyGrass(x,z),{density:1,height:1});
  }
  assert.equal(paddyPlantAllowed(72,-252,'fruitTree'),false);
  assert.ok(paddyGrass(72,-252).height<.5);
});

test('map production manifest keeps the paddy set together and dhole in its forest habitat',()=>{
  const {maps}=JSON.parse(readFileSync(new URL('../tools/monster-models/meshy/map-queue.json',import.meta.url),'utf8'));
  const paddy=maps.find(m=>m.id==='paddy'),forest=maps.find(m=>m.id==='deep_forest');
  assert.deepEqual(new Set(paddy.creatures.map(c=>c.id)),new Set(['boar','fowl','cobra','crab','monkey','phibpa','buffalo']));
  assert.equal(paddy.primaryBoss,'buffalo');
  assert.equal(paddy.creatures.find(c=>c.id==='buffalo').level,4);
  assert.ok(forest.creatures.some(c=>c.id==='dhole'));
});
