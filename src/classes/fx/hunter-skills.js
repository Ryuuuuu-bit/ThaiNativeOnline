import { moveSkillPlayer } from './skillMovement.js';
import * as THREE from 'three';
import { lockTime } from '../tempo.js';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { HUNTER_SKILLS } from '../hunter-moves.js';
import { makeDog, followerDog } from '../dog.js';

// The hunter's (นายพราน) ten skills with their effects, timed to the hunter's clips
// (release times come from hunter-moves.js). Positions are FX-local units.
// Two sources of damage, Ragnarok-hunter style: his arrows (a real arrow nocked between the
// hands, a flare on release, a ribbon of light in flight) and his dog's fangs. The dog is the
// one heeling behind him in the world when there is one (see dogActor below); skills send it
// to pounce, hold, circle a pack or howl, and spirit wolves join it for the pack skills.
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

export function createHunterSkills({ fx, character, player, dummy, groundHeight, canStand, labels, damage }) {
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
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback, m.speed); return m; };
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
      moveSkillPlayer(player.position, from.x + (dest.x - from.x) * e, from.z + (dest.z - from.z) * e, canStand); player.position.y = groundHeight(player.position.x, player.position.z);
      if (u >= 1) { face(tpos()); cb(); return false; }
    });
  }

  // ---- the dog --------------------------------------------------------------------------
  // The hunter's own dog does the biting. When the world has his heeling dog (followerDog,
  // src/combat/CombatView.js), that dog is borrowed: it is hidden and a copy runs off from the
  // very spot, then trots back and hands over. Without one (the city training ground), the dog
  // steps out of a jade sigil beside him and fades into leaves after.
  // A dog actor runs a list of orders (run, leap, bite, hold, howl, circle, wait); a new order
  // list replaces what is left, so skills can call the dog back mid-errand.
  const BARK = C(2.4, 1.6, .7), FANG = C(2.6, .5, .35);
  const dust = (p, k = 1) => { if (Math.random() < .55) fx.emit({ p: p.clone().add(V(rand(-.2, .2), .05, rand(-.2, .2))), v: V(rand(-.3, .3), rand(.3, .7), rand(-.3, .3)), c: C(.55, .48, .36), life: .6, size: .14 * k, size1: .35 * k, shape: SH.soft, a: .5, drag: 2 }, fx.PN); };
  // the bite lands: fang arcs, a snap of light, blood flecks and leaves (jade for spirit dogs)
  function snapFx(mouth, from, big, spirit) {
    const col = spirit ? JADE : FANG, back = from.clone().sub(mouth).setY(0).normalize();
    fx.impact(mouth, big ? 1.5 : .8, col);
    for (const s of [-1, 1]) fx.slashArc(mouth, add(mouth, back.clone().negate()), { r: big ? .85 : .55, sweep: 1.6, pal: spirit ? 'jade' : 'red', pitch: s * .9, roll: rand(-.2, .2), dur: .07, thick: .4 });
    fx.burst(mouth, big ? 24 : 12, { c: spirit ? [JADE, WHITE] : [FANG, C(1.4, .2, .15), WHITE], size: .07, sp: big ? 3.5 : 2.5, life: .45, grav: 5, drag: 2 });
    if (big) { fx.shock(mouth.x, mouth.z, 1.4, col, col.clone().multiplyScalar(.3), .45); fx.shake = Math.max(fx.shake || 0, .12); }
  }
  function dogActor({ spirit = false, borrow = null, from = null, glowColor } = {}) {
    const dog = makeDog({ transient: true, glowColor: glowColor ?? (spirit ? '#5dffa8' : undefined) }), A = dog.userData.animate;
    const S = borrow ? borrow.scale.x / fx.K : spirit ? .85 : .95;
    const T = trail(spirit ? JADE : C(1.1, .85, .45), spirit ? .08 : .045, 14);
    dog.position.copy(from ?? (borrow ? fx.toLocal(borrow.getWorldPosition(V())).setY(0) : hero.pos())); fx.add(dog);
    if (borrow) { dog.rotation.y = borrow.rotation.y; borrow.visible = false; borrow.userData.away = true; dog.scale.setScalar(S); } else dog.scale.setScalar(.001);
    let q = [], cur = null, t0 = 0, clock = 0;
    const me = { dog, alive: true, spirit, borrow, frenzy: 0, order(list) { q = list.slice(); cur = null; return me; }, then(list) { q.push(...list); return me; } };
    const faceTo = (p, k = 1) => { const d = p.clone().sub(dog.position); if (d.lengthSq() < 1e-6) return; const want = Math.atan2(d.x, d.z), a = Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)); dog.rotation.y += a * Math.min(1, k); };
    const step = (to, sp, dt) => { const d = to.clone().sub(dog.position).setY(0), L = d.length(); faceTo(to, dt * 14); if (L < sp * dt) { dog.position.x = to.x; dog.position.z = to.z; return true; } dog.position.add(d.multiplyScalar(sp * dt / L)); return false; };
    const nearTarget = (r = .95) => tpos().add(dog.position.clone().sub(tpos()).setY(0).normalize().multiplyScalar(r)).setY(0);
    const mouth = (y = 0) => tpos().add(dog.position.clone().sub(tpos()).setY(0).normalize().multiplyScalar(.3)).setY(.7 + y * .6);
    const homeSpot = () => borrow?.parent ? fx.toLocal(borrow.getWorldPosition(V())).setY(0) : hero.pos().add(sideOf(dirTo()).multiplyScalar(-.9)).add(dirTo().multiplyScalar(-.4));
    let born = borrow ? 1 : 0;
    if (!borrow) {
      sigil(spirit ? JADE : GOLD, .9, { p: dog.position.clone().setY(.07), life: 1, spin: 3, grow: .2 });
      fx.flash(dog.position.clone().setY(.6), spirit ? 0x60ffa0 : 0xffd080, 25, .4);
      for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28 * 2, y = k / 24 * 1.3; fx.emit({ p: add(dog.position, V(Math.cos(a) * .45, y, Math.sin(a) * .45)), v: V(-Math.sin(a) * 2, .5, Math.cos(a) * 2), c: k % 2 ? JADE : WHITE, life: .55, size: .08, size1: .02, shape: SH.leaf, drag: 2, vr: 6 }); }
    }
    const finish = () => {
      me.alive = false; T.stop();
      if (borrow) { borrow.visible = true; borrow.userData.away = false; fx.kill(dog); return; }
      fx.burst(add(dog.position, V(0, .5, 0)), 22, { c: [JADE, GOLD], size: .1, sp: 2.5, upMin: .4, life: .8, shape: SH.leaf, drag: 2 });
      fx.shock(dog.position.x, dog.position.z, .8, JADE, JADE, .35); fx.kill(dog);
    };
    fx.addTask((dt, t) => {
      clock += dt; me.frenzy = Math.max(0, me.frenzy - dt);
      if (born < 1) { born = Math.min(1, born + dt / .3); dog.scale.setScalar(S * Math.max(.001, easeOutBack(born))); }
      if (!cur) { cur = q.shift() || { kind: 'home' }; t0 = t; cur.from = dog.position.clone(); cur.n = 0; }
      const o = cur, pt = t - t0;
      let moving = false, run = 0, bite = null, howl = 0, y = 0, fin = false, glow = spirit ? .55 : me.frenzy > 0 ? .18 : 0;
      switch (o.kind) {
        case 'run': { moving = true; run = 1; dust(dog.position); const to = o.to?.() ?? nearTarget(); fin = (!tg.alive && !o.to) || step(to, o.sp ?? 9, dt) || pt > 3; break; }
        case 'leap': { // pounce onto the target in an arc; jaws open in the air, shut on landing
          const dur = o.dur ?? .42, u = clamp01(pt / dur), to = o.to?.() ?? nearTarget(.55);
          dog.position.lerpVectors(o.from, to, u); y = Math.sin(u * Math.PI) * (o.h ?? .7); faceTo(tpos(), dt * 20); bite = u * .55; run = 1;
          if (u >= 1) { o.onLand?.(mouth(0)); snapFx(mouth(0), dog.position, true, spirit); fin = true; }
          break; }
        case 'bite': { // n snaps on the target, the last one a leaping maul when big
          faceTo(tpos(), dt * 20); const dur = o.dur ?? .42, last = o.n === (o.count ?? 1) - 1, k = last && o.big ? 1.25 : 1, u = pt / (dur * k) - o.n;
          bite = clamp01(u); if (last && o.big) y = Math.sin(clamp01(u * 1.3) * Math.PI) * .4;
          if (u >= .55 && !o.snapped) { o.snapped = true; const m = mouth(y); snapFx(m, dog.position, last && o.big, spirit); if (tg.alive) o.onSnap?.(o.n, m, last); }
          if (u >= 1) { o.n++; o.snapped = false; if (o.n >= (o.count ?? 1) || !tg.alive) fin = true; }
          break; }
        case 'hold': { // jaws locked, head shaking the prey
          faceTo(tpos(), dt * 20); const p = nearTarget(.6); dog.position.lerp(p, Math.min(1, dt * 10)); bite = .5 + Math.sin(pt * 26) * .06; dog.rotation.z = Math.sin(pt * 22) * .12;
          if (Math.random() < dt * 14) fx.emit({ p: mouth(0), v: V(rand(-1, 1), rand(.5, 1.5), rand(-1, 1)), c: spirit ? JADE : FANG, life: .4, size: .05, size1: .01, grav: 6 });
          if (o.every && pt >= o.every * (o.n + 1)) { o.n++; snapFx(mouth(0), dog.position, false, spirit); if (tg.alive) o.onTick?.(o.n, mouth(0)); }
          if (pt > o.dur || !tg.alive) { dog.rotation.z = 0; fin = true; }
          break; }
        case 'howl': { // sit up, throw the head back, and let it out
          const at = o.at ?? .35; faceTo(o.face?.() ?? tpos(), dt * 10); howl = clamp01(pt / at) * clamp01((o.dur - pt) / .25);
          if (pt >= at && !o.fired) { o.fired = true; o.onPeak?.(add(dog.position, V(0, .9, 0)).add(V(Math.sin(dog.rotation.y) * .3, 0, Math.cos(dog.rotation.y) * .3))); }
          if (pt > o.dur) fin = true; break; }
        case 'circle': { // gallop round a centre, snapping inward `passes` times
          moving = true; run = 1; const c = o.c(), r = o.r ?? 1.4;
          if (o.a0 == null) o.a0 = Math.atan2(dog.position.z - c.z, dog.position.x - c.x);
          const a = o.a0 + (o.dir ?? 1) * (o.laps ?? 1) * 6.28 * clamp01(pt / o.dur), want = add(c, V(Math.cos(a) * r, 0, Math.sin(a) * r));
          const prev = dog.position.clone(); dog.position.lerp(want, Math.min(1, dt * 14)); faceTo(add(dog.position, dog.position.clone().sub(prev).multiplyScalar(10)), dt * 18); dust(dog.position, 1.2);
          const k = Math.floor(pt / o.dur * (o.passes ?? 3)); bite = (pt / o.dur * (o.passes ?? 3)) % 1 > .6 ? ((pt / o.dur * (o.passes ?? 3)) % 1 - .6) / .4 : null;
          if (k > o.n && o.n < (o.passes ?? 3)) { o.n = k; const m = c.clone().lerp(dog.position, .55).setY(.65); snapFx(m, dog.position, false, spirit); o.onPass?.(k - 1, m); }
          if (pt > o.dur) fin = true; break; }
        case 'wait': { faceTo(o.face?.() ?? tpos(), dt * 8); if (pt > o.dur) fin = true; break; }
        case 'home': {
          moving = true; run = .45; dust(dog.position);
          if (spirit) { if (pt > .1) { finish(); return false; } break; }
          const h = homeSpot(); if (step(h, borrow ? 6.5 : 5, dt) || pt > 3) { if (!borrow) { finish(); return false; } dog.rotation.y = borrow.rotation.y; finish(); return false; }
          break; }
      }
      if (fin) cur = null;
      dog.position.y = y; T.p = add(dog.position, V(0, .55 + y, 0));
      A(clock, moving, false, { run, bite, howl, glow: !borrow && born < 1 ? 1 - born * .9 : glow });
      if (t > 14) { finish(); return false; }
    });
    return me;
  }
  // The hunter's dog (one at a time; a new skill re-orders the one already out).
  let hound = null;
  const theDog = () => (hound?.alive ? hound : (hound = dogActor({ borrow: followerDog(), from: followerDog() ? null : add(hero.pos(), sideOf(dirTo()).multiplyScalar(-.9)).setY(0) })));
  // Spirit wolves out of jade sigils beside the hunter, gone after their orders.
  const wolves = (n, glowColor) => Array.from({ length: n }, (_, i) => dogActor({ spirit: true, glowColor, from: add(hero.pos(), sideOf(dirTo()).multiplyScalar(i % 2 ? 1.3 : -1.3)).add(dirTo().multiplyScalar(-.3 - i * .4)).setY(0) }));
  const dogHurt = (amt, crit, id, push = .08) => { if (tg.alive) hurt(amt, crit, push, id); };

  const SK = {
    // 1 · ศรคู่ฉับไว (Double Strafe): two arrows a breath apart into one target, quick enough to chain
    arch_quick() {
      fx.cinematic(.25, .9);
      ready(() => { anim('arch_quick'); const drop = nock('arch_quick', WHITE);
        release('arch_quick', () => { drop();
          for (let i = 0; i < 2; i++) fx.after(i * .11, () => { loose(C(2.4, 2.1, 1.4), .7, 1);
            shoot({ to: chest(tg).add(V(0, .15 + i * .12, 0)).add(sideOf(dirTo()).multiplyScalar(i ? .08 : -.08)), col: C(2.4, 2.1, 1.4), rib: .07, speed: 30, onHit: p => { struck(p, .7); if (near(p, 1.5)) hurt(95, false, .06, 'arch_quick'); } }); });
        }); });
      return .8;
    },
    // 2 · สั่งกัด!: a whistling jade arrow marks the prey; the dog bolts in, pounces, locks its jaws and shakes
    arch_poison() {
      fx.cinematic(.5, 1.8);
      ready(() => { anim('arch_poison'); const drop = nock('arch_poison', JADE);
        release('arch_poison', () => { drop(); loose(JADE, .9, 2);
          shoot({ to: chest(tg).add(V(0, .3, 0)), col: JADE, trail: C(.5, 1.8, 1), rib: .07, motes: 3, onHit: p => {
            struck(p, .8, JADE); const P = tpos();
            sigil(FANG, .9, { p: P.clone().setY(.06), life: 2.2, spin: -2, grow: .15 }); fx.popup(tg.head().add(V(0, .35, 0)), 'หมายเป้า!', 'st');
            if (near(p, 1.5)) hurt(80, false, .05, 'arch_poison');
          } });
          const d = theDog(); d.frenzy = 2.5;
          d.order([{ kind: 'run', sp: 11 }, { kind: 'leap', h: .8, onLand: () => { dogHurt(150, true, 'arch_poison', .2); if (tg.alive) { fx.stunStars(tg, 1.5); fx.popup(tg.head().add(V(0, .55, 0)), 'งับ! ตรึง 1.5 วิ', 'st'); } } },
            { kind: 'hold', dur: 1.3, every: .6, onTick: () => dogHurt(70, false, 'arch_poison', 0) }]);
        }); });
      return 1.2;
    },
    // 3 · ห่าศรพราน (Arrow Shower): one arrow up, a golden sigil opens over the pack and a single
    // dense shower nails the whole circle; the ground bursts and everything in it is shoved back
    arch_pierce() {
      fx.cinematic(.5, 1.6);
      ready(() => { anim('arch_pierce'); const drop = nock('arch_pierce', GOLD);
        release('arch_pierce', () => { drop(); loose(GOLD, 1, 2); const P = tpos(), from = bowHand(), sky = P.clone().setY(4.2), R0 = 2.2;
          shoot({ from, to: add(from, dirTo().multiplyScalar(1)).add(V(0, 5, 0)), col: GOLD, speed: 30, h: 0, rib: .08, stick: false });
          fx.after(.18, () => { sigil(GOLD, R0 + .3, { p: sky, life: 1.1, spin: 2, grow: .2 }); fx.flash(sky, 0xffc060, 40, .6); });
          fx.decal(1, P.x, P.z, R0, C(2, 1.4, .5), null, { life: 1.6, grow: .15 });
          for (let i = 0; i < 26; i++) fx.after(.3 + i * .012, () => { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R0, to = add(P, V(Math.cos(a) * r, .05, Math.sin(a) * r));
            shoot({ from: add(to, V(rand(-.4, .4), 4, rand(-.4, .4))), to, col: GOLD, speed: 26, h: 0, k: .85, rib: .045, motes: 1, stick: 'ground' }); });
          fx.after(.5, () => { fx.shock(P.x, P.z, R0 + .6, GOLD, C(1, .5, .1), .5); fx.burst(P.clone().setY(.2), 30, { c: [C(.55, .48, .32), C(.4, .33, .22)], S: fx.PN, size: .14, size1: .4, sp: 3, upMin: .5, life: .9, shape: SH.soft, a: .6 });
            if (near(P, R0 + .3)) { hurt(130, false, .2, 'arch_pierce'); tg.knock(tpos().sub(hero.pos()).setY(0).normalize(), .5); fx.impact(chest(tg), .8); } });
        }); });
      return 1.1;
    },
    // 4 · ตาเหยี่ยว: a golden hawk dives into the hunter; his eyes burn and his draw quickens
    arch_hawk() {
      fx.cinematic(.6, 2); face(tpos()); anim('arch_hawk');
      const hawk = fx.emojiSprite('🦅', '#ffd77a', C(2.2, 1.7, .7)), T = trail(GOLD, .14, 24), c0 = hero.pos();
      sigil(GOLD, 1.4, { p: c0.clone().setY(.06), life: 2.6, spin: .8, delay: .2 });
      fx.addTask((dt, t) => {
        const dive = clamp01((t - .5) / .3), a = t * 4.5, orbit = add(c0, V(Math.cos(a) * 2.1, 3.3 + Math.sin(t * 7) * .15, Math.sin(a) * 2.1));
        hawk.position.copy(orbit.lerp(headP(hero), dive * dive)); hawk.scale.setScalar(1.3 - dive * .7); T.p = hawk.position;
        for (let k = 0; k < 2; k++) fx.emit({ p: hawk.position.clone(), v: V(rand(-.4, .4), rand(-.6, 0), rand(-.4, .4)), c: Math.random() < .3 ? WHITE : GOLD, life: .6, size: .1, size1: .03, shape: SH.leaf, vr: 6 });
        if (dive >= 1) { T.stop(); fx.kill(hawk); return false; }
      });
      release('arch_hawk', () => {
        const hp = hero.pos(); fx.flash(headP(hero), 0xffd070, 50, .6); fx.shock(hp.x, hp.z, 2, GOLD, C(1, .5, .1), .6); fx.lightPillar(hp, GOLD, 4.5, .6, .9);
        for (let k = 0; k < 40; k++) { const a = k / 40 * 6.28; fx.emit({ p: add(headP(hero), V(Math.cos(a) * .3, -.2, Math.sin(a) * .3)), v: V(Math.cos(a) * rand(2.5, 4), rand(-.2, .4), Math.sin(a) * rand(2.5, 4)), c: k % 3 ? GOLD : WHITE, life: .9, size: .13, size1: .04, shape: SH.leaf, drag: 2.5, vr: 8 }); }
        character.tint?.(C(1, .75, .25), .35, 1.2);
        fx.after(.2, () => fx.popup(hp.clone().setY(hero.barY + .7), 'ตีเร็ว +25% · โจมตี +15% · คริ +10%', 'st'));
        if (hound?.alive) hound.frenzy = 10;
        // ten seconds of quickened hands: golden streaks keep spiralling up his bow arm
        fx.addTask((dt, t) => { if (Math.random() < dt * 26) { const b = bowHand(), a = rand(0, 6.28); fx.emit({ p: add(b, V(Math.cos(a) * .25, rand(-.3, .1), Math.sin(a) * .25)), v: V(0, rand(.6, 1.2), 0), c: GOLD, life: .5, size: .06, size1: .01, swirl: 4, home: b, homeK: 1 }); } return t < 10; });
      });
      return 1.5;
    },
    // 5 · ฝูงหมาไล่ล่า: five jade arrows pin the pack's ground; the dog and two spirit wolves run
    // circles round it, tearing in three waves
    arch_rain() {
      fx.cinematic(.8, 3);
      ready(() => { anim('arch_rain'); const drop = nock('arch_rain', JADE);
        release('arch_rain', () => { drop(); loose(JADE, 1, 2); const P = tpos(), d = dirTo();
          [-2, -1, 0, 1, 2].forEach((i, n) => fx.after(n * .03, () => { const a = Math.atan2(d.z, d.x) + i * .5, to = add(P, V(Math.cos(a) * 1.4, .05, Math.sin(a) * 1.4));
            shoot({ to, col: JADE, trail: C(.4, 1.6, .9), rib: .06, motes: 2, stick: 'ground', onHit: q => { sigil(JADE, .35, { p: q.clone().setY(.06), life: 2.4, spin: 3, grow: .1 }); fx.lightPillar(q, JADE, 1.6, .2, .5); } }); }));
          fx.after(.25, () => { sigil(JADE, 2.5, { p: P.clone().setY(.05), life: 2.6, spin: -1, grow: .3 }); fx.decal(2, P.x, P.z, 2.4, JADE, C(.1, .4, .2), { life: 2.8, grow: .3 }); });
          const c = () => tpos(), pack = [theDog(), ...wolves(2)];
          pack.forEach((w, i) => { w.frenzy = 3;
            w.order([{ kind: 'run', to: () => add(c(), V(Math.cos(i * 2.1) * 1.4, 0, Math.sin(i * 2.1) * 1.4)), sp: 11 },
              { kind: 'circle', c, r: 1.2 + i * .35, dur: 1.8, laps: 1.5, dir: i % 2 ? -1 : 1, passes: 3, onPass: (k) => { if (i === 0) { dogHurt(110, k === 2, 'arch_rain', .1); fx.shock(c().x, c().z, 2.6, JADE, C(.2, .8, .4), .4); if (k === 2) fx.popup(tg.head().add(V(0, .5, 0)), 'ฝูงหมาไล่ล่า!', 'st'); } } },
              ...(i ? [{ kind: 'home' }] : [{ kind: 'bite', count: 1, big: true, onSnap: () => {} }])]); });
        }); });
      return 1.4;
    },
    // 6 · หมาเห่าข่มขวัญ: the dog plants itself before him and lets out a howl; the roar rolls out
    // in rings that knock the pack dizzy
    arch_garuda() {
      fx.cinematic(.7, 2.4); face(tpos()); anim('arch_garuda');
      const d = theDog(), spot = () => add(hero.pos(), dirTo().multiplyScalar(.9));
      d.order([{ kind: 'run', to: spot, sp: 10 }, { kind: 'howl', dur: 1.5, at: .45, face: () => tpos(), onPeak: m => {
        const c = d.dog.position.clone(), R0 = 4;
        fx.shake = .3; fx.hitstop(.06); fx.flash(m, 0xffb060, 45, .5);
        for (let i = 0; i < 4; i++) fx.after(i * .1, () => { fx.shock(c.x, c.z, R0 * (.45 + i * .2), i % 2 ? FANG : BARK, C(.6, .2, .05), .5); ringPulse(add(m, dirTo().multiplyScalar(.3 + i * .4)), dirTo(), BARK, .5 + i * .35, .45); });
        sigil(FANG, R0, { p: c.clone().setY(.05), life: 1.4, spin: 2.5, grow: .25 });
        for (let k = 0; k < 60; k++) { const a = k / 60 * 6.28; fx.emit({ p: add(c, V(Math.cos(a) * .4, rand(.1, .6), Math.sin(a) * .4)), v: V(Math.cos(a) * rand(4, 7), rand(.2, .8), Math.sin(a) * rand(4, 7)), c: k % 3 ? C(.6, .5, .35) : BARK, life: .8, size: .16, size1: .45, shape: SH.soft, a: .5, drag: 2.5 }, fx.PN); }
        for (let k = 0; k < 30; k++) { const a = rand(0, 6.28); fx.emit({ p: add(c, V(0, .5, 0)), v: V(Math.cos(a) * rand(3, 6), rand(.5, 2), Math.sin(a) * rand(3, 6)), c: C(.6, 1.3, .3), life: 1, size: .09, size1: .03, shape: SH.leaf, drag: 2, vr: 8 }); }
        if (tg.alive && tpos().distanceTo(c) <= R0 + .5) { hurt(90, false, .3, 'arch_garuda'); fx.stunStars(tg, 1.5); tg.knock(tpos().sub(c).setY(0).normalize(), .4); fx.popup(tg.head().add(V(0, .5, 0)), 'ข่มขวัญ! มึน · ตีเบาลง 20%', 'st'); }
      } }, { kind: 'wait', dur: .3 }]);
      return 1.6;
    },
    // 7 · ศรทะลวงแนว (Sharp Shooting): kneeling full draw; a lightning-wrapped arrow tears a long
    // line through everything, the ground splitting all along it
    arch_volley() {
      fx.cinematic(.8, 2.2);
      ready(() => { anim('arch_volley'); const drop = nock('arch_volley', SKY, 1.3); charge('arch_volley', SKY, 1.2);
        release('arch_volley', () => { drop(); fx.shake = .22; loose(SKY, 1.5, 5);
          const from = bowHand(), to = chest(tg).add(V(0, .2, 0)), dir = to.clone().sub(from).setY(0).normalize(), end = add(to, dir.clone().multiplyScalar(7));
          bolt(from, end, SKY, .45, .04, .22); fx.after(.05, () => bolt(from, end, C(1.6, 1.8, 2.6), .35, .02, .14));
          for (let i = 1; i <= 8; i++) fx.after(i * .02, () => ringPulse(from.clone().lerp(end, i / 9), end.clone().sub(from).normalize(), SKY, .6, .35));
          for (let i = 0; i < 10; i++) fx.after(.05 + i * .025, () => { const q = add(hero.pos(), dir.clone().multiplyScalar(1 + i * 1)).setY(0); fx.shock(q.x, q.z, .8, SKY, C(.2, .3, 1), .35); fx.decal(4, q.x, q.z, .6, SKY, C(.2, .3, 1), { life: 1.2, grow: .1 }); fx.burst(q.clone().setY(.1), 5, { c: [C(.5, .45, .35)], S: fx.PN, size: .1, sp: 2, upMin: .6, life: .6, grav: 6 }); });
          shoot({ from, to, col: SKY, k: 1.6, speed: 45, h: 0, through: 7, rib: .07, motes: 4, onHit: p => {
            struck(p, 1.6, SKY); fx.burst(p, 30, { c: [SKY, WHITE], size: .1, sp: 6, life: .5, shape: SH.star, drag: 3 });
            if (near(p, 1.6)) { hurt(280, true, .3, 'arch_volley'); tg.knock(dir, .45); fx.popup(tg.head().add(V(0, .5, 0)), 'ทะลวง! เกราะแตก −25%', 'st'); }
          } });
        }); });
      return 1.5;
    },
    // 8 · กับดักดินระเบิด: a spiked trap skids under the pack and blows the earth apart; a ring of
    // thorns bursts up and pins whatever is left standing
    arch_trap() {
      fx.cinematic(.7, 2.4);
      ready(() => { anim('arch_trap');
        release('arch_trap', () => { const from = add(hero.pos(), dirTo().multiplyScalar(.6)), P = tpos(), R0 = 2.4;
          const trap = new THREE.Group(); fx.add(trap);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: .7, metalness: .4 })); ring.rotation.x = Math.PI / 2; trap.add(ring);
          const core = fx.glowSprite(FIRE, .3); fx.root.remove(core); trap.add(core);
          const thorns = new THREE.Group(); fx.add(thorns); thorns.position.copy(P).setY(0); const tm = new THREE.MeshStandardMaterial({ color: 0x3e4a22, roughness: .6, emissive: new THREE.Color(.25, .35, .05) });
          const th = []; for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28 + rand(-.1, .1), r = rand(1.2, R0 - .2), h = rand(.8, 1.4); const m = new THREE.Mesh(new THREE.ConeGeometry(.09, h, 5).translate(0, h / 2, 0), tm); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.set(-Math.sin(a) * .45, 0, Math.cos(a) * .45); m.scale.setScalar(.001); thorns.add(m); th.push(m); }
          let boom = false;
          fx.addTask((dt, t) => {
            const u = clamp01(t / .3); trap.position.copy(from.clone().lerp(P, u)).setY(.04); trap.rotation.y = t * 9 * (1 - u); core.scale.setScalar(.3 + Math.sin(t * 30) * .1 + clamp01((t - .3) / .2) * .8);
            if (u < 1 && Math.random() < .8) fx.emit({ p: trap.position.clone().setY(.06), v: V(rand(-.4, .4), rand(.4, .9), rand(-.4, .4)), c: C(1.6, 1.1, .5), life: .25, size: .06, size1: .01, shape: SH.star });
            if (t > .5 && !boom) { boom = true; trap.visible = false;
              fx.shake = .4; fx.hitstop(.08); fx.flash(P, 0xff8030, 70, .6); fx.impact(P.clone().setY(.4), 2.2, FIRE);
              fx.shock(P.x, P.z, R0 + .8, FIRE, C(.6, .2, .05), .6); fx.after(.08, () => fx.shock(P.x, P.z, R0, C(1.4, 1.1, .5), C(.4, .3, .1), .5));
              fx.decal(3, P.x, P.z, R0, C(1.6, .6, .15), C(.25, .1, .02), { life: 2.6, grow: .12 });
              fx.burst(P.clone().setY(.3), 50, { c: [C(.55, .48, .32), C(.4, .33, .22), C(.3, .25, .2)], S: fx.PN, size: .2, size1: .6, sp: 4, upMin: .5, upK: 1.6, life: 1.2, shape: SH.soft, a: .7 });
              fx.burst(P.clone().setY(.3), 40, { c: [FIRE, C(2.6, 1.8, .6)], size: .09, sp: 6, upMin: .6, upK: 1.8, life: .9, grav: 7, shape: SH.star });
              fx.lightPillar(P, FIRE, 3.5, .9, .6);
              if (near(P, R0 + .3)) { hurt(240, false, .2, 'arch_trap'); fx.stunStars(tg, 1.6); fx.popup(tg.head().add(V(0, .5, 0)), 'ตรึง 1.6 วิ · ช้าลง 40%', 'st'); }
            }
            const up = t < 2.1 ? easeOutBack(clamp01((t - .55) / .18)) : 1 - clamp01((t - 2.1) / .3);
            th.forEach((m, i) => m.scale.setScalar(Math.max(.001, up * (1 - (i % 3) * .1))));
            if (boom && t < 2.1 && Math.random() < .4) fx.emit({ p: add(P, V(rand(-R0, R0) * .7, rand(.1, 1), rand(-R0, R0) * .7)), v: V(0, rand(.2, .5), 0), c: C(.9, 1.5, .3), life: .6, size: .06, size1: .01 });
            if (t > 2.6) { fx.kill(trap); fx.kill(thorns); return false; }
          });
        }); });
      return 1.5;
    },
    // 9 · ล่าคู่ศรเหยี่ยวราตรี: the dog pins the prey down while the blood moon rises; the hunter
    // holds his breath and looses one arrow — harder still on a pinned target
    arch_snipe() {
      fx.cinematic(1, 2.6);
      const d = theDog(); d.frenzy = 3;
      d.order([{ kind: 'run', sp: 12 }, { kind: 'leap', h: .9, onLand: () => { dogHurt(120, false, 'arch_snipe', .1); if (tg.alive) { fx.stunStars(tg, 1); fx.popup(tg.head().add(V(0, .45, 0)), 'ตะครุบ!', 'st'); } } }, { kind: 'hold', dur: 1.1 }, { kind: 'run', to: () => add(tpos(), sideOf(dirTo()).multiplyScalar(1.4)), sp: 9 }, { kind: 'wait', dur: .5 }]);
      ready(() => { anim('arch_snipe'); const drop = nock('arch_snipe', BLOODMOON, 1.2); charge('arch_snipe', BLOODMOON, 1);
        const d0 = dirTo(), moonP = add(hero.pos(), d0.clone().multiplyScalar(-3)).add(sideOf(d0).multiplyScalar(-1.2)).setY(4.6);
        const moon = fx.glowSprite(BLOODMOON, .1), halo = fx.glowSprite(C(1.2, .15, .12), .1);
        fx.addTask((dt, t) => { const k = clamp01(t / .4) * clamp01((2.5 - t) / .5); moon.position.copy(moonP); halo.position.copy(moonP); moon.scale.setScalar(1.6 * k + .001); halo.scale.setScalar(4.2 * k + .001); if (t > 2.5) { fx.kill(moon); fx.kill(halo); return false; } });
        const line = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: C(2.6, .3, .3), ...ADD })); fx.add(line);
        const reticle = sigil(BLOODMOON, .8, { p: chest(tg), dir: d0.clone().negate(), life: MOVES.arch_snipe.hits[0] + .02, spin: 2.5, delay: .35, grow: .2 });
        fx.addTask((dt, t) => {
          const a = bowHand(), b = chest(tg).add(V(0, .45, 0)); line.position.copy(a.clone().lerp(b, .5)); line.lookAt(fx.toWorld(b)); line.scale.set(1, 1, a.distanceTo(b));
          const rel = MOVES.arch_snipe.hits[0]; line.material.opacity = clamp01((t - rel * .38) / .2) * clamp01((rel - t) / .05) * (.5 + .3 * Math.sin(t * 30));
          reticle.position.copy(b); reticle.scale.setScalar(1 - clamp01((t - .45) / .8) * .6);
          if (t > MOVES.arch_snipe.hits[0] + .07) { fx.kill(line); return false; }
        });
        release('arch_snipe', () => { drop(); fx.shake = .3; loose(BLOODMOON, 1.6, 4);
          const from = bowHand(), to = chest(tg).add(V(0, .45, 0)), beam = strip(C(2.6, .8, .6), .06, 2); beam.set([to, from]);
          fx.addTask((dt, t) => { beam.alpha = 1 - t / .5; beam.w = .06 * (1 - t / .5) + .008; beam.draw(); if (t > .5) { beam.kill(); return false; } });
          shoot({ from, to, col: C(2.6, .6, .4), trail: WHITE, k: 1.3, speed: 70, h: 0, rib: .1, motes: 4, onHit: p => {
            fx.impact(p, 2.6, C(2.6, .7, .4)); fx.hitstop(.18); const tp = tpos(); fx.lightPillar(tp, C(2, .6, .4), 7, .8, .9);
            fx.shock(tp.x, tp.z, 3, BLOODMOON, C(.6, .05, .05), .6); fx.after(.08, () => fx.shock(tp.x, tp.z, 1.8, WHITE, BLOODMOON, .4));
            fx.burst(p, 40, { c: [BLOODMOON, WHITE, C(2.6, 1.2, .5)], size: .12, sp: 7, life: .6, shape: SH.star, drag: 3 });
            if (near(p, 1.6)) { hurt(900, true, .3, 'arch_snipe'); tg.knock(dirTo(), .7); fx.popup(tg.head().add(V(0, .7, 0)), 'ล่าคู่! สังหาร', 'st big'); }
          } });
        }); });
      return 2.1;
    },
    // 10 · ล่าล้างฝูง: a burning arrow tears open a fire sigil over the pack; six waves of fire arrows
    // pour down while the dog and two ember wolves rampage round the circle
    arch_meteor() {
      fx.cinematic(1, 4);
      ready(() => { anim('arch_meteor'); const drop = nock('arch_meteor', FIRE, 1.3); charge('arch_meteor', FIRE, 1.3);
        release('arch_meteor', () => { drop(); loose(FIRE, 1.5, 3); fx.shake = .2; const P = tpos(), from = bowHand(), sky = P.clone().setY(6), R0 = 3.2;
          shoot({ from, to: add(from, V(0, 7, 0)), col: FIRE, trail: C(2.4, .8, .2), speed: 26, h: 0, k: 1.3, rib: .1, motes: 4, stick: false });
          fx.after(.3, () => { fx.flash(sky, 0xff6030, 70, 1.4); sigil(FIRE, R0 + .4, { p: sky, life: 2.6, spin: -1, grow: .4 }); sigil(C(2.6, 1.8, .6), 2, { p: sky.clone().setY(5.9), life: 2.6, spin: 1.6, grow: .5 });
            fx.decal(3, P.x, P.z, R0, FIRE, C(.8, .2, .05), { life: 3.4, grow: .4 }); fx.burst(sky, 40, { c: [FIRE, C(2.6, 1.8, .6)], size: .16, sp: 4, upMin: -.6, upMax: .3, life: .9, drag: 1.5 }); });
          for (let w = 0; w < 6; w++) fx.after(.55 + w * .25, () => {
            for (let i = 0; i < 6; i++) fx.after(i * .02, () => { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R0, to = add(P, V(Math.cos(a) * r, .05, Math.sin(a) * r));
              shoot({ from: add(to, V(rand(-1, 1), 5.5, rand(-1, 1))), to, col: FIRE, trail: C(2.6, 1.2, .3), speed: 24, h: 0, k: 1, rib: .07, motes: 2, stick: 'ground', onHit: q => { fx.impact(q.clone().setY(.3), .6, FIRE); fx.decal(3, q.x, q.z, .45, C(1.6, .5, .1), C(.3, .05, 0), { life: 1.6, grow: .1 }); } }); });
            fx.after(.25, () => { fx.shock(P.x, P.z, R0, FIRE, C(.8, .2, .05), .4); if (near(P, R0 + .3)) hurt(w === 5 ? 260 : 120, w === 5, .08, 'arch_meteor'); if (w === 5) { fx.lightPillar(P, FIRE, 7, 1.1, 1); fx.hitstop(.12); fx.shake = .4; } });
          });
          const c = () => tpos(), pack = [theDog(), ...wolves(2, '#ff8a3c')];
          pack.forEach((w, i) => { w.frenzy = 4;
            w.order([{ kind: 'run', to: () => add(c(), V(Math.cos(i * 2.1) * 1.6, 0, Math.sin(i * 2.1) * 1.6)), sp: 12 },
              { kind: 'circle', c, r: 1.3 + i * .5, dur: 1.6, laps: 1.5, dir: i % 2 ? -1 : 1, passes: 4 },
              ...(i ? [{ kind: 'home' }] : [{ kind: 'bite', count: 2, big: true }])]); });
        }); });
      return 2.2;
    },
  };

  R.cast = (id, quiet = false) => {
    if (R.time < R.busyUntil) return false;
    const dist = player.position.distanceTo(fx.toWorld(tg.pos.clone()));
    if (dist > R.range) { if (!quiet) fx.popup(hero.pos().setY(hero.barY + .4), 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ', 'st'); return false; }
    R.current = id; const dur = lockTime(MOVES[id], SK[id]()); R.busyUntil = R.time + dur;
    return dur;
  };
  R.update = dt => { R.time += dt; if (R.time >= R.busyUntil) R.facing = null; };
  Object.defineProperty(R, 'busy', { get: () => R.time < R.busyUntil });
  return R;
}
