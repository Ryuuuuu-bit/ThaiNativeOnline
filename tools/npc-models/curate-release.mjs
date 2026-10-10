// Preserve research locally; publish a portable selection only after Art review.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sha256 } from './glb.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const input = process.argv[2];
assert.ok(input, 'Usage: curate-release.mjs parent-art-verdict.json');
const verdict = JSON.parse(await readFile(path.resolve(root, input)));
assert.equal(verdict.schema, 1);
assert.equal(verdict.families.length, 17);
assert.equal(new Set(verdict.families.map(f => f.family)).size, 17);
const acceptance = { schema: 1, reviewedAt: new Date().toISOString(),
  method: 'Recorded human/agent Art review, actual HTTP-byte-pinned runtime captures and dense skin audit. Curation grants no new approval.',
  families: [] };
const gallery = { schema: 1, entries: [] };
for (const review of verdict.families) {
  assert.equal(review.approved, true, `${review.family}: explicit Art acceptance required`);
  assert.deepEqual(review.unresolvedIssues, []);
  for (const key of ['style', 'readability', 'technicalUsability']) assert.ok(review.art[key] >= 8);
  const original = path.resolve(root, review.runtimeReport), bytes = await readFile(original), report = JSON.parse(bytes);
  assert.equal(sha256(bytes), review.runtimeReportSha256);
  assert.equal(report.passed, true); assert.equal(report.mode, 'registry'); assert.equal(report.family, review.family);
  const dir = path.join(root, 'docs/art/npcs/reviews/release', review.family); await mkdir(dir, { recursive: true });
  const selected = report.images.filter(i => review.imageIds.includes(i.id));
  assert.equal(selected.length, review.imageIds.length, 'Each selected witness must exist exactly once');
  assert.ok(selected.some(i => i.receipt.pose === 'idle' && i.receipt.view === 'threequarter'));
  const images = [];
  for (const i of selected) {
    const source = path.resolve(root, i.path), data = await readFile(source);
    assert.equal(sha256(data), i.sha256, 'Changed rendered PNG');
    for (const npc of i.receipt.npcs) {
      assert.equal(npc.status?.active, true); assert.equal(npc.model?.finite, true);
      assert.deepEqual(npc.duplicateBodyParts, []);
      assert.equal(npc.poseWitness?.sourceSha256, review.assetSha256);
    }
    const destination = path.join(dir, path.basename(source));
    await copyFile(source, destination); images.push({ ...i, path: relative(destination) });
  }
  const file = path.join(dir, 'report.json');
  const curated = { ...report, images, archive: { originalReport: relative(original), reportSha256: sha256(bytes),
    originalImageCount: report.images.length, portableImageCount: images.length,
    note: 'Full immutable research receipt and all original PNGs remain in the local ignored archive. Only the selected exact witnesses ship in Git.' } };
  await writeFile(file, JSON.stringify(curated, null, 2) + '\n');
  acceptance.families.push({ family: review.family, approved: true, art: review.art, unresolvedIssues: [],
    assetSha256: review.assetSha256, runtimeReport: relative(file),
    runtimeReportSha256: sha256(await readFile(file)), artEvidence: review.artEvidence, limitations: review.limitations ?? [] });
  const picture = images.find(i => i.receipt.pose === 'idle' && i.receipt.view === 'threequarter');
  gallery.entries.push({ family: review.family, approved: true, report: relative(file), imageId: picture.id,
    sha256: review.assetSha256, labelThai: review.labelThai, labelEnglish: review.family });
}
await writeFile(path.join(root, 'docs/art/npcs/RELEASE_ACCEPTANCE.json'), JSON.stringify(acceptance, null, 2) + '\n');
await writeFile(path.join(root, 'docs/art/npcs/reviews/release/approved-gallery.json'), JSON.stringify(gallery, null, 2) + '\n');
console.log(JSON.stringify({ curatedFamilies: acceptance.families.length, explicitArtApproval: true }));
