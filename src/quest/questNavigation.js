// Read-only objective geography. Never accepts quests, travels, or grants progress.
import { NPCS } from '../data/npcs.js';
import { HALLS } from '../data/halls.js';
import { CLASS_MASTERS } from '../data/quests.js';
import { SPOT_SITES } from '../data/shopSites.js';
import { BESTIARY } from '../data/bestiary.js';
import { landmark } from '../data/landmarks.js';
import { MAPS, mapOf } from '../world/maps.js';
import { activityFor, normalizeStops } from '../npc/NPCSchedule.js';
import { nextPortal } from '../ui/mapDirectory.js';
import { newcomerJourney } from './newcomerJourney.js';
import { NEWCOMER_GUIDE } from '../data/newcomer-guide.js';
import { describeObjective, npcName, lockedReason } from './questPresentation.js';

const PHASE = { morning: 'เช้า', day: 'กลางวัน', evening: 'เย็น', night: 'กลางคืน' };
const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
const goal = (point, extra = {}) => finite(point) ? { x: point.x, z: point.z, ...extra } : null;
export function questNpcDestination(id, { map, phase = 'day', npcs = [], spots = {} } = {}) {
  const def = NPCS.find(n => n.id === id);
  if (!def) return { reason: 'ไม่พบตำแหน่งผู้รับเควส' };
  const live = npcs.find(n => n.id === id);
  if (live) return live.indoors ? { reason: `${def.name} พักในอาคาร · กลับมาในช่วงเปิดทำการ` }
    : { destination: goal(live, { map, name: def.name, npcId: id, near: 5 }) };
  const activity = activityFor(def, phase);
  if (activity.do === 'home') return { reason: `${def.name} พักในอาคาร · กลับมาในช่วงเปิดทำการ` };
  const hall = HALLS.find(h => CLASS_MASTERS[h.classId] === id);
  if (hall) return { destination: goal(hall.master, { map: 'city', name: def.name, npcId: id, near: 5 }) };
  const at = activity.at ?? normalizeStops(activity.stops ?? [])[0]?.at;
  const place = typeof at === 'object' ? goal(at, { map: def.map ?? 'city' })
    : finite(spots[at]) ? goal(spots[at], { map })
      : SPOT_SITES[at] ? { map: SPOT_SITES[at][0], x: SPOT_SITES[at][1], z: SPOT_SITES[at][2] } : null;
  return place ? { destination: { ...place, name: def.name, npcId: id, near: 5 } }
    : { reason: `${def.name} กำลังเดินตามตาราง · ดูตำแหน่งเมื่ออยู่ในแผนที่เดียวกัน` };
}

function huntDestination(objective, context) {
  const monsters = BESTIARY.filter(m => objective.kill ? m.id === objective.kill
    : !m.boss && !m.elite && m.drops.some(d => d.id === objective.collect && d.chance > 0));
  const candidates = monsters.flatMap(m => m.locations.map(location => ({ m, location })))
    .filter(({ location }) => (!location.phases.length || location.phases.includes(PHASE[context.phase ?? 'day']))
      && (!MAPS[location.map]?.nightOnly || context.phase === 'night')
      && (location.map === context.map || nextPortal(context.map, location.map)));
  const position = context.position ?? { x: 0, z: 0 };
  const score = ({ m, location }) => (location.map === context.map ? 0 : 100000)
    + (objective.hint?.includes(location.name) ? -10000 : 0) + m.level * 20
    + Math.hypot(location.x - position.x, location.z - position.z);
  candidates.sort((a, b) => score(a) - score(b));
  const selected = candidates[0];
  if (!selected) return { reason: monsters.length ? 'เป้าหมายไม่ปรากฏในช่วงเวลานี้ · ดูแหล่งล่าในคู่มือ' : 'ยังไม่มีแหล่งดรอปหรือจุดล่าที่เปิดใช้งาน · ดูรายละเอียดเควส' };
  const { m, location } = selected;
  return { destination: { ...location.approach, map: location.map, name: `${location.name} · ${m.name}`, monsterId: m.id, near: 10 } };
}

export function questObjective(quests, pinnedId = null, context = {}) {
  if (!quests.character) return null;
  const pinned = pinnedId && quests.defs.get(pinnedId);
  const q = pinned && quests.status(pinnedId) !== 'done' && quests.matchesClass(pinned)
    ? pinned : quests.active()[0] ?? newcomerJourney(quests, NEWCOMER_GUIDE)?.quest;
  if (!q || quests.status(q.id) === 'done') return null;
  const status = quests.status(q.id), complete = status === 'active' && quests.isComplete(q.id);
  const objectiveIndex = q.objectives.findIndex(o => { const p = quests.objectiveProgress(q, o); return p.have < p.need; });
  const objective = q.objectives[objectiveIndex];
  let text, progress = null, result;
  if (status !== 'active') {
    text = quests.canAccept(q) ? `รับเควสกับ${npcName(q.giver)}` : lockedReason(q, quests);
    result = quests.canAccept(q) ? questNpcDestination(q.giver, context) : { reason: text };
  } else if (complete) {
    text = `ส่งเควสกับ${npcName(quests.turnInOf(q))}`;
    result = questNpcDestination(quests.turnInOf(q), context);
  } else {
    text = describeObjective(objective ?? {});
    progress = objective && quests.objectiveProgress(q, objective);
    if (objective?.talk) result = questNpcDestination(objective.talk, context);
    else if (objective?.discover) { const l = landmark(objective.discover); result = { destination: goal(l, { map: l?.map ?? (l && mapOf(l.x, l.z)), name: l?.name, near: Math.min(l?.radius ?? 6, 10) }) }; }
    else if (objective?.kill || objective?.collect) result = huntDestination(objective, context);
    else result = { reason: objective?.hint ?? (objective?.combo ? 'ใช้สกิลคอมโบให้โดนระหว่างต่อสู้ · เลือกแหล่งล่าด้วยตนเอง' : 'ฝึกสกิลที่ระบุระหว่างต่อสู้ · เลือกแหล่งล่าด้วยตนเอง') };
  }
  let destination = result?.destination, step = destination;
  if (destination && destination.map !== context.map) {
    const portal = nextPortal(context.map, destination.map);
    step = portal && { ...portal.at, map: context.map, name: `${portal.name ?? 'ประตู'} → ${MAPS[portal.to]?.name ?? portal.to}`, portalId: portal.id, near: 1 };
    if (!step) result = { reason: 'ไม่มีเส้นทางประตูเชื่อมไปยังเป้าหมายนี้' };
  }
  return { quest: q, key: `${q.id}:${status}:${complete ? 'return' : objectiveIndex}`, status, complete, text, progress,
    destination, step, reason: result?.reason ?? (!step ? 'ไม่พบตำแหน่งที่ใช้งานได้' : ''), crossMap: !!destination && destination.map !== context.map };
}
