// Offline quadruped binding. Writes candidates ONLY below artifacts/hunter-dog.
// Usage: node tools/hunter-dog/bind.mjs [raw.glb] [--out <artifact-dir>] [--sharp <installed-package>]
// Defaults use tools/hunter-dog/source/{meshy-body,original-dog}.glb.
// sharp resolves locally or tools/monster-models/node_modules; HUNTER_DOG_SHARP
// or --sharp accepts another already-installed package directory (no install).
// Existing dependencies only; no API, credentials, browser, runtime edit or publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Box3, Matrix3, Matrix4, Quaternion, Triangle, Vector3 } from 'three';
import { readGLB, worldMatrices, glbBuilder, projectionPNG } from './geometry-tools.mjs';
import { auditCandidate } from './skin-audit.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const round = n => Number(n.toFixed(7)), xyz = v => v.toArray().map(round);
const regionOf = name => /^tripo::[01]_(Left|Right)_Limb_/.test(name) ? `${name.includes('::0_') ? 'F' : 'H'}${name.includes('_Left_') ? 'L' : 'R'}`
  : /Tail|^bone_2$/.test(name) ? 'tail' : name === 'bone_14' ? 'earL' : name === 'bone_15' ? 'earR' : /Head|Spine_[67]$/.test(name) ? 'head' : 'body';
const vec = a => new Vector3(...a);

function options(args) {
  const o = { input: args[0] && !args[0].startsWith('--') ? args.shift() : 'tools/hunter-dog/source/meshy-body.glb', out: 'artifacts/hunter-dog/bound', donor: 'tools/hunter-dog/source/original-dog.glb', landmarks: 'tools/hunter-dog/bind-landmarks.json' };
  while (args.length) { const key = args.shift(); if (!['--out', '--donor', '--landmarks', '--sharp'].includes(key) || !args.length) throw Error(`Invalid option ${key}`); o[key.slice(2)] = args.shift(); }
  if (!o.input) throw Error('Provide final unrigged raw.glb'); return o;
}

async function installedSharp(explicit) {
  const local = createRequire(import.meta.url);
  const candidates = [explicit, 'sharp', path.join(ROOT, 'tools/monster-models/node_modules/sharp'),
    path.join(process.env.USERPROFILE ?? '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')].filter(Boolean);
  for (const spec of candidates) { try { return { sharp: local(spec), location: local.resolve(spec) }; } catch (error) { if (explicit && spec === explicit) throw error; } }
  throw Error('Existing sharp package required for local texture encoding; pass --sharp <installed package directory>. No packages are installed by this utility.');
}

async function surface(doc, requireSkin = false) {
  const j = doc.json;
  if (j.meshes?.length !== 1 || j.meshes[0].primitives.length !== 1) throw Error('Expected one mesh/primitive; do not silently discard geometry');
  if (requireSkin ? j.skins?.length !== 1 : !!j.skins?.length || !!j.animations?.length) throw Error('Unexpected source rig/animations');
  const p = j.meshes[0].primitives[0]; if ((p.mode ?? 4) !== 4 || p.targets || p.attributes.TANGENT) throw Error('Only ordinary triangles without morphs/tangents supported');
  const node = j.nodes.findIndex(n => n.mesh === 0), frames = worldMatrices(j.nodes), meshWorld = frames.matrices[node];
  const position = await doc.accessor(p.attributes.POSITION), normal = p.attributes.NORMAL === undefined ? null : await doc.accessor(p.attributes.NORMAL);
  const points = Array.from({ length: position.count }, (_, i) => vec(Array.from(position.values.slice(i * 3, i * 3 + 3))).applyMatrix4(meshWorld));
  const ix = await doc.accessor(p.indices); const indices = Array.from(ix.values);
  if (points.some(p => p.toArray().some(n => !Number.isFinite(n))) || indices.some(n => !Number.isSafeInteger(n) || n < 0 || n >= points.length)) throw Error('Invalid geometry');
  return { primitive: p, position, normal, points, indices, frames, meshWorld, box: new Box3().setFromPoints(points) };
}

