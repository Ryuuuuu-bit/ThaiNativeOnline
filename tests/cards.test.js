// Monster cards (src/character/data/cards.js): drops, sockets, effects, server replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_ITEMS, CARD_RATE, RESIST_CAP, cardId, cardRate, RACE_LABELS, ELEMENT_LABELS } from '../src/character/data/cards.js';
import { ITEMS } from '../src/character/data/items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { Character } from '../src/character/Character.js';
import { MonsterWorld } from '../server/monsters.js';
import { Combatants, sane } from '../server/combatants.js';
import { applyOp, fromSave } from '../server/progress.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { fullKit } from '../src/character/data/skilltree.js';

const KEYS = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk', 'atk', 'matk', 'def', 'hp', 'mp', 'crit', 'critDmg', 'acc', 'eva', 'cdr', 'cast', 'mpCost']);
const hero = (classId = 'warrior', o = {}) => ({ ...Character.create('ทดสอบ', classId).toJSON(), jobLevel: 50, skills: fullKit(classId, KIT_SKILL_IDS[classId] ?? []), ...o });

test('every monster has a race, an element and its own card; card bonuses are known keys', () => {
  for (const [id, m] of Object.entries(MONSTERS)) {
    assert.ok(RACE_LABELS[m.race] && ELEMENT_LABELS[m.element], `${id} race/element`);
    assert.ok(ITEMS[cardId(id)]?.type === 'card', `${id} has a card`);
  }
  for (const [id, c] of Object.entries(CARD_ITEMS)) {
    assert.ok(['weapon', 'armor', 'head', 'offhand', 'cape', 'shoes', 'charm'].includes(c.slot), id);
    for (const k of Object.keys(c.bonus)) {
      const [kind, what] = k.split('_');
      assert.ok(KEYS.has(k) || (kind === 'vs' && RACE_LABELS[what]) || (kind === 'res' && (RACE_LABELS[what] || ELEMENT_LABELS[what])), `${id}: ${k}`);
    }
  }
  assert.equal(cardRate(MONSTERS.boar), CARD_RATE.normal); assert.equal(cardRate(MONSTERS.buffalo), CARD_RATE.elite); assert.equal(cardRate(MONSTERS.pusom), CARD_RATE.boss);
});

