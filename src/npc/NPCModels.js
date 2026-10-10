import { gltfLoader } from '../core/gltf.js';
import * as THREE from 'three';
import { RIG, elbowBend } from './body/rig.js';
import { createNPCWaiPose } from './NPCActivityPoses.js';
import { createNPCToolPresentation } from './NPCToolPresentation.js';
import { GEAR_PARTS } from './body/gearParts.js';

// Explicit director IDs only, including the two existing paddy gate visitors.
// Occupations never promote ambient NPCs into skinned characters. monk_young
// is the existing gameplay ID of the novice family.
const roles = {
  warp_keeper: ['warp_city_market', 'warp_city_port', 'warp_city_forge', 'warp_city_training', 'warp_city_temple', 'warp_city_gate'],
  blacksmith: ['blacksmith'], enhancer: ['enhancer'], general_merchant: ['general_merchant', 'vendor_lanterns'],
  gate_supplier: ['gate_supplier', 'vendor_fruit', 'vendor_rice', 'fish_vendor_w', 'vendor_pottery'],
  herbalist: ['herbalist'], occultist: ['occultist'],
  master_muay: ['master_muay'], master_sword: ['master_sword'], master_hunter: ['master_hunter'],
  master_herbal: ['master_herbal'], master_shaman: ['master_shaman'], master_bandit: ['master_bandit'],
  city_guard: ['guard_port', 'guard_market', 'guard_center', 'guard_temple', 'guard_gate_w', 'guard_gate_e', 'guard_patrol'],
  monk_elder: ['monk_elder', 'monk_teacher'], monk_novice: ['monk_young'], boatman: ['boatman'],
};

// Exact legacy part IDs, based on the delivered family rather than occupation.
// Keeper has a baked cream wrap; the corrected blacksmith v2 has a baked apron.
// Add other entries only after checking their actual generated body.
const bakedAccessories = { warp_keeper: ['clothHat'], blacksmith: ['apron'] };

export const NPC_MODELS = Object.freeze(Object.fromEntries(Object.entries(roles).map(([family, ids]) => [family, Object.freeze({
  family, url: `models/npcs/${family}.glb`, revision: 'city-npcs-1', npcIds: Object.freeze(ids),
  // Match the existing scale-one townsperson. Assets must be prepared facing +Z;
  // calibration, rather than bone-name heuristics, supplies pose/tool axes.
  height: family === 'monk_novice' ? 1.2 : 1.72, facingYaw: 0,
  bakedAccessories: Object.freeze(bakedAccessories[family] ?? []),
  bakedHeadwear: family === 'warp_keeper', clips: Object.freeze(['idle', 'walk', 'run']),
})])));
export const NPC_MODEL_IDS = Object.freeze(Object.fromEntries(Object.values(NPC_MODELS).flatMap(s => s.npcIds.map(id => [id, s.family]))));

export function npcModelSpec(npcOrDef) {
  const def = npcOrDef?.def ?? npcOrDef;
  const allowedMap = def && ((def.map ?? 'city') === 'city' || (def.map === 'paddy' && ['guard_gate_w', 'guard_gate_e'].includes(def.id)));
  return allowedMap ? NPC_MODELS[NPC_MODEL_IDS[def.id]] ?? null : null;
}

// Generated bodies omit retained accessories unless explicitly listed above.
// Each retained part needs a measured socket; these
// original frame origins are not interchangeable with arbitrary wrist bones.
export const NPC_PROP_PARTS = Object.freeze({
  spear: Object.freeze(['spear', 'spearTip']), hammer: Object.freeze(['hammer']), sword: Object.freeze(['sword']),
  knife: Object.freeze(['knife']), staff: Object.freeze(['staff']), paddle: Object.freeze(['paddle']),
  rod: Object.freeze(['rod']), broom: Object.freeze(['broom']), bow: Object.freeze(['bow']), basket: Object.freeze(['basket']),
  apron: Object.freeze(['apron']), pack: Object.freeze(['pack']),
});
export const NPC_HEADWEAR_PARTS = Object.freeze({ ngob: ['ngob'], helmet: ['helmet', 'helmetTrim'], headband: ['headband'],
  headbandRed: ['headband'], mongkol: ['mongkol'], cloth: ['clothHat'] });
export const NPC_PROP_FRAMES = Object.freeze({
  spear: 'foreR', spearTip: 'foreR', hammer: 'foreR', sword: 'foreR', swordScabbard: 'foreR', knife: 'foreR', knifeScabbard: 'foreR', staff: 'foreR',
  paddle: 'foreR', rod: 'foreR', broom: 'foreR', bow: 'foreL', basket: 'foreL', sack: 'upper', bowl: 'upper', apron: 'upper', pack: 'upper',
  ngob: 'head', helmet: 'head', helmetTrim: 'head', headband: 'head', mongkol: 'head', clothHat: 'head',
});

export function npcAccessoryParts(npc, spec) {
  const props = npc.look.props ?? [], parts = props.flatMap(p => NPC_PROP_PARTS[p] ?? []);
  if (!spec.bakedHeadwear) parts.push(...(NPC_HEADWEAR_PARTS[npc.look.hat] ?? []));
  if (npc.look.robe) parts.push('bowl');
  if (npc.carrying && !props.some(p => ['pole', 'headBasket', 'basket'].includes(p))) parts.push('sack');
  for (const part of spec.scabbards ?? []) if ((part === 'swordScabbard' && props.includes('sword')) || (part === 'knifeScabbard' && props.includes('knife'))) parts.push(part);
  const workingMonk = ['monk_novice', 'monk_elder'].includes(spec.family) && npc.state === 'work';
  // This eligibility is used only for an active GLB. The complete procedural
  // fallback still uses its original accessory conditions, including the apron.
  const prayer = ['monk_novice', 'monk_elder'].includes(spec.family) && npc.anim === 'pray' && !npc.path && npc.state !== 'walk';
  const travellingBasket = spec.family === 'gate_supplier' && (!!npc.path || npc.state === 'walk');
  return new Set(parts.filter(part => !spec.bakedAccessories?.includes(part) && !spec.suppressedAccessories?.includes(part)
    && !(prayer && ['broom', 'bowl'].includes(part)) && !(workingMonk && part === 'bowl') && !(travellingBasket && part === 'basket')));
}

