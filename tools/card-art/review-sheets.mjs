// Technical contact-sheet assembly for paired inspection; no artwork editing.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require(process.env.TNO_SHARP_DIR || 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const spec = JSON.parse(await readFile(new URL('./spec.json', import.meta.url)));
const availableOnly = process.argv.includes('--available');
const entriesToReview = availableOnly ? spec.entries.filter(entry => existsSync(resolve(entry.image))) : spec.entries;
const output = resolve(availableOnly ? 'artifacts/card-art/current-pairs' : 'docs/art/card-compendium');
await mkdir(output, { recursive: true });
const receipts = [];
for (let start = 0; start < entriesToReview.length; start += 8) {
  const entries = entriesToReview.slice(start, start + 8), layers = [];
  for (const [index, entry] of entries.entries()) {
    const left = (index % 2) * 420, top = Math.floor(index / 2) * 230;
    const label = Buffer.from(`<svg width="420" height="38"><rect width="420" height="38" fill="#16382c"/><text x="12" y="25" fill="#eddfb5" font-size="16" font-family="Arial">${entry.id} : MODEL / CARD / ICON</text></svg>`);
    layers.push({ input: label, left, top });
    for (const [path, x, width, height] of [[entry.reference, 10, 136, 170], [entry.image, 154, 136, 170], [entry.icon, 312, 72, 90]]) {
      layers.push({ input: await sharp(resolve(path)).resize(width, height, { fit: 'contain' }).png().toBuffer(), left: left + x, top: top + 45 });
    }
  }
  const filename = `model-card-pairs-${Math.floor(start / 8) + 1}.jpg`;
  const bytes = await sharp({ create: { width: 840, height: Math.ceil(entries.length / 2) * 230, channels: 3, background: '#eee5d3' } }).composite(layers).jpeg({ quality: 92 }).toBuffer();
  await writeFile(resolve(output, filename), bytes);
  receipts.push({ file: filename, cards: entries.map(entry => entry.id), reference: 'actual production GLB capture', layout: 'MODEL / CARD / ICON' });
}
await writeFile(resolve(output, 'model-card-pairs.json'), JSON.stringify(receipts, null, 2) + '\n');
console.log(JSON.stringify(receipts));
