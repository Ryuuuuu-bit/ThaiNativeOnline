// A signed-in character's progress belongs to the server (phase 3c of
// docs/technical/SERVER_SPLIT.md, server/progress.js). Once the server sends `sync` (its copy
// of the character) this browser:
//   · takes that copy (level, EXP, job level, skills, points, gold, bag, gear, HP, MP, quests);
//   · still does the player's own actions at once (buy, sell, use, equip, stat / skill points, sort)
//     and mirrors each as an `op`, which the server replays with the same code. A refused one
//     brings the server's copy back;
//   · follows the server's HP and MP (1×/s) when the two drift apart.
// Kill rewards come in through NetCombat's `kill` (applied here and on the server alike).
// Phase 4: HP is the server's too (its swings arrive with NetCombat's `ma`; regen follows
// `me`), and so are quests: accepting, handing in and talking are mirrored, and `sync`
// carries the server's quest state.
// A `sync` older than this browser's last action is not applied: it asks for a fresh one.
// Guests (no `sync`) keep everything local, as before.
//   attachNetProgress(net, character, quests?)
export function attachNetProgress(net, c, quests = null) {
  let on = false, sent = 0, depth = 0;
  const op = msg => { if (on && net.online) { sent++; net.send({ t: 'op', n: sent, ...msg }); } };
  // the character's own actions (by index here, by item id on the server); an action done
  // inside another (using a sword equips it) is not sent twice
  const wrap = (name, toMsg) => {
    const f = c[name].bind(c);
    c[name] = (...args) => {
      const msg = depth ? null : toMsg(...args);
      depth++; let r; try { r = f(...args); } finally { depth--; }
      if (r && msg) op(msg);
      return r;
    };
  };
  const idAt = i => c.inventory[i]?.id;
  // gear is named with the cards it holds (two swords with different cards are different items)
  const held = i => (c.inventory[i]?.cards?.length ? { cards: [...c.inventory[i].cards] } : {});
  wrap('useAt', i => idAt(i) && { op: 'use', id: idAt(i), ...held(i) });
  wrap('sellAt', i => idAt(i) && { op: 'sell', id: idAt(i), ...held(i) });
  wrap('equip', i => idAt(i) && { op: 'equip', id: idAt(i), ...held(i) });
  wrap('insertCard', (i, where) => idAt(i) && (typeof where === 'string' ? { op: 'card', id: idAt(i), worn: where } : { op: 'card', id: idAt(i), item: idAt(where), has: [...(c.inventory[where]?.cards ?? [])] }));
  wrap('unequip', slot => ({ op: 'unequip', slot }));
  wrap('allocate', key => ({ op: 'alloc', key }));
  const reset = c.resetStats.bind(c); c.resetStats = () => { reset(); op({ op: 'reset' }); };
  wrap('learnSkill', id => ({ op: 'learn', id }));
  wrap('resetSkills', () => ({ op: 'skill_reset' }));
  c.on('bought', e => op({ op: 'buy', shop: e.shop, id: e.id }));
  // taking cards out is a dice roll: online the server rolls it and sends the result and the character
  const strip = c.stripCards.bind(c);
  c.stripCards = i => {
    if (!on || !net.online) return strip(i);
    const s = c.inventory[i]; if (!s?.cards?.length) return strip(i);
    op({ op: 'strip', id: s.id, cards: [...s.cards] });
    return { ok: true, pending: true };
  };
  net.on('stripped', m => c.emit('stripped', m));
  c.on('sorted', () => op({ op: 'sort' }));
  if (quests) {
    const accept = quests.accept.bind(quests), complete = quests.complete.bind(quests), talk = quests.onTalk.bind(quests);
    quests.accept = id => { const r = accept(id); if (r) op({ op: 'quest_accept', id }); return r; };
    // handing in pays gold / items / EXP: the inner addItem / gainExp are not actions of their own
    quests.complete = id => { depth++; let r; try { r = complete(id); } finally { depth--; } if (r) op({ op: 'quest_complete', id }); return r; };
    quests.onTalk = npc => { talk(npc); if (quests.active().some(q => q.objectives.some(o => o.talk === npc))) op({ op: 'talk', npc }); };
  }

  const adopt = s => {
    const { level, exp, points, gold, alloc, inventory, equipment, jobLevel = c.jobLevel, jobExp = c.jobExp, skills = c.skills, cards = c.cards } = s;
    Object.assign(c, { level, exp, points, gold, alloc: { ...alloc }, inventory: inventory.map(x => x && { ...x, ...(x.cards ? { cards: [...x.cards] } : {}) }), equipment: { ...equipment }, jobLevel, jobExp, skills: { ...skills }, cards: { ...Object.fromEntries(Object.keys(c.equipment).map(k => [k, []])), ...cards } });
    c.emit('skills');
    c.mp = Math.min(c.maxMp, s.mp ?? c.mp); c.hp = Math.min(c.maxHp, s.hp > 0 ? s.hp : c.hp);
    c.emit('inventory'); c.emit('change'); c.save?.();
    if (quests && s.quests) { quests.state = JSON.parse(JSON.stringify(s.quests)); quests.save(); quests.emit('change'); }
  };
  net.on('sync', m => {
    if (!m.c) return;
    on = true;
    if (m.c.ack < sent) { net.send({ t: 'resync' }); return; }   // our latest action is still on its way
    adopt(m.c);
  });
  net.on('me', m => {
    if (!on || m.ack < sent) return;
    if (Math.abs(c.mp - m.mp) > Math.max(5, c.maxMp * .08)) { c.mp = Math.min(c.maxMp, m.mp); c.emit('change'); }
    if (c.alive && m.hp > 0 && Math.abs(c.hp - m.hp) > Math.max(5, c.maxHp * .05)) { c.hp = Math.min(c.maxHp, m.hp); c.emit('change'); }
  });
  net.on('status', online => { if (!online) { on = false; sent = 0; } });   // a new connection replays from 0
  return { get active() { return on; } };
}
