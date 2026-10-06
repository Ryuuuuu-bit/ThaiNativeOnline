// Builds the Muay Thai skill animations from the fighter's existing Tripo clips.
import { load, sample, clone, blend, worldPos, rotWorld, writeAnim, THREE } from './lib.mjs';
const R = await load(process.argv[2] ?? 'fighter-tripo.glb');
const find = re => Object.values(R.anims).find(a => re.test(a.getName()));
const JAB = find(/quick lead-hand jab/), COMBO = find(/jab-cross/), TEEP = find(/teep/), KICK = find(/front_kick/), WALK = find(/^walk/), RUN = find(/^run/);
const B = n => 'mixamorig:' + n;
const sampleAnim = (a, t) => sample(R, a, t);
const HIPS = R.byName[B('Hips')];
const FPS = 30, TAU = Math.PI * 2;

// --- poses -----------------------------------------------------------------
const G = sample(R, TEEP, 0);                       // orthodox guard
const hip0 = G.get(HIPS).t.clone();
const pin = p => { const h = p.get(HIPS).t; h.x = hip0.x; h.z = hip0.z; return p; };
const at = (anim, t) => pin(sample(R, anim, t));
const P = {
  G, Gs: at(JAB, 2.7), J: at(JAB, 2.13), C: at(COMBO, 1.25), C2: at(COMBO, 1.5),
  TK: at(TEEP, 1.25), TX: at(TEEP, 1.5), FK0: at(KICK, 0.5), FK: at(KICK, 0.83), FK1: at(KICK, 1.05),
};
// Point bone->child along a world direction (blend w).
function aim(p, bone, child, dir, w = 1) {
  const a = worldPos(R, p, B(bone)), b = worldPos(R, p, B(child));
  const cur = b.sub(a).normalize(), want = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const axis = new THREE.Vector3(q.x, q.y, q.z); const s = axis.length(); if (s < 1e-6) return p;
  rotWorld(R, p, B(bone), axis.divideScalar(s).toArray(), 2 * Math.atan2(s, q.w) * w); return p;
}
const arm = (p, side, upper, fore) => { const S = side === 'L' ? 'Left' : 'Right'; aim(p, S + 'Arm', S + 'ForeArm', upper); aim(p, S + 'ForeArm', S + 'Hand', fore); return p; };
const leg = (p, side, upper, lower, w = 1) => { const S = side === "L" ? "Left" : "Right"; aim(p, S + "UpLeg", S + "Leg", upper, w); aim(p, S + "Leg", S + "Foot", lower, w); return p; };
const bend = (p, ax, bone = 'Spine1') => { rotWorld(R, p, B(bone), [1, 0, 0], ax); return p; };
const yaw = (p, a, bone = 'Spine1') => { rotWorld(R, p, B(bone), [0, 1, 0], a); return p; };
const lift = (p, h) => { p.get(HIPS).t.y += h; return p; };
const mk = (base, fn) => fn(clone(base));

