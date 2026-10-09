import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOT } from '../src/combat/data/loot.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { ITEMS } from '../src/character/data/items.js';
import { WEAPON_KINDS } from '../src/character/data/classes.js';
import { CARD_RATE } from '../src/character/data/cards.js';
import { expeditionGearIds } from '../src/character/data/expedition-gear.js';
import { EXPEDITIONS } from '../src/world/expeditions.js';
import { combatSpawns } from '../src/data/spawns.js';

const KINDS = [...new Set(Object.values(WEAPON_KINDS).flat())].sort();
const LOW = ['tiger_wrap', 'bone_dagger', 'iron_dap', 'bamboo_bow', 'palm_book', 'bone_yant'];
const MID = ['kris', 'horn_bow', 'croc_wrap', 'croc_dagger', 'bog_book', 'bog_yant'];
const REGIONAL = {
  beast: [LOW, .03], spirit: [LOW, .03],
  marsh: [MID, .025], spirit2: [MID, .025],
  rare: [LOW, .30], boss: [LOW, .35], pop: [LOW, .45],
  rare2: [MID, .30], chalawan: [MID, .40],
};
const gearOf = table => table.filter(([id]) => ITEMS[id]?.type === 'equip');
const weaponsOf = table => gearOf(table).filter(([id]) => ITEMS[id].slot === 'weapon');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

// Explicit pre-change receipts guard against accidentally changing supplies or
// treating a charm named "fang" as a material. Quantities are part of the contract.
const SUPPLIES = {
  beast: [['hide', .6, 1, 2], ['tusk', .35, 1, 1], ['potion_s', .22, 1, 1], ['ether', .1, 1, 1]],
  spirit: [['ash', .6, 1, 2], ['ether', .25, 1, 1], ['potion_s', .2, 1, 1]],
  rare: [['potion_m', 1, 2, 3], ['ether', .8, 1, 2], ['ash', 1, 3, 5]],
  pop: [['potion_m', 1, 3, 4], ['ether', 1, 1, 2]],
  marsh: [['hide', .6, 1, 3], ['croc_scale', .35, 1, 2], ['potion_m', .22, 1, 1], ['ether', .12, 1, 1]],
  spirit2: [['ash', .7, 1, 3], ['ether', .3, 1, 2], ['potion_m', .2, 1, 1]],
  rare2: [['potion_m', 1, 2, 3], ['ether', 1, 1, 2], ['ash', 1, 3, 6]],
  chalawan: [['potion_m', 1, 3, 5], ['ether', 1, 2, 3], ['croc_scale', 1, 4, 8]],
  boss: [['potion_m', 1, 1, 2], ['ether', .8, 1, 1]],
};
const NON_WEAPONS_BEFORE = {
  beast: { cloth_vest: .04, hide_armor: .03, mongkol: .02, sandals: .04, hide_boots: .02 },
  spirit: { takrut: .06, pakhaoma: .04, sabai: .02 },
  rare: { takrut: .6, tiger_fang: .2, chada: .3, prakam: .15 },
  pop: { tiger_fang: .5, takrut: .6, mongkol: .4, chada: .4, prakam: .25 },
  marsh: { croc_boots: .02, croc_armor: .012 },
  spirit2: { pakhaoma: .04, sabai: .03 },
  rare2: { chada: .3, prakam: .15 },
  chalawan: { chalawan_fang: .3, croc_armor: .5 },
  boss: { tiger_fang: .35, hide_armor: .3 },
};
const WEAPONS_BEFORE = {
  beast: { tiger_wrap: .012, bone_dagger: .012 },
  spirit: { palm_book: .02, bone_yant: .02, iron_dap: .012, bamboo_bow: .012 },
  rare: { palm_book: .25, bone_yant: .25, tiger_wrap: .2, bone_dagger: .2 },
  pop: { iron_dap: .4, bamboo_bow: .4, palm_book: .25, bone_yant: .25, tiger_wrap: .3, bone_dagger: .3 },
  marsh: { kris: .01, horn_bow: .01, croc_wrap: .01, croc_dagger: .01 },
  spirit2: { bog_book: .01, bog_yant: .01 },
  rare2: { bog_book: .2, bog_yant: .2 },
  chalawan: { kris: .3, horn_bow: .3, croc_wrap: .3, croc_dagger: .3, bog_book: .2, bog_yant: .2 },
  boss: { iron_dap: .25, bamboo_bow: .25, tiger_wrap: .25, bone_dagger: .25, palm_book: .2, bone_yant: .2 },
};

function assertWeaponCoverage(table, label) {
  const weapons = weaponsOf(table);
  assert.equal(weapons.length, 6, label);
  assert.deepEqual(weapons.map(([id]) => ITEMS[id].weapon).sort(), KINDS, label);
  assert.equal(new Set(weapons.map(([, chance]) => chance)).size, 1, `${label}: equal weapon-kind rates`);
}

