// Monster behaviours on the server (server/monsters.js) and a landed hit's side effects
// (src/combat/monsterHit.js, server/combatants.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonsterWorld, CHARGE, PULL_REACH } from '../server/monsters.js';
import { Combatants } from '../server/combatants.js';
import { Character } from '../src/character/Character.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { afterHit, shielded, shoveTo, KNOCK, PULL_TO } from '../src/combat/monsterHit.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';

const ALL = ['morning', 'day', 'evening', 'night'];
const world = (zones, random = () => .5) => {
  const w = new MonsterWorld('test', { zones: zones.map(z => ({ x: 0, z: 0, radius: 0, count: 1, active: ALL, ...z })), random });
  for (let t = 0; t < 3; t += .1) w.update(.1, [], 'day');
  return w;
};
const run = (w, secs, players, dt = .1) => { const ev = []; for (let t = 0; t < secs; t += dt) ev.push(...w.update(dt, players, 'day')); return ev; };
const hero = (classId = 'warrior') => ({ ...Character.create('ทดสอบ', classId).toJSON(), jobLevel: 50, skills: Object.fromEntries((KIT_SKILL_IDS[classId] ?? []).map(id => [id, 1])) });

test('every monster names a shape the view can build and fields the server knows', () => {
  for (const [id, m] of Object.entries(MONSTERS)) {
    assert.ok(['boar', 'tiger', 'buffalo', 'dog', 'lizard', 'monkey', 'spirit', 'krasue', 'bird', 'snake', 'crab', 'orb'].includes(m.shape), `${id}: ${m.shape}`);
    if (m.summon) assert.ok(MONSTERS[m.summon.type], `${id} summons ${m.summon.type}`);
  }
});

test('passive monsters do not start a fight; a bold ไก่ป่า charges any player near it', () => {
  const w = world([{ type: 'buffalo' }, { type: 'fowl', x: 40 }]), [buffalo, fowl] = w.monsters;
  const p = { id: 1, x: buffalo.x + 1, z: buffalo.z, lv: 1 };
  run(w, 2, [p]);
  assert.equal(buffalo.state, 'idle', 'a player standing next to it is left alone');
  w.damage(buffalo, 1, 5, {}, [p]);
  assert.equal(buffalo.state, 'chase', 'until it is hit');
  const q = { id: 2, x: fowl.x + 5, z: fowl.z, lv: 20 };
  run(w, .5, [q]);
  assert.equal(fowl.state, 'chase', 'even a far stronger player is charged');
  assert.equal(fowl.target, 2);
  const d0 = Math.hypot(fowl.x - q.x, fowl.z - q.z); run(w, .5, [q]);
  assert.ok(Math.hypot(fowl.x - q.x, fowl.z - q.z) < d0, 'it runs at the player, not away');
  assert.ok(!MONSTERS.fowl.flee && !MONSTERS.fowl.passive);
});

test('a pack answers a hit on one of its own; a wisp calls the spirits around it', () => {
  const w = world([{ type: 'dhole' }, { type: 'dhole', x: 5 }, { type: 'dhole', x: 30 }, { type: 'boar', x: 3 }]);
  const [a, b, far, boar] = w.monsters, p = { id: 1, x: -20, z: 0, lv: 30 };   // too strong to be noticed
  w.damage(a, 1, 5, {}, [p]);
  assert.deepEqual([a.state, b.state, far.state, boar.state], ['chase', 'chase', 'idle', 'idle']);
  const s = world([{ type: 'khamot' }, { type: 'pray', x: 6 }, { type: 'monkey', x: 4 }]);
  const [wisp, pray, monkey] = s.monsters;
  s.aggro(wisp, 1);
  assert.deepEqual([pray.state, pray.target, monkey.state], ['chase', 1, 'idle']);
});

test('the buffalo charges from a distance and hits harder', () => {
  const w = world([{ type: 'buffalo' }]), m = w.monsters[0], p = { id: 1, x: m.x + 8, z: m.z, lv: 4 };
  w.damage(m, 1, 5, {}, [p]);
  let ma = null;
  for (let t = 0; t < 3 && !ma; t += .05) ma = w.update(.05, [p], 'day').find(e => e.t === 'ma');
  assert.ok(ma, 'it reached the player');
  assert.ok(ma.power >= CHARGE.power, 'a charged blow');
  assert.ok(m.chargeCd > 0);
});

