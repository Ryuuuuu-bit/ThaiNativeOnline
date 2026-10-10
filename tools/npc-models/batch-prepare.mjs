// Bounded local sidecar: select approved generations, measure each actual body,
// and call the frozen preparation pipeline. Never writes runtime/public assets.
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256 } from './glb.mjs';
import { THREE, loadRig, worldVertices, canonicalFrame, canonicalWorlds, assertNativeContract, restoreRest, rigContract } from './rig.mjs';
import { inspectRig, kneeMetrics, auditRig } from './audit.mjs';
import { compileCalibration, adapterContract, MESHY_NPC_JOINTS } from './calibration.mjs';
import { fitRelaxedIdle, measureHand } from './anatomy.mjs';
import { continuousFourWeights } from './weights.mjs';
import { REPO, OUTPUT_ROOT, candidateDirectory, prepareInputs, validateCalibration, buildCandidate, packingDependencies, textureOverrideBytes } from './prepare.mjs';

export const GENERATIONS = Object.freeze({ general_merchant: 1, enhancer: 1, herbalist: 1, master_muay: 1, master_sword: 1, master_shaman: 1, boatman: 1, blacksmith: 2, master_hunter: 2, master_bandit: 2, city_guard: 2, master_herbal: 2, monk_elder: 2, monk_novice: 2, gate_supplier: 2, occultist: 2 });
const semantics = { hips: 'Hips', head: 'Head', left: { upperArm: 'LeftArm', forearm: 'LeftForeArm', hand: 'LeftHand', thigh: 'LeftUpLeg', shin: 'LeftLeg', foot: 'LeftFoot' }, right: { upperArm: 'RightArm', forearm: 'RightForeArm', hand: 'RightHand', thigh: 'RightUpLeg', shin: 'RightLeg', foot: 'RightFoot' } };
const armNodes = new Set(['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']);
const legNodes = new Set(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']);
const muayTexture = { path: 'artifacts/city-npc-models/muay-texture/colour.png', sha256: 'a4d538bc512fdc58dca6d03151b58ce1f40e227e8b3254863709dfaa01527382' };

async function prepareScaleReviewed(options, sources) {
  const profileBytes = await readFile(options.calibration), profile = JSON.parse(profileBytes), max = profile.nativeScaleNoiseMax;
  const scaleReview = [];
  if (max && !(max > 0 && max <= .000025)) throw Error('Native scale review only permits measured <=25ppm export noise');
  if (max) for (const role of ['walk', 'run']) for (const object of sources[role].mesh.skeleton.bones) {
    const rest = sources[role].rest.get(object), original = rest.s.toArray(), error = Math.max(...original.map(v => Math.abs(v - 1)));
    if (error > max) throw Error(`Native rest scale exceeds export-noise review: ${role}/${sources[role].objectNames.get(object)}`);
    rest.s.set(1, 1, 1);
    if (error) scaleReview.push({ role, bone: sources[role].objectNames.get(object), kind: 'loaded neutral local scale', original, maxSourceDeviation: error, replacement: [1, 1, 1] });
  }
  if (max) for (const role of ['walk', 'run']) for (const track of sources[role].gltf.animations[0].tracks) if (track.name.endsWith('.scale')) {
    const name = track.name.slice(0, -6), object = sources[role].names.get(name); if (!object) throw Error('Unknown scale track');
    const rest = sources[role].rest.get(object).s.toArray(); let maxError = 0;
    for (let i = 0; i < track.values.length; i++) maxError = Math.max(maxError, Math.abs(track.values[i] - rest[i % 3]));
    if (maxError > max) throw Error(`Native scale exceeds measured noise allowance: ${role}/${name}`);
    for (let i = 0; i < track.values.length; i++) track.values[i] = rest[i % 3];
    if (maxError) scaleReview.push({ role, bone: name, maxSourceDeviation: maxError, replacement: rest });
  }
  const weightReview = profile.anatomicalWeightMask ? applyWeightMask(sources.body, profile) : null;
  const deps = packingDependencies(options.deps), result = await buildCandidate(sources, profile, { dependencies: deps }), output = await candidateDirectory(options.out);
  const unpacked = path.join(output, `${options.family}-unpacked.glb`), candidate = path.join(output, `${options.family}.glb`);
  await writeFile(unpacked, result.bytes);
  await promisify(execFile)(process.execPath, [deps.gltfpack, '-i', unpacked, '-o', candidate, '-cc', '-kn', '-ke'], { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true });
  const packed = await loadRig(candidate), audit = auditRig(packed, { height: profile.height, semantics: profile.semantics }), actual = rigContract(packed), expected = rigContract(sources.body);
  if (actual.length !== expected.length || expected.some(n => !actual.some(a => a.name === n.name && a.parent === n.parent && a.joint === n.joint))) throw Error('Packed scale-reviewed rig names/ancestry changed');
  for (const role of ['body', 'walk', 'run']) if (sha256(await readFile(options[role])) !== sources[role].sha256) throw Error(`Original input changed: ${role}`);
  if (profile.textureOverride) await textureOverrideBytes(profile.textureOverride);
  const report = { schema: 1, family: options.family, candidate, sha256: packed.sha256, sources: profile.sources, inputPaths: Object.fromEntries(['body','walk','run'].map(role => [role,path.resolve(options[role])])), calibrationPath: path.resolve(options.calibration), calibrationSHA256: sha256(profileBytes), height: profile.height, source: result.sourceReport, frame: { matrix: result.frame.matrix.toArray(), scale: result.frame.scale, sourceHeight: result.frame.sourceHeight }, weightRepair: result.weightRepair, floorCorrections: result.floorCorrections, texture: result.texture, animations: result.animations, nativeScaleReview: max ? { originalFilesUnchanged: true, maxAllowedDeviation: max, tracks: scaleReview } : null, anatomicalWeightReview: weightReview, dependencies: { node: process.version, helperProject: deps.project, gltfpack: deps.gltfpack }, audit };
  const reportPath = path.join(output,`${options.family}-qa.json`); await writeFile(reportPath, JSON.stringify(report,null,2)+'\n');
  return { family: options.family, candidate, report: reportPath, sha256: packed.sha256, passed: audit.passed, failures: audit.failures, bytes: packed.bytes.length, triangles: audit.structure.triangles, clips: audit.clips };
}

function applyWeightMask(rig, profile) {
  const config = profile.anatomicalWeightMask, before = worldVertices(rig), frame = canonicalFrame(before, profile, profile.height), worlds = canonicalWorlds(rig, frame), p = n => new THREE.Vector3().setFromMatrixPosition(worlds.get(n)), hip = p('Hips'), scale = profile.height / 1.72;
  const smooth = (a,b,x) => { const t = THREE.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const width = Math.abs(p('LeftArm').x-p('RightArm').x) * config.torsoWidthFactor;
  const yLow = hip.y + .015*scale, yHigh = Math.min(p('LeftForeArm').y,p('RightForeArm').y) - config.elbowClearance*scale;
  if (!(yHigh>yLow+.02*scale) || !(width>.05*scale)) throw Error('Measured cloth attenuation bounds are ambiguous');
  const names = rig.mesh.skeleton.bones.map(o=>rig.objectNames.get(o)), {skinIndex,skinWeight} = rig.mesh.geometry.attributes;
  let changedVertices=0,maxWeightChange=0;
  for(let i=0;i<skinIndex.count;i++){
    const v=new THREE.Vector3().fromArray(before,i*3).applyMatrix4(frame.matrix), weights=[], original=[];
    if(config.clothWrap){
      const old=new Float64Array(names.length);for(let k=0;k<4;k++)old[skinIndex.getComponent(i,k)]+=skinWeight.getComponent(i,k);
      const field=old.slice(),side=smooth(hip.x-.045*scale,hip.x+.045*scale,v.x),insideX=1-smooth(width,width+.10*scale,Math.abs(v.x-hip.x)),insideZ=1-smooth(.30*scale,.42*scale,Math.abs(v.z-hip.z));
      const minY=hip.y-config.clothDepth*scale,maxY=hip.y+.15*scale,wrap=smooth(minY,minY+.12*scale,v.y)*(1-smooth(maxY-.12*scale,maxY,v.y))*insideX*insideZ;
      const target=new Float64Array(names.length);target[names.indexOf('Hips')]=.85;target[names.indexOf('LeftUpLeg')]=.15*side;target[names.indexOf('RightUpLeg')]=.15*(1-side);
      for(let j=0;j<field.length;j++)field[j]=field[j]*(1-wrap)+target[j]*wrap;
      const torsoMin=hip.y+.02*scale,torsoMax=p('Spine').y-.025*scale,torso=smooth(torsoMin,torsoMin+.12*scale,v.y)*(1-smooth(torsoMax-.10*scale,torsoMax,v.y))*insideX*insideZ;
      for(let j=0;j<field.length;j++)field[j]*=1-torso;field[names.indexOf('Spine02')]+=torso;
      const strongest=continuousFourWeights(field);let delta=0;for(let k=0;k<4;k++){skinIndex.setComponent(i,k,strongest[k].j);skinWeight.setComponent(i,k,strongest[k].v);}for(let j=0;j<field.length;j++)delta=Math.max(delta,Math.abs(old[j]-(strongest.find(w=>w.j===j)?.v??0)));
      if(delta>1e-6)changedVertices++;maxWeightChange=Math.max(maxWeightChange,delta);continue;
    }
    const lower=1-smooth(yLow,yHigh,v.y), centre=1-smooth(width,width+.12*scale,Math.abs(v.x-hip.x));
    const segmentDistance=side=>{const a=p(side+'Leg'),b=p(side+'Foot'),d=b.clone().sub(a),t=THREE.MathUtils.clamp(v.clone().sub(a).dot(d)/d.lengthSq(),0,1);return v.distanceTo(a.addScaledVector(d,t));};
    const leftDistance=segmentDistance('Left'),rightDistance=segmentDistance('Right');
    for(let k=0;k<4;k++){
      const j=skinIndex.getComponent(i,k),n=names[j],w=skinWeight.getComponent(i,k);let factor=1;original.push(w);
      if(/(Shoulder|Arm|Hand)$/.test(n)) factor*=1-lower*centre;
      if(v.y<Math.min(p('LeftLeg').y,p('RightLeg').y)-.10*scale){if(/^Left(Leg|Foot|Toe)/.test(n))factor*=1-smooth(.01*scale,.09*scale,leftDistance-rightDistance);if(/^Right(Leg|Foot|Toe)/.test(n))factor*=1-smooth(.01*scale,.09*scale,rightDistance-leftDistance);}
      weights.push(w*factor);
    }
    let sum=weights.reduce((a,b)=>a+b,0);
    if(sum<1e-8){skinIndex.setComponent(i,0,names.indexOf('Hips'));weights.fill(0);weights[0]=1;sum=1;}
    let delta=0;for(let k=0;k<4;k++){const w=weights[k]/sum;delta=Math.max(delta,Math.abs(w-original[k]));skinWeight.setComponent(i,k,w);}if(delta>1e-6)changedVertices++;maxWeightChange=Math.max(maxWeightChange,delta);
  }
  const after=worldVertices(rig);let restVertexDrift=0;for(let i=0;i<before.length;i+=3)restVertexDrift=Math.max(restVertexDrift,Math.hypot(before[i]-after[i],before[i+1]-after[i+1],before[i+2]-after[i+2]));
  if(restVertexDrift>1e-5)throw Error('Anatomical weight mask moved original rest geometry');
  return {method:config.clothWrap?'Actual measured lower-wrap cloth: predominantly Hips plus its own thigh, cubic smooth region borders/centre-side transition; torso anchored to Spine02 with smooth blending; continuous four influences; original rest geometry invariant':'Smooth measured waist/torso attenuation of inappropriate arm influences; actual shin distance limits opposite lower-limb leakage; original rest geometry invariant',sourceBodySHA256:rig.sha256,width,yLow,yHigh,config,changedVertices,maxWeightChange,restVertexDrift};
}

// Only reviewed failures enter this path. The keeper helpers stay byte-frozen;
// no packed-skin audit threshold changes. Clavicles branch from Spine, not Hips.
function reviewedCalibration(sources, guide) {
  if (!guide.calibrationReview) return compileCalibration(sources, guide);
  const rig = sources.body, review = guide.calibrationReview;
  validateCalibration(guide, sources);
  for (const role of ['walk', 'run']) assertNativeContract(rig, sources[role]);
  const frame = canonicalFrame(worldVertices(rig), guide, guide.height), worlds = canonicalWorlds(rig, frame);
  const p = n => new THREE.Vector3().setFromMatrixPosition(worlds.get(n));
  const names = rig.mesh.skeleton.bones.map(o => rig.objectNames.get(o));
  if (names.length !== 24 || MESHY_NPC_JOINTS.some(n => !names.includes(n))) throw Error('Reviewed body must retain actual Meshy 24-joint contract');
  if (p('headfront').sub(p('Head')).z < guide.height * .05) throw Error('Actual head-front marker contradicts +Z');
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    for (const end of ['Arm', 'UpLeg']) if ((p(side + end).x - p('Hips').x) * sign < .01) throw Error(`Reviewed side disagrees with ${side + end}`);
    if (rig.objectNames.get(rig.names.get(side + 'Shoulder').parent) !== 'Spine' || (p(side + 'Shoulder').x - p('Spine').x) * sign <= 0 || (p(side + 'Arm').x - p(side + 'Shoulder').x) * sign < .01) throw Error(`Clavicle branch/side disagrees with ${side}`);
  }
  if (p('LeftShoulder').x - p('RightShoulder').x < .01) throw Error('Clavicle pair is reversed or collapsed');
  let fit;
  if (review.handMinimumWeight) {
    // Same geometric PCA ambiguity gates as the frozen fitter. Exclude the
    // measured wrist/sleeve contamination by a stricter source-weight mask.
    const rotations = {}, hands = {}, measured = {}, sourceQ = {};
    for (const side of ['left', 'right']) {
      const name = guide.semantics[side].hand;
      measured[side] = measureHand(rig, name, { palmReference: guide.idleDirections[side].sourcePalm, minimumWeight: review.handMinimumWeight });
      sourceQ[side] = rig.names.get(name).getWorldQuaternion(new THREE.Quaternion());
    }
    const sourceDirections = new THREE.Matrix3().getNormalMatrix(frame.matrix.clone().invert());
    const direction = a => new THREE.Vector3(...a).applyMatrix3(sourceDirections).normalize();
    const rotateWorld = (bone, q) => { bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(q.normalize())).normalize(); rotations[rig.objectNames.get(bone)] = bone.quaternion.toArray(); rig.gltf.scene.updateMatrixWorld(true); };
    const palmFrame = (f, n) => { f = f.clone().normalize(); n = n.clone().addScaledVector(f, -n.dot(f)).normalize(); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f, n).normalize(), f, n)); };
    for (const side of ['left', 'right']) {
      const s = guide.semantics[side], d = guide.idleDirections[side];
      for (const [boneName, childName, wanted] of [[s.upperArm, s.forearm, d.upper], [s.forearm, s.hand, d.forearm]]) {
        const bone = rig.names.get(boneName), vector = new THREE.Vector3().setFromMatrixPosition(rig.names.get(childName).matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)).normalize();
        rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(vector, direction(wanted)).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
      }
      const m = measured[side], delta = palmFrame(direction(d.forearm), direction(d.palm)).multiply(palmFrame(new THREE.Vector3(...m.fingersWorld), new THREE.Vector3(...m.palmWorld)).invert());
      rotateWorld(rig.names.get(s.hand), delta.multiply(sourceQ[side])); hands[side] = m;
    }
    restoreRest(rig); fit = { rotations, hands, method: `Independent actual hand PCA with source weight >= ${review.handMinimumWeight}; unchanged plane/sign ambiguity gates and shortest-vector anatomical fitting` };
  } else fit = fitRelaxedIdle(rig, frame, guide);
  const rotations = { ...fit.rotations }, kneeReview = [];
  if (review.neutralKnees) {
    for (const [name, q] of Object.entries(rotations)) rig.names.get(name).quaternion.fromArray(q).normalize();
    rig.gltf.scene.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const s = guide.semantics[side], thigh = rig.names.get(s.thigh), shin = rig.names.get(s.shin), foot = rig.names.get(s.foot);
      const at = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), hip = at(thigh), knee = at(shin), ankle = at(foot), before = kneeMetrics(hip, knee, ankle, new THREE.Vector3(0, 0, 1));
      if (!before.backward) continue;
      const chord = ankle.clone().sub(hip).normalize(), plane = new THREE.Vector3(0, 0, 1).addScaledVector(chord, -chord.z).normalize(), wantedKnee = knee.clone().addScaledVector(plane, -2 * knee.clone().sub(hip).dot(plane));
      const footQ = foot.getWorldQuaternion(new THREE.Quaternion());
      const rotate = (o, q) => { o.quaternion.copy(o.parent.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(q.normalize())).normalize(); rotations[rig.objectNames.get(o)] = o.quaternion.toArray(); rig.gltf.scene.updateMatrixWorld(true); };
      rotate(thigh, new THREE.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(), wantedKnee.clone().sub(hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion())));
      rotate(shin, new THREE.Quaternion().setFromUnitVectors(at(foot).sub(at(shin)).normalize(), ankle.clone().sub(at(shin)).normalize()).multiply(shin.getWorldQuaternion(new THREE.Quaternion())));
      rotate(foot, footQ);
      const after = kneeMetrics(at(thigh), at(shin), at(foot), new THREE.Vector3(0, 0, 1)), ankleDrift = at(foot).distanceTo(ankle);
      if (after.backward || ankleDrift > 1e-5) throw Error('Measured neutral knee correction failed ankle/forward invariants');
      kneeReview.push({ side, before, after, ankleDrift });
    }
    restoreRest(rig);
  }
  const profile = { ...guide, idleRotations: rotations };
  const markerEvidence = Object.fromEntries(['Hips', 'Spine', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'Head', 'headfront'].map(n => [n, p(n).toArray()]));
  return { profile, adapter: { ...adapterContract(rig, frame, profile, fit.hands), fitMethod: fit.method, calibrationReview: { ...review, markerEvidence, kneeReview } } };
}