test('all drops retain independent four-field tuples, active IDs and unique item rolls', () => {
  assert.equal(Object.keys(LOOT).length, 9 + EXPEDITIONS.length * 2);
  for (const [name, table] of Object.entries(LOOT)) {
    assert.equal(new Set(table.map(([id]) => id)).size, table.length, `${name}: duplicate item ID`);
    for (const entry of table) {
      assert.equal(entry.length, 4, name);
      const [id, chance, min, max] = entry;
      assert.ok(ITEMS[id] && !ITEMS[id].retired, `${name}: active item ${id}`);
      assert.ok(Number.isFinite(chance) && chance > 0 && chance <= 1, `${name}: chance ${id}`);
      assert.ok(Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min, `${name}: quantities ${id}`);
      if (ITEMS[id].type === 'equip') assert.deepEqual([min, max], [1, 1], `${name}: single gear ${id}`);
    }
    assertWeaponCoverage(table, name);
  }
  // Rates are independent probabilities, not a weighted selection normalized to one.
  close(weaponsOf(LOOT.pop).reduce((sum, [, chance]) => sum + chance, 0), 2.7);
});

test('regional tables supply exactly the requested six-kind pool and per-item chances', () => {
  assert.equal(KINDS.length, 6);
  for (const [name, [pool, chance]] of Object.entries(REGIONAL)) {
    const weapons = weaponsOf(LOOT[name]);
    assert.deepEqual(weapons.map(([id]) => id).sort(), [...pool].sort(), name);
    for (const [, actual] of weapons) assert.equal(actual, chance, name);
  }
});

test('existing weapons are retained and their chances never decrease', () => {
  for (const [name, previous] of Object.entries(WEAPONS_BEFORE)) for (const [id, chance] of Object.entries(previous)) {
    const entry = LOOT[name].find(([item]) => item === id);
    assert.ok(entry, `${name}: retained ${id}`);
    assert.ok(entry[1] >= chance, `${name}: ${id} chance must not fall`);
  }
});

test('existing regional nonweapon gear rises by 50%, capped at certainty, without changing quantities', () => {
  for (const [name, previous] of Object.entries(NON_WEAPONS_BEFORE)) {
    const actual = gearOf(LOOT[name]).filter(([id]) => ITEMS[id].slot !== 'weapon');
    assert.deepEqual(actual.map(([id]) => id).sort(), Object.keys(previous).sort(), name);
    for (const [id, chance, min, max] of actual) {
      close(chance, Math.min(1, previous[id] * 1.5));
      assert.deepEqual([min, max], [1, 1]);
    }
  }
});

test('materials, HP/MP potions and card probabilities remain unchanged', () => {
  for (const [name, before] of Object.entries(SUPPLIES)) {
    assert.deepEqual(LOOT[name].filter(([id]) => ITEMS[id].type !== 'equip'), before, name);
  }
  assert.deepEqual(CARD_RATE, { normal: .0002, elite: .0025, boss: .005 });
  assert.ok(Object.values(LOOT).every(table => table.every(([id]) => ITEMS[id].type !== 'card')), 'cards retain their separate roll');
});

test('all eight expedition tiers offer eight single gear drops at 2% hunt / 25% boss', () => {
  assert.equal(EXPEDITIONS.length, 8);
  const allIds = new Set();
  for (const expedition of EXPEDITIONS) {
    const expectedIds = expeditionGearIds(expedition);
    assert.equal(expectedIds.length, 8, expedition.id);
    assert.equal(new Set(expectedIds).size, 8, expedition.id);
    for (const id of expectedIds) {
      assert.ok(!allIds.has(id), `unique gear across tiers: ${id}`);
      allIds.add(id);
      assert.equal(ITEMS[id].type, 'equip', id);
      assert.equal(ITEMS[id].minLevel, expedition.levels[0], id);
    }
    for (const boss of [false, true]) {
      const name = `${boss ? 'boss' : 'hunt'}_${expedition.id}`, table = LOOT[name];
      assert.deepEqual(gearOf(table).map(([id]) => id), expectedIds, name);
      assert.deepEqual(gearOf(table).map(([, chance, min, max]) => [chance, min, max]), expectedIds.map(() => [boss ? .25 : .02, 1, 1]), name);
      assert.deepEqual(table.filter(([id]) => ITEMS[id].type !== 'equip'), [
        ['ash', .6, 1, 3], ['potion_m', boss ? 1 : .2, 1, boss ? 3 : 1], ['ether', boss ? 1 : .2, 1, 2],
      ], name);
      assert.deepEqual(gearOf(table).filter(([id]) => ITEMS[id].slot !== 'weapon').map(([id]) => ITEMS[id].slot).sort(), ['armor', 'shoes']);
    }
  }
  assert.equal(allIds.size, 64);
});

test('every real spawning monster has a loot table covering all six weapon kinds', () => {
  const types = new Set(combatSpawns().map(spawn => spawn.type));
  assert.ok(types.size >= 32, 'uses the actual regional and expedition spawn roster');
  const tables = new Set();
  for (const type of types) {
    const monster = MONSTERS[type];
    assert.ok(monster, type);
    assert.ok(LOOT[monster.loot], `${type}: existing loot table ${monster.loot}`);
    assertWeaponCoverage(LOOT[monster.loot], type);
    tables.add(monster.loot);
  }
  assert.deepEqual([...tables].sort(), Object.keys(LOOT).sort(), 'all configured loot categories are exercised by real spawns');
});