function normalization(source, recipe) {
  const [back, front] = recipe.bodyForward.map(vec), direction = front.clone().sub(back).setY(0);
  if (direction.length() < .1 || direction.z <= 0) throw Error('Landmarks must establish positive forward');
  const yaw = -Math.atan2(direction.x, direction.z), rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  const paws = ['0_Left', '0_Right', '1_Left', '1_Right'].map(s => vec(recipe.joints[`tripo::${s}_Limb_3`]));
  const origin = paws.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(.25); origin.y = source.box.min.y;
  const height = recipe.withers[1] - origin.y, scale = recipe.shoulderMetersBeforeRuntimeScale / height;
  if (!(scale > 0 && scale < 10)) throw Error('Invalid model scale');
  const transform = p => p.clone().sub(origin).applyQuaternion(rotation).multiplyScalar(scale);
  return { transform, rotation, yaw, origin, scale, height, withers: transform(vec(recipe.withers)) };
}

function fitRig(donor, recipe, norm) {
  const skin = donor.json.skins[0], frames = worldMatrices(donor.json.nodes), jointIds = skin.joints;
  if (jointIds.length !== 38 || new Set(jointIds.map(i => donor.json.nodes[i].name)).size !== 38) throw Error('Expected all 38 uniquely named donor joints');
  const remap = new Map(jointIds.map((id, i) => [id, i])), names = jointIds.map(i => donor.json.nodes[i].name);
  const parents = jointIds.map(i => remap.get(frames.parents[i]) ?? -1), original = jointIds.map(i => frames.matrices[i]);
  const sourcePositions = original.map(m => new Vector3().setFromMatrixPosition(m));
  const target = names.map(name => name === 'tripo::Root' ? new Vector3(0, .0125, 0) : norm.transform(vec(recipe.joints[name] ?? (() => { throw Error(`Missing landmark ${name}`); })())));
  const tipPoints = Object.fromEntries(Object.entries(recipe.tips).map(([k, a]) => [k, norm.transform(vec(a))]));
  const next = new Map();
  for (const prefix of ['0_Left', '0_Right', '1_Left', '1_Right']) for (let k = 0; k < 3; k++) next.set(`tripo::${prefix}_Limb_${k}`, `tripo::${prefix}_Limb_${k + 1}`);
  for (let k = 0; k < 7; k++) next.set(`tripo::Spine_${k}`, `tripo::Spine_${k + 1}`);
  next.set('tripo::Spine_7', 'tripo::Head_0'); next.set('tripo::Head_0', 'tripo::Head_1'); next.set('bone_2', 'tripo::Tail_0'); next.set('tripo::Tail_0', 'tripo::Tail_1');
  const orientations = original.map((m, i) => {
    const q = new Quaternion(); m.decompose(new Vector3(), q, new Vector3()); q.normalize();
    const child = names.indexOf(next.get(names[i]));
    if (child >= 0) {
      const from = sourcePositions[child].clone().sub(sourcePositions[i]).normalize(), to = target[child].clone().sub(target[i]).normalize();
      q.premultiply(new Quaternion().setFromUnitVectors(from, to)).normalize();
    } else if (names[i] === 'bone_14' || names[i] === 'bone_15') {
      q.premultiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0).applyQuaternion(q), tipPoints[names[i] === 'bone_14' ? 'earL' : 'earR'].clone().sub(target[i]).normalize())).normalize();
    }
    return q;
  });
  const fitted = target.map((p, i) => new Matrix4().compose(p, orientations[i], new Vector3(1, 1, 1)));
  const nodes = names.map((name, i) => {
    const pi = parents[i], pInv = pi < 0 ? new Quaternion() : orientations[pi].clone().invert();
    const translation = target[i].clone().sub(pi < 0 ? new Vector3() : target[pi]).applyQuaternion(pInv);
    const rotation = pInv.clone().multiply(orientations[i]).normalize(), children = parents.flatMap((p, c) => p === i ? [c] : []);
    return { name, translation: translation.toArray(), rotation: rotation.toArray(), ...(children.length ? { children } : {}) };
  });
  return { names, parents, sourcePositions, target, original, fitted, orientations, nodes, tipPoints, regions: names.map(regionOf) };
}

