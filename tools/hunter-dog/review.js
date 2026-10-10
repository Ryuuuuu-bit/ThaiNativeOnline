import * as THREE from 'three';
import { makeDog, preloadDog } from '/src/classes/dog.js';
import { gltfLoader } from '/src/core/gltf.js';

const query = new URLSearchParams(location.search), rawPath = query.get('raw'), rawMode = rawPath !== null;
const baseline = !rawMode && query.get('baseline') === '1';
const seed = Number(query.get('seed') ?? 3334) >>> 0;
let randomState = seed;
Math.random = () => {
  randomState += 0x6D2B79F5;
  let n = Math.imul(randomState ^ randomState >>> 15, randomState | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};

const sourceUrl = rawMode ? `/${rawPath.replace(/^\/+/, '')}` : baseline ? '/artifacts/hunter-dog/baseline.glb' : '/models/hunter-dog.glb';
// Only this isolated review page redirects the dog asset. Keep makeDog's real
// procedural/clip controller, normalization, materials and asynchronous attach.
THREE.DefaultLoadingManager.setURLModifier(url => {
  const pathname = new URL(url, location.href).pathname;
  return baseline && pathname.endsWith('/models/hunter-dog.glb') ? new URL(sourceUrl, location.href).href : url;
});
const assetErrors = [];
THREE.DefaultLoadingManager.onError = url => assetErrors.push({ url, message: 'Three.js asset load failed' });
const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(960, 720, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9ded1');
scene.add(new THREE.HemisphereLight('#fff9ed', '#899481', 2.5));
const sun = new THREE.DirectionalLight('#fff1d5', 2.6); sun.position.set(-4, 7, 5);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .02;
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 25 });
scene.add(sun);
const fill = new THREE.DirectionalLight('#e8f2ff', .7); fill.position.set(3, 3, -4); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#abb8a0', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.006; ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 80);
const views = rawMode ? ['front', 'side', 'back', 'three-quarter', 'gameplay'] : ['front', 'front-close', 'side', 'back', 'three-quarter', 'gameplay'];
const phases = rawMode ? ['static'] : ['idle', 'trot', 'run', 'attack', 'bite', 'howl', 'glow'];
const cases = phases.flatMap(phase => views.filter(view => view !== 'front-close').map(view => ({ id: `${view}-${phase}`, phase, view, time: rawMode ? 0 : .5,
  amount: phase === 'bite' ? .45 : 1 })));
for (const [phase, amounts] of rawMode ? [] : [['bite', [.1, .55, .9]], ['attack', [.1, .55, .9]], ['howl', [.25]], ['glow', [.35]]]) {
  for (const amount of amounts) for (const view of ['bite', 'attack'].includes(phase) ? ['front-close', 'side', 'gameplay'] : ['side', 'gameplay']) {
    cases.push({ id: `${view}-${phase}-${String(amount).replace('.', '-')}`, phase, view,
      time: phase === 'attack' ? amount / 2.4 : .5, amount: phase === 'attack' ? 1 : amount,
      ...(phase === 'attack' ? { expectedCyclePhase: amount } : {}) });
  }
}
let dog = null, cachedSource = null, sweptBounds = new THREE.Box3(), ready = false;
let rawSourceAudit = null, normalization = null;
const closeBounds = new THREE.Box3();

