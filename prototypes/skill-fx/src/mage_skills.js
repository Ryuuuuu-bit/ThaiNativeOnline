/* ---------------- หมอผี helpers ---------------- */
/* cast sheet: staff tip points screen-left for rows SE..N and screen-right for S and NW..SW */
const TIP_SIDE = [1, -1, -1, -1, -1, 1, 1, 1], _cR = V(), _cF = V();
const staffTip = () => { _cR.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); camera.getWorldDirection(_cF);
  return hero.pos.clone().add(V(0, .9, 0)).addScaledVector(_cR, TIP_SIDE[hero.row] * .78).addScaledVector(_cF, -.15); };
function castAnim(fps = 16, release, rel = 3, sheet = 'cast') { play(hero, sheet, { fps, once: () => play(hero, 'idle') }); after(rel / fps, release); }
function tipFlash(c = C(1.6, .8, 2.2)) { const p = staffTip(); burst(p, 12, { c: [c, WHITE], size: .1, sp: 2.5, life: .35, shape: SH.star, drag: 4 }); flash(p, c.getHex(), 18, .3); }
/* yant talisman paper */
const yantPaperTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e8c766'; g.fillRect(0, 0, 64, 128); g.strokeStyle = '#a0281e'; g.lineWidth = 3; g.strokeRect(4, 4, 56, 120);
  g.lineWidth = 2.5; g.beginPath(); for (let a = 0; a < 12.5; a += .2) { const r = 2 + a * 1.1; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r * .9); } g.stroke();
  g.beginPath(); g.moveTo(32, 48); g.lineTo(32, 112); g.stroke();
  for (let y = 58; y < 112; y += 9) { g.beginPath(); g.moveTo(14, y); g.quadraticCurveTo(24, y - 6, 32, y); g.quadraticCurveTo(42, y + 6, 50, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function yantSheet(scale = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.32 * scale, .64 * scale), new THREE.MeshBasicMaterial({ map: yantPaperTex, color: C(1.3, 1.2, 1), side: THREE.DoubleSide, transparent: true }));
  const halo = glow(C(1.6, 1.2, .4), .9 * scale); scene.remove(halo); m.add(halo); halo.position.z = -.01; scene.add(m); return m; }
/* glyph ring decal for the shaman: reuse rune decal (type 4) */
function orb(color, size, core = WHITE) { const g = new THREE.Group(); const a = glow(color, size), b = glow(core, size * .4); scene.remove(a); scene.remove(b); g.add(a, b); scene.add(g); return g; }
function homing(from, target, o = {}) {
  const g = orb(o.color || C(2.2, .9, .3), o.size || .55, o.core); const side = o.curve ?? 0; let p = from.clone(), t0 = 0;
  const dur = o.dur || .6;
  addTask((dt, t) => {
    const to = target.alive ? chest(target) : (o.last || chest(target)); o.last = to;
    const u = clamp01(t / dur), mid = from.clone().lerp(to, .5).add(V(-(to.z - from.z), 0, to.x - from.x).normalize().multiplyScalar(side)).add(V(0, o.lift ?? .6, 0));
    const a = from.clone().lerp(mid, u), b = mid.clone().lerp(to, u); p = a.lerp(b, u); g.position.copy(p);
    for (let k = 0; k < (o.trailN ?? 2); k++) emit({ p: p.clone().add(V(rand(-.06, .06), rand(-.06, .06), rand(-.06, .06))), v: V(0, .4, 0), c: o.trail || o.color || C(2.2, .9, .3), life: o.trailLife ?? .35, size: o.trailSize ?? .16, size1: .02 });
    o.onFly && o.onFly(p, t);
    if (u >= 1) { kill(g); o.onHit && o.onHit(target, p.clone()); return false; }
  });
  return g;
}

/* =================== SKILLS =================== */

