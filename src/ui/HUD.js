import * as THREE from 'three';
import { SAFETY } from '../data/regions.js';
import { SHOPS, TRAINERS } from '../data/shops.js';
import { PURPOSES } from '../data/landmarks.js';
import { PHASE_NAMES } from '../core/WorldClock.js';
import { STATE_NAMES } from '../npc/NPCSchedule.js';

const $ = id => document.getElementById(id);
const ICONS = { blacksmith: '⚒', enhance: '✦', general: '◆', supplies: '◆', village: '◆', herbalist: '✚', occult: '☯', fish: '◆', weapons: '⚔', armor: '⛨', fruit: '◆', rice: '◆', pottery: '◆', lanterns: '◆', charms: '☯' };
const v = new THREE.Vector3();

// DOM overlay: region header, clock, journal, prompts, dialogue, nameplates.
export class HUD {
  constructor() {
    this.toastTimer = 0; this.region = null; this.plates = [];
    const layer = $('nameplates');
    for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'plate'; el.hidden = true; layer.appendChild(el); this.plates.push(el); }
  }
  setRegion(region) {
    if (this.region === region.id) return;
    this.region = region.id;
    $('region-name').textContent = region.name; $('region-sub').textContent = region.sub;
    const safety = SAFETY[region.safety];
    $('safety').textContent = safety.label; $('safety-dot').style.background = safety.color;
    document.title = `Thai Native Online — ${region.name}`;
  }
  setClock(label, phase, hour) { $('clock').textContent = `${PHASE_NAMES[phase]} · ${label}`; $('sun-dot').dataset.phase = phase; }
  setCoords(p) { $('coords').textContent = `${p.x.toFixed(0)}, ${p.z.toFixed(0)}`; }
  // intro: the map's { title, text } (src/world/maps.js); a line break in text starts a new line.
  setJournal(found, total, next, mapName, intro) {
    if (intro) {
      $('journal-title').textContent = intro.title;
      $('journal-text').replaceChildren(...intro.text.split('\n').flatMap((line, i) => (i ? [document.createElement('br'), line] : [line])));
    }
    $('quest-text').textContent = `ค้นพบสถานที่${mapName ? `ใน${mapName}` : ''} ${found}/${total}`;
    $('quest-hint').textContent = next ? `ถัดไป: ${next}` : 'สำรวจครบทุกแห่งที่รู้จักแล้ว';
  }
  toast(title, text, purpose) {
    clearTimeout(this.toastTimer);
    $('toast-title').textContent = title; $('toast-text').textContent = text; $('toast-purpose').textContent = purpose ? `บทบาทในอนาคต · ${PURPOSES[purpose]}` : '';
    $('toast').hidden = false; this.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6500);
  }
  prompt(text) { $('interaction').hidden = !text; if (text) $('interaction-text').textContent = text; }
  // Dialogue panel for NPCs; shop and trainer services are listed as future features.
  openDialogue(npc, label, line) {
    const d = npc.def;
    $('dlg-icon').textContent = ICONS[d.shopType] ?? (d.trainer ? '⚔' : d.faction ? '⛨' : '◇');
    $('dlg-name').textContent = d.name; $('dlg-role').textContent = `${label}${npc.state ? ` · ${STATE_NAMES[npc.state] ?? ''}` : ''}`;
    $('dlg-line').textContent = line;
    const services = [];
    if (d.shopType && SHOPS[d.shopType]) { const s = SHOPS[d.shopType]; services.push(`<b>${s.title}</b> ${s.services.join(' · ')}<br><span>สินค้าตัวอย่าง: ${s.preview.join(', ')}</span>`); }
    if (d.trainer && TRAINERS[d.trainer]) { const t = TRAINERS[d.trainer]; services.push(`<b>${t.title}</b> สายอาชีพ ${t.class}<br><span>วิชา: ${t.skills.join(', ')}</span>`); }
    if (d.faction === 'city_guard') services.push('<b>ทหารอโยธยา</b> ผู้รักษาความสงบ<br><span>อนาคต: ตอบสนองต่อค่ากรรม (Karma) ของผู้เล่น</span>');
    const soon = d.shopType && SHOPS[d.shopType]?.stock?.length ? 'การเรียนวิชาและการตีบวกจะเปิดในเวอร์ชันถัดไป' : 'ระบบร้านค้าและการเรียนวิชาจะเปิดในเวอร์ชันถัดไป';
    $('dlg-services').innerHTML = services.length ? `${services.map(s => `<div class="service">${s}</div>`).join('')}<small>${soon}</small>` : '';
    $('dialogue').hidden = false;
  }
  closeDialogue() { $('dialogue').hidden = true; }
  get dialogueOpen() { return !$('dialogue').hidden; }
  // Floating names above nearby NPCs.
  updatePlates(npcs, camera, focus, label, marker = () => null) {
    const host = $('world'), w = host.clientWidth, h = host.clientHeight;
    const near = npcs.filter(n => n.shown && n.distance < 26 && (n.def.shopType || n.def.trainer || n.def.faction || marker(n) || Math.hypot(n.x - focus.x, n.z - focus.z) < 9)).sort((a, b) => a.distance - b.distance);
    this.plates.forEach((el, i) => {
      const n = near[i];
      if (!n) { el.hidden = true; return; }
      v.set(n.x, n.y + 2.05 * n.look.scale, n.z).project(camera);
      if (v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) { el.hidden = true; return; }
      const mark = marker(n), key = `${n.id}${mark ?? ''}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key; el.className = `plate${n.def.shopType || n.def.trainer ? ' is-service' : ''}${n.def.faction ? ' is-guard' : ''}`;
        el.innerHTML = `${mark ? `<i class="qm">${mark}</i>` : ''}${ICONS[n.def.shopType] ? `<i>${ICONS[n.def.shopType]}</i>` : n.def.trainer ? '<i>⚔</i>' : ''}${n.def.name}<small>${label(n)}</small>`;
      }
      el.hidden = false;
      el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, -100%)`;
    });
  }
  debug(text) { $('debug').textContent = text; }
}
