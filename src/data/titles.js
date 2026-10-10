// ฉายา (titles): earned from what a character has done, shown above its name and in chat for
// everyone. Pure data and rules (no DOM), run by the server for signed-in characters
// (server/combatants.js, server/ranking.js) and by the browser for guests. Ported from
// ThaiNative's shared/data/titles.js onto what this game records.
//
// A title: { id, cat, name, color, hint, ok(c, rec) } and, for a count, { goal, prog(c, rec) }
// (the bar in the titles tab). `dynamic` titles (server ranks) are held only while the rank holds;
// `glow` ones are the legendary few. `rec` is Character.rec: kills · boss {type: n} · healOut ·
// revive · deaths · cpRank / lvRank / enhRank (server/ranking.js) · sin · merit · pkKill · redKill ·
// pvpKill · duelWin (src/data/karma.js).
//   checkTitles(c) → ids just earned (and drops a rank title the character lost)
import { MAX_LEVEL } from '../character/data/progression.js';

export const TITLE_CATS = [['lv', 'เลเวล'], ['hunt', 'ล่าผี'], ['boss', 'ปราบบอส'], ['support', 'สายซัพพอร์ต'], ['pvp', 'PK · ประลอง'], ['social', 'สังคม'], ['legend', '✦ ตำนาน'], ['rank', 'อันดับเซิร์ฟ']];
// the bosses behind the boss titles (src/combat/data/monsters.js types)
export const BOSS_TITLES = { tiger: 'เสือสมิง', krasue: 'กระสือ', pop: 'ปอบ' };

const lv = (id, n, name, color) => ({ id, cat: 'lv', name, color, hint: `ถึง Lv ${n}${n >= MAX_LEVEL ? ' (เลเวลตัน)' : ''}`, goal: n, prog: c => c.level, ok: c => c.level >= n });
const kills = (id, n, name, color, cat = 'hunt', glow = false) => ({ id, cat, name, color, glow, hint: `ปราบผี ${n.toLocaleString()} ตัว`, goal: n, prog: (c, r) => r.kills || 0, ok: (c, r) => (r.kills || 0) >= n });
// a PvP record count (src/data/karma.js): pkKill · redKill · duelWin · merit
const pvp = (id, key, n, name, color, hint) => ({ id, cat: 'pvp', name, color, hint, goal: n, prog: (c, r) => r[key] || 0, ok: (c, r) => (r[key] || 0) >= n });
const boss = (type, name, color, where) => ({ id: `boss_${type}`, cat: 'boss', name, color, hint: `ร่วมปราบ${BOSS_TITLES[type]} · ${where}`, ok: (c, r) => (r.boss?.[type] || 0) >= 1 });

