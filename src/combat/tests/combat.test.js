// Run: node --test src/combat/tests/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDamage, clamp, spend, restore } from '../logic/math.js';
import { createCooldownTracker } from '../logic/cooldowns.js';
import { createEnemyState, stepEnemy, killEnemy } from '../logic/ai.js';
import { createCombatCore, findStandable } from '../logic/core.js';
import { abilities } from '../data/abilities.js';
import { enemyDefs } from '../data/enemies.js';
import { spawns, PLAYER_START } from '../data/spawns.js';

const fixed = v => () => v;
const open = () => true;

test('damage formula: attack*mult - defense, variance, min 1, crit', () => {
  assert.deepEqual(computeDamage({ attack: 20, multiplier: 1, defense: 5, rng: fixed(0.5) }), { amount: 15, crit: false });
  // rng 1 → +10% variance
  assert.equal(computeDamage({ attack: 20, defense: 0, rng: fixed(1) }).amount, 22);
  assert.equal(computeDamage({ attack: 20, defense: 0, rng: fixed(0) }).amount, 18);
  assert.equal(computeDamage({ attack: 3, defense: 50, rng: fixed(0.5) }).amount, 1);
  const crit = computeDamage({ attack: 20, defense: 0, critChance: 0.5, rng: fixed(0.1) });
  assert.equal(crit.crit, true);
});

test('clamping helpers', () => {
  assert.equal(clamp(5, 0, 3), 3);
  const pool = { hp: 10, maxHp: 20 };
  assert.equal(spend(pool, 'hp', 'maxHp', 15), 10);
  assert.equal(pool.hp, 0);
  assert.equal(restore(pool, 'hp', 'maxHp', 50), 20);
  assert.equal(pool.hp, 20);
});

test('cooldown tracker', () => {
  const cd = createCooldownTracker();
  cd.start('a', 2);
  assert.equal(cd.ready('a'), false);
  cd.tick(1);
  assert.equal(cd.remaining('a'), 1);
  assert.equal(cd.fraction('a'), 0.5);
  cd.tick(1.01);
  assert.equal(cd.ready('a'), true);
  assert.equal(cd.ready('unknown'), true);
});

test('data integrity', () => {
  assert.equal(abilities.length, 4);
  abilities.forEach((a, i) => assert.equal(a.slot, i));
  for (const s of spawns) {
    assert.ok(enemyDefs[s.enemy], s.enemy);
    assert.ok(Math.abs(s.x) < 25 && Math.abs(s.z) < 25 && s.x < 12.5);
    assert.ok(Math.hypot(s.x - PLAYER_START.x, s.z - PLAYER_START.z) > 6);
  }
});

test('AI: aggressive enemy chases, attacks, leashes and returns', () => {
  const def = enemyDefs['phi-pa'];
  const e = createEnemyState(def, { x: 0, z: 0 }, fixed(0.5));
  const player = { x: 4, z: 0, dead: false };
  stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.equal(e.state, 'chase');
  for (let i = 0; i < 40 && e.state !== 'attack'; i++) stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.equal(e.state, 'attack');
  let attacks = 0;
  for (let i = 0; i < 30; i++) attacks += stepEnemy(e, { dt: 0.1, player, canStand: open }).filter(ev => ev.type === 'attack').length;
  assert.ok(attacks >= 1);
  // Player runs far away → leash.
  player.x = 40;
  for (let i = 0; i < 200 && e.state !== 'return'; i++) stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.equal(e.state, 'return');
  for (let i = 0; i < 200 && e.state !== 'idle'; i++) stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.equal(e.state, 'idle');
  assert.ok(Math.hypot(e.x, e.z) < 0.25);
  assert.equal(e.hp, e.maxHp);
});

test('AI: passive enemy ignores player until provoked', () => {
  const e = createEnemyState(enemyDefs['ling-pa'], { x: 0, z: 0 }, fixed(0.5));
  const player = { x: 1, z: 0, dead: false };
  stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.notEqual(e.state, 'chase');
  e.provoked = true;
  stepEnemy(e, { dt: 0.1, player, canStand: open });
  assert.ok(['chase', 'attack'].includes(e.state));
});

