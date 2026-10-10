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

// Shared, one-time supply route. These quests supplement hunting; they do not
// replace the EXP curve or gate any existing class lesson.
export const NEWCOMER_QUESTS = [
  {
    id: 'newcomer_supplies', giver: 'warp_city_gate', turnIn: 'warp_paddy', minLevel: 1,
    title: 'เสบียงก้าวแรก',
    offer: 'ก่อนออกล่า เปิดกระเป๋าดูยาหม้อและน้ำผึ้งป่า แล้วใช้ประตูวาปไปทุ่งนาข้าว คุยกับเจ้าหน้าที่พักทางที่ทางเข้าทุ่ง เจ้าหน้าที่จะจัดเสบียงให้เจ้า',
    done: 'ยาหม้อเติม HP น้ำผึ้งป่าเติม MP เก็บไว้ใช้เมื่อจำเป็น ก่อนล่าให้รับงานจากเจ้าหน้าที่ก่อน',
    guide: 'คุยเจ้าหน้าที่พักทางประตูเมืองทิศเหนือ → วาปไปทุ่งนาข้าว → คุยและส่งงานกับเจ้าหน้าที่พักทางทุ่งนาข้าว · ทุกเวลา',
    objectives: [{ talk: 'warp_paddy', hint: 'ทางเข้าทุ่งนาข้าว · ทุกเวลา' }],
    rewards: { gold: 20, exp: 20, items: [['potion_s', 3], ['ether', 1]] },
  },
  {
    id: 'newcomer_paddy', giver: 'warp_paddy', minLevel: 1, requires: ['newcomer_supplies'],
    title: 'คันนาไม่ไกลบ้าน',
    offer: 'ปูนาตามคันนาอยู่ไม่ไกลหมู่บ้าน ลองปราบทีละตัวให้ครบสามตัว เก็บหนังสัตว์หนึ่งชิ้นจากสัตว์ในทุ่ง แล้วกลับมาหาเจ้าหน้าที่พักทาง อย่าเพิ่งไปรบกวนควายป่า',
    done: 'เจ้ารู้จักล่าและกลับเติมเสบียงแล้ว เก็บหนังสัตว์ที่เหลือไว้ใช้ในบทเรียนสำนัก อย่าขายหมด',
    guide: 'รับงานก่อนล่า → ปูนา Lv 2 ที่คันนาฝึกหัด → เก็บหนังสัตว์ → ส่งเจ้าหน้าที่พักทางทุ่งนาข้าว · ทุกเวลา',
    objectives: [{ kill: 'crab', count: 3, hint: 'คันนาฝึกหัด · ทุ่งนาข้าว · Lv 2' }, { collect: 'hide', count: 1, hint: 'สัตว์ในทุ่งอาจดรอป · ส่งแล้วใช้หนัง 1 ชิ้น' }],
    rewards: { gold: 30, exp: 60, items: [['potion_s', 2]] },
  },
  {
    id: 'newcomer_forest', giver: 'warp_paddy', turnIn: 'forest_herbalist', minLevel: 3, requires: ['newcomer_paddy'],
    title: 'รู้ทางกลับจากชายป่า',
    offer: 'ถึง Lv 3 แล้วลองไปศาลาปากป่า คุยกับหมอแสง ปราบผีป่าทีละตัวสามตัว แล้วนำขี้เถ้าธูปหนึ่งชิ้นไปให้นาง หากสู้ไม่ไหวกลับมาเติมยาก่อน',
    done: 'ศาลาปากป่าเป็นจุดเติมยาได้ทุกเวลา เมื่อถึง Lv 5 และ Job 3 กลับเมืองไปหาครูประจำอาชีพเพื่อรับบทเรียนแรก',
    guide: 'คุยหมอแสง → ผีป่า Lv 3 ที่ดงปากป่าตะวันออก → เก็บเถ้า → ส่งหมอแสง · เลี่ยงหมาไนที่มาเป็นฝูงและเขตเสือสมิง',
    objectives: [{ talk: 'forest_herbalist', hint: 'ศาลาปากป่า · ป่าลึก · ทุกเวลา' }, { kill: 'phibpa', count: 3, hint: 'ดงปากป่าตะวันออก · ป่าลึก · Lv 3' }, { collect: 'ash', count: 1, hint: 'ผีป่าและผีทั่วไปอาจดรอป · ส่งแล้วใช้เถ้า 1 ชิ้น' }],
    rewards: { gold: 40, exp: 100, items: [['potion_s', 3], ['ether', 1]] },
  },
  {
    id: 'newcomer_wat', giver: 'forest_herbalist', turnIn: 'wat_hermit', minLevel: 6, requires: ['newcomer_forest'],
    title: 'ฝากข่าวถึงฤๅษี',
    offer: 'เมื่อพร้อมที่ Lv 6 ให้นำข่าวไปถึงตาฤๅษีพรหมตรงปากทางวัดร้าง ช่วยปราบผีหัวขาดสามตัวที่ดงวิญญาณตะวันตก แล้วกลับไปหาฤๅษี ไม่ต้องเข้าโบสถ์หรือหาบอส',
    done: 'วัดร้างอันตรายกว่าป่า เติมยาก่อนออกทุกครั้ง ฝึกกับศัตรูใกล้ระดับตนจนพร้อมไปคลองที่ Lv 10',
    guide: 'คุยฤๅษีตรงทางเข้า → ผีหัวขาด Lv 6 ที่ดงวิญญาณตะวันตก → ส่งฤๅษี · ล่าทีละตัวและเลี่ยงเขตบอส',
    objectives: [{ talk: 'wat_hermit', hint: 'ปากทางวัดร้าง · ทุกเวลา' }, { kill: 'headless', count: 3, hint: 'ดงวิญญาณตะวันตก · วัดร้าง · Lv 6' }],
    rewards: { gold: 50, exp: 200, items: [['potion_m', 2], ['ether', 1]] },
  },
  {
    id: 'newcomer_marsh', giver: 'wat_hermit', turnIn: 'marsh_trader', minLevel: 10, requires: ['newcomer_wat'],
    title: 'พักเรือก่อนลงบึง',
    offer: 'ถึง Lv 10 แล้วค่อยไปคุยแม่บัวผันที่หมู่บ้านริมน้ำ เริ่มจากปลิงควายสี่ตัวบริเวณชายบึงดงอ้อ หากยาหม้อหมดให้กลับเรือ ไม่ต้องตามจระเข้เข้าไปในหนอง',
    done: 'เรือแม่บัวผันเติมยาและขายอาวุธชาวบึงได้ เก็บเงินไว้ซื้อของที่อาชีพใช้ได้ จากนี้เลือกวงล่าใกล้ระดับตนจนถึง Lv 20',
    guide: 'คุยแม่บัวผัน → ปลิงควาย Lv 11 ที่ชายบึงดงอ้อ → ส่งแม่บัวผัน · ระวังพิษและผีพรายน้ำที่ดูด MP',
    objectives: [{ talk: 'marsh_trader', hint: 'หมู่บ้านริมน้ำ · คลองหนองบึง · ทุกเวลา' }, { kill: 'leech', count: 4, hint: 'ชายบึงดงอ้อ · คลองหนองบึง · Lv 11' }],
    rewards: { gold: 70, exp: 400, items: [['potion_m', 2], ['ether', 1]] },
  },
  {
    id: 'newcomer_homecoming', giver: 'marsh_trader', turnIn: 'forest_herbalist', minLevel: 20, requires: ['newcomer_marsh'],
    title: 'กลับมาพร้อมเรื่องเล่า',
    offer: 'ถึง Lv 20 แล้วกลับไปบอกหมอแสงว่าชาวคลองยังปลอดภัย จากนั้นกลับเมืองหาครูประจำอาชีพ ถ้าส่งบทเรียนแรกแล้วและมี Job 12 จะรับบทเรียนขั้นสูงได้',
    done: 'เจ้ารู้จักจุดพักและทางกลับแล้ว บทเรียนขั้นสูงอยู่กับครูประจำอาชีพ ตรวจ Lv 20 / Job 12 และส่งบทเรียนแรกให้ครบก่อนรับ',
    guide: 'คุยและส่งหมอแสงที่ศาลาปากป่า → กลับเมือง → ตรวจบทเรียนของอาชีพตนในสมุดเควส',
    objectives: [{ talk: 'forest_herbalist', hint: 'ศาลาปากป่า · ป่าลึก · ทุกเวลา' }],
    rewards: { gold: 90, exp: 600, items: [['potion_m', 2], ['ether', 2]] },
  },
];

export const QUESTS = [...NEWCOMER_QUESTS, ...CLASS_QUESTS];
