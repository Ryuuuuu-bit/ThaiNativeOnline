import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { adminIds, runGm, GM_PREFIX, gm, parseGm, GM_COMMANDS } from '../server/gm.js';

const hero = () => Character.create('ทดสอบ', 'muaythai', 'male');

test('admin ids come from ADMIN_IDS and GM_ID', () => {
  assert.deepEqual([...adminIds({ ADMIN_IDS: ' A, b ', GM_ID: 'gm_admin' })].sort(), ['a', 'b', 'gm_admin']);
  assert.equal(adminIds({}).size, 0);
});

test('GM prefix only matches /gm', () => {
  assert.ok(GM_PREFIX.test('/gm gold') && GM_PREFIX.test('/GM'));
  assert.ok(!GM_PREFIX.test('/gmx') && !GM_PREFIX.test('hi /gm'));
});

test('gold, level, item, say', () => {
  const c = hero(), g = c.gold;
  assert.equal(runGm(c, '/gm gold 500').ok, true); assert.equal(c.gold, g + 500);
  const p = c.points, r = runGm(c, '/gm level 10');
  assert.equal(c.level, 10); assert.equal(r.level, 10); assert.equal(c.points, p + 9 * POINTS_PER_LEVEL);
  assert.equal(runGm(c, '/gm item potion_s 3').ok, true); assert.ok(c.count('potion_s') >= 3);
  assert.equal(runGm(c, '/gm item nope').ok, false);
  assert.equal(runGm(c, '/gm say สวัสดี ทุกคน').say, 'สวัสดี ทุกคน');
  assert.match(runGm(c, '/gm').msg, /\/gm gold/);
});

test('direct GM handler denies guests, forged flags and unavailable authority before touching game state', async () => {
  const denied = /สำหรับ GM เท่านั้น/;
  for (const me of [null, {id:1,admin:true}, {id:1,admin:true,account:'root'}]) {
    assert.match(await gm({}, me, '/gm gold 999'), denied);
    assert.match(await gm({isAdmin:async()=>false}, me, '/gm help'), denied);
  }
  const me={id:1,admin:true,account:'root'};
  assert.match(await gm({isAdmin:async()=>true,byId:()=>({p:me}),combatants:{get:()=>({})}},me,'/gm gold 999'),denied);
  assert.match(await gm({isAdmin:async()=>true,byId:()=>({p:{...me}})},me,'/gm help'),denied);
});

test('one catalog and parser normalize namespace and aliases without accepting lookalike commands', () => {
  assert.deepEqual(parseGm('  /GM LEVEL 8'), {cmd:'lv',args:['8']});
  assert.deepEqual(parseGm('/gm POINTS 3'), {cmd:'stat',args:['3']});
  assert.deepEqual(parseGm('/gm'), {cmd:'help',args:[]});
  assert.equal(parseGm('/gmx gold 100'),null);
  assert.equal(new Set(GM_COMMANDS.map(c=>c.id)).size,GM_COMMANDS.length);
  const c=hero();assert.equal(runGm(c,'/GM POINTS 3').ok,true);
});
test('a transfer started during async authorization blocks GM character mutation',async()=>{
  for(const field of ['stashBusy','tradeBusy']) {
    let resolve;const authorization=new Promise(r=>resolve=r);
    const me={id:1,account:'root'},state={persist:{account:'root'},c:hero()};
    const pending=gm({isAdmin:()=>authorization,byId:()=>({p:me}),combatants:{get:()=>state}},me,'/gm gold 500');
    state[field]=true;resolve(true);
    assert.match(await pending,/กำลังจัดการ/);assert.equal(state.c.gold,20);
  }
});
