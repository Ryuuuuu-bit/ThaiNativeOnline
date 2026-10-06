import * as THREE from 'three';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { HUNTER_SKILLS } from '../hunter-moves.js';
import { makeDog } from '../dog.js';

// The hunter's (นายพราน) ten skills with their effects, timed to the hunter's clips
// (release times come from hunter-moves.js). Positions are FX-local units.
// Every shot nocks a real arrow between the hands while he draws; on the release the bow
// flares (muzzle rings, sparks) and the arrow flies with a ribbon of light behind it,
// lands when it arrives and stays stuck in the dummy (or the ground) for a moment.
// Skill 6 (ลมใต้ปีกครุฑ) also calls his dog: it bursts out of a jade wind sigil, gallops
// to the target, bites three times and runs back.
const { GOLD, WHITE } = COL;
const BASE = import.meta.env.BASE_URL + 'fx/hunter/';
export const hunterIconUrl = id => BASE + 'icon_' + id + '.png';

const POISON = C(.5, 1.9, .35), FIRE = C(2.6, 1.1, .25), SKY = C(1.4, 1.9, 2.6), JADE = C(.6, 1.9, 1.1), BLOODMOON = C(2.6, .35, .3), STAR = C(2.2, 2, 2.6);
const ADD = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };

// A Thai-style sigil (lotus petals, eight-point star, ticked rings), white on clear; tinted per use.
let SIGIL_TEX = null;
function sigilTex() {
  if (SIGIL_TEX) return SIGIL_TEX;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round';
  const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  circ(246, 7); circ(229, 2); circ(162, 4); circ(64, 3); circ(40, 2);
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r0 = i % 4 ? 233 : 212; g.lineWidth = i % 4 ? 2 : 5; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 243, Math.sin(a) * 243); g.stroke(); }
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * Math.PI * 2); g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, -66); g.bezierCurveTo(40, -92, 30, -142, 0, -160); g.bezierCurveTo(-30, -142, -40, -92, 0, -66); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(0, -78); g.lineTo(0, -140); g.stroke(); g.restore(); }
  g.lineWidth = 3; for (const off of [0, Math.PI / 4]) { g.beginPath(); for (let i = 0; i <= 4; i++) { const a = off + i / 4 * Math.PI * 2, x = Math.cos(a) * 212, y = Math.sin(a) * 212; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + .2; g.beginPath(); g.arc(Math.cos(a) * 196, Math.sin(a) * 196, 5, 0, 7); g.fill(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
  SIGIL_TEX = new THREE.CanvasTexture(c); SIGIL_TEX.colorSpace = THREE.SRGBColorSpace; return SIGIL_TEX;
}

export function createHunterSkills({ fx, character, player, dummy, groundHeight, labels, damage }) {
  const MOVES = Object.fromEntries(HUNTER_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 14 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 800 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy, tpos = () => tg.pos.clone().add(tg.off);
  const dirTo = () => tpos().sub(hero.pos()).setY(0).normalize();
  const sideOf = d => V(d.z, 0, -d.x);
  const face = p => { const d = p.clone().sub(hero.pos()); R.facing = Math.atan2(d.x, d.z); };
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback); return m; };
  const release = (id, fn) => fx.after(MOVES[id].hits[0], fn);
  const near = (P, r) => tg.alive && tpos().distanceTo(P) <= r;
  // rules damage (via the training ground) for the given skill, else the effect's own number.
  // Late blows (poison ticks, the dog's bites) name their skill so a newer cast can't take them over.
  const hurt = (amt, crit, push = .12, id = R.current) => {
    const r = damage?.(id);
    if (!r || !r.dmg) return tg.hurt(amt, crit, push, hero.pos());
    if (!r.hit) return tg.miss();
    return tg.hurt(r.dmg, r.crit, push, hero.pos(), true);
  };
  const boneAt = (name, fallback) => { const b = character.bone?.(name); return b ? fx.toLocal(b.getWorldPosition(new THREE.Vector3())) : fallback(); };
  const bowHand = () => boneAt('LeftHand', () => chest(hero).add(dirTo().multiplyScalar(.5)).add(V(0, .3, 0)));
  const drawHand = () => boneAt('RightHand', () => chest(hero).add(V(0, .4, 0)));
  const add = (o, c) => o.clone().add(c);

  // ---- light ribbons -------------------------------------------------------------------
  // A camera-facing strip through the last n points (newest first), tapering to the tail.
  // Across its width the strip is a soft line (bright core, glowing falloff), so it reads as light.
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
    const S = { m, pts, alpha: 1, w,
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
  // A trail that follows T.p each frame; stop() lets it shrink into its last point and fade.
  function trail(col, w = .08, n = 16) {
    const s = strip(col, w, n); let end = -1;
    const T = { p: null, alive: true, stop() { T.alive = false; } };
    fx.addTask((dt, t) => {
      if (T.p) s.push(T.p);
      if (!T.alive) { if (end < 0) end = t; s.alpha = 1 - (t - end) / .35; if (s.alpha <= 0) { s.kill(); return false; } }
      s.draw(); if (t > 12) { s.kill(); return false; }
    });
    return T;
  }
  // A jagged lightning strip between a and b that re-forks every few frames.
  function bolt(a, b, col, life = .35, w = .05, jag = .18) {
    const n = 14, s = strip(col, w, n); let next = 0;
    fx.addTask((dt, t) => {
      if (t >= next) { next = t + .05; const list = []; for (let i = 0; i < n; i++) { const u = i / (n - 1), j = i && i < n - 1 ? jag : 0; list.push(a.clone().lerp(b, u).add(V(rand(-j, j), rand(-j, j), rand(-j, j)))); } s.set(list); }
      s.alpha = 1 - t / life; s.draw(); if (t > life) { s.kill(); return false; }
    });
  }

  // ---- sigils & rings ------------------------------------------------------------------
  const planeGeo = new THREE.PlaneGeometry(2, 2), ringGeo = new THREE.RingGeometry(.9, 1, 56);
  planeGeo.userData.shared = ringGeo.userData.shared = true;
  // A spinning sigil disc: flat on the ground/sky (dir omitted) or facing along `dir`.
  function sigil(col, r, { p, dir, life = 1.5, spin = 1, grow = .3, delay = 0 } = {}) {
    const G = new THREE.Group(), m = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: sigilTex(), color: col.clone().multiplyScalar(fx.gain * .55), ...ADD, opacity: 0 }));
    G.add(m); fx.add(G); G.position.copy(p); m.renderOrder = 4;
    const aim = () => { if (dir) G.lookAt(fx.toWorld(add(G.position, dir))); else G.rotation.set(-Math.PI / 2, 0, 0); };
    aim(); m.scale.setScalar(.001);
    fx.addTask((dt, t) => {
      const u = t - delay; if (u < 0) return;
      m.scale.setScalar(r * Math.max(.001, easeOutBack(clamp01(u / grow)))); m.rotation.z += dt * spin;
      m.material.opacity = clamp01(u / .15) * clamp01((life - u) / .35) * (.85 + .15 * Math.sin(u * 20));
      if (u > life) { fx.kill(G); return false; }
    });
    G.userData.aim = aim; return G;
  }
  // An expanding ring of light perpendicular to `dir` (muzzle blast, sonic rings).
  function ringPulse(p, dir, col, r = .5, life = .3) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(fx.gain * .22), ...ADD })); fx.add(m);
    m.position.copy(p); m.lookAt(fx.toWorld(add(p, dir)));
    fx.addTask((dt, t) => { const f = t / life; m.scale.setScalar(r * (.25 + f * 1.1)); m.material.opacity = (1 - f) * (1 - f); if (f >= 1) { fx.kill(m); return false; } });
  }

  // ---- arrows ---------------------------------------------------------------------------
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: .8 });
  const featherMat = new THREE.MeshBasicMaterial({ color: 0xe9e2cf, side: THREE.DoubleSide });
  const shaftGeo = new THREE.CylinderGeometry(.012, .012, .8, 5).rotateX(Math.PI / 2);
  const headGeo = new THREE.ConeGeometry(.03, .1, 6).rotateX(Math.PI / 2);
  const fletchGeo = new THREE.PlaneGeometry(.035, .14);
  for (const g of [shaftGeo, headGeo, fletchGeo]) g.userData.shared = true;
  // An arrow pointing along +Z (lookAt aims it), head glowing in `col`.
  function arrow(col, k = 1) {
    const g = new THREE.Group(); fx.add(g); g.scale.setScalar(k);
    g.add(new THREE.Mesh(shaftGeo, shaftMat));
    const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: col })); head.position.z = .44; g.add(head);
    for (const a of [0, Math.PI / 2]) { const f = new THREE.Mesh(fletchGeo, featherMat); f.position.z = -.33; f.rotation.set(0, 0, a); f.rotation.x = Math.PI / 2; g.add(f); }
    const glow = fx.glowSprite(col, .32 * k); glow.position.z = .44; fx.root.remove(glow); g.add(glow);
    g.userData.glow = glow;
    return g;
  }
  // While he draws: an arrow lies between the bow hand and the string hand, then is shot.
  function nock(id, col, k = 1, drip = null) {
    const a = arrow(col, k); let alive = true;
    fx.addTask((dt, t) => {
      if (!alive) return false;
      const bow = bowHand(), str = drawHand(); a.position.copy(bow.clone().lerp(str, .45)); a.lookAt(fx.toWorld(bow.clone().add(bow.clone().sub(str))));
      a.visible = t > .12;
      if (drip && a.visible && Math.random() < .5) fx.emit({ p: bow.clone().lerp(str, .1), v: V(0, -.6, 0), c: drip, life: .5, size: .06, size1: .02, grav: 3 });
      if (t > 3) { fx.kill(a); return false; }
    });
    return () => { alive = false; fx.kill(a); };
  }
  // Gather light into the bow while he draws: motes spiral in, a small sigil turns in front
  // of the bow and a glow swells until the release.
  function charge(id, col, k = 1) {
    const until = MOVES[id].hits[0], glow = fx.glowSprite(col.clone().multiplyScalar(.5), .1), d = dirTo();
    const sg = sigil(col, .32 * k, { p: bowHand(), dir: d, life: until - .1, spin: 3, delay: .15 });
    fx.addTask((dt, t) => {
      const b = bowHand(); glow.position.copy(b); glow.scale.setScalar((.2 + clamp01(t / until) * .8) * k * (1 + Math.sin(t * 40) * .06));
      sg.position.copy(add(b, d.clone().multiplyScalar(.28)));
      if (Math.random() < .9) { const a = rand(0, 6.28), e = rand(-1, 1), r = rand(.7, 1.2) * k, q = add(b, V(Math.cos(a) * r * Math.sqrt(1 - e * e), e * r, Math.sin(a) * r * Math.sqrt(1 - e * e)));
        fx.emit({ p: q, c: Math.random() < .3 ? WHITE : col, life: .6, size: .07 * k, size1: .02, home: b, homeK: 5, swirl: 2.5 }); }
      if (t >= until) { fx.kill(glow); return false; }
    });
  }
  // The string lets go: flash, rings of air along the shot, sparks thrown forward.
  function loose(col, k = 1, rings = 1) {
    const p = bowHand(), d = dirTo();
    fx.flash(p, col.getHex(), 30 * k, .25);
    for (let i = 0; i < rings; i++) fx.after(i * .035, () => ringPulse(add(p, d.clone().multiplyScalar(.2 + i * .5)), d, col, (.3 + i * .14) * k, .28 + i * .06));
    fx.speedLines(p, d, Math.round(8 * k), col);
    for (let i = 0; i < 12 * k; i++) fx.emit({ p: p.clone(), v: d.clone().multiplyScalar(rand(3, 7)).add(V(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))), c: Math.random() < .4 ? WHITE : col, life: .3, size: .07, size1: .01, shape: SH.star, drag: 4 });
  }
  // After it hits: an arrow buried in the dummy follows it until it fades.
  function stickIn(a, p, dir) {
    a.position.copy(p).sub(dir.clone().multiplyScalar(.22 * a.scale.x)); const off = a.position.clone().sub(tpos());
    a.userData.glow.material.opacity = .45;
    fx.addTask((dt, t) => { if (!tg.alive || t > 2.4) { fx.kill(a); return false; } a.position.copy(tpos()).add(off); if (t > 2) a.scale.setScalar(a.scale.x * (1 - dt * 6)); });
  }
  function stickGround(a, p, dir) {
    a.position.copy(p).setY(.18 * a.scale.x).sub(dir.clone().multiplyScalar(.15)); a.userData.glow.material.opacity = .5;
    fx.burst(p.clone().setY(.08), 5, { c: [C(.5, .42, .3), C(.62, .55, .42)], S: fx.PN, size: .07, sp: 1.6, upMin: .6, life: .5, grav: 6 });
    fx.addTask((dt, t) => { if (t > 1.6) { fx.kill(a); return false; } if (t > 1.2) a.userData.glow.material.opacity = .5 * (1.6 - t) / .4; });
  }
  // Fly an arrow from the bow to `to` (arc height h) with a light ribbon; onHit on arrival.
  // stick: 'target' buries it in the dummy, 'ground' plants it, false makes it vanish.
  function shoot({ to, col = WHITE, speed = 22, h = .12, k = 1, trail: tc = col, rib = .06, through = 0, onHit, from = bowHand(), stick = 'target', motes = 2 }) {
    const a = arrow(col, k), end = through ? to.clone().add(to.clone().sub(from).setY(0).normalize().multiplyScalar(through)) : to;
    const dist = from.distanceTo(end), dur = Math.max(.08, dist / speed), hitU = through ? from.distanceTo(to) / dist : 1;
    const T = trail(tc, rib * k, 14);
    let hit = false; const prev = from.clone(), dir = end.clone().sub(from).normalize();
    fx.addTask((dt, t) => {
      const u = clamp01(t / dur), p = fx.arcPoint(from, end, h * dist * .1, u);
      if (p.distanceToSquared(prev) > 1e-8) dir.copy(p).sub(prev).normalize();
      a.position.copy(p); a.lookAt(fx.toWorld(add(p, dir))); prev.copy(p); T.p = p;
      for (let i = 0; i < motes; i++) fx.emit({ p: add(p, V(rand(-.04, .04), rand(-.04, .04), rand(-.04, .04))), c: Math.random() < .3 ? WHITE : tc, life: .3, size: .09 * k, size1: .015 });
      if (!hit && u >= hitU) { hit = true; onHit?.(to); }
      if (u >= 1) {
        T.stop();
        if (stick === 'target' && !through && tg.alive && tpos().distanceTo(end.clone().setY(0)) < 1.2) stickIn(a, p, dir);
        else if (stick === 'ground') stickGround(a, p, dir);
        else fx.kill(a);
        return false;
      }
    });
    return dur * hitU;
  }
  const struck = (p, s = 1, col = GOLD) => { fx.impact(p, s, col); fx.burst(p, 10, { c: [col, WHITE], size: .08, sp: 3.5, life: .4, shape: SH.star, drag: 4 }); };
  // keep a little distance: a hunter shoots from range, so step back if the dummy is too close
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

  // ---- the dog --------------------------------------------------------------------------
  // Out of a jade wind sigil beside the hunter: gallops to the target, bites three times
  // (the last a leaping maul), trots back and dissolves into leaves.
  function summonDog(spawn) {
    const dog = makeDog(), S = .95, A = dog.userData.animate, T = trail(C(.3, 1, .55), .06, 16);
    dog.position.copy(spawn); dog.scale.setScalar(.001); fx.add(dog);
    const faceTo = p => { const d = p.clone().sub(dog.position); if (d.lengthSq() > 1e-6) dog.rotation.y = Math.atan2(d.x, d.z); };
    const step = (to, sp, dt) => { const d = to.clone().sub(dog.position).setY(0), L = d.length(); faceTo(to); if (L < sp * dt) { dog.position.x = to.x; dog.position.z = to.z; return true; } dog.position.add(d.multiplyScalar(sp * dt / L)); return false; };
    const spot = () => tpos().add(dog.position.clone().sub(tpos()).setY(0).normalize().multiplyScalar(.95)).setY(0);
    const dust = () => { if (Math.random() < .5) fx.emit({ p: dog.position.clone().add(V(rand(-.2, .2), .05, rand(-.2, .2))), v: V(rand(-.3, .3), rand(.3, .7), rand(-.3, .3)), c: C(.55, .48, .36), life: .6, size: .14, size1: .35, shape: SH.soft, a: .5, drag: 2 }, fx.PN); };
    let phase = 'appear', t0 = 0, bites = 0, clock = 0;
    const BITE = .5;
    fx.addTask((dt, t) => {
      clock += dt; const pt = t - t0, go = (p) => { phase = p; t0 = t; };
      let moving = false, run = 0, bite = null, glow = .06, y = 0;
      if (phase === 'appear') {
        dog.scale.setScalar(S * Math.max(.001, easeOutBack(clamp01(pt / .35)))); glow = 1 - clamp01(pt / .5) * .94; faceTo(tpos());
        if (Math.random() < .8) fx.emit({ p: add(dog.position, V(rand(-.4, .4), rand(.1, .8), rand(-.4, .4))), v: V(0, rand(.5, 1.2), 0), c: JADE, life: .5, size: .1, size1: .02, shape: SH.leaf, vr: 5 });
        if (pt > .45) go('run');
      } else if (phase === 'run') {
        moving = true; run = 1; dust();
        if (!tg.alive || step(spot(), 7.5, dt) || pt > 2.5) go(tg.alive ? 'bite' : 'back');
      } else if (phase === 'bite') {
        faceTo(tpos()); const k = bites === 2 ? 1.2 : 1, u = pt / (BITE * k); bite = clamp01(u);
        if (bites === 2) y = Math.sin(clamp01(u * 1.3) * Math.PI) * .45;
        if (u >= .55 && !dog.userData.snapped) {
          dog.userData.snapped = true;
          const mouth = tpos().add(dog.position.clone().sub(tpos()).setY(0).normalize().multiplyScalar(.3)).setY(.75 + y * .6);
          const last = bites === 2;
          fx.impact(mouth, last ? 1.4 : .75, JADE);
          fx.slashArc(mouth, add(mouth, dog.position.clone().sub(tpos()).setY(0).negate()), { r: last ? .9 : .6, sweep: 2, pal: 'jade', pitch: rand(-.6, .6), roll: rand(-.3, .3), dur: .08, thick: .35 });
          fx.burst(mouth, last ? 22 : 10, { c: [JADE, WHITE, GOLD], size: .08, sp: 3, life: .45, shape: SH.leaf, drag: 3 });
          if (tg.alive) { hurt(last ? 160 : 110, last, last ? .25 : .08, 'arch_garuda'); if (last) { tg.knock(tpos().sub(dog.position).setY(0).normalize(), .35); fx.shock(tpos().x, tpos().z, 1.6, JADE, C(.2, .8, .4), .5); fx.popup(tg.head().add(V(0, .5, 0)), 'น้องหมากัด!', 'st'); } }
        }
        if (u >= 1) { bites++; dog.userData.snapped = false; if (bites >= 3 || !tg.alive) go('back'); else t0 = t; }
      } else if (phase === 'back') {
        moving = true; run = .35; dust();
        const home = hero.pos().add(sideOf(dirTo()).multiplyScalar(.9)).add(dirTo().multiplyScalar(-.2));
        if (step(home, 5, dt) || pt > 2.5) go('vanish');
      } else if (phase === 'vanish') {
        glow = .06 + clamp01(pt / .3) * .9; dog.scale.setScalar(S * (1 - clamp01((pt - .2) / .3)) + .001);
        if (pt < dt * 1.5) { fx.burst(add(dog.position, V(0, .5, 0)), 26, { c: [JADE, GOLD], size: .1, sp: 2.5, upMin: .4, life: .8, shape: SH.leaf, drag: 2 }); fx.shock(dog.position.x, dog.position.z, .9, JADE, JADE, .4); }
        if (pt > .5) { T.stop(); fx.kill(dog); return false; }
      }
      dog.position.y = y; T.p = add(dog.position, V(0, .55, 0));
      A(clock, moving, false, { run, bite, glow });
      if (t > 9) { T.stop(); fx.kill(dog); return false; }
    });
  }

  const SK = {
    // 1 · ศรฉับไว: two arrows at once, a hair apart, each with a white-gold ribbon
    arch_quick() {
      fx.cinematic(.4, 1.3);
      ready(() => { anim('arch_quick'); const drop = nock('arch_quick', WHITE);
        release('arch_quick', () => { drop(); loose(C(2.4, 2.1, 1.4), .8, 2);
          for (const [i, off] of [[0, -.12], [1, .12]].entries()) {
            const side = sideOf(dirTo()).multiplyScalar(off[1]);
            fx.after(i * .05, () => shoot({ to: chest(tg).add(V(0, .2 + i * .1, 0)).add(side), col: C(2.4, 2.1, 1.4), rib: .07, speed: 26, onHit: p => { struck(p, .75); if (near(p, 1.5)) hurt(95, false); } }));
          }
        }); });
      return 1.2;
    },
    // 2 · ศรพิษพรานไพร: a dripping green arrow; a toxic cloud swells and bites five times
    arch_poison() {
      fx.cinematic(.5, 1.6);
      ready(() => { anim('arch_poison'); const drop = nock('arch_poison', POISON, 1, POISON);
        release('arch_poison', () => { drop(); loose(POISON, .9, 2);
          shoot({ to: chest(tg).add(V(0, .25, 0)), col: POISON, trail: C(.4, 1.6, .3), rib: .08, motes: 3, onHit: p => {
            struck(p, .9, POISON); const P = tpos();
            fx.decal(5, P.x, P.z, 1.4, POISON, C(.1, .5, .1), { life: 3.8, grow: .25 });
            fx.burst(p, 24, { c: [POISON, C(.2, .9, .2)], size: .12, sp: 2.5, life: .7, drag: 2.5 });
            const snake = fx.emojiSprite('🐍', '#7dff6a', C(.8, 2, .6));
            fx.addTask((dt, t) => { snake.position.copy(tpos()).setY(1.6 + t * .6); snake.scale.setScalar(.2 + clamp01(t / .3) * .7); snake.material.opacity = clamp01((1.3 - t) / .4); if (t > 1.3) { fx.kill(snake); return false; } });
            if (!near(p, 1.5)) return; hurt(80, false, .12, 'arch_poison'); fx.popup(tg.head().add(V(0, .4, 0)), 'ติดพิษ', 'st');
            let n = 0;
            fx.addTask((dt, t) => {
              const c = tpos();
              if (Math.random() < dt * 22) fx.emit({ p: add(c, V(rand(-.6, .6), rand(.1, 1.6), rand(-.6, .6))), v: V(rand(-.15, .15), rand(.15, .4), rand(-.15, .15)), c: Math.random() < .5 ? C(.25, .45, .18) : C(.35, .6, .2), life: 1.4, size: .3, size1: .7, shape: SH.soft, a: .45, drag: 1 }, fx.PN);
              if (Math.random() < dt * 16) fx.emit({ p: chest(tg).add(V(rand(-.3, .3), rand(-.4, .5), rand(-.25, .25))), v: V(0, rand(.3, .8), 0), c: POISON, life: .8, size: .1, size1: .02 });
              if (t > .7 * (n + 1) && n < 5) { n++; if (tg.alive) { hurt(30, false, 0, 'arch_poison'); fx.burst(chest(tg), 8, { c: [POISON, WHITE], size: .07, sp: 2, life: .35, shape: SH.star, drag: 4 }); } }
              if (t > 3.8) return false;
            });
          } });
        }); });
      return 1.2;
    },
    // 3 · ศรทะลวงเกราะ: kneeling, a full heavy draw gathering light; a lightning-wrapped arrow
    // punches through, rings of air along its path, the ground splitting under the target
    arch_pierce() {
      fx.cinematic(.75, 2);
      ready(() => { anim('arch_pierce'); const drop = nock('arch_pierce', SKY, 1.3); charge('arch_pierce', SKY, 1.2);
        release('arch_pierce', () => { drop(); fx.shake = .18; loose(SKY, 1.4, 4);
          const from = bowHand(), to = chest(tg).add(V(0, .2, 0)), end = add(to, to.clone().sub(from).setY(0).normalize().multiplyScalar(3));
          bolt(from, end, SKY, .4, .035, .2); fx.after(.06, () => bolt(from, end, C(1.6, 1.8, 2.4), .3, .018, .12));
          for (let i = 1; i <= 5; i++) fx.after(i * .025, () => ringPulse(from.clone().lerp(end, i / 6), end.clone().sub(from).normalize(), SKY, .55, .35));
          shoot({ from, to, col: SKY, k: 1.5, speed: 36, h: 0, through: 3, rib: .06, motes: 4, onHit: p => {
            struck(p, 1.6, SKY); const tp = tpos(); fx.shock(tp.x, tp.z, 2, SKY, C(.4, .6, 1.2), .5); fx.decal(4, tp.x, tp.z, 1.3, SKY, C(.2, .3, 1), { life: 1.4, grow: .15 });
            fx.burst(p, 30, { c: [SKY, WHITE, C(.8, 1.2, 2.6)], size: .1, sp: 6, upMin: -.3, life: .5, shape: SH.star, drag: 3 });
            for (let i = 1; i <= 3; i++) fx.after(i * .05, () => { const q = add(p, dirTo().multiplyScalar(i * .7)); fx.shock(q.x, q.z, .7, SKY, SKY, .35); });
            if (near(p, 1.6)) { hurt(260, true, .3); tg.knock(dirTo(), .45); fx.popup(tg.head().add(V(0, .5, 0)), 'เกราะแตก −35%', 'st'); }
          } });
        }); });
      return 1.6;
    },
    // 4 · ตาเหยี่ยว: a great golden hawk circles high on a ribbon of light, dives into the
    // hunter through a feather storm; a golden sigil under him, his eyes burning
    arch_hawk() {
      fx.cinematic(.7, 2.2); face(tpos()); anim('arch_hawk');
      const hawk = fx.emojiSprite('🦅', '#ffd77a', C(2.2, 1.7, .7)), T = trail(GOLD, .14, 24);
      const c0 = hero.pos();
      sigil(GOLD, 1.4, { p: c0.clone().setY(.06), life: 2.8, spin: .8, delay: .2 });
      fx.addTask((dt, t) => {
        const dive = clamp01((t - .5) / .3), a = t * 4.5;
        const orbit = add(c0, V(Math.cos(a) * 2.1, 3.3 + Math.sin(t * 7) * .15, Math.sin(a) * 2.1)), into = headP(hero);
        hawk.position.copy(orbit.lerp(into, dive * dive)); hawk.scale.setScalar(1.3 - dive * .7); T.p = hawk.position;
        for (let k = 0; k < 2; k++) fx.emit({ p: hawk.position.clone(), v: V(rand(-.4, .4), rand(-.6, 0), rand(-.4, .4)), c: Math.random() < .3 ? WHITE : GOLD, life: .6, size: .1, size1: .03, shape: SH.leaf, vr: 6 });
        if (dive >= 1) { T.stop(); fx.kill(hawk); return false; }
      });
      release('arch_hawk', () => {
        const hp = hero.pos(); fx.flash(headP(hero), 0xffd070, 50, .6); fx.shock(hp.x, hp.z, 2, GOLD, C(1, .5, .1), .6); fx.shock(hp.x, hp.z, 1.2, WHITE, GOLD, .4);
        fx.lightPillar(hp, GOLD, 4.5, .6, .9);
        for (let k = 0; k < 48; k++) { const a = k / 48 * 6.28; fx.emit({ p: add(headP(hero), V(Math.cos(a) * .3, -.2, Math.sin(a) * .3)), v: V(Math.cos(a) * rand(2.5, 4), rand(-.2, .4), Math.sin(a) * rand(2.5, 4)), c: k % 3 ? GOLD : WHITE, life: .9, size: .13, size1: .04, shape: SH.leaf, drag: 2.5, vr: 8 }); }
        character.tint?.(C(1, .75, .25), .35, 1.2);
        fx.after(.2, () => fx.popup(hp.clone().setY(hero.barY + .7), 'โจมตี +30% · คริ +30%', 'st'));
        const eyes = [-1, 1].map(() => fx.glowSprite(C(2.6, 1.9, .5), .14));
        fx.addTask((dt, t) => { const h = headP(hero).add(V(0, -.3, 0)), side = sideOf(dirTo()).multiplyScalar(.06);
          eyes.forEach((e, i) => { e.position.copy(h).add(side.clone().multiplyScalar(i ? 1 : -1)).add(dirTo().multiplyScalar(.12)); e.material.opacity = clamp01((3 - t) / .5); });
          if (Math.random() < dt * 30) { const a = rand(0, 6.28), r = rand(.35, .6); fx.emit({ p: add(hero.pos(), V(Math.cos(a) * r, rand(.1, .4), Math.sin(a) * r)), v: V(0, rand(.8, 1.6), 0), c: GOLD, life: .9, size: .08, size1: .01 }); }
          if (t > 3) { eyes.forEach(e => fx.kill(e)); return false; } });
      });
      return 1.6;
    },
    // 5 · ห่าฝนธนู: one arrow into the sky opens a golden sigil above the target; five waves
    // of ribboned arrows pour out of it and plant themselves around the target
    arch_rain() {
      fx.cinematic(.85, 2.8);
      ready(() => { anim('arch_rain'); const drop = nock('arch_rain', GOLD); charge('arch_rain', GOLD, .8);
        release('arch_rain', () => { drop(); loose(GOLD, 1, 2); const P = tpos(), from = bowHand(), sky = P.clone().setY(4.4);
          shoot({ from, to: add(from, dirTo().multiplyScalar(1.4)).add(V(0, 5, 0)), col: GOLD, speed: 26, h: 0, rib: .08, stick: false });
          fx.after(.28, () => { sigil(GOLD, 2.3, { p: sky, life: 2.3, spin: 1.2, grow: .35 }); fx.flash(sky, 0xffc060, 40, .8); fx.burst(sky, 30, { c: [GOLD, WHITE], size: .12, sp: 3, upMin: -.5, upMax: .5, life: .7, shape: SH.star, drag: 2 }); });
          fx.decal(1, P.x, P.z, 2, C(2, 1.4, .5), null, { life: 2.5, grow: .2 });
          for (let w = 0; w < 5; w++) fx.after(.5 + w * .2, () => {
            for (let i = 0; i < 7; i++) {
              const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 1.8, to = add(P, V(Math.cos(a) * r, .05, Math.sin(a) * r));
              fx.after(i * .02, () => shoot({ from: add(to, V(rand(-.5, .5), 4.3, rand(-.5, .5))), to, col: GOLD, speed: 20, h: 0, k: .9, rib: .045, motes: 1, stick: 'ground' }));
            }
            fx.after(.28, () => { if (near(P, 2)) { hurt(110, false, .05, 'arch_rain'); fx.impact(chest(tg), .6); } });
          });
        }); });
      return 1.4;
    },
    // 6 · ลมใต้ปีกครุฑ: golden garuda wings beat a gust over the party, and out of a jade
    // wind sigil beside him bursts the hunter's dog, which runs in and bites three times
    arch_garuda() {
      fx.cinematic(.7, 3); face(tpos()); anim('arch_garuda');
      const wingTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        for (let i = 0; i < 9; i++) { g.save(); g.translate(20, 230); g.rotate(-1.45 + i * .17); const grad = g.createLinearGradient(0, 0, 0, -210); grad.addColorStop(0, 'rgba(255,200,90,1)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
          g.fillStyle = grad; g.beginPath(); g.ellipse(0, -110, 16 + i, 105, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const wings = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: wingTex, color: C(2, 1.5, .7), ...ADD })); m.scale.x = s; fx.add(m); return { m, s }; });
      sigil(GOLD, 1.5, { p: hero.pos().setY(.06), life: 2, spin: -.8 });
      fx.addTask((dt, t) => {
        const v = hero.pos().sub(fx.cameraLocal()).setY(0).normalize(), back = v.clone().multiplyScalar(.3), side = sideOf(v).negate(), open = clamp01(t / .45), beat = t > .8 && t < 1.2 ? Math.sin((t - .8) / .4 * Math.PI) : 0;
        wings.forEach(({ m, s }) => { m.position.copy(hero.pos()).add(back).add(side.clone().multiplyScalar(s * (.15 + 1.25 * open))).add(V(0, 1.55 - beat * .25, 0)); m.lookAt(fx.camera.position); m.rotation.z += s * (-.35 + beat * .55);
          m.material.opacity = Math.min(open, clamp01((2 - t) / .4)); });
        if (Math.random() < .5 && t < 1.8) { const s = Math.random() < .5 ? -1 : 1; fx.emit({ p: hero.pos().add(side.clone().multiplyScalar(s * rand(.6, 1.6))).add(V(0, rand(.8, 2.4), 0)), v: V(0, rand(-.5, .2), 0), c: GOLD, life: .8, size: .09, size1: .02, shape: SH.leaf, vr: 4 }); }
        if (t > 2) { wings.forEach(({ m }) => fx.kill(m)); return false; }
      });
      release('arch_garuda', () => {
        const hp = hero.pos(), d = dirTo(); fx.shock(hp.x, hp.z, 3.6, JADE, C(.3, 1, .6), .8); fx.shock(hp.x, hp.z, 2.4, GOLD, C(1, .5, .1), .6);
        for (let k = 0; k < 50; k++) { const a = k / 50 * 6.28; fx.emit({ p: add(hp, V(Math.cos(a) * .4, rand(.2, 1.4), Math.sin(a) * .4)), v: V(Math.cos(a) * rand(2, 4.5), rand(.2, 1), Math.sin(a) * rand(2, 4.5)), c: Math.random() < .5 ? GOLD : JADE, life: 1, size: .11, size1: .03, shape: SH.leaf, drag: 1.5, vr: 6 }); }
        fx.popup(hp.clone().setY(hero.barY + .5), '+80', 'heal');
        fx.after(.25, () => fx.popup(hp.clone().setY(hero.barY + .8), 'ปาร์ตี้ · คริ +15% · โจมตี +10% · ตีเร็ว +8%', 'st'));
        // the dog's gate: a jade sigil and a whirl of wind beside him
        const spawn = add(hp, sideOf(d).multiplyScalar(1)).add(d.clone().multiplyScalar(.35)).setY(0);
        sigil(JADE, 1, { p: spawn.clone().setY(.07), life: 1.3, spin: 3, grow: .2 }); fx.lightPillar(spawn, JADE, 3, .45, .7); fx.flash(spawn, 0x60ffa0, 30, .5);
        for (let k = 0; k < 36; k++) { const a = k / 36 * 6.28 * 2, y = k / 36 * 1.6; fx.emit({ p: add(spawn, V(Math.cos(a) * .5, y, Math.sin(a) * .5)), v: V(-Math.sin(a) * 2, .6, Math.cos(a) * 2), c: k % 2 ? JADE : WHITE, life: .6, size: .09, size1: .02, shape: SH.leaf, drag: 2, vr: 6 }); }
        fx.after(.1, () => summonDog(spawn));
      });
      return 1.8;
    },
    // 7 · ศรกระจายเจ็ดดาว: seven stars light up in a fan before the bow, joined like a
    // constellation; five starlit arrows burst from it
    arch_volley() {
      fx.cinematic(.6, 1.6);
      ready(() => { anim('arch_volley'); const drop = nock('arch_volley', STAR);
        const d0 = dirTo(), side0 = sideOf(d0), stars = [], line = strip(C(1.4, 1.3, 2.2), .035, 7);
        for (let i = 0; i < 7; i++) {
          const u = (i - 3) / 3, s = fx.glowSprite(C(1, .95, 1.4), .001); stars.push({ s, u, born: .1 + i * .045 });
        }
        const at = (u, b) => add(b, d0.clone().multiplyScalar(.55 + Math.cos(u * 1.3) * .3)).add(side0.clone().multiplyScalar(u * .35)).add(V(0, u * .75 + Math.sin((u + 1) * 3.1) * .08, 0));
        const until = MOVES.arch_volley.hits[0] + .35;
        fx.addTask((dt, t) => {
          const b = bowHand(), list = [];
          stars.forEach(st => { const k = clamp01((t - st.born) / .12); st.s.position.copy(at(st.u, b)); st.s.scale.setScalar((.05 + k * .32) * (1 + Math.sin(t * 30 + st.u * 9) * .15)); st.s.material.opacity = clamp01((until - t) / .3); if (k > 0) list.push(st.s.position); });
          line.set(list); line.alpha = clamp01((until - t) / .3) * .8; line.draw();
          if (t > until) { stars.forEach(st => fx.kill(st.s)); line.kill(); return false; }
        });
        release('arch_volley', () => { drop(); loose(STAR, 1, 2); const d = dirTo(), dist = hero.pos().distanceTo(tpos()) + .2, b = bowHand();
          [-2, -1, 0, 1, 2].forEach((i, n) => fx.after(n * .03, () => {
            const ang = i * .15, dir = V(d.x * Math.cos(ang) - d.z * Math.sin(ang), 0, d.x * Math.sin(ang) + d.z * Math.cos(ang));
            const to = hero.pos().add(dir.multiplyScalar(dist)).setY(1.2);
            shoot({ from: at(i / 2 * .9, b), to, col: STAR, trail: C(1.6, 1.4, 2.6), rib: .07, motes: 3, stick: i ? false : 'target', onHit: p => {
              fx.burst(p, 10, { c: [WHITE, STAR], size: .09, sp: 2.5, life: .45, shape: SH.star, drag: 3 });
              if (near(p, 1.1)) { struck(p, .8, STAR); hurt(70, false, .05, 'arch_volley'); } } });
          }));
        }); });
      return 1.3;
    },
    // 8 · กับดักหนามพราน: he skids a spiked trap along the ground; it springs shut under the
    // target and a ring of great thorns bursts out of the earth around it
    arch_trap() {
      fx.cinematic(.6, 2);
      ready(() => { anim('arch_trap');
        release('arch_trap', () => { const from = add(hero.pos(), dirTo().multiplyScalar(.6)), P = tpos();
          const trap = new THREE.Group(); fx.add(trap);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: .7, metalness: .4 })); ring.rotation.x = Math.PI / 2; trap.add(ring);
          const spikes = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, s = new THREE.Mesh(new THREE.ConeGeometry(.05, .45, 5), new THREE.MeshStandardMaterial({ color: 0x9a8a70, metalness: .5, roughness: .4 })); s.position.set(Math.cos(a) * .42, 0, Math.sin(a) * .42); trap.add(s); spikes.push({ s, a }); }
          const thorns = new THREE.Group(); fx.add(thorns); thorns.position.copy(P).setY(0); const tm = new THREE.MeshStandardMaterial({ color: 0x3e4a22, roughness: .6, emissive: new THREE.Color(.25, .35, .05) });
          const th = []; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + rand(-.1, .1), r = rand(.75, .95), h = rand(.9, 1.4); const m = new THREE.Mesh(new THREE.ConeGeometry(.09, h, 5).translate(0, h / 2, 0), tm); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.set(-Math.sin(a) * .45, 0, Math.cos(a) * .45); m.scale.setScalar(.001); thorns.add(m); th.push(m); }
          let tr = null;
          fx.addTask((dt, t) => {
            const u = clamp01(t / .3); trap.position.copy(from.clone().lerp(P, u)).setY(.04); trap.rotation.y = t * 9 * (1 - u);
            if (u < 1 && Math.random() < .8) fx.emit({ p: trap.position.clone().setY(.06), v: V(rand(-.4, .4), rand(.4, .9), rand(-.4, .4)), c: C(1.6, 1.1, .5), life: .25, size: .06, size1: .01, shape: SH.star });
            const snap = clamp01((t - .32) / .08);
            spikes.forEach(({ s, a }) => { s.rotation.set(Math.sin(a) * (1.4 - snap * 1.25), 0, -Math.cos(a) * (1.4 - snap * 1.25)); s.position.y = .05 + snap * .2; });
            const up = t < 1.9 ? easeOutBack(clamp01((t - .34) / .16)) : 1 - clamp01((t - 1.9) / .3);
            th.forEach((m, i) => m.scale.setScalar(Math.max(.001, up * (1 - (i % 3) * .1))));
            if (t > .32 && t - dt <= .32) {
              fx.decal(4, P.x, P.z, 1.4, C(1.4, 1, .5), C(.5, .3, .1), { life: 2, grow: .15 }); fx.shake = .2; fx.flash(P, 0xffb060, 30, .3);
              fx.shock(P.x, P.z, 2.2, C(1.4, 1.1, .5), C(.4, .3, .1), .5);
              fx.burst(P.clone().setY(.2), 30, { c: [C(.55, .48, .32), C(.4, .33, .22)], S: fx.PN, size: .12, sp: 3, upMin: .6, life: .9, grav: 7 });
              fx.burst(P.clone().setY(.4), 20, { c: [C(1, 1.6, .4), GOLD], size: .08, sp: 3, upMin: .4, life: .5, shape: SH.leaf, drag: 2 });
              tr = true;
              if (near(P, 1.3)) { hurt(180, false, 0); fx.stunStars(tg, 1.6); fx.popup(tg.head().add(V(0, .5, 0)), 'ติดกับ 1.6 วิ · ช้าลง 40%', 'st'); }
            }
            if (tr && t < 1.9 && Math.random() < .3) fx.emit({ p: add(P, V(rand(-.9, .9), rand(.1, 1), rand(-.9, .9))), v: V(0, rand(.2, .5), 0), c: C(.9, 1.5, .3), life: .6, size: .06, size1: .01 });
            if (t > 2.4) { fx.kill(trap); fx.kill(thorns); return false; }
          });
        }); });
      return 1.5;
    },
    // 9 · ศรสังหารเหยี่ยวราตรี: the world darkens under a blood moon, a red reticle closes on
    // the target, the breath is held … one arrow, a streak of light, a pillar of fire
    arch_snipe() {
      fx.cinematic(1, 2.6);
      ready(() => { anim('arch_snipe'); const drop = nock('arch_snipe', BLOODMOON, 1.2); charge('arch_snipe', BLOODMOON, 1);
        const d0 = dirTo(), moonP = add(hero.pos(), d0.clone().multiplyScalar(-3)).add(sideOf(d0).multiplyScalar(-1.2)).setY(4.6);
        const moon = fx.glowSprite(BLOODMOON, .1), halo = fx.glowSprite(C(1.2, .15, .12), .1);
        fx.addTask((dt, t) => { const k = clamp01(t / .4) * clamp01((2.5 - t) / .5); moon.position.copy(moonP); halo.position.copy(moonP); moon.scale.setScalar(1.6 * k + .001); halo.scale.setScalar(4.2 * k + .001); if (t > 2.5) { fx.kill(moon); fx.kill(halo); return false; } });
        const line = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: C(2.6, .3, .3), ...ADD })); fx.add(line);
        const reticle = sigil(BLOODMOON, .8, { p: chest(tg), dir: d0.clone().negate(), life: 1.35, spin: 2.5, delay: .35, grow: .2 });
        fx.addTask((dt, t) => {
          const a = bowHand(), b = chest(tg).add(V(0, .45, 0)); line.position.copy(a.clone().lerp(b, .5)); line.lookAt(fx.toWorld(b)); line.scale.set(1, 1, a.distanceTo(b));
          const on = clamp01((t - .5) / .2) * clamp01((1.33 - t) / .05); line.material.opacity = on * (.5 + .3 * Math.sin(t * 30));
          reticle.position.copy(b); reticle.scale.setScalar(1 - clamp01((t - .45) / .8) * .6);
          if (t > 1.4) { fx.kill(line); return false; }
        });
        release('arch_snipe', () => { drop(); fx.shake = .3; loose(BLOODMOON, 1.6, 4);
          const from = bowHand(), to = chest(tg).add(V(0, .45, 0));
          const beam = strip(C(2.6, .8, .6), .06, 2); beam.set([to, from]);
          fx.addTask((dt, t) => { beam.alpha = 1 - t / .5; beam.w = .06 * (1 - t / .5) + .008; beam.draw(); if (t > .5) { beam.kill(); return false; } });
          shoot({ from, to, col: C(2.6, .6, .4), trail: WHITE, k: 1.3, speed: 70, h: 0, rib: .1, motes: 4, onHit: p => {
            fx.impact(p, 2.6, C(2.6, .7, .4)); fx.hitstop(.18); const tp = tpos(); fx.lightPillar(tp, C(2, .6, .4), 7, .8, .9);
            fx.shock(tp.x, tp.z, 3, BLOODMOON, C(.6, .05, .05), .6); fx.after(.08, () => fx.shock(tp.x, tp.z, 1.8, WHITE, BLOODMOON, .4));
            fx.burst(p, 40, { c: [BLOODMOON, WHITE, C(2.6, 1.2, .5)], size: .12, sp: 7, life: .6, shape: SH.star, drag: 3 });
            if (near(p, 1.6)) { hurt(900, true, .3); tg.knock(dirTo(), .7); fx.popup(tg.head().add(V(0, .7, 0)), 'สังหาร!', 'st big'); }
          } });
        }); });
      return 2.1;
    },
    // 10 · ศรเพลิงอัคนีบาต: a burning arrow shot straight up tears open a fire sigil in the
    // sky; meteors with flaming tails rain down, the last one enormous, embers falling after
    arch_meteor() {
      fx.cinematic(1, 4);
      ready(() => { anim('arch_meteor'); const drop = nock('arch_meteor', FIRE, 1.3); charge('arch_meteor', FIRE, 1.3);
        const flame = fx.glowSprite(FIRE, .3);
        fx.addTask((dt, t) => { flame.position.copy(bowHand().lerp(drawHand(), .2)); flame.scale.setScalar(.3 + clamp01(t / 1.1) * .5 + Math.sin(t * 40) * .05);
          if (Math.random() < .9) fx.emit({ p: flame.position.clone(), v: V(rand(-.2, .2), rand(.5, 1.2), rand(-.2, .2)), c: Math.random() < .3 ? C(2.6, 1.8, .6) : FIRE, life: .45, size: .14, size1: .02 });
          if (t > 1.1) { fx.kill(flame); return false; } });
        release('arch_meteor', () => { drop(); loose(FIRE, 1.5, 3); fx.shake = .2; const P = tpos(), from = bowHand(), sky = P.clone().setY(6.2);
          shoot({ from, to: add(from, V(0, 7, 0)), col: FIRE, trail: C(2.4, .8, .2), speed: 24, h: 0, k: 1.3, rib: .1, motes: 4, stick: false });
          fx.after(.35, () => {
            fx.flash(sky, 0xff6030, 70, 1.4); sigil(FIRE, 3.2, { p: sky, life: 2.9, spin: -1, grow: .4 }); sigil(C(2.6, 1.8, .6), 1.9, { p: sky.clone().setY(6.1), life: 2.9, spin: 1.6, grow: .5 });
            fx.decal(3, P.x, P.z, 2.8, FIRE, C(.8, .2, .05), { life: 3.2, grow: .4 });
            fx.burst(sky, 40, { c: [FIRE, C(2.6, 1.8, .6)], size: .16, sp: 4, upMin: -.6, upMax: .3, life: .9, drag: 1.5 });
          });
          for (let w = 0; w < 5; w++) fx.after(.65 + w * .26, () => {
            const big = w === 4, n = big ? 1 : 3;
            for (let i = 0; i < n; i++) {
              const a = rand(0, 6.28), r = big ? 0 : Math.sqrt(Math.random()) * 2.2, to = add(P, V(Math.cos(a) * r, .1, Math.sin(a) * r));
              const ball = fx.glowSprite(FIRE, big ? 1.4 : .6), core = fx.glowSprite(C(2.6, 2, 1), big ? .6 : .25), from2 = add(to, V(rand(-1.2, 1.2), 6, rand(-1.2, 1.2)));
              const T = trail(FIRE, big ? .38 : .18, 18), T2 = trail(C(2.6, 1.8, .6), big ? .14 : .06, 12), dur = big ? .55 : .35;
              fx.addTask((dt, t) => { const u = clamp01(t / dur); ball.position.copy(from2.clone().lerp(to, u * u)); core.position.copy(ball.position); T.p = T2.p = ball.position;
                for (let k = 0; k < (big ? 4 : 2); k++) fx.emit({ p: add(ball.position, V(rand(-.15, .15), rand(-.15, .15), rand(-.15, .15))), c: Math.random() < .5 ? FIRE : C(2.6, 1.8, .6), life: .45, size: big ? .35 : .18, size1: .03 });
                if (Math.random() < .6) fx.emit({ p: ball.position.clone(), v: V(rand(-.2, .2), rand(0, .3), rand(-.2, .2)), c: C(.28, .22, .18), life: 1, size: big ? .5 : .25, size1: big ? 1 : .55, shape: SH.soft, a: .5, drag: 1.5 }, fx.PN);
                if (u >= 1) { fx.kill(ball); fx.kill(core); T.stop(); T2.stop(); fx.impact(to.clone().setY(.4), big ? 2.6 : 1.1, FIRE); fx.shock(to.x, to.z, big ? 3.6 : 1.4, FIRE, C(.8, .2, .05), .55);
                  fx.decal(3, to.x, to.z, big ? 1.8 : .7, C(1.6, .5, .1), C(.3, .05, 0), { life: 2, grow: .1 });
                  fx.burst(to.clone().setY(.3), big ? 36 : 12, { c: [C(.3, .25, .2), C(.5, .4, .3)], S: fx.PN, size: .2, size1: .5, sp: 2.5, upMin: .3, life: 1, shape: SH.soft, a: .7 });
                  fx.burst(to.clone().setY(.3), big ? 40 : 14, { c: [FIRE, C(2.6, 1.8, .6)], size: .09, sp: big ? 6 : 4, upMin: .5, upK: 1.5, life: .9, grav: 6, shape: SH.star });
                  if (big) { fx.lightPillar(to, FIRE, 7, 1.1, 1); fx.hitstop(.16); fx.shake = .4;
                    fx.addTask((dt2, t2) => { if (Math.random() < .8) fx.emit({ p: add(P, V(rand(-2.5, 2.5), rand(3, 5), rand(-2.5, 2.5))), v: V(rand(-.2, .2), -rand(1, 2), rand(-.2, .2)), c: Math.random() < .5 ? FIRE : C(2.6, 1.8, .6), life: 1.6, size: .07, size1: .02 }); return t2 < 1.6; }); }
                  return false; } });
            }
            fx.after(big ? .55 : .35, () => { if (near(P, 2.6)) hurt(big ? 320 : 120, big, .1, 'arch_meteor'); });
          });
        }); });
      return 2.2;
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
