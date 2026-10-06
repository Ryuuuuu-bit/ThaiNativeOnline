import * as THREE from 'three';
import { makeModelCharacter } from '../classes/model.js';
import { avatarFor } from '../data/training.js';

// A small turntable that shows a class's 3D model (AVATARS in
// src/data/training.js) on the entry screens: idle animation, slow spin,
// drag to turn, play(clip) to show a skill move. One WebGL context; call
// dispose() before the world starts.
//
//   const preview = new ModelPreview(hostElement);
//   preview.show('herbalist'); preview.play('toss'); preview.dispose();
const FOV = 26, SPIN = .35;

export class ModelPreview {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, .1, 60);
    // Warm key from the front-left, cool rim from behind: the game's day palette.
    this.scene.add(new THREE.HemisphereLight('#fff1d6', '#23362c', 1.5));
    const key = new THREE.DirectionalLight('#ffe3b0', 2.6); key.position.set(-2.5, 4, 3); key.castShadow = true;
    key.shadow.mapSize.setScalar(1024); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .5, far: 12 });
    const rim = new THREE.DirectionalLight('#9fc4ff', 1.4); rim.position.set(2, 3, -3);
    this.scene.add(key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: .35 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .66, 64), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .55 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .005; this.scene.add(ring);

    this.turntable = new THREE.Group(); this.scene.add(this.turntable);
    this.models = new Map(); this.current = null; this.yaw = .45; this.drag = null; this.time = 0;

    const el = r.domElement;
    el.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * .01; });
    for (const n of ['pointerup', 'pointercancel']) el.addEventListener(n, () => { this.drag = null; });
    this.resizer = new ResizeObserver(() => this.resize()); this.resizer.observe(host);
    this.resize();
    let last = performance.now();
    const frame = now => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, .05); last = now; this.time += dt;
      if (!this.drag) this.yaw += dt * SPIN;
      this.turntable.rotation.y = this.yaw;
      this.host.classList.toggle('loading', !!this.current && !this.current.loaded);
      this.current?.character.update(dt, this.time, false, null);
      r.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  resize() {
    const w = Math.max(this.host.clientWidth, 1), h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.current) this.frame(this.current.avatar.height);
  }
  // Fit a figure of `height` metres in view, aimed a little above the waist.
  frame(height) {
    const dist = (height * .62) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / Math.min(1, this.camera.aspect * 1.4);
    this.camera.position.set(0, height * .62, dist); this.camera.lookAt(0, height * .5, 0);
  }

  // Shows the class's model (loaded once, then cached). Resolves when it is visible.
  show(classId) {
    const avatar = avatarFor(classId);
    let entry = this.models.get(avatar.url);
    if (!entry) {
      const character = makeModelCharacter(this.scene, null, { url: `${import.meta.env.BASE_URL}${avatar.url}`, height: avatar.height, guardClip: 'idle' });
      this.turntable.add(character.group);
      entry = { avatar, character, loaded: false };
      entry.ready = character.ready.catch(error => { console.warn(`preview ${avatar.url} failed to load`, error); }).finally(() => { entry.loaded = true; });
      this.models.set(avatar.url, entry);
    }
    for (const e of this.models.values()) e.character.group.visible = e === entry;
    this.current = entry; this.frame(avatar.height);
    return entry.ready;
  }
  // Plays a one-shot clip on the shown model; `fallback` when the model lacks `clip`.
  play(clip, fallback) {
    const c = this.current?.character;
    if (!c) return;
    c.attack(c.has(clip) ? clip : fallback);
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.resizer.disconnect();
    this.scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
