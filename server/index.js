import { monsterInterest } from './interest.js';
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
//   client → server  fx {skill, tgt? | x, z} (a class skill went off, at monster tgt or a spot: the training dummy) → fx {from, skill, tgt? | x, z} to the room
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
// World boss (src/combat/data/worldBoss.js, map ruen_ho, night only):
//   server → client  wbnews {state: 'soon' | 'open' | 'fall' | 'rise' | 'down' | 'dawn' | 'closed', type?, mvp?}
//                    (closed: a `map` into a night-only map by day was refused) · kill {…, share} for each payee
//                    wbcast {id, skill, spots, warn} · wbfx {id, skill, spots} · wbzone {id, skill, spots, secs} (to the room) ·
//                    wbhit {id, pct, skill, knock?, dot?, res?} (to the player it landed on; res: resolved here when signed in)
// Cards (src/character/data/cards.js): a card in a kill's drops is announced to everyone:
//   server → client  cardnews {name, card, monster}
//   client → server  op {op: 'strip', id, cards, plus} (หมออาคม takes the cards out; rolled here) → stripped {ok, outcome, cards} + sync
//   client → server  op {op: 'refine', worn: slot | id, cards, plus} (ตีบวก, src/character/data/refine.js; rolled here) → refined {ok, outcome, item, to, cards} + sync
//   Buying, strip and refine need the player by an NPC of that shop (src/data/shopSites.js).
// Whisper, online list, friends (signed in; names): w {to, text} → w {from, text} (and {to, text, echo} back) ·
//   who → who {list: [{id, name, cls, lv, map, ch}]} · friends → friends {list: [{name, online, id?, lv?, cls?, map?}]} ·
//   fadd {name} (online now) · fdel {name} · fon / foff {name} when a friend comes or goes
// Healer support: cast {skill} of a party / revive skill → aid {from, skill, heal, mp, buff, revive} to the party members near the caster;
//   cast {skill, ally} of a one-friend heal (the vine, the pill) → that party member alone, stronger (support() below)
// Titles and ranking (src/data/titles.js, server/ranking.js): join / roster / c carry `title` (the one worn).
//   client → server  ttl {id | null} (wear a title) · rank (the boards)
//   server → client  ttl {id, title} (someone's worn title changed) · titles {titles, title, rec, got} (a signed-in
//                    character's titles changed: got = just earned) · fnote {kind: 'added', name, cls} (someone added you) ·
//                    rank {power, level, enhance, at, total, holders, me: {cpRank, lvRank, enhRank, cp, lv, enh, gap10} | null}
//   who / friends rows carry `title`; an offline friend carries its last known cls, lv and title
// GM (server/gm.js): '/gm …' in chat from an account in ADMIN_IDS → a reply line; may send
//   gmwarp {map, x, z} (go there) · gmhp {pct, mp?} (HP set; 0 = knocked out) · sync
// Parties (server/parties.js): up to 6, EXP of a kill shared by the members near it.
//   client → server  pinv {id} · pans {from, ok} · pleave · pkick {id} · plead {id} (hand over the lead) · pc {text} (party chat)
//   server → client  pinv {from, name} · pno {why, name?} · pc {name, text} ·
//                    party {id, leader, share: {range, bonus, gap}, members: [{id, name, cls, lv, map, ch, x, z, dead, buffs, hp?, maxHp?, mp?, maxMp?}]} | {id: null}
// Trade (server/trades.js): signed-in players within 8 m; offer → both lock → both confirm → swap.
//   client → server  treq {id} · tans {from, ok} · toffer {items: [{id, qty, cards?, plus?}], gold} · tlock · tconf · tcancel
//   server → client  treq {from, name} · tno {why} · trade {id, with, mine, theirs, locked, confirmed} · tend {ok, why} (+ sync)
import { ITEMS } from '../src/character/data/items.js';
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
import { Parties, PARTY } from './parties.js';
import { createPartyBoardHandlers } from './party-board.js';
import { Trades, TRADE } from './trades.js';
import { commitTrade } from './trade-service.js';
import { gm, adminIds } from './gm.js';
import { FRIENDS_MAX } from '../src/character/Character.js';
import { createRanking, RANKING } from './ranking.js';
import { ALLY_FOCUS } from '../src/training/kitCombat.js';
import { navigation } from './navigation.js';
import { MAPS as MAP_DATA } from '../src/world/maps.js';
import { Pvp } from './pvp.js';
import { recallWhy } from './recall.js';
import { serviceWarp as planServiceWarp, serviceWarpChannel } from './service-warp.js';
import { StashService, stashMessage } from './stash.js';
import { createShutdown } from './shutdown.js';
import { WorldClock, wallHour } from '../src/core/WorldClock.js';

