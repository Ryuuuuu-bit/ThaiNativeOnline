const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const h = await load(IMG.heal), id = await load(IMG.idle);
const c = document.createElement('canvas'); c.width = 128 * 4 * 4; c.height = 136 * 2 * 4; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height);
[[id, 0, 0], [id, 2, 0], [h, 0, 3], [h, 6, 4]].forEach(([im, row, col], k) => g.drawImage(im, col * 128, row * 136, 128, 136, k * 512, 0, 512, 544));
[[id, 4, 0], [id, 6, 0], [h, 2, 5], [h, 1, 2]].forEach(([im, row, col], k) => g.drawImage(im, col * 128, row * 136, 128, 136, k * 512, 544, 512, 544));
window.OUT = { 'crop.png': c.toDataURL() };