const finite = values => values.every(Number.isFinite);
function audit(object, worldVertices = null) {
  object.updateMatrixWorld(true);
  object.traverse(o => o.skeleton?.update());
  const errors = [], bounds = new THREE.Box3(), point = new THREE.Vector3(), geometries = new Set(), skeletons = new Set();
  const bones = [], materials = new Set();
  let meshes = 0, skinnedMeshes = 0, triangles = 0, vertices = 0, minimumY = Infinity;
  object.traverse(o => {
    if (!finite(o.matrixWorld.elements)) errors.push(`Nonfinite world matrix: ${o.name}`);
    if (o.isBone) {
      const local = [...o.position, ...o.quaternion, ...o.scale];
      if (!finite(local)) errors.push(`Nonfinite bone transform: ${o.name}`);
      bones.push({ name: o.name, position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray(), matrixWorld: [...o.matrixWorld.elements] });
    }
    if (!o.isMesh || !o.visible) return;
    meshes++; if (o.isSkinnedMesh) skinnedMeshes++;
    const position = o.geometry?.attributes.position;
    if (!position) { errors.push(`Missing vertex positions: ${o.name}`); return; }
    if (worldVertices && !worldVertices.has(o)) worldVertices.set(o, new Float64Array(position.count * 3));
    const coordinates = worldVertices?.get(o);
    if (!geometries.has(o.geometry)) { geometries.add(o.geometry); triangles += (o.geometry.index?.count ?? position.count) / 3; }
    if (o.skeleton && !skeletons.has(o.skeleton)) {
      skeletons.add(o.skeleton);
      if (!finite(Array.from(o.skeleton.boneMatrices))) errors.push(`Nonfinite skin palette: ${o.name}`);
    }
    for (let i = 0; i < position.count; i++) {
      vertices++;
      if (!finite([position.getX(i), position.getY(i), position.getZ(i)])) { errors.push(`Nonfinite rest vertex: ${o.name}/${i}`); continue; }
      o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld);
      if (coordinates) coordinates.set([point.x, point.y, point.z], i * 3);
      if (!finite(point.toArray())) { errors.push(`Nonfinite deformed vertex: ${o.name}/${i}`); continue; }
      bounds.expandByPoint(point); minimumY = Math.min(minimumY, point.y);
    }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) materials.add(m);
  });
  if (bounds.isEmpty()) errors.push('Empty visible geometry bounds');
  const size = bounds.getSize(new THREE.Vector3());
  if (!finite([...bounds.min, ...bounds.max, ...size])) errors.push('Nonfinite visible geometry bounds');
  return { passed: errors.length === 0, errors, meshes, skinnedMeshes, vertices, triangles, boneCount: bones.length, bones,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() }, minimumY,
    emissive: [...materials].map(m => ({ name: m.name, color: m.color?.toArray() ?? null, intensity: m.emissiveIntensity ?? null, emissive: m.emissive?.toArray() ?? null })) };
}

function headBounds(object) {
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  object.traverseVisible(o => {
    if (!o.isSkinnedMesh) return;
    const ids = new Set(o.skeleton.bones.flatMap((b, i) => ['tripoHead_0', 'tripoSpine_6', 'tripoSpine_7'].includes(b.name.replace(/:/g, '')) ? [i] : []));
    const indices = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
    if (!ids.size || !indices || !weights) return;
    for (let i = 0; i < indices.count; i++) {
      let influence = 0;
      for (let j = 0; j < 4; j++) if (ids.has(indices.getComponent(i, j))) influence += weights.getComponent(i, j);
      if (influence >= .25) bounds.expandByPoint(o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld));
    }
  });
  return bounds;
}

function includeBounds(result) {
  if (!result.passed) return;
  sweptBounds.union(new THREE.Box3(new THREE.Vector3(...result.bounds.min), new THREE.Vector3(...result.bounds.max)));
  if (!rawMode) closeBounds.union(headBounds(dog));
}

function disposeDog() {
  if (!dog) return;
  // The raw display wrapper owns no mesh resources; its imported source is
  // released once by shutdown, including materials and textures.
  if (rawMode) { scene.remove(dog); dog = null; return; }
  const geometries = new Set(), materials = new Set(), skeletons = new Set();
  dog.userData.dispose?.(); scene.remove(dog);
  dog.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) geometries.add(o.geometry);
    if (o.skeleton) skeletons.add(o.skeleton);
    for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) materials.add(m);
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose());
  dog = null; renderer.renderLists.dispose();
}

