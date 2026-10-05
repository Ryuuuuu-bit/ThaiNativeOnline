// Ported from the original tests/combat.test.mjs (stats / damage / skills / SP / passives).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDerived, rollDamage, hitChanceOf, expToNext, statCost, statPointsAt, raiseCost, planRaise, STAT_CAP, MAX_LEVEL, STAT_KEYS } from '../../src/rules/stats.js';
import { JOBS, VILLAGER } from '../../src/rules/data/classes.js';
import { sanitizeAppearance } from '../../src/rules/data/appearance.js';
import { weaponStyle } from '../../src/rules/data/items.js';
import { MONSTERS } from '../../src/rules/data/monsters.js';
import { SKILLS, SKILL_BY_ID, skillStats, canLearn, MAX_SKILL_LV, reqCharLevel, skillCap, spAt, spForLevel } from '../../src/rules/data/skills.js';
import { PASSIVES_ON } from '../../src/rules/data/passives.js';
import { newCharacter, assignHotbar, migrate } from '../../src/rules/charmodel.js';
import { getDerived, attackGate } from '../../src/rules/character.js';

let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const base = { STR: 10, AGI: 10, VIT: 10, INT: 10, DEX: 10, LUK: 10 };

test('constants: level cap 150, six stats, cap 130', () => {
  assert.equal(MAX_LEVEL, 150);
  assert.deepEqual(STAT_KEYS, ['STR', 'AGI', 'VIT', 'INT', 'DEX', 'LUK']);
  assert.equal(STAT_CAP, 130);
  assert.deepEqual(Object.keys(JOBS), ['swordman', 'mage', 'archer', 'boxer', 'healer']);
  assert.equal(VILLAGER.id, 'villager');
});

test('derived stats follow RO-style formulas', () => {
  const d0 = computeDerived(base, JOBS.swordman, 1);
  const up = (k, opt) => computeDerived({ ...base, [k]: base[k] + 1 }, JOBS.swordman, 1, {}, opt);
  assert.ok(up('STR').patk > d0.patk, 'STR → ATK ประชิด');
  assert.ok(up('DEX', { ranged: true }).patk > computeDerived(base, JOBS.swordman, 1, {}, { ranged: true }).patk, 'DEX → ATK ธนู');
  assert.ok(up('AGI').aspd > d0.aspd && up('AGI').eva >= d0.eva, 'AGI → ความเร็วตี + หลบ');
  assert.ok(up('VIT').maxHp > d0.maxHp, 'VIT → HP');
  assert.ok(up('INT').matk > d0.matk && up('INT').maxMp > d0.maxMp, 'INT → MATK + MP');
  assert.ok(up('DEX').accuracy > d0.accuracy, 'DEX → แม่นยำ');
  assert.ok(up('LUK').critRate > d0.critRate && up('LUK').critDmg > d0.critDmg, 'LUK → คริ');
  const at = (v) => computeDerived({ ...base, STR: v }, JOBS.swordman, 1).patk;
  assert.ok(at(101) - at(100) > at(11) - at(10), 'STR สูงยิ่งคุ้ม');
  assert.ok(computeDerived({ ...base, AGI: 999 }, JOBS.swordman, 1).aspd <= 0.3, 'ความเร็วตีไม่เกิน 30%');
});

test('RO-style stat point costs', () => {
  assert.equal(statCost(1), 2); assert.equal(statCost(10), 2); assert.equal(statCost(11), 3); assert.equal(statCost(99), 11);
  assert.equal(statPointsAt(1), 48); assert.equal(statPointsAt(150), 2670);
  assert.equal(raiseCost(1, 98), 628);
  const { add, used } = planRaise({ STR: 1, AGI: 1, VIT: 1, INT: 1, DEX: 1, LUK: 1 }, statPointsAt(150), { STR: 1, VIT: 0.8 });
  assert.equal(1 + add.STR, STAT_CAP); assert.ok(used <= statPointsAt(150));
});

test('hit chance is clamped to 60–99%', () => {
  assert.equal(hitChanceOf(90, 0), 0.95);
  assert.equal(hitChanceOf(0, 100), 0.6);
  assert.equal(hitChanceOf(300, 0), 0.99);
});

