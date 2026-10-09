import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_CARD_EFFECTS, CARD_ITEMS, CARD_RATE, cardRate } from '../src/character/data/cards.js';
import { ITEMS } from '../src/character/data/items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { Character } from '../src/character/Character.js';
import { activeBossCardEffects, bossCardOutgoingMul, bossCardIncomingMul, createBossCardProcState,
  bossCardHitPlan, bossCardKillPlan, applyBossCardHit, applyBossCardKill, bossCardProcStateFor } from '../src/combat/bossCardEffects.js';

function wearer(types = [], classId = 'warrior') {
  const c = Character.create('ทดสอบ', classId); c.level = 100;
  c.equipment.armor = 'bamboo_grave_armor'; // two legal armor sockets
  c.equipment.charm = c.equipment.charm2 = 'bia_kae';
  for (const slot of Object.keys(c.cards)) c.cards[slot] = [];
  for (const type of types) {
    const card = CARD_ITEMS[`card_${type}`];
    const slot = card.slot === 'charm' && c.cards.charm.length ? 'charm2' : card.slot;
    c.cards[slot].push(`card_${type}`);
  }
  c.hp = c.maxHp; c.mp = c.maxMp;
  return c;
}

test('all eleven bosses have one explicit ability, preserving flat bonuses and card rates', () => {
  const bosses = Object.entries(MONSTERS).filter(([, m]) => m.boss).map(([id]) => id).sort();
  assert.equal(bosses.length, 11);
  assert.deepEqual(Object.keys(BOSS_CARD_EFFECTS).sort(), [...bosses, 'buffalo', 'takian'].sort());
  assert.equal(new Set(Object.values(BOSS_CARD_EFFECTS).map(e => e.id)).size, 13);
  for (const [type, m] of Object.entries(MONSTERS)) {
    const card = CARD_ITEMS[`card_${type}`];
    assert.equal(!!card.special, Object.hasOwn(BOSS_CARD_EFFECTS, type), type);
    if (m.boss) {
      assert.equal(card.special, BOSS_CARD_EFFECTS[type]);
      assert.ok(card.special.id && card.special.name && card.special.description);
      assert.equal(cardRate(m), .005);
      const bonus = type === 'pop' ? { vit: 3, res_spirit: .15 }
        : type === 'pusom' ? { str: 2, agi: 2, vit: 2, int: 2, dex: 2, luk: 5 }
        : type === 'chalawan' ? { vit: 6, hp: 200, res_beast: .15 }
        : { hp: Math.round(m.level * 3), res_dark: .1 };
      assert.deepEqual(card.bonus, bonus);
    }
  }
  assert.deepEqual(CARD_RATE, { normal: .0002, elite: .0025, boss: .005 });
  assert.equal(BOSS_CARD_EFFECTS.pusom.description, 'เมื่อเป็นผู้ได้รับรางวัลไอเทมจากมอนสเตอร์ ฟื้น SP 2% ของ SP สูงสุด ทุก 5 วินาที');
});

test('Buffalo and Takian guardians have explicit 12% race abilities without changing elite flags, flat bonuses or rates', () => {
  for (const [type, race, name, bonus] of [
    ['buffalo', 'beast', 'แรงเจ้าทุ่ง', { vit: 4, hp: 80, res_beast: .1 }],
    ['takian', 'demon', 'อาคมพิทักษ์ตะเคียน', { int: 4, matk: 8 }],
  ]) {
    const card = CARD_ITEMS[`card_${type}`], c = wearer([type, type]);
    assert.equal(card.special, BOSS_CARD_EFFECTS[type]); assert.equal(card.special.name, name);
    assert.equal(card.special.bonus, .12); assert.equal(card.special.race, race);
    assert.equal(!!MONSTERS[type].boss, false); assert.equal(MONSTERS[type].elite, true);
    assert.equal(cardRate(MONSTERS[type]), .0025); assert.deepEqual(card.bonus, bonus);
    assert.equal(bossCardOutgoingMul(c, { race }), 1.12, 'duplicate sockets cannot stack');
    assert.equal(bossCardOutgoingMul(c, { race: 'spirit' }), 1);
    assert.equal(bossCardOutgoingMul(wearer([type, 'demon_rift_3']), { race }), 1.3, 'guardian ability obeys the shared damage cap');
    assert.equal(bossCardOutgoingMul(c, { race }, { pvp: true }), 1);
  }
});

