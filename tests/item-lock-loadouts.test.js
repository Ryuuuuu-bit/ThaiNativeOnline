import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { CLASSES } from '../src/character/data/classes.js';
import { EQUIP_SLOTS } from '../src/character/data/items.js';
import { MASTERIES } from '../src/character/data/masteries.js';
import { cloneInstance, orderedController } from '../src/character/itemState.js';
import { sortedInventory } from '../src/character/bag.js';
import { fromSave, applyOp } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';
import { cleanOffer, offerWhy, swap } from '../server/trades.js';
import { Emitter } from '../src/character/Emitter.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';

const hero = (cls = 'warrior') => {
  const c = Character.create('QA', cls); c.gold = 50000;
  c.addItem('sacred_ore', 20); c.addItem('gold_leaf', 20); c.addItem('ash', 20);
  return c;
};
const indexOf = (c, id) => c.inventory.findIndex(s => s?.id === id);
const json = c => JSON.stringify(c.toJSON());
const ledger = c => [...c.inventory.filter(Boolean), ...EQUIP_SLOTS.map(s => c.wornItem(s)).filter(Boolean)].map(s => JSON.stringify(s)).sort();

test('instance locks survive equip/unequip, old-save parsing, server reload and exact cards/plus', () => {
  const c = hero(); c.addItem('iron_dap'); const i = indexOf(c, 'iron_dap');
  c.inventory[i] = { id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 7 };
  assert.ok(c.setItemLock(i, true)); assert.ok(c.equip(i));
  assert.ok(c.isLocked('weapon')); assert.equal(c.refine.weapon, 7); assert.deepEqual(c.cards.weapon, ['card_boar']);
  assert.ok(c.unequip('weapon')); const bag = c.inventory.find(s => s?.id === 'iron_dap');
  assert.deepEqual(bag, { id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 7, locked: true });
  assert.deepEqual(fromSave(JSON.parse(json(c))).inventory, c.inventory);
  assert.ok(c.equip(indexOf(c, 'iron_dap'))); const reload = fromSave(c.toJSON());
  assert.deepEqual(reload.wornItem('weapon'), c.wornItem('weapon'));
  assert.ok(reload.isLocked('weapon'));
  assert.ok(reload.setItemLock('weapon', false)); assert.ok(reload.unequip('weapon'));
  assert.equal(reload.inventory.find(s => s?.id === 'iron_dap').locked, undefined);
});

test('locks reject selling and all forge/card destruction before spending anything; wearing stays allowed', () => {
  const c = hero(); c.cards.weapon = ['card_boar']; c.refine.weapon = 4;
  c.setItemLock('weapon', true); let rolls = 0; const before = json(c);
  assert.deepEqual(c.refineGear('weapon', () => { rolls++; return 0; }), { ok: false, why: 'locked' });
  assert.equal(json(c), before); assert.equal(rolls, 0);
  c.unequip('weapon'); const i = indexOf(c, 'wood_sword'); const bagState = json(c);
  assert.equal(c.sellAt(i), 0);
  assert.equal(c.sellBatch([{ index: indexOf(c, 'potion_s'), qty: 1 }, { index: i, qty: 1 }]), 0);
  assert.deepEqual(c.stripCards(i, () => { rolls++; return .99; }), { ok: false, why: 'locked' });
  assert.equal(json(c), bagState); assert.equal(rolls, 0);
  c.addItem('card_boar'); const card = indexOf(c, 'card_boar');
  assert.equal(c.insertCard(card, i), false);
  c.setItemLock(i, false); c.setItemLock(card, true); assert.equal(c.insertCard(card, i), false);
  c.setItemLock(i, true); assert.ok(c.equip(i), 'harmless equip remains allowed');
  assert.equal(c.refine.weapon, 4); assert.deepEqual(c.cards.weapon, ['card_boar']);
});

