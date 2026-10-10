import { ITEMS, RARITY_COLORS } from './data/items.js';
import { cleanRoll, rollName } from './data/affixes.js';

export const instanceRoll = item => cleanRoll(item?.id, item?.roll);
export const instanceColor = item => {
  const roll = instanceRoll(item);
  return roll ? (roll.rarity === 'rare' ? '#ecd078' : '#8dbcf0') : RARITY_COLORS[ITEMS[item?.id]?.rarity] ?? '#8d8a78';
};
export const instanceName = item => {
  if (!item) return '';
  const name = rollName(item.id, item.roll);
  return `${item.plus ? `+${item.plus} ` : ''}${name}${ITEMS[item.id]?.type === 'equip' && ITEMS[item.id]?.slots ? ` [${ITEMS[item.id].slots}]` : ''}`;
};
export const instanceQuality = item => {
  const d = ITEMS[item?.id];
  if (d?.type === 'flask' && item?.flask) return `ขั้น ${d.flask.tier} · ฟื้น ${d.flask.kind.toUpperCase()} ${d.flask.recovery} · ประจุ ${item.flask.charges}/${d.flask.maxCharges}`;
  const roll = instanceRoll(item);
  return roll ? `${roll.rarity === 'rare' ? 'ออฟหายาก' : 'ออฟเวทมนตร์'} · ระดับไอเทม ${roll.level}` : '';
};
