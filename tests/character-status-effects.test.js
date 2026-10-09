import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';

const hero = (classId = 'warrior') => new Character({ name: 'ทดสอบ', classId, level: 100 });
const add = (c, buffs) => { for (const buff of buffs) c.addBuff({ duration: 10, ...buff }); return c; };

test('different attack buffs add up to at most +60% for physical and magic classes', () => {
  const buffs = [{ id: 'guard', atk: .15 }, { id: 'banner', atk: .22 }, { id: 'berserk', atk: .35 }];
  for (const classId of ['warrior', 'herbalist']) {
    const c = add(hero(classId), buffs), reverse = add(hero(classId), [...buffs].reverse());
    assert.equal(c.patk, Math.round(c.derived.patk * 1.6));
    assert.equal(c.matk, Math.round(c.derived.matk * 1.6));
    assert.equal(c.attack, classId === 'herbalist' ? c.matk : c.patk);
    assert.equal(reverse.attack, c.attack);
    c.buffs.find(b => b.id === 'berserk').remaining = 0;
    assert.equal(c.attack, Math.round((classId === 'herbalist' ? c.derived.matk : c.derived.patk) * 1.37));
  }
});

test('flat defense is added before the combined defense ratio, independent of arrival order', () => {
  const buffs = [{ id: 'plate', defFlat: 25 }, { id: 'guard', def: .15 }, { id: 'support', def: .32, defFlat: 8 }];
  const forward = add(hero(), buffs), reverse = add(hero(), [...buffs].reverse());
  const expected = Math.round((forward.derived.def + 33) * 1.47);
  assert.equal(forward.defense, expected);
  assert.equal(reverse.defense, expected);
});

test('defense ratios cap at +60% while all live flat defense bonuses remain', () => {
  const c = add(hero(), [{ id: 'guard', defFlat: 25, def: .4 }, { id: 'support', defFlat: 8, def: .5 }]);
  assert.equal(c.defense, Math.round((c.derived.def + 33) * 1.6));
  c.buffs.find(b => b.id === 'support').remaining = -1;
  assert.equal(c.defense, Math.round((c.derived.def + 25) * 1.4));
});

test('movement bonus caps at +50% and the existing total attack-speed cap remains 45%', () => {
  const c = add(hero(), [{ id: 'tiger', speed: .35, aspd: .25, duration: .25 }, { id: 'rally', speed: .3, aspd: .3, duration: .5 }]);
  assert.equal(c.speedBonus, .5);
  assert.equal(c.attackSpeed, .45);
  c.tick(.25, true);
  assert.equal(c.speedBonus, .3);
  assert.equal(c.attackSpeed, Math.min(.45, c.derived.aspd + .3));
  c.tick(.25, true);
  assert.equal(c.speedBonus, 0);
  assert.equal(c.attackSpeed, c.derived.aspd);
});

test('zero, expired and invalid timers have no effect even before the next tick', () => {
  const c = hero(), baseline = { attack: c.attack, defense: c.defense, crit: c.critChance, aspd: c.attackSpeed, dodge: c.evadeChance(100) };
  c.buffs = [0, -1, NaN].map((remaining, i) => ({ id: `expired_${i}`, remaining, atk: .6, defFlat: 100, def: .6, speed: .5, crit: .5, aspd: .5, dodge: .5, undying: true }));
  assert.equal(c.attack, baseline.attack);
  assert.equal(c.defense, baseline.defense);
  assert.equal(c.critChance, baseline.crit);
  assert.equal(c.attackSpeed, baseline.aspd);
  assert.equal(c.evadeChance(100), baseline.dodge);
  assert.equal(c.speedBonus, 0);
  assert.equal(c.undying, false);
  c.buffs.push({ id: 'untimed', atk: .1 });
  assert.equal(c.attack, Math.round(c.derived.patk * 1.1), 'a missing remaining field is distinct from an expired timer');
});

test('undying limits lethal damage to one HP and reports only the damage actually dealt', () => {
  const c = add(hero(), [{ id: 'khwan', undying: true }]);
  const events = []; c.on('damaged', n => events.push(n)); c.on('death', () => events.push('death'));
  c.hp = 6.5;
  assert.equal(c.damage(100), 5.5);
  assert.equal(c.hp, 1);
  assert.equal(c.alive, true);
  assert.equal(c.undying, true);
  assert.equal(c.damage(100), 0, 'further blows cannot consume the protected last HP');
  assert.deepEqual(events, [5.5]);
});

test('undying leaves nonlethal damage unchanged and cannot heal through a zero-damage hit', () => {
  const c = add(hero(), [{ id: 'ward', undying: true }]);
  c.hp = 20;
  assert.equal(c.damage(4), 4);
  assert.equal(c.hp, 16);
  assert.equal(c.damage(0), 0);
  assert.equal(c.hp, 16);
});

test('undying expires at its boundary and ordinary lethal damage clears all statuses once', () => {
  const c = add(hero(), [{ id: 'ward', undying: true, duration: .5 }, { id: 'guard', def: .2 }]);
  let deaths = 0; c.on('death', () => deaths++);
  c.tick(.5, true);
  assert.equal(c.undying, false);
  const hp = c.hp;
  assert.equal(c.damage(hp + 100), hp);
  assert.equal(c.hp, 0);
  assert.deepEqual(c.buffs, []);
  assert.equal(deaths, 1);
  assert.equal(c.damage(100), 0);
  assert.equal(deaths, 1);
});

