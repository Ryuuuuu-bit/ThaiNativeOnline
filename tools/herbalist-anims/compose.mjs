// Builds the herbalist's animations on its Tripo Mixamo rig (no clips of its own):
// walk/run are retargeted from the Muay Thai fighter's clips by bone direction
// (the two rigs' rest orientations differ), the casting moves are posed by hand.
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, THREE } from '../muaythai-anims/lib.mjs';
const H = await load(process.argv[2] ?? 'tools/herbalist-anims/herbalist-tripo.glb');
const A = await load(process.argv[4] ?? 'tools/muaythai-anims/fighter-tripo.glb');
const find = re => Object.values(A.anims).find(a => re.test(a.getName()));
const WALK = find(/^walk/), RUN = find(/^run/);
const B = n => 'mixamorig:' + n, FPS = 30, TAU = Math.PI * 2;
const restPose = R => { const m = new Map(); for (const n of R.nodes) m.set(n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }); return m; };
const REST = restPose(H), HIPS = H.byName[B('Hips')], hip0 = REST.get(HIPS).t.clone();

function aim(p, bone, child, dir, w = 1) {
  const a = worldPos(H, p, B(bone)), b = worldPos(H, p, B(child));
  const cur = b.sub(a).normalize(), want = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const axis = new THREE.Vector3(q.x, q.y, q.z); const s = axis.length(); if (s < 1e-6) return p;
  rotWorld(H, p, B(bone), axis.divideScalar(s).toArray(), 2 * Math.atan2(s, q.w) * w); return p;
}
const arm = (p, side, up, fo) => { const S = side === 'L' ? 'Left' : 'Right'; aim(p, S + 'Arm', S + 'ForeArm', up); aim(p, S + 'ForeArm', S + 'Hand', fo); return p; };
const leg = (p, side, up, lo) => { const S = side === 'L' ? 'Left' : 'Right'; aim(p, S + 'UpLeg', S + 'Leg', up); aim(p, S + 'Leg', S + 'Foot', lo); return p; };
const bend = (p, a, bone = 'Spine1') => { rotWorld(H, p, B(bone), [1, 0, 0], a); return p; };
const yaw = (p, a, bone = 'Spine1') => { rotWorld(H, p, B(bone), [0, 1, 0], a); return p; };
const lift = (p, h) => { p.get(HIPS).t.y += h; return p; };
const mk = (base, fn) => fn(clone(base));

// ---- retarget (direction based) ------------------------------------------------
const CHAINS = [['Spine', 'Spine1'], ['Spine1', 'Spine2'], ['Spine2', 'Neck'], ['Neck', 'Head'], ['Head', 'HeadTop_End'],
  ...['Left', 'Right'].flatMap(S => [[S + 'Shoulder', S + 'Arm'], [S + 'Arm', S + 'ForeArm'], [S + 'ForeArm', S + 'Hand'], [S + 'Hand', S + 'HandMiddle1'],
    [S + 'UpLeg', S + 'Leg'], [S + 'Leg', S + 'Foot'], [S + 'Foot', S + 'ToeBase'], [S + 'ToeBase', S + 'Toe_End']])];
const AREST = restPose(A), aHips = A.byName[B('Hips')];
function retarget(anim, t) {
  const src = sample(A, anim, t), p = clone(REST);
  // hips: same world delta from rest, height scaled to this body
  const dq = worldQuat(A, src, aHips).multiply(worldQuat(A, AREST, aHips).invert());
  p.get(HIPS).r.premultiply(dq);
  const k = hip0.y / AREST.get(aHips).t.y; p.get(HIPS).t.set(hip0.x, hip0.y + (src.get(aHips).t.y - AREST.get(aHips).t.y) * k, hip0.z);
  for (const [b, c] of CHAINS) { const d = worldPos(A, src, B(c)).sub(worldPos(A, src, B(b))); aim(p, b, c, d.toArray()); }
  return p;
}
function retargetClip(name, anim) {
  const d = Math.max(...anim.listSamplers().map(s => { const a = s.getInput().getArray(); return a[a.length - 1]; }));
  const frames = []; for (let i = 0; i <= Math.round(d * FPS); i++) frames.push(retarget(anim, i / FPS));
  writeAnim(H, name, frames, FPS);
}

