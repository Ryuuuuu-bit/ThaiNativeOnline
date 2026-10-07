// Quest progress as pure logic: no DOM or Three.js, so it runs in tests.
// It reads the character and combat only through their public APIs
// (gold, count, addItem, removeAt, gainExp, combat 'kill' events).
import { Emitter } from '../character/Emitter.js';

const SAVE_KEY = 'tno.quests.v1';

export class QuestSystem extends Emitter {
  constructor(defs, { isDiscovered = () => false, storage = globalThis.localStorage } = {}) {
    super();
    this.defs = new Map(defs.map(q => [q.id, q]));
    this.isDiscovered = isDiscovered; this.storage = storage;
    this.state = {}; // id -> { status: 'active' | 'done', kills: { type: n }, talked: [] }
    try { Object.assign(this.state, JSON.parse(storage?.getItem(SAVE_KEY) ?? '{}')); } catch { /* fresh start */ }
    this.character = null;
  }
  save() { try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable */ } }

  attach(character, combat) {
    this.character = character;
    combat?.on('kill', ({ monster }) => this.onKill(monster.type));
    character.on('inventory', () => this.emit('change'));
    this.emit('change');
  }

  status(id) { return this.state[id]?.status ?? 'none'; }
  turnInOf(q) { return q.turnIn ?? q.giver; }
  canAccept(q) {
    if (this.status(q.id) !== 'none' || !this.character) return false;
    if ((q.requires ?? []).some(r => this.status(r) !== 'done')) return false;
    return (q.minLevel ?? 1) <= this.character.level;
  }
  // Quests an NPC can offer, and active quests ready to hand in to them.
  offers(npcId) { return [...this.defs.values()].filter(q => q.giver === npcId && this.canAccept(q)); }
  ready(npcId) { return this.active().filter(q => this.turnInOf(q) === npcId && this.isComplete(q.id)); }
  active() { return [...this.defs.values()].filter(q => this.status(q.id) === 'active'); }
  // '!' an offer, '?' ready to hand in, '…' in progress for this NPC.
  marker(npcId) {
    if (this.ready(npcId).length) return '?';
    if (this.offers(npcId).length) return '!';
    return this.active().some(q => this.turnInOf(q) === npcId) ? '…' : null;
  }

  objectiveProgress(q, o) {
    const s = this.state[q.id] ?? {};
    if (o.discover) return { have: this.isDiscovered(o.discover) ? 1 : 0, need: 1 };
    if (o.kill) return { have: Math.min(o.count, s.kills?.[o.kill] ?? 0), need: o.count };
    if (o.collect) return { have: Math.min(o.count, this.character?.count(o.collect) ?? 0), need: o.count };
    if (o.talk) return { have: s.talked?.includes(o.talk) ? 1 : 0, need: 1 };
    return { have: 0, need: 1 };
  }
  isComplete(id) {
    const q = this.defs.get(id);
    return q.objectives.every(o => { const p = this.objectiveProgress(q, o); return p.have >= p.need; });
  }

  accept(id) {
    const q = this.defs.get(id);
    if (!q || !this.canAccept(q)) return false;
    this.state[id] = { status: 'active', kills: {}, talked: [] };
    this.save(); this.emit('accept', q); this.emit('change');
    return true;
  }
  // Hands in a finished quest: takes collected items, then pays the rewards.
  complete(id) {
    const q = this.defs.get(id), c = this.character;
    if (!q || this.status(id) !== 'active' || !this.isComplete(id) || !c) return false;
    const r = q.rewards ?? {};
    // the rewards must fit before anything is taken or paid (a full bag loses nothing)
    if ((r.items ?? []).some(([item, qty = 1]) => !c.canTake(item, qty))) { this.emit('fail', 'กระเป๋าเต็ม · เก็บที่ว่างก่อนรับรางวัล'); return false; }
    for (const o of q.objectives) if (o.collect) {
      let left = o.count;
      for (let i = 0; i < c.inventory.length && left > 0; i++) {
        const slot = c.inventory[i];
        if (slot?.id !== o.collect) continue;
        const take = Math.min(left, slot.qty); c.removeAt(i, take); left -= take;
      }
    }
    if (r.gold) { c.gold += r.gold; c.emit('change'); }
    for (const [item, qty = 1] of r.items ?? []) c.addItem(item, qty);
    if (r.exp) c.gainExp(r.exp);
    this.state[id].status = 'done';
    c.save?.(); this.save(); this.emit('complete', q); this.emit('change');
    return true;
  }

  onKill(type) {
    let changed = false;
    for (const q of this.active()) if (q.objectives.some(o => o.kill === type)) {
      const kills = this.state[q.id].kills; kills[type] = (kills[type] ?? 0) + 1; changed = true;
    }
    if (changed) { this.save(); this.emit('change'); }
  }
  onTalk(npcId) {
    let changed = false;
    for (const q of this.active()) if (q.objectives.some(o => o.talk === npcId) && !this.state[q.id].talked.includes(npcId)) { this.state[q.id].talked.push(npcId); changed = true; }
    if (changed) { this.save(); this.emit('change'); }
  }
  onDiscover() { this.emit('change'); }

  // Lines for the quest tracker panel.
  tracker(describe) {
    return this.active().map(q => ({
      title: q.title, complete: this.isComplete(q.id),
      lines: q.objectives.map(o => { const p = this.objectiveProgress(q, o); return { text: describe(o), have: p.have, need: p.need }; }),
    }));
  }
}
