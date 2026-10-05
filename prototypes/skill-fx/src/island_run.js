window.OUTNAME='dog/rot_north_clean.png';
const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const im = await load(IMG.f0); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
const d = g.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height, lab = new Int32Array(W * H).fill(-1), sizes = [];
for (let p = 0; p < W * H; p++) { if (lab[p] >= 0 || d.data[p * 4 + 3] < 20) continue; const st = [p]; lab[p] = sizes.length; let n = 0;
  while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue; const m = ay * W + ax; if (lab[m] < 0 && d.data[m * 4 + 3] >= 20) { lab[m] = sizes.length; st.push(m); } } }
  sizes.push(n); }
const big = sizes.indexOf(Math.max(...sizes)); let removed = 0;
for (let p = 0; p < W * H; p++) if (lab[p] >= 0 && lab[p] !== big) { d.data[p * 4 + 3] = 0; removed++; }
g.putImageData(d, 0, 0); window.OUT = { [window.OUTNAME]: c.toDataURL(), removed: String(removed) };
