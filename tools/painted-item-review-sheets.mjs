import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [sharpModule, destination = 'artifacts/item-assets-completion/review'] = process.argv.slice(2);
if (!sharpModule) throw Error('Usage: node tools/painted-item-review-sheets.mjs SHARP_MODULE [OUTPUT_DIRECTORY]');
const sharp = createRequire(import.meta.url)(sharpModule);
const manifest = JSON.parse(readFileSync('public/ui/items/painted-complete-v1/preview-manifest.json'));
mkdirSync(destination, { recursive: true });
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const index = [];
for (const type of ['equip', 'flask', 'use', 'material', 'card']) {
  const entries = manifest.items.filter(item => item.type === type);
  for (let offset = 0; offset < entries.length; offset += 30) {
    const group = entries.slice(offset, offset + 30), page = 1 + offset / 30;
    for (const [theme, background, foreground] of [['jade', '#10291f', '#f4dfad'], ['light', '#e9e1cb', '#28231b']]) {
      const layers = [], width = 1000, height = Math.ceil(group.length / 5) * 244;
      for (let i = 0; i < group.length; i++) {
        const item = group[i], left = (i % 5) * 200, top = Math.floor(i / 5) * 244;
        const source = `public${item.image}`;
        layers.push({ input: await sharp(source).resize(128, 128, { fit: 'contain' }).png().toBuffer(), left: left + 36, top: top + 8 });
        const labels = `<svg width="200" height="30"><text x="100" y="11" text-anchor="middle" font-size="9" fill="${foreground}">${esc(item.id)}</text><text x="100" y="24" text-anchor="middle" font-size="10" fill="${foreground}">Lv.${esc(item.levels.join('/'))} | ${item.memberIDs.length} IDs</text></svg>`;
        layers.push({ input: Buffer.from(labels), left, top: top + 142 });
        for (const [size, x] of [[32, 18], [48, 66], [64, 126]]) layers.push({ input: await sharp(source).resize(size, size).png().toBuffer(), left: left + x, top: top + 176 + Math.floor((64 - size) / 2) });
      }
      const output = `${destination}/${type}-${page}-${theme}.png`;
      await sharp({ create: { width, height, channels: 4, background } }).composite(layers).png().toFile(output);
      index.push({ output, type, page, theme, items: group.map(item => ({ id: item.id, image: item.image, members: item.memberIDs })) });
    }
  }
}
writeFileSync(`${destination}/index.json`, JSON.stringify({ summary: manifest.summary, sheets: index }, null, 2) + '\n');
console.log(JSON.stringify({ directory: resolve(destination), sheets: index.length, semanticMasters: manifest.items.length }));
