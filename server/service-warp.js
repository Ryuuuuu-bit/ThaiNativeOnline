import { getWarpService, getWarpDestination, WARP_RANGE, WARP_COOLDOWN } from '../src/data/warpServices.js';
import { MAPS } from '../src/world/maps.js';
import { navigation } from './navigation.js';

// Only IDs cross the trust boundary. The caller supplies server-owned player and
// combat state; the returned destination is an authored registry record.
export function serviceWarp(p, npcId, destinationId, {
  now = Date.now() / 1000, dead = false, fighting = false, duel = false, trade = false,
  navigate = navigation,
} = {}) {
  const no = why => ({ ok: false, why });
  if (!p) return no('offline');
  if (typeof npcId !== 'string') return no('npc');
  const service = getWarpService(npcId);
  if (!service) return no('npc');
  if (typeof destinationId !== 'string') return no('destination');
  const destination = getWarpDestination(destinationId);
  if (!destination || !Object.hasOwn(MAPS, destination.map)) return no('destination');
  if (p.dead || dead) return no('dead');
  if (fighting || duel || trade) return no('busy');
  if (p.map !== service.map) return no('map');
  if (![p.x, p.z, service.x, service.z].every(Number.isFinite) || Math.hypot(p.x - service.x, p.z - service.z) > WARP_RANGE) return no('far');
  if (!Number.isFinite(now) || now - (p.serviceWarpAt ?? -Infinity) < WARP_COOLDOWN) return no('cooldown');
  if (!navigate(service.map).clear(p, service, .05)) return no('blocked');
  if (![destination.x, destination.z, destination.facing].every(Number.isFinite) || !navigate(destination.map).canStand(destination.x, destination.z)) return no('blocked');
  return { ok: true, destination };
}

export function serviceWarpChannel(p, map, channels, counts) {
  if (map === p.map) return { ok: true, ch: p.ch };
  const ch = channels.pick(map, counts);
  return (counts[ch] ?? 0) >= channels.cap(map) ? { ok: false, why: 'full' } : { ok: true, ch };
}
