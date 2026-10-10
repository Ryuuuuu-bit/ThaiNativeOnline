// Sent privately by the server only after authenticated admin authorization.
export const GM_COMMANDS = [
  ['help', '[คำสั่ง]', 'ดูวิธีใช้คำสั่ง GM'], ['gold', '[n]', 'เพิ่มหรือลดตำลึง · ไม่ใส่ n = +10,000'],
  ['lv', '[n]', 'เพิ่มเลเวล (level) · ค่าเริ่มต้น 10'], ['exp', '[n]', 'เพิ่ม EXP · ค่าเริ่มต้น 1,000'],
  ['joblv', '[n]', 'เพิ่ม Job Lv · ค่าเริ่มต้น 10'], ['stat', '[n]', 'เพิ่มแต้มสถานะ (points) · ค่าเริ่มต้น 10'],
  ['item', '<id|ชื่อ> [n]', 'รับไอเทม · ค่าเริ่มต้น 1 ชิ้น'], ['card', '<มอน>', 'รับการ์ดมอนสเตอร์ · ค่าเริ่มต้น 1 ใบ'],
  ['refine', '<ช่อง> [ขั้น]', 'ตั้งขั้นตีบวกของที่สวม · ค่าเริ่มต้น +4'], ['heal', '', 'ฟื้น HP/MP'],
  ['hp', '[%]', 'ตั้ง HP · ค่าเริ่มต้น 100% · 0 = หมดสติ'], ['god', '', 'สลับอมตะจนออกเกม'],
  ['find', '<คำ>', 'ค้นหาไอเทมและมอนสเตอร์'], ['map', '<แมพ> [x z]', 'ย้ายแมพ'],
  ['who', '', 'ดูผู้เล่นออนไลน์'], ['goto', '<ชื่อ>', 'ไปหาผู้เล่น'],
  ['summon', '<ชื่อ>', 'เรียกผู้เล่น'], ['give', '<ชื่อ> <gold|id> [n]', 'มอบตำลึงหรือไอเทม'],
  ['kick', '<ชื่อ> [เหตุผล]', 'ให้ออกจากเกม'], ['mute', '<ชื่อ> [นาที]', 'ระงับแชท · ค่าเริ่มต้น 10 นาที'],
  ['unmute', '<ชื่อ>', 'คืนสิทธิ์แชท'], ['killall', '', 'กำจัดมอนในแมพและแชนแนล'],
  ['say', '<ข้อความ>', 'ประกาศถึงทุกคน'], ['time', '<ชั่วโมง>', 'ตั้งเวลาโลก'],
  ['admin', '<add|remove|list> [accountId]', 'จัดการด้วย accountId · add/remove ต้องระบุบัญชี · list ดูรายการ'],
].map(([id, args, description]) => Object.freeze({ id, usage: `/gm ${id}${args ? ` ${args}` : ''}`, description }));
const ALIASES = { level: 'lv', points: 'stat' };
export const GM_PREFIX = /^\s*\/gm(?:\s|$)/i;
export function parseGm(text) {
  const value = String(text ?? '');
  if (!GM_PREFIX.test(value)) return null;
  const [raw = 'help', ...args] = value.replace(GM_PREFIX, '').trim().split(/\s+/);
  const key = (raw || 'help').toLowerCase();
  return { cmd: ALIASES[key] ?? key, args };
}
export const GM_HELP = GM_COMMANDS.map(c => c.usage).join(' · ');
export function gmHelp(command) {
  if (!command) return GM_HELP;
  const key = command.toLowerCase(), entry = GM_COMMANDS.find(c => c.id === (ALIASES[key] ?? key));
  return entry ? `${entry.usage} — ${entry.description}` : `ไม่รู้จักคำสั่ง "${command}" · /gm help`;
}
