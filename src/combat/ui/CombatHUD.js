// Combat interface: target frame, the action bar (src/ui/ActionBar.js), floating
// numbers, monster nameplates, death screen and the day/night mood.
import * as THREE from 'three';
import { RACE_LABELS, ELEMENT_LABELS } from '../../character/data/cards.js';
import { ITEMS } from '../../character/data/items.js';
import { el, pct, setBar } from '../../character/ui/dom.js';
import { ActionBar } from '../../ui/ActionBar.js';
import { legacyCaster } from '../LegacyCaster.js';
import { bossSkillsFor, bossPhase, BOSS_SKILL_HINTS } from '../bossSkills.js';
import './combat.css';

export class CombatHUD {
  /**
   * @param {HTMLElement} root    app root (floating numbers go under the panels)
   * @param {HTMLElement} layer   container for panels
   * @param {import('../Combat.js').Combat} combat
   * @param {import('../../character/ui/Feed.js').Feed} feed
   * @param {{potions: HTMLElement[], menus: HTMLElement[], exp?: HTMLElement}} [quickButtons]  potion / menu buttons and the EXP bar for the action bar
   */
  constructor(root, layer, combat, feed, quickButtons = { potions: [], menus: [] }) {
    this.layer = layer; this.combat = combat; this.c = combat.character; this.feed = feed;
    this.floatLayer = el('div', 'g-floats'); root.insertBefore(this.floatLayer, root.querySelector('.vignette')?.nextSibling || null);
    this.plates = new Map(); this.floats = [];
    this.buildTarget(); this.buildBar(root, quickButtons); this.buildDeath(); this.bind();
  }

