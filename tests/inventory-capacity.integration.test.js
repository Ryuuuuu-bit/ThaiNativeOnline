import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { shopSpot } from '../src/data/shopSites.js';
import { sellPrice } from '../src/shop/ShopSystem.js';

test('real WS sells all 500 slots in one op, keeps the socket open and persists empty capacity', { timeout: 15000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const bootstrap = `
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    const create = MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount = async function(...args) {
      const ok = await create.apply(this, args);
      if (ok && args[0] === 'bagqa') {
        const c = Character.create('BagQA', 'warrior');
        c.inventory = Array.from({length:500}, () => ({id:'ash',qty:1}));
        await this.putSlot(args[0], 0, {'tno.character.v1':JSON.stringify(c)});
      }
      return ok;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', ADMIN_IDS: '', GM_ID: '', GM_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  const sockets = [];
  t.after(() => { sockets.forEach(ws => ws.terminate()); child.kill(); });
  for (let i = 0; i < 200 && !logs.includes('ThaiNative Online on'); i++) await delay(20);
  assert.match(logs, /ThaiNative Online on/);
  const auth = await (await fetch(`http://127.0.0.1:${port}/api/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'bagqa', password: 'testsecret' }),
  })).json();
  assert.ok(auth.ok);
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', d => messages.push(JSON.parse(d))); await once(ws, 'open');
    const send = m => ws.send(JSON.stringify(m));
    const wait = async predicate => {
      for (let i = 0; i < 500; i++) {
        const at = messages.findIndex(predicate);
        if (at >= 0) return messages.splice(at, 1)[0];
        if (ws.readyState === WebSocket.CLOSED) throw new Error(`Socket closed: ${logs}`);
        await delay(10);
      }
      throw new Error(`WS timeout: ${logs}`);
    };
    send({ t: 'hello', token: auth.token, slot: 0, ...shopSpot('general') });
    return { ws, send, wait, initial: (await wait(m => m.t === 'sync')).c };
  }
  const a = await connect();
  assert.equal(a.initial.inventory.length, 500);
  const batch = { t: 'op', n: 1, op: 'sell_batch', lines: a.initial.inventory.map((s, index) => ({ index, id: s.id, qty: s.qty })) };
  assert.ok(Buffer.byteLength(JSON.stringify(batch)) > 2048, 'regression exceeds the old WS budget');
  a.send(batch); a.send({ t: 'resync' });
  const sold = (await a.wait(m => m.t === 'sync' && m.c.ack === 1)).c;
  assert.equal(sold.gold, a.initial.gold + 500 * sellPrice('ash'));
  assert.equal(sold.inventory.length, 500); assert.ok(sold.inventory.every(s => s === null));
  a.send({ t: 'who' }); await a.wait(m => m.t === 'who');
  assert.equal(a.ws.readyState, WebSocket.OPEN);
  const closed = once(a.ws, 'close'); a.ws.close(); await closed;
  const b = await connect();
  assert.equal(b.initial.gold, sold.gold);
  assert.deepEqual(b.initial.inventory, sold.inventory);
});
