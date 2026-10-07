// Server-owned progress (phase 3c of docs/technical/SERVER_SPLIT.md). For a signed-in
// character the server's copy is the real one: EXP, level, stat points, gold, the bag and
// the gear change only here — from kills (server/monsters.js), from a death, and from the
// player's own actions, which the browser does locally and mirrors as `op` messages that
// the server replays with the very same Character / shop code:
//   buy {shop, id} · sell {id} · use {id} · equip {id} · unequip {slot} · alloc {key} · reset · sort ·
//   quest_accept {id} · quest_complete {id} · talk {npc} · learn {id} (a skill point) · skill_reset ·
//   evo {id, pick} (a skill's path A / B at Lv.5, src/rules/data/evolutions.js) ·
//   card {id, worn: slot} | {id, item, has, plus} (a card into the worn gear, or into bag gear `item` holding `has`).
//   Gear is named by item id, the cards it holds (`cards`) and its plus (`plus`, ตีบวก), so two
//   swords with different cards or pluses differ.
// Buying, taking cards out and ตีบวก are checked in server/combatants.js (by the shop, out of a fight).
// An action the server cannot replay (no gold, not in the bag, …) is refused and the
// browser gets the server's copy back. The browser's save sync can no longer change the
// character or its quests: the server's copies win.
// Phase 4: HP is the server's too (monster swings are resolved here), quest progress and
// rewards run on the server (the same QuestSystem), and buying needs a shop of that kind on
// the player's map and no fight going on.
import { Character } from '../src/character/Character.js';
import { CLASSES, CLASS_ALIASES, STATS } from '../src/character/data/classes.js';
import { ITEMS, EQUIP_SLOTS } from '../src/character/data/items.js';
import { buy } from '../src/shop/ShopSystem.js';
import { sortBag } from '../src/character/bag.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';
import { QUESTS } from '../src/data/quests.js';
import { NPCS } from '../src/data/npcs.js';
import { sameGear } from '../src/character/data/refine.js';

export const CHARACTER_KEY = /^tno\.character\.v\d+$/;
export const QUESTS_KEY = 'tno.quests.v1';

// Which maps have a shop of each kind (NPCs without a `map` live in the city).
export const SHOP_MAPS = NPCS.reduce((o, n) => { if (n.shopType) (o[n.shopType] ??= new Set()).add(n.map ?? 'city'); return o; }, {});
export const shopOn = (shop, map) => !!SHOP_MAPS[shop]?.has(map);
export { nearShop } from '../src/data/shopSites.js';

// A character's quests on the server: the browser's QuestSystem over an in-memory store.
export function questsFor(c, json = '{}', defs = QUESTS) {
  let text = typeof json === 'string' ? json : '{}';
  const storage = { getItem: () => text, setItem: (_, v) => { text = v; } };
  const q = new QuestSystem(defs, { storage });
  q.attach(c, null);
  q.json = () => text;
  return q;
}

// A Character from a stored save (unknown items dropped, like Character.load), or null.
export function fromSave(data) {
  if (!data || typeof data !== 'object' || !CLASSES[CLASS_ALIASES[data.classId] || data.classId]) return null;
  const inventory = Array.isArray(data.inventory) ? data.inventory.map(s => (s && ITEMS[s.id] && s.qty > 0 ? { id: s.id, qty: Math.floor(s.qty), ...(s.cards ? { cards: s.cards } : {}), ...(s.plus ? { plus: s.plus } : {}) } : null)) : undefined;   // cards, plus: checked by Character
  const equipment = data.equipment ? Object.fromEntries(Object.entries(data.equipment).map(([k, id]) => [k, id && ITEMS[id] ? id : null])) : undefined;
  try { return new Character({ ...data, inventory, equipment, hp: data.hp > 0 ? data.hp : undefined }); } catch { return null; }
}

// Replays one browser action on the server's character → true when it went through.
export function applyOp(c, msg = {}, quests = null) {
  const at = (id, cards, plus) => c.inventory.findIndex(s => s?.id === id && (ITEMS[id]?.type !== 'equip' || sameGear(s, cards, plus)));
  switch (msg.op) {
    case 'buy': return typeof msg.shop === 'string' && typeof msg.id === 'string' && buy(c, msg.shop, msg.id).ok;
    case 'sell': { const i = at(msg.id, msg.cards, msg.plus); return i >= 0 && c.sellAt(i) > 0; }
    case 'use': { const i = at(msg.id, msg.cards, msg.plus); return i >= 0 && c.useAt(i); }
    case 'equip': { const i = ITEMS[msg.id]?.type === 'equip' ? at(msg.id, msg.cards, msg.plus) : -1; return i >= 0 && c.equip(i); }
    case 'card': {
      const i = ITEMS[msg.id]?.type === 'card' ? at(msg.id) : -1; if (i < 0) return false;
      if (msg.worn) return c.insertCard(i, EQUIP_SLOTS.includes(msg.worn) ? msg.worn : 'worn');
      const g = ITEMS[msg.item]?.type === 'equip' ? at(msg.item, msg.has, msg.plus) : -1;
      return g >= 0 && c.insertCard(i, g);
    }
    case 'unequip': return EQUIP_SLOTS.includes(msg.slot) && c.unequip(msg.slot);
    case 'alloc': return STATS.includes(msg.key) && c.allocate(msg.key);
    case 'reset': c.resetStats(); return true;
    case 'sort': sortBag(c); return true;
    case 'learn': return typeof msg.id === 'string' && c.learnSkill(msg.id);
    case 'skill_reset': return c.resetSkills();
    case 'evo': return typeof msg.id === 'string' && (msg.pick === 'A' || msg.pick === 'B') && c.chooseEvo(msg.id, msg.pick);
    case 'quest_accept': return !!quests?.defs.has(msg.id) && quests.accept(msg.id);
    case 'quest_complete': return !!quests?.defs.has(msg.id) && quests.complete(msg.id);
    case 'talk': if (typeof msg.npc !== 'string' || !quests) return false; quests.onTalk(msg.npc); return true;
    default: return false;
  }
}

// A save from the browser, with the character and quests replaced by the server's (`server`: its
// JSON, or null for a brand-new slot, which starts as a fresh character of the chosen class
// with no quests). → the save object to store.
export function reconcileSave(data, server, quests = null) {
  const key = Object.keys(data).find(k => CHARACTER_KEY.test(k));
  let sent = {}; try { sent = JSON.parse(data[key]); } catch { /* checked by Accounts.check */ }
  let truth = server;
  if (!truth) {
    const classId = CLASS_ALIASES[sent.classId] || sent.classId;
    truth = Character.create(String(sent.name ?? '').slice(0, 16), CLASSES[classId] ? classId : 'muaythai', sent.gender === 'female' ? 'female' : 'male').toJSON();
  }
  return { ...data, [key]: JSON.stringify(truth), [QUESTS_KEY]: server ? quests ?? '{}' : '{}' };
}