try { process.loadEnvFile(resolve(import.meta.dirname, '..', '.env')); } catch { /* no .env */ }
const PORT = Number(process.env.PORT) || 8787;
const ROOT = resolve(import.meta.dirname, '..', 'dist');
const TICK = 100;   // ms between position broadcasts
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const store = await openStore(process.env.DATABASE_URL);
const accounts = new Accounts(store, { googleClientId: process.env.GOOGLE_CLIENT_ID || null });
const stash = new StashService(accounts);
// GM account: GM_ID + GM_PASSWORD is made here when missing (the memory store forgets accounts on restart)
if (process.env.GM_ID && process.env.GM_PASSWORD) {
  const r = await accounts.register(process.env.GM_ID, process.env.GM_PASSWORD);
  if (!r.ok && r.code !== 'taken') console.warn('GM account:', r.msg);
}

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
let stopping = false;
async function api(req, res, url) {
  if (stopping) return json(res, 503, {ok:false,code:'shutdown'});
  // behind Railway's proxy the LAST hop it appended is the client; the first entry is whatever the client sent
  const ip = req.headers['x-forwarded-for']?.split(',').pop().trim() || req.socket.remoteAddress;
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
    if (stopping) return json(res, 503, {ok:false,code:'shutdown'});
    if (!id) return json(res, 401, { ok: false, code: 'auth', msg: 'กรุณาเข้าสู่ระบบใหม่' });
    if (req.method === 'POST' && url.pathname === '/api/logout') { await accounts.logout(token); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/api/google/link') { const r = await accounts.linkGoogle(id, (await readBody(req)).credential); return json(res, r.ok ? 200 : 400, r); }
    if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, { ok: true, id, google: await store.googleOf(id) });
    if (req.method === 'GET' && url.pathname === '/api/slots') return json(res, 200, { ok: true, id, slots: await accounts.slots(id) });
    const rename = /^\/api\/slots\/(\d+)\/name$/.exec(url.pathname);
    if (rename && req.method === 'POST') {
      const slot = Number(rename[1]);
      const body = await readBody(req);
      if (stopping) return json(res, 503, {ok:false,code:'shutdown'});
      if (combatants.live(id,slot) || accounts.writes.queues.has(`${id}:${slot}`)) return json(res,409,{ok:false,code:'in_play',msg:'กรุณาออกจากเกมก่อนเปลี่ยนชื่อ'});
      const r = await accounts.rename(id,slot,body.name);
      return json(res,r.ok ? 200 : r.code === 'name_taken' ? 409 : 400,r);
    }
    const m = /^\/api\/slots\/(\d+)$/.exec(url.pathname);
    if (m && req.method === 'PUT') {
      const key = `${id}:${Number(m[1])}`;
      if ((accounts.writes.queues.get(key)?.jobs.length ?? 0) >= 16) return json(res, 503, {ok:false,code:'save_busy'});
      const slot = Number(m[1]);
      const body = await readBody(req);
      if (stopping) return json(res, 503, {ok:false,code:'shutdown'});
      const live = combatants.live(id, slot);
      if (live?.tradeBusy || live?.stashBusy) return json(res, 409, {ok:false,code:'save_busy'});   // resolve after reading: the old socket may have left meanwhile
      const r = await accounts.save(id, slot, body.data, live ? { c: live.c.toJSON(), quests: live.quests.json(), inventoryRevision: live.persist.inventoryRevision ?? 0 } : null);
      return json(res, r.ok ? 200 : ['name_taken','slot_taken'].includes(r.code) ? 409 : 400, r);   // the live copy stays `dirty`: its own flush decides
    }
    if (m && req.method === 'DELETE') { if (combatants.live(id, Number(m[1])) || accounts.writes.queues.has(`${id}:${Number(m[1])}`)) return json(res, 409, {ok:false,code:'in_play'}); const r = await accounts.remove(id, Number(m[1])); return json(res, r.ok ? 200 : 400, r); }
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
  if (!existsSync(path) || statSync(path).isDirectory()) {
    // a missing file (a model, a sprite sheet, a sound) is a 404, so a loader fails plainly
    // instead of parsing the game page; any other path is the game, which is one page
    if (extname(url.pathname)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' }); res.end('not found'); return; }
    path = join(ROOT, 'index.html');
  }
  if (!existsSync(path)) { res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); res.end('ยังไม่ได้ build เกม (npm run build)'); return; }
  // Vite's hashed bundles never change; models, sprites, icons and sounds are big and change
  // rarely, so the browser keeps them a day and asks with the ETag after that (a 304, not a
  // re-download); the page itself and small JSON are always re-checked.
  const stat = statSync(path), hashed = /\/assets\//.test(path), heavy = /\.(glb|gltf|bin|png|jpe?g|webp|mp3|ogg|wav|woff2)$/i.test(path);
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream', etag, 'last-modified': stat.mtime.toUTCString(),
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : heavy ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
  headers['content-length'] = stat.size;
  if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return; }
  res.writeHead(200, headers);
  createReadStream(path).pipe(res);
});

