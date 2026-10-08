export const RECALL_COOLDOWN = 30;
export function recallWhy(p, { fighting = false, duel = false, trade = false, now = Date.now() / 1000 } = {}) {
  if (!p) return 'offline';
  if (p.dead) return 'dead';
  if (p.map === 'city') return 'city';
  if (fighting || duel || trade) return 'busy';
  if (now - (p.recallAt ?? -Infinity) < RECALL_COOLDOWN) return 'cooldown';
  return null;
}
