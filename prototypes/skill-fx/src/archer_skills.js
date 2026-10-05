/* ---------------- arrows ---------------- */
const ARROW_GEO = (() => {
  const shaft = new THREE.CylinderGeometry(.016, .016, .95, 5); shaft.rotateX(Math.PI / 2);
  const head = new THREE.ConeGeometry(.05, .17, 6); head.rotateX(Math.PI / 2); head.translate(0, 0, .55);
  const fl = new THREE.PlaneGeometry(.1, .2); fl.translate(0, 0, -.38);
  const fl2 = fl.clone(); fl2.rotateZ(Math.PI / 2);
  return { shaft, head, fl, fl2 };
})();
function makeArrow(o = {}) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: o.shaft ?? 0x8a6a40, roughness: .7 });
  const tip = new THREE.MeshBasicMaterial({ color: o.tip ?? C(1.3, 1.3, 1.25) });
  const feather = new THREE.MeshBasicMaterial({ color: o.feather ?? C(.9, .85, .75), side: THREE.DoubleSide });
  g.add(new THREE.Mesh(ARROW_GEO.shaft, wood), new THREE.Mesh(ARROW_GEO.head, tip), new THREE.Mesh(ARROW_GEO.fl, feather), new THREE.Mesh(ARROW_GEO.fl2, feather));
  if (o.glow) { const s = glow(o.glow, o.glowSize ?? .45); scene.remove(s); s.position.z = .5; g.add(s); }
  g.scale.setScalar(o.scale ?? 1); scene.add(g); return g;
}
/* the shoot sheet draws the bow on screen-right for rows S..N (side image faces east) and screen-left for NW..SW; grip ≈ 26px out, 46px up */
const BOW_SIDE = [1, 1, 1, 1, 1, -1, -1, -1], _camR = V(), _camF = V();
const bowPos = () => { _camR.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); camera.getWorldDirection(_camF);
  return hero.pos.clone().add(V(0, .98, 0)).addScaledVector(_camR, BOW_SIDE[hero.row] * .56).addScaledVector(_camF, -.15); };
/* fly an arrow: straight (pierce) or along a shallow arc to a point; o.trail colour, o.onHit(g) per ghost touched, o.onEnd(p) */
function flyArrow(from, to, o = {}) {
  const a = makeArrow(o), speed = o.speed ?? 16, dir = to.clone().sub(from), dist = dir.length(); dir.normalize();
  const end = o.pierce ? from.clone().addScaledVector(dir, o.range ?? 7) : to.clone(), total = end.distanceTo(from), dur = total / speed, h = o.arc ?? Math.min(.6, total * .06);
  const hit = new Set(); let prev = from.clone();
  a.position.copy(from);
  addTask((dt, t) => {
    const u = clamp01(t / dur), p = arcPoint(from, end, h, u);
    a.position.copy(p); const look = p.clone().add(p.clone().sub(prev).normalize()); if (p.distanceTo(prev) > 1e-4) a.lookAt(look); prev = p.clone();
    if (o.spin) a.rotateZ(t * o.spin);
    const tr = o.trail || C(1.4, 1.3, 1);
    for (let k = 0; k < (o.trailN ?? 2); k++) emit({ p: p.clone().add(V(rand(-.03, .03), rand(-.03, .03), rand(-.03, .03))), c: tr, life: o.trailLife ?? .25, size: o.trailSize ?? .1, size1: .01 });
    o.onFly && o.onFly(p, t, dir);
    livingGhosts().forEach(g => { if (hit.has(g) || (!o.pierce && g !== o.target)) return; if (V(g.pos.x, p.y, g.pos.z).distanceTo(p) < (o.hitR ?? .6) && Math.abs(p.y - 1) < 1.2) { hit.add(g); o.onHit && o.onHit(g, p.clone(), dir); } });
    if (u >= 1) {
      if (!o.pierce && o.target && !hit.has(o.target) && o.target.alive) o.onHit && o.onHit(o.target, p.clone(), dir);
      o.onEnd && o.onEnd(p.clone(), dir);
      if (o.stick) { addTask((d2, t2) => { if (t2 > (o.stickFor ?? 1.2)) { kill(a); return false; } }); } else kill(a);
      return false;
    }
  });
  return a;
}
function shoot(fps = 18, release, rel = 4) { play(hero, 'shoot', { fps, once: () => play(hero, 'idle') }); after(rel / fps, release); }
function feathers(p, n, col = C(.95, .9, .8)) { burst(p, n, { c: col, size: .14, sp: 2, upMin: .3, life: 1.1, shape: SH.leaf, grav: 1.2, drag: 2 }); }
const emojiTex = (ch, tint) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.font = '190px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 140);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); };
const hawkTex = emojiTex('🦅', 'rgba(255,200,90,.6)');