/* 1 · คาถาอาคม — three charm-fireballs curve in from different sides, orbited by tiny glyph sparks */
function skAkom() {
  const tg = nearestGhost(); face(hero, tg.pos);
  castAnim(18, () => { tipFlash(C(2.2, .9, .3));
    [-1.2, 0, 1.2].forEach((side, i) => after(i * .07, () => homing(staffTip(), tg, { curve: side, dur: .55, color: C(2.4, .9, .25), core: C(2.6, 2.2, 1.4), size: .5, trail: C(2, .55, .15),
      onFly: (p, t) => { const a = t * 25 + i * 2; emit({ p: p.clone().add(V(Math.cos(a) * .22, Math.sin(a) * .22, 0)), c: C(1.8, 1.2, 2.2), life: .2, size: .06, shape: SH.star }); },
      onHit: (g, p) => { hurt(g, 95); burst(p, 14, { c: [C(2.4, .9, .25), C(2.6, 2, .8)], size: .14, sp: 3, life: .45, drag: 3 }); shock(g.pos.x, g.pos.z, .9, C(2.2, .8, .2), C(1, .3, .1), .3); } })));
  });
  return 1.8;
}

/* 2 · ยันต์ตรึงวิญญาณ — three golden talismans spin through the line; each pierced ghost is wrapped by circling yant and pinned by spirit chains */
function chainBind(g, dur) {
  const links = [], N = 4;
  for (let k = 0; k < N; k++) { const a = k / N * 6.28 + .4, anchor = V(g.pos.x + Math.cos(a) * 1.2, .02, g.pos.z + Math.sin(a) * 1.2);
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C(1.4, 1.1, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(m); links.push({ m, anchor }); }
  const papers = [0, 1, 2].map(() => yantSheet(.8));
  addTask((dt, t) => {
    const live = clamp01((dur - t) / .3), grow = clamp01(t / .2);
    links.forEach(({ m, anchor }, k) => { const top = chest(g).add(V(0, -.1, 0)); const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12 * grow; const p = anchor.clone().lerp(top, u); p.y += Math.sin(u * Math.PI) * .3; p.x += Math.sin(u * 30 + t * 8 + k) * .03; pts.push(p); }
      m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .025, 4); m.material.opacity = live; });
    papers.forEach((s, i) => { const a = t * 3 + i * 2.09; s.position.set(g.pos.x + Math.cos(a) * .5, 1 + Math.sin(t * 4 + i) * .15, g.pos.z + Math.sin(a) * .5); s.lookAt(camera.position); s.material.opacity = live; });
    if (t > dur) { links.forEach(l => kill(l.m)); papers.forEach(kill); return false; }
  });
}
function skYant() {
  const tg = nearestGhost(), dir = tg.pos.clone().sub(hero.pos).setY(0).normalize(); face(hero, tg.pos);
  castAnim(16, () => { tipFlash(C(2, 1.6, .5));
    const hit = new Set();
    for (let i = 0; i < 3; i++) after(i * .08, () => {
      const s = yantSheet(1), from = staffTip(), RANGE = 5.5; let d = 0;
      addTask((dt, t) => {
        d += dt * 8; const side = V(-dir.z, 0, dir.x).multiplyScalar(Math.sin(t * 9 + i * 2) * .35); s.position.copy(from).addScaledVector(dir, d).add(side); s.rotation.set(t * 6, t * 9 + i, t * 4);
        emit({ p: s.position.clone(), c: C(1.8, 1.4, .5), life: .3, size: .12, size1: 0 });
        livingGhosts().forEach(g => { if (hit.has(g)) return; if (V(g.pos.x, s.position.y, g.pos.z).distanceTo(s.position) < .7) { hit.add(g); hurt(g, 170, false, .2); stunStars(g, 1.8); chainBind(g, 1.8); popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ตรึงวิญญาณ 1.8 วิ', 'st'); } });
        if (d > RANGE) { kill(s); return false; }
      });
    });
  });
  return 2.6;
}

/* 3 · เกราะยันต์เก้ายอด — nine talismans orbit, rise into a nine-spired yant crown and fold into a golden shell */
const nineYantTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 96, 0, 7); g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 - 1.57, x = 128 + Math.cos(a) * 60, y = 128 + Math.sin(a) * 60; g.save(); g.translate(x, y); g.rotate(a + 1.57);
    g.beginPath(); g.moveTo(0, -30); g.lineTo(9, 10); g.lineTo(-9, 10); g.closePath(); g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(0, 18, 5, 0, 7); g.stroke(); g.restore(); }
  g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 12; a += .2) { const r = 1 + a * 2.2; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke();
  return new THREE.CanvasTexture(c); })();
