/* ---------------- stylised lightning (reference: thin white-core forks, blue haze, starburst ground impact) ---------------- */
const BOLT_CORE = C(2.6, 2.8, 3.2), BOLT_GLOW = C(.22, .5, 2.2);
function boltMat() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 1 }, uCore: { value: BOLT_CORE }, uGlow: { value: BOLT_GLOW } },
    vertexShader: `attribute float side; varying float vS; void main(){ vS=side; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vS; uniform float uA; uniform vec3 uCore,uGlow;
      void main(){ float x=abs(vS); float core=1.-smoothstep(.12,.32,x); float glow=pow(1.-x,2.2); gl_FragColor=vec4((uGlow*glow*.8+uCore*core)*uA,1.); }` });
}
/* camera-facing ribbons for many polylines in one geometry; w = half width at the start, tapering to w*taper at the end */
const _v1 = V(), _v2 = V(), _v3 = V();
function ribbonGeo(paths) {
  const pos = [], side = [], idx = []; let base = 0;
  for (const { pts, w, taper = .25 } of paths) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      _v1.copy(q).sub(o).normalize(); _v2.copy(camera.position).sub(p).normalize(); _v3.crossVectors(_v1, _v2).normalize();
      const ww = w * (1 - (1 - taper) * i / (pts.length - 1));
      pos.push(p.x + _v3.x * ww, p.y + _v3.y * ww, p.z + _v3.z * ww, p.x - _v3.x * ww, p.y - _v3.y * ww, p.z - _v3.z * ww); side.push(1, -1);
      if (i) { const a = base + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += pts.length * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1)); g.setIndex(idx); return g;
}
/* jagged midpoint displacement: sharp zigzag like the reference */
function jag(a, b, disp = .2, depth = 6) {
  let pts = [a.clone(), b.clone()];
  for (let d = 0; d < depth; d++) {
    const n = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], m = p.clone().lerp(q, rand(.4, .6)), len = p.distanceTo(q);
      m.add(V(rand(-1, 1), rand(-.5, .5), rand(-1, 1)).multiplyScalar(len * disp)); n.push(m, q); }
    pts = n; disp *= .62;
  }
  return pts;
}
function forkPaths(top, bot, o = {}) {
  const main = jag(top, bot, o.disp ?? .22, 6), paths = [{ pts: main, w: o.w ?? .16, taper: .55 }];
  const nb = o.branches ?? 6, down = bot.clone().sub(top).normalize();
  for (let k = 0; k < nb; k++) {
    const i = Math.floor(main.length * rand(.15, .85)), s = main[i], out = V(rand(-1, 1), 0, rand(-1, 1)).normalize();
    const e = s.clone().addScaledVector(down, rand(.3, .9) * (o.blen ?? 1.2)).addScaledVector(out, rand(.4, 1) * (o.blen ?? 1.2));
    const br = jag(s, e, .3, 4); paths.push({ pts: br, w: (o.w ?? .16) * .55, taper: .1 });
    if (Math.random() < .55) { const j = Math.floor(br.length * rand(.3, .7)), s2 = br[j]; const e2 = s2.clone().add(V(rand(-.6, .6), rand(-.6, -.1), rand(-.6, .6)).multiplyScalar(o.blen ?? 1.2));
      paths.push({ pts: jag(s2, e2, .3, 3), w: (o.w ?? .16) * .3, taper: .1 }); }
  }
  return paths;
}
/* a flickering forked bolt from top to bot */
function lightning(top, bot, o = {}) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), boltMat()); scene.add(m); let re = 0;
  const haze = [0, .35, .7].map(u => { const s = glow(C(.25, .5, 1.8), (o.haze ?? 2.2) * (1 - u * .3)); s.position.copy(top).lerp(bot, .3 + u * .6); s.material.opacity = .35; return s; });
  const life = o.life ?? .4;
  addTask((dt, t) => {
    re -= dt; if (re <= 0) { re = o.reroll ?? .05; m.geometry.dispose(); m.geometry = ribbonGeo(forkPaths(top, bot, o)); }
    const f = t / life, fl = Math.random() < .25 ? .35 : 1; m.material.uniforms.uA.value = (f < .1 ? 1.4 : 1 - f) * fl; haze.forEach(s => s.material.opacity = .35 * (1 - f));
    if (t > life) { kill(m); haze.forEach(kill); return false; }
  });
}
/* crackle tree: small branching arcs climbing out of the ground before a strike */
function crackleTree(p, life = .35, h = 1.6) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), boltMat()); scene.add(m); let re = 0;
  addTask((dt, t) => {
    re -= dt; if (re <= 0) { re = .04; const g = clamp01(t / life); const paths = [];
      for (let k = 0; k < 3; k++) { const b = p.clone().add(V(rand(-.25, .25), 0, rand(-.25, .25))), top = b.clone().add(V(rand(-.3, .3), h * (.4 + .6 * g) * rand(.7, 1), rand(-.3, .3)));
        const pts = jag(b, top, .3, 4); paths.push({ pts, w: .06, taper: .2 });
        for (let j = 0; j < 3; j++) { const s = pts[Math.floor(pts.length * rand(.3, .9))]; paths.push({ pts: jag(s, s.clone().add(V(rand(-.5, .5), rand(.1, .5), rand(-.5, .5))), .3, 2), w: .035, taper: .1 }); } }
      m.geometry.dispose(); m.geometry = ribbonGeo(paths); }
    m.material.uniforms.uA.value = (Math.random() < .3 ? .4 : 1) * .9;
    if (t > life) { kill(m); return false; }
  });
}
/* ground impact: white starburst spikes, crawling ground arcs, blue pool, flying sparks */
function boltImpact(p, s = 1) {
  const spikes = []; for (let k = 0; k < 13; k++) { const a = rand(0, 6.28), up = rand(.15, 1), dir = V(Math.cos(a) * (1 - up * .6), up, Math.sin(a) * (1 - up * .6)).normalize(); spikes.push({ dir, len: rand(.5, 1.5) * s * (k < 3 ? 1.6 : 1) }); }
  const star = new THREE.Mesh(new THREE.BufferGeometry(), boltMat()); scene.add(star);
  const crawl = new THREE.Mesh(new THREE.BufferGeometry(), boltMat()); scene.add(crawl);
  let re = 0;
  addTask((dt, t) => {
    const f = t / .3;
    star.geometry.dispose(); star.geometry = ribbonGeo(spikes.map(sp => ({ pts: [p.clone().add(V(0, .05, 0)), p.clone().addScaledVector(sp.dir, sp.len * (.4 + .6 * Math.min(1, f * 3)))], w: .09 * s, taper: .02 })));
    star.material.uniforms.uA.value = Math.max(0, 1.3 - f);
    re -= dt; if (re <= 0) { re = .05; const paths = []; for (let k = 0; k < 7; k++) { const a = rand(0, 6.28), r = rand(.7, 1.7) * s; paths.push({ pts: jag(p.clone().setY(.04), V(p.x + Math.cos(a) * r, .04, p.z + Math.sin(a) * r), .25, 4).map(q => q.setY(.04)), w: .05 * s, taper: .1 }); }
      crawl.geometry.dispose(); crawl.geometry = ribbonGeo(paths); }
    crawl.material.uniforms.uA.value = Math.max(0, 1 - t / .55) * (Math.random() < .25 ? .4 : 1);
    if (t > .55) { kill(star); kill(crawl); return false; }
  });
  const pool = glow(C(.3, .6, 2.2), 2.4 * s); pool.position.copy(p).setY(.3);
  addTask((dt, t) => { pool.material.opacity = Math.max(0, .8 - t / .6); pool.scale.setScalar(2.4 * s * (1 + t)); if (t > .6) { kill(pool); return false; } });
  shock(p.x, p.z, 1.5 * s, C(1.4, 1.7, 2.8), C(.25, .45, 1.6), .4);
  burst(p.clone().setY(.15), 22, { c: [BOLT_CORE, C(.6, .9, 2.6)], size: .09, sp: 5, upMin: .4, upK: 1.3, life: .5, shape: SH.star, grav: 7, drag: 1.5 });
  burst(p.clone().setY(.3), 10, { c: C(.2, .4, 1.4), size: .5, size1: 1.1, sp: 1.2, upMin: .3, life: .8, shape: SH.soft, a: .45, drag: 2 });
}

