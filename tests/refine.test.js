// ตีบวก (src/character/data/refine.js), two-handed weapons, and the server's shop range check
// (src/data/shopSites.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFINE_MAX, REFINE_SAFE, REFINE_RATE, refinable, refineBonus, refineCost, oreFor, sameGear } from '../src/character/data/refine.js';
import { ITEMS } from '../src/character/data/items.js';
import { SHOPS } from '../src/data/shops.js';
import { NPCS } from '../src/data/npcs.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SHOP_SITES, SHOP_RANGE, nearShop, shopSpot } from '../src/data/shopSites.js';
import { Character } from '../src/character/Character.js';
import { Combatants, sane } from '../server/combatants.js';
import { applyOp, fromSave } from '../server/progress.js';

const setup = (cls = 'warrior') => {
  const c = Character.create('ทดสอบ', cls); c.gold = 50000;
  c.addItem('sacred_ore', 20); c.addItem('gold_leaf', 20);
  return c;
};
const idx = (c, id) => c.inventory.findIndex(s => s?.id === id);

test('the rules: +10 at most, safe to +4, ores and fees for sale at the forge', () => {
  assert.equal(REFINE_RATE.length, REFINE_MAX + 1);
  for (let n = 1; n <= REFINE_MAX; n++) assert.equal(REFINE_RATE[n] === 1, n <= REFINE_SAFE, `+${n}`);
  for (let n = REFINE_SAFE + 2; n <= REFINE_MAX; n++) assert.ok(REFINE_RATE[n] < REFINE_RATE[n - 1], 'each step riskier');
  assert.ok(!refinable(ITEMS.takrut), 'charms are not refined'); assert.ok(!refinable(ITEMS.potion_s));
  assert.equal(oreFor(ITEMS.iron_dap), 'sacred_ore'); assert.equal(oreFor(ITEMS.hide_armor), 'gold_leaf');
  for (const ore of ['sacred_ore', 'gold_leaf']) assert.ok(SHOPS.enhance.stock.includes(ore) && ITEMS[ore].img);
  assert.deepEqual(refineBonus(ITEMS.iron_dap, 4), { atk: 12 }); assert.deepEqual(refineBonus(ITEMS.palm_book, 2), { matk: 6 });
  assert.deepEqual(refineBonus(ITEMS.hide_boots, 7), { def: 7 });
  assert.equal(refineCost(ITEMS.iron_dap, REFINE_MAX), null);
  assert.deepEqual(refineCost(ITEMS.iron_dap, 4), { to: 5, gold: 500, ore: 'sacred_ore', rate: REFINE_RATE[5], risky: true });
});

test('a try: safe steps always land, a failed risky one breaks the item with its cards', () => {
  const c = setup(); c.addItem('iron_dap'); c.addItem('card_boar');
  c.insertCard(idx(c, 'card_boar'), idx(c, 'iron_dap'));
  const gold = c.gold, ore = c.count('sacred_ore');
  for (let n = 1; n <= REFINE_SAFE; n++) assert.equal(c.refineGear(idx(c, 'iron_dap'), () => .999).outcome, 'up');
  assert.equal(c.inventory[idx(c, 'iron_dap')].plus, REFINE_SAFE);
  assert.equal(c.gold, gold - (100 + 200 + 300 + 400)); assert.equal(c.count('sacred_ore'), ore - 4);
  assert.equal(c.refineGear(idx(c, 'iron_dap'), () => REFINE_RATE[5] - .01).outcome, 'up');
  const r = c.refineGear(idx(c, 'iron_dap'), () => .99);
  assert.deepEqual([r.outcome, r.to, r.cards], ['broke', 6, ['card_boar']]); assert.equal(idx(c, 'iron_dap'), -1, 'gone, cards and all');
  // not enough
  c.addItem('hide_armor'); c.gold = 50;
  assert.deepEqual(c.refineGear(idx(c, 'hide_armor')), { ok: false, why: 'gold' });
  c.gold = 5000; while (c.count('gold_leaf')) c.removeAt(idx(c, 'gold_leaf'), c.count('gold_leaf'));
  assert.deepEqual(c.refineGear(idx(c, 'hide_armor')), { ok: false, why: 'ore' });
  c.addItem('takrut'); assert.equal(c.refineGear(idx(c, 'takrut')).why, 'not_refinable');
});

