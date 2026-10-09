import test from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY, searchBestiary } from '../src/data/bestiary.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { LOOT } from '../src/combat/data/loot.js';
import { ITEMS } from '../src/character/data/items.js';
import { MAPS } from '../src/world/maps.js';
import { combatSpawns } from '../src/data/spawns.js';
import { cardRate } from '../src/character/data/cards.js';

test('guide covers all spawning monsters and exact independent loot/card chances', () => {
  assert.deepEqual(BESTIARY.map(m => m.id).sort(), [...new Set(combatSpawns().map(z => z.type))].sort());
  for (const m of BESTIARY) {
    assert.ok(m.locations.length); assert.ok(m.locations.every(l => MAPS[l.map]));
    assert.equal(m.hp, MONSTERS[m.id].hp);
    assert.deepEqual(m.drops.filter(d => !d.card).map(d => [d.id, d.chance, d.min, d.max]), LOOT[m.loot].filter(([id]) => ITEMS[id]));
    assert.equal(m.drops.find(d => d.card).chance, cardRate(m));
    assert.ok(m.drops.every(d => ITEMS[d.id] && d.chance > 0 && d.chance <= 1));
  }
});
test('guide filters by real map, boss kind, level and actual item drops', () => {
  assert.ok(searchBestiary({ query: ITEMS.hide.name }).some(m => m.id === 'boar'));
  const bosses = searchBestiary({ map: 'demon_rift', kind: 'boss' });
  assert.equal(bosses.length, 1); assert.equal(bosses[0].id, 'demon_rift_3');
  const nearby = searchBestiary({ nearLevel: 5 }); assert.ok(nearby.length); assert.ok(nearby.every(m => Math.abs(m.level - 5) <= 5));
  assert.equal(searchBestiary({ query: 'does-not-exist' }).length, 0);
});
