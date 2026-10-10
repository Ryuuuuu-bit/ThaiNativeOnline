import { ITEMS } from '../data/items.js';

// Fixed key positions resolve skill IDs back to the current class controller.
// Item bindings deliberately resolve the current bag each time, after sorting.
export function bindingController(base, character) {
  const bindings = character.hotbarBindings;
  const indices = bindings.map(b => b?.kind === 'skill' ? base.slots.findIndex(s => s.id === b.id) : -1);
  const skill = (i, method, fallback, ...args) => indices[i] >= 0 ? base[method]?.(indices[i], ...args) ?? fallback : fallback;
  return {
    slots: bindings.map((b, i) => b?.kind === 'skill' && indices[i] >= 0
      ? { ...base.slots[indices[i]], kind: 'skill', survival: base.slots[indices[i]].survival ?? base.kit?.skills?.[indices[i]]?.quick }
      : b?.kind === 'item' && ITEMS[b.id]
        ? { id: b.id, kind: 'item', name: ITEMS[b.id].name, item: ITEMS[b.id], desc: ITEMS[b.id].desc, cd: 0 }
        : { id: null, kind: 'empty', name: 'ช่องว่าง', cd: 0 }),
    get busy() { return base.busy; },
    cast(i, quiet = false) {
      const b = bindings[i];
      if (b?.kind === 'item') {
        if (quiet) return false;
        const index = character.inventory.findIndex(s => s?.id === b.id);
        return index >= 0 && character.useAt(index);
      }
      return skill(i, 'cast', false, quiet);
    },
    cooldown(i) { return skill(i, 'cooldown', [0, 0]); },
    usable(i) { return bindings[i]?.kind === 'item' ? character.alive && character.count(bindings[i].id) > 0 : skill(i, 'usable', false); },
    active(i) { return skill(i, 'active', false); },
    level(i) { return bindings[i]?.kind === 'skill' ? skill(i, 'level', undefined) : undefined; },
  };
}