// The source "front kick" clip is really a spinning kick; turn its key poses so
// the high kick lands forward (+Z) for the neck kick and the flurry.
const turned = (pose, a) => { const p = clone(pose); rotWorld(R, p, B('Hips'), [0, 1, 0], a); return p; };
const KTURN = -1.47;
P.RK0 = turned(P.FK0, KTURN); P.RK = turned(P.FK, KTURN); P.RK1 = turned(P.FK1, KTURN);
// custom poses (left = +X, forward = +Z)
P.elbowL = mk(P.G, p => { yaw(p, -0.9); yaw(p, -0.3, 'Spine'); arm(p, 'L', [-0.35, 0.45, 1], [-1, 0.25, -0.5]); return p; });      // lead horizontal elbow
P.elbowR = mk(P.G, p => { yaw(p, 0.95); yaw(p, 0.3, 'Spine'); arm(p, 'R', [0.35, 0.45, 1], [1, 0.25, -0.5]); return p; });         // rear elbow back across
P.armsUp = mk(P.G, p => { arm(p, 'L', [0.25, 1, 0.3], [0.1, 1, 0.15]); arm(p, 'R', [-0.25, 1, 0.3], [-0.1, 1, 0.15]); return p; });
P.drumHit = mk(P.G, p => { bend(p, 0.35); lift(p, -0.04); arm(p, 'L', [0.2, -0.2, 1], [0.05, -1, 0.5]); arm(p, 'R', [-0.2, -0.2, 1], [-0.05, -1, 0.5]); return p; });
P.wai = mk(P.G, p => { arm(p, 'L', [0.25, -0.8, 0.45], [-0.6, 0.75, 0.3]); arm(p, 'R', [-0.25, -0.8, 0.45], [0.6, 0.75, 0.3]); return p; });
P.bow = mk(P.wai, p => { lift(p, -0.16); bend(p, 0.75); bend(p, 0.25, 'Spine'); leg(p, 'L', [0.15, -0.1, 1], [0.1, -1, -0.1]); leg(p, 'R', [-0.15, -1, -0.25], [-0.05, 0.05, -1]); return p; });
P.wings = mk(P.G, p => { arm(p, 'L', [1, 0.15, 0.25], [1, 0.45, 0.2]); arm(p, 'R', [-1, 0.15, 0.25], [-1, 0.45, 0.2]); bend(p, -0.12); return p; });
P.flex = mk(P.G, p => { bend(p, -0.15); arm(p, 'L', [1, -0.35, 0.1], [0.3, -1, 0.3]); arm(p, 'R', [-1, -0.35, 0.1], [-0.3, -1, 0.3]); lift(p, -0.03); return p; });
P.crouch = mk(P.G, p => { lift(p, -0.09); bend(p, 0.3); return p; });
P.elbowUp = mk(P.G, p => { bend(p, -0.2); arm(p, 'R', [-0.1, 1, 0.1], [0.15, -0.1, 1]); arm(p, 'L', [0.2, 0.6, 0.6], [0, 1, 0.4]); return p; });
P.elbowDown = mk(P.G, p => { bend(p, 0.8); lift(p, -0.11); arm(p, 'R', [-0.05, -0.5, 1], [0.1, 0.9, -0.3]); arm(p, 'L', [0.3, -0.4, 0.6], [-0.2, 0.6, 0.6]); return p; });
P.kneeUp = mk(P.TK, p => { leg(p, 'R', [-0.05, 0.45, 1], [0, -1, 0.15]); arm(p, 'L', [0.1, 0.4, 1], [-0.2, 0.3, 1]); arm(p, 'R', [-0.1, 0.4, 1], [0.2, 0.3, 1]); bend(p, -0.1); return p; });
P.hurt = mk(P.G, p => { bend(p, -0.4); bend(p, -0.35, 'Neck'); lift(p, -0.02); return p; });
P.down = mk(P.G, p => { arm(p, 'L', [1, 0.2, 0.3], [1, 0, 0.4]); arm(p, 'R', [-1, 0.2, 0.3], [-1, 0, 0.4]); return p; });

// --- composer ----------------------------------------------------------------
const ease = u => u * u * (3 - 2 * u);
const easeIn = u => u * u * u;                 // accelerate into a hit
const easeOut = u => 1 - Math.pow(1 - u, 2.4); // decelerate into a wind-up
// keys: [t, pose]; fx(t, pose) applies time-based overlays (spin, jump).
function build(name, dur, keys, fx) {
  const frames = [];
  for (let i = 0; i <= Math.round(dur * FPS); i++) {
    const t = i / FPS; let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= t) k++;
    const [t0, a] = keys[k], [t1, b, e = ease] = keys[Math.min(k + 1, keys.length - 1)];
    const u = t1 > t0 ? e(Math.min(1, (t - t0) / (t1 - t0))) : 0;
    const p = blend(a, b, u); fx?.(t, p); frames.push(p);
  }
  return writeAnim(R, name, frames, FPS);
}
const spinY = (p, a) => rotWorld(R, p, B('Hips'), [0, 1, 0], a);
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);               // triangle 0..1
const arcLift = (t, t0, t1, h) => (t > t0 && t < t1 ? Math.sin(Math.PI * (t - t0) / (t1 - t0)) * h : 0);

