import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { LIMITS } from '../server/presence.js';
import { CHAT_RULES } from '../server/chat-guard.js';

// The real server (MemoryStore, no database): World chat rules, rude-word masking, blocks,
// history replay for newcomers and reports. Characters are seeded with fixed levels.
test('chat moderation: World rules, masking, blocks, history and reports', { timeout: 40000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const seeds = { chata: ['ChatAnna', 10], chatb: ['ChatBee', 10], chatlow: ['ChatLow', 2] };
  const bootstrap = `
    process.loadEnvFile=()=>{};
    const seeds=${JSON.stringify(seeds)};
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    const create=MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount=async function(...args){
      const ok=await create.apply(this,args), seed=seeds[args[0]];
      if(ok&&seed){const c=Character.create(seed[0],'warrior');c.level=seed[1];
        await this.putSlot(args[0],0,{'tno.character.v1':JSON.stringify(c.toJSON()),'tno.location.v1':JSON.stringify({map:'paddy',x:0,z:-130})});}
      return ok;
    };
    await import('./server/index.js');`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', ADMIN_IDS: '', GM_ID: '', GM_PASSWORD: '', GOOGLE_CLIENT_ID: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  const peers = [];
  t.after(() => { for (const p of peers) p.ws.terminate(); child.kill(); });
  for (let i = 0; i < 300 && !logs.includes('ThaiNative Online on'); i++) await delay(20);
  assert.match(logs, /ThaiNative Online on/);
  const base = `http://127.0.0.1:${port}`;
  const register = async id => (await (await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, password: 'testsecret' }) })).json());

  async function connect(account) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), all = [];
    const peer = { ws, all, send: m => ws.send(JSON.stringify(m)) };
    peers.push(peer);
    ws.on('message', d => all.push(JSON.parse(d)));
    peer.wait = async (pred, what = 'message') => {
      for (let i = 0; i < 500; i++) { const at = all.findIndex(pred); if (at >= 0) return all.splice(at, 1)[0]; await delay(10); }
      throw new Error(`timeout waiting for ${what}: ${logs.slice(-400)}`);
    };
    // the who reply is a processing barrier: anything sent before it was already handled
    peer.settle = async () => { peer.send({ t: 'who' }); await peer.wait(m => m.t === 'who', 'who'); };
    peer.lines = text => all.filter(m => (m.t === 'c' || m.t === 'w' || m.t === 'pc') && m.text === text);
    peer.system = re => all.some(m => m.t === 'c' && m.id === null && re.test(m.text));
    await once(ws, 'open');
    if (account) { const r = await register(account); assert.ok(r.ok, JSON.stringify(r)); peer.send({ t: 'hello', token: r.token, slot: 0, map: 'paddy', x: 0, z: -130 }); }
    else peer.send({ t: 'hello', name: 'ChatGuest', cls: 'hunter', map: 'paddy', x: 0, z: -130 });
    peer.welcome = await peer.wait(m => m.t === 'welcome', 'welcome');
    return peer;
  }
  const a = await connect('chata'), b = await connect('chatb'), low = await connect('chatlow');
  const settleAll = async () => { for (const p of peers) await p.settle(); };
  const gap = () => delay(LIMITS.chatEvery * 1000 + 60);

  await t.test('World reaches everyone from Lv 5, rude words are masked, and the pace is limited', async () => {
    a.send({ t: 'c', scope: 'world', text: 'สวัสดี ควยยย fuck you' });
    await settleAll();
    for (const p of [a, b, low]) assert.equal(p.lines('สวัสดี ✱✱✱✱✱ ✱✱✱✱ you').length, 1, `world line to ${p.welcome.you}`);
    await gap();
    a.send({ t: 'c', scope: 'world', text: 'again too soon' });
    await settleAll();
    assert.equal(b.lines('again too soon').length, 0);
    assert.ok(a.system(new RegExp(`ทุก ${CHAT_RULES.worldEvery} วินาที`)));
    low.send({ t: 'c', scope: 'world', text: 'low level world' });
    await settleAll();
    assert.equal(a.lines('low level world').length, 0);
    assert.ok(low.system(new RegExp(`Lv ${CHAT_RULES.worldMinLevel}`)));
  });

  await t.test('a block stops area lines, whispers and invites from that name only', async () => {
    b.send({ t: 'block', name: 'ChatAnna' });
    const list = await b.wait(m => m.t === 'blocks', 'blocks');
    assert.deepEqual(list.list, ['ChatAnna']);
    await gap();
    a.send({ t: 'c', scope: 'area', text: 'area after block' });
    await settleAll();
    assert.equal(b.lines('area after block').length, 0);
    assert.equal(low.lines('area after block').length, 1);
    await gap();
    a.send({ t: 'w', to: 'ChatBee', text: 'whisper after block' });
    await settleAll();
    assert.equal(b.lines('whisper after block').length, 0);
    assert.equal(a.lines('whisper after block').length, 1, 'the sender still sees an echo');
    a.send({ t: 'pinv', id: b.welcome.you });
    assert.equal((await a.wait(m => m.t === 'pno', 'pno')).why, 'declined');
    await gap();
    low.send({ t: 'c', scope: 'area', text: 'others still reach b' });
    await settleAll();
    assert.equal(b.lines('others still reach b').length, 1);
    b.send({ t: 'unblock', name: 'ChatAnna' });
    assert.deepEqual((await b.wait(m => m.t === 'blocks', 'unblock')).list, []);
  });

  await t.test('a newcomer gets the recent public lines once, masked', async () => {
    const guest = await connect(null);
    const hist = await guest.wait(m => m.t === 'chist', 'chist');
    const texts = hist.lines.map(l => l.text);
    assert.ok(texts.includes('สวัสดี ✱✱✱✱✱ ✱✱✱✱ you'));
    assert.ok(texts.includes('area after block'));
    assert.ok(hist.lines.every(l => Number.isFinite(l.at)));
    guest.send({ t: 'c', scope: 'world', text: 'guest world' });
    await settleAll();
    assert.equal(a.lines('guest world').length, 0);
    assert.ok(guest.system(/เข้าสู่ระบบ/));
  });

  await t.test('reports are acknowledged and paced', async () => {
    b.send({ t: 'report', name: 'ChatAnna', reason: 'rude', note: 'คำหยาบในช่องโลก' });
    await b.settle();
    assert.ok(b.system(/ส่งรายงาน ChatAnna/));
    b.send({ t: 'report', name: 'ChatAnna', reason: 'spam' });
    await b.settle();
    assert.ok(b.system(/รายงานได้อีกครั้ง/));
    assert.match(logs, /\[report\].*ChatAnna.*rude/);
  });
});
