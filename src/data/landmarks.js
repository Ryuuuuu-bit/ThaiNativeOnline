import { HALLS } from './halls.js';

// Points of interest. Every district has a future gameplay purpose; `hidden`
// landmarks stay off the map until the player discovers them on foot.
export const PURPOSES = {
  trade: 'การค้า', equipment: 'อุปกรณ์', upgrade: 'ตีบวก', quest: 'เควส / ตำนาน', travel: 'เดินทาง / ตกปลา', gathering: 'เก็บเกี่ยว',
  combat: 'ต่อสู้ / เก็บของป่า', boss: 'มอนสเตอร์ยามค่ำ / บอส', skills: 'เรียนวิชา', karma: 'กรรม / PvP', story: 'เรื่องราวชาวเมือง',
};

export const LANDMARKS = [
  { id: 'port', name: 'ท่าเรือหลวง', x: 6, z: 158, radius: 16, icon: '⚓', purpose: 'travel', text: 'ท่าเรือหลวงริมแม่น้ำเจ้าพระยา เรือสินค้าจากหัวเมืองและแดนไกลเทียบท่าที่นี่ทุกวัน' },
  { id: 'port_tower', name: 'หอดูเรือ', x: 18, z: 160, radius: 6, icon: '▲', purpose: 'travel', text: 'หอไม้สูงที่สุดริมน้ำ ใช้ส่งสัญญาณให้เรือที่เข้าออกท่า' },
  { id: 'fish_market', name: 'ตลาดปลา', x: 0, z: 124, radius: 12, icon: '◆', purpose: 'trade', text: 'กลิ่นปลาสดและเสียงต่อราคา ชาวประมงนำของจากแม่น้ำมาขายตั้งแต่ฟ้ายังไม่สาง' },
  { id: 'fishing_village', name: 'หมู่บ้านชาวประมง', x: -96, z: 150, radius: 16, icon: '◆', purpose: 'travel', text: 'บ้านใต้ถุนสูงริมน้ำ อวนตากแดดเรียงราย ที่นี่เรียนรู้การตกปลาได้ในวันหน้า' },
  { id: 'boatyard', name: 'อู่ต่อเรือ', x: 98, z: 154, radius: 10, icon: '◆', purpose: 'travel', text: 'ช่างไม้กำลังต่อเรือลำใหม่ สักวันเรือลำนี้อาจพาคุณล่องไปเมืองอื่น' },
  { id: 'market', name: 'ศาลาตลาดใหญ่', x: 0, z: 28, radius: 18, icon: '◆', purpose: 'trade', text: 'หัวใจของนครอโยธยา พ่อค้าจากทุกทิศมาชุมนุมใต้ศาลาหลังคาซ้อนชั้น' },
  { id: 'forge', name: 'โรงตีเหล็ก', x: -28, z: 64, radius: 8, icon: '⚒', purpose: 'equipment', text: 'เสียงค้อนกระทบทั่งดังทั้งวัน ช่างตีเหล็กรับตีอาวุธและซ่อมอุปกรณ์' },
  { id: 'enhance', name: 'โรงหลอมศาสตรา', x: -48, z: 92, radius: 8, icon: '✦', purpose: 'upgrade', text: 'เตาหลอมเปลวสีฟ้าที่ช่างตีบวกใช้หลอมแร่ศักดิ์สิทธิ์เข้ากับศาสตรา' },
  { id: 'general', name: 'ร้านของชำ', x: -9, z: 62, radius: 6, icon: '◆', purpose: 'trade', text: 'ร้านของใช้ประจำวัน คบไฟ เชือก เสบียง และยาพื้นบ้าน' },
  { id: 'herbalist', name: 'ร้านหมอยา', x: 10, z: 65, radius: 6, icon: '✚', purpose: 'trade', text: 'สมุนไพรตากแห้งห้อยเต็มชายคา กลิ่นยาหอมฉุนลอยออกมาถึงถนน' },
  { id: 'occult', name: 'ร้านหมออาคม', x: 10, z: 86, radius: 6, icon: '☯', purpose: 'skills', text: 'ผ้ายันต์ เทียน และควันธูป หมออาคมไม่เคยบอกว่าตนมาจากที่ใด' },
  { id: 'training', name: 'ลานฝึกครู', x: 47, z: 62, radius: 14, icon: '⚔', purpose: 'skills', text: 'ลานฝึกของครูมวย ครูดาบ และนายพราน ผู้แสวงหาวิชามารวมกันที่นี่' },
  { id: 'city_pillar', name: 'ศาลหลักเมือง', x: 8, z: -37, radius: 7, icon: '◈', purpose: 'quest', text: 'หลักเมืองที่ชาวอโยธยากราบไหว้ เชื่อกันว่าปกปักรักษาทั้งนคร' },
  { id: 'temple', name: 'วัดสุวรรณเจดีย์', x: 72, z: -58, radius: 22, icon: '☸', purpose: 'quest', text: 'พระมหาเจดีย์ทองมองเห็นได้จากทั่วเมือง ภิกษุและผู้แสวงบุญมาที่นี่เพื่อความสงบ' },
  { id: 'north_gate', name: 'ประตูเมืองทิศเหนือ', x: 0, z: -104, radius: 10, icon: '⛩', purpose: 'travel', text: 'ประตูเมืองปิดตายตามรับสั่ง แต่หมอผีเปิดประตูวาปไว้ใต้ซุ้มประตู ผู้กล้าก้าวเข้าแสงจะไปโผล่ที่ทุ่งนอกกำแพง' },
  // ย่านสำนักครู: one landmark per class training hall, at its door (src/data/halls.js).
  ...HALLS.map(h => ({ id: h.id, name: h.name, x: h.door.x, z: h.door.z, radius: 7, icon: '⚔', purpose: 'skills', classId: h.classId, text: h.text })),

  // ---------- ทุ่งนอกเมือง (map `fields`, north of the wall) ----------
  { id: 'outer_warp', name: 'ประตูวาปนอกกำแพง', x: 0, z: -126, radius: 8, icon: '⛩', purpose: 'travel', text: 'แสงวาปหน้าประตูเมืองที่ปิดตาย ทหารยามสองนายเฝ้าไว้ ก้าวเข้าแสงเพื่อกลับเข้านครอโยธยา' },
  { id: 'farm_village', name: 'หมู่บ้านชาวนา', x: -62, z: -132, radius: 14, icon: '◆', purpose: 'story', text: 'ยุ้งข้าว ครกกระเดื่อง และคอกควาย ชาวนาตื่นก่อนไก่ขันเพื่อออกไปดูแลทุ่ง' },
  { id: 'rice_fields', name: 'ทุ่งนาหลวง', x: -64, z: -196, radius: 30, icon: '◆', purpose: 'gathering', text: 'ผืนนาสุดลูกหูลูกตา ต้นตาลยืนเรียงตามคันนา ข้าวที่นี่เลี้ยงคนทั้งกรุง' },
  { id: 'orchards', name: 'สวนผลไม้', x: 62, z: -190, radius: 26, icon: '⚔', purpose: 'combat', text: 'สวนมะม่วงและกล้วยของชาวเมือง หมูป่าและลิงกังลงมากินผลไม้จนชาวสวนต้องจ้างนักล่า' },
  { id: 'banyan', name: 'ต้นไทรพันปี', x: 12, z: -280, radius: 12, icon: '◈', purpose: 'quest', text: 'ไทรใหญ่ผูกผ้าสามสี ศาลเล็ก ๆ ที่โคนต้นมีดอกไม้สดทุกวัน ผู้คนขอพรก่อนเข้าป่า' },
  { id: 'forest_gate', name: 'ศาลปากป่า', x: 4, z: -310, radius: 10, icon: '⚔', purpose: 'combat', text: 'เชือกศักดิ์สิทธิ์ขึงขวางทางเดิน บอกว่าเลยจากนี้คือป่าของผีป่า ไม่ใช่ของคน' },
  { id: 'ruined_chedi', name: 'เจดีย์ร้างกลางป่า', x: -48, z: -368, radius: 12, icon: '⚔', purpose: 'combat', text: 'เจดีย์หักพังที่รากไม้รัดไว้แน่น ผีพรายวนเวียนอยู่แม้ยามกลางวัน' },
  { id: 'forest_shrine', name: 'ศาลร้างกลางไพร', x: -35, z: -474, radius: 10, icon: '☠', purpose: 'boss', hidden: true, text: 'ศาลไม้ผุที่ไม่มีใครกล้ามาจุดธูป ยามค่ำวิญญาณเร่ร่อนออกมาเฝ้า' },
  { id: 'cemetery', name: 'สุสานเก่าแห่งอโยธยา', x: 0, z: -520, radius: 16, icon: '☠', purpose: 'boss', hidden: true, text: 'กำแพงสุสานพังทลาย เจดีย์บรรจุอัฐิเอียงไปคนละทิศ ยามค่ำคืนผีตายโหงลุกขึ้นจากหลุม' },
];
export const landmark = id => LANDMARKS.find(l => l.id === id);
