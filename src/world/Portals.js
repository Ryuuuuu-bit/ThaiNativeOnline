import * as THREE from 'three';
import { MAPS } from './maps.js';

// Visible exits: a soft glowing ring on the ground where a portal begins and a
// floating label with the destination name. Built per map under its root, so
// the map's dispose() frees them.
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 18, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,226,150,0)'); grad.addColorStop(.62, 'rgba(255,226,150,.18)');
  grad.addColorStop(.8, 'rgba(255,232,170,.95)'); grad.addColorStop(1, 'rgba(255,226,150,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function labelTexture(title, destination) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,41,32,.78)'; g.strokeStyle = 'rgba(214,188,117,.7)'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(8, 18, 496, 124, 14); g.fill(); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d6bc75'; g.font = '30px "Noto Sans Thai", sans-serif'; g.fillText(title, 256, 56);
  g.fillStyle = '#fff1c8'; g.font = '500 44px "Noto Serif Thai", serif'; g.fillText(`→ ${destination}`, 256, 104);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Portals {
  constructor(root, map, heightAt) {
    this.items = [];
    const ring = ringTexture();
    for (const portal of map.portals) {
      const m = portal.marker ?? portal.at, y = heightAt(m.x, m.z);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
        map: ring, color: '#ffd98a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      ground.position.set(m.x, y + .06, m.z); ground.renderOrder = 3;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(portal.name, MAPS[portal.to].name), transparent: true, depthTest: false, fog: false }));
      label.scale.set(5.6, 1.75, 1); label.position.set(m.x, y + 3.1, m.z); label.renderOrder = 12;
      root.add(ground, label);
      this.items.push({ ground, label, y });
    }
  }
  update(t) {
    for (const { ground, label, y } of this.items) {
      ground.material.opacity = .55 + .3 * Math.sin(t * 2.2);
      ground.scale.setScalar(1 + .05 * Math.sin(t * 1.6));
      label.position.y = y + 3.1 + Math.sin(t * 1.3) * .08;
    }
  }
}
