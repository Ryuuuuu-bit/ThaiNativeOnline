import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character, STARTER_VERSION } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { ITEMS } from '../src/character/data/items.js';
import { cleanCardBook } from '../src/character/cardCollection.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { Combatants, sane } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { fromSave, reconcileSave } from '../server/progress.js';
import { swap } from '../server/trades.js';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';

const hero = options => new Character({ name: 'BookHero', classId: 'warrior', level: 100, starterEquipmentVersion: STARTER_VERSION, ...options });
const book = (...ids) => Object.fromEntries(ids.map(id => [id, true]));
const save = c => ({ 'tno.character.v1': JSON.stringify(c) });
const fullBag = () => Array.from({ length: 24 }, () => ({ id: 'potion_s', qty: 1 }));
class Net extends Emitter {
  constructor() { super(); this.online = true; this.sent = []; }
  send(message) { this.sent.push(message); }
}

test('collecting and repeating a card records one discovery without consuming it or granting stats', () => {
  const c = hero(), stats = c.derived, gold = c.gold;
  assert.deepEqual(c.cardBook, {});
  let observed;
  c.on('inventory', () => { observed = { ...c.cardBook }; });
  assert.equal(c.addItem('card_boar', 2), true);
  assert.equal(c.addItem('card_boar'), true);
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.deepEqual(observed, book('card_boar'), 'inventory listeners see discoveries immediately');
  assert.equal(c.count('card_boar'), 3);
  assert.deepEqual(c.derived, stats);
  assert.equal(c.gold, gold);
});

test('full or overweight bags and unknown items cannot create a discovery', () => {
  const full = hero({ inventory: fullBag() });
  assert.equal(full.addItem('card_headless'), false);
  assert.equal(full.addInstance({ id: 'wood_sword', qty: 1, cards: ['card_boar'] }), false);
  assert.deepEqual(full.cardBook, {});
  const heavy = hero({ inventory: [{ id: 'card_boar', qty: Math.ceil(hero().maxWeight / ITEMS.card_boar.weight) + 1 }] });
  assert.equal(heavy.addItem('card_krasue'), false);
  assert.equal(heavy.addItem('card_not_a_monster'), false);
  assert.deepEqual(heavy.cardBook, book('card_boar'));
});

test('invalid quantities and overweight card batches fail without partial acquisition or discovery', () => {
  const c = hero({ inventory: [{ id: 'card_boar', qty: hero().maxWeight - 1 }] });
  assert.equal(c.carryRoom('card_headless'), 1);
  assert.equal(c.addItem('card_headless', 2), false);
  assert.equal(c.count('card_headless'), 0);
  for (const qty of [0, -1, .5, NaN, Infinity]) assert.equal(c.addItem('card_headless', qty), false);
  assert.deepEqual(c.cardBook, book('card_boar'));
});

test('a card can join an existing stack in a full bag and locked card acquisitions also record', () => {
  const inventory = fullBag(); inventory[0] = { id: 'card_boar', qty: 1 };
  const c = hero({ inventory });
  assert.equal(c.addItem('card_boar'), true);
  assert.equal(c.count('card_boar'), 2);
  assert.deepEqual(c.cardBook, book('card_boar'));
  const locked = hero();
  assert.equal(locked.addInstance({ id: 'card_headless', qty: 1, locked: true }), true);
  assert.deepEqual(locked.cardBook, book('card_headless'));
  assert.equal(locked.inventory[0].locked, true);
});

test('legacy bags and worn sockets reconstruct only real owned cards after normalization', () => {
  const c = hero({
    inventory: [
      { id: 'card_boar', qty: 2 },
      { id: 'card_krasue', qty: 0 },
      { id: 'wood_sword', qty: 1, cards: ['card_headless', 'card_pop', 'potion_s', 'card_fake'] },
    ],
    equipment: { weapon: 'wood_sword', armor: 'cloth_vest' },
    cards: { weapon: ['card_tiger', 'card_pop'], armor: ['card_pop'], head: ['card_khamot'] },
  });
  assert.deepEqual(c.cardBook, book('card_boar', 'card_headless', 'card_tiger', 'card_pop'));
  assert.equal(c.cardBookMigrated, true);
  assert.deepEqual(c.inventory[2].cards, ['card_headless']);
  assert.deepEqual(c.cards.weapon, ['card_tiger']);
});

