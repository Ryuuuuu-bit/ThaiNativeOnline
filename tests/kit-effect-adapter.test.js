// The shared adapter preserves effect meaning before client/server consumption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUFF_UPTIME, castInfo, healPower, hitEffects, monsterDefense, selfEffects, supportOf } from '../src/training/kitCombat.js';
import { effectiveDefense } from '../src/combat/statusEffects.js';
import { SKILL_BY_ID, skillStats } from '../src/rules/data/skills.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('flat defense is recipient-independent, including party and evolved buffs', () => {
  for (const ownDef of [0, 10, 200]) {
    const shield = selfEffects('mage_shield', 1, ownDef);
    assert.equal(shield.buff.defFlat, 24);
    assert.equal(shield.buff.def, undefined);
    assert.equal(shield.heal, .12);
    assert.equal(supportOf('mage_holy', 1, ownDef).buff.defFlat, 12);
    assert.equal(supportOf('heal_mist@B', 1, ownDef).buff.defFlat, 12);
  }
});

test('ratio defense, movement speed and cleanse survive scaling and evolution', () => {
  const tiger = selfEffects('heal_tiger', 10, 200).buff;
  assert.equal(tiger.def, .32);
  assert.equal(tiger.defFlat, undefined);
  assert.equal(tiger.speed, .35);
  assert.equal(tiger.cleanse, true);
  const berserk = selfEffects('sword_berserk').buff;
  assert.equal(berserk.speed, .15);
  assert.equal(berserk.atk, .35);
  assert.equal(berserk.crit, .15);
  assert.equal(berserk.aspd, .15);
  const evolved = supportOf('heal_tiger@B', 10, 200).buff;
  assert.equal(evolved.def, .1);
  assert.equal(evolved.atk, .28);
  assert.equal(evolved.cleanse, true);
});

test('flat and ratio DEF remain separate when a descriptor includes both', () => {
  const id = 'test_mixed_def';
  SKILL_BY_ID[id] = { type: 'party', party: true, radius: 200, cd: 10000, duration: 4000, buff: { def: 12, defMul: .2 } };
  try {
    assert.deepEqual(supportOf(id, 1, 300).buff, { id: `kit_${id}`, duration: 4, defFlat: 12, def: .2 });
  } finally { delete SKILL_BY_ID[id]; }
});

test('ordinary buffs leave at least 20% of the effective cooldown uncovered', () => {
  assert.equal(BUFF_UPTIME, .8);
  let checked = 0;
  for (const [id, base] of Object.entries(SKILL_BY_ID)) {
    if (!base.buff || !base.duration || base.undying) continue;
    for (const lv of [1, 5, 10]) for (const cut of [0, .15, .3]) {
      const st = skillStats(base, lv), buff = selfEffects(id, lv, 10, 100, 1, cut).buff;
      const cooldown = st.cd / 1000 * (1 - cut);
      assert.ok(buff && buff.duration > 0, id);
      close(buff.duration, Math.min(st.duration / 1000, cooldown * BUFF_UPTIME));
      assert.ok(buff.duration <= cooldown * BUFF_UPTIME + 1e-10, id);
      checked++;
    }
  }
  assert.ok(checked > 100, 'covers real class buffs and evolution variants');
  close(selfEffects('mage_shield', 10, 10, 0, 1, .3).buff.duration, 6.944);
});

test('support passes cooldownCut through, with the existing five-argument default retained', () => {
  const id = 'mage_shield';
  assert.deepEqual(selfEffects(id, 10, 10, 100, 1), selfEffects(id, 10, 10, 100, 1, 0));
  const support = supportOf('heal_tiger', 10, 10, 100, 1, .3);
  assert.deepEqual(support.buff, selfEffects('heal_tiger', 10, 10, 100, 1, .3).buff);
  assert.ok(support.buff.duration < selfEffects('heal_tiger', 10).buff.duration);
});

test('revive carries undying protection without requiring an ordinary buff', () => {
  for (const [id, duration] of [['heal_khwan', 10], ['heal_amrita', 8]]) {
    assert.equal(SKILL_BY_ID[id].buff, undefined);
    for (const lv of [1, 10]) {
      const own = selfEffects(id, lv, 10, 100, 1.25, .3);
      const party = supportOf(id, lv, 200, 100, 1.25, .3);
      assert.deepEqual(own.buff, { id: `kit_${id}`, duration, undying: true });
      assert.deepEqual(party.buff, own.buff);
      assert.ok(party.revive > 0);
      assert.equal(party.heal, own.heal);
      assert.equal(party.hp, 0);
    }
  }
});

test('revive never exceeds full HP with amplified healing power', () => {
  for (const id of ['heal_khwan', 'heal_amrita']) {
    const support = supportOf(id, 10, 10, 100, 2, .3);
    assert.ok(support.heal > 1, 'the heal descriptor keeps its existing scaling');
    assert.equal(support.revive, 1);
    assert.equal(support.buff.undying, true);
  }
});

