import * as THREE from 'three';
import { box, cyl, ball, beam, mesh } from './Architecture.js';
import { createRng } from './rng.js';

const bambooLeaf = new THREE.BufferGeometry();
bambooLeaf.setAttribute('position', new THREE.Float32BufferAttribute([
  -.6, 0, 0, 0, .025, -.09, .7, 0, 0, 0, -.025, .09,
], 3));
bambooLeaf.setIndex([0, 1, 2, 0, 2, 3]);
bambooLeaf.computeVertexNormals();

// A small shared kit, with different material and silhouette choices per habitat.
// Dressing stays within the existing obstacle footprint: decoration must never
// create an invisible server wall or narrow a hunting approach.
export function expeditionArt(map) {
  const mat = color => new THREE.MeshLambertMaterial({ color });
  return {
    bark: mat(map.scenery === 'bamboo' ? '#53634c' : '#71563f'),
    leaves: new THREE.MeshLambertMaterial({ color: map.scenery === 'bamboo' ? '#47735b' : '#587b62', side: THREE.DoubleSide }),
    tips: mat(map.scenery === 'bamboo' ? '#7c9462' : '#97b481'),
    dark: mat(map.scenery === 'rift' ? '#554353' : '#555b58'),
    cloth: mat(map.scenery === 'rift' ? '#9276a0' : '#a77950'),
  };
}

export function vegetation(parent, palette, x, y, z, scale, bamboo) {
  if (bamboo) {
    for (let j = 0; j < 3; j++) {
      const xx = x + (j - 1) * .28, height = (4.8 + j * .45) * scale;
      cyl(parent, palette.bark, xx, y + height / 2, z, .09, .13, height, 6);
      for (let n = 1; n < 6; n++) {
        const yy = y + n * height / 6;
        cyl(parent, palette.tips, xx, yy, z, .135, .135, .07, 6);
        if (n > 2) {
          const side = (n + j) % 2 ? 1 : -1;
          beam(parent, palette.bark, [xx, yy, z], [xx + side * scale, yy + .35, z + .25], .04);
          for (let k = 0; k < 5; k++) {
            const angle = k * .65 + j * .4;
            mesh(parent, bambooLeaf, k % 2 ? palette.leaves : palette.tips,
              xx + side * (.55 + k * .12) * scale, yy + .4 + k * .035,
              z + .25 + (k - 2) * .13, scale, scale, scale,
              angle, k % 2 ? .35 : -.3);
          }
        }
      }
    }
  } else {
    cyl(parent, palette.bark, x, y + 2.3 * scale, z, .24, .45, 4.6 * scale, 7);
    for (let j = 0; j < 3; j++) {
      const angle = j * Math.PI * 2 / 3;
      const xx = x + Math.cos(angle) * scale, zz = z + Math.sin(angle) * scale;
      beam(parent, palette.bark, [x, y + 2.4 * scale, z], [xx, y + 4 * scale, zz], .12);
      ball(parent, j === 1 ? palette.tips : palette.leaves, xx, y + (4 + j * .4) * scale, zz, 1.8 * scale, 1.25 * scale, 1.6 * scale);
    }
  }
}

export function dressObstacle(parent, map, palette, stone, trim, wood, x, y, z, scale, index) {
  if (map.scenery === 'mine') {
    // Braced cut stone and stacked timbers, not another generic crystal field.
    box(parent, wood, x, y + .35, z, scale * 2.2, .3, .35, .15);
    box(parent, wood, x, y + .7, z, scale * 1.7, .3, .35, -.12);
    if (index % 4 === 0) box(parent, trim, x, y + 1.5 * scale, z + scale * .9, .3, .75, .18, .3);
  } else if (map.scenery === 'water') {
    // Water-worn base and algae bands imply the old basin without fake water physics.
    cyl(parent, stone, x, y + .15, z, .85, 1, .3, 10);
    cyl(parent, palette.leaves, x, y + .38, z, .58, .65, .12, 10);
  } else if (map.scenery === 'fort') {
    box(parent, palette.dark, x, y + 1, z, .7, 1.8, .7);
    box(parent, trim, x, y + 2.05, z, .85, .22, .85);
  } else if (map.scenery === 'ruins') {
    for (let j = 0; j < 3; j++) box(parent, stone, x + (j - 1) * .45, y + .16, z, .4, .3, .6, j * .4);
    if (index % 3 === 0) box(parent, palette.dark, x, y + 1.5, z + .46, .2, 1.7, .05, .4);
  } else if (map.scenery === 'valley') {
    box(parent, palette.dark, x, y + scale, z + scale * 1.1, scale * .7, .22, .15, -.2);
    box(parent, trim, x, y + scale * 1.4, z + scale * .9, .12, .55, .12, .2);
  } else if (map.scenery === 'rift') {
    // Split, offset mineral seams. Muted violet keeps monsters and VFX readable.
    for (let j = 0; j < 2; j++) box(parent, palette.cloth, x + (j - .5) * .5, y + (1.4 + j * .5) * scale, z + .8 * scale, .13, .9 * scale, .16, 0, 0, -.25);
  }
}

export function paintExpeditionGround(canvas, map, camps) {
  const g = canvas.getContext('2d'), size = canvas.width, r = map.view;
  const rng = createRng(4710 + map.index);
  const tx = x => (x - r.minX) / (r.maxX - r.minX) * size;
  const tz = z => (z - r.minZ) / (r.maxZ - r.minZ) * size;
  g.fillStyle = map.ground; g.fillRect(0, 0, size, size);
  // Broad low-contrast washes give the terrain depth before fine marks.
  for (let i = 0; i < 150; i++) {
    const x = rng() * size, z = rng() * size, radius = rng.range(16, 66);
    const wash = g.createRadialGradient(x, z, 0, x, z, radius);
    wash.addColorStop(0, i % 2 ? '#c3bd8d22' : '#303f3828'); wash.addColorStop(1, '#00000000');
    g.fillStyle = wash; g.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  }
  const path = () => {
    g.beginPath();
    for (const x of [-76, 0, 76]) {
      // Round corners soften the repeated loops without changing their geography.
      g.roundRect(tx(x - 17), tz(map.top - 183), tx(x + 17) - tx(x - 17), tz(map.top - 55) - tz(map.top - 183), 16);
    }
    for (const z of [map.top - 40, map.top - 195]) { g.moveTo(tx(-93), tz(z)); g.lineTo(tx(93), tz(z)); }
    g.moveTo(tx(0), tz(map.top)); g.lineTo(tx(0), tz(map.top - 240));
  };
  // Feathered shoulders instead of a single opaque yellow stripe.
  g.lineJoin = g.lineCap = 'round'; g.strokeStyle = map.accent;
  for (const [width, alpha] of [[29, .06], [23, .09], [17, .13], [11, .16], [6, .12]]) {
    g.lineWidth = width; g.globalAlpha = alpha; path(); g.stroke();
  }
  g.globalAlpha = 1;
  for (const camp of camps) {
    const x = tx(camp.x), z = tz(camp.z), radius = 29;
    const clearing = g.createRadialGradient(x, z, 0, x, z, radius);
    clearing.addColorStop(0, '#b9a98a25'); clearing.addColorStop(1, '#00000000');
    g.fillStyle = clearing; g.fillRect(x - radius, z - radius, radius * 2, radius * 2);
  }
  // Small strokes hint at leaf litter / worn stone, without noisy tiled textures.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = i % 2 ? '#ffffff0a' : '#26352d13';
    g.fillRect(rng() * size, rng() * size, rng.range(1, 5), rng.range(.5, 2));
  }
  return canvas;
}
