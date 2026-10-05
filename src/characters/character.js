import * as THREE from 'three';
import { createSkeleton, fullPose, expandPose } from './skeleton.js';
import { RigBuilder } from './builder.js';
import { makeMaterials } from './materials.js';
import { CLASSES } from './classes.js';
import { MOVES } from './moves.js';
import { SpringSystem } from './springs.js';
import { keyedPose, gaitPose, GAITS, bakeClip, motionAt } from './animation.js';
import { arrow as arrowParts } from './props.js';

export { CLASSES, CLASS_IDS } from './classes.js';
export { MOVES } from './moves.js';

// Builds the skeleton, skinned meshes and every clip for one class.
export function buildCharacterAsset(classId) {
  const def = CLASSES[classId], moves = MOVES[classId];
  if (!def) throw new Error(`Unknown class ${classId}`);
  const skel = createSkeleton();
  const materials = makeMaterials(def.palette, { tattoo: def.tattoo });
  const rb = new RigBuilder(skel);
  def.build(rb, materials);
  const { skeleton, meshes } = rb.build();
  const clips = bakeClips(skel, moves);
  // Return the skeleton to its bind pose after baking.
  skeleton.pose();
  return { def, moves, skel, skeleton, meshes, materials, clips, springs: rb.springs, colliders: rb.colliders };
}

