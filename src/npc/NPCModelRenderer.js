import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { npcModelSpec, npcModelCache, createNPCPoseAdapter, npcPoseAdapterRevision, npcAccessoryParts, NPC_PROP_FRAMES } from './NPCModels.js';
import { computeFrames } from './body/rig.js';

const warned = new Set();
const warn = (spec, error) => { if (!warned.has(spec.family)) { warned.add(spec.family); console.warn(`[npc] ${spec.family}: procedural fallback (${error.message})`); } };
const finite = values => values.every(Number.isFinite);

function releaseInstance(entry) {
  if (entry.released) return;
  entry.released = true;
  entry.root?.removeFromParent();
  entry.mixer?.stopAllAction(); if (entry.mixer && entry.model) entry.mixer.uncacheRoot(entry.model);
  if (entry.nativeSamples) for (const samples of Object.values(entry.nativeSamples)) for (const s of samples) s.binding.unbind();
  entry.nativeSamples = null;
  const skeletons = new Set();
  entry.model?.traverse(o => { if (o.skeleton) skeletons.add(o.skeleton); });
  // A preparation failure can occur halfway through material cloning. Never
  // dispose unvisited meshes' still-shared source materials in that case.
  entry.ownedMaterials?.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose());
  try { entry.adapter?.dispose?.(); } catch (error) { entry.error = error.message; }
  entry.root = entry.model = entry.mixer = entry.adapter = null; entry.active = false;
}

export class NPCModelRenderer {
  constructor(scene, npcs, { loadModel = spec => npcModelCache.load(spec), createAdapter = createNPCPoseAdapter, onError = warn,
    camera = null, modelNear = 38, modelFar = 45, lazyLoad = false } = {}) {
    this.scene = scene; this.entries = new Map(); this.disposed = false;
    this.createAdapter = createAdapter; this.onError = onError;
    if (!Number.isFinite(modelNear) || !Number.isFinite(modelFar) || modelNear <= 0 || modelFar < modelNear) throw new Error('Invalid NPC model LOD distances');
    this.camera = camera; this.modelNear = modelNear; this.modelFar = modelFar; this.cameraPosition = new THREE.Vector3();
    for (const npc of npcs) {
      const spec = npcModelSpec(npc); if (!spec) continue;
      const entry = { npc, spec, root: null, model: null, adapter: null, mixer: null, active: false, reason: 'loading', released: false, ownedMaterials: new Set(),
        phase: null, actions: null, source: null, lodNear: npc.distance <= modelNear, started: false, ready: Promise.resolve(null),
        adapterRevision: -1, parts: new Set(), visibleParts: new Set(), context: { npc, spec, time: 0, dt: 0, phase: 'idle' } };
      this.entries.set(npc, entry);
      entry.startLoad = () => {
        if (entry.started || this.disposed) return; entry.started = true;
        entry.ready = Promise.resolve().then(() => loadModel(spec)).then(source => {
        if (this.disposed) return null;
        entry.source = source;
        if (entry.lodNear && npc.shown) this.prepare(entry, source);
        return entry.root;
      }).catch(error => {
        releaseInstance(entry);
        const intentionalFallback = error.code === 'NPC_MODEL_PROFILE_UNAPPROVED';
        entry.reason = intentionalFallback ? 'unapproved-profile' : 'load-failed';
        entry.error = intentionalFallback ? null : error.message;
        if (!this.disposed && !intentionalFallback) this.onError(spec, error);
        return null;
      });
      };
      if (!lazyLoad) entry.startLoad();
    }
    // NPCManager never waits on this promise: slow/missing assets cannot block a map.
  }
  get ready() { return Promise.all([...this.entries.values()].map(e => e.ready)); }

