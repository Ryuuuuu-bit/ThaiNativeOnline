import { assetIcon } from './icons.js';
// AUTO settings (the ⚙ next to AUTO on the action bar, src/ui/ActionBar.js): which
// skills AUTO may cast, potion thresholds, survival skills when HP is low, target
// priority and how far it looks for the next monster. AUTO only runs while the player
// is online and in the game; loot already goes straight into the bag.
//
//   loadAuto() / saveAuto(s)                     per-browser settings
//   autoPotion(s, hpFrac, mpFrac) → 'hp' | 'mp' | null
//   pickTarget(monsters, me, s, current, now?, reach?) → monster | null
//   skillSequence(slots, s) → enabled skill slots in the player's order
//   castOrder(slots, s, hpFrac, next) → slot indices to try, in order
//   nextAfter(slots, s, i) → the slot AUTO tries first after casting slot i
//   huntList(mapId) → [{ type, name, level, elite, boss }] the monsters a map spawns
//   wantedTypes(s, mapId) → Set of monster types AUTO may pick there | null (all)
//   new AutoPanel(host, getSettings, onChange).open(slots, { map, mapName })
import { draggable } from './draggable.js';
import { combatSpawns } from '../data/spawns.js';
import { MONSTERS } from '../combat/data/monsters.js';
import { mapOf } from '../world/maps.js';
const KEY = 'thainative.auto';
export const AUTO_RANGES = { near: 7, mid: 11, far: 14, map: Infinity };   // current map only
export const DEFAULT_AUTO = {
  off: [],              // slot indices AUTO skips
  order: [],            // slot indices in the order AUTO uses them (missing slots follow in bar order)
  mode: 'cycle',        // 'cycle': take turns down the order · 'priority': always the first ready one
  mobs: {},             // { mapId: [monster types] } AUTO hunts there; none listed = every monster
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
  const ints = a => Array.isArray(a) ? [...new Set(a.filter(Number.isInteger))] : [];
  const mobs = {};
  if (o.mobs && typeof o.mobs === 'object' && !Array.isArray(o.mobs)) for (const [map, list] of Object.entries(o.mobs)) {
    const types = Array.isArray(list) ? [...new Set(list.filter(t => typeof t === 'string' && MONSTERS[t]))].slice(0, 64) : [];
    if (types.length) mobs[map] = types;
  }
  return { off: ints(o.off), order: ints(o.order), mode: o.mode === 'priority' ? 'priority' : 'cycle', mobs, hpPotion: clampPct(o.hpPotion), mpPotion: clampPct(o.mpPotion), survive: clampPct(o.survive),
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
// The current target is kept while we are already trading blows with it (within `reach`, the
// player's attack range, + 1 m) or it is hitting us; one we are still walking to is dropped for
// another that is SWITCH_GAIN metres nearer.
// One with no way to it (Combat sets `unreachableAt`) is skipped for UNREACHABLE_SECS.
export const ATTACKER_SECS = 5, ELITE_PULL = 3, SWITCH_GAIN = 2, UNREACHABLE_SECS = 6;
// With a hunt list for the map (s.mobs), only those types are picked; a monster that is hitting
// us is still fought back while `attackers` is on, so a filter never leaves the player defenceless.
export function pickTarget(monsters, me, s, current = null, now = Date.now(), reach = 2) {
  const R = AUTO_RANGES[s.range] ?? AUTO_RANGES.mid;
  const hitting = m => s.attackers && m.swungAtMe && now - m.swungAtMe < ATTACKER_SECS * 1000;
  const reachable = m => !(now - (m.unreachableAt ?? -Infinity) < UNREACHABLE_SECS * 1000);
  const sameMap = m => !me.map || !m.map || m.map === me.map;
  const wanted = wantedTypes(s, me.map ?? mapOf(me.x, me.z)), allowed = m => !wanted || wanted.has(m.type) || hitting(m);
  const near = monsters.filter(m => sameMap(m) && m.alive && m.state !== 'dormant' && dist(m, me) <= R && reachable(m) && allowed(m));
  const live = sameMap(current ?? {}) && current?.alive && current.state !== 'dormant' && reachable(current) && dist(current, me) <= R && allowed(current) ? current : null;
  if (live && (hitting(live) || (dist(live, me) <= reach + 1 && !near.some(hitting)))) return live;
  const score = m => (hitting(m) ? -1000 : 0) + dist(m, me) - (s.elites && (m.def?.boss || m.def?.elite) ? ELITE_PULL : 0);
  const best = near.sort((a, b) => score(a) - score(b))[0] ?? null;
  if (live && (!best || score(live) - SWITCH_GAIN <= score(best))) return live;
  return best;
}

// The monsters a map spawns (its spawn roster), weakest first, for the hunt list.
export function huntList(mapId) {
  const seen = new Map();
  for (const z of combatSpawns()) {
    const def = MONSTERS[z.type];
    if (!def || seen.has(z.type) || mapOf(z.x, z.z) !== mapId) continue;
    seen.set(z.type, { type: z.type, name: def.name, level: def.level, elite: !!def.elite, boss: !!def.boss });
  }
  return [...seen.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'th'));
}
export const wantedTypes = (s, mapId) => s.mobs?.[mapId]?.length ? new Set(s.mobs[mapId]) : null;

// The enabled skill slots in the player's order (s.order first, then the rest in bar order).
const isSkill = sl => sl && sl.type !== 'item' && (!sl.kind || sl.kind === 'skill');
export function skillSequence(slots, s) {
  const order = (s.order ?? []).filter(i => i < slots.length), seq = [...order, ...slots.map((_, i) => i).filter(i => !order.includes(i))];
  return seq.filter(i => isSkill(slots[i]) && !s.off.includes(i));
}
// Slots to try this tick. 'cycle' takes turns down the sequence from `next` (a slot index);
// 'priority' always starts at the top. When HP is under the survival line, survival skills
// (quick buffs / heals) are tried first.
export function castOrder(slots, s, hpFrac, next = 0) {
  const seq = skillSequence(slots, s);
  let start = s.mode === 'priority' ? 0 : seq.indexOf(next);
  if (start < 0) start = Math.max(0, seq.findIndex(i => i >= next));   // `next` is off or empty: the next one along the bar
  const order = [...seq.slice(start), ...seq.slice(0, start)];
  if (s.survive && hpFrac * 100 < s.survive) {
    const sv = order.filter(i => slots[i]?.survival), rest = order.filter(i => !slots[i]?.survival);
    return [...sv, ...rest];
  }
  return order;
}
export function nextAfter(slots, s, i) { const seq = skillSequence(slots, s), k = seq.indexOf(i); return k < 0 ? i + 1 : seq[(k + 1) % seq.length]; }

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
      const move = e.target.closest('[data-move]');
      if (move) { const [i, d] = move.dataset.move.split(':').map(Number), list = this.skillList(), k = list.indexOf(i), j = k + d;
        if (k >= 0 && j >= 0 && j < list.length) { [list[k], list[j]] = [list[j], list[k]]; this.set({ order: list }); } return; }
      const mode = e.target.closest('[data-mode]'); if (mode) { this.set({ mode: mode.dataset.mode }); return; }
      const mob = e.target.closest('[data-mob]');
      if (mob) { const map = this.ctx?.map; if (!map) return;
        const s = this.get(), cur = s.mobs[map] ?? [], t = mob.dataset.mob;
        let next = t === '*' ? [] : cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
        if (next.length >= huntList(map).length) next = [];   // every one ticked is the same as all
        const mobs = { ...s.mobs }; if (next.length) mobs[map] = next; else delete mobs[map];
        this.set({ mobs }); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { const i = Number(slot.dataset.slot), s = this.get(), off = s.off.includes(i) ? s.off.filter(x => x !== i) : [...s.off, i]; this.set({ off }); return; }
      const step = e.target.closest('[data-step]');
      if (step) { const [k, d] = step.dataset.step.split(':'); const v = this.get()[k] + Number(d); this.set({ [k]: clampPct(v) }); return; }
      const rg = e.target.closest('[data-range]'); if (rg) { this.set({ range: rg.dataset.range }); return; }
      if (e.target.closest('.auto-reset')) this.set({ ...DEFAULT_AUTO });
    });
    this.root.addEventListener('change', e => { const k = e.target.dataset.key; if (k) this.set({ [k]: e.target.checked }, false); });
    this.root.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) e.stopPropagation(); });
    this.root.addEventListener('click', e => e.target.closest('button')?.blur());   // a clicked button does not keep the focus (Enter / Space would press it again)
  }
  set(patch, redraw = true) { this.onChange({ ...this.get(), ...patch }); if (redraw) this.render(); }
  get isOpen() { return !this.root.hidden; }
  // ctx: { map, mapName, safe } of where the player stands (the hunt list is per map)
  open(slots, ctx = {}) { this.slots = slots; this.ctx = ctx; this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; }
  toggle(slots, ctx) { if (this.isOpen) this.close(); else this.open(slots, ctx); }
  // every skill slot on the bar (on or off) in the player's order
  skillList() { const slots = this.slots ?? []; return skillSequence(slots, { ...this.get(), off: [] }); }
  // Laid out as the design "UI ใหม่" draws it: three columns of cards (skills · recovery ·
  // targets), steppers for the thresholds, switches, the search radius in metres.
  render() {
    const s = this.get(), slots = this.slots ?? [];
    const sw = (key, label, hint = '') => `<label class="auto-orow"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="auto-sw" data-key="${key}" ${s[key] ? 'checked' : ''}></label>`;
    const stepper = (key, label, hint = '') => `<div class="auto-stepper"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><div class="auto-step"><button type="button" data-step="${key}:-5" aria-label="ลด">−</button><output>${s[key] ? `${s[key]}%` : 'ปิด'}</output><button type="button" data-step="${key}:5" aria-label="เพิ่ม">+</button></div></div>`;
    const survivors = slots.filter(sl => sl?.survival).map(sl => sl.name).join(' · ');
    const list = this.skillList(); let n = 0;
    const tile = (i, k) => { const sl = slots[i], off = s.off.includes(i); if (!off) n++;
      return `<div class="auto-tile"><button type="button" data-slot="${i}" class="auto-tog${off ? ' off' : ''}${sl.survival ? ' survival' : ''}" title="${sl.name}${sl.survival ? ' · สกิลเอาตัวรอด' : ''}"><i class="k">${(i + 1) % 10}</i>${off ? '' : '<i class="ok">✓</i>'}${sl.icon ? assetIcon(sl.icon) : `<b>${sl.html ?? ''}</b>`}<span>${sl.name}</span></button>`
        + `<div class="auto-move"><button type="button" data-move="${i}:-1" aria-label="ใช้ ${sl.name} ก่อนหน้านี้" ${k ? '' : 'disabled'}>‹</button><em title="${off ? 'ปิดอยู่' : `ใช้เป็นลำดับที่ ${n}`}">${off ? 'ปิด' : n}</em><button type="button" data-move="${i}:1" aria-label="ใช้ ${sl.name} ทีหลัง" ${k < list.length - 1 ? '' : 'disabled'}>›</button></div></div>`; };
    const ctx = this.ctx ?? {}, mobs = ctx.map && !ctx.safe ? huntList(ctx.map) : [], wanted = wantedTypes(s, ctx.map);
    const hunt = mobs.length
      ? `<div class="auto-mobs"><button type="button" data-mob="*" aria-pressed="${!wanted}">ตีทั้งหมด</button>${mobs.map(m => `<button type="button" data-mob="${m.type}" class="${m.boss ? 'boss' : m.elite ? 'elite' : ''}" aria-pressed="${!!wanted?.has(m.type)}">${m.name}<small>Lv ${m.level}</small></button>`).join('')}</div>`
      : '<p class="auto-none">ในเมืองไม่มีมอนสเตอร์ · เลือกได้เมื่ออยู่ในแผนที่ล่ามอน</p>';
    this.root.innerHTML = `<div class="ro-title"><kbd class="auto-kc">R</kbd>ตั้งค่า AUTO<button class="auto-close" aria-label="ปิด">×</button></div>
      <div class="auto-grid">
        <div class="auto-card"><h4>สกิล <small>แตะเพื่อเปิด/ปิด · ‹ › เลื่อนลำดับ</small></h4>
          <div class="auto-skills">${list.map(tile).join('')}</div>
          <div class="auto-orow col"><span>วิธีใช้สกิล<small>${s.mode === 'priority' ? 'ใช้สกิลลำดับต้นทุกครั้งที่พร้อม ตัวถัดไปใช้ตอนตัวแรกติดคูลดาวน์' : 'ใช้ไล่ตามลำดับ 1 → 2 → 3 แล้ววนกลับ'}</small></span>
            <div class="auto-radius two">${[['cycle', 'วนตามลำดับ'], ['priority', 'ลำดับต้นก่อนเสมอ']].map(([k, t]) => `<button type="button" data-mode="${k}" aria-pressed="${s.mode === k}">${t}</button>`).join('')}</div></div>
          <div class="auto-legend"><span><i class="atk"></i>สกิลโจมตี</span><span><i class="sv"></i>สกิลเอาตัวรอด ใช้ก่อนเมื่อ HP ต่ำ</span></div>
          ${sw('basic', 'ตีปกติระหว่างรอสกิล', 'ปิดไว้เพื่อประหยัด MP สำหรับสายเวท')}</div>
        <div class="auto-card"><h4>ฟื้นฟู</h4>
          ${stepper('hpPotion', 'ดื่มยา HP เมื่อต่ำกว่า', 'ใช้ขวดเลือดที่สวมใส่ในช่อง Q')}
          ${stepper('survive', 'ใช้สกิลเอาตัวรอดเมื่อ HP ต่ำกว่า', survivors)}
          ${stepper('mpPotion', 'ดื่มยา MP เมื่อต่ำกว่า', 'ใช้ขวดมานาที่สวมใส่ในช่อง E')}
          <p class="auto-note">ยาที่ใช้คือของในช่อง Q และ E · ตั้งเป็น "ปิด" ถ้าไม่อยากให้ AUTO ดื่มยาเอง</p></div>
        <div class="auto-card"><h4>เป้าหมาย</h4>
          <div class="auto-orow col"><span>มอนสเตอร์ที่จะตี<small>${ctx.mapName ? `${ctx.mapName} · ` : ''}เลือกได้หลายตัว · จำแยกแต่ละแผนที่</small></span>${hunt}</div>
          ${sw('attackers', 'ตัวที่กำลังตีเราก่อน', 'สู้กลับตัวที่ตีเราอยู่ แม้ไม่ได้เลือกไว้')}
          ${sw('elites', 'หัวหน้า / บอส ก่อน')}
          <div class="auto-orow col"><span>รัศมีรอบตัว<small>เดินหามอนรอบตัวในระยะนี้</small></span>
            <div class="auto-radius">${Object.entries({ near: 'ใกล้', mid: 'กลาง', far: 'ไกล', map: 'ทั้งแผนที่ปัจจุบัน' }).map(([k, t]) => `<button type="button" data-range="${k}" aria-pressed="${s.range === k}">${t}${k === 'map' ? '' : ` ${AUTO_RANGES[k]} ม.`}</button>`).join('')}</div></div>
          <div class="auto-orow"><span>ของที่ตก<small>เข้ากระเป๋าเองอยู่แล้ว</small></span><b class="auto-good">อัตโนมัติ</b></div>
          <p class="auto-note">AUTO ทำงานเฉพาะตอนออนไลน์ · ใช้สกิลเองเมื่อไหร่ AUTO จะหยุด</p></div>
      </div>
      <div class="auto-foot"><span>บันทึกอัตโนมัติ</span><button type="button" class="auto-reset">คืนค่าเริ่มต้น</button></div>`;
  }
}
