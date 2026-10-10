import { EXPEDITIONS } from '../world/expeditions.js';
import { expeditionGearIds } from '../character/data/expedition-gear.js';
import { NORMAL_FLASK_IDS } from '../character/data/flask-items.js';
import { EXTENDED_GEAR } from '../character/data/extended-gear.js';
// Shop and training services. NPCs reference these by `shopType` or `trainer`.
// `stock` lists item ids from src/character/data/items.js the shop sells at their price;
// every shop with stock also buys anything from the bag at half price (sell tab),
// so loot (hide, tusk, ash) sells at any of them.
// Shops without stock (and trainers) still show their future services.
export const SHOPS = {
  // ลุงดำ is the single equipment counter; legacy weapons/armor stock is merged below.
  blacksmith: { title: 'โรงตีเหล็กลุงดำ', purpose: 'equipment', stock: ['wood_sword', 'iron_dap', 'krabi', 'bamboo_bow', 'hide_armor', 'hide_boots'], services: ['ซื้อ-ขายอาวุธและเกราะ', 'ตีอาวุธ', 'ซ่อมอาวุธ', 'สร้างอุปกรณ์'], preview: ['ดาบเหล็กกล้า', 'หอกทหาร', 'มีดเหน็บ', 'เกราะหนังควาย'] },
  // หมื่นเพชรศาสตรา refines gear (ตีบวก, src/character/data/refine.js) and sells the ores for it.
  enhance: { title: 'โรงหลอมศาสตรา', purpose: 'upgrade', stock: ['sacred_ore', 'gold_leaf'], services: ['ตีบวกอุปกรณ์', 'หลอมขัดเกลา (Refine)', 'อัปเกรดด้วยวัตถุดิบพิเศษ'], preview: ['แร่ศักดิ์สิทธิ์', 'ทองคำเปลว', 'น้ำมนต์หลอม'] },
  general: { title: 'ร้านของชำ', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether'], services: ['ซื้อ-ขายของทั่วไป'], preview: ['ยาสามัญ', 'ข้าวห่อใบตอง', 'คบไฟ', 'เชือก', 'เครื่องมือพื้นฐาน'] },
  // Last stop before the warp at the North Gate: potions and honey, buys loot back from returning hunters.
  supplies: { title: 'ร้านเสบียงหน้าประตูเหนือ', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether'], services: ['ยาและน้ำผึ้งก่อนออกล่า', 'รับซื้อของป่า'], preview: ['ข้าวห่อใบตอง', 'คบไฟ', 'เชือก'] },
  // The farmers' village outside the wall: the only shop on the fields, so hunters can restock and sell without warping back.
  village: { title: 'ร้านชำหมู่บ้านชาวนา', purpose: 'trade', stock: ['potion_s', 'ether'], services: ['ยาสามัญ', 'รับซื้อหนัง เขี้ยว และขี้เถ้าธูป'], preview: ['ข้าวเหนียวห่อใบตอง', 'น้ำต้น'] },
  herbalist: { title: 'ร้านหมอยา', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether', 'herb_book', 'palm_book'], services: ['ยารักษา', 'ยาแก้พิษ', 'ปรุงยาสมุนไพร'], preview: ['ยาหอม', 'ยาเขียว', 'ยาแก้พิษงู', 'ขมิ้นชัน'] },
  occult: { title: 'ร้านหมออาคม', purpose: 'skills', stock: ['takrut', 'reed_wand', 'bone_yant', 'ether', 'sabai', 'bia_kae', 'pha_yant'], services: ['เครื่องราง', 'ผ้ายันต์ · ตะกรุด', 'วัตถุดิบอาคม', 'ของประกอบวิชา'], preview: ['ตะกรุดโทน', 'ผ้ายันต์แดง', 'เทียนขี้ผึ้ง', 'ใบลานจารอักขระ'] },
  // แม่บัวผัน's boat in คลองหนองบึง: potions, honey and marsh-tier gear for hunters past Lv 10.
  marsh: { title: 'เรือแม่ค้าคลองหนองบึง', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether', 'kris', 'horn_bow', 'croc_wrap', 'croc_dagger', 'bog_book', 'bog_yant', 'croc_boots'], services: ['ยาและน้ำผึ้งป่า', 'อาวุธชาวบึง', 'รับซื้อของจากหนอง'], preview: ['ปลาย่าง', 'ข้าวห่อใบบัว'] },
  weapons: { title: 'แผงอาวุธ', purpose: 'equipment', stock: ['wood_sword', 'short_bow', 'krabi', 'hand_wrap', 'reed_wand', 'herb_book', 'iron_dap', 'bamboo_bow', 'tiger_wrap', 'bone_dagger'], services: ['ซื้อ-ขายอาวุธ'], preview: ['ดาบสั้น', 'ง้าว', 'มีดพร้า'] },
  armor: { title: 'แผงเกราะ', purpose: 'equipment', stock: ['cloth_vest', 'hide_armor', 'pha_khao', 'ngob', 'pakhaoma', 'sandals'], services: ['ซื้อ-ขายเกราะ'], preview: ['เสื้อเกราะหนัง', 'หมวกลอมพอก', 'ผ้าคลุม'] },
  fruit: { title: 'แผงผลไม้', purpose: 'trade', services: ['วัตถุดิบทำอาหาร'], preview: ['มะม่วง', 'กล้วยน้ำว้า', 'มะพร้าว'] },
  rice: { title: 'แผงข้าวสาร', purpose: 'trade', services: ['วัตถุดิบทำอาหาร'], preview: ['ข้าวเปลือก', 'ข้าวสาร', 'ข้าวเหนียว'] },
  fish: { title: 'แผงปลา', purpose: 'trade', services: ['วัตถุดิบทำอาหาร', 'รับซื้อปลาจากผู้เล่น (อนาคต)'], preview: ['ปลาช่อน', 'ปลาตะเพียน', 'กุ้งแม่น้ำ'] },
  pottery: { title: 'แผงเครื่องปั้น', purpose: 'trade', services: ['ภาชนะ'], preview: ['โอ่งมังกร', 'หม้อดิน', 'ครก'] },
  lanterns: { title: 'แผงโคมไฟ', purpose: 'trade', services: ['เครื่องให้แสง'], preview: ['โคมกระดาษ', 'ตะเกียงน้ำมัน'] },
  charms: { title: 'แผงเครื่องราง', purpose: 'trade', stock: ['takrut'], services: ['เครื่องรางพื้นฐาน'], preview: ['สายสิญจน์', 'พระเครื่องดินเผา'] },
};
// Retain former shop IDs and restricted inventories for older buy requests.
// Proximity comes from the surviving counter, never a removed vendor.
export const SHOP_HOSTS = Object.freeze({ weapons: 'blacksmith', armor: 'blacksmith', charms: 'occult' });
SHOPS.blacksmith.stock = [...new Set([...SHOPS.blacksmith.stock, ...SHOPS.weapons.stock, ...SHOPS.armor.stock])];
SHOPS.blacksmith.stock.push(...Object.entries(EXTENDED_GEAR).filter(([,d]) => d.minLevel === 1).map(([id]) => id));
for (const type of ['general','supplies','herbalist']) SHOPS[type].stock.push(...NORMAL_FLASK_IDS);
SHOPS.herbalist.refillFlasks = true;
SHOPS.herbalist.services.push('เติมประจุขวดชุบชีพและขวดฟื้นจิต');

// One master per playable class (src/character/data/classes.js), each at the
// class's hall (src/data/halls.js). `classId` links the trainer to its class;
// `skills` names come from the class's real kit (src/classes/*-moves.js where a
// ten-skill kit exists, otherwise src/combat/data/skills.js).
export const TRAINERS = {
  muay: { title: 'ค่ายมวยไทย', classId: 'muaythai', class: 'มวยไทย', skills: ['หมัดแย็บ', 'เตะก้านคอ', 'ศอกกลับพลิกล็อก', 'เข่าลอยทะลวงฟ้า', 'ไหว้ครูรำมวย'] },
  sword: { title: 'สำนักดาบนักรบ', classId: 'warrior', class: 'นักรบ', skills: ['ฟันดาบ', 'ดาบหมุนวน', 'ตั้งการ์ด', 'ยาดม'] },
  hunter: { title: 'ทับนายพราน', classId: 'hunter', class: 'นายพราน', skills: ['ศรฉับไว', 'ศรพิษพรานไพร', 'ห่าฝนธนู', 'กับดักหนามพราน', 'ตาเหยี่ยว'] },
  herbal: { title: 'สำนักหมอยา', classId: 'herbalist', class: 'หมอยา', skills: ['สายใยสมุนไพร', 'ขวดยาเด้งห้าทิศ', 'วงหนาดปราบผี', 'หมอกยาชโลมใจ', 'น้ำอมฤตชุบชีวา'] },
  shaman: { title: 'ตำหนักหมอผี', classId: 'shaman', class: 'หมอผี', skills: ['ลูกไฟอาคม', 'ยันต์เพลิง', 'คุณไสย', 'น้ำมนต์'] },
  bandit: { title: 'เรือนโจรป่า', classId: 'assassin', class: 'โจรป่า', skills: ['แทงมีด', 'จู่โจมเงา', 'ม่านควัน', 'มีดอาบยาพิษ'] },
};

for(const e of EXPEDITIONS)SHOPS[`supplies_${e.id}`]={title:`ศาลาเสบียง ${e.name}`,purpose:'trade',stock:['potion_s','potion_m','ether',...expeditionGearIds(e)],services:['เติมเสบียงปาร์ตี้','อุปกรณ์ตามช่วงเลเวล','รับซื้อของป่า']};
