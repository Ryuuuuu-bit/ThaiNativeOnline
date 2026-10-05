/* ---------------- comet flame (reference: bright head, flowing orange streaks, red rim, tapering tail) ---------------- */
const NOISE_GLSL = `float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y); }
  float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*n2(p); p*=2.03; a*=.5; } return s; }`;
const COMET_GEO = (() => { const g = new THREE.PlaneGeometry(1, 1, 24, 6); g.translate(.5, 0, 0); return g; })();
function cometMat(seed) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uA: { value: 1 }, uSeed: { value: seed }, uHot: { value: C(2.8, 2.5, 1.6) }, uMid: { value: C(2.6, 1.3, .3) }, uRim: { value: C(2.2, .4, .1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uT,uA,uSeed; uniform vec3 uHot,uMid,uRim; ${NOISE_GLSL}
      void main(){ float x=vUv.x, y=(vUv.y-.5)*2.;
        float hx=.14, prof = x<hx ? sqrt(max(0.,1.-pow((hx-x)/hx,2.))) : pow(1.-(x-hx)/(1.-hx),1.15);
        float n=fbm(vec2(x*5.-uT*5.+uSeed, y*2.2+uSeed));
        float edge=prof*(.7+.55*n)*(x<hx?1.:1.);
        float d=abs(y-.12*sin(x*9.-uT*8.+uSeed)*x)/max(edge,1e-3);
        if(d>1.) discard;
        float core=(1.-smoothstep(0.,.6,d))*(1.-smoothstep(.0,.55,x));
        float st=smoothstep(.55,.82,fbm(vec2(x*10.-uT*7.+uSeed, y*5.)));
        vec3 c=mix(uRim,uMid,smoothstep(1.,.35,d)); c=mix(c,uHot,core); c+=uMid*st*(1.-d)*.7*(1.-x*.5);
        float a=(1.-smoothstep(.65,1.,d))*(1.-smoothstep(.7,1.,x))*(.55+.45*smoothstep(1.,.2,x));
        gl_FragColor=vec4(c*a*uA,1.); }` });
}
const _cv = V(), _cy = V(), _cz = V(), _cx = V();
/* orient a comet quad: head at p, flowing back opposite dir, facing the camera */
function placeComet(m, p, dir, len, wid) {
  _cx.copy(dir).normalize().multiplyScalar(-len); _cv.copy(camera.position).sub(p).normalize();
  _cy.crossVectors(_cx, _cv).normalize().multiplyScalar(wid); _cz.crossVectors(_cx, _cy).normalize();
  m.matrix.makeBasis(_cx, _cy, _cz); m.matrix.setPosition(p); m.matrixWorldNeedsUpdate = true;
}
function makeComet(len, wid, pal) {
  const m = new THREE.Mesh(COMET_GEO, cometMat(rand(0, 9))); m.matrixAutoUpdate = false; m.frustumCulled = false; scene.add(m);
  if (pal) { m.material.uniforms.uHot.value = pal[0]; m.material.uniforms.uMid.value = pal[1]; m.material.uniforms.uRim.value = pal[2]; }
  const head = glow(C(2.6, 1.8, .7), wid * 2.2); return { m, head, len, wid, prev: null };
}
function stepComet(c, p, t) {
  const dir = c.prev ? p.clone().sub(c.prev) : V(0, 0, -1); if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
  if (!c.dir) c.dir = dir.clone().normalize(); else c.dir.lerp(dir.normalize(), .35).normalize();
  placeComet(c.m, p, c.dir, c.len, c.wid); c.m.material.uniforms.uT.value = t; c.head.position.copy(p); c.prev = p.clone();
}
function killComet(c) { kill(c.m); kill(c.head); }

/* ---------------- lava-cracked rock meteor ---------------- */
const ROCK_GEO = (() => { const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + (Math.sin(v.x * 5.1) * Math.sin(v.y * 4.3 + 1) * Math.sin(v.z * 5.7 + 2)) * .12 + (Math.sin(v.x * 13 + v.z * 11) * .04); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; })();
function rockMat() {
  return new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uHeat: { value: 1 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }`,
    fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uT,uHeat;
      vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
      vec2 cell(vec3 p){ vec3 i=floor(p), f=fract(p); float d1=8., d2=8.; for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){ vec3 g=vec3(float(x),float(y),float(z)); vec3 o=hash3(i+g); float d=length(g+o-f); if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; } return vec2(d1,d2); }
      void main(){ vec2 c=cell(vP*2.6); float crack=1.-smoothstep(.02,.11,c.y-c.x); vec2 c2=cell(vP*6.); float fine=(1.-smoothstep(.01,.06,c2.y-c2.x))*.5;
        float lit=.35+.65*max(0.,dot(vN,normalize(vec3(-.4,.8,.5)))); vec3 rock=vec3(.09,.075,.07)*lit*(.7+.6*c.x);
        float pulse=.8+.2*sin(uT*9.+vP.x*4.);
        vec3 lava=mix(vec3(2.4,.45,.08),vec3(2.8,1.8,.5),crack)*pulse;
        float rim=pow(1.-max(0.,dot(vN,vV)),2.5);
        vec3 col=mix(rock,lava,max(crack,fine)*uHeat)+vec3(2.2,.5,.12)*rim*.9*uHeat;
        gl_FragColor=vec4(col,1.); }` });
}

/* =================== new fire skills =================== */

/* 1 · คาถาอาคม — three comet-fireballs curve in, each a bright head with a flowing flame tail and ember sparks */
function skAkom() {
  const tg = nearestGhost(); face(hero, tg.pos);
  castAnim(18, () => { tipFlash(C(2.4, 1.2, .3));
    [-1.2, 0, 1.2].forEach((side, i) => after(i * .07, () => {
      const c = makeComet(1.15, .34);
      homing(staffTip(), tg, { curve: side, dur: .6, color: C(0, 0, 0), size: .01, trailN: 0,
        onFly: (p, t) => { stepComet(c, p, t);
          if (Math.random() < .8) emit({ p: p.clone().addScaledVector(c.dir || V(), -rand(.2, .9)).add(V(rand(-.12, .12), rand(-.12, .12), rand(-.12, .12))), v: V(rand(-.4, .4), rand(.2, .8), rand(-.4, .4)), c: Math.random() < .5 ? C(2.6, 1.6, .5) : C(2.4, .6, .15), life: rand(.3, .55), size: rand(.05, .1), size1: .01, shape: Math.random() < .3 ? SH.star : SH.glow }); },
        onHit: (g, p) => { killComet(c); hurt(g, 95); flash(p, 0xff8030, 25, .3);
          burst(p, 18, { c: [C(2.6, 1.6, .4), C(2.4, .6, .15)], size: .14, sp: 3.5, life: .45, drag: 3 });
          burst(p, 6, { c: C(.3, .22, .18), S: PN, size: .4, size1: .9, sp: 1, upMin: .5, life: .8, shape: SH.soft, a: .55 });
          shock(g.pos.x, g.pos.z, .9, C(2.2, .8, .2), C(1, .3, .1), .3); } });
    }));
  });
  return 1.9;
}

/* 5 · เพลิงกัลป์ปราบผี — the sky splits red; four waves of lava-cracked rock meteors trailing fire pound the ground and set ghosts burning */
function meteorStrike(land, size) {
  const from = land.clone().add(V(-2.2, 7.5, 1.6)), rock = new THREE.Mesh(ROCK_GEO, rockMat()); rock.scale.setScalar(size); scene.add(rock);
  const c = makeComet(size * 7, size * 2.1, [C(2.8, 2.3, 1.3), C(2.6, 1.1, .25), C(2, .3, .08)]); c.head.scale.setScalar(size * 4);
  const spin = V(rand(-4, 4), rand(-4, 4), rand(-4, 4)), dur = .42;
  addTask((dt, t) => {
    const u = clamp01(t / dur), p = from.clone().lerp(land, u * u * (3 - 2 * u) * .3 + u * .7);
    rock.position.copy(p); rock.rotation.x += spin.x * dt; rock.rotation.y += spin.y * dt; rock.material.uniforms.uT.value = t;
    stepComet(c, p, t);
    for (let q = 0; q < 2; q++) emit({ p: p.clone().add(V(rand(-.3, .3), rand(-.3, .3), rand(-.3, .3)).multiplyScalar(size * 2)), v: V(rand(-.4, .4), rand(.4, 1.2), rand(-.4, .4)), c: Math.random() < .5 ? C(2.6, 1.4, .35) : C(2.2, .5, .12), life: .5, size: size * .5, size1: .03 });
    if (Math.random() < .5) emit({ p: p.clone(), v: V(rand(-.2, .2), rand(.3, .7), rand(-.2, .2)), c: C(.22, .18, .16), life: 1, size: size * 1.4, size1: size * 3, shape: SH.soft, a: .45 }, PN);
    if (u >= 1) { scene.remove(rock); rock.material.dispose(); killComet(c); impact(land, size); return false; }
  });
}
function impact(p, size) {
  const s = size / .45;
  shock(p.x, p.z, 1.6 * s, C(2.6, 1.2, .3), C(1.2, .25, .05), .5);
  burst(p.clone().setY(.3), 26, { c: [C(2.6, 1.6, .4), C(2.4, .6, .15), C(2.8, 2.2, 1.2)], size: .2, sp: 5 * s, upMin: .3, upK: 1.2, life: .6, drag: 3 });
  burst(p.clone().setY(.4), 10, { c: [C(.26, .2, .18), C(.18, .14, .12)], S: PN, size: .8, size1: 1.8, sp: 1.6, upMin: .5, life: 1.3, shape: SH.soft, a: .7, drag: 1.5 });
  /* rock debris */
  for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(ROCK_GEO, rockMat()); d.scale.setScalar(rand(.05, .11) * s); d.position.copy(p).setY(.2); scene.add(d);
    const v = V(rand(-3, 3), rand(3, 5.5), rand(-3, 3)), r = V(rand(-9, 9), rand(-9, 9), 0);
    addTask((dt, t) => { v.y -= 14 * dt; d.position.addScaledVector(v, dt); d.rotation.x += r.x * dt; d.rotation.y += r.y * dt; d.material.uniforms.uHeat.value = Math.max(0, 1 - t / .8);
      if (d.position.y < .05) { d.position.y = .05; v.multiplyScalar(.3); v.y = Math.abs(v.y) * .3; } if (t > 1.3) { scene.remove(d); d.material.dispose(); return false; } }); }
  /* scorched glowing crater that cools */
  const cr = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * s, 2.2 * s), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 1 }, uSeed: { value: rand(0, 9) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uA,uSeed; ${NOISE_GLSL}
      void main(){ vec2 p=vUv*2.-1.; float r=length(p); float n=fbm(p*4.+uSeed); float ring=smoothstep(.55,.35,abs(r-.3-n*.25))*smoothstep(1.,.5,r);
        float cr=smoothstep(.62,.7,fbm(p*7.+uSeed+3.))*smoothstep(.9,.2,r); vec3 c=vec3(2.4,.7,.15)*(ring*.5+cr*1.2); gl_FragColor=vec4(c*uA,1.); }` }));
  cr.rotation.x = -Math.PI / 2; cr.position.set(p.x, .045, p.z); scene.add(cr);
  addTask((dt, t) => { cr.material.uniforms.uA.value = Math.max(0, 1 - t / 1.6); if (t > 1.6) { kill(cr); return false; } });
}
function skKalp() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), P = gc.clone(); P.y = 0; const R = 2.75; face(hero, P);
  castAnim(10, () => tipFlash(C(2.6, .8, .2)), 3, 'spell');
  const sky = glow(C(1.8, .4, .1), 10); sky.position.set(P.x, 7, P.z); sky.material.opacity = 0;
  const mark = decal(3, P.x, P.z, R, C(1.4, .4, .08), C(.6, .1, .02), { auto: false, alpha: .7 });
  addTask((dt, t) => { sky.material.opacity = clamp01(t * 2) * clamp01((3 - t) / .5) * .6; mark.u.uAlpha.value = .7 * clamp01(t * 3) * clamp01((3 - t) / .5); if (t > 3) { kill(sky); mark.auto = true; mark.t = 99; return false; } });
  for (let w = 0; w < 4; w++) after(.5 + w * .26, () => {
    for (let k = 0; k < (w === 3 ? 2 : 3); k++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R * .85; after(rand(0, .12), () => meteorStrike(V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r), w === 3 ? .6 : rand(.32, .45))); }
    after(.45, () => { flash(P, 0xff6020, 45, .35); shake = w === 3 ? .3 : .14; livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4).forEach(g => { hurt(g, 230, w === 3, .3); if (w === 0) burnOn(g); }); });
  });
  return 3.2;
}
function burnOn(g) { let n = 0; popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ไฟกัลป์ลุกไหม้', 'st');
  addTask((dt, t) => { for (let k = 0; k < 2; k++) emit({ p: g.pos.clone().add(V(rand(-.35, .35), rand(.1, 1.4), rand(-.2, .2))), v: V(0, rand(.8, 1.6), 0), c: Math.random() < .5 ? FIRE : EMBER, life: .45, size: .18, size1: .02 });
    if (t > .6 * (n + 1) && n < 4) { n++; if (g.alive) { g.hp -= 55; popup(headP(g), '55', 'hurt'); if (g.hp <= 0) ghostDie(g); } } if (t > 2.6) return false; }); }

