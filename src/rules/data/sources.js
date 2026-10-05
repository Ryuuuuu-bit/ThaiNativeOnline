// ============================================================
//  แหล่งที่มาของไอเทม ("ได้จากที่ไหน") — ใช้ในกล่องรายละเอียดตอนชี้ไอเทม
//  รวมจาก: ผีดรอป (ของ/การ์ด/อุปกรณ์สุ่มตามเลเวล) · ร้าน NPC · ทำอาหาร/ปรุงยา/หลอม · ตกปลา · เก็บสมุนไพร · รางวัลเควส
//  สร้างดัชนีครั้งเดียวเมื่อเรียกครั้งแรก (lazy) แล้วจำไว้
// ============================================================
import { ITEMS, SHOPS, baseItemId } from './items.js';
import { MONSTERS } from './monsters.js';
import { CARD_BY_ID, CARD_DROP } from './cards.js';
import { GEAR } from './gear.js';
import { FISH, FISH_BY_MAP, RECIPES, BREWS, QUESTS, questGiver, GIVER_TH } from './village.js';
import { FORGE } from './crafting.js';

// ------------------------------------------------------------
//  Port note (src/rules): the original derived "where" texts from the 2D tile maps
//  (shared/td/maps.js spawns + zones, shared/td/ayutthaya.js HERB_SPOTS). Those maps are not
//  ported. The tables below are a snapshot of what the original computed (only the Ayutthaya map
//  was active), so itemSources() output is unchanged. A 3D world can replace them with
//  setSourceWorld({ monWhere, herbWhere, fishMaps }) — keys left out keep the snapshot.
// ------------------------------------------------------------
const LEGACY_MON_WHERE = {"phi_tuay_kaew":"กรุงศรีอยุธยา · ทุ่งนาบางปะอิน","kuman_thong":"กรุงศรีอยุธยา · ทุ่งนาบางปะอิน","nang_tani":"กรุงศรีอยุธยา · ทุ่งนาบางปะอิน","krasue":"กรุงศรีอยุธยา · ทุ่งนาบางปะอิน","mae_nak":"กรุงศรีอยุธยา · ทุ่งนาบางปะอิน","phi_pob":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","phi_jang_nang":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","pret":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","saming":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","kong_koi":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","pu_som":"กรุงศรีอยุธยา · ป่าไผ่ปู่โสม","phi_ha":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","phi_dip":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","tai_hong":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","phi_lang_kluang":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","phi_phong":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","pret_asura":"กรุงศรีอยุธยา · ป่าช้าวัดร้าง","khamot":"กรุงศรีอยุธยา · บึงผีพราย","nang_takhian":"กรุงศรีอยุธยา · บึงผีพราย","phi_phrai":"กรุงศรีอยุธยา · บึงผีพราย","phi_chamot":"กรุงศรีอยุธยา · บึงผีพราย","krahang":"กรุงศรีอยุธยา · บึงผีพราย","chalawan":"กรุงศรีอยุธยา · บึงผีพราย"};
const LEGACY_HERB_WHERE = {"rice_sheaf":["ทุ่งนาบางปะอิน"],"herb_aloe":["ทุ่งนาบางปะอิน"],"herb_lemongrass":["ทุ่งนาบางปะอิน"],"herb_bamboo":["ป่าไผ่ปู่โสม"],"herb_honey":["ป่าไผ่ปู่โสม"],"herb_mushroom":["ป่าไผ่ปู่โสม","ป่าช้าวัดร้าง"],"herb_turmeric":["ทุ่งนาบางปะอิน"],"herb_anchan":["บึงผีพราย"]};
/** แดนที่เปิดอยู่ (ตกปลาได้) → ชื่อ */
const LEGACY_FISH_MAPS = { ayutthaya: 'กรุงศรีอยุธยา' };
let WORLD_SRC = { monWhere: LEGACY_MON_WHERE, herbWhere: LEGACY_HERB_WHERE, fishMaps: LEGACY_FISH_MAPS };
/** แทนข้อมูลตำแหน่ง: monWhere { monId: 'แมพ · โซน' } · herbWhere { itemId: ['โซน', ...] } · fishMaps { mapId: 'ชื่อแดน' } */
export function setSourceWorld(w = {}) {
  WORLD_SRC = { ...WORLD_SRC, ...w };
  IDX = null; WHERE = null;
}

const pctTxt = (p) => (p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.01 ? `${+(p * 100).toFixed(1)}%` : `${+(p * 100).toFixed(2)}%`);
let IDX = null, WHERE = null;

/** ผีแต่ละชนิดอยู่แมพ/โซนไหน → 'กรุงศรีอยุธยา · ทุ่งนาบางปะอิน' */
function monWhere() {
  if (WHERE) return WHERE;
  WHERE = { ...WORLD_SRC.monWhere };
  return WHERE;
}

