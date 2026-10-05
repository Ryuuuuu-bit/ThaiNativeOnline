// DOM user interface for the character and combat systems.
import * as THREE from 'three';
import { CLASSES, SKILLS, ITEMS, STATS, STAT_LABELS, RARITY_COLORS, BUFF_ICONS } from './data.js';
import './game.css';

const el = (tag, className, html) => { const e = document.createElement(tag); if (className) e.className = className; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (a, b) => `${Math.max(0, Math.min(100, a / b * 100))}%`;
const SLOT_LABELS = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', charm: 'เครื่องราง' };

function itemTip(id) {
  const d = ITEMS[id];
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `${STAT_LABELS[k] || { atk: 'โจมตี', def: 'ป้องกัน', hp: 'HP', crit: 'คริ' }[k]} +${k === 'crit' ? `${v * 100}%` : v}`).join(' · ') : '';
  return `${d.name}${d.slot ? ` (${SLOT_LABELS[d.slot]})` : ''}\n${d.desc || bonus}\nราคาขาย ${Math.max(1, Math.floor(d.price / 2))} ทอง`;
}

// Character creation; resolves with { name, classId, gender }.
export function showCreation(root) {
  return new Promise(resolve => {
    let chosen = 'warrior', gender = 'male';
    const overlay = el('section', 'g-create', `
      <div class="g-create-card">
        <span class="eyebrow">สร้างผู้เดินทาง · วิถีไทย ในโลกที่กว้างกว่าเดิม</span>
        <h2>จากแผ่นดินนี้ สู่เรื่องราวของคุณ</h2>
        <div class="g-create-row">
          <label class="g-name">ชื่อตัวละคร<input maxlength="16" value="ผู้เดินทาง" autocomplete="off" /></label>
          <div class="g-gender" role="radiogroup" aria-label="เพศ"><button data-g="male" role="radio">ชาย</button><button data-g="female" role="radio">หญิง</button></div>
        </div>
        <div class="g-classes" role="radiogroup" aria-label="เลือกอาชีพ"></div>
        <div class="g-class-detail"></div>
        <button class="g-start">เริ่มการเดินทาง</button>
      </div>`);
    const list = overlay.querySelector('.g-classes'), detail = overlay.querySelector('.g-class-detail');
    for (const [id, c] of Object.entries(CLASSES)) {
      const card = el('button', 'g-class', `<span class="g-class-icon">${c.icon}</span><b>${c.name}</b><em>${c.en}</em>`);
      card.style.setProperty('--cls', c.color);
      card.setAttribute('role', 'radio'); card.dataset.id = id;
      card.addEventListener('click', () => { chosen = id; sync(); });
      list.append(card);
    }
    overlay.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { gender = b.dataset.g; sync(); }));
    const sync = () => {
      list.querySelectorAll('.g-class').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === chosen)));
      overlay.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.g === gender)));
      const c = CLASSES[chosen];
      detail.style.setProperty('--cls', c.color);
      detail.innerHTML = `<p class="g-tagline">“${c.tagline}”</p><p>${c.desc}</p>
        <div class="g-class-stats">${STATS.map(k => `<i>${STAT_LABELS[k]} ${c.base[k]}</i>`).join('')}</div>
        <div class="g-class-skills">${c.skills.map(id => `<span title="${SKILLS[id].name}">${SKILLS[id].icon} ${SKILLS[id].name}</span>`).join('')}</div>`;
    };
    sync();
    const input = overlay.querySelector('input');
    const start = () => {
      const name = input.value.trim() || 'ผู้เดินทาง';
      overlay.remove(); resolve({ name, classId: chosen, gender });
    };
    overlay.querySelector('.g-start').addEventListener('click', start);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') start(); });
    root.append(overlay);
    input.focus(); input.select();
  });
}

