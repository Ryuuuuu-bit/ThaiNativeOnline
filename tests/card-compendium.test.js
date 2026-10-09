import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CARD_CATALOG, CARD_COMPENDIUM_VERSION, CARD_SLOT_LABELS, cardBonusLines, cardSpecialText, cardPercent, cardOwnership, cardProgress, searchCards } from '../src/data/card-compendium.js';
import { PLAYER_GUIDE, PLAYER_GUIDE_VERSION, GUIDE_ACTIONS } from '../src/data/player-guide.js';
import { CARD_ITEMS, CARD_RATE, STRIP, BOSS_CARD_EFFECTS, cardRate } from '../src/character/data/cards.js';
import { ITEMS } from '../src/character/data/items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { MAP_BOSSES } from '../src/combat/data/boss-skills.js';
import { BESTIARY } from '../src/data/bestiary.js';
import { combatSpawns } from '../src/data/spawns.js';
import { MAPS } from '../src/world/maps.js';
import { MAX_LEVEL, MAX_JOB_LEVEL, MAX_SKILL_LEVEL } from '../src/character/data/progression.js';
import { POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { REFINE_MAX, REFINE_SAFE, REFINE_RATE } from '../src/character/data/refine.js';
import { WARP_RANGE, WARP_COOLDOWN } from '../src/data/warpServices.js';
import { PARTY } from '../server/parties.js';
import { EXPEDITION_CARD_ROLES } from '../src/character/data/expedition-cards.js';

const sorted = list => [...list].sort();
const guide = id => PLAYER_GUIDE.find(section => section.id === id);

test('the versioned journal includes all 65 cards, including the two without active spawns', () => {
  assert.equal(CARD_COMPENDIUM_VERSION, 1);
  assert.equal(PLAYER_GUIDE_VERSION, 1);
  assert.equal(CARD_CATALOG.length, 65);
  assert.equal(new Set(CARD_CATALOG.map(card => card.id)).size, 65);
  assert.deepEqual(sorted(CARD_CATALOG.map(card => card.id)), sorted(Object.keys(CARD_ITEMS)));
  assert.deepEqual(sorted(CARD_CATALOG.map(card => card.monsterId)), sorted(Object.keys(MONSTERS)));
  assert.deepEqual(sorted(CARD_CATALOG.filter(card => !card.available).map(card => card.id)), ['card_pop', 'card_tiger']);
  assert.equal(cardProgress(null).available, 63);
  for (const card of CARD_CATALOG.filter(card => !card.available)) assert.deepEqual(card.locations, []);
});

test('locations and route monsters come from actual spawned bestiary entries', () => {
  const active = new Map(BESTIARY.map(monster => [monster.id, monster]));
  assert.deepEqual(sorted(CARD_CATALOG.filter(card => card.available).map(card => card.monsterId)), sorted(new Set(combatSpawns().map(spawn => spawn.type))));
  for (const card of CARD_CATALOG.filter(card => card.available)) {
    assert.equal(card.monster, active.get(card.monsterId));
    assert.deepEqual(card.locations, active.get(card.monsterId).locations);
    assert.ok(card.locations.every(location => MAPS[location.map] && Number.isFinite(location.x) && Number.isFinite(location.z)));
  }
});

test('each card displays its real slot and independent normal/elite/boss drop rate', () => {
  assert.deepEqual(CARD_RATE, { normal: .0002, elite: .0025, boss: .005 });
  assert.deepEqual(['normal', 'elite', 'boss'].map(kind => cardPercent(CARD_RATE[kind])), ['0.02%', '0.25%', '0.5%']);
  assert.equal(Object.hasOwn(CARD_SLOT_LABELS, 'offhand'), false);
  for (const card of CARD_CATALOG) {
    assert.equal(card.name, CARD_ITEMS[card.id].name);
    assert.equal(card.slot, CARD_ITEMS[card.id].slot);
    assert.equal(card.chance, cardRate(MONSTERS[card.monsterId]));
    assert.equal(card.chance, CARD_RATE[card.kind]);
    assert.ok(CARD_SLOT_LABELS[card.slot]);
    assert.ok(Object.values(ITEMS).some(item => item.type === 'equip' && !item.retired && item.slot === card.slot && item.slots > 0));
  }
});

test('bonus text preserves flat values and percentage units and uses HP/SP vocabulary', () => {
  assert.deepEqual(cardBonusLines({ hp: 80, mp: 30, crit: .04, vs_beast: .1, res_water: .15, def: -2, none: 0, invalid: NaN }).map(line => line.text),
    ['HP สูงสุด +80', 'SP สูงสุด +30', 'โอกาสคริ +4%', 'โจมตีสัตว์ +10%', 'ต้านทานน้ำ +15%', 'DEF -2']);
  assert.deepEqual(cardBonusLines({}), []);
  for (const card of CARD_CATALOG) {
    assert.deepEqual(card.bonusLines.map(line => [line.key, line.value]), Object.entries(card.item.bonus).filter(([, value]) => value !== 0));
    assert.ok(!/\bMP\b/.test(card.bonusLines.map(line => line.text).join(' ')));
  }
});

test('boss special badges and searchable descriptions use supplied rule data only', () => {
  assert.deepEqual(sorted(CARD_CATALOG.filter(card => card.special).map(card => card.monsterId)), sorted(Object.keys(BOSS_CARD_EFFECTS)));
  for (const card of CARD_CATALOG) {
    if (!card.special) { assert.equal(card.specialText, null); continue; }
    assert.equal(card.special, CARD_ITEMS[card.id].special);
    assert.deepEqual(card.specialText, { name: card.special.name, description: card.special.description });
    assert.ok(card.specialText.name && card.specialText.description);
    assert.ok(searchCards({ query: card.specialText.name }).some(result => result.id === card.id));
    assert.ok(searchCards({ query: card.specialText.description }).some(result => result.id === card.id));
    assert.ok(!/\bMP\b/.test(card.specialText.description));
  }
  assert.equal(cardSpecialText(null), null);
  assert.deepEqual(cardSpecialText({ nameTh: 'ชื่อที่กำหนด', descriptionTh: 'ข้อความที่กำหนด', ratio: .99 }), { name: 'ชื่อที่กำหนด', description: 'ข้อความที่กำหนด' });
  assert.equal(cardSpecialText({ kind: 'unknown', ratio: .99 }).description, '');
});

test('native art exists and shared donor art is explicitly distinguishable as an emblem', () => {
  for (const card of CARD_CATALOG) {
    assert.ok(existsSync(new URL(`../public/${card.item.img}`, import.meta.url)), card.item.img);
    assert.equal(card.sharedArt, !card.item.illustration && card.item.img !== `ui/items/icon_card_${card.monsterId}.png`);
    if (card.item.illustration) {
      assert.ok(existsSync(new URL(`../public/${card.item.illustration}`, import.meta.url)));
      assert.equal(card.sharedArt, false);
    } else if (card.monsterId.includes('_')) assert.equal(card.sharedArt, true);
  }
});

function holdings() {
  return {
    cardBook: { card_boar: true, card_pop: true, card_pusom: true, card_tiger: true, card_cobra: 1, card_unknown: true },
    inventory: [
      { id: 'card_boar', qty: 3, locked: true }, { id: 'card_pop', qty: 2 },
      { id: 'iron_dap', qty: 1, plus: 7, locked: true, cards: ['card_unknown', 'card_boar', 'card_cobra', 'card_dhole'] },
      { id: 'cloth_vest', qty: 1, cards: ['card_boar', 'card_pop', 'card_winyan'] },
      null, { id: 'card_dhole', qty: -2 }, { id: 'card_dhole', qty: .5 },
      { id: 'card_dhole', qty: Number.MAX_SAFE_INTEGER + 1 }, { id: 'potion_s', qty: 5, cards: ['card_boar'] },
    ],
    equipment: { weapon: 'wood_sword', charm: 'takrut', charm2: 'bia_kae', head: 'cloth_vest' },
    cards: { weapon: ['card_boar', 'card_cobra', 'card_dhole', 'card_krasue'], charm: ['card_pusom'], charm2: ['card_pret'], head: ['card_pop'] },
  };
}

test('ownership separates loose, bag sockets, worn sockets and historical discovery without mutation', () => {
  const character = holdings(), before = structuredClone(character), counts = cardOwnership(character);
  assert.deepEqual(counts.card_boar, { loose: 3, bagSockets: 1, wornSockets: 1, socketed: 2, owned: 5, collected: true });
  assert.deepEqual(counts.card_pop, { loose: 2, bagSockets: 1, wornSockets: 0, socketed: 1, owned: 3, collected: true });
  assert.equal(counts.card_cobra.owned, 2);
  assert.equal(counts.card_cobra.collected, false);
  assert.equal(counts.card_pusom.wornSockets, 1);
  assert.equal(counts.card_pret.wornSockets, 1);
  assert.equal(counts.card_dhole.owned, 1);
  assert.equal(counts.card_krasue.owned, 0);
  assert.equal(counts.card_winyan.owned, 0);
  assert.equal(Object.hasOwn(counts, 'card_unknown'), false);
  assert.deepEqual(cardProgress(character, counts), { total: 65, collected: 4, available: 63, owned: 13 });
  assert.deepEqual(character, before);
});

test('moving socketed gear to worn gear conserves cards; sold history has no owned count', () => {
  const character = { cardBook: { card_boar: true, card_tiger: true }, inventory: [{ id: 'wood_sword', qty: 1, cards: ['card_boar'] }], equipment: {}, cards: {} };
  assert.equal(cardOwnership(character).card_boar.bagSockets, 1);
  character.inventory[0] = null; character.equipment.weapon = 'wood_sword'; character.cards.weapon = ['card_boar'];
  const worn = cardOwnership(character);
  assert.equal(worn.card_boar.bagSockets, 0); assert.equal(worn.card_boar.wornSockets, 1); assert.equal(worn.card_boar.owned, 1);
  character.equipment.weapon = null; character.cards.weapon = [];
  const sold = cardOwnership(character);
  assert.equal(sold.card_boar.owned, 0); assert.equal(sold.card_boar.collected, true);
  assert.equal(sold.card_tiger.owned, 0); assert.equal(sold.card_tiger.collected, true);
  assert.equal(cardProgress(character).collected, 2);
});

test('opening a journal for empty or incomplete character data does not create discoveries', () => {
  assert.deepEqual(cardProgress(null), { total: 65, collected: 0, available: 63, owned: 0 });
  const character = { inventory: [{ id: 'card_boar', qty: 1 }] };
  assert.equal(cardOwnership(character).card_boar.owned, 1);
  assert.equal(cardProgress(character).collected, 0);
  assert.equal(character.cardBook, undefined);
});

test('search accepts monster/card names, stat bonuses, special text and actual map names', () => {
  for (const card of CARD_CATALOG) {
    for (const query of [card.monsterName, card.name]) assert.ok(searchCards({ query }).some(result => result.id === card.id), query);
  }
  assert.ok(searchCards({ query: 'sp' }).some(card => card.id === 'card_khamot'));
  assert.ok(searchCards({ query: 'ต้านทานน้ำ' }).some(card => card.id === 'card_crab'));
  const card = CARD_CATALOG.find(card => card.monsterId === 'demon_rift_3');
  assert.ok(searchCards({ query: MAPS[card.locations[0].map].name }).some(result => result.id === card.id));
  assert.deepEqual(searchCards({ query: 'ไม่มีคำนี้ในการ์ดใดเลย' }), []);
});

test('ordinary expedition identities are searchable without replacing item names or boss effects', () => {
  for (const [id, role] of Object.entries(EXPEDITION_CARD_ROLES)) {
    const card = CARD_CATALOG.find(card => card.monsterId === id);
    assert.equal(card.role, role);
    assert.equal(card.name, CARD_ITEMS[card.id].name);
    assert.equal(card.special, null);
    for (const query of [role.buildRole, role.name, role.brief]) assert.ok(searchCards({ query }).some(result => result.id === card.id));
  }
  assert.ok(CARD_CATALOG.filter(card => card.kind === 'boss').every(card => card.role === null));
  const dusk = searchCards({ query: 'อาคมเพลิงต่อเนื่อง' }).find(card => card.id === 'card_dusk_fort_1');
  assert.ok(dusk.bonusLines.some(line => line.text === 'ลดคูลดาวน์ +3%'));
  const rift = searchCards({ query: 'เงาปราบอสูร' }).find(card => card.id === 'card_demon_rift_2');
  assert.ok(rift.bonusLines.some(line => line.text === 'SP สูงสุด +40'));
  assert.ok(rift.bonusLines.some(line => line.text === 'โจมตีอสูร +8%'));
  assert.ok([dusk, rift].every(card => card.bonusLines.every(line => line.key !== 'crit' && line.key !== 'critDmg')));
});

test('map/type/slot/collected filters compose and keep inactive cards discoverable', () => {
  const character = holdings(), ownership = cardOwnership(character);
  assert.deepEqual(sorted(searchCards({ map: 'unavailable' }).map(card => card.id)), ['card_pop', 'card_tiger']);
  const rift = searchCards({ map: 'demon_rift', kind: 'boss', slot: 'charm' });
  assert.deepEqual(rift.map(card => card.id), ['card_demon_rift_3']);
  assert.equal(searchCards({ map: 'demon_rift', kind: 'boss', slot: 'weapon' }).length, 0);
  assert.deepEqual(sorted(searchCards({ collected: 'collected', ownership }).map(card => card.id)), ['card_boar', 'card_pop', 'card_pusom', 'card_tiger']);
  assert.equal(searchCards({ collected: 'missing', ownership }).length, 61);
  assert.ok(searchCards({ collected: 'owned', ownership }).every(card => ownership[card.id].owned > 0));
  assert.deepEqual(searchCards({ slot: 'armor', collected: 'owned', query: 'ปอบ', ownership }).map(card => card.id), ['card_pop']);
});

test('boss filtering includes map guardians without changing their elite card rates', () => {
  const mapBosses = new Set(Object.values(MAP_BOSSES));
  assert.equal(mapBosses.size, 12);
  const bosses = searchCards({ kind: 'boss' });
  assert.equal(bosses.length, 13);
  for (const monsterId of mapBosses) {
    const card = bosses.find(card => card.monsterId === monsterId);
    assert.ok(card?.mapBoss, monsterId);
  }
  for (const id of ['buffalo', 'takian']) {
    const card = bosses.find(card => card.monsterId === id);
    assert.equal(card.kind, 'elite');
    assert.equal(card.chance, CARD_RATE.elite);
    assert.ok(card.special);
  }
});

test('guide extraction and drop receipts match current risks, fees and authoritative card rates', () => {
  assert.deepEqual(guide('extract').facts, STRIP);
  assert.ok(guide('extract').lines.join(' ').includes(`${STRIP.gold} ทอง`));
  assert.ok(guide('extract').lines.join(' ').includes(ITEMS.ash.name));
  for (const rate of [STRIP.ok, STRIP.itemBreaks, 1 - STRIP.ok - STRIP.itemBreaks]) assert.ok(guide('extract').lines.join(' ').includes(cardPercent(rate)));
  assert.deepEqual(guide('drops').facts.rates, CARD_RATE);
  for (const rate of Object.values(CARD_RATE)) assert.ok(guide('drops').lines.join(' ').includes(cardPercent(rate)));
});

test('guide progression, refinement, party and warp receipts match the current game caps', () => {
  assert.deepEqual(guide('levels').facts, { maxLevel: MAX_LEVEL, maxJobLevel: MAX_JOB_LEVEL, maxSkillLevel: MAX_SKILL_LEVEL, pointsPerLevel: POINTS_PER_LEVEL });
  assert.deepEqual(guide('refine').facts, { max: REFINE_MAX, safe: REFINE_SAFE, rates: REFINE_RATE });
  for (const id of ['sacred_ore', 'gold_leaf']) assert.ok(guide('refine').lines.join(' ').includes(ITEMS[id].name));
  assert.deepEqual(guide('party').facts, { max: PARTY.max, shareRange: PARTY.shareRange, levelGap: PARTY.levelGap, bonus: PARTY.bonus });
  assert.deepEqual(guide('travel').facts, { warpRange: WARP_RANGE, warpCooldown: WARP_COOLDOWN, loadouts: 3 });
});

test('guide uses HP/SP and routes only to the six integrated actions, with rule source receipts', () => {
  assert.deepEqual(GUIDE_ACTIONS, ['bag', 'sheet', 'skills', 'bestiary', 'map', 'loadouts']);
  const actions = new Set();
  for (const section of PLAYER_GUIDE) {
    assert.ok(section.sources.length && section.sources.every(source => source.startsWith('src/') || source.startsWith('server/') || source.startsWith('docs/')));
    assert.ok(!/\bMP\b/.test([section.title, ...section.lines].join(' ')));
    for (const action of section.actions ?? (section.action ? [{ action: section.action }] : [])) {
      assert.ok(GUIDE_ACTIONS.includes(action.action)); actions.add(action.action);
    }
  }
  assert.deepEqual(sorted(actions), sorted(GUIDE_ACTIONS));
  assert.ok(guide('levels').lines.join(' ').includes(ITEMS.ether.name));
  assert.ok(guide('levels').lines.join(' ').includes('SP'));
});
