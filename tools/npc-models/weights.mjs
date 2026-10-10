import { THREE, worldVertices, canonicalWorlds } from './rig.mjs';

export function surfaceGraph(rig, frame) {
  const source = worldVertices(rig), points = [], vertexWeld = [], byPosition = new Map();
  for (let i = 0; i < source.length; i += 3) {
    const p = new THREE.Vector3().fromArray(source, i).applyMatrix4(frame.matrix), key = p.toArray().map(v => Math.round(v * 1e6)).join(':');
    if (!byPosition.has(key)) { byPosition.set(key, points.length); points.push(p); } vertexWeld.push(byPosition.get(key));
  }
  const adjacent = points.map(() => new Set()), ids = rig.mesh.geometry.index?.array ?? Array.from({ length: vertexWeld.length }, (_, i) => i);
  for (let i = 0; i < ids.length; i += 3) for (const [a, b] of [[ids[i], ids[i + 1]], [ids[i + 1], ids[i + 2]], [ids[i + 2], ids[i]]]) {
    const x = vertexWeld[a], y = vertexWeld[b]; if (x !== y) { adjacent[x].add(y); adjacent[y].add(x); }
  }
  const components = [], labels = points.map(() => -1);
  for (let i = 0; i < points.length; i++) if (labels[i] < 0) {
    const members = [i], id = components.length; labels[i] = id;
    for (let n = 0; n < members.length; n++) for (const j of adjacent[members[n]]) if (labels[j] < 0) { labels[j] = id; members.push(j); }
    components.push(members);
  }
  return { points, adjacent, vertexWeld, components, labels };
}

export function inspectSurfaces(rig, frame) {
  const graph = surfaceGraph(rig, frame);
  return graph.components.map((members, id) => ({ id, vertices: members.length, min: [0, 1, 2].map(k => Math.min(...members.map(i => graph.points[i].getComponent(k)))), max: [0, 1, 2].map(k => Math.max(...members.map(i => graph.points[i].getComponent(k)))) })).sort((a, b) => b.vertices - a.vertices);
}

export function equivalentSkinJoints(rig, restWorlds, animations) {
  const names = rig.mesh.skeleton.bones.map(o => rig.objectNames.get(o)), inverse = names.map(n => restWorlds.get(n).clone().invert()), parent = new Map(rig.objects.map(o => [rig.objectNames.get(o), rig.objectNames.get(o.parent)]));
  const error = Array.from({ length: names.length }, () => new Float64Array(names.length));
  for (const animation of animations) for (const pose of animation.poses) {
    const worlds = new Map();
    for (const p of pose) { const matrix = new THREE.Matrix4().compose(p.p, p.q, p.s), ancestor = parent.get(p.name); if (ancestor) matrix.premultiply(worlds.get(ancestor)); worlds.set(p.name, matrix); }
    const skin = names.map((n, i) => worlds.get(n).clone().multiply(inverse[i]).elements);
    for (let i = 0; i < skin.length; i++) for (let j = 0; j < i; j++) for (let k = 0; k < 16; k++) error[i][j] = Math.max(error[i][j], Math.abs(skin[i][k] - skin[j][k]));
  }
  const alias = names.map((_, i) => i), groups = [];
  for (let i = 0; i < names.length; i++) for (let j = 0; j < i; j++) if (error[i][j] <= 1e-5) { alias[i] = alias[j]; break; }
  for (let j = 0; j < names.length; j++) {
    const members = names.filter((_, i) => alias[i] === j); if (members.length > 1) groups.push({ bone: names[j], members, maxMatrixError: Math.max(...members.map(n => { const i = names.indexOf(n); return error[Math.max(i, j)][Math.min(i, j)]; })) });
  }
  return { alias, groups, tolerance: 1e-5 };
}

export function continuousFourWeights(values) {
  if (values.length < 4 || Array.from(values).some(v => !Number.isFinite(v) || v < 0)) throw Error('Invalid influence field');
  const ranked = Array.from(values, (v, j) => ({ j, v })).sort((a, b) => b.v - a.v), cutoff = ranked[4]?.v ?? 0;
  const strongest = ranked.slice(0, 4).map(x => ({ j: x.j, v: Math.max(0, x.v - cutoff) })), sum = strongest.reduce((s, x) => s + x.v, 0);
  if (sum < 1e-10) throw Error('Ambiguous evenly distributed repair weights');
  return strongest.map(x => ({ j: x.j, v: x.v / sum }));
}

