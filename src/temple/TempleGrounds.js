import * as THREE from 'three';
import './temple.css';
import { TEMPLE_BELL, TEMPLE_BODHI } from '../data/templeGrounds.js';
import { Sound } from '../audio/Sound.js';

// The temple grounds in นครอโยธยา (src/data/templeGrounds.js), the client half of
// server/templeGrounds.js. Nothing here gives items, gold or buffs.
//   หอระฆัง        F rings the bell; online, the server sends the ring to everyone in the city
//   ต้นโพธิ์ผูกผ้า  F opens a small window to tie a wish (signed-in characters); each kept wish is a
//                  cloth ribbon on the tree, and near the tree the wishes rise one at a time
//
//   new TempleGrounds({ context, prepare, feed, scene })   scene gets the ribbon group
//     context() → { online, authenticated, map, position }; prepare() closes other windows;
//     feed(text) writes a line in the game feed
//   connect(net) · ring() · showWish() · close() · open · update(dt, camera, mapId)
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const CLOTHS = ['#d8392b', '#f2b632', '#3f8f4e', '#3a6fb5', '#f4f0e6', '#c2518f'];
const STRIKE_GAP = 1.5, HEAR = 70;
// ribbons hang from the crown's rim; the floating wish shows over it, one every few seconds, when near
const RIBBON_Y = 2.2, FLOAT_Y = 5.2, FLOAT_NEAR = 9, FLOAT_SECONDS = 4.5;
const v = new THREE.Vector3();
const WHY = {
  far: 'เดินเข้าไปใกล้อีกนิด', dead: 'ฟื้นคืนชีพก่อน', offline: 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
  guest: 'ผูกผ้าอธิษฐานได้เมื่อเข้าสู่ระบบ', muted: 'ถูกปิดแชทอยู่ ผูกผ้าอธิษฐานไม่ได้ชั่วคราว', empty: 'พิมพ์คำอธิษฐานก่อน',
};
const waitText = (why, wait) => why === 'ringing' ? 'ระฆังยังกังวานอยู่ รอสักครู่'
  : why === 'cooldown' ? `รออีก ${wait ?? 1} วินาที` : WHY[why] ?? 'ไม่สำเร็จ ลองอีกครั้ง';

