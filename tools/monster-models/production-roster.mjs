// Shared production admission gate. Pending source work is never runtime approval.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateProductionRoster(manifest, inventory, monsterIds, registry) {
  assert.equal(manifest.schema, 1);
  assert.deepEqual(manifest.baseline, inventory.approvedBaseline, 'Approved baseline must remain immutable');
  for (const key of ['baseline', 'accepted', 'pending']) assert.ok(Array.isArray(manifest[key]), `${key} partition required`);
  const all = [...manifest.baseline, ...manifest.accepted, ...manifest.pending].map(entry => entry.id);
  assert.equal(new Set(all).size, all.length, 'Roster partitions must not overlap or duplicate IDs');
  assert.deepEqual(all.sort(), [...monsterIds].sort(), 'Partitions must account for every gameplay monster');
  const production = [...manifest.baseline, ...manifest.accepted];
  assert.deepEqual(Object.keys(registry).sort(), production.map(entry => entry.id).sort(), 'Runtime registry must contain exactly baseline and accepted bodies');
  for (const entry of production) {
    assert.deepEqual(registry[entry.id], entry.spec, `${entry.id} production placement`);
    assert.equal(entry.url, `/models/monsters/${entry.id}.glb`);
    assert.equal(entry.spec.url, entry.url);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(entry.bytes) && entry.bytes > 0);
  }
  for (const entry of manifest.pending) assert.ok(entry.stage && entry.reason, `${entry.id} pending work must be explicit`);
  for (const entry of manifest.accepted) for (const gate of ['art', 'technical', 'qa']) {
    const evidence = entry.approval?.[gate];
    assert.ok(evidence?.path && !evidence.path.startsWith('/') && !evidence.path.includes('..') && !evidence.path.includes(':') && !evidence.path.includes('\\'), `${entry.id} ${gate} local evidence required`);
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  }
  return { baseline: manifest.baseline.length, accepted: manifest.accepted.length, pending: manifest.pending.length, total: all.length };
}

export async function verifyProductionBody(entry, repoURL = new URL('../../', import.meta.url)) {
  const body = await readFile(new URL(`./public${entry.url}`, repoURL));
  assert.equal(body.length, entry.bytes, `${entry.id} accepted bytes`);
  assert.equal(sha(body), entry.sha256, `${entry.id} accepted body SHA256`);
  assert.ok(body.length >= 20 && body.readUInt32LE(0) === 0x46546c67 && body.readUInt32LE(4) === 2 && body.readUInt32LE(8) === body.length && body.readUInt32LE(16) === 0x4e4f534a, `${entry.id} complete GLB 2`);
  const json = JSON.parse(body.subarray(20, 20 + body.readUInt32LE(12)).toString('utf8'));
  assert.deepEqual(json.animations?.map(animation => animation.name).sort(), ['attack', 'die', 'hurt', 'idle', 'walk'], `${entry.id} five gameplay clips required`);
  assert.ok(json.skins?.length && json.meshes?.length, `${entry.id} rigged body required`);
  assert.ok(json.buffers?.every(buffer => !buffer.uri), `${entry.id} embedded buffers required`);
}

export async function verifyAcceptedEvidence(entry, repoURL = new URL('../../', import.meta.url)) {
  await verifyProductionBody(entry, repoURL);
  for (const gate of ['art', 'technical', 'qa']) {
    const reference = entry.approval[gate], bytes = await readFile(new URL(reference.path, repoURL));
    assert.equal(sha(bytes), reference.sha256, `${entry.id} ${gate} evidence SHA256`);
    const evidence = JSON.parse(bytes);
    assert.equal(evidence.artifactSha256, entry.sha256, `${entry.id} ${gate} must review this exact body`);
    assert.equal(evidence.approved, true, `${entry.id} ${gate} approval`);
    if (gate === 'art') for (const category of ['styleMatch', 'readability', 'technicalUsability']) assert.ok(Number.isFinite(evidence.scores?.[category]) && evidence.scores[category] >= 8 && evidence.scores[category] <= 10, `${entry.id} art ${category} must meet 8/10`);
    else assert.equal(evidence.passed, true, `${entry.id} ${gate} must pass`);
  }
}
