import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('HTTP/WS: GM titles use live role authority, revoke/logout races and storage remain earned-only', { timeout: 30000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const bootstrap = `
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    import { Accounts } from './server/accounts.js';
    const create = MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount = async function(...args) {
      const ok = await create.apply(this,args);
      if(ok) { const c=Character.create(args[0],'warrior');c.level=args[0]==='qatitlegm'?100:1;c.hp=c.maxHp;
        this.slots.set(args[0],new Map([[0,{data:{'tno.character.v1':JSON.stringify(c)},updated:1}]]));await this.init(); }
      return ok;
    };
    const auth=Accounts.prototype.auth;
    Accounts.prototype.auth=async function(...args) {
      const delayed=new Error().stack.includes('authorizeGm');const result=await auth.apply(this,args);
      if(delayed)await new Promise(r=>setTimeout(r,result==='qatitlereg'?320:120));return result;
    };await import('./server/index.js');`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), DATABASE_URL: '', ADMIN_IDS: 'qatitlegm', GM_ID: '', GM_PASSWORD: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const sockets = []; t.after(() => { sockets.forEach(ws => ws.terminate()); child.kill(); });
  for (let i = 0; i < 150 && !logs.includes('ThaiNative Online on'); i++) await sleep(20);
  assert.match(logs, /ThaiNative Online on/);
  const api = async (path, token, body) => (await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })).json();
  const register = async id => { const r = await api('/api/register', null, { id, password: 'testsecret' }); assert.ok(r.ok); return r; };
  const root = await register('qatitlegm'), regular = await register('qatitlereg');
  const connect = async (auth, extra = {}) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = [], history = []; sockets.push(ws);
    ws.on('message', d => { const m = JSON.parse(d); messages.push(m); history.push(m); }); await once(ws, 'open');
    const wait = async pred => { for (let i = 0; i < 500; i++) { const n = messages.findIndex(pred); if (n >= 0) return messages.splice(n, 1)[0]; await sleep(10); } throw Error('Message timeout ' + logs.slice(-700)); };
    const send = m => ws.send(JSON.stringify(m)); send({ t: 'hello', token: auth?.token, slot: 0, name: 'guest', cls: 'warrior', map: 'city', x: 0, z: 0, ...extra });
    return { ws, wait, send, history, welcome: await wait(m => m.t === 'welcome') };
  };
  const a = await connect(root), b = await connect(regular), guest = await connect(null, { admin: true, account: 'qatitlegm', gmTitleAccess: true });
  assert.equal(a.welcome.admin, true); assert.equal(b.welcome.admin, false); assert.equal(guest.welcome.admin, false);
  const initial = (await a.wait(m => m.t === 'sync')).c;
  const regularInitial = (await b.wait(m => m.t === 'sync')).c;
  a.send({ t: 'ttl', id: 'lg_sin50k' });
  await b.wait(m => m.t === 'ttl' && m.id === a.welcome.you && m.title === 'lg_sin50k');
  a.send({ t: 'resync' }); const chosen = (await a.wait(m => m.t === 'sync' && m.c.title === 'lg_sin50k')).c;
  assert.deepEqual(chosen.titles, initial.titles); assert.equal(chosen.rec.sin, 0); assert.equal(chosen.rec.pkKill, 0);
  b.send({ t: 'ttl', id: 'lg_sin50k', admin: true, token: root.token });
  assert.equal((await b.wait(m => m.t === 'titles')).title, regularInitial.title);
  guest.send({ t: 'ttl', id: 'cp_top1', admin: true, account: 'qatitlegm' });
  assert.equal((await b.wait(m => m.t === 'ttl' && m.id === guest.welcome.you)).title, null);
  const command = async text => { a.send({ t: 'c', text }); return a.wait(m => m.t === 'c' && m.kind === 'gm'); };
  await command('/gm admin add qatitlereg'); await b.wait(m => m.t === 'gmAccess' && m.admin === true);
  b.send({ t: 'ttl', id: 'lv_top1' }); await a.wait(m => m.t === 'ttl' && m.id === b.welcome.you && m.title === 'lv_top1');
  b.send({ t: 'rank' }); await b.wait(m => m.t === 'rank');
  b.send({ t: 'resync' }); const ranked = (await b.wait(m => m.t === 'sync' && m.c.title === 'lv_top1')).c;
  assert.equal(ranked.titles.includes('lv_top1'), false); assert.notEqual(ranked.rec.lvRank, 1);
  const beforeRevoke = a.history.length;
  b.send({ t: 'ttl', id: 'lg_merit50k' }); await sleep(25);
  await command('/gm admin remove qatitlereg');
  assert.equal((await b.wait(m => m.t === 'gmAccess' && m.admin === false)).title, null);
  assert.equal(a.history.slice(beforeRevoke).some(m => m.t === 'ttl' && m.id === b.welcome.you && m.title === 'lg_merit50k'), false, 'role epoch invalidates a delayed selection before entitlement refresh finishes');
  await a.wait(m => m.t === 'ttl' && m.id === b.welcome.you && m.title === null);
  b.send({ t: 'ttl', id: 'rookie' }); await a.wait(m => m.t === 'ttl' && m.id === b.welcome.you && m.title === 'rookie');
  const closed = once(a.ws, 'close'); a.ws.close(); await closed; await sleep(100);
  const again = await connect(root); assert.equal(again.welcome.admin, true);
  assert.equal((await again.wait(m => m.t === 'sync')).c.title, null, 'GM-only selection never persisted');
  again.send({ t: 'ttl', id: 'lg_sin50k' });
  await b.wait(m => m.t === 'ttl' && m.id === again.welcome.you && m.title === 'lg_sin50k');
  // The authorization read has already begun, but logout must win its late result.
  again.send({ t: 'ttl', id: 'lg_merit50k' }); await sleep(25);
  assert.ok((await api('/api/logout', root.token)).ok);
  assert.equal((await again.wait(m => m.t === 'gmAccess' && m.admin === false)).title, null);
  await sleep(220); again.send({ t: 'resync' });
  const loggedOut = (await again.wait(m => m.t === 'sync')).c;
  assert.equal(loggedOut.title, null); assert.equal(loggedOut.titles.includes('lg_sin50k'), false);
  assert.equal(loggedOut.rec.sin, 0); assert.equal(loggedOut.rec.pkKill, 0);
  assert.ok(!guest.history.some(m => m.admin === true || m.gmCommands));
});
