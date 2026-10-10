// Bounded, offline socket sidecar. Importing performs no I/O or registration.
// Bodies, raw sources, public assets, production profiles and QA tools are read-only.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, loadRig, restoreRest, worldVertices, decomposeRigid } from './rig.mjs';
import { sha256 } from './glb.mjs';
import { packingDependencies } from './prepare.mjs';
import { contactRolePlan, legacyGripForPart } from './contacts.mjs';
import { NPC_MODELS, NPC_PROP_FRAMES, createMeshy24NPCPoseAdapter } from '../../src/npc/NPCModels.js';
import { NPCModelRenderer } from '../../src/npc/NPCModelRenderer.js';
import { NPC } from '../../src/entities/NPC.js';
import { NPCS } from '../../src/data/npcs.js';
import { makeLook } from '../../src/npc/NPCData.js';
import { GEAR_PARTS } from '../../src/npc/body/gearParts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = path.join(ROOT, 'artifacts/grip-fits/role-contacts');
const ROLES = Object.freeze({ enhancer: { side: 'right', part: 'hammer', state: 'work', anim: 'hammer' },
  master_hunter: { side: 'left', part: 'bow', state: 'work', anim: 'aim' },
  master_bandit: { side: 'right', part: 'knife', state: 'idle', anim: 'lean' } });
const vec = (a, label = 'vector') => {
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) throw Error(`Invalid ${label}`);
  return new THREE.Vector3(...a);
};
const json = b => JSON.parse(b.toString('utf8'));
const average = points => points.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(points.length);
const affine = m => {
  decomposeRigid(m, 'role socket');
  if (Math.abs(m.determinant() - 1) > 1e-5) throw Error('Socket must be rigid and non-reflected');
  m.elements[3] = m.elements[7] = m.elements[11] = 0; m.elements[15] = 1; return m;
};
async function outputDirectory() {
  let ancestor = OUTPUT;
  for (;;) {
    try {
      const actual = path.resolve(await realpath(ancestor), path.relative(ancestor, OUTPUT));
      const allowed = path.join(await realpath(ROOT), 'artifacts/grip-fits/role-contacts');
      if (actual !== allowed) throw Error('Output junction escapes role-contacts');
      break;
    } catch (e) { if (e.code !== 'ENOENT') throw e; ancestor = path.dirname(ancestor); }
  }
  await mkdir(OUTPUT, { recursive: true }); return OUTPUT;
}
async function save(name, value) {
  const out = await outputDirectory(), file = path.join(out, name);
  if (!file.startsWith(out + path.sep)) throw Error('Output escaped sidecar');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
  return { path: file, sha256: sha256(await readFile(file)) };
}
async function inputs(family) {
  if (!ROLES[family]) throw Error('Only enhancer, master_hunter and master_bandit are owned');
  const base = path.join(ROOT, 'artifacts/city-npc-models', family), files = {
    body: path.join(base, `${family}.glb`), adapter: path.join(base, `${family}-adapter.json`),
    qa: path.join(base, `${family}-qa.json`), catalog: path.join(ROOT, 'artifacts/city-npc-models/candidate-profiles.json'),
    brief: path.join(ROOT, 'docs/art/npcs/NPC_MODEL_BRIEFS.json'),
    direction: path.join(ROOT, 'docs/art/npcs/GRASP_DIRECTION.json'),
    review: path.join(ROOT, 'docs/art/npcs/reviews/GRASP_FINAL.md'),
  };
  const bytes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([k, f]) => [k, await readFile(f)])));
  const rig = await loadRig(files.body), adapter = json(bytes.adapter), qa = json(bytes.qa), catalog = json(bytes.catalog);
  const originalProfile = catalog.families.find(p => p.family === family);
  if (!originalProfile?.inspectionOnly || qa.family !== family || qa.sha256 !== rig.sha256 || originalProfile.geometryAssetSha256 !== rig.sha256
    || !qa.audit?.passed || qa.audit.failureCount !== 0) throw Error('Exact passed source geometry/catalog identity required');
  for (const role of ['body', 'walk', 'run']) if (adapter.sourceHashes?.[role] !== qa.sources?.[role]) throw Error('Raw lineage differs');
  // Read and pin the real delivered sources; preparation receipts alone are not lineage verification.
  const rawPins = {};
  for (const role of ['body', 'walk', 'run']) {
    const file = qa.inputPaths[role], hash = sha256(await readFile(file));
    if (hash !== qa.sources[role]) throw Error(`Raw ${role} source changed`);
    rawPins[role] = { path: file, sha256: hash };
  }
  const plan = contactRolePlan(family, json(bytes.brief), originalProfile.bakedAccessories);
  const pins = Object.fromEntries(Object.entries(files).map(([k, file]) => [k, { path: file, sha256: sha256(bytes[k]) }]));
  const runtimePins = [];
  for (const name of ['src/entities/NPC.js', 'src/npc/NPCModels.js', 'src/npc/NPCModelRenderer.js', 'src/npc/NPCActivityPoses.js', 'src/npc/NPCData.js',
    'src/npc/body/gearParts.js', 'src/npc/body/blade.js', 'src/npc/body/rig.js', 'tools/npc-models/contacts.mjs', 'tools/npc-models/review.js', 'tools/npc-models/capture.mjs']) {
    const file = path.join(ROOT, name); runtimePins.push({ path: file, sha256: sha256(await readFile(file)) });
  }
  const role = ROLES[family], frame = NPC_PROP_FRAMES[role.part];
  if (!plan.grips[frame].parts.includes(role.part) || plan.grips[frame].contact.some((v, i) => v !== legacyGripForPart(role.part)[i])) throw Error('Actual legacy role contact differs');
  const witnessDir = path.join(ROOT, 'docs/art/npcs/reviews/registry-15-1', family), witnesses = [];
  for (const suffix of [`${role.state}-${role.anim}-hand-${role.side}-front`, `${role.state}-${role.anim}-hand-${role.side}-back`, `${role.state}-${role.anim}-prop-${role.part}-side`, `idle-hand-${role.side}-side`]) {
    const file = path.join(witnessDir, `${family}-${suffix}.png`);
    witnesses.push({ path: file, sha256: sha256(await readFile(file)), baselineOnly: true, assetSha256: originalProfile.assetSha256 });
  }
  return { family, role, rig, adapter, qa, originalProfile, plan, pins, rawPins, runtimePins, witnesses };
}
export function inspectRoleHand(rig, adapter, side) {
  restoreRest(rig);
  const name = side === 'right' ? 'RightHand' : 'LeftHand', bone = rig.names.get(name), h = adapter.hands?.[side];
  if (h?.name !== name || !bone || rig.mesh.skeleton.bones.length !== 24) throw Error('Actual Meshy hand required');
  if (bone.matrixWorld.elements.some((v, i) => Math.abs(v - adapter.nodes[name].bindWorld[i]) > 2e-5)) throw Error('Rest adapter differs');
  const y = vec(h.fingersWorld).normalize(), z = vec(h.palmWorld).addScaledVector(y, -vec(h.palmWorld).dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize(), wrist = bone.getWorldPosition(new THREE.Vector3());
  const matrix = new THREE.Matrix4().makeBasis(x, y, z).setPosition(wrist), inverse = matrix.clone().invert();
  const values = worldVertices(rig), { skinIndex, skinWeight } = rig.mesh.geometry.attributes, joint = rig.mesh.skeleton.bones.indexOf(bone);
  const records = [], map = new Map(), vertexRecord = new Map();
  for (let i = 0; i < values.length / 3; i++) {
    let weight = 0; for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === joint) weight += skinWeight.getComponent(i, k);
    const world = new THREE.Vector3().fromArray(values, i * 3), p = world.clone().applyMatrix4(inverse);
    if (weight < .02 || p.length() > .25 || p.y < -.02) continue;
    const key = p.toArray().map(v => Math.round(v * 1e6)).join(':');
    if (!map.has(key)) { map.set(key, records.length); records.push({ id: records.length, vertex: i, vertices: [], hand: p.toArray(), world: world.toArray(), handWeight: weight }); }
    const r = records[map.get(key)]; r.vertices.push(i); r.handWeight = Math.min(r.handWeight, weight); vertexRecord.set(i, r.id);
  }
  const triangles = [], indices = rig.mesh.geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [indices[i], indices[i + 1], indices[i + 2]].map(v => vertexRecord.get(v));
    if (ids.every(v => v !== undefined)) triangles.push({ triangle: i / 3, records: ids, vertices: Array.from(indices.slice(i, i + 3)) });
  }
  const rigid = records.filter(r => r.handWeight >= .9999), center = average(rigid.map(r => vec(r.hand)));
  return { schema: 1, bone: name, side, matrix: matrix.toArray(), records, triangles,
    fullyHandWeightedCentroid: { pointInPlotFrame: center.toArray(), distanceFromWrist: center.length(), weldedPoints: rigid.length,
      interpretation: 'Ownership centroid only; it includes distal fingers and is NOT the proximal palm or thumb-index web.' },
    limits: ['PCA is a plotting frame only; thumb identity requires source surface and visual landmarks.', 'Low-weight wrist/palm context is included for inspection, never reassigned or deformed.'] };
}

