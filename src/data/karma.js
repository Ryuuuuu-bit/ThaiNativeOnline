// บาป · บุญ (karma) and free PK: pure data and rules (no DOM), shared by the server
// (server/pvp.js, server/index.js) and the browser (src/net/PvpPanel.js, src/shop/ShopSystem.js).
//
// Free PK: outside the city, two signed-in characters of Lv KARMA.freeLevel or more may fight
// without asking. Characters below that level can neither attack nor be attacked (duels still
// need both to accept, at any level).
//
// A kill in free PK is judged by settleKill, in this order:
//   - the victim is หัวแดง (sin ≥ KARMA.redAt)               → ปราบทรชน: the killer earns บุญ
//   - the victim struck the killer within KARMA.provokeSecs  → ป้องกันตัว: nothing changes
//   - otherwise the victim was innocent                      → ฆ่าผู้บริสุทธิ์: the killer earns บาป
// Both บาป and บุญ are lifetime totals: nothing wears them off, so each is a long path of ten
// ranks. Monsters do not touch either.
//
// ยศ (rank) shows before the name: the side whose rank is higher wins (sin on a tie).
//   karmaRank({ sin, merit }) → { name, kind: 'sin' | 'merit', tier: 1..10, color } | null
//   karmaTier(sin) → '' | 'stain' | 'red'          (the name's colour)
//   shopMarkup(sin) → 0 .. KARMA.maxMarkup          (city vendors charge sinners more)

export const KARMA = {
  freeLevel: 20,
  provokeSecs: 60,
  sinPerMurder: 50,      // each innocent slain
  stainAt: 1,            // ผู้มีมลทิน (orange name)
  redAt: 100,            // หัวแดง (red name): fair game, slaying one is a good deed
  meritBase: 20,         // บุญ for slaying a หัวแดง, plus a share of their sin (up to meritSinCap)
  meritShare: .05,
  meritSinCap: 2000,     // so one kill earns 20–120 บุญ however deep the sinner has sunk
  markupPerRank: .01,    // +1% at the vendors per sin rank …
  maxMarkup: .10,        // … never more than +10%
};

// [threshold, name, colour], ten ranks each, ascending. Lifetime points, so the top ranks are
// meant to take months: 50,000 บาป is a thousand innocents, 50,000 บุญ some four hundred หัวแดง.
export const SIN_RANKS = [
  [KARMA.stainAt, 'ผู้มีมลทิน', '#f0b27a'],
  [KARMA.redAt, 'อ้ายเสือ', '#ff8a6b'],
  [300, 'เสือร้าย', '#ff6f5a'],
  [800, 'ขุนโจร', '#f2533f'],
  [1500, 'พญาโจร', '#e03b2e'],
  [3000, 'ปีศาจพงไพร', '#c92a3a'],
  [6000, 'ยักษ์มาร', '#b51f4a'],
  [12000, 'อสูรกลืนแผ่นดิน', '#9d1a5c'],
  [25000, 'พญามาร', '#86146e'],
  [50000, 'จ้าวนรกอเวจี', '#6a0f80'],
];
export const MERIT_RANKS = [
  [50, 'นาย', '#d6eaf8'],
  [150, 'ขุน', '#aed6f1'],
  [400, 'หลวง', '#82e0aa'],
  [1000, 'พระ', '#a9dfbf'],
  [2000, 'พระยา', '#f7dc6f'],
  [4000, 'เจ้าพระยา', '#f5b041'],
  [8000, 'สมเด็จเจ้าพระยา', '#f0a030'],
  [15000, 'ขุนพลพิทักษ์กรุง', '#ffd700'],
  [30000, 'วีรบุรุษกรุงศรี', '#ffe680'],
  [50000, 'ตำนานผู้พิทักษ์ธรรม', '#fff4c2'],
];

// the highest rank reached → { tier (1-based), threshold, name, color } | null
function reached(ranks, n) {
  let tier = 0;
  while (tier < ranks.length && n >= ranks[tier][0]) tier++;
  if (!tier) return null;
  const [threshold, name, color] = ranks[tier - 1];
  return { tier, threshold, name, color, next: ranks[tier]?.[0] ?? null };
}
export const sinRank = sin => reached(SIN_RANKS, sin || 0);
export const meritRank = merit => reached(MERIT_RANKS, merit || 0);

export function karmaRank({ sin = 0, merit = 0 } = {}) {
  const s = sinRank(sin), m = meritRank(merit);
  if (s && (!m || s.tier >= m.tier)) return { ...s, kind: 'sin' };
  return m ? { ...m, kind: 'merit' } : null;
}
export const karmaTier = sin => sin >= KARMA.redAt ? 'red' : sin >= KARMA.stainAt ? 'stain' : '';
// what city vendors add to a sinner's price: +1% per sin rank, at most +10%
export const shopMarkup = sin => Math.min(KARMA.maxMarkup, (sinRank(sin)?.tier ?? 0) * KARMA.markupPerRank);

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
  if (victimSin >= KARMA.redAt) return { kind: 'justice', sin: 0, merit: Math.round(KARMA.meritBase + Math.min(victimSin, KARMA.meritSinCap) * KARMA.meritShare) };
  if (provoked) return { kind: 'defense', sin: 0, merit: 0 };
  return { kind: 'murder', sin: KARMA.sinPerMurder, merit: 0 };
}
