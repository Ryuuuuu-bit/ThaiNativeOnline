// Public recruitment, backed by live Parties and authenticated presence. No membership
// is granted here: approval calls Parties.invite; the existing pans handler grants it.
//
// Parent server/index.js integration (no global patching or private room assumptions):
//   import { createPartyBoardHandlers } from './party-board.js';
//   const partyBoard = createPartyBoardHandlers({
//     parties, presence, combatants, byId, send, sendParty,
//   });
//   In the WS router, after JSON validation: if (partyBoard.handle(ws, m)) return;
//   On socket close, before/after presence.leave: partyBoard.disconnect(departing.id);
//   In the existing 1 Hz party broadcast: partyBoard.sweep();
//   No hooks needed in partyMsg: Parties.onChange observes accept/leave/kick/promote.
//
// Client: party_create; party_board_list; party_board_publish { minLv, maxLv, purpose };
// party_board_remove; party_board_request { party }; party_board_answer { from, ok }.
// Server: party_board { list, mine, requests, pending, signed, canCreate, canPublish,
// maxLevel, purposeLimit }; party_board_result { action, ok, why?, retryAfter? };
// approval emits the normal pinv { from, name }, followed by normal pans consent.
import { PARTY } from './parties.js';
import { MAX_LEVEL } from '../src/character/data/progression.js';

export const PARTY_BOARD = Object.freeze({ purposeLimit: 80, publishEvery: 10, requestEvery: 5,
  listEvery: 1, requestSecs: 120, maxRequests: 20, maxPending: 3 });
const TYPES = new Set(['party_create', 'party_board_list', 'party_board_publish',
  'party_board_remove', 'party_board_request', 'party_board_answer']);
const fail = why => ({ ok: false, why });
export const cleanPurpose = text => typeof text === 'string' ? Array.from(text.normalize('NFKC')
  .replace(/[\p{Cc}\p{Cf}<>]/gu, ' ').replace(/\s+/gu, ' ').trim()).slice(0, PARTY_BOARD.purposeLimit).join('') : '';

