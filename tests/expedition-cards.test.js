import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EXPEDITION_CARD_DEFS as DEFS, EXPEDITION_CARD_ROLES as ROLES } from '../src/character/data/expedition-cards.js';
import { EXPEDITION_MONSTERS } from '../src/combat/data/expedition-monsters.js';
import { EXPEDITIONS } from '../src/world/expeditions.js';
import { CARD_ITEMS, CARD_RATE, BOSS_CARD_EFFECTS, socketCards } from '../src/character/data/cards.js';
import { ITEMS } from '../src/character/data/items.js';
import { CLASSES, START_ITEMS } from '../src/character/data/classes.js';
import { Character } from '../src/character/Character.js';

const entries = Object.entries(DEFS), sorted = list => [...list].sort();
const fingerprint = bonus => JSON.stringify(Object.entries(bonus).sort(([a], [b]) => a.localeCompare(b)));
const flatCaps = { atk: 20, matk: 20, def: 10, hp: 120, mp: 60, acc: 12, eva: 6 };
const ratioCaps = { crit: .04, cast: .04, cdr: .04, critDmg: .1, vs_beast: .12, vs_spirit: .12, vs_demon: .12,
  res_beast: .08, res_spirit: .08, res_demon: .08, res_earth: .08, res_water: .08, res_fire: .08, res_wind: .08, res_dark: .08 };

test('definitions cover exactly the 24 ordinary expedition monsters across all eight tiers', () => {
  const ordinary = Object.entries(EXPEDITION_MONSTERS).filter(([, monster]) => !monster.boss).map(([id]) => id);
  assert.equal(entries.length, 24);
  assert.deepEqual(sorted(Object.keys(DEFS)), sorted(ordinary));
  assert.deepEqual(sorted(Object.keys(ROLES)), sorted(ordinary));
  for (const expedition of EXPEDITIONS) {
    assert.deepEqual(Object.keys(DEFS).filter(id => id.startsWith(`${expedition.id}_`)), [0, 1, 2].map(i => `${expedition.id}_${i}`));
    assert.equal(Object.hasOwn(DEFS, `${expedition.id}_3`), false);
  }
  assert.equal(Object.keys(CARD_ITEMS).filter(id => !Object.hasOwn(EXPEDITION_MONSTERS, CARD_ITEMS[id].monster)).length, 33);
});

test('only supported positive stat keys and legacy-compatible weapon slots are defined', () => {
  for (const [id, card] of entries) {
    assert.deepEqual(sorted(Object.keys(card)), ['bonus', 'slot']);
    assert.equal(card.slot, 'weapon', id);
    assert.equal(CARD_ITEMS[`card_${id}`].slot, card.slot);
    assert.equal(CARD_ITEMS[`card_${id}`].bonus, card.bonus, `${id} uses the shared definition at runtime`);
    assert.ok(Object.keys(card.bonus).length >= 2 && Object.keys(card.bonus).length <= 3);
    for (const [key, value] of Object.entries(card.bonus)) {
      assert.ok(Number.isFinite(value) && value > 0, `${id}:${key}`);
      assert.ok(Object.hasOwn(flatCaps, key) || Object.hasOwn(ratioCaps, key), `${id}:${key}`);
      if (Object.hasOwn(flatCaps, key)) {
        assert.ok(Number.isInteger(value), `${id}:${key}`);
        assert.ok(value <= flatCaps[key], `${id}:${key}`);
      } else assert.ok(value <= ratioCaps[key], `${id}:${key}`);
    }
    assert.equal(Object.hasOwn(card, 'minLevel'), false);
    assert.equal(Object.hasOwn(card, 'special'), false);
  }
});

test('all 24 bonus fingerprints are unique and none retain a generic fallback profile', () => {
  const fingerprints = entries.map(([, card]) => fingerprint(card.bonus));
  assert.equal(new Set(fingerprints).size, 24);
  for (const [id, card] of entries) {
    const keys = sorted(Object.keys(card.bonus));
    assert.notDeepEqual(keys, ['atk', 'matk'], id);
    assert.notDeepEqual(keys, ['hp', 'res_dark'], id);
    assert.ok(!(card.bonus.atk && card.bonus.matk), id);
  }
});

