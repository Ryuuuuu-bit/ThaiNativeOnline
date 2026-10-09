// Player trade (RO style): two signed-in players face to face swap items from the bag and gold.
// Pure logic, no sockets (server/index.js wires it). The server's own characters
// (server/combatants.js) are the only truth: an offer names items the way ops do (id, qty,
// cards, plus) and is checked against the bag; nothing moves until both have locked their
// offer and then both confirmed — changing an offer unlocks both. The swap is tried on copies
// first (bag room, weight), so it either happens whole or not at all.
//
//   const T = new Trades({ now })
//   T.request(from, to) · T.accept(to, from) → trade | { why } · T.of(id) → trade | null
//   T.offer(id, offer, c) → true | why · T.lock(id) · T.confirm(id) → 'wait' | 'swap'
//   T.cancel(id) → trade | null (both sides to tell)
//   swap(ca, cb, offerA, offerB) → { ok } | { ok: false, why }
import { Character } from '../src/character/Character.js';
import { ITEMS } from '../src/character/data/items.js';
import { sameGear } from '../src/character/data/refine.js';
import { isItemLocked } from '../src/character/itemState.js';

export const TRADE = { range: 8, maxItems: 10, requestSecs: 30 };
const empty = () => ({ items: [], gold: 0 });

export class Trades {
  constructor({ now = () => Date.now() / 1000 } = {}) {
    this.now = now; this.requests = new Map(); this.trades = new Map(); this.byPlayer = new Map(); this.nextId = 1;
  }
  of(id) { return this.trades.get(this.byPlayer.get(id)) ?? null; }
  other(t, id) { return t.a === id ? t.b : t.a; }
  request(from, to) {
    if (from === to) return 'self';
    if (this.of(from) || this.of(to)) return 'busy';
    const list = (this.requests.get(to) ?? []).filter(r => r.from !== from && this.now() - r.at < TRADE.requestSecs);
    list.push({ from, at: this.now() }); this.requests.set(to, list);
    return null;
  }
  accept(to, from) {
    const list = this.requests.get(to) ?? [], r = list.find(x => x.from === from && this.now() - x.at < TRADE.requestSecs);
    this.requests.set(to, list.filter(x => x !== r));
    if (!r) return { why: 'expired' };
    if (this.of(from) || this.of(to)) return { why: 'busy' };
    const t = { id: this.nextId++, a: from, b: to, offer: { [from]: empty(), [to]: empty() }, locked: new Set(), confirmed: new Set() };
    this.trades.set(t.id, t); this.byPlayer.set(from, t.id); this.byPlayer.set(to, t.id);
    return t;
  }
  decline(to, from) { this.requests.set(to, (this.requests.get(to) ?? []).filter(x => x.from !== from)); }
  // a new offer (the whole of it) from player `id`, checked against their character `c`
  offer(id, offer, c) {
    const t = this.of(id); if (!t) return 'no_trade';
    const clean = cleanOffer(offer); if (!clean) return 'bad_offer';
    const why = offerWhy(c, clean); if (why) return why;
    t.offer[id] = clean; t.locked.clear(); t.confirmed.clear();
    return true;
  }
  lock(id) { const t = this.of(id); if (!t) return false; t.locked.add(id); return true; }
  // both locked, then both confirm: 'swap' once the second one does
  confirm(id) {
    const t = this.of(id); if (!t || t.locked.size < 2) return null;
    t.confirmed.add(id);
    return t.confirmed.size === 2 ? 'swap' : 'wait';
  }
  cancel(id) {
    this.requests.delete(id);
    const t = this.of(id); if (!t) return null;
    this.trades.delete(t.id); this.byPlayer.delete(t.a); this.byPlayer.delete(t.b);
    return t;
  }
}

// An offer as sent: at most TRADE.maxItems entries { id, qty, cards?, plus? } and whole gold.
export function cleanOffer(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.items) || o.items.length > TRADE.maxItems) return null;
  const gold = Math.floor(Number(o.gold) || 0); if (gold < 0) return null;
  const items = [];
  for (const e of o.items) {
    const def = ITEMS[e?.id]; if (!def) return null;
    const qty = def.type === 'equip' ? 1 : Math.floor(Number(e.qty) || 0); if (qty < 1) return null;
    items.push({ id: e.id, qty, ...(Array.isArray(e.cards) && e.cards.length ? { cards: e.cards.map(String) } : {}), ...(Number.isInteger(e.plus) && e.plus > 0 ? { plus: e.plus } : {}) });
  }
  return { items, gold };
}
// Can `c` give all of it? → null, or why not.
export function offerWhy(c, o) {
  if (o.gold > c.gold) return 'gold';
  const bag = c.inventory.map(s => s && { ...s });
  for (const e of o.items) if (!take(bag, e)) return 'missing';
  return null;
}
// Takes one offer entry out of a bag (an array of slots, changed in place) → the instance, or null.
function take(bag, e) {
  if (ITEMS[e.id].type === 'equip') {
    const i = bag.findIndex(s => s?.id === e.id && !isItemLocked(s) && sameGear(s, e.cards, e.plus)); if (i < 0) return null;
    const s = bag[i]; bag[i] = null; return s;
  }
  if (bag.reduce((n, s) => n + (s?.id === e.id && !isItemLocked(s) ? s.qty : 0), 0) < e.qty) return null;
  for (let left = e.qty, i = 0; left > 0; i++) {
    const s = bag[i]; if (s?.id !== e.id || isItemLocked(s)) continue;
    const n = Math.min(left, s.qty); s.qty -= n; left -= n; if (!s.qty) bag[i] = null;
  }
  return { id: e.id, qty: e.qty };
}
const exchange = (ca, cb, oa, ob) => {
  const got = { a: [], b: [] };
  for (const e of oa.items) { const s = take(ca.inventory, e); if (!s) return 'missing'; got.b.push(s); }
  for (const e of ob.items) { const s = take(cb.inventory, e); if (!s) return 'missing'; got.a.push(s); }
  if (ca.gold < oa.gold || cb.gold < ob.gold) return 'gold';
  ca.gold += ob.gold - oa.gold; cb.gold += oa.gold - ob.gold;
  for (const s of got.a) if (!ca.addInstance(s)) return 'room_a';
  for (const s of got.b) if (!cb.addInstance(s)) return 'room_b';
  return null;
};
// The swap itself: on copies first, then for real.
export function swap(ca, cb, oa, ob) {
  const copy = c => new Character(JSON.parse(JSON.stringify(c.toJSON())));
  const why = exchange(copy(ca), copy(cb), oa, ob);
  if (why) return { ok: false, why };
  exchange(ca, cb, oa, ob);
  for (const c of [ca, cb]) { c.emit('inventory'); c.emit('change'); }
  return { ok: true };
}
