import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillPreview } from '../src/rules/skillPreview.js';
import { rollDamage } from '../src/rules/stats.js';
import { selfEffects, supportOf } from '../src/training/kitCombat.js';

test('skill preview endpoints match one live outgoing modifier after armor and critical scaling', () => {
  for (const mob of [false, true]) for (const id of ['sword_twin', 'mage_akom', 'boxer_jab']) {
    const stats = { patk: 119.7, matk: 83.2, accuracy: 150, critRate: 0, critDmg: 1.65, mob };
    const defense = { def: 39.4, eva: 0 }, p = skillPreview(id, 5, stats, { defense, hits: 3 }).damage;
    for (const [i, random] of [0, 1].entries()) {
      const rng = crit => { const values = p.kind === 'magic' && !mob ? [random, crit] : [0, random, crit]; let n = 0; return () => values[n++]; };
      const normalRng = rng(1), critRng = rng(0);
      assert.equal(p.normal[i], rollDamage(stats, defense, p.kind, p.mult, normalRng).dmg);
      assert.equal(p.crit[i], rollDamage({ ...stats, critRate: 1 }, defense, p.kind, p.mult, critRng).dmg);
      assert.equal(p.total[i], p.normal[i] * 3);
    }
  }
});

test('preview buff uptime matches live self and party adapters after cooldown reduction', () => {
  for (const id of ['boxer_waikru', 'mage_shield', 'heal_tonic', 'sword_guard']) {
    const stats = { def: 32, matk: 80, healPow: 1.1, cooldownCut: .3 };
    const preview = skillPreview(id, 10, stats);
    const self = selfEffects(id, 10, stats.def, stats.matk, stats.healPow, stats.cooldownCut);
    const support = supportOf(id, 10, stats.def, stats.matk, stats.healPow, stats.cooldownCut);
    assert.equal(preview.self?.buff?.duration, self?.buff?.duration, id);
    assert.equal(preview.support?.buff?.duration, support?.buff?.duration, id);
    assert.ok(self?.buff?.duration < selfEffects(id, 10, stats.def, stats.matk, stats.healPow, 0)?.buff?.duration, `${id} must exercise the uptime cap`);
  }
});
