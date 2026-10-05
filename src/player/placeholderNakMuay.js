import * as THREE from 'three';

// Procedural stand-in for the Muay Thai class (docs/art/references/nak-muay-class-sheet.webp).
// It reads the reference's colour blocks — red/white mongkhon and sash, white hand
// wraps, red prajiad armbands, black shorts with gold trim, black shin guards — on
// a jointed rig whose clips use the same state names a Blender .glb must provide.
// Units are metres; the hero stands about 1.8 m tall, facing +Z.

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = color => new THREE.MeshToonMaterial({ color, gradientMap: gradient });
const M = {
  skin: toon('#d9976a'), hair: toon('#4a2f22'), black: toon('#24201f'), gold: toon('#d8a64a'),
  red: toon('#c22b34'), white: toon('#f4efe6'), eye: new THREE.MeshBasicMaterial({ color: '#2a1810' }),
};
const outline = new THREE.MeshBasicMaterial({ color: '#2b1a14', side: THREE.BackSide });

// A mesh plus an inverted-hull outline so the silhouette survives the far camera.
function part(parent, geometry, material, [x, y, z] = [0, 0, 0], scale, rim = 1.08) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true; parent.add(mesh);
  if (rim) { const o = new THREE.Mesh(geometry, outline); o.scale.setScalar(rim); mesh.add(o); }
  return mesh;
}
function joint(parent, name, x, y, z) { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; }
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const cyl = (top, bottom, h, seg = 12) => new THREE.CylinderGeometry(top, bottom, h, seg);
const ring = (r, tube) => { const g = new THREE.TorusGeometry(r, tube, 6, 20); g.rotateX(Math.PI / 2); return g; };

export const HIP_HEIGHT = .95;

