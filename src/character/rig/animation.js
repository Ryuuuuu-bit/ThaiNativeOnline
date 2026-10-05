import * as THREE from 'three';
import { BONES, DIM, fullPose, clampPose, applyPose, expandPose, CHANNELS } from './skeleton.js';

// ---- Pose interpolation ---------------------------------------------------
// Keys are interpolated per channel with monotone cubic (Fritsch–Carlson)
// splines: velocity stays continuous through keys, nothing overshoots, and a
// value held between two keys stays exactly still (planted feet do not slide).
function monotone(times, values, loop, duration) {
  const t = [...times], v = [...values];
  // Loops arrive with the last key equal to the first (at t = duration).
  if (loop) { const n0 = t.length; t.unshift(t[n0 - 2] - duration); v.unshift(v[n0 - 2]); t.push(t[2] + duration); v.push(v[2]); }
  const n = t.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / Math.max(1e-6, t[i + 1] - t[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  if (loop) { m[0] = m[n - 2]; m[n - 1] = m[1]; }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return time => {
    let i = 0; while (i < n - 2 && time > t[i + 1]) i++;
    const h = t[i + 1] - t[i], u = THREE.MathUtils.clamp((time - t[i]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * v[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
// keys: [[time, shortPose], ...]; each key inherits from `base` then from the
// previous key, so authors only write what changes.
export function keyedPose(base, keys, { loop = false, duration } = {}) {
  const full = [], start = fullPose(base); let prev = start;
  for (const [time, pose] of keys) { prev = pose === 'base' ? start : { ...prev, ...expandPose(pose) }; full.push([time, prev]); }
  duration = duration ?? full[full.length - 1][0];
  if (loop && full[full.length - 1][0] < duration) full.push([duration, full[0][1]]);
  const curves = {};
  for (const ch of Object.keys(CHANNELS)) curves[ch] = monotone(full.map(k => k[0]), full.map(k => k[1][ch]), loop, duration);
  return time => { const p = {}; for (const ch in curves) p[ch] = curves[ch](loop ? ((time % duration) + duration) % duration : time); return p; };
}

// ---- Procedural locomotion ------------------------------------------------
const smooth = u => u * u * (3 - 2 * u);
const _r = new THREE.Vector3(), _e = new THREE.Euler();
const HEEL = new THREE.Vector3(0, -DIM.ankleHeight + .005, -.05), BALL = new THREE.Vector3(0, -DIM.toeDown - .015, DIM.toeForward);
function ankleFromContact(zFlat, pitch) {
  // Rolls the foot around the heel (toes up) or the ball (heel up) so the
  // contact point, not the ankle, is the part that stays fixed on the ground.
  const pivot = pitch >= 0 ? HEEL : BALL;
  _r.copy(pivot).applyEuler(_e.set(-THREE.MathUtils.degToRad(pitch), 0, 0));
  return [zFlat + pivot.z - _r.z, DIM.ankleHeight + pivot.y - _r.y];
}
export function armFS(fwd, out, twist = 0) { // forward/outward swing → [raise, dir, twist]
  return [Math.hypot(fwd, out), THREE.MathUtils.radToDeg(Math.atan2(out, fwd)), twist];
}
export function gaitPose(phase, g) {
  const p = {};
  const travel = g.speed * g.period * g.duty, a = travel / 2;
  for (const [S, off, k] of [['L', 0, 1], ['R', .5, -1]]) {
    const q = (phase + off) % 1;
    const stance = u => {
      const zFlat = g.zc + a * (1 - 2 * u);
      let pitch = 0;
      if (u < g.loadEnd) pitch = THREE.MathUtils.lerp(g.heel, 0, smooth(u / g.loadEnd));
      if (u > g.heelOff) pitch = -g.toeOff * smooth((u - g.heelOff) / (1 - g.heelOff));
      const [z, y] = ankleFromContact(zFlat, pitch); return { z, y, pitch };
    };
    let z, y, pitch;
    if (q < g.duty) ({ z, y, pitch } = stance(q / g.duty));
    else {
      const u = (q - g.duty) / (1 - g.duty), s0 = stance(1), s1 = stance(0), su = smooth(u);
      // Hermite swing: leaves and lands with the stance's ground-relative
      // velocity (-speed in body space), so the foot never skids at lift-off.
      const m = -g.speed * (1 - g.duty) * g.period, u2 = u * u, u3 = u2 * u;
      z = (2 * u3 - 3 * u2 + 1) * s0.z + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * s1.z + (u3 - u2) * m
        - g.kick * Math.sin(Math.PI * Math.min(1, u * 1.5)) * (1 - u);
      y = THREE.MathUtils.lerp(s0.y, s1.y, u) + g.lift * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), 1.2) + g.kick * .6 * Math.sin(Math.PI * Math.min(1, u * 1.5)) * (1 - u);
      pitch = THREE.MathUtils.lerp(-g.toeOff, g.heel, smooth(u)) + 10 * Math.sin(Math.PI * u) * (g.heel > 0 ? 1 : 0);
    }
    Object.assign(p, { [`foot${S}X`]: k * g.width, [`foot${S}Y`]: y, [`foot${S}Z`]: z, [`foot${S}Yaw`]: g.toeOut, [`foot${S}Pitch`]: pitch, [`knee${S}Out`]: g.kneeOut || 0 });
  }
  const c = Math.cos(2 * Math.PI * phase), s = Math.sin(2 * Math.PI * phase), dbl = Math.cos(4 * Math.PI * (phase - g.duty / 2));
  p.rootY = -g.crouch + (g.run ? -g.bob * dbl : g.bob * dbl);
  p.rootX = g.sway * s; p.rootYaw = -g.hipYaw * c; p.rootRoll = -g.roll * s; p.rootPitch = g.lean + (g.run ? g.pitchBob * dbl : 0);
  p.spinePitch = g.spine; p.spineYaw = g.hipYaw * .4 * c; p.chestPitch = g.chest; p.chestYaw = g.chestYaw * c;
  p.neckYaw = -(p.rootYaw + p.spineYaw + p.chestYaw) * .8; p.neckPitch = -(g.lean + g.spine + g.chest) * .55;
  p.headPitch = -(g.lean + g.spine + g.chest) * .3 + g.head;
  for (const [S, sign] of [['L', -1], ['R', 1]]) {
    const fwd = g.armSwing * sign * c + g.armFwd;
    const [raise, dir, twist] = armFS(fwd, g.armOut, g.armTwist);
    Object.assign(p, { [`arm${S}Raise`]: raise, [`arm${S}Dir`]: dir, [`arm${S}Twist`]: twist, [`fore${S}Flex`]: g.elbow + g.elbowSwing * Math.max(0, fwd / (g.armSwing || 1)), [`clav${S}Protract`]: fwd * .08 });
  }
  return p;
}
export const GAITS = {
  walk: { speed: 1.2, period: .9, duty: .6, width: .085, zc: .0, heel: 14, toeOff: 32, loadEnd: .16, heelOff: .55, lift: .07, kick: 0, crouch: .055, bob: .013, sway: .018, hipYaw: 7, roll: 3, lean: 2, spine: 1, chest: 0, chestYaw: 6, head: 0, armSwing: 22, armFwd: 3, armOut: 9, armTwist: 0, elbow: 14, elbowSwing: 18, toeOut: 7, pitchBob: 0 },
  run: { speed: 3.1, period: .62, duty: .33, width: .07, zc: -.05, heel: 4, toeOff: 38, loadEnd: .2, heelOff: .45, lift: .1, kick: .16, crouch: .085, bob: .028, sway: .012, hipYaw: 10, roll: 3, lean: 9, spine: 4, chest: 2, chestYaw: 12, head: 0, armSwing: 42, armFwd: 6, armOut: 10, armTwist: 10, elbow: 80, elbowSwing: 18, toeOut: 5, pitchBob: 2, run: true },
};

// ---- Baking ---------------------------------------------------------------
// Samples a pose function into a standard THREE.AnimationClip (bone
// quaternions + Hips position), clamping every frame to the joint limits.
// When `travel` is set, forward root motion (rootZ) is extracted into
// clip.userData.motion so the game moves the character instead of the clip.
export function bakeClip(skel, name, poseAt, duration, { fps = 30, loop = false, travel = false, events = [], extra } = {}) {
  const frames = Math.max(2, Math.round(duration * fps) + 1), times = new Float32Array(frames);
  const bones = BONES.map(([n]) => skel.bones[n]), quats = bones.map(() => new Float32Array(frames * 4));
  const hipPos = new Float32Array(frames * 3), motion = new Float32Array(frames), report = { reach: 0, maxReach: 0 };
  let z0 = 0;
  for (let f = 0; f < frames; f++) {
    const t = Math.min(duration, f / fps * (duration * fps / (frames - 1))); times[f] = t;
    const pose = clampPose({ ...fullPose(), ...poseAt(t) });
    if (f === 0) z0 = pose.rootZ;
    if (travel) {
      const m = pose.rootZ - z0; motion[f] = m; pose.rootZ -= m;
      for (const S of ['L', 'R']) pose[`foot${S}Z`] -= m;
    }
    report.reach = 0; applyPose(skel, pose, report); report.maxReach = Math.max(report.maxReach, report.reach);
    extra?.(pose, t);
    bones.forEach((b, i) => b.quaternion.toArray(quats[i], f * 4));
    skel.bones.Hips.position.toArray(hipPos, f * 3);
  }
  // Loops must end exactly where they begin.
  if (loop) { bones.forEach((b, i) => quats[i].copyWithin((frames - 1) * 4, 0, 4)); hipPos.copyWithin((frames - 1) * 3, 0, 3); }
  const tracks = bones.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, quats[i]));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos));
  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.userData = { loop, events, motion: travel ? { times, values: motion } : null, maxReachError: report.maxReach };
  return clip;
}
export function motionAt(clip, t) {
  const m = clip.userData.motion; if (!m) return 0;
  const { times, values } = m; if (t >= times[times.length - 1]) return values[values.length - 1];
  let i = 0; while (i < times.length - 2 && t > times[i + 1]) i++;
  const u = (t - times[i]) / (times[i + 1] - times[i]); return THREE.MathUtils.lerp(values[i], values[i + 1], u);
}