async function freshDog() {
  disposeDog();
  dog = makeDog({ transient: true });
  dog.scale.setScalar(.8); // CombatView's actual heeling companion scale.
  scene.add(dog);
  if (dog.userData.ready) await dog.userData.ready;
  // Original makeDog attaches its cached source in a promise continuation.
  await Promise.resolve(); await Promise.resolve();
}

function options(sample) {
  return { run: sample.phase === 'run' ? 1 : 0,
    bite: sample.phase === 'bite' ? sample.amount : undefined,
    howl: sample.phase === 'howl' ? sample.amount : 0,
    glow: sample.phase === 'glow' ? sample.amount : 0 };
}

function animatorArguments(sample) {
  return { t: sample.time, moving: sample.phase === 'trot' || sample.phase === 'run', attacking: sample.phase === 'attack', options: options(sample) };
}

async function samplePose(sample) {
  if (!phases.includes(sample.phase) || !views.includes(sample.view) || !Number.isFinite(sample.time) || sample.time < 0 || sample.time > 3
    || !Number.isFinite(sample.amount) || sample.amount < 0 || sample.amount > 1) throw Error('Invalid bounded dog pose');
  if (rawMode) return audit(dog); // Static imported geometry: no invented rig or animation.
  await freshDog();
  const { moving, attacking } = animatorArguments(sample);
  // Small fixed steps support both the original procedural controller and a
  // candidate mixer without jumps, wall-clock timing or accumulated old state.
  for (let frame = 0; frame <= Math.ceil(sample.time * 30); frame++) {
    dog.userData.animate?.(Math.min(frame / 30, sample.time), moving, attacking, options(sample));
  }
  const result = audit(dog);
  let sourceBones = 0; cachedSource?.traverse(o => { if (o.isBone) sourceBones++; });
  if (sourceBones > 0 && !result.skinnedMeshes) { result.errors.push('Rigged source failed to attach; primitive fallback is visible'); result.passed = false; }
  return result;
}

// Bind-geometry edges in this actual instance's initial world scale; never
// substitute another mesh or use an already-deformed idle as the rest edge.
function edgeReferences(object) {
  const meshes = [], restBounds = new THREE.Box3(), point = new THREE.Vector3();
  let ignoredDegenerateEdges = 0;
  object.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const rest = new Float64Array(position.count * 3), edges = [], unique = new Set();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      rest.set([point.x, point.y, point.z], i * 3); restBounds.expandByPoint(point);
    }
    const count = index?.count ?? position.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const triangle = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      for (const [a0, b0] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
        const a = Math.min(a0, b0), b = Math.max(a0, b0), key = a * position.count + b;
        if (unique.has(key)) continue; unique.add(key);
        const length = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
        if (length <= 1e-8) { ignoredDegenerateEdges++; continue; }
        edges.push({ a, b, length });
      }
    }
    meshes.push({ mesh, name: mesh.name, meshIndex: meshes.length, indexed: !!index, edges });
  });
  return { meshes, restBounds, ignoredDegenerateEdges };
}

function measureEdges(reference, worldVertices) {
  let count = 0, maximumRatio = -Infinity, minimumRatio = Infinity, above2 = 0, belowQuarter = 0, nonfinite = 0;
  let maximumWitness = null, minimumWitness = null;
  for (const item of reference.meshes) {
    const p = worldVertices.get(item.mesh);
    for (const { a, b, length } of item.edges) {
      const current = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]), ratio = current / length;
      count++;
      if (!Number.isFinite(ratio)) { nonfinite++; continue; }
      if (ratio > 2) above2++; if (ratio < .25) belowQuarter++;
      const witness = () => ({ meshIndex: item.meshIndex, mesh: item.name, sourceVertexIndices: [a, b], restLength: length, posedLength: current, ratio });
      if (ratio > maximumRatio) { maximumRatio = ratio; maximumWitness = witness(); }
      if (ratio < minimumRatio) { minimumRatio = ratio; minimumWitness = witness(); }
    }
  }
  return { count, maximumRatio: maximumWitness ? maximumRatio : null, minimumRatio: minimumWitness ? minimumRatio : null,
    maximumWitness, minimumWitness, above2, belowQuarter, nonfinite };
}

