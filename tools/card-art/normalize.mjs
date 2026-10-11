// Technical packaging only: keep the generated composition intact, resize and
// encode WebP. Artwork is created by the built-in imagegen tool from model refs.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const sharp = require(process.env.TNO_SHARP_DIR || 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const spec = JSON.parse(await readFile(new URL('./spec.json', import.meta.url), 'utf8'));
const refs = JSON.parse(await readFile(resolve('artifacts/card-model-references/manifest.json'), 'utf8'));
const jobs = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(resolve('public/ui/card-art'), { recursive: true });
await mkdir(resolve('tools/card-art/receipts'), { recursive: true });
for (const job of Array.isArray(jobs) ? jobs : jobs.entries) {
  const entry = spec.entries.find(entry => entry.id === job.id), reference = refs.entries.find(entry => entry.id === job.id);
  if (!entry || !reference || !job.source) throw Error(`Missing known specification/reference/source: ${job.id}`);
  if (reference.origin !== 'production-glb') throw Error(`User scope excludes procedural fallback art: ${job.id}`);
  const raw = await readFile(job.source), info = await sharp(raw).metadata();
  if (!info.width || !info.height || info.width < 384 || info.height < 480) throw Error(`Small or invalid generation: ${job.id}`);
  const image = await sharp(raw).rotate().resize(spec.width, spec.height, { fit: 'contain', background: '#f0e5c9' }).webp({ quality: 85, effort: 5 }).toBuffer();
  const icon = await sharp(image).resize(spec.iconWidth, spec.iconHeight, { fit: 'contain' }).webp({ quality: 85, effort: 5 }).toBuffer();
  await writeFile(resolve(entry.image), image); await writeFile(resolve(entry.icon), icon);
  const receipt = { schema: 1, id: job.id, provider: 'built-in-imagegen', prompt: job.prompt ?? entry.prompt,
    sourceFile: basename(job.source), sourceSha256: sha(raw), reference: entry.reference, referenceSha256: reference.image.sha256,
    origin: reference.origin, modelSources: reference.sources.map(source => ({ kind: source.kind, url: source.url, sha256: source.localSha256 ?? null })),
    image: { path: entry.image, width: spec.width, height: spec.height, bytes: image.length, sha256: sha(image) },
    icon: { path: entry.icon, width: spec.iconWidth, height: spec.iconHeight, bytes: icon.length, sha256: sha(icon) },
    review: job.review ?? null };
  await writeFile(resolve('tools/card-art/receipts', `${job.id}.json`), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${job.id}: ${image.length}B portrait + ${icon.length}B icon`);
}
