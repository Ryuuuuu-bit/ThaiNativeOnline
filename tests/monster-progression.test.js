import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { HUNTING_GROUNDS } from '../src/data/hunting.js';
import { CLASS_QUESTS } from '../src/data/quests.js';
import { MONSTER_EXP_RATE } from '../src/character/data/progression.js';

test('ordinary route offers each level 1–20 without changing bosses, elites or higher-level content', () => {
  const locked = Object.fromEntries(Object.entries(MONSTERS).filter(([, m]) => m.elite || m.boss || m.level > 20));
  assert.equal(createHash('sha256').update(JSON.stringify(locked)).digest('hex'), 'e99b147f5d795164a55fbd893448d149bf065833924101e1fd09c2a10cfd12a0');
  const ordinary = Object.values(MONSTERS).filter(m => !m.elite && !m.boss && m.level <= 20);
  for (let level = 1; level <= 20; level++) assert.ok(ordinary.some(m => m.level === level), `ordinary level ${level}`);
  assert.equal(MONSTERS.boar.level, 1);
  assert.equal(MONSTERS.fowl.level, 1);
  for (const id of ['phibpa', 'pray', 'dhole']) assert.equal(MONSTERS[id].level, 5);
  for (const id of ['monkey', 'phibpa', 'soldier', 'wraith', 'kumphi']) assert.equal(MONSTERS[id].exp, MONSTER_EXP_RATE(MONSTERS[id].level));
});

test('hunting signs describe actual ordinary rosters and existing class targets remain attainable', () => {
  for (const camp of HUNTING_GROUNDS) {
    const levels = camp.roster.map(r => MONSTERS[r.type].level);
    assert.deepEqual(camp.levels, [Math.min(...levels), Math.max(...levels)], camp.id);
  }
  for (const q of CLASS_QUESTS) {
    const id = q.objectives.find(o => o.kill).kill;
    assert.ok(MONSTERS[id].level <= q.minLevel, q.id);
    assert.ok(HUNTING_GROUNDS.some(c => c.roster.some(r => r.type === id)), id);
  }
});
