// The social window's friends, titles and ranking tabs (design "UI ใหม่"), as HTML from the
// state Social.js keeps. No events here: Social.js reads the data-* attributes on click.
//   friendsPane(st) · titlesPane(st) · rankPane(st)
import { CLASSES } from '../character/data/classes.js';
import { classBadge } from '../ui/icons.js';
import { titleHtml } from '../ui/titleTag.js';
import { TITLES, TITLE_BY_ID, TITLE_CATS } from '../data/titles.js';
import { FRIENDS_MAX } from '../character/Character.js';

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const MAP_TH = { city: 'นครอโยธยา', paddy: 'ทุ่งนาข้าว', deep_forest: 'ป่าลึก', wat_rang: 'วัดร้าง', klong: 'คลองหนองบึง' };
const fmt = n => Math.round(n || 0).toLocaleString();
const por = (cls, size = 36, off = false) => `<span class="sw-por${off ? ' off' : ''}">${classBadge(cls, CLASSES[cls], { size })}</span>`;
const clsName = cls => CLASSES[cls]?.name ?? '';
const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? 'เมื่อสักครู่' : s < 3600 ? `${Math.floor(s / 60)} นาทีที่แล้ว` : `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`; };

// ---- เพื่อน ----------------------------------------------------------------------------
// st: { friends, filter, search, party, me, nearby: [{ id, name, cls, lv, dist }], notes: [{ kind, name, cls, at }] }
export function friendsPane(st) {
  const inParty = new Set(st.party?.members.map(p => p.id) ?? []), mine = inParty.has(st.me);
  const q = st.search.trim().toLowerCase();
  const list = st.friends.filter(f => (st.filter === 'all' || f.online) && (!q || f.name.toLowerCase().includes(q)))
    .sort((a, b) => b.online - a.online || (b.lv ?? 0) - (a.lv ?? 0));
  const rows = list.map(f => {
    const same = f.online && mine && inParty.has(f.id);
    const where = f.online ? [MAP_TH[f.map] ?? f.map, same ? 'ปาร์ตี้เดียวกัน' : ''].filter(Boolean).join(' · ') : 'ออฟไลน์';
    const acts = f.online ? `<button class="sw-btn blue" data-w="${esc(f.name)}">กระซิบ</button>${same ? '<button class="sw-btn line" disabled>อยู่ในปาร์ตี้</button>' : `<button class="sw-btn dark" data-inv="${f.id}">ชวนปาร์ตี้</button>`}` : '';
    return `<div class="sw-frow${f.online ? '' : ' off'}"><i class="sw-dot"></i>${por(f.cls, 36, !f.online)}
      <span class="sw-who"><span class="sw-nm">${titleHtml(f.title)}<b>${esc(f.name)}</b></span><small>${f.cls ? `${clsName(f.cls)} Lv ${f.lv ?? '?'} · ` : ''}${esc(where)}</small></span>
      <span class="sw-acts">${acts}<button class="sw-x" data-fdel="${esc(f.name)}" title="ลบเพื่อน">×</button></span></div>`;
  }).join('');
  const friendNames = new Set(st.friends.map(f => f.name));
  const near = st.nearby.filter(p => !friendNames.has(p.name)).slice(0, 4).map(p => `<div class="sw-mini">${por(p.cls, 30)}<span class="sw-who"><b>${titleHtml(p.title)}${esc(p.name)}</b><small>${clsName(p.cls)} Lv ${p.lv} · ห่าง ${Math.round(p.dist)} ม.</small></span><button class="sw-btn blue sm" data-fadd="${esc(p.name)}">+ เพื่อน</button></div>`).join('');
  const notes = st.notes.slice(0, 5).map(n => `<div class="sw-mini">${por(n.cls, 30)}<span class="sw-who"><b>${esc(n.name)} ${n.kind === 'added' ? 'เพิ่มคุณเป็นเพื่อน' : 'ออนไลน์แล้ว'}</b><small>${ago(n.at)}</small></span>${n.kind === 'added' && !friendNames.has(n.name) ? `<button class="sw-btn blue sm" data-fadd="${esc(n.name)}">เพิ่มกลับ</button>` : ''}</div>`).join('');
  const demo = st.nearby[0] ?? { name: 'ทองดี', cls: 'muaythai', lv: 12 };
  return `<div class="sw-cols">
    <section class="sw-box sw-main"><div class="sw-bar"><b class="sw-h">เพื่อน ${st.friends.length} / ${FRIENDS_MAX}</b>
      <span class="sw-seg"><button data-ff="all" class="${st.filter === 'all' ? 'on' : ''}">ทั้งหมด</button><button data-ff="on" class="${st.filter === 'on' ? 'on' : ''}">ออนไลน์</button></span>
      <label class="sw-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg><input data-fsearch placeholder="ค้นหาเพื่อน" value="${esc(st.search)}"></label></div>
      <div class="sw-list">${rows || `<p class="sw-empty">${st.friends.length ? 'ไม่พบเพื่อนที่ตรงกับที่ค้นหา' : 'ยังไม่มีเพื่อน · เพิ่มจากผู้เล่นใกล้คุณ หรือพิมพ์ชื่อทางขวา (ต้องเข้าสู่ระบบ)'}</p>`}</div></section>
    <aside class="sw-side">
      <section class="sw-box"><b class="sw-h">เพิ่มเพื่อน</b>
        <div class="sw-add"><input data-fname placeholder="พิมพ์ชื่อตัวละคร..." maxlength="16"><button class="sw-btn blue" data-fname-go>เพิ่ม</button></div>
        <small class="sw-sub">ผู้เล่นใกล้คุณ</small>${near || '<p class="sw-empty sm">ไม่มีผู้เล่นอื่นอยู่ใกล้ ๆ</p>'}
        <p class="sw-note">เพิ่มได้ทันทีไม่ต้องรอตอบรับ อีกฝ่ายจะได้รับแจ้ง และกดเพิ่มกลับได้ เพื่อนสูงสุด ${FRIENDS_MAX} คน</p></section>
      <section class="sw-box"><b class="sw-h">แจ้งเตือน</b>${notes || '<p class="sw-empty sm">ยังไม่มีอะไรใหม่</p>'}</section>
      <section class="sw-box"><b class="sw-h">คลิกชื่อผู้เล่นในโลก</b>
        <div class="sw-demo"><header>${esc(demo.name)} · ${clsName(demo.cls)} Lv ${demo.lv}</header><span>กระซิบ</span><span>เพิ่มเพื่อน</span><span>ชวนเข้าปาร์ตี้</span><span class="on">ขอแลกของ</span></div></section>
    </aside></div>`;
}

