// Distances are metres, timings seconds. These attacks lock their aim at the
// start of the warning: players can dodge, rather than be followed by an AoE.
const circle = (id, name, radius, color, extra = {}) => ({ id, name, shape: 'circle', radius, color, windup: 2, cooldown: 9, power: 1.35, aim: 'target', ...extra });
const cone = (id, name, radius, color, extra = {}) => ({ id, name, shape: 'cone', radius, angle: Math.PI * .65, color, windup: 1.8, cooldown: 8, power: 1.5, aim: 'self', ...extra });
const ring = (id, name, radius, innerRadius, color, extra = {}) => ({ id, name, shape: 'ring', radius, innerRadius, color, windup: 2.4, cooldown: 11, power: 1.4, aim: 'self', ...extra });

export const BOSS_SKILLS = {
  buffalo: [cone('horn', 'กวาดเขา', 4, '#dba36b', { power: 1.2 }), circle('stomp', 'กระทืบคันนา', 3.5, '#dba36b', { aim: 'self', power: 1.2 })],
  takian: [circle('roots', 'รากพันธนาการ', 3, '#92bf83'), ring('grove', 'วงคำสาปตะเคียน', 8, 3, '#92bf83')],
  pusom: [circle('seal', 'ยันต์พิทักษ์สมบัติ', 4, '#d7b96b'), ring('relic', 'คลื่นอาคมปู่โสม', 8, 3, '#d7b96b')],
  chalawan: [cone('jaw', 'เขี้ยวชาละวัน', 7, '#79bfcc'), ring('tide', 'คลื่นวังบาดาล', 9, 3, '#79bfcc')],
  pop: [cone('claw', 'กรงเล็บปอบ', 5, '#bba57b'), circle('curse', 'เงากินวิญญาณ', 3.5, '#bba57b')],
  krasue: [circle('ember', 'ไฟกระสือ', 3, '#e7996a'), ring('flame', 'วงเพลิงวิญญาณ', 6, 2.5, '#e7996a')],
  tani: [circle('leaves', 'ใบตานีอาคม', 3.5, '#a7c57f'), ring('grove', 'เขตหวงห้ามตานี', 8, 3, '#a7c57f')],
  bamboo_grave_3: [circle('grave', 'ยันต์ป่าช้า', 4, '#bfaa7f'), ring('spirits', 'วงวิญญาณไผ่ดำ', 8, 3, '#bfaa7f')],
  sealed_mine_3: [cone('hammer', 'ทุบศิลาผนึก', 6, '#cba886'), circle('collapse', 'ศิลาร่วง', 4, '#cba886')],
  sunken_city_3: [cone('breath', 'ลมหายใจนาคราช', 8, '#7ec7bd'), ring('undertow', 'คลื่นนาคราช', 10, 3.5, '#7ec7bd')],
  dusk_fort_3: [cone('blade', 'ฟันสนธยา', 7, '#dc987d'), circle('brand', 'ตราเพลิงอสูร', 4, '#dc987d')],
  giant_valley_3: [cone('club', 'กระบองสะเทือนผา', 8, '#d0b17f'), ring('quake', 'แผ่นดินยักษ์', 10, 3.5, '#d0b17f')],
  himmapan_3: [cone('feathers', 'ขนปักษาสังหาร', 9, '#9cbacb'), circle('gust', 'ลมหมุนหิมพานต์', 4.5, '#9cbacb')],
  fallen_city_3: [cone('command', 'คมดาบราชองครักษ์', 8, '#a6b5ca'), ring('mandala', 'ค่ายกลนครล่ม', 10, 3.5, '#a6b5ca')],
  demon_rift_3: [circle('rupture', 'รอยแยกกลืนวิญญาณ', 5, '#bb9ac9'), ring('eclipse', 'วงสุริยคราสอสูร', 11, 4, '#bb9ac9')],
};

export const MAP_BOSSES = {
  paddy: 'buffalo', deep_forest: 'takian', wat_rang: 'pusom', klong: 'chalawan',
  ...Object.fromEntries(['bamboo_grave','sealed_mine','sunken_city','dusk_fort','giant_valley','himmapan','fallen_city','demon_rift'].map(id => [id, `${id}_3`])),
};