function skShield() {
  face(hero, nearestGhost().pos); castAnim(12, () => tipFlash(C(2, 1.6, .5)), 3, 'spell');
  const P = hero.pos.clone(), papers = Array.from({ length: 9 }, () => yantSheet(.9));
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: nineYantTex, color: C(2, 1.5, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(P.x, .05, P.z); scene.add(ring);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), fresnelMat(C(1.6, 1.2, .4))); shell.scale.set(.95, 1.35, .95); scene.add(shell);
  after(.9, () => { heal(hero, hero.maxHp * .25, 'heal big'); after(.25, () => popup(V(P.x, hero.barY + .7, P.z), 'ป้องกัน +24', 'st')); flash(P, 0xffd070, 40, .5); shock(P.x, P.z, 1.8, GOLD, C(1, .6, .2), .45); });
  addTask((dt, t) => {
    const live = clamp01((3.4 - t) / .5);
    papers.forEach((s, i) => { const a = i / 9 * 6.28 + t * (t < .9 ? 3 : 1); const r = t < .9 ? 1.3 : 1.3 - Math.min(1, (t - .9) * 3) * .35, y = t < .9 ? .4 + t * 1.2 : 1.5 + Math.sin(t * 2 + i) * .06;
      s.position.set(P.x + Math.cos(a) * r, y, P.z + Math.sin(a) * r); s.lookAt(P.x, y, P.z); s.material.opacity = live; });
    ring.rotation.z = t * .6; ring.material.opacity = clamp01(t * 3) * live; ring.scale.setScalar(.6 + easeOutBack(clamp01(t / .5)) * .4);
    shell.position.copy(P).setY(.95); shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = clamp01((t - .8) * 3) * live * .9;
    if (t > 3.4) { papers.forEach(kill); kill(ring); kill(shell); return false; }
  });
  return 3.4;
}

/* 4 · อัสนีบาต — a dark cloud knots above the nearest ghost and drops a violet-white bolt */
function skThunder() {
  const tg = nearestGhost(); face(hero, tg.pos);
  const cloud = []; for (let k = 0; k < 14; k++) cloud.push(emit({ p: V(tg.pos.x + rand(-1, 1), 4.4 + rand(-.3, .3), tg.pos.z + rand(-.7, .7)), v: V(rand(-.2, .2), 0, rand(-.2, .2)), c: C(.18, .16, .26), life: 1.4, size: rand(1, 1.6), size1: 2, shape: SH.soft, a: .8, swirl: .5 }, PN));
  castAnim(14, () => tipFlash(C(1.4, 1.2, 2.6)), 3, 'spell');
  after(.45, () => {
    const top = V(tg.pos.x, 4.4, tg.pos.z), bot = V(tg.pos.x, 0, tg.pos.z); bolt(top, bot, .45, .08); after(.05, () => bolt(top.clone().add(V(.4, 0, 0)), bot, .3, .04));
    flash(bot, 0xc9b4ff, 90, .5); shake = .25; shock(bot.x, bot.z, 1.8, C(1.6, 1.4, 2.8), C(.6, .4, 1.4), .45);
    burst(chest(tg), 30, { c: [C(1.6, 1.4, 2.8), WHITE], size: .12, sp: 5, life: .45, shape: SH.star, drag: 3 });
    hurt(tg, 420, true, .3); stunStars(tg, .7); popup(V(tg.pos.x, tg.barY + .7, tg.pos.z), 'สะดุ้ง', 'st');
  });
  return 1.8;
}

