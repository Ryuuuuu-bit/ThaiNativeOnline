// Pose maths for the character rig. Pure logic: no Three.js (runs under node --test).
//
// A pose is a plain object of numeric channels. model.js maps them onto the
// rig: body position/rotation, arm and leg pivots, weapon visibility, spell orb.
import { ACTIONS } from './data/actions.js';

export const POSE_CHANNELS = ['bodyY', 'lean', 'twist', 'armRX', 'armRZ', 'armLX', 'armLZ', 'legRX', 'legLX', 'draw', 'orb'];

export function restPose() {
  const pose = {};
  for (const c of POSE_CHANNELS) pose[c] = 0;
  return pose;
}

/** Walk / idle loop, identical to the original makePlayer animation. */
export function locomotionPose(time, moving, out = restPose()) {
  out.bodyY = moving ? Math.sin(time * 13) * .025 : Math.sin(time * 2) * .012;
  // Index 0 = right side (x < 0), index 1 = left side, matching the original loop order.
  out.legRX = moving ? Math.sin(time * 12) * .45 : 0;
  out.legLX = moving ? Math.sin(time * 12 + Math.PI) * .45 : 0;
  out.armRX = moving ? Math.sin(time * 12) * -.35 : 0;
  out.armLX = moving ? Math.sin(time * 12 + Math.PI) * -.35 : 0;
  out.armRZ = 0; out.armLZ = 0; out.lean = 0; out.twist = 0; out.draw = 0; out.orb = 0;
  return out;
}

const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));

/** Channels named by any key of an action. */
export function actionChannels(def) {
  const set = new Set();
  for (const key of def.keys) for (const c of Object.keys(key)) if (c !== 't') set.add(c);
  return [...set];
}

/** Values of every channel the action names at time t (seconds), smoothly interpolated. */
export function sampleAction(def, t) {
  const out = {};
  for (const channel of actionChannels(def)) {
    let prev = null, next = null;
    for (const key of def.keys) {
      if (!(channel in key)) continue;
      if (key.t <= t) prev = key;
      else { next = key; break; }
    }
    if (!prev) out[channel] = next[channel];
    else if (!next) out[channel] = prev[channel];
    else out[channel] = prev[channel] + (next[channel] - prev[channel]) * smooth((t - prev.t) / (next.t - prev.t));
  }
  return out;
}

/** Blend weight (0..1) of an action at time t, and whether it has finished. */
export function actionWeight(def, t) {
  if (t < 0) return { weight: 0, done: false };
  if (def.hold) return { weight: def.fadeIn > 0 ? smooth(clamp01(t / def.fadeIn)) : 1, done: false };
  if (t >= def.duration) return { weight: 0, done: true };
  let w = 1;
  if (def.fadeIn > 0 && t < def.fadeIn) w = Math.min(w, t / def.fadeIn);
  if (def.fadeOut > 0 && t > def.duration - def.fadeOut) w = Math.min(w, (def.duration - t) / def.fadeOut);
  return { weight: smooth(clamp01(w)), done: false };
}

/** Writes base blended toward the overlay's channels by weight into out (default: base). */
export function blendPose(base, overlay, weight, out = base) {
  if (out !== base) Object.assign(out, base);
  for (const [c, v] of Object.entries(overlay)) out[c] = base[c] + (v - base[c]) * weight;
  return out;
}

/** Looks up an action for a weapon type, falling back to shared defaults; null if unknown. */
export function resolveAction(name, weaponType, table = ACTIONS) {
  if (typeof name !== 'string') return null;
  const own = table[weaponType];
  if (own && Object.prototype.hasOwnProperty.call(own, name)) return own[name];
  if (Object.prototype.hasOwnProperty.call(table.default, name)) return table.default[name];
  return null;
}

/**
 * Small state machine for one-shot actions layered over locomotion.
 * play() returns true when the action started. While a `hold` action
 * (death) is active, only actions with `clearsHold` (revive) can start.
 */
export function createActionPlayer(weaponType, table = ACTIONS) {
  let current = null, start = 0, now = 0;
  return {
    play(name) {
      const def = resolveAction(name, weaponType, table);
      if (!def) return false;
      if (current?.def.hold && !def.clearsHold) return false;
      current = { name, def }; start = now;
      return true;
    },
    /** Advances to `time` and blends the active action into `pose` in place. */
    apply(time, pose) {
      now = time;
      if (!current) return pose;
      const t = time - start;
      const { weight, done } = actionWeight(current.def, t);
      if (done) { current = null; return pose; }
      return blendPose(pose, sampleAction(current.def, Math.min(t, current.def.duration)), weight);
    },
    get current() { return current ? current.name : null; },
    stop() { current = null; },
  };
}
