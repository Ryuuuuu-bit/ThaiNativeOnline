// Ordinary expedition cards only. Retain weapon slots so saved sockets remain valid.
// These specialize a limited socket: accuracy, crit, casting, race damage or defense.
// Flat attack tops out at the old +20 fallback; no base stats with quadratic scaling,
// proc hooks, card level gates or changes to the eight expedition bosses are introduced.
export const EXPEDITION_CARD_DEFS = {
  // ป่าช้าไผ่ดำ — modest precision, critical force and faster spell preparation.
  bamboo_grave_0: { slot: 'weapon', bonus: { acc: 8, res_spirit: .04 } },
  bamboo_grave_1: { slot: 'weapon', bonus: { atk: 4, critDmg: .06 } },
  bamboo_grave_2: { slot: 'weapon', bonus: { matk: 6, cast: .03 } },
  // เหมืองอาคมร้าง — sustained work, crystal focus and a defensive stone option.
  sealed_mine_0: { slot: 'weapon', bonus: { atk: 8, hp: 40 } },
  sealed_mine_1: { slot: 'weapon', bonus: { crit: .03, acc: 6 } },
  sealed_mine_2: { slot: 'weapon', bonus: { def: 6, res_dark: .04 } },
  // นครบาดาล — spell reserves, water protection and precise demon hunting.
  sunken_city_0: { slot: 'weapon', bonus: { matk: 10, mp: 30 } },
  sunken_city_1: { slot: 'weapon', bonus: { atk: 10, res_water: .05 } },
  sunken_city_2: { slot: 'weapon', bonus: { vs_demon: .06, acc: 8 } },
  // ป้อมอสูรสนธยา — physical crits, repeated spell use and maximum-HP defense.
  dusk_fort_0: { slot: 'weapon', bonus: { atk: 12, critDmg: .08 } },
  dusk_fort_1: { slot: 'weapon', bonus: { matk: 12, cdr: .03 } },
  dusk_fort_2: { slot: 'weapon', bonus: { def: 8, hp: 80 } },
  // หุบเขายักษ์ — spirit hunting, accurate critical blows and a guarded fighter.
  giant_valley_0: { slot: 'weapon', bonus: { vs_spirit: .07, atk: 8 } },
  giant_valley_1: { slot: 'weapon', bonus: { acc: 12, critDmg: .1 } },
  giant_valley_2: { slot: 'weapon', bonus: { atk: 14, def: 4 } },
  // ป่าหิมพานต์ — spell endurance, evasive crits and specialized beast damage.
  himmapan_0: { slot: 'weapon', bonus: { mp: 60, cast: .04 } },
  himmapan_1: { slot: 'weapon', bonus: { crit: .04, eva: 6 } },
  himmapan_2: { slot: 'weapon', bonus: { vs_beast: .08, atk: 10 } },
  // นครอาคมล่มสลาย — demon magic, protected casting and spirit-facing endurance.
  fallen_city_0: { slot: 'weapon', bonus: { vs_demon: .08, matk: 12 } },
  fallen_city_1: { slot: 'weapon', bonus: { cast: .04, def: 6 } },
  fallen_city_2: { slot: 'weapon', bonus: { hp: 120, res_spirit: .06 } },
  // ประตูรอยแยกอสูร — capped offense, dark protection and demon-facing spell reserves.
  demon_rift_0: { slot: 'weapon', bonus: { atk: 20, crit: .04 } },
  demon_rift_1: { slot: 'weapon', bonus: { def: 10, res_dark: .08 } },
  demon_rift_2: { slot: 'weapon', bonus: { matk: 20, mp: 40, vs_demon: .08 } },
};

