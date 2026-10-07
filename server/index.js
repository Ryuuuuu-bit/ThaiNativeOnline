// ThaiNative Online server: serves the built game (dist/) and the realtime link at /ws.
//   npm run build && npm start          (PORT, default 8787)
// Phase 1 (docs/technical/SERVER_SPLIT.md): presence and chat. Phase 2: accounts and
// character saves (server/accounts.js, Postgres via DATABASE_URL) over /api:
//   GET  /api/health → { accounts }        POST /api/register | /api/login {id, password} → { token, id }
//   POST /api/google {credential} → { token, id }   POST /api/google/link {credential} (signed in)
//   POST /api/logout                        GET /api/slots → [{ slot, data, updated }] · GET /api/me → { id, google: {email} | null }
//   PUT  /api/slots/:n  { data }            DELETE /api/slots/:n          (Authorization: Bearer <token>)
// Realtime messages are small JSON objects with a type `t`:
//   client → server  hello {token?, slot?, name, cls, gender, lv, map, x, z, f} · s {x, z, f, m} ·
//                    map {map, x, z, f} · a {clip, sp} · c {text} · lv {lv}
//   server → client  welcome {you, roster, online} · join {p} · leave {id} ·
//                    tick {p: [[id, x, z, f, m], …]} · a {id, clip, sp} · c {id, name, map, text} ·
//                    lv {id, lv} · online {n} · full {}
// Phase 3a (shared monsters, server/monsters.js) and 3b (damage rolled here, server/combatants.js):
//   client → server  ch {data} (character sheet) · casting {skill} (a cast bar starts) · cast {skill} · blow {id, skill, pounce?} (skill: kit id | 'basic' | 'pet') · dead {v}
//   server → client  clock {h} · mlist {m: [...]} · mt {m: [[id, x, z, f, hp, st, mv], …]} · mspawn {m} ·
//                    mgone {id, killed} · mh {id, amount, crit, dot, pet, by} | {id, miss, by} ·
//                    ma {id, power} (a monster swings at you) · kill {id, exp, gold, drops} (your share of a kill) ·
//                    nope {skill, why} (a cast the server refused)
// Phase 3c (a signed-in character's progress is the server's, server/progress.js):
//   client → server  op {n, op, …, hp} (buy / sell / use / equip / unequip / alloc / reset / sort) · resync
//   server → client  sync {c} (the server's character, c.ack = actions replayed, c.quests) · me {hp, mp, ack} (1×/s) · kicked {}
// Phase 4 (signed-in players): ma {id, power, res: {dodge} | {dmg, hp, dead}} — the server resolved the swing;
//   quest_accept / quest_complete / talk ops; buying needs a shop of that kind on the map, out of a fight.
// Channels (server/channels.js): a busy map opens CH 2, 3, … with their own monsters (no elites or
//   bosses past CH 1); quiet ones close after a warning. welcome carries {ch, chs}.
//   client → server  chans (the list) · chan {ch} (switch: out of a fight, once a minute)
//   server → client  chans {map, ch, list: [{ch, n, cap, closing}]} · chno {why} · chwarn {ch, secs} · chmove {ch, why}
// Cards (src/character/data/cards.js): a card in a kill's drops is announced to everyone:
//   server → client  cardnews {name, card, monster}
//   client → server  op {op: 'strip', id, cards, plus} (หมออาคม takes the cards out; rolled here) → stripped {ok, outcome, cards} + sync
//   client → server  op {op: 'refine', worn: slot | id, cards, plus} (ตีบวก, src/character/data/refine.js; rolled here) → refined {ok, outcome, item, to, cards} + sync
//   Buying, strip and refine need the player by an NPC of that shop (src/data/shopSites.js).
// Whisper, online list, friends (signed in; names): w {to, text} → w {from, text} (and {to, text, echo} back) ·
//   who → who {list: [{id, name, cls, lv, map, ch}]} · friends → friends {list: [{name, online, id?, lv?, cls?, map?}]} ·
//   fadd {name} (online now) · fdel {name} · fon / foff {name} when a friend comes or goes
// Healer support: cast {skill} of a party / revive skill → aid {from, skill, heal, mp, buff, revive} to the party members near the caster
// GM (server/gm.js): '/gm …' in chat from an account in ADMIN_IDS → a reply line; may send
//   gmwarp {map, x, z} (go there) · gmhp {pct, mp?} (HP set; 0 = knocked out) · sync
// Parties (server/parties.js): up to 6, EXP of a kill shared by the members near it.
//   client → server  pinv {id} · pans {from, ok} · pleave · pkick {id} · pc {text} (party chat)
//   server → client  pinv {from, name} · pno {why, name?} · party {id, leader, members: [{id, name, cls, lv, hp, map, ch}]} | {id: null} · pc {name, text}
// Trade (server/trades.js): signed-in players within 8 m; offer → both lock → both confirm → swap.
//   client → server  treq {id} · tans {from, ok} · toffer {items: [{id, qty, cards?, plus?}], gold} · tlock · tconf · tcancel
//   server → client  treq {from, name} · tno {why} · trade {id, with, mine, theirs, locked, confirmed} · tend {ok, why} (+ sync)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { Presence, rateLimiter, MAPS } from './presence.js';
import { Channels, CHANNEL, roomOf, parseRoom } from './channels.js';
import { openStore } from './store.js';
import { Accounts } from './accounts.js';
import { MonsterWorld } from './monsters.js';
import { Combatants } from './combatants.js';
import { Parties } from './parties.js';
import { Trades, TRADE, swap } from './trades.js';
import { gm, admins } from './gm.js';
import { FRIENDS_MAX } from '../src/character/Character.js';
import { WorldClock } from '../src/core/WorldClock.js';

