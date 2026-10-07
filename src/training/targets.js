import * as THREE from 'three';

// Targets for the class kits' skill FX (src/classes/fx/*-skills.js). A runner is
// built once with one target object and reads it on every blow:
//   pos, off (FX-local Vector3s), alive, barY, stun, chest(), head(),
//   hurt(amount, crit, push, from, exact), miss(), knock(dir, dist, dur), bleed()
// The training dummy (src/classes/fx/dummy.js) is one. createTargetProxy() hands
// the runner a stand-in that forwards to whatever target is bound, so the same
// runner hits the dummy in the city and monsters on the zone maps.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function createTargetProxy(initial) {
  let current = initial;
  return new Proxy({}, {
    get(_, key) {
      if (key === 'bind') return target => { current = target; };
      if (key === 'current') return current;
      const v = current[key];
      return typeof v === 'function' ? v.bind(current) : v;
    },
    set(_, key, value) { current[key] = value; return true; },
  });
}

// No target (a self skill cast with nothing around): a point two metres ahead of
// the player that takes no damage, so buff FX still have somewhere to face.
export function stubTarget(fx, player) {
  const pos = () => {
    const a = player.rotation.y;
    return fx.toLocal(player.position.clone().add(V(Math.sin(a) * 2, 0, Math.cos(a) * 2))).setY(0);
  };
  return {
    get pos() { return pos(); }, off: V(), alive: false, barY: 1.6, hp: 0, maxHp: 1, stun: false,
    chest: () => pos().setY(1), head: () => pos().setY(1.8),
    hurt: () => 0, miss() {}, knock() {}, bleed() {},
  };
}

// A party member a heal is aimed at (KitCaster.allyPick): `get()` → { x, z } (world) while they are
// here, so a tether follows them as they walk. Blows on it do nothing; the heal is the server's.
export function allyTarget(get, fx) {
  let last = get() ?? { x: 0, z: 0 };
  const pos = () => { last = get() ?? last; return fx.toLocal(V(last.x, fx.root.position.y, last.z)).setY(0); };
  return {
    ally: true, off: V(), barY: 1.6, hp: 1, maxHp: 1, stun: false,
    get pos() { return pos(); }, get alive() { return !!get(); },
    chest: () => pos().setY(1), head: () => pos().setY(1.8),
    hurt: () => 0, miss() {}, knock() {}, bleed() {},
  };
}

// A combat monster (src/combat/Combat.js Monster, world XZ) seen as an FX target.
// Blows go to onHurt(monster, amount, crit, exact) / onMiss(monster), which route
// them through Combat (numbers, aggro, kill, loot). Knock-backs push the monster.
export function monsterTarget(m, { fx, canStand, onHurt, onMiss }) {
  const barY = (1.4 * (m.def.size ?? 1) + .55) / fx.K, off = V();
  const pos = () => fx.toLocal(V(m.x, fx.root.position.y, m.z)).setY(0);
  return {
    monster: m, off, barY, mob: true, stun: false,
    get pos() { return pos(); }, get alive() { return m.alive; }, get hp() { return m.hp; }, get maxHp() { return m.maxHp; },
    chest: () => pos().setY(barY * .55), head: () => pos().setY(barY + .2),
    hurt: (amount, crit, push, from, exact = false) => onHurt(m, amount, crit, exact),
    miss: () => onMiss(m),
    knock(dir, dist, dur = .3) {
      const d = dir.clone().setY(0).normalize(), total = Math.min(2, dist * fx.K);
      let done = 0;
      fx.addTask((dt, t) => {
        const u = Math.min(1, t / dur), want = total * Math.sin(u * Math.PI / 2), step = want - done; done = want;
        const x = m.x + d.x * step, z = m.z + d.z * step;
        if (m.alive && canStand(x, z)) { m.x = x; m.z = z; }
        if (u >= 1) return false;
      });
    },
    bleed() {},   // bleeding comes from the rules effect (kitCombat.hitEffects)
  };
}
