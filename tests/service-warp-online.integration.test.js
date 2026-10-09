import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { WARP_SERVICES, WARP_DESTINATIONS, WARP_COOLDOWN, getWarpDestination } from '../src/data/warpServices.js';
import { MAPS } from '../src/world/maps.js';

test('real HTTP/WS steward travel: fixed destinations, guest/state gates, shared cooldown, rooms, same-map snapshots and saved location', { timeout: 25000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  // Fixture only: put two signed-in characters into real dead/combat state when
  // loaded. All request validation, movement, transfers and saves are production.
  const bootstrap = `
    import { Combatants } from './server/combatants.js';
    const load = Combatants.prototype.load;
    Combatants.prototype.load = function(id, saved, ...args) {
      const ok = load.call(this, id, saved, ...args);
      if (ok && saved.name === 'WarpDead') this.get(id).c.hp = 0;
      if (ok && saved.name === 'WarpBusy') this.touch(id);
      return ok;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '', ADMIN_IDS: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const sockets = [];
  t.after(() => { for (const ws of sockets) ws.terminate(); if (child.exitCode === null) child.kill(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 150 && !logs.includes('ThaiNative Online on'); i++) await sleep(20);
  assert.match(logs, /ThaiNative Online on/);
  const api = async (path, token, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`); return response.json();
  };
  async function account(name) {
    const auth = await api('/api/register', null, 'POST', { id: name.toLowerCase(), password: 'fixture-secret' }); assert.ok(auth.ok);
    assert.ok((await api('/api/slots/0', auth.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify({ name, classId: 'muaythai', gender: 'male' }) } })).ok);
    return auth;
  }
  async function connect(name, place, auth = null) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', d => messages.push(JSON.parse(d))); await once(ws, 'open');
    const send = m => ws.send(JSON.stringify(m));
    const wait = async predicate => {
      for (let i = 0; i < 350; i++) {
        const at = messages.findIndex(predicate); if (at >= 0) return messages.splice(at, 1)[0]; await sleep(10);
      }
      throw Error('WS timeout: ' + logs);
    };
    const p = { ws, messages, send, wait };
    if (place) {
      send({ t: 'hello', name, cls: 'muaythai', ...place, ...(auth ? { token: auth.token, slot: 0 } : {}) });
      p.welcome = await wait(m => m.t === 'welcome'); p.id = p.welcome.you;
      p.position = await wait(m => m.t === 'position');
      if (auth) p.initial = (await wait(m => m.t === 'sync')).c;
    }
    return p;
  }
  const city = WARP_SERVICES.find(s => s.map === 'city'), field = WARP_SERVICES.find(s => s.map === 'paddy');
  const request = (s, d, extra = {}) => ({ t: 'service_warp', npc: s.npcId, destination: d.id, ...extra });
  const here = s => ({ map: s.map, x: s.x, z: s.z });
  const cityDestination = getWarpDestination(city.arrivalId), fieldDestination = getWarpDestination(field.arrivalId);
  const anotherCity = WARP_DESTINATIONS.find(d => d.map === 'city' && d.id !== cityDestination.id);
  const auth = await account('WarpTraveller'), a = await connect('WarpTraveller', here(city), auth);
  const cityWitness = await connect('CityWitness', here(city));
  const bAuth = await account('WarpPartner'), b = await connect('WarpPartner', here(field), bAuth);
  const no = async (p, msg, why) => { p.send(msg); assert.equal((await p.wait(m => m.t === 'service_warp_no')).why, why); };
  const unjoined = await connect('Unjoined'); await no(unjoined, request(city, cityDestination), 'offline');
  await no(a, request(city, cityDestination, { npc: '__proto__' }), 'npc');
  await no(a, request(city, cityDestination, { destination: 'constructor' }), 'destination');
  await no(a, request(field, fieldDestination), 'map');
  const far = await connect('FarGuest', { map: 'city', ...MAPS.city.spawn });
  await no(far, request(city, fieldDestination, { map: city.map, x: city.x, z: city.z }), 'far');
  const dead = await connect('WarpDead', here(city), await account('WarpDead'));
  await no(dead, request(city, cityDestination), 'dead');
  const busy = await connect('WarpBusy', here(city), await account('WarpBusy'));
  await no(busy, request(city, cityDestination), 'busy');
  // A free guest uses exactly the same fixed-ID authority path.
  cityWitness.send(request(city, cityDestination));
  const guestPosition = await cityWitness.wait(m => m.t === 'position' && m.reason === 'service_warp');
  assert.deepEqual([guestPosition.map, guestPosition.x, guestPosition.z, guestPosition.f], [cityDestination.map, cityDestination.x, cityDestination.z, cityDestination.facing]);
  // A malformed client location cannot alter the registered destination or channel.
  a.send(request(city, fieldDestination, { map: 'demon_rift', x: 999, z: 999, facing: 0, ch: 9 }));
  let moved = await a.wait(m => m.t === 'position' && m.reason === 'service_warp');
  assert.deepEqual([moved.map, moved.x, moved.z, moved.f, moved.destination], [fieldDestination.map, fieldDestination.x, fieldDestination.z, fieldDestination.facing, fieldDestination.id]);
  const fieldWelcome = await a.wait(m => m.t === 'welcome' && m.roster.some(p => p.id === b.id));
  assert.equal(fieldWelcome.chs[0].cap, 35, 'channel metadata belongs to the actual destination');
  await cityWitness.wait(m => m.t === 'leave' && m.id === a.id);
  const joined = await b.wait(m => m.t === 'join' && m.p.id === a.id);
  assert.deepEqual([joined.p.x, joined.p.z], [fieldDestination.x, fieldDestination.z]);
  await no(a, request(field, cityDestination), 'cooldown');
  a.send({ t: 'treq', id: b.id }); await b.wait(m => m.t === 'treq');
  b.send({ t: 'tans', from: a.id, ok: true }); await a.wait(m => m.t === 'trade'); await b.wait(m => m.t === 'trade');
  await no(a, request(field, cityDestination), 'busy');
  a.send({ t: 'tcancel' }); await a.wait(m => m.t === 'tend'); await b.wait(m => m.t === 'tend');
  a.send({ t: 'duel_request', id: b.id }); await b.wait(m => m.t === 'duel_invite');
  b.send({ t: 'duel_answer', from: a.id, ok: true }); await a.wait(m => m.t === 'duel_start'); await b.wait(m => m.t === 'duel_start');
  await no(a, request(field, cityDestination), 'busy');
  a.send({ t: 'duel_cancel' }); await a.wait(m => m.t === 'duel_end'); await b.wait(m => m.t === 'duel_end');
  await sleep(WARP_COOLDOWN * 1000 + 100);
  a.send(request(field, cityDestination)); await a.wait(m => m.t === 'position' && m.reason === 'service_warp' && m.destination === cityDestination.id);
  const returned = await a.wait(m => m.t === 'welcome' && m.roster.some(p => p.id === cityWitness.id));
  await cityWitness.wait(m => m.t === 'join' && m.p.id === a.id && m.p.x === cityDestination.x && m.p.z === cityDestination.z);
  // Same-map relocation must not bypass channel switching or leave peers stale.
  await no(a, request(city, anotherCity), 'cooldown');
  cityWitness.messages.length = 0;
  await sleep(WARP_COOLDOWN * 1000 + 100);
  a.send(request(city, anotherCity)); moved = await a.wait(m => m.t === 'position' && m.reason === 'service_warp' && m.destination === anotherCity.id);
  assert.deepEqual([moved.map, moved.x, moved.z], ['city', anotherCity.x, anotherCity.z]);
  assert.equal((await a.wait(m => m.t === 'welcome')).ch, returned.ch);
  await cityWitness.wait(m => m.t === 'leave' && m.id === a.id);
  const sameMapJoin = await cityWitness.wait(m => m.t === 'join' && m.p.id === a.id);
  assert.deepEqual([sameMapJoin.p.x, sameMapJoin.p.z], [anotherCity.x, anotherCity.z]);
  const tick = await cityWitness.wait(m => m.t === 'tick' && m.p.some(p => p[0] === a.id && p[1] === anotherCity.x && p[2] === anotherCity.z));
  assert.deepEqual(tick.p.find(p => p[0] === a.id).slice(1, 3), [anotherCity.x, anotherCity.z]);
  a.send({ t: 'resync' }); const after = (await a.wait(m => m.t === 'sync')).c;
  for (const key of ['gold', 'inventory', 'equipment', 'skills']) assert.deepEqual(after[key], a.initial[key], `free travel preserves ${key}`);
  let saved;
  for (let i = 0; i < 100; i++) {
    saved = (await api('/api/slots', auth.token)).slots.find(s => s.slot === 0);
    const location = JSON.parse(saved.data?.['tno.location.v1'] ?? 'null');
    if (location?.map === 'city' && location.x === anotherCity.x && location.z === anotherCity.z) break;
    await sleep(10);
  }
  assert.deepEqual(JSON.parse(saved.data['tno.location.v1']), { map: 'city', x: anotherCity.x, z: anotherCity.z, facing: anotherCity.facing });
  const closed = once(a.ws, 'close'); a.ws.close(); await closed;
  const rejoined = await connect('WarpTraveller', { map: 'city', x: anotherCity.x, z: anotherCity.z }, auth);
  assert.deepEqual(rejoined.initial.inventory, a.initial.inventory); assert.equal(rejoined.initial.gold, a.initial.gold);
  assert.doesNotMatch(logs, /unhandled|message .*Error|save .*Error/);
});
