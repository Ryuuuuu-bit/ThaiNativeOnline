// Parties (server/parties.js, shared EXP in server/monsters.js) and player trade (server/trades.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parties, PARTY } from '../server/parties.js';
import { Trades, TRADE, swap, cleanOffer } from '../server/trades.js';
import { MonsterWorld } from '../server/monsters.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { Character } from '../src/character/Character.js';
import { killExp, expToNext } from '../src/character/data/progression.js';

const zone = { type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['morning', 'day', 'evening', 'night'] };
const world = () => { const w = new MonsterWorld('test', { zones: [zone], random: () => .5 }); for (let t = 0; t < 1; t += .1) w.update(.1, [{ id: 99, x: 60, z: 0, lv: 1 }], 'day'); return w; };

test('kill EXP (ThaiNative rule): level gap bands and a cap per kill', () => {
  assert.equal(killExp(100, 10, 10), 100);
  assert.equal(killExp(100, 10, 15), 110, '+2% a level above');
  assert.equal(killExp(100, 10, 20), 120, 'at most +20%');
  assert.equal(killExp(100, 10, 25), 70, 'past +10 levels it falls again');
  assert.equal(killExp(100, 20, 10), 50, '5 levels of grace, then −10% a level');
  assert.equal(killExp(100, 40, 10), 10, 'never under 10%');
  assert.equal(killExp(9999, 3, 3), Math.round(expToNext(3) * .2), 'one kill: at most 20% of a level');
  assert.equal(killExp(9999, 3, 3, true), expToNext(3), 'an elite or boss: up to a whole level');
});

test('a party: invite, accept, up to six, the leader passes on, a party of one is gone', () => {
  let t = 0; const P = new Parties({ now: () => t });
  assert.equal(P.invite(1, 1).why, 'self');
  assert.equal(P.accept(2, 1).why, 'expired', 'no invite yet');
  assert.ok(P.invite(1, 2).ok); const r = P.accept(2, 1);
  assert.ok(r.ok); assert.deepEqual(r.party.members, [1, 2]); assert.equal(r.party.leader, 1);
  assert.equal(P.invite(2, 3).why, 'not_leader');
  for (const id of [3, 4, 5, 6]) { P.invite(1, id); assert.ok(P.accept(id, 1).ok); }
  assert.equal(P.invite(1, 7).why, 'full');
  P.invite(1, 8); t += PARTY.inviteSecs + 1; P.leave(6);
  assert.equal(P.accept(8, 1).why, 'expired', 'an invite runs out');
  assert.equal(P.invite(9, 2).why, 'in_party');
  P.leave(1); assert.equal(P.get(P.of(2)).leader, 2, 'the leader passes on');
  assert.equal(P.kick(3, 4), null, 'only the leader removes'); assert.ok(P.kick(2, 4));
  P.leave(3); const last = P.leave(5);
  assert.equal(last.party, null); assert.equal(P.of(2), null, 'one left: no party');
});

test('a party kill: the EXP is shared by the members near it, the loot goes to the top damager', () => {
  const P = new Parties(), w = world(); w.party = P;
  P.invite(1, 2); P.accept(2, 1); P.invite(1, 3); P.accept(3, 1);
  const m = w.monsters[0], a = { id: 1, x: 2, z: 0, lv: 5 }, b = { id: 2, x: 0, z: 3, lv: 5 }, far = { id: 3, x: 0, z: 50, lv: 5 }, solo = { id: 4, x: 1, z: 1, lv: 5 };
  const players = [a, b, far, solo];
  w.damage(m, 1, 50, {}, players); w.damage(m, 4, 10, {}, players);
  const kills = w.damage(m, 2, 999, {}, players).filter(e => e.t === 'kill');
  assert.deepEqual(kills.map(k => k.to).sort(), [1, 2], 'the far member and the lone hunter under 15% get nothing');
  const each = killExp(MONSTERS.boar.exp, 5, MONSTERS.boar.level, false, (1 + PARTY.bonus) / 2);
  for (const k of kills) { assert.equal(k.exp, each); assert.ok(k.party); }
  const top = kills.find(k => k.to === 2), other = kills.find(k => k.to === 1);
  assert.ok(top.gold >= MONSTERS.boar.gold[0]); assert.equal(other.gold, 0); assert.deepEqual(other.drops, []);
  // levels too far apart: each is paid alone
  const w2 = world(); w2.party = P; const m2 = w2.monsters[0], low = { id: 1, x: 2, z: 0, lv: 1 }, high = { id: 2, x: 0, z: 2, lv: 30 };
  w2.damage(m2, 1, 30, {}, [low, high]);
  const k2 = w2.damage(m2, 2, 999, {}, [low, high]).filter(e => e.t === 'kill');
  assert.ok(k2.find(k => k.to === 1).exp > k2.find(k => k.to === 2).exp, 'no even share across a 29-level gap');
});

