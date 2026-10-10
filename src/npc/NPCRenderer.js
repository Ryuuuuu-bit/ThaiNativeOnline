import * as THREE from 'three';
import { BODY_PARTS } from './body/bodyParts.js';
import { GEAR_PARTS } from './body/gearParts.js';
import { computeFrames, straightRightArm } from './body/rig.js';
import { merge } from './body/shape.js';
import { NPCModelRenderer } from './NPCModelRenderer.js';

// All NPCs share one instanced mesh per body part, garment or prop (about 45,
// independent of population size). Each part reads one of the NPC's frame
// matrices (src/npc/body/rig.js). Vertex colours carry hems, weaves and folds;
// the instance colour carries the NPC's own fabric and skin from its look.
export const PARTS = [...BODY_PARTS, ...GEAR_PARTS];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class NPCRenderer {
  constructor(scene, npcs, { models = true, ...modelOptions } = {}) {
    this.npcs = npcs; this.parts = [];
    this.captureRenderCamera = !modelOptions.camera;
    for (const npc of npcs) npc.straightArm = straightRightArm(npc.look);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, vertexColors: true });
    for (const def of PARTS) {
      const entries = [];
      for (const npc of npcs) if ((!def.when || def.when(npc.look)) && (!def.whenNpc || def.whenNpc(npc))) for (const frame of def.frames) entries.push({ npc, frame });
      if (!entries.length) continue;
      const mesh = new THREE.InstancedMesh(merge(def.geo()), material, entries.length);
      // Capture the real render camera without coupling NPC simulation to Game.
      // Its position is read once on the following NPC update, not per mesh.
      mesh.onBeforeRender = (_, __, camera) => { if (this.captureRenderCamera) this.renderCamera = camera; };
      mesh.name = `npc:${def.name}`;
      entries.forEach((e, i) => mesh.setColorAt(i, new THREE.Color(def.color(e.npc.look, e.frame))));
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh); this.parts.push({ mesh, entries, dynamic: def.dynamic, name: def.name, modelOnly: def.modelOnly === true });
    }
    this.modelRenderer = models ? new NPCModelRenderer(scene, npcs, { ...modelOptions, camera: modelOptions.camera ?? (() => this.renderCamera) }) : null;
  }
  get ready() { return this.modelRenderer?.ready ?? Promise.resolve([]); }
  dispose() {
    this.modelRenderer?.dispose();
    for (const { mesh } of this.parts) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.dispose(); }
    this.parts[0]?.mesh.material.dispose();
    this.parts = [];
  }
  update(dt = 0, t = 0, focus = null) {
    for (const npc of this.npcs) if (npc.shown && npc.dirty) computeFrames(npc);
    this.modelRenderer?.update(dt, t, focus);
    for (const part of this.parts) {
      const { mesh, entries, dynamic } = part;
      for (let i = 0; i < entries.length; i++) {
        const { npc, frame } = entries[i];
        mesh.setMatrixAt(i, npc.shown && (!part.modelOnly || this.modelRenderer?.isActive(npc)) && (!dynamic || dynamic(npc)) && (!this.modelRenderer || this.modelRenderer.partVisible(npc, part.name)) ? npc.frames[frame] : ZERO);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const npc of this.npcs) npc.dirty = false;
  }
}