const PORT = Number(process.env.PORT) || 8787;
const ROOT = resolve(import.meta.dirname, '..', 'dist');
const TICK = 100;   // ms between position broadcasts
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const store = await openStore(process.env.DATABASE_URL);
const accounts = new Accounts(store, { googleClientId: process.env.GOOGLE_CLIENT_ID || null });

// ---- accounts API -------------------------------------------------------------------------
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, bad) => {
  let n = 0; const parts = [];
  req.on('data', c => { n += c.length; if (n > 300 * 1024) { bad(new Error('too big')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { bad(e); } });
  req.on('error', bad);
});
// login / register attempts: 10 a minute per address
const tries = new Map();
const tooMany = ip => { const now = Date.now(), t = (tries.get(ip) ?? []).filter(x => now - x < 60000); t.push(now); tries.set(ip, t); return t.length > 10; };
async function api(req, res, url) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { accounts: true, store: store.kind, googleClientId: accounts.googleClientId });
    if (req.method === 'POST' && url.pathname === '/api/google') {
      if (tooMany(ip)) return json(res, 429, { ok: false, code: 'slow_down', msg: 'ลองใหม่อีกครั้งในอีกสักครู่' });
      const r = await accounts.google((await readBody(req)).credential);
      return json(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
      if (tooMany(ip)) return json(res, 429, { ok: false, code: 'slow_down', msg: 'ลองใหม่อีกครั้งในอีกสักครู่' });
      const b = await readBody(req);
      const r = url.pathname === '/api/register' ? await accounts.register(b.id, b.password) : await accounts.login(b.id, b.password);
      return json(res, r.ok ? 200 : 400, r);
    }
    const id = await accounts.auth(token);
    if (!id) return json(res, 401, { ok: false, code: 'auth', msg: 'กรุณาเข้าสู่ระบบใหม่' });
    if (req.method === 'POST' && url.pathname === '/api/logout') { await accounts.logout(token); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/api/google/link') { const r = await accounts.linkGoogle(id, (await readBody(req)).credential); return json(res, r.ok ? 200 : 400, r); }
    if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { ok: true, id, google: await store.googleOf(id) });
    if (req.method === 'GET' && url.pathname === '/api/slots') return json(res, 200, { ok: true, id, slots: await accounts.slots(id) });
    const m = /^\/api\/slots\/(\d+)$/.exec(url.pathname);
    if (m && req.method === 'PUT') {
      const slot = Number(m[1]), live = combatants.live(id, slot);   // a character in play: its live copy is the truth
      const r = await accounts.save(id, slot, (await readBody(req)).data, live ? { c: live.c.toJSON(), quests: live.quests.json() } : null);
      if (live) live.dirty = false;
      return json(res, r.ok ? 200 : 400, r);
    }
    if (m && req.method === 'DELETE') { const r = await accounts.remove(id, Number(m[1])); return json(res, r.ok ? 200 : 400, r); }
    return json(res, 404, { ok: false, code: 'not_found' });
  } catch (e) {
    console.warn('api', url.pathname, e.message);
    return json(res, 400, { ok: false, code: 'bad_request', msg: 'คำขอไม่ถูกต้อง' });
  }
}