// Loops
build('idle', 2, [[0, P.G], [1, P.G], [2, P.G]], (t, p) => {
  lift(p, -0.012 * (1 - Math.cos(TAU * t * 2)) / 2);               // bounce twice per loop
  rotWorld(R, p, B('Hips'), [0, 0, 1], Math.sin(TAU * t / 2) * 0.04);
  yaw(p, Math.sin(TAU * t / 2) * 0.06);
});
// Skills
build('boxer_jab', 0.9, [[0, P.G], [0.1, P.Gs], [0.18, P.J], [0.25, P.Gs], [0.31, P.J], [0.38, P.Gs], [0.44, P.J], [0.6, P.Gs], [0.9, P.G]]);
build('boxer_kick', 1.1, [[0, P.G], [0.25, P.RK0], [0.45, P.RK], [0.62, P.RK], [0.8, P.RK1], [1.1, P.G]], (t, p) => {
  bend(p, -0.2 * bump(t, 0.5, 0.3));
});
build('boxer_croc', 1.4, [[0, P.G], [0.25, P.FK0], [0.55, P.FK], [0.7, P.FK0], [0.85, P.FK], [1.05, P.FK1], [1.4, P.G]], (t, p) => {
  const u = Math.min(1, Math.max(0, (t - 0.15) / 0.95)); spinY(p, -TAU * 2 * ease(u));
});
build('boxer_waikru', 3.2, [[0, P.G], [0.35, P.wai], [0.8, P.bow], [1.35, P.bow], [1.8, P.wai], [2.3, P.wings], [2.7, P.wings], [3.2, P.G]], (t, p) => {
  if (t > 2.1 && t < 2.9) lift(p, -0.02 * Math.abs(Math.sin(TAU * (t - 2.1) * 1.25)));
});
build('boxer_ngouy', 1.6, [[0, P.G], [0.25, P.crouch], [0.6, P.elbowUp], [0.95, P.elbowDown], [1.2, P.elbowDown], [1.6, P.G]], (t, p) => {
  lift(p, arcLift(t, 0.3, 0.95, 0.32));
});
// War drum in front: alternate left / right beats, then both fists together.
// Stroke follows a real drummer's whip ("lead with the elbow"): raise with the
// elbow high and the fist cocked behind the head -> the elbow drops forward
// first while the forearm stays folded -> the forearm whips down and the arm
// opens on impact -> it rebounds up with the elbow folding again.
// Arms follow direction paths (slerped every frame) so the fists never swing out sideways.
{
  const sk = side => (side === 'L' ? 1 : -1);
  const U = { // [upper arm dir, forearm dir]; x mirrored per side
    ready: [[.35, -.6, .6], [-.2, .45, .85]],      // relaxed, elbow bent ~90
    raise: [[.25, .9, .25], [-.05, .3, -.95]],     // elbow high, fist behind the head (~110 bend)
    lead: [[.2, .12, 1], [0, .95, -.25]],          // elbow drops forward, forearm still up: tight fold
    whip: [[.17, -.2, 1], [0, .25, 1]],            // forearm swinging through the front
    strike: [[.15, -.45, 1], [-.03, -.7, .75]],    // arm opened (~160) onto the drum head
    rebound: [[.2, -.25, 1], [0, .75, .65]],       // bounce: elbow folds again (~115)
    hips: [[.65, -.75, -.1], [-.55, -.25, .45]],
  };
  const dirOf = (pose, side, i) => { const d = U[pose][i]; return new THREE.Vector3(d[0] * sk(side), d[1], d[2]).normalize(); };
  const slerpDir = (a, b, u) => { const q = new THREE.Quaternion().setFromUnitVectors(a, b); return a.clone().applyQuaternion(new THREE.Quaternion().slerp(q, u)); };
  function track(keys) {
    return t => {
      let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= t) k++;
      const [t0, a] = keys[k], [t1, b, e = ease] = keys[Math.min(k + 1, keys.length - 1)];
      return { a, b, u: t1 > t0 ? e(Math.min(1, (t - t0) / (t1 - t0))) : 0 };
    };
  }
  const applyArm = (p, side, tr) => {
    const S = side === 'L' ? 'Left' : 'Right';
    const gdir = (bone, child) => worldPos(R, P.G, B(child)).sub(worldPos(R, P.G, B(bone))).normalize();
    const pick = (name, i) => name === 'guard' ? (i ? gdir(S + 'ForeArm', S + 'Hand') : gdir(S + 'Arm', S + 'ForeArm')) : dirOf(name, side, i);
    arm(p, side, slerpDir(pick(tr.a, 0), pick(tr.b, 0), tr.u).toArray(), slerpDir(pick(tr.a, 1), pick(tr.b, 1), tr.u).toArray());
  };
  // one stroke landing at time h: raise -> lead -> whip -> strike -> rebound
  const stroke = (h, from) => [[h - .2, 'raise', easeOut], [h - .09, 'lead', ease], [h - .035, 'whip', easeIn], [h, 'strike', easeIn], [h + .1, 'rebound', easeOut]];
  const L = track([[0, 'guard'], ...stroke(.4), [.55, 'ready', ease], [.92, 'ready'], ...stroke(1.3), [1.5, 'ready', ease], [1.85, 'hips', ease], [2.25, 'hips'], [2.6, 'guard', ease]]);
  const Rt = track([[0, 'guard'], [.2, 'ready', easeOut], [.45, 'ready'], ...stroke(.85), [1.0, 'ready', ease], [1.1, 'raise', easeOut], ...stroke(1.3).slice(1), [1.5, 'ready', ease], [1.85, 'hips', ease], [2.25, 'hips'], [2.6, 'guard', ease]]);
  // body: open up and rise on the wind-up (inhale), twist toward the striking arm, drop the hips on impact (exhale)
  const body = (yawA, bendA, neck, h) => mk(P.G, p => { yaw(p, yawA); bend(p, bendA); bend(p, neck, 'Neck'); lift(p, h); return p; });
  const Bd = { upL: body(.25, -.12, -.05, .012), hitL: body(-.15, .32, .12, -.05), upR: body(-.25, -.12, -.05, .012), hitR: body(.15, .32, .12, -.05),
    upB: body(0, -.2, -.15, .02), hitB: body(0, .45, .15, -.075), proud: body(0, -.18, -.12, 0) };
  build('boxer_drum', 2.6, [
    [0, P.G], [0.2, Bd.upL, easeOut], [0.4, Bd.hitL, easeIn], [0.52, blend(Bd.hitL, Bd.upL, .4), easeOut],
    [0.65, Bd.upR, ease], [0.85, Bd.hitR, easeIn], [0.97, blend(Bd.hitR, Bd.upR, .4), easeOut],
    [1.1, Bd.upB, ease], [1.3, Bd.hitB, easeIn], [1.45, blend(Bd.hitB, Bd.upB, .35), easeOut],
    [1.85, Bd.proud, ease], [2.25, Bd.proud], [2.6, P.G, ease],
  ], (t, p) => {
    applyArm(p, 'L', L(t)); applyArm(p, 'R', Rt(t));
    for (const h of [0.4, 0.85, 1.3]) if (t > h && t < h + .25) lift(p, -.012 * Math.sin(Math.PI * (t - h) / .25));
    if (t > 1.85 && t < 2.25) lift(p, .006 * Math.sin(Math.PI * (t - 1.85) / .4));
  });
  // report elbow bend through one stroke (180 = straight)
  const A = R.root.listAnimations().find(a => a.getName() === 'boxer_drum');
  const ang = (pp, S) => { const s = worldPos(R, pp, B(S + 'Arm')), e = worldPos(R, pp, B(S + 'ForeArm')), w = worldPos(R, pp, B(S + 'Hand')); return Math.round(THREE.MathUtils.radToDeg(s.sub(e).angleTo(w.sub(e)))); };
  console.log('L elbow angle 0.2..0.55:', [.2, .26, .31, .365, .4, .45, .5, .55].map(t => ang(sampleAnim(A, t), 'Left')).join(' '));
}
build('boxer_elbow', 0.9, [[0, P.G], [0.2, P.elbowL], [0.36, P.elbowR], [0.55, P.elbowR], [0.9, P.G]]);
build('boxer_knee', 1.2, [[0, P.G], [0.2, P.crouch], [0.45, P.TK], [0.6, P.kneeUp], [0.8, P.kneeUp], [0.95, P.crouch], [1.2, P.G]], (t, p) => {
  lift(p, arcLift(t, 0.3, 0.95, 0.22));
});
build('boxer_iron', 2.4, [[0, P.G], [0.35, P.wai], [0.9, P.wai], [1.3, P.wings], [1.6, P.flex], [2.0, P.flex], [2.4, P.G]], (t, p) => {
  if (t > 1.5 && t < 1.75) lift(p, -0.03 * Math.sin(Math.PI * (t - 1.5) / 0.25));
});
build('boxer_hanuman', 1.6, [[0, P.G], [0.1, P.J], [0.21, P.RK], [0.32, P.kneeUp], [0.43, P.elbowL], [0.54, P.C], [0.65, P.RK], [0.76, P.elbowR], [0.87, P.kneeUp], [1.05, P.wai], [1.3, P.wai], [1.6, P.G]], (t, p) => {
  lift(p, arcLift(t, 0.27, 0.4, 0.1) + arcLift(t, 0.82, 0.95, 0.1));
});
build('hurt', 0.5, [[0, P.G], [0.1, P.hurt], [0.22, P.hurt], [0.5, P.G]]);
build('die', 1.6, [[0, P.G], [0.25, P.hurt], [0.6, P.down], [1.6, P.down]], (t, p) => {
  const u = ease(Math.min(1, Math.max(0, (t - 0.25) / 0.85)));
  rotWorld(R, p, B('Hips'), [1, 0, 0], -1.5 * u);
  // Keep the lowest body part on the floor as the body tips over.
  const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
  const low = Math.min(...parts.map(n => worldPos(R, p, B(n)).y));
  lift(p, (0.06 - low) * u);
});

// Rename locomotion, drop the long prompt-named clips (now covered by boxer_*).
WALK.setName('walk'); RUN.setName('run');
for (const a of [JAB, COMBO, TEEP, KICK]) a.dispose();
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'muay-thai-fighter.glb', R.doc);