// ---- realtime -----------------------------------------------------------------------------
const presence = new Presence({ navigation });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
const conns = new Map();   // ws → { allow() }
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const toMap = (room, msg, except = null) => { const s = JSON.stringify(msg); for (const [ws] of conns) if (ws !== except && presence.players.get(ws)?.room === room && ws.readyState === 1) ws.send(s); };
const channels = new Channels();
const chs = map => channels.list(map, presence.counts(map));
const pickCh = map => (MAPS.includes(map) ? channels.pick(map, presence.counts(map)) : 1);
// a player to another channel of the same map: like walking through a portal, minus the walk
const moveTo = (ws, ch, why) => {
  const p = presence.players.get(ws); if (p) resetPvp(p.id);
  const r = presence.setChannel(ws, ch); if (!r) return;
  toMap(r.left, { t: 'leave', id: r.id }, ws);
  send(ws, { t: 'chmove', ch: r.ch, why });
  send(ws, { t: 'welcome', you: r.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
  toMap(r.room, { t: 'join', p: r.joined }, ws);
};
const toAll = msg => { const s = JSON.stringify(msg); for (const [ws] of conns) if (presence.players.has(ws) && ws.readyState === 1) ws.send(s); };

// a stray rejection is logged, not fatal: one player's bad message must not take the world down
process.on('unhandledRejection', e => console.error('unhandled', e));

wss.on('connection', ws => {
  if (stopping) { ws.close(1012, 'Restarting'); return; }
  conns.set(ws, { allow: rateLimiter() }); ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => handle(ws, raw).catch(e => console.error('message', presence.players.get(ws)?.name ?? '?', e)));
});
// one socket's message: a thrown error is that message's alone, never the server's
async function handle(ws, raw) {
    if (stopping || !conns.get(ws)?.allow()) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const active = combatants.get(presence.players.get(ws)?.id);
    // Keep the source bag unchanged while its SQL transfer is in flight. A refused
    // optimistic op is acknowledged with a sync, so NetProgress can reconcile it.
    if ((active?.stashBusy || active?.tradeBusy) && !['stash_open', 'stash_move', 'resync'].includes(m.t)) {
      if (m.t === 'op') {
        if (Number.isSafeInteger(m.n) && m.n > active.ack) active.ack = m.n;
        send(ws, { t: 'sync', c: combatants.me(presence.players.get(ws).id) });
      }
      return;
    }
    if (partyBoard.handle(ws, m)) return;
    switch (m.t) {
      case 'hello': {
        // a signed-in player is shown as the character the server has saved (name, class, level)
        const id = await accounts.auth(m.token).catch(() => null);
        if (id && Number.isInteger(m.slot)) {
          try { await accounts.writes.wait(`${id}:${m.slot}`, 10000); }
          catch { send(ws, {t:'kicked',why:'กำลังเซฟตัวละคร กรุณาลองเชื่อมต่อใหม่'}); ws.close(); return; }
        }
        if (stopping || ws.readyState !== 1) return;
        if (id && (await accounts.slots(id)).find(s => s.slot === m.slot)?.needsRename) {
          send(ws,{t:'kicked',code:'rename_required',why:'ชื่อตัวละครซ้ำ กรุณาเลือกชื่อใหม่ฟรีที่หน้าเลือกตัวละคร'}); ws.close(); return;
        }
        const saved = id && Number.isInteger(m.slot) ? await accounts.character(id, m.slot).catch(() => null) : null;
        if (stopping || ws.readyState !== 1) return;
        if (saved) Object.assign(m, { name: saved.name, cls: saved.classId, gender: saved.gender, lv: saved.level });
        const r = presence.join(ws, m, pickCh(m.map), {guest:!saved});
        if (!r) return;
        if (r.full) { send(ws, { t: 'full' }); ws.close(); return; }
        if (id) Object.assign(presence.players.get(ws), { account: id, admin: ADMINS.has(String(id).toLowerCase()) });
        if (saved) {
          // one tab per character: an older socket on the same slot is closed (its copy is saved first)
          // one tab per character: the older socket on the same slot is dropped from play at once
          // (so no op of its reaches the character any more), then saved and closed
          const kick = async () => {
            const old = combatants.live(id, m.slot); if (!old) return;
            for (const [ows, op] of presence.players) if (combatants.get(op.id) === old) { combatants.drop(op.id); old.dirty=true; flushEntry(old, op); send(ows, { t: 'kicked' }); ows.close(); await accounts.writes.wait(`${id}:${m.slot}`, 10000); }
          };
          await kick();
          const fresh = await accounts.character(id, m.slot).catch(() => null) ?? saved, quests = await accounts.quests(id, m.slot).catch(() => '{}');
          await kick();   // a twin that signed in during the reads
          if (stopping || !presence.players.has(ws)) return;   // we were the one kicked meanwhile
          combatants.load(r.you, fresh, { account: id, slot: m.slot, inventoryRevision: accounts.inventoryRevision(id, m.slot) }, quests);
          presence.setTitle(ws, combatants.get(r.you).c.title, true); r.joined.title = presence.players.get(ws).title;
          send(ws, { t: 'sync', c: combatants.me(r.you) });
        }
        send(ws, { t: 'welcome', you: r.you, name:r.joined.name, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
        toMap(r.room, { t: 'join', p: r.joined }, ws); toAll({ t: 'online', n: presence.count });
        correct(ws); pvpState(r.you);
        // saved inside a night-only map (เรือนหอร้าง) and back by day: out through its door
        if (MAP_DATA[r.map]?.nightOnly && clock.phase !== 'night') { send(ws, { t: 'wbnews', state: 'closed' }); leaveNightMap(ws, presence.players.get(ws)); }
        if (saved) friendNews(presence.players.get(ws), true);
        break;
      }
      case 's': {   // a move: whoever walks off stops resting
        const p = presence.players.get(ws), x = p?.x, z = p?.z; if (!presence.move(ws, m)) correct(ws);
        if (p && Math.hypot(p.x - x, p.z - z) > .2) { combatants.sit(p.id, false); combatants.interrupt(p.id); }
        break;
      }
      case 'recall': recall(ws); break;
      case 'party_warp': recall(ws, true); break;
      case 'service_warp': serviceWarp(presence.players.get(ws), m.npc, m.destination, ws); break;
      case 'stash_open': case 'stash_move': await stashMsg(ws, m); break;
      case 'wbjoin': joinWorldBoss(ws); break;
      case 'duel_request': case 'duel_answer': case 'duel_cancel': case 'pk': case 'pvp_hit': pvpMsg(ws, m); break;
      case 'pinv': case 'pans': case 'pleave': case 'pkick': case 'plead': case 'pc': partyMsg(ws, m); break;
      case 'w': case 'who': case 'friends': case 'fadd': case 'fdel': socialMsg(ws, m); break;
      case 'ttl': {   // wear a title: a signed-in character only one it has earned (src/data/titles.js)
        const p = presence.players.get(ws), s = p && combatants.get(p.id); if (!p) return;
        const id = typeof m.id === 'string' ? m.id : null;
        if (s?.persist) { if (!s.c.setTitle(id)) return send(ws, { t: 'titles', titles: s.c.titles, title: s.c.title, rec: s.c.rec, got: [] }); s.dirty = true; }
        const r = presence.setTitle(ws, id, !!s?.persist); if (r) toMap(p.room, { t: 'ttl', ...r }, ws);
        break;
      }
      case 'rank': {
        const p = presence.players.get(ws); if (!p) return;
        if (ranking.stale()) await ranking.refresh();
        const s = combatants.get(p.id);
        send(ws, { t: 'rank', ...ranking.boards(), me: s?.persist ? ranking.mine(`${s.persist.account}:${s.persist.slot}`) : null });
        break;
      }
      case 'treq': case 'tans': case 'toffer': case 'tlock': case 'tconf': case 'tcancel': tradeMsg(ws, m); break;
      case 'map': {
        const p = presence.players.get(ws);
        if (p?.map === m.map) { send(ws,{t:'welcome',you:p.id,roster:presence.inMap(p.room).filter(o=>o!==p).map(o=>presence.info(o)),online:presence.count,ch:p.ch,chs:chs(p.map)});arrive(ws,p.room);return; }
        if (p && pvp.view(p.id).wait > 0) { correct(ws); return; }
        if (MAP_DATA[m.map]?.nightOnly && clock.phase !== 'night') { send(ws, { t: 'wbnews', state: 'closed' }); correct(ws); return; }   // เรือนหอร้าง opens only at night
        endTrade(presence.players.get(ws)?.id, 'moved');
        const r = presence.changeMap(ws, m, pickCh(m.map)); if (!r) { correct(ws); return; }
        resetPvp(r.id);
        toMap(r.left, { t: 'leave', id: r.id }, ws);
        send(ws, { t: 'welcome', you: r.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(r.map), ...(presence.players.get(ws)?.admin ? { admin: true } : {}) }); arrive(ws, r.room);
        toMap(r.room, { t: 'join', p: r.joined }, ws);
        break;
      }
      case 'chans': { const p = presence.players.get(ws); if (p) send(ws, { t: 'chans', map: p.map, ch: p.ch, list: chs(p.map) }); break; }
      case 'chan': {
        const p = presence.players.get(ws); if (!p) return;
        const ch = Math.floor(Number(m.ch));
        const why = channels.canSwitch(p.map, ch, presence.counts(p.map), { from: p.ch, fighting: combatants.fighting(p.id) || !!pvp.view(p.id).duel || pvp.view(p.id).wait > 0, dead: !!p.dead, lastAt: p.chanAt ?? -Infinity });
        if (why) { send(ws, { t: 'chno', why }); break; }
        p.chanAt = Date.now() / 1000; endTrade(p.id, 'moved'); moveTo(ws, ch, 'switch');
        break;
      }
      case 'a': { const r = presence.anim(ws, m); if (r) toMap(r.map, r, ws); break; }
      // a class skill went off: the others play it on this player (src/net/RemoteSkills.js)
      case 'fx': {
        const p = presence.players.get(ws); if (!p || typeof m.skill !== 'string' || !/^[a-z_]{2,32}$/.test(m.skill)) return;
        const at = Number.isFinite(m.x) && Number.isFinite(m.z) && Math.hypot(m.x - p.x, m.z - p.z) < 30 ? { x: m.x, z: m.z } : {};
        toMap(p.room, { t: 'fx', from: p.id, skill: m.skill, ...(Number.isInteger(m.tgt) ? { tgt: m.tgt } : at) }, ws);
        break;
      }
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
        const ally = Number.isInteger(m.ally) && m.ally !== p.id ? m.ally : null;   // a heal aimed at one friend
        combatants.sit(p.id, false); const r = combatants.cast(p.id, m.skill, { ally: ally !== null, world: worldOf(p.room), player: p });
        if (!r.ok) send(ws, { t: 'nope', skill: m.skill, why: r.why });
        else if (r.support && combatants.get(p.id)?.c.alive) support(p, m.skill, r.support, r.single ? ally : null);
        if (r.ok && r.effects?.length) route(p.room, r.effects);
        if (r.ok) syncQuestPractice(ws, p);
        break;
      }
      case 'sit': { const p = presence.players.get(ws); if (p) combatants.sit(p.id, m.v); break; }
      case 'blow': { const p = presence.players.get(ws); if (p) { const target=worldOf(p.room).byId(m.id); if(target&&!navigation(p.map).clear(p,target,.05))return; combatants.touch(p.id); route(p.room, combatants.blow(p.id, worldOf(p.room), presence.inMap(p.room), m, clock.phase)); syncQuestPractice(ws, p); } break; }
      case 'dead': {
        const p = presence.players.get(ws); if (!p) return;
        if (!combatants.get(p.id)?.persist) { presence.setDead(ws, m.v); if (!m.v) { Object.assign(p,MAP_DATA[p.map].spawn,{m:0,dirty:true});correct(ws); } break; }
        if (!m.v && combatants.respawn(p.id)) { presence.setDead(ws, false); Object.assign(p, MAP_DATA[p.map].spawn, {m:0,dirty:true}); correct(ws); send(ws, {t:'sync',c:combatants.me(p.id)}); }   // a signed-in death is the server's call; the walk to the respawn point is free
        break;
      }
      case 'op': {
        const p = presence.players.get(ws); if (!p || !combatants.get(p.id)?.persist) return;
        const view = pvp.view(p.id);
        const ok = combatants.op(p.id, m, { map: p.map, x: p.x, z: p.z, loadoutBusy: !!trades.of(p.id) || !!view?.duel || view?.wait > 0 });
        // taking cards out and ตีบวก are rolled here: the result, then the character as it is now
        if (m.op === 'strip') { send(ws, { t: 'stripped', ...combatants.get(p.id).stripped }); send(ws, { t: 'sync', c: combatants.me(p.id) }); }
        else if (m.op === 'refine') { send(ws, { t: 'refined', ...combatants.get(p.id).refined }); send(ws, { t: 'sync', c: combatants.me(p.id) }); }
        else if (!ok || m.op === 'loadout_apply' || ['quest_accept', 'quest_complete', 'talk'].includes(m.op)) send(ws, { t: 'sync', c: combatants.me(p.id) });
        break;
      }
      case 'resync': { const p = presence.players.get(ws); const c = p && combatants.me(p.id); if (c) send(ws, { t: 'sync', c }); break; }
      case 'lv': {
        if (combatants.get(presence.players.get(ws)?.id)?.persist) return;   // a signed-in level comes from the server
        const r = presence.setLevel(ws, m.lv); const p = presence.players.get(ws); if (r && p) toMap(p.room, { t: 'lv', ...r }, ws); break; }
    }
}
wss.on('connection', ws => {
  ws.on('close', () => {
    conns.delete(ws);
    const departing = presence.players.get(ws);
    const r = presence.leave(ws);
    if (r) { endTrade(r.id, 'left'); leaveParty(r.id); partyBoard.disconnect(r.id); endDuel(pvp.leave(r.id)); if (r.account) friendNews(r, false); }
    if (r) { const s=combatants.get(r.id); if(!stopping){if(s?.persist)s.dirty=true;flushEntry(s,departing);} combatants.drop(r.id); }
    if (r) { toMap(r.map, { t: 'leave', id: r.id }); toAll({ t: 'online', n: presence.count }); }
  });
});

// Vault mutations send a confirmed result, current account vault, and current
// character. Retries use the same request ID; no raw HTTP stash writes exist.
async function stashMsg(ws, m) {
  const p = presence.players.get(ws), s = p && combatants.get(p.id), view = p && pvp.view(p.id);
  const context = { fighting: !!p && (combatants.fighting(p.id) || view?.wait > 0), duel: !!view?.duel, trade: !!p && !!trades.of(p.id) };
  const reply = r => {
    send(ws, { t: 'stash_result', request: m.request, ok: r.ok, ...(r.why ? { why: r.why } : {}), ...(r.ok ? { moved: r.moved ?? 0, replayed: !!r.replayed } : {}) });
    if (r.stash) send(ws, stashMessage(r.stash));
    const c = p && combatants.me(p.id); if (c) send(ws, { t: 'sync', c });
  };
  if (m.t === 'stash_open') {
    try { const r = await stash.open(p, s, m.npc, context); if (r.ok) send(ws, stashMessage(r.stash)); else reply(r); }
    catch { reply({ ok: false, why: 'storage_unavailable' }); }
    return;
  }
  const task = stash.move(p, s, m, context);
  if (s && !s.stashTask) s.stashTask = task;
  try { const r = await task; reply(r); }
  catch { reply({ ok: false, why: 'storage_unavailable' }); }
  finally { if (s?.stashTask === task) s.stashTask = null; }
}

function syncQuestPractice(ws, p) {
  const s = combatants.get(p.id);
  if (!s?.questPracticeChanged) return;
  s.questPracticeChanged = false;
  send(ws, { t: 'sync', c: combatants.me(p.id) });
}

// ---- parties and trade --------------------------------------------------------------------
const parties = new Parties(), trades = new Trades();
const byId = id => { for (const [ws, p] of presence.players) if (p.id === id) return { ws, p }; return null; };
const pvp = new Pvp();
function correct(ws, extra = {}) {
  const p = presence.players.get(ws);
  if (p) send(ws, {t:'position',map:p.map,x:p.x,z:p.z,f:p.f,...extra});
}
function pvpPlayer(id) {
  const p = byId(id)?.p, s = combatants.get(id);
  return p ? {...p,signed:!!s?.persist,dead:!!p.dead || !s?.c.alive,
    busy:!!s?.stashBusy || !!trades.of(id) || combatants.fighting(id),trade:!!trades.of(id),party:parties.of(id)} : null;
}
function pvpState(id) {
  const p = byId(id)?.p;
  if (p) toMap(p.room, {t:'pvp_state',id,...pvp.view(id)});
}
function endDuel(d) {
  if (!d) return;
  for (const id of [d.a,d.b]) { const o=byId(id); if(o) send(o.ws,{t:'duel_end',...d}); pvpState(id); }
}
function resetPvp(id) {
  endDuel(pvp.finish(id,'moved'));
  Object.assign(pvp.state(id),{pk:false}); pvpState(id);
}
function recall(ws, followLeader = false) {
  const p=presence.players.get(ws); if(!p) return;
  const leader=followLeader?byId(parties.get(parties.of(p.id))?.leader)?.p:null;
  if(followLeader&&(!leader||leader.id===p.id||!combatants.get(p.id)?.persist||!combatants.get(leader.id)?.persist))return send(ws,{t:'recall_no',why:'offline'});
  const dest=leader?.map??'city';
  if (leader && leader.room !== p.room && (presence.counts(dest)[leader.ch]??0) >= channels.cap(dest)) return send(ws,{t:'recall_no',why:'full'});
  const why=recallWhy(followLeader?{...p,map:'field'}:p,{fighting:combatants.fighting(p.id)||pvp.view(p.id).wait>0||!!leader&&(combatants.fighting(leader.id)||pvp.view(leader.id).wait>0||!!pvp.view(leader.id).duel),duel:!!pvp.view(p.id).duel,trade:!!trades.of(p.id)});
  if(why) return send(ws,{t:'recall_no',why});
  p.recallAt = Date.now() / 1000;
  teleport(ws, p, { map: dest, ...MAP_DATA[dest].spawn }, leader?.ch ?? pickCh(dest));
}
// Recall and steward travel share the authoritative room, roster and save flow.
// Same-map travel uses it too, so observers see the relocation immediately.
function teleport(ws, p, destination, ch, position = {}) {
  const left = p.room, now = Date.now() / 1000;
  resetPvp(p.id); combatants.sit(p.id, false); combatants.interrupt(p.id);
  const state = combatants.get(p.id);
  if (state) state.casts = [];
  Object.assign(p, { map: destination.map, x: destination.x, z: destination.z,
    f: destination.facing ?? p.f, m: 0, dirty: true, slack: 0, slackUntil: 0,
    budget: 0, budgetAt: now, t: now });
  const r = presence.enter(p, ch);
  toMap(left, { t: 'leave', id: p.id }, ws);
  send(ws, { t: 'welcome', you: p.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(p.map), ...(p.admin ? { admin: true } : {}) });
  toMap(r.room, { t: 'join', p: r.joined }, ws); correct(ws, position); arrive(ws, r.room);
  if (state?.persist) { state.dirty = true; flush(p.id); }
}
function serviceWarp(p, npcId, destinationId, requestWs) {
  const ws = p ? byId(p.id)?.ws : requestWs;
  if (!ws) return;
  const state = p && combatants.get(p.id), view = p && pvp.view(p.id), now = Date.now() / 1000;
  const result = planServiceWarp(p, npcId, destinationId, { now,
    dead: !!state && !state.c.alive, fighting: !!p && (combatants.fighting(p.id) || view.wait > 0),
    duel: !!view?.duel, trade: !!p && !!trades.of(p.id) });
  if (!result.ok) return send(ws, { t: 'service_warp_no', why: result.why });
  const dest = result.destination, room = serviceWarpChannel(p, dest.map, channels, presence.counts(dest.map));
  if (!room.ok) return send(ws, { t: 'service_warp_no', why: room.why });
  p.serviceWarpAt = now;
  teleport(ws, p, dest, room.ch, { reason: 'service_warp', destination: dest.id });
}
// เรือนหอร้าง has no door: the world boss news has a button (client wbjoin) that warps here, at
// night only and not mid-fight, duel or trade (no recall cooldown: it is not a way home)
function joinWorldBoss(ws) {
  const p = presence.players.get(ws), dest = 'ruen_ho'; if (!p || p.map === dest) return;
  if (clock.phase !== 'night') return send(ws, { t: 'wbnews', state: 'closed' });
  const why = recallWhy({ ...p, map: 'field', recallAt: -Infinity }, { fighting: combatants.fighting(p.id) || pvp.view(p.id).wait > 0, duel: !!pvp.view(p.id).duel, trade: !!trades.of(p.id) });
  if (why) return send(ws, { t: 'recall_no', why });
  teleport(ws, p, { map: dest, ...MAP_DATA[dest].spawn }, pickCh(dest));
}
function pvpMsg(ws,m) {
  const p=presence.players.get(ws); if(!p) return;
  const a=pvpPlayer(p.id), b=pvpPlayer(Number(m.id ?? m.from));
  const no=why=>send(ws,{t:'pvp_no',why});
  if(m.t==='pk') { if(typeof m.on!=='boolean')return; const why=pvp.toggle(a,m.on); if(why)return no(why); pvpState(p.id); }
  else if(m.t==='duel_request') { const why=pvp.request(a,b); if(why)return no(why); send(byId(b.id).ws,{t:'duel_invite',from:p.id,name:p.name}); }
  else if(m.t==='duel_answer') {
    if(m.ok!==true) {pvp.decline(p.id,Number(m.from));return;}
    const r=pvp.accept(a,b); if(r.why)return no(r.why);
    for(const id of [r.duel.a,r.duel.b]) {pvpState(id); const o=byId(id);send(o.ws,{t:'duel_start',...r.duel});}
  } else if(m.t==='duel_cancel') endDuel(pvp.finish(p.id,'forfeit',pvp.view(p.id).duel?.a===p.id?pvp.view(p.id).duel?.b:pvp.view(p.id).duel?.a));
  else if(m.t==='pvp_hit') {
    const why=pvp.canAttack(a,b); if(why)return no(why);
    const c=combatants.get(p.id).c;
    if(Math.hypot(a.x-b.x,a.z-b.z)>c.cls.range+1.5)return no('far');
    if(!navigation(a.map).clear(a,b,.05))return no('blocked');
    const r=combatants.pvpBasic(a.id,b.id,{knockout:!!pvp.view(a.id).duel}); if(!r)return no('cooldown');
    pvp.touch(a.id,b.id);
    toMap(p.room,{t:'pvp_hit',from:a.id,id:b.id,...r});
    if(r.dead) {presence.setDead(byId(b.id).ws,true);resetPvp(b.id);}
    if(r.won)endDuel(pvp.finish(a.id,'won',a.id));
    pvpState(a.id);pvpState(b.id);
  }
}
const PARTY_WHY = new Set(['self', 'in_party', 'not_leader', 'full', 'expired', 'offline', 'guest']);
function partyState(pid) {
  const party = parties.get(pid); if (!party) return { t: 'party', id: null };
  return { t: 'party', id: party.id, leader: party.leader, share: { range: PARTY.shareRange, bonus: PARTY.bonus, gap: PARTY.levelGap }, members: party.members.map(id => {
    const o = byId(id)?.p, s = combatants.get(id);
    return { id, name: o?.name ?? '?', cls: o?.cls, lv: o?.lv ?? 1, map: o?.map, ch: o?.ch, x: Math.round(o?.x ?? 0), z: Math.round(o?.z ?? 0), dead: !!o?.dead,
      buffs: (s?.c.buffs ?? []).map(b => b.id), ...(s?.persist ? { hp: Math.round(s.c.hp), maxHp: s.c.maxHp, mp: Math.round(s.c.mp), maxMp: s.c.maxMp } : {}) };
  }) };
}
const tellParty = (ids, msg) => { for (const id of ids) { const w = byId(id)?.ws; if (w) send(w, msg); } };
const sendParty = pid => tellParty(parties.members(pid), partyState(pid));
// Combatants is initialized below; messages run only after server.listen.
const partyBoard = createPartyBoardHandlers({ parties, presence, combatants: { get: id => combatants.get(id) }, byId, send, sendParty });
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
    if (!!combatants.get(me.id)?.persist !== !!combatants.get(to.p.id)?.persist) return no('guest', to.p.name);   // a guest and a signed-in character cannot share one
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
  } else if (m.t === 'plead') {
    const party = parties.promote(me.id, Number(m.id)); if (party) sendParty(party.id);
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
  if (combatants.get(a.id).stashBusy || combatants.get(b.id).stashBusy) return 'busy';
  if (a.room !== b.room || Math.hypot(a.x - b.x, a.z - b.z) > TRADE.range) return 'far';
  if (a.dead || b.dead || combatants.fighting(a.id) || combatants.fighting(b.id) || pvp.view(a.id).duel || pvp.view(b.id).duel || pvp.view(a.id).wait || pvp.view(b.id).wait) return 'busy';
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
  if (trades.of(id)?.committing) return;
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
        if (t.committing) return;
        commitTrade(accounts, t, [combatants.get(t.a), combatants.get(t.b)], [byId(t.a).p, byId(t.b).p], {
          reward: (s, { id, k }) => {
            rewardNews(byId(id)?.p.room, k, combatants.rewardState(s, id, k));
          },
        }).then(r => {
          t.committing = false;
          endTrade(me.id, r.ok ? 'done' : r.why, r.ok);
        }).catch(error => console.warn('trade', error.message));
        return;
      }
    }
    sendTrade(t);
  }
}
setInterval(() => { partyBoard.sweep(); for (const party of parties.parties.values()) sendParty(party.id); }, 1000);