// Public identity copy for journal search/detail and the individual-art brief.
// SP is the player-facing resource name; the existing bonus/save key remains mp.
export const EXPEDITION_CARD_ROLES = {
  bamboo_grave_0: { buildRole: 'precision-ward', name: 'หน้ากากข่มผี', brief: 'เพิ่มความแม่นยำและต้านทานเผ่าผี เหมาะกับผู้ล่าที่ต้องยืนรับศัตรู' },
  bamboo_grave_1: { buildRole: 'physical-critical', name: 'คมกระดูก', brief: 'เพิ่ม ATK และความแรงคริ สำหรับการโจมตีกายภาพที่เน้นจังหวะคริติคอล' },
  bamboo_grave_2: { buildRole: 'quick-magic', name: 'ร่ายกลางเงา', brief: 'เพิ่ม MATK และความเร็วร่าย แลกช่องอาวุธเพื่อเตรียมเวทได้เร็วขึ้น' },
  sealed_mine_0: { buildRole: 'physical-endurance', name: 'แรงคนงาน', brief: 'เพิ่ม ATK และ HP สูงสุด เหมาะกับการล่ากายภาพที่ต้องอยู่รับการโจมตี' },
  sealed_mine_1: { buildRole: 'accurate-critical', name: 'ตาผลึก', brief: 'เพิ่มโอกาสคริและความแม่นยำ สำหรับอาวุธที่ต้องโจมตีให้โดนก่อนลุ้นคริติคอล' },
  sealed_mine_2: { buildRole: 'dark-defense', name: 'ศิลากันมืด', brief: 'เพิ่ม DEF และต้านทานธาตุมืด ใช้ช่องอาวุธเสริมการป้องกัน' },
  sunken_city_0: { buildRole: 'magic-reserve', name: 'พลังพรายลึก', brief: 'เพิ่ม MATK และ SP สูงสุด สำหรับผู้ใช้เวทที่ต้องเตรียมพลังสำรอง' },
  sunken_city_1: { buildRole: 'water-vanguard', name: 'ศาสตราทหารบาดาล', brief: 'เพิ่ม ATK และต้านทานธาตุน้ำ เหมาะกับแนวหน้าที่ล่าศัตรูธาตุน้ำ' },
  sunken_city_2: { buildRole: 'precise-demon-hunter', name: 'สายตานาค', brief: 'เพิ่มความเสียหายต่อเผ่าอสูรและความแม่นยำ เน้นเลือกเป้าหมายเผ่าอสูร' },
  dusk_fort_0: { buildRole: 'physical-critical', name: 'คมศาสตรายักษ์', brief: 'เพิ่ม ATK และความแรงคริ สำหรับผู้ล่ากายภาพที่เน้นดาเมจคริติคอล' },
  dusk_fort_1: { buildRole: 'magic-cooldown', name: 'อาคมเพลิงต่อเนื่อง', brief: 'เพิ่ม MATK และลดคูลดาวน์สกิล เหมาะกับผู้ใช้เวทที่ต้องร่ายสกิลต่อเนื่อง' },
  dusk_fort_2: { buildRole: 'frontline-endurance', name: 'เกราะเงาทมิฬ', brief: 'เพิ่ม DEF และ HP สูงสุด เลือกความทนทานจากช่องอาวุธแทนโบนัสโจมตี' },
  giant_valley_0: { buildRole: 'physical-spirit-hunter', name: 'ลาดตระเวนข่มผี', brief: 'เพิ่ม ATK และความเสียหายต่อเผ่าผี สำหรับการล่ากายภาพในดงวิญญาณ' },
  giant_valley_1: { buildRole: 'accurate-heavy-critical', name: 'เล็งธนูวิญญาณ', brief: 'เพิ่มความแม่นยำและความแรงคริ เหมาะกับเป้าหมายที่หลบหลีกและการโจมตีคริติคอล' },
  giant_valley_2: { buildRole: 'guarded-physical', name: 'หมัดศิลา', brief: 'เพิ่ม ATK พร้อม DEF เล็กน้อย สำหรับผู้ล่ากายภาพที่ต้องการเกราะร่วมด้วย' },
  himmapan_0: { buildRole: 'casting-reserve', name: 'ผลไม้เก็บอาคม', brief: 'เพิ่ม SP สูงสุดและความเร็วร่าย เน้นพลังสำรองและเวลาร่ายแทน MATK' },
  himmapan_1: { buildRole: 'evasive-critical', name: 'ปีกคมหลบ', brief: 'เพิ่มโอกาสคริและหลบหลีก เหมาะกับผู้ล่าที่เลือกความคล่องตัว' },
  himmapan_2: { buildRole: 'physical-beast-hunter', name: 'เขี้ยวข่มสัตว์', brief: 'เพิ่ม ATK และความเสียหายต่อเผ่าสัตว์ สำหรับวงรอบล่าสัตว์โดยเฉพาะ' },
  fallen_city_0: { buildRole: 'magic-demon-hunter', name: 'อาคมปราบอสูร', brief: 'เพิ่ม MATK และความเสียหายต่อเผ่าอสูร เหมาะกับผู้ใช้เวทที่เลือกเป้าหมายเผ่าอสูร' },
  fallen_city_1: { buildRole: 'guarded-casting', name: 'ยันต์ร่ายมั่น', brief: 'เพิ่มความเร็วร่ายและ DEF เตรียมเวทเร็วขึ้นพร้อมเกราะโดยไม่เพิ่ม MATK' },
  fallen_city_2: { buildRole: 'spirit-endurance', name: 'องครักษ์กันผี', brief: 'เพิ่ม HP สูงสุดและต้านทานเผ่าผี สำหรับยืนรับการโจมตีจากวิญญาณ' },
  demon_rift_0: { buildRole: 'physical-critical', name: 'คมรอยแยก', brief: 'เพิ่ม ATK และโอกาสคริ เน้นการโจมตีกายภาพในช่วงปลายการเดินทาง' },
  demon_rift_1: { buildRole: 'dark-defense', name: 'กำแพงเกราะดำ', brief: 'เพิ่ม DEF และต้านทานธาตุมืด เลือกการป้องกันแทนพลังโจมตีจากช่องอาวุธ' },
  demon_rift_2: { buildRole: 'magic-demon-reserve', name: 'เงาปราบอสูร', brief: 'เพิ่ม MATK, SP สูงสุดและความเสียหายต่อเผ่าอสูร สำหรับผู้ใช้เวทที่เตรียมพลังสำรองเพื่อล่าอสูร' },
};
