// Active statuses belong to monster instances, never shared definitions.
export function strongest(monster, field) {
  return Math.min(.6, Math.max(0, ...(monster?.debuffs ?? []).filter(d => Number.isFinite(d.remaining) && d.remaining > 0 && Number.isFinite(d[field])).map(d => d[field])));
}
export function effectiveDefense(value) {
  const live = value?.def && typeof value.def === 'object' ? value : null;
  const def = live ? live.def : value;
  return { def: (def?.def ?? 0) * (1 - strongest(live, 'armorBreak')), eva: def?.eva ?? 0 };
}
export const monsterAttackMul = monster => 1 - strongest(monster, 'weak');
export function synergyBonus(synergy, target) {
  if (!Array.isArray(synergy?.conditions) || !Number.isFinite(synergy.damageBonus)) return 0;
  return (target?.debuffs ?? []).some(d => Number.isFinite(d.remaining) && d.remaining > 0 && synergy.conditions.includes(d.id)) ? Math.max(0, Math.min(.25, synergy.damageBonus)) : 0;
}

// Defensive debuffs from different casters/skills expire independently.
export function sameStatusSource(a, b) {
  return a.id === b.id && (!['weak', 'armorBreak'].includes(b.id) || (a.by === b.by && a.sourceSkill === b.sourceSkill));
}
