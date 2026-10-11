import { ITEMS, EQUIP_SLOTS } from './data/items.js';
import { cleanRoll } from './data/affixes.js';

// This is the destination used by Character.equip, including a free second charm.
export const equipDestination = (c, id) => ITEMS[id]?.slot === 'charm' && c.equipment.charm && !c.equipment.charm2 ? 'charm2' : ITEMS[id]?.slot;

const metric = (key, label, read = key, percent = false, lowerBetter = false) => ({ key, label, read, percent, lowerBetter });
export const EQUIPMENT_METRICS = Object.freeze([
  metric('maxHp', 'HP สูงสุด'), metric('maxMp', 'MP สูงสุด'),
  metric('patk', 'ATK'), metric('matk', 'MATK'), metric('defense', 'DEF'),
  metric('accuracy', 'แม่นยำ'), metric('evasion', 'หลบหลีก'),
  metric('critChance', 'โอกาสคริ', 'critChance', true),
  metric('critDamage', 'แรงคริ', 'critDamage', true),
  metric('attackSpeed', 'ลดช่วงโจมตี', 'attackSpeed', true),
  metric('cooldownCut', 'ลดคูลดาวน์', 'cooldownCut', true),
  metric('castSpeed', 'ลดเวลาร่าย', 'castSpeed', true),
  metric('mpCostMul', 'MP ที่ใช้', 'mpCostMul', true, true),
  metric('healPow', 'พลังรักษา', 'healPow', true),
  ...['str', 'agi', 'vit', 'int', 'dex', 'luk'].map(key => metric(key, key.toUpperCase(), c => c.stat(key))),
  metric('maxWeight', 'รับน้ำหนัก'),
]);
const snapshot = c => Object.fromEntries(EQUIPMENT_METRICS.map(m => [m.key, typeof m.read === 'function' ? m.read(c) : c[m.read]]));
const conditionalCards = item => (item?.cards ?? []).filter(id => ITEMS[id]?.special || Object.keys(ITEMS[id]?.bonus ?? {}).some(k => k.startsWith('vs_') || k.startsWith('res_')));

/** Read existing Character getters over isolated slot maps. No equip/constructor,
 * events, RNG, records, saves, sockets or live character writes are involved. */
export function previewEquipment(c, item) {
  const d = ITEMS[item?.id], slot = equipDestination(c, item?.id);
  if (d?.type !== 'equip' || d.retired || !EQUIP_SLOTS.includes(slot)) return null;
  const current = c.wornItem(slot);
  const why = !c.alive ? 'ต้องมีชีวิตอยู่จึงจะสวมใส่ได้'
    : !c.canWield(item.id) ? 'อาชีพนี้ใช้อาวุธนี้ไม่ได้'
      : c.level < (d.minLevel ?? 1) ? `ต้องการเลเวล ${d.minLevel}` : '';
  if (why) return { slot, current, why, rows: [] };
  const view = Object.create(c);
  view.equipment = { ...c.equipment, [slot]: item.id };
  view.cards = { ...c.cards, [slot]: [...(item.cards ?? [])] };
  view.refine = { ...c.refine, [slot]: item.plus ?? 0 };
  view.gearRolls = { ...c.gearRolls, [slot]: cleanRoll(item.id, item.roll) };
  const before = snapshot(c), after = snapshot(view);
  const rows = EQUIPMENT_METRICS.map(m => {
    const delta = +(after[m.key] - before[m.key]).toFixed(8);
    return { ...m, before: before[m.key], after: after[m.key], delta,
      direction: delta === 0 ? 0 : Math.sign(delta) * (m.lowerBetter ? -1 : 1) };
  });
  return { slot, current, why: '', rows,
    conditionalBefore: conditionalCards(current), conditionalAfter: conditionalCards(item) };
}

const number = value => String(+value.toFixed(2));
export function formatEquipmentValue(value, percent = false) {
  return `${number(value * (percent ? 100 : 1))}${percent ? '%' : ''}`;
}
export function formatEquipmentDelta(value, percent = false) {
  if (value === 0) return 'เท่าเดิม';
  return `${value > 0 ? '+' : '−'}${number(Math.abs(value) * (percent ? 100 : 1))}${percent ? ' จุด%' : ''}`;
}
