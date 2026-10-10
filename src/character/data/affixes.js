// Persistent equipment rolls. Loading validates saved values; it never rolls again.
import { ITEMS } from './items.js';

const all = ['weapon', 'armor', 'head', 'cape', 'shoes', 'gloves', 'belt', 'amulet', 'charm'];
const entry = (id, label, kind, key, step, slots = all, weapon) => Object.freeze({ id, label, kind, family: key, key, step, slots: Object.freeze([...slots]), weapon });
export const AFFIXES = Object.freeze([
  entry('force', 'ทรงพลัง', 'prefix', 'atk', 3, ['weapon'], 'physical'),
  entry('arcane', 'อาคม', 'prefix', 'matk', 3, ['weapon'], 'magic'),
  entry('guard', 'มั่นคง', 'prefix', 'def', 2, all.filter(s => s !== 'weapon')),
  entry('vital', 'พลังชีวิต', 'prefix', 'hp', 20),
  entry('spirit', 'พลังจิต', 'prefix', 'mp', 10),
  ...[['str','กำลัง'],['agi','ว่องไว'],['vit','อดทน'],['int','ปัญญา'],['dex','ชำนาญ'],['luk','โชค']].map(([key,label]) => entry(key, label, 'suffix', key, 1)),
  entry('aim', 'แม่นยำ', 'suffix', 'acc', 2),
  entry('evade', 'หลบหลีก', 'suffix', 'eva', 2),
  entry('critical', 'จุดตาย', 'suffix', 'crit', .005),
]);
// Unknown saved IDs must never resolve through Object.prototype.
const byId = Object.assign(Object.create(null), Object.fromEntries(AFFIXES.map(a => [a.id, a])));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validRollId = value => typeof value === 'string' && uuidPattern.test(value);
const eligible = (a, d) => a.slots.includes(d.slot) && (!a.weapon || (['book','talisman'].includes(d.weapon) ? 'magic' : 'physical') === a.weapon);
const maxTier = level => Math.min(5, 1 + Math.floor((level - 1) / 20));
const range = (a, tier) => ({ min: a.step * (2 * tier - 1), max: a.step * (2 * tier) });
const freezeRoll = r => Object.freeze({ ...r, affixes: Object.freeze(r.affixes.map(a => Object.freeze({ ...a }))) });

export function cleanRoll(id, roll) {
  const d = ITEMS[id];
  if (d?.type !== 'equip' || d.retired || !roll || roll.v !== 1 || !validRollId(roll.iid)
    || !Number.isInteger(roll.level) || roll.level < (d.minLevel ?? 1) || roll.level > 100
    || !['magic','rare'].includes(roll.rarity) || !Array.isArray(roll.affixes)) return null;
  const n = roll.affixes.length;
  if (roll.rarity === 'magic' ? n < 1 || n > 2 : n < 3 || n > 4) return null;
  const families = new Set(), counts = { prefix: 0, suffix: 0 }, affixes = [];
  for (const held of roll.affixes) {
    if (typeof held?.id !== 'string') return null;
    const a = byId[held?.id];
    if (!a || !eligible(a,d) || families.has(a.family) || ++counts[a.kind] > 2
      || !Number.isInteger(held.tier) || held.tier < 1 || held.tier > maxTier(roll.level) || !Number.isFinite(held.value)) return null;
    const { min, max } = range(a, held.tier);
    if (held.value < min - 1e-10 || held.value > max + 1e-10
      || (a.key !== 'crit' && !Number.isInteger(held.value))) return null;
    families.add(a.family); affixes.push({ id: a.id, tier: held.tier, value: held.value });
  }
  return freezeRoll({ v: 1, iid: roll.iid, level: roll.level, rarity: roll.rarity, affixes });
}

export function rollEquipment(id, { level = 1, random = Math.random, uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const d = ITEMS[id]; if (d?.type !== 'equip' || d.retired) return null;
  level = Math.max(d.minLevel ?? 1, Math.min(100, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1))));
  const rng = () => { const n = random(); if (!Number.isFinite(n) || n < 0 || n >= 1) throw new RangeError('Equipment RNG must return [0,1)'); return n; };
  const rarityRoll = rng(); if (rarityRoll < .65) return null;
  const rarity = rarityRoll < .92 ? 'magic' : 'rare', count = rarity === 'magic' ? 1 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2);
  const pool = AFFIXES.filter(a => eligible(a,d)), affixes = [], counts = { prefix: 0, suffix: 0 };
  while (affixes.length < count) {
    const available = pool.filter(a => counts[a.kind] < 2 && !affixes.some(b => byId[b.id].family === a.family));
    const a = available[Math.floor(rng() * available.length)], tier = 1 + Math.floor(rng() * maxTier(level)), { min, max } = range(a,tier);
    const value = a.key === 'crit' ? Math.round((min + rng() * (max-min)) * 10000) / 10000 : min + Math.floor(rng() * (max-min+1));
    affixes.push({ id:a.id, tier, value }); counts[a.kind]++;
  }
  const roll = cleanRoll(id,{v:1,iid:uuid(),level,rarity,affixes});
  if (!roll) throw new TypeError('Invalid equipment UUID or level');
  return roll;
}
export const rollFields = item => { const roll = cleanRoll(item?.id,item?.roll); return roll ? { roll } : {}; };
export function affixBonus(id, roll) {
  const result = {};
  for (const held of cleanRoll(id,roll)?.affixes ?? []) { const key = byId[held.id].key; result[key] = (result[key] ?? 0) + held.value; }
  return result;
}
export const affixLines = (id, roll) => (cleanRoll(id,roll)?.affixes ?? []).map(held => {
  const a = byId[held.id]; return { id:a.id,label:a.label,kind:a.kind,tier:held.tier,key:a.key,value:held.value,...range(a,held.tier) };
});
export function rollName(id, roll) {
  const lines = affixLines(id,roll), name = ITEMS[id]?.name ?? id;
  return lines.length ? `${lines.filter(a=>a.kind==='prefix').map(a=>a.label).join(' ')} ${name} ${lines.filter(a=>a.kind==='suffix').map(a=>`แห่ง${a.label}`).join(' ')}`.trim() : name;
}
