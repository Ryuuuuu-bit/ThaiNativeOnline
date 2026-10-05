import * as THREE from 'three';

// Lightweight skill effects driven by animation events (no external assets).
const textures = {};
function tex(name, paint, size = 128) {
  if (textures[name]) return textures[name];
  const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (textures[name] = t);
}
const soft = () => tex('soft', (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const ghost = () => tex('ghost', (g, s) => {
  const r = g.createRadialGradient(s / 2, s * .42, 0, s / 2, s * .5, s * .48); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.6, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.ellipse(s / 2, s * .45, s * .3, s * .4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(30,0,40,.85)';
  for (const k of [-1, 1]) { g.beginPath(); g.ellipse(s / 2 + k * s * .1, s * .4, s * .055, s * .08, k * .3, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(s / 2, s * .62, s * .08, s * .05, 0, 0, Math.PI * 2); g.fill();
}, 128);
const rune = () => tex('rune', (g, s) => {
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = s * .012; g.translate(s / 2, s / 2);
  for (const r of [.47, .4, .25]) { g.beginPath(); g.arc(0, 0, s * r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 9; i++) {
    g.save(); g.rotate(i / 9 * Math.PI * 2);
    g.beginPath(); g.moveTo(0, -s * .25); g.lineTo(0, -s * .4); g.stroke();
    g.beginPath(); g.arc(0, -s * .435, s * .018, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(s * .04, -s * .33, s * .03, Math.PI * .2, Math.PI * 1.6); g.stroke();
    g.restore();
  }
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * s * .22, Math.sin(a) * s * .22); } g.closePath(); g.stroke();
}, 256);
const arcTex = () => tex('arc', (g, s) => {
  const lg = g.createLinearGradient(0, 0, s, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.75, 'rgba(255,255,255,.7)'); lg.addColorStop(1, '#fff');
  g.fillStyle = lg; g.fillRect(0, 0, s, s);
  const vg = g.createLinearGradient(0, 0, 0, s); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = vg; g.fillRect(0, 0, s, s);
});
// Light effects glow additively; dark magic (purple, crimson) uses normal
// blending so it stays saturated over the bright forest floor.
let darkMode = false;
const blend = () => darkMode ? THREE.NormalBlending : THREE.AdditiveBlending;
const additive = (color, map, opacity = 1) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: blend(), side: THREE.DoubleSide });
const spriteMat = (color, map = soft()) => new THREE.SpriteMaterial({ color, map, transparent: true, depthWrite: false, blending: blend() });

export class Effects {
  constructor(scene) { this.scene = scene; this.items = []; }
  add(obj, life, update) { this.scene.add(obj); this.items.push({ obj, life, age: 0, update }); }
  frame(c) { // character facing frame in world space
    const pos = c.root.getWorldPosition(new THREE.Vector3()), q = c.root.getWorldQuaternion(new THREE.Quaternion());
    return { pos, q, fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(q), side: new THREE.Vector3(1, 0, 0).applyQuaternion(q) };
  }
  particles(origin, count, color, { spread = .3, vel = [0, 1, 0], speed = 1, size = .12, life = 1, gravity = 0, map, swirl = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(spriteMat(color, map)); s.scale.setScalar(size);
      s.position.copy(origin).add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread));
      const v = new THREE.Vector3(...vel).add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.8)).multiplyScalar(speed);
      const l = life * (.6 + Math.random() * .6), center = origin.clone();
      this.add(s, l, (o, t, dt) => {
        v.y -= gravity * dt; o.position.addScaledVector(v, dt);
        if (swirl) { const r = o.position.clone().sub(center); r.y = 0; o.position.add(new THREE.Vector3(-r.z, 0, r.x).multiplyScalar(swirl * dt)); }
        o.material.opacity = Math.sin(Math.PI * Math.min(1, t / l)); o.scale.setScalar(size * (1 + t));
      });
    }
  }
  trigger(e, c) {
    const f = this.frame(c), color = new THREE.Color(e.color || '#ffffff');
    darkMode = ['spirits', 'curse', 'ritual'].includes(e.type);
    const ahead = (d, h) => f.pos.clone().addScaledVector(f.fwd, d).setY(f.pos.y + h);
    switch (e.type) {
      case 'slash': case 'spin': {
        const spin = e.type === 'spin';
        const g = new THREE.RingGeometry(spin ? .55 : .5, spin ? .85 : .95, 48, 1, 0, spin ? Math.PI * 2 : Math.PI * 1.1);
        const m = new THREE.Mesh(g, additive(color, arcTex(), .95));
        m.position.copy(f.pos).setY(f.pos.y + (spin ? .9 : 1.05)); m.quaternion.copy(f.q);
        m.rotateX(-Math.PI / 2 + (e.mirror ? .25 : -.2)); m.rotateZ(spin ? 0 : (e.mirror ? Math.PI * 1.4 : -.3));
        this.add(m, .4, (o, t) => { o.material.opacity = .95 * (1 - t / .4); o.scale.setScalar(1 + t * .8); o.rotateZ((e.mirror ? -1 : 1) * .12); });
        break;
      }
      case 'impact': {
        const p = e.bone ? c.bonePoint(e.bone) : ahead(.5, 1.1);
        const m = new THREE.Mesh(new THREE.RingGeometry(.05, .12, 32), additive(color, null, .9));
        m.position.copy(p); m.quaternion.copy(f.q);
        this.add(m, .3, (o, t) => { o.scale.setScalar(1 + t * 6); o.material.opacity = .75 * (1 - t / .3); });
        this.particles(p, 14, color, { spread: .1, vel: [0, .4, 0], speed: 2.2, size: .07, life: .35 });
        break;
      }
      case 'spirits': {
        for (let i = 0; i < 5; i++) {
          const s = new THREE.Sprite(spriteMat(color, ghost())); const a0 = i / 5 * Math.PI * 2, h0 = .4 + Math.random() * .5;
          this.add(s, 2.2, (o, t) => {
            const a = a0 + t * 1.6, r = .55 + t * .35;
            o.position.copy(f.pos).add(new THREE.Vector3(Math.cos(a) * r, h0 + t * .55, Math.sin(a) * r));
            o.scale.setScalar(.35 + .25 * Math.sin(t * 3 + i)); o.material.opacity = Math.sin(Math.PI * t / 2.2) * .9;
          });
        }
        this.particles(f.pos.clone().setY(f.pos.y + .3), 30, color, { spread: 1.2, vel: [0, .8, 0], speed: .6, size: .25, life: 1.8, swirl: 1.5 });
        break;
      }
      case 'curse': {
        const start = c.bonePoint('LeftHand', [0, -.08, 0]), orb = new THREE.Sprite(spriteMat(color)); orb.scale.setScalar(.35);
        this.add(orb, 1.1, (o, t, dt) => {
          o.position.copy(start).addScaledVector(f.fwd, t * 6); o.material.opacity = 1 - Math.max(0, t - .8) / .3;
          if (Math.random() < .6) this.particles(o.position, 1, '#d23b68', { spread: .1, vel: [0, .3, 0], speed: .4, size: .15, life: .5 });
        });
        const r = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), additive('#d23b68', rune(), .9));
        r.position.copy(start); r.quaternion.copy(f.q);
        this.add(r, .8, (o, t) => { o.rotateZ(.05); o.material.opacity = .9 * (1 - t / .8); o.scale.setScalar(1 + t); });
        break;
      }
      case 'ritual': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), additive(color, rune(), 0));
        m.rotation.x = -Math.PI / 2; m.position.copy(f.pos).setY(f.pos.y + .02);
        this.add(m, 2.1, (o, t) => { o.rotation.z += .004; o.material.opacity = Math.min(1, t * 2) * Math.min(1, (2.1 - t) * 2) * .85; });
        this.particles(f.pos.clone().setY(f.pos.y + .2), 24, '#ff9a5a', { spread: 1.8, vel: [0, 1, 0], speed: .5, size: .07, life: 1.8 });
        break;
      }
      case 'heal': case 'lotus': {
        const origin = e.type === 'lotus' ? c.bonePoint('RightHand', [0, -.1, 0]).add(new THREE.Vector3(0, .25, 0)) : f.pos.clone().setY(f.pos.y + .05);
        if (e.type === 'heal') {
          const m = new THREE.Mesh(new THREE.RingGeometry(.3, 1.1, 48), additive(color, soft(), .6)); m.rotation.x = -Math.PI / 2; m.position.copy(origin);
          this.add(m, 1.6, (o, t) => { o.material.opacity = .6 * Math.sin(Math.PI * t / 1.6); o.scale.setScalar(.8 + t * .3); });
          this.particles(origin, 36, color, { spread: 1.4, vel: [0, 1.1, 0], speed: .7, size: .1, life: 1.6, swirl: 2 });
        } else {
          const lotus = new THREE.Group();
          for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), additive(color, null, .7)); p.scale.set(.5, 1.4, .25); p.position.set(Math.sin(i * .785) * .07, .08, Math.cos(i * .785) * .07); p.rotation.set(Math.cos(i * .785) * .6, 0, -Math.sin(i * .785) * .6); lotus.add(p); }
          lotus.position.copy(origin);
          this.add(lotus, 1.4, (o, t) => { o.rotation.y += .03; const s = Math.min(1, t * 3) * (1 + t * .2); o.scale.setScalar(s); o.children.forEach(p => p.material.opacity = .75 * Math.min(1, (1.4 - t) * 2)); });
          this.particles(origin, 20, color, { spread: .3, vel: [0, 1, 0], speed: .8, size: .08, life: 1.4 });
        }
        break;
      }
      case 'toss': {
        const start = c.bonePoint('RightHand', [0, -.08, 0]), orb = new THREE.Sprite(spriteMat(color)); orb.scale.setScalar(.22);
        const v = f.fwd.clone().multiplyScalar(5).setY(3);
        this.add(orb, .9, (o, t) => {
          o.position.copy(start).addScaledVector(v, t).setY(start.y + v.y * t - 4.9 * t * t);
          if (t > .85 && !o.userData.burst) { o.userData.burst = true; this.particles(o.position, 26, color, { spread: .2, vel: [0, 1.2, 0], speed: 1.4, size: .12, life: .8, gravity: 2 }); }
        });
        break;
      }
      case 'release': {
        if (!c.arrow) break;
        const a = c.arrow.clone(); a.visible = true; a.userData.shared = true; c.arrow.getWorldPosition(a.position); c.arrow.getWorldQuaternion(a.quaternion);
        const dir = c.arrowDirection();
        this.add(a, .9, (o, t, dt) => { o.position.addScaledVector(dir, dt * 22); if (Math.random() < .7) this.particles(o.position, 1, color, { spread: .02, vel: [0, 0, 0], speed: 0, size: .05, life: .25 }); });
        break;
      }
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.age += dt;
      if (it.age >= it.life) { this.scene.remove(it.obj); if (!it.obj.userData.shared) it.obj.traverse(o => { if (!o.isSprite) o.geometry?.dispose(); o.material?.dispose?.(); }); this.items.splice(i, 1); continue; }
      it.update?.(it.obj, it.age, dt);
    }
  }
}
