// Ported from the original tests/economy.test.mjs (pure-logic parts) + proximity-injection checks.
// Original side-scroller x positions are replaced by ctx.nearNpc(target) (see src/rules/README.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCharacter, migrate } from '../../src/rules/charmodel.js';
import { runAction, grantKill, grant, count, near, shopPrice, bulkSellList, addItem } from '../../src/rules/economy.js';
import { setInfo } from '../../src/rules/data/gear.js';
import { MAPS, REGION_BOSS_IDS, isGraveMon } from '../../src/rules/data/maps.js';
import { MONSTERS } from '../../src/rules/data/monsters.js';
import { FORGE } from '../../src/rules/data/crafting.js';
import { ITEMS } from '../../src/rules/data/items.js';
import { HERB_NODES } from '../../src/rules/data/herbs.js';
import { mobExp, expLevelMul, expToNext as e2n, mobAtkMul } from '../../src/rules/stats.js';
import { wbHp, wbReward, WB_BASE_EXP, WB_MIN_SHARE } from '../../src/rules/data/worldboss.js';
import { CRYPT, lvOf, parseCrypt, cryptId, checkpoints, isBossFloor, isChestFloor, chestLoot, cryptMob, partyHard, hpMul } from '../../src/rules/data/crypt.js';
import { QUESTS, ENHANCE, rollFish, FISH_BY_MAP } from '../../src/rules/data/village.js';
import { tradable } from '../../src/rules/data/trade.js';
import { CARD_BY_ID } from '../../src/rules/data/cards.js';

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
/** at = the one proximity target the player is standing at (null = near nothing) */
const ctx = (at, extra = {}) => ({ rnd, now: Date.now(), sess: {}, nearNpc: (t) => t === at, ...extra });

test('economy: buying needs the shop NPC in range and enough gold', () => {
  const c = newCharacter('ทดสอบ', {});
  assert.equal(c.gold, 150);
  assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 2 }, ctx(null)).ok, false, 'ไกลร้าน');
  assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 2 }, ctx('shop')).ok, true);
  assert.equal(c.gold, 100);
  c.gold = 5;
  assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 1 }, ctx('shop')).msg, 'เงินไม่พอ');
  assert.equal(runAction(c, 'buy', { shop: 'kru_sword', id: 'hp_s' }, ctx('kru_sword')).ok, false, 'ร้านไม่มีของนี้');
  assert.equal(runAction(c, 'nope', {}, ctx(null)).ok, false);
  assert.equal(runAction(c, '__proto__', {}, ctx(null)).ok, false);
});

test('economy: equip level gate, two accessory slots, set bonus, enhance', () => {
  const c = newCharacter('ทดสอบ', {});
  c.inventory.push({ id: 'g_sword_w08', qty: 1 }, { id: 'g_sword_a08', qty: 1 }, { id: 'g_sword_c08', qty: 1 }, { id: 'g_sword_c10', qty: 1 });
  assert.equal(runAction(c, 'equip', { id: 'g_sword_w08' }).ok, false, 'Lv.14 ยังใส่ไม่ได้');
  c.level = 20;
  for (const id of ['g_sword_w08', 'g_sword_a08', 'g_sword_c08', 'g_sword_c10']) assert.equal(runAction(c, 'equip', { id }).ok, true);
  assert.equal(c.equipment.accessory2, 'g_sword_c10');
  const si = setInfo(c.equipment);
  assert.equal(si.n, 4); assert.equal(si.lv, 14); assert.ok(si.bonus.crit > 0);
  // ตีบวก: หักของ/เงิน ตาม ENHANCE · ตีพลาดต่ำกว่า +10 ไม่ลด
  c.gold = 100000; c.inventory.push({ id: 'black_iron', qty: 50 });
  let ok = 0;
  for (let i = 0; i < 30; i++) { const r = runAction(c, 'enhance', { slot: 'weapon' }, ctx('smith')); if (r.success) ok++; assert.ok(c.enhance.weapon >= 0); }
  assert.ok(ok > 0 && c.gold < 100000);
  assert.equal(runAction(c, 'enhance', { slot: 'weapon' }, ctx(null)).ok, false, 'ต้องอยู่ใกล้ลุงดำ');
});