// ---- titles and the ranking boards (src/data/titles.js, server/ranking.js) -------------------------
// a signed-in character's titles after its records moved: the player hears of a change (and the
// room, when the worn one was taken back with a lost rank)
function titleNews(id) {
  const s = combatants.get(id); if (!s?.persist) return;
  const c = s.c, before = `${c.titles.join()}|${c.title}`, got = c.checkTitles();
  if (before === `${c.titles.join()}|${c.title}`) return;
  s.dirty = true;
  const ws = socketOf(id); if (!ws) return;
  send(ws, { t: 'titles', titles: c.titles, title: c.title, rec: c.rec, got });
  const p = presence.players.get(ws);
  if (p && (p.title ?? null) !== c.title) { const r = presence.setTitle(ws, c.title, true); if (r) toMap(p.room, { t: 'ttl', ...r }, ws); }
}
const ranking = createRanking({
  store,
  live: () => [...presence.players.values()].map(p => ({ id: p.id, s: combatants.get(p.id) })).filter(x => x.s?.persist).map(({ id, s }) => ({ id, c: s.c, key: `${s.persist.account}:${s.persist.slot}` })),
  onRanks: titleNews,
});
setInterval(() => ranking.refresh(), RANKING.every);
setTimeout(() => ranking.refresh(), 3000);
// a healer's party / revive skill (src/training/kitCombat.js supportOf): the other members in the
// same room within its radius are healed, buffed and — for a revive — stood back up where they fell.
// The caster hears who it reached: aided {skill, got: [{name, x, z, heal, revived}]}
// `only`: a heal aimed at one friend (kitCombat.allyHeal, the browser's pick): that party member
// alone, ALLY_FOCUS × as strong, within the skill's reach (+ a little for lag).
function support(caster, skill, sup, only = null) {
  const pid = parties.of(caster.id); if (!pid) return;
  const got = [], reach = only === null ? sup.radius : sup.radius + 3;
  if (only !== null) sup = { ...sup, hp: Math.round((sup.hp || 0) * ALLY_FOCUS) };
  for (const id of parties.members(pid)) {
    if (id === caster.id || (only !== null && id !== only)) continue;
    const o = byId(id); if (!o || o.p.room !== caster.room || Math.hypot(o.p.x - caster.x, o.p.z - caster.z) > reach) continue;
    const r = combatants.aid(id, sup);
    if (r?.revived) presence.setDead(o.ws, false);
    if (r || o.p.dead) send(o.ws, { t: 'aid', from: caster.name, skill, heal: sup.heal, hp: sup.hp, mp: sup.mp, buff: sup.buff, revive: o.p.dead || r?.revived ? sup.revive : 0 });
    if (r) got.push({ name: o.p.name, x: o.p.x, z: o.p.z, heal: r.heal ?? 0, revived: !!r.revived });
  }
  // the healer's records (สายซัพพอร์ต titles): HP given to the others and the fallen stood up
  const cs = combatants.get(caster.id);
  if (cs?.persist && got.length) { cs.c.note('healOut', got.reduce((n, g) => n + g.heal, 0)); cs.c.note('revive', got.filter(g => g.revived).length); cs.dirty = true; titleNews(caster.id); }
  const casterWs = byId(caster.id)?.ws;
  if (got.length && casterWs) send(casterWs, { t: 'aided', skill, got });
}

