import { EXPEDITION_MONSTERS } from './expedition-monsters.js';
// Content data only: edit freely without touching game logic.
// Optional per monster: acc (accuracy; default MONSTER_ACCURACY(level) in
// src/character/data/progression.js) and eva (evasion against player ATK, default 0).
// exp: about MONSTER_EXP_RATE(level) for a normal monster (progression.js), several times it for elites.
// Behaviour (run on the server, server/monsters.js; offline the browser keeps the plain chase):
//   passive        does not attack first (until hit)
//   bold           attacks first whatever the player's level (not only those up to 2 levels above it)
//   flee           runs from whoever hit it for a few seconds
//   pack: r        when hit, others of its kind within r metres join in
//   callSpirits: r when it starts a fight, every spirit within r metres joins in
//   charge         from 3.5–10 m it dashes at its target and hits harder (cooldown 6 s)
//   ranged: color  attacks from `range` metres with a bolt of that colour
//   attackDelay    seconds between its swings (slow, heavy hitters)
//   poison: { dot, secs }  a landed hit poisons: dot HP a second (never below 1 HP)
//   mpDrain        a landed hit drains this much MP
//   knock: chance  a landed hit may throw the player 2.5 m back
//   pull           its swing (from `range`) drags the player in next to it
//   shield         blows from in front of it do 40% less
//   summon: { type, count, at: [hp shares] }  calls minions as its HP drops
//   worldBoss: { twin }  a world boss (src/combat/data/worldBoss.js): rises once a night, HP set by
//                  the players online, gone at dawn; twins share a red thread and rise again together;
//                  below WORLD_BOSS.rage.at of its HP it goes berserk (faster, harder, quicker swings)
// The sisters: the bride (ghost_red) dashes in, claws (bleeding) and throws players back; the elder
// (ghost_black) drains MP, poisons, and calls ผีตายโหง out of the floor as her HP drops.
// shape: the mesh (src/combat/CombatView.js BUILDERS); look: shape options.
// race: beast (สัตว์) · spirit (ผี) · demon (อสูร); element: earth · water · fire · wind · dark.
// Both only matter through cards (src/character/data/cards.js): damage against a race,
// less damage taken from a race or an element. Every monster drops its own card.
export const MONSTERS = {
  ...EXPEDITION_MONSTERS,
  boar:   { name: 'หมูป่า', race: 'beast', element: 'earth', level: 1, hp: 125, atk: 13, def: 2, speed: 2.6, range: 1.3, aggro: 4.5, exp: 18, gold: [2, 6], color: '#6b5241', size: .8, shape: 'boar', loot: 'beast' },
  monkey: { name: 'ลิงกัง', race: 'beast', element: 'wind', level: 2, hp: 120, atk: 15, def: 1, speed: 3.4, range: 1.2, aggro: 6, exp: 31, gold: [3, 8], color: '#8d7350', size: .6, shape: 'monkey', loot: 'beast' },
  pray:   { name: 'ผีพราย', race: 'spirit', element: 'water', level: 4, hp: 280, atk: 22, def: 4, speed: 2.2, range: 1.4, aggro: 6.5, exp: 54, gold: [6, 14], color: '#a8d3c6', size: .9, shape: 'spirit', loot: 'spirit' },
  phibpa: { name: 'ผีป่า', race: 'spirit', element: 'earth', level: 3, hp: 210, atk: 19, def: 3, speed: 2.4, range: 1.4, aggro: 6, exp: 43, gold: [5, 11], color: '#7fae8a', size: .85, shape: 'spirit', loot: 'spirit' },
  krasue: { name: 'กระสือ', race: 'demon', element: 'fire', level: 7, hp: 1300, atk: 42, def: 6, speed: 3.6, range: 1.5, aggro: 8, exp: 260, gold: [40, 80], color: '#ff5a3c', size: 1, shape: 'krasue', loot: 'rare', elite: true, rare: true },
  winyan: { name: 'วิญญาณเร่ร่อน', race: 'spirit', element: 'dark', level: 5, hp: 330, atk: 25, def: 4, speed: 2.3, range: 1.4, aggro: 6.5, exp: 64, gold: [7, 15], color: '#9fc4ff', size: .9, shape: 'spirit', loot: 'spirit' },
  phitaihong: { name: 'ผีตายโหง', race: 'spirit', element: 'dark', level: 7, hp: 520, atk: 32, def: 6, speed: 2.6, range: 1.5, aggro: 7, exp: 95, gold: [10, 20], color: '#e07070', size: 1.05, shape: 'spirit', loot: 'spirit' },
  pop:    { name: 'ปอบ', race: 'demon', element: 'dark', level: 10, hp: 3200, atk: 52, def: 10, speed: 2.9, range: 1.8, aggro: 9, exp: 600, gold: [90, 160], color: '#5d6b4f', size: 1.6, shape: 'monkey', loot: 'pop', elite: true, boss: true },
  // ---- ทุ่งนา ----
  fowl:   { name: 'ไก่ป่า', race: 'beast', element: 'wind', level: 1, hp: 90, atk: 9, def: 1, speed: 3.8, range: 1.1, aggro: 7, exp: 16, gold: [1, 4], color: '#b5532c', size: .5, shape: 'bird', loot: 'beast', bold: true },
  cobra:  { name: 'งูเห่านา', race: 'beast', element: 'earth', level: 2, hp: 110, atk: 14, def: 2, speed: 2.4, range: 3.2, aggro: 5, exp: 31, gold: [2, 7], color: '#3e3a26', size: .7, shape: 'snake', loot: 'beast', ranged: '#9cf07a', poison: { dot: 3, secs: 4 } },
  crab:   { name: 'ปูนา', race: 'beast', element: 'water', level: 2, hp: 150, atk: 13, def: 9, speed: 1.8, range: 1.1, aggro: 3.5, exp: 33, gold: [2, 7], color: '#5d6a5a', size: .6, shape: 'crab', loot: 'beast' },
  buffalo: { name: 'ควายป่า', race: 'beast', element: 'earth', level: 4, hp: 900, atk: 30, def: 7, speed: 2.8, range: 1.6, aggro: 0, exp: 160, gold: [15, 30], color: '#3d3a3a', size: 1.3, shape: 'buffalo', loot: 'boss', elite: true, passive: true, charge: true },
  // ---- ป่าลึก ----
  dhole:  { name: 'หมาไน', race: 'beast', element: 'wind', level: 3, hp: 160, atk: 17, def: 2, speed: 3.6, range: 1.2, aggro: 6.5, exp: 43, gold: [3, 9], color: '#a55d2c', size: .65, shape: 'dog', loot: 'beast', pack: 9 },
  monitor: { name: 'เหี้ย', race: 'beast', element: 'water', level: 4, hp: 300, atk: 21, def: 5, speed: 2.2, range: 1.4, aggro: 5, exp: 54, gold: [5, 12], color: '#4b4f36', size: .9, shape: 'lizard', loot: 'beast', knock: .35 },
  kongkoi: { name: 'ผีกองกอย', race: 'spirit', element: 'wind', level: 4, hp: 230, atk: 23, def: 3, speed: 4.2, range: 1.3, aggro: 7, exp: 54, gold: [5, 12], color: '#b98bd9', size: .85, shape: 'spirit', look: { oneLeg: true }, loot: 'spirit' },
  khamot: { name: 'ผีโขมด', race: 'spirit', element: 'fire', level: 5, hp: 200, atk: 24, def: 2, speed: 2.8, range: 5.5, aggro: 8, exp: 65, gold: [6, 13], color: '#ffd36b', size: .8, shape: 'orb', loot: 'spirit', ranged: '#ffd36b', callSpirits: 14 },
  takian: { name: 'นางตะเคียน', race: 'spirit', element: 'earth', level: 6, hp: 1700, atk: 38, def: 8, speed: 0, range: 6, aggro: 6, exp: 230, gold: [25, 50], color: '#4f8a5b', size: 1.3, shape: 'spirit', look: { tall: true, hair: true }, loot: 'rare', elite: true, pull: true },
  // ---- วัดร้าง ----
  headless: { name: 'ผีหัวขาด', race: 'spirit', element: 'dark', level: 6, hp: 480, atk: 40, def: 6, speed: 2.0, range: 1.5, aggro: 6.5, exp: 75, gold: [8, 17], color: '#c9b9a0', size: 1, shape: 'spirit', look: { headless: true }, loot: 'spirit', attackDelay: 2.6 },
  pret:   { name: 'เปรตน้อย', race: 'spirit', element: 'dark', level: 6, hp: 420, atk: 26, def: 5, speed: 2.4, range: 1.5, aggro: 6.5, exp: 75, gold: [8, 17], color: '#8a7fa8', size: 1, shape: 'spirit', look: { tall: true }, loot: 'spirit', mpDrain: 8 },
  krahang: { name: 'ผีกระหัง', race: 'spirit', element: 'wind', level: 7, hp: 400, atk: 30, def: 4, eva: 25, speed: 3.4, range: 1.4, aggro: 7, exp: 85, gold: [9, 19], color: '#a0b8c8', size: 1, shape: 'spirit', look: { wings: true }, loot: 'spirit' },
  soldier: { name: 'ทหารผีเฝ้าวัด', race: 'spirit', element: 'earth', level: 8, hp: 700, atk: 34, def: 10, speed: 2.3, range: 1.6, aggro: 6.5, exp: 95, gold: [10, 22], color: '#9a8f6a', size: 1.05, shape: 'spirit', look: { shield: true }, loot: 'spirit', shield: true },
  pusom:  { name: 'ผีปู่โสม', race: 'spirit', element: 'earth', level: 10, hp: 4200, atk: 50, def: 11, speed: 2.2, range: 1.8, aggro: 8, exp: 650, gold: [100, 180], color: '#e8e2c8', size: 1.6, shape: 'spirit', look: { elder: true }, loot: 'pop', elite: true, boss: true, summon: { type: 'winyan', count: 2, at: [.7, .35] } },
  // ---- คลองหนองบึง (Lv 10-25) ----
  leech:   { name: 'ปลิงควาย', race: 'beast', element: 'water', level: 11, hp: 1000, atk: 46, def: 10, speed: 2.0, range: 1.2, aggro: 4.5, exp: 123, gold: [12, 26], color: '#3a3424', size: .75, shape: 'snake', loot: 'marsh', poison: { dot: 4, secs: 4 } },
  wraith:  { name: 'ผีพรายน้ำ', race: 'spirit', element: 'water', level: 12, hp: 1050, atk: 54, def: 9, speed: 2.6, range: 5, aggro: 7, exp: 131, gold: [13, 28], color: '#7fbfc8', size: 1, shape: 'spirit', look: { hair: true }, loot: 'spirit2', ranged: '#7fd0ff', mpDrain: 10 },
  croc:    { name: 'จระเข้บึง', race: 'beast', element: 'water', level: 13, hp: 1500, atk: 58, def: 18, speed: 2.4, range: 1.6, aggro: 5.5, exp: 140, gold: [14, 30], color: '#4a5a3a', size: 1.3, shape: 'lizard', loot: 'marsh', knock: .3 },
  python:  { name: 'งูเหลือมดงอ้อ', race: 'beast', element: 'earth', level: 14, hp: 1600, atk: 70, def: 12, speed: 2.2, range: 1.8, aggro: 6, exp: 149, gold: [15, 32], color: '#6a5a2a', size: 1.25, shape: 'snake', loot: 'marsh', attackDelay: 2.4 },
  phong:   { name: 'ผีโพง', race: 'spirit', element: 'fire', level: 15, hp: 1400, atk: 64, def: 11, speed: 3.2, range: 1.5, aggro: 8, exp: 157, gold: [16, 34], color: '#ffb04a', size: 1, shape: 'spirit', look: { tall: true }, loot: 'spirit2', callSpirits: 12 },
  klom:    { name: 'ผีตายทั้งกลม', race: 'spirit', element: 'dark', level: 17, hp: 1900, atk: 76, def: 14, speed: 2.4, range: 1.5, aggro: 7, exp: 174, gold: [18, 38], color: '#b07090', size: 1.1, shape: 'spirit', look: { hair: true }, loot: 'spirit2', poison: { dot: 10, secs: 5 } },
  kumphi:  { name: 'กุมภีล์', race: 'demon', element: 'water', level: 19, hp: 2600, atk: 86, def: 20, speed: 2.8, range: 1.7, aggro: 6.5, exp: 190, gold: [20, 42], color: '#3e4a36', size: 1.55, shape: 'lizard', loot: 'marsh', charge: true },
  nangram: { name: 'ผีนางรำ', race: 'spirit', element: 'dark', level: 22, hp: 2500, atk: 92, def: 15, eva: 35, speed: 3.0, range: 5, aggro: 8, exp: 213, gold: [24, 50], color: '#e8c070', size: 1, shape: 'spirit', look: { tall: true, hair: true }, loot: 'spirit2', ranged: '#ffd36b' },
  tani:    { name: 'นางตานี', race: 'spirit', element: 'earth', level: 20, hp: 9000, atk: 100, def: 18, speed: 0, range: 6, aggro: 7, exp: 700, gold: [80, 150], color: '#6a9a4a', size: 1.4, shape: 'spirit', look: { tall: true, hair: true }, loot: 'rare2', elite: true, pull: true, mpDrain: 12 },
  chalawan: { name: 'ชาละวัน', race: 'demon', element: 'water', level: 25, hp: 26000, atk: 130, def: 26, speed: 2.6, range: 2.2, aggro: 9, exp: 2600, gold: [300, 500], color: '#2f3a2a', size: 2.4, shape: 'lizard', loot: 'chalawan', elite: true, boss: true, charge: true, knock: .4, summon: { type: 'croc', count: 2, at: [.6, .3] } },
  // World boss (src/combat/data/worldBoss.js, server/monsters.js): the ghost sisters of เรือนหอร้าง,
  // night only. hp here is one online player's share; the server locks the real HP when they rise.
  ghost_red:   { name: 'ผีชุดแดง', race: 'spirit', element: 'fire', level: 12, hp: 32000, atk: 88, def: 12, speed: 3.2, range: 2.4, aggro: 18, bold: true, attackDelay: 1.0, charge: true, knock: .35, poison: { dot: 30, secs: 4 }, exp: 3200, gold: [250, 400], color: '#c0281e', size: 1.7, shape: 'spirit', look: { tall: true, hair: true }, loot: 'ghost_sisters', elite: true, boss: true, worldBoss: { twin: 'ghost_black' } },
  ghost_black: { name: 'ผีชุดดำ', race: 'spirit', element: 'dark', level: 12, hp: 28000, atk: 76, def: 11, speed: 2.7, range: 2.4, aggro: 18, bold: true, attackDelay: 1.15, poison: { dot: 20, secs: 5 }, summon: { type: 'phitaihong', count: 2, at: [.75, .5, .25] }, exp: 3200, gold: [250, 400], color: '#1a1a1f', size: 1.7, shape: 'spirit', look: { tall: true, hair: true }, loot: 'ghost_sisters', elite: true, boss: true, mpDrain: 25, worldBoss: { twin: 'ghost_red' } },
  tiger:  { name: 'เสือสมิง', race: 'demon', element: 'earth', level: 6, hp: 1500, atk: 40, def: 8, speed: 3.1, range: 1.6, aggro: 7, exp: 140, gold: [25, 50], color: '#c98a3d', size: 1.25, shape: 'tiger', loot: 'boss', elite: true },
};


// Night is a different mood and a riskier, richer hunt.
export const NIGHT = { expBonus: 1.25, ghostPower: 1.2 };

