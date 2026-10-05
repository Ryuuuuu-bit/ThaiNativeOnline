// ============================================================
//  แผนที่โลก: หมู่บ้าน + 20 แมพล่าผี (แมพละ 1 ชนิด เลเวลไต่ขึ้นเรื่อยๆ) แบ่ง 5 ภาค + ลานพญายักษ์
//  ทุกแมพอยู่บนแกน X เดียวกันแต่แยกขาดจากกัน – ย้ายแมพด้วยประตูวาร์ป (กด F → เลือกปลายทาง)
//  ใช้ร่วมกันทั้ง client และ server
//  Port note (src/rules): positional data of the legacy side-scroller (minX/maxX, gates,
//  respawn/arrive x, HUNT_X0/MAP_W/MAP_STEP, mapAt/gateNear/canTravelFrom, monster `zone`
//  rewrite) and REGIONS music/bg keys were removed. Map ids, names, regions, level ranges
//  and the monster rescaling/region-boss generation are kept unchanged.
// ============================================================
import { MONSTERS, MONSTER_IDS } from './monsters.js';

/** ภาค: ฉากหลัง, เพลง, บรรยากาศ, สีหมอก, สีพื้น, ของตกแต่ง */
export const REGIONS = {
  r1: { id: 'r1', no: 1, nameTh: 'ทุ่งนาบางผี',        fog: 0xf5b041, fogA: 0.05, ground: 0xffffff, decor: 'paddy',  sky: 0xfad7a0 },
  r2: { id: 'r2', no: 2, nameTh: 'บึงบัวหมู่บ้านร้าง',  fog: 0x76d7c4, fogA: 0.1,  ground: 0xa9c4b0, decor: 'swamp',  sky: 0x7fb3a8 },
  r3: { id: 'r3', no: 3, nameTh: 'ป่าดงดิบ',           fog: 0x1e8449, fogA: 0.09, ground: 0x9ccc8c, decor: 'jungle', sky: 0x82c29a },
  r4: { id: 'r4', no: 4, nameTh: 'ป่าช้าวัดร้าง',       fog: 0x5b2c6f, fogA: 0.15, ground: 0xa99bb8, decor: 'grave',  sky: 0x9b7fb3 },
  r5: { id: 'r5', no: 5, nameTh: 'หุบเขาอสุรกาย',       fog: 0x922b21, fogA: 0.15, ground: 0xc49a8a, decor: 'cursed', sky: 0xc0785f },
};

/** ลำดับแมพล่าผี: [ภาค, ผี, ชื่อแมพ] – เลเวลเรียงจากน้อยไปมาก */
const HUNT = [
  ['r1', 'phi_tuay_kaew',   'ทุ่งหุ่นไล่กา'],
  ['r1', 'kuman_thong',     'คันนากุมาร'],
  ['r1', 'krasue',          'เล้าไก่กระสือ'],
  ['r1', 'nang_tani',       'สวนกล้วยตานี'],
  ['r2', 'phi_pob',         'หมู่บ้านร้างผีปอบ'],
  ['r2', 'phi_jang_nang',   'ลานหนังกลางแปลง'],
  ['r2', 'phi_phrai',       'บึงบัวผีพราย'],
  ['r2', 'pret',            'ศาลาเปรตหิวโหย'],
  ['r3', 'saming',          'ดงเสือสมิง'],
  ['r3', 'phi_ha',          'ป่าผีห่า'],
  ['r3', 'krahang',         'ไร่ร้างผีกระหัง'],
  ['r3', 'khamot',          'หนองไฟผีโขมด'],
  ['r4', 'phi_dip',         'ป่าช้าผีดิบ'],
  ['r4', 'nang_takhian',    'ดงตะเคียนทอง'],
  ['r4', 'tai_hong',        'ทางแยกตายโหง'],
  ['r4', 'phi_phong',       'ห้วยผีโพง'],
  ['r5', 'kong_koi',        'ผาผีกองกอย'],
  ['r5', 'phi_lang_kluang', 'ถ้ำหลังกลวง'],
  ['r5', 'phi_chamot',      'ลำธารผีจะมอด'],
  ['r5', 'pret_asura',      'บัลลังก์อสุรกาย'],
];

const village = {
  id: 'village', no: 0, nameTh: 'หมู่บ้านบางผี', region: 'village', safe: true, minLv: 1,
};

// เลเวลผีกระจายจาก Lv.1 (แมพ 1) ถึง Lv.28 (แมพ 20) → เล่นถึงเลเวลตัน 30 ได้ (บอสลาน Lv.30)
// ปรับค่าพลัง/รางวัลตามอัตราส่วนเลเวลใหม่ต่อเลเวลเดิม (ทำครั้งเดียว ใช้ร่วม client/server)
HUNT.forEach(([, mon], i) => {
  const m = MONSTERS[mon];
  if (!m || m._scaled) return;
  const L0 = m.level, L = Math.round(1 + (i * 27) / (HUNT.length - 1)), k = L / L0;
  Object.assign(m, {
    level: L, _scaled: true,
    hp: Math.round(m.hp * k ** 1.35), atk: Math.round(m.atk * k ** 1.15), def: Math.round(m.def * k),
    acc: Math.round(m.acc + (L - L0) * 0.6), exp: Math.round(m.exp * k ** 1.55),
    gold: m.gold.map((g) => Math.round(g * k ** 1.2)),
  });
});

