import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ITEMS } from '../src/character/data/items.js';

const args = process.argv.slice(2);
const partial = args.includes('--partial'), runtime = args.includes('--runtime');
const value = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
const sharpModule = value('--sharp');
if (!sharpModule) throw Error('Supply the offline Sharp module with --sharp MODULE_PATH');
const sharp = createRequire(import.meta.url)(sharpModule);
const alphaRange = async file => {
  const alpha = await sharp(file).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  let min = 255, max = 0;
  for (const value of alpha) { if (value < min) min = value; if (value > max) max = value; }
  return { min, max };
};
const base = 'docs/art/items/painted-complete-v1';
const backlog = JSON.parse(readFileSync(`${base}/backlog.json`));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const seen = new Set(), distinctNewHashes = new Set(), missing = [], reviewed = [];
let outputBytes = 0, newMasters = 0, reusableMasters = 0;
for (const group of backlog.groups) {
  for (const id of group.memberIDs) {
    if (seen.has(id) || !ITEMS[id] || ITEMS[id].retired) throw Error(`Invalid or duplicate active group member: ${id}`);
    seen.add(id);
  }
  let image = group.approvedImage;
  if (group.status === 'new-generation') {
    const file = `${base}/provenance/${group.representativeID}.json`;
    if (!existsSync(file)) { missing.push(group.representativeID); continue; }
    const receipt = JSON.parse(readFileSync(file));
    if (receipt.jobID !== group.representativeID || receipt.family !== group.family || JSON.stringify(receipt.memberIDs) !== JSON.stringify(group.memberIDs)) throw Error(`Receipt does not match its semantic group: ${file}`);
    if (receipt.method !== 'built-in image_gen' || !receipt.prompt?.trim()) throw Error(`Missing generation provenance: ${file}`);
    if (receipt.master !== `${base}/masters/${group.representativeID}.png` || receipt.output !== `public/ui/items/painted-complete-v1/${group.representativeID}.webp`) throw Error(`Unexpected asset location: ${file}`);
    if (hash(receipt.master) !== receipt.masterSha256 || receipt.masterSha256 !== receipt.originalSha256 || hash(receipt.output) !== receipt.sha256) throw Error(`Asset hash mismatch: ${file}`);
    if (distinctNewHashes.has(receipt.masterSha256)) throw Error(`Duplicated generated original: ${group.representativeID}`);
    distinctNewHashes.add(receipt.masterSha256);
    const masterMeta = await sharp(receipt.master).metadata();
    const masterAlpha = await alphaRange(receipt.master);
    if (!masterMeta.hasAlpha || masterAlpha.min !== 0 || masterAlpha.max < 250) throw Error(`Original transparency invalid: ${file}`);
    if (receipt.masterAlphaMin !== undefined && (receipt.masterAlphaMin !== masterAlpha.min || receipt.masterAlphaMax !== masterAlpha.max)) throw Error(`Original alpha receipt mismatch: ${file}`);
    const bytes = readFileSync(receipt.output).length;
    if (bytes !== receipt.bytes || bytes > 100_000) throw Error(`Icon exceeds transfer budget or receipt is stale: ${file}`);
    if (receipt.width !== 256 || receipt.height !== 256 || !receipt.hasAlpha || receipt.alphaMin !== 0 || receipt.alphaMax !== 255) throw Error(`Invalid export receipt: ${file}`);
    image = receipt.output.slice('public/'.length);
    newMasters++;
  } else if (group.status === 'reuse-approved') {
    reusableMasters++;
  } else throw Error(`Unknown backlog status: ${group.status}`);
  const publicPath = `public/${image}`;
  const meta = await sharp(publicPath).metadata();
  const alpha = await alphaRange(publicPath);
  if (meta.format !== 'webp' || meta.width !== 256 || meta.height !== 256 || !meta.hasAlpha || alpha.min !== 0 || alpha.max !== 255) throw Error(`Production graphics invalid: ${publicPath}`);
  if (runtime) for (const id of group.memberIDs) {
    if (ITEMS[id].img !== image || ITEMS[id].imageArt !== 'painted') throw Error(`Runtime art mapping mismatch: ${id}`);
  }
  outputBytes += readFileSync(publicPath).length;
  reviewed.push({ id: group.representativeID, image, members: group.memberIDs.length });
}
const active = Object.keys(ITEMS).filter(id => !ITEMS[id].retired);
if (active.length !== seen.size || active.some(id => !seen.has(id))) throw Error('Backlog coverage differs from active inventory definitions');
for (const excluded of backlog.retiredExcluded) {
  if (!ITEMS[excluded.id]?.retired || ITEMS[excluded.id].img !== excluded.img || ITEMS[excluded.id].imageArt === 'painted') throw Error(`Retired item art changed: ${excluded.id}`);
}
const baselineFile = value('--baseline');
if (baselineFile) {
  const baseline = JSON.parse(readFileSync(baselineFile));
  const canonical = input => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().filter(key => key !== 'img' && key !== 'imageArt').map(key => [key, canonical(input[key])]));
    return input;
  };
  if (JSON.stringify(canonical(baseline)) !== JSON.stringify(canonical(ITEMS))) throw Error('Gameplay definitions changed relative to the captured baseline');
}
if (!partial && missing.length) throw Error(`Incomplete library: ${missing.length} masters remain`);
const result = { activeIDs: active.length, newMasters, reusableMasters, missingMasters: missing.length, distinctOriginals: distinctNewHashes.size, outputBytes, runtimeChecked: runtime, gameplayBaselineChecked: Boolean(baselineFile), validated: reviewed };
const report = value('--report');
if (report) writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, validated: undefined }));
