// หมอผี (จอมขมังเวทย์): ten skills (ids match the rules' mage skills in src/rules/data/skills.js)
// mapped onto the shaman's clips in docs/art/classes/shaman/ANIMATIONS.md.
// clip: animation in public/models/shaman.glb · hits: seconds from the clip start where each
// spell lands or leaves the staff (n / 30 s, the clips are 30 fps).
export const SHAMAN_SKILLS = [
  { id: 'mage_akom', key: 'Digit1', name: 'คาถาอาคม', clip: 'shaman_akom', fallback: 'shaman_akom', duration: 1.0, hits: [0.4], lv: 1, cd: 1.8, desc: 'ยิงลูกไฟอาคม 3 ลูกโค้งเข้าเป้า' },
  { id: 'mage_yant', key: 'Digit2', name: 'ยันต์ตรึงวิญญาณ', clip: 'shaman_yant', fallback: 'shaman_akom', duration: 1.1, hits: [0.47], lv: 2, cd: 6, desc: 'ปายันต์ทอง 3 แผ่นวนเข้าเป้า โซ่วิญญาณล็อกศัตรูนิ่ง 1.8 วิ (ทะลุทุกตัว)' },
  { id: 'mage_shield', key: 'Digit3', name: 'เกราะยันต์เก้ายอด', clip: 'shaman_ward', fallback: 'idle', duration: 1.4, hits: [0.7], lv: 4, cd: 16, desc: 'ฟื้น HP 25% ป้องกัน +24 นาน 8 วิ' },
  { id: 'mage_thunder', key: 'Digit4', name: 'อัสนีบาต', clip: 'shaman_thunder', fallback: 'shaman_akom', duration: 1.2, hits: [0.6], lv: 6, cd: 5, desc: 'ฟ้าผ่าศัตรูที่ใกล้ที่สุด สะดุ้งชั่วครู่' },
  { id: 'mage_kalp', key: 'Digit5', name: 'เพลิงกัลป์ปราบผี', clip: 'shaman_kalp', fallback: 'shaman_akom', duration: 2.0, hits: [0.8, 1.03, 1.27, 1.5], lv: 8, cd: 22, desc: '★ ไฟกัลป์ถล่มด้านหน้า 4 ระลอก ผีติดไฟลุกไหม้ต่อเนื่อง' },
  { id: 'mage_holy', key: 'Digit6', name: 'น้ำมนต์ธาราทิพย์', clip: 'shaman_holy', fallback: 'idle', duration: 1.8, hits: [0.9], lv: 10, cd: 24, desc: '[ปาร์ตี้] บัวทิพย์บานกลางวง ฟื้น HP 25% + MP 15% · ป้องกัน +12 นาน 10 วิ' },
  { id: 'mage_ghostfire', key: 'Digit7', name: 'ไฟผีห้าทิศ', clip: 'shaman_ghostfire', fallback: 'shaman_akom', duration: 1.2, hits: [0.5], lv: 20, cd: 7, desc: 'เรียกไฟผีกองกอย 5 ดวงพุ่งแผ่เป็นพัด โดนได้หลายตัว' },
  { id: 'mage_curse', key: 'Digit8', name: 'คำสาปพรายตานี', clip: 'shaman_curse', fallback: 'shaman_akom', duration: 1.4, hits: [0.63], lv: 40, cd: 11, desc: 'วงคำสาปใต้เป้า ติดพิษพราย 6 ครั้ง เชื่องช้า −35% 3.5 วิ' },
  { id: 'mage_meditate', key: 'Digit9', name: 'สมาธิกสิณไฟ', clip: 'shaman_meditate', fallback: 'idle', duration: 2.0, hits: [1.0], lv: 70, cd: 32, desc: 'เข้าฌานกสิณ พลังเวทย์ +30% คริ +10% ฟื้น HP 10% นาน 12 วิ' },
  { id: 'mage_storm', key: 'Digit0', name: 'พายุอัสนีเทพ', clip: 'shaman_storm', fallback: 'shaman_akom', duration: 2.2, hits: [0.8, 1.07, 1.33, 1.6, 1.87], lv: 100, cd: 20, desc: '★ เรียกพายุฟ้าผ่ารอบตัว 5 ระลอก ผีในวงกว้างสะดุ้งทุกครั้ง' },
];
