import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { CLASSES, WEAPON_KINDS } from '../src/character/data/classes.js';
import { ITEMS } from '../src/character/data/items.js';
import { Combat } from '../src/combat/Combat.js';
import { SKILLS } from '../src/combat/data/skills.js';
import { RULES } from '../src/combat/data/rules.js';
import { Combatants } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { EXPEDITIONS } from '../src/world/expeditions.js';

const zone = type => ({ type, x: 0, z: 0, radius: 0, count: 1, active: ['morning', 'day', 'evening', 'night'] });
function spawn(type, random = () => .9) {
  const world = new MonsterWorld('test', { zones: [zone(type)], random });
  for (let i = 0; i < 30; i++) world.update(.1, [], 'day');
  assert.ok(world.monsters[0].hp > 0);
  return world;
}

test('all six classes at early/mid/end levels share the new basic damage between browser and server', t => {
  t.mock.method(Math, 'random', () => .9);
  for (const cls of Object.keys(CLASSES)) for (const level of [1, 60, 100]) {
    const cs = new Combatants({ random: () => .9 });
    cs.load(1, { ...Character.create('Damage', cls).toJSON(), level }, { account: cls, slot: 0 });
    const c = cs.get(1).c, world = spawn('boar'), m = world.monsters[0];
    m.hp = m.maxHp = 1e7;
    const p = { id: 1, x: 0, z: 0, lv: level };
    const local = new Combat(c, { playerPos: () => p, canStand: () => true });
    const basic = SKILLS[c.cls.skills.find(id => SKILLS[id]?.basic)];
    const result = cs.blow(1, world, [p], { id: m.id, skill: 'basic' }).find(e => e.t === 'mh');
    assert.ok(result && !result.miss, `${cls}/${level}`);
    assert.equal(result.amount, local.rollPlayerDamage(basic, m).dmg, `${cls}/${level}: exactly one shared boost`);
    const power = basic.scale === 'int' ? c.matk : c.patk;
    const armor = m.def.def * (basic.scale === 'int' ? .25 : .5);
    assert.equal(result.amount, Math.round(Math.max(1, power * basic.power * 1.08 - armor) * 1.2));
  }
});

test('server hunter pet bites receive one damage increase while monster swings stay unchanged', () => {
  const cs = new Combatants({ random: () => .9 });
  cs.load(1, { ...Character.create('Pet', 'hunter').toJSON(), level: 60 }, { account: 'pet', slot: 0 });
  const c = cs.get(1).c, world = spawn('boar'), m = world.monsters[0], p = { id: 1, x: 0, z: 0, lv: 60 };
  m.hp = m.maxHp = 1e7;
  const result = cs.blow(1, world, [p], { id: m.id, skill: 'pet' }).find(e => e.t === 'mh');
  assert.equal(result.amount, Math.round(Math.max(1, c.patk * RULES.petBite * 1.08 - m.def.def * .5) * 1.2));
  const monster = { level: 60, atk: 100, acc: 999 }, before = c.hp;
  const hit = cs.swing(1, monster);
  assert.equal(hit.dmg, Math.round(Math.max(1, monster.atk * 1.12 - c.defense * .4)));
  assert.equal(c.hp, before - hit.dmg);
});

test('legacy venom inherits the boosted landed hit once, with equal offline and server poison ticks', t => {
  t.mock.method(Math, 'random', () => .9);
  const cs = new Combatants({ random: () => .9 });
  cs.load(1, { ...Character.create('Venom', 'assassin').toJSON(), level: 60 }, { account: 'venom', slot: 0 });
  const c = cs.get(1).c, p = { id: 1, x: 0, z: 0, lv: 60 }, world = spawn('boar'), serverMonster = world.monsters[0];
  serverMonster.hp = serverMonster.maxHp = 1e7;
  const local = new Combat(c, { playerPos: () => p, canStand: () => true }, [zone('boar')]);
  const monster = local.monsters[0];
  monster.hp = monster.maxHp = 1e7; monster.state = 'idle';
  const localHits = [];
  local.on('hit', e => localHits.push(e));
  assert.equal(cs.cast(1, 'venom').ok, true);
  const hit = cs.blow(1, world, [p], { id: serverMonster.id, skill: 'venom' }).find(e => e.t === 'mh');
  local.hitMonster(monster, SKILLS.venom);
  assert.equal(localHits[0].amount, hit.amount);
  assert.equal(monster.debuffs[0].source, hit.amount);
  assert.equal(serverMonster.debuffs[0].source, hit.amount);
  local.updateMonster(monster, 1, p);
  const tick = world.update(1, [p], 'day').find(e => e.t === 'mh' && e.dot);
  const expected = Math.max(1, Math.round(hit.amount * SKILLS.venom.debuff.dot));
  assert.equal(tick.amount, expected);
  assert.equal(localHits.find(e => e.dot).amount, expected);
});

test('the raised expedition drop threshold delivers usable gear for every class only to its loot owner', () => {
  // 1.9% would fail the old 0.6% hunt chance but succeeds under the new 2% table.
  for (const expedition of EXPEDITIONS) for (const cls of Object.keys(CLASSES)) {
    const world = spawn(`${expedition.id}_0`, () => .019), m = world.monsters[0];
    const level = expedition.levels[0], players = [{ id: 1, x: 0, z: 0, lv: level }, { id: 2, x: 0, z: 0, lv: level }];
    world.damage(m, 2, Math.round(m.hp * .2), {}, players, false);
    const events = world.damage(m, 1, m.hp, {}, players, false).filter(e => e.t === 'kill');
    const owned = events.find(e => e.to === 1), helper = events.find(e => e.to === 2);
    assert.ok(owned && helper); assert.deepEqual(helper.drops, []); assert.equal(helper.gold, 0);
    const gear = owned.drops.filter(d => ITEMS[d.id]?.type === 'equip');
    assert.equal(gear.length, 8, `${expedition.id}/${cls}: all six weapon and two shared gear rolls`);
    const weapon = gear.find(d => WEAPON_KINDS[cls].includes(ITEMS[d.id].weapon)); assert.ok(weapon);
    assert.equal(weapon.qty, 1);
    const cs = new Combatants();
    cs.load(1, { ...Character.create('Loot', cls).toJSON(), level }, { account: cls, slot: 0 });
    assert.deepEqual(cs.reward(1, owned).lost ?? [], []);
    const c = cs.get(1).c, index = c.inventory.findIndex(item => item?.id === weapon.id);
    assert.ok(index >= 0 && c.equip(index), `${cls}: its earned weapon can be equipped at the tier level`);
    assert.equal(c.equipment.weapon, weapon.id);
  }
});
