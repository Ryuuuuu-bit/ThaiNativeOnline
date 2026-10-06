// Monster spawn areas. The game is one map, นครอโยธยา, a safe city: there are
// no monster areas today. Format (for when monsters return):
//   SPAWNS: { id, monster, x, z, radius, active: [phases], max, boss? }
//   ROSTER[area id]: [{ type (src/combat/data/monsters.js), count?, respawn?, chance?, active? }]
// combatSpawns() turns both into zones for createGame({ spawns }).
export const SPAWNS = [];
export const activeSpawns = phase => SPAWNS.filter(s => s.active.includes(phase));

const ROSTER = {};

// Combat zones: each area keeps its position, radius and phases; ROSTER entries may narrow the phases.
export function combatSpawns() {
  const zones = [];
  for (const area of SPAWNS) for (const entry of ROSTER[area.id] ?? []) {
    zones.push({ x: area.x, z: area.z, radius: area.radius, area: area.id, active: entry.active ?? area.active, count: entry.count ?? area.max, ...entry });
  }
  return zones;
}
