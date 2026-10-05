/* 1 · ฟันดาบคู่ — step in: an X of two crescents from both blades, then a wide blood-edged finisher; bleeding */
function skTwin() {
  const tg = nearestGhost(), stand = tg.pos.clone().add(hero.pos.clone().sub(tg.pos).setY(0).normalize().multiplyScalar(1.3));
  moveTo(hero, stand, .28, () => {
    const dir = tg.pos.clone().sub(hero.pos);
    const hit = (last) => { inFront(2.3, 1.1, hero.pos, dir).forEach(g => { hurt(g, 160, last); sparks(chest(g), 12, [WHITE, C(.8, 1.6, 2.6)]); if (last) bleed(g); }); shake = last ? .1 : .05; };
    dualSlash(tg.pos, { fps: 20, r: 1.6, sweep: 2.5, pal: 'blue', onHit: () => hit(false) });
    after(.5, () => {
      play(hero, 'slash', { fps: 30, from: 2, once: () => play(hero, 'idle') });
      after(.05, () => { slashArc(chest(hero).add(V(0, -.1, 0)), tg.pos, { r: 1.9, sweep: 3, roll: 0, dir: 1, pal: 'blood', thick: .62, dur: .13 }); hit(true); });
    });
    after(1.05, () => goHome());
  }, { trail: C(.5, .6, .9) });
  return 2.3;
}

/* 3 · ดาบวายุ — both blades cut and each releases a travelling wind crescent; the two cross into an X as they tear down the line */
function skWind() {
  const tg = nearestGhost(), dir = tg.pos.clone().sub(hero.pos).setY(0).normalize(), hit = new Set(), from = hero.pos.clone();
  dualSlash(tg.pos, { fps: 22, r: 1.3, sweep: 2.4, pal: 'wind', dur: .12, hold: .02, dis: .2, onHit: i => {
    slashArc(chest(hero), tg.pos, { r: 1.2, sweep: 2.2, pal: 'wind', thick: .55, roll: i ? -.35 : .35, dir: i ? -1 : 1, dur: .1, dis: .25,
      fly: { dir, speed: 7, range: 5.6, onMove: (p, s) => {
        if (Math.random() < .5) emit({ p: p.clone().setY(.1).addScaledVector(V(-dir.z, 0, dir.x), rand(-1, 1) * s * .8), v: V(0, rand(.3, .8), 0), c: DUST, life: .7, size: .3, size1: .7, shape: SH.soft, a: .45 }, PN);
        livingGhosts().forEach(g => { if (hit.has(g)) return; const v = g.pos.clone().sub(from).setY(0), along = v.dot(dir), side = v.clone().sub(dir.clone().multiplyScalar(along)).length();
          const d = p.clone().sub(from).setY(0).length(); if (along > 0 && along <= d + .2 && side < s) { hit.add(g); hurt(g, 230, false, .4); sparks(chest(g), 12, [WHITE, C(.8, 2, 2)]); } });
      } } });
  } });
  return 2;
}

/* 5 · เพลงดาบพิฆาต — leap into the pack: three turns of crossed fire crescents (six cuts) at every angle, then a flame burst */
function skPikat() {
  const gc = centroid(livingGhosts().length ? livingGhosts() : ghosts), spot = gc.clone().add(hero.pos.clone().sub(gc).setY(0).normalize().multiplyScalar(.6));
  moveTo(hero, spot, .3, () => {
    const R = 2.3, P = hero.pos.clone(); const ring = decal(3, P.x, P.z, R, C(1.3, .5, .1), C(.6, .12, .02), { auto: false, alpha: .8 });
    const base = rand(0, 6.28);
    for (let k = 0; k < 3; k++) after(k * .36, () => {
      const ang = base + k * 2.1, aim = P.clone().add(V(Math.cos(ang), 0, Math.sin(ang)));
      dualSlash(aim, { fps: 26, r: R, sweep: 3.1, pal: 'fire', thick: .55, roll: .35 + k * .12, at: () => chest(hero).add(V(0, (k - 1) * .15, 0)), onHit: i => {
        livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .6).forEach(g => { hurt(g, 140, k === 2 && i === 1); sparks(chest(g), 8, [EMBER, WHITE]); });
        for (let q = 0; q < 12; q++) { const a = rand(0, 6.28); emit({ p: P.clone().add(V(Math.cos(a) * R * .7, rand(.3, 1.6), Math.sin(a) * R * .7)), v: V(Math.cos(a + 1.5) * 3, rand(.2, 1.2), Math.sin(a + 1.5) * 3), c: Math.random() < .5 ? EMBER : FIRE, life: .45, size: .12, size1: .02, drag: 2 }); }
        shake = .07;
      } });
    });
    addTask((dt, t) => { ring.m.position.set(P.x, .04, P.z); ring.u.uAlpha.value = .8 * clamp01(t * 5) * clamp01((1.5 - t) / .3); if (t > 1.5) { ring.auto = true; ring.t = 99; return false; } });
    after(1.25, () => { shake = .22; flash(P, 0xff7a2a, 50, .5); shock(P.x, P.z, R * 1.4, C(2.6, 1.2, .3), FIRE, .5);
      burst(P.clone().setY(.6), 60, { c: [EMBER, FIRE, C(2.6, 2, .8)], size: .16, sp: 6, upMin: .2, life: .7, drag: 3 });
      burst(P.clone().setY(.3), 20, { c: [C(.3, .25, .22), C(.2, .17, .15)], S: PN, size: .6, size1: 1.4, sp: 2.5, upMin: .4, life: 1.2, shape: SH.soft, a: .7, drag: 2 });
      after(.4, () => goHome()); });
  }, { trail: C(1.2, .5, .2) });
  return 3.1;
}