test('RO slots: a card goes into a free slot of gear of its kind, for good, and travels with the item', () => {
  const c = Character.create('ทดสอบ', 'warrior'), atk = c.patk;   // wood_sword [3] worn
  assert.equal(ITEMS[c.equipment.weapon].slots, 3); assert.equal(ITEMS.tiger_fang.slots, 0);
  for (const id of ['card_boar', 'card_boar', 'card_boar', 'card_boar', 'card_pop']) c.addItem(id);
  const boar = () => c.inventory.findIndex(s => s?.id === 'card_boar');
  assert.equal(c.useAt(boar()), false, 'clicking a card asks where it goes');
  assert.deepEqual(c.cardTargets(boar()).map(t => t.worn ? 'worn' : t.id), ['worn']);
  for (let i = 0; i < 3; i++) assert.equal(c.insertCard(boar(), 'worn'), true);
  assert.deepEqual(c.cards.weapon, ['card_boar', 'card_boar', 'card_boar']);
  assert.ok(c.patk >= atk + 12, 'three cards stack');
  assert.equal(c.insertCard(boar(), 'worn'), false, 'no free slot left');
  assert.deepEqual(c.cardTargets(c.inventory.findIndex(s => s?.id === 'card_pop')).map(t => t.id), ['cloth_vest'], 'an armor card only fits armor');
  assert.equal(c.insertCard(c.inventory.findIndex(s => s?.id === 'card_pop'), 'worn'), true); assert.deepEqual(c.cards.armor, ['card_pop']);
  // the cards leave with the sword and come back with it
  c.unequip('weapon');
  const sword = c.inventory.findIndex(s => s?.id === 'wood_sword');
  assert.deepEqual(c.inventory[sword].cards, ['card_boar', 'card_boar', 'card_boar']); assert.equal(c.equipBonus('atk'), 0);
  c.addItem('iron_dap'); c.equip(c.inventory.findIndex(s => s?.id === 'iron_dap'));
  assert.deepEqual(c.cards.weapon, [], 'a new sword has empty slots');
  assert.equal(c.insertCard(boar(), c.inventory.findIndex(s => s?.id === 'wood_sword')), false, 'that one is full');
  c.equip(c.inventory.findIndex(s => s?.id === 'wood_sword'));
  assert.deepEqual(c.cards.weapon, ['card_boar', 'card_boar', 'card_boar']);
  assert.ok(!c.inventory.find(s => s?.id === 'iron_dap').cards);
  // a card into gear in the bag
  assert.equal(c.insertCard(boar(), c.inventory.findIndex(s => s?.id === 'iron_dap')), true);
  assert.deepEqual(c.inventory.find(s => s?.id === 'iron_dap').cards, ['card_boar']);
  // saved and loaded; fake cards are dropped
  const back = new Character(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(back.cards.weapon, ['card_boar', 'card_boar', 'card_boar']);
  assert.deepEqual(back.inventory.find(s => s?.id === 'iron_dap').cards, ['card_boar']);
  const fake = new Character({ ...c.toJSON(), cards: { weapon: ['card_pop', 'card_boar', 'card_boar', 'card_boar', 'card_boar', 'potion_s'] } });
  assert.deepEqual(fake.cards.weapon, ['card_boar', 'card_boar', 'card_boar'], 'only its kind, no more than its slots');
});

test('race damage and resistances, capped', () => {
  const c = Character.create('ทดสอบ', 'hunter');
  Object.assign(c.equipment, { weapon: 'bamboo_bow', armor: 'cloth_vest' });
  c.cards.weapon = ['card_pray']; c.cards.armor = ['card_pop'];
  assert.equal(c.vsRace(MONSTERS.winyan), .1); assert.equal(c.vsRace(MONSTERS.boar), 0);
  assert.equal(c.resist(MONSTERS.winyan), .15);
  c.cards.armor = ['card_winyan']; assert.equal(c.resist(MONSTERS.winyan), .12, 'dark element');
  ITEMS.__test = { type: 'card', slot: 'charm', bonus: { res_dark: .4, res_spirit: .4 } }; c.equipment.charm = 'takrut'; c.cards.charm = ['__test'];
  assert.equal(c.resist(MONSTERS.winyan), RESIST_CAP); delete ITEMS.__test;
});

test('the server drops a card to the top damager and says so; the browser\'s socket survives the server\'s replay', () => {
  const w = new MonsterWorld('test', { zones: [{ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['day'] }], random: () => 0 });
  for (let t = 0; t < 3; t += .1) w.update(.1, [], 'day');
  const m = w.monsters[0], p = [{ id: 1, x: 1, z: 0, lv: 1 }, { id: 2, x: 1, z: 0, lv: 1 }];
  w.damage(m, 2, 10, {}, p);
  const kills = w.damage(m, 1, 1e6, {}, p).filter(e => e.t === 'kill');
  const top = kills.find(k => k.to === 1), other = kills.find(k => k.to === 2);
  assert.equal(top.card, 'card_boar'); assert.ok(top.drops.some(d => d.id === 'card_boar'));
  assert.ok(!other?.card);
  // replayed: a card into worn or bag gear; gear is named with its cards
  const c = fromSave(hero('warrior')); c.addItem('card_boar'); c.addItem('card_boar'); c.addItem('wood_sword');
  assert.equal(applyOp(c, { op: 'card', id: 'card_boar', worn: 1 }), true); assert.deepEqual(c.cards.weapon, ['card_boar']);
  assert.equal(applyOp(c, { op: 'card', id: 'card_boar', item: 'wood_sword', has: ['card_pop'] }), false, 'no such sword');
  assert.equal(applyOp(c, { op: 'card', id: 'card_boar', item: 'wood_sword', has: [] }), true);
  assert.equal(applyOp(c, { op: 'card', id: 'card_boar', worn: 1 }), false, 'no card left');
  c.unequip('weapon');
  assert.equal(applyOp(c, { op: 'equip', id: 'wood_sword', cards: ['card_boar'] }), true);
  assert.deepEqual(c.cards.weapon, ['card_boar']);
  assert.equal(applyOp(c, { op: 'sell', id: 'wood_sword', cards: ['card_boar', 'card_boar'] }), false, 'not that one');
  assert.equal(applyOp(c, { op: 'sell', id: 'wood_sword', cards: ['card_boar'] }), true);
});

test('server rolls: cards add damage against a race and take it off monster swings', () => {
  const cs = new Combatants({ now: () => 0, random: () => .5 });
  cs.load(1, hero('warrior', { cards: { weapon: ['card_pray'], armor: ['card_pop'] } }), { account: 'a', slot: 0 });
  cs.load(2, hero('warrior'), { account: 'b', slot: 0 });
  const w = new MonsterWorld('test', { zones: [{ type: 'winyan', x: 0, z: 0, radius: 0, count: 1, active: ['day'] }], random: () => .5 });
  for (let t = 0; t < 3; t += .1) w.update(.1, [], 'day');
  const m = w.monsters[0]; m.maxHp = m.hp = 1e6;
  const players = [{ id: 1, x: 1, z: 0 }, { id: 2, x: 1, z: 0 }];
  const a = cs.land(w, players, m, 1, { hit: true, dmg: 100 }, false)[0].amount, b = cs.land(w, players, m, 2, { hit: true, dmg: 100 }, false)[0].amount;
  assert.deepEqual([a, b], [110, 100]);
  const def = { ...MONSTERS.winyan, acc: 1e9 };
  const hurt1 = cs.swing(1, def, 1).dmg, hurt2 = cs.swing(2, def, 1).dmg;
  assert.ok(hurt1 < hurt2, `resisted (${hurt1} < ${hurt2})`);
  assert.deepEqual(sane({ level: 5, equipment: { weapon: 'wood_sword', armor: 'cloth_vest' }, cards: { weapon: ['card_pray'], armor: ['card_pray'] } }, 'warrior').cards, { weapon: ['card_pray'], armor: [], head: [], offhand: [], cape: [], shoes: [], charm: [], charm2: [] }, 'a guest sheet is checked too');
});

test('eight equipment slots: head, off hand, cape, shoes and two charms', async () => {
  const { EQUIP_SLOTS } = await import('../src/character/data/items.js');
  const c = Character.create('ทดสอบ', 'muaythai');
  assert.deepEqual(Object.keys(c.equipment), EQUIP_SLOTS);
  const def = c.defense;
  for (const id of ['pha_khao', 'rattan_shield', 'pakhaoma', 'sandals']) { c.addItem(id); c.useAt(c.inventory.findIndex(s => s?.id === id)); }
  assert.deepEqual([c.equipment.head, c.equipment.offhand, c.equipment.cape, c.equipment.shoes], ['pha_khao', 'rattan_shield', 'pakhaoma', 'sandals']);
  assert.ok(c.defense > def);
  // two charms side by side; a third replaces the first
  for (const id of ['takrut', 'tiger_fang', 'mongkol']) c.addItem(id);
  const charmsWorn = () => [c.equipment.charm, c.equipment.charm2];
  c.equip(c.inventory.findIndex(s => s?.id === 'takrut'));
  c.equip(c.inventory.findIndex(s => s?.id === 'tiger_fang'));
  assert.ok(charmsWorn().includes('takrut') && charmsWorn().includes('tiger_fang'));
  // a charm card goes into either charm
  c.addItem('card_pret');
  const t = c.cardTargets(c.inventory.findIndex(s => s?.id === 'card_pret'));
  assert.ok(t.some(x => x.slot === 'charm' || x.slot === 'charm2'));
  assert.equal(c.insertCard(c.inventory.findIndex(s => s?.id === 'card_pret'), t[0].slot), true);
  assert.equal(c.equipBonus('mp'), 50 + 0, 'the pret card counts in a charm slot');
  // replayed on the server, and kept by a sheet check
  const s = fromSave(c.toJSON());
  assert.deepEqual(s.equipment, c.equipment); assert.deepEqual(s.cards, c.cards);
  assert.equal(applyOp(s, { op: 'unequip', slot: 'shoes' }), true);
  assert.equal(sane({ level: 5, equipment: { head: 'sandals', shoes: 'sandals', charm2: 'takrut' } }, 'warrior').equipment.head, null, 'shoes are not a hat');
});

test('หมออาคม takes the cards out, RO style: a price, and a chance that the item or the cards break', async () => {
  const { STRIP } = await import('../src/character/data/cards.js');
  const setup = () => {
    const c = Character.create('ทดสอบ', 'warrior'); c.gold = 1000;
    c.addItem('ash', 5); c.addItem('card_boar'); c.addItem('card_headless'); c.addItem('iron_dap');
    const sword = () => c.inventory.findIndex(s => s?.id === 'iron_dap');
    c.insertCard(c.inventory.findIndex(s => s?.id === 'card_boar'), sword());
    c.insertCard(c.inventory.findIndex(s => s?.id === 'card_headless'), sword());
    return { c, sword };
  };
  let { c, sword } = setup();
  assert.deepEqual(c.stripCost(sword()), { n: 2, gold: 2 * STRIP.gold, ash: 2 * STRIP.ash });
  let r = c.stripCards(sword(), () => .5);
  assert.deepEqual([r.outcome, c.gold, c.count('ash'), c.count('card_boar'), c.count('card_headless')], ['ok', 1000 - 2 * STRIP.gold, 3, 1, 1]);
  assert.ok(!c.inventory[sword()].cards, 'the sword is bare again');
  ({ c, sword } = setup());
  r = c.stripCards(sword(), () => STRIP.ok + .01);
  assert.equal(r.outcome, 'item_broke'); assert.equal(sword(), -1); assert.equal(c.count('card_boar'), 1);
  ({ c, sword } = setup());
  r = c.stripCards(sword(), () => .999);
  assert.equal(r.outcome, 'cards_broke'); assert.ok(sword() >= 0); assert.equal(c.count('card_boar'), 0);
  ({ c, sword } = setup()); c.gold = 10;
  assert.deepEqual(c.stripCards(sword()), { ok: false, why: 'gold' });
  // online: only at หมออาคม's, rolled by the server
  const cs = new Combatants({ now: () => 100, random: () => .1 });
  cs.load(1, { ...setup().c.toJSON(), jobLevel: 50 }, { account: 'a', slot: 0 });
  const msg = { op: 'strip', id: 'iron_dap', cards: ['card_boar', 'card_headless'] };
  const { shopSpot } = await import('../src/data/shopSites.js'), occult = shopSpot('occult');
  assert.equal(cs.op(1, msg, { map: 'paddy', x: occult.x, z: occult.z }), false); assert.equal(cs.get(1).stripped.why, 'no_shop');
  assert.equal(cs.op(1, msg, { map: 'city', x: occult.x + 30, z: occult.z }), false, 'too far from the shop');
  assert.equal(cs.op(1, msg, { map: 'city', x: occult.x + 3, z: occult.z }), true); assert.equal(cs.get(1).stripped.outcome, 'ok');
  assert.equal(cs.get(1).c.count('card_boar'), 1);
});
