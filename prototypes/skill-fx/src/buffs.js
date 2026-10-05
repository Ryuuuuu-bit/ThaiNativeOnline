/* ---------------- buff visuals: each party buff gets its own aura + an icon chip under the HP bar ---------------- */
function buffChip(a, iconKey, color, dur) {
  if (!a.chips) { a.chips = document.createElement('div'); a.chips.className = 'chips'; labels.appendChild(a.chips); }
  const old = a.chips.querySelector(`[data-k="${iconKey}"]`); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'chip'; el.dataset.k = iconKey; el.style.setProperty('--c', color);
  el.innerHTML = `<img alt="" src="${A[iconKey]}"><i></i>`; a.chips.appendChild(el);
  addTask((dt, t) => {
    const s = toScreen(V(a.pos.x, a.barY, a.pos.z)); a.chips.style.left = s.x + 'px'; a.chips.style.top = (s.y + 8) + 'px';
    el.lastChild.style.height = (100 * (1 - t / dur)) + '%';
    if (t >= dur || !el.isConnected) { el.remove(); return false; }
  });
}
/* tiger: striped fire ring at the feet + orange afterimages that shimmer like speed */
function auraTiger(a, dur) {
  const ring = decal(3, a.pos.x, a.pos.z, .85, C(1.4, .55, .12), C(.7, .15, .02), { auto: false, alpha: .8 });
  let ghostT = 0, side = 1;
  addTask((dt, t) => {
    ring.m.position.set(a.pos.x, .04, a.pos.z); ring.u.uAlpha.value = .8 * clamp01(t * 4) * clamp01((dur - t) / .4);
    ghostT -= dt;
    if (ghostT <= 0 && !a.down) {
      ghostT = .16; side = -side;
      const m = new THREE.SpriteMaterial({ map: a.sp.material.map, color: C(1.25, .55, .15), transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending });
      const g = new THREE.Sprite(m); g.center.copy(a.sp.center); g.scale.copy(a.sp.scale); g.position.copy(a.sp.position).add(V(side * .16, 0, -.05)); scene.add(g);
      addTask((dt2, t2) => { m.opacity = .45 * (1 - t2 / .35); g.position.x -= side * dt2 * .5; if (t2 > .35) { scene.remove(g); m.dispose(); return false; } });
    }
    if (Math.random() < dt * 10) emit({ p: a.pos.clone().add(V(rand(-.35, .35), .05, rand(-.2, .2))), v: V(rand(-1.4, -.6) * side, rand(.1, .4), 0), c: EMBER, life: .35, size: .09, size1: .02 });
    if (t >= dur) { ring.auto = true; ring.t = 99; return false; }
  });
}
/* mist: a small rain cloud hovers over each ally, drizzle + a ripple ring at the feet, MP drops swirl in */
function auraMist(a, dur) {
  const rip = decal(5, a.pos.x, a.pos.z, .95, C(.25, .7, .8), null, { auto: false, alpha: .8 });
  addTask((dt, t) => {
    const top = V(a.pos.x, a.barY + .45, a.pos.z), live = clamp01((dur - t) / .5);
    rip.m.position.set(a.pos.x, .04, a.pos.z); rip.u.uAlpha.value = .8 * clamp01(t * 3) * live;
    if (Math.random() < dt * 22 * live) emit({ p: top.clone().add(V(rand(-.42, .42), rand(-.08, .12), rand(-.15, .15))), v: V(rand(-.05, .05), 0, 0), c: Math.random() < .5 ? C(.78, .9, .92) : C(.6, .78, .82), life: .7, size: rand(.32, .45), size1: .5, shape: SH.soft, a: .55 }, PN);
    if (Math.random() < dt * 26 * live) emit({ p: top.clone().add(V(rand(-.35, .35), -.12, rand(-.12, .12))), v: V(0, -3.2, 0), c: C(.5, 1.1, 1.5), life: .5, size: .045, grav: 3 });
    if (Math.random() < dt * 4 * live) emit({ p: top.clone().add(V(rand(-.3, .3), 0, 0)), c: MPBLUE, life: 1.2, size: .1, home: chest(a), homeK: 2.5, swirl: 3 });
    if (t >= dur) { rip.auto = true; rip.t = 99; return false; }
  });
}
/* tonic: seven coloured beads circle the waist like a rosary; red power surges shoot up from the feet */
const TONIC_COLS = [C(2.2, .45, .35), C(2.2, 1, .25), C(2, 1.8, .35), C(.5, 2, .5), C(.35, 1.8, 1.8), C(.45, .8, 2.3), C(1.5, .5, 2.2)];
function auraTonic(a, dur) {
  const beads = TONIC_COLS.map(c => { const s = glow(c, .2); return s; });
  let surge = .2;
  addTask((dt, t) => {
    const live = clamp01((dur - t) / .4) * clamp01(t * 4);
    beads.forEach((s, i) => { const an = t * 2.6 + i / 7 * 6.28; s.position.set(a.pos.x + Math.cos(an) * .55, .95 + Math.sin(an) * .18, a.pos.z + Math.sin(an) * .38); s.material.opacity = live; });
    surge -= dt;
    if (surge <= 0 && !a.down && live > .5) {
      surge = .65; shock(a.pos.x, a.pos.z, .75, C(2, .5, .2), C(1.2, .3, .1), .35);
      for (let k = 0; k < 10; k++) emit({ p: a.pos.clone().add(V(rand(-.25, .25), .1, rand(-.15, .15))), v: V(0, rand(3.5, 5.5), 0), c: Math.random() < .6 ? C(2.2, .55, .2) : GOLD, life: .4, size: .14, size1: .02, drag: 2 });
    }
    if (t >= dur) { beads.forEach(kill); return false; }
  });
}
/* mother: a crown of golden rice grains turns above the head; crit glints flash on the body */
function auraMother(a, dur) {
  const grains = Array.from({ length: 8 }, () => glow(C(1.7, 1.3, .45), .14));
  let glint = .3;
  addTask((dt, t) => {
    const live = clamp01((dur - t) / .4) * clamp01(t * 3);
    grains.forEach((s, i) => { const an = -t * 1.4 + i / 8 * 6.28; s.position.set(a.pos.x + Math.cos(an) * .32, a.barY + .3 + Math.sin(t * 3 + i) * .03, a.pos.z + Math.sin(an) * .2); s.material.opacity = live; });
    glint -= dt;
    if (glint <= 0 && !a.down && live > .5) {
      glint = rand(.5, .9); const p = chest(a).add(V(rand(-.35, .35), rand(-.3, .5), .2));
      emit({ p, c: C(2.6, 2.1, 1), life: .3, size: .55, size1: .1, shape: SH.star, rot: rand(-.3, .3) });
      emit({ p, c: GOLD, life: .3, size: .25, size1: .05 });
    }
    if (Math.random() < dt * 8 * live) emit({ p: a.pos.clone().add(V(rand(-.5, .5), a.barY + .2, rand(-.3, .3))), v: V(0, -.6, 0), c: GOLD_SOFT, life: 1.6, size: .05, grav: .2 });
    if (t >= dur) { grains.forEach(kill); return false; }
  });
}