test('a rooted spirit never moves; it drags a far target in and gives up past its reach', () => {
  const w = world([{ type: 'takian' }]), m = w.monsters[0], home = { x: m.x, z: m.z }, p = { id: 1, x: m.x + 10, z: m.z, lv: 6 };
  w.damage(m, 1, 5, {}, [p]);
  const ev = run(w, 1, [p]);
  assert.ok(ev.some(e => e.t === 'ma' && e.pull), 'pulled');
  assert.deepEqual({ x: m.x, z: m.z }, home);
  const away = { ...p, x: m.x + PULL_REACH + 5 };
  run(w, 1, [away]);
  assert.notEqual(m.state, 'chase');
});

test('summoners call minions as their HP drops; they leave with it and never respawn', () => {
  const w = world([{ type: 'pusom' }]), boss = w.monsters[0], p = { id: 1, x: boss.x + 1, z: boss.z, lv: 10 };
  const ev = w.damage(boss, 1, boss.maxHp * .35, {}, [p]);
  assert.equal(ev.filter(e => e.t === 'mspawn').length, 2, 'two at 70%');
  assert.equal(w.monsters.length, 3);
  w.damage(boss, 1, boss.maxHp * .35, {}, [p]);
  assert.equal(w.monsters.length, 5, 'two more at 35%');
  const minion = w.monsters[1];
  assert.equal(minion.state, 'chase'); assert.equal(minion.target, 1);
  w.damage(minion, 1, 1e6, {}, [p]);
  const out = w.damage(boss, 1, 1e6, {}, [p]);
  assert.equal(out.filter(e => e.t === 'mgone' && !e.killed).length, 3, 'the rest go with it');
  run(w, 1, [p]);
  assert.equal(w.monsters.length, 1, 'only the boss is left to respawn');
});

test('landed hits poison (never below 1 HP) and drain MP; shields stop blows from the front', () => {
  const c = Character.create('ทดสอบ', 'shaman');
  afterHit(c, MONSTERS.cobra);
  assert.ok(c.buffs.some(b => b.id === 'poison'));
  c.hp = 5; for (let t = 0; t < 4; t += .1) c.tick(.1, true);
  assert.equal(c.hp, 1, 'poison never kills');
  const mp = c.mp; afterHit(c, MONSTERS.pret); assert.equal(c.mp, mp - MONSTERS.pret.mpDrain);
  const m = { x: 0, z: 0, f: 0 };   // facing +z
  assert.ok(shielded(m, { x: 0, z: 3 })); assert.ok(!shielded(m, { x: 0, z: -3 })); assert.ok(!shielded(m, { x: 3, z: 0 }));
  // server: a shield-bearer takes less from the front than from behind
  const cs = new Combatants({ now: () => 0, random: () => .5 });
  cs.load(1, hero('warrior'), { account: 'a', slot: 0 });
  const w = world([{ type: 'soldier' }]), s = w.monsters[0]; s.f = 0; s.maxHp = s.hp = 1e6;
  const front = cs.land(w, [{ id: 1, x: s.x, z: s.z + 1 }], s, 1, { hit: true, dmg: 100 }, false)[0].amount;
  s.f = 0;
  const back = cs.land(w, [{ id: 1, x: s.x, z: s.z - 1 }], s, 1, { hit: true, dmg: 100 }, false)[0].amount;
  assert.deepEqual([front, back], [60, 100]);
  // and a signed-in player's swing result carries the drain
  const r = cs.swing(1, { ...MONSTERS.pret, acc: 1e9 }, 1);
  assert.ok(r.mp !== undefined && !r.dodge);
});

test('knocks throw the player back, pulls drag them in; blocked ground shortens the move', () => {
  const m = { x: 0, z: 0 };
  assert.deepEqual(shoveTo(m, { x: 0, z: 2 }, { knock: true }), { x: 0, z: 2 + KNOCK });
  const pulled = shoveTo(m, { x: 0, z: 10 }, { pull: true }); assert.ok(Math.abs(pulled.z - PULL_TO) < 1e-9 && pulled.x === 0);
  assert.deepEqual(shoveTo(m, { x: 0, z: 2 }, { knock: true }, (x, z) => z < 3.5), { x: 0, z: 2 + KNOCK * .5 });
  assert.equal(shoveTo(m, { x: 0, z: 2 }, {}), null);
});
