import * as THREE from 'three';

// Weapons and props are authored in their own frame (grip at the origin,
// blade/shaft along +Y, flat side facing ±Z, cutting edge toward +X) and
// mounted into a hand with gripMatrix().
const V = (...a) => new THREE.Vector3(...a);
// A fist holds a handle diagonally: the shaft leans ~20° toward the little finger.
export function gripMatrix(k, { reverse = false, slide = 0, angle = 20 } = {}) {
  const a = angle * Math.PI / 180, r = reverse ? -1 : 1;
  const x = V(0, -Math.cos(a), -r * Math.sin(a)), y = V(0, -Math.sin(a), r * Math.cos(a)), z = new THREE.Vector3().crossVectors(x, y);
  const m = new THREE.Matrix4().makeBasis(x, y, z); m.setPosition(-k * .016, -.078, 0);
  if (slide) m.multiply(new THREE.Matrix4().makeTranslation(0, slide, 0));
  return m;
}
// Object resting on the palm: local +Y leaves the palm, +Z runs along the fingers.
export function palmMatrix(k, offset = [0, 0, 0]) {
  const y = V(-k, 0, 0), z = V(0, -1, 0), x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(-k * .022 + offset[0], -.075 + offset[1], offset[2]);
}
const place = (g, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => g.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale)));

function blade(points, depth = .006) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); return g;
}
function handle(parts, m, from, to, r = .014) {
  parts.push([place(new THREE.CylinderGeometry(r, r * 1.05, to - from, 8), [0, (from + to) / 2, 0]), m.darkLeather]);
  for (let y = from + .03; y < to - .01; y += .035) parts.push([place(new THREE.TorusGeometry(r + .001, .0035, 4, 10), [0, y, 0], [Math.PI / 2 + .25, 0, 0]), m.leather]);
}

