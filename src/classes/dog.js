import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// น้องหมาของนายพราน: a Thai Ridgeback-style hunting dog (fawn coat, the darker ridge
// down the back, upright ears, sickle tail, red collar with a brass bell).
// The body is the Tripo model public/models/hunter-dog.glb (rigged, no clips: every pose is
// driven here from code, so gait, bite and glow blend freely); until it has loaded, or if
// it can't, a primitive stand-in with the same animate() API takes its place.
// Units: metres-ish, origin on the ground between the paws, facing +Z, shoulder ≈ .6.
//
// dog.userData.animate(t, moving, attacking, o)
//   t        time in seconds (any monotonic clock)
//   moving   walking/trotting
//   attacking  snapping at a target (jaw works on its own clock)
//   o.run    0..1 blend from trot to a full gallop
//   o.bite   0..1 phase of one scripted bite (lunge, jaw open, snap shut) — overrides `attacking`
//   o.glow   0..1 spirit glow (emissive jade) for summoned dogs
//   o.howl   0..1 head thrown back to the sky, jaw open (a howl / war bark)
//
// followerDog() is the dog that heels behind the hunter in the world (the first
// makeDog() without `transient` still in a scene); the skill kit borrows it.

const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra });
const mesh = (parent, geo, m, x = 0, y = 0, z = 0, s) => {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (s) o.scale.set(...s);
  o.castShadow = true; parent.add(o); return o;
};

