// Enemy spawn points inside the forest map (±25). Kept west of the river
// (x < ~12), clear of landmarks (chedi -5.4,-7.4 · pavilion 9,-7 · shrine -12,6)
// and at least ~6 units from the player start. If a point turns out to be
// blocked (trees are placed procedurally), the combat core nudges it to the
// nearest standable spot.
export const PLAYER_START = { x: 1.4, z: 3 };
export const PLAYER_RESPAWN_DELAY = 5;

export const spawns = [
  // ลิงป่า — passive troop on the near (south) side of the path
  { enemy: 'ling-pa', x: -5.5, z: 10.5 },
  { enemy: 'ling-pa', x: -8.5, z: 13.5 },
  { enemy: 'ling-pa', x: -2.5, z: 14.5 },
  { enemy: 'ling-pa', x: 7.5, z: 10 },
  // ผีป่า — haunting the western woods beyond the shrine
  { enemy: 'phi-pa', x: -15.5, z: -1.5 },
  { enemy: 'phi-pa', x: -17, z: -10 },
  { enemy: 'phi-pa', x: -11, z: -16 },
  // เสือสมิง — elite prowling the far north clearing
  { enemy: 'suea-saming', x: 3.5, z: -17.5 },
];
