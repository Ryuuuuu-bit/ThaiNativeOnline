// Pure part of the original tests/skill-effects.test.mjs (the skill catalogue). The original also
// checked the 2D Phaser client's screen flashes (client/js/topdown/TdSkills.js), which is not ported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_BY_ID } from '../../src/rules/data/skills.js';
import { DOT_KINDS } from '../../src/rules/effects.js';

const all = Object.values(SKILL_BY_ID);

test('catalogue: 56 active / 10 weapon passives + 15 tree passives', () => {
  assert.equal(all.filter((s) => s.type !== 'passive').length, 56);
  assert.equal(all.filter((s) => s.type === 'passive' && s.job).length, 10);
  assert.equal(all.filter((s) => s.type === 'passive' && !s.job).length, 15, 'one tree passive on each line of each class (src/rules/data/kitpassives.js)');
});

test('every skill effect is supported by legacy statuses or kit provocation', () => {
  const KNOWN = new Set(['stun', 'slow', 'armorBreak', 'weak', 'taunt', ...DOT_KINDS]);
  const withEffect = all.filter((s) => s.effect);
  assert.ok(withEffect.length > 0);
  for (const s of withEffect) for (const [k, v] of Object.entries(s.effect)) {
    assert.ok(KNOWN.has(k), `${s.id}: unknown effect ${k}`);
    if (k === 'taunt') assert.ok(v.ms > 0 && v.radius > 0 && ['party', 'buff'].includes(s.type), `${s.id}: radial support provocation`);
    else if (DOT_KINDS.includes(k)) assert.ok(v.ticks > 0 && v.every > 0 && v.ratio > 0, `${s.id}.${k}`);
    else assert.ok(v.ms > 0 && (k === 'stun' || (v.pct > 0 && v.pct < 1)), `${s.id}.${k}`);
  }
});
