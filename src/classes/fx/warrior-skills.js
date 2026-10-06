import * as THREE from 'three';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { WARRIOR_SKILLS } from '../warrior-moves.js';

// The warrior's (นักรบ · ขุนศึกดาบคู่) ten skills with their effects, timed to the warrior's
// clips (blow times come from warrior-moves.js). Positions are FX-local units.
// Both swords leave a swept trail of light while they cut (the trail is built from the
// real blades, see bladeAt), so every slash draws its own arc; the blows land on the
// clip's hit frames.
const { GOLD, WHITE } = COL;
const BASE = import.meta.env.BASE_URL + 'fx/warrior/';
export const warriorIconUrl = id => BASE + 'icon_' + id + '.png';

const CRIMSON = C(2.4, .35, .25), EMBER = C(2.6, 1.2, .35), STEEL = C(1.6, 1.8, 2.2), WIND = C(1.1, 2.2, 1.7), BOLT = C(1.5, 1.9, 2.8), BLOOD = C(1.2, .08, .08);
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
// sword-local points (the swords are parented to the hands; blade along local +Y)
const HILT = .06, TIP = .37;

let SIGIL_TEX = null;
function sigilTex() {
  if (SIGIL_TEX) return SIGIL_TEX;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round';
  const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  circ(246, 7); circ(229, 2); circ(150, 4); circ(58, 3);
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, r0 = i % 4 ? 233 : 210; g.lineWidth = i % 4 ? 2 : 5; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 243, Math.sin(a) * 243); g.stroke(); }
  // eight crossed blades
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * Math.PI * 2); g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -60); g.quadraticCurveTo(14, -130, 0, -205); g.quadraticCurveTo(-8, -130, -10, -60); g.stroke(); g.restore(); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + .2; g.beginPath(); g.arc(Math.cos(a) * 186, Math.sin(a) * 186, 5, 0, 7); g.fill(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
  SIGIL_TEX = new THREE.CanvasTexture(c); SIGIL_TEX.colorSpace = THREE.SRGBColorSpace; return SIGIL_TEX;
}
// The standard: a red banner with a golden garuda-wing emblem.
let FLAG_TEX = null;
function flagTex() {
  if (FLAG_TEX) return FLAG_TEX;
  const c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#b3161c'); gr.addColorStop(1, '#6e0a0e'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 330); g.lineTo(128, 384); g.lineTo(0, 330); g.closePath(); g.fill();
  g.strokeStyle = '#e8b64c'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 300);
  g.fillStyle = '#f2c35a'; g.save(); g.translate(128, 170);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { g.save(); g.scale(s, 1); g.rotate(-1.2 + i * .2); g.beginPath(); g.ellipse(0, -62, 9, 58, 0, 0, 7); g.fill(); g.restore(); }
  g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill(); g.fillStyle = '#b3161c'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.restore();
  FLAG_TEX = new THREE.CanvasTexture(c); FLAG_TEX.colorSpace = THREE.SRGBColorSpace; return FLAG_TEX;
}

