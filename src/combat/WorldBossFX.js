import * as THREE from 'three';

// World boss skills on the floor (server/monsters.js casts them, src/net/NetCombat.js passes them on):
//   fx.cast({ skill, spots: [{x, z, r}], warn })   a warning mark that fills up until the blow lands
//   fx.land({ skill, spots })                      the blow: a burst of light and dust, rings
//   fx.zone({ skill, spots, secs })                pools that stay (น้ำตาเลือด)
//   fx.update(dt)                                  once a frame
// Colours: the bride's skills burn red, the elder sister's are violet-black.
const COLOR = {
  claw: 0xff2a14, pounce: 0xff3a14, tears: 0xb00a0a,
  hands: 0x8a4cff, hands_all: 0x8a4cff, wail: 0xd8d0ff, warp: 0x6a50a0,
};
function tex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// Marks float a little above the ground so plank floors and rugs (เรือนหอร้าง's teak floor) do not hide them.
const LIFT = .3;
let T = null;
const textures = () => T ??= {
  ring: tex(256, (g, s) => {
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, 7); g.stroke();
    g.lineWidth = 2.5; for (let i = 0; i < 24; i++) { const a = i / 24 * 7 + Math.random() * .2, r0 = s / 2 - 8, r1 = r0 - 18 - Math.random() * 40; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0); g.lineTo(s / 2 + Math.cos(a + .06) * r1, s / 2 + Math.sin(a + .06) * r1); g.stroke(); }
  }),
  disc: tex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(.8, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }),
  glow: tex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }),
};

export class WorldBossFX {
  constructor(scene, heightAt = () => 0) {
    this.root = new THREE.Group(); this.root.name = 'world-boss-fx'; scene.add(this.root);
    this.heightAt = heightAt; this.items = [];
  }
  flat(map, x, z, size, color, { additive = true, opacity = 1 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, this.heightAt(x, z) + LIFT, z); m.scale.setScalar(size); m.renderOrder = 3;
    this.root.add(m); return m;
  }
  add(obj, life, step) { this.items.push({ obj, life, t: 0, step }); }
  cast({ skill, spots = [], warn = 1 }) {
    const color = COLOR[skill] ?? 0xff2020;
    for (const s of spots) {
      const ring = this.flat(textures().ring, s.x, s.z, s.r * 2, color), fill = this.flat(textures().disc, s.x, s.z, .01, color, { opacity: .8 });
      this.add(ring, warn, (u, t) => { ring.material.opacity = .65 + .35 * Math.sin(t * 22); ring.rotation.z += .01; });
      this.add(fill, warn, u => fill.scale.setScalar(Math.max(.01, s.r * 2 * u)));
    }
  }
  land({ skill, spots = [] }) {
    const color = COLOR[skill] ?? 0xff2020;
    for (const s of spots) {
      const y = this.heightAt(s.x, s.z) + LIFT;
      for (let k = 0; k < 2; k++) {
        const ring = this.flat(textures().ring, s.x, s.z, s.r * 2 * .4, color);
        this.add(ring, .55 + k * .15, u => { ring.scale.setScalar(s.r * 2 * (.4 + 1.1 * Math.pow(u, .6))); ring.material.opacity = 1 - u; });
      }
      const flash = this.flat(textures().disc, s.x, s.z, s.r * 2.4, color);
      this.add(flash, .5, u => { flash.material.opacity = .9 * (1 - u); });
      // sparks or shadow wisps thrown up out of the mark
      const dark = skill === 'hands' || skill === 'hands_all' || skill === 'warp';
      for (let i = 0; i < 18; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().glow, color: dark ? 0x1a0a2a : color, transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending }));
        const a = Math.random() * Math.PI * 2, d = Math.random() * s.r, v = new THREE.Vector3(Math.cos(a) * 1.5, 2 + Math.random() * 3, Math.sin(a) * 1.5);
        sp.position.set(s.x + Math.cos(a) * d, y + .2, s.z + Math.sin(a) * d); sp.scale.setScalar(dark ? .5 : .25);
        this.root.add(sp);
        this.add(sp, .9, (u, t, dt) => { v.y -= 6 * dt; sp.position.addScaledVector(v, dt); sp.material.opacity = 1 - u; sp.scale.setScalar((dark ? .5 : .25) * (1 + u)); });
      }
      // the elder's hands: dark arms with pale claws rising out of the floor
      if (skill === 'hands' || skill === 'hands_all') for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, hand = new THREE.Group();
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 1, 6), new THREE.MeshBasicMaterial({ color: 0x07060a }));
        const palm = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd8d0c4 }));
        arm.position.y = .5; palm.position.y = 1.02; hand.add(arm, palm);
        for (let f = -1; f <= 1; f++) { const n = new THREE.Mesh(new THREE.ConeGeometry(.016, .14, 4), new THREE.MeshBasicMaterial({ color: 0xff1010 })); n.position.set(f * .04, 1.14, 0); hand.add(n); }
        hand.position.set(s.x + Math.cos(a) * s.r * .55, y - 1.1, s.z + Math.sin(a) * s.r * .55); hand.rotation.set(-Math.sin(a) * .35, 0, Math.cos(a) * .35);
        this.root.add(hand);
        this.add(hand, 1.1, u => { hand.position.y = y + (u < .2 ? -1.1 + 1.1 * u / .2 : u > .7 ? -1.1 * (u - .7) / .3 : 0); });
      }
    }
  }
  zone({ skill, spots = [], secs = 8 }) {
    const color = COLOR[skill] ?? 0x900000;
    for (const s of spots) {
      const pool = this.flat(textures().disc, s.x, s.z, s.r * 2, color, { additive: false, opacity: .85 });
      const rim = this.flat(textures().ring, s.x, s.z, s.r * 2, color);
      this.add(pool, secs, (u, t) => { pool.material.opacity = (u > .85 ? (1 - u) / .15 : 1) * (.7 + .15 * Math.sin(t * 3)); });
      this.add(rim, secs, (u, t) => { rim.material.opacity = (u > .85 ? (1 - u) / .15 : 1) * (.35 + .25 * Math.sin(t * 4)); });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      const u = Math.min(1, it.t / it.life); it.step?.(u, it.t, dt);
      if (it.t >= it.life) { this.root.remove(it.obj); it.obj.traverse?.(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.items.splice(i, 1); }
    }
  }
  clear() { for (const it of this.items) this.root.remove(it.obj); this.items = []; }
}
