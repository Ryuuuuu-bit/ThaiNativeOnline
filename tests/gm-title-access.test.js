import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { TITLES } from '../src/data/titles.js';
import { availableTitles, canWearTitle, hasGmTitleAccess, setGmTitleAccess } from '../src/data/titleAccess.js';
import { Combatants } from '../server/combatants.js';
import { fromSave } from '../server/progress.js';
import { attachNetProgress } from '../src/net/NetProgress.js';

test('GM entitlement unlocks the full catalog without changing earned titles or records', () => {
  const c = Character.create('GM', 'warrior'), earned = [...c.titles], rec = structuredClone(c.rec), level = c.level;
  assert.equal(TITLES.length, 41);
  assert.equal(c.setTitle('cp_top1'), false);
  setGmTitleAccess(c, true);
  assert.deepEqual(availableTitles(c), TITLES.map(t => t.id));
  for (const t of TITLES) assert.equal(c.setTitle(t.id), true);
  assert.equal(c.setTitle('unknown'), false);
  for (const id of ['constructor', 'toString', '__proto__', 1, undefined]) assert.equal(c.setTitle(id), false);
  assert.deepEqual(c.titles, earned); assert.deepEqual(c.rec, rec); assert.equal(c.level, level);
  assert.equal(c.toJSON().title, null); assert.deepEqual(c.toJSON().titles, earned);
  assert.equal(Object.keys(c.toJSON()).some(k => /admin|gmAccess|gmTitle/i.test(k)), false);
});

test('forged flags/options/save JSON and fromSave cannot grant entitlement', () => {
  for (const c of [new Character({ name: 'Fake', classId: 'warrior', admin: true, gmTitleAccess: true, title: 'cp_top1' }), fromSave({ name: 'Fake', classId: 'warrior', admin: true, gmTitleAccess: true })]) {
    c.admin = true; c.gmTitleAccess = true;
    assert.equal(hasGmTitleAccess(c), false); assert.equal(canWearTitle(c, 'cp_top1'), false);
  }
  const c = Character.create('GM', 'warrior'); setGmTitleAccess(c, true); c.setTitle('cp_top1');
  const restored = new Character(c.toJSON());
  assert.equal(hasGmTitleAccess(restored), false); assert.equal(restored.title, null);
});

test('rank loss updates genuine achievements while an entitled GM may keep its chosen title', () => {
  const c = Character.create('GM', 'warrior'); c.rec.cpRank = 1; c.checkTitles();
  setGmTitleAccess(c, true); c.setTitle('cp_top1'); c.rec.cpRank = 11; c.checkTitles();
  assert.equal(c.title, 'cp_top1'); assert.equal(c.titles.includes('cp_top1'), false);
  setGmTitleAccess(c, false); assert.equal(c.title, null);
  c.rec.cpRank = 1; c.checkTitles(); c.setTitle('cp_top1'); c.rec.cpRank = 11; c.checkTitles();
  assert.equal(c.title, null);
});

test('revocation preserves newly earned achievements and a genuinely earned worn title', () => {
  const c = Character.create('GM', 'warrior'); setGmTitleAccess(c, true); c.setTitle('hunt100');
  c.rec.kills = 100; assert.ok(c.checkTitles().includes('hunt100'));
  setGmTitleAccess(c, false); assert.equal(c.title, 'hunt100'); assert.ok(c.titles.includes('hunt100'));
  assert.equal(c.toJSON().title, 'hunt100'); assert.equal(c.setTitle('pk200'), false);
});

test('live sync carries the GM selection but storage and reconnect do not', () => {
  const cs = new Combatants(); cs.load(1, Character.create('GM', 'warrior').toJSON(), { account: 'gm', slot: 0 });
  const c = cs.get(1).c; setGmTitleAccess(c, true); c.setTitle('lg_sin50k');
  assert.equal(cs.me(1).title, 'lg_sin50k'); assert.equal(c.toJSON().title, null);
  assert.deepEqual(cs.me(1).titles, c.titles);
});

test('progress packets never grant capability and stale unearned selection after revoke is discarded', () => {
  const listeners = new Map(), net = { online: true, on(k, f) { listeners.set(k, f); }, send() {} };
  const c = Character.create('GM', 'warrior'); c.save = () => {};
  attachNetProgress(net, c);
  listeners.get('sync')({ c: { ...c.toJSON(), ack: 0, title: 'cp_top1', admin: true, gmTitleAccess: true } });
  assert.equal(hasGmTitleAccess(c), false); assert.equal(c.title, null);
  setGmTitleAccess(c, true);
  listeners.get('sync')({ c: { ...c.toJSON(), ack: 0, title: 'cp_top1' } }); assert.equal(c.title, 'cp_top1');
  setGmTitleAccess(c, false);
  listeners.get('titles')({ titles: c.titles, title: 'cp_top1', rec: c.rec }); assert.equal(c.title, null);
});
