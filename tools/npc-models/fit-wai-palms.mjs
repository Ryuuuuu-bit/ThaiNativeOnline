// Offline measurement only: no model, native clip, profile, or runtime writes.
// Inspect the exact textured surfaces before authoring semantic surface anchors.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THREE, loadRig, restoreRest, worldVertices } from './rig.mjs';
import { sha256 } from './glb.mjs';
import { packingDependencies } from './prepare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = path.join(ROOT, 'artifacts/city-npc-models/wai-palms');
const ROOT_PINS = Object.freeze({
  monk_elder: '20357680875252c883bcb4fbb5681ce10d8f5d3d1cd2a8338162693d5427e236',
  monk_novice: '36e7bf4488129894cb7cc71d52ee131ff6a3d158f447f31f5d10fde464e6e6f5',
});
// Surface semantics are authored from the source PNGs, never inferred from PCA
// or from a fully-Hand-weight centroid. Vertex IDs address the exact packed root.
const LANDMARKS = Object.freeze({
  monk_elder: {
    left: { patch: [11484, 11485, 11486, 11493], anchor: 11486, wrist: 12601,
      mcp: [12617, 12618], thumbTip: 13413, thumbRoot: 13059, web: 13263,
      note: 'Palmar heel/central proximal surface; thumb is the lateral short digit with a nail and thenar crease. Web is the concave thumb-index notch.' },
    right: { patch: [299, 300, 387], anchor: 300, wrist: 429,
      mcp: [112, 113], thumbTip: 63, thumbRoot: 407, web: 272,
      note: 'Central palmar heel, excluding the steep distal hollow and finger fronts; radial thumb/index notch shown from the thumb side.' },
  },
  monk_novice: {
    left: { patch: [11707, 11708, 11712, 11722, 11723], anchor: 11712, wrist: 12727,
      mcp: [12757, 12754], thumbTip: 12911, thumbRoot: 12766, web: 12933,
      note: 'Visible thenar/central palmar heel; short lateral thumb and concave thumb/index cleft, not a long finger or PCA across axis.' },
    right: { patch: [494, 495, 496, 497], anchor: 494, wrist: 562,
      mcp: [475, 477], thumbTip: 258, thumbRoot: 333, web: 468,
      note: 'Palmar heel adjoining the wrist crease; thumb is the short separate radial digit. Dorsal opposite view shows the back of the hand.' },
  },
});
const v = a => new THREE.Vector3(...a);
const mean = p => p.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(p.length);
const json = b => JSON.parse(b.toString('utf8'));
async function save(relative, bytes) {
  const target = path.resolve(OUTPUT, relative);
  if (!target.startsWith(OUTPUT + path.sep)) throw Error('Output escapes wai-palms');
  let ancestor = path.dirname(target);
  for (;;) {
    try {
      const actual = path.resolve(await realpath(ancestor), path.relative(ancestor, target));
      const allowed = path.join(await realpath(ROOT), 'artifacts/city-npc-models/wai-palms');
      if (!actual.startsWith(allowed + path.sep)) throw Error('Output junction escapes wai-palms');
      break;
    } catch (e) { if (e.code !== 'ENOENT') throw e; ancestor = path.dirname(ancestor); }
  }
  await mkdir(path.dirname(target), { recursive: true });
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(JSON.stringify(bytes, null, 2) + '\n');
  try { await writeFile(target, data, { flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST' || sha256(await readFile(target)) !== sha256(data)) throw e; }
  return { path: path.relative(ROOT, target).replaceAll('\\', '/'), sha256: sha256(data) };
}
async function inputs(family) {
  if (!ROOT_PINS[family]) throw Error('Only the two monks are owned');
  const base = path.join(ROOT, 'artifacts/city-npc-models', family);
  const files = { root: path.join(base, family + '.glb'), adapter: path.join(base, family + '-adapter.json'),
    qa: path.join(base, family + '-qa.json'), originalFreeze: path.join(base, 'freeze-receipt.json'),
    public: path.join(ROOT, 'public/models/npcs', family + '.glb') };
  const bytes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([k, f]) => [k, await readFile(f)])));
  const pins = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, { path: f, sha256: sha256(bytes[k]) }]));
  const rig = await loadRig(files.root), qa = json(bytes.qa), adapter = json(bytes.adapter), freeze = json(bytes.originalFreeze);
  if (rig.sha256 !== ROOT_PINS[family] || qa.sha256 !== rig.sha256) throw Error('Exact current preparation root pin changed');
  const rawPins = {};
  // Pin current derivative input AND original immutable provider sources.
  for (const [label, receipt] of [['preparedInputs', qa], ['originalMeshy', freeze]]) {
    rawPins[label] = {};
    for (const role of ['body', 'walk', 'run']) {
      const file = receipt.inputPaths[role], hash = sha256(await readFile(file));
      if (hash !== receipt.sources[role]) throw Error('Input lineage changed: ' + file);
      rawPins[label][role] = { path: file, sha256: hash };
    }
  }
  if (rig.mesh.skeleton.bones.length !== 24) throw Error('Expected actual Meshy24 skeleton');
  for (const side of ['left', 'right']) {
    const name = side === 'left' ? 'LeftHand' : 'RightHand', bone = rig.names.get(name);
    if (!bone || bone.matrixWorld.elements.some((n, i) => Math.abs(n - adapter.nodes[name].bindWorld[i]) > 2e-5)) throw Error('Adapter/rest Hand frame differs');
  }
  const delivered = await loadRig(files.public);
  for (const name of ['position', 'skinIndex', 'skinWeight', 'uv', 'normal']) {
    const a = rig.mesh.geometry.attributes[name], b = delivered.mesh.geometry.attributes[name];
    if (!a || !b || a.count !== b.count || a.itemSize !== b.itemSize) throw Error('Delivered geometry differs');
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++)
      if (a.getComponent(i, k) !== b.getComponent(i, k)) throw Error('Delivered ' + name + ' differs');
  }
  if (rig.mesh.geometry.index.array.some((n, i) => n !== delivered.mesh.geometry.index.array[i])) throw Error('Delivered indices differ');
  for (const [name, bone] of rig.names) {
    const b = delivered.names.get(name);
    if (!b || bone.matrixWorld.elements.some((n, i) => Math.abs(n - b.matrixWorld.elements[i]) > 1e-8)) throw Error('Delivered rest rig differs');
  }
  if (rig.gltf.animations.length !== delivered.gltf.animations.length) throw Error('Delivered native clips differ');
  for (let i = 0; i < rig.gltf.animations.length; i++) {
    const a = rig.gltf.animations[i], b = delivered.gltf.animations[i];
    if (a.name !== b.name || a.duration !== b.duration || a.tracks.length !== b.tracks.length) throw Error('Delivered native clips differ');
    for (let j = 0; j < a.tracks.length; j++) {
      const x = a.tracks[j], y = b.tracks[j];
      if (x.name !== y.name || x.times.length !== y.times.length || x.values.length !== y.values.length ||
          x.times.some((n, k) => n !== y.times[k]) || x.values.some((n, k) => n !== y.values[k])) throw Error('Delivered native track differs');
    }
  }
  return { family, rig, qa, adapter, pins, rawPins, deliveredGeometryAndRestIdentical: true };
}
function neighborhood(ctx, side) {
  const { rig, adapter } = ctx;
  restoreRest(rig);
  const name = side === 'left' ? 'LeftHand' : 'RightHand', bone = rig.names.get(name);
  const inverse = bone.matrixWorld.clone().invert(), wrist = bone.getWorldPosition(new THREE.Vector3());
  // Old axes are ONLY the initial inspection camera, never fitted measurements.
  const f = v(adapter.hands[side].fingersWorld).normalize(), p = v(adapter.hands[side].palmWorld).normalize();
  const across = new THREE.Vector3().crossVectors(f, p).normalize();
  const plotMatrix = new THREE.Matrix4().makeBasis(across, f, p).setPosition(wrist);
  const plotInverse = plotMatrix.clone().invert(), world = worldVertices(rig);
  const { skinIndex, skinWeight } = rig.mesh.geometry.attributes, joint = rig.mesh.skeleton.bones.indexOf(bone);
  const records = [], byPosition = new Map(), vertexRecord = new Map();
  for (let i = 0; i < world.length / 3; i++) {
    let weight = 0; const influences = [];
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k), j = skinIndex.getComponent(i, k);
      if (w > 0) influences.push({ bone: rig.objectNames.get(rig.mesh.skeleton.bones[j]), weight: w });
      if (j === joint) weight += w;
    }
    const point = new THREE.Vector3().fromArray(world, i * 3), local = point.clone().applyMatrix4(inverse);
    if (weight < .005 || point.distanceTo(wrist) > .20) continue;
    const key = local.toArray().map(n => Math.round(n * 1e6)).join(':');
    if (!byPosition.has(key)) { byPosition.set(key, records.length); records.push({ id: records.length, vertices: [], world: point.toArray(), local: local.toArray(), plot: point.clone().applyMatrix4(plotInverse).toArray(), influences, handWeight: weight }); }
    const r = records[byPosition.get(key)]; r.vertices.push(i); vertexRecord.set(i, r.id);
  }
  const triangles = [], index = rig.mesh.geometry.index.array;
  for (let i = 0; i < index.length; i += 3) {
    const vertices = Array.from(index.slice(i, i + 3)), recordIDs = vertices.map(n => vertexRecord.get(n));
    if (recordIDs.every(n => n !== undefined)) triangles.push({ triangle: i / 3, vertices, records: recordIDs });
  }
  return { bone: name, side, boneRestWorld: bone.matrixWorld.toArray(), wristWorld: wrist.toArray(), plotMatrix: plotMatrix.toArray(), records, triangles };
}
async function texture(rig, sharp) {
  const mat = rig.json.materials[0], ref = mat.pbrMetallicRoughness.baseColorTexture;
  const image = rig.json.images[rig.json.textures[ref.index].source], view = rig.json.bufferViews[image.bufferView];
  const { data, info } = await sharp(rig.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info, transform: ref.extensions?.KHR_texture_transform ?? {}, factor: mat.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1] };
}
// Actual indexed skin triangles with interpolated UVs and a depth buffer.
// Software witness, not a runtime/browser render or anatomy PASS.
async function picture(ctx, evidence, sharp, { direction, up, target, half = .115, labels = [], size = 900 }) {
  const { rig } = ctx, tex = await texture(rig, sharp), world = worldVertices(rig);
  const z = direction.clone().normalize(), y = up.clone().addScaledVector(z, -up.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z).normalize();
  const project = point => { const d = point.clone().sub(target); return { x: size / 2 + d.dot(x) * size / (2 * half), y: size / 2 - d.dot(y) * size / (2 * half), z: d.dot(z) }; };
  const pixels = Buffer.alloc(size * size * 3, 227), depths = new Float64Array(size * size).fill(-Infinity), uv = rig.mesh.geometry.attributes.uv;
  const projected = [];
  for (let i = 0; i < world.length; i += 3) projected.push(project(new THREE.Vector3().fromArray(world, i)));
  for (const triangle of evidence.triangles) {
    const ids = triangle.vertices, [a, b, c] = ids.map(i => projected[i]);
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); if (Math.abs(area) < 1e-9) continue;
    const normal = new THREE.Vector3().fromArray(world, ids[1] * 3).sub(new THREE.Vector3().fromArray(world, ids[0] * 3))
      .cross(new THREE.Vector3().fromArray(world, ids[2] * 3).sub(new THREE.Vector3().fromArray(world, ids[0] * 3))).normalize();
    const shade = .75 + .25 * Math.abs(normal.dot(z));
    for (let py = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))); py <= Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y))); py++)
      for (let px = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))); px <= Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x))); px++) {
        const wb = ((px + .5 - a.x) * (c.y - a.y) - (py + .5 - a.y) * (c.x - a.x)) / area;
        const wc = ((b.x - a.x) * (py + .5 - a.y) - (b.y - a.y) * (px + .5 - a.x)) / area, wa = 1 - wb - wc;
        if (Math.min(wa, wb, wc) < -1e-9) continue;
        const depth = wa * a.z + wb * b.z + wc * c.z, at = py * size + px; if (depth <= depths[at]) continue; depths[at] = depth;
        const tr = tex.transform, sc = tr.scale ?? [1, 1], off = tr.offset ?? [0, 0], angle = tr.rotation ?? 0;
        const u0 = wa * uv.getX(ids[0]) + wb * uv.getX(ids[1]) + wc * uv.getX(ids[2]), v0 = wa * uv.getY(ids[0]) + wb * uv.getY(ids[1]) + wc * uv.getY(ids[2]);
        const u = off[0] + Math.cos(angle) * u0 * sc[0] - Math.sin(angle) * v0 * sc[1], vv = off[1] + Math.sin(angle) * u0 * sc[0] + Math.cos(angle) * v0 * sc[1];
        const tx = THREE.MathUtils.clamp(Math.floor(u * tex.info.width), 0, tex.info.width - 1), ty = THREE.MathUtils.clamp(Math.floor(vv * tex.info.height), 0, tex.info.height - 1);
        const pixel = (ty * tex.info.width + tx) * tex.info.channels;
        for (let k = 0; k < 3; k++) pixels[at * 3 + k] = Math.round(tex.data[pixel + k] * tex.factor[k] * shade);
      }
  }
  let img = sharp(pixels, { raw: { width: size, height: size, channels: 3 } });
  if (labels.length) {
    // Hide labels of occluded surface points instead of projecting through skin.
    const overlays = labels.flatMap(({ point, text, color = '#154cdb' }) => {
      const p = project(point), px = Math.round(p.x), py = Math.round(p.y);
      if (px < 0 || py < 0 || px >= size || py >= size || depths[py * size + px] - p.z > .0015) return [];
      return [`<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"/><text x="${p.x + 4}" y="${p.y - 3}" font-family="sans-serif" font-size="13" fill="${color}" stroke="white" stroke-width=".4">${text}</text>`];
    });
    img = img.composite([{ input: Buffer.from(`<svg width="${size}" height="${size}">${overlays.join('')}</svg>`) }]);
  }
  return img.png().toBuffer();
}
async function inspect(family) {
  const ctx = await inputs(family), sharp = packingDependencies(ctx.qa.dependencies.helperProject).sharp, results = [];
  for (const side of ['left', 'right']) {
    const e = neighborhood(ctx, side), matrix = new THREE.Matrix4().fromArray(e.plotMatrix);
    const axis = a => v(a).transformDirection(matrix), target = v([0, .065, 0]).applyMatrix4(matrix);
    const images = [];
    for (const [name, dir] of [['axis-plus', [0, 0, 1]], ['axis-minus', [0, 0, -1]], ['radial-a', [1, 0, .5]], ['radial-b', [-1, 0, .5]]]) {
      const options = { direction: axis(dir), up: axis([0, 1, 0]), target };
      for (const labelled of [false, true]) images.push(await save(`${family}-${ctx.rig.sha256.slice(0, 12)}/${side}-${name}${labelled ? '-indices' : ''}.png`,
        await picture(ctx, e, sharp, { ...options, labels: labelled ? e.records.map(r => ({ point: v(r.world), text: r.id })) : [] })));
    }
    const receipt = await save(`${family}-${ctx.rig.sha256.slice(0, 12)}/${side}-inspection.json`, { schema: 1, family, ...e,
      pins: ctx.pins, rawPins: ctx.rawPins, images, limits: ['Old PCA axes select inspection cameras only.', 'Record IDs are welded display IDs; each records.vertices array contains exact source indices.', 'Palmar versus dorsal sign and thumb semantics must be authored from visible textured surfaces.'] });
    results.push({ side, receipt, records: e.records.length, triangles: e.triangles.length });
  }
  return results;
}

