const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const im = await load(IMG.idle); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
const hist = (x0, y0, x1, y1) => { const m = {}; const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { const k = (d[i] >> 3 << 3) + ',' + (d[i + 1] >> 3 << 3) + ',' + (d[i + 2] >> 3 << 3); m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => e.join(':')).join(' '); };
const R4 = 4 * 136;
window.OUT = { staff: hist(36, R4 + 50, 46, R4 + 110), shirt: hist(55, R4 + 50, 75, R4 + 70), bag: hist(48, R4 + 80, 58, R4 + 95), front_shirt: hist(55, 60, 70, 75) , front_bag:hist(48,80,58,95)};
