import * as THREE from 'three';
import { makeModelCharacter } from '../classes/model.js';
import { createFx, K as FOREST_K } from '../classes/fx/engine.js';
import { createDummy } from '../classes/fx/dummy.js';
import { createHotbar } from '../classes/fx/hotbar.js';
import { CLASS_KITS } from '../classes/index.js';
import { hitChanceOf } from '../rules/stats.js';
import { jobDerived, rollSkill } from './damage.js';
import { AVATARS, avatarFor, TRAINING } from '../data/training.js';
import './training.css';

// Class avatars and the city training ground. The player wears its class's
// GLB (AVATARS in src/data/training.js; classes without one wear the fallback
// model). A class with a skill kit (src/classes: มวยไทย, หมอยา) also gets the
// training ground: a straw dummy near the spawn that its ten skills (keys 1–0,
// Q auto) hit, and a log of every blow, totals and DPS.
//
//   const training = createClassAvatar(classId, { scene, camera, renderer, root, player, canStand, groundHeight });
//   → TrainingGround (classes with a kit) or a model-only avatar
//   training.enterMap(mapId)        after each map change (only active in TRAINING.map)
//   training.handleKey(e) → bool    keys 1–0 / Q while near the dummy
//   training.busy                   true while a skill plays (Game blocks walking)
//   training.update(dt, elapsed)    once per frame, after the player moved
//
// The player keeps its own movement; this only sets its look (Player.setAvatar)
// and drives the skills.

const $el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// The model is shown only once it loads; a missing or broken GLB leaves just the ground ring and a console warning.
function wearModel(player, scene, avatar) {
  const character = makeModelCharacter(scene, null, { url: `${import.meta.env.BASE_URL}${avatar.url}`, height: avatar.height });
  character.group.visible = false;
  character.ready.then(() => { character.group.visible = true; player.setAvatar(character, avatar.casts); })
    .catch(error => { scene.remove(character.group); console.warn(`avatar ${avatar.url} failed to load`, error); });
  return character;
}

export function createClassAvatar(classId, opts) {
  const avatar = avatarFor(classId);
  // Only the class that owns the model gets its skills; a fallback wearer gets the look alone.
  const kit = CLASS_KITS[avatar.skills];
  if (kit && avatar === AVATARS[classId]) return new TrainingGround(opts, avatar, kit);
  wearModel(opts.player, opts.scene, avatar);
  // Model only: nothing to drive per frame.
  return { busy: false, enterMap() {}, handleKey: () => false, update() {} };
}

export class TrainingGround {
  constructor({ scene, camera, renderer, root, player, canStand, groundHeight }, avatar, kit) {
    this.kit = kit; this.keys = kit.skills.map(s => s.key);
    const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
    const f = TRAINING.fighter;
    this.level = num('lv', f.level); this.skillLevel = Math.max(1, Math.min(5, num('skill', f.skillLevel)));
    this.target = { def: num('ddef', TRAINING.dummy.def), eva: num('deva', TRAINING.dummy.eva) };
    this.job = avatar.job ?? 'boxer';
    this.derived = jobDerived(this.job, f.byJob?.[this.job] ?? f.stats, this.level);
    this.player = player; this.canStand = canStand; this.groundHeight = groundHeight; this.active = false;

    // The Player still walks and turns the avatar; this drives its skills.
    this.character = wearModel(player, scene, avatar);

    this.labels = $el('div', 'fx-labels'); this.dim = $el('div', 'fx-dim'); this.vignette = $el('div', 'fx-vignette');
    root.append(this.vignette, this.dim, this.labels);
    // FX units are sized for a 2.6 m character; scale them to this one.
    this.fx = createFx({ scene, camera, renderer, labels: this.labels, scale: FOREST_K * avatar.height / 2.6 });
    window.addEventListener('resize', () => this.fx.resize());

    this.stats = { total: 0, hits: 0, crits: 0, misses: 0, first: 0, last: 0, bySkill: {}, log: [] };
    this.clock = 0;
    this.panel = this.buildPanel(root);
  }

  // Rules damage for one blow of `skillId` against the dummy.
  roll(skillId) {
    this.lastSkill = skillId;
    return rollSkill(this.derived, this.target, skillId, this.skillLevel);
  }

  // Built lazily on entering the city so the dummy can stand on real, loaded ground.
  spawnDummy() {
    const d = TRAINING.dummy;
    let spot = null;
    for (let r = 0; r < 14 && !spot; r++) for (let a = 0; a < 8 && !spot; a++) {
      const x = d.x + Math.sin(a * Math.PI / 4) * r * .8, z = d.z - Math.cos(a * Math.PI / 4) * r * .8;
      if (this.canStand(x, z)) spot = new THREE.Vector3(x, this.groundHeight(x, z), z);
    }
    this.spot = spot ?? new THREE.Vector3(d.x, this.groundHeight(d.x, d.z), d.z);
    // The FX root follows the player's ground height; seat it there before placing the dummy.
    this.fx.root.position.y = this.player.position.y;
    this.dummy = createDummy(this.fx, this.labels, this.spot, this.groundHeight, { hp: d.hp, onHit: e => this.record(e) });
    this.skills = this.kit.createSkills({ fx: this.fx, character: this.character, player: this.player.group, dummy: this.dummy, groundHeight: this.groundHeight, labels: this.labels, dim: this.dim, damage: id => this.roll(id) });
    this.skills.range = TRAINING.range;
    this.hotbar = createHotbar(this.labels.parentElement, this.skills, this.kit.skills, 'สกิล' + this.kit.name);
  }

  enterMap(mapId) {
    this.active = mapId === TRAINING.map;
    if (this.active && !this.dummy) this.spawnDummy();
    this.fx.root.visible = this.active;
    this.labels.hidden = !this.active;
    if (!this.active) { this.hotbar?.setAuto(false); this.setNear(false); }
  }

