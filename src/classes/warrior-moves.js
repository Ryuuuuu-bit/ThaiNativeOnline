// นักรบ (ขุนศึก ดาบคู่): ten skills (ids match the rules' swordman skills in
// src/rules/data/skills.js) mapped onto the warrior's clips in
// docs/art/classes/warrior/ANIMATIONS.md.
// clip: animation in public/models/warrior.glb · hits: seconds from the clip start
// where each blade lands (n / 30 s, the clips are 30 fps).
import { tempo, CLASS_TEMPO } from './tempo.js';
export const WARRIOR_SKILLS = tempo([
  { id: 'sword_twin', key: 'Digit1', name: 'ฟันดาบคู่', clip: 'sword_twin', fallback: 'sword_twin', duration: 1.0, hits: [0.3, 0.47, 0.67], lv: 1, cd: 3, desc: 'ฟันไขว้ 3 ครั้ง โดนทุกตัวด้านหน้า เลือดไหลต่อเนื่อง' },
  { id: 'sword_thrust', key: 'Digit2', name: 'แทงทะลวง', clip: 'sword_thrust', fallback: 'sword_twin', duration: 1.0, hits: [0.4], lv: 2, cd: 6, desc: 'พุ่งแทงทะลุแนวศัตรู สะดุ้ง เกราะแตก −30% 6 วิ' },
  { id: 'sword_wind', key: 'Digit3', name: 'ดาบวายุ', clip: 'sword_wind', fallback: 'sword_twin', duration: 1.1, hits: [0.5], lv: 4, cd: 5, desc: 'ฟันไขว้ส่งคลื่นดาบทะลุทุกตัว' },
  { id: 'sword_guard', key: 'Digit4', name: 'ตั้งการ์ดดาบคู่', clip: 'sword_guard', fallback: 'idle', duration: 1.3, hits: [0.6], lv: 6, cd: 18, desc: 'ฟื้น HP 10% ป้องกัน +25 โจมตี +15% 10 วิ' },
  { id: 'sword_pikat', key: 'Digit5', name: 'เพลงดาบพิฆาต', clip: 'sword_pikat', fallback: 'sword_twin', duration: 2.0, hits: [0.33, 0.6, 0.87, 1.13, 1.4, 1.67], lv: 8, cd: 16, desc: '★ ร่ายเพลงดาบรอบตัว 6 ครั้ง' },
  { id: 'sword_banner', key: 'Digit6', name: 'ธงชัยเฉลิมพล', clip: 'sword_banner', fallback: 'idle', duration: 1.8, hits: [0.9], lv: 10, cd: 28, desc: '[ปาร์ตี้] ปักธงครุฑนำทัพ โจมตี +22% ป้องกัน +8 12 วิ' },
  { id: 'sword_whirl', key: 'Digit7', name: 'ดาบบาทวงจักร', clip: 'sword_whirl', fallback: 'sword_twin', duration: 1.4, hits: [0.37, 0.67, 0.97], lv: 20, cd: 8, desc: 'หมุนดาบรอบตัว 3 รอบ ฟันทุกตัวรอบกาย' },
  { id: 'sword_leap', key: 'Digit8', name: 'กระโจนผ่าปฐพี', clip: 'sword_leap', fallback: 'sword_twin', duration: 1.5, hits: [0.9], lv: 40, cd: 10, desc: 'กระโดดฟาดดาบลงพื้น ทุกตัวในวงสะดุ้ง 1 วิ' },
  { id: 'sword_berserk', key: 'Digit9', name: 'โทสะขุนศึก', clip: 'sword_berserk', fallback: 'idle', duration: 1.6, hits: [0.8], lv: 70, cd: 30, desc: 'โจมตี +35% คริ +15% ตีเร็ว +15% วิ่งเร็ว +15% 10 วิ' },
  { id: 'sword_execute', key: 'Digit0', name: 'ดาบประหารอสูร', clip: 'sword_execute', fallback: 'sword_twin', duration: 2.0, hits: [1.2], lv: 100, cd: 15, desc: '★ รวมพลังฟันดาบฟ้าผ่าครั้งเดียว แรงมาก มึน 1.5 วิ' },
], CLASS_TEMPO.warrior, ['sword_guard', 'sword_banner', 'sword_berserk']);
