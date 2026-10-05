import * as THREE from 'three';

// Canvas textures are only painted in a browser; in Node (rig checks, CLI
// export) materials fall back to flat colors.
const hasCanvas = typeof document !== 'undefined';
const cache = new Map();

function canvasTexture(key, w, h, paint, repeat = [1, 1]) {
  if (!hasCanvas) return null;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); tex.anisotropy = 4;
  cache.set(key, tex); return tex;
}

// Kanok flame + diamond motif in gold over a base color, with banded borders.
function thaiPattern(base, gold, accent) {
  return (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, w, h * .07); ctx.fillRect(0, h * .93, w, h * .07);
    ctx.fillStyle = gold; ctx.fillRect(0, h * .07, w, h * .018); ctx.fillRect(0, h * .912, w, h * .018);
    ctx.strokeStyle = gold; ctx.fillStyle = gold; ctx.lineWidth = w / 120;
    const cols = 4, rows = 3;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + .5 + (r % 2) * .5) * w / cols, y = h * (.2 + r * .3), s = w / cols * .32;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .7, y); ctx.closePath(); ctx.stroke();
      // Flame tip (kanok) rising from the diamond.
      ctx.beginPath(); ctx.moveTo(x - s * .25, y - s * .1);
      ctx.quadraticCurveTo(x - s * .3, y - s * .7, x, y - s * .55); ctx.quadraticCurveTo(x + s * .3, y - s * .7, x + s * .25, y - s * .1);
      ctx.quadraticCurveTo(x, y + s * .1, x - s * .25, y - s * .1); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + s * .3, s * .1, 0, Math.PI * 2); ctx.fill();
    }
  };
}
function stripes(colors, vertical = false) {
  return (ctx, w, h) => {
    const n = colors.length;
    colors.forEach((c, i) => { ctx.fillStyle = c; vertical ? ctx.fillRect(i * w / n, 0, w / n + 1, h) : ctx.fillRect(0, i * h / n, w, h / n + 1); });
  };
}
// Torso skin: soft muscle definition and optional sak yant tattoos.
// Tube UVs: u = 0.5 is the front, 0/1 the back; v runs pelvis → neck.
function skinPaint(tone, { back, chest, shoulder } = {}) {
  return (ctx, w, h) => {
    ctx.fillStyle = tone; ctx.fillRect(0, 0, w, h);
    const Y = v => (1 - v) * h, X = u => u * w;
    ctx.strokeStyle = 'rgba(90,45,25,.18)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    // Pectorals and abdominal grid.
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(.5 + s * .015), Y(.66)); ctx.quadraticCurveTo(X(.5 + s * .1), Y(.62), X(.5 + s * .16), Y(.69)); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X(.5), Y(.72)); ctx.lineTo(X(.5), Y(.3)); ctx.stroke();
    for (const v of [.55, .47, .39]) { ctx.beginPath(); ctx.moveTo(X(.45), Y(v)); ctx.quadraticCurveTo(X(.5), Y(v - .015), X(.55), Y(v)); ctx.stroke(); }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(.5 + s * .07), Y(.6)); ctx.quadraticCurveTo(X(.5 + s * .09), Y(.4), X(.5 + s * .05), Y(.24)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(70,35,20,.12)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(X(.0), Y(.75)); ctx.lineTo(X(0), Y(.35)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(1), Y(.75)); ctx.lineTo(X(1), Y(.35)); ctx.stroke();
    const ink = 'rgba(64,38,24,.78)';
    const yant = (cx, cy, s) => {
      ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = s * .035;
      for (let i = 0; i < 9; i++) { // nine spires (gao yord)
        const x = cx + (i - 4) * s * .11, top = cy - s * (.55 - Math.abs(i - 4) * .06);
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, top); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, top - s * .04, s * .025, 0, Math.PI * 2); ctx.fill();
        for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.arc(x, cy - (cy - top) * k / 3, s * .03, 0, Math.PI); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.ellipse(cx, cy + s * .12, s * .55, s * .12, 0, 0, Math.PI * 2); ctx.stroke();
      for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) {
        const x = cx + (i - 3) * s * .13, y = cy + s * (.32 + row * .11);
        ctx.beginPath(); ctx.arc(x, y, s * .035, Math.PI * .2, Math.PI * 1.8); ctx.stroke();
      }
    };
    if (back) { yant(X(0.0), Y(.68), w * .26); yant(X(1), Y(.68), w * .26); }
    if (chest) yant(X(.5), Y(.48), w * .16);
    if (shoulder) {
      ctx.strokeStyle = ink; ctx.lineWidth = 4;
      for (const u of shoulder) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X(u), Y(.78), 14 + i * 9, Math.PI * .1, Math.PI * .9); ctx.stroke(); }
    }
  };
}

export function makeMaterials(palette, opts = {}) {
  const std = (name, color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .82, ...extra }); m.name = name; return m; };
  const tex = (key, paint, repeat) => canvasTexture(key, 256, 256, paint, repeat);
  const m = {
    skin: std('Skin', palette.skin, { roughness: .62 }),
    torso: std('SkinTorso', hasCanvas ? '#ffffff' : palette.skin, { roughness: .62, map: canvasTexture(`skin-${palette.skin}-${JSON.stringify(opts.tattoo || {})}`, 512, 512, skinPaint(palette.skin, opts.tattoo)) }),
    hair: std('Hair', palette.hair, { roughness: .55 }),
    eye: std('Eye', '#24150e', { roughness: .3 }),
    eyeWhite: std('EyeHighlight', '#fff7e8', { roughness: .3, emissive: '#3b3530' }),
    lip: std('Lip', '#8a4b3a'),
    gold: std('Gold', '#d0a656', { metalness: .4, roughness: .42, emissive: '#2a1a05' }),
    steel: std('Steel', '#dfe3e2', { metalness: .45, roughness: .28, emissive: '#1c1f22' }),
    leather: std('Leather', '#5d3b26', { roughness: .7 }),
    darkLeather: std('DarkLeather', '#342219', { roughness: .72 }),
    wrap: std('Wrap', '#e9e1cc', { roughness: .95 }),
    bone: std('Bone', '#e8dfc8', { roughness: .6 }),
    wood: std('Wood', '#5a3b26', { roughness: .8 }),
  };
  for (const [name, c] of Object.entries(palette.cloth || {})) m[name] = std(name, c, { side: THREE.DoubleSide });
  for (const [name, [base, gold, accent, repeat]] of Object.entries(palette.patterns || {})) {
    const map = tex(`pat-${base}-${gold}-${accent}`, thaiPattern(base, gold, accent), repeat || [1, 1]);
    m[name] = std(name, map ? '#ffffff' : base, { map, side: THREE.DoubleSide });
  }
  for (const [name, colors] of Object.entries(palette.stripes || {})) {
    const map = tex(`str-${colors.join()}`, stripes(colors), [1, 1]);
    m[name] = std(name, map ? '#ffffff' : colors[0], { map, side: THREE.DoubleSide });
  }
  return m;
}
