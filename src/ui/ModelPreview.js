import * as THREE from 'three';
import { makeModelCharacter } from '../classes/model.js';
import { avatarFor } from '../data/training.js';
import { CLASS_KITS } from '../classes/index.js';
import { createFx, K } from '../classes/fx/engine.js';
import { createDummy } from '../classes/fx/dummy.js';

// A small turntable that shows a class's 3D model (AVATARS in
// src/data/training.js) on the entry screens: idle animation, a three-quarter
// view that drifts back after you drag to turn it, play(clip) to show a move, skill(id)
// to show a class-kit skill with its full FX on a straw dummy beside the model (the
// same runner as the training ground, src/training). One WebGL context; call
// dispose() before the world starts.
//
//   const preview = new ModelPreview(hostElement);
//   preview.show('herbalist'); preview.skill('heal_vine'); preview.dispose();
//
// The camera orbits the model (the world stays still) so skill FX, which live in
// world space, line up with the moving fighter.
const FOV = 26, REST_YAW = .35; // facing a little toward the key light
const DUMMY_AT = new THREE.Vector3(1.6, 0, -.35), DEMO_ANGLE = .12, HOLD = 1.3;

// The canvas is transparent over the stage's CSS background. Additive FX write alpha 1
// across their whole quad, which would show as black boxes there, so blend their colour
// additively but leave the canvas alpha untouched (the page then adds the glow too).
function keepAlpha(root) {
  root.traverse(o => {
    for (const m of [].concat(o.material ?? [])) {
      if (m.blending !== THREE.AdditiveBlending) continue;
      Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    }
  });
}

