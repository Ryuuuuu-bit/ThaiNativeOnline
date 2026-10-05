import * as THREE from 'three';
import { windUniforms } from './shaders.js';
import { CEMETERY, wildness, cemeteryFactor, insideWalls } from './CityMap.js';
import { createRng } from './rng.js';

// Screen-space soft sprites sized in world units (orthographic camera).
export const spriteScale = { value: 40 };

export class Sprites {
  constructor(scene, max, { additive = true, flicker = 0, dynamic = false } = {}) {
    this.max = max; this.count = 0;
    this.position = new Float32Array(max * 3); this.color = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.phase = new Float32Array(max);
    const g = this.geometry = new THREE.BufferGeometry();
    const attr = (name, array, n) => { const a = new THREE.BufferAttribute(array, n); if (dynamic) a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.attrs = [attr('position', this.position, 3), attr('aColor', this.color, 3), attr('aSize', this.size, 1), attr('aAlpha', this.alpha, 1), attr('aPhase', this.phase, 1)];
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: spriteScale, uIntensity: { value: 1 }, uTime: windUniforms.uTime, uFlicker: { value: flicker } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aPhase;
        uniform float uScale; uniform float uIntensity; uniform float uTime; uniform float uFlicker; varying vec3 vColor; varying float vAlpha;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale;
          float f = 1. - uFlicker * (.22 + .22 * sin(uTime * 9. + aPhase * 7.) * sin(uTime * 5.3 + aPhase * 3.));
          vAlpha = aAlpha * uIntensity * f; vColor = aColor; }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha;
        void main() { float d = length(gl_PointCoord - .5) * 2.; float a = pow(max(0., 1. - d), 1.7) * vAlpha; if (a < .004) discard; gl_FragColor = vec4(vColor, a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  push(x, y, z, size, color, alpha = 1, phase = Math.random() * 6) {
    if (this.count >= this.max) return -1;
    const i = this.count++, c = new THREE.Color(color);
    this.position.set([x, y, z], i * 3); this.color.set([c.r, c.g, c.b], i * 3); this.size[i] = size; this.alpha[i] = alpha; this.phase[i] = phase;
    return i;
  }
  commit() { this.geometry.setDrawRange(0, this.count); for (const a of this.attrs) a.needsUpdate = true; }
}

function fogTexture() {
  const rng = createRng(5), canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = rng() * 256, y = rng() * 256, r = rng.range(20, 60);
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class Atmosphere {
  constructor(scene, ctx) {
    const rng = createRng(77);
    this.terrain = ctx.terrain;
    // Lanterns glow only after dusk; forges, spirit flames and some candles always burn.
    this.night = new Sprites(scene, ctx.glows.length + 4, { flicker: 1 });
    this.always = new Sprites(scene, ctx.glows.length + 4, { flicker: 1 });
    for (const g of ctx.glows) {
      const always = ['fire', 'spirit', 'candle-always'].includes(g.kind);
      (always ? this.always : this.night).push(g.x, g.y, g.z, g.size * (g.kind === 'beacon' ? 2.4 : 2.1), g.color, g.kind === 'spirit-night' ? .9 : .85);
    }
    this.night.commit(); this.always.commit();
    // Warm pools of light on the ground beneath lanterns and fires (one draw call).
    const lit = ctx.glows.filter(g => ['lantern', 'candle', 'fire', 'beacon'].includes(g.kind));
    const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 64;
    const pg = poolCanvas.getContext('2d'), grad = pg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.45, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    pg.fillStyle = grad; pg.fillRect(0, 0, 64, 64);
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(poolCanvas), color: '#ffae5c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }), Math.max(1, lit.length));
    const d = new THREE.Object3D();
    lit.forEach((g, i) => {
      d.position.set(g.x, this.terrain.height(g.x, g.z) + .08, g.z); d.scale.setScalar(Math.min(9, g.size * (g.kind === 'beacon' ? 3 : 4.2))); d.updateMatrix();
      this.pools.setMatrixAt(i, d.matrix);
    });
    this.pools.count = lit.length; this.pools.renderOrder = 3; this.pools.frustumCulled = false; scene.add(this.pools);

    // Smoke from forges, kitchens and incense.
    this.emitters = ctx.smokes.map(s => ({ rate: 1, size: 1, color: '#9a978f', rise: 1, ...s, acc: rng() }));
    this.smoke = new Sprites(scene, 520, { additive: false, dynamic: true });
    this.smoke.count = this.smoke.max; this.smoke.alpha.fill(0);
    this.smokeLife = new Float32Array(this.smoke.max); this.smokeAge = new Float32Array(this.smoke.max).fill(99); this.smokeEmitter = new Int16Array(this.smoke.max);
    this.smokeNext = 0;
    this.smoke.commit();

    // Ambient motes around the camera: dust by day, fireflies at night, wisps in the deep forest.
    this.ambient = new Sprites(scene, 320, { dynamic: true });
    this.ambientHome = new Float32Array(320 * 3);
    for (let i = 0; i < 320; i++) {
      this.ambientHome.set([rng.range(-32, 32), rng.range(.4, 5), rng.range(-26, 26)], i * 3);
      this.ambient.push(0, 0, 0, i % 3 === 2 ? .6 : i % 3 === 0 ? .22 : .32, i % 3 === 0 ? '#fff1bd' : i % 3 === 1 ? '#d8ff8a' : '#8fe6ff', 0, rng() * 6);
    }
    this.ambient.commit();
    // Spirits drifting among the graves.
    this.spirits = new Sprites(scene, 70, { dynamic: true });
    this.spiritSeed = [];
    for (let i = 0; i < 70; i++) { this.spiritSeed.push([rng() * 6.28, Math.sqrt(rng()) * CEMETERY.r, rng.range(.4, 3), rng.range(.05, .2)]); this.spirits.push(0, 0, 0, rng.range(.4, 1), rng() > .3 ? '#9fe8ff' : '#c8ffd8', 0); }
    this.spirits.commit();

    // Falling leaves.
    const leafMat = new THREE.MeshStandardMaterial({ color: '#bead66', side: THREE.DoubleSide, transparent: true, opacity: .8 });
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.12, .22), leafMat, 50); this.leaves.frustumCulled = false; scene.add(this.leaves);
    this.leafSeed = Array.from({ length: 50 }, () => [rng.range(-18, 18), rng.range(-14, 14), rng() * 8, rng() * 6]);
    this.dummy = new THREE.Object3D();

    // Low ground fog sheets that thicken in the deep forest and the cemetery.
    const fogTex = fogTexture();
    this.fogSheets = [0, 1, 2].map(i => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: fogTex, color: '#dfe6e0', transparent: true, opacity: 0, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.material.map = fogTex.clone(); m.material.map.repeat.set(2.2 + i * .4, 2.2 + i * .4);
      scene.add(m); return m;
    });
    this.enabled = true;
  }
  setEnabled(on) { this.enabled = on; for (const o of [this.ambient.points, this.spirits.points, this.leaves]) o.visible = on; }

  update(t, dt, focus, env) {
    const w = wildness(focus.z), cem = cemeteryFactor(focus.x, focus.z);
    this.night.material.uniforms.uIntensity.value = env.lantern;
    this.always.material.uniforms.uIntensity.value = .55 + .45 * env.night;
    this.pools.material.opacity = env.lantern * .55; this.pools.visible = env.lantern > .02;

    // Smoke particles.
    const s = this.smoke, wind = windUniforms.uWind.value;
    for (let e = 0; e < this.emitters.length; e++) {
      const em = this.emitters[e];
      if (Math.abs(em.x - focus.x) > 60 || Math.abs(em.z - focus.z) > 60) continue;
      if (em.when === 'cook' && !(env.hour > 5.5 && env.hour < 9 || env.hour > 16.5 && env.hour < 19.5)) continue;
      em.acc += dt * em.rate * 2.2;
      while (em.acc > 1) {
        em.acc -= 1;
        const i = this.smokeNext; this.smokeNext = (i + 1) % s.max;
        this.smokeAge[i] = 0; this.smokeLife[i] = 3 + Math.random() * 2.5; this.smokeEmitter[i] = e;
        s.position.set([em.x + (Math.random() - .5) * .3, em.y, em.z + (Math.random() - .5) * .3], i * 3);
        const c = new THREE.Color(em.color); s.color.set([c.r, c.g, c.b], i * 3);
      }
    }
    for (let i = 0; i < s.max; i++) {
      if (this.smokeAge[i] > this.smokeLife[i]) { s.alpha[i] = 0; continue; }
      const em = this.emitters[this.smokeEmitter[i]], k = this.smokeAge[i] / this.smokeLife[i];
      this.smokeAge[i] += dt;
      s.position[i * 3] += dt * (.25 + wind * .9); s.position[i * 3 + 1] += dt * (.55 * em.rise) * (1 - k * .5); s.position[i * 3 + 2] += dt * .08;
      s.size[i] = em.size * (.6 + k * 2.2); s.alpha[i] = Math.sin(Math.PI * Math.min(1, k * 1.4)) * .32 * (1 - k * .5);
    }
    s.attrs[0].needsUpdate = s.attrs[1].needsUpdate = s.attrs[2].needsUpdate = s.attrs[3].needsUpdate = true;

    if (!this.enabled) return;
    // Ambient motes wrap around the focus.
    const a = this.ambient, field = insideWalls(focus.x, focus.z) ? .6 : 1;
    for (let i = 0; i < 320; i++) {
      const hx = this.ambientHome[i * 3], hy = this.ambientHome[i * 3 + 1], hz = this.ambientHome[i * 3 + 2];
      let x = hx + t * (.15 + wind * .35) * (i % 3 === 2 ? .3 : 1), z = hz + Math.sin(t * .2 + i) * .8;
      x = ((x - focus.x + 32) % 64 + 64) % 64 - 32 + focus.x; z = ((z - focus.z + 26) % 52 + 52) % 52 - 26 + focus.z;
      const y = this.terrain.height(x, z) + hy + Math.sin(t * .6 + i) * .25;
      a.position.set([x, y, z], i * 3);
      const kind = i % 3, blink = .5 + .5 * Math.sin(t * 2.4 + i * 1.7);
      a.alpha[i] = kind === 0 ? .3 * (1 - env.night) * (1 - w * .8) * (1 - cem)
        : kind === 1 ? env.night * blink * field * (1 - cem) * .9
        : (w * .22 + cem * .45) * (.1 + .9 * env.night) * (.6 + .4 * blink);
    }
    a.attrs[0].needsUpdate = a.attrs[3].needsUpdate = true;
    // Graveyard spirits.
    const near = Math.hypot(focus.x - CEMETERY.x, focus.z - CEMETERY.z) < 110;
    this.spirits.points.visible = near;
    if (near) {
      const sp = this.spirits;
      this.spiritSeed.forEach(([ang, r, hh, speed], i) => {
        const aa = ang + t * speed, x = CEMETERY.x + Math.cos(aa) * r, z = CEMETERY.z + Math.sin(aa) * r;
        sp.position.set([x, this.terrain.height(x, z) + hh + Math.sin(t * .8 + i) * .4, z], i * 3);
        sp.alpha[i] = (.05 + .95 * env.night) * (.5 + .5 * Math.sin(t * 1.3 + i * 2.1)) * .75;
      });
      sp.attrs[0].needsUpdate = sp.attrs[3].needsUpdate = true;
    }
    // Leaves drift down where there are trees overhead.
    const leafy = Math.max(.25, w) * (1 - cem * .5);
    for (let i = 0; i < 50; i++) {
      const [lx, lz, lp, ph] = this.leafSeed[i], cycle = (t * .2 + lp) % 8, d = this.dummy;
      d.position.set(focus.x + lx + cycle * wind, this.terrain.height(focus.x + lx, focus.z + lz) + 6 - cycle * .75, focus.z + lz + Math.sin(cycle + ph));
      d.rotation.set(cycle, ph + t * .3, Math.sin(t + ph)); d.scale.setScalar(i < 50 * leafy ? 1 : 0); d.updateMatrix(); this.leaves.setMatrixAt(i, d.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    // Ground fog.
    const fogAmount = Math.min(1, w * .45 + cem * .6) * (.55 + .45 * env.night);
    this.fogSheets.forEach((m, i) => {
      m.visible = fogAmount > .02;
      m.position.set(focus.x + Math.sin(t * .02 + i) * 6, this.terrain.height(focus.x, focus.z) + .5 + i * .45, focus.z);
      m.material.opacity = fogAmount * (.34 - i * .08);
      m.material.map.offset.set(t * .004 * (i + 1) + m.position.x / 90 * (2.2 + i * .4), t * .002 - m.position.z / 90 * (2.2 + i * .4));
      m.material.color.set(env.night > .5 ? '#9fb0b8' : '#dfe6e0');
    });
  }
}
