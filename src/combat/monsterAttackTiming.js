// Approved clip contact times (seconds), independent of combat stats and rendering.
export const MONSTER_ATTACK_IMPACT = Object.freeze({ tani: 13 / 24, phong: .5 });
export const monsterAttackImpact = type => MONSTER_ATTACK_IMPACT[type] ?? 0;

export function beginMonsterStrike(monster, payload = {}, remaining = monsterAttackImpact(monster.type)) {
  if (monster.strike) return monster.strike;
  const attackId = (monster.strikeSequence ?? 0) + 1;
  monster.strikeSequence = attackId;
  return monster.strike = { ...payload, generation: monster.strikeGeneration ?? 0, attackId, remaining };
}

// Call once per simulation step. Removing before returning makes a release one-shot.
export function tickMonsterStrike(monster, dt, valid = true) {
  const strike = monster.strike;
  if (!strike) return null;
  if (!valid) { monster.strike = null; return null; }
  strike.remaining = Math.max(0, strike.remaining - dt);
  if (strike.remaining > 1e-9) return null;
  monster.strike = null;
  return strike;
}

export function cancelMonsterStrike(monster) {
  const strike = monster.strike;
  monster.strike = null;
  return strike;
}

// Remote authority owns release time; never tick remote strikes into client damage.
export function acceptMonsterStrike(monster, packet, snapshot = false) {
  if (!Number.isSafeInteger(packet.attackId) || packet.attackId < 1 || !Number.isSafeInteger(packet.generation) || packet.generation < 0
    || !Number.isFinite(packet.remaining) || packet.remaining < 0) return false;
  if (packet.generation < (monster.strikeGeneration ?? 0)) return false;
  if (packet.generation > (monster.strikeGeneration ?? 0)) {
    monster.strikeGeneration = packet.generation; monster.strikeSequence = 0; monster.releasedStrike = 0;
  }
  if (packet.attackId <= (monster.releasedStrike ?? 0) || packet.attackId < (monster.strikeSequence ?? 0)
    || (!snapshot && packet.attackId === monster.strikeSequence)) return false;
  monster.strikeSequence = packet.attackId;
  monster.strike = { ...packet };
  return true;
}

export function releaseMonsterStrike(monster, attackId, generation) {
  if (!Number.isSafeInteger(attackId) || attackId < 1 || !Number.isSafeInteger(generation) || generation < 0) return false;
  if (generation < (monster.strikeGeneration ?? 0)) return false;
  if (generation > (monster.strikeGeneration ?? 0)) {
    monster.strikeGeneration = generation; monster.strikeSequence = 0; monster.releasedStrike = 0; monster.strike = null;
  }
  if (attackId <= (monster.releasedStrike ?? 0)) return false;
  monster.releasedStrike = attackId;
  if (monster.strike?.attackId <= attackId) monster.strike = null;
  return true;
}
