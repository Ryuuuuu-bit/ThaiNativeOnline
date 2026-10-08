import * as THREE from 'three';
import { lockTime } from '../tempo.js';
import { gltfLoader } from '../../core/gltf.js';
import { V, C, rand, clamp01, easeOutBack, SH, COL } from './engine.js';
import { HERBALIST_SKILLS } from '../herbalist-moves.js';

// หมอยา: ten skills ported from prototypes/skill-fx/src/healer_fx.src.html onto the
// 3D herbalist. The prototype was a party fight; here heals land on the herbalist
// and attacks on the training dummy. While casting, the grimoire (ตำรายา, Tripo model
// public/models/herbalist-book.glb) orbits the herbalist closed; on release it glides
// to the front, bursts open into the spell-book with the sigil, then closes and orbits on.
// Positions are FX-local units (see engine.js K).
const { GOLD, WHITE, DUST } = COL;
const HERB = C(.45, 1.6, .55), HERB_HOT = C(1.4, 3, 1.3), LEAF = C(.35, 1.0, .35), GOLD_SOFT = C(1.2, .9, .35),
  EMBER = C(2.6, 1.0, .25), WATER = C(.5, 1.4, 2.4), MPBLUE = C(.4, .8, 2.4);
const BASE = import.meta.env.BASE_URL + 'fx/herbalist/';
const TIGER_W = 280, TIGER_H = 393, TIGER_ASPECT = TIGER_W / TIGER_H;
// วงหนาดปราบผี is new in the prototype and has no game icon: draw one (ward circle with a cross sigil)
function zoneIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  g.fillStyle = '#101a0b'; g.fillRect(0, 0, 48, 48);
  const gr = g.createRadialGradient(24, 24, 2, 24, 24, 22); gr.addColorStop(0, 'rgba(120,200,60,.25)'); gr.addColorStop(1, 'rgba(120,200,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  g.strokeStyle = '#d8e070'; g.lineWidth = 1.6; [13, 9].forEach(r => { g.beginPath(); g.arc(24, 24, r, 0, 7); g.stroke(); });
  g.fillStyle = '#9fe05a'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 - 1.57; g.save(); g.translate(24 + Math.cos(a) * 16, 24 + Math.sin(a) * 16); g.rotate(a + 1.57); g.fillRect(-3, -2, 6, 3); g.fillRect(-2, -5, 4, 3); g.restore(); }
  g.strokeStyle = '#9fe05a'; g.lineWidth = 1; for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * 6.28; g.beginPath(); g.moveTo(24 + Math.cos(a) * 14, 24 + Math.sin(a) * 14); g.lineTo(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22); g.stroke(); }
  g.fillStyle = '#e8f080'; g.fillRect(19, 21, 10, 1.5); g.fillRect(20, 24, 8, 1.5); g.fillRect(21, 27, 6, 1.5);
  return c.toDataURL();
}
export const herbIconUrl = id => (id === 'heal_zone' ? zoneIcon() : BASE + 'icon_' + id + '.png');

// ---- textures ------------------------------------------------------------------
function yantGlyph(g, cx, cy, s, col, lw) { // unalom-style spiral with a tail
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath();
  for (let a = 0; a <= Math.PI * 4.2; a += .08) { const r = s * (.12 + a / (Math.PI * 4.2) * .88); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .95; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.beginPath(); g.moveTo(cx + s * .98, cy + s * .2); g.quadraticCurveTo(cx + s * 1.25, cy - s * .7, cx + s * .55, cy - s * 1.15); g.stroke();
  g.beginPath(); g.arc(cx, cy, s * 1.35, 0, 7); g.lineWidth = lw * .6; g.stroke();
}
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const cover = canvasTex(256, 320, g => {
    g.fillStyle = '#1c1a1d'; g.fillRect(0, 0, 256, 320);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .05})`; g.fillRect(Math.random() * 256, Math.random() * 320, 2, 2); }
    g.strokeStyle = '#b8892e'; g.lineWidth = 4; g.strokeRect(14, 14, 228, 292); g.lineWidth = 1.5; g.strokeRect(22, 22, 212, 276);
    g.fillStyle = '#d9a94a';
    [[14, 14, 1, 1], [242, 14, -1, 1], [14, 306, 1, -1], [242, 306, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 46 * sx, y); g.quadraticCurveTo(x + 22 * sx, y + 10 * sy, x + 14 * sx, y + 22 * sy); g.quadraticCurveTo(x + 10 * sx, y + 30 * sy, x, y + 46 * sy); g.closePath(); g.fill(); });
    yantGlyph(g, 128, 160, 40, '#f2c84b', 9);
  });
  const page = canvasTex(256, 320, g => {
    g.fillStyle = '#efe2bd'; g.fillRect(0, 0, 256, 320); g.strokeStyle = 'rgba(90,60,30,.55)'; g.lineWidth = 2;
    for (let y = 36; y < 300; y += 18) { if (y > 110 && y < 220) continue; g.beginPath(); for (let x = 26; x < 230; x += 6) g.lineTo(x, y + Math.sin(x * .7 + y) * 2.2); g.stroke(); }
    yantGlyph(g, 128, 165, 30, '#2f7a3a', 6);
  });
  const sigil = canvasTex(256, 256, g => { yantGlyph(g, 128, 128, 62, '#ffffff', 7); g.lineWidth = 2; g.strokeStyle = '#fff'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; g.beginPath(); g.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.lineTo(128 + Math.cos(a) * (i % 2 ? 112 : 98), 128 + Math.sin(a) * (i % 2 ? 112 : 98)); g.stroke(); } }, false);
  // ward yant: double ring of script with tiered chedi blocks and radiating zigzag lines
  const ward = canvasTex(1024, 1024, g => {
    const S = 1024, C0 = S / 2; g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const LET = 'กขคฆงจฉชซญฎฏฐฑฒณดตถทธนบปผพภมยรลวศษสหฬอฮ', rl = () => LET[(Math.random() * LET.length) | 0];
    const ringText = (r, n, size, rot = 0) => { g.font = `600 ${size}px "Noto Sans Thai",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rot; g.save(); g.translate(C0 + Math.cos(a) * r, C0 + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(rl(), 0, 0); g.restore(); } };
    g.lineWidth = 6; [300, 236].forEach(r => { g.beginPath(); g.arc(C0, C0, r, 0, 7); g.stroke(); });
    g.lineWidth = 2.5; [288, 248].forEach(r => { g.beginPath(); g.arc(C0, C0, r, 0, 7); g.stroke(); });
    ringText(268, 46, 24); ringText(206, 34, 24, .05); ringText(170, 26, 22, .1);
    g.font = '600 30px "Noto Sans Thai",serif'; [-44, 0, 44].forEach((dy, i) => g.fillText(Array.from({ length: 5 - Math.abs(i - 1) }, rl).join(''), C0, C0 + dy));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(C0 + Math.cos(a) * 306, C0 + Math.sin(a) * 306); g.rotate(a + Math.PI / 2);
      g.lineWidth = 3.5; let y = 0; [[92, 30], [70, 26], [48, 22]].forEach(([w, h], k) => { g.strokeRect(-w / 2, y - h, w, h); g.font = `600 ${h - 8}px "Noto Sans Thai",serif`; g.fillText(Array.from({ length: 3 - (k === 2 ? 1 : 0) }, rl).join(''), 0, y - h / 2 + 1); y -= h; });
      g.beginPath(); g.arc(0, y - 14, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(0, y - 14, 4, 0, 7); g.fill(); g.beginPath(); g.moveTo(0, y - 26); g.lineTo(0, y - 44); g.stroke(); g.restore();
      const b = a + Math.PI / 10; g.save(); g.translate(C0, C0); g.rotate(b); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(312, 0); g.lineTo(420, 0); for (let z = 0; z < 5; z++) g.lineTo(420 + z * 9 + 4.5, z % 2 ? -6 : 6); g.lineTo(470, 0); g.stroke(); g.restore();
    }
    ringText(470, 30, 26, .1);
  }, false);
  // the yant tiger (สักยันต์เสือ, yant_tiger.png): black ink on white becomes a white mask, so the
  // additive sprite glows in its own colour; the frame's edge lines are cropped off
  const tiger = canvasTex(TIGER_W, TIGER_H, () => {}, false), img = new Image();
  img.onload = () => { const g = tiger.image.getContext('2d', { willReadFrequently: true }), m = 8;
    g.drawImage(img, m, m, img.width - m * 2, img.height - m * 2, 0, 0, TIGER_W, TIGER_H);
    const d = g.getImageData(0, 0, TIGER_W, TIGER_H), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const ink = 1 - (p[i] + p[i + 1] + p[i + 2]) / 765; p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = Math.min(255, Math.max(0, (ink - .25) * 340)); }
    g.putImageData(d, 0, 0); tiger.needsUpdate = true; };
  img.src = BASE + 'yant_tiger.png';
  TEX = { cover, page, sigil, ward, tiger }; return TEX;
}

