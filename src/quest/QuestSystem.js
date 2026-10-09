// Quest progress as pure logic: no DOM or Three.js, so it runs in tests.
// It reads the character and combat only through their public APIs
// (gold, count, addItem, removeAt, gainExp, combat 'kill' events).
import { Emitter } from '../character/Emitter.js';
import { cleanMasteries, masteryForQuest } from '../character/data/masteries.js';
import { ITEMS } from '../character/data/items.js';

// Reserve the entire reward together: two new stacks cannot share one free slot.
// Keep the existing conservative rule that rewards fit before hand-in materials go.
function rewardsFit(c, items) {
  if (!items.length) return true;
  let free = c.inventory.filter(s => !s).length, weight = 0;
  const stacks = new Set(c.inventory.filter(s => s && s.locked !== true && ITEMS[s.id]?.type !== 'equip').map(s => s.id));
  for (const [id, qty = 1] of items) {
    const d = ITEMS[id];
    if (!d || d.retired || !Number.isSafeInteger(qty) || qty < 1 || !c.canTake(id, qty)) return false;
    weight += (d.weight || 0) * qty;
    if (d.type === 'equip') free -= qty;
    else if (!stacks.has(id)) { free--; stacks.add(id); }
  }
  return free >= 0 && Math.round(weight * 10) <= c.maxWeight * 10 - Math.round(c.weight * 10);
}

const SAVE_KEY = 'tno.quests.v1';

