import { NetClient, serverUrl } from './NetClient.js';
import { RemotePlayers } from './RemotePlayers.js';
import { attachNetCombat } from './NetCombat.js';
import { attachNetProgress } from './NetProgress.js';
import { attachSocial } from './Social.js';
import { attachRemoteSkills } from './RemoteSkills.js';
import { attachCombatMeters } from './CombatMeters.js';
import './net.css';
import { ITEMS } from '../character/data/items.js';

// Phase 1 of the server split (docs/technical/SERVER_SPLIT.md): see the other players
// on this map and talk to everyone. The player's own position goes out ~10× a second
// (only when it changed, plus a keep-alive), every move clip the player plays is
// shown on the others' screens, and a small chat sits bottom-left (Enter to type).
//
//   const mp = startMultiplayer(game)   once the character exists (src/core/Game.js)
//   mp.enterMap(mapId)                  after every map change
//   mp.update(dt, camera)               once per frame
// Channels (server/channels.js): the CH badge on the minimap shows this player's channel of the
// map; clicking it lists the open ones to switch to (out of a fight, once a minute).
const SEND_EVERY = .1, KEEPALIVE = 1;

export function startMultiplayer(game) {
  const c = game.game.character, player = game.player;
  const remote = new RemotePlayers(game.scene, document.getElementById('nameplates'), (x, z) => game.world?.heightAt(x, z) ?? 0);
  const net = new NetClient(serverUrl());
  const chat = new ChatBox(text => net.send({ t: 'c', text }));
  let map = game.maps.map.id, sendT = 0, keepT = 0, last = null, lv = c.level;
  const pos = () => ({ x: +player.position.x.toFixed(2), z: +player.position.z.toFixed(2), f: +player.group.rotation.y.toFixed(3) });
  const chan = new ChannelPicker(ch => net.send({ t: 'chan', ch }), () => net.send({ t: 'chans' }));
  net.on('welcome', m => { if (m.admin) game.setDev?.(true); remote.clear(); for (const p of m.roster) remote.set(p); chat.setOnline(m.online); chan.set(m.ch ?? 1, m.chs); })
    .on('chans', m => chan.set(m.ch, m.list, true))
    .on('chmove', m => chat.add('ระบบ', m.why === 'closed' ? `แชนแนลเดิมปิดแล้ว · ย้ายมา CH ${m.ch}` : `ย้ายมา CH ${m.ch}`))
    .on('chwarn', m => chat.add('ระบบ', `CH ${m.ch} คนน้อย จะปิดใน ${m.secs} วินาที · ระบบจะย้ายคุณไปแชนแนลอื่นเอง`))
    .on('chno', m => chat.add('ระบบ', CH_WHY[m.why] ?? 'ย้ายแชนแนลไม่ได้'))
    .on('cardnews', m => chat.add('ประกาศ', `✦ ${m.name} ได้รับ${ITEMS[m.card]?.name ?? 'การ์ด'}!`, 'news'))
    .on('join', m => remote.set(m.p))
    .on('leave', m => remote.remove(m.id))
    .on('tick', m => { for (const [id, x, z, f, mv] of m.p) remote.move(id, x, z, f, mv); })
    .on('a', m => remote.anim(m.id, m.clip, m.sp))
    .on('lv', m => remote.level(m.id, m.lv))
    .on('c', m => chat.add(m.name, m.text, m.kind ?? ''))
    // a GM's commands (server/gm.js): sent somewhere, HP set
    .on('gmwarp', m => { const maps = game.maps; if (maps.map?.id === m.map) maps.place({ x: m.x, z: m.z, facing: game.player.group.rotation.y }); else maps.travel({ to: m.map, arrive: { x: m.x, z: m.z } }); })
    .on('gmhp', m => { if (m.pct === 0) { game.game.combat?.knockOut(); return; } c.hp = Math.round(c.maxHp * m.pct / 100); if (m.mp) c.mp = c.maxMp; c.emit('change'); })
    .on('online', m => chat.setOnline(m.n))
    .on('status', on => { chat.setStatus(on); chan.online(on); if (!on) remote.clear(); });
  // a signed-in player sends its session: the server then shows the character it has saved
  const session = () => { try { const s = JSON.parse(sessionStorage.getItem('tno.session.v1') ?? 'null'); return s?.token ? { token: s.token, slot: s.slot } : {}; } catch { return {}; } };
  const combat = game.game?.combat ? attachNetCombat(net, game) : null;   // shared monsters (phase 3a)
  // class skills: ours go out as `fx` (which skill, which monster); the others' play on their models
  const skillsFx = attachRemoteSkills(net, game, remote, combat);
  game.game?.combat?.on('kit-fx', e => net.send({ t: 'fx', skill: e.id, ...(e.monster?.sid != null ? { tgt: e.monster.sid } : e.at ? { x: e.at.x, z: e.at.z } : {}) }));
  attachNetProgress(net, c, game.quests);                                              // a signed-in character's progress is the server's (3c)
  const social = attachSocial(net, c, chat, remote, game);                                   // parties and trade (src/net/Social.js)
  const meters = attachCombatMeters(net, game, remote, social);                             // my name plate, the DPS meter
  // the same character opened in another tab or device: this one stops talking to the server
  net.on('kicked', m => { net.close(); chat.add('ระบบ', m.why ?? 'ตัวละครนี้ถูกเปิดเล่นจากที่อื่น · โหลดหน้าใหม่เพื่อเล่นต่อที่นี่'); });
  net.connect(() => ({ ...session(), name: c.name, cls: c.classId, gender: c.gender, lv: c.level, map, ...pos() }));
  // every move the player's model plays (skills, basic attacks) is mirrored to the others
  // (a class skill's own clips are not: the others play the whole skill from its `fx`)
  player.onAnim = (clip, sp) => { if (!game.training?.busy) net.send({ t: 'a', clip, sp: +(sp || 1).toFixed(2) }); };

  return {
    net, remote, chat, social, meters,
    enterMap(id) { map = id; last = null; remote.clear(); net.send({ t: 'map', map: id, ...pos() }); },
    update(dt, camera) {
      remote.update(dt, camera, document.getElementById('world'));
      skillsFx.update(dt);
      meters.update(dt, camera);
      combat?.update(dt);
      if (!net.online) return;
      sendT += dt; keepT += dt;
      if (c.level !== lv) { lv = c.level; net.send({ t: 'lv', lv }); }
      if (sendT < SEND_EVERY) return;
      const p = pos(), moved = last && Math.hypot(p.x - last.x, p.z - last.z) / sendT;
      sendT = 0;
      // walking, as the others should animate it: not while a skill carries us (a dash is no walk)
      const m = game.training?.busy || !moved ? 0 : moved > 5 ? 2 : moved > .3 ? 1 : 0;
      if (last && p.x === last.x && p.z === last.z && p.f === last.f && m === last.m && keepT < KEEPALIVE) return;
      net.send({ t: 's', ...p, m });
      last = { ...p, m }; keepT = 0;
    },
  };
}