test('economy: kill rewards feed quests, titles; claim needs the quest giver', () => {
  const k = newCharacter('นักล่า', {});
  runAction(k, 'qAccept', { id: 'q_tuay' });
  for (let i = 0; i < 8; i++) grantKill(k, { mon: 'phi_tuay_kaew', exp: 10, gold: 3, items: [{ id: 'glass_shard', qty: 1 }] });
  assert.equal(k.quests.active.q_tuay, 8); assert.equal(count(k, 'glass_shard'), 8); assert.equal(k.rec.kills, 8);
  assert.equal(runAction(k, 'qClaim', { id: 'q_tuay' }, ctx(null)).ok, false, 'ต้องอยู่ใกล้ผู้ใหญ่ชัย');
  const cl = runAction(k, 'qClaim', { id: 'q_tuay' }, ctx('quest'));
  assert.ok(cl.ok && k.quests.done.includes('q_tuay') && count(k, 'hp_s') === 3 + 5);
  for (let i = 0; i < 92; i++) grantKill(k, { mon: 'kuman_thong', exp: 1, gold: 0, items: [] });
  assert.ok(k.titles.includes('hunt100'), 'ฉายานักล่าผี');
  // เทรด/ระหว่างเทรดใช้ของไม่ได้ · GM
  assert.equal(runAction(k, 'use', { id: 'hp_s' }, ctx(null, { trade: true })).ok, false);
  assert.equal(runAction(k, 'gm', { cmd: 'gold' }, ctx(null)).ok, false, 'ไม่ใช่แอดมิน');
  assert.equal(runAction(k, 'gm', { cmd: 'gold', a1: '10' }, ctx(null, { admin: true })).ok, true);
});

test('economy: fishing is rate-limited and needs a bite; titles, dye, recall', () => {
  const f = newCharacter('ชาวประมง', {}), sess = {};
  assert.equal(runAction(f, 'fishLand', {}, ctx('fish', { sess })).ok, false);
  assert.equal(runAction(f, 'fishBite', {}, ctx(null, { sess })).ok, false, 'ต้องยืนริมน้ำ');
  assert.equal(runAction(f, 'fishBite', {}, ctx('fish', { sess })).ok, true);
  assert.equal(runAction(f, 'fishBite', {}, ctx('fish', { sess })).ok, false, 'ถี่เกิน');
  assert.equal(runAction(f, 'fishLand', {}, ctx('fish', { sess, now: Date.now() + 500 })).ok, true);
  assert.equal(f.inventory.some((s) => ITEMS[s.id].type === 'fish' || s.id === 'junk_boot'), true);
  assert.equal(runAction(f, 'chest', {}, ctx(null, { sess: { joinAt: Date.now() } })).ok, false, 'หีบสมบัติโลกเก่าปิดแล้ว');
  assert.equal(runAction(f, 'title', { id: 'lv30' }).ok, false);
  assert.equal(runAction(f, 'title', { id: 'rookie' }).ok, true); assert.equal(f.appearance.title, 'rookie');
  f.gold = 1000;
  assert.equal(runAction(f, 'dye', { part: 'hair', v: 4 }, ctx(null)).ok, false, 'ต้องอยู่ใกล้แม่ช้อย');
  assert.equal(runAction(f, 'dye', { part: 'hair', v: 4 }, ctx('tailor')).ok, true); assert.equal(f.appearance.hair, 4);
  assert.equal(runAction(f, 'recall', { to: 'hunt' }).ok, false, 'ยังไม่มีจุดล่า');
  f.lastHunt = 'm3';
  assert.equal(runAction(f, 'recall', { to: 'hunt' }).ok, false, 'เลเวลไม่ถึง');
  f.lastHunt = 'm1';
  assert.deepEqual(runAction(f, 'recall', { to: 'hunt' }).to, 'm1'); assert.equal(count(f, 'yant_home'), 2);
});

test('economy: migrate strips fake items and broken fields', () => {
  const m = migrate({ name: 'เก่า', appearance: {}, level: 3, inventory: [{ id: 'fake_item', qty: 9 }, { id: 'hp_s', qty: 2 }], gold: 'abc', v: 2, skills: null });
  assert.deepEqual(m.inventory.map((s) => s.id).sort(), ['hand_wrap', 'hp_s'], 'ของปลอมถูกตัด · ได้ผ้าพันมือที่ตกหล่น'); assert.equal(m.gold, 0); assert.ok(m.hp > 0);
});

