import * as THREE from 'three';
import { V, C, rand, clamp01, easeOutBack, SH, COL, K } from './engine.js';
import { MUAYTHAI_SKILLS } from '../muaythai-moves.js';
import { crocYantTex } from './croc-yant.js';

// The ten Muay Thai skills with their effects, ported from
// prototypes/skill-fx/src/boxer_fx.src.html and timed to the fighter's clips
// (hit times come from muaythai-moves.js). Positions are FX-local units.
const { GOLD, WHITE, DUST, GOLD_SOFT } = COL;

const BASE = import.meta.env.BASE_URL + 'fx/muaythai/';
const img = name => Object.assign(new Image(), { src: BASE + name });
const HANUMAN_IMG = img('hanuman_yant.png'), ERAWAN_IMG = img('erawan_yant.png');

// Skill bar data: icon, unlock level, cooldown, short description.
export const SKILL_META = {
  boxer_jab: { lv: 1, cd: 2, desc: 'แย็บ แย็บคู่ แล้วก้าวแย็บ 3 หมัด' },
  boxer_kick: { lv: 2, cd: 4.5, desc: 'เตะก้านคอเต็มแรง กระเด็น มึนงง อ่อนแรง' },
  boxer_croc: { lv: 4, cd: 7, desc: 'หมุนตัวเตะกลับหลัง โดนทุกตัวรอบตัว 2 ครั้ง' },
  boxer_waikru: { lv: 6, cd: 22, desc: 'ฟื้น HP 20% โจมตี +35% ตีเร็ว +10% 12 วิ' },
  boxer_ngouy: { lv: 8, cd: 18, desc: '★ รับขาแล้วทุ่มศอกลงต้นขา มึนงง เกราะแตก' },
  boxer_drum: { lv: 10, cd: 26, desc: '[ปาร์ตี้] ตีกลองศึก 3 จังหวะ ฟื้น HP บัฟป้องกัน/โจมตี' },
  boxer_elbow: { lv: 20, cd: 5.5, desc: 'ศอกตัดแล้วพลิกศอกเดิมฟาดกลับ เลือดไหล' },
  boxer_knee: { lv: 40, cd: 10, desc: 'กระโดดเข่าลอยเข้าหาเป้า ผีรอบจุดมึน' },
  boxer_iron: { lv: 70, cd: 28, desc: 'คาถามหาอุด ป้องกัน +30% โจมตี +20% ฟื้น HP 12%' },
  boxer_hanuman: { lv: 100, cd: 16, desc: 'แม่ไม้: ปัดหมัดตรง ย่อหลบ แล้วเสยหมัดคู่ขึ้นปลายคาง กระเด็น มึน 1.2 วิ' },
};
export const iconUrl = id => BASE + 'icon_' + id + '.png';

// ---- yant / note textures (drawn once) --------------------------------------
function inkKey(image, g, x, y, w) {
  const src = document.createElement('canvas'); src.width = src.height = 256; const sg = src.getContext('2d'); sg.drawImage(image, 0, 0, 256, 256);
  const d = sg.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i] * .3 + d.data[i + 1] * .59 + d.data[i + 2] * .11) / 255, a = d.data[i + 3] / 255; const ink = Math.max(0, Math.min(1, (.62 - l) / .4)) * a; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = ink * 255; }
  sg.putImageData(d, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(src, x, y, w, w);
}
const glyph = (g, x, y, s, rot, k) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  g.arc(0, 0, 3.2 * s, Math.PI * .2, Math.PI * 2.1); g.moveTo(3 * s, 0); g.lineTo(3 * s, -8 * s - (k % 3) * 2 * s);
  if (k % 2) { g.moveTo(-3 * s, 0); g.quadraticCurveTo(-6 * s, -6 * s, -1 * s, -9 * s); } g.stroke(); g.restore(); };
let HANUMAN_TEX = null, ERAWAN_TEX = null, NINE_TEX = null, NOTE_TEX = null;
function hanumanTex() {
  if (HANUMAN_TEX) return HANUMAN_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  if (HANUMAN_IMG.complete) inkKey(HANUMAN_IMG, g, 96, 96, 320);
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 3;
  for (let i = 0; i < 22; i++) { const a = Math.PI * (.18 + .64 * i / 21), r = 228; glyph(g, 256 + Math.cos(a) * r, 236 + Math.sin(a) * r * .95, 1.6, a - Math.PI / 2, i); }
  for (let i = 0; i < 4; i++) { const x = 214 + i * 28; g.beginPath(); g.moveTo(x, 18); g.lineTo(x, 52); g.stroke(); glyph(g, x, 60, 1.5, 0, i); }
  [[52, 250, -1], [460, 250, 1]].forEach(([x, y, s]) => { g.beginPath(); g.moveTo(x - 30 * s, y); g.lineTo(x + 30 * s, y); g.stroke(); for (let k = 0; k < 3; k++) glyph(g, x + s * (k * 14 - 14), y - 12, 1.1, 0, k); });
  HANUMAN_TEX = new THREE.CanvasTexture(c); return HANUMAN_TEX;
}
function erawanTex() {
  if (ERAWAN_TEX) return ERAWAN_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 3;
  const flame = (x, y, a, L, s) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .2, -L * .35 * s, L * .55, L * .1 * s, L * .7, -L * .3 * s); g.quadraticCurveTo(L * .85, -L * .5 * s, L, -L * .25 * s); g.moveTo(L * .7, -L * .3 * s); g.arc(L * .62, -L * .3 * s, L * .08, 0, Math.PI * 1.6 * s); g.stroke(); g.restore(); };
  for (let i = 0; i < 17; i++) { const a = Math.PI * (1.08 + .84 * i / 16), r = 150; flame(256 + Math.cos(a) * r, 250 + Math.sin(a) * r, a, 70 + (i % 3) * 18, i % 2 ? 1 : -1); }
  for (let i = 0; i < 9; i++) { const a = Math.PI * (1.15 + .7 * i / 8), r = 205; flame(256 + Math.cos(a) * r, 250 + Math.sin(a) * r, a, 40, i % 2 ? -1 : 1); }
  g.beginPath(); g.moveTo(256, 470); g.bezierCurveTo(200, 430, 214, 392, 256, 412); g.bezierCurveTo(298, 392, 312, 430, 256, 470); g.stroke();
  [-1, 1].forEach(s => flame(256 + s * 30, 440, s > 0 ? -.3 : Math.PI + .3, 60, s));
  if (ERAWAN_IMG.complete) inkKey(ERAWAN_IMG, g, 86, 70, 340);
  ERAWAN_TEX = new THREE.CanvasTexture(c); return ERAWAN_TEX;
}
function nineYantTex() {
  if (NINE_TEX) return NINE_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 90, 0, 7); g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; g.save(); g.translate(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.rotate(a + 1.57); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 5, 0, 5); g.moveTo(-4, 6); g.lineTo(4, 6); g.stroke(); g.restore(); }
  g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 14; a += .2) { const r = 1 + a * 2.6; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke();
  NINE_TEX = new THREE.CanvasTexture(c); return NINE_TEX;
}
function noteTex() {
  if (NOTE_TEX) return NOTE_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 32, 34);
  NOTE_TEX = new THREE.CanvasTexture(c); return NOTE_TEX;
}