const adapters = new Map();
let adapterRevision = 0;
export const npcPoseAdapterRevision = () => adapterRevision;

/** Register only after inspecting a real source rig. Factory(model, context)
 * returns { supports(context), reset?(context), apply(context), propFrames?(context), dispose?(),
 * proceduralParts?: string[], normalization?: {sourceHeight, footOrigin, facingYaw} }.
 * normalization measures soles-to-crown, excluding external headwear.
 * apply runs after native clip evaluation and
 * may return {frames:{foreR: THREE.Matrix4,...}} in world space for held props.
 * Alternatively propFrames runs after modified bone world matrices update.
 * It must reset unkeyed modified joints, use calibrated local axes, and remove
 * measured root motion without changing NPC navigation. No inferred axes here.
 */
export function registerNPCPoseAdapter(family, factory) {
  if (!NPC_MODELS[family] || typeof factory !== 'function') throw new TypeError('Known NPC family and pose adapter factory required');
  adapters.set(family, factory); adapterRevision++;
  return () => { if (adapters.get(family) === factory) { adapters.delete(family); adapterRevision++; } };
}
export function createNPCPoseAdapter(model, context) {
  return adapters.get(context.spec.family)?.(model, context) ?? null;
}

const MESHY24 = Object.freeze(['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end', 'headfront',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']);
const vector = (values, label, count = 3) => {
  if (!Array.isArray(values) || values.length !== count || !values.every(Number.isFinite)) throw new Error(`Invalid measured NPC ${label}`);
  return values;
};
const measuredQuaternion = (values, label) => {
  const q = new THREE.Quaternion().fromArray(vector(values, label, 4));
  if (Math.abs(q.length() - 1) > .01) throw new Error(`Invalid measured NPC quaternion: ${label}`);
  return q.normalize();
};

// Visual gains are independent of the authored schedules/pose. These bodies
// were measured with a relaxed idle already baked into their calibration;
// procedural angles are deltas from that stance, not another complete rig.
// The continuous robes cannot fold into a ground sit without cloth morphs.
// Their scheduled sit remains a standing prayer/chant/rest presentation.
export const NPC_ROLE_MOTION = Object.freeze(Object.fromEntries(Object.keys(roles).map(family => [family, Object.freeze({
  arm: ({ master_muay: .7, enhancer: .12, master_sword: .25, master_shaman: .18, master_herbal: .23, occultist: .17 })[family] ?? .3,
  head: .25, torso: .2, stance: .25,
  seated: ['monk_elder', 'monk_novice', 'master_shaman', 'boatman', 'occultist'].includes(family) ? 'upright' : 'ground',
})])));

function roleMotion(family, override = {}) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) throw new Error('Invalid NPC role motion policy');
  const result = { ...NPC_ROLE_MOTION[family] };
  for (const key of ['arm', 'head', 'torso', 'stance', 'seated']) if (override[key] !== undefined) result[key] = override[key];
  for (const key of ['arm', 'head', 'torso', 'stance']) {
    if (!Number.isFinite(result[key]) || result[key] < .02 || result[key] > 1) throw new Error(`Invalid NPC role motion ${key}`);
  }
  if (!['upright', 'ground'].includes(result.seated)) throw new Error('Invalid NPC seated visual stance');
  return Object.freeze(result);
}

function activityPoses(family, value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (value.wai !== undefined && typeof value.wai !== 'boolean')) throw new Error('Invalid NPC activity pose policy');
  if (value.wai && !['monk_elder', 'monk_novice'].includes(family)) throw new Error('Thai wai requires an explicit monk profile');
  let hands;
  if (value.hands !== undefined) {
    if (!value.wai || !value.hands || Array.isArray(value.hands)) throw new Error('Measured wai hands require the monk wai policy');
    hands = Object.fromEntries(['left', 'right'].map(side => {
      const hand = value.hands[side];
      if (!hand) throw new Error('Both measured wai palms required');
      const centreLocal = vector(hand.centreLocal, 'wai palm centre'), fingersLocal = vector(hand.fingersLocal, 'wai fingers'), palmLocal = vector(hand.palmLocal, 'wai palm normal');
      const fingers = new THREE.Vector3(...fingersLocal), palm = new THREE.Vector3(...palmLocal);
      if (new THREE.Vector3(...centreLocal).length() > .4 || Math.abs(fingers.length()-1) > .01 || Math.abs(palm.length()-1) > .01
        || new THREE.Vector3().crossVectors(fingers, palm).length() < .9) throw new Error('Invalid anatomical wai palm basis');
      if (hand.palmOffset !== undefined && (!Number.isFinite(hand.palmOffset) || hand.palmOffset < .002 || hand.palmOffset > .06)) throw new Error('Invalid measured wai palm separation');
      return [side, Object.freeze({ centreLocal: Object.freeze([...centreLocal]), fingersLocal: Object.freeze([...fingersLocal]), palmLocal: Object.freeze([...palmLocal]),
        ...(hand.palmOffset !== undefined ? {palmOffset:hand.palmOffset} : {}) })];
    }));
  }
  return Object.freeze({ wai: value.wai === true, ...(hands ? { hands: Object.freeze(hands) } : {}) });
}

// Both input/output frames use columns across, fingers, palm (right handed).
function palmBasis(fingers, palm) {
  const f = fingers.clone().normalize(), p = palm.clone().addScaledVector(f, -palm.dot(f));
  if (fingers.length() < .1 || p.length() < .1) throw new Error('Ambiguous measured NPC palm/finger basis');
  p.normalize();
  return new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f, p).normalize(), f, p);
}

