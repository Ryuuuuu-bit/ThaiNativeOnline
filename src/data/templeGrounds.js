// The temple grounds in นครอโยธยา, around the ordination hall at (-52,-43) whose door leads into
// ภายในอุโบสถ (src/world/ubosot.js). Pure data shared by the city build, the client and the server.
//
//   TEMPLE_GUARDIANS  ยักษ์วัด: Tripo giants standing on the hall's terrace either side of the
//                     front steps (drawn only: they stand inside the hall's solid box)
//   TEMPLE_BELL       หอระฆัง: F rings it; everyone in the city hears it (server/templeGrounds.js)
//   TEMPLE_BODHI      ต้นโพธิ์ผูกผ้า: F ties a wish cloth; recent wishes float over the tree
//
// TEMPLE_BELL and TEMPLE_BODHI are also `kit` reservations (compact-city-neighborhoods.js), so
// players, NPC routes and the server walk around them.

// the hall terrace's top, in world units (buildCityTemple.js tier at the front steps)
export const TEMPLE_TERRACE_Y = 1.07;

export const TEMPLE_GUARDIANS = Object.freeze([
  Object.freeze({ id: 'yak_w', variant: 'yak', x: -57.8, z: -37.1, y: TEMPLE_TERRACE_Y, w: 1.9, d: 1.9, front: 'south' }),
  Object.freeze({ id: 'yak_e', variant: 'yak', x: -46.2, z: -37.1, y: TEMPLE_TERRACE_Y, w: 1.9, d: 1.9, front: 'south' }),
]);

export const TEMPLE_BELL = Object.freeze({
  id: 'kit_bell_tower', label: 'หอระฆัง', x: -38.5, z: -37.5, w: 3.8, d: 3.8, front: 'south',
  range: 3.4,            // metres from the tower's edge a player may ring from
  playerCooldownMs: 20_000,
  cityCooldownMs: 4_000, // a ring heard citywide at most this often
  strikes: 3,
});

export const TEMPLE_BODHI = Object.freeze({
  id: 'kit_bodhi', label: 'ต้นโพธิ์ผูกผ้า', x: -29, z: -47.8, w: 4.8, d: 4.4, front: 'south',
  range: 3.2,
  maxLength: 40,         // characters in one wish
  keep: 24,              // wishes kept and shown over the tree
  playerCooldownMs: 60_000,
  lifeMs: 6 * 3600_000,  // a wish fades after six hours
});

export const templeReach = (site, x, z) =>
  Math.max(Math.abs(x - site.x) - site.w / 2, Math.abs(z - site.z) - site.d / 2, 0);
