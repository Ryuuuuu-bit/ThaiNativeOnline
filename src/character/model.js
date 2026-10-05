// Stylized geometry character built from class appearance data.
// Ported from the original world.js makePlayer traveller.
import * as THREE from 'three';
import { getClass, getClassStats, DEFAULT_CLASS_ID } from './classes.js';
import { createActionPlayer, locomotionPose } from './poses.js';

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function mesh(geometry, mat, parent, x = 0, y = 0, z = 0, scale) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const box = (parent, mat, x, y, z, sx, sy, sz) => mesh(boxGeo, mat, parent, x, y, z, [sx, sy, sz]);

// Hand position inside an arm pivot group (arm mesh is .4 long, hanging down).
const HAND_Y = -.4;

const HAIR_BUILDERS = {
  // Ayutthaya-era short crop with a small top knot.
  topknot(body, m) {
    mesh(new THREE.SphereGeometry(.205, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55), m.hair, body, 0, 1.34, -.015);
    mesh(new THREE.SphereGeometry(.075, 8, 8), m.hair, body, 0, 1.51, -.08);
  },
  // Wrapped cloth (pha khao ma style) head wrap with a knot at the back.
  headcloth(body, m) {
    mesh(new THREE.SphereGeometry(.205, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), m.hair, body, 0, 1.33, -.02);
    mesh(new THREE.CylinderGeometry(.2, .215, .09, 12), m.headcloth, body, 0, 1.4, -.01);
    mesh(new THREE.SphereGeometry(.06, 8, 6), m.headcloth, body, 0, 1.42, -.21, [1, .8, 1.2]);
    box(body, m.headcloth, 0, 1.3, -.24, .07, .18, .03).rotation.x = .2;
  },
};

// Each builder returns { stowed, held, alwaysHeld }: `stowed` is shown at rest,
// `held` while an action's draw channel is > .5 (or always if alwaysHeld).
const WEAPON_BUILDERS = {
  sword(body, arms, m) {
    // Sheathed at the hip, exactly as the original traveller.
    const stowed = new THREE.Group(); body.add(stowed);
    box(stowed, m.weapon, -.26, .68, -.15, .035, .67, .06).rotation.z = -.28;
    box(stowed, m.weaponGrip, -.34, .98, -.15, .18, .05, .08);
    // Drawn blade in the right hand, angled forward-down.
    const held = new THREE.Group(); held.position.set(-.035, HAND_Y, 0); held.rotation.x = .46; arms.right.add(held);
    box(held, m.weaponGrip, 0, 0, -.03, .045, .05, .14);
    box(held, m.accent, 0, 0, .05, .16, .04, .04);
    box(held, m.weapon, 0, 0, .38, .035, .06, .62);
    return { stowed, held, alwaysHeld: false };
  },
  staff(body, arms, m) {
    const held = new THREE.Group(); held.position.set(-.035, HAND_Y, .02); arms.right.add(held);
    mesh(new THREE.CylinderGeometry(.025, .03, 1.45, 7), m.weapon, held, 0, -.05, 0);
    // Sai sin cord bands and a gold finial.
    for (const y of [.3, .36]) mesh(new THREE.CylinderGeometry(.034, .034, .025, 7), m.weaponGrip, held, 0, y, 0);
    mesh(new THREE.SphereGeometry(.06, 10, 8), m.accent, held, 0, .72, 0);
    mesh(new THREE.ConeGeometry(.035, .12, 8), m.accent, held, 0, .82, 0);
    return { stowed: null, held, alwaysHeld: true };
  },
  bow(body, arms, m) {
    const radius = .42;
    const makeBow = parent => {
      const bow = new THREE.Group(); parent.add(bow);
      const limb = mesh(new THREE.TorusGeometry(radius, .022, 6, 20, Math.PI), m.weapon, bow);
      limb.rotation.set(0, Math.PI / 2, Math.PI); // span along z, bulge toward -y
      const string = mesh(new THREE.CylinderGeometry(.005, .005, radius * 2, 4), m.weaponGrip, bow);
      string.rotation.x = Math.PI / 2;
      box(bow, m.weaponGrip, 0, -radius, 0, .05, .05, .1); // grip wrap
      return bow;
    };
    // Slung across the back at rest.
    const stowed = makeBow(body); stowed.position.set(0, .98, -.2); stowed.rotation.set(Math.PI / 2, 0, .6);
    stowed.scale.setScalar(.85);
    // Held in the left hand; the grip sits in the hand, string toward the shoulder.
    const held = makeBow(arms.left); held.position.set(.035, HAND_Y + radius, 0);
    // Quiver at the hip.
    const quiver = mesh(new THREE.CylinderGeometry(.06, .05, .42, 8), m.weaponGrip, body, -.24, .82, -.14);
    quiver.rotation.z = -.25;
    for (const dx of [-.02, .02]) box(body, m.accent, -.29 + dx, 1.06, -.14, .015, .1, .015).rotation.z = -.25;
    return { stowed, held, alwaysHeld: false };
  },
};