test('data: 5 region bosses, forge recipes reference real items', () => {
  assert.equal(REGION_BOSS_IDS.length, 5);
  for (const id of REGION_BOSS_IDS) assert.ok(MONSTERS[id].regionBoss && MONSTERS[id].hp > 1000 && MAPS[MONSTERS[id].mapId]);
  assert.ok(FORGE.filter((r) => !r.util).length >= 60);
  assert.equal(new Set(FORGE.map((r) => r.out)).size, FORGE.length, 'สูตรไม่ซ้ำ'); for (const r of FORGE) assert.ok(ITEMS[r.out], `ของที่ได้ ${r.out}`);
  for (const r of FORGE) for (const need of Object.keys(r.need)) assert.ok(ITEMS[need], `วัตถุดิบ ${need}`);
  assert.equal(grant(newCharacter('x', {}), { exp: 40 }).ups, 1);
});

test('stats: EXP level-band caps (patch #21)', () => {
  assert.equal(expLevelMul(50, 50), 1); assert.equal(expLevelMul(50, 55), 1.1); assert.equal(expLevelMul(50, 45), 1);
  assert.equal(expLevelMul(50, 60), 1.2); assert.equal(expLevelMul(50, 61), 1.1);
  assert.equal(mobAtkMul(10), 1); assert.equal(mobAtkMul(30), 1.35); assert.equal(mobAtkMul(150), 1.35);
  assert.equal(e2n(30), Math.floor(40 * Math.pow(30, 1.6))); assert.ok(e2n(149) > 40 * Math.pow(149, 1.6) * 10);
  assert.equal(expLevelMul(60, 50), 0.5); assert.equal(expLevelMul(99, 1), 0.1);
  assert.equal(expLevelMul(1, 57), 0.2);
  assert.ok(mobExp(895, 1, 57) <= e2n(1) * 0.2 + 1, 'ฆ่าตัวเดียวได้ไม่เกิน 20% ของหลอด');
  assert.ok(mobExp(1e9, 10, 12, true) <= e2n(10), 'บอส: ไม่เกิน 1 เลเวล');
});

test('world boss: 8M HP per player, EXP reward capped at one level', () => {
  assert.equal(wbHp(1), 8_000_000); assert.equal(wbHp(10), 80_000_000); assert.equal(wbHp(0.25), 8_000_000);
  for (const lv of [1, 10, 40, 99, 140]) {
    const R = wbReward(1, 0.5, true), base = Math.round(WB_BASE_EXP * R.expK);
    const c = newCharacter('wb', {}); c.level = lv; c.exp = 0;
    const g = grant(c, { exp: mobExp(base, lv, 150, true) });
    assert.ok(g.ups <= 1, `Lv.${lv}: ${g.ups}`);
  }
  const n = 200, minShare = Math.min(WB_MIN_SHARE, 0.2 / n); assert.ok(minShare < 1 / n);
});

test('crypt: 100 floors', () => {
  assert.equal(lvOf(1), 5); assert.equal(lvOf(100), 150);
  assert.deepEqual(parseCrypt(cryptId(15, 3, 'p1-2')), { f: 15, n: 3, inst: 'p1-2' });
  for (const bad of ['crypt:0:1:x', 'crypt:101:1:x', 'crypt:5:7:x', 'crypt:5:1:', 'ayutthaya', null]) assert.equal(parseCrypt(bad), null, `${bad}`);
  assert.deepEqual(checkpoints(1), [1]); assert.deepEqual(checkpoints(31), [1, 11, 21, 31]); assert.equal(checkpoints(999).length, 10);
  assert.ok(isBossFloor(10) && !isBossFloor(15) && isChestFloor(15) && !isChestFloor(10));
  for (const f of [1, 50, 100]) for (const k of ['silver', 'gold']) {
    const L = chestLoot(f, k, () => 0.5);
    assert.ok(L.gold > 0 && L.dust > 0 && L.items.every((it) => ITEMS[it.id] && it.qty > 0), `${k} ${f}`);
  }
  const a = MONSTERS[cryptMob('phi_pob', 5, 1)], b = MONSTERS[cryptMob('phi_pob', 5, 3)], boss = MONSTERS[cryptMob('mae_nak', 10, 1, 'b')];
  assert.equal(a.level, lvOf(5)); assert.ok(b.hp > a.hp); assert.ok(boss.boss && boss.hp > a.hp);
  assert.ok(a.drops.some((d) => d.item === CRYPT.dust));
  assert.equal(partyHard(29, 6).hp, 1); assert.ok(partyHard(100, 6).hp > partyHard(100, 2).hp); assert.equal(hpMul(1), 1);
});