/** Bone-local socket, fitted to the actual weighted hand centroid. contact is
 * the grip point in the EXISTING procedural prop frame, not the wrist origin.
 * handScale is the preparation report's frame.scale: hand samples are measured
 * before canonical normalization. Override fingers/palm for an inspected prop.
 * This gives reproducible contact, not a claim of a closed-finger grasp.
 */
export function npcHandContactTransform(hand, { handScale = 1, contact = [0, RIG.handY, 0],
  fingers = [0, -1, 0], palm = [0, 0, 1] } = {}) {
  if (!Number.isFinite(handScale) || handScale <= 0 || !Number.isInteger(hand?.vertices) || hand.vertices < 12) throw new Error('Measured NPC hand surface/scale required');
  const f = new THREE.Vector3().fromArray(vector(hand.fingersLocal, 'finger direction'));
  const n = new THREE.Vector3().fromArray(vector(hand.palmLocal, 'palm direction'));
  const localBasis = palmBasis(f, n), worldBasis = palmBasis(
    new THREE.Vector3().fromArray(vector(hand.fingersWorld, 'source finger direction')),
    new THREE.Vector3().fromArray(vector(hand.palmWorld, 'source palm direction')));
  const displacement = new THREE.Vector3().fromArray(vector(hand.centroid, 'hand centroid')).sub(new THREE.Vector3().fromArray(vector(hand.wrist, 'wrist')));
  // The measured centroid/wrist are in the original source pose, while neutral
  // transforms describe lowered arms. Convert through the two measured bases.
  const localContact = displacement.applyMatrix4(worldBasis.clone().invert()).applyMatrix4(localBasis).multiplyScalar(handScale);
  const propBasis = palmBasis(new THREE.Vector3().fromArray(vector(fingers, 'prop fingers')), new THREE.Vector3().fromArray(vector(palm, 'prop palm')));
  const rotation = localBasis.clone().multiply(propBasis.invert());
  return new THREE.Matrix4().makeTranslation(...localContact).multiply(rotation).multiply(new THREE.Matrix4().makeTranslation(
    ...vector(contact, 'prop contact').map(v => -v)));
}

/** Measured Meshy-24 adapter; does not load, approve or publish a source.
 * calibration = {adapter:{bone:{neutralPosition,neutralQuaternion,
 * sourceLocalQuaternion,idleLocalQuaternion}}, hands:{left,right}} from anatomy.
 * options = {qaApproved:false, revision, assetSha256, normalization:{sourceHeight,footOrigin,
 * facingYaw}, handScale, grips:{foreL/foreR:{contact,fingers,palm}},
 * sockets:{head/upper/...:{bone,matrix:[16]}}, seatedReach:.6}.
 * QA approval is explicit per family/revision. No auto-registration of ignored
 * calibration files. Worn/head props require inspected sockets; missing sockets
 * keep the full procedural NPC. Native locomotion remains untouched.
 */