async function sweepAudit() {
  if (!ready) throw Error('Dog review has not finished loading');
  if (rawMode) return { applicable: false, reason: 'Raw static geometry has no production animator' };
  const tracks = [], errors = [];
  for (const phase of ['bite', 'attack', 'trot', 'run']) {
    await freshDog();
    const initial = audit(dog);
    if (!initial.passed) { errors.push(...initial.errors.map(e => `${phase} reference: ${e}`)); continue; }
    const reference = edgeReferences(dog), worldVertices = new Map();
    const diagonal = reference.restBounds.getSize(new THREE.Vector3()).length();
    const envelope = reference.restBounds.clone().expandByScalar(diagonal * 2);
    const times = [...new Set([...Array.from({ length: 31 }, (_, i) => i / 30),
      ...(phase === 'bite' ? [.1, .55, .9] : phase === 'attack' ? [.1, .55, .9].map(p => p / 2.4) : [])])].sort((a, b) => a - b);
    const frames = [];
    for (const time of times) {
      const sample = { phase, time, amount: phase === 'bite' ? time : 1 }, args = animatorArguments(sample);
      dog.userData.animate?.(time, args.moving, args.attacking, args.options);
      const result = audit(dog, worldVertices), edges = measureEdges(reference, worldVertices);
      const withinEnvelope = result.passed && envelope.containsBox(new THREE.Box3(new THREE.Vector3(...result.bounds.min), new THREE.Vector3(...result.bounds.max)));
      const frameErrors = [...result.errors];
      if (!withinEnvelope) frameErrors.push('Outside bind-bounds gross-explosion safety envelope');
      if (edges.nonfinite) frameErrors.push(`${edges.nonfinite} nonfinite edge ratios`);
      errors.push(...frameErrors.map(e => `${phase}@${time}: ${e}`));
      includeBounds(result);
      frames.push({ time, ...(phase === 'attack' ? { cyclePhase: (time * 2.4) % 1 } : {}), animatorArguments: args,
        passed: frameErrors.length === 0, errors: frameErrors, vertexCount: result.vertices, boneCount: result.boneCount,
        bounds: result.bounds, minimumY: result.minimumY, withinEnvelope, edges });
    }
    tracks.push({ phase, actualAnimator: true, timeRangeSeconds: [0, 1], sampleRateHz: 30,
      additionalExactPhaseWitnesses: ['bite', 'attack'].includes(phase) ? [.1, .55, .9] : [], frameCount: frames.length,
      vertexSamples: frames.reduce((n, f) => n + f.vertexCount, 0), edgeSamples: frames.reduce((n, f) => n + f.edges.count, 0),
      boneTransformSamples: frames.reduce((n, f) => n + f.boneCount, 0), ignoredDegenerateEdges: reference.ignoredDegenerateEdges,
      edgeMeshCoverage: reference.meshes.map(m => ({ name: m.name, meshIndex: m.meshIndex, indexed: m.indexed, uniqueEdges: m.edges.length })),
      safetyEnvelope: { min: envelope.min.toArray(), max: envelope.max.toArray(), marginRestDiagonals: 2 }, frames });
  }
  return { applicable: true, passed: errors.length === 0 && tracks.length === 4, errors, tracks,
    frameCount: tracks.reduce((n, t) => n + t.frameCount, 0), vertexSamples: tracks.reduce((n, t) => n + t.vertexSamples, 0),
    edgeSamples: tracks.reduce((n, t) => n + t.edgeSamples, 0),
    policy: { passedMeans: 'Finite source/posed vertices, bone/skin matrices and ratios; bounds within a gross-explosion envelope only',
      edges: 'Unique triangle edges / bind-geometry edge lengths in initial instance world scale; <=1e-8 rest edges excluded and counted',
      edgeReviewSignals: 'Ratios >2 and <.25 are reported per frame for review, without an anatomy acceptance threshold',
      movement: 'trot is actual moving=true/run=0; run is moving=true/run=1; attack is attacking=true with no bite override',
      limits: 'No anatomy approval, contact, floor, collision or live combat timing gate; repeating attack sampled over 1 second (2.4 cycles)' } };
}

