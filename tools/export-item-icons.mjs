import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { PAINTED_ITEM_IDS } from '../src/character/data/painted-item-icons.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const option = process.argv.indexOf('--sharp-module');
let sharp;
if (option >= 0) {
  let modulePath = path.resolve(process.argv[option + 1]);
  if ((await stat(modulePath)).isDirectory()) {
    const pkg = JSON.parse(await readFile(path.join(modulePath, 'package.json'), 'utf8'));
    modulePath = path.join(modulePath, pkg.main);
  }
  sharp = (await import(pathToFileURL(modulePath).href)).default;
} else {
  sharp = (await import('sharp')).default;
}
const manifest = JSON.parse(await readFile(path.join(root, 'docs/art/items/imagegen-sample-v2/manifest.json'), 'utf8'));
const sources = new Map(manifest.items.map(item => [item.id, item]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const outputDir = path.join(root, 'public/ui/items/painted-v2');
await mkdir(outputDir, { recursive: true });
const items = [];
for (const id of PAINTED_ITEM_IDS) {
  const source = sources.get(id)?.file;
  if (!source) throw new Error(`Missing approved source: ${id}`);
  const original = await readFile(path.join(root, source));
  const metadata = await sharp(original).metadata();
  if (!metadata.hasAlpha) throw new Error(`Source has no alpha: ${id}`);
  const bytes = await sharp(original).resize(256, 256, {
    fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3',
  }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  const exported = await sharp(bytes).metadata();
  const stats = await sharp(bytes).stats();
  const alpha = stats.channels[exported.channels - 1];
  if (!exported.hasAlpha || alpha.min !== 0 || alpha.max !== 255) throw new Error(`Invalid export alpha: ${id}`);
  const output = `public/ui/items/painted-v2/${id}.webp`;
  await writeFile(path.join(root, output), bytes);
  items.push({ id, source, sourceSha256: sha(original), sourceWidth: metadata.width,
    sourceHeight: metadata.height, output, sha256: sha(bytes), bytes: bytes.length,
    width: exported.width, height: exported.height, hasAlpha: exported.hasAlpha,
    alphaMin: alpha.min, alphaMax: alpha.max });
}
const receipt = { version: 1, sourceManifest: 'docs/art/items/imagegen-sample-v2/manifest.json',
  sharpVersion: sharp.versions.sharp,
  export: { format: 'webp', width: 256, height: 256, quality: 90, alphaQuality: 100, effort: 6, fit: 'contain', kernel: 'lanczos3' },
  totalBytes: items.reduce((sum, item) => sum + item.bytes, 0), items };
await writeFile(path.join(root, 'docs/art/items/imagegen-sample-v2/production-manifest.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Exported ${items.length} painted icons, ${receipt.totalBytes} bytes; PNG masters unchanged.`);