export class QuestSystem extends Emitter {
  constructor(defs, { isDiscovered = () => false, storage = globalThis.localStorage, deferMastery = false, deferPractice = false } = {}) {
    super();
    this.defs = new Map(defs.map(q => [q.id, q]));
    this.isDiscovered = isDiscovered; this.storage = storage; this.deferMastery = deferMastery; this.deferPractice = deferPractice;
    this.state = {}; // id -> { status: 'active' | 'done', kills: { type: n }, talked: [] }
    try { Object.assign(this.state, JSON.parse(storage?.getItem(SAVE_KEY) ?? '{}')); } catch { /* fresh start */ }
    this.character = null;
  }
  save() { try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable */ } }

  attach(character, combat) {
    this.character = character;
    const localCasts = new Map(), localHits = new WeakSet();
    const localCast = id => { if (!this.deferPractice) localCasts.set(id, {}); };
    combat?.on('kill', ({ monster }) => this.onKill(monster.type));
    // Non-dummy KitCaster emits kit-cast; legacy emits cast. Signed-in clients
    // disable these local predictions and adopt server-counted practice instead.
    combat?.on('kit-cast', ({ id }) => { localCast(id); if (!this.deferPractice && combat.combatTimer > 0) this.onPracticeCast(id); });
    combat?.on('cast', ({ skillId, skill }) => {
      if (character.kitSkills.length || skill?.basic) return;
      localCast(skillId); if (!this.deferPractice && combat.combatTimer > 0) this.onPracticeCast(skillId);
    });
    combat?.on('verified-skill-hit', ({ skillId, now }) => { if (!this.deferPractice) this.onVerifiedSkillHit(skillId, now); });
    if (typeof combat?.damageMonster === 'function') {
      const damage = combat.damageMonster.bind(combat);
      combat.damageMonster = (monster, amount, options = {}) => {
        const before = monster?.hp, live = monster?.alive, token = localCasts.get(options.skill);
        const result = damage(monster, amount, options);
        // Observe actual offline damage, including killing blows. Online hits are
        // server-owned; dummy visuals never call this with a combat-roster monster.
        if (!this.deferPractice && !combat.remote && live && monster.hp < before && !options.miss
          && combat.monsters.includes(monster) && token && !localHits.has(token)) {
          localHits.add(token);
          combat.emit('verified-skill-hit', { skillId:options.skill, now:Date.now()/1000 });
        }
        return result;
      };
    }
    character.on('inventory', () => this.emit('change'));
    this.emit('change');
  }

  status(id) { return this.state[id]?.status ?? 'none'; }
  turnInOf(q) { return q.turnIn ?? q.giver; }
  matchesClass(q) { return !!q && (!q.classId || q.classId === this.character?.classId); }
  requirementFailures(q) {
    if (!q || !this.character) return [{ kind: 'character' }];
    const c = this.character, reasons = [];
    if (!this.matchesClass(q)) reasons.push({ kind: 'class', classId: q.classId });
    if (!Number.isFinite(c.level) || c.level < (q.minLevel ?? 1)) reasons.push({ kind: 'level', need: q.minLevel ?? 1 });
    if (q.minJobLevel && (!Number.isFinite(c.jobLevel) || c.jobLevel < q.minJobLevel)) reasons.push({ kind: 'job', need: q.minJobLevel });
    for (const id of q.requires ?? []) if (this.status(id) !== 'done') reasons.push({ kind: 'quest', id });
    return reasons;
  }
  canAccept(q) {
    return !!q && this.status(q.id) === 'none' && !this.requirementFailures(q).length;
  }
  // Quests an NPC can offer, and active quests ready to hand in to them.
  offers(npcId) { return [...this.defs.values()].filter(q => q.giver === npcId && this.canAccept(q)); }
  locked(npcId) { return [...this.defs.values()].filter(q => q.classId && q.giver === npcId && this.matchesClass(q) && this.status(q.id) === 'none' && !this.canAccept(q)); }
  ready(npcId) { return this.active().filter(q => this.turnInOf(q) === npcId && this.isComplete(q.id)); }
  active() { return [...this.defs.values()].filter(q => this.status(q.id) === 'active' && this.matchesClass(q)); }
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
    if (o.practice) return { have: Math.min(o.count, o.practice.reduce((sum, id) => sum + (s.casts?.[id] ?? 0), 0)), need: o.count };
    if (o.combo) return { have: s.combo?.done ? 1 : 0, need: 1 };
    if (o.collect) return { have: Math.min(o.count, this.character?.countUnlocked(o.collect) ?? 0), need: o.count };
    if (o.talk) return { have: s.talked?.includes(o.talk) ? 1 : 0, need: 1 };
    return { have: 0, need: 1 };
  }
  isComplete(id) {
    const q = this.defs.get(id);
    return !!q && !this.requirementFailures(q).length && q.objectives.every(o => { const p = this.objectiveProgress(q, o); return p.have >= p.need; });
  }

  accept(id) {
    const q = this.defs.get(id);
    if (!q || !this.canAccept(q)) return false;
    this.state[id] = { status: 'active', kills: {}, talked: [], casts: {} };
    this.save(); this.emit('accept', q); this.emit('change');
    return true;
  }
  // Hands in a finished quest: takes collected items, then pays the rewards.
  complete(id) {
    const q = this.defs.get(id), c = this.character;
    if (!q || this.status(id) !== 'active' || !this.isComplete(id) || !c) return false;
    const r = q.rewards ?? {};
    const mastery = r.mastery ? masteryForQuest(q, c.classId) : null;
    // A typo, another class's reward, or a forged quest→mastery binding pays nothing.
    if (r.mastery && !mastery) return false;
    // the rewards must fit before anything is taken or paid (a full bag loses nothing)
    if (!rewardsFit(c, r.items ?? [])) { this.emit('fail', 'กระเป๋าเต็มหรือน้ำหนักเกิน · เก็บที่ว่างก่อนรับรางวัล'); return false; }
    for (const o of q.objectives) if (o.collect) {
      let left = o.count;
      for (let i = 0; i < c.inventory.length && left > 0; i++) {
        const slot = c.inventory[i];
        if (slot?.id !== o.collect || slot.locked === true) continue;
        const take = Math.min(left, slot.qty); c.removeAt(i, take); left -= take;
      }
    }
    if (r.gold) { c.gold += r.gold; c.emit('change'); }
    for (const [item, qty = 1] of r.items ?? []) c.addItem(item, qty);
    if (r.exp) c.gainExp(r.exp);
    this.state[id].status = 'done';
    // Signed-in clients defer this flag until NetProgress adopts the server's copy.
    // Local guests and the authoritative server use the same matching-quest grant.
    if (mastery && !this.deferMastery) {
      c.masteries = { ...cleanMasteries(c.classId, c.masteries), [mastery.id]: true };
      c.emit('change');
    }
    c.save?.(); this.save(); this.emit('complete', q); this.emit('change');
    return true;
  }

  onKill(type) {
    let changed = false;
    for (const q of this.active()) if (q.objectives.some(o => o.kill === type)) {
      const kills = this.state[q.id].kills ??= {}, need = Math.max(...q.objectives.filter(o => o.kill === type).map(o => o.count));
      const before = kills[type] ?? 0; kills[type] = Math.min(need, before + 1); changed ||= kills[type] !== before;
    }
    if (changed) { this.save(); this.emit('change'); }
  }
  onTalk(npcId) {
    let changed = false;
    for (const q of this.active()) if (q.objectives.some(o => o.talk === npcId)) {
      const talked = this.state[q.id].talked ??= [];
      if (!talked.includes(npcId)) { talked.push(npcId); changed = true; }
    }
    if (changed) { this.save(); this.emit('change'); }
  }
  // Called by recordQuestCast only after a real accepted server cast in combat.
  // Guest callers use locally validated non-dummy combat events above.
  onPracticeCast(skillId) {
    let changed = false;
    for (const q of this.active()) for (const o of q.objectives) {
      if (!o.practice?.includes(skillId) || this.objectiveProgress(q, o).have >= o.count) continue;
      const casts = this.state[q.id].casts ??= {};
      casts[skillId] = (casts[skillId] ?? 0) + 1; changed = true;
    }
    if (changed) { this.save(); this.emit('change'); }
    return changed;
  }
  // Authoritative landed hits, once per cast. Expired first hits do not complete
  // the drill; order/target are free, but two DIFFERENT listed skills must hit.
  onVerifiedSkillHit(skillId, now) {
    if (!Number.isFinite(now) || now < 0) return false;
    let changed = false;
    for (const q of this.active()) for (const o of q.objectives) {
      if (!o.combo?.skills.includes(skillId) || this.state[q.id].combo?.done) continue;
      const previous = this.state[q.id].combo?.hits ?? {};
      if (Object.values(previous).some(t => t > now)) continue;
      const hits = Object.fromEntries(Object.entries(previous).filter(([, t]) => now - t <= o.combo.seconds));
      hits[skillId] = now;
      this.state[q.id].combo = { hits, done: Object.keys(hits).length >= 2 };
      changed = true;
    }
    if (changed) { this.save(); this.emit('change'); }
    return changed;
  }
  onDiscover() { this.emit('change'); }

  // Lines for the quest tracker panel.
  tracker(describe) {
    return this.active().map(q => ({
      title: q.title, complete: this.isComplete(q.id), turnIn: this.turnInOf(q),
      lines: q.objectives.map(o => { const p = this.objectiveProgress(q, o); return { text: describe(o), have: p.have, need: p.need }; }),
    }));
  }
}
