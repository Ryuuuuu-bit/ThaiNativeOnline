// Offline, candidate-only socket measurements. Importing performs no I/O.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { THREE, loadRig, restoreRest, worldVertices, decomposeRigid } from './rig.mjs';
import { measureHand } from './anatomy.mjs';
import { MESHY_NPC_JOINTS } from './calibration.mjs';
import { sha256 } from './glb.mjs';
import { NPC_MODELS, NPC_PROP_FRAMES, npcAccessoryParts, npcHandContactTransform } from '../../src/npc/NPCModels.js';
import { NPCS } from '../../src/data/npcs.js';
import { makeLook } from '../../src/npc/NPCData.js';
import { RIG } from '../../src/npc/body/rig.js';
import { BODY_PARTS } from '../../src/npc/body/bodyParts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const vector = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw Error(`Invalid ${label}`);
  return new THREE.Vector3(...value);
};
const frameForSide = { left: 'foreL', right: 'foreR' };

// Contact points are centres of the EXISTING handles in gearParts.js, not
// guessed wrist offsets or replacement geometry. Bow is its arc midpoint;
// basket is its handle midpoint. SpearTip shares the spear's shaft contact.
const CONTACTS = Object.freeze({
  spear: [0, RIG.handY, .02], spearTip: [0, RIG.handY, .02],
  hammer: [0, RIG.handY, .05], sword: [0, RIG.handY, .05], knife: [0, RIG.handY, .06],
  staff: [0, RIG.handY, .02], paddle: [0, RIG.handY, .03], rod: [0, RIG.handY, .03],
  broom: [0, RIG.handY, .16], bow: [0, RIG.handY, .10], basket: [0, RIG.handY + .10, .06],
});
export function legacyGripForPart(part) {
  if (!CONTACTS[part]) throw Error(`No inspected legacy grip: ${part}`);
  return [...CONTACTS[part]];
}

export function contactRolePlan(family, brief, bakedAccessories = NPC_MODELS[family]?.bakedAccessories ?? []) {
  const spec = NPC_MODELS[family], entry = brief?.families?.find(f => f.id === family);
  if (!spec || !entry || entry.npcIds.length !== spec.npcIds.length || entry.npcIds.some(id => !spec.npcIds.includes(id))) throw Error(`Brief/runtime IDs differ: ${family}`);
  if (!Array.isArray(bakedAccessories) || bakedAccessories.some(p => !NPC_PROP_FRAMES[p])) throw Error('Invalid explicit baked accessories');
  const appearance = { ...spec, bakedAccessories: [...new Set([...spec.bakedAccessories, ...bakedAccessories])] };
  const roles = entry.npcIds.map(id => {
    const def = NPCS.find(n => n.id === id); if (!def) throw Error(`Missing actual NPC: ${id}`);
    const look = makeLook(def), retained = npcAccessoryParts({ def, look, carrying: false }, appearance);
    // Include only a real scheduled sack, not speculative props from the brief.
    if (Object.values(def.schedule ?? {}).some(a => a?.carry) && !look.props.some(p => ['pole', 'headBasket', 'basket'].includes(p))) retained.add('sack');
    return { id, occupation: def.occupation, hat: look.hat, props: [...look.props], retained: [...retained], frames: [...new Set([...retained].map(p => NPC_PROP_FRAMES[p]))] };
  });
  const grips = {};
  for (const frame of ['foreL', 'foreR']) {
    const parts = [...new Set(roles.flatMap(r => r.retained).filter(p => NPC_PROP_FRAMES[p] === frame))];
    const contacts = parts.map(legacyGripForPart);
    if (contacts.some(c => c.some((v, i) => Math.abs(v - contacts[0][i]) > 1e-9))) throw Error(`Different retained contacts need per-NPC sockets: ${family}/${frame}`);
    grips[frame] = { parts, contact: contacts[0] ?? [0, RIG.handY, 0] };
  }
  return { roles, grips, bakedAccessories: appearance.bakedAccessories, frames: [...new Set(roles.flatMap(r => r.frames))] };
}

