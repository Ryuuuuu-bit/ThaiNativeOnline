// The temple grounds in นครอโยธยา (src/data/templeGrounds.js): the bell tower and the Bodhi tree.
// Neither gives items, gold or buffs; they are a shared moment in the city.
//
//   const temple = new TempleGrounds({ mask })   mask(text) hides rude words (chat-guard.js)
//   temple.ring(p, s, { now })  → { ok, why?, wait?, ring? }   ring = { t: 'bell', name, strikes }
//     a player near the tower rings it; everyone in the city hears it (index.js sends `ring`)
//   temple.wish(p, s, m, { now, muted }) → { ok, why?, wait?, wish? }  wish = { id, name, text, at }
//     a signed-in player near the tree ties a short wish; the newest few float over the tree
//   temple.list(now) → the wishes still showing
//
// `p` is the presence entry ({ id, name, account?, map, x, z }), `s` the combatant session.
import { TEMPLE_BELL, TEMPLE_BODHI, templeReach } from '../src/data/templeGrounds.js';

// a little slack over the client's own range: positions arrive a move behind
export const TEMPLE_SLACK = 1.2;
const PRUNE_AT = 500;

export function cleanWish(text, max = TEMPLE_BODHI.maxLength) {
  const flat = String(text ?? '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...flat].slice(0, max).join('').trim();
}

export class TempleGrounds {
  constructor({ mask = t => t, bell = TEMPLE_BELL, bodhi = TEMPLE_BODHI } = {}) {
    Object.assign(this, { mask, bell, bodhi });
    this.rung = new Map(); this.tied = new Map();
    this.cityRung = -Infinity; this.wishes = []; this.seq = 0;
  }
  near(p, site) { return p?.map === 'city' && Number.isFinite(p.x) && Number.isFinite(p.z) && templeReach(site, p.x, p.z) <= site.range + TEMPLE_SLACK; }
  // one key per person: the account when signed in, else the connection
  key(p, s) { return s?.persist && p.account ? `a:${p.account}` : `s:${p.id}`; }
  check(p, s, site, last, cooldown, now) {
    if (!p || !s?.c) return { ok: false, why: 'offline' };
    if (s.c.alive === false) return { ok: false, why: 'dead' };
    if (!this.near(p, site)) return { ok: false, why: 'far' };
    const wait = (last.get(this.key(p, s)) ?? -Infinity) + cooldown - now;
    if (wait > 0) return { ok: false, why: 'cooldown', wait: Math.ceil(wait / 1000) };
    return null;
  }
  remember(map, key, now, cooldown) {
    map.set(key, now);
    if (map.size > PRUNE_AT) for (const [k, t] of map) if (now - t >= cooldown) map.delete(k);
  }

  ring(p, s, { now = Date.now() } = {}) {
    const no = this.check(p, s, this.bell, this.rung, this.bell.playerCooldownMs, now);
    if (no) return no;
    // someone else just rang it: the tower is still humming
    const hum = this.cityRung + this.bell.cityCooldownMs - now;
    if (hum > 0) return { ok: false, why: 'ringing', wait: Math.ceil(hum / 1000) };
    this.remember(this.rung, this.key(p, s), now, this.bell.playerCooldownMs);
    this.cityRung = now;
    return { ok: true, ring: { t: 'bell', name: String(p.name ?? ''), strikes: this.bell.strikes } };
  }

  wish(p, s, m, { now = Date.now(), muted = false } = {}) {
    if (p && s?.c && !s.persist) return { ok: false, why: 'guest' };
    if (p && muted) return { ok: false, why: 'muted' };
    const no = this.check(p, s, this.bodhi, this.tied, this.bodhi.playerCooldownMs, now);
    if (no) return no;
    const text = cleanWish(m?.text, this.bodhi.maxLength);
    if (!text) return { ok: false, why: 'empty' };
    this.remember(this.tied, this.key(p, s), now, this.bodhi.playerCooldownMs);
    const wish = { id: ++this.seq, name: String(p.name ?? ''), text: this.mask(text), at: now };
    this.wishes.push(wish);
    this.prune(now);
    return { ok: true, wish: { ...wish } };
  }

  prune(now) {
    this.wishes = this.wishes.filter(w => now - w.at < this.bodhi.lifeMs).slice(-this.bodhi.keep);
  }
  list(now = Date.now()) { this.prune(now); return this.wishes.map(w => ({ ...w })); }
}
