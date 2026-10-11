// A single healer link. Both offline prediction and the server advance this timer;
// position, party membership and ownership are checked by their callers.
export function createTether(effect) {
  if (!effect || !Number.isFinite(effect.amount) || effect.amount <= 0 ||
      !Number.isFinite(effect.every) || effect.every <= 0 ||
      !Number.isFinite(effect.duration) || effect.duration <= 0 ||
      !Number.isFinite(effect.near) || effect.near < 0 ||
      !Number.isFinite(effect.nearMul) || effect.nearMul <= 0 ||
      !Number.isFinite(effect.breakAt) || effect.breakAt < effect.near) return null;
  return { ...effect, elapsed: 0, ticks: 0 };
}

export function advanceTether(link, dt, distance = 0) {
  if (!link || !Number.isFinite(distance) || distance < 0 || distance > link.breakAt) return { hp: 0, done: true };
  if (!Number.isFinite(dt) || dt <= 0) return { hp: 0, done: link.elapsed >= link.duration };
  link.elapsed = Math.min(link.duration, link.elapsed + dt);
  const ticks = Math.floor((link.elapsed + 1e-9) / link.every);
  const due = Math.max(0, ticks - link.ticks);
  link.ticks = ticks;
  const multiplier = distance <= link.near ? link.nearMul : 1;
  return { hp: due * Math.round(link.amount * multiplier), done: link.elapsed >= link.duration };
}