/* =================== SKILLS =================== */

/* 1 · ศรฉับไว — two arrows nocked together, a quick release with white wind streaks */
function skQuick() {
  const tg = nearestGhost(); face(hero, tg.pos);
  shoot(22, () => {
    [-1, 1].forEach((s, i) => after(i * .04, () => {
      const side = V(-(tg.pos.z - hero.pos.z), 0, tg.pos.x - hero.pos.x).normalize().multiplyScalar(s * .25);
      flyArrow(bowPos(), chest(tg).add(side), { target: tg, speed: 20, trail: C(1.6, 1.6, 1.5), trailN: 3,
        onHit: (g, p) => { hurt(g, 120); sparks(p, 10, [WHITE, C(2, 1.6, .8)]); feathers(p, 3); } });
    }));
    shock(hero.pos.x, hero.pos.z, .9, C(1.3, 1.3, 1.2), C(.6, .6, .6), .3);
  });
  return 1.6;
}

/* 2 · ศรพิษพรานไพร — a venom-dipped arrow drips green, bursts into a toxic cloud, five poison ticks */
function skPoison() {
  const tg = nearestGhost(); face(hero, tg.pos);
  shoot(18, () => flyArrow(bowPos(), chest(tg), { target: tg, speed: 14, tip: C(.4, 1.6, .3), glow: C(.4, 1.5, .3), glowSize: .5, trail: C(.5, 1.4, .25), trailN: 2,
    onFly: p => { if (Math.random() < .6) emit({ p: p.clone(), v: V(0, -.4, 0), c: C(.45, 1.2, .2), life: .6, size: .06, grav: 4 }); },
    onHit: (g, p) => {
      hurt(g, 110); flash(p, 0x8de05a, 25, .4);
      burst(p, 20, { c: [C(.25, .55, .12), C(.35, .25, .4)], S: PN, size: .5, size1: 1.2, sp: 1.6, upMin: .2, life: 1.6, shape: SH.soft, a: .6, drag: 2 });
      popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ติดพิษ', 'st');
      let n = 0;
      addTask((dt, t) => {
        if (Math.random() < dt * 14) emit({ p: chest(g).add(V(rand(-.35, .35), rand(-.3, .6), rand(-.3, .3))), v: V(0, rand(.5, 1), 0), c: Math.random() < .7 ? C(.5, 1.4, .2) : C(.9, .4, 1.2), life: .7, size: rand(.06, .12) });
        if (Math.random() < dt * 3) emit({ p: chest(g).add(V(rand(-.3, .3), .2, 0)), v: V(0, .5, 0), c: C(.3, .5, .15), life: 1.2, size: .4, size1: .8, shape: SH.soft, a: .4 }, PN);
        if (t > .7 * (n + 1) && n < 5) { n++; if (g.alive) { g.hp -= 38; popup(headP(g), '38', 'hurt'); g.tint = .7; g.tintC = C(.6, 1.1, .4); if (g.hp <= 0) ghostDie(g); } }
        if (t > 3.6) return false;
      });
    } }));
  return 2.2;
}