function weightedSurface(rig, names, minimumWeight = .8) {
  const selected = new Set(names.map(n => rig.mesh.skeleton.bones.indexOf(rig.names.get(n)))); selected.delete(-1);
  const { skinIndex, skinWeight } = rig.mesh.geometry.attributes, vertices = worldVertices(rig), seen = new Set(), points = [];
  for (let i = 0; i < skinIndex.count; i++) {
    let weight = 0; for (let k = 0; k < 4; k++) if (selected.has(skinIndex.getComponent(i, k))) weight += skinWeight.getComponent(i, k);
    if (weight < minimumWeight) continue;
    const point = new THREE.Vector3().fromArray(vertices, i * 3), key = point.toArray().map(v => Math.round(v * 1e6)).join(':');
    if (!seen.has(key)) { points.push({ point, index: i }); seen.add(key); }
  }
  if (points.length < 12) throw Error(`Insufficient actual surface: ${names.join('/')}`);
  return points;
}

const rigidWorld = bone => {
  const { p, q } = decomposeRigid(bone.matrixWorld, bone.name);
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
};
function basis(up, forward) {
  const y = up.clone().normalize(), z = forward.clone().addScaledVector(y, -forward.dot(y));
  if (up.length() < .01 || z.length() < .01) throw Error('Ambiguous measured body marker axes');
  z.normalize(); return new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z).normalize(), y, z);
}
function palmBasis(fingers, palm) {
  const y = fingers.clone().normalize(), z = palm.clone().addScaledVector(y, -palm.dot(y));
  if (fingers.length() < .1 || z.length() < .1) throw Error('Ambiguous measured palm basis');
  z.normalize(); return new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z).normalize(), y, z);
}
function canonicalAffine(matrix) {
  const e = matrix.elements;
  if (![3, 7, 11].every(i => Math.abs(e[i]) < 1e-10) || Math.abs(e[15] - 1) > 1e-10) throw Error('Contact construction produced a non-affine matrix');
  // Generic inversion may turn exact homogeneous 1 into 1±epsilon. Preserve
  // strict runtime contract without changing the measured rotation/translation.
  e[3] = e[7] = e[11] = 0; e[15] = 1; return matrix;
}
function boxOf(points) {
  const b = new THREE.Box3(); for (const p of points) b.expandByPoint(p);
  if (![...b.min, ...b.max].every(Number.isFinite) || b.getSize(new THREE.Vector3()).toArray().some(v => v <= 1e-5)) throw Error('Degenerate measured surface envelope');
  return b;
}

/** Fits only existing accessory coordinates, never body vertices/joints.
 * Full measured weighted envelopes include hair/clothing/baked headwear;
 * this is not an anatomical skull/crown segmentation or visual approval. */
