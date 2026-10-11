import test from 'node:test';
import assert from 'node:assert/strict';
import { Combatants, KITS } from '../server/combatants.js';
import { HIT_TIME_SLACK, hitDue, consumeHit } from '../server/skill-hit-timing.js';
import { Character } from '../src/character/Character.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { fullKit } from '../src/character/data/skilltree.js';
import { MonsterWorld } from '../server/monsters.js';
import { skillHitSchedule } from '../src/rules/skillHits.js';
import { castInfo } from '../src/training/kitCombat.js';
import { EVOLUTIONS } from '../src/rules/data/evolutions.js';

function fixture(cls = 'warrior', skill = 'sword_twin', variant = null, alloc = {}) {
  let now = 20;
  const cs = new Combatants({ now: () => now, random: () => .5 });
  const skills = fullKit(cls, KIT_SKILL_IDS[cls] ?? []); if (skill) skills[skill] = 5;
  const saved = { ...Character.create('ทดสอบ', cls).toJSON(), level: 100, jobLevel: 50, skills, alloc, evo: variant ? { [skill]: variant } : {} };
  assert.ok(cs.load(1, saved, { account: 'timing', slot: 0 }));
  const c = cs.get(1).c; c.mp = 99999;
  const world = new MonsterWorld('test', { zones: [0, 1].map(x => ({ type: 'boar', x: x + 1, z: 0, radius: 0, count: 1, active: ['day'] })), random: () => .5 });
  for (const m of world.monsters) { world.spawn(m); m.hp = m.maxHp = 1e8; }
  const players = [{ id: 1, x: 0, z: 0 }], target = world.monsters[0];
  return { cs, c, world, target, players, now: () => now, at: value => { now = value; },
    cast: () => { const info = KITS[cls]?.find(k => k.id === skill); const need = info ? castInfo({ ...info, id: c.skillVariant(skill) }, c.skillLevel(skill)).cast * (1 - c.castSpeed) : 0;
      if (need) { cs.casting(1, skill); now += need + .01; }
      assert.ok(cs.cast(1, skill).ok); return cs.get(1).casts.at(-1); },
    blow: (m = target, packet = {}) => cs.blow(1, world, players, { skill, id: m.id, ...packet }) };
}
const primaryHits = (events, target) => events.filter(e => e.t === 'mh' && e.id === target.id);

test('early skill bursts do not spend hits; every canonical due hit and no extra hit can land', () => {
  const f = fixture(), cast = f.cast(), times = skillHitSchedule(KITS.warrior[0]);
  for (let i = 0; i < 30; i++) assert.deepEqual(f.blow(), []);
  assert.equal(cast.left, times.length); assert.equal(cast.next, 0); assert.equal(cast.primary, undefined);
  for (const [i, due] of times.entries()) {
    f.at(cast.at + due - HIT_TIME_SLACK - .001); assert.deepEqual(f.blow(), []); assert.equal(cast.next, i);
    f.at(cast.at + due); assert.equal(primaryHits(f.blow(), f.target).length, 1);
  }
  assert.deepEqual(f.blow(), []); assert.equal(cast.left, 0);
});

test('already due multi-hits can arrive in one frame, while retarget and respawn replay consume nothing', () => {
  const f = fixture(), cast = f.cast();
  f.at(cast.at + cast.schedule[0]); assert.equal(primaryHits(f.blow(), f.target).length, 1);
  f.at(cast.at + cast.schedule.at(-1));
  assert.deepEqual(f.blow(f.world.monsters[1]), []); assert.equal(cast.left, 2);
  for (let i = 0; i < 2; i++) assert.equal(primaryHits(f.blow(), f.target).length, 1);
  assert.deepEqual(f.blow(), []);
  const g = fixture(), next = g.cast(); g.at(next.at + next.schedule[0]); g.blow();
  g.world.spawn(g.target); g.target.hp = 1e8; g.at(next.at + next.schedule.at(-1));
  assert.deepEqual(g.blow(), []); assert.equal(next.left, 2, 'old cast cannot damage a new spawn with the same monster ID');
});

test('cast generations never fall back into an older budget and expiry/cancel/death stop invalid releases', () => {
  const f = fixture(), old = f.cast();
  f.cs.get(1).cds.delete('sword_twin'); const current = f.cast();
  assert.ok(current.generation > old.generation); assert.deepEqual(f.cs.get(1).casts, [current]);
  assert.deepEqual(f.blow(f.target, { generation: old.generation, next: 99, at: -999 }), [], 'client fields cannot force a due time');
  f.at(current.at + current.window); assert.deepEqual(f.blow(), []); assert.equal(current.left, 3);
  const g = fixture('shaman', 'mage_kalp'); g.cs.casting(1, 'mage_kalp'); g.cs.interrupt(1); g.at(g.now() + 10);
  assert.equal(g.cs.cast(1, 'mage_kalp').why, 'casting'); assert.deepEqual(g.blow(), []);
  const h = fixture(), death = h.cast(); h.at(death.at + death.schedule[0]); h.c.hp = 0;
  assert.deepEqual(h.blow(), []); assert.equal(death.left, 3);
});

