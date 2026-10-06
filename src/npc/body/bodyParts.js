import * as THREE from 'three';
import { RIG } from './rig.js';
import { lathe, blob, sculpt, crop, paint, merge, box } from './shape.js';

// Body, face, hair and clothing of a townsperson. One entry = one instanced
// mesh shared by every NPC that wears it. Geometry is in the local space of
// its frame (see rig.js); colours come from the NPC's look (src/npc/NPCData.js).
//   color(look, frame) → css colour     when(look) → part is worn
const H = RIG.head;
const g = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
export const mix = (a, b, t) => '#' + tmp.set(a).lerp(tmp2.set(b), t).getHexString();

// ---- Body shapes ----
function torso(female, inflate = 0) {
  const prof = female
    ? [[.125, .86], [.12, .93], [.112, 1], [.12, 1.08], [.134, 1.17], [.14, 1.25], [.142, 1.31], [.136, 1.36], [.12, 1.4], [.09, 1.43], [.05, 1.452], [0, 1.458]]
    : [[.13, .86], [.13, .93], [.128, 1], [.14, 1.08], [.16, 1.17], [.172, 1.25], [.178, 1.31], [.17, 1.36], [.15, 1.4], [.11, 1.43], [.06, 1.455], [0, 1.462]];
  return lathe(prof.map(([r, y]) => [r && r + inflate, y]), {
    seg: 14, sz: female ? .7 : .66,
    warp: v => {
      if (v.z > 0) v.z += female ? .032 * g(v.y, 1.2, .05) * g(Math.abs(v.x), .058, .045) : .012 * g(v.y, 1.25, .06) * g(Math.abs(v.x), .07, .06);
      else v.z -= .01 * g(v.y, 1.28, .08) * g(Math.abs(v.x), .07, .05); // shoulder blades
    },
  });
}

// Skull: the lower face narrows to the chin, the back of the head is fuller.
const headDeform = v => {
  if (v.y < 0) { v.x *= 1 - .24 * -v.y; v.z *= 1 - .06 * -v.y; v.y *= 1.06; }
  if (v.z < 0) v.z *= 1.06;
};
const onHead = (geo, k = 1) => geo.scale(H.rx * k, H.ry * k, H.rz * k).translate(0, H.y, H.z);
function head() {
  const skull = onHead(sculpt(16, 10, headDeform));
  const nose = blob(.014, .026, .018, 0, .112, .12, 5).rotateX(-.15);
  const ears = [-1, 1].map(s => blob(.013, .03, .022, s * .099, .125, 0, 5).rotateY(s * .3));
  return merge(skull, nose, ...ears);
}
// Hair shell hugging the skull. Hairline heights are in unit-sphere y at the
// front, the sides and the back; `shape` sculpts the volume.
function hairShell(k, { front, side, back }, shape) {
  const geo = sculpt(16, 12, v => { headDeform(v); shape?.(v); });
  crop(geo, (x, y, z) => y > (z >= 0 ? side + (front - side) * z : side + (back - side) * -z));
  return onHead(geo, k);
}
const strands = v => { if (v.y > 0) { const r = 1 + .02 * Math.sin(Math.atan2(v.x, v.z) * 11) * v.y; v.x *= r; v.z *= r; } };
const eyes = () => merge(...[-1, 1].map(s => blob(.016, .011, .009, 0, 0, 0, 6).rotateY(s * .38).translate(s * .038, .142, .109)));
const brows = () => merge(...[-1, 1].map(s => box(.04, .008, .008).rotateZ(s * -.14).rotateY(s * .38).translate(s * .04, .168, .111)));

// Wrapped cloth gets soft vertical folds below the waist.
const folds = (n, amp, top) => (v, a) => { if (v.y < top) { const r = 1 + amp * Math.sin(a * n + v.y * 9) * Math.min(1, (top - v.y) * 3); v.x *= r; v.z *= r; } };
const skirtProfile = [[.155, .11], [.16, .2], [.158, .45], [.15, .78], [.138, .9], [.125, 1.02]];
const skirtWarp = (v, a) => { if (v.y < .9) { const r = 1 + .03 * Math.sin(a * 10) * (.9 - v.y); v.x *= r; v.z *= r; } };

const shirt = l => !!l.shirt, bare = l => !l.robe;
const sleeve = (bottom, cuff) => paint(lathe([[.058, bottom], [.064, bottom + .01], [.063, -.04], [.064, .01], [.05, .05], [0, .072]], { seg: 10 }), (x, y) => (y < bottom + .012 && cuff ? .8 : 1));

