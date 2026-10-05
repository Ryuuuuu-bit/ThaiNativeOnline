// Drifting pollen motes and falling leaves.
import * as THREE from 'three';
import { range, between } from './rng.js';
import { mat } from './materials.js';
import { windUniforms } from './wind.js';
import { atmosphere as data } from './data/scenery.js';
import { palette } from './data/palette.js';

function moteTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d');
  const [inner, mid, outer] = palette.moteGlow;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, inner); gradient.addColorStop(.2, mid); gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

export function makeAtmosphere(scene) {
  const m = data.motes, leafCount = data.fallingLeaves;
  const positions = [], phases = [];
  for (let i = 0; i < m.count; i++) { positions.push(between(m.xRange), between(m.yRange), between(m.zRange)); phases.push(range(0, Math.PI * 2)); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ map: moteTexture(), color: palette.mote, size: .14, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(particles);
  const leafGeo = new THREE.PlaneGeometry(.12, .22);
  const leaves = new THREE.InstancedMesh(leafGeo, mat(palette.fallingLeaf, { side: THREE.DoubleSide, transparent: true, opacity: .75 }), leafCount);
  scene.add(leaves);
  const leafDummy = new THREE.Object3D();
  return {
    particles, leaves,
    update(time, dt) {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) + dt * (.1 + windUniforms.uWind.value * .35); if (x > m.wrapAt) x = m.wrapTo;
        p.setX(i, x); p.setY(i, positions[i * 3 + 1] + Math.sin(time * .5 + phases[i]) * .2);
      }
      p.needsUpdate = true;
      for (let i = 0; i < leafCount; i++) {
        const phase = phases[i], cycle = (time * .2 + phase) % 8;
        leafDummy.position.set(positions[i * 3] + cycle * windUniforms.uWind.value, 6 - cycle * .75, positions[i * 3 + 2] + Math.sin(cycle + phase));
        leafDummy.rotation.set(cycle, phase + time * .3, Math.sin(time + phase)); leafDummy.updateMatrix(); leaves.setMatrixAt(i, leafDummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
    },
  };
}
