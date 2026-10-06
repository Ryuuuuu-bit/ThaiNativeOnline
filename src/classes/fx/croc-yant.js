import * as THREE from 'three';

// Crocodile sak-yant line art, drawn in code (original artwork in the
// traditional style: an S-curved crocodile, head down with open jaws, a spiked
// dorsal ridge, dotted scales, four clawed legs and decorative script).
// White lines on transparent, for fx.yantPlane()'s inked-on reveal.
let TEX = null;
export function crocYantCanvas(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const k = S / 512; g.scale(k, k);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // spine: head (bottom-left) -> belly -> tail tip (top-right), Catmull-Rom
  const pts = [[118, 432], [172, 418], [222, 388], [248, 340], [240, 285], [226, 232], [246, 178], [286, 132], [314, 82], [322, 42], [312, 14]];
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return [0, 1].map(i => .5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); };
  const spine = [];
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 12; s++) spine.push(cr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)], s / 12));
  spine.push(pts[pts.length - 1]);
  const n = spine.length;
  const tang = i => { const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  // half-width along the body: snout narrow, head, neck, fat belly, long tapering tail
  const width = u => u < .07 ? 14 + u / .07 * 20 : u < .13 ? 34 - (u - .07) / .06 * 6 : u < .42 ? 28 + Math.sin((u - .13) / .29 * Math.PI) * 22 : Math.max(1.5, 28 * Math.pow(1 - (u - .42) / .58, 1.2));
  const side = s => spine.map((p, i) => { const [tx, ty] = tang(i), w = width(i / (n - 1)) * s; return [p[0] - ty * w, p[1] + tx * w]; });
  const L = side(1), R = side(-1);
  // body outline (from just behind the head so the jaws can open)
  const j0 = Math.round(n * .085);
  const path = (arr, from = 0, to = arr.length) => { g.beginPath(); g.moveTo(...arr[from]); for (let i = from + 1; i < to; i++) g.lineTo(...arr[i]); g.stroke(); };
  g.lineWidth = 3.4; path(L, j0); path(R, j0);
  // dorsal ridge: saw-tooth spikes along the left (upper) edge, smaller down the tail
  g.lineWidth = 2.2;
  for (let i = j0 + 4; i < n - 4; i += 3) {
    const u = i / (n - 1), [tx, ty] = tang(i), h = (u < .45 ? 13 : 13 * (1 - (u - .45) / .55) + 3);
    const a = R[i], b = R[Math.min(n - 1, i + 3)], m = [(a[0] + b[0]) / 2 + ty * h, (a[1] + b[1]) / 2 - tx * h];
    g.beginPath(); g.moveTo(...a); g.lineTo(...m); g.lineTo(...b); g.stroke();
  }
  // belly ridge: a second scale row along the right edge
  for (let i = j0 + 6; i < n * .62; i += 4) { const [tx, ty] = tang(i), a = L[i]; g.beginPath(); g.arc(a[0] + ty * 6, a[1] - tx * 6, 4.2, 0, Math.PI * 2); g.stroke(); }
  // armoured back plates: a double row of scutes down the middle of the body
  g.lineWidth = 1.8;
  for (let i = j0 + 6; i < n * .8; i += 3) { const p = spine[i], [tx, ty] = tang(i), w = Math.min(7, width(i / (n - 1)) * .3);
    for (const o of [-1, 1]) { const cx = p[0] - ty * o * w * .9, cy = p[1] + tx * o * w * .9; g.beginPath(); g.moveTo(cx - tx * 4, cy - ty * 4); g.quadraticCurveTo(cx + ty * o * 5, cy - tx * o * 5, cx + tx * 4, cy + ty * 4); g.stroke(); } }
  // scale dots filling the body
  for (let i = j0 + 2; i < n - 6; i++) {
    const w = width(i / (n - 1)) - 6; if (w < 4) continue; const p = spine[i], [tx, ty] = tang(i);
    const rows = Math.max(1, Math.round(w / 7));
    for (let r = -rows; r <= rows; r++) { if (rnd() < .35 || (Math.abs(r / rows) < .3 && i < n * .8)) continue; const o = r / rows * w; g.beginPath(); g.arc(p[0] - ty * o + (rnd() - .5) * 3, p[1] + tx * o + (rnd() - .5) * 3, 1.3 + rnd() * .9, 0, Math.PI * 2); g.fill(); }
  }
  // head: open jaws with teeth, eye, nostril
  const h = spine[j0], [hx, hy] = tang(j0), back = [-hx, -hy];
  const jawLen = 96, open = .7, base = Math.atan2(back[1], back[0]);
  // each jaw: outer contour from the body edge to the snout tip, inner mouth line with teeth
  const mouth = [h[0] + back[0] * 4, h[1] + back[1] * 4];
  const jaw = (ang, s) => {
    const dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1] * s, dir[0] * s];
    const tip = [mouth[0] + dir[0] * jawLen, mouth[1] + dir[1] * jawLen];
    const edge = (s > 0 ? L : R)[j0 + 2];
    g.lineWidth = 3.2; g.beginPath(); g.moveTo(...edge);
    g.bezierCurveTo(mouth[0] + dir[0] * jawLen * .3 + nrm[0] * 22, mouth[1] + dir[1] * jawLen * .3 + nrm[1] * 22, mouth[0] + dir[0] * jawLen * .8 + nrm[0] * 12, mouth[1] + dir[1] * jawLen * .8 + nrm[1] * 12, tip[0] + nrm[0] * 4, tip[1] + nrm[1] * 4);
    g.quadraticCurveTo(tip[0] + dir[0] * 4, tip[1] + dir[1] * 4, ...tip); g.lineTo(...mouth); g.stroke();
    // nostril bump / jaw scales
    g.beginPath(); g.arc(tip[0] - dir[0] * 10 + nrm[0] * 9, tip[1] - dir[1] * 10 + nrm[1] * 9, 3, 0, Math.PI * 2); g.stroke();
    for (let t = .25; t < .8; t += .14) { g.beginPath(); g.arc(mouth[0] + dir[0] * jawLen * t + nrm[0] * 11, mouth[1] + dir[1] * jawLen * t + nrm[1] * 11, 1.4, 0, Math.PI * 2); g.fill(); }
    // teeth pointing into the mouth, two long fangs
    for (let t = .14; t < .96; t += .09) { const big = Math.abs(t - .4) < .05 || Math.abs(t - .86) < .05, len = big ? 12 : 7;
      const x = mouth[0] + dir[0] * jawLen * t, y = mouth[1] + dir[1] * jawLen * t;
      g.beginPath(); g.moveTo(x - dir[0] * 3, y - dir[1] * 3); g.lineTo(x - nrm[0] * len, y - nrm[1] * len); g.lineTo(x + dir[0] * 3, y + dir[1] * 3); g.fill(); }
    return tip; };
  jaw(base - open / 2, 1); jaw(base + open / 2, -1);
  // eye with a ridge brow, and a nostril knob
  const eye = [h[0] + back[0] * 14 - hy * 15, h[1] + back[1] * 14 + hx * 15];
  g.lineWidth = 2.4; g.beginPath(); g.arc(eye[0], eye[1], 6, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(eye[0], eye[1], 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(eye[0] - hy * 4, eye[1] + hx * 4, 11, Math.PI * .1, Math.PI * .9); g.stroke();
  // legs with claws
  const leg = (u, s, len) => { const i = Math.round(u * (n - 1)), [tx, ty] = tang(i), a = (s > 0 ? L : R)[i];
    const out = [-ty * s, tx * s], knee = [a[0] + out[0] * len * .55 - tx * len * .2, a[1] + out[1] * len * .55 - ty * len * .2], foot = [knee[0] + out[0] * len * .25 + tx * len * .4, knee[1] + out[1] * len * .25 + ty * len * .4];
    const limb = (p0, p1, w0, w1) => { const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      g.beginPath(); g.moveTo(p0[0] + nx * w0, p0[1] + ny * w0); g.lineTo(p1[0] + nx * w1, p1[1] + ny * w1); g.moveTo(p0[0] - nx * w0, p0[1] - ny * w0); g.lineTo(p1[0] - nx * w1, p1[1] - ny * w1); g.stroke();
      for (let d = .2; d < .9; d += .22) { g.beginPath(); g.arc(p0[0] + dx * d, p0[1] + dy * d, 1.3, 0, Math.PI * 2); g.fill(); } };
    g.lineWidth = 2.6; limb(a, knee, 9, 7); limb(knee, foot, 7, 5);
    g.beginPath(); g.arc(knee[0], knee[1], 7, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2.2; const fa = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]);
    for (let c2 = -1.5; c2 <= 1.5; c2 += 1) { const ca = fa + c2 * .42; const e = [foot[0] + Math.cos(ca) * 16, foot[1] + Math.sin(ca) * 16];
      g.beginPath(); g.moveTo(foot[0] + Math.cos(ca) * 4, foot[1] + Math.sin(ca) * 4); g.quadraticCurveTo(foot[0] + Math.cos(ca - .3) * 13, foot[1] + Math.sin(ca - .3) * 13, ...e); g.lineTo(e[0] + Math.cos(ca + 1.9) * 4, e[1] + Math.sin(ca + 1.9) * 4); g.stroke(); } };
  leg(.16, 1, 64); leg(.2, -1, 60); leg(.37, 1, 58); leg(.41, -1, 54);
  // decorative script (not real text): looped strokes in columns beside the body
  const glyph = (x, y, s, rot, kk) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    g.arc(0, 0, 3.2 * s, Math.PI * .2, Math.PI * 2.1); g.moveTo(3 * s, 0); g.lineTo(3 * s, -8 * s - (kk % 3) * 2 * s);
    if (kk % 2) { g.moveTo(-3 * s, 0); g.quadraticCurveTo(-6 * s, -6 * s, -1 * s, -9 * s); } g.stroke(); g.restore(); };
  g.lineWidth = 2;
  for (let i = 0; i < 11; i++) glyph(200 - i * 2, 40 + i * 17, 1.3, -1.35, i);
  for (let i = 0; i < 10; i++) glyph(390 + i * 2, 150 + i * 18, 1.3, 1.45, i + 3);
  for (let i = 0; i < 12; i++) glyph(120 + i * 22, 492, 1.25, 0, i + 5);
  g.beginPath(); g.ellipse(80, 300, 14, 20, 0, 0, Math.PI * 2); g.stroke(); glyph(80, 303, 1.1, 0, 1);
  return c;
}
export function crocYantTex() {
  if (!TEX) { TEX = new THREE.CanvasTexture(crocYantCanvas()); }
  return TEX;
}
