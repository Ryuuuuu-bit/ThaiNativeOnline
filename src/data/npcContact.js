import { activityFor } from '../npc/NPCSchedule.js';

export const CONTACT_PHASES = Object.freeze(['morning', 'day', 'evening', 'night']);

// Omitted phase is a daytime/offline compatibility default. An explicit invalid
// phase never chooses arbitrary schedule/prototype properties. Online callers
// supply the current server clock, not a phase copied from a browser packet.
export const contactPhase = phase => phase === undefined ? 'day'
  : CONTACT_PHASES.includes(phase) ? phase : null;

export function contactActivityFor(def, phase) {
  const current = contactPhase(phase);
  if (!def || !current) return null;
  const activity = activityFor(def, current);
  if (activity?.do === 'stay' && activity.at != null) return activity;
  if (activity?.do === 'route' && Array.isArray(activity.stops) && activity.stops.length) return activity;
  return null; // Home is hidden indoors and has no contact site.
}

// Only this phase's outdoor anchors, including string and object route stops.
// Named anchors carry their real map (e.g. the city herbalist visits paddy).
// Unknown anchors fail closed; no home or other phase's site is substituted.
export function contactSitesFor(def, phase, spots) {
  const activity = contactActivityFor(def, phase);
  if (!activity) return [];
  const anchors = activity.do === 'stay' ? [activity.at]
    : activity.stops.map(stop => typeof stop === 'string' ? stop : stop?.at);
  const sites = new Map();
  for (const at of anchors) {
    let site;
    if (at && typeof at === 'object') site = { map: def.map ?? 'city', x: at.x, z: at.z };
    else if (typeof at === 'string' && Object.hasOwn(spots, at)) {
      const [map, x, z] = spots[at]; site = { map, x, z };
    }
    if (site && Number.isFinite(site.x) && Number.isFinite(site.z)) {
      sites.set(JSON.stringify([site.map, site.x, site.z]), site);
    }
  }
  return [...sites.values()];
}