/* 3 · ศรทะลวงเกราะ — the bow drinks light, spiral rings tighten on the tip, then a heavy drill-arrow tears through the whole line */
function skPierce() {
  const tg = nearestGhost(); face(hero, tg.pos); const dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
  play(hero, 'shoot', { fps: 12 }); addTask((dt, t) => { if (hero.frame > 3) hero.frame = 3; if (t > .55) return false; });
  const tip = () => bowPos().addScaledVector(dir, .1);
  addTask((dt, t) => { for (let k = 0; k < 3; k++) { const a = t * 12 + k * 2.09, r = .7 * (1 - t / .55); emit({ p: tip().add(V(Math.cos(a) * r, Math.sin(a) * r, 0)), c: C(1.6, 1.2, .5), life: .12, size: .1 }); } if (t > .55) return false; });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 6, 32), new THREE.MeshBasicMaterial({ color: C(2, 1.5, .6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(ring); addTask((dt, t) => { ring.position.copy(tip()); ring.lookAt(tip().add(dir)); ring.scale.setScalar(Math.max(.05, 1.4 - t * 2.4)); ring.material.opacity = Math.min(1, t * 4); if (t > .55) { kill(ring); return false; } });
  after(.55, () => {
    play(hero, 'shoot', { fps: 20, from: 4, once: () => play(hero, 'idle') }); shake = .15; flash(tip(), 0xffd080, 35, .4);
    const hit = new Set(); let ringT = 0;
    flyArrow(tip(), tip().addScaledVector(dir, 1), { pierce: true, range: 8, speed: 22, scale: 1.8, tip: C(2, 1.6, .7), glow: C(2, 1.4, .5), glowSize: .9, trail: C(2, 1.4, .5), trailN: 4, trailSize: .16, arc: 0, spin: 20, hitR: .8,
      onFly: (p, t) => { ringT -= .016; if (ringT <= 0) { ringT = .06; const r = new THREE.Mesh(new THREE.TorusGeometry(.35, .03, 6, 28), new THREE.MeshBasicMaterial({ color: C(1.8, 1.3, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        r.position.copy(p); r.lookAt(p.clone().add(dir)); scene.add(r); addTask((d2, t2) => { r.scale.setScalar(1 + t2 * 3); r.material.opacity = 1 - t2 / .35; if (t2 > .35) { kill(r); return false; } }); } },
      onHit: (g, p) => { hurt(g, 340, true, .6); sparks(p, 18); popup(V(g.pos.x, g.barY + .7, g.pos.z), 'เกราะแตก −35%', 'st');
        burst(p, 16, { c: [C(.7, .75, .85), C(1.2, 1.25, 1.4)], size: .1, sp: 3.5, upMin: .3, life: .9, grav: 7, shape: SH.star, drag: .5 }); } });
  });
  return 2.2;
}

/* 4 · ตาเหยี่ยว — a spectral hawk circles and dives into the hunter; a golden eye opens overhead and every ghost is marked with a reticle */
const eyeTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.moveTo(16, 64); g.quadraticCurveTo(128, -12, 240, 64); g.quadraticCurveTo(128, 140, 16, 64); g.stroke();
  g.beginPath(); g.arc(128, 64, 28, 0, 7); g.lineWidth = 6; g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 64, 11, 0, 7); g.fill();
  g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(128 + i * 36, 22 - Math.abs(i) * 4); g.lineTo(128 + i * 44, 4 - Math.abs(i) * 2); g.stroke(); }
  return new THREE.CanvasTexture(c); })();
const reticleTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.beginPath(); g.arc(64, 64, 44, 0, 7); g.stroke(); g.lineWidth = 4; [[64, 6, 64, 30], [64, 98, 64, 122], [6, 64, 30, 64], [98, 64, 122, 64]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); });
  g.beginPath(); g.arc(64, 64, 5, 0, 7); g.fillStyle = '#fff'; g.fill(); return new THREE.CanvasTexture(c); })();
