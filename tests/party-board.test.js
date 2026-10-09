import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parties, PARTY } from '../server/parties.js';
import { PartyBoard, PARTY_BOARD, cleanPurpose, createPartyBoardHandlers } from '../server/party-board.js';
import { filterPartyListings, partyBoardPane } from '../src/net/SocialPanes.js';

function fixture() {
  let time = 100;
  const players = new Map(Array.from({ length: 30 }, (_, i) => [i + 1, { id: i + 1, name: `Player${i + 1}`,
    cls: i === 0 ? 'warrior' : i === 1 ? 'herbalist' : 'hunter', lv: 15, signed: true, dead: false,
    map: i === 0 ? 'deep_forest' : 'city', ch: i === 0 ? 2 : 1 }]));
  const parties = new Parties({ now: () => time });
  const board = new PartyBoard({ parties, player: id => players.get(id), now: () => time });
  parties.onChange(() => board.sweep());
  const publish = (id = 1, extra = {}) => board.publish(id, { minLv: 10, maxLv: 30, purpose: 'ล่าบอสด้วยกัน', ...extra });
  const create = (id = 1) => parties.create(id).party.id;
  const join = (id, from = 1) => { assert.ok(parties.invite(from, id).ok); assert.ok(parties.accept(id, from).ok); };
  return { players, parties, board, publish, create, join, advance: n => time += n };
}

test('only a signed-in current leader can publish/remove; an explicit party is required', () => {
  const f = fixture();
  assert.equal(f.publish().why, 'no_party');
  const pid = f.create(); assert.ok(f.publish().ok); f.join(2);
  assert.equal(f.publish(2, { leader: 1, party: pid }).why, 'not_leader');
  assert.equal(f.board.remove(2).why, 'not_leader');
  f.players.get(1).signed = false;
  assert.equal(f.publish().why, 'guest'); assert.equal(f.board.snapshot(2).list.length, 0);
  assert.equal(f.board.actor(99).why, 'offline');
});

test('purpose and levels are validated; map, class, level and membership come from server state', () => {
  const f = fixture(), pid = f.create();
  for (const extra of [{ minLv: 0 }, { maxLv: 101 }, { minLv: 30, maxLv: 20 }, { minLv: '10' }, { maxLv: Infinity }, { purpose: {} }, { purpose: '\u0000 <>\u202e' }]) {
    assert.equal(f.publish(1, extra).why, 'bad_listing');
  }
  const purpose = '  ล่า\nบอส <b>\u202e ' + '😀'.repeat(100);
  assert.ok(f.publish(1, { purpose, map: 'city', ch: 9, leader: 9, cls: 'shaman', lv: 99, members: [99] }).ok);
  const listing = f.board.snapshot(3).list[0];
  assert.equal(listing.party, pid); assert.equal(listing.map, 'deep_forest'); assert.equal(listing.ch, 2);
  assert.deepEqual(listing.members.map(p => [p.id, p.cls, p.lv]), [[1, 'warrior', 15]]);
  assert.equal(Array.from(listing.purpose).length, PARTY_BOARD.purposeLimit);
  assert.doesNotMatch(listing.purpose, /[<>\p{Cc}\p{Cf}]/u);
  assert.equal(cleanPurpose('<script> alert(1) </script>'), 'script alert(1) /script');
});

test('requests and leader approval never grant membership; only pans consent can join', () => {
  const f = fixture(), pid = f.create(); f.publish();
  assert.ok(f.board.request(3, pid).ok); assert.equal(f.parties.of(3), null);
  assert.equal(f.parties.accept(3, 1).why, 'expired');
  assert.equal(f.board.answer(2, 3, true).why, 'no_party');
  assert.equal(f.board.answer(1, 3, 'true').why, 'bad_request');
  const answer = f.board.answer(1, 3, true); assert.ok(answer.ok);
  assert.deepEqual(answer.invite, { t: 'pinv', from: 1, name: 'Player1' });
  assert.equal(f.parties.of(3), null); assert.deepEqual(f.parties.members(pid), [1]);
  assert.equal(f.board.snapshot(3).pending[0].status, 'invited');
  f.parties.decline(3, 1); f.board.sweep();
  assert.equal(f.parties.of(3), null); assert.equal(f.board.snapshot(3).pending.length, 0);
  f.advance(5); f.board.request(3, pid); f.board.answer(1, 3, true);
  assert.ok(f.parties.accept(3, 1).ok); assert.deepEqual(f.parties.members(pid), [1, 3]);
  assert.equal(f.board.snapshot(1).requests.length, 0);
});

