// Combat interface: target frame, action bar, floating numbers, monster
// nameplates, death screen and the day/night mood.
import * as THREE from 'three';
import { SKILLS } from '../data/skills.js';
import { ITEMS } from '../../character/data/items.js';
import { el, pct, setBar } from '../../character/ui/dom.js';
import './combat.css';

export class CombatHUD {
  /**
   * @param {HTMLElement} root    app root (floating numbers go under the panels)
   * @param {HTMLElement} layer   container for panels
   * @param {import('../Combat.js').Combat} combat
   * @param {import('../../character/ui/Feed.js').Feed} feed
   * @param {{potions: HTMLElement[], menus: HTMLElement[]}} [quickButtons]  extra buttons for the action bar
   */
  constructor(root, layer, combat, feed, quickButtons = { potions: [], menus: [] }) {
    this.layer = layer; this.combat = combat; this.c = combat.character; this.feed = feed;
    this.floatLayer = el('div', 'g-floats'); root.insertBefore(this.floatLayer, root.querySelector('.vignette')?.nextSibling || null);
    this.plates = new Map(); this.floats = [];
    this.buildTarget(); this.buildBar(quickButtons); this.buildDeath(); this.bind();
  }

  buildTarget() {
    this.target = el('div', 'g-target glass', `<div class="g-target-name"><b></b><span></span></div><div class="g-bar g-thp"><span></span><em></em></div><div class="g-target-tags"></div>`);
    this.target.hidden = true; this.layer.append(this.target);
  }
  buildBar({ potions, menus }) {
    this.bar = el('div', 'g-skillbar');
    this.skillButtons = this.c.cls.skills.map((id, i) => {
      const s = SKILLS[id];
      const b = el('button', 'g-skill', `<span class="g-skill-icon">${s.icon}</span><kbd>${i + 1}</kbd><i class="g-cd"></i><small>${s.mp ? s.mp : ''}</small>`);
      b.title = `${s.name}${s.mp ? ` · MP ${s.mp}` : ''}${s.cd ? ` · คูลดาวน์ ${s.cd} วิ` : ''}`;
      b.setAttribute('aria-label', s.name); b.dataset.skill = id;
      b.addEventListener('click', () => this.combat.useSkill(id));
      this.bar.append(b); return b;
    });
    if (potions.length) this.bar.append(el('span', 'g-sep'), ...potions);
    if (menus.length) this.bar.append(el('span', 'g-sep'), ...menus);
    this.layer.append(this.bar);
  }
  buildDeath() {
    this.death = el('section', 'g-death', `<h2>คุณหมดสติ</h2><p>วิญญาณยังไม่ไปไหน กลับไปตั้งหลักที่จุดปลอดภัย<br><small>เสียทอง 10% ที่ติดตัว</small></p><button>ฟื้นคืนชีพ</button>`);
    this.death.hidden = true; this.layer.append(this.death);
    this.death.querySelector('button').addEventListener('click', () => this.onRespawn?.());
  }

  bind() {
    const cb = this.combat, feed = this.feed;
    cb.on('target', () => this.refreshTarget());
    cb.on('hit', e => { this.float(e.x, e.z, e.amount, e.crit ? 'crit' : e.dot ? 'dot' : e.pet ? 'pet' : 'deal'); this.refreshTarget(); });
    cb.on('miss', e => this.float(e.x, e.z, 'พลาด', 'miss'));
    cb.on('dodge', e => this.float(e.x, e.z, 'หลบ', 'miss', 1.9));
    cb.on('player-hit', e => this.float(e.x, e.z, e.amount, 'hurt', 1.9));
    cb.on('heal', e => this.float(e.x, e.z, `+${e.amount}`, 'heal', 1.9));
    cb.on('fail', reason => feed.log(reason, 'bad', true));
    cb.on('kill', ({ monster, exp, gold, drops }) => {
      feed.log(`ปราบ${monster.name} · +${exp} EXP · +${gold} ทอง`, 'exp');
      for (const d of drops) feed.log(`ได้รับ ${ITEMS[d.id].name}${d.qty > 1 ? ` ×${d.qty}` : ''}`, ITEMS[d.id].rarity === 'epic' ? 'epic' : 'loot');
      this.float(monster.x, monster.z, `+${exp} EXP`, 'exp', 2.2);
    });
    cb.on('aggro', m => { if (m.def.elite) feed.log(`${m.name} จ้องมองคุณ!`, 'bad'); });
    cb.on('spawn', m => { if (m.def.rare) { feed.log(`มีแสงประหลาดลอยอยู่ในป่า… ${m.name}ปรากฏตัว`, 'epic'); feed.banner(`${m.name}ปรากฏตัว`, 'Rare Monster · ล่าได้เฉพาะยามค่ำคืน'); } });
    cb.on('phase', phase => this.setPhase(phase));
    cb.on('player-death', () => { this.death.hidden = false; });
    cb.on('player-respawn', ({ goldLost }) => { this.death.hidden = true; if (goldLost) feed.log(`เสียทอง ${goldLost}`, 'bad'); });
  }

