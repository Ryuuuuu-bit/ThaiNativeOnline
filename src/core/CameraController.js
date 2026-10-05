import * as THREE from 'three';
import { fadeUniforms } from '../world/shaders.js';
import { spriteScale } from '../world/Atmosphere.js';

// Orthographic 2.5D camera from the prototype: follows the player, right-drag
// pans, wheel zooms. The view keeps the same angle everywhere in the city.
export class CameraController {
  constructor(renderer, host) {
    this.renderer = renderer; this.host = host;
    this.camera = new THREE.OrthographicCamera(-20, 20, 12, -12, .1, 220);
    this.offset = new THREE.Vector3(15, 23, 22);
    this.focus = new THREE.Vector3(); this.desired = new THREE.Vector3(); this.panOffset = new THREE.Vector3();
    this.zoom = 1; this.panned = false;
    this.forward = new THREE.Vector3(-this.offset.x, 0, -this.offset.z).normalize();
    this.right = new THREE.Vector3().crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();
    fadeUniforms.uFadeDir.value.copy(this.offset).normalize();
    this.resize();
  }
  // Zoom only touches the projection; resizing the canvas reallocates its buffers.
  updateProjection() {
    const width = this.host.clientWidth, height = Math.max(this.host.clientHeight, 1), aspect = width / height, half = 13 / this.zoom;
    Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    this.camera.updateProjectionMatrix();
    spriteScale.value = height * this.renderer.getPixelRatio() / (half * 2);
  }
  resize() { this.renderer.setSize(this.host.clientWidth, this.host.clientHeight); this.updateProjection(); }
  setZoom(z) { this.zoom = THREE.MathUtils.clamp(z, .5, 1.7); this.updateProjection(); }
  reset() { this.recenter(); this.setZoom(1); }
  // Drops a right-drag pan so the camera follows the player again (zoom is kept).
  recenter() { this.panned = false; this.panOffset.set(0, 0, 0); }
  pan(dxPixels, dyPixels, start) {
    const toWorld = (this.camera.top - this.camera.bottom) / this.host.clientHeight;
    this.panOffset.copy(start).addScaledVector(this.right, -dxPixels * toWorld).addScaledVector(this.forward, dyPixels * toWorld * 1.5);
    this.panOffset.clampLength(0, 34); this.panned = true;
  }
  snap(target) { this.focus.copy(target); this.place(target); }
  update(dt, target) {
    this.desired.copy(target).add(this.panOffset); this.desired.y = target.y * .6;
    this.focus.lerp(this.desired, 1 - Math.exp(-dt * 4));
    this.place(target);
  }
  place(target) {
    this.camera.position.copy(this.focus).add(this.offset); this.camera.lookAt(this.focus);
    fadeUniforms.uFadeCenter.value.set(target.x, target.y + .9, target.z);
  }
  // Ray from the screen to the terrain surface, refined against height.
  groundPoint(clientX, clientY, heightAt) {
    const rect = this.host.getBoundingClientRect(), ndc = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const { origin, direction } = ray.ray; let y = 0, p = new THREE.Vector3();
    for (let i = 0; i < 4; i++) { const t = (y - origin.y) / direction.y; p = origin.clone().addScaledVector(direction, t); y = heightAt(p.x, p.z); }
    return p;
  }
}
