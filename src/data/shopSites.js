// Where each shop NPC stands, for the server's range check (server/combatants.js): buying,
// taking cards out and ตีบวก need the player within SHOP_RANGE metres of an NPC of that shop
// on their map. NPCs placed with P(x, z) in src/data/npcs.js are read from there; the ones on
// a named spot (registered by the world's districts as it is built) are listed here, as the
// world builds them (read from window.game.world.spots in the browser; re-read them when a
// district moves a shop).
import { NPCS } from './npcs.js';

export const SHOP_RANGE = 12;   // the NPC's own talk radius (≈6 m) and room for lag

// named spot → [map, x, z]
export const SPOT_SITES = {
  dockA_land: ['city', -21, 160.5], fishW_v1: ['city', -11, 122.4], fishE_v0: ['city', 6.7, 122.4],
  stall_weapons_v: ['city', -10.4, 20.5], stall_armor_v: ['city', -10.4, 28], stall_charms_v: ['city', -10.4, 35.5],
  stall_fruit_v: ['city', 10.4, 20.5], stall_rice_v: ['city', 10.4, 35.5], stall_lanterns_v: ['city', -5, 37.9], stall_pottery_v: ['city', -5, 18.1],
  forge_smith: ['city', -27.8, 62.8], enhance_master: ['city', -50, 89.9], general_keeper: ['city', -5.8, 62],
  herb_keeper: ['city', 10.3, 65], herb_gather: ['paddy', 48, -130.8], occult_keeper: ['city', 9.8, 86],
};

const placesOf = npc => {
  const out = [];
  for (const a of Object.values(npc.schedule ?? {})) for (const at of [a?.at, ...(a?.stops ?? []).map(s => s.at)]) {
    if (at && typeof at === 'object') out.push({ map: npc.map ?? 'city', x: at.x, z: at.z });
    else if (SPOT_SITES[at]) { const [map, x, z] = SPOT_SITES[at]; out.push({ map, x, z }); }
  }
  return out;
};
// shop type → [{ npc, map, x, z }]
export const SHOP_SITES = {};
for (const n of NPCS) if (n.shopType) for (const p of placesOf(n)) (SHOP_SITES[n.shopType] ??= []).push({ npc: n.id, ...p });

const sitesOf = shop => (typeof shop === 'string' && Object.hasOwn(SHOP_SITES, shop) ? SHOP_SITES[shop] : []);   // never a prototype key
export const nearShop = (shop, map, x, z) => sitesOf(shop).some(s => s.map === map && Math.hypot(s.x - x, s.z - z) <= SHOP_RANGE);
// Any NPC, by id: standing within SHOP_RANGE of one of their spots (quests are taken and handed
// in, and things are sold, face to face).
const NPC_SITES = {};
for (const n of NPCS) NPC_SITES[n.id] = placesOf(n);
export const nearNpc = (npcId, map, x, z) => (typeof npcId === 'string' && Object.hasOwn(NPC_SITES, npcId) ? NPC_SITES[npcId] : []).some(s => s.map === map && Math.hypot(s.x - x, s.z - z) <= SHOP_RANGE);
export const nearAnyShop = (map, x, z) => Object.keys(SHOP_SITES).some(shop => nearShop(shop, map, x, z));
// a spot right by a shop (tests, the UAT tools)
export const shopSpot = shop => sitesOf(shop)[0] ?? null;
