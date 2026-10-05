/* ---------------- party + ghosts ---------------- */
const HK = .021, GK = .034;
const heroA = (sheets, x, z, name, extra = {}) => makeActor({ sheets, x, z, fw: 128, fh: 136, k: HK, cy: .1, shadow: 1, maxHp: 1000, barY: 2.15, name, ...extra });
let hero, party, ghosts;
const HOME = V(0, 0, -.6);
const GH_SPOTS = [[1.5, -4.3], [-1.4, -4.6], [3.7, -3.4], [-3.6, -3.2]];
async function build() {
  hero = await heroA({ idle: 'hero_idle', walk: 'hero_walk', slash: 'hero_slash', die: 'hero_die' }, HOME.x, HOME.z, 'ขุนศึก', { hpStart: .8, front: true });
  const healer = await heroA({ idle: 'healer_idle' }, -2.4, 1.9, 'หมอยา', { hpStart: .9 });
  const boxer = await heroA({ idle: 'boxer_idle', die: 'boxer_die' }, 2.4, -.2, 'นักมวย', { hpStart: .6, front: true });
  const archer = await heroA({ idle: 'archer_idle', die: 'archer_die' }, .9, 2.6, 'นักธนู', { hpStart: .75 });
  party = [hero, healer, boxer, archer];
  ghosts = [];
  for (let i = 0; i < 4; i++) {
    const k = i % 2 ? 'phrai' : 'pob'; const [x, z] = GH_SPOTS[i];
    const g = await makeActor({ sheets: { idle: k + '_idle', attack: k + '_attack', die: k + '_die' }, x, z, fw: 72, fh: 72, k: GK, cy: .06, shadow: 1.3, maxHp: 2600, barY: 2.3, mob: true, spot: [x, z] });
    g.row = dirRow(-x, -z); ghosts.push(g);
  }
  hero.row = 4; healer.row = dirRow(1, -1); boxer.row = dirRow(-.3, -1); archer.row = 4;
}
const living = () => party.filter(a => !a.down);
const livingGhosts = () => ghosts.filter(g => g.alive);
function heal(a, amt, cls = 'heal') {
  if (a.down) return; const v = Math.round(amt); a.hp = Math.min(a.maxHp, a.hp + v);
  popup(headP(a), '+' + v, cls); a.tint = Math.max(a.tint, .6); a.tintC = C(.72, 1.02, .72);
}
function hurt(g, amt, crit, push = .25) {
  if (!g.alive) return; const v = Math.round(amt * rand(.9, 1.1) * (hero.rage ? 1.35 : 1)); g.hp -= v; g.tint = 1; g.tintC = C(1.15, 1.15, 1);
  popup(headP(g), String(v), 'dmg' + (crit ? ' big' : ''));
  const dir = g.pos.clone().sub(hero.pos).setY(0).normalize().multiplyScalar(push);
  addTask((dt, t) => { const k = Math.sin(Math.min(1, t / .25) * Math.PI); g.off.copy(dir).multiplyScalar(k); if (t > .25) { g.off.set(0, 0, 0); return false; } });
  if (g.hp <= 0) ghostDie(g);
}
function ghostDie(g) {
  g.alive = false; play(g, 'die', { hold: true, fps: 10 });
  burst(chest(g), 30, { c: C(.25, .2, .3), S: PN, size: .6, size1: 1.2, sp: 1.2, upMin: .3, life: 1.4, shape: SH.soft, a: .7 });
  after(1.3, () => addTask((dt, t) => { g.fade = Math.max(0, 1 - t / .6); if (t > .6) return false; }));
  after(3.2, () => {
    g.hp = g.maxHp; g.alive = true; g.fade = 1; play(g, 'idle');
    burst(V(g.pos.x, .3, g.pos.z), 26, { c: C(.18, .14, .22), S: PN, size: .7, size1: 1.4, sp: 1, upMin: .5, life: 1.2, shape: SH.soft, a: .8 });
  });
}
/* ghosts keep poking the front line */
let ghostClock = 1;
function ghostAI(dt) {
  ghostClock -= dt; if (ghostClock > 0) return; ghostClock = rand(1.2, 2);
  const g = livingGhosts().filter(x => !x.stun)[(Math.random() * 4) | 0]; if (!g) return;
  const targets = living().filter(a => a.front); const a = targets[(Math.random() * targets.length) | 0]; if (!a) return;
  g.row = dirRow(a.pos.x - g.pos.x, a.pos.z - g.pos.z);
  play(g, 'attack', { once: () => play(g, 'idle'), fps: 12 });
  after(.3, () => {
    if (a.down) return;
    if (a === hero && hero.guard) { popup(headP(a), 'บล็อก', 'st'); burst(chest(a).add(V(0, 0, -.3)), 12, { c: [C(1.6, 1.3, .6), WHITE], size: .1, sp: 3, life: .3, shape: SH.star }); return; }
    const dmg = a.maxHp * rand(.05, .1); a.hp = Math.max(a.maxHp * .15, a.hp - dmg); a.tint = 1; a.tintC = C(1.15, .3, .3);
    popup(headP(a), '-' + Math.round(dmg), 'hurt');
    burst(chest(a), 10, { c: C(.9, .2, 1.1), size: .18, sp: 2.5, life: .4, shape: SH.star });
  });
}

/* ---------------- movement + attack helpers ---------------- */
function arcPoint(a, b, h, u) { const p = a.clone().lerp(b, u); p.y += Math.sin(u * Math.PI) * h; return p; }
const centroid = list => list.reduce((s, a) => s.add(a.pos), V()).multiplyScalar(1 / list.length).setY(0);
function face(a, p) { a.row = dirRow(p.x - a.pos.x, p.z - a.pos.z); }
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
function moveTo(a, to, dur, cb, opt = {}) {
  const from = a.pos.clone(); face(a, to); if (opt.walk) play(a, 'walk', { fps: 14 });
  let ghostT = 0;
  addTask((dt, t) => {
    const u = clamp01(t / dur), e = opt.linear ? u : ease(u); a.pos.copy(from).lerp(to, e);
    a.off.y = opt.hop ? Math.sin(u * Math.PI) * opt.hop : 0;
    if (opt.trail) { ghostT -= dt; if (ghostT <= 0) { ghostT = .035; afterimage(a, opt.trail); } }
    if (u >= 1) { a.off.y = 0; if (opt.walk) play(a, 'idle'); cb && cb(); return false; }
  });
}
function afterimage(a, color, life = .3) {
  const m = new THREE.SpriteMaterial({ map: a.sp.material.map, color, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending });
  const g = new THREE.Sprite(m); g.center.copy(a.sp.center); g.scale.copy(a.sp.scale); g.position.copy(a.sp.position); scene.add(g);
  const mapC = a.sp.material.map.clone(); mapC.needsUpdate = true; m.map = mapC;
  addTask((dt, t) => { m.opacity = .5 * (1 - t / life); if (t > life) { scene.remove(g); m.dispose(); mapC.dispose(); return false; } });
}
function swing(fps = 22, cb) { play(hero, 'slash', { fps, once: () => { play(hero, 'idle'); cb && cb(); } }); offSwing(.06, Math.max(.16, 5 / fps)); }
const nearestGhost = (p = hero.pos) => livingGhosts().sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p))[0] || ghosts[0];
function goHome(dur = .45) { moveTo(hero, HOME, dur, () => { hero.row = 4; }, { walk: true }); }
/* ghosts inside a forward cone of the hero */
function inFront(range, halfAng, from = hero.pos, dirTo) {
  const d = dirTo.clone().setY(0).normalize();
  return livingGhosts().filter(g => { const v = g.pos.clone().sub(from).setY(0); const l = v.length(); return l <= range && (l < .3 || v.normalize().dot(d) >= Math.cos(halfAng)); });
}