// ---- the grimoire ----------------------------------------------------------------------
function makeBook(fx) {
  const T = textures(), W = .3, H = .4, root = new THREE.Group(), book = new THREE.Group(); root.add(book); fx.add(root);
  const leather = new THREE.MeshStandardMaterial({ color: 0x1f3a2c, roughness: .55, metalness: .1 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a23f, roughness: .3, metalness: .85, emissive: 0x3a2400 });
  const coverM = new THREE.MeshStandardMaterial({ map: T.cover, emissiveMap: T.cover, emissive: 0xffffff, emissiveIntensity: .55, roughness: .5, metalness: .15 });
  const pageM = new THREE.MeshBasicMaterial({ map: T.page, color: C(.8, .78, .7) });
  const edgeM = new THREE.MeshStandardMaterial({ color: 0xe0c27a, roughness: .7, metalness: .3 });
  const halves = [-1, 1].map(side => {
    const h = new THREE.Group(); h.position.x = side * .045; book.add(h);
    const cov = new THREE.Mesh(new THREE.BoxGeometry(W, H, .018), [leather, leather, leather, leather, leather, side < 0 ? coverM : leather]); cov.position.set(side * W / 2, 0, -.009); h.add(cov);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(W - .02, H - .025, .035), [edgeM, edgeM, edgeM, edgeM, pageM, edgeM]); pages.position.set(side * (W / 2 - .005), 0, .018); h.add(pages);
    [-1, 1].forEach(v => { const cap = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .024), goldM); cap.position.set(side * (W - .02), v * (H / 2 - .02), -.009); h.add(cap); });
    return { h, side };
  });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.11, H, .02), leather); spine.position.z = -.012; book.add(spine);
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.sigil, color: C(1.1, .85, .3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
  sigil.position.z = .2; book.add(sigil);
  root.traverse(o => { if (o.isMesh && o !== sigil) o.castShadow = true; });
  // the closed tome: Tripo model, cover turned outward (away from the caster), ~0.48 tall
  const closed = new THREE.Group(); closed.rotation.y = Math.PI; root.add(closed);
  gltfLoader().loadAsync(`${import.meta.env.BASE_URL}models/herbalist-book.glb`).then(g => {
    const m = g.scene, box = new THREE.Box3().setFromObject(m), sz = box.getSize(new THREE.Vector3()), k = .48 / sz.y;
    m.scale.setScalar(k); m.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-k));
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material.emissive) { o.material.emissive.set(0x2a2208); } } });
    closed.add(m);
  }).catch(() => {}); // without the model the procedural book is used throughout
  root.scale.setScalar(.01); root.visible = false;
  return { root, book, closed, halves, sigil, pageM, open: 0, show: 0, wasOpen: false };
}

