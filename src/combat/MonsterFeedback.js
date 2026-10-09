// Per-instance materials own their colours; texture references remain cached.
const baselines = new WeakMap();

/** Pure feedback selection; hit > curse > stun > slow, then original fill. */
export function monsterFeedbackState(base, { flash = 0, cursed = false, stunned = false, slowed = false } = {}) {
  const emissive = flash > 0 ? '#ff6040' : cursed ? '#4a1a5e' : stunned ? '#4a4214' : slowed ? '#1e3e58' : null;
  return emissive ? {
    emissive, emissiveIntensity: Math.max(1, base.emissiveIntensity), emissiveMap: null,
  } : { ...base };
}

/** Apply broad untextured feedback without touching RGB/death dimming or textures. */
export function applyMonsterFeedback(materials, flags) {
  if (Array.isArray(materials)) {
    for (const material of materials) applyMonsterFeedback(material, flags);
    return;
  }
  const material = materials;
  if (!material?.emissive) return;
  let base = baselines.get(material);
  if (!base) {
    base = {
      emissive: material.emissive.clone(),
      emissiveIntensity: material.emissiveIntensity ?? 1,
      emissiveMap: material.emissiveMap,
    };
    baselines.set(material, base);
  }
  const next = monsterFeedbackState(base, flags);
  if (typeof next.emissive === 'string') material.emissive.set(next.emissive);
  else material.emissive.copy(next.emissive);
  material.emissiveIntensity = next.emissiveIntensity;
  // Removing/restoring the map changes a shader define, not texture ownership.
  if (!!material.emissiveMap !== !!next.emissiveMap) material.needsUpdate = true;
  material.emissiveMap = next.emissiveMap;
}