const CH_WHY = { fighting: 'ย้ายแชนแนลระหว่างต่อสู้ไม่ได้', cooldown: 'ย้ายแชนแนลได้นาทีละครั้ง', full: 'แชนแนลนั้นเต็ม', closed: 'แชนแนลนั้นปิดแล้ว', dead: 'ฟื้นก่อนแล้วค่อยย้ายแชนแนล', same: 'อยู่แชนแนลนี้อยู่แล้ว' };
const load = (n, cap) => (n >= cap * .9 ? ['แน่น', 'full'] : n >= cap * .5 ? ['ปานกลาง', 'mid'] : ['โล่ง', 'low']);

// The CH badge under the map name and its list of channels.
class ChannelPicker {
  constructor(choose, ask) {
    this.btn = document.getElementById('mini-ch'); this.ch = 1;
    this.box = document.createElement('div'); this.box.className = 'ch-pick glass'; this.box.hidden = true;
    this.btn?.closest('.minimap')?.append(this.box);
    this.btn?.addEventListener('click', e => { e.stopPropagation(); if (this.box.hidden) { this.box.hidden = false; this.box.innerHTML = '<p>กำลังโหลด…</p>'; ask(); } else this.box.hidden = true; });
    this.box.addEventListener('click', e => {
      e.stopPropagation();
      const b = e.target.closest('button[data-ch]'); if (!b) return;
      this.box.hidden = true; choose(Number(b.dataset.ch));
    });
    document.addEventListener('pointerdown', e => { if (!this.box.hidden && !this.box.contains(e.target) && e.target !== this.btn) this.box.hidden = true; });
  }
  online(on) { if (this.btn) this.btn.hidden = !on; if (!on) this.box.hidden = true; }
  set(ch, list, render = false) {
    this.ch = ch; if (this.btn) { this.btn.textContent = `CH ${ch}`; this.btn.hidden = false; }
    if (!list || (!render && this.box.hidden)) return;
    this.box.innerHTML = '<header>แชนแนล</header>' + list.map(c => {
      const [word, cls] = load(c.n, c.cap), here = c.ch === ch;
      return `<button type="button" data-ch="${c.ch}" class="${cls}${here ? ' here' : ''}" ${here || c.closing ? 'disabled' : ''}><b>CH ${c.ch}</b><span>${c.closing ? 'กำลังปิด' : here ? 'อยู่ที่นี่' : word}</span><i>${c.n}/${c.cap}</i></button>`;
    }).join('') + '<p>แชนแนลใหม่เปิดเองเมื่อคนแน่น · บอสอยู่ CH 1</p>';
  }
}

