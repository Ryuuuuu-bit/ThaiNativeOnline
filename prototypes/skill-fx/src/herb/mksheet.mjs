// builds dual/<anim>.png sheets (cols = frames, rows S,SE,E,NE,N,NW,W,SW; west side mirrored) in headless Edge via cdp_eval
import fs from 'fs'; import { execSync } from 'child_process';
const ROWS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const SRC = { 'north-west': 'north-east', west: 'east', 'south-west': 'south-east' };
const USE = { idle: [0, 1, 2, 3, 4], walk: [1, 2, 3, 4, 5, 6, 7, 8], cast: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
const files = [], spec = {};
for (const [anim, idx] of Object.entries(USE)) { spec[anim] = [];
  for (const r of ROWS) { const d = SRC[r] || r; spec[anim].push({ flip: !!SRC[r], f: idx.map(i => { files.push(`herb/${anim}/${d}/${i}.png`); return files.length - 1; }) }); } }
const js = `window.SPEC=${JSON.stringify(spec)};` + `
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const OUT = {};
for (const [anim, rows] of Object.entries(SPEC)) {
  const cols = rows[0].f.length, c = document.createElement('canvas'); c.width = cols * 128; c.height = 8 * 136; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  for (let r = 0; r < 8; r++) for (let k = 0; k < cols; k++) { const im = await load(IMG['f' + rows[r].f[k]]); const x = k * 128, y = r * 136;
    g.save(); if (rows[r].flip) { g.translate(x + 128, y); g.scale(-1, 1); g.drawImage(im, 16, 35); } else g.drawImage(im, x + 16, y + 35); g.restore(); }
  /* PixelLab painted cyan magic into the cast frames: shift cyan/blue hues to herb green */
  { const d = g.getImageData(0, 0, c.width, c.height), p = d.data; for (let i = 0; i < p.length; i += 4) { if (p[i + 3] < 10) continue; const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn; if (dd < .18 || mx < .3) continue; let h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; h *= 60; if (h < 0) h += 360;
    if (h > 170 && h < 235) { const v = mx, sat = dd / mx, nh = 118 / 60, f = nh - Math.floor(nh), q = v * (1 - sat * f), t2 = v * (1 - sat * (1 - f)), lo = v * (1 - sat); /* hue ≈118° lands in sector 1: (q, v, lo) */ p[i] = q * 255; p[i + 1] = v * 255; p[i + 2] = lo * 255; } } g.putImageData(d, 0, 0); }
  OUT['herb/hero_' + anim + '.png'] = c.toDataURL();
}
window.OUT = OUT;`;
fs.writeFileSync('herb/mksheet_run.js', js);
execSync('node cdp_eval.mjs herb/mksheet_run.js', { stdio: 'inherit', env: { ...process.env, FILES: files.join(',') } });
