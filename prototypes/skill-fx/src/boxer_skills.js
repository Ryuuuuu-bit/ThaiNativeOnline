/* ---------------- มวยไทย helpers ---------------- */
PALS.gold = [C(2.8, 2.4, 1.4), C(2.2, 1.2, .25), C(.5, .2, .03)]; SMOKE.gold = C(.4, .35, .3);
PALS.jade = [C(1.8, 2.8, 1.6), C(.4, 1.6, .7), C(.04, .3, .12)]; SMOKE.jade = C(.3, .4, .35);
PALS.red = [C(2.8, 2.2, 2), C(2.2, .35, .25), C(.45, .03, .03)]; SMOKE.red = C(.35, .25, .25);
function strike(fps = 22, hit, at = 4, from = 0) { play(hero, 'attack', { fps, from, once: () => play(hero, 'idle') }); after((at - from) / fps, hit); }
function stepIn(tg, dist = 1.15, cb, dur = .25) { const stand = tg.pos.clone().add(hero.pos.clone().sub(tg.pos).setY(0).normalize().multiplyScalar(dist)); moveTo(hero, stand, dur, () => { face(hero, tg.pos); cb && cb(); }, { trail: C(1, .6, .25) }); }
/* camera-facing impact: white-gold starburst spikes + expanding ring + sparks */
const SPARK_GEO = new THREE.PlaneGeometry(1, 1);
function hitSpark(p, s = 1, col = C(2.6, 1.8, .7)) {
  const g = new THREE.Group(); g.position.copy(p); g.lookAt(camera.position); scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const coreM = new THREE.MeshBasicMaterial({ color: C(2.8, 2.8, 2.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const n = 8 + ((Math.random() * 4) | 0);
  for (let k = 0; k < n; k++) { const a = k / n * 6.28 + rand(-.2, .2), L = rand(.35, .8) * s * (k % 3 === 0 ? 1.5 : 1);
    const sp = new THREE.Mesh(SPARK_GEO, k % 2 ? mat : coreM); sp.scale.set(L, .05 * s, 1); sp.position.set(Math.cos(a) * L * .55, Math.sin(a) * L * .55, 0); sp.rotation.z = a; g.add(sp); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40), mat.clone()); ring.scale.setScalar(.2 * s); g.add(ring);
  addTask((dt, t) => { const f = t / .22; g.scale.setScalar(.6 + f * .8); mat.opacity = coreM.opacity = Math.max(0, 1 - f); ring.scale.setScalar((.2 + f * 1.1) * s); ring.material.opacity = Math.max(0, 1 - f);
    if (t > .22) { scene.remove(g); g.traverse(o => o.material && o.material.dispose()); return false; } });
  burst(p, 10, { c: [C(2.6, 2.2, 1.4), col], size: .08, sp: 4.5, life: .3, shape: SH.star, drag: 4 });
  flash(p, col.getHex(), 18 * s, .2);
}
/* speed lines streaking back from a punch */
function speedLines(p, dir, n = 6, col = C(1.8, 1.6, 1.3)) { for (let k = 0; k < n; k++) emit({ p: p.clone().add(V(rand(-.3, .3), rand(-.25, .25), rand(-.3, .3))), v: dir.clone().multiplyScalar(-rand(3, 6)), c: col, life: .18, size: .06, size1: .01, drag: 1 }); }
function knock(g, dir, dist, dur = .3) { const from = g.pos.clone(), to = from.clone().addScaledVector(dir.clone().setY(0).normalize(), dist);
  addTask((dt, t) => { const u = clamp01(t / dur); g.off.copy(to.clone().sub(from).multiplyScalar(Math.sin(u * Math.PI / 2) * (1 - Math.max(0, (u - .7) / .3))));
    if (Math.random() < .6) emit({ p: g.pos.clone().add(g.off).setY(.08), v: V(rand(-.3, .3), rand(.2, .5), rand(-.3, .3)), c: DUST, life: .5, size: .25, size1: .5, shape: SH.soft, a: .5 }, PN);
    if (u >= 1) { g.off.set(0, 0, 0); return false; } }); }
function spiritSprite(ch, tint, col) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch, tint), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); scene.add(s); return s; }
const emojiTex = (ch, tint) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.font = '190px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 140);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); };
const fist = () => chest(hero).add(V(0, .1, 0));
const ahead = (tg, k = .45) => chest(hero).add(tg.pos.clone().sub(hero.pos).setY(0).normalize().multiplyScalar(k));

