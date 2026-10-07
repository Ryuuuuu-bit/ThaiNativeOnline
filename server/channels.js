// Channels: a busy map is split into copies (CH 1, CH 2, …) that open and close with the
// number of players on it. Pure (no sockets): server/index.js asks it where a player goes
// and what to open or close; server/presence.js keeps who is in which room.
//
//   room id: 'paddy' for CH 1 (so a quiet server looks exactly as before), 'paddy#2' for CH 2, …
//   const C = new Channels({ now })
//   C.pick(map, counts)                → the channel a player arriving on `map` goes to
//   C.update(map, counts)              → { warn: [ch], evict: [ch] } (once a second)
//   C.list(map, counts)                → [{ ch, n, cap, closing }] for the channel picker
//   C.canSwitch(map, to, counts, { fighting, dead, lastAt }) → null | why
//   counts: { [ch]: players in that channel }
//
// Rules: a new player fills the lowest open channel below 90% of the map's cap; when every
// channel is past that, the next one opens (up to MAX). A channel above CH 1 that stays under
// 25% of the cap for 5 minutes is announced (60 s) and closed: its players move to an open
// channel as soon as they are out of a fight. Elites and bosses live only on CH 1
// (server/monsters.js `elites: false`), so more channels never mean more bosses or cards.
export const CHANNEL = {
  cap: { city: 80 }, capDefault: 35,     // players a channel is built for
  openAt: .9, closeBelow: .25,           // shares of the cap
  closeAfter: 300, warn: 60,             // s under closeBelow before the warning; s of warning
  max: 9, switchEvery: 60,               // channels per map; s between a player's own switches
};
export const roomOf = (map, ch = 1) => (ch > 1 ? `${map}#${ch}` : map);
export const parseRoom = room => { const [map, ch] = String(room).split('#'); return { map, ch: Number(ch) || 1 }; };

export class Channels {
  constructor({ now = () => Date.now() / 1000, cfg = CHANNEL } = {}) { this.now = now; this.cfg = cfg; this.maps = new Map(); }
  cap(map) { return this.cfg.cap[map] ?? this.cfg.capDefault; }
  chans(map) {
    if (!this.maps.has(map)) this.maps.set(map, new Map([[1, { ch: 1, lowSince: null, closingAt: null, closed: false }]]));
    return this.maps.get(map);
  }
  open(map) { return [...this.chans(map).values()].filter(c => c.closingAt === null && !c.closed).map(c => c.ch).sort((a, b) => a - b); }

  pick(map, counts = {}) {
    const open = this.open(map), full = this.cap(map) * this.cfg.openAt;
    const room = open.find(ch => (counts[ch] ?? 0) < full);
    if (room) return room;
    const all = this.chans(map);
    if (all.size < this.cfg.max) {
      let ch = 2; while (all.has(ch)) ch++;
      all.set(ch, { ch, lowSince: null, closingAt: null, closed: false });
      return ch;
    }
    return open.sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0] ?? 1;   // all at the limit: the emptiest
  }

  update(map, counts = {}) {
    const now = this.now(), low = this.cap(map) * this.cfg.closeBelow, out = { warn: [], evict: [] }, all = this.chans(map);
    for (const c of all.values()) {
      if (c.ch === 1) continue;
      const n = counts[c.ch] ?? 0;
      if (c.closed) { if (n === 0) all.delete(c.ch); else out.evict.push(c.ch); continue; }
      if (c.closingAt !== null) { if (now >= c.closingAt) { c.closed = true; if (n === 0) all.delete(c.ch); else out.evict.push(c.ch); } continue; }
      if (n < low) {
        c.lowSince ??= now;
        if (now - c.lowSince >= this.cfg.closeAfter) { if (n === 0) all.delete(c.ch); /* empty: gone without a word */ else { c.closingAt = now + this.cfg.warn; out.warn.push(c.ch); } }
      } else c.lowSince = null;
    }
    return out;
  }

  list(map, counts = {}) {
    return [...this.chans(map).values()].filter(c => !c.closed).sort((a, b) => a.ch - b.ch)
      .map(c => ({ ch: c.ch, n: counts[c.ch] ?? 0, cap: this.cap(map), closing: c.closingAt !== null }));
  }

  canSwitch(map, to, counts = {}, { from = 1, fighting = false, dead = false, lastAt = -Infinity } = {}) {
    if (to === from) return 'same';
    if (!this.open(map).includes(to)) return 'closed';
    if (dead) return 'dead';
    if (fighting) return 'fighting';
    if (this.now() - lastAt < this.cfg.switchEvery) return 'cooldown';
    if ((counts[to] ?? 0) >= this.cap(map)) return 'full';
    return null;
  }
}
