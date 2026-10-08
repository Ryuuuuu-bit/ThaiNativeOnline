import * as THREE from 'three';

// Secondary art only: damage, target selection and animation timing stay in the kits.
export const CLASS_VFX = {
  muaythai: { ink: '#ed9860', light: '#ffe6af', shape: 'thread', count: 12 },
  warrior: { ink: '#cba65b', light: '#fff1ce', shape: 'steel', count: 10 },
  hunter: { ink: '#83b888', light: '#e4efb7', shape: 'leaf', count: 8 },
  shaman: { ink: '#a482d4', light: '#eed7a0', shape: 'paper', count: 10 },
  herbalist: { ink: '#75c78c', light: '#f3e8b5', shape: 'leaf', count: 10 },
};
const plane = new THREE.PlaneGeometry(1, 1), disc = new THREE.PlaneGeometry(2, 2);
plane.userData.shared = disc.userData.shared = true;
const ribbon = new THREE.PlaneGeometry(1, 1, 48, 1); ribbon.userData.shared = true;
const textures = new Map();
function texture(shape) {
  if (textures.has(shape)) return textures.get(shape);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (shape === 'paper') {
    g.fillStyle = '#e6ce92'; g.fillRect(32, 7, 64, 114);
    g.strokeStyle = '#8b542f'; g.lineWidth = 2; g.strokeRect(37, 12, 54, 104);
    for (let i = 0; i < 4; i++) {
      const y = 36 + i * 19;
      g.beginPath(); g.arc(64, y, 6, .1, Math.PI * 1.85); g.lineTo(64, y - 10);
      g.moveTo(48, y + 8); g.quadraticCurveTo(53, y, 56, y + 8);
      g.moveTo(72, y + 8); g.quadraticCurveTo(78, y, 81, y + 8); g.stroke();
    }
  } else {
    g.fillStyle = '#c5dfa0'; g.beginPath(); g.moveTo(64, 8);
    g.bezierCurveTo(115, 50, 105, 96, 64, 120); g.bezierCurveTo(23, 96, 13, 50, 64, 8); g.fill();
    g.strokeStyle = '#517b50'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 17); g.lineTo(64, 116);
    for (let y = 40; y < 100; y += 18) { g.moveTo(64, y + 12); g.lineTo(41, y); g.moveTo(64, y + 12); g.lineTo(87, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  textures.set(shape, t); return t;
}
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
// Fine petal rings and moving broken filaments. The centre remains transparent.
const fragment = `
varying vec2 vUv; uniform vec3 uInk,uLight; uniform float uT,uAlpha;
float ring(float r,float at,float w){return exp(-pow((r-at)/w,2.));}
void main(){
 vec2 p=vUv*2.-1.; float r=length(p),a=atan(p.y,p.x);
 float petals=pow(.5+.5*cos((a+uT*.7)*8.),5.);
 float line=ring(r,.84,.009)+ring(r,.9,.004)*.5;
 float detail=ring(r,.60+petals*.16,.007)*.65;
 float ticks=pow(max(0.,cos(a*32.)),24.)*ring(r,.87,.024)*.45;
 float filament=ring(r,.72+.08*sin(a*3.-uT*3.),.012)*pow(.5+.5*sin(a*2.+uT*4.),3.);
 float alpha=(line*.4+detail+ticks+filament)*uAlpha;
 alpha*=smoothstep(.38,.55,r)*(1.-smoothstep(.94,1.,r));
 if(alpha<.003)discard;
 gl_FragColor=vec4(mix(uInk,uLight,clamp(filament+ticks,0.,1.)),alpha);
}`;
export function detailLimits(low) { return low ? { live: 6, motes: 5, ornaments: 2 } : { live: 16, motes: 12, ornaments: 4 }; }

export function createClassDetail(base, classId, player) {
  const theme = CLASS_VFX[classId];
  if (!theme) return { fx: base, cast() {} };
  const ink = new THREE.Color(theme.ink), light = new THREE.Color(theme.light);
  // Shared by local and remote runners, bounded even when a party casts together.
  base.detailState ??= { live: 0 };
  const state = base.detailState;
  const limits = () => detailLimits(document.getElementById('quality')?.value === 'low' || globalThis.matchMedia?.('(pointer:coarse)').matches);
  const reserve = () => { if (state.live >= limits().live) return false; state.live++; return true; };
  function seal(radius, life) {
    if (!reserve()) return;
    const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uInk: { value: ink }, uLight: { value: light }, uT: { value: 0 }, uAlpha: { value: 0 } } });
    const mesh = new THREE.Mesh(disc, mat); mesh.rotation.x = -Math.PI / 2; base.add(mesh);
    base.addTask((dt, t) => {
      const p = base.toLocal(player.position); mesh.position.set(p.x, .055, p.z);
      const f = t / life; mat.uniforms.uT.value = t;
      mat.uniforms.uAlpha.value = Math.min(1, f * 6) * Math.max(0, 1 - f) * .65;
      mesh.scale.setScalar(radius * (.85 + .15 * Math.min(1, f * 4)));
      if (f >= 1) { base.kill(mesh); state.live--; return false; }
    });
  }
  function ornaments(life) {
    if (!reserve()) return;
    const group = new THREE.Group(); base.add(group);
    const paper = theme.shape === 'paper', leaf = theme.shape === 'leaf', count = limits().ornaments;
    const mat = new THREE.MeshBasicMaterial({ color: paper || leaf ? '#ffffff' : light,
      map: paper || leaf ? texture(theme.shape) : base.glowTex, transparent: true,
      side: THREE.DoubleSide, depthWrite: false, opacity: 0 });
    const pieces = [];
    let flow;
    if (paper || leaf) {
      flow = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uInk: { value: ink }, uLight: { value: light }, uT: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: `varying vec2 vUv; uniform float uT;
          void main(){vUv=uv; float a=uv.x*5.4+uT*1.8,r=.52+.06*sin(a*2.);
          vec3 p=vec3(cos(a)*r,.95+sin(a*.8)*.23,sin(a)*r);
          p+=vec3(cos(a),.3,sin(a))*(uv.y-.5)*.075;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `varying vec2 vUv; uniform vec3 uInk,uLight; uniform float uT,uAlpha;
          void main(){float edge=pow(max(0.,sin(vUv.y*3.14159)),.7);
          float strand=pow(.5+.5*cos(vUv.y*18.+vUv.x*12.-uT*3.),6.);
          float a=sin(vUv.x*3.14159)*edge*uAlpha;
          gl_FragColor=vec4(mix(uInk,uLight,strand*.65),a);}` });
      group.add(new THREE.Mesh(ribbon, flow));
    }
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(plane, mat); group.add(m);
      m.scale.set(paper ? .32 : leaf ? .12 : .035, paper ? .54 : leaf ? .23 : .32, 1); pieces.push(m);
    }
    base.addTask((dt, t) => {
      group.position.copy(base.toLocal(player.position));
      const f = t / life; mat.opacity = Math.min(1, f * 8) * Math.max(0, 1 - f) * (paper ? .85 : .65);
      if (flow) { flow.uniforms.uT.value = t; flow.uniforms.uAlpha.value = Math.min(1, f * 8) * Math.max(0, 1 - f) * .8; }
      pieces.forEach((m, i) => {
        const a = i / count * Math.PI * 2 + t * (paper ? .8 : 2.2), r = paper ? .53 : .38 + f * .24;
        m.position.set(Math.cos(a) * r, .85 + Math.sin(a * 1.5 + t) * .17 + f * .35, Math.sin(a) * r);
        m.quaternion.copy(base.camera.quaternion); m.rotateZ(Math.sin(a + t) * .25);
      });
      if (f >= 1) { base.kill(group); state.live--; return false; }
    });
  }
  function impact(p, scale = 1) {
    if (!reserve()) return;
    // Existing particle buffers: no extra lights or particle draw calls.
    const n = Math.min(theme.count, limits().motes), leaf = theme.shape === 'leaf';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, speed = .65 + (i % 3) * .25;
      base.emit({ p: p.clone(), v: new THREE.Vector3(Math.cos(a) * speed, .25 + (i % 3) * .18, Math.sin(a) * speed),
        c: i % 3 ? ink : light, size: (leaf ? .095 : .035) * Math.min(scale, 1.3), size1: .008,
        life: .32 + (i % 3) * .07, shape: leaf ? 1 : 3, drag: 1.8, vr: leaf ? 2 : 0, a: .7 });
    }
    base.after(.55, () => { state.live--; });
  }
  // Scoped facade: never assign a class palette to the shared engine.
  const fx = new Proxy(base, { get(target, key) {
    if (key === 'impact' || key === 'hitSpark') return (p, size, ...args) => {
      const result = target[key](p, size, ...args); impact(p, size); return result;
    };
    if (key === 'slashArc') return (p, aim, o = {}) => target.slashArc(p, aim, {
      ...o, ...(classId === 'muaythai' && (!o.pal || o.pal === 'blue') ? { pal: 'copper' } : {}),
      ...(classId === 'warrior' && o.pal === 'red' ? { pal: 'gold' } : {}),
    });
    return Reflect.get(target, key);
  } });
  return { fx, cast(duration) {
    const life = Math.min(1.1, Math.max(.45, duration)); ornaments(life);
    if (classId === 'shaman' || classId === 'herbalist') seal(classId === 'shaman' ? .85 : .7, life);
  } };
}
export function withClassDetail(classId, factory) {
  return options => {
    const detail = createClassDetail(options.fx, classId, options.player);
    const runner = factory({ ...options, fx: detail.fx }), cast = runner.cast;
    runner.cast = (...args) => { const duration = cast.apply(runner, args); if (duration) detail.cast(duration); return duration; };
    return runner;
  };
}
