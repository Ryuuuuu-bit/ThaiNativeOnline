// บาป · บุญ (karma) and free PK: pure data and rules (no DOM), shared by the server
// (server/pvp.js, server/index.js) and the browser (src/net/PvpPanel.js).
//
// Free PK: outside the city, two signed-in characters of Lv KARMA.freeLevel or more may fight
// without asking. Characters below that level can neither attack nor be attacked (duels still
// need both to accept, at any level).
//
// A kill in free PK is judged by settleKill, in this order:
//   - the victim is หัวแดง (sin ≥ KARMA.redAt)               → ปราบทรชน: the killer earns บุญ
//   - the victim struck the killer within KARMA.provokeSecs  → ป้องกันตัว: nothing changes
//   - otherwise the victim was innocent                      → ฆ่าผู้บริสุทธิ์: the killer earns บาป
// บาป wears off one point per monster slain (KARMA.sinPerMonster). บุญ is kept for good.
//
// ยศ (rank) shows before the name: a sinner's sin rank wins over any merit rank.
//   karmaRank({ sin, merit }) → { name, kind: 'sin' | 'merit', color } | null
//   karmaTier(sin) → '' | 'stain' | 'red'

export const KARMA = {
  freeLevel: 20,
  provokeSecs: 60,
  sinPerMurder: 50,      // each innocent slain
  sinPerMonster: 1,      // atonement: each monster slain
  stainAt: 1,            // ผู้มีมลทิน (orange name)
  redAt: 100,            // หัวแดง (red name): fair game, slaying one is a good deed
  meritBase: 20,         // บุญ for slaying a หัวแดง, plus a share of their sin
  meritShare: .2,
};

// [threshold, name, colour] in ascending order
export const MERIT_RANKS = [[100, 'ขุน', '#aed6f1'], [500, 'หลวง', '#82e0aa'], [1500, 'พระ', '#f7dc6f'], [4000, 'พระยา', '#f5b041'], [10000, 'เจ้าพระยา', '#ffd700']];
export const SIN_RANKS = [[KARMA.stainAt, 'ผู้มีมลทิน', '#f0b27a'], [KARMA.redAt, 'อ้ายเสือ', '#ff7b6b'], [300, 'เสือร้าย', '#ec5f4f'], [800, 'ขุนโจร', '#d63a2f'], [2000, 'พญามาร', '#b0151a']];

const top = (ranks, n) => { let best = null; for (const r of ranks) if (n >= r[0]) best = r; return best; };

export function karmaRank({ sin = 0, merit = 0 } = {}) {
  const s = top(SIN_RANKS, sin);
  if (s) return { name: s[1], kind: 'sin', color: s[2] };
  const m = top(MERIT_RANKS, merit);
  return m ? { name: m[1], kind: 'merit', color: m[2] } : null;
}
export const karmaTier = sin => sin >= KARMA.redAt ? 'red' : sin >= KARMA.stainAt ? 'stain' : '';

// Can these two fight in free PK? (map safety, sign-in and parties are judged by server/pvp.js)
// → null | 'level' (the attacker is too low) | 'protected' (the target is too low)
export function freePkWhy(attackerLv, targetLv) {
  if (!(attackerLv >= KARMA.freeLevel)) return 'level';
  if (!(targetLv >= KARMA.freeLevel)) return 'protected';
  return null;
}

// The judgement of a free-PK kill → { kind: 'defense' | 'justice' | 'murder', sin, merit }
// (sin and merit are what the killer gains).
export function settleKill({ victimSin = 0, provoked = false }) {
  if (victimSin >= KARMA.redAt) return { kind: 'justice', sin: 0, merit: Math.round(KARMA.meritBase + victimSin * KARMA.meritShare) };
  if (provoked) return { kind: 'defense', sin: 0, merit: 0 };
  return { kind: 'murder', sin: KARMA.sinPerMurder, merit: 0 };
}