/* ---------------- second blade: the sprite only draws one sword, so the off-hand ดาบ is a pixel sprite held opposite it ---------------- */
const offTex = (() => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 48; const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  /* slightly curved Thai ดาบ blade, tip at the top */
  for (let y = 2; y < 34; y++) { const bend = Math.round(Math.sin((y - 2) / 32 * Math.PI * .5) * 2); const x0 = 6 + bend - (y < 5 ? 0 : 0), w = y < 4 ? 1 : y < 7 ? 2 : 3;
    for (let k = 0; k < w; k++) px(x0 + k, y, k === 0 ? '#e9eef5' : k === w - 1 ? '#5d6878' : '#a9b4c4'); px(x0 - 1, y, '#20242c'); px(x0 + w, y, '#20242c'); }
  for (let x = 3; x < 13; x++) { px(x, 34, x === 3 || x === 12 ? '#3a2a10' : '#d8a63c'); px(x, 35, x === 3 || x === 12 ? '#3a2a10' : '#8a6420'); }
  for (let y = 36; y < 44; y++) { px(7, y, y % 2 ? '#7a1f1f' : '#4a1212'); px(8, y, y % 2 ? '#4a1212' : '#7a1f1f'); px(6, y, '#1a0c0c'); px(9, y, '#1a0c0c'); }
  for (let x = 6; x < 10; x++) { px(x, 44, '#d8a63c'); px(x, 45, '#8a6420'); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; return t;
})();
/* which screen side the sprite's own sword is on, per facing row (S, SE, E, NE, N, NW, W, SW) → the off-hand goes on the other side */
const OFF_SIDE = [1, -1, -1, -1, 1, 1, 1, 1], OFF_BEHIND = [0, 1, 1, 1, 0, 0, 0, 0];
let OFF = null;
function makeOffhand() {
  const m = new THREE.SpriteMaterial({ map: offTex, transparent: true, alphaTest: .3, depthWrite: true });
  const s = new THREE.Sprite(m); s.center.set(.5, .1); s.scale.set(16 * HK * 1.15, 48 * HK * 1.15, 1); s.renderOrder = 1; scene.add(s);
  OFF = { s, swingT: 9, swingDur: .26, glowT: 9 };
  addTask((dt, t) => { stepOffhand(dt, t); });
}
function offSwing(delay = .07, dur = .26) { if (!OFF) return; after(delay, () => { OFF.swingT = 0; OFF.swingDur = dur; OFF.glowT = 0; }); }
const camRight = V(), camFwd = V();
function stepOffhand(dt, t) {
  if (!OFF || !hero) return; const { s } = OFF;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize(); camera.getWorldDirection(camFwd);
  const side = OFF_SIDE[hero.row], behind = OFF_BEHIND[hero.row];
  OFF.swingT += dt; OFF.glowT += dt;
  const u = clamp01(OFF.swingT / OFF.swingDur);
  /* rest: blade hangs down and outward · swing: raise back, then cut across the body */
  const rest = -side * (Math.PI - .55) + Math.sin(t * 2.2) * .04;
  let rot = rest, reach = 0;
  if (u < 1) { const raise = -side * .35, cut = -side * (Math.PI + .9); rot = u < .3 ? rest + (raise - rest) * (u / .3) : raise + (cut - raise) * ease((u - .3) / .7); reach = Math.sin(u * Math.PI) * .18; }
  s.material.rotation = rot;
  s.position.copy(hero.sp.position).addScaledVector(camRight, side * (.3 + reach)).add(V(0, .82 + reach * .6, 0)).addScaledVector(camFwd, behind ? .12 : -.08);
  const g = Math.max(0, 1 - OFF.glowT / .3); s.material.color.setRGB(.82 + g * .5, .82 + g * .55, .82 + g * .7);
  s.material.opacity = hero.fade;
}

/* ---------------- palette for FX (HDR values feed the bloom) ---------------- */
const STEEL = C(1.5, 1.7, 2.0), STEEL_SOFT = C(.6, .75, 1.0), BLOOD = C(1.4, .12, .12), EMBER = C(2.4, .95, .25), FIRE = C(2.6, .6, .12),
  GOLD = C(2.2, 1.6, .6), GOLD_SOFT = C(1.2, .9, .35), WIND = C(.7, 1.6, 1.7), WHITE = C(2.2, 2.2, 2), BOLT = C(1.4, 1.7, 2.6), RAGE = C(2.2, .25, .15), DUST = C(.48, .4, .26),
  HERB_HOT = C(1.4, 3, 1.3);