// ---- poses (left = +X, forward = +Z) -----------------------------------------------
const STAND = mk(REST, p => { arm(p, 'L', [.14, -1, .03], [.08, -1, .14]); arm(p, 'R', [-.14, -1, .03], [-.08, -1, .14]); return p; });
const bookL = p => arm(p, 'L', [.3, -.78, .4], [-.5, .08, .86]);           // book held open in front of the chest
const P = {
  STAND,
  book: mk(STAND, p => { bookL(p); arm(p, 'R', [-.3, -.82, .35], [.5, .1, .86]); return p; }),
  readPalm: mk(STAND, p => { bookL(p); arm(p, 'R', [-.35, -.6, .55], [-.05, .55, .85]); bend(p, .06); return p; }),
  release: mk(STAND, p => { bookL(p); arm(p, 'R', [-.12, .22, 1], [-.04, .4, 1]); bend(p, .14); yaw(p, -.12); return p; }),
  tossBack: mk(STAND, p => { arm(p, 'R', [-.45, .35, -.65], [-.05, .95, -.25]); arm(p, 'L', [.35, -.4, .7], [.1, -.2, 1]); yaw(p, .3); bend(p, -.06); return p; }),
  tossRel: mk(STAND, p => { arm(p, 'R', [-.12, .45, 1], [-.02, .55, 1]); arm(p, 'L', [.35, -.75, .2], [.15, -.9, .3]); yaw(p, -.25); bend(p, .12); return p; }),
  tossFol: mk(STAND, p => { arm(p, 'R', [.1, -.45, 1], [.15, -.65, .8]); arm(p, 'L', [.3, -.85, .1], [.1, -.95, .2]); yaw(p, -.35); bend(p, .2); return p; }),
  kneel: mk(STAND, p => { lift(p, -.24); leg(p, 'L', [.1, -.15, 1], [.04, -1, -.06]); leg(p, 'R', [-.08, -1, .1], [0, -.12, -1]); bend(p, .38); bend(p, .12, 'Spine'); bookL(p); arm(p, 'R', [-.12, -.72, .7], [0, -.97, .2]); return p; }),
  stirA: mk(STAND, p => { arm(p, 'R', [-.25, -.5, .85], [.35, -.6, .75]); bookL(p); bend(p, .15); return p; }),
  stirB: mk(STAND, p => { arm(p, 'R', [-.35, -.45, .82], [-.35, -.55, .8]); bookL(p); bend(p, .15); return p; }),
  lean: mk(STAND, p => { arm(p, 'R', [-.3, -.3, .9], [-.1, .2, 1]); bookL(p); bend(p, -.18); bend(p, -.15, 'Neck'); return p; }),
  sendUp: mk(STAND, p => { arm(p, 'R', [-.2, 1, .2], [-.05, 1, .1]); bookL(p); bend(p, -.12); bend(p, -.25, 'Neck'); return p; }),
  pestleUp: mk(STAND, p => { arm(p, 'L', [.15, .55, .8], [-.25, .9, .2]); arm(p, 'R', [-.15, .55, .8], [.25, .9, .2]); bend(p, -.1); lift(p, .01); return p; }),
  pestleDown: mk(STAND, p => { arm(p, 'L', [.12, -.5, .85], [-.12, -.95, .3]); arm(p, 'R', [-.12, -.5, .85], [.12, -.95, .3]); bend(p, .38); lift(p, -.07); return p; }),
  skyUp: mk(STAND, p => { arm(p, 'L', [.3, .95, .12], [.15, 1, .08]); arm(p, 'R', [-.3, .95, .12], [-.15, 1, .08]); bend(p, -.14); bend(p, -.3, 'Neck'); lift(p, .01); return p; }),
  sprinkle: mk(STAND, p => { arm(p, 'L', [.3, -.1, 1], [.15, -.4, 1]); arm(p, 'R', [-.3, -.1, 1], [-.15, -.4, 1]); bend(p, .22); return p; }),
  hurt: mk(STAND, p => { bend(p, -.4); bend(p, -.35, 'Neck'); arm(p, 'L', [.4, -.5, .5], [.2, .3, .9]); arm(p, 'R', [-.4, -.5, .5], [-.2, .3, .9]); lift(p, -.02); return p; }),
  down: mk(STAND, p => { arm(p, 'L', [1, .2, .3], [1, 0, .4]); arm(p, 'R', [-1, .2, .3], [-1, 0, .4]); return p; }),
};

