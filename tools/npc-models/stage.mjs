// Isolated browser-QA staging only. Importing never publishes files/profiles.
import { readFile, writeFile, mkdir, rename, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { THREE, decomposeRigid } from './rig.mjs';
import { sha256 } from './glb.mjs';
import { replaceColour } from './thai-textiles.mjs';
import { contactRolePlan } from './contacts.mjs';
import { NPC_MODELS, NPC_PROP_FRAMES } from '../../src/npc/NPCModels.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Verified baked exceptions already used by staging. Additional suppression
// only removes a retained part; it never adds an unmeasured accessory.
const BAKED = { warp_keeper: ['clothHat'], blacksmith: ['apron'], gate_supplier: ['ngob'], master_muay: ['mongkol'] };
const json = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));
const finite = (a, n) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
const fail = message => { throw Error(`Cannot stage NPC: ${message}`); };

/** Pure exact-byte validation. Candidate QA flags enable isolated inspection;
 * they are never written to production src/npc/model-profiles. */
export function createStagedNPCProfile({ family, revision, baseBytes, candidateBytes, textileReportBytes, qaBytes, adapterBytes, briefBytes, contactsBytes }) {
  if (!NPC_MODELS[family] || !/^[a-z0-9_-]+$/.test(revision ?? '')) fail('known family/textile revision required');
  const report = json(textileReportBytes), qa = json(qaBytes), calibration = json(adapterBytes), brief = json(briefBytes), contacts = json(contactsBytes);
  const baseSHA = sha256(baseBytes), candidateSHA = sha256(candidateBytes);
  if (report.sourceSHA256 !== baseSHA || report.sha256 !== candidateSHA || report.geometryRigAnimationUnchanged !== true
    || qa.family !== family || qa.sha256 !== baseSHA || qa.audit?.passed !== true || qa.audit.failureCount !== 0) fail('failed or mismatched geometry/textile/native QA');
  if (contacts.schema !== 1 || contacts.family !== family || contacts.status !== 'MEASURED_CONTACT_CANDIDATE_NOT_APPROVED'
    || contacts.geometryAssetSha256 !== baseSHA || ![baseSHA, candidateSHA].includes(contacts.assetSha256)
    || contacts.preparationAuditPassed !== true || contacts.checks?.numericContactPassed !== true
    || !Number.isFinite(contacts.checks.maxContactError) || contacts.checks.maxContactError > .00002
    || !Number.isFinite(contacts.checks.maxRestFrameError) || contacts.checks.maxRestFrameError > .002) fail('stale, failed or missing measured contacts');
  const expectedInputs = { body: contacts.assetSha256, adapter: sha256(adapterBytes), qa: sha256(qaBytes), brief: sha256(briefBytes) };
  if (contacts.assetSha256 !== baseSHA) expectedInputs.textileReport = sha256(textileReportBytes);
  for (const [key, expected] of Object.entries(expectedInputs)) if (contacts.inputHashes?.[key] !== expected) fail(`stale contact input ${key}`);
  for (const role of ['body', 'walk', 'run']) if (!qa.sources?.[role] || contacts.rawSourceHashes?.[role] !== qa.sources[role] || calibration.sourceHashes?.[role] !== qa.sources[role]) fail(`contact/source provenance ${role}`);
  const fields = contacts.profileFields;
  if (!fields || Object.keys(fields).some(k => !['handScale', 'grips', 'sockets', 'normalization', 'bakedAccessories'].includes(k))) fail('unexpected contact profile fields');
  if (!Number.isFinite(fields.handScale) || fields.handScale <= 0 || fields.handScale !== qa.frame?.scale) fail('handScale must equal exact preparation frame.scale');
  const n = fields.normalization;
  if (!n || n.sourceHeight !== calibration.coordinates?.height || n.sourceHeight !== NPC_MODELS[family].height || !finite(n.footOrigin, 3)
    || !finite(calibration.coordinates?.footOrigin, 3) || n.footOrigin.some((v, i) => v !== calibration.coordinates.footOrigin[i])
    || n.facingYaw !== 0 || calibration.coordinates.up !== '+Y' || calibration.coordinates.front !== '+Z') fail('measured canonical normalization required');
  if (!Array.isArray(fields.bakedAccessories) || fields.bakedAccessories.some(p => !NPC_PROP_FRAMES[p])) fail('invalid measured baked accessory list');
  const bakedAccessories = [...new Set([...fields.bakedAccessories, ...(BAKED[family] ?? [])])];
  const plan = contactRolePlan(family, brief, bakedAccessories);
  for (const frame of ['foreL', 'foreR']) {
    const grip = fields.grips?.[frame];
    if (!grip || !['contact', 'fingers', 'palm'].every(k => finite(grip[k], 3))) fail(`invalid ${frame} grip`);
    const fingers = new THREE.Vector3(...grip.fingers), palm = new THREE.Vector3(...grip.palm);
    if (Math.abs(fingers.length() - 1) > .01 || Math.abs(palm.length() - 1) > .01 || new THREE.Vector3().crossVectors(fingers, palm).length() < .6
      || grip.contact.some((v, i) => v !== plan.grips[frame].contact[i])) fail(`ambiguous/wrong legacy ${frame} grip`);
  }
  for (const [frame, socket] of Object.entries(fields.sockets ?? {})) {
    const expectedBone = { foreL: 'LeftHand', foreR: 'RightHand', head: 'Head', upper: 'Spine' }[frame];
    if (!expectedBone || socket?.bone !== expectedBone || !calibration.nodes?.[socket.bone] || !finite(socket.matrix, 16)
      || socket.matrix[3] !== 0 || socket.matrix[7] !== 0 || socket.matrix[11] !== 0 || socket.matrix[15] !== 1) fail(`invalid ${frame} socket`);
    const matrix = new THREE.Matrix4().fromArray(socket.matrix);
    if (matrix.determinant() <= 0) fail(`reflected/singular ${frame} socket`);
    decomposeRigid(matrix, `${family}/${frame} socket`);
  }
  // Explicit hand overrides are necessary after packing/weight repair.
  for (const frame of new Set(['foreL', 'foreR', ...plan.frames])) if (!fields.sockets?.[frame]) fail(`missing measured ${frame} socket`);
  return { schema: 1, family, revision, geometryAssetSha256: baseSHA, assetSha256: candidateSHA,
    qa: { art: true, runtime: true }, calibration,
    handScale: fields.handScale, grips: structuredClone(fields.grips), sockets: structuredClone(fields.sockets), normalization: structuredClone(n), bakedAccessories,
    inspectionOnly: true, productionApproved: false,
    inspectionProvenance: { sourceSHA256: baseSHA, candidateSHA256: candidateSHA, contactSHA256: sha256(contactsBytes), ...expectedInputs, textileReport: sha256(textileReportBytes),
      axisReviewRequired: contacts.checks.axisReviewRequired === true, contactVisualApproved: false,
      visualChecks: ['Held handle position and open source fingers', 'Weapon edge/shaft direction during idle/work/talk/walk/run', 'Headwear/pack/bowl fit and occlusion', 'No duplicate baked accessory or body'] } };
}

