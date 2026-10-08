// Presence: who is online, on which map, where they stand and what they just did.
// Pure logic with no sockets, shared by server/index.js and the tests. Phase 1 of the
// server split (docs/technical/SERVER_SPLIT.md): players see each other and chat;
// combat, saves and the economy still run in each browser for now.
//
// The server trusts nothing it is sent: names and chat are cleaned, numbers must be
// finite and inside the world, a move faster than anyone can walk is refused (the
// player keeps their last good spot), and each socket is rate limited.
//
//   const P = new Presence({ now })
//   P.join(conn, hello, ch?) → { you, roster, joined, map, room, ch }   (hello: name, cls, gender, lv, map, x, z, f)
//   P.move(conn, msg)     → true | false                (msg: x, z, f, m)
//   P.changeMap(conn, m, ch?) → { left: old room, roster, joined, map, room, ch }
//   P.setChannel(conn, ch)    → the same, staying on the map (server/channels.js)
//   P.counts(map) → { [ch]: players } · players are grouped by room ('paddy', 'paddy#2', …):
//   inMap(room) and snapshot(room) take a room id (CH 1's room id is the map id).
//   P.anim(conn, msg)     → relay message | null
//   P.chat(conn, text)    → relay message | null
//   P.leave(conn)         → { map, id, name, account } | null
//   P.allowJump(conn, m)  the next move may be m metres longer (thrown back / dragged by a monster)
//   P.snapshot(map)       → [[id, x, z, f, m], …] of players who moved since the last one
//   P.setTitle(conn, id, trusted?) → { id, title } (the title worn above the name, src/data/titles.js)
import { TITLE_BY_ID } from '../src/data/titles.js';
import { MAPS as MAP_DATA } from '../src/world/maps.js';