  buildTarget() {
    this.target = el('div', 'g-target glass', `<div class="g-target-name"><b></b><span></span></div><div class="g-bar g-thp"><span></span><em></em></div><div class="g-boss-warning" hidden></div><div class="g-target-tags"></div>`);
    this.target.hidden = true; this.layer.append(this.target);
    // the friend a heal goes to (Combat.ally, picked from the party frame or a name plate: src/net/Social.js)
    this.ally = el('div', 'g-target g-ally glass', `<div class="g-target-name"><b></b><span></span></div><div class="g-bar g-ahp"><span></span><em></em></div><div class="g-bar g-amp"><span></span><em></em></div><button class="g-ally-x" type="button" aria-label="เลิกเลือกเพื่อน" title="เลิกเลือก (Esc)">×</button>`);
    this.ally.hidden = true; this.layer.append(this.ally);
    this.ally.querySelector('.g-ally-x').addEventListener('click', () => this.clearAlly());
    // the cast bar of a skill with a cast time (src/training/KitCaster.js)
    this.castBar = el('div', 'g-castbar glass', '<b></b><div class="g-bar"><span></span></div>');
    this.castBar.hidden = true; this.layer.append(this.castBar);
  }
  // One action bar on every map: the class's four combat skills until a class kit
  // (src/training) swaps in its ten skills with setSkills(); potions and menus stay.
  // It sits in the app root (not this layer) so the --ui zoom applies once.
  buildBar(root, { potions, menus, exp }) {
    this.bar = new ActionBar(root, { potions, menus, exp });
    this.bar.bindAuto({ character: this.c, combat: this.combat });
    this.setSkills(legacyCaster(this.combat), `สกิล${this.c.cls.name}`);
  }
  setSkills(controller, label) { this.bar.setSkills(controller, label); }
  // Safe zone (the city): no fighting tips, Tab / Space do nothing; the bar stays the same.
  // With a healer who can revive in the party (wait = { secs, who }), the respawn button waits
  // `secs` seconds first — a revive on the spot costs no gold — then opens as the fallback.
  deathWait(wait) {
    clearInterval(this.deathTick); this.deathTick = null;
    const btn = this.death.querySelector('button'), hint = this.death.querySelector('.g-death-wait');
    if (!wait) { btn.disabled = false; btn.textContent = 'ฟื้นคืนชีพ'; hint.hidden = true; return; }
    let left = Math.max(0, Math.round(wait.secs));
    hint.hidden = false; hint.textContent = `${wait.who} อยู่ในปาร์ตี้ · รอให้ชุบชีวิตตรงนี้ได้ ไม่เสียทอง`;
    const paint = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? `ฟื้นที่จุดปลอดภัย (${left})` : 'ฟื้นที่จุดปลอดภัย'; };
    paint();
    this.deathTick = setInterval(() => { left -= 1; paint(); if (left <= 0) { clearInterval(this.deathTick); this.deathTick = null; } }, 1000);
  }
  setSafe(on) {
    if (!on && !this.tipped) { this.tipped = true; this.feed?.log('พื้นที่อันตราย · Tab เลือกเป้า · 1–0 ใช้สกิล · G ออโต้ · Q / F ดื่มยา', 'bad'); }
    this.safe = on;
  }
  buildDeath() {
    this.death = el('section', 'g-death', `<h2>คุณหมดสติ</h2><p>วิญญาณยังไม่ไปไหน กลับไปตั้งหลักที่จุดปลอดภัย<br><small>เสียทอง 10% ที่ติดตัว</small></p><p class="g-death-wait" hidden></p><button>ฟื้นคืนชีพ</button>`);
    this.death.hidden = true; this.layer.append(this.death);
    this.death.querySelector('button').addEventListener('click', () => this.onRespawn?.());
  }

  bind() {
    const cb = this.combat, feed = this.feed;
    cb.on('target', () => this.refreshTarget());
    cb.on('hit', e => { this.float(e.x, e.z, e.amount, e.crit ? 'crit' : e.dot ? 'dot' : e.pet ? 'pet' : 'deal'); this.refreshTarget(); });
    cb.on('miss', e => this.float(e.x, e.z, 'พลาด', 'miss'));
    // an effect the server landed (online): its name over the monster, the tags on the target frame
    cb.on('debuffed', ({ monster: m, debuff: d }) => { this.float(m.x, m.z, d.label ?? (d.stun ? 'มึน' : d.slow ? 'เชื่องช้า' : 'ติดพิษ'), 'evo', 2.1); if (m === this.combat.target) this.refreshTarget(); });
    cb.on('dodge', e => this.float(e.x, e.z, 'หลบ', 'miss', 1.9));
    cb.on('player-hit', e => this.float(e.x, e.z, e.amount, 'hurt', 1.9));
    cb.on('heal', e => this.float(e.x, e.z, `+${Math.round(e.amount)}`, 'heal', 1.9));
    cb.on('fail', reason => feed.log(reason, 'bad', true));
    cb.on('casting', e => { this.cast = { ...e, t: 0 }; this.castBar.querySelector('b').textContent = `กำลังร่าย ${e.name}`; this.castBar.hidden = false; this.castBar.classList.remove('done'); });
    const endCast = () => { this.cast = null; this.castBar.hidden = true; };
    cb.on('cast-done', endCast); cb.on('cast-cancel', endCast);
    cb.on('evo-fx', e => this.float(e.x, e.z, e.name, 'evo', 2.4));
    cb.on('kill', ({ monster, exp, gold, drops }) => {
      feed.log(`ปราบ${monster.name} · +${exp} EXP · +${gold} ทอง`, 'exp');
      for (const d of drops) feed.log(`ได้รับ ${ITEMS[d.id].name}${d.qty > 1 ? ` ×${d.qty}` : ''}`, ITEMS[d.id].rarity === 'epic' || ITEMS[d.id].type === 'card' ? 'epic' : 'loot');
      const card = drops.find(d => ITEMS[d.id]?.type === 'card');
      if (card) feed.banner(`ได้รับ${ITEMS[card.id].name}!`, 'คลิกการ์ดในกระเป๋าเพื่อใส่ในช่องการ์ด (กด C ดูช่อง)');
      this.float(monster.x, monster.z, `+${exp} EXP`, 'exp', 2.2);
    });
    cb.on('aggro', m => { if (m.def.elite) feed.log(`${m.name} จ้องมองคุณ!`, 'bad'); });
    cb.on('spawn', m => { if (m.def.rare) { feed.log(`มีแสงประหลาดลอยอยู่ในป่า… ${m.name}ปรากฏตัว`, 'epic'); feed.banner(`${m.name}ปรากฏตัว`, 'Rare Monster · ล่าได้เฉพาะยามค่ำคืน'); } });
    cb.on('phase', phase => this.setPhase(phase));
    cb.on('player-death', () => { this.death.hidden = false; this.deathWait(this.reviveWait?.() ?? null); });
    cb.on('player-revived', () => { this.death.hidden = true; this.deathWait(null); feed.log('ฟื้นคืนชีพตรงจุดที่ล้ม', 'gold'); });
    cb.on('player-respawn', ({ goldLost }) => { this.death.hidden = true; this.deathWait(null); if (goldLost) feed.log(`เสียทอง ${goldLost}`, 'bad'); });
  }

  // Night switches the whole UI to a moonlit theme (body.g-night).
  setPhase(phase) {
    const night = phase === 'night', feed = this.feed;
    if (night === this.isNight) return;
    const first = this.isNight === undefined; this.isNight = night;
    document.body.classList.toggle('g-night', night);
    if (first && !night) return;
    if (this.safe) {
      if (night) { feed.banner('ราตรีมาเยือน', 'ตะเกียงริมน้ำถูกจุดทั่วพระนคร · ลานซ้อมยังเปิด'); feed.log('ค่ำแล้ว แสงตะเกียงสะท้อนผิวน้ำเจ้าพระยา', 'epic'); }
      else { feed.banner('อรุณรุ่ง', 'ระฆังวัดดังทั่วพระนคร · ตลาดเช้าเริ่มคึกคัก'); feed.log('เช้าแล้ว พระออกบิณฑบาตริมคลอง', 'gold'); }
      return;
    }
    if (night && this.c.cls.nightCrit) feed.log(`ยามค่ำคืน ${this.c.cls.name}คริติคอล +${this.c.cls.nightCrit * 100}%`, 'epic');
    if (night) { feed.banner('ราตรีมาเยือน', 'ภูตผีออกเดิน · EXP +25% · ผีแรงขึ้น · ระวัง Rare Monster'); feed.log('ค่ำแล้ว สัตว์ป่ากลับรัง ผีป่าเริ่มออกหากิน', 'epic'); }
    else { feed.banner('อรุณรุ่ง', 'ผีกลับคืนสู่เงามืด ป่ากลับมาสงบ'); feed.log('เช้าแล้ว สัตว์ป่ากลับมาหากิน', 'gold'); }
  }

  // Returns true when the key was handled.
  handleKey(e) {
    const k = e.code;
    if (this.bar.handleKey(e)) return true;
    if (this.safe && (k === 'Tab' || k === 'Space')) return false;
    if (k === 'Tab') { e.preventDefault(); this.combat.cycleTarget(); return true; }
    if (k === 'Space') { e.preventDefault(); this.combat.useSkill(this.combat.basicSkillId()); return true; }
    if (k === 'Escape' && this.combat.target) { this.combat.setTarget(null); return true; }
    if (k === 'Escape' && this.combat.ally) { this.clearAlly(); return true; }
    return false;
  }

  clearAlly() { this.combat.ally = null; this.combat.emit('ally', null); this.refreshAlly(); }
  // the green frame of the friend picked: name, class and level, HP / MP (signed-in friends), and
  // whether they are here (same map and channel) and up
  refreshAlly() {
    const pick = this.combat.ally, a = pick && this.combat.allies?.().find(x => x.id === pick.id);
    this.ally.hidden = !pick;
    if (!pick) return;
    this.ally.querySelector('b').textContent = a?.name ?? 'เพื่อน';
    this.ally.querySelector('.g-target-name span').textContent = !a ? 'อยู่คนละแผนที่ / แชนแนล' : !a.alive ? 'หมดสติ' : `เป้าฮีล · Lv ${a.lv}`;
    this.ally.classList.toggle('away', !a?.alive);
    // a guest friend's HP / MP is not known to the server: an empty bar
    if (a?.maxHp) setBar(this.ally.querySelector('.g-ahp'), a.hp, a.maxHp); else setBar(this.ally.querySelector('.g-ahp'), 0, 1, '—');
    if (a?.maxMp) setBar(this.ally.querySelector('.g-amp'), a.mp, a.maxMp); else setBar(this.ally.querySelector('.g-amp'), 0, 1, '—');
  }

  refreshTarget() {
    const m = this.combat.target;
    this.target.hidden = !m;
    if (!m) return;
    const boss = bossSkillsFor(m).length > 0;
    this.target.classList.toggle('boss-target', boss);
    this.target.querySelector('b').textContent = m.name;
    const kind = [RACE_LABELS[m.def.race], ELEMENT_LABELS[m.def.element]].filter(Boolean).join('·');
    this.target.querySelector('.g-target-name span').textContent = `Lv. ${m.level}${boss ? ` · บอส · ระยะ ${bossPhase(m)}` : m.def.elite ? ' · หัวหน้า' : ''}${kind && !boss ? ` · ${kind}` : ''}`;
    this.target.classList.toggle('elite', !!m.def.elite);
    setBar(this.target.querySelector('.g-thp'), m.hp, m.maxHp);
    const warning = this.target.querySelector('.g-boss-warning');
    warning.hidden = !m.skillCast;
    warning.textContent = m.skillCast ? `${m.skillCast.name} · ${BOSS_SKILL_HINTS[m.skillCast.shape]}` : '';
    this.target.querySelector('.g-target-tags').innerHTML = m.debuffs.map(d => `<i>${d.label ?? (d.slow ? 'ติดบ่วง' : 'ต้องคุณไสย')}</i>`).join('');
  }
  float(x, z, text, kind, height = 1.6) {
    const node = el('span', `g-float ${kind}`); node.textContent = text; this.floatLayer.append(node);
    this.floats.push({ node, pos: new THREE.Vector3(x + (Math.random() - .5) * .4, height, z), age: 0 });
  }

  // Per frame: the action bar, floating numbers and monster nameplates.
  update(dt, camera, size, groundHeight) {
    if (this.cast) { this.cast.t += dt; this.castBar.querySelector('span').style.width = `${Math.min(100, this.cast.t / this.cast.total * 100)}%`; }
    const project = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * size.width, (1 - p.y) / 2 * size.height]; };
    this.bar.update(dt);
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
    if (this.combat.ally || !this.ally.hidden) this.refreshAlly();
  }
}
