import * as THREE from 'three';
import { MAPS } from './maps.js';

// Portal markers, by `portal.style` (src/world/maps.js):
// - 'warp' (default), the ประตูวาป: a glowing ground ring, a slowly turning ring
//   of yantra marks, a translucent veil of light rising from it and a floating
//   label with the destination name. Six meshes per portal, all additive and
//   unlit, so they stay cheap and read at night as well as by day.
// - 'path', a trail exit between wild maps: chevrons on the ground and a
//   wooden signpost (see below).
// Built per map under its root, so the map's dispose() frees them.
function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ringTexture = () => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 18, s / 2, s / 2, 62);
  grad.addColorStop(0, 'rgba(255,226,150,0)'); grad.addColorStop(.62, 'rgba(255,226,150,.18)');
  grad.addColorStop(.8, 'rgba(255,232,170,.95)'); grad.addColorStop(1, 'rgba(255,226,150,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});
// A circle of small yantra marks (อักขระ-like strokes) between two thin rings.
const runeTexture = () => canvasTexture(256, (g, s) => {
  const c = s / 2;
  g.strokeStyle = 'rgba(190,240,255,.95)'; g.lineWidth = 3;
  for (const r of [96, 120]) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    g.save(); g.translate(c + Math.cos(a) * 108, c + Math.sin(a) * 108); g.rotate(a + Math.PI / 2);
    g.beginPath();
    if (i % 2) { g.moveTo(-5, -6); g.lineTo(5, -6); g.moveTo(0, -6); g.lineTo(0, 6); }
    else { g.arc(0, 0, 5, 0, Math.PI * 1.5); g.moveTo(5, 0); g.lineTo(5, 6); }
    g.stroke(); g.restore();
  }
});
// Vertical fade for the veil: bright at the ground, gone at the top, with soft streaks.
const veilTexture = () => canvasTexture(64, (g, s) => {
  const grad = g.createLinearGradient(0, s, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(.35, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(0,0,0,${.25 + (i % 3) * .2})`; g.fillRect(i * 7 + 2, 0, 3, s); }
});
function labelTexture(title, destination) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,41,32,.78)'; g.strokeStyle = 'rgba(214,188,117,.7)'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(8, 18, 496, 124, 14); g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#9fe6ff'; g.font = '30px "Noto Sans Thai", sans-serif'; g.fillText(title, 256, 56);
  g.fillStyle = '#fff1c8'; g.font = '500 44px "Noto Serif Thai", serif'; g.fillText(`→ ${destination}`, 256, 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowMaterial = (map, color, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side,
});


// ---- Path exits (style 'path'): the trail itself leads on to the next map ----
// A trodden patch with three faint chevrons pointing out of the map at `at`, and
// a wooden signpost at `marker` with a board label "→ <destination>". Three
// meshes and one sprite, lit like the scenery except the label (unlit, so it
// reads at night).
const chevronTexture = () => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 6, s / 2, s / 2, 62);
  grad.addColorStop(0, 'rgba(255,236,190,.42)'); grad.addColorStop(.7, 'rgba(255,236,190,.16)'); grad.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,244,214,.95)'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  // Chevrons point toward -y of the canvas, i.e. local -z after the plane is laid flat.
  for (const y of [40, 64, 88]) { g.beginPath(); g.moveTo(40, y + 14); g.lineTo(64, y - 6); g.lineTo(88, y + 14); g.stroke(); }
});
function signTexture(title, destination) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(92,64,38,.92)'; g.strokeStyle = 'rgba(48,32,18,.95)'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(10, 20, 492, 120, 10); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(140,104,66,.55)'; g.lineWidth = 2;
  for (const y of [52, 84, 116]) { g.beginPath(); g.moveTo(24, y); g.lineTo(488, y + 3); g.stroke(); }  // wood grain
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#e9d7ad'; g.font = '28px "Noto Sans Thai", sans-serif'; g.fillText(title, 256, 54);
  g.fillStyle = '#fff3d2'; g.font = '500 44px "Noto Serif Thai", serif'; g.fillText(`→ ${destination}`, 256, 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Direction out of the map: toward the nearest edge of the walk bounds.
function exitYaw(map, at) {
  const b = { minX: Math.min(...map.walk.map(r => r.minX)), maxX: Math.max(...map.walk.map(r => r.maxX)), minZ: Math.min(...map.walk.map(r => r.minZ)), maxZ: Math.max(...map.walk.map(r => r.maxZ)) };
  const edges = [[at.z - b.minZ, Math.PI], [b.maxZ - at.z, 0], [at.x - b.minX, -Math.PI / 2], [b.maxX - at.x, Math.PI / 2]];
  return edges.sort((a, b2) => a[0] - b2[0])[0][1];
}

export class Portals {
  constructor(root, map, heightAt) {
    this.items = []; this.paths = [];
    if (!map.portals.length) return;
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    let ring, rune, veil, chevron, wood;
    for (const portal of map.portals) {
      if (portal.style === 'path') {
        chevron ??= chevronTexture(); wood ??= new THREE.MeshLambertMaterial({ color: '#5b4330' });
        const at = portal.at, r = at.radius ?? 2.4, yaw = exitYaw(map, at);
        // Chevrons on the ground, pointing out of the map (local -z → exit yaw).
        const ground = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: chevron, color: '#ffe6b0', transparent: true, depthWrite: false, fog: false }));
        ground.scale.setScalar(r * 1.9); ground.rotation.y = yaw + Math.PI; ground.renderOrder = 3;
        ground.position.set(at.x, heightAt(at.x, at.z) + .05, at.z);
        // Signpost beside the trail.
        const m = portal.marker ?? { x: at.x + r + 1.2, z: at.z }, y = heightAt(m.x, m.z);
        const sign = new THREE.Group(); sign.position.set(m.x, y, m.z); sign.rotation.y = yaw;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 2.5, 6), wood); post.position.y = 1.25;
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, .38, .06), wood); board.position.set(0, 2.05, .5); board.rotation.y = Math.PI / 2;  // the board points toward the exit
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(portal.name, MAPS[portal.to].name), transparent: true, depthTest: false, fog: false }));
        label.scale.set(4.6, 1.44, 1); label.position.y = 3.4; label.renderOrder = 12;
        for (const o of [post, board]) { o.castShadow = true; o.receiveShadow = true; }
        sign.add(post, board, label);
        root.add(ground, sign);
        this.paths.push({ ground, label });
        continue;
      }
      ring ??= ringTexture(); rune ??= runeTexture(); veil ??= veilTexture();
      const m = portal.marker ?? portal.at, y = heightAt(m.x, m.z), r = portal.at.radius ?? 2.2;
      const group = new THREE.Group(); group.position.set(m.x, y, m.z);
      const ground = new THREE.Mesh(flat, glowMaterial(ring, '#ffd98a'));
      ground.scale.setScalar(r * 2.8); ground.position.y = .06; ground.renderOrder = 3;
      const runes = new THREE.Mesh(flat, glowMaterial(rune, '#8fdcff'));
      runes.scale.setScalar(r * 2.1); runes.position.y = .09; runes.renderOrder = 4;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(r * .78, r * .9, 3.4, 28, 1, true), glowMaterial(veil, '#7fd6ff', THREE.DoubleSide));
      column.position.y = 1.7; column.renderOrder = 5;
      const inner = new THREE.Mesh(column.geometry, glowMaterial(veil, '#ffe2a0', THREE.DoubleSide));
      inner.scale.set(.62, .8, .62); inner.position.y = 1.36; inner.renderOrder = 5;
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, color: '#bfeaff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      light.scale.set(r * 1.6, r * 1.6, 1); light.position.y = 1.1;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(portal.name, MAPS[portal.to].name), transparent: true, depthTest: false, fog: false }));
      label.scale.set(5.6, 1.75, 1); label.position.y = 4.2; label.renderOrder = 12;
      group.add(ground, runes, column, inner, light, label);
      root.add(group);
      this.items.push({ ground, runes, column, inner, light, label });
    }
  }
  update(t) {
    for (const { ground, runes, column, inner, light, label } of this.items) {
      ground.material.opacity = .6 + .3 * Math.sin(t * 2.2);
      runes.rotation.y = t * .35;
      runes.material.opacity = .65 + .25 * Math.sin(t * 1.7 + 1);
      column.rotation.y = -t * .5; inner.rotation.y = t * .8;
      column.material.opacity = .55 + .2 * Math.sin(t * 2.6);
      inner.material.opacity = .45 + .25 * Math.sin(t * 3.1 + 2);
      light.material.opacity = .5 + .3 * Math.sin(t * 2.2 + .5);
      label.position.y = 4.2 + Math.sin(t * 1.3) * .08;
    }
    for (const { ground } of this.paths) ground.material.opacity = .55 + .25 * Math.sin(t * 1.6);
  }
}
