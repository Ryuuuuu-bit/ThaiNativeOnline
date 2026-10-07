import * as THREE from 'three';
import { makeModelCharacter } from '../classes/model.js';
import { createFx, K as FOREST_K } from '../classes/fx/engine.js';
import { createDummy } from '../classes/fx/dummy.js';
import { CLASS_KITS } from '../classes/index.js';
import { hitChanceOf } from '../rules/stats.js';
import { jobDerived } from './damage.js';
import { KitCaster } from './KitCaster.js';
import { AVATARS, avatarFor, TRAINING } from '../data/training.js';
import { Sound } from '../audio/Sound.js';
import { playSkillSound } from '../audio/gameSounds.js';
import './training.css';

// Class avatars, class skill kits and the city training ground. The player wears
// its class's GLB (AVATARS in src/data/training.js; classes without one wear the
// fallback model). A class with a skill kit (src/classes CLASS_KITS) also gets:
//   - its ten skills on the action bar (keys 1–0, G auto) on every map, cast by
//     KitCaster: on the combat target / nearby monsters on the zone maps, on the
//     training dummy in the city
//   - the training ground: a row of dummies on ลานฝึกครู (TRAINING.dummy.spots) and a log
//     of every blow on them, totals and DPS (shown while standing at one); skills go to
//     the nearest dummy
//
//   const training = createClassAvatar(classId, { scene, camera, renderer, root, player, canStand, groundHeight, character, combat, hud });
//   → TrainingGround (classes with a kit) or a model-only avatar
//   training.enterMap(mapId)        after each map change (the dummy lives in TRAINING.map)
//   training.busy                   true while a skill plays (Game blocks walking)
//   training.onManualMove()         the player steered: drop a cast that was walking in
//   training.update(dt)             once per frame, after the player moved
//
// The player keeps its own movement; this only sets its look (Player.setAvatar)
// and drives the skills. Classes without a kit keep the combat skills that
// CombatHUD puts on the same action bar.

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
  return { busy: false, enterMap() {}, onManualMove() {}, update() {} };
}

export class TrainingGround {
  constructor({ scene, camera, renderer, root, player, canStand, groundHeight, character, combat, hud }, avatar, kit) {
    this.kit = kit; this.kitId = avatar.skills; this.combat = combat;
    const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
    const f = TRAINING.fighter;
    this.skillLevel = Math.max(1, Math.min(5, num('skill', f.skillLevel)));
    this.target = { def: num('ddef', TRAINING.dummy.def), eva: num('deva', TRAINING.dummy.eva) };   // the dummy's armour
    this.job = avatar.job ?? 'boxer';
    // The player's own stats (src/character, buffs included); ?lv= or no character uses the fixed trainee instead.
    this.hero = q.has('lv') ? null : character ?? null;
    this.fixedLevel = num('lv', f.level);
    this.fixed = jobDerived(this.job, f.byJob?.[this.job] ?? f.stats, this.fixedLevel);
    character?.on?.('change', () => this.renderSub?.());
    this.player = player; this.canStand = canStand; this.groundHeight = groundHeight; this.inGround = false;

    // The Player still walks and turns the avatar; this drives its skills.
    this.character = wearModel(player, scene, avatar);

    this.labels = $el('div', 'fx-labels'); this.dim = $el('div', 'fx-dim'); this.vignette = $el('div', 'fx-vignette');
    this.dummyLabels = $el('div', 'fx-dummy-labels'); this.labels.append(this.dummyLabels);
    root.append(this.vignette, this.dim, this.labels);
    // FX units are sized for a 2.6 m character; scale them to this one.
    this.fx = createFx({ scene, camera, renderer, labels: this.labels, size: FOREST_K * avatar.height / 2.6 });
    window.addEventListener('resize', () => this.fx.resize());

    this.stats = { total: 0, hits: 0, crits: 0, misses: 0, first: 0, last: 0, bySkill: {}, log: [] };
    this.clock = 0;
    this.panel = this.buildPanel(root);

    // The kit's runner hits whatever KitCaster binds: the dummy, a monster or nobody.
    this.caster = new KitCaster({
      kit, fx: this.fx, player, combat, character, canStand, skillLevel: this.skillLevel,
      stats: () => this.derived, dummy: () => (this.inGround ? this.dummy ?? null : null), nearDummy: () => this.near,
      dummyDefense: () => this.target, dummyRange: TRAINING.range,
      runnerFactory: (target, damage) => kit.createSkills({ fx: this.fx, character: this.character, player: player.group, dummy: target, groundHeight, labels: this.labels, dim: this.dim, damage }),
      // Every successful cast (keys, clicks or auto) gets the skill's own sounds (SKILL_SFX).
      onCast: skill => playSkillSound(skill, this.kitId),
    });
    this.skills = this.caster.runner;
    hud?.setSkills(this.caster, 'สกิล' + kit.name);
  }
  get lastSkill() { return this.caster?.lastSkill; }