export function createWarriorSkills({ fx, character, player, dummy, groundHeight, labels, damage }) {
  const MOVES = Object.fromEntries(WARRIOR_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 12 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 760 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy, tpos = () => tg.pos.clone().add(tg.off);
  const dirTo = () => tpos().sub(hero.pos()).setY(0).normalize();
  const sideOf = d => V(d.z, 0, -d.x);
  const add = (o, c) => o.clone().add(c);
  const face = p => { const d = p.clone().sub(hero.pos()); R.facing = Math.atan2(d.x, d.z); };
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback); return m; };
  const hits = (id, fn) => MOVES[id].hits.forEach((t, i) => fx.after(t, () => fn(i, MOVES[id].hits.length)));
  const near = (P, r) => tg.alive && tpos().distanceTo(P) <= r;
  const hurt = (amt, crit, push = .12, id = R.current) => {
    const r = damage?.(id);
    if (!r || !r.dmg) return tg.hurt(amt, crit, push, hero.pos());
    if (!r.hit) return tg.miss();
    return tg.hurt(r.dmg, r.crit, push, hero.pos(), true);
  };
  const heal = (amt, cls = 'heal') => { const v = Math.round(amt); hero.hp = Math.min(hero.maxHp, hero.hp + v); fx.popup(hero.pos().setY(hero.barY + .2), '+' + v, cls); };
  // a point on a sword (k: 0 hilt … 1 tip), FX-local; falls back to the hands / chest
  const sword = side => character.node?.('sword_' + side);
  const handP = side => { const b = character.bone?.(side === 'L' ? 'LeftHand' : 'RightHand'); return b ? fx.toLocal(b.getWorldPosition(new THREE.Vector3())) : chest(hero).add(sideOf(dirTo()).multiplyScalar(side === 'L' ? -.3 : .3)); };
  function bladeAt(side, k = 1) {
    const s = sword(side); if (!s) return add(handP(side), dirTo().multiplyScalar(.2 + .6 * k));
    return fx.toLocal(s.localToWorld(V(0, HILT + (TIP - HILT) * k, 0)));
  }

  // ---- light ---------------------------------------------------------------------------
  const streakTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000'); gr.addColorStop(.3, '#444'); gr.addColorStop(.46, '#fff'); gr.addColorStop(.54, '#fff'); gr.addColorStop(.7, '#444'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })();
  // camera-facing ribbon through points (newest first)
  function strip(col, w = .08, n = 16) {
    const pos = new Float32Array(n * 6), cl = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (let i = 0; i < n; i++) uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, map: streakTex, ...ADD })); m.frustumCulled = false; m.renderOrder = 6; fx.add(m);
    const pts = [], tv = V(), vv = V(), sv = V();
    const S = { alpha: 1, w,
      push(p) { pts.unshift(p.clone()); if (pts.length > n) pts.length = n; },
      set(list) { pts.length = 0; list.slice(0, n).forEach(p => pts.push(p.clone())); },
      draw() {
        const L = pts.length; if (!L) return; const cam = fx.cameraLocal(), g = fx.gain * S.alpha * .6;
        for (let i = 0; i < n; i++) {
          const p = pts[Math.min(i, L - 1)], a = pts[Math.max(0, Math.min(i, L - 1) - 1)], b = pts[Math.min(L - 1, i + 1)];
          tv.subVectors(a, b); if (tv.lengthSq() < 1e-8) tv.set(0, 1, 0);
          vv.subVectors(cam, p); const taper = i >= L ? 0 : 1 - i / (n - 1);
          sv.crossVectors(tv, vv).normalize().multiplyScalar(S.w * (.25 + .75 * taper));
          pos.set([p.x + sv.x, p.y + sv.y, p.z + sv.z, p.x - sv.x, p.y - sv.y, p.z - sv.z], i * 6);
          const k = Math.pow(taper, 1.4) * g; cl.set([col.r * k, col.g * k, col.b * k, col.r * k, col.g * k, col.b * k], i * 6);
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      },
      kill() { fx.kill(m); },
    };
    return S;
  }
  function bolt(a, b, col, life = .35, w = .05, jag = .2) {
    const n = 14, s = strip(col, w, n); let next = 0;
    fx.addTask((dt, t) => {
      if (t >= next) { next = t + .05; const list = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), j = i && i < n - 1 ? jag : 0; list.push(a.clone().lerp(b, u).add(V(rand(-j, j), rand(-j, j), rand(-j, j)))); } s.set(list); }
      s.alpha = 1 - t / life; s.draw(); if (t > life) { s.kill(); return false; }
    });
  }
  // The swept trail of a sword: the surface between the hilt and the tip over the last
  // frames, bright at the edge, fading with age. Runs from t0 to t1 (s from now).
  function sweep(side, col, t0, t1, { n = 22, k0 = .25 } = {}) {
    const pos = new Float32Array(n * 6), cl = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (let i = 0; i < n; i++) uv.set([.5, 0, .5, 1], i * 4);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, ...ADD })); m.frustumCulled = false; m.renderOrder = 6; fx.add(m);
    const pairs = []; let fade = 1;
    fx.addTask((dt, t) => {
      if (t < t0) return;
      if (t <= t1) { pairs.unshift([bladeAt(side, k0), bladeAt(side, 1)]); if (pairs.length > n) pairs.length = n; }
      else { fade -= dt / .22; if (pairs.length) pairs.pop(); }
      const L = pairs.length; if (!L || fade <= 0) { if (t > t1) { fx.kill(m); return false; } return; }
      const g = fx.gain * .32 * Math.max(0, fade);
      for (let i = 0; i < n; i++) {
        const [a, b] = pairs[Math.min(i, L - 1)], age = i >= L ? 0 : Math.pow(1 - i / Math.max(1, n - 1), 1.6);
        pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        const kb = age * g * .15, kt = age * g;
        cl.set([col.r * kb, col.g * kb, col.b * kb, col.r * kt, col.g * kt, col.b * kt], i * 6);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      if (t <= t1 && Math.random() < .5) fx.emit({ p: bladeAt(side, rand(.6, 1)), v: V(rand(-.4, .4), rand(-.2, .5), rand(-.4, .4)), c: Math.random() < .3 ? WHITE : col, life: .3, size: .06, size1: .01, shape: SH.star });
    });
  }
  const sweepBoth = (col, t0, t1, o) => { sweep('L', col, t0, t1, o); sweep('R', col, t0, t1, o); };
  const planeGeo = new THREE.PlaneGeometry(2, 2), ringGeo = new THREE.RingGeometry(.9, 1, 56);
  planeGeo.userData.shared = ringGeo.userData.shared = true;
  function sigil(col, r, { p, dir, life = 1.5, spin = 1, grow = .3, delay = 0 } = {}) {
    const G = new THREE.Group(), m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: sigilTex(), color: col.clone().multiplyScalar(fx.gain * .55), ...ADD, opacity: 0 }));
    G.add(m); fx.add(G); G.position.copy(p); m.renderOrder = 4;
    if (dir) G.lookAt(fx.toWorld(add(G.position, dir))); else G.rotation.set(-Math.PI / 2, 0, 0);
    m.scale.setScalar(.001);
    fx.addTask((dt, t) => {
      const u = t - delay; if (u < 0) return;
      m.scale.setScalar(r * Math.max(.001, easeOutBack(clamp01(u / grow)))); m.rotation.z += dt * spin;
      m.material.opacity = clamp01(u / .15) * clamp01((life - u) / .35) * (.85 + .15 * Math.sin(u * 20));
      if (u > life) { fx.kill(G); return false; }
    });
    return G;
  }
  function ringPulse(p, dir, col, r = .5, life = .3) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(fx.gain * .22), ...ADD })); fx.add(m);
    m.position.copy(p); m.lookAt(fx.toWorld(add(p, dir)));
    fx.addTask((dt, t) => { const f = t / life; m.scale.setScalar(r * (.25 + f * 1.1)); m.material.opacity = (1 - f) * (1 - f); if (f >= 1) { fx.kill(m); return false; } });
  }
  const blood = (p, n = 10) => fx.burst(p, n, { c: [BLOOD, C(.7, .04, .04)], S: fx.PN, size: .06, sp: 2.5, upMin: .2, life: .6, grav: 7, a: .9 });
  const cut = (p, s = 1, col = CRIMSON) => { fx.impact(p, s, col); fx.burst(p, Math.round(10 * s), { c: [col, WHITE], size: .08, sp: 3.5, life: .4, shape: SH.star, drag: 4 }); };

  // ---- moving the warrior ---------------------------------------------------------------
  function moveTo(to, dur, cb, trail = C(1.4, .5, .3), arc = 0) {
    const from = fx.toWorld(hero.pos()), dest = fx.toWorld(to); face(to);
    fx.addTask((dt, t) => {
      const u = clamp01(t / dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      player.position.x = from.x + (dest.x - from.x) * e; player.position.z = from.z + (dest.z - from.z) * e;
      player.position.y = groundHeight(player.position.x, player.position.z) + Math.sin(Math.PI * u) * arc;
      if (trail && u < 1) for (let k = 0; k < 2; k++) fx.emit({ p: chest(hero).add(V(rand(-.2, .2), rand(-.5, .4), rand(-.2, .2))), c: trail, life: .3, size: .14, size1: .02 });
      if (u >= 1) { cb?.(); return false; }
    });
  }
  // close in to `dist` from the dummy (a quick step), then act
  const stepIn = (dist, cb, dur = .25) => {
    const d = hero.pos().distanceTo(tpos());
    if (Math.abs(d - dist) < .25) { face(tpos()); return cb(); }
    moveTo(tpos().add(hero.pos().sub(tpos()).setY(0).normalize().multiplyScalar(dist)), dur, () => { face(tpos()); cb(); });
  };

  const SK = {
    // 1 · ฟันดาบคู่: three cross cuts that leave crimson arcs; the blade bites, the wound bleeds
    sword_twin() {
      fx.cinematic(.4, 1.3);
      stepIn(1.1, () => { anim('sword_twin');
        sweep('L', CRIMSON, .17, .34); sweep('R', CRIMSON, .38, .5); sweepBoth(EMBER, .56, .72);
        hits('sword_twin', (i, n) => {
          const p = chest(tg).add(V(rand(-.1, .1), rand(-.1, .2), 0)), last = i === n - 1;
          cut(p, last ? 1.2 : .7); blood(p, last ? 16 : 8);
          // each cut is a wide crossing arc over the whole front (ฟันไขว้ · โดนทุกตัวด้านหน้า)
          const o = chest(hero).add(V(0, .2, 0)), arc = (roll, dir) => fx.slashArc(o, tpos(), { r: 1.5, sweep: 2.6, roll, dir, pal: 'red', thick: .45, dur: .09, hold: .05 });
          if (i === 0) arc(.75, 1); else if (i === 1) arc(-.75, -1); else { arc(.75, 1); arc(-.75, -1); fx.shock(tpos().x, tpos().z, 1.5, CRIMSON, BLOOD, .45); }
          if (near(hero.pos(), 2.2)) { hurt(90, last, .1); if (last) { fx.popup(tg.head().add(V(0, .4, 0)), 'เลือดไหล', 'st');
            let k = 0; fx.addTask((dt, t) => { if (Math.random() < dt * 10) blood(chest(tg).add(V(rand(-.2, .2), rand(-.3, .3), 0)), 2); if (t > .6 * (k + 1) && k < 3) { k++; if (tg.alive) hurt(25, false, 0, 'sword_twin'); } return t < 2; }); } }
        });
      });
      return 1.25;
    },
    // 2 · แทงทะลวง: coil, then a lunge straight through the target — both points drive in,
    // the air rings open along the line, armour cracks
    sword_thrust() {
      fx.cinematic(.6, 1.5);
      stepIn(2.2, () => { anim('sword_thrust'); const d = dirTo(), start = hero.pos(), end = add(tpos(), d.clone().multiplyScalar(1.1));
        sweepBoth(STEEL, .25, .45, { k0: .5 });
        // the dash: untouchable while it lasts (อมตะระหว่างพุ่ง) — a gold shell and a wake of light
        fx.after(.2, () => { character.tint?.(C(1, .85, .4), .45, .5); fx.popup(hero.pos().setY(hero.barY + .5), 'อมตะ', 'st');
          const T = strip(GOLD, .5, 12); fx.addTask((dt, t) => { T.push(chest(hero)); T.alpha = clamp01((.55 - t) / .25); T.draw();
            for (let k = 0; k < 4; k++) fx.emit({ p: chest(hero).add(V(rand(-.25, .25), rand(-.7, .6), rand(-.25, .25))), v: d.clone().multiplyScalar(-rand(1, 3)), c: Math.random() < .5 ? GOLD : STEEL, life: .35, size: .1, size1: .02 });
            if (t > .55) { T.kill(); return false; } }); });
        fx.after(.23, () => moveTo(end, .17, null, STEEL));
        fx.after(.4, () => {
          const p = chest(tg); cut(p, 1.5, STEEL); fx.shake = .2;
          for (let i = 0; i < 5; i++) fx.after(i * .025, () => ringPulse(add(start.clone().lerp(end, .3 + i * .15), V(0, .95, 0)), d, STEEL, .5 + i * .06, .35));
          fx.burst(p, 26, { c: [STEEL, WHITE], size: .09, sp: 6, upMin: -.3, life: .45, shape: SH.star, drag: 3 });
          if (near(p, 1.6)) { hurt(200, true, .25); fx.stunStars(tg, .5); fx.popup(tg.head().add(V(0, .4, 0)), 'สะดุ้ง', 'st'); fx.after(.18, () => fx.popup(tg.head().add(V(0, .7, 0)), 'เกราะแตก DEF −30% · 6 วิ', 'st'));
            fx.burst(chest(tg), 14, { c: [C(.7, .65, .55), C(.9, .85, .7)], S: fx.PN, size: .07, sp: 3, life: .6, grav: 6 }); }
        });
      });
      return 1.2;
    },
    // 3 · ดาบวายุ: the blades tear apart and throw a crescent of wind that cuts through the line
    sword_wind() {
      fx.cinematic(.55, 1.6);
      stepIn(2.6, () => { anim('sword_wind');
        sweepBoth(WIND, .3, .55);
        fx.after(.5, () => {
          const d = dirTo(), side = sideOf(d), o = add(hero.pos(), d.clone().multiplyScalar(.6)).setY(1.05), outer = strip(WIND, .2, 13), inner = strip(WHITE, .07, 13);
          ringPulse(o, d, WIND, .6, .3);
          let hit = false; const dist0 = hero.pos().distanceTo(tpos());
          fx.addTask((dt, t) => {
            const u = t / .55, c = add(o, d.clone().multiplyScalar(u * 7)), list = [], list2 = [];
            for (let i = 0; i < 13; i++) { const a = (i / 12 - .5) * 2.2, r = .9 + u * .4; list.push(add(c, side.clone().multiplyScalar(Math.sin(a) * r)).add(d.clone().multiplyScalar(-(1 - Math.cos(a)) * r * .6))); list2.push(add(list[i], d.clone().multiplyScalar(.06))); }
            outer.set(list); inner.set(list2); outer.alpha = inner.alpha = clamp01((1 - u) * 3); outer.draw(); inner.draw();
            for (let k = 0; k < 3; k++) fx.emit({ p: list[(Math.random() * 13) | 0], v: d.clone().multiplyScalar(-rand(.5, 2)).add(V(0, rand(-.3, .3), 0)), c: Math.random() < .3 ? WHITE : WIND, life: .4, size: .09, size1: .02, shape: SH.leaf, vr: 6 });
            if (!hit && u * 7 + .6 >= dist0) { hit = true; const p = chest(tg); cut(p, 1.1, WIND); fx.burst(p, 18, { c: [WIND, WHITE], size: .1, sp: 3, life: .5, shape: SH.leaf, drag: 2 }); if (tg.alive) hurt(170, false, .2); }
            if (u >= 1) { outer.kill(); inner.kill(); return false; }
          });
        });
      });
      return 1.2;
    },
    // 4 · ตั้งการ์ดดาบคู่: blades crossed before the face; a golden ward of crossed swords
    // and a shell of light close round him, wounds knit
    sword_guard() {
      fx.cinematic(.45, 1.6); face(tpos()); anim('sword_guard');
      fx.after(.6, () => {
        const hp = hero.pos(), d = dirTo();
        sigil(GOLD, .75, { p: add(hp, d.clone().multiplyScalar(.45)).setY(1.35), dir: d, life: 1.4, spin: 1.5, grow: .2 });
        sigil(GOLD, 1.3, { p: hp.clone().setY(.06), life: 2.2, spin: -.6 });
        fx.shock(hp.x, hp.z, 1.8, GOLD, C(1, .5, .1), .5); fx.flash(chest(hero), 0xffd070, 30, .5);
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), fx.fresnelMat(C(2, 1.5, .6))); fx.add(shell);
        fx.addTask((dt, t) => { shell.position.copy(hero.pos()).setY(.95); shell.scale.set(.85, 1.15, .85).multiplyScalar(easeOutBack(clamp01(t / .3))); shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = clamp01((2.4 - t) / .5) * fx.gain * .8;
          if (Math.random() < .4) fx.emit({ p: add(hero.pos(), V(rand(-.6, .6), rand(.1, 1.8), rand(-.6, .6))), v: V(0, .5, 0), c: GOLD, life: .6, size: .07, size1: .01 });
          if (t > 2.4) { fx.kill(shell); return false; } });
        character.tint?.(C(1, .8, .35), .3, 1.4);
        heal(hero.maxHp * .15); fx.after(.2, () => fx.popup(hp.clone().setY(hero.barY + .7), 'ป้องกัน +25 · โจมตี +15%', 'st'));
      });
      return 1.3;
    },
    // 5 · เพลงดาบพิฆาต: the sword dance — six cuts in a turning circle, each a red-gold arc,
    // petals of flame on the ground, the last cut a burst
    sword_pikat() {
      fx.cinematic(.85, 2.6);
      stepIn(1.15, () => { anim('sword_pikat'); const P0 = hero.pos();
        sigil(CRIMSON, 1.6, { p: P0.clone().setY(.06), life: 2.4, spin: 2 });
        sweepBoth(EMBER, .12, 1.75, { n: 26 });
        // the clip turns him a full circle between 5/30 and 50/30 s: every cut faces where he faces,
        // so the six arcs ring him round (ร่ายเพลงดาบรอบตัว)
        const d0 = dirTo(), turn = t => { const u = clamp01((t - 5 / 30) / (45 / 30)), e = u * u * (3 - 2 * u), a = Math.PI * 2 * e; return V(d0.x * Math.cos(a) + d0.z * Math.sin(a), 0, -d0.x * Math.sin(a) + d0.z * Math.cos(a)); };
        fx.decal(1, P0.x, P0.z, 2.1, EMBER, null, { life: 2.2, grow: .2 });
        hits('sword_pikat', (i, n) => {
          const last = i === n - 1, f = turn(MOVES.sword_pikat.hits[i]), o = chest(hero).add(V(0, rand(0, .3), 0));
          fx.slashArc(o, add(o, f), { r: 1.5 + (last ? .6 : 0), sweep: last ? 6.2 : 2.6, roll: (i % 2 ? -1 : 1) * rand(.2, .6), dir: i % 2 ? -1 : 1, pal: i % 2 ? 'gold' : 'red', thick: .4, dur: .08, hold: .04 });
          const q = add(P0, f.clone().multiplyScalar(1.3)); fx.decal(2, q.x, q.z, .55, EMBER, CRIMSON, { life: .9, grow: .1 });
          fx.burst(add(o, f.clone().multiplyScalar(1.2)), 10, { c: [EMBER, CRIMSON, WHITE], size: .08, sp: 3, life: .4, shape: SH.star, drag: 3 });
          const p = chest(tg).add(V(rand(-.15, .15), rand(-.15, .25), 0));
          if (near(P0, 2.2)) { cut(p, last ? 1.6 : .7, i % 2 ? EMBER : CRIMSON); blood(p, 6); }
          if (last) { fx.shock(P0.x, P0.z, 2.6, CRIMSON, C(.6, .1, .05), .6); fx.lightPillar(P0, EMBER, 4, .7, .7); fx.shake = .25; }
          if (near(P0, 2.2)) hurt(100, last, .08);
        });
      });
      return 2.1;
    },
    // 6 · ธงชัยเฉลิมพล: he drives a blade into the earth and a red garuda standard rises out of
    // a golden circle behind him, banner streaming, rallying the party
    sword_banner() {
      fx.cinematic(.6, 2.6); face(tpos()); anim('sword_banner');
      fx.after(.4, () => { const b = bladeAt('R', 1); fx.lightPillar(b.clone().setY(0), GOLD, 2.5, .2, .5); fx.burst(b, 14, { c: [GOLD, WHITE], size: .08, sp: 2, life: .5, shape: SH.star }); });
      fx.after(.9, () => {
        // ปักธง: the garuda standard rises from the very spot the blade is driven in
        const hp = hero.pos(), d = dirTo(), at = bladeAt('R', 1).setY(0);
        fx.shock(hp.x, hp.z, 3.6, GOLD, C(1, .45, .1), .8); fx.decal(4, hp.x, hp.z, 2.4, C(2, 1.4, .5), C(.6, .3, .05), { life: 3.2, grow: .2 });
        fx.burst(add(hp, d.clone().multiplyScalar(.4)).setY(.1), 26, { c: [C(.55, .48, .32), C(.4, .33, .22)], S: fx.PN, size: .1, sp: 2.5, upMin: .5, life: .8, grav: 7 });
        fx.flash(at.clone().setY(2), 0xffc060, 40, .8); fx.lightPillar(at, GOLD, 5, .35, .8);
        const G = new THREE.Group(); fx.add(G); G.position.copy(at); G.rotation.y = Math.atan2(sideOf(d).x, sideOf(d).z);
        const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: .8, roughness: .35, emissive: new THREE.Color(.25, .15, .02) });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, 3, 8).translate(0, 1.5, 0), gold); G.add(pole);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 6).translate(0, 3.1, 0), gold); G.add(fin);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .95, 6), gold); bar.rotation.z = Math.PI / 2; bar.position.set(.47, 2.9, 0); G.add(bar);
        const clothGeo = new THREE.PlaneGeometry(.9, 1.35, 12, 10).translate(.47, 2.9 - .675, 0), base = clothGeo.attributes.position.array.slice();
        const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, transparent: true, alphaTest: .5, roughness: .8, emissive: new THREE.Color(.25, .05, .02) })); G.add(cloth);
        fx.addTask((dt, t) => {
          const up = easeOutBack(clamp01(t / .5)); G.scale.setScalar(Math.max(.001, up)); G.position.y = (1 - clamp01(t / .5)) * -1.5;
          const a = clothGeo.attributes.position.array;
          for (let i = 0; i < a.length; i += 3) { const x = base[i] - .02, y = base[i + 1]; a[i + 2] = Math.sin(x * 5 - t * 7 + y * 2) * .08 * x + Math.sin(t * 3 + y) * .02 * x; }
          clothGeo.attributes.position.needsUpdate = true; clothGeo.computeVertexNormals();
          if (Math.random() < .5) fx.emit({ p: add(G.position, V(rand(-.8, .8), rand(.2, 3), rand(-.8, .8))), v: V(0, rand(.4, 1), 0), c: GOLD, life: .8, size: .07, size1: .01 });
          const fade = clamp01((4 - t) / .5); G.scale.setScalar(Math.max(.001, up * fade));
          if (t > 4) { fx.kill(G); return false; }
        });
        character.tint?.(C(1, .55, .2), .18, 1.2);
        fx.popup(hp.clone().setY(hero.barY + .5), '+8%', 'heal');
        fx.after(.25, () => fx.popup(hp.clone().setY(hero.barY + .85), 'ปาร์ตี้ · โจมตี +22% · ป้องกัน +8', 'st'));
      });
      return 1.8;
    },
    // 7 · ดาบบาทวงจักร: three spins with the blades out — rings of steel, a whirlwind of sparks
    sword_whirl() {
      fx.cinematic(.6, 1.8);
      stepIn(1.0, () => { anim('sword_whirl'); const P0 = hero.pos();
        sweepBoth(STEEL, .1, 1.1, { n: 18, k0: .1 });
        fx.addTask((dt, t) => {
          for (let k = 0; k < 3; k++) { const a = t * 14 + k * 2.1, r = .3 + (t % .5) * 1.6; fx.emit({ p: add(hero.pos(), V(Math.cos(a) * r, rand(.1, 1.6), Math.sin(a) * r)), v: V(-Math.sin(a) * 2, rand(.5, 1.5), Math.cos(a) * 2), c: Math.random() < .3 ? WHITE : STEEL, life: .45, size: .07, size1: .01, shape: SH.leaf, vr: 8 }); }
          return t < 1.15;
        });
        hits('sword_whirl', (i, n) => {
          const hp = hero.pos(); fx.shock(hp.x, hp.z, 2 + i * .3, STEEL, C(.4, .5, .8), .4); ringPulse(hp.clone().setY(.95), V(0, 1, 0), STEEL, 1.6, .35);
          if (near(P0, 2)) { const p = chest(tg); cut(p, i === n - 1 ? 1.2 : .7, STEEL); hurt(110, i === n - 1, .15); }
        });
      });
      return 1.4;
    },
    // 8 · กระโจนผ่าปฐพี: a leap across the ground, both blades smashed into the earth — the
    // ground splits, rock flies, everyone near is stunned
    sword_leap() {
      fx.cinematic(.8, 2);
      face(tpos()); anim('sword_leap');
      const d = dirTo(), land = tpos().add(d.clone().multiplyScalar(-.95)).setY(0);
      fx.after(.32, () => moveTo(land, .55, null, EMBER, .35));
      sweepBoth(EMBER, .7, .92, { k0: .3 });
      fx.after(.9, () => {
        const hp = hero.pos(), P = add(hp, dirTo().multiplyScalar(.6));
        fx.impact(P.clone().setY(.2), 2.2, EMBER); fx.hitstop(.12); fx.shake = .4;
        fx.decal(4, P.x, P.z, 1.8, C(1.6, .8, .3), C(.5, .2, .05), { life: 2, grow: .12 }); fx.shock(P.x, P.z, 3.2, EMBER, C(.6, .2, .05), .6);
        fx.burst(P.clone().setY(.15), 40, { c: [C(.5, .42, .3), C(.35, .3, .22)], S: fx.PN, size: .14, sp: 4, upMin: .7, upK: 1.6, life: 1.1, grav: 8 });
        fx.burst(P.clone().setY(.3), 24, { c: [EMBER, WHITE], size: .09, sp: 5, upMin: .5, life: .5, shape: SH.star, drag: 3 });
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + rand(-.3, .3); fx.after(i * .02, () => bolt(P.clone().setY(.05), add(P, V(Math.cos(a) * 1.6, .05, Math.sin(a) * 1.6)), EMBER, .5, .04, .08)); }
        if (near(P, 1.9)) { hurt(320, true, .3); fx.stunStars(tg, 1); fx.popup(tg.head().add(V(0, .5, 0)), 'สะดุ้ง 1 วิ', 'st'); }
      });
      return 1.5;
    },
    // 9 · โทสะขุนศึก: the war cry — a red shock, the body burns with a crimson aura, the eyes
    // blaze, the swords smoulder
    sword_berserk() {
      fx.cinematic(.75, 2.2); face(tpos()); anim('sword_berserk');
      fx.after(.8, () => {
        const hp = hero.pos(); fx.flash(headP(hero), 0xff3020, 60, .6); fx.shake = .25;
        fx.shock(hp.x, hp.z, 3, CRIMSON, C(.6, .05, .02), .7); fx.after(.1, () => fx.shock(hp.x, hp.z, 2, EMBER, CRIMSON, .5));
        sigil(CRIMSON, 1.4, { p: hp.clone().setY(.06), life: 2.6, spin: -2 });
        character.tint?.(C(1, .25, .15), .5, 2.5);
        fx.popup(hp.clone().setY(hero.barY + .7), 'โจมตี +35% · คริ +15% · ตีเร็ว +15% · วิ่งเร็ว +15%', 'st');
        const eyes = [-1, 1].map(() => fx.glowSprite(C(2.6, .4, .2), .14));
        fx.addTask((dt, t) => {
          const h = headP(hero).add(V(0, -.3, 0)), s = sideOf(dirTo()).multiplyScalar(.06);
          eyes.forEach((e, i) => { e.position.copy(h).add(s.clone().multiplyScalar(i ? 1 : -1)).add(dirTo().multiplyScalar(.12)); e.material.opacity = clamp01((3 - t) / .5); });
          for (let k = 0; k < 2; k++) { const a = rand(0, 6.28), r = rand(.25, .5); fx.emit({ p: add(hero.pos(), V(Math.cos(a) * r, rand(0, 1.5), Math.sin(a) * r)), v: V(0, rand(1, 2), 0), c: Math.random() < .5 ? CRIMSON : EMBER, life: .6, size: .14, size1: .02 }); }
          for (const S of ['L', 'R']) if (Math.random() < .5) fx.emit({ p: bladeAt(S, rand(.2, 1)), v: V(0, rand(.4, .9), 0), c: EMBER, life: .4, size: .08, size1: .01 });
          if (t > 3) { eyes.forEach(e => fx.kill(e)); return false; }
        });
      });
      return 1.6;
    },
    // 10 · ดาบประหารอสูร: the swords raised to the storm — lightning strikes the blades again
    // and again, then one cleave brings it down on the target as a thunderbolt
    sword_execute() {
      fx.cinematic(1, 3);
      stepIn(1.3, () => { anim('sword_execute'); const P = tpos();
        const sky = add(hero.pos(), V(0, 6, 0));
        sigil(BOLT, 2.4, { p: sky.clone().setY(5.5), life: 2, spin: 1.5, grow: .4 });
        for (let i = 0; i < 6; i++) fx.after(.4 + i * .12, () => { const tip = bladeAt(i % 2 ? 'L' : 'R', 1); bolt(add(sky, V(rand(-1, 1), 0, rand(-1, 1))), tip, BOLT, .25, .045, .3); fx.flash(tip, 0x80b0ff, 25, .2); fx.burst(tip, 8, { c: [BOLT, WHITE], size: .07, sp: 2, life: .3, shape: SH.star }); });
        const glow = [fx.glowSprite(BOLT, .1), fx.glowSprite(BOLT, .1)];
        fx.addTask((dt, t) => { glow.forEach((g, i) => { g.position.copy(bladeAt(i ? 'L' : 'R', .8)); g.scale.setScalar(clamp01((t - .4) / .6) * .7 * (1 + Math.sin(t * 50) * .1) + .001); }); if (t > 1.2) { glow.forEach(g => fx.kill(g)); return false; } });
        sweepBoth(BOLT, 1.05, 1.28, { k0: .2 });
        fx.after(1.2, () => {
          const p = chest(tg), tp = tpos();
          bolt(tp.clone().setY(7), tp.clone().setY(.1), WHITE, .45, .12, .35); bolt(tp.clone().setY(7), tp.clone().setY(.1), BOLT, .5, .06, .5);
          fx.slashArc(chest(hero).add(V(0, .3, 0)), tp, { r: 2.2, sweep: 2.4, roll: 1.45, pal: 'blue', thick: .55, dur: .1, hold: .08 });
          fx.impact(p, 2.6, BOLT); fx.hitstop(.18); fx.shake = .45; fx.lightPillar(tp, BOLT, 7, .9, 1);
          fx.shock(tp.x, tp.z, 3.4, BOLT, C(.2, .3, 1), .6); fx.decal(4, tp.x, tp.z, 1.6, BOLT, C(.1, .2, .8), { life: 1.8, grow: .12 });
          // the thunder runs on through the ground in a fan over everything in front
          const hd = dirTo(), o = hero.pos();
          for (let k = -2; k <= 2; k++) { const a = k * .28, f = V(hd.x * Math.cos(a) + hd.z * Math.sin(a), 0, -hd.x * Math.sin(a) + hd.z * Math.cos(a)); fx.after(.03 * Math.abs(k), () => bolt(add(o, f.clone().multiplyScalar(.6)).setY(.06), add(o, f.clone().multiplyScalar(3.6)).setY(.06), BOLT, .55, .05, .12)); }
          fx.slashArc(chest(hero).add(V(0, -.2, 0)), tp, { r: 3, sweep: 1.8, roll: 0, pitch: -.15, pal: 'blue', thick: .3, dur: .1, hold: .1 });
          if (near(P, 2.4)) { hurt(800, true, .3); fx.stunStars(tg, 1.5); fx.popup(tg.head().add(V(0, .7, 0)), 'ประหาร!', 'st big'); fx.after(.2, () => fx.popup(tg.head().add(V(0, .4, 0)), 'มึน 1.5 วิ', 'st')); }
        });
      });
      return 2.1;
    },
  };

  R.cast = (id, quiet = false) => {
    if (R.time < R.busyUntil) return false;
    const dist = player.position.distanceTo(fx.toWorld(tg.pos.clone()));
    if (dist > R.range) { if (!quiet) fx.popup(hero.pos().setY(hero.barY + .4), 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ', 'st'); return false; }
    R.current = id; const dur = SK[id](); R.busyUntil = R.time + dur;
    return dur;
  };
  R.update = dt => { R.time += dt; if (R.time >= R.busyUntil) R.facing = null; };
  Object.defineProperty(R, 'busy', { get: () => R.time < R.busyUntil });
  return R;
}
