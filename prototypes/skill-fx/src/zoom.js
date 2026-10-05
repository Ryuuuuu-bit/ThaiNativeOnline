const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const a = await load(IMG.a), b = await load(IMG.b);
const c = document.createElement('canvas'); c.width = 1200; c.height = 500; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
g.drawImage(a, 520, 230, 240, 200, 0, 0, 600, 500); g.drawImage(b, 520, 230, 240, 200, 600, 0, 600, 500);
window.OUT = { 'zoom.png': c.toDataURL() };
