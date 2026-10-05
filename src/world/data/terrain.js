// Terrain, main path and river shape. Used by the pure height/water functions
// and by the terrain mesh + painted ground texture.
export const terrain = {
  size: 58,          // ground plane is size x size, centred on the origin
  segments: 100,
  noise: { ampA: .08, freqAX: .45, freqAZ: .3, ampB: .05, freqBZ: .8 },
  waterDepth: -.42,
  waterNoiseScale: .2,
};

// Main dirt path: x = amplitude * sin(z * frequency) + offset
export const path = { amplitude: 1.25, frequency: .18, offset: .9 };

// River centre line: x = center + sin(z * frequency) * amplitude; water starts
// shoreOffset units west of the centre line and extends to the map edge.
export const river = { center: 16.2, amplitude: 2, frequency: .16, shoreOffset: 2.2 };

// Painted ground texture.
export const terrainTexture = {
  resolution: 2048,
  speckles: 58000,
  speckleShade: [65, 128],
  speckleAlpha: [.08, .3],
  speckleRadiusX: [1, 16],
  speckleRadiusY: [1, 7],
  mainPath: { points: 120, width: 100 },
  // Side paths branch from the main path at `fromZ` and lead to landmarks.
  sidePaths: [
    { fromZ: -4, points: [[-2, -5], [-5.4, -7.4]], width: 60 },
    { fromZ: -6, points: [[4, -6], [9, -7]], width: 53 },
    { fromZ: 7, points: [[-4, 7], [-9, 6], [-12, 6]], width: 44 },
  ],
  pathSpeckles: 8500,
  pathSpeckleSpread: 1.65,
  pathSpeckleZ: [-29, 29],
};
