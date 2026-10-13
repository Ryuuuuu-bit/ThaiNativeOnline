// Farming flow (server/monsters.js, src/data/spawns.js): monsters come back quickly, faster in a
// zone someone is hunting, never on top of a player; ranged ordinary monsters hit softer, fall
// sooner and step back from a player in their face (RULES.rangedMonster).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonsterWorld } from '../server/monsters.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { RULES } from '../src/combat/data/rules.js';
import { combatSpawns } from '../src/data/spawns.js';
import { HUNTING_GROUNDS } from '../src/data/hunting.js';

const ALL = ['morning', 'day', 'evening', 'night'];
const zone = (o = {}) => ({ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ALL, ...o });
const run = (w, players, secs) => { const ev = []; for (let t = 0; t < secs; t += .1) ev.push(...w.update(.1, players, 'day')); return ev; };
const kill = (w, m, players) => w.damage(m, 1, m.hp + 10, {}, players);
const riseTime = (w, players) => { let t = 0; while (w.monsters[0].hp <= 0 && t < 60) { w.update(.1, players, 'day'); t += .1; } return t; };

test('respawn: five seconds by default, the farming pockets eight, elites keep their own', () => {
  assert.equal(RULES.monsterRespawn, 5);
  const zones = combatSpawns();
  for (const camp of HUNTING_GROUNDS) {
    for (const z of zones.filter(z => z.area === camp.id)) if (!MONSTERS[z.type].elite && !MONSTERS[z.type].boss) assert.ok(z.respawn <= RULES.campRespawn, `${camp.id} ${z.type}`);
  }
  assert.ok(zones.find(z => z.type === 'buffalo').respawn >= 200, 'elites stay rare');
});

test('a zone someone hunts in refills faster than an empty one', () => {
  const far = { id: 1, x: 200, z: 0, lv: 1 }, near = { id: 1, x: 6, z: 0, lv: 1 };
  const timeWith = player => {
    const w = new MonsterWorld('test', { zones: [zone({ radius: 4 })], random: () => .5 });
    run(w, [player], 3); kill(w, w.monsters[0], [player]);
    return riseTime(w, [player]);
  };
  const empty = timeWith(far), busy = timeWith(near);
  assert.ok(Math.abs(empty - RULES.monsterRespawn) < .25, `empty ${empty}`);
  assert.ok(Math.abs(busy - RULES.monsterRespawn / RULES.busyRespawn) < .25, `busy ${busy}`);
});

test('a monster never rises on top of a player when the zone has room', () => {
  let i = 0; const rolls = [0, 0, .02, .05, .5, .9, .3, .99, .7, .6];   // the first tries land in the middle
  for (let k = 0; k < 20; k++) {
    const w = new MonsterWorld('test', { zones: [zone({ radius: 14 })], random: () => rolls[i++ % rolls.length] });
    const player = { id: 1, x: 0, z: 0, lv: 99 };
    run(w, [player], 3);
    const m = w.monsters[0];
    assert.ok(m.hp > 0 && Math.hypot(m.x, m.z) >= RULES.respawnClear - 1e-6, `rose ${Math.hypot(m.x, m.z).toFixed(2)} m away`);
  }
});

test('ranged ordinary monsters hit softer and fall sooner; elites, bosses and high content keep their numbers', () => {
  for (const [id, def] of Object.entries(MONSTERS)) {
    if (def.ranged && !def.elite && !def.boss && def.level <= 20) {
      assert.equal(def.atk, Math.round(def.listedAtk * RULES.rangedMonster.atk), id);
      assert.equal(def.hp, Math.round(def.listedHp * RULES.rangedMonster.hp), id);
    } else assert.equal(def.listedAtk, undefined, id);
  }
  assert.ok(MONSTERS.cobra.atk < MONSTERS.cobra.listedAtk && MONSTERS.khamot.hp < MONSTERS.khamot.listedHp);
});

test('a ranged monster steps back from a player in its face between shots', () => {
  const w = new MonsterWorld('test', { zones: [zone({ type: 'khamot' })], random: () => .5 });
  const p = { id: 1, x: 3, z: 0, lv: 1 };
  run(w, [p], 3);
  const m = w.monsters[0];
  run(w, [p], 2);
  assert.equal(m.state, 'chase');
  p.x = m.x + .8; p.z = m.z;   // the player closes in
  const before = Math.hypot(p.x - m.x, p.z - m.z);
  run(w, [p], 1.2);
  assert.ok(Math.hypot(p.x - m.x, p.z - m.z) > before + .3, 'backed off');
  // a melee monster stays in the player's face
  const w2 = new MonsterWorld('test', { zones: [zone()], random: () => .5 }), p2 = { id: 1, x: 3, z: 0, lv: 1 };
  run(w2, [p2], 5);
  assert.ok(Math.hypot(p2.x - w2.monsters[0].x, p2.z - w2.monsters[0].z) <= MONSTERS.boar.range + .1);
});