test('a due hit rejected for range or inventory transaction preserves the usable budget', () => {
  const f = fixture(), cast = f.cast(); f.at(cast.at + cast.schedule[0]);
  const x = f.target.x; f.target.x = 100;
  assert.deepEqual(f.blow(), []); assert.equal(cast.left, 3); assert.equal(cast.primary, undefined);
  f.target.x = x; f.cs.get(1).tradeBusy = true;
  assert.deepEqual(f.blow(), []); assert.equal(cast.left, 3);
  f.cs.get(1).tradeBusy = false; assert.equal(primaryHits(f.blow(), f.target).length, 1);
});

test('all admitted kit skills and evolution paths keep their actual scheduled blows or zero support budget', () => {
  for (const [cls, skills] of Object.entries(KITS)) for (const skill of skills) for (const variant of [null, ...(EVOLUTIONS[skill.id] ? ['A', 'B'] : [])]) {
    const f = fixture(cls, skill.id, variant), cast = f.cast(), eff = variant ? `${skill.id}@${variant}` : skill.id;
    assert.equal(f.c.skillVariant(skill.id), eff);
    const schedule = skillHitSchedule(skill, eff);
    assert.deepEqual(cast.schedule, schedule, eff); assert.equal(cast.left, schedule.length, eff);
    for (const due of schedule) { f.at(cast.at + due); assert.equal(primaryHits(f.blow(), f.target).length, 1, `${eff} at ${due}`); }
    assert.deepEqual(f.blow(), [], `${eff} has no extra direct blow`);
  }
});

test('authoritative death and revival never resume the previous cast or cast bar', () => {
  for (const kill of [f => f.cs.fall(1), f => f.cs.pctHit(1, 100), f => f.cs.swing(1, { atk: 1e9, level: 100, acc: 100 }, 1)]) {
    for (const revive of [f => f.cs.respawn(1), f => f.cs.aid(1, { revive: .5 })]) {
      const f = fixture(), cast = f.cast(); f.cs.casting(1, 'sword_twin');
      kill(f); assert.equal(f.c.alive, false); assert.equal(f.cs.get(1).casting.size, 0); assert.equal(f.cs.get(1).casts.length, 0);
      revive(f); assert.equal(f.c.alive, true); f.at(cast.at + cast.schedule.at(-1)); assert.deepEqual(f.blow(), []);
      assert.equal(cast.left, 3, 'discarding the old budget does not deliver its hits during revival');
    }
  }
});

test('death cleanup also accepts a thin transaction state with no cast-bar map', () => {
  const f = fixture(), cast = f.cast(); delete f.cs.get(1).casting;
  assert.equal(f.cs.pctHit(1, 100).dead, true);
  assert.deepEqual(f.cs.get(1).casts, []);
  assert.equal(f.cs.respawn(1), true); f.at(cast.at + cast.schedule.at(-1)); assert.deepEqual(f.blow(), []);
});

test('cast speed shortens only the bar; evolved projectile/chain and area hits still wait for release markers', () => {
  const f = fixture('shaman', 'mage_kalp', null, { dex: 100 }), cast = f.cast(); assert.ok(f.c.castSpeed > 0);
  f.at(cast.at + cast.schedule[0] * (1 - f.c.castSpeed) - HIT_TIME_SLACK - .001);
  assert.deepEqual(f.blow(), []); f.at(cast.at + cast.schedule[0]); assert.equal(primaryHits(f.blow(), f.target).length, 1);
  const chain = fixture('hunter', 'arch_poison', 'B'), jump = chain.cast();
  assert.deepEqual(chain.blow(), []); chain.at(jump.at + jump.schedule[0]);
  assert.equal(chain.blow().filter(e => e.t === 'mh').length, 2, 'server-selected chain neighbours do not need their own client hit slot');
});

test('instant schedules permit simultaneous hits and legacy projectile windows stay compatible', () => {
  const target = { strikeGeneration: 1 }, cast = { at: 20, window: 6, schedule: [0, 0], next: 0, left: 2, kit: true };
  for (let i = 0; i < 2; i++) { assert.equal(hitDue(cast, 20, target), true); consumeHit(cast, target); }
  assert.equal(hitDue(cast, 20, target), false);
  const legacy = fixture('assassin', 'venom'), release = legacy.cast();
  legacy.at(release.at + 1); assert.equal(primaryHits(legacy.blow(), legacy.target).length, 1);
});
