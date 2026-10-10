// Three.js presentation for combat: monster models, target ring, projectiles, AoE and hit flashes.
import * as THREE from 'three';
import { RULES } from './data/rules.js';
import { makeDog } from '../classes/dog.js';
import { makeMonsterModel } from './MonsterModels.js';
import { seedOf } from '../core/seed.js';
import { BossTelegraphs } from './BossTelegraphs.js';
import { disposeCombatModel, isCombatModelDisposed } from './CombatResources.js';
import { applyMonsterFeedback } from './MonsterFeedback.js';
import { BossMotion, BOSS_MOTION_PROFILES } from './BossMotion.js';

// Monster rendering uses GLB models or built 3D fallbacks exclusively.
export const MONSTER_STYLE = '3d';

const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
const add = (parent, geometry, material, x = 0, y = 0, z = 0, scale) => {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; parent.add(m); return m;
};

// options: stripes (tiger), tusks (boar), horns (buffalo), low (a lizard: long, flat, short legs),
// lean (a wild dog: slim body, long legs, a bushy tail)
function quadruped(def, { stripes = false, tusks = false, horns = false, low = false, lean = false } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fur = std(def.color), dark = std(new THREE.Color(def.color).multiplyScalar(.55));
  if (low) body.scale.set(1, .55, 1.35);
  add(body, new THREE.SphereGeometry(.5, 14, 10), fur, 0, .62, 0, lean ? [.6, .6, 1.2] : [.8, .7, 1.25]);
  const head = new THREE.Group(); head.position.set(0, .75, .6); body.add(head);
  if (horns) for (const s of [-1, 1]) {   // wide, swept-back buffalo horns
    const horn = add(head, new THREE.ConeGeometry(.07, .6, 6), std('#d9cfb4'), s * .42, .2, -.08);
    horn.rotation.set(-.5, 0, -s * 1.25);
  }
  add(head, new THREE.SphereGeometry(.3, 12, 10), fur, 0, 0, .05, [1, .9, 1.1]);
  add(head, new THREE.SphereGeometry(.14, 10, 8), dark, 0, -.06, .3);
  for (const s of [-1, 1]) {
    add(head, new THREE.ConeGeometry(.09, .16, 6), dark, s * .17, .24, -.02);
    add(head, new THREE.SphereGeometry(.035, 6, 6), std('#f4e2a0', { emissive: '#7a5b14' }), s * .12, .08, .25);
    if (tusks) add(head, new THREE.ConeGeometry(.03, .16, 5), std('#efe6cc'), s * .1, -.08, .36).rotation.x = -1.2;
  }
  if (stripes) for (let i = 0; i < 4; i++) add(body, new THREE.TorusGeometry(.42, .035, 4, 16, Math.PI), dark, 0, .64, -.35 + i * .2, [.85, .9, 1]).rotation.y = Math.PI / 2;
  const legs = [];
  for (const [x, z] of [[-.22, .38], [.22, .38], [-.22, -.38], [.22, -.38]]) {
    const leg = new THREE.Group(); leg.position.set(x, .45, z); body.add(leg);
    add(leg, new THREE.CylinderGeometry(.08, .06, .45, 6), dark, 0, -.22, 0); legs.push(leg);
  }
  const tail = lean ? add(body, new THREE.ConeGeometry(.09, .5, 6), dark, 0, .7, -.7) : low ? add(body, new THREE.ConeGeometry(.16, 1.2, 6), fur, 0, .55, -1.1) : add(body, new THREE.CylinderGeometry(.03, .015, .5, 5), dark, 0, .75, -.68);
  tail.rotation.x = lean ? -2 : low ? -1.45 : -.8;
  g.userData.animate = (t, moving, attacking) => {
    legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(t * 11 + (i % 3 ? Math.PI : 0)) * .5 : 0);
    head.rotation.x = attacking ? -.35 : Math.sin(t * 1.5) * .05;
    tail.rotation.z = Math.sin(t * 4) * .3;
  };
  return g;
}

