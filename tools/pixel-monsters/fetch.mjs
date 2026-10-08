// Pixel monsters: pulls each monster's PixelLab download (rotations + animation frames) and packs
// one sprite sheet per monster for src/combat/MonsterSprites.js.
//
//   npm ci --prefix tools/pixel-monsters
//   node tools/pixel-monsters/fetch.mjs            # every type in manifest.json
//   node tools/pixel-monsters/fetch.mjs boar krasue
//   node tools/pixel-monsters/fetch.mjs --dump boar  # list the download's files (to map animation names)
//
// Output: public/sprites/monsters/<type>.png (a uniform grid, one row per animation × direction,
// the idle row from the rotations) and <type>.json:
//   { cell, cols, rows: [{ anim, dir, y, frames, fps }], source }
// Directions kept: south, south-east, east, north-east, north (the west side is mirrored at run time).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..', '..');
const OUT = resolve(ROOT, 'public', 'sprites', 'monsters');
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north'];
const FPS = { idle: 4, walk: 10, attack: 12, die: 10 };
const manifest = JSON.parse(readFileSync(resolve(HERE, 'manifest.json'), 'utf8'));
const args = process.argv.slice(2), dump = args.includes('--dump');
const types = args.filter(a => !a.startsWith('--'));
const todo = types.length ? types : Object.keys(manifest).filter(k => !k.startsWith('_'));

// ---- a small zip reader (stored / deflate entries; the central directory is not needed) ----
function unzip(buf) {
  const files = new Map(); let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const flags = buf.readUInt16LE(p + 6), method = buf.readUInt16LE(p + 8);
    let csize = buf.readUInt32LE(p + 18), usize = buf.readUInt32LE(p + 22);
    const nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    let data = p + 30 + nlen + xlen;
    if (flags & 8) {   // sizes in a data descriptor after the data: find the next header
      let q = data; while (q < buf.length && !(buf.readUInt32LE(q) === 0x08074b50 || buf.readUInt32LE(q) === 0x04034b50 || buf.readUInt32LE(q) === 0x02014b50)) q++;
      if (buf.readUInt32LE(q) === 0x08074b50) { csize = buf.readUInt32LE(q + 8); usize = buf.readUInt32LE(q + 12); } else csize = q - data;
    }
    const raw = buf.subarray(data, data + csize);
    if (!name.endsWith('/')) files.set(name, method === 8 ? inflateRawSync(raw) : raw);
    p = data + csize; if (flags & 8) { p += 16; if (buf.readUInt32LE(p - 16) !== 0x08074b50) p -= 4; }
  }
  if (!files.size) throw new Error('not a zip (is the download endpoint reachable?)');
  return files;
}
const fetchBuf = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); };
const png = buf => PNG.sync.read(buf);

