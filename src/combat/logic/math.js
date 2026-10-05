// Pure combat math. No three.js — runs under `node --test`.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * attack * multiplier * (1 ± variance) [* critMultiplier] - defense, rounded, min 1.
 * rng is injectable for deterministic tests; it is called once for variance and
 * once more for the crit roll only when critChance > 0.
 */
export function computeDamage({
  attack,
  multiplier = 1,
  defense = 0,
  variance = 0.1,
  critChance = 0,
  critMultiplier = 1.5,
  rng = Math.random,
}) {
  const roll = 1 + variance * (rng() * 2 - 1);
  const crit = critChance > 0 && rng() < critChance;
  const raw = attack * multiplier * roll * (crit ? critMultiplier : 1) - defense;
  return { amount: Math.max(1, Math.round(raw)), crit };
}

/** Clamp-based resource pool helpers (HP / MP). Return the amount actually changed. */
export function spend(pool, key, maxKey, amount) {
  const before = pool[key];
  pool[key] = clamp(before - amount, 0, pool[maxKey]);
  return before - pool[key];
}

export function restore(pool, key, maxKey, amount) {
  const before = pool[key];
  pool[key] = clamp(before + amount, 0, pool[maxKey]);
  return pool[key] - before;
}
