import { HALLS } from '../src/data/halls.js';
import { CLASS_MASTERS } from '../src/data/quests.js';
import { nearNpc, SHOP_RANGE } from '../src/data/shopSites.js';
import { cleanMasteries, masteryForQuest } from '../src/character/data/masteries.js';
import { SKILLS } from '../src/combat/data/skills.js';

const countedCasts = new WeakSet();
const countedHits = new WeakSet();

// The hall builder owns these exact positions. Do not authorize client coordinates
// or assume all class masters stand at the shared practice yard.
export const CLASS_MASTER_SITES = Object.freeze(Object.fromEntries(HALLS.map(h => [
  CLASS_MASTERS[h.classId], Object.freeze({ map: 'city', x: h.master.x, z: h.master.z }),
])));

export function nearQuestNpc(npcId, here) {
  if (typeof npcId !== 'string' || !here || !Number.isFinite(here.x) || !Number.isFinite(here.z)) return false;
  if (Object.hasOwn(CLASS_MASTER_SITES, npcId)) {
    const s = CLASS_MASTER_SITES[npcId];
    return here.map === s.map && Math.hypot(here.x - s.x, here.z - s.z) <= SHOP_RANGE;
  }
  return nearNpc(npcId, here.map, here.x, here.z);
}

// Invoke from Combatants.op before generic applyOp. null means another system
// owns the op; false means a quest request was rejected. Progress comes only
// from server kill rewards, the server bag, and near-NPC talks, never msg fields.
export function applyQuestOp(c, msg, quests, here) {
  if (!['quest_accept', 'quest_complete', 'talk'].includes(msg?.op)) return null;
  if (!c || c.alive === false || !quests || quests.character !== c) return false;
  if (msg.op === 'talk') {
    if (!nearQuestNpc(msg.npc, here)) return false;
    quests.onTalk(msg.npc); return true;
  }
  if (typeof msg.id !== 'string') return false;
  const q = quests.defs.get(msg.id);
  if (!q || !nearQuestNpc(msg.op === 'quest_complete' ? quests.turnInOf(q) : q.giver, here)) return false;
  return msg.op === 'quest_accept' ? quests.accept(q.id) : quests.complete(q.id);
}

// Call on authoritative load after questsFor. Stored mastery flags must agree
// with matching, server-stored completed quests. Old completed quests backfill
// their flag; unsigned/local state is never passed to this function online.
export function reconcileQuestMasteries(c, quests) {
  const before = JSON.stringify(c.masteries ?? {}), next = {};
  for (const q of quests.defs.values()) {
    const m = masteryForQuest(q, c.classId);
    if (m && quests.status(q.id) === 'done' && !quests.requirementFailures(q).length) next[m.id] = true;
  }
  c.masteries = cleanMasteries(c.classId, next);
  return before !== JSON.stringify(c.masteries);
}

// Invoke once at the successful end of Combatants.cast. Its actual cast record
// exists only after class/learned-skill/cooldown/cast-time/MP checks have passed.
// No network op can supply that object; WeakSet prevents counting it twice.
export function recordQuestCast(combatants, playerId, skillId, acceptedAt) {
  const s = combatants.get(playerId);
  if (!s?.persist || !s.quests || s.quests.character !== s.c || !s.c.alive) return false;
  const cast = s.casts.at(-1);
  if (!Number.isFinite(acceptedAt) || !cast || cast.skill !== skillId || cast.at !== acceptedAt || countedCasts.has(cast)) return false;
  countedCasts.add(cast);
  if (!combatants.fighting(playerId)) return false;
  const learnt = cast.kit ? s.c.kitSkills.includes(skillId) && s.c.skillLevel(skillId) > 0
    : s.c.cls.skills.includes(skillId) && SKILLS[skillId] && !SKILLS[skillId].basic;
  if (!learnt || !s.quests.onPracticeCast(skillId)) return false;
  s.dirty = true;
  s.questPracticeChanged = true; // parent sends one acknowledged sync and clears it
  return true;
}

// Invoke in Combatants.strike after perTarget rejection, BEFORE land removes HP.
// That path is reached only by blow's live-target/range/cast/blow-budget checks.
// r is the server roll, never the browser packet. Multi-hit/AoE casts count once.
export function recordQuestSkillHit(combatants, playerId, cast, monster, r, castWindow = 6) {
  const s = combatants.get(playerId), now = combatants.now();
  if (!s?.persist || !s.quests || s.quests.character !== s.c || !s.c.alive || !cast || !s.casts.includes(cast)
    || now < cast.at || now - cast.at >= castWindow || !monster || !(monster.hp > 0) || r?.hit !== true || !Number.isFinite(r.dmg) || !(r.dmg > 0)
    || countedHits.has(cast)) return false;
  const learnt = cast.kit ? s.c.kitSkills.includes(cast.skill) && s.c.skillLevel(cast.skill) > 0
    : s.c.cls.skills.includes(cast.skill) && SKILLS[cast.skill] && !SKILLS[cast.skill].basic;
  if (!learnt) return false;
  countedHits.add(cast);
  if (!s.quests.onVerifiedSkillHit(cast.skill, now)) return false;
  s.dirty = true; s.questPracticeChanged = true;
  return true;
}
