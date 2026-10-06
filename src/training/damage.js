// Pure damage math for the training ground (no three, no DOM): one blow of a
// class skill against a target, using the rules' skill table and formulas.
import { JOBS } from '../rules/data/classes.js';
import { SKILL_BY_ID, skillStats } from '../rules/data/skills.js';
import { computeDerived, rollDamage } from '../rules/stats.js';

export const jobDerived = (job, stats, level) => computeDerived(stats, JOBS[job] ?? JOBS.boxer, level);
export const boxerDerived = (stats, level) => jobDerived('boxer', stats, level);

// Per-blow multiplier of a skill at a skill level; null for skills that deal no damage (buffs).
export function skillMult(skillId, skillLevel = 1) {
  const base = SKILL_BY_ID[skillId];
  return base?.mult ? skillStats(base, skillLevel).mult : null;
}

// → { hit, crit, dmg }; buffs return a zero hit so callers never divide by nothing.
export function rollSkill(derived, target, skillId, skillLevel = 1, rng = Math.random) {
  const mult = skillMult(skillId, skillLevel);
  if (mult === null) return { hit: true, crit: false, dmg: 0 };
  return rollDamage(derived, target, SKILL_BY_ID[skillId].kind || 'physical', mult, rng);
}