function skHawk() {
  face(hero, nearestGhost().pos);
  const hawk = new THREE.Sprite(new THREE.SpriteMaterial({ map: hawkTex, color: C(1.8, 1.4, .7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); scene.add(hawk);
  const P = hero.pos.clone();
  addTask((dt, t) => {
    const u = clamp01(t / 1.1);
    if (u < .7) { const a = t * 5.5; hawk.position.set(P.x + Math.cos(a) * 2.2 * (1 - u * .6), 3.2 - u * 1.2, P.z + Math.sin(a) * 1.4 * (1 - u * .6)); hawk.material.rotation = Math.sin(a) * .4; }
    else { const v = (u - .7) / .3; hawk.position.lerp(chest(hero), v * .5); }
    hawk.scale.setScalar(1.3 - u * .5); hawk.material.opacity = Math.min(1, t * 3) * (1 - Math.max(0, (u - .85) / .15));
    if (Math.random() < .6) emit({ p: hawk.position.clone().add(V(rand(-.3, .3), rand(-.2, .2), 0)), c: GOLD_SOFT, life: .5, size: .1, size1: .02 });
    if (u >= 1) { kill(hawk); dive(); return false; }
  });
  function dive() {
    flash(P, 0xffd070, 40, .5); shock(P.x, P.z, 1.6, GOLD, C(1, .6, .2), .45); feathers(chest(hero), 14, C(1.4, 1.1, .6));
    popup(V(P.x, hero.barY + .7, P.z), 'โจมตี +30% · คริ +30%', 'st'); hero.tint = 1; hero.tintC = C(1.2, 1.05, .6);
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: C(2.2, 1.7, .6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); scene.add(eye);
    const marks = livingGhosts().map(g => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTex, color: C(2.2, 1.4, .4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); scene.add(s); return { g, s }; });
    addTask((dt, t) => {
      const live = clamp01((3.2 - t) / .5);
      eye.position.copy(hero.pos).setY(hero.barY + .75); eye.scale.set(.9, .45 * clamp01(t * 3), 1); eye.material.opacity = live;
      marks.forEach(({ g, s }, i) => { const u = clamp01((t - i * .1) / .4); s.position.copy(chest(g)); s.scale.setScalar(.6 + (1 - u) * 1.6); s.material.rotation = t * 1.5; s.material.opacity = u * live * (g.alive ? 1 : 0); });
      if (Math.random() < dt * 8 * live) emit({ p: hero.pos.clone().add(V(rand(-.5, .5), rand(.2, 1.6), rand(-.3, .3))), v: V(0, .6, 0), c: GOLD, life: .6, size: .07, shape: SH.star });
      if (t > 3.2) { kill(eye); marks.forEach(m => kill(m.s)); return false; }
    });
  }
  return 3.4;
}

/* 5 · ห่าฝนธนู — a volley goes up; a marked circle; five waves of arrows rain down and stick in the ground */
function skRain() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), P = gc.clone(); P.y = 0; const R = 2.4;
  face(hero, P);
  shoot(16, () => { for (let k = 0; k < 7; k++) flyArrow(bowPos(), bowPos().add(V(rand(-.6, .6), 6, rand(-.6, .6) - 1.5)), { speed: 18, arc: 0, trail: C(1.4, 1.3, 1) }); });
  const mark = decal(1, P.x, P.z, R, C(1.4, 1.1, .5), null, { life: 2.6, grow: .3 });
  for (let w = 0; w < 5; w++) after(.55 + w * .2, () => {
    for (let k = 0; k < 13; k++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R, land = V(P.x + Math.cos(a) * r, .05, P.z + Math.sin(a) * r);
      after(rand(0, .12), () => flyArrow(land.clone().add(V(-1.2, 7, 1.6)), land, { speed: 22, arc: 0, trail: C(1.2, 1.1, .9), trailN: 1, stick: true, stickFor: 1.1,
        onEnd: (p) => { if (Math.random() < .5) emit({ p: p.clone(), v: V(rand(-.3, .3), .6, rand(-.3, .3)), c: DUST, life: .5, size: .2, size1: .45, shape: SH.soft, a: .5 }, PN); } }));
    }
    after(.32, () => { livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 125, w === 4, .15); sparks(chest(g), 6); }); shock(P.x, P.z, R, C(1.2, 1.1, .7), C(.5, .4, .3), .3); shake = .05; });
  });
  return 2.8;
}

/* 6 · ลมใต้ปีกครุฑ — giant golden Garuda wings unfold behind the hunter and sweep the party with a feather wind */
const featherTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(.6, 'rgba(255,180,60,.9)'); gr.addColorStop(1, 'rgba(200,60,20,.0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(64, 80, 40, 256); g.lineTo(24, 256); g.quadraticCurveTo(0, 80, 32, 0); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 250); g.stroke();
  return new THREE.CanvasTexture(c); })();
