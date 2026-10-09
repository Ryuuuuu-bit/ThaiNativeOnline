// Live debuffs are instance state. Never modify a shared MONSTERS definition.
const strongest = (monster, field) => {
  let pct = 0;
  for (const debuff of monster?.debuffs ?? []) {
    if (Number.isFinite(debuff?.remaining) && debuff.remaining > 0 && Number.isFinite(debuff[field])) {
      pct = Math.max(pct, debuff[field]);
    }
  }
  return Math.min(.6, pct);
};

// Accept a live monster or a bare definition; only instances carry debuffs.
export function effectiveDefense(monsterOrDef) {
  const monster = monsterOrDef?.def && typeof monsterOrDef.def === 'object' ? monsterOrDef : null;
  const definition = monster ? monster.def : monsterOrDef;
  return { def: (definition?.def ?? 0) * (1 - strongest(monster, 'armorBreak')), eva: definition?.eva ?? 0 };
}

export const monsterAttackMul = monster => 1 - strongest(monster, 'weak');
