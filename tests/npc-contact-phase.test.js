import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactActivityFor, contactSitesFor } from '../src/data/npcContact.js';
import { nearShop, nearNpc, nearAnyShop, shopSpot, SHOP_SITES } from '../src/data/shopSites.js';
import { CLASS_MASTER_SITES, nearQuestNpc, applyQuestOp } from '../server/class-quests.js';
import { applyOp } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';
import { Character } from '../src/character/Character.js';
import { createFlask } from '../src/character/data/flasks.js';

const herbalTown = SHOP_SITES.herbalist.find(s => s.npc === 'herbalist' && s.map === 'city');
const herbalField = SHOP_SITES.herbalist.find(s => s.npc === 'herbalist' && s.map === 'paddy');
const near = (fn, id, site, phase) => fn(id, site.map, site.x, site.z, phase);

test('city shops close at home; all their legacy counter IDs also close', () => {
  for (const id of ['general', 'blacksmith', 'weapons', 'armor', 'enhance', 'supplies', 'fish']) {
    const site = shopSpot(id);
    assert.ok(near(nearShop, id, site, 'day'), id);
    assert.equal(near(nearShop, id, site, 'night'), false, id);
    assert.equal(near(nearNpc, site.npc, site, 'night'), false, site.npc);
  }
  const general = shopSpot('general');
  assert.equal(nearAnyShop(general.map, general.x, general.z, 'night'), false);
  assert.equal(nearAnyShop(general.map, general.x, general.z, 'day'), true);
});

test('travelling herbalist authorizes only the current phase and map', () => {
  assert.equal(near(nearShop, 'herbalist', herbalTown, 'morning'), false);
  assert.equal(near(nearShop, 'herbalist', herbalField, 'morning'), true);
  assert.equal(near(nearNpc, 'herbalist', herbalTown, 'morning'), false);
  assert.equal(near(nearNpc, 'herbalist', herbalField, 'morning'), true);
  for (const phase of ['day', 'evening']) {
    assert.equal(near(nearShop, 'herbalist', herbalTown, phase), true);
    assert.equal(near(nearShop, 'herbalist', herbalField, phase), false);
  }
  assert.equal(near(nearShop, 'herbalist', herbalTown, 'night'), false);
  assert.equal(near(nearShop, 'herbalist', herbalField, 'night'), false);
});

test('all-night suppliers, occult counter and warp keepers stay available', () => {
  for (const site of SHOP_SITES.herbalist.filter(s => s.npc !== 'herbalist')) {
    assert.equal(near(nearShop, 'herbalist', site, 'night'), true, site.npc);
  }
  for (const id of ['marsh', 'occult', 'charms', ...Object.keys(SHOP_SITES).filter(id => id.startsWith('supplies_'))]) {
    assert.equal(near(nearShop, id, shopSpot(id), 'night'), true, id);
  }
  assert.equal(nearNpc('warp_city_market', 'city', 17, 42, 'night'), true);
});

test('explicit invalid phases, prototype IDs and non-numeric positions fail closed', () => {
  const at = shopSpot('general');
  for (const phase of ['__proto__', 'constructor', 'toString', 'home', '', null, {}, 0]) {
    assert.equal(near(nearShop, 'general', at, phase), false);
    assert.equal(near(nearNpc, at.npc, at, phase), false);
    assert.equal(nearAnyShop(at.map, at.x, at.z, phase), false);
  }
  for (const id of ['__proto__', 'constructor', 'toString', 'missing', null, {}]) {
    assert.equal(near(nearShop, id, at, 'day'), false);
    assert.equal(near(nearNpc, id, at, 'day'), false);
  }
  for (const x of [String(at.x), NaN, Infinity, null]) {
    assert.equal(nearShop('general', at.map, x, at.z, 'day'), false);
  }
  assert.equal(near(nearShop, 'general', at), true, 'omitted phase remains daytime compatibility');
});

test('route contact uses current string/object stops without unioning old phases', () => {
  const spots = { a: ['paddy', 10, -140], b: ['paddy', 40, -150], old: ['city', 60, 60] };
  const def = { map: 'paddy', schedule: {
    morning: { do: 'stay', at: 'old' },
    day: { do: 'route', stops: ['a', { at: 'b' }, { at: { x: 20, z: -160 } }, 'a', { at: 'missing' }] },
    night: { do: 'home', at: 'old', stops: ['a'] },
  } };
  assert.deepEqual(contactSitesFor(def, 'day', spots), [
    { map: 'paddy', x: 10, z: -140 }, { map: 'paddy', x: 40, z: -150 }, { map: 'paddy', x: 20, z: -160 },
  ]);
  assert.deepEqual(contactSitesFor(def, 'night', spots), []);
  assert.deepEqual(contactSitesFor(def, 'morning', spots), [{ map: 'city', x: 60, z: 60 }]);
});

test('missing phases follow day while missing/invalid outdoor anchors do not authorize', () => {
  const spots = Object.create({ inherited: ['city', 0, 0] });
  spots.here = ['city', 2, 3];
  const def = { schedule: { day: { do: 'stay', at: 'here' } } };
  assert.deepEqual(contactSitesFor(def, 'night', spots), [{ map: 'city', x: 2, z: 3 }]);
  assert.deepEqual(contactSitesFor({ schedule: { day: { do: 'stay', at: 'inherited' } } }, 'day', spots), []);
  assert.deepEqual(contactSitesFor({ schedule: { day: { do: 'stay', at: { x: NaN, z: 0 } } } }, 'day', spots), []);
  assert.equal(contactActivityFor({ schedule: {} }, 'day'), null);
  assert.equal(contactActivityFor({ schedule: { day: { do: 'route', stops: [] } } }, 'day'), null);
});