// ---- whisper, who is online, friends ---------------------------------------------------------
const whoList = () => [...presence.players.values()].sort((a, b) => b.lv - a.lv).slice(0, 200).map(p => ({ id: p.id, name: p.name, cls: p.cls, lv: p.lv, title: p.title ?? null, map: p.map, ch: p.ch }));
// a signed-in player came or went: tell everyone online who has them as a friend
function friendNews(p, on) {
  for (const [ws, o] of presence.players) if (o !== p && combatants.get(o.id)?.c.friends?.includes(p.name)) send(ws, { t: on ? 'fon' : 'foff', name: p.name });
}
function friendList(id) {
  const s = combatants.get(id), online = new Map([...presence.players.values()].map(p => [p.name, p]));
  return (s?.c.friends ?? []).map(name => { const o = online.get(name); return o ? { name, online: true, id: o.id, lv: o.lv, cls: o.cls, title: o.title ?? null, map: o.map, ch: o.ch } : { name, online: false, ...ranking.infoOf(name) }; });
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
      s.c.friends.push(o.p.name); send(o.ws, { t: 'fnote', kind: 'added', name: me.name, cls: me.cls });
    } else s.c.friends = s.c.friends.filter(n => n !== name);
    s.dirty = true; send(ws, { t: 'friends', list: friendList(me.id) }); titleNews(me.id);
  }
}