/* =================== SKILLS =================== */

/* 1 · หมัดแย็บ — slide in and fire three snapping jabs: speed lines, a white-gold burst on every hit */
function skJab() {
  const tg = nearestGhost();
  stepIn(tg, 1.05, () => {
    const dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
    for (let i = 0; i < 3; i++) after(i * .13, () => {
      play(hero, 'attack', { fps: 30, from: 2, once: () => play(hero, 'idle') });
      after(.05, () => { const p = chest(tg).add(V(rand(-.15, .15), rand(-.1, .2), .15)); speedLines(ahead(tg, .5), dir, 7); hitSpark(p, .8); if (tg.alive) hurt(tg, 85, i === 2, .12); shake = .04; });
    });
    after(.75, () => goHome());
  });
  return 1.9;
}

/* 2 · เตะก้านคอ — a loaded roundhouse: a thick golden kick arc, a huge burst, the ghost flies back dragging dust, dazed and weakened */
function skKick() {
  const tg = nearestGhost();
  stepIn(tg, 1.25, () => {
    const dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
    hero.tint = 1; hero.tintC = C(1.2, 1, .6);
    strike(14, () => {
      slashArc(chest(hero).add(V(0, .25, 0)), tg.pos, { r: 1.5, sweep: 2.4, roll: .35, dir: 1, pal: 'gold', thick: .55, dur: .1, hold: .05, dis: .3 });
      after(.04, () => { hitSpark(chest(tg).add(V(0, .3, .15)), 1.6); shake = .25; if (tg.alive) { hurt(tg, 330, true, 0); knock(tg, dir, 1.4); stunStars(tg, .7); popup(V(tg.pos.x, tg.barY + .7, tg.pos.z), 'มึน · อ่อนแรง −25%', 'st'); } });
    }, 4);
    after(1.05, () => goHome());
  });
  return 2.2;
}

/* 3 · จระเข้ฟาดหาง — spin into a back-kick: a jade crocodile tail sweeps a full circle twice, water spray flies off it */
function skCroc() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), spot = gc.clone().add(hero.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(.5));
  moveTo(hero, spot, .3, () => {
    const P = hero.pos.clone(), R = 2;
    const croc = spiritSprite('🐊', 'rgba(80,220,140,.55)', C(1, 1.8, 1.2)); croc.scale.setScalar(2.4);
    addTask((dt, t) => { const a = t * 9; croc.position.set(P.x + Math.cos(a) * 1.2, 1, P.z + Math.sin(a) * 1.2); croc.material.rotation = -a; croc.material.opacity = clamp01(t * 5) * clamp01((.9 - t) / .3) * .8; if (t > .9) { kill(croc); return false; } });
    for (let i = 0; i < 2; i++) after(i * .3, () => {
      play(hero, 'attack', { fps: 26, from: 2, once: () => play(hero, 'idle') });
      slashArc(V(P.x, .75 - i * .1, P.z), P.clone().add(V(0, 0, -1)), { r: R, sweep: 6, pal: 'jade', thick: .45, roll: .05, pitch: -.15, dur: .2, hold: .02, dis: .3 });
      for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28; emit({ p: V(P.x + Math.cos(a) * R * .9, .5, P.z + Math.sin(a) * R * .9), v: V(Math.cos(a) * rand(1.5, 3), rand(1.5, 3), Math.sin(a) * rand(1.5, 3)), c: Math.random() < .5 ? C(.7, 1.6, 2) : C(1.4, 2, 2.2), life: .7, size: .08, grav: 6, drag: .5 }); }
      livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .5).forEach(g => { hurt(g, 200, i === 1, .4); hitSpark(chest(g), 1, C(1.4, 2.4, 1.2)); });
      shock(P.x, P.z, R, C(1, 2, 1.2), C(.3, .8, .5), .4); shake = .1;
    });
    after(1, () => goHome());
  }, { trail: C(.6, 1.2, .7) });
  return 2.3;
}

