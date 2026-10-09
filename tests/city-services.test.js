import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPCS } from '../src/data/npcs.js';
import { SHOPS, SHOP_HOSTS } from '../src/data/shops.js';
import { QUESTS } from '../src/data/quests.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SHOP_SITES, SPOT_SITES, SHOP_RANGE, SHOP_APPROACHES, nearShop, nearNpc, shopSpot } from '../src/data/shopSites.js';
import { ITEMS } from '../src/character/data/items.js';
import { Character } from '../src/character/Character.js';
import { REFINE_SHOP, REFINE_ORE } from '../src/character/data/refine.js';
import { buy, stockOf, sellPrice } from '../src/shop/ShopSystem.js';
import { Combatants } from '../server/combatants.js';
import { SHOP_MAPS, shopOn } from '../server/progress.js';
import { navigation } from '../server/navigation.js';
import { MAPS, npcMap, walkable, landmarksOf } from '../src/world/maps.js';
import { mapDirectory } from '../src/ui/mapDirectory.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { createRng } from '../src/world/rng.js';

const formerWeapons = ['wood_sword', 'short_bow', 'krabi', 'hand_wrap', 'reed_wand', 'herb_book', 'iron_dap', 'bamboo_bow', 'tiger_wrap', 'bone_dagger'];
const formerArmor = ['cloth_vest', 'hide_armor', 'pha_khao', 'ngob', 'pakhaoma', 'sandals'];
const formerForge = ['wood_sword', 'iron_dap', 'krabi', 'bamboo_bow', 'hide_armor', 'hide_boots'];
const formerCity = new Set([...formerWeapons, ...formerArmor, ...formerForge, 'sacred_ore', 'gold_leaf', 'potion_s', 'potion_m', 'ether', 'palm_book', 'takrut', 'bone_yant', 'sabai', 'bia_kae', 'pha_yant']);
const sorted = values => [...values].sort();
const hero = () => { const c = Character.create('ServiceQA', 'warrior'); c.inventory.fill(null); c.gold = 100000; return c; };

test('one equipment counter retains every formerly purchasable city item', () => {
  const city = NPCS.filter(n => npcMap(n) === 'city');
  const stock = new Set(city.flatMap(n => stockOf(n.shopType)));
  assert.equal(formerCity.size, 28);
  assert.deepEqual(sorted(stock), sorted(formerCity));
  assert.deepEqual(sorted(stockOf('blacksmith')), sorted(new Set([...formerForge, ...formerWeapons, ...formerArmor])));
  assert.equal(stockOf('blacksmith').length, 17);
  assert.equal(city.filter(n => n.shopType === 'blacksmith').length, 1);
  for (const id of ['vendor_weapons', 'vendor_armor', 'vendor_charms']) assert.ok(!NPCS.some(n => n.id === id));
  assert.equal(NPCS.find(n => n.id === 'cargo_merchant').shopType, undefined);
  assert.equal(NPCS.find(n => n.id === 'fish_vendor_e').shopType, undefined);
  assert.equal(NPCS.filter(n => n.shopType === 'fish').length, 1);
  const ids = new Set(NPCS.map(n => n.id));
  for (const q of QUESTS) for (const id of [q.giver, q.turnIn, ...q.objectives.map(o => o.talk)].filter(Boolean)) assert.ok(ids.has(id));
});

test('merged gear still buys at item prices and sells at the same half-price rule', () => {
  for (const id of stockOf('blacksmith')) {
    const c = hero();
    assert.equal(buy(c, 'blacksmith', id).ok, true, id);
    assert.equal(c.gold, 100000 - ITEMS[id].price, id);
    assert.equal(c.count(id), 1);
    assert.equal(sellPrice(id), Math.max(1, Math.floor(ITEMS[id].price / 2)));
  }
  assert.deepEqual(stockOf('weapons'), formerWeapons);
  assert.deepEqual(stockOf('armor'), formerArmor);
  assert.deepEqual(stockOf('charms'), ['takrut']);
});

