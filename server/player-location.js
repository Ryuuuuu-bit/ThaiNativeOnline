import { MAPS } from '../src/world/maps.js';

// Every durable save, including inventory transactions, uses the server's
// current layout revision so reconnecting never re-migrates a current position.
export function snapshotLocation(player) {
  if (!player) return null;
  const layoutRevision = MAPS[player.map]?.layoutRevision;
  return { map: player.map, x: player.x, z: player.z, facing: player.f,
    ...(layoutRevision ? { layoutRevision } : {}) };
}