function monkey(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fur = std(def.color), face = std('#d6b48c');
  add(body, new THREE.SphereGeometry(.32, 12, 10), fur, 0, .75, 0, [1, 1.2, .9]);
  add(body, new THREE.SphereGeometry(.24, 12, 10), fur, 0, 1.18, .05);
  add(body, new THREE.SphereGeometry(.15, 10, 8), face, 0, 1.15, .18, [1, .9, .7]);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * .3, .95, 0); body.add(arm);
    add(arm, new THREE.CylinderGeometry(.06, .05, .6, 6), fur, 0, -.3, 0); arms.push(arm);
    add(body, new THREE.CylinderGeometry(.07, .05, .4, 6), fur, s * .15, .32, 0);
  }
  const tail = add(body, new THREE.TorusGeometry(.3, .03, 5, 12, Math.PI * 1.3), fur, 0, .7, -.35); tail.rotation.y = Math.PI / 2;
  g.userData.animate = (t, moving, attacking) => {
    body.position.y = moving ? Math.abs(Math.sin(t * 9)) * .15 : 0;
    arms.forEach((a, i) => a.rotation.x = attacking ? -2.2 : Math.sin(t * 9 + i * Math.PI) * (moving ? .7 : .1));
  };
  return g;
}

// look (src/combat/data/monsters.js): oneLeg (กองกอย hops on one leg), tall (a thin, long
// figure), hair (long hair to the ground), headless (carries its head), wings (กระหัง's winnowing
// baskets), shield (a ghost soldier's shield and spear), elder (an old man's white beard and staff)
function spirit(def) {
  const look = def.look ?? {}, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const glow = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: .55, transparent: true, opacity: .72, roughness: .4 });
  const tall = look.tall ? 1.35 : 1, headY = 1.68 * tall;
  add(body, new THREE.ConeGeometry(look.tall ? .3 : .42, 1.3 * tall, 14, 1, true), glow, 0, .95 * tall, 0).castShadow = false;
  const head = new THREE.Group(); head.position.y = headY; body.add(head);
  add(head, new THREE.SphereGeometry(.24, 12, 10), glow).castShadow = false;
  add(head, new THREE.SphereGeometry(.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), std('#1b1b1f'), 0, .04, -.02, [1, 1.6, 1]);
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(.04, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff5a4a' }), s * .08, .02, .21);
  if (look.headless) { head.position.set(.38, 1.05, .25); head.scale.setScalar(.85); add(body, new THREE.CylinderGeometry(.1, .12, .08, 8), std('#5a1414'), 0, 1.6, 0); }
  if (look.hair) add(head, new THREE.ConeGeometry(.3, 1.9, 10, 1, true), std('#111014', { roughness: .6 }), 0, -.85, -.12);
  if (look.elder) {
    add(head, new THREE.ConeGeometry(.16, .55, 8), std('#f4f1e6'), 0, -.36, .16).rotation.x = Math.PI;
    add(body, new THREE.CylinderGeometry(.035, .035, 2, 6), std('#6b4a2b'), .48, 1, .2);
  }
  let wings = [];
  if (look.wings) wings = [-1, 1].map(s => { const w = add(body, new THREE.CylinderGeometry(.42, .42, .05, 14), std('#c9a66b'), s * .55, 1.35, -.05); w.rotation.z = Math.PI / 2 + s * .5; return w; });
  if (look.shield) {
    add(body, new THREE.CylinderGeometry(.34, .34, .06, 16), std('#7a6a3a', { metalness: .4 }), -.36, 1.05, .32).rotation.x = Math.PI / 2;
    add(body, new THREE.CylinderGeometry(.025, .025, 2.2, 5), std('#5a4630'), .4, 1.25, .1);
    add(body, new THREE.ConeGeometry(.06, .28, 5), std('#b8b8c0', { metalness: .6 }), .4, 2.45, .1);
  }
  let leg = null;
  if (look.oneLeg) leg = add(body, new THREE.CylinderGeometry(.07, .05, .7, 6), glow, 0, .1, 0);
  const halo = glowSprite(def.color, 2.2); halo.position.y = 1.3 * tall; body.add(halo);
  g.userData.animate = (t, moving, attacking) => {
    body.position.y = look.oneLeg ? .45 + Math.abs(Math.sin(t * (moving ? 9 : 3))) * .3 : .25 + Math.sin(t * 2.4) * .12;
    body.rotation.z = attacking ? Math.sin(t * 30) * .15 : Math.sin(t * 1.3) * .06;
    wings.forEach((w, i) => w.rotation.x = Math.sin(t * (moving ? 14 : 5) + i * Math.PI) * .5);
    if (leg) leg.scale.y = moving ? 1 + Math.sin(t * 9) * .15 : 1;
  };
  return g;
}

