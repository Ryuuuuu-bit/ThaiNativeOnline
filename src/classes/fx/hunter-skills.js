import * as THREE from 'three';
import { V, C, rand, clamp01, SH, COL } from './engine.js';
import { HUNTER_SKILLS } from '../hunter-moves.js';

// The hunter's (นายพราน) ten skills with their effects, timed to the hunter's clips
// (release times come from hunter-moves.js). Positions are FX-local units.
// Every shot nocks a real arrow between the hands while he draws; on the release it
// flies from the bow hand to the target and the blow lands when it arrives.
const { GOLD, WHITE } = COL;
const BASE = import.meta.env.BASE_URL + 'fx/hunter/';
export const hunterIconUrl = id => BASE + 'icon_' + id + '.png';

const POISON = C(.5, 1.9, .35), FIRE = C(2.6, 1.1, .25), SKY = C(1.4, 1.9, 2.6), JADE = C(.6, 1.9, 1.1);

export function createHunterSkills({ fx, character, player, dummy, groundHeight, labels, damage }) {
  const MOVES = Object.fromEntries(HUNTER_SKILLS.map(s => [s.id, s]));
  const R = { busyUntil: 0, facing: null, time: 0, range: 14 };
  const hero = { barY: 1.95, maxHp: 1000, hp: 800 };
  hero.pos = () => fx.toLocal(player.position).setY(0);
  const chest = a => (a === hero ? hero.pos().setY(.95) : a.chest());
  const headP = a => (a === hero ? hero.pos().setY(hero.barY + .2) : a.head());
  const tg = dummy, tpos = () => tg.pos.clone().add(tg.off);
  const dirTo = () => tpos().sub(hero.pos()).setY(0).normalize();
  const face = p => { const d = p.clone().sub(hero.pos()); R.facing = Math.atan2(d.x, d.z); };
  const anim = id => { const m = MOVES[id]; character.attack?.(character.has?.(m.clip) ? m.clip : m.fallback); return m; };
  const release = (id, fn) => fx.after(MOVES[id].hits[0], fn);
  const near = (P, r) => tg.alive && tpos().distanceTo(P) <= r;
  const hurt = (amt, crit, push = .12) => {
    // rules damage (via the training ground) for the skill being cast, else the effect's number
    const r = damage?.(R.current);
    if (!r || !r.dmg) return tg.hurt(amt, crit, push, hero.pos());
    if (!r.hit) return tg.miss();
    return tg.hurt(r.dmg, r.crit, push, hero.pos(), true);
  };
  const boneAt = (name, fallback) => { const b = character.bone?.(name); return b ? fx.toLocal(b.getWorldPosition(new THREE.Vector3())) : fallback(); };
  const bowHand = () => boneAt('LeftHand', () => chest(hero).add(dirTo().multiplyScalar(.5)).add(V(0, .3, 0)));
  const drawHand = () => boneAt('RightHand', () => chest(hero).add(V(0, .4, 0)));

  // ---- arrows -------------------------------------------------------------------------
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
    const glow = fx.glowSprite(col, .28 * k); glow.position.z = .44; fx.root.remove(glow); g.add(glow);
    return g;
  }
  // While he draws: an arrow lies between the bow hand and the string hand, then is shot.
  function nock(id, col, k = 1) {
    const a = arrow(col, k); let alive = true;
    fx.addTask((dt, t) => {
      if (!alive) return false;
      const bow = bowHand(), str = drawHand(); a.position.copy(bow.clone().lerp(str, .45)); a.lookAt(fx.toWorld(bow.clone().add(bow.clone().sub(str))));
      a.visible = t > .12; if (t > 3) { fx.kill(a); return false; }
    });
    return () => { alive = false; fx.kill(a); };
  }
  // Fly an arrow from the bow to `to` (arc height h), trail particles, onHit on arrival.
  function shoot({ to, col = WHITE, speed = 22, h = .12, k = 1, trail = col, through = 0, onHit, from = bowHand() }) {
    const a = arrow(col, k), end = through ? to.clone().add(to.clone().sub(from).setY(0).normalize().multiplyScalar(through)) : to;
    const dist = from.distanceTo(end), dur = Math.max(.08, dist / speed), hitU = through ? from.distanceTo(to) / dist : 1;
    let hit = false, prev = from.clone();
    fx.addTask((dt, t) => {
      const u = clamp01(t / dur), p = fx.arcPoint(from, end, h * dist * .1, u);
      a.position.copy(p); a.lookAt(fx.toWorld(p.clone().add(p.clone().sub(prev).normalize()))); prev.copy(p);
      for (let i = 0; i < 2; i++) fx.emit({ p: p.clone().add(V(rand(-.03, .03), rand(-.03, .03), rand(-.03, .03))), c: trail, life: .25, size: .1 * k, size1: .02 });
      if (!hit && u >= hitU) { hit = true; onHit?.(to); }
      if (u >= 1) { fx.kill(a); return false; }
    });
    return dur * hitU;
  }
  const struck = (p, s = 1, col = GOLD) => { fx.impact(p, s, col); fx.burst(p, 8, { c: [col, WHITE], size: .07, sp: 3, life: .35, shape: SH.star, drag: 4 }); };
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

  const SK = {
    // 1 · ศรฉับไว: two arrows at once, a hair apart
    arch_quick() {
      fx.cinematic(.3, 1.2);
      ready(() => { anim('arch_quick'); const drop = nock('arch_quick', WHITE);
        release('arch_quick', () => { drop();
          for (const [i, off] of [[0, -.12], [1, .12]].entries()) {
            const side = V(dirTo().z, 0, -dirTo().x).multiplyScalar(off[1]);
            fx.after(i * .04, () => shoot({ to: chest(tg).add(V(0, .2 + i * .1, 0)).add(side), col: C(2.4, 2.1, 1.4), onHit: p => { struck(p, .7); if (near(p, 1.5)) hurt(95, false); } }));
          }
          fx.speedLines(bowHand(), dirTo(), 8);
        }); });
      return 1.2;
    },
    // 2 · ศรพิษพรานไพร: a green arrow; the poison bubbles and bites five times
    arch_poison() {
      fx.cinematic(.35, 1.4);
      ready(() => { anim('arch_poison'); const drop = nock('arch_poison', POISON);
        release('arch_poison', () => { drop();
          shoot({ to: chest(tg).add(V(0, .25, 0)), col: POISON, trail: C(.3, 1.2, .25), onHit: p => {
            struck(p, .8, POISON); fx.decal(5, tpos().x, tpos().z, 1.1, POISON, C(.1, .5, .1), { life: 3.6, grow: .2 });
            if (!near(p, 1.5)) return; hurt(80, false); fx.popup(tg.head().add(V(0, .4, 0)), 'ติดพิษ', 'st');
            let n = 0;
            fx.addTask((dt, t) => {
              if (Math.random() < dt * 14) fx.emit({ p: chest(tg).add(V(rand(-.25, .25), rand(-.3, .4), rand(-.2, .2))), v: V(0, rand(.3, .8), 0), c: POISON, life: .7, size: .09, size1: .02, a: .8 });
              if (t > .7 * (n + 1) && n < 5) { n++; if (tg.alive) hurt(30, false, 0); }
              if (t > 3.6) return false;
            });
          } });
        }); });
      return 1.2;
    },
    // 3 · ศรทะลวงเกราะ: kneeling, a full heavy draw; a blue-white arrow punches straight through
    arch_pierce() {
      fx.cinematic(.6, 1.8);
      ready(() => { anim('arch_pierce'); const drop = nock('arch_pierce', SKY, 1.3);
        const charge = fx.glowSprite(SKY, .1);
        fx.addTask((dt, t) => { charge.position.copy(bowHand()); charge.scale.setScalar(.2 + clamp01(t / .85) * .7); charge.material.opacity = t < .9 ? 1 : 0; if (t > .9) { fx.kill(charge); return false; } });
        release('arch_pierce', () => { drop(); fx.shake = .15; fx.speedLines(bowHand(), dirTo(), 14, SKY);
          shoot({ to: chest(tg).add(V(0, .2, 0)), col: SKY, k: 1.4, speed: 34, h: 0, through: 3, onHit: p => {
            struck(p, 1.5, SKY); const tp = tpos(); fx.shock(tp.x, tp.z, 1.8, SKY, C(.4, .6, 1.2), .5);
            for (let i = 1; i <= 3; i++) fx.after(i * .05, () => { const q = p.clone().add(dirTo().multiplyScalar(i * .7)); fx.shock(q.x, q.z, .6, SKY, SKY, .3); });
            if (near(p, 1.6)) { hurt(260, true, .3); tg.knock(dirTo(), .4); fx.popup(tg.head().add(V(0, .5, 0)), 'เกราะแตก −35%', 'st'); }
          } });
        }); });
      return 1.6;
    },
    // 4 · ตาเหยี่ยว: a golden hawk circles high, dives into the hunter; his eyes burn gold
    arch_hawk() {
      fx.cinematic(.55, 1.8); face(tpos()); anim('arch_hawk');
      const hawk = fx.emojiSprite('🦅', '#ffd77a', C(2.2, 1.7, .7)); hawk.scale.setScalar(.9);
      const c0 = hero.pos();
      fx.addTask((dt, t) => {
        const dive = clamp01((t - .55) / .3), a = t * 5;
        const orbit = c0.clone().add(V(Math.cos(a) * 1.6, 3.1, Math.sin(a) * 1.6)), into = headP(hero);
        hawk.position.copy(orbit.lerp(into, dive * dive)); hawk.scale.setScalar(.9 - dive * .5);
        if (Math.random() < .6) fx.emit({ p: hawk.position.clone(), v: V(rand(-.3, .3), rand(-.4, 0), rand(-.3, .3)), c: GOLD, life: .5, size: .08, size1: .02, shape: SH.leaf });
        if (dive >= 1) { fx.kill(hawk); return false; }
      });
      release('arch_hawk', () => {
        const hp = hero.pos(); fx.flash(headP(hero), 0xffd070, 40, .5); fx.shock(hp.x, hp.z, 1.6, GOLD, C(1, .5, .1), .5);
        fx.burst(headP(hero), 26, { c: [GOLD, WHITE], size: .1, sp: 3, upMin: .3, life: .6, shape: SH.leaf, drag: 2 });
        character.tint?.(C(1, .75, .25), .35, 1.2);
        fx.after(.2, () => fx.popup(hp.clone().setY(hero.barY + .7), 'โจมตี +30% · คริ +30%', 'st'));
        const eyes = [-1, 1].map(() => fx.glowSprite(C(2.6, 1.9, .5), .12));
        fx.addTask((dt, t) => { const h = headP(hero).add(V(0, -.3, 0)), side = V(dirTo().z, 0, -dirTo().x).multiplyScalar(.06);
          eyes.forEach((e, i) => { e.position.copy(h).add(side.clone().multiplyScalar(i ? 1 : -1)).add(dirTo().multiplyScalar(.12)); e.material.opacity = clamp01((3 - t) / .5); });
          if (t > 3) { eyes.forEach(e => fx.kill(e)); return false; } });
      });
      return 1.6;
    },
    // 5 · ห่าฝนธนู: one arrow up into the sky, then five waves of arrows rain on the target area
    arch_rain() {
      fx.cinematic(.75, 2.6);
      ready(() => { anim('arch_rain'); const drop = nock('arch_rain', GOLD);
        release('arch_rain', () => { drop(); const P = tpos(), from = bowHand();
          shoot({ from, to: from.clone().add(dirTo().multiplyScalar(1.2)).add(V(0, 5, 0)), col: GOLD, speed: 26, h: 0 });
          fx.decal(1, P.x, P.z, 1.9, C(2, 1.4, .5), null, { life: 2.2, grow: .2 });
          for (let w = 0; w < 5; w++) fx.after(.45 + w * .2, () => {
            for (let i = 0; i < 6; i++) {
              const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 1.7, to = P.clone().add(V(Math.cos(a) * r, .05, Math.sin(a) * r));
              shoot({ from: to.clone().add(V(rand(-.5, .5), 4.5, rand(-.5, .5))), to, col: GOLD, speed: 18, h: 0, k: .9, onHit: q => { fx.burst(q, 5, { c: [C(.5, .42, .3), GOLD], S: fx.PN, size: .06, sp: 1.5, upMin: .6, life: .5, grav: 6 }); } });
            }
            fx.after(.25, () => { if (near(P, 2)) { hurt(110, false, .05); fx.impact(chest(tg), .6); } });
          });
        }); });
      return 1.4;
    },
    // 6 · ลมใต้ปีกครุฑ: golden garuda wings open behind the hunter and beat a gust over the party
    arch_garuda() {
      fx.cinematic(.6, 2.2); face(tpos()); anim('arch_garuda');
      const wingTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        for (let i = 0; i < 9; i++) { g.save(); g.translate(20, 230); g.rotate(-1.45 + i * .17); const grad = g.createLinearGradient(0, 0, 0, -210); grad.addColorStop(0, 'rgba(255,200,90,1)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
          g.fillStyle = grad; g.beginPath(); g.ellipse(0, -110, 16 + i, 105, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      const wings = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: wingTex, color: C(2, 1.5, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.scale.x = s; fx.add(m); return { m, s }; });
      fx.addTask((dt, t) => {
        const back = dirTo().multiplyScalar(-.35), side = V(dirTo().z, 0, -dirTo().x), open = clamp01(t / .45), beat = t > .9 && t < 1.2 ? Math.sin((t - .9) / .3 * Math.PI) : 0;
        wings.forEach(({ m, s }) => { m.position.copy(hero.pos()).add(back).add(side.clone().multiplyScalar(s * (.15 + 1 * open))).add(V(0, 1.45 - beat * .2, 0)); m.lookAt(fx.camera.position); m.rotation.z += s * (-.35 + beat * .45);
          m.material.opacity = Math.min(open, clamp01((2 - t) / .4)); });
        if (t > 2) { wings.forEach(({ m }) => fx.kill(m)); return false; }
      });
      release('arch_garuda', () => {
        const hp = hero.pos(); fx.shock(hp.x, hp.z, 3.4, JADE, C(.3, 1, .6), .8); fx.shock(hp.x, hp.z, 2.2, GOLD, C(1, .5, .1), .6);
        for (let k = 0; k < 40; k++) { const a = k / 40 * 6.28; fx.emit({ p: hp.clone().add(V(Math.cos(a) * .4, rand(.2, 1.4), Math.sin(a) * .4)), v: V(Math.cos(a) * rand(2, 4), rand(.2, 1), Math.sin(a) * rand(2, 4)), c: Math.random() < .5 ? GOLD : JADE, life: .9, size: .1, size1: .03, shape: SH.leaf, drag: 1.5, vr: 6 }); }
        fx.popup(hp.clone().setY(hero.barY + .5), '+80', 'heal');
        fx.after(.25, () => fx.popup(hp.clone().setY(hero.barY + .8), 'ปาร์ตี้ · คริ +15% · โจมตี +10% · ตีเร็ว +8%', 'st'));
      });
      return 1.8;
    },
    // 7 · ศรกระจายเจ็ดดาว: five star-trailed arrows fanned out as he sweeps the release
    arch_volley() {
      fx.cinematic(.5, 1.5);
      ready(() => { anim('arch_volley'); const drop = nock('arch_volley', C(2.2, 2, 2.6));
        release('arch_volley', () => { drop(); const from = bowHand(), d = dirTo(), dist = hero.pos().distanceTo(tpos()) + .2;
          [-2, -1, 0, 1, 2].forEach((i, n) => fx.after(n * .03, () => {
            const ang = i * .15, dir = V(d.x * Math.cos(ang) - d.z * Math.sin(ang), 0, d.x * Math.sin(ang) + d.z * Math.cos(ang));
            const to = hero.pos().add(dir.multiplyScalar(dist)).setY(1.2);
            shoot({ from, to, col: C(2.2, 2, 2.6), trail: C(1.6, 1.4, 2.4), onHit: p => { fx.burst(p, 6, { c: [WHITE, C(1.8, 1.6, 2.6)], size: .07, sp: 2, life: .4, shape: SH.star, drag: 3 }); if (near(p, 1.1)) { struck(p, .7, C(2, 1.8, 2.6)); hurt(70, false, .05); } } });
          }));
        }); });
      return 1.3;
    },
    // 8 · กับดักหนามพราน: he skids a spiked trap along the ground; it springs shut under the target
    arch_trap() {
      fx.cinematic(.5, 1.8);
      ready(() => { anim('arch_trap');
        release('arch_trap', () => { const from = hero.pos().add(dirTo().multiplyScalar(.6)), P = tpos();
          const trap = new THREE.Group(); fx.add(trap);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: .7, metalness: .4 })); ring.rotation.x = Math.PI / 2; trap.add(ring);
          const spikes = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, s = new THREE.Mesh(new THREE.ConeGeometry(.05, .45, 5), new THREE.MeshStandardMaterial({ color: 0x9a8a70, metalness: .5, roughness: .4 })); s.position.set(Math.cos(a) * .42, 0, Math.sin(a) * .42); trap.add(s); spikes.push({ s, a }); }
          fx.addTask((dt, t) => {
            const u = clamp01(t / .3); trap.position.copy(from.clone().lerp(P, u)).setY(.04); trap.rotation.y = t * 9 * (1 - u);
            const snap = clamp01((t - .32) / .08);
            spikes.forEach(({ s, a }) => { s.rotation.set(Math.sin(a) * (1.4 - snap * 1.25), 0, -Math.cos(a) * (1.4 - snap * 1.25)); s.position.y = .05 + snap * .2; });
            if (t > .32 && t - dt <= .32) {
              fx.decal(4, P.x, P.z, 1.2, C(1.4, 1, .5), C(.5, .3, .1), { life: 1.8, grow: .15 }); fx.shake = .15;
              fx.burst(P.clone().setY(.2), 18, { c: [C(.55, .48, .32), C(.4, .33, .22)], S: fx.PN, size: .09, sp: 2.5, upMin: .5, life: .7, grav: 7 });
              if (near(P, 1.3)) { hurt(180, false, 0); fx.stunStars(tg, 1.6); fx.popup(tg.head().add(V(0, .5, 0)), 'ติดกับ 1.6 วิ · ช้าลง 40%', 'st'); }
            }
            if (t > 2.4) { fx.kill(trap); return false; }
          });
        }); });
      return 1.5;
    },
    // 9 · ศรสังหารเหยี่ยวราตรี: the world darkens, a red sight line holds on the target, the
    // breath is held … one arrow, almost too fast to see
    arch_snipe() {
      fx.cinematic(.95, 2.4);
      ready(() => { anim('arch_snipe'); const drop = nock('arch_snipe', C(2.6, .5, .4), 1.2);
        const line = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: C(2.6, .3, .3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fx.add(line);
        const dot = fx.glowSprite(C(2.6, .3, .3), .2);
        fx.addTask((dt, t) => {
          const a = bowHand(), b = chest(tg).add(V(0, .45, 0)); line.position.copy(a.clone().lerp(b, .5)); line.lookAt(fx.toWorld(b)); line.scale.set(1, 1, a.distanceTo(b));
          const on = clamp01((t - .5) / .2) * clamp01((1.33 - t) / .05); line.material.opacity = on * (.5 + .3 * Math.sin(t * 30)); dot.position.copy(b); dot.material.opacity = on;
          if (t > 1.4) { fx.kill(line); fx.kill(dot); return false; }
        });
        release('arch_snipe', () => { drop(); fx.shake = .25; fx.flash(bowHand(), 0xff5040, 40, .3);
          shoot({ to: chest(tg).add(V(0, .45, 0)), col: C(2.6, .6, .4), trail: WHITE, k: 1.3, speed: 60, h: 0, onHit: p => {
            fx.impact(p, 2.4, C(2.6, .7, .4)); fx.hitstop(.16); fx.lightPillar(tpos(), C(2, .6, .4), 6, .7, .8);
            if (near(p, 1.6)) { hurt(900, true, .3); tg.knock(dirTo(), .6); fx.popup(tg.head().add(V(0, .7, 0)), 'สังหาร!', 'st big'); }
          } });
        }); });
      return 2.1;
    },
    // 10 · ศรเพลิงอัคนีบาต: a burning arrow shot straight up; the sky reddens and five waves of
    // fireballs fall on a wide circle around the target
    arch_meteor() {
      fx.cinematic(1, 3.6);
      ready(() => { anim('arch_meteor'); const drop = nock('arch_meteor', FIRE, 1.3);
        const flame = fx.glowSprite(FIRE, .3);
        fx.addTask((dt, t) => { flame.position.copy(bowHand().lerp(drawHand(), .2)); flame.scale.setScalar(.3 + clamp01(t / 1.1) * .4 + Math.sin(t * 40) * .04);
          if (Math.random() < .7) fx.emit({ p: flame.position.clone(), v: V(rand(-.2, .2), rand(.4, 1), rand(-.2, .2)), c: FIRE, life: .4, size: .12, size1: .02 });
          if (t > 1.1) { fx.kill(flame); return false; } });
        release('arch_meteor', () => { drop(); const P = tpos(), from = bowHand();
          shoot({ from, to: from.clone().add(V(0, 7, 0)), col: FIRE, trail: C(2.4, .8, .2), speed: 24, h: 0, k: 1.3 });
          fx.after(.35, () => { fx.flash(P.clone().setY(5), 0xff6030, 60, 1.2); fx.decal(3, P.x, P.z, 2.6, FIRE, C(.8, .2, .05), { life: 3, grow: .4 }); });
          for (let w = 0; w < 5; w++) fx.after(.6 + w * .24, () => {
            const big = w === 4, n = big ? 1 : 3;
            for (let i = 0; i < n; i++) {
              const a = rand(0, 6.28), r = big ? 0 : Math.sqrt(Math.random()) * 2.2, to = P.clone().add(V(Math.cos(a) * r, .1, Math.sin(a) * r));
              const ball = fx.glowSprite(FIRE, big ? 1.1 : .55), from2 = to.clone().add(V(rand(-1.5, 1.5), 6, rand(-1.5, 1.5)));
              fx.addTask((dt, t) => { const u = clamp01(t / .35); ball.position.copy(from2.clone().lerp(to, u * u));
                for (let k = 0; k < 3; k++) fx.emit({ p: ball.position.clone().add(V(rand(-.1, .1), rand(-.1, .1), rand(-.1, .1))), c: Math.random() < .5 ? FIRE : C(2.6, 1.8, .6), life: .45, size: big ? .3 : .16, size1: .03 });
                if (u >= 1) { fx.kill(ball); fx.impact(to.clone().setY(.4), big ? 2.4 : 1.1, FIRE); fx.shock(to.x, to.z, big ? 3.2 : 1.3, FIRE, C(.8, .2, .05), .5);
                  fx.burst(to.clone().setY(.3), big ? 30 : 10, { c: [C(.3, .25, .2), C(.5, .4, .3)], S: fx.PN, size: .2, size1: .5, sp: 2.5, upMin: .3, life: 1, shape: SH.soft, a: .7 });
                  if (big) { fx.lightPillar(to, FIRE, 6, .9, .9); fx.hitstop(.14); }
                  return false; } });
            }
            fx.after(.35, () => { if (near(P, 2.6)) hurt(big ? 320 : 120, big, .1); });
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
