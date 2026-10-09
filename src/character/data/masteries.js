// Permanent, flat class-school bonuses. Only a matching advanced quest grants one.
const school = (classId, name, bonus, bonusText) => Object.freeze({
  id: `school_${classId}`, classId, questId: `class_${classId}_advanced`,
  name: `วิชาสำนัก · ${name}`, bonus: Object.freeze(bonus), bonusText,
});

export const MASTERIES = Object.freeze(Object.fromEntries([
  school('muaythai', 'ใจนักมวย', { atk: 3 }, 'ATK +3 ถาวร'),
  school('warrior', 'ยืนหยัดพิทักษ์', { hp: 30 }, 'HP สูงสุด +30 ถาวร'),
  school('hunter', 'สายตาพราน', { atk: 3 }, 'ATK +3 ถาวร'),
  school('shaman', 'อักขระคุ้มขวัญ', { matk: 3 }, 'MATK +3 ถาวร'),
  school('herbalist', 'ตำรับหมอหลวง', { matk: 3 }, 'MATK +3 ถาวร'),
  school('assassin', 'ก้าวเงาพิทักษ์', { atk: 3 }, 'ATK +3 ถาวร'),
].map(m => [m.id, m])));

export function cleanMasteries(classId, flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
  return Object.fromEntries(Object.values(MASTERIES)
    .filter(m => m.classId === classId && Object.hasOwn(flags, m.id) && flags[m.id] === true)
    .map(m => [m.id, true]));
}

// Add atk/matk to derived patk/matk, and hp to derived maxHp AFTER computeDerived.
// This keeps the advertised bonuses flat, independent of VIT and stat multipliers.
export function masteryBonus(classId, flags) {
  const bonus = {};
  for (const id of Object.keys(cleanMasteries(classId, flags))) {
    for (const [key, value] of Object.entries(MASTERIES[id].bonus)) bonus[key] = (bonus[key] ?? 0) + value;
  }
  return bonus;
}

export function masteryForQuest(q, classId) {
  const id = q?.rewards?.mastery;
  if (typeof id !== 'string' || !Object.hasOwn(MASTERIES, id)) return null;
  const m = MASTERIES[id];
  return m.classId === classId && q.classId === classId && q.id === m.questId ? m : null;
}