// ไก่ป่า: a small jungle fowl with a red comb and a dark tail.
function bird(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const plume = std(def.color), dark = std('#1e2a26'), red = std('#d8312a');
  add(body, new THREE.SphereGeometry(.32, 12, 10), plume, 0, .55, 0, [.85, .8, 1.1]);
  const head = new THREE.Group(); head.position.set(0, .92, .26); body.add(head);
  add(head, new THREE.SphereGeometry(.15, 10, 8), plume);
  add(head, new THREE.BoxGeometry(.04, .12, .16), red, 0, .14, 0);
  add(head, new THREE.ConeGeometry(.04, .14, 5), std('#e2b84a'), 0, -.02, .17).rotation.x = Math.PI / 2;
  const tail = add(body, new THREE.ConeGeometry(.16, .55, 6), dark, 0, .8, -.33); tail.rotation.x = -.6;
  const legs = [-1, 1].map(s => add(body, new THREE.CylinderGeometry(.025, .02, .3, 4), std('#c9a24a'), s * .1, .17, 0));
  g.userData.animate = (t, moving, attacking) => {
    legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * 16 + i * Math.PI) * .7 : 0);
    head.rotation.x = attacking ? .7 : moving ? Math.sin(t * 16) * .2 : Math.sin(t * 2) * .15;
  };
  return g;
}

// งูเห่านา: a coiled body with a raised hood.
function snake(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = std(def.color), belly = std('#c8b878');
  add(body, new THREE.TorusGeometry(.35, .1, 8, 18), skin, 0, .1, -.1).rotation.x = Math.PI / 2;
  const neck = new THREE.Group(); neck.position.set(0, .15, .2); body.add(neck);
  add(neck, new THREE.CylinderGeometry(.08, .1, .6, 8), skin, 0, .3, 0);
  add(neck, new THREE.SphereGeometry(.22, 10, 8), belly, 0, .62, .02, [1, 1.2, .25]);
  add(neck, new THREE.SphereGeometry(.11, 10, 8), skin, 0, .72, .08, [1, .8, 1.3]);
  for (const s of [-1, 1]) add(neck, new THREE.SphereGeometry(.025, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffe066' }), s * .05, .76, .2);
  g.userData.animate = (t, moving, attacking) => {
    neck.rotation.x = attacking ? .5 : Math.sin(t * 2) * .08;
    neck.rotation.z = Math.sin(t * (moving ? 8 : 1.5)) * .15;
  };
  return g;
}

// ปูนา: a flat shell, two claws.
function crab(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shell = std(def.color), dark = std(new THREE.Color(def.color).multiplyScalar(.6));
  add(body, new THREE.SphereGeometry(.4, 14, 8), shell, 0, .3, 0, [1.2, .45, .9]);
  for (const s of [-1, 1]) add(body, new THREE.SphereGeometry(.04, 6, 6), std('#111'), s * .12, .5, .3);
  const claws = [-1, 1].map(s => { const c = new THREE.Group(); c.position.set(s * .38, .3, .3); body.add(c); add(c, new THREE.SphereGeometry(.15, 8, 6), dark, 0, 0, .12, [.8, .6, 1.2]); return c; });
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const l = add(body, new THREE.CylinderGeometry(.025, .02, .4, 4), dark, s * .5, .18, -.15 + i * .15); l.rotation.z = s * 1.1; legs.push(l); }
  g.userData.animate = (t, moving, attacking) => {
    claws.forEach((c, i) => c.rotation.y = (i ? -1 : 1) * (attacking ? .7 : Math.sin(t * 3) * .1));
    body.position.x = moving ? Math.sin(t * 12) * .05 : 0;
    legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * 14 + i) * .4 : 0);
  };
  return g;
}