export function gaitFor(moves, kind) {
  return kind === 'run' ? { ...GAITS.run, ...(moves.runGait || {}), run: true } : { ...GAITS.walk, ...(moves.gait || {}) };
}
export function bakeClips(skel, moves) {
  const clips = {};
  const idle = keyedPose(moves.base, moves.idle.keys, { loop: true, duration: moves.idle.duration });
  clips.idle = bakeClip(skel, 'Idle', idle, moves.idle.duration, { loop: true });
  for (const kind of ['walk', 'run']) {
    const g = gaitFor(moves, kind);
    const poseAt = t => {
      const phase = t / g.period, c = Math.cos(2 * Math.PI * phase);
      return { ...fullPose(moves.base), ...gaitPose(phase % 1, g), ...expandPose(moves.locoArms?.(c) || {}) };
    };
    clips[kind] = bakeClip(skel, kind === 'walk' ? 'Walk' : 'Run', poseAt, g.period, { loop: true });
    clips[kind].userData.speed = g.speed; clips[kind].userData.stride = g.speed * g.period;
  }
  for (const s of moves.skills) {
    const poseAt = keyedPose(moves.base, s.keys);
    clips[s.id] = bakeClip(skel, s.name, poseAt, s.duration, { travel: s.travel, events: s.events || [] });
    clips[s.id].userData.skill = s;
  }
  return clips;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Character {
  constructor(classId, { scale = 1 } = {}) {
    const asset = buildCharacterAsset(classId);
    Object.assign(this, asset);
    this.classId = classId;
    this.root = new THREE.Group(); this.root.name = `${asset.def.name}`;
    this.model = new THREE.Group(); this.model.name = `ThaiNative_${classId}`; this.model.scale.setScalar(scale); this.root.add(this.model);
    this.model.add(this.skel.root); for (const m of this.meshes) this.model.add(m);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const [id, clip] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0);
      if (clip.userData.loop) a.setLoop(THREE.LoopRepeat); else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      a.play(); this.actions[id] = a;
    }
    this.actions.walk.timeScale = 0; this.actions.run.timeScale = 0;
    this.springSystem = new SpringSystem(this.springs, this.colliders, this.skeleton.bones);
    this.phase = 0; this.speed = 0; this.skill = null; this.listeners = [];
    this.locoWeights = { idle: 1, walk: 0, run: 0 };
    // Hunter extras: bow nock follows the drawing hand, arrow while drawing.
    this.nock = this.skeleton.bones.find(b => b.name === 'BowNock');
    if (this.nock) {
      this.nockRest = this.nock.position.clone();
      this.arrow = new THREE.Group();
      for (const [g, mat] of arrowParts(this.materials, .74)) { const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; this.arrow.add(mesh); }
      this.arrow.visible = false; this.model.add(this.arrow);
    }
    this.bone = name => this.skeleton.bones.find(b => b.name === name);
    this.mixer.update(0);
  }
  get skills() { return this.moves.skills; }
  on(fn) { this.listeners.push(fn); }
  play(skillId) {
    const clip = this.clips[skillId]; if (!clip) return false;
    if (this.skill && this.skill.time < this.skill.clip.duration - .3) return false;
    const action = this.actions[skillId]; action.reset(); action.play();
    this.skill = { id: skillId, clip, action, time: 0, fired: new Set(), motion: 0, def: clip.userData.skill };
    return true;
  }
  get busy() { return !!this.skill; }
  // speed: ground speed in m/s (unscaled). Returns forward root motion this frame.
  update(dt, speed = 0) {
    this.speed = THREE.MathUtils.damp(this.speed, speed, 10, dt);
    const s = this.speed, walk = this.clips.walk.userData, run = this.clips.run.userData;
    let wi, ww, wr;
    if (s <= walk.speed) { const u = THREE.MathUtils.smoothstep(s, .05, walk.speed); wi = 1 - u; ww = u; wr = 0; }
    else { const u = THREE.MathUtils.clamp((s - walk.speed) / (run.speed - walk.speed), 0, 1); wi = 0; ww = 1 - u; wr = u; }
    const stride = THREE.MathUtils.lerp(walk.stride, run.stride, wr);
    if (s > .05) this.phase = (this.phase + dt * s / stride) % 1;
    this.actions.walk.time = this.phase * this.clips.walk.duration;
    this.actions.run.time = this.phase * this.clips.run.duration;
    let skillW = 0, motion = 0;
    if (this.skill) {
      const sk = this.skill, dur = sk.clip.duration; sk.time += dt;
      skillW = Math.min(1, sk.time / .14) * Math.min(1, Math.max(0, (dur + .1 - sk.time) / .3));
      const m = motionAt(sk.clip, Math.min(sk.time, dur)); motion = m - sk.motion; sk.motion = m;
      for (const e of sk.clip.userData.events) if (!sk.fired.has(e) && sk.time >= e.t) { sk.fired.add(e); this.listeners.forEach(fn => fn(e, this)); }
      if (sk.time >= dur + .1) { sk.action.setEffectiveWeight(0); this.skill = null; skillW = 0; }
      else sk.action.setEffectiveWeight(skillW);
    }
    const lw = 1 - skillW;
    this.actions.idle.setEffectiveWeight(wi * lw); this.actions.walk.setEffectiveWeight(ww * lw); this.actions.run.setEffectiveWeight(wr * lw);
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);
    this.updateBow();
    this.springSystem.update(dt);
    return motion * this.model.scale.x;
  }
  drawAmount() {
    const sk = this.skill; if (!sk?.def?.draw) return 0;
    const k = sk.def.draw, t = sk.time; if (t <= k[0][0] || t >= k[k.length - 1][0]) return 0;
    let i = 0; while (i < k.length - 2 && t > k[i + 1][0]) i++;
    return THREE.MathUtils.lerp(k[i][1], k[i + 1][1], (t - k[i][0]) / (k[i + 1][0] - k[i][0]));
  }
  updateBow() {
    if (!this.nock) return;
    const draw = this.drawAmount(), left = this.bone('LeftHand'), right = this.bone('RightHand');
    const hand = _v.set(.016, -.085, .0).applyMatrix4(right.matrixWorld);
    left.worldToLocal(_v2.copy(hand));
    this.nock.position.lerpVectors(this.nockRest, _v2, draw); this.nock.updateMatrixWorld(true);
    const sk = this.skill, aiming = sk?.def?.draw && sk.time > sk.def.draw[0][0] && sk.time < sk.def.draw[sk.def.draw.length - 2][0] + .02;
    this.arrow.visible = !!aiming;
    if (aiming) {
      const tail = this.nock.getWorldPosition(new THREE.Vector3());
      const grip = new THREE.Vector3(-.016, -.078, 0).applyMatrix4(left.matrixWorld);
      this.model.worldToLocal(tail); this.model.worldToLocal(grip);
      this.arrow.position.copy(tail);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), grip.sub(tail).normalize());
    }
  }
  // World-space position of a point on a bone (for effects).
  bonePoint(name, offset = [0, 0, 0], target = new THREE.Vector3()) {
    return target.set(...offset).applyMatrix4(this.bone(name).matrixWorld);
  }
  arrowDirection(target = new THREE.Vector3()) { return target.set(0, 1, 0).applyQuaternion(this.arrow.getWorldQuaternion(_q)); }
  resetSprings() { this.springSystem.reset(); }
  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    for (const m of Object.values(this.materials)) m.dispose(); // canvas maps are cached and shared
    this.mixer.stopAllAction();
  }
}
