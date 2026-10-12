// Presentation weights only; no new regions, contact sites or gameplay rules.
const clamp = n => Math.max(0, Math.min(1, n));
export function citySoundscape(mapId, x, z) {
  if (mapId !== 'city' || !Number.isFinite(x) || !Number.isFinite(z)) return { river: 0, market: 0, temple: 0 };
  return {
    river: clamp((z - 40) / 24),
    market: clamp(1 - Math.hypot(x / 28, (z - 11) / 25)),
    temple: clamp(1 - Math.hypot((x + 52) / 22, (z + 31) / 26)),
  };
}