test('quests to Lv.150: realm quests via the patrol captain (legacy ctx.tdNpc), minLv, job gear', () => {
  assert.ok(Math.max(...QUESTS.map((q) => q.lv)) >= 145);
  assert.ok(QUESTS.every((q) => q.reward.gear));
  const r = newCharacter('RealmQ', { gender: 'male' });
  r.level = 50; r.appearance.job = 'mage';
  const td = { td: true, tdNpc: 'quest', rnd: Math.random };
  assert.ok(runAction(r, 'qAccept', { id: 'r_hm1' }, td).ok);
  for (let i = 0; i < 40; i++) grantKill(r, { mon: 'kumphan', exp: 0, gold: 0, items: [] });
  assert.ok(!runAction(r, 'qClaim', { id: 'r_hm1' }, { ...td, tdNpc: 'shop' }).ok, 'ส่งกับร้านค้าไม่ได้');
  const cl = runAction(r, 'qClaim', { id: 'r_hm1' }, td);
  assert.ok(cl.ok && cl.gear && ITEMS[cl.gear]?.job === 'mage' && count(r, cl.gear) === 1);
  r.level = 30; r.appearance.job = 'swordman';
  assert.ok(runAction(r, 'qAccept', { id: 'j_sw4' }, { rnd: Math.random }).ok);
  grantKill(r, { mon: 'phi_tuay_kaew', exp: 0, gold: 0, items: [] });
  assert.equal(r.quests.active.j_sw4, 0, 'ผีเลเวลต่ำไม่นับ');
  grantKill(r, { mon: 'kumphan', exp: 0, gold: 0, items: [] });
  assert.equal(r.quests.active.j_sw4, 1, 'ผีเลเวลถึงนับ');
});

test('level-scaled prices; bound items not tradable', () => {
  const lo = { level: 1 }, hi = { level: 150 };
  assert.equal(shopPrice(lo, 'reset_water'), 300);
  assert.ok(shopPrice(hi, 'reset_water') >= 300 * 45);
  assert.equal(shopPrice(hi, 'hp_m'), ITEMS.hp_m.price);
  assert.ok(!tradable('reset_water') && tradable('hp_m'));
  assert.equal(ENHANCE.cost(0, 1), ENHANCE.cost(0));
  assert.ok(ENHANCE.cost(19, 150) > ENHANCE.cost(19, 1) * 15);
  const b = newCharacter('Buyer', { gender: 'male' }); b.level = 150; b.gold = 1e6;
  const g0 = b.gold, r = runAction(b, 'buy', { shop: 'mae_kha', id: 'reset_water', qty: 1 }, { rnd: Math.random });
  assert.ok(r.ok && g0 - b.gold === shopPrice(b, 'reset_water'));
});

test('regional fish, legendary rarity, bulk sell skips rare fish', () => {
  for (const [map, list] of Object.entries(FISH_BY_MAP)) for (const f of list) assert.ok(ITEMS[f.id], `${map}: ${f.id}`);
  let s = 0; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const got = {}; for (let i = 0; i < 20000; i++) { const f = rollFish(true, r, 'sumeru'); got[f.id] = (got[f.id] || 0) + 1; }
  assert.ok(!got.pla_nin && got.pla_hin > 0);
  assert.ok(got.pla_anon > 20 && got.pla_anon < 400, `${got.pla_anon}/20000`);
  const day = {}; for (let i = 0; i < 5000; i++) { const f = rollFish(false, r, 'sumeru'); day[f.id] = 1; }
  assert.ok(!day.pla_nam_khaeng);
  const c = { inventory: [{ id: 'pla_hin', qty: 3 }, { id: 'pla_anon', qty: 1 }, { id: 'pla_nam_khaeng', qty: 1 }], locked: [] };
  assert.deepEqual(bulkSellList(c, 'fish').map((x) => x.id), ['pla_hin']);
});

