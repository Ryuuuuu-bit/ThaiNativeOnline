import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { CITY_LAYOUT_REVISION } from '../src/world/compact-city.js';
import { MAPS } from '../src/world/maps.js';

test('HTTP/WS login ignores forged hello location, commits previous session movement, and serializes twin joins', { timeout: 20000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  // Inject only deterministic storage delays/failures into this isolated child.
  // All HTTP/WS authentication, reservation, position and rejection handlers are real.
  const bootstrap = `
    import { Accounts } from './server/accounts.js';
    const joinState = Accounts.prototype.joinState, putCharacter = Accounts.prototype.putCharacter;
    let releaseRead, held = false, failSave = false;
    Accounts.prototype.joinState = async function(id, ...args) {
      const state = await joinState.call(this, id, ...args);
      if (id === 'loginraceqa' && !held) {
        held = true; process.send({ t: 'login_read_held' });
        await new Promise(resolve => { releaseRead = resolve; });
      }
      return state;
    };
    Accounts.prototype.putCharacter = function(id, ...args) {
      if (id === 'loginfailqa' && failSave) { failSave = false; return Promise.resolve(false); }
      return putCharacter.call(this, id, ...args);
    };
    process.on('message', msg => {
      if(msg === 'SIGTERM') process.emit(msg);
      if(msg === 'release_login_read') releaseRead?.();
      if(msg === 'fail_next_login_save') { failSave = true; process.send({ t: 'failure_armed' }); }
    });
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '', ADMIN_IDS: '' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  const sockets = []; t.after(() => { sockets.forEach(ws => ws.terminate()); if (child.exitCode === null) child.kill(); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 150 && !logs.includes('ThaiNative Online on'); i++) await sleep(20);
  assert.match(logs, /ThaiNative Online on/);
  const api = async (path, token, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, ...await res.json() };
  };
  const auth = await api('/api/register', null, 'POST', { id: 'loginposqa', password: 'fixture-secret' }); assert.ok(auth.ok);
  assert.ok((await api('/api/slots/0', auth.token, 'PUT', { data: {
    'tno.character.v1': JSON.stringify({ name: 'LoginPositionQA', classId: 'warrior', gender: 'male' }),
    'tno.location.v1': JSON.stringify({ map: 'city', x: -6, z: 8, facing: 1.25, layoutRevision: CITY_LAYOUT_REVISION }),
  } })).ok);
  const connect = async (token = auth.token, slot = 0, location = { map: 'paddy', x: 4, z: -130, f: -1 }, refused = false) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', d => { messages.push(JSON.parse(d)); }); await once(ws, 'open');
    const send = m => ws.send(JSON.stringify(m));
    const wait = async predicate => {
      for (let i = 0; i < 400; i++) { const at = messages.findIndex(predicate); if (at >= 0) return messages.splice(at, 1)[0]; await sleep(10); }
      throw Error('WS timeout: ' + logs);
    };
    send({ t: 'hello', token, slot, name: 'forged', cls: 'herbalist', lv: 100, ...location });
    const welcome = await wait(m => m.t === (refused ? 'kicked' : 'welcome')), position = refused ? null : await wait(m => m.t === 'position');
    return { ws, messages, send, wait, welcome, position };
  };
  const a = await connect();
  assert.deepEqual(a.position, { t: 'position', map: 'city', x: -6, z: 8, f: 1.25 });
  assert.equal(a.welcome.name, 'LoginPositionQA');
  const uid = a.welcome.characterUid;
  a.send({ t: 's', x: -5.4, z: 8, f: .8, m: 1 });
  a.send({ t: 's', x: 99999, z: 99999, f: .8, m: 1 });
  const moved = await a.wait(m => m.t === 'position'); assert.equal(moved.x, -5.4);
  const b = await connect(auth.token, 0, { map: 'city', x: 100, z: 200, f: -2 });
  await a.wait(m => m.t === 'kicked');
  assert.equal(b.position.x, moved.x); assert.equal(b.position.z, moved.z); assert.equal(b.position.f, moved.f);
  assert.equal(b.welcome.characterUid, uid);
  const row = (await api('/api/slots', auth.token)).slots[0];
  assert.deepEqual(JSON.parse(row.data['tno.location.v1']), { map: 'city', x: moved.x, z: moved.z, facing: moved.f, layoutRevision: CITY_LAYOUT_REVISION });

  const [c, d] = await Promise.all([connect(), connect(auth.token, 0, { map: 'wat_rang', x: 4, z: -450, f: 3 })]);
  await b.wait(m => m.t === 'kicked');
  for (const p of [c, d]) { assert.equal(p.position.map, 'city'); assert.equal(p.position.x, moved.x); assert.equal(p.welcome.characterUid, uid); }
  await sleep(100);
  assert.equal([c, d].filter(p => p.ws.readyState === WebSocket.OPEN).length, 1, 'one live incarnation after concurrent joins');
  const survivor = [c, d].find(p => p.ws.readyState === WebSocket.OPEN);
  survivor.send({ t: 'hello', token: auth.token, slot: 0, map: 'paddy', x: 99, z: -130 });
  survivor.send({ t: 's', x: 99999, z: 99999 });
  assert.equal((await survivor.wait(m => m.t === 'position')).x, moved.x, 'repeat hello cannot move an established session');

  assert.ok((await api('/api/slots/1', auth.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify({ name: 'FreshPositionQA', classId: 'warrior' }) } })).ok);
  const fresh = await connect(auth.token, 1);
  assert.equal(fresh.position.map, 'city'); assert.equal(fresh.position.x, 0); assert.equal(fresh.position.z, MAPS.city.spawn.z, 'missing saved location uses city spawn');
  const guest = await connect(null, null, { map: 'paddy', x: 4, z: -130, f: .2 });
  assert.equal(guest.position.map, 'paddy'); assert.equal(guest.position.x, 4, 'Guest placement policy is unchanged');

  const makeAccount = async (id, name) => {
    const login = await api('/api/register', null, 'POST', { id, password: 'fixture-secret' }); assert.ok(login.ok);
    assert.ok((await api('/api/slots/0', login.token, 'PUT', { data: {
      'tno.character.v1': JSON.stringify({ name, classId: 'warrior' }),
      'tno.location.v1': JSON.stringify({ map: 'city', x: -6, z: 8, facing: 1.25, layoutRevision: CITY_LAYOUT_REVISION }),
    } })).ok); return login;
  };
  const racing = await makeAccount('loginraceqa', 'LoginRaceQA');
  const heldRead = once(child, 'message'), joining = connect(racing.token);
  assert.equal((await heldRead)[0].t, 'login_read_held');
  const pendingDelete = await api('/api/slots/0', racing.token, 'DELETE');
  assert.equal(pendingDelete.status, 409); assert.equal(pendingDelete.code, 'in_play');
  const pendingRename = await api('/api/slots/0/name', racing.token, 'POST', { name: 'ChangedDuringLogin' });
  assert.equal(pendingRename.status, 409); assert.equal(pendingRename.code, 'in_play');
  assert.equal((await api('/api/slots', racing.token)).slots.length, 1, 'held login slot remains intact');
  child.send('release_login_read'); const joined = await joining;
  assert.equal(joined.welcome.name, 'LoginRaceQA'); assert.equal(joined.position.x, -6);

  const failed = await makeAccount('loginfailqa', 'LoginFailureQA');
  const previous = await connect(failed.token);
  previous.send({ t: 's', x: -5.4, z: 8, f: .8, m: 1 });
  previous.send({ t: 's', x: 99999, z: 99999 });
  assert.equal((await previous.wait(m => m.t === 'position')).x, -5.4);
  const failureArmed = once(child, 'message'); child.send('fail_next_login_save');
  assert.equal((await failureArmed)[0].t, 'failure_armed');
  const refused = await connect(failed.token, 0, { map: 'paddy', x: 4, z: -130 }, true);
  assert.match(refused.welcome.why, /กำลังเซฟ/);
  assert.ok(!refused.messages.some(m => m.t === 'welcome'), 'failed final save cannot adopt an older row');
  const afterFailed = (await api('/api/slots', failed.token)).slots[0];
  assert.equal(JSON.parse(afterFailed.data['tno.location.v1']).x, -6, 'failed write did not pretend to persist movement');
  const exited = once(child, 'exit'); child.send('SIGTERM'); assert.equal((await exited)[0], 0);
  assert.doesNotMatch(logs, /unhandled|message .*Error|Shutdown failed/);
});