async function skinGeometry(rig, sharp) {
  const material = rig.json.materials[0], textureRef = material.pbrMetallicRoughness.baseColorTexture;
  const img = rig.json.images[rig.json.textures[textureRef.index].source], view = rig.json.bufferViews[img.bufferView];
  const { data, info } = await sharp(rig.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info, transform: textureRef.extensions?.KHR_texture_transform ?? {}, factor: material.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1] };
}
function meshDraw(rig, values, texture, triangles = null) {
  return { values, indices: triangles ?? rig.mesh.geometry.index.array, uv: rig.mesh.geometry.attributes.uv, texture };
}
// Orthographic, textured CPU triangle rasterizer: actual geometry/occlusion,
// not a browser/WebGL screenshot and not a production render approval.
async function raster(draws, sharp, { target, direction, up = new THREE.Vector3(0, 1, 0), half = .15, size = 720, labels = [] }) {
  const zaxis = direction.clone().normalize(), xaxis = new THREE.Vector3().crossVectors(up, zaxis).normalize(), yaxis = new THREE.Vector3().crossVectors(zaxis, xaxis);
  const project = p => { const v = p.clone().sub(target); return { x: size / 2 + v.dot(xaxis) * size / (2 * half), y: size / 2 - v.dot(yaxis) * size / (2 * half), z: v.dot(zaxis) }; };
  const pixels = Buffer.alloc(size * size * 3), depths = new Float64Array(size * size).fill(-Infinity);
  for (let i = 0; i < pixels.length; i += 3) { pixels[i] = 205; pixels[i + 1] = 211; pixels[i + 2] = 192; }
  const light = new THREE.Vector3(.35, .8, .6).normalize(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3();
  for (const draw of draws) {
    const projected = []; for (let i = 0; i < draw.values.length; i += 3) projected.push(project(new THREE.Vector3().fromArray(draw.values, i)));
    for (let t = 0; t < draw.indices.length; t += 3) {
      const ids = Array.from(draw.indices.slice(t, t + 3)), [a, b, c] = ids.map(i => projected[i]);
      const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); if (Math.abs(area) < 1e-7) continue;
      const normal = b3.fromArray(draw.values, ids[1] * 3).sub(a3.fromArray(draw.values, ids[0] * 3)).cross(c3.fromArray(draw.values, ids[2] * 3).sub(a3)).normalize();
      const shade = .66 + .34 * Math.max(0, normal.dot(light));
      for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))); y <= Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y))); y++) for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))); x <= Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x))); x++) {
        const wb = ((x + .5 - a.x) * (c.y - a.y) - (y + .5 - a.y) * (c.x - a.x)) / area, wc = ((b.x - a.x) * (y + .5 - a.y) - (b.y - a.y) * (x + .5 - a.x)) / area, wa = 1 - wb - wc;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const depth = wa * a.z + wb * b.z + wc * c.z, pixel = y * size + x; if (depth <= depths[pixel]) continue; depths[pixel] = depth;
        let color = draw.color ?? [.65, .7, .72];
        if (draw.texture) {
          const uv = draw.uv, tex = draw.texture, tr = tex.transform, sc = tr.scale ?? [1, 1], off = tr.offset ?? [0, 0], r = tr.rotation ?? 0;
          const u0 = wa * uv.getX(ids[0]) + wb * uv.getX(ids[1]) + wc * uv.getX(ids[2]), v0 = wa * uv.getY(ids[0]) + wb * uv.getY(ids[1]) + wc * uv.getY(ids[2]);
          const u = off[0] + Math.cos(r) * u0 * sc[0] - Math.sin(r) * v0 * sc[1], v = off[1] + Math.sin(r) * u0 * sc[0] + Math.cos(r) * v0 * sc[1];
          const tx = THREE.MathUtils.clamp(Math.floor(u * tex.info.width), 0, tex.info.width - 1), ty = THREE.MathUtils.clamp(Math.floor(v * tex.info.height), 0, tex.info.height - 1);
          const at = (ty * tex.info.width + tx) * tex.info.channels; color = [0, 1, 2].map(k => tex.data[at + k] / 255 * tex.factor[k]);
        }
        for (let k = 0; k < 3; k++) pixels[pixel * 3 + k] = Math.round(color[k] * 255 * shade);
      }
    }
  }
  let result = sharp(pixels, { raw: { width: size, height: size, channels: 3 } });
  if (labels.length) {
    const svg = `<svg width="${size}" height="${size}">${labels.map(({ p, text }) => { const c = project(p); return `<circle cx="${c.x}" cy="${c.y}" r="2" fill="#f0e547"/><text x="${c.x + 3}" y="${c.y - 3}" font-size="11" fill="#10292d" stroke="#fff" stroke-width=".3">${text}</text>`; }).join('')}</svg>`;
    result = result.composite([{ input: Buffer.from(svg) }]);
  }
  return result.png().toBuffer();
}
async function inspect(family, deps) {
  const ctx = await inputs(family), evidence = inspectRoleHand(ctx.rig, ctx.adapter, ctx.role.side), sharp = packingDependencies(deps ?? ctx.qa.dependencies.helperProject).sharp;
  const texture = await skinGeometry(ctx.rig, sharp), values = worldVertices(ctx.rig), matrix = new THREE.Matrix4().fromArray(evidence.matrix);
  const axis = v => v.applyMatrix4(matrix).sub(new THREE.Vector3().setFromMatrixPosition(matrix));
  const center = vec([0, .085, 0]).applyMatrix4(matrix), isolated = evidence.triangles.flatMap(t => t.vertices);
  const labels = evidence.records.map(r => ({ p: vec(r.world), text: r.id }));
  const pictures = [];
  for (const [name, direction] of [['palm', axis(vec([0, 0, 1]))], ['back', axis(vec([0, 0, -1]))], ['thumb-side-a', axis(vec([1, 0, .3]))], ['thumb-side-b', axis(vec([-1, 0, .3]))]]) {
    pictures.push(await save(`${family}/source-${name}.png`, await raster([meshDraw(ctx.rig, values, texture, isolated)], sharp,
      { target: center, direction, up: axis(vec([0, 1, 0])), half: .13, labels })));
    await save(`${family}/source-${name}-clean.png`, await raster([meshDraw(ctx.rig, values, texture, isolated)], sharp,
      { target: center, direction, up: axis(vec([0, 1, 0])), half: .13 }));
  }
  const report = { ...evidence, family, pins: ctx.pins, rawPins: ctx.rawPins, baselineWitnesses: ctx.witnesses, pictures,
    sourcePreview: 'Windowless CPU close-up of actual source skin. Only the inspected hand neighborhood is drawn; source images do not establish runtime clearance.' };
  const receipt = await save(`${family}/source-hand-evidence.json`, report);
  return { family, receipt, centroid: evidence.fullyHandWeightedCentroid, points: evidence.records.length, triangles: evidence.triangles.length };
}