test('legacy shop IDs use surviving counters without widening their inventories', () => {
  for (const [shop, host] of Object.entries(SHOP_HOSTS)) {
    assert.deepEqual(SHOP_SITES[shop], SHOP_SITES[host]);
    assert.equal(SHOP_APPROACHES[shop], SHOP_APPROACHES[host]);
    const pos = shopSpot(shop), cs = new Combatants({ now: () => 100 });
    cs.load(1, hero().toJSON(), { account: 'serviceqa', slot: 0 });
    assert.equal(cs.op(1, { op: 'buy', shop, id: stockOf(shop)[0] }, pos), true);
    const before = JSON.stringify(cs.get(1).c.toJSON());
    const wrong = shop === 'weapons' ? 'hide_armor' : shop === 'armor' ? 'wood_sword' : 'bone_yant';
    assert.equal(cs.op(1, { op: 'buy', shop, id: wrong }, pos), false);
    assert.equal(JSON.stringify(cs.get(1).c.toJSON()), before);
    assert.equal(nearShop(shop, 'paddy', pos.x, pos.z), false);
    assert.equal(nearShop(shop, pos.map, pos.x + SHOP_RANGE + .01, pos.z), false);
  }
  for (const [shop, x, z] of [['weapons', -10.4, 20.5], ['armor', -10.4, 28], ['charms', -10.4, 35.5], ['general', -21, 160.5]]) {
    assert.equal(nearShop(shop, 'city', x, z), false, `${shop}: removed counter cannot authorize purchases`);
  }
  assert.equal(nearNpc('vendor_weapons', 'city', -10.4, 20.5), false);
});

test('server map availability matches actual service sites, aliases and travelling sellers', () => {
  for (const [shop, sites] of Object.entries(SHOP_SITES)) {
    assert.deepEqual(SHOP_MAPS[shop], new Set(sites.map(s => s.map)), shop);
    for (const map of Object.keys(MAPS)) assert.equal(shopOn(shop, map), sites.some(s => s.map === map), `${shop}/${map}`);
  }
  for (const alias of Object.keys(SHOP_HOSTS)) {
    assert.equal(shopOn(alias, 'city'), true);
    for (const map of ['paddy', 'deep_forest', 'wat_rang', 'klong']) assert.equal(shopOn(alias, map), false);
  }
  assert.equal(shopOn('herbalist', 'paddy'), true, 'morning herb-gather seller has a real paddy site');
  assert.equal(shopOn('general', 'paddy'), false);
  for (const shop of ['unknown', '__proto__', 'constructor', 'toString', null, undefined, {}]) assert.equal(shopOn(shop, 'city'), false);
});

test('schedule sites are deduplicated while cross-map suppliers and refinement remain', () => {
  for (const [shop, sites] of Object.entries(SHOP_SITES)) {
    const unique = new Set(sites.map(s => JSON.stringify([s.npc, s.map, s.x, s.z])));
    assert.equal(unique.size, sites.length, shop);
  }
  assert.deepEqual(SHOP_SITES.herbalist.filter(s => s.npc === 'herbalist').map(s => s.map).sort(), ['city', 'paddy']);
  assert.equal(SHOP_SITES.general.length, 1);
  assert.equal(SHOP_SITES[REFINE_SHOP].length, 1);
  assert.equal(NPCS.filter(n => n.shopType === REFINE_SHOP).length, 1);
  for (const ore of Object.values(REFINE_ORE)) assert.ok(SHOPS[REFINE_SHOP].stock.includes(ore));
  for (const n of NPCS.filter(n => n.shopType && npcMap(n) !== 'city')) assert.ok(SHOP_SITES[n.shopType]?.some(s => s.npc === n.id));
});

test('service landmarks explicitly link their real counters without enabling future stock', () => {
  for (const [id, shop] of Object.entries({ forge: 'blacksmith', enhance: 'enhance', general: 'general', herbalist: 'herbalist', occult: 'occult', fish_market: 'fish' })) {
    const place = LANDMARKS.find(l => l.id === id);
    assert.equal(place.shopType, shop, id);
    assert.equal(nearShop(shop, 'city', place.x, place.z), true, `${id}: named counter is actually nearby`);
  }
  assert.equal(stockOf('fish').length, 0, 'an explicit landmark link does not create purchasable stock');
  assert.equal(LANDMARKS.find(l => l.id === 'market').shopType, undefined, 'the multi-stall market is a public district');
});

