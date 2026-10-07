import * as THREE from 'three';
import './fx.css';

// Skill FX engine, ported from prototypes/skill-fx/src/boxer_fx.src.html.
// Everything lives in `root`, a group scaled by K, so the prototype's units
// (hero ≈ 1.9 tall) line up with the 3D fighter (≈ 2.6 tall). Positions handed
// to the helpers are in those local units; use toLocal()/toWorld() at the edge.
export const K = 1.35;
// The forest is bright snow, so additive light is pulled down to keep colour.
// During a skill the scene darkens (fx.mood) and bloom turns on, so the gain
// rises back toward the prototype's full-strength look (dark night + bloom).
export const GAIN = .62;

export const rand = (a, b) => a + Math.random() * (b - a);
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (r, g, b) => new THREE.Color(r, g, b);
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const easeOutBack = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export const COL = {
  STEEL: C(1.5, 1.7, 2.0), BLOOD: C(1.4, .12, .12), GOLD: C(2.2, 1.6, .6), GOLD_SOFT: C(1.2, .9, .35),
  WHITE: C(2.2, 2.2, 2), DUST: C(.48, .4, .26),
};
export const SH = { glow: 0, leaf: 1, petal: 2, star: 3, soft: 4 };

const PV = `
attribute vec3 aColor; attribute float aSize, aAlpha, aShape, aRot;
varying vec3 vC; varying float vA, vS, vR; uniform float uScale;
void main(){ vC=aColor; vA=aAlpha; vS=aShape; vR=aRot;
  vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
  gl_PointSize=aSize*uScale/max(.1,-mv.z); }`;
const PF = `
varying vec3 vC; varying float vA, vS, vR; uniform float uNorm;
void main(){
  vec2 p=gl_PointCoord*2.-1.; p.y=-p.y; float c=cos(vR), s=sin(vR); p=mat2(c,-s,s,c)*p;
  float a=0.;
  if(vS<.5){ float r=dot(p,p); a=exp(-r*4.5)*(1.-smoothstep(.75,1.,r))+exp(-r*28.)*.9; }
  else if(vS<1.5){ float y=p.y; float w=.42*(1.-y*y); float d=abs(p.x)-w; a=(1.-smoothstep(-.1,.01,d)); a*=.7+.3*smoothstep(0.,.07,abs(p.x)); a*=step(abs(y),.98); }
  else if(vS<2.5){ float y=(p.y+1.)*.5; float w=.5*sin(3.1416*pow(clamp(y,0.,1.),.75)); a=(1.-smoothstep(w-.12,w,abs(p.x)))*smoothstep(0.,.08,y)*(.55+.45*y); }
  else if(vS<3.5){ float l=length(p); a=max(0.,1.-abs(p.x)*9.)*max(0.,1.-abs(p.y))+max(0.,1.-abs(p.y)*9.)*max(0.,1.-abs(p.x)); a=a*.9+exp(-l*l*14.); a*=1.-smoothstep(.85,1.,l); }
  else { float r=dot(p,p); a=(1.-smoothstep(0.,1.,r))*.7; }
  if(a<.01) discard;
  if(uNorm>.5) gl_FragColor=vec4(vC,a*vA); else gl_FragColor=vec4(vC*a*vA,1.);
}`;