function primitiveDog({ coat = '#b8733c', glowColor = '#5dffa8' } = {}) {
  const fur = mat(coat), dark = mat(new THREE.Color(coat).multiplyScalar(.52)), cream = mat('#e8cfa2');
  const black = mat('#1b120c', { roughness: .4 }), pink = mat('#d9606a'), red = mat('#b3221c'), brass = mat('#e0b040', { metalness: .7, roughness: .3 });
  const furs = [fur, dark, cream];
  const g = new THREE.Group(); g.name = 'hunter-dog';
  const torso = new THREE.Group(); torso.position.y = .5; g.add(torso);

  // body: deep chest, tucked waist, hips
  mesh(torso, new THREE.SphereGeometry(.17, 16, 12), fur, 0, .02, .2, [1, 1.12, 1.15]);
  mesh(torso, new THREE.SphereGeometry(.12, 12, 10), cream, 0, -.06, .27, [.9, 1, .8]);
  mesh(torso, new THREE.CapsuleGeometry(.13, .24, 6, 14).rotateX(Math.PI / 2), fur, 0, .03, -.02, [1, .95, 1]);
  mesh(torso, new THREE.SphereGeometry(.14, 14, 10), fur, 0, .04, -.24, [1, 1, 1.05]);
  // the ridge: a darker stripe of hair running against the grain along the spine
  mesh(torso, new THREE.CapsuleGeometry(.03, .3, 4, 8).rotateX(Math.PI / 2), dark, 0, .148, -.02, [1.4, .6, 1]);

  // neck + collar
  const neck = mesh(torso, new THREE.CylinderGeometry(.075, .11, .24, 12), fur, 0, .17, .33); neck.rotation.x = .75;
  const collar = mesh(torso, new THREE.TorusGeometry(.098, .02, 6, 18), red, 0, .14, .31); collar.rotation.x = .75 - Math.PI / 2;
  mesh(torso, new THREE.SphereGeometry(.028, 8, 6), brass, 0, .06, .38);

  // head (pivot at the top of the neck)
  const head = new THREE.Group(); head.position.set(0, .29, .43); torso.add(head);
  mesh(head, new THREE.SphereGeometry(.105, 14, 12), fur, 0, 0, 0, [1, .92, 1.05]);
  mesh(head, new THREE.CapsuleGeometry(.05, .1, 4, 10).rotateX(Math.PI / 2), fur, 0, -.03, .12, [1, .85, 1]);
  mesh(head, new THREE.CapsuleGeometry(.04, .08, 4, 8).rotateX(Math.PI / 2), dark, 0, -.005, .14, [1, .5, 1]);
  mesh(head, new THREE.SphereGeometry(.026, 8, 6), black, 0, -.012, .215);
  const eyeM = mat('#1a1008', { emissive: new THREE.Color(glowColor), emissiveIntensity: 0, roughness: .2 });
  for (const s of [-1, 1]) {
    mesh(head, new THREE.SphereGeometry(.017, 8, 6), eyeM, s * .048, .028, .085);
    const ear = mesh(head, new THREE.ConeGeometry(.045, .13, 4), dark, s * .058, .1, -.015, [1, 1, .45]);
    ear.rotation.set(-.15, 0, -s * .28);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -.06, .05); head.add(jaw);
  mesh(jaw, new THREE.CapsuleGeometry(.036, .1, 4, 8).rotateX(Math.PI / 2), fur, 0, -.01, .08, [1, .55, 1]);
  mesh(jaw, new THREE.BoxGeometry(.045, .01, .09), pink, 0, .008, .09);

  // legs: hip pivot → upper → knee pivot → lower → paw
  const legs = [];
  for (const [x, z, front] of [[-.085, .23, 1], [.085, .23, 1], [-.085, -.25, 0], [.085, -.25, 0]]) {
    const hip = new THREE.Group(); hip.position.set(x, front ? -.04 : -.02, z); torso.add(hip);
    mesh(hip, new THREE.CylinderGeometry(front ? .045 : .06, .035, .23, 8), fur, 0, -.11, 0);
    const knee = new THREE.Group(); knee.position.y = -.22; hip.add(knee);
    mesh(knee, new THREE.CylinderGeometry(.032, .026, .23, 8), front ? fur : dark, 0, -.11, 0);
    mesh(knee, new THREE.SphereGeometry(.035, 8, 6), cream, 0, -.23, .018, [1, .7, 1.3]);
    const base = front ? [.12, -.14] : [-.42, .62];
    legs.push({ hip, knee, front, side: x < 0 ? 0 : 1, base });
  }

  // sickle tail curling up over the back
  const tail = new THREE.Group(); tail.position.set(0, .1, -.34); torso.add(tail);
  let seg = tail; const tailSegs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group(); if (i) s.position.y = .085; seg.add(s);
    mesh(s, new THREE.CylinderGeometry(.022 - i * .003, .026 - i * .003, .09, 6), i === 3 ? dark : fur, 0, .042, 0);
    tailSegs.push(s); seg = s;
  }

  // summoned-spirit glow
  const setGlow = k => {
    for (const m of furs) { m.emissive.set(glowColor); m.emissiveIntensity = k * .55; }
    eyeM.emissiveIntensity = k * 3;
  };
  setGlow(0);

  let blink = 0;
  g.userData.animate = (t, moving = false, attacking = false, o = {}) => {
    const run = o.run ?? 0, glow = o.glow ?? 0;
    setGlow(glow);
    // gait: trot (diagonal pairs) blended into a rotary gallop (front pair, then hind pair)
    const f = moving ? 7.5 + run * 4.5 : 0, ph = t * f;
    for (const L of legs) {
      const trot = (L.front ? L.side : 1 - L.side) * Math.PI;
      const gal = L.front ? L.side * .45 : Math.PI + L.side * .45;
      const p = ph + trot * (1 - run) + gal * run, amp = moving ? .42 + run * .38 : 0;
      const swing = Math.sin(p) * amp, lift = moving ? Math.max(0, Math.cos(p)) * (.55 + run * .4) : 0;
      L.hip.rotation.x = L.base[0] - swing;
      L.knee.rotation.x = L.base[1] + (L.front ? -lift : lift);
    }
    torso.position.y = .5 + (moving ? Math.abs(Math.sin(ph)) * (.018 + run * .04) : Math.sin(t * 2.2) * .004);
    torso.rotation.x = moving ? Math.sin(ph) * run * .09 - run * .05 : 0;
    // head: bob while moving, looks around idle; bite = lunge forward + down, jaw open, snap
    let jawOpen, headPitch, headFwd = 0;
    if (o.bite != null) {
      const b = o.bite, open = b < .55 ? Math.sin(b / .55 * Math.PI / 2) : Math.max(0, 1 - (b - .55) / .12);
      jawOpen = open * .75; headPitch = .25 * Math.sin(Math.min(1, b / .7) * Math.PI); headFwd = Math.sin(Math.min(1, b / .8) * Math.PI) * .09;
    } else if (o.howl) {
      jawOpen = .65 * o.howl; headPitch = -.85 * o.howl;
    } else if (attacking) {
      const s = Math.sin(t * 16); jawOpen = Math.max(0, s) * .6; headPitch = .2 + s * .08; headFwd = .04;
    } else {
      jawOpen = moving ? .12 + run * .2 : .06 + Math.max(0, Math.sin(t * 3.1)) * .08; // panting
      headPitch = moving ? Math.sin(ph * 2) * .05 + run * .18 : Math.sin(t * .7) * .06;
    }
    jaw.rotation.x = jawOpen;
    head.rotation.x = headPitch; head.position.z = .43 + headFwd; head.position.y = .29 - headFwd * .4;
    head.rotation.y = moving || attacking || o.bite != null ? 0 : Math.sin(t * .45) * .35;
    // tail: wag, faster when excited
    const wag = Math.sin(t * (moving || attacking ? 14 : 6)) * (moving ? .35 : .5);
    tail.rotation.set(-.45 - run * .35, 0, 0); tail.rotation.z = wag;
    tailSegs.forEach((s, i) => { if (i) s.rotation.x = -.26 - run * .06; });
    // blink every few seconds
    blink = (t % 3.7) < .1 ? .2 : 1; head.children.filter(c => c.material === eyeM).forEach(e => e.scale.y = blink);
  };
  g.userData.animate(0);
  return g;
}

