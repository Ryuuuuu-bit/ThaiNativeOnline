// Content data only: edit freely without touching game logic.
// Spawn zones in world coordinates of the forest prototype map.
// time: 'day' | 'night' | 'any', or active: [clock phases] (morning, day, evening, night). Day is wildlife; night brings ghosts, the
// shapeshifter tiger and a rare krasue that only sometimes appears.
export const DEFAULT_ZONES = [
  { type: 'boar', x: -8, z: 12, radius: 4, count: 3, time: 'day' },
  { type: 'monkey', x: 6, z: 12, radius: 4, count: 3, time: 'day' },
  { type: 'phibpa', x: -8, z: 12, radius: 4, count: 3, time: 'night' },
  { type: 'phibpa', x: 6, z: 12, radius: 4, count: 2, time: 'night' },
  { type: 'pray', x: -10, z: -12, radius: 4, count: 3, time: 'any' },
  { type: 'tiger', x: 5, z: -16, radius: 2, count: 1, respawn: 60, time: 'night' },
  { type: 'krasue', x: -14, z: -4, radius: 3, count: 1, respawn: 120, chance: .4, time: 'night' },
];

