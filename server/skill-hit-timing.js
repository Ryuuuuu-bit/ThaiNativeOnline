// Server release time, never a client timestamp. Gameplay hitCasts begin after
// the cast bar; castSpeed changes that bar, not the authored hit schedule.
export const HIT_TIME_SLACK = .1;

export function hitDue(cast, now, target) {
  if (!Number.isFinite(now) || now < cast.at || now - cast.at >= cast.window || cast.left <= 0) return false;
  if (now - cast.at + HIT_TIME_SLACK + 1e-9 < cast.schedule[cast.next]) return false;
  // Kits keep their first accepted primary, matching client release timelines.
  // Splash/chain victims are selected separately by the server.
  return !cast.kit || !cast.primary || (cast.primary === target && cast.targetGeneration === (target.strikeGeneration ?? 0));
}

export function consumeHit(cast, target) {
  cast.next++; cast.left--;
  if (cast.kit && !cast.primary) { cast.primary = target; cast.targetGeneration = target.strikeGeneration ?? 0; }
}