export class GameUI {
  constructor(root, character, combat) {
    this.root = root; this.c = character; this.combat = combat;
    document.body.classList.add('game-on');
    this.layer = el('div', 'g-layer'); root.append(this.layer);
    this.floatLayer = el('div', 'g-floats'); root.insertBefore(this.floatLayer, root.querySelector('.vignette')?.nextSibling || null);
    this.plates = new Map(); this.floats = [];
    this.buildPlayerFrame(); this.buildTargetFrame(); this.buildSkillBar(); this.buildPanels(); this.buildFeed(); this.buildDeath();
    this.bind();
    this.refresh(); this.refreshInventory();
  }

  // ---------- Construction ----------
  buildPlayerFrame() {
    const c = this.c;
    this.frame = el('aside', 'g-player glass', `
      <div class="g-portrait" style="--cls:${c.cls.color}">${c.cls.icon}<span class="g-lv"></span></div>
      <div class="g-player-info">
        <div class="g-player-name"><b>${esc(c.name)}</b><span>${c.cls.name} · ${c.gender === 'female' ? 'หญิง' : 'ชาย'}</span></div>
        <div class="g-bar g-hp" title="HP"><span></span><em></em></div>
        <div class="g-bar g-mp" title="MP"><span></span><em></em></div>
        <div class="g-bar g-exp" title="EXP"><span></span><em></em></div>
        <div class="g-buffs"></div>
      </div>`);
    this.layer.append(this.frame);
  }
  buildTargetFrame() {
    this.target = el('div', 'g-target glass', `<div class="g-target-name"><b></b><span></span></div><div class="g-bar g-thp"><span></span><em></em></div><div class="g-target-tags"></div>`);
    this.target.hidden = true; this.layer.append(this.target);
  }
  buildSkillBar() {
    this.bar = el('div', 'g-skillbar');
    this.skillButtons = this.c.cls.skills.map((id, i) => {
      const s = SKILLS[id];
      const b = el('button', 'g-skill', `<span class="g-skill-icon">${s.icon}</span><kbd>${i + 1}</kbd><i class="g-cd"></i><small>${s.mp ? s.mp : ''}</small>`);
      b.title = `${s.name}${s.mp ? ` · MP ${s.mp}` : ''}${s.cd ? ` · คูลดาวน์ ${s.cd} วิ` : ''}`;
      b.setAttribute('aria-label', s.name); b.dataset.skill = id;
      b.addEventListener('click', () => this.combat.useSkill(id));
      this.bar.append(b); return b;
    });
    this.bar.append(el('span', 'g-sep'));
    this.potionHp = el('button', 'g-skill g-potion', `<span class="g-skill-icon">⚱</span><kbd>Q</kbd><small></small>`);
    this.potionHp.title = 'ดื่มยาฟื้น HP'; this.potionHp.addEventListener('click', () => this.quickPotion('hp'));
    this.potionMp = el('button', 'g-skill g-potion mp', `<span class="g-skill-icon">❂</span><kbd>F</kbd><small></small>`);
    this.potionMp.title = 'ดื่มน้ำผึ้งฟื้น MP'; this.potionMp.addEventListener('click', () => this.quickPotion('mp'));
    this.bar.append(this.potionHp, this.potionMp, el('span', 'g-sep'));
    for (const [key, label, panel] of [['C', 'ตัวละคร', 'sheet'], ['I', 'กระเป๋า', 'bag']]) {
      const b = el('button', 'g-menu', `<kbd>${key}</kbd>${label}`); b.addEventListener('click', () => this.toggle(panel)); this.bar.append(b);
    }
    this.layer.append(this.bar);
  }
  buildPanels() {
    this.sheet = el('section', 'g-panel g-sheet glass', `<div class="panel-heading">ตัวละคร<button aria-label="ปิด">×</button></div><div class="g-sheet-body"></div>`);
    this.bag = el('section', 'g-panel g-bag glass', `<div class="panel-heading">กระเป๋า<button aria-label="ปิด">×</button></div>
      <div class="g-gold"></div><div class="g-grid"></div>
      <label class="g-sell"><input type="checkbox" /> โหมดขาย (คลิกไอเท็มเพื่อขาย)</label><p class="g-hint">คลิกเพื่อใช้หรือสวมใส่</p>`);
    for (const p of [this.sheet, this.bag]) { p.hidden = true; p.querySelector('.panel-heading button').addEventListener('click', () => { p.hidden = true; }); this.layer.append(p); }
    this.sellMode = this.bag.querySelector('.g-sell input');
    this.sellMode.addEventListener('change', () => this.bag.classList.toggle('selling', this.sellMode.checked));
    this.grid = this.bag.querySelector('.g-grid');
    this.grid.addEventListener('click', e => {
      const slot = e.target.closest('[data-index]'); if (!slot) return;
      const i = Number(slot.dataset.index), item = this.c.inventory[i]; if (!item) return;
      if (this.sellMode.checked) { const gold = this.c.sellAt(i); this.log(`ขาย ${ITEMS[item.id].name} ได้ ${gold} ทอง`, 'gold'); }
      else if (!this.c.useAt(i) && ITEMS[item.id].type === 'use') this.log('HP เต็มอยู่แล้ว');
    });
    this.sheet.addEventListener('click', e => {
      const add = e.target.closest('[data-stat]'); if (add) this.c.allocate(add.dataset.stat);
      const slot = e.target.closest('[data-slot]'); if (slot) this.c.unequip(slot.dataset.slot);
      if (e.target.closest('.g-reset')) this.c.resetStats();
    });
  }
  buildFeed() { this.feed = el('div', 'g-feed'); this.layer.append(this.feed); this.banner = el('div', 'g-banner'); this.banner.hidden = true; this.layer.append(this.banner); }
  buildDeath() {
    this.death = el('section', 'g-death', `<h2>คุณหมดสติ</h2><p>วิญญาณยังไม่ไปไหน กลับไปตั้งหลักที่ศาลาริมคลอง<br><small>เสียทอง 10% ที่ติดตัว</small></p><button>ฟื้นคืนชีพ</button>`);
    this.death.hidden = true; this.layer.append(this.death);
    this.death.querySelector('button').addEventListener('click', () => this.onRespawn?.());
  }

