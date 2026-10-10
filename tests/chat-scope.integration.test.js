import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { CHANNEL } from '../server/channels.js';
import { LIMITS } from '../server/presence.js';

test('chat scope routes by authoritative map and channel', { timeout: 30000 }, async t => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', ADMIN_IDS: '', GM_ID: '', GM_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const peers = [];
  t.after(() => { for (const peer of peers) peer.ws.terminate(); child.kill(); });
  for (let i = 0; i < 300 && !logs.includes('ThaiNative Online on'); i++) await delay(20);
  assert.match(logs, /ThaiNative Online on/);

  async function connect(map) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages = [], chats = [];
    const peer = { ws, chats, send: message => ws.send(JSON.stringify(message)) };
    peers.push(peer);
    ws.on('message', data => {
      const message = JSON.parse(data);
      if (message.t === 'c') chats.push(message);
      else if (message.t === 'welcome' || message.t === 'who') messages.push(message);
    });
    peer.wait = async predicate => {
      for (let i = 0; i < 500; i++) {
        const at = messages.findIndex(predicate);
        if (at >= 0) return messages.splice(at, 1)[0];
        await delay(10);
      }
      throw new Error(`Message timeout: ${logs.slice(-500)}`);
    };
    await once(ws, 'open');
    peer.send({ t: 'hello', name: `ChatQA${peers.length}`, cls: 'warrior', map, x: 0, z: 0 });
    peer.welcome = await peer.wait(message => message.t === 'welcome');
    return peer;
  }

  const sender = await connect('paddy'), neighbor = await connect('paddy');
  const firstChannelSize = Math.ceil((CHANNEL.cap.paddy ?? CHANNEL.capDefault) * CHANNEL.openAt);
  for (let i = 2; i < firstChannelSize; i++) await connect('paddy');
  const otherChannel = await connect('paddy'), otherMap = await connect('city');
  assert.equal(sender.welcome.ch, 1);
  assert.equal(neighbor.welcome.ch, 1);
  assert.equal(otherChannel.welcome.ch, 2);
  assert.equal(otherMap.welcome.ch, 1);

  // A same-socket who reply is a processing barrier. Barrier the sender first,
  // then all recipients: any earlier chat delivery precedes their who reply.
  async function barrier(peer) {
    peer.send({ t: 'who' });
    await peer.wait(message => message.t === 'who');
  }
  async function settle() {
    await barrier(sender);
    await Promise.all(peers.map(barrier));
  }
  const received = (peer, text) => peer.chats.filter(message => message.text === text);
  async function broadcast(message, recipients, kind) {
    sender.send({ t: 'c', ...message });
    await settle();
    for (const peer of peers) {
      const lines = received(peer, message.text);
      assert.equal(lines.length, recipients.includes(peer) ? 1 : 0, `delivery to player ${peer.welcome.you}`);
      if (lines.length) {
        assert.equal(lines[0].id, sender.welcome.you);
        assert.equal(lines[0].map, 'paddy');
        assert.equal(lines[0].kind, kind);
      }
    }
  }
  const sameRoom = peers.filter(peer => peer !== otherChannel && peer !== otherMap);
  const cooldown = () => delay(LIMITS.chatEvery * 1000 + 50);

  await t.test('area includes sender and same room, excludes other maps and channels', async () => {
    await broadcast({ scope: 'area', text: 'area room' }, sameRoom, 'area');
  });
  await t.test('area ignores spoofed map, channel, room and kind', async () => {
    await cooldown();
    await broadcast({ scope: 'area', text: 'spoofed room', map: 'city', ch: 2, room: 'paddy#2', kind: 'world' }, sameRoom, 'area');
  });
  await t.test('explicit World reaches everyone with the existing packet shape', async () => {
    await cooldown();
    await broadcast({ scope: 'world', text: 'explicit world' }, peers, undefined);
  });
  await t.test('old clients without scope still reach everyone', async () => {
    await cooldown();
    await broadcast({ text: 'legacy world' }, peers, undefined);
  });
  await t.test('invalid scopes never fall back to World or leak to any player', async () => {
    await cooldown();
    for (const [index, scope] of ['party', 'AREA', '', null, 0, false, {}, []].entries()) {
      sender.send({ t: 'c', scope, text: `invalid scope ${index}` });
    }
    await settle();
    for (const peer of peers) assert.ok(!peer.chats.some(message => message.text.startsWith('invalid scope')));
    await broadcast({ scope: 'area', text: 'valid after rejection' }, sameRoom, 'area');
  });
  await t.test('area and World share the existing chat throttle', async () => {
    await cooldown();
    sender.send({ t: 'c', scope: 'area', text: 'throttle area' });
    sender.send({ t: 'c', scope: 'world', text: 'throttle world' });
    await settle();
    assert.equal(received(sender, 'throttle area').length, 1);
    for (const peer of peers) assert.equal(received(peer, 'throttle world').length, 0);
  });
});