/* 5 · เพลิงกัลป์ปราบผี — the sky splits red; four waves of hell-fire meteors pound the ground ahead and set ghosts burning */
function skKalp() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), P = gc.clone(); P.y = 0; const R = 2.75; face(hero, P);
  castAnim(10, () => tipFlash(C(2.6, .8, .2)), 3, 'spell');
  const sky = glow(C(1.8, .4, .1), 10); sky.position.set(P.x, 7, P.z); sky.material.opacity = 0;
  const mark = decal(3, P.x, P.z, R, C(1.4, .4, .08), C(.6, .1, .02), { auto: false, alpha: .7 });
  addTask((dt, t) => { sky.material.opacity = clamp01(t * 2) * clamp01((2.8 - t) / .5) * .6; mark.u.uAlpha.value = .7 * clamp01(t * 3) * clamp01((2.8 - t) / .5); if (t > 2.8) { kill(sky); mark.auto = true; mark.t = 99; return false; } });
  for (let w = 0; w < 4; w++) after(.5 + w * .24, () => {
    for (let k = 0; k < 4; k++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R * .9, land = V(P.x + Math.cos(a) * r, .1, P.z + Math.sin(a) * r), from = land.clone().add(V(-2, 7, 1.5));
      const m = orb(C(2.6, .8, .2), 1.1, C(2.6, 2.2, 1.2)); let u0 = 0;
      addTask((dt, t) => { const u = clamp01(t / .32); m.position.copy(from).lerp(land, u * u);
        for (let q = 0; q < 3; q++) emit({ p: m.position.clone().add(V(rand(-.2, .2), rand(-.2, .2), rand(-.2, .2))), v: V(rand(-.3, .3), rand(.5, 1.2), rand(-.3, .3)), c: Math.random() < .5 ? FIRE : EMBER, life: .4, size: .3, size1: .05 });
        if (u >= 1) { kill(m); shock(land.x, land.z, 1.3, C(2.6, 1.2, .3), FIRE, .45); burst(land.clone().setY(.3), 18, { c: [EMBER, FIRE, C(2.6, 2, .8)], size: .16, sp: 4, upMin: .3, life: .6, drag: 3 });
          emit({ p: land.clone().setY(.4), v: V(0, .9, 0), c: C(.25, .2, .18), life: 1.2, size: .7, size1: 1.4, shape: SH.soft, a: .65 }, PN); return false; } });
    }
    after(.34, () => { flash(P, 0xff6020, 40, .35); shake = .12; livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 230, w === 3, .25); if (w === 0) burnOn(g); }); });
  });
  return 3;
}
function burnOn(g) { let n = 0; popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ไฟกัลป์ลุกไหม้', 'st');
  addTask((dt, t) => { for (let k = 0; k < 2; k++) emit({ p: g.pos.clone().add(V(rand(-.35, .35), rand(.1, 1.4), rand(-.2, .2))), v: V(0, rand(.8, 1.6), 0), c: Math.random() < .5 ? FIRE : EMBER, life: .45, size: .18, size1: .02 });
    if (t > .6 * (n + 1) && n < 4) { n++; if (g.alive) { g.hp -= 55; popup(headP(g), '55', 'hurt'); if (g.hp <= 0) ghostDie(g); } } if (t > 2.6) return false; }); }

/* 6 · น้ำมนต์ธาราทิพย์ — a celestial lotus blooms mid-party, holy water fountains up and sprinkles everyone */
function skHoly() {
  const center = centroid(party); face(hero, center); castAnim(12, () => tipFlash(C(1, 1.6, 2.2)), 3, 'spell');
  const L = lotus(C(.35, .6, .85), C(.9, .9, 1.15), 1.1); L.position.set(center.x, .05, center.z); L.scale.setScalar(.01);
  const pool = decal(5, center.x, center.z, 5.5, C(.22, .45, .7), null, { life: 3.2, grow: .8, alpha: .7 });
  addTask((dt, t) => {
    const u = clamp01(t / .6); L.userData.open(1 - Math.pow(1 - u, 3)); L.scale.setScalar(.2 + u * 1.1); L.rotation.y += dt * .6; L.userData.alpha(clamp01((3 - t) / .6));
    if (t > .5 && t < 1.6) for (let k = 0; k < 2; k++) emit({ p: V(center.x + rand(-.15, .15), .5, center.z + rand(-.15, .15)), v: V(rand(-1.4, 1.4), rand(4, 5.5), rand(-1.4, 1.4)), c: Math.random() < .6 ? C(.45, .95, 1.6) : C(1, 1.2, 1.4), life: 1.5, size: .1, grav: 6, drag: .3 });
    if (t > 3) { kill(L); return false; }
  });
  after(.9, () => living().forEach((a, i) => after(i * .1, () => { heal(a, a.maxHp * .25, 'heal big'); after(.2, () => popup(headP(a), '+MP 15%', 'mp')); after(.4, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'ป้องกัน +12', 'st'));
    burst(chest(a), 14, { c: [C(.6, 1.3, 2.2), WHITE], size: .1, sp: 2, upMin: .5, life: .8, shape: SH.star }); shock(a.pos.x, a.pos.z, 1, C(.6, 1.2, 2), C(.3, .6, 1), .4); })));
  return 3.2;
}

