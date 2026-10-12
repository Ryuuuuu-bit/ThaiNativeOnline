// Frozen construction anchors for the old city silhouette in wilderness
// backdrops. Moving a gameplay POI must not alter the seeded world occupancy.
const sites = {
  forge: { x:-28,z:64 }, enhance:{x:-48,z:92},general:{x:-9,z:62},
  herbalist:{x:10,z:65},occult:{x:10,z:86},city_pillar:{x:8,z:-37},
};
export const landmark = id => sites[id];
