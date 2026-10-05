/* 10 · พายุอัสนีเทพ — a black storm wheel forms overhead, sky-arcs crawl cloud to cloud, then five rounds of forked bolts hammer every ghost around the shaman */
function skStorm() {
  const P = hero.pos.clone(); P.y = 0; const R = 4.25; face(hero, nearestGhost().pos);
  castAnim(9, () => tipFlash(C(.8, 1.2, 2.8)), 3, 'spell');
  const dark = $('dim'); dark.style.opacity = '.3';
  const wheel = decal(1, P.x, P.z, R, C(.6, .9, 2.2), null, { auto: false, alpha: .55 });
  let arcT = .2;
  addTask((dt, t) => {
    if (t < 2.7 && Math.random() < .8) emit({ p: V(P.x + rand(-R, R), 4.7 + rand(-.3, .3), P.z + rand(-R, R) * .8), v: V(rand(-.3, .3), 0, rand(-.3, .3)), c: C(.1, .12, .22), life: 1.4, size: rand(1.2, 1.8), size1: 2.2, shape: SH.soft, a: .75, swirl: .35 }, PN);
    arcT -= dt; if (t < 2.6 && arcT <= 0) { arcT = rand(.12, .3); const a = V(P.x + rand(-R, R), 4.6, P.z + rand(-R, R) * .7), b = a.clone().add(V(rand(-2.5, 2.5), rand(-.4, .2), rand(-1.5, 1.5)));
      lightning(a, b, { w: .07, branches: 2, life: .18, blen: .6, disp: .3, haze: 1.2 }); }
    wheel.u.uAlpha.value = .55 * clamp01(t * 3) * clamp01((3 - t) / .4);
    if (t > 3) { wheel.auto = true; wheel.t = 99; dark.style.opacity = '0'; return false; }
  });
  for (let w = 0; w < 5; w++) after(.55 + w * .25, () => {
    const tg = livingGhosts().filter(g => g.pos.distanceTo(P) <= R + .4);
    const spots = tg.map(g => g.pos.clone()); for (let k = spots.length; k < 4; k++) { const a = rand(0, 6.28), r = rand(1.2, R); spots.push(V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r)); }
    spots.forEach((s, i) => after(i * .035, () => {
      if (w === 0) crackleTree(s.clone(), .2, 1.1);
      lightning(V(s.x + rand(-.5, .5), 4.6, s.z + rand(-.3, .3)), V(s.x, 0, s.z), { w: .16, branches: 5, life: .32, blen: 1.1 });
      boltImpact(V(s.x, 0, s.z), .85);
    }));
    flash(P, 0xa8c4ff, 60, .3); shake = .15;
    tg.forEach(g => { hurt(g, 175, w === 4, .2); stunStars(g, .4); });
  });
  return 3.2;
}

