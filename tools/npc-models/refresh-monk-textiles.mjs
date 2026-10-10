// Forward-only remeasurement after the validated monk weight correction.
// Historical source/QA receipts remain immutable.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './glb.mjs';
import { paintTextiles } from './thai-textiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const profileFile = path.join(root, 'docs/art/npcs/THAI_TEXTILE_PROFILES.json');
const oldBytes = await readFile(profileFile), document = JSON.parse(oldBytes);
const proof = JSON.parse(await readFile(path.join(root, 'artifacts/city-npc-models/garment-basis/monk-wai-v3-preflight/receipt.json')));
const snapshotDir = path.join(root, 'artifacts/city-npc-models/garment-basis/profile-snapshots', sha256(oldBytes));
await mkdir(snapshotDir, { recursive: true });
await writeFile(path.join(snapshotDir, 'THAI_TEXTILE_PROFILES.json'), oldBytes);
const outputs = [];
for (const measurement of proof.families) {
  const profile = document.profiles.find(p => p.family === measurement.family);
  if (!['monk_elder', 'monk_novice'].includes(profile?.family)) throw Error('Unexpected measured family');
  const source = path.join(root, profile.basis.source), sourceBytes = await readFile(source);
  const qaFile = path.join(root, 'artifacts/city-npc-models', profile.family, `${profile.family}-qa.json`);
  const qaBytes = await readFile(qaFile), qa = JSON.parse(qaBytes);
  if (sha256(sourceBytes) !== measurement.sourceSHA256 || sha256(qaBytes) !== measurement.qaSHA256
    || qa.sha256 !== measurement.sourceSHA256 || !qa.audit?.passed || qa.audit.failureCount !== 0) throw Error(`Unvalidated promoted body: ${profile.family}`);
  const frozen = path.join(root, 'artifacts/city-npc-models/garment-basis', `${profile.family}-${measurement.sourceSHA256}.glb`);
  await writeFile(frozen, sourceBytes);
  const previous = profile.basis;
  profile.revision = measurement.nextRevision;
  profile.basis = { ...previous, sourceSHA256: measurement.sourceSHA256, regions: measurement.regions,
    frozenSource: relative(frozen), remeasuredAt: proof.capturedAt,
    priorBasis: { sourceSHA256: previous.sourceSHA256, revision: 'woven-v2',
      fullProfileSnapshot: relative(path.join(snapshotDir, 'THAI_TEXTILE_PROFILES.json')), snapshotSHA256: sha256(oldBytes),
      selectedVertexCounts: previous.regions.map(r => r.selectedVertexCount) },
    fullGeometryFingerprints: measurement.completeArrayProof,
    matchingBodyQA: { path: relative(qaFile), reportSHA256: sha256(qaBytes), assetSHA256: qa.sha256,
      auditPassed: true, height: qa.frame?.height ?? qa.height },
    measurementReceipt: 'artifacts/city-npc-models/garment-basis/monk-wai-v3-preflight/receipt.json' };
  profile.previewStatus = 'remeasured_woven_v3_pending_render';
  outputs.push(await paintTextiles(frozen, profile));
}
await writeFile(profileFile, JSON.stringify(document, null, 2) + '\n');
console.log(JSON.stringify(outputs.map(r => ({ family: r.family, sha256: r.sha256, bytes: r.bytes, changedPixels: r.changedPixels }))));