test('only legal sockets in active worn gear count; collection, bag cards and invalid sockets give nothing', () => {
  const c = wearer(); c.cardCollection = Object.keys(BOSS_CARD_EFFECTS);
  c.addItem('card_demon_rift_3');
  c.cards.charm = ['card_pop', 'potion_s', 'card_demon_rift_3', 'card_bamboo_grave_3'];
  assert.deepEqual(activeBossCardEffects(c).map(e => e.id), ['rift_pact'], 'wrong kinds removed, socket count enforced');
  c.equipment.charm = null;
  assert.deepEqual(activeBossCardEffects(c), [], 'unequipped socket arrays grant nothing');
  c.equipment.charm = 'tiger_fang';
  assert.deepEqual(activeBossCardEffects(c), [], 'zero-slot gear cannot activate cards');
  c.equipment.weapon = 'bone_wand'; c.cards.weapon = ['card_demon_rift_3'];
  assert.deepEqual(activeBossCardEffects(c), [], 'retired and wrong-kind gear remains inert');
  c.equipment.armor = 'sealed_mine_armor'; c.cards.armor = ['card_pop']; c.level = 29;
  assert.deepEqual(activeBossCardEffects(c), [], 'gear above wearer level remains inactive');
  c.level = 30; assert.equal(activeBossCardEffects(c)[0].id, 'pop_drain');
  c.equipment.head = 'bia_kae'; c.cards.head = ['card_pusom']; c.cards.armor = [];
  assert.deepEqual(activeBossCardEffects(c), [], 'gear in a forged equipment slot remains inactive');
});

test('each conditional outgoing ability has its exact trigger; duplicate copies do not stack', () => {
  const cases = [
    ['bamboo_grave_3', { race: 'spirit' }, { race: 'beast' }, 1.18],
    ['sunken_city_3', { element: 'water' }, { element: 'fire' }, 1.18],
    ['giant_valley_3', { boss: true }, { elite: true }, 1.18],
    ['himmapan_3', { element: 'wind' }, { element: 'water' }, 1.18],
    ['fallen_city_3', { element: 'dark' }, { element: 'earth' }, 1.18],
  ];
  for (const [type, yes, no, mul] of cases) {
    const c = wearer([type, type]), before = structuredClone(c.toJSON());
    assert.equal(activeBossCardEffects(c).length, 1, type);
    assert.equal(bossCardOutgoingMul(c, { def: yes }), mul, type);
    assert.equal(bossCardOutgoingMul(c, no), 1, type);
    assert.deepEqual(c.toJSON(), before, 'read helpers do not mutate character state');
  }
  const dusk = wearer(['dusk_fort_3']); dusk.hp = dusk.maxHp * .5;
  assert.equal(bossCardOutgoingMul(dusk, {}), 1.15);
  dusk.hp += .001; assert.equal(bossCardOutgoingMul(dusk, {}), 1);
  const rift = wearer(['demon_rift_3', 'demon_rift_3']);
  assert.equal(bossCardOutgoingMul(rift, {}), 1.25);
  assert.equal(bossCardIncomingMul(rift), 1.1);
  const capped = wearer(['bamboo_grave_3', 'demon_rift_3']);
  assert.equal(bossCardOutgoingMul(capped, { race: 'spirit' }), 1.3);
  assert.equal(bossCardOutgoingMul(capped, { race: 'spirit' }, { dot: true }), 1);
  assert.equal(bossCardOutgoingMul(capped, { race: 'spirit' }, { pvp: true }), 1);
  capped.hp = 0; assert.equal(bossCardOutgoingMul(capped, { race: 'spirit' }), 1);
});

