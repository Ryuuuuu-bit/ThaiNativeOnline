import * as THREE from 'three';
import { BOSS_SKILL_HINTS } from './bossSkills.js';
import { makeBossSkillVFX } from './BossSkillVFX.js';

const dangerColor = new THREE.Color('#e27664');
const warningInk = new THREE.Color('#b74132');

// Gameplay warnings remain visible with particles disabled. Their footprint is
// the shared hit geometry, sampled onto the terrain so hills cannot hide them.
export class BossTelegraphs {
  constructor(parent, heightAt) { this.parent = parent; this.heightAt = heightAt; this.items = new Map(); }
  clear(id = null) {
    for (const [key, item] of this.items) {
      if (id !== null && key !== id) continue;
      item.group.removeFromParent();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      item.group.traverse(o => {
        if (o.isInstancedMesh) o.dispose();
        if (o.geometry) geometries.add(o.geometry);
        for (const material of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) {
          materials.add(material); if (material.map) textures.add(material.map);
        }
      });
      geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
      this.items.delete(key);
    }
  }
  event({ monster, stage, cast }) {
    const active = this.items.get(monster.id);
    if (stage !== 'windup' && active && active.serial !== cast.serial) return;
    this.clear(monster.id);
    if (stage === 'cancel') return;
    const group = new THREE.Group(), positions = [], indices = [], inner = [], outer = [];
    const segments = 64, from = cast.shape === 'cone' ? cast.facing - cast.angle / 2 : 0;
    const sweep = cast.shape === 'cone' ? cast.angle : Math.PI * 2;
    const innerRadius = cast.shape === 'ring' ? cast.innerRadius : 0;
    const radialSteps = Math.max(1, Math.ceil((cast.radius - innerRadius) / .6)), stride = radialSteps + 1;
    for (let i = 0; i <= segments; i++) {
      const angle = from + sweep * i / segments;
      for (let j = 0; j <= radialSteps; j++) {
        const radius = innerRadius + (cast.radius - innerRadius) * j / radialSteps;
        const x = cast.x + Math.sin(angle) * radius, z = cast.z + Math.cos(angle) * radius;
        const point = new THREE.Vector3(x, this.heightAt(x, z) + .12, z);
        positions.push(point.x, point.y, point.z);
        if (j === 0) inner.push(point);
        if (j === radialSteps) outer.push(point);
        if (i < segments && j < radialSteps) {
          const k = i * stride + j;
          indices.push(k, k + 1, k + stride, k + 1, k + stride + 1, k + stride);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    const color = new THREE.Color(cast.color).lerp(warningInk, .65);
    const fillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false });
    const fill = new THREE.Mesh(geometry, fillMaterial); fill.renderOrder = 4; group.add(fill);
    const outline = points => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#f4d490', transparent: true, opacity: .95, depthWrite: false }));
      line.renderOrder = 5; group.add(line); return line;
    };
    outline(outer);
    if (innerRadius) outline(inner);
    if (cast.shape === 'cone') { outline([inner[0], outer[0]]); outline([inner.at(-1), outer.at(-1)]); }
    const detail = makeBossSkillVFX(monster.type, cast, stage, this.heightAt);
    if (detail) group.add(detail);
    if (stage === 'windup') {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 128;
      const g = canvas.getContext('2d');
      g.fillStyle = '#15231fdd'; g.beginPath(); g.roundRect(4, 4, 632, 120, 18); g.fill();
      g.strokeStyle = '#e3bd76'; g.lineWidth = 3; g.stroke();
      g.textAlign = 'center'; g.fillStyle = '#ffdda1'; g.font = 'bold 32px sans-serif';
      g.fillText(cast.name + (cast.phase === 2 ? ' · ระยะ 2' : ''), 320, 50, 600);
      g.fillStyle = '#ffffff'; g.font = '25px sans-serif'; g.fillText(BOSS_SKILL_HINTS[cast.shape], 320, 94, 600);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
      label.position.set(cast.x, this.heightAt(cast.x, cast.z) + 5, cast.z); label.scale.set(9, 1.8, 1); label.renderOrder = 6; group.add(label);
    }
    this.parent.add(group);
    this.items.set(monster.id, { group, fill, color, detail, serial: cast.serial, stage, elapsed: 0,
      duration: stage === 'windup' ? Math.max(.05, cast.remaining ?? cast.windup) : .45 });
  }
  update(dt, player, selected = null) {
    for (const [id, item] of this.items) {
      item.elapsed += dt;
      const k = Math.min(1, item.elapsed / item.duration);
      item.detail?.userData.update(k);
      const pos = item.fill.geometry.attributes.position;
      const dx = pos.getX(0) - player.x, dz = pos.getZ(0) - player.z;
      item.group.visible = Math.hypot(dx, dz) < 70;
      // The selected boss's hint already lives in the compact target frame on
      // phones; don't leave a second huge label clipped above the camera.
      for (const child of item.group.children) if (child.isSprite) child.visible = !(selected === id && globalThis.document?.body?.classList.contains('ui-touch'));
      if (item.stage === 'windup') {
        item.fill.material.opacity = .3 + .1 * k;
        item.fill.material.color.lerpColors(item.color, dangerColor, k * .6);
        // Reaching the predicted end is not an impact: only the server can
        // confirm it. Expire shortly after to avoid a stale warning on packet loss.
        if (item.elapsed > item.duration + .8) this.clear(id);
      } else {
        item.fill.material.opacity = .42 * (1 - k);
        for (const child of item.group.children) if (child.isLine) child.material.opacity = 1 - k;
        if (k >= 1) this.clear(id);
      }
    }
  }
}