const atomicWrite = async (file, bytes) => {
  const temporary = `${file}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
};

export async function stageNPCFamily({ family, revision, contacts: contactFile, root = ROOT }) {
  if (!NPC_MODELS[family] || !/^[a-z0-9_-]+$/.test(revision ?? '')) fail('Usage: stage.mjs family textile-revision [--contacts artifacts/...json]');
  const directory = path.join(root, 'artifacts/city-npc-models', family), textile = path.join(root, 'artifacts/city-npc-models/textiles', family, revision);
  const paths = { baseBytes: path.join(directory, `${family}.glb`), candidateBytes: path.join(textile, `${family}.glb`), textileReportBytes: path.join(textile, 'report.json'),
    qaBytes: path.join(directory, `${family}-qa.json`), adapterBytes: path.join(directory, `${family}-adapter.json`), briefBytes: path.join(root, 'docs/art/npcs/NPC_MODEL_BRIEFS.json') };
  const inputs = {}; for (const [key, file] of Object.entries(paths)) inputs[key] = await readFile(file);
  paths.contactsBytes = contactFile ? path.resolve(root, contactFile) : path.join(root, 'artifacts/city-npc-models/contacts', `${family}-${sha256(inputs.baseBytes).slice(0, 12)}-contacts.json`);
  inputs.contactsBytes = await readFile(paths.contactsBytes);
  const profile = createStagedNPCProfile({ family, revision, ...inputs });
  const editable = replaceColour(await readFile(path.join(directory, `${family}-unpacked.glb`)), await readFile(path.join(textile, 'colour.jpg')));
  for (const [key, file] of Object.entries(paths)) if (sha256(await readFile(file)) !== sha256(inputs[key])) fail(`input changed while staging: ${key}`);
  const artifacts = path.join(root, 'artifacts/city-npc-models'), lock = path.join(artifacts, '.stage-lock');
  try { await mkdir(lock); } catch (error) { if (error.code === 'EEXIST') fail('another staging process is active; run family stages sequentially'); throw error; }
  try {
    const stagingFile = path.join(artifacts, 'candidate-profiles.json');
    let catalog;
    try { catalog = json(await readFile(stagingFile)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; catalog = { schema: 1, families: [] }; }
    if (catalog.schema !== 1 || !Array.isArray(catalog.families)) fail('invalid isolated candidate catalog');
    catalog.acceptance = 'ISOLATED QA CANDIDATES ONLY; flags enable inspection, not production or Art approval';
    catalog.families = catalog.families.filter(p => p.family !== family); catalog.families.push(profile);
    const publicDir = path.join(root, 'public/models/npcs'), authoringDir = path.join(root, 'tools/npc-models/source');
    await mkdir(publicDir, { recursive: true }); await mkdir(authoringDir, { recursive: true });
    // Asset bytes precede the catalog that can enable their new hash.
    await atomicWrite(path.join(publicDir, `${family}.glb`), inputs.candidateBytes);
    await atomicWrite(path.join(authoringDir, `${family}.glb`), editable.bytes);
    await atomicWrite(path.join(artifacts, 'candidate-profiles.js'), "import {registerNPCModelProfiles} from '/src/npc/NPCModels.js';\nconst response=await fetch('/artifacts/city-npc-models/candidate-profiles.json');\nif(!response.ok) throw Error('QA candidate catalog missing');\nregisterNPCModelProfiles(await response.json());\n");
    await atomicWrite(stagingFile, JSON.stringify(catalog, null, 2) + '\n');
    // Never write src/npc/model-profiles or obsolete public profiles.json.
    return { family, candidateSHA256: profile.assetSha256, sourceSHA256: profile.geometryAssetSha256, contactSHA256: profile.inspectionProvenance.contactSHA256,
      bytes: inputs.candidateBytes.length, editableBytes: editable.bytes.length, axisReviewRequired: profile.inspectionProvenance.axisReviewRequired, productionApproved: false };
  } finally { await rmdir(lock); }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) { console.log('Isolated staging: node tools/npc-models/stage.mjs family textile-revision [--contacts artifacts/...json]\nRequires current passed native QA and hash-pinned measured contacts. Does not write production model-profiles. Run stages sequentially.'); return; }
  const [family, revision, ...rest] = argv;
  if (rest.length && (rest.length !== 2 || rest[0] !== '--contacts')) fail('Usage: stage.mjs family textile-revision [--contacts artifacts/...json]');
  console.log(JSON.stringify(await stageNPCFamily({ family, revision, contacts: rest[1] })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
