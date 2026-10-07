// Parties and trade on the client (server/parties.js, server/trades.js; messages in server/index.js).
//   · click another player's name plate: ชวนเข้าปาร์ตี้ · ขอแลกเปลี่ยน
//   · an invite or a trade request pops up with ตอบรับ / ปฏิเสธ
//   · the party frame under the player frame: members, level, HP, who leads; leave / remove
//   · the trade window: my offer and theirs, my bag to add from, gold; ล็อก → ยืนยัน (both sides)
//   · party chat: start a chat line with /p · /w name text whispers · /r answers
//   · P: the social window — who is online, friends (signed in), whisper / invite from there
//   · a healer's party / revive skill heals, buffs and stands up the members near them (aid)
//   attachSocial(net, character, chat, remote)
import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { CLASSES } from '../character/data/classes.js';
import { iconHtml } from '../ui/icons.js';
import { sameGear } from '../character/data/refine.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PARTY_WHY = { self: 'ชวนตัวเองไม่ได้', in_party: 'ผู้เล่นนั้นอยู่ในปาร์ตี้อื่นแล้ว', not_leader: 'หัวหน้าปาร์ตี้เท่านั้นที่ชวนได้', full: 'ปาร์ตี้เต็มแล้ว (6 คน)', expired: 'คำเชิญหมดอายุแล้ว', offline: 'ผู้เล่นนั้นออฟไลน์', declined: 'ปฏิเสธคำเชิญปาร์ตี้' };
const TRADE_WHY = { self: 'แลกกับตัวเองไม่ได้', busy: 'ตอนนี้แลกเปลี่ยนไม่ได้ (กำลังต่อสู้ หมดสติ หรือแลกกับคนอื่นอยู่)', offline: 'ผู้เล่นนั้นออฟไลน์', guest: 'ต้องเข้าสู่ระบบทั้งสองฝ่ายจึงแลกเปลี่ยนได้', far: 'ต้องยืนใกล้กัน (ไม่เกิน 8 เมตร) ในแชนแนลเดียวกัน', expired: 'คำขอหมดอายุแล้ว', declined: 'อีกฝ่ายปฏิเสธการแลกเปลี่ยน',
  gold: 'ทองไม่พอ', missing: 'ไม่มีของนั้นในกระเป๋าแล้ว', bad_offer: 'ข้อเสนอไม่ถูกต้อง', room_a: 'กระเป๋าหรือน้ำหนักไม่พอรับของ', room_b: 'กระเป๋าหรือน้ำหนักไม่พอรับของ',
  cancelled: 'ยกเลิกการแลกเปลี่ยน', moved: 'การแลกเปลี่ยนถูกยกเลิก (ย้ายแมพหรือแชนแนล)', left: 'อีกฝ่ายออกจากเกม · ยกเลิกการแลกเปลี่ยน' };
const MAP_TH = { city: 'นครอโยธยา', paddy: 'ทุ่งนา', deep_forest: 'ป่าลึก', wat_rang: 'วัดร้าง', klong: 'คลองหนองบึง' };
const label = e => `${e.plus ? `+${e.plus} ` : ''}${ITEMS[e.id]?.name ?? e.id}${e.qty > 1 ? ` ×${e.qty}` : ''}${e.cards?.length ? ` ❖${e.cards.length}` : ''}`;