// ---- static files -----------------------------------------------------------------------
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  if (url.pathname.startsWith('/api/')) { api(req, res, url); return; }
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(path) || statSync(path).isDirectory()) path = join(ROOT, 'index.html');   // the game is one page
  if (!existsSync(path)) { res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); res.end('ยังไม่ได้ build เกม (npm run build)'); return; }
  const hashed = /\/assets\//.test(path);
  res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(path).pipe(res);
});

// ---- realtime -----------------------------------------------------------------------------
const presence = new Presence();
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
const conns = new Map();   // ws → { allow() }
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const toMap = (room, msg, except = null) => { const s = JSON.stringify(msg); for (const [ws] of conns) if (ws !== except && presence.players.get(ws)?.room === room && ws.readyState === 1) ws.send(s); };
const channels = new Channels();
const chs = map => channels.list(map, presence.counts(map));
const pickCh = map => (MAPS.includes(map) ? channels.pick(map, presence.counts(map)) : 1);
// a player to another channel of the same map: like walking through a portal, minus the walk
const moveTo = (ws, ch, why) => {
  const r = presence.setChannel(ws, ch); if (!r) return;
  toMap(r.left, { t: 'leave', id: r.id }, ws);
  send(ws, { t: 'chmove', ch: r.ch, why });
  send(ws, { t: 'welcome', you: r.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
  toMap(r.room, { t: 'join', p: r.joined }, ws);
};
const toAll = msg => { const s = JSON.stringify(msg); for (const [ws] of conns) if (presence.players.has(ws) && ws.readyState === 1) ws.send(s); };

wss.on('connection', ws => {
  conns.set(ws, { allow: rateLimiter() }); ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', async raw => {
    if (!conns.get(ws)?.allow()) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': {
        // a signed-in player is shown as the character the server has saved (name, class, level)
        const id = await accounts.auth(m.token).catch(() => null);
        const saved = id && Number.isInteger(m.slot) ? await accounts.character(id, m.slot).catch(() => null) : null;
        if (saved) Object.assign(m, { name: saved.name, cls: saved.classId, gender: saved.gender, lv: saved.level });
        const r = presence.join(ws, m, pickCh(m.map));
        if (!r) return;
        if (r.full) { send(ws, { t: 'full' }); ws.close(); return; }
        if (id) Object.assign(presence.players.get(ws), { account: id, admin: ADMINS.has(String(id).toLowerCase()) });
        if (saved) {
          // one tab per character: an older socket on the same slot is closed (its copy is saved first)
          const old = combatants.live(id, m.slot);
          if (old) for (const [ows, op] of presence.players) if (combatants.get(op.id) === old) { await flush(op.id); send(ows, { t: 'kicked' }); ows.close(); }
          const fresh = await accounts.character(id, m.slot).catch(() => null) ?? saved;
          combatants.load(r.you, fresh, { account: id, slot: m.slot }, await accounts.quests(id, m.slot).catch(() => '{}'));
          send(ws, { t: 'sync', c: combatants.me(r.you) });
        }
        send(ws, { t: 'welcome', you: r.you, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
        toMap(r.room, { t: 'join', p: r.joined }, ws); toAll({ t: 'online', n: presence.count });
        if (saved) friendNews(presence.players.get(ws), true);
        break;
      }
      case 's': presence.move(ws, m); break;
      case 'pinv': case 'pans': case 'pleave': case 'pkick': case 'pc': partyMsg(ws, m); break;
      case 'w': case 'who': case 'friends': case 'fadd': case 'fdel': socialMsg(ws, m); break;
      case 'treq': case 'tans': case 'toffer': case 'tlock': case 'tconf': case 'tcancel': tradeMsg(ws, m); break;
      case 'map': {
        endTrade(presence.players.get(ws)?.id, 'moved');
        const r = presence.changeMap(ws, m, pickCh(m.map)); if (!r) return;
        toMap(r.left, { t: 'leave', id: r.id }, ws);
        send(ws, { t: 'welcome', you: r.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
        toMap(r.room, { t: 'join', p: r.joined }, ws);
        break;
      }
      case 'chans': { const p = presence.players.get(ws); if (p) send(ws, { t: 'chans', map: p.map, ch: p.ch, list: chs(p.map) }); break; }
      case 'chan': {
        const p = presence.players.get(ws); if (!p) return;
        const ch = Math.floor(Number(m.ch));
        const why = channels.canSwitch(p.map, ch, presence.counts(p.map), { from: p.ch, fighting: combatants.fighting(p.id), dead: !!p.dead, lastAt: p.chanAt ?? -Infinity });
        if (why) { send(ws, { t: 'chno', why }); break; }
        p.chanAt = Date.now() / 1000; endTrade(p.id, 'moved'); moveTo(ws, ch, 'switch');
        break;
      }
      case 'a': { const r = presence.anim(ws, m); if (r) toMap(r.map, r, ws); break; }
      case 'c': {
        const p = presence.players.get(ws); if (!p) return;
        if (/^\/gm(\s|$)/i.test(String(m.text ?? ''))) { send(ws, { t: 'c', id: null, name: '🛠️ GM', text: p.admin ? gm(gmCtx, p, m.text) : 'คำสั่งนี้สำหรับ GM เท่านั้น' }); break; }
        if (muted(p)) { send(ws, { t: 'c', id: null, name: 'ระบบ', text: 'คุณถูกห้ามแชทชั่วคราว' }); break; }
        const r = presence.chat(ws, m.text); if (r) toAll(r); break;
      }
      case 'ch': { const p = presence.players.get(ws); if (p) combatants.set(p.id, m.data, p.cls); break; }
      case 'casting': { const p = presence.players.get(ws); if (p) combatants.casting(p.id, m.skill); break; }
      case 'cast': {
        const p = presence.players.get(ws); if (!p) return;
        const r = combatants.cast(p.id, m.skill);
        if (!r.ok) send(ws, { t: 'nope', skill: m.skill, why: r.why });
        else if (r.support) support(p, m.skill, r.support);
        break;
      }
      case 'blow': { const p = presence.players.get(ws); if (p) { combatants.touch(p.id); route(p.room, combatants.blow(p.id, worldOf(p.room), presence.inMap(p.room), m, clock.phase)); } break; }
      case 'dead': {
        const p = presence.players.get(ws); if (!p) return;
        if (!combatants.get(p.id)?.persist) { presence.setDead(ws, m.v); break; }
        if (!m.v && combatants.respawn(p.id)) presence.setDead(ws, false);   // a signed-in death is the server's call
        break;
      }
      case 'op': {
        const p = presence.players.get(ws); if (!p || !combatants.get(p.id)?.persist) return;
        const ok = combatants.op(p.id, m, { map: p.map, x: p.x, z: p.z });
        // taking cards out and ตีบวก are rolled here: the result, then the character as it is now
        if (m.op === 'strip') { send(ws, { t: 'stripped', ...combatants.get(p.id).stripped }); send(ws, { t: 'sync', c: combatants.me(p.id) }); }
        else if (m.op === 'refine') { send(ws, { t: 'refined', ...combatants.get(p.id).refined }); send(ws, { t: 'sync', c: combatants.me(p.id) }); }
        else if (!ok) send(ws, { t: 'sync', c: combatants.me(p.id) });   // could not replay it: here is the real one
        break;
      }
      case 'resync': { const p = presence.players.get(ws); const c = p && combatants.me(p.id); if (c) send(ws, { t: 'sync', c }); break; }
      case 'lv': {
        if (combatants.get(presence.players.get(ws)?.id)?.persist) return;   // a signed-in level comes from the server
        const r = presence.setLevel(ws, m.lv); const p = presence.players.get(ws); if (r && p) toMap(p.room, { t: 'lv', ...r }, ws); break; }
    }
  });
  ws.on('close', () => {
    conns.delete(ws);
    const r = presence.leave(ws);
    if (r) { endTrade(r.id, 'left'); leaveParty(r.id); if (r.account) friendNews(r, false); }
    if (r) flush(r.id).finally(() => combatants.drop(r.id));
    if (r) { toMap(r.map, { t: 'leave', id: r.id }); toAll({ t: 'online', n: presence.count }); }
  });
});

// ---- parties and trade --------------------------------------------------------------------
const parties = new Parties(), trades = new Trades();
const byId = id => { for (const [ws, p] of presence.players) if (p.id === id) return { ws, p }; return null; };
const PARTY_WHY = new Set(['self', 'in_party', 'not_leader', 'full', 'expired', 'offline']);
function partyState(pid) {
  const party = parties.get(pid); if (!party) return { t: 'party', id: null };
  return { t: 'party', id: party.id, leader: party.leader, members: party.members.map(id => {
    const o = byId(id)?.p, s = combatants.get(id);
    return { id, name: o?.name ?? '?', cls: o?.cls, lv: o?.lv ?? 1, map: o?.map, ch: o?.ch, dead: !!o?.dead, ...(s?.persist ? { hp: Math.round(s.c.hp), maxHp: s.c.maxHp } : {}) };
  }) };
}
const tellParty = (ids, msg) => { for (const id of ids) { const w = byId(id)?.ws; if (w) send(w, msg); } };
const sendParty = pid => tellParty(parties.members(pid), partyState(pid));
function leaveParty(id) {
  const r = parties.leave(id); if (!r) return;
  if (r.party) sendParty(r.party.id);
  else tellParty(r.before.filter(m => m !== id), { t: 'party', id: null });
}
function partyMsg(ws, m) {
  const me = presence.players.get(ws); if (!me) return;
  const no = (why, name) => send(ws, { t: 'pno', why: PARTY_WHY.has(why) ? why : 'expired', ...(name ? { name } : {}) });
  if (m.t === 'pinv') {
    const to = byId(Number(m.id)); if (!to) return no('offline');
    const r = parties.invite(me.id, to.p.id); if (!r.ok) return no(r.why, to.p.name);
    send(to.ws, { t: 'pinv', from: me.id, name: me.name });
  } else if (m.t === 'pans') {
    const from = Number(m.from);
    if (!m.ok) { parties.decline(me.id, from); const f = byId(from); if (f) send(f.ws, { t: 'pno', why: 'declined', name: me.name }); return; }
    const r = parties.accept(me.id, from); if (!r.ok) return no(r.why);
    sendParty(r.party.id);
  } else if (m.t === 'pleave') { leaveParty(me.id); send(ws, { t: 'party', id: null }); }
  else if (m.t === 'pkick') {
    const r = parties.kick(me.id, Number(m.id)); if (!r) return;
    const k = byId(Number(m.id)); if (k) send(k.ws, { t: 'party', id: null });
    if (r.party) sendParty(r.party.id); else tellParty(r.before, { t: 'party', id: null });
  } else if (m.t === 'pc') {
    if (muted(me)) return;
    const pid = parties.of(me.id), r = pid && presence.chat(ws, m.text); if (!r) return;
    tellParty(parties.members(pid), { t: 'pc', name: me.name, text: r.text });
  }
}
// a trade needs both signed in, alive, out of a fight, in the same room within TRADE.range
function tradeWhy(a, b) {
  if (!b) return 'offline';
  if (!combatants.get(a.id)?.persist || !combatants.get(b.id)?.persist) return 'guest';
  if (a.room !== b.room || Math.hypot(a.x - b.x, a.z - b.z) > TRADE.range) return 'far';
  if (a.dead || b.dead || combatants.fighting(a.id) || combatants.fighting(b.id)) return 'busy';
  return null;
}
const offerOut = o => ({ items: o.items, gold: o.gold });
function sendTrade(t) {
  for (const id of [t.a, t.b]) {
    const w = byId(id)?.ws, other = trades.other(t, id); if (!w) continue;
    send(w, { t: 'trade', id: t.id, with: { id: other, name: byId(other)?.p.name ?? '?' }, mine: offerOut(t.offer[id]), theirs: offerOut(t.offer[other]),
      locked: { me: t.locked.has(id), them: t.locked.has(other) }, confirmed: { me: t.confirmed.has(id), them: t.confirmed.has(other) } });
  }
}
function endTrade(id, why, ok = false) {
  const t = id != null && trades.cancel(id); if (!t) return;
  for (const pid of [t.a, t.b]) { const o = byId(pid); if (!o) continue; send(o.ws, { t: 'tend', ok, why }); const c = combatants.me(pid); if (c) send(o.ws, { t: 'sync', c }); }
}
function tradeMsg(ws, m) {
  const me = presence.players.get(ws); if (!me) return;
  const no = why => send(ws, { t: 'tno', why });
  if (m.t === 'treq') {
    const to = byId(Number(m.id)), why = tradeWhy(me, to?.p) ?? trades.request(me.id, to.p.id); if (why) return no(why);
    send(to.ws, { t: 'treq', from: me.id, name: me.name });
  } else if (m.t === 'tans') {
    const from = byId(Number(m.from));
    if (!m.ok) { trades.decline(me.id, Number(m.from)); if (from) send(from.ws, { t: 'tno', why: 'declined' }); return; }
    const why = tradeWhy(me, from?.p); if (why) return no(why);
    const t = trades.accept(me.id, from.p.id); if (t.why) return no(t.why);
    sendTrade(t);
  } else if (m.t === 'tcancel') endTrade(me.id, 'cancelled');
  else {
    const t = trades.of(me.id); if (!t) return;
    if (m.t === 'toffer') { const r = trades.offer(me.id, m, combatants.get(me.id).c); if (r !== true) no(r); }
    else if (m.t === 'tlock') trades.lock(me.id);
    else if (m.t === 'tconf') {
      const other = byId(trades.other(t, me.id)), why = tradeWhy(me, other?.p); if (why) return endTrade(me.id, why);
      if (trades.confirm(me.id) === 'swap') {
        const r = swap(combatants.get(t.a).c, combatants.get(t.b).c, t.offer[t.a], t.offer[t.b]);
        if (r.ok) for (const pid of [t.a, t.b]) { const s = combatants.get(pid); s.dirty = true; flush(pid); }
        return endTrade(me.id, r.ok ? 'done' : r.why, r.ok);
      }
    }
    sendTrade(t);
  }
}
setInterval(() => { for (const party of parties.parties.values()) sendParty(party.id); }, 1000);
// a healer's party / revive skill (src/training/kitCombat.js supportOf): the other members in the
// same room within its radius are healed, buffed and — for a revive — stood back up where they fell
function support(caster, skill, sup) {
  const pid = parties.of(caster.id); if (!pid) return;
  for (const id of parties.members(pid)) {
    if (id === caster.id) continue;
    const o = byId(id); if (!o || o.p.room !== caster.room || Math.hypot(o.p.x - caster.x, o.p.z - caster.z) > sup.radius) continue;
    const r = combatants.aid(id, sup);
    if (r?.revived) presence.setDead(o.ws, false);
    if (r || o.p.dead) send(o.ws, { t: 'aid', from: caster.name, skill, heal: sup.heal, mp: sup.mp, buff: sup.buff, revive: o.p.dead || r?.revived ? sup.revive : 0 });
  }
}

// ---- whisper, who is online, friends ---------------------------------------------------------
const whoList = () => [...presence.players.values()].sort((a, b) => b.lv - a.lv).slice(0, 200).map(p => ({ id: p.id, name: p.name, cls: p.cls, lv: p.lv, map: p.map, ch: p.ch }));
// a signed-in player came or went: tell everyone online who has them as a friend
function friendNews(p, on) {
  for (const [ws, o] of presence.players) if (o !== p && combatants.get(o.id)?.c.friends?.includes(p.name)) send(ws, { t: on ? 'fon' : 'foff', name: p.name });
}
function friendList(id) {
  const s = combatants.get(id), online = new Map([...presence.players.values()].map(p => [p.name, p]));
  return (s?.c.friends ?? []).map(name => { const o = online.get(name); return o ? { name, online: true, id: o.id, lv: o.lv, cls: o.cls, map: o.map } : { name, online: false }; });
}
function socialMsg(ws, m) {
  const me = presence.players.get(ws); if (!me) return;
  const s = combatants.get(me.id), sys = text => send(ws, { t: 'c', id: null, name: 'ระบบ', text });
  if (m.t === 'w') {
    if (muted(me)) return sys('คุณถูกห้ามแชทชั่วคราว');
    const to = byName(m.to, me); if (!to) return sys(`ไม่พบผู้เล่น "${String(m.to ?? '').slice(0, 16)}" ที่ออนไลน์`);
    const r = presence.chat(ws, m.text); if (!r) return;
    send(to.ws, { t: 'w', from: me.name, text: r.text }); send(ws, { t: 'w', to: to.p.name, text: r.text, echo: true });
  } else if (m.t === 'who') send(ws, { t: 'who', list: whoList() });
  else if (m.t === 'friends') send(ws, { t: 'friends', list: friendList(me.id) });
  else if (m.t === 'fadd' || m.t === 'fdel') {
    if (!s?.persist) return sys('ต้องเข้าสู่ระบบจึงมีรายชื่อเพื่อนได้');
    const name = String(m.name ?? '').slice(0, 16);
    if (m.t === 'fadd') {
      const o = byName(name, me); if (!o) return sys('เพิ่มเพื่อนได้เมื่ออีกฝ่ายออนไลน์อยู่');
      if (o.p.id === me.id) return sys('เพิ่มตัวเองเป็นเพื่อนไม่ได้');
      if (s.c.friends.includes(o.p.name)) return sys(`${o.p.name} เป็นเพื่อนอยู่แล้ว`);
      if (s.c.friends.length >= FRIENDS_MAX) return sys(`เพื่อนได้สูงสุด ${FRIENDS_MAX} คน`);
      s.c.friends.push(o.p.name); send(o.ws, { t: 'c', id: null, name: 'ระบบ', text: `${me.name} เพิ่มคุณเป็นเพื่อน` });
    } else s.c.friends = s.c.friends.filter(n => n !== name);
    s.dirty = true; send(ws, { t: 'friends', list: friendList(me.id) });
  }
}

// ---- GM commands (server/gm.js): accounts in ADMIN_IDS ---------------------------------------
const ADMINS = admins(), mutes = new Map();   // account (or session) → muted until (ms)
const muted = p => (mutes.get(p.account ?? `s${p.id}`) ?? 0) > Date.now();
// by name (someone other than `not` first: guests may share a name)
const byName = (name, not = null) => { const k = String(name ?? '').toLowerCase(); let self = null; for (const [ws, p] of presence.players) if (p.name.toLowerCase() === k) { if (p !== not) return { ws, p }; self = { ws, p }; } return self; };
const gmCtx = { presence, get combatants() { return combatants; }, worldOf: room => worldOf(room), route: (room, ev) => route(room, ev), send, toAll, toMap: (room, msg) => toMap(room, msg), byName, byId, mutes, moveTo: (ws, ch, why) => moveTo(ws, ch, why), phase: () => clock.phase };

// ---- shared monsters and the world clock (phase 3a) ------------------------------------
const clock = new WorldClock({ hour: 7.5 });
const combatants = new Combatants();   // each player's character sheet, cooldowns and buffs (3b)
const worlds = new Map();   // room id → MonsterWorld, made when someone first arrives (CH 2+: no elites or bosses)
const worldOf = room => {
  if (!worlds.has(room)) { const { map, ch } = parseRoom(room), w = new MonsterWorld(map, { elites: ch === 1 }); w.party = parties; worlds.set(room, w); }
  return worlds.get(room);
};
const socketOf = id => { for (const [ws, p] of presence.players) if (p.id === id) return ws; return null; };
// route what the monster world reports: map-wide news, or a message for one player
function route(map, events, except = null) {
  for (const e of events) {
    if (e.t === 'kill') {
      const up = combatants.reward(e.to, e);   // a signed-in character's rewards land on the server's copy
      const ws = socketOf(e.to); if (ws) send(ws, e);
      if (e.card) { const who = ws && presence.players.get(ws); toAll({ t: 'cardnews', name: who?.name ?? 'ใครบางคน', card: e.card, monster: e.type }); }
      if (up.level && ws) { const r = presence.setLevel(ws, up.level); if (r) toMap(map, { t: 'lv', ...r }, ws); }
    } else if (e.t === 'ma') {
      const ws = socketOf(e.to); if (!ws) continue;
      combatants.touch(e.to);
      const res = combatants.swing(e.to, worldOf(map).byId(e.id)?.def, e.power);   // signed-in: resolved here
      if (res?.dead) presence.setDead(ws, true);
      if ((e.knock || e.pull) && !res?.dodge) presence.allowJump(ws, e.pull ? 16 : 4);
      send(ws, res ? { ...e, res } : e);
    }
    else toMap(map, e, except);
  }
}
const arrive = (ws, map) => { send(ws, { t: 'clock', h: +clock.hour.toFixed(3) }); send(ws, { t: 'mlist', m: worldOf(map).list() }); };

// positions and monsters out 10× a second, per map; dead sockets dropped every 15 s
setInterval(() => {
  clock.update(TICK / 1000);
  combatants.tick(TICK / 1000, clock.phase === 'night');
  const rooms = new Set([...presence.players.values()].map(p => p.room));
  for (const room of rooms) {
    const p = presence.snapshot(room); if (p.length) toMap(room, { t: 'tick', p });
    const w = worldOf(room);
    route(room, w.update(TICK / 1000, presence.inMap(room), clock.phase));
    const m = w.snapshot(); if (m.length) toMap(room, { t: 'mt', m });
  }
}, TICK);
// channels open and close with the crowd (server/channels.js), checked once a second
setInterval(() => {
  for (const map of MAPS) {
    const { warn, evict } = channels.update(map, presence.counts(map));
    for (const ch of warn) toMap(roomOf(map, ch), { t: 'chwarn', ch, secs: CHANNEL.warn });
    for (const ch of evict) for (const [ws, p] of presence.players) {
      if (p.map !== map || p.ch !== ch || combatants.fighting(p.id)) continue;   // the ones fighting go once the fight is over
      moveTo(ws, channels.pick(map, presence.counts(map)), 'closed');
    }
  }
  for (const room of worlds.keys()) { const { map, ch } = parseRoom(room); if (ch > 1 && !channels.chans(map).has(ch)) worlds.delete(room); }
}, 1000);
setInterval(() => toAll({ t: 'clock', h: +clock.hour.toFixed(3) }), 10000);
// signed-in characters: MP to the browser 1×/s, saved to the database every 30 s when changed
const flush = async id => { const s = combatants.get(id); if (!s?.persist || !s.dirty) return; s.dirty = false; await accounts.putCharacter(s.persist.account, s.persist.slot, s.c.toJSON(), s.quests.json()).catch(e => { s.dirty = true; console.warn('save', e.message); }); };
setInterval(() => { for (const [ws, p] of presence.players) { const s = combatants.get(p.id); if (s?.persist) send(ws, { t: 'me', hp: Math.round(s.c.hp), mp: Math.round(s.c.mp), ack: s.ack }); } }, 1000);
setInterval(() => { for (const p of presence.players.values()) flush(p.id); }, 30000);
setInterval(() => { for (const [ws] of conns) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);

server.listen(PORT, () => console.log(`ThaiNative Online on :${PORT} (dist ${existsSync(ROOT) ? 'ok' : 'missing — run npm run build'} · saves in ${store.kind})`));