  // ---------- Events ----------
  bind() {
    const c = this.c, cb = this.combat;
    c.on('change', () => this.refresh());
    c.on('inventory', () => this.refreshInventory());
    c.on('inventory-full', id => this.log(`กระเป๋าเต็ม ทิ้ง ${ITEMS[id].name}`, 'bad'));
    c.on('levelup', lv => { this.showBanner(`เลเวลอัป · Lv. ${lv}`, 'ได้รับแต้มสถานะ 3 แต้ม กด C เพื่ออัปสถานะ'); this.log(`เลเวลอัปเป็น ${lv}!`, 'gold'); });
    c.on('used', id => this.log(`ใช้ ${ITEMS[id].name}`));
    cb.on('target', () => this.refreshTarget());
    cb.on('hit', e => { this.float(e.x, e.z, e.amount, e.crit ? 'crit' : e.dot ? 'dot' : e.pet ? 'pet' : 'deal'); this.refreshTarget(); });
    cb.on('miss', e => this.float(e.x, e.z, 'พลาด', 'miss'));
    cb.on('dodge', e => this.float(e.x, e.z, 'หลบ', 'miss', 1.9));
    cb.on('player-hit', e => { this.float(e.x, e.z, e.amount, 'hurt', 1.9); this.frame.classList.remove('g-shake'); void this.frame.offsetWidth; this.frame.classList.add('g-shake'); });
    cb.on('heal', e => this.float(e.x, e.z, `+${e.amount}`, 'heal', 1.9));
    cb.on('fail', reason => this.log(reason, 'bad', true));
    cb.on('kill', ({ monster, exp, gold, drops }) => {
      this.log(`ปราบ${monster.name} · +${exp} EXP · +${gold} ทอง`, 'exp');
      for (const d of drops) this.log(`ได้รับ ${ITEMS[d.id].name}${d.qty > 1 ? ` ×${d.qty}` : ''}`, ITEMS[d.id].rarity === 'epic' ? 'epic' : 'loot');
      this.float(monster.x, monster.z, `+${exp} EXP`, 'exp', 2.2);
    });
    cb.on('aggro', m => { if (m.def.elite) this.log(`${m.name} จ้องมองคุณ!`, 'bad'); });
    cb.on('spawn', m => { if (m.def.rare) { this.log(`มีแสงประหลาดลอยอยู่ในป่า… ${m.name}ปรากฏตัว`, 'epic'); this.showBanner(`${m.name}ปรากฏตัว`, 'Rare Monster · ล่าได้เฉพาะยามค่ำคืน'); } });
    cb.on('phase', phase => this.setPhase(phase));
    cb.on('player-death', () => { this.death.hidden = false; });
    cb.on('player-respawn', ({ goldLost }) => { this.death.hidden = true; if (goldLost) this.log(`เสียทอง ${goldLost}`, 'bad'); });
  }

