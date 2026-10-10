// Pure presentation data, using the same formulas as kit combat. No saved state.
import { SKILL_BY_ID, skillStats } from './data/skills.js';
import './data/evolutions.js';
import { hitChanceOf } from './stats.js';
import { RULES } from '../combat/data/rules.js';
import { castInfo, selfEffects, supportOf, hitEffects } from '../training/kitCombat.js';

export function skillPreview(id, level, stats, options = {}) {
  const base = SKILL_BY_ID[id];
  if (!base || base.type === 'passive') return null;
  const lv = Math.max(1, Math.min(10, Math.trunc(Number(level) || 1)));
  const st = skillStats(base, lv), cast = castInfo({ id }, lv);
  const known = options.defense != null;
  const defense = known ? options.defense : { def: 0, eva: 0 };
  const kind = base.kind || 'physical';
  const power = kind === 'magic' ? stats.matk : kind === 'best' ? Math.max(stats.patk, stats.matk) : stats.patk;
  const hits = Math.max(1, Math.trunc(options.hits ?? base.hits ?? 1));
  // Tether healing is also offensive in the actual kit runner: rollBlow uses
  // the shared fallback multiplier when that hybrid has no explicit mult.
  const damaging = !!st.mult || !['buff', 'party', 'revive', 'seed', 'passive'].includes(base.type);
  let damage = null;
  if (damaging) {
    const mult = st.mult ?? RULES.kit.fallbackMult;
    const armor = Math.max(0, Number(defense.def) || 0) * (kind === 'magic' ? .25 : .5);
    const low = Math.max(1, power * mult * .9 - armor), high = Math.max(1, power * mult * 1.1 - armor);
    const critMultiplier = stats.critDmg ?? 1.5;
    const hitChance = kind === 'magic' && !stats.mob ? 1 : hitChanceOf(stats.accuracy, defense.eva || 0);
    damage = { kind, power, mult, armor, hits, hitChance, critChance: stats.critRate ?? 0, critMultiplier,
      normal: [Math.round(low), Math.round(high)], crit: [Math.round(low * critMultiplier), Math.round(high * critMultiplier)],
      total: [Math.round(low) * hits, Math.round(high) * hits],
      formula: 'round(max(1, power × multiplier × random(0.9,1.1) − DEF × armorFactor) × criticalMultiplier)',
      conditional: true };
  }
  const self = selfEffects(id, lv, stats.def ?? 10, stats.matk ?? 0, stats.healPow ?? 1);
  const support = supportOf(id, lv, stats.def ?? 10, stats.matk ?? 0, stats.healPow ?? 1);
  return { id, level: lv, type: base.type, targetKnown: known, defense: known ? { ...defense } : null,
    assumption: known ? 'target-defense' : 'before-armor', damage,
    mp: Math.round(cast.mp * (stats.mpCostMul ?? 1)),
    cooldown: cast.cd * (1 - (stats.cooldownCut ?? 0)), cast: cast.cast * (1 - (stats.castSpeed ?? 0)),
    range: cast.range, splash: cast.splash, self, support,
    healHp: self ? Math.round((stats.maxHp ?? 0) * self.heal) + self.hp : 0,
    restoreMp: self ? Math.round((stats.maxMp ?? 0) * self.mp) : 0,
    duration: (st.duration ?? 0) / 1000,
    effects: hitEffects(id, 1), effectSpec: base.effect ?? null,
    // The damage estimate above is unconditional. Show the setup separately so
    // players can compare a solo cast with a cast that uses a teammate's control.
    synergy: base.synergy ?? null,
    stats: st };
}