function fit(view) {
  const useHead = view === 'front-close' && !closeBounds.isEmpty(), bounds = useHead ? closeBounds : sweptBounds;
  const center = bounds.getCenter(new THREE.Vector3());
  const lift = rawMode ? 0 : .12;
  const offsets = { front: [0, lift, 1], 'front-close': [0, .04, 1], side: [1, lift, 0], back: [0, lift, -1], 'three-quarter': [1, .25, 1], gameplay: [.65, 1, 1] };
  const diagonal = sweptBounds.getSize(new THREE.Vector3()).length(), distance = Math.max(12, diagonal * 2);
  camera.far = Math.max(80, distance + diagonal * 2);
  camera.position.copy(center).add(new THREE.Vector3(...offsets[view]).normalize().multiplyScalar(distance));
  camera.lookAt(center); camera.updateMatrixWorld(true);
  let halfX = 0, halfY = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    halfX = Math.max(halfX, Math.abs(p.x)); halfY = Math.max(halfY, Math.abs(p.y));
  }
  const half = Math.max(halfY, halfX / (4 / 3), .2) * 1.16;
  Object.assign(camera, { left: -half * 4 / 3, right: half * 4 / 3, top: half, bottom: -half }); camera.updateProjectionMatrix();
  return { view, projection: 'orthographic', sourceAxisCameraOffset: offsets[view], position: camera.position.toArray(), target: center.toArray(), orthoHalfHeight: half,
    framingUsesAllSampledPoses: !rawMode, framingUsesStaticBounds: rawMode,
    scope: useHead ? 'Measured Head_0/Spine_6/Spine_7 skin vertices with >=.25 combined influence' : 'Whole sampled model',
    closeFrontFallback: view === 'front-close' && !useHead ? 'No head/neck skin mask; whole model retained' : null };
}

async function pose(sample) {
  if (!ready) throw Error('Dog review has not finished loading');
  const result = await samplePose(sample), framing = fit(sample.view);
  renderer.render(scene, camera);
  document.querySelector('#status').textContent = `${sample.phase} · ${sample.view} · ${result.meshes} meshes · ${result.triangles} triangles · ${result.boneCount} bones · ${result.passed ? 'finite geometry/transforms PASS' : result.errors.join('; ')}`;
  document.querySelector('#status').className = result.passed ? '' : 'bad';
  return { sample, ...(rawMode ? {} : { animatorArguments: animatorArguments(sample) }), ...result, framing,
    assetErrors: [...assetErrors], memory: { ...renderer.info.memory }, animationState: dog.userData.animationState?.() ?? null };
}

