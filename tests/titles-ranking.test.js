// Titles (src/data/titles.js, Character records) and the ranking boards (server/ranking.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { TITLES, TITLE_CATS, checkTitles } from '../src/data/titles.js';
import { createRanking } from '../server/ranking.js';
import { MemoryStore, PgStore } from '../server/store.js';
import { Presence } from '../server/presence.js';
import { Combatants } from '../server/combatants.js';
import { reconcileSave } from '../server/progress.js';

const envelope = c => ({
  'tno.character.v1': JSON.stringify(c.toJSON()),
  'tno.quests.v1': JSON.stringify({}),
  'tno.location.v1': JSON.stringify({ map: 'city', x: 0, z: 0 }),
});
const rankedCharacter = (name, level, plus = 0) => {
  const c = Character.create(name, 'warrior');
  c.level = level; c.equipment.weapon = 'iron_dap'; c.refine.weapon = plus;
  return c;
};

test('the titles tab lists 36 earnable titles (16 of them PK) in known categories, plus the rank titles', () => {
  const cats = new Set(TITLE_CATS.map(([k]) => k));
  assert.equal(TITLES.filter(t => !t.dynamic).length, 36);
  assert.equal(TITLES.filter(t => t.cat === 'pvp').length, 16);
  assert.ok(TITLES.every(t => cats.has(t.cat) && t.name && t.hint && t.color));
  assert.equal(new Set(TITLES.map(t => t.id)).size, TITLES.length);
});

test('records earn titles; a save keeps them and the worn one; a rank title is lost with the rank', () => {
  const c = Character.create('หมอ', 'herbalist');
  assert.deepEqual(c.titles, ['rookie']);
  c.level = 20; for (let i = 0; i < 100; i++) c.noteKill('wolf'); c.noteKill('pop');
  const got = c.checkTitles();
  assert.deepEqual(got.sort(), ['boss_pop', 'hunt100', 'lv10', 'lv20']);
  assert.ok(c.setTitle('lv20')); assert.equal(c.setTitle('lv99'), false, 'not earned');
  const back = new Character(JSON.parse(JSON.stringify(c)));
  assert.equal(back.title, 'lv20'); assert.equal(back.rec.kills, 101); assert.equal(back.rec.boss.pop, 1);
  back.rec.cpRank = 1; checkTitles(back); assert.ok(back.titles.includes('cp_top1')); back.setTitle('cp_top1');
  back.rec.cpRank = 4; checkTitles(back);
  assert.ok(!back.titles.includes('cp_top1') && back.titles.includes('cp_top10')); assert.equal(back.title, null, 'the lost rank title comes off');
  // a forged first save reaches the server as a fresh character (server/progress.js reconcileSave)
  const forged = reconcileSave({ 'tno.character.v1': JSON.stringify({ ...c.toJSON(), titles: ['lv99'], title: 'lv99' }) }, null);
  assert.deepEqual(JSON.parse(forged['tno.character.v1']).titles, ['rookie']);
});

test('ranking: saved and live characters sorted by power, level and plus; ranks land in the online records', async () => {
  const store = new MemoryStore();
  const mk = (name, lv) => { const c = Character.create(name, 'muaythai'); c.level = lv; return c; };
  await store.putSlot('a', 0, mk('หนึ่ง', 30).toJSON());
  await store.putSlot('b', 0, mk('สอง', 10).toJSON());
  const live = mk('สาม', 50), seen = [];
  const r = createRanking({ store, live: () => [{ id: 7, key: 'c:0', c: live }], onRanks: id => seen.push(id) });
  await r.refresh();
  const b = r.boards();
  assert.equal(b.total, 3);
  assert.deepEqual(b.level.map(x => x.name), ['สาม', 'หนึ่ง', 'สอง']);
  assert.equal(b.power[0].name, 'สาม'); assert.equal(b.enhance.length, 0, 'nobody has a plus');
  assert.equal(live.rec.lvRank, 1); assert.deepEqual(seen, [7]);
  assert.equal(r.mine('c:0').cpRank, 1); assert.equal(r.infoOf('สอง').lv, 10);
  assert.equal(b.holders.cp_top1, 1); assert.equal(b.holders.cp_top10, 3);
});