// ผีโขมด: a floating will-o'-the-wisp.
function orb(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const glow = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1.6, roughness: .2 });
  add(body, new THREE.SphereGeometry(.28, 14, 12), glow, 0, 1.3, 0).castShadow = false;
  const halo = glowSprite(def.color, 3); halo.position.y = 1.3; body.add(halo);
  const sparks = [0, 1, 2].map(i => { const s = add(body, new THREE.SphereGeometry(.06, 6, 6), glow, 0, 1.3, 0); s.castShadow = false; return s; });
  g.userData.animate = (t, moving, attacking) => {
    body.position.y = Math.sin(t * 2) * .2;
    sparks.forEach((s, i) => { const a = t * 3 + i * 2.1; s.position.set(Math.cos(a) * .45, 1.3 + Math.sin(a * 1.3) * .2, Math.sin(a) * .45); });
    halo.material.opacity = .7 + Math.sin(t * 9) * .2 + (attacking ? .3 : 0);
  };
  return g;
}

// Krasue: a floating woman's head trailing glowing entrails; the rare night monster.
function krasue(def) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = std('#e9cdb2', { emissive: '#3a1a10', emissiveIntensity: .4 }), hair = std('#141016', { roughness: .6 });
  const glow = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1.4, roughness: .3 });
  add(body, new THREE.SphereGeometry(.3, 16, 12), skin, 0, 1.9, 0, [1, 1.12, 1]);
  add(body, new THREE.SphereGeometry(.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * .6), hair, 0, 1.96, -.03, [1.05, 1.1, 1.1]);
  add(body, new THREE.ConeGeometry(.3, .9, 10, 1, true), hair, 0, 1.5, -.12).rotation.x = .15;
  for (const sx of [-1, 1]) add(body, new THREE.SphereGeometry(.035, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffdf6b' }), sx * .1, 1.93, .27);
  add(body, new THREE.BoxGeometry(.12, .02, .02), new THREE.MeshBasicMaterial({ color: '#7a0d12' }), 0, 1.78, .28);
  const organs = new THREE.Group(); organs.position.y = 1.62; body.add(organs);
  add(organs, new THREE.SphereGeometry(.13, 10, 8), glow, 0, -.12, 0).castShadow = false;
  add(organs, new THREE.SphereGeometry(.09, 8, 6), glow, .1, -.28, .04).castShadow = false;
  const strands = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2, curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -.1, 0), new THREE.Vector3(Math.cos(a) * .12, -.45, Math.sin(a) * .12),
      new THREE.Vector3(Math.cos(a) * .05, -.8, Math.sin(a) * .2), new THREE.Vector3(Math.cos(a + 1) * .1, -1.15 - i * .05, Math.sin(a + 1) * .1)]);
    const strand = add(organs, new THREE.TubeGeometry(curve, 16, .025, 5), glow); strand.castShadow = false; strands.push(strand);
  }
  const light = glowSprite(def.color, 2.6); light.position.y = 1.35; body.add(light);
  g.userData.animate = (t, moving, attacking) => {
    body.position.y = .2 + Math.sin(t * 1.8) * .18;
    body.rotation.z = Math.sin(t * 1.1) * .08;
    strands.forEach((st, i) => st.rotation.y = Math.sin(t * 2 + i) * .4);
    organs.rotation.x = moving ? -.35 : 0;
    light.material.opacity = .65 + Math.sin(t * 7) * .2 + (attacking ? .3 : 0);
  };
  return g;
}

// Additive glow sprite stands in for point lights: adding or hiding lights
// would force every material in the scene to recompile.
let glowTexture;
function glowSprite(color, scale) {
  if (!glowTexture) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffffff'); g.addColorStop(.35, '#ffffff66'); g.addColorStop(1, '#ffffff00');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTexture = new THREE.CanvasTexture(c);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.setScalar(scale);
  return sprite;
}

const BUILDERS = {
  krasue,
  boar: def => quadruped(def, { tusks: true }),
  tiger: def => quadruped(def, { stripes: true }),
  buffalo: def => quadruped(def, { horns: true }),
  dog: def => quadruped(def, { lean: true }),
  lizard: def => quadruped(def, { low: true }),
  monkey, spirit, bird, snake, crab, orb,
};
export const makeMonsterFallback = def => (BUILDERS[def.shape] || quadruped)(def);

