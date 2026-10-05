/* 2 · ขวดยาเด้งห้าทิศ — a corked herb bottle tumbles ally → ghost → ally, spilling each hit and shattering on the last */
function bottleMesh() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); inner.position.y = -.24;
  const pts = [[0, 0], [.13, 0], [.165, .04], [.175, .2], [.13, .3], [.065, .34], [.058, .43], [.075, .45], [.07, .47]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), new THREE.MeshStandardMaterial({ color: 0xc98a3a, transparent: true, opacity: .5, roughness: .08, metalness: .2, emissive: 0x3a1c04, side: THREE.DoubleSide, depthWrite: false }));
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.14, .125, .2, 16), new THREE.MeshBasicMaterial({ color: C(.55, 1.5, .45) })); liquid.position.y = .11;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(.055, .048, .08, 10), new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: .9 })); cork.position.y = .5;
  const cord = new THREE.Mesh(new THREE.TorusGeometry(.064, .012, 6, 18), new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: .7 })); cord.rotation.x = Math.PI / 2; cord.position.y = .42;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(.178, .178, .09, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8dcb0, roughness: 1, side: THREE.DoubleSide })); label.position.y = .17;
  inner.add(glass, liquid, cork, cord, label); g.scale.setScalar(1.7); g.userData.liquid = liquid; scene.add(g); return g;
}
function skPill() {
  const first = lowest(); if (!first) return 1; castAt(first.pos);
  const seq = []; let prevAlly = first; const usedA = [first];
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) { const a = i === 0 ? first : (lowest(usedA.slice(-1)) || first); seq.push(a); usedA.push(a); prevAlly = a; }
    else { const gs = livingGhosts().sort((x, y) => x.pos.distanceTo(prevAlly.pos) - y.pos.distanceTo(prevAlly.pos)); seq.push(gs[(i >> 1) % Math.max(1, gs.length)] || prevAlly); }
  }
  const bot = bottleMesh(), halo = glow(C(.35, 1.0, .35), 1.1); halo.material.opacity = .55;
  let from = staffTip(), hop = 0, ht = 0;
  addTask((dt, t) => {
    if (t < .25) { bot.position.copy(from); halo.position.copy(from); return; }
    const tgt = seq[hop]; const to = chest(tgt); ht += dt; const u = Math.min(1, ht / .38);
    const p = arcPoint(from, to, 1.5, u); bot.position.copy(p); halo.position.copy(p);
    bot.rotation.z -= dt * 15; bot.rotation.y += dt * 4;
    /* herb droplets drip from the tumbling bottle */
    if (Math.random() < .7) emit({ p: p.clone().add(V(rand(-.08, .08), .1, rand(-.08, .08))), v: V(rand(-.3, .3), rand(0, .6), rand(-.3, .3)), c: C(.55, 1.5, .45), life: .5, size: .07, grav: 6 });
    emit({ p: p.clone(), c: C(.4, 1.1, .4), life: .3, size: .22, size1: .02, a: .5 });
    if (u >= 1) {
      const last = hop === seq.length - 1;
      bot.userData.liquid.scale.y = Math.max(.15, 1 - (hop + 1) * .18); bot.userData.liquid.position.y = .11 - (1 - bot.userData.liquid.scale.y) * .1;
      splash(to, tgt.mob, last);
      if (tgt.mob) {
        hurt(tgt, last ? 190 : 140); flash(to, 0x9fd860, 30, .4);
        const g = tgt, pud = decal(5, g.pos.x, g.pos.z, 1.1, C(.35, .8, .15), null, { life: 1.8, grow: .25 });
        addTask((dt2, t2) => { if (Math.random() < dt2 * 14) emit({ p: chest(g).add(V(rand(-.3, .3), rand(-.4, .5), rand(-.3, .3))), v: V(0, .8, 0), c: C(.6, 1.6, .2), life: .6, size: .1 }); if (t2 > 1.5) return false; });
        if (hop === 1) popup(V(g.pos.x, g.barY + .7, g.pos.z), 'พิษสมุนไพร', 'st');
      } else {
        heal(tgt, tgt.maxHp * .35); flash(to, 0x7dff9a, 22, .35); shock(tgt.pos.x, tgt.pos.z, 1.2, HERB_HOT, HERB);
        burst(to, 12, { c: LEAF, size: .2, sp: 2.2, life: .9, shape: SH.leaf, grav: 1.5, upMin: .5 });
      }
      from = to; hop++; ht = 0;
      if (last) { kill(bot); kill(halo); return false; }
    }
  });
  function splash(p, mob, last) {
    const liq = mob ? [C(.5, 1.2, .2), C(.8, 1.5, .3)] : [C(.5, 1.6, .5), C(1.1, 2, 1)];
    burst(p, last ? 46 : 22, { c: liq, size: .11, sp: last ? 3.6 : 2.6, upMin: .5, upK: 1.3, life: .8, grav: 7, drag: .5 });
    if (mob) burst(p, 18, { c: [C(.42, .5, .2), C(.3, .38, .16)], S: PN, size: .4, size1: .9, sp: 2.2, life: .9, shape: SH.soft, a: .7, drag: 3 });
    if (last) {
      /* glass shatters: amber shards fall and tumble */
      burst(p, 34, { c: [C(1.6, 1.0, .45), C(1.2, 1.3, 1.1)], size: .09, sp: 4, upMin: .4, upK: 1.4, life: 1.1, grav: 9, drag: .3, shape: SH.star });
      burst(p, 8, { c: C(.5, .38, .25), S: PN, size: .07, sp: 3, upMin: .6, life: 1.2, grav: 9, drag: .2, shape: SH.soft, a: 1 });
      shock(p.x, p.z, 2.2, C(1.6, 1.1, .45), HERB, .55); shake = .1;
      popup(V(p.x, 2.9, p.z), 'เพล้ง!', 'st');
    }
  }
  return 2.6;
}

