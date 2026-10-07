// GM commands for admin accounts, typed into the chat as `/gm …`. An admin is an account id
// listed in ADMIN_IDS (comma separated). GM_ID + GM_PASSWORD make that account at boot when
// it does not exist yet (the memory store forgets every account on restart).
// They act on the server's copy of a signed-in character (server/progress.js); the browser
// gets it back with a `sync`.
//   adminIds(env) → Set of account ids
//   runGm(c, text) → { ok, msg, level?, say? } (c: Character)
import { ITEMS } from '../src/character/data/items.js';
import { POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { MAX_LEVEL } from '../src/character/data/progression.js';

export const GM_PREFIX = /^\/gm(\s|$)/i;
export const GM_HELP = '/gm gold [n] · level <n> · exp [n] · item <id> [n] · find <ชื่อ> · points [n] · say <ข้อความ>';

export const adminIds = (env = process.env) =>
  new Set([...String(env.ADMIN_IDS ?? '').split(','), env.GM_ID ?? ''].map(s => s.trim().toLowerCase()).filter(Boolean));

const num = (v, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : d; };

export function runGm(c, text) {
  const [cmd = 'help', a1, a2] = String(text).replace(GM_PREFIX, '').trim().split(/\s+/);
  const rest = String(text).replace(GM_PREFIX, '').trim().slice(cmd.length).trim();
  switch (cmd.toLowerCase()) {
    case 'gold': c.gold = Math.min(999999999, c.gold + num(a1, 100000)); return { ok: true, msg: `เงิน → ฿${c.gold.toLocaleString()}` };
    case 'level': case 'lv': {
      const to = Math.max(1, Math.min(MAX_LEVEL, num(a1, c.level)));
      c.points = Math.max(0, c.points + (to - c.level) * POINTS_PER_LEVEL); c.level = to; c.exp = 0;
      c.hp = c.maxHp; c.mp = c.maxMp;
      return { ok: true, msg: `เลเวล → Lv.${c.level} (แต้มสถานะ ${c.points})`, level: c.level };
    }
    case 'exp': { const before = c.level; c.gainExp(num(a1, 1000)); return { ok: true, msg: `+EXP ${num(a1, 1000)} → Lv.${c.level}`, level: c.level !== before ? c.level : undefined }; }
    case 'item': {
      if (!ITEMS[a1]) return { ok: false, msg: `ไม่มีไอเทม "${a1 ?? ''}" · ใช้ /gm find <ชื่อ>` };
      const q = Math.min(9999, num(a2, 1));
      return c.addItem(a1, q) ? { ok: true, msg: `ได้รับ ${ITEMS[a1].name} x${q}` } : { ok: false, msg: 'กระเป๋าเต็มหรือน้ำหนักเกิน' };
    }
    case 'find': {
      const q = rest.toLowerCase(); if (!q) return { ok: false, msg: 'ใช้: /gm find <ชื่อหรือ id บางส่วน>' };
      const hits = Object.keys(ITEMS).filter(k => k.includes(q) || ITEMS[k].name.toLowerCase().includes(q));
      return { ok: true, msg: hits.length ? hits.slice(0, 15).map(k => `${ITEMS[k].name} (${k})`).join(' · ') : 'ไม่พบ' };
    }
    case 'points': c.points += num(a1, 10); return { ok: true, msg: `แต้มสถานะ → ${c.points}` };
    case 'say': return rest ? { ok: true, msg: 'ประกาศแล้ว', say: rest.slice(0, 120) } : { ok: false, msg: 'ใช้: /gm say <ข้อความ>' };
    default: return { ok: true, msg: GM_HELP };
  }
}
