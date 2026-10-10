// Content data only: the classes' passive skills, one on each line of the skill tree
// (src/character/data/skilltree.js). They never go on the hotbar; learnt levels add to the
// character's derived stats (src/character/Character.js passiveBonus → computeDerived keys:
// atk matk def hp mp crit critDmg acc eva aspd castRed healMul, and the multipliers hpMul
// mpMul patkMul matkMul), plus a few of their own the fights read: petMul (the hunter's dog).
//
//   KIT_PASSIVES[id] = { nameTh, icon, cls, desc, bonus(lv) → { key: value } }
// A passive goes up to MAX_SKILL_LEVEL (10) like any skill; the numbers below are per level.
export const KIT_PASSIVES = {
  // ---- ขุนศึก ----
  sword_t_mastery: { nameTh: 'ชำนาญดาบ', cls: 'warrior', icon: '/fx/warrior/icon_sword_t_mastery.png',
    desc: 'ติดตัว: ลับดาบคู่จนชินมือ พลังโจมตีกายภาพ +2% ต่อเลเวล', bonus: lv => ({ patkMul: .02 * lv }) },
  sword_t_breath: { nameTh: 'ลมหายใจนักรบ', cls: 'warrior', icon: '/fx/warrior/icon_sword_t_breath.png',
    desc: 'ติดตัว: หายใจเป็นจังหวะกลางวงล้อม HP +15 และหลบหลีก +1 ต่อเลเวล', bonus: lv => ({ hp: 15 * lv, eva: 1 * lv }) },
  sword_t_hide: { nameTh: 'หนังเหนียว', cls: 'warrior', icon: '/fx/warrior/icon_sword_t_hide.png',
    desc: 'ติดตัว: ร่างกายทนทานดั่งหนังควาย HP สูงสุด +3% และป้องกัน +1 ต่อเลเวล', bonus: lv => ({ hpMul: .03 * lv, def: 1 * lv }) },
  // ---- มวยไทย ----
  boxer_t_wit: { nameTh: 'ไหวพริบนักมวย', cls: 'muaythai', icon: '/fx/muaythai/icon_boxer_t_wit.png',
    desc: 'ติดตัว: อ่านจังหวะคู่ต่อสู้ออก ความเร็วโจมตี +1.5% ต่อเลเวล', bonus: lv => ({ aspd: .015 * lv }) },
  boxer_t_shin: { nameTh: 'ขาเหล็ก', cls: 'muaythai', icon: '/fx/muaythai/icon_boxer_t_shin.png',
    desc: 'ติดตัว: เตะต้นกล้วยจนหน้าแข้งแกร่ง พลังโจมตีกายภาพ +2% ต่อเลเวล', bonus: lv => ({ patkMul: .02 * lv }) },
  boxer_t_calm: { nameTh: 'จิตนิ่ง', cls: 'muaythai', icon: '/fx/muaythai/icon_boxer_t_calm.png',
    desc: 'ติดตัว: ใจนิ่งดั่งครูมวย MP +10 และป้องกัน +1 ต่อเลเวล', bonus: lv => ({ mp: 10 * lv, def: 1 * lv }) },
  // ---- พราน ----
  arch_t_eye: { nameTh: 'สายตาพราน', cls: 'hunter', icon: '/fx/hunter/icon_arch_t_eye.png',
    desc: 'ติดตัว: เล็งจุดตายได้แม่น อัตราคริ +1% และแรงคริ +2% ต่อเลเวล', bonus: lv => ({ crit: .01 * lv, critDmg: .02 * lv }) },
  arch_t_bow: { nameTh: 'ธนูหนัก', cls: 'hunter', icon: '/fx/hunter/icon_arch_t_bow.png',
    desc: 'ติดตัว: น้าวสายธนูได้ตึงกว่าใคร พลังโจมตีกายภาพ +2% ต่อเลเวล', bonus: lv => ({ patkMul: .02 * lv }) },
  arch_t_bond: { nameTh: 'สายใยคู่หู', cls: 'hunter', icon: '/fx/hunter/icon_arch_t_bond.png',
    desc: 'ติดตัว: น้องหมารู้ใจพราน หมากัดแรงขึ้น +4% ต่อเลเวล', bonus: lv => ({ petMul: .04 * lv }) },
  // ---- หมอผี ----
  mage_t_tongue: { nameTh: 'ลิ้นอาคม', cls: 'shaman', icon: '/fx/shaman/icon_mage_t_tongue.png',
    desc: 'ติดตัว: ท่องคาถาคล่องปาก ลดคูลดาวน์สกิล −1% ต่อเลเวล', bonus: lv => ({ castRed: .01 * lv }) },
  mage_t_fire: { nameTh: 'ไฟในใจ', cls: 'shaman', icon: '/fx/shaman/icon_mage_t_fire.png',
    desc: 'ติดตัว: เพลิงอาคมลุกในอก พลังเวทย์ +2% ต่อเลเวล', bonus: lv => ({ matkMul: .02 * lv }) },
  mage_t_barami: { nameTh: 'บารมีผี', cls: 'shaman', icon: '/fx/shaman/icon_mage_t_barami.png',
    desc: 'ติดตัว: ผีบรรพบุรุษหนุนหลัง MP สูงสุด +3% และป้องกัน +1 ต่อเลเวล', bonus: lv => ({ mpMul: .03 * lv, def: 1 * lv }) },
  // ---- หมอยา ----
  heal_t_recipe: { nameTh: 'ตำรับโอสถ', cls: 'herbalist', icon: '/fx/herbalist/icon_heal_t_recipe.png',
    desc: 'ติดตัว: ท่องตำรายาจนขึ้นใจ พลังรักษา +2.5% ต่อเลเวล', bonus: lv => ({ healMul: .025 * lv }) },
  heal_t_venom: { nameTh: 'พิษสมุนไพร', cls: 'herbalist', icon: '/fx/herbalist/icon_heal_t_venom.png',
    desc: 'ติดตัว: รู้จักยาพิษทุกชนิด พลังเวทย์ +2% ต่อเลเวล (ยาที่ปาใส่ผีแรงขึ้น)', bonus: lv => ({ matkMul: .02 * lv }) },
  heal_t_hands: { nameTh: 'มือทอง', cls: 'herbalist', icon: '/fx/herbalist/icon_heal_t_hands.png',
    desc: 'ติดตัว: มือเบาปรุงยาไว MP +12 และฟื้นคืน MP สูงสุด +2% ต่อเลเวล', bonus: lv => ({ mp: 12 * lv, mpMul: .02 * lv }) },
};
export const KIT_PASSIVE_IDS = Object.fromEntries(['warrior', 'muaythai', 'hunter', 'shaman', 'herbalist'].map(cls => [cls, Object.keys(KIT_PASSIVES).filter(id => KIT_PASSIVES[id].cls === cls)]));
// Filled by evolution registration. Kept separate to avoid a skills↔passives cycle.
export const PASSIVE_PATH_BONUSES = {};
export function passiveBonusAt(id, lv, pick) {
  const n = Math.max(0, Math.min(10, Math.trunc(Number(lv) || 0)));
  if (!KIT_PASSIVES[id] || !n) return {};
  const path = n >= 5 && ['A', 'B'].includes(pick) ? PASSIVE_PATH_BONUSES[id]?.[pick] : null;
  return path ? Object.fromEntries(Object.entries(path).map(([k, v]) => [k, +(v * n).toFixed(4)])) : KIT_PASSIVES[id].bonus(n);
}
// The sum of the learnt passives' bonuses ({ id: lv } → { key: value }).
export function kitPassiveBonus(skills, choices = {}) {
  const out = {};
  for (const [id, lv] of Object.entries(skills || {})) { const p = KIT_PASSIVES[id]; if (!p || !(lv > 0)) continue; for (const [k, v] of Object.entries(passiveBonusAt(id, lv, choices[id]))) out[k] = +((out[k] || 0) + v).toFixed(4); }
  return out;
}
