import { MONSTERS } from '../combat/data/monsters.js';
import { flaskKillCharges } from '../character/data/flasks.js';
import { keptLootDrops } from '../combat/lootDrops.js';
import { sameStatusSource } from '../combat/statusEffects.js';
import { Monster } from '../combat/Combat.js';
import { RULES } from '../combat/data/rules.js';
import { phaseOf } from '../core/WorldClock.js';
import { WorldBossFX } from '../combat/WorldBossFX.js';
import { shoveTo } from '../combat/monsterHit.js';
import { acceptMonsterStrike, releaseMonsterStrike, cancelMonsterStrike } from '../combat/monsterAttackTiming.js';
import { applyCombatState } from './combatState.js';
import { applyBossCardHit, applyBossCardKill } from '../combat/bossCardEffects.js';
import { wantedTypes } from '../ui/autoSettings.js';
import { mapOf } from '../world/maps.js';

// Shared monsters (phases 3a–3b of docs/technical/SERVER_SPLIT.md). Once the server sends
// a map's monsters, the browser's Combat (src/combat/Combat.js) stops running its own:
//   · the monsters, their HP and the day/night phase come from the server (eased between
//     its 10-a-second updates), and CombatView draws them through the usual events;
//   · the player's blows say only which skill landed on which monster ('cast' when a kit
//     skill starts, 'blow' per hit, 'basic' / 'pet' for swings and the dog); the server rolls
//     the damage, area splash and side effects (server/combatants.js) and everyone, this
//     player included, sees its numbers. The character sheet goes up with 'ch' on changes;
//   · a monster's swing at this player is resolved here (defence, dodge) as before.
// World bosses (src/combat/data/worldBoss.js): their skills are drawn on the floor (wbcast → a
// warning mark, wbfx → the blow, wbzone → pools; src/combat/WorldBossFX.js) and a skill that lands
// on this player (wbhit) takes a share of max HP (signed in: the server's numbers, res).
// Offline nothing changes: Combat keeps its local monsters.
//   const nc = attachNetCombat(net, game) · nc.update(dt)
const EASE = 12, ID = sid => `s${sid}`;
const STATES = ['dormant', 'idle', 'chase', 'return', 'dead', 'flee'];