  // Built lazily on entering the city so the dummies can stand on real, loaded ground.
  spawnDummies() {
    const d = TRAINING.dummy;
    // The FX root follows the player's ground height; seat it there before placing the dummies.
    this.fx.root.position.y = this.player.position.y;
    this.dummies = d.spots.map(([dx, dz]) => {
      let spot = null;
      for (let r = 0; r < 8 && !spot; r++) for (let a = 0; a < 8 && !spot; a++) {
        const x = dx + Math.sin(a * Math.PI / 4) * r * .5, z = dz - Math.cos(a * Math.PI / 4) * r * .5;
        if (this.canStand(x, z)) spot = new THREE.Vector3(x, this.groundHeight(x, z), z);
      }
      spot ??= new THREE.Vector3(dx, this.groundHeight(dx, dz), dz);
      return { spot, dummy: createDummy(this.fx, this.dummyLabels, spot, this.groundHeight, { hp: d.hp, onHit: e => this.record(e) }) };
    });
  }
  // The dummy nearest the player (the one skills hit) and where it stands.
  get closest() {
    if (!this.dummies) return null;
    const p = this.player.position, d = e => Math.hypot(p.x - e.spot.x, p.z - e.spot.z);
    return this.dummies.reduce((a, b) => (d(b) < d(a) ? b : a));
  }
  get dummy() { return this.closest?.dummy ?? null; }
  get spot() { return this.closest?.spot ?? null; }

  // The skills work on every map; the dummies (and their labels) only in TRAINING.map.
  enterMap(mapId) {
    this.inGround = mapId === TRAINING.map;
    if (this.inGround && !this.dummies) this.spawnDummies();
    for (const e of this.dummies ?? []) e.dummy.group.visible = this.inGround;
    this.dummyLabels.hidden = !this.inGround;
    this.caster.cancel();
    if (!this.inGround) this.setNear(false);
  }

  get near() { const s = this.inGround && this.spot; return !!s && Math.hypot(this.player.position.x - s.x, this.player.position.z - s.z) <= TRAINING.range; }
  get busy() { return !!this.skills?.busy; }
  onManualMove() { this.caster.cancel(); }

  setNear(on) {
    if (on === this.wasNear) return;
    this.wasNear = on;
    this.panel.hidden = !on;   // at the dummy: the damage log
  }

  update(dt) {
    const fx = this.fx;
    // Hit-stop: heavy blows freeze the fighter and effects for a few frames (the world keeps going).
    const sdt = fx.stop > 0 ? dt * .06 : dt; fx.stop = Math.max(0, fx.stop - dt);
    this.clock += sdt;
    this.skills.update(sdt);
    this.caster.update(sdt);
    this.setNear(this.near);
    // While a skill plays it moves and turns the avatar, and the combat basic attack waits.
    if (this.skills.busy && this.skills.facing !== null) this.player.group.rotation.y = this.skills.facing;
    if (this.combat) this.combat.hold = this.skills.busy;
    fx.update(sdt, this.clock, this.player.position.y);
    if (this.inGround) for (const e of this.dummies ?? []) e.dummy.update(sdt);
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
    Sound.sfx(e.killed ? 'kill' : e.miss ? 'miss' : e.bleed ? 'player_hurt' : e.crit ? 'hit_crit' : 'hit', { volume: e.bleed ? .4 : 1 });
    this.dirty = true;
  }
  reset() { this.stats = { total: 0, hits: 0, crits: 0, misses: 0, first: 0, last: 0, bySkill: {}, log: [] }; this.renderPanel(); }

  buildPanel(root) {
    const panel = $el('aside', 'training-panel glass');
    panel.hidden = true;
    panel.innerHTML = `
      <header><b>${this.kit.ground}</b><button type="button" class="training-reset" title="ล้างสถิติ">ล้าง</button></header>
      <p class="training-sub"></p>
      <dl class="training-sum"></dl>
      <ol class="training-log"></ol>
      <table class="training-skills"></table>
      <p class="training-tip">1–0 ใช้สกิล · G ออโต้ · ?lv=50&amp;skill=5&amp;ddef=40 ปรับค่าทดสอบ</p>`;
    panel.querySelector('.training-reset').addEventListener('click', () => this.reset());
    root.appendChild(panel);
    this.sub = panel.querySelector('.training-sub');
    this.sum = panel.querySelector('.training-sum'); this.logEl = panel.querySelector('.training-log'); this.table = panel.querySelector('.training-skills');
    this.renderSub();
    return panel;
  }
  get level() { return this.hero?.level ?? this.fixedLevel; }
  // Rules-shaped stats for rollSkill: the live character's, or the fixed trainee's.
  get derived() {
    const c = this.hero;
    if (!c) return this.fixed;
    return { ...c.derived, patk: c.patk, matk: c.matk, critRate: c.critChance };
  }
  renderSub() {
    if (!this.sub) return;
    const d = this.derived, hit = hitChanceOf(d.accuracy, this.target.eva), magic = this.hero?.cls.magic ?? ['healer', 'mage'].includes(this.job);
    this.sub.innerHTML = `${this.kit.name} Lv.${this.level} · สกิล Lv.${this.skillLevel} · ${magic ? `MATK ${d.matk}` : `ATK ${d.patk}`} · คริ ${(d.critRate * 100).toFixed(0)}% ×${d.critDmg.toFixed(2)} · โดน ${(hit * 100).toFixed(0)}%<br>หุ่น DEF ${this.target.def} · EVA ${this.target.eva}`;
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
