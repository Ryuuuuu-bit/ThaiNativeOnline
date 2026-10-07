import { cellColor, rasterPalette, contourSegments, padRect, regionAnchors, REGION_TONES } from './mapStyle.js';

// Paints one map once into an offscreen canvas, from what buildWorld() exposes
// (src/world/README.md): terrain height/water grids, the grass mask (bare ground
// and wildness), collision shapes (trees, walls, decks), building footprints and
// the walk rectangles. Nothing here is per frame.
//
//   paintBase({ world, bounds, theme, regionAt? }) →
//     { canvas, rect, S, zones: [{ id, name, x, z, n }], ms }
// `rect` is the painted world rect (walk bounds plus a margin), `S` pixels per unit.

const PAD = 14, MAX_PX = 2400;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const seedOf = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function paintBase({ world, bounds, theme, regionAt = null }) {
  const t0 = performance.now();
  const rect = padRect(bounds, PAD, world.map?.view ?? null);
  const W1 = Math.ceil(rect.maxX - rect.minX), H1 = Math.ceil(rect.maxZ - rect.minZ);
  const S = Math.min(3, MAX_PX / Math.max(W1, H1));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(W1 * S); canvas.height = Math.round(H1 * S);
  const g = canvas.getContext('2d');
  const px = x => (x - rect.minX) * S, pz = z => (z - rect.minZ) * S;
  const rand = rng(seedOf(world.map?.id ?? 'map'));
  const terrain = world.terrain, mask = world.mask, pal = rasterPalette(theme);

  // ---- 1. ground raster, 1 px per unit, scaled up soft ----
  const small = document.createElement('canvas'); small.width = W1; small.height = H1;
  const sg = small.getContext('2d'), img = sg.createImageData(W1, H1), d = img.data;
  const deepField = new Uint8Array((W1 + 1) * (H1 + 1)), shallowMask = new Uint8Array(W1 * H1);
  const heightAt = (x, z) => (terrain ? terrain.height(x, z) : 0);
  const maskAt = (x, z) => {
    if (!mask?.data) return null;
    const r = mask.texture?.userData?.rect ?? terrain?.rect ?? rect;
    const i = Math.floor((x - r.minX) * (mask.width / (r.maxX - r.minX))), j = Math.floor((z - r.minZ) * (mask.height / (r.maxZ - r.minZ)));
    if (i < 0 || j < 0 || i >= mask.width || j >= mask.height) return null;
    const k = (j * mask.width + i) * 4; return [mask.data[k] / 255, mask.data[k + 2] / 255];
  };
  const samples = [], tones = new Array(W1 * H1);
  if (regionAt) for (let j = 0; j < H1; j += 2) for (let i = 0; i < W1; i += 2) {
    const x = rect.minX + i + .5, z = rect.minZ + j + .5;
    let region = null; try { region = regionAt(x, z); } catch { /* region data for another map */ }
    const tone = region ? REGION_TONES[region.id] : undefined;
    for (const k of [j * W1 + i, j * W1 + i + 1, (j + 1) * W1 + i, (j + 1) * W1 + i + 1]) tones[k] = tone;
    if (region && world.contains?.(x, z)) samples.push({ region, x, z });
  }
  const trackField = new Uint8Array((W1 + 1) * (H1 + 1));
  for (let j = 0; j <= H1; j++) for (let i = 0; i <= W1; i++) {
    const x = rect.minX + i, z = rect.minZ + j, k = j * (W1 + 1) + i, m = maskAt(x, z);
    deepField[k] = terrain?.isDeep(x, z) ? 1 : 0;
    trackField[k] = !deepField[k] && m && m[0] < .12 && !terrain?.isShallow(x, z) ? 1 : 0;
  }
  for (let j = 0; j < H1; j++) for (let i = 0; i < W1; i++) {
    const x = rect.minX + i + .5, z = rect.minZ + j + .5, k = j * W1 + i;
    const deep = deepField[j * (W1 + 1) + i] + deepField[j * (W1 + 1) + i + 1] + deepField[(j + 1) * (W1 + 1) + i] + deepField[(j + 1) * (W1 + 1) + i + 1] >= 2;
    const shallow = !deep && !!terrain?.isShallow(x, z);
    if (shallow) shallowMask[k] = 1;
    const m = maskAt(x, z), h = heightAt(x, z);
    const shade = terrain ? (heightAt(x + 1.5, z + 1.5) - heightAt(x - 1.5, z - 1.5)) * .18 : 0;
    const c = cellColor(pal, { deep, shallow, grass: m ? m[0] : 1, wild: m ? m[1] : .2, shade: deep ? 0 : shade, tone: tones[k], depth: deep ? Math.min(1, -h / 3) : 0 });
    const n = (rand() - .5) * 10; // paper-like grain
    d[k * 4] = c[0] + n; d[k * 4 + 1] = c[1] + n; d[k * 4 + 2] = c[2] + n * .8; d[k * 4 + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  g.fillStyle = theme.paper; g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, W1 * S, H1 * S);

  // ---- 2. paddy hatching (green grid clipped to shallow ground) ----
  const layer = (paint, maskFn) => {
    const m = document.createElement('canvas'); m.width = W1; m.height = H1;
    const mg = m.getContext('2d'), mi = mg.createImageData(W1, H1);
    for (let k = 0; k < W1 * H1; k++) if (maskFn(k)) mi.data[k * 4 + 3] = 255;
    mg.putImageData(mi, 0, 0);
    const big = document.createElement('canvas'); big.width = canvas.width; big.height = canvas.height;
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = true; bg.drawImage(m, 0, 0, W1 * S, H1 * S);
    bg.globalCompositeOperation = 'source-in'; paint(bg);
    g.drawImage(big, 0, 0);
  };
  layer(bg => {
    bg.strokeStyle = theme.paddyInk; bg.globalAlpha = .55; bg.lineWidth = Math.max(1, S * .35);
    const step = 4 * S; bg.beginPath();
    for (let x = (-rect.minX * S) % step; x < canvas.width; x += step) { bg.moveTo(x, 0); bg.lineTo(x, canvas.height); }
    for (let y = (-rect.minZ * S) % step; y < canvas.height; y += step) { bg.moveTo(0, y); bg.lineTo(canvas.width, y); }
    bg.stroke();
  }, k => shallowMask[k]);

  // Road and yard edges: a thin warm ink line where bare ground meets grass.
  g.strokeStyle = theme.trackEdge; g.globalAlpha = .7; g.lineWidth = Math.max(1, S * .3); g.lineCap = 'round'; g.beginPath();
  for (const [x1, y1, x2, y2] of contourSegments(trackField, W1, H1)) { g.moveTo(x1 * S, y1 * S); g.lineTo(x2 * S, y2 * S); }
  g.stroke(); g.globalAlpha = 1;

  // ---- 3. water: ink coastline, ripple lines and wave strokes ----
  const coast = contourSegments(deepField, W1, H1);
  const strokeSegs = (width, color, offset = 0) => {
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.beginPath();
    for (const [x1, y1, x2, y2] of coast) { g.moveTo(x1 * S + offset, y1 * S + offset); g.lineTo(x2 * S + offset, y2 * S + offset); }
    g.stroke();
  };
  strokeSegs(S * 2.4, 'rgba(255,248,225,.35)'); strokeSegs(Math.max(1.2, S * .5), theme.waterInk);
  g.save(); g.globalAlpha = .55; g.strokeStyle = '#d8ecf2'; g.lineWidth = Math.max(1, S * .32); g.lineCap = 'round';
  const deepAt = (x, z) => terrain?.isDeep(x, z);
  for (let z = rect.minZ + 3; z < rect.maxZ; z += 5) for (let x = rect.minX + 3 + ((z * 7) % 5); x < rect.maxX; x += 7) {
    const jx = x + (rand() - .5) * 3, jz = z + (rand() - .5) * 2;
    if (!deepAt(jx, jz) || !deepAt(jx - 2.5, jz) || !deepAt(jx + 2.5, jz)) continue;
    const cx = px(jx), cy = pz(jz), w = S * 1.4;
    g.beginPath(); g.arc(cx - w, cy, w, Math.PI * 1.15, Math.PI * 1.85); g.arc(cx + w, cy, w, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }
  g.restore();

  // ---- 4. collision shapes: decks, trees, walls ----
  const shapes = new Set(), decks = new Set();
  for (const list of world.collision?.shapes?.values?.() ?? []) for (const s of list) shapes.add(s);
  for (const list of world.collision?.decks?.values?.() ?? []) for (const s of list) decks.add(s);
  const inRect = (x, z, m = 2) => x > rect.minX - m && x < rect.maxX + m && z > rect.minZ - m && z < rect.maxZ + m;
  const box = (s, w, h, fill, line) => {
    g.save(); g.translate(px(s.x), pz(s.z)); g.transform(s.c, -s.s, s.s, s.c, 0, 0);
    g.fillStyle = fill; g.fillRect(-w * S, -h * S, w * 2 * S, h * 2 * S);
    if (line) { g.strokeStyle = line; g.lineWidth = Math.max(1, S * .3); g.strokeRect(-w * S, -h * S, w * 2 * S, h * 2 * S); }
    g.restore();
  };
  for (const dk of decks) if (inRect(dk.x, dk.z)) {
    box(dk, dk.hw, dk.hd, theme.deck, theme.ink);
    g.save(); g.translate(px(dk.x), pz(dk.z)); g.transform(dk.c, -dk.s, dk.s, dk.c, 0, 0); g.strokeStyle = 'rgba(60,36,14,.45)'; g.lineWidth = 1;
    g.beginPath(); for (let z = -dk.hd + 1; z < dk.hd; z += 1.2) { g.moveTo(-dk.hw * S, z * S); g.lineTo(dk.hw * S, z * S); } g.stroke(); g.restore();
  }
  const trees = [...shapes].filter(s => s.t === 0 && s.r >= .3 && inRect(s.x, s.z));
  const blob = s => (s.r + .9) * S;
  g.fillStyle = 'rgba(40,46,22,.28)'; g.beginPath();
  for (const s of trees) { g.moveTo(px(s.x) + S * .7 + blob(s), pz(s.z) + S * .8); g.arc(px(s.x) + S * .7, pz(s.z) + S * .8, blob(s), 0, Math.PI * 2); }
  g.fill();
  g.fillStyle = theme.treeDark; g.beginPath();
  for (const s of trees) { g.moveTo(px(s.x) + blob(s) * 1.05, pz(s.z)); g.arc(px(s.x), pz(s.z), blob(s) * 1.05, 0, Math.PI * 2); }
  g.fill();
  g.fillStyle = theme.tree; g.beginPath();
  for (const s of trees) { const r = blob(s) * .82; g.moveTo(px(s.x) - S * .25 + r, pz(s.z) - S * .3); g.arc(px(s.x) - S * .25, pz(s.z) - S * .3, r, 0, Math.PI * 2); }
  g.fill();
  g.fillStyle = 'rgba(235,240,190,.32)'; g.beginPath();
  for (const s of trees) { const r = blob(s) * .32; g.moveTo(px(s.x) - blob(s) * .3 + r, pz(s.z) - blob(s) * .35); g.arc(px(s.x) - blob(s) * .3, pz(s.z) - blob(s) * .35, r, 0, Math.PI * 2); }
  g.fill();

  // ---- 5. buildings: small roofs with a ridge and a soft shadow ----
  const roof = (f, color) => {
    const w = f.w * .92, dd = f.d * .92, long = w >= dd;
    g.save(); g.translate(px(f.x), pz(f.z)); g.rotate(-f.rot);
    g.fillStyle = 'rgba(40,24,10,.3)'; g.fillRect(-w / 2 * S + S * .8, -dd / 2 * S + S, w * S, dd * S);
    g.fillStyle = color; g.fillRect(-w / 2 * S, -dd / 2 * S, w * S, dd * S);
    g.fillStyle = 'rgba(255,230,190,.22)'; g.fillRect(-w / 2 * S, -dd / 2 * S, long ? w * S : w * S / 2, long ? dd * S / 2 : dd * S);
    g.strokeStyle = theme.roofDark; g.lineWidth = Math.max(1, S * .35); g.strokeRect(-w / 2 * S, -dd / 2 * S, w * S, dd * S);
    g.beginPath();
    if (long) { g.moveTo(-w / 2 * S + S * .6, 0); g.lineTo(w / 2 * S - S * .6, 0); } else { g.moveTo(0, -dd / 2 * S + S * .6); g.lineTo(0, dd / 2 * S - S * .6); }
    g.stroke(); g.restore();
  };
  for (const f of world.footprints ?? []) if (inRect(f.x, f.z, 6)) roof(f, f.paint === 'stone' ? theme.roofStone : f.paint === 'dark' ? theme.roofDark : theme.roof);

  // ---- 6. walls (crenellated) and fences ----
  const segs = [...shapes].filter(s => s.t === 2 && (inRect(s.x1, s.z1, 4) || inRect(s.x2, s.z2, 4)));
  const pathSegs = list => { g.beginPath(); for (const s of list) { g.moveTo(px(s.x1), pz(s.z1)); g.lineTo(px(s.x2), pz(s.z2)); } };
  const walls = segs.filter(s => s.r >= .5), fences = segs.filter(s => s.r < .5);
  g.lineCap = 'butt';
  pathSegs(fences); g.strokeStyle = 'rgba(92,60,30,.75)'; g.lineWidth = Math.max(1, S * .4); g.stroke();
  pathSegs(walls); g.strokeStyle = theme.ink; g.lineWidth = S * 2.6; g.stroke();
  g.strokeStyle = theme.wall; g.lineWidth = S * 1.9; g.stroke();
  g.setLineDash([S * 1.1, S * 1.1]); g.strokeStyle = theme.wallTop; g.lineWidth = S * .9; g.stroke(); g.setLineDash([]);

  // ---- 7. paper grain, the edge of the walkable world, age ----
  g.save(); g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < (W1 * H1) / 60; i++) {
    const x = rand() * canvas.width, y = rand() * canvas.height;
    g.fillStyle = `rgba(${120 + rand() * 60},${95 + rand() * 40},${60 + rand() * 30},${.05 + rand() * .07})`;
    g.fillRect(x, y, rand() * S * 6 + 1, rand() * S * .6 + .5);
  }
  for (let i = 0; i < 5; i++) {
    const x = rand() * canvas.width, y = rand() * canvas.height, r = (20 + rand() * 40) * S;
    const st = g.createRadialGradient(x, y, r * .2, x, y, r); st.addColorStop(0, 'rgba(176,140,80,.10)'); st.addColorStop(.8, 'rgba(176,140,80,.05)'); st.addColorStop(1, 'rgba(176,140,80,0)');
    g.fillStyle = st; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
  const walk = world.map?.walk ?? [bounds];
  const wash = document.createElement('canvas'); wash.width = canvas.width; wash.height = canvas.height;
  const wg = wash.getContext('2d');
  wg.fillStyle = theme.wash; wg.globalAlpha = .62; wg.fillRect(0, 0, wash.width, wash.height);
  wg.globalAlpha = .18; wg.strokeStyle = theme.edge; wg.lineWidth = 1; wg.beginPath();
  for (let k = -wash.height; k < wash.width; k += 6 * S) { wg.moveTo(k, wash.height); wg.lineTo(k + wash.height, 0); }
  wg.stroke(); wg.globalAlpha = 1;
  for (const r of walk) wg.clearRect(px(r.minX), pz(r.minZ), (r.maxX - r.minX) * S, (r.maxZ - r.minZ) * S);
  g.drawImage(wash, 0, 0);
  g.save(); g.setLineDash([S * 2.2, S * 1.4]); g.strokeStyle = 'rgba(74,52,32,.55)'; g.lineWidth = Math.max(1, S * .45);
  for (const r of walk) g.strokeRect(px(r.minX), pz(r.minZ), (r.maxX - r.minX) * S, (r.maxZ - r.minZ) * S);
  g.restore();
  const v = g.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * .35, canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * .6);
  v.addColorStop(0, 'rgba(120,84,40,0)'); v.addColorStop(1, 'rgba(120,84,40,.28)');
  g.fillStyle = v; g.fillRect(0, 0, canvas.width, canvas.height);

  const zones = regionAnchors(samples, 40);
  return { canvas, rect, S, zones, trees: trees.length, ms: Math.round(performance.now() - t0) };
}
