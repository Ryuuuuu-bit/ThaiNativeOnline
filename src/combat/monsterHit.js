// What a monster's landed hit does besides damage, and its shield. Shared by the browser
// (src/combat/Combat.js monsterAttack) and the server (server/combatants.js), so both copies of
// a signed-in character agree. Behaviour fields: src/combat/data/monsters.js.
export const SHIELD = .4;                 // share of a blow a shield takes off
export const SHIELD_ARC = Math.PI / 3;    // ±60° in front of the monster
export const KNOCK = 2.5;                 // m a knock throws the player back
export const PULL_TO = 1.6;               // m from the monster a pull leaves the player

// poison: { dot, secs } → a buff that takes `dot` HP a second (Character.tick, never below 1 HP);
// mpDrain → MP lost.
export function afterHit(c, def) {
  if (def.poison) c.addBuff({ id: 'poison', label: 'พิษ', poison: def.poison.dot, duration: def.poison.secs });
  if (def.mpDrain && c.mp > 0) { c.mp = Math.max(0, c.mp - def.mpDrain); c.emit?.('change'); }
}

// Is the attacker at `p` in front of the shield-bearer `m` (facing m.f or m.facing)?
export function shielded(m, p) {
  const f = m.f ?? m.facing ?? 0, a = Math.atan2(p.x - m.x, p.z - m.z);
  return Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f))) < SHIELD_ARC;
}

// Where a knock / pull leaves a player at `p`, or null. canStand(x, z) checks the ground;
// a blocked spot falls back to a shorter move.
export function shoveTo(m, p, { knock = false, pull = false }, canStand = () => true) {
  const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 1;
  const move = pull ? -(d - PULL_TO) : knock ? KNOCK : 0;
  if (Math.abs(move) < .2) return null;
  for (const k of [1, .75, .5, .25]) {
    const x = p.x + dx / d * move * k, z = p.z + dz / d * move * k;
    if (canStand(x, z)) return { x, z };
  }
  return null;
}
