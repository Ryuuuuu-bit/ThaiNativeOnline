import { BOUNDS, ROADS, PLAZAS, PADDIES, CANAL, STREAM, POND, CEMETERY, WALL, roadPoints, riverBank, farBank } from '../world/CityMap.js';
import { LANDMARKS } from '../data/landmarks.js';

// A north-up map painted once from the city data. The minimap shows a window
// around the player; M opens the whole map. Hidden places appear only once found.
// Map hook (src/world/maps.js): `options.bounds` limits the painting to the
// current map, `options.landmarks` to its landmarks, and `options.portals` are
// drawn as exits labelled with the destination. `options.discovered` lets the
// discovered set outlive a map change.
const S = 2;
let BOUNDS_ = BOUNDS, W = 0, H = 0;
const px = x => (x - BOUNDS_.minX) * S, pz = z => (z - BOUNDS_.minZ) * S;
const AREAS = [
  { name: 'แม่น้ำเจ้าพระยา', x: 0, z: 205 }, { name: 'ท่าเรือ', x: 6, z: 152 }, { name: 'ตลาด', x: 0, z: 28 }, { name: 'วัด', x: 63, z: -60 },
  { name: 'ย่านบ้านเรือน', x: -62, z: -60 },
];

export class Minimap {
  constructor(canvas, fullCanvas, footprints, { bounds = BOUNDS, landmarks = LANDMARKS, portals = [], discovered = new Set() } = {}) {
    this.bounds = bounds; this.landmarks = landmarks; this.portals = portals;
    this.use();
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.full = fullCanvas;
    this.base = document.createElement('canvas'); this.base.width = W; this.base.height = H;
    this.paint(this.base.getContext('2d'), footprints);
    this.discovered = discovered;
  }
  use() { BOUNDS_ = this.bounds; W = (BOUNDS_.maxX - BOUNDS_.minX) * S; H = (BOUNDS_.maxZ - BOUNDS_.minZ) * S; }
  paint(g, footprints) {
    const grad = g.createLinearGradient(0, pz(BOUNDS.minZ), 0, pz(BOUNDS.maxZ));
    for (const [z, c] of [[-610, '#1f2c22'], [-470, '#26362a'], [-360, '#33473a'], [-300, '#4b5f41'], [-256, '#5e7048'], [-112, '#617350'], [-108, '#76765a'], [170, '#7a785c']]) grad.addColorStop((z - BOUNDS.minZ) / (BOUNDS.maxZ - BOUNDS.minZ), c);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const line = (pts, width, color) => { g.strokeStyle = color; g.lineWidth = width * S; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z)))); g.stroke(); };
    g.fillStyle = '#5f8a86'; g.beginPath(); g.moveTo(0, H);
    for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 2) g.lineTo(px(x), pz(riverBank(x)));
    for (let x = BOUNDS.maxX; x >= BOUNDS.minX; x -= 2) g.lineTo(px(x), pz(farBank(x)));
    g.closePath(); g.fill();
    g.fillStyle = '#4c6a45'; for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 2) g.fillRect(px(x), pz(farBank(x)), 2 * S, H);
    for (const p of PADDIES) { g.fillStyle = p.state === 'ripe' ? '#9c9a52' : '#6f8a52'; g.fillRect(px(p.x0), pz(p.z0), (p.x1 - p.x0) * S, (p.z1 - p.z0) * S); }
    line(CANAL.pts, CANAL.half * 2, '#5f8a86'); line(STREAM.pts, STREAM.half * 2, '#4c6e6a');
    g.fillStyle = '#5f8a86'; g.beginPath(); g.ellipse(px(POND.x), pz(POND.z), POND.rx * S, POND.rz * S, 0, 0, Math.PI * 2); g.fill();
    for (const p of PLAZAS) {
      if (p.kind === 'grave') continue;
      g.fillStyle = p.kind === 'temple' ? '#a59a74' : '#a99c76';
      if (p.rect) g.fillRect(px(p.x - p.rx), pz(p.z - p.rz), p.rx * 2 * S, p.rz * 2 * S);
      else { g.beginPath(); g.ellipse(px(p.x), pz(p.z), p.rx * S, p.rz * S, 0, 0, Math.PI * 2); g.fill(); }
    }
    for (const r of ROADS) if (r.kind !== 'bridge' && r.kind !== 'plaza') line(roadPoints(r), Math.max(1.6, r.w * .7), r.kind === 'trail' ? '#6d6a50' : r.kind === 'bund' ? '#8e9466' : '#c3b48a');
    for (const f of footprints) {
      g.save(); g.translate(px(f.x), pz(f.z)); g.rotate(-f.rot); g.fillStyle = f.paint === 'stone' ? '#8b5a44' : '#6a5038';
      g.fillRect(-f.w / 2 * S * .8, -f.d / 2 * S * .8, f.w * S * .8, f.d * S * .8); g.restore();
    }
    line([[-WALL.x, WALL.z], [WALL.x, WALL.z]], 2, '#8b5a44');
    for (const s of [-1, 1]) line([[s * WALL.x, WALL.z], [s * WALL.x, riverBank(s * WALL.x) - 3]], 2, '#8b5a44');
  }
  drawCemetery(g, scale, ox, oz) {
    if (!this.discovered.has('cemetery')) return;
    g.fillStyle = '#4c5048'; g.strokeStyle = '#9aa29a'; g.lineWidth = 1;
    g.beginPath(); g.arc(ox(CEMETERY.x), oz(CEMETERY.z), CEMETERY.r * scale, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  drawMarkers(g, scale, ox, oz, labels) {
    this.drawCemetery(g, scale, ox, oz);
    for (const p of this.portals) {
      const m = p.marker ?? p.at, x = ox(m.x), y = oz(m.z);
      g.strokeStyle = '#ffd98a'; g.fillStyle = 'rgba(255,214,130,.3)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, labels ? 7 : 5, 0, Math.PI * 2); g.fill(); g.stroke();
      if (labels) { g.font = '12px "Noto Sans Thai", sans-serif'; g.fillStyle = '#ffe7a8'; g.textAlign = 'left'; g.fillText(`ทางออก → ${p.toName ?? p.to}`, x + 12, y); g.textAlign = 'center'; }
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of this.landmarks) {
      const found = this.discovered.has(l.id);
      if (l.hidden && !found) continue;
      const x = ox(l.x), y = oz(l.z);
      if (x < -10 || y < -10 || x > g.canvas.width + 10 || y > g.canvas.height + 10) continue;
      g.font = `${labels ? 12 : 10}px sans-serif`; g.fillStyle = found ? '#ffe7a8' : 'rgba(230,220,190,.45)';
      g.fillText(found ? l.icon : '·', x, y);
      if (labels && found) { g.font = '11px "Noto Sans Thai", sans-serif'; g.fillStyle = '#f3ead0'; g.fillText(l.name, x, y + 12); }
    }
  }
  drawPlayer(g, x, y, yaw) {
    g.save(); g.translate(x, y); g.rotate(Math.PI - yaw);
    g.fillStyle = '#fff1b7'; g.shadowColor = '#fff2b8'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.restore();
  }
  update(p, yaw) {
    this.use();
    const g = this.ctx, cw = this.canvas.width, ch = this.canvas.height, viewW = 150, scale = cw / viewW, viewH = ch / scale;
    g.fillStyle = '#1b2a22'; g.fillRect(0, 0, cw, ch);
    g.drawImage(this.base, px(p.x - viewW / 2), pz(p.z - viewH / 2), viewW * S, viewH * S, 0, 0, cw, ch);
    const ox = x => (x - p.x) * scale + cw / 2, oz = z => (z - p.z) * scale + ch / 2;
    this.drawMarkers(g, scale, ox, oz, false);
    this.drawPlayer(g, cw / 2, ch / 2, yaw);
  }
  drawFull(p, yaw) {
    this.use();
    const B = this.bounds, c = this.full, g = c.getContext('2d'), scale = Math.min(c.height / (B.maxZ - B.minZ), c.width / (B.maxX - B.minX));
    const w = (B.maxX - B.minX) * scale, h = (B.maxZ - B.minZ) * scale, left = (c.width - w) / 2, top = (c.height - h) / 2;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(this.base, left, top, w, h);
    const ox = x => left + (x - B.minX) * scale, oz = z => top + (z - B.minZ) * scale;
    g.font = '12px "Noto Serif Thai", serif'; g.fillStyle = 'rgba(255,245,220,.6)'; g.textAlign = 'center';
    for (const a of AREAS) if (a.z > B.minZ && a.z < B.maxZ && !this.landmarks.some(l => this.discovered.has(l.id) && Math.hypot(l.x - a.x, l.z - a.z) < 28)) g.fillText(a.name, ox(a.x), oz(a.z));
    this.drawMarkers(g, scale, ox, oz, true);
    this.drawPlayer(g, ox(p.x), oz(p.z), yaw);
  }
}
