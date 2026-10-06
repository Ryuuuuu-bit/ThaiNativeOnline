// Quest data. Each quest is given by an NPC (`giver`) and returned to `turnIn`
// (defaults to the giver). Objectives:
//   discover: landmark id       kill: monster type (src/combat/data/monsters.js) × count
//   collect: item id × count (taken on turn-in)   talk: NPC id
// `requires` lists quests that must be finished first; `minLevel` gates harder ones.
// Rewards: gold, exp and items (item ids from src/character/data/items.js).
export const QUESTS = [
  {
    id: 'first_steps', title: 'ก้าวแรกในราชธานี', giver: 'guard_port', turnIn: 'guard_center',
    offer: 'คนต่างถิ่นหรือ? ไปดูตลาดกลางเมืองกับศาลหลักเมืองเสียก่อน แล้วไปรายงานทหารที่หลักเมือง',
    done: 'เห็นเมืองของเราแล้วใช่ไหม ที่นี่ปลอดภัย ตราบใดที่เจ้ายังรักษากฎของเมือง',
    objectives: [{ discover: 'market' }, { discover: 'city_pillar' }],
    rewards: { gold: 30, exp: 40, items: [['potion_s', 3]] },
  },
];