export class ModelPreview {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, .1, 60);
    // Warm key from the front-left, cool rim from behind: the game's day palette.
    this.scene.add(new THREE.HemisphereLight('#fff1d6', '#23362c', 1.5));
    // The lights turn with the camera, so the model is lit the same from every side.
    const key = new THREE.DirectionalLight('#ffe3b0', 2.6); key.castShadow = true;
    key.shadow.mapSize.setScalar(1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -1, near: .5, far: 14 });
    const rim = new THREE.DirectionalLight('#9fc4ff', 1.4);
    this.lights = [[key, new THREE.Vector3(-1.2, 5, 1.6)], [rim, new THREE.Vector3(2, 3, -3)]];
    this.scene.add(key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), new THREE.ShadowMaterial({ opacity: .35 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    // Soft contact shadow right under the feet, so the figure reads as standing on the floor.
    const blob = document.createElement('canvas'); blob.width = blob.height = 64;
    const bg = blob.getContext('2d'), grad = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(.55, 'rgba(0,0,0,.25)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = grad; bg.fillRect(0, 0, 64, 64);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = .003; contact.scale.set(.85, .55, 1); this.scene.add(contact);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .66, 64), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .55 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .005; this.scene.add(ring);

    this.turntable = new THREE.Group(); this.scene.add(this.turntable);
    this.models = new Map(); this.current = null; this.yaw = REST_YAW; this.drag = null; this.time = 0;
    // Skill demo: camera eases between the rest framing and one that also holds the dummy.
    this.demo = 0; this.demoOn = false; this.hold = 0;
    this.view = null;
    // FX overlays: damage numbers, the dummy's HP bar, the dim flash and the skill vignette.
    const div = cls => { const d = document.createElement('div'); d.className = cls; host.appendChild(d); return d; };
    this.vignette = div('fx-vignette'); this.dim = div('fx-dim'); this.labels = div('fx-labels');

    const el = r.domElement;
    el.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * .01; });
    for (const n of ['pointerup', 'pointercancel']) el.addEventListener(n, () => { this.drag = null; });
    this.resizer = new ResizeObserver(() => this.resize()); this.resizer.observe(host);
    this.resize();
    let last = performance.now();
    const frame = now => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min((now - last) / 1000, .05)); last = now;
      this.step(dt);
      if (this.current?.kit) keepAlpha(this.current.kit.fx.root);
      r.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  step(dt) {
    const e = this.current, kit = e?.kit;
    // Hit-stop: heavy blows freeze the fighter and the effects for a few frames.
    const sdt = kit && kit.fx.stop > 0 ? dt * .06 : dt;
    if (kit) kit.fx.stop = Math.max(0, kit.fx.stop - dt);
    this.time += sdt;
    this.host.classList.toggle('loading', !!e && !e.loaded);
    if (kit) {
      kit.skills.update(sdt);
      // the demo lasts while the skill plays and its effects run (a ward can outlive the cast), at most 6 s past it
      if (kit.skills.busy) { this.hold = HOLD; this.tail = 6; }
      else if (this.demoOn && ((this.tail -= dt) <= 0 || (kit.fx.tasks === 0 ? (this.hold -= dt) <= 0 : false))) this.endDemo();
      kit.fx.update(sdt, this.time, 0); kit.dummy.update(sdt);
      if (!kit.dummy.group.visible) kit.bar.style.display = 'none';
      this.vignette.style.opacity = kit.fx.mood.toFixed(3);
    }
    // While a skill plays the runner turns the fighter; afterwards it walks back to its mark.
    const c = e?.character;
    if (c && kit && !this.demoOn && !kit.skills.busy) {
      const p = c.group.position, k = 1 - Math.exp(-dt * 6);
      p.x -= p.x * k; p.z -= p.z * k; p.y = 0;
    }
    c?.update(sdt, this.time, false, kit?.skills.busy ? kit.skills.facing : this.demoOn ? null : 0);

    // No idle spin: after a drag the view eases back to its three-quarter angle.
    this.demo += ((this.demoOn ? 1 : 0) - this.demo) * (1 - Math.exp(-dt * 3.5));
    if (!this.drag) this.yaw += ((this.demoOn ? -DEMO_ANGLE : REST_YAW) - this.yaw) * (1 - Math.exp(-dt * 1.5));
    this.place(dt, kit?.fx);
  }

  resize() {
    const w = Math.max(this.host.clientWidth, 1), h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    for (const e of this.models.values()) e.kit?.fx.resize();
    this.place(0);
  }
  // Orbit the camera (and its lights) around the model: `yaw` turns the view as the
  // old turntable turned the model. Rest framing fits a figure of the avatar's height
  // aimed a little above the waist; the demo framing also fits the dummy.
  place(dt, fx) {
    const height = this.current?.avatar.height ?? 1.8, t = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), a = this.camera.aspect;
    const rest = { x: 0, y: height * .5, eye: height * .62, dist: (height * .62) / t / Math.min(1, a * 1.4) };
    const H = height * 1.25 * .58, W = DUMMY_AT.x + 1.45;
    const demo = { x: DUMMY_AT.x * .6, y: H * .9, eye: H * 1.15, dist: Math.max(H / t, W / 2 / t / a) * 1.08 };
    const k = this.demo, mix = n => rest[n] + (demo[n] - rest[n]) * k;
    const ang = -this.yaw, dist = mix('dist') - (fx?.punchV ?? 0) * .35, s = fx?.shake ?? 0, j = () => (Math.random() - .5) * s * .25;
    const cx = mix('x'), cz = DUMMY_AT.z * .5 * k;
    this.camera.position.set(cx + Math.sin(ang) * dist + j(), mix('eye') + j(), cz + Math.cos(ang) * dist);
    this.camera.lookAt(cx, mix('y'), cz);
    for (const [light, base] of this.lights) light.position.copy(base).applyAxisAngle(THREE.Object3D.DEFAULT_UP, ang);
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
      entry.ready.then(() => { if (!this.disposed) this.kitOf(entry); });
      this.models.set(avatar.url, entry);
    }
    if (this.current !== entry) { if (this.current?.kit) this.stopKit(this.current); this.endDemo(true); }
    for (const e of this.models.values()) { e.character.group.visible = e === entry; if (e.kit) e.kit.fx.root.visible = e === entry; }
    this.current = entry; this.place(0);
    return entry.ready;
  }
  // The class's skill runner, FX and dummy, built once the model has loaded.
  kitOf(entry) {
    const def = CLASS_KITS[entry.avatar.skills];
    if (entry.kit || !def || !entry.loaded) return entry.kit ?? null;
    const fx = createFx({ scene: this.scene, camera: this.camera, renderer: this.renderer, labels: this.labels, size: K * entry.avatar.height / 2.6 });
    const dummy = createDummy(fx, this.labels, DUMMY_AT.clone(), () => 0, { hp: 6000 });
    const bar = this.labels.lastElementChild; // its HP bar
    dummy.group.visible = false;
    const ground = () => 0;
    const skills = def.createSkills({ fx, character: entry.character, player: entry.character.group, dummy, groundHeight: ground, labels: this.labels, dim: this.dim, damage: () => null });
    // what the kit keeps for good (particles, lights, dummy, the herbalist's book); anything else in the FX root is a skill's
    const keep = new Set(fx.root.children);
    entry.kit = { def, fx, dummy, skills, bar, keep };
    fx.root.visible = entry === this.current;
    return entry.kit;
  }
  // Shows skill `id` of the shown class with its FX on the dummy. Returns false when it
  // can't (no kit, still loading, a skill already playing); the caller can play() the clip instead.
  skill(id) {
    const e = this.current, kit = e && this.kitOf(e);
    if (!kit || !kit.def.skills.some(s => s.id === id)) return false;
    if (kit.skills.busy) return true; // one at a time: ignore clicks until it ends
    // Start from the mark, facing the dummy.
    e.character.group.position.set(0, 0, 0);
    kit.dummy.group.visible = true; this.demoOn = true; this.hold = HOLD;
    return kit.skills.cast(id, true) !== false;
  }
  // Leaving a class mid-skill: drop its effects and timers so nothing resumes later.
  stopKit(entry) {
    const { fx, skills, bar, keep } = entry.kit;
    fx.clearTasks();
    for (const o of [...fx.root.children]) if (!keep.has(o)) fx.kill(o); skills.busyUntil = skills.time; skills.facing = null;
    fx.mood = fx.moodTarget = 0; fx.stop = 0; fx.shake = 0; fx.punchV = 0;
    bar.style.display = 'none'; this.dim.style.opacity = '0'; this.vignette.style.opacity = '0';
    this.labels.querySelectorAll('.fx-combo, .fx-pop').forEach(el => el.remove());
    entry.character.group.position.set(0, 0, 0);
  }
  endDemo(now = false) {
    this.demoOn = false;
    for (const e of this.models.values()) if (e.kit) { e.kit.dummy.group.visible = false; if (now) e.character.group.position.set(0, 0, 0); }
    if (now) this.demo = 0;
  }
  // Plays a one-shot clip on the shown model; `fallback` when the model lacks `clip`.
  play(clip, fallback) {
    const c = this.current?.character;
    if (!c) return;
    c.attack(c.has(clip) ? clip : fallback);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.resizer.disconnect();
    for (const e of this.models.values()) e.kit?.fx.clearTasks();
    this.labels.remove(); this.dim.remove(); this.vignette.remove();
    this.scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
