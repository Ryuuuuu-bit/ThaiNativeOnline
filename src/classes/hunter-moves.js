// นายพราน: ten skills (ids match the rules' archer skills in src/rules/data/skills.js)
// mapped onto the hunter's clips in docs/art/classes/hunter/ANIMATIONS.md.
// clip: animation in public/models/hunter.glb · hits: seconds from the clip start
// where the string is released (the arrow then flies; see fx/hunter-skills.js).
// Releases land on sampled frames (n / 30 s) of the 30 fps clips.
export const HUNTER_SKILLS = [
  { id: 'arch_quick', key: 'Digit1', name: 'ศรฉับไว', clip: 'hunter_shot', fallback: 'hunter_shot', duration: 1.0, hits: [0.4], lv: 1, cd: 1.8, desc: 'ยิงเร็ว 2 ดอกพร้อมกัน' },
  { id: 'arch_poison', key: 'Digit2', name: 'ศรพิษพรานไพร', clip: 'hunter_shot', fallback: 'hunter_shot', duration: 1.0, hits: [0.4], lv: 2, cd: 5, desc: 'ศรอาบพิษ ดาเมจต่อเนื่อง 5 ครั้ง' },
  { id: 'arch_pierce', key: 'Digit3', name: 'ศรทะลวงเกราะ', clip: 'hunter_power', fallback: 'hunter_shot', duration: 1.4, hits: [0.9], lv: 4, cd: 6, desc: 'คุกเข่าง้างสุดแรง ศรทะลุทุกตัว เกราะแตก −35% 6 วิ' },
  { id: 'arch_hawk', key: 'Digit4', name: 'ตาเหยี่ยว', clip: 'hunter_hawk', fallback: 'idle', duration: 1.6, hits: [0.8], lv: 6, cd: 20, desc: 'วิญญาณเหยี่ยวลงมาสถิต โจมตี +30% คริ +30% 10 วิ' },
  { id: 'arch_rain', key: 'Digit5', name: 'ห่าฝนธนู', clip: 'hunter_sky', fallback: 'hunter_shot', duration: 1.3, hits: [0.6], lv: 8, cd: 18, desc: '★ ยิงขึ้นฟ้า ธนูตกเป็นห่าฝน 5 ระลอก' },
  { id: 'arch_garuda', key: 'Digit6', name: 'ลมใต้ปีกครุฑ', clip: 'hunter_garuda', fallback: 'idle', duration: 1.8, hits: [0.9], lv: 10, cd: 26, desc: '[ปาร์ตี้] ปีกครุฑโอบ คริ +15% โจมตี +10% ตีเร็ว +8% 12 วิ' },
  { id: 'arch_volley', key: 'Digit7', name: 'ศรกระจายเจ็ดดาว', clip: 'hunter_volley', fallback: 'hunter_shot', duration: 1.2, hits: [0.47], lv: 20, cd: 7, desc: 'ยิงศร 5 ดอกแผ่เป็นพัด โดนหลายตัวด้านหน้า' },
  { id: 'arch_trap', key: 'Digit8', name: 'กับดักหนามพราน', clip: 'hunter_trap', fallback: 'idle', duration: 1.4, hits: [0.6], lv: 40, cd: 12, desc: 'ส่งกับดักหนามไปใต้เป้า ติดกับ 1.6 วิ แล้วเดินช้าลง 40% 3 วิ' },
  { id: 'arch_snipe', key: 'Digit9', name: 'ศรสังหารเหยี่ยวราตรี', clip: 'hunter_snipe', fallback: 'hunter_shot', duration: 2.0, hits: [1.33], lv: 70, cd: 14, desc: 'เล็งนานกลั้นหายใจ ยิงศรเดียวแรงมาก' },
  { id: 'arch_meteor', key: 'Digit0', name: 'ศรเพลิงอัคนีบาต', clip: 'hunter_meteor', fallback: 'hunter_shot', duration: 2.0, hits: [1.1], lv: 100, cd: 20, desc: '★ ยิงศรเพลิงขึ้นฟ้า ตกเป็นห่าลูกไฟ 5 ระลอกในวงกว้าง' },
];
