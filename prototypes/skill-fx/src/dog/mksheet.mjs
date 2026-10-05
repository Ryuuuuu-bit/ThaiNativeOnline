// dog sheets: 96×96 cells, rows S,SE,E,NE,N,NW,W,SW (west side mirrored), stray islands (<15% of the body) removed per frame
import fs from 'fs'; import { execSync } from 'child_process';
const ROWS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const SRC = { 'north-west': 'north-east', west: 'east', 'south-west': 'south-east' };
const USE = { idle: [0, 1, 2, 3, 4], run: [1, 2, 3, 4, 5, 6, 7, 8], bite: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
const files = [], spec = {};
for (const [anim, idx] of Object.entries(USE)) { spec[anim] = [];
  for (const r of ROWS) { const d = SRC[r] || r; spec[anim].push({ flip: !!SRC[r], f: idx.map(i => { files.push(`dog/${anim}/${d}/${i}.png`); return files.length - 1; }) }); } }
const js = `window.SPEC=${JSON.stringify(spec)};` + `
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
function clean(g, x0, y0, back) { const W = 96, d = g.getImageData(x0, y0, W, W), lab = new Int32Array(W * W).fill(-1), sz = [];
  if (back) for (let p = 0; p < W * W; p++) { const r = d.data[p * 4], gg = d.data[p * 4 + 1], b = d.data[p * 4 + 2]; if (Math.max(r, gg, b) - Math.min(r, gg, b) < 40 && Math.max(r, gg, b) > 110) d.data[p * 4 + 3] = 0; }
  for (let p = 0; p < W * W; p++) { if (lab[p] >= 0 || d.data[p * 4 + 3] < 20) continue; const st = [p]; lab[p] = sz.length; let n = 0;
    while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= W || ay >= W) continue; const m = ay * W + ax; if (lab[m] < 0 && d.data[m * 4 + 3] >= 20) { lab[m] = sz.length; st.push(m); } } }
    sz.push(n); }
  const mx = Math.max(0, ...sz); for (let p = 0; p < W * W; p++) if (lab[p] >= 0 && sz[lab[p]] < mx * .3) d.data[p * 4 + 3] = 0; g.putImageData(d, x0, y0); }
const OUT = {};
for (const [anim, rows] of Object.entries(SPEC)) {
  const cols = rows[0].f.length, c = document.createElement('canvas'); c.width = cols * 96; c.height = 8 * 96; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  for (let r = 0; r < 8; r++) for (let k = 0; k < cols; k++) { const im = await load(IMG['f' + rows[r].f[k]]); const x = k * 96, y = r * 96;
    g.save(); if (rows[r].flip) { g.translate(x + 96, y); g.scale(-1, 1); g.drawImage(im, 0, 0); } else g.drawImage(im, x, y); g.restore(); clean(g, x, y, r === 4); }
  OUT['dog/dog_' + anim + '.png'] = c.toDataURL();
}
window.OUT = OUT;`;
fs.writeFileSync('dog/mksheet_run.js', js);
execSync('node cdp_eval.mjs dog/mksheet_run.js', { stdio: 'inherit', env: { ...process.env, FILES: files.join(',') } });