function bvh(triangles) {
  if (!triangles.length) throw Error('Empty anatomical donor region');
  const box = new Box3(); for (const t of triangles) for (const p of [t.triangle.a, t.triangle.b, t.triangle.c]) box.expandByPoint(p);
  if (triangles.length <= 12) return { box, triangles };
  const size = box.getSize(new Vector3()), axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  triangles.sort((a, b) => a.center[axis] - b.center[axis]); const mid = Math.floor(triangles.length / 2);
  return { box, left: bvh(triangles.slice(0, mid)), right: bvh(triangles.slice(mid)) };
}
function nearest(tree, point) {
  let best = Infinity, result; const close = new Vector3();
  const distance = box => { let d = 0; for (const axis of ['x', 'y', 'z']) { const v = point[axis] < box.min[axis] ? box.min[axis] - point[axis] : point[axis] > box.max[axis] ? point[axis] - box.max[axis] : 0; d += v * v; } return d; };
  const visit = node => {
    if (distance(node.box) > best) return;
    if (node.triangles) { for (const t of node.triangles) { t.triangle.closestPointToPoint(point, close); const d = close.distanceToSquared(point); if (d < best) { best = d; result = { ids: t.ids, point: close.clone(), triangle: t.triangle }; } } }
    else { const ordered = distance(node.left.box) < distance(node.right.box) ? [node.left, node.right] : [node.right, node.left]; ordered.forEach(visit); }
  }; visit(tree); return { ...result, distance: Math.sqrt(best) };
}

const segmentDistance = (p, a, b) => { const v = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(v) / Math.max(1e-12, v.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(v, t)); };
function classifier(rig) {
  const at = name => rig.target[rig.names.indexOf(name)], chains = {};
  for (const [r, p] of [['FL', '0_Left'], ['FR', '0_Right'], ['HL', '1_Left'], ['HR', '1_Right']]) chains[r] = [0, 1, 2, 3].map(k => at(`tripo::${p}_Limb_${k}`)).concat(rig.tipPoints[r]);
  chains.body = [0, 1, 2, 3, 4, 5].map(k => at(`tripo::Spine_${k}`));
  chains.head = [at('tripo::Spine_5'), at('tripo::Spine_6'), at('tripo::Spine_7'), at('tripo::Head_0'), at('tripo::Head_1'), rig.tipPoints.head];
  chains.tail = [at('bone_2'), at('tripo::Tail_0'), at('tripo::Tail_1'), rig.tipPoints.tail];
  chains.earL = [at('bone_14'), rig.tipPoints.earL]; chains.earR = [at('bone_15'), rig.tipPoints.earR];
  const radii = { body: .13, head: .085, tail: .032, earL: .026, earR: .026 };
  const score = (p, region) => Math.min(...chains[region].slice(1).map((b, i) => segmentDistance(p, chains[region][i], b) / (radii[region] ?? (i === 0 ? .062 : .032))));
  return { chains, classify(p) {
    if (p.z < chains.tail[0].z - .025 && Math.min(...chains.tail.slice(1).map((b, i) => segmentDistance(p, chains.tail[i], b))) < .065 && p.y > .22) return 'tail';
    const regions = p.y < .22 ? ['FL', 'FR', 'HL', 'HR'] : Object.keys(chains);
    return regions.reduce((a, b) => score(p, a) <= score(p, b) ? a : b);
  } };
}

