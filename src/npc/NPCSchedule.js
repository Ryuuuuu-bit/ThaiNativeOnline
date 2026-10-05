// Behaviour states and schedule helpers. A schedule maps the world phase
// (morning/day/evening/night) to an activity; missing phases fall back to `day`.
export const STATE = { IDLE: 'idle', WALK: 'walk', TALK: 'talk', WORK: 'work', SIT: 'sit' };
export const STATE_NAMES = { idle: 'ยืนพัก', walk: 'เดิน', talk: 'สนทนา', work: 'ทำงาน', sit: 'นั่ง' };

export function activityFor(def, phase) {
  const s = def.schedule ?? {};
  return s[phase] ?? s.day ?? { do: 'home' };
}

// Route entries are either a node id (walk through) or a stop object.
export function normalizeStops(stops) {
  return stops.map(s => (typeof s === 'string' ? { at: s } : s));
}
