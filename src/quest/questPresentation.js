import { ITEMS } from '../character/data/items.js';
import { CLASSES } from '../character/data/classes.js';
import { KIT_MOVES } from '../character/data/kits.js';
import { SKILLS } from '../combat/data/skills.js';
import { MASTERIES } from '../character/data/masteries.js';
import { MONSTERS } from '../combat/data/monsters.js';
import { landmark } from '../data/landmarks.js';
import { NPCS } from '../data/npcs.js';

export const npcName = id => NPCS.find(n => n.id === id)?.name ?? id;
const skillName = id => Object.values(KIT_MOVES).flat().find(s => s.id === id)?.name ?? SKILLS[id]?.name ?? id;
export const escapeQuestText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function describeObjective(o) {
  if (o.discover) return `สำรวจ${landmark(o.discover)?.name ?? o.discover}`;
  if (o.kill) return `ปราบ${MONSTERS[o.kill]?.name ?? o.kill}`;
  if (o.practice) {
    const name = o.practice.length === 1 ? skillName(o.practice[0]) : 'วิชาที่เรียนแล้วของสำนัก';
    return `ฝึก${name}ขณะต่อสู้`;
  }
  if (o.combo) return `คอมโบ ${o.combo.skills.map(skillName).join(' + ')} ให้โดนภายใน ${o.combo.seconds} วิ`;
  if (o.collect) return `เก็บ${ITEMS[o.collect]?.name ?? o.collect}`;
  if (o.talk) return `คุยกับ${npcName(o.talk)}`;
  return '';
}

export function rewardText(r = {}) {
  const m = Object.hasOwn(MASTERIES, r.mastery ?? '') ? MASTERIES[r.mastery] : null;
  return [r.gold && `${r.gold} ทอง`, r.exp && `${r.exp} EXP`,
    ...(r.items ?? []).map(([id, qty = 1]) => `${ITEMS[id]?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`),
    m && `${m.name} (${m.bonusText} · ไม่ใช้แต้มสกิล)`,
  ].filter(Boolean).join(' · ');
}

export function requirementText(q, defs) {
  return [q.classId && CLASSES[q.classId]?.name, `Lv ${q.minLevel ?? 1}`,
    q.minJobLevel && `Job ${q.minJobLevel}`,
    ...(q.requires ?? []).map(id => `ผ่าน “${defs.get(id)?.title ?? id}”`),
  ].filter(Boolean).join(' · ');
}

export function lockedReason(q, quests) {
  return quests.requirementFailures(q).map(r => {
    if (r.kind === 'level') return `ต้องถึง Lv ${r.need}`;
    if (r.kind === 'job') return `ต้องถึง Job ${r.need}`;
    if (r.kind === 'quest') return `ส่งเควส “${quests.defs.get(r.id)?.title ?? r.id}” ก่อน`;
    if (r.kind === 'class') return `สำหรับ${CLASSES[r.classId]?.name ?? r.classId}`;
    return 'เลือกตัวละครก่อน';
  }).join(' · ');
}