test('all applicants are authenticated, alive, unpartied and within the target level range', () => {
  const f = fixture(), pid = f.create(); f.publish();
  f.players.get(3).signed = false; assert.equal(f.board.request(3, pid).why, 'guest');
  f.players.get(3).signed = true; f.players.get(3).dead = true; assert.equal(f.board.request(3, pid).why, 'dead');
  f.players.get(3).dead = false; f.players.get(3).lv = 9; assert.equal(f.board.request(3, pid).why, 'level');
  f.players.get(3).lv = 31; assert.equal(f.board.request(3, pid).why, 'level');
  f.players.get(3).lv = 15; f.create(3); assert.equal(f.board.request(3, pid).why, 'in_party');
  assert.equal(f.board.request(4, String(pid)).why, 'expired');
});

test('full parties exclude listings and cancel pending invitations; acceptance cannot exceed capacity', () => {
  const f = fixture(), pid = f.create(); f.publish();
  f.board.request(7, pid); f.board.answer(1, 7, true);
  for (const id of [2, 3, 4, 5, 6]) f.join(id);
  assert.equal(f.board.snapshot(8).list.length, 0); assert.equal(f.publish().why, 'full');
  assert.equal(f.board.request(8, pid).why, 'full');
  assert.equal(f.parties.accept(7, 1).why, 'expired'); assert.equal(f.parties.of(7), null);
  assert.equal(f.parties.members(pid).length, PARTY.max);
});

test('dead leader and disconnected roster are excluded; current leader map/channel follow server updates', () => {
  const f = fixture(); f.create(); f.publish(); f.join(2);
  Object.assign(f.players.get(1), { map: 'paddy', ch: 3 });
  const moved = f.board.snapshot(3).list[0]; assert.equal(moved.map, 'paddy'); assert.equal(moved.ch, 3);
  f.players.get(1).dead = true; assert.equal(f.board.snapshot(3).list.length, 0);
  assert.equal(f.publish().why, 'dead');
  f.players.get(1).dead = false; f.advance(10); f.publish();
  f.players.delete(2); assert.equal(f.board.snapshot(3).list.length, 0);
  f.advance(10); assert.equal(f.publish().why, 'offline', 'a dangling roster cannot be published');
});

test('leader leave, disconnect and promotion revoke approved board invites and stale ordinary invites', () => {
  for (const event of ['leave', 'disconnect', 'promote']) {
    const f = fixture(), pid = f.create(); f.join(2); f.join(3); f.publish();
    f.board.request(4, pid); f.board.answer(1, 4, true);
    f.parties.invite(1, 5);
    if (event === 'leave') f.parties.leave(1);
    if (event === 'disconnect') { f.board.disconnect(1); f.players.delete(1); f.parties.leave(1); }
    if (event === 'promote') f.parties.promote(1, 2);
    assert.equal(f.board.snapshot(6).list.length, 0, event);
    assert.equal(f.parties.accept(4, 1).why, 'expired', event);
    assert.equal(f.parties.accept(5, 1).why, 'expired', event);
    assert.equal(f.parties.of(4), null);
  }
  const f = fixture(); f.parties.invite(9, 10); f.parties.leave(9);
  assert.equal(f.parties.accept(10, 9).why, 'expired', 'an unpartied inviter cannot leave a ghost party invite');
});

test('applicant disconnect, listing withdrawal and expired request cancel consent safely', () => {
  for (const event of ['disconnect', 'remove', 'expire', 'level']) {
    const f = fixture(), pid = f.create(); f.publish(); f.board.request(3, pid);
    if (event === 'expire') { f.advance(PARTY_BOARD.requestSecs); assert.equal(f.board.answer(1, 3, true).why, 'expired'); }
    else {
      f.board.answer(1, 3, true);
      if (event === 'disconnect') { f.board.disconnect(3); f.players.delete(3); }
      if (event === 'remove') assert.ok(f.board.remove(1).ok);
      if (event === 'level') f.players.get(3).lv = 31;
    }
    f.board.sweep(); assert.equal(f.parties.accept(3, 1).why, 'expired');
    assert.equal(f.board.snapshot(1).requests.length, 0);
  }
});

test('cooldowns, duplicate request and queue bounds limit public board spam', () => {
  const f = fixture(), pid = f.create(); assert.ok(f.publish().ok);
  assert.deepEqual(f.publish(), { ok: false, why: 'cooldown', retryAfter: 10 });
  assert.ok(f.board.remove(1).ok, 'withdrawal bypasses publication cooldown');
  f.advance(10); f.publish(); assert.ok(f.board.request(3, pid).ok);
  assert.equal(f.board.request(3, pid).why, 'pending'); f.board.answer(1, 3, false);
  assert.equal(f.board.request(3, pid).why, 'cooldown'); f.advance(5);
  assert.ok(f.board.request(3, pid).ok);
  for (let i = 4; i < 23; i++) assert.ok(f.board.request(i, pid).ok);
  assert.equal(f.board.request(23, pid).why, 'busy');
  f.advance(PARTY_BOARD.requestSecs); assert.equal(f.board.snapshot(1).requests.length, 0);
});

