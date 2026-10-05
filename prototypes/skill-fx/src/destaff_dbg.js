window.DBG=true;
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
function hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx]; }
const isLeaf = (h, s, v) => h >= 70 && h <= 170 && s > .25 && v > .2;
const isWood = (h, s, v) => h >= 30 && h <= 75 && s >= .22 && s <= .75 && v >= .22 && v <= .85;
const isDark = (h, s, v) => v < .3;
function processFrame(d, W, x0, y0, fw, fh, dbg) {
  const idx = (x, y) => ((y0 + y) * W + x0 + x) * 4;
  const cls = new Uint8Array(fw * fh); // 0 empty,1 other,2 wood,3 leaf,4 dark
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const i = idx(x, y); if (d[i + 3] < 40) continue; const [h, s, v] = hsv(d[i], d[i + 1], d[i + 2]);
    cls[y * fw + x] = isLeaf(h, s, v) ? 3 : isWood(h, s, v) ? 2 : isDark(h, s, v) ? 4 : 1; }
  // components of wood/leaf (8-conn)
  const comp = new Int32Array(fw * fh).fill(-1); const comps = [];
  for (let p = 0; p < fw * fh; p++) { if (comp[p] >= 0 || (cls[p] !== 2 && cls[p] !== 3)) continue;
    const st = [p], c = { px: [], leaf: 0, minY: 1e9, maxY: -1, minX: 1e9, maxX: -1 }; comp[p] = comps.length;
    while (st.length) { const q = st.pop(); c.px.push(q); const x = q % fw, y = (q / fw) | 0; if (cls[q] === 3) c.leaf++;
      c.minY = Math.min(c.minY, y); c.maxY = Math.max(c.maxY, y); c.minX = Math.min(c.minX, x); c.maxX = Math.max(c.maxX, x);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue; const n = ny * fw + nx;
        if (comp[n] < 0 && (cls[n] === 2 || cls[n] === 3)) { comp[n] = comps.length; st.push(n); } } }
    comps.push(c); }
  // staff = components with leaves, or long thin wood (height >= 22 and width <= 9)
  const rm = new Uint8Array(fw * fh);
  comps.forEach(c => { const hgt = c.maxY - c.minY + 1, wid = c.maxX - c.minX + 1;
    const thin = c.px.length / (hgt * wid) < .45 || wid <= 8;
    if (c.leaf >= 6 || (hgt >= 22 && thin)) c.px.forEach(q => rm[q] = 1); });
  // dark outline pixels touching removed pixels and not touching kept non-dark body pixels
  for (let it = 0; it < 2; it++) for (let p = 0; p < fw * fh; p++) { if (cls[p] !== 4 || rm[p]) continue; const x = p % fw, y = (p / fw) | 0; let nearRm = 0, nearBody = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= fw || ny >= fh || (!dx && !dy)) continue; const n = ny * fw + nx;
      if (rm[n]) nearRm++; else if (cls[n] === 1 || cls[n] === 2) nearBody++; }
    if (nearRm && !nearBody) rm[p] = 2; }
  // remove; then fill holes inside body (kept pixels on both sides within 4px)
  let n = 0;
  for (let p = 0; p < fw * fh; p++) if (rm[p]) { const i = idx(p % fw, (p / fw) | 0); if (dbg) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 255; d[i + 3] = 255; } else d[i + 3] = 0; n++; }
  if (!dbg) for (let pass = 0; pass < 3; pass++) for (let p = 0; p < fw * fh; p++) { if (!rm[p]) continue; const x = p % fw, y = (p / fw) | 0; const i = idx(x, y); if (d[i + 3]) continue;
    const kept = (dx, dy) => { for (let k = 1; k <= 4; k++) { const nx = x + dx * k, ny = y + dy * k; if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) return null; const j = idx(nx, ny); if (d[j + 3] > 40 && !rm[ny * fw + nx]) return j; if (d[j + 3] > 40) return j; } return null; };
    const L = kept(-1, 0), Rr = kept(1, 0), U = kept(0, -1), D = kept(0, 1);
    const src = (L != null && Rr != null) ? L : (U != null && D != null) ? U : null;
    if (src != null && (pass > 0 || !rm[((src / 4 | 0) / W | 0) - y0])) { d[i] = d[src]; d[i + 1] = d[src + 1]; d[i + 2] = d[src + 2]; d[i + 3] = d[src + 3]; } }
  return n;
}
const OUT = {}; const DBG = window.DBG;
for (const name of ['idle', 'heal', 'die']) {
  const im = await load(IMG[name]); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height); const fw = 128, fh = 136, cols = im.width / fw; let tot = 0;
  for (let r = 0; r < 8; r++) for (let k = 0; k < cols; k++) tot += processFrame(data.data, c.width, k * fw, r * fh, fw, fh, DBG);
  g.putImageData(data, 0, 0); OUT[(DBG ? 'dbg_' : 'nostaff_') + name + '.png'] = c.toDataURL(); OUT['n_' + name] = tot;
}
window.OUT = OUT;
