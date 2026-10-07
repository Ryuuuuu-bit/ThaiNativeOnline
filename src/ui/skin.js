// Window skin (design: artifact "UI ใหม่ Thai Native Online"): "modern" dark glass with gold
// hairlines (src/ui/theme.css) or "classic" carved wood, bronze trim, blue ribbon titles and
// parchment cards (src/ui/skin-classic.css). The choice is a per-browser view preference.
//
//   initSkin(select)   apply the saved skin and bind the settings <select id="ui-skin">
//   setSkin(name)      'modern' | 'classic'
const KEY = 'thainative.ui.skin';
export const SKINS = ['modern', 'classic'];
const pref = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: v => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } } };

// The classic skin's textures are painted once, on first use, into CSS variables.
let painted = false;
function paint(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return `url(${c.toDataURL()})`; }
function paintTextures() {
  if (painted) return;
  painted = true;
  const root = document.documentElement.style;
  root.setProperty('--tex-wood', paint(256, 256, (g, w, h) => {
    g.fillStyle = '#2b2118'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { const k = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.31) * 0.3; g.fillStyle = `rgba(${k > 0 ? '70,52,34' : '14,10,6'},${Math.abs(k) * 0.35 + Math.random() * 0.08})`; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(10,6,3,${0.15 + Math.random() * 0.2})`; g.lineWidth = 1; g.beginPath(); const y0 = Math.random() * h; g.moveTo(0, y0); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.04 + i) * 3); g.stroke(); }
    for (let i = 0; i < 3; i++) { const x = Math.random() * w, y = Math.random() * h, r = g.createRadialGradient(x, y, 0, x, y, 14); r.addColorStop(0, 'rgba(8,5,2,.6)'); r.addColorStop(1, 'rgba(8,5,2,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(x, y, 18, 6, 0, 0, 7); g.fill(); }
  }));
  root.setProperty('--tex-parch', paint(256, 256, (g, w, h) => {
    g.fillStyle = '#e3d0a3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${Math.random() < 0.5 ? '150,110,50' : '255,245,215'},${Math.random() * 0.12})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0);
  }));
  root.setProperty('--tex-stone', paint(128, 128, (g, w, h) => {
    g.fillStyle = '#2d2c29'; g.fillRect(0, 0, w, h);
    const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.15})`; g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); }
  }));
}

export function setSkin(name) {
  const skin = SKINS.includes(name) ? name : 'modern';
  if (skin === 'classic') paintTextures();
  document.body.classList.toggle('skin-classic', skin === 'classic');
  pref.set(skin);
  return skin;
}

export function initSkin(select) {
  const skin = setSkin(pref.get());
  if (!select) return;
  select.value = skin;
  select.addEventListener('change', () => setSkin(select.value));
}
