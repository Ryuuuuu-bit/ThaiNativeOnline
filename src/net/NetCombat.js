import { Monster } from '../combat/Combat.js';
import { RULES } from '../combat/data/rules.js';
import { phaseOf } from '../core/WorldClock.js';
import { applyCombatState } from './combatState.js';

// Shared monsters (phases 3a–3b of docs/technical/SERVER_SPLIT.md). Once the server sends
// a map's monsters, the browser's Combat (src/combat/Combat.js) stops running its own:
//   · the monsters, their HP and the day/night phase come from the server (eased between
//     its 10-a-second updates), and CombatView draws them through the usual events;
//   · the player's blows say only which skill landed on which monster ('cast' when a kit
//     skill starts, 'blow' per hit, 'basic' / 'pet' for swings and the dog); the server rolls
//     the damage, area splash and side effects (server/combatants.js) and everyone, this
//     player included, sees its numbers. The character sheet goes up with 'ch' on changes;
//   · a monster's swing at this player is resolved here (defence, dodge) as before.
// Offline nothing changes: Combat keeps its local monsters.
//   const nc = attachNetCombat(net, game) · nc.update(dt)
const EASE = 12, ID = sid => `s${sid}`;
const STATES = ['dormant', 'idle', 'chase', 'return', 'dead', 'flee'];

export function attachNetCombat(net, game) {
  const combat = game.game.combat, c = game.game.character;
  const byId = new Map();
  let serverPhase = null;
  const takeState = (state, options) => {
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
  const make = info => {
    let m = byId.get(info.id);
    if (m && m.type !== info.type) { byId.delete(info.id); combat.monsters.splice(combat.monsters.indexOf(m), 1); m = null; }
    if (!m) {
      m = new Monster(info.type, { x: info.x, z: info.z, radius: 0, type: info.type }, info.x, info.z);
      m.id = ID(info.id); m.sid = info.id; byId.set(info.id, m); combat.monsters.push(m);
    }
    Object.assign(m, { x: info.x, z: info.z, tx: info.x, tz: info.z, facing: info.f ?? 0, hp: info.hp, maxHp: info.maxHp ?? m.maxHp, state: STATES[info.st] ?? 'idle', debuffs: [], skillCast: info.skillCast ?? null });
    return m;
  };
  const gone = m => { m.hp = 0; m.state = 'dead'; m.debuffs = []; if (combat.target === m) combat.setTarget(null); };

  net.on('mlist', msg => {
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
      if (info.skillCast) { monster.skillCast = info.skillCast; combat.emit('boss-skill', { monster, stage: 'windup', cast: info.skillCast }); }
    }
  });
  net.on('mspawn', msg => combat.emit('spawn', make(msg.m)));
  net.on('mt', msg => {
    for (const [sid, x, z, f, hp, st, mv] of msg.m) {
      const m = byId.get(sid); if (!m) continue;
      m.tx = x; m.tz = z; m.facing = f; m.hp = hp; m.state = STATES[st] ?? m.state; m.moving = !!mv;
    }
  });
  net.on('mh', msg => {
    const m = byId.get(msg.id); if (!m) return;
    if (msg.miss) { combat.emit('miss', { x: m.x, z: m.z, monster: m }); return; }
    m.hp = Math.max(0, m.hp - msg.amount);
    if (m.hp <= 0) m.debuffs = [];   // its effects die with it
    combat.emit('hit', { monster: m, amount: msg.amount, crit: msg.crit, dot: msg.dot, pet: msg.pet, x: m.x, z: m.z });
  });
  net.on('nope', msg => { const why = { cooldown: 'สกิลยังไม่พร้อม', mp: 'MP ไม่พอ', not_learnt: 'ยังไม่ได้เรียนสกิลนี้', casting: 'ร่ายไม่ทัน' }[msg.why]; if (why) combat.emit('fail', why); });
  // an effect the server landed on a monster (anyone's): stun / slow / damage over time
  net.on('md', msg => {
    const m = byId.get(msg.id); if (!m?.alive || !msg.d?.id) return;
    m.debuffs = m.debuffs.filter(o => o.id !== msg.d.id);
    m.debuffs.push({ ...msg.d, remaining: msg.d.secs });
    combat.emit('debuffed', { monster: m, debuff: msg.d });
  });
  // the link dropped: the server's monsters go (they are its), nothing can be fought until it is back
  net.on('status', on => {
    if (on) return;
    combat.serverOwned = false;
    combat.emit('boss-skills-clear');
    for (const m of combat.monsters) if (m.alive) { combat.emit('despawn', m); gone(m); }
    combat.pending = null; combat.autoAttack = false;
    combat.emit('fail', 'ขาดการเชื่อมต่อ · กำลังเชื่อมต่อใหม่');
  });
  // the server restarted (ids start over): forget the old monsters before the new list
  net.on('welcome', () => { for (const m of combat.monsters) if (m.alive) { combat.emit('despawn', m); gone(m); } byId.clear(); combat.monsters.length = 0; });
  net.on('mgone', msg => { const m = byId.get(msg.id); if (!m || !m.alive && m.state === 'dead') return; combat.emit('despawn', m); gone(m); });
  // this player's share of a kill: the usual kill event (log, quests) and the rewards
  net.on('kill', msg => {
    const m = byId.get(msg.id) ?? { name: '', x: c.x ?? 0, z: c.z ?? 0, def: {} };
    const lost = msg.lost ?? [];   // drops the server could not fit in the bag
    const kept = msg.drops.filter(d => !lost.includes(d) && !lost.some(l => l.id === d.id && l.qty === d.qty));
    combat.emit('kill', { monster: m, exp: msg.exp, gold: msg.gold, drops: kept });
    if (lost.length) combat.emit('fail', 'กระเป๋าเต็ม · ของที่ตกหายไป');
    c.gold += msg.gold; c.gainExp(msg.exp);
    for (const d of kept) c.addItem(d.id, d.qty);
    c.emit('change');
  });
  net.on('ma', msg => {   // res: resolved on the server (signed in); knock / pull: where the hit throws the player
    const m = byId.get(msg.id);
    if (m && c.alive) combat.monsterAttack(m, msg.res ?? null, { knock: !!msg.knock, pull: !!msg.pull, power: msg.power ?? 1, skill: msg.skill });
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
    net.send({ t: 'blow', id: m.sid, skill: o.skill ?? 'basic', ...(o.pounce ? { pounce: 1 } : {}) });
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