// Corrections are opt-in and hash-pinned in the calibration. Smooth along real
// triangle adjacency, never through air between clothing, hands or two legs.
export function repairWeights(rig, frame, profile, equivalent = null) {
  const config = profile.weightRepair; if (!config) return null;
  const iterations = config.iterations ?? 24;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1024) throw Error('Bounded weight smoothing iterations required');
  const graph = surfaceGraph(rig, frame), jointCount = rig.mesh.skeleton.bones.length, { skinIndex, skinWeight } = rig.mesh.geometry.attributes;
  let values = graph.points.map(() => new Float64Array(jointCount)), counts = graph.points.map(() => 0);
  const jointIDs = new Map(rig.mesh.skeleton.bones.map((o, i) => [rig.objectNames.get(o), i]));
  for (let i = 0; i < graph.vertexWeld.length; i++) { const w = graph.vertexWeld[i]; counts[w]++; for (let k = 0; k < 4; k++) values[w][skinIndex.getComponent(i, k)] += skinWeight.getComponent(i, k); }
  for (let i = 0; i < values.length; i++) for (let j = 0; j < jointCount; j++) values[i][j] /= counts[i];
  const fixed = new Set();
  const worlds = canonicalWorlds(rig, frame);
  for (const item of config.protectRigid ?? []) {
    const name = typeof item === 'string' ? item : item.bone, minimumDistance = typeof item === 'string' ? 0 : item.minimumDistance;
    if (!jointIDs.has(name)) throw Error(`Unknown protected rigid joint: ${name}`);
    if (!Number.isFinite(minimumDistance) || minimumDistance < 0) throw Error('Invalid measured rigid protection distance');
    const j = jointIDs.get(name), origin = new THREE.Vector3().setFromMatrixPosition(worlds.get(name));
    for (let i = 0; i < values.length; i++) if (values[i][j] >= 0.995 && graph.points[i].distanceTo(origin) >= minimumDistance) { values[i].fill(0); values[i][j] = 1; fixed.add(i); }
  }
  for (const region of config.regions ?? []) {
    if (!jointIDs.has(region.bind)) throw Error(`Unknown repair-region bone: ${region.bind}`);
    if (!Array.isArray(region.min) || !Array.isArray(region.max) || region.min.length !== 3 || region.max.length !== 3 || ![...region.min, ...region.max].every(Number.isFinite)) throw Error('Explicit measured repair bounds required');
    for (let i = 0; i < values.length; i++) if (graph.points[i].toArray().every((v, k) => v >= region.min[k] && v <= region.max[k])) {
      values[i].fill(0); values[i][jointIDs.get(region.bind)] = 1; if (region.fixed !== false) fixed.add(i);
    }
  }
  const forbidden = (config.exclude ?? []).map(rule => {
    if (!rule.bones?.every(n => jointIDs.has(n)) || !Array.isArray(rule.min) || !Array.isArray(rule.max)) throw Error('Explicit measured excluded influence region required');
    return { ...rule, ids: rule.bones.map(n => jointIDs.get(n)) };
  });
  const constrain = (weights, i) => {
    for (const rule of forbidden) if (graph.points[i].toArray().every((v, k) => v >= rule.min[k] && v <= rule.max[k])) for (const j of rule.ids) weights[j] = 0;
    const sum = weights.reduce((a, b) => a + b, 0); if (!(sum > 0)) throw Error('Repair excluded every influence');
    for (let j = 0; j < jointCount; j++) weights[j] /= sum;
  };
  for (let i = 0; i < values.length; i++) constrain(values[i], i);
  const seed = values.map(v => v.slice()), anchor = config.anchor ?? 0.05;
  if (!Number.isFinite(anchor) || anchor < 0 || anchor > 1) throw Error('Weight smoothing anchor must be 0..1');
  for (let pass = 0; pass < iterations; pass++) {
    const next = values.map(v => v.slice());
    for (let i = 0; i < values.length; i++) if (!fixed.has(i) && graph.adjacent[i].size) {
      const total = new Float64Array(jointCount); let sum = 0;
      for (const j of graph.adjacent[i]) { const weight = 1 / Math.max(0.003, graph.points[i].distanceTo(graph.points[j])); sum += weight; for (let k = 0; k < jointCount; k++) total[k] += values[j][k] * weight; }
      for (let k = 0; k < jointCount; k++) next[i][k] = anchor * seed[i][k] + (1 - anchor) * (0.5 * values[i][k] + 0.5 * total[k] / sum);
      constrain(next[i], i);
    }
    values = next;
  }
  let changedVertices = 0, maxWeightChange = 0;
  for (let i = 0; i < graph.vertexWeld.length; i++) {
    const w = values[graph.vertexWeld[i]].slice();
    if (equivalent) for (let j = 0; j < jointCount; j++) if (equivalent.alias[j] !== j) { w[equivalent.alias[j]] += w[j]; w[j] = 0; }
    // Subtract the fifth influence before normalization. At a fourth/fifth
    // crossover both vanish continuously instead of exchanging a nonzero
    // weight across a short edge. Hard top-four truncation creates new seams.
    const strongest = continuousFourWeights(w), old = new Float64Array(jointCount);
    for (let k = 0; k < 4; k++) old[skinIndex.getComponent(i, k)] += skinWeight.getComponent(i, k);
    let delta = 0;
    for (let k = 0; k < 4; k++) { skinIndex.setComponent(i, k, strongest[k].j); skinWeight.setComponent(i, k, strongest[k].v); }
    for (let j = 0; j < jointCount; j++) { const item = strongest.find(v => v.j === j); delta = Math.max(delta, Math.abs(old[j] - (item ? item.v : 0))); }
    if (delta > 1e-6) changedVertices++; maxWeightChange = Math.max(maxWeightChange, delta);
  }
  return { method: 'Position-welded triangle adjacency; inverse-edge-length diffusion with explicit anatomical exclusions/cloth anchors. Merge only joints with identical actual skin matrices at all baked samples. Continuous four-influence sparsification subtracts the fifth weight before normalization to prevent nonzero support swaps.', iterations, anchor, uniqueSurfaceVertices: graph.points.length, connectedComponents: graph.components.length, fixedSurfaceVertices: fixed.size, changedVertices, maxWeightChange, equivalentSkinGroups: equivalent?.groups ?? [] };
}