test('traded cards removed from a socket do not count toward the card book', () => {
  const c = newCharacter('การ์ด', {}); c.gold = 1e6; c.level = 30;
  const cid = Object.keys(CARD_BY_ID).find((id) => CARD_BY_ID[id].slot === 'weapon');
  addItem(c, cid, 1, false);
  assert.ok(runAction(c, 'cardIn', { slot: 'weapon', id: cid }, { now: Date.now() }).ok);
  assert.ok(runAction(c, 'cardOut', { slot: 'weapon', idx: 0 }, { now: Date.now() }).ok);
  assert.ok(!(c.cardBook?.[cid] > 0));
});

// ---- port-specific: injected proximity ----
test('proximity: no nearNpc/tdNpc → in range; injected callback gets NPC ids and spot keys', () => {
  assert.equal(near({}, 'smith'), true);
  assert.equal(near({ tdNpc: 'shop' }, 'smith'), false);
  assert.equal(near({ tdNpc: 'smith' }, 'smith'), true);
  assert.equal(near({ tdNpc: 'smith' }, 'shrine'), true, 'tdNpc only gates NPC targets');
  const asked = [];
  const c = newCharacter('ถาม', {}); c.gold = 1000;
  runAction(c, 'sell', { id: 'hp_s', qty: 1 }, { nearNpc: (t) => { asked.push(t); return false; } });
  assert.ok(asked.includes('shop') && asked.includes('market'), 'sell asks every shop NPC');
  c.inventory.push({ id: 'garland', qty: 1 });
  assert.equal(runAction(c, 'offer', { key: 'garland' }, { nearNpc: (t) => t === 'temple' }).msg, 'ต้องยืนหน้าศาลพระภูมิ');
  assert.equal(runAction(c, 'offer', { key: 'garland' }, { nearNpc: (t) => t === 'shrine' }).ok, true);
  assert.equal(runAction(c, 'siamsi', {}, { nearNpc: () => false }).ok, false, 'ต้องอยู่ที่วัด');
  assert.equal(runAction(c, 'siamsi', {}, { nearNpc: (t) => t === 'temple', rnd }).ok, true);
  assert.equal(runAction(c, 'bounty', { i: 0 }, { nearNpc: () => false }).ok, false, 'ต้องกลับไปหาพรานบุญ');
  assert.equal(runAction(c, 'bounty', { i: 0 }, { nearNpc: (t) => t === 'camp' }).msg, 'ยังล่าไม่ครบ', 'camp in range → reaches the bounty check');
});

test('proximity: herb nodes are indexed and gated by herb:<i>; respawn cooldown', () => {
  assert.equal(HERB_NODES.length, 26);
  const c = newCharacter('เก็บ', {}), sess = {}, now = Date.now();
  const i = HERB_NODES.findIndex((n) => n.item === 'herb_aloe');
  assert.equal(runAction(c, 'gather', { node: i }, { sess, now, rnd, nearNpc: () => false }).msg, 'อยู่ไกลเกินไป');
  const g = runAction(c, 'gather', { node: i }, { sess, now, rnd, nearNpc: (t) => t === `herb:${i}` });
  assert.ok(g.ok && g.item === 'herb_aloe' && count(c, 'herb_aloe') === g.qty);
  assert.equal(runAction(c, 'gather', { node: i }, { sess, now: now + 2000, rnd }).ok, false, 'ยังไม่งอกใหม่');
  assert.equal(runAction(c, 'gather', { node: 999 }, { sess, now, rnd }).ok, false);
});

test("quest goal kill:'grave' counts region 4-5 monsters (legacy map no >= 13)", () => {
  const grave = Object.keys(MONSTERS).filter(isGraveMon), other = Object.keys(MONSTERS).filter((id) => !isGraveMon(id));
  assert.equal(grave.length, 10);
  assert.ok(isGraveMon('pret_asura') && !isGraveMon('phi_tuay_kaew'));
  const c = newCharacter('ป่าช้า', {}); c.level = 20;
  assert.ok(runAction(c, 'qAccept', { id: 'q_grave' }).ok);
  grantKill(c, { mon: other[0], exp: 0 }); assert.equal(c.quests.active.q_grave, 0);
  grantKill(c, { mon: grave[0], exp: 0 }); assert.equal(c.quests.active.q_grave, 1);
});
