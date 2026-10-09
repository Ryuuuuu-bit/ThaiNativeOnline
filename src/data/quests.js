// Quest data. Each quest is given by an NPC (`giver`) and returned to `turnIn`
// (defaults to the giver). Objectives:
//   discover: landmark id       kill: monster type (src/combat/data/monsters.js) × count
//   collect: item id × count (taken on turn-in)   talk: NPC id
// `requires`, `classId`, `minLevel` and `minJobLevel` restrict acceptance and hand-in.
// Rewards: gold, exp, items and an optional matching advanced-school mastery.
// No "go and look at a place" quests: places are not a thing to find any more (they
// are just walked through); quests are about people, monsters and items.
import { KIT_SKILL_IDS } from '../character/data/kits.js';

export const CLASS_MASTERS = Object.freeze({
  muaythai: 'master_muay', warrior: 'master_sword', hunter: 'master_hunter',
  shaman: 'master_shaman', herbalist: 'master_herbal', assassin: 'master_bandit',
});

// Practice uses accepted class casts during combat, never client dummy/hit counts.
const practiceSkills = classId => KIT_SKILL_IDS[classId] ?? ['shadow', 'smoke', 'venom'];
const comboSkills = classId => classId === 'assassin' ? ['shadow', 'venom'] : practiceSkills(classId).slice(0, 2);
const lessons = [
  {
    classId: 'muaythai', intro: 'ไหว้ครูและคุ้มครองชาวนา', advanced: 'แม่ไม้รับเขี้ยวดงอ้อ',
    introOffer: 'ก่อนเรียนแม่ไม้ จงใช้กำลังช่วยชาวนา ปราบหมูป่าในสวนผลไม้ เก็บหนังสัตว์ไว้หุ้มอุปกรณ์ฝึก แล้วถามยายเพียรเรื่องเสบียงก่อนกลับค่าย',
    advancedOffer: 'แม่ไม้ที่ดีต้องรักษาสติท่ามกลางเขี้ยวคม ไปช่วยแม่บัวผันที่คลองหนองบึง ปราบงูเหลือม เก็บหนังสัตว์ แล้วกลับมารับวิชาสำนักจากครู',
    introKill: 'boar', introItem: 'hide', introTalk: 'village_trader', introPlace: 'สวนผลไม้ · ทุ่งนาข้าว',
    advancedKill: 'python', advancedItem: 'hide', advancedCount: 4, advancedPlace: 'ดงอ้อฝั่งตะวันออก · คลองหนองบึง',
  },
  {
    classId: 'warrior', intro: 'ดาบอาสาเฝ้าชายป่า', advanced: 'ยืนหยัดริมคลอง',
    introOffer: 'ดาบนักรบมีไว้คุ้มครองคนเดินทาง ปราบผีป่าที่ชายป่าลึก เก็บขี้เถ้าธูปมาบูชาครู และคุยกับหมอแสงเรื่องเส้นทางกลับก่อนมารายงาน',
    advancedOffer: 'ชาวคลองถูกกุมภีล์ขวางทาง จงถามแม่บัวผันแล้วปราบกุมภีล์ เก็บเกล็ดจระเข้จากสัตว์บึงมาทำเครื่องหมายกองอาสา ก่อนกลับสำนักดาบ',
    introKill: 'phibpa', introItem: 'ash', introTalk: 'forest_herbalist', introPlace: 'ชายป่า · ป่าลึก',
    advancedKill: 'kumphi', advancedItem: 'croc_scale', advancedCount: 2, advancedPlace: 'ฝั่งคลองด้านตะวันออก · คลองหนองบึง',
  },
  {
    classId: 'hunter', intro: 'พรานเรียนรอยเท้า', advanced: 'ตามรอยจระเข้บึง',
    introOffer: 'พรานต้องรู้ทางกลับก่อนออกตามรอย ไปปราบลิงที่สวนผลไม้ เก็บหนังสัตว์สำหรับซ่อมสายธนู และถามยายเพียรเรื่องทางปลอดภัยแล้วกลับมาหาข้า',
    advancedOffer: 'แม่บัวผันพบรอยจระเข้ตามฝั่งบึง จงคุยกับนาง ปราบจระเข้บึง และนำเกล็ดจระเข้กลับมา ใช้ระยะยิงให้ดี ไม่ต้องท้าชาละวัน',
    introKill: 'monkey', introItem: 'hide', introTalk: 'village_trader', introPlace: 'สวนผลไม้ · ทุ่งนาข้าว',
    advancedKill: 'croc', advancedItem: 'croc_scale', advancedCount: 2, advancedPlace: 'ริมบึงฝั่งตะวันตก · คลองหนองบึง',
  },
  {
    classId: 'shaman', intro: 'เถ้าธูปคืนขวัญ', advanced: 'ยันต์สงบพรายน้ำ',
    introOffer: 'อาคมต้องใช้ด้วยใจสงบ ปราบผีพรายในป่าลึก เก็บขี้เถ้าธูปสำหรับจารยันต์ และคุยกับหมอแสงก่อนกลับตำหนักมารายงานข้า',
    advancedOffer: 'พรายน้ำรบกวนเรือชาวบ้าน ไปถามแม่บัวผัน ปราบผีพรายน้ำ และเก็บขี้เถ้าธูปกลับมาจารอักขระคุ้มขวัญ สำนักไม่ให้เจ้าตามล่าบอส',
    introKill: 'pray', introItem: 'ash', introTalk: 'forest_herbalist', introPlace: 'ดงป่าลึก · ป่าลึก',
    advancedKill: 'wraith', advancedItem: 'ash', advancedCount: 4, advancedPlace: 'หนองฝั่งตะวันออก · คลองหนองบึง',
  },
  {
    classId: 'herbalist', intro: 'ตำรับยาประจำทาง', advanced: 'ตำรับคุ้มครองชาวคลอง',
    introOffer: 'หมอยาต้องไปถึงคนไข้โดยปลอดภัย ปราบงูเห่านาตามคันนา เก็บหนังสัตว์สำหรับหุ้มกระบอกยา และคุยกับหมอแสงเรื่องเสบียงก่อนกลับสำนัก',
    advancedOffer: 'แม่บัวผันขอให้ช่วยผู้คนจากผีตายทั้งกลม จงคุยกับนาง ปราบผีตายทั้งกลม และนำขี้เถ้าธูปกลับมาปรุงตำรับคุ้มครอง เมื่อเก็บเครื่องปรุงครบแล้วจงกลับมาหาครู',
    introKill: 'cobra', introItem: 'hide', introTalk: 'forest_herbalist', introPlace: 'คลองชลประทาน · ทุ่งนาข้าว',
    advancedKill: 'klom', advancedItem: 'ash', advancedCount: 4, advancedPlace: 'ดงอ้อฝั่งตะวันตก · คลองหนองบึง',
  },
  {
    classId: 'assassin', intro: 'ก้าวเงาคุ้มทางป่า', advanced: 'เงาพิทักษ์ดงอ้อ',
    introOffer: 'วิชาเงาไม่ใช่ข้ออ้างรังแกคน จงปราบหมาไนที่ป่าลึก เก็บหนังสัตว์มาซ่อมปลอกมีด แล้วคุยกับหมอแสงเรื่องคนเดินทางก่อนกลับเรือนโจรป่า',
    advancedOffer: 'ใช้ก้าวเงาช่วยคนที่เดินผ่านดงอ้อ คุยกับแม่บัวผัน ปราบงูเหลือม และนำหนังสัตว์กลับมาให้ข้า สำนักจะรับรองวิชาของเจ้า',
    introKill: 'dhole', introItem: 'hide', introTalk: 'forest_herbalist', introPlace: 'ทางหมาไน · ป่าลึก',
    advancedKill: 'python', advancedItem: 'hide', advancedCount: 4, advancedPlace: 'ดงอ้อฝั่งตะวันออก · คลองหนองบึง',
  },
];

