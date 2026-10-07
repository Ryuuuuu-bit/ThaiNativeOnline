// Titles (src/data/titles.js, Character records) and the ranking boards (server/ranking.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { TITLES, TITLE_CATS, checkTitles } from '../src/data/titles.js';
import { createRanking } from '../server/ranking.js';
import { MemoryStore } from '../server/store.js';
import { Presence } from '../server/presence.js';
import { Combatants } from '../server/combatants.js';
import { reconcileSave } from '../server/progress.js';

test('the titles tab lists 18 earnable titles in known categories, plus the rank titles', () => {
  const cats = new Set(TITLE_CATS.map(([k]) => k));
  assert.equal(TITLES.filter(t => !t.dynamic).length, 18);
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

test('a server kill reward counts toward the titles', () => {
  const cs = new Combatants();
  cs.load(1, Character.create('ล่า', 'warrior').toJSON(), { account: 'a', slot: 0 });
  cs.reward(1, { exp: 1, gold: 1, type: 'tiger' });
  assert.equal(cs.get(1).c.rec.kills, 1); assert.equal(cs.get(1).c.rec.boss.tiger, 1);
});