test('worn gear refines in place; the plus counts, travels with the item and is saved', () => {
  const c = setup(); const atk = c.patk;
  assert.equal(c.refineGear('weapon').outcome, 'up'); assert.equal(c.refine.weapon, 1);
  assert.equal(c.patk, atk + refineBonus(ITEMS.wood_sword, 1).atk);
  const def = c.defense; c.refineGear('armor'); c.refineGear('armor'); assert.ok(c.defense > def);
  assert.ok(c.refineTargets().some(t => t.worn && t.slot === 'weapon' && t.plus === 1));
  c.unequip('weapon'); assert.equal(c.inventory[idx(c, 'wood_sword')].plus, 1); assert.ok(c.patk < atk, 'the sword and its plus are off');
  c.equip(idx(c, 'wood_sword')); assert.equal(c.refine.weapon, 1);
  const back = new Character(JSON.parse(JSON.stringify(c)));
  assert.deepEqual([back.refine.weapon, back.refine.armor], [1, 2]);
  // a plus where none belongs is dropped
  const odd = new Character({ ...c.toJSON(), refine: { charm: 5, weapon: 99 }, inventory: [{ id: 'potion_s', qty: 1, plus: 3 }, { id: 'krabi', qty: 1, plus: -2 }] });
  assert.deepEqual([odd.refine.charm, odd.refine.weapon, odd.inventory[0].plus, odd.inventory[1].plus], [0, REFINE_MAX, undefined, undefined]);
  // guests' sheets keep the worn pluses too
  assert.equal(sane({ level: 5, equipment: { weapon: 'iron_dap' }, refine: { weapon: 3 } }, 'warrior').refine.weapon, 0, 'a guest sheet\'s pluses are not taken at their word');
});

test('the server names gear by id, cards and plus, and rolls ตีบวก only at the forge', () => {
  const c = setup(); c.addItem('iron_dap'); c.addItem('iron_dap');
  c.refineGear(idx(c, 'iron_dap'));                                   // one +1, one +0
  const s = fromSave(c.toJSON());
  assert.ok(sameGear(s.inventory[idx(s, 'iron_dap')], undefined, 1));
  assert.equal(applyOp(s, { op: 'equip', id: 'iron_dap', plus: 2 }), false, 'no +2 sword');
  assert.equal(applyOp(s, { op: 'equip', id: 'iron_dap', plus: 1 }), true); assert.equal(s.refine.weapon, 1);
  const cs = new Combatants({ now: () => 100, random: () => .99 });
  cs.load(1, c.toJSON(), { account: 'a', slot: 0 });
  const forge = shopSpot('enhance'), at = { map: forge.map, x: forge.x + 2, z: forge.z };
  assert.equal(cs.op(1, { op: 'refine', worn: 'weapon' }, { ...at, x: at.x + 40 }), false); assert.equal(cs.get(1).refined.why, 'no_shop');
  assert.equal(cs.op(1, { op: 'refine', worn: 'weapon' }, at), true); assert.equal(cs.get(1).c.refine.weapon, 1);
  assert.equal(cs.op(1, { op: 'refine', id: 'iron_dap', plus: 1 }, at), true);
  assert.ok(cs.get(1).c.inventory.some(x => x?.id === 'iron_dap' && x.plus === 2));
  assert.equal(cs.op(1, { op: 'refine', id: 'iron_dap', plus: 7 }, at), false); assert.equal(cs.get(1).refined.why, 'no_item');
});

test('retired offhand gear redeems with full bags, cards and refinement exactly once', () => {
  const c = setup('hunter');
  const old = new Character({ ...c.toJSON(), inventory: Array.from({ length: 24 }, () => ({ id: 'wood_sword', qty: 1 })), equipment: { ...c.equipment, offhand: 'buffalo_shield' }, cards: { offhand: ['card_crab'] }, refine: { offhand: 4 } });
  assert.equal('offhand' in old.equipment, false);
  assert.ok(old.inventory.some(x => x?.id === 'card_crab'));
  assert.ok(!old.inventory.some(x => x?.id === 'buffalo_shield'));
  assert.equal(old.gold, c.gold + 120 + 1000 + 200);
  const reloaded = new Character(old.toJSON());
  assert.equal(reloaded.gold, old.gold);
  assert.equal(reloaded.inventory.filter(x => x?.id === 'card_crab').length, 1);
});

