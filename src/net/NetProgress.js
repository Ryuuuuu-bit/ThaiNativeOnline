// A signed-in character's progress belongs to the server (phase 3c of
// docs/technical/SERVER_SPLIT.md, server/progress.js). Once the server sends `sync` (its copy
// of the character) this browser:
//   · takes that copy (level, EXP, points, gold, bag, gear, MP; HP stays local);
//   · still does the player's own actions at once (buy, sell, use, equip, stat points, sort)
//     and mirrors each as an `op`, which the server replays with the same code. A refused one
//     brings the server's copy back;
//   · follows the server's MP (1×/s) when the two drift apart.
// Kill rewards come in through NetCombat's `kill` (applied here and on the server alike).
// A `sync` older than this browser's last action is not applied: it asks for a fresh one.
// Guests (no `sync`) keep everything local, as before.
//   attachNetProgress(net, character)
export function attachNetProgress(net, c) {
  let on = false, sent = 0, depth = 0;
  const op = msg => { if (on && net.online) { sent++; net.send({ t: 'op', n: sent, hp: Math.round(c.hp), ...msg }); } };
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
  wrap('useAt', i => idAt(i) && { op: 'use', id: idAt(i) });
  wrap('sellAt', i => idAt(i) && { op: 'sell', id: idAt(i) });
  wrap('equip', i => idAt(i) && { op: 'equip', id: idAt(i) });
  wrap('unequip', slot => ({ op: 'unequip', slot }));
  wrap('allocate', key => ({ op: 'alloc', key }));
  const reset = c.resetStats.bind(c); c.resetStats = () => { reset(); op({ op: 'reset' }); };
  c.on('bought', e => op({ op: 'buy', shop: e.shop, id: e.id }));
  c.on('sorted', () => op({ op: 'sort' }));

  const adopt = s => {
    const { level, exp, points, gold, alloc, inventory, equipment } = s;
    Object.assign(c, { level, exp, points, gold, alloc: { ...alloc }, inventory: inventory.map(x => x && { ...x }), equipment: { ...equipment } });
    c.mp = Math.min(c.maxMp, s.mp ?? c.mp); c.hp = Math.min(c.hp, c.maxHp);
    c.emit('inventory'); c.emit('change'); c.save?.();
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
  });
  net.on('status', online => { if (!online) { on = false; sent = 0; } });   // a new connection replays from 0
  return { get active() { return on; } };
}
