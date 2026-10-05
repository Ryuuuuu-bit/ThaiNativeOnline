// Lotus canal along the east edge: shader water strip, shore stones, lily pads.
import * as THREE from 'three';
import { range, between } from './rng.js';
import { mat, materials } from './materials.js';
import { mesh } from './geometry.js';
import { windUniforms } from './wind.js';
import { shoreX, riverX } from './terrainMath.js';
import { terrain } from './data/terrain.js';
import { water as waterData } from './data/scenery.js';
import { palette } from './data/palette.js';

const vertexShader = `varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
const fragmentShader = `uniform float uTime;uniform vec3 uTint;varying vec3 vWorld;
    void main(){float wave=sin(vWorld.x*3.+vWorld.z*2.+uTime*.6)*sin(vWorld.z*5.-uTime*.7);float shimmer=pow(max(0.,wave),12.);float stripe=sin(vWorld.x*1.3+vWorld.z*.9+uTime*.25)*.03;vec3 col=uTint+vec3(stripe)+shimmer*vec3(.21,.21,.13);gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`;

function makeSurface(scene) {
  const half = terrain.size / 2, segs = waterData.segments, step = terrain.size / segs, y = waterData.surfaceY;
  const vertices = [], indices = [];
  for (let i = 0; i <= segs; i++) {
    const z = -half + i * step; vertices.push(shoreX(z), y, z, half, y, z);
    if (i < segs) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: windUniforms.uTime, uTint: { value: new THREE.Color(palette.waterTint) } }, side: THREE.DoubleSide,
    vertexShader, fragmentShader,
  });
  scene.add(new THREE.Mesh(geometry, material));
  return material;
}

function makeShore(scene) {
  // Shore stones and reeds soften the edge between land and water.
  const d = waterData.shoreStones;
  for (let i = 0; i < d.count; i++) {
    const z = between(d.zRange), x = shoreX(z) + between(d.xOffset);
    mesh(new THREE.DodecahedronGeometry(1, 0), materials.stone, scene, x, .02, z, [range(.1, .3), range(.08, .18), range(.15, .4)]);
  }
}

function makeLotus(scene) {
  const d = waterData.lilyPads;
  const padMaterial = mat(palette.lilyPad, { side: THREE.DoubleSide }), petalMaterial = mat(palette.lotusPetal);
  for (let i = 0; i < d.count; i++) {
    const z = between(d.zRange), x = riverX(z) + between(d.xOffset);
    const pad = mesh(new THREE.CircleGeometry(between(d.radius), 12), padMaterial, scene, x, .004, z); pad.rotation.x = -Math.PI / 2; pad.castShadow = false;
    if (i % d.flowerEvery === 0) {
      const flower = new THREE.Group(); flower.position.set(x, .045, z); scene.add(flower);
      for (let p = 0; p < d.petals; p++) {
        const a = p / d.petals * Math.PI * 2;
        const petal = mesh(new THREE.SphereGeometry(1, 7, 5), petalMaterial, flower, Math.cos(a) * .08, .06, Math.sin(a) * .08, [.04, .1, .045]);
        petal.rotation.z = Math.sin(a) * .6; petal.rotation.x = Math.cos(a) * .6;
      }
      mesh(new THREE.SphereGeometry(.045, 8, 6), materials.gold, flower, 0, .1, 0);
    }
  }
}

/** Returns the water ShaderMaterial (exposes `.uniforms.uTint` for time of day). */
export function makeWater(scene) {
  const material = makeSurface(scene);
  makeShore(scene);
  makeLotus(scene);
  return material;
}