  prepare(entry, source) {
    if (!source?.scene?.isObject3D) throw new Error('NPC GLB has no scene');
    const clips = new Map((source.animations ?? []).map(c => [c.name.toLowerCase(), c]));
    for (const name of entry.spec.clips) {
      const clip = clips.get(name);
      if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0 || !clip.tracks.length
        || clip.tracks.some(t => !finite(Array.from(t.times)) || !finite(Array.from(t.values)))) throw new Error(`Missing/invalid native ${name} clip`);
    }
    const model = cloneSkinned(source.scene); entry.model = model;
    const clonedMaterials = new Map(); let skins = 0;
    model.traverse(o => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) skins++;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const cloneMaterial = m => {
        if (!clonedMaterials.has(m)) { const clone = m.clone(); clonedMaterials.set(m, clone); entry.ownedMaterials.add(clone); }
        return clonedMaterials.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(cloneMaterial) : cloneMaterial(o.material);
      const p = o.geometry?.attributes.position;
      if (!p) throw new Error('NPC geometry has no positions');
      for (let i = 0; i < p.count; i++) if (!finite([p.getX(i), p.getY(i), p.getZ(i)])) throw new Error('Nonfinite NPC geometry');
    });
    if (!skins) throw new Error('Important NPC source must have a skinned humanoid rig');
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    if (!finite([...bounds.min, ...bounds.max]) || size.y <= 1e-6) throw new Error('Invalid NPC bind bounds');
    const root = new THREE.Group(), poseRoot = new THREE.Group(), orient = new THREE.Group(), scale = new THREE.Group(), offset = new THREE.Group();
    root.name = `npc-model:${entry.npc.id}`; root.visible = false;
    if (!Number.isFinite(entry.npc.look.scale) || entry.npc.look.scale <= 1e-6) throw new Error('Invalid NPC appearance scale');
    orient.rotation.y = entry.spec.facingYaw; scale.scale.setScalar(entry.spec.height / (size.y * entry.npc.look.scale));
    offset.position.set(-center.x, -bounds.min.y, -center.z);
    root.add(poseRoot); poseRoot.add(orient); orient.add(scale); scale.add(offset); offset.add(model);
    entry.root = root; entry.poseRoot = poseRoot; entry.orient = orient; entry.scale = scale; entry.offset = offset;
    root.userData.npcId = entry.npc.id; root.userData.family = entry.spec.family;
    root.userData.normalization = { sourceMin: bounds.min.toArray(), sourceMax: bounds.max.toArray(), scale: scale.scale.x,
      targetHeight: entry.spec.height, facingYaw: entry.spec.facingYaw, measurement: 'provisional full bind bounds; actual adapter may supply soles-to-crown measurement',
      convention: 'Prepared asset faces +Z; compensate outer npc.look.scale exactly once' };
    entry.mixer = new THREE.AnimationMixer(model);
    entry.actions = Object.fromEntries(entry.spec.clips.map(name => [name, entry.mixer.clipAction(clips.get(name))]));
    // The adapter restores a complete rig each frame. AnimationMixer caches
    // unchanged values and may therefore skip a repeated position/quaternion
    // key after that restore (notably a native Hips floor correction). Reapply
    // this renderer's single active clip through public Three bindings; the
    // interpolants preserve its authored interpolation and exact phase time.
    entry.nativeSamples = Object.fromEntries(entry.spec.clips.map(name => [name, clips.get(name).tracks.map(track => ({
      binding: THREE.PropertyBinding.create(model, track.name), interpolant: track.createInterpolant(),
    }))]));
    entry.context.model = model; entry.context.source = source; entry.context.root = root; entry.context.poseRoot = poseRoot;
    root.userData.animationState = () => ({ phase: entry.phase, clip: entry.phase, clipTime: entry.actions?.[entry.phase]?.time ?? 0,
      active: entry.active, fallbackReason: entry.reason });
    this.prepareAdapter(entry); this.scene.add(root);
  }

  prepareAdapter(entry) {
    entry.adapter?.dispose?.(); entry.adapter = null;
    entry.adapterRevision = npcPoseAdapterRevision();
    const adapter = this.createAdapter(entry.model, entry.context);
    if (!adapter) { entry.reason = 'needs-rig-adapter'; return; }
    entry.adapter = adapter; // Own/release even an invalid adapter's resources.
    if (typeof adapter.supports !== 'function' || typeof adapter.apply !== 'function') throw new Error('NPC pose adapter requires supports/apply');
    const parts = new Set(adapter.proceduralParts ?? []);
    for (const name of parts) if (!NPC_PROP_FRAMES[name]) throw new Error(`Unsupported retained NPC part: ${name}`);
    const baked = adapter.bakedAccessories ?? [];
    if (!Array.isArray(baked) || baked.some(name => !NPC_PROP_FRAMES[name])) throw new Error('Invalid NPC adapter baked accessories');
    entry.appearanceSpec = { ...entry.spec, bakedAccessories: [...new Set([...entry.spec.bakedAccessories, ...baked])],
      scabbards: adapter.scabbards ?? [], suppressedAccessories: adapter.suppressedAccessories ?? [] };
    entry.root.userData.geometryAssetSha256 = adapter.geometryAssetSha256 ?? null;
    if (adapter.normalization) {
      const n = adapter.normalization;
      if (!Number.isFinite(n.sourceHeight) || n.sourceHeight <= 1e-6 || !Array.isArray(n.footOrigin) || n.footOrigin.length !== 3
        || !finite(n.footOrigin) || !Number.isFinite(n.facingYaw)) throw new Error('Invalid measured NPC normalization');
      entry.scale.scale.setScalar(entry.spec.height / (n.sourceHeight * entry.npc.look.scale));
      entry.offset.position.set(...n.footOrigin.map(v => -v)); entry.orient.rotation.y = n.facingYaw;
      Object.assign(entry.root.userData.normalization, { scale: entry.scale.scale.x, footOrigin: [...n.footOrigin],
        sourceHeight: n.sourceHeight, facingYaw: n.facingYaw, measurement: n.measurement ?? 'adapter supplied soles-to-crown and standing foot anchor' });
    }
    entry.adapter = adapter; entry.parts = parts; entry.reason = 'ready';
  }

  update(dt = 0, time = 0, focus = null) {
    if (this.disposed) return;
    const camera = typeof this.camera === 'function' ? this.camera() : this.camera;
    if (camera?.isCamera) camera.getWorldPosition(this.cameraPosition);
    for (const entry of this.entries.values()) {
      const { npc } = entry;
      // If the model replaced prop frames last frame, restore them even when
      // simulation has not ticked at a far distance or QA holds a fixed pose.
      if (entry.active && !npc.dirty) computeFrames(npc);
      entry.active = false; if (entry.root) entry.root.visible = false;
      const distance = camera?.isCamera ? Math.hypot(npc.x - this.cameraPosition.x, npc.y - this.cameraPosition.y, npc.z - this.cameraPosition.z) : npc.distance;
      const playerDistance = focus ? Math.hypot(npc.x - focus.x, npc.z - focus.z) : npc.distance;
      entry.lodNear = !!npc.talkTarget || playerDistance <= npc.interactionRadius + 1 || distance <= (entry.lodNear ? this.modelFar : this.modelNear);
      if (!entry.lodNear) { entry.reason = 'distance-lod'; continue; }
      if (!npc.shown) continue;
      entry.startLoad();
      try {
        if (!entry.root && entry.source && !entry.released) {
          try { this.prepare(entry, entry.source); }
          catch (error) { releaseInstance(entry); entry.reason = 'load-failed'; entry.error = error.message; this.onError(entry.spec, error); continue; }
        }
        const root = entry.root; if (!root) continue;
        if (entry.adapterRevision !== npcPoseAdapterRevision()) this.prepareAdapter(entry);
        if (!entry.adapter) continue;
        const talk = !!npc.talkTarget, moving = !talk && (!!npc.path || npc.state === 'walk');
        const phase = moving ? npc.anim === 'run' ? 'run' : 'walk' : 'idle', context = entry.context;
        Object.assign(context, { time, dt, phase, moving, state: talk ? 'talk' : moving ? 'walk' : npc.state,
          anim: talk ? 'talk' : moving ? npc.anim === 'run' ? 'run' : 'walk' : npc.anim, pose: npc.pose });
        if (entry.adapter.supports(context) !== true) { entry.reason = 'unsupported-pose'; continue; }
        const accessoryParts = npcAccessoryParts(npc, entry.appearanceSpec ?? entry.spec);
        if ([...accessoryParts].some(p => !entry.parts.has(p))) { entry.reason = 'needs-prop-adapter'; continue; }
        entry.visibleParts = accessoryParts;
        root.position.set(npc.x, npc.y, npc.z); root.rotation.y = npc.yaw; root.scale.setScalar(npc.look.scale);
        entry.poseRoot.position.set(0, npc.pose.y, 0);
        entry.adapter.reset?.(context);
        const action = entry.actions[phase];
        if (entry.phase !== phase) { entry.mixer.stopAllAction(); action.reset().play(); entry.phase = phase; }
        // Evaluate the real native clip before visibility, including a load that
        // finishes mid-walk. Walking cadence follows the existing NPC gait clock.
        const duration = action.getClip().duration;
        const clock = moving && Number.isFinite(npc.walkPhase) ? npc.walkPhase / (2 * Math.PI) * duration : time + (npc.seed ?? 0);
        action.time = ((clock % duration) + duration) % duration;
        entry.mixer.update(0);
        for (const sample of entry.nativeSamples[phase]) sample.binding.setValue(sample.interpolant.evaluate(action.time), 0);
        root.updateMatrixWorld(true);
        const result = entry.adapter.apply(context) ?? {};
        root.updateMatrixWorld(true);
        const measuredFrames = entry.adapter.propFrames?.(context) ?? result.frames;
        const frameNames = new Set([...entry.visibleParts].map(p => NPC_PROP_FRAMES[p]));
        for (const frame of frameNames) {
          const matrix = measuredFrames?.[frame];
          if (!matrix?.isMatrix4 || !finite(matrix.elements)) throw new Error(`Measured prop frame missing/invalid: ${frame}`);
        }
        let valid = finite(root.matrixWorld.elements);
        entry.model.traverse(o => { if (o.isBone && !finite([...o.position, ...o.quaternion, ...o.scale, ...o.matrixWorld.elements])) valid = false; });
        if (!valid) throw new Error('Nonfinite NPC model pose');
        for (const frame of frameNames) npc.frames[frame].copy(measuredFrames[frame]);
        entry.active = true; root.visible = true; entry.reason = null;
      } catch (error) {
        entry.reason = 'pose-failed'; entry.error = error.message;
        this.onError(entry.spec, error);
      }
    }
  }

  isActive(npc) { return this.entries.get(npc)?.active ?? false; }
  partVisible(npc, name) { const entry = this.entries.get(npc); return !entry?.active || entry.visibleParts.has(name); }
  status(npc) { const e = this.entries.get(npc); return e ? { family: e.spec.family, active: e.active, reason: e.reason, error: e.error ?? null } : null; }
  dispose() { if (this.disposed) return; this.disposed = true; for (const entry of this.entries.values()) releaseInstance(entry); }
}
