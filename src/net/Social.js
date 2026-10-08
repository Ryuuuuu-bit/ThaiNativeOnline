// Parties and trade on the client (server/parties.js, server/trades.js; messages in server/index.js).
//   · click another player's name plate: ชวนเข้าปาร์ตี้ · ขอแลกเปลี่ยน
//   · an invite or a trade request pops up with ตอบรับ / ปฏิเสธ
//   · the party frames under the player frame (design "UI ใหม่"): the other members' portrait,
//     HP / MP, who leads, far ones greyed with their map; the EXP bonus now. Click → the party tab
//   · the trade window: my offer and theirs, my bag to add from, gold; ล็อก → ยืนยัน (both sides)
//   · party chat: start a chat line with /p · /w name text whispers · /r answers
//   · P (or เมนู → สังคม): the social window — ปาร์ตี้ (member cards: HP / MP, buffs, where, near → shares EXP;
//     whisper, hand over the lead, remove, leave) · เพื่อน (signed in: list, search, add by name, players
//     near you, notices) · ฉายา (src/data/titles.js: earn, preview, wear) · อันดับ (server/ranking.js boards);
//     the three tabs are drawn by src/net/SocialPanes.js
//   · a healer's party / revive skill heals, buffs and stands up the members near them (aid)
//   attachSocial(net, character, chat, remote)
import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { CLASSES } from '../character/data/classes.js';
import { BUFF_ICONS } from '../combat/data/skills.js';
import { iconHtml, classBadge } from '../ui/icons.js';
import { sameGear } from '../character/data/refine.js';
import { draggable } from '../ui/draggable.js';
import { TITLE_BY_ID } from '../data/titles.js';
import { friendsPane, titlesPane, rankPane, titleCount, MAP_TH } from './SocialPanes.js';
import './social.css';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PARTY_WHY = { guest: 'ผู้เล่นแบบผู้มาเยือนตั้งปาร์ตี้กับผู้เล่นที่เข้าสู่ระบบไม่ได้', self: 'ชวนตัวเองไม่ได้', in_party: 'ผู้เล่นนั้นอยู่ในปาร์ตี้อื่นแล้ว', not_leader: 'หัวหน้าปาร์ตี้เท่านั้นที่ชวนได้', full: 'ปาร์ตี้เต็มแล้ว (6 คน)', expired: 'คำเชิญหมดอายุแล้ว', offline: 'ผู้เล่นนั้นออฟไลน์', declined: 'ปฏิเสธคำเชิญปาร์ตี้' };
const TRADE_WHY = { self: 'แลกกับตัวเองไม่ได้', busy: 'ตอนนี้แลกเปลี่ยนไม่ได้ (กำลังต่อสู้ หมดสติ หรือแลกกับคนอื่นอยู่)', offline: 'ผู้เล่นนั้นออฟไลน์', guest: 'ต้องเข้าสู่ระบบทั้งสองฝ่ายจึงแลกเปลี่ยนได้', far: 'ต้องยืนใกล้กัน (ไม่เกิน 8 เมตร) ในแชนแนลเดียวกัน', expired: 'คำขอหมดอายุแล้ว', declined: 'อีกฝ่ายปฏิเสธการแลกเปลี่ยน',
  gold: 'ทองไม่พอ', missing: 'ไม่มีของนั้นในกระเป๋าแล้ว', bad_offer: 'ข้อเสนอไม่ถูกต้อง', room_a: 'กระเป๋าหรือน้ำหนักไม่พอรับของ', room_b: 'กระเป๋าหรือน้ำหนักไม่พอรับของ',
  cancelled: 'ยกเลิกการแลกเปลี่ยน', moved: 'การแลกเปลี่ยนถูกยกเลิก (ย้ายแมพหรือแชนแนล)', left: 'อีกฝ่ายออกจากเกม · ยกเลิกการแลกเปลี่ยน' };