async function transfer(donor, donorSurface, rig, points, recipe) {
  const p = donorSurface.primitive, js = await donor.accessor(p.attributes.JOINTS_0), ws = await donor.accessor(p.attributes.WEIGHTS_0);
  const s = recipe.shoulderMetersBeforeRuntimeScale / .498369, scale = new Matrix4().makeScale(s, s, s);
  const transforms = rig.fitted.map((m, i) => m.clone().multiply(scale).multiply(rig.original[i].clone().invert()));
  const proxy = donorSurface.points.map((p, i) => {
    const out = new Vector3(); for (let k = 0; k < 4; k++) { const w = ws.values[i * 4 + k]; if (w) out.addScaledVector(p.clone().applyMatrix4(transforms[js.values[i * 4 + k]]), w); } return out;
  });
  const regionSets = Object.fromEntries(['FL', 'FR', 'HL', 'HR', 'body', 'head', 'tail', 'earL', 'earR'].map(r => [r, []]));
  for (let t = 0; t < donorSurface.indices.length; t += 3) {
    const ids = donorSurface.indices.slice(t, t + 3), triangle = new Triangle(...ids.map(i => proxy[i])); if (triangle.getArea() < 1e-12) continue;
    const masses = {}; for (const id of ids) for (let k = 0; k < 4; k++) { const r = rig.regions[js.values[id * 4 + k]]; masses[r] = (masses[r] ?? 0) + ws.values[id * 4 + k] / 3; }
    const entry = { ids, triangle, center: triangle.getMidpoint(new Vector3()) };
    for (const [r, mass] of Object.entries(masses)) if (mass > .12) regionSets[r].push(entry);
  }
  const trees = Object.fromEntries(Object.entries(regionSets).map(([r, triangles]) => [r, bvh(triangles)])), field = classifier(rig);
  const jointArray = new Uint8Array(points.length * 4), weightArray = new Float32Array(points.length * 4), regions = [], distances = [], seamCache = new Map(), masses = rig.names.map(() => 0), stats = {};
  let worstPrunedMass = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i], key = point.toArray().join(','), cached = seamCache.get(key);
    if (cached) { jointArray.set(cached.joints, i * 4); weightArray.set(cached.weights, i * 4); regions[i] = cached.region; distances[i] = cached.distance; continue; }
    const r = field.classify(point), nearestSurface = nearest(trees[r], point);
    if (nearestSurface.distance > recipe.limits.maxTransferDistanceMeters) throw Error(`Uncovered ${r} vertex ${i}: ${nearestSurface.distance.toFixed(4)} m; fit landmarks before binding`);
    const bary = nearestSurface.triangle.getBarycoord(nearestSurface.point, new Vector3()); if (!bary) throw Error('Degenerate transfer triangle');
    const merged = new Map(); for (let corner = 0; corner < 3; corner++) for (let k = 0; k < 4; k++) { const id = nearestSurface.ids[corner], joint = js.values[id * 4 + k], w = ws.values[id * 4 + k] * bary.getComponent(corner); if (w > 1e-9) merged.set(joint, (merged.get(joint) ?? 0) + w); }
    const allowed = joint => {
      const br = rig.regions[joint];
      if (/^[FH][LR]$/.test(r)) {
        const knee = field.chains[r][1]; return br === r || (point.y > knee.y + .025 && br === 'body');
      }
      if (r.startsWith('ear')) return br === r || br === 'head';
      if (r === 'tail') return br === 'tail' || (point.distanceTo(field.chains.tail[0]) < .075 && br === 'body');
      if (r === 'head') return br === 'head' || (point.z < field.chains.head[1].z && br === 'body');
      return br === 'body' || (point.z > field.chains.body.at(-1).z - .04 && br === 'head');
    };
    const all = [...merged].filter(([joint]) => allowed(joint)).sort((a, b) => b[1] - a[1]), selected = all.slice(0, 4), sum = selected.reduce((s, [, w]) => s + w, 0);
    if (!(sum > 1e-8)) throw Error(`No compatible donor weights for ${r} vertex ${i}`);
    worstPrunedMass = Math.max(worstPrunedMass, all.slice(4).reduce((s, [, w]) => s + w, 0));
    const joints = new Uint8Array(4), weights = new Float32Array(4); selected.forEach(([j, w], k) => { joints[k] = j; weights[k] = w / sum; masses[j] += w / sum; });
    jointArray.set(joints, i * 4); weightArray.set(weights, i * 4); regions[i] = r; distances[i] = nearestSurface.distance;
    seamCache.set(key, { joints, weights, region: r, distance: nearestSurface.distance });
    stats[r] ??= { uniqueVertices: 0, distances: [] }; stats[r].uniqueVertices++; stats[r].distances.push(nearestSurface.distance);
  }
  const metrics = Object.fromEntries(Object.entries(stats).map(([r, s]) => { const a = s.distances.sort((a, b) => a - b); return [r, { uniqueVertices: s.uniqueVertices, medianMeters: round(a[Math.floor(a.length / 2)]), p95Meters: round(a[Math.floor(a.length * .95)]), maxMeters: round(a.at(-1)), donorTriangles: regionSets[r].length }]; }));
  return { jointArray, weightArray, regions, proxy, metrics, worstPrunedMass, field, jointWeightMass: Object.fromEntries(rig.names.map((n, i) => [n, round(masses[i])])) };
}

