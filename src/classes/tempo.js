// Skill tempo: every class plays its skill clips faster than they were authored, so
// casts feel snappy and the player is not left standing in a mob.
//   tempo(list, k, quick) → the moves list with clip `speed` k, and `duration` / `hits`
//   (seconds from the clip start) divided by k, so the kits' FX stay on the blows.
//   Ids in `quick` (buffs, party blessings) are marked quick: they lock the player for
//   at most QUICK_LOCK seconds (the effect lands on the press, see the kits' R.cast) and
//   the rest of the clip is cancelled as soon as the player walks (src/classes/model.js).
export const CLASS_TEMPO = { muaythai: 1.2, warrior: 1.25, hunter: 1.25, shaman: 1.3, herbalist: 1.3 };
export const QUICK_LOCK = .45;

export function tempo(list, k, quick = []) {
  const q = new Set(quick), r = x => Math.round(x / k * 1000) / 1000;
  return list.map(s => ({ ...s, speed: k, authored: s.duration, duration: r(s.duration), hits: s.hits.map(r), ...(q.has(s.id) ? { quick: true } : {}) }));
}

// How long a cast holds the player: the kit's own busy time (authored seconds) at the
// clip's speed, never past the clip itself; quick skills only QUICK_LOCK.
export function lockTime(m, dur) {
  const t = Math.min(dur / (m?.speed || 1), m?.duration ?? Infinity);
  return m?.quick ? Math.min(t, QUICK_LOCK) : t;
}
