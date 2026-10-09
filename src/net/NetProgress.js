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
// A stale `sync` is discarded; once `me` acknowledges all actions, request one fresh copy.
// Guests (no `sync`) keep everything local, as before.
//   attachNetProgress(net, character, quests?)
import { lockFields, cleanEquipmentLocks, cleanLoadouts, cleanHotbar, gearReference } from '../character/itemState.js';
import { cleanMasteries } from '../character/data/masteries.js';
export function attachNetProgress(net, c, quests = null) {
  let on = false, sent = 0, depth = 0, resyncPending = false;
  let pendingLoadout = null;
  let pendingRefine = null, unknownRefine = false;
  c.refineRecovering = false;
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
  // gear is named with the cards it holds and its plus (two swords that differ are different items)
  const held = i => ({ ...(c.inventory[i]?.cards?.length ? { cards: [...c.inventory[i].cards] } : {}), ...(c.inventory[i]?.plus ? { plus: c.inventory[i].plus } : {}), ...lockFields(c.inventory[i]) });
  wrap('useAt', i => idAt(i) && { op: 'use', id: idAt(i), ...held(i) });
  wrap('sellBatch', lines => Array.isArray(lines) && { op: 'sell_batch', lines: lines.map(l => ({ index: l?.index, qty: l?.qty, id: idAt(l?.index), ...held(l?.index) })) });
  wrap('sellAt', i => idAt(i) && { op: 'sell', id: idAt(i), ...held(i) });
  wrap('equip', i => idAt(i) && { op: 'equip', id: idAt(i), ...held(i) });
  wrap('insertCard', (i, where) => idAt(i) && (typeof where === 'string' ? { op: 'card', id: idAt(i), worn: where } : { op: 'card', id: idAt(i), item: idAt(where), has: [...(c.inventory[where]?.cards ?? [])], ...(c.inventory[where]?.plus ? { plus: c.inventory[where].plus } : {}) }));
  wrap('unequip', slot => ({ op: 'unequip', slot }));
  wrap('setItemLock', (where, lock) => {
    const item = typeof where === 'string' ? c.wornItem(where) : c.inventory[where];
    return item && { op: 'item_lock', ...(typeof where === 'string' ? { worn: where } : { index: where }), ...gearReference(item), ...lockFields(item), lock };
  });
  wrap('setHotbar', order => ({ op: 'hotbar_order', order: Array.isArray(order) ? [...order] : order }));
  wrap('saveLoadout', (index, name) => ({ op: 'loadout_save', index, name }));
  wrap('renameLoadout', (index, name) => ({ op: 'loadout_rename', index, name }));
  const applyLoadout = c.applyLoadout.bind(c);
  c.applyLoadout = index => {
    if (!on || !net.online) return applyLoadout(index);
    if (pendingLoadout) return { ok: false, why: 'pending' };
    const plan = c.planLoadout(index); if (!plan.ok) return { ok: false, why: plan.why, item: plan.item };
    op({ op: 'loadout_apply', index });
    pendingLoadout = { index, ack: sent };
    c.loadoutPending = true; c.emit('change'); return { ok: true, pending: true, index };
  };
  wrap('allocate', key => ({ op: 'alloc', key }));
  const reset = c.resetStats.bind(c); c.resetStats = () => { reset(); op({ op: 'reset' }); };
  wrap('learnSkill', id => ({ op: 'learn', id }));
  wrap('resetSkills', () => ({ op: 'skill_reset' }));
  wrap('chooseEvo', (id, pick) => ({ op: 'evo', id, pick }));
  c.on('bought', e => op({ op: 'buy', shop: e.shop, id: e.id, qty: e.qty ?? 1 }));
  // taking cards out is a dice roll: online the server rolls it and sends the result and the character
  const strip = c.stripCards.bind(c);
  c.stripCards = i => {
    if (!on || !net.online) return strip(i);
    const s = c.inventory[i]; if (!s?.cards?.length || c.isLocked(i)) return strip(i);
    op({ op: 'strip', id: s.id, ...held(i) });
    return { ok: true, pending: true };
  };
  net.on('stripped', m => c.emit('stripped', m));
  // ตีบวก is a dice roll too
  const refine = c.refineGear.bind(c);
  c.refineGear = where => {
    if (c.refineRecovering) return { ok: false, why: 'connection' };
    if (pendingRefine) return { ok: false, why: 'pending' };
    if (!on || !net.online) return refine(where);
    if (c.isLocked(where)) return refine(where);
    const s = typeof where === 'string' ? c.wornItem(where) : c.inventory[where];
    if (!s) return refine(where);
    const ack = sent + 1;
    pendingRefine = { ack, item: s.id, to: (s.plus ?? 0) + 1, result: false, resyncRequested: false };
    op(typeof where === 'string' ? { op: 'refine', worn: where } : { op: 'refine', id: s.id, ...held(where) });
    return { ok: true, pending: true, ack };
  };
  net.on('refined', m => {
    if (!on || !net.online || c.refineRecovering || !pendingRefine || pendingRefine.result || !m || m.pending) return;
    // Only the outstanding attempt can produce feedback; late/duplicate replies cannot
    // revive a discarded result or unlock a later attempt for different gear.
    if (m.ok === true && (m.item !== pendingRefine.item || m.to !== pendingRefine.to || !['up', 'broke'].includes(m.outcome))) return;
    pendingRefine.result = true;
    if (m.ok !== true) pendingRefine = null;
    c.emit('refined', m);
  });
  c.on('sorted', () => op({ op: 'sort' }));
  if (quests) {
    const accept = quests.accept.bind(quests), complete = quests.complete.bind(quests), talk = quests.onTalk.bind(quests);
    quests.accept = id => { const r = accept(id); if (r) op({ op: 'quest_accept', id }); return r; };
    // handing in pays gold / items / EXP: the inner addItem / gainExp are not actions of their own
    quests.complete = id => { depth++; let r; try { r = complete(id); } finally { depth--; } if (r) op({ op: 'quest_complete', id }); return r; };
    quests.onTalk = npc => { talk(npc); if (quests.active().some(q => q.objectives.some(o => o.talk === npc))) op({ op: 'talk', npc }); };
  }

  const adopt = s => {
    const { level, exp, points, gold, alloc, inventory, equipment, jobLevel = c.jobLevel, jobExp = c.jobExp, skills = c.skills, cards = c.cards, evo = c.evo, refine: plus = c.refine, title = c.title, titles = c.titles, rec = c.rec } = s;
    Object.assign(c, { level, exp, points, gold, alloc: { ...alloc }, inventory: inventory.map(x => x && { ...x, ...(x.cards ? { cards: [...x.cards] } : {}) }), equipment: { ...equipment }, jobLevel, jobExp, skills: { ...skills }, evo: { ...evo }, refine: { ...Object.fromEntries(Object.keys(c.equipment).map(k => [k, 0])), ...plus }, cards: { ...Object.fromEntries(Object.keys(c.equipment).map(k => [k, []])), ...cards } });
    c.equipmentLocks = cleanEquipmentLocks(c.equipment, s.equipmentLocks);
    c.hotbar = cleanHotbar(c, s.hotbar); c.loadouts = cleanLoadouts(c, s.loadouts); c.masteries = cleanMasteries(c.classId, s.masteries);
    c.emit('skills');
    takeTitles({ titles, title, rec });
    c.mp = Math.min(c.maxMp, s.mp ?? c.mp); c.hp = Math.min(c.maxHp, s.hp > 0 ? s.hp : c.hp);
    c.emit('inventory'); c.emit('change'); c.save?.();
    if (quests && s.quests) { quests.state = JSON.parse(JSON.stringify(s.quests)); quests.save(); quests.emit('change'); }
  };
  // the server's titles and records (src/data/titles.js): `got` = just earned (the social window toasts them)
  const takeTitles = ({ titles, title, rec, got = [] }) => {
    c.titles = [...titles]; c.title = title ?? null; c.rec = { ...rec, boss: { ...rec?.boss } };
    c.emit('titles', got);
  };
  net.on('titles', m => { if (on) { takeTitles(m); c.save?.(); } });
  net.on('sync', m => {
    if (!m.c) return;
    on = true;
    if (quests) quests.deferMastery = quests.deferPractice = true;
    if (m.c.ack < sent) { resyncPending = true; return; }   // our latest action is still on its way
    resyncPending = false; adopt(m.c);
    // Raw network syncs may be stale. Consumers needing an authoritative bag
    // wait for this character event, emitted only after the accepted copy is adopted.
    c.emit('server-sync', { ack: m.c.ack });
    if (c.refineRecovering || (pendingRefine && m.c.ack >= pendingRefine.ack)) {
      const unknown = unknownRefine || !!(pendingRefine && !pendingRefine.result);
      pendingRefine = null; unknownRefine = false; c.refineRecovering = false;
      // Equipment is authoritative even if the separate dice-result packet was lost.
      // Release the action without inferring a success or destruction from that state.
      c.emit('refine-recovery', { state: 'synced', unknown });
    }
    if (pendingLoadout && m.c.ack >= pendingLoadout.ack) {
      const { index, ack } = pendingLoadout; pendingLoadout = null; c.loadoutPending = false;
      const result = m.c.loadoutResult, ok = result?.n === ack && result.ok === true;
      c.emit('loadout-result', { ok, index, ...(ok ? {} : { why: result?.n === ack ? result.why : 'refused' }) }); c.emit('change');
    }
  });
  net.on('me', m => {
    if (!on || m.ack < sent) return;
    if (resyncPending || (pendingRefine && !pendingRefine.resyncRequested && m.ack >= pendingRefine.ack)) {
      resyncPending = false;
      if (pendingRefine) pendingRefine.resyncRequested = true;
      net.send({ t: 'resync' });
    }
    if (Math.abs(c.mp - m.mp) > Math.max(5, c.maxMp * .08)) { c.mp = Math.min(c.maxMp, m.mp); c.emit('change'); }
    if (c.alive && m.hp > 0 && Math.abs(c.hp - m.hp) > Math.max(5, c.maxHp * .05)) { c.hp = Math.min(c.maxHp, m.hp); c.emit('change'); }
  });
  net.on('status', online => { if (!online) {
    if (on || pendingRefine) {
      unknownRefine ||= !!(pendingRefine && !pendingRefine.result);
      pendingRefine = null; c.refineRecovering = true;
      c.emit('refine-recovery', { state: 'connection', unknown: unknownRefine });
    }
    on = false; sent = 0; resyncPending = false;
    // Signed-in quest predictions stay deferred through disconnects. Only a
    // server copy can grant a mastery or count verified class practice again.
    if (pendingLoadout) { const { index } = pendingLoadout; pendingLoadout = null; c.loadoutPending = false; c.emit('loadout-result', { ok: false, why: 'connection', index }); c.emit('change'); }
  } });   // a new connection replays from 0
  return { get active() { return on; } };
}
