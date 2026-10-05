const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const a = await load(IMG.a); const c = document.createElement('canvas'); c.width = 1300; c.height = 450; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
g.drawImage(a, 290, 120, 450, 160, 0, 0, 1300, 462); window.OUT = { 'zoom3.png': c.toDataURL() };
