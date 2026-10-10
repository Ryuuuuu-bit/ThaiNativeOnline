import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { ITEMS } from '../src/character/data/items.js';
import { HUNT_GEAR } from '../src/character/data/hunt-gear.js';
import { equipmentPool, equipmentDropChance, equipmentDropRows, equipmentLootLevel,
  EQUIPMENT_KINDS, EQUIPMENT_WEAPONS } from '../src/combat/data/equipment-loot.js';
import { bestiaryDrops } from '../src/data/bestiary.js';
import { LOOT } from '../src/combat/data/loot.js';

test('all 67 monsters have level-eligible gear in six slots and every weapon kind', () => {
  assert.equal(Object.keys(MONSTERS).length, 67);
  for (const [id, def] of Object.entries(MONSTERS)) {
    const pool = equipmentPool(def);
    assert.deepEqual([...new Set(pool.map(row => ITEMS[row.id].slot))].sort(), [...EQUIPMENT_KINDS].sort(), id);
    assert.deepEqual([...new Set(pool.filter(row => ITEMS[row.id].slot === 'weapon').map(row => ITEMS[row.id].weapon))].sort(), [...EQUIPMENT_WEAPONS].sort(), id);
    assert.ok(pool.every(row => row.weight > 0 && Number.isFinite(row.weight) && !ITEMS[row.id].retired
      && equipmentLootLevel(row.id) <= def.level && (ITEMS[row.id].minLevel ?? 1) <= def.level), id);
    assert.equal(new Set(pool.map(row => row.id)).size, pool.length);
    const rows = equipmentDropRows(def), chance = equipmentDropChance(def);
    assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.chance, 0) - chance) < 1e-12, id);
    assert.ok(rows.every(row => row.min === 1 && row.max === 1));
    assert.ok(chance > 0 && chance <= 1);
    for (const slot of EQUIPMENT_KINDS) {
      const slotChance = rows.filter(row => ITEMS[row.id].slot === slot).reduce((sum, row) => sum + row.chance, 0);
      assert.ok(Math.abs(slotChance - chance / 6) < 1e-12, `${id}:${slot}`);
    }
  }
});

test('every active equipment base is reachable; new accessories have valid existing icons and progression', () => {
  const reachable = new Set(Object.values(MONSTERS).flatMap(def => equipmentPool(def).map(row => row.id)));
  for (const [id, item] of Object.entries(ITEMS)) if (item.type === 'equip' && !item.retired) assert.ok(reachable.has(id), id);
  assert.equal(Object.keys(HUNT_GEAR).length, 108);
  for (const [id, item] of Object.entries(HUNT_GEAR)) {
    assert.ok(fs.existsSync(`public/${item.img}`), id);
    assert.ok(item.minLevel >= 1 && item.minLevel <= 90 && item.price > 0);
    assert.ok(['guard', 'sage', 'hunter'].includes(item.archetype));
    assert.ok(Object.values(item.bonus).every(value => Number.isFinite(value) && value > 0));
  }
});

test('bestiary merges independent legacy and extra gear chances by union and preserves supplies', () => {
  const def = MONSTERS.boar, drops = bestiaryDrops(def), extras = equipmentDropRows(def);
  const id = 'cloth_vest', old = LOOT[def.loot].find(row => row[0] === id), extra = extras.find(row => row.id === id);
  assert.ok(old && extra);
  assert.equal(drops.find(row => row.id === id).chance, 1 - (1 - old[1]) * (1 - extra.chance));
  assert.ok(drops.find(row => row.id === id).chance < old[1] + extra.chance);
  assert.deepEqual(drops.find(row => row.id === 'hide'), { id: 'hide', chance: .6, min: 1, max: 2 });
  assert.deepEqual(equipmentPool({ level: NaN }), []);
  assert.deepEqual(equipmentPool({ level: 0 }), []);
  assert.equal(equipmentDropChance({ boss: true, elite: true }), .60);
  assert.equal(equipmentDropChance({ elite: true }), .20);
  assert.equal(equipmentDropChance({}), .08);
});