function skGaruda() {
  face(hero, nearestGhost().pos);
  const G = new THREE.Group(); scene.add(G); const feathersArr = [];
  const mat = new THREE.MeshBasicMaterial({ map: featherTex, color: C(1.5, 1.2, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  [-1, 1].forEach(s => { for (let i = 0; i < 11; i++) { const piv = new THREE.Group(); const m = new THREE.Mesh(new THREE.PlaneGeometry(.38, 1.9 - Math.abs(i - 4) * .08), mat); m.position.y = .95; piv.add(m); G.add(piv); feathersArr.push({ piv, s, i }); } });
  const R = 5.5;
  addTask((dt, t) => {
    const open = easeOutBack(clamp01(t / .7)), flap = Math.sin(t * 4) * .08 * clamp01(t - .7), live = clamp01((3.4 - t) / .5);
    G.position.copy(hero.pos).add(V(0, 1.25, -.25)); G.scale.setScalar(1.3);
    feathersArr.forEach(({ piv, s, i }) => { piv.rotation.set(0, 0, -s * (.25 + open * (.25 + i * .12) + flap)); });
    mat.opacity = live * clamp01(t * 3);
    if (t > .4 && Math.random() < dt * 30 * live) { const a = rand(0, 6.28); emit({ p: G.position.clone().add(V(rand(-2.5, 2.5), rand(-.3, 1.2), rand(-.3, .3))), v: V(Math.cos(a) * 1.5, rand(-.2, .4), Math.sin(a) * 1.5 + 1), c: Math.random() < .5 ? C(1.6, 1.2, .5) : C(1.2, .6, .25), life: 1.6, size: .18, shape: SH.leaf, vr: rand(-5, 5), drag: .8, grav: .4 }); }
    if (t > 3.4) { kill(G); return false; }
  });
  after(.6, () => {
    shake = .12; flash(hero.pos, 0xffc060, 40, .6); shock(hero.pos.x, hero.pos.z, R, GOLD_SOFT, C(1, .5, .2), .8);
    popup(V(hero.pos.x, 3.6, hero.pos.z), 'ปีกครุฑ!', 'st big');
    living().filter(a => a.pos.distanceTo(hero.pos) <= R + .5).forEach((a, i) => after(.1 + i * .08, () => {
      heal(a, a.maxHp * .08); after(.25, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'คริ +15% · โจมตี +10% · เร็ว +8%', 'st'));
      for (let k = 0; k < 10; k++) emit({ p: hero.pos.clone().add(V(rand(-1, 1), 1.6, rand(-.5, .5))), v: V(0, 1, 0), c: GOLD, life: 1.6, size: .15, shape: SH.leaf, home: chest(a), homeK: 3, swirl: 2.5, vr: 4 });
    }));
  });
  return 3.6;
}

/* 7 · ศรกระจายเจ็ดดาว — five star-tipped arrows fan out; each trails starlight and bursts into a star */
function skVolley() {
  const tg = nearestGhost(); face(hero, tg.pos); const base = Math.atan2(tg.pos.x - hero.pos.x, tg.pos.z - hero.pos.z);
  shoot(18, () => {
    for (let k = 0; k < 5; k++) { const a = base + (k - 2) * (8.5 * Math.PI / 180);
      const dir = V(Math.sin(a), 0, Math.cos(a)); const from = bowPos();
      flyArrow(from, from.clone().addScaledVector(dir, 1), { pierce: true, range: 7, speed: 17, tip: C(2, 2, 1.4), glow: C(1.6, 1.5, 2.2), glowSize: .4, trail: Math.random() < .5 ? C(1.2, 1.2, 2.2) : C(2, 1.8, 1), trailN: 3,
        onFly: p => { if (Math.random() < .5) emit({ p: p.clone().add(V(rand(-.15, .15), rand(-.15, .15), rand(-.15, .15))), c: C(2, 2, 2.4), life: .4, size: .12, shape: SH.star }); },
        onHit: (g, p) => { hurt(g, 110); burst(p, 14, { c: [C(2, 2, 2.4), C(1.4, 1.3, 2.4)], size: .16, sp: 3, life: .45, shape: SH.star, drag: 4 }); } }); }
    flash(bowPos(), 0xc0d0ff, 20, .3);
  });
  return 1.8;
}

/* 8 · กับดักหนามพราน — a spiked iron trap spins through the air, lands under the ghosts and snaps shut */
function trapMesh() {
  const g = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x5a5550, metalness: .8, roughness: .45 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .06, 8, 28), iron); ring.rotation.x = Math.PI / 2; g.add(ring);
  const teeth = new THREE.Group(); g.add(teeth);
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28, t = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 5), iron); const piv = new THREE.Group(); piv.position.set(Math.cos(a) * .52, 0, Math.sin(a) * .52); piv.rotation.y = -a; t.position.y = .15; piv.add(t); teeth.add(piv); }
  g.userData.teeth = teeth; scene.add(g); return g;
}
function skTrap() {
  const tg = nearestGhost(), P = tg.pos.clone(); P.y = 0; const R = 1.8; face(hero, P);
  shoot(16, () => {
    const trap = trapMesh(), from = bowPos(); trap.scale.setScalar(.6);
    addTask((dt, t) => {
      const u = clamp01(t / .5); trap.position.copy(arcPoint(from, P.clone().setY(.05), 1.8, u)); trap.rotation.y += dt * 18; trap.rotation.x = (1 - u) * 1.2;
      if (u < 1) return;
      trap.rotation.x = 0; trap.scale.setScalar(1.5); snap(trap); return false;
    });
  }, 3);
  function snap(trap) {
    shake = .14; flash(P, 0xd0c0a0, 30, .4); shock(P.x, P.z, R, C(1.3, 1.2, 1), C(.6, .5, .4), .45);
    burst(P.clone().setY(.15), 20, { c: [DUST, C(.36, .3, .2)], S: PN, size: .4, size1: 1, sp: 2.4, upMin: .2, upMax: .5, life: .9, shape: SH.soft, a: .7, drag: 2.5 });
    const net = decal(4, P.x, P.z, R, C(1, .85, .5), C(.5, .4, .25), { auto: false, alpha: .7 });
    addTask((dt, t) => { trap.userData.teeth.children.forEach(p => p.rotation.z = -Math.min(1, t * 8) * .9); net.u.uAlpha.value = .7 * clamp01((1.8 - t) / .4);
      if (t > 1.8) { trap.position.y -= dt; } if (t > 2.3) { kill(trap); net.auto = true; net.t = 99; return false; } });
    livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 240, false, .1); stunStars(g, 1.6); sparks(chest(g), 10);
      popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ติดกับ 1.6 วิ · ช้า 40%', 'st'); });
  }
  return 2.6;
}