export const BODY_PARTS = [
  // Skin and build.
  { name: 'torsoM', geo: () => torso(false), frames: ['upper'], color: l => (l.shirt ? l.top : l.skin), when: l => !l.female || l.child },
  { name: 'torsoF', geo: () => torso(true), frames: ['upper'], color: l => (l.shirt ? l.top : l.skin), when: l => l.female && !l.child },
  { name: 'neck', geo: () => lathe([[.05, 1.38], [.047, 1.45], [.044, 1.52], [.04, 1.56]], { seg: 10, sz: .95 }), frames: ['upper'], color: l => l.skin },
  { name: 'head', geo: head, frames: ['head'], color: l => l.skin },
  { name: 'eyes', geo: eyes, frames: ['head'], color: () => '#1c1511' },
  { name: 'brows', geo: brows, frames: ['head'], color: l => mix(l.hair, '#000000', .2), when: l => l.hairStyle !== 'shaved' },
  { name: 'mouth', geo: () => box(.032, .008, .008).translate(0, .066, .104), frames: ['head'], color: l => mix(l.skin, '#7a3328', .5) },
  { name: 'pelvis', geo: () => lathe([[0, .75], [.1, .765], [.145, .83], [.152, .89], [.142, .96], [.13, 1.02]], { seg: 12, sz: .74 }), frames: ['root'], color: l => l.skirt ?? l.bottom },
  { name: 'upperArm', geo: () => lathe([[0, -.31], [.04, -.29], [.05, -.14], [.058, -.03], [.05, .035], [0, .06]], { seg: 9 }), frames: ['armL', 'armR'], color: l => l.skin },
  { name: 'forearm', geo: () => merge(
    lathe([[0, -.25], [.027, -.235], [.04, -.08], [.042, -.02], [.03, .025], [0, .035]], { seg: 9 }),
    blob(.02, .062, .036, 0, -.305, .008, 7), blob(.011, .026, .012, 0, -.275, .038, 5).rotateX(-.3)), frames: ['foreL', 'foreR'], color: l => l.skin },
  { name: 'shin', geo: () => merge(
    lathe([[0, -.415], [.04, -.39], [.045, -.28], [.062, -.12], [.055, -.02], [.048, .03], [0, .055]], { seg: 9, warp: v => { if (v.z < 0) v.z *= 1 + .3 * g(v.y, -.11, .08); } }),
    blob(.043, .03, .115, 0, -.428, .055, 7)), frames: ['shinL', 'shinR'], color: l => l.skin },
  // Hair.
  { name: 'hairShort', geo: () => hairShell(1.08, { front: .5, side: .45, back: .3 }, v => { strands(v); if (v.y > .8) v.y = .8 + (v.y - .8) * .5; }), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'short' },
  { name: 'hairSides', geo: () => hairShell(1.018, { front: .42, side: .02, back: -.55 }), frames: ['head'], color: l => mix(l.skin, l.hair, .55), when: l => l.hairStyle === 'short' },
  { name: 'hairCrop', geo: () => hairShell(1.1, { front: .4, side: -.02, back: -.5 }, strands), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'crop' },
  { name: 'hairBun', geo: () => merge(hairShell(1.05, { front: .38, side: -.05, back: -.5 }, strands), blob(.06, .052, .052, 0, .24, -.095)), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'bun' },
  { name: 'hairpin', geo: () => merge(box(.15, .008, .008).rotateZ(.25).translate(0, .245, -.098), blob(.012, .012, .012, .07, .265, -.098, 5)), frames: ['head'], color: () => '#c9a35a', when: l => l.hairStyle === 'bun' },
  { name: 'hairLong', geo: () => merge(hairShell(1.06, { front: .36, side: -.15, back: -.5 }, strands),
    lathe([[.145, -.2], [.135, -.12], [.13, 0], [.132, .12], [.125, .2]], { seg: 10, phi: [Math.PI - 1.6, 3.2], sz: 1.05, warp: folds(7, .05, .1) }).translate(0, 0, H.z)), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'long' },
  { name: 'hairTopknot', geo: () => merge(blob(.04, .05, .04, 0, .29, -.01), blob(.022, .03, .022, 0, .335, -.01, 6)), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'topknot' },
  // Clothing. Men: โจงกระเบน (wrapped knee trousers) with a tucked tail at the back;
  // women: ผ้าซิ่น (tube skirt) with a hem band and a pleated สไบ breast cloth.
  { name: 'thighJong', geo: () => paint(lathe([[0, -.48], [.098, -.45], [.11, -.3], [.115, -.15], [.105, -.02], [.07, .06], [0, .075]], { seg: 12, warp: folds(5, .05, 0) }), (x, y) => (y < -.44 ? .8 : 1)),
    frames: ['legL', 'legR'], color: l => l.bottom, when: l => !l.skirt },
  { name: 'thighSlim', geo: () => lathe([[0, -.44], [.066, -.38], [.075, -.2], [.082, -.05], [.07, .04], [0, .07]], { seg: 10 }), frames: ['legL', 'legR'], color: l => l.skirt, when: l => !!l.skirt },
  { name: 'jongTail', geo: () => merge(blob(.06, .028, .03, 0, .965, -.105, 6), box(.07, .2, .03).rotateX(-.25).translate(0, .85, -.11), blob(.035, .1, .02, 0, .86, .112, 6)),
    frames: ['root'], color: l => l.bottom, when: l => !l.skirt },
  { name: 'skirt', geo: () => merge(paint(lathe(skirtProfile, { seg: 20, sz: .8, warp: skirtWarp }), (x, y) => (Math.floor(y / .07) % 2 ? .9 : 1)),
    paint(box(.05, .8, .012).translate(.02, .53, .13), (x, y, z, i) => (i % 4 < 2 ? .85 : 1))), frames: ['root'], color: l => l.skirt, when: l => !!l.skirt },
  { name: 'skirtHem', geo: () => paint(lathe([[.163, .105], [.167, .115], [.166, .16], [.163, .21]], { seg: 20, sz: .8, warp: skirtWarp }), (x, y) => (y > .14 && y < .16 ? .7 : 1)),
    frames: ['root'], color: l => l.trim, when: l => !!l.skirt && bare(l) },
  { name: 'sash', geo: () => merge(
    paint(lathe([[.14, .965], [.147, 1], [.14, 1.035]], { seg: 20, sz: .76 }), (x, y, z) => ((Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI * 2) * 16) + (y > 1 ? 1 : 0)) % 2 ? 1 : .72)),
    blob(.028, .024, .02, .06, .99, .113, 6), box(.032, .17, .008).rotateZ(.08).translate(.05, .9, .117), box(.03, .15, .008).rotateZ(-.14).translate(.078, .91, .113)),
    frames: ['root'], color: l => l.sash, when: bare },
  { name: 'sabai', geo: () => merge(
    paint(crop(torso(true, .008), (x, y) => y > 1.07 && y < 1.2 + Math.max(0, x + .02) * 1.6), (x, y) => (Math.floor((y - x * .8) / .035) % 2 ? .86 : 1)),
    box(.07, .42, .012).rotateZ(.12).translate(.09, 1.2, -.112)), frames: ['upper'], color: l => l.top ?? l.sash, when: l => l.female && !l.child && !l.shirt && bare(l) },
  { name: 'collar', geo: () => merge(lathe([[.068, 1.412], [.073, 1.425], [.072, 1.45], [.064, 1.46]], { seg: 14, sz: .9 }), box(.022, .26, .01).translate(0, 1.29, .132)), frames: ['upper'], color: l => l.trim, when: shirt },
  { name: 'sleeve', geo: () => sleeve(-.18, true), frames: ['armL', 'armR'], color: l => l.top, when: l => l.shirt && !l.sleeves },
  { name: 'sleeveFull', geo: () => sleeve(-.31, false), frames: ['armL', 'armR'], color: l => l.top, when: l => l.shirt && l.sleeves },
  { name: 'sleeveFore', geo: () => lathe([[.036, -.23], [.038, -.2], [.05, -.03], [.045, .025], [0, .045]], { seg: 10 }), frames: ['foreL', 'foreR'], color: l => l.top, when: l => l.shirt && l.sleeves },
  { name: 'cuff', geo: () => lathe([[.038, -.236], [.042, -.226], [.042, -.2], [.04, -.19]], { seg: 10 }), frames: ['foreL', 'foreR'], color: l => l.trim, when: l => l.shirt && l.sleeves },
  // Monk: จีวร over the left shoulder (right shoulder bare) with the folded สังฆาฏิ band.
  { name: 'robeUpper', geo: () => merge(
    paint(crop(torso(false, .01), (x, y) => y > .9 && y < 1.22 + (x + .17) * .9), (x, y) => (Math.floor((y + x * .9) / .05) % 2 ? .93 : 1)),
    paint(merge(box(.085, .5, .016).rotateZ(-.2).translate(.085, 1.17, .13), box(.085, .5, .016).rotateZ(.2).translate(.085, 1.17, -.124), box(.095, .02, .25).translate(.1, 1.425, 0)), () => .82)),
    frames: ['upper'], color: l => l.robe, when: l => !!l.robe },
  { name: 'robeSleeve', geo: () => sleeve(-.2, false), frames: ['armR'], color: l => l.robe, when: l => !!l.robe },
];
