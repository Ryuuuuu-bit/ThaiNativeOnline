import * as THREE from 'three';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { SHAMAN_SKILLS } from '../shaman-moves.js';

// The shaman's (หมอผี · จอมขมังเวทย์) ten skills with their effects, timed to the shaman's clips
// (spell times come from shaman-moves.js). Positions are FX-local units. Spells leave the
// skull of his staff (staffTip, from the real staff in his hand) or his free left hand, and
// each does what its description says: curving fireballs, talismans that chain the spirit,
// a nine-spired yant shield, lightning, the kalpa fire, the holy-water lotus, ghost fires,
// the curse circle, the fire kasina, the thunder storm.
const { GOLD, WHITE } = COL;
const BASE = import.meta.env.BASE_URL + 'fx/shaman/';
export const shamanIconUrl = id => BASE + 'icon_' + id + '.png';

const AKOM = C(2.4, .9, 2.2), FIRE = C(2.6, 1.1, .25), GHOST = C(.6, 2.2, 1.6), BOLT = C(1.5, 1.9, 2.8), HOLY = C(1, 1.9, 2.6), CURSE = C(1.5, .4, 2.2), TOXIC = C(.7, 1.8, .4), SPIRIT = C(.9, 1.6, 2.6);
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
const SKULL = .3;   // staff-local height of the skull above the grip (the staff runs along local +Y)

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    // a ritual circle: ticked rings, a pentagram of the five directions, script dots
    sigil: canvasTex(512, 512, (g, S) => {
      g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round';
      const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
      circ(246, 6); circ(230, 2); circ(170, 3); circ(60, 3);
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, r0 = i % 6 ? 234 : 214; g.lineWidth = i % 6 ? 2 : 4; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 243, Math.sin(a) * 243); g.stroke(); }
      g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5, x = Math.cos(a) * 168, y = Math.sin(a) * 168; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 200, Math.sin(a) * 200, i % 3 ? 3 : 6, 0, 7); g.fill(); }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
    }),
    // a golden paper talisman with red script
    talisman: canvasTex(64, 160, (g, w, h) => {
      g.fillStyle = '#f2c94c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b3261e'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#b3261e'; g.font = 'bold 20px serif'; g.textAlign = 'center';
      ['ॐ', 'นะ', 'มะ', 'พะ', 'ทะ'].forEach((s, i) => g.fillText(s, w / 2, 30 + i * 26));
    }),
    // the nine-spired yant (เก้ายอด): nine stacked peaks over a square of script — white ink for fx.yantPlane
    nine: canvasTex(512, 512, (g) => {
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = 6; g.strokeRect(126, 300, 260, 160); g.lineWidth = 3; g.strokeRect(142, 316, 228, 128);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { g.beginPath(); g.arc(166 + c * 36, 340 + r * 28, 6, 0, 7); g.stroke(); }
      for (let i = 0; i < 9; i++) {   // nine peaks, the middle tallest, each an unalom curl
        const x = 70 + i * 46, top = 300 - (130 + (4 - Math.abs(i - 4)) * 28), base = 300;
        g.lineWidth = 5; g.beginPath(); g.moveTo(x - 20, base); g.quadraticCurveTo(x - 10, (base + top) / 2, x, top + 24); g.quadraticCurveTo(x + 10, (base + top) / 2, x + 20, base); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.moveTo(x, top + 24); g.lineTo(x, top + 4); g.arc(x + 6, top + 4, 6, Math.PI, Math.PI * 3.2); g.stroke();
      }
      g.lineWidth = 4; g.beginPath(); g.moveTo(40, 470); g.lineTo(472, 470); g.stroke();
    }),
  };
  return TEX;
}