const DV = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const DF = `
varying vec2 vUv; uniform float uTime,uT,uType,uAlpha,uNorm; uniform vec3 uC1,uC2;
float ring(float r,float R,float w){ return exp(-pow((r-R)/w,2.)); }
void main(){
  vec2 p=vUv*2.-1.; float r=length(p); float an=atan(p.y,p.x); float a=0.; vec3 col=uC1;
  if(uType<.5){ float R=uT; float k=1.-uT; a=ring(r,R,.05+.06*uT)*k*1.4+ring(r,R*.82,.025)*k*.6+smoothstep(R,0.,r)*k*.15*step(r,R); col=mix(uC2,uC1,k); a*=smoothstep(0.,.14,uT)*(.55+.45*smoothstep(.0,.5,uT)); }
  else if(uType<1.5){ a=ring(r,.97,.025)*1.2+smoothstep(1.,.2,r)*.10*(.7+.3*sin(uTime*7.));
    float d=step(.5,fract(an/6.2832*28.+uTime*.6)); a+=ring(r,.88,.012)*d*.9; a+=ring(r,.25,.01)*.5; }
  else if(uType>5.5){ /* water pool: dark swirl, ripples running outward, bright rim */
    float sw=sin(an*3.+r*9.-uTime*2.4)*.5+.5; float rip=pow(sin(r*30.-uTime*7.)*.5+.5,8.)*smoothstep(.15,.45,r);
    a=smoothstep(1.,.75,r)*(.72+.1*sw)+ring(r,.97,.03); col=mix(uC2,uC1,clamp(rip*.45+sw*.15+ring(r,.97,.05),0.,1.)); }
  else if(uType>4.5){ float w=sin(r*26.-uTime*5.)*.5+.5; a=pow(w,6.)*smoothstep(1.,.3,r)*.7+ring(r,.98,.02)+smoothstep(1.,0.,r)*.12; }
  else if(uType>3.5){ float ro=an-uTime*1.4; a=ring(r,.86,.03)+ring(r,.62,.02)*.8;
    float tick=step(.62,fract(ro/6.2832*12.))*step(r,.84)*step(.66,r); a+=tick*.6; a+=pow(abs(sin(ro*3.)),20.)*ring(r,.74,.05)*1.2; a+=smoothstep(.6,0.,r)*.2; }
  else if(uType>2.5){ float st=sin(an*14.+sin(r*9.-uTime*3.)*1.6); float band=smoothstep(.25,.6,r)*smoothstep(1.,.85,r);
    a=smoothstep(.2,.8,st)*band*.9+ring(r,.97,.03)*1.3+ring(r,.6,.02)*.5; float fl=.75+.25*sin(uTime*23.+r*20.); a*=fl; col=mix(uC2,uC1,st*.5+.5); }
  else { float ro=an+uTime*.25; float pe=pow(abs(cos(ro*4.)),3.); a+=ring(r,.5+.28*pe,.018);
    float pe2=pow(abs(cos((an-uTime*.18)*8.)),4.); a+=ring(r,.3+.12*pe2,.013)*.9;
    a+=ring(r,.96,.012)+ring(r,.9,.007)*.7+ring(r,.2,.012)+ring(r,.13,.006);
    a+=smoothstep(.8,1.,cos(an*36.-uTime*.8))*ring(r,.93,.018)*1.3;
    float sp=step(.96,fract(an/6.2832*16.+.5))*smoothstep(.2,.3,r)*smoothstep(.95,.85,r); a+=sp*.35;
    a+=smoothstep(1.,0.,r)*.07; col=mix(uC2,uC1,smoothstep(.1,.9,r)); }
  a*=step(r,1.);
  if(uNorm>.5) gl_FragColor=vec4(col,clamp(a,0.,1.)*uAlpha); else gl_FragColor=vec4(col*a*uAlpha,1.);
}`;

const PALS = {
  blue: [C(2.0, 2.6, 3.0), C(.25, .85, 2.2), C(.04, .12, .55)],
  gold: [C(2.8, 2.4, 1.4), C(2.2, 1.2, .25), C(.5, .2, .03)],
  jade: [C(1.8, 2.8, 1.6), C(.4, 1.6, .7), C(.04, .3, .12)],
  red: [C(2.8, 2.2, 2), C(2.2, .35, .25), C(.45, .03, .03)],
};
const SMOKE = { blue: C(.32, .38, .55), gold: C(.4, .35, .3), jade: C(.3, .4, .35), red: C(.35, .25, .25) };

