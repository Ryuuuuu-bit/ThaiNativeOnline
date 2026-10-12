// The caller supplies the player's actual channel world, never a browser map.
// `mobs`: the player's hunt list (monster types); a monster already attacking the player is
// still chosen while `attackers` is on.
export function locateAutoTarget(world, player, { elites = true, attackers = true, exclude = [], mobs = null } = {}) {
  if (!world || !player || player.dead) return null;
  const skipped = new Set(Array.isArray(exclude) ? exclude.slice(0, 64) : []);
  const wanted = Array.isArray(mobs) && mobs.length ? new Set(mobs.slice(0, 64).filter(t => typeof t === 'string')) : null;
  const score = m => Math.hypot(m.x - player.x, m.z - player.z)
    - (elites && (m.def?.boss || m.def?.elite) ? 3 : 0)
    - (attackers && m.target === player.id ? 1000 : 0);
  const candidates = world.monsters.filter(m => m.hp > 0 && m.state !== 'dormant' && m.state !== 'dead' && !skipped.has(m.id)
    && (!wanted || wanted.has(m.type) || (attackers && m.target === player.id)));
  const target = candidates.sort((a, b) => score(a) - score(b))[0];
  return target ? world.info(target) : null;
}