test('explicit death and revive clear protection instead of carrying it into the next life', () => {
  const c = add(hero(), [{ id: 'ward', undying: true }]);
  c.fall();
  assert.equal(c.undying, false);
  c.revive(.3);
  assert.deepEqual(c.buffs, []);
  c.addBuff({ id: 'ward', undying: true, duration: 10 });
  c.revive(.5);
  assert.equal(c.undying, false);
  assert.deepEqual(c.buffs, []);
  assert.equal(c.damage(c.hp + 100) > 0, true);
  assert.equal(c.alive, false);
});

test('revive clamps amplified healing and negative ratios while preserving its one-HP floor', () => {
  for (const ratio of [0, -.5, .3, 1, 1.8]) {
    const c = add(hero(), [{ id: 'ward', undying: true, speed: .35 }]);
    c.hp = 0;
    c.revive(ratio);
    const clamped = Math.max(0, Math.min(1, ratio));
    assert.equal(c.hp, Math.max(1, Math.round(c.maxHp * clamped)), `HP at ratio ${ratio}`);
    assert.equal(c.mp, Math.round(c.maxMp * clamped), `MP at ratio ${ratio}`);
    assert.equal(c.alive, true);
    assert.equal(c.undying, false);
    assert.equal(c.speedBonus, 0);
    assert.deepEqual(c.buffs, []);
  }
  const c = hero(); c.fall(); c.revive(NaN);
  assert.equal(c.hp, Math.round(c.maxHp * .5), 'invalid ratios use the normal default, never NaN vitals');
  assert.equal(c.mp, Math.round(c.maxMp * .5));
});

test('remaining-only buff snapshots protect until expiry without refreshing their lifetime', () => {
  const c = hero();
  c.buffs = [{ id: 'ward', remaining: .1, undying: true, speed: .35 }];
  c.hp = 10;
  c.tick(.05, true);
  assert.equal(c.damage(100), 9);
  assert.equal(c.hp, 1);
  assert.equal(c.speedBonus, .35);
  c.tick(.05, true);
  assert.equal(c.undying, false);
  assert.equal(c.speedBonus, 0);
  assert.equal(c.damage(100), 1);
  assert.equal(c.alive, false);
});

test('same-id refresh replaces values and resets lifetime without stacking or retaining old protection', () => {
  const c = add(hero(), [{ id: 'stance', undying: true, atk: .4, duration: .5 }]);
  c.tick(.25, true);
  const refreshed = { id: 'stance', atk: .2, duration: 1 };
  c.addBuff(refreshed);
  assert.equal(c.buffs.length, 1);
  assert.equal(c.buffSum('atk'), .2);
  assert.equal(c.undying, false);
  assert.equal(c.buffs[0].remaining, 1);
  assert.equal('remaining' in refreshed, false, 'the incoming shared descriptor is not mutated');
  c.tick(.5, true);
  assert.equal(c.buffSum('atk'), .2);
  c.tick(.5, true);
  assert.equal(c.buffSum('atk'), 0);
});

test('cleanse removes every specified harmful status while preserving beneficial buffs', () => {
  const c = hero(), fields = ['poison', 'slow', 'stun', 'bleed', 'burn', 'cursed'];
  for (const key of fields) c.addBuff({ id: key, [key]: 1, duration: 10 });
  c.addBuff({ id: 'guard', defFlat: 25, duration: 10 });
  c.addBuff({ id: 'inactive_flags', slow: 0, stun: false, duration: 10 });
  let cleansed = 0;
  c.on('cleansed', () => {
    cleansed++;
    assert.equal(c.buffs.some(b => fields.some(key => b[key])), false, 'listeners observe the already-cleansed state');
  });
  c.addBuff({ id: 'tiger', cleanse: true, speed: .35, duration: 10 });
  assert.equal(cleansed, 1);
  assert.deepEqual(c.buffs.map(b => b.id), ['guard', 'inactive_flags', 'tiger']);
  assert.equal(c.speedBonus, .35);
  const hp = c.hp; c.tick(.1, true);
  assert.equal(c.hp, hp, 'cleansed poison no longer ticks');
});

test('an instantaneous cleanse announces external condition removal without leaving a timed buff', () => {
  const c = hero(); let cleansed = 0;
  c.on('cleansed', () => cleansed++);
  c.addBuff({ id: 'purify', cleanse: true, duration: 0 });
  assert.equal(cleansed, 1);
  assert.deepEqual(c.buffs, []);
  c.addBuff({ id: 'expired_ward', duration: 0, undying: true, speed: .5 });
  assert.equal(c.undying, false);
  assert.equal(c.speedBonus, 0);
});

test('status buffs never persist in a character save or return from legacy saved buff fields', () => {
  const c = add(hero(), [{ id: 'ward', undying: true, speed: .35, atk: .6, defFlat: 25 }]);
  c.hp = 1;
  const saved = JSON.parse(JSON.stringify(c));
  assert.equal('buffs' in saved, false);
  assert.equal('undying' in saved, false);
  const restored = new Character({ ...saved, buffs: [...c.buffs] });
  assert.deepEqual(restored.buffs, []);
  assert.equal(restored.speedBonus, 0);
  assert.equal(restored.undying, false);
  assert.equal(restored.attack, restored.derived.patk);
  assert.equal(restored.defense, restored.derived.def);
  assert.equal(restored.damage(1), 1);
  assert.equal(restored.alive, false);
});
