// Content data only: edit freely without touching game logic.
// kind: 'damage' (single target), 'aoe' (around caster or target), 'buff', 'heal', 'debuff', 'pet'
// scale: which stat multiplies the hit; power: multiplier of base damage.
// img: framed skill art (public/fx, shared with the class's ten-skill kit); icon is the fallback glyph.
// buff fields: def (damage reduction ratio), atk (attack ratio), dodge (extra dodge), hot (max-HP ratio healed per second)
export const SKILLS = {
  jab:    { name: 'หมัดตรง', icon: '✊', img: 'fx/muaythai/icon_boxer_jab.png', kind: 'damage', scale: 'str', power: .9, mp: 0, cd: 0, basic: true, fx: '#ffd2a0', look: 'punch' },
  knee:   { name: 'เข่าลอย', icon: '⤒', img: 'fx/muaythai/icon_boxer_knee.png', kind: 'damage', scale: 'str', power: 2.3, mp: 10, cd: 6, fx: '#ff9a5c' },
  elbow:  { name: 'ศอกกลับ', icon: '↺', img: 'fx/muaythai/icon_boxer_elbow.png', kind: 'aoe', scale: 'str', power: 1.3, mp: 12, cd: 8, radius: 2.2, around: 'self', debuff: { id: 'slow', slow: .4, duration: 3 } },
  waikru: { name: 'ไหว้ครู', icon: '🙏', img: 'fx/muaythai/icon_boxer_waikru.png', kind: 'buff', mp: 12, cd: 25, buff: { id: 'waikru', atk: .3, duration: 12 } },
  slash:  { name: 'ฟันดาบ', icon: '⚔', kind: 'damage', scale: 'str', power: 1, mp: 0, cd: 0, basic: true, look: 'slash' },
  whirl:  { name: 'ดาบหมุนวน', icon: '◎', kind: 'aoe', scale: 'str', power: 1.5, mp: 12, cd: 6, radius: 2.6, around: 'self' },
  guard:  { name: 'ตั้งการ์ด', icon: '⛨', kind: 'buff', mp: 10, cd: 18, buff: { id: 'guard', def: .5, duration: 8 } },
  rally:  { name: 'ยาดม', icon: '✚', kind: 'heal', mp: 14, cd: 20, heal: .3 },
  shot:   { name: 'ยิงธนู', icon: '➶', kind: 'damage', scale: 'agi', power: 1, mp: 0, cd: 0, basic: true, projectile: '#e8d9a0', look: 'arrow' },
  volley: { name: 'ฝนลูกธนู', icon: '⇶', kind: 'aoe', scale: 'agi', power: 1.3, mp: 14, cd: 7, radius: 2.4, around: 'target' },
  snare:  { name: 'บ่วงพราน', icon: '⌇', kind: 'debuff', scale: 'agi', power: .8, mp: 8, cd: 10, debuff: { id: 'slow', slow: .5, duration: 5 }, projectile: '#b7d48a' },
  sic:    { name: 'ไอ้ด่าง ลุย!', icon: '🐕', kind: 'pet', mp: 10, cd: 14, power: 2.2, frenzy: 6 },
  bolt:   { name: 'ลูกไฟอาคม', icon: '✦', kind: 'damage', scale: 'int', power: 1.15, mp: 0, cd: 0, basic: true, projectile: '#c69bff', look: 'orb' },
  yantra: { name: 'ยันต์เพลิง', icon: '卍', kind: 'aoe', scale: 'int', power: 1.9, mp: 18, cd: 8, radius: 2.8, around: 'target' },
  curse:  { name: 'คุณไสย', icon: '☠', kind: 'debuff', scale: 'int', power: .6, mp: 12, cd: 12, debuff: { id: 'dot', dot: .35, duration: 6 }, projectile: '#b48ad8' },
  mend:   { name: 'น้ำมนต์', icon: '❀', kind: 'heal', mp: 16, cd: 12, heal: .4 },
  dart:   { name: 'ลูกดอกสมุนไพร', icon: '➹', img: 'fx/herbalist/icon_heal_pill.png', kind: 'damage', scale: 'int', power: 1, mp: 0, cd: 0, basic: true, projectile: '#9cf07a', look: 'dart' },
  blight: { name: 'ยาพิษใบไม้', icon: '🍃', img: 'fx/herbalist/icon_heal_mist.png', kind: 'aoe', scale: 'int', power: .9, mp: 14, cd: 9, radius: 2.6, around: 'target', debuff: { id: 'dot', dot: .25, duration: 6 } },
  grove:  { name: 'วงสมุนไพร', icon: '✿', img: 'fx/herbalist/icon_heal_zone.png', kind: 'buff', mp: 16, cd: 20, buff: { id: 'regen', hot: .06, duration: 8 } },
  balm:   { name: 'ยาหอมโบราณ', icon: '⚱', img: 'fx/herbalist/icon_heal_tonic.png', kind: 'heal', mp: 18, cd: 10, heal: .45 },
  stab:   { name: 'แทงมีด', icon: '🗡', kind: 'damage', scale: 'agi', power: .75, mp: 0, cd: 0, basic: true, fx: '#c9a6ff', look: 'thrust' },
  shadow: { name: 'จู่โจมเงา', icon: '☾', kind: 'damage', scale: 'agi', power: 2, mp: 14, cd: 8, alwaysCrit: true, fx: '#8a4dff' },
  smoke:  { name: 'ม่านควัน', icon: '☁', kind: 'buff', mp: 10, cd: 18, buff: { id: 'smoke', dodge: .5, duration: 5 } },
  venom:  { name: 'มีดอาบยาพิษ', icon: '☣', kind: 'debuff', scale: 'agi', power: .9, mp: 10, cd: 10, debuff: { id: 'dot', dot: .4, duration: 6 } },
};

// Buff badges on the player frame: a framed image where the class has one, else a glyph.
export const BUFF_ICONS = { guard: { icon: '⛨' }, waikru: { icon: '🙏', img: 'fx/muaythai/icon_boxer_waikru.png' }, regen: { icon: '✿', img: 'fx/herbalist/icon_heal_zone.png' }, smoke: { icon: '☁' }, poison: { icon: '☠' } };

