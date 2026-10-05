import * as THREE from 'three';
import { M, mat } from '../world/materials.js';

// The traveller from the first prototype, now with sprinting and walkable
// decks (piers, bridges). Speed is tuned to the city's travel-time targets.
export const WALK_SPEED = 4.2, RUN_SPEED = 6.8;

function mesh(geometry, material, parent, x = 0, y = 0, z = 0, scale) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

export class Player {
  constructor(scene) {
    const group = this.group = new THREE.Group(); scene.add(group);
    const skin = mat('#cd9b72'), shirt = mat('#e7d9ad'), pants = mat('#665e4a'), sash = mat('#944b35'), hair = mat('#302b24');
    const body = this.body = new THREE.Group(); group.add(body);
    mesh(new THREE.SphereGeometry(.2, 12, 10), skin, body, 0, 1.28, 0, [1, 1.12, 1]);
    mesh(new THREE.SphereGeometry(.205, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), hair, body, 0, 1.34, -.015);
    mesh(new THREE.SphereGeometry(.075, 8, 8), hair, body, 0, 1.51, -.08);
    mesh(new THREE.CylinderGeometry(.16, .22, .47, 8), shirt, body, 0, .86, 0);
    mesh(new THREE.CylinderGeometry(.22, .22, .1, 8), sash, body, 0, .65, 0);
    this.legs = []; this.arms = [];
    for (const sign of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sign * .105, .61, 0); body.add(leg);
      mesh(new THREE.CylinderGeometry(.095, .075, .42, 7), pants, leg, 0, -.2, 0);
      mesh(new THREE.SphereGeometry(.09, 8, 6), M.darkWood, leg, 0, -.47, .04, [1, .5, 1.7]); this.legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(sign * .2, 1.03, 0); body.add(arm);
      mesh(new THREE.CylinderGeometry(.075, .055, .4, 7), skin, arm, sign * .035, -.19, 0); this.arms.push(arm);
    }
    const sword = mesh(new THREE.BoxGeometry(.035, .67, .06), M.stone, body, -.26, .68, -.15); sword.rotation.z = -.28;
    mesh(new THREE.BoxGeometry(.18, .05, .08), M.wood, body, -.34, .98, -.15);
    const ring = mesh(new THREE.RingGeometry(.36, .4, 48), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }), group, 0, .04, 0);
    ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
    this.phase = 0;
  }
  get position() { return this.group.position; }
  // Moves along `direction` (normalised, on the ground plane), sliding along obstacles.
  move(direction, dt, world, running) {
    const p = this.group.position;
    if (!direction.lengthSq()) { this.animate(dt, 0); return true; }
    const speed = (running ? RUN_SPEED : WALK_SPEED) * world.speedAt(p.x, p.z) * dt;
    const x = p.x + direction.x * speed, z = p.z + direction.z * speed, startX = p.x, startZ = p.z;
    if (world.canStand(x, z)) { p.x = x; p.z = z; }
    else {
      if (world.canStand(x, p.z)) p.x = x;
      if (world.canStand(p.x, z)) p.z = z;
    }
    // Real displacement: a slide attempt that keeps the same x or z is not progress.
    const moved = Math.hypot(p.x - startX, p.z - startZ) > speed * .05;
    p.y = world.heightAt(p.x, p.z);
    const target = Math.atan2(direction.x, direction.z), r = this.group.rotation;
    r.y += Math.atan2(Math.sin(target - r.y), Math.cos(target - r.y)) * Math.min(1, dt * 14);
    this.animate(dt, moved ? (running ? 1.5 : 1) : 0);
    return moved;
  }
  animate(dt, pace) {
    this.phase += dt * (pace ? 12 * pace : 2);
    const t = this.phase;
    this.body.position.y = pace ? Math.sin(t) * .025 * pace : Math.sin(t) * .012;
    this.legs.forEach((leg, i) => { leg.rotation.x = pace ? Math.sin(t + i * Math.PI) * .45 * Math.min(1.3, pace) : 0; });
    this.arms.forEach((arm, i) => { arm.rotation.x = pace ? Math.sin(t + i * Math.PI) * -.35 * Math.min(1.3, pace) : 0; });
  }
}
