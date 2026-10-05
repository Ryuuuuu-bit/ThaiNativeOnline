const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const keys = Object.keys(IMG).filter(k => /^f\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1));
const c = document.createElement('canvas'); c.width = 2 * 760; c.height = Math.ceil(keys.length / 2) * 470; const g = c.getContext('2d');
for (let i = 0; i < keys.length; i++) { const im = await load(IMG[keys[i]]); g.drawImage(im, 260, 20, 760, 470, (i % 2) * 760, Math.floor(i / 2) * 470, 760, 470); }
window.OUT = { 'grid.png': c.toDataURL('image/jpeg', .85) };
