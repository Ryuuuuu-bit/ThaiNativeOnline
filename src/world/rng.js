// A fixed seed keeps terrain, collision, the minimap and NPC looks reproducible.
export function createRng(seed = 1) {
  let state = (seed >>> 0) || 1;
  const rng = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(a + rng() * (b - a + 1));
  rng.pick = list => list[Math.floor(rng() * list.length)];
  rng.chance = p => rng() < p;
  return rng;
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
