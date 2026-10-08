import { BOSS_SKILLS } from './data/boss-skills.js';
export const BOSS_SKILL_HINTS = { circle: 'ออกจากวงเตือน', cone: 'หลบออกด้านข้าง', ring: 'เข้าวงใน หรือถอยออกนอกวง' };

export const bossSkillsFor = monster => BOSS_SKILLS[monster.type] ?? [];
export const bossPhase = monster => monster.hp / monster.maxHp <= .5 ? 2 : 1;

// Exact shared geometry for server hits, offline combat and rendered outlines.
export function inBossSkill(cast, point) {
  const dx = point.x - cast.x, dz = point.z - cast.z, d = Math.hypot(dx, dz);
  if (d > cast.radius) return false;
  if (cast.shape === 'ring' && d < cast.innerRadius) return false;
  if (cast.shape === 'cone' && d > .001) {
    const angle = Math.atan2(dx, dz) - cast.facing;
    return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) <= cast.angle / 2;
  }
  return true;
}

export function resetBossSkills(monster) {
  monster.skillCast = null; monster.skillCooldown = 3;
  monster.skillIndex = 0; monster.skillRecovery = 0;
}
export function cancelBossSkill(monster) {
  if (!monster.skillCast) return [];
  const cast = monster.skillCast; monster.skillCast = null;
  monster.skillCooldown = Math.max(monster.skillCooldown ?? 0, 3);
  return [{ t: 'mskill', id: monster.id, stage: 'cancel', cast }];
}

// Returns busy while casting / recovering so no movement or basic swing can
// happen in the same tick. The caller validates combat state and line of sight.
export function tickBossSkills(monster, dt, target, players, power = 1) {
  const skills = bossSkillsFor(monster), events = [];
  if (!skills.length) return { busy: false, events };
  if (monster.skillRecovery > 0) {
    monster.skillRecovery = Math.max(0, monster.skillRecovery - dt);
    return { busy: true, events };
  }
  const pending = monster.skillCast;
  if (pending) {
    pending.remaining -= dt;
    if (pending.remaining > 0) return { busy: true, events };
    monster.skillCast = null; monster.skillRecovery = 1.1;
    events.push({ t: 'mskill', id: monster.id, stage: 'impact', cast: pending });
    for (const p of players) if (!p.dead && inBossSkill(pending, p)) {
      events.push({ t: 'ma', id: monster.id, to: p.id, power: power * pending.power, skill: pending.id, origin: { x: pending.x, z: pending.z } });
    }
    return { busy: true, events };
  }
  monster.skillCooldown = Math.max(0, (monster.skillCooldown ?? 3) - dt);
  if (monster.skillCooldown > 0 || Math.hypot(monster.x - target.x, monster.z - target.z) > 12) return { busy: false, events };
  const skill = skills[(monster.skillIndex ?? 0) % skills.length];
  monster.skillIndex = (monster.skillIndex ?? 0) + 1;
  const phase = bossPhase(monster);
  const facing = Math.atan2(target.x - monster.x, target.z - monster.z);
  const cast = { ...skill, x: skill.aim === 'target' ? target.x : monster.x, z: skill.aim === 'target' ? target.z : monster.z,
    facing, phase, serial: monster.skillSerial = (monster.skillSerial ?? 0) + 1,
    remaining: skill.windup };
  monster.skillCast = cast; monster.skillCooldown = skill.cooldown * (phase === 2 ? .8 : 1);
  monster.facing = monster.f = facing; monster.dirty = true;
  // Cadence changes below half HP, but dodge time and damage stay predictable.
  events.push({ t: 'mskill', id: monster.id, stage: 'windup', cast: { ...cast } });
  return { busy: true, events };
}
