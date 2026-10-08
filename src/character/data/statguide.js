// Content data only: the stat guide shown in the character sheet (คู่มือลงแต้ม) and the words the
// skill card uses to say what a skill scales from. The numbers quoted come from the rules
// (src/rules/stats.js computeDerived / rollDamage); keep them in step when those change.
//
//   STAT_GUIDE.tips                  general lines, every class
//   STAT_GUIDE.classes[classId]      { main, lines: [text], builds: [{ name, plan: { stat: weight }, why }] }
//   plan weights are the ratio the auto-allocate button keeps between stats (3:2:1 → three STR for
//   every two VIT and one DEX, always topping up the stat furthest below its share).
export const STAT_GUIDE = {
  tips: [
    'ค่าหลักของอาชีพ (STR ประชิด · DEX ธนู · INT เวทย์/ยา) ยิ่งสูงยิ่งคุ้ม: ATK/MATK มีพจน์ (ค่า/12)² จึงโตเร็วขึ้นหลัง 36–60 แต้ม — ลงค่าหลักให้ถึงก่อน แล้วค่อยกระจาย',
    'VIT ให้ HP สูงสุด (+8 ต่อแต้ม และ +1% ทุก 3 แต้ม) กับ DEF 0.65 ต่อแต้ม · DEF ลดดาเมจกายภาพครึ่งหนึ่งของค่า DEF ต่อการตี 1 ครั้ง',
    'AGI 5 แต้ม ≈ ตีเร็วขึ้น 1% (สูงสุด 30%) และหลบ 0.6 ต่อแต้ม · DEX ให้แม่นยำ 1 ต่อแต้ม และลดคูลดาวน์สกิล (สูงสุด 15% ที่ DEX 125)',
    'LUK ให้โอกาสคริ 0.3% และแรงคริ +0.5% ต่อแต้ม · โอกาสคริเกิน 40% ได้ครึ่งเดียว · เวทย์โดนเสมอ สายเวทย์ไม่ต้องลง DEX เพื่อแม่นยำ',
    'ความเสียหาย = พลัง (ATK หรือ MATK) × ตัวคูณสกิล × สุ่ม 90–110% − เกราะ (DEF ของเป้า × 0.5 · เวทย์ × 0.25) แล้วคูณแรงคริเมื่อติดคริ',
  ],
  classes: {
    warrior: {
      main: 'str', lines: ['ATK มาจาก STR (DEX ช่วย 1/5) · ดาบคู่ตีหลายครั้งต่อสกิล STR จึงคูณทุกครั้ง', 'VIT คือสิ่งที่ทำให้ขุนศึกยืนรับผีได้ · AGI เฉพาะสายวงจักรที่ต้องตีปกติเยอะ'],
      builds: [
        { name: 'ดาบคู่ · บอส', plan: { str: 3, vit: 2, dex: 1 }, why: 'เน้นสกิลเป้าเดียว STR นำ VIT รองไว้ยืนสู้บอส DEX นิดหน่อยให้แม่นและคูลดาวน์' },
        { name: 'ธงชัย · แทงก์ปาร์ตี้', plan: { vit: 3, str: 2, agi: 1 }, why: 'HP/DEF สูงสุดไว้ล่อผีให้เพื่อน STR พอให้ดึงความสนใจได้ AGI หลบเล็กน้อย' },
        { name: 'วงจักร · ฟาร์มหมู่', plan: { str: 3, agi: 2, vit: 1 }, why: 'ตีวงกว้างบ่อย AGI ให้ตีปกติเร็วระหว่างรอคูลดาวน์ VIT พอรับผีหลายตัว' },
      ],
    },
    muaythai: {
      main: 'str', lines: ['ATK มาจาก STR · มวยไทยตีปกติเร็วอยู่แล้ว AGI ยิ่งเสริม (สูงสุด 30%)', 'LUK คุ้มกับสายคอมโบเพราะตีหลายครั้ง คริออกบ่อย'],
      builds: [
        { name: 'หมัดศอกเข่า · คอมโบ', plan: { str: 3, agi: 2, dex: 1 }, why: 'STR นำ AGI ให้ตีเร็วและหลบ DEX ให้คูลดาวน์สกิลสั้นลงเล็กน้อย' },
        { name: 'สายคริ', plan: { luk: 3, str: 2, agi: 1 }, why: 'LUK ถึง ~100 ได้คริราว 35% แรงคริ ×2 · ตีเบากว่าแต่ระเบิดบ่อย' },
        { name: 'ไหว้ครู · แทงก์', plan: { vit: 3, str: 2, agi: 1 }, why: 'บัฟตัวเองแล้วยืนแลก VIT นำ STR พอมีดาเมจ AGI หลบ' },
      ],
    },
    hunter: {
      main: 'dex', lines: ['ATK ธนูมาจาก DEX (STR ช่วย 1/5) ไม่ใช่ STR · DEX ยังให้แม่นยำและคูลดาวน์', 'พรานมีโบนัสคริอาชีพ +8% อยู่แล้ว LUK จึงคุ้มกว่าอาชีพอื่น'],
      builds: [
        { name: 'ศรเหยี่ยว · บอส', plan: { dex: 3, agi: 1, luk: 1 }, why: 'DEX ให้ทุกอย่างที่พรานต้องการ AGI ยิงปกติเร็ว LUK ต่อยอดคริที่มีอยู่' },
        { name: 'ห่าศร · ฟาร์ม', plan: { dex: 3, vit: 1, agi: 1 }, why: 'ยิงวงกว้างแล้วโดนรุม VIT กับ AGI ช่วยให้ถอยทัน' },
        { name: 'สายคริ', plan: { dex: 2, luk: 2, agi: 1 }, why: 'คริสูงกว่า 40% ได้ครึ่งเดียว LUK ราว 90–100 คือจุดคุ้ม' },
      ],
    },
    shaman: {
      main: 'int', lines: ['MATK มาจาก INT อย่างเดียว และเวทย์โดนเสมอ ไม่ต้องลง DEX เพื่อแม่นยำ', 'DEX ลงเพื่อลดคูลดาวน์ (สูงสุด 15%) เท่านั้น · VIT คือเส้นชีวิตของร่างบาง'],
      builds: [
        { name: 'ไฟนรก · ฟาร์ม', plan: { int: 3, vit: 1, dex: 1 }, why: 'INT นำสุด ร่ายวงใหญ่ VIT พอรอดเมื่อผีเข้าถึงตัว DEX ร่ายถี่ขึ้น' },
        { name: 'คำสาป · คอนโทรล', plan: { int: 3, dex: 2, vit: 1 }, why: 'ยันต์และสายฟ้าเป้าเดียว DEX ให้คูลดาวน์สั้นลงสาปได้บ่อย' },
        { name: 'ผีบรรพบุรุษ · ปาร์ตี้', plan: { int: 3, vit: 2 }, why: 'โล่และพรเป็นหลัก INT เพิ่มทั้งความแรงโล่และ MP VIT ให้ยืนหลังแนวได้' },
      ],
    },
    herbalist: {
      main: 'int', lines: ['ทั้งพลังรักษาและพิษมาจาก MATK = INT · การรักษา = % ของ MATK × จำนวนครั้งที่ยาออกฤทธิ์', 'DEX ให้คูลดาวน์ยาสั้นลง (สูงสุด 15%) สำคัญกับหมอหลักที่ต้องฮีลให้ทัน'],
      builds: [
        { name: 'พิธีโอสถ · หมอหลัก', plan: { int: 3, vit: 2, dex: 1 }, why: 'INT ให้ฮีลแรง VIT ให้หมอไม่ตายก่อนคนไข้ DEX ให้ยาออกบ่อย' },
        { name: 'สมุนไพรพิษ · ฟาร์ม', plan: { int: 3, dex: 2, agi: 1 }, why: 'ปายาพิษใส่ฝูงผี DEX ลดคูลดาวน์ AGI หลบตอนโดนไล่' },
        { name: 'ยาบำรุง · บัฟปาร์ตี้', plan: { int: 2, vit: 2, dex: 2 }, why: 'สมดุล ยืนได้ บัฟถี่ ฮีลพอ สำหรับคนที่ชอบเล่นเป็นหลังบ้าน' },
      ],
    },
    assassin: {
      main: 'agi', lines: ['ATK มาจาก STR แต่มีดคู่ตีเร็วและคริกลางคืน +12% · AGI ให้ตีเร็ว + หลบ ซึ่งคือเกราะของสายนี้', 'LUK คุ้มมากเพราะตีถี่ คริออกบ่อย'],
      builds: [
        { name: 'เงาราตรี · คริ', plan: { luk: 3, agi: 2, str: 1 }, why: 'คริ + ตีเร็ว STR พอให้ตีไม่เบาเกิน ล่าตอนกลางคืนคริทะลุ 50%' },
        { name: 'หลบล้วน', plan: { agi: 3, str: 2, luk: 1 }, why: 'หลบจนผีตีไม่โดน ยืนแลกได้โดยไม่ต้องลง VIT' },
      ],
    },
  },
};

