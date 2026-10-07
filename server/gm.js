// GM commands (ported from ThaiNative's /gm): typed in chat by a signed-in account listed in
// ADMIN_IDS (comma separated account ids; set on the server, never in the repo). Every use is
// logged on the server. A GM's own character changes on the server's copy and is sent back.
//
//   gm(ctx, me, text) → reply text (shown to the GM only)
//   ctx: { presence, combatants, worldOf, route, send, toAll, byName, byId, mutes, phase }
//
// Self:   gold n · lv n · exp n · joblv n · stat n · item <id|name> [n] · card <monster> · refine <slot> n ·
//         heal · hp <%> (0 = knocked out, to test reviving) · god · find <text> · map <mapId> [x z]
// Others: who · goto <name> · summon <name> · give <name> <gold|itemId> [n] · kick <name> [why] ·
//         mute <name> [minutes] · unmute <name>
// World:  killall (the monsters of your map and channel, rewards included) · say <text>
import { ITEMS, EQUIP_SLOTS } from '../src/character/data/items.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { MAPS as WORLD_MAPS } from '../src/world/maps.js';
import { MAX_LEVEL, MAX_JOB_LEVEL, expToNext, jobExpToNext } from '../src/character/data/progression.js';
import { REFINE_MAX, refinable } from '../src/character/data/refine.js';
import { cardId, hasCard } from '../src/character/data/cards.js';
import { MAPS } from './presence.js';
import { POINTS_PER_LEVEL } from '../src/character/data/classes.js';

