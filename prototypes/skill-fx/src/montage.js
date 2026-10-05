const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const keys = Object.keys(IMG).filter(k => /^f\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1)); const ims = []; for (const k of keys) ims.push(await load(IMG[k]));
const S = window.SCALE || 3, cols = window.COLS || ims.length, w = Math.max(...ims.map(i => i.width)), h = Math.max(...ims.map(i => i.height));
const c = document.createElement('canvas'); c.width = cols * w * S; c.height = Math.ceil(ims.length / cols) * h * S; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#4a5560'; g.fillRect(0, 0, c.width, c.height);
ims.forEach((im, i) => g.drawImage(im, (i % cols) * w * S, Math.floor(i / cols) * h * S, im.width * S, im.height * S));
window.OUT = { [window.OUTNAME || 'montage.png']: c.toDataURL() };