const hero = (cls = 'warrior') => { const c = Character.create('ทดสอบ', cls); c.gold = 1000; return c; };
test('a trade: offers are checked, locking and confirming on both sides, then a whole swap', () => {
  const T = new Trades({ now: () => 0 }), A = hero(), B = hero('hunter');
  A.addItem('iron_dap'); A.inventory[A.inventory.findIndex(s => s?.id === 'iron_dap')] = { id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 3 };
  A.addItem('hide', 5); B.addItem('ash', 4);
  assert.equal(T.request(1, 1), 'self');
  assert.equal(T.request(1, 2), null); const t = T.accept(2, 1); assert.equal(t.a, 1);
  assert.equal(T.request(3, 2), 'busy');
  assert.equal(T.offer(1, { items: [{ id: 'iron_dap', qty: 1 }], gold: 0 }, A), 'missing', 'a bare sword is not the +3 one with a card');
  assert.equal(T.offer(1, { items: [], gold: 5000 }, A), 'gold');
  assert.equal(T.offer(1, { items: [{ id: 'hide', qty: 9 }] }, A), 'missing');
  assert.equal(T.offer(1, { items: Array(TRADE.maxItems + 1).fill({ id: 'hide', qty: 1 }) }, A), 'bad_offer');
  assert.equal(T.offer(1, { items: [{ id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 3 }, { id: 'hide', qty: 3 }], gold: 100 }, A), true);
  assert.equal(T.offer(2, { items: [{ id: 'ash', qty: 4 }], gold: 0 }, B), true);
  assert.equal(T.confirm(1), null, 'lock first');
  T.lock(1); T.lock(2);
  T.offer(2, { items: [{ id: 'ash', qty: 2 }] }, B); assert.equal(t.locked.size, 0, 'a changed offer unlocks both');
  T.lock(1); T.lock(2);
  assert.equal(T.confirm(1), 'wait'); assert.equal(T.confirm(2), 'swap');
  assert.deepEqual(swap(A, B, t.offer[1], t.offer[2]), { ok: true });
  assert.deepEqual(B.inventory.find(s => s?.id === 'iron_dap'), { id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 3 }, 'the sword keeps its card and plus');
  assert.equal(B.count('hide'), 3); assert.equal(A.count('hide'), 2); assert.equal(A.count('ash'), 2);
  assert.deepEqual([A.gold, B.gold], [900, 1100]);
  assert.ok(T.cancel(1)); assert.equal(T.of(2), null);
});

test('a swap that does not fit happens not at all', () => {
  const A = hero(), B = hero();
  A.addItem('krabi');
  for (let i = 0; B.inventory.includes(null); i++) B.addItem('wood_sword');   // B's bag is full of swords
  const before = [JSON.stringify(A.toJSON()), JSON.stringify(B.toJSON())];
  const r = swap(A, B, cleanOffer({ items: [{ id: 'krabi', qty: 1 }], gold: 50 }), cleanOffer({ items: [], gold: 0 }));
  assert.deepEqual(r, { ok: false, why: 'room_b' });
  assert.deepEqual([JSON.stringify(A.toJSON()), JSON.stringify(B.toJSON())], before, 'nothing moved');
  assert.equal(cleanOffer({ items: [{ id: 'nope', qty: 1 }] }), null); assert.equal(cleanOffer({ items: [{ id: 'hide', qty: -2 }] }), null);
});