test('presence: a guest may not wear a rank title; chat lines carry the worn title', () => {
  const P = new Presence();
  P.join('ws', { name: 'แขก', title: 'cp_top1' });
  assert.equal(P.players.get('ws').title, null);
  assert.equal(P.setTitle('ws', 'lv10').title, 'lv10');
  assert.equal(P.chat('ws', 'สวัสดี').title, 'lv10');
  assert.equal(P.setTitle('ws', 'cp_top1', true).title, 'cp_top1');
});

test('ranking decodes production envelopes across accounts and offline slots; live state replaces its saved row', async () => {
  const store = new MemoryStore();
  const a0 = rankedCharacter('OfflineMain', 80, 4), a1 = rankedCharacter('OfflineAlt', 25, 8);
  const b0 = rankedCharacter('OnlineMain', 10, 1), b2 = rankedCharacter('OtherAlt', 45, 2);
  for (const [account, slot, c] of [['a', 0, a0], ['a', 1, a1], ['b', 0, b0], ['b', 2, b2]]) {
    await store.putSlot(account, slot, envelope(c));
  }
  const online = rankedCharacter('OnlineMain', 90, 6), seen = [];
  const ranking = createRanking({ store, live: () => [{ key: 'b:0', id: 7, c: online }], onRanks: id => seen.push(id) });
  await ranking.refresh();
  const boards = ranking.boards();
  assert.equal(boards.total, 4, 'each account/slot counts once, including offline alts');
  assert.deepEqual(boards.level.map(row => row.name), ['OnlineMain', 'OfflineMain', 'OtherAlt', 'OfflineAlt']);
  assert.deepEqual(boards.enhance.map(row => [row.name, row.enh]), [['OfflineAlt', 8], ['OnlineMain', 6], ['OfflineMain', 4], ['OtherAlt', 2]]);
  const expected = new Map([a0, a1, online, b2].map(c => [c.name, c]));
  for (const board of [boards.power, boards.level, boards.enhance]) {
    assert.equal(new Set(board.map(row => row.name)).size, 4);
    for (const row of board) {
      const c = expected.get(row.name);
      assert.ok(c, 'public rows retain the saved character name');
      assert.deepEqual({ cls: row.cls, lv: row.lv, cp: row.cp, enh: row.enh },
        { cls: c.classId, lv: c.level, cp: c.power, enh: c.refineMax });
    }
  }
  assert.equal(ranking.mine('b:0').cp, online.power);
  assert.equal(ranking.mine('b:0').lvRank, 1);
  assert.equal(ranking.mine('a:1').enhRank, 1);
  assert.equal(ranking.infoOf('OtherAlt').lv, 45);
  assert.equal(online.rec.lvRank, 1);
  assert.deepEqual(seen, [7]);
  assert.equal(boards.holders.cp_top1, 1);
  assert.equal(boards.holders.cp_top10, 4);
});

test('default memory scan and rankings include characters beyond 5000 while explicit limits and rename exclusion remain', async () => {
  const store = new MemoryStore(), count = 5002;
  const base = rankedCharacter('Seed', 1).toJSON();
  // Seed directly: putSlot checks uniqueness/UIDs against every existing row.
  // Those write-path checks are unrelated to this read/scan regression.
  for (let i = 0; i < count; i++) {
    const name = `Saved${i}`, data = { 'tno.character.v1': JSON.stringify({ ...base, name, level: i === count - 1 ? 100 : 1 }) };
    store.slots.set(`account${i}`, new Map([[0, { data, needsRename: false }]]));
  }
  store.slots.set('blocked', new Map([[0, { data: envelope(rankedCharacter('Blocked', 150, 10)), needsRename: true }]]));
  assert.equal((await store.allCharacters()).length, count);
  assert.equal((await store.allCharacters(undefined)).length, count);
  assert.equal((await store.allCharacters(5000)).length, 5000);
  assert.equal((await store.allCharacters(2)).length, 2);
  assert.deepEqual(await store.allCharacters(0), []);
  const ranking = createRanking({ store });
  await ranking.refresh();
  const boards = ranking.boards();
  assert.equal(boards.total, count);
  assert.equal(boards.level.length, 100, 'public board cap does not cap the ranked population');
  assert.equal(boards.level[0].name, 'Saved5001');
  assert.equal(ranking.mine('account5001:0').lvRank, 1);
  assert.ok(ranking.mine('account5000:0'));
  assert.equal(ranking.mine('blocked:0'), null);
  assert.equal(ranking.infoOf('Blocked'), null);
});