  get near() { return this.active && !!this.spot && Math.hypot(this.player.position.x - this.spot.x, this.player.position.z - this.spot.z) <= TRAINING.range; }
  get busy() { return this.active && !!this.skills?.busy; }

  handleKey(e) {
    if (!this.near || e.repeat || !this.hotbar) return false;
    const slot = this.keys.indexOf(e.code);
    if (slot >= 0) { this.hotbar.cast(slot); return true; }
    if (e.code === 'KeyQ') { this.hotbar.toggleAuto(); return true; }
    return false;
  }

  setNear(on) {
    if (on === this.wasNear) return;
    this.wasNear = on;
    // Near the dummy the class's ten-skill hotbar replaces the combat skill bar.
    document.body.classList.toggle('training-near', on);
    this.panel.hidden = !on;
    if (!on) this.hotbar?.setAuto(false);
  }

  update(dt) {
    if (!this.active || !this.skills) return;
    const fx = this.fx;
    // Hit-stop: heavy blows freeze the fighter and effects for a few frames (the world keeps going).
    const sdt = fx.stop > 0 ? dt * .06 : dt; fx.stop = Math.max(0, fx.stop - dt);
    this.clock += sdt;
    this.skills.update(sdt);
    this.setNear(this.near);
    // While a skill plays it moves and turns the avatar.
    if (this.skills.busy && this.skills.facing !== null) this.player.group.rotation.y = this.skills.facing;
    this.hotbar.update(sdt, false);
    fx.update(sdt, this.clock, this.player.position.y);
    this.dummy.update(sdt);
    this.vignette.style.opacity = fx.mood.toFixed(3);
    if (this.dirty) { this.dirty = false; this.renderPanel(); }
  }

  // ---- damage log ---------------------------------------------------------
  record(e) {
    const s = this.stats, now = performance.now() / 1000, id = e.bleed ? 'bleed' : this.lastSkill ?? '?';
    if (!s.first) s.first = now;
    s.last = now;
    if (e.miss) s.misses++;
    else { s.total += e.amount; s.hits++; if (e.crit) s.crits++; }
    const k = (s.bySkill[id] ??= { dmg: 0, n: 0 }); k.dmg += e.amount; k.n++;
    s.log.unshift(e.miss ? { id, text: 'MISS', cls: 'miss' } : { id, text: String(e.amount), cls: e.bleed ? 'bleed' : e.crit ? 'crit' : '' });
    s.log.length = Math.min(s.log.length, TRAINING.log);
    if (e.killed) s.log.unshift({ id: 'ko', text: 'หุ่นแตก!', cls: 'ko' });
    this.dirty = true;
  }
  reset() { this.stats = { total: 0, hits: 0, crits: 0, misses: 0, first: 0, last: 0, bySkill: {}, log: [] }; this.renderPanel(); }

  buildPanel(root) {
    const d = this.derived, hit = hitChanceOf(d.accuracy, this.target.eva);
    const panel = $el('aside', 'training-panel glass');
    panel.hidden = true;
    panel.innerHTML = `
      <header><b>${this.kit.ground}</b><button type="button" class="training-reset" title="ล้างสถิติ">ล้าง</button></header>
      <p class="training-sub">${this.kit.name} Lv.${this.level} · สกิล Lv.${this.skillLevel} · ATK ${d.patk} · คริ ${(d.critRate * 100).toFixed(0)}% ×${d.critDmg.toFixed(2)} · โดน ${(hit * 100).toFixed(0)}%<br>หุ่น DEF ${this.target.def} · EVA ${this.target.eva}</p>
      <dl class="training-sum"></dl>
      <ol class="training-log"></ol>
      <table class="training-skills"></table>
      <p class="training-tip">1–0 ใช้สกิล · Q ออโต้ · ?lv=50&amp;skill=5&amp;ddef=40 ปรับค่าทดสอบ</p>`;
    panel.querySelector('.training-reset').addEventListener('click', () => this.reset());
    root.appendChild(panel);
    this.sum = panel.querySelector('.training-sum'); this.logEl = panel.querySelector('.training-log'); this.table = panel.querySelector('.training-skills');
    return panel;
  }
  renderPanel() {
    const s = this.stats, span = Math.max(1, s.last - s.first), name = id => (id === 'bleed' ? 'เลือดไหล' : this.kit.skills.find(m => m.id === id)?.name ?? id);
    const tries = s.hits + s.misses;
    this.sum.innerHTML = `<div><dt>รวม</dt><dd>${s.total.toLocaleString()}</dd></div><div><dt>DPS</dt><dd>${s.hits ? Math.round(s.total / span).toLocaleString() : 0}</dd></div><div><dt>คริ</dt><dd>${s.hits ? Math.round(s.crits / s.hits * 100) : 0}%</dd></div><div><dt>พลาด</dt><dd>${tries ? Math.round(s.misses / tries * 100) : 0}%</dd></div>`;
    this.logEl.innerHTML = s.log.map(l => `<li class="${l.cls}"><span>${name(l.id) === 'ko' ? '' : name(l.id)}</span><b>${l.text}</b></li>`).join('');
    const rows = Object.entries(s.bySkill).filter(([, v]) => v.dmg > 0).sort((a, b) => b[1].dmg - a[1].dmg);
    this.table.innerHTML = rows.length ? `<tr><th>สกิล</th><th>ครั้ง</th><th>เฉลี่ย</th><th>รวม</th></tr>` + rows.map(([id, v]) => `<tr><td>${name(id)}</td><td>${v.n}</td><td>${Math.round(v.dmg / v.n)}</td><td>${v.dmg.toLocaleString()}</td></tr>`).join('') : '';
  }
}