// Shots (CombatView.projectile). An arrow points along +z, so lookAt aims it down its flight.
function arrowMesh() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .78, 5), new THREE.MeshBasicMaterial({ color: '#8a6a42' }));
  shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 5), new THREE.MeshBasicMaterial({ color: '#c8ccd4' }));
  head.rotation.x = Math.PI / 2; head.position.z = .44; g.add(head);
  for (const r of [0, Math.PI / 2]) {
    const vane = new THREE.Mesh(new THREE.PlaneGeometry(.1, .16), new THREE.MeshBasicMaterial({ color: '#e8e0c8', side: THREE.DoubleSide }));
    vane.rotation.set(0, Math.PI / 2, r); vane.position.z = -.32; g.add(vane);
  }
  return g;
}
function dartMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .3, 5), new THREE.MeshBasicMaterial({ color: '#6a8a3a' }));
  body.rotation.x = Math.PI / 2; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.04, .1, 5), new THREE.MeshBasicMaterial({ color }));
  tip.rotation.x = Math.PI / 2; tip.position.z = .2; g.add(tip);
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(.12, .1), new THREE.MeshBasicMaterial({ color: '#9cd060', side: THREE.DoubleSide }));
  leaf.rotation.y = Math.PI / 2; leaf.position.z = -.15; g.add(leaf);
  g.add(glowSprite(color, .35));
  return g;
}
function orbMesh(color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color }));
  mesh.add(glowSprite(color, 1.1));
  return mesh;
}