test('Postgres character scan has no default SQL limit and preserves eligibility and explicit limits', async () => {
  const calls = [], rows = [{ account: 'a', slot: 0, data: envelope(rankedCharacter('Saved', 20)) }];
  const store = new PgStore({ query: async (sql, values) => { calls.push({ sql, values }); return { rows }; } });
  assert.deepEqual(await store.allCharacters(), rows);
  assert.match(calls[0].sql, /where not rename_required/);
  assert.doesNotMatch(calls[0].sql, /limit/i);
  assert.deepEqual(calls[0].values, []);
  await store.allCharacters(5000);
  assert.match(calls[1].sql, /where not rename_required.*limit \$1$/);
  assert.deepEqual(calls[1].values, [5000]);
  await store.allCharacters(0);
  assert.deepEqual(calls[2].values, [0]);
});

test('ranking ties remain stable when the saved query order changes', async () => {
  const rows = ['c', 'a', 'b'].map(account => ({ account, slot: 0, data: envelope(rankedCharacter(`Tie${account}`, 30, 4)) }));
  const ranking = createRanking({ store: { allCharacters: async () => rows } });
  await ranking.refresh();
  for (const board of ['power', 'level', 'enhance']) assert.deepEqual(ranking.boards()[board].map(row => row.name), ['Tiea', 'Tieb', 'Tiec']);
  const before = ['a', 'b', 'c'].map(account => ranking.mine(`${account}:0`));
  rows.reverse();
  await ranking.refresh();
  for (const board of ['power', 'level', 'enhance']) assert.deepEqual(ranking.boards()[board].map(row => row.name), ['Tiea', 'Tieb', 'Tiec']);
  assert.deepEqual(['a', 'b', 'c'].map(account => ranking.mine(`${account}:0`)), before);
});

test('a failed saved-character refresh retains boards, ranks, holders and offline lookups until recovery', async t => {
  const offline = rankedCharacter('OfflineLeader', 90, 8), online = rankedCharacter('OnlineFollower', 20, 2);
  let fail = false, now = 1000;
  const seen = [], warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  const ranking = createRanking({
    store: { allCharacters: async () => { if (fail) throw new Error('database unavailable'); return [{ account: 'a', slot: 1, data: envelope(offline) }]; } },
    live: () => [{ key: 'b:0', id: 7, c: online }], onRanks: id => seen.push(id), now: () => now,
  });
  await ranking.refresh();
  const before = structuredClone(ranking.boards()), savedRank = ranking.mine('a:1'), liveRank = ranking.mine('b:0');
  const records = { cpRank: online.rec.cpRank, lvRank: online.rec.lvRank, enhRank: online.rec.enhRank };
  assert.equal(liveRank.lvRank, 2);
  online.level = 100; now = 200000; fail = true;
  await ranking.refresh();
  assert.deepEqual(ranking.boards(), before);
  assert.deepEqual(ranking.mine('a:1'), savedRank);
  assert.deepEqual(ranking.mine('b:0'), liveRank);
  assert.equal(ranking.infoOf('OfflineLeader').lv, 90);
  assert.deepEqual({ cpRank: online.rec.cpRank, lvRank: online.rec.lvRank, enhRank: online.rec.enhRank }, records);
  assert.deepEqual(seen, [7], 'failed reads do not crown the live-only population');
  assert.equal(warnings.length, 1);
  assert.ok(ranking.stale());
  fail = false;
  await ranking.refresh();
  assert.equal(ranking.boards().total, 2);
  assert.equal(ranking.boards().at, now);
  assert.equal(ranking.mine('b:0').lvRank, 1);
  assert.deepEqual(seen, [7, 7]);
});

test('a server kill reward counts toward the titles', () => {
  const cs = new Combatants();
  cs.load(1, Character.create('ล่า', 'warrior').toJSON(), { account: 'a', slot: 0 });
  cs.reward(1, { exp: 1, gold: 1, type: 'tiger' });
  assert.equal(cs.get(1).c.rec.kills, 1); assert.equal(cs.get(1).c.rec.boss.tiger, 1);
});