export function createShamanSkills({ fx, character, player, dummy, groundHeight, labels, damage }) {
  const MOVES = Object.fromEntries(SHAMAN_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 14 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 720 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy, tpos = () => tg.pos.clone().add(tg.off);
  const dirTo = () => tpos().sub(hero.pos()).setY(0).normalize();
  const sideOf = d => V(d.z, 0, -d.x);
  const add = (o, c) => o.clone().add(c);
  const rotY = (d, a) => V(d.x * Math.cos(a) + d.z * Math.sin(a), 0, -d.x * Math.sin(a) + d.z * Math.cos(a));
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
  const pop = (p, text, cls = 'st') => fx.popup(p, text, cls);
  const heal = (text, cls = 'heal') => pop(hero.pos().setY(hero.barY + .2), text, cls);
  const staffTip = () => { const s = character.node?.('staff'); return s ? fx.toLocal(s.localToWorld(V(0, SKULL, 0))) : chest(hero).add(dirTo().multiplyScalar(.4)).add(V(0, .5, 0)); };
  const leftHand = () => { const b = character.bone?.('LeftHand'); return b ? fx.toLocal(b.getWorldPosition(new THREE.Vector3())) : chest(hero).add(sideOf(dirTo()).multiplyScalar(-.3)); };

  // ---- light ---------------------------------------------------------------------------
  const streakTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000'); gr.addColorStop(.3, '#444'); gr.addColorStop(.46, '#fff'); gr.addColorStop(.54, '#fff'); gr.addColorStop(.7, '#444'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); })();
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
  function trail(col, w = .08, n = 16) {
    const s = strip(col, w, n); let end = -1;
    const T = { p: null, alive: true, stop() { T.alive = false; } };
    fx.addTask((dt, t) => {
      if (T.p) s.push(T.p);
      if (!T.alive) { if (end < 0) end = t; s.alpha = 1 - (t - end) / .35; if (s.alpha <= 0) { s.kill(); return false; } }
      s.draw(); if (t > 10) { s.kill(); return false; }
    });
    return T;
  }
  function bolt(a, b, col, life = .35, w = .05, jag = .2) {
    const n = 16, s = strip(col, w, n); let next = 0;
    fx.addTask((dt, t) => {
      if (t >= next) { next = t + .05; const list = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), j = i && i < n - 1 ? jag : 0; list.push(a.clone().lerp(b, u).add(V(rand(-j, j), rand(-j, j), rand(-j, j)))); } s.set(list); }
      s.alpha = 1 - t / life; s.draw(); if (t > life) { s.kill(); return false; }
    });
  }
  // a lightning strike from the sky onto a ground point: double bolt, flash, scorch, sparks
  function strike(P, k = 1, col = BOLT) {
    const top = P.clone().setY(6.5);
    bolt(top, P.clone().setY(.05), WHITE, .35 * k, .07 * k, .35); bolt(add(top, V(rand(-.4, .4), 0, rand(-.4, .4))), P.clone().setY(.05), col, .45 * k, .045 * k, .5);
    fx.flash(P.clone().setY(1.5), 0x9cc4ff, 35 * k, .3); fx.shock(P.x, P.z, 1.2 * k, col, C(.2, .3, 1), .4);
    fx.decal(4, P.x, P.z, .7 * k, col, C(.1, .2, .7), { life: .9, grow: .08 });
    fx.burst(P.clone().setY(.2), Math.round(14 * k), { c: [col, WHITE], size: .08, sp: 4, upMin: .4, life: .4, shape: SH.star, drag: 3 });
  }
  const planeGeo = new THREE.PlaneGeometry(2, 2), ringGeo = new THREE.RingGeometry(.9, 1, 56);
  planeGeo.userData.shared = ringGeo.userData.shared = true;
  function sigil(col, r, { p, dir, life = 1.5, spin = 1, grow = .3, delay = 0 } = {}) {
    const G = new THREE.Group(), m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: textures().sigil, color: col.clone().multiplyScalar(fx.gain * .55), ...ADD, opacity: 0 }));
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
  // a flickering flame orb (fireball, ghost fire): glow + core, sheds flame particles
  function orb(col, k = 1, core = WHITE) {
    const g = fx.glowSprite(col, .45 * k), c = fx.glowSprite(core, .18 * k);
    return { g, c, at(p, t) { g.position.copy(p); c.position.copy(p); g.scale.setScalar(.45 * k * (1 + Math.sin(t * 37) * .12)); for (let i = 0; i < 2; i++) fx.emit({ p: add(p, V(rand(-.05, .05), rand(-.05, .05), rand(-.05, .05))), v: V(rand(-.2, .2), rand(.3, .8), rand(-.2, .2)), c: Math.random() < .3 ? core : col, life: .35, size: .12 * k, size1: .02 }); },
      kill() { fx.kill(g); fx.kill(c); } };
  }
  // the staff's skull charges while he casts: motes spiral in, its glow swells
  function charge(id, col, k = 1) {
    const until = MOVES[id].hits[0], glow = fx.glowSprite(col.clone().multiplyScalar(.5), .1);
    fx.addTask((dt, t) => {
      const b = staffTip(); glow.position.copy(b); glow.scale.setScalar((.2 + clamp01(t / until) * .7) * k * (1 + Math.sin(t * 40) * .06));
      if (Math.random() < .9) { const a = rand(0, 6.28), e = rand(-1, 1), r = rand(.6, 1) * k, s = Math.sqrt(1 - e * e);
        fx.emit({ p: add(b, V(Math.cos(a) * r * s, e * r, Math.sin(a) * r * s)), c: Math.random() < .3 ? WHITE : col, life: .6, size: .07 * k, size1: .02, home: b, homeK: 5, swirl: 2.5 }); }
      if (t >= until) { fx.kill(glow); return false; }
    });
  }
  // a hunter keeps his distance; so does a shaman
  function ready(cb) {
    face(tpos());
    const d = hero.pos().distanceTo(tpos());
    if (d >= 2.6) return cb();
    const to = tpos().add(hero.pos().sub(tpos()).setY(0).normalize().multiplyScalar(3.2)), from = fx.toWorld(hero.pos()), dest = fx.toWorld(to);
    fx.addTask((dt, t) => {
      const u = clamp01(t / .3), e = 1 - (1 - u) * (1 - u);
      player.position.x = from.x + (dest.x - from.x) * e; player.position.z = from.z + (dest.z - from.z) * e; player.position.y = groundHeight(player.position.x, player.position.z);
      if (u >= 1) { face(tpos()); cb(); return false; }
    });
  }

  const SK = {
    // 1 · คาถาอาคม: three fireballs leave the skull and curve in on the target from the left,
    // the middle and the right
    mage_akom() {
      fx.cinematic(.45, 1.3);
      ready(() => { anim('mage_akom'); charge('mage_akom', AKOM, .8);
        fx.after(MOVES.mage_akom.hits[0], () => {
          const from = staffTip(), d = dirTo(), side = sideOf(d); ringPulse(from, d, AKOM, .45, .3); fx.flash(from, 0xff80e0, 25, .25);
          [-1, 0, 1].forEach((s, i) => fx.after(i * .07, () => {
            const to = chest(tg).add(V(0, .1 * s, 0)), ctrl = from.clone().lerp(to, .5).add(side.clone().multiplyScalar(s * 1.1)).add(V(0, .5 + (s === 0 ? .4 : 0), 0));
            const o = orb(AKOM, .8, C(2.6, 1.8, 1)), T = trail(AKOM, .09, 14), dur = from.distanceTo(to) / 11;
            fx.addTask((dt, t) => { const u = clamp01(t / dur), a = from.clone().lerp(ctrl, u), b = ctrl.clone().lerp(to, u), p = a.lerp(b, u); o.at(p, t); T.p = p;
              if (u >= 1) { o.kill(); T.stop(); fx.impact(to, .8, AKOM); fx.burst(to, 12, { c: [AKOM, FIRE, WHITE], size: .1, sp: 3, life: .45, drag: 3 }); if (near(to, 1.6)) hurt(70, s === 0, .08); return false; } });
          }));
        });
      });
      return 1.2;
    },
    // 2 · ยันต์ตรึงวิญญาณ: three golden talismans spiral out of his hand and on through the line;
    // spirit chains rise from the ground and lock the target for 1.8 s
    mage_yant() {
      fx.cinematic(.55, 1.6);
      ready(() => { anim('mage_yant');
        fx.after(MOVES.mage_yant.hits[0], () => {
          const from = leftHand(), d = dirTo(), side = sideOf(d), to = chest(tg), end = add(to, d.clone().multiplyScalar(2.5)), dist = from.distanceTo(end), dur = dist / 9;
          let locked = false;
          for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(.16, .4), new THREE.MeshBasicMaterial({ map: textures().talisman, side: THREE.DoubleSide, transparent: true })); fx.add(m);
            const T = trail(GOLD, .05, 12), ph = i / 3 * Math.PI * 2;
            fx.addTask((dt, t) => {
              const u = clamp01(t / dur), c = from.clone().lerp(end, u), a = ph + t * 14, r = .28 * Math.sin(Math.min(1, u * 4) * Math.PI / 2);
              const p = c.add(side.clone().multiplyScalar(Math.cos(a) * r)).add(V(0, Math.sin(a) * r, 0)); m.position.copy(p); m.lookAt(fx.camera.position); m.rotateZ(t * 12); T.p = p;
              if (Math.random() < .5) fx.emit({ p: p.clone(), v: V(0, rand(-.2, .2), 0), c: GOLD, life: .3, size: .06, size1: .01, shape: SH.star });
              if (!locked && i === 0 && u * dist >= from.distanceTo(to)) { locked = true; lock(); }
              if (u >= 1) { T.stop(); fx.kill(m); fx.burst(p, 8, { c: [GOLD, WHITE], size: .06, sp: 2, life: .4, shape: SH.star }); return false; }
            });
          }
        });
      });
      function lock() {
        if (!tg.alive) return; const P = tpos(); hurt(120, false, 0); fx.stunStars(tg, 1.8); pop(tg.head().add(V(0, .5, 0)), 'ตรึงวิญญาณ 1.8 วิ');
        sigil(SPIRIT, 1.2, { p: P.clone().setY(.06), life: 1.9, spin: 2 }); fx.flash(chest(tg), 0x88aaff, 25, .4);
        const anchors = [0, 1, 2, 3].map(k => { const a = k / 4 * 6.28 + .4; return add(P, V(Math.cos(a) * 1.1, .05, Math.sin(a) * 1.1)); });
        const chains = anchors.map(() => strip(SPIRIT, .035, 10));
        fx.addTask((dt, t) => {
          const c = chest(tg), live = clamp01(t / .15) * clamp01((1.8 - t) / .3);
          chains.forEach((s, k) => { const a = anchors[k], list = []; for (let i = 0; i < 10; i++) { const u = i / 9; list.push(a.clone().lerp(c, u * clamp01(t / .2)).add(V(0, Math.sin(u * Math.PI) * .25, 0)).add(V(0, Math.sin(t * 20 + i) * .015, 0))); } s.set(list); s.alpha = live; s.draw(); });
          if (Math.random() < .5) fx.emit({ p: add(c, V(rand(-.3, .3), rand(-.5, .5), rand(-.3, .3))), v: V(0, .4, 0), c: SPIRIT, life: .5, size: .07, size1: .01 });
          if (t > 1.8) { chains.forEach(s => s.kill()); return false; }
        });
      }
      return 1.3;
    },
    // 3 · เกราะยันต์เก้ายอด: the nine-spired yant inks itself in gold behind him and a shell of
    // golden light closes round him; HP +25%, DEF +24 for 8 s
    mage_shield() {
      fx.cinematic(.5, 1.8); face(tpos()); anim('mage_shield');
      fx.after(MOVES.mage_shield.hits[0] - .25, () => {
        const yant = fx.yantPlane(textures().nine), yu = yant.material.uniforms, YS = 2.4;
        fx.addTask((dt, t) => {
          yu.uT.value = t; yu.uReveal.value = Math.min(1.15, t / .45 * 1.15); yu.uPulse.value = Math.max(0, 1 - Math.abs(t - .5) * 4); yu.uA.value = clamp01((1.9 - t) / .4);
          yant.position.copy(hero.pos()).add(dirTo().multiplyScalar(-.6)).add(V(0, 1.45, 0)); yant.lookAt(fx.camera.position); yant.scale.setScalar(YS);
          if (t > 1.9) { fx.kill(yant); return false; }
        });
      });
      fx.after(MOVES.mage_shield.hits[0], () => {
        const hp = hero.pos(); fx.shock(hp.x, hp.z, 2, GOLD, C(1, .5, .1), .5); sigil(GOLD, 1.3, { p: hp.clone().setY(.06), life: 2, spin: -.8 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), fx.fresnelMat(C(2, 1.5, .6))); fx.add(shell);
        fx.addTask((dt, t) => { shell.position.copy(hero.pos()).setY(.95); shell.scale.set(.85, 1.15, .85).multiplyScalar(easeOutBack(clamp01(t / .3))); shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = clamp01((2.2 - t) / .5) * fx.gain * .8;
          if (Math.random() < .4) fx.emit({ p: add(hero.pos(), V(rand(-.6, .6), rand(.1, 1.8), rand(-.6, .6))), v: V(0, .5, 0), c: GOLD, life: .6, size: .07, size1: .01 });
          if (t > 2.2) { fx.kill(shell); return false; } });
        character.tint?.(C(1, .8, .35), .25, 1.2);
        heal('HP +25%'); fx.after(.2, () => pop(hp.clone().setY(hero.barY + .7), 'ป้องกัน +24 · 8 วิ'));
      });
      return 1.4;
    },
    // 4 · อัสนีบาต: the staff raised to a thundercloud sigil, then a bolt falls on the target
    mage_thunder() {
      fx.cinematic(.65, 1.5);
      ready(() => { anim('mage_thunder'); const P = tpos();
        fx.after(.25, () => { sigil(BOLT, 1.4, { p: P.clone().setY(5), life: 1, spin: 2, grow: .25 }); bolt(staffTip(), staffTip().add(V(0, 1.2, 0)), BOLT, .3, .03, .1); });
        fx.after(MOVES.mage_thunder.hits[0], () => {
          const Q = tpos(); strike(Q, 1.6); fx.impact(chest(tg), 1.3, BOLT); fx.hitstop(.08); fx.shake = .25;
          bolt(staffTip(), chest(tg), BOLT, .25, .03, .15);
          if (near(Q, 1.6)) { hurt(260, true, .15); fx.stunStars(tg, .7); pop(tg.head().add(V(0, .5, 0)), 'สะดุ้ง'); }
        });
      });
      return 1.2;
    },
    // 5 · เพลิงกัลป์ปราบผี: he calls the fire, slams the staff down, and four waves of the
    // kalpa fire erupt one after another across the ground in front; ghosts caught keep burning
    mage_kalp() {
      fx.cinematic(.9, 2.6);
      ready(() => { anim('mage_kalp'); const hp0 = hero.pos(), d = dirTo(), side = sideOf(d);
        fx.after(.3, () => sigil(FIRE, 2.2, { p: add(hp0, d.clone().multiplyScalar(2.2)).setY(4.5), life: 1.8, spin: -1.5, grow: .35 }));
        fx.after(.75, () => { fx.shake = .2; fx.shock(hp0.x, hp0.z, 1.6, FIRE, C(.8, .2, .05), .4); });
        let burning = false;
        hits('mage_kalp', (i, n) => {
          const row = add(hp0, d.clone().multiplyScalar(1.2 + i * .75));
          for (let k = -2; k <= 2; k++) {
            const q = add(row, side.clone().multiplyScalar(k * .45 + rand(-.1, .1)));
            fx.after(Math.abs(k) * .03, () => {
              fx.lightPillar(q, FIRE, 2.2 + rand(0, .8), .22, .55); fx.decal(3, q.x, q.z, .5, FIRE, C(.8, .2, .05), { life: 1.4, grow: .1 });
              fx.burst(q.clone().setY(.2), 10, { c: [FIRE, C(2.6, 1.8, .6)], size: .12, sp: 2.5, upMin: .8, upK: 1.6, life: .7, grav: 3 });
              fx.burst(q.clone().setY(.4), 4, { c: [C(.3, .25, .2)], S: fx.PN, size: .25, size1: .6, sp: 1, upMin: .5, life: 1, shape: SH.soft, a: .5 });
            });
          }
          fx.shake = .15;
          if (tg.alive && Math.abs(tpos().clone().sub(hp0).dot(d) - (1.2 + i * .75)) < .9) {
            hurt(160, i === n - 1, .1); fx.impact(chest(tg), .9, FIRE);
            if (!burning) { burning = true; pop(tg.head().add(V(0, .5, 0)), 'ไฟลุก');
              let k = 0; fx.addTask((dt, t) => { if (Math.random() < dt * 20) fx.emit({ p: chest(tg).add(V(rand(-.3, .3), rand(-.6, .6), rand(-.2, .2))), v: V(0, rand(.6, 1.2), 0), c: Math.random() < .5 ? FIRE : C(2.6, 1.8, .6), life: .5, size: .12, size1: .02 });
                if (t > .6 * (k + 1) && k < 4) { k++; if (tg.alive) hurt(40, false, 0, 'mage_kalp'); } return t < 2.6 && tg.alive; }); }
          }
        });
      });
      return 2.1;
    },
    // 6 · น้ำมนต์ธาราทิพย์: a sacred lotus blooms in the middle of the party, holy water rains
    // from his hand; HP +25%, MP +15%, DEF +12 for 10 s
    mage_holy() {
      fx.cinematic(.5, 2.2); face(tpos()); anim('mage_holy');
      fx.after(.4, () => { const hp = hero.pos(); fx.decal(1, hp.x, hp.z, 2.4, HOLY, C(.3, .6, 1), { life: 2.4, grow: .3 }); });
      fx.after(MOVES.mage_holy.hits[0], () => {
        const hp = hero.pos(), lotus = fx.lotus(C(1.6, 1.9, 2.4), C(2.4, 1.6, 2), 1.2); lotus.position.copy(hp).setY(.05);
        fx.addTask((dt, t) => { lotus.userData.open(clamp01(t / .6)); lotus.rotation.y = t * .4; lotus.userData.alpha(clamp01(t * 4) * clamp01((2.2 - t) / .5));
          if (t < 1.4) for (let k = 0; k < 3; k++) { const a = rand(0, 6.28), r = rand(0, 2.2); fx.emit({ p: add(hp, V(Math.cos(a) * r, rand(2.2, 3), Math.sin(a) * r)), v: V(0, -rand(2.5, 4), 0), c: Math.random() < .5 ? HOLY : WHITE, life: .8, size: .06, size1: .03 }); }
          if (t > 2.2) { fx.kill(lotus); return false; } });
        const lh = leftHand(); for (let k = 0; k < 24; k++) fx.emit({ p: lh.clone(), v: dirTo().multiplyScalar(rand(1, 2.5)).add(sideOf(dirTo()).multiplyScalar(rand(-1.5, 1.5))).add(V(0, rand(1, 2.5), 0)), c: Math.random() < .5 ? HOLY : WHITE, life: 1, size: .07, size1: .02, grav: 5 });
        fx.lightPillar(hp, HOLY, 3.5, .8, .9); fx.shock(hp.x, hp.z, 2.6, HOLY, C(.3, .6, 1), .6);
        character.tint?.(C(.5, .8, 1), .25, 1.2);
        heal('HP +25%'); fx.after(.15, () => heal('MP +15%', 'heal mp')); fx.after(.3, () => pop(hp.clone().setY(hero.barY + .9), 'ปาร์ตี้ · ป้องกัน +12 · 10 วิ'));
      });
      return 1.8;
    },
    // 7 · ไฟผีห้าทิศ: five ghost fires gather round the skull, then fly out in a fan
    mage_ghostfire() {
      fx.cinematic(.6, 1.6);
      ready(() => { anim('mage_ghostfire');
        const orbs = [0, 1, 2, 3, 4].map(() => orb(GHOST, .7, C(1.6, 2.6, 2.2)));
        let gone = false;
        fx.addTask((dt, t) => { if (gone) return false; const b = staffTip(); orbs.forEach((o, i) => { const a = t * 6 + i / 5 * 6.28; o.at(add(b, V(Math.cos(a) * .35, Math.sin(a * 1.3) * .12, Math.sin(a) * .35)), t + i); }); });
        fx.after(MOVES.mage_ghostfire.hits[0], () => { gone = true; const d = dirTo(), from = staffTip(), dist = hero.pos().distanceTo(tpos()) + .4;
          orbs.forEach((o, i) => { const ang = (i - 2) * .26, dir = rotY(d, ang), to = add(hero.pos(), dir.multiplyScalar(dist)).setY(1.2), T = trail(GHOST, .1, 14), dur = from.distanceTo(to) / 9, wob = rand(0, 6);
            fx.addTask((dt, t) => { const u = clamp01(t / dur), p = from.clone().lerp(to, u).add(V(0, Math.sin(u * Math.PI) * .3 + Math.sin(t * 18 + wob) * .05, 0)); o.at(p, t); T.p = p;
              if (u >= 1) { o.kill(); T.stop(); fx.burst(to, 10, { c: [GHOST, WHITE], size: .1, sp: 2.5, life: .5, drag: 3 }); if (near(to, 1.1)) { fx.impact(to, .7, GHOST); hurt(90, false, .06); } return false; } });
          });
        });
      });
      return 1.2;
    },
    // 8 · คำสาปพรายตานี: a violet curse circle opens under the target; drowned-spirit wisps
    // rise round it — poison bites six times, the target slows by 35% for 3.5 s
    mage_curse() {
      fx.cinematic(.7, 2);
      ready(() => { anim('mage_curse');
        fx.after(.35, () => bolt(staffTip(), tpos().setY(.1), CURSE, .3, .03, .12));
        fx.after(MOVES.mage_curse.hits[0], () => {
          const P = tpos(); sigil(CURSE, 1.5, { p: P.clone().setY(.06), life: 3.6, spin: -1.2, grow: .25 }); fx.decal(5, P.x, P.z, 1.6, CURSE, C(.3, .05, .5), { life: 3.6, grow: .2 });
          fx.shock(P.x, P.z, 1.8, CURSE, C(.3, .05, .5), .5); fx.flash(P.clone().setY(1), 0xb060ff, 25, .5);
          if (!near(P, 1.6)) return;
          hurt(110, false, 0); pop(tg.head().add(V(0, .4, 0)), 'ติดพิษพราย'); fx.after(.2, () => pop(tg.head().add(V(0, .7, 0)), 'เชื่องช้า −35% · 3.5 วิ'));
          let n = 0;
          fx.addTask((dt, t) => {
            const c = tpos();
            for (let k = 0; k < 2; k++) { const a = t * 2 + k * Math.PI + rand(-.2, .2), r = .9; fx.emit({ p: add(c, V(Math.cos(a) * r, .1, Math.sin(a) * r)), v: V(-Math.cos(a) * .3, rand(.8, 1.4), -Math.sin(a) * .3), c: Math.random() < .5 ? CURSE : TOXIC, life: .9, size: .14, size1: .03 }); }
            if (Math.random() < dt * 12) fx.emit({ p: add(c, V(rand(-.6, .6), .3, rand(-.6, .6))), v: V(0, .3, 0), c: C(.25, .12, .35), life: 1.4, size: .3, size1: .7, shape: SH.soft, a: .45 }, fx.PN);
            if (t > .55 * (n + 1) && n < 6) { n++; if (tg.alive) { hurt(30, false, 0, 'mage_curse'); fx.burst(chest(tg), 6, { c: [TOXIC, CURSE], size: .07, sp: 2, life: .35, shape: SH.star }); } }
            if (t > 3.5) return false;
          });
        });
      });
      return 1.4;
    },
    // 9 · สมาธิกสิณไฟ: seated in meditation, he kindles the fire kasina — a disc of flame before
    // him; the fire runs up his body; magic +30%, crit +10%, HP +10% for 12 s
    mage_meditate() {
      fx.cinematic(.6, 2.4); face(tpos()); anim('mage_meditate');
      fx.after(.5, () => {
        const hp = hero.pos(); sigil(FIRE, 1.2, { p: hp.clone().setY(.06), life: 1.9, spin: .6 });
        const disc = fx.glowSprite(FIRE, .1), core = fx.glowSprite(C(2.6, 2, 1), .1), ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: FIRE.clone().multiplyScalar(fx.gain * .4), ...ADD })); fx.add(ring);
        fx.addTask((dt, t) => {
          const at = add(hero.pos(), dirTo().multiplyScalar(.6)).setY(.75), k = clamp01(t / .5) * clamp01((1.6 - t) / .3) + .001;
          disc.position.copy(at); core.position.copy(at); ring.position.copy(at); ring.lookAt(fx.camera.position);
          disc.scale.setScalar(.9 * k * (1 + Math.sin(t * 30) * .05)); core.scale.setScalar(.35 * k); ring.scale.setScalar(.45 * k); ring.material.opacity = k;
          if (Math.random() < .7) fx.emit({ p: add(at, V(rand(-.2, .2), rand(-.2, .2), rand(-.2, .2))), v: V(0, rand(.4, .9), 0), c: Math.random() < .5 ? FIRE : C(2.6, 1.8, .6), life: .5, size: .1, size1: .02 });
          if (Math.random() < .6) { const a = rand(0, 6.28), r = rand(.25, .45); fx.emit({ p: add(hero.pos(), V(Math.cos(a) * r, rand(0, .8), Math.sin(a) * r)), v: V(0, rand(.6, 1.2), 0), c: FIRE, life: .6, size: .1, size1: .02 }); }
          if (t > 1.6) { fx.kill(disc); fx.kill(core); fx.kill(ring); return false; }
        });
      });
      fx.after(MOVES.mage_meditate.hits[0], () => {
        const hp = hero.pos(); fx.flash(chest(hero), 0xff9040, 30, .5); fx.shock(hp.x, hp.z, 2, FIRE, C(.8, .2, .05), .5);
        character.tint?.(C(1, .55, .2), .3, 1.4);
        heal('HP +10%'); fx.after(.2, () => pop(hp.clone().setY(hero.barY + .7), 'พลังเวทย์ +30% · คริ +10% · 12 วิ'));
      });
      return 2.0;
    },
    // 10 · พายุอัสนีเทพ: a storm sigil opens over him; five waves of lightning strike all round
    // him across a wide circle, stunning every time
    mage_storm() {
      fx.cinematic(1, 3);
      face(tpos()); anim('mage_storm'); const hp0 = hero.pos();
      fx.after(.3, () => { sigil(BOLT, 3.6, { p: hp0.clone().setY(5.5), life: 2.2, spin: .8, grow: .4 }); fx.decal(1, hp0.x, hp0.z, 3.4, BOLT, null, { life: 2.3, grow: .3 }); });
      fx.after(.45, () => fx.addTask((dt, t) => { if (Math.random() < .5) fx.emit({ p: add(staffTip(), V(rand(-.15, .15), rand(-.15, .15), rand(-.15, .15))), c: BOLT, life: .2, size: .08, size1: .01, shape: SH.star }); return t < 1.5; }));
      hits('mage_storm', (i, n) => {
        bolt(add(hp0, V(rand(-.5, .5), 5.4, rand(-.5, .5))), staffTip(), BOLT, .2, .04, .2);
        for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + i * .7 + rand(-.2, .2), r = rand(1.2, 3.2); fx.after(k * .025, () => strike(add(hp0, V(Math.cos(a) * r, 0, Math.sin(a) * r)), .9)); }
        if (near(hp0, 3.6)) { fx.after(.03, () => strike(tpos(), 1.1)); hurt(150, i === n - 1, .08); fx.stunStars(tg, .4); pop(tg.head().add(V(0, .4 + i * .08, 0)), 'สะดุ้ง'); }
        fx.shake = .2;
      });
      return 2.2;
    },
  };

  R.cast = (id, quiet = false) => {
    if (R.time < R.busyUntil) return false;
    const dist = player.position.distanceTo(fx.toWorld(tg.pos.clone()));
    if (dist > R.range) { if (!quiet) pop(hero.pos().setY(hero.barY + .4), 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ'); return false; }
    R.current = id; const dur = SK[id](); R.busyUntil = R.time + dur;
    return dur;
  };
  R.update = dt => { R.time += dt; if (R.time >= R.busyUntil) R.facing = null; };
  Object.defineProperty(R, 'busy', { get: () => R.time < R.busyUntil });
  return R;
}