export class PartyBoard {
  // player(id) returns a server-owned { id, signed, name, cls, lv, map, ch, dead }.
  constructor({ parties, player, now = () => Date.now() / 1000 }) {
    this.parties = parties; this.player = player; this.now = now;
    this.listings = new Map(); this.requests = new Map(); this.cooldowns = new Map();
  }
  rate(id, action, secs) {
    const key = `${id}:${action}`, at = this.cooldowns.get(key) ?? -Infinity, left = secs - (this.now() - at);
    if (left > 0) return { ok: false, why: 'cooldown', retryAfter: Math.ceil(left) };
    this.cooldowns.set(key, this.now()); return { ok: true };
  }
  actor(id) {
    const p = this.player(id);
    return !p ? fail('offline') : !p.signed ? fail('guest') : p.dead ? fail('dead') : { ok: true, p };
  }
  leader(id) {
    const a = this.actor(id); if (!a.ok) return a;
    const party = this.parties.get(this.parties.of(id));
    return !party ? fail('no_party') : party.leader !== id ? fail('not_leader') : { ...a, party };
  }
  view(listing) {
    const party = this.parties.get(listing.party), leader = this.player(listing.leader);
    if (!party || party.leader !== listing.leader || !party.members.includes(leader?.id)
      || !leader?.signed || leader.dead || party.members.length >= PARTY.max) return null;
    const members = party.members.map(id => this.player(id));
    if (members.some(p => !p)) return null;
    return { party: party.id, leader: leader.id, name: leader.name, map: leader.map, ch: leader.ch,
      minLv: listing.minLv, maxLv: listing.maxLv, purpose: listing.purpose, capacity: PARTY.max,
      members: members.map(p => ({ id: p.id, name: p.name, cls: p.cls, lv: p.lv, map: p.map, ch: p.ch, dead: !!p.dead })) };
  }
  revoke(request) {
    if (!request.invite) return;
    const list = this.parties.invites.get(request.from) ?? [];
    const kept = list.filter(i => i !== request.invite);
    if (kept.length) this.parties.invites.set(request.from, kept); else this.parties.invites.delete(request.from);
  }
  erase(party) {
    this.listings.delete(party);
    for (const [key, r] of this.requests) if (r.party === party) { this.revoke(r); this.requests.delete(key); }
  }
  sweep() {
    for (const listing of this.listings.values()) if (!this.view(listing)) this.erase(listing.party);
    for (const [key, r] of this.requests) {
      const applicant = this.player(r.from), listing = this.listings.get(r.party);
      const inviteLive = !r.invite || (this.parties.invites.get(r.from) ?? []).includes(r.invite);
      if (!listing || !applicant?.signed || applicant.dead || this.parties.of(r.from)
        || applicant.lv < listing.minLv || applicant.lv > listing.maxLv || r.expiresAt <= this.now() || !inviteLive) {
        this.revoke(r); this.requests.delete(key);
      }
    }
    for (const [key, at] of this.cooldowns) if (this.now() - at > PARTY_BOARD.requestSecs) this.cooldowns.delete(key);
  }
  publish(id, m) {
    this.sweep(); const a = this.leader(id); if (!a.ok) return a;
    if (a.party.members.length >= PARTY.max) return fail('full');
    if (a.party.members.some(member => !this.player(member))) return fail('offline');
    const purpose = cleanPurpose(m.purpose);
    if (!Number.isInteger(m.minLv) || !Number.isInteger(m.maxLv) || m.minLv < 1 || m.maxLv > MAX_LEVEL
      || m.minLv > m.maxLv || !purpose) return fail('bad_listing');
    const rate = this.rate(id, 'publish', PARTY_BOARD.publishEvery); if (!rate.ok) return rate;
    this.listings.set(a.party.id, { party: a.party.id, leader: id, minLv: m.minLv, maxLv: m.maxLv, purpose });
    this.sweep(); return { ok: true };
  }
  remove(id) {
    // Removing one's listing is always available, even after death or a publish cooldown.
    const party = this.parties.get(this.parties.of(id));
    if (!party) return fail('no_party'); if (party.leader !== id) return fail('not_leader');
    if (!this.player(id)?.signed) return fail('guest');
    this.erase(party.id); return { ok: true };
  }
  request(id, pid) {
    this.sweep(); const a = this.actor(id); if (!a.ok) return a;
    if (this.parties.of(id)) return fail('in_party');
    if (!Number.isInteger(pid)) return fail('expired');
    const listing = this.listings.get(pid), party = this.parties.get(pid);
    if (party?.members.length >= PARTY.max) return fail('full');
    if (!listing || !this.view(listing)) return fail('expired');
    if (a.p.lv < listing.minLv || a.p.lv > listing.maxLv) return fail('level');
    const key = `${pid}:${id}`; if (this.requests.has(key)) return fail('pending');
    const all = [...this.requests.values()];
    if (all.filter(r => r.party === pid).length >= PARTY_BOARD.maxRequests
      || all.filter(r => r.from === id).length >= PARTY_BOARD.maxPending) return fail('busy');
    const rate = this.rate(id, 'request', PARTY_BOARD.requestEvery); if (!rate.ok) return rate;
    this.requests.set(key, { from: id, leader: listing.leader, party: pid, status: 'waiting', expiresAt: this.now() + PARTY_BOARD.requestSecs });
    return { ok: true };
  }
  answer(id, from, ok) {
    this.sweep(); const a = this.leader(id); if (!a.ok) return a;
    if (!Number.isInteger(from) || typeof ok !== 'boolean') return fail('bad_request');
    const key = `${a.party.id}:${from}`, r = this.requests.get(key);
    if (!r || r.leader !== id || r.status !== 'waiting') return fail('expired');
    if (!ok) { this.requests.delete(key); return { ok: true, applicant: from, declined: true }; }
    const invited = this.parties.invite(id, from); if (!invited.ok) return invited;
    r.status = 'invited'; r.expiresAt = this.now() + PARTY.inviteSecs;
    r.invite = this.parties.invites.get(from).find(i => i.from === id);
    return { ok: true, applicant: from, invite: { t: 'pinv', from: id, name: a.p.name } };
  }
  snapshot(id) {
    this.sweep(); const p = this.player(id), party = this.parties.get(this.parties.of(id));
    const list = [...this.listings.values()].map(l => this.view(l)).filter(Boolean);
    const mine = list.find(l => l.leader === id) ?? null;
    const requests = [...this.requests.values()].filter(r => r.leader === id && r.status === 'waiting').map(r => {
      const from = this.player(r.from); return { from: r.from, name: from.name, cls: from.cls, lv: from.lv, map: from.map, ch: from.ch, expiresAt: r.expiresAt };
    });
    const pending = [...this.requests.values()].filter(r => r.from === id).map(r => ({ party: r.party, status: r.status, expiresAt: r.expiresAt }));
    return { t: 'party_board', list, mine, requests, pending, signed: !!p?.signed,
      canCreate: !!p?.signed && !p.dead && !party,
      canPublish: !!p?.signed && !p.dead && party?.leader === id && party.members.length < PARTY.max,
      maxLevel: MAX_LEVEL, purposeLimit: PARTY_BOARD.purposeLimit };
  }
  disconnect(id) {
    for (const listing of this.listings.values()) if (listing.leader === id) this.erase(listing.party);
    for (const [key, r] of this.requests) if (r.from === id) { this.revoke(r); this.requests.delete(key); }
    for (const key of this.cooldowns.keys()) if (key.startsWith(`${id}:`)) this.cooldowns.delete(key);
  }
}