// ---- ฉายา ----------------------------------------------------------------------------
// st: { c (Character), cat, sel }
const own = t => !t.dynamic;
export const titleCount = c => ({ got: TITLES.filter(t => own(t) && c.titles.includes(t.id)).length, all: TITLES.filter(own).length });
export function titlesPane(st) {
  const c = st.c, rec = c.rec ?? {}, held = id => c.titles.includes(id);
  const cats = TITLE_CATS.filter(([k]) => k !== 'rank' || TITLES.some(t => t.cat === 'rank' && held(t.id)));
  const inCat = k => TITLES.filter(t => t.cat === k && (k !== 'rank' || held(t.id)));
  const { got, all } = titleCount(c);
  const side = [`<button data-tcat="all" class="${st.cat === 'all' ? 'on' : ''}"><span>ทั้งหมด</span><b>${got} / ${all}</b></button>`,
    ...cats.map(([k, name]) => { const list = inCat(k); return `<button data-tcat="${k}" class="${st.cat === k ? 'on' : ''}"><span>${name}</span><b>${list.filter(t => held(t.id)).length} / ${list.length}</b></button>`; })].join('');
  const shown = st.cat === 'all' ? TITLES.filter(t => own(t) || held(t.id)) : inCat(st.cat);
  const cards = shown.map(t => {
    const has = held(t.id), worn = c.title === t.id, prog = !has && t.goal ? Math.min(t.goal, t.prog(c, rec)) : null;
    const state = worn ? '<i class="st worn">ใช้อยู่</i>' : has ? '<i class="st got">ได้แล้ว</i>' : '<i class="st lock">ล็อก</i>';
    return `<button class="sw-tcard${has ? ' has' : ''}${t.glow ? ' glow' : ''}${st.sel === t.id ? ' sel' : ''}" data-tsel="${t.id}" style="--ttl:${t.color}">
      <span class="tn">${t.name}</span>${state}<small>${t.hint}</small>
      ${prog !== null ? `<span class="sw-prog"><i style="width:${(prog / t.goal * 100).toFixed(1)}%"></i></span><small class="pv">${fmt(prog)} / ${fmt(t.goal)}</small>` : ''}</button>`;
  }).join('');
  const t = TITLE_BY_ID[st.sel] ?? TITLE_BY_ID[c.title], has = t && held(t.id), worn = t && c.title === t.id;
  const hpPct = c.maxHp ? Math.round(c.hp / c.maxHp * 100) : 100;
  const action = !t ? '' : worn ? '' : has ? `<button class="sw-btn gold wide" data-twear="${t.id}">ใช้ฉายานี้</button>` : '<button class="sw-btn line wide" disabled>ยังไม่ได้รับฉายานี้</button>';
  return `<div class="sw-cols t3">
    <div class="sw-cats" role="tablist">${side}</div>
    <section class="sw-box sw-tgrid">${cards}</section>
    <aside class="sw-box sw-preview">
      <div class="pv-plate">${t ? titleHtml(t.id) : '<em class="ttl none">ไม่แสดงฉายา</em>'}<b>${esc(c.name)}</b><span class="pv-hp"><i style="width:${hpPct}%"></i></span></div>
      <span class="pv-por">${classBadge(c.classId, CLASSES[c.classId], { size: 110 })}</span>
      <p class="pv-chat">${t ? titleHtml(t.id, { brackets: true }) : ''} <b>${esc(c.name)}:</b> ไปป่าลึกกันไหม</p>
      <p class="sw-note">ฉายาแสดงเหนือชื่อตัวละครและในแชท ทุกคนเห็น · ไม่เพิ่มค่าพลัง</p>
      <span class="sw-fill"></span>${action}
      ${c.title ? '<button class="sw-btn dark wide" data-twear="">ไม่แสดงฉายา</button>' : ''}</aside></div>`;
}