// Frames of an animation: files like <State>/animations/<Name>[-<group>]/<dir>/frame_000.png. Names
// are matched loosely ("Walking-5fc1d7e2" is "walk", "Cross_Punch" is "cross-punch"): the manifest's
// aliases plus the usual PixelLab template names for each of ours.
// Object downloads name the folder after the animation's description ("cobra_lunges_forward_and_
// strikes"), so after the exact names the folder is searched for key words of each of our animations.
const ALIASES = {
  walk: ['walk', 'walking', 'run', 'running', 'fastwalk', 'fly', 'flying', 'slither', 'crawl'],
  attack: ['attack', 'crosspunch', 'leadjab', 'bark', 'bite', 'strike', 'highkick', 'headbutt', 'jumpattack'],
  die: ['die', 'dying', 'death', 'fallingbackdeath', 'goingtosleep', 'collapse', 'liedown'],
};
const WORDS = {
  die: ['dies', 'dead', 'death', 'collaps', 'topple', 'struck', 'ishit', 'limp', 'keelsover', 'goeslimp'],
  attack: ['attack', 'strike', 'lunge', 'snap', 'peck', 'bite', 'bites', 'chomp', 'swipe', 'slam', 'thrash', 'charge', 'rearsup'],
  walk: ['walk', 'slither', 'scuttl', 'crawl', 'swim', 'lumber', 'prowl', 'trot', 'moving', 'wriggl', 'inch', 'stalk'],
};
const norm = s => s.toLowerCase().replace(/-[0-9a-f]{6,}$/, '').replace(/[^a-z0-9]/g, '');
function framesOf(files, animNames, dir, ours) {
  const wants = [...new Set([...animNames, ...(ALIASES[ours] ?? [])].map(norm))];
  const groups = new Map();   // normalised animation folder name → frames of `dir`
  for (const n of files.keys()) {
    const m = n.match(/animations\/([^/]+)\/([^/]+)\/[^/]*?(\d+)\.png$/i); if (!m || m[2].toLowerCase() !== dir) continue;
    const key = norm(m[1]); (groups.get(key) ?? groups.set(key, []).get(key)).push([parseInt(m[3]), n]);
  }
  const pick = key => groups.get(key).sort((a, b) => a[0] - b[0]).map(([, n]) => png(files.get(n)));
  for (const want of wants) {
    const key = [...groups.keys()].find(k => k === want || k.startsWith(want));
    if (key) return pick(key);
  }
  // described folders: a folder belongs to the first of die / attack / walk whose words it contains
  const owner = key => ['die', 'attack', 'walk'].find(a => WORDS[a].some(w => key.includes(w)));
  const key = [...groups.keys()].find(k => owner(k) === ours);
  return key ? pick(key) : null;
}
function rotationOf(files, dir) {
  const n = [...files.keys()].find(n => /rotations?\//i.test(n) && new RegExp(`(^|/)${dir}\\.png$`, 'i').test(n));
  return n ? png(files.get(n)) : null;
}

async function build(type) {
  const spec = manifest[type]; if (!spec) throw new Error(`no manifest entry for ${type}`);
  const url = `https://api.pixellab.ai/mcp/${spec.kind === 'object' ? 'objects' : 'characters'}/${spec.id}/download`;
  process.stdout.write(`${type}: downloading… `);
  const files = unzip(await fetchBuf(url));
  if (dump) { console.log(`\n${[...files.keys()].join('\n')}`); return; }
  // rows: idle (the rotation, one frame) then each animation, per direction
  const rows = [];
  for (const dir of DIRS) { const r = rotationOf(files, dir); if (r) rows.push({ anim: 'idle', dir, frames: [r] }); }
  for (const [anim, names] of Object.entries(spec.anims)) for (const dir of DIRS) { const f = framesOf(files, names, dir, anim); if (f) rows.push({ anim, dir, frames: f }); }
  if (!rows.length) throw new Error('no frames found (try --dump)');
  const cell = Math.max(...rows.flatMap(r => r.frames.map(f => Math.max(f.width, f.height))));
  const cols = Math.max(...rows.map(r => r.frames.length));
  const sheet = new PNG({ width: cols * cell, height: rows.length * cell });
  rows.forEach((row, y) => row.frames.forEach((f, x) => {
    const ox = x * cell + ((cell - f.width) >> 1), oy = y * cell + (cell - f.height);   // feet on the cell's floor
    for (let j = 0; j < f.height; j++) for (let i = 0; i < f.width; i++) {
      const s = (j * f.width + i) * 4, d = ((oy + j) * sheet.width + ox + i) * 4;
      sheet.data[d] = f.data[s]; sheet.data[d + 1] = f.data[s + 1]; sheet.data[d + 2] = f.data[s + 2]; sheet.data[d + 3] = f.data[s + 3];
    }
  }));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, `${type}.png`), PNG.sync.write(sheet));
  const layout = { cell, cols, rows: rows.map((r, y) => ({ anim: r.anim, dir: r.dir, y, frames: r.frames.length, fps: FPS[r.anim] ?? 8 })), source: { kind: spec.kind, id: spec.id } };
  writeFileSync(resolve(OUT, `${type}.json`), JSON.stringify(layout));
  const anims = [...new Set(rows.map(r => r.anim))];
  console.log(`${rows.length} rows (${anims.join(', ')}), cell ${cell}px, ${sheet.width}×${sheet.height}`);
}

let failed = 0;
for (const type of todo) { try { await build(type); } catch (e) { failed++; console.log(`\n${type}: FAILED ${e.message}`); } }
if (!dump) console.log(`${todo.length - failed}/${todo.length} sheets written to public/sprites/monsters/`);
process.exit(failed ? 1 : 0);
