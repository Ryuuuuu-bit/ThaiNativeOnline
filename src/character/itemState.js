import { flaskFields, instanceId } from './data/flasks.js';
import { availableSkillIds, cleanBindings } from './hotbarBindings.js';
import { ITEMS, EQUIP_SLOTS, slotKind } from './data/items.js';
import { sameCards, socketCards } from './data/cards.js';
import { plusOf, refinable } from './data/refine.js';
import { rollFields, validRollId } from './data/affixes.js';

// Lock is instance metadata, never an item-definition property or a preset setting.
export const isItemLocked = item => item?.locked === true;
export const lockFields = item => isItemLocked(item) ? { locked: true } : {};
export function cloneInstance(item) {
  if (!item) return null;
  const { roll, flask, ...rest } = item;
  return { ...rest, ...(item.cards ? { cards: [...item.cards] } : {}), ...lockFields(item), ...rollFields(item), ...flaskFields(item) };
}
export const gearReference = item => item ? { id: item.id, cards: [...(item.cards ?? [])], plus: item.plus ?? 0, ...(instanceId(item) ? {iid:instanceId(item)} : {}) } : null;
export const sameReference = (item, ref) => !!item && !!ref && item.id === ref.id && instanceId(item) === ref.iid && (item.plus ?? 0) === (ref.plus ?? 0) && sameCards(item.cards, ref.cards);
export const cleanEquipmentLocks = (equipment, locks) => Object.fromEntries(EQUIP_SLOTS.map(slot => [slot, !!equipment[slot] && locks?.[slot] === true]));

export const LOADOUT_COUNT = 3;
export const loadoutIndex = index => Number.isInteger(index) && index >= 0 && index < LOADOUT_COUNT;
export const loadoutName = (name, index) => (typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) : '') || `ชุด ${index + 1}`;
export const availableHotbarSkills = availableSkillIds;
export const cleanHotbar = cleanBindings;
export const hotbarOrder = c => cleanBindings(c,c.hotbar).filter(b => b?.kind === 'skill').map(b => b.id);
export function cleanLoadouts(c, input) {
  return Array.from({ length: LOADOUT_COUNT }, (_, index) => {
    const p = Array.isArray(input) ? input[index] : null;
    if (!p || typeof p !== 'object' || !p.equipment || typeof p.equipment !== 'object') return null;
    const equipment = {};
    for (const slot of EQUIP_SLOTS) {
      const ref = p.equipment[slot];
      if (ref == null) { equipment[slot] = null; continue; }
      const d = ITEMS[ref.id], cards = socketCards(ref.id, ref.cards, ITEMS);
      if (d?.type !== 'equip' || d.retired || d.slot !== slotKind(slot) || !c.canWield(ref.id)
        || !sameCards(cards, ref.cards) || !Number.isInteger(ref.plus ?? 0) || (ref.plus ?? 0) < 0 || (ref.plus ?? 0) > 10
        || (ref.plus && !refinable(d)) || (ref.iid !== undefined && !validRollId(ref.iid))) return null;
      equipment[slot] = { id: ref.id, cards, plus: plusOf(ref.plus), ...(ref.iid ? {iid:ref.iid} : {}) };
    }
    return { name: loadoutName(p.name, index), equipment, hotbar: cleanHotbar(c, p.hotbar) };
  });
}

// Plan over distinct owned instances. No mutations until every slot and bag return fits.
export function planLoadout(c, index, { fighting = c.inCombat, busy = false } = {}) {
  if (!loadoutIndex(index) || !c.loadouts[index]) return { ok: false, why: 'empty' };
  if (!c.alive) return { ok: false, why: 'dead' };
  if (fighting || busy) return { ok: false, why: 'combat' };
  const preset = c.loadouts[index], used = new Set(), chosen = {};
  const pool = [
    ...EQUIP_SLOTS.flatMap(slot => c.wornItem(slot) ? [{ slot, item: c.wornItem(slot) }] : []),
    ...c.inventory.flatMap((item, bagIndex) => ITEMS[item?.id]?.type === 'equip' ? [{ bagIndex, item }] : []),
  ];
  for (const slot of EQUIP_SLOTS) {
    const ref = preset.equipment[slot]; if (!ref) { chosen[slot] = null; continue; }
    const d = ITEMS[ref.id];
    if (!d || d.retired || d.slot !== slotKind(slot) || !c.canWield(ref.id) || c.level < (d.minLevel ?? 1)) return { ok: false, why: 'class' };
    const matches = entry => !used.has(entry) && entry.item.qty === 1 && sameReference(entry.item, ref);
    const entry = pool.find(entry => entry.slot === slot && matches(entry)) ?? pool.find(matches);
    if (!entry) return { ok: false, why: 'missing', item: ref.id };
    used.add(entry); chosen[slot] = cloneInstance(entry.item);
  }
  const inventory = c.inventory.map(cloneInstance);
  for (const entry of used) if (entry.bagIndex !== undefined) inventory[entry.bagIndex] = null;
  for (const entry of pool) if (entry.slot && !used.has(entry)) {
    const free = inventory.indexOf(null); if (free < 0) return { ok: false, why: 'bag_full' };
    inventory[free] = cloneInstance(entry.item);
  }
  return { ok: true, inventory, chosen, hotbar: cleanHotbar(c, preset.hotbar) };
}

// Display order changes only the controller indices; cooldowns and casts keep their skill identity.
export function orderedController(controller, order) {
  const ids = controller.slots.map(s => s.id);
  const indexes = [...new Set([...order.map(id => ids.indexOf(id)).filter(i => i >= 0), ...ids.map((_, i) => i)])];
  return {
    get slots() { return indexes.map(i => controller.slots[i]); },
    get busy() { return controller.busy; },
    get kit() { return controller.kit ? { ...controller.kit, skills: indexes.map(i => controller.kit.skills[i]) } : undefined; },
    cast: (i, quiet) => controller.cast(indexes[i], quiet),
    cooldown: i => controller.cooldown(indexes[i]),
    usable: i => controller.usable(indexes[i]),
    active: i => controller.active(indexes[i]),
    ...(controller.level ? { level: i => controller.level(indexes[i]) } : {}),
  };
}
