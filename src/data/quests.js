// Quest data. Each quest is given by an NPC (`giver`) and returned to `turnIn`
// (defaults to the giver). Objectives:
//   discover: landmark id       kill: monster type (src/combat/data/monsters.js) × count
//   collect: item id × count (taken on turn-in)   talk: NPC id
// `requires` lists quests that must be finished first; `minLevel` gates harder ones.
// Rewards: gold, exp and items (item ids from src/character/data/items.js).
// No "go and look at a place" quests: places are not a thing to find any more (they
// are just walked through); quests are about people, monsters and items.
export const QUESTS = [];