export const TITLES = [
  { id: 'rookie', cat: 'lv', name: 'ผู้กล้าหน้าใหม่', color: '#d5dbdb', hint: 'ได้ตั้งแต่เริ่มเกม', ok: () => true },
  lv('lv10', 10, 'ผู้เลือกทาง', '#aed6f1'),
  lv('lv20', 20, 'ยอดฝีมือกรุงศรี', '#85c1e9'),
  lv('lv30', 30, 'ตำนานแห่งกรุงศรี', '#f7dc6f'),
  lv('lv50', 50, 'ผู้พิชิตหิมพานต์', '#82e0aa'),
  lv('lv75', 75, 'สหายพญานาค', '#5dade2'),
  lv('lv99', MAX_LEVEL, 'ผู้อยู่เหนือยมโลก', '#ff9ff3'),
  kills('hunt100', 100, 'นักล่าผี', '#f5b7b1'),
  kills('hunt1000', 1000, 'มือปราบผี', '#f1948a'),
  kills('hunt5000', 5000, 'เทพผู้พิชิตผี', '#ec7063'),
  boss('tiger', 'ผู้ปราบเสือสมิง', '#f0b27a', 'ป่าลึก'),
  boss('krasue', 'ผู้ปราบกระสือ', '#ff8a65', 'วัดร้าง'),
  boss('pop', 'ผู้ปราบปอบ', '#a3c99a', 'วัดร้าง'),
  { id: 'boss_all', cat: 'boss', name: 'เจ้าแห่งราตรี', color: '#c39bd3', hint: 'ปราบบอสครบทั้ง 3 ตัว', goal: 3, prog: (c, r) => Object.keys(BOSS_TITLES).filter(t => r.boss?.[t]).length, ok: (c, r) => Object.keys(BOSS_TITLES).every(t => r.boss?.[t]) },
  { id: 'medic', cat: 'support', name: 'หมอยาประจำขบวน', color: '#48c9b0', hint: 'รักษาเพื่อนในปาร์ตี้รวม 20,000 HP', goal: 20000, prog: (c, r) => r.healOut || 0, ok: (c, r) => (r.healOut || 0) >= 20000 },
  pvp('duel1', 'duelWin', 1, 'นักประลองหน้าใหม่', '#aed6f1', 'ชนะการดวล 1 ครั้ง'),
  pvp('duel10', 'duelWin', 10, 'ยอดนักประลอง', '#5dade2', 'ชนะการดวล 10 ครั้ง'),
  pvp('duel50', 'duelWin', 50, 'เซียนเวทีประลอง', '#f5b041', 'ชนะการดวล 50 ครั้ง'),
  pvp('redhunt1', 'redKill', 1, 'ผู้พิทักษ์ธรรม', '#82e0aa', 'ปราบหัวแดง 1 คน'),
  pvp('redhunt10', 'redKill', 10, 'นักล่าค่าหัว', '#48c9b0', 'ปราบหัวแดง 10 คน'),
  pvp('redhunt50', 'redKill', 50, 'มือปราบทรชน', '#f9e79f', 'ปราบหัวแดง 50 คน'),
  pvp('merit1000', 'merit', 1000, 'ผู้ทรงบุญญาธิการ', '#ffe08a', 'สะสมบุญ 1,000 แต้ม'),
  pvp('pk1', 'pkKill', 1, 'มือเปื้อนเลือด', '#e74c3c', 'สังหารผู้บริสุทธิ์ 1 คน'),
  pvp('pk10', 'pkKill', 10, 'ทรชนแห่งพงไพร', '#c0392b', 'สังหารผู้บริสุทธิ์ 10 คน'),
  pvp('pk50', 'pkKill', 50, 'ยมทูตเดินดิน', '#922b21', 'สังหารผู้บริสุทธิ์ 50 คน'),
  { id: 'social', cat: 'social', name: 'เพื่อนเยอะ', color: '#76d7c4', hint: 'มีเพื่อนในรายชื่อ 5 คน', goal: 5, prog: c => c.friends?.length || 0, ok: c => (c.friends?.length || 0) >= 5 },
  kills('lg_hunt20k', 20000, 'ยมบาลเดินดิน', '#ff6b6b', 'legend', true),
  { id: 'lg_deathless', cat: 'legend', glow: true, name: 'ผู้ไม่เคยล้ม', color: '#e5e8e8', hint: 'ถึง Lv 60 โดยหมดสติไม่เกิน 10 ครั้ง', goal: 60, prog: c => c.level, ok: (c, r) => c.level >= 60 && (r.deaths || 0) <= 10 },
  // ---- อันดับเซิร์ฟ: held only while the rank holds (server/ranking.js, every minute) ----
  { id: 'cp_top1', cat: 'rank', dynamic: true, name: 'เจ้าแห่งพลังอันดับหนึ่ง', color: '#ffd700', hint: 'ค่าพลังรวมอันดับ 1', holders: 1, ok: (c, r) => r.cpRank === 1 },
  { id: 'cp_top3', cat: 'rank', dynamic: true, name: 'สามยอดพลังแผ่นดิน', color: '#f0e68c', hint: 'ค่าพลังรวมอันดับ 1–3', holders: 3, ok: (c, r) => r.cpRank >= 1 && r.cpRank <= 3 },
  { id: 'cp_top10', cat: 'rank', dynamic: true, name: 'สิบยอดฝีมือ', color: '#e5e8e8', hint: 'ค่าพลังรวมอันดับ 1–10', holders: 10, ok: (c, r) => r.cpRank >= 1 && r.cpRank <= 10 },
  { id: 'lv_top1', cat: 'rank', dynamic: true, name: 'ผู้นำแห่งเส้นทาง', color: '#5dade2', hint: 'เลเวลอันดับ 1', holders: 1, ok: (c, r) => r.lvRank === 1 },
  { id: 'enh_top1', cat: 'rank', dynamic: true, name: 'เทพเตาหลอม', color: '#bb8fce', hint: 'ตีบวกอันดับ 1', holders: 1, ok: (c, r) => r.enhRank === 1 },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map(t => [t.id, t]));
// the best rank title a rank earns (shown on the ranking boards)
export const rankTitleOf = rec => TITLES.find(t => t.dynamic && t.ok({}, rec)) ?? null;

// New titles the character has earned → their ids; a rank title it no longer holds is taken back
// (and taken off if worn).
export function checkTitles(c) {
  const rec = c.rec ?? {}, got = [];
  for (const t of TITLES) {
    const has = c.titles.includes(t.id);
    if (!has && t.ok(c, rec)) { c.titles.push(t.id); got.push(t.id); }
    else if (has && t.dynamic && !t.ok(c, rec)) { c.titles = c.titles.filter(x => x !== t.id); if (c.title === t.id) c.title = null; }
  }
  return got;
}
