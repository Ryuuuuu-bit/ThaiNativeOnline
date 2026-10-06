import * as THREE from 'three';
import { BODY_PARTS } from './body/bodyParts.js';
import { GEAR_PARTS } from './body/gearParts.js';
import { computeFrames, straightRightArm } from './body/rig.js';
import { merge } from './body/shape.js';

// All NPCs share one instanced mesh per body part, garment or prop (about 45,
// independent of population size). Each part reads one of the NPC's frame
// matrices (src/npc/body/rig.js). Vertex colours carry hems, weaves and folds;
// the instance colour carries the NPC's own fabric and skin from its look.
export const PARTS = [...BODY_PARTS, ...GEAR_PARTS];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class NPCRenderer {
  constructor(scene, npcs) {
    this.npcs = npcs; this.parts = [];
    for (const npc of npcs) npc.straightArm = straightRightArm(npc.look);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, vertexColors: true });
    for (const def of PARTS) {
      const entries = [];
      for (const npc of npcs) if ((!def.when || def.when(npc.look)) && (!def.whenNpc || def.whenNpc(npc))) for (const frame of def.frames) entries.push({ npc, frame });
      if (!entries.length) continue;
      const mesh = new THREE.InstancedMesh(merge(def.geo()), material, entries.length);
      mesh.name = `npc:${def.name}`;
      entries.forEach((e, i) => mesh.setColorAt(i, new THREE.Color(def.color(e.npc.look, e.frame))));
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh); this.parts.push({ mesh, entries, dynamic: def.dynamic });
    }
  }
  dispose() {
    for (const { mesh } of this.parts) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.dispose(); }
    this.parts[0]?.mesh.material.dispose();
    this.parts = [];
  }
  update() {
    for (const npc of this.npcs) if (npc.shown && npc.dirty) computeFrames(npc);
    for (const part of this.parts) {
      const { mesh, entries, dynamic } = part;
      for (let i = 0; i < entries.length; i++) {
        const { npc, frame } = entries[i];
        mesh.setMatrixAt(i, npc.shown && (!dynamic || dynamic(npc)) ? npc.frames[frame] : ZERO);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const npc of this.npcs) npc.dirty = false;
  }
}
