// Shared offline/server kill rolls. Content owns tables; the server owns online instances.
import { LOOT } from './data/loot.js';
import { equipmentPool, equipmentDropChance } from './data/equipment-loot.js';
import { ITEMS } from '../character/data/items.js';
import { rollEquipment, rollFields } from '../character/data/affixes.js';
import { createFlask, instanceId } from '../character/data/flasks.js';
import { bossFlaskPool, BOSS_FLASK_DROP_CHANCE } from './data/boss-flask-loot.js';

export function rollLootDrops(def, { random = Math.random, uuid, multiplier = 1, level = def.level } = {}) {
  const drops = [], mul = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 0;
  const add = (id, qty) => {
    if (ITEMS[id]?.type === 'equip') {
      for (let i = 0; i < qty; i++) {
        const roll = rollEquipment(id, { level, random, ...(uuid ? { uuid } : {}) });
        drops.push({ id, qty: 1, ...rollFields({ id, roll }) });
      }
    } else if (ITEMS[id]?.type === 'flask') {
      for (let i = 0; i < qty; i++) drops.push(createFlask(id, uuid ? { uuid } : {}));
    } else drops.push({ id, qty });
  };
  // Draw all legacy outcomes first: affix draws cannot change another legacy row's rate.
  const legacy = [];
  for (const [id, chance, min, max] of LOOT[def.loot] ?? [])
    if (random() < Math.min(1, chance * mul)) legacy.push([id, min + Math.floor(random() * (max - min + 1))]);
  const pool = equipmentPool({ ...def, level }).filter(x => ITEMS[x.id]?.type === 'equip' && Number.isFinite(x.weight) && x.weight > 0);
  let extra = null;
  if (pool.length && random() < Math.min(1, equipmentDropChance(def) * mul)) {
    let pick = random() * pool.reduce((n, x) => n + x.weight, 0);
    extra = pool.at(-1).id;
    for (const x of pool) { pick -= x.weight; if (pick < 0) { extra = x.id; break; } }
  }
  for (const [id, qty] of legacy) add(id, qty);
  if (extra) add(extra, 1);
  const flasks = bossFlaskPool(def, level);
  if (flasks.length && random() < Math.min(1, BOSS_FLASK_DROP_CHANCE * mul)) {
    let pick = random() * flasks.reduce((sum, row) => sum + row.weight, 0);
    let id = flasks.at(-1).id;
    for (const row of flasks) { pick -= row.weight; if (pick < 0) { id = row.id; break; } }
    add(id, 1);
  }
  return drops;
}

// A server bag failure identifies an instance, or one legacy stack occurrence.
export function keptLootDrops(drops, lost = []) {
  const pending = [...lost];
  return drops.filter(d => {
    const i = pending.findIndex(l => instanceId(d) ? instanceId(l) === instanceId(d) : !instanceId(l) && l.id === d.id && l.qty === d.qty);
    if (i < 0) return true;
    pending.splice(i, 1); return false;
  });
}
