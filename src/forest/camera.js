import * as THREE from 'three';

// 2.5D follow camera in the Ragnarok mould: a narrow-FOV perspective camera
// looking down at ~45°, so the ground reads almost flat while characters and
// trees keep their height. Right-drag orbits (yaw freely, pitch within limits),
// the wheel zooms, R resets. All tuning lives in CAMERA.
export const CAMERA = {
  fov: 26,                       // narrow = flatter, more "isometric" perspective
  pitch: 45, minPitch: 30, maxPitch: 62,   // degrees below the horizon
  distance: 34, minDistance: 20, maxDistance: 52,
  near: 1, far: 260,
  lookHeight: 1.0,               // aim at the chest so the fighter sits mid-screen
  yawPerPixel: .006, pitchPerPixel: .004, zoomPerDelta: .025,
  follow: 5, turn: 8, dolly: 6,  // smoothing rates (1/s)
};

const deg = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;

export class FollowCamera {
  constructor(options = {}) {
    this.o = { ...CAMERA, ...options };
    this.camera = new THREE.PerspectiveCamera(this.o.fov, 16 / 9, this.o.near, this.o.far);
    this.focus = new THREE.Vector3();
    this.yaw = 0; this.pitch = deg(this.o.pitch); this.distance = this.o.distance;
    this.target = { yaw: 0, pitch: this.pitch, distance: this.distance };
    // Screen-relative ground axes for WASD; refreshed every update.
    this.forward = new THREE.Vector3(0, 0, -1); this.right = new THREE.Vector3(1, 0, 0);
    this.drag = null;
  }
  resize(width, height) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  snap(p) { this.focus.copy(p); this.place(); }
  reset() { this.target.yaw = 0; this.target.pitch = deg(this.o.pitch); this.target.distance = this.o.distance; }

  dragStart(x, y) { this.drag = { x, y, yaw: this.target.yaw, pitch: this.target.pitch }; }
  dragMove(x, y) {
    if (!this.drag) return false;
    this.target.yaw = this.drag.yaw - (x - this.drag.x) * this.o.yawPerPixel;
    this.target.pitch = clamp(this.drag.pitch + (y - this.drag.y) * this.o.pitchPerPixel, deg(this.o.minPitch), deg(this.o.maxPitch));
    return true;
  }
  dragEnd() { this.drag = null; }
  get dragging() { return this.drag !== null; }
  zoom(deltaY) { this.target.distance = clamp(this.target.distance + deltaY * this.o.zoomPerDelta, this.o.minDistance, this.o.maxDistance); }
  // 0 = fully zoomed out, 1 = closest; for a HUD zoom indicator.
  get zoomLevel() { return 1 - (this.target.distance - this.o.minDistance) / (this.o.maxDistance - this.o.minDistance); }

  update(dt, p) {
    const t = this.target, k = r => 1 - Math.exp(-dt * r);
    this.yaw += (t.yaw - this.yaw) * k(this.o.turn);
    this.pitch += (t.pitch - this.pitch) * k(this.o.turn);
    this.distance += (t.distance - this.distance) * k(this.o.dolly);
    this.focus.lerp(p, k(this.o.follow));
    this.place();
  }
  place() {
    const { focus: f, yaw, pitch, distance: d } = this;
    this.camera.position.set(f.x + Math.sin(yaw) * Math.cos(pitch) * d, f.y + Math.sin(pitch) * d, f.z + Math.cos(yaw) * Math.cos(pitch) * d);
    this.camera.lookAt(f.x, f.y + this.o.lookHeight, f.z);
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)); this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }
}