window.hunterDogReview = { ready: false, baseline, rawMode, seed, sourceUrl, cases, pose, sweepAudit,
  info() {
    if (rawMode) return { mode: 'raw', seed, sourceUrl, loader: 'gltfLoader().loadAsync', rawLoaded: !!cachedSource,
      animation: 'none; imported rest geometry only, no production builder', orientation: { upAxis: '+Y (glTF convention)',
        frontLabel: 'Camera on source +Z; muzzle direction unverified', sideLabel: 'Camera on source +X', backLabel: 'Camera on source -Z',
        rotationApplied: [0, 0, 0], sourceNodeTransforms: 'preserved' }, normalization, sourceAudit: rawSourceAudit,
      normalizedAudit: dog ? audit(dog) : null, assetErrors: [...assetErrors] };
    return { baseline, seed, sourceUrl, builder: 'makeDog({transient:true}) + preloadDog()', parentScale: .8,
    animator: 'current src/classes/dog.js; pinned independently from the baseline asset', sourceLoaded: !!cachedSource,
    sourceAudit: cachedSource ? audit(cachedSource) : null, sweptBounds: { min: sweptBounds.min.toArray(), max: sweptBounds.max.toArray() }, assetErrors: [...assetErrors] };
  },
  shutdown() {
    disposeDog();
    const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
    cachedSource?.traverse(o => {
      if (o.geometry) geometries.add(o.geometry); if (o.skeleton) skeletons.add(o.skeleton);
      for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) {
        materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose()); textures.forEach(t => t.dispose());
    ground.geometry.dispose(); ground.material.dispose(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss();
    THREE.DefaultLoadingManager.setURLModifier(undefined);
  } };

try {
  if (rawMode) {
    if (!rawPath || /[\\:?#]/.test(rawPath) || rawPath.startsWith('//') || rawPath.split('/').includes('..') || !/\.glb$/i.test(rawPath)) {
      throw Error('raw must be a workspace-served relative .glb path, without traversal, query or external URL');
    }
    const loaded = await gltfLoader().loadAsync(sourceUrl); cachedSource = loaded.scene;
    if (!cachedSource?.isObject3D) throw Error('Raw GLB has no scene');
    rawSourceAudit = audit(cachedSource);
    if (!rawSourceAudit.passed) throw Error(`Invalid raw source: ${rawSourceAudit.errors.join('; ')}`);
    const { min, max } = rawSourceAudit.bounds;
    const translation = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
    normalization = { method: 'bounds center X/Z; minimum Y to ground 0; translation only', translation,
      scaleApplied: [1, 1, 1], rotationApplied: [0, 0, 0], sourceBounds: rawSourceAudit.bounds,
      authoredSceneTransform: { position: cachedSource.position.toArray(), quaternion: cachedSource.quaternion.toArray(), scale: cachedSource.scale.toArray() },
      sourceUnits: 'as authored in GLB; no inferred species size or production scale', groundPlaneY: ground.position.y };
    dog = new THREE.Group(); dog.name = 'raw-dog-display'; dog.position.set(...translation); dog.add(cachedSource); scene.add(dog);
    cachedSource.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    document.querySelector('#phase').replaceChildren(new Option('static', 'static'));
    document.querySelector('#phase').disabled = true;
    document.querySelector('#view option[value="front-close"]').remove();
  } else {
    const loaded = await preloadDog(); cachedSource = loaded?.scene ?? loaded;
    if (!cachedSource?.isObject3D) { cachedSource = null; assetErrors.push({ url: sourceUrl, message: 'preloadDog returned no model; fallback only' }); }
  }
  for (const sample of cases) {
    const result = await samplePose(sample);
    includeBounds(result);
  }
  if (sweptBounds.isEmpty()) throw Error('No finite visible dog pose for framing');
  ready = true; window.hunterDogReview.ready = true;
  document.querySelector('#source').textContent = rawMode
    ? `Raw static GLB · ${sourceUrl} · translation only, no rotation/scale · front camera +Z (muzzle direction unverified)`
    : `${baseline ? 'Saved baseline asset' : 'Current production asset'} · ${sourceUrl} · current production animator`;
  await renderer.compileAsync(scene, camera);
  await pose({ id: rawMode ? 'three-quarter-static' : 'gameplay-idle', phase: rawMode ? 'static' : 'idle', view: rawMode ? 'three-quarter' : 'gameplay', time: rawMode ? 0 : .5, amount: 1 });
  document.querySelector('#view').value = rawMode ? 'three-quarter' : 'gameplay';
  document.querySelector('#sample').onclick = () => pose({ phase: document.querySelector('#phase').value, view: document.querySelector('#view').value, time: rawMode ? 0 : .5,
    amount: document.querySelector('#phase').value === 'bite' ? .45 : 1 }).catch(error => { document.querySelector('#status').textContent = error.message; });
} catch (error) {
  window.hunterDogReview.bootError = error.stack ?? String(error); document.querySelector('#status').textContent = error.message;
}