/* 9 · ศรสังหารเหยี่ยวราตรี — the world dims, a red sight-line locks on, the reticle tightens, then one arrow cracks the air with sonic rings */
function skSnipe() {
  const tg = livingGhosts().sort((a, b) => b.pos.distanceTo(hero.pos) - a.pos.distanceTo(hero.pos))[0] || ghosts[0]; face(hero, tg.pos);
  const dark = $('dim'); dark.style.opacity = '.32';
  play(hero, 'shoot', { fps: 10 }); addTask((dt, t) => { if (hero.frame > 3) hero.frame = 3; if (t > 1.1) return false; });
  const line = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: C(2.4, .2, .2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(line);
  const ret = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTex, color: C(2.4, .4, .3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); scene.add(ret);
  addTask((dt, t) => {
    const a = bowPos(), b = chest(tg), len = a.distanceTo(b); line.position.copy(a).add(b).multiplyScalar(.5); line.scale.set(1, len, 1); line.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    line.material.opacity = (.5 + .5 * Math.sin(t * 40)) * Math.min(1, t * 3);
    const u = clamp01(t / 1.1); ret.position.copy(b); ret.scale.setScalar(2.4 - u * 1.7); ret.material.rotation = t * 2; ret.material.opacity = Math.min(1, t * 3);
    if (t > 1.1) { kill(line); kill(ret); return false; }
  });
  after(1.1, () => {
    play(hero, 'shoot', { fps: 24, from: 4, once: () => play(hero, 'idle') }); dark.style.opacity = '0'; shake = .25; flash(bowPos(), 0xffffff, 40, .3);
    let ringT = 0;
    flyArrow(bowPos(), chest(tg), { target: tg, speed: 40, arc: 0, scale: 1.4, tip: C(2.4, 2.4, 2.6), glow: C(2, 2, 2.4), glowSize: .7, trail: C(2.2, 2.2, 2.4), trailN: 5, trailLife: .5, trailSize: .14,
      onFly: (p, t, dir) => { ringT -= .016; if (ringT <= 0) { ringT = .03; const r = new THREE.Mesh(new THREE.TorusGeometry(.3, .02, 6, 24), new THREE.MeshBasicMaterial({ color: C(1.6, 1.7, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        r.position.copy(p); r.lookAt(p.clone().add(dir)); scene.add(r); addTask((d2, t2) => { r.scale.setScalar(1 + t2 * 5); r.material.opacity = .8 - t2 / .4 * .8; if (t2 > .4) { kill(r); return false; } }); } },
      onHit: (g, p) => { hurt(g, 1100, true, .9); flash(p, 0xffffff, 80, .5); shake = .35; shock(g.pos.x, g.pos.z, 2.2, WHITE, C(1, .3, .3), .5);
        burst(p, 40, { c: [WHITE, C(2.4, .5, .4)], size: .14, sp: 6, life: .5, shape: SH.star, drag: 3 }); popup(V(g.pos.x, g.barY + 1, g.pos.z), 'สังหาร!', 'st big'); } });
  });
  return 2.6;
}

/* 10 · ศรเพลิงอัคนีบาต — a fire arrow streaks into the sky; the clouds glow and five waves of flaming arrows rain down, cratering the ground */
function skMeteor() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), P = gc.clone(); P.y = 0; const R = 3;
  face(hero, P);
  shoot(14, () => { flyArrow(bowPos(), bowPos().add(V(0, 9, -2)), { speed: 20, arc: 0, scale: 1.4, tip: C(2.6, 1.4, .3), glow: EMBER, glowSize: .8, trail: FIRE, trailN: 4, trailLife: .5 }); flash(bowPos(), 0xff8030, 35, .4); });
  const sky = glow(C(1.6, .5, .15), 9); sky.position.set(P.x, 7, P.z); sky.material.opacity = 0;
  addTask((dt, t) => { sky.material.opacity = clamp01((t - .4) * 2) * clamp01((2.6 - t) / .5) * .7; if (t > 2.6) { kill(sky); return false; } });
  const mark = decal(1, P.x, P.z, R, C(2, .7, .2), null, { life: 2.8, grow: .3 });
  for (let w = 0; w < 5; w++) after(.7 + w * .24, () => {
    for (let k = 0; k < 6; k++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R, land = V(P.x + Math.cos(a) * r, .05, P.z + Math.sin(a) * r);
      after(rand(0, .15), () => flyArrow(land.clone().add(V(-1.5, 8, 2)), land, { speed: 20, arc: 0, scale: 1.3, tip: C(2.6, 1.4, .3), glow: EMBER, glowSize: 1, trail: Math.random() < .5 ? FIRE : EMBER, trailN: 4, trailSize: .2, trailLife: .4,
        onEnd: (p) => {
          shock(p.x, p.z, .9, C(2.6, 1.2, .3), FIRE, .35);
          burst(p.clone().setY(.2), 10, { c: [EMBER, FIRE, C(2.6, 2, .8)], size: .14, sp: 3, upMin: .4, life: .5, drag: 3 });
          if (Math.random() < .5) emit({ p: p.clone().setY(.3), v: V(0, .8, 0), c: C(.25, .2, .18), life: 1, size: .5, size1: 1.1, shape: SH.soft, a: .6 }, PN);
        } }));
    }
    after(.4, () => { flash(P, 0xff7020, 30, .3); livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 175, w === 4, .2); sparks(chest(g), 6, [EMBER, WHITE]); }); shake = .08; });
  });
  return 3.4;
}

