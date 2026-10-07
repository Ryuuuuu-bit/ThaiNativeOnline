import { EMBLEMS } from '../icons.js';

// Canvas map symbols, drawn in code (no image assets): gold badges with an ink
// symbol, the player arrow, warps, monsters, NPC dots and a compass rose.
// Symbols are SVG path data in a 24×24 box (stroke = ink), turned into Path2D once.
const SYMBOLS = {
  trade: ['M9 3.5h6l-1.6 3.2h-2.8z M8.6 7.6h6.8c3.8 2.6 4.8 11.9-3.4 11.9S4.8 10.2 8.6 7.6z', true],
  equipment: ['M18.5 3.5 20.5 5.5 10 16l-2-2z M6.5 13.5l4 4-1.5 1.5-1.2-1.2-2.6 2.6-1.6-1.6 2.6-2.6-1.2-1.2z', true],
  upgrade: ['M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3z', true],
  skills: ['M12 4.5 19.5 17.5h-15z M12 2a10 10 0 1 0 .01 0 M12 9.5v4.5', false],
  travel: ['M2 13.5h20l-3.6 6H5.6z M11 2.5v9.5H4.5z M13 5v7h5.5z', true],
  gathering: ['M5 20.5c0-9 4.5-14.5 14.5-16.5-1 9.5-5.5 15-14.5 16.5z', true],
  combat: ['M5 19 17 7l1-3-3 1L3 17 M19 19 7 7 6 4l3 1 12 12', false],
  boss: ['M12 2.5c4.5 4 6.8 7.5 6.8 11a6.8 6.8 0 0 1-13.6 0c0-2.4 1.2-4.6 3.4-5.8 0 2.2 1 3.4 2.2 3.4 0-3.4 0-5.6 1.2-8.6z', true],
  karma: ['M12 18.5c-3.4-2.2-4.4-6.6 0-12 4.4 5.4 3.4 9.8 0 12z M12 19c-5.6 0-9-3.4-9-6.8 3.4 0 6.8 2.2 9 6.8z M12 19c5.6 0 9-3.4 9-6.8-3.4 0-6.8 2.2-9 6.8z', true],
  story: ['M12 1.5l1.2 4.5h-2.4z M9.6 7h4.8l1.1 5h-7z M6.6 13h10.8l2 5H4.6z M3.5 19h17v2.2h-17z', true],
  quest: ['M9.8 3.5h4.4l-.9 10.5h-2.6z M12 15.8a2 2 0 1 0 .01 0', true],
};
const cache = new Map();
function path(key) {
  if (cache.has(key)) return cache.get(key);
  let p = null;
  if (key.startsWith('class:')) {
    const svg = EMBLEMS[key.slice(6)];
    if (svg) { p = new Path2D(); for (const m of svg.matchAll(/d="([^"]+)"/g)) p.addPath(new Path2D(m[1])); }
    if (p) p.fill = false;
  } else if (SYMBOLS[key]) { p = new Path2D(SYMBOLS[key][0]); p.fill = SYMBOLS[key][1]; }
  cache.set(key, p);
  return p;
}
function stroke(g, key, x, y, size, color, width = 2.2) {
  const p = path(key); if (!p) return false;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
  g.strokeStyle = g.fillStyle = color; g.lineWidth = width; g.lineCap = g.lineJoin = 'round';
  if (p.fill) g.fill(p); else g.stroke(p);
  g.restore();
  return true;
}

const INK = '#3a2612';
// Round gold badge with a symbol; `tone` picks the disc colours.
const TONES = {
  gold: ['#fbe7ad', '#c8963c', INK], quest: ['#ffd36a', '#c2522c', '#fff6dc'], shop: ['#f1e2b8', '#a4794a', INK],
  hall: ['#f6dca0', '#9b3b2a', '#fff1cf'], faded: ['#efe4c6', '#b8a982', '#8a7a5a'],
};
export function badge(g, x, y, r, symbol, tone = 'gold', alpha = 1) {
  const [hi, lo, ink] = TONES[tone] ?? TONES.gold;
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(30,18,6,.35)'; g.beginPath(); g.arc(x + r * .12, y + r * .2, r * 1.08, 0, Math.PI * 2); g.fill();
  const grad = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  grad.addColorStop(0, hi); grad.addColorStop(1, lo);
  g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1, r * .16); g.stroke();
  if (symbol && !stroke(g, symbol, x, y, r * 1.5, ink, 2.8)) { g.fillStyle = ink; g.beginPath(); g.arc(x, y, r * .3, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
// Undiscovered place: faded ring with a question mark.
export function unknownMark(g, x, y, r, alpha = .75) {
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(245,234,205,.65)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.setLineDash([r * .5, r * .35]); g.strokeStyle = '#7d6a48'; g.lineWidth = Math.max(1, r * .14); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#6d5a3a'; g.font = `600 ${Math.round(r * 1.25)}px "Noto Serif Thai", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', x, y + r * .08); g.restore();
}
// Quest marker ('!' offer, '?' hand-in): a pennant badge that bobs with `t`.
export function questMark(g, x, y, r, glyph = '!', t = 0) {
  const bob = Math.sin(t * 4) * r * .18;
  g.save();
  g.fillStyle = 'rgba(255,200,90,.28)'; g.beginPath(); g.arc(x, y + bob, r * 1.7, 0, Math.PI * 2); g.fill();
  badge(g, x, y + bob, r, glyph === '?' ? null : 'quest', 'quest');
  if (glyph === '?') { g.fillStyle = '#fff6dc'; g.font = `700 ${Math.round(r * 1.4)}px "Noto Sans Thai", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y + bob + r * .05); }
  g.restore();
}
// Warp: glowing ring with turning yantra ticks.
export function portalMark(g, x, y, r, t = 0) {
  g.save();
  const glow = g.createRadialGradient(x, y, r * .2, x, y, r * 2.1);
  glow.addColorStop(0, 'rgba(255,240,190,.85)'); glow.addColorStop(.45, 'rgba(255,214,120,.45)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 2.1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4a12'; g.lineWidth = Math.max(1.5, r * .32); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#ffe39a'; g.lineWidth = Math.max(1, r * .18); g.stroke();
  g.translate(x, y); g.rotate(t * .9); g.strokeStyle = '#9fe6ff'; g.lineWidth = Math.max(1, r * .14);
  for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(r * .45, 0); g.lineTo(r * .7, 0); g.stroke(); }
  g.restore();
}
// Trail exit: a wooden signpost with an arrow board, on a trodden ring.
export function pathMark(g, x, y, r, angle = 0) {
  g.save();
  g.fillStyle = 'rgba(255,236,190,.55)'; g.strokeStyle = 'rgba(90,58,24,.8)'; g.lineWidth = Math.max(1, r * .14); g.setLineDash([r * .35, r * .25]);
  g.beginPath(); g.arc(x, y, r * 1.15, 0, Math.PI * 2); g.fill(); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#6b4320'; g.fillRect(x - r * .1, y - r * .55, r * .2, r * 1.25);
  g.translate(x, y - r * .45); g.rotate(angle);
  g.beginPath(); g.moveTo(-r * .7, -r * .28); g.lineTo(r * .45, -r * .28); g.lineTo(r * .8, 0); g.lineTo(r * .45, r * .28); g.lineTo(-r * .7, r * .28); g.closePath();
  g.fillStyle = '#e2b469'; g.fill(); g.strokeStyle = '#3a2612'; g.lineWidth = Math.max(1, r * .14); g.stroke();
  g.restore();
}
export function playerMark(g, x, y, r, yaw) {
  g.save(); g.translate(x, y); g.rotate(Math.PI - yaw);
  g.shadowColor = 'rgba(255,240,180,.9)'; g.shadowBlur = r * 1.2;
  g.beginPath(); g.moveTo(0, -r * 1.25); g.lineTo(r * .95, r * .95); g.lineTo(0, r * .45); g.lineTo(-r * .95, r * .95); g.closePath();
  g.fillStyle = '#fff4cf'; g.fill(); g.shadowBlur = 0;
  g.strokeStyle = INK; g.lineWidth = Math.max(1.2, r * .22); g.lineJoin = 'round'; g.stroke();
  g.beginPath(); g.moveTo(0, -r * .7); g.lineTo(r * .42, r * .55); g.lineTo(0, r * .28); g.closePath(); g.fillStyle = '#d9a440'; g.fill();
  g.restore();
}
export function monsterMark(g, x, y, r, elite = false) {
  g.save();
  if (elite) { g.strokeStyle = 'rgba(255,90,60,.8)'; g.lineWidth = Math.max(1, r * .3); g.beginPath(); g.arc(x, y, r * 1.7, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = elite ? '#ff4a2e' : '#d8332a'; g.strokeStyle = '#2a0a06'; g.lineWidth = Math.max(1, r * .35);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
}
export function npcDot(g, x, y, r, kind = 'npc') {
  g.save(); g.lineWidth = Math.max(.8, r * .45); g.strokeStyle = 'rgba(40,26,10,.85)';
  if (kind === 'guard') { g.fillStyle = '#9fc0e6'; g.beginPath(); g.moveTo(x, y - r * 1.3); g.lineTo(x + r * 1.1, y); g.lineTo(x, y + r * 1.3); g.lineTo(x - r * 1.1, y); g.closePath(); }
  else { g.fillStyle = '#fff3d2'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
  g.fill(); g.stroke(); g.restore();
}
// Small arrow on the minimap edge pointing at something off-screen.
export function edgeArrow(g, x, y, angle, r, color) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * .6, r * .75); g.lineTo(-r * .25, 0); g.lineTo(-r * .6, -r * .75); g.closePath();
  g.fillStyle = color; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1, r * .2); g.stroke(); g.restore();
}
// Eight-point compass rose; `north` label in Thai-gold.
export function compassRose(g, x, y, r, night = 0) {
  g.save(); g.translate(x, y);
  g.globalAlpha = .92;
  g.fillStyle = night ? 'rgba(20,28,48,.55)' : 'rgba(245,232,200,.7)'; g.beginPath(); g.arc(0, 0, r * 1.05, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a6328'; g.lineWidth = Math.max(1, r * .06); g.stroke();
  g.beginPath(); g.arc(0, 0, r * .82, 0, Math.PI * 2); g.stroke();
  const point = (len, wide, a, light, dark) => {
    g.save(); g.rotate(a);
    g.fillStyle = light; g.beginPath(); g.moveTo(0, -len); g.lineTo(wide, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    g.fillStyle = dark; g.beginPath(); g.moveTo(0, -len); g.lineTo(-wide, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    g.restore();
  };
  for (let i = 0; i < 4; i++) point(r * .62, r * .14, Math.PI / 4 + i * Math.PI / 2, '#d8b56a', '#8a6328');
  for (let i = 0; i < 4; i++) point(r * .98, r * .2, i * Math.PI / 2, i === 0 ? '#e0533a' : '#f1d58f', i === 0 ? '#9a2a1c' : '#7b5520');
  g.fillStyle = '#3a2612'; g.beginPath(); g.arc(0, 0, r * .1, 0, Math.PI * 2); g.fill();
  g.restore();
}
// Map label: serif text with a paper halo so it reads over any ground.
export function label(g, text, x, y, size, { color = '#3a2612', halo = 'rgba(246,236,208,.85)', weight = 500, serif = true, align = 'center' } = {}) {
  g.save(); g.font = `${weight} ${size}px ${serif ? '"Noto Serif Thai", serif' : '"Noto Sans Thai", sans-serif'}`;
  g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = halo; g.lineWidth = Math.max(2, size * .32); g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y); g.restore();
}
// Draws one legend/marker kind at (x, y), radius r (used by the legend too).
export function markerSample(g, kind, x, y, r) {
  if (kind === 'player') playerMark(g, x, y, r * .9, Math.PI);
  else if (kind === 'portal') portalMark(g, x, y, r * .7);
  else if (kind === 'path') pathMark(g, x, y + r * .15, r * .75);
  else if (kind === 'quest') questMark(g, x, y, r * .8, '!');
  else if (kind === 'landmark') badge(g, x, y, r * .85, 'story');
  else if (kind === 'unknown') unknownMark(g, x, y, r * .8);
  else if (kind === 'hall') badge(g, x, y, r * .85, 'class:muaythai', 'hall');
  else if (kind === 'shop') badge(g, x, y, r * .8, 'trade', 'shop');
  else if (kind === 'guard') { npcDot(g, x - r * .5, y, r * .35, 'guard'); npcDot(g, x + r * .5, y, r * .3); }
  else if (kind === 'monster') monsterMark(g, x, y, r * .4);
}
