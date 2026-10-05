/* 3 · ปลุกพญาไม้ — a seed wakes an old sacred tree (wrapped in three-colour cloth); it lashes roots at every ghost in range, then a leaf storm */
function treeMesh() {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x4f3a27, roughness: .95, flatShading: true });
  const tg = new THREE.CylinderGeometry(.19, .42, 2.6, 10, 9); const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), x = tp.getX(i), z = tp.getZ(i), a = (y + 1) * .7, k = 1 + Math.sin(Math.atan2(z, x) * 5 + y * 3) * .08;
    tp.setXYZ(i, (x * Math.cos(a) - z * Math.sin(a)) * k, y, (x * Math.sin(a) + z * Math.cos(a)) * k); }
  tg.computeVertexNormals(); const trunk = new THREE.Mesh(tg, bark); trunk.position.y = 1.3; g.add(trunk);
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + .3, r = new THREE.Mesh(new THREE.ConeGeometry(.13, .9, 5), bark); r.position.set(Math.cos(a) * .42, .12, Math.sin(a) * .42); r.rotation.set(0, -a, 0); r.rotateZ(-1.25); g.add(r); }
  const leafM = new THREE.MeshStandardMaterial({ color: 0x3f8a35, roughness: .8, emissive: 0x17410f, flatShading: true });
  const canopy = [];
  [[0, 3.15, 0, .85], [-.85, 2.8, .05, .6], [.85, 2.85, -.1, .64], [-.4, 2.7, .5, .45], [.45, 2.75, .45, .47], [0, 2.9, -.6, .6], [.15, 3.6, .1, .55]].forEach(([x, y, z, r], i) => {
    if (i < 5 && i > 0) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.05, .1, 1, 6), bark); br.position.set(x * .55, y - .45, z * .55); br.lookAt(x, y + 1.5, z); br.rotateX(Math.PI / 2); g.add(br); }
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafM); c.position.set(x, y, z); c.userData.base = c.position.clone(); g.add(c); canopy.push(c);
  });
  /* ผ้าแพรสามสี tied round the trunk */
  [[0xc8322b, .62], [0xe2b33a, .72], [0x3c8a3f, .82]].forEach(([col, y]) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.355 - (y - .62) * .1, .045, 6, 22), new THREE.MeshStandardMaterial({ color: col, roughness: .7, emissive: col, emissiveIntensity: .15 }));
    band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band);
  });
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(.12, .5), new THREE.MeshStandardMaterial({ color: 0xc8322b, side: THREE.DoubleSide, roughness: .8 })); tail.position.set(.3, .45, .22); tail.rotation.z = .25; g.add(tail);
  const eyes = [-.13, .13].map(x => { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C(2.4, 1.6, .4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); e.position.set(x, 1.38, .36); e.scale.setScalar(.32); g.add(e); return e; });
  scene.add(g); g.userData = { canopy, eyes, tail }; return g;
}
const rootMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: .9, emissive: 0x1a2a08, flatShading: true });
function skTree() {
  const pack = livingGhosts().length ? livingGhosts() : ghosts, gc = centroid(pack);
  const dir = gc.clone().sub(healer.pos).setY(0).normalize(), P = healer.pos.clone().addScaledVector(dir, 2.9); P.y = 0;
  const R = 4.5, LIFE = 6.6; castAt(P);
  const seed = glow(C(1.4, 1.9, .6), .5), from = staffTip();
  addTask((dt, t) => {
    const u = clamp01((t - .2) / .45); seed.position.copy(arcPoint(from, V(P.x, .15, P.z), 1.8, u));
    emit({ p: seed.position.clone(), c: C(.9, 1.4, .4), life: .35, size: .14, size1: 0 });
    if (u < 1) return; kill(seed); awaken(); return false;
  });
  function awaken() {
    const tree = treeMesh(); tree.position.copy(P); tree.scale.setScalar(.01);
    const { canopy, eyes, tail } = tree.userData;
    const rune = decal(4, P.x, P.z, 1.6, C(.5, .9, .25), C(.9, .7, .25), { auto: false });
    const zone = decal(1, P.x, P.z, R, C(.55, .85, .3), null, { auto: false, alpha: .45 });
    flash(P, 0xb8e070, 35, .7); shake = .14;
    burst(P.clone().setY(.2), 30, { c: [DUST, C(.36, .3, .2)], S: PN, size: .5, size1: 1.2, sp: 2.5, upMin: .2, upMax: .6, life: 1.1, shape: SH.soft, a: .7, drag: 2.5 });
    burst(P.clone().setY(.3), 14, { c: C(.3, .25, .18), S: PN, size: .09, sp: 3, upMin: .8, upK: 1.5, life: 1.1, shape: SH.soft, grav: 9, a: 1 });
    const ATT = [1.15, 2.25, 3.35], STORM = 4.5; let ai = 0, stormed = false, lean = V(), leanT = 9;
    addTask((dt, t) => {
      const grow = t < .9 ? easeOutBack(clamp01(t / .9)) : t > LIFE - .6 ? Math.max(.01, (LIFE - t) / .6) : 1;
      tree.scale.set(grow, grow * (t < .9 ? .6 + .4 * clamp01(t / .9) : 1), grow); tree.position.y = t > LIFE - .6 ? -(t - (LIFE - .6)) * .8 : 0;
      /* idle sway + lean toward whatever it just struck */
      leanT += dt; const lk = Math.sin(clamp01(leanT / .45) * Math.PI);
      tree.rotation.set(lean.z * lk * .18 + Math.sin(t * 1.1) * .015, 0, -lean.x * lk * .18 + Math.sin(t * 1.3) * .02);
      canopy.forEach((c, i) => c.position.copy(c.userData.base).add(V(Math.sin(t * 2 + i) * .04, Math.sin(t * 2.6 + i * 2) * .03 + (stormed ? 0 : 0), 0)));
      tail.rotation.z = .25 + Math.sin(t * 3.2) * .25;
      const eo = clamp01((t - .75) / .3) * (t > LIFE - .7 ? clamp01((LIFE - .3 - t) / .4) : 1); eyes.forEach(e => e.material.opacity = eo * (.85 + Math.sin(t * 5) * .15));
      rune.u.uAlpha.value = clamp01(t * 3) * clamp01((LIFE - t) / .6); zone.u.uAlpha.value = .45 * clamp01((t - .6) * 3) * clamp01((LIFE - t) / .6);
      if (Math.random() < dt * 5 && t > .9) emit({ p: P.clone().add(V(rand(-1, 1), rand(2, 3), rand(-.8, .8))), v: V(rand(-.3, .3), -.2, rand(-.3, .3)), c: C(.4, .75, .3), life: 2, size: .16, shape: SH.leaf, vr: rand(-3, 3), grav: .4, drag: .8 });
      if (t > .9 && eo > .5 && !tree.userData.woke) { tree.userData.woke = true; popup(V(P.x, 3.6, P.z), 'พญาไม้ตื่นแล้ว!', 'st big'); }
      while (ai < ATT.length && t >= ATT[ai]) { lash(ai++); }
      if (!stormed && t >= STORM) { stormed = true; storm(); }
      if (t >= LIFE) { kill(tree); rune.auto = zone.auto = true; rune.t = zone.t = 99; return false; }
    });
    function setLean(to) { lean.copy(to).sub(P).setY(0).normalize(); leanT = 0; }
    /* roots burst from the base and whip across the ground to each ghost */
    function lash(n) {
      const targets = livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4); if (!targets.length) return;
      setLean(centroid(targets)); shake = .08;
      targets.forEach((g, k) => {
        const a = P.clone(), b = g.pos.clone(), d = b.clone().sub(a), side = V(-d.z, 0, d.x).normalize().multiplyScalar(rand(.3, .6) * (k % 2 ? 1 : -1));
        const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; const p = a.clone().lerp(b, u).addScaledVector(side, Math.sin(u * Math.PI)); p.y = Math.sin(u * Math.PI) * .45 + (u > .85 ? (u - .85) * 4 : 0) - .05; pts.push(p); }
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .085, 6), rootMat); scene.add(m);
        const total = m.geometry.index.count; m.geometry.setDrawRange(0, 0); let hit = false;
        addTask((dt, t) => {
          const f = t < .28 ? t / .28 : t < .7 ? 1 : 1 - (t - .7) / .3;
          m.geometry.setDrawRange(0, Math.floor(total * clamp01(f) / 3) * 3);
          if (t < .28 && Math.random() < .6) { const p = new THREE.CatmullRomCurve3(pts).getPoint(clamp01(t / .28)); emit({ p: p.setY(.1), v: V(rand(-.5, .5), rand(.4, 1), rand(-.5, .5)), c: DUST, life: .7, size: .3, size1: .7, shape: SH.soft, a: .6, drag: 2 }, PN); }
          if (!hit && t >= .28) {
            hit = true; if (g.alive) { hurt(g, 150); burst(chest(g), 12, { c: [C(1.2, 1.4, .4), C(.6, 1.2, .3)], size: .13, sp: 3, life: .45, shape: SH.star, drag: 4 });
              burst(V(g.pos.x, .2, g.pos.z), 14, { c: [DUST, C(.4, .33, .22)], S: PN, size: .4, size1: .9, sp: 2, upMin: .3, life: .8, shape: SH.soft, a: .7, drag: 3 });
              if (n === 0) { popup(V(g.pos.x, g.barY + .7, g.pos.z), 'รากรัด 1 วิ', 'st'); bind(g); } }
          }
          if (t > 1) { kill(m); return false; }
        });
      });
    }
    function bind(g) {
      g.stun = true; const coil = new THREE.Mesh(new THREE.TorusGeometry(.42, .06, 6, 20), rootMat); coil.rotation.x = Math.PI / 2; scene.add(coil);
      addTask((dt, t) => { coil.position.set(g.pos.x, .25 + Math.sin(t * 8) * .03, g.pos.z); coil.rotation.z += dt * 2; coil.scale.setScalar(Math.min(1, t * 6) * (t > .85 ? Math.max(.01, (1 - t) / .15) : 1));
        if (t > 1) { g.stun = false; kill(coil); return false; } });
    }
    /* finale: canopy shudders and throws a spiralling leaf storm across the whole zone */
    function storm() {
      shake = .22; flash(P.clone().setY(2), 0xc8f070, 45, .7); setLean(gc);
      shock(P.x, P.z, R, C(1.2, 1.5, .5), C(.5, .9, .3), .7); after(.15, () => shock(P.x, P.z, R * .7, C(1.4, 1.3, .5), HERB, .5));
      addTask((dt, t) => {
        for (let k = 0; k < 14; k++) { const a = rand(0, 6.28), sp = rand(2.5, 5.5);
          emit({ p: P.clone().add(V(Math.cos(a) * rand(.3, 1), rand(1.8, 3), Math.sin(a) * rand(.3, 1))), v: V(Math.cos(a) * sp, rand(-.6, .6), Math.sin(a) * sp), c: Math.random() < .55 ? C(.45, .95, .35) : Math.random() < .5 ? C(1.1, 1.3, .4) : C(.7, 1.6, .55), life: rand(.8, 1.3), size: rand(.14, .24), shape: SH.leaf, vr: rand(-9, 9), drag: .9, swirl: .9, grav: .8 }); }
        if (t > .5) return false;
      });
      livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => after(.12 + g.pos.distanceTo(P) / R * .25, () => { if (g.alive) { hurt(g, 260, true); burst(chest(g), 18, { c: [C(.6, 1.4, .4), GOLD], size: .14, sp: 3.5, life: .55, shape: SH.leaf, drag: 3 }); } }));
      /* falling leaves bless allies under the canopy on the way out */
      after(1.2, () => living().filter(a => a.pos.distanceTo(P) <= R).forEach(a => {
        let got = false;
        for (let k = 0; k < 10; k++) emit({ p: P.clone().add(V(rand(-.8, .8), rand(2, 3), rand(-.8, .8))), v: V(rand(-1, 1), rand(.5, 1.5), rand(-1, 1)), c: HERB_HOT, life: 2, size: .12, home: chest(a), homeK: 4, swirl: 2,
          onArrive: () => { if (!got) { got = true; heal(a, a.maxHp * .05); } } });
      }));
    }
  }
  return 7.2;
}
/* 48px icon for the new skill (no game icon exists yet): awakened tree with cloth band and glowing eyes */
function treeIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  const bg = g.createRadialGradient(24, 26, 4, 24, 24, 30); bg.addColorStop(0, '#3d5a26'); bg.addColorStop(1, '#101a0b'); g.fillStyle = bg; g.fillRect(0, 0, 48, 48);
  g.fillStyle = '#2f6a2a'; [[24, 13, 12], [13, 18, 8], [35, 18, 8], [24, 21, 10]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  g.fillStyle = '#4c9a3c'; [[20, 10, 4], [31, 15, 3], [12, 16, 3]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  g.fillStyle = '#5a4028'; g.beginPath(); g.moveTo(18, 44); g.lineTo(21, 24); g.lineTo(27, 24); g.lineTo(30, 44); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(10, 46); g.lineTo(19, 40); g.lineTo(18, 44); g.closePath(); g.moveTo(38, 46); g.lineTo(29, 40); g.lineTo(30, 44); g.closePath(); g.fill();
  ['#c8322b', '#e2b33a', '#3c8a3f'].forEach((col, i) => { g.fillStyle = col; g.fillRect(19.5 - i * .3, 35 + i * 2, 9 + i * .6, 2); });
  g.fillStyle = '#ffd25a'; g.fillRect(21, 28, 2, 2); g.fillRect(25, 28, 2, 2);
  g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(.5, .5, 47, 47);
  return c.toDataURL();
}
A.ic_heal_tree = treeIcon();

