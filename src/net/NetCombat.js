import { Monster } from '../combat/Combat.js';
import { RULES } from '../combat/data/rules.js';
import { phaseOf } from '../core/WorldClock.js';

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

  // ---- server → local monsters ---------------------------------------------------------
  const make = info => {
    let m = byId.get(info.id);
    if (!m) {
      m = new Monster(info.type, { x: info.x, z: info.z, radius: 0, type: info.type }, info.x, info.z);
      m.id = ID(info.id); m.sid = info.id; byId.set(info.id, m); combat.monsters.push(m);
    }
    Object.assign(m, { x: info.x, z: info.z, tx: info.x, tz: info.z, facing: info.f ?? 0, hp: info.hp, maxHp: info.maxHp ?? m.maxHp, state: STATES[info.st] ?? 'idle', debuffs: [] });
    return m;
  };
  const gone = m => { m.hp = 0; m.state = 'dead'; if (combat.target === m) combat.setTarget(null); };

  net.on('mlist', msg => {
    // first list on this map: the local monsters step aside for the server's
    if (!combat.remote) {
      combat.remote = true;
      for (const m of combat.monsters) if (m.alive) combat.emit('despawn', m);
      combat.monsters.length = 0;
      const setPhase = combat.setPhase.bind(combat);
      combat.setPhase = phase => setPhase(serverPhase ?? phase);   // the server's clock decides who spawns
    }
    for (const m of combat.monsters) if (m.alive && !msg.m.some(i => ID(i.id) === m.id)) { combat.emit('despawn', m); gone(m); }
    for (const info of msg.m) combat.emit('spawn', make(info));
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
  net.on('mgone', msg => { const m = byId.get(msg.id); if (!m || !m.alive && m.state === 'dead') return; combat.emit('despawn', m); gone(m); });
  // this player's share of a kill: the usual kill event (log, quests) and the rewards
  net.on('kill', msg => {
    const m = byId.get(msg.id) ?? { name: '', x: c.x ?? 0, z: c.z ?? 0, def: {} };
    combat.emit('kill', { monster: m, exp: msg.exp, gold: msg.gold, drops: msg.drops });
    c.gold += msg.gold; c.gainExp(msg.exp);
    for (const d of msg.drops) c.addItem(d.id, d.qty);
    c.emit('change');
  });
  net.on('ma', msg => {   // res: resolved on the server (signed in); knock / pull: where the hit throws the player
    const m = byId.get(msg.id);
    if (m && c.alive) combat.monsterAttack(m, msg.res ?? null, { knock: !!msg.knock, pull: !!msg.pull });
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
    if (!m.alive) return false;
    combat.combatTimer = RULES.combatTimeout;
    net.send({ t: 'blow', id: m.sid, skill: o.skill ?? 'basic', ...(o.pounce ? { pounce: 1 } : {}) });
    return true;   // side effects (stun, slow, damage over time) are the server's too
  };
  combat.on('sit', on => net.send({ t: 'sit', v: !!on }));   // the server doubles the regen too (server/combatants.js sit)
  combat.on('kit-cast', e => { if (combat.remote) net.send({ t: 'cast', skill: e.id }); });
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
  c.on('change', () => sheet()); c.on('inventory', () => sheet());
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
