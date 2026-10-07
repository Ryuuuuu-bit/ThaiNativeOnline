// หมอผี (จอมขมังเวทย์): ten skills (ids match the rules' mage skills in src/rules/data/skills.js)
// mapped onto the shaman's clips in docs/art/classes/shaman/ANIMATIONS.md.
// clip: animation in public/models/shaman.glb · hits: seconds from the clip start where each
// spell lands or leaves the hands (n / 30 s, the clips are 30 fps).
import { tempo, CLASS_TEMPO } from './tempo.js';
export const SHAMAN_SKILLS = tempo([
  { id: 'mage_akom', key: 'Digit1', name: 'กระสุนวิญญาณ', clip: 'shaman_akom', fallback: 'shaman_akom', duration: 1.0, hits: [0.4], lv: 1, cd: 2.4, desc: 'ยิงหัวกะโหลกวิญญาณ 3 ดวงโค้งเข้าเป้า' },
  { id: 'mage_yant', key: 'Digit2', name: 'โซ่ตรวนยมบาล', clip: 'shaman_yant', fallback: 'shaman_akom', duration: 1.1, hits: [0.47], lv: 2, cd: 6, desc: 'โซ่นรกพุ่งทะลุทุกตัว ตรึงศัตรูนิ่ง 1.8 วิ' },
  { id: 'mage_shield', key: 'Digit3', name: 'เกราะกระดูกผี', clip: 'shaman_ward', fallback: 'idle', duration: 1.4, hits: [0.7], lv: 4, cd: 16, desc: 'กระดูกผีห่อหุ้มกาย ฟื้น HP 12% ป้องกัน +24 นาน 8 วิ' },
  { id: 'mage_thunder', key: 'Digit4', name: 'มือมัจจุราช', clip: 'shaman_thunder', fallback: 'shaman_akom', duration: 1.2, hits: [0.6], lv: 6, cd: 5, desc: 'มือผียักษ์โผล่จากดินกระชากศัตรูที่ใกล้ที่สุด สะดุ้งชั่วครู่' },
  { id: 'mage_kalp', key: 'Digit5', name: 'ไฟนรกอเวจี', clip: 'shaman_kalp', fallback: 'shaman_akom', duration: 2.0, hits: [0.8, 1.03, 1.27, 1.5], lv: 8, cd: 16, desc: '★ ไฟนรกถล่มด้านหน้าวงกว้าง 4 ระลอก ผีติดไฟนรกลุกไหม้ต่อเนื่อง' },
  { id: 'mage_holy', key: 'Digit6', name: 'พิธีเซ่นผีบรรพบุรุษ', clip: 'shaman_holy', fallback: 'idle', duration: 1.8, hits: [0.9], lv: 10, cd: 24, desc: '[ปาร์ตี้] ผีบรรพบุรุษคุ้มครองวง ฟื้น HP 15% + MP 15% ทั้งปาร์ตี้ · ป้องกัน +12 นาน 10 วิ' },
  { id: 'mage_ghostfire', key: 'Digit7', name: 'วิญญาณเร่ร่อนห้าดวง', clip: 'shaman_ghostfire', fallback: 'shaman_akom', duration: 1.2, hits: [0.5], lv: 20, cd: 7, desc: 'ปลดปล่อยวิญญาณเร่ร่อน 5 ดวงพุ่งแผ่เป็นพัด โดนได้หลายตัว' },
  { id: 'mage_curse', key: 'Digit8', name: 'คำสาปตายโหง', clip: 'shaman_curse', fallback: 'shaman_akom', duration: 1.4, hits: [0.63], lv: 40, cd: 11, desc: 'วงคำสาปกว้างใต้เป้า ติดพิษตายโหง 6 ครั้ง เชื่องช้า −35% 3.5 วิ' },
  { id: 'mage_meditate', key: 'Digit9', name: 'ฌานป่าช้า', clip: 'shaman_meditate', fallback: 'idle', duration: 2.0, hits: [1.0], lv: 70, cd: 32, desc: 'นั่งสมาธิดูดพลังป่าช้า พลังเวทย์ +35% คริ +10% ฟื้น HP 10% นาน 12 วิ' },
  { id: 'mage_storm', key: 'Digit0', name: 'ประตูยมโลก', clip: 'shaman_storm', fallback: 'shaman_akom', duration: 2.2, hits: [0.8, 1.07, 1.33, 1.6, 1.87], lv: 100, cd: 16, desc: '★ เปิดประตูนรกวงกว้างรอบตัว มือผีกระชาก 5 ระลอก ผีทั้งวงสะดุ้งทุกครั้ง' },
], CLASS_TEMPO.shaman, ['mage_shield', 'mage_holy', 'mage_meditate']);
