// City warp keepers also serve one account-wide vault. No HTTP raw-state API.
import { randomUUID, createHash } from 'node:crypto';
import { getWarpService, WARP_RANGE } from '../src/data/warpServices.js';
import { STASH_CAPACITY, cleanStashMove, planStashMove } from '../src/data/stash.js';
import { navigation } from './navigation.js';

export function stashWhy(p, state, npc, { fighting = false, duel = false, trade = false, navigate = navigation } = {}) {
  if (!p || !state?.persist || p.account !== state.persist.account) return 'offline';
  const service = typeof npc === 'string' && getWarpService(npc);
  if (!service || service.map !== 'city') return 'npc';
  if (p.dead || !state.c.alive) return 'dead';
  if (state.stashBusy || fighting || duel || trade) return 'busy';
  if (p.map !== 'city') return 'map';
  if (![p.x, p.z].every(Number.isFinite) || Math.hypot(p.x - service.x, p.z - service.z) > WARP_RANGE) return 'far';
  if (!navigate('city').clear(p, service, .05)) return 'blocked';
  return null;
}

export class StashService {
  constructor(accounts) { this.accounts = accounts; }
  async open(p, s, npc, context) {
    const why = stashWhy(p, s, npc, context); if (why) return { ok: false, why };
    return { ok: true, stash: await this.accounts.store.getStash(s.persist.account) };
  }
  async move(p, s, m, context) {
    const why = stashWhy(p, s, m.npc, context); if (why) return { ok: false, why };
    const move = cleanStashMove(m); if (!move) return { ok: false, why: 'invalid' };
    // Account+slot is part of the persisted retry fingerprint. NPC is an authority
    // check, not the transfer identity: reconnecting may use another city counter.
    const fingerprint = createHash('sha256').update(JSON.stringify(move)).digest('hex');
    s.stashBusy = true;
    try {
      return await this.accounts.moveStash(s.persist.account, s.persist.slot, move, fingerprint, {
        capture: () => ({ character: structuredClone(s.c.toJSON()), quests: s.quests.json(),
          location: { map: p.map, x: p.x, z: p.z, facing: p.f }, inventoryRevision: s.persist.inventoryRevision ?? 0 }),
        plan: (snapshot, vault) => planStashMove(snapshot.character, vault, move, randomUUID),
        adopt: (inventory, revision) => {
          s.c.inventory = structuredClone(inventory); s.persist.inventoryRevision = revision;
          s.dirty = true; s.c.emit('inventory'); s.c.emit('change');
        },
      });
    } finally { s.stashBusy = false; }
  }
}

export const stashMessage = vault => ({ t: 'stash', capacity: STASH_CAPACITY, ...vault });
