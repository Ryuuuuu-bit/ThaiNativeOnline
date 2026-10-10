import * as THREE from 'three';
import { GEAR_PARTS } from './body/gearParts.js';
import { RIG } from './body/rig.js';

// Existing geometry-space handle points, not hand sockets or a grasp claim.
const TOOLS = Object.freeze({
  master_sword: ['sword', 'foreR', .05, 'sheathed', 'swordScabbard'],
  master_bandit: ['knife', 'foreR', .06, 'sheathed', 'knifeScabbard'],
  enhancer: ['hammer', 'foreR', .05, 'belt-stowed'],
  master_hunter: ['bow', 'foreL', .10, 'back-stowed'],
  monk_novice: ['broom', 'foreR', .16, 'back-stowed'],
  boatman: ['paddle', 'foreR', .03, 'back-stowed'],
});
const finite = values => Array.isArray(values) && values.every(Number.isFinite);

function positiveUniform(matrix, label) {
  if (!matrix?.isMatrix4 || !matrix.elements.every(Number.isFinite)
    || matrix.elements[3] !== 0 || matrix.elements[7] !== 0 || matrix.elements[11] !== 0 || matrix.elements[15] !== 1
    || matrix.determinant() <= 1e-10) throw new Error(`Invalid non-reflected ${label}`);
  const e = matrix.elements, axes = [0, 4, 8].map(i => new THREE.Vector3(e[i], e[i + 1], e[i + 2]));
  const size = axes[0].length();
  if (axes.some(a => Math.abs(a.length() / size - 1) > 1e-5)
    || [[0, 1], [0, 2], [1, 2]].some(([a, b]) => Math.abs(axes[a].dot(axes[b])) / (size * size) > 1e-5)) {
    throw new Error(`Uniform rigid ${label} required`);
  }
  return size;
}

/** Retained tools only. Does not alter model, calibration, context or input frames.
 * Call frames(context, socketFrames) AFTER native/role pose and world updates.
 * Add parts to proceduralParts and scabbards to the active appearance spec;
 * map each scabbard to
 * foreR and author its geometry in the SAME legacy sword/knife frame.
 * presentation() returns a snapshot; existing prayer visibility stays with core.
 * Unconfigured families are a no-op (including current guard/basket policies).
 */