export function createMeshy24NPCPoseAdapter(model, context, calibration, options = {}) {
  const motion = roleMotion(context.spec.family, options.roleMotion);
  const activities = activityPoses(context.spec.family, options.activityPoses);
  const bones = new Map(), records = new Map(), frames = {}, sockets = new Map();
  model.traverse(o => { if (o.isBone) { if (bones.has(o.name)) throw new Error(`Duplicate NPC joint: ${o.name}`); bones.set(o.name, o); } });
  if (bones.size !== 24 || MESHY24.some(name => !bones.has(name))) throw new Error('Measured Meshy-24 joint contract required');
  if (calibration?.nodes && (calibration.schema !== 1 || calibration.coordinates?.up !== '+Y' || calibration.coordinates?.front !== '+Z')) throw new Error('Measured NPC canonical coordinate contract required');
  for (const name of MESHY24) {
    const bone = bones.get(name); let data = calibration?.adapter?.[name];
    if (calibration?.nodes) {
      const node = calibration.nodes[name], p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      new THREE.Matrix4().fromArray(vector(node?.idleWorld, `${name} idle world`, 16)).decompose(p, q, s);
      data = { neutralPosition: p.toArray(), neutralQuaternion: q.toArray(), idleLocalQuaternion: node.idleLocal?.rotation, sourceLocalQuaternion: node.bindLocal?.rotation };
      if (node.parent !== bone.parent?.name) throw new Error(`NPC calibration ancestry mismatch: ${name}`);
    }
    const neutral = measuredQuaternion(data?.neutralQuaternion, `${name} neutral`), inverse = neutral.clone().invert();
    records.set(name, { bone, position: bone.position.clone(), scale: bone.scale.clone(), rest: bone.quaternion.clone(),
      idle: measuredQuaternion(data?.idleLocalQuaternion, `${name} idle`),
      neutral, point: new THREE.Vector3().fromArray(vector(data?.neutralPosition, `${name} position`)),
      pitch: new THREE.Vector3(1, 0, 0).applyQuaternion(inverse), yaw: new THREE.Vector3(0, 1, 0).applyQuaternion(inverse),
      roll: new THREE.Vector3(0, 0, 1).applyQuaternion(inverse) });
    measuredQuaternion(data?.sourceLocalQuaternion, `${name} source`);
  }
  for (const side of ['Left', 'Right']) for (const [parent, child] of [['Shoulder', 'Arm'], ['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['UpLeg', 'Leg'], ['Leg', 'Foot'], ['Foot', 'ToeBase']]) {
    if (bones.get(side + child).parent !== bones.get(side + parent)) throw new Error(`Invalid NPC joint ancestry: ${side + child}`);
  }
  if (bones.get('Head').parent !== bones.get('neck')) throw new Error('Invalid NPC head ancestry');
  const normalization = options.normalization ?? (calibration?.coordinates ? {
    sourceHeight: calibration.coordinates.height, footOrigin: calibration.coordinates.footOrigin, facingYaw: 0,
    measurement: 'prepared total bounds including baked accessories; crown height not separately measured',
  } : undefined);
  if (normalization && (!Number.isFinite(normalization.sourceHeight) || normalization.sourceHeight <= 0
    || !Number.isFinite(normalization.facingYaw))) throw new Error('Measured NPC normalization required');
  if (normalization) vector(normalization.footOrigin, 'standing foot origin');
  const baked = options.bakedAccessories ?? [];
  if (!Array.isArray(baked) || baked.some(name => !NPC_PROP_FRAMES[name])) throw new Error('Invalid measured NPC baked accessory');
  const seatedReach = options.seatedReach ?? .6;
  if (!Number.isFinite(seatedReach) || seatedReach < .35 || seatedReach > .75) throw new Error('NPC seated reach must be .35–.75 of measured leg length');
  // Hand centroid scale must be explicit when keeping a held prop. Keeper has
  // no held tool, so it can use its 24-joint calibration without hand sockets.
  if (options.handScale !== undefined) for (const [side, frame] of [['left', 'foreL'], ['right', 'foreR']]) {
    const hand = calibration?.hands?.[side];
    if (hand?.name !== `${side === 'left' ? 'Left' : 'Right'}Hand`) throw new Error(`Wrong measured NPC ${side} hand`);
    sockets.set(frame, { bone: bones.get(hand.name), matrix: npcHandContactTransform(hand, { ...options.grips?.[frame], handScale: options.handScale }) });
  }
  for (const [frame, socket] of Object.entries(options.sockets ?? {})) {
    if (!Object.values(NPC_PROP_FRAMES).includes(frame) || !bones.has(socket.bone)) throw new Error(`Invalid measured NPC socket: ${frame}`);
    const matrix = new THREE.Matrix4().fromArray(vector(socket.matrix, `${frame} socket`, 16));
    if (Math.abs(matrix.determinant()) < 1e-8 || matrix.elements[3] !== 0 || matrix.elements[7] !== 0 || matrix.elements[11] !== 0 || matrix.elements[15] !== 1) throw new Error(`Invalid measured NPC socket matrix: ${frame}`);
    sockets.set(frame, { bone: bones.get(socket.bone), matrix });
  }
  const toolFit = {};
  if (context.spec.family === 'monk_novice' && sockets.has('foreR') && options.grips?.foreR?.contact) {
    // The retained broom was built for an adult. Fit its length to this actual
    // novice's hand-to-floor distance, scaling about the measured grip so the
    // handle never slides through the hand. Skin/body geometry is untouched.
    const grip = new THREE.Vector3().fromArray(vector(options.grips.foreR.contact, 'novice broom grip'));
    const socket = sockets.get('foreR'), r = records.get(socket.bone.name);
    const centre = grip.clone().applyMatrix4(socket.matrix).applyQuaternion(r.neutral).add(r.point);
    const geometry = GEAR_PARTS.find(p => p.name === 'broom').geo(); geometry.computeBoundingBox();
    const reach = grip.y - geometry.boundingBox.min.y; geometry.dispose();
    const scale = THREE.MathUtils.clamp((centre.y - normalization.footOrigin[1] - .03) / reach, .2, 1);
    socket.matrix.multiply(new THREE.Matrix4().makeTranslation(...grip)).multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
      .multiply(new THREE.Matrix4().makeTranslation(...grip.clone().negate()));
    toolFit.broomScale = scale;
  }
  const propPresentation = {};
  const tools = options.stowedTools === true ? createNPCToolPresentation(model, calibration, context.spec.family, { normalization }) : null;
  let paddleFit = null, guardSpear = null, basketStand = null;
  if (context.spec.family === 'boatman' && sockets.has('foreR') && options.grips?.foreR?.contact) {
    const geometry = GEAR_PARTS.find(p => p.name === 'paddle').geo(); geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox, corners = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
    geometry.dispose();
    paddleFit = { grip: new THREE.Vector3().fromArray(vector(options.grips.foreR.contact, 'boatman paddle grip')), corners };
    toolFit.paddleFloorClearance = .02;
  }
  if (context.spec.family === 'city_guard' && sockets.has('foreR')) {
    const geometry = GEAR_PARTS.find(p => p.name === 'spear').geo(); geometry.computeBoundingBox();
    const minY = geometry.boundingBox.min.y; geometry.dispose();
    guardSpear = { minY, shaftCentre: new THREE.Vector3(0, RIG.handY + .45, .02).negate(),
      torsoNeutralInverse: new THREE.Matrix4().makeRotationFromQuaternion(records.get('Spine02').neutral.clone().invert()) };
    toolFit.spearStationary = 'ground-parked'; toolFit.spearMoving = 'back-holstered';
  }
  if (context.spec.family === 'gate_supplier' && sockets.has('foreL')) {
    const geometry = GEAR_PARTS.find(p => p.name === 'basket').geo(); geometry.computeBoundingBox();
    basketStand = { minY: geometry.boundingBox.min.y }; geometry.dispose();
    toolFit.basketStationary = 'ground-display'; toolFit.basketMoving = 'stowed';
  }
  for (const frame of sockets.keys()) frames[frame] = new THREE.Matrix4();
  const wai = activities.wai ? createNPCWaiPose(model, calibration, options) : null;
  const proceduralParts = [...new Set([...Object.keys(NPC_PROP_FRAMES).filter(name => sockets.has(NPC_PROP_FRAMES[name])), ...(tools?.parts ?? [])])];
  const q = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), modelQ = new THREE.Quaternion();
  const hip = new THREE.Vector3(), knee = new THREE.Vector3(), foot = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3(), pole = new THREE.Vector3();
  const forward = new THREE.Vector3(), current = new THREE.Vector3(), wanted = new THREE.Vector3(), poseShift = new THREE.Vector3();
  const rootLinear = new THREE.Matrix3();
  const propPoint = new THREE.Vector3(), propGrip = new THREE.Vector3(), propTranslate = new THREE.Matrix4(), propScale = new THREE.Matrix4(), propRotate = new THREE.Matrix4();
  const legs = ['Left', 'Right'].map(side => {
    const thigh = records.get(side + 'UpLeg'), shin = records.get(side + 'Leg'), ankle = records.get(side + 'Foot');
    const upper = thigh.point.distanceTo(shin.point), lower = shin.point.distanceTo(ankle.point);
    if (upper < .05 || lower < .05 || Math.abs(shin.bone.position.length() - upper) > .003 || Math.abs(ankle.bone.position.length() - lower) > .003) throw new Error(`NPC calibration leg length mismatch: ${side}`);
    return { thigh, shin, ankle, upper, lower };
  });
  function rotate(name, axis, amount) {
    const r = records.get(name); r.bone.quaternion.multiply(q.setFromAxisAngle(r[axis], amount));
  }
  function worldRotation(bone, rotation) {
    bone.parent.getWorldQuaternion(parentQ); bone.quaternion.copy(parentQ.invert().multiply(rotation)); bone.updateWorldMatrix(false, true);
  }
  function aim(bone, child, position) {
    bone.getWorldPosition(current); child.getWorldPosition(wanted); wanted.sub(current).normalize(); direction.copy(position).sub(current).normalize();
    q.setFromUnitVectors(wanted, direction).multiply(bone.getWorldQuaternion(parentQ)); worldRotation(bone, q);
  }
  function plant(c, leg, seated) {
    const { thigh, shin, ankle, upper, lower } = leg;
    thigh.bone.getWorldPosition(hip); shin.bone.getWorldPosition(knee); ankle.bone.getWorldPosition(foot);
    target.copy(ankle.point).applyMatrix4(model.matrixWorld);
    // Hold the original floor targets while the torso shifts its weight. Undo
    // the complete pose-root offset, including yaw/scale, not only its height.
    target.sub(poseShift);
    const scale = model.getWorldScale(current).y, a = upper * scale, b = lower * scale;
    const upright = c.state === 'sit' && motion.seated === 'upright';
    const stance = upright ? 0 : c.pose[leg.thigh.bone.name.startsWith('Left') ? 'legL' : 'legR'] * motion.stance;
    target.addScaledVector(forward, (a + b) * (seated ? seatedReach : -THREE.MathUtils.clamp(stance, -.3, .3) * .25));
    direction.copy(target).sub(hip); const distance = direction.length();
    if (distance > a + b + .003 || distance < Math.abs(a - b) + 1e-5) throw new Error('NPC planted foot target unreachable');
    direction.normalize();
    const d = Math.min(distance, a + b - 1e-7), along = (a * a - b * b + d * d) / (2 * d), rise = Math.sqrt(Math.max(0, a * a - along * along));
    // The signed canonical front fixes the physical knee plane even when a
    // near-straight rest chain has no stable bend direction. A lateral weight
    // shift must not turn the knee into a sideways hinge.
    pole.copy(forward).addScaledVector(direction, -forward.dot(direction));
    pole.normalize(); knee.copy(hip).addScaledVector(direction, along).addScaledVector(pole, rise);
    aim(thigh.bone, shin.bone, knee); aim(shin.bone, ankle.bone, target);
    q.copy(modelQ).multiply(ankle.neutral); worldRotation(ankle.bone, q);
  }
  const approved = options.qaApproved === true && !!normalization && options.revision === context.spec.revision
    && /^[a-f0-9]{64}$/.test(options.assetSha256 ?? '') && context.source?.assetSha256 === options.assetSha256;
  return {
    normalization, proceduralParts, bakedAccessories: baked, geometryAssetSha256: options.geometryAssetSha256,
    roleMotion: motion, activityPoses: activities, toolFit: Object.freeze(toolFit), scabbards: tools?.scabbards ?? [], suppressedAccessories: options.suppressedAccessories ?? [],
    propPresentation: () => ({ ...propPresentation, ...(tools?.presentation() ?? {}) }),
    supports: c => approved && ['idle', 'walk', 'talk', 'work', 'sit'].includes(c.state)
      && ['y', 'bend', 'legL', 'legR', 'armLx', 'armRx', 'armLz', 'armRz', 'headYaw', 'headPitch'].every(key => Number.isFinite(c.pose[key])),
    reset() { for (const r of records.values()) { r.bone.position.copy(r.position); r.bone.scale.copy(r.scale); r.bone.quaternion.copy(r.rest); } },
    apply(c) {
      const p = c.pose, clamp = THREE.MathUtils.clamp;
      // The native clip owns gait, including vertical motion. Applying the old
      // procedural torso/head/arms as well would also shear cloth and lower a
      // correctly grounded native foot. Carrying props still follow its hands.
      c.poseRoot.position.set(0, 0, 0);
      if (c.moving) return;
      for (const r of records.values()) r.bone.quaternion.copy(r.idle);
      // Slow, seeded cycles on measured local axes. No bone scaling, chest
      // translation or extra hand/finger articulation. Only ordinary idle gets
      // this loop; work/talk/sit continue to use the NPC's authored pose output.
      const idle = !c.moving && c.state === 'idle', clock = c.time + (c.npc.seed ?? 0);
      const breathing = idle || c.state === 'sit';
      const breath = breathing ? Math.sin(clock * (Math.PI * 2 / 4.4)) : 0;
      const weight = idle ? Math.sin(clock * (Math.PI * 2 / 7.6)) : 0;
      rotate('Spine02', 'pitch', clamp(p.bend, -.15, .35) * motion.torso);
      rotate('Head', 'yaw', clamp(p.headYaw, -.6, .6) * motion.head); rotate('Head', 'pitch', clamp(p.headPitch, -.35, .35) * motion.head);
      if (breathing) {
        rotate('Spine', 'pitch', breath * .012); rotate('Spine02', 'roll', -weight * .009);
        rotate('Head', 'pitch', -breath * .004); rotate('Head', 'roll', weight * .004);
      }
      for (const [side, key] of [['Left', 'L'], ['Right', 'R']]) {
        const spread = Math.sign(records.get(side + 'Hand').point.x - records.get('Hips').point.x);
        rotate(side + 'Arm', 'pitch', clamp(p[`arm${key}x`], -2.5, .5) * motion.arm);
        // NPC.animate's ordinary rest has .06 roll and .12 elbow bend. Both
        // already exist in the independently fitted idle; add only changes.
        rotate(side + 'Arm', 'roll', spread * clamp(p[`arm${key}z`] - .06, -.55, .55) * motion.arm);
        rotate(side + 'ForeArm', 'pitch', -(elbowBend(p[`arm${key}x`]) - elbowBend(0)) * motion.arm);
      }
      if (!c.moving) {
        model.updateWorldMatrix(true, true);
        const ratio = model.getWorldScale(current).y / c.root.scale.y;
        const shiftX = idle ? Math.abs(legs[0].thigh.point.x - legs[1].thigh.point.x) * .08 * weight : 0;
        const shiftZ = idle ? (legs[0].upper + legs[0].lower) * .002 * breath : 0;
        if (idle) {
          const yaw = normalization.facingYaw;
          c.poseRoot.position.x = (shiftX * Math.cos(yaw) + shiftZ * Math.sin(yaw)) * ratio;
          c.poseRoot.position.z = (-shiftX * Math.sin(yaw) + shiftZ * Math.cos(yaw)) * ratio;
          c.poseRoot.position.y = -normalization.sourceHeight * .003 * ratio * (.5 - .5 * Math.cos(clock * (Math.PI * 2 / 4.4)));
        }
        let riseLimit = Infinity, sittingDrop = 0;
        for (const leg of legs) {
          const length = leg.upper + leg.lower, key = leg.thigh.bone.name.startsWith('Left') ? 'legL' : 'legR';
          const dx = leg.thigh.point.x - leg.ankle.point.x + shiftX;
          const stance = c.state === 'sit' && motion.seated === 'upright' ? 0 : p[key] * motion.stance;
          const dz = leg.thigh.point.z - leg.ankle.point.z + shiftZ + clamp(stance, -.3, .3) * length * .25;
          riseLimit = Math.min(riseLimit, (Math.sqrt(Math.max(0, length * length - dx * dx - dz * dz)) - (leg.thigh.point.y - leg.ankle.point.y)) * ratio);
          sittingDrop += -(leg.thigh.point.y - leg.ankle.point.y - length * .25) * ratio / legs.length;
        }
        // Ground-seated height scales with the measured chain, including the
        // novice. Standing bob/stance never asks a straight leg to stretch.
        const seated = c.state === 'sit' && motion.seated === 'ground';
        c.poseRoot.position.y = seated ? sittingDrop : Math.min(c.poseRoot.position.y, riseLimit);
        model.updateWorldMatrix(true, true); model.getWorldQuaternion(modelQ);
        poseShift.copy(c.poseRoot.position).applyMatrix3(rootLinear.setFromMatrix4(c.root.matrixWorld));
        forward.set(0, 0, 1).applyQuaternion(modelQ);
        // An upright robe presentation keeps the standing feet; authored sit
        // leg angles are not a standing stance request.
        for (const leg of legs) plant(c, leg, seated);
      }
      // Parent-owned, measured arm IK is opt-in only. It follows body/leg
      // placement so its world-space targets and palm planes stay coherent.
      wai?.apply(c);
    },
    propFrames(c) {
      for (const [frame, socket] of sockets) frames[frame].copy(socket.bone.matrixWorld).multiply(socket.matrix);
      if (paddleFit && c && !tools) {
        // Keep the reviewed resting hand cup and exact grip contact. Fit only
        // the existing prop length, about that contact, to its actual world
        // floor clearance; native gait and source skin remain untouched.
        const frame = frames.foreR, grip = paddleFit.grip;
        propGrip.copy(grip).applyMatrix4(frame);
        let reach = 0;
        for (const corner of paddleFit.corners) reach = Math.max(reach, propGrip.y - propPoint.copy(corner).applyMatrix4(frame).y);
        const floor = c.root.matrixWorld.elements[13], scale = reach > 0 ? THREE.MathUtils.clamp((propGrip.y - floor - .02) / reach, .2, 1) : 1;
        frame.multiply(propTranslate.makeTranslation(...grip)).multiply(propScale.makeScale(scale, scale, scale))
          .multiply(propTranslate.makeTranslation(-grip.x, -grip.y, -grip.z));
        propPresentation.paddle = 'floor-fitted'; propPresentation.paddleScale = scale;
      }
      if (guardSpear && c) {
        const frame = frames.foreR;
        // The open source hand does not certify a shaft grasp. A stationary
        // guard parks the butt on the ground; during travel the shaft is
        // carried behind the torso. Both spear and tip share this same frame.
        if (!c.moving) {
          const size = context.spec.height / (normalization.sourceHeight * c.root.scale.y);
          frame.copy(c.root.matrixWorld).multiply(propRotate.makeRotationY(normalization.facingYaw))
            .multiply(propScale.makeScale(size, size, size)).multiply(propTranslate.makeTranslation(-.42, -guardSpear.minY + .005, .06));
          propPresentation.spear = 'ground-parked';
        } else {
          const torso = records.get('Spine02');
          frame.copy(torso.bone.matrixWorld).multiply(guardSpear.torsoNeutralInverse)
            .multiply(propTranslate.makeTranslation(-.12, .14, -.28)).multiply(propRotate.makeRotationZ(.61))
            .multiply(propTranslate.makeTranslation(...guardSpear.shaftCentre));
          propPresentation.spear = 'back-holstered';
        }
      }
      if (basketStand && c) {
        // The Meshy vendor has open palms. Display the wares beside the vendor
        // rather than intersecting its wrist to imitate an unsupported grasp.
        const size = context.spec.height / (normalization.sourceHeight * c.root.scale.y);
        frames.foreL.copy(c.root.matrixWorld).multiply(propRotate.makeRotationY(normalization.facingYaw))
          .multiply(propScale.makeScale(size, size, size)).multiply(propTranslate.makeTranslation(.43, -basketStand.minY + .01, .22));
        propPresentation.basket = c.moving ? 'stowed' : 'ground-display';
      }
      return tools ? tools.frames(c, frames) : frames;
    },
  };
}

export function registerMeshy24NPCPoseAdapter(family, calibration, options = {}) {
  return registerNPCPoseAdapter(family, (model, context) => context.source?.assetSha256 === options.assetSha256
    ? createMeshy24NPCPoseAdapter(model, context, calibration, options) : null);
}

const familyProfiles = new Map();
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const npcModelProfile = family => familyProfiles.get(family) ?? null;

/** Per-file sanitized contract (parent owns model-profiles/<family>.json):
 * {schema:1,family,revision,assetSha256,qaApproved:true,calibration,
 * geometryAssetSha256?,normalization?,handScale?,grips?,sockets?,
 * bakedAccessories?:[legacyPartID]}.
 * geometryAssetSha256 references the frozen unpatterned GLB used to measure
 * anatomy (not a claim that its entire file hash hashes only vertex buffers).
 * assetSha256 pins final textured bytes. qaApproved means the parent completed
 * both final gates. The earlier explicit qa:{art,runtime} format also works.
 * Each calibration is its own Meshy-24 nodes/idleWorld contract; never shared
 * by copying another family's quaternions. JSON carries no source paths/URLs.
 */
export function registerNPCModelProfiles(catalog) {
  if (catalog?.schema !== 1 || !Array.isArray(catalog.families)) throw new Error('NPC profile catalog schema 1 required');
  const seen = new Set(), profiles = catalog.families.map(p => {
    if (!NPC_MODELS[p?.family] || seen.has(p.family)) throw new Error('Unknown/duplicate NPC profile family');
    seen.add(p.family);
    const explicitQA = typeof p.qaApproved === 'boolean', splitQA = typeof p.qa?.art === 'boolean' && typeof p.qa?.runtime === 'boolean';
    if ((p.schema !== undefined && p.schema !== 1) || typeof p.revision !== 'string' || !/^[a-zA-Z0-9_.-]{1,128}$/.test(p.revision)
      || (p.geometryAssetSha256 !== undefined && !validHash(p.geometryAssetSha256)) || !validHash(p.assetSha256)
      || (!explicitQA && !splitQA)) throw new Error(`Invalid NPC profile identity/QA: ${p.family}`);
    const qaApproved = (explicitQA ? p.qaApproved : true) && (splitQA ? p.qa.art && p.qa.runtime : true);
    const c = p.calibration;
    if (!c?.nodes || c.schema !== 1 || c.coordinates?.up !== '+Y' || c.coordinates?.front !== '+Z'
      || c.coordinates.height !== NPC_MODELS[p.family].height) throw new Error(`Invalid NPC profile calibration: ${p.family}`);
    vector(c.coordinates.footOrigin, 'profile foot origin');
    const nodes = {};
    for (const name of MESHY24) {
      const node = c.nodes[name]; vector(node?.idleWorld, `${name} profile world`, 16);
      measuredQuaternion(node?.idleLocal?.rotation, `${name} profile idle`); measuredQuaternion(node?.bindLocal?.rotation, `${name} profile bind`);
      nodes[name] = { parent: node.parent, idleWorld: [...node.idleWorld], idleLocal: { rotation: [...node.idleLocal.rotation] }, bindLocal: { rotation: [...node.bindLocal.rotation] } };
    }
    const hands = {};
    for (const side of ['left', 'right']) if (c.hands?.[side]) {
      const h = c.hands[side];
      if (h.name !== `${side === 'left' ? 'Left' : 'Right'}Hand` || !Number.isInteger(h.vertices) || h.vertices < 12) throw new Error(`Invalid NPC profile hand: ${p.family}`);
      hands[side] = { name: h.name, vertices: h.vertices };
      for (const key of ['centroid', 'wrist', 'fingersWorld', 'palmWorld', 'fingersLocal', 'palmLocal']) hands[side][key] = [...vector(h[key], `profile ${key}`)];
    }
    if (p.bakedAccessories !== undefined && (!Array.isArray(p.bakedAccessories) || p.bakedAccessories.some(name => !NPC_PROP_FRAMES[name]))) throw new Error(`Invalid NPC profile accessories: ${p.family}`);
    if (p.suppressedAccessories !== undefined && (!Array.isArray(p.suppressedAccessories) || p.suppressedAccessories.some(name => !NPC_PROP_FRAMES[name]))) throw new Error('Invalid NPC suppressed accessories');
    if (p.stowedTools !== undefined && (typeof p.stowedTools !== 'boolean'
      || (p.stowedTools && !['master_sword','master_bandit','enhancer','master_hunter','monk_novice','boatman'].includes(p.family)))) throw new Error('Invalid NPC stowed tool policy');
    // Only known runtime fields survive this boundary; tools may keep receipts,
    // private output paths and preparation metadata elsewhere.
    return Object.freeze({ schema: 1, family: p.family, revision: p.revision, geometryAssetSha256: p.geometryAssetSha256, assetSha256: p.assetSha256,
      qaApproved, stowedTools: p.stowedTools === true,
      calibration: { schema: 1, coordinates: { up: '+Y', front: '+Z', height: c.coordinates.height, footOrigin: [...c.coordinates.footOrigin] }, nodes, hands },
      normalization: p.normalization, handScale: p.handScale,
      grips: p.grips, sockets: p.sockets, roleMotion: roleMotion(p.family, p.roleMotion), activityPoses: activityPoses(p.family, p.activityPoses),
      bakedAccessories: Object.freeze([...(p.bakedAccessories ?? [])]), suppressedAccessories: Object.freeze([...(p.suppressedAccessories ?? [])]) });
  });
  const cleanup = profiles.map(p => {
    familyProfiles.set(p.family, p);
    const unregister = registerMeshy24NPCPoseAdapter(p.family, p.calibration, { ...p, revision: NPC_MODELS[p.family].revision });
    return () => { unregister(); if (familyProfiles.get(p.family) === p) familyProfiles.delete(p.family); };
  });
  return () => cleanup.forEach(f => f());
}

export function registerBundledNPCModelProfiles(modules) {
  const families = Object.entries(modules).map(([path, profile]) => {
    if (profile?.schema !== 1 || path !== `./model-profiles/${profile.family}.json`) throw new Error('NPC bundled profile filename/schema mismatch');
    return profile;
  });
  return registerNPCModelProfiles({ schema: 1, families });
}

function disposeSource(source) {
  const geometry = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const scene of source.scenes ?? [source.scene]) scene?.traverse(o => {
    if (o.geometry) geometry.add(o.geometry); if (o.skeleton) skeletons.add(o.skeleton);
    for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) {
      materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose()); skeletons.forEach(s => s.dispose());
}

// Cache owns source geometry, materials, textures and immutable clips. Renderers
// own only cloned materials/skeletons/mixers. dispose() is for application
// shutdown after renderers have been released, not ordinary map unloads.
export function createNPCModelCache(loadSource) {
  const records = new Map(), disposedSources = new WeakSet();
  let disposed = false;
  const release = source => { if (source && !disposedSources.has(source)) { disposedSources.add(source); disposeSource(source); } };
  return {
    load(spec) {
      if (disposed) return Promise.reject(new Error('NPC source cache disposed'));
      const url = `${import.meta.env?.BASE_URL ?? '/'}${spec.url}?v=${encodeURIComponent(spec.revision)}`;
      if (records.has(url)) return records.get(url).promise;
      const record = { source: null, promise: null };
      record.promise = Promise.resolve().then(() => loadSource(url, spec)).then(source => {
        if (!source?.scene?.isObject3D) throw new Error('NPC GLB has no scene');
        record.source = source;
        if (disposed) { release(source); throw new Error('NPC source cache disposed during load'); }
        source.scene.traverse(o => { if (o.geometry) o.geometry.userData.npcCached = true; });
        return source;
      }).catch(error => { if (records.get(url) === record) records.delete(url); throw error; });
      records.set(url, record);
      return record.promise;
    },
    dispose() { if (disposed) return; disposed = true; for (const record of records.values()) release(record.source); records.clear(); },
    get size() { return records.size; },
  };
}

// Parse precisely the bytes whose identity is approved. The one cache promise
// owns this fetch/hash/parse, shared by every NPC in the family.
export async function loadNPCModelSource(url, { fetchSource = globalThis.fetch,
  parseSource = (bytes, base) => gltfLoader().parseAsync(bytes, base),
  digest = bytes => globalThis.crypto.subtle.digest('SHA-256', bytes), expectedAssetSha256 } = {}) {
  let requestURL = url;
  if (expectedAssetSha256 !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(expectedAssetSha256)) throw new Error('NPC approved profile hash must be SHA-256');
    // Version the exact approved bytes even for callers outside the family
    // cache. Preserve the path, fragment and other query parameters; replacing
    // rev prevents a long-lived HTTP response from hiding a new approval.
    const sourceURL = String(url), fragmentAt = sourceURL.indexOf('#'), fragment = fragmentAt < 0 ? '' : sourceURL.slice(fragmentAt);
    const base = fragmentAt < 0 ? sourceURL : sourceURL.slice(0, fragmentAt), queryAt = base.indexOf('?');
    const parameters = new URLSearchParams(queryAt < 0 ? '' : base.slice(queryAt + 1)); parameters.set('rev', expectedAssetSha256);
    requestURL = `${queryAt < 0 ? base : base.slice(0, queryAt)}?${parameters}${fragment}`;
  }
  const response = await fetchSource(requestURL);
  if (!response.ok) throw new Error(`NPC GLB HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await digest(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (expectedAssetSha256 !== undefined && hash !== expectedAssetSha256) throw new Error('NPC GLB differs from approved profile hash');
  const resourcePath = new URL('.', new URL(url, globalThis.location?.href ?? 'http://localhost/')).href;
  const source = await parseSource(bytes, resourcePath); source.assetSha256 = hash;
  return source;
}

export function createProfiledNPCModelCache(loadSource = (url, hash) => loadNPCModelSource(url, { expectedAssetSha256: hash })) {
  const cache = createNPCModelCache((url, spec) => loadSource(url, spec.assetSha256));
  return {
    async load(spec) {
      const profile = familyProfiles.get(spec.family);
      if (!profile?.qaApproved) throw Object.assign(new Error(`No approved NPC model profile: ${spec.family}`), { code: 'NPC_MODEL_PROFILE_UNAPPROVED' });
      return cache.load({ ...spec, revision: `${profile.revision}-${profile.assetSha256}`, assetSha256: profile.assetSha256 });
    },
    dispose: () => cache.dispose(),
    get size() { return cache.size; },
  };
}

// Vite statically expands this literal eager glob. A typeof guard AROUND the
// call would remain false after expansion; catch only Node's missing glob API.
let bundledProfiles = {};
try { bundledProfiles = import.meta.glob('./model-profiles/*.json', { eager: true, import: 'default' }); }
catch (error) { if (typeof import.meta.glob !== 'undefined') throw error; }
try { registerBundledNPCModelProfiles(bundledProfiles); }
catch (error) { console.warn('[npc] Invalid bundled model profiles; procedural fallback', error.message); }

export const npcModelCache = createProfiledNPCModelCache();
