import * as THREE from 'three';
import { gltfLoader } from '../../core/gltf.js';
import { V, C, rand, SH } from './engine.js';

// A straw training dummy (หุ่นซ้อม) to hit with skills. It lives in the FX root,
// so all numbers are in FX-local units (see engine.js K). It takes damage,
// shows an HP bar, flinches, can be knocked back and stunned, breaks apart at
// 0 HP and is rebuilt a few seconds later.
// The look is the wooden DPS dummy model (public/models/training-dummy.glb, a Tripo
// model decimated in Blender); the simple straw one stands in until it loads (or if it can't).
// opts: { hp, onHit(event) } — onHit gets { amount, crit, miss, bleed, killed } for damage logs.
const HEIGHT = 2.05;   // FX units, the same as the old straw dummy
let model = null;
const loadModel = () => (model ??= gltfLoader().loadAsync(`${import.meta.env.BASE_URL}models/training-dummy.glb`).then(g => g.scene));

export function createDummy(fx, labels, at, groundHeight, { hp = 2600, onHit } = {}) {
  const group = new THREE.Group(); fx.add(group);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: .9 });
  const straw = new THREE.MeshStandardMaterial({ color: 0xc9a85e, roughness: 1, emissive: 0x000000 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x9c2b25, roughness: .85, emissive: 0x000000 });
  const part = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
  const body = new THREE.Group(); group.add(body);
  part(new THREE.CylinderGeometry(.05, .06, 2.0, 8), wood, 0, 1.0, 0);
  part(new THREE.CylinderGeometry(.3, .26, .75, 12), straw, 0, 1.25, 0);
  part(new THREE.CylinderGeometry(.31, .31, .12, 12), cloth, 0, 1.45, 0);
  part(new THREE.SphereGeometry(.22, 12, 10), straw, 0, 1.85, 0);
  part(new THREE.CylinderGeometry(.035, .035, 1.2, 6), wood, 0, 1.5, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) part(new THREE.SphereGeometry(.09, 8, 6), straw, s * .6, 1.5, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, .12, 14), wood); base.position.y = .06; base.castShadow = base.receiveShadow = true; group.add(base);
  // swap in the model: scaled to HEIGHT, feet on the ground, centred; it flashes with the same hit tint
  const glow = [straw, cloth];
  loadModel().then(src => {
    const m = src.clone(true), box = new THREE.Box3().setFromObject(m), k = HEIGHT / (box.max.y - box.min.y);
    m.scale.setScalar(k); m.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    m.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; o.material = o.material.clone(); o.material.emissive ??= new THREE.Color(); glow.push(o.material); });
    for (const c of [...body.children]) { body.remove(c); c.geometry.dispose(); }
    group.remove(base); base.geometry.dispose();
    body.add(m); glow.splice(0, 2);
  }).catch(() => { /* keep the straw dummy */ });

  const bar = document.createElement('div'); bar.className = 'fx-hp'; bar.innerHTML = '<i></i>'; labels.appendChild(bar);
  const d = { group, pos: fx.toLocal(at).setY(0), off: V(), alive: true, hp, maxHp: hp, barY: 2.25, stun: false, tint: 0, mob: true };
  d.chest = () => d.pos.clone().add(d.off).setY(1.25);
  d.head = () => d.pos.clone().add(d.off).setY(d.barY + .2);

  // exact: the amount is already rolled (rules damage), so skip the ±10% spread.
  d.hurt = (amt, crit, push = .25, from, exact = false) => {
    if (!d.alive) return 0;
    const v = exact ? Math.round(amt) : Math.round(amt * rand(.9, 1.1)); d.hp -= v; d.tint = 1;
    fx.popup(d.head(), String(v), 'dmg' + (crit ? ' big' : ''));
    onHit?.({ amount: v, crit, killed: d.hp <= 0 });
    const dir = d.pos.clone().sub(from ?? d.pos.clone().add(V(0, 0, 1))).setY(0).normalize().multiplyScalar(push);
    fx.addTask((dt, t) => { const k = Math.sin(Math.min(1, t / .25) * Math.PI); body.rotation.x = -dir.z * k * .8; body.rotation.z = dir.x * k * .8; if (t > .25) { body.rotation.set(0, 0, 0); return false; } });
    if (d.hp <= 0) die();
    return v;
  };
  d.miss = () => { fx.popup(d.head(), 'MISS', 'st'); onHit?.({ amount: 0, miss: true }); };
  d.knock = (dir, dist, dur = .3) => {
    const to = dir.clone().setY(0).normalize().multiplyScalar(dist);
    fx.addTask((dt, t) => { const u = Math.min(1, t / dur); d.off.copy(to).multiplyScalar(Math.sin(u * Math.PI / 2) * (1 - Math.max(0, (u - .7) / .3)));
      if (Math.random() < .6) fx.emit({ p: d.pos.clone().add(d.off).setY(.08), v: V(rand(-.3, .3), rand(.2, .5), rand(-.3, .3)), c: C(.48, .4, .26), life: .5, size: .25, size1: .5, shape: SH.soft, a: .5 }, fx.PN);
      if (u >= 1) { d.off.set(0, 0, 0); return false; } });
  };
  d.bleed = () => {
    let n = 0;
    fx.addTask((dt, t) => {
      if (Math.random() < dt * 10) fx.emit({ p: d.chest().add(V(rand(-.25, .25), rand(-.2, .4), .1)), v: V(rand(-.3, .3), rand(0, .5), 0), c: C(1.4, .12, .12), life: .6, size: .07, grav: 5, a: .9 });
      if (t > .6 * (n + 1) && n < 3) { n++; if (d.alive) { d.hp -= 30; fx.popup(d.head(), '30', 'hurt'); onHit?.({ amount: 30, bleed: true, killed: d.hp <= 0 }); if (d.hp <= 0) die(); } }
      if (t > 1.9) return false;
    });
  };
  function die() {
    d.alive = false;
    fx.burst(d.chest(), 40, { c: [C(.8, .66, .36), C(.6, .48, .25)], S: fx.PN, size: .18, sp: 3, upMin: .3, life: 1.2, shape: SH.leaf, a: .9, grav: 4 });
    fx.addTask((dt, t) => { body.rotation.x = -Math.min(1, t / .5) * 1.45; body.position.y = -Math.min(1, t / .5) * .3; if (t > .5) return false; });
    fx.after(3.2, () => { d.hp = d.maxHp; d.alive = true; body.rotation.set(0, 0, 0); body.position.y = 0;
      fx.burst(d.pos.clone().setY(.4), 24, { c: C(.9, .8, .5), size: .08, sp: 2, upMin: .5, life: .8, shape: SH.star }); fx.popup(d.head(), 'หุ่นซ้อมพร้อม', 'st'); });
  }
  d.update = dt => {
    group.position.copy(d.pos).add(d.off);
    // Sit on the real ground even though the FX root follows the player's height.
    const w = fx.toWorld(group.position); group.position.y = (groundHeight(w.x, w.z) - fx.root.position.y) / fx.K;
    d.tint = Math.max(0, d.tint - dt * 4);
    for (const m of glow) m.emissive.setRGB(d.tint * .45, d.tint * .38, d.tint * .28);
    // turn its painted target toward the camera (the side the player hits it from)
    const cam = fx.cameraLocal(), want = Math.atan2(cam.x - group.position.x, cam.z - group.position.z);
    group.rotation.y += Math.atan2(Math.sin(want - group.rotation.y), Math.cos(want - group.rotation.y)) * Math.min(1, dt * 3);
    const s = fx.toScreen(V(d.pos.x + d.off.x, d.barY, d.pos.z + d.off.z));
    bar.style.left = s.x + 'px'; bar.style.top = s.y + 'px'; bar.style.display = s.vis && d.alive ? '' : 'none';
    bar.firstChild.style.width = (100 * Math.max(0, d.hp) / d.maxHp) + '%';
  };
  return d;
}
