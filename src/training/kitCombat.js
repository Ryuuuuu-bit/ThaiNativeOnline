// Pure rules for a class skill kit (src/classes CLASS_KITS) fighting combat
// monsters: what a cast costs and reaches, one blow against a monster, who else
// an area skill hits, and the skill's side effects as Character buffs and Combat
// debuffs. Everything comes from the rules skill table (src/rules/data/skills.js,
// matched by skill id) and RULES.kit (src/combat/data/rules.js). No three, no DOM.
import { SKILL_BY_ID, skillStats } from '../rules/data/skills.js';
import { rollDamage } from '../rules/stats.js';
import { RULES } from '../combat/data/rules.js';
import { rollSkill, skillMult } from './damage.js';
import './../rules/data/evolutions.js';   // registers the A/B paths ('<id>@A') and cast times in SKILL_BY_ID

const KIT = RULES.kit;
const metres = px => px / KIT.pxPerMeter;
// Rules skill types that act on the caster (no target needed).
const SELF_TYPES = new Set(['buff', 'party', 'revive']);

// Who else an area skill hits: { radius (m), around: 'self' | 'target' }, a piercing shot's
// line { line: true, length, width } or a spread volley's fan { cone: true, length, angle }
// (both from the caster toward the target), a chain { chain: n, radius } to the n nearest
// around the target (evolution paths), or null. A path may name its `splash` outright (metres).
export function splashOf(base) {
  if (!base) return null;
  if (base.splash) return { ...base.splash };
  if (base.chain) return { chain: base.chain, radius: 4 };
  if (base.type === 'projectile' && base.pierce) return { line: true, length: metres(base.range ?? 280), width: 1.1 };
  if (base.type === 'projectile' && (base.count ?? 1) > 1 && (base.spread ?? 0) >= 20) return { cone: true, length: metres(base.range ?? 280), angle: base.spread * Math.PI / 180 };
  if ((base.type === 'aoe' || base.type === 'mortar') && base.radius) return { radius: metres(base.radius), around: base.offset ? 'target' : 'self' };
  if (base.type === 'dash' && base.radius) return { radius: metres(base.radius), around: 'target' };
  if (base.type === 'melee' && base.all) return { radius: Math.max(1.5, metres(base.range ?? 0)), around: 'target' };
  return null;
}

// A kit hotbar entry ({ id, cd | cooldown, mp? }) at a skill level →
// { mp, cd (s), cast (s, before cast speed), range (m), needsTarget, splash }. Pass an evolved id
// ('<id>@A', src/rules/data/evolutions.js) for a skill on a path. The rules' mp/cd (scaled by skill level)
// win, so kits and the rules never disagree; the kit's own only fill skills the rules lack.
export function castInfo(kitSkill, lv = 1) {
  const base = SKILL_BY_ID[kitSkill.id], st = base ? skillStats(base, lv) : {};
  const px = base?.range ?? base?.distance ?? (base?.offset ? base.offset + (base.radius ?? 0) : 0);
  return {
    mp: base ? st.mp ?? 0 : kitSkill.mp ?? 0,
    cd: st.cd ? st.cd / 1000 : kitSkill.cd ?? kitSkill.cooldown ?? 0,
    cast: (base?.castMs ?? 0) / 1000,
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

// A healing skill's flat heal (the rules `hmult` × the caster's MATK): the tether ticks for its
// whole duration, the bouncing pill lands on a friend every other hop, the mortar's powder once.
export function healPower(skillId, lv = 1, matk = 0) {
  const base = SKILL_BY_ID[skillId];
  if (!base?.heals || !base.hmult || !(matk > 0)) return 0;
  const st = skillStats(base, lv);
  const ticks = base.type === 'tether' ? Math.max(1, Math.floor((st.duration ?? 0) / (base.tick || 500)))
    : base.type === 'bounce' ? Math.ceil((base.bounces ?? 1) / 2) : 1;
  return Math.round(st.hmult * matk * ticks);
}

// The caster's side of a cast: { heal (share of max HP), hp (flat heal, healPower), mp (share of
// max MP), buff } or null. buff is a Character buff ({ id, duration, atk?, def?, crit? },
// src/character/Character.js); a flat rules DEF bonus becomes a share of the caster's own DEF (`ownDef`).
// `healPow`: the caster's healing power (Character.healPow: the herbalist's ตำรับโอสถ and gear), on every heal.
export function selfEffects(skillId, lv = 1, ownDef = 10, matk = 0, healPow = 1) {
  const base = SKILL_BY_ID[skillId];
  if (!base) return null;
  const st = skillStats(base, lv), b = st.buff, seconds = (st.duration ?? 0) / 1000;
  const heal = typeof st.heal === 'number' ? +(st.heal * healPow).toFixed(4) : 0, mp = st.mpHeal ?? 0;
  let buff = null;
  if (b && seconds > 0) {
    buff = { id: `kit_${skillId}`, duration: seconds };
    if (b.atkMul) buff.atk = b.atkMul;
    const def = (b.defMul ?? 0) + (b.def ? b.def / Math.max(10, ownDef) : 0);
    if (def) buff.def = +def.toFixed(3);
    if (b.critAdd) buff.crit = b.critAdd;
    if (b.aspd) buff.aspd = b.aspd;
  }
  const hp = Math.round(healPower(skillId, lv, matk) * healPow);
  return heal || hp || mp || buff ? { heal, hp, mp, buff } : null;
}

// A heal aimed at one friend (the herbalist's vine and bouncing pill): with a party member picked
// (Combat.ally) it goes to that friend alone, ALLY_FOCUS × as strong, instead of to everyone near.
export const ALLY_FOCUS = 1.5;
export function allyHeal(skillId) {
  const base = SKILL_BY_ID[skillId];
  return !!(base?.heals && base.hmult && (base.type === 'tether' || base.type === 'bounce'));
}

// A support skill's share for the party (ThaiNative's healer, server/index.js): the party and
// revive skills reach every member within `radius` m — the same heal, MP and buff the caster
// gets — and a revive skill brings the fallen ones back with `revive` of their HP. The healing
// skills (vine, pill, mortar: rules `heals` + `hmult`) give the members in reach the same flat `hp`.
export function supportOf(skillId, lv = 1, ownDef = 10, matk = 0, healPow = 1) {
  const base = SKILL_BY_ID[skillId];
  const area = base && (base.party || base.type === 'revive'), healing = !!(base?.heals && base.hmult);
  if (!area && !healing) return null;
  const e = selfEffects(skillId, lv, ownDef, matk, healPow) ?? { heal: 0, hp: 0, mp: 0, buff: null };
  const radius = metres(area ? base.radius ?? 200 : Math.max(base.range ?? 0, 220));
  return { radius, heal: e.heal, hp: e.hp, mp: e.mp, buff: e.buff, revive: base.type === 'revive' ? Math.max(.2, e.heal || .3) : 0 };
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
