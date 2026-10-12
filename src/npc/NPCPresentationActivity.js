import { activityFor, normalizeStops } from './NPCSchedule.js';
import { hashString } from '../world/rng.js';
import { QUESTS, CLASS_MASTERS } from '../data/quests.js';

export function questContactIds(quests) {
  const ids = new Set(Object.values(CLASS_MASTERS));
  for (const q of quests) {
    if (q.giver) ids.add(q.giver);
    if (q.turnIn) ids.add(q.turnIn);
    for (const objective of q.objectives ?? []) if (objective.talk) ids.add(objective.talk);
  }
  return ids;
}
const questContacts = questContactIds(QUESTS);

// Authoritative contacts use activityFor directly. Only the city renderer's
// runtime plan consumes this optional daytime presentation, never save data.
export function presentationActivityFor(def, phase, protectedContacts = questContacts) {
  const activity = activityFor(def, phase);
  if (def.map !== 'city' || phase !== 'day' || activity.do === 'home'
    || def.shopType || def.trainer || def.warpService || def.storageService
    || def.faction || protectedContacts.has(def.id)) return activity;
  const visual = def.daytimeRoutine ?? activity;
  if (visual.do !== 'route') return visual;
  const stops = normalizeStops(visual.stops);
  if (!stops.length) return activity;
  // Spread routes at initial map load; residents never all start at one stop.
  // Rotation is deterministic and retains the route's cyclic order.
  const opening = stops.findIndex(s => s.at === visual.startAt);
  const offset = opening >= 0 ? opening : hashString(def.id) % stops.length;
  return { ...visual, stops: [...stops.slice(offset), ...stops.slice(0, offset)] };
}
