import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Combat } from '../src/combat/Combat.js';
import { ITEMS } from '../src/character/data/items.js';
import { RECOVERY } from '../src/character/data/progression.js';
import { moveSkillPlayer } from '../src/classes/fx/skillMovement.js';
import { readSession, writeSession } from '../src/account/session.js';

const hero = () => new Character({ name: 'test', classId: 'muaythai' });
test('material tenths fit exactly at capacity and refuse one extra', () => {
  const c = hero();
  const equippedWeight = c.weight; // Migrated characters now carry two starter flasks.
  for (const d of Object.values(ITEMS).filter(d => d.type === 'material')) assert.equal(d.weight, .1);
  assert.equal(c.addItem('hide', 3), true);
  assert.equal(c.weight, equippedWeight + .3);
  const room = c.carryRoom('hide');
  assert.equal(c.addItem('hide', room), true);
  assert.equal(c.weight, c.maxWeight);
  assert.equal(c.carryRoom('hide'), 0);
  assert.equal(c.addItem('hide', 1), false);
});
test('VIT improves automatic recovery but large stats obey hard caps; sitting adds nothing', () => {
  const low = hero(), high = hero();
  low.alloc.vit = 0; high.alloc.vit = 10000;
  for (const c of [low, high]) { c.hp = 1; c.mp = 0; }
  low.tick(1, false); high.tick(1, false);
  assert.ok(high.hp > low.hp); assert.ok(high.mp > low.mp);
  assert.equal(high.hp - 1, RECOVERY.hpCap); assert.equal(high.mp, RECOVERY.mpCap);
  high.sitting = true; const hp = high.hp, mp = high.mp; high.tick(1, false);
  assert.equal(high.hp - hp, RECOVERY.hpCap); assert.equal(high.mp - mp, RECOVERY.mpCap, 'no faster sitting: recovery is potions and healers');
});
test('recovery keeps subsecond time and combat heals less', () => {
  const a = hero(), b = hero(); a.hp = b.hp = 1; a.mp = b.mp = 0;
  a.tick(.6, false); a.tick(.6, false); a.tick(.8, false);
  b.tick(2, false);
  assert.equal(a.hp, b.hp); assert.equal(a.mp, b.mp);
  const c = hero(); c.hp = 1; c.mp = 0; c.tick(2, true);
  assert.ok(c.hp < b.hp); assert.ok(c.mp < b.mp);
});
test('basic attack refuses a remote target and times out an obstructed chase', () => {
  const c = hero(); let walks = 0, stops = 0;
  const cb = new Combat(c, {playerPos:()=>({x:0,z:0}),canStand:()=>true,moveTo:()=>{walks++;},stop:()=>{stops++;}});
  const target = {alive:true,x:100,z:0}; cb.setTarget(target);
  assert.equal(cb.useSkill(cb.basicSkillId()).ok, false); assert.equal(cb.pending, null);
  target.x = 3;
  assert.equal(cb.useSkill(cb.basicSkillId()).moving, true);
  cb.remote = true;
  for(let i=0;i<7;i++) cb.update(1);
  assert.equal(cb.pending,null);assert.equal(cb.autoAttack,false);assert.ok(walks<=6);assert.ok(stops>0);
});
test('skill sweeps cannot tunnel through a thin tree and can slide along an edge', () => {
  const p={x:0,z:0}; moveSkillPlayer(p,5,0,x=>x<1||x>1.5);
  assert.ok(p.x<1);
  const q={x:0,z:0}; moveSkillPlayer(q,2,2,x=>x<1);
  assert.ok(q.x<1);assert.ok(q.z>1.8);
  const r={x:0,z:0};moveSkillPlayer(r,3,4);assert.ok(Math.abs(r.x-3)<1e-8);assert.ok(Math.abs(r.z-4)<1e-8);
});
test('session persists in a new tab, migrates old tab data and clears both on logout', () => {
  const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
  const local=memory(),tab=memory(),session={id:'test',guest:false,token:'test-token',slot:0,prefix:'test/'};
  writeSession(session,local,tab);assert.deepEqual(readSession(local,memory()),session);
  writeSession(null,local,tab);assert.equal(readSession(local,tab),null);
  tab.setItem('tno.session.v1',JSON.stringify(session));assert.deepEqual(readSession(local,tab),session);
  assert.deepEqual(readSession(local,memory()),session);
});
