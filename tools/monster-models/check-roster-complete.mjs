// Release acceptance is intentionally separate from incremental tooling CI.
import { readFile } from 'node:fs/promises';
import { MONSTERS } from '../../src/combat/data/monsters.js';
import { MONSTER_MODELS } from '../../src/combat/MonsterModels.js';
import { validateProductionRoster, verifyAcceptedEvidence, verifyProductionBody } from './production-roster.mjs';

try {
  const manifest = JSON.parse(await readFile(new URL('./production-roster.json', import.meta.url), 'utf8'));
  const inventory = JSON.parse(await readFile(new URL('./roster-inventory.json', import.meta.url), 'utf8'));
  const counts = validateProductionRoster(manifest, inventory, Object.keys(MONSTERS), MONSTER_MODELS);
  for (const entry of manifest.baseline) await verifyProductionBody(entry);
  for (const entry of manifest.accepted) await verifyAcceptedEvidence(entry);
  const missing = Object.keys(MONSTERS).filter(id => !MONSTER_MODELS[id]);
  console.log(JSON.stringify({ complete: missing.length === 0 && counts.pending === 0, ...counts, registered: Object.keys(MONSTER_MODELS).length, missing }, null, 2));
  if (missing.length || counts.pending) process.exitCode = 1;
} catch (error) {
  console.error(`Roster release acceptance failed: ${error.message}`);
  process.exitCode = 1;
}
