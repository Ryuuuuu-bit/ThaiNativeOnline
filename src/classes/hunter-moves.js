// นายพราน: ten skills (ids match the rules' archer skills in src/rules/data/skills.js)
// mapped onto the hunter's clips in docs/art/classes/hunter/ANIMATIONS.md.
// clip: animation in public/models/hunter.glb · hits: seconds from the clip start
// where the string is released (the arrow then flies; see fx/hunter-skills.js).
// Releases land on sampled frames (n / 30 s) of the 30 fps clips.
import { tempo, CLASS_TEMPO } from './tempo.js';
export const HUNTER_SKILLS = tempo([
  { id: 'arch_quick', key: 'Digit1', name: 'ศรคู่ฉับไว', clip: 'hunter_shot', fallback: 'hunter_shot', duration: .8, hits: [0.4], lv: 1, cd: 2.2, desc: 'ยิงศร 2 ดอกติดกันใส่เป้าเดียว คูลสั้น ยิงรัวได้' },
  { id: 'arch_poison', key: 'Digit2', name: 'สั่งกัด!', clip: 'hunter_shot', fallback: 'hunter_shot', duration: 1.0, hits: [0.4], lv: 2, cd: 5, desc: 'ศรหวีดหมายเป้า น้องหมาพุ่งงับกัดค้าง ตรึง 1.5 วิ เลือดไหล' },
  { id: 'arch_pierce', key: 'Digit3', name: 'ห่าศรพราน', clip: 'hunter_sky', fallback: 'hunter_shot', duration: 1.1, hits: [0.6], lv: 4, cd: 4, desc: 'ห่าศรลงเป็นวง โดนทุกตัวในวง · เก็บเลเวลทีละฝูง' },
  { id: 'arch_hawk', key: 'Digit4', name: 'ตาเหยี่ยว', clip: 'hunter_hawk', fallback: 'idle', duration: 1.6, hits: [0.8], lv: 6, cd: 20, desc: 'ตีเร็ว +25% โจมตี +15% คริ +10% 10 วิ' },
  { id: 'arch_rain', key: 'Digit5', name: 'ฝูงหมาไล่ล่า', clip: 'hunter_volley', fallback: 'hunter_shot', duration: 1.2, hits: [0.47], lv: 8, cd: 8, desc: 'ฝูงหมากัด 3 รอบ · แรงขึ้น 15% ต่อเป้าที่เลือดไหลหรืออ่อนแรง' },
  { id: 'arch_garuda', key: 'Digit6', name: 'หมาเห่าข่มขวัญ', clip: 'hunter_garuda', fallback: 'idle', duration: 1.6, hits: [0.9], lv: 10, cd: 16, desc: 'หมาเห่าข่มขวัญ มึน 1.5 วิ ลดพลังโจมตีศัตรู 20% 5 วิ' },
  { id: 'arch_volley', key: 'Digit7', name: 'ศรทะลวงแนว', clip: 'hunter_power', fallback: 'hunter_shot', duration: 1.4, hits: [0.9], lv: 20, cd: 7, desc: 'ศรทะลุแนว ลดเกราะ 25% 5 วิ เปิดช่องให้ทีม' },
  { id: 'arch_trap', key: 'Digit8', name: 'กับดักดินระเบิด', clip: 'hunter_trap', fallback: 'idle', duration: 1.4, hits: [0.6], lv: 40, cd: 10, desc: 'กับดักระเบิดดินวงกว้าง หนามตรึงทุกตัว 1.6 วิ แล้วช้าลง 40% 3 วิ' },
  { id: 'arch_snipe', key: 'Digit9', name: 'ล่าคู่ศรเหยี่ยวราตรี', clip: 'hunter_snipe', fallback: 'hunter_shot', duration: 2.0, hits: [1.33], lv: 70, cd: 14, desc: 'ศรเล็งแรงขึ้น 20% ต่อเป้าที่ช้าหรือเกราะแตก' },
  { id: 'arch_meteor', key: 'Digit0', name: 'ล่าล้างฝูง', clip: 'hunter_meteor', fallback: 'hunter_shot', duration: 2.0, hits: [1.1], lv: 100, cd: 20, desc: 'ห่าศรล้างฝูง · แรงขึ้น 15% ต่อเป้าที่ช้าหรือไฟลุก' },
], CLASS_TEMPO.hunter, ['arch_hawk']);