export function surfaceAnchor(rig, evidence, triangleID, barycentric = [1 / 3, 1 / 3, 1 / 3]) {
  const t = evidence.triangles.find(t => t.triangle === triangleID);
  if (!t || !Array.isArray(barycentric) || barycentric.length !== 3 || barycentric.some(v => !Number.isFinite(v) || v < 0) || Math.abs(barycentric.reduce((a, b) => a + b, 0) - 1) > 1e-8) throw Error('Anchor must be on the actual indexed hand surface');
  const values = worldVertices(rig), points = t.vertices.map(i => new THREE.Vector3().fromArray(values, i * 3));
  const p = points.reduce((s, p, i) => s.addScaledVector(p, barycentric[i]), new THREE.Vector3());
  const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  const plot = new THREE.Matrix4().fromArray(evidence.matrix).invert(), local = p.clone().applyMatrix4(plot);
  if (local.y < .025 || local.y > .095 || p.distanceTo(new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(evidence.matrix))) > .12) throw Error('Proximal palm/web anchor cannot be distal-finger centroid');
  return { triangle: triangleID, vertices: t.vertices, barycentric, point: p, normal, plot: local.toArray(), weights: t.records.map(id => evidence.records[id].handWeight) };
}
export function roleSocket({ rig, evidence, part, palm, web, ulnar, shaftSign = 1, tilt = 0, planeRoll = 0, clearance = .002 }) {
  if (![1, -1].includes(shaftSign) || !Number.isFinite(tilt) || Math.abs(tilt) > .36 || !Number.isFinite(planeRoll) || Math.abs(planeRoll) > Math.PI || !(clearance >= .001 && clearance <= .005)) throw Error('Unbounded socket choice');
  const plot = new THREE.Matrix4().fromArray(evidence.matrix), palmFacing = new THREE.Vector3(0, 0, 1).transformDirection(plot);
  const normal = palm.normal.clone(); if (normal.dot(palmFacing) < 0) normal.negate();
  const shaft = web.point.clone().sub(ulnar).addScaledVector(normal, -web.point.clone().sub(ulnar).dot(normal)).normalize().multiplyScalar(shaftSign);
  if (shaft.length() < .99) throw Error('Ambiguous web-to-ulnar shaft');
  shaft.multiplyScalar(Math.cos(tilt)).addScaledVector(normal, Math.sin(tilt)).normalize();
  let rotation;
  if (part === 'bow') {
    const radial = normal.clone().addScaledVector(shaft, -normal.dot(shaft)).normalize().applyAxisAngle(shaft, planeRoll);
    rotation = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(shaft, radial).normalize(), shaft, radial);
  } else {
    // +X is the ACTUAL thin cutting edge in blade.js; -X remains the spine.
    // For hammer this is only its transverse head-width direction.
    const edge = new THREE.Vector3(0, 1, 0).transformDirection(plot).addScaledVector(shaft, -new THREE.Vector3(0, 1, 0).transformDirection(plot).dot(shaft)).normalize().applyAxisAngle(shaft, planeRoll);
    rotation = new THREE.Matrix4().makeBasis(edge, new THREE.Vector3().crossVectors(shaft, edge).normalize(), shaft);
  }
  const radius = { hammer: .022, bow: .016, knife: .014 }[part]; if (!radius) throw Error('Unsupported owned prop');
  const legacy = vec(legacyGripForPart(part)), geometry = GEAR_PARTS.find(p => p.name === part).geo(), p = geometry.attributes.position;
  let actualSupportRadius = 0;
  try {
    const indices = geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i), axis = part === 'bow' ? 'y' : 'z';
    for (let i = 0; i < indices.length; i += 3) {
      const points = Array.from(indices.slice(i, i + 3)).map(j => new THREE.Vector3().fromBufferAttribute(p, j));
      if (part === 'hammer' && points.every(p => p.z >= .3499) || part === 'knife' && points.every(p => p.z >= .1099)) continue;
      for (const [a, b] of [[points[0], points[1]], [points[1], points[2]], [points[2], points[0]]]) {
        if (Math.abs(b[axis] - a[axis]) < 1e-9) continue;
        const t = (legacy[axis] - a[axis]) / (b[axis] - a[axis]); if (t < 0 || t > 1) continue;
        const radial = a.clone().lerp(b, t).sub(legacy); radial[axis] = 0;
        actualSupportRadius = Math.max(actualSupportRadius, -radial.applyMatrix4(rotation).dot(normal));
      }
    }
  } finally { geometry.dispose(); }
  if (!(actualSupportRadius > .009 && actualSupportRadius < .023)) throw Error('Actual unchanged handle section required');
  const center = palm.point.clone().addScaledVector(normal, actualSupportRadius + clearance);
  const world = rotation.clone().setPosition(center.clone().sub(legacy.clone().applyMatrix4(rotation)));
  const socket = affine(rig.names.get(evidence.bone).matrixWorld.clone().invert().multiply(world));
  const error = legacy.clone().applyMatrix4(world).distanceTo(center); if (error > 1e-9) throw Error('Legacy handle pivot moved');
  return { socket: { bone: evidence.bone, matrix: socket.toArray() }, center, normal, shaft, world,
    parameters: { shaftSign, tilt, planeRoll, clearance }, legacyGrip: legacy.toArray(), radius, actualSupportRadius, pivotError: error };
}
function anchorAt(values, anchor) { return anchor.vertices.reduce((s, i, k) => s.addScaledVector(new THREE.Vector3().fromArray(values, i * 3), anchor.barycentric[k]), new THREE.Vector3()); }
function movingPalmTarget(values, palm, referenceNormal, radiusAndClearance) {
  const points = palm.vertices.map(i => new THREE.Vector3().fromArray(values, i * 3));
  const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  if (normal.dot(referenceNormal) < 0) normal.negate();
  return anchorAt(values, palm).addScaledVector(normal, radiusAndClearance);
}
function transformedProp(geometry, matrix, color) {
  const p = geometry.attributes.position, values = new Float64Array(p.count * 3);
  for (let i = 0; i < p.count; i++) new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix).toArray(values, i * 3);
  return { values, indices: geometry.index?.array ?? Uint32Array.from({ length: p.count }, (_, i) => i), color };
}
function propTriangles(draw, geometry, part, excludeGrip = false) {
  const p = geometry.attributes.position, triangles = [], legacy = vec(legacyGripForPart(part));
  for (let i = 0; i < draw.indices.length; i += 3) {
    const ids = Array.from(draw.indices.slice(i, i + 3));
    if (excludeGrip) {
      if (part === 'knife' && ids.every(j => p.getZ(j) <= .11001)) continue;
      if (part === 'hammer' && ids.some(j => p.getZ(j) < .3499)) continue;
      if (part === 'bow' && ids.some(j => new THREE.Vector3().fromBufferAttribute(p, j).distanceTo(legacy) < .075)) continue;
    }
    const t = new THREE.Triangle(...ids.map(j => new THREE.Vector3().fromArray(draw.values, j * 3)));
    triangles.push({ triangle: t, box: new THREE.Box3().setFromPoints([t.a, t.b, t.c]) });
  }
  return triangles;
}
function nearestSurface(p, triangles) {
  const q = new THREE.Vector3(); let distance = Infinity;
  for (const t of triangles) distance = Math.min(distance, t.triangle.closestPointToPoint(p, q).distanceTo(p));
  return distance;
}
function segmentCrosses(a, b, triangle) {
  const d = b.clone().sub(a), length = d.length(); if (length < 1e-10) return false;
  const hit = new THREE.Ray(a, d.divideScalar(length)).intersectTriangle(triangle.a, triangle.b, triangle.c, false, new THREE.Vector3());
  return hit !== null && hit.distanceTo(a) > 1e-7 && hit.distanceTo(a) < length - 1e-7;
}
function intersectionCounts(rig, values, prop, geometry, part) {
  const propFaces = propTriangles(prop, geometry, part, true), indices = rig.mesh.geometry.index.array, selected = new Set(), skin = rig.mesh.geometry.attributes;
  let heldHand = 0, otherHand = 0, forearm = 0, remaining = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const ids = Array.from(indices.slice(i, i + 3)), points = ids.map(j => new THREE.Vector3().fromArray(values, j * 3)), box = new THREE.Box3().setFromPoints(points), body = new THREE.Triangle(...points);
    for (const { triangle: t, box: b } of propFaces) {
      if (!box.intersectsBox(b)) continue;
      if (![[body.a, body.b], [body.b, body.c], [body.c, body.a]].some(([a, b]) => segmentCrosses(a, b, t)) && ![[t.a, t.b], [t.b, t.c], [t.c, t.a]].some(([a, b]) => segmentCrosses(a, b, body))) continue;
      selected.add(i / 3); break;
    }
  }
  const side = ROLES[part === 'hammer' ? 'enhancer' : part === 'bow' ? 'master_hunter' : 'master_bandit'].side;
  const held = side === 'left' ? 'LeftHand' : 'RightHand', other = side === 'left' ? 'RightHand' : 'LeftHand';
  for (const t of selected) {
    const weights = {};
    for (const j of indices.slice(t * 3, t * 3 + 3)) for (let k = 0; k < 4; k++) {
      const name = rig.mesh.skeleton.bones[skin.skinIndex.getComponent(j, k)].name;
      weights[name] = (weights[name] ?? 0) + skin.skinWeight.getComponent(j, k) / 3;
    }
    if ((weights[held] ?? 0) >= .45) heldHand++;
    else if ((weights[other] ?? 0) >= .45) otherHand++;
    else if ((weights.LeftForeArm ?? 0) + (weights.RightForeArm ?? 0) >= .45) forearm++;
    else remaining++;
  }
  return { triangleCrossings: selected.size, heldHand, otherHand, forearm, remaining, triangles: [...selected],
    scope: 'Actual indexed triangles crossing blade/head/noncentral bow surface; excludes handle support zone. Coplanar and fully contained overlaps are not certified.' };
}
async function runtime(ctx, profile) {
  const def = NPCS.find(n => n.id === ctx.plan.roles[0].id), npc = new NPC(def, makeLook(def), {}), errors = [], scene = new THREE.Scene();
  Object.assign(npc, { shown: true, dirty: true, x: 0, y: 0, z: 0, yaw: 0, distance: 0, seed: npc.seed });
  const options = { ...profile, assetSha256: ctx.rig.sha256, geometryAssetSha256: ctx.rig.sha256, qaApproved: true, revision: NPC_MODELS[ctx.family].revision };
  const renderer = new NPCModelRenderer(scene, [npc], { loadModel: () => ({ ...ctx.rig.gltf, assetSha256: ctx.rig.sha256 }),
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, profile.calibration, options), onError: (_s, e) => errors.push(e.message) });
  await renderer.ready; const entry = renderer.entries.get(npc); if (!entry?.model) throw Error('Renderer failed: ' + errors.join(';'));
  let mesh; entry.model.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  const posedRig = { gltf: { scene }, mesh };
  return { npc, renderer, entry, posedRig, sample(state, anim, time) {
    npc.release(); npc.path = null; npc.state = state; npc.anim = anim; npc.carrying = false;
    if (state === 'talk') npc.talkTarget = { x: 0, z: 1 };
    if (state === 'walk') { const clip = ctx.rig.gltf.animations.find(c => c.name === anim); npc.walkPhase = time / clip.duration * 2 * Math.PI; }
    npc.animate(time, 0, state, anim); renderer.update(0, time);
    if (!entry.active || errors.length || !entry.visibleParts.has(ctx.role.part)) throw Error('Actual native/prop adapter inactive: ' + errors.join(';'));
    return { values: worldVertices(posedRig), matrix: npc.frames[NPC_PROP_FRAMES[ctx.role.part]].clone(),
      time, state, anim, clip: entry.phase, clipTime: entry.actions[entry.phase].time, seed: npc.seed, active: entry.active };
  }, dispose() { renderer.dispose(); } };
}
async function fit(family, guideFile, deps) {
  const ctx = await inputs(family), guidePath = path.resolve(ROOT, guideFile), guideBytes = await readFile(guidePath), guide = json(guideBytes);
  if (guide.family !== family || guide.bodySha256 !== ctx.rig.sha256 || guide.adapterSha256 !== ctx.pins.adapter.sha256 || !guide.reason) throw Error('Source-pinned authored landmarks required');
  const evidence = inspectRoleHand(ctx.rig, ctx.adapter, ctx.role.side), palm = surfaceAnchor(ctx.rig, evidence, guide.palmTriangle, guide.palmBarycentric), web = surfaceAnchor(ctx.rig, evidence, guide.webTriangle, guide.webBarycentric);
  const ulnarRecord = evidence.records.find(r => r.vertex === guide.ulnarVertex); if (!ulnarRecord) throw Error('Ulnar landmark absent');
  const socket = roleSocket({ rig: ctx.rig, evidence, part: ctx.role.part, palm, web, ulnar: vec(ulnarRecord.world), ...(guide.parameters ?? {}) });
  // The true proximal palm has mixed weights. Seat this fixed socket on its
  // ACTUAL primary-role surface, rather than pretending it moves rigidly with
  // the Hand bone. Other phases retain explicit drift diagnostics.
  const placement = await runtime(ctx, ctx.originalProfile);
  let primaryPlacement;
  try {
    const sample = placement.sample(ctx.role.state, ctx.role.anim, .5), bone = placement.posedRig.mesh.skeleton.bones.find(b => b.name === evidence.bone);
    const motion = bone.matrixWorld.clone().multiply(ctx.rig.names.get(evidence.bone).matrixWorld.clone().invert());
    const target = movingPalmTarget(sample.values, palm, socket.normal.clone().transformDirection(motion), socket.actualSupportRadius + socket.parameters.clearance);
    const localTarget = target.clone().applyMatrix4(bone.matrixWorld.clone().invert()), matrix = new THREE.Matrix4().fromArray(socket.socket.matrix);
    const rotation = matrix.clone().setPosition(0, 0, 0), origin = localTarget.clone().sub(vec(socket.legacyGrip).applyMatrix4(rotation));
    matrix.setPosition(origin); socket.socket.matrix = affine(matrix).toArray();
    socket.center = localTarget.clone().applyMatrix4(ctx.rig.names.get(evidence.bone).matrixWorld);
    socket.pivotError = vec(socket.legacyGrip).applyMatrix4(matrix).distanceTo(localTarget);
    primaryPlacement = { state: ctx.role.state, anim: ctx.role.anim, time: .5, seed: sample.seed, clip: sample.clip, clipTime: sample.clipTime,
      measuredPalmTargetWorld: target.toArray(), measuredPalmTargetHandLocal: localTarget.toArray(),
      actualPalmSurfaceWorld: anchorAt(sample.values, palm).toArray(), reason: 'Actual primary-role mixed-weight proximal surface, not a rigid Hand centroid or a source-mesh deformation' };
  } finally { placement.dispose(); }
  const frame = NPC_PROP_FRAMES[ctx.role.part], profile = structuredClone(ctx.originalProfile);
  Object.assign(profile, { revision: `${family}-role-contact-v1`, assetSha256: ctx.rig.sha256, geometryAssetSha256: ctx.rig.sha256,
    qaApproved: false, qa: { art: false, runtime: false }, inspectionOnly: true, productionApproved: false });
  profile.sockets[frame] = socket.socket;
  profile.inspectionProvenance = { sourceSHA256: ctx.rig.sha256, socketOnly: true, sourceProfileSHA256: ctx.pins.catalog.sha256, authoredGuideSHA256: sha256(guideBytes), contactVisualApproved: false };
  if (profile.grips[frame].contact.some((v, i) => v !== socket.legacyGrip[i])) throw Error('Legacy grip differs');
  const sharp = packingDependencies(deps ?? ctx.qa.dependencies.helperProject).sharp, texture = await skinGeometry(ctx.rig, sharp);
  const geometry = GEAR_PARTS.find(p => p.name === ctx.role.part).geo(), color = new THREE.Color(GEAR_PARTS.find(p => p.name === ctx.role.part).color(makeLook(NPCS.find(n => n.id === ctx.plan.roles[0].id)))).convertLinearToSRGB().toArray();
  const receipts = [], captures = [], phases = [[ctx.role.state, ctx.role.anim], ['idle', 'rest'], ['talk', 'talk'], ['walk', 'walk'], ['walk', 'run']];
  try {
    for (const [version, p] of [['baseline', ctx.originalProfile], ['candidate', profile]]) {
      const rt = await runtime(ctx, p);
      try {
        for (const [state, anim] of phases) for (const time of [.25, .5, .75]) {
          const sample = rt.sample(state, anim, time), draw = transformedProp(geometry, sample.matrix, color), support = anchorAt(sample.values, palm), webPoint = anchorAt(sample.values, web);
          const faces = propTriangles(draw, geometry, ctx.role.part), intersections = intersectionCounts(ctx.rig, sample.values, draw, geometry, ctx.role.part);
          const bone = rt.posedRig.mesh.skeleton.bones.find(b => b.name === evidence.bone), motion = bone.matrixWorld.clone().multiply(ctx.rig.names.get(evidence.bone).matrixWorld.clone().invert());
          const referenceNormal = socket.normal.clone().transformDirection(motion), actualPalmTarget = movingPalmTarget(sample.values, palm, referenceNormal, socket.actualSupportRadius + socket.parameters.clearance);
          const legacyCenter = vec(socket.legacyGrip).applyMatrix4(sample.matrix);
          const rigidTarget = socket.center.clone().applyMatrix4(motion);
          receipts.push({ version, state, anim, time, seed: sample.seed, clip: sample.clip, clipTime: sample.clipTime, active: true,
            actualPalmToPropSurface: nearestSurface(support, faces), actualWebToPropSurface: nearestSurface(webPoint, faces),
            palmWorld: support.toArray(), webWorld: webPoint.toArray(), legacyHandleWorld: legacyCenter.toArray(), actualPalmTargetWorld: actualPalmTarget.toArray(),
            realPalmTargetError: actualPalmTarget.distanceTo(legacyCenter), rigidAuthoredTargetError: rigidTarget.distanceTo(legacyCenter), intersections });
          if (state === ctx.role.state && anim === ctx.role.anim && time === .5) {
            const handBone = rt.posedRig.mesh.skeleton.bones.find(b => b.name === evidence.bone), restBone = ctx.rig.names.get(evidence.bone);
            const motion = handBone.matrixWorld.clone().multiply(restBone.matrixWorld.clone().invert());
            const plot = motion.multiply(new THREE.Matrix4().fromArray(evidence.matrix)), axis = a => vec(a).transformDirection(plot);
            const target = support.clone().lerp(webPoint, .2), draws = [meshDraw(ctx.rig, sample.values, texture), draw];
            for (const [name, direction, up] of [['palm', axis([0, 0, 1]), axis([0, 1, 0])], ['thumb-oblique', axis([guide.thumbSide, .15, 1]), axis([0, 1, 0])], ['side', axis([guide.thumbSide, .05, .1]), axis([0, 1, 0])], ['back', axis([0, 0, -1]), axis([0, 1, 0])]]) {
              const pin = await save(`${family}/${version}-${state}-${anim}-0_5-${name}.png`, await raster(draws, sharp, { target, direction, up, half: .16 })); captures.push({ ...pin, version, state, anim, time, name, bodySha256: ctx.rig.sha256, source: 'CPU raster of full actual production-adapter pose + unchanged legacy prop; normal occlusion retained' });
            }
            const pin = await save(`${family}/${version}-${state}-${anim}-0_5-gameplay.png`, await raster(draws, sharp, { target: vec([0, .86, 0]), direction: vec([.8, 1.2, 1]), half: 1.14 }));
            captures.push({ ...pin, version, state, anim, time, name: 'gameplay', bodySha256: ctx.rig.sha256, source: 'CPU near-orthographic diagnostic; parent browser camera still required' });
          }
        }
      } finally { rt.dispose(); }
    }
  } finally { geometry.dispose(); }
  restoreRest(ctx.rig);
  const summarize = version => {
    const r = receipts.filter(r => r.version === version); return { samples: r.length, maxPalmSurfaceGap: Math.max(...r.map(r => r.actualPalmToPropSurface)),
      maxRealPalmTargetError: Math.max(...r.map(r => r.realPalmTargetError)), maxRigidAuthoredTargetError: Math.max(...r.map(r => r.rigidAuthoredTargetError)),
      maxWebSurfaceGap: Math.max(...r.map(r => r.actualWebToPropSurface)), maxNonGripCrossings: Math.max(...r.map(r => r.intersections.triangleCrossings)),
      roleAtHalf: r.find(r => r.state === ctx.role.state && r.anim === ctx.role.anim && r.time === .5) };
  };
  const report = { schema: 1, family, status: 'SOCKET_CANDIDATE_REQUIRES_PARENT_CAPTURE_AND_ART_REVIEW', productionApproved: false, visualApproved: false,
    workflow: { director: 'GRASP_FINAL.md scoped socket directions', specialist: 'Source surface landmarks and rigid legacy-prop fit only', artTech: 'Self-review: source anatomy unchanged; actual legacy tool coordinates, positive rigid determinant; no independent pass', qa: 'Windowless actual NPCModelRenderer/adapter sampled diagnostic; parent owns browser and full gates' },
    pins: ctx.pins, rawPins: ctx.rawPins, runtimePins: ctx.runtimePins, baselineWitnesses: ctx.witnesses, guide: { path: guidePath, sha256: sha256(guideBytes) },
    bodyUnchanged: true, rawSourcesUnchanged: true, legacyPropGeometryUnchanged: true, profileFields: { sockets: { [frame]: socket.socket } },
    landmarks: { reason: guide.reason, palm: { ...palm, point: palm.point.toArray(), normal: palm.normal.toArray() }, web: { ...web, point: web.point.toArray(), normal: web.normal.toArray() },
      ulnar: ulnarRecord, fullyHandWeightedCentroid: evidence.fullyHandWeightedCentroid, thumbIdentity: 'Visually authored branch side on actual source; no all-five-digit certification' },
    fit: { parameters: socket.parameters, legacyGrip: socket.legacyGrip, actualSupportRadius: socket.actualSupportRadius, pivotError: socket.pivotError, center: socket.center.toArray(), outwardSurfaceNormal: socket.normal.toArray(), primaryPlacement,
      measuredPalmTargetHandLocal: socket.center.clone().applyMatrix4(ctx.rig.names.get(evidence.bone).matrixWorld.clone().invert()).toArray(),
      actualPalmSurfaceHandLocal: palm.point.clone().applyMatrix4(ctx.rig.names.get(evidence.bone).matrixWorld.clone().invert()).toArray(),
      actualWebSurfaceHandLocal: web.point.clone().applyMatrix4(ctx.rig.names.get(evidence.bone).matrixWorld.clone().invert()).toArray(),
      realTargetCheck: 'Re-skin exact palm triangle, reconstruct outward normal, add inspected legacy radius + clearance, compare to actual legacy handle center. rigidAuthoredTargetError separately checks socket equality, never anatomical acceptance.',
      shaftWorld: socket.shaft.toArray(), determinant: new THREE.Matrix4().fromArray(socket.socket.matrix).determinant(), cuttingEdge: ctx.role.part === 'knife' ? 'legacy +X; spine -X; actual blade.js geometry retained' : null },
    numericDiagnostic: { baseline: summarize('baseline'), candidate: summarize('candidate'), receipts }, captures,
    limits: ['Socket placement does not close source fingers or create thumb opposition.', 'Mixed Hand/ForeArm weights on true proximal palm can cause support drift under wrist motion; ownership is not edited.',
      'CPU textured previews preserve full body/prop occlusion but are not browser screenshots, independent Art approval or final textile QA.',
      'Fifteen bounded actual pose samples per variant do not certify continuous motion, hidden collision, all-family release, service/city/mobile/night QA.',
      'Triangle crossings detect transverse surface intersections only; coplanar and fully contained overlaps require fresh visual inspection.'] };
  const sourceProfilePin = await save(`${family}/source-profile.json`, ctx.originalProfile);
  const profilePin = await save(`${family}/preview-profile.json`, profile);
  report.previewProfile = profilePin;
  report.sourceProfile = sourceProfilePin;
  report.parentCapture = { family, npc: ctx.plan.roles[0].id, mode: 'registry', adapter: `/artifacts/grip-fits/role-contacts/${family}/preview-adapter.js`,
    source: `/artifacts/city-npc-models/${family}/${family}.glb`, assetSha256: ctx.rig.sha256,
    witness: { id: ctx.plan.roles[0].id, state: ctx.role.state, anim: ctx.role.anim, carrying: false }, timesSeconds: [.25, .5, .75],
    details: [{ kind: 'hand', side: ctx.role.side, angle: 'front' }, { kind: 'hand', side: ctx.role.side, angle: 'back' }, { kind: 'hand', side: ctx.role.side, angle: 'side' }, { kind: 'prop', part: ctx.role.part, angle: 'front' }, { kind: 'prop', part: ctx.role.part, angle: 'side' }],
    bodyViews: ['front', 'back', 'side', 'threequarter', 'gameplay'], restore: 'Dispose isolated renderer/cache and roleContactInspection before importing another hook; hook removes its own adapter and restores shared cache methods.' };
  report.previewAdapter = await save(`${family}/preview-adapter.js`, Buffer.from(previewHook(family, profilePin.sha256, ctx.rig.sha256, sourceProfilePin.sha256)));
  for (const pin of [...Object.values(ctx.pins), ...Object.values(ctx.rawPins), ...ctx.runtimePins, ...ctx.witnesses]) if (sha256(await readFile(pin.path)) !== pin.sha256) throw Error(`Input changed during fit: ${pin.path}`);
  const reportPin = await save(`${family}/role-contact-fit.json`, report);
  return { family, status: report.status, profile: profilePin, report: reportPin, baseline: summarize('baseline'), candidate: summarize('candidate'), productionApproved: false };
}
function previewHook(family, profileHash, bodyHash, baselineHash) {
  return `// Page-local, reversible inspection only. Never approves a production profile.\nconst FAMILY=${JSON.stringify(family)},PROFILE_SHA=${JSON.stringify(profileHash)},BODY_SHA=${JSON.stringify(bodyHash)},BASELINE_SHA=${JSON.stringify(baselineHash)};\nconst coreUrl=performance.getEntriesByType('resource').map(r=>r.name).filter(url=>new URL(url).pathname==='/src/npc/NPCModels.js').at(-1)??'/src/npc/NPCModels.js';\nconst core=await import(/* @vite-ignore */ coreUrl);\nif(globalThis.roleContactInspection&&!globalThis.roleContactInspection.disposed)throw Error('Dispose previous role contact inspection first');\nasync function pinned(name,expected){const response=await fetch('/artifacts/grip-fits/role-contacts/'+FAMILY+'/'+name);if(!response.ok)throw Error('Role inspection profile missing');const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('Role profile hash differs');return JSON.parse(new TextDecoder().decode(bytes));}\nconst profile=await pinned('preview-profile.json',PROFILE_SHA),baseline=await pinned('source-profile.json',BASELINE_SHA);\nif(profile.family!==FAMILY||profile.assetSha256!==BODY_SHA||profile.qaApproved!==false||profile.productionApproved!==false)throw Error('Inspection identity/approval differs');\nconst originalLoad=core.npcModelCache.load.bind(core.npcModelCache),originalDispose=core.npcModelCache.dispose.bind(core.npcModelCache);\nconst cache=core.createNPCModelCache(url=>core.loadNPCModelSource(url,{expectedAssetSha256:BODY_SHA}));\nconst unregister=core.registerNPCPoseAdapter(FAMILY,(model,c)=>{if(c.source?.assetSha256!==BODY_SHA)throw Error('Wrong role source');return core.createMeshy24NPCPoseAdapter(model,c,profile.calibration,{...profile,qaApproved:true,revision:core.NPC_MODELS[FAMILY].revision});});\nconst inspectionLoad=spec=>spec.family===FAMILY?cache.load({...spec,url:'artifacts/city-npc-models/'+FAMILY+'/'+FAMILY+'.glb',revision:profile.revision,assetSha256:BODY_SHA}):originalLoad(spec);\nlet disposed=false;\nconst dispose=()=>{if(disposed)return;disposed=true;cache.dispose();unregister();core.registerNPCModelProfiles({schema:1,families:[baseline]});if(core.npcModelCache.load===inspectionLoad)core.npcModelCache.load=originalLoad;if(core.npcModelCache.dispose===inspectionDispose)core.npcModelCache.dispose=originalDispose;};\nconst inspectionDispose=()=>{dispose();originalDispose();};\ncore.npcModelCache.load=inspectionLoad;core.npcModelCache.dispose=inspectionDispose;\nglobalThis.roleContactInspection={family:FAMILY,assetSha256:BODY_SHA,profileSha256:PROFILE_SHA,coreModuleUrl:coreUrl,productionApproved:false,visualApproved:false,dispose,get disposed(){return disposed;},get privateCacheSize(){return cache.size;}};\n`;
}

async function main(argv) {
  const [mode, ...rest] = argv, options = {};
  for (let i = 0; i < rest.length; i += 2) { const k = rest[i]?.slice(2); if (!['family', 'deps', 'guide'].includes(k) || !rest[i + 1] || options[k]) throw Error('Invalid option'); options[k] = rest[i + 1]; }
  if (mode === 'inspect') {
    for (const f of options.family ? options.family.split(',') : Object.keys(ROLES)) console.log(JSON.stringify(await inspect(f, options.deps)));
  } else if (mode === 'fit' && options.family && options.guide) console.log(JSON.stringify(await fit(options.family, options.guide, options.deps)));
  else throw Error('Usage: fit-role-contacts.mjs inspect [--family enhancer,master_hunter,master_bandit] | fit --family FAMILY --guide artifacts/grip-fits/role-contacts/FAMILY/landmarks.json [--deps EXISTING_PROJECT]');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
