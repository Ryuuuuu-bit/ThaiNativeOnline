// HP has priority, but an unavailable HP flask must not starve MP recovery.
// Return only a successful use so the caller starts its wait after real recovery.
export function useAutoFlask(character, settings) {
  if (!character?.alive) return null;
  for (const [kind, threshold, value, maximum] of [
    ['hp', settings.hpPotion, character.hp, character.maxHp],
    ['mp', settings.mpPotion, character.mp, character.maxMp],
  ]) {
    if (threshold > 0 && maximum > 0 && value / maximum * 100 < threshold && character.useFlask(kind)) return kind;
  }
  return null;
}