test('locked materials are not silently consumed, and sort/loot keep locked stacks distinct', () => {
  const c = hero(), ore = indexOf(c, 'sacred_ore'); c.setItemLock(ore, true);
  assert.equal(c.refineGear('weapon').why, 'ore');
  assert.ok(c.addItem('sacred_ore', 2)); assert.equal(c.inventory[ore].qty, 20);
  assert.equal(c.countUnlocked('sacred_ore'), 2); assert.equal(c.refineGear('weapon').outcome, 'up');
  const sorted = sortedInventory(c.inventory), ores = sorted.filter(s => s?.id === 'sacred_ore');
  assert.equal(ores.length, 2); assert.equal(ores.find(s => s.locked).qty, 20); assert.equal(ores.find(s => !s.locked).qty, 1);
  const other = hero(); assert.ok(other.addInstance({ id: 'hide', qty: 3, locked: true }));
  assert.ok(other.addInstance({ id: 'hide', qty: 2 })); assert.equal(other.inventory.filter(s => s?.id === 'hide').length, 2);
  const copy = cloneInstance({ id: 'iron_dap', qty: 1, plus: 7, cards: ['card_boar'], locked: true });
  assert.ok(other.addInstance(copy)); copy.cards.push('card_monkey');
  assert.deepEqual(other.inventory.find(s => s?.id === 'iron_dap').cards, ['card_boar']);
  assert.ok(other.inventory.find(s => s?.id === 'iron_dap').locked);
});

test('card removal rejects locked-only return stacks in a full bag before charging or rolling', () => {
  const c = new Character({ name: 'CardReturn', classId: 'warrior', gold: 10000,
    inventory: [{ id: 'iron_dap', qty: 1, cards: ['card_boar'] }, { id: 'card_boar', qty: 1, locked: true },
      { id: 'ash', qty: 100 }, ...Array.from({ length: 21 }, () => ({ id: 'cloth_vest', qty: 1 }))] });
  const before = json(c); let rolls = 0;
  assert.deepEqual(c.stripCards(0, () => { rolls++; return 0; }), { ok: false, why: 'bag_full' });
  assert.equal(json(c), before); assert.equal(rolls, 0);
});

test('all returned cards merge only into unlocked stacks or occupy planned slots for every dice outcome', () => {
  for (const [roll, outcome] of [[0, 'ok'], [.91, 'item_broke'], [.99, 'cards_broke']]) {
    const c = new Character({ name: 'CardReturn', classId: 'warrior', gold: 10000,
      inventory: [{ id: 'wood_sword', qty: 1, cards: ['card_boar', 'card_boar', 'card_monkey'] },
        { id: 'card_boar', qty: 7, locked: true }, { id: 'card_boar', qty: 2 }, { id: 'ash', qty: 100 },
        ...Array.from({ length: 19 }, () => ({ id: 'cloth_vest', qty: 1 })), null] });
    assert.equal(c.stripCards(0, () => roll).outcome, outcome);
    assert.deepEqual(c.inventory[1], { id: 'card_boar', qty: 7, locked: true });
    assert.equal(c.countUnlocked('card_boar'), outcome === 'cards_broke' ? 2 : 4);
    assert.equal(c.countUnlocked('card_monkey'), outcome === 'cards_broke' ? 0 : 1);
    assert.equal(c.countUnlocked('ash'), 97); assert.equal(c.gold, 9400);
    assert.equal(c.inventory[0] === null, outcome === 'item_broke');
    if (c.inventory[0]) assert.equal(c.inventory[0].cards, undefined);
  }
});