/**
 * createPlayer(scene, { classId = 'swordsman' } = {}) per docs/INTERFACES.md.
 * Throws on an unknown classId.
 */
export function createPlayer(scene, { classId = DEFAULT_CLASS_ID } = {}) {
  const def = getClass(classId);
  const { palette, hairStyle, sleeves } = def.appearance;
  const m = {};
  for (const [key, color] of Object.entries(palette)) m[key] = material(color);
  m.accent = material(palette.accent, { metalness: .25, roughness: .62 });

  const group = new THREE.Group(); group.name = `player:${classId}`; scene.add(group);
  const body = new THREE.Group(); group.add(body);

  // Head, torso (sua), sash (pha khao ma) — original proportions.
  mesh(new THREE.SphereGeometry(.20, 12, 10), m.skin, body, 0, 1.28, 0, [1, 1.12, 1]);
  (HAIR_BUILDERS[hairStyle] || HAIR_BUILDERS.topknot)(body, m);
  mesh(new THREE.CylinderGeometry(.16, .22, .47, 8), m.shirt, body, 0, .86, 0);
  mesh(new THREE.CylinderGeometry(.22, .22, .1, 8), m.sash, body, 0, .65, 0);
  // Sash tail hanging at the front, a chong kraben touch.
  box(body, m.sash, .07, .52, .2, .07, .2, .025).rotation.z = .08;

  const legs = {}, arms = {};
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'right' : 'left'; // model faces +z, so -x is its right
    const leg = new THREE.Group(); leg.position.set(sign * .105, .61, 0); body.add(leg);
    mesh(new THREE.CylinderGeometry(.095, .075, .42, 7), m.pants, leg, 0, -.2, 0);
    mesh(new THREE.SphereGeometry(.09, 8, 6), m.footwear, leg, 0, -.47, .04, [1, .5, 1.7]);
    legs[side] = leg;
    const arm = new THREE.Group(); arm.position.set(sign * .2, 1.03, 0); body.add(arm);
    mesh(new THREE.CylinderGeometry(.075, .055, .4, 7), sleeves ? m.shirt : m.skin, arm, sign * .035, -.19, 0);
    if (sleeves) mesh(new THREE.SphereGeometry(.05, 8, 6), m.skin, arm, sign * .035, HAND_Y, 0);
    arms[side] = arm;
  }

  const weapon = (WEAPON_BUILDERS[def.weapon] || WEAPON_BUILDERS.sword)(body, arms, m);
  const setDrawn = drawn => {
    if (weapon.stowed) weapon.stowed.visible = weapon.alwaysHeld ? false : !drawn;
    if (weapon.held) weapon.held.visible = weapon.alwaysHeld || drawn;
  };
  setDrawn(false);

  // Spell orb in front of the chest, scaled by the `orb` channel (cast / staff strike).
  const orb = mesh(new THREE.SphereGeometry(.11, 14, 10),
    new THREE.MeshBasicMaterial({ color: palette.magic, transparent: true, opacity: .85, depthWrite: false }), body, 0, 1.05, .42);
  orb.castShadow = false; orb.receiveShadow = false; orb.visible = false;

  // Gold selection ring.
  const ring = mesh(new THREE.RingGeometry(.36, .4, 48),
    new THREE.MeshBasicMaterial({ color: palette.ring, transparent: true, opacity: .7, side: THREE.DoubleSide }), group, 0, .04, 0);
  ring.rotation.x = -Math.PI / 2; ring.castShadow = false;

  const actions = createActionPlayer(def.weapon);
  const pose = locomotionPose(0, false);
  let clock = 0;

  function applyPose(p) {
    body.position.y = p.bodyY;
    body.rotation.x = p.lean;
    body.rotation.y = p.twist;
    legs.right.rotation.x = p.legRX; legs.left.rotation.x = p.legLX;
    arms.right.rotation.x = p.armRX; arms.left.rotation.x = p.armLX;
    arms.right.rotation.z = -p.armRZ; arms.left.rotation.z = p.armLZ; // positive = outward on both sides
    setDrawn(p.draw > .5);
    orb.visible = p.orb > .02;
    if (orb.visible) orb.scale.setScalar(p.orb * (1 + Math.sin(clock * 18) * .08));
  }

  return {
    group,
    classId,
    className: def.name,
    weaponType: def.weapon,
    stats: getClassStats(classId),
    ring,
    /** Advance animation; `time` is total elapsed seconds, `moving` selects walk vs idle. */
    update(time, moving) {
      clock = time;
      locomotionPose(time, moving, pose);
      actions.apply(time, pose);
      applyPose(pose);
    },
    /** One-shot pose: 'attack', 'cast', 'hit', 'death', 'revive'. Unknown names are ignored. Returns true if started. */
    playAction(name) { return actions.play(name); },
    /** Name of the running action, or null. */
    get currentAction() { return actions.current; },
  };
}
