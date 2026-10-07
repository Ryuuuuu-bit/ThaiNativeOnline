// Farming simulator: every class with AUTO on in a real zone, using the game's own
// Combat, KitCaster, rules damage and AUTO settings. No rendering, so minutes of play
// run in a second. Use it after touching skill numbers, stats or monsters.
//
//   node tools/sim/farm-sim.mjs [zone=paddy] [level=2] [minutes=5] [runs=3]
//
// Per class: kills per minute, deaths, potions drunk, lowest HP, and where the damage
// came from (kit skills / basic attacks / the hunter's dog). Approximations: kit
// blows land at the moves' hit times (more blows spread after the first for multi-hit
// rules skills); the player walks straight at 4.2 m/s; day time.
import * as THREE from 'three';
import { Character } from '../../src/character/Character.js';
import { Combat } from '../../src/combat/Combat.js';
import { KitCaster } from '../../src/training/KitCaster.js';
import { SKILL_BY_ID } from '../../src/rules/data/skills.js';
import { combatSpawns } from '../../src/data/spawns.js';
import { mapOf } from '../../src/world/maps.js';
import { lockTime } from '../../src/classes/tempo.js';
import { normalizeAuto, autoPotion, pickTarget, castOrder } from '../../src/ui/autoSettings.js';
import { MUAYTHAI_SKILLS } from '../../src/classes/muaythai-moves.js';
import { WARRIOR_SKILLS } from '../../src/classes/warrior-moves.js';
import { HUNTER_SKILLS } from '../../src/classes/hunter-moves.js';
import { SHAMAN_SKILLS } from '../../src/classes/shaman-moves.js';
import { HERBALIST_SKILLS } from '../../src/classes/herbalist-moves.js';

const [zone = 'paddy', level = '2', minutes = '5', runs = '3'] = process.argv.slice(2);
const KITS = { muaythai: MUAYTHAI_SKILLS, warrior: WARRIOR_SKILLS, hunter: HUNTER_SKILLS, shaman: SHAMAN_SKILLS, herbalist: HERBALIST_SKILLS };
const BUILD = { muaythai: ['str', 'agi'], warrior: ['str', 'vit'], hunter: ['dex', 'agi'], shaman: ['int', 'dex'], herbalist: ['int', 'vit'] };
const DT = .05, WALK = 4.2;

// A stand-in for the FX runner: blows at the moves' hit times, busy for the lock time.
function simRunner(target, damage, kit) {
  const M = Object.fromEntries(kit.map(s => [s.id, s])), q = [];
  const R = { busy: false, range: Infinity, current: null, until: 0, t: 0 };
  R.cast = id => {
    const m = M[id], rule = SKILL_BY_ID[id] ?? {};
    R.current = id;
    const blows = Math.max(m.hits.length, rule.hits ?? 1) * (rule.count ?? 1) + (rule.petBites ?? 0);
    const step = (rule.interval ?? 250) / 1000 / (m.speed || 1);
    for (let i = 0; i < blows; i++) q.push({ at: R.t + (m.hits[i] ?? (m.hits[0] ?? .3) + (i - m.hits.length + 1) * step), id });
    R.until = R.t + lockTime(m, m.authored ?? m.duration);
    return R.until - R.t;
  };
  R.update = dt => {
    R.t += dt; R.busy = R.t < R.until;
    for (let i = q.length - 1; i >= 0; i--) if (q[i].at <= R.t) {
      const { id } = q.splice(i, 1)[0]; R.current = id;
      if (!target.alive) continue;
      const r = damage(id);
      if (!r || !r.dmg) target.hurt(50, false); else if (r.dmg < 0 || !r.hit) target.miss(); else target.hurt(r.dmg, r.crit, .1, null, true);
    }
  };
  return R;
}