export const CLASS_QUESTS = lessons.flatMap(l => [
  {
    id: `class_${l.classId}_intro`, classId: l.classId, stage: 'intro', giver: CLASS_MASTERS[l.classId],
    title: l.intro, minLevel: 5, minJobLevel: 3, offer: l.introOffer,
    done: 'เจ้าช่วยผู้คนและรู้ทางกลับแล้ว จงฝึกวิชาที่เรียนอยู่ต่อไป เมื่อถึง Lv 20 และ Job 12 ครูจะให้บททดสอบวิชาสำนัก',
    guide: 'รับเควส → คุยกับคนเสบียง → โจมตีเป้าหมายแล้วฝึกสกิลระหว่างล่า → เก็บของ → กลับครูคนเดิม',
    objectives: [
      { talk: l.introTalk, hint: l.introTalk === 'village_trader' ? 'หมู่บ้านชาวนา · ทุ่งนาข้าว · เช้า–เย็น' : 'ศาลาปากป่า · ป่าลึก' },
      { kill: l.introKill, count: 4, hint: l.introPlace },
      { practice: practiceSkills(l.classId).slice(0, 1), count: 3, hint: 'โจมตีสัตว์หรือผีก่อนใช้สกิล · รอคูลดาวน์และเติม MP · หุ่นฝึกไม่นับ' },
      { collect: l.introItem, count: 2, hint: 'ของจากสัตว์หรือผี · ใช้ของที่มีในกระเป๋าได้' },
    ],
    rewards: { gold: 100, exp: 120, items: [['potion_s', 3], ['ether', 1]] },
    training: l.classId === 'assassin' ? 'ฝึกจู่โจมเงาหลังเข้าประชิดเป้าหมาย และถอยเมื่อไม่พร้อม' : 'ฝึกวิชาแรกของสำนัก (ปุ่ม 1 ในแถบเริ่มต้น) หลังโจมตีเป้าหมาย รอวิชาพร้อมแล้วใช้ซ้ำ',
  },
  {
    id: `class_${l.classId}_advanced`, classId: l.classId, stage: 'advanced', giver: CLASS_MASTERS[l.classId],
    title: l.advanced, minLevel: 20, minJobLevel: 12, requires: [`class_${l.classId}_intro`], offer: l.advancedOffer,
    done: 'สำนักรับรองฝีมือของเจ้าแล้ว วิชาสำนักติดตัวถาวร ไม่ใช้แต้มสกิล และไม่เปลี่ยนวิชาที่เคยเรียน',
    guide: 'คุยกับแม่บัวผันที่ลานพักคลอง → ฝึกวิชาที่เรียนแล้วระหว่างล่า → เก็บของให้ครบ → กลับครูคนเดิม',
    objectives: [
      { talk: 'marsh_trader', hint: 'หมู่บ้านริมน้ำ · คลองหนองบึง' },
      { kill: l.advancedKill, count: 6, hint: l.advancedPlace },
      { combo: { skills: comboSkills(l.classId), seconds: 12 }, count: 1, hint: 'ให้สองวิชาต่างกันโดนสัตว์หรือผีภายใน 12 วิ · คนละเป้าหมายได้ · ท่าปกติ/หุ่นฝึก/ยิงพลาดไม่นับ' },
      { collect: l.advancedItem, count: l.advancedCount, hint: 'ส่งของจากกระเป๋า · ไม่ต้องล่าบอส' },
    ],
    rewards: { gold: 350, exp: 1500, items: [['potion_m', 3], ['ether', 2]], mastery: `school_${l.classId}` },
    training: l.classId === 'assassin' ? 'ฝึกจู่โจมเงา → มีดอาบยาพิษ หรือสลับลำดับ ภายใน 12 วิ; ม่านควันช่วยเอาตัวรอดแต่ไม่นับเป็นวิชาโจมตี' : 'ฝึกวิชาแรก → วิชาที่สองของสำนัก หรือสลับลำดับ ให้โดนภายใน 12 วิ; ถ้ายังไม่ได้เรียนวิชาที่สอง ใช้แต้มสกิลเรียนกับครูตามเงื่อนไขเดิม',
  },
]);

export const QUESTS = [...CLASS_QUESTS];