// Smooth across actual surface adjacency, welding position-only UV copies. This
// repairs transfer-region boundaries without letting a nearby separate leg borrow
// its neighbour's weights. Geometry, UVs, normals and indices remain unchanged.
function regularize(weights, points, indices, rig) {
  const keys = new Map(), ids = [], representatives = [], neighbors = [];
  points.forEach((p, i) => { const key = p.toArray().join(','); if (!keys.has(key)) { keys.set(key, representatives.length); representatives.push(i); neighbors.push(new Map()); } ids[i] = keys.get(key); });
  for (let i = 0; i < indices.length; i += 3) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) {
    const a = ids[indices[i + u]], b = ids[indices[i + v]]; if (a === b) continue;
    const distance = points[representatives[a]].distanceTo(points[representatives[b]]), w = 1 / Math.max(.002, distance);
    neighbors[a].set(b, w); neighbors[b].set(a, w);
  }
  const permittedLegs = representatives.map(i => {
    const r = weights.regions[i], p = points[i]; if (/^[FH][LR]$/.test(r)) return r;
    if (r !== 'body') return null;
    const choices = ['FL', 'FR', 'HL', 'HR'].map(r => ({ r, distance: segmentDistance(p, weights.field.chains[r][0], weights.field.chains[r][1]) })).sort((a, b) => a.distance - b.distance);
    return choices[0].distance < .105 && p.y < weights.field.chains[choices[0].r][0].y + .045 ? choices[0].r : null;
  });
  const allowed = (u, joint) => {
    const i = representatives[u], p = points[i], r = weights.regions[i], br = rig.regions[joint];
    if (/^[FH][LR]$/.test(br)) return br === permittedLegs[u];
    if (/^[FH][LR]$/.test(r)) return br === 'body' && p.y > weights.field.chains[r][1].y - .015;
    if (br === 'body') return !r.startsWith('ear') && (r !== 'tail' || p.distanceTo(weights.field.chains.tail[0]) < .11);
    if (br === 'tail') return r === 'tail' || (r === 'body' && p.distanceTo(weights.field.chains.tail[0]) < .10);
    if (br.startsWith('ear')) return br === r || (r === 'head' && p.distanceTo(weights.field.chains[br][0]) < .045);
    return r === 'head' || r.startsWith('ear') || (r === 'body' && p.z > weights.field.chains.head[0].z - .07);
  };
  // Static descendants have EXACTLY the same skin delta as their most recent
  // actuated ancestor. Merge these equivalent groups before four-slot pruning:
  // otherwise four inert torso helpers can evict a meaningful neck influence.
  // Retain all names and distribute the merged mass among equivalent members.
  // The actual controller audit verifies equivalence at every sampled pose.
  const actuated = new Set(['tripo::Root', 'tripo::Spine_0', 'tripo::Spine_4', 'tripo::Spine_6', 'tripo::Spine_7', 'tripo::Head_0', 'bone_2', 'tripo::Tail_0', 'bone_14', 'bone_15', ...rig.names.filter(n => /_Limb_[012]$/.test(n))]);
  const effective = rig.names.map((_, i) => { let j = i; while (!actuated.has(rig.names[j])) { j = rig.parents[j]; if (j < 0) throw Error('Missing actuated ancestor'); } return j; });
  const members = new Map(); effective.forEach((j, i) => { if (!members.has(j)) members.set(j, []); members.get(j).push(i); });
  let data = representatives.map(i => { const a = new Float64Array(38); for (let k = 0; k < 4; k++) a[effective[weights.jointArray[i * 4 + k]]] += weights.weightArray[i * 4 + k]; return a; });
  const iterations = 48, strength = .45;
  for (let iteration = 0; iteration < iterations; iteration++) {
    data = data.map((a, u) => {
      const next = new Float64Array(38), total = [...neighbors[u].values()].reduce((s, w) => s + w, 0);
      if (!total) return a;
      for (let j = 0; j < 38; j++) {
        if (!allowed(u, j)) continue; let average = 0; for (const [v, w] of neighbors[u]) average += data[v][j] * w / total;
        next[j] = a[j] * (1 - strength) + average * strength;
      }
      const sum = next.reduce((s, w) => s + w, 0); if (sum < 1e-8) throw Error('Anatomical regularization removed every influence');
      return next.map(w => w / sum);
    });
  }
  const mass = new Float64Array(38);
  points.forEach((_, i) => {
    const selected = [...data[ids[i]]].map((w, j) => [j, w]).filter(([, w]) => w > 1e-8).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = selected.reduce((s, [, w]) => s + w, 0);
    weights.jointArray.fill(0, i * 4, i * 4 + 4); weights.weightArray.fill(0, i * 4, i * 4 + 4);
    selected.forEach(([j, w], k) => { const aliases = members.get(j), member = aliases[(ids[i] + j) % aliases.length]; weights.jointArray[i * 4 + k] = member; weights.weightArray[i * 4 + k] = w / sum; mass[member] += w / sum; });
  });
  weights.permittedLegs = points.map((_, i) => permittedLegs[ids[i]]);
  weights.regularization = { iterations, strength, weldedVertices: representatives.length, adjacency: 'Actual indexed surface welded only at identical positions; inverse-edge-length weighted smoothing; per-vertex anatomical masks retained.' };
  weights.equivalentGroups = [...members].filter(([, a]) => a.length > 1).map(([representative, members]) => ({ representative, members }));
  weights.regularization.equivalentSkinGroups = weights.equivalentGroups.map(g => ({ representative: rig.names[g.representative], members: g.members.map(j => rig.names[j]) }));
  weights.jointWeightMass = Object.fromEntries(rig.names.map((n, i) => [n, round(mass[i])]));
}

