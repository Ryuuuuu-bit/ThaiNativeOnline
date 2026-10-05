// Content data only: edit freely without touching game logic.
export const MONSTERS = {
  boar:   { name: 'หมูป่า', level: 1, hp: 125, atk: 13, def: 2, speed: 2.6, range: 1.3, aggro: 4.5, exp: 18, gold: [2, 6], color: '#6b5241', size: .8, shape: 'boar', loot: 'beast' },
  monkey: { name: 'ลิงกัง', level: 2, hp: 120, atk: 15, def: 1, speed: 3.4, range: 1.2, aggro: 6, exp: 22, gold: [3, 8], color: '#8d7350', size: .6, shape: 'monkey', loot: 'beast' },
  pray:   { name: 'ผีพราย', level: 4, hp: 280, atk: 22, def: 4, speed: 2.2, range: 1.4, aggro: 6.5, exp: 45, gold: [6, 14], color: '#a8d3c6', size: .9, shape: 'spirit', loot: 'spirit' },
  phibpa: { name: 'ผีป่า', level: 3, hp: 210, atk: 19, def: 3, speed: 2.4, range: 1.4, aggro: 6, exp: 38, gold: [5, 11], color: '#7fae8a', size: .85, shape: 'spirit', loot: 'spirit' },
  krasue: { name: 'กระสือ', level: 7, hp: 1300, atk: 42, def: 6, speed: 3.6, range: 1.5, aggro: 8, exp: 260, gold: [40, 80], color: '#ff5a3c', size: 1, shape: 'krasue', loot: 'rare', elite: true, rare: true },
  winyan: { name: 'วิญญาณเร่ร่อน', level: 5, hp: 330, atk: 25, def: 4, speed: 2.3, range: 1.4, aggro: 6.5, exp: 60, gold: [7, 15], color: '#9fc4ff', size: .9, shape: 'spirit', loot: 'spirit' },
  phitaihong: { name: 'ผีตายโหง', level: 7, hp: 520, atk: 32, def: 6, speed: 2.6, range: 1.5, aggro: 7, exp: 95, gold: [10, 20], color: '#e07070', size: 1.05, shape: 'spirit', loot: 'spirit' },
  pop:    { name: 'ปอบ', level: 10, hp: 3200, atk: 52, def: 10, speed: 2.9, range: 1.8, aggro: 9, exp: 600, gold: [90, 160], color: '#5d6b4f', size: 1.6, shape: 'monkey', loot: 'pop', elite: true, boss: true },
  tiger:  { name: 'เสือสมิง', level: 6, hp: 1500, atk: 40, def: 8, speed: 3.1, range: 1.6, aggro: 7, exp: 140, gold: [25, 50], color: '#c98a3d', size: 1.25, shape: 'tiger', loot: 'boss', elite: true },
};


// Night is a different mood and a riskier, richer hunt.
export const NIGHT = { expBonus: 1.25, ghostPower: 1.2 };