/* ---------------- blade arcs (ring segment + head-to-tail shader) ---------------- */
const arcGeoCache = {};
function arcMat(c1, c2, sweep, start) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC1: { value: c1 }, uC2: { value: c2 }, uP: { value: 0 }, uA: { value: 1 }, uSweep: { value: sweep }, uStart: { value: start }, uIn: { value: .6 }, uTail: { value: 1.1 } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vP; uniform vec3 uC1,uC2; uniform float uP,uA,uSweep,uStart,uIn,uTail;
      void main(){ float an=mod(atan(vP.y,vP.x)-uStart+12.566,6.2832); float f=an/uSweep; if(f>1.) discard;
        float w=clamp((length(vP)-uIn)/(1.-uIn),0.,1.);
        float a=smoothstep(uP-uTail,uP,f)*step(f,uP); a*=smoothstep(0.,.18,w)*(1.-smoothstep(.985,1.,w));
        vec3 c=mix(uC2,uC1,pow(w,1.3))*(.75+1.6*pow(w,3.)); gl_FragColor=vec4(c*a*uA,1.); }` });
}
/* center p, radius r, aim = world point it faces, sweep radians, roll tilts the blade plane, dir ±1 swing direction */
function slashArc(p, aim, o = {}) {
  const r = o.r ?? 1.4, sweep = o.sweep ?? 2.4, start = Math.PI / 2 - sweep / 2, inner = o.inner ?? .5;
  const key = inner.toFixed(2); if (!arcGeoCache[key]) arcGeoCache[key] = new THREE.RingGeometry(inner, 1, 64, 1, 0, Math.PI * 2);
  const m = new THREE.Mesh(arcGeoCache[key], arcMat(o.c1 || STEEL, o.c2 || STEEL_SOFT, sweep, start)); m.material.uniforms.uIn.value = inner;
  if (o.tail) m.material.uniforms.uTail.value = o.tail;
  const G = new THREE.Group(), T = new THREE.Group(); G.add(T); T.add(m); scene.add(G);
  G.position.copy(p); const tgt = aim.clone(); tgt.y = p.y; if (tgt.distanceTo(p) < .01) tgt.z -= 1; G.lookAt(tgt);
  T.rotation.z = o.roll ?? 0; T.rotation.x = o.pitch ?? 0; m.rotation.x = Math.PI / 2; if ((o.dir ?? 1) < 0) m.rotation.y = Math.PI;
  m.scale.setScalar(r);
  const dur = Math.max(.3, (o.dur ?? .22) * 2.2);
  addTask((dt, t) => { const u = t / dur; m.material.uniforms.uP.value = u * (1 + (o.tail || 1.1)); m.material.uniforms.uA.value = 1 - clamp01((u - 1.1) / .7);
    if (o.spin) G.rotation.y += dt * o.spin; if (u > 1.85) { scene.remove(G); m.material.dispose(); return false; } });
  return G;
}
function sparks(p, n = 14, c = [WHITE, C(2.2, 1.5, .6)]) { burst(p, n, { c, size: .1, sp: 5, upMin: .1, upMax: .9, life: .35, shape: SH.star, drag: 5, grav: 4 }); }
/* jagged lightning tube that re-rolls every few frames */
function bolt(a, b, life = .45, w = .05) {
  const mk = () => { const pts = []; const n = 14; for (let i = 0; i <= n; i++) { const u = i / n, p = a.clone().lerp(b, u); if (i && i < n) p.add(V(rand(-.35, .35), rand(-.15, .15), rand(-.35, .35)).multiplyScalar(Math.sin(u * Math.PI) + .2)); pts.push(p); } return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .1); };
  const core = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C(2.6, 2.7, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C(.35, .5, 1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(core, halo); let re = 0;
  addTask((dt, t) => {
    re -= dt; if (re <= 0) { re = .05; const c = mk(); core.geometry.dispose(); halo.geometry.dispose(); core.geometry = new THREE.TubeGeometry(c, 40, w, 5); halo.geometry = new THREE.TubeGeometry(c, 40, w * 3.5, 6); }
    const o = (1 - t / life) * (Math.random() < .2 ? .4 : 1); core.material.opacity = o; halo.material.opacity = o * .6;
    if (t > life) { kill(core); kill(halo); return false; }
  });
}
function stunStars(g, dur) {
  g.stun = true;
  addTask((dt, t) => { for (let k = 0; k < 3; k++) { const an = t * 6 + k * 2.09; emit({ p: V(g.pos.x + Math.cos(an) * .35, g.barY + .05, g.pos.z + Math.sin(an) * .35), c: C(2.2, 2, .6), life: .08, size: .16, shape: SH.star }); } if (t > dur) { g.stun = false; return false; } });
}
function bleed(g) {
  let n = 0;
  addTask((dt, t) => {
    if (Math.random() < dt * 10) emit({ p: chest(g).add(V(rand(-.25, .25), rand(-.2, .4), .1)), v: V(rand(-.3, .3), rand(0, .5), 0), c: BLOOD, life: .6, size: .07, grav: 5, a: .9 });
    if (t > .6 * (n + 1) && n < 3) { n++; if (g.alive) { g.hp -= 30; popup(headP(g), '30', 'hurt'); if (g.hp <= 0) ghostDie(g); } }
    if (t > 1.9) return false;
  });
}

/* =================== SKILLS =================== */

/* 1 · ฟันดาบคู่ — step in, three crossing steel arcs (X pattern), sparks, bleeding */
function skTwin() {
  const tg = nearestGhost(), stand = tg.pos.clone().add(hero.pos.clone().sub(tg.pos).setY(0).normalize().multiplyScalar(1.3));
  moveTo(hero, stand, .28, () => {
    face(hero, tg.pos); const dir = tg.pos.clone().sub(hero.pos);
    [[.55, 1], [-.55, -1], [0, 1]].forEach(([roll, d], i) => after(i * .13, () => {
      if (i === 0) swing(26); else offSwing(0, .16);
      slashArc(chest(hero), tg.pos, { r: 1.55, sweep: 2.3, roll, dir: d, c1: i === 2 ? C(2.4, 2.2, 2.2) : STEEL, c2: i === 2 ? BLOOD : STEEL_SOFT, dur: .14 });
      inFront(2.2, 1.1, hero.pos, dir).forEach(g => { hurt(g, 160, i === 2); sparks(chest(g)); if (i === 2) bleed(g); });
      shake = .05;
    }));
    after(.75, () => goHome());
  }, { trail: C(.5, .6, .9) });
  return 2.1;
}

/* 2 · แทงทะลวง — gathering glint, then a dash straight through the line; a long piercing light lance + shattered armour shards */
function skThrust() {
  const tg = nearestGhost(), dir = tg.pos.clone().sub(hero.pos).setY(0).normalize(), end = hero.pos.clone().addScaledVector(dir, 4.2);
  face(hero, tg.pos);
  const glint = glow(C(2.4, 2.4, 2.6), .2); glint.position.copy(chest(hero)).addScaledVector(dir, .5);
  addTask((dt, t) => { glint.scale.setScalar(.2 + t * 2.4); glint.material.opacity = 1 - t / .35; if (Math.random() < .7) emit({ p: chest(hero).addScaledVector(dir, .5).add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(.9)), c: STEEL, life: .25, size: .06, home: chest(hero).addScaledVector(dir, .5), homeK: 6 }); if (t > .35) { kill(glint); return false; } });
  after(.35, () => {
    swing(30); const start = hero.pos.clone(); const hit = new Set(); popup(V(hero.pos.x, 3, hero.pos.z), 'อมตะ', 'st');
    /* lance: stretched glow along the path */
    const lance = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: C(2.2, 2.4, 2.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const lanceH = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: C(.4, .55, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(lance, lanceH);
    moveTo(hero, end, .22, () => after(.35, () => goHome(.5)), { linear: true, trail: C(.6, .75, 1.2) });
    addTask((dt, t) => {
      const head = hero.pos.clone().setY(.95).addScaledVector(dir, .7), tail = start.clone().setY(.95), len = head.distanceTo(tail);
      [lance, lanceH].forEach(m => { m.position.copy(head).add(tail).multiplyScalar(.5); m.scale.set(1, Math.max(.01, len), 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir); m.material.opacity = t < .22 ? 1 : Math.max(0, 1 - (t - .22) / .35); });
      for (let k = 0; k < 3; k++) emit({ p: head.clone().add(V(rand(-.3, .3), rand(-.3, .4), rand(-.3, .3))), v: dir.clone().multiplyScalar(-rand(2, 5)).add(V(0, rand(0, .6), 0)), c: Math.random() < .5 ? WIND : STEEL, life: .3, size: .07, size1: .01, drag: 2 });
      livingGhosts().forEach(g => { if (hit.has(g)) return; const v = g.pos.clone().sub(start).setY(0), along = v.dot(dir), side = v.clone().sub(dir.clone().multiplyScalar(along)).length();
        if (along > 0 && along < start.distanceTo(hero.pos) + .4 && side < .9) { hit.add(g); hurt(g, 300, true, .5); sparks(chest(g), 20); stunStars(g, .5);
          popup(V(g.pos.x, g.barY + .7, g.pos.z), 'เกราะแตก −30%', 'st');
          burst(chest(g), 16, { c: [C(.7, .75, .85), C(1.2, 1.25, 1.4)], size: .1, sp: 3.5, upMin: .3, life: .9, grav: 7, shape: SH.star, drag: .5 }); } });
      if (t > .6) { kill(lance); kill(lanceH); return false; }
    });
    shock(start.x, start.z, 1.3, STEEL, WIND, .4);
  });
  return 2.4;
}

/* 3 · ดาบวายุ — a horizontal slash releases a crescent of wind that tears forward through every ghost in line */
function skWind() {
  const tg = nearestGhost(); face(hero, tg.pos); swing(24);
  const dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
  after(.12, () => {
    slashArc(chest(hero), tg.pos, { r: 1.3, sweep: 2.6, dir: 1, c1: WIND, c2: STEEL_SOFT, dur: .12 });
    const G = new THREE.Group(); scene.add(G);
    const m1 = new THREE.Mesh(new THREE.RingGeometry(.7, 1, 48, 1, Math.PI / 2 - 1.2, 2.4), new THREE.MeshBasicMaterial({ color: C(1.1, 2.2, 2.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const m2 = new THREE.Mesh(new THREE.RingGeometry(.45, 1.25, 48, 1, Math.PI / 2 - 1.05, 2.1), new THREE.MeshBasicMaterial({ color: C(.25, .6, .8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    [m1, m2].forEach(m => { m.rotation.x = Math.PI / 2; G.add(m); });
    const from = hero.pos.clone().setY(.9), hit = new Set(), RANGE = 5.75;
    G.position.copy(from); G.lookAt(from.clone().add(dir));
    addTask((dt, t) => {
      const d = Math.min(RANGE, t * 6.8); G.position.copy(from).addScaledVector(dir, d); G.scale.setScalar(1 + d * .12);
      const fade = d >= RANGE ? Math.max(0, 1 - (t - RANGE / 6.8) / .2) : 1; m1.material.opacity = fade; m2.material.opacity = fade * .8;
      for (let k = 0; k < 4; k++) { const s = rand(-1, 1); emit({ p: G.position.clone().add(V(0, 0, 0)).addScaledVector(V(-dir.z, 0, dir.x), s * 1.1 * G.scale.x).add(V(0, rand(-.2, .2), 0)), v: dir.clone().multiplyScalar(-rand(1, 3)), c: Math.random() < .5 ? WIND : C(.9, 1.1, 1.2), life: .35, size: .08, size1: .01 }); }
      if (Math.random() < .6) emit({ p: G.position.clone().setY(.1).addScaledVector(V(-dir.z, 0, dir.x), rand(-1, 1)), v: V(0, rand(.3, .8), 0), c: DUST, life: .7, size: .3, size1: .7, shape: SH.soft, a: .5 }, PN);
      livingGhosts().forEach(g => { if (hit.has(g)) return; const v = g.pos.clone().sub(from).setY(0), along = v.dot(dir), side = v.clone().sub(dir.clone().multiplyScalar(along)).length();
        if (along > 0 && along <= d + .2 && side < 1.3 * G.scale.x) { hit.add(g); hurt(g, 230, false, .4); sparks(chest(g), 12, [WIND, WHITE]); } });
      if (fade <= 0) { scene.remove(G); [m1, m2].forEach(m => { m.geometry.dispose(); m.material.dispose(); }); return false; }
    });
  });
  return 1.8;
}

/* 4 · ตั้งการ์ดดาบคู่ — crossed blades flare into an X sigil, a bronze hex shell forms, the warrior heals and hardens */
function skGuard() {
  face(hero, nearestGhost().pos); swing(18);
  const X = new THREE.Group(); scene.add(X);
  [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.PlaneGeometry(.11, 1.5), new THREE.MeshBasicMaterial({ color: C(2.2, 1.9, 1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.rotation.z = s * .75; X.add(b); });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(.95, 1), fresnelMat(C(1.4, .95, .35))); shell.scale.y = 1.35; scene.add(shell);
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.96, 1)), new THREE.LineBasicMaterial({ color: C(1.6, 1.15, .45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); wire.scale.y = 1.35; scene.add(wire);
  hero.guard = true; flash(hero.pos, 0xffc070, 30, .5); shock(hero.pos.x, hero.pos.z, 1.6, GOLD, C(1, .6, .2), .5);
  after(.2, () => { heal(hero, hero.maxHp * .15, 'heal big'); after(.25, () => popup(V(hero.pos.x, hero.barY + .7, hero.pos.z), 'ป้องกัน +25 · โจมตี +15%', 'st')); });
  const DUR = 4;
  addTask((dt, t) => {
    const u = clamp01(t / .25), live = clamp01((DUR - t) / .4);
    X.position.copy(chest(hero)).add(V(0, .15, .35)); X.scale.setScalar(.5 + easeOutBack(u) * .7); X.children.forEach(b => b.material.opacity = Math.max(0, 1 - t / .7));
    shell.position.copy(hero.pos).setY(.95); wire.position.copy(shell.position); shell.rotation.y = wire.rotation.y = t * .6;
    shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = .8 * clamp01(t * 4) * live; wire.material.opacity = .35 * clamp01(t * 4) * live;
    if (Math.random() < dt * 8 * live) emit({ p: hero.pos.clone().add(V(rand(-.6, .6), rand(.2, 1.8), rand(-.4, .4))), v: V(0, .5, 0), c: GOLD_SOFT, life: .6, size: .06, shape: SH.star });
    if (t > DUR) { hero.guard = false; kill(X); kill(shell); kill(wire); return false; }
  });
  return 3;
}

/* 5 · เพลงดาบพิฆาต — leap into the pack and unleash six burning arcs at every angle, ending in a flame burst */
function skPikat() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), spot = gc.clone().add(hero.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(.6));
  moveTo(hero, spot, .3, () => {
    const R = 2.3, P = hero.pos.clone(); const ring = decal(3, P.x, P.z, R, C(1.3, .5, .1), C(.6, .12, .02), { auto: false, alpha: .8 });
    for (let i = 0; i < 6; i++) after(i * .15, () => {
      if (i % 2 === 0) swing(30); else offSwing(0, .14);
      const ang = rand(0, 6.28), aim = P.clone().add(V(Math.cos(ang), 0, Math.sin(ang)));
      slashArc(chest(hero).add(V(0, rand(-.25, .25), 0)), aim, { r: R, sweep: rand(2.4, 3.4), roll: rand(-.7, .7), dir: i % 2 ? -1 : 1, c1: C(2.6, 1.4, .4), c2: FIRE, dur: .12, inner: .7 });
      livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .6).forEach(g => { hurt(g, 140, i === 5); sparks(chest(g), 8, [EMBER, WHITE]); });
      for (let k = 0; k < 14; k++) { const a = rand(0, 6.28); emit({ p: P.clone().add(V(Math.cos(a) * R * .7, rand(.3, 1.6), Math.sin(a) * R * .7)), v: V(Math.cos(a + 1.5) * 3, rand(.2, 1.2), Math.sin(a + 1.5) * 3), c: Math.random() < .5 ? EMBER : FIRE, life: .45, size: .12, size1: .02, drag: 2 }); }
      shake = .07;
    });
    addTask((dt, t) => { ring.m.position.set(P.x, .04, P.z); ring.u.uAlpha.value = .8 * clamp01(t * 5) * clamp01((1.3 - t) / .3); if (t > 1.3) { ring.auto = true; ring.t = 99; return false; } });
    after(.95, () => { shake = .22; flash(P, 0xff7a2a, 50, .5); shock(P.x, P.z, R * 1.4, C(2.6, 1.2, .3), FIRE, .5);
      burst(P.clone().setY(.6), 60, { c: [EMBER, FIRE, C(2.6, 2, .8)], size: .16, sp: 6, upMin: .2, life: .7, drag: 3 });
      burst(P.clone().setY(.3), 20, { c: [C(.3, .25, .22), C(.2, .17, .15)], S: PN, size: .6, size1: 1.4, sp: 2.5, upMin: .4, life: 1.2, shape: SH.soft, a: .7, drag: 2 });
      after(.4, () => goHome()); });
  }, { trail: C(1.2, .5, .2) });
  return 2.8;
}

/* 6 · ธงชัยเฉลิมพล — a Garuda war banner falls from the sky and plants beside the warrior; gold rally ring buffs the party */
const flagTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 170; const g = c.getContext('2d');
  g.fillStyle = '#9c1c1c'; g.fillRect(0, 0, 256, 170); g.strokeStyle = '#e2b13c'; g.lineWidth = 8; g.strokeRect(8, 8, 240, 154);
  g.fillStyle = '#e2b13c'; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(8 + i * 20, 162); g.lineTo(18 + i * 20, 170); g.lineTo(28 + i * 20, 162); g.fill(); }
  /* stylised Garuda: crowned head, spread wings, talons */
  g.translate(128, 86); g.fillStyle = '#f3c84b';
  g.beginPath(); g.moveTo(0, -46); g.lineTo(8, -30); g.lineTo(-8, -30); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -20, 11, 0, 7); g.fill();
  g.beginPath(); g.moveTo(8, -22); g.lineTo(18, -16); g.lineTo(8, -15); g.fill();
  [-1, 1].forEach(s => { g.beginPath(); g.moveTo(0, -8); for (let k = 0; k < 5; k++) { g.lineTo(s * (24 + k * 15), -30 + k * 9); g.lineTo(s * (18 + k * 15), -16 + k * 9); } g.lineTo(s * 10, 18); g.closePath(); g.fill(); });
  g.beginPath(); g.moveTo(-10, -8); g.lineTo(10, -8); g.lineTo(7, 26); g.lineTo(-7, 26); g.closePath(); g.fill();
  g.strokeStyle = '#f3c84b'; g.lineWidth = 4; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * 5, 24); g.lineTo(s * 12, 40); g.lineTo(s * 18, 40); g.stroke(); });
  g.setTransform(1, 0, 0, 1, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function skBanner() {
  const P = hero.pos.clone().add(V(-.8, 0, .35)), R = 5.5;
  face(hero, nearestGhost().pos); swing(16);
  const G = new THREE.Group(); scene.add(G);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: .6 })); pole.position.y = 1.6; G.add(pole);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(.08, .3, 8), new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: .9, roughness: .25, emissive: 0x4a3000 })); fin.position.y = 3.35; G.add(fin);
  const fgeo = new THREE.PlaneGeometry(1.3, .86, 20, 8); fgeo.translate(.65, 0, 0);
  const fmat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uMap: { value: flagTex }, uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying float vS; void main(){ vUv=uv; vec3 p=position; float k=p.x/1.3; p.z+=sin(p.x*4.-uTime*7.)*.12*k; p.y+=sin(p.x*3.-uTime*5.)*.04*k; vS=.75+.25*cos(p.x*4.-uTime*7.); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vS; void main(){ vec4 c=texture2D(uMap,vUv); gl_FragColor=vec4(c.rgb*vS*.95,1.);
#include <colorspace_fragment>
}` });
  const flag = new THREE.Mesh(fgeo, fmat); flag.position.set(.04, 2.75, 0); G.add(flag);
  G.position.set(P.x, 7, P.z); G.rotation.y = .5;
  const aura = decal(1, P.x, P.z, R, C(1.4, 1.05, .35), null, { auto: false, alpha: .5 });
  let landed = false;
  addTask((dt, t) => {
    fmat.uniforms.uTime.value = t;
    const u = clamp01(t / .35); G.position.y = 7 * (1 - u * u);
    if (u >= 1 && !landed) { landed = true; land(); }
    aura.u.uAlpha.value = landed ? .5 * clamp01((t - .35) * 3) * clamp01((5 - t) / .5) : 0;
    if (landed && Math.random() < dt * 12) { const a = rand(0, 6.28), r = R * rand(.9, 1); emit({ p: V(P.x + Math.cos(a) * r, .1, P.z + Math.sin(a) * r), v: V(0, rand(.8, 1.6), 0), c: GOLD, life: .9, size: .08 }); }
    if (t > 5) { G.position.y -= dt * 4; }
    if (t > 5.6) { kill(G); aura.auto = true; aura.t = 99; return false; }
  });
  function land() {
    shake = .2; flash(P, 0xffd070, 50, .7); shock(P.x, P.z, 2, GOLD, C(1.2, .6, .2), .45); shock(P.x, P.z, R, GOLD_SOFT, GOLD, .9);
    burst(P.clone().setY(.2), 26, { c: [DUST, C(.36, .3, .2)], S: PN, size: .5, size1: 1.2, sp: 2.5, upMin: .2, upMax: .5, life: 1, shape: SH.soft, a: .7, drag: 2.5 });
    popup(V(P.x, 3.9, P.z), 'ครุฑนำทัพ!', 'st big');
    living().filter(a => a.pos.distanceTo(P) <= R + .5).forEach((a, i) => after(.2 + i * .1, () => {
      heal(a, a.maxHp * .08); after(.25, () => popup(V(a.pos.x, a.barY + .7, a.pos.z), 'โจมตี +22% · ป้องกัน +8', 'st'));
      addTask((dt, t) => { if (Math.random() < dt * 5) { const p = a.pos.clone().add(V(rand(-.3, .3), .2, 0)); for (let k = 0; k < 3; k++) emit({ p: p.clone().add(V(0, k * .14, 0)), v: V(0, 1.6, 0), c: GOLD, life: .6, size: .16 - k * .03, shape: SH.star, rot: 0 }); } if (t > 3.5) return false; });
    }));
  }
  return 5.8;
}

