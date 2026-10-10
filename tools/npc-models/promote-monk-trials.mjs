// Preparation-root promotion only. No catalog, public asset or original raw writes.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './glb.mjs';
import { loadRig } from './rig.mjs';
import { REPO, candidateDirectory, packingDependencies } from './prepare.mjs';
import { previewRig } from './preview.mjs';

const root = path.join(REPO, 'artifacts/city-npc-models');
const json = async file => JSON.parse(await readFile(file, 'utf8'));

async function exclusivePinnedCopy(bytes, file) {
  try { await writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; if (sha256(await readFile(file)) !== sha256(bytes)) throw Error('Immutable snapshot already exists with different bytes: ' + file); }
}

export async function promoteMonkTrials({ trial = path.join(root, 'monk-wai-trials/trial-7') } = {}) {
  const handoff = await json(path.join(trial, 'handoff.json'));
  if (handoff.status !== 'MONK2_NUMERIC_PASS_HANDOFF_UNPUBLISHED' || handoff.results.length !== 2) throw Error('Exact passing monk handoff required');
  const catalog = path.join(root, 'candidate-profiles.json'), catalogPin = sha256(await readFile(catalog));
  const otherBodies = handoff.unchangedCanonical17.filter(r => !['monk_elder', 'monk_novice'].includes(r.family));
  for (const r of otherBodies) if (sha256(await readFile(path.join(root, r.family, r.family + '.glb'))) !== r.sha256) throw Error('Other15 body pin changed: ' + r.family);
  const receiptDirectory = await candidateDirectory(path.join(root, 'monk-root-promotion', handoff.sourceTrialSHA256));
  const results = [];
  for (const result of handoff.results) {
    const family = result.family;
    if (!['monk_elder', 'monk_novice'].includes(family) || result.status !== 'FROZEN_MONK_NATIVE_RUNTIME_WAI_NUMERIC_PASS' || result.runtime.edgeViolations !== 0 || result.staticWai.violations !== 0 || result.native.some(c => c.edgeViolations !== 0)) throw Error('Monk candidate is not independently validated');
    const dir = path.join(root, family), oldFreeze = await json(path.join(dir, 'freeze-receipt.json'));
    for (const [role, input] of Object.entries(oldFreeze.inputPaths)) if (sha256(await readFile(input)) !== oldFreeze.sources[role]) throw Error('Original Meshy input changed: ' + input);
    for (const r of Object.values(result.outputs)) if (sha256(await readFile(r.path)) !== r.sha256) throw Error('Trial output pin changed: ' + r.path);
    const stage = path.dirname(result.candidate.path), oldCandidateSHA256 = sha256(await readFile(path.join(dir, family + '.glb')));
    const snapshot = await candidateDirectory(path.join(root, 'prior-hash-snapshots', family, oldCandidateSHA256));
    const saved = [];
    // Every current root file is retained, including its old receipts, guide
    // history, diagnostics and precloth skin. A content-addressed snapshot can
    // be verified/reused but never overwritten with different content.
    for (const entry of await readdir(dir, { withFileTypes: true })) if (entry.isFile()) {
      const source = path.join(dir, entry.name), bytes = await readFile(source), destination = path.join(snapshot, entry.name);
      await exclusivePinnedCopy(bytes, destination); saved.push({ source, snapshot: destination, sha256: sha256(bytes), bytes: bytes.length });
    }
    const snapshotRecord = { schema: 1, family, previousCanonicalSHA256: oldCandidateSHA256, files: saved };
    await exclusivePinnedCopy(Buffer.from(JSON.stringify(snapshotRecord, null, 2) + '\n'), path.join(snapshot, 'snapshot-manifest.json'));
    const replacements = new Map([
      [family + '.glb', result.candidate.path], [family + '-unpacked.glb', path.join(stage, family + '-unpacked.glb')],
      [family + '-qa.json', result.outputs.qa.path], [family + '-calibration.json', result.outputs.calibration.path], [family + '-adapter.json', result.outputs.adapter.path],
    ]);
    const deps = packingDependencies(), rig = await loadRig(result.candidate.path);
    for (const [name, clip] of [['diagnostic-idle.png', 'idle'], ['diagnostic-run.png', 'run']]) if (saved.some(r => path.basename(r.source) === name)) {
      const file = path.join(receiptDirectory, family + '-' + name), animation = rig.gltf.animations.find(c => c.name === clip);
      await previewRig(rig, deps.sharp, file, { clip, time: animation.duration / 2, yaw: .6 }); replacements.set(name, file);
    }
    const outputs = {};
    for (const [name, source] of replacements) {
      const destination = path.join(dir, name), prior = saved.find(r => r.source === destination);
      if (!prior || sha256(await readFile(destination)) !== prior.sha256) throw Error('Preparation root changed during promotion: ' + destination);
      const bytes = await readFile(source); await writeFile(destination, bytes);
      if (sha256(await readFile(destination)) !== sha256(bytes)) throw Error('Promoted root copy failed hash check');
      outputs[name] = { path: destination, sha256: sha256(bytes), bytes: bytes.length, validatedTrialSource: source };
    }
    // Files outside the whitelist (including old freeze/guide/history files)
    // remain exact. The new preparation pins live in this promotion receipt;
    // parent owns reconciling registries/catalogs after textile/contact work.
    for (const old of saved) if (!replacements.has(path.basename(old.source)) && sha256(await readFile(old.source)) !== old.sha256) throw Error('Non-promoted root file changed');
    const record = { outputs: { ...result.outputs,
      candidate: outputs[family + '.glb'], unpacked: outputs[family + '-unpacked.glb'], qa: outputs[family + '-qa.json'],
      calibration: outputs[family + '-calibration.json'], adapter: outputs[family + '-adapter.json'],
    } };
    results.push({ family, status: 'PREPARATION_ROOT_PROMOTED_NUMERIC_PASS_ART_PENDING', snapshot, outputs, record,
      originalRawSources: { hashes: oldFreeze.sources, paths: oldFreeze.inputPaths },
      rawWeightDerivative: result.rawWeightDerivative,
      sourceRepairLineage: { guide: result.outputs.guide, correctionReceipt: result.outputs.sourceReceipt, validatedTrial: stage },
      validation: { native: result.native, runtime: result.runtime, staticWai: result.staticWai },
      retainedLegacyRootFreezeAndGuide: true,
    });
  }
  if (sha256(await readFile(catalog)) !== catalogPin) throw Error('Catalog changed during root promotion');
  for (const r of otherBodies) if (sha256(await readFile(path.join(root, r.family, r.family + '.glb'))) !== r.sha256) throw Error('Other15 body changed during promotion');
  const receipt = { schema: 1, status: 'MONK2_PREPARATION_ROOT_PROMOTION_COMPLETE', results, catalogSHA256Unchanged: catalogPin,
    notes: ['Use record.outputs as the new preparation pins; legacy root freeze/guide files intentionally remain in the restricted whitelist policy.', 'No original raw, public asset, catalog, staging/profile or other15 family writes.', 'Parent regenerates final textile/contact/profile receipts, reconciles freeze registries, enables wai, and obtains new Art captures.'] };
  const file = path.join(receiptDirectory, 'promotion-receipt.json'); await writeFile(file, JSON.stringify(receipt, null, 2) + '\n');
  return { file, sha256: sha256(await readFile(file)), results: results.map(r => ({ family: r.family, candidate: r.outputs[r.family + '.glb'], snapshot: r.snapshot })) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await promoteMonkTrials())); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}
