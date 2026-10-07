import { assetIcon } from './icons.js';
// AUTO settings (the ⚙ next to AUTO on the action bar, src/ui/ActionBar.js): which
// skills AUTO may cast, potion thresholds, survival skills when HP is low, target
// priority and how far it looks for the next monster. AUTO only runs while the player
// is online and in the game; loot already goes straight into the bag.
//
//   loadAuto() / saveAuto(s)                     per-browser settings
//   autoPotion(s, hpFrac, mpFrac) → 'hp' | 'mp' | null
//   autoRest(s, hpFrac, mpFrac, resting) → sit / keep sitting?
//   pickTarget(monsters, me, s, current, now?, reach?) → monster | null
//   castOrder(slots, s, hpFrac, next) → slot indices to try, in order
//   new AutoPanel(host, getSettings, onChange).open(slots)
import { draggable } from './draggable.js';
const KEY = 'thainative.auto';
export const AUTO_RANGES = { near: 7, mid: 11, far: 14 };   // metres around the player
export const DEFAULT_AUTO = {
  off: [],              // slot indices AUTO skips
  basic: true,          // basic attacks between skills (casters may turn it off to save MP)
  hpPotion: 40,         // drink an HP potion below this % (0 = never)
  mpPotion: 25,         // drink an MP potion below this %
  survive: 45,          // below this % HP, survival skills (buffs, heals) go first
  restHp: 30,           // out of a fight below this % HP: sit and rest (RO: double regen) …
  restMp: 15,           // … or below this % MP
  restTo: 90,           // … until HP and MP (whichever rest is on) are back to this %
  attackers: true,      // monsters hitting me come first
  elites: true,         // then elites and bosses
  range: 'mid',
};
const clampPct = v => Math.max(0, Math.min(90, Math.round(Number(v) || 0)));
export function normalizeAuto(s = {}) {
  const o = { ...DEFAULT_AUTO, ...s };
  return { off: Array.isArray(o.off) ? o.off.filter(Number.isInteger) : [], hpPotion: clampPct(o.hpPotion), mpPotion: clampPct(o.mpPotion), survive: clampPct(o.survive), restHp: clampPct(o.restHp), restMp: clampPct(o.restMp), restTo: Math.min(100, Math.max(50, Math.round(Number(o.restTo)) || 90, clampPct(o.restHp) + 10, clampPct(o.restMp) + 10)),   // stands up well above where it sat down
    basic: !!o.basic, attackers: !!o.attackers, elites: !!o.elites, range: AUTO_RANGES[o.range] ? o.range : DEFAULT_AUTO.range };
}
export function loadAuto() { try { return normalizeAuto(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return normalizeAuto(); } }
export function saveAuto(s) { try { localStorage.setItem(KEY, JSON.stringify(normalizeAuto(s))); } catch { /* private mode */ } }

export function autoPotion(s, hpFrac, mpFrac) {
  if (s.hpPotion && hpFrac * 100 < s.hpPotion) return 'hp';
  if (s.mpPotion && mpFrac * 100 < s.mpPotion) return 'mp';
  return null;
}

// Resting (sitting, Combat.sit): starts out of a fight once HP or MP is under its line, goes on
// until every stat with a line is back to `restTo`.
export function autoRest(s, hpFrac, mpFrac, resting = false) {
  const hp = hpFrac * 100, mp = mpFrac * 100;
  if (resting) return (!!s.restHp && hp < s.restTo) || (!!s.restMp && mp < s.restTo);
  return (!!s.restHp && hp < s.restHp) || (!!s.restMp && mp < s.restMp);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// "Attacking us" means it swung at this player in the last ATTACKER_SECS (Combat.monsterAttack
// stamps `swungAtMe`; online a monster chasing someone else does not count). Among the rest
// the nearest wins; with `elites` on, an elite or boss counts ELITE_PULL metres nearer.
// The current target is kept while we are already trading blows with it (within `reach`, the
// player's attack range, + 1 m) or it is hitting us; one we are still walking to is dropped for
// another that is SWITCH_GAIN metres nearer.
// One with no way to it (Combat sets `unreachableAt`) is skipped for UNREACHABLE_SECS.
export const ATTACKER_SECS = 5, ELITE_PULL = 3, SWITCH_GAIN = 2, UNREACHABLE_SECS = 6;
export function pickTarget(monsters, me, s, current = null, now = Date.now(), reach = 2) {
  const R = AUTO_RANGES[s.range] ?? AUTO_RANGES.mid;
  const hitting = m => s.attackers && m.swungAtMe && now - m.swungAtMe < ATTACKER_SECS * 1000;
  const reachable = m => !(now - (m.unreachableAt ?? -Infinity) < UNREACHABLE_SECS * 1000);
  const near = monsters.filter(m => m.alive && m.state !== 'dormant' && dist(m, me) <= R && reachable(m));
  const live = current?.alive && current.state !== 'dormant' && reachable(current) && dist(current, me) <= R + 2 ? current : null;
  if (live && (hitting(live) || (dist(live, me) <= reach + 1 && !near.some(hitting)))) return live;
  const score = m => (hitting(m) ? -1000 : 0) + dist(m, me) - (s.elites && (m.def?.boss || m.def?.elite) ? ELITE_PULL : 0);
  const best = near.sort((a, b) => score(a) - score(b))[0] ?? null;
  if (live && (!best || score(live) - SWITCH_GAIN <= score(best))) return live;
  return best;
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
    draggable(this.root, { key: 'auto', handle: '.ro-title' });
    this.root.addEventListener('click', e => {
      if (e.target.closest('.auto-close')) { this.close(); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const i = Number(slot.dataset.slot), s = this.get(), off = s.off.includes(i) ? s.off.filter(x => x !== i) : [...s.off, i]; this.set({ off }); return; }
      const step = e.target.closest('[data-step]');
      if (step) { const [k, d] = step.dataset.step.split(':'); const v = this.get()[k] + Number(d); this.set({ [k]: k === 'restTo' ? Math.max(50, Math.min(100, v)) : clampPct(v) }); return; }
      const rg = e.target.closest('[data-range]'); if (rg) { this.set({ range: rg.dataset.range }); return; }
      if (e.target.closest('.auto-reset')) this.set({ ...DEFAULT_AUTO });
    });
    this.root.addEventListener('change', e => { const k = e.target.dataset.key; if (k) this.set({ [k]: e.target.checked }, false); });
    this.root.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) e.stopPropagation(); });
    this.root.addEventListener('click', e => e.target.closest('button')?.blur());   // a clicked button does not keep the focus (Enter / Space would press it again)
  }
  set(patch, redraw = true) { this.onChange({ ...this.get(), ...patch }); if (redraw) this.render(); }
  get isOpen() { return !this.root.hidden; }
  open(slots) { this.slots = slots; this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; }
  toggle(slots) { if (this.isOpen) this.close(); else this.open(slots); }
  // Laid out as the design "UI ใหม่" draws it: three columns of cards (skills · recovery ·
  // targets), steppers for the thresholds, switches, the search radius in metres.
  render() {
    const s = this.get(), slots = this.slots ?? [];
    const sw = (key, label, hint = '') => `<label class="auto-orow"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="auto-sw" data-key="${key}" ${s[key] ? 'checked' : ''}></label>`;
    const stepper = (key, label, hint = '') => `<div class="auto-stepper"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><div class="auto-step"><button type="button" data-step="${key}:-5" aria-label="ลด">−</button><output>${s[key] ? `${s[key]}%` : 'ปิด'}</output><button type="button" data-step="${key}:5" aria-label="เพิ่ม">+</button></div></div>`;
    const survivors = slots.filter(sl => sl.survival).map(sl => sl.name).join(' · ');
    this.root.innerHTML = `<div class="ro-title"><kbd class="auto-kc">G</kbd>ตั้งค่า AUTO<button class="auto-close" aria-label="ปิด">×</button></div>
      <div class="auto-grid">
        <div class="auto-card"><h4>สกิล <small>แตะเพื่อเปิด/ปิด</small></h4>
          <div class="auto-skills">${slots.map((sl, i) => { const off = s.off.includes(i); return `<button type="button" data-slot="${i}" class="${off ? 'off' : ''}${sl.survival ? ' survival' : ''}" title="${sl.name}${sl.survival ? ' · สกิลเอาตัวรอด' : ''}"><i class="k">${(i + 1) % 10}</i>${off ? '' : '<i class="ok">✓</i>'}${sl.icon ? assetIcon(sl.icon) : `<b>${sl.html ?? ''}</b>`}<span>${sl.name}</span></button>`; }).join('')}</div>
          <div class="auto-legend"><span><i class="atk"></i>สกิลโจมตี</span><span><i class="sv"></i>สกิลเอาตัวรอด ใช้ก่อนเมื่อ HP ต่ำ</span></div>
          ${sw('basic', 'ตีปกติระหว่างรอสกิล', 'ปิดไว้เพื่อประหยัด MP สำหรับสายเวท')}</div>
        <div class="auto-card"><h4>ฟื้นฟู</h4>
          ${stepper('hpPotion', 'ดื่มยา HP เมื่อต่ำกว่า', 'ใช้ยาหม้อที่ดีที่สุดในกระเป๋า')}
          ${stepper('survive', 'ใช้สกิลเอาตัวรอดเมื่อ HP ต่ำกว่า', survivors)}
          ${stepper('mpPotion', 'ดื่มยา MP เมื่อต่ำกว่า', 'ใช้น้ำผึ้งป่า')}
          ${stepper('restHp', 'นั่งพักเมื่อ HP ต่ำกว่า', 'หลังจบการต่อสู้ · นั่งแล้วฟื้นเร็วขึ้น 2 เท่า')}
          ${stepper('restMp', 'นั่งพักเมื่อ MP ต่ำกว่า')}
          ${stepper('restTo', 'ลุกขึ้นสู้ต่อเมื่อฟื้นถึง', 'ถูกตีระหว่างนั่ง จะลุกขึ้นสู้ทันที')}
          <p class="auto-note">ยาที่ใช้คือของในช่อง Q และ F · ตั้งเป็น "ปิด" ถ้าไม่อยากให้ AUTO ดื่มยาเอง</p></div>
        <div class="auto-card"><h4>เป้าหมาย</h4>
          ${sw('attackers', 'ตัวที่กำลังตีเราก่อน', 'AUTO สู้กลับมอนที่ตีเราอยู่')}
          ${sw('elites', 'หัวหน้า / บอส ก่อน')}
          <div class="auto-orow col"><span>ระยะหาเป้าหมาย<small>เดินหามอนรอบตัวในระยะนี้</small></span>
            <div class="auto-radius">${Object.entries({ near: 'ใกล้', mid: 'กลาง', far: 'ไกล' }).map(([k, t]) => `<button type="button" data-range="${k}" aria-pressed="${s.range === k}">${t} ${AUTO_RANGES[k]} ม.</button>`).join('')}</div></div>
          <div class="auto-orow"><span>ของที่ตก<small>เข้ากระเป๋าเองอยู่แล้ว</small></span><b class="auto-good">อัตโนมัติ</b></div>
          <p class="auto-note">AUTO ทำงานเฉพาะตอนออนไลน์ · ใช้สกิลเองเมื่อไหร่ AUTO จะหยุด</p></div>
      </div>
      <div class="auto-foot"><span>บันทึกอัตโนมัติ</span><button type="button" class="auto-reset">คืนค่าเริ่มต้น</button></div>`;
  }
}
