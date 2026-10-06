import * as THREE from 'three';
import { STATE, normalizeStops } from '../npc/NPCSchedule.js';
import { OCCUPATIONS } from '../npc/NPCData.js';
import { createRng, hashString } from '../world/rng.js';
import { FRAMES } from '../npc/body/rig.js';

const SEATED = new Set(['fish', 'mend', 'chant']);

// One townsperson: follows its schedule over the nav graph and exposes a pose
// that the instanced renderer turns into body-part matrices.
export class NPC {
  constructor(def, look, manager) {
    const rng = createRng(hashString(def.id));
    this.def = def; this.look = look; this.manager = manager; this.id = def.id;
    this.speed = (OCCUPATIONS[def.occupation]?.speed ?? 1.5) * rng.range(.9, 1.1);
    this.seed = rng() * 100;
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0; this.targetYaw = 0;
    this.state = STATE.IDLE; this.anim = 'look'; this.visible = true; this.indoors = false; this.carrying = false;
    this.node = null; this.path = null; this.pathIndex = 0; this.plan = null; this.timer = 0; this.walkPhase = 0;
    this.talkTarget = null;
    this.pose = { y: 0, bend: 0, legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0, armRz: 0, headYaw: 0, headPitch: 0 };
    this.frames = Object.fromEntries(FRAMES.map(f => [f, new THREE.Matrix4()]));
    this.distance = 0; this.accum = 0; this.chain = 0;
  }
  get interactionRadius() { return this.def.interactionRadius ?? (this.def.shopType || this.def.trainer ? 3.6 : 2.8); }

  // ---- Planning ----
  setActivity(activity, instant = false) {
    const nav = this.manager.nav;
    if (activity.do === 'route') this.plan = { kind: 'route', stops: normalizeStops(activity.stops), index: 0, carry: !!activity.carry };
    else if (activity.do === 'home') this.plan = { kind: 'home', at: this.manager.homeOf(this) };
    else this.plan = { kind: 'stay', at: activity.at, state: activity.state ?? STATE.IDLE, anim: activity.anim ?? 'look' };
    const first = this.plan.kind === 'route' ? this.plan.stops[0].at : this.plan.at;
    if (instant || !this.node) {
      const n = nav.nodes.get(first) ?? nav.nearest(this.x, this.z);
      this.x = n.x; this.z = n.z; this.node = n.id; this.path = null;
      this.arrive();
    } else {
      this.indoors = false;
      this.walkTo(first);
    }
  }
  walkTo(id) {
    const path = this.manager.nav.findPath(this.node, id);
    if (!path || path.length < 2) {
      // Already there (or unreachable): settle instead of recursing through instant arrivals.
      if (++this.chain > 8) { this.chain = 0; this.timer = 1; this.state = STATE.IDLE; return; }
      if (this.manager.nav.nodes.has(id)) this.node = id;
      this.path = null; this.arrive(); return;
    }
    this.chain = 0;
    this.path = path; this.pathIndex = 1; this.state = STATE.WALK; this.anim = 'walk';
    this.carrying = this.plan.kind === 'route' && this.plan.carry;
  }
  arrive() {
    const plan = this.plan, spot = this.manager.nav.nodes.get(this.node);
    if (plan.kind === 'home') { this.indoors = true; this.state = STATE.IDLE; return; }
    this.indoors = false;
    if (plan.kind === 'stay') { this.enter(plan.state, plan.anim, spot); return; }
    const stop = plan.stops[plan.index];
    if (stop.time) { this.enter(stop.state ?? STATE.IDLE, stop.anim ?? 'look', spot); this.timer = stop.time[0] + Math.random() * (stop.time[1] - stop.time[0]); }
    else this.next();
  }
  enter(state, anim, spot) {
    this.state = SEATED.has(anim) ? STATE.SIT : state; this.anim = anim; this.path = null;
    if (spot?.face !== undefined) this.targetYaw = spot.face;
    if (this.plan.kind === 'stay') this.carrying = false;
  }
  next() {
    const plan = this.plan;
    plan.index = (plan.index + 1) % plan.stops.length;
    this.walkTo(plan.stops[plan.index].at);
  }

  // ---- Interaction ----
  talkTo(x, z) { this.talkTarget = { x, z }; this.savedState = [this.state, this.anim]; this.targetYaw = Math.atan2(x - this.x, z - this.z); }
  release() { this.talkTarget = null; }

