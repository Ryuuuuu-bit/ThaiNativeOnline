// Pure rules for a class skill kit (src/classes CLASS_KITS) fighting combat
// monsters: what a cast costs and reaches, one blow against a monster, who else
// an area skill hits, and the skill's side effects as Character buffs and Combat
// debuffs. Everything comes from the rules skill table (src/rules/data/skills.js,
// matched by skill id) and RULES.kit (src/combat/data/rules.js). No three, no DOM.
import { SKILL_BY_ID, skillStats } from '../rules/data/skills.js';
import { rollDamage } from '../rules/stats.js';
import { RULES } from '../combat/data/rules.js';
import { rollSkill, skillMult } from './damage.js';

const KIT = RULES.kit;
const metres = px => px / KIT.pxPerMeter;
// Rules skill types that act on the caster (no target needed).
const SELF_TYPES = new Set(['buff', 'party', 'revive']);

// Who else an area skill hits: { radius (m), around: 'self' | 'target' }, a piercing shot's
// line { line: true, length, width } or a spread volley's fan { cone: true, length, angle }
// (both from the caster toward the target), or null.
export function splashOf(base) {
  if (!base) return null;
  if (base.type === 'projectile' && base.pierce) return { line: true, length: metres(base.range ?? 280), width: 1.1 };
  if (base.type === 'projectile' && (base.count ?? 1) > 1 && (base.spread ?? 0) >= 20) return { cone: true, length: metres(base.range ?? 280), angle: base.spread * Math.PI / 180 };
  if ((base.type === 'aoe' || base.type === 'mortar') && base.radius) return { radius: metres(base.radius), around: base.offset ? 'target' : 'self' };
  if (base.type === 'dash' && base.radius) return { radius: metres(base.radius), around: 'target' };
  if (base.type === 'melee' && base.all) return { radius: Math.max(1.5, metres(base.range ?? 0)), around: 'target' };
  return null;
}

// A kit hotbar entry ({ id, cd | cooldown, mp? }) at a skill level →
// { mp, cd (s), range (m), needsTarget, splash }. The rules' mp/cd (scaled by skill level)
// win, so kits and the rules never disagree; the kit's own only fill skills the rules lack.
export function castInfo(kitSkill, lv = 1) {
  const base = SKILL_BY_ID[kitSkill.id], st = base ? skillStats(base, lv) : {};
  const px = base?.range ?? base?.distance ?? (base?.offset ? base.offset + (base.radius ?? 0) : 0);
  return {
    mp: base ? st.mp ?? 0 : kitSkill.mp ?? 0,
    cd: st.cd ? st.cd / 1000 : kitSkill.cd ?? kitSkill.cooldown ?? 0,
    range: Math.min(KIT.maxRange, Math.max(KIT.minRange, metres(px))),
    needsTarget: !base || !SELF_TYPES.has(base.type),
    splash: splashOf(base),
  };
}

export const monsterDefense = def => ({ def: def?.def ?? 0, eva: def?.eva ?? 0 });

// One blow of `skillId` against a defense { def, eva } → { hit, crit, dmg }.
// A skill without a rules damage multiplier (a buff whose effect still strikes)
// hits at RULES.kit.fallbackMult instead of the effect's hand-tuned number.
export function rollBlow(derived, defense, skillId, lv = 1, rng = Math.random) {
  if (skillMult(skillId, lv) !== null) return rollSkill(derived, defense, skillId, lv, rng);
  return rollDamage(derived, defense, SKILL_BY_ID[skillId]?.kind || 'physical', KIT.fallbackMult, rng);
}

// The caster's side of a cast: { heal (share of max HP), mp (share of max MP), buff } or null.
// buff is a Character buff ({ id, duration, atk?, def?, crit? }, src/character/Character.js);
// a flat rules DEF bonus becomes a share of the caster's own DEF (`ownDef`).
export function selfEffects(skillId, lv = 1, ownDef = 10) {
  const base = SKILL_BY_ID[skillId];
  if (!base) return null;
  const st = skillStats(base, lv), b = st.buff, seconds = (st.duration ?? 0) / 1000;
  const heal = typeof st.heal === 'number' ? st.heal : 0, mp = st.mpHeal ?? 0;
  let buff = null;
  if (b && seconds > 0) {
    buff = { id: `kit_${skillId}`, duration: seconds };
    if (b.atkMul) buff.atk = b.atkMul;
    const def = (b.defMul ?? 0) + (b.def ? b.def / Math.max(10, ownDef) : 0);
    if (def) buff.def = +def.toFixed(3);
    if (b.critAdd) buff.crit = b.critAdd;
    if (b.aspd) buff.aspd = b.aspd;
  }
  return heal || mp || buff ? { heal, mp, buff } : null;
}

// The target's side: Combat debuffs (src/combat/Combat.js debuff()) from the rules
// `effect`; damage over time ticks each second for ratio × the first blow.
const DOT_LABELS = { poison: 'ติดพิษ', bleed: 'เลือดไหล', burn: 'ไฟลุก' };
export function hitEffects(skillId, firstBlow) {
  const e = SKILL_BY_ID[skillId]?.effect;
  if (!e) return [];
  const out = [];
  if (e.stun) out.push({ id: 'stun', stun: true, duration: e.stun.ms / 1000, label: 'มึน' });
  if (e.slow) out.push({ id: 'slow', slow: e.slow.pct, duration: e.slow.ms / 1000, label: 'เชื่องช้า' });
  for (const k of Object.keys(DOT_LABELS)) {
    const d = e[k];
    if (d) out.push({ id: k, dot: +(d.ratio * 1000 / d.every).toFixed(3), duration: d.ticks * d.every / 1000, source: firstBlow, label: DOT_LABELS[k] });
  }
  return out;
}

// Live monsters a line / fan from `from` toward `to` covers (see splashOf), nearest first, leaving out `except`.
export function inShape(monsters, from, to, sp, except = null) {
  const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const d = m => Math.hypot(m.x - from.x, m.z - from.z);
  return monsters.filter(m => {
    if (m === except || !m.alive) return false;
    const px = m.x - from.x, pz = m.z - from.z, along = px * ux + pz * uz, side = Math.abs(px * uz - pz * ux);
    if (along < 0 || along > sp.length) return false;
    return sp.line ? side <= sp.width : Math.atan2(side, along) <= sp.angle / 2;
  }).sort((a, b) => d(a) - d(b));
}

// Live monsters within `radius` of `center` ({ x, z }), nearest first, leaving out `except`.
export function within(monsters, center, radius, except = null) {
  const d = m => Math.hypot(m.x - center.x, m.z - center.z);
  return monsters.filter(m => m !== except && m.alive && d(m) <= radius).sort((a, b) => d(a) - d(b));
}
