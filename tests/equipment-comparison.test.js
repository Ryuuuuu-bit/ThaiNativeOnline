import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { previewEquipment, formatEquipmentValue, formatEquipmentDelta } from '../src/character/equipmentComparison.js';
import { equipmentComparisonHtml } from '../src/character/ui/equipmentComparisonView.js';
import { ITEMS } from '../src/character/data/items.js';

const make = classId => new Character({ name: 'Comparison', classId, level: 100, jobLevel: 50, flaskVersion: 1 });
const roll = (id, affixes, iid = '10000000-0000-4000-8000-000000000001') => ({ v: 1, iid, level: 100, rarity: 'magic', affixes });
function matchesEquip(c, item) {
  c.inventory[0] = item;
  const preview = previewEquipment(c, item);
  assert.equal(preview.why, '');
  const clone = new Character({ ...c.toJSON(), flaskVersion: 1 });
  clone.buffs = structuredClone(c.buffs); clone.night = c.night; clone.skills = { ...c.skills };
  assert.equal(clone.equip(0), true);
  for (const row of preview.rows) {
    const actual = typeof row.read === 'function' ? row.read(clone) : clone[row.read];
    assert.equal(row.after, actual, `${row.key} must match actual Character.equip`);
  }
  assert.equal(clone.equipment[preview.slot], item.id);
  return preview;
}

test('preview matches actual equip including refinement, random affixes, existing/incoming cards and buffs', () => {
  const c = make('warrior');
  c.skills.sword_t_blade = 3;
  c.equipment.armor = 'bamboo_grave_armor'; c.refine.armor = 8; c.cards.armor = ['card_buffalo'];
  c.buffs = [{ id: 'def', remaining: 12, def: .3 }, { id: 'weak', remaining: 12, def: -.1, atk: -.15 }];
  const item = { id: 'sealed_mine_armor', qty: 1, plus: 2, locked: true, cards: ['card_buffalo'],
    roll: roll('sealed_mine_armor', [{ id: 'vital', tier: 2, value: 60 }, { id: 'dex', tier: 2, value: 3 }]) };
  const preview = matchesEquip(c, item);
  assert.ok(preview.rows.some(r => r.delta > 0));
  assert.ok(preview.rows.some(r => r.delta < 0));
  assert.deepEqual(preview.conditionalBefore, ['card_buffalo']);
  assert.deepEqual(preview.conditionalAfter, ['card_buffalo']);
});

test('preview has no live writes, events, RNG calls, identity or record changes', () => {
  const c = make('shaman'); c.inventory[0] = { id: 'hunt_paddy_charm_sage', qty: 1 };
  const before = JSON.stringify(c), equipment = c.equipment, cards = c.cards, buffs = c.buffs;
  let events = 0; c.on('change', () => events++); c.on('inventory', () => events++); c.on('titles', () => events++);
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Preview must never roll'); };
    const result = previewEquipment(c, c.inventory[0]);
    // Returned data can be consumed without aliasing the live item/card maps.
    result.current?.cards?.push('card_buffalo'); result.rows[0].after = -1;
    assert.equal(JSON.stringify(c), before);
    assert.equal(c.equipment, equipment); assert.equal(c.cards, cards); assert.equal(c.buffs, buffs);
    assert.equal(events, 0);
  } finally { Math.random = random; }
});

test('both accessory scenarios project the destination Character.equip actually replaces', () => {
  const c = make('warrior');
  c.equipment.charm = 'hunt_temple_charm_guard';
  assert.equal(matchesEquip(c, { id: 'hunt_paddy_charm_sage', qty: 1 }).slot, 'charm2');
  c.equipment.charm2 = 'hunt_temple_charm_hunter';
  const p = matchesEquip(c, { id: 'hunt_paddy_charm_sage', qty: 1 });
  assert.equal(p.slot, 'charm'); assert.equal(p.current.id, 'hunt_temple_charm_guard');
});

test('night bonus, passive skill bonuses and capped crit/cast are retained in the projection', () => {
  const c = make('shaman');
  c.night = true; c.skills.mage_t_fire = 4; c.skills.mage_t_tongue = 3;
  c.alloc.dex = 999; c.alloc.luk = 999;
  c.buffs = [{ id: 'critical', crit: 1, remaining: 20 }, { id: 'haste', aspd: 1, remaining: 20 }];
  const p = matchesEquip(c, { id: 'hunt_temple_charm_sage', qty: 1 });
  assert.equal(p.rows.find(r => r.key === 'critChance').after, .75);
  assert.equal(p.rows.find(r => r.key === 'castSpeed').after, .5);
  assert.equal(p.rows.find(r => r.key === 'attackSpeed').after, .45);
  assert.ok(p.rows.find(r => r.key === 'matk').after > c.matk);
});

test('class, level and death restrictions refuse projection while equipment locks remain allowed', () => {
  const c = make('shaman');
  assert.match(previewEquipment(c, { id: 'iron_dap' }).why, /อาชีพ/);
  c.level = 1;
  assert.match(previewEquipment(c, { id: 'sealed_mine_armor' }).why, /เลเวล 30/);
  assert.equal(previewEquipment(c, { id: 'hunt_paddy_charm_sage', locked: true }).why, '');
  c.hp = 0;
  assert.match(previewEquipment(c, { id: 'hunt_paddy_charm_sage' }).why, /ชีวิต/);
  assert.equal(previewEquipment(c, { id: 'potion_s' }), null);
});

test('mixed tradeoffs show individual deltas and conditional effects rather than universal better/worse', () => {
  const c = make('warrior'); c.equipment.charm = 'hunt_temple_charm_guard'; c.equipment.charm2 = 'hunt_paddy_charm_hunter';
  c.cards.charm = ['card_takian'];
  const item = { id: 'hunt_paddy_charm_sage', qty: 1,
    roll: roll('hunt_paddy_charm_sage', [{ id: 'spirit', tier: 5, value: 100 }]) };
  const p = previewEquipment(c, item);
  assert.ok(p.rows.some(r => r.direction < 0)); assert.ok(p.rows.some(r => r.direction > 0));
  const html = equipmentComparisonHtml(c, item, { charm: 'ประดับ 1' });
  assert.match(html, /ค่าสถานะปัจจุบัน → หลังสวม/);
  assert.match(html, /class="up"/); assert.match(html, /class="down"/);
  assert.match(html, /การ์ดตามเงื่อนไข/); assert.match(html, new RegExp(ITEMS.card_takian.special.name));
  assert.doesNotMatch(html, /ดีกว่า|แย่กว่า/);
});

test('percent values and deltas distinguish absolute percent from percentage points', () => {
  assert.equal(formatEquipmentValue(.125, true), '12.5%');
  assert.equal(formatEquipmentDelta(.005, true), '+0.5 จุด%');
  assert.equal(formatEquipmentDelta(-.025, true), '−2.5 จุด%');
  assert.equal(formatEquipmentDelta(0, true), 'เท่าเดิม');
  assert.equal(formatEquipmentValue(123), '123');
});

test('reading the same item after buffs expire reflects current state without caching old projection', () => {
  const c = make('warrior'), item = { id: 'bamboo_grave_armor', qty: 1 };
  c.buffs = [{ id: 'shield', remaining: 10, def: .5 }];
  const first = previewEquipment(c, item);
  c.buffs[0].remaining = 0;
  const next = previewEquipment(c, item);
  assert.ok(next.rows.find(r => r.key === 'defense').after < first.rows.find(r => r.key === 'defense').after);
  assert.equal(next.rows.find(r => r.key === 'defense').before, c.defense);
});