function run(classId) {
  const c = Character.create('sim', classId);
  c.level = Number(level); c.points += (c.level - 1) * 3;
  // spend the stat points a player would have, on the class's two main stats
  for (let i = 0; c.points > 0 && i < 400; i++) c.allocate(BUILD[classId][i % 2]);
  c.hp = c.maxHp; c.mp = c.maxMp;
  for (let i = 0; i < 10; i++) c.addItem('potion_s'); for (let i = 0; i < 5; i++) c.addItem('ether');
  const zones = combatSpawns().filter(z => mapOf(z.x, z.z) === zone);
  const start = zones[0];
  const player = { group: new THREE.Group() }; player.position = player.group.position; player.position.set(start.x + 3, 0, start.z + 3);
  let dest = null;
  const world = { canStand: () => true, playerPos: () => player.position, moveTo: (x, z) => { dest = { x, z }; }, stop() { dest = null; } };
  const combat = new Combat(c, world, zones);
  combat.setPhase?.('day');
  const kit = KITS[classId];
  const fx = { K: 1, root: { position: { y: 0 } }, toLocal: v => v.clone(), addTask() {} };
  let runner = null;
  const caster = new KitCaster({ kit: { skills: kit }, fx, player, combat, character: c, canStand: () => true, skillLevel: 1,
    stats: () => ({ ...c.derived, patk: c.patk, matk: c.matk, critRate: c.critChance, critDmg: c.critDamage, accuracy: c.accuracy }),
    dummy: () => null, nearDummy: () => false, dummyDefense: () => ({ def: 0, eva: 0 }), dummyRange: 12,
    runnerFactory: (t, damage) => (runner = simRunner(t, damage, kit)) });
  const cfg = normalizeAuto({ range: 'far' });
  const S = { kills: 0, deaths: 0, potions: 0, hpPot: 0, mpPot: 0, minHp: 1, skill: 0, basic: 0, pet: 0 };
  combat.on('kill', () => S.kills++);
  combat.on('hit', e => { if (e.pet) S.pet += e.amount; else if (runner?.busy || caster.lastSkill && caster.affected.size) S.skill += e.amount; else S.basic += e.amount; });
  c.on('used', id => { S.potions++; if (id === 'ether') S.mpPot++; else S.hpPot++; });
  let potionWait = 0, autoWait = 0, next = 0, deadFor = 0;
  const slots = kit.map(s => ({ survival: !!s.quick }));
  for (let t = 0; t < Number(minutes) * 60; t += DT) {
    if (!c.alive) { if ((deadFor += DT) > 2) { S.deaths++; combat.respawnPlayer(); deadFor = 0; } continue; }
    // walk
    if (dest) { const dx = dest.x - player.position.x, dz = dest.z - player.position.z, L = Math.hypot(dx, dz); if (L < .05) dest = null; else { const s = Math.min(L, WALK * DT); player.position.x += dx / L * s; player.position.z += dz / L * s; } }
    // AUTO (the ActionBar's loop)
    const hp = c.hp / c.maxHp; S.minHp = Math.min(S.minHp, hp);
    if ((potionWait -= DT) <= 0) { const k = autoPotion(cfg, hp, c.mp / c.maxMp); if (k && c.quickUse(k)) potionWait = 1.5; }
    if (!caster.busy && (autoWait -= DT) <= 0) {
      const tg = pickTarget(combat.monsters, player.position, cfg, combat.target);
      if (tg && tg !== combat.target) combat.setTarget(tg);
      let cast = false;
      for (const i of castOrder(slots, cfg, hp, next)) if (caster.cooldown(i)[0] <= 0 && caster.cast(i, true)) { next = i + 1; cast = true; break; }
      autoWait = cast ? .35 : .3;
      if (cfg.basic && combat.target?.alive && !combat.autoAttack) combat.useSkill(combat.basicSkillId());
      if (!combat.target && !dest) { const m = combat.monsters.find(x => x.alive); if (m) world.moveTo(m.x, m.z); }
    }
    caster.update(DT); runner?.update(DT); combat.hold = !!runner?.busy;
    combat.update(DT); c.tick?.(DT, combat.inCombat);
    // the dog is never borrowed in the sim (no FX), so its own bites always run
  }
  const total = S.skill + S.basic + S.pet || 1;
  return { kpm: S.kills / Number(minutes), deaths: S.deaths, potions: S.potions, hpPot: S.hpPot, mpPot: S.mpPot, minHp: S.minHp, mix: [S.skill / total, S.basic / total, S.pet / total] };
}

const pct = v => `${Math.round(v * 100)}%`;
console.log(`zone ${zone} · Lv ${level} · ${minutes} min × ${runs} runs (AUTO, range far, potions 40%/25%)`);
console.log('class       kills/min  deaths  HP pots  MP pots  lowest HP   damage: skills / basic / dog');
for (const id of Object.keys(KITS)) {
  const rs = Array.from({ length: Number(runs) }, () => run(id)), avg = k => rs.reduce((n, r) => n + r[k], 0) / rs.length;
  const mix = [0, 1, 2].map(i => rs.reduce((n, r) => n + r.mix[i], 0) / rs.length);
  console.log(`${id.padEnd(11)} ${avg('kpm').toFixed(1).padStart(9)}  ${avg('deaths').toFixed(1).padStart(6)}  ${avg('hpPot').toFixed(1).padStart(7)}  ${avg('mpPot').toFixed(1).padStart(7)}  ${pct(Math.min(...rs.map(r => r.minHp))).padStart(9)}   ${mix.map(pct).join(' / ')}`);
}