test('an applicant may hold at most three requests, and approved invitations expire normally', () => {
  const f = fixture();
  for (const leader of [1, 2, 3, 4]) { f.create(leader); f.publish(leader); }
  for (const leader of [1, 2, 3]) { assert.ok(f.board.request(8, f.parties.of(leader)).ok); f.advance(5); }
  assert.equal(f.board.request(8, f.parties.of(4)).why, 'busy');
  assert.ok(f.board.answer(1, 8, true).ok); f.advance(PARTY.inviteSecs);
  assert.equal(f.parties.accept(8, 1).why, 'expired'); assert.equal(f.parties.of(8), null);
  assert.equal(f.board.snapshot(8).pending.some(r => r.party === f.parties.of(1)), false);
});

test('socket handlers derive identity and signed class/level from server combatants', () => {
  const f = fixture(), sockets = new Map(), presence = { players: new Map() }, combatants = { get: id => entries.get(id) }, entries = new Map();
  const messages = [];
  for (const [id, p] of f.players) {
    const ws = { readyState: 1 }; sockets.set(id, ws); presence.players.set(ws, { ...p, account: `account${id}`, cls: 'shaman', lv: 100 });
    entries.set(id, { persist: { account: `account${id}` }, c: { classId: p.cls, level: p.lv, alive: true } });
  }
  const handlers = createPartyBoardHandlers({ parties: f.parties, presence, combatants,
    byId: id => { const ws = sockets.get(id); return ws ? { ws, p: presence.players.get(ws) } : null; },
    send: (ws, m) => messages.push({ id: [...sockets].find(([, w]) => w === ws)[0], ...m }), sendParty: () => {}, now: () => 100 });
  assert.equal(handlers.handle(sockets.get(1), { t: 'unrelated' }), false);
  handlers.handle(sockets.get(1), { t: 'party_create', id: 2 });
  assert.equal(f.parties.of(2), null); const pid = f.parties.of(1);
  handlers.handle(sockets.get(1), { t: 'party_board_publish', minLv: 10, maxLv: 30, purpose: 'test', leader: 2 });
  const listing = handlers.board.snapshot(3).list[0];
  assert.deepEqual([listing.members[0].cls, listing.members[0].lv], ['warrior', 15]);
  f.parties.invite(1, 2); f.parties.accept(2, 1);
  handlers.handle(sockets.get(2), { t: 'party_board_publish', id: 1, minLv: 1, maxLv: 100, purpose: 'forged' });
  assert.equal(messages.findLast(m => m.id === 2 && m.t === 'party_board_result').why, 'not_leader');
  entries.get(3).persist.account = 'other';
  handlers.handle(sockets.get(3), { t: 'party_board_request', party: pid, account: 'account3' });
  assert.ok(messages.some(m => m.id === 3 && m.why === 'guest'));
  sockets.get(1).readyState = 3; handlers.disconnect(1); assert.equal(handlers.board.snapshot(2).list.length, 0);
  handlers.dispose();
});

test('client filters match live member classes/roles and target level; all dynamic text is escaped', () => {
  const f = fixture(); f.create(); f.publish(); f.join(2);
  const list = f.board.snapshot(3).list;
  assert.equal(filterPartyListings(list, { map: 'deep_forest', level: 15, cls: 'herbalist', role: 'support' }).length, 1);
  assert.equal(filterPartyListings(list, { cls: 'shaman' }).length, 0);
  assert.equal(filterPartyListings(list, { cls: 'warrior', role: 'support' }).length, 0, 'class and role must belong to the same member');
  assert.equal(filterPartyListings(list, { level: 31 }).length, 0);
  assert.equal(filterPartyListings(list, { map: 'city' }).length, 0);
  list[0].members[1].dead = true; assert.equal(filterPartyListings(list, { role: 'support' }).length, 0);
  list[0].purpose = '<img src=x onerror="alert(1)">'; list[0].name = '<script>';
  const html = partyBoardPane({ data: { list, requests: [], pending: [], signed: true }, online: true,
    filters: { map: 'all', level: '', cls: 'all', role: 'all' }, draft: { minLv: 1, maxLv: 100, purpose: '</textarea><script>' }, me: 3 });
  assert.doesNotMatch(html, /<script>|<img src=x/); assert.match(html, /&lt;img/);
  assert.match(html, /data-board-request/); assert.match(html, /data-board-create/);
});
