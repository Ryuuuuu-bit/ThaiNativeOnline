import * as THREE from 'three';
import { lockTime } from '../tempo.js';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { SHAMAN_SKILLS } from '../shaman-moves.js';

// The shaman's (หมอผี · จอมขมังเวทย์) ten skills — the dark arts of death: soul skulls, the chains
// of Yama's guards, a cage of ghost bones, the death god's hand, hellfire, the ancestors'
// offering, wandering souls, the curse of violent death, meditation in the graveyard, the
// gate of the underworld. Timed to the shaman's clips (spell times from shaman-moves.js);
// positions are FX-local units. Spells leave the skull of his staff (staffTip, from the real
// staff in his hand) or his free left hand.
const { WHITE } = COL;
const BASE = import.meta.env.BASE_URL + 'fx/shaman/';
export const shamanIconUrl = id => BASE + 'icon_' + id + '.png';

// death palette: soul green, underworld violet, bone, blood, ember of hell
const SOUL = C(.7, 2.4, 1.5), DEATH = C(1.4, .35, 2.2), BONE = C(2.2, 2.1, 1.7), BLOOD = C(2.2, .15, .15), HELL = C(2, .4, 1.6), HELLFIRE = C(2.4, .5, .9), PALE = C(1.3, 1.8, 2.2);
const SMOKE = C(.1, .06, .12), INK = C(.05, .03, .06);
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
const SKULL = .3;   // staff-local height of the skull above the grip (the staff runs along local +Y)

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    // a ritual circle of death: ticked rings, a pentagram, skull marks round the band
    sigil: canvasTex(512, 512, (g, S) => {
      g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round';
      const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
      circ(246, 6); circ(230, 2); circ(170, 3); circ(60, 3);
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, r0 = i % 6 ? 234 : 214; g.lineWidth = i % 6 ? 2 : 4; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 243, Math.sin(a) * 243); g.stroke(); }
      g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5, x = Math.cos(a) * 168, y = Math.sin(a) * 168; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 200, y = Math.sin(a) * 200; g.beginPath(); g.arc(x, y - 3, 11, 0, 7); g.fill(); g.fillRect(x - 6, y + 4, 12, 8); }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
    }),
    // a skull: white bone with the sockets, nose and teeth cut out (glows when added)
    skull: canvasTex(128, 128, (g) => {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(64, 54, 40, 42, 0, 0, 7); g.fill(); g.fillRect(40, 70, 48, 30); g.beginPath(); g.ellipse(64, 100, 24, 12, 0, 0, 7); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.ellipse(48, 60, 12, 14, -.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(80, 60, 12, 14, .2, 0, 7); g.fill();
      g.beginPath(); g.moveTo(64, 72); g.lineTo(57, 86); g.lineTo(71, 86); g.closePath(); g.fill();
      for (let i = 0; i < 6; i++) g.fillRect(45 + i * 7, 96, 2, 14);
    }),
    // a clawed ghost hand reaching up out of the ground: gaunt fingers, hooked nails, knuckle
    // lines cut out, the forearm fading into the pit
    hand: canvasTex(128, 192, (g) => {
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(40, 192); g.lineTo(44, 128); g.quadraticCurveTo(42, 104, 50, 96); g.lineTo(80, 96); g.quadraticCurveTo(88, 106, 86, 128); g.lineTo(90, 192); g.closePath(); g.fill();   // palm and forearm
      const finger = (x0, y0, x1, y1, x2, y2, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); g.beginPath(); g.moveTo(x2 - dy / L * w * .45, y2 + dx / L * w * .45); g.lineTo(x2 + dx / L * 12 + dy / L * 3, y2 + dy / L * 12 - dx / L * 3); g.lineTo(x2 + dy / L * w * .45, y2 - dx / L * w * .45); g.fill(); };
      finger(48, 100, 36, 64, 24, 34, 9); finger(58, 96, 54, 54, 50, 20, 9); finger(68, 96, 70, 52, 72, 16, 9); finger(78, 98, 86, 58, 94, 28, 8); finger(84, 118, 104, 100, 114, 78, 9);
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2;
      [[38, 70], [54, 62], [70, 60], [85, 64], [100, 96]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y + 1); g.stroke(); });
      g.beginPath(); g.moveTo(52, 112); g.quadraticCurveTo(64, 120, 78, 110); g.stroke();
      g.globalCompositeOperation = 'destination-in'; const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#fff'); gr.addColorStop(.62, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 192);
    }),
    // a sheet-ghost silhouette with two dark eyes
    ghost: canvasTex(96, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(10, 128); g.lineTo(14, 48); g.quadraticCurveTo(48, -12, 82, 48); g.lineTo(86, 128); g.quadraticCurveTo(70, 108, 58, 128); g.quadraticCurveTo(48, 110, 38, 128); g.quadraticCurveTo(26, 108, 10, 128); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(36, 50, 7, 10, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(60, 50, 7, 10, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(48, 74, 6, 9, 0, 0, 7); g.fill();
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
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback, m.speed); return m; };
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
  // ---- the dark arts --------------------------------------------------------------------
  // a sprite of one of the drawn textures (skull, hand, ghost), added light
  const sprite = (tex, col, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures()[tex], color: col.clone().multiplyScalar(fx.gain * .32), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(size * (tex === 'hand' ? .67 : tex === 'ghost' ? .75 : 1), size, 1); return fx.add(s); };
  // black smoke that hangs and spreads (drawn over the scene, not added)
  const smoke = (p, n = 8, k = 1, jit = .3) => { for (let i = 0; i < n; i++) fx.emit({ p: add(p, V(rand(-jit, jit), rand(-.1, .3), rand(-jit, jit))), v: V(rand(-.3, .3), rand(.2, .7), rand(-.3, .3)), c: Math.random() < .5 ? SMOKE : INK, life: rand(.9, 1.5), size: .3 * k, size1: .8 * k, shape: SH.soft, a: .6, drag: 1.2 }, fx.PN); };
  // an abyss: a black, slowly swirling pit with a violet rim, darkening the ground under it
  function abyss(P, r, life = 2, rim = DEATH) {
    const pool = fx.decal(6, P.x, P.z, r, C(.22, .05, .3), C(.01, 0, .03), { auto: false, alpha: 0, normal: true });
    fx.decal(1, P.x, P.z, r * 1.02, rim, null, { life, grow: .25 });
    fx.addTask((dt, t) => { pool.u.uAlpha.value = .9 * clamp01(t / .25) * clamp01((life - t) / .4); pool.m.scale.setScalar(r * easeOutBack(clamp01(t / .3)) + .001);
      if (Math.random() < .6) { const a = rand(0, 6.28), q = rand(.2, .95) * r; fx.emit({ p: add(P, V(Math.cos(a) * q, .05, Math.sin(a) * q)), v: V(0, rand(.4, 1.1), 0), c: Math.random() < .5 ? rim : SOUL, life: .7, size: .06, size1: .01 }); }
      if (t > life) { pool.auto = true; pool.t = 99; return false; } });
  }
  // dark lightning: a black-violet bolt with a pale core
  const darkBolt = (a, b, life = .35, w = .05, jag = .25) => { bolt(a, b, DEATH, life, w, jag); bolt(a, b, PALE, life * .8, w * .35, jag * .6); };
  // a ghost hand bursting out of the ground at P: an underworld pit opens, the hand rises,
  // clutches (fingers close) and sinks back
  function deathHand(P, k = 1, life = 1.1, col = SOUL) {
    abyss(P, .75 * k, life + .2); fx.shock(P.x, P.z, 1.1 * k, DEATH, INK, .4);
    smoke(P.clone().setY(.1), 10, k, .4 * k);
    const h = sprite('hand', col, 1.6 * k), g = fx.glowSprite(col.clone().multiplyScalar(.5), .1);
    fx.addTask((dt, t) => {
      const up = easeOutBack(clamp01(t / .22)), grab = clamp01((t - .3) / .12), down = clamp01((t - life + .3) / .3);
      h.position.copy(P).setY((-.6 + up * 1.4 - down * 1.2) * k); h.scale.set(1.07 * k * (1 - grab * .25), 1.6 * k * (1 - grab * .18), 1);
      h.material.opacity = clamp01(t / .08) * (1 - down); g.position.copy(h.position); g.scale.setScalar(1.4 * k * (1 - down) + .001);
      if (Math.random() < .5) fx.emit({ p: add(P, V(rand(-.3, .3) * k, rand(0, 1) * k, rand(-.3, .3) * k)), v: V(0, rand(.5, 1.2), 0), c: col, life: .5, size: .07, size1: .01 });
      if (t > life) { fx.kill(h); fx.kill(g); return false; }
    });
  }
  // an iron chain of links from a to b (each link a torus turned 90° to the last), glowing red-hot
  const linkGeo = new THREE.TorusGeometry(.045, .012, 6, 12); linkGeo.userData.shared = true;
  const linkMat = new THREE.MeshStandardMaterial({ color: 0x2a2228, metalness: .8, roughness: .35, emissive: new THREE.Color(.6, .05, .1) });
  function chain(n = 14) {
    const G = new THREE.Group(); fx.add(G); const links = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(linkGeo, linkMat); G.add(m); links.push(m); }
    return { G, set(a, b, sag = 0, len = 1) { const d = b.clone().sub(a), L = d.length(); links.forEach((m, i) => { const u = i / (links.length - 1) * len; m.visible = u <= len; m.position.copy(a).addScaledVector(d, u).add(V(0, -Math.sin(u * Math.PI) * sag, 0)); m.lookAt(fx.toWorld(add(m.position, d))); m.rotateZ(i % 2 ? Math.PI / 2 : 0); m.scale.setScalar(Math.max(.6, Math.min(1.3, L / links.length / .07))); }); },
      kill() { G.parent?.remove(G); } };
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
    // 1 · กระสุนวิญญาณ: three soul skulls leave the staff's skull and curve in from the left,
    // the middle and the right, wailing green wakes behind them
    mage_akom() {
      fx.cinematic(.55, 1.3);
      ready(() => { anim('mage_akom'); charge('mage_akom', SOUL, .8);
        fx.after(MOVES.mage_akom.hits[0], () => {
          const from = staffTip(), d = dirTo(), side = sideOf(d); ringPulse(from, d, SOUL, .45, .3); fx.flash(from, 0x60ffa0, 22, .25); smoke(from, 6, .6, .15);
          [-1, 0, 1].forEach((s, i) => fx.after(i * .07, () => {
            const to = chest(tg).add(V(0, .1 * s, 0)), ctrl = from.clone().lerp(to, .5).add(side.clone().multiplyScalar(s * 1.1)).add(V(0, .5 + (s === 0 ? .4 : 0), 0));
            const sk = sprite('skull', SOUL, .42), glow = fx.glowSprite(SOUL.clone().multiplyScalar(.5), .5), T = trail(SOUL, .1, 16), dur = from.distanceTo(to) / 10;
            fx.addTask((dt, t) => { const u = clamp01(t / dur), a = from.clone().lerp(ctrl, u), b = ctrl.clone().lerp(to, u), p = a.lerp(b, u); sk.position.copy(p); glow.position.copy(p); sk.material.rotation = Math.sin(t * 20) * .2; T.p = p;
              if (Math.random() < .7) fx.emit({ p: add(p, V(rand(-.06, .06), rand(-.06, .06), rand(-.06, .06))), v: V(0, rand(.1, .4), 0), c: Math.random() < .3 ? PALE : SOUL, life: .4, size: .1, size1: .02 });
              if (u >= 1) { fx.kill(sk); fx.kill(glow); T.stop(); fx.impact(to, .8, SOUL); smoke(to, 6, .7, .2); fx.burst(to, 12, { c: [SOUL, PALE], size: .1, sp: 3, life: .45, shape: SH.star, drag: 3 }); if (near(to, 1.6)) hurt(70, s === 0, .08); return false; } });
          }));
        });
      });
      return 1.2;
    },
    // 2 · โซ่ตรวนยมบาล: a red-hot hell chain lashes out of his hand straight through the line;
    // more chains burst out of the ground and bind the target fast for 1.8 s
    mage_yant() {
      fx.cinematic(.65, 1.7);
      ready(() => { anim('mage_yant');
        fx.after(MOVES.mage_yant.hits[0], () => {
          const from = leftHand(), d = dirTo(), to = chest(tg), end = add(to, d.clone().multiplyScalar(2.5)), C1 = chain(26), dist = from.distanceTo(end);
          let locked = false;
          fx.addTask((dt, t) => {
            const out = clamp01(t / .25), back = clamp01((t - .45) / .25), len = out * (1 - back);
            C1.set(from, end, .05, len); const tip = from.clone().lerp(end, len);
            if (Math.random() < .8) fx.emit({ p: tip, v: V(rand(-.3, .3), rand(-.1, .4), rand(-.3, .3)), c: Math.random() < .5 ? BLOOD : HELLFIRE, life: .3, size: .07, size1: .01, shape: SH.star });
            if (!locked && len * dist >= from.distanceTo(to)) { locked = true; bind(); }
            if (t > .72) { C1.kill(); return false; }
          });
        });
      });
      function bind() {
        if (!tg.alive) return; const P = tpos(); hurt(120, false, 0); fx.stunStars(tg, 1.8); pop(tg.head().add(V(0, .5, 0)), 'ตรวนยมบาล · นิ่ง 1.8 วิ'); fx.impact(chest(tg), .9, BLOOD);
        sigil(BLOOD, 1.2, { p: P.clone().setY(.06), life: 1.9, spin: -2 }); fx.decal(5, P.x, P.z, 1.1, BLOOD, INK, { life: 1.9, grow: .15 }); smoke(P.clone().setY(.1), 12, 1, .7);
        const anchors = [0, 1, 2, 3].map(k => { const a = k / 4 * 6.28 + .4; return add(P, V(Math.cos(a) * 1.1, .02, Math.sin(a) * 1.1)); });
        const chains = anchors.map(() => chain(16));
        fx.addTask((dt, t) => {
          const c = chest(tg).add(V(0, -.15, 0)), grow = clamp01(t / .2), drop = clamp01((t - 1.6) / .2);
          chains.forEach((ch, k) => ch.set(anchors[k], c, .12 + Math.sin(t * 25 + k) * .01, grow * (1 - drop)));
          if (Math.random() < .4) fx.emit({ p: add(c, V(rand(-.3, .3), rand(-.4, .4), rand(-.3, .3))), v: V(0, .4, 0), c: BLOOD, life: .4, size: .07, size1: .01 });
          if (t > 1.8) { chains.forEach(ch => ch.kill()); return false; }
        });
      }
      return 1.3;
    },
    // 3 · เกราะกระดูกผี: ghost bones rise out of the ground and lock round him in a ribcage of
    // bone, a skull leers over his head; HP +25%, DEF +24 for 8 s
    mage_shield() {
      fx.cinematic(.6, 1.9); face(tpos()); anim('mage_shield');
      fx.after(MOVES.mage_shield.hits[0] - .2, () => { const hp = hero.pos(); sigil(DEATH, 1.3, { p: hp.clone().setY(.06), life: 2.2, spin: -1 }); smoke(hp.clone().setY(.1), 14, 1, .8); });
      fx.after(MOVES.mage_shield.hits[0], () => {
        const hp = hero.pos(), boneM = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .6, emissive: new THREE.Color(.25, .35, .3) });
        const G = new THREE.Group(); fx.add(G); const ribs = [];
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, m = new THREE.Mesh(new THREE.ConeGeometry(.035, 1.5, 5).translate(0, .75, 0), boneM); m.position.set(Math.cos(a) * .62, 0, Math.sin(a) * .62); G.add(m); ribs.push({ m, a }); }
        const head = sprite('skull', BONE, .55);
        fx.addTask((dt, t) => {
          G.position.copy(hero.pos()); const up = easeOutBack(clamp01(t / .3)), out = clamp01((t - 1.9) / .3);
          ribs.forEach(({ m, a }, i) => { m.scale.set(1, Math.max(.001, up * (1 - out)), 1); m.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); m.position.y = -.1 + Math.sin(t * 3 + i) * .02; });
          G.rotation.y = t * .6; head.position.copy(hero.pos()).setY(2.4 + Math.sin(t * 4) * .05); head.material.opacity = clamp01(t / .2) * (1 - out);
          if (Math.random() < .4) fx.emit({ p: add(hero.pos(), V(rand(-.6, .6), rand(.1, 1.6), rand(-.6, .6))), v: V(0, .4, 0), c: SOUL, life: .6, size: .06, size1: .01 });
          if (t > 2.2) { fx.kill(G); fx.kill(head); boneM.dispose(); return false; }
        });
        fx.shock(hp.x, hp.z, 1.8, BONE, DEATH, .5); character.tint?.(C(.4, .9, .6), .22, 1.2);
        heal('HP +12%'); fx.after(.2, () => pop(hp.clone().setY(hero.barY + .7), 'ป้องกัน +24 · 8 วิ'));
      });
      return 1.4;
    },
    // 4 · มือมัจจุราช: the staff points, the ground under the nearest foe tears open and the
    // death god's hand grabs it
    mage_thunder() {
      fx.cinematic(.7, 1.5);
      ready(() => { anim('mage_thunder');
        fx.after(.3, () => { const P = tpos(); fx.decal(4, P.x, P.z, 1.2, DEATH, INK, { life: 1.2, grow: .2 }); smoke(P.clone().setY(.1), 10, 1, .6); darkBolt(staffTip(), P.clone().setY(.1), .3, .03, .15); });
        fx.after(MOVES.mage_thunder.hits[0], () => {
          const Q = tpos(); deathHand(Q, 1.25, 1.2); fx.shake = .25; fx.flash(Q.clone().setY(1), 0x9050ff, 30, .4);
          fx.after(.25, () => { if (near(Q, 1.6)) { hurt(260, true, .1); fx.impact(chest(tg), 1.1, SOUL); fx.stunStars(tg, .7); pop(tg.head().add(V(0, .5, 0)), 'สะดุ้ง'); } });
        });
      });
      return 1.2;
    },
    // 5 · ไฟนรกอเวจี: he calls up the fire of Avici, slams the staff down, and four waves of
    // violet hellfire erupt across the ground in front; ghosts caught keep burning
    mage_kalp() {
      fx.cinematic(1, 2.8);
      ready(() => { anim('mage_kalp'); const hp0 = hero.pos(), d = dirTo(), side = sideOf(d);
        fx.after(.3, () => { const c = add(hp0, d.clone().multiplyScalar(2.8)); abyss(c, 3, 2.4, HELL); sigil(HELL, 3.6, { p: c.clone().setY(.07), life: 2.2, spin: -1.2, grow: .35 }); smoke(c.clone().setY(.1), 26, 1.4, 2.4); });
        fx.after(.75, () => { fx.shake = .2; fx.shock(hp0.x, hp0.z, 1.6, HELL, INK, .4); });
        let burning = false;
        hits('mage_kalp', (i, n) => {
          const row = add(hp0, d.clone().multiplyScalar(1.2 + i * 1.05));
          for (let k = -4; k <= 4; k++) {
            const q = add(row, side.clone().multiplyScalar(k * .5 + rand(-.12, .12)));
            fx.after(Math.abs(k) * .03, () => {
              fx.lightPillar(q, HELLFIRE, 2.2 + rand(0, .8), .22, .6); fx.decal(3, q.x, q.z, .5, HELL, INK, { life: 1.6, grow: .1 });
              fx.burst(q.clone().setY(.2), 12, { c: [HELLFIRE, HELL, PALE], size: .12, sp: 2.5, upMin: .8, upK: 1.6, life: .7, grav: 3 });
              smoke(q.clone().setY(.4), 3, .8, .1);
            });
          }
          fx.shake = .15;
          if (tg.alive && Math.abs(tpos().clone().sub(hp0).dot(d) - (1.2 + i * 1.05)) < 1.1 && Math.abs(tpos().clone().sub(hp0).dot(side)) < 2.4) {
            hurt(160, i === n - 1, .1); fx.impact(chest(tg), .9, HELLFIRE);
            if (!burning) { burning = true; pop(tg.head().add(V(0, .5, 0)), 'ไฟนรกลุกไหม้');
              let k = 0; fx.addTask((dt, t) => { if (Math.random() < dt * 22) fx.emit({ p: chest(tg).add(V(rand(-.3, .3), rand(-.6, .6), rand(-.2, .2))), v: V(0, rand(.6, 1.2), 0), c: Math.random() < .5 ? HELLFIRE : HELL, life: .5, size: .12, size1: .02 });
                if (t > .6 * (k + 1) && k < 4) { k++; if (tg.alive) hurt(40, false, 0, 'mage_kalp'); } return t < 2.6 && tg.alive; }); }
          }
        });
      });
      return 2.1;
    },
    // 6 · พิธีเซ่นผีบรรพบุรุษ: incense smoke rises, the ancestors' spirits come round the party in a
    // slow ring and bless it; HP +25%, MP +15%, DEF +12 for 10 s
    mage_holy() {
      fx.cinematic(.6, 2.4); face(tpos()); anim('mage_holy');
      fx.after(.3, () => { const hp = hero.pos(); sigil(PALE, 2, { p: hp.clone().setY(.06), life: 2.4, spin: .5 }); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; const q = add(hp, V(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6));
        fx.addTask((dt, t) => { if (Math.random() < .5) fx.emit({ p: q.clone().setY(.15), v: V(Math.sin(t * 3 + k) * .1, rand(.3, .6), 0), c: C(.35, .3, .3), life: 1.6, size: .1, size1: .4, shape: SH.soft, a: .5, drag: .5 }, fx.PN); const fl = fx.emit; if (Math.random() < .3) fl({ p: q.clone().setY(.2), v: V(0, .4, 0), c: C(2.4, 1.4, .4), life: .3, size: .06, size1: .01 }); return t < 2.2; }); } });
      fx.after(MOVES.mage_holy.hits[0], () => {
        const hp = hero.pos(), spirits = [0, 1, 2, 3, 4].map(() => sprite('ghost', PALE, .7));
        fx.addTask((dt, t) => {
          spirits.forEach((s, i) => { const a = t * 1.2 + i / 5 * 6.28; s.position.copy(hp).add(V(Math.cos(a) * 1.4, 1.1 + Math.sin(t * 2 + i) * .15, Math.sin(a) * 1.4)); s.material.opacity = clamp01(t / .3) * clamp01((2 - t) / .4) * .8; });
          if (Math.random() < .5) fx.emit({ p: add(hp, V(rand(-1.4, 1.4), rand(.5, 1.8), rand(-1.4, 1.4))), v: V(0, -.2, 0), c: PALE, life: .8, size: .06, size1: .01 });
          if (t > 2) { spirits.forEach(s => fx.kill(s)); return false; }
        });
        fx.lightPillar(hp, PALE, 3.5, .8, .9); fx.shock(hp.x, hp.z, 2.6, PALE, DEATH, .6);
        character.tint?.(C(.6, .8, 1), .22, 1.2);
        heal('HP +15%'); fx.after(.15, () => heal('MP +15%')); fx.after(.3, () => pop(hp.clone().setY(hero.barY + .9), 'ปาร์ตี้ · ป้องกัน +12 · 10 วิ'));
      });
      return 1.8;
    },
    // 7 · วิญญาณเร่ร่อนห้าดวง: five wandering souls gather round the skull, then fly out in a fan
    mage_ghostfire() {
      fx.cinematic(.65, 1.6);
      ready(() => { anim('mage_ghostfire');
        const souls = [0, 1, 2, 3, 4].map(() => ({ s: sprite('ghost', SOUL, .5), g: fx.glowSprite(SOUL.clone().multiplyScalar(.4), .5) }));
        let gone = false;
        fx.addTask((dt, t) => { if (gone) return false; const b = staffTip(); souls.forEach(({ s, g }, i) => { const a = t * 5 + i / 5 * 6.28; s.position.copy(b).add(V(Math.cos(a) * .4, Math.sin(a * 1.3) * .12, Math.sin(a) * .4)); g.position.copy(s.position); s.material.opacity = clamp01(t / .2); }); });
        fx.after(MOVES.mage_ghostfire.hits[0], () => { gone = true; const d = dirTo(), from = staffTip(), dist = hero.pos().distanceTo(tpos()) + .4; smoke(from, 6, .6, .2);
          souls.forEach(({ s, g }, i) => { const dir = rotY(d, (i - 2) * .45), to = add(hero.pos(), dir.multiplyScalar(dist)).setY(1.2), T = trail(SOUL, .1, 16), dur = from.distanceTo(to) / 8, wob = rand(0, 6);
            fx.addTask((dt, t) => { const u = clamp01(t / dur), p = from.clone().lerp(to, u).add(V(0, Math.sin(u * Math.PI) * .3 + Math.sin(t * 14 + wob) * .07, 0)); s.position.copy(p); g.position.copy(p); T.p = p;
              if (u >= 1) { fx.kill(s); fx.kill(g); T.stop(); fx.burst(to, 10, { c: [SOUL, PALE], size: .1, sp: 2.5, life: .5, drag: 3 }); smoke(to, 4, .6, .15); if (near(to, 1.1)) { fx.impact(to, .7, SOUL); hurt(90, false, .06); } return false; } });
          });
        });
      });
      return 1.2;
    },
    // 8 · คำสาปตายโหง: a blood-red curse circle opens under the target; skulls of the violently
    // dead rise round it — the poison bites six times, the target slows by 35% for 3.5 s
    mage_curse() {
      fx.cinematic(.75, 2);
      ready(() => { anim('mage_curse');
        fx.after(.35, () => darkBolt(staffTip(), tpos().setY(.1), .3, .03, .12));
        fx.after(MOVES.mage_curse.hits[0], () => {
          const P = tpos(); abyss(P, 2.7, 3.6, BLOOD); sigil(BLOOD, 2.7, { p: P.clone().setY(.07), life: 3.6, spin: -1, grow: .3 });
          fx.shock(P.x, P.z, 3.2, BLOOD, INK, .6); fx.flash(P.clone().setY(1), 0xff2020, 30, .5); smoke(P.clone().setY(.1), 28, 1.4, 2.2);
          for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; fx.after(.05 * k, () => deathHand(add(P, V(Math.cos(a) * 2.1, 0, Math.sin(a) * 2.1)), .55, .9, BLOOD)); }
          if (!near(P, 2.7)) return;
          hurt(110, false, 0); pop(tg.head().add(V(0, .4, 0)), 'ติดพิษตายโหง'); fx.after(.2, () => pop(tg.head().add(V(0, .7, 0)), 'เชื่องช้า −35% · 3.5 วิ'));
          const skulls = [0, 1, 2, 3, 4].map(() => sprite('skull', BLOOD, .45));
          let n = 0;
          fx.addTask((dt, t) => {
            const c = tpos();
            skulls.forEach((s, k) => { const a = t * 1.2 + k / 5 * 6.28; s.position.copy(c).add(V(Math.cos(a) * 1.8, .5 + ((t * .5 + k * .33) % 1) * 1.6, Math.sin(a) * .85)); s.material.opacity = clamp01((3.5 - t) / .5) * .9; });
            if (Math.random() < dt * 14) fx.emit({ p: add(c, V(rand(-2.2, 2.2), .3, rand(-2.2, 2.2))), v: V(0, .3, 0), c: SMOKE, life: 1.4, size: .3, size1: .7, shape: SH.soft, a: .5 }, fx.PN);
            if (t > .55 * (n + 1) && n < 6) { n++; if (tg.alive) { hurt(30, false, 0, 'mage_curse'); fx.burst(chest(tg), 6, { c: [BLOOD, C(.6, .05, .05)], size: .07, sp: 2, life: .35, shape: SH.star }); } }
            if (t > 3.5) { skulls.forEach(s => fx.kill(s)); return false; }
          });
        });
      });
      return 1.4;
    },
    // 9 · ฌานป่าช้า: seated in the graveyard trance, he draws the souls of the dead out of the
    // ground into himself; his eyes burn soul-green; magic +30%, crit +10%, HP +10% for 12 s
    mage_meditate() {
      fx.cinematic(.7, 2.4); face(tpos()); anim('mage_meditate');
      fx.after(.45, () => {
        const hp = hero.pos(); sigil(DEATH, 1.6, { p: hp.clone().setY(.06), life: 2, spin: .6 }); fx.decal(5, hp.x, hp.z, 2.2, DEATH, INK, { life: 2, grow: .3 });
        fx.addTask((dt, t) => {
          const c = chest(hero).add(V(0, -.3, 0));
          if (Math.random() < .9) { const a = rand(0, 6.28), r = rand(1.2, 2.2); fx.emit({ p: add(hero.pos(), V(Math.cos(a) * r, .1, Math.sin(a) * r)), c: Math.random() < .3 ? PALE : SOUL, life: 1.2, size: .1, size1: .03, home: c, homeK: 3, swirl: 2 }); }
          if (Math.random() < .2) { const a = rand(0, 6.28), r = rand(1, 1.8), s = sprite('ghost', SOUL, .35), from = add(hero.pos(), V(Math.cos(a) * r, .1, Math.sin(a) * r));
            fx.addTask((dt2, t2) => { const u = clamp01(t2 / .8); s.position.copy(from.clone().lerp(c, u * u)).add(V(0, Math.sin(u * Math.PI) * .6, 0)); s.material.opacity = (1 - u) * .8; if (u >= 1) { fx.kill(s); return false; } }); }
          return t < 1.6;
        });
      });
      fx.after(MOVES.mage_meditate.hits[0], () => {
        const hp = hero.pos(); fx.flash(chest(hero), 0x60ffa0, 30, .5); fx.shock(hp.x, hp.z, 2.2, SOUL, DEATH, .5);
        character.tint?.(C(.3, .9, .5), .3, 1.4);
        const eyes = [-1, 1].map(() => fx.glowSprite(SOUL, .12));
        fx.addTask((dt, t) => { const h = headP(hero).add(V(0, -.3, 0)), s = sideOf(dirTo()).multiplyScalar(.06);
          eyes.forEach((e, i) => { e.position.copy(h).add(s.clone().multiplyScalar(i ? 1 : -1)).add(dirTo().multiplyScalar(.12)); e.material.opacity = clamp01((2.5 - t) / .5); });
          if (t > 2.5) { eyes.forEach(e => fx.kill(e)); return false; } });
        heal('HP +10%'); fx.after(.2, () => pop(hp.clone().setY(hero.barY + .7), 'พลังเวทย์ +35% · คริ +10% · 12 วิ'));
      });
      return 2.0;
    },
    // 10 · ประตูยมโลก: the gate of the underworld opens all round him — a great black pit, dark
    // lightning overhead, and in five waves the hands of the dead tear up out of the ground
    mage_storm() {
      fx.cinematic(1, 3.2);
      face(tpos()); anim('mage_storm'); const hp0 = hero.pos();
      fx.after(.3, () => { abyss(hp0, 5.2, 2.6, BLOOD); sigil(BLOOD, 5.2, { p: hp0.clone().setY(.08), life: 2.5, spin: .4, grow: .45 }); sigil(DEATH, 2.4, { p: hp0.clone().setY(.09), life: 2.4, spin: -1.2, grow: .35 }); sigil(DEATH, 4.2, { p: hp0.clone().setY(5.6), life: 2.3, spin: -.6, grow: .45 }); smoke(hp0.clone().setY(.1), 50, 1.7, 4.5); });
      fx.after(.45, () => fx.addTask((dt, t) => { if (Math.random() < .5) fx.emit({ p: add(staffTip(), V(rand(-.15, .15), rand(-.15, .15), rand(-.15, .15))), c: DEATH, life: .25, size: .09, size1: .01, shape: SH.star }); return t < 1.6; }));
      hits('mage_storm', (i, n) => {
        darkBolt(add(hp0, V(rand(-.5, .5), 5.2, rand(-.5, .5))), staffTip(), .25, .045, .25);
        for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + i * .7 + rand(-.2, .2), r = rand(1.3, 4.8); fx.after(k * .025, () => deathHand(add(hp0, V(Math.cos(a) * r, 0, Math.sin(a) * r)), .85, .8, i % 2 ? SOUL : DEATH)); }
        fx.shock(hp0.x, hp0.z, 5 + i * .2, DEATH, INK, .5);
        if (near(hp0, 5.2)) { fx.after(.04, () => deathHand(tpos(), 1, .8, BLOOD)); hurt(150, i === n - 1, .08); fx.stunStars(tg, .4); pop(tg.head().add(V(0, .4 + i * .08, 0)), 'สะดุ้ง'); }
        fx.shake = .2;
      });
      return 2.2;
    },
  };

  R.cast = (id, quiet = false) => {
    if (R.time < R.busyUntil) return false;
    const dist = player.position.distanceTo(fx.toWorld(tg.pos.clone()));
    if (dist > R.range) { if (!quiet) pop(hero.pos().setY(hero.barY + .4), 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ'); return false; }
    R.current = id; const dur = lockTime(MOVES[id], SK[id]()); R.busyUntil = R.time + dur;
    return dur;
  };
  R.update = dt => { R.time += dt; if (R.time >= R.busyUntil) R.facing = null; };
  Object.defineProperty(R, 'busy', { get: () => R.time < R.busyUntil });
  return R;
}