const hunts = HUNT.map(([region, mon, nameTh], i) => {
  const m = MONSTERS[mon];
  return {
    id: `m${i + 1}`, no: i + 1, idx: i, nameTh, region, mon, level: m.level,
    minLv: Math.max(1, m.level - 1),
  };
});

const arena = {
  id: 'arena', no: 21, nameTh: 'ลานพญายักษ์', region: 'r5', boss: true, minLv: 26,
};
/** สุสานใต้ดิน (ดันเจี้ยนปาร์ตี้) – แยกห้องตามปาร์ตี้ (instance) เข้าได้ทางหลวงพ่อทองในหมู่บ้านเท่านั้น */
const dungeon = {
  id: 'dungeon', no: 22, nameTh: 'สุสานใต้ดิน', region: 'r4', dungeon: true, minLv: 5, noTravel: true,
};

export const ARCHIVED_MAP_LIST = [village, ...hunts, arena, dungeon];
// The playable project starts in Ayutthaya. Keep legacy definitions addressable
// for economy/data migrations, but do not expose or simulate their world maps.
export const CLASSIC_WORLD_ENABLED = false;
export const MAP_LIST = CLASSIC_WORLD_ENABLED ? ARCHIVED_MAP_LIST : [village];
export const MAPS = Object.fromEntries(ARCHIVED_MAP_LIST.map((m) => [m.id, m]));
export const HUNT_MAPS = hunts;

// ผีแต่ละชนิดอยู่แมพเดียว: ตัวละ 5 (อสุรกาย 2)  (port: the legacy x spawn range `zone` is no longer rewritten)
for (const h of hunts) {
  const m = MONSTERS[h.mon];
  m.count = h.mon === 'pret_asura' ? 2 : 5;
  m.mapId = h.id;
  if (m.nightOnly) { m.nightOnly = false; m.nightBoost = true; }   // แมพเดี่ยว: มีทั้งวัน แต่กลางคืนดุขึ้น
}

// ============================================================
//  บอสประจำภาค (เจ้าถิ่น): แมพสุดท้ายของแต่ละภาค · 1 ตัว · เกิดใหม่ทุก 20 นาที (server คุม)
//  ใช้ภาพผีประจำแมพนั้นขยายใหญ่ · ต่อท้าย MONSTER_IDS (ลำดับ gi ของผีเดิมไม่เลื่อน)
// ============================================================
const RB_INFO = {
  r1: { nameTh: 'นางพญาตานีทอง', hp: 25, tint: 0xf7dc6f },
  r2: { nameTh: 'เปรตราชาหิวโหย', hp: 25, tint: 0xbb8fce },
  r3: { nameTh: 'พญาโขมดไฟ', hp: 25, tint: 0xff7043 },
  r4: { nameTh: 'ผีโพงเจ้าห้วย', hp: 25, tint: 0x76d7c4 },
  r5: { nameTh: 'ท้าวอสุรกายทมิฬ', hp: 12, tint: 0xe74c3c },
};
export const REGION_BOSS_IDS = [];
for (const R of Object.values(REGIONS)) {
  const h = [...hunts].reverse().find((m) => m.region === R.id), b = MONSTERS[h.mon], I = RB_INFO[R.id];
  const id = `rb_${R.id}`;
  if (!MONSTERS[id]) {
    MONSTERS[id] = {
      ...b, nameTh: `👑 ${I.nameTh}`, nameEn: `Region Boss ${R.no}`, desc: `เจ้าถิ่นแห่ง${R.nameTh}`, art: h.mon, regionBoss: true, region: R.id, scale: 1.8, tint: I.tint,
      level: b.level + 3, hp: Math.round(b.hp * I.hp), atk: Math.round(b.atk * 1.7), def: Math.round(b.def * 1.4 + 3), acc: b.acc + 8, eva: Math.round(b.eva * 0.6),
      exp: Math.round(b.exp * 30), gold: b.gold.map((g) => Math.round(g * 25)), count: 1, mapId: h.id,
      respawnMs: 20 * 60 * 1000, attackRange: Math.round(b.attackRange * 1.6), attackCooldown: Math.max(1600, Math.round(b.attackCooldown * 1.3)),
      speed: Math.round(b.speed * 0.8), drops: (b.drops || []).map((d) => ({ ...d, chance: 1 })), nightBoost: false, nightOnly: false,
    };
    MONSTER_IDS.push(id);
  }
  REGION_BOSS_IDS.push(id);
  h.rboss = id;
}

/** ภาค 4–5 (ป่าช้าวัดร้าง → หุบเขาอสุรกาย) เริ่มที่แมพล่าที่ 13 */
export const GRAVE_MAP_NO = 13;
/** ผีจากแมพล่าภาค 4–5 (รวมบอสภาค) — นับเป็น "ผีป่าช้า" ของเควส kill:'grave'.
 *  Port note: replaces the legacy `MONSTERS[id].zone[0] >= WORLD.graveX` x-position test; same set of monsters. */
export function isGraveMon(id) {
  const m = MAPS[MONSTERS[id]?.mapId];
  return !!m && m.no >= GRAVE_MAP_NO;
}

export const regionOf = (map) => REGIONS[map.region] || null;
