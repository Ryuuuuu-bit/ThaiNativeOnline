import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const [jobID, generatedSource, promptFile, sharpModule] = process.argv.slice(2);
const resumeVerified = process.argv.includes('--resume-verified');
if (!jobID || !generatedSource || !promptFile || !sharpModule) throw Error('Usage: node tools/export-painted-item-job.mjs JOB_ID GENERATED_PNG PROMPT_FILE SHARP_MODULE');
const require = createRequire(import.meta.url), sharp = require(sharpModule);
// stats() measures the input, not the transformed extractChannel pipeline.
const alphaRange = async file => {
  const alpha = await sharp(file).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  let min = 255, max = 0;
  for (const value of alpha) { if (value < min) min = value; if (value > max) max = value; }
  return { min, max };
};
const root = resolve('.');
const backlog = JSON.parse(readFileSync('docs/art/items/painted-complete-v1/backlog.json'));
const job = backlog.groups.find(group => group.representativeID === jobID && group.status === 'new-generation');
if (!job || !/^[a-z0-9_]+$/.test(jobID)) throw Error(`Unknown production job: ${jobID}`);
const master = `docs/art/items/painted-complete-v1/masters/${jobID}.png`;
const output = `public/ui/items/painted-complete-v1/${jobID}.webp`;
const receiptPath = `docs/art/items/painted-complete-v1/provenance/${jobID}.json`;
if (existsSync(receiptPath) || (!resumeVerified && (existsSync(master) || existsSync(output)))) throw Error(`Job already exported; preserve existing output: ${jobID}`);
if (resumeVerified && (!existsSync(master) || !existsSync(output))) throw Error(`Verified resume requires both preserved files: ${jobID}`);
const source = await sharp(generatedSource).metadata();
const alpha = await alphaRange(generatedSource);
// A maximum of254 is a valid nearly opaque original; do not alter its alpha.
if (!source.hasAlpha || alpha.min !== 0 || alpha.max < 250) throw Error(`Generated master lacks clear transparent artwork: ${jobID}`);
mkdirSync(dirname(master), { recursive: true }); mkdirSync(dirname(output), { recursive: true });
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
if (resumeVerified) {
  if (hash(master) !== hash(generatedSource)) throw Error(`Preserved master differs from generated original: ${jobID}`);
} else {
  copyFileSync(generatedSource, master);
  await sharp(master).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(output);
}
const metadata = await sharp(output).metadata();
const outputAlpha = await alphaRange(output);
const receipt = { schema: 1, jobID, family: job.family, memberIDs: job.memberIDs,
  name: job.name, type: job.type, levels: job.levels,
  method: 'built-in image_gen', generatedSource, prompt: readFileSync(promptFile, 'utf8'),
  master, masterSha256: hash(master), originalSha256: hash(generatedSource),
  masterAlphaMin: alpha.min, masterAlphaMax: alpha.max,
  output, sha256: hash(output), bytes: readFileSync(output).length,
  width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha,
  alphaMin: outputAlpha.min, alphaMax: outputAlpha.max,
  sharp: sharp.versions.sharp, processing: 'Original PNG copied unchanged; contain resize to256 and WebP export only.',
  status: 'exported-awaiting-art-review' };
if (receipt.masterSha256 !== receipt.originalSha256 || receipt.width !== 256 || receipt.height !== 256 || !receipt.hasAlpha || receipt.alphaMin !== 0 || receipt.alphaMax !== 255) throw Error(`Production export invalid: ${jobID}`);
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ jobID, bytes: receipt.bytes, master: resolve(root, master), output: resolve(root, output) }));
