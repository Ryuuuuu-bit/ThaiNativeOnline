const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const a = await load(IMG.a), b = await load(IMG.b);
const c = document.createElement('canvas'); c.width = 128 * 8 * 2; c.height = 136 * 4 * 2; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#556'; g.fillRect(0, 0, c.width, c.height);
for (let r = 0; r < 8; r++) { g.drawImage(a, 0, r * 136, 128, 136, (r % 4) * 256 * 2 / 2 * 1, Math.floor(r / 4) * 272, 256, 272); }
for (let k = 0; k < 8; k++) { const r = [0, 2, 4, 6, 1, 3, 5, 7][k]; g.drawImage(b, 3 * 128, r * 136, 128, 136, 1024 + (k % 4) * 256, Math.floor(k / 4) * 272, 256, 272); }
for (let k = 0; k < 8; k++) { g.drawImage(b, k * 128, 0, 128, 136, k * 256, 544, 256, 272); g.drawImage(b, k * 128, 4 * 136, 128, 136, k * 256, 816, 256, 272); }
window.OUT = { 'view.png': c.toDataURL() };
