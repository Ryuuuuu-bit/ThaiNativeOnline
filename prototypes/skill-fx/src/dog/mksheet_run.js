window.SPEC={"idle":[{"flip":false,"f":[0,1,2,3,4]},{"flip":false,"f":[5,6,7,8,9]},{"flip":false,"f":[10,11,12,13,14]},{"flip":false,"f":[15,16,17,18,19]},{"flip":false,"f":[20,21,22,23,24]},{"flip":true,"f":[25,26,27,28,29]},{"flip":true,"f":[30,31,32,33,34]},{"flip":true,"f":[35,36,37,38,39]}],"run":[{"flip":false,"f":[40,41,42,43,44,45,46,47]},{"flip":false,"f":[48,49,50,51,52,53,54,55]},{"flip":false,"f":[56,57,58,59,60,61,62,63]},{"flip":false,"f":[64,65,66,67,68,69,70,71]},{"flip":false,"f":[72,73,74,75,76,77,78,79]},{"flip":true,"f":[80,81,82,83,84,85,86,87]},{"flip":true,"f":[88,89,90,91,92,93,94,95]},{"flip":true,"f":[96,97,98,99,100,101,102,103]}],"bite":[{"flip":false,"f":[104,105,106,107,108,109,110,111,112]},{"flip":false,"f":[113,114,115,116,117,118,119,120,121]},{"flip":false,"f":[122,123,124,125,126,127,128,129,130]},{"flip":false,"f":[131,132,133,134,135,136,137,138,139]},{"flip":false,"f":[140,141,142,143,144,145,146,147,148]},{"flip":true,"f":[149,150,151,152,153,154,155,156,157]},{"flip":true,"f":[158,159,160,161,162,163,164,165,166]},{"flip":true,"f":[167,168,169,170,171,172,173,174,175]}]};
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
window.OUT = OUT;