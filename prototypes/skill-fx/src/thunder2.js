/* 4 · อัสนีบาต — a storm knot gathers, crackles climb out of the ground under the ghost, then a forked white-core bolt slams down */
function skThunder() {
  const tg = nearestGhost(); face(hero, tg.pos);
  for (let k = 0; k < 14; k++) emit({ p: V(tg.pos.x + rand(-1, 1), 4.6 + rand(-.3, .3), tg.pos.z + rand(-.7, .7)), v: V(rand(-.2, .2), 0, rand(-.2, .2)), c: C(.12, .14, .26), life: 1.4, size: rand(1, 1.6), size1: 2, shape: SH.soft, a: .8, swirl: .5 }, PN);
  castAnim(14, () => tipFlash(C(.8, 1.2, 2.8)), 3, 'spell');
  after(.15, () => crackleTree(tg.pos.clone(), .35, 1.4));
  after(.5, () => {
    const top = V(tg.pos.x + rand(-.4, .4), 4.6, tg.pos.z), bot = V(tg.pos.x, 0, tg.pos.z);
    lightning(top, bot, { w: .2, branches: 7, life: .45, blen: 1.3 }); after(.06, () => lightning(top.clone().add(V(.5, 0, -.2)), bot, { w: .1, branches: 3, life: .3 }));
    boltImpact(bot, 1.1); flash(bot, 0x9fc0ff, 90, .5); shake = .25;
    hurt(tg, 420, true, .3); stunStars(tg, .7); popup(V(tg.pos.x, tg.barY + .7, tg.pos.z), 'สะดุ้ง', 'st');
  });
  return 1.9;
}

