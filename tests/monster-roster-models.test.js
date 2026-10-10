import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { MONSTER_MODELS } from '../src/combat/MonsterModels.js';
import { validateProductionRoster, verifyAcceptedEvidence } from '../tools/monster-models/production-roster.mjs';

const inventory = JSON.parse(await readFile(new URL('../tools/monster-models/roster-inventory.json', import.meta.url), 'utf8'));
const production = JSON.parse(await readFile(new URL('../tools/monster-models/production-roster.json', import.meta.url), 'utf8'));

test('previously approved bodies and their placement remain unchanged', async () => {
  for (const baseline of inventory.approvedBaseline) {
    assert.deepEqual(MONSTER_MODELS[baseline.id], baseline.spec, `${baseline.id} approved placement`);
    const bytes = await readFile(new URL(`../public${baseline.url}`, import.meta.url));
    assert.equal(bytes.length, baseline.bytes, `${baseline.id} approved size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), baseline.sha256, `${baseline.id} approved body`);
  }
});

test('production manifest accounts for the complete roster without admitting pending candidates', async () => {
  validateProductionRoster(production, inventory, Object.keys(MONSTERS), MONSTER_MODELS);
  for (const entry of production.accepted) await verifyAcceptedEvidence(entry);
  for (const [id, spec] of Object.entries(MONSTER_MODELS)) {
    assert.equal(spec.url, `/models/monsters/${id}.glb`, `${id} must not alias another body`);
    assert.ok(Number.isFinite(spec.height) && spec.height > 0, `${id} has a positive display height`);
    for (const key of ['lift', 'facing']) if (spec[key] !== undefined) assert.ok(Number.isFinite(spec[key]), `${id}.${key}`);
    if (spec.groundPivot) assert.ok(spec.groundPivot.length === 2 && spec.groundPivot.every(Number.isFinite), `${id}.groundPivot`);
  }
});

test('production admission rejects missing, overlapping and unapproved roster entries', () => {
  const validate = manifest => validateProductionRoster(manifest, inventory, Object.keys(MONSTERS), MONSTER_MODELS);
  const missing = structuredClone(production); missing.pending.pop();
  assert.throws(() => validate(missing), /every gameplay monster/);
  const overlap = structuredClone(production); overlap.pending.push(overlap.baseline[0]);
  assert.throws(() => validate(overlap), /overlap/);
  const admitted = structuredClone(production), candidate = admitted.pending.shift();
  admitted.accepted.push(candidate);
  assert.throws(() => validate(admitted), /Runtime registry/);
  Object.assign(candidate, { url: `/models/monsters/${candidate.id}.glb`, bytes: 100, sha256: 'a'.repeat(64) });
  candidate.spec = { url: candidate.url, height: 1.9 };
  assert.throws(() => validateProductionRoster(admitted, inventory, Object.keys(MONSTERS), { ...MONSTER_MODELS, [candidate.id]: candidate.spec }), /art local evidence required/);
  const modified = structuredClone(production); modified.baseline[0].sha256 = '0'.repeat(64);
  assert.throws(() => validate(modified), /immutable/);
});

test('accepted evidence is tied to the actual GLB and rejects insufficient art scores or changed reports', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tno-roster-gate-'));
  try {
    const entry = structuredClone(inventory.approvedBaseline[0]); entry.approval = {};
    const destination = path.join(directory, 'public', entry.url);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(new URL(`../public${entry.url}`, import.meta.url)));
    async function evidence(gate, report) {
      const bytes = Buffer.from(JSON.stringify(report));
      await writeFile(path.join(directory, `${gate}.json`), bytes);
      entry.approval[gate] = { path: `${gate}.json`, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    const approved = { artifactSha256: entry.sha256, approved: true, passed: true };
    await evidence('art', { ...approved, scores: { styleMatch: 8, readability: 8, technicalUsability: 8 } });
    await evidence('technical', approved); await evidence('qa', approved);
    const repoURL = pathToFileURL(directory + path.sep);
    await verifyAcceptedEvidence(entry, repoURL);
    await evidence('art', { ...approved, scores: { styleMatch: 7.9, readability: 8, technicalUsability: 8 } });
    await assert.rejects(verifyAcceptedEvidence(entry, repoURL), /styleMatch must meet/);
    await evidence('art', { ...approved, artifactSha256: '0'.repeat(64), scores: { styleMatch: 8, readability: 8, technicalUsability: 8 } });
    await assert.rejects(verifyAcceptedEvidence(entry, repoURL), /this exact body/);
    entry.approval.art.sha256 = '0'.repeat(64);
    await assert.rejects(verifyAcceptedEvidence(entry, repoURL), /evidence SHA256/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('registered bodies are distinct self-contained GLBs with the gameplay clip contract', async () => {
  const hashes = new Map();
  for (const [id, spec] of Object.entries(MONSTER_MODELS)) {
    const bytes = await readFile(new URL(`../public${spec.url}`, import.meta.url));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${id} GLB magic`);
    assert.equal(bytes.readUInt32LE(4), 2, `${id} GLB version`);
    assert.equal(bytes.readUInt32LE(8), bytes.length, `${id} GLB byte length`);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${id} JSON chunk`);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    assert.deepEqual(json.animations?.map(a => a.name).sort(), ['attack', 'die', 'hurt', 'idle', 'walk'], `${id} clips`);
    assert.ok(json.meshes?.length && json.skins?.length, `${id} has a rigged body`);
    assert.ok(json.buffers?.every(b => !b.uri), `${id} buffers must ship inside the GLB`);
    assert.ok((json.images ?? []).every(image => image.bufferView !== undefined || image.uri?.startsWith('data:')), `${id} textures must be embedded`);
    for (const animation of json.animations) {
      assert.ok(animation.channels?.length > 0, `${id}.${animation.name} is animated`);
      for (const channel of animation.channels) {
        assert.ok(json.nodes[channel.target.node], `${id}.${animation.name} targets an existing node`);
        assert.ok(animation.samplers[channel.sampler], `${id}.${animation.name} references an existing sampler`);
      }
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(hash), `${id} must not duplicate ${hashes.get(hash)}'s entire body file`);
    hashes.set(hash, id);
  }
});
