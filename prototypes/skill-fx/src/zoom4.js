const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const a = await load(IMG.a); const c = document.createElement('canvas'); c.width = 1300; c.height = 600; const g = c.getContext('2d');
g.drawImage(a, 330, 20, 520, 240, 0, 0, 1300, 600); window.OUT = { 'zoom4.png': c.toDataURL() };
