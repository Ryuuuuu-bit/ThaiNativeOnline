// World boss rules (content data; run by server/monsters.js and server/index.js).
// Modelled on the old game's พระราหู (ThaiNative shared/data/worldboss.js): the whole
// server fights one boss, its HP is set by how many players are online when it rises
// (max(one share, online × one share), up to a cap) and locked for that round; everyone
// who did a small share of the damage is paid. Here the round is one game night
// (WorldClock: 19:30–05:00, 9.5 real minutes) instead of a fixed 30 minutes, so one
// share is about what one player of the boss's level deals in a night.
//
// A monster with `worldBoss` (src/combat/data/monsters.js) rises once a night on its
// map (`nightOnly` in src/world/maps.js), fades at dawn if it still stands, and its
// map closes by day. Twins (`worldBoss.twin`) are linked by a red thread: close
// together they heal and take half damage; when one falls the other has `revive`
// seconds to be killed too, or the fallen one rises again with `reviveHp` of its HP.
export const WORLD_BOSS = {
  cap: 40,             // HP stops growing past 40 players online
  minShare: .005,      // at least 0.5% of all the damage done to be paid (as the old game)
  link: { range: 8, heal: .01, taken: .5 },   // within 8 m: 1% max HP a second, half damage taken
  revive: 12, reviveHp: .4,
  rage: { at: .3, speed: 1.35, swing: .65, power: 1.3 },   // berserk below 30% HP: faster, quicker swings, harder hits
  lootChance: [1, .6, .35],                   // the top damager, 2nd–3rd, everyone else (a roll of the loot table each)
  goldShare: [1, .7, .4],
};

// HP for one round, locked when the boss rises: `share` is the monster's own `hp`.
export const worldBossHp = (share, online) => Math.round(share * Math.min(WORLD_BOSS.cap, Math.max(1, online)));

// Tiers, as the old game's Rahu: when the boss rises it takes the tier of the average level of the
// five highest players on its map (a new server can still beat it; it grows with the players).
// lv — the level it shows and pays EXP for · hp — × its HP share · atk — × its plain swings.
// Skills hit for a share of the player's own max HP, so they hurt every level the same.
export const WORLD_BOSS_TIERS = [
  { n: 1, from: 1,  lv: 12, hp: 1,   atk: 1 },
  { n: 2, from: 25, lv: 30, hp: 2.5, atk: 2 },
  { n: 3, from: 45, lv: 50, hp: 5,   atk: 3.5 },
  { n: 4, from: 65, lv: 75, hp: 9,   atk: 5.5 },
  { n: 5, from: 85, lv: 99, hp: 14,  atk: 8 },
];
export function worldBossTier(levels = []) {
  const top = [...levels].sort((a, b) => b - a).slice(0, 5);
  const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 1;
  return [...WORLD_BOSS_TIERS].reverse().find(t => avg >= t.from) ?? WORLD_BOSS_TIERS[0];
}

// Skills (server/monsters.js casts them, src/combat/WorldBossFX.js draws them). Every one is warned:
// a mark on the floor for `warn` s, then whoever stands in it when it lands takes `pct` of their max HP.
//   at: 'target' (where its target stands) · 'far' (the furthest player within 16 m; she leaps there) ·
//       'each' (under every player within 16 m) · 'around' (`n` spots around her) · 'self' (around her) ·
//       'twin' (no mark: she vanishes and comes out beside her sister when they are apart)
//   r — the mark's radius (m) · cd — seconds before she uses it again · below — only under that share of HP
//   bleed { pct, secs } — a share of max HP a second after the hit · knock — throws the player back ·
//   pool { pct, secs } — leaves pools that burn that share a second while stood in
export const WORLD_BOSS_SKILLS = {
  ghost_red: [
    { id: 'claw', name: 'ตะครุบกรงเล็บ', at: 'target', r: 2.2, warn: 1.0, pct: .3, bleed: { pct: .03, secs: 4 }, cd: 6 },
    { id: 'pounce', name: 'กระโจนขย้ำ', at: 'far', r: 3, warn: 1.3, pct: .4, knock: true, cd: 11 },
    { id: 'tears', name: 'น้ำตาเลือด', at: 'around', n: 4, r: 1.9, warn: 1.2, pct: .1, pool: { pct: .05, secs: 10 }, cd: 14, below: .75 },
  ],
  ghost_black: [
    { id: 'hands', name: 'มือจากใต้พื้น', at: 'target', r: 2.5, warn: 1.2, pct: .28, cd: 7 },
    { id: 'warp', name: 'วาร์ปหาน้อง', at: 'twin', cd: 10 },
    { id: 'hands_all', name: 'มือนับร้อย', at: 'each', r: 2, warn: 1.4, pct: .22, cd: 13, below: .65 },
    { id: 'wail', name: 'กรีดร้องดับเทียน', at: 'self', r: 6.5, warn: 1.8, pct: .38, cd: 16, below: .4 },
  ],
};
export const WORLD_BOSS_CAST = { gap: 2.2, reach: 16 };   // seconds between any two skills · how far she picks players

// News lines for the banner and chat (server → client `wbnews`).
export const WORLD_BOSS_NEWS = {
  soon: () => 'พลบค่ำแล้ว · ผีชุดแดงกับผีชุดดำจะปรากฏที่เรือนหอร้างเมื่อตะวันลับฟ้า',
  open: () => 'บอสโลกปรากฏแล้ว! ผีชุดแดงและผีชุดดำ ที่เรือนหอร้าง · กดปุ่มด้านล่างเพื่อวาร์ปไปร่วมปราบ',
  fall: m => `${m.name} ล้มลงแล้ว · อีกตัวกรีดร้อง ฆ่าให้ได้ใน ${WORLD_BOSS.revive} วินาที!`,
  rise: m => `${m.name} ลุกขึ้นจากแอ่งเลือดอีกครั้ง`,
  rage: m => `${m.name} คลั่งแล้ว! กรีดร้องจนเทียนสั่น ตีแรงและเร็วขึ้น`,
  down: m => `ด้ายแดงขาดสะบั้น! ผีสองพี่น้องถูกปราบแล้ว${m.mvp ? ` · MVP: ${m.mvp}` : ''}`,
  dawn: () => 'รุ่งเช้าแล้ว · ผีสองพี่น้องหายไปกับแสงตะวัน เรือนหอร้างปิดประตู',
  closed: () => 'ประตูเรือนหอร้างเปิดเฉพาะกลางคืน',
};