function measuredHand(ctx, side) {
  const e = neighborhood(ctx, side), spec = LANDMARKS[ctx.family][side];
  const world = worldVertices(ctx.rig), point = index => new THREE.Vector3().fromArray(world, index * 3);
  const recordOf = index => {
    const r = e.records.find(r => r.vertices.includes(index));
    if (!r) throw Error('Authored landmark is not on the actual hand neighborhood: ' + index);
    return { vertex: index, weldedDisplayID: r.id, duplicates: r.vertices, world: point(index).toArray(),
      handRestLocal: point(index).applyMatrix4(new THREE.Matrix4().fromArray(e.boneRestWorld).invert()).toArray(), influences: r.influences };
  };
  const triangle = id => {
    const t = e.triangles.find(t => t.triangle === id); if (!t) throw Error('Authored palm triangle absent');
    const p = t.vertices.map(point), cross = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    return { ...t, p, normal: cross.clone().normalize(), cross, area: cross.length() / 2, centre: mean(p) };
  };
  const patch = spec.patch.map(triangle), anchor = triangle(spec.anchor);
  // Sum actual outward area vectors of authored proximal palmar triangles.
  // Distal fingers, global hand covariance, and thumb bulges are excluded.
  const surfaceNormal = patch.reduce((n, t) => n.add(t.cross), new THREE.Vector3()).normalize();
  if (patch.some(t => t.normal.dot(surfaceNormal) < .6)) throw Error('Proximal patch folds too far for one signed plane');
  const wrist = point(spec.wrist), mcp = mean(spec.mcp.map(point));
  // Preserve anatomical wrist-to-MCP flow, rather than rotating it to follow a
  // steep heel facet in a naturally cupped hand. The authored palmar surface
  // supplies its sign and roll; remove its longitudinal component only.
  const fingers = mcp.clone().sub(wrist).normalize();
  const palm = surfaceNormal.clone().addScaledVector(fingers, -surfaceNormal.dot(fingers)).normalize();
  const across = new THREE.Vector3().crossVectors(fingers, palm).normalize();
  if (fingers.length() < .99 || across.length() < .99) throw Error('Degenerate semantic palm frame');
  const tris = e.triangles.map(t => ({ ...t, shape: new THREE.Triangle(...t.vertices.map(point)) }));
  function exit(origin, direction, minimum = .001) {
    const ray = new THREE.Ray(origin.clone().addScaledVector(direction, .000001), direction), hits = [];
    for (const t of tris) {
      const hit = ray.intersectTriangle(t.shape.a, t.shape.b, t.shape.c, false, new THREE.Vector3());
      if (!hit) continue;
      const distance = hit.clone().sub(origin).dot(direction);
      if (distance < minimum || t.shape.getNormal(new THREE.Vector3()).dot(direction) < .1) continue;
      hits.push({ triangle: t.triangle, vertices: t.vertices, point: hit, distance,
        barycentric: t.shape.getBarycoord(hit, new THREE.Vector3()).toArray() });
    }
    hits.sort((a, b) => a.distance - b.distance); if (!hits.length) throw Error('No actual opposing surface intersection');
    return hits[0];
  }
  const palmar = anchor.centre, dorsal = exit(palmar, palm.clone().negate());
  if (dorsal.distance < .004 || dorsal.distance > .06) throw Error('Unexpected proximal hand thickness: ' + ctx.family + '/' + side + ' ' + dorsal.distance);
  const centre = palmar.clone().lerp(dorsal.point, .5);
  const radial = exit(centre, across), ulnar = exit(centre, across.clone().negate());
  const inverse = new THREE.Matrix4().fromArray(e.boneRestWorld).invert();
  const toLocal = p => p.clone().applyMatrix4(inverse).toArray();
  const hand = { centreLocal: toLocal(centre), fingersLocal: fingers.clone().transformDirection(inverse).toArray(),
    palmLocal: palm.clone().transformDirection(inverse).toArray() };
  if (Math.hypot(...hand.centreLocal) >= .4 ||
      Math.abs(Math.hypot(...hand.palmLocal) - 1) > 1e-8 || Math.abs(Math.hypot(...hand.fingersLocal) - 1) > 1e-8 ||
      v(hand.palmLocal).cross(v(hand.fingersLocal)).length() < .999999) throw Error('Activity hand contract invalid');
  const stations = e.records.map(r => ({ ...r, longitudinal: v(r.world).sub(centre).dot(fingers),
    across: v(r.world).sub(centre).dot(across), palmar: v(r.world).sub(centre).dot(palm) }));
  // Envelope excludes forearm and all thumb/lateral extremes; it is a bound,
  // not a closed-grip/contact claim. Existing curved fingers stay untouched.
  const fingerStations = stations.filter(r => r.longitudinal > .03 &&
    Math.abs(r.across) < .04 && r.handWeight >= .95);
  if (fingerStations.length < 8) throw Error('Insufficient actual finger envelope');
  const maxFinger = fingerStations.reduce((a, b) => a.palmar > b.palmar ? a : b);
  const thumb = recordOf(spec.thumbTip), web = recordOf(spec.web), thumbRoot = recordOf(spec.thumbRoot);
  const scale = ctx.adapter.coordinates.height / 1.72, halfThickness = dorsal.distance / 2, clearance = .001;
  return { hand, evidence: { bone: e.bone, boneRestWorld: e.boneRestWorld, units: 'metres; actual Hand rest local; NOT procedural forearm local',
    method: 'Semantic wrist-crease to MCP-root direction; authored proximal palmar outward area normal projected perpendicular to that direction. Centre is midpoint of exact palmar triangle centroid and opposing surface ray along this anatomical palm normal.',
    proximalSurfaceNormalWorld: surfaceNormal.toArray(), anatomicalPalmNormalWorld: palm.toArray(),
    surfaceNormalAdjustmentDegrees: THREE.MathUtils.radToDeg(surfaceNormal.angleTo(palm)),
    note: spec.note, semanticLandmarks: { wristCrease: recordOf(spec.wrist), mcpRoots: spec.mcp.map(recordOf), thumb, thumbRoot, thumbIndexWeb: web },
    palmarPatch: patch.map(t => ({ triangle: t.triangle, vertices: t.vertices, area: t.area, outwardNormalWorld: t.normal.toArray(),
      handWeights: t.vertices.map(i => recordOf(i).influences.find(x => x.bone === e.bone)?.weight ?? 0) })),
    palmarAnchor: { triangle: anchor.triangle, vertices: anchor.vertices, barycentric: [1 / 3, 1 / 3, 1 / 3], world: palmar.toArray(), handRestLocal: toLocal(palmar) },
    dorsalIntersection: { triangle: dorsal.triangle, vertices: dorsal.vertices, barycentric: dorsal.barycentric, world: dorsal.point.toArray(), handRestLocal: toLocal(dorsal.point) },
    thickness: dorsal.distance, halfThickness, palmWidth: radial.distance + ulnar.distance,
    widthInterpretation: ctx.family === 'monk_elder' && side === 'right'
      ? 'Transverse surface-ray span intersects the spread thumb/thenar region; 141 mm is NOT an isolated anatomical palm width. Diagnostic only; do not use as a spacing target.'
      : 'Local transverse surface-ray span through the proximal centre, not maximum hand breadth or a collision guarantee.',
    widthIntersections: [radial, ulnar].map(hit => ({ triangle: hit.triangle, vertices: hit.vertices, barycentric: hit.barycentric, world: hit.point.toArray() })),
    thumbRadialDirectionLocal: point(spec.thumbTip).sub(point(spec.thumbRoot)).normalize().transformDirection(inverse).toArray(),
    oldPCADiagnosticOnly: { palmAngleDegrees: THREE.MathUtils.radToDeg(palm.angleTo(v(ctx.adapter.hands[side].palmWorld))),
      fingerAngleDegrees: THREE.MathUtils.radToDeg(fingers.angleTo(v(ctx.adapter.hands[side].fingersWorld))) },
    curledFingerEnvelope: { maxInwardFromCentre: maxFinger.palmar, witness: recordOf(maxFinger.vertices[0]),
      halfSpaceNoCrossingGap: Math.max(halfThickness, maxFinger.palmar) + clearance,
      interpretation: 'Conservative rest-hand inward projection, excluding thumb; not triangle-pair collision or deformed-skin clearance.' },
    gapSuggestion: { signedCentreOffsetMetres: (side === 'left' ? 1 : -1) * (halfThickness + clearance),
      halfThicknessPlusClearance: halfThickness + clearance, perSideClearance: clearance,
      coefficientForExistingHeightScaledTarget: (halfThickness + clearance) / scale,
      fingerConservativeCoefficientForExistingHeightScaledTarget: (Math.max(halfThickness, maxFinger.palmar) + clearance) / scale,
      interpretation: 'Initial PROXIMAL PALM spacing only. Multiply coefficient by height/1.72 as the parent solver does; negative sign on right. Inspect actual curled fingers/thumbs and mixed skin before reducing gap.' },
    acceptance: 'MEASURED_SEMANTIC_HANDOFF_ONLY; parent actual wai captures and skin/contact review required' }, e, centre, palm, fingers, across };
}
async function fit() {
  const contexts = await Promise.all(Object.keys(ROOT_PINS).map(inputs)), results = [];
  const toolPin = { path: 'tools/npc-models/fit-wai-palms.mjs', sha256: sha256(await readFile(fileURLToPath(import.meta.url))) };
  for (const ctx of contexts) {
    const hands = {}, evidence = {}, pictures = [], sharp = packingDependencies(ctx.qa.dependencies.helperProject).sharp;
    for (const side of ['left', 'right']) {
      const m = measuredHand(ctx, side); hands[side] = m.hand; evidence[side] = m.evidence;
      const semantic = m.evidence.semanticLandmarks;
      const labels = [{ point: m.centre.clone().addScaledVector(m.palm, m.evidence.halfThickness), text: 'PALM' },
        { point: v(semantic.thumb.world), text: 'THUMB', color: '#ae1b13' },
        { point: v(semantic.thumbIndexWeb.world), text: 'WEB', color: '#ae1b13' },
        { point: v(semantic.wristCrease.world), text: 'WRIST' },
        ...semantic.mcpRoots.map((p, i) => ({ point: v(p.world), text: 'MCP' + i }))];
      const revision = sha256(Buffer.from(JSON.stringify({ source: ctx.rig.sha256, side, spec: LANDMARKS[ctx.family][side], tool: toolPin.sha256 }))).slice(0, 12);
      for (const [name, direction] of [['proximal-palm', m.palm], ['dorsal', m.palm.clone().negate()],
        ['thumb-oblique', m.palm.clone().addScaledVector(m.across, side === 'left' ? -1 : 1)]]) {
        pictures.push(await save(`fit-${revision}/${ctx.family}-${side}-${name}.png`,
          await picture(ctx, m.e, sharp, { direction, up: m.fingers, target: m.centre.clone().addScaledVector(m.fingers, .045), labels })));
      }
    }
    const pins = { ...ctx.pins, ...Object.fromEntries(Object.entries(ctx.rawPins).flatMap(([label, roles]) => Object.entries(roles).map(([role, pin]) => [label + ':' + role, pin]))) };
    for (const pin of Object.values(pins)) if (sha256(await readFile(pin.path)) !== pin.sha256) throw Error('Read-only source changed during measurement: ' + pin.path);
    results.push({ family: ctx.family, rootSha256: ctx.rig.sha256, publicSha256: ctx.pins.public.sha256,
      activityPoses: { hands }, evidence, pins: ctx.pins, rawPins: ctx.rawPins, pictures,
      geometryAndNativePreserved: true, deliveredGeometryRigNativeIdentical: true });
  }
  const handoff = { schema: 1, status: 'SOURCE_PINNED_PROXIMAL_PALM_SEMANTIC_MEASUREMENT_ONLY', toolPin, results,
    integration: ['Parent copies results[].activityPoses.hands as explicit overrides for that exact family/source.',
      'Do not reuse historical centroid/PCA contact PASS receipts as approval.',
      'halfThickness+1 mm per side is a starting palm-plane gap; inspect the conservative curled-finger envelope before reducing it.',
      'No individual finger bones or source geometry changes. Thumb semantics do not imply a closed grasp.',
      'Upright seated fallback is a separate explicit policy review; this measurement makes no seated-pose acceptance claim.'] };
  return save(`handoff-${sha256(Buffer.from(JSON.stringify(handoff))).slice(0, 12)}.json`, handoff);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, family] = process.argv.slice(2);
    if (mode === 'fit' && !family) console.log(JSON.stringify(await fit()));
    else if (mode === 'inspect' && ROOT_PINS[family]) console.log(JSON.stringify(await inspect(family)));
    else throw Error('Usage: node tools/npc-models/fit-wai-palms.mjs inspect monk_elder|monk_novice OR fit');
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
