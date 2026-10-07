// ThaiNative Online server: serves the built game (dist/) and the realtime link at /ws.
//   npm run build && npm start          (PORT, default 8787)
// Phase 1 (docs/technical/SERVER_SPLIT.md): presence and chat. Phase 2: accounts and
// character saves (server/accounts.js, Postgres via DATABASE_URL) over /api:
//   GET  /api/health → { accounts }        POST /api/register | /api/login {id, password} → { token, id }
//   POST /api/google {credential} → { token, id }   POST /api/google/link {credential} (signed in)
//   POST /api/logout                        GET /api/slots → [{ slot, data, updated }]
//   PUT  /api/slots/:n  { data }            DELETE /api/slots/:n          (Authorization: Bearer <token>)
// Realtime messages are small JSON objects with a type `t`:
//   client → server  hello {token?, slot?, name, cls, gender, lv, map, x, z, f} · s {x, z, f, m} ·
//                    map {map, x, z, f} · a {clip, sp} · c {text} · lv {lv}
//   server → client  welcome {you, roster, online} · join {p} · leave {id} ·
//                    tick {p: [[id, x, z, f, m], …]} · a {id, clip, sp} · c {id, name, map, text} ·
//                    lv {id, lv} · online {n} · full {}
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { Presence, rateLimiter } from './presence.js';
import { openStore } from './store.js';
import { Accounts } from './accounts.js';

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
    if (req.method === 'GET' && url.pathname === '/api/slots') return json(res, 200, { ok: true, id, slots: await accounts.slots(id) });
    const m = /^\/api\/slots\/(\d+)$/.exec(url.pathname);
    if (m && req.method === 'PUT') { const r = await accounts.save(id, Number(m[1]), (await readBody(req)).data); return json(res, r.ok ? 200 : 400, r); }
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
const toMap = (map, msg, except = null) => { const s = JSON.stringify(msg); for (const [ws] of conns) if (ws !== except && presence.players.get(ws)?.map === map && ws.readyState === 1) ws.send(s); };
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
        const r = presence.join(ws, m);
        if (!r) return;
        if (r.full) { send(ws, { t: 'full' }); ws.close(); return; }
        send(ws, { t: 'welcome', you: r.you, roster: r.roster, online: presence.count });
        toMap(r.map, { t: 'join', p: r.joined }, ws); toAll({ t: 'online', n: presence.count });
        break;
      }
      case 's': presence.move(ws, m); break;
      case 'map': {
        const r = presence.changeMap(ws, m); if (!r) return;
        toMap(r.left, { t: 'leave', id: r.id }, ws);
        send(ws, { t: 'welcome', you: r.id, roster: r.roster, online: presence.count });
        toMap(r.map, { t: 'join', p: r.joined }, ws);
        break;
      }
      case 'a': { const r = presence.anim(ws, m); if (r) toMap(r.map, r, ws); break; }
      case 'c': { const r = presence.chat(ws, m.text); if (r) toAll(r); break; }
      case 'lv': { const r = presence.setLevel(ws, m.lv); const p = presence.players.get(ws); if (r && p) toMap(p.map, { t: 'lv', ...r }, ws); break; }
    }
  });
  ws.on('close', () => {
    conns.delete(ws);
    const r = presence.leave(ws);
    if (r) { toMap(r.map, { t: 'leave', id: r.id }); toAll({ t: 'online', n: presence.count }); }
  });
});

// positions out 10× a second, per map; dead sockets dropped every 15 s
setInterval(() => {
  const maps = new Set([...presence.players.values()].map(p => p.map));
  for (const map of maps) { const p = presence.snapshot(map); if (p.length) toMap(map, { t: 'tick', p }); }
}, TICK);
setInterval(() => { for (const [ws] of conns) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000);

server.listen(PORT, () => console.log(`ThaiNative Online on :${PORT} (dist ${existsSync(ROOT) ? 'ok' : 'missing — run npm run build'} · saves in ${store.kind})`));
