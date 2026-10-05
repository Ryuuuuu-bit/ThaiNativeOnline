// Sprite-based combat feedback: enemy name/HP billboards, floating numbers,
// target selection ring and ground pulses. Sprites always face the camera,
// which suits the orthographic 2.5D view.
import * as THREE from 'three';

const FONT = "'Noto Sans Thai', sans-serif";
const OVERLAY = 20; // renderOrder for things drawn over the world

function canvasSprite(width, height, worldWidth) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(worldWidth, worldWidth * height / width, 1);
  sprite.renderOrder = OVERLAY;
  return { sprite, canvas, ctx: canvas.getContext('2d'), texture };
}

/** Name + HP bar above an enemy. Redraws only when its inputs change. */
export function createHpBillboard(enemy) {
  const { sprite, canvas, ctx, texture } = canvasSprite(256, 80, 3.2);
  let key = '';
  function draw(targeted) {
    const ratio = enemy.maxHp ? enemy.hp / enemy.maxHp : 0;
    const next = `${Math.ceil(enemy.hp)}|${targeted}`;
    if (next === key) return;
    key = next;
    const def = enemy.def, w = canvas.width;
    ctx.clearRect(0, 0, w, canvas.height);
    ctx.font = `600 27px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = '#0d1a14d0';
    const label = `${def.name}  Lv.${def.level}`;
    ctx.strokeText(label, w / 2, 30);
    ctx.fillStyle = def.elite ? '#ffcf6b' : targeted ? '#fff3cf' : '#efe6c8';
    ctx.fillText(label, w / 2, 30);
    // bar
    const bx = 24, by = 46, bw = w - 48, bh = 18;
    ctx.fillStyle = '#0d1a14d8'; ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = '#3a2a22'; ctx.fillRect(bx, by, bw, bh);
    const grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, '#e9785b'); grad.addColorStop(1, '#a83a2c');
    ctx.fillStyle = grad; ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = targeted ? '#f1d48c' : '#cdb77a80'; ctx.lineWidth = 2; ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
    texture.needsUpdate = true;
  }
  return { sprite, draw, dispose() { texture.dispose(); sprite.material.dispose(); } };
}

const NUMBER_STYLES = {
  dealt: { fill: '#fff6dc', stroke: '#3a2412', size: 46 },
  crit: { fill: '#ffcf4a', stroke: '#5a2208', size: 60 },
  taken: { fill: '#ff8a72', stroke: '#3d0e08', size: 46 },
  heal: { fill: '#a8f0a0', stroke: '#173b19', size: 48 },
};

/** Pooled rising/fading numbers. spawn(text, style, position: Vector3). */
export function createFloatingText(scene, poolSize = 24) {
  const pool = [];
  for (let i = 0; i < poolSize; i++) {
    const item = canvasSprite(256, 96, 3.4);
    item.sprite.visible = false;
    item.life = 0;
    item.velocity = new THREE.Vector3();
    scene.add(item.sprite);
    pool.push(item);
  }
  let cursor = 0;
  return {
    spawn(text, styleName, position) {
      const item = pool.find(p => p.life <= 0) ?? pool[cursor++ % pool.length];
      const style = NUMBER_STYLES[styleName] ?? NUMBER_STYLES.dealt;
      const { ctx, canvas } = item;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `700 ${style.size}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = style.stroke;
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      ctx.fillStyle = style.fill; ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      item.texture.needsUpdate = true;
      item.sprite.position.copy(position);
      item.sprite.position.x += (Math.random() - 0.5) * 0.5;
      item.velocity.set((Math.random() - 0.5) * 0.4, 1.6, 0);
      item.maxLife = styleName === 'crit' ? 1.1 : 0.9;
      item.life = item.maxLife;
      item.baseScale = styleName === 'crit' ? 4.2 : 3.4;
      item.sprite.visible = true;
    },
    update(dt) {
      for (const item of pool) {
        if (item.life <= 0) continue;
        item.life -= dt;
        if (item.life <= 0) { item.sprite.visible = false; continue; }
        const t = 1 - item.life / item.maxLife;
        item.sprite.position.addScaledVector(item.velocity, dt);
        item.velocity.y *= 1 - dt * 2.5;
        item.sprite.material.opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        const pop = t < 0.12 ? 1 + (0.12 - t) * 3 : 1;
        const s = item.baseScale * pop;
        item.sprite.scale.set(s, s * 96 / 256, 1);
      }
    },
  };
}

/** Pulsing double ring on the ground under the current target. */
export function createSelectionRing(scene) {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 48),
    new THREE.MeshBasicMaterial({ color: '#f1d48c', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 6, 1),
    new THREE.MeshBasicMaterial({ color: '#e5704f', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  for (const m of [outer, inner]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 2; group.add(m); }
  group.visible = false;
  scene.add(group);
  return {
    group,
    update(elapsed, x, y, z, size) {
      group.position.set(x, y + 0.05, z);
      const pulse = 1 + Math.sin(elapsed * 5) * 0.05;
      group.scale.setScalar(size * pulse);
      inner.rotation.z = elapsed * 0.8;
    },
  };
}

/** Expanding ground ring used for AoE swings, heals and deaths. */
export function createPulses(scene) {
  const geometry = new THREE.RingGeometry(0.85, 1, 48);
  const live = [];
  return {
    spawn(position, color, radius, duration = 0.5) {
      const mesh = new THREE.Mesh(geometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(position); mesh.position.y += 0.08;
      mesh.renderOrder = 3;
      scene.add(mesh);
      live.push({ mesh, radius, duration, t: 0 });
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.t += dt;
        const k = Math.min(1, p.t / p.duration);
        p.mesh.scale.setScalar(0.2 + p.radius * (1 - (1 - k) * (1 - k)));
        p.mesh.material.opacity = 0.85 * (1 - k);
        if (k >= 1) { scene.remove(p.mesh); p.mesh.material.dispose(); live.splice(i, 1); }
      }
    },
  };
}
