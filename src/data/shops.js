// Shop and training services. NPCs reference these by `shopType` or `trainer`.
// `stock` lists item ids from src/character/data/items.js the shop sells at their price;
// shops without stock (and trainers) still show their future services.
export const SHOPS = {
  blacksmith: { title: 'โรงตีเหล็ก', purpose: 'equipment', stock: ['wood_sword', 'iron_dap', 'bamboo_bow', 'bone_wand'], services: ['ตีอาวุธ', 'ซ่อมอาวุธ', 'สร้างอุปกรณ์'], preview: ['ดาบเหล็กกล้า', 'หอกทหาร', 'มีดเหน็บ', 'โล่หนังควาย'] },
  enhance: { title: 'โรงหลอมศาสตรา', purpose: 'upgrade', services: ['ตีบวกอุปกรณ์', 'หลอมขัดเกลา (Refine)', 'อัปเกรดด้วยวัตถุดิบพิเศษ'], preview: ['แร่ศักดิ์สิทธิ์', 'ทองคำเปลว', 'น้ำมนต์หลอม'] },
  general: { title: 'ร้านของชำ', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether'], services: ['ซื้อ-ขายของทั่วไป'], preview: ['ยาสามัญ', 'ข้าวห่อใบตอง', 'คบไฟ', 'เชือก', 'เครื่องมือพื้นฐาน'] },
  herbalist: { title: 'ร้านหมอยา', purpose: 'trade', stock: ['potion_s', 'potion_m', 'ether', 'herb_staff'], services: ['ยารักษา', 'ยาแก้พิษ', 'ปรุงยาสมุนไพร'], preview: ['ยาหอม', 'ยาเขียว', 'ยาแก้พิษงู', 'ขมิ้นชัน'] },
  occult: { title: 'ร้านหมออาคม', purpose: 'skills', stock: ['takrut', 'ether'], services: ['เครื่องราง', 'ผ้ายันต์ · ตะกรุด', 'วัตถุดิบอาคม', 'ของประกอบวิชา'], preview: ['ตะกรุดโทน', 'ผ้ายันต์แดง', 'เทียนขี้ผึ้ง', 'ใบลานจารอักขระ'] },
  weapons: { title: 'แผงอาวุธ', purpose: 'equipment', stock: ['wood_sword', 'krabi', 'hand_wrap', 'herb_staff'], services: ['ซื้อ-ขายอาวุธ'], preview: ['ดาบสั้น', 'ง้าว', 'มีดพร้า'] },
  armor: { title: 'แผงเกราะ', purpose: 'equipment', stock: ['cloth_vest', 'hide_armor'], services: ['ซื้อ-ขายเกราะ'], preview: ['เสื้อเกราะหนัง', 'หมวกลอมพอก', 'โล่หวาย'] },
  fruit: { title: 'แผงผลไม้', purpose: 'trade', services: ['วัตถุดิบทำอาหาร'], preview: ['มะม่วง', 'กล้วยน้ำว้า', 'มะพร้าว'] },
  rice: { title: 'แผงข้าวสาร', purpose: 'trade', services: ['วัตถุดิบทำอาหาร'], preview: ['ข้าวเปลือก', 'ข้าวสาร', 'ข้าวเหนียว'] },
  fish: { title: 'แผงปลา', purpose: 'trade', services: ['วัตถุดิบทำอาหาร', 'รับซื้อปลาจากผู้เล่น (อนาคต)'], preview: ['ปลาช่อน', 'ปลาตะเพียน', 'กุ้งแม่น้ำ'] },
  pottery: { title: 'แผงเครื่องปั้น', purpose: 'trade', services: ['ภาชนะ'], preview: ['โอ่งมังกร', 'หม้อดิน', 'ครก'] },
  lanterns: { title: 'แผงโคมไฟ', purpose: 'trade', services: ['เครื่องให้แสง'], preview: ['โคมกระดาษ', 'ตะเกียงน้ำมัน'] },
  charms: { title: 'แผงเครื่องราง', purpose: 'trade', stock: ['takrut'], services: ['เครื่องรางพื้นฐาน'], preview: ['สายสิญจน์', 'พระเครื่องดินเผา'] },
};
export const TRAINERS = {
  muay: { title: 'สำนักมวยไทย', class: 'นักมวย', skills: ['หมัดตรง', 'เข่าลอย', 'ศอกกลับ'] },
  sword: { title: 'สำนักดาบ', class: 'นักดาบ', skills: ['ดาบสองมือ', 'รำดาบ', 'ปัดป้อง'] },
  hunter: { title: 'วิชาพราน', class: 'พราน', skills: ['ยิงธนู', 'วางกับดัก', 'ตามรอย'] },
  herbal: { title: 'วิชาหมอยา', class: 'หมอยา', skills: ['ปรุงยา', 'รักษาบาดแผล', 'แก้พิษ'] },
  shaman: { title: 'วิชาหมอผี', class: 'หมอผี', skills: ['ไล่ผี', 'ลงยันต์', 'สื่อวิญญาณ'] },
  occult: { title: 'วิชาอาคม', class: 'ผู้ใช้อาคม', skills: ['คาถาคงกระพัน', 'ปลุกเสก'] },
  bandit: { title: 'วิชาโจรป่า', class: 'โจรป่า', skills: ['ซุ่มโจมตี', 'ล้วงกระเป๋า', 'หลบหนี'] },
};