/* 7 · ดาบบาทวงจักร — spin in place three times: full blade rings and a wind cyclone */
function skWhirl() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), spot = gc.clone().add(hero.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(.4));
  moveTo(hero, spot, .3, () => {
    const P = hero.pos.clone(), R = 2.2;
    const cyc = new THREE.Mesh(new THREE.CylinderGeometry(R * .9, R * .55, 2.2, 40, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uT,uA; void main(){ float s=pow(.5+.5*sin(vUv.x*25.+vUv.y*9.-uT*22.),5.); float f=(1.-vUv.y)*smoothstep(0.,.25,vUv.y); gl_FragColor=vec4(vec3(.5,1.,1.1)*s*f*uA*.7,1.); }` }));
    cyc.position.copy(P).setY(1.1); scene.add(cyc);
    for (let i = 0; i < 3; i++) after(i * .22, () => {
      swing(34); offSwing(.1, .2);
      slashArc(chest(hero), P.clone().add(V(0, 0, -1)), { r: R, sweep: 6.1, dir: 1, c1: C(1.8, 2.1, 2.3), c2: WIND, dur: .2, inner: .78, tail: .5, pitch: (i - 1) * .12 });
      livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .5).forEach(g => { hurt(g, 150, i === 2); sparks(chest(g), 10, [WIND, WHITE]); });
      shock(P.x, P.z, R, WIND, STEEL_SOFT, .35); shake = .06;
    });
    addTask((dt, t) => { cyc.material.uniforms.uT.value = t; cyc.material.uniforms.uA.value = clamp01(t * 6) * clamp01((.9 - t) / .3); cyc.rotation.y += dt * 9;
      for (let k = 0; k < 4; k++) { const a = rand(0, 6.28); emit({ p: P.clone().add(V(Math.cos(a) * R * .8, rand(.1, 1.8), Math.sin(a) * R * .8)), v: V(-Math.sin(a) * 5, .6, Math.cos(a) * 5), c: Math.random() < .5 ? WIND : C(.6, .7, .55), life: .35, size: .07, size1: .01 }); }
      if (t > .9) { kill(cyc); return false; } });
    after(1.1, () => goHome());
  }, { trail: C(.5, .8, .9) });
  return 2.4;
}

/* 8 · กระโจนผ่าปฐพี — a high leap, a falling blade of light, the ground splits and everyone around is stunned */
function skLeap() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), P = gc.clone().add(hero.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(.5));
  face(hero, P); const target = decal(1, P.x, P.z, 2.2, C(1.5, .8, .3), null, { life: 1, grow: .2 });
  swing(10);
  moveTo(hero, P, .6, () => {
    const R = 2.4; shake = .32; flash(P, 0xffb060, 60, .6);
    slashArc(V(P.x, 1.6, P.z), P.clone().add(V(0, 0, 1)), { r: 1.7, sweep: 2.2, pitch: -1.2, dir: 1, c1: C(2.4, 2, 1.4), c2: EMBER, dur: .12 });
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 1 }, uSeed: { value: rand(0, 10) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uA,uSeed; float h(float x){ return fract(sin(x*91.7+uSeed)*43758.5); }
        void main(){ vec2 p=vUv*2.-1.; float r=length(p), an=atan(p.y,p.x); float a=0.;
          for(int i=0;i<9;i++){ float fi=float(i); float ca=fi/9.*6.2832+h(fi)*.5; float wob=sin(r*14.+fi*3.)*.06*r+sin(r*31.+fi)*.02;
            float d=abs(mod(an-ca-wob+9.4248,6.2832)-3.1416)*r; float len=.55+h(fi+3.)*.45; a+=smoothstep(.022,0.,d)*step(r,len)*(1.-r/len*.7); }
          a+=exp(-r*r*18.)*1.2; gl_FragColor=vec4(vec3(2.4,1.0,.3)*a*uA,1.); }` }));
    crack.rotation.x = -Math.PI / 2; crack.position.set(P.x, .05, P.z); scene.add(crack);
    addTask((dt, t) => { crack.material.uniforms.uA.value = Math.max(0, 1 - t / 1.4) * (t < .05 ? t / .05 : 1); if (t > 1.4) { kill(crack); return false; } });
    shock(P.x, P.z, R, C(2.4, 1.3, .4), EMBER, .5); shock(P.x, P.z, R * 1.5, DUST, DUST, .7);
    burst(P.clone().setY(.2), 40, { c: [DUST, C(.36, .3, .2), C(.55, .48, .32)], S: PN, size: .6, size1: 1.5, sp: 4, upMin: .1, upMax: .5, life: 1.2, shape: SH.soft, a: .75, drag: 2.5 });
    burst(P.clone().setY(.3), 26, { c: C(.28, .24, .2), S: PN, size: .1, sp: 4, upMin: .8, upK: 1.6, life: 1.3, shape: SH.soft, grav: 9, a: 1, drag: .3 });
    livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .5).forEach(g => { hurt(g, 420, true, .6); stunStars(g, 1); popup(V(g.pos.x, g.barY + .7, g.pos.z), 'สะดุ้ง 1 วิ', 'st'); });
    after(.6, () => goHome(.55));
  }, { hop: 2.6, trail: C(1.1, .6, .25) });
  return 2.6;
}