  // ---- Simulation ----
  update(dt, t, world) {
    if (this.talkTarget) { this.yaw = turn(this.yaw, Math.atan2(this.talkTarget.x - this.x, this.talkTarget.z - this.z), dt * 6); this.animate(t, dt, STATE.TALK, 'talk'); return; }
    if (this.path) {
      const target = this.path[this.pathIndex], dx = target.x - this.x, dz = target.z - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) {
        this.x = target.x; this.z = target.z; this.node = target.id; this.pathIndex++;
        if (this.pathIndex >= this.path.length) { this.path = null; this.arrive(); }
      } else {
        this.x += dx / d * step; this.z += dz / d * step;
        this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 8);
      }
    } else {
      this.yaw = turn(this.yaw, this.targetYaw, dt * 4);
      if (this.plan?.kind === 'route' && this.timer > 0) { this.timer -= dt; if (this.timer <= 0) this.next(); }
    }
    this.y = world.heightAt(this.x, this.z);
    this.animate(t, dt, this.path ? STATE.WALK : this.state, this.path ? 'walk' : this.anim);
  }

  // Procedural pose for each behaviour state; simple loops read as busy townsfolk.
  animate(t, dt, state, anim) {
    const p = this.pose, s = t + this.seed, child = this.def.occupation === 'child';
    Object.assign(p, { y: 0, bend: 0, legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: .06, armRz: .06, headYaw: 0, headPitch: 0 });
    if (state === STATE.WALK) {
      this.walkPhase += dt * this.speed * (child ? 4.2 : 5.6);
      // A ผ้าซิ่น tube skirt shortens the stride.
      const w = Math.sin(this.walkPhase), amp = child ? .75 : this.look.skirt ? .32 : .5;
      p.legL = w * amp; p.legR = -w * amp; p.armLx = -w * amp * .8; p.armRx = w * amp * .8; p.y = Math.abs(Math.cos(this.walkPhase)) * .035; p.bend = .04;
      if (this.carrying || this.look.props.includes('pole')) { p.armRx = this.look.props.includes('pole') ? -.7 : -2.5; p.armRz = .35; p.bend = .1; }
      if (this.look.props.includes('headBasket')) { p.armLx = -2.8; p.armLz = -.1; }
      return;
    }
    // Seated on the ground: hips drop to about 0.2 m (rig hip height 0.88).
    if (state === STATE.SIT) { p.y = -.68; p.legL = p.legR = -1.45; p.armLx = p.armRx = -.35; }
    switch (anim) {
      case 'guard': p.armRx = -.3; p.headYaw = Math.sin(s * .35) * .6; break;
      case 'pray': p.armLx = p.armRx = -1.15; p.armLz = -.45; p.armRz = -.45; p.headPitch = .25; p.bend = .08; break;
      case 'lean': p.bend = -.06; p.armLx = p.armRx = -1.1; p.armLz = p.armRz = -.75; p.headYaw = Math.sin(s * .5) * .5; break;
      case 'talk': p.armRx = -.5 + Math.sin(s * 3.1) * .35; p.armLx = -.2 + Math.sin(s * 2.3 + 1) * .15; p.headYaw = Math.sin(s * 1.3) * .25; p.headPitch = Math.sin(s * 4) * .05; break;
      case 'sell': p.armRx = -.6 + Math.sin(s * 2.4) * .3; p.armLx = -.4; p.bend = .12 + Math.max(0, Math.sin(s * .5)) * .2; p.headYaw = Math.sin(s * .9) * .4; break;
      case 'point': p.armRx = -1.5 + Math.sin(s * 2) * .15; p.armRz = .25; p.headYaw = Math.sin(s * .6) * .5; break;
      case 'hammer': { const k = Math.max(0, Math.sin(s * 5)); p.armRx = -2.3 + k * 1.7; p.armLx = -.7; p.bend = .2 + k * .08; break; }
      case 'lift': p.bend = .45 + Math.sin(s * 2) * .2; p.armLx = p.armRx = -1.3; break;
      case 'plant': p.bend = 1.05; p.armRx = -.5 + Math.sin(s * 3) * .4; p.armLx = -.35 + Math.sin(s * 3 + 1.5) * .2; p.legL = .12; p.legR = -.12; p.headPitch = -.4; break;
      case 'sweep': p.bend = .35; p.armRx = -.7 + Math.sin(s * 3) * .4; p.armLx = -.9 + Math.sin(s * 3) * .4; p.armLz = -.3; break;
      case 'grind': p.bend = .45; p.armLx = p.armRx = -1 + Math.sin(s * 6) * .16; p.armLz = p.armRz = -.2; break;
      case 'gather': p.bend = .75 + Math.sin(s * .8) * .25; p.armRx = -.9 + Math.sin(s * 2) * .35; p.armLx = -.6; break;
      case 'box': { const k = Math.sin(s * 6); p.armLx = -1.6 + Math.max(0, k) * .5; p.armRx = -1.6 + Math.max(0, -k) * .5; p.armLz = p.armRz = -.35; p.legL = .2; p.legR = -.15; p.y = Math.abs(Math.sin(s * 3)) * .05; break; }
      case 'sword': p.armRx = -1.2 + Math.sin(s * 2.6) * 1.1; p.armRz = Math.sin(s * 2.6) * .5; p.armLx = -.6; p.legL = .25; p.legR = -.2; break;
      case 'aim': p.armLx = -1.5; p.armRx = -1.5 + Math.sin(s * .7) * .1; p.armRz = -.55; p.legL = .2; p.legR = -.15; break;
      case 'pound': p.legR = Math.max(0, Math.sin(s * 3.5)) * .5; p.armLx = p.armRx = -.5; p.bend = .1; break;
      case 'hang': p.armLx = p.armRx = -2.4 + Math.sin(s * 2) * .2; break;
      case 'fish': p.armLx = p.armRx = -.95 + Math.sin(s * .9) * .05; p.headPitch = .15; break;
      case 'mend': p.armLx = p.armRx = -1 + Math.sin(s * 3) * .1; p.bend = .25; p.headPitch = .3; break;
      case 'chant': p.armLx = p.armRx = -1.1; p.armLz = p.armRz = -.45; p.headPitch = .15 + Math.sin(s * 2.4) * .06; break;
      case 'rest': p.armLx = p.armRx = -.3; p.headYaw = Math.sin(s * .3) * .4; break;
      case 'work': p.bend = .4 + Math.sin(s * 1.5) * .15; p.armRx = -.9 + Math.sin(s * 2.5) * .4; p.armLx = -.7; break;
      default: p.headYaw = Math.sin(s * .4) * .5; p.y = Math.sin(s * 2) * .008;
    }
  }
}
function turn(from, to, k) { const d = Math.atan2(Math.sin(to - from), Math.cos(to - from)); return from + d * Math.min(1, k); }
