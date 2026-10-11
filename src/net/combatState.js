// The server publishes transient buffs and authoritative vitals, independently
// of inventory/action acknowledgements. Buffs are never part of a saved sheet.
import { isHarmfulBuff } from '../character/Character.js';

export function applyCombatState(character, state, { cleanse = false } = {}) {
  if (!state) return false;
  if (state.owned) {
    if (Number.isFinite(state.hp)) {
      if (state.hp <= 0) character.fall();
      else character.hp = Math.min(character.maxHp, state.hp);
    }
    if (Number.isFinite(state.mp)) character.mp = Math.max(0, Math.min(character.maxMp, state.mp));
  }
  if (Array.isArray(state.buffs)) {
    const incoming = state.buffs.filter(b => b && typeof b.id === 'string' && Number.isFinite(b.remaining) && b.remaining > 0 && !(cleanse && isHarmfulBuff(b))).map(b => ({ ...b }));
    // Guest poison is resolved locally and is absent from server kit snapshots.
    const local = !state.owned && !cleanse ? character.buffs.filter(b => isHarmfulBuff(b) && b.remaining > 0 && !incoming.some(o => o.id === b.id)) : [];
    character.buffs = character.alive ? [...local, ...incoming] : [];
  } else if (cleanse) {
    character.buffs = character.buffs.filter(b => !isHarmfulBuff(b));
  }
  if (cleanse) character.emit('cleansed');
  character.emit('change');
  return true;
}

// A party aid restores a fallen player once, then applies protection. Owned
// vitals are exact snapshots; guest vitals consume only the supplied increment.
export function applyAid(character, message, revive) {
  let revived = false;
  if (!character.alive) {
    if (!message.revive || !revive?.(message.revive)) return null;
    revived = true;
  }
  let heal = 0;
  if (message.state?.owned) {
    applyCombatState(character, message.state, { cleanse: !!message.buff?.cleanse });
    heal = message.amount || 0;
  } else {
    if (!revived && (message.heal || message.hp)) heal = character.heal(character.maxHp * (message.heal || 0) + (message.hp || 0));
    if (!revived && message.mp) { character.mp = Math.min(character.maxMp, Math.round(character.mp + character.maxMp * message.mp)); character.emit('change'); }
    if (message.buff) character.addBuff(message.buff);
  }
  return { revived, heal };
}