/* 4 · ไหว้ครูรำมวย — the fighter pays respect: the มงคล crown glows, sacred yant script spirals up the body, a gold aura rises */
function skWaikru() {
  face(hero, nearestGhost().pos);
  const P = hero.pos.clone(); const halo = new THREE.Mesh(new THREE.TorusGeometry(.26, .045, 8, 32), new THREE.MeshBasicMaterial({ color: C(2.4, 1.9, .9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(halo);
  const rings = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.TorusGeometry(.6 - i * .08, .015, 6, 48), new THREE.MeshBasicMaterial({ color: C(2.2, 1.6, .6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = Math.PI / 2; scene.add(m); return m; });
  const mand = decal(2, P.x, P.z, 1.8, C(1.6, 1.2, .4), C(1.4, .5, .2), { auto: false, alpha: .8 });
  after(.6, () => { heal(hero, hero.maxHp * .2, 'heal big'); after(.25, () => popup(V(P.x, hero.barY + .7, P.z), 'โจมตี +35% · ตีเร็ว +10%', 'st')); flash(P, 0xffc060, 40, .5); shock(P.x, P.z, 1.8, GOLD, C(1, .5, .2), .5); });
  addTask((dt, t) => {
    const live = clamp01((3.2 - t) / .4);
    halo.position.copy(hero.pos).add(V(0, 1.78, 0)); halo.lookAt(halo.position.clone().add(V(0, 1, 0))); halo.rotation.z = t * 2; halo.material.opacity = live * clamp01(t * 4);
    rings.forEach((m, i) => { m.position.copy(hero.pos).setY(((t * .9 + i / 3) % 1) * 1.9); m.material.opacity = live * Math.sin(((t * .9 + i / 3) % 1) * Math.PI); });
    mand.u.uAlpha.value = .8 * clamp01(t * 3) * live;
    for (let k = 0; k < 2; k++) { const a = t * 6 + k * 3.14, h = (t * 1.3 + k * .5) % 1.9; emit({ p: hero.pos.clone().add(V(Math.cos(a + h * 3) * .45, h, Math.sin(a + h * 3) * .3)), c: GOLD, life: .5, size: .09, shape: SH.star, rot: 0 }); }
    if (Math.random() < dt * 8 * live) emit({ p: hero.pos.clone().add(V(rand(-.4, .4), .05, rand(-.3, .3))), v: V(0, rand(1, 1.8), 0), c: C(2.2, 1.2, .35), life: .7, size: .2, size1: .03 });
    if (t > 3.2) { kill(halo); rings.forEach(kill); mand.auto = true; mand.t = 99; return false; }
  });
  return 3.4;
}

/* 5 · หักงวงไอยรา — a towering leap; a golden war-elephant spirit looms and crashes down with the elbow; the ground caves in */
function skNgouy() {
  const tg = nearestGhost(), P = tg.pos.clone().add(hero.pos.clone().sub(tg.pos).setY(0).normalize().multiplyScalar(.5)); P.y = 0;
  face(hero, P); const mark = decal(1, tg.pos.x, tg.pos.z, 1.8, C(2, 1.3, .4), null, { life: 1.1, grow: .2 });
  const ele = spiritSprite('🐘', 'rgba(255,190,80,.55)', C(1.8, 1.3, .6)); ele.material.opacity = 0;
  addTask((dt, t) => { const u = clamp01(t / .75); ele.position.set(tg.pos.x, 2.6 + (1 - u * u) * 1.6, tg.pos.z - .3); ele.scale.setScalar(2.2 + u * 1.2); ele.material.opacity = Math.min(.9, t * 2.5) * (u < 1 ? 1 : 0);
    if (u >= 1) { kill(ele); return false; } });
  play(hero, 'attack', { fps: 6, from: 0 });
  moveTo(hero, P, .7, () => {
    play(hero, 'attack', { fps: 24, from: 4, once: () => play(hero, 'idle') });
    const R = 2.4; shake = .45; flash(P, 0xffb050, 90, .6); $('dim').style.opacity = '.25'; after(.12, () => $('dim').style.opacity = '0');
    hitSpark(chest(tg).add(V(0, .4, .2)), 2.4);
    shock(P.x, P.z, R, C(2.6, 1.6, .5), C(1.2, .4, .1), .5); shock(P.x, P.z, R * 1.6, DUST, DUST, .8);
    burst(P.clone().setY(.2), 40, { c: [DUST, C(.36, .3, .2), C(.55, .48, .32)], S: PN, size: .7, size1: 1.6, sp: 4.5, upMin: .1, upMax: .5, life: 1.3, shape: SH.soft, a: .75, drag: 2.5 });
    burst(P.clone().setY(.3), 22, { c: C(.28, .24, .2), S: PN, size: .12, sp: 4.5, upMin: .8, upK: 1.6, life: 1.3, shape: SH.soft, grav: 9, a: 1, drag: .3 });
    if (tg.alive) { hurt(tg, 640, true, .3); stunStars(tg, 1.5); popup(V(tg.pos.x, tg.barY + .9, tg.pos.z), 'มึน 1.5 วิ · เกราะแตก −40%', 'st');
      burst(chest(tg), 18, { c: [C(.7, .75, .85), C(1.2, 1.25, 1.4)], size: .1, sp: 3.5, upMin: .3, life: .9, grav: 7, shape: SH.star, drag: .5 }); }
    after(.7, () => goHome(.5));
  }, { hop: 3.2, trail: C(1.3, .8, .3) });
  return 2.7;
}

/* 6 · กลองมังคละปลุกใจ — a red war drum appears; three heavy beats send sound rings and floating notes across the party */
const noteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 32, 34); return new THREE.CanvasTexture(c); })();
function skDrum() {
  face(hero, nearestGhost().pos);
  const G = new THREE.Group(), P = hero.pos.clone().add(V(-.9, 0, .4)); G.position.copy(P); scene.add(G);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .55, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9c2020, roughness: .6, side: THREE.DoubleSide })); body.position.y = .55; G.add(body);
  const skin = new THREE.Mesh(new THREE.CircleGeometry(.42, 24), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: .8 })); skin.rotation.x = -Math.PI / 2; skin.position.y = .83; G.add(skin);
  [.3, .83].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(.43, .03, 6, 28), new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: .8, roughness: .3 })); r.rotation.x = Math.PI / 2; r.position.y = y; G.add(r); });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(.3, .38, .3, 12), new THREE.MeshStandardMaterial({ color: 0x4a3020 })); legs.position.y = .15; G.add(legs);
  G.scale.setScalar(.01); const R = 5.5;
  addTask((dt, t) => { G.scale.setScalar(t < .3 ? easeOutBack(t / .3) : t > 2.6 ? Math.max(.01, 1 - (t - 2.6) / .3) : 1); if (t > 2.9) { kill(G); return false; } });
  for (let b = 0; b < 3; b++) after(.4 + b * .45, () => {
    play(hero, 'attack', { fps: 30, from: 3, once: () => play(hero, 'idle') });
    skin.position.y = .8; after(.06, () => skin.position.y = .83);
    const top = P.clone().setY(.9); flash(top, 0xffa040, 30 + b * 10, .3); shake = .06 + b * .05;
    shock(P.x, P.z, R * (.6 + b * .2), C(2.2, 1.2, .4), C(1, .4, .15), .6);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 6, 60), new THREE.MeshBasicMaterial({ color: C(2.2, 1.4, .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.copy(top); scene.add(ring);
    addTask((dt, t) => { ring.scale.setScalar(.4 + t * 7); ring.material.opacity = 1 - t / .6; if (t > .6) { kill(ring); return false; } });
    for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: k % 2 ? C(2.2, 1.4, .5) : C(2.2, .6, .4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(.35); scene.add(s);
      const a = rand(0, 6.28), v = V(Math.cos(a) * rand(1, 2), rand(1, 1.8), Math.sin(a) * rand(1, 2)); s.position.copy(top);
      addTask((dt, t) => { s.position.addScaledVector(v, dt); s.material.rotation = Math.sin(t * 8) * .3; s.material.opacity = 1 - t / 1.1; if (t > 1.1) { kill(s); return false; } }); }
    if (b === 2) living().filter(a => a.pos.distanceTo(P) <= R + .5).forEach((a, i) => after(i * .08, () => { heal(a, a.maxHp * .15); after(.25, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'ป้องกัน +18 · โจมตี +10%', 'st')); shock(a.pos.x, a.pos.z, 1, GOLD, C(1, .4, .1), .4); }));
  });
  return 3;
}

