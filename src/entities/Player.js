import * as THREE from 'three';

// The player avatar. The look is the class's 3D model (a Tripo GLB, see
// AVATARS in src/data/training.js), attached by src/training once the
// character exists; until it loads only the ground ring shows. Public API:
// group, position, move(), animate(), setAvatar(model, casts) and
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
  // Moves along `direction` (normalised, on the ground plane), sliding along obstacles.
  move(direction, dt, world, running) {
    const p = this.group.position;
    if (!direction.lengthSq()) { this.animate(dt, 0); return true; }
    const speed = (running ? RUN_SPEED : WALK_SPEED) * world.speedAt(p.x, p.z), step = speed * dt;
    const x = p.x + direction.x * step, z = p.z + direction.z * step, startX = p.x, startZ = p.z;
    if (world.canStand(x, z)) { p.x = x; p.z = z; }
    else {
      if (world.canStand(x, p.z)) p.x = x;
      if (world.canStand(p.x, z)) p.z = z;
    }
    // Real displacement: a slide attempt that keeps the same x or z is not progress.
    const moved = Math.hypot(p.x - startX, p.z - startZ) > step * .05;
    p.y = world.heightAt(p.x, p.z);
    const target = Math.atan2(direction.x, direction.z), r = this.group.rotation;
    r.y += Math.atan2(Math.sin(target - r.y), Math.cos(target - r.y)) * Math.min(1, dt * 14);
    this.animate(dt, moved ? speed : 0);
    return moved;
  }
  animate(dt, speed) {
    if (!this.model) return;
    this.modelTime += dt;
    this.model.update(dt, this.modelTime, speed > 0, null);
  }
}