  setPhase(phase) {
    const night = phase === 'night';
    if (night === this.isNight) return;
    const first = this.isNight === undefined; this.isNight = night;
    if (first && !night) return;
    document.body.classList.toggle('g-night', night);
    if (night && this.c.cls.nightCrit) this.log(`ยามค่ำคืน ${this.c.cls.name}คริติคอล +${this.c.cls.nightCrit * 100}%`, 'epic');
    if (night) { this.showBanner('ราตรีมาเยือน', 'ภูตผีออกเดิน · EXP +25% · ผีแรงขึ้น · ระวัง Rare Monster'); this.log('ค่ำแล้ว สัตว์ป่ากลับรัง ผีป่าเริ่มออกหากิน', 'epic'); }
    else { this.showBanner('อรุณรุ่ง', 'ผีกลับคืนสู่เงามืด ป่ากลับมาสงบ'); this.log('เช้าแล้ว สัตว์ป่ากลับมาหากิน', 'gold'); }
  }

  handleKey(e) {
    const k = e.code;
    if (/^Digit[1-4]$/.test(k)) { const id = this.c.cls.skills[Number(k.slice(5)) - 1]; this.combat.useSkill(id); return true; }
    if (k === 'Tab') { e.preventDefault(); this.combat.cycleTarget(); return true; }
    if (k === 'Space') { e.preventDefault(); this.combat.useSkill(this.combat.basicSkillId()); return true; }
    if (k === 'KeyQ') { this.quickPotion('hp'); return true; }
    if (k === 'KeyF') { this.quickPotion('mp'); return true; }
    if (k === 'KeyC') { this.toggle('sheet'); return true; }
    if (k === 'KeyI' || k === 'KeyB') { this.toggle('bag'); return true; }
    if (k === 'Escape') {
      const open = !this.sheet.hidden || !this.bag.hidden;
      this.sheet.hidden = true; this.bag.hidden = true;
      if (!open && this.combat.target) this.combat.setTarget(null);
      return open;
    }
    return false;
  }
  quickPotion(kind) { if (!this.c.quickUse(kind)) this.log(kind === 'hp' ? 'ไม่มียาฟื้น HP หรือ HP เต็มแล้ว' : 'ไม่มีน้ำผึ้งป่า', 'bad', true); }
  toggle(name) {
    const p = this[name]; p.hidden = !p.hidden;
    if (!p.hidden) { if (name === 'sheet') this.refreshSheet(); else this.refreshInventory(); }
  }

