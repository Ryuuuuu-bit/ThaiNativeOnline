import { BESTIARY, searchBestiary, ELEMENT_TH, RACE_TH } from '../data/bestiary.js';
import { MAPS } from '../world/maps.js';
import { ITEMS } from '../character/data/items.js';
import { iconHtml } from './icons.js';
import './player-guide.css';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('th-TH');
const kindLabel = { normal: 'มอนสเตอร์ทั่วไป', elite: 'มอนสเตอร์ชั้นยอด', boss: 'บอส' };

export class BestiaryPanel {
  constructor({ level, prepare, locate }) {
    Object.assign(this, { level, prepare, locate });
    this.root = document.createElement('div'); this.root.id = 'bestiary-overlay'; this.root.className = 'qol-overlay'; this.root.hidden = true;
    this.root.innerHTML = `<section class="guide-panel" role="dialog" aria-modal="true" aria-labelledby="bestiary-title"><header class="guide-head"><div><small>บันทึกผู้เดินทาง</small><h2 id="bestiary-title">สมุดมอนสเตอร์</h2><p>รู้จักศัตรู เตรียมตัว และเลือกแหล่งล่าที่เหมาะกับคุณ</p></div><button type="button" data-guide-close aria-label="ปิดสมุดมอนสเตอร์">×</button></header><div class="guide-body"><div class="guide-index"><label>ค้นหามอนสเตอร์หรือไอเทมดรอป<input id="bestiary-search" type="search" placeholder="เช่น หมูป่า / หนังสัตว์…"></label><div class="guide-filters"><select id="bestiary-map" aria-label="แผนที่"><option value="">ทุกแผนที่</option>${Object.values(MAPS).filter(m => !m.safe).map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><select id="bestiary-kind" aria-label="ประเภทมอนสเตอร์"><option value="">ทุกประเภท</option><option value="normal">ทั่วไป</option><option value="elite">ชั้นยอด</option><option value="boss">บอส</option></select></div><button type="button" id="bestiary-near" aria-pressed="false">เหมาะกับเลเวลฉัน ±5</button><small id="bestiary-count"></small><div id="bestiary-list"></div></div><article id="bestiary-detail" class="guide-detail"></article></div></section>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.$ = s => this.root.querySelector(s);
    this.$('[data-guide-close]').addEventListener('click', () => this.close());
    this.root.addEventListener('click', e => {
      if (e.target === this.root) this.close();
      const row = e.target.closest('[data-monster]'); if (row) { this.selected = BESTIARY.find(m => m.id === row.dataset.monster); this.render(); }
      const place = e.target.closest('[data-monster-place]'); if (place) { const l = this.selected.locations[Number(place.dataset.monsterPlace)]; this.close(); this.locate(this.selected, l); }
    });
    for (const id of ['#bestiary-search', '#bestiary-map', '#bestiary-kind']) this.$(id).addEventListener(id.includes('search') ? 'input' : 'change', () => this.render());
    this.$('#bestiary-near').addEventListener('click', () => { this.near = !this.near; this.render(); });
    this.root.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focus = [...this.root.querySelectorAll('button, input, select')].filter(el => !el.disabled && el.getClientRects().length);
      if (e.shiftKey && document.activeElement === focus[0]) { e.preventDefault(); focus.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === focus.at(-1)) { e.preventDefault(); focus[0].focus(); }
    });
  }
  get open() { return !this.root.hidden; }
  show() { this.previousFocus = document.activeElement; this.prepare(); this.root.hidden = false; this.render(); this.$('#bestiary-search').focus(); }
  close() { this.root.hidden = true; this.previousFocus?.focus?.({ preventScroll: true }); }
  render() {
    const list = searchBestiary({ query: this.$('#bestiary-search').value, map: this.$('#bestiary-map').value, kind: this.$('#bestiary-kind').value, nearLevel: this.near ? this.level() : null });
    this.$('#bestiary-near').setAttribute('aria-pressed', String(!!this.near)); this.$('#bestiary-count').textContent = `${list.length} ชนิด · ข้อมูลดรอปจากโลกเกม`;
    if (!list.some(m => m.id === this.selected?.id)) this.selected = list[0] ?? null;
    const host = this.$('#bestiary-list'), scroll = host.scrollTop, focused = document.activeElement?.dataset?.monster;
    host.innerHTML = list.map(m => `<button type="button" class="guide-monster" data-monster="${m.id}" aria-pressed="${m.id === this.selected?.id}"><span class="guide-monster-level" style="--monster-color:${m.color}">${m.boss ? '♛' : '◆'}<small>Lv ${m.level}</small></span><span><b>${esc(m.name)}</b><small>${kindLabel[m.kind]} · ${esc(ELEMENT_TH[m.element] ?? m.element)}</small></span></button>`).join('') || '<p class="guide-empty">ไม่พบมอนสเตอร์หรือแหล่งดรอป ลองเปลี่ยนตัวกรอง</p>';
    host.scrollTop = scroll; if (focused) [...host.children].find(el => el.dataset.monster === focused)?.focus({ preventScroll: true });
    const m = this.selected;
    this.$('#bestiary-detail').innerHTML = !m ? '<p class="guide-empty">เลือกมอนสเตอร์เพื่ออ่านข้อมูล</p>' : `<header class="guide-monster-head"><small>${kindLabel[m.kind]} · Lv ${m.level}</small><h3>${esc(m.name)}</h3><p>${esc(RACE_TH[m.race] ?? m.race)} · ธาตุ${esc(ELEMENT_TH[m.element] ?? m.element)}</p></header><div class="guide-stats"><span>HP <b>${fmt(m.hp)}</b></span><span>ATK <b>${fmt(m.atk)}</b></span><span>DEF <b>${fmt(m.def)}</b></span><span>EXP <b>${fmt(m.exp)}</b></span></div><p class="guide-note">ค่าพื้นฐาน · กลางคืนและเอฟเฟกต์ต่อสู้เปลี่ยนค่าที่ได้รับจริง</p><h4>พบที่ไหน</h4><div class="guide-locations">${m.locations.map((l, i) => `<button type="button" data-monster-place="${i}"><span><b>${esc(l.name)}</b><small>${esc(MAPS[l.map].name)} · ${l.phases.length === 4 ? 'ตลอดวัน' : esc(l.phases.join(' / '))}${l.respawn ? ` · เกิดใหม่ ${l.respawn} วินาที` : ''}</small></span><span>ดูเส้นทาง ↗</span></button>`).join('')}</div>${m.skills.length ? `<h4>ระวังสกิลบอส</h4><ul class="guide-skills">${m.skills.map(s => `<li><b>${esc(s.name)}</b><span>เตือนก่อนโจมตี ${s.windup} วินาที · ระยะ ${s.radius} วา</span></li>`).join('')}</ul>` : ''}<h4>ไอเทมที่ดรอป</h4><p class="guide-note">แต่ละรายการสุ่มแยกกัน · การ์ดให้ตามกติกาการแบ่งรางวัล</p><div class="guide-drops">${m.drops.map(d => `<div>${iconHtml(ITEMS[d.id])}<span><b>${esc(ITEMS[d.id].name)}</b><small>${d.min === d.max ? d.min : `${d.min}–${d.max}`} ชิ้น${d.card ? ' · การ์ดมอนสเตอร์' : ''}</small></span><strong>${+(d.chance * 100).toFixed(3)}%</strong></div>`).join('')}</div>`;
  }
}
