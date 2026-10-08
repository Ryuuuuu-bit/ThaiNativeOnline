// Content data only: edit freely without touching game logic.
import { CARD_ITEMS } from './cards.js';
// twoHand: visual description only; all weapons share one equipment slot
// weapon: the kind of weapon (sword · bow · wrap · dagger · talisman · book) — a class wields only its
//   kinds (src/character/data/classes.js WEAPON_KINDS); other weapons stay in the bag
// slot: weapon | armor | head | cape | shoes | charm (two charm slots: charm, charm2); slots: card slots (RO style, 0–4: plain gear has more, strong gear fewer); use: consumable effect
// bonus keys: base stats (str agi vit int dex luk) and atk matk def hp mp crit critDmg acc eva,
//   cdr (skill cooldowns shorter), cast (cast times shorter), mpCost (skills cost more MP) — shares
// Abstract carry units, not kilograms: recovery supplies 0, materials 0.1,
// equipment 1–50 by size/material. See docs/design/ITEM_WEIGHTS.md.
export const ITEMS = {
  potion_s: { name: 'ยาหม้อเล็ก', icon: '⚱', img: 'ui/items/icon_potion_s.png', weight: 0, type: 'use', use: { hp: 60 }, price: 10, desc: 'ฟื้นฟู HP 60' },
  potion_m: { name: 'ยาหม้อใหญ่', icon: '⚱', img: 'ui/items/icon_potion_m.png', weight: 0, type: 'use', use: { hp: 160 }, price: 30, desc: 'ฟื้นฟู HP 160' },
  ether:    { name: 'น้ำผึ้งป่า', icon: '❂', img: 'ui/items/icon_ether.png', weight: 0, type: 'use', use: { mp: 50 }, price: 14, desc: 'ฟื้นฟู MP 50' },
  hide:     { name: 'หนังสัตว์', icon: '▤', img: 'ui/items/icon_hide.png', weight: 0.1, type: 'material', price: 4, desc: 'วัตถุดิบ ขายได้' },
  tusk:     { name: 'เขี้ยวหมูป่า', icon: '⟆', img: 'ui/items/icon_tusk.png', weight: 0.1, type: 'material', price: 7, desc: 'วัตถุดิบ ขายได้' },
  // ores for ตีบวก (src/character/data/refine.js), sold at โรงหลอมศาสตรา
  sacred_ore: { name: 'แร่ศักดิ์สิทธิ์', icon: '◆', img: 'ui/items/icon_sacred_ore.png', weight: 0.1, type: 'material', price: 60, desc: 'ใช้ตีบวกอาวุธ ครั้งละ 1 ก้อน' },
  gold_leaf:  { name: 'ทองคำเปลว', icon: '◇', img: 'ui/items/icon_gold_leaf.png', weight: 0.1, type: 'material', price: 50, desc: 'ใช้ตีบวกเกราะ หมวก โล่ ผ้าคลุม รองเท้า ครั้งละ 1 แผ่น' },
  ash:      { name: 'ขี้เถ้าธูป', icon: '∴', img: 'ui/items/icon_ash.png', weight: 0.1, type: 'material', price: 9, desc: 'วัตถุดิบเวทมนตร์' },
  hand_wrap:  { name: 'ผ้าพันมือมงคล', icon: '🥊', img: 'ui/items/icon_hand_wrap.png', weapon: 'wrap', weight: 3, type: 'equip', slot: 'weapon', slots: 3, bonus: { atk: 3 }, rarity: 'common', price: 15 },
  krabi:      { name: 'มีดสั้นคู่', icon: '🔪', img: 'ui/items/icon_krabi.png', weapon: 'dagger', weight: 20, type: 'equip', slot: 'weapon', twoHand: true, slots: 3, bonus: { atk: 3 }, rarity: 'common', price: 15 },
  tiger_wrap: { name: 'ผ้าพันมือลายเสือ', icon: '🥊', img: 'ui/items/icon_tiger_wrap.png', weapon: 'wrap', weight: 3, type: 'equip', slot: 'weapon', slots: 2, bonus: { atk: 7, str: 1, agi: 1 }, rarity: 'rare', price: 75, desc: 'ผ้าพันมือย้อมลายเสือสมิง หมัดหนักขึ้น' },
  bone_dagger: { name: 'มีดคู่กระดูก', icon: '🔪', img: 'ui/items/icon_bone_dagger.png', weapon: 'dagger', weight: 15, type: 'equip', slot: 'weapon', twoHand: true, slots: 2, bonus: { atk: 7, agi: 2 }, rarity: 'rare', price: 75, desc: 'มีดคู่เหลาจากกระดูกผี เบาและคม' },
  herb_staff: { name: 'ไม้เท้าสมุนไพร', icon: '🌿', img: 'ui/items/icon_herb_staff.png', retired: true, weight: 15, type: 'equip', slot: 'weapon', slots: 3, bonus: { matk: 4, int: 1 }, rarity: 'common', price: 15 },
  mongkol:    { name: 'มงคลครูมวย', icon: '◯', img: 'ui/items/icon_mongkol.png', weight: 1, type: 'equip', slot: 'charm', slots: 1, bonus: { atk: 5, str: 2, agi: 2, luk: 1 }, rarity: 'rare', price: 70 },
  wood_sword: { name: 'ดาบไม้ซ้อม', icon: '🗡', img: 'ui/items/icon_wood_sword.png', weapon: 'sword', weight: 20, type: 'equip', slot: 'weapon', slots: 3, bonus: { atk: 3 }, rarity: 'common', price: 15 },
  iron_dap:   { name: 'ดาบเหล็กลาย', icon: '🗡', img: 'ui/items/icon_iron_dap.png', weapon: 'sword', weight: 40, type: 'equip', slot: 'weapon', slots: 2, bonus: { atk: 9, str: 2 }, rarity: 'rare', price: 80 },
  short_bow:  { name: 'ธนูไม้ซ้อม', icon: '🏹', img: 'ui/items/icon_short_bow.png', weapon: 'bow', weight: 15, type: 'equip', slot: 'weapon', twoHand: true, slots: 3, bonus: { atk: 3, dex: 1 }, rarity: 'common', price: 15, desc: 'ธนูฝึกหัดของนายพรานใหม่' },
  // Keep the saved item ID so existing shamans receive the talisman without losing gear or upgrades.
  reed_wand:  { name: 'ยันต์ฝึกอาคม', icon: '▤', img: 'ui/items/icon_pha_yant.png', weapon: 'talisman', weight: 8, type: 'equip', slot: 'weapon', slots: 3, bonus: { matk: 4, int: 1 }, rarity: 'common', price: 15, desc: 'ยันต์ประจำกายหมอผีฝึกหัด ใช้มือร่ายอาคม ไม่ใช้แล้วหมดไป' },
  // หมอยา reads: the books (ตำรา) are the herbalist's weapons; หมอผี carries talismans (ยันต์)
  herb_book:  { name: 'ตำรายาสมุนไพร', icon: '📗', img: 'ui/items/icon_herb_book.png', weapon: 'book', weight: 6, type: 'equip', slot: 'weapon', slots: 3, bonus: { matk: 4, int: 1 }, rarity: 'common', price: 15, desc: 'ตำรายาเล่มแรกของหมอยาทุกคน อ่านแล้วยาแรงขึ้น' },
  palm_book:  { name: 'ตำราใบลาน', icon: '📜', img: 'ui/items/icon_palm_book.png', weapon: 'book', weight: 8, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 9, int: 3 }, rarity: 'rare', price: 75, desc: 'ใบลานจารตำรับยาโบราณ ผูกด้วยด้ายแดง' },
  bone_yant:  { name: 'ผ้ายันต์กระดูกผี', icon: '▤', img: 'ui/items/icon_bone_yant.png', weapon: 'talisman', weight: 6, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 9, int: 3 }, rarity: 'rare', price: 75, desc: 'ยันต์ลงอักขระด้วยเถ้ากระดูกผี อาคมแรงกว่ายันต์ฝึก' },
  bamboo_bow: { name: 'ธนูไม้ไผ่', icon: '🏹', img: 'ui/items/icon_bamboo_bow.png', weapon: 'bow', weight: 20, type: 'equip', slot: 'weapon', twoHand: true, slots: 2, bonus: { atk: 7, dex: 2 }, rarity: 'rare', price: 75 },
  bone_wand:  { name: 'ไม้เท้ากระดูก', icon: '⚚', img: 'ui/items/icon_bone_wand.png', retired: true, weight: 15, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 9, int: 3 }, rarity: 'rare', price: 75 },
  cloth_vest: { name: 'เสื้อผ้าฝ้าย', icon: '👕', img: 'ui/items/icon_cloth_vest.png', weight: 10, type: 'equip', slot: 'armor', slots: 1, bonus: { def: 3 }, rarity: 'common', price: 15 },
  hide_armor: { name: 'เกราะหนังสัตว์', icon: '🥋', img: 'ui/items/icon_hide_armor.png', weight: 35, type: 'equip', slot: 'armor', slots: 1, bonus: { def: 8, vit: 2 }, rarity: 'rare', price: 70 },
  takrut:     { name: 'ตะกรุดโทน', icon: '⌬', img: 'ui/items/icon_takrut.png', weight: 1, type: 'equip', slot: 'charm', slots: 1, bonus: { def: 2, int: 2, hp: 20, matk: 3, cdr: .05 }, rarity: 'rare', price: 60 },
  tiger_fang: { name: 'เขี้ยวเสือสมิง', icon: '☾', img: 'ui/items/icon_tiger_fang.png', weight: 1, type: 'equip', slot: 'charm', slots: 0, bonus: { atk: 6, str: 3, agi: 3, luk: 3, crit: .08 }, rarity: 'epic', price: 300 },
  // ---- head · off hand · cape · shoes ----
  pha_khao:   { name: 'ผ้าโพกหัว', icon: '◠', img: 'ui/items/icon_pha_khao.png', weight: 2, type: 'equip', slot: 'head', slots: 1, bonus: { def: 1, vit: 1 }, rarity: 'common', price: 20 },
  ngob:       { name: 'งอบใบลาน', icon: '◭', img: 'ui/items/icon_ngob.png', weight: 3, type: 'equip', slot: 'head', slots: 1, bonus: { def: 2 }, rarity: 'common', price: 30 },
  chada:      { name: 'ชฎาทองเหลือง', icon: '♔', img: 'ui/items/icon_chada.png', weight: 8, type: 'equip', slot: 'head', slots: 1, bonus: { def: 3, int: 2, matk: 3 }, rarity: 'rare', price: 150 },
  rattan_shield: { name: 'โล่หวาย', icon: '◍', img: 'ui/items/icon_rattan_shield.png', refinable: true, weight: 15, retired: true, type: 'equip', slot: 'charm', slots: 1, bonus: { def: 3 }, rarity: 'common', price: 25 },
  mo_knife:   { name: 'มีดหมอ', icon: '🗡', img: 'ui/items/icon_mo_knife.png', weight: 8, retired: true, type: 'equip', slot: 'weapon', slots: 1, bonus: { atk: 3, agi: 1 }, rarity: 'common', price: 40 },
  buffalo_shield: { name: 'โล่หนังควาย', icon: '◍', img: 'ui/items/icon_buffalo_shield.png', refinable: true, weight: 30, retired: true, type: 'equip', slot: 'charm', slots: 1, bonus: { def: 6, vit: 2 }, rarity: 'rare', price: 120 },
  pakhaoma:   { name: 'ผ้าขาวม้า', icon: '▦', img: 'ui/items/icon_pakhaoma.png', weight: 2, type: 'equip', slot: 'cape', slots: 1, bonus: { def: 1, eva: 2 }, rarity: 'common', price: 20 },
  sabai:      { name: 'สไบไหม', icon: '≋', img: 'ui/items/icon_sabai.png', weight: 2, type: 'equip', slot: 'cape', slots: 1, bonus: { def: 2, int: 1, mp: 20 }, rarity: 'rare', price: 90 },
  sandals:    { name: 'รองเท้าแตะหนัง', icon: '⏢', img: 'ui/items/icon_sandals.png', weight: 4, type: 'equip', slot: 'shoes', slots: 1, bonus: { def: 1, agi: 1 }, rarity: 'common', price: 20 },
  hide_boots: { name: 'รองเท้าหนังสัตว์', icon: '⏢', img: 'ui/items/icon_hide_boots.png', weight: 8, type: 'equip', slot: 'shoes', slots: 1, bonus: { def: 3, agi: 2 }, rarity: 'rare', price: 80 },
  // ---- คลองหนองบึง tier (Lv 10-25): the marsh boat sells the plain ones, the rest drop ----
  croc_scale: { name: 'เกล็ดจระเข้', icon: '◇', img: 'ui/items/icon_croc_scale.png', weight: 0.1, type: 'material', price: 25, desc: 'เกล็ดแข็งจากจระเข้บึง ขายได้ราคาดี' },
  kris:       { name: 'กริชคดน้ำ', icon: '🗡', img: 'ui/items/icon_kris.png', weapon: 'sword', weight: 15, type: 'equip', slot: 'weapon', slots: 2, bonus: { atk: 16, dex: 2 }, rarity: 'rare', price: 260 },
  mangrove_staff: { name: 'ไม้เท้ารากโกงกาง', icon: '⚚', img: 'ui/items/icon_mangrove_staff.png', retired: true, weight: 20, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 18, int: 4 }, rarity: 'rare', price: 260 },
  horn_bow:   { name: 'ธนูเขาควายบึง', icon: '🏹', img: 'ui/items/icon_horn_bow.png', weapon: 'bow', weight: 25, type: 'equip', slot: 'weapon', twoHand: true, slots: 2, bonus: { atk: 15, dex: 4 }, rarity: 'rare', price: 260 },
  bog_book:   { name: 'ตำรายาชาวบึง', icon: '📘', img: 'ui/items/icon_bog_book.png', weapon: 'book', weight: 10, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 18, int: 4 }, rarity: 'rare', price: 260, desc: 'ตำราปกเกล็ดจระเข้ของหมอยาชาวบึง สูตรยาจากพืชน้ำ' },
  bog_yant:   { name: 'ผ้ายันต์โกงกาง', icon: '▤', img: 'ui/items/icon_bog_yant.png', weapon: 'talisman', weight: 8, type: 'equip', slot: 'weapon', slots: 2, bonus: { matk: 18, int: 4 }, rarity: 'rare', price: 260, desc: 'ยันต์ย้อมน้ำครำโกงกาง ผีน้ำเกรงกลัว' },
  croc_wrap:  { name: 'ผ้าพันมือหนังจระเข้', icon: '🥊', img: 'ui/items/icon_croc_wrap.png', weapon: 'wrap', weight: 5, type: 'equip', slot: 'weapon', slots: 2, bonus: { atk: 14, str: 2, agi: 2 }, rarity: 'rare', price: 260, desc: 'หนังจระเข้บึงพันมือ ตีแล้วหนังผีถลอก' },
  croc_dagger: { name: 'มีดคู่เขี้ยวจระเข้', icon: '🔪', img: 'ui/items/icon_croc_dagger.png', weapon: 'dagger', weight: 20, type: 'equip', slot: 'weapon', twoHand: true, slots: 2, bonus: { atk: 15, agi: 4 }, rarity: 'rare', price: 260, desc: 'มีดคู่ทำจากเขี้ยวจระเข้บึง โค้งคมทั้งสองเล่ม' },
  croc_armor: { name: 'เกราะเกล็ดจระเข้', icon: '🥋', img: 'ui/items/icon_croc_armor.png', weight: 50, type: 'equip', slot: 'armor', slots: 1, bonus: { def: 16, vit: 3 }, rarity: 'rare', price: 300 },
  croc_boots: { name: 'รองเท้าหนังจระเข้', icon: '⏢', img: 'ui/items/icon_croc_boots.png', weight: 10, type: 'equip', slot: 'shoes', slots: 1, bonus: { def: 5, agi: 3 }, rarity: 'rare', price: 160 },
  chalawan_fang: { name: 'เขี้ยวชาละวัน', icon: '☾', img: 'ui/items/icon_chalawan_fang.png', weight: 1, type: 'equip', slot: 'charm', slots: 0, bonus: { atk: 10, str: 4, vs_beast: .1 }, rarity: 'epic', price: 900 },
  // ---- casting gear: cast speed and cooldowns (src/character/Character.js castSpeed / cooldownCut) ----
  bia_kae:    { name: 'เบี้ยแก้', icon: '◉', img: 'ui/items/icon_bia_kae.png', weight: 1, type: 'equip', slot: 'charm', slots: 1, bonus: { def: 1, cast: .1 }, rarity: 'rare', price: 90 },
  pha_yant:   { name: 'ผ้ายันต์ห้าแถว', icon: '▤', img: 'ui/items/icon_pha_yant.png', weight: 2, type: 'equip', slot: 'cape', slots: 1, bonus: { int: 2, cdr: .08, mpCost: .1 }, rarity: 'rare', price: 140 },
  prakam:     { name: 'ลูกประคำไม้กฤษณา', icon: '◌', img: 'ui/items/icon_prakam.png', weight: 2, type: 'equip', slot: 'charm', slots: 1, bonus: { int: 3, mp: 30, cast: .15, cdr: .05 }, rarity: 'epic', price: 400 },
  // monster cards (type 'card'): src/character/data/cards.js
  ...CARD_ITEMS,
};

// img: framed pixel art (public/ui/items, tools/icons/); icon is the fallback glyph.
export const RARITY_COLORS = { common: '#d9d3bd', rare: '#7fb7e8', epic: '#c79af0' };


// What a character wears: one item per slot; a charm fits either charm slot.
export const EQUIP_SLOTS = ['weapon', 'armor', 'head', 'cape', 'shoes', 'charm', 'charm2'];
export const slotKind = slot => (slot === 'charm2' ? 'charm' : slot);
