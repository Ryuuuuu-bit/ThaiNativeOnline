import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { shopSpot } from '../src/data/shopSites.js';
import { sellPrice } from '../src/shop/ShopSystem.js';

test('real signed-in WS: sell 9999 items, buy 999, keep connection and reload persisted totals', { timeout: 15000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  // Seed only this isolated child's memory store with an earned-loot fixture. The
  // production HTTP/WS handlers and account reconciliation remain unchanged.
  const bootstrap = `
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    const create = MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount = async function(...args) {
      const ok = await create.apply(this, args);
      if (ok && args[0] === 'shopqa') {
        const c = Character.create('ShopQA', 'hunter'); c.gold = 20000;
        c.inventory.fill(null); c.addItem('potion_s', 9000); c.addItem('ash', 999);
        await this.putSlot(args[0], 0, { 'tno.character.v1': JSON.stringify(c) });
      }
      return ok;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  t.after(() => { if (child.exitCode === null) child.kill(); });
  for (let i = 0; i < 100 && !logs.includes('ThaiNative Online on'); i++) await new Promise(r => setTimeout(r, 30));
  assert.match(logs, /ThaiNative Online on/);
  const auth = await (await fetch(`http://127.0.0.1:${port}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'shopqa', password: 'testsecret' }) })).json();
  assert.ok(auth.ok);
  const sockets = []; t.after(() => sockets.forEach(ws => ws.terminate()));
  const pos = shopSpot('general');
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', d => messages.push(JSON.parse(d))); await once(ws, 'open');
    const send = m => ws.send(JSON.stringify(m));
    const wait = async pred => {
      for (let i = 0; i < 300; i++) {
        const at = messages.findIndex(pred); if (at >= 0) return messages.splice(at, 1)[0];
        await new Promise(r => setTimeout(r, 10));
      }
      throw Error('WS timeout: ' + logs);
    };
    send({ t: 'hello', token: auth.token, slot: 0, ...pos });
    const initial = (await wait(m => m.t === 'sync')).c;
    return { ws, send, wait, initial };
  }
  const a = await connect();
  assert.equal(a.initial.inventory[0].qty, 9000);
  a.send({ t: 'op', n: 1, op: 'sell_batch', lines: [{ index: 0, id: 'potion_s', qty: 9000 }, { index: 1, id: 'ash', qty: 999 }] });
  a.send({ t: 'resync' });
  const sold = (await a.wait(m => m.t === 'sync' && m.c.ack === 1)).c;
  const proceeds = 9000 * sellPrice('potion_s') + 999 * sellPrice('ash');
  assert.equal(sold.gold, 20000 + proceeds); assert.equal(sold.inventory.filter(Boolean).length, 0);
  a.send({ t: 'op', n: 2, op: 'buy', shop: 'general', id: 'potion_s', qty: 999 });
  a.send({ t: 'resync' });
  const bought = (await a.wait(m => m.t === 'sync' && m.c.ack === 2)).c;
  assert.equal(bought.inventory[0].qty, 999); assert.equal(bought.gold, sold.gold - 9990);
  assert.equal(a.ws.readyState, WebSocket.OPEN);
  const closed = once(a.ws, 'close'); a.ws.close(); await closed;
  const b = await connect();
  assert.equal(b.initial.gold, bought.gold); assert.deepEqual(b.initial.inventory, bought.inventory);
  assert.doesNotMatch(logs, /unhandled|message .*Error/);
});