export function fitWornSocket(rig, calibration, frame, female = false) {
  const point = name => new THREE.Vector3().setFromMatrixPosition(rig.names.get(name).matrixWorld);
  const head = point('Head'), forward = point('headfront').sub(head);
  let origin, axes, target, legacy, boneName;
  if (frame === 'head') {
    boneName = 'Head'; origin = head;
    axes = basis(point('head_end').sub(head), forward);
    const inverse = axes.clone().invert();
    target = boxOf(weightedSurface(rig, ['Head', 'head_end', 'headfront']).map(({ point: p }) => p.clone().sub(origin).applyMatrix4(inverse)));
    const geometry = BODY_PARTS.find(p => p.name === 'head').geo();
    try { geometry.computeBoundingBox(); legacy = geometry.boundingBox.clone(); } finally { geometry.dispose(); }
  } else if (frame === 'upper') {
    boneName = 'Spine'; origin = point('Hips'); axes = basis(point('neck').sub(origin), forward);
    const inverse = axes.clone().invert();
    const shoulder = point('LeftArm').add(point('RightArm')).multiplyScalar(.5).sub(origin).applyMatrix4(inverse).y;
    const points = weightedSurface(rig, ['Hips', 'Spine02', 'Spine01', 'Spine'], .65)
      .map(({ point: p }) => p.clone().sub(origin).applyMatrix4(inverse)).filter(p => p.y >= 0 && p.y <= shoulder);
    target = boxOf(points); target.min.y = 0; target.max.y = shoulder;
    const geometry = BODY_PARTS.find(p => p.name === (female ? 'torsoF' : 'torsoM')).geo();
    try {
      const p = geometry.attributes.position, points = [];
      for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (v.y >= RIG.hipY && v.y <= RIG.shoulderY) points.push(v); }
      legacy = boxOf(points); legacy.min.y = RIG.hipY; legacy.max.y = RIG.shoulderY;
    } finally { geometry.dispose(); }
  } else throw Error(`Unsupported worn socket: ${frame}`);
  const size = target.getSize(new THREE.Vector3()).divide(legacy.getSize(new THREE.Vector3()));
  if (size.toArray().some(v => v < .35 || v > 2.5)) throw Error(`Measured ${frame} accessory fit needs manual review: ${size.toArray()}`);
  const shift = target.getCenter(new THREE.Vector3()).sub(legacy.getCenter(new THREE.Vector3()).multiply(size));
  const world = new THREE.Matrix4().makeTranslation(...origin).multiply(axes).multiply(new THREE.Matrix4().makeTranslation(...shift)).multiply(new THREE.Matrix4().makeScale(...size));
  const matrix = canonicalAffine(rig.names.get(boneName).matrixWorld.clone().invert().multiply(world));
  if (!matrix.elements.every(Number.isFinite) || matrix.determinant() <= 0) throw Error('Invalid fitted accessory socket');
  return { socket: { bone: boneName, matrix: matrix.toArray() }, evidence: { method: 'Actual weighted surface envelope and actual bone marker axes fitted to existing bodyParts.js accessory frame; accessory-only scale',
    bone: boneName, legacyMin: legacy.min.toArray(), legacyMax: legacy.max.toArray(), measuredMin: target.min.toArray(), measuredMax: target.max.toArray(), scale: size.toArray(),
    includesHairClothingAndBakedAccessories: true, anatomicalCrownMeasured: false } };
}