/* 7 · ศอกกลับพลิกล็อก — two whipping elbows: short red arcs, sharp bursts, a cut that bleeds */
function skElbow() {
  const tg = nearestGhost();
  stepIn(tg, .95, () => {
    for (let i = 0; i < 2; i++) after(i * .16, () => {
      play(hero, 'attack', { fps: 30, from: 3, once: () => play(hero, 'idle') });
      after(.03, () => { slashArc(chest(hero).add(V(0, .35, 0)), tg.pos, { r: .95, sweep: 1.8, roll: i ? -.9 : .9, dir: i ? -1 : 1, pal: 'red', thick: .6, dur: .07, hold: .03, dis: .22 });
        hitSpark(chest(tg).add(V(0, .45, .15)), 1.1, C(2.4, .6, .35)); shake = .08; if (tg.alive) { hurt(tg, 190, i === 1, .15); if (i === 0) { stunStars(tg, .5); bleed(tg); } } });
    });
    after(.85, () => goHome());
  });
  return 2;
}

/* 8 · เข่าลอยทะลวงฟ้า — a flying knee: the fighter launches with a streak, the knee connects and a pillar of force bursts skyward */
function skKnee() {
  const tg = nearestGhost(), P = tg.pos.clone().add(hero.pos.clone().sub(tg.pos).setY(0).normalize().multiplyScalar(.7)); P.y = 0;
  face(hero, tg.pos); play(hero, 'attack', { fps: 10, from: 2 });
  moveTo(hero, P, .38, () => {
    play(hero, 'attack', { fps: 24, from: 4, once: () => play(hero, 'idle') });
    hitSpark(chest(tg).add(V(0, .2, .2)), 1.8); shake = .25; flash(P, 0xffd070, 60, .4);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.25, .7, 5, 24, 1, true), pillarMat(C(1.6, 1.2, .5))); col.position.set(tg.pos.x, 2.5, tg.pos.z); scene.add(col);
    addTask((dt, t) => { col.material.uniforms.uTime.value = t; col.material.uniforms.uA.value = Math.max(0, 1 - t / .5) * 1.4; col.scale.set(1 + t, Math.min(1, t * 8), 1 + t); if (t > .5) { kill(col); return false; } });
    for (let k = 0; k < 16; k++) emit({ p: chest(tg), v: V(rand(-.8, .8), rand(5, 9), rand(-.8, .8)), c: Math.random() < .5 ? GOLD : WHITE, life: .45, size: .1, size1: .02, drag: 2 });
    shock(P.x, P.z, 1.4, GOLD, C(1, .5, .2), .4);
    livingGhosts().filter(g => g.pos.distanceTo(P) <= 1.4 + .5).forEach(g => { hurt(g, g === tg ? 360 : 180, g === tg, .3); stunStars(g, .9); });
    after(.6, () => goHome());
  }, { hop: 1.3, trail: C(1.4, .9, .35) });
  return 2.1;
}