// ---- the Tripo dog ------------------------------------------------------------------------
const URL = (import.meta.env?.BASE_URL ?? '/') + 'models/hunter-dog.glb';
const SCALE = 1.25;   // model shoulder ≈ .45 → ≈ .56, same as the stand-in
let source = null;
const loadSource = () => (source ??= new GLTFLoader().loadAsync(URL).then(gltf => {
  gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.userData.shared = true; o.castShadow = true; o.frustumCulled = false; } });
  return gltf.scene;
}).catch(e => { console.warn('hunter-dog.glb:', e?.message ?? e); return null; }));

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
function riggedDog(src, glowColor) {
  const inner = new THREE.Group(), body = cloneSkinned(src); inner.add(body); inner.scale.setScalar(SCALE);
  const mats = [];
  body.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(glowColor); o.material.emissiveIntensity = 0; mats.push(o.material); } });
  inner.updateMatrixWorld(true);
  const bones = {}; body.traverse(o => { if (o.isBone) bones[o.name] = o; });
  // a joint rotates about axes given in the dog's own frame (X = side, Y = up), on top of its rest pose
  const joint = n => { const b = bones[n] ?? bones[n.replace(/:/g, '')]; if (!b) return null; const pq = new THREE.Quaternion(); b.parent.getWorldQuaternion(pq); return { b, rest: b.quaternion.clone(), pInv: pq.invert() }; };
  const q = new THREE.Quaternion(), ax = new THREE.Vector3();
  const rot = (j, ...turns) => { if (!j) return; j.b.quaternion.copy(j.rest); for (const [axis, a] of turns) { ax.copy(axis).applyQuaternion(j.pInv); q.setFromAxisAngle(ax, a); j.b.quaternion.premultiply(q); } };
  const leg = (end, side, front) => ({ front, side, j: [0, 1, 2].map(i => joint(`tripo::${end}_${side ? 'Right' : 'Left'}_Limb_${i}`)) });
  const legs = [leg(0, 0, 1), leg(0, 1, 1), leg(1, 0, 0), leg(1, 1, 0)];
  const J = n => joint('tripo::' + n);
  const hips = J('Spine_0'), mid = J('Spine_4'), neck = J('Spine_6'), neck2 = J('Spine_7'), head = J('Head_0'), tail = joint('bone_2'), tail1 = J('Tail_0'), ears = [joint('bone_14'), joint('bone_15')];
  const animate = (t, moving, attacking, o) => {
    const run = o.run ?? 0, glow = o.glow ?? 0;
    for (const m of mats) m.emissiveIntensity = glow * .6;
    const f = moving ? 7.5 + run * 4.5 : 0, ph = t * f;
    for (const L of legs) {
      const trot = (L.front ? L.side : 1 - L.side) * Math.PI, gal = L.front ? L.side * .45 : Math.PI + L.side * .45;
      const p = ph + trot * (1 - run) + gal * run, amp = moving ? .38 + run * .32 : 0;
      const swing = Math.sin(p) * amp, lift = moving ? Math.max(0, Math.cos(p)) * (.6 + run * .4) : 0;
      rot(L.j[0], [X, -swing]);
      if (L.front) { rot(L.j[1], [X, lift * .5]); rot(L.j[2], [X, lift * .9]); }
      else { rot(L.j[1], [X, lift * .6]); rot(L.j[2], [X, -lift * .9]); }
    }
    inner.position.y = moving ? Math.abs(Math.sin(ph)) * (.015 + run * .035) : Math.sin(t * 2.2) * .003;
    rot(hips, [X, moving ? Math.sin(ph) * run * .1 : 0]); rot(mid, [X, moving ? -Math.sin(ph) * run * .06 : Math.sin(t * 2.2) * .01]);
    let pitch, fwd = 0, yaw = 0;
    if (o.bite != null) { const b = o.bite; pitch = .75 * Math.sin(Math.min(1, b / .7) * Math.PI); fwd = Math.sin(Math.min(1, b / .8) * Math.PI) * .1; }
    else if (o.howl) { pitch = -1.5 * o.howl; }
    else if (attacking) { const s = Math.sin(t * 16); pitch = .3 + s * .12; fwd = .05; }
    else { pitch = moving ? Math.sin(ph * 2) * .05 + run * .2 : Math.sin(t * .7) * .05; yaw = moving ? 0 : Math.sin(t * .45) * .4; }
    inner.position.z = fwd;
    rot(neck, [X, pitch * .45]); rot(neck2, [Y, yaw], [X, pitch * .3]); rot(head, [X, pitch * .35]);
    const wag = Math.sin(t * (moving || attacking ? 14 : 6)) * (moving ? .35 : .5);
    rot(tail, [Y, wag], [X, .35 + run * .25]); rot(tail1, [X, .15]);
    ears.forEach((e, i) => rot(e, [X, (t % 4.3) < .12 ? .25 : 0], [Y, (i ? 1 : -1) * run * .25]));
  };
  return { inner, animate };
}

