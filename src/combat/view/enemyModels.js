// Geometry-built stylized enemy meshes (no external assets). Each builder
// returns parts the view animates. Models face +Z, feet at y = 0, and are
// scaled by def.size.
import * as THREE from 'three';

function part(geometry, material, parent, [x, y, z] = [0, 0, 0], scale, rotation) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

function monkey(p, body) {
  const fur = standard(p.fur), dark = standard(p.furDark), face = standard(p.face), eye = standard(p.eye, { roughness: 0.3 });
  part(new THREE.SphereGeometry(0.3, 12, 10), fur, body, [0, 0.55, 0], [1, 1.15, 0.9]);
  part(new THREE.SphereGeometry(0.22, 12, 10), face, body, [0, 0.52, 0.12], [1, 1.1, 0.6]);
  const head = new THREE.Group(); head.position.set(0, 0.98, 0.05); body.add(head);
  part(new THREE.SphereGeometry(0.22, 12, 10), fur, head);
  part(new THREE.SphereGeometry(0.15, 12, 8), face, head, [0, -0.03, 0.12], [1.1, 0.9, 0.7]);
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.075, 8, 6), face, head, [s * 0.22, 0.03, 0], [0.5, 1, 1]);
    part(new THREE.SphereGeometry(0.03, 6, 6), eye, head, [s * 0.065, 0.04, 0.2]);
    // arms & legs
    const arm = part(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 6), dark, body, [s * 0.3, 0.55, 0.05], null, [0.3, 0, s * 0.35]);
    arm.userData.swing = s;
    part(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 6), dark, body, [s * 0.14, 0.17, 0], null, [0, 0, 0]).userData.swing = -s;
  }
  // curled tail
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 16, Math.PI * 1.4), dark);
  tail.position.set(0, 0.55, -0.32); tail.rotation.set(0, Math.PI / 2, 0.4); tail.castShadow = true; body.add(tail);
  return { height: 1.25, glowMaterials: [] };
}

function spirit(p, body) {
  const robe = standard(p.robe, { transparent: true, opacity: 0.82, emissive: p.glow, emissiveIntensity: 0.35 });
  const shade = standard(p.shade, { transparent: true, opacity: 0.7 });
  const eye = new THREE.MeshBasicMaterial({ color: p.eye });
  part(new THREE.ConeGeometry(0.42, 1.1, 14, 1, true), robe, body, [0, 0.55, 0]);
  part(new THREE.SphereGeometry(0.26, 14, 10), robe, body, [0, 1.18, 0]);
  part(new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), shade, body, [0, 1.22, -0.02]); // hood
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.045, 8, 6), eye, body, [s * 0.09, 1.2, 0.22], [1, 1.4, 1]);
    const sleeve = part(new THREE.ConeGeometry(0.1, 0.55, 8, 1, true), robe, body, [s * 0.35, 0.85, 0.05], null, [0, 0, s * 0.7]);
    sleeve.userData.swing = s;
  }
  // tattered wisps trailing below
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    part(new THREE.ConeGeometry(0.08, 0.35, 5), robe, body, [Math.cos(a) * 0.3, -0.08, Math.sin(a) * 0.3], null, [Math.PI, 0, 0]);
  }
  return { height: 1.45, hover: 0.35, glowMaterials: [robe] };
}

function tiger(p, body) {
  const fur = standard(p.fur), stripe = standard(p.stripe), belly = standard(p.belly);
  const eye = new THREE.MeshBasicMaterial({ color: p.eye });
  part(new THREE.CapsuleGeometry(0.26, 0.75, 6, 12), fur, body, [0, 0.62, 0], null, [Math.PI / 2, 0, 0]);
  part(new THREE.CapsuleGeometry(0.2, 0.6, 4, 10), belly, body, [0, 0.52, 0.02], [0.95, 1, 0.9], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) // stripes across the back
    part(new THREE.TorusGeometry(0.265, 0.025, 4, 14, Math.PI), stripe, body, [0, 0.64, -0.36 + i * 0.22], null, [0, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.6); body.add(head);
  part(new THREE.SphereGeometry(0.25, 14, 12), fur, head, [0, 0, 0], [1.05, 0.95, 1]);
  part(new THREE.SphereGeometry(0.14, 10, 8), belly, head, [0, -0.07, 0.17], [1.1, 0.8, 0.8]);
  part(new THREE.BoxGeometry(0.03, 0.12, 0.02), stripe, head, [0, 0.15, 0.2]);
  for (const s of [-1, 1]) {
    part(new THREE.ConeGeometry(0.08, 0.13, 6), fur, head, [s * 0.16, 0.22, -0.03]);
    part(new THREE.SphereGeometry(0.035, 8, 6), eye, head, [s * 0.1, 0.05, 0.21], [1.3, 0.8, 1]);
    part(new THREE.BoxGeometry(0.02, 0.09, 0.02), stripe, head, [s * 0.2, 0.08, 0.1], null, [0, 0, s * 0.6]);
    for (const zz of [0.38, -0.38]) {
      const leg = part(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 7), fur, body, [s * 0.16, 0.21, zz]);
      leg.userData.swing = zz > 0 ? s : -s;
      part(new THREE.SphereGeometry(0.08, 8, 6), belly, leg, [0, -0.2, 0.03], [1, 0.6, 1.3]);
    }
  }
  const tail = part(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6), fur, body, [0, 0.82, -0.68], null, [-0.9, 0, 0]);
  part(new THREE.SphereGeometry(0.06, 6, 6), stripe, tail, [0, 0.36, 0]);
  // spectral aura marks it as an elite / shapeshifter
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; aura.userData.aura = true; body.add(aura);
  return { height: 1.15, glowMaterials: [] };
}

const builders = { monkey, spirit, tiger };

/**
 * @returns {{ root: THREE.Group, body: THREE.Group, hitbox: THREE.Mesh, materials: THREE.Material[],
 *             swingers: THREE.Object3D[], height: number, hover: number }}
 */
export function buildEnemyModel(def) {
  const root = new THREE.Group();
  root.name = `enemy:${def.id}`;
  const scaled = new THREE.Group();
  scaled.scale.setScalar(def.size);
  root.add(scaled);
  const body = new THREE.Group();
  scaled.add(body);
  const info = (builders[def.model] ?? monkey)(def.palette, body);

  const materials = new Set(), swingers = [];
  body.traverse(o => {
    if (o.isMesh && o.material?.isMeshStandardMaterial) materials.add(o.material);
    if (o.userData.swing) swingers.push(o);
  });
  for (const m of materials) {
    m.userData.baseEmissive = m.emissive.clone();
    m.userData.baseEmissiveIntensity = m.emissiveIntensity;
  }

  const height = info.height * def.size;
  const radius = 0.55 * def.size;
  const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height + 0.3, 10),
    new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = height / 2;
  root.add(hitbox);

  return { root, body, hitbox, materials: [...materials], swingers, height, hover: (info.hover ?? 0) * def.size };
}