// ---- composer ------------------------------------------------------------------
const ease = u => u * u * (3 - 2 * u), easeIn = u => u * u * u, easeOut = u => 1 - Math.pow(1 - u, 2.4);
function build(name, dur, keys, fx) {
  const frames = [];
  for (let i = 0; i <= Math.round(dur * FPS); i++) {
    const t = i / FPS; let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= t) k++;
    const [t0, a] = keys[k], [t1, b, e = ease] = keys[Math.min(k + 1, keys.length - 1)];
    const p = blend(a, b, t1 > t0 ? e(Math.min(1, (t - t0) / (t1 - t0))) : 0); fx?.(t, p); frames.push(p);
  }
  return writeAnim(H, name, frames, FPS);
}
const breathe = (t, p, k = 1) => { lift(p, -.006 * k * (1 - Math.cos(TAU * t / 2.4)) / 2); rotWorld(H, p, B('Hips'), [0, 0, 1], Math.sin(TAU * t / 2.4) * .025 * k); };

build('idle', 2.4, [[0, P.STAND], [2.4, P.STAND]], (t, p) => { breathe(t, p); bend(p, .05 * Math.sin(TAU * t / 2.4 + 1), 'Neck'); });
retargetClip('walk', WALK); retargetClip('run', RUN);
build('cast_book', 1.6, [[0, P.STAND], [.3, P.book, easeOut], [.55, P.readPalm], [.7, P.release, easeIn], [1.15, P.release], [1.6, P.STAND]], (t, p) => breathe(t, p, .5));
build('toss', 1.0, [[0, P.STAND], [.3, P.tossBack, easeOut], [.45, P.tossRel, easeIn], [.65, P.tossFol, easeOut], [1.0, P.STAND]]);
build('kneel_heal', 2.4, [[0, P.STAND], [.45, P.book], [.9, P.kneel, easeIn], [1.6, P.kneel], [2.1, P.book, ease], [2.4, P.STAND]]);
build('brew', 2.4, [[0, P.STAND], [.25, P.stirA], [.5, P.stirB], [.75, P.stirA], [1.0, P.stirB], [1.2, P.lean, easeOut], [1.6, P.sendUp, ease], [2.0, P.sendUp], [2.4, P.STAND]]);
build('pound', 2.2, [[0, P.STAND], [.4, P.pestleUp, easeOut], [.6, P.pestleDown, easeIn], [.85, P.pestleUp, easeOut], [1.1, P.pestleDown, easeIn], [1.35, P.pestleUp, easeOut], [1.6, P.pestleDown, easeIn], [1.9, P.book], [2.2, P.STAND]]);
build('raise_sky', 2.2, [[0, P.STAND], [.6, P.skyUp, ease], [1.1, P.skyUp], [1.5, P.sprinkle, ease], [1.85, P.sprinkle], [2.2, P.STAND]], (t, p) => { if (t > 1.5 && t < 1.85) arm(p, 'R', [-.3, -.1 + .15 * Math.sin(t * 30), 1], [-.15, -.4 + .2 * Math.sin(t * 30), 1]); });
build('hurt', .5, [[0, P.STAND], [.1, P.hurt], [.22, P.hurt], [.5, P.STAND]]);
build('die', 1.6, [[0, P.STAND], [.25, P.hurt], [.6, P.down], [1.6, P.down]], (t, p) => {
  const u = ease(Math.min(1, Math.max(0, (t - .25) / .85))); rotWorld(H, p, B('Hips'), [1, 0, 0], -1.5 * u);
  const low = Math.min(...['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'].map(n => worldPos(H, p, B(n)).y)); lift(p, (.06 - low) * u);
});

const { prune, dedup } = await import('@gltf-transform/functions');
await H.doc.transform(prune(), dedup());
console.log(H.root.listAnimations().map(a => a.getName()).join(', '));
await H.io.write(process.argv[3] ?? 'public/models/herbalist.glb', H.doc);
