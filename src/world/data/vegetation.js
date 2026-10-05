// Counts and layout rules for grass, trees, bamboo and rocks.
// NOTE: the order/number of random draws drives the seeded layout; changing
// counts or ranges here moves every tree, rock and obstacle after it.
export const grass = {
  count: 24000,
  xRange: [-27, 27], zRange: [-27, 27],
  pathClearance: 1.65,
  landmarkPadding: .65,
  // Rectangles kept clear so side paths and the central glade stay readable.
  clearings: [
    { minX: -7, maxX: 11, minZ: -8, maxZ: -5 },
    { minX: -13, maxX: 2, minZ: 5, maxZ: 7.5 },
  ],
  scale: [.45, 1.2], heightScale: [.7, 1.5],
  hue: [.19, .25], saturation: [.23, .38], lightness: [.27, .47],
  windAmplitude: .5,
};

export const trees = {
  fixed: [
    [-11, -10], [-14, -4], [-12, 1], [-15, 10], [-10, 12], [-8, 17], [-16, 17], [-17, -14], [-9, -16], [-2, -17],
    [5, -16], [11, -15], [13, -2], [10, 3], [12, 11], [7, 15], [2, 20], [-4, 23], [-20, 3], [-20, -6], [-20, 12],
    [-21, -19], [-14, -23], [-5, -24], [4, -24], [12, -22], [22, -14], [23, 0], [24, 12], [-23, 22], [13, 23],
  ],
  random: {
    attempts: 55,
    xRange: [-27, 26], zRange: [-27, 27],
    minPathDistance: 7, landmarkPadding: 4, minCenterDistance: 11,
  },
  scale: [.8, 1.35],
  height: [4.4, 6.2],
  canopyRadius: 2,      // treePositions radius (minimap), times scale
  trunkRadius: .6,      // obstacle radius, times scale
  roots: 5, branches: 5,
  leavesPerTree: 64, maxLeafInstances: 9000,
  leafHue: [.22, .3], leafSaturation: [.17, .32], leafLightness: [.24, .40],
  windAmplitude: .16, swayStrength: .012,
};

// Bamboo groves, native to the tropical setting.
export const bamboo = {
  groves: [[-7, 3], [8, -13], [-15, -8], [11, 14]],
  stalksPerGrove: 7, leavesPerStalk: 9,
  height: [2.8, 4.2],
  swayStrength: .022,
};

export const rocks = {
  attempts: 55,
  xRange: [-25, 14], zRange: [-24, 25],
  pathClearance: 2, landmarkPadding: 2,
  size: [.3, 1.05],
  mossEvery: 3,
};