export function buildNakMuay() {
  const root = new THREE.Group(); root.name = 'nak-muay-placeholder';
  const hips = joint(root, 'hips', 0, HIP_HEIGHT, 0);
  // Shorts, waist sash with hanging front panel and gold tassels.
  part(hips, cyl(.17, .2, .24), M.black, [0, -.04, 0], [1, 1, .8]);
  part(hips, cyl(.202, .202, .03), M.gold, [0, -.15, 0], [1, 1, .8], 0);
  part(hips, ring(.165, .035), M.red, [0, .08, 0], [1, 1, .82]);
  part(hips, ring(.168, .018), M.white, [0, .045, 0], [1, 1, .82], 0);
  part(hips, new THREE.BoxGeometry(.13, .24, .02), M.white, [.03, -.06, .165]);
  part(hips, new THREE.BoxGeometry(.06, .2, .021), M.red, [.03, -.07, .168], undefined, 0);
  for (const dx of [-.07, .12]) part(hips, new THREE.ConeGeometry(.025, .11, 8), M.gold, [dx, -.1, .15]);

  const spine = joint(hips, 'spine', 0, .1, 0);
  const chest = joint(spine, 'chest', 0, .18, 0);
  part(chest, capsule(.15, .2), M.skin, [0, .04, 0], [1.2, 1, .78]);
  part(chest, new THREE.SphereGeometry(.07, 10, 8), M.skin, [.12, .17, 0], undefined, 0);
  part(chest, new THREE.SphereGeometry(.07, 10, 8), M.skin, [-.12, .17, 0], undefined, 0);

  const neck = joint(chest, 'neck', 0, .24, 0);
  part(neck, cyl(.05, .055, .08, 10), M.skin, [0, .02, 0], undefined, 0);
  const head = joint(neck, 'head', 0, .06, 0);
  // The gameplay camera looks down steeply, so the face tilts up to stay visible.
  const face = joint(head, 'face', 0, 0, 0); face.rotation.x = -.3;
  part(face, new THREE.SphereGeometry(.13, 18, 14), M.skin, [0, .12, .01], [.95, 1.05, 1]);
  // Anime-style eyes and brows on the face.
  for (const s of [-1, 1]) {
    part(face, new THREE.SphereGeometry(.026, 10, 8), M.eye, [s * .047, .125, .122], [.8, 1.3, .5], 0);
    part(face, new THREE.BoxGeometry(.055, .012, .01), M.hair, [s * .05, .172, .123], undefined, 0).rotation.z = s * -.15;
  }
  // Spiky hair: a cap plus cones fanned over the crown.
  part(face, new THREE.SphereGeometry(.14, 16, 10, 0, Math.PI * 2, 0, Math.PI * .42), M.hair, [0, .145, -.03]);
  const spikes = [[0, .27, -.02, -.3, 0], [.08, .25, .02, -.1, -.6], [-.08, .25, .02, -.1, .6], [.04, .24, .1, .7, -.3], [-.05, .24, .1, .8, .3],
    [.12, .19, -.04, -.4, -1.1], [-.12, .19, -.04, -.4, 1.1], [0, .2, -.13, -1.2, 0], [.08, .17, -.11, -1.1, -.5], [-.08, .17, -.11, -1.1, .5]];
  for (const [x, y, z, rx, rz] of spikes) {
    const s = part(face, new THREE.ConeGeometry(.045, .14, 6), M.hair, [x, y - .01, z - .02]); s.rotation.set(rx, 0, rz);
  }
  // Mongkhon headband: braided red/white ring with tails at the back.
  part(face, ring(.138, .02), M.red, [0, .17, .005], [1, 1, 1.02]);
  part(face, ring(.14, .011), M.white, [0, .185, .005], [1, 1, 1.02], 0);
  const tails = joint(face, 'headbandTails', 0, .17, -.13);
  for (const s of [-1, 1]) {
    const t = part(tails, new THREE.BoxGeometry(.035, .16, .012), s < 0 ? M.red : M.white, [s * .03, -.07, -.01]); t.rotation.set(-.35, 0, s * .2);
  }

  for (const side of [1, -1]) {
    const L = side > 0 ? 'L' : 'R';
    // Arms: skin with red prajiad on the upper arm and white wraps from forearm to fist.
    const upper = joint(chest, `upperArm${L}`, side * .21, .17, 0);
    part(upper, capsule(.055, .18), M.skin, [0, -.14, 0]);
    part(upper, ring(.062, .018), M.red, [0, -.07, 0]);
    part(upper, new THREE.BoxGeometry(.025, .08, .01), M.white, [side * .03, -.11, -.05], undefined, 0);
    const fore = joint(upper, `foreArm${L}`, 0, -.28, 0);
    part(fore, capsule(.048, .17), M.skin, [0, -.12, 0]);
    part(fore, cyl(.056, .052, .13, 10), M.white, [0, -.18, 0]);
    part(fore, ring(.058, .012), M.red, [0, -.13, 0], undefined, 0);
    const hand = joint(fore, `hand${L}`, 0, -.27, 0);
    part(hand, new THREE.SphereGeometry(.065, 12, 10), M.white, [0, -.03, .01], [1, 1.1, 1.05]);

    // Legs: shorts sleeve with gold hem, skin thigh/knee, black shin guard, rope and ankle wraps.
    const thigh = joint(hips, `thigh${L}`, side * .1, -.08, 0);
    part(thigh, cyl(.11, .125, .2, 12), M.black, [0, -.1, 0]);
    part(thigh, cyl(.127, .127, .028, 12), M.gold, [0, -.2, 0], undefined, 0);
    part(thigh, cyl(.128, .128, .012, 12), M.red, [0, -.18, 0], undefined, 0);
    part(thigh, capsule(.072, .24), M.skin, [0, -.25, 0]);
    const shin = joint(thigh, `shin${L}`, 0, -.42, 0);
    part(shin, capsule(.06, .26), M.skin, [0, -.19, 0]);
    part(shin, cyl(.072, .062, .26, 12), M.black, [0, -.2, .005]);
    part(shin, new THREE.OctahedronGeometry(.035), M.gold, [0, -.18, .07], [1, 1.3, .4], 0);
    part(shin, ring(.074, .016), M.red, [0, -.06, 0]);
    part(shin, ring(.075, .009), M.white, [0, -.085, 0], undefined, 0);
    const foot = joint(shin, `foot${L}`, 0, -.4, 0);
    part(foot, cyl(.06, .06, .07, 10), M.white, [0, .0, 0]);
    part(foot, new THREE.BoxGeometry(.09, .055, .22), M.skin, [0, -.03, .05]);
  }
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, clips: makeClips() };
}

// ---------- Animation clips ------------------------------------------------
// Poses are Euler angles per joint. Limbs hang along -Y, so a negative X rotation swings forward.
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'headbandTails', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const GUARD = {
  chest: [.08, .22, 0], head: [-.05, -.2, 0], headbandTails: [-.2, 0, 0],
  upperArmL: [-.8, 0, -.1], foreArmL: [-2.2, 0, 0], upperArmR: [-.65, 0, .12], foreArmR: [-2.35, 0, 0],
  thighL: [-.35, 0, .05], shinL: [.45, 0, 0], footL: [-.1, 0, 0], thighR: [.12, 0, -.05], shinR: [.35, 0, 0], footR: [-.25, 0, 0],
};
const pose = (overrides = {}, base = GUARD) => ({ ...base, ...overrides });

