// Freeze both live characters until their atomic, idempotent transaction resolves.
import { randomUUID } from 'node:crypto';
import { Character } from '../src/character/Character.js';
import { swap } from './trades.js';

export function commitTrade(accounts, trade, states, players, { reward = () => {} } = {}) {
  if (trade.committing) return trade.task;
  trade.committing = true;
  states.forEach(s => { s.tradeBusy = true; });
  const task = accounts.trade(randomUUID(), states.map(s => s.persist), {
    capture: () => {
      const copies = states.map(s => new Character(structuredClone(s.c.toJSON())));
      const result = swap(copies[0], copies[1], trade.offer[trade.a], trade.offer[trade.b]);
      if (!result.ok) return { failure: result };
      return states.map((s, i) => ({ account: s.persist.account, slot: s.persist.slot,
        inventoryRevision: s.persist.inventoryRevision ?? 0, character: copies[i].toJSON(), quests: s.quests.json(),
        location: { map: players[i].map, x: players[i].x, z: players[i].z, facing: players[i].f } }));
    },
    adopt: (prepared, revisions) => states.forEach((s, i) => {
      s.c.inventory = structuredClone(prepared[i].character.inventory); s.c.gold = prepared[i].character.gold;
      s.persist.inventoryRevision = revisions[i]; s.dirty = true;
      s.c.emit('inventory'); s.c.emit('change');
    }),
  }).finally(() => states.forEach(s => {
    s.tradeBusy = false;
    for (const entry of s.tradeRewards ?? []) reward(s, entry);
    s.tradeRewards = [];
  }));
  trade.task = task;
  states.forEach(s => { s.tradeTask = task; });
  return task;
}