// The stat a skill's damage or heal grows from, for the skill card: { stat, label, how }.
//   kind physical → ATK (STR; DEX for ranged classes) · magic → MATK (INT) · best → the higher of the two.
export function scaleOf(kind, ranged = false) {
  if (kind === 'magic') return { stat: 'int', label: 'MATK', how: 'INT ยิ่งสูงยิ่งคุ้ม' };
  if (kind === 'best') return { stat: ranged ? 'dex' : 'str', label: 'ATK หรือ MATK ที่สูงกว่า', how: `${ranged ? 'DEX' : 'STR'} หรือ INT` };
  return ranged ? { stat: 'dex', label: 'ATK', how: 'DEX (ธนู) · STR ช่วย 1/5' } : { stat: 'str', label: 'ATK', how: 'STR · DEX ช่วย 1/5' };
}

// Spread `points` over `stats` ({ stat: current value }) by `plan` weights: each point goes to the
// stat furthest below its share. → { stat: n } (the order the sheet should press the + buttons).
export function spreadPoints(stats, points, plan) {
  const cur = { ...stats }, add = {};
  const keys = Object.keys(plan).filter(k => plan[k] > 0);
  for (let i = 0; i < points && keys.length; i++) {
    const k = keys.slice().sort((a, b) => (cur[a] || 0) / plan[a] - (cur[b] || 0) / plan[b])[0];
    cur[k] = (cur[k] || 0) + 1; add[k] = (add[k] || 0) + 1;
  }
  return add;
}
