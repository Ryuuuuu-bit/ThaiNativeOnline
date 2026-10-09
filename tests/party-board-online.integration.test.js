// Isolated WebSocket transport using the production recruitment handler, Presence,
// Accounts and Combatants. The parent's server/index.js wiring is tested separately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';
import { Presence } from '../server/presence.js';
import { Combatants } from '../server/combatants.js';
import { Parties, PARTY } from '../server/parties.js';
import { createPartyBoardHandlers } from '../server/party-board.js';
import { Character } from '../src/character/Character.js';

test('real WS: cross-map listings, forged leader, signed roster, approval/pans, full race and disconnect', { timeout: 12000 }, async t => {
  const accounts = new Accounts(new MemoryStore()), presence = new Presence(), combatants = new Combatants(), parties = new Parties();
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(wss, 'listening');
  const send = (ws, msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
  const byId = id => { for (const [ws, p] of presence.players) if (p.id === id) return { ws, p }; return null; };
  const sendParty = pid => { const party = parties.get(pid); for (const id of party?.members ?? []) send(byId(id)?.ws, { t: 'party', ...party }); };
  const hooks = createPartyBoardHandlers({ parties, presence, combatants, byId, send, sendParty });
  const serverErrors = [];
  wss.on('connection', ws => {
    ws.on('message', async raw => {
      try {
        const m = JSON.parse(raw);
        if (m.t === 'hello') {
          const account = await accounts.auth(m.token), saved = account && await accounts.character(account, 0);
          const r = presence.join(ws, { ...m, ...(saved ? { name: saved.name, cls: saved.classId, lv: saved.level } : {}) }, m.ch ?? 1, { guest: !saved });
          const p = presence.players.get(ws);
          if (saved) { p.account = account; combatants.load(p.id, saved, { account, slot: 0 }); }
          send(ws, { t: 'welcome', you: r.you }); return;
        }
        if (hooks.handle(ws, m)) return;
        // The normal party handler's existing invite answer path is the sole join gate.
        if (m.t === 'pans') {
          const p = presence.players.get(ws);
          if (!m.ok) { parties.decline(p.id, m.from); hooks.sweep(); return; }
          const r = parties.accept(p.id, m.from);
          if (r.ok) sendParty(r.party.id); else send(ws, { t: 'pno', why: r.why });
        }
      } catch (error) { serverErrors.push(error); }
    });
    ws.on('close', () => {
      const p = presence.players.get(ws); if (!p) return;
      presence.leave(ws); parties.leave(p.id); hooks.disconnect(p.id); combatants.drop(p.id);
    });
  });
  const clients = [];
  t.after(async () => { hooks.dispose(); for (const ws of clients) ws.terminate(); for (const ws of wss.clients) ws.terminate(); await new Promise(r => wss.close(r)); });
  const connect = async (name, cls, map = 'city', signed = true) => {
    let token;
    if (signed) {
      const auth = await accounts.register(name.toLowerCase(), 'partytest123'); assert.ok(auth.ok); token = auth.token;
      const c = Character.create(name, cls); c.level = 15;
      await accounts.store.putSlot(auth.id, 0, { 'tno.character.v1': JSON.stringify(c.toJSON()) });
    }
    const ws = new WebSocket(`ws://127.0.0.1:${wss.address().port}`); clients.push(ws);
    const messages = []; ws.on('message', raw => messages.push(JSON.parse(raw)));
    const wait = async check => {
      const end = Date.now() + 1500;
      while (Date.now() < end) { const i = messages.findIndex(check); if (i >= 0) return messages.splice(i, 1)[0]; await new Promise(r => setTimeout(r, 5)); }
      throw new Error(`Timed out for ${name}; received ${JSON.stringify(messages)}; errors ${serverErrors}`);
    };
    await once(ws, 'open'); ws.send(JSON.stringify({ t: 'hello', token, name, cls: 'shaman', lv: 100, map, ch: map === 'deep_forest' ? 2 : 1 }));
    const welcome = await wait(m => m.t === 'welcome');
    return { ws, id: welcome.you, wait, messages, send: m => ws.send(JSON.stringify(m)) };
  };
  const a = await connect('BoardLeader', 'warrior', 'deep_forest'), b = await connect('BoardMember', 'herbalist'),
    c = await connect('BoardApplicant', 'hunter'), guest = await connect('BoardGuest', 'shaman', 'city', false);
  a.send({ t: 'party_board_publish', minLv: 10, maxLv: 30, purpose: 'ล่าบอส' });
  assert.equal((await a.wait(m => m.t === 'party_board_result')).why, 'no_party');
  a.send({ t: 'party_create' }); const created = await a.wait(m => m.t === 'party');
  a.send({ t: 'party_board_publish', minLv: 10, maxLv: 30, purpose: 'ล่าบอส', map: 'city', members: [guest.id] });
  await a.wait(m => m.t === 'party_board_result' && m.action === 'party_board_publish' && m.ok);
  c.send({ t: 'party_board_list' }); const board = await c.wait(m => m.t === 'party_board' && m.list.length);
  assert.equal(board.list[0].map, 'deep_forest'); assert.equal(board.list[0].ch, 2);
  assert.equal(board.list[0].members[0].cls, 'warrior'); assert.equal(board.list[0].members[0].lv, 15);
  guest.send({ t: 'party_board_request', party: created.id, account: 'boardleader' });
  assert.equal((await guest.wait(m => m.t === 'party_board_result')).why, 'guest');
  parties.invite(a.id, b.id); b.send({ t: 'pans', from: a.id, ok: true }); await b.wait(m => m.t === 'party' && m.members.includes(b.id));
  b.send({ t: 'party_board_publish', id: a.id, leader: a.id, minLv: 10, maxLv: 30, purpose: 'forged' });
  assert.equal((await b.wait(m => m.t === 'party_board_result')).why, 'not_leader');
  c.send({ t: 'party_board_request', party: created.id, from: a.id }); await c.wait(m => m.t === 'party_board_result' && m.ok);
  await a.wait(m => m.t === 'party_board' && m.requests.some(r => r.from === c.id)); assert.equal(parties.of(c.id), null);
  b.send({ t: 'party_board_answer', from: c.id, ok: true, leader: a.id }); assert.equal((await b.wait(m => m.t === 'party_board_result')).why, 'not_leader');
  a.send({ t: 'party_board_answer', from: c.id, ok: true }); const inv = await c.wait(m => m.t === 'pinv');
  assert.equal(inv.from, a.id); assert.equal(parties.of(c.id), null, 'leader approval does not join');
  c.send({ t: 'pans', from: a.id, ok: true }); await c.wait(m => m.t === 'party' && m.members.includes(c.id));
  assert.equal(parties.of(c.id), created.id);
  const d = await connect('BoardRace', 'hunter'); d.send({ t: 'party_board_request', party: created.id }); await d.wait(m => m.t === 'party_board_result' && m.ok);
  a.send({ t: 'party_board_answer', from: d.id, ok: true }); await d.wait(m => m.t === 'pinv');
  for (let i = 0; i < 3; i++) { const extra = await connect(`BoardFill${i}`, 'hunter'); parties.invite(a.id, extra.id); assert.ok(parties.accept(extra.id, a.id).ok); }
  await d.wait(m => m.t === 'party_board' && !m.list.length);
  d.send({ t: 'pans', from: a.id, ok: true }); await d.wait(m => m.t === 'pno'); assert.equal(parties.of(d.id), null);
  assert.equal(parties.members(created.id).length, PARTY.max);
  // A separate listing covers disconnect after approval, with capacity still available.
  const e = await connect('BoardDisconnect', 'warrior', 'paddy'), applicant = await connect('BoardWait', 'hunter');
  e.send({ t: 'party_create' }); const second = await e.wait(m => m.t === 'party');
  e.send({ t: 'party_board_publish', minLv: 10, maxLv: 30, purpose: 'เก็บเลเวล' }); await e.wait(m => m.t === 'party_board_result' && m.action === 'party_board_publish' && m.ok);
  applicant.send({ t: 'party_board_request', party: second.id }); await applicant.wait(m => m.t === 'party_board_result' && m.ok);
  e.send({ t: 'party_board_answer', from: applicant.id, ok: true }); await applicant.wait(m => m.t === 'pinv');
  e.ws.close(); await once(e.ws, 'close'); await applicant.wait(m => m.t === 'party_board' && !m.list.some(l => l.party === second.id));
  applicant.send({ t: 'pans', from: e.id, ok: true }); assert.equal((await applicant.wait(m => m.t === 'pno')).why, 'expired');
  assert.equal(parties.of(applicant.id), null); assert.deepEqual(serverErrors, []);
});