export function measureNPCContacts({ rig, family, calibration, qa, brief, bakedAccessories, textileReport = null, thumbLandmarks = null }) {
  const spec = NPC_MODELS[family];
  if (!spec || qa?.family !== family || qa.schema !== 1 || calibration?.schema !== 1 || !hash(qa.sha256) || !hash(rig.sha256)) throw Error('Exact family/preparation identity required');
  if (rig.sha256 !== qa.sha256 && (!textileReport || textileReport.sourceSHA256 !== qa.sha256 || textileReport.sha256 !== rig.sha256 || textileReport.geometryRigAnimationUnchanged !== true)) throw Error('Actual body hash differs from preparation receipt');
  for (const role of ['body', 'walk', 'run']) if (!hash(qa.sources?.[role]) || calibration.sourceHashes?.[role] !== qa.sources[role]) throw Error(`Adapter/preparation raw source hash mismatch: ${role}`);
  if (qa.source?.sha256 !== qa.sources.body) throw Error('Preparation body source mismatch');
  const handScale = qa.frame?.scale;
  if (!Number.isFinite(handScale) || handScale <= 0 || handScale > 1000) throw Error('Explicit preparation frame.scale required');
  if (calibration.coordinates?.up !== '+Y' || calibration.coordinates?.front !== '+Z' || calibration.coordinates?.height !== spec.height) throw Error('Canonical adapter coordinates required');
  const transform = new THREE.Matrix4().fromArray(qa.frame?.matrix ?? []), decomposition = decomposeRigid(transform, 'preparation frame');
  if (decomposition.s.toArray().some(v => Math.abs(v - handScale) > Math.max(1e-8, handScale * 1e-6))) throw Error('Preparation frame.scale differs from matrix');
  if (rig.mesh.skeleton.bones.length !== 24 || MESHY_NPC_JOINTS.some(n => !rig.names.has(n))) throw Error('Actual Meshy-24 body required');
  if (thumbLandmarks && (thumbLandmarks.schema !== 1 || thumbLandmarks.assetSha256 !== rig.sha256)) throw Error('Thumb landmark must pin exact current body hash');
  const plan = contactRolePlan(family, brief, bakedAccessories), measured = {}, grips = {}, sockets = {}, witnesses = {}, currentHands = new Map();
  let maxRestFrameError = 0, maxContactError = 0;
  restoreRest(rig);
  try {
    for (const name of MESHY_NPC_JOINTS) {
      const node = calibration.nodes?.[name], bone = rig.names.get(name);
      if (!node || (rig.objectNames.get(bone.parent) ?? null) !== node.parent || !Array.isArray(node.bindWorld) || node.bindWorld.length !== 16 || !node.bindWorld.every(Number.isFinite)) throw Error(`Actual adapter parent/bind frame missing: ${name}`);
      const expected = new THREE.Matrix4().fromArray(node.bindWorld), actual = rigidWorld(bone);
      const error = Math.max(...expected.elements.map((v, i) => Math.abs(v - actual.elements[i]))); maxRestFrameError = Math.max(maxRestFrameError, error);
      if (error > .002) throw Error(`Adapter does not describe actual body rest: ${name}`);
    }
    for (const side of ['left', 'right']) {
      const original = calibration.hands?.[side], bone = rig.names.get(`${side === 'left' ? 'Left' : 'Right'}Hand`);
      if (original?.name !== bone.name) throw Error(`Actual ${side} PCA contract missing`);
      const palmReference = vector(original.palmLocal, 'signed palm').applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())).toArray();
      const current = measureHand(rig, bone.name, { palmReference }), points = weightedSurface(rig, [bone.name]);
      const gripPoint = new THREE.Vector3(0, RIG.handY, 0).applyMatrix4(npcHandContactTransform(original, { handScale })).applyMatrix4(bone.matrixWorld);
      const error = gripPoint.distanceTo(vector(current.centroid, 'actual hand centroid'));
      const fingersDot = vector(current.fingersLocal, 'current fingers').dot(vector(original.fingersLocal, 'source fingers'));
      const palmDot = vector(current.palmLocal, 'current palm').dot(vector(original.palmLocal, 'source palm'));
      // Repaired ownership can change the PCA plane. Re-measure the actual
      // patch instead of requiring the old plane to be identical. The signed
      // reference uses measureHand's existing .6 ambiguity boundary; sizeable
      // changes are explicit visual-review flags, never production approvals.
      if (fingersDot < .6 || palmDot < .6) throw Object.assign(Error(`Actual ${side} hand differs from raw PCA/calibration; needs new measured contract`), {
        code: 'NPC_HAND_PCA_MISMATCH', witness: { side, fingersDot, palmDot, rawVertices: original.vertices, currentVertices: current.vertices,
          assetSha256: rig.sha256, rawFingersLocal: original.fingersLocal, currentFingersLocal: current.fingersLocal, rawPalmLocal: original.palmLocal, currentPalmLocal: current.palmLocal },
      });
      // Raw PCA predates packing/weight repair. Fit explicit sockets to the
      // actual fully hand-owned patch instead of assuming its mean is unchanged.
      // The pose adapter already supports these foreL/foreR socket overrides.
      const rigid = weightedSurface(rig, [bone.name], .9999);
      const rigidCentre = rigid.reduce((sum, { point }) => sum.add(point), new THREE.Vector3()).divideScalar(rigid.length);
      currentHands.set(side, { pca: current, localContact: rigidCentre.clone().applyMatrix4(bone.matrixWorld.clone().invert()), rigid });
      const fingers = vector(current.fingersWorld, 'fingers'), palm = vector(current.palmWorld, 'palm'), across = new THREE.Vector3().crossVectors(fingers, palm).normalize();
      const ranges = [fingers, palm, across].map(axis => { const values = points.map(({ point }) => point.dot(axis)); return Math.max(...values) - Math.min(...values); });
      let thumb = null;
      const landmark = thumbLandmarks?.hands?.[side];
      if (landmark) {
        if (!Number.isInteger(landmark.vertex) || landmark.vertex < 0 || landmark.vertex >= rig.mesh.geometry.attributes.position.count) throw Error(`Thumb ${side} landmark is not in actual rigid hand patch`);
        const { skinIndex, skinWeight } = rig.mesh.geometry.attributes, boneIndex = rig.mesh.skeleton.bones.indexOf(bone);
        let weight = 0; for (let k = 0; k < 4; k++) if (skinIndex.getComponent(landmark.vertex, k) === boneIndex) weight += skinWeight.getComponent(landmark.vertex, k);
        if (weight < .9999) throw Error(`Thumb ${side} landmark is not in actual rigid hand patch`);
        const position = rig.mesh.getVertexPosition(landmark.vertex, new THREE.Vector3()).applyMatrix4(rig.mesh.matrixWorld);
        const direction = position.clone().sub(vector(current.centroid, 'centroid')).addScaledVector(fingers, -position.clone().sub(vector(current.centroid, 'centroid')).dot(fingers));
        if (direction.length() < .005) throw Error(`Ambiguous ${side} thumb landmark`);
        thumb = { vertex: landmark.vertex, position: position.toArray(), directionLocal: direction.normalize().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).toArray(), status: 'Authored thumb semantic; exact surface index verified. Visual validation still required.' };
      }
      measured[side] = { rawVertices: original.vertices, currentVertices: current.vertices, rawContractCentroidDifference: error, actualHandLength: ranges[0], thickness: ranges[1], width: ranges[2], legacyForearmContactOffset: RIG.handY,
        rawToCurrentAxes: { fingersDot, palmDot, requiresVisualRecalibration: fingersDot < .9 || palmDot < .9 },
        contactPatch: { minimumHandWeight: .9999, weldedVertices: rigid.length, restCentre: rigidCentre.toArray(), handLocalCentre: currentHands.get(side).localContact.toArray(),
          description: 'Actual fully hand-owned surface centroid. Palm/digit segmentation and closed grasp are unverified.' },
        handScaleFromPreparation: handScale, fingersLocal: current.fingersLocal, palmLocal: current.palmLocal,
        acrossPalmLocal: across.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).toArray(), thumb, thumbStatus: thumb ? 'authored-witness' : 'UNVERIFIED: PCA across-palm axis cannot identify the anatomical thumb' };
    }
    // Evaluate measured idle rotations on THIS body, matching runtime reset/apply.
    for (const name of MESHY_NPC_JOINTS) {
      const values = calibration.nodes[name].idleLocal?.rotation;
      if (!Array.isArray(values) || values.length !== 4 || !values.every(Number.isFinite) || Math.abs(Math.hypot(...values) - 1) > .01) throw Error(`Invalid actual idle quaternion: ${name}`);
      rig.names.get(name).quaternion.fromArray(values).normalize();
    }
    rig.gltf.scene.updateMatrixWorld(true); rig.mesh.skeleton.update();
    for (const side of ['left', 'right']) {
      const frame = frameForSide[side], { pca: hand, localContact, rigid } = currentHands.get(side), bone = rig.names.get(hand.name), q = bone.getWorldQuaternion(new THREE.Quaternion());
      // In neutral idle, preserve the original prop's canonical upright/+Z
      // orientation. During work/gait the socket follows the measured hand.
      // No finger bending, invented thumb sign or copied family quaternion.
      grips[frame] = { contact: plan.grips[frame].contact, fingers: vector(hand.fingersLocal, 'fingers').applyQuaternion(q).toArray(), palm: vector(hand.palmLocal, 'palm').applyQuaternion(q).toArray() };
      const rotation = palmBasis(vector(hand.fingersLocal, 'current fingers'), vector(hand.palmLocal, 'current palm')).multiply(
        palmBasis(vector(grips[frame].fingers, 'prop fingers'), vector(grips[frame].palm, 'prop palm')).invert());
      const local = canonicalAffine(new THREE.Matrix4().makeTranslation(...localContact).multiply(rotation).multiply(new THREE.Matrix4().makeTranslation(...grips[frame].contact.map(v => -v))));
      // Explicit overrides are required: raw source PCA plus frame.scale is
      // retained for provenance/defaults, never silently replaced or rescaled.
      sockets[frame] = { bone: hand.name, matrix: local.toArray() };
      const world = bone.matrixWorld.clone().multiply(local), point = vector(grips[frame].contact, 'legacy grip').applyMatrix4(world);
      const currentCentre = rigid.reduce((sum, { index }) => sum.add(rig.mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(rig.mesh.matrixWorld)), new THREE.Vector3()).divideScalar(rigid.length);
      const error = point.distanceTo(currentCentre); maxContactError = Math.max(maxContactError, error);
      if (error > .00002) throw Error(`Actual idle ${side} rigid hand contact mismatch`);
      witnesses[frame] = { parts: plan.grips[frame].parts, bone: hand.name, matrix: local.toArray(), worldGrip: point.toArray(), contactError: error,
        neutralPropForward: new THREE.Vector3(0, 0, 1).transformDirection(world).toArray(), neutralPropUp: new THREE.Vector3(0, 1, 0).transformDirection(world).toArray(),
        requiredVisualChecks: plan.grips[frame].parts.length ? ['Actual held orientation, handle occlusion/contact, blade edge/shaft clearance and natural open source digits'] : ['Casting palm orientation if used'] };
    }
    const female = plan.roles.every(r => makeLook(NPCS.find(n => n.id === r.id)).female), worn = {};
    for (const frame of ['head', 'upper']) if (plan.frames.includes(frame)) {
      const fit = fitWornSocket(rig, calibration, frame, female); sockets[frame] = fit.socket; worn[frame] = fit.evidence;
    }
    return { schema: 1, family, status: 'MEASURED_CONTACT_CANDIDATE_NOT_APPROVED', assetSha256: rig.sha256, geometryAssetSha256: qa.sha256, rawSourceHashes: { ...qa.sources },
      preparationAuditPassed: qa.audit?.passed === true, profileFields: { handScale, grips, sockets, bakedAccessories: plan.bakedAccessories,
        normalization: { sourceHeight: calibration.coordinates.height, footOrigin: vector(calibration.coordinates.footOrigin, 'canonical standing origin').toArray(), facingYaw: 0,
          measurement: 'Prepared canonical total bounds including baked accessories; anatomical crown not separately measured' } }, roles: plan.roles,
      measurements: { hands: measured, worn }, checks: { maxRestFrameError, maxContactError, numericContactPassed: true,
        axisReviewRequired: Object.values(measured).some(h => h.rawToCurrentAxes.requiresVisualRecalibration), visualApproved: false }, socketWitnesses: witnesses,
      limits: ['No body, weights, clips, core runtime or production profile is modified.', 'Contact is the welded fully hand-owned surface centroid, not proof of a closed grip or zero physical gap. Explicit foreL/foreR sockets supersede the raw PCA default.',
        'Thumb semantics need a hash-pinned authored vertex landmark and visual review; PCA alone cannot identify a thumb.',
        'Worn fits use actual weighted surface envelopes including hair/clothing/baked accessories; anatomical crown is not segmented.',
        'Accessory-only scale fits existing head/torso envelopes. Full pose contact, worn occlusion, blade/paddle orientation and all native animation gates remain to review.'] };
  } finally { restoreRest(rig); }
}