/* 7 · ไฟผีห้าทิศ — five green will-o'-wisps (ไฟกองกอย) wobble out in a fan, each with a flickering ghost face */
const wispFaceTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(22, 28, 6, 9, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(42, 28, 6, 9, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(32, 46, 7, 5, 0, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
function skGhostfire() {
  const tg = nearestGhost(); face(hero, tg.pos); const base = Math.atan2(tg.pos.x - hero.pos.x, tg.pos.z - hero.pos.z);
  castAnim(16, () => { tipFlash(C(.5, 2.2, 1.2));
    for (let k = 0; k < 5; k++) after(k * .05, () => {
      const a = base + (k - 2) * (9 * Math.PI / 180), dir = V(Math.sin(a), 0, Math.cos(a)), from = staffTip(), g = orb(C(.4, 2.2, 1.1), .7, C(1.6, 2.6, 2)), hit = new Set();
      const face2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispFaceTex, color: C(.05, .25, .12), transparent: true, depthWrite: false })); face2.scale.setScalar(.28); g.add(face2);
      let d = 0;
      addTask((dt, t) => { d += dt * 5.5; const p = from.clone().addScaledVector(dir, d).add(V(-dir.z, 0, dir.x).multiplyScalar(Math.sin(t * 10 + k) * .25)).add(V(0, Math.sin(t * 7 + k) * .15, 0)); g.position.copy(p);
        for (let q = 0; q < 3; q++) emit({ p: p.clone().add(V(rand(-.1, .1), rand(-.05, .1), rand(-.1, .1))), v: V(0, rand(.6, 1.2), 0), c: Math.random() < .6 ? C(.4, 2, 1) : C(.8, 2.4, 2), life: .4, size: .2, size1: .02 });
        livingGhosts().forEach(gh => { if (hit.has(gh)) return; if (V(gh.pos.x, p.y, gh.pos.z).distanceTo(p) < .7) { hit.add(gh); hurt(gh, 125); burst(p, 16, { c: [C(.4, 2.2, 1.1), WHITE], size: .14, sp: 3, life: .45, drag: 3 }); } });
        if (d > 5.75) { kill(g); return false; } });
    });
  });
  return 2;
}

/* 8 · คำสาปพรายตานี — a dark banana-leaf curse circle opens under the ghosts; shadow tendrils coil up and poison them */
function skCurse() {
  const tg = nearestGhost(), P = tg.pos.clone(); P.y = 0; const R = 2.25; face(hero, P);
  castAnim(12, () => tipFlash(C(.9, .3, 1.4)), 3, 'spell');
  const circle = decal(2, P.x, P.z, R, C(.7, .25, 1.1), C(.3, 1, .4), { auto: false });
  const tendrils = [];
  after(.35, () => {
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28, r = rand(.4, R * .9); tendrils.push({ base: V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r), h: rand(1.2, 2.2), ph: rand(0, 6), m: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C(.35, .08, .45), transparent: true })) }); }
    tendrils.forEach(t => scene.add(t.m)); flash(P, 0x9040c0, 30, .5); shake = .1;
    livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 150); popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ติดพิษพราย · ช้า 35%', 'st'); let n = 0;
      addTask((dt, t) => { if (Math.random() < dt * 10) emit({ p: chest(g).add(V(rand(-.3, .3), rand(-.3, .5), 0)), v: V(0, .7, 0), c: Math.random() < .5 ? C(.4, 1.4, .3) : C(.9, .3, 1.3), life: .6, size: .1 });
        if (t > .6 * (n + 1) && n < 6) { n++; if (g.alive) { g.hp -= 45; popup(headP(g), '45', 'hurt'); g.tint = .6; g.tintC = C(.7, .4, .9); if (g.hp <= 0) ghostDie(g); } } if (t > 3.8) return false; }); });
  });
  addTask((dt, t) => {
    const live = clamp01((3 - t) / .5); circle.u.uAlpha.value = clamp01(t * 3) * live; circle.m.scale.setScalar(R * easeOutBack(clamp01(t / .4)));
    tendrils.forEach(td => { const g = clamp01((t - .35) / .35); const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10 * g; pts.push(td.base.clone().add(V(Math.sin(u * 6 + t * 3 + td.ph) * .25 * u, u * td.h, Math.cos(u * 5 + t * 2.5 + td.ph) * .25 * u))); }
      td.m.geometry.dispose(); td.m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .06, 5); td.m.material.opacity = live * .9;
      if (Math.random() < .2) emit({ p: pts[pts.length - 1].clone(), v: V(0, .5, 0), c: C(.6, .2, .9), life: .5, size: .1 }); });
    if (Math.random() < dt * 12 * live) emit({ p: V(P.x + rand(-R, R) * .8, .1, P.z + rand(-R, R) * .8), v: V(0, rand(.4, .8), 0), c: C(.15, .05, .2), life: 1.2, size: .5, size1: 1, shape: SH.soft, a: .6 }, PN);
    if (t > 3) { tendrils.forEach(td => kill(td.m)); circle.auto = true; circle.t = 99; return false; }
  });
  return 3.2;
}