// ---- อันดับ ----------------------------------------------------------------------------
// st: { data: rank message | null, board: 'power' | 'level' | 'enhance', cls: 'all' | class id, name (mine), loading }
const BOARDS = [['power', 'ค่าพลังรวม'], ['level', 'เลเวล'], ['enhance', 'ตีบวก']];
const value = (board, r) => (board === 'power' ? fmt(r.cp) : board === 'level' ? `Lv ${r.lv}` : `+${r.enh}`);
const COL = { power: 'ค่าพลังรวม', level: 'ค่าพลังรวม', enhance: 'ตีบวกสูงสุด' };
export function rankPane(st) {
  const d = st.data;
  const pills = `<span class="sw-seg">${BOARDS.map(([k, n]) => `<button data-rb="${k}" class="${st.board === k ? 'on' : ''}">${n}</button>`).join('')}</span>
    <span class="sw-seg">${[['all', 'ทุกอาชีพ'], ...Object.keys(CLASSES).map(k => [k, CLASSES[k].name])].map(([k, n]) => `<button data-rc="${k}" class="${st.cls === k ? 'on' : ''}">${n}</button>`).join('')}</span>`;
  if (!d) return `<div class="sw-rank"><div class="sw-bar">${pills}</div><p class="sw-empty">${st.loading ? 'กำลังโหลดตารางอันดับ…' : 'ยังไม่มีข้อมูลอันดับ'}</p></div>`;
  const list = (d[st.board] ?? []).filter(r => st.cls === 'all' || r.cls === st.cls);
  const podium = [1, 0, 2].map(i => list[i] && `<div class="sw-pod p${i + 1}"><i class="rk">${i + 1}</i>${por(list[i].cls, 64)}${titleHtml(list[i].title)}<b>${esc(list[i].name)}</b><small>${clsName(list[i].cls)} · Lv ${list[i].lv}</small><strong>${value(st.board, list[i])}</strong></div>`).join('');
  const meAt = list.findIndex(r => r.name === st.name);
  const row = (r, n, me = false) => `<div class="sw-rrow${me ? ' me' : ''}"><span class="rk">${n}</span><span class="nm">${por(r.cls, 26)}${titleHtml(r.title)}<b>${esc(r.name)}${me ? ' (คุณ)' : ''}</b></span><span>${clsName(r.cls)}</span><span>Lv ${r.lv}</span><span class="v">${st.board === 'level' ? fmt(r.cp) : value(st.board, r)}</span></div>`;
  const top = list.slice(3, 8).map((r, i) => row(r, i + 4, i + 3 === meAt)).join('');
  const myGlobal = d.me && { power: d.me.cpRank, level: d.me.lvRank, enhance: d.me.enhRank }[st.board];
  const mine = meAt >= 8 ? row(list[meAt], meAt + 1, true)
    : meAt < 0 && st.cls === 'all' && myGlobal ? row({ name: st.name, cls: st.myCls, lv: d.me.lv, cp: d.me.cp, enh: d.me.enh, title: st.myTitle }, myGlobal, true) : '';
  const gapTo = meAt >= 8 ? meAt : myGlobal > 8 ? myGlobal - 1 : 0;
  const me = d.me;
  const rankLine = (label, r, v) => `<div><span>${label}</span><b>${r ? `#${r} · ${v}` : 'ยังไม่ติดอันดับ'}</b></div>`;
  const holders = TITLES.filter(t => t.dynamic).map(t => `<div class="sw-rt"><span><b style="color:${t.color}">${t.name}</b><small>${t.hint}</small></span><em>${d.holders?.[t.id] ?? 0} คน</em></div>`).join('');
  return `<div class="sw-cols r2"><div class="sw-rank">
    <div class="sw-bar">${pills}</div><p class="sw-meta">อัปเดตทุก 1 นาที · ทั้งเซิร์ฟ ${fmt(d.total)} ตัวละคร</p>
    ${list.length ? `<div class="sw-pods">${podium}</div>
    <section class="sw-box sw-table"><div class="sw-rrow hd"><span>อันดับ</span><span>ชื่อ</span><span>อาชีพ</span><span>เลเวล</span><span>${COL[st.board]}</span></div>
      ${top}${mine ? `${gapTo >= 9 ? `<p class="sw-gap">··· อันดับ 9 – ${gapTo} ···</p>` : ''}${mine}` : ''}</section>` : '<p class="sw-empty">ยังไม่มีใครในตารางนี้</p>'}</div>
    <aside class="sw-side">
      <section class="sw-box sw-mine"><b class="sw-h">อันดับของคุณ</b>${me ? `${rankLine('ค่าพลังรวม', me.cpRank, fmt(me.cp))}${rankLine('เลเวล', me.lvRank, `Lv ${me.lv}`)}${rankLine('ตีบวก', me.enhRank, `+${me.enh}`)}
        <div><span>ห่างจากอันดับ 10</span><b class="${me.gap10 ? 'bad' : 'ok'}">${me.cpRank && me.cpRank <= 10 ? 'อยู่ในสิบอันดับแรก' : `อีก ${fmt(me.gap10)} พลัง`}</b></div>` : '<p class="sw-empty sm">เข้าสู่ระบบเพื่อติดอันดับ (ผู้เล่นทั่วไปไม่ถูกจัดอันดับ)</p>'}</section>
      <section class="sw-box"><b class="sw-h">ฉายาอันดับ</b>${holders}<p class="sw-note">ถือครองได้เฉพาะตอนอยู่ในอันดับ หลุดอันดับแล้วฉายาจะถูกถอดเอง</p></section>
    </aside></div>`;
}
