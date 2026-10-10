// Canonical direct blows for the playable kits. FX release markers alone do
// not describe all focused projectiles or repeated AoE pulses.
import { SKILL_BY_ID } from './data/skills.js';
import './data/evolutions.js';

export function skillHitSchedule(kitSkill, skillId = kitSkill.id) {
  const base = SKILL_BY_ID[skillId] ?? {};
  if (['buff', 'party', 'revive', 'seed', 'passive'].includes(base.type)) return [];
  const authored = [...(kitSkill.hits ?? [0])];
  if (!authored.length) authored.push(0);
  // The offensive tether previously delivered periodic blows alongside its
  // recovery. Alternating bottle bounces hit enemies on hops 1, 3 and 5.
  if (base.type === 'tether' && base.heals && base.tick && base.duration) {
    return Array.from({ length: Math.max(1, Math.floor(base.duration / base.tick)) }, (_, i) => authored[0] + i * base.tick / 1000);
  }
  if (base.type === 'bounce' && base.bounces) {
    return Array.from({ length: Math.ceil(base.bounces / 2) }, (_, i) => authored[0] + .38 + i * .76);
  }
  // A fan's projectiles cover different targets; a narrow/focused volley can
  // land every projectile on its primary. Rules hits describe repeated waves.
  const focused = base.type === 'projectile' && (base.spread ?? 0) < 20 ? base.count ?? 1 : 1;
  const count = Math.max(authored.length, base.hits ?? 1, focused);
  if (count === authored.length) return authored;
  const gap = Math.max(.04, (base.interval ?? 80) / 1000);
  return Array.from({ length: count }, (_, i) => authored[0] + i * gap);
}