// `size` (default K) overrides the world size of one FX unit, e.g. to fit the effects
// to a smaller character in the entry-screen preview; the game uses K.
export function createFx({ scene, camera, renderer, labels, size = K }) {
  const root = new THREE.Group(); root.scale.setScalar(size); scene.add(root);
  const add = o => { root.add(o); return o; };
  // Three.js deletes a shader program as soon as no material uses it, so every cast of a skill
  // compiled its shaders again (the hitch when a skill went off). One material per program is kept
  // (never drawn again) and the GPU keeps the compiled program for the next cast.
  const kept = new Map();
  const progKey = m => `${m.type}|${m.side}|${!!m.map}|${m.vertexColors}|${JSON.stringify(m.defines ?? null)}|${m.vertexShader ?? ''}|${m.fragmentShader ?? ''}`;
  const release = m => { const k = progKey(m), was = kept.get(k); if (was === m) return; if (was) m.dispose(); else kept.set(k, m); };
  const kill = o => { o.parent?.remove(o); o.traverse?.(n => { if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(release); }); };
  const fx = { root, K: size, shake: 0, kill, add, camera, gain: GAIN, mood: 0, moodTarget: 0, moodHold: 0, stop: 0, punchV: 0 };

  // ---- coordinates -----------------------------------------------------------
  fx.toLocal = w => root.worldToLocal(w.clone());
  fx.toWorld = l => root.localToWorld(l.clone());
  const tmp = V();
  fx.toScreen = p => {
    tmp.copy(fx.toWorld(p)).project(camera); const r = renderer.domElement;
    return { x: (tmp.x * .5 + .5) * r.clientWidth, y: (-tmp.y * .5 + .5) * r.clientHeight, vis: tmp.z < 1 };
  };
  fx.cameraLocal = () => fx.toLocal(camera.position);

  // ---- tasks -----------------------------------------------------------------
  let tasks = [];
  fx.addTask = fn => tasks.push({ fn, t: 0 });
  fx.after = (s, fn) => fx.addTask((dt, t) => { if (t >= s) { fn(); return false; } });
  fx.clearTasks = () => { tasks = []; };
  Object.defineProperty(fx, 'tasks', { get: () => tasks.length });

  // ---- labels ----------------------------------------------------------------
  // `fx.statusTarget` (set by src/training/KitCaster.js while a skill hits a monster): the rules
  // name that monster's real effects over it (CombatHUD 'debuffed'), so the skill's own status
  // line ('st') above it is left out, not shown twice.
  fx.popup = (p, text, cls = 'heal') => {
    const st = fx.statusTarget;
    if (cls === 'st' && st) { const tp = st.pos; if (Math.hypot(p.x - tp.x, p.z - tp.z) < 1.2) return; }
    const s = fx.toScreen(p); if (!s.vis) return;
    const el = document.createElement('div'); el.className = 'fx-pop ' + cls; el.textContent = text;
    el.style.left = (s.x + rand(-14, 14)) + 'px'; el.style.top = s.y + 'px'; labels.appendChild(el); setTimeout(() => el.remove(), 1300);
  };

  // ---- textures --------------------------------------------------------------
  const radialTex = stops => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  };
  fx.glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [.18, 'rgba(255,255,255,.75)'], [.45, 'rgba(255,255,255,.18)'], [1, 'rgba(255,255,255,0)']]);

  // ---- particles -------------------------------------------------------------
  function makePS(N, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), shape = new Float32Array(N), rot = new Float32Array(N);
    for (const [n, arr, k] of [['position', pos, 3], ['aColor', col, 3], ['aSize', size, 1], ['aAlpha', alpha, 1], ['aShape', shape, 1], ['aRot', rot, 1]])
      geo.setAttribute(n, new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uScale: { value: 400 }, uNorm: { value: additive ? 0 : 1 } } });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 5 : 4; add(pts);
    return { N, cur: 0, pos, col, size, alpha, shape, rot, mat, geo, v: new Float32Array(N * 3), age: new Float32Array(N), life: new Float32Array(N),
      s0: new Float32Array(N), s1: new Float32Array(N), a0: new Float32Array(N), drag: new Float32Array(N), grav: new Float32Array(N), vr: new Float32Array(N),
      c0: new Float32Array(N * 3), live: new Uint8Array(N), active: 0, home: new Float32Array(N * 4), swirl: new Float32Array(N), onArrive: [] };
  }
  const PA = makePS(5000, true), PN = makePS(2000, false); fx.PN = PN;
  fx.emit = (o, S = PA) => {
    const i = S.cur; S.cur = (S.cur + 1) % S.N; const j = i * 3;
    S.pos[j] = o.p.x; S.pos[j + 1] = o.p.y; S.pos[j + 2] = o.p.z;
    const v = o.v || { x: 0, y: 0, z: 0 }; S.v[j] = v.x; S.v[j + 1] = v.y; S.v[j + 2] = v.z;
    const gn = S === PA ? fx.gain : 1; S.c0[j] = o.c.r * gn; S.c0[j + 1] = o.c.g * gn; S.c0[j + 2] = o.c.b * gn;
    S.age[i] = 0; S.life[i] = o.life || 1; S.s0[i] = o.size || .2; S.s1[i] = o.size1 ?? S.s0[i];
    S.a0[i] = o.a ?? 1; S.drag[i] = o.drag || 0; S.grav[i] = o.grav || 0; S.shape[i] = o.shape || 0;
    S.rot[i] = o.rot ?? rand(0, 6.28); S.vr[i] = o.vr || 0; S.live[i] = 1; S.active = 1; S.swirl[i] = o.swirl || 0;
    if (o.home) { S.home[i * 4] = o.home.x; S.home[i * 4 + 1] = o.home.y; S.home[i * 4 + 2] = o.home.z; S.home[i * 4 + 3] = o.homeK || 6; } else S.home[i * 4 + 3] = 0;
    S.onArrive[i] = o.onArrive || null;
  };
  function stepPS(S, dt) {
    if (!S.active) return; let any = 0; const { pos, v, col, c0 } = S;
    for (let i = 0; i < S.N; i++) {
      if (!S.live[i]) continue; any = 1;
      const j = i * 3; S.age[i] += dt; const f = S.age[i] / S.life[i];
      if (f >= 1) { S.live[i] = 0; S.alpha[i] = 0; S.size[i] = 0; continue; }
      const hk = S.home[i * 4 + 3];
      if (hk > 0) {
        const dx = S.home[i * 4] - pos[j], dy = S.home[i * 4 + 1] - pos[j + 1], dz = S.home[i * 4 + 2] - pos[j + 2], d = Math.hypot(dx, dy, dz) + 1e-4, ramp = Math.min(1, S.age[i] * 2.5);
        v[j] += (dx / d * hk * 2.2 - v[j] * 1.2) * dt * ramp * 3; v[j + 1] += (dy / d * hk * 2.2 - v[j + 1] * 1.2) * dt * ramp * 3; v[j + 2] += (dz / d * hk * 2.2 - v[j + 2] * 1.2) * dt * ramp * 3;
        if (S.swirl[i]) { v[j] += -dz / d * S.swirl[i] * dt * 6; v[j + 2] += dx / d * S.swirl[i] * dt * 6; }
        if (d < .25) { S.live[i] = 0; S.alpha[i] = 0; S.size[i] = 0; const cb = S.onArrive[i]; S.onArrive[i] = null; cb?.(); continue; }
      }
      const dr = Math.max(0, 1 - S.drag[i] * dt);
      v[j] *= dr; v[j + 1] = v[j + 1] * dr - S.grav[i] * dt; v[j + 2] *= dr;
      pos[j] += v[j] * dt; pos[j + 1] += v[j + 1] * dt; pos[j + 2] += v[j + 2] * dt;
      if (pos[j + 1] < .02 && S.grav[i] > 0) { pos[j + 1] = .02; v[j + 1] *= -.3; v[j] *= .6; v[j + 2] *= .6; S.age[i] = Math.max(S.age[i], S.life[i] * .8); }
      const env = Math.min(1, f / .1) * (1 - Math.max(0, (f - .55) / .45));
      S.alpha[i] = S.a0[i] * env; S.size[i] = S.s0[i] + (S.s1[i] - S.s0[i]) * f; S.rot[i] += S.vr[i] * dt;
      col[j] = c0[j]; col[j + 1] = c0[j + 1]; col[j + 2] = c0[j + 2];
    }
    S.active = any;
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape', 'aRot']) S.geo.attributes[n].needsUpdate = true;
  }
  fx.burst = (p, n, o) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), up = rand(o.upMin ?? .2, o.upMax ?? 1), sp = rand(o.spMin ?? 1, o.sp ?? 3);
      const c = Array.isArray(o.c) ? o.c[(Math.random() * o.c.length) | 0] : o.c;
      fx.emit({ p: p.clone().add(V(rand(-1, 1) * (o.jit || 0), rand(0, o.jitY || 0), rand(-1, 1) * (o.jit || 0))),
        v: V(Math.cos(a) * sp, up * sp * (o.upK ?? 1), Math.sin(a) * sp), c, life: rand(o.lifeMin ?? .5, o.life ?? 1), size: rand(o.sizeMin ?? (o.size * .6), o.size), size1: o.size1,
        drag: o.drag ?? 2, grav: o.grav ?? 0, shape: o.shape ?? 0, vr: rand(-4, 4), a: o.a ?? 1 }, o.S || PA);
    }
  };

  // ---- ground decals -----------------------------------------------------------
  const decals = []; const decalGeo = new THREE.PlaneGeometry(2, 2); decalGeo.userData.shared = true;
  fx.decal = (type, x, z, radius, c1, c2, opt = {}) => {
    const m = new THREE.Mesh(decalGeo, new THREE.ShaderMaterial({ vertexShader: DV, fragmentShader: DF, transparent: true, depthWrite: false, blending: opt.normal ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: { uNorm: { value: opt.normal ? 1 : 0 }, uTime: { value: 0 }, uT: { value: 0 }, uType: { value: type }, uAlpha: { value: (opt.alpha ?? 1) * (opt.normal ? 1 : fx.gain) }, uC1: { value: c1 }, uC2: { value: c2 || c1 } } }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, opt.y ?? .05 + decals.length * .003, z); m.scale.setScalar(radius); m.renderOrder = 3; add(m);
    const d = { m, u: m.material.uniforms, life: opt.life ?? 1, t: 0, grow: opt.grow ?? 0, auto: opt.auto ?? true, r: radius, normal: !!opt.normal };
    decals.push(d); return d;
  };
  function stepDecals(dt, time) {
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]; d.t += dt; d.u.uTime.value = time;
      if (!d.auto) continue;
      const f = d.t / d.life; d.u.uT.value = Math.min(1, f);
      if (d.grow) d.m.scale.setScalar(d.r * Math.min(1, easeOutBack(Math.min(1, d.t / d.grow))));
      if (d.u.uType.value > .5 && !d.normal) d.u.uAlpha.value = fx.gain * Math.min(1, d.t / .15) * (1 - Math.max(0, (f - .8) / .2));
      if (f >= 1) { kill(d.m); decals.splice(i, 1); }
    }
  }
  fx.shock = (x, z, r, c1, c2, life = .55) => fx.decal(0, x, z, r, c1, c2 || c1, { life });

  // ---- light pool --------------------------------------------------------------
  const lights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 6, 2); add(l); lights.push({ l, t: 1, dur: 1, peak: 0 }); }
  let li = 0;
  fx.flash = (p, color, peak = 25, dur = .45) => { const s = lights[li]; li = (li + 1) % lights.length; s.l.position.copy(p); s.l.position.y = Math.max(p.y, 0) + 2.2; s.l.color.set(color); s.t = 0; s.dur = dur; s.peak = peak * .07; }; // light pools on white snow read as a white blob: keep them a soft tint
  const stepLights = dt => { for (const s of lights) { s.t += dt; const f = s.t / s.dur; s.l.intensity = f >= 1 ? 0 : s.peak * (f < .12 ? f / .12 : 1 - (f - .12) / .88); } };

  // ---- shader meshes -----------------------------------------------------------
  fx.pillarMat = c => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: c }, uA: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uA,uTime;
      void main(){ float y=vUv.y; float a=pow(1.-y,1.6)*(.55+.45*sin(vUv.x*37.7+uTime*6.+y*8.)); a+=pow(1.-y,8.)*.3; a*=.6; gl_FragColor=vec4(uC*a*uA,1.); }` });
  fx.fresnelMat = c => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: c }, uA: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); vY=position.y; gl_Position=projectionMatrix*w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform vec3 uC; uniform float uA,uTime;
      void main(){ float f=pow(1.-abs(dot(vN,vV)),2.5); float hex=.5+.5*sin(vY*30.-uTime*4.); gl_FragColor=vec4(uC*(f*1.3+hex*f*.4)*uA,1.); }` });

  fx.tubeMat = (c1, c2, flow, freq = 18) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC1: { value: c1 }, uC2: { value: c2 }, uTime: { value: 0 }, uA: { value: 1 }, uFlow: { value: flow }, uFreq: { value: freq } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uC1,uC2; uniform float uTime,uA,uFlow,uFreq;
      void main(){ float b=pow(.5+.5*sin(vUv.x*uFreq-uTime*uFlow),8.); float rim=.55+.45*sin(vUv.y*6.2832); vec3 c=uC1*rim+uC2*b; gl_FragColor=vec4(c*uA,1.); }` });
  fx.arcPoint = (a, b, h, u) => { const p = a.clone().lerp(b, u); p.y += Math.sin(u * Math.PI) * h; return p; };

  // ---- lotus (petal shader) ----------------------------------------------------
  const petalGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(.32, .18, .3, .7, 0, 1); sh.bezierCurveTo(-.3, .7, -.32, .18, 0, 0); const g = new THREE.ShapeGeometry(sh, 10); g.userData.shared = true; return g; })();
  const petalMat = (c1, c2) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC1: { value: c1 }, uC2: { value: c2 }, uA: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 uC1,uC2; uniform float uA;
      void main(){ float y=vP.y; float w=.3*sin(3.14*pow(clamp(y,0.,1.),.8))+.001; float e=smoothstep(.55,1.,abs(vP.x)/w);
        vec3 c=mix(uC1,uC2,y)+uC2*e*1.4; float a=.55+.45*e; gl_FragColor=vec4(c*a*uA,1.); }` });
  // Two rings of petals; userData.open(t 0..1) unfolds them, userData.alpha(a) fades.
  fx.lotus = (c1, c2, size = .8) => {
    const g = new THREE.Group(); const mats = [petalMat(c1, c2), petalMat(c1.clone().multiplyScalar(.8), c2.clone().multiplyScalar(1.2))]; const pets = [];
    [[8, 0, 1], [8, Math.PI / 8, .75]].forEach(([n, off, sc], L) => { for (let i = 0; i < n; i++) {
      const piv = new THREE.Group(); piv.rotation.y = off + i / n * Math.PI * 2; const m = new THREE.Mesh(petalGeo, mats[L]); m.scale.setScalar(size * sc); piv.add(m); g.add(piv); pets.push({ m, L }); } });
    g.userData.open = t => pets.forEach(({ m, L }) => { m.rotation.x = -(L ? .15 : .3) - t * (L ? .9 : 1.25); });
    g.userData.alpha = a => mats.forEach(m => m.uniforms.uA.value = a * fx.gain);
    g.userData.open(0); g.userData.alpha(1); return add(g);
  };

  // ---- slash arcs ----------------------------------------------------------------
  const ARC_GEO = new THREE.RingGeometry(.15, 1, 128, 8, 0, Math.PI * 2); ARC_GEO.userData.shared = true;
  const arcMat = (pal, sweep, start, thick, seed) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
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
  // centre p, aim = point it faces, sweep radians; roll tilts the plane, pitch tips it, dir ±1 swing direction.
  fx.slashArc = (p, aim, o = {}) => {
    const r = (o.r ?? 1.5) * 1.18, sweep = o.sweep ?? 2.5, start = Math.PI / 2 - sweep / 2, palKey = o.pal || 'blue', pal = PALS[palKey];
    const m = new THREE.Mesh(ARC_GEO, arcMat(pal, sweep, start, Math.min(.85, (o.thick ?? .5) * 1.35), o.seed ?? rand(0, 9)));
    const G = new THREE.Group(), T = new THREE.Group(); G.add(T); T.add(m); add(G);
    G.position.copy(p); const tgt = aim.clone(); tgt.y = p.y; if (tgt.distanceTo(p) < .01) tgt.z -= 1;
    G.lookAt(fx.toWorld(tgt));
    T.rotation.z = o.roll ?? 0; T.rotation.x = o.pitch ?? -.45; m.rotation.x = Math.PI / 2; if ((o.dir ?? 1) < 0) m.rotation.y = Math.PI;
    m.scale.setScalar(r);
    const U = m.material.uniforms; U.uA.value = fx.gain * 1.1; const tSw = o.dur ?? .15, tHold = (o.hold ?? .07) + .06, tDis = (o.dis ?? .34) * 1.5;
    const local = (u, rr = 1) => { const a = start + sweep * u; m.updateMatrixWorld(true); return fx.toLocal(m.localToWorld(V(Math.cos(a) * rr, Math.sin(a) * rr, 0))); };
    let smoked = false;
    fx.addTask((dt, t) => {
      const u = clamp01(t / tSw); U.uP.value = u * 1.02;
      if (u < 1 && Math.random() < .9) { const q = local(u, rand(.92, 1)); fx.emit({ p: q, v: q.clone().sub(G.position).normalize().multiplyScalar(rand(.5, 1.5)), c: pal[0], life: .25, size: .07, size1: .01 }); }
      if (t > tSw + tHold) {
        const d = (t - tSw - tHold) / tDis; U.uDis.value = -.2 + d * 1.25; m.scale.setScalar(r * (1 + d * .08));
        if (!smoked) { smoked = true; for (let k = 0; k < 7; k++) { const q = local(rand(.55, 1), rand(.75, 1)); fx.emit({ p: q, v: V(rand(-.3, .3), rand(.2, .6), rand(-.3, .3)), c: SMOKE[palKey], life: rand(.6, .9), size: rand(.25, .4), size1: rand(.6, .9), shape: SH.soft, a: .55, drag: 1.5 }, PN); } }
        if (d >= 1) { root.remove(G); release(m.material); return false; }
      }
    });
    return G;
  };

  // ---- impacts ---------------------------------------------------------------------
  const SPARK_GEO = new THREE.PlaneGeometry(1, 1); SPARK_GEO.userData.shared = true;
  fx.hitSpark = (p, s = 1, col = C(2.6, 1.8, .7)) => {
    const g = new THREE.Group(); g.position.copy(p); add(g); g.lookAt(camera.position);
    const mat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(fx.gain), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const coreM = new THREE.MeshBasicMaterial({ color: C(2.8, 2.8, 2.6).multiplyScalar(fx.gain), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const n = 8 + ((Math.random() * 4) | 0);
    for (let k = 0; k < n; k++) { const a = k / n * 6.28 + rand(-.2, .2), L = rand(.35, .8) * s * (k % 3 === 0 ? 1.5 : 1);
      const sp = new THREE.Mesh(SPARK_GEO, k % 2 ? mat : coreM); sp.scale.set(L, .05 * s, 1); sp.position.set(Math.cos(a) * L * .55, Math.sin(a) * L * .55, 0); sp.rotation.z = a; g.add(sp); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40), mat.clone()); ring.scale.setScalar(.2 * s); g.add(ring);
    fx.addTask((dt, t) => { const f = t / .22; g.scale.setScalar(.6 + f * .8); mat.opacity = coreM.opacity = Math.max(0, 1 - f); ring.scale.setScalar((.2 + f * 1.1) * s); ring.material.opacity = Math.max(0, 1 - f);
      if (t > .22) { kill(g); return false; } });
    fx.burst(p, 10, { c: [C(2.6, 2.2, 1.4), col], size: .08, sp: 4.5, life: .3, shape: SH.star, drag: 4 });
    fx.flash(p, col.getHex(), 18 * s, .2);
  };
  fx.speedLines = (p, dir, n = 6, col = C(1.8, 1.6, 1.3)) => { for (let k = 0; k < n; k++) fx.emit({ p: p.clone().add(V(rand(-.3, .3), rand(-.25, .25), rand(-.3, .3))), v: dir.clone().multiplyScalar(-rand(3, 6)), c: col, life: .18, size: .06, size1: .01, drag: 1 }); };
  fx.stunStars = (g, dur) => {
    g.stun = true;
    fx.addTask((dt, t) => { for (let k = 0; k < 3; k++) { const an = t * 6 + k * 2.09, P = g.pos.clone().add(g.off); fx.emit({ p: V(P.x + Math.cos(an) * .35, g.barY + .05, P.z + Math.sin(an) * .35), c: C(2.2, 2, .6), life: .08, size: .16, shape: SH.star }); } if (t > dur || g.alive === false) { g.stun = false; return false; } });   // no stars over the fallen
  };
  fx.glowSprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fx.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); return add(s); };
  fx.emojiSprite = (ch, tint, col) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.font = '190px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 128, 140);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
    return add(new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  };
  fx.yantPlane = tex => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uMap: { value: tex }, uReveal: { value: 0 }, uA: { value: 1 }, uPulse: { value: 0 }, uT: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal,uA,uPulse,uT;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){ float ink=texture2D(uMap,vUv).a;
          float halo=0.; for(int i=0;i<8;i++){ float a=float(i)*.785; halo+=texture2D(uMap,vUv+vec2(cos(a),sin(a))*.006).a; } halo/=8.;
          float order=length(vUv-vec2(.5,.48))*1.25+h(floor(vUv*64.))*.12; float rv=smoothstep(order-.04,order,uReveal);
          float edge=smoothstep(order-.1,order,uReveal)-rv;
          vec3 gold=vec3(1.15,.82,.3)*(1.+uPulse*.9), deep=vec3(.55,.2,.04);
          vec3 col=gold*ink*rv + deep*halo*.35*rv + vec3(2.2,1.9,1.2)*edge*halo*1.2;
          col*=.85+.15*sin(uT*6.+vUv.y*20.);
          gl_FragColor=vec4(col*uA,1.); }` }));
    m.renderOrder = 2; return add(m);
  };

  // ---- cinematic -------------------------------------------------------------------
  // Darken the world for a skill (0..1), held for `hold` seconds then released.
  fx.cinematic = (strength = .7, hold = 1) => { fx.moodTarget = Math.max(fx.moodTarget, strength); fx.moodHold = Math.max(fx.moodHold, hold); };
  // Freeze time briefly on a heavy hit (real seconds) and kick the camera in.
  fx.hitstop = s => { fx.stop = Math.max(fx.stop, s); };
  fx.punch = k => { fx.punchV = Math.max(fx.punchV, k); };
  // A big impact: spark + ground shock ring + debris + light + hit-stop + camera punch.
  fx.impact = (p, s = 1, col = C(2.6, 1.8, .7)) => {
    fx.hitSpark(p, s, col);
    fx.shock(p.x, p.z, 1.1 * s, col, col.clone().multiplyScalar(.35), .45);
    fx.burst(p, Math.round(18 * s), { c: [col, C(2.6, 2.4, 2)], size: .1, sp: 4 + 2 * s, upMin: .2, life: .45, shape: SH.star, drag: 3 });
    fx.burst(p.clone().setY(.2), Math.round(10 * s), { c: [C(.5, .45, .4), C(.7, .65, .58)], S: PN, size: .07, sp: 3 * s, upMin: .6, upK: 1.4, life: .8, grav: 8, a: .9 });
    fx.hitstop(.035 + .04 * s); fx.punch(.35 * s); fx.shake = Math.max(fx.shake, .06 * s);
  };
  // A column of light that rises out of the ground.
  fx.lightPillar = (p, col, h = 5, r = .55, life = .9) => {
    const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r * .65, r, h, 28, 1, true), fx.pillarMat(col))); m.position.set(p.x, h / 2, p.z);
    fx.addTask((dt, t) => { m.material.uniforms.uTime.value = t; const f = t / life; m.material.uniforms.uA.value = Math.min(1, f * 6) * (1 - f) * fx.gain * .6; m.scale.set(1 + f * .5, Math.min(1, f * 5), 1 + f * .5); if (f >= 1) { kill(m); return false; } });
  };

  // ---- warm-up ---------------------------------------------------------------------
  // Compile the shared effects' shaders before the first fight (behind the loading screen): one of
  // each far off the map, compiled, then released into the kept set above. A class's own skill
  // shaders compile on their first cast and stay kept after that.
  fx.warm = () => {
    const far = V(4000, 0, 4000), w = C(1, 1, 1), objs = [];
    try {
      fx.shock(far.x, far.z, 1, w); fx.lightPillar(far, w, 1, .5, .1); fx.hitSpark(far.clone().setY(1));
      fx.slashArc(far.clone().setY(1), far.clone().add(V(0, 1, 1)), { dur: .02, hold: 0, dis: .02 });
      const plane = mat => add(new THREE.Mesh(SPARK_GEO, mat));
      objs.push(fx.lotus(w, w), fx.glowSprite(w, 1), plane(fx.fresnelMat(w)), plane(fx.tubeMat(w, w, 1)), plane(fx.pillarMat(w)), fx.yantPlane(fx.glowTex));
      for (const o of objs) o.position.copy(far);
      renderer.compile(scene, camera);
    } catch (e) { console.warn('[fx] warm-up', e); }
    objs.forEach(kill);
  };

  // ---- frame -----------------------------------------------------------------------
  fx.resize = () => {
    const h = renderer.domElement.clientHeight || innerHeight;
    const us = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * size;
    PA.mat.uniforms.uScale.value = us; PN.mat.uniforms.uScale.value = us;
  };
  fx.update = (dt, time, groundY) => {
    root.position.y += (groundY - root.position.y) * Math.min(1, dt * 10);
    for (let i = tasks.length - 1; i >= 0; i--) { const k = tasks[i]; k.t += dt; if (k.fn(dt, k.t) === false) tasks.splice(i, 1); }
    stepPS(PA, dt); stepPS(PN, dt); stepDecals(dt, time); stepLights(dt);
    fx.shake = Math.max(0, fx.shake - dt * .9);
    fx.punchV = Math.max(0, fx.punchV - dt * 2.5);
    fx.moodHold -= dt; if (fx.moodHold <= 0) fx.moodTarget = 0;
    fx.mood += (fx.moodTarget - fx.mood) * Math.min(1, dt * (fx.moodTarget > fx.mood ? 9 : 2.2));
    fx.gain = GAIN + (.78 - GAIN) * fx.mood;
  };
  fx.resize();
  return fx;
}