export function createNPCToolPresentation(model, calibration, family, options = {}) {
  const tool = TOOLS[family];
  if (!tool) return { parts: [], scabbards: [], frames: (_context, frames) => frames, presentation: () => ({}) };
  const [part, frame, handleZ, label, sheath] = tool;
  if (calibration?.schema !== 1 || calibration.coordinates?.up !== '+Y' || calibration.coordinates?.front !== '+Z') {
    throw new Error('Measured NPC tool coordinate contract required');
  }
  const normalization = options.normalization ?? {
    sourceHeight: calibration.coordinates.height, footOrigin: calibration.coordinates.footOrigin, facingYaw: 0,
  };
  const { sourceHeight, footOrigin, facingYaw } = normalization;
  if (!(Number.isFinite(sourceHeight) && sourceHeight > 0 && finite(footOrigin) && footOrigin.length === 3 && Number.isFinite(facingYaw))) {
    throw new Error('Measured NPC tool normalization required');
  }
  const bones = new Map();
  model.traverse(o => { if (o.isBone) { if (bones.has(o.name)) throw new Error(`Duplicate tool bone: ${o.name}`); bones.set(o.name, o); } });
  function measured(name) {
    const bone = bones.get(name), node = calibration.nodes?.[name];
    if (!bone || node?.parent !== bone.parent?.name || !finite(node?.idleWorld) || node.idleWorld.length !== 16) {
      throw new Error(`Actual calibrated tool bone required: ${name}`);
    }
    const matrix = new THREE.Matrix4().fromArray(node.idleWorld);
    if (Math.abs(positiveUniform(matrix, `${name} neutral`) - 1) > 1e-5) throw new Error('Canonical neutral tool bone must be unit scale');
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); matrix.decompose(p, q, s);
    return { bone, p, inverse: new THREE.Matrix4().makeRotationFromQuaternion(q.invert()) };
  }
  const hip = measured('Hips'), torso = measured('Spine02');
  const left = measured('LeftUpLeg'), right = measured('RightUpLeg'), chest = measured('Spine');
  const width = Math.max(Math.abs(left.p.x - hip.p.x), Math.abs(right.p.x - hip.p.x));
  const unit = sourceHeight / 1.72, grip = new THREE.Vector3(0, RIG.handY, handleZ);
  const geometry = GEAR_PARTS.find(p => p.name === part).geo();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox.clone(); geometry.dispose();
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const parked = ['broom', 'paddle'].includes(part), back = parked || part === 'bow';
  const anchor = back ? torso : hip;
  // Carry the paddle diagonally beyond the actual wide ngob brim; keep the
  // existing back distance and constant geometry scale, without moving the hat.
  const rotation = back
    ? new THREE.Matrix4().makeRotationZ(part === 'bow' ? .55 : part === 'paddle' ? -.8 : -.32).multiply(new THREE.Matrix4().makeRotationY(part === 'bow' ? Math.PI / 2 : 0))
    : new THREE.Matrix4().makeRotationZ(part === 'sword' ? -.25 : .12).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const mount = back
    ? new THREE.Vector3(torso.p.x, (hip.p.y + chest.p.y) / 2, Math.min(hip.p.z, torso.p.z, chest.p.z) - (part === 'bow' ? .36 : .24) * unit)
    : new THREE.Vector3(hip.p.x + (part === 'hammer' ? 1 : -1) * (width + .13 * unit), hip.p.y, hip.p.z + .04 * unit);
  // Center back tools on their measured envelope; hip tools hang from handles.
  const pivot = back ? bounds.getCenter(new THREE.Vector3()) : grip;
  const relative = corners.map(p => p.clone().sub(pivot).applyMatrix4(rotation));
  const reach = Math.max(...relative.map(p => -p.y));
  // One constant fit from neutral floor clearance, never per-frame stretching.
  const toolScale = Math.min(unit, reach > 0 ? (mount.y - footOrigin[1] - .08 * unit) / reach : unit);
  if (!(toolScale > 0)) throw new Error('Measured tool mount has no floor clearance');
  // Keep the exact legacy handle as the transform pivot even for a centered back mount.
  const handleMount = mount.clone().add(grip.clone().sub(pivot).applyMatrix4(rotation).multiplyScalar(toolScale));
  const local = anchor.inverse.clone()
    .multiply(new THREE.Matrix4().makeTranslation(...handleMount.clone().sub(anchor.p)))
    .multiply(rotation).multiply(new THREE.Matrix4().makeScale(toolScale, toolScale, toolScale))
    .multiply(new THREE.Matrix4().makeTranslation(...grip.clone().negate()));
  const state = { [part]: label }, mountedFrame = new THREE.Matrix4(), parkedFrame = new THREE.Matrix4();
  const translate = new THREE.Matrix4(), rotate = new THREE.Matrix4(), scale = new THREE.Matrix4(), point = new THREE.Vector3();
  return {
    parts: sheath ? [sheath] : [],
    scabbards: sheath ? [sheath] : [],
    presentation: () => ({ ...state }),
    frames(context, frames) {
      if (parked && !context.moving) {
        const root = context.root?.matrixWorld, rootScale = positiveUniform(root, 'tool world root');
        const targetHeight = context.spec?.height;
        if (!(Number.isFinite(targetHeight) && targetHeight > 0)) throw new Error('Actual NPC target height required');
        // Root is navigation/ground, not poseRoot, model bounds, or a wrist.
        const normalized = targetHeight / (sourceHeight * rootScale), size = normalized * unit;
        parkedFrame.copy(root).multiply(rotate.makeRotationY(facingYaw)).multiply(scale.makeScale(size, size, size))
          .multiply(translate.makeTranslation((width / unit + .29), 0, .12));
        let floor = Infinity;
        for (const corner of corners) floor = Math.min(floor, point.copy(corner).applyMatrix4(parkedFrame).y);
        parkedFrame.elements[13] += root.elements[13] + .005 - floor;
        state[part] = 'ground-parked';
        return { ...frames, [frame]: parkedFrame.clone() };
      }
      positiveUniform(anchor.bone.matrixWorld, 'tool attachment');
      mountedFrame.copy(anchor.bone.matrixWorld).multiply(local);
      state[part] = label;
      return { ...frames, [frame]: mountedFrame.clone() };
    },
  };
}
