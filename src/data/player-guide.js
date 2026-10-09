// Player-facing copy and its rule receipts. No server implementation is bundled here.
import { CARD_RATE, STRIP } from '../character/data/cards.js';
import { ITEMS } from '../character/data/items.js';
import { MAX_LEVEL, MAX_JOB_LEVEL, MAX_SKILL_LEVEL } from '../character/data/progression.js';
import { POINTS_PER_LEVEL } from '../character/data/classes.js';
import { REFINE_MAX, REFINE_SAFE, REFINE_RATE, refineFee } from '../character/data/refine.js';
import { WARP_COOLDOWN, WARP_RANGE } from './warpServices.js';
import { cardPercent } from './card-compendium.js';

export const PLAYER_GUIDE_VERSION = 1;
export const GUIDE_ACTIONS = ['bag', 'sheet', 'skills', 'bestiary', 'map', 'loadouts'];
export const PLAYER_GUIDE = [
  { id: 'socket', title: 'การ์ดอยู่กับอุปกรณ์', icon: '❖',
    lines: ['เปิดกระเป๋า เลือกการ์ด แล้วเลือกอุปกรณ์ชนิดที่ตรงกันและมีช่องการ์ดว่าง การ์ดที่ล็อกไว้หรืออุปกรณ์ที่ล็อกไว้ต้องปลดล็อกก่อน',
      'เมื่อใส่แล้ว การ์ดจะติดกับอุปกรณ์ชิ้นนั้น แม้ถอด สวม ขาย แลก หรือฝากคลัง โบนัสและอาคมพิเศษทำงานจากอุปกรณ์ที่สวมใส่',
      'เครื่องรางทั้งสองช่องรับการ์ดเครื่องรางตามช่องว่างของแต่ละชิ้น สมุดบันทึกเก็บประวัติที่เคยค้นพบ แม้ไม่มีการ์ดชิ้นนั้นเหลืออยู่'],
    action: 'bag', actionLabel: 'เปิดกระเป๋า', sources: ['src/character/Character.js:cardTargets/insertCard', 'src/character/data/cards.js:socketCards'] },
  { id: 'extract', title: 'ถอดการ์ดกับหมออาคม', icon: '⌬',
    lines: [`ร้านหมออาคมถอดการ์ดทั้งหมดจากอุปกรณ์ในกระเป๋า ค่าใช้จ่ายต่อการ์ด: ${STRIP.gold} ทอง และ${ITEMS.ash.name} ${STRIP.ash} ชิ้น เตรียมช่องกระเป๋าและน้ำหนักให้พอ`,
      `สำเร็จ ${cardPercent(STRIP.ok)} · อุปกรณ์แตกแต่ได้การ์ดคืน ${cardPercent(STRIP.itemBreaks)} · การ์ดแตกแต่อุปกรณ์ยังอยู่ ${cardPercent(1 - STRIP.ok - STRIP.itemBreaks)}`,
      'ตรวจสอบความเสี่ยงก่อนยืนยัน การถอดการ์ดไม่ใช่การย้ายที่รับประกันความสำเร็จ'],
    action: 'bag', actionLabel: 'ตรวจอุปกรณ์ในกระเป๋า', facts: { ...STRIP }, sources: ['src/character/data/cards.js:STRIP', 'src/character/Character.js:stripCards'] },
  { id: 'drops', title: 'เลือกแหล่งล่าและเข้าใจดรอป', icon: '◆',
    lines: [`การ์ดสุ่มแยกจากไอเทมอื่น: ทั่วไป ${cardPercent(CARD_RATE.normal)} · ชั้นยอด ${cardPercent(CARD_RATE.elite)} · บอส ${cardPercent(CARD_RATE.boss)} ต่อการกำจัดหนึ่งครั้ง โอกาสดรอปไม่ใช่จำนวนครั้งที่รับประกัน`,
      'ออนไลน์ ทอง ไอเทม และการ์ดเป็นของผู้ทำดาเมจสูงสุดในหน่วยล่าที่ทำดาเมจรวมสูงสุด หากเป็นปาร์ตี้ ผู้ทำดาเมจสูงสุดในทีมเป็นผู้รับ ไม่ได้แจกการ์ดให้ทุกคน',
      'ใช้สมุดมอนสเตอร์ดูเวลาเกิด แผนที่ และไอเทมจริง การ์ดที่ยังไม่มีแหล่งเกิดจะแสดงไว้ในสมุดแต่ไม่มีเส้นทางให้เดินไปหา'],
    action: 'bestiary', actionLabel: 'เปิดสมุดมอนสเตอร์', facts: { rates: { ...CARD_RATE } }, sources: ['server/monsters.js:rewards', 'src/data/bestiary.js'] },
  { id: 'levels', title: 'เลเวล สถานะ และสำนักวิชา', icon: '✦',
    lines: [`เลเวลตัวละครสูงสุด ${MAX_LEVEL} ทุกครั้งที่ขึ้นเลเวลได้แต้มสถานะ ${POINTS_PER_LEVEL} แต้ม ใช้คู่มือลงแต้มในหน้าสถานะให้เข้ากับอาชีพ`,
      `Job สูงสุด ${MAX_JOB_LEVEL} สกิลสูงสุด Lv.${MAX_SKILL_LEVEL} ทุกครั้งที่ขึ้น Job หลังระดับแรกได้แต้มวิชา 1 แต้ม เลือกตามต้นไม้สกิลและเงื่อนไขก่อนเรียน`,
      'มอนสเตอร์ใกล้เลเวลให้ EXP คุ้มกว่า ตัวที่ต่ำกว่าเกิน 5 ระดับให้ EXP ลดลง และตัวที่สูงกว่าเกิน 10 ระดับก็มีอัตราลดลง เตรียมยาฟื้น HP และน้ำผึ้งป่าสำหรับ SP'],
    actions: [{ action: 'sheet', label: 'เปิดสถานะ' }, { action: 'skills', label: 'เปิดสำนักวิชา' }],
    facts: { maxLevel: MAX_LEVEL, maxJobLevel: MAX_JOB_LEVEL, maxSkillLevel: MAX_SKILL_LEVEL, pointsPerLevel: POINTS_PER_LEVEL },
    sources: ['src/character/data/progression.js', 'src/character/data/classes.js', 'src/rules/stats.js:expLevelMul'] },
  { id: 'party', title: 'ล่าร่วมกับเพื่อน', icon: '◇',
    lines: ['ปาร์ตี้รับได้สูงสุด 6 คน สมาชิกที่มีชีวิตในแผนที่และช่องเดียวกัน ระยะไม่เกิน 30 เมตรจากมอนสเตอร์ มีสิทธิ์แบ่ง EXP เมื่อระดับห่างกันไม่เกิน 15',
      'EXP ที่แบ่งมีโบนัส 10% ต่อสมาชิกเพิ่มหนึ่งคน แล้วหารระหว่างสมาชิกที่มีสิทธิ์ ทองและไอเทมยังเป็นของผู้รับรางวัลตามดาเมจ',
      'แผนที่สำรวจแนะนำทีม 3–5 คน เลือกวงรอบล่าตามระดับของทีม และตกลงเรื่องการแบ่งของก่อนออกเดินทาง'],
    action: 'map', actionLabel: 'ดูแผนที่ล่า', facts: { max: 6, shareRange: 30, levelGap: 15, bonus: .1 }, sources: ['server/parties.js:PARTY/sharers/evenShare', 'server/monsters.js:rewards', 'docs/world/LEVEL_PROGRESSION.md'] },
  { id: 'refine', title: 'ตีบวกอย่างรู้ความเสี่ยง', icon: '♢',
    lines: [`โรงหลอมศาสตราตีบวกได้ถึง +${REFINE_MAX} ช่วง +1 ถึง +${REFINE_SAFE} สำเร็จแน่นอน หลังจากนั้นหากล้มเหลว อุปกรณ์และการ์ดที่ใส่อยู่จะแตกทั้งหมด`,
      `โอกาสสำเร็จ ${Array.from({ length: REFINE_MAX - REFINE_SAFE }, (_, i) => { const lv = REFINE_SAFE + i + 1; return `+${lv}: ${cardPercent(REFINE_RATE[lv])}`; }).join(' · ')}`,
      `ค่าธรรมเนียม = ${refineFee(1)} × ระดับที่ต้องการ ทองต่อครั้ง และใช้แร่ 1 ชิ้น: อาวุธใช้${ITEMS.sacred_ore.name} ส่วนอุปกรณ์อื่นใช้${ITEMS.gold_leaf.name} ตรวจโบนัสที่จะเพิ่มและความเสี่ยงในหน้าตีบวกก่อนยืนยัน`],
    action: 'bag', actionLabel: 'ตรวจอุปกรณ์ก่อนตีบวก', facts: { max: REFINE_MAX, safe: REFINE_SAFE, rates: [...REFINE_RATE] }, sources: ['src/character/data/refine.js', 'src/character/Character.js:refineGear'] },
  { id: 'travel', title: 'ศาลาพักทางและชุดเตรียมล่า', icon: '↗',
    lines: [`เจ้าหน้าที่พักทางให้บริการวาร์ปฟรีตลอดวัน เข้าใกล้ไม่เกิน ${WARP_RANGE} เมตรแล้วเลือกจุดหมาย วาร์ปแต่ละครั้งเว้น ${WARP_COOLDOWN} วินาที`,
      'ต้องมีชีวิต พ้นการต่อสู้และการแลกของ จึงเดินทางได้ จุดลงเป็นลานพักใกล้ทางเข้าแผนที่ ไม่ใช่ตำแหน่งมอนสเตอร์ทันที',
      'บันทึกชุดอุปกรณ์และลำดับสกิลที่เรียนไว้ได้ 3 ชุด ชุดที่บันทึกไม่ให้ไอเทมหรือสกิลใหม่ ต้องยังเป็นเจ้าของอุปกรณ์ครบ และพ้นการต่อสู้ก่อนสลับชุด'],
    actions: [{ action: 'map', label: 'เปิดแผนที่' }, { action: 'loadouts', label: 'เปิดชุดเตรียมล่า' }],
    facts: { warpRange: WARP_RANGE, warpCooldown: WARP_COOLDOWN, loadouts: 3 }, sources: ['src/data/warpServices.js', 'server/index.js:service_warp', 'src/character/itemState.js:planLoadout'] },
];
