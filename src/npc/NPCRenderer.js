import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All NPCs share ~30 instanced meshes (one per body part or prop) regardless
// of population size. Each part reads one of the NPC's frame matrices.
const merge = (...gs) => mergeGeometries(gs.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }), false);
const cyl = (rt, rb, h, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);

const hasProp = name => look => look.props.includes(name);
const PARTS = [
  { name: 'torso', geo: () => cyl(.16, .22, .47, 8).translate(0, .86, 0), frames: ['upper'], color: l => l.top ?? l.skin },
  { name: 'sash', geo: () => cyl(.225, .225, .1, 8).translate(0, .65, 0), frames: ['upper'], color: l => l.sash },
  { name: 'head', geo: () => new THREE.SphereGeometry(.2, 10, 8).scale(1, 1.12, 1), frames: ['head'], color: l => l.skin },
  { name: 'hair', geo: () => new THREE.SphereGeometry(.208, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55).translate(0, .06, -.015), frames: ['head'], color: l => l.hair, when: l => l.hairStyle !== 'shaved' },
  { name: 'bun', geo: () => new THREE.SphereGeometry(.085, 8, 6).translate(0, .2, -.15), frames: ['head'], color: l => l.hair, when: l => l.hairStyle === 'bun' },
  { name: 'leg', geo: () => cyl(.095, .075, .42).translate(0, -.2, 0), frames: ['legL', 'legR'], color: l => (l.skirt ? l.skin : l.bottom) },
  { name: 'foot', geo: () => new THREE.SphereGeometry(.09, 8, 6).scale(1, .5, 1.7).translate(0, -.45, .04), frames: ['legL', 'legR'], color: l => l.skin },
  { name: 'arm', geo: () => cyl(.075, .055, .4).translate(0, -.19, 0), frames: ['armL', 'armR'], color: l => (l.sleeves ? l.top : l.skin) },
  { name: 'skirt', geo: () => cyl(.2, .27, .5, 8).translate(0, .38, 0), frames: ['root'], color: l => l.skirt, when: l => !!l.skirt },
  { name: 'robeDrape', geo: () => new THREE.BoxGeometry(.05, .55, .3).rotateZ(.55).translate(-.08, .9, 0), frames: ['upper'], color: l => l.robe, when: l => !!l.robe },
  // Headwear.
  { name: 'ngob', geo: () => merge(new THREE.ConeGeometry(.44, .2, 12).translate(0, .3, 0), new THREE.CylinderGeometry(.1, .14, .1, 8).translate(0, .43, 0)), frames: ['head'], color: () => '#c9b07a', when: l => l.hat === 'ngob' },
  { name: 'helmet', geo: () => merge(new THREE.ConeGeometry(.2, .38, 8).translate(0, .38, 0), cyl(.215, .215, .08, 8).translate(0, .16, 0)), frames: ['head'], color: () => '#c9a35a', when: l => l.hat === 'helmet' },
  { name: 'headband', geo: () => new THREE.CylinderGeometry(.212, .212, .07, 12, 1, true).translate(0, .08, 0), frames: ['head'], color: l => (l.hat === 'headbandRed' ? '#a8432f' : '#e8e0cc'), when: l => l.hat === 'headband' || l.hat === 'headbandRed' },
  { name: 'mongkol', geo: () => new THREE.TorusGeometry(.21, .035, 5, 14).rotateX(Math.PI / 2).translate(0, .1, 0), frames: ['head'], color: () => '#ece4cf', when: l => l.hat === 'mongkol' },
  { name: 'clothHat', geo: () => new THREE.SphereGeometry(.23, 8, 5, 0, Math.PI * 2, 0, Math.PI * .45).translate(0, .08, 0), frames: ['head'], color: () => '#6b5338', when: l => l.hat === 'cloth' },
  // Props.
  { name: 'spear', geo: () => merge(cyl(.022, .022, 2.4, 5).translate(0, .3, .07), new THREE.ConeGeometry(.05, .26, 5).translate(0, 1.62, .07)), frames: ['armR'], color: () => '#6b5a45', when: hasProp('spear') },
  { name: 'hammer', geo: () => merge(cyl(.025, .025, .5, 5).rotateX(Math.PI / 2).translate(0, -.42, .2), new THREE.BoxGeometry(.18, .11, .11).translate(0, -.42, .44)), frames: ['armR'], color: () => '#4c4b48', when: hasProp('hammer') },
  { name: 'sword', geo: () => merge(new THREE.BoxGeometry(.04, .06, .95).translate(0, -.42, .56), new THREE.BoxGeometry(.14, .05, .05).translate(0, -.42, .08)), frames: ['armR'], color: () => '#b9bec1', when: hasProp('sword') },
  { name: 'knife', geo: () => new THREE.BoxGeometry(.03, .05, .4).translate(0, -.42, .22), frames: ['armR'], color: () => '#b9bec1', when: hasProp('knife') },
  { name: 'staff', geo: () => cyl(.025, .03, 1.9, 5).translate(0, -.1, .06), frames: ['armR'], color: () => '#7a5a3a', when: hasProp('staff') },
  { name: 'paddle', geo: () => merge(cyl(.025, .025, 1.7, 5).translate(0, -.2, .08), new THREE.BoxGeometry(.16, .42, .03).translate(0, -1.2, .08)), frames: ['armR'], color: () => '#8a6a45', when: hasProp('paddle') },
  { name: 'rod', geo: () => cyl(.012, .022, 2.8, 4).translate(0, 1.4, 0).rotateX(1.05).translate(0, -.42, .05), frames: ['armR'], color: () => '#5a4a35', when: hasProp('rod') },
  { name: 'broom', geo: () => merge(cyl(.02, .02, 1.3, 4).translate(0, -.9, .2), new THREE.ConeGeometry(.12, .3, 6).rotateX(Math.PI).translate(0, -1.6, .2)), frames: ['armR'], color: () => '#a68d5d', when: hasProp('broom') },
  { name: 'bow', geo: () => new THREE.TorusGeometry(.55, .02, 4, 14, 2).rotateZ(Math.PI - 1).rotateY(Math.PI / 2).translate(0, -.42, -.45), frames: ['armL'], color: () => '#5a4a35', when: hasProp('bow') },
  { name: 'basket', geo: () => cyl(.18, .13, .22, 8).translate(0, -.5, .1), frames: ['armL'], color: () => '#a5824f', when: hasProp('basket') },
  { name: 'headBasket', geo: () => merge(cyl(.32, .22, .16, 10).translate(0, .32, 0), new THREE.DodecahedronGeometry(.24, 0).scale(1, .4, 1).translate(0, .42, 0)), frames: ['head'], color: () => '#a58a4f', when: hasProp('headBasket') },
  { name: 'pack', geo: () => new THREE.BoxGeometry(.32, .42, .18).translate(0, .95, -.25), frames: ['upper'], color: () => '#6b5338', when: hasProp('pack') },
  { name: 'apron', geo: () => new THREE.BoxGeometry(.36, .55, .04).translate(0, .72, .21), frames: ['upper'], color: () => '#5a3f2a', when: hasProp('apron') },
  { name: 'pole', geo: () => merge(cyl(.025, .025, 1.9, 5).rotateX(Math.PI / 2).translate(.16, 1.4, 0), cyl(.2, .15, .26, 8).translate(.16, .6, .85), cyl(.2, .15, .26, 8).translate(.16, .6, -.85),
    cyl(.006, .006, .7, 3).translate(.16, 1.05, .85), cyl(.006, .006, .7, 3).translate(.16, 1.05, -.85)), frames: ['upper'], color: () => '#a5824f', when: hasProp('pole') },
  { name: 'sack', geo: () => new THREE.CapsuleGeometry(.17, .26, 3, 8).rotateZ(Math.PI / 2).translate(.12, 1.33, -.02), frames: ['upper'], color: () => '#c7b289', when: () => true, dynamic: npc => npc.carrying && !npc.look.props.includes('pole') && !npc.look.props.includes('headBasket') && !npc.look.props.includes('basket') },
  { name: 'bowl', geo: () => new THREE.SphereGeometry(.14, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 1, .24), frames: ['upper'], color: () => '#2f2a24', when: l => !!l.robe },
];

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const t1 = new THREE.Matrix4(), t2 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

