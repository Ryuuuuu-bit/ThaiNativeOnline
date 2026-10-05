import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEffects, tickEffects, isStunned, slowMul, defMul, weakenDamage, clearEffects } from '../../src/rules/effects.js';
import { SKILL_BY_ID } from '../../src/rules/data/skills.js';

const mob = (extra = {}) => ({ hp: 1000, ...extra });

test('DoT: round(hit × ratio) every `every` ms for `ticks` ticks, then removed', () => {
  const m = mob();
  applyEffects(m, { poison: { ticks: 3, every: 700, ratio: 0.4 } }, 55, 1000, { by: 'p1' });
  assert.deepEqual(m.dots.poison, { by: 'p1', dmg: 22, left: 3, every: 700, next: 1700 });
  assert.deepEqual(tickEffects(m, 1699), [], 'not due yet');
  const e1 = tickEffects(m, 1700);
  assert.deepEqual(e1, [{ kind: 'poison', by: 'p1', dmg: 22, hp: 978, killed: false }]);
  assert.equal(m.dots.poison.next, 2400);
  tickEffects(m, 2400); tickEffects(m, 3100);
  assert.equal(m.hp, 1000 - 66);
  assert.equal(m.dots, null, 'expired DoTs clear the map');
  assert.deepEqual(tickEffects(m, 9999), []);
});

test('DoT: minimum 1 per tick; kinds stack; same kind replaces', () => {
  const m = mob();
  applyEffects(m, { bleed: { ticks: 2, every: 600, ratio: 0.2 } }, 2, 0);
  assert.equal(m.dots.bleed.dmg, 1, 'max(1, round(2×0.2))');
  applyEffects(m, { burn: { ticks: 4, every: 600, ratio: 0.3 } }, 100, 0);
  assert.deepEqual(Object.keys(m.dots).sort(), ['bleed', 'burn']);
  applyEffects(m, { burn: { ticks: 4, every: 600, ratio: 0.3 } }, 200, 300);
  assert.equal(m.dots.burn.dmg, 60); assert.equal(m.dots.burn.next, 900);
  const ev = tickEffects(m, 900);
  assert.deepEqual(ev.map((e) => e.kind).sort(), ['bleed', 'burn']);
});

test('DoT: stops at the killing tick and reports it; ownerOk drops a DoT silently', () => {
  const m = mob({ hp: 10 });
  applyEffects(m, { poison: { ticks: 5, every: 100, ratio: 1 }, bleed: { ticks: 5, every: 100, ratio: 1 } }, 10, 0, { by: 'a' });
  const ev = tickEffects(m, 100);
  assert.equal(ev.length, 1); assert.equal(ev[0].killed, true); assert.equal(ev[0].hp, 0);
  const n = mob();
  applyEffects(n, { poison: { ticks: 5, every: 100, ratio: 0.5 } }, 10, 0, { by: 'gone' });
  assert.deepEqual(tickEffects(n, 100, { ownerOk: (by) => by !== 'gone' }), []);
  assert.equal(n.hp, 1000); assert.equal(n.dots, null);
});

test('stun extends to the later end; bosses get half duration', () => {
  const m = mob(), b = mob({ boss: true });
  applyEffects(m, { stun: { ms: 1800 } }, 10, 1000);
  assert.equal(m.stunUntil, 2800);
  applyEffects(m, { stun: { ms: 400 } }, 10, 1100);
  assert.equal(m.stunUntil, 2800, 'shorter stun does not cut the longer one');
  assert.ok(isStunned(m, 2799) && !isStunned(m, 2800));
  applyEffects(b, { stun: { ms: 1800 }, slow: { ms: 3000, pct: 0.4 }, poison: { ticks: 4, every: 700, ratio: 0.3 } }, 100, 0);
  assert.equal(b.stunUntil, 900); assert.equal(b.slowUntil, 1500);
  assert.equal(b.dots.poison.left, 4, 'DoT tick count is not halved');
});

test('slow / armorBreak / weak keep the larger pct while active, reset after expiry', () => {
  const m = mob();
  applyEffects(m, { slow: { ms: 3000, pct: 0.4 } }, 10, 0);
  applyEffects(m, { slow: { ms: 3500, pct: 0.3 } }, 10, 1000);
  assert.equal(m.slowPct, 0.4); assert.equal(m.slowUntil, 4500);
  assert.ok(Math.abs(slowMul(m, 4000) - 0.6) < 1e-12); assert.equal(slowMul(m, 4500), 1);
  applyEffects(m, { slow: { ms: 1000, pct: 0.2 } }, 10, 5000);
  assert.equal(m.slowPct, 0.2, 'expired → new strength');
  applyEffects(m, { armorBreak: { ms: 6000, pct: 0.3 } }, 10, 0);
  applyEffects(m, { armorBreak: { ms: 8000, pct: 0.4 } }, 10, 100);
  assert.equal(m.defDownPct, 0.4); assert.ok(Math.abs(defMul(m, 200) - 0.6) < 1e-12);
  applyEffects(m, { weak: { ms: 5000, pct: 0.25 } }, 10, 0);
  assert.equal(weakenDamage(m, 100, 10), 75); assert.equal(weakenDamage(m, 1, 10), 1); assert.equal(weakenDamage(m, 100, 5000), 100);
});

test('nothing applies to a dead target; clearEffects resets', () => {
  const m = mob({ hp: 0 });
  applyEffects(m, SKILL_BY_ID.boxer_jab?.effect || { stun: { ms: 700 } }, 10, 0);
  assert.equal(m.stunUntil, undefined);
  const n = mob();
  applyEffects(n, { stun: { ms: 700 }, weak: { ms: 5000, pct: 0.25 }, bleed: { ticks: 4, every: 600, ratio: 0.25 } }, 40, 0);
  clearEffects(n);
  assert.equal(n.dots, null); assert.equal(isStunned(n, 1), false); assert.equal(weakenDamage(n, 100, 1), 100);
});

test('real skill data drives effects (Muay Thai kick: stun + weak)', () => {
  const kick = Object.values(SKILL_BY_ID).find((s) => s.effect?.stun && s.effect?.weak);
  const m = mob();
  applyEffects(m, kick.effect, 120, 0);
  assert.equal(m.stunUntil, kick.effect.stun.ms); assert.equal(m.weakPct, kick.effect.weak.pct);
});
