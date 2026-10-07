// Skill balance guard rails (src/rules/data/skills.js): the damage curve rises with
// level, spam skills stay near a basic attack, healers out-heal everyone, and attack
// speed from buffs reaches combat (capped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../src/rules/data/skills.js';
import { selfEffects } from '../src/training/kitCombat.js';
import { Character } from '../src/character/Character.js';
import { ASPD_BUFF_MAX } from '../src/rules/stats.js';

const JOBS = ['boxer', 'swordman', 'archer', 'mage'];
// total multiplier per second of cooldown at skill Lv1 (damage over time left out)
const rate = s => (s.mult * (s.hits || 1) * (s.count || 1)) / (s.cd / 1000);
const dmg = job => SKILLS[job].filter(s => s.mult && s.type !== 'passive');

test('Lv1 spam skills stay close to a basic attack (0.8–1.0 per second)', () => {
  for (const job of JOBS) { const s = dmg(job).find(x => x.reqLv === 1); const r = rate(s); assert.ok(r >= .8 && r <= 1.0, `${s.id} ${r.toFixed(2)}`); }
});

test('the Lv100 skill out-damages the Lv8 one, and Lv70+ skills beat Lv2–6 ones', () => {
  for (const job of JOBS) {
    const by = lv => dmg(job).filter(s => s.reqLv === lv).map(rate);
    const top = Math.max(...by(100)), early = Math.max(...[2, 4, 6].flatMap(by));
    assert.ok(top > Math.max(...by(8)), `${job}: Lv100 ${top.toFixed(2)} vs Lv8`);
    const late = Math.max(...[70, 100].flatMap(by));
    assert.ok(late > early, `${job}: late ${late.toFixed(2)} vs early ${early.toFixed(2)}`);
  }
});

test('nobody self-heals more per second than the healer heals', () => {
  const hps = s => (s.heal || 0) / (s.cd / 1000);
  const healer = Math.max(...SKILLS.healer.filter(s => s.type === 'party').map(hps));
  for (const job of JOBS) for (const s of SKILLS[job]) if (typeof s.heal === 'number' && s.heal > 0) assert.ok(hps(s) <= healer / 2, `${s.id} heals ${(hps(s) * 100).toFixed(2)}%/s`);
});

test('attack-speed buffs reach combat, together with AGI capped at the rules limit', () => {
  const e = selfEffects('arch_hawk', 1, 10);
  assert.equal(e.buff.aspd, .25);
  const c = Character.create('ทดสอบ', 'hunter'), base = c.attackSpeed;
  c.addBuff(e.buff);
  assert.ok(Math.abs(c.attackSpeed - Math.min(ASPD_BUFF_MAX, base + .25)) < 1e-9);
  c.addBuff({ id: 'more', duration: 5, aspd: 1 });
  assert.equal(c.attackSpeed, ASPD_BUFF_MAX);
});

test('every class has a basic attack, and AGI makes it faster', async () => {
  const { CLASSES } = await import('../src/character/data/classes.js');
  const { SKILLS: COMBAT_SKILLS } = await import('../src/combat/data/skills.js');
  for (const id of Object.keys(CLASSES)) {
    assert.ok(CLASSES[id].skills.some(s => COMBAT_SKILLS[s]?.basic), `${id} has a basic attack`);
    const c = Character.create('ทดสอบ', id), interval = () => c.cls.attackSpeed * (1 - c.attackSpeed);
    const before = interval();
    c.alloc.agi = (c.alloc.agi || 0) + 60;
    assert.ok(interval() < before, `${id}: AGI shortens the swing (${before.toFixed(2)} → ${interval().toFixed(2)})`);
  }
});