test('tether casts need no enemy or dummy while damaging skills still require a target', () => {
  for (const lv of [1, 10]) {
    const info = castInfo({ id: 'heal_vine' }, lv);
    assert.equal(info.needsTarget, false);
    assert.ok(info.mp > 0 && info.cd > 0);
    assert.equal(castInfo({ id: 'heal_pill' }, lv).needsTarget, true);
    assert.equal(castInfo({ id: 'boxer_jab' }, lv).needsTarget, true);
  }
});

test('tether healing is an exact per-tick schedule and never immediate HP', () => {
  const e = selfEffects('heal_vine', 1, 10, 101, 1.25, .3);
  assert.deepEqual(e, {
    heal: 0, hp: 0, mp: 0, buff: null,
    tether: { amount: 8, every: .5, duration: 6, near: 3.6, nearMul: 1.5, breakAt: 9.2 },
  });
  const party = supportOf('heal_vine', 1, 200, 101, 1.25, .3);
  assert.equal(party.hp, 0);
  assert.deepEqual(party.tether, e.tether);
  assert.equal(party.radius, 8.8);
  assert.equal(party.revive, 0);
});

test('tether duration scales independently of the ordinary buff uptime cap', () => {
  const base = SKILL_BY_ID.heal_vine, st = skillStats(base, 10);
  const e = selfEffects('heal_vine', 10, 10, 101, 1.25, .3);
  assert.equal(e.hp, 0);
  assert.equal(e.tether.amount, Math.round(st.hmult * 101 * 1.25));
  assert.equal(e.tether.duration, st.duration / 1000);
  assert.equal(e.tether.every, .5);
  assert.ok(e.tether.duration > st.cd / 1000 * .7 * BUFF_UPTIME);
  // The skill panel may still show total potential healing; consumers use the schedule.
  assert.ok(healPower('heal_vine', 10, 101) > e.tether.amount);
});

test('zero-power tether still has only finite schedule fields and defaults nearMul to one', () => {
  for (const lv of [1, 5, 10]) {
    const e = selfEffects('heal_vine', lv);
    assert.equal(e.hp, 0);
    assert.equal(e.tether.amount, 0);
    assert.deepEqual(Object.keys(e.tether), ['amount', 'every', 'duration', 'near', 'nearMul', 'breakAt']);
    assert.ok(Object.values(e.tether).every(Number.isFinite));
  }
  const id = 'test_tether_near_default';
  SKILL_BY_ID[id] = { ...SKILL_BY_ID.heal_vine, nearMul: undefined };
  try { assert.equal(selfEffects(id, 1, 10, 100).tether.nearMul, 1); }
  finally { delete SKILL_BY_ID[id]; }
});

test('existing immediate healing remains for bouncing pills, mortar and ordinary healing', () => {
  assert.equal(selfEffects('heal_pill', 1, 10, 100, 1.2).hp, 126);
  assert.equal(selfEffects('heal_mortar', 1, 10, 100, 1.2).hp, 72);
  assert.equal(selfEffects('heal_mist', 1, 10, 100, 1.25).heal, .225);
  for (const id of ['heal_pill', 'heal_mortar', 'heal_mist']) assert.equal(selfEffects(id, 1, 10, 100).tether, undefined);
});

test('armor break and weak preserve declared ratios and seconds alongside existing effects', () => {
  let checked = 0;
  for (const [id, base] of Object.entries(SKILL_BY_ID)) for (const key of ['armorBreak', 'weak']) {
    const descriptor = base.effect?.[key];
    if (!descriptor) continue;
    const effects = hitEffects(id, 40), effect = effects.find(e => e.id === key);
    assert.ok(effect, `${id}: ${key}`);
    assert.equal(effect[key], descriptor.pct);
    assert.equal(effect.duration, descriptor.ms / 1000);
    assert.ok(Number.isFinite(effect[key]) && Number.isFinite(effect.duration));
    if (base.effect.stun) assert.ok(effects.some(e => e.id === 'stun'), id);
    checked++;
  }
  assert.ok(checked >= 5);
  assert.deepEqual(hitEffects('boxer_elbow', 40).map(e => e.id).sort(), ['bleed', 'stun']);
  assert.deepEqual(hitEffects('unknown_skill', 40), []);
});

test('monsterDefense delegates live-monster and bare-definition inputs to effectiveDefense', () => {
  assert.equal(monsterDefense, effectiveDefense);
  assert.deepEqual(monsterDefense({ def: 40, eva: 12 }), { def: 40, eva: 12 });
  assert.deepEqual(monsterDefense({ def: { def: 40, eva: 12 }, debuffs: [] }), { def: 40, eva: 12 });
});

test('damage-only and unknown skills do not invent support or self effects', () => {
  assert.equal(selfEffects('boxer_jab'), null);
  assert.equal(selfEffects('unknown_skill'), null);
  assert.equal(supportOf('heal_zone'), null);
  assert.equal(supportOf('unknown_skill'), null);
});