// ---- runner ----------------------------------------------------------------------------
export function createHerbalistSkills({ fx, character, player, dummy, groundHeight, labels, damage }) {
  const MOVES = Object.fromEntries(HERBALIST_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 14 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 700 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy, tpos = () => tg.pos.clone().add(tg.off);
  const dirTo = () => tpos().sub(hero.pos()).setY(0).normalize();
  const face = p => { const d = p.clone().sub(hero.pos()); R.facing = Math.atan2(d.x, d.z); };
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback, m.speed); return m; };
  const at = (id, fn) => fx.after(MOVES[id].hits[0], fn);
  const heal = (amt, cls = 'heal', glow = true) => { const v = Math.round(amt); hero.hp = Math.min(hero.maxHp, hero.hp + v); fx.popup(headP(hero), '+' + v, cls); if (glow) character.tint?.(C(.3, .9, .3), .2, .5); };
  const hurt = (amt, crit, push = .2) => {
    // Rules damage (src/training/damage.js via the training ground) for the skill being cast;
    // the effect's own number when there is no rules entry (or in the entry-screen preview).
    const r = damage?.(R.current);
    if (!r || !r.dmg) return tg.hurt(amt, crit, push, hero.pos());
    if (!r.hit) return tg.miss();
    return tg.hurt(r.dmg, r.crit, push, hero.pos(), true);
  };
  const near = (P, r) => tg.alive && tpos().distanceTo(P) <= r;
  const lw = new THREE.Vector3(), boneLocal = name => { const b = character.bone?.(name); return b ? fx.toLocal(b.getWorldPosition(lw)) : null; };
  // where spells leave from: the open grimoire while it is out, else the left hand / chest
  const castPoint = () => (BOOK?.root.visible ? BOOK.root.position.clone().add(V(0, .1, 0)) : null) ?? boneLocal('LeftHand')?.add(dirTo().multiplyScalar(.15)).add(V(0, .12, 0)) ?? chest(hero).add(dirTo().multiplyScalar(.45)).add(V(0, .15, 0));

  // ---- grimoire: appears beside the herbalist and orbits at shoulder height for the whole cast;
  // on release it glides to the front-left, opens toward the caster, then closes and orbits on.
  // ORBIT_R keeps the whole book clear of the body: in every herbalist clip the mesh reaches at
  // most ~0.74 from the axis at orbit height, the book's nearest edge (tilted open page / sigil)
  // stays ≥ 0.8 from it.
  const ORBIT_R = 1.05, ORBIT_Y = 1.3, ORBIT_W = 2.2, FRONT = .55;
  const BOOK = makeBook(fx); let bookOn = false, bookUntil = 0, bookOpenAt = 0, bookCloseAt = 0, bookAng = 0;
  const bookPos = () => hero.pos().add(V(Math.sin(bookAng) * ORBIT_R, ORBIT_Y + Math.sin(R.time * 2.1) * .05, Math.cos(bookAng) * ORBIT_R));
  const showBook = (dur, openAt) => {
    const f = dirTo();
    if (!bookOn || BOOK.show < .1) bookAng = Math.atan2(f.x, f.z) + Math.PI * .75; // appear behind the left shoulder
    bookOn = true; bookUntil = R.time + dur + .35; bookOpenAt = R.time + openAt - .3; bookCloseAt = R.time + Math.max(openAt + .55, dur - .2);
    BOOK.root.visible = true;
    fx.burst(bookPos(), 16, { c: [GOLD, C(.8, 1.6, .5)], size: .1, sp: 1.6, life: .7, shape: SH.leaf, drag: 2, vr: 4 });
  };
  function stepBook(dt) {
    const B = BOOK, on = bookOn && R.time < bookUntil;
    B.show += ((on ? 1 : 0) - B.show) * Math.min(1, dt * 10);
    if (B.show < .02 && !on) { B.root.visible = false; bookOn = false; return; }
    const opening = on && R.time > bookOpenAt && R.time < bookCloseAt;
    B.open += ((opening ? 1 : 0) - B.open) * Math.min(1, dt * 12);
    const fwd = dirTo(), hp = hero.pos();
    if (opening) { // glide along the orbit to the front-left and hold there while the spell is read
      const goal = Math.atan2(fwd.x, fwd.z) + FRONT;
      const d = THREE.MathUtils.euclideanModulo(goal - bookAng + Math.PI, Math.PI * 2) - Math.PI;
      bookAng += d * Math.min(1, dt * 9);
    } else bookAng += ORBIT_W * dt * (1 - .6 * B.open);
    const pos = bookPos();
    B.root.position.copy(pos); B.root.scale.setScalar(Math.max(.01, B.show) * 1.25);
    // pages face the caster (tilted up toward the face) with a little flutter
    const look = fx.toWorld(V(hp.x, pos.y + .75, hp.z));
    B.root.lookAt(look); B.root.rotateZ(Math.sin(R.time * 3.3) * .08 * (1 - B.open));
    const o = B.open, c = 1 - o, hasTome = B.closed.children.length > 0;
    // swap closed tome ⇄ open spell-book with a gold puff at the switch
    B.closed.scale.setScalar(Math.max(.001, c)); B.closed.visible = c > .02;
    B.book.scale.setScalar(hasTome ? Math.max(.001, o) : 1); B.book.visible = !hasTome || o > .02;
    if (opening !== B.wasOpen) { B.wasOpen = opening; fx.burst(pos.clone(), opening ? 22 : 10, { c: [GOLD, HERB_HOT], size: .09, sp: opening ? 2.2 : 1.2, life: .6, shape: SH.star, drag: 2.5 }); }
    B.halves.forEach(({ h, side: sd }) => h.rotation.y = -sd * (c * Math.PI / 2 * .98 + .12));
    B.sigil.material.opacity = o * .9; B.sigil.rotation.z = R.time * 1.2; B.sigil.scale.setScalar(.55 + o * .25 + Math.sin(R.time * 8) * .02);
    B.pageM.color.setRGB(.72 + o * .18, .7 + o * .22, .62 + o * .06);
    if (Math.random() < dt * (3 + o * 30)) fx.emit({ p: pos.clone().add(V(rand(-.2, .2), rand(-.15, .2), rand(-.1, .2))), v: V(rand(-.2, .2), rand(.3, .9), rand(-.2, .2)), c: o > .3 ? (Math.random() < .5 ? GOLD : HERB_HOT) : GOLD_SOFT, life: rand(.5, 1), size: rand(.04, .08), shape: Math.random() < .3 ? SH.star : SH.glow });
  }
  const cast = id => { const m = MOVES[id]; face(tpos()); anim(id); showBook(m.duration, m.hits[0]); return m; };

  const SK = {
    // 1 · สายใยสมุนไพร: twin twisting vines from the book to the target, life pulses flow back to the herbalist
    heal_vine() {
      fx.cinematic(.45, 1.6); cast('heal_vine');
      at('heal_vine', () => {
        const dur = 6, m1 = fx.add(new THREE.Mesh(new THREE.BufferGeometry(), fx.tubeMat(C(.1, .4, .14), C(.7, 1.7, .6), 9))), m2 = fx.add(new THREE.Mesh(new THREE.BufferGeometry(), fx.tubeMat(C(.08, .3, .1), C(1.1, 1.5, .5), 7, 13)));
        const orbs = [0, 1, 2].map(() => fx.glowSprite(C(.9, 1.7, .9), .38));
        const ringD = fx.decal(4, 0, 0, 1.0, C(.25, .8, .3), C(.6, .45, .2), { auto: false });
        let leafAcc = 0, nextTick = .5;
        fx.impact(chest(tg), .7, HERB_HOT);
        fx.addTask((dt, t) => {
          const grow = clamp01(t / .35), fade = t > dur - .4 ? clamp01((dur - t) / .4) : 1;
          const a = castPoint(), b = chest(tg), dir = b.clone().sub(a), side = V(-dir.z, 0, dir.x).normalize();
          const p1 = [], p2 = [], mid = [];
          for (let i = 0; i <= 26; i++) { const u = i / 26 * Math.max(.02, grow); const p = fx.arcPoint(a, b, .9, u); p.addScaledVector(side, Math.sin(u * 7 + t * 2.2) * .08);
            mid.push(p.clone()); const w = Math.sin(u * Math.PI) * .13 + .03, ph = u * 16 - t * 5;
            p1.push(p.clone().addScaledVector(side, Math.cos(ph) * w).add(V(0, Math.sin(ph) * w, 0))); p2.push(p.clone().addScaledVector(side, -Math.cos(ph) * w).add(V(0, -Math.sin(ph) * w, 0))); }
          const curve = new THREE.CatmullRomCurve3(mid);
          m1.geometry.dispose(); m1.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p1), 60, .045, 6);
          m2.geometry.dispose(); m2.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p2), 60, .03, 5);
          [m1, m2].forEach(m => { m.material.uniforms.uTime.value = t; m.material.uniforms.uA.value = fade * fx.gain * 1.2; });
          // pulses run from the target back to the book (life drawn in)
          orbs.forEach((o, i) => { const u = 1 - ((t * .7 + i / 3) % 1) * grow; o.position.copy(curve.getPoint(u)); o.material.opacity = fade * Math.sin(u * Math.PI); });
          const tp = tpos(); ringD.m.position.set(tp.x, .05, tp.z); ringD.u.uAlpha.value = grow * fade * .8 * fx.gain;
          leafAcc += dt * 22 * grow * fade;
          while (leafAcc > 1) { leafAcc--; fx.emit({ p: curve.getPoint(Math.random()), v: V(rand(-.3, .3), rand(-.4, .1), rand(-.3, .3)), c: Math.random() < .7 ? LEAF : C(.9, 1.6, .4), life: rand(.7, 1.4), size: rand(.12, .22), shape: SH.leaf, vr: rand(-3, 3), grav: .6, drag: 1.5 }); }
          if (t >= nextTick && grow >= 1 && fade > .5) { nextTick += .5; if (tg.alive) hurt(40, false, .05); heal(hero.maxHp * .03, 'heal', false);
            fx.burst(chest(hero), 6, { c: HERB_HOT, size: .14, sp: 1.6, life: .5, shape: SH.star }); fx.shock(tp.x, tp.z, .9, HERB, HERB, .4); }
          if (t >= dur) { fx.kill(m1); fx.kill(m2); orbs.forEach(fx.kill); ringD.auto = true; ringD.t = ringD.life * .8; return false; }
        });
      });
      return 1.6;
    },
    // 2 · ขวดยาเด้งห้าทิศ: an amber bottle tumbles herbalist → ghost → herbalist …, shattering on the last hit
    heal_pill() {
      fx.cinematic(.4, 1.6); cast('heal_pill');
      at('heal_pill', () => {
        const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); inner.position.y = -.24; fx.add(g);
        const pts = [[0, 0], [.13, 0], [.165, .04], [.175, .2], [.13, .3], [.065, .34], [.058, .43], [.075, .45], [.07, .47]].map(([x, y]) => new THREE.Vector2(x, y));
        const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.14, .125, .2, 16), new THREE.MeshBasicMaterial({ color: C(.55, 1.5, .45) })); liquid.position.y = .11;
        inner.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 18), new THREE.MeshStandardMaterial({ color: 0xc98a3a, transparent: true, opacity: .55, roughness: .08, metalness: .2, emissive: 0x3a1c04, side: THREE.DoubleSide, depthWrite: false })), liquid);
        const cork = new THREE.Mesh(new THREE.CylinderGeometry(.055, .048, .08, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: .9 })); cork.position.y = .5; inner.add(cork);
        const cord = new THREE.Mesh(new THREE.TorusGeometry(.064, .012, 6, 18), new THREE.MeshStandardMaterial({ color: 0xb02a22 })); cord.rotation.x = Math.PI / 2; cord.position.y = .42; inner.add(cord);
        g.scale.setScalar(1.7); const halo = fx.glowSprite(C(.35, 1.0, .35), 1.1); halo.material.opacity = .55;
        const seq = [tg, hero, tg, hero, tg]; let from = boneLocal('RightHand') ?? chest(hero), hop = 0, ht = 0;
        fx.addTask(dt => {
          const target = seq[hop], to = chest(target); ht += dt; const u = Math.min(1, ht / .38);
          const p = fx.arcPoint(from, to, 1.5, u); g.position.copy(p); halo.position.copy(p); g.rotation.z -= dt * 15; g.rotation.y += dt * 4;
          if (Math.random() < .7) fx.emit({ p: p.clone().add(V(rand(-.08, .08), .1, rand(-.08, .08))), v: V(rand(-.3, .3), rand(0, .6), rand(-.3, .3)), c: C(.55, 1.5, .45), life: .5, size: .07, grav: 6 });
          fx.emit({ p: p.clone(), c: C(.4, 1.1, .4), life: .3, size: .22, size1: .02, a: .5 });
          if (u < 1) return;
          const last = hop === seq.length - 1;
          liquid.scale.y = Math.max(.15, 1 - (hop + 1) * .18); liquid.position.y = .11 - (1 - liquid.scale.y) * .1;
          fx.burst(to, last ? 46 : 22, { c: target === tg ? [C(.5, 1.2, .2), C(.8, 1.5, .3)] : [C(.5, 1.6, .5), C(1.1, 2, 1)], size: .11, sp: last ? 3.6 : 2.6, upMin: .5, upK: 1.3, life: .8, grav: 7, drag: .5 });
          if (target === tg) { if (tg.alive) hurt(last ? 190 : 140, last); fx.impact(to, last ? 1.3 : .8, C(.8, 1.6, .3)); const tp = tpos(); fx.decal(5, tp.x, tp.z, 1.1, C(.35, .8, .15), null, { life: 1.8, grow: .25 }); if (hop === 0) fx.popup(headP(tg).add(V(0, .4, 0)), 'พิษสมุนไพร', 'st'); }
          else { heal(hero.maxHp * .12); const hp = hero.pos(); fx.shock(hp.x, hp.z, 1.2, HERB_HOT, HERB); fx.burst(to, 12, { c: LEAF, size: .2, sp: 2.2, life: .9, shape: SH.leaf, grav: 1.5, upMin: .5 }); }
          if (last) { fx.burst(to, 34, { c: [C(1.6, 1.0, .45), C(1.2, 1.3, 1.1)], size: .09, sp: 4, upMin: .4, upK: 1.4, life: 1.1, grav: 9, drag: .3, shape: SH.star }); const tp = tpos(); fx.shock(tp.x, tp.z, 2.2, C(1.6, 1.1, .45), HERB, .55); fx.popup(tpos().setY(2.9), 'เพล้ง!', 'st'); fx.kill(g); fx.kill(halo); return false; }
          from = to; hop++; ht = 0;
        });
      });
      return 1.0;
    },
    // 3 · วงหนาดปราบผี: a ward of script lands on the target for 6 s; ticks while it stands inside
    heal_zone() {
      fx.cinematic(.7, 2.6); cast('heal_zone');
      at('heal_zone', () => {
        const P = tpos().setY(0), Rz = 3, LIFE = 6, TICK = .4;
        const ward = fx.yantPlane(textures().ward); ward.rotation.x = -Math.PI / 2; ward.position.set(P.x, .07, P.z); ward.scale.setScalar(Rz * 2.08); ward.renderOrder = 6;
        const wu = ward.material.uniforms;
        const dome = fx.add(new THREE.Mesh(new THREE.SphereGeometry(Rz, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), fx.fresnelMat(C(.6, 1.3, .3)))); dome.position.copy(P); dome.scale.set(.01, .01, .01);
        const ringD = fx.decal(4, P.x, P.z, Rz, C(.9, 1.2, .35), C(.4, .8, .2), { auto: false });
        fx.impact(P.clone().setY(.4), 1.2, C(1.1, 1.4, .4)); fx.shock(P.x, P.z, Rz, C(1.1, 1.3, .4), C(.5, .9, .2), .6);
        const lbl = document.createElement('div'); lbl.className = 'fx-pop st big fx-combo'; labels.appendChild(lbl);
        let combo = 0, nextTick = .35, leafAcc = 0, slowed = false, pulse = 0;
        fx.addTask((dt, t) => {
          const grow = easeOutBack(clamp01(t / .45)), fade = t > LIFE - .4 ? clamp01((LIFE - t) / .4) : 1;
          dome.scale.set(Math.max(.01, grow), .26 * Math.max(.01, grow) * (1 + Math.sin(t * 3) * .04), Math.max(.01, grow));
          dome.material.uniforms.uTime.value = t; dome.material.uniforms.uA.value = .5 * clamp01(t * 3) * fade;
          pulse = Math.max(0, pulse - dt * 3);
          wu.uT.value = t; wu.uReveal.value = Math.min(1.15, (t - .1) / .7 * 1.15); wu.uA.value = fade * 1.4; wu.uPulse.value = pulse; ward.rotation.z = t * .12;
          ringD.u.uAlpha.value = fade * fx.gain;
          leafAcc += dt * 26 * fade;
          while (leafAcc > 1) { leafAcc--; const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * Rz * .95;
            fx.emit({ p: V(P.x + Math.cos(a) * r, .1, P.z + Math.sin(a) * r), v: V(-Math.sin(a) * 1.2, rand(.6, 1.4), Math.cos(a) * 1.2), c: Math.random() < .5 ? C(.5, .95, .3) : C(1, 1.1, .4), life: rand(.8, 1.4), size: Math.random() < .5 ? rand(.12, .18) : rand(.05, .08), shape: Math.random() < .5 ? SH.leaf : SH.glow, vr: rand(-5, 5), drag: .8 }); }
          if (t >= nextTick && t < LIFE - .3) { nextTick += TICK;
            if (near(P, Rz)) { pulse = 1; combo++; hurt(62, false, .05); lbl.textContent = combo + ' ฮิตต่อเนื่อง';
              fx.burst(chest(tg).add(V(0, rand(-.3, .4), 0)), 5, { c: [C(1.1, 1.4, .4), C(.6, 1.3, .3)], size: .12, sp: 2.4, life: .35, shape: SH.star, drag: 4 });
              if (!slowed) { slowed = true; fx.popup(headP(tg).add(V(0, .4, 0)), 'ช้าลง 30%', 'st'); } } }
          const s = fx.toScreen(V(P.x, 3.1, P.z)); lbl.style.left = s.x + 'px'; lbl.style.top = s.y + 'px'; lbl.style.opacity = combo ? fade : 0;
          if (t >= LIFE) { fx.kill(ward); fx.kill(dome); ringD.auto = true; ringD.t = 99; setTimeout(() => lbl.remove(), 300); fx.shock(P.x, P.z, Rz, C(.9, 1.3, .4), HERB, .5);
            let got = false; for (let k = 0; k < 12; k++) fx.emit({ p: P.clone().add(V(rand(-1, 1), rand(.4, 1.2), rand(-1, 1))), v: V(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), c: HERB_HOT, life: 3, size: .12, home: chest(hero), homeK: 4, swirl: 2, onArrive: () => { if (!got) { got = true; heal(hero.maxHp * .05); } } });
            return false; }
        });
      });
      return 2.4;
    },
    // 4 · ยาต้มพยัคฆ์เหิน: a bronze cauldron boils, a tiger spirit leaps from the steam, a fire ring buffs
    heal_tiger() {
      fx.cinematic(.7, 3); cast('heal_tiger');
      const fwd = dirTo(), cpos = hero.pos().addScaledVector(fwd, .75).add(V(0, .15, 0));
      const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(.08 + Math.sin(u * Math.PI * .92) * .55 + u * .06, u * .7)); }
      const caul = new THREE.Group(); fx.add(caul); caul.position.copy(cpos);
      const bronze = new THREE.MeshStandardMaterial({ color: 0x5b3d22, metalness: .7, roughness: .38, side: THREE.DoubleSide });
      const brew = new THREE.Mesh(new THREE.CircleGeometry(.5, 28), new THREE.MeshBasicMaterial({ color: C(1.5, .62, .16) })); brew.rotation.x = -Math.PI / 2; brew.position.y = .62;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.58, .045, 8, 32), bronze); rim.rotation.x = Math.PI / 2; rim.position.y = .7;
      caul.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 28), bronze), brew, rim);
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .3, 6), bronze); const a = i / 3 * 6.28; l.position.set(Math.cos(a) * .32, -.1, Math.sin(a) * .32); caul.add(l); }
      caul.traverse(o => { if (o.isMesh) o.castShadow = true; }); caul.scale.setScalar(.01);
      fx.addTask((dt, t) => {
        caul.scale.setScalar(t < .3 ? .01 + easeOutBack(t / .3) * .8 : t > 2.6 ? Math.max(.01, .8 * (1 - (t - 2.6) / .3)) : .8);
        if (t < 2.6) {
          fx.emit({ p: cpos.clone().add(V(rand(-.3, .3), -.05, rand(-.3, .3))), v: V(rand(-.2, .2), rand(1, 2), rand(-.2, .2)), c: Math.random() < .5 ? EMBER : C(2.4, 1.6, .4), life: rand(.3, .6), size: rand(.15, .3), size1: .02 });
          if (Math.random() < .7) fx.emit({ p: cpos.clone().add(V(rand(-.3, .3), .6, rand(-.3, .3))), v: V(rand(-.25, .25), rand(.8, 1.4), rand(-.25, .25)), c: C(.6, .45, .35), life: rand(1.2, 2), size: rand(.4, .6), size1: rand(1.2, 1.8), a: .35, shape: SH.soft, drag: .6 }, fx.PN);
        }
        if (t > 2.9) { fx.kill(caul); return false; }
      });
      at('heal_tiger', () => {
        const sp = fx.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().tiger, color: C(2.2, 1.3, .6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
        fx.flash(cpos, 0xff8a2a, 60, .8); fx.shake = .18; fx.punch(.5); fx.popup(cpos.clone().setY(3.2), 'ฮึ่ม!', 'st big');
        fx.addTask((dt, t) => { const u = clamp01(t / 1.1); sp.position.set(cpos.x + fwd.x * u * 1.6, 1.2 + Math.sin(u * Math.PI) * 1.4 + u * .4, cpos.z + fwd.z * u * 1.6); const s = 1.4 + u * 2.8; sp.scale.set(s * TIGER_ASPECT, s, 1);
          sp.material.opacity = Math.sin(u * Math.PI) * .95; if (Math.random() < .6) fx.emit({ p: sp.position.clone().add(V(rand(-.6, .6), rand(-.5, .5), 0)), v: V(0, rand(.2, .8), 0), c: EMBER, life: .6, size: .12 }); if (u >= 1) { fx.kill(sp); return false; } });
        const hp = hero.pos(), Rt = 3.5; fx.decal(3, hp.x, hp.z, Rt, EMBER, C(1.4, .3, .05), { life: 1.6, grow: .5 }); fx.shock(hp.x, hp.z, Rt, C(2.6, 1.4, .4), EMBER, .7); fx.lightPillar(hp, C(2, .8, .2), 5, .7, 1);
        fx.after(.15, () => { fx.popup(headP(hero).add(V(0, .4, 0)), 'ป้องกัน +20% · เร็ว +25%', 'st'); character.tint?.(C(1, .6, .2), .4, 1.5);
          fx.addTask((dt, t) => { const p = hero.pos(); for (let k = 0; k < 2; k++) { const an = t * 7 + k * Math.PI, h = (t * 1.6 + k * .5) % 1.9; fx.emit({ p: p.clone().add(V(Math.cos(an + h * 3) * .45, h, Math.sin(an + h * 3) * .45)), v: V(0, .3, 0), c: k ? EMBER : C(2.5, 1.7, .5), life: .5, size: .1, size1: .02 }); } if (t > 4) return false; }); });
      });
      return 2.4;
    },
    // 5 · พิธีสู่ขวัญ: lotus mandala, a bai sri rises, the sacred cord loops round, then a pillar of light
    heal_khwan() {
      fx.cinematic(.85, 3.4); cast('heal_khwan');
      const center = hero.pos(), Rk = 3.2, total = 3.6, md = fx.decal(2, center.x, center.z, Rk, C(1.15, .8, .28), C(1.05, .95, .7), { auto: false, alpha: .85 });
      const bs = new THREE.Group(); fx.add(bs);
      const leafM = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: .6, emissive: 0x16340f, side: THREE.DoubleSide }), goldM = new THREE.MeshBasicMaterial({ color: C(1.1, .82, .32) });
      let y = .15; [[.62, .38], [.5, .34], [.38, .3], [.27, .27], [.17, .24]].forEach(([r, h]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16, 1, true), leafM); c.position.y = y + h / 2; bs.add(c);
        const t2 = new THREE.Mesh(new THREE.TorusGeometry(r * .97, .018, 6, 32), goldM); t2.rotation.x = Math.PI / 2; t2.position.y = y + .02; bs.add(t2); y += h * .72; });
      const baseM = new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, .2, 20), new THREE.MeshStandardMaterial({ color: 0x9a7b3a, metalness: .6, roughness: .4 })); baseM.position.y = .05; bs.add(baseM);
      const fwd = dirTo(); bs.position.copy(center).addScaledVector(fwd, 1.3); bs.position.y = -1.5; bs.scale.setScalar(.9);
      const ringPts = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return V(center.x + Math.cos(a) * 1.1, .9, center.z + Math.sin(a) * 1.1); });
      const cord = fx.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 120, .022, 6, true), fx.tubeMat(C(1.1, 1.1, 1), C(1.8, 1.6, 1), 6, 40)));
      const idx = cord.geometry.index.count; cord.geometry.setDrawRange(0, 0);
      let halo = null;
      fx.addTask((dt, t) => {
        md.m.scale.setScalar(Rk * easeOutBack(clamp01(t / .7))); md.u.uAlpha.value = .85 * fx.gain * clamp01(t * 3) * (t > total - .6 ? clamp01((total - t) / .6) : 1);
        bs.position.y = -1.5 + 1.5 * (1 - Math.pow(1 - clamp01(t / .9), 3)) - (t > total - .5 ? (t - total + .5) * 3 : 0); bs.rotation.y += dt * .5;
        cord.geometry.setDrawRange(0, Math.floor(idx * clamp01((t - .2) / .9) / 3) * 3); cord.material.uniforms.uTime.value = t; cord.material.uniforms.uA.value = (t > total - .6 ? clamp01((total - t) / .6) : 1) * fx.gain;
        if (t < 1.1) for (let k = 0; k < 2; k++) { const an = rand(0, 6.28), r = rand(Rk * .8, Rk * 1.1); fx.emit({ p: V(center.x + Math.cos(an) * r, rand(.3, 2.2), center.z + Math.sin(an) * r), c: Math.random() < .5 ? C(2.4, 1.3, .3) : C(2.2, 2.2, 1.9), life: 1.3, size: .2, shape: SH.petal, home: V(center.x, 1.4, center.z), homeK: 2.2, swirl: 2.5, vr: 4 }); }
        if (halo) { const hp = hero.pos(); halo.position.set(hp.x, hero.barY - .05 + Math.sin(t * 3) * .04, hp.z); halo.rotation.z += dt * 2; halo.material.opacity = t > total - .6 ? clamp01((total - t) / .6) : 1; }
        if (t >= total) { fx.kill(cord); fx.kill(bs); if (halo) fx.kill(halo); md.auto = true; md.t = md.life; return false; }
      });
      at('heal_khwan', () => {
        fx.shake = .22; fx.punch(.7); fx.hitstop(.08); fx.flash(center, 0xffd27a, 70, 1); fx.shock(center.x, center.z, Rk * 1.1, GOLD_SOFT, C(1.3, 1.2, 1), .8);
        fx.burst(V(center.x, 2.2, center.z), 40, { c: [GOLD, WHITE], size: .14, sp: 4, upMin: -.2, life: 1.2, shape: SH.star, drag: 2.5 });
        fx.lightPillar(center, C(1.6, 1.3, .7), 7, .8, 1.4); heal(hero.maxHp * .4, 'heal big');
        halo = fx.add(new THREE.Mesh(new THREE.TorusGeometry(.3, .025, 6, 40), new THREE.MeshBasicMaterial({ color: C(2.4, 1.9, .8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); halo.rotation.x = Math.PI / 2 - .25;
        fx.popup(headP(hero).add(V(0, .5, 0)), 'ขวัญกันตาย', 'st');
        fx.addTask((dt, t) => { for (let k = 0; k < 4; k++) fx.emit({ p: V(center.x + rand(-Rk, Rk) * .8, rand(4, 5.5), center.z + rand(-Rk, Rk) * .7), v: V(rand(-.2, .2), -rand(.6, 1.1), rand(-.2, .2)), c: Math.random() < .5 ? C(1, .62, .2) : C(1, .95, .85), life: 2.6, size: .17, shape: SH.petal, vr: rand(-3, 3), a: .95 }, fx.PN); if (t > 2) return false; });
      });
      return 2.2;
    },
    // 6 · ครกยาระเบิดสมุนไพร: a stone mortar drops on the target; the pestle pounds 3 times; healing powder spirals home
    heal_mortar() {
      fx.cinematic(.8, 2.6); cast('heal_mortar');
      const P = tpos().setY(0), Rm = 2.2, marker = fx.decal(1, P.x, P.z, Rm, C(1.1, 1.6, .5), null, { life: 2.6, grow: .3 });
      const m = new THREE.Group(); fx.add(m); const stone = new THREE.MeshStandardMaterial({ color: 0x7a746a, roughness: .9, flatShading: true });
      const pts = [[.0, 0], [.55, 0], [.62, .1], [.66, .35], [.6, .55], [.45, .58], [.4, .3], [.0, .3]].map(([x, y]) => new THREE.Vector2(x, y));
      m.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 14), stone));
      const herbTop = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ color: C(.32, 1.0, .26) })); herbTop.rotation.x = -Math.PI / 2; herbTop.position.y = .45; m.add(herbTop);
      const pestle = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: .8 })); sh.position.y = .6; pestle.add(sh, new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), stone)); pestle.position.y = 1.3; m.add(pestle);
      m.traverse(o => { if (o.isMesh) o.castShadow = true; }); m.position.set(P.x + dirTo().x * -.9, 9, P.z + dirTo().z * -.9); m.scale.setScalar(1.1);
      const hits = MOVES.heal_mortar.hits;
      fx.addTask((dt, t) => {
        const fall = clamp01((t - .1) / .35); m.position.y = t < .45 ? 9 - 9 * fall * fall : t > 2.3 ? -(t - 2.3) * 1.5 : 0;
        // pestle rides the beats of the pound clip
        const next = hits.find(h => h > t - .05) ?? 9, prev = [...hits].reverse().find(h => h <= t) ?? .2, ph = clamp01((t - prev) / Math.max(.1, next - prev));
        pestle.position.y = t > .45 && t < 1.75 ? .45 + Math.sin(ph * Math.PI) * .9 : 1.3;
        if (t > 2.6) { fx.kill(m); return false; }
      });
      hits.forEach((h, i) => fx.after(h, () => {
        const mp = m.position; fx.impact(V(mp.x, .5, mp.z), 1 + i * .3, i === 2 ? C(1.3, 2.2, .6) : C(2.2, 1.6, .7)); fx.shock(mp.x, mp.z, Rm, C(1.8, 1.5, .7), C(.9, 1.8, .5), .5); if (i === 2) fx.shock(mp.x, mp.z, Rm * 1.4, HERB_HOT, HERB, .7);
        fx.burst(V(mp.x, .2, mp.z), 30, { c: [DUST, C(.55, .48, .3), C(.38, .5, .25)], S: fx.PN, size: .55, size1: 1.3, sp: 3.5, upMin: .1, upMax: .5, life: 1.2, shape: SH.soft, a: .75, drag: 2.5 });
        if (near(P, Rm + .5)) { hurt(230 + i * 40, i === 2, .2); if (i === 0) { fx.popup(headP(tg).add(V(0, .4, 0)), 'มึน · ช้า 30%', 'st'); fx.stunStars(tg, 1.6); } }
        if (i === 2) fx.after(.35, () => { let got = false; for (let k = 0; k < 26; k++) fx.emit({ p: V(mp.x, .7, mp.z).add(V(rand(-.4, .4), rand(0, .5), rand(-.4, .4))), v: V(rand(-2, 2), rand(1, 3), rand(-2, 2)), c: Math.random() < .7 ? HERB_HOT : GOLD, life: 3, size: .13, home: chest(hero), homeK: 4, swirl: 3,
          onArrive: () => { if (!got) { got = true; heal(hero.maxHp * .14); fx.burst(chest(hero), 10, { c: HERB_HOT, size: .14, sp: 2, life: .5, shape: SH.star }); } } }); });
      }));
      return 2.2;
    },
    // 7 · หมอกยาชโลมใจ: soft teal fog rolls out, a shimmer shell wraps the herbalist, blue MP motes rise
    heal_mist() {
      fx.cinematic(.55, 2.6); cast('heal_mist');
      at('heal_mist', () => {
        const c0 = hero.pos(), Rm = 4; fx.decal(5, c0.x, c0.z, Rm, C(.35, 1.1, 1.0), null, { life: 3.2, grow: .8 }); fx.shock(c0.x, c0.z, Rm, C(.5, 1.3, 1.3), C(.2, .6, .7), .9);
        fx.addTask((dt, t) => { if (t < 2.2) for (let k = 0; k < 3; k++) { const an = rand(0, 6.28), sp = rand(1, 2.4);
          fx.emit({ p: c0.clone().add(V(Math.cos(an) * .4, rand(.2, 1.2), Math.sin(an) * .4)), v: V(Math.cos(an) * sp, rand(-.05, .15), Math.sin(an) * sp), c: Math.random() < .6 ? C(.42, .7, .66) : C(.5, .62, .75), life: rand(1.8, 2.6), size: rand(.8, 1.2), size1: rand(2.2, 3.2), a: .22, shape: SH.soft, drag: .8 }, fx.PN); }
          if (t > 3) return false; });
        fx.after(.4, () => { heal(hero.maxHp * .15); fx.after(.2, () => fx.popup(headP(hero).add(V(0, .3, 0)), '+MP 10%', 'mp'));
          const sh = fx.add(new THREE.Mesh(new THREE.SphereGeometry(.85, 28, 18), fx.fresnelMat(C(.5, 1.4, 1.6)))); sh.scale.y = 1.35;
          fx.addTask((dt, t) => { const hp = hero.pos(); sh.material.uniforms.uTime.value = t; sh.material.uniforms.uA.value = clamp01(t * 4) * clamp01((2.4 - t) / .5); sh.position.copy(hp).setY(.95);
            if (Math.random() < dt * 14) fx.emit({ p: hp.clone().add(V(rand(-.5, .5), rand(.1, .6), rand(-.5, .5))), v: V(0, rand(.8, 1.4), 0), c: MPBLUE, life: .9, size: .09, shape: Math.random() < .3 ? SH.star : SH.glow });
            if (t > 2.4) { fx.kill(sh); return false; } }); });
      });
      return 1.6;
    },
    // 8 · ยาบำรุงกำลังเจ็ดพลัง: seven coloured tonic orbs orbit the head, then streak back in one by one
    heal_tonic() {
      fx.cinematic(.6, 2.8); cast('heal_tonic');
      at('heal_tonic', () => {
        const cols = [C(2.6, .5, .4), C(2.6, 1.2, .3), C(2.4, 2.1, .4), C(.6, 2.4, .6), C(.4, 2.2, 2.2), C(.5, .9, 2.8), C(1.8, .6, 2.6)];
        const orbs = cols.map((c, i) => ({ s: fx.glowSprite(c, .55), c, i, done: false, from: null }));
        fx.addTask((dt, t) => {
          let alive = 0; const hp = hero.pos();
          for (const o of orbs) { if (o.done) continue; alive++;
            const an = t * 3.2 + o.i / 7 * 6.28, rr = Math.min(1, t * 3) * .95, orbit = hp.clone().add(V(Math.cos(an) * rr, 2.2 + Math.sin(an * 2) * .12, Math.sin(an) * rr * .7)), launch = .9 + o.i * .09;
            if (t < launch) o.s.position.copy(orbit);
            else { o.from ??= orbit.clone(); const u = clamp01((t - launch) / .35); o.s.position.copy(fx.arcPoint(o.from, chest(hero), .5, u));
              if (u >= 1) { o.done = true; fx.kill(o.s); fx.burst(chest(hero), 14, { c: o.c, size: .16, sp: 2.4, life: .6, shape: SH.star }); fx.flash(chest(hero), o.c.getHex(), 12, .3); character.tint?.(o.c.clone().multiplyScalar(.3), .5, .4); fx.punch(.15); } }
            fx.emit({ p: o.s.position.clone(), c: o.c, life: .35, size: .2, size1: 0 }); }
          if (!alive) { heal(hero.maxHp * .05); fx.after(.25, () => fx.popup(headP(hero).add(V(0, .4, 0)), 'โจมตี +18% · ป้องกัน +15%', 'st')); const p = hero.pos(); fx.shock(p.x, p.z, 1.6, C(2.4, .8, .3), GOLD, .5); fx.lightPillar(p, C(2, 1, .5), 5, .6, .9);
            fx.addTask((dt2, t2) => { const q = hero.pos(); for (let k = 0; k < 2; k++) { const an = rand(0, 6.28); fx.emit({ p: q.clone().add(V(Math.cos(an) * .42, .05, Math.sin(an) * .42)), v: V(0, rand(1.2, 2.2), 0), c: Math.random() < .5 ? C(2.4, .7, .25) : GOLD, life: .55, size: .2, size1: .03 }); } if (t2 > 3) return false; });
            return false; }
        });
      });
      return 1.6;
    },
    // 9 · พรแม่โพสพ: a golden rice field sprouts around the herbalist under a warm sunbeam
    heal_mother() {
      fx.cinematic(.75, 3.6); cast('heal_mother');
      at('heal_mother', () => {
        const center = hero.pos(), Rf = 4.2, N = 700, geo = new THREE.PlaneGeometry(.05, .8, 1, 4); geo.translate(0, .4, 0);
        const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, uniforms: { uTime: { value: 0 }, uGrow: { value: 0 }, uA: { value: 1 } },
          vertexShader: `uniform float uTime,uGrow; varying float vY; void main(){ vec3 p=position; vY=uv.y; vec4 w=instanceMatrix*vec4(p.x,p.y*uGrow,p.z,1.);
            float s=sin(uTime*2.+w.x*.8+w.z*.6)*.18*vY*vY; w.x+=s; w.z+=s*.5; w.y-=vY*vY*.12*uGrow; gl_Position=projectionMatrix*viewMatrix*modelMatrix*w; }`,
          fragmentShader: `varying float vY; uniform float uA; void main(){ vec3 c=mix(vec3(.12,.3,.08),vec3(1.1,.85,.3),smoothstep(.3,1.,vY)); c+=vec3(.9,.7,.2)*smoothstep(.85,1.,vY); gl_FragColor=vec4(c,uA); }` });
        const field = fx.add(new THREE.InstancedMesh(geo, mat, N)), d = new THREE.Object3D();
        for (let i = 0; i < N; i++) { const a = rand(0, 6.28), r = .6 + Math.sqrt(Math.random()) * (Rf - .6); d.position.set(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
          d.rotation.set(rand(-.15, .15), rand(0, 6.28), rand(-.15, .15)); d.scale.setScalar(rand(.7, 1.25)); d.updateMatrix(); field.setMatrixAt(i, d.matrix); }
        const beam = fx.add(new THREE.Mesh(new THREE.CylinderGeometry(.6, Rf * .7, 9, 40, 1, true), fx.pillarMat(C(.3, .24, .09)))); beam.position.set(center.x, 4.5, center.z);
        fx.decal(1, center.x, center.z, Rf, C(1.4, 1.1, .35), null, { life: 3.6, grow: .5, alpha: .6 }); fx.flash(V(center.x, 3, center.z), 0xffd890, 40, 1.4); fx.punch(.5);
        fx.after(.6, () => { heal(hero.maxHp * .3, 'heal big'); fx.after(.2, () => fx.popup(headP(hero).add(V(0, .3, 0)), '+MP 20%', 'mp')); fx.after(.45, () => fx.popup(headP(hero).add(V(0, .6, 0)), 'คริ +10%', 'st')); fx.burst(chest(hero), 18, { c: GOLD, size: .12, sp: 2, upMin: .6, life: 1, shape: SH.star }); });
        fx.addTask((dt, t) => {
          mat.uniforms.uTime.value = t; mat.uniforms.uGrow.value = 1 - Math.pow(1 - clamp01(t / .8), 3) - (t > 3 ? clamp01((t - 3) / .6) : 0);
          beam.material.uniforms.uTime.value = t; beam.material.uniforms.uA.value = clamp01(t * 2) * clamp01((3.6 - t) / .6) * fx.gain;
          for (let k = 0; k < 3; k++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * Rf; fx.emit({ p: V(center.x + Math.cos(a) * r, rand(.5, .8), center.z + Math.sin(a) * r), v: V(0, rand(.4, 1), 0), c: Math.random() < .6 ? GOLD : C(2.2, 2, 1.2), life: rand(1.2, 2), size: rand(.05, .1), shape: Math.random() < .2 ? SH.star : SH.glow }); }
          if (t > 3.6) { fx.kill(field); geo.dispose(); fx.kill(beam); return false; }
        });
      });
      return 2.4;
    },
    // 10 · น้ำอมฤตชุบชีวา: a golden urn tips from the sky, water pours, a sprinkle rain heals and blesses
    heal_amrita() {
      fx.cinematic(1, 3.2); cast('heal_amrita');
      const center = hero.pos(), Ra = 4.5, fwd = dirTo();
      const pts = [[0, 0], [.32, .02], [.5, .3], [.55, .6], [.42, .9], [.2, 1.05], [.18, 1.25], [.3, 1.35]].map(([x, y]) => new THREE.Vector2(x, y));
      const urn = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0xe0b050, metalness: .35, roughness: .35, emissive: 0x7a5410, side: THREE.DoubleSide }));
      const urnG = new THREE.Group(); urnG.add(urn); urn.position.y = -.6; fx.add(urnG); const aura = fx.glowSprite(C(1.8, 1.6, 1), 3); aura.material.opacity = .6;
      const top = center.clone().addScaledVector(fwd, 1).setY(5.2); urnG.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI / 2;
      let splashed = false;
      fx.addTask((dt, t) => {
        const u = clamp01(t / .5); urnG.position.copy(top).y += (1 - u) * 1.5; urn.rotation.z = -Math.min(1.9, Math.max(0, t - .5) * 3.5); aura.position.copy(urnG.position);
        urnG.scale.setScalar(t > 2.4 ? Math.max(.01, 1 - (t - 2.4) / .4) : 1); aura.material.opacity = .6 * (t > 2.4 ? Math.max(0, 1 - (t - 2.4) / .4) : u);
        urnG.updateMatrixWorld(); const lip = fx.toLocal(urn.localToWorld(V(-.15, 1.35, 0)));
        if (t > .8 && t < 2.1) for (let k = 0; k < 3; k++) fx.emit({ p: lip.clone().add(V(rand(-.06, .06), 0, rand(-.06, .06))), v: V(rand(-.15, .15), -rand(3, 4), rand(-.15, .15)), c: Math.random() < .6 ? C(.35, .9, 1.5) : C(1.2, 1.3, 1.4), life: .8, size: rand(.12, .2), grav: 5, drag: .2 });
        if (t > MOVES.heal_amrita.hits[0] && !splashed) { splashed = true; splash(lip.clone().setY(0)); }
        if (t > 2.9) { fx.kill(urnG); fx.kill(aura); return false; }
      });
      function splash(p) {
        fx.shake = .25; fx.punch(.8); fx.hitstop(.1); fx.flash(p, 0x8fd8ff, 70, 1.2);
        fx.decal(5, p.x, p.z, Ra, C(.3, .75, 1.15), null, { life: 2.6, grow: .9 }); fx.shock(p.x, p.z, Ra, WATER, WHITE, .9); fx.shock(p.x, p.z, Ra * .6, C(1, 1.1, 1.2), C(.3, .7, 1.2), .6);
        fx.burst(p.clone().setY(.1), 40, { c: [C(.25, .55, .8), C(.75, .85, .95)], S: fx.PN, size: .12, sp: 4, upMin: .8, upK: 1.6, life: 1.1, grav: 7, drag: .4, a: .9 });
        fx.addTask((dt, t) => { for (let k = 0; k < 6; k++) fx.emit({ p: V(p.x + rand(-Ra, Ra) * .75, rand(3.5, 4.5), p.z + rand(-Ra, Ra) * .6), v: V(0, -rand(2, 3), 0), c: Math.random() < .5 ? WATER : C(2, 2, 1.6), life: 1.6, size: .09, grav: 4, shape: Math.random() < .2 ? SH.star : SH.glow }); if (t > 1.6) return false; });
        fx.after(.2, () => { const hp = hero.pos(); fx.lightPillar(hp, C(.7, 1.0, 1.3), 6, .7, 1.2); fx.shock(hp.x, hp.z, 1.2, C(.4, .9, 1.4), C(.2, .5, .9), .5); heal(hero.maxHp * .6, 'heal big'); fx.popup(headP(hero).add(V(0, .5, 0)), 'ขวัญกันตาย 8 วิ', 'st'); });
      }
      return 2.2;
    },
  };

  R.cast = (id, quiet = false) => {
    if (R.time < R.busyUntil) return false;
    const dist = player.position.distanceTo(fx.toWorld(tg.pos.clone()));
    if (dist > R.range) { if (!quiet) fx.popup(hero.pos().setY(hero.barY + .4), 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ', 'st'); return false; }
    R.current = id; const dur = lockTime(MOVES[id], SK[id]()); R.busyUntil = R.time + dur; return dur;
  };
  R.update = dt => { R.time += dt; if (R.time >= R.busyUntil) R.facing = null; stepBook(dt); };
  Object.defineProperty(R, 'busy', { get: () => R.time < R.busyUntil });
  return R;
}