/* 9 · สมาธิกสิณไฟ — the shaman rises in meditation; a ring of kasina fire turns behind the head and flames spiral up */
function skMeditate() {
  face(hero, nearestGhost().pos); castAnim(8, () => tipFlash(C(2.6, 1.2, .3)), 2, 'spell');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 8, 40), new THREE.MeshBasicMaterial({ color: C(2.6, 1.1, .25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(ring);
  const disc = glow(C(1.6, .6, .15), 1.4);
  after(.6, () => { heal(hero, hero.maxHp * .1); after(.25, () => popup(V(hero.pos.x, hero.barY + .9, hero.pos.z), 'พลังเวทย์ +30% · คริ +10%', 'st')); flash(hero.pos, 0xff9030, 40, .5); shock(hero.pos.x, hero.pos.z, 1.6, EMBER, C(1, .3, .1), .45); });
  addTask((dt, t) => {
    const live = clamp01((3.4 - t) / .4), lift = Math.min(1, t * 2) * .35 * live;
    hero.off.y = lift + Math.sin(t * 2.5) * .05;
    const head = hero.pos.clone().add(V(0, 1.75 + hero.off.y, -.15)); ring.position.copy(head); ring.lookAt(camera.position); ring.scale.setScalar(easeOutBack(clamp01(t / .5)) * (1 + Math.sin(t * 6) * .04)); ring.material.opacity = live;
    disc.position.copy(head).add(V(0, 0, -.05)); disc.material.opacity = .5 * live;
    for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.09, h = (t * 1.2 + k * .33) % 1.8; emit({ p: hero.pos.clone().add(V(Math.cos(a + h * 2) * .55, h + hero.off.y, Math.sin(a + h * 2) * .4)), v: V(0, .4, 0), c: k ? EMBER : C(2.6, 1.8, .6), life: .45, size: .12, size1: .02 }); }
    for (let k = 0; k < 2; k++) { const a = rand(0, 6.28); emit({ p: head.clone().add(V(Math.cos(a) * .42, Math.sin(a) * .42, 0)), v: V(0, .5, 0), c: FIRE, life: .35, size: .12, size1: .02 }); }
    if (t > 3.4) { hero.off.y = 0; kill(ring); kill(disc); return false; }
  });
  return 3.6;
}

/* 10 · พายุอัสนีเทพ — a storm wheel of black cloud forms overhead; five rounds of bolts hammer everything around the shaman */
function skStorm() {
  const P = hero.pos.clone(); P.y = 0; const R = 4.25; face(hero, nearestGhost().pos);
  castAnim(9, () => tipFlash(C(1.4, 1.2, 2.6)), 3, 'spell');
  const dark = $('dim'); dark.style.opacity = '.28';
  const wheel = decal(1, P.x, P.z, R, C(1, .9, 2), null, { auto: false, alpha: .6 });
  addTask((dt, t) => {
    if (t < 2.6 && Math.random() < .8) emit({ p: V(P.x + rand(-R, R), 4.6 + rand(-.3, .3), P.z + rand(-R, R) * .8), v: V(rand(-.3, .3), 0, rand(-.3, .3)), c: C(.14, .12, .2), life: 1.4, size: rand(1.2, 1.8), size1: 2.2, shape: SH.soft, a: .75, swirl: .35 }, PN);
    wheel.u.uAlpha.value = .6 * clamp01(t * 3) * clamp01((3 - t) / .4);
    if (t > 3) { wheel.auto = true; wheel.t = 99; dark.style.opacity = '0'; return false; }
  });
  for (let w = 0; w < 5; w++) after(.55 + w * .25, () => {
    const tg = livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4);
    const spots = tg.length ? tg.map(g => g.pos.clone()) : []; for (let k = spots.length; k < 4; k++) { const a = rand(0, 6.28), r = rand(1, R); spots.push(V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r)); }
    spots.forEach((s, i) => after(i * .03, () => { bolt(V(s.x + rand(-.4, .4), 4.6, s.z), V(s.x, 0, s.z), .3, .055); shock(s.x, s.z, 1.1, C(1.6, 1.4, 2.8), C(.6, .4, 1.4), .35); burst(V(s.x, .3, s.z), 10, { c: [C(1.6, 1.4, 2.8), WHITE], size: .1, sp: 4, upMin: .4, life: .35, shape: SH.star, drag: 3 }); }));
    flash(P, 0xc0b0ff, 60, .3); shake = .15;
    tg.forEach(g => { hurt(g, 175, w === 4, .2); stunStars(g, .4); });
  });
  return 3.2;
}

