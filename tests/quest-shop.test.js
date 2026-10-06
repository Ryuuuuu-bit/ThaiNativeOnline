// Quest and shop logic against the real Character, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { ITEMS } from '../src/character/data/items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { QUESTS } from '../src/data/quests.js';
import { SHOPS } from '../src/data/shops.js';
import { NPCS } from '../src/data/npcs.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';
import { buy, sell, sellPrice, stockOf } from '../src/shop/ShopSystem.js';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const hero = (opts = {}) => new Character({ name: 'ทดสอบ', classId: 'warrior', ...opts });
// The live quest list is small (the game is one safe city); kill and collect
// mechanics are checked on fixture quests chained after the real first quest.
const FIXTURE = [...QUESTS,
  { id: 'smith_boars', title: 'test', giver: 'blacksmith', requires: ['first_steps'], offer: '', done: '', objectives: [{ kill: 'boar', count: 4 }], rewards: { gold: 60 } },
  { id: 'herbal_ash', title: 'test', giver: 'herbalist', requires: ['first_steps'], offer: '', done: '', objectives: [{ collect: 'ash', count: 3 }], rewards: { gold: 50 } },
];

test('quest data references known NPCs, landmarks, monsters, items and quests', () => {
  const npc = new Set(NPCS.map(n => n.id)), place = new Set(LANDMARKS.map(l => l.id)), quest = new Set(QUESTS.map(q => q.id));
  assert.equal(quest.size, QUESTS.length, 'duplicate quest id');
  for (const q of QUESTS) {
    assert.ok(npc.has(q.giver), `${q.id}: unknown giver ${q.giver}`);
    if (q.turnIn) assert.ok(npc.has(q.turnIn), `${q.id}: unknown turnIn ${q.turnIn}`);
    for (const r of q.requires ?? []) assert.ok(quest.has(r), `${q.id}: unknown requirement ${r}`);
    for (const o of q.objectives) {
      if (o.discover) assert.ok(place.has(o.discover), `${q.id}: unknown landmark ${o.discover}`);
      if (o.kill) assert.ok(MONSTERS[o.kill], `${q.id}: unknown monster ${o.kill}`);
      if (o.collect) assert.ok(ITEMS[o.collect], `${q.id}: unknown item ${o.collect}`);
      if (o.talk) assert.ok(npc.has(o.talk), `${q.id}: unknown NPC ${o.talk}`);
    }
    for (const [id] of q.rewards?.items ?? []) assert.ok(ITEMS[id], `${q.id}: unknown reward ${id}`);
  }
});

test('shop stock only lists known items and every vendor shop is used by an NPC', () => {
  for (const [type, shop] of Object.entries(SHOPS)) for (const id of shop.stock ?? []) assert.ok(ITEMS[id], `${type}: unknown item ${id}`);
  for (const n of NPCS) if (n.shopType) assert.ok(SHOPS[n.shopType], `${n.id}: unknown shop ${n.shopType}`);
});

test('a quest goes from offer to hand-in and pays its rewards', () => {
  const found = new Set();
  const qs = new QuestSystem(FIXTURE, { isDiscovered: id => found.has(id), storage: memoryStorage() });
  const c = hero(), combat = new Emitter();
  qs.attach(c, combat);
  assert.equal(qs.marker('guard_port'), '!');
  assert.equal(qs.offers('blacksmith').length, 0, 'smith_boars needs first_steps first');
  assert.ok(qs.accept('first_steps'));
  assert.equal(qs.marker('guard_center'), '…');
  found.add('market'); found.add('city_pillar');
  assert.equal(qs.marker('guard_center'), '?');
  const gold = c.gold, potions = c.count('potion_s');
  assert.ok(qs.complete('first_steps'));
  assert.equal(c.gold, gold + 30);
  assert.equal(c.count('potion_s'), potions + 3);
  assert.ok(c.exp > 0 || c.level > 1);
  assert.equal(qs.marker('blacksmith'), '!');

  assert.ok(qs.accept('smith_boars'));
  for (let i = 0; i < 3; i++) combat.emit('kill', { monster: { type: 'boar' } });
  combat.emit('kill', { monster: { type: 'monkey' } });
  assert.equal(qs.isComplete('smith_boars'), false);
  combat.emit('kill', { monster: { type: 'boar' } });
  assert.ok(qs.complete('smith_boars'));
  assert.equal(qs.complete('smith_boars'), false, 'cannot hand in twice');
});

test('collect quests take the items on hand-in and progress survives a reload', () => {
  const storage = memoryStorage();
  const qs = new QuestSystem(FIXTURE, { storage });
  const c = hero();
  qs.attach(c, null);
  qs.state.first_steps = { status: 'done', kills: {}, talked: [] };
  assert.ok(qs.accept('herbal_ash'));
  c.addItem('ash', 2);
  assert.equal(qs.complete('herbal_ash'), false);
  c.addItem('ash', 2);
  const again = new QuestSystem(FIXTURE, { storage });
  again.attach(c, null);
  assert.equal(again.status('herbal_ash'), 'active');
  assert.ok(again.complete('herbal_ash'));
  assert.equal(c.count('ash'), 1);
});

test('shops sell their stock for gold and buy items back at half price', () => {
  const c = hero({ gold: 25 });
  assert.equal(buy(c, 'general', 'tiger_fang').ok, false, 'not in stock');
  assert.ok(stockOf('general').includes('potion_s'));
  assert.ok(buy(c, 'general', 'potion_s').ok);
  assert.equal(c.gold, 25 - ITEMS.potion_s.price);
  assert.equal(c.count('potion_s'), 1);
  assert.equal(buy(c, 'general', 'potion_m').ok, false, 'not enough gold');
  const index = c.inventory.findIndex(s => s?.id === 'potion_s'), before = c.gold;
  const sold = sell(c, index);
  assert.ok(sold.ok);
  assert.equal(sold.gold, sellPrice('potion_s'));
  assert.equal(c.gold, before + sellPrice('potion_s'));
  assert.equal(c.count('potion_s'), 0);
  assert.equal(sell(c, index).ok, false);
});