function clip(name, duration, keys, loop = true) {
  // keys: [{ t, pose, y, z }] — y/z offset the hips for bobs and jumps.
  if (loop) keys = [...keys, { ...keys[0], t: duration }];
  const times = keys.map(k => k.t), tracks = [], q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const bone of BONES) {
    const values = [];
    for (const k of keys) { const [x, y, z] = k.pose[bone] ?? [0, 0, 0]; q.setFromEuler(e.set(x, y, z)); values.push(q.x, q.y, q.z, q.w); }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, keys.flatMap(k => [0, HIP_HEIGHT + (k.y ?? 0), k.z ?? 0])));
  return new THREE.AnimationClip(name, duration, tracks);
}

function makeClips() {
  const walkA = pose({ thighL: [-.55, 0, .04], shinL: [.25, 0, 0], thighR: [.45, 0, -.04], shinR: [.55, 0, 0], footR: [.2, 0, 0], chest: [.1, .3, 0] });
  const walkB = pose({ thighL: [.45, 0, .04], shinL: [.55, 0, 0], footL: [.2, 0, 0], thighR: [-.55, 0, -.04], shinR: [.25, 0, 0], chest: [.1, .14, 0] });
  const pass = pose({ thighL: [-.1, 0, .04], shinL: [.5, 0, 0], thighR: [-.1, 0, -.04], shinR: [.5, 0, 0] });
  const high = pose({ chest: [.25, .05, 0], head: [.2, 0, 0], upperArmL: [-1.15, 0, .2], foreArmL: [-1.95, 0, 0], upperArmR: [-1.15, 0, -.2], foreArmR: [-1.95, 0, 0],
    thighL: [-.3, 0, .08], shinL: [.6, 0, 0], thighR: [.05, 0, -.08], shinR: [.55, 0, 0] });
  const crouch = pose({ thighL: [-.6, 0, .05], shinL: [1, 0, 0], thighR: [-.2, 0, -.05], shinR: [.9, 0, 0], footR: [-.5, 0, 0], chest: [.25, .1, 0] });
  const kneeUp = pose({
    chest: [-.25, -.1, 0], head: [.15, 0, 0], headbandTails: [.6, 0, 0],
    upperArmL: [-1.75, 0, -.15], foreArmL: [-.9, 0, 0], upperArmR: [-1.75, 0, .15], foreArmR: [-.9, 0, 0],
    thighL: [.55, 0, .04], shinL: [.9, 0, 0], footL: [.6, 0, 0], thighR: [-2.05, 0, -.05], shinR: [2.3, 0, 0], footR: [.8, 0, 0],
  });
  const elbowWind = pose({ chest: [.05, .6, 0], head: [-.05, -.5, 0], upperArmR: [-1.1, 0, -.6], foreArmR: [-2.5, 0, 0], thighR: [.2, 0, -.05] });
  const elbowHit = pose({
    chest: [.15, -1, 0], spine: [0, -.25, 0], head: [-.05, .7, 0], headbandTails: [.3, .6, 0],
    upperArmR: [-1.45, 0, -1.4], foreArmR: [-2.65, 0, 0], upperArmL: [-.9, 0, .1], foreArmL: [-2.1, 0, 0],
    thighL: [-.45, 0, .05], shinL: [.5, 0, 0], thighR: [.3, 0, -.12], shinR: [.25, 0, 0], footR: [-.5, 0, 0],
  });
  return {
    idle: clip('idle', .7, [{ t: 0, pose: GUARD, y: -.05 }, { t: .35, pose: pose({ shinL: [.35, 0, 0], shinR: [.25, 0, 0] }), y: -.02 }]),
    walk: clip('walk', .8, [{ t: 0, pose: walkA, y: -.05 }, { t: .2, pose: pass, y: -.01 }, { t: .4, pose: walkB, y: -.05 }, { t: .6, pose: pass, y: -.01 }]),
    guard: clip('guard', 1.2, [{ t: 0, pose: high, y: -.08 }, { t: .6, pose: pose({ chest: [.28, .05, 0] }, high), y: -.07 }]),
    elbow: clip('elbow', .6, [
      { t: 0, pose: GUARD, y: -.05 }, { t: .14, pose: elbowWind, y: -.06 }, { t: .26, pose: elbowHit, y: -.04 },
      { t: .42, pose: elbowHit, y: -.04 }, { t: .6, pose: GUARD, y: -.05 },
    ], false),
    knee: clip('knee', .9, [
      { t: 0, pose: GUARD, y: -.05 }, { t: .14, pose: crouch, y: -.16 }, { t: .34, pose: kneeUp, y: .5 },
      { t: .56, pose: kneeUp, y: .42 }, { t: .74, pose: crouch, y: -.12 }, { t: .9, pose: GUARD, y: -.05 },
    ], false),
  };
}