/* 9 · กายเหล็กคาถามหาอุด — the body turns to iron: a steel sheen, a rotating ring of yant script, and blows that ring off with sparks */
function skIron() {
  face(hero, nearestGhost().pos); const P = hero.pos.clone();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: nineYantTex(), color: C(1.4, 1.5, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 1), fresnelMat(C(1, 1.15, 1.5))); shell.scale.y = 1.4; scene.add(shell);
  hero.iron = true; flash(P, 0xc0d0ff, 40, .5); shock(P.x, P.z, 1.6, C(1.4, 1.6, 2), C(.5, .6, .8), .45);
  after(.3, () => { heal(hero, hero.maxHp * .12); after(.25, () => popup(V(P.x, hero.barY + .7, P.z), 'ป้องกัน +30% · โจมตี +20%', 'st')); });
  let ping = .5;
  addTask((dt, t) => {
    const live = clamp01((3.6 - t) / .4);
    hero.tint = Math.max(hero.tint, .6 * live); hero.tintC = C(.85, .95, 1.15);
    ring.position.set(hero.pos.x, .05, hero.pos.z); ring.rotation.z = t * .8; ring.material.opacity = clamp01(t * 3) * live;
    shell.position.copy(hero.pos).setY(.95); shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = .5 * clamp01(t * 3) * live;
    ping -= dt; if (ping <= 0 && live > .5) { ping = rand(.35, .7); const p = chest(hero).add(V(rand(-.4, .4), rand(-.3, .5), .3)); burst(p, 8, { c: [WHITE, C(1.6, 1.7, 2.2)], size: .08, sp: 3, life: .25, shape: SH.star, drag: 4 }); popup(p, 'ติ๊ง', 'st'); }
    if (t > 3.6) { hero.iron = false; kill(ring); kill(shell); return false; }
  });
  return 3.6;
}
function nineYantTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 90, 0, 7); g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; g.save(); g.translate(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.rotate(a + 1.57); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 5, 0, 5); g.moveTo(-4, 6); g.lineTo(4, 6); g.stroke(); g.restore(); }
  g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 14; a += .2) { const r = 1 + a * 2.6; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); return new THREE.CanvasTexture(c); }