// ---- GM commands (server/gm.js): accounts in ADMIN_IDS ---------------------------------------
const ADMINS = adminIds(), mutes = new Map();   // ADMIN_IDS + GM_ID · account (or session) → muted until (ms)
const muted = p => (mutes.get(p.account ?? `s${p.id}`) ?? 0) > Date.now();
// by name (someone other than `not` first: guests may share a name)
const byName = (name, not = null) => { const k = String(name ?? '').toLowerCase(); let self = null; for (const [ws, p] of presence.players) if (p.name.toLowerCase() === k) { if (p !== not) return { ws, p }; self = { ws, p }; } return self; };
const gmCtx = { presence, get combatants() { return combatants; }, worldOf: room => worldOf(room), route: (room, ev) => route(room, ev), send, toAll, toMap: (room, msg) => toMap(room, msg), byName: (name, not) => { const target = byName(name, not); return target && !(combatants.get(target.p.id)?.stashBusy || combatants.get(target.p.id)?.tradeBusy) ? target : null; }, byId, mutes, moveTo: (ws, ch, why) => moveTo(ws, ch, why), phase: () => clock.phase, setHour: h => setHour(h) };

// ---- shared monsters and the world clock (phase 3a) ------------------------------------
const clock = new WorldClock({ hour: 7.5 });   // Thai wall time: 24 real minutes a game day, days from Thai midnight (WorldClock.wallHour)
// A shift of the world clock for testing (one game hour = one real minute): `npm run server -- --hour=21`
// starts the server at 21:00, and the GM command `time <hour>` moves it (server/gm.js).
let clockShift = 0;
const syncClock = () => clock.sync(Date.now() + clockShift);
function setHour(h) { clockShift = 0; const now = Date.now(); clockShift = ((((h - wallHour(now)) % 24) + 24) % 24) * 60e3; syncClock(); toAll({ t: 'clock', h: +clock.hour.toFixed(3) }); return clock.hour; }
const startHour = Number(process.argv.find(a => a.startsWith('--hour='))?.slice(7));
syncClock();
const combatants = new Combatants();   // each player's character sheet, cooldowns and buffs (3b)
const monsterInterests = new WeakMap();
const worlds = new Map();   // room id → MonsterWorld, made when someone first arrives (CH 2+: no elites or bosses)
const worldOf = room => {
  if (!worlds.has(room)) { const { map, ch } = parseRoom(room), w = new MonsterWorld(map, { elites: ch === 1, idleRadius:96, navigation: navigation(map) }); w.party = parties; w.online = () => presence.count; worlds.set(room, w); }
  return worlds.get(room);
};
const socketOf = id => { for (const [ws, p] of presence.players) if (p.id === id) return ws; return null; };
function rewardNews(map, e, up) {
  titleNews(e.to);
  const ws = socketOf(e.to); if (ws) send(ws, up.lost ? { ...e, lost: up.lost } : e);
  const cardKept = e.card && !up.lost?.some(d => ITEMS[d.id]?.type === 'card');
  if (cardKept) { const who = ws && presence.players.get(ws); toAll({ t: 'cardnews', name: who?.name ?? 'ใครบางคน', card: e.card, monster: e.type }); }
  if (up.level && ws) { const r = presence.setLevel(ws, up.level); if (r) toMap(map, { t: 'lv', ...r }, ws); }
}
// route what the monster world reports: map-wide news, or a message for one player
function route(map, events, except = null) {
  for (const e of events) {
    if (e.t === 'kill') {
      const up = combatants.reward(e.to, e);   // a signed-in character's rewards land on the server's copy
      if (up.deferred) continue;
      rewardNews(map, e, up);
    } else if (e.t === 'mstrike') {
      const ws = socketOf(e.to);
      if (ws) send(ws, e);
    } else if (e.t === 'ma') {
      if (combatants.get(e.to)?.tradeBusy) {
        const ws = socketOf(e.to);
        if (ws && e.attackId !== undefined) send(ws, { t: 'mstrike', stage: 'cancel', id: e.id, generation: e.generation, attackId: e.attackId });
        continue;
      }
      const ws = socketOf(e.to); if (!ws) continue;
      const p=presence.players.get(ws), monster=worldOf(map).byId(e.id);
      if (!p || p.dead || p.room !== map) continue;
      if (e.attackId !== undefined && (!monster || monster.hp <= 0 || e.generation !== monster.strikeGeneration)) continue;
      if(monster&&p&&!navigation(p.map).clear(e.origin ?? monster,p,.05))continue;
      combatants.touch(e.to);
      const res = combatants.swing(e.to, worldOf(map).byId(e.id)?.def, e.power, { skill: !!e.skill });   // signed-in: resolved here
      if (res?.dead) { presence.setDead(ws, true); combatants.get(e.to)?.c.note('deaths'); titleNews(e.to); }
      if ((e.knock || e.pull) && !res?.dodge) presence.allowJump(ws, e.pull ? 16 : 4);
      send(ws, res ? { ...e, res } : e);
    }
    else if (e.t === 'wbhit') {   // a world boss skill landed on this player: a share of max HP (signed in: resolved here)
      if (combatants.get(e.to)?.tradeBusy) continue;
      const ws = socketOf(e.to); if (!ws) continue;
      combatants.touch(e.to);
      const res = combatants.pctHit(e.to, e.pct);
      if (res?.dead) { presence.setDead(ws, true); combatants.get(e.to)?.c.note('deaths'); titleNews(e.to); }
      if (e.knock && !res?.dodge) presence.allowJump(ws, 4);
      send(ws, res ? { ...e, res } : e);
    }
    else if (e.t === 'wb') { if (e.state === 'down') bossUp = false; toAll({ t: 'wbnews', state: e.state, type: e.type, ...(e.mvp != null ? { mvp: byId(e.mvp)?.p.name ?? null } : {}) }); }   // world boss news, to everyone
    else toMap(map, e, except);
  }
}
const arrive = (ws, map) => { for (const p of presence.inMap(map)) send(ws, {t:'pvp_state',id:p.id,...pvp.view(p.id)}); send(ws, { t: 'clock', h: +clock.hour.toFixed(3) }); send(ws, { t: 'mlist', m: worldOf(map).list() }); if (bossUp && clock.phase === 'night') send(ws, { t: 'wbnews', state: 'open' }); };   // a late comer sees the standing boss news (the clock may have just moved: --hour, GM time)

