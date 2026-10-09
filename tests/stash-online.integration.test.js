import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { WARP_SERVICES } from '../src/data/warpServices.js';
import { stashIdentity } from '../src/data/stash.js';

test('real HTTP/WS account vault: shared counters, atomic transfers, retries, concurrent withdrawal, auth, saved state and disconnect', { timeout: 20000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  // Seed authoritative live characters once, and delay one real store transaction.
  // Nothing is granted through client messages or the HTTP save API.
  const bootstrap = `
    import { Combatants } from './server/combatants.js';
    import { MemoryStore } from './server/store.js';
    const loaded=new Set(), load=Combatants.prototype.load;
    Combatants.prototype.load=function(id,saved,persist,...args){
      const ok=load.call(this,id,saved,persist,...args), key=persist.account+':'+persist.slot;
      if(ok && !loaded.has(key)) {
        loaded.add(key); const s=this.get(id);
        if(saved.name==='VaultA') {
          s.c.inventory=[{id:'sacred_ore',qty:10},{id:'gold_leaf',qty:3,locked:true},{id:'potion_s',qty:2},{id:'iron_dap',qty:1,plus:7,cards:['card_boar'],locked:true},...Array(20).fill(null)];
          s.c.saveLoadout(0,'Bank set');
        }
        if(saved.name==='VaultB') s.c.inventory=Array(24).fill(null);
        if(saved.name==='VaultDead') s.c.hp=0;
        if(saved.name==='VaultBusy') this.touch(id);
      }
      return ok;
    };
    const transfer=MemoryStore.prototype.transferStash;
    MemoryStore.prototype.transferStash=async function(...args){
      if(args[2].request==='slow_deposit') await new Promise(r=>setTimeout(r,150));
      return transfer.apply(this,args);
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
  const api = async (path, token, method = 'GET', body) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(r.ok, `${path}: ${r.status}`); return r.json();
  };
  async function account(name, slots = [0]) {
    const a = await api('/api/register', null, 'POST', { id: name.toLowerCase(), password: 'fixture-secret' });
    for (const slot of slots) await api(`/api/slots/${slot}`, a.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify({ name: slot ? 'VaultB' : name, classId: 'warrior', gender: 'male' }) } });
    return a;
  }
  const counters = WARP_SERVICES.filter(s => s.map === 'city'), npc = counters[0].npcId;
  async function connect(name, auth, slot = 0, counter = counters[0], place = {}) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', raw => messages.push(JSON.parse(raw))); await once(ws, 'open');
    const client = { ws, messages, send: m => ws.send(JSON.stringify(m)), async wait(predicate) {
      for (let i = 0; i < 400; i++) { const n = messages.findIndex(predicate); if (n >= 0) return messages.splice(n, 1)[0]; await sleep(5); }
      throw Error('WS timeout: ' + logs);
    } };
    client.send({ t: 'hello', name, cls: 'warrior', map: counter.map, x: counter.x, z: counter.z, ...place, ...(auth ? { token: auth.token, slot } : {}) });
    client.id = (await client.wait(m => m.t === 'welcome')).you;
    await client.wait(m => m.t === 'position');
    if (auth) client.character = (await client.wait(m => m.t === 'sync')).c;
    return client;
  }
  async function open(c, counter = counters[0]) {
    c.send({ t: 'stash_open', npc: counter.npcId }); return c.wait(m => m.t === 'stash');
  }
  async function move(c, msg) {
    c.send({ t: 'stash_move', npc, ...msg });
    const r = await c.wait(m => m.t === 'stash_result' && m.request === msg.request);
    if (r.ok || r.why === 'stale' || r.why === 'request_reused') r.stash = await c.wait(m => m.t === 'stash');
    c.character = (await c.wait(m => m.t === 'sync')).c; return r;
  }
  const auth = await account('VaultA', [0, 1]), a = await connect('VaultA', auth), b = await connect('VaultB', auth, 1, counters[1]);
  const guest = await connect('Guest'); guest.send({ t: 'stash_open', npc }); assert.equal((await guest.wait(m => m.t === 'stash_result')).why, 'offline');
  for (const [name, why] of [['VaultDead', 'dead'], ['VaultBusy', 'busy']]) {
    const c = await connect(name, await account(name)); c.send({ t: 'stash_open', npc }); assert.equal((await c.wait(m => m.t === 'stash_result')).why, why);
  }
  const field = WARP_SERVICES.find(s => s.map !== 'city');
  a.send({ t: 'stash_open', npc: field.npcId }); assert.equal((await a.wait(m => m.t === 'stash_result')).why, 'npc');
  await a.wait(m => m.t === 'sync');
  assert.equal((await open(a)).slots.length, 120);
  const bulk = { request: 'deposit_bulk', revision: 0, action: 'deposit_materials', account: 'other', inventory: [{ id: 'sacred_ore', qty: 9999 }] };
  let r = await move(a, bulk); assert.equal(r.ok, true); assert.equal(r.moved, 10);
  assert.equal(a.character.inventory[0], null); assert.equal(a.character.inventory[1].locked, true);
  const uid = r.stash.slots[0].uid;
  r = await move(a, bulk); assert.equal(r.replayed, true); assert.equal(r.stash.revision, 1);
  assert.equal((await open(b, counters[1])).slots[0].qty, 10);
  r = await move(b, { npc: counters[1].npcId, request: 'withdraw_four', revision: 1, action: 'withdraw', uid, qty: 4 });
  assert.equal(r.ok, true); assert.equal(b.character.inventory[0].qty, 4);
  const take = { revision: 2, action: 'withdraw', uid, qty: 6 };
  const results = await Promise.all([move(a, { ...take, request: 'withdraw_A' }), move(b, { ...take, npc: counters[1].npcId, request: 'withdraw_B' })]);
  assert.equal(results.filter(x => x.ok).length, 1); assert.equal(results.find(x => !x.ok).why, 'stale');
  let vault = await open(a); assert.equal(vault.revision, 3); assert.equal(vault.slots.filter(Boolean).length, 0);
  const gear = a.character.inventory[3], depositGear = { request: 'deposit_gear', revision: 3, action: 'deposit', index: 3, qty: 1, expected: stashIdentity(gear) };
  r = await move(a, depositGear); assert.equal(r.ok, true); const gearUid = r.stash.slots.find(Boolean).uid;
  r = await move(b, { npc: counters[1].npcId, request: 'withdraw_gear', revision: 4, action: 'withdraw', uid: gearUid, qty: 1 });
  assert.equal(r.ok, true); assert.deepEqual(b.character.inventory.find(s => s?.id === 'iron_dap'), gear);
  r = await move(a, depositGear); assert.equal(r.replayed, true); assert.equal(r.stash.revision, 5);
  // A pre-transfer client save cannot grant an item or replace current bag state.
  await api('/api/slots/0', auth.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify({ ...a.character, inventory: [{ id: 'sacred_ore', qty: 99999 }] }) } });
  const savedA = JSON.parse((await api('/api/slots', auth.token)).slots.find(s => s.slot === 0).data['tno.character.v1']);
  assert.equal(savedA.inventory[3], null); assert.deepEqual(savedA.loadouts, a.character.loadouts);
  // During pending SQL, an optimistic op is refused and acknowledged. Closing the
  // socket still commits once and the next connection loads the deposited bag.
  a.messages.length = 0;
  a.send({ t: 'stash_move', npc, request: 'slow_deposit', revision: 5, action: 'deposit', index: 2, qty: 1, expected: stashIdentity(a.character.inventory[2]) });
  a.send({ t: 'op', n: 1, op: 'use', id: 'potion_s' });
  const blocked = await a.wait(m => m.t === 'sync' && m.c.ack === 1); assert.equal(blocked.c.inventory[2].qty, 2);
  const closed = once(a.ws, 'close'); a.ws.close(); await closed;
  const rejoined = await connect('VaultA', auth), after = await open(rejoined);
  assert.equal(after.revision, 6); assert.equal(after.slots.find(s => s?.id === 'potion_s').qty, 1);
  assert.equal(rejoined.character.inventory[2].qty, 1); assert.deepEqual(rejoined.character.loadouts, a.character.loadouts);
  r = await move(rejoined, { request: 'slow_deposit', revision: 5, action: 'deposit', index: 2, qty: 1, expected: stashIdentity(a.character.inventory[2]) });
  assert.equal(r.replayed, true); assert.equal(r.stash.revision, 6); assert.equal(rejoined.character.inventory[2].qty, 1);
  assert.doesNotMatch(logs, /unhandled|message .*Error|save .*Error/);
});
