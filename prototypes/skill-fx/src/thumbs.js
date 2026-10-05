const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
const keys = Object.keys(IMG).filter(k => /^f\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1)); const OUT = {};
for (let i = 0; i < keys.length; i++) { const im = await load(IMG[keys[i]]); const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d');
  g.drawImage(im, 250, 70, 640, 400, 0, 0, 640, 400); OUT['thumb_' + i] = c.toDataURL('image/jpeg', .78); }
window.OUT = OUT;
