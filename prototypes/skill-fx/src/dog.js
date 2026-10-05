/* ---------------- หมาไทยหลังอาน: the hunter's dog (PixelLab sprite) follows the archer and bites whatever the arrows target ---------------- */
let dog = null;
const DOG_K = .01458;
const dogHome = () => hero.pos.clone().add(V(1.0, 0, .35));
async function makeDog() {
  dog = await makeActor({ sheets: { idle: 'dog_idle', run: 'dog_run', bite: 'dog_bite' }, x: 0, z: 0, fw: 96, fh: 96, k: DOG_K, cy: .17, shadow: .73, maxHp: 800, barY: 1.25, name: 'หมา' });
  dog.pos.copy(dogHome()); dog.row = 4; dog.bar.style.visibility = 'hidden'; dog.busy = false;
  /* idle: drift back to heel if the hunter moved */
  addTask(() => { if (!dog.busy && dog.pos.distanceTo(dogHome()) > .6) dogRun(dogHome(), () => { dog.row = 4; }); });
}
function dogRun(to, cb, speed = 7.5) {
  dog.busy = true; const from = dog.pos.clone(), dur = Math.max(.12, from.distanceTo(to) / speed);
  dog.row = dirRow(to.x - from.x, to.z - from.z); play(dog, 'run', { fps: 16 });
  let dustT = 0;
  addTask((dt, t) => {
    const u = clamp01(t / dur); dog.pos.copy(from).lerp(to, u);
    dustT -= dt; if (dustT <= 0) { dustT = .06; emit({ p: dog.pos.clone().add(V(rand(-.15, .15), .05, rand(-.15, .15))), v: V(0, rand(.2, .5), 0), c: DUST, life: .45, size: .16, size1: .38, shape: SH.soft, a: .45 }, PN); }
    if (u >= 1) { play(dog, 'idle'); dog.busy = false; cb && cb(); return false; }
  });
}
function dogAttack(target, power = 1) {
  if (!dog || dog.busy || !target || !target.alive) return;
  const stand = target.pos.clone().add(dog.pos.clone().sub(target.pos).setY(0).normalize().multiplyScalar(.85));
  dogRun(stand, () => {
    dog.busy = true; dog.row = dirRow(target.pos.x - dog.pos.x, target.pos.z - dog.pos.z);
    play(dog, 'bite', { fps: 16, once: () => play(dog, 'idle') });
    after(4 / 16, () => {
      if (!target.alive) return;
      const v = Math.round(85 * power * rand(.9, 1.1)); target.hp -= v; target.tint = 1; target.tintC = C(1.15, 1.15, 1);
      popup(headP(target), 'กัด ' + v, 'dmg'); if (target.hp <= 0) ghostDie(target);
      const p = chest(target).add(V(0, -.15, .1));
      /* bite marks: two short white fang arcs snapping shut */
      [1, -1].forEach(s => { const m = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 16, 1, s > 0 ? .3 : Math.PI + .3, 2.5), new THREE.MeshBasicMaterial({ color: C(2.2, 2.2, 2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.copy(p).add(V(0, s * .2, 0)); m.lookAt(camera.position); scene.add(m);
        addTask((dt, t) => { m.position.y += -s * dt * .8; m.material.opacity = 1 - t / .25; if (t > .25) { kill(m); return false; } }); });
      burst(p, 10, { c: [C(2, 2, 1.8), C(1.4, .25, .25)], size: .09, sp: 3, life: .35, shape: SH.star, drag: 4 });
      shake = Math.max(shake, .04);
    });
    after(.62, () => dogRun(dogHome(), () => { dog.row = 4; }));
  });
}
/* which skills send the dog in, and how hard it bites */
const DOG_ON = { arch_quick: 1, arch_poison: 1, arch_pierce: 1.3, arch_volley: 1, arch_snipe: 1.6, arch_trap: 1.2, arch_rain: 1, arch_meteor: 1.2 };
function dogOnCast(id) {
  if (!(id in DOG_ON)) { if (dog && !dog.busy) { dog.row = 4; burst(dog.pos.clone().setY(.9), 6, { c: GOLD_SOFT, size: .08, sp: 1.2, upMin: .6, life: .6, shape: SH.star }); } return; }
  after(.35, () => dogAttack(nearestGhost(dog.pos), DOG_ON[id]));
}