  // ---------- Rendering ----------
  setBar(bar, value, max, label) { bar.querySelector('span').style.width = pct(value, max); bar.querySelector('em').textContent = label ?? `${Math.ceil(value)} / ${max}`; }
  refresh() {
    const c = this.c;
    this.frame.querySelector('.g-lv').textContent = c.level;
    this.setBar(this.frame.querySelector('.g-hp'), c.hp, c.maxHp);
    this.setBar(this.frame.querySelector('.g-mp'), c.mp, c.maxMp);
    this.setBar(this.frame.querySelector('.g-exp'), c.exp, c.expNeeded, `EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%`);
    this.frame.classList.toggle('g-low', c.hp / c.maxHp < .3);
    this.frame.querySelector('.g-buffs').innerHTML = c.buffs.map(b => `<i title="${b.id}">${BUFF_ICONS[b.id] || '✧'} ${Math.ceil(b.remaining)}</i>`).join('');
    this.frame.querySelector('.g-portrait').classList.toggle('g-points', c.points > 0);
    this.potionHp.querySelector('small').textContent = c.count('potion_s') + c.count('potion_m');
    this.potionMp.querySelector('small').textContent = c.count('ether');
    if (!this.sheet.hidden) this.refreshSheet();
    this.bag.querySelector('.g-gold').textContent = `◉ ${c.gold.toLocaleString()} ทอง`;
  }
  refreshTarget() {
    const m = this.combat.target;
    this.target.hidden = !m;
    if (!m) return;
    this.target.querySelector('b').textContent = m.name;
    this.target.querySelector('.g-target-name span').textContent = `Lv. ${m.level}${m.def.elite ? ' · หัวหน้า' : ''}`;
    this.target.classList.toggle('elite', !!m.def.elite);
    this.setBar(this.target.querySelector('.g-thp'), m.hp, m.maxHp);
    this.target.querySelector('.g-target-tags').innerHTML = m.debuffs.map(d => `<i>${d.slow ? 'ติดบ่วง' : 'ต้องคุณไสย'}</i>`).join('');
  }
  refreshSheet() {
    const c = this.c, s = c.stats;
    this.sheet.querySelector('.g-sheet-body').innerHTML = `
      <div class="g-sheet-head"><span class="g-portrait" style="--cls:${c.cls.color}">${c.cls.icon}</span><div><b>${esc(c.name)}</b><small>${c.cls.name} · Lv. ${c.level}</small></div></div>
      <div class="g-equip">${Object.keys(SLOT_LABELS).map(slot => { const id = c.equipment[slot]; return `<button data-slot="${slot}" title="${id ? `${itemTip(id)}\nคลิกเพื่อถอด` : 'ว่าง'}" style="--rar:${id ? RARITY_COLORS[ITEMS[id].rarity] : '#555'}"><span>${id ? ITEMS[id].icon : '·'}</span><small>${id ? ITEMS[id].name : SLOT_LABELS[slot]}</small></button>`; }).join('')}</div>
      <div class="g-stats-head"><span>สถานะ</span><span class="${c.points ? 'g-has-points' : ''}">แต้มคงเหลือ ${c.points}</span></div>
      ${STATS.map(k => `<div class="g-stat"><span>${STAT_LABELS[k]}</span><b>${s[k]}</b><button data-stat="${k}" ${c.points ? '' : 'disabled'} aria-label="เพิ่ม${STAT_LABELS[k]}">+</button></div>`).join('')}
      <div class="g-derived">
        <span>HP</span><b>${c.maxHp}</b><span>MP</span><b>${c.maxMp}</b>
        <span>โจมตี</span><b>${c.attack}</b><span>ป้องกัน</span><b>${c.defense}</b>
        <span>คริติคอล</span><b>${(c.critChance * 100).toFixed(1)}%</b><span>ระยะ</span><b>${c.cls.range}</b>
      </div>
      <button class="g-reset" ${Object.values(c.alloc).some(Boolean) ? '' : 'disabled'}>รีเซ็ตแต้มสถานะ</button>`;
  }
  refreshInventory() {
    const c = this.c;
    this.grid.innerHTML = c.inventory.map((s, i) => {
      if (!s) return `<button class="g-slot empty" data-index="${i}" aria-label="ช่องว่าง"></button>`;
      const d = ITEMS[s.id];
      return `<button class="g-slot" data-index="${i}" title="${esc(itemTip(s.id))}" style="--rar:${RARITY_COLORS[d.rarity] || '#8d8a78'}"><span>${d.icon}</span>${s.qty > 1 ? `<small>${s.qty}</small>` : ''}</button>`;
    }).join('');
    this.refresh();
  }

