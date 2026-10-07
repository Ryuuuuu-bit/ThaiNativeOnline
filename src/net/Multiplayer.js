import { NetClient, serverUrl } from './NetClient.js';
import { RemotePlayers } from './RemotePlayers.js';
import { attachNetCombat } from './NetCombat.js';
import { attachNetProgress } from './NetProgress.js';
import './net.css';

// Phase 1 of the server split (docs/technical/SERVER_SPLIT.md): see the other players
// on this map and talk to everyone. The player's own position goes out ~10× a second
// (only when it changed, plus a keep-alive), every move clip the player plays is
// shown on the others' screens, and a small chat sits bottom-left (Enter to type).
//
//   const mp = startMultiplayer(game)   once the character exists (src/core/Game.js)
//   mp.enterMap(mapId)                  after every map change
//   mp.update(dt, camera)               once per frame
const SEND_EVERY = .1, KEEPALIVE = 1;

export function startMultiplayer(game) {
  const c = game.game.character, player = game.player;
  const remote = new RemotePlayers(game.scene, document.getElementById('nameplates'), (x, z) => game.world?.heightAt(x, z) ?? 0);
  const net = new NetClient(serverUrl());
  const chat = new ChatBox(text => net.send({ t: 'c', text }));
  let map = game.maps.map.id, sendT = 0, keepT = 0, last = null, lv = c.level;
  const pos = () => ({ x: +player.position.x.toFixed(2), z: +player.position.z.toFixed(2), f: +player.group.rotation.y.toFixed(3) });
  net.on('welcome', m => { remote.clear(); for (const p of m.roster) remote.set(p); chat.setOnline(m.online); })
    .on('join', m => remote.set(m.p))
    .on('leave', m => remote.remove(m.id))
    .on('tick', m => { for (const [id, x, z, f, mv] of m.p) remote.move(id, x, z, f, mv); })
    .on('a', m => remote.anim(m.id, m.clip, m.sp))
    .on('lv', m => remote.level(m.id, m.lv))
    .on('c', m => chat.add(m.name, m.text))
    .on('online', m => chat.setOnline(m.n))
    .on('status', on => { chat.setStatus(on); if (!on) remote.clear(); });
  // a signed-in player sends its session: the server then shows the character it has saved
  const session = () => { try { const s = JSON.parse(sessionStorage.getItem('tno.session.v1') ?? 'null'); return s?.token ? { token: s.token, slot: s.slot } : {}; } catch { return {}; } };
  const combat = game.game?.combat ? attachNetCombat(net, game) : null;   // shared monsters (phase 3a)
  attachNetProgress(net, c);                                                // a signed-in character's progress is the server's (3c)
  // the same character opened in another tab or device: this one stops talking to the server
  net.on('kicked', () => { net.close(); chat.add('ระบบ', 'ตัวละครนี้ถูกเปิดเล่นจากที่อื่น · โหลดหน้าใหม่เพื่อเล่นต่อที่นี่'); });
  net.connect(() => ({ ...session(), name: c.name, cls: c.classId, gender: c.gender, lv: c.level, map, ...pos() }));
  // every move the player's model plays (skills, basic attacks) is mirrored to the others
  player.onAnim = (clip, sp) => net.send({ t: 'a', clip, sp: +(sp || 1).toFixed(2) });

  return {
    net, remote, chat,
    enterMap(id) { map = id; last = null; remote.clear(); net.send({ t: 'map', map: id, ...pos() }); },
    update(dt, camera) {
      remote.update(dt, camera, document.getElementById('world'));
      combat?.update(dt);
      if (!net.online) return;
      sendT += dt; keepT += dt;
      if (c.level !== lv) { lv = c.level; net.send({ t: 'lv', lv }); }
      if (sendT < SEND_EVERY) return;
      const p = pos(), moved = last && Math.hypot(p.x - last.x, p.z - last.z) / sendT;
      sendT = 0;
      if (last && p.x === last.x && p.z === last.z && p.f === last.f && keepT < KEEPALIVE) return;
      net.send({ t: 's', ...p, m: !moved ? 0 : moved > 5 ? 2 : moved > .3 ? 1 : 0 });
      last = p; keepT = 0;
    },
  };
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
      if (e.code === 'Enter') { const t = this.input.value.trim(); if (t) send(t); this.input.value = ''; this.close(); }
      if (e.code === 'Escape') this.close();
    });
    this.input.addEventListener('blur', () => this.close());
    this.root.querySelector('header').addEventListener('click', () => this.open());
  }
  open() { this.input.hidden = false; this.root.classList.add('typing'); this.input.focus(); }
  close() { this.input.hidden = true; this.root.classList.remove('typing'); this.input.blur(); }
  add(name, text) {
    const line = document.createElement('p'); line.innerHTML = `<b></b> <span></span>`;
    line.querySelector('b').textContent = name; line.querySelector('span').textContent = text;
    this.lines.append(line); while (this.lines.children.length > 30) this.lines.firstChild.remove();
    this.lines.scrollTop = this.lines.scrollHeight;
    setTimeout(() => line.classList.add('old'), 12000);
  }
  setOnline(n) { this.online.textContent = `ออนไลน์ ${n} คน`; }
  setStatus(on) { this.root.classList.toggle('offline', !on); if (!on) this.online.textContent = 'ออฟไลน์ · กำลังเชื่อมต่อ'; }
}
