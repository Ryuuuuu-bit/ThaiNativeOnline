// The class's four combat skills (src/combat/data/skills.js) as an action bar
// controller (src/ui/ActionBar.js), for classes without a ten-skill kit
// (src/classes CLASS_KITS). Casting goes through Combat.useSkill as before.
import { SKILLS } from './data/skills.js';
import { iconHtml } from '../ui/icons.js';

const KIND_TEXT = { damage: 'โจมตีเป้าหมาย', aoe: 'โจมตีเป็นวง', buff: 'เสริมพลังตัวเอง', heal: 'ฟื้น HP', debuff: 'ทำให้เป้าหมายอ่อนแอ', pet: 'สั่งสัตว์คู่ใจ' };

export function legacyCaster(combat) {
  const c = combat.character, ids = c.cls.skills;
  const slots = ids.map(id => {
    const s = SKILLS[id];
    return { id, name: s.name, html: iconHtml(s), cd: s.cd || 0, mp: s.mp || 0, desc: s.basic ? 'โจมตีปกติ · ตีต่อเนื่องใส่เป้าหมาย (Space)' : KIND_TEXT[s.kind] };
  });
  return {
    slots,
    get busy() { return !!combat.pending && !SKILLS[combat.pending.skillId]?.basic; },   // a skill walking in is not replaced every tick
    cast(i, quiet) {
      const id = ids[i], s = SKILLS[id];
      if (quiet) {
        // AUTO: skip what can't fire instead of logging why.
        if ((c.cooldowns[id] || 0) > 0 || c.mp < s.mp || combat.gcd > 0 && !s.basic) return false;
        const needsTarget = s.kind !== 'buff' && s.kind !== 'heal' && !(s.kind === 'aoe' && s.around === 'self');
        if (needsTarget && !combat.target?.alive && !combat.cycleTarget()) return false;
        // no MP for nothing: a self skill only in a fight, a heal only when hurt
        if (!needsTarget && !combat.inCombat && !combat.target?.alive) return false;
        if (s.kind === 'heal' && c.hp >= c.maxHp * .9) return false;
      }
      return !!combat.useSkill(id).ok;
    },
    cooldown(i) { const id = ids[i]; return [c.cooldowns[id] || 0, (SKILLS[id].cd || 0) * (1 - c.cooldownCut)]; },
    usable(i) { return c.mp >= SKILLS[ids[i]].mp; },
    active(i) { const id = ids[i]; return combat.pending?.skillId === id || (!!SKILLS[id].basic && combat.autoAttack); },
  };
}