test('integration preserves the pre-merge gameplay data of 33 original cards and eight bosses', () => {
  const unchanged = Object.entries(CARD_ITEMS).filter(([, item]) => !DEFS[item.monster]).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, item]) => ({ id, slot: item.slot, bonus: item.bonus, rarity: item.rarity, price: item.price, weight: item.weight, special: item.special ?? null }));
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  // Captured from the shared branch immediately before the approved 24-card merge.
  assert.equal(unchanged.length, 41);
  assert.equal(sha(unchanged), 'aeefbd16c7685e15e1303a7f52571f2e567a9ecd7800aa1840c99ee9b3871ffe');
  assert.equal(sha(BOSS_CARD_EFFECTS), '33d1986bd956d7b02c287bcc7d3e41a3f842011f047f8b2766344a666e03bc85');
  assert.equal(Object.keys(CARD_ITEMS).length, 65);
  assert.deepEqual(CARD_RATE, { normal: .0002, elite: .0025, boss: .005 });
  for (const expedition of EXPEDITIONS) {
    const boss = CARD_ITEMS[`card_${expedition.id}_3`];
    assert.equal(boss.slot, 'charm');
    assert.deepEqual(boss.bonus, { hp: Math.round(EXPEDITION_MONSTERS[`${expedition.id}_3`].level * 3), res_dark: .1 });
  }
});

test('existing sockets and save/reload retain all 24 cards and apply their new bonuses on six class weapons', () => {
  const ids = entries.map(([id]) => `card_${id}`);
  for (const classId of Object.keys(CLASSES)) {
    const weapon = START_ITEMS[classId][0];
    const baseline = new Character({ name: 'ทดสอบการ์ด', classId, level: 100, equipment: { weapon } });
    for (let start = 0; start < ids.length; start += 3) {
      const held = ids.slice(start, start + 3);
      assert.deepEqual(socketCards(weapon, held, ITEMS), held, `${classId}:${start}`);
      const character = new Character({ name: 'ทดสอบการ์ด', classId, level: 100, equipment: { weapon }, cards: { weapon: held } });
      const save = character.toJSON(), reloaded = new Character(save);
      assert.deepEqual(reloaded.cards.weapon, held, `${classId}:${start}`);
      assert.equal(reloaded.equipment.weapon, weapon);
      const total = {};
      for (const id of held) for (const [key, value] of Object.entries(CARD_ITEMS[id].bonus)) total[key] = (total[key] ?? 0) + value;
      for (const [key, value] of Object.entries(total)) assert.ok(Math.abs(reloaded.equipBonus(key) - baseline.equipBonus(key) - value) < 1e-12, `${classId}:${start}:${key}`);
    }
  }
});

test('caster identities provide usable cooldown/reserve/race bonuses without magic-critical stats', () => {
  assert.deepEqual(DEFS.dusk_fort_1.bonus, { matk: 12, cdr: .03 });
  assert.deepEqual(DEFS.demon_rift_2.bonus, { matk: 20, mp: 40, vs_demon: .08 });
  assert.equal(ROLES.dusk_fort_1.name, 'อาคมเพลิงต่อเนื่อง');
  assert.equal(ROLES.demon_rift_2.name, 'เงาปราบอสูร');
  for (const [id, card] of entries.filter(([, card]) => card.bonus.matk)) {
    assert.equal(card.bonus.crit, undefined, id); assert.equal(card.bonus.critDmg, undefined, id);
    assert.ok(!ROLES[id].brief.includes('คริ'), id);
  }
  const c = Character.create('ทดสอบอาคม', 'shaman');
  const before = { matk: c.matk, mp: c.maxMp, cooldown: c.cooldownCut, crit: c.critChance, critDmg: c.critDamage };
  c.cards.weapon = ['card_dusk_fort_1'];
  assert.equal(c.matk, before.matk + 12);
  assert.ok(Math.abs(c.cooldownCut - before.cooldown - .03) < 1e-12);
  assert.equal(c.critChance, before.crit);
  c.cards.weapon = ['card_demon_rift_2'];
  assert.equal(c.matk, before.matk + 20);
  assert.equal(c.equipBonus('mp'), 40);
  assert.ok(c.maxMp > before.mp);
  assert.equal(c.vsRace({ race: 'demon' }), .08);
  assert.equal(c.vsRace({ race: 'spirit' }), 0);
  assert.equal(c.critDamage, before.critDmg);
});

