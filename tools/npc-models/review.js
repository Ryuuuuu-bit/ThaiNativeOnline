import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { gltfLoader } from '/src/core/gltf.js';
import { NPC } from '/src/entities/NPC.js';
import { NPCS } from '/src/data/npcs.js';
import { makeLook } from '/src/npc/NPCData.js';
import { NPCRenderer } from '/src/npc/NPCRenderer.js';
import { NPCManager } from '/src/npc/NPCManager.js';
import { BODY_PARTS } from '/src/npc/body/bodyParts.js';
import { npcModelSpec, npcModelCache, createNPCModelCache, NPC_PROP_FRAMES } from '/src/npc/NPCModels.js';
import { WorldClock, PHASE_HOURS } from '/src/core/WorldClock.js';
import { CameraController } from '/src/core/CameraController.js';
import { Environment } from '/src/world/Environment.js';
import { buildWorld } from '/src/world/World.js';
import { J } from '/src/world/CityMap.js';
import { npcsForMap, walkable } from '/src/world/maps.js';

const params = new URLSearchParams(location.search), host = document.querySelector('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
host.append(renderer.domElement);
const scene = new THREE.Scene(), env = new Environment(scene, renderer);
const cameraController = new CameraController(renderer, host), camera = cameraController.camera;
const clock = new WorldClock({ hour: PHASE_HOURS.day }); clock.paused = true;
const stage = new THREE.Group(); scene.add(stage);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#b5b39b', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.005; floor.receiveShadow = true; stage.add(floor);
const focus = new THREE.Vector3(), bodyParts = new Set(BODY_PARTS.map(p => p.name));
const manifest = await fetch('/docs/art/npcs/NPC_MODEL_BRIEFS.json').then(r => { if (!r.ok) throw Error('NPC briefs unavailable'); return r.json(); });
const families = new Map(manifest.families.map(f => [f.id, f]));
let mode = 'registry', family = 'warp_keeper', npcs = [], npcRenderer = null, world = null, manager = null;
let raw = null, rawMixer = null, rawActions = {}, rawSource = null, rawPose = null;
let view = 'front', pose = 'idle', time = 0, playing = false, closed = false, selectedIds = [], assetUrl = null;
let loadGeneration = 0, disposedGroups = 0;
let detail = null;
const contactEvidence = new Map(), handIndices = new WeakMap();
const warnings = [], finite = a => Array.from(a).every(Number.isFinite);
const $ = id => document.getElementById(id);
const safeUrl = value => { const u = new URL(value, location.href); for (const k of [...u.searchParams.keys()]) if (k !== 'v') u.searchParams.set(k, '[redacted]'); return u.href; };
function disposeTree(root) {
  const gs = new Set(), ms = new Set(), ts = new Set(), ss = new Set();
  root?.traverse(o => { if (o.geometry) gs.add(o.geometry); if (o.skeleton) ss.add(o.skeleton);
    for (const m of [].concat(o.material ?? [])) { ms.add(m); for (const v of Object.values(m)) if (v?.isTexture) ts.add(v); } });
  gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose()); ts.forEach(t => t.dispose()); ss.forEach(s => s.dispose());
  root?.removeFromParent(); disposedGroups++;
}
function releaseScene() {
  manager?.dispose(); manager = null;
  if (npcRenderer) npcRenderer.dispose(); npcRenderer = null;
  world?.dispose(); world = null;
  rawMixer?.stopAllAction(); if (rawMixer && raw) rawMixer.uncacheRoot(raw);
  if (rawSource) for (const s of rawSource.scenes ?? [rawSource.scene]) disposeTree(s);
  raw?.removeFromParent(); raw = rawMixer = rawSource = null; rawActions = {}; rawPose = null; npcs = [];
  floor.visible = true; assetUrl = null;
  detail = null; contactEvidence.clear();
}
function brief() { return families.get(family); }
function definition(id) { const d = NPCS.find(n => n.id === id); if (!d) throw Error(`Unknown actual NPC: ${id}`); return d; }
function specUrl(spec) { return `${import.meta.env.BASE_URL}${spec.url}?v=${encodeURIComponent(spec.revision)}`; }
function poseOptions() { return [...new Set([...(mode === 'raw' ? ['rest'] : []), 'idle', 'walk', 'work', 'sit', 'talk', ...(brief()?.existingStateWitnesses ?? [])])]; }
function workPose(def) {
  for (const a of Object.values(def.schedule ?? {})) {
    const list = a.do === 'route' ? a.stops.filter(s => typeof s === 'object') : [a];
    const found = list.find(s => s.state === 'work'); if (found) return found.anim ?? 'work';
  }
  return (brief()?.existingStateWitnesses ?? []).find(s => !['idle', 'look', 'walk', 'talk', 'sit'].includes(s)) ?? 'work';
}
function registryRoles(id = selectedIds[0]) {
  const def = definition(id), found = [];
  for (const activity of Object.values(def.schedule ?? {})) {
    const stops = activity.do === 'route' ? activity.stops.filter(s => typeof s === 'object') : activity.do === 'home' ? [] : [activity];
    for (const stop of stops) {
      const role = { state: stop.state ?? 'idle', anim: stop.anim ?? 'look', carrying: false };
      // Use NPC.enter's actual seated-state rule; a carried route sack belongs
      // to walking, not an invented stationary work pose.
      if (['fish', 'mend', 'chant'].includes(role.anim)) role.state = 'sit';
      if (!found.some(r => r.state === role.state && r.anim === role.anim)) found.push(role);
    }
  }
  return found;
}
function setWitness({ id = selectedIds[0], state, anim, carrying = false, diagnosticNativeRun = false }) {
  if (mode !== 'registry') throw Error('Authored role witnesses require registry mode');
  const n = npcs.find(n => n.id === id); if (!n) throw Error('Witness NPC is absent');
  const generic = !carrying && [['idle', 'rest'], ['walk', 'walk'], ['talk', 'talk']].some(([s, a]) => state === s && anim === a);
  const nativeRun = diagnosticNativeRun && !carrying && state === 'walk' && anim === 'run';
  if (!generic && !nativeRun && !registryRoles(id).some(r => r.state === state && r.anim === anim && r.carrying === carrying)) throw Error('Unauthored role witness');
  pose = nativeRun ? 'diagnostic-native-run' : generic ? state : `${state}-${anim}`; time = 0; if (detail) view = 'front'; detail = null;
  n.release(); n.path = null; n.walkPhase = 0; n.plan = { kind: 'stay' }; n.enter(state, anim); n.carrying = carrying;
  if (state === 'talk') n.talkTo(n.x, n.z + 2);
  renderAt(0, true); updateControls(); return snapshot();
}
function updateControls() {
  $('mode').value = mode; $('family').value = family; $('source').value = params.get('source') ?? $('source').value;
  $('npc').replaceChildren(...(brief()?.npcIds ?? []).map(id => new Option(definition(id).name, id)));
  if (selectedIds[0] && [...$('npc').options].some(o => o.value === selectedIds[0])) $('npc').value = selectedIds[0];
  $('pose').replaceChildren(...[...new Set([...poseOptions(), pose])].map(p => new Option(p, p))); $('pose').value = pose;
  $('view').value = view; $('phase').value = clock.phase; $('time').value = time;
  $('detail-target').replaceChildren(new Option('มือซ้าย', 'hand:left'), new Option('มือขวา', 'hand:right'),
    ...[...new Set(npcs.flatMap(n => visibleParts(n)).filter(p => !bodyParts.has(p)))].map(p => new Option(`อุปกรณ์: ${p}`, `prop:${p}`)));
}
function setPose(next = 'idle') {
  if (!poseOptions().includes(next) && !rawActions[next]) throw Error(`Unknown pose ${next}`);
  if (mode === 'registry' && ['work', 'sit'].includes(next)) {
    const role = registryRoles().find(r => r.state === next);
    if (!role) throw Error(`No authored ${next} state for ${selectedIds[0]}`);
    return setWitness({ ...role });
  }
  pose = next; if (detail) view = 'front'; detail = null;
  if (mode !== 'city') { time = 0; for (const n of npcs) n.walkPhase = 0; }
  if (mode === 'raw') {
    const key = next === 'rest' ? null : params.get('clip') || Object.keys(rawActions).find(n => n.toLowerCase() === next) || Object.keys(rawActions).find(n => n.toLowerCase().startsWith(next));
    rawMixer?.stopAllAction();
    const action = key && rawActions[key]; if (action) action.reset().play();
    rawPose = { requested: next, supported: !!action, clip: key ?? null, reason: action ? null : next === 'rest' ? 'Explicit source rest pose; no motion claim' : 'No matching native source clip; rest pose only' };
  } else if (mode === 'registry') for (const n of npcs) {
    n.release(); n.path = null; n.state = next === 'walk' ? 'walk' : next === 'sit' ? 'sit' : ['idle', 'look'].includes(next) ? 'idle' : next === 'talk' ? 'talk' : 'work';
    const authored = registryRoles(n.id).find(r => r.anim === next);
    if (authored && !['idle', 'walk', 'talk'].includes(next)) { n.state = authored.state; n.anim = authored.anim; }
    else n.anim = next === 'work' ? workPose(n.def) : next === 'idle' || next === 'sit' ? 'rest' : next;
    if (next === 'talk') n.talkTo(n.x, n.z + 2);
  }
  renderAt(time, true); updateControls(); return snapshot(false);
}
function fitCamera() {
  if (detail) {
    const bounds = detail.kind === 'wrist' ? wristRegion(detailModel(detail.id), detail.side)?.bounds
      : detail.kind === 'hand' ? handSurface(detailModel(detail.id), detail.side)?.bounds : propInstance(detail.id, detail.part)?.bounds;
    if (!bounds || bounds.isEmpty()) throw Error('No actual visible surface for close-up');
    const dirs = { front: [0, .75, 1], back: [0, -.35, -1], side: [1, .15, 0], top: [0, 1, .001] };
    aimBounds(bounds, dirs[detail.angle], .09, false); return;
  }
  if (mode === 'city' || view === 'gameplay') {
    cameraController.updateProjection(); cameraController.snap(focus); return;
  }
  const bounds = new THREE.Box3();
  if (raw) bounds.setFromObject(raw, true);
  else for (const n of npcs) {
    const entry = npcRenderer?.modelRenderer?.entries.get(n);
    if (entry?.active) bounds.union(new THREE.Box3().setFromObject(entry.root, true));
    else bounds.expandByPoint(new THREE.Vector3(n.x - .65, n.y, n.z - .65)).expandByPoint(new THREE.Vector3(n.x + .65, n.y + 1.9 * n.look.scale, n.z + .65));
  }
  if (bounds.isEmpty()) return;
  const dirs = { front: [0, .05, 1], side: [1, .05, 0], back: [0, .05, -1], threequarter: [.8, .35, 1], top: [0, 1, .001] };
  aimBounds(bounds, dirs[view], .9, true);
}
function aimBounds(bounds, directionArray, minHalf, ground) {
  const target = bounds.getCenter(new THREE.Vector3()), direction = new THREE.Vector3(...directionArray).normalize(); camera.up.set(0, 1, 0);
  if (direction.y > .99) camera.up.set(0, 0, -1);
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize(), up = new THREE.Vector3().crossVectors(direction, right);
  let w = 0, h = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [ground ? Math.min(0, bounds.min.y) : bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const v = new THREE.Vector3(x, y, z).sub(target); w = Math.max(w, Math.abs(v.dot(right))); h = Math.max(h, Math.abs(v.dot(up)));
  }
  const aspect = host.clientWidth / Math.max(1, host.clientHeight), pad = ground ? .12 : .015, half = Math.max(minHalf, h * 1.15 + pad, (w * 1.15 + pad) / aspect);
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  camera.position.copy(target).addScaledVector(direction, 25); camera.lookAt(target); camera.updateProjectionMatrix();
}
function detailModel(id) {
  if (mode === 'raw') return raw;
  const n = npcs.find(n => n.id === id), entry = (npcRenderer ?? manager?.renderer)?.modelRenderer?.entries.get(n);
  if (!entry?.active) throw Error('Close-up cannot substitute a procedural fallback for a native model');
  return entry.model;
}
function wristRegion(model, side) {
  const name = side === 'left' ? 'LeftHand' : 'RightHand';
  model?.updateMatrixWorld(true);
  const bone = model?.getObjectByName(name);
  if (!bone?.isBone) return null;
  const centre = bone.getWorldPosition(new THREE.Vector3());
  if (!finite(centre.toArray())) throw Error('Nonfinite wrist camera anchor');
  // This bounded camera region includes the cuff and hand. It is a framing
  // anchor only, never a palm/thumb landmark or a measured contact verdict.
  const bounds = new THREE.Box3().setFromCenterAndSize(centre, new THREE.Vector3(.28, .28, .28));
  return { name, centre, bounds };
}
function handSurface(model, side, minimumWeight = .8) {
  const name = side === 'left' ? 'LeftHand' : 'RightHand', bounds = new THREE.Box3(), centre = new THREE.Vector3(), points = new Set();
  let vertices = 0, meshes = 0; const v = new THREE.Vector3();
  model?.updateMatrixWorld(true);
  model?.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const boneIndex = o.skeleton.bones.findIndex(b => b.name === name); if (boneIndex < 0) return;
    const { skinIndex, skinWeight } = o.geometry.attributes; if (!skinIndex || !skinWeight) return;
    let cache = handIndices.get(o.geometry); if (!cache) handIndices.set(o.geometry, cache = new Map());
    const key = `${name}/${boneIndex}/${minimumWeight}`;
    if (!cache.has(key)) {
      const indices = [];
      for (let i = 0; i < skinIndex.count; i++) { let weight = 0; for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === boneIndex) weight += skinWeight.getComponent(i, k); if (weight >= minimumWeight) indices.push(i); }
      cache.set(key, indices);
    }
    const indices = cache.get(key); if (indices.length) meshes++; o.skeleton.update();
    for (const i of indices) {
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); if (!finite(v.toArray())) throw Error('Nonfinite hand surface');
      bounds.expandByPoint(v); vertices++; const key = v.toArray().map(x => Math.round(x * 1e6)).join(':');
      if (!points.has(key)) { points.add(key); centre.add(v); }
    }
  });
  if (!vertices) return null;
  centre.divideScalar(points.size);
  return { name, minimumWeight, vertices, weldedVertices: points.size, meshes, centre, bounds };
}
function propInstance(id, name) {
  const n = npcs.find(n => n.id === id), owner = npcRenderer ?? manager?.renderer;
  const part = owner?.parts.find(p => p.name === name), index = part?.entries.findIndex(e => e.npc === n);
  if (!part || index < 0) return null;
  const matrix = new THREE.Matrix4(); part.mesh.getMatrixAt(index, matrix);
  if (Math.abs(matrix.determinant()) < 1e-12) return null;
  matrix.premultiply(part.mesh.matrixWorld);
  const bounds = new THREE.Box3(), v = new THREE.Vector3(), p = part.mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) bounds.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(matrix));
  return { name, frame: part.entries[index].frame, matrix, bounds, vertices: p.count };
}
function closeUp({ kind = 'hand', side, part, angle = 'front', id = selectedIds[0] }) {
  if (mode === 'city') throw Error('Close-ups use isolated raw/registry cameras; the real city camera stays unchanged');
  if (!['front', 'back', 'side', 'top'].includes(angle) || !['hand', 'wrist', 'prop'].includes(kind) || ['hand', 'wrist'].includes(kind) && !['left', 'right'].includes(side)) throw Error('Invalid close-up request');
  detail = { kind, side: side ?? null, part: part ?? null, angle, id }; view = `${kind}-${side ?? part}-${angle}`;
  renderAt(time); return snapshot();
}
function installContactEvidence(evidence) {
  if (evidence?.schema !== 1 || !families.has(evidence.family) || !evidence.profileFields?.grips || !evidence.measurements?.hands) throw Error('Invalid measured contact evidence');
  contactEvidence.set(evidence.family, evidence); return { family: evidence.family, assetSha256: evidence.assetSha256 };
}
function contactWitness(n, entry, owner) {
  if (!entry?.active) return null;
  const evidence = contactEvidence.get(entry.spec.family), hands = {}, props = [];
  for (const side of ['left', 'right']) {
    const surface = handSurface(entry.model, side, .9999); if (!surface) continue;
    const thumb = evidence?.measurements?.hands?.[side]?.thumb;
    let landmark = null;
    if (thumb && surface.meshes === 1) entry.model.traverse(o => {
      if (!o.isSkinnedMesh || !o.skeleton.bones.some(b => b.name === surface.name) || !Number.isInteger(thumb.vertex) || thumb.vertex < 0 || thumb.vertex >= o.geometry.attributes.position.count) return;
      landmark = { vertex: thumb.vertex, position: o.getVertexPosition(thumb.vertex, new THREE.Vector3()).applyMatrix4(o.matrixWorld).toArray(), status: 'Authored source vertex; anatomical thumb still needs image review' };
    });
    hands[side] = { bone: surface.name, minimumWeight: surface.minimumWeight, vertices: surface.vertices, weldedVertices: surface.weldedVertices,
      centre: surface.centre.toArray(), bounds: { min: surface.bounds.min.toArray(), max: surface.bounds.max.toArray() }, thumb: landmark,
      thumbStatus: landmark ? 'authored-landmark-present' : 'unverified-no-semantic-thumb-landmark' };
  }
  for (const name of visibleParts(n, owner).filter(p => NPC_PROP_FRAMES[p] && !bodyParts.has(p))) {
    const instance = propInstance(n.id, name); if (!instance) continue;
    const frame = NPC_PROP_FRAMES[name], side = frame === 'foreL' ? 'left' : frame === 'foreR' ? 'right' : null;
    const contact = evidence?.profileFields?.grips?.[frame]?.contact;
    const worldGrip = contact && new THREE.Vector3(...contact).applyMatrix4(instance.matrix);
    props.push({ name, frame, vertices: instance.vertices, matrix: instance.matrix.toArray(), bounds: { min: instance.bounds.min.toArray(), max: instance.bounds.max.toArray() },
      forward: new THREE.Vector3(0, 0, 1).transformDirection(instance.matrix).toArray(), up: new THREE.Vector3(0, 1, 0).transformDirection(instance.matrix).toArray(),
      worldGrip: worldGrip?.toArray() ?? null, centroidDistance: worldGrip && hands[side] ? worldGrip.distanceTo(new THREE.Vector3(...hands[side].centre)) : null });
  }
  return { hands, props, evidenceAssetSha256: evidence?.assetSha256 ?? null,
    note: 'Actual skinned hand patches and rendered instanced prop matrices. Centroid alignment is not a closed-grip, finger count, thumb anatomy or blade orientation pass.' };
}
function step(dt) {
  time += dt;
  if (mode === 'raw') {
    for (const [name, action] of Object.entries(rawActions)) if (name === rawPose?.clip) action.time = time % action.getClip().duration;
    rawMixer?.update(0);
  } else if (manager) manager.update(dt, time, focus);
  else {
    for (const n of npcs) { n.animate(time, dt, n.talkTarget ? 'talk' : n.state, n.talkTarget ? 'talk' : n.anim); n.dirty = true; n.shown = true; }
    npcRenderer?.update(dt, time);
  }
}
function renderAt(nextTime = time, evaluate = false) {
  const dt = Math.max(0, nextTime - time);
  // A held review frame may be redrawn from several cameras. Re-evaluating
  // its mixer after the adapter resets bones would let PropertyMixer's equal-
  // value optimization leave the bind pose in place. View/resize redraws do
  // not simulate another production frame; state/focus changes do explicitly.
  if (evaluate || nextTime !== time) { time = nextTime - dt; step(dt); }
  env.update(clock.hour, focus); world?.update(time, dt, focus, env.state);
  scene.updateMatrixWorld(true); fitCamera(); renderer.render(scene, camera); updateStatus();
}
function advance(seconds = 1) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) throw Error('Advance requires 0..600 seconds');
  const count = Math.ceil(seconds * 60); for (let i = 0; i < count; i++) step(Math.min(1 / 60, seconds - i / 60));
  renderAt(time); return snapshot();
}
function focusIds(ids = selectedIds, close = false) {
  const found = ids.map(id => npcs.find(n => n.id === id)).filter(Boolean);
  if (!found.length) throw Error('No requested NPCs on this actual map');
  selectedIds = found.map(n => n.id); focus.set(0, 0, 0);
  for (const n of found) focus.add(new THREE.Vector3(n.x, n.y, n.z)); focus.divideScalar(found.length);
  cameraController.setZoom(close ? 2 : 1); fitCamera(); renderAt(time, true); return snapshot();
}
function inspectModel(root) {
  if (!root) return null; root.updateMatrixWorld(true);
  let vertices = 0, skins = 0, meshes = 0, bones = 0; const errors = [], bounds = new THREE.Box3(), v = new THREE.Vector3();
  root.traverse(o => {
    if (!finite(o.matrixWorld.elements)) errors.push(`Nonfinite transform ${o.name}`);
    if (o.isBone) bones++;
    if (!o.isMesh) return; meshes++; if (o.isSkinnedMesh) { skins++; o.skeleton.update(); }
    for (const key of ['position', 'normal', 'skinWeight']) if (o.geometry.attributes[key] && !finite(o.geometry.attributes[key].array)) errors.push(`Nonfinite ${key}`);
    const count = o.geometry.attributes.position?.count ?? 0; vertices += count;
    for (let i = 0; i < count; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); if (!finite(v.toArray())) errors.push(`Nonfinite skinned vertex ${i}`); else bounds.expandByPoint(v); }
  });
  return { meshes, skins, bones, vertices, finite: !errors.length, errors: errors.slice(0, 8), bounds: bounds.isEmpty() ? null : { min: bounds.min.toArray(), max: bounds.max.toArray() } };
}
function visibleParts(npc, owner = npcRenderer ?? manager?.renderer) {
  const matrix = new THREE.Matrix4(), parts = [];
  for (const part of owner?.parts ?? []) for (let i = 0; i < part.entries.length; i++) if (part.entries[i].npc === npc) {
    part.mesh.getMatrixAt(i, matrix); if (Math.abs(matrix.determinant()) > 1e-12) parts.push(part.name);
  }
  return [...new Set(parts)];
}
function services(def) { return { shopType: def.shopType ?? null, trainer: def.trainer ?? null, warpService: def.warpService ?? null, storageService: !!def.storageService, faction: def.faction ?? null }; }
function poseWitness(entry) {
  if (!entry?.model || !entry.active) return null;
  const joints = {};
  for (const name of ['Spine', 'Spine02', 'Head', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot']) {
    const bone = entry.model.getObjectByName(name); if (!bone) continue;
    joints[name] = { position: bone.getWorldPosition(new THREE.Vector3()).toArray(), quaternion: bone.getWorldQuaternion(new THREE.Quaternion()).toArray() };
  }
  return { joints, poseOffset: entry.poseRoot.position.toArray(), sourceSha256: entry.source?.assetSha256 ?? null,
    note: 'Measured joint transforms; ankle stability does not alone prove sole contact or skin strain.' };
}
function instanceResources(entry) {
  if (!entry?.model) return null;
  const skins = [];
  entry.model.traverse(o => { if (o.isSkinnedMesh) skins.push({ geometry: o.geometry.uuid, skeleton: o.skeleton.uuid,
    materials: [].concat(o.material).map(m => m.uuid) }); });
  return { model: entry.model.uuid, skins };
}
function snapshot(geometry = true) {
  const owner = npcRenderer ?? manager?.renderer;
  const closeSurface = geometry && detail?.kind === 'hand' ? handSurface(detailModel(detail.id), detail.side) : null;
  const closeRegion = geometry && detail?.kind === 'wrist' ? wristRegion(detailModel(detail.id), detail.side) : null;
  return { schema: 1, mode, family, time, pose, view, map: world?.map.id ?? null, phase: clock.phase, hour: clock.hour,
    selectedIds, assetUrl: assetUrl && safeUrl(assetUrl), nativeClips: rawSource?.animations.map(c => ({ name: c.name, duration: c.duration })) ?? null,
    rawPose, raw: geometry && raw ? inspectModel(raw) : null, cacheSize: npcModelCache.size, warnings: [...warnings],
    camera: { position: camera.getWorldPosition(new THREE.Vector3()).toArray(), focus: focus.toArray(), zoom: cameraController.zoom,
      detail, closeRegion: closeRegion && { bone: closeRegion.name, centre: closeRegion.centre.toArray(),
        bounds: { min: closeRegion.bounds.min.toArray(), max: closeRegion.bounds.max.toArray() }, note: 'Bounded wrist camera framing only; not a contact or anatomical landmark measurement' },
      closeSurface: closeSurface && { bone: closeSurface.name, minimumWeight: closeSurface.minimumWeight, vertices: closeSurface.vertices,
        centre: closeSurface.centre.toArray(), bounds: { min: closeSurface.bounds.min.toArray(), max: closeSurface.bounds.max.toArray() } } },
    npcs: npcs.filter(n => mode !== 'city' || selectedIds.includes(n.id)).map(n => {
      const entry = owner?.modelRenderer?.entries.get(n), parts = visibleParts(n, owner);
      return { id: n.id, name: n.def.name, family: npcModelSpec(n)?.family ?? null, position: [n.x, n.y, n.z], yaw: n.yaw,
        state: n.state, anim: n.anim, path: n.path?.map(p => p.id) ?? null, indoors: n.indoors, shown: !!n.shown, talking: !!n.talkTarget,
        services: services(n.def), interactionRadius: n.interactionRadius, status: owner?.modelRenderer?.status(n),
        rootVisible: entry?.root?.visible ?? false, visibleProceduralParts: parts, duplicateBodyParts: entry?.active ? parts.filter(p => bodyParts.has(p)) : [],
        retainedParts: [...(entry?.parts ?? [])], animation: entry?.root?.userData.animationState?.(), normalization: entry?.root?.userData.normalization,
        visualPolicy: entry?.active ? { roleMotion: entry.adapter.roleMotion, activityPoses: entry.adapter.activityPoses,
          authoredState: n.state, seatedPresentation: n.state === 'sit' && entry.adapter.roleMotion?.seated === 'upright' ? 'standing visual fallback' : null,
          props: entry.adapter.propPresentation?.() ?? {} } : null,
        poseWitness: geometry ? poseWitness(entry) : null, resources: geometry ? instanceResources(entry) : null,
        contactWitness: geometry ? contactWitness(n, entry, owner) : null,
        cameraDistance: camera.position.distanceTo(new THREE.Vector3(n.x, n.y, n.z)),
        model: geometry && entry?.model ? inspectModel(entry.root) : null };
    }), rendered: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, memory: { ...renderer.info.memory } } };
}
function updateStatus() {
  const s = snapshot(false), labels = s.npcs.map(n => `${n.name}: ${n.status?.active ? 'GLB' : 'fallback'} (${n.status?.reason ?? n.state})`);
  $('status').textContent = `${mode} · ${family} · ${pose} · ${view} · ${clock.label}\n${mode === 'raw' ? rawPose?.supported ? `native: ${rawPose.clip}` : rawPose?.reason ?? 'source rest pose' : labels.join(' / ')}`;
}
async function load(options = {}) {
  const generation = ++loadGeneration; releaseScene(); warnings.length = 0; $('error').hidden = true;
  mode = options.mode ?? (options.source ? 'raw' : 'registry'); family = options.family ?? family;
  if (!families.has(family)) throw Error(`Unknown brief family ${family}`);
  time = 0; selectedIds = options.ids ?? [options.npc ?? brief().npcIds[0]];
  clock.set(PHASE_HOURS[options.phase ?? 'day']); view = options.view ?? (mode === 'city' ? 'gameplay' : 'front'); pose = options.pose ?? 'idle'; focus.set(0, 0, 0);
  if (options.adapter) await import(/* @vite-ignore */ options.adapter);
  if (mode === 'raw') {
    if (!options.source) throw Error('Raw mode requires an explicit GLB source URL');
    const url = new URL(options.source, location.href); if (!['http:', 'https:'].includes(url.protocol)) throw Error('GLB URL must be http(s)');
    const source = await gltfLoader().loadAsync(url.href);
    if (generation !== loadGeneration || closed) { for (const s of source.scenes ?? [source.scene]) disposeTree(s); return; }
    rawSource = source; assetUrl = url.href; raw = new THREE.Group(); const offset = new THREE.Group(); raw.add(offset); offset.add(source.scene); stage.add(raw);
    source.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(source.scene, true), size = box.getSize(new THREE.Vector3());
    if (!finite([...box.min, ...box.max]) || size.y <= 0) throw Error('Invalid source bounds');
    raw.scale.setScalar(brief().targetWorldBodyHeightMeters / size.y); offset.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    source.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    rawMixer = new THREE.AnimationMixer(source.scene); rawActions = Object.fromEntries(source.animations.map(c => [c.name, rawMixer.clipAction(c)]));
  } else if (mode === 'city') {
    const built = await buildWorld(scene, text => { $('status').textContent = text; }, options.map ?? 'city');
    if (generation !== loadGeneration || closed) { built.dispose(); return; }
    world = built; floor.visible = false;
    const has = id => !!world.spots[id] || (!!J[id] && walkable(world.map, ...J[id]));
    manager = new NPCManager(world.root, world, npcsForMap(NPCS, world.map.id, has), clock);
    npcs = manager.npcs; await manager.renderer.ready; focusIds(selectedIds);
  } else if (mode === 'registry') {
    npcs = selectedIds.map((id, i) => { const n = new NPC(definition(id), makeLook(definition(id)), null); n.x = (i - (selectedIds.length - 1) / 2) * 2; n.shown = true; n.dirty = true; return n; });
    npcRenderer = new NPCRenderer(stage, npcs); await npcRenderer.ready;
    assetUrl = npcModelSpec(npcs[0]) ? specUrl(npcModelSpec(npcs[0])) : null;
  } else throw Error(`Unknown mode ${mode}`);
  if (generation !== loadGeneration || closed) return;
  if (mode !== 'city') setPose(pose); renderAt(options.time ?? .5); updateControls(); return snapshot();
}