test('socket, sale, loss and reload retain historical discoveries without additional rewards', () => {
  const c = Character.create('BookHero', 'warrior');
  c.addItem('card_boar');
  assert.equal(c.insertCard(c.inventory.findIndex(s => s?.id === 'card_boar'), 'weapon'), true);
  assert.equal(c.count('card_boar'), 0);
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.equal(c.unequip('weapon'), true);
  assert.ok(c.sellAt(c.inventory.findIndex(s => s?.id === 'wood_sword')) > 0);
  c.addItem('card_headless'); c.removeAt(c.inventory.findIndex(s => s?.id === 'card_headless'));
  assert.deepEqual(c.cardBook, book('card_boar', 'card_headless'));
  const loaded = fromSave(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(loaded.cardBook, c.cardBook);
  assert.equal(loaded.count('card_boar'), 0);
  assert.equal(loaded.count('card_headless'), 0);
  assert.deepEqual(loaded.cards.weapon, []);
  assert.equal(loaded.cardBookMigrated, false);
});

test('socketed gear acquired by a real trade records the recipient and never erases the giver', () => {
  const giver = hero(), recipient = hero();
  giver.addInstance({ id: 'wood_sword', qty: 1, cards: ['card_headless', 'card_boar'], plus: 4 });
  const offered = { items: [{ id: 'wood_sword', qty: 1, cards: ['card_headless', 'card_boar'], plus: 4 }], gold: 0 };
  assert.deepEqual(swap(giver, recipient, offered, { items: [], gold: 0 }), { ok: true });
  assert.deepEqual(recipient.cardBook, book('card_headless', 'card_boar'));
  assert.deepEqual(giver.cardBook, recipient.cardBook);
  assert.deepEqual(recipient.inventory.find(s => s?.id === 'wood_sword').cards, ['card_headless', 'card_boar']);
  assert.equal(giver.count('wood_sword'), 0);
});

test('a rejected trade does not unlock offered socketed cards for the recipient', () => {
  const giver = hero(), recipient = hero({ inventory: fullBag() });
  giver.addInstance({ id: 'wood_sword', qty: 1, cards: ['card_headless'] });
  const result = swap(giver, recipient, { items: [{ id: 'wood_sword', qty: 1, cards: ['card_headless'] }], gold: 0 }, { items: [], gold: 0 });
  assert.equal(result.ok, false);
  assert.deepEqual(recipient.cardBook, {});
  assert.equal(giver.count('wood_sword'), 1);
});

test('authoritative inventory replacements record loose cards and socketed gear before save', () => {
  const c = hero();
  c.inventory = [{ id: 'card_boar', qty: 1 }, { id: 'wood_sword', qty: 1, cards: ['card_headless'] }];
  c.emit('inventory');
  assert.deepEqual(c.cardBook, book('card_boar', 'card_headless'));
  assert.deepEqual(fromSave(c.toJSON()).cardBook, c.cardBook);
});

test('only known true-valued own keys persist, and serialized maps do not alias the live book', () => {
  const raw = Object.assign(Object.create({ card_pusom: true }), { card_boar: true, card_headless: 1, card_fake: true, potion_s: true });
  const c = hero({ cardBook: raw });
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.deepEqual(cleanCardBook(['card_boar']), {});
  assert.deepEqual(cleanCardBook(null), {});
  const serialized = c.toJSON(); serialized.cardBook.card_pusom = true;
  raw.card_krasue = true;
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.equal('cardBookMigrated' in serialized, false);
});

test('legacy discovery marks the authoritative entry dirty and forged character sheets cannot replace it', () => {
  const legacy = hero({ inventory: [{ id: 'card_boar', qty: 1 }] }).toJSON(); delete legacy.cardBook;
  const cs = new Combatants();
  assert.equal(cs.load(1, legacy, { account: 'bookowner', slot: 0 }), true);
  assert.equal(cs.get(1).dirty, true);
  assert.deepEqual(cs.me(1).cardBook, book('card_boar'));
  assert.equal(cs.set(1, { ...legacy, cardBook: book('card_pusom'), inventory: [{ id: 'card_pusom', qty: 1 }] }), false);
  assert.deepEqual(cs.me(1).cardBook, book('card_boar'));
  const guest = sane({ ...hero().toJSON(), cardBook: book('card_pusom'), inventory: [{ id: 'card_pusom', qty: 1 }] });
  assert.deepEqual(guest.cardBook, {}, 'guest sheets do not import claimed history or bag items');
});

test('an actual monster card drop records only when the server accepts it into the bag', () => {
  const world = new MonsterWorld('test', { zones: [{ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['day'] }], random: () => 0 });
  for (let t = 0; t < 3; t += .1) world.update(.1, [], 'day');
  const monster = world.monsters[0], players = [{ id: 1, x: 1, z: 0, lv: 100 }];
  const kill = world.damage(monster, 1, 1e6, {}, players).find(e => e.t === 'kill');
  assert.equal(kill.card, 'card_boar');
  const cs = new Combatants(); cs.load(1, hero().toJSON(), { account: 'bookowner', slot: 0 });
  cs.reward(1, kill);
  assert.deepEqual(cs.me(1).cardBook, book('card_boar'));
  assert.equal(cs.get(1).c.count('card_boar'), 1);
  cs.load(2, hero({ inventory: fullBag() }).toJSON(), { account: 'other', slot: 0 });
  const failed = cs.reward(2, { ...kill, drops: [{ id: 'card_boar', qty: 1 }] });
  assert.deepEqual(failed.lost, [{ id: 'card_boar', qty: 1 }]);
  assert.deepEqual(cs.me(2).cardBook, {});
});

test('save reconciliation ignores forged history and retains genuine discoveries already sold', async () => {
  const store = new MemoryStore(); await store.createAccount('bookowner', 'salt', 'hash');
  const accounts = new Accounts(store), forged = hero({ cardBook: book('card_pusom'), inventory: [{ id: 'card_pusom', qty: 1 }] });
  assert.equal((await accounts.save('bookowner', 0, save(forged))).ok, true);
  let persisted = JSON.parse((await store.listSlots('bookowner'))[0].data['tno.character.v1']);
  assert.deepEqual(persisted.cardBook, {}, 'new signed-in slots cannot import offline/client discoveries');
  const genuine = fromSave(persisted); genuine.addItem('card_boar'); genuine.sellAt(genuine.inventory.findIndex(s => s?.id === 'card_boar'));
  assert.equal(await accounts.putCharacter('bookowner', 0, genuine.toJSON()), true);
  assert.equal((await accounts.save('bookowner', 0, save(forged))).ok, true);
  persisted = JSON.parse((await store.listSlots('bookowner'))[0].data['tno.character.v1']);
  assert.deepEqual(persisted.cardBook, book('card_boar'));
  assert.deepEqual(fromSave(persisted).cardBook, book('card_boar'));
  assert.deepEqual(JSON.parse(reconcileSave(save(forged), genuine.toJSON())['tno.character.v1']).cardBook, book('card_boar'));
});

test('accepted online sync replaces local claims and keeps the server history even without held cards', () => {
  const c = hero({ cardBook: book('card_pusom') }), server = hero({ cardBook: book('card_boar') }), net = new Net();
  c.save = () => {};
  attachNetProgress(net, c);
  net.emit('sync', { c: { ...server.toJSON(), ack: 0 } });
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.equal(c.count('card_boar'), 0);
  c.cardBook.card_krasue = true;
  net.emit('sync', { c: { ...server.toJSON(), ack: 0 } });
  assert.deepEqual(c.cardBook, book('card_boar'));
  assert.deepEqual(net.sent, [], 'collection has no client discovery/unlock operation');
});

test('stale sync cannot overwrite discoveries; a later authoritative snapshot can', () => {
  const c = hero(), net = new Net(), server = hero({ points: 1, cardBook: book('card_boar') });
  c.save = () => {}; attachNetProgress(net, c);
  net.emit('sync', { c: { ...server.toJSON(), ack: 0 } });
  assert.equal(c.allocate('str'), true);
  net.emit('sync', { c: { ...hero({ cardBook: book('card_pusom') }).toJSON(), ack: 0 } });
  assert.deepEqual(c.cardBook, book('card_boar'));
  net.emit('sync', { c: { ...hero({ cardBook: book('card_boar', 'card_headless') }).toJSON(), ack: 1 } });
  assert.deepEqual(c.cardBook, book('card_boar', 'card_headless'));
});

test('a legacy server snapshot reconstructs authoritative holdings without merging local history', () => {
  const c = hero({ cardBook: book('card_pusom') }), net = new Net(); c.save = () => {};
  attachNetProgress(net, c);
  const snapshot = hero({ inventory: [{ id: 'card_boar', qty: 1 }], equipment: { weapon: 'wood_sword' }, cards: { weapon: ['card_headless'] } }).toJSON();
  delete snapshot.cardBook;
  net.emit('sync', { c: { ...snapshot, ack: 0 } });
  assert.deepEqual(c.cardBook, book('card_boar', 'card_headless'));
});