export function attachNetCombat(net, game) {
  const combat = game.game.combat, c = game.game.character;
  const byId = new Map();
  let serverPhase = null, selfId = null;
  let locateAt = -Infinity, locateRequest = 0;
  combat.seekMapTarget = cfg => {
    if (!net.online || !combat.remote || Date.now() - locateAt < 1100) return combat.mapTarget ?? null;
    locateAt = Date.now();
    const p = combat.world.playerPos(), mobs = wantedTypes(cfg, mapOf(p.x, p.z));   // the hunt list (src/ui/autoSettings.js)
    net.send({ t: 'auto_target', request: ++locateRequest, elites: cfg.elites, attackers: cfg.attackers, ...(mobs ? { mobs: [...mobs] } : {}),
      exclude: combat.monsters.filter(m => Date.now() - (m.unreachableAt ?? -Infinity) < 6000).map(m => m.sid).filter(Number.isInteger).slice(0, 64) });
    return combat.mapTarget ?? null;
  };
  const cardLives = new Map();
  let me = null, hitSeqSeen = 0, killSeqSeen = 0;
  const takeState = (state, options) => {
    if (state?.owned) combat.serverOwned = true;
    if (state?.owned && Number.isFinite(state.hp)) {
      if (state.hp <= 0 && c.alive) combat.knockOut();
      else if (state.hp > 0 && !c.alive) combat.reviveHere(state.hp / c.maxHp);
    }
    return applyCombatState(c, state, options);
  };
  net.on('sync', () => { combat.serverOwned = true; });
  net.on('skill-state', msg => {
    if (!msg.state) return;
    combat.serverOwned ||= !!msg.state.owned;
    const before = c.hp;
    takeState(msg.state, { cleanse: !!msg.cleanse });
    // Guest vitals stay local, but self effects are paid only after acceptance.
    if (!msg.state.owned && msg.self) {
      if (msg.self.heal || msg.self.hp) c.heal(c.maxHp * (msg.self.heal || 0) + (msg.self.hp || 0));
      if (msg.self.mp) { c.mp = Math.min(c.maxMp, c.mp + c.maxMp * msg.self.mp); c.emit('change'); }
    }
    const p = combat.world.playerPos();
    if (c.hp > before) combat.emit('heal', { amount: Math.round(c.hp - before), x: p.x, z: p.z });
  });
  net.on('me', msg => { if (msg.state) takeState(msg.state); });

  // ---- server → local monsters ---------------------------------------------------------
  const make = (info, spawned = false) => {
    let m = byId.get(info.id);
    if (m && m.type !== info.type) { byId.delete(info.id); combat.monsters.splice(combat.monsters.indexOf(m), 1); m = null; }
    if (!m) {
      m = new Monster(info.type, { x: info.x, z: info.z, radius: 0, type: info.type }, info.x, info.z);
      m.id = ID(info.id); m.sid = info.id; byId.set(info.id, m); combat.monsters.push(m);
      cardLives.delete(info.id);
    }
    const life = cardLives.get(info.id);
    if (!life || spawned || (info.hp > 0 && (m.hp <= 0 || life.killed))) cardLives.set(info.id, { killed: false, claimed: false });
    Object.assign(m, { x: info.x, z: info.z, tx: info.x, tz: info.z, facing: info.f ?? 0, hp: info.hp, maxHp: info.maxHp ?? m.maxHp, state: STATES[info.st] ?? 'idle', debuffs: [], skillCast: info.skillCast ?? null });
    if (info.generation !== undefined && info.generation > (m.strikeGeneration ?? 0)) {
      combat.cancelMonsterAttack(m); m.strikeGeneration = info.generation; m.strikeSequence = 0; m.releasedStrike = 0;
    }
    if (info.lv && info.lv !== m.def.level) m.def = { ...m.def, level: info.lv };   // a world boss risen at its players' tier
    return m;
  };
  const gone = m => { combat.cancelMonsterAttack(m); m.hp = 0; m.state = 'dead'; m.debuffs = []; if (combat.target === m) combat.setTarget(null); };

  net.on('mlist', msg => {
    locateRequest++; combat.mapTarget = null;
    for (const m of combat.monsters) combat.cancelMonsterAttack(m);
    combat.emit('boss-skills-clear');
    // first list on this map: the local monsters step aside for the server's
    if (!combat.remote) {
      combat.remote = true;
      for (const m of combat.monsters) if (m.alive) combat.emit('despawn', m);
      combat.monsters.length = 0;
      const setPhase = combat.setPhase.bind(combat);
      combat.setPhase = phase => setPhase(serverPhase ?? phase);   // the server's clock decides who spawns
    }
    for (const m of combat.monsters) if (m.alive && !msg.m.some(i => ID(i.id) === m.id)) { combat.emit('despawn', m); gone(m); }
    for (const info of msg.m) {
      const monster = make(info); combat.emit('spawn', monster);
      if (info.strike && (selfId === null || info.strike.to === selfId) && acceptMonsterStrike(monster, info.strike, true)) combat.emit('monster-attack', monster);
      if (info.skillCast) { monster.skillCast = info.skillCast; combat.emit('boss-skill', { monster, stage: 'windup', cast: info.skillCast }); }
    }
  });
  net.on('mspawn', msg => combat.emit('spawn', make(msg.m, true)));
  net.on('auto_target', msg => {
    if (msg.request !== locateRequest || msg.map !== game.maps?.map?.id) return;
    if (!msg.m) { combat.mapTarget = null; return; }
    let m = byId.get(msg.m.id);
    if (!m) { m = make(msg.m); combat.emit('spawn', m); }
    else Object.assign(m, { tx: msg.m.x, tz: msg.m.z, hp: msg.m.hp, state: STATES[msg.m.st] ?? 'idle' });
    m.map = msg.map; combat.mapTarget = m;
  });
  net.on('mt', msg => {
    for (const [sid, x, z, f, hp, st, mv] of msg.m) {
      const m = byId.get(sid); if (!m) continue;
      m.tx = x; m.tz = z; m.facing = f; m.hp = hp; m.state = STATES[st] ?? m.state; m.moving = !!mv;
      if (m.strike && (!m.alive || m.state !== 'chase')) combat.cancelMonsterAttack(m);
    }
  });
  net.on('mh', msg => {
    const ownReceipt = net.online && me != null && msg.by === me && Number.isSafeInteger(msg.hitSeq) && msg.hitSeq > 0;
    if (ownReceipt && msg.hitSeq <= hitSeqSeen) return;
    // Consume before every eligibility check, including missing monsters,
    // miss/pet/DoT, cooldown, full/dead wearers, absent cards and invalid removal.
    if (ownReceipt) hitSeqSeen = msg.hitSeq;
    const m = byId.get(msg.id); if (!m) return;
    if (msg.miss) { combat.emit('miss', { x: m.x, z: m.z, monster: m }); return; }
    const hp = m.hp, life = cardLives.get(msg.id);
    m.hp = Math.max(0, m.hp - msg.amount);
    if (life && hp > 0 && m.hp <= 0) life.killed = true;
    if (m.hp <= 0) m.debuffs = [];   // its effects die with it
    if (!combat.serverOwned && ownReceipt) {
      // The display snapshot can precede this event. Only the server's exact
      // HP removal is eligible; a rolled overkill or stale local delta is not.
      const removed = Number.isFinite(msg.removed) && msg.removed > 0 && msg.removed <= m.maxHp ? msg.removed : 0;
      const healed = applyBossCardHit(c, combat.bossCardProcs, Date.now() / 1000, removed, { pet: !!msg.pet, dot: !!msg.dot });
      if (healed) { const p = combat.world.playerPos(); combat.emit('heal', { amount: healed, x: p.x, z: p.z }); }
    }
    combat.emit('hit', { monster: m, amount: msg.amount, crit: msg.crit, dot: msg.dot, pet: msg.pet, x: m.x, z: m.z });
  });
  net.on('nope', msg => { const why = { cooldown: 'สกิลยังไม่พร้อม', mp: 'MP ไม่พอ', not_learnt: 'ยังไม่ได้เรียนสกิลนี้', casting: 'ร่ายไม่ทัน' }[msg.why]; if (why) combat.emit('fail', why); });
  // an effect the server landed on a monster (anyone's): stun / slow / damage over time
  net.on('md', msg => {
    const m = byId.get(msg.id); if (!m?.alive || !msg.d?.id) return;
    m.debuffs = m.debuffs.filter(o => !sameStatusSource(o, msg.d));
    m.debuffs.push({ ...msg.d, remaining: msg.d.secs });
    combat.emit('debuffed', { monster: m, debuff: msg.d });
  });
  // the link dropped: the server's monsters go (they are its), nothing can be fought until it is back
  net.on('status', on => {
    if (on) return;
    me = null; hitSeqSeen = killSeqSeen = 0; cardLives.clear();
    combat.serverOwned = false;
    combat.emit('boss-skills-clear');
    for (const m of combat.monsters) if (m.alive) { combat.emit('despawn', m); gone(m); }
    combat.pending = null; combat.autoAttack = false;
    combat.emit('fail', 'ขาดการเชื่อมต่อ · กำลังเชื่อมต่อใหม่');
  });
  // Map/channel welcomes refresh monsters within the same character session.
  // Only a new identity (or the disconnect handler) resets HP/SP receipts.
  net.on('welcome', msg => {
    if (msg.you !== me) hitSeqSeen = killSeqSeen = 0;
    selfId = msg?.you ?? null; me = msg.you; cardLives.clear();
    for (const m of combat.monsters) if (m.alive) { combat.emit('despawn', m); gone(m); }
    byId.clear(); combat.monsters.length = 0;
  });
  net.on('mgone', msg => {
    const m = byId.get(msg.id); if (!m) return;
    const life = cardLives.get(msg.id);
    if (msg.killed && life) life.killed = true;
    if (!m.alive && m.state === 'dead') return;
    combat.emit('despawn', m); gone(m);
  });
  // this player's share of a kill: the usual kill event (log, quests) and the rewards
  net.on('kill', msg => {
    const ownReceipt = net.online && me != null && msg.to === me && Number.isSafeInteger(msg.killSeq) && msg.killSeq > 0;
    if (ownReceipt && msg.killSeq <= killSeqSeen) return;
    // Consume genuine owner receipts before life/card/vital/cooldown checks.
    // Same-session welcomes and replayed death messages cannot reuse them.
    if (ownReceipt) killSeqSeen = msg.killSeq;
    const m = byId.get(msg.id) ?? { name: '', x: c.x ?? 0, z: c.z ?? 0, def: {} };
    const life = cardLives.get(msg.id);
    if (!combat.serverOwned && ownReceipt && life?.killed && !life.claimed && m.hp <= 0) {
      // Consume this life even if the wearer is dead/full or has unequipped.
      // An EXP-only helper share does not carry the loot owner's ability.
      life.claimed = true;
      if (msg.gold > 0 || msg.drops?.length > 0) applyBossCardKill(c, combat.bossCardProcs, Date.now() / 1000);
    }
    const lost = msg.lost ?? [];   // drops the server could not fit in the bag
    const kept = keptLootDrops(msg.drops, lost);
    combat.emit('kill', { monster: m, exp: msg.exp, gold: msg.gold, drops: kept });
    if (lost.length) combat.emit('fail', 'กระเป๋าเต็ม · ของที่ตกหายไป');
    c.gold += msg.gold; c.gainExp(msg.exp);
    const def = MONSTERS[msg.type]; if (def) c.refillFlasks('kill', flaskKillCharges(def));
    for (const d of kept) c.addInstance(d);
    c.emit('change');
  });
  // ---- world boss skills ----------------------------------------------------------------
  const bossFx = game.scene ? new WorldBossFX(game.scene, (x, z) => game.world?.heightAt(x, z) ?? 0) : null;   // no scene: a headless test
  net.on('wbcast', msg => bossFx?.cast(msg));
  net.on('wbfx', msg => { bossFx?.land(msg); const m = byId.get(msg.id); if (m?.alive && msg.skill !== 'warp') combat.emit('monster-attack', m); });
  net.on('wbzone', msg => bossFx?.zone(msg));
  net.on('wbhit', msg => {
    if (!c.alive || msg.res?.dodge) return;
    const m = byId.get(msg.id);
    const dealt = msg.res ? (c.hp = Math.max(1, Math.round(msg.res.hp + msg.res.dmg)), c.damage(msg.res.hp > 0 ? msg.res.dmg : c.hp)) : c.damage(Math.max(1, Math.round(c.maxHp * msg.pct)));
    const p = combat.world.playerPos();
    combat.combatTimer = RULES.combatTimeout;
    combat.emit('player-hit', { amount: dealt, x: p.x, z: p.z, monster: m });
    if (c.alive && msg.knock && m) { const to = shoveTo(m, p, { knock: true }, combat.world.canStand); if (to) { p.x = to.x; p.z = to.z; combat.emit('shoved', { monster: m, ...to, pull: false }); } }
    if (!c.alive) { combat.autoAttack = false; combat.pending = null; combat.setTarget(null); combat.emit('player-death', m); }
  });
  net.on('welcome', () => bossFx?.clear());

  net.on('ma', msg => {   // res: resolved on the server (signed in); knock / pull: where the hit throws the player
    const m = byId.get(msg.id);
    if (!m || !c.alive) return;
    const fx = { knock: !!msg.knock, pull: !!msg.pull, power: msg.power ?? 1, skill: msg.skill };
    if (msg.attackId !== undefined) {
      // The first authoritative result must land even if the start packet was lost.
      if (releaseMonsterStrike(m, msg.attackId, msg.generation)) combat.releaseMonsterAttack(m, msg.res ?? null, fx);
    } else combat.monsterAttack(m, msg.res ?? null, fx);
  });
  net.on('mstrike', msg => {
    const m = byId.get(msg.id); if (!m || !m.alive) return;
    if (msg.stage === 'windup') {
      if (acceptMonsterStrike(m, msg)) {
        m.attackTimer = m.def.attackDelay ?? (m.def.elite ? RULES.eliteAttackDelay : RULES.monsterAttackDelay);
        m.swungAtMe = Date.now();
        combat.combatTimer = RULES.combatTimeout;
        combat.emit('monster-attack', m);
      }
    } else if (msg.stage === 'cancel' && Number.isSafeInteger(msg.attackId) && msg.attackId > 0
      && Number.isSafeInteger(msg.generation) && msg.generation >= (m.strikeGeneration ?? 0)) {
      if (msg.generation > (m.strikeGeneration ?? 0)) {
        combat.cancelMonsterAttack(m); m.strikeGeneration = msg.generation; m.strikeSequence = 0; m.releasedStrike = 0;
      }
      m.strikeSequence = Math.max(m.strikeSequence ?? 0, msg.attackId);
      m.releasedStrike = Math.max(m.releasedStrike ?? 0, msg.attackId);
      if (m.strike?.attackId === msg.attackId) { cancelMonsterStrike(m); combat.emit('monster-attack-cancel', m); }
    }
  });
  net.on('mskill', msg => {
    const monster = byId.get(msg.id); if (!monster) return;
    monster.skillCast = msg.stage === 'windup' ? msg.cast : null;
    combat.emit('boss-skill', { monster, stage: msg.stage, cast: msg.cast });
  });
  net.on('clock', msg => {
    serverPhase = phaseOf(msg.h);
    if (!game.clock.paused) game.clock.set(msg.h);
    if (combat.remote) combat.setPhase(serverPhase);
  });

  // ---- local blows → server --------------------------------------------------------------
  // The local roll only drives the animation; hit or miss, the server rolls the real blow.
  const damage = combat.damageMonster.bind(combat);
  combat.damageMonster = (m, amount, o = {}) => {
    if (!combat.remote || !m?.sid) return damage(m, amount, o);
    if (!m.alive || !net.online) return false;
    combat.combatTimer = RULES.combatTimeout;
    const hpFraction = c.maxHp > 0 && Number.isFinite(c.hp) ? Math.max(0, Math.min(1, c.hp / c.maxHp)) : 0;
    net.send({ t: 'blow', id: m.sid, skill: o.skill ?? 'basic', ...(o.pounce ? { pounce: 1 } : {}), ...(!combat.serverOwned ? { hpFraction } : {}) });
    return true;   // side effects (stun, slow, damage over time) are the server's too
  };
  combat.on('sit', on => net.send({ t: 'sit', v: !!on }));   // the server doubles the regen too (server/combatants.js sit)
  combat.on('kit-cast', e => { if (combat.remote) net.send({ t: 'cast', skill: e.id, ...(e.ally != null ? { ally: e.ally } : {}) }); });   // ally: the friend a heal goes to
  combat.on('casting', e => { if (combat.remote && !e.practice) net.send({ t: 'casting', skill: e.id }); });   // a cast bar: the server times it
  combat.on('cast', e => { if (combat.remote && !e.skill?.basic) net.send({ t: 'cast', skill: e.skillId }); });
  // the character sheet the server rolls with: sent on join and whenever level, points or gear change
  let sheetKey = '';
  const sheet = (force = false) => {
    const { name, classId, gender, level, points, alloc, equipment, jobLevel, skills, cards, evo, refine } = c.toJSON(), data = { name, classId, gender, level, points, alloc, equipment, jobLevel, skills, cards, evo, refine };
    const key = JSON.stringify(data);
    if (!force && key === sheetKey) return;
    sheetKey = key; net.send({ t: 'ch', data });
  };
  net.on('welcome', () => sheet(true));
  let sheetDue = false;   // at most once a frame-ish: 'change' fires every tick while poisoned or healing over time
  const queueSheet = () => { if (sheetDue) return; sheetDue = true; setTimeout(() => { sheetDue = false; sheet(); }, 250); };
  c.on('change', queueSheet); c.on('inventory', queueSheet);
  combat.on('player-death', () => net.send({ t: 'dead', v: true }));
  combat.on('player-respawn', () => net.send({ t: 'dead', v: false }));
  combat.on('player-revived', () => net.send({ t: 'dead', v: false }));

  return {
    monster: sid => byId.get(sid) ?? null,   // a monster by the server's id (src/net/RemoteSkills.js)
    sidOf: m => m?.sid ?? null,
    // monsters glide toward the server's spots between updates
    update(dt) {
      bossFx?.update(dt);
      if (!combat.remote) return;
      const k = 1 - Math.exp(-EASE * dt);
      for (const m of byId.values()) {
        if (!m.alive || m.tx === undefined) continue;
        if (Math.hypot(m.tx - m.x, m.tz - m.z) > 8) { m.x = m.tx; m.z = m.tz; }
        m.x += (m.tx - m.x) * k; m.z += (m.tz - m.z) * k;
      }
    },
  };
}