// World boss (src/combat/data/worldBoss.js): news to everyone at dusk and at nightfall (the boss
// rises when its map's monsters run, server/monsters.js); at dawn the night-only maps send everyone
// back out through their door (the arrival of their first portal).
let bossPhase = clock.phase, bossUp = clock.phase === 'night';   // bossUp: from nightfall until the sisters are put down or dawn
function worldBossClock() {
  if (clock.phase === bossPhase) return;
  const was = bossPhase; bossPhase = clock.phase;
  if (bossPhase === 'evening') toAll({ t: 'wbnews', state: 'soon' });
  else if (bossPhase === 'night') { bossUp = true; toAll({ t: 'wbnews', state: 'open' }); }
  else if (was === 'night') {
    bossUp = false; toAll({ t: 'wbnews', state: 'dawn' });
    for (const [ws, p] of [...presence.players]) if (MAP_DATA[p.map]?.nightOnly) leaveNightMap(ws, p);
  }
}
function leaveNightMap(ws, p) {
  const door = MAP_DATA[p.map].portals[0], dest = door.to;
  endTrade(p.id, 'moved'); resetPvp(p.id);
  const left = p.room;
  Object.assign(p, { map: dest, x: door.arrive.x, z: door.arrive.z, f: door.arrive.facing ?? p.f, m: 0, dirty: true, slack: 0, budget: 0 });
  const r = presence.enter(p, pickCh(dest));
  toMap(left, { t: 'leave', id: p.id }, ws);
  send(ws, { t: 'welcome', you: p.id, roster: r.roster, online: presence.count, ch: r.ch, chs: chs(dest) });
  toMap(r.room, { t: 'join', p: r.joined }, ws); correct(ws); arrive(ws, r.room);
}