test('tier escalation strengthens selected identities without turning every card into an all-purpose upgrade', () => {
  const higher = (later, earlier, keys) => keys.forEach(key => assert.ok(DEFS[later].bonus[key] > DEFS[earlier].bonus[key], `${later}:${key}`));
  higher('dusk_fort_0', 'bamboo_grave_1', ['atk', 'critDmg']);
  higher('demon_rift_1', 'sealed_mine_2', ['def', 'res_dark']);
  higher('fallen_city_2', 'sealed_mine_0', ['hp']);
  higher('demon_rift_2', 'sunken_city_0', ['matk', 'mp']);
  higher('fallen_city_0', 'sunken_city_2', ['vs_demon']);
  assert.equal(DEFS.himmapan_0.bonus.matk, undefined);
  assert.equal(DEFS.fallen_city_1.bonus.matk, undefined);
  assert.equal(DEFS.demon_rift_1.bonus.atk, undefined);
  assert.equal(DEFS.demon_rift_1.bonus.matk, undefined);
  assert.equal(DEFS.giant_valley_1.bonus.atk, undefined);
  assert.equal(DEFS.giant_valley_1.bonus.matk, undefined);
});

test('every three-card combination stays inside the declared normal-card stacking budget', () => {
  const bonuses = entries.map(([, card]) => card.bonus);
  // Include repeated copies: ordinary flat bonuses currently stack, unlike boss procs.
  for (let a = 0; a < bonuses.length; a++) for (let b = a; b < bonuses.length; b++) for (let c = b; c < bonuses.length; c++) {
    const total = {};
    for (const bonus of [bonuses[a], bonuses[b], bonuses[c]]) for (const [key, value] of Object.entries(bonus)) total[key] = (total[key] ?? 0) + value;
    for (const [key, cap] of Object.entries(flatCaps)) assert.ok((total[key] ?? 0) <= cap * 3);
    assert.ok((total.crit ?? 0) <= .12 + 1e-12);
    assert.ok((total.cast ?? 0) <= .12 + 1e-12);
    assert.ok((total.cdr ?? 0) <= .09 + 1e-12);
    assert.ok((total.critDmg ?? 0) <= .3 + 1e-12);
    for (const race of ['beast', 'spirit', 'demon']) assert.ok((total[`vs_${race}`] ?? 0) <= .24 + 1e-12);
    const resistance = Object.entries(total).filter(([key]) => key.startsWith('res_')).reduce((sum, [, value]) => sum + value, 0);
    assert.ok(resistance <= .24 + 1e-12);
  }
});

test('each build identity has distinct deterministic Thai copy and uses HP/SP terminology', () => {
  assert.equal(new Set(Object.values(ROLES).map(role => role.name)).size, 24);
  for (const [id, role] of Object.entries(ROLES)) {
    assert.deepEqual(sorted(Object.keys(role)), ['brief', 'buildRole', 'name']);
    assert.match(role.buildRole, /^[a-z]+(?:-[a-z]+)*$/);
    assert.match(role.name, /[ก-๙]/); assert.match(role.brief, /[ก-๙]/);
    assert.ok(!/\bMP\b/.test(`${role.name} ${role.brief}`));
    if (DEFS[id].bonus.mp) assert.ok(role.brief.includes('SP'));
    if (DEFS[id].bonus.hp) assert.ok(role.brief.includes('HP'));
    assert.ok(!/ดูดเลือด|ฟื้นฟู|สุ่ม|ติดสถานะ/.test(role.brief));
  }
  assert.ok(new Set(Object.values(ROLES).map(role => role.buildRole)).size >= 16);
});
