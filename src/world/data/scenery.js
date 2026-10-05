// Ruins, water edge and ambient particle layout.

// Broken brick walls: [x, z, length, rotationY]
export const ruins = {
  walls: [[-8, -12, 8, 0], [-11, -8, 5, Math.PI / 2], [1, -14, 5, 0], [5, -12, 3, Math.PI / 2]],
  rows: 4, brickPitch: .52, missingPerRow: .17, mossChance: .15,
  rubblePerWall: 12, obstacleStep: .5, obstacleRadius: .42,
};

export const water = {
  segments: 100, surfaceY: -.045,
  shoreStones: { count: 130, zRange: [-27, 27], xOffset: [-.25, .1] },
  lilyPads: { count: 60, zRange: [-25, 25], xOffset: [-1.4, 3], radius: [.15, .35], flowerEvery: 4, petals: 7 },
};

export const atmosphere = {
  motes: { count: 230, xRange: [-23, 20], yRange: [.4, 6], zRange: [-23, 23], wrapAt: 22, wrapTo: -24 },
  fallingLeaves: 40,
};
