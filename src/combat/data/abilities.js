// Hotbar abilities for the swordsman (นักดาบ). Pure data — no logic, no three.
// type:
//   'melee' — single target; needs a target within `range` (auto-targets nearest if none).
//   'aoe'   — hits every living enemy within `radius` of the player; no target needed.
//   'heal'  — restores healPct * maxHp + attack * multiplier to the player.
// hits / hitInterval: multi-hit abilities deal `multiplier` damage per hit, spaced in seconds.
// playerAction: pose name passed to player.playAction(); unknown names are safely ignored.
export const GLOBAL_COOLDOWN = 0.45;

export const abilities = [
  {
    id: 'slash',
    name: 'ฟันดาบ',
    description: 'ฟันดาบตรงหน้าอย่างรวดเร็ว',
    slot: 0,
    key: '1',
    icon: '⚔',
    type: 'melee',
    range: 2.0,
    cooldown: 0.9,
    mpCost: 0,
    multiplier: 1.0,
    hits: 1,
    playerAction: 'attack',
  },
  {
    id: 'twin-edge',
    name: 'ดาบสองคม',
    description: 'ฟันต่อเนื่องสองจังหวะ',
    slot: 1,
    key: '2',
    icon: '⚡',
    type: 'melee',
    range: 2.0,
    cooldown: 4,
    mpCost: 8,
    multiplier: 0.85,
    hits: 2,
    hitInterval: 0.22,
    playerAction: 'combo',
  },
  {
    id: 'whirlwind',
    name: 'พายุใบดาบ',
    description: 'หมุนตัวฟันรอบทิศ โจมตีศัตรูทุกตัวรอบกาย',
    slot: 2,
    key: '3',
    icon: '✺',
    type: 'aoe',
    range: 0,
    radius: 2.9,
    cooldown: 8,
    mpCost: 16,
    multiplier: 1.2,
    hits: 1,
    playerAction: 'spin',
  },
  {
    id: 'incantation',
    name: 'คาถาคงกระพัน',
    description: 'ร่ายคาถาฟื้นฟูพลังชีวิต',
    slot: 3,
    key: '4',
    icon: '☸',
    type: 'heal',
    range: 0,
    cooldown: 15,
    mpCost: 22,
    multiplier: 1.0,
    healPct: 0.3,
    hits: 1,
    playerAction: 'cast',
  },
];

// Short Thai messages for useAbility() failure reasons (used by the HUD).
export const reasonText = {
  cooldown: 'ยังไม่พร้อมใช้',
  gcd: 'ยังไม่พร้อมใช้',
  no_mp: 'พลังเวทไม่พอ',
  no_target: 'ไม่มีเป้าหมายในระยะ',
  out_of_range: 'เป้าหมายอยู่ไกลเกินไป',
  dead: 'คุณหมดสติอยู่',
  full_hp: 'พลังชีวิตเต็มแล้ว',
  invalid_slot: 'ไม่มีทักษะในช่องนี้',
};