// The drawing-only canvas shim lets real building geometry/anchor code run in
// Node. It supplies no pixels and is not rendering or visual QA evidence.
const paint = { createLinearGradient: () => ({ addColorStop() {} }) };
for (const name of ['fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'arc', 'stroke']) paint[name] = () => {};
const previousDocument = globalThis.document;
let buildShops;
try {
  globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return { getContext: () => paint }; } };
  ({ buildShops } = await import('../src/world/districts/Shops.js'));
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}

function builtSpots() {
  const spots = {};
  buildShops({
    rng: createRng(20260), collision: { addBox() {} },
    place(group, x, z, rot = 0) {
      const c = Math.cos(rot), s = Math.sin(rot);
      return Object.fromEntries(Object.entries(group.userData.anchors ?? {}).map(([id, a]) => [id, { x: x + a.x * c + a.z * s, z: z - a.x * s + a.z * c, face: a.face + rot }]));
    },
    spot(id, x, z, face, link) { spots[id] = { x, z, face, link }; },
  });
  return spots;
}

test('actual shop builder anchors match server sites and reachable customer approaches', () => {
  const spots = builtSpots(), graph = NavGraph.fromRoads((x, z) => walkable(MAPS.city, x, z));
  const landmarks = landmarksOf('city', LANDMARKS);
  const directory = mapDirectory(MAPS.city, landmarks, MAPS.city.portals, spots);
  const publicDirectory = mapDirectory(MAPS.city, landmarks);
  for (const [id, s] of Object.entries(spots)) graph.add(id, s.x, s.z);
  for (const [id, s] of Object.entries(spots)) graph.connect(id, s.link);
  const counters = [
    ['blacksmith', 'forge_smith', 'forge_customer'], ['enhance', 'enhance_master', 'enh_front'],
    ['general', 'general_keeper', 'general_customer'], ['herbalist', 'herb_keeper', 'herb_customer'], ['occult', 'occult_keeper', 'occult_customer'],
  ];
  for (const [shop, keeper, approach] of counters) {
    assert.equal(SHOP_APPROACHES[shop], approach);
    const actual = spots[keeper], site = SPOT_SITES[keeper], customer = spots[approach];
    const entry = directory.find(e => e.shopType === shop), publicEntry = publicDirectory.find(e => e.id === entry?.id);
    assert.ok(entry && publicEntry, `${shop}: present in the public directory`);
    assert.deepEqual(entry.goal, customer, `${shop}: Walk uses the actual customer approach`);
    assert.deepEqual([entry.x, entry.z], [publicEntry.x, publicEntry.z], `${shop}: marker stays at its public location`);
    assert.equal(site[0], 'city');
    assert.ok(Math.hypot(actual.x - site[1], actual.z - site[2]) < 1e-9, keeper);
    assert.ok(navigation('city').canStand(customer.x, customer.z), approach);
    assert.ok(graph.findPath('port_c', approach), approach);
    assert.equal(nearShop(shop, 'city', customer.x, customer.z), true);
    const npc = NPCS.find(n => n.shopType === shop);
    assert.ok(Math.hypot(customer.x - actual.x, customer.z - actual.z) < (npc.interactionRadius ?? 3.6), `${shop}: player can talk from its approach`);
  }
  const fieldHerbalist = mapDirectory(MAPS.paddy, landmarksOf('paddy', LANDMARKS)).find(e => e.shopType === 'herbalist');
  assert.ok(fieldHerbalist);
  const fieldSite = SHOP_SITES.herbalist.find(s => s.map === 'paddy');
  assert.deepEqual([fieldHerbalist.goal.x, fieldHerbalist.goal.z], [fieldSite.x, fieldSite.z], 'maps without that customer spot retain the actual NPC site');
});
