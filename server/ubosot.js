// ไหว้พระเสี่ยงเซียมซี in the ordination hall (map ubosot, src/world/ubosot.js): the server
// draws the card and keeps the once-a-day rule (src/character/blessing.js). The client
// sends { t: 'bless', site, request } from a UBOSOT_SITES approach; the reply is
// { t: 'bless_result', request, ok, why?, blessing? } and a `sync` carries the saved field.
import { UBOSOT_SITES, UBOSOT_RANGE } from '../src/world/ubosot.js';
import { grantBlessing } from '../src/character/blessing.js';

// a little slack over the client's own range: positions arrive a move behind
export const BLESS_SLACK = 1.2;

export function blessRequest(p, s, m, { now = Date.now(), random = Math.random } = {}) {
  const request = typeof m?.request === 'string' ? m.request.slice(0, 64) : null;
  const reply = (ok, extra = {}) => ({ t: 'bless_result', request, ok, ...extra });
  if (!p || !s?.c) return reply(false, { why: 'offline' });
  if (!s.persist) return reply(false, { why: 'guest' });
  if (!s.c.alive) return reply(false, { why: 'dead' });
  const site = UBOSOT_SITES.find(x => x.id === m?.site);
  if (!site || p.map !== 'ubosot' || Math.hypot(p.x - site.approach.x, p.z - site.approach.z) > UBOSOT_RANGE + BLESS_SLACK)
    return reply(false, { why: 'far' });
  const r = grantBlessing(s.c, { now, random });
  if (!r.ok) return reply(false, { why: r.why, blessing: r.blessing ? { ...r.blessing } : null });
  s.dirty = true;
  return reply(true, { blessing: { ...r.blessing } });
}