// positions and monsters out 10× a second, per map; dead sockets dropped every 15 s
setInterval(() => {
  if (stopping) return;
  for (const d of pvp.sweep(id => byId(id)?.p)) endDuel(d);
  syncClock(); worldBossClock();
  combatants.tick(TICK / 1000, clock.phase === 'night');
  const rooms = new Set([...presence.players.values()].map(p => p.room));
  for (const room of rooms) {
    const p = presence.snapshot(room); if (p.length) toMap(room, { t: 'tick', p });
    const w = worldOf(room);
    route(room, w.update(TICK / 1000, presence.inMap(room), clock.phase));
    const m=w.snapshot();
    for(const [ws,p] of presence.players){if(p.room!==room)continue;const before=monsterInterests.get(ws);const next=monsterInterest(w.monsters,m,p,before?.room===room?before.visible:new Set());monsterInterests.set(ws,{room,visible:next.visible});if(next.rows.length)send(ws,{t:'mt',m:next.rows});}
  }
}, TICK);
// channels open and close with the crowd (server/channels.js), checked once a second
setInterval(() => {
  for (const map of MAPS) {
    const { warn, evict } = channels.update(map, presence.counts(map));
    for (const ch of warn) toMap(roomOf(map, ch), { t: 'chwarn', ch, secs: CHANNEL.warn });
    for (const ch of evict) for (const [ws, p] of presence.players) {
      if (p.map !== map || p.ch !== ch || combatants.fighting(p.id) || pvp.view(p.id).duel || pvp.view(p.id).wait) continue;   // the ones fighting go once the fight is over
      moveTo(ws, channels.pick(map, presence.counts(map)), 'closed');
    }
  }
  for (const room of worlds.keys()) { const { map, ch } = parseRoom(room); if (ch > 1 && !channels.chans(map).has(ch)) worlds.delete(room); }
}, 1000);
setInterval(() => toAll({ t: 'clock', h: +clock.hour.toFixed(3) }), 10000);
// signed-in characters: MP to the browser 1×/s, saved to the database every 30 s when changed
const flushEntry = (s, p = null) => {
  if (!s?.persist || !s.dirty) return;
  if (s.tradeBusy) return s.tradeFlush ??= s.tradeTask.then(() => { s.tradeFlush = null; return flushEntry(s, p); });
  if (s.stashBusy) {
    // Disconnect/shutdown must save the adopted bag, never capture the old one.
    return s.stashFlush ??= s.stashTask.then(() => { s.stashFlush = null; return flushEntry(s, p); });
  }
  s.dirty = false;
  return accounts.putCharacter(s.persist.account, s.persist.slot, s.c.toJSON(), s.quests.json(), p ? {map:p.map,x:p.x,z:p.z,facing:p.f} : null,
    { inventoryRevision: s.persist.inventoryRevision ?? 0 }).then(ok => { if (!ok) s.dirty = true; }).catch(e => { s.dirty = true; console.warn('save', e.message); });
};
const flush = id => flushEntry(combatants.get(id), byId(id)?.p);
setInterval(() => { for (const [ws, p] of presence.players) { const s = combatants.get(p.id); if (s?.persist) send(ws, { t: 'me', hp: Math.round(s.c.hp), mp: Math.round(s.c.mp), ack: s.ack }); } }, 1000);
setInterval(() => { if (!stopping) for (const p of presence.players.values()) flush(p.id); }, 30000);
setInterval(() => { for (const [ws] of conns) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);

const shutdown = createShutdown({
  quiesce() { stopping = true; toAll({t:'shutdown',text:'เซิร์ฟเวอร์กำลังบันทึกข้อมูลและเริ่มใหม่'}); server.close(); },
  save() { for (const p of presence.players.values()) {const s=combatants.get(p.id);if(s?.persist)s.dirty=true;flush(p.id);} },
  drain: ms => accounts.writes.wait(null, ms),
  async close() { for (const [ws] of conns) ws.terminate(); await store.pool?.end(); },
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  shutdown().then(() => process.exit(0)).catch(e => { console.error('Shutdown failed; unsaved jobs:', accounts.writes.pending, e.message); process.exit(1); });
});

if (Number.isFinite(startHour)) setHour(startHour);
server.listen(PORT, () => console.log(`ThaiNative Online on :${PORT} (dist ${existsSync(ROOT) ? 'ok' : 'missing — run npm run build'} · saves in ${store.kind})`));
