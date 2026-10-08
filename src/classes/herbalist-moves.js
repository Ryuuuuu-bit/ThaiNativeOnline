// หมอยา: ten skills from prototypes/skill-fx/src/healer_fx.src.html mapped onto the
// six casting clips in docs/art/classes/herbalist/ANIMATIONS.md.
// clip: animation in public/models/herbalist.glb · hits: seconds from the clip
// start where the spell is released (the grimoire orbits the caster, see fx/herbalist-skills.js).
import { tempo, CLASS_TEMPO } from './tempo.js';
export const HERBALIST_SKILLS = tempo([
  { id: 'heal_vine', key: 'Digit1', name: 'สายใยสมุนไพร', clip: 'cast_book', fallback: 'cast_book', duration: 1.6, hits: [0.7], lv: 1, cd: 9, desc: 'เถาสมุนไพรผูกเป้า ดูดพลังกลับมารักษาตัวเองและเพื่อนในปาร์ตี้ที่อยู่ใกล้ (ตามพลังเวทย์) นาน 6 วิ' },
  { id: 'heal_pill', key: 'Digit2', name: 'ขวดยาเด้งห้าทิศ', clip: 'toss', fallback: 'toss', duration: 1.0, hits: [0.45], lv: 2, cd: 6, desc: 'ปาขวดยาเด้ง 5 ครั้ง โดนผีน้ำยาพิษกระเซ็น · รักษาตัวเองและเพื่อนในปาร์ตี้ที่อยู่ใกล้ (ตามพลังเวทย์)' },
  { id: 'heal_zone', key: 'Digit3', name: 'วงหนาดปราบผี', clip: 'kneel_heal', fallback: 'kneel_heal', duration: 2.4, hits: [0.9], lv: 4, cd: 14, desc: 'กางวงหนาดใต้ผี ผีทุกตัวในวงโดนพลังเวทย์ ติดพิษ 6 วิ และช้าลง 25% 3 วิ' },
  { id: 'heal_tiger', key: 'Digit4', name: 'ยาต้มพยัคฆ์เหิน', clip: 'brew', fallback: 'brew', duration: 2.4, hits: [1.2], lv: 6, cd: 16, desc: '[ปาร์ตี้] ต้มยาพยัคฆ์ ป้องกัน +20% วิ่งเร็ว +25% 8 วิ ทั้งปาร์ตี้รอบตัว' },
  { id: 'heal_khwan', key: 'Digit5', name: 'พิธีสู่ขวัญ', clip: 'raise_sky', fallback: 'raise_sky', duration: 2.2, hits: [1.1], lv: 8, cd: 40, desc: '★ [ปาร์ตี้] บายศรีสู่ขวัญ รักษา 40% ทั้งปาร์ตี้รอบตัว · ชุบชีวิตเพื่อนที่สลบ' },
  { id: 'heal_mortar', key: 'Digit6', name: 'ครกยาระเบิดสมุนไพร', clip: 'pound', fallback: 'pound', duration: 2.2, hits: [0.6, 1.1, 1.6], lv: 10, cd: 16, desc: 'ตำครกยา 3 ที ผีในวงมึนและช้า แล้วผงยาวนกลับมารักษาตัวเองและเพื่อนในปาร์ตี้ที่อยู่ใกล้' },
  { id: 'heal_mist', key: 'Digit7', name: 'หมอกยาชโลมใจ', clip: 'cast_book', fallback: 'cast_book', duration: 1.6, hits: [0.7], lv: 20, cd: 14, desc: '[ปาร์ตี้] พ่นหมอกยาหอม ฟื้น HP 18% + MP 10% ทั้งปาร์ตี้รอบตัว' },
  { id: 'heal_tonic', key: 'Digit8', name: 'ยาบำรุงกำลังเจ็ดพลัง', clip: 'cast_book', fallback: 'cast_book', duration: 1.6, hits: [0.7], lv: 40, cd: 24, desc: '[ปาร์ตี้] ลูกยา 7 สีโคจรแล้วพุ่งเข้าตัว โจมตี +18% ป้องกัน +15% ทั้งปาร์ตี้รอบตัว' },
  { id: 'heal_mother', key: 'Digit9', name: 'พรแม่โพสพ', clip: 'kneel_heal', fallback: 'kneel_heal', duration: 2.4, hits: [0.9], lv: 70, cd: 30, desc: '[ปาร์ตี้] ทุ่งข้าวทองงอกรอบตัว ฟื้น HP 45% + MP 20% ทั้งปาร์ตี้' },
  { id: 'heal_amrita', key: 'Digit0', name: 'น้ำอมฤตชุบชีวา', clip: 'raise_sky', fallback: 'raise_sky', duration: 2.2, hits: [1.1], lv: 100, cd: 45, desc: '[ปาร์ตี้] คนโททองเทน้ำอมฤต รักษา 60% ทั้งปาร์ตี้รอบตัว · ชุบชีวิตเพื่อนที่สลบ' },
], CLASS_TEMPO.herbalist, ['heal_tiger', 'heal_mist', 'heal_tonic']);