export class CombatView {
  constructor(scene, combat, groundHeight) {
    this.scene = scene; this.combat = combat; this.groundHeight = groundHeight;
    this.views = new Map(); this.effects = [];
    this.root = new THREE.Group(); this.root.name = 'combat'; scene.add(this.root);
    this.bossTelegraphs = new BossTelegraphs(this.root, groundHeight);
    combat.on('boss-skill', e => this.bossSkill(e));
    combat.on('boss-skills-clear', () => this.clearBossMotions());
    combat.on('despawn', m => this.bossTelegraphs.clear(m.id));
    combat.on('kill', ({ monster }) => this.bossTelegraphs.clear(monster.id));

    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(.55, .66, 40), new THREE.MeshBasicMaterial({ color: '#ff7b5c', transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.root.add(this.targetRing);

    for (const m of combat.monsters) this.ensure(m);
    combat.on('spawn', m => {
      const v = this.ensure(m); v.group.visible = true; v.fade = 0; v.dying = 0; v.attackAnim = 0;
      if (v.bossMotion?.dead) v.bossMotion.reset();
      if (m.skillCast) v.bossMotion?.event({ stage: 'windup', cast: m.skillCast, snapshot: true });
    });
    combat.on('hit', ({ monster }) => { const v = this.views.get(monster.id); if (v) v.flash = .15; });
    combat.on('kill', ({ monster }) => { const v = this.views.get(monster.id); if (v) { v.dying = 1; v.bossMotion?.update(0, { dying: true }); } });
    combat.on('despawn', monster => { const v = this.views.get(monster.id); if (v) { v.dying = 1; v.bossMotion?.update(0, { dying: true }); } });
    combat.on('projectile', e => this.projectile(e));
    combat.on('aoe', e => this.ring(e.x, e.z, e.radius, e.skillId === 'whirl' ? '#f1d18a' : '#ff8a4a'));
    // melee blows look like the class's weapon: a fist's impact, a blade's arc, a knife's thrust
    combat.on('cast', ({ skill, from, target }) => {
      if (skill.projectile || !(skill.kind === 'damage' || skill.kind === 'debuff') || !target) return;
      if (skill.look === 'punch') this.punch(from, target, skill.fx || '#ffd2a0');
      else if (skill.look === 'thrust') this.thrust(from, target, skill.fx || '#e0e0f0');
      else this.slash(from, target, skill.fx || '#fff3c4');
    });
    combat.on('pet-command', ({ target }) => this.ring(target.x, target.z, 1.2, '#f2c26b'));
    if (combat.pet) {
      this.pet = makeDog();   // the hunter's dog (src/classes/dog.js), also summoned by ลมใต้ปีกครุฑ
      this.pet.scale.setScalar(.8);
      this.root.add(this.pet);
    }
    combat.on('heal', e => this.ring(e.x, e.z, 1.1, '#9df0a8'));
    // a skill on an evolution path flashes in the path's colour (src/rules/data/evolutions.js)
    combat.on('evo-fx', e => { this.ring(e.x, e.z, 1.6, e.color); this.ring(e.x, e.z, 2.4, e.color); });
    combat.on('buff', () => { const p = combat.world.playerPos(); this.ring(p.x, p.z, 1, '#a8d4ff'); });
  }

  disposeModel(group) { disposeCombatModel(group); }
  bossSkill(event) {
    const { monster, stage, cast } = event;
    if (!monster?.alive || !this.combat.monsters.includes(monster)) return;
    const view = this.ensure(monster);
    // Serial checks govern both the pose and its visual warning. They do not
    // touch the authoritative monster state or damage event stream.
    if (view.bossMotion) {
      const accepted = view.bossMotion.event({ stage, cast, snapshot: stage === 'windup' && monster.skillCast === cast });
      if (!accepted && !(stage === 'windup' && view.bossMotion.active?.stage === 'windup'
        && view.bossMotion.serial === cast?.serial && !this.bossTelegraphs.items.has(monster.id))) return;
    }
    this.bossTelegraphs.event(event);
  }
  clearBossMotions() {
    this.bossTelegraphs.clear();
    for (const v of this.views.values()) v.bossMotion?.clear();
  }
  // Retained for callers with older monsterStyle options; all redraws remain 3D.
  restyle() {
    const previous = new Map(this.views);
    for (const [id, v] of this.views) { this.root.remove(v.group); this.disposeModel(v.group); this.views.delete(id); }
    for (const m of this.combat.monsters) if (m.alive) this.ensure(m, previous.get(m.id)?.monster === m ? previous.get(m.id).bossMotion : null);
  }
  ensure(m, preservedMotion = null) {
    const existing = this.views.get(m.id);
    const disposed = existing && isCombatModelDisposed(existing.group);
    if (existing?.monster === m && !disposed) return existing;
    // Map release may keep the Monster/view entry after retiring its model.
    // Rebuild the same instance with a fresh controller and fresh load guards.
    if (disposed) preservedMotion = null;
    // A reconnect can reuse a server id for a different monster instance.
    if (existing) { this.root.remove(existing.group); this.disposeModel(existing.group); this.views.delete(m.id); }
    const bossMotion = BOSS_MOTION_PROFILES[m.type] ? preservedMotion ?? new BossMotion(m.type) : null;
    if (!preservedMotion && m.skillCast) bossMotion?.event({ stage: 'windup', cast: m.skillCast, snapshot: true });
    const fallback = makeMonsterFallback(m.def);
    const group = makeMonsterModel(m.type, fallback, m.id, { bossMotion });
    group.scale.setScalar(m.def.size);
    group.traverse(o => { if (o.isMesh) { o.userData.monsterId = m.id; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); } });
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, 1.8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = .9; pick.userData.monsterId = m.id; group.add(pick);
    this.root.add(group);
    const view = { group, monster: m, bossMotion, flash: 0, dying: 0, fade: 1, attackAnim: 0, animationState: { hurt: false, dying: false } };
    this.views.set(m.id, view);
    return view;
  }

  // Meshes to raycast when the player clicks; userData.monsterId identifies the hit.
  get pickables() { return [...this.views.values()].filter(v => v.monster.alive).map(v => v.group); }
  monsterById(id) { return this.views.get(id)?.monster; }

  // A shot in flight. look: 'arrow' (a real arrow, no glow: the hunter's bow), 'dart' (a small
  // herbal dart with a faint green trail), anything else a glowing orb (spells, spirits).
  projectile({ from, target, color, duration, look }) {
    const mesh = look === 'arrow' ? arrowMesh() : look === 'dart' ? dartMesh(color) : orbMesh(color);
    this.root.add(mesh);
    const y0 = this.groundHeight(from.x, from.z) + 1.1, lift = look === 'arrow' ? .25 : look === 'dart' ? .35 : .6;
    const at = k => {
      const tx = target.x, tz = target.z, ty = this.groundHeight(tx, tz) + .8;
      return new THREE.Vector3(from.x + (tx - from.x) * k, y0 + (ty - y0) * k + Math.sin(k * Math.PI) * lift, from.z + (tz - from.z) * k);
    };
    this.effects.push({ mesh, t: 0, duration: Math.max(.05, duration), update: (e, k) => {
      mesh.position.copy(at(k));
      if (look === 'arrow' || look === 'dart') mesh.lookAt(k < .95 ? at(k + .05) : mesh.position.clone().add(at(1).sub(at(.95))));
    } });
  }

  // a fist's blow: a short burst of rays and a ring where it lands
  punch(from, target, color) {
    // the impact on the near side of the target (the fist reaches it)
    const a = Math.atan2(target.x - from.x, target.z - from.z), d = Math.max(.5, Math.hypot(target.x - from.x, target.z - from.z) - .45);
    const x = from.x + Math.sin(a) * d, z = from.z + Math.cos(a) * d, y = this.groundHeight(from.x, from.z) + 1.05;
    const g = new THREE.Group(); g.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .42), mat);
      const r = i / 6 * Math.PI * 2; ray.position.set(Math.cos(r) * .22, Math.sin(r) * .22, 0); ray.lookAt(Math.cos(r), Math.sin(r), 0); g.add(ray);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(.12, .17, 20), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    g.add(ring); g.add(glowSprite(color, .7)); g.rotation.y = a; this.root.add(g);
    this.effects.push({ mesh: g, t: 0, duration: .2, update: (e, k) => { g.scale.setScalar(.6 + k * 1.1); g.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } }); } });
  }

  // a knife's thrust: a thin streak straight at the target
  thrust(from, target, color) {
    const a = Math.atan2(target.x - from.x, target.z - from.z);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(.05, 1.1, 5), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    mesh.rotation.set(Math.PI / 2, 0, 0); const g = new THREE.Group(); g.add(mesh); g.rotation.y = a;
    const y = this.groundHeight(from.x, from.z) + 1;
    this.root.add(g);
    this.effects.push({ mesh: g, t: 0, duration: .16, update: (e, k) => { const d = .4 + k * .7; g.position.set(from.x + Math.sin(a) * d, y, from.z + Math.cos(a) * d); mesh.material.opacity = 1 - k * k; } });
  }

  ring(x, z, radius, color) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, this.groundHeight(x, z) + .08, z); this.root.add(mesh);
    this.effects.push({ mesh, t: 0, duration: .5, update: (e, k) => { mesh.scale.setScalar(radius * (.3 + k * .7)); mesh.material.opacity = 1 - k; } });
  }

  slash(from, target, color) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.8, .05, 4, 20, Math.PI * .9), new THREE.MeshBasicMaterial({ color, transparent: true }));
    const a = Math.atan2(target.x - from.x, target.z - from.z);
    mesh.position.set(from.x + Math.sin(a) * .7, this.groundHeight(from.x, from.z) + 1, from.z + Math.cos(a) * .7);
    mesh.rotation.set(Math.PI / 2, 0, -a + Math.PI * .05); this.root.add(mesh);
    this.effects.push({ mesh, t: 0, duration: .22, update: (e, k) => { mesh.rotation.z = -a - Math.PI * .5 + k * Math.PI * .8; mesh.material.opacity = 1 - k; } });
  }

  update(dt, elapsed, camera = null) {
    this.bossTelegraphs.update(dt, this.combat.world.playerPos(), this.combat.target?.id);
    const target = this.combat.target;
    const camYaw = camera ? Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]) : 0;   // the camera's yaw: the way it looks along the ground
    // A view whose monster has left the fight list is dropped once its death has played, or the map would keep
    // every skinned clone it ever drew
    if ((this.pruneAt = (this.pruneAt ?? 0) + dt) > 2) {
      this.pruneAt = 0;
      const live = new Set(this.combat.monsters);
      for (const [id, v] of this.views) if (!live.has(v.monster) && !v.dying) { this.root.remove(v.group); this.disposeModel(v.group); this.views.delete(id); }
    }
    for (const v of this.views.values()) {
      const m = v.monster, g = v.group;
      if (!m.alive && !v.dying) { g.visible = false; continue; }
      g.visible = true;
      g.position.set(m.x, this.groundHeight(m.x, m.z), m.z);
      g.rotation.y += Math.atan2(Math.sin(m.facing - g.rotation.y), Math.cos(m.facing - g.rotation.y)) * Math.min(1, dt * 10);
      if (m.attackTimer > (m.def.attackDelay ?? (m.def.elite ? RULES.eliteAttackDelay : RULES.monsterAttackDelay)) - .3) v.attackAnim = .25;
      v.attackAnim = Math.max(0, v.attackAnim - dt);
      v.animationState.hurt = v.flash > 0; v.animationState.dying = !!v.dying;
      v.animationState.bossMotion = v.bossMotion?.update(dt, v.animationState);
      v.animationState.tint = m.debuffs.some(d => d.dot) ? '#b78ad0' : m.debuffs.some(d => d.stun) ? '#e6d27a' : m.debuffs.some(d => d.slow) ? '#8fb4d8' : null;
      g.userData.face?.(camYaw);
      g.userData.animate?.(elapsed + (v.seed ??= seedOf(m.id) * .37), m.moving,
        v.attackAnim > 0 || (!v.bossMotion && !!m.skillCast), v.animationState);
      v.flash = Math.max(0, v.flash - dt);
      if (v.dying) {
        v.dying = Math.max(0, v.dying - dt * 1.4);
        if (!g.userData.modelLoaded) {
          g.rotation.z = (1 - v.dying) * Math.PI / 2; g.position.y -= (1 - v.dying) * .3;
        }
        if (!v.dying) { g.visible = false; g.rotation.z = 0; }
      } else g.rotation.z = 0;
      v.fade = Math.min(1, v.fade + dt * 2);
      const slowed = m.debuffs.some(d => d.slow), cursed = m.debuffs.some(d => d.dot), stunned = m.debuffs.some(d => d.stun);
      g.traverse(o => {
        if (o.isMesh) applyMonsterFeedback(o.material, { flash: v.flash, cursed, stunned, slowed });
      });
    }
    if (this.pet) {
      const pet = this.combat.pet;
      this.pet.position.set(pet.x, this.groundHeight(pet.x, pet.z), pet.z);
      this.pet.rotation.y += Math.atan2(Math.sin(pet.facing - this.pet.rotation.y), Math.cos(pet.facing - this.pet.rotation.y)) * Math.min(1, dt * 12);
      // Combat resets its cooldown when a bite lands. Start the visible strike
      // there, then recover; global elapsed time cannot align repeated bites.
      // Skill actors supply their own anticipation and .55 impact phase.
      this.petBiteRemaining = Math.max(0, (this.petBiteRemaining ?? 0) - dt);
      if (pet.attackTimer > (this.petAttackTimer ?? 0)) this.petBiteRemaining = .25;
      this.petAttackTimer = pet.attackTimer;
      const bite = this.petBiteRemaining > 0 ? .55 + .45 * (1 - this.petBiteRemaining / .25) : undefined;
      this.pet.userData.animate(elapsed, pet.moving, false, { run: pet.pounce ? 1 : 0, bite });
    }
    this.targetRing.visible = !!target?.alive;
    if (target?.alive) {
      this.targetRing.position.set(target.x, this.groundHeight(target.x, target.z) + .06, target.z);
      this.targetRing.scale.setScalar(target.def.size * (1 + Math.sin(elapsed * 6) * .06));
      this.targetRing.rotation.z = elapsed;
    }
    for (const e of this.effects) { e.t += dt; e.update(e, Math.min(1, e.t / e.duration)); }
    for (const e of this.effects.filter(e => e.t >= e.duration)) {
      this.root.remove(e.mesh); e.mesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.effects = this.effects.filter(e => e.t < e.duration);
  }
}