// Bottom-left chat: the last few lines fade out; Enter opens the input, Enter sends, Esc closes.
class ChatBox {
  constructor(send) {
    this.root = document.createElement('section'); this.root.className = 'net-chat'; this.root.setAttribute('aria-label', 'แชท');
    this.root.innerHTML = '<header><b>แชท</b><span class="net-online">ออฟไลน์</span></header><div class="net-lines" aria-live="polite"></div><input type="text" maxlength="120" placeholder="พิมพ์ข้อความ แล้วกด Enter" hidden>';
    document.getElementById('app')?.append(this.root) ?? document.body.append(this.root);
    this.lines = this.root.querySelector('.net-lines'); this.input = this.root.querySelector('input'); this.online = this.root.querySelector('.net-online');
    window.addEventListener('keydown', e => {
      if (e.code !== 'Enter' || e.target === this.input || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
      e.preventDefault(); this.open();
    });
    this.input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Enter') { const t = this.input.value.trim(); if (t && !this.filter?.(t)) send(t); this.input.value = ''; this.close(); }
      if (e.code === 'Escape') this.close();
    });
    this.input.addEventListener('blur', () => this.close());
    this.root.querySelector('header').addEventListener('click', () => this.open());
  }
  open(text = null) { this.input.hidden = false; this.root.classList.add('typing'); if (text !== null) this.input.value = text; this.input.focus(); }
  close() { this.input.hidden = true; this.root.classList.remove('typing'); this.input.blur(); }
  add(name, text, kind = '') {
    const line = document.createElement('p'); line.innerHTML = `<b></b> <span></span>`; if (kind) line.className = kind;
    line.querySelector('b').textContent = name; line.querySelector('span').textContent = text;
    this.lines.append(line); while (this.lines.children.length > 30) this.lines.firstChild.remove();
    this.lines.scrollTop = this.lines.scrollHeight;
    setTimeout(() => line.classList.add('old'), 12000);
  }
  setOnline(n) { this.online.textContent = `ออนไลน์ ${n} คน`; }
  setStatus(on) { this.root.classList.toggle('offline', !on); if (!on) this.online.textContent = 'ออฟไลน์ · กำลังเชื่อมต่อ'; }
}