test('damage: never negative, crits clearly stronger, ~10% miss; magic ignores more armor', () => {
  const atk = { patk: 20, matk: 20, accuracy: 90, critRate: 0.5, critDmg: 2 };
  let misses = 0, maxNormal = 0, minCrit = 1e9;
  for (let i = 0; i < 5000; i++) {
    const r = rollDamage(atk, { def: 2, eva: 5 }, 'physical', 1, rng);
    if (!r.hit) { misses++; assert.equal(r.dmg, 0); continue; }
    assert.ok(r.dmg >= 1);
    if (r.crit) minCrit = Math.min(minCrit, r.dmg); else maxNormal = Math.max(maxNormal, r.dmg);
  }
  assert.ok(minCrit > maxNormal * 1.5);
  assert.ok(misses / 5000 > 0.05 && misses / 5000 < 0.15, `miss ${(misses / 50).toFixed(1)}%`);
  const tank = { def: 40, eva: 0 };
  const avg = (kind) => { let s = 0; for (let i = 0; i < 2000; i++) s += rollDamage({ ...atk, critRate: 0 }, tank, kind, 1, rng).dmg; return s / 2000; };
  assert.ok(avg('magic') > avg('physical'));
});

test('every job kills a Lv.1 ghost in 2–6 hits; DPS spread < 2.5×', () => {
  const dps = {};
  for (const [id, job] of Object.entries(JOBS)) {
    const d = computeDerived({ STR: 5, AGI: 5, VIT: 5, INT: 5, DEX: 5, LUK: 5 }, job, 1, {}, { ranged: id === 'archer' });
    const a = job.attack;
    const power = (a.kind === 'magic' ? d.matk : d.patk) * a.mult;
    const hits = Math.ceil(MONSTERS.phi_tuay_kaew.hp / power);
    assert.ok(hits >= 2 && hits <= 6, `${id}: ${hits} hits`);
    dps[id] = power / (a.cooldown / 1000);
  }
  const v = Object.values(dps);
  assert.ok(Math.max(...v) / Math.min(...v) < 2.5, JSON.stringify(dps));
});

test('skills: unique ids, scaling, learn rules', () => {
  const allSk = Object.values(SKILLS).flat();
  assert.equal(new Set(allSk.map((s) => s.id)).size, allSk.length);
  assert.ok(Object.keys(SKILL_BY_ID).length >= allSk.length);
  for (const [job, list] of Object.entries(SKILLS)) {
    assert.ok(list.length >= 5, `${job} >= 5 skills`);
    if (job !== 'hybrid') assert.ok(list.filter((s) => s.ultimate).length >= 1, `${job} ultimate`);
    for (const s of list) {
      if (s.type === 'passive') {
        const b1 = s.passive(1), b5 = s.passive(MAX_SKILL_LV);
        assert.ok(Object.keys(b1).length > 0, `${s.id} passive bonus`);
        assert.ok(Object.entries(b5).every(([k, x]) => x > (b1[k] || 0)), `${s.id} passive scales`);
        continue;
      }
      const a1 = skillStats(s, 1), a5 = skillStats(s, MAX_SKILL_LV);
      assert.ok(a1.cd > 0 && a1.mp > 0, `${s.id} cost`);
      assert.ok(a5.cd < a1.cd && a5.mp >= a1.mp, `${s.id} scales cd/mp`);
      if (a1.mult) assert.ok(a5.mult > a1.mult, `${s.id} scales dmg`);
      else if (a1.heal) assert.ok(a5.heal >= a1.heal, `${s.id} scales heal`);
    }
  }
  const ch = { appearance: { job: 'mage' }, level: 1, sp: 1, skills: {} };
  assert.equal(canLearn(ch, 'mage_akom').ok, true);
  assert.equal(canLearn(ch, 'mage_kalp').ok, false, 'ultimate locked at lv1');
  assert.equal(canLearn(ch, 'boxer_jab').ok, true, 'villager can learn any path skill');
  assert.equal(canLearn({ ...ch, sp: 0 }, 'mage_akom').ok, false);
  assert.equal(canLearn({ ...ch, skills: { mage_akom: 1 } }, 'mage_akom').ok, false);
  assert.equal(reqCharLevel(SKILL_BY_ID.mage_akom, 2), 3);
});