test('card return checks combined weight and rejects atomically even when each individual card fits', () => {
  const c = new Character({ name: 'CardWeight', classId: 'warrior', gold: 10000,
    inventory: [{ id: 'iron_dap', qty: 1, cards: ['card_boar', 'card_monkey'] }, { id: 'ash', qty: 100 }] });
  Object.defineProperty(c, 'maxWeight', { value: c.weight + 1 });
  assert.equal(c.carryRoom('card_boar'), 1); assert.equal(c.carryRoom('card_monkey'), 1);
  const before = json(c); let rolls = 0;
  assert.deepEqual(c.stripCards(0, () => { rolls++; return 0; }), { ok: false, why: 'bag_full' });
  assert.equal(json(c), before); assert.equal(rolls, 0);
});

test('automatic bag sorting sees only the finished forge/card-removal mutation', () => {
  for (const [kind, roll, expected] of [['refine', 0, 'up'], ['refine', .99, 'broke'], ['strip', 0, 'ok'], ['strip', .91, 'item_broke']]) {
    const c = new Character({ name: 'AutoSort', classId: 'warrior', gold: 10000,
      inventory: [{ id: 'sacred_ore', qty: 1 }, { id: 'ash', qty: 2 },
        { id: 'iron_dap', qty: 1, plus: 4, cards: ['card_boar'] }, { id: 'cloth_vest', qty: 1, locked: true }, null] });
    let events = 0;
    c.on('inventory', () => { events++; c.inventory = sortedInventory(c.inventory); });
    const result = kind === 'refine' ? c.refineGear(2, () => roll) : c.stripCards(2, () => roll);
    assert.equal(result.outcome, expected); assert.equal(events, 1);
    assert.ok(c.inventory.some(s => s?.id === 'cloth_vest' && s.locked), 'unrelated locked armor survives');
    const sword = c.inventory.find(s => s?.id === 'iron_dap');
    assert.equal(!!sword, expected === 'up' || expected === 'ok');
    if (expected === 'up') { assert.equal(sword.plus, 5); assert.deepEqual(sword.cards, ['card_boar']); }
    if (expected === 'ok') { assert.equal(sword.plus, 4); assert.equal(sword.cards, undefined); }
    assert.equal(c.count('card_boar'), kind === 'strip' ? 1 : 0);
    assert.equal(c.count('sacred_ore'), kind === 'refine' ? 0 : 1);
    assert.equal(c.count('ash'), kind === 'strip' ? 1 : 2);
    assert.equal(c.gold, kind === 'refine' ? 9500 : 9800);
  }
});

test('trade rejects locked gear/stacks and rechecks a lock added after making an offer atomically', () => {
  const a = hero(), b = hero(); a.addItem('iron_dap'); const i = indexOf(a, 'iron_dap');
  a.inventory[i] = { id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 7 };
  const offered = cleanOffer({ items: [{ id: 'iron_dap', qty: 1, cards: ['card_boar'], plus: 7 }], gold: 200 }), empty = cleanOffer({ items: [] });
  assert.equal(offerWhy(a, offered), null); a.setItemLock(i, true);
  assert.equal(offerWhy(a, offered), 'missing'); const before = [json(a), json(b)];
  assert.deepEqual(swap(a, b, offered, empty), { ok: false, why: 'missing' });
  assert.deepEqual([json(a), json(b)], before);
  a.setItemLock(indexOf(a, 'sacred_ore'), true);
  assert.equal(offerWhy(a, cleanOffer({ items: [{ id: 'sacred_ore', qty: 1, locked: false }] })), 'missing');
  a.addItem('sacred_ore', 2);
  assert.ok(swap(a, b, cleanOffer({ items: [{ id: 'sacred_ore', qty: 2 }] }), empty).ok);
  assert.equal(a.inventory.find(s => s?.id === 'sacred_ore').qty, 20);
  assert.ok(a.inventory.find(s => s?.id === 'sacred_ore').locked);
});