test('retired gear in bags and charm slots redeems and cannot be acquired', () => {
  const c = setup('shaman');
  const old = new Character({ ...c.toJSON(), inventory: [{ id: 'mo_knife', qty: 1, plus: 2, cards: ['card_boar'] }], equipment: { ...c.equipment, charm: 'rattan_shield' }, cards: { charm: ['card_soldier'] }, refine: { charm: 1 } });
  assert.equal(old.gold, c.gold + 40 + 300 + 120 + 25 + 100 + 50);
  assert.equal(old.equipment.charm, null);
  assert.ok(old.inventory.some(x => x?.id === 'card_boar'));
  assert.ok(old.inventory.some(x => x?.id === 'card_soldier'));
  for (const id of ['mo_knife', 'rattan_shield', 'buffalo_shield']) assert.equal(old.addItem(id), false);
});

test('shop sites: every shop NPC has one, by its shop, on its map', () => {
  for (const n of NPCS.filter(n => n.shopType)) assert.ok(SHOP_SITES[n.shopType]?.some(s => s.npc === n.id), `${n.id} has no site`);
  const L = Object.fromEntries(LANDMARKS.map(l => [l.id, l]));
  for (const [shop, mark] of [['blacksmith', 'forge'], ['enhance', 'enhance'], ['general', 'general'], ['herbalist', 'herbalist'], ['occult', 'occult']]) {
    assert.ok(SHOP_SITES[shop].some(s => s.map === 'city' && Math.hypot(s.x - L[mark].x, s.z - L[mark].z) < 8), `${shop} stands by its building`);
  }
  const marsh = shopSpot('marsh');
  assert.equal(marsh.map, 'klong');
  assert.ok(nearShop('marsh', 'klong', marsh.x + SHOP_RANGE - 1, marsh.z)); assert.ok(!nearShop('marsh', 'klong', marsh.x + SHOP_RANGE + 1, marsh.z));
  assert.ok(!nearShop('marsh', 'city', marsh.x, marsh.z));
});

test('no free heal and no stand-up from stats or gear: HP stays as it is, clamped; the fallen handle nothing', () => {
  const c = Character.create('เลือด', 'warrior'); c.points = 10; c.hp = 20;
  for (let i = 0; i < 5; i++) c.allocate('vit');
  assert.equal(c.hp, 20, 'more VIT raises max HP, not HP');
  c.resetStats(); for (let i = 0; i < 5; i++) c.allocate('vit'); assert.equal(c.hp, 20, 'a respec heals nothing');
  c.addItem('hide_armor'); const i = c.inventory.findIndex(s => s?.id === 'hide_armor');
  c.equip(i); assert.equal(c.hp, 20); c.unequip('armor'); assert.equal(c.hp, 20);
  c.hp = 0;
  assert.equal(c.equip(c.inventory.findIndex(s => s?.id === 'hide_armor')), false, 'the dead wear nothing new');
  assert.equal(c.refineGear('weapon').why, 'dead');
  assert.equal(c.alive, false);
  const m = Character.create('มานา', 'shaman'); m.addItem('ether'); const e = m.inventory.findIndex(s => s?.id === 'ether');
  assert.equal(m.useAt(e), false, 'an MP potion at full MP is kept');
});

test('retired equipment is absent from every shop, loot table and starter kit', async () => {
  const { SHOPS } = await import('../src/data/shops.js');
  const { LOOT } = await import('../src/combat/data/loot.js');
  const { START_ITEMS } = await import('../src/character/data/classes.js');
  for (const shop of Object.values(SHOPS)) for (const id of shop.stock ?? []) assert.ok(!ITEMS[id].retired, id);
  for (const table of Object.values(LOOT)) for (const [id] of table) assert.ok(!ITEMS[id].retired, id);
  for (const kit of Object.values(START_ITEMS)) for (const id of kit) assert.ok(!ITEMS[id].retired, id);
});
