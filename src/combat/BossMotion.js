import * as THREE from 'three';

// Presentation only. A predicted end of windup never releases a strike: only
// the authoritative impact event does. Fractions sample the existing clips.
const profile = (idleRate, walkRate, holdFraction, peakFraction, releaseSeconds, meshy = false, weapon = false) =>
  Object.freeze({ idleRate, walkRate, holdFraction, peakFraction, releaseSeconds, recoverySeconds: 1.1, blendSeconds: .12, meshy, weapon });
export const BOSS_MOTION_PROFILES = Object.freeze({
  buffalo: profile(.72, .90, .20, .62, .28),
  takian: profile(.58, .72, .34, .60, .33),
  pusom: profile(.70, .90, .32, .60, .26),
  chalawan: profile(.82, .90, .32, .58, .28, true),
  bamboo_grave_3: profile(.65, .80, .36, .63, .32, true),
  sealed_mine_3: profile(.58, .78, .34, .60, .28, true),
  sunken_city_3: profile(.66, .72, .40, .62, .30),
  dusk_fort_3: profile(.90, 1.03, .28, .56, .22, true),
  giant_valley_3: profile(.60, .74, .34, .60, .35, true, true),
  himmapan_3: profile(.94, 1.08, .26, .56, .24, true),
  fallen_city_3: profile(.86, .98, .28, .58, .24, true, true),
  demon_rift_3: profile(.72, .88, .36, .64, .30, true),
});
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const seconds = n => Number.isFinite(n) ? Math.max(0, n) : 0;

export function bossMotionClip(type, cast) {
  const p = BOSS_MOTION_PROFILES[type];
  if (!p?.meshy) return 'attack';
  if (cast?.shape === 'ring') return 'ritual-meshy';
  if (cast?.shape === 'cone' && p.weapon) return 'slash-meshy';
  return 'cast-meshy';
}

export class BossMotion {
  constructor(type) {
    this.type = type; this.profile = BOSS_MOTION_PROFILES[type];
    this.snapshot = { phase: 'none', castSerial: 0, poseFraction: 0, clip: null };
    this.reset();
  }
  reset() { this.serial = 0; this.active = null; this.terminal = null; this.dead = false; }
  clear() { this.active = null; this.terminal = 'clear'; }
  event({ stage, cast, snapshot = false } = {}) {
    if (!this.profile || this.dead || !['windup', 'impact', 'cancel'].includes(stage) || !Number.isSafeInteger(cast?.serial) || cast.serial < 1) return false;
    const serial = cast.serial;
    if (serial < this.serial) return false;
    if (serial === this.serial) {
      if (stage === 'windup' && this.active?.stage === 'windup') {
        // Snapshot remaining can advance an existing warning, never rewind it.
        const elapsed = this.active.duration - seconds(cast.remaining ?? cast.windup);
        this.active.age = Math.max(this.active.age, elapsed);
        return false;
      }
      if (this.terminal || this.active?.stage === 'impact') {
        if (!(stage === 'windup' && snapshot && this.terminal === 'clear')) return false;
      }
    }
    const prior = this.state();
    this.serial = serial; this.terminal = null;
    if (stage === 'cancel') { this.active = null; this.terminal = 'cancel'; return true; }
    const duration = Math.max(.05, seconds(cast.windup ?? cast.remaining) || 2);
    this.active = {
      stage, duration, age: stage === 'windup' ? clamp(duration - seconds(cast.remaining ?? duration), 0, duration) : 0,
      clip: stage === 'impact' && prior.castSerial === serial && prior.phase !== 'none' ? prior.clip : bossMotionClip(this.type, cast),
      start: stage === 'impact' && prior.castSerial === serial && prior.phase !== 'none' ? prior.poseFraction : this.profile.holdFraction,
    };
    return true;
  }
  update(dt, { dying = false } = {}) {
    if (dying) { this.dead = true; this.active = null; this.terminal = 'death'; }
    if (this.active) {
      this.active.age += seconds(dt);
      if (this.active.stage === 'impact' && this.active.age >= this.profile.recoverySeconds) {
        this.active = null; this.terminal = 'impact';
      }
    }
    return this.state();
  }
  state() {
    const a = this.active, p = this.profile, out = this.snapshot;
    out.castSerial = this.serial; out.clip = a?.clip ?? null;
    if (!a || !p) { out.phase = this.dead ? 'death' : 'none'; out.poseFraction = 0; return out; }
    if (a.stage === 'windup') {
      out.phase = a.age >= a.duration ? 'hold' : 'windup';
      out.poseFraction = p.holdFraction * clamp(a.age / a.duration, 0, 1);
      return out;
    }
    const releasing = a.age <= p.releaseSeconds;
    out.phase = releasing ? 'release' : 'recovery';
    out.poseFraction = releasing ? THREE.MathUtils.lerp(a.start, p.peakFraction, clamp(a.age / p.releaseSeconds, 0, 1))
      : THREE.MathUtils.lerp(p.peakFraction, 1, clamp((a.age - p.releaseSeconds) / (p.recoverySeconds - p.releaseSeconds), 0, 1));
    return out;
  }
}