const label = e => `${e.plus ? `+${e.plus} ` : ''}${ITEMS[e.id]?.name ?? e.id}${e.qty > 1 ? ` ×${e.qty}` : ''}${e.cards?.length ? ` ❖${e.cards.length}` : ''}`;
// an HP / MP bar (empty when the server does not know it: a guest's)
const bar = (kind, v, max, nums = false) => (max ? `<em class="soc-bar ${kind}"><i style="width:${(Math.max(0, Math.min(1, v / max)) * 100).toFixed(0)}%"></i>${nums ? `<b>${v} / ${max}</b>` : ''}</em>` : `<em class="soc-bar ${kind} none"></em>`);
const buffsHtml = ids => (ids ?? []).map(id => `<span title="${esc(id)}">${iconHtml(BUFF_ICONS[id] ?? { icon: '✧' })}</span>`).join('');
const PREFS_KEY = 'thainative.party';
const prefs = (() => { try { return { buffNote: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { buffNote: true }; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ } };

export function attachSocial(net, c, chat, remote, game = null) {
  const app = document.getElementById('app') ?? document.body;
  const node = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; app.append(d); return d; };
  let me = null, party = null, trade = null;
  net.on('welcome', m => { me = m.you; });

  // ---- the menu on another player's name plate ----
  const menu = node('soc-menu glass'); menu.hidden = true;
  remote.onPick = (r, x, y) => {
    if (party?.members.some(p => p.id === r.id)) setAlly(r.id);   // a party member's name: also the friend heals go to
    menu.innerHTML = `<header>${esc(r.name)} · ${CLASSES[r.cls]?.name ?? ''} Lv ${r.lv}</header>
      <button data-act="w">กระซิบ</button><button data-act="fadd">เพิ่มเพื่อน</button><button data-act="pinv">ชวนเข้าปาร์ตี้</button><button data-act="treq">ขอแลกของ</button><button data-act="duel_request">ท้าดวล</button><button data-act="pvp_target">เลือกเป้าหมาย PK</button>`;
    menu.dataset.id = r.id; menu.dataset.name = r.name; menu.style.left = `${Math.max(90, Math.min(innerWidth - 90, x))}px`; menu.style.top = `${Math.max(8, Math.min(innerHeight - 140, y))}px`; menu.hidden = false;
  };
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    menu.hidden = true;
    if (b.dataset.act === 'w') { chat.open(`/w ${menu.dataset.name} `); return; }
    if (b.dataset.act === 'fadd') { net.send({ t: 'fadd', name: menu.dataset.name }); return; }
    if (b.dataset.act === 'pvp_target') { game.net?.social?.pvp?.pick(Number(menu.dataset.id),menu.dataset.name); return; }
    net.send({ t: b.dataset.act, id: Number(menu.dataset.id) });
    chat.add('ระบบ', b.dataset.act === 'pinv' ? 'ส่งคำเชิญปาร์ตี้แล้ว' : b.dataset.act === 'duel_request' ? 'ส่งคำท้าดวลแล้ว' : 'ส่งคำขอแลกเปลี่ยนแล้ว');
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.plate.is-player')) menu.hidden = true; });

  // ---- invites and requests ----
  const asks = node('soc-asks');
  const ask = (key, text, yes, no, secs) => {
    asks.querySelector(`[data-ask="${key}"]`)?.remove();   // one card per sender: a repeated invite replaces the old one
    const card = document.createElement('div'); card.className = 'soc-ask glass'; card.dataset.ask = key;
    card.innerHTML = `<p>${text}</p><div><button data-a="1">ตอบรับ</button><button data-a="0">ปฏิเสธ</button></div>`;
    const done = ok => { card.remove(); (ok ? yes : no)(); };
    card.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); });
    setTimeout(() => card.remove(), secs * 1000);   // unanswered: it just goes (the server lets it expire; no "declined")
    asks.append(card);
  };
  net.on('pinv', m => ask(`p${m.from}`, `<b>${esc(m.name)}</b> ชวนคุณเข้าปาร์ตี้`, () => net.send({ t: 'pans', from: m.from, ok: true }), () => net.send({ t: 'pans', from: m.from, ok: false }), 55));
  net.on('treq', m => ask(`t${m.from}`, `<b>${esc(m.name)}</b> ขอแลกเปลี่ยนกับคุณ`, () => net.send({ t: 'tans', from: m.from, ok: true }), () => net.send({ t: 'tans', from: m.from, ok: false }), 28));
  net.on('pno', m => chat.add('ระบบ', `${m.name ? `${m.name}: ` : ''}${PARTY_WHY[m.why] ?? 'ทำไม่ได้'}`));
  net.on('tno', m => chat.add('ระบบ', TRADE_WHY[m.why] ?? 'แลกเปลี่ยนไม่ได้'));

  // ---- the party frame ----
  const frame = node('soc-party'); frame.hidden = true;
  draggable(frame, { key: 'party', lockable: true });   // movable like the chat box; the padlock in its title bar (phones start locked)
  const CROWN = '<i class="soc-crown" title="หัวหน้าปาร์ตี้">♛</i>';
  const self = () => party?.members.find(p => p.id === me);
  // near: same map and channel, alive, within the share range (server/parties.js sharers) → shares the EXP
  const nearOf = p => { const s = self(); return !!s && p.id !== me && !p.dead && p.map === s.map && p.ch === s.ch && Math.hypot(p.x - s.x, p.z - s.z) <= party.share.range; };
  const share = () => {
    const s = self(), near = party.members.filter(nearOf), lv = [s, ...near].filter(Boolean).map(p => p.lv);
    return { near: near.length, even: Math.max(...lv) - Math.min(...lv) <= party.share.gap };
  };
  const renderParty = () => {
    frame.hidden = !party;
    if (party) {
      const sh = share(), bonus = sh.near && sh.even ? ` · EXP +${Math.round(party.share.bonus * sh.near * 100)}%` : sh.near ? ' · เลเวลห่างเกิน แยก EXP' : '';
      frame.innerHTML = `<header title="เปิดหน้าต่างปาร์ตี้ (P)">ปาร์ตี้ ${party.members.length} / 6${bonus}</header>` + party.members.filter(p => p.id !== me).map(p => {
        const near = nearOf(p), where = p.dead ? 'หมดสติ' : near || p.map === self()?.map ? `Lv ${p.lv}` : MAP_TH[p.map] ?? p.map ?? '';
        return `<div class="soc-pf glass${near ? '' : ' far'}${p.dead ? ' dead' : ''}${allyId() === p.id ? ' sel' : ''}" data-id="${p.id}" title="คลิก: เลือกเป็นเป้าฮีล · คลิกอีกครั้งเพื่อเลิกเลือก">${classBadge(p.cls, CLASSES[p.cls])}<div>`
          + `<div class="r1"><b>${p.id === party.leader ? CROWN : ''}${esc(p.name)}</b><small>${esc(where)}</small></div>${bar('hp', p.hp, p.maxHp)}${bar('mp', p.mp, p.maxMp)}</div></div>`;
      }).join('');
    }
    if (tab === 'party') renderSoc();
  };
  let lastPartyId = null;   // across a reconnect: the same party is not "joined" again
  net.on('party', m => {
    const was = party?.id; party = m.id ? m : null;
    if (party && !was && party.id !== lastPartyId) chat.add('ระบบ', 'เข้าร่วมปาร์ตี้แล้ว · พิมพ์ /p นำหน้าเพื่อคุยในปาร์ตี้ · EXP แบ่งกันเมื่อล่าใกล้กัน');
    if (!party && was) chat.add('ระบบ', 'ออกจากปาร์ตี้แล้ว');
    if (party) lastPartyId = party.id; else if (net.online) lastPartyId = null;
    if (allyId() != null && !party?.members.some(p => p.id === allyId())) setAlly(null);   // the friend picked left the party
    const key = JSON.stringify(m);
    if (key !== lastPartyKey) { lastPartyKey = key; renderParty(); }   // the 1 Hz broadcast redraws only what changed
  });
  let lastPartyKey = '';
  net.on('pc', m => chat.add(`[ปาร์ตี้] ${m.name}`, m.text, 'party'));
  net.on('status', on => { if (!on) { party = null; lastPartyKey = ''; renderParty(); closeTrade(); } });
  // a member's frame picks them as the friend heals go to (again: unpick); the header opens the party tab
  frame.addEventListener('click', e => {
    const pf = e.target.closest('.soc-pf');
    if (pf) { const id = Number(pf.dataset.id); setAlly(allyId() === id ? null : id); return; }
    if (e.target.closest('header')) { tab = 'party'; toggleSoc(true); }
  });

  // ---- the friend a heal goes to (src/training/KitCaster.js allyPick, CombatHUD's green frame) ----
  // Combat.ally = { id } (picked) · Combat.allies() → the party members in this room, where they stand now
  const combatOf = () => game?.game?.combat ?? null;
  const allyId = () => combatOf()?.ally?.id ?? null;
  const allies = () => {
    const s = self(); if (!s) return [];
    return party.members.filter(p => p.id !== me && p.map === s.map && p.ch === s.ch).map(p => {
      const r = remote.list.get(p.id);
      return { id: p.id, name: p.name, cls: p.cls, lv: p.lv, x: r?.x ?? p.x, z: r?.z ?? p.z, hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, alive: !p.dead && !!r };
    });
  };
  function setAlly(id) {
    const cb = combatOf(); if (!cb) return;
    cb.ally = id == null ? null : { id };
    cb.emit('ally', cb.ally);
    renderParty();
  }
  if (combatOf()) combatOf().allies = allies;
  // a healer's party / revive skill reached us (server/index.js support)
  net.on('aid', m => {
    const combat = game?.game?.combat, p = game?.player?.position;
    if (!c.alive) { if (m.revive && combat?.reviveHere(m.revive)) chat.add('ระบบ', `${m.from} ชุบชีวิตคุณ`); return; }
    if (m.heal || m.hp) { const amount = c.heal(c.maxHp * (m.heal || 0) + (m.hp || 0)); if (amount && p) combat?.emit('heal', { amount, x: p.x, z: p.z }); }
    if (m.mp) { c.mp = Math.min(c.maxMp, Math.round(c.mp + c.maxMp * m.mp)); c.emit('change'); }
    if (m.buff) c.addBuff(m.buff);
    if (prefs.buffNote && (m.buff || m.heal || m.hp || m.mp)) chat.add('ระบบ', `${m.from} ${m.buff ? 'บัฟ' : 'ฟื้นพลัง'}ให้คุณ`);
  });
  // our party / healing skill reached friends: their heal numbers over them, a revive in the chat
  net.on('aided', m => {
    const combat = game?.game?.combat;
    for (const g of m.got ?? []) {
      if (g.heal > 0) combat?.emit('heal', { amount: g.heal, x: g.x, z: g.z });
      if (g.revived) chat.add('ระบบ', `คุณชุบชีวิต ${g.name}`);
    }
  });
  // "/p text" goes to the party · "/w name text" whispers · "/r text" answers the last whisper
  let lastFrom = null;
  chat.filter = text => {
    const p = /^\/p\s+(.+)/.exec(text);
    if (p) { if (party) net.send({ t: 'pc', text: p[1] }); else chat.add('ระบบ', 'ยังไม่ได้อยู่ในปาร์ตี้'); return true; }
    const w = /^\/w\s+(\S+)\s+(.+)/.exec(text);
    if (w) { net.send({ t: 'w', to: w[1], text: w[2] }); return true; }
    const r = /^\/r\s+(.+)/.exec(text);
    if (r) { if (lastFrom) net.send({ t: 'w', to: lastFrom, text: r[1] }); else chat.add('ระบบ', 'ยังไม่มีใครกระซิบมา'); return true; }
    if (/^\/(w|r|p)\b/.test(text)) { chat.add('ระบบ', 'ใช้: /p ข้อความ · /w ชื่อ ข้อความ · /r ข้อความ'); return true; }
    return false;
  };
  net.on('w', m => { if (!m.echo) lastFrom = m.from; chat.add(m.echo ? `[กระซิบถึง ${m.to}]` : `[กระซิบจาก ${m.from}]`, m.text, 'whisper'); });
  // friends coming online and adding us: a chat line and the friends tab's notices
  const notes = [];
  const note = (kind, name, cls) => { notes.unshift({ kind, name, cls: cls ?? lists.friends.find(f => f.name === name)?.cls, at: Date.now() }); notes.length = Math.min(notes.length, 8); if (tab === 'friends') renderSoc(); };
  net.on('fon', m => { chat.add('ระบบ', `เพื่อน ${m.name} ออนไลน์แล้ว`); note('online', m.name); });
  net.on('foff', m => chat.add('ระบบ', `เพื่อน ${m.name} ออฟไลน์`));
  net.on('fnote', m => { chat.add('ระบบ', `${m.name} เพิ่มคุณเป็นเพื่อน · เพิ่มกลับได้ในหน้าสังคม (P)`); note('added', m.name, m.cls); });

  // ---- titles (src/data/titles.js): a new one is announced; wearing one tells the others ----
  const known = new Set(c.titles);
  c.on('titles', () => {
    for (const id of c.titles) if (!known.has(id)) { known.add(id); const t = TITLE_BY_ID[id]; if (t && !t.dynamic) chat.add('ระบบ', `ได้รับฉายาใหม่ «${t.name}» · ใส่ได้ที่หน้าสังคม (P) แท็บฉายา`, 'news'); }
    for (const id of [...known]) if (!c.titles.includes(id)) known.delete(id);
    if (tab === 'titles') renderSoc();
  });
  const wear = id => { if (!c.setTitle(id || null)) return; c.save?.(); net.send({ t: 'ttl', id: id || null }); renderSoc(); };

  // ---- the social window (P): ปาร์ตี้ · เพื่อน · ฉายา · อันดับ (design "UI ใหม่") ----
  const soc = node('soc-panel soc-win glass'); soc.hidden = true;
  draggable(soc, { key: 'social', handle: 'header' });
  let tab = 'friends', lists = { who: [], friends: [] }, refresh = null;
  const fst = { filter: 'all', search: '' }, tst = { cat: 'all', sel: null }, rst = { board: 'power', cls: 'all', data: null, loading: false };
  const askLists = () => { net.send({ t: 'who' }); net.send({ t: 'friends' }); };
  const askRank = () => { rst.loading = true; net.send({ t: 'rank' }); };
  net.on('rank', m => { rst.data = m; rst.loading = false; if (tab === 'rank') renderSoc(); });
  // the players around us (same map and channel), nearest first
  const nearby = () => {
    const p = game?.player?.position; if (!p) return [];
    return [...remote.list.values()].map(r => ({ id: r.id, name: r.name, cls: r.cls, lv: r.lv, title: r.title, dist: Math.hypot(r.x - p.x, r.z - p.z) })).sort((a, b) => a.dist - b.dist);
  };
  const tabs = () => {
    const on = lists.friends.filter(f => f.online).length, tc = titleCount(c);
    return `<nav class="sw-tabs">${[['party', `ปาร์ตี้${party ? ` ${party.members.length} / 6` : ''}`], ['friends', `เพื่อน · ออนไลน์ ${on}`], ['titles', `ฉายา ${tc.got} / ${tc.all}`], ['rank', 'อันดับ']]
      .map(([k, n]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</nav>`;
  };
  // the party tab: rules strip and one arch-topped card per member (design "UI ใหม่")
  const partyPane = () => {
    if (!party) return '<p class="soc-none">ยังไม่ได้อยู่ในปาร์ตี้ · ชวนผู้เล่นจากแท็บเพื่อน (ผู้เล่นใกล้คุณ) หรือคลิกชื่อผู้เล่นในโลก (ปาร์ตี้ได้สูงสุด 6 คน)</p>';
    const lead = party.leader === me, sh = share(), r = party.share;
    const cards = party.members.map(p => {
      const mine = p.id === me, near = nearOf(p);
      const state = mine ? '<b class="ok">คุณ</b>' : p.dead ? '<b class="no">หมดสติ</b>' : near ? '<b class="ok">ใกล้ · ได้ EXP</b>' : '<b class="no">อยู่ไกล · ไม่ได้ EXP</b>';
      const acts = mine ? '<button class="ghost" data-leave>ออกจากปาร์ตี้</button>'
        : `<button data-w="${esc(p.name)}">กระซิบ</button>${lead ? `<button class="ghost" data-lead="${p.id}">มอบหัวหน้า</button><button class="ghost" data-kick="${p.id}">เชิญออก</button>` : ''}`;
      return `<div class="soc-card${mine ? ' me' : ''}${p.dead ? ' dead' : ''}">${p.id === party.leader ? CROWN : ''}<span class="por">${classBadge(p.cls, CLASSES[p.cls], { size: 40 })}</span>`
        + `<span class="nm">${esc(p.name)}</span><span class="cl">${CLASSES[p.cls]?.name ?? ''} · Lv ${p.lv}</span>`
        + `${bar('hp', p.hp, p.maxHp, true)}${bar('mp', p.mp, p.maxMp, true)}<div class="pbuffs">${buffsHtml(p.buffs)}</div>`
        + `<div class="meta"><span>อยู่ที่ <b>${esc(MAP_TH[p.map] ?? p.map ?? '')}${p.ch > 1 ? ` · CH ${p.ch}` : ''}</b></span><span>${state}</span></div><div class="acts">${acts}</div></div>`;
    }).join('');
    const empty = Array.from({ length: 6 - party.members.length }, () => (lead
      ? '<button class="soc-card empty" data-tab="friends"><span class="plus">+</span><span>เชิญสมาชิก</span><small>จากแท็บเพื่อน<br>หรือคลิกชื่อผู้เล่น</small></button>'
      : '<div class="soc-card empty"><span class="plus">+</span><small>หัวหน้าปาร์ตี้เป็นคนชวน</small></div>')).join('');
    return `<div class="soc-strip"><b>ปาร์ตี้ของ ${esc(party.members.find(p => p.id === party.leader)?.name)}</b>`
      + `<span class="rule ok">อยู่ใกล้กัน (${r.range} ม.): แบ่ง EXP เท่ากัน</span><span class="rule ok">EXP +${Math.round(r.bonus * 100)}% ต่อเพื่อนที่อยู่ใกล้${sh.near && sh.even ? ` · ตอนนี้ +${Math.round(r.bonus * sh.near * 100)}%` : ''}</span>`
      + `<span class="rule${sh.even ? '' : ' bad'}">เลเวลห่างกันไม่เกิน ${r.gap}${sh.even ? '' : ' · ตอนนี้ห่างเกิน แยก EXP'}</span><span class="sp"></span>`
      + `<label>แจ้งเมื่อมีคนบัฟให้ <button class="soc-sw${prefs.buffNote ? ' on' : ''}" data-sw="buffNote" aria-pressed="${prefs.buffNote}"></button></label></div>`
      + `<div class="soc-cards">${cards}${empty}</div><p class="soc-hint">แชท: /p ข้อความ = คุยในปาร์ตี้ · /w ชื่อ ข้อความ = กระซิบ · /r = ตอบกลับ</p>`;
  };
  const renderSoc = () => {
    if (soc.hidden) return;
    // keep what is being typed and where the lists were scrolled
    const typing = document.activeElement?.closest?.('.soc-win') ? document.activeElement.matches('[data-fsearch]') ? 'fsearch' : document.activeElement.matches('[data-fname]') ? 'fname' : null : null;
    const fname = soc.querySelector('[data-fname]')?.value ?? '', scroll = [...soc.querySelectorAll('.sw-list, .sw-tgrid, .sw-table')].map(e => e.scrollTop);
    const body = tab === 'party' ? partyPane()
      : tab === 'friends' ? friendsPane({ ...fst, friends: lists.friends, party, me, nearby: nearby(), notes })
        : tab === 'titles' ? titlesPane({ c, ...tst })
          : rankPane({ ...rst, name: c.name, myCls: c.classId, myTitle: c.title });
    soc.innerHTML = `<header><kbd>P</kbd><b>สังคม</b><button data-close aria-label="ปิด">✕</button></header>${tabs()}<div class="sw-body">${body}</div>`;
    const fi = soc.querySelector('[data-fname]'); if (fi) fi.value = fname;
    soc.querySelectorAll('.sw-list, .sw-tgrid, .sw-table').forEach((e, i) => { e.scrollTop = scroll[i] ?? 0; });
    if (typing) { const el = soc.querySelector(`[data-${typing}]`); el?.focus(); el?.setSelectionRange?.(el.value.length, el.value.length); }
  };
  const toggleSoc = (open = soc.hidden, to = null) => {
    if (to) tab = to;
    soc.hidden = !open; clearInterval(refresh);
    if (open) { askLists(); if (tab === 'rank') askRank(); refresh = setInterval(() => { askLists(); if (tab === 'rank') askRank(); }, tab === 'rank' ? 30000 : 5000); renderSoc(); }
  };
  net.on('who', m => { lists.who = m.list; if (tab === 'friends' || tab === 'party') renderSoc(); });
  net.on('friends', m => { lists.friends = m.list; renderSoc(); });
  soc.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.close !== undefined) toggleSoc(false);
    else if (d.tab) { tab = d.tab; if (tab === 'rank') askRank(); toggleSoc(true); }
    else if (d.w) chat.open(`/w ${d.w} `);
    else if (d.inv) { net.send({ t: 'pinv', id: Number(d.inv) }); chat.add('ระบบ', 'ส่งคำเชิญปาร์ตี้แล้ว'); }
    else if (d.fadd) net.send({ t: 'fadd', name: d.fadd });
    else if (d.fnameGo !== undefined) { const name = soc.querySelector('[data-fname]')?.value.trim(); if (name) { net.send({ t: 'fadd', name }); soc.querySelector('[data-fname]').value = ''; } }
    else if (d.fdel) net.send({ t: 'fdel', name: d.fdel });
    else if (d.ff) { fst.filter = d.ff; renderSoc(); }
    else if (d.tcat) { tst.cat = d.tcat; renderSoc(); }
    else if (d.tsel) { tst.sel = d.tsel; renderSoc(); }
    else if (d.twear !== undefined) wear(d.twear);
    else if (d.rb) { rst.board = d.rb; renderSoc(); }
    else if (d.rc) { rst.cls = d.rc; renderSoc(); }
    else if (d.leave !== undefined) net.send({ t: 'pleave' });
    else if (d.kick) net.send({ t: 'pkick', id: Number(d.kick) });
    else if (d.lead) net.send({ t: 'plead', id: Number(d.lead) });
    else if (d.sw) { prefs[d.sw] = !prefs[d.sw]; savePrefs(); renderSoc(); }
  });
  soc.addEventListener('input', e => { if (e.target.matches('[data-fsearch]')) { fst.search = e.target.value; renderSoc(); } });
  soc.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('[data-fname]')) soc.querySelector('[data-fname-go]')?.click(); });   // typing does not walk the player
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyP' || e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (soc.hidden && party) tab = 'party';
    toggleSoc();
  });

  // ---- the trade window ----
  const win = node('soc-trade glass'); win.hidden = true;
  let offer = { items: [], gold: 0 };
  const sendOffer = () => net.send({ t: 'toffer', items: offer.items, gold: offer.gold });
  // what is left of a bag slot once the offer takes its share
  const left = (s, i) => {
    if (ITEMS[s.id].type === 'equip') { const same = c.inventory.slice(0, i + 1).filter(x => x?.id === s.id && sameGear(x, s.cards, s.plus)).length; return same > offer.items.filter(e => e.id === s.id && sameGear(e, s.cards, s.plus)).length ? 1 : 0; }
    const offered = offer.items.filter(e => e.id === s.id).reduce((n, e) => n + e.qty, 0), before = c.inventory.slice(0, i).reduce((n, x) => n + (x?.id === s.id ? x.qty : 0), 0);
    return Math.max(0, Math.min(s.qty, before + s.qty - offered));
  };
  const add = (i, all) => {
    const s = c.inventory[i]; if (!s || !left(s, i)) return;
    if (ITEMS[s.id].type === 'equip') { if (offer.items.length >= 10) return; offer.items.push({ id: s.id, qty: 1, ...(s.cards?.length ? { cards: [...s.cards] } : {}), ...(s.plus ? { plus: s.plus } : {}) }); }
    else {
      const n = all ? left(s, i) : 1, e = offer.items.find(x => x.id === s.id);
      if (e) e.qty += n; else { if (offer.items.length >= 10) return; offer.items.push({ id: s.id, qty: n }); }
    }
    sendOffer();
  };
  const row = (e, i, mine) => { const d = ITEMS[e.id]; return `<button class="soc-it" ${mine ? `data-off="${i}"` : 'disabled'} style="--rar:${RARITY_COLORS[d?.rarity] ?? '#8d8a78'}"><span>${iconHtml(d)}</span>${esc(label(e))}</button>`; };
  const renderTrade = () => {
    win.hidden = !trade; if (!trade) return;
    // a re-render (the other side changed something) keeps what is being typed and where the focus is
    const typing = win.querySelector('[data-gold]') === document.activeElement ? win.querySelector('[data-gold]').value : null;
    const focused = win.contains(document.activeElement) ? [...document.activeElement.attributes].map(a => a.name).find(n => n.startsWith('data-')) : null;
    offer = { items: trade.mine.items.map(e => ({ ...e })), gold: trade.mine.gold };
    const both = trade.locked.me && trade.locked.them;
    const state = (l, k) => (k ? '<i class="ok">ยืนยันแล้ว</i>' : l ? '<i>ล็อกแล้ว</i>' : '<i class="no">กำลังเลือก</i>');
    win.innerHTML = `<header><b>แลกเปลี่ยนกับ ${esc(trade.with.name)}</b><button data-x title="ยกเลิก">✕</button></header>
      <div class="soc-sides">
        <section><h4>ของคุณ ${state(trade.locked.me, trade.confirmed.me)}</h4><div class="soc-list">${offer.items.map((e, i) => row(e, i, !trade.locked.me)).join('') || '<p>ยังไม่ได้ใส่ของ</p>'}</div>
          <label>ทอง <input type="number" min="0" max="${c.gold}" step="1" value="${offer.gold}" ${trade.locked.me ? 'disabled' : ''} data-gold></label></section>
        <section><h4>ของ ${esc(trade.with.name)} ${state(trade.locked.them, trade.confirmed.them)}</h4><div class="soc-list">${trade.theirs.items.map((e, i) => row(e, i, false)).join('') || '<p>ยังไม่ได้ใส่ของ</p>'}</div>
          <p class="soc-gold">ทอง ${trade.theirs.gold.toLocaleString()}</p></section>
      </div>
      <p class="soc-hint">${trade.locked.me ? 'ล็อกข้อเสนอแล้ว · ถ้าแก้ไข ทั้งสองฝ่ายต้องล็อกใหม่' : 'คลิกของในกระเป๋าเพื่อใส่ (กด Shift ค้างเพื่อใส่ทั้งกอง) · คลิกของในข้อเสนอเพื่อเอาออก'}</p>
      ${trade.locked.me ? '' : `<div class="soc-bag">${c.inventory.map((s, i) => (s && left(s, i) ? `<button class="soc-it" data-bag="${i}" title="${esc(label({ ...s, qty: left(s, i) }))}" style="--rar:${RARITY_COLORS[ITEMS[s.id].rarity] ?? '#8d8a78'}"><span>${iconHtml(ITEMS[s.id])}</span>${s.plus ? `<i>+${s.plus}</i>` : ''}${left(s, i) > 1 ? `<small>${left(s, i)}</small>` : ''}</button>` : '')).join('')}</div>`}
      <footer><button data-lock ${trade.locked.me ? 'disabled' : ''}>ล็อกข้อเสนอ</button><button data-conf ${both && !trade.confirmed.me ? '' : 'disabled'}>ยืนยันแลกเปลี่ยน</button><button data-x>ยกเลิก</button></footer>`;
    if (typing !== null && !trade.locked.me) { const g = win.querySelector('[data-gold]'); g.value = typing; g.focus(); }
    else if (focused) win.querySelector(`[${focused}]`)?.focus();
  };
  const closeTrade = () => { trade = null; win.hidden = true; };
  net.on('trade', m => { trade = m; renderTrade(); });
  net.on('tend', m => { closeTrade(); chat.add('ระบบ', m.ok ? 'แลกเปลี่ยนสำเร็จ' : TRADE_WHY[m.why] ?? 'การแลกเปลี่ยนถูกยกเลิก'); });
  win.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) { net.send({ t: 'tcancel' }); return; }
    if (e.target.closest('[data-lock]')) { net.send({ t: 'tlock' }); return; }
    if (e.target.closest('[data-conf]')) { net.send({ t: 'tconf' }); return; }
    const b = e.target.closest('[data-bag]'); if (b) { add(Number(b.dataset.bag), e.shiftKey); return; }
    const o = e.target.closest('[data-off]'); if (o) { offer.items.splice(Number(o.dataset.off), 1); sendOffer(); }
  });
  win.addEventListener('change', e => {
    const g = e.target.closest('[data-gold]'); if (!g) return;
    offer.gold = Math.max(0, Math.min(c.gold, Math.floor(Number(g.value) || 0))); sendOffer();
  });
  win.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) e.stopPropagation(); });   // typing gold does not walk the player; a clicked button still lets W A S D through
  return {
    get party() { return party; }, get trade() { return trade; },
    // the main menu's สังคม tile (src/ui/MainMenu.js): open on a tab, or close
    toggle(to = null) { toggleSoc(soc.hidden || (!!to && to !== tab), to); },
  };
}
