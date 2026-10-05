/* ---------------- party + ghosts ---------------- */
const HK = .021, GK = .034;
const heroA = (sheets, x, z, name, extra = {}) => makeActor({ sheets, x, z, fw: 128, fh: 136, k: HK, cy: .1, shadow: 1, maxHp: 1000, barY: 2.15, name, ...extra });
let hero, party, ghosts;
const HOME = V(.3, 0, 1.3);
const GH_SPOTS = [[1.5, -4.3], [-1.4, -4.6], [3.7, -3.4], [-3.6, -3.2]];
async function build() {
  hero = await heroA({ idle: 'hero_idle', walk: 'hero_walk', shoot: 'hero_shoot' }, HOME.x, HOME.z, 'พรานป่า', { hpStart: .85, fh: 104, cy: .077, barY: 1.95 });
  const sword = await heroA({ idle: 'sword_idle' }, -1.7, -1.3, 'ขุนศึก', { hpStart: .6, front: true });
  const boxer = await heroA({ idle: 'boxer_idle' }, 1.8, -1.2, 'นักมวย', { hpStart: .55, front: true });
  const healer = await heroA({ idle: 'healer_idle' }, -2.5, 1.9, 'หมอยา', { hpStart: .9 });
  party = [hero, sword, boxer, healer];
  ghosts = [];
  for (let i = 0; i < 4; i++) {
    const k = i % 2 ? 'phrai' : 'pob'; const [x, z] = GH_SPOTS[i];
    const g = await makeActor({ sheets: { idle: k + '_idle', attack: k + '_attack', die: k + '_die' }, x, z, fw: 72, fh: 72, k: GK, cy: .06, shadow: 1.3, maxHp: 2600, barY: 2.3, mob: true, spot: [x, z] });
    g.row = dirRow(-x, -z); ghosts.push(g);
  }
  hero.row = 4; sword.row = 4; boxer.row = dirRow(-.3, -1); healer.row = dirRow(1, -1);
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

/* ---------------- palette for FX (HDR values feed the bloom) ---------------- */
const STEEL = C(1.5, 1.7, 2.0), STEEL_SOFT = C(.6, .75, 1.0), BLOOD = C(1.4, .12, .12), EMBER = C(2.4, .95, .25), FIRE = C(2.6, .6, .12),
  GOLD = C(2.2, 1.6, .6), GOLD_SOFT = C(1.2, .9, .35), WIND = C(.7, 1.6, 1.7), WHITE = C(2.2, 2.2, 2), BOLT = C(1.4, 1.7, 2.6), RAGE = C(2.2, .25, .15), DUST = C(.48, .4, .26),
  HERB_HOT = C(1.4, 3, 1.3);

/* ---------------- blade arcs v2: stylised crescent (thick belly, tapered ends, white leading edge, dark flow streaks, wispy inner edge, smoke dissolve) ---------------- */
const PALS = {
  blue: [C(2.0, 2.6, 3.0), C(.25, .85, 2.2), C(.04, .12, .55)],
  fire: [C(2.8, 2.2, 1.2), C(2.2, .75, .15), C(.5, .08, .02)],
  wind: [C(1.8, 2.8, 2.6), C(.3, 1.4, 1.4), C(.03, .25, .3)],
  bolt: [C(2.6, 2.8, 3.2), C(.6, .9, 2.6), C(.1, .1, .6)],
  blood: [C(2.8, 2.4, 2.4), C(1.9, .2, .25), C(.4, .02, .05)],
};
const SMOKE = { blue: C(.32, .38, .55), fire: C(.35, .28, .25), wind: C(.35, .45, .48), bolt: C(.35, .38, .5), blood: C(.3, .2, .22) };
const ARC_GEO = new THREE.RingGeometry(.15, 1, 128, 8, 0, Math.PI * 2);
function arcMat(pal, sweep, start, thick, seed) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC1: { value: pal[0] }, uC2: { value: pal[1] }, uC3: { value: pal[2] }, uP: { value: 0 }, uA: { value: 1 }, uSweep: { value: sweep }, uStart: { value: start }, uThick: { value: thick }, uDis: { value: -.2 }, uSeed: { value: seed } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vP; uniform vec3 uC1,uC2,uC3; uniform float uP,uA,uSweep,uStart,uThick,uDis,uSeed;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }
      void main(){
        float an=mod(atan(vP.y,vP.x)-uStart+12.566,6.2832); float f=an/uSweep; if(f>1.) discard;
        float r=length(vP);
        float prof=pow(max(sin(f*3.1416),0.),.45)*(.5+.5*f);
        float inner=1.-uThick*prof;
        if(r>1.||r<inner-.1) discard;
        float w=clamp((r-inner)/(1.-inner+1e-4),0.,1.);
        float n=fbm(vec2(f*7.+uSeed,w*2.5));
        float tend=smoothstep(0.,.16,w+(n-.5)*.35+.06*sin(f*55.+uSeed*3.)+.04);
        float rev=step(f,uP);
        float dn=fbm(vec2(f*6.,w*3.)+uSeed*1.7);
        float dis=smoothstep(uDis-.08,uDis+.08,dn*.8+w*.4);
        float a=tend*rev*dis*(1.-smoothstep(.975,1.,r));
        float st=smoothstep(.58,.78,fbm(vec2(f*14.-uP*2.,w*3.5)+uSeed+2.));
        float edge=smoothstep(.84,.99,w);
        vec3 col=mix(uC3*2.4,uC2*1.5,smoothstep(0.,.65,w));
        col=mix(col,uC1*.85,edge);
        col*=1.-st*.7*(1.-edge);
        col+=uC1*exp(-pow((f-uP)/.05,2.))*edge*1.3;
        gl_FragColor=vec4(col*a*uA,1.);
      }` });
}
/* centre p, aim = world point it faces, sweep radians; roll tilts the blade plane, pitch tips it toward vertical, dir ±1 swing direction.
   o.pal names a palette · o.thick belly width · o.fly {dir, speed, range, onMove} turns it into a travelling crescent */
function slashArc(p, aim, o = {}) {
  const r = (o.r ?? 1.5) * 1.18, sweep = o.sweep ?? 2.5, start = Math.PI / 2 - sweep / 2, palKey = o.pal || 'blue', pal = PALS[palKey];
  const m = new THREE.Mesh(ARC_GEO, arcMat(pal, sweep, start, Math.min(.85, (o.thick ?? .5) * 1.35), o.seed ?? rand(0, 9)));
  const G = new THREE.Group(), T = new THREE.Group(); G.add(T); T.add(m); scene.add(G);
  G.position.copy(p); const tgt = aim.clone(); tgt.y = p.y; if (tgt.distanceTo(p) < .01) tgt.z -= 1; G.lookAt(tgt);
  T.rotation.z = o.roll ?? 0; T.rotation.x = o.pitch ?? -.45; m.rotation.x = Math.PI / 2; if ((o.dir ?? 1) < 0) m.rotation.y = Math.PI;
  m.scale.setScalar(r);
  const U = m.material.uniforms, tSw = o.dur ?? .15, tHold = o.fly ? o.fly.range / o.fly.speed : (o.hold ?? .07) + .06, tDis = (o.dis ?? .34) * 1.5;
  const local = (u, rr = 1) => { const a = start + sweep * u; m.updateMatrixWorld(true); return m.localToWorld(V(Math.cos(a) * rr, Math.sin(a) * rr, 0)); };
  let smoked = false, travelled = 0;
  addTask((dt, t) => {
    const u = clamp01(t / tSw); U.uP.value = u * 1.02;
    if (u < 1 && Math.random() < .9) { const q = local(u, rand(.92, 1)); emit({ p: q, v: q.clone().sub(G.position).normalize().multiplyScalar(rand(.5, 1.5)), c: pal[0], life: .25, size: .07, size1: .01 }); }
    if (o.fly) { const step = Math.min(o.fly.speed * dt, o.fly.range - travelled); travelled += step; G.position.addScaledVector(o.fly.dir, step); m.scale.setScalar(r * (1 + travelled * .1)); o.fly.onMove && o.fly.onMove(G.position, r * (1 + travelled * .1)); }
    if (t > tSw + tHold) {
      const d = (t - tSw - tHold) / tDis; U.uDis.value = -.2 + d * 1.25; if (!o.fly) m.scale.setScalar(r * (1 + d * .08));
      if (!smoked) { smoked = true; for (let k = 0; k < 7; k++) { const q = local(rand(.55, 1), rand(.75, 1)); emit({ p: q, v: V(rand(-.3, .3), rand(.2, .6), rand(-.3, .3)), c: SMOKE[palKey], life: rand(.6, .9), size: rand(.25, .4), size1: rand(.6, .9), shape: SH.soft, a: .55, drag: 1.5 }, PN); } }
      if (d >= 1) { scene.remove(G); m.material.dispose(); return false; }
    }
  });
  return G;
}
/* both blades: the sprite's slash crosses its swords around frames 3–4, so the two arcs fire there as an X */
function dualSlash(aim, o = {}) {
  const fps = o.fps || 20, f1 = (o.f1 ?? 3) / fps, f2 = (o.f2 ?? 4.2) / fps, roll = o.roll ?? .5;
  if (!o.noAnim) { face(hero, aim); play(hero, 'slash', { fps, once: () => play(hero, 'idle') }); }
  const at = () => (o.at ? o.at() : chest(hero));
  after(f1, () => { slashArc(at(), aim, { ...o, roll, dir: 1 }); o.onHit && o.onHit(0); });
  after(f2, () => { slashArc(at(), aim, { ...o, roll: -roll, dir: -1, r: (o.r ?? 1.5) * .94 }); o.onHit && o.onHit(1); });
  return f2;
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
const bowPos = () => chest(hero).add(V(0, .2, 0));
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
  const tip = () => bowPos().addScaledVector(dir, .4);
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
    for (let k = 0; k < 5; k++) { const a = base + (k - 2) * (34 / 2 * Math.PI / 180) / 1.0 * .5 * 2 / 2;
      const dir = V(Math.sin(a), 0, Math.cos(a)); const from = bowPos();
      flyArrow(from, from.clone().addScaledVector(dir, 1), { pierce: false, range: 7, speed: 17, tip: C(2, 2, 1.4), glow: C(1.6, 1.5, 2.2), glowSize: .4, trail: Math.random() < .5 ? C(1.2, 1.2, 2.2) : C(2, 1.8, 1), trailN: 3,
        ...(() => { const end = from.clone().addScaledVector(dir, 7); return { pierce: true, range: 7 }; })(),
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