test('talent tree gate (PASSIVES_ON)', () => {
  if (!PASSIVES_ON) {
    const v = { level: 20, sp: 10, skills: { sword_twin: 2 } };
    assert.equal(canLearn(v, 'sword_twin').ok, true);
    return;
  }
  const v = { passives: ['root'], level: 20, sp: 10, skills: { sword_twin: 2 } };
  assert.equal(canLearn(v, 'sword_twin').ok, false);
  assert.equal(canLearn(v, 'sword_pikat').ok, false);
  const m = { ...v, passives: ['root', ...Array.from({ length: 9 }, (_, i) => `swordman_${i}`)] };
  assert.equal(canLearn(m, 'sword_twin').ok, true);
  assert.equal(canLearn(m, 'sword_pikat').ok, true);
  assert.equal(skillCap(m, SKILL_BY_ID.sword_twin), 5);
});

test('combat style comes from the weapon (server never trusts job from client)', () => {
  assert.equal(sanitizeAppearance({ job: 'mage' }).job, 'boxer', 'no weapon → fists');
  assert.equal(sanitizeAppearance({ job: 'boxer', weapon: 'yant_staff' }).job, 'mage');
  assert.equal(sanitizeAppearance({ weapon: 'hp_s' }).weapon, null);
  assert.equal(sanitizeAppearance({ path: 'hacker' }).path, null);
  assert.equal(weaponStyle('horn_bow'), 'archer');
});

test('SP: every level to 60, then every 2 levels; Lv.150 = 105; overspent saves get a free reset', () => {
  assert.equal(spAt(1), 1); assert.equal(spAt(60), 60); assert.equal(spAt(62), 61); assert.equal(spAt(150), 105);
  let sum = spAt(1); for (let L = 2; L <= 150; L++) sum += spForLevel(L);
  assert.equal(sum, spAt(150));
  const old = migrate({ name: 'เก่า', appearance: {}, level: 100, v: 2, skills: { sword_twin: 5, sword_thrust: 5 }, sp: 0 });
  assert.equal(old.sp, spAt(100) - 10);
  const big = migrate({ name: 'เกิน', appearance: {}, level: 100, v: 2, skills: Object.fromEntries(['sword_twin', 'sword_thrust', 'sword_wind', 'sword_guard', 'sword_pikat', 'sword_banner', 'sword_whirl', 'sword_leap', 'sword_berserk', 'sword_execute', 'mage_akom', 'mage_yant', 'mage_thunder', 'mage_kalp', 'mage_ghostfire', 'mage_curse', 'mage_shield', 'mage_holy'].map((id) => [id, 5])), sp: 0 });
  assert.deepEqual(big.skills, {}); assert.equal(big.sp, spAt(100)); assert.ok(big.spNotice);
});

test('attackGate counts skill rounds by cast time', () => {
  const p = { char: { skills: { mage_yant: 5 } }, skillAt: { mage_yant: 1000 } };
  assert.ok(attackGate(p, 'mage_yant', false, 2000));
  p.skillAt.mage_yant = 4500;
  assert.ok(attackGate(p, 'mage_yant', false, 4550));
});

test('weapon passives apply only with the matching weapon; not hotbar-able', () => {
  const c = newCharacter('ทดสอบ', {});
  c.level = 20; c.appearance.job = 'swordman';
  const b = getDerived(c);
  c.skills.sword_p_mastery = 3;
  assert.ok(getDerived(c).patk > b.patk);
  c.appearance.job = 'boxer';
  assert.equal(getDerived(c).patk, b.patk);
  assert.equal(assignHotbar(c, '3', 'sword_p_mastery'), false);
  c.appearance.job = 'archer'; c.skills.arch_p_step = 5;
  assert.ok(getDerived(c).aspd >= 0.1);
});

test('path bonus multiplies stats; EXP curve rises', () => {
  const b = computeDerived(base, VILLAGER, 10), w = computeDerived(base, VILLAGER, 10, JOBS.swordman.pathBonus);
  assert.ok(w.maxHp > b.maxHp && w.def === b.def + 4);
  const mg = computeDerived(base, VILLAGER, 10, JOBS.mage.pathBonus);
  assert.ok(mg.matk > b.matk && mg.maxMp > b.maxMp);
  assert.ok(expToNext(2) > expToNext(1));
});

test('newCharacter shape', () => {
  const c = newCharacter('ผู้กล้า', { gender: 'female' });
  assert.equal(c.level, 1); assert.equal(c.path, null); assert.equal(c.gold, 150);
  assert.deepEqual(c.stats, { STR: 5, AGI: 5, VIT: 5, INT: 5, DEX: 5, LUK: 5 });
  assert.equal(c.statPoints, 0);
  assert.equal(c.appearance.job, 'boxer', 'bare hands → boxer style');
  assert.ok(c.hp > 0 && c.hp === getDerived(c).maxHp);
});