async function pinKeeper() {
  const file = path.join(OUTPUT_ROOT, 'warp_keeper/freeze-receipt.json'), freeze = JSON.parse(await readFile(file, 'utf8'));
  for (const item of Object.values(freeze.outputs)) if (sha256(await readFile(item.path)) !== item.sha256) throw Error(`Frozen keeper receipt changed: ${item.path}`);
  for (const [relative, hash] of Object.entries(freeze.helpers)) if (sha256(await readFile(path.join(REPO, relative))) !== hash) throw Error(`Frozen pipeline changed: ${relative}`);
  return freeze.outputs.candidate.sha256;
}

export function measuredGuide(family, sources) {
  const body = sources.body, report = inspectRig(body), height = family === 'monk_novice' ? 1.2 : 1.72;
  const profile = { schema: 1, sources: Object.fromEntries(Object.entries(sources).map(([role, rig]) => [role, rig.sha256])), height, up: [0, 1, 0], forward: [0, 0, 1], footOrigin: [0, report.bounds.min[1], 0], semantics, idleRotations: {}, clips: Object.fromEntries(['walk', 'run'].map(role => { if (sources[role].gltf.animations.length !== 1) throw Error(`Ambiguous native ${role} clips`); return [role, sources[role].gltf.animations[0].name]; })) };
  const frame = canonicalFrame(worldVertices(body), profile, height), worlds = canonicalWorlds(body, frame), position = name => new THREE.Vector3().setFromMatrixPosition(worlds.get(name));
  const hip = position('Hips'), spineLow = position('Spine02'), spineTop = position('Spine'), hipSpan = Math.abs(position('LeftUpLeg').x - position('RightUpLeg').x), scale = height / 1.72;
  // These are measured torso-only seeds, away from welcoming sleeve geometry.
  // Subsequent diffusion follows welded surface adjacency, including borders.
  const hipHalfWidth = hipSpan * 0.94, torsoHalfWidth = hipSpan * 0.80, depth = 0.35 * scale;
  profile.weightRepair = { iterations: 512, anchor: 0.01, exclude: [], protectRigid: [{ bone: 'LeftHand', minimumDistance: 0.10 * scale }, { bone: 'RightHand', minimumDistance: 0.10 * scale }, 'Head'], regions: [
    { min: [hip.x - hipHalfWidth, hip.y - 0.075 * scale, -depth], max: [hip.x + hipHalfWidth, hip.y + 0.085 * scale, depth], bind: 'Hips' },
    { min: [spineLow.x - torsoHalfWidth, spineLow.y, -depth], max: [spineLow.x + torsoHalfWidth, spineTop.y - 0.04 * scale, depth], bind: 'Spine02' },
  ] };
  const palm = family === 'master_muay' ? [0, 0, 1] : [0, 1, 0];
  profile.idleDirections = { left: { upper: [0.32, -1, 0.04], forearm: [0.06, -1, 0.14], palm: [-1, 0, 0], sourcePalm: palm }, right: { upper: [-0.32, -1, 0.04], forearm: [-0.06, -1, 0.14], palm: [1, 0, 0], sourcePalm: palm } };
  const nodes = body.mesh.skeleton.bones.map(o => body.objectNames.get(o));
  profile.nativeGains = { walk: Object.fromEntries(nodes.map(n => [n, armNodes.has(n) ? 0.35 : legNodes.has(n) ? 0.25 : 0.30])), run: Object.fromEntries(nodes.map(n => [n, armNodes.has(n) ? 0.20 : 0.14])) };
  profile.nativeFirstFrameRelative = true; profile.nativeRelativeBones = null; profile.kneeForwardOnly = true; profile.floorClearance = true;
  if (family === 'master_muay') profile.textureOverride = muayTexture;
  return { profile, measured: { sourceBounds: report.bounds, canonicalScale: frame.scale, canonicalHip: hip.toArray(), canonicalSpineLow: spineLow.toArray(), canonicalSpineTop: spineTop.toArray(), hipSpan, bodyVertices: report.vertices, bodyTriangles: report.triangles, sourcePalmReference: palm } };
}

