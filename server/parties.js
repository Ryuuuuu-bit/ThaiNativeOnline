// Parties (RO style): up to PARTY.max players who hunt together. Pure logic, no sockets
// (server/index.js sends what these return). Players are presence ids (server/presence.js).
//
//   const P = new Parties({ now })
//   P.invite(from, to) → { ok, party? } | { ok: false, why }    an invite waits PARTY.inviteSecs
//   P.accept(to, from) → { ok, party } | { ok: false, why }     P.decline(to, from)
//   P.leave(id) → { party, before } | null   (party: as it is now, null once one is left; the
//                 leader passes on; before: who was in it) · P.kick(leader, id) → the same
//   P.promote(leader, id) → party | null   (the leader hands the lead to a member)
//   P.of(id) → party id | null · P.members(pid) → [ids] · P.get(pid) → { id, leader, members }
//
// The EXP of a kill (server/monsters.js rewards): a party counts as one hunter. Every member on
// the same map and channel, alive and within PARTY.shareRange of the monster, shares it evenly,
// with PARTY.bonus more for each extra member — as long as their levels are within
// PARTY.levelGap of each other (RO's even share); otherwise each member is paid alone.
// The gold and the loot go to the member who did the most damage. Quest kills count for all
// the sharers.
export const PARTY = { max: 6, inviteSecs: 60, shareRange: 30, levelGap: 15, bonus: .1 };

export class Parties {
  constructor({ now = () => Date.now() / 1000 } = {}) {
    this.now = now; this.parties = new Map(); this.byPlayer = new Map(); this.invites = new Map(); this.nextId = 1;
  }
  of(id) { return this.byPlayer.get(id) ?? null; }
  get(pid) { return this.parties.get(pid) ?? null; }
  members(pid) { return this.parties.get(pid)?.members ?? []; }

  invite(from, to) {
    if (from === to) return { ok: false, why: 'self' };
    if (this.of(to)) return { ok: false, why: 'in_party' };
    const pid = this.of(from), party = pid && this.get(pid);
    if (party && party.leader !== from) return { ok: false, why: 'not_leader' };
    if (party && party.members.length >= PARTY.max) return { ok: false, why: 'full' };
    const list = (this.invites.get(to) ?? []).filter(i => this.now() - i.at < PARTY.inviteSecs && i.from !== from);
    list.push({ from, at: this.now() }); this.invites.set(to, list);
    return { ok: true };
  }
  accept(to, from) {
    const list = this.invites.get(to) ?? [], inv = list.find(i => i.from === from && this.now() - i.at < PARTY.inviteSecs);
    this.invites.set(to, list.filter(i => i !== inv));
    if (!inv) return { ok: false, why: 'expired' };
    if (this.of(to)) return { ok: false, why: 'in_party' };
    let pid = this.of(from);
    if (pid && this.get(pid).leader !== from) return { ok: false, why: 'expired' };
    if (!pid) { pid = this.nextId++; this.parties.set(pid, { id: pid, leader: from, members: [from] }); this.byPlayer.set(from, pid); }
    const party = this.get(pid);
    if (party.members.length >= PARTY.max) return { ok: false, why: 'full' };
    party.members.push(to); this.byPlayer.set(to, pid); this.invites.delete(to);
    return { ok: true, party };
  }
  decline(to, from) { this.invites.set(to, (this.invites.get(to) ?? []).filter(i => i.from !== from)); }
  // → the party left behind (null when it is gone), and who was in it before
  leave(id) {
    this.invites.delete(id);
    const pid = this.of(id); if (!pid) return null;
    const party = this.get(pid), before = [...party.members];
    party.members = party.members.filter(m => m !== id); this.byPlayer.delete(id);
    if (party.leader === id) party.leader = party.members[0];
    if (party.members.length < 2) { for (const m of party.members) this.byPlayer.delete(m); this.parties.delete(pid); return { party: null, before }; }
    return { party, before };
  }
  kick(leader, id) {
    const pid = this.of(leader), party = pid && this.get(pid);
    if (!party || party.leader !== leader || leader === id || !party.members.includes(id)) return null;
    return this.leave(id);
  }
  promote(leader, id) {
    const pid = this.of(leader), party = pid && this.get(pid);
    if (!party || party.leader !== leader || leader === id || !party.members.includes(id)) return null;
    party.leader = id; return party;
  }
}

// Who shares a party's kill: members in the room, alive, near the monster.
export function sharers(members, players, m) {
  return players.filter(p => members.includes(p.id) && !p.dead && Math.hypot(p.x - m.x, p.z - m.z) <= PARTY.shareRange);
}
export const evenShare = list => list.length > 1 && Math.max(...list.map(p => p.lv)) - Math.min(...list.map(p => p.lv)) <= PARTY.levelGap;