function build() {
  const idx = {}, add = (id, src) => (idx[id] ||= []).push(src);
  const W = monWhere();
  const monTxt = (k, m) => `${m.nameTh} Lv.${m.level}${m.boss ? ' (บอส)' : m.elite ? ' (หัวหน้า)' : ''}${m.nightOnly ? ' 🌙' : ''}`;
  // 1) ผีดรอป (เฉพาะผีที่มีจุดเกิดในโลกจริง)
  for (const [k, m] of Object.entries(MONSTERS)) {
    if (!W[k]) continue;
    for (const dr of m.drops || []) add(dr.item, { kind: 'mon', sort: -dr.chance, ic: m.boss ? '👑' : '👻', text: `${monTxt(k, m)} · ${pctTxt(dr.chance)}`, sub: W[k] });
  }
  // 2) การ์ดผี
  for (const [cid, c] of Object.entries(CARD_BY_ID)) {
    const m = MONSTERS[c.mon]; if (!m || !W[c.mon]) continue;
    if (m.worldBoss) { add(cid, { kind: 'mon', sort: -0.25, ic: '🃏', text: `${monTxt(c.mon, m)} · รางวัลตามอันดับดาเมจ 5–25% (ขั้น 4–5)`, sub: W[c.mon] }); continue; }   // บอสโลก: ไม่ใช่ดรอปต่อตัว
    const p = m.boss ? CARD_DROP.boss : m.elite ? CARD_DROP.elite : CARD_DROP.normal;
    add(cid, { kind: 'mon', sort: -p, ic: '🃏', text: `${monTxt(c.mon, m)} · ${pctTxt(p)}`, sub: W[c.mon] });
  }
  // 3) ร้าน NPC
  for (const [sid, s] of Object.entries(SHOPS)) for (const id of s.stock || []) add(id, { kind: 'shop', sort: -1, ic: '🛒', text: `${s.nameTh.split(' ')[0]} · ฿${(ITEMS[id]?.price || 0).toLocaleString()}`, sub: s.nameTh.split(' ').slice(1).join(' ') || '', shop: sid });
  // 4) ทำเอง: อาหาร (ป้าสา) · ยา (ยายติ๋ม) · หลอม (ลุงดำ)
  const need = (n) => Object.entries(n).map(([k, q]) => `${ITEMS[k]?.nameTh || k}×${q}`).join(' + ');
  for (const r of RECIPES) add(r.out, { kind: 'craft', ic: '🍳', text: `ทำอาหารที่ป้าสา`, sub: need(r.need) });
  for (const r of BREWS) add(r.out, { kind: 'craft', ic: '🌿', text: `ปรุงยาที่ยายติ๋ม`, sub: need(r.need) });
  for (const r of FORGE) add(r.out, { kind: 'craft', ic: '⚒️', text: `สร้างที่ลุงดำ · ฿${r.fee.toLocaleString()}`, sub: need(r.need) });
  // 5) ตกปลา / เก็บสมุนไพร
  for (const [mapId, list] of Object.entries(FISH_BY_MAP)) {                  // ปลาประจำแดน: บอกแดนที่ตกได้
    if (!WORLD_SRC.fishMaps[mapId]) continue;
    const fw = list.reduce((a, f) => a + f.w, 0), where = `ริมน้ำ${WORLD_SRC.fishMaps[mapId] || mapId}`;
    for (const f of list) if (f.id !== 'junk_boot' || mapId === 'ayutthaya') add(f.id, { kind: 'life', ic: '🎣', text: `ตกปลา${f.night ? 'ตอนกลางคืน' : ''}${f.legend ? ' · ✦ ปลาตำนาน' : ''} · ~${pctTxt(f.w / fw)}`, sub: where });
  }
  for (const [id, zs] of Object.entries(WORLD_SRC.herbWhere)) add(id, { kind: 'life', ic: '🌾', text: 'เก็บสมุนไพร (กด F ข้างต้น)', sub: [...zs].join(' · ') });
  // 6) รางวัลเควส
  for (const q of QUESTS) for (const it of q.reward?.items || []) add(it.id, { kind: 'quest', ic: '📜', text: `เควส "${q.nameTh}" ×${it.qty}`, sub: `${GIVER_TH[questGiver(q)] || ''}${q.lv ? ` · Lv.${q.lv}+` : ''}` });
  return idx;
}

/** อุปกรณ์ที่สุ่มดรอปจากผีตามเลเวล (gear.js rollGearDrop: ผีเลเวล L ดรอปของ lv ∈ [L−4, L+2]) */
function gearDrop(id) {
  const g = GEAR[id]; if (!g || g.legend || g.red || !g.lv) return [];
  const lo = Math.max(1, g.lv - 2), hi = g.lv + 4, W = monWhere();
  const mons = Object.entries(MONSTERS).filter(([k, m]) => W[k] && !m.boss && !m.nightOnly && m.level >= lo && m.level <= hi).sort((a, b) => a[1].level - b[1].level);
  if (!mons.length) return [];
  const names = mons.slice(0, 3).map(([, m]) => `${m.nameTh} Lv.${m.level}`).join(', ') + (mons.length > 3 ? ` +${mons.length - 3} ชนิด` : '');
  const maps = [...new Set(mons.map(([k]) => W[k].split(' · ')[0]))].join(' · ');
  return [{ kind: 'mon', sort: 0, ic: '🎲', text: `สุ่มจากผี Lv.${lo}–${hi} (~2% ต่อตัว)`, sub: `${names} · ${maps}` }];
}

/** แหล่งที่มาทั้งหมดของไอเทม → [{ ic, text, sub, kind }] (เรียงตามโอกาส/ความง่าย) */
export function itemSources(id) {
  IDX ||= build();
  const base = baseItemId(id);
  const list = [...(IDX[base] || []), ...gearDrop(base)];
  const K = { shop: 0, mon: 1, craft: 2, life: 3, quest: 4 };
  return list.sort((a, b) => K[a.kind] - K[b.kind] || (a.sort || 0) - (b.sort || 0));
}