/* ---------------- skill catalogue (numbers from shared/data/skills.js) ---------------- */
const SKILLS = [
  { id: 'arch_quick', name: 'ศรฉับไว', lv: 1, run: skQuick, meta: ['MP 4', 'CD 1.8 วิ', 'ระยะ 280', '2 ดอก'],
    desc: 'ยิงเร็ว 2 ดอกพร้อมกัน',
    layers: ['ปล่อยสายตรงเฟรมที่สไปรต์ปล่อยลูกธนู', 'ลูกธนูสามมิติ 2 ดอกเยื้องกัน', 'หางลมสีขาว', 'โดน: ประกาย + ขนนกปลิว'] },
  { id: 'arch_poison', name: 'ศรพิษพรานไพร', lv: 2, run: skPoison, meta: ['MP 8', 'CD 5 วิ', 'พิษ 5 ครั้ง'],
    desc: 'ศรอาบพิษ ดาเมจต่อเนื่อง 5 ครั้ง',
    layers: ['หัวศรเรืองเขียว หยดพิษตามทาง', 'โดน: หมอกพิษเขียวม่วง', 'ฟองพิษลอยจากตัวผี + ตัวเลขพิษ 5 ติ๊ก'] },
  { id: 'arch_pierce', name: 'ศรทะลวงเกราะ', lv: 4, run: skPierce, meta: ['MP 10', 'CD 6 วิ', 'ระยะ 330', 'ทะลุ'],
    desc: 'ศรพลังสูงทะลุทุกตัว เจาะจนเกราะแตก (DEF −35%) ไป 6 วิ',
    layers: ['ง้างค้าง แสงเกลียววนเข้าหัวศร + วงแหวนหดเข้า', 'ศรใหญ่หมุนเหมือนสว่าน ทิ้งวงแหวนตามทาง', 'ทะลุผีทุกตัวในแนว', 'เศษเกราะแตกกระจาย'] },
  { id: 'arch_hawk', name: 'ตาเหยี่ยว', lv: 6, run: skHawk, meta: ['MP 14', 'CD 20 วิ', 'บัฟ 10 วิ'],
    desc: 'โจมตี +30% คริ +30% นาน 10 วิ',
    layers: ['วิญญาณเหยี่ยวทองบินวนแล้วพุ่งเข้าตัว', 'ตาทองลืมเหนือหัวระหว่างบัฟ', 'เป้าเล็งหมุนบนผีทุกตัว', 'ขนนกทอง + ประกาย'] },
  { id: 'arch_rain', name: 'ห่าฝนธนู', lv: 8, run: skRain, meta: ['MP 26', 'CD 18 วิ', 'วง 90', '5 ระลอก', 'อัลติ'],
    desc: '★ ธนูตกเป็นห่าฝน 5 ระลอก',
    layers: ['ยิงศร 7 ดอกขึ้นฟ้า', 'วงเล็งบนพื้น', 'ลูกธนูตกเฉียง 5 ระลอก ระลอกละ 13 ดอก', 'ลูกธนูปักพื้นค้างแล้วหายไป + ฝุ่น'] },
  { id: 'arch_garuda', name: 'ลมใต้ปีกครุฑ', lv: 10, run: skGaruda, meta: ['MP 24', 'CD 26 วิ', 'รัศมี 220', 'บัฟ 12 วิ'],
    desc: '[ปาร์ตี้] ปีกครุฑโอบปาร์ตี้ คริ +15% โจมตี +10% ตีเร็วขึ้น 8% ทั้งปาร์ตี้ 12 วิ',
    layers: ['ปีกครุฑทองคู่ใหญ่กางจากหลัง (ขน 22 เส้น)', 'ปีกขยับกระพือช้า ๆ', 'ขนนกปลิวทั่วลาน', 'ขนทองบินวนเข้าเพื่อนแต่ละคน'] },
  { id: 'arch_volley', name: 'ศรกระจายเจ็ดดาว', lv: 20, adv: true, run: skVolley, meta: ['MP 16', 'CD 7 วิ', '5 ดอก', 'แผ่ 34°'],
    desc: 'ยิงศร 5 ดอกแผ่เป็นพัด โดนได้หลายตัวด้านหน้า',
    layers: ['ศร 5 ดอกแผ่เป็นพัด', 'หัวศรเรืองแสงดาว หางแสงดาวระยิบ', 'โดน: ระเบิดเป็นประกายดาว'] },
  { id: 'arch_trap', name: 'กับดักหนามพราน', lv: 40, adv: true, run: skTrap, meta: ['MP 20', 'CD 12 วิ', 'วง 72', 'ติดกับ 1.6 วิ'],
    desc: 'ปากับดักหนามลงใต้เป้า ผีในวงติดกับ 1.6 วิ หลุดแล้วยังเดินช้าลง 40% อีก 3 วิ',
    layers: ['กับดักเหล็กหมุนลอยโค้งลงใต้ผี', 'ฟันเหล็ก 14 ซี่งับเข้า', 'ฝุ่น + วงยันต์ตาข่าย', 'ดาวมึนเหนือหัวผี'] },
  { id: 'arch_snipe', name: 'ศรสังหารเหยี่ยวราตรี', lv: 70, adv: true, run: skSnipe, meta: ['MP 32', 'CD 14 วิ', 'ระยะ 380', '×6.2'],
    desc: 'เล็งนานแล้วยิงศรเดียวไกลมาก แรงมาก (เป้าเดียว)',
    layers: ['จอมืดลง เส้นเล็งแดงกะพริบ', 'เป้าเล็งหดเข้าหาผีตัวไกลสุด', 'ปล่อยศรเร็วมาก ทิ้งวงคลื่นเสียง', 'โดน: แสงขาวจ้า + ดาเมจก้อนใหญ่'] },
  { id: 'arch_meteor', name: 'ศรเพลิงอัคนีบาต', lv: 100, adv: true, run: skMeteor, meta: ['MP 46', 'CD 20 วิ', 'วง 120', '5 ระลอก'],
    desc: 'ยิงศรเพลิงขึ้นฟ้า ตกเป็นห่าลูกไฟ 5 ระลอกในวงกว้าง',
    layers: ['ศรเพลิงพุ่งขึ้นฟ้า ท้องฟ้าเหนือวงเรืองแดง', 'ศรไฟตกเฉียง 5 ระลอก', 'ทุกดอก: วงกระแทก + ไฟแตก + ควัน', 'วงเล็งไฟบนพื้น'] },
];
const SEP_AT = 6;