/* 3 · ดงหนามหนาดเสก — enchanted หนาด seed lands mid-pack; พุทรา thorns erupt in three outward waves over a wide circle */
const thornTipMat = new THREE.MeshBasicMaterial({ color: C(1.25, 1.1, .45) });
function skThorn() {
  const pack = livingGhosts().length ? livingGhosts() : ghosts;
  const P = centroid(pack), R = 4.1; castAt(P);
  const seed = glow(C(1.4, 1.9, .6), .55), from = staffTip();
  addTask((dt, t) => {
    const u = clamp01((t - .2) / .5); seed.position.copy(arcPoint(from, V(P.x, .2, P.z), 2.2, u));
    emit({ p: seed.position.clone(), c: C(.9, 1.4, .4), life: .35, size: .14, size1: 0 });
    if (u < 1) return; kill(seed); erupt(); return false;
  });
  function erupt() {
    /* spikes: instanced cones leaning outward, skipped where an ally stands */
    const N = 170, spikes = [];
    for (let i = 0; i < N * 3 && spikes.length < N; i++) {
      const a = rand(0, 6.28), r = Math.sqrt(rand(.03, 1)) * R, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (party.some(m => Math.hypot(m.pos.x - x, m.pos.z - z) < .75)) continue;
      spikes.push({ x, z, a, r, h: rand(.55, 1.35) * (1.15 - r / R * .35), lean: rand(.15, .45), tw: rand(0, 6.28) });
    }
    const geo = new THREE.ConeGeometry(.085, 1, 5); geo.translate(0, .5, 0);
    const body = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: .8, emissive: 0x16220a, flatShading: true }), spikes.length);
    const tgeo = new THREE.ConeGeometry(.03, .28, 4); tgeo.translate(0, .86, 0);
    const tips = new THREE.InstancedMesh(tgeo, thornTipMat, spikes.length);
    body.frustumCulled = tips.frustumCulled = false; scene.add(body, tips);
    const rune = decal(4, P.x, P.z, R * 1.02, C(.55, .9, .25), C(.9, .7, .25), { auto: false });
    const crack = decal(1, P.x, P.z, R, C(.8, .75, .3), null, { auto: false, alpha: .8 });
    flash(P, 0xc8e060, 40, .6); shake = .12;
    const WAVES = [0, .55, 1.1], RISE = .55, d = new THREE.Object3D(), hitCount = new Map();
    let fired = 0;
    addTask((dt, t) => {
      rune.u.uAlpha.value = clamp01(t * 4) * clamp01((2.6 - t) / .5); crack.u.uAlpha.value = .8 * clamp01(t * 3) * clamp01((2.6 - t) / .5);
      while (fired < WAVES.length && t >= WAVES[fired]) wave(fired++);
      spikes.forEach((s, i) => {
        let k = 0;
        for (let w = 0; w < WAVES.length; w++) {
          const x = (t - WAVES[w] - s.r / R * .35) / RISE;
          if (x > 0 && x < 1) k = Math.max(k, (w === 2 ? 1.25 : 1) * Math.sin(Math.pow(x, .55) * Math.PI));
        }
        d.position.set(s.x, -.05, s.z); d.rotation.set(0, -s.a + Math.PI / 2, 0); d.rotateX(s.lean + Math.sin(t * 9 + s.tw) * .03);
        d.scale.set(1, Math.max(.001, k * s.h), 1); d.updateMatrix(); body.setMatrixAt(i, d.matrix); tips.setMatrixAt(i, d.matrix);
      });
      body.instanceMatrix.needsUpdate = tips.instanceMatrix.needsUpdate = true;
      if (t > 2.7) { kill(body); kill(tips); rune.auto = crack.auto = true; rune.t = crack.t = 99; drainBack(); return false; }
    });
    function wave(w) {
      const strong = w === 2;
      after(.0, () => {
        shock(P.x, P.z, R, strong ? C(1.6, 1.3, .45) : C(.9, 1.3, .35), C(.6, .5, .2), .55); shake = strong ? .2 : .1;
        flash(P, strong ? 0xffd070 : 0xa8d860, strong ? 45 : 25, .4);
      });
      /* ring of dust + หนาด leaves rides the wavefront outward */
      addTask((dt, t) => {
        const r = clamp01(t / .35) * R;
        for (let k = 0; k < (strong ? 9 : 6); k++) {
          const a = rand(0, 6.28), p = V(P.x + Math.cos(a) * r, .1, P.z + Math.sin(a) * r);
          if (Math.random() < .5) emit({ p, v: V(Math.cos(a) * .8, rand(.6, 1.4), Math.sin(a) * .8), c: Math.random() < .5 ? DUST : C(.36, .3, .2), life: rand(.7, 1.1), size: rand(.3, .5), size1: rand(.8, 1.2), shape: SH.soft, a: .6, drag: 2 }, PN);
          else emit({ p: p.add(V(0, .4, 0)), v: V(Math.cos(a) * rand(.5, 1.5), rand(1.5, 3), Math.sin(a) * rand(.5, 1.5)), c: Math.random() < .6 ? C(.55, .85, .45) : C(.8, 1.0, .7), life: 1.2, size: rand(.13, .2), shape: SH.leaf, vr: rand(-6, 6), grav: 2.2, drag: 1 });
        }
        if (t > .35) return false;
      });
      livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .5).forEach(g => after(g.pos.distanceTo(P) / R * .35 + .12, () => {
        if (!g.alive) return;
        hurt(g, strong ? 210 : 165, strong); hitCount.set(g, (hitCount.get(g) || 0) + 1);
        burst(chest(g), 12, { c: [C(1.3, 1.1, .45), C(.7, 1.2, .3)], size: .12, sp: 3, life: .45, shape: SH.star, drag: 4 });
        if (w === 0) { popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ติดหนาม 1.2 วิ', 'st'); root(g); }
      }));
    }
    function root(g) {
      g.stun = true;
      addTask((dt, t) => {
        if (Math.random() < dt * 18) { const a = rand(0, 6.28); emit({ p: V(g.pos.x + Math.cos(a) * .45, .05, g.pos.z + Math.sin(a) * .45), v: V(-Math.cos(a) * .2, rand(.8, 1.6), -Math.sin(a) * .2), c: C(.55, .4, .2), life: .35, size: .1, shape: SH.leaf, S: PN }, PN); }
        if (t > 1.2) { g.stun = false; return false; }
      });
    }
    /* ghosts that were pierced bleed light back to the most hurt ally (4% each) */
    function drainBack() {
      const n = hitCount.size; if (!n) return; const a = lowest(); if (!a) return;
      let got = 0;
      hitCount.forEach((_, g) => {
        for (let k = 0; k < 8; k++) emit({ p: chest(g).add(V(rand(-.3, .3), rand(0, .5), rand(-.3, .3))), v: V(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), c: Math.random() < .6 ? HERB_HOT : GOLD, life: 2.4, size: .12, home: chest(a), homeK: 4.5, swirl: 2,
          onArrive: k === 0 ? () => { got++; if (got === n) heal(a, a.maxHp * .04 * n); burst(chest(a), 6, { c: HERB_HOT, size: .12, sp: 1.6, life: .45, shape: SH.star }); } : null });
      });
    }
  }
  return 4.2;
}
/* 48px icon for the new skill (no game icon exists yet): thorn spikes over a rune disc */
function thornIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  const bg = g.createRadialGradient(24, 30, 4, 24, 26, 30); bg.addColorStop(0, '#5f7a2a'); bg.addColorStop(1, '#16220e'); g.fillStyle = bg; g.fillRect(0, 0, 48, 48);
  g.strokeStyle = '#d8b75a'; g.lineWidth = 2; g.beginPath(); g.ellipse(24, 36, 17, 6, 0, 0, 7); g.stroke();
  [[10, 38, 16, 14, -.25], [18, 38, 22, 8, -.08], [26, 38, 27, 6, .05], [33, 38, 37, 11, .2], [39, 39, 43, 19, .35]].forEach(([x, y, tx, ty]) => {
    g.fillStyle = '#4a321c'; g.beginPath(); g.moveTo(x - 3.5, y); g.lineTo(tx, ty); g.lineTo(x + 3.5, y); g.closePath(); g.fill();
    g.fillStyle = '#f0dc7a'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + (x - tx) * .25 - 1.2, ty + (y - ty) * .25); g.lineTo(tx + (x - tx) * .25 + 1.2, ty + (y - ty) * .25); g.closePath(); g.fill();
  });
  g.fillStyle = '#9fd36a'; [[14, 28], [30, 22], [36, 30]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 3.2, 1.6, .6, 0, 7); g.fill(); });
  g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(.5, .5, 47, 47);
  return c.toDataURL();
}
A.ic_heal_thorn = thornIcon();