export class TempleGrounds {
  constructor({ context, prepare = () => {}, feed = () => {}, scene = null, layer = document.getElementById('nameplates'),
    now = () => Date.now(), uuid = () => globalThis.crypto.randomUUID() } = {}) {
    Object.assign(this, { context, prepare, feed, scene, layer, now, uuid });
    this.wishes = []; this.pending = null; this.localRung = -Infinity; this.message = '';
    this.root = el('div', 'temple-wish'); this.root.hidden = true;
    const d = this.dialog = el('section', 'temple-wish-dialog'); d.tabIndex = -1;
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', TEMPLE_BODHI.label);
    const head = el('header', 'temple-wish-head'), titles = el('div');
    titles.append(el('small', '', 'ลานวัด · นครอโยธยา'), el('h2', '', 'ต้นโพธิ์ผูกผ้า'));
    this.closeButton = el('button', 'temple-wish-close', '✕'); this.closeButton.setAttribute('aria-label', 'ปิด');
    this.closeButton.addEventListener('click', () => this.close());
    head.append(titles, this.closeButton);
    const info = el('p', 'temple-wish-info', `ผูกผ้าแพรสีที่กิ่งโพธิ์แล้วอธิษฐาน คำอธิษฐานจะลอยอยู่เหนือต้นโพธิ์ให้ทุกคนในเมืองเห็น ${TEMPLE_BODHI.lifeMs / 3600_000} ชั่วโมง`);
    this.form = el('form', 'temple-wish-form');
    this.input = el('input'); Object.assign(this.input, { type: 'text', maxLength: TEMPLE_BODHI.maxLength, placeholder: 'ขอให้…', autocomplete: 'off' });
    this.input.setAttribute('aria-label', 'คำอธิษฐาน');
    this.count = el('span', 'temple-wish-count');
    this.submit = el('button', 'temple-wish-submit', 'ผูกผ้าอธิษฐาน'); this.submit.type = 'submit';
    this.form.append(this.input, this.count, this.submit);
    this.form.addEventListener('submit', e => { e.preventDefault(); this.tie(); });
    this.input.addEventListener('input', () => this.render());
    this.status = el('p', 'temple-wish-status'); this.status.setAttribute('role', 'status');
    this.recent = el('ul', 'temple-wish-list'); this.recent.setAttribute('aria-label', 'คำอธิษฐานล่าสุด');
    d.append(head, info, this.form, this.status, this.recent);
    this.root.append(d); (document.getElementById('app') ?? document.body).append(this.root);
    this.root.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') this.close(); });
    for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'keyup']) this.root.addEventListener(type, e => e.stopPropagation());
  }
  get open() { return !this.root.hidden; }

  connect(net) {
    if (this.transport === net) return;
    this.transport = net;
    const mine = f => m => { if (this.transport === net) f(m); };
    net.on('bell', mine(m => this.hear(m)));
    net.on('bell_result', mine(m => { if (!m.ok) this.feed(`หอระฆัง · ${waitText(m.why, m.wait)}`); }));
    net.on('wishes', mine(m => { this.wishes = Array.isArray(m.list) ? m.list.slice(-TEMPLE_BODHI.keep) : []; this.render(); }));
    net.on('wish', mine(m => this.add(m.w)));
    net.on('wish_result', mine(m => this.answer(m)));
    net.on('status', mine(online => { if (!online) { this.pending = null; this.wishes = []; this.render(); } }));
  }

  // หอระฆัง: online the server rings it for the whole city (we hear it back as `bell`)
  ring() {
    const ctx = this.context();
    if (ctx.online && this.transport?.online) { this.transport.send({ t: 'bell', request: this.uuid() }); return true; }
    const wait = this.localRung + TEMPLE_BELL.playerCooldownMs - this.now();
    if (wait > 0) { this.feed(`หอระฆัง · ${waitText('cooldown', Math.ceil(wait / 1000))}`); return false; }
    this.localRung = this.now();
    this.hear({ name: '', strikes: TEMPLE_BELL.strikes });
    return true;
  }
  hear(m) {
    const p = this.context().position, far = p ? Math.hypot(p.x - TEMPLE_BELL.x, p.z - TEMPLE_BELL.z) : 0;
    const volume = Math.max(.25, 1 - far / HEAR);
    const strikes = Math.max(1, Math.min(5, m?.strikes ?? 1));
    for (let i = 0; i < strikes; i++) Sound.sfx('temple_bell', { delay: i * STRIKE_GAP, volume });
    this.feed(m?.name ? `เสียงระฆังวัดดังกังวานทั่วเมือง · ${m.name} ตีระฆัง` : 'เสียงระฆังวัดดังกังวานทั่วเมือง');
    this.lastRing = performance.now();
  }

  // ต้นโพธิ์ผูกผ้า
  showWish() {
    this.prepare(); this.message = ''; this.root.hidden = false; this.render();
    this.input.focus();
    return true;
  }
  close() { this.root.hidden = true; this.input.blur(); }
  tie() {
    const ctx = this.context(), text = this.input.value.trim();
    if (this.pending) return false;
    if (!text) { this.message = WHY.empty; return this.render(), false; }
    if (!ctx.online || !ctx.authenticated) { this.message = WHY.guest; return this.render(), false; }
    if (!this.transport?.online) { this.message = WHY.offline; return this.render(), false; }
    this.pending = { t: 'wish', text, request: this.uuid() };
    this.transport.send(this.pending);
    this.message = 'กำลังผูกผ้า…'; this.render();
    return true;
  }
  answer(m) {
    if (!this.pending || m.request !== this.pending.request) return;
    this.pending = null;
    if (m.ok) { this.input.value = ''; this.message = 'ผูกผ้าแล้ว ขอให้สมความปรารถนา'; Sound.sfx('ui_confirm'); }
    else this.message = waitText(m.why, m.wait);
    this.render();
  }
  add(w) {
    if (!w || this.wishes.some(o => o.id === w.id)) return;
    this.wishes.push(w); this.wishes = this.wishes.slice(-TEMPLE_BODHI.keep); this.render();
  }
  render() {
    const left = TEMPLE_BODHI.maxLength - [...this.input.value].length;
    this.count.textContent = String(left);
    this.submit.disabled = !!this.pending;
    this.status.textContent = this.message;
    if (!this.open) return;
    this.recent.replaceChildren(...this.wishes.slice(-6).reverse().map(w => {
      const li = el('li'); li.style.setProperty('--cloth', CLOTHS[w.id % CLOTHS.length]);
      li.append(el('q', '', w.text), el('small', '', w.name));
      return li;
    }));
    if (!this.wishes.length) this.recent.append(el('li', 'is-empty', 'ยังไม่มีใครผูกผ้าวันนี้'));
  }

  // Every kept wish is a cloth ribbon tied under the tree's crown. Standing near the tree, the
  // wishes rise one at a time over it, each for a few seconds.
  ribbons() {
    if (this.cloths) return this.cloths;
    const g = this.cloths = new THREE.Group(); g.name = 'temple:wish-cloths'; g.visible = false;
    const geometry = new THREE.PlaneGeometry(.16, .7); geometry.translate(0, -.35, 0);
    this.clothMaterials = CLOTHS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .8, side: THREE.DoubleSide }));
    for (let i = 0; i < TEMPLE_BODHI.keep; i++) {
      // a golden-angle spiral along the crown's rim (its leaves end ~2.3 m out), hanging below it
      const a = i * 2.399, r = 1.95 + (i % 3) * .15, y = RIBBON_Y - (i % 2) * .1;
      const m = new THREE.Mesh(geometry, this.clothMaterials[0]);
      m.position.set(TEMPLE_BODHI.x + Math.cos(a) * r, y, TEMPLE_BODHI.z + Math.sin(a) * r);
      m.rotation.y = -a; m.visible = false; m.userData.phase = i * 1.7;
      g.add(m);
    }
    this.scene?.add(g);
    return g;
  }
  update(dt, camera, mapId) {
    const p = this.context().position, near = p ? Math.hypot(p.x - TEMPLE_BODHI.x, p.z - TEMPLE_BODHI.z) : Infinity;
    if (this.open && (mapId !== 'city' || near > TEMPLE_BODHI.range + 4)) this.close();
    const city = mapId === 'city', t = performance.now() / 1000;
    const g = this.scene ? this.ribbons() : null;
    if (g) {
      g.visible = city && this.wishes.length > 0;
      if (g.visible) g.children.forEach((m, i) => {
        const w = this.wishes[i]; m.visible = !!w;
        if (!w) return;
        m.material = this.clothMaterials[w.id % CLOTHS.length];
        m.rotation.z = Math.sin(t * 1.6 + m.userData.phase) * .16;
      });
    }
    // one wish at a time over the tree, only when standing close
    const show = city && camera && near < FLOAT_NEAR && this.wishes.length && this.layer;
    if (!show) { if (this.float) this.float.hidden = true; return; }
    if (!this.float) {
      this.float = el('div', 'temple-wish-float'); this.float.append(el('span'), el('small'));
      this.layer.append(this.float); this.floatAt = -Infinity; this.floatIndex = -1;
    }
    if (t - this.floatAt > FLOAT_SECONDS) {
      this.floatAt = t;
      this.floatIndex = (this.floatIndex + 1) % this.wishes.length;
      const w = this.wishes[this.wishes.length - 1 - this.floatIndex];
      this.float.firstChild.textContent = w.text; this.float.lastChild.textContent = w.name;
      this.float.style.setProperty('--cloth', CLOTHS[w.id % CLOTHS.length]);
      this.float.classList.remove('is-in'); void this.float.offsetWidth; this.float.classList.add('is-in');
    }
    v.set(TEMPLE_BODHI.x, FLOAT_Y, TEMPLE_BODHI.z).project(camera);
    const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
    this.float.hidden = off;
    if (!off) this.float.style.transform = `translate(${(v.x * .5 + .5) * this.layer.clientWidth}px, ${(-v.y * .5 + .5) * this.layer.clientHeight}px) translate(-50%, -100%)`;
  }
}