export const LIMITS = {
  name: 16, chat: 120, chatEvery: 0.8,      // characters; seconds between chat lines
  speed: 9,                                 // m/s: the fastest run (6.8) with slack for lag
  world: 3000,                              // |x|, |z| bound
  msgsPerSec: 40, maxPlayers: 300,
};
export const CLASSES = ['muaythai', 'warrior', 'hunter', 'shaman', 'herbalist', 'assassin'];
export const MAPS = ['city', 'paddy', 'deep_forest', 'wat_rang', 'klong'];
export const PORTAL_SLACK = 6, BUDGET_SECS = 1.5;   // m: how far from a portal's spot a map change may start / arrive
const roomOf = (map, ch) => (ch > 1 ? `${map}#${ch}` : map);

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lim = LIMITS.world) => (Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
const round = v => Math.round(v * 100) / 100;
const guestTitle = id => (TITLE_BY_ID[id] && !TITLE_BY_ID[id].dynamic ? id : null);

export class Presence {
  constructor({ now = () => Date.now() / 1000, navigation = null } = {}) {
    this.now = now; this.navigation = navigation; this.players = new Map(); this.nextId = 1;
  }
  get count() { return this.players.size; }
  inMap(room) { return [...this.players.values()].filter(p => p.room === room); }
  counts(map) { const o = {}; for (const p of this.players.values()) if (p.map === map) o[p.ch] = (o[p.ch] ?? 0) + 1; return o; }
  // into room `ch` of the player's map (or of msg.map): who is there, and who to tell
  enter(p, ch) {
    p.ch = Math.max(1, Math.floor(ch) || 1); p.room = roomOf(p.map, p.ch);
    return { id: p.id, roster: this.inMap(p.room).filter(o => o !== p).map(o => this.info(o)), joined: this.info(p), map: p.map, room: p.room, ch: p.ch };
  }
  info(p) { return { id: p.id, name: p.name, cls: p.cls, gender: p.gender, lv: p.lv, title: p.title ?? null, x: p.x, z: p.z, f: p.f, m: p.m }; }

  join(conn, h = {}, ch = 1) {
    if (this.players.has(conn)) return null;
    if (this.players.size >= LIMITS.maxPlayers) return { full: true };
    const map = MAPS.includes(h.map) ? h.map : 'city';
    const p = {
      id: this.nextId++, name: clean(h.name, LIMITS.name) || 'ผู้เดินทาง', cls: CLASSES.includes(h.cls) ? h.cls : 'muaythai',
      gender: h.gender === 'female' ? 'female' : 'male', lv: Math.max(1, Math.min(150, Math.floor(Number(h.lv) || 1))),
      map, x: num(h.x) ?? 0, z: num(h.z) ?? 0, f: num(h.f, 10) ?? 0, m: 0, t: this.now(), dirty: true, chatAt: -Infinity,
      title: guestTitle(h.title),
    };
    if (this.navigation && !this.navigation(map).canStand(p.x, p.z)) Object.assign(p, { x: MAP_DATA[map].spawn.x, z: MAP_DATA[map].spawn.z });
    this.players.set(conn, p);
    const r = this.enter(p, ch);
    return { you: p.id, ...r };
  }
  // A move is kept only if it is reachable on foot since the last accepted one.
  move(conn, msg = {}) {
    const p = this.players.get(conn); if (!p) return false;
    const x = num(msg.x), z = num(msg.z), f = num(msg.f, 10), now = this.now();
    if (x === null || z === null || p.dead) return false;
    if (this.navigation && !this.navigation(p.map).clear(p, { x: round(x), z: round(z) })) return false;
    const d = Math.hypot(x - p.x, z - p.z);
    // a distance budget that fills at the top speed on the wall clock, so many small packets
    // cannot add their slack together; an accepted move leaves at most BUDGET_SECS worth saved
    // up (a lag spike), while a refused one lets it keep growing, so a client that fell behind
    // (lost packets) catches up at the top speed instead of being stuck for good
    const cap = LIMITS.speed * BUDGET_SECS;
    p.budget = (p.budget ?? cap) + LIMITS.speed * Math.max(0, now - (p.budgetAt ?? p.t)); p.budgetAt = now;
    if (d > p.budget + (p.slack || 0)) return false;
    if (p.slack && (p.slackUntil < now || d > p.budget)) p.slack = 0;
    p.budget = Math.min(cap, Math.max(0, p.budget - d));
    p.x = round(x); p.z = round(z); if (f !== null) p.f = round(f); p.m = [0, 1, 2].includes(msg.m) ? msg.m : 0; p.t = now; p.dirty = true;
    return true;
  }
  // Walking through a portal (or a respawn): a new room, and a jump the speed check allows once.
  // Only another map, through one of this map's portals (standing by its spot; the portal
  // decides where you arrive), and never while dead. A GM warp sets the position itself (server/gm.js).
  changeMap(conn, msg = {}, ch = 1) {
    const p = this.players.get(conn); if (!p || !MAPS.includes(msg.map) || msg.map === p.map || p.dead) return null;
    const near = (a, bx, bz) => Math.hypot(a.x - bx, a.z - bz) <= PORTAL_SLACK + (a.radius ?? 0);
    const portal = (MAP_DATA[p.map]?.portals ?? []).find(o => o.to === msg.map && near(o.at, p.x, p.z));
    if (!portal) return null;
    const left = p.room;
    p.map = msg.map; p.x = portal.arrive.x; p.z = portal.arrive.z; p.budget = LIMITS.speed * BUDGET_SECS; p.f = num(msg.f, 10) ?? p.f; p.m = 0; p.t = this.now(); p.dirty = true;
    return { left, ...this.enter(p, ch) };
  }
  // Another channel of the same map: same spot, new room.
  setChannel(conn, ch) {
    const p = this.players.get(conn); if (!p) return null;
    const left = p.room; p.dirty = true;
    return { left, ...this.enter(p, ch) };
  }
  allowJump(conn, metres) { const p = this.players.get(conn); if (p) { p.slack = Math.min(400, metres); p.slackUntil = this.now() + 3; } }
  // Down / back up (monsters stop chasing the dead).
  setDead(conn, v) { const p = this.players.get(conn); if (p) p.dead = !!v; return p; }
  // Level shown on the name plate (from the client's own save for now).
  setLevel(conn, lv) { const p = this.players.get(conn); if (p) p.lv = Math.max(1, Math.min(150, Math.floor(Number(lv) || p.lv))); return p ? { id: p.id, lv: p.lv } : null; }
  // The title worn above the name (src/data/titles.js): `trusted` for a signed-in character's own
  // (checked against the server's copy); a guest's may not be a rank title. → { id, title } | null
  setTitle(conn, id, trusted = false) {
    const p = this.players.get(conn); if (!p) return null;
    p.title = trusted ? (TITLE_BY_ID[id] ? id : null) : guestTitle(id);
    return { id: p.id, title: p.title };
  }
  // A move clip to play on everyone else's screen (names are checked by the client's model).
  anim(conn, msg = {}) {
    const p = this.players.get(conn); if (!p) return null;
    const clip = clean(msg.clip, 32); if (!/^[a-z0-9_]+$/.test(clip)) return null;
    const sp = Math.max(.5, Math.min(3, Number(msg.sp) || 1));
    return { t: 'a', id: p.id, clip, sp, map: p.room };
  }
  chat(conn, text) {
    const p = this.players.get(conn); if (!p) return null;
    const line = clean(text, LIMITS.chat), now = this.now();
    if (!line || now - p.chatAt < LIMITS.chatEvery) return null;
    p.chatAt = now;
    return { t: 'c', id: p.id, name: p.name, title: p.title ?? null, map: p.map, text: line };
  }
  leave(conn) {
    const p = this.players.get(conn); if (!p) return null;
    this.players.delete(conn);
    return { map: p.room, id: p.id, name: p.name, account: p.account ?? null };
  }
  snapshot(room) {
    const out = [];
    for (const p of this.players.values()) if (p.room === room && p.dirty) { out.push([p.id, p.x, p.z, p.f, p.m]); p.dirty = false; }
    return out;
  }
}

// Per-socket message budget: a token bucket refilled at LIMITS.msgsPerSec.
export function rateLimiter(now = () => Date.now() / 1000, rate = LIMITS.msgsPerSec) {
  let tokens = rate, last = now();
  return () => { const t = now(); tokens = Math.min(rate, tokens + (t - last) * rate); last = t; if (tokens < 1) return false; tokens -= 1; return true; };
}