  // Night switches the whole UI to a moonlit theme (body.g-night).
  setPhase(phase) {
    const night = phase === 'night', feed = this.feed;
    if (night === this.isNight) return;
    const first = this.isNight === undefined; this.isNight = night;
    document.body.classList.toggle('g-night', night);
    if (first && !night) return;
    if (night && this.c.cls.nightCrit) feed.log(`ยามค่ำคืน ${this.c.cls.name}คริติคอล +${this.c.cls.nightCrit * 100}%`, 'epic');
    if (night) { feed.banner('ราตรีมาเยือน', 'ภูตผีออกเดิน · EXP +25% · ผีแรงขึ้น · ระวัง Rare Monster'); feed.log('ค่ำแล้ว สัตว์ป่ากลับรัง ผีป่าเริ่มออกหากิน', 'epic'); }
    else { feed.banner('อรุณรุ่ง', 'ผีกลับคืนสู่เงามืด ป่ากลับมาสงบ'); feed.log('เช้าแล้ว สัตว์ป่ากลับมาหากิน', 'gold'); }
  }

  // Returns true when the key was handled.
  handleKey(e) {
    const k = e.code;
    if (/^Digit[1-4]$/.test(k)) { this.combat.useSkill(this.c.cls.skills[Number(k.slice(5)) - 1]); return true; }
    if (k === 'Tab') { e.preventDefault(); this.combat.cycleTarget(); return true; }
    if (k === 'Space') { e.preventDefault(); this.combat.useSkill(this.combat.basicSkillId()); return true; }
    if (k === 'Escape' && this.combat.target) { this.combat.setTarget(null); return true; }
    return false;
  }

  refreshTarget() {
    const m = this.combat.target;
    this.target.hidden = !m;
    if (!m) return;
    this.target.querySelector('b').textContent = m.name;
    this.target.querySelector('.g-target-name span').textContent = `Lv. ${m.level}${m.def.boss ? ' · บอส' : m.def.elite ? ' · หัวหน้า' : ''}`;
    this.target.classList.toggle('elite', !!m.def.elite);
    setBar(this.target.querySelector('.g-thp'), m.hp, m.maxHp);
    this.target.querySelector('.g-target-tags').innerHTML = m.debuffs.map(d => `<i>${d.slow ? 'ติดบ่วง' : 'ต้องคุณไสย'}</i>`).join('');
  }
  float(x, z, text, kind, height = 1.6) {
    const node = el('span', `g-float ${kind}`); node.textContent = text; this.floatLayer.append(node);
    this.floats.push({ node, pos: new THREE.Vector3(x + (Math.random() - .5) * .4, height, z), age: 0 });
  }

  // Per frame: cooldowns, floating numbers and monster nameplates.
  update(dt, camera, size, groundHeight) {
    const c = this.c, project = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * size.width, (1 - p.y) / 2 * size.height]; };
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
      if (!m.alive || !(m === this.combat.target || m.hp < m.maxHp || m.state === 'chase')) continue;
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
  }
}