export async function runBatch(options) {
  if (!options.sourceRoot) throw Error('--source-root requires the actual Meshy project directory');
  const sourceRoot = path.resolve(REPO, options.sourceRoot), jobsFile = path.resolve(REPO, options.jobs ?? 'artifacts/city-npc-models/jobs.json'), selected = options.families ? options.families.split(',') : Object.keys(GENERATIONS);
  if (selected.some(f => !Object.hasOwn(GENERATIONS, f)) || new Set(selected).size !== selected.length) throw Error('Select only the remaining sixteen approved families; keeper is frozen');
  const keeperSHA = await pinKeeper(), output = await candidateDirectory(OUTPUT_ROOT), manifestFile = options.receipt ? path.resolve(REPO,options.receipt) : path.join(output, 'batch-qa.json');
  if(!manifestFile.startsWith(output+path.sep))throw Error('Batch receipt must stay in ignored NPC artifacts');
  await candidateDirectory(path.dirname(manifestFile));
  let manifest; try { manifest = JSON.parse(await readFile(manifestFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; manifest = { schema: 1, families: {} }; }
  manifest.keeperSHA256 = keeperSHA; manifest.pipelinePolicy = 'Frozen helpers; per-body axes/markers, surface PCA, torso bounds and native hashes';
  const save = async () => { manifest.updatedAt = new Date().toISOString(); await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n'); };
  for (const family of selected) {
    const generation = GENERATIONS[family], stem = family + (generation === 2 ? '-v2' : ''), files = { body: path.join(sourceRoot, `${stem}-rigged.glb`), walk: path.join(sourceRoot, `${stem}-walking.glb`), run: path.join(sourceRoot, `${stem}-running.glb`) };
    let phase = 'inputs';
    try {
      const jobs = JSON.parse(await readFile(jobsFile, 'utf8')), job = jobs.families?.[family];
      if (!job || (job.generation ?? 1) !== generation || job.rigging?.status !== 'SUCCEEDED') throw Error('Selected generation is not a succeeded rig in current jobs.json');
      await Promise.all(Object.values(files).map(file => access(file)));
      let normalization = null, rawInputs = null, sourceWeightRepair = null;
      const earlyGuideFile = path.join(OUTPUT_ROOT,family,`${family}-guide.json`);
      let earlyGuide;try{earlyGuide=JSON.parse(await readFile(earlyGuideFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      if(earlyGuide?.normalizationReceipt){
        const pin=earlyGuide.normalizationReceipt,bytes=await readFile(pin.path);if(sha256(bytes)!==pin.sha256)throw Error('Input normalization receipt changed');
        normalization=JSON.parse(bytes);if(!normalization.passed)throw Error('Input normalization proof failed');rawInputs={...files};
        for(const role of ['body','walk','run']){const record=normalization.records[role];if(path.resolve(record.input)!==path.resolve(files[role])||sha256(await readFile(files[role]))!==record.rawSHA256)throw Error(`Normalized ${role} raw provenance mismatch`);if(!path.resolve(record.output).startsWith(OUTPUT_ROOT+path.sep)||sha256(await readFile(record.output))!==record.normalizedSHA256)throw Error(`Normalized ${role} candidate/hash mismatch`);files[role]=record.output;}
      }
      if(earlyGuide?.sourceWeightReceipt){
        const pin=earlyGuide.sourceWeightReceipt,bytes=await readFile(pin.path);
        if(sha256(bytes)!==pin.sha256)throw Error('Source weight receipt changed');
        sourceWeightRepair=JSON.parse(bytes);
        if(!sourceWeightRepair.passed||sourceWeightRepair.restSkinDrift>1e-5||sourceWeightRepair.matchError>1e-5||!sourceWeightRepair.geometryUVIndexNormalTextureAndRigBuffersUnchanged)throw Error('Source garment repair lacks shape/provenance proof');
        if(path.resolve(sourceWeightRepair.input)!==path.resolve(files.body)||sha256(await readFile(files.body))!==sourceWeightRepair.inputSHA256)throw Error('Source garment repair original body mismatch');
        if(!path.resolve(sourceWeightRepair.output).startsWith(OUTPUT_ROOT+path.sep)||sha256(await readFile(sourceWeightRepair.output))!==sourceWeightRepair.outputSHA256)throw Error('Source garment repair body/hash mismatch');
        if(sha256(await readFile(sourceWeightRepair.precondition))!==sourceWeightRepair.preconditionSHA256)throw Error('Source garment precondition changed');
        files.body=sourceWeightRepair.output;
      }
      const sources = {}; for (const [role, file] of Object.entries(files)) sources[role] = await loadRig(file);
      for (const role of ['walk', 'run']) assertNativeContract(sources.body, sources[role]);
      const other = Object.entries(manifest.families).find(([f, result]) => f !== family && result.sources?.body === sources.body.sha256);
      if (other) throw Error(`Body reused by ${other[0]}`);
      const previous = manifest.families[family];
      let guideMatches = false;
      if(previous?.status==='passed') {
        const currentGuide=JSON.parse(await readFile(previous.guide,'utf8')),stored=JSON.parse(await readFile(previous.calibration,'utf8'));
        delete currentGuide.idleRotations;delete stored.idleRotations;guideMatches=JSON.stringify(currentGuide)===JSON.stringify(stored);
      }
      if (previous?.status === 'passed' && guideMatches && Object.entries(sources).every(([role, rig]) => previous.sources[role] === rig.sha256) && sha256(await readFile(previous.candidate)) === previous.sha256 && sha256(await readFile(previous.calibration)) === previous.calibrationSHA256 && sha256(await readFile(previous.adapter)) === previous.adapterSHA256) { console.log(JSON.stringify({ family, status: 'passed', cached: true, sha256: previous.sha256 })); continue; }
      phase = 'calibration';
      const directory = await candidateDirectory(path.join(OUTPUT_ROOT, family)), guideFile = path.join(directory, `${family}-guide.json`), calibration = path.join(directory, `${family}-calibration.json`), adapterFile = path.join(directory, `${family}-adapter.json`);
      const measured = measuredGuide(family, sources); let guide = measured.profile;
      // Explicit per-family ignored overrides allow corrections without editing
      // frozen core code. Reuse only if all actual input hashes still match.
      try { const existing = JSON.parse(await readFile(guideFile, 'utf8')); if (Object.entries(sources).every(([role, rig]) => existing.sources?.[role] === rig.sha256)) guide = existing; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      validateCalibration(guide, sources);
      let compiled;
      if(sourceWeightRepair){
        // The same body's actual original hand surface defines palm axes. A
        // garment correction must not change the PCA mask used for calibration.
        const originalBody=await loadRig(sourceWeightRepair.input);
        assertNativeContract(originalBody,sources.body);
        const fit=reviewedCalibration({...sources,body:originalBody},{...guide,sources:{...guide.sources,body:originalBody.sha256}});
        const profile={...guide,idleRotations:fit.profile.idleRotations},frame=canonicalFrame(worldVertices(sources.body),profile,profile.height);
        compiled={profile,adapter:{...adapterContract(sources.body,frame,profile,fit.adapter.hands),fitMethod:fit.adapter.fitMethod,inputWeightRepair:{receipt:guide.sourceWeightReceipt,originalBodySHA256:originalBody.sha256,repairedBodySHA256:sources.body.sha256,calibrationBasis:'Same original body hand surface and unchanged rest rig; no cross-family pose transfer'}}};
      }else compiled = reviewedCalibration(sources, guide);
      if(normalization)compiled.adapter.inputNormalization={receipt:guide.normalizationReceipt,rawHashes:Object.fromEntries(Object.entries(normalization.records).map(([role,r])=>[role,r.rawSHA256])),normalizedHashes:guide.sources};
      await writeFile(guideFile, JSON.stringify(guide, null, 2) + '\n');
      await writeFile(calibration, JSON.stringify(compiled.profile, null, 2) + '\n');
      await writeFile(adapterFile, JSON.stringify(compiled.adapter, null, 2) + '\n');
      await writeFile(path.join(directory, `${family}-inspection.json`), JSON.stringify({ family, generation, sources: guide.sources, inputPaths: files, measured: measured.measured, rigTaskId: job.rigging.taskId, nativeContracts: { walk: true, run: true } }, null, 2) + '\n');
      phase = 'packing-and-skin-qa';
      const prepareOptions = { family, ...files, calibration, out: directory, deps: options.deps };
      const result = guide.nativeScaleNoiseMax || guide.anatomicalWeightMask ? await prepareScaleReviewed(prepareOptions, sources) : await prepareInputs(prepareOptions);
      if(sourceWeightRepair){
        if(sha256(await readFile(sourceWeightRepair.input))!==sourceWeightRepair.inputSHA256)throw Error('Original garment body changed during build');
        const report=JSON.parse(await readFile(result.report,'utf8'));
        report.inputWeightRepair={receipt:guide.sourceWeightReceipt,originalBody:sourceWeightRepair.input,originalBodySHA256:sourceWeightRepair.inputSHA256,repairedBodySHA256:sourceWeightRepair.outputSHA256,restSkinDrift:sourceWeightRepair.restSkinDrift,method:sourceWeightRepair.method,patches:sourceWeightRepair.patches};
        await writeFile(result.report,JSON.stringify(report,null,2)+'\n');
      }
      manifest.families[family] = { generation, rigTaskId: job.rigging.taskId, status: result.passed ? 'passed' : 'failed', sources: guide.sources, inputPaths: files, candidate: result.candidate, sha256: result.sha256, bytes: result.bytes, triangles: result.triangles, report: result.report, guide: guideFile, calibration, calibrationSHA256: sha256(await readFile(calibration)), adapter: adapterFile, adapterSHA256: sha256(await readFile(adapterFile)), failures: result.failures, clips: result.clips.map(c => ({ name: c.name, samples: c.samples, edgeViolations: c.edgeViolations, maxEdgeRatio: c.maxEdgeRatio, maxSegmentDrift: c.maxSegmentDrift, backwardKneeSamples: c.backwardKneeSamples, minFloor: c.minFloor })) };
      if(normalization){for(const [role,file]of Object.entries(rawInputs))if(sha256(await readFile(file))!==normalization.records[role].rawSHA256)throw Error('Raw normalized input changed during build');manifest.families[family].inputNormalization={receipt:guide.normalizationReceipt,rawInputs,rawHashes:Object.fromEntries(Object.entries(normalization.records).map(([role,r])=>[role,r.rawSHA256]))};}
      if(sourceWeightRepair)manifest.families[family].inputWeightRepair={receipt:guide.sourceWeightReceipt,originalBody:sourceWeightRepair.input,originalBodySHA256:sourceWeightRepair.inputSHA256,repairedBodySHA256:sourceWeightRepair.outputSHA256};
      await save();
      console.log(JSON.stringify({ family, status: manifest.families[family].status, bytes: result.bytes, triangles: result.triangles, sha256: result.sha256, failures: result.failures, edgeViolations: result.clips.map(c => c.edgeViolations) }));
    } catch (error) {
      manifest.families[family] = { generation, status: error.code === 'ENOENT' ? 'waiting-inputs' : 'blocked', phase, inputPaths: files, error: error.message }; await save(); console.log(JSON.stringify({ family, ...manifest.families[family] }));
    }
  }
  await pinKeeper();
  const totals = Object.values(manifest.families).reduce((sum, f) => { sum[f.status] = (sum[f.status] ?? 0) + 1; return sum; }, {});
  console.log(JSON.stringify({ manifest: manifestFile, totals, keeperSHA256: keeperSHA })); return { manifest, totals };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {}, args = process.argv.slice(2), mapping = { 'source-root': 'sourceRoot', jobs: 'jobs', families: 'families', deps: 'deps', receipt: 'receipt' };
    for (let i = 0; i < args.length; i += 2) { const name = mapping[args[i]?.slice(2)]; if (!args[i]?.startsWith('--') || !name || !args[i + 1] || options[name]) throw Error('Usage: batch-prepare.mjs --source-root DIR [--jobs JSON --families COMMA_LIST --deps EXISTING_PROJECT]'); options[name] = args[i + 1]; }
    const result = await runBatch(options); if (result.totals.failed || result.totals.blocked || result.totals['waiting-inputs']) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