test('three presets preserve distinct owned instances, locks and stacks through full-bag swaps without healing', () => {
  const c = hero(); c.cards.weapon = ['card_boar']; c.refine.weapon = 4;
  c.setItemLock('weapon', true); assert.ok(c.saveLoadout(0, 'ฝึกซ้อม'));
  c.addItem('iron_dap'); const i = indexOf(c, 'iron_dap');
  c.inventory[i].plus = 7; c.inventory[i].cards = ['card_monkey']; c.equip(i);
  assert.ok(c.saveLoadout(1, 'ล่าบอส')); assert.ok(c.saveLoadout(2, 'ชุดสำรอง'));
  assert.equal(c.saveLoadout(3, 'fourth'), false); assert.equal(c.saveLoadout(-1), false);
  c.setItemLock('weapon', true); // lock changes after saving must follow the actual instance
  while (c.inventory.includes(null)) c.addItem('wood_sword');
  const before = ledger(c); c.hp = 10; c.mp = 1;
  assert.ok(c.applyLoadout(0).ok); assert.equal(c.equipment.weapon, 'wood_sword'); assert.ok(c.isLocked('weapon'));
  assert.deepEqual(ledger(c), before); assert.equal(c.hp, 10); assert.equal(c.mp, 1);
  assert.ok(c.applyLoadout(1).ok); assert.equal(c.equipment.weapon, 'iron_dap'); assert.ok(c.isLocked('weapon'));
  assert.deepEqual(c.cards.weapon, ['card_monkey']); assert.equal(c.refine.weapon, 7);
  assert.deepEqual(ledger(c), before);
  const reload = fromSave(c.toJSON()); assert.deepEqual(reload.loadouts, c.loadouts);
  assert.equal(reload.loadouts.length, 3); assert.ok(reload.renameLoadout(2, ' ชุดเก็บของ '));
  assert.equal(reload.loadouts[2].name, 'ชุดเก็บของ');
});

test('missing/changed gear, duplicate references and full-bag returns roll back the entire loadout', () => {
  const c = hero(); c.saveLoadout(0); c.unequip('weapon');
  c.inventory[indexOf(c, 'wood_sword')].plus = 1;
  let before = json(c); assert.equal(c.applyLoadout(0).why, 'missing'); assert.equal(json(c), before);
  c.addItem('takrut', 2); c.equip(indexOf(c, 'takrut')); c.equip(indexOf(c, 'takrut')); c.saveLoadout(1);
  c.unequip('charm'); c.unequip('charm2'); c.inventory[indexOf(c, 'takrut')] = null;
  before = json(c); assert.equal(c.applyLoadout(1).why, 'missing'); assert.equal(json(c), before);
  const d = hero(); d.unequip('weapon'); d.saveLoadout(0); d.equip(indexOf(d, 'wood_sword'));
  while (d.inventory.includes(null)) d.addItem('wood_sword');
  before = json(d); assert.equal(d.applyLoadout(0).why, 'bag_full'); assert.equal(json(d), before);
  for (const cls of Object.keys(CLASSES)) {
    const who = hero(cls); who.saveLoadout(0);
    const wrong = cls === 'warrior' ? 'short_bow' : 'wood_sword';
    who.addItem(wrong); who.loadouts[0].equipment.weapon = { id: wrong, cards: [], plus: 0 };
    const state = json(who); assert.equal(who.applyLoadout(0).why, 'class'); assert.equal(json(who), state);
  }
});

test('skill presets only reorder available learned skills, never restore spent points or levels after reset', () => {
  const c = new Character({ name: 'QA', classId: 'warrior', level: 100, jobLevel: 50, gold: 50000 });
  const first = c.kitSkills[0]; c.learnSkill(first); c.learnSkill(first);
  const second = c.kitSkills.find(id => id !== first && c.skillOpen(id)); assert.ok(second); assert.ok(c.learnSkill(second));
  const order = [second, first]; assert.ok(c.setHotbar(order)); c.saveLoadout(0);
  const skills = { ...c.skills }, spent = c.skillPointsSpent;
  c.setHotbar([first, second]); assert.ok(c.applyLoadout(0).ok); assert.deepEqual(c.hotbar, order);
  assert.deepEqual(c.skills, skills); assert.equal(c.skillPointsSpent, spent);
  assert.equal(c.setHotbar(['not_a_skill']), false); assert.equal(c.setHotbar([first, first]), false);
  assert.ok(c.resetSkills()); const reset = { ...c.skills }; assert.ok(c.applyLoadout(0).ok);
  assert.deepEqual(c.skills, reset); assert.deepEqual(c.hotbar, [first]); assert.equal(c.skillPointsSpent, 0);
});

