import * as THREE from 'three';
import { DASH } from '../data/dash.js';

// The player avatar. The look is the class's 3D model (a Tripo GLB, see
// AVATARS in src/data/training.js), attached by src/training once the
// character exists; until it loads only the ground ring shows. Public API:
// group, position, move(), dash(), animate(), setAvatar(model, casts) and
// bindCombat(game), which plays the class's skill clip on every combat cast.
// Speed is tuned to the city's travel-time targets.
export const WALK_SPEED = 4.2, RUN_SPEED = 6.8;
const SWING_TEMPO = 1.25;   // combat clips play at least this fast (see swingSpeed)

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.36, .4, 48), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; this.group.add(ring);
    this.model = null; this.casts = {}; this.modelTime = 0; this.combat = null;
    this.dashing = null; this.dashCooldown = 0;   // { x, z, left } while a dash carries the player
  }
  get position() { return this.group.position; }
  // `model` = { group, update(dt, time, moving, heading), attack?(clip), has?(clip) } from
  // src/classes/model.js; `casts` maps combat skill ids to its clips. The Player still
  // moves and turns this.group; the model only animates itself.
  setAvatar(model, casts = {}) {
    if (this.model) this.group.remove(this.model.group);
    this.model = model; this.casts = casts; this.modelTime = 0;
    // every move the model plays is reported (onAnim), so others can see it (src/net)
    if (model.attack && !model.attack.reported) {
      const play = model.attack.bind(model);
      model.attack = Object.assign((clip, speed) => { const ok = play(clip, speed); if (ok !== false) this.onAnim?.(clip, speed); return ok; }, { reported: true });
    }
    this.group.add(model.group);
  }
  // Called every frame by Game; binds once the character exists (after creation/load).
  bindCombat(game) {
    if (this.combat || !game?.ready) return;
    this.combat = game.combat;
    game.combat.on('cast', ({ skillId }) => {
      const clip = this.casts[skillId];
      if (clip && this.model?.has?.(clip)) this.model.attack(clip, this.swingSpeed(clip));
    });
  }
  // Clip speed for a combat cast: at least the snappy base tempo, and fast enough that the
  // swing fits inside the basic-attack interval, so attack speed (AGI, buffs) shows.
  swingSpeed(clip) {
    const c = this.combat?.character, len = this.model?.clipLength?.(clip) ?? 0;
    const interval = c?.cls?.attackSpeed ? c.cls.attackSpeed * (1 - (c.attackSpeed || 0)) : 0;
    return Math.min(3, Math.max(SWING_TEMPO, interval > 0 && len > 0 ? len / (interval * .9) : 0));
  }
  // Shift: a dash of DASH.distance along `direction` (or the way the player faces) over
  // DASH.time, then DASH.cooldown before the next. False while one is not ready.
  get dashReady() { return !this.dashing && this.dashCooldown <= 0; }
  dash(direction) {
    if (!this.dashReady) return false;
    const r = this.group.rotation.y, d = direction?.lengthSq() ? direction : { x: Math.sin(r), z: Math.cos(r) };
    const len = Math.hypot(d.x, d.z) || 1;
    this.dashing = { x: d.x / len, z: d.z / len, left: DASH.time };
    this.dashCooldown = DASH.cooldown;
    const clipLen = this.model?.clipLength?.(DASH.clip) ?? 0;
    if (clipLen && this.model.has?.(DASH.clip)) this.model.attack(DASH.clip, clipLen / DASH.clipTime);
    return true;
  }
  // Moves along `direction` (normalised, on the ground plane), sliding along obstacles.
  // A dash in progress carries the player its own way, whatever the keys say.
  move(direction, dt, world, running) {
    const p = this.group.position;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const dash = this.dashing;
    if (dash) { direction = this.dashDir ??= new THREE.Vector3(); direction.set(dash.x, 0, dash.z); }
    if (!direction.lengthSq()) { this.animate(dt, 0); return true; }
    const bonus = this.combat?.character?.speedBonus ?? 0;
    const speedBonus = Number.isFinite(bonus) ? Math.max(0, Math.min(.5, bonus)) : 0;
    const speed = dash ? DASH.distance / DASH.time : (running ? RUN_SPEED : WALK_SPEED) * (1 + speedBonus) * world.speedAt(p.x, p.z);
    const step = speed * (dash ? Math.min(dt, dash.left) : dt), startX = p.x, startZ = p.z;
    if (dash && (dash.left -= dt) <= 0) this.dashing = null;
    // in pieces no longer than a body's width, so a long frame (a hidden tab's catch-up, a slow
    // phone) cannot carry the player through a fence post or a wall between two tests
    const pieces = Math.max(1, Math.ceil(step / .12));
    for (let i = 0; i < pieces; i++) {
      const s = step / pieces, x = p.x + direction.x * s, z = p.z + direction.z * s;
      if (world.canStand(x, z)) { p.x = x; p.z = z; continue; }
      let slid = false;
      if (world.canStand(x, p.z)) { p.x = x; slid = true; }
      if (world.canStand(p.x, z)) { p.z = z; slid = true; }
      if (!slid) { if (dash) this.dashing = null; break; }   // a dash into a wall stops there
    }
    // Real displacement: a slide attempt that keeps the same x or z is not progress.
    const moved = Math.hypot(p.x - startX, p.z - startZ) > step * .05;
    p.y = world.heightAt(p.x, p.z);
    const target = Math.atan2(direction.x, direction.z), r = this.group.rotation;
    r.y += Math.atan2(Math.sin(target - r.y), Math.cos(target - r.y)) * (dash ? 1 : Math.min(1, dt * 14));
    this.animate(dt, moved ? speed : 0);
    return moved;
  }
  animate(dt, speed) {
    if (!this.model) return;
    this.modelTime += dt;
    this.model.update(dt, this.modelTime, speed > 0, null);
  }
}
