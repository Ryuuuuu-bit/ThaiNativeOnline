import * as THREE from 'three';
import { Character } from '../character/rig/character.js';
import { Effects } from '../character/rig/vfx.js';
import { CAST_ANIMS, GAME_EFFECTS } from '../character/rig/castMap.js';

// The player avatar: a rigged class character from src/character/rig (leg IK,
// joint limits, spring cloth). Public API is unchanged — group, position,
// move(), animate() — plus setClass(id) and bindCombat(game), which switches
// to the chosen class and plays a skill animation on every combat cast.
// Speed is tuned to the city's travel-time targets.
export const WALK_SPEED = 4.2, RUN_SPEED = 6.8;
const SCALE = .92;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.36, .4, 48), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .04; this.group.add(ring);
    this.effects = new Effects(scene);
    this.speed = 0; this.classId = null; this.combat = null;
    this.setClass('warrior');
  }
  get position() { return this.group.position; }
  // Hook (src/training): show an external model instead of the class rig, e.g.
  // the Tripo Muay Thai fighter. `model` = { group, update(dt, time, moving, heading) };
  // the Player still moves and turns this.group, the model only animates itself.
  useModel(model) {
    this.model = model; this.modelTime = 0;
    this.rig.root.visible = false; this.group.add(model.group);
  }
  setClass(classId) {
    if (classId === this.classId) return;
    if (this.rig) { this.group.remove(this.rig.root); this.rig.dispose(); }
    this.rig = new Character(classId, { scale: SCALE }); this.classId = classId;
    this.rig.root.visible = !this.model;
    this.group.add(this.rig.root);
    this.rig.on(event => { if (GAME_EFFECTS.has(event.type)) this.effects.trigger(event, this.rig); });
  }
  // Called every frame by Game; binds once the character exists (after creation/load).
  bindCombat(game) {
    if (this.combat || !game?.ready) return;
    this.combat = game.combat;
    if (CAST_ANIMS[game.character.classId]) this.setClass(game.character.classId);
    game.combat.on('cast', ({ skillId }) => {
      const anim = CAST_ANIMS[this.classId]?.[skillId];
      if (anim) this.rig.play(anim[0], { speed: anim[1], force: true });
    });
  }
  // Moves along `direction` (normalised, on the ground plane), sliding along obstacles.
  move(direction, dt, world, running) {
    const p = this.group.position;
    if (!direction.lengthSq()) { this.animate(dt, 0, world); return true; }
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
    if (moved) this.rig.cancel(); // walking away interrupts a skill
    this.animate(dt, moved ? speed : 0, world);
    return moved;
  }
  // speed: ground speed in m/s; the walk/run cycle is synced to it so feet don't slide.
  animate(dt, speed, world) {
    if (this.model) { this.modelTime += dt; this.model.update(dt, this.modelTime, speed > 0, null); this.effects.update(dt); return; }
    const motion = this.rig.update(dt, speed / SCALE);
    if (motion && world) { // root motion of dash/leap skills
      const p = this.group.position, r = this.group.rotation.y, x = p.x + Math.sin(r) * motion, z = p.z + Math.cos(r) * motion;
      if (world.canStand(x, z)) { p.x = x; p.z = z; p.y = world.heightAt(x, z); }
    }
    this.effects.update(dt);
  }
}