/* 9 · โทสะขุนศึก — a roar cracks the ground red; dark flames climb the warrior and a blood-red afterimage follows him */
function skBerserk() {
  face(hero, nearestGhost().pos); swing(14);
  const P = hero.pos.clone(); shake = .25; flash(P, 0xff3020, 55, .7);
  shock(P.x, P.z, 3.2, RAGE, C(.6, .05, .05), .6); after(.12, () => shock(P.x, P.z, 4.4, C(1.4, .2, .1), C(.4, 0, 0), .7));
  popup(V(P.x, 3.4, P.z), 'โฮก!!', 'st big');
  after(.2, () => popup(V(P.x, hero.barY + .7, P.z), 'โจมตี +35% · คริ +15% · เร็ว +15%', 'st'));
  const ring = decal(3, P.x, P.z, 1.1, C(1.6, .15, .08), C(.5, 0, 0), { auto: false, alpha: .9 });
  hero.rage = true; const DUR = 5; let ghostT = 0;
  addTask((dt, t) => {
    const live = clamp01((DUR - t) / .4);
    hero.tint = Math.max(hero.tint, .55 * live); hero.tintC = C(1.25, .35, .3);
    ring.m.position.set(hero.pos.x, .04, hero.pos.z); ring.u.uAlpha.value = .9 * clamp01(t * 4) * live;
    for (let k = 0; k < 2; k++) { const a = rand(0, 6.28); emit({ p: hero.pos.clone().add(V(Math.cos(a) * .4, rand(0, .3), Math.sin(a) * .3)), v: V(0, rand(1.5, 2.6), 0), c: Math.random() < .6 ? RAGE : C(.25, .02, .02), life: .55, size: rand(.18, .3), size1: .03, drag: 1 }); }
    if (Math.random() < dt * 6) emit({ p: hero.pos.clone().add(V(rand(-.5, .5), .05, rand(-.3, .3))), c: C(.12, .03, .03), life: .9, size: .5, size1: .9, shape: SH.soft, a: .5, v: V(0, .8, 0) }, PN);
    ghostT -= dt; if (ghostT <= 0) { ghostT = .12; afterimage(hero, C(1, .1, .08), .35); }
    if (t > DUR) { hero.rage = false; ring.auto = true; ring.t = 99; return false; }
  });
  return 3.4;
}

