const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
function hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
const PAL = [[144,128,88],[120,112,72],[104,96,64],[160,152,104],[80,64,56],[96,88,56],[136,120,80]];
const isPal = (r, g, b) => PAL.some(p => Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b) < 30);
const isLeaf = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 70 && h <= 170 && s > .25 && v > .18; };
const isDark = (r, g, b) => Math.max(r, g, b) < 70;
const isDarkGreen = (r, g, b) => Math.max(r, g, b) < 80 && g > r + 8 && g >= b;
function frame(d, W, x0, y0, fw, fh, dbg) {
  const I = (x, y) => ((y0 + y) * W + x0 + x) * 4; const N = fw * fh;
  const cl = new Uint8Array(N); // 1 body 2 pal 3 leaf 4 dark
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const i = I(x, y); if (d[i + 3] < 30) continue; const r = d[i], g = d[i + 1], b = d[i + 2];
    cl[y * fw + x] = isLeaf(r, g, b) || isDarkGreen(r, g, b) ? 3 : isPal(r, g, b) ? 2 : isDark(r, g, b) ? 4 : 1; }
  // anchor: the leaf bundle on the staff head (largest green cluster)
  let lx = 0, ly = 0, ln = 0; { const seen = new Uint8Array(N); let bestC = null;
    for (let p = 0; p < N; p++) { if (seen[p] || cl[p] !== 3) continue; const st = [p], px = []; seen[p] = 1;
      while (st.length) { const q = st.pop(); px.push(q); const x = q % fw, y = (q / fw) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= fw || ay >= fh) continue; const n = ay * fw + ax; if (!seen[n] && cl[n] === 3) { seen[n] = 1; st.push(n); } } }
      if (!bestC || px.length > bestC.length) bestC = px; }
    if (bestC && bestC.length >= 8) { bestC.forEach(q => { lx += q % fw; ly += (q / fw) | 0; }); ln = bestC.length; lx /= ln; ly /= ln; } }
  let best = { s: 0 };
  for (let a = -88; a <= 88; a += 2) { const th = a * Math.PI / 180, nx = Math.cos(th), ny = Math.sin(th); // normal
    const acc = new Map();
    for (let p = 0; p < N; p++) { if (cl[p] !== 2 && cl[p] !== 3) continue; const x = p % fw, y = (p / fw) | 0; const rho = Math.round(x * nx + y * ny); acc.set(rho, (acc.get(rho) || 0) + 1); }
    for (const [rho, c] of acc) { const s = c + (acc.get(rho - 1) || 0) * .5 + (acc.get(rho + 1) || 0) * .5; if (ln && Math.abs(lx * nx + ly * ny - rho) > 6) continue; if (s > best.s) best = { s, th, rho, nx, ny }; } }
  if (best.s < 30) { let n0 = 0; for (let p = 0; p < N; p++) if (cl[p] === 3) { const i = I(p % fw, (p / fw) | 0); if (dbg) { d[i] = 255; d[i+1] = 0; d[i+2] = 255; } else d[i + 3] = 0; n0++; } return n0; }
  const { nx, ny, rho } = best, tx = -ny, ty = nx; // direction along line
  const dist = (x, y) => Math.abs(x * nx + y * ny - rho), along = (x, y) => x * tx + y * ty;
  const ts = []; for (let p = 0; p < N; p++) { if (cl[p] !== 2 && cl[p] !== 3) continue; const x = p % fw, y = (p / fw) | 0; if (dist(x, y) <= 1.6) ts.push(along(x, y)); }
  ts.sort((a, b) => a - b); let runs = [], st = ts[0], pv = ts[0];
  for (const t of ts.slice(1)) { if (t - pv > 12) { runs.push([st, pv]); st = t; } pv = t; } runs.push([st, pv]);
  let [t0, t1] = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0]; if (t1 - t0 < 22) return 0; if (ln) { const tl = along(lx, ly); t0 = Math.min(t0, tl - 4); t1 = Math.max(t1, tl + 4); }
  const rm = new Uint8Array(N);
  for (let p = 0; p < N; p++) { const c = cl[p]; if (!c || c === 1) continue; const x = p % fw, y = (p / fw) | 0; const t = along(x, y), dd = dist(x, y);
    if (t < t0 - 3 || t > t1 + 3) { if (c === 3 && dd < 9 && t > t0 - 14 && t < t1 + 14) rm[p] = 1; continue; }
    if ((c === 2 || c === 3) && dd <= 2.3) rm[p] = 1; else if (c === 3 && dd < 9) rm[p] = 1; else if (c === 4 && dd <= 2.8) rm[p] = 3; }
  for (let p = 0; p < N; p++) if (cl[p] === 3) rm[p] = 1;
  // grow leaves connected to removed leaves
  for (let it = 0; it < 6; it++) for (let p = 0; p < N; p++) { if (rm[p] || cl[p] !== 3) continue; const x = p % fw, y = (p / fw) | 0;
    for (let k = 0; k < 8; k++) { const ax = x + [1,-1,0,0,1,1,-1,-1][k], ay = y + [0,0,1,-1,1,-1,1,-1][k]; if (ax >= 0 && ay >= 0 && ax < fw && ay < fh && rm[ay * fw + ax]) { rm[p] = 1; break; } } }
  // keep dark pixels that still outline the body
  for (let p = 0; p < N; p++) { if (rm[p] !== 3) continue; const x = p % fw, y = (p / fw) | 0; let body = 0;
    for (let k = 0; k < 8; k++) { const ax = x + [1,-1,0,0,1,1,-1,-1][k], ay = y + [0,0,1,-1,1,-1,1,-1][k]; if (ax < 0 || ay < 0 || ax >= fw || ay >= fh) continue; const q = ay * fw + ax; if (!rm[q] && cl[q] === 1) body++; }
    rm[p] = body >= 2 ? 0 : 1; }
  // dark leftovers floating next to removed staff
  for (let p = 0; p < N; p++) { if (rm[p] || cl[p] !== 4) continue; const x = p % fw, y = (p / fw) | 0; if (dist(x, y) > 4) continue; let keep = 0;
    for (let k = 0; k < 8; k++) { const ax = x + [1,-1,0,0,1,1,-1,-1][k], ay = y + [0,0,1,-1,1,-1,1,-1][k]; if (ax < 0 || ay < 0 || ax >= fw || ay >= fh) continue; const q = ay * fw + ax; if (!rm[q] && cl[q] && cl[q] !== 4) keep++; }
    if (!keep) rm[p] = 1; }
  let n = 0; const orig = d.slice ? null : null;
  const holes = [];
  for (let p = 0; p < N; p++) if (rm[p]) { n++; const x = p % fw, y = (p / fw) | 0, i = I(x, y); if (dbg) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 255; d[i + 3] = 255; } else { d[i + 3] = 0; holes.push(p); } }
  if (!dbg) { // fill holes enclosed by body along the line normal
    for (let pass = 0; pass < 4; pass++) for (const p of holes) { const x = p % fw, y = (p / fw) | 0, i = I(x, y); if (d[i + 3]) continue;
      const look = (dx, dy) => { for (let k = 1; k <= 4; k++) { const ax = x + dx * k, ay = y + dy * k; if (ax < 0 || ay < 0 || ax >= fw || ay >= fh) return -1; const j = I(ax, ay); if (d[j + 3] > 30) return j; } return -1; };
      const a = look(1, 0), b = look(-1, 0), c = look(0, 1), e = look(0, -1);
      const src = a >= 0 && b >= 0 ? (pass % 2 ? a : b) : c >= 0 && e >= 0 ? c : -1;
      if (src >= 0 && (pass > 0 || true)) { d[i] = d[src]; d[i + 1] = d[src + 1]; d[i + 2] = d[src + 2]; d[i + 3] = d[src + 3]; } } }
  if (!dbg) { const lab = new Int32Array(N).fill(-1); const sizes = [];
    for (let p = 0; p < N; p++) { if (lab[p] >= 0 || d[I(p % fw, (p / fw) | 0) + 3] < 30) continue; const st = [p]; lab[p] = sizes.length; let c = 0;
      while (st.length) { const q = st.pop(); c++; const x = q % fw, y = (q / fw) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= fw || ay >= fh) continue; const m = ay * fw + ax; if (lab[m] < 0 && d[I(ax, ay) + 3] >= 30) { lab[m] = sizes.length; st.push(m); } } }
      sizes.push(c); }
    const big = sizes.indexOf(Math.max(...sizes));
    for (let p = 0; p < N; p++) if (lab[p] >= 0 && lab[p] !== big && sizes[lab[p]] < 120) d[I(p % fw, (p / fw) | 0) + 3] = 0; }
  return n;
}
const OUT = {}; const DBG = window.DBG;
for (const name of ['idle']) {
  const im = await load(IMG[name]); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height); const cols = im.width / 128; let tot = 0;
  for (let r = 0; r < 8; r++) for (let k = 0; k < cols; k++) tot += frame(data.data, c.width, k * 128, r * 136, 128, 136, DBG);
  g.putImageData(data, 0, 0); OUT[(DBG ? 'dbg_' : 'nostaff_') + name + '.png'] = c.toDataURL(); OUT['n_' + name] = tot;
}
window.OUT = OUT;
