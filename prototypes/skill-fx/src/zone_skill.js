/* 3 · วงหนาดปราบผี — a wide yellow-green ward with a low glowing dome and a cross sigil; ghosts inside take rapid ticks (combo counter) */
const zoneFloorMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uPulse: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec2 vUv; uniform float uTime,uA,uPulse;
    void main(){ vec2 p=vUv*2.-1.; float r=length(p); if(r>1.) discard; float an=atan(p.y,p.x);
      vec3 c1=vec3(.30,.62,.12), c2=vec3(.95,1.05,.30);
      float fill=smoothstep(.15,1.,r)*.32+.05;
      float rim=exp(-pow((r-.985)/.011,2.))*1.5+exp(-pow((r-.94)/.05,2.))*.32;
      float sw=pow(.5+.5*sin(an*5.+r*13.-uTime*2.4),6.)*smoothstep(.25,.95,r)*.28;
      float sweep=pow(.5+.5*cos(an-uTime*1.5),28.)*smoothstep(.1,1.,r)*.45;
      float ring=exp(-pow((r-fract(uTime*.55))/.03,2.))*.35*(1.-r);
      vec3 col=mix(c1,c2,r)*(fill+sw+sweep+ring+uPulse*.25*(1.-r))+c2*rim;
      gl_FragColor=vec4(col*uA,1.); }` });
const zoneDomeMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uTime,uA;
    void main(){ float h=clamp((vUv.y-.5)*2.,0.,1.); float base=pow(1.-h,3.);
      float bands=pow(.5+.5*sin(vUv.x*60.-uTime*3.+h*8.),4.)*.35; float f=pow(1.-abs(dot(vN,vV)),1.6);
      vec3 col=mix(vec3(.35,.75,.15),vec3(.9,1.,.35),1.-h)*(base*.55+bands*base+f*.25*(1.-h));
      gl_FragColor=vec4(col*uA,1.); }` });
const crossTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const a = 34, b = 104; const path = () => { g.beginPath(); g.moveTo(128 - a, 128 - b); g.lineTo(128 + a, 128 - b); g.lineTo(128 + a, 128 - a); g.lineTo(128 + b, 128 - a); g.lineTo(128 + b, 128 + a); g.lineTo(128 + a, 128 + a); g.lineTo(128 + a, 128 + b); g.lineTo(128 - a, 128 + b); g.lineTo(128 - a, 128 + a); g.lineTo(128 - b, 128 + a); g.lineTo(128 - b, 128 - a); g.lineTo(128 - a, 128 - a); g.closePath(); };
  g.shadowColor = '#fff'; g.shadowBlur = 14; g.strokeStyle = '#fff'; g.lineWidth = 9; path(); g.stroke(); g.shadowBlur = 0; g.lineWidth = 4; path(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.12)'; path(); g.fill();
  return new THREE.CanvasTexture(c);
})();
function skZone() {
  const pack = livingGhosts().length ? livingGhosts() : ghosts, gc = centroid(pack);
  const P = gc.clone().add(healer.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(1.1)); P.y = 0;
  const R = 4.5, LIFE = 6, TICK = .4; castAt(P);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), zoneFloorMat()); floor.rotation.x = -Math.PI / 2; floor.position.set(P.x, .045, P.z); floor.renderOrder = 3;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 14, 0, Math.PI * 2, 0, Math.PI / 2), zoneDomeMat()); dome.position.copy(P); dome.scale.y = .26; dome.renderOrder = 4;
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: crossTex, color: C(.45, 1.5, .35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  cross.rotation.x = -Math.PI / 2; cross.position.set(P.x, .06, P.z); cross.renderOrder = 4;
  scene.add(floor, dome, cross); floor.scale.setScalar(.01); dome.scale.set(.01, .01, .01);
  shock(P.x, P.z, R, C(1.1, 1.3, .4), C(.5, .9, .2), .6); flash(P, 0xc8f070, 35, .6); shake = .1;
  const lbl = document.createElement('div'); lbl.className = 'combo'; labels.appendChild(lbl);
  let combo = 0, nextTick = .35, slowed = new Set(), leafAcc = 0;
  addTask((dt, t) => {
    const grow = easeOutBack(clamp01(t / .45)), fade = t > LIFE - .4 ? clamp01((LIFE - t) / .4) : 1;
    floor.scale.setScalar(Math.max(.01, grow)); dome.scale.set(Math.max(.01, grow), .26 * Math.max(.01, grow) * (1 + Math.sin(t * 3) * .04), Math.max(.01, grow));
    const fu = floor.material.uniforms; fu.uTime.value = t; fu.uA.value = clamp01(t * 4) * fade; fu.uPulse.value = Math.max(0, fu.uPulse.value - dt * 3);
    dome.material.uniforms.uTime.value = t; dome.material.uniforms.uA.value = clamp01(t * 3) * fade;
    cross.material.opacity = clamp01((t - .2) * 3) * fade * (.75 + Math.sin(t * 6) * .2); cross.scale.setScalar(1 + Math.sin(t * 3) * .03);
    /* leaves + motes swirl up inside the ward */
    leafAcc += dt * 26 * fade;
    while (leafAcc > 1) { leafAcc--; const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * R * .95;
      emit({ p: V(P.x + Math.cos(a) * r, .1, P.z + Math.sin(a) * r), v: V(-Math.sin(a) * 1.2, rand(.6, 1.4), Math.cos(a) * 1.2), c: Math.random() < .5 ? C(.5, .95, .3) : C(1, 1.1, .4), life: rand(.8, 1.4), size: Math.random() < .5 ? rand(.12, .18) : rand(.05, .08), shape: Math.random() < .5 ? SH.leaf : SH.glow, vr: rand(-5, 5), drag: .8 }); }
    /* rapid ticks on every ghost inside */
    if (t >= nextTick && t < LIFE - .3) {
      nextTick += TICK; const inside = livingGhosts().filter(g => g.pos.distanceTo(P) <= R);
      if (inside.length) { fu.uPulse.value = 1; combo += inside.length; lbl.textContent = combo + ' ฮิตต่อเนื่อง'; lbl.classList.remove('bump'); void lbl.offsetWidth; lbl.classList.add('bump'); }
      inside.forEach(g => {
        hurt(g, 62); burst(chest(g).add(V(0, rand(-.3, .4), 0)), 5, { c: [C(1.1, 1.4, .4), C(.6, 1.3, .3)], size: .12, sp: 2.4, life: .35, shape: SH.star, drag: 4 });
        emit({ p: V(g.pos.x, .3, g.pos.z), v: V(0, 2.4, 0), c: C(.7, 1.4, .35), life: .3, size: .5, size1: .1, a: .6 });
        if (!slowed.has(g)) { slowed.add(g); popup(V(g.pos.x, g.barY + .7, g.pos.z), 'ช้าลง 30%', 'st'); }
      });
    }
    const s = toScreen(V(P.x, 3.1, P.z)); lbl.style.left = s.x + 'px'; lbl.style.top = s.y + 'px'; lbl.style.opacity = combo ? fade : 0;
    if (t >= LIFE) {
      kill(floor); kill(dome); kill(cross); setTimeout(() => lbl.remove(), 300);
      shock(P.x, P.z, R, C(.9, 1.3, .4), HERB, .5);
      living().filter(a => a.pos.distanceTo(P) <= R + .3).forEach(a => {
        let got = false;
        for (let k = 0; k < 10; k++) emit({ p: P.clone().add(V(rand(-1, 1), rand(.4, 1.2), rand(-1, 1))), v: V(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5)), c: HERB_HOT, life: 2, size: .12, home: chest(a), homeK: 4, swirl: 2,
          onArrive: () => { if (!got) { got = true; heal(a, a.maxHp * .05); } } });
      });
      return false;
    }
  });
  return LIFE + .8;
}
/* 48px icon for the new skill (no game icon exists yet): ward circle with a cross sigil */
function zoneIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d');
  g.fillStyle = '#101a0b'; g.fillRect(0, 0, 48, 48);
  const gr = g.createRadialGradient(24, 26, 2, 24, 26, 20); gr.addColorStop(0, 'rgba(90,150,30,.15)'); gr.addColorStop(.8, 'rgba(200,220,70,.55)'); gr.addColorStop(1, 'rgba(240,250,140,1)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(24, 26, 20, 15, 0, 0, 7); g.fill();
  g.strokeStyle = '#7dff5a'; g.lineWidth = 2; const a = 4, b = 11; g.beginPath();
  [[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]].forEach(([x, y], i) => i ? g.lineTo(24 + x, 26 + y * .75) : g.moveTo(24 + x, 26 + y * .75)); g.closePath(); g.stroke();
  g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(.5, .5, 47, 47);
  return c.toDataURL();
}
A.ic_heal_zone = zoneIcon();