export function makeDog(opts = {}) {
  const glowColor = opts.glowColor ?? '#5dffa8';
  const g = new THREE.Group(); g.name = 'hunter-dog';
  const stand = primitiveDog(opts); g.add(stand);
  let rig = null;
  g.userData.animate = (t, moving = false, attacking = false, o = {}) => (rig ? rig.animate(t, moving, attacking, o) : stand.userData.animate(t, moving, attacking, o));
  if (!opts.transient) FOLLOWERS.add(g);
  loadSource().then(src => { if (!src) return; rig = riggedDog(src, glowColor); g.remove(stand); stand.traverse(n => { n.geometry?.dispose(); n.material?.dispose?.(); }); g.add(rig.inner); g.userData.animate(0); });
  return g;
}
export const preloadDog = loadSource;

// The world's heeling dog (src/combat/CombatView.js), or null when none is in a scene.
const FOLLOWERS = new Set();
// True while a skill has borrowed the heeling dog (its own combat bites wait, src/combat/Combat.js).
export const followerAway = () => [...FOLLOWERS].some(d => d.parent && d.userData.away);
export function followerDog() {
  let found = null;
  for (const d of FOLLOWERS) { if (!d.parent) { if (d.userData.seen) FOLLOWERS.delete(d); continue; } d.userData.seen = true; found = d; }
  return found;
}
