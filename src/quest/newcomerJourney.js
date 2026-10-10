// Journal recommendations are derived from real quest state, never tutorial flags.
import { classReady } from '../data/training.js';
import { NPCS } from '../data/npcs.js';
import { SPOT_SITES } from '../data/shopSites.js';
import { HUNTING_GROUNDS } from '../data/hunting.js';
import { HALLS } from '../data/halls.js';
import { CLASS_MASTERS } from '../data/quests.js';
export function newcomerJourney(quests, guide) {
  const c = quests.character;
  if (!c) return null;
  const level = c.level;
  const milestones = guide.map(step => {
    const ids = [...(step.questIds ?? []), ...(step.classStage && classReady(c.classId) ? [`class_${c.classId}_${step.classStage}`] : [])];
    const defs = ids.map(id => quests.defs.get(id)).filter(Boolean);
    return { ...step, defs, done: defs.length > 0 && defs.every(q => quests.status(q.id) === 'done') };
  });
  const step = milestones.find(s => !s.done && level >= s.minLevel && level <= (s.maxLevel ?? Infinity))
    ?? milestones.find(s => !s.done && level >= s.minLevel) ?? milestones[0];
  if (!step) return null;
  const quest = step.defs.find(q => quests.status(q.id) === 'active')
    ?? step.defs.find(q => quests.canAccept(q))
    ?? [...quests.defs.values()].find(q => !q.classId && (quests.status(q.id) === 'active' || quests.canAccept(q)))
    ?? step.defs.find(q => quests.status(q.id) !== 'done');
  return { level, milestones, step, quest };
}

export function newcomerDestination(quests, guide) {
  const q = newcomerJourney(quests, guide)?.quest;
  if (!q) return null;
  const objective = q.objectives.find(o => { const p=quests.objectiveProgress(q,o); return p.have<p.need; });
  const npcId = quests.status(q.id) !== 'active' ? q.giver : quests.isComplete(q.id) ? quests.turnInOf(q) : objective?.talk;
  if (npcId) {
    const npc=NPCS.find(n=>n.id===npcId);
    const hall=HALLS.find(h=>CLASS_MASTERS[h.classId]===npcId);
    if(hall)return {npcId,id:hall.id,name:npc?.name??npcId,map:'city',x:hall.master.x,z:hall.master.z};
    for (const activity of Object.values(npc?.schedule ?? {})) {
      const at=activity.at;
      if (at&&typeof at==='object') return {npcId,name:npc.name,map:npc.map??'city',x:at.x,z:at.z};
      if (SPOT_SITES[at]) { const [map,x,z]=SPOT_SITES[at];return {npcId,name:npc.name,map,x,z}; }
    }
  }
  if(objective?.kill) {
    const camps=HUNTING_GROUNDS.filter(c=>c.roster.some(r=>r.type===objective.kill));
    const camp=camps.find(c=>objective.hint?.includes(c.name))??camps[0];
    if(camp)return {...camp,id:`hunt:${camp.id}`};
  }
  return null;
}