/* ---------------- skill catalogue (numbers from shared/data/skills.js) ---------------- */
const SKILLS = [
  { id: 'mage_akom', name: 'คาถาอาคม', lv: 1, run: skAkom, meta: ['MP 6', 'CD 1.8 วิ', 'ระยะ 240', '3 ลูก'],
    desc: 'ยิงลูกไฟอาคม 3 ลูกโค้งเข้าเป้า',
    layers: ['ปล่อยจากปลายไม้เท้าตรงเฟรมร่ายของสไปรต์', 'ลูกไฟ 3 ลูกโค้งเข้าจากซ้าย กลาง ขวา', 'ประกายอักขระม่วงวนรอบลูกไฟ', 'โดน: ระเบิดไฟ + วงกระแทก'] },
  { id: 'mage_yant', name: 'ยันต์ตรึงวิญญาณ', lv: 2, run: skYant, meta: ['MP 10', 'CD 6 วิ', 'ระยะ 220', 'ทะลุ', 'นิ่ง 1.8 วิ'],
    desc: 'ปายันต์ทอง 3 แผ่นวนเข้าเป้า โซ่วิญญาณล็อกศัตรูนิ่ง 1.8 วิ (ทะลุทุกตัว)',
    layers: ['แผ่นยันต์กระดาษทองลายอักขระ 3 แผ่น หมุนพุ่งเป็นคลื่น', 'ผีที่โดน: ยันต์ 3 แผ่นวนรอบตัว', 'โซ่วิญญาณม่วง 4 เส้นตรึงลงดิน', 'ดาวมึนเหนือหัว'] },
  { id: 'mage_shield', name: 'เกราะยันต์เก้ายอด', lv: 4, run: skShield, meta: ['MP 15', 'CD 16 วิ', 'ฟื้น 25%', 'บัฟ 8 วิ'],
    desc: 'ฟื้น HP 25% ป้องกัน +24 นาน 8 วิ',
    layers: ['ยันต์ 9 แผ่นลอยวนขึ้นรอบตัว', 'วงยันต์เก้ายอดบนพื้น', 'ยันต์หุบเข้าเป็นมงกุฎ แล้วเกิดเกราะทองโปร่งแสง'] },
  { id: 'mage_thunder', name: 'อัสนีบาต', lv: 6, run: skThunder, meta: ['MP 14', 'CD 5 วิ', 'ระยะ 270', '×2.6'],
    desc: 'ฟ้าผ่าศัตรูที่ใกล้ที่สุด สะดุ้งชั่วครู่',
    layers: ['เมฆดำก่อตัวเหนือผี', 'สายฟ้าม่วงขาว 2 สายผ่าลง', 'แสงวาบ + วงกระแทก + ประกายไฟฟ้า'] },
  { id: 'mage_kalp', name: 'เพลิงกัลป์ปราบผี', lv: 8, run: skKalp, meta: ['MP 35', 'CD 22 วิ', 'วง 110', '4 ระลอก', 'อัลติ'],
    desc: '★ ไฟกัลป์ถล่มด้านหน้า 4 ระลอก ผีติดไฟลุกไหม้ต่อเนื่อง',
    layers: ['ท้องฟ้าแดง วงไฟลายเปลวบนพื้น', 'ลูกไฟกัลป์ตกเฉียง 4 ระลอก ระลอกละ 4 ลูก', 'ระเบิดไฟ + ควัน ทุกลูก', 'ผีติดไฟลุกไหม้ 4 ติ๊ก'] },
  { id: 'mage_holy', name: 'น้ำมนต์ธาราทิพย์', lv: 10, run: skHoly, meta: ['MP 30', 'CD 24 วิ', 'HP 25% · MP 15%'],
    desc: '[ปาร์ตี้] บัวทิพย์บานกลางวง ฟื้น HP 25% + MP 15% ทั้งปาร์ตี้ · ป้องกัน +12 นาน 10 วิ',
    layers: ['บัวทิพย์ฟ้าบานกลางปาร์ตี้', 'น้ำมนต์พุ่งขึ้นเป็นน้ำพุแล้วโปรยลง', 'วงน้ำกระเพื่อมทั้งลาน', 'ประกายฟ้าบนตัวเพื่อน'] },
  { id: 'mage_ghostfire', name: 'ไฟผีห้าทิศ', lv: 20, adv: true, run: skGhostfire, meta: ['MP 18', 'CD 7 วิ', '5 ดวง', 'แผ่ 36°'],
    desc: 'เรียกไฟผีกองกอย 5 ดวงพุ่งแผ่เป็นพัด โดนได้หลายตัว',
    layers: ['ไฟกองกอยเขียว 5 ดวงแผ่เป็นพัด', 'บินส่าย ขึ้นลง มีหน้าผีจาง ๆ', 'เปลวเขียวลอยตามทาง'] },
  { id: 'mage_curse', name: 'คำสาปพรายตานี', lv: 40, adv: true, run: skCurse, meta: ['MP 24', 'CD 11 วิ', 'วง 90', 'พิษ 6 ครั้ง'],
    desc: 'วงคำสาปใต้เป้า ผีทุกตัวในวงติดพิษพราย 6 ครั้ง และเชื่องช้า −35% ไป 3.5 วิ',
    layers: ['วงคำสาปม่วงเขียวหมุนใต้ผี (mandala shader)', 'เถาเงามืด 10 เส้นงอกบิดขึ้นจากดิน', 'ควันมืดลอยทั้งวง', 'ผีติดพิษ 6 ติ๊ก'] },
  { id: 'mage_meditate', name: 'สมาธิกสิณไฟ', lv: 70, adv: true, run: skMeditate, meta: ['MP 20', 'CD 32 วิ', 'บัฟ 12 วิ'],
    desc: 'เข้าฌานกสิณ พลังเวทย์ +30% คริ +10% ฟื้น HP 10% นาน 12 วิ',
    layers: ['ตัวลอยขึ้นเล็กน้อยระหว่างฌาน', 'วงกสิณไฟหมุนหลังศีรษะ', 'เปลวไฟเกลียววนรอบตัว'] },
  { id: 'mage_storm', name: 'พายุอัสนีเทพ', lv: 100, adv: true, run: skStorm, meta: ['MP 48', 'CD 20 วิ', 'รัศมี 170', '5 ระลอก'],
    desc: 'เรียกพายุฟ้าผ่ารอบตัว 5 ระลอก ผีในวงกว้างสะดุ้งทุกครั้ง',
    layers: ['จอมืด เมฆดำหมุนวนเหนือลาน', 'วงพายุบนพื้น', 'ฟ้าผ่าลงทุกผีในวง 5 ระลอก', 'แสงวาบ + กล้องสั่นทุกระลอก'] },
];
const SEP_AT = 6;
