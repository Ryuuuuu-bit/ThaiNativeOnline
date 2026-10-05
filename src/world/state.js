// Mutable world state filled by buildWorld (no three.js).
export const obstacles = [];      // [{ x, z, radius }] blocks walking
export const treePositions = [];  // [{ x, z, radius }] canopy footprint (minimap)
export const animations = [];     // [{ object, phase, strength }] wind sway

export function resetState() { obstacles.length = 0; treePositions.length = 0; animations.length = 0; }