export function createPartyBoardHandlers({ parties, presence, combatants, byId, send, sendParty, now }) {
  const player = id => {
    const o = byId(id), p = o?.p, s = combatants.get(id);
    if (!p || o.ws?.readyState !== 1) return null;
    const signed = !!p.account && s?.persist?.account === p.account;
    return { id: p.id, signed, name: p.name, cls: signed ? s.c.classId : p.cls, lv: signed ? s.c.level : p.lv,
      map: p.map, ch: p.ch, dead: !!p.dead || (signed && !s.c.alive) };
  };
  const board = new PartyBoard({ parties, player, now }), subscribers = new Map();
  const update = id => {
    const ws = byId(id)?.ws; if (!ws || ws.readyState !== 1) return;
    const msg = board.snapshot(id), key = JSON.stringify(msg);
    if (subscribers.get(id) !== key) { subscribers.set(id, key); send(ws, msg); }
  };
  const sweep = () => { board.sweep(); for (const id of subscribers.keys()) update(id); };
  const off = parties.onChange(sweep);
  return {
    board,
    handle(ws, m) {
      if (!TYPES.has(m.t)) return false;
      const me = presence.players.get(ws); if (!me || !player(me.id)) return true;
      subscribers.set(me.id, null);
      if (m.t === 'party_board_list') {
        if (board.rate(me.id, 'list', PARTY_BOARD.listEvery).ok) update(me.id);
        return true;
      }
      let r;
      if (m.t === 'party_create') {
        const a = board.actor(me.id); r = a.ok ? parties.create(me.id) : a;
        if (r.ok) sendParty(r.party.id);
      } else if (m.t === 'party_board_publish') r = board.publish(me.id, m);
      else if (m.t === 'party_board_remove') r = board.remove(me.id);
      else if (m.t === 'party_board_request') r = board.request(me.id, m.party);
      else r = board.answer(me.id, m.from, m.ok);
      if (r.invite) send(byId(r.applicant).ws, r.invite);
      if (r.declined) send(byId(r.applicant).ws, { t: 'party_board_result', action: 'party_board_request', ok: false, why: 'declined' });
      send(ws, { t: 'party_board_result', action: m.t, ok: r.ok, ...(r.why ? { why: r.why } : {}), ...(r.retryAfter ? { retryAfter: r.retryAfter } : {}) });
      sweep(); return true;
    },
    sweep,
    disconnect(id) { subscribers.delete(id); board.disconnect(id); sweep(); },
    dispose() { off(); subscribers.clear(); },
  };
}