test('AI: blocked movement uses canStand; dead enemies respawn', () => {
  const e = createEnemyState(enemyDefs['phi-pa'], { x: 0, z: 0 }, fixed(0.5));
  const wall = (x) => x < 0.5;
  for (let i = 0; i < 50; i++) stepEnemy(e, { dt: 0.1, player: { x: 3, z: 0, dead: false }, canStand: wall });
  assert.ok(e.x < 0.5);
  killEnemy(e);
  assert.equal(e.state, 'dead');
  let respawned = false;
  for (let t = 0; t < e.def.respawnTime + 1; t += 0.5)
    if (stepEnemy(e, { dt: 0.5, player: { x: 9, z: 9, dead: false }, canStand: open }).some(ev => ev.type === 'respawn')) respawned = true;
  assert.ok(respawned);
  assert.equal(e.hp, e.maxHp);
});

test('findStandable nudges blocked spawns', () => {
  const p = findStandable(0, 0, (x) => x > 1.2);
  assert.ok(p && p.x > 1.2);
});

function makeCore(extra = {}) {
  const pos = { x: 0, z: 0 };
  const events = [];
  const core = createCombatCore({
    getPlayerPosition: () => pos,
    setPlayerPosition: (x, z) => { pos.x = x; pos.z = z; },
    spawns: [{ enemy: 'ling-pa', x: 1.5, z: 0 }, { enemy: 'phi-pa', x: 8, z: 8 }],
    rng: fixed(0.5),
    ...extra,
  });
  for (const ev of ['damage', 'death', 'targetChanged', 'playerChanged', 'respawn', 'heal', 'ability'])
    core.on(ev, payload => events.push([ev, payload]));
  return { core, pos, events };
}

test('core: useAbility auto-targets, damages, cooldowns, mp', () => {
  const { core, events } = makeCore();
  const r = core.useAbility(0);
  assert.equal(r.ok, true);
  assert.equal(core.getTarget(), core.enemies[0]);
  assert.ok(core.enemies[0].hp < core.enemies[0].maxHp);
  assert.ok(events.some(([n]) => n === 'damage'));
  assert.equal(core.useAbility(0).reason, 'cooldown');
  core.update(1);
  const mp = core.playerState.mp;
  assert.equal(core.useAbility(1).ok, true);
  assert.equal(core.playerState.mp, mp - abilities[1].mpCost);
  assert.equal(core.useAbility(9).ok, false);
});

test('core: no target in range; heal at full hp refused', () => {
  const { core, pos } = makeCore();
  pos.x = -10;
  assert.equal(core.useAbility(0).reason, 'no_target');
  assert.equal(core.useAbility(3).reason, 'full_hp');
});

test('core: kill enemy grants exp and clears target; cycleTarget', () => {
  const { core, events } = makeCore();
  const monkey = core.enemies[0];
  monkey.hp = 1;
  core.useAbility(0);
  assert.equal(monkey.alive, false);
  assert.equal(core.getTarget(), null);
  assert.ok(core.playerState.exp > 0);
  assert.ok(events.some(([n, p]) => n === 'death' && p.who === 'enemy'));
  assert.equal(core.cycleTarget(), core.enemies[1]);
});

test('core: player death and respawn at start with full hp', () => {
  const { core, pos, events } = makeCore({ spawns: [{ enemy: 'suea-saming', x: 1, z: 0 }] });
  core.playerState.hp = 1;
  for (let i = 0; i < 40 && !core.playerState.dead; i++) core.update(0.1);
  assert.equal(core.playerState.dead, true);
  assert.equal(core.useAbility(0).reason, 'dead');
  for (let i = 0; i < 80 && core.playerState.dead; i++) core.update(0.1);
  assert.equal(core.playerState.dead, false);
  assert.equal(core.playerState.hp, core.playerState.maxHp);
  assert.deepEqual([pos.x, pos.z], [PLAYER_START.x, PLAYER_START.z]);
  assert.ok(events.some(([n, p]) => n === 'respawn' && p.who === 'player'));
});