function disposeRig(rig) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  rig.gltf.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.skeleton) skeletons.add(o.skeleton); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
  for (const m of materials) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
  for (const group of [skeletons, materials, textures, geometries]) for (const resource of group) resource.dispose();
}
export async function contactCandidateFromFiles({ family, body, adapter, qa, brief, bakedAccessories, textileReport, thumbLandmarks }) {
  const files = { adapter, qa, brief, ...(textileReport ? { textileReport } : {}), ...(thumbLandmarks ? { thumbLandmarks } : {}) };
  const values = {}, hashes = {};
  for (const [key, file] of Object.entries(files)) { const bytes = await readFile(file); values[key] = JSON.parse(bytes); hashes[key] = sha256(bytes); }
  const rig = await loadRig(body);
  try {
    const result = measureNPCContacts({ rig, family, calibration: values.adapter, qa: values.qa, brief: values.brief, bakedAccessories, textileReport: values.textileReport, thumbLandmarks: values.thumbLandmarks });
    if (sha256(await readFile(body)) !== rig.sha256) throw Error('Body changed during contact measurement');
    for (const [key, file] of Object.entries(files)) if (sha256(await readFile(file)) !== hashes[key]) throw Error(`Input changed during contact measurement: ${key}`);
    result.inputHashes = { body: rig.sha256, ...hashes }; return result;
  } finally { disposeRig(rig); }
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]; if (!key.startsWith('--')) throw Error('Expected named contact options');
    if (['--all', '--help'].includes(key)) options[key.slice(2)] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw Error(`Missing value: ${key}`); options[key.slice(2)] = argv[++i]; }
  }
  if (options.help || (!options.family && !options.families && !options.all)) {
    console.log('Offline contact candidates only.\nnode tools/npc-models/contacts.mjs --family blacksmith --baked-accessories apron\nnode tools/npc-models/contacts.mjs --all --catalog artifacts/city-npc-models/candidate-profiles.json\nOptional --body GLB --adapter JSON --qa JSON --textile-report JSON --thumb-landmarks JSON --out artifacts/...\nThumb schema: {schema:1,assetSha256,hands:{left:{vertex},right:{vertex}}}. No browser, Blender, paid calls or production edits.'); return;
  }
  const families = options.all ? Object.keys(NPC_MODELS) : options.families ? options.families.split(',').filter(Boolean) : [options.family];
  if (!families.length || new Set(families).size !== families.length || families.some(f => !NPC_MODELS[f])
    || ((options.all || options.families) && ['body', 'adapter', 'qa', 'textile-report', 'thumb-landmarks', 'baked-accessories'].some(k => options[k]))) throw Error('Invalid family/batch contact options');
  const output = path.resolve(ROOT, options.out ?? 'artifacts/city-npc-models/contacts'), relative = path.relative(path.join(ROOT, 'artifacts'), output);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Contact output must remain under this worktree artifacts');
  const catalog = options.catalog ? JSON.parse(await readFile(path.resolve(ROOT, options.catalog), 'utf8')) : null;
  if (catalog && (catalog.schema !== 1 || !Array.isArray(catalog.families))) throw Error('Invalid contact input catalog');
  const index = { schema: 1, status: 'CANDIDATES_ONLY', families: [], failures: [] }; await mkdir(output, { recursive: true });
  for (const family of families) {
    const directory = path.join(ROOT, 'artifacts/city-npc-models', family), profile = catalog?.families.find(p => p.family === family);
    try {
      const result = await contactCandidateFromFiles({ family,
        body: path.resolve(ROOT, options.body ?? path.join(directory, `${family}.glb`)), adapter: path.resolve(ROOT, options.adapter ?? path.join(directory, `${family}-adapter.json`)),
        qa: path.resolve(ROOT, options.qa ?? path.join(directory, `${family}-qa.json`)), brief: path.join(ROOT, 'docs/art/npcs/NPC_MODEL_BRIEFS.json'),
        bakedAccessories: options['baked-accessories'] ? options['baked-accessories'].split(',').filter(Boolean) : profile?.bakedAccessories,
        textileReport: options['textile-report'] && path.resolve(ROOT, options['textile-report']), thumbLandmarks: options['thumb-landmarks'] && path.resolve(ROOT, options['thumb-landmarks']) });
      const file = path.join(output, `${family}-${result.assetSha256.slice(0, 12)}-contacts.json`); await writeFile(file, JSON.stringify(result, null, 2) + '\n');
      index.families.push({ family, file: path.relative(ROOT, file).replaceAll('\\', '/'), assetSha256: result.assetSha256, maxContactError: result.checks.maxContactError,
        preparationAuditPassed: result.preparationAuditPassed, axisReviewRequired: result.checks.axisReviewRequired, visualApproved: false });
      console.log(JSON.stringify(index.families.at(-1)));
    } catch (error) { index.failures.push({ family, error: error.message, ...(error.code ? { code: error.code } : {}), ...(error.witness ? { witness: error.witness } : {}) }); console.log(JSON.stringify(index.failures.at(-1))); }
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(index, null, 2) + '\n');
  if (index.failures.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
