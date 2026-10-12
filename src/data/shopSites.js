import { EXPEDITIONS } from '../world/expeditions.js';
// Where each shop NPC stands, for the server's range check (server/combatants.js): buying,
// taking cards out and ตีบวก need the player within SHOP_RANGE metres of an NPC of that shop
// on their map. NPCs placed with P(x, z) in src/data/npcs.js are read from there; the ones on
// a named spot (registered by the world's districts as it is built) are listed here, as the
// world builds them (read from window.game.world.spots in the browser; re-read them when a
// district moves a shop).
import { NPCS } from './npcs.js';
import { COMPACT_CITY_SPOTS } from './compactCityNpcs.js';
import { SHOP_HOSTS } from './shops.js';
import { CONTACT_PHASES, contactPhase, contactActivityFor, contactSitesFor } from './npcContact.js';

export const SHOP_RANGE = 12;   // the NPC's own talk radius (≈6 m) and room for lag

// Optional customer-side navigation goals, resolved against the loaded world's
// spots. These are not authorization sites; other maps/shops keep their own goal.
export const SHOP_APPROACHES = Object.freeze({
  blacksmith: 'forge_customer', enhance: 'enh_front', general: 'general_customer',
  herbalist: 'herb_customer', occult: 'occult_customer',
  weapons: 'forge_customer', armor: 'forge_customer', charms: 'occult_customer',
});

// named spot → [map, x, z]
export const SPOT_SITES = {
  dockA_land: ['city', -21, 160.5], fishW_v1: ['city', -11, 122.4], fishE_v0: ['city', 6.7, 122.4],
  stall_weapons_v: ['city', -10.4, 20.5], stall_armor_v: ['city', -10.4, 28], stall_charms_v: ['city', -10.4, 35.5],
  stall_fruit_v: ['city', 10.4, 20.5], stall_rice_v: ['city', 10.4, 35.5], stall_lanterns_v: ['city', -5, 37.9], stall_pottery_v: ['city', -5, 18.1],
  forge_smith: ['city', -27.8, 62.75], enhance_master: ['city', -50, 89.9], general_keeper: ['city', -5.8, 62],
  herb_keeper: ['city', 10.3, 65], herb_gather: ['paddy', 48, -130.8], occult_keeper: ['city', 9.8, 86],
};

for(const e of EXPEDITIONS)SPOT_SITES[`${e.id}_supply`]=[e.id,18,e.top-24];
// World uses these same compact coordinates; field anchors retain their maps.
for (const [id, s] of Object.entries(COMPACT_CITY_SPOTS)) SPOT_SITES[id] = ['city', s.x, s.z];

const placesOf = npc => {
  const out = new Map();
  for (const phase of CONTACT_PHASES) for (const place of contactSitesFor(npc, phase, SPOT_SITES)) {
    out.set(JSON.stringify([place.map, place.x, place.z]), place);
  }
  return [...out.values()];
};
// shop type → [{ npc, map, x, z }]
export const SHOP_SITES = {};
for (const n of NPCS) if (n.shopType) for (const p of placesOf(n)) (SHOP_SITES[n.shopType] ??= []).push({ npc: n.id, ...p });
for (const [shop, host] of Object.entries(SHOP_HOSTS)) SHOP_SITES[shop] = [...(SHOP_SITES[host] ?? [])];

const sitesOf = shop => (typeof shop === 'string' && Object.hasOwn(SHOP_SITES, shop) ? SHOP_SITES[shop] : []);   // never a prototype key
// The union above is catalog/test metadata, not contact authorization. Current
// phase tables contain only outdoor sites, never yesterday's shop or a home.
const NPC_SITES = {};
const NPC_DEFS = new Map(NPCS.map(n => [n.id, n]));
for (const n of NPCS) NPC_SITES[n.id] = Object.fromEntries(CONTACT_PHASES.map(phase => [phase, contactSitesFor(n, phase, SPOT_SITES)]));
const currentSites = (npcId, phase) => {
  const current = contactPhase(phase);
  return current && typeof npcId === 'string' && Object.hasOwn(NPC_SITES, npcId) ? NPC_SITES[npcId][current] : [];
};
const within = (site, map, x, z) => Number.isFinite(x) && Number.isFinite(z)
  && site.map === map && Math.hypot(site.x - x, site.z - z) <= SHOP_RANGE;
export const npcOutdoors = (npcId, phase) => typeof npcId === 'string' && !!contactActivityFor(NPC_DEFS.get(npcId), phase);
export const nearShop = (shop, map, x, z, phase) => sitesOf(shop).some(s => currentSites(s.npc, phase).some(place => within(place, map, x, z)));
export const nearNpc = (npcId, map, x, z, phase) => currentSites(npcId, phase).some(s => within(s, map, x, z));
export const nearAnyShop = (map, x, z, phase) => Object.keys(SHOP_SITES).some(shop => nearShop(shop, map, x, z, phase));
// a spot right by a shop (tests, the UAT tools)
export const shopSpot = shop => sitesOf(shop)[0] ?? null;