test('incoming thresholds are inclusive and reduction composes multiplicatively with the rift penalty', () => {
  const c = wearer(['chalawan', 'sealed_mine_3', 'demon_rift_3']);
  c.hp = c.maxHp * .4; assert.ok(Math.abs(bossCardIncomingMul(c) - .85 * 1.1) < 1e-12);
  c.hp += .001; assert.equal(bossCardIncomingMul(c), 1.1);
  c.hp = c.maxHp * .8; assert.equal(bossCardIncomingMul(c), .9 * 1.1);
  c.hp -= .001; assert.equal(bossCardIncomingMul(c), 1.1);
  assert.equal(bossCardIncomingMul(c, { pvp: true }), 1);
  c.hp = 0; assert.equal(bossCardIncomingMul(c), 1);
});

test('bounded guest HP context affects only outgoing conditions and never mutates real vitals', () => {
  const c = wearer(['dusk_fort_3']); const hp = c.hp;
  assert.equal(bossCardOutgoingMul(c, {}, { hpFraction: .5 }), 1.15);
  for (const hpFraction of [.5001, 2, -1, 0, NaN, Infinity, '.2'])
    assert.equal(bossCardOutgoingMul(c, {}, { hpFraction }), 1, `${hpFraction}`);
  assert.equal(c.hp, hp); assert.equal(bossCardIncomingMul(c), 1);
});

test('Pop heals real damage only with strict HP cap, live wearer, and a two-second cooldown', () => {
  const c = wearer(['pop']), state = createBossCardProcState();
  c.hp = c.maxHp / 2;
  const before = c.hp, cap = Math.floor(c.maxHp * .02);
  assert.equal(applyBossCardHit(c, state, 0, 1e9), cap);
  assert.equal(c.hp, before + cap); assert.equal(state.hitReadyAt, 2);
  assert.equal(applyBossCardHit(c, state, 1.999, 100), 0);
  assert.equal(applyBossCardHit(c, state, 2, 100), 3);
  for (const options of [{ pet: true }, { dot: true }, { pvp: true }]) assert.equal(bossCardHitPlan(c, 100, 10, state, options), null);
  for (const damage of [0, -1, NaN, Infinity]) assert.equal(bossCardHitPlan(c, damage, 10, state), null);
  c.hp = c.maxHp - 1; assert.equal(applyBossCardHit(c, state, 10, 1000), 1);
  assert.equal(c.hp, c.maxHp);
  assert.equal(bossCardHitPlan(c, 100, 20, state), null);
  c.hp = 0; assert.equal(bossCardHitPlan(c, 1000, 20, state), null);
});

test('Pusom recovery has no SP overflow or resurrection; cooldown state survives gear changes and is not saved', () => {
  const c = wearer(['pusom']), state = bossCardProcStateFor(c); c.mp = 0;
  const amount = Math.floor(c.maxMp * .02);
  assert.equal(applyBossCardKill(c, state, 0), amount);
  const saved = c.toJSON(); assert.ok(!Object.hasOwn(saved, 'bossCardProcs'));
  assert.equal(bossCardProcStateFor(c), state);
  c.unequip('charm');
  assert.equal(bossCardKillPlan(c, 5, state), null);
  const index = c.inventory.findIndex(s => s?.id === 'bia_kae' && s.cards?.includes('card_pusom'));
  assert.ok(c.equip(index));
  assert.equal(bossCardProcStateFor(c), state);
  assert.equal(bossCardKillPlan(c, 4.999, state), null);
  assert.equal(applyBossCardKill(c, state, 5), amount);
  c.mp = c.maxMp - 1; assert.equal(applyBossCardKill(c, state, 10), 1); assert.equal(c.mp, c.maxMp);
  c.hp = 0; c.mp = 0; assert.equal(bossCardKillPlan(c, 20, state), null); assert.equal(c.hp, 0);
});