/* 10 · ดาบประหารอสูร — the sky darkens, lightning gathers on the blade, one colossal falling slash and a bolt split the line */
function skExecute() {
  const tg = nearestGhost(), dir = tg.pos.clone().sub(hero.pos).setY(0).normalize();
  const stand = tg.pos.clone().addScaledVector(dir, -1.6); moveTo(hero, stand, .25, null, { trail: C(.6, .7, 1.2) });
  const dark = $('dim'); dark.style.opacity = '.38';
  after(.25, () => {
    face(hero, tg.pos); play(hero, 'slash', { fps: 10, from: 0 });
    addTask((dt, t) => { hero.anim === 'slash' && hero.frame > 2 && (hero.frame = 1);
      const tip = chest(hero).add(V(0, 1.1, 0)); if (Math.random() < .5) bolt(tip.clone().add(V(rand(-1.5, 1.5), rand(1.5, 2.5), rand(-1, 1))), tip, .08, .02);
      emit({ p: tip.clone().add(V(rand(-.8, .8), rand(-.6, .8), rand(-.4, .4))), c: BOLT, life: .25, size: .1, home: tip, homeK: 5 }); if (t > .75) return false; });
    after(.75, () => {
      play(hero, 'slash', { fps: 26, from: 3, once: () => play(hero, 'idle') }); offSwing(.03, .2);
      dark.style.opacity = '0'; shake = .4; flash(tg.pos, 0xbfd8ff, 90, .7);
      const front = tg.pos.clone().addScaledVector(dir, .2);
      bolt(V(front.x + rand(-.3, .3), 9, front.z), V(front.x, 0, front.z), .5, .09); after(.06, () => bolt(V(front.x + 1, 9, front.z - .5), V(front.x + .3, 0, front.z), .35, .05));
      slashArc(V(hero.pos.x, 1.4, hero.pos.z).addScaledVector(dir, .9), tg.pos, { r: 2.6, sweep: 2, pitch: -1.35, dir: 1, c1: C(2.4, 2.6, 3), c2: BOLT, dur: .1, inner: .8 });
      shock(front.x, front.z, 2.4, BOLT, WHITE, .45); shock(front.x, front.z, 3.4, C(.5, .7, 1.4), BOLT, .7);
      burst(front.clone().setY(.4), 50, { c: [BOLT, WHITE], size: .13, sp: 6, upMin: .3, life: .5, shape: SH.star, drag: 3 });
      burst(front.clone().setY(.2), 24, { c: [C(.3, .3, .35), C(.2, .2, .25)], S: PN, size: .6, size1: 1.4, sp: 3, upMin: .3, life: 1.1, shape: SH.soft, a: .7, drag: 2 });
      inFront(3.2, .9, hero.pos, dir).forEach(g => { hurt(g, 900, true, .8); stunStars(g, 1.5); popup(V(g.pos.x, g.barY + .9, g.pos.z), 'มึน 1.5 วิ', 'st'); });
      after(.8, () => goHome(.5));
    });
  });
  return 3;
}

