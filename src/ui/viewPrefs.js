// Device view preferences (shared by every character on this device): camera
// zoom and HUD size. The HUD scales with the screen: `--ui` on <html> is
// min(width / 1600, height / 900) × the player's HUD size, and style.css zooms
// the HUD panels by it. Small or short screens also get `body.ui-compact`, which
// hides the extra panels; portrait screens get `body.ui-portrait`.
//
//   const prefs = createViewPrefs();   prefs.zoom, prefs.hud
//   prefs.set({ zoom }) / prefs.set({ hud })   saves and reapplies
const KEY = 'tno.view.v1';
const BASE = { width: 1600, height: 900 };
const LIMIT = { min: .6, max: 1.8 };
const AUTO = { min: .7, max: 1.4 };

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function hudScale(width, height, size = 1) {
  const auto = clamp(Math.min(width / BASE.width, height / BASE.height), AUTO.min, AUTO.max);
  return +clamp(auto * size, LIMIT.min, LIMIT.max).toFixed(3);
}

export function createViewPrefs() {
  const saved = load();
  const prefs = {
    zoom: Number.isFinite(saved.zoom) ? saved.zoom : 1,
    hud: Number.isFinite(saved.hud) ? saved.hud : 1,
    zoomLock: saved.zoomLock === true,   // 🔒 by the minimap: pinch, wheel and keys leave the zoom alone
    quality: saved.quality === 'low' ? 'low' : 'high',   // graphics quality and particles: remembered too (a weak device stays on low)
    particles: saved.particles !== false,
    monsters: saved.monsters === '3d' ? '3d' : 'pixel',   // how monsters are drawn: pixel sprites (RO style) or 3D models
    scale: 1,
    set(change) {
      Object.assign(prefs, change);
      try { localStorage.setItem(KEY, JSON.stringify({ zoom: prefs.zoom, hud: prefs.hud, zoomLock: prefs.zoomLock, quality: prefs.quality, particles: prefs.particles, monsters: prefs.monsters })); } catch { /* storage unavailable */ }
      apply();
    },
  };
  function apply() {
    const w = innerWidth, h = innerHeight;
    prefs.scale = hudScale(w, h, prefs.hud);
    document.documentElement.style.setProperty('--ui', prefs.scale);
    document.body.classList.toggle('ui-compact', w < 900 || h < 560);
    document.body.classList.toggle('ui-portrait', h > w);
  }
  addEventListener('resize', apply);
  apply();
  return prefs;
}
