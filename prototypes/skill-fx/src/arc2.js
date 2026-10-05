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
        float prof=pow(max(sin(f*3.1416),0.),.55)*(.35+.65*f);
        float inner=1.-uThick*prof;
        if(r>1.||r<inner-.1) discard;
        float w=clamp((r-inner)/(1.-inner+1e-4),0.,1.);
        float n=fbm(vec2(f*7.+uSeed,w*2.5));
        float tend=smoothstep(0.,.3,w+(n-.5)*.6+.1*sin(f*55.+uSeed*3.));
        float rev=step(f,uP);
        float dn=fbm(vec2(f*6.,w*3.)+uSeed*1.7);
        float dis=smoothstep(uDis-.08,uDis+.08,dn*.8+w*.4);
        float a=tend*rev*dis*(1.-smoothstep(.975,1.,r));
        float st=smoothstep(.58,.78,fbm(vec2(f*14.-uP*2.,w*3.5)+uSeed+2.));
        float edge=smoothstep(.7,.97,w);
        vec3 col=mix(uC3,uC2,smoothstep(0.,.75,w));
        col=mix(col,uC1,edge);
        col*=1.-st*.8*(1.-edge);
        col+=uC1*exp(-pow((f-uP)/.05,2.))*edge*1.3;
        gl_FragColor=vec4(col*a*uA,1.);
      }` });
}
/* centre p, aim = world point it faces, sweep radians; roll tilts the blade plane, pitch tips it toward vertical, dir ±1 swing direction.
   o.pal names a palette · o.thick belly width · o.fly {dir, speed, range, onMove} turns it into a travelling crescent */
function slashArc(p, aim, o = {}) {
  const r = o.r ?? 1.5, sweep = o.sweep ?? 2.5, start = Math.PI / 2 - sweep / 2, palKey = o.pal || 'blue', pal = PALS[palKey];
  const m = new THREE.Mesh(ARC_GEO, arcMat(pal, sweep, start, o.thick ?? .5, o.seed ?? rand(0, 9)));
  const G = new THREE.Group(), T = new THREE.Group(); G.add(T); T.add(m); scene.add(G);
  G.position.copy(p); const tgt = aim.clone(); tgt.y = p.y; if (tgt.distanceTo(p) < .01) tgt.z -= 1; G.lookAt(tgt);
  T.rotation.z = o.roll ?? 0; T.rotation.x = o.pitch ?? 0; m.rotation.x = Math.PI / 2; if ((o.dir ?? 1) < 0) m.rotation.y = Math.PI;
  m.scale.setScalar(r);
  const U = m.material.uniforms, tSw = o.dur ?? .15, tHold = o.fly ? o.fly.range / o.fly.speed : (o.hold ?? .07), tDis = o.dis ?? .34;
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