test('class masters keep their exact hall sites and obey individual night schedules', () => {
  for (const [id, site] of Object.entries(CLASS_MASTER_SITES)) {
    assert.equal(nearQuestNpc(id, { ...site, phase: 'day' }), true, id);
    assert.equal(nearQuestNpc(id, { ...site, phase: 'night' }), ['master_shaman', 'master_bandit'].includes(id), id);
    assert.equal(nearQuestNpc(id, { ...site, map: 'paddy', phase: 'day' }), false);
    assert.equal(nearQuestNpc(id, { ...site, phase: '__proto__' }), false);
  }
});

test('quest accept/turn-in/talk trust here.phase and ignore client phase spoofing', () => {
  const c = { alive: true }, touched = [];
  const quests = {
    character: c, defs: new Map([['proof', { id: 'proof', giver: 'general_merchant' }]]),
    turnInOf: q => q.giver,
    accept: id => { touched.push(['accept', id]); return true; },
    complete: id => { touched.push(['complete', id]); return true; },
    onTalk: id => touched.push(['talk', id]),
  };
  for (const op of ['quest_accept', 'quest_complete', 'talk']) {
    const msg = { op, id: 'proof', npc: 'general_merchant', phase: 'day' };
    const here = { ...shopSpot('general'), phase: 'night' };
    assert.equal(applyQuestOp(c, msg, quests, here), false);
    assert.equal(applyOp(c, msg, quests, here), false);
    assert.equal(touched.length, 0);
    assert.equal(applyQuestOp(c, { ...msg, phase: 'night' }, quests, { ...here, phase: 'day' }), true);
    touched.length = 0;
  }
});

const serverHero = () => {
  const cs = new Combatants({ now: () => 100, random: () => 0 });
  const c = new Character({ name: 'PhaseContactQA', classId: 'warrior', level: 20, jobLevel: 50, gold: 100000, inventory: Array(60).fill(null) });
  cs.load('p', c.toJSON(), { account: 'fixture', slot: 0 });
  return { cs, c: cs.get('p').c };
};

test('real server shop operations reject client phase overrides without spending or selling', () => {
  const { cs, c } = serverHero(), site = shopSpot('general');
  const buy = { op: 'buy', shop: 'general', id: 'potion_s', phase: 'day' };
  const before = JSON.stringify(c.toJSON());
  assert.equal(cs.op('p', buy, { ...site, phase: 'night' }), false);
  assert.equal(JSON.stringify(c.toJSON()), before);
  assert.equal(cs.op('p', { ...buy, phase: 'night' }, { ...site, phase: 'day' }), true);
  const sell = { op: 'sell', id: 'potion_s', phase: 'day' }, bought = JSON.stringify(c.toJSON());
  assert.equal(cs.op('p', sell, { ...site, phase: 'night' }), false);
  assert.equal(JSON.stringify(c.toJSON()), bought);
  assert.equal(cs.op('p', sell, { ...site, phase: 'day' }), true);
});

test('real town flask refill requires the city herbalist current outdoor phase', () => {
  const { cs, c } = serverHero();
  c.flasks.hp = createFlask('flask_hp_1'); c.flasks.hp.flask.charges = 0;
  for (const phase of ['morning', 'night']) {
    assert.equal(cs.op('p', { op: 'flask_refill', phase: 'day' }, { ...herbalTown, phase }), false);
    assert.equal(c.flasks.hp.flask.charges, 0);
  }
  assert.equal(cs.op('p', { op: 'flask_refill' }, { ...herbalField, phase: 'morning' }), false, 'field purchases do not become city refill');
  assert.equal(cs.op('p', { op: 'flask_refill', phase: 'night' }, { ...herbalTown, phase: 'day' }), true);
  assert.equal(c.flasks.hp.flask.charges, 40);
});

test('real refinement closes at night but all-night card-removal service stays open', () => {
  const { cs, c } = serverHero();
  c.addItem('iron_dap'); c.addItem('sacred_ore', 20);
  let gear = c.inventory.find(s => s?.id === 'iron_dap');
  const refine = { op: 'refine', id: gear.id, iid: gear.roll?.iid, phase: 'day' };
  const before = JSON.stringify(c.toJSON());
  assert.equal(cs.op('p', refine, { ...shopSpot('enhance'), phase: 'night' }), false);
  assert.equal(cs.get('p').refined.why, 'no_shop');
  assert.equal(JSON.stringify(c.toJSON()), before);
  assert.equal(cs.op('p', refine, { ...shopSpot('enhance'), phase: 'day' }), true);
  c.addItem('card_boar'); c.addItem('ash', 5);
  const cardIndex = c.inventory.findIndex(s => s?.id === 'card_boar');
  const gearIndex = c.inventory.findIndex(s => s?.id === 'iron_dap');
  assert.equal(c.insertCard(cardIndex, gearIndex), true);
  gear = c.inventory[gearIndex];
  const strip = { op: 'strip', id: gear.id, iid: gear.roll?.iid, cards: gear.cards, plus: gear.plus, phase: 'day' };
  const socketed = JSON.stringify(c.toJSON());
  assert.equal(cs.op('p', strip, { ...shopSpot('occult'), phase: 'constructor' }), false);
  assert.equal(JSON.stringify(c.toJSON()), socketed);
  assert.equal(cs.op('p', strip, { ...shopSpot('occult'), phase: 'night' }), true);
  assert.equal(c.count('card_boar'), 1);
});
