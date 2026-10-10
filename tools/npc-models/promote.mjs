// Publish bundled contracts only after the parent records all seventeen reviews.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sha256 } from './glb.mjs';
import { NPC_MODELS, registerNPCModelProfiles } from '../../src/npc/NPCModels.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJSON = async file => JSON.parse(await readFile(path.resolve(root, file), 'utf8'));
const acceptance = await readJSON(process.argv[2] ?? 'docs/art/npcs/RELEASE_ACCEPTANCE.json');
const candidates = await readJSON('artifacts/city-npc-models/candidate-profiles.json');
assert.equal(acceptance.schema, 1); assert.equal(acceptance.families.length, 17);
assert.equal(new Set(acceptance.families.map(f => f.family)).size, 17);
const approved = [];
for (const review of acceptance.families) {
  assert.ok(NPC_MODELS[review.family]);
  assert.equal(review.approved, true); assert.deepEqual(review.unresolvedIssues, []);
  for (const dimension of ['style', 'readability', 'technicalUsability']) assert.ok(review.art[dimension] >= 8, `${review.family}: ${dimension} below gate`);
  const p = candidates.families.find(c => c.family === review.family);
  assert.ok(p); assert.equal(p.assetSha256, review.assetSha256);
  assert.equal(sha256(await readFile(path.join(root, 'public/models/npcs', `${p.family}.glb`))), p.assetSha256);
  const body = await readJSON(`artifacts/city-npc-models/${p.family}/${p.family}-qa.json`);
  assert.equal(body.audit.passed, true); assert.equal(body.audit.failureCount, 0);
  assert.equal(body.sha256, p.geometryAssetSha256);
  const receipt = await readJSON(review.runtimeReport);
  assert.equal(receipt.passed, true); assert.equal(receipt.mode, 'registry'); assert.equal(receipt.family, p.family);
  assert.ok(receipt.images.length > 0);
  assert.ok(receipt.assets.some(a => a.sha256 === p.assetSha256), `${p.family}: rendered HTTP bytes not pinned`);
  for (const image of receipt.images) {
    assert.equal(sha256(await readFile(image.path)), image.sha256, `${p.family}: changed screenshot`);
    assert.ok(image.receipt.npcs.length > 0, `${p.family}: empty registered witness`);
    for (const npc of image.receipt.npcs) {
      assert.equal(npc.status?.active, true); assert.equal(npc.model?.finite, true);
      assert.deepEqual(npc.duplicateBodyParts, []);
      assert.equal(npc.poseWitness?.sourceSha256, p.assetSha256);
    }
  }
  assert.ok(receipt.images.some(i => i.receipt.pose === 'idle' && i.receipt.view === 'threequarter'));
  const { calibration: c } = p;
  approved.push({ schema: 1, family: p.family, revision: p.revision, assetSha256: p.assetSha256, geometryAssetSha256: p.geometryAssetSha256, qaApproved: true,
    calibration: { schema: 1, coordinates: { up: '+Y', front: '+Z', height: c.coordinates.height, footOrigin: c.coordinates.footOrigin },
      nodes: Object.fromEntries(Object.entries(c.nodes).map(([name, n]) => [name, { parent: n.parent, idleWorld: n.idleWorld, idleLocal: { rotation: n.idleLocal.rotation }, bindLocal: { rotation: n.bindLocal.rotation } }])), hands: c.hands },
    ...(p.normalization ? { normalization: p.normalization } : {}), handScale: p.handScale, grips: p.grips, sockets: p.sockets, bakedAccessories: p.bakedAccessories,
    stowedTools: p.stowedTools === true, suppressedAccessories: p.suppressedAccessories ?? [],
    ...(p.roleMotion ? {roleMotion:p.roleMotion} : {}), ...(p.activityPoses ? {activityPoses:p.activityPoses} : {}) });
}
assert.equal(approved.length, Object.keys(NPC_MODELS).length);
const unregister = registerNPCModelProfiles({ schema: 1, families: approved }); unregister();
const out = path.join(root, 'src/npc/model-profiles'); await mkdir(out, { recursive: true });
for (const p of approved) await writeFile(path.join(out, `${p.family}.json`), JSON.stringify(p, null, 2) + '\n');
console.log(JSON.stringify({ approved: approved.length, identities: 34, acceptance: 'Recorded Art and actual registered runtime reviews; no automatic visual approval' }));
