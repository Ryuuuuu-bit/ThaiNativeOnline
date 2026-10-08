// Packs the game's .glb models with gltfpack: quantised attributes + meshopt-compressed buffers
// (about a third of the plain size; textures are left as they are — tools/models/shrink-glb-
// textures.py handles those). Node names, extras and animations are kept, so the loaders
// (src/core/gltf.js sets the meshopt decoder) and bone lookups work as before.
//
//   node tools/models/pack-glb.mjs                     # every .glb under public/models (in place)
//   node tools/models/pack-glb.mjs public/models/warrior.glb [...]
//
// Needs gltfpack: npx -y gltfpack (the npm package is a wasm build), or a native gltfpack on PATH.
// A file that is already meshopt-compressed is skipped.
import { readdirSync, readFileSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.glb') ? [join(dir, e.name)] : []));
const files = args.length ? args.map(a => resolve(a)) : walk(join(ROOT, 'public', 'models'));

const packed = file => { const b = readFileSync(file); const n = b.readUInt32LE(12); return b.subarray(20, 20 + n).includes('EXT_meshopt_compression'); };
const run = (cmd, a) => spawnSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
const gltfpack = a => { const r = run('gltfpack', a); return r.error ? run('npx', ['-y', 'gltfpack', ...a]) : r; };

let before = 0, after = 0;
for (const file of files) {
  if (packed(file)) { console.log(`${file}: already packed`); continue; }
  const tmp = `${file}.pack`;
  const r = gltfpack(['-i', file, '-o', tmp, '-cc', '-kn', '-ke']);
  if (r.status !== 0) { console.log(`${file}: FAILED\n${r.stderr}`); try { unlinkSync(tmp); } catch { /* none */ } continue; }
  const a = statSync(file).size, b = statSync(tmp).size; before += a; after += b;
  renameSync(tmp, file);
  console.log(`${file}: ${(a / 1e6).toFixed(2)} → ${(b / 1e6).toFixed(2)} MB`);
}
if (before) console.log(`total ${(before / 1e6).toFixed(1)} → ${(after / 1e6).toFixed(1)} MB`);
