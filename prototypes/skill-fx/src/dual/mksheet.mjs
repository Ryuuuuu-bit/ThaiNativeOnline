// builds dual/<anim>.png sheets (cols = frames, rows S,SE,E,NE,N,NW,W,SW; west side mirrored) in headless Edge via cdp_eval
import fs from 'fs'; import { execSync } from 'child_process';
const ROWS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const SRC = { 'north-west': 'north-east', west: 'east', 'south-west': 'south-east' };
const USE = { idle: [0, 1, 2, 3, 4], walk: [1, 2, 3, 4, 5, 6, 7, 8], slash: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
const files = [], spec = {};
for (const [anim, idx] of Object.entries(USE)) { spec[anim] = [];
  for (const r of ROWS) { const d = SRC[r] || r; spec[anim].push({ flip: !!SRC[r], f: idx.map(i => { files.push(`dual/${anim}/${d}/${i}.png`); return files.length - 1; }) }); } }
const js = `window.SPEC=${JSON.stringify(spec)};` + `
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const OUT = {};
for (const [anim, rows] of Object.entries(SPEC)) {
  const cols = rows[0].f.length, c = document.createElement('canvas'); c.width = cols * 128; c.height = 8 * 136; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let r = 0; r < 8; r++) for (let k = 0; k < cols; k++) { const im = await load(IMG['f' + rows[r].f[k]]); const x = k * 128, y = r * 136;
    g.save(); if (rows[r].flip) { g.translate(x + 128, y); g.scale(-1, 1); g.drawImage(im, 16, 35); } else g.drawImage(im, x + 16, y + 35); g.restore(); }
  OUT['dual/hero_' + anim + '.png'] = c.toDataURL();
}
window.OUT = OUT;`;
fs.writeFileSync('dual/mksheet_run.js', js);
execSync('node cdp_eval.mjs dual/mksheet_run.js', { stdio: 'inherit', env: { ...process.env, FILES: files.join(',') } });