export const admins = (env = process.env.ADMIN_IDS) => new Set(String(env ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const HELP = 'คำสั่ง GM: gold · lv · exp · joblv · stat · item <id|ชื่อ> [n] · card <มอน> · refine <ช่อง> <ขั้น> · heal · hp <%> · god · find <คำ> · map <แมพ> [x z] · who · goto/summon <ชื่อ> · give <ชื่อ> <gold|id> [n] · kick <ชื่อ> · mute <ชื่อ> [นาที] · unmute <ชื่อ> · killall · say <ข้อความ>';
const int = (v, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : d; };
const itemId = q => (ITEMS[q] ? q : Object.keys(ITEMS).find(k => ITEMS[k].name === q));

export function gm(ctx, me, text) {
  const { presence, combatants, send, byName, byId } = ctx;
  const [cmd = 'help', ...args] = String(text).trim().split(/\s+/).slice(1);
  const s = combatants.get(me.id), c = s?.c;
  const log = what => console.log(`[gm] ${me.name} (${me.account}): ${what}`);
  const mine = () => { if (!s?.persist) return 'ต้องเข้าสู่ระบบด้วยตัวละครที่บันทึกไว้'; return null; };
  const changed = () => { s.dirty = true; const w = byId(me.id)?.ws; if (w) send(w, { t: 'sync', c: combatants.me(me.id) }); };
  const other = () => { const t = byName(args[0]); return t ? { t } : { err: args[0] ? `ไม่พบผู้เล่น "${args[0]}" ที่ออนไลน์` : 'ใส่ชื่อผู้เล่น' }; };
  const tell = (t, msg) => send(t.ws, { t: 'c', id: null, name: '🛠️ GM', text: msg });
  switch (cmd.toLowerCase()) {
    case 'help': return HELP;
    case 'gold': { const e = mine(); if (e) return e; const n = int(args[0], 10000); c.gold = Math.max(0, Math.min(999999999, c.gold + n)); changed(); log(`gold ${n}`); return `ทอง → ${c.gold.toLocaleString()}`; }
    case 'lv': case 'joblv': {
      const e = mine(); if (e) return e;
      const job = cmd === 'joblv', n = Math.max(1, Math.min(job ? MAX_JOB_LEVEL : MAX_LEVEL, int(args[0], 10)));
      if (job) { while (c.jobLevel < n) c.gainJobExp(jobExpToNext(c.jobLevel) - c.jobExp); }
      else while (c.level < n) c.gainExp(expToNext(c.level) - c.exp);
      if (!job) { const r = presence.setLevel(byId(me.id).ws, c.level); if (r) ctx.toMap(me.room, { t: 'lv', ...r }); }
      changed(); log(`${cmd} ${n}`); return job ? `Job Lv → ${c.jobLevel}` : `เลเวล → ${c.level} (แต้ม ${c.points})`;
    }
    case 'exp': { const e = mine(); if (e) return e; const n = Math.max(1, int(args[0], 1000)); c.gainExp(n); changed(); log(`exp ${n}`); return `+EXP ${n} · Lv.${c.level}`; }
    case 'stat': { const e = mine(); if (e) return e; const n = Math.max(1, int(args[0], 10)); c.points += n; changed(); log(`stat ${n}`); return `แต้มสถานะ → ${c.points}`; }
    case 'item': case 'card': {
      const e = mine(); if (e) return e;
      const id = cmd === 'card' ? (hasCard(args[0]) ? cardId(args[0]) : null) : itemId(args[0]);
      if (!id) return cmd === 'card' ? `ไม่พบการ์ดของ "${args[0] ?? ''}" (ใส่ id มอน เช่น boar)` : `ไม่พบไอเทม "${args[0] ?? ''}" (ลอง /gm find)`;
      const n = Math.max(1, Math.min(999, int(args[1], 1)));
      if (!c.addItem(id, n)) { changed(); return 'กระเป๋าเต็มหรือหนักเกิน (ได้บางส่วน)'; }
      changed(); log(`item ${id} x${n}`); return `ได้รับ ${ITEMS[id].name} ×${n}`;
    }
    case 'refine': {
      const e = mine(); if (e) return e;
      const slot = args[0], n = Math.max(0, Math.min(REFINE_MAX, int(args[1], 4)));
      if (!EQUIP_SLOTS.includes(slot) || !c.equipment[slot]) return `ใส่ช่องที่สวมอยู่: ${EQUIP_SLOTS.join(' / ')}`;
      if (!refinable(ITEMS[c.equipment[slot]])) return 'ช่องนี้ตีบวกไม่ได้';
      c.refine[slot] = n; changed(); log(`refine ${slot} ${n}`); return `${ITEMS[c.equipment[slot]].name} → +${n}`;
    }
    case 'heal': { const e = mine(); if (e) return e; c.hp = c.maxHp; c.mp = c.maxMp; changed(); ctx.send(byId(me.id).ws, { t: 'gmhp', pct: 100, mp: true }); return 'ฟื้น HP/MP เต็ม'; }
    case 'hp': {
      const e = mine(); if (e) return e;
      const pct = Math.max(0, Math.min(100, int(args[0], 100)));
      c.hp = Math.round(c.maxHp * pct / 100); if (!pct) presence.setDead(byId(me.id).ws, true);
      changed(); ctx.send(byId(me.id).ws, { t: 'gmhp', pct }); return pct ? `HP → ${pct}%` : 'หมดสติ (ทดสอบชุบชีวิต)';
    }
    case 'god': { if (!s) return 'ยังไม่มีตัวละครบนเซิร์ฟเวอร์'; s.god = !s.god; log(`god ${s.god}`); return s.god ? 'โหมดอมตะ: เปิด (มอนตีไม่เข้า · หายเมื่อออกเกม)' : 'โหมดอมตะ: ปิด'; }
    case 'find': {
      const q = args.join(' ').toLowerCase(); if (!q) return 'ใส่คำค้น';
      const hits = Object.keys(ITEMS).filter(k => k.includes(q) || ITEMS[k].name.toLowerCase().includes(q));
      const mons = Object.keys(MONSTERS).filter(k => k.includes(q) || MONSTERS[k].name.includes(q));
      return `ไอเทม ${hits.length}: ${hits.slice(0, 12).map(k => `${ITEMS[k].name} (${k})`).join(' · ') || '-'}${mons.length ? ` · มอน: ${mons.slice(0, 8).map(k => `${MONSTERS[k].name} (${k})`).join(' · ')}` : ''}`;
    }
    case 'map': {
      const map = args[0];
      if (!MAPS.includes(map)) return `แมพ: ${MAPS.join(' / ')}`;
      const spawn = WORLD_MAPS[map]?.spawn ?? { x: 0, z: 0 }, x = int(args[1], spawn.x), z = int(args[2], spawn.z);
      warp(ctx, byId(me.id), map, x, z); log(`map ${map} ${x},${z}`); return `วาร์ปไป ${map}`;
    }
    case 'who': {
      const list = [...presence.players.values()].sort((a, b) => b.lv - a.lv);
      return `ออนไลน์ ${list.length} คน: ${list.map(p => `${p.name} Lv.${p.lv} @${p.map}${p.ch > 1 ? `#${p.ch}` : ''}${p.dead ? ' (หมดสติ)' : ''}`).join(' · ')}`;
    }
    case 'goto': case 'summon': {
      const { t, err } = other(); if (err) return err;
      if (t.p.id === me.id) return 'ใส่ชื่อผู้เล่นคนอื่น';
      const [from, to] = cmd === 'goto' ? [t.p, byId(me.id)] : [me, t];
      warp(ctx, to, from.map, from.x + 1.5, from.z, from.ch);
      if (cmd === 'summon') tell(t, `คุณถูก GM ${me.name} เรียกตัว`);
      log(`${cmd} ${t.p.name}`); return cmd === 'goto' ? `วาร์ปไปหา ${t.p.name}` : `เรียก ${t.p.name} มาแล้ว`;
    }
    case 'give': {
      const { t, err } = other(); if (err) return err;
      const ts = combatants.get(t.p.id); if (!ts?.persist) return 'ผู้เล่นนั้นไม่ได้เข้าสู่ระบบ';
      let got;
      if (String(args[1]).toLowerCase() === 'gold') { const n = Math.max(1, int(args[2], 0)); if (!int(args[2], 0)) return 'ใส่จำนวนทอง'; ts.c.gold = Math.min(999999999, ts.c.gold + n); got = `${n.toLocaleString()} ทอง`; }
      else { const id = itemId(args[1]); if (!id) return `ไม่พบไอเทม "${args[1] ?? ''}"`; const n = Math.max(1, Math.min(999, int(args[2], 1))); ts.c.addItem(id, n); got = `${ITEMS[id].name} ×${n}`; }
      ts.dirty = true; send(t.ws, { t: 'sync', c: combatants.me(t.p.id) }); tell(t, `ได้รับ ${got} จาก GM`);
      log(`give ${t.p.name} ${got}`); return `ให้ ${t.p.name}: ${got}`;
    }
    case 'kick': {
      const { t, err } = other(); if (err) return err;
      if (t.p.admin) return 'เตะ GM ด้วยกันไม่ได้';
      const why = args.slice(1).join(' ').slice(0, 100);
      send(t.ws, { t: 'kicked', why: `ถูก GM เตะออกจากเกม${why ? ` · ${why}` : ''}` }); setTimeout(() => t.ws.close(), 300);
      log(`kick ${t.p.name} ${why}`); return `เตะ ${t.p.name} แล้ว`;
    }
    case 'mute': case 'unmute': {
      const { t, err } = other(); if (err) return err;
      const min = cmd === 'mute' ? Math.max(1, Math.min(10080, int(args[1], 10))) : 0, key = t.p.account ?? `s${t.p.id}`;
      if (min) ctx.mutes.set(key, Date.now() + min * 60000); else ctx.mutes.delete(key);
      tell(t, min ? `คุณถูกห้ามแชท ${min} นาที` : 'คุณแชทได้ตามปกติแล้ว');
      log(`${cmd} ${t.p.name} ${min || ''}`); return min ? `ห้าม ${t.p.name} แชท ${min} นาที` : `ปลดห้ามแชท ${t.p.name}`;
    }
    case 'killall': {
      const w = ctx.worldOf(me.room), players = presence.inMap(me.room);
      let n = 0;
      for (const m of w.monsters) if (m.hp > 0) { n++; ctx.route(me.room, w.damage(m, me.id, m.hp + 1, {}, players, ctx.phase() === 'night')); }
      log(`killall ${n}`); return n ? `ฆ่ามอนในแมพนี้ ${n} ตัว` : 'ไม่มีมอนให้ฆ่า';
    }
    case 'say': {
      const msg = args.join(' ').slice(0, 160); if (!msg) return 'ใส่ข้อความ';
      ctx.toAll({ t: 'c', id: null, name: '📢 ประกาศ', text: msg, kind: 'news' }); log(`say ${msg}`); return 'ประกาศแล้ว';
    }
  }
  return `ไม่รู้จักคำสั่ง "${cmd}" · ${HELP}`;
}

// moves a player (by the server, so the speed check lets it through): another map or a spot here
function warp(ctx, who, map, x, z, ch = null) {
  if (!who) return;
  const p = who.p;
  if (p.map === map && (ch == null || ch === p.ch)) { Object.assign(p, { x, z, t: ctx.presence.now(), dirty: true }); }
  else if (ch != null && p.map === map) { ctx.moveTo(who.ws, ch, 'gm'); Object.assign(p, { x, z }); }
  ctx.send(who.ws, { t: 'gmwarp', map, x, z });
}

// ---- one-character commands (runGm) and the admin list with GM_ID --------------------------
// adminIds(env) → Set of account ids from ADMIN_IDS plus GM_ID (the account server/index.js makes
// at boot from GM_ID + GM_PASSWORD). runGm(c, text) → { ok, msg, level?, say? } acts on one
// Character only; gm() above is what the chat runs.
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