/* 10 · หนุมานถวายแหวน — a white Hanuman spirit rises behind the fighter; eight strikes (fist, foot, knee, elbow) in a blur, then the golden ring flashes */
function skHanuman() {
  const tg = nearestGhost();
  stepIn(tg, 1.15, () => {
    const dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
    const han = spiritSprite('🐒', 'rgba(255,255,255,.7)', C(1.6, 1.6, 1.8)); han.scale.setScalar(2.6);
    addTask((dt, t) => { han.position.copy(hero.pos).add(V(0, 2.1 + Math.sin(t * 6) * .08, -.3)); han.material.opacity = clamp01(t * 3) * clamp01((1.6 - t) / .3) * .75; if (t > 1.6) { kill(han); return false; } });
    const kinds = ['fist', 'foot', 'knee', 'elbow', 'fist', 'foot', 'elbow', 'knee'], combo = document.createElement('div'); combo.className = 'pop st big'; combo.style.animation = 'none'; labels.appendChild(combo);
    kinds.forEach((k, i) => after(i * .11, () => {
      play(hero, 'attack', { fps: 34, from: 3, once: () => play(hero, 'idle') }); afterimage(hero, C(1.2, 1.2, 1.4), .2);
      const roll = rand(-.9, .9), pal = k === 'foot' ? 'gold' : k === 'elbow' ? 'red' : k === 'knee' ? 'gold' : 'blue';
      if (k !== 'fist') slashArc(chest(hero).add(V(0, k === 'knee' ? -.1 : .2, 0)), tg.pos, { r: k === 'foot' ? 1.5 : 1, sweep: k === 'foot' ? 2.4 : 1.6, roll, dir: i % 2 ? -1 : 1, pal, thick: .55, dur: .06, hold: .02, dis: .18 });
      else speedLines(ahead(tg, .5), dir, 6);
      inFront(2, .9, hero.pos, dir).forEach(g => { hurt(g, 95, i === 7, .1); hitSpark(chest(g).add(V(rand(-.2, .2), rand(-.2, .3), .15)), .9 + (i === 7 ? .8 : 0)); });
      shake = .05; combo.textContent = (i + 1) + ' จังหวะ'; const s = toScreen(V(tg.pos.x, 3, tg.pos.z)); combo.style.left = s.x + 'px'; combo.style.top = s.y + 'px';
    }));
    after(.95, () => {
      combo.remove();
      const ringM = new THREE.Mesh(new THREE.TorusGeometry(.35, .07, 10, 40), new THREE.MeshBasicMaterial({ color: C(2.6, 2, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      ringM.position.copy(chest(tg).add(V(0, .6, .3))); scene.add(ringM); flash(ringM.position, 0xffd060, 60, .5); shake = .2; popup(V(tg.pos.x, tg.barY + 1.1, tg.pos.z), 'ถวายแหวน!', 'st big');
      addTask((dt, t) => { ringM.lookAt(camera.position); ringM.scale.setScalar(1 + t * 4); ringM.material.opacity = 1 - t / .5; if (t > .5) { kill(ringM); return false; } });
      burst(chest(tg), 30, { c: [GOLD, WHITE], size: .14, sp: 5, life: .5, shape: SH.star, drag: 3 });
      after(.5, () => goHome());
    });
  });
  return 2.6;
}

/* ---------------- skill catalogue (numbers from shared/data/skills.js) ---------------- */
const SKILLS = [
  { id: 'boxer_jab', name: 'หมัดแย็บ', lv: 1, run: skJab, meta: ['MP 3', 'CD 2 วิ', '3 หมัด'],
    desc: 'แย็บรัว 3 หมัด',
    layers: ['สไลด์เข้าหาผีพร้อมเงาตาม', 'ทุกหมัด: เส้นความเร็วพุ่งย้อน', 'แฉกแสงขาวทองหันหากล้อง + วงกระแทก + ประกาย'] },
  { id: 'boxer_kick', name: 'เตะก้านคอ', lv: 2, run: skKick, meta: ['MP 6', 'CD 4.5 วิ', '×2.0', 'กระเด็น'],
    desc: 'เตะก้านคอเต็มแรง กระเด็น มึนงง และอ่อนแรง (ตีเบาลง 25%) ไป 5 วิ',
    layers: ['ตัวเรืองทองตอนง้าง', 'รอยเตะโค้งสีทองหนา ตรงเฟรมเตะของสไปรต์', 'แฉกแสงใหญ่ + กล้องสั่น', 'ผีกระเด็นถอยหลังลากฝุ่น + ดาวมึน'] },
  { id: 'boxer_croc', name: 'จระเข้ฟาดหาง', lv: 4, run: skCroc, meta: ['MP 10', 'CD 7 วิ', 'รอบตัว', '2 ครั้ง'],
    desc: 'หมุนตัวเตะกลับหลัง โดนทุกตัวรอบตัว 2 ครั้ง',
    layers: ['วิญญาณจระเข้เขียวหมุนรอบตัว', 'รอยหางฟาดเต็มวงสีหยก 2 รอบ', 'ละอองน้ำสาดกระเด็นออกรอบวง', 'แฉกแสงเขียวที่ผีทุกตัวในวง'] },
  { id: 'boxer_waikru', name: 'ไหว้ครูรำมวย', lv: 6, run: skWaikru, meta: ['MP 15', 'CD 22 วิ', 'ฟื้น 20%', 'บัฟ 12 วิ'],
    desc: 'ฟื้น HP 20% พลังโจมตี +35% ตีเร็วขึ้น 10% นาน 12 วิ',
    layers: ['วงมงคลทองเหนือศีรษะ', 'วงแหวนทองไล่ขึ้นตามตัว 3 วง', 'มณฑลทองใต้เท้า', 'ประกายเกลียวทอง + ไอไฟอุ่นลอยขึ้น'] },
  { id: 'boxer_ngouy', name: 'หักงวงไอยรา', lv: 8, run: skNgouy, meta: ['MP 25', 'CD 18 วิ', '×4.0', 'อัลติ'],
    desc: '★ กระโดดทุ่มศอกลงกลางหัว แรงมาก มึนงง และเกราะแตก (DEF −40%) ไป 8 วิ',
    layers: ['วงเล็งบนพื้น', 'วิญญาณช้างทองยักษ์โผล่เหนือเป้าแล้วกดลง', 'กระโดดสูงพร้อมเงาตาม ศอกลงตรงเฟรมกระแทก', 'จอวาบ + แฉกแสงยักษ์ + ฝุ่นและเศษหิน + เกราะแตก'] },
  { id: 'boxer_drum', name: 'กลองมังคละปลุกใจ', lv: 10, run: skDrum, meta: ['MP 24', 'CD 26 วิ', 'รัศมี 220', 'บัฟ 12 วิ'],
    desc: '[ปาร์ตี้] ตีกลองศึก 3 จังหวะ ฟื้น HP 15% · ป้องกัน +18 โจมตี +10% ทั้งปาร์ตี้ 12 วิ',
    layers: ['กลองศึกแดงขอบทองเด้งขึ้นข้างตัว', 'ตี 3 จังหวะ หนังกลองยุบตามจังหวะ', 'ทุกจังหวะ: วงเสียงแผ่ + โน้ตดนตรีลอยกระจาย + กล้องสั่นเพิ่มขึ้น', 'จังหวะที่ 3 บัฟทั้งทีม'] },
  { id: 'boxer_elbow', name: 'ศอกกลับพลิกล็อก', lv: 20, adv: true, run: skElbow, meta: ['MP 12', 'CD 5.5 วิ', '2 จังหวะ', 'เลือดไหล'],
    desc: 'ศอกกลับ 2 จังหวะ ผีสะดุ้งและคมศอกบาดจนเลือดไหลต่อเนื่อง',
    layers: ['รอยศอกสั้นสีแดง 2 จังหวะสลับทิศ', 'แฉกแสงแดง', 'เลือดหยด + ดาเมจเลือดไหล'] },
  { id: 'boxer_knee', name: 'เข่าลอยทะลวงฟ้า', lv: 40, adv: true, run: skKnee, meta: ['MP 20', 'CD 10 วิ', 'พุ่ง 95', 'มึน 0.9 วิ'],
    desc: 'กระโดดเข่าลอยเข้าหาเป้า ผีรอบจุดลงมึน 0.9 วิ',
    layers: ['กระโดดพุ่งพร้อมเงาตาม', 'เข่าโดน: แฉกแสงใหญ่', 'เสาพลังพุ่งขึ้นฟ้า + ประกายพุ่งขึ้น', 'ผีรอบจุดมึน'] },
  { id: 'boxer_iron', name: 'กายเหล็กคาถามหาอุด', lv: 70, adv: true, run: skIron, meta: ['MP 26', 'CD 28 วิ', 'บัฟ 10 วิ'],
    desc: 'ลงคาถามหาอุด ป้องกัน +30% โจมตี +20% ฟื้น HP 12% นาน 10 วิ',
    layers: ['ตัวเปลี่ยนเป็นเหล็กเงา', 'วงยันต์มหาอุดหมุนใต้เท้า', 'เกราะเหลี่ยมเหล็กโปร่ง', 'ประกาย "ติ๊ง" เด้งออกจากตัวเป็นระยะ'] },
  { id: 'boxer_hanuman', name: 'หนุมานถวายแหวน', lv: 100, adv: true, run: skHanuman, meta: ['MP 44', 'CD 16 วิ', '8 จังหวะ', '×1.1'],
    desc: 'ท่าไม้ครูหมัด-เท้า-เข่า-ศอก 8 จังหวะ โดนทุกตัวด้านหน้า',
    layers: ['วิญญาณหนุมานขาวเหนือตัว', '8 จังหวะ หมัด เท้า เข่า ศอก แต่ละแบบสีรอยต่างกัน', 'เงาติดตัวทุกจังหวะ + ตัวนับจังหวะ', 'ปิดท้าย: วงแหวนทองวาบ "ถวายแหวน"'] },
];
const SEP_AT = 6;