// Per-instance playback; clips and geometry remain immutable cached sources.
// Pausing the sampled action (rather than stopping/resetting it each frame)
// preserves mixer fades and continuity from preparation to authoritative release.
export function createBossAnimator(type, mixer, actions) {
  const p = BOSS_MOTION_PROFILES[type];
  if (!p) return null;
  const inactive = { phase: 'none', castSerial: 0 }, status = {};
  let current = null, controlled = false, wasAttacking = false, wasHurt = false, state = inactive;
  const oneShot = name => /^(attack|hurt|die|cast-meshy|ritual-meshy|slash-meshy)$/.test(name);
  function configure() {
    for (const [name, a] of Object.entries(actions)) {
      a.setLoop(oneShot(name) ? THREE.LoopOnce : THREE.LoopRepeat, oneShot(name) ? 1 : Infinity);
      a.clampWhenFinished = oneShot(name);
    }
  }
  configure();
  function play(next, rate = 1, paused = false) {
    if (!next) return;
    if (next !== current) {
      current?.fadeOut(p.blendSeconds);
      next.reset().setEffectiveWeight(1).fadeIn(p.blendSeconds).play(); current = next;
    }
    next.paused = paused; next.setEffectiveTimeScale(rate);
  }
  const locomotion = moving => actions[moving ? 'walk-meshy' : 'idle-meshy'] ?? actions[moving ? 'walk' : 'idle'] ?? actions.idle ?? actions.walk;
  play(locomotion(false), p.idleRate);
  return {
    refresh: configure,
    update(dt, moving, attacking, { hurt = false, dying = false, bossMotion } = {}) {
      state = bossMotion ?? inactive;
      const cast = state.phase === 'windup' || state.phase === 'hold' || state.phase === 'release' || state.phase === 'recovery';
      if (dying || state.phase === 'death') {
        controlled = false; play(actions.die ?? locomotion(false), actions.die ? 1.4 : p.idleRate);
      } else if (cast) {
        // Keep the chosen action for this cast if an optional overlay arrives
        // midway through it. The next cast can use the newly loaded library.
        const next = controlled && this.castSerial === state.castSerial ? current : actions[state.clip] ?? actions.attack;
        controlled = !!next; this.castSerial = state.castSerial;
        if (next) { play(next, 1, true); next.time = clamp(state.poseFraction, 0, 1) * next.getClip().duration; }
        else play(locomotion(moving), moving ? p.walkRate : p.idleRate);
      } else if (controlled) {
        controlled = false; play(locomotion(moving), moving ? p.walkRate : p.idleRate);
      } else if (attacking && !wasAttacking && actions.attack) {
        // Basic attacks retain the body's approved attack; Meshy gestures are
        // selected only by the authoritative boss-skill phase controller.
        play(actions.attack); actions.attack.reset().play();
      } else if (hurt && !wasHurt && !oneShot(current?.getClip().name ?? '') && actions.hurt) {
        play(actions.hurt); actions.hurt.reset().play();
      } else if (!current || current === actions.die || !oneShot(current.getClip().name) || !current.isRunning()) {
        play(locomotion(moving), moving ? p.walkRate : p.idleRate);
      }
      wasAttacking = attacking; wasHurt = hurt;
      mixer.update(seconds(dt));
    },
    state: () => {
      Object.assign(status, state);
      status.clip = current?.getClip().name ?? null; status.clipTime = current?.time ?? 0;
      status.time = status.clipTime; status.timeScale = current?.timeScale ?? 0;
      return status;
    },
  };
}
