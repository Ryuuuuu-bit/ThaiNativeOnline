// The caller supplies the player's actual channel world, never a browser map.
export function locateAutoTarget(world, player, { elites = true, attackers = true, exclude = [] } = {}) {
  if (!world || !player || player.dead) return null;
  const skipped = new Set(Array.isArray(exclude) ? exclude.slice(0, 64) : []);
  const score = m => Math.hypot(m.x - player.x, m.z - player.z)
    - (elites && (m.def?.boss || m.def?.elite) ? 3 : 0)
    - (attackers && m.target === player.id ? 1000 : 0);
  const candidates = world.monsters.filter(m => m.hp > 0 && m.state !== 'dormant' && m.state !== 'dead' && !skipped.has(m.id));
  const target = candidates.sort((a, b) => score(a) - score(b))[0];
  return target ? world.info(target) : null;
}