export class NPCRenderer {
  constructor(scene, npcs) {
    this.npcs = npcs; this.parts = [];
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85 });
    for (const def of PARTS) {
      const entries = [];
      for (const npc of npcs) if (!def.when || def.when(npc.look)) for (const frame of def.frames) entries.push({ npc, frame });
      if (!entries.length) continue;
      const mesh = new THREE.InstancedMesh(def.geo(), material, entries.length);
      entries.forEach((e, i) => mesh.setColorAt(i, new THREE.Color(def.color(e.npc.look))));
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh); this.parts.push({ mesh, entries, dynamic: def.dynamic });
    }
  }
  dispose() {
    for (const { mesh } of this.parts) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.dispose(); }
    this.parts[0]?.mesh.material.dispose();
    this.parts = [];
  }
  frames(npc) {
    const p = npc.pose, f = npc.frames, s = npc.look.scale;
    f.root.compose(v.set(npc.x, npc.y + p.y * s, npc.z), q.setFromAxisAngle(up, npc.yaw), sc.set(s, s, s));
    f.upper.copy(f.root).multiply(t1.makeTranslation(0, .65, 0)).multiply(t2.makeRotationX(p.bend)).multiply(t1.makeTranslation(0, -.65, 0));
    f.head.copy(f.upper).multiply(t1.makeTranslation(0, 1.28, 0)).multiply(t2.makeRotationY(p.headYaw)).multiply(t1.makeRotationX(p.headPitch));
    f.legL.copy(f.root).multiply(t1.makeTranslation(-.105, .61, 0)).multiply(t2.makeRotationX(p.legL));
    f.legR.copy(f.root).multiply(t1.makeTranslation(.105, .61, 0)).multiply(t2.makeRotationX(p.legR));
    f.armL.copy(f.upper).multiply(t1.makeTranslation(-.2, 1.03, 0)).multiply(t2.makeRotationX(p.armLx)).multiply(t1.makeRotationZ(-p.armLz));
    f.armR.copy(f.upper).multiply(t1.makeTranslation(.2, 1.03, 0)).multiply(t2.makeRotationX(p.armRx)).multiply(t1.makeRotationZ(p.armRz));
  }
  update() {
    for (const npc of this.npcs) if (npc.shown && npc.dirty) this.frames(npc);
    for (const part of this.parts) {
      const { mesh, entries, dynamic } = part;
      for (let i = 0; i < entries.length; i++) {
        const { npc, frame } = entries[i];
        mesh.setMatrixAt(i, npc.shown && (!dynamic || dynamic(npc)) ? npc.frames[frame] : ZERO);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const npc of this.npcs) npc.dirty = false;
  }
}
