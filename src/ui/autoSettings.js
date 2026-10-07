// AUTO settings (the ⚙ next to AUTO on the action bar, src/ui/ActionBar.js): which
// skills AUTO may cast, potion thresholds, survival skills when HP is low, target
// priority and how far it looks for the next monster. AUTO only runs while the player
// is online and in the game; loot already goes straight into the bag.
//
//   loadAuto() / saveAuto(s)                     per-browser settings
//   autoPotion(s, hpFrac, mpFrac) → 'hp' | 'mp' | null
//   pickTarget(monsters, me, s, current) → monster | null
//   castOrder(slots, s, hpFrac, next) → slot indices to try, in order
//   new AutoPanel(host, getSettings, onChange).open(slots)
const KEY = 'thainative.auto';
export const AUTO_RANGES = { near: 7, mid: 11, far: 14 };   // metres around the player
export const DEFAULT_AUTO = {
  off: [],              // slot indices AUTO skips
  basic: true,          // basic attacks between skills (casters may turn it off to save MP)
  hpPotion: 40,         // drink an HP potion below this % (0 = never)
  mpPotion: 25,         // drink an MP potion below this %
  survive: 45,          // below this % HP, survival skills (buffs, heals) go first
  attackers: true,      // monsters hitting me come first
  elites: true,         // then elites and bosses
  range: 'mid',
};
const clampPct = v => Math.max(0, Math.min(90, Math.round(Number(v) || 0)));
export function normalizeAuto(s = {}) {
  const o = { ...DEFAULT_AUTO, ...s };
  return { off: Array.isArray(o.off) ? o.off.filter(Number.isInteger) : [], hpPotion: clampPct(o.hpPotion), mpPotion: clampPct(o.mpPotion), survive: clampPct(o.survive),
    basic: !!o.basic, attackers: !!o.attackers, elites: !!o.elites, range: AUTO_RANGES[o.range] ? o.range : DEFAULT_AUTO.range };
}
export function loadAuto() { try { return normalizeAuto(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return normalizeAuto(); } }
export function saveAuto(s) { try { localStorage.setItem(KEY, JSON.stringify(normalizeAuto(s))); } catch { /* private mode */ } }

export function autoPotion(s, hpFrac, mpFrac) {
  if (s.hpPotion && hpFrac * 100 < s.hpPotion) return 'hp';
  if (s.mpPotion && mpFrac * 100 < s.mpPotion) return 'mp';
  return null;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// "Attacking us" means it swung at this player in the last ATTACKER_SECS (Combat.monsterAttack
// stamps `swungAtMe`; online a monster chasing someone else does not count). Among the rest
// the nearest wins; with `elites` on, an elite or boss counts ELITE_PULL metres nearer.
export const ATTACKER_SECS = 5, ELITE_PULL = 3;
export function pickTarget(monsters, me, s, current = null, now = Date.now()) {
  const R = AUTO_RANGES[s.range] ?? AUTO_RANGES.mid;
  const hitting = m => s.attackers && m.swungAtMe && now - m.swungAtMe < ATTACKER_SECS * 1000;
  const near = monsters.filter(m => m.alive && m.state !== 'dormant' && dist(m, me) <= R);
  // a live current target in reach is kept, unless something else is hitting us and it is not
  if (current?.alive && dist(current, me) <= R + 2 && (hitting(current) || !near.some(hitting))) return current;
  if (!near.length) return null;
  const score = m => (hitting(m) ? -1000 : 0) + dist(m, me) - (s.elites && (m.def?.boss || m.def?.elite) ? ELITE_PULL : 0);
  return near.sort((a, b) => score(a) - score(b))[0];
}

// Slots to try this tick: enabled ones in bar order from `next`; when HP is under the
// survival line, survival skills (quick buffs / heals) are tried first.
export function castOrder(slots, s, hpFrac, next = 0) {
  const n = slots.length, order = [];
  for (let k = 0; k < n; k++) { const i = (next + k) % n; if (!s.off.includes(i)) order.push(i); }
  if (s.survive && hpFrac * 100 < s.survive) {
    const sv = order.filter(i => slots[i]?.survival), rest = order.filter(i => !slots[i]?.survival);
    return [...sv, ...rest];
  }
  return order;
}

// ---- the settings panel ---------------------------------------------------------------
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export class AutoPanel {
  constructor(host, get, onChange) {
    this.get = get; this.onChange = onChange;
    this.root = el('section', 'auto-panel ro-window'); this.root.hidden = true; this.root.setAttribute('aria-label', 'ตั้งค่า AUTO');
    host.append(this.root);
    this.root.addEventListener('click', e => {
      if (e.target.closest('.auto-close')) { this.close(); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const i = Number(slot.dataset.slot), s = this.get(), off = s.off.includes(i) ? s.off.filter(x => x !== i) : [...s.off, i]; this.set({ off }); return; }
      const rg = e.target.closest('[data-range]'); if (rg) this.set({ range: rg.dataset.range });
    });
    this.root.addEventListener('input', e => { const k = e.target.dataset.key; if (!k) return; this.set({ [k]: e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value) }, false); });
    this.root.addEventListener('keydown', e => e.stopPropagation());
  }
  set(patch, redraw = true) { this.onChange({ ...this.get(), ...patch }); if (redraw) this.render(); else this.labels(); }
  get isOpen() { return !this.root.hidden; }
  open(slots) { this.slots = slots; this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; }
  toggle(slots) { if (this.isOpen) this.close(); else this.open(slots); }
  labels() { const s = this.get(); for (const k of ['hpPotion', 'mpPotion', 'survive']) { const o = this.root.querySelector(`[data-out="${k}"]`); if (o) o.textContent = s[k] ? `${s[k]}%` : 'ปิด'; } }
  render() {
    const s = this.get(), slots = this.slots ?? [];
    const slider = (key, label, hint) => `<label class="auto-row" title="${hint}"><span>${label}</span><input type="range" min="0" max="90" step="5" value="${s[key]}" data-key="${key}"><b data-out="${key}"></b></label>`;
    const check = (key, label) => `<label class="auto-check"><input type="checkbox" data-key="${key}" ${s[key] ? 'checked' : ''}> ${label}</label>`;
    this.root.innerHTML = `<div class="ro-title">ตั้งค่า AUTO<button class="auto-close" aria-label="ปิด">×</button></div>
      <h4>สกิลที่ใช้ <small>แตะเพื่อเปิด/ปิด</small></h4>
      <div class="auto-slots">${slots.map((sl, i) => `<button type="button" data-slot="${i}" class="${s.off.includes(i) ? 'off' : ''}${sl.survival ? ' survival' : ''}" title="${sl.name}${sl.survival ? ' · สกิลเอาตัวรอด' : ''}">${sl.icon ? `<img src="${sl.icon}" alt="">` : `<span>${sl.html ?? ''}</span>`}<small>${(i + 1) % 10}</small></button>`).join('')}</div>
      ${check('basic', 'ตีปกติระหว่างรอสกิล')}
      <h4>ฟื้นฟู</h4>
      ${slider('hpPotion', 'ดื่มยา HP เมื่อต่ำกว่า', 'ใช้ยาหม้อที่ดีที่สุดในกระเป๋า')}
      ${slider('mpPotion', 'ดื่มยา MP เมื่อต่ำกว่า', 'ใช้น้ำผึ้งป่า')}
      ${slider('survive', 'HP ต่ำกว่านี้ ใช้สกิลเอาตัวรอดก่อน', 'บัฟ/ฮีล (กรอบเขียว) ถูกใช้ก่อนสกิลโจมตี')}
      <h4>เป้าหมาย</h4>
      ${check('attackers', 'ตัวที่กำลังตีเราก่อน')}
      ${check('elites', 'หัวหน้า / บอส ก่อน')}
      <div class="auto-range"><span>ระยะหาเป้า</span>${Object.entries({ near: 'ใกล้', mid: 'กลาง', far: 'ไกล' }).map(([k, t]) => `<button type="button" data-range="${k}" aria-pressed="${s.range === k}">${t}</button>`).join('')}</div>
      <p class="auto-note">AUTO ทำงานเฉพาะตอนออนไลน์ · ของที่ตกเข้ากระเป๋าเอง · ใช้สกิลเองเมื่อไหร่ AUTO จะหยุด</p>`;
    this.labels();
  }
}