export async function bindDog(config) {
  const input = path.resolve(ROOT, config.input ?? 'tools/hunter-dog/source/meshy-body.glb'), donorPath = path.resolve(ROOT, config.donor ?? 'tools/hunter-dog/source/original-dog.glb');
  const outputRoot = path.resolve(ROOT, config.out ?? 'artifacts/hunter-dog/bound'), allowedRoot = path.join(ROOT, 'artifacts/hunter-dog');
  const relation = path.relative(allowedRoot, outputRoot); if (relation.startsWith('..') || path.isAbsolute(relation) || !relation) throw Error('Output must be a child of artifacts/hunter-dog');
  await fs.mkdir(outputRoot, { recursive: true });
  const resolvedOutput = await fs.realpath(outputRoot), resolvedAllowed = await fs.realpath(allowedRoot);
  if (path.relative(resolvedAllowed, resolvedOutput).startsWith('..')) throw Error('Output symlink leaves artifacts/hunter-dog');
  const [inputBytes, donorBytes, recipeBytes] = await Promise.all([fs.readFile(input), fs.readFile(donorPath), fs.readFile(path.resolve(ROOT, config.landmarks ?? 'tools/hunter-dog/bind-landmarks.json'))]);
  if (sha(donorBytes) !== '8e6ba30272053c7432c4b05c0979b4e2f111f1ca36ae5b646a18a3cf3d7763d3') throw Error('Donor is not the audited frozen original');
  const recipe = JSON.parse(recipeBytes), donor = await readGLB(donorBytes), raw = await readGLB(inputBytes);
  if (sha(inputBytes) !== recipe.sourceSHA256) throw Error('Input is not the frozen inspected Meshy source; re-inspect before changing the recipe');
  const [source, ds] = await Promise.all([surface(raw), surface(donor, true)]);
  if (sha(source.position.raw) !== recipe.positionSHA256) throw Error('Geometry changed: re-inspect landmarks rather than bind an unrelated body');
  if (raw.json.materials?.length !== 1 || raw.json.images?.length !== 1 || raw.json.materials[0].alphaMode !== 'OPAQUE') throw Error('Expected the inspected single opaque textured material');
  const norm = normalization(source, recipe), points = source.points.map(norm.transform), rig = fitRig(donor, recipe, norm), weights = await transfer(donor, ds, rig, points, recipe);
  regularize(weights, points, source.indices, rig);
  const normals = source.normal.values, normalMatrix = new Matrix3().getNormalMatrix(source.meshWorld), normalizedNormals = new Float32Array(normals.length);
  for (let i = 0; i < normals.length; i += 3) vec(Array.from(normals.slice(i, i + 3))).applyMatrix3(normalMatrix).normalize().applyQuaternion(norm.rotation).toArray(normalizedNormals, i);
  const { sharp, location: sharpLocation } = await installedSharp(config.sharp ?? process.env.HUNTER_DOG_SHARP);
  const image = raw.json.images[0], view = raw.json.bufferViews[image.bufferView];
  if (view.buffer !== 0 || image.uri) throw Error('Texture must be embedded');
  const texture = raw.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), metadata = await sharp(texture).metadata();
  if (metadata.width > 2048 || metadata.height > 2048 || metadata.hasAlpha) throw Error('Unexpected texture dimensions/alpha; inspect before encoding');
  const chosen = await sharp(texture).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
  const encodedMetadata = await sharp(chosen).metadata();
  const [originalPixels, encodedPixels] = await Promise.all([sharp(texture).resize({ width: encodedMetadata.width, height: encodedMetadata.height }).raw().toBuffer(), sharp(chosen).raw().toBuffer()]);
  let squaredError = 0; for (let i = 0; i < originalPixels.length; i++) squaredError += (originalPixels[i] - encodedPixels[i]) ** 2;
  const mse = squaredError / originalPixels.length, psnr = mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse);
  const b = glbBuilder(), positions = new Float32Array(points.length * 3); points.forEach((p, i) => p.toArray(positions, i * 3));
  const attrs = { POSITION: b.attribute(positions, 'VEC3', 5126, false, true), NORMAL: b.attribute(normalizedNormals, 'VEC3', 5126), TEXCOORD_0: b.attribute(new Float32Array((await raw.accessor(source.primitive.attributes.TEXCOORD_0)).values), 'VEC2', 5126), JOINTS_0: b.attribute(weights.jointArray, 'VEC4', 5121), WEIGHTS_0: b.attribute(weights.weightArray, 'VEC4', 5126) };
  const indices = b.attribute(new Uint16Array(source.indices), 'SCALAR', 5123), inverses = new Float32Array(38 * 16); rig.fitted.forEach((m, i) => m.clone().invert().toArray(inverses, i * 16));
  const inverseBindMatrices = b.attribute(inverses, 'MAT4', 5126), imageView = b.view(chosen);
  const nodes = [...rig.nodes, { name: 'hunter-dog-mesh', mesh: 0, skin: 0 }, { name: 'dog 3d model', children: [rig.parents.indexOf(-1), 38] }];
  const json = { asset: { version: '2.0', generator: 'ThaiNativeOnline local hunter-dog donor binder v1' }, scene: 0, scenes: [{ name: 'hunter-dog-candidate', nodes: [39] }], nodes,
    meshes: [{ name: 'Meshy hunter companion', primitives: [{ attributes: attrs, indices, material: 0, mode: 4 }] }],
    skins: [{ name: 'dog 3d model', joints: Array.from({ length: 38 }, (_, i) => i), inverseBindMatrices }],
    materials: structuredClone(raw.json.materials), textures: structuredClone(raw.json.textures), samplers: structuredClone(raw.json.samplers ?? []), images: [{ mimeType: 'image/jpeg', bufferView: imageView }],
    extras: { candidateOnly: true, sourceSHA256: sha(inputBytes), donorSHA256: sha(donorBytes), landmarkSHA256: sha(recipeBytes), canonicalWithersMeters: recipe.shoulderMetersBeforeRuntimeScale, provider: 'Meshy', rig: 'local fitted 38-joint Tripo donor; no generated motion clips' } };
  const bytes = b.finish(json), candidate = path.join(outputRoot, 'hunter-dog-bound.glb');
  if ([input, donorPath].includes(candidate)) throw Error('Candidate must not overwrite input');
  await fs.writeFile(candidate, bytes);
  await fs.writeFile(path.join(outputRoot, 'fitted-rig.png'), projectionPNG(points, source.indices, rig.target, rig.parents.flatMap((p, i) => p < 0 ? [] : [[p, i]])));
  await fs.writeFile(path.join(outputRoot, 'donor-proxy.png'), projectionPNG(weights.proxy, ds.indices, rig.target, rig.parents.flatMap((p, i) => p < 0 ? [] : [[p, i]])));
  const audit = await auditCandidate(candidate, points, source.indices, rig, recipe, outputRoot, weights, donorBytes);
  audit.downloadBudget = { maximumBytes: 1200000, actualBytes: bytes.length, passed: bytes.length <= 1200000 };
  const report = { version: 1, candidateOnly: true, publicationApproved: false, source: { path: input, bytes: inputBytes.length, sha256: sha(inputBytes), positionSHA256: sha(source.position.raw) },
    donor: { path: donorPath, bytes: donorBytes.length, sha256: sha(donorBytes) }, output: { path: candidate, bytes: bytes.length, sha256: sha(bytes) },
    normalization: { yawRadians: norm.yaw, scale: norm.scale, rawGroundY: norm.origin.y, rawAnatomicalOrigin: xyz(norm.origin), canonicalWithers: xyz(norm.withers), canonicalWithersMeters: recipe.shoulderMetersBeforeRuntimeScale, builderWithersMeters: recipe.shoulderMetersBeforeRuntimeScale * 1.25, worldWithersMeters: recipe.shoulderMetersBeforeRuntimeScale * 1.25 * .8, builderScale: 1.25, worldActorScale: .8, note: 'No vertex editing beyond uniform scale, yaw and translation; genuine head turn and lowered tail retained.' },
    geometry: { vertices: points.length, triangles: source.indices.length / 3, rawBounds: { min: xyz(source.box.min), max: xyz(source.box.max) }, candidateBounds: { min: xyz(new Box3().setFromPoints(points).min), max: xyz(new Box3().setFromPoints(points).max) }, topologyAndUVsPreserved: true },
    rig: { joints: rig.names.length, namesAndHierarchyPreserved: true, fittedJointPositions: Object.fromEntries(rig.names.map((n, i) => [n, xyz(rig.target[i])])), orientation: 'Minimal world rotation projects each source chain direction onto fitted anatomical direction, preserving donor roll; inverse binds recomputed.' },
    transfer: { method: 'Four-influence barycentric nearest triangle on fitted donor proxy; regional BVHs; opposite limbs excluded; exact seam copies share weights.', regularization: weights.regularization, regions: weights.metrics, worstPrunedMass: weights.worstPrunedMass, jointWeightMass: weights.jointWeightMass, maximumPermittedDistanceMeters: recipe.limits.maxTransferDistanceMeters },
    texture: { processor: sharpLocation, sourceBytes: texture.length, outputBytes: chosen.length, sourceWidth: metadata.width, sourceHeight: metadata.height, width: encodedMetadata.width, height: encodedMetadata.height, encoding: '1024 edge, JPEG quality 90, 4:4:4, mozjpeg; unchanged UVs, material and texture design; canonical source retains original 2048 JPEG', psnrVsDownsampledSourceDb: psnr, pixelRMSEVsDownsampledSource: Math.sqrt(mse) }, audit,
    limitations: [...recipe.notes, 'Numerical audit runs the actual existing procedural controller in Node Three with texture decoding stubbed. It does not approve material appearance or gameplay-camera readability.', 'Existing controller has no independent jaw animation or planted-foot IK. Pose strain/floor measurements are reported without hiding inherited gait limitations.', 'Candidate is not compressed with gltfpack; no publication, runtime modification, build or browser run occurs.'] };
  await fs.writeFile(path.join(outputRoot, 'bind-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (sha(await fs.readFile(input)) !== sha(inputBytes) || sha(await fs.readFile(donorPath)) !== sha(donorBytes)) throw Error('Source changed during binding; discard this receipt');
  console.log(JSON.stringify({ candidate, report: path.join(outputRoot, 'bind-report.json'), bytes: bytes.length, sha256: sha(bytes), structuralPass: audit.structuralPass, poseFinite: audit.poseFinite, poseStrainPass: audit.poseStrainPass, textureBytes: chosen.length, regions: weights.metrics }));
  if (!audit.structuralPass || !audit.poseFinite || !audit.poseStrainPass || !audit.downloadBudget.passed) throw Error('Candidate failed numeric gates; report retained for diagnosis, publication prohibited');
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.includes('--help')) console.log('node tools/hunter-dog/bind.mjs [raw.glb] [--donor donor.glb] [--landmarks recipe.json] [--out artifacts/hunter-dog/child] [--sharp installed-package-directory]\nDefaults: tools/hunter-dog/source/meshy-body.glb and original-dog.glb; output artifacts/hunter-dog/bound.\nExisting sharp is resolved locally, then tools/monster-models/node_modules, then bundled runtime. HUNTER_DOG_SHARP or --sharp accepts another installed package. No installation or network calls.');
  else await bindDog(options(process.argv.slice(2)));
}