// ---- power-up aura ----------------------------------------------------------------
// A lathe envelope (body-hugging, widest at the waist, tapering ~1.9× the body
// height) with a shader that shows its rim, cuts the top into flickering flame
// tongues and streams bright streaks upward.
function auraGeo(k = 1) {
  const prof = [[.36, 0], [.55, .35], [.66, .9], [.64, 1.45], [.52, 2.05], [.34, 2.65], [.14, 3.15], [.02, 3.45]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * k, y * (.85 + .15 * k))), 40);
}
function auraMat(c) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: c }, uA: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV;
      void main(){ vUv = uv; vec4 w = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN, vV; uniform vec3 uC; uniform float uA, uTime;
      void main(){
        float u = vUv.x * 6.2832, v = vUv.y;
        float rim = pow(1. - abs(dot(vN, vV)), 1.6);
        // flame tongues: the envelope's top edge rises and falls around it
        float tip = .62 + .2 * sin(u * 7. + uTime * 5.) * sin(u * 3. - uTime * 3.1) + .12 * sin(u * 13. + uTime * 9.);
        float body = smoothstep(tip, tip - .22, v) * smoothstep(0., .08, v);
        float streak = .55 + .45 * sin(u * 23. + v * 9. - uTime * 14.);
        float a = (rim * .9 + .12) * body * streak * uA;
        gl_FragColor = vec4(uC * a, 1.);
      }` });
}

// ---- runner -------------------------------------------------------------------
// player: THREE.Object3D moved in world space; character: model with attack/has/tint;
// groundHeight(x, z): world ground height; onMove(): stops the player's own walking.
export function createBoxerSkills({ fx, character, player, dummy, groundHeight, labels, dim, damage }) {
  const MOVES = Object.fromEntries(MUAYTHAI_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 12 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 750 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy;
  const dirTo = () => tg.pos.clone().add(tg.off).sub(hero.pos()).setY(0).normalize();
  const ahead = (k = .45) => chest(hero).add(dirTo().multiplyScalar(k));
  const face = p => { const d = p.clone().sub(hero.pos()); R.facing = Math.atan2(d.x, d.z); };
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback); return m; };
  const hits = (id, fn) => MOVES[id].hits.forEach((t, i) => fx.after(t, () => fn(i)));
  const heal = (amt, cls = 'heal') => { const v = Math.round(amt); hero.hp = Math.min(hero.maxHp, hero.hp + v); fx.popup(hero.pos().setY(hero.barY + .2), '+' + v, cls); character.tint?.(C(.3, .9, .3), .25, .5); };
  const hurt = (amt, crit, push) => {
    // Rules damage (src/training/damage.js via the training ground) for the skill being cast;
    // the effect's own number when there is no rules entry (or in the entry-screen preview).
    const r = damage?.(R.current);
    if (!r || !r.dmg) return tg.hurt(amt, crit, push, hero.pos());
    if (!r.hit) return tg.miss();
    return tg.hurt(r.dmg, r.crit, push, hero.pos(), true);
  };
  const near = (P, r) => tg.alive && tg.pos.clone().add(tg.off).distanceTo(P) <= r;

  // Tween the player to a local point; a warm afterglow trails behind.
  function moveTo(to, dur, cb, trail = C(1, .6, .25)) {
    const from = fx.toWorld(hero.pos()), dest = fx.toWorld(to); face(to);
    fx.addTask((dt, t) => {
      const u = clamp01(t / dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      player.position.x = from.x + (dest.x - from.x) * e; player.position.z = from.z + (dest.z - from.z) * e;
      player.position.y = groundHeight(player.position.x, player.position.z);
      if (trail && u < 1) for (let k = 0; k < 2; k++) fx.emit({ p: chest(hero).add(V(rand(-.2, .2), rand(-.5, .4), rand(-.2, .2))), c: trail, life: .3, size: .14, size1: .02 });
      if (u >= 1) { cb?.(); return false; }
    });
  }
  const stepIn = (dist, cb, dur = .25) => { const P = tg.pos.clone().add(hero.pos().sub(tg.pos).setY(0).normalize().multiplyScalar(dist)); moveTo(P, dur, () => { face(tg.pos); cb(); }); };

  const SK = {
    boxer_jab() {
      fx.cinematic(.35, 1.2);
      stepIn(1.05, () => {
        anim('boxer_jab');
        hits('boxer_jab', i => { const p = chest(tg).add(V(rand(-.15, .15), rand(-.1, .2), .15)); fx.speedLines(ahead(.5), dirTo(), 10); fx.impact(p, i === 2 ? 1.1 : .6); hurt(85, i === 2, .12); if (i === 2) { const tp = tg.pos.clone().add(tg.off); fx.shock(tp.x, tp.z, 1.4, GOLD, C(1, .5, .2), .4); } });
      });
      return 1.35;
    },
    boxer_kick() {
      fx.cinematic(.65, 1.5);
      stepIn(1.25, () => {
        character.tint?.(C(1, .75, .3), .35, .6); anim('boxer_kick');
        hits('boxer_kick', () => {
          fx.slashArc(chest(hero).add(V(0, .25, 0)), tg.pos, { r: 1.5, sweep: 2.4, roll: .35, dir: 1, pal: 'gold', thick: .55, dur: .1, hold: .05, dis: .3 });
          fx.slashArc(chest(hero).add(V(0, .45, 0)), tg.pos, { r: 1.9, sweep: 2.2, roll: .5, dir: 1, pal: 'gold', thick: .35, dur: .13, hold: .04, dis: .35 });
          fx.after(.04, () => { const tp = tg.pos.clone().add(tg.off); fx.impact(chest(tg).add(V(0, .3, .15)), 2); fx.shock(tp.x, tp.z, 2.6, GOLD, C(1.2, .4, .1), .6); fx.lightPillar(tp, C(1.8, 1.2, .4), 4, .5, .6); fx.shake = .3; if (tg.alive) { hurt(330, true, 0); tg.knock(dirTo(), 1.4); fx.stunStars(tg, .7); fx.popup(tg.head().add(V(0, .5, 0)), 'มึน · อ่อนแรง −25%', 'st'); } });
        });
      });
      return 1.4;
    },
    // จระเข้ฟาดหาง: the ground turns to dark river water and a crocodile's eyes
    // surface; a crocodile sak-yant (croc-yant.js) inks itself in gold behind
    // the fighter (like หนุมานถวายแหวน) and flashes on each whip of the kick;
    // each whip that connects bursts into a splash with a foam ring, and at the
    // end the yant breaks up into gold motes.
    boxer_croc() {
      fx.cinematic(.85, 2);
      const P0 = tg.pos.clone().add(hero.pos().sub(tg.pos).setY(0).normalize().multiplyScalar(.9));
      moveTo(P0, .3, () => {
        const P = hero.pos(), Rr = 2; anim('boxer_croc');
        const WATER = C(.12, .42, .5), FOAM = C(.75, .92, .95);
        const pool = fx.decal(6, P.x, P.z, Rr + .3, C(.3, .5, .55), C(.05, .16, .2), { auto: false, alpha: 0, normal: true });
        const sideV = V(dirTo().z, 0, -dirTo().x), eyeAt = P.clone().addScaledVector(sideV, 1.25).addScaledVector(dirTo(), .35);
        const eyes = [-1, 1].map(k => { const e = fx.glowSprite(C(2.6, 2, .3), .5); e.scale.set(.5, .22, 1); return { e, k }; });
        // like หนุมานถวายแหวน: the crocodile yant inks itself in upright behind the
        // fighter, facing the camera, pulses on every whip, then breaks into gold motes
        const yant = fx.yantPlane(crocYantTex()), yu = yant.material.uniforms; let pulse = 0;
        const YS = 4.2, plane = (x, y) => V((x / 512 - .5) * YS, (.5 - y / 512) * YS, 0); // canvas px -> yant plane
        const TAIL = plane(312, 14), JAWS = plane(70, 440);
        fx.addTask((dt, t) => {
          const live = clamp01((1.75 - t) / .35);
          pool.u.uAlpha.value = .85 * clamp01(t * 4) * live; pool.m.position.set(P.x, .06, P.z);
          const ey = clamp01(t / .2) * clamp01((.5 - t) / .12);
          eyes.forEach(({ e, k }) => { e.position.copy(eyeAt).addScaledVector(sideV, k * .18).setY(.08 + ey * .1); e.material.opacity = ey; });
          if (t < .45 && Math.random() < dt * 6) fx.emit({ p: eyeAt.clone().add(V(rand(-.3, .3), .05, rand(-.3, .3))), v: V(0, rand(.2, .5), 0), c: FOAM, life: .5, size: .06, grav: 2, a: .8 }, fx.PN);
          // the yant rises behind the fighter (away from the target), sways like water
          const back = dirTo().multiplyScalar(-.9);
          pulse = Math.max(0, pulse - dt * 6);
          yu.uT.value = t; yu.uReveal.value = Math.min(1.15, t / .5 * 1.15); yu.uPulse.value = pulse; yu.uA.value = clamp01((1.7 - t) / .3);
          yant.position.copy(hero.pos()).add(back).add(V(Math.sin(t * 2.2) * .05, 2.15 + Math.sin(t * 3) * .05, 0));
          yant.lookAt(fx.camera.position); yant.rotateZ(Math.sin(t * 2.6) * .04); yant.scale.setScalar(YS * (1 + pulse * .05));
          // river water drips off the yant's tail while it is lit
          if (t > .3 && t < 1.4 && Math.random() < dt * 14) { yant.updateMatrixWorld(); const tip = fx.toLocal(yant.localToWorld(TAIL.clone().divideScalar(YS)));
            fx.emit({ p: tip, v: V(rand(-.3, .3), rand(-.2, .3), rand(-.3, .3)), c: Math.random() < .6 ? C(.3, .65, .75) : FOAM, life: .9, size: rand(.06, .1), grav: 5, drag: .4, a: .85 }, fx.PN); }
          if (t > 1.4 && t - dt <= 1.4) for (let k = 0; k < 60; k++) fx.emit({ p: yant.position.clone().add(V(rand(-1.3, 1.3), rand(-1.4, 1.4), 0)), v: V(rand(-.6, .6), rand(.4, 1.4), rand(-.3, .3)), c: Math.random() < .6 ? GOLD : C(2.4, 2, 1.2), life: rand(.6, 1.1), size: rand(.05, .1), shape: Math.random() < .3 ? SH.star : SH.glow });
          if (t > 1.8) { fx.kill(yant); eyes.forEach(({ e }) => fx.kill(e)); pool.auto = true; pool.t = 99; return false; }
        });
        hits('boxer_croc', i => {
          const last = i === MOVES.boxer_croc.hits.length - 1;   // the heel that lands (bigger)
          pulse = 1;
          // the jaws snap: a gold flash at the yant's mouth
          yant.updateMatrixWorld(); const jaws = fx.toLocal(yant.localToWorld(JAWS.clone().divideScalar(YS))); fx.flash(jaws, 0xffc860, 30, .3);
          fx.burst(jaws, 14, { c: [GOLD, C(2.4, 2, 1.2)], size: .09, sp: 2.5, upMin: .4, life: .5, shape: SH.star, drag: 3 });
          // water thrown out in a ring
          for (let k = 0; k < 30; k++) { const a = k / 30 * 6.28; fx.emit({ p: V(P.x + Math.sin(a) * Rr * .85, .35, P.z + Math.cos(a) * Rr * .85), v: V(Math.sin(a) * rand(1.2, 2.6), rand(1.6, 3), Math.cos(a) * rand(1.2, 2.6)), c: Math.random() < .5 ? C(.22, .55, .66) : FOAM, life: .9, size: rand(.07, .12), grav: 7, drag: .4, a: .9 }, fx.PN); }
          fx.shock(P.x, P.z, Rr + .2, C(.6, 1.4, 1.3), WATER, .5); fx.shake = .12;
          if (near(P, Rr + .5)) {
            hurt(200, last, .4); const c = chest(tg);
            fx.impact(c, last ? 1.6 : 1.1, C(1, 2, 1.4)); if (last) fx.lightPillar(tg.pos.clone().add(tg.off), C(.5, 1.6, 1.5), 4.5, .6, .8);
            fx.burst(c, 24, { c: [C(.22, .55, .66), FOAM, C(.5, .8, .85)], S: fx.PN, size: .12, sp: 3.2, upMin: .3, upK: 1.3, life: .9, grav: 7, drag: .5, a: .9 });
            const tp = tg.pos.clone().add(tg.off); fx.shock(tp.x, tp.z, .9, FOAM, WATER, .45);
            if (last) { tg.knock(tg.pos.clone().sub(P), .6); fx.popup(tg.head().add(V(0, .5, 0)), 'จระเข้ฟาดหาง!', 'st'); }
          }
        });
      }, C(.12, .38, .34));
      return 1.8;
    },
    // ไหว้ครูรำมวย: kneel and bow before three smoking incense sticks while the
    // มงคล glows red-white-gold; petals drift down; on the blessing a golden lotus
    // blooms under the feet (heal); then the arms sweep the Ram Muay with gold
    // and red ribbons trailing from the hands. Clip: bow 0.35–1.35, wings 1.8–2.7.
    boxer_waikru() {
      fx.cinematic(.7, 3.2);
      face(tg.pos); anim('boxer_waikru');
      const P = hero.pos(), fwd = dirTo(), side = V(fwd.z, 0, -fwd.x);
      const add = m => fx.add(m), glowMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      // incense: three sticks in a little brass pot in front, glowing tips, smoke wisps
      const pot = new THREE.Group(); pot.position.copy(P).addScaledVector(fwd, .75); add(pot);
      const brass = new THREE.MeshStandardMaterial({ color: 0xb8892e, metalness: .7, roughness: .35 });
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.14, .1, .12, 16), brass); bowl.position.y = .06; pot.add(bowl);
      const tips = [-1, 0, 1].map(k => { const st = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .5, 4), new THREE.MeshStandardMaterial({ color: 0x8a2a1c })); st.position.set(k * .05, .35, 0); st.rotation.z = k * .12; pot.add(st);
        const tip = fx.glowSprite(C(2.4, .9, .3), .12); return { st, tip }; });
      pot.scale.setScalar(.01);
      // มงคล: a red/white braided band with a gold glow, riding the head bone
      const bandTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const g = c.getContext('2d'); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ff3a2a' : '#ffffff'; g.fillRect(i * 8, 0, 8, 8); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
      const band = add(new THREE.Mesh(new THREE.TorusGeometry(.17, .028, 8, 40), new THREE.MeshBasicMaterial({ map: bandTex, color: C(1.3, 1.1, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      const bandGlow = fx.glowSprite(C(1.8, 1.2, .4), .9);
      const head = character.bone?.('Head'), hands = ['LeftHand', 'RightHand'].map(n => character.bone?.(n)).filter(Boolean);
      const wp = new THREE.Vector3(), boneLocal = b => fx.toLocal(b.getWorldPosition(wp));
      let lotus = null;
      fx.after(1.4, () => {
        heal(hero.maxHp * .2, 'heal big'); fx.after(.25, () => fx.popup(P.clone().setY(hero.barY + .7), 'โจมตี +35% · ตีเร็ว +10%', 'st'));
        fx.flash(P, 0xffc060, 60, .8); fx.shock(P.x, P.z, 1.8, GOLD, C(1, .45, .2), .6); fx.shock(P.x, P.z, 3.2, C(2, 1.4, .5), C(1, .4, .1), .9); fx.lightPillar(P, C(2, 1.5, .6), 7, .9, 1.4); fx.punch(.6);
        lotus = fx.lotus(C(.7, .32, .22), C(1.5, 1.05, .35), .95); lotus.position.copy(P).setY(.04);
        fx.burst(P.clone().setY(.3), 26, { c: [C(.98, .72, .22), C(.95, .45, .5)], S: fx.PN, size: .12, sp: 2.2, upMin: .8, upK: 1.4, life: 1.3, shape: SH.petal, drag: 1.4, grav: .6, a: .95 });
      });
      fx.addTask((dt, t) => {
        const live = clamp01((3.4 - t) / .4), hp = hero.pos();
        // incense rises out of the ground for the bow, then sinks away
        pot.scale.setScalar(t < .35 ? Math.max(.01, easeOutBack(t / .35)) : t > 2.3 ? Math.max(.01, 1 - (t - 2.3) / .3) : 1);
        tips.forEach(({ st, tip }) => { st.updateMatrixWorld(); const p = fx.toLocal(st.localToWorld(V(0, .25, 0))); tip.position.copy(p); tip.material.opacity = pot.scale.x * (.75 + .25 * Math.sin(t * 9 + p.x * 40));
          if (pot.scale.x > .5 && Math.random() < dt * 9) fx.emit({ p, v: V(rand(-.05, .05), rand(.35, .55), rand(-.05, .05)), c: C(.62, .6, .66), life: rand(1.2, 1.8), size: .08, size1: .5, shape: SH.soft, a: .45, drag: .3 }, fx.PN); });
        // มงคล band on the head
        if (head) { const h = boneLocal(head); band.position.copy(h).add(V(0, .08, 0)); bandGlow.position.copy(band.position); }
        else { band.position.copy(hp).setY(1.8); bandGlow.position.copy(band.position); }
        band.rotation.set(Math.PI / 2, 0, t * 1.5); bandTex.offset.x = -t * .4;
        const on = clamp01(t * 3) * live; band.material.opacity = on; bandGlow.material.opacity = on * (.45 + .2 * Math.sin(t * 6));
        // petals drifting down around the fighter
        if (Math.random() < dt * 10 * live) { const a = rand(0, 6.28), r = rand(.4, 1.6); fx.emit({ p: hp.clone().add(V(Math.cos(a) * r, rand(2.2, 2.8), Math.sin(a) * r)), v: V(rand(-.2, .2), rand(-.55, -.35), rand(-.2, .2)), c: Math.random() < .6 ? C(.98, .72, .22) : C(.95, .45, .5), life: 3, size: .12, shape: SH.petal, vr: rand(-2, 2), a: .95 }, fx.PN); }
        // the lotus opens, glows, then fades under the feet
        if (lotus) { const lt = t - 1.4; lotus.userData.open(clamp01(lt / .5)); lotus.rotation.y = lt * .3; lotus.userData.alpha(clamp01(lt * 4) * clamp01((1.9 - lt) / .5)); if (lt > 1.9) { fx.kill(lotus); lotus = null; } }
        // Ram Muay: ribbons from the hands while the arms sweep
        if (t > 1.75 && t < 2.85) hands.forEach((b, i) => { const p = boneLocal(b); for (let k = 0; k < 2; k++) fx.emit({ p: p.clone().add(V(rand(-.03, .03), rand(-.03, .03), rand(-.03, .03))), v: V(0, rand(.05, .2), 0), c: i ? C(2.2, .55, .35) : C(2.3, 1.7, .6), life: .55, size: .1, size1: .02, drag: 2 }); });
        if (Math.random() < dt * 6 * live) fx.emit({ p: hp.clone().add(V(rand(-.4, .4), .05, rand(-.3, .3))), v: V(0, rand(.8, 1.4), 0), c: C(2.2, 1.3, .4), life: .8, size: .1, size1: .02, shape: SH.star });
        if (t > 3.4) { fx.kill(pot); tips.forEach(({ tip }) => fx.kill(tip)); fx.kill(band); fx.kill(bandGlow); if (lotus) fx.kill(lotus); return false; }
      });
      return 3.2;
    },
    boxer_ngouy() {
      fx.cinematic(1, 1.9);
      const P = tg.pos.clone().add(hero.pos().sub(tg.pos).setY(0).normalize().multiplyScalar(.6)); P.y = 0;
      face(tg.pos); anim('boxer_ngouy'); fx.decal(1, tg.pos.x, tg.pos.z, 1.8, C(2, 1.3, .4), null, { life: 1.3, grow: .2 });
      fx.after(.3, () => moveTo(P, .65, null, C(1.3, .8, .3)));
      // Erawan inks itself in above the target and drives down with the elbow.
      const ele = fx.yantPlane(erawanTex()), eu = ele.material.uniforms; ele.visible = false;
      fx.after(.2, () => { ele.visible = true; fx.addTask((dt, t) => { const u = clamp01(t / .75), drop = u < .7 ? 0 : (u - .7) / .3; eu.uT.value = t; eu.uReveal.value = Math.min(1.15, t / .55 * 1.15);
        ele.position.set(tg.pos.x, 2.15 - drop * drop, tg.pos.z + .5); ele.lookAt(fx.camera.position); ele.scale.setScalar(3.9 * (1 - drop * .15)); eu.uPulse.value = drop;
        if (t > .75) { const f = (t - .75) / .35; eu.uPulse.value = 1 - f; eu.uA.value = 1 - f;
          if (t - dt <= .75) for (let k = 0; k < 70; k++) fx.emit({ p: ele.position.clone().add(V(rand(-1.8, 1.8), rand(-1.6, 1.6), 0)), v: V(rand(-1.5, 1.5), rand(-.5, 1.5), rand(-.5, .5)), c: Math.random() < .6 ? GOLD : C(2.4, 2, 1.2), life: rand(.5, 1), size: rand(.05, .11), shape: Math.random() < .3 ? SH.star : SH.glow, drag: 1.5 }); }
        if (t > 1.1) { fx.kill(ele); return false; } }); });
      hits('boxer_ngouy', () => {
        const Rr = 2.4; fx.shake = .45; fx.flash(P, 0xffb050, 50, .5); dim.style.opacity = '.25'; fx.after(.12, () => dim.style.opacity = '0');
        fx.impact(chest(tg).add(V(0, .4, .2)), 1.9); fx.hitstop(.14); fx.lightPillar(P, C(1.3, .8, .22), 6, .7, .9); fx.shock(P.x, P.z, 3.6, C(1.6, .9, .25), C(.6, .25, .08), 1);
        fx.shock(P.x, P.z, Rr, C(2.6, 1.6, .5), C(1.2, .4, .1), .5); fx.shock(P.x, P.z, Rr * 1.6, DUST, DUST, .8);
        fx.burst(P.clone().setY(.2), 40, { c: [DUST, C(.36, .3, .2), C(.55, .48, .32)], S: fx.PN, size: .7, size1: 1.6, sp: 4.5, upMin: .1, upMax: .5, life: 1.3, shape: SH.soft, a: .75, drag: 2.5 });
        fx.burst(P.clone().setY(.3), 22, { c: C(.28, .24, .2), S: fx.PN, size: .12, sp: 4.5, upMin: .8, upK: 1.6, life: 1.3, shape: SH.soft, grav: 9, a: 1, drag: .3 });
        if (tg.alive) { hurt(640, true, .3); fx.stunStars(tg, 1.5); fx.popup(tg.head().add(V(0, .7, 0)), 'มึน 1.5 วิ · เกราะแตก −40%', 'st'); }
      });
      return 1.8;
    },
    boxer_drum() {
      fx.cinematic(.7, 2.6);
      face(tg.pos); anim('boxer_drum');
      const fwd = dirTo(), side = V(fwd.z, 0, -fwd.x), G = new THREE.Group(), P = hero.pos().add(fwd.clone().multiplyScalar(.75)).add(side.multiplyScalar(.15)); G.position.copy(P); fx.add(G);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .55, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9c2020, roughness: .6, side: THREE.DoubleSide })); body.position.y = .55; G.add(body);
      const skin = new THREE.Mesh(new THREE.CircleGeometry(.42, 24), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: .8 })); skin.rotation.x = -Math.PI / 2; skin.position.y = .83; G.add(skin);
      [.3, .83].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(.43, .03, 6, 28), new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: .8, roughness: .3 })); r.rotation.x = Math.PI / 2; r.position.y = y; G.add(r); });
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(.3, .38, .3, 12), new THREE.MeshStandardMaterial({ color: 0x4a3020 })); legs.position.y = .15; G.add(legs);
      G.traverse(o => { o.castShadow = true; }); G.scale.setScalar(.01); const Rr = 5.5;
      fx.addTask((dt, t) => { G.scale.setScalar(t < .3 ? easeOutBack(t / .3) : t > 2.4 ? Math.max(.01, 1 - (t - 2.4) / .3) : 1); if (t > 2.7) { fx.kill(G); return false; } });
      hits('boxer_drum', b => {
        skin.position.y = .8; fx.after(.06, () => skin.position.y = .83);
        const top = P.clone().setY(.9); fx.flash(top, 0xffa040, 40 + b * 15, .3); fx.shake = .08 + b * .06; fx.punch(.25 + b * .15); fx.hitstop(.03 + b * .02);
        if (b === 2) fx.lightPillar(hero.pos(), C(2.2, 1.2, .4), 6, .8, 1);
        fx.shock(P.x, P.z, Rr * (.6 + b * .2), C(2.2, 1.2, .4), C(1, .4, .15), .6);
        const ring = fx.add(new THREE.Mesh(new THREE.TorusGeometry(1, .03, 6, 60), new THREE.MeshBasicMaterial({ color: C(2.2, 1.4, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); ring.rotation.x = Math.PI / 2; ring.position.copy(top);
        fx.addTask((dt, t) => { ring.scale.setScalar(.4 + t * 7); ring.material.opacity = 1 - t / .6; if (t > .6) { fx.kill(ring); return false; } });
        for (let k = 0; k < 4; k++) { const s = fx.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex(), color: k % 2 ? C(2.2, 1.4, .5) : C(2.2, .6, .4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); s.scale.setScalar(.35);
          const a = rand(0, 6.28), v = V(Math.cos(a) * rand(1, 2), rand(1, 1.8), Math.sin(a) * rand(1, 2)); s.position.copy(top);
          fx.addTask((dt, t) => { s.position.addScaledVector(v, dt); s.material.rotation = Math.sin(t * 8) * .3; s.material.opacity = 1 - t / 1.1; if (t > 1.1) { fx.kill(s); return false; } }); }
        if (b === 2) { const hp = hero.pos(); heal(hero.maxHp * .15); fx.after(.25, () => fx.popup(hp.clone().setY(hero.barY + .7), 'ป้องกัน +18 · โจมตี +10%', 'st')); fx.shock(hp.x, hp.z, 1, GOLD, C(1, .4, .1), .4); }
      });
      return 2.6;
    },
    boxer_elbow() {
      fx.cinematic(.5, 1.3);
      stepIn(.95, () => {
        anim('boxer_elbow');
        hits('boxer_elbow', i => {
          fx.slashArc(chest(hero).add(V(0, .35, 0)), tg.pos, { r: .95, sweep: 1.8, roll: i ? -.9 : .9, dir: i ? -1 : 1, pal: 'red', thick: .6, dur: .07, hold: .03, dis: .22 });
          fx.impact(chest(tg).add(V(0, .45, .15)), i ? 1.4 : 1, C(2.4, .6, .35)); if (tg.alive) { hurt(190, i === 1, .15); if (i === 0) { fx.stunStars(tg, .5); tg.bleed(); } }
        });
      });
      return 1.35;
    },
    boxer_knee() {
      fx.cinematic(.8, 1.5);
      const P = tg.pos.clone().add(hero.pos().sub(tg.pos).setY(0).normalize().multiplyScalar(.8)); P.y = 0;
      face(tg.pos); anim('boxer_knee'); fx.after(.25, () => moveTo(P, .35, null, C(1.4, .9, .35)));
      hits('boxer_knee', () => {
        fx.impact(chest(tg).add(V(0, .2, .2)), 2.2); fx.hitstop(.1); fx.flash(P, 0xffd070, 80, .5); fx.shock(P.x, P.z, 2.6, C(2, 1.5, .5), C(.9, .4, .1), .7);
        const col = fx.add(new THREE.Mesh(new THREE.CylinderGeometry(.25, .7, 5, 24, 1, true), fx.pillarMat(C(1.6, 1.2, .5)))); col.position.set(tg.pos.x, 2.5, tg.pos.z);
        fx.addTask((dt, t) => { col.material.uniforms.uTime.value = t; col.material.uniforms.uA.value = Math.max(0, 1 - t / .5) * 1.4; col.scale.set(1 + t, Math.min(1, t * 8), 1 + t); if (t > .5) { fx.kill(col); return false; } });
        for (let k = 0; k < 16; k++) fx.emit({ p: chest(tg), v: V(rand(-.8, .8), rand(5, 9), rand(-.8, .8)), c: Math.random() < .5 ? GOLD : WHITE, life: .45, size: .1, size1: .02, drag: 2 });
        fx.shock(P.x, P.z, 1.4, GOLD, C(1, .5, .2), .4);
        if (near(P, 1.9)) { hurt(360, true, .3); fx.stunStars(tg, .9); }
      });
      return 1.4;
    },
    // กายเหล็กมหาอุด: a power-up. Dust and motes are pulled in while the fighter
    // strains (gold aura licking up, sparks crackling); at 1.42 s it bursts — flash,
    // shock rings, a light pillar, debris thrown up — and a blazing gold aura with
    // arcing sparks stays on, over the nine-yant ring, while the buff lasts.
    boxer_iron() {
      fx.cinematic(.85, 3.2);
      face(tg.pos); anim('boxer_iron'); const P0 = hero.pos();
      const AURA = C(2.4, 1.75, .4), HOT = C(2.8, 2.4, 1.2), ARC = C(1.8, 2.1, 2.8), BURST = 1.42;
      const ring = fx.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: nineYantTex(), color: C(2, 1.5, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); ring.rotation.x = -Math.PI / 2;
      // the aura: a tall flame envelope around the body — brightest at its rim, licking
      // up in tongues that taper well above the head (two layers, the inner one hotter)
      const shell = fx.add(new THREE.Mesh(auraGeo(1), auraMat(AURA)));
      const inner = fx.add(new THREE.Mesh(auraGeo(.72), auraMat(HOT)));
      const charge = fx.decal(3, P0.x, P0.z, 1.3, AURA, C(1, .5, .1), { life: 1.5, grow: 1.2 });
      // crackling arcs: short jagged lines re-drawn every few frames around the body
      const bolts = [0, 1, 2].map(() => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(7 * 3), 3));
        const l = fx.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: ARC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
        l.visible = false; l.renderOrder = 6; return l;
      });
      const zap = (l, hp) => {
        const a = rand(0, 6.28), y = rand(.4, 1.7), r = rand(.25, .45);
        const p = hp.clone().add(V(Math.cos(a) * r, y, Math.sin(a) * r)), d = V(rand(-1, 1), rand(-.6, 1), rand(-1, 1)).normalize().multiplyScalar(rand(.35, .7));
        const arr = l.geometry.attributes.position.array;
        for (let i = 0; i < 7; i++) { const u = i / 6, q = p.clone().addScaledVector(d, u); if (i && i < 6) q.add(V(rand(-.08, .08), rand(-.08, .08), rand(-.08, .08))); q.toArray(arr, i * 3); }
        l.geometry.attributes.position.needsUpdate = true; l.visible = true; l.material.opacity = 1;
      };
      fx.flash(P0, 0xffd27a, 25, .5); fx.punch(.25);
      let boomed = false, zapT = 0;
      fx.addTask((dt, t) => {
        const hp = hero.pos(), pow = clamp01(t / BURST), on = t >= BURST, live = clamp01((3.6 - t) / .4);
        // gather: dust and motes spiral in toward the feet while charging
        if (!on && Math.random() < dt * 45) {
          const a = rand(0, 6.28), r = rand(1.6, 2.8), gold = Math.random() < .4;
          fx.emit({ p: hp.clone().add(V(Math.cos(a) * r, rand(.03, .25), Math.sin(a) * r)), c: gold ? GOLD_SOFT : DUST, life: 1.3, size: gold ? .07 : .12, size1: .03, home: hp.clone().setY(.25), homeK: 3, swirl: 1.4, shape: gold ? SH.glow : SH.soft }, gold ? undefined : fx.PN);
        }
        // aura flames: rising embers around the body, roaring after the burst
        const rate = (on ? 140 : 15 + 70 * pow) * live;
        for (let n = Math.floor(rate * dt + Math.random()); n > 0; n--) {
          const a = rand(0, 6.28), r = rand(.28, .55) * (on ? 1.15 : 1);
          fx.emit({ p: hp.clone().add(V(Math.cos(a) * r, rand(0, on ? 1.5 : 1.1), Math.sin(a) * r)), v: V(-Math.cos(a) * .3, rand(1.8, on ? 4.2 : 3), -Math.sin(a) * .3), c: Math.random() < .35 ? HOT : AURA, life: rand(.3, .55), size: rand(.2, .34), size1: .03, drag: 1.2, shape: Math.random() < .5 ? SH.soft : SH.glow });
        }
        const flick = .85 + .15 * Math.sin(t * 37) * Math.sin(t * 23);
        const grow = on ? 1 : .45 + .4 * pow;
        shell.position.copy(hp); shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = (on ? .95 : .35 * pow) * live * flick;
        shell.scale.set(1 + .04 * Math.sin(t * 41), grow + .04 * Math.sin(t * 29), 1 + .04 * Math.sin(t * 43));
        inner.position.copy(hp); inner.material.uniforms.uTime.value = t * 1.3 + 4; inner.material.uniforms.uA.value = (on ? .45 : .15 * pow) * live * flick;
        inner.scale.set(1, grow * .9, 1);
        character.tint?.(C(.95, .7, .2), (on ? .55 : .3 * pow) * live);
        ring.position.set(hp.x, .06, hp.z); ring.rotation.z = t * (on ? 1.6 : .6); ring.material.opacity = clamp01(t * 2) * live; ring.scale.setScalar(on ? 1 + .06 * Math.sin(t * 9) : .8 + .2 * pow);
        // sparks: sparse while straining, constant once powered up
        zapT -= dt;
        if (zapT <= 0 && t > .5 && live > .3) { zapT = on ? rand(.04, .09) : rand(.12, .25); zap(bolts[(Math.random() * bolts.length) | 0], hp); }
        for (const l of bolts) if (l.visible) { l.material.opacity -= dt * 12; if (l.material.opacity <= 0) l.visible = false; }
        if (on && !boomed) {
          boomed = true; const c = hp.clone().setY(.95);
          fx.flash(hp, 0xffe08a, 90, .7); fx.hitstop(.12); fx.punch(.9); fx.shake = Math.max(fx.shake, .45);
          fx.shock(hp.x, hp.z, 2.4, HOT, AURA, .55); fx.shock(hp.x, hp.z, 4.2, AURA, C(1, .45, .1), 1);
          fx.decal(0, hp.x, hp.z, 1.6, C(.25, .18, .1), null, { life: 2.6, normal: true, alpha: .55 });   // scorched crater
          fx.lightPillar(hp, AURA, 8, 1.1, 1.2);
          fx.burst(c, 60, { c: [HOT, AURA, WHITE], size: .14, sp: 7, upMin: -.2, upMax: .9, life: .7, drag: 2.5, shape: SH.star });
          fx.burst(hp.clone().setY(.1), 26, { c: DUST, size: .16, sizeMin: .06, sp: 5, upMin: .8, upMax: 1.6, life: 1.2, grav: 9, drag: .6, shape: SH.soft, S: fx.PN });   // debris thrown up
          if (near(hp, 2.6)) { tg.knock(dirTo(), .8); fx.popup(tg.head().add(V(0, .4, 0)), 'กระเด็น', 'st'); }
          fx.after(.05, () => heal(hero.maxHp * .12));
          fx.after(.3, () => fx.popup(hp.clone().setY(hero.barY + .7), 'ป้องกัน +30% · โจมตี +20%', 'st'));
        }
        if (t > 3.6) { character.tint?.(null); fx.kill(ring); fx.kill(shell); fx.kill(inner); bolts.forEach(l => fx.kill(l)); return false; }
      });
      return 2.4;
    },
    boxer_hanuman() {
      fx.cinematic(1, 2.2);
      stepIn(1.15, () => {
        anim('boxer_hanuman');
        const han = fx.yantPlane(hanumanTex()), u = han.material.uniforms; let pulse = 0;
        fx.addTask((dt, t) => { u.uT.value = t; u.uReveal.value = Math.min(1.15, t / .5 * 1.15); pulse = Math.max(0, pulse - dt * 6); u.uPulse.value = pulse;
          const back = dirTo().multiplyScalar(-.9); han.position.copy(hero.pos()).add(back).add(V(0, 2.15 + Math.sin(t * 3) * .05, 0)); han.lookAt(fx.camera.position); han.scale.setScalar(4.2 * (1 + pulse * .05)); u.uA.value = clamp01((1.7 - t) / .3);
          if (t > 1.4 && t - dt <= 1.4) for (let k = 0; k < 60; k++) fx.emit({ p: han.position.clone().add(V(rand(-1.3, 1.3), rand(-1.4, 1.4), 0)), v: V(rand(-.6, .6), rand(.4, 1.4), rand(-.3, .3)), c: Math.random() < .6 ? GOLD : C(2.4, 2, 1.2), life: rand(.6, 1.1), size: rand(.05, .1), shape: Math.random() < .3 ? SH.star : SH.glow });
          if (t > 1.7) { fx.kill(han); return false; } });
        // แม่ไม้หนุมานถวายแหวน: parry the straight right across, slip low, then a double
        // uppercut — both fists together up under the chin, like presenting the ring.
        const fistsAt = () => { const l = character.bone?.('LeftHand'), r = character.bone?.('RightHand'); return l && r ? fx.toLocal(l.getWorldPosition(new THREE.Vector3())).add(fx.toLocal(r.getWorldPosition(new THREE.Vector3()))).multiplyScalar(.5) : chest(hero).add(dirTo().multiplyScalar(.4)); };
        hits('boxer_hanuman', i => {
          if (i === 0) {   // parry: a cool deflection arc across the face
            fx.slashArc(chest(hero).add(V(0, .45, 0)), tg.pos, { r: .7, sweep: 1.4, roll: 1.2, dir: -1, pal: 'blue', thick: .4, dur: .08, hold: .03, dis: .16 });
            fx.burst(chest(hero).add(dirTo().multiplyScalar(.45)).add(V(0, .45, 0)), 10, { c: [WHITE, C(1.4, 1.7, 2.2)], size: .08, sp: 3, life: .3, shape: SH.star, drag: 4 });
            fx.popup(headP(hero).add(V(0, .2, 0)), 'ปัด!', 'st'); pulse = .6;
            return;
          }
          // double uppercut: two gold arcs sweeping up, the ring rising off the fists into the chin
          const f = fistsAt();
          for (const side of [-1, 1]) fx.slashArc(f.clone().add(V(0, -.3, 0)), tg.pos, { r: 1.1, sweep: 1.5, roll: Math.PI / 2 + side * .25, dir: side, pal: 'gold', thick: .6, dur: .07, hold: .03, dis: .2 });
          const ringM = fx.add(new THREE.Mesh(new THREE.TorusGeometry(.32, .07, 10, 40), new THREE.MeshBasicMaterial({ color: C(2.6, 2, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
          const from = f.clone(), to = headP(tg).add(V(0, -.15, 0));
          fx.addTask((dt, t) => { const u = clamp01(t / .12); ringM.position.copy(from).lerp(to, u).add(V(0, Math.sin(u * Math.PI) * .2, 0)); ringM.lookAt(fx.camera.position); ringM.scale.setScalar(t < .12 ? .7 + u * .3 : 1 + (t - .12) * 4); ringM.material.opacity = t < .12 ? 1 : 1 - (t - .12) / .45; if (t > .57) { fx.kill(ringM); return false; } });
          fx.after(.1, () => {
            const tp = tg.pos.clone().add(tg.off);
            fx.flash(to, 0xffd060, 90, .6); fx.impact(to, 2.4); fx.hitstop(.14); fx.shake = .3; pulse = 1;
            fx.lightPillar(tp, C(2.2, 1.7, .6), 7, .9, 1); fx.shock(tp.x, tp.z, 3.4, GOLD, C(1, .4, .1), .9);
            fx.burst(to, 30, { c: [GOLD, WHITE], size: .14, sp: 5, upMin: .5, life: .5, shape: SH.star, drag: 3 });
            if (near(hero.pos(), 2.4)) { hurt(520, true, .2); tg.knock(dirTo(), .9); fx.stunStars(tg, 1.2); }
            fx.popup(tg.head().add(V(0, .9, 0)), 'ถวายแหวน!', 'st big');
          });
        });
      });
      return 1.9;
    },
  };

  // Cast a skill by id. Returns false (with a reason popup) if it can't fire.
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
