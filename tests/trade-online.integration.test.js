import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';

test('HTTP/WS trade confirms only after durable retry, refuses pending mutation and saves both balances', { timeout: 20000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const bootstrap = `
    import { Combatants } from './server/combatants.js';
    import { MemoryStore } from './server/store.js';
    const load=Combatants.prototype.load;
    Combatants.prototype.load=function(...args){const ok=load.apply(this,args);if(ok)this.get(args[0]).c.gold=100;return ok;};
    const transfer=MemoryStore.prototype.transferTrade;
    let first=true;
    MemoryStore.prototype.transferTrade=async function(...args){
      await new Promise(r=>setTimeout(r,150));
      const result=await transfer.apply(this,args);
      if(first){first=false;throw Error('uncertain committed response');}
      return result;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '', ADMIN_IDS: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const sockets = []; t.after(() => { sockets.forEach(s => s.terminate()); if (child.exitCode === null) child.kill(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 150 && !logs.includes('ThaiNative Online on'); i++) await sleep(20);
  assert.match(logs, /ThaiNative Online on/);
  const request = (path, token, method = 'GET', body) => fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const api = async (...args) => { const response = await request(...args); assert.ok(response.ok, `${args[0]}: ${response.status}`); return response.json(); };
  async function connect(name) {
    const auth = await api('/api/register', null, 'POST', { id: name.toLowerCase(), password: 'fixture-secret' });
    await api('/api/slots/0', auth.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify({ name, classId: 'warrior', gender: 'male' }) } });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', raw => messages.push(JSON.parse(raw))); await once(ws, 'open');
    const client = { auth, ws, messages, send: m => ws.send(JSON.stringify(m)), async wait(predicate) {
      for (let i = 0; i < 600; i++) { const n = messages.findIndex(predicate); if (n >= 0) return messages.splice(n, 1)[0]; await sleep(5); }
      throw Error('WS timeout: ' + JSON.stringify(messages) + logs);
    } };
    client.send({ t: 'hello', name, cls: 'warrior', map: 'city', x: 0, z: 0, token: auth.token, slot: 0 });
    client.id = (await client.wait(m => m.t === 'welcome')).you;
    await client.wait(m => m.t === 'position'); await client.wait(m => m.t === 'sync');
    return client;
  }
  const a = await connect('TraderA'), b = await connect('TraderB');
  a.send({ t: 'treq', id: b.id }); await b.wait(m => m.t === 'treq');
  b.send({ t: 'tans', from: a.id, ok: true });
  await Promise.all([a.wait(m => m.t === 'trade'), b.wait(m => m.t === 'trade')]);
  a.send({ t: 'toffer', items: [], gold: 40 }); await a.wait(m => m.t === 'trade' && m.mine.gold === 40);
  b.send({ t: 'toffer', items: [], gold: 10 }); await b.wait(m => m.t === 'trade' && m.mine.gold === 10);
  a.send({ t: 'tlock' }); b.send({ t: 'tlock' });
  await a.wait(m => m.t === 'trade' && m.locked.me && m.locked.them);
  a.send({ t: 'tconf' }); b.send({ t: 'tconf' });
  await sleep(30);
  assert.ok(!a.messages.some(m => m.t === 'tend'));
  assert.equal((await request('/api/slots/0', a.auth.token, 'PUT', { data: {} })).status, 409);
  a.send({ t: 'op', n: 1, op: 'sort' }); await a.wait(m => m.t === 'sync' && m.c.ack === 1);
  assert.equal((await a.wait(m => m.t === 'tend')).ok, true);
  assert.equal((await b.wait(m => m.t === 'tend')).ok, true);
  assert.equal((await a.wait(m => m.t === 'sync' && m.c.gold === 70)).c.gold, 70);
  assert.equal((await b.wait(m => m.t === 'sync' && m.c.gold === 130)).c.gold, 130);
  for (const [client, gold] of [[a, 70], [b, 130]]) {
    const saved = JSON.parse((await api('/api/slots', client.auth.token)).slots[0].data['tno.character.v1']);
    assert.equal(saved.gold, gold);
  }
  assert.doesNotMatch(logs, /unhandled|message .*Error/);
});