  log(text, kind = '', throttle = false) {
    const now = performance.now();
    if (throttle && this.lastLog === text && now - this.lastLogAt < 1200) return;
    this.lastLog = text; this.lastLogAt = now;
    const row = el('div', `g-log ${kind}`); row.textContent = text; this.feed.append(row);
    while (this.feed.children.length > 7) this.feed.firstChild.remove();
    setTimeout(() => row.classList.add('old'), 6000);
    setTimeout(() => row.remove(), 7000);
  }
  showBanner(title, sub) {
    this.banner.innerHTML = `<b>${title}</b><small>${sub}</small>`; this.banner.hidden = false;
    this.banner.classList.remove('show'); void this.banner.offsetWidth; this.banner.classList.add('show');
    clearTimeout(this.bannerTimer); this.bannerTimer = setTimeout(() => this.banner.hidden = true, 3500);
  }
  float(x, z, text, kind, height = 1.6) {
    const node = el('span', `g-float ${kind}`); node.textContent = text; this.floatLayer.append(node);
    this.floats.push({ node, pos: new THREE.Vector3(x + (Math.random() - .5) * .4, height, z), age: 0 });
  }

  // Per-frame: cooldowns, floating numbers and monster nameplates.
  update(dt, camera, size, groundHeight) {
    const c = this.c, project = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * size.width, (1 - p.y) / 2 * size.height, p.z]; };
    this.skillButtons.forEach(b => {
      const id = b.dataset.skill, s = SKILLS[id], left = c.cooldowns[id] || 0;
      b.querySelector('.g-cd').style.height = s.cd ? pct(left, s.cd) : '0%';
      b.classList.toggle('nomp', c.mp < s.mp);
      b.classList.toggle('active', this.combat.pending?.skillId === id || (s.basic && this.combat.autoAttack));
    });
    for (const f of this.floats) {
      f.age += dt;
      const [x, y] = project(f.pos.clone().setY(f.pos.y + groundHeight(f.pos.x, f.pos.z) + f.age * 1.1));
      f.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${f.age < .12 ? 1.4 - f.age * 3 : 1})`;
      f.node.style.opacity = String(Math.min(1, 2.4 - f.age * 2));
    }
    for (const f of this.floats.filter(f => f.age > 1.2)) f.node.remove();
    this.floats = this.floats.filter(f => f.age <= 1.2);

    const seen = new Set();
    for (const m of this.combat.monsters) {
      if (!m.alive) continue;
      const show = m === this.combat.target || m.hp < m.maxHp || m.state === 'chase';
      if (!show) continue;
      seen.add(m.id);
      let plate = this.plates.get(m.id);
      if (!plate) { plate = el('div', 'g-plate', `<b></b><div class="g-bar"><span></span></div>`); this.floatLayer.append(plate); this.plates.set(m.id, plate); }
      const [x, y] = project(new THREE.Vector3(m.x, groundHeight(m.x, m.z) + 1.4 * m.def.size + .55, m.z));
      plate.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      plate.querySelector('b').textContent = `${m.name} Lv.${m.level}`;
      plate.querySelector('span').style.width = pct(m.hp, m.maxHp);
      plate.classList.toggle('targeted', m === this.combat.target);
      plate.classList.toggle('hostile', m.state === 'chase');
    }
    for (const [id, plate] of this.plates) if (!seen.has(id)) { plate.remove(); this.plates.delete(id); }
    if (this.combat.target) this.refreshTarget();
    if (c.buffs.length) this.frame.querySelector('.g-buffs').innerHTML = c.buffs.map(b => `<i>${BUFF_ICONS[b.id] || '✧'} ${Math.ceil(b.remaining)}</i>`).join('');
  }
}