// Dhap: Thai single-edged sword, widening toward a clipped tip.
export function dhap(m) {
  const parts = [];
  parts.push([blade([[-.012, .1], [-.011, .45], [-.004, .66], [.012, .74], [.05, .67], [.047, .42], [.028, .1]]), m.steel]);
  parts.push([blade([[.0, .1], [.0, .6], [.008, .62], [.008, .1]], .0075), m.gold]);
  handle(parts, m, -.11, .085);
  parts.push([place(new THREE.CylinderGeometry(.04, .04, .014, 14), [.008, .092, 0], [0, 0, 0], [1, 1, .55]), m.gold]);
  parts.push([place(new THREE.SphereGeometry(.022, 10, 8), [0, -.12, 0]), m.gold]);
  parts.push([place(new THREE.ConeGeometry(.016, .07, 6), [0, -.165, 0], [Math.PI, 0, 0]), m.tasselRed || m.gold]);
  return parts;
}
export function dagger(m) {
  const parts = [];
  parts.push([blade([[-.01, .06], [-.014, .16], [-.03, .26], [-.02, .3], [.0, .25], [.02, .16], [.02, .06]]), m.steel]);
  handle(parts, m, -.06, .05, .013);
  parts.push([place(new THREE.TorusGeometry(.025, .007, 6, 14), [0, .055, 0], [Math.PI / 2, 0, 0], [1, .6, 1]), m.gold]);
  parts.push([place(new THREE.SphereGeometry(.018, 8, 6), [0, -.068, 0], [0, 0, 0], [1, 1.3, 1]), m.gold]);
  return parts;
}
export function staff(m) {
  const parts = [];
  const shaft = new THREE.CylinderGeometry(.017, .021, 1.72, 8, 6);
  const pos = shaft.attributes.position; // gentle gnarl
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + Math.sin(pos.getY(i) * 7) * .006);
  shaft.computeVertexNormals();
  parts.push([place(shaft, [0, -.1, 0]), m.wood]);
  for (const y of [.42, .5, .58, .64]) parts.push([place(new THREE.TorusGeometry(.021, .007, 5, 10), [0, y, 0], [Math.PI / 2 + (y * 13 % 1) * .4, 0, 0]), m.crimson || m.leather]);
  // Horned animal skull crowning the staff.
  parts.push([place(new THREE.SphereGeometry(.06, 12, 10), [.0, .82, 0], [0, 0, 0], [1, .9, 1.1]), m.bone]);
  parts.push([place(new THREE.ConeGeometry(.035, .11, 8), [.07, .8, 0], [0, 0, -Math.PI / 2]), m.bone]);
  for (const k of [1, -1]) {
    parts.push([place(new THREE.SphereGeometry(.014, 6, 6), [.04, .84, k * .04]), m.eye]);
    const horn = new THREE.TorusGeometry(.07, .014, 6, 12, Math.PI * .9);
    parts.push([place(horn, [-.03, .9, k * .045], [0, 0, Math.PI * .1]), m.darkLeather]);
  }
  // Gold dharma wheel.
  parts.push([place(new THREE.TorusGeometry(.055, .008, 6, 20), [-.02, .74, .06], [0, .3, 0]), m.gold]);
  for (let i = 0; i < 4; i++) parts.push([place(new THREE.BoxGeometry(.11, .007, .007), [-.02, .74, .06], [0, .3, i * Math.PI / 4]), m.gold]);
  return parts;
}
export function bell(r = .022) {
  const pts = [[0, 0], [r * .55, .002], [r * .7, r * .3], [r * .6, r * 1.1], [r * .3, r * 1.4], [0, r * 1.45]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 12);
}
// Recurve bow: grip at origin, limbs along ±Y, belly away (+X), string at -X.
export const BOW_TIP = .6, BOW_STRING_X = -.13;
export function bow(m) {
  const parts = [];
  for (const k of [1, -1]) {
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-.02, k * .14, 0), V(-.08, k * .36, 0), V(-.13, k * .52, 0), V(-.115, k * .6, 0)]);
    parts.push([new THREE.TubeGeometry(curve, 18, .012, 6), m.wood]);
    parts.push([place(new THREE.TorusGeometry(.015, .005, 5, 10), [-.08, k * .36, 0], [Math.PI / 2, 0, 0]), m.gold]);
  }
  parts.push([place(new THREE.CylinderGeometry(.019, .019, .13, 8), [0, 0, 0]), m.darkLeather]);
  parts.push([place(new THREE.BoxGeometry(.02, .05, .03), [.02, .1, 0]), m.gold]);
  parts.push([place(new THREE.BoxGeometry(.02, .05, .03), [.02, -.1, 0]), m.gold]);
  return parts;
}
export function arrow(m, length = .72) {
  const parts = [];
  parts.push([place(new THREE.CylinderGeometry(.005, .005, length, 5), [0, length / 2, 0]), m.wood]);
  parts.push([place(new THREE.ConeGeometry(.012, .05, 6), [0, length + .02, 0]), m.steel]);
  for (let i = 0; i < 3; i++) parts.push([place(new THREE.BoxGeometry(.002, .07, .022), [0, .06, 0], [0, i * Math.PI * 2 / 3, 0]).translate(Math.sin(i * 2.1) * .01, 0, Math.cos(i * 2.1) * .01), m.feather || m.wrap]);
  return parts;
}
export function quiver(m) {
  const parts = [];
  parts.push([place(new THREE.CylinderGeometry(.05, .042, .5, 12, 1, true), [0, 0, 0]), m.leather]);
  parts.push([place(new THREE.CircleGeometry(.042, 12), [0, -.25, 0], [Math.PI / 2, 0, 0]), m.leather]);
  for (const y of [-.2, .05, .22]) parts.push([place(new THREE.TorusGeometry(.05, .006, 5, 14), [0, y, 0], [Math.PI / 2, 0, 0]), m.gold]);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = .025 * Math.sqrt(i / 7);
    for (const [g, mat] of arrow(m, .62)) parts.push([g.clone().translate(Math.sin(a) * r, -.3, Math.cos(a) * r).applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI)).applyMatrix4(new THREE.Matrix4().makeTranslation(0, .14, 0)), mat]);
  }
  return parts;
}
export function book(m) {
  const parts = [];
  for (const k of [1, -1]) {
    parts.push([place(new THREE.BoxGeometry(.105, .008, .16), [k * .055, .0, 0], [0, 0, k * .14]), m.bookCover || m.leather]);
    parts.push([place(new THREE.BoxGeometry(.095, .016, .148), [k * .052, .011, 0], [0, 0, k * .14]), m.wrap]);
  }
  parts.push([place(new THREE.BoxGeometry(.05, .002, .09), [.055, .022, 0], [0, 0, .14]), m.gold]);
  return parts;
}
export function flower(m) {
  const parts = [[place(new THREE.CylinderGeometry(.003, .003, .14, 4), [0, .03, 0]), m.leaf || m.wood]];
  for (let i = 0; i < 5; i++) parts.push([place(new THREE.SphereGeometry(.014, 6, 4), [Math.sin(i * 1.256) * .016, .105, Math.cos(i * 1.256) * .016], [0, 0, 0], [1, .35, 1.4]), m.wrap]);
  for (let i = 0; i < 3; i++) parts.push([place(new THREE.SphereGeometry(.02, 6, 4), [Math.sin(i * 2) * .02, .05 + i * .015, Math.cos(i * 2) * .015], [0, i, .6], [1, .25, .5]), m.leaf || m.wood]);
  return parts;
}
export function skull(m, s = 1) {
  return [
    [place(new THREE.SphereGeometry(.05 * s, 12, 10), [0, 0, 0], [0, 0, 0], [1, 1.05, .95]), m.bone],
    [place(new THREE.BoxGeometry(.06 * s, .035 * s, .05 * s), [0, -.045 * s, .015 * s]), m.bone],
    [place(new THREE.SphereGeometry(.014 * s, 6, 6), [.02 * s, 0, .042 * s]), m.eye],
    [place(new THREE.SphereGeometry(.014 * s, 6, 6), [-.02 * s, 0, .042 * s]), m.eye],
  ];
}
export function mount(rb, bone, parts, matrix) { for (const [g, mat] of parts) rb.rigidMatrix(bone, g, mat, matrix); }
export const at = (pos, rot = [0, 0, 0], scale = [1, 1, 1]) => new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...scale));
