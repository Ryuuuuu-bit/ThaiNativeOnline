// Quest data. Each quest is given by an NPC (`giver`) and returned to `turnIn`
// (defaults to the giver). Objectives:
//   discover: landmark id       kill: monster type (src/game/data.js) × count
//   collect: item id × count (taken on turn-in)   talk: NPC id
// `requires` lists quests that must be finished first; `minLevel` gates harder ones.
// Rewards: gold, exp and items (item ids from src/game/data.js).
export const QUESTS = [
  {
    id: 'first_steps', title: 'ก้าวแรกในราชธานี', giver: 'guard_port', turnIn: 'guard_center',
    offer: 'คนต่างถิ่นหรือ? ไปดูตลาดกลางเมืองกับศาลหลักเมืองเสียก่อน แล้วไปรายงานทหารที่หลักเมือง',
    done: 'เห็นเมืองของเราแล้วใช่ไหม ที่นี่ปลอดภัย ตราบใดที่เจ้ายังรักษากฎของเมือง',
    objectives: [{ discover: 'market' }, { discover: 'city_pillar' }],
    rewards: { gold: 30, exp: 40, items: [['potion_s', 3]] },
  },
  {
    id: 'smith_boars', title: 'เสียงค้อนจากย่านช่าง', giver: 'blacksmith', requires: ['first_steps'],
    offer: 'หมูป่าที่ชายป่าเหนือเมืองทำลายสวนของชาวบ้าน ไปจัดการมันสักสี่ตัว แล้วข้าจะให้ค่าจ้าง',
    done: 'เขี้ยวหมูพวกนี้ใช้ทำด้ามมีดได้ดี รับค่าจ้างไป',
    objectives: [{ kill: 'boar', count: 4 }],
    rewards: { gold: 60, exp: 90, items: [['potion_m', 2]] },
  },
  {
    id: 'hunter_trail', title: 'รอยเท้าของพรานเฒ่า', giver: 'old_hunter', requires: ['first_steps'],
    offer: 'คนจะเข้าป่าต้องรู้ทาง ไปไหว้ต้นไทร ศาลเจ้าปากป่า และหาเจดีย์ร้างกลางป่าให้เจอ',
    done: 'เจ้าจำทางได้แล้ว อย่าลืมว่ายิ่งลึก ป่ายิ่งเงียบ',
    objectives: [{ discover: 'banyan' }, { discover: 'forest_gate' }, { discover: 'ruined_chedi' }],
    rewards: { gold: 40, exp: 120, items: [['ether', 2]] },
  },
  {
    id: 'herbal_ash', title: 'ขี้เถ้าธูปของหมอยา', giver: 'herbalist', requires: ['first_steps'],
    offer: 'ยาบางขนานต้องใช้ขี้เถ้าธูปจากผีป่า ซึ่งออกมาเฉพาะยามค่ำ เก็บมาให้ข้าสามกำ',
    done: 'ดีมาก ยาหม้อนี้ข้าต้มไว้ให้เจ้าโดยเฉพาะ',
    objectives: [{ collect: 'ash', count: 3 }],
    rewards: { gold: 50, exp: 150, items: [['potion_m', 3], ['ether', 2]] },
  },
  {
    id: 'temple_lore', title: 'ใบลานของวัด', giver: 'monk_elder', requires: ['first_steps'],
    offer: 'เจริญพร ใบลานเก่าเล่าถึงศาลกลางไพรที่ถูกทิ้งร้าง โยมไปดูให้อาตมาทีว่ายังอยู่หรือไม่',
    done: 'ศาลนั้นยังอยู่... ตามใบลาน ที่นั่นคือทางผ่านไปสู่สุสานเก่าของเมือง',
    objectives: [{ discover: 'abandoned_shrine' }],
    rewards: { gold: 20, exp: 160, items: [['takrut', 1]] },
  },
  {
    id: 'restless_dead', title: 'เสียงร้องจากสุสาน', giver: 'occultist', requires: ['herbal_ash', 'temple_lore'], minLevel: 5,
    offer: 'ผีตายโหงในสุสานเก่ากำลังกระสับกระส่าย ไปที่นั่นยามค่ำ ส่งพวกมันไปเสียสองตน',
    done: 'วิญญาณสงบลงชั่วคราว แต่สิ่งที่อยู่ในซากโบสถ์... นั่นอีกเรื่องหนึ่ง',
    objectives: [{ discover: 'cemetery' }, { kill: 'phitaihong', count: 2 }],
    rewards: { gold: 150, exp: 400, items: [['potion_m', 3]] },
  },
  {
    id: 'tiger_hunt', title: 'ล่าเสือสมิง', giver: 'master_hunter', requires: ['hunter_trail'], minLevel: 6,
    offer: 'มีเสือตัวหนึ่งในป่าลึกที่ไม่ใช่เสือธรรมดา มันออกล่าเฉพาะยามค่ำคืน ถ้าเจ้ากล้าพอ จงล่ามันมา',
    done: 'เจ้าทำได้จริง ๆ! ชาวเมืองคงนอนหลับสบายขึ้น',
    objectives: [{ kill: 'tiger', count: 1 }],
    rewards: { gold: 200, exp: 500, items: [['hide_armor', 1]] },
  },
];
