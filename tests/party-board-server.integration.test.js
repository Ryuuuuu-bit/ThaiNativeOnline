// Exercise server/index.js directly: real HTTP accounts, real /ws router, real
// party-state broadcasts and disconnect hooks. No handler or state monkey patches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { MAPS } from '../src/world/maps.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const within = async (promise, ms, label) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
};

test('production HTTP/WS party board: signed create/list/publish/request, leader approval, pans consent and disconnect cleanup', { timeout: 30000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '', ADMIN_IDS: '', GOOGLE_CLIENT_ID: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '', childError;
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  child.on('error', error => { childError = error; });
  const sockets = [], socketErrors = [];
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      const exited = once(child, 'exit'); child.kill();
      await within(exited, 5000, 'isolated server cleanup');
    }
  });
  const startupDeadline = Date.now() + 8000;
  while (!logs.includes('ThaiNative Online on') && Date.now() < startupDeadline) {
    if (childError || child.exitCode !== null || child.signalCode !== null) break;
    await sleep(20);
  }
  assert.equal(childError, undefined, 'the isolated server starts');
  assert.match(logs, /ThaiNative Online on/, `production server startup: ${logs}`);
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, token, method = 'GET', body) => {
    const response = await fetch(base + path, {
      method, signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  };
  const health = await api('/api/health');
  assert.equal(health.accounts, true); assert.equal(health.store, 'memory');

  async function account(name, cls) {
    const id = name.toLowerCase(), password = 'party-server-fixture';
    assert.ok((await api('/api/register', null, 'POST', { id, password })).ok);
    const auth = await api('/api/login', null, 'POST', { id, password });
    assert.ok(auth.ok && auth.token); assert.equal(auth.id, id);
    assert.ok((await api('/api/slots/0', auth.token, 'PUT', {
      data: { 'tno.character.v1': JSON.stringify({ name, classId: cls, gender: 'male' }) },
    })).ok);
    assert.equal((await api('/api/me', auth.token)).id, id);
    return { ...auth, name, cls };
  }

  async function connect(auth, map = 'city') {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = [];
    let sequence = 0;
    sockets.push(ws);
    ws.on('error', error => socketErrors.push(error.message));
    ws.on('message', raw => messages.push({ sequence: ++sequence, message: JSON.parse(raw) }));
    await within(once(ws, 'open'), 5000, `${auth.name} connection`);
    const client = {
      ws, auth,
      mark: () => sequence,
      send(message) { const after = sequence; ws.send(JSON.stringify(message)); return after; },
      async wait(predicate, label, after = 0) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const index = messages.findIndex(entry => entry.sequence > after && predicate(entry.message));
          if (index >= 0) return messages.splice(index, 1)[0].message;
          if (childError || child.exitCode !== null || child.signalCode !== null) break;
          await sleep(10);
        }
        throw new Error(`${auth.name}: ${label}; queued ${JSON.stringify(messages.map(entry => entry.message).filter(m => ['party', 'party_board', 'party_board_result', 'pinv', 'pno', 'kicked'].includes(m.t)))}; server ${logs}`);
      },
    };
    const after = client.send({ t: 'hello', token: auth.token, slot: 0, map, ...MAPS[map].spawn,
      name: 'ForgedName', cls: 'shaman', lv: 99 });
    const welcome = await client.wait(m => m.t === 'welcome', 'signed welcome', after);
    client.id = welcome.you; assert.equal(welcome.name, auth.name);
    const position = await client.wait(m => m.t === 'position', 'server position', after);
    assert.equal(position.map, map);
    const sync = await client.wait(m => m.t === 'sync', 'authoritative character', after);
    assert.equal(sync.c.name, auth.name); assert.equal(sync.c.classId, auth.cls); assert.equal(sync.c.level, 1);
    return client;
  }

  async function command(client, message, why = null) {
    const after = client.send(message);
    const result = await client.wait(m => m.t === 'party_board_result' && m.action === message.t, message.t, after);
    assert.equal(result.ok, why === null, `${message.t}: ${JSON.stringify(result)}`);
    if (why !== null) assert.equal(result.why, why);
    return after;
  }
  const roster = (state, ids) => {
    assert.deepEqual(state.members.map(member => member.id).sort((a, b) => a - b), [...ids].sort((a, b) => a - b));
    assert.ok(state.members.every(member => typeof member.name === 'string' && Number.isInteger(member.lv)));
    assert.ok(state.share.range > 0 && state.share.gap > 0 && state.share.bonus > 0, 'production Social party payload includes EXP rules');
  };

  const leaderAuth = await account('BoardServerLead', 'warrior');
  const memberAuth = await account('BoardServerHeal', 'herbalist');
  const waitingAuth = await account('BoardServerWait', 'hunter');
  const observerAuth = await account('BoardServerWatch', 'assassin');
  const leader = await connect(leaderAuth), member = await connect(memberAuth, 'paddy'),
    waiting = await connect(waitingAuth), observer = await connect(observerAuth);

  const initialRead = observer.send({ t: 'party_board_list' });
  const empty = await observer.wait(m => m.t === 'party_board', 'initial public board', initialRead);
  assert.equal(empty.signed, true); assert.equal(empty.list.length, 0);
  assert.equal(empty.canCreate, true);
  await command(leader, { t: 'party_board_publish', minLv: 1, maxLv: 10, purpose: 'เก็บเลเวล' }, 'no_party');
  const createdAfter = await command(leader, { t: 'party_create', id: waiting.id });
  const created = await leader.wait(m => m.t === 'party' && m.id, 'explicit singleton party', createdAfter);
  const pid = created.id; assert.equal(created.leader, leader.id); roster(created, [leader.id]);

  const observedPublish = observer.mark();
  const purpose = 'เก็บเลเวลด้วยกัน';
  const publishedAfter = await command(leader, { t: 'party_board_publish', minLv: 1, maxLv: 10, purpose,
    leader: waiting.id, map: 'demon_rift', members: [waiting.id], cls: 'shaman', lv: 99 });
  const mine = await leader.wait(m => m.t === 'party_board' && m.mine?.party === pid, 'own published listing', publishedAfter);
  assert.equal(mine.mine.leader, leader.id);
  const publicBoard = await observer.wait(m => m.t === 'party_board' && m.list.some(l => l.party === pid), 'published server listing', observedPublish);
  const listing = publicBoard.list.find(l => l.party === pid);
  assert.deepEqual([listing.name, listing.map, listing.minLv, listing.maxLv, listing.purpose], [leaderAuth.name, 'city', 1, 10, purpose]);
  assert.deepEqual(listing.members.map(m => [m.id, m.cls, m.lv]), [[leader.id, 'warrior', 1]]);
  assert.equal(publicBoard.mine, null); assert.deepEqual(publicBoard.requests, []);
  const crossMapRead = member.send({ t: 'party_board_list' });
  await member.wait(m => m.t === 'party_board' && m.list.some(l => l.party === pid && l.map === 'city'), 'cross-map discovery from paddy', crossMapRead);

  const requestedForLeader = leader.mark();
  await command(member, { t: 'party_board_request', party: pid, from: leader.id, lv: 99 });
  const requestBoard = await leader.wait(m => m.t === 'party_board' && m.requests.some(r => r.from === member.id), 'actual signed applicant request', requestedForLeader);
  const request = requestBoard.requests.find(r => r.from === member.id);
  assert.deepEqual([request.name, request.cls, request.lv, request.map], [memberAuth.name, 'herbalist', 1, 'paddy']);
  const applicantApproval = member.mark();
  await command(leader, { t: 'party_board_answer', from: member.id, ok: true });
  const invite = await member.wait(m => m.t === 'pinv' && m.from === leader.id, 'standard party invitation', applicantApproval);
  assert.equal(invite.name, leaderAuth.name);
  await member.wait(m => m.t === 'party_board' && m.pending.some(r => r.party === pid && r.status === 'invited'), 'approval awaits applicant consent', applicantApproval);
  // The untouched one-second broadcast is a server-side barrier: approval has
  // happened, but the applicant has not sent pans and the party is still singleton.
  const beforeConsent = leader.mark();
  const unjoined = await leader.wait(m => m.t === 'party' && m.id === pid, 'pre-consent real party roster', beforeConsent);
  roster(unjoined, [leader.id]);
  const leaderJoined = leader.mark(), observerJoined = observer.mark();
  const acceptedAfter = member.send({ t: 'pans', from: leader.id, ok: true });
  const joined = await member.wait(m => m.t === 'party' && m.id === pid && m.members.some(p => p.id === member.id), 'existing pans grants membership', acceptedAfter);
  roster(joined, [leader.id, member.id]);
  await leader.wait(m => m.t === 'party' && m.members.some(p => p.id === member.id), 'leader receives accepted membership', leaderJoined);
  const grown = await observer.wait(m => m.t === 'party_board' && m.list.some(l => l.party === pid && l.members.length === 2), 'public live roster updates', observerJoined);
  assert.deepEqual(grown.list.find(l => l.party === pid).members.map(p => p.cls).sort(), ['herbalist', 'warrior']);

  await command(member, { t: 'party_board_publish', leader: leader.id, minLv: 1, maxLv: 10, purpose: 'forged' }, 'not_leader');
  const requestMark = leader.mark();
  await command(waiting, { t: 'party_board_request', party: pid });
  await leader.wait(m => m.t === 'party_board' && m.requests.some(r => r.from === waiting.id), 'second applicant request', requestMark);
  await command(member, { t: 'party_board_answer', leader: leader.id, from: waiting.id, ok: true }, 'not_leader');
  const secondApproval = waiting.mark();
  await command(leader, { t: 'party_board_answer', from: waiting.id, ok: true });
  await waiting.wait(m => m.t === 'pinv' && m.from === leader.id, 'second applicant approved', secondApproval);
  await waiting.wait(m => m.t === 'party_board' && m.pending.some(r => r.party === pid && r.status === 'invited'), 'second invitation pending', secondApproval);

  const observerDisconnected = observer.mark(), applicantDisconnected = waiting.mark(), memberDisconnected = member.mark();
  const closed = once(leader.ws, 'close'); leader.ws.close(); await within(closed, 5000, 'leader disconnect');
  const removed = await observer.wait(m => m.t === 'party_board' && !m.list.some(l => l.party === pid), 'disconnect removes public listing', observerDisconnected);
  assert.deepEqual(removed.requests, []);
  await waiting.wait(m => m.t === 'party_board' && !m.list.some(l => l.party === pid) && !m.pending.some(r => r.party === pid), 'disconnect clears approved request', applicantDisconnected);
  await member.wait(m => m.t === 'party' && m.id === null, 'existing party dissolution', memberDisconnected);
  const staleAnswer = waiting.send({ t: 'pans', from: leader.id, ok: true });
  assert.equal((await waiting.wait(m => m.t === 'pno', 'departed leader invite is expired', staleAnswer)).why, 'expired');
  // An independent create proves the rejected stale pans did not silently create
  // membership, using only the public production protocol.
  const independent = await command(waiting, { t: 'party_create' });
  const independentParty = await waiting.wait(m => m.t === 'party' && m.id && m.id !== pid, 'no membership after stale invitation', independent);
  assert.equal(independentParty.leader, waiting.id); roster(independentParty, [waiting.id]);
  assert.deepEqual(socketErrors, []);
  assert.doesNotMatch(logs, /unhandled|message .*Error|save .*Error|Shutdown failed/i);
});