export function attachSocial(net, c, chat, remote, game = null) {
  const app = document.getElementById('app') ?? document.body;
  const node = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; app.append(d); return d; };
  let me = null, party = null, trade = null;
  net.on('welcome', m => { me = m.you; });

  // ---- the menu on another player's name plate ----
  const menu = node('soc-menu glass'); menu.hidden = true;
  remote.onPick = (r, x, y) => {
    menu.innerHTML = `<header>${esc(r.name)}<small>${CLASSES[r.cls]?.name ?? ''} · Lv.${r.lv}</small></header>
      <button data-act="pinv">ชวนเข้าปาร์ตี้</button><button data-act="treq">ขอแลกเปลี่ยน</button><button data-act="w">กระซิบ</button><button data-act="fadd">เพิ่มเพื่อน</button>`;
    menu.dataset.id = r.id; menu.dataset.name = r.name; menu.style.left = `${Math.max(90, Math.min(innerWidth - 90, x))}px`; menu.style.top = `${Math.max(8, Math.min(innerHeight - 140, y))}px`; menu.hidden = false;
  };
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    menu.hidden = true;
    if (b.dataset.act === 'w') { chat.open(`/w ${menu.dataset.name} `); return; }
    if (b.dataset.act === 'fadd') { net.send({ t: 'fadd', name: menu.dataset.name }); return; }
    net.send({ t: b.dataset.act, id: Number(menu.dataset.id) });
    chat.add('ระบบ', b.dataset.act === 'pinv' ? 'ส่งคำเชิญปาร์ตี้แล้ว' : 'ส่งคำขอแลกเปลี่ยนแล้ว');
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.plate.is-player')) menu.hidden = true; });

  // ---- invites and requests ----
  const asks = node('soc-asks');
  const ask = (text, yes, no, secs) => {
    const card = document.createElement('div'); card.className = 'soc-ask glass';
    card.innerHTML = `<p>${text}</p><div><button data-a="1">ตอบรับ</button><button data-a="0">ปฏิเสธ</button></div>`;
    const done = ok => { card.remove(); (ok ? yes : no)(); };
    card.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); });
    setTimeout(() => card.isConnected && done(false), secs * 1000);
    asks.append(card);
  };
  net.on('pinv', m => ask(`<b>${esc(m.name)}</b> ชวนคุณเข้าปาร์ตี้`, () => net.send({ t: 'pans', from: m.from, ok: true }), () => net.send({ t: 'pans', from: m.from, ok: false }), 55));
  net.on('treq', m => ask(`<b>${esc(m.name)}</b> ขอแลกเปลี่ยนกับคุณ`, () => net.send({ t: 'tans', from: m.from, ok: true }), () => net.send({ t: 'tans', from: m.from, ok: false }), 28));
  net.on('pno', m => chat.add('ระบบ', `${m.name ? `${m.name}: ` : ''}${PARTY_WHY[m.why] ?? 'ทำไม่ได้'}`));
  net.on('tno', m => chat.add('ระบบ', TRADE_WHY[m.why] ?? 'แลกเปลี่ยนไม่ได้'));

  // ---- the party frame ----
  const frame = node('soc-party glass'); frame.hidden = true;
  const renderParty = () => {
    frame.hidden = !party;
    if (!party) return;
    const lead = party.leader === me;
    frame.innerHTML = `<header><b>ปาร์ตี้</b><span>${party.members.length}/6</span><button data-leave title="ออกจากปาร์ตี้">ออก</button></header>`
      + party.members.map(p => {
        const hp = p.maxHp ? Math.max(0, Math.min(1, p.hp / p.maxHp)) : null, away = p.id !== me && party.members.find(x => x.id === me)?.map !== p.map;
        return `<div class="soc-mem${p.dead ? ' dead' : ''}${p.id === me ? ' me' : ''}"><span>${p.id === party.leader ? '<i title="หัวหน้า">♛</i>' : ''}${esc(p.name)}<small>${CLASSES[p.cls]?.name ?? ''} · Lv.${p.lv}${away ? ` · ${MAP_TH[p.map] ?? p.map}` : ''}${p.dead ? ' · หมดสติ' : ''}</small></span>`
          + (hp !== null ? `<em><b style="width:${(hp * 100).toFixed(0)}%"></b></em>` : '<em class="none"></em>')
          + (lead && p.id !== me ? `<button data-kick="${p.id}" title="นำออกจากปาร์ตี้">×</button>` : '') + '</div>';
      }).join('');
  };
  net.on('party', m => {
    const was = party?.id; party = m.id ? m : null;
    if (party && !was) chat.add('ระบบ', 'เข้าร่วมปาร์ตี้แล้ว · พิมพ์ /p นำหน้าเพื่อคุยในปาร์ตี้ · EXP แบ่งกันเมื่อล่าใกล้กัน');
    if (!party && was) chat.add('ระบบ', 'ออกจากปาร์ตี้แล้ว');
    renderParty();
  });
  net.on('pc', m => chat.add(`[ปาร์ตี้] ${m.name}`, m.text, 'party'));
  net.on('status', on => { if (!on) { party = null; renderParty(); closeTrade(); } });
  frame.addEventListener('click', e => {
    if (e.target.closest('[data-leave]')) net.send({ t: 'pleave' });
    const k = e.target.closest('[data-kick]'); if (k) net.send({ t: 'pkick', id: Number(k.dataset.kick) });
  });
  // a healer's party / revive skill reached us (server/index.js support)
  net.on('aid', m => {
    const combat = game?.game?.combat, p = game?.player?.position;
    if (!c.alive) { if (m.revive && combat?.reviveHere(m.revive)) chat.add('ระบบ', `${m.from} ชุบชีวิตคุณ`); return; }
    if (m.heal) { const amount = c.heal(c.maxHp * m.heal); if (amount && p) combat?.emit('heal', { amount, x: p.x, z: p.z }); }
    if (m.mp) { c.mp = Math.min(c.maxMp, Math.round(c.mp + c.maxMp * m.mp)); c.emit('change'); }
    if (m.buff) c.addBuff(m.buff);
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
  net.on('fon', m => chat.add('ระบบ', `เพื่อน ${m.name} ออนไลน์แล้ว`));
  net.on('foff', m => chat.add('ระบบ', `เพื่อน ${m.name} ออฟไลน์`));

  // ---- the social window (P): who is online, friends ----
  const soc = node('soc-panel glass'); soc.hidden = true;
  let tab = 'who', lists = { who: [], friends: [] }, refresh = null;
  const askLists = () => { net.send({ t: 'who' }); net.send({ t: 'friends' }); };
  const renderSoc = () => {
    if (soc.hidden) return;
    const friendNames = new Set(lists.friends.map(f => f.name));
    const rows = (tab === 'who' ? lists.who : lists.friends).map(p => {
      const on = tab === 'who' || p.online, self = p.id === me;
      return `<div class="soc-row${on ? '' : ' off'}"><span><b>${esc(p.name)}</b><small>${on ? `${CLASSES[p.cls]?.name ?? ''} · Lv.${p.lv} · ${MAP_TH[p.map] ?? p.map ?? ''}` : 'ออฟไลน์'}</small></span>`
        + (self ? '<em>คุณ</em>' : `${on ? `<button data-w="${esc(p.name)}" title="กระซิบ">กระซิบ</button><button data-inv="${p.id}" title="ชวนเข้าปาร์ตี้">ปาร์ตี้</button>` : ''}`
        + (tab === 'who' ? (friendNames.has(p.name) ? '' : `<button data-fadd="${esc(p.name)}" title="เพิ่มเพื่อน">+เพื่อน</button>`) : `<button data-fdel="${esc(p.name)}" title="ลบเพื่อน">ลบ</button>`)) + '</div>';
    }).join('');
    soc.innerHTML = `<header><b>สังคม</b><button data-close>✕</button></header>
      <nav><button data-tab="who" aria-pressed="${tab === 'who'}">ออนไลน์ (${lists.who.length})</button><button data-tab="friends" aria-pressed="${tab === 'friends'}">เพื่อน (${lists.friends.filter(f => f.online).length}/${lists.friends.length})</button></nav>
      <div class="soc-rows">${rows || `<p>${tab === 'who' ? 'ไม่มีใครออนไลน์' : 'ยังไม่มีเพื่อน · เพิ่มจากแท็บออนไลน์ (ต้องเข้าสู่ระบบ)'}</p>`}</div>
      <p class="soc-hint">แชท: /w ชื่อ ข้อความ = กระซิบ · /r = ตอบกลับ · /p = ปาร์ตี้</p>`;
  };
  const toggleSoc = (open = soc.hidden) => {
    soc.hidden = !open; clearInterval(refresh);
    if (open) { askLists(); refresh = setInterval(askLists, 5000); renderSoc(); }
  };
  net.on('who', m => { lists.who = m.list; renderSoc(); });
  net.on('friends', m => { lists.friends = m.list; renderSoc(); });
  soc.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close !== undefined) toggleSoc(false);
    else if (b.dataset.tab) { tab = b.dataset.tab; renderSoc(); }
    else if (b.dataset.w) chat.open(`/w ${b.dataset.w} `);
    else if (b.dataset.inv) { net.send({ t: 'pinv', id: Number(b.dataset.inv) }); chat.add('ระบบ', 'ส่งคำเชิญปาร์ตี้แล้ว'); }
    else if (b.dataset.fadd) net.send({ t: 'fadd', name: b.dataset.fadd });
    else if (b.dataset.fdel) net.send({ t: 'fdel', name: b.dataset.fdel });
  });
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyP' || e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
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
  win.addEventListener('keydown', e => e.stopPropagation());   // typing gold does not walk the player
  return { get party() { return party; }, get trade() { return trade; } };
}