test('server validates instance lock ops and combat state, ignoring browser-provided loadout flags', () => {
  const c = hero(); c.saveLoadout(0); c.addItem('iron_dap'); c.equip(indexOf(c, 'iron_dap'));
  const cs = new Combatants({ now: () => 100 }); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  cs.get(1).fightAt = 99; const before = json(cs.get(1).c);
  assert.equal(cs.op(1, { op: 'loadout_apply', index: 0, n: 1, fighting: false }), false);
  assert.equal(json(cs.get(1).c), before); assert.equal(cs.me(1).loadoutResult.ok, false);
  cs.get(1).fightAt = -Infinity;
  assert.equal(cs.op(1, { op: 'loadout_apply', index: 0, n: 2 }, { loadoutBusy: true }), false);
  assert.equal(cs.op(1, { op: 'loadout_apply', index: 0, n: 3 }), true);
  const item = cs.get(1).c.wornItem('weapon');
  assert.ok(cs.op(1, { op: 'item_lock', worn: 'weapon', id: item.id, cards: item.cards, plus: item.plus, lock: true }));
  assert.ok(cs.get(1).c.isLocked('weapon'));
  assert.equal(cs.op(1, { op: 'item_lock', worn: 'weapon', id: 'iron_dap', lock: false }), false);
  assert.equal(applyOp(c, { op: 'loadout_apply', index: 0, fighting: false }), false, 'missing trusted context fails closed');
});

test('network loadout waits for a matching authoritative result, rejects combat even for an unchanged preset, and adopts locks', () => {
  const c = hero(); c.saveLoadout(0);
  const cs = new Combatants({ now: () => 100 }); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const net = new Emitter(); net.online = true; const messages = [], results = [];
  net.send = m => messages.push(m); attachNetProgress(net, c); c.on('loadout-result', r => results.push(r));
  net.emit('sync', { c: cs.me(1) }); const before = json(c);
  assert.ok(c.applyLoadout(0).pending); assert.equal(json(c), before); assert.equal(c.applyLoadout(0).why, 'pending');
  cs.get(1).fightAt = 99; assert.equal(cs.op(1, messages[0]), false);
  net.emit('sync', { c: cs.me(1) }); assert.equal(results[0].ok, false); assert.equal(results[0].why, 'combat');
  assert.equal(c.loadoutPending, false);
  cs.get(1).fightAt = -Infinity; c.applyLoadout(0); assert.ok(cs.op(1, messages[1]));
  net.emit('sync', { c: cs.me(1) }); assert.equal(results[1].ok, true);
  c.setItemLock('weapon', true); assert.equal(messages[2].op, 'item_lock'); assert.ok(cs.op(1, messages[2]));
  net.emit('sync', { c: cs.me(1) }); assert.ok(c.isLocked('weapon'));
  const sent = messages.length; assert.equal(c.refineGear('weapon').why, 'locked'); assert.equal(messages.length, sent);
});

