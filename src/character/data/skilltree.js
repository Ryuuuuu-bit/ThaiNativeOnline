// Content data only: each class's skill tree (Ragnarok style). The class's first kit skill is
// the root (known from the start); the other nine sit on three lines, each line a way to play
// the class (one target / crowds / support), and a skill opens when the skills before it on its
// line have enough levels (`req`: { skill id: level }) and the job level has reached its floor
// (`job`, so the big ones stay late). Skills go up to MAX_SKILL_LEVEL (progression.js) with one
// point a job level: 49 points against 100 skill levels is what makes builds differ.
//
//   treeOf(classId) → { lines: [{ name, role, color, passive, skills: [id, …] }] }
//   Each line also carries one passive skill (src/rules/data/kitpassives.js), off the hotbar,
//   opening when the line's first skill reaches Lv.3: the stat that fits that way of playing.
//   reqOf(classId, id) → { req: { id: lv }, job }   ({} for the root or an unknown id)
const RED = '#c8322a', BLUE = '#2f74c9', GOLD = '#c9a04c';

export const SKILL_TREE = {
  warrior: {
    lines: [
      { name: 'ดาบคู่', passive: 'sword_t_mastery', role: 'เปิดเกราะ · ปิดจังหวะ', color: RED, skills: ['sword_thrust', 'sword_execute'] },
      { name: 'วงจักร', passive: 'sword_t_breath', role: 'ตรึงพื้นที่ · กวาดฝูง', color: BLUE, skills: ['sword_wind', 'sword_whirl', 'sword_pikat', 'sword_leap'] },
      { name: 'ธงชัย', passive: 'sword_t_hide', role: 'ท้าศัตรู · คุ้มทีม', color: GOLD, skills: ['sword_guard', 'sword_banner', 'sword_berserk'] },
    ],
    req: {
      sword_t_hide: { req: { sword_guard: 3 }, job: 8 },
      sword_t_breath: { req: { sword_wind: 3 }, job: 8 },
      sword_t_mastery: { req: { sword_thrust: 3 }, job: 8 },
      sword_thrust: { req: { sword_twin: 3 }, job: 5 }, sword_execute: { req: { sword_thrust: 5, sword_twin: 5 }, job: 30 },
      sword_wind: { req: { sword_twin: 2 }, job: 3 }, sword_whirl: { req: { sword_wind: 3 }, job: 10 }, sword_pikat: { req: { sword_whirl: 5 }, job: 20 }, sword_leap: { req: { sword_pikat: 3 }, job: 30 },
      sword_guard: { req: { sword_twin: 2 }, job: 3 }, sword_banner: { req: { sword_guard: 3 }, job: 10 }, sword_berserk: { req: { sword_banner: 5, sword_guard: 5 }, job: 30 },
    },
  },
  muaythai: {
    lines: [
      { name: 'หมัดศอกเข่า', passive: 'boxer_t_wit', role: 'ศอกเปิดเกราะ · เข่าปิดชุด', color: RED, skills: ['boxer_elbow', 'boxer_knee', 'boxer_hanuman'] },
      { name: 'เตะ', passive: 'boxer_t_shin', role: 'ขัดจังหวะ · ลดแรงศัตรู', color: BLUE, skills: ['boxer_kick', 'boxer_croc', 'boxer_ngouy'] },
      { name: 'ไหว้ครู', passive: 'boxer_t_calm', role: 'ตั้งรับ · เร่งจังหวะทีม', color: GOLD, skills: ['boxer_waikru', 'boxer_drum', 'boxer_iron'] },
    ],
    req: {
      boxer_t_calm: { req: { boxer_waikru: 3 }, job: 8 },
      boxer_t_shin: { req: { boxer_kick: 3 }, job: 8 },
      boxer_t_wit: { req: { boxer_elbow: 3 }, job: 8 },
      boxer_elbow: { req: { boxer_jab: 3 }, job: 5 }, boxer_knee: { req: { boxer_elbow: 3 }, job: 12 }, boxer_hanuman: { req: { boxer_knee: 5, boxer_jab: 5 }, job: 30 },
      boxer_kick: { req: { boxer_jab: 2 }, job: 3 }, boxer_croc: { req: { boxer_kick: 3 }, job: 10 }, boxer_ngouy: { req: { boxer_croc: 5 }, job: 22 },
      boxer_waikru: { req: { boxer_jab: 2 }, job: 3 }, boxer_drum: { req: { boxer_waikru: 3 }, job: 10 }, boxer_iron: { req: { boxer_drum: 5, boxer_waikru: 5 }, job: 30 },
    },
  },
  hunter: {
    lines: [
      { name: 'ศรเหยี่ยว', passive: 'arch_t_eye', role: 'เล็งช่องเปิด · เป้าเดียว', color: RED, skills: ['arch_hawk', 'arch_snipe'] },
      { name: 'ห่าศร', passive: 'arch_t_bow', role: 'ตรึงพื้นที่ · กวาดฝูง', color: BLUE, skills: ['arch_pierce', 'arch_volley', 'arch_trap', 'arch_meteor'] },
      { name: 'หมาล่า', passive: 'arch_t_bond', role: 'คู่หูตรึงเป้า · ข่มขวัญ', color: GOLD, skills: ['arch_poison', 'arch_garuda', 'arch_rain'] },
    ],
    req: {
      arch_t_bond: { req: { arch_poison: 3 }, job: 8 },
      arch_t_bow: { req: { arch_pierce: 3 }, job: 8 },
      arch_t_eye: { req: { arch_hawk: 3 }, job: 8 },
      arch_hawk: { req: { arch_quick: 3 }, job: 5 }, arch_snipe: { req: { arch_hawk: 5, arch_quick: 5 }, job: 30 },
      arch_pierce: { req: { arch_quick: 2 }, job: 3 }, arch_volley: { req: { arch_pierce: 3 }, job: 10 }, arch_trap: { req: { arch_volley: 3 }, job: 20 }, arch_meteor: { req: { arch_trap: 5, arch_pierce: 5 }, job: 30 },
      arch_poison: { req: { arch_quick: 2 }, job: 3 }, arch_garuda: { req: { arch_poison: 3 }, job: 10 }, arch_rain: { req: { arch_garuda: 5, arch_poison: 5 }, job: 30 },
    },
  },
  shaman: {
    lines: [
      { name: 'คำสาป', passive: 'mage_t_tongue', role: 'คำสาปเปิดช่อง · คุมศัตรู', color: RED, skills: ['mage_yant', 'mage_thunder', 'mage_curse'] },
      { name: 'ไฟนรก', passive: 'mage_t_fire', role: 'ตรึงพื้นที่ · กวาดฝูง', color: BLUE, skills: ['mage_ghostfire', 'mage_kalp', 'mage_storm'] },
      { name: 'ผีบรรพบุรุษ', passive: 'mage_t_barami', role: 'คุ้มวง · เติมพลังทีม', color: GOLD, skills: ['mage_shield', 'mage_holy', 'mage_meditate'] },
    ],
    req: {
      mage_t_barami: { req: { mage_shield: 3 }, job: 8 },
      mage_t_fire: { req: { mage_ghostfire: 3 }, job: 8 },
      mage_t_tongue: { req: { mage_yant: 3 }, job: 8 },
      mage_yant: { req: { mage_akom: 2 }, job: 3 }, mage_thunder: { req: { mage_yant: 3 }, job: 10 }, mage_curse: { req: { mage_thunder: 5, mage_yant: 5 }, job: 25 },
      mage_ghostfire: { req: { mage_akom: 2 }, job: 3 }, mage_kalp: { req: { mage_ghostfire: 3 }, job: 10 }, mage_storm: { req: { mage_kalp: 5, mage_ghostfire: 5 }, job: 30 },
      mage_shield: { req: { mage_akom: 3 }, job: 5 }, mage_holy: { req: { mage_shield: 3 }, job: 12 }, mage_meditate: { req: { mage_holy: 5, mage_shield: 5 }, job: 30 },
    },
  },
  herbalist: {
    lines: [
      { name: 'พิธีโอสถ', passive: 'heal_t_recipe', role: 'ฮีลหลัก · ชุบชีวิต', color: GOLD, skills: ['heal_mist', 'heal_khwan', 'heal_amrita'] },
      { name: 'สมุนไพรพิษ', passive: 'heal_t_venom', role: 'พิษเปิดทาง · ครกเกื้อกูล', color: BLUE, skills: ['heal_pill', 'heal_zone', 'heal_mortar'] },
      { name: 'ยาบำรุง', passive: 'heal_t_hands', role: 'ล้างสถานะ · บำรุงทีม', color: RED, skills: ['heal_tiger', 'heal_tonic', 'heal_mother'] },
    ],
    req: {
      heal_t_hands: { req: { heal_tiger: 3 }, job: 8 },
      heal_t_venom: { req: { heal_pill: 3 }, job: 8 },
      heal_t_recipe: { req: { heal_mist: 3 }, job: 8 },
      heal_mist: { req: { heal_vine: 3 }, job: 5 }, heal_khwan: { req: { heal_mist: 5 }, job: 15 }, heal_amrita: { req: { heal_khwan: 5 }, job: 30 },
      heal_pill: { req: { heal_vine: 2 }, job: 3 }, heal_zone: { req: { heal_pill: 3 }, job: 10 }, heal_mortar: { req: { heal_zone: 5 }, job: 22 },
      heal_tiger: { req: { heal_vine: 2 }, job: 3 }, heal_tonic: { req: { heal_tiger: 3 }, job: 12 }, heal_mother: { req: { heal_tonic: 5 }, job: 30 },
    },
  },
};

export const treeOf = classId => SKILL_TREE[classId] ?? null;
export const reqOf = (classId, id) => SKILL_TREE[classId]?.req[id] ?? { req: {}, job: 1 };
// The line a skill is on (index into lines), -1 for the root.
export const lineOf = (classId, id) => SKILL_TREE[classId]?.lines.findIndex(l => l.skills.includes(id) || l.passive === id) ?? -1;
// The class's passives, in line order.
export const passivesOf = classId => (SKILL_TREE[classId]?.lines ?? []).map(l => l.passive).filter(Boolean);

// Every skill of a class learnt, at the lowest levels the tree allows (a skill others need is
// raised to what they need; the rest stay at `base`): a full, valid kit for tools and tests.
export function fullKit(classId, ids, base = 1) {
  const lv = Object.fromEntries(ids.map(id => [id, base]));
  for (const id of ids) for (const [k, n] of Object.entries(reqOf(classId, id).req ?? {})) lv[k] = Math.max(lv[k] ?? base, n);
  return lv;
}
