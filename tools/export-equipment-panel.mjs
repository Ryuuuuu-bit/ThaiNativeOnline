import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const modulePath = process.argv[2] || 'sharp';
const sharp = require(modulePath);
const source = 'docs/art/ui/equipment-reference/panel-master-v1.png';
const output = 'public/ui/equipment/reference-panel-v1.webp';
await sharp(source).webp({ quality: 92, effort: 6 }).toFile(output);
const metadata = await sharp(output).metadata();
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const receipt = { source, output, width: metadata.width, height: metadata.height,
  bytes: readFileSync(output).length, sourceSha256: hash(source), sha256: hash(output),
  sharp: sharp.versions.sharp, encoding: { quality: 92, effort: 6 } };
writeFileSync('docs/art/ui/equipment-reference/production-manifest.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
