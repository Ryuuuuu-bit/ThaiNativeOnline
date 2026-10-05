// Validates every class rig and every baked clip without a browser:
//   node scripts/check-rig.mjs        (npm run check:rig)
// Checks: unique bone names, joint angles inside anatomical limits, feet never
// sink into the ground, planted feet stay planted (walk/run slip), IK reaches
// its targets while a foot is planted, and looping clips are seamless.
import * as THREE from 'three';
import { Character, CLASS_IDS } from '../src/characters/character.js';
import { LIMITS } from '../src/characters/skeleton.js';

const deg = THREE.MathUtils.radToDeg;
const v = () => new THREE.Vector3();
let failures = 0;
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

for (const id of CLASS_IDS) {
  const c = new Character(id);
  const names = c.skeleton.bones.map(b => b.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  console.log(`\n${c.def.name} (${id}) — ${names.length} bones, ${Object.keys(c.clips).length} clips`);
  if (dupes.length) fail(`duplicate bone names: ${dupes.join(', ')}`);
  const B = n => c.skeleton.bones.find(b => b.name === n);
  const mixer = new THREE.AnimationMixer(c.model);
  for (const [clipId, clip] of Object.entries(c.clips)) {
    mixer.stopAllAction(); const action = mixer.clipAction(clip); action.reset().play(); action.setEffectiveWeight(1);
    const fps = 30, frames = Math.round(clip.duration * fps);
    const stats = { minY: Infinity, knee: [Infinity, -Infinity], elbow: [Infinity, -Infinity], slip: 0, reach: clip.userData.maxReachError };
    const prev = {};
    const speed = clip.userData.speed || 0;
    for (let f = 0; f <= frames; f++) {
      const t = Math.min(clip.duration, f / fps); action.time = t; mixer.update(0); c.model.updateMatrixWorld(true);
      for (const side of ['Left', 'Right']) {
        const heel = v().set(0, -.065, -.05).applyMatrix4(B(`${side}Foot`).matrixWorld);
        const ball = v().set(0, -.015, 0).applyMatrix4(B(`${side}ToeBase`).matrixWorld);
        const tip = v().set(0, -.015, .06).applyMatrix4(B(`${side}ToeBase`).matrixWorld);
        stats.minY = Math.min(stats.minY, heel.y, ball.y, tip.y);
        // Knee: the shin may only fold backward, between 0 and the limit.
        const leg = B(`${side}Leg`), up = B(`${side}UpLeg`);
        const thighDir = v().set(0, -1, 0).transformDirection(up.matrixWorld), shinDir = v().set(0, -1, 0).transformDirection(leg.matrixWorld);
        // Signed around the knee hinge (thigh's local X): positive = shin folds backward.
        const hinge = v().set(1, 0, 0).transformDirection(up.matrixWorld);
        const knee = deg(thighDir.angleTo(shinDir)) * (v().crossVectors(thighDir, shinDir).dot(hinge) < -1e-3 ? -1 : 1);
        stats.knee = [Math.min(stats.knee[0], knee), Math.max(stats.knee[1], knee)];
        const upper = v().set(0, -1, 0).transformDirection(B(`${side}Arm`).matrixWorld), fore = v().set(0, -1, 0).transformDirection(B(`${side}ForeArm`).matrixWorld);
        const elbow = deg(upper.angleTo(fore)); stats.elbow = [Math.min(stats.elbow[0], elbow), Math.max(stats.elbow[1], elbow)];
        // Slip: a contact point on the ground must move at -speed (in-place locomotion).
        for (const [k, p] of [['heel', heel], ['ball', ball]]) {
          const key = side + k;
          if (prev[key] && p.y < .012 && prev[key].y < .012) {
            const vz = (p.z - prev[key].z) * fps + speed, vx = (p.x - prev[key].x) * fps;
            if (speed) stats.slip = Math.max(stats.slip, Math.hypot(vx, vz));
          }
          prev[key] = p;
        }
      }
    }
    const loopOk = !clip.userData.loop || clip.tracks.every(tr => {
      const n = tr.values.length / tr.times.length, a = tr.values.slice(0, n), b = tr.values.slice(-n);
      return a.every((x, i) => Math.abs(x - b[i]) < 1e-4);
    });
    const line = `${clipId.padEnd(18)} ${clip.duration.toFixed(2)}s  minFootY ${stats.minY.toFixed(3)}  knee ${stats.knee[0].toFixed(0)}..${stats.knee[1].toFixed(0)}°  elbow ${stats.elbow[0].toFixed(0)}..${stats.elbow[1].toFixed(0)}°  slip ${stats.slip.toFixed(2)}m/s  IKerr ${stats.reach.toFixed(3)}`;
    console.log(`  ${line}`);
    if (stats.minY < -.025) fail(`${clipId}: foot sinks ${(-stats.minY * 100).toFixed(1)} cm into the ground`);
    if (stats.knee[0] < -3 || stats.knee[1] > LIMITS.knee[1] + 2) fail(`${clipId}: knee outside 0..${LIMITS.knee[1]}°`);
    if (stats.elbow[1] > LIMITS.fore.flex[1] + 2) fail(`${clipId}: elbow beyond ${LIMITS.fore.flex[1]}°`);
    if (speed && stats.slip > .35) fail(`${clipId}: planted foot slides at ${stats.slip.toFixed(2)} m/s`);
    if (!clip.userData.motion && stats.reach > .02) fail(`${clipId}: IK misses its target by ${(stats.reach * 100).toFixed(1)} cm`);
    if (!loopOk) fail(`${clipId}: loop is not seamless`);
  }
}
console.log(failures ? `\n${failures} problem(s) found` : '\nAll rigs and clips passed');
process.exit(failures ? 1 : 0);