test('hotbar display remaps casts, cooldowns, learned levels and survival identity together', () => {
  const calls = [], original = {
    slots: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], kit: { skills: [{ quick: false }, { quick: true }, { quick: false }] }, busy: true,
    cast: (i, quiet) => { calls.push([i, quiet]); return true; }, cooldown: i => [i + 1, 10], usable: i => i !== 1, active: i => i === 1, level: i => i + 1,
  };
  const ordered = orderedController(original, ['b', 'a']);
  assert.deepEqual(ordered.slots.map(s => s.id), ['b', 'a', 'c']); ordered.cast(0, true);
  assert.deepEqual(calls, [[1, true]]); assert.deepEqual(ordered.cooldown(0), [2, 10]);
  assert.equal(ordered.level(0), 2); assert.equal(ordered.usable(0), false); assert.equal(ordered.active(0), true);
  assert.equal(ordered.kit.skills[0].quick, true); assert.equal(ordered.busy, true);
});

test('Descartes masteries remain class-specific flat bonuses after derived stats, persist and never gate skills', () => {
  for (const cls of Object.keys(CLASSES)) {
    const c = hero(cls), definition = MASTERIES[`school_${cls}`], before = c.derived, skills = { ...c.skills };
    c.alloc.vit = 100; const base = c.derived; c.masteries = { [definition.id]: true };
    assert.equal(c.derived.patk - base.patk, definition.bonus.atk ?? 0);
    assert.equal(c.derived.matk - base.matk, definition.bonus.matk ?? 0);
    assert.equal(c.derived.maxHp - base.maxHp, definition.bonus.hp ?? 0);
    assert.deepEqual(new Character(JSON.parse(json(c))).masteries, c.masteries);
    assert.deepEqual(c.skills, skills); assert.ok(before.maxHp > 0);
    const other = new Character({ ...c.toJSON(), masteries: { school_nonexistent: true, school_hunter: true } });
    assert.deepEqual(other.masteries, cls === 'hunter' ? { school_hunter: true } : {});
  }
});

test('signed-in mastery and practice remain deferred through disconnect; guests keep immediate local grants', () => {
  const setup = () => {
    const c = hero(), combat = new Emitter(), skill = c.kitSkills[0]; combat.combatTimer = 1;
    const mastery = MASTERIES.school_warrior;
    const q = new QuestSystem([
      { id: 'practice', giver: 'master', objectives: [{ practice: [skill], count: 1 }] },
      { id: mastery.questId, classId: c.classId, giver: 'master', objectives: [], rewards: { mastery: mastery.id } },
    ], { storage: null });
    q.attach(c, combat); q.accept('practice'); q.accept(mastery.questId);
    const net = new Emitter(), messages = []; net.online = true; net.send = m => messages.push(m);
    attachNetProgress(net, c, q);
    return { c, q, combat, skill, mastery, net, messages };
  };
  const guest = setup(); guest.net.emit('status', false);
  assert.equal(guest.q.deferMastery, false); assert.equal(guest.q.deferPractice, false);
  guest.combat.emit('kit-cast', { id: guest.skill });
  assert.equal(guest.q.state.practice.casts[guest.skill], 1);
  assert.ok(guest.q.complete(guest.mastery.questId)); assert.ok(guest.c.masteries[guest.mastery.id]);

  const signed = setup(), truth = { ...signed.c.toJSON(), ack: 0, quests: structuredClone(signed.q.state) };
  signed.net.emit('sync', { c: truth });
  assert.equal(signed.q.deferMastery, true); assert.equal(signed.q.deferPractice, true);
  signed.combat.emit('kit-cast', { id: signed.skill });
  signed.net.online = false; signed.net.emit('status', false);
  assert.equal(signed.q.deferMastery, true); assert.equal(signed.q.deferPractice, true);
  signed.combat.emit('kit-cast', { id: signed.skill });
  assert.equal(signed.q.state.practice.casts[signed.skill], undefined);
  assert.ok(signed.q.complete(signed.mastery.questId));
  assert.deepEqual(signed.c.masteries, {}); assert.equal(signed.messages.length, 0);
  signed.net.online = true;
  signed.net.emit('sync', { c: { ...truth, masteries: { [signed.mastery.id]: true } } });
  assert.ok(signed.c.masteries[signed.mastery.id], 'only an authoritative copy grants the signed-in flag');
});