/* ---------------- skill catalogue (numbers from shared/data/skills.js) ---------------- */
const SKILLS = [
  { id: 'sword_twin', name: 'ฟันดาบคู่', lv: 1, run: skTwin, meta: ['MP 5', 'CD 2.5 วิ', '3 ครั้ง', 'เลือดไหล'],
    desc: 'ฟันไขว้ 3 ครั้ง โดนทุกตัวด้านหน้า คมดาบบาดจนเลือดไหลต่อเนื่อง',
    layers: ['ก้าวเข้าหาผีพร้อมเงาตาม', 'รอยดาบเหล็ก 3 เส้นไขว้เป็นตัว X (shader วิ่งจากหัวไปหาง)', 'ครั้งที่ 3 ขอบแดงเลือด', 'ประกายไฟกระเด็นตามแรงโน้มถ่วง', 'หยดเลือดไหล + ดาเมจเลือดไหล 3 ติ๊ก'] },
  { id: 'sword_thrust', name: 'แทงทะลวง', lv: 2, run: skThrust, meta: ['MP 8', 'CD 6 วิ', 'พุ่ง 110', 'เกราะแตก'],
    desc: 'พุ่งแทงทะลุแนวศัตรู สะดุ้งและเกราะแตก (DEF −30%) ไป 6 วิ (อมตะระหว่างพุ่ง)',
    layers: ['แสงวาบรวมพลังที่ปลายดาบ', 'พุ่งตรงทะลุแนวผีพร้อมเงาติดตัวถี่ ๆ', 'หอกแสงยาวตามเส้นทางพุ่ง', 'ลมพัดย้อนกลับจากหัวหอก', 'เศษเกราะเงินแตกกระจายจากผีที่โดน'] },
  { id: 'sword_wind', name: 'ดาบวายุ', lv: 4, run: skWind, meta: ['MP 10', 'CD 5 วิ', 'ระยะ 230', 'ทะลุ'],
    desc: 'คลื่นดาบทะลุทุกตัว',
    layers: ['ฟันแนวนอนแล้วปล่อยคลื่นพระจันทร์เสี้ยว 2 ชั้น', 'คลื่นขยายตัวขณะพุ่งไปข้างหน้า', 'ลมเส้นบางพัดตามหลังคลื่น', 'ฝุ่นพื้นฟุ้งตามแนวที่คลื่นผ่าน', 'โดนผีทุกตัวในแนว'] },
  { id: 'sword_guard', name: 'ตั้งการ์ดดาบคู่', lv: 6, run: skGuard, meta: ['MP 12', 'CD 18 วิ', 'ฟื้น 15%', 'บัฟ 10 วิ'],
    desc: 'ฟื้น HP 15% ป้องกัน +25 โจมตี +15% นาน 10 วิ',
    layers: ['ดาบไขว้เป็นตัว X สีทองวาบหน้าอก', 'เกราะทรงหลายเหลี่ยมสีทองแดง (fresnel + เส้นขอบ)', 'ระหว่างบัฟ ผีตีโดนขึ้นคำว่า "บล็อก" + ประกาย', 'ประกายทองลอยรอบตัว'] },
  { id: 'sword_pikat', name: 'เพลงดาบพิฆาต', lv: 8, run: skPikat, meta: ['MP 28', 'CD 20 วิ', '6 ครั้ง', 'อัลติ'],
    desc: '★ ร่ายเพลงดาบรอบตัว 6 ครั้ง',
    layers: ['กระโดดเข้ากลางฝูงผี', 'รอยดาบไฟ 6 เส้นทุกมุม สลับทิศ เอียงสุ่ม', 'วงไฟลายเสือใต้เท้า', 'ถ่านไฟหมุนรอบตัว', 'ปิดท้ายระเบิดไฟ + ควัน + กล้องสั่น'] },
  { id: 'sword_banner', name: 'ธงชัยเฉลิมพล', lv: 10, run: skBanner, meta: ['MP 26', 'CD 28 วิ', 'รัศมี 220', 'บัฟ 12 วิ'],
    desc: '[ปาร์ตี้] ปักธงครุฑนำทัพ โจมตี +22% ป้องกัน +8 ทั้งปาร์ตี้ 12 วิ',
    layers: ['ธงแดงลายครุฑทองตกจากฟ้าปักพื้น', 'ผ้าธงสะบัดด้วย vertex shader', 'วงทองรอบธง + ประกายทองลอยที่ขอบ', 'เพื่อนในวงมีลูกศรทองพุ่งขึ้น'] },
  { id: 'sword_whirl', name: 'ดาบบาทวงจักร', lv: 20, adv: true, run: skWhirl, meta: ['MP 16', 'CD 8 วิ', 'รัศมี 78', '3 รอบ'],
    desc: 'หมุนดาบรอบตัว 3 รอบ ฟันทุกตัวรอบกาย',
    layers: ['วงดาบเต็มรอบ 3 วง เอียงต่างกันเล็กน้อย', 'พายุหมุนทรงกรวย (shader ลายเกลียว)', 'ลมเส้นหมุนรอบตัว', 'คลื่นกระแทกทุกรอบ'] },
  { id: 'sword_leap', name: 'กระโจนผ่าปฐพี', lv: 40, adv: true, run: skLeap, meta: ['MP 22', 'CD 12 วิ', 'กระโดด 130', 'สะดุ้ง 1 วิ'],
    desc: 'กระโดดข้ามไปฟาดดาบลงพื้น ทุกตัวในวงรอบจุดลงสะดุ้ง 1 วิ',
    layers: ['วงเล็งจุดลงบนพื้น', 'กระโดดโค้งสูงพร้อมเงาตาม', 'ฟันดิ่งลงเป็นรอยดาบแนวตั้ง', 'พื้นแตกร้าวเรืองแสง (shader) + ฝุ่น + เศษหินตก', 'ดาวมึนเหนือหัวผี'] },
  { id: 'sword_berserk', name: 'โทสะขุนศึก', lv: 70, adv: true, run: skBerserk, meta: ['MP 30', 'CD 30 วิ', 'บัฟ 10 วิ'],
    desc: 'ปลุกโทสะนักรบ โจมตี +35% คริ +15% ตีเร็วขึ้น 15% วิ่งเร็วขึ้น 15% นาน 10 วิ',
    layers: ['คำราม: คลื่นแดง 2 ชั้น + กล้องสั่น', 'ตัวเรืองแดง เปลวแดงดำลุกขึ้นจากเท้า', 'เงาสีเลือดติดตัวตลอดบัฟ', 'วงไฟแดงใต้เท้า', 'ระหว่างบัฟ ดาเมจทุกสกิลแรงขึ้น'] },
  { id: 'sword_execute', name: 'ดาบประหารอสูร', lv: 100, adv: true, run: skExecute, meta: ['MP 40', 'CD 15 วิ', '×5.2', 'มึน 1.5 วิ'],
    desc: 'รวมพลังฟันดาบฟ้าผ่าเพียงครั้งเดียว แรงมาก โดนทุกตัวด้านหน้า มึน 1.5 วิ',
    layers: ['จอมืดลง สายฟ้าเล็กวิ่งเข้าปลายดาบ', 'ง้างค้างรวมพลัง 0.75 วิ', 'ฟันดิ่งเป็นรอยดาบยักษ์ + ฟ้าผ่า 2 สาย', 'คลื่นกระแทกฟ้า + ประกายไฟฟ้า + ควัน', 'ดาเมจก้อนใหญ่ + มึน'] },
];
const SEP_AT = 6;

