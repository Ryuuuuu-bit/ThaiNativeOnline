import * as THREE from 'three';

// Clean up the retained rectangular NPC blade without moving its grip or
// changing its envelope. +X is the thin cutting edge; -X is the thick spine.
export function beveledBlade(width, thickness, length) {
  if (![width, thickness, length].every(v => Number.isFinite(v) && v > 0)) throw Error('Positive blade dimensions required');
  const section = [[-width / 2, -thickness / 2], [-width / 2, thickness / 2],
    [width * .12, thickness * .45], [width / 2, 0], [width * .12, -thickness * .45]];
  const rings = [-length / 2, length * .38].map(z => section.map(([x, y]) => [x, y, z]));
  const tip = [-width * .2, 0, length / 2], positions = [], colours = [];
  const triangle = (a, b, c, tone) => {
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colours.push(tone, tone, tone);
  };
  for (let i = 0; i < section.length; i++) {
    const j = (i + 1) % section.length, tone = i === 2 || i === 3 ? 1 : .76;
    triangle(rings[0][i], rings[1][j], rings[0][j], tone);
    triangle(rings[0][i], rings[1][i], rings[1][j], tone);
    triangle(rings[1][i], tip, rings[1][j], tone);
    triangle(rings[0][i], rings[0][j], [0, 0, -length / 2], .65);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}