// Private owned copies let cache-retirement probes dispose real source-shaped
// resources without invalidating the production cache still used by the scene.
function ownedSource(source) {
  const model = cloneSkinned(source.scene), geometries = new Map(), materials = new Map(), textures = new Map();
  model.traverse(o => {
    if (!o.isMesh) return;
    if (!geometries.has(o.geometry)) geometries.set(o.geometry, o.geometry.clone()); o.geometry = geometries.get(o.geometry);
    const own = m => { if (!materials.has(m)) { const c = m.clone(); for (const [k, v] of Object.entries(c)) if (v?.isTexture) { if (!textures.has(v)) textures.set(v, v.clone()); c[k] = textures.get(v); } materials.set(m, c); } return materials.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  return { scene: model, scenes: [model], animations: source.animations };
}
async function lifecycleProbe(id = selectedIds[0]) {
  const npc = npcs.find(n => n.id === id); if (!npc) throw Error('Select an actual registry NPC first');
  const spec = npcModelSpec(npc); if (!spec) throw Error('Selected NPC is absent from production model registry');
  const checks = [], resources = [], localScene = new THREE.Scene();
  const check = (name, passed, detail = {}) => checks.push({ name, passed: !!passed, ...detail });
  const source = await npcModelCache.load(spec);
  const again = await npcModelCache.load(spec); check('cache-source-reused', source === again);
  const make = () => { const n = new NPC(npc.def, makeLook(npc.def), null); n.shown = true; n.dirty = true; n.animate(1, 0, 'idle', 'rest'); return n; };
  let instances = null, failed = null, late = null, lateCache = null;
  try {
    let sourceDisposed = 0; const sharedResources = new Set();
    source.scene.traverse(o => { if (o.geometry) sharedResources.add(o.geometry); for (const m of [].concat(o.material ?? [])) { sharedResources.add(m); for (const v of Object.values(m)) if (v?.isTexture) sharedResources.add(v); } });
    for (const resource of sharedResources) { const fn = () => sourceDisposed++; resource.addEventListener('dispose', fn); resources.push(() => resource.removeEventListener('dispose', fn)); }
    const a = make(), b = make(); instances = new NPCRenderer(localScene, [a, b]); await instances.ready; instances.update(0, 1);
    const ea = instances.modelRenderer.entries.get(a), eb = instances.modelRenderer.entries.get(b);
    const meshes = e => { const out = []; e?.model?.traverse(o => { if (o.isSkinnedMesh) out.push(o); }); return out; };
    const ma = meshes(ea), mb = meshes(eb);
    check('independent-model-rigs-materials', ma.length > 0 && ma.length === mb.length && ma.every((m, i) => m !== mb[i] && m.skeleton !== mb[i].skeleton && m.material !== mb[i].material && m.geometry === mb[i].geometry));
    const before = { a: instances.modelRenderer.status(a), b: instances.modelRenderer.status(b) };
    check('real-adapter-active', before.a?.active && before.b?.active, { status: before });
    check('no-procedural-body-duplicate', [a, b].every(n => visibleParts(n, instances).every(p => !bodyParts.has(p))), { parts: [visibleParts(a, instances), visibleParts(b, instances)] });
    a.shown = false; instances.update(0, 2); check('hidden-model-and-parts', !ea.root?.visible && visibleParts(a, instances).length === 0);
    a.shown = true; a.dirty = true; instances.update(0, 3); check('shown-model-restored', !!ea.root?.visible && instances.modelRenderer.isActive(a));
    let materialDisposals = 0; for (const e of [ea, eb]) for (const m of e.ownedMaterials) m.addEventListener('dispose', () => materialDisposals++);
    instances.dispose(); const firstDisposalCount = materialDisposals; instances.dispose(); check('instance-disposal-preserves-cache', sourceDisposed === 0 && materialDisposals > 0 && firstDisposalCount === materialDisposals && !ea.root && !eb.root, { sharedResourceDisposals: sourceDisposed, instanceMaterialDisposals: materialDisposals });
    const f = make(); failed = new NPCRenderer(localScene, [f], { loadModel: () => Promise.reject(Error('QA intentional source failure')), onError: () => {} }); await failed.ready; failed.update(0, 1);
    check('load-failure-visible-fallback-services', !failed.modelRenderer.isActive(f) && visibleParts(f, failed).some(p => bodyParts.has(p)) && JSON.stringify(services(f.def)) === JSON.stringify(services(npc.def)), { status: failed.modelRenderer.status(f), services: services(f.def) });
    let resolveLate; const wait = new Promise(resolve => { resolveLate = resolve; });
    late = new NPCRenderer(localScene, [make()], { loadModel: () => wait, onError: () => {} }); late.dispose(); resolveLate(source); await late.ready;
    check('late-load-never-attaches-retired-instance', [...late.modelRenderer.entries.values()].every(e => e.root == null && !e.active) && !localScene.children.some(o => o.name.startsWith('npc-model:')));
    const owned = ownedSource(source); let disposed = 0; const ownedGeometries = new Set(); owned.scene.traverse(o => { if (o.geometry) ownedGeometries.add(o.geometry); });
    for (const g of ownedGeometries) g.addEventListener('dispose', () => disposed++);
    let resolveSource; lateCache = createNPCModelCache(() => new Promise(resolve => { resolveSource = resolve; }));
    const pending = lateCache.load(spec); await Promise.resolve(); lateCache.dispose(); resolveSource(owned);
    let rejected = false; try { await pending; } catch { rejected = true; }
    lateCache.dispose(); check('late-cache-source-released-once', rejected && disposed === ownedGeometries.size && lateCache.size === 0, { geometryDisposals: disposed, geometries: ownedGeometries.size });
  } finally { instances?.dispose(); failed?.dispose(); late?.dispose(); lateCache?.dispose(); resources.forEach(off => off()); }
  return { schema: 1, npc: id, family: spec.family, checks, passed: checks.every(c => c.passed), limits: ['Source-failure and delayed-load branches use explicit QA loader injection; active models use the registered production adapter.', 'No shop, warp, storage, quest or account transaction is performed. Service definition/interaction availability is observed only.'] };
}
function setCityPhase(phase, seconds = 12) { if (!manager || !PHASE_HOURS[phase]) throw Error('City mode and known phase required'); clock.set(PHASE_HOURS[phase]); return advance(seconds); }
// Move the review's player/camera focus, never the authored NPC. The next real
// NPCManager/NPCRenderer update observes the actual CameraController position.
function cityFocusOffset(id, distance = 0) {
  const n = npcs.find(n => n.id === id);
  if (!manager || !n || !Number.isFinite(distance) || distance < 0 || distance > 100) throw Error('City NPC and finite 0..100 focus offset required');
  selectedIds = [id]; view = 'gameplay';
  const direction = cameraController.offset.clone().setY(0).normalize();
  focus.set(n.x, n.y, n.z).addScaledVector(direction, distance);
  fitCamera(); renderAt(time, true); return snapshot();
}
function talk(id, enabled = true) { const n = npcs.find(n => n.id === id); if (!n) throw Error('NPC absent'); if (enabled) n.talkTo(n.x + 1, n.z + 1); else n.release(); renderAt(time, true); return snapshot(); }
function nearest(id) { const n = npcs.find(n => n.id === id); if (!manager || !n) return null; const found = manager.nearestInteractable(n.x, n.z); return { requested: id, found: found?.id ?? null, shown: n.shown, services: services(n.def) }; }
function dispose() { if (closed) return { disposed: true, repeat: true }; closed = true; playing = false; loadGeneration++; renderer.setAnimationLoop(null); releaseScene(); npcModelCache.dispose();
  floor.geometry.dispose(); floor.material.dispose(); env.sun.shadow.map?.dispose(); env.sun.dispose(); env.hemi.dispose(); renderer.dispose(); renderer.forceContextLoss(); window.removeEventListener('resize', resize); return { disposed: true, groupsReleased: disposedGroups, cacheSize: npcModelCache.size, phaseListeners: clock.listeners.length }; }
function resize() { if (closed) return; cameraController.resize(); renderAt(time); }
function fail(e) { $('error').hidden = false; $('error').textContent = e.stack ?? String(e); console.error(e); }
window.npcReview = { ready: false, load, setPose, setWitness, registryRoles, closeUp, installContactEvidence,
  setView: next => { if (!['front', 'side', 'back', 'threequarter', 'gameplay', 'top'].includes(next)) throw Error('Invalid view'); detail = null; view = mode === 'city' ? 'gameplay' : next; renderAt(time); return snapshot(); },
  seek: renderAt, advance, snapshot, focusIds, cityFocusOffset, setCityPhase, talk, nearest, lifecycleProbe, availableNpcIds: () => npcs.map(n => n.id), dispose,
  families: manifest.families.map(f => ({ id: f.id, npcIds: f.npcIds, states: f.existingStateWitnesses })),
  limits: ['Raw source preview normalizes total source bounds for display; it does not certify anatomical crown height.', 'Isolated registry poses call actual NPC.animate in place; only city mode exercises native navigation/schedules.', 'Unsupported pose adapters remain visible procedural fallback, never an invented adapter.', 'Hand close-ups use actual skinned hand-owned vertices. No finger count or anatomical thumb is inferred from bone names/PCA.'] };
$('family').replaceChildren(...manifest.families.map(f => new Option(f.id, f.id)));
$('load').onclick = () => load({ mode: $('mode').value, family: $('family').value, npc: $('npc').value, source: $('source').value, phase: $('phase').value }).catch(fail);
$('family').onchange = () => { family = $('family').value; selectedIds = [brief().npcIds[0]]; updateControls(); };
$('pose').onchange = () => { try { setPose($('pose').value); } catch (e) { fail(e); } };
$('view').onchange = () => window.npcReview.setView($('view').value);
$('inspect-detail').onclick = () => { try { const [kind, target] = $('detail-target').value.split(':'); closeUp({ kind, side: kind === 'hand' ? target : undefined, part: kind === 'prop' ? target : undefined, angle: $('detail-angle').value }); } catch (e) { fail(e); } };
$('seek').onclick = () => { const n = Number($('time').value); if (Number.isFinite(n) && n >= 0) renderAt(n); };
$('phase').onchange = () => { if (mode === 'city') setCityPhase($('phase').value); else { clock.set(PHASE_HOURS[$('phase').value]); renderAt(time); } };
$('play').onclick = () => { playing = !playing; $('play').setAttribute('aria-pressed', String(playing)); };
window.addEventListener('resize', resize); window.addEventListener('pagehide', dispose, { once: true });
let last = performance.now(); renderer.setAnimationLoop(now => { const dt = Math.min(.1, (now - last) / 1000); last = now; if (playing && !closed) renderAt(time + dt); });
try { await load({ mode: params.get('mode') ?? (params.has('source') ? 'raw' : 'registry'), family: params.get('family') ?? 'warp_keeper', npc: params.get('npc') ?? undefined,
  ids: params.get('ids')?.split(',').filter(Boolean), source: params.get('source'), adapter: params.get('adapter'), map: params.get('map') ?? 'city', phase: params.get('phase') ?? 'day', pose: params.get('pose') ?? 'idle', view: params.get('view') ?? undefined }); window.npcReview.ready = true; } catch (e) { window.npcReview.error = e.message; fail(e); }
